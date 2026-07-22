# API 调用层：从场面快照到 tool_call

本份覆盖 LLM 决策的完整核心数据流：`action-candidates.ts` 为出牌/响应建立会话级动作快照；`context.ts` 将同一份快照与场面状态组装为 prompt；`tools.ts` 按决策点生成 function calling schema；`client.ts` 发起 API 调用并解析响应。

```text
action-candidates.ts       context.ts             DecisionSession
  stable p0/p1 targetPool ─▶ buildContext() ─────▶ snapshot 校验 + 实时复核
  CandidateAction[]        可执行动作 prompt        └─ pending 时重投影 available
```

## 动作快照

`chooseToUse` 与 `chooseToRespond` 每次只构造一份 `DecisionCandidateSnapshot`，同时传给 user prompt 和 `DecisionSession`。`pN` 先按事件允许引用的存活玩家（以及 `deadTarget` 时的死亡玩家）编号，再按动作过滤，跨动作与多轮选择不变。

每个 `CandidateAction` 都有独立的材料牌和目标元数据：`none` 没有目标步骤，`automatic` 由会话直接提交，`select` 给出有限的 `pN` 与数量范围，`dynamic` 只允许有明确后续 `selectionSpec` 的选牌后目标步骤。普通 `chooseToRespond` 实体牌属于 `none`；只有事件显式声明可序列化的 headless 目标步骤时，响应动作才在提交牌后进入目标 pending。模型不能从另一个动作借用目标；接收 tool call 后仍会重新运行所有权、存活状态和引擎 `filterCard/filterTarget`，因此快照过期会安全回退原生 AI。

快照与执行层共用 `resolveSkillActionPlan`，不能分别推导技能步骤。仅“选牌步骤在目标步骤之前”并不足以判为动态：例如 `olqiangxi` 的目标与材料无关，可静态列出；`rehuoji` 的 `viewAs` 目标步骤由共享 planner 补出并在选牌后实时投影。实体牌和 `viewAs` 牌的目标数量都按引擎顺序解析：卡牌 `selectTarget` → `event.selectTarget` 覆盖 → `game.checkMod(..., "selectTarget", ...)`。步骤是否依赖同一步已选顺序必须由 `selectionMode` 显式声明：`set` 可按无序集合验证，`sequential` 必须严格回退，不能依据过滤函数参数个数猜测。`complexSelect`、`complexTarget`、`filterAddedTarget`、`changeTarget` 等 legacy 目标标志始终按动作解析错误回退；普通 target step 无法表达 addedTarget/changeTarget 的结果结构，只有未来同时引入无歧义的 headless 契约与专用 materializer 后才能支持。

动作候选核心通过显式 runtime 注入引擎能力，使真实快照和 `DecisionSession` 能在无浏览器 UI 的测试进程中运行；生产入口注入 `game/get/lib`。这不会改变公开工具 schema 或游戏 UI。

## API 调用层（`llm/client.ts`）

### ToolCallResult 接口

```typescript
export interface ToolCallResult {   // client.ts
    id: string;
    name: string;
    reason: string;
    arguments: Record<string, any>;
}
```

### callLLMWithTimeout 签名

```typescript
async function callLLMWithTimeout(    // client.ts:21-25
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    config: LLMConfig,
): Promise<ToolCallResult>
```

### openai SDK 初始化

| 配置项 | 值 | 说明 | file:line |
|--------|-----|------|-----------|
| `baseURL` | `config.url` | OpenAI 兼容 baseURL（不含 `/chat/completions`） | `client.ts:27` |
| `apiKey` | `config.apikey` | API Key | `client.ts:28` |
| `timeout` | `config.timeoutSec * 1000` | 毫秒级超时 | `client.ts:29` |
| `maxRetries` | `config.maxRetries` | SDK 内置重试次数 | `client.ts:30` |
| `dangerouslyAllowBrowser` | `true` | 强制所有平台走 browser 分支 | `client.ts:31` |

### request body 字段

| 字段 | 值 | 说明 | file:line |
|------|-----|------|-----------|
| `model` | `config.model` | 模型名称 | `client.ts:38` |
| `messages` | 传入参数 | system + user 消息 | `client.ts:39` |
| `tools` | 传入参数 | function calling tool schema | `client.ts:40` |
| `tool_choice` | `"auto"` | 让模型自动选择 tool | `client.ts:41` |
| `reasoning_effort` | `config.thinkingEffort` | 仅 `!== "none"` 时添加 | `client.ts:43-45` |

### reasoning_effort 条件逻辑

```typescript
if (config.thinkingEffort !== "none") {    // client.ts:43
    body.reasoning_effort = config.thinkingEffort;  // client.ts:44
}
```

`"none"` 时不传该字段，其余（`"low"` / `"medium"` / `"high"`）原样赋值。

### 错误分类映射表

| SDK Error 类型 | stage | message 格式 | httpStatus | file:line |
|----------------|-------|-------------|------------|-----------|
| 内部已带 `stage` 的错误 | 透传 `e.stage` | 透传 `e.message` | 透传 `e.httpStatus` | `client.ts:70` |
| `APIConnectionTimeoutError` | `"fetch"` | `"LLM request timed out"` | `undefined` | `client.ts:73-74` |
| `APIConnectionError` | `"fetch"` | `"LLM fetch error: {e.message}"` | `undefined` | `client.ts:78-79` |
| `APIError` | `"fetch"` | `"HTTP {status}: {bodyText}"` | `e.status` | `client.ts:83-88` |
| 其它（未知） | `"fetch"` | `"LLM fetch error: {e.message}"` | `undefined` | `client.ts:92` |
| parse 阶段 | `"parse"` | `"No message..."` / `"No tool_calls..."` / `"Bad tool_call arguments JSON: ..."` / `reason` 校验错误 | `undefined` | `client.ts` |

`throwErr` 工具函数（`client.ts:96-101`）构造带 `stage` / `httpStatus` 属性的 Error 并抛出。

### 响应解析流程

```text
resp.choices[0].message                  client.ts:48
  └─ msg 不存在 → throwErr("parse", "No message in LLM response")
  └─ msg.tool_calls[0]                   client.ts:53
       └─ tc 不存在 → throwErr("parse", "No tool_calls in LLM response")
       └─ name = tc.function.name        client.ts:58
       └─ rawArgs = tc.function.arguments client.ts:59
       └─ parseToolCallResult(id, name, rawArgs)
            └─ arguments 必须为非 null 的对象，且不能是数组
            └─ reason 必须是去首尾空白后长度为 1–200 的字符串
            └─ return { id, name, reason, arguments }（arguments 不含 reason）
```

## 上下文构造（`llm/context.ts`）

### 消息结构

`buildContext` 返回包含两条消息的数组。每次 `tryLLMDecide` 开始时只生成一次快照；同一决策会话的多轮选牌、选目标请求复用该快照。

```text
messages[0]  role: "system"
  └─ 固定决策规则 + 【场上武将信息】
       └─ 所有 game.players（仅存活），按座位号升序；未分配座位排末尾
       └─ 武将名、座位号、真实身份、势力、性别
       └─ 当前有效技能：显示名及完整、清理 HTML 与多余空白后的描述

messages[1]  role: "user"
  └─ 决策类型、提示、对话、【当前场面状态】及既有候选项
       └─ 每名存活玩家的体力/上限/护甲、手牌数、装备、已知手牌、横置、翻面和判定区
```

### buildSnapshot 段落

`buildSnapshot` 构造以下场面信息；候选卡牌、技能与弃牌要求的既有格式保持不变。

| # | 段落 | 内容 |
|---|------|------|
| 1 | 决策类型 | `## 决策类型：{description}` |
| 2 | 提示 | `## 提示：{event.prompt}` |
| 3 | 对话 | `## 对话：{event.dialog}` |
| 4 | 当前场面状态 | 每名存活玩家的即时状态；当前行动者另作标记 |
| 5 | 可用卡牌 | `[idx] name (ID: id)` |
| 6 | 可用技能 | `[idx] skillName (translatedName)` |
| 7 | 弃牌要求 | `## 弃牌要求：最少 N 张，最多 M 张`（仅 `chooseToDiscard`） |

### 场上信息与可见性契约

- system 中的武将信息只遍历 `game.players`，不包含阵亡玩家。身份直接使用真实 `player.identity`，不受 `identityShown` 影响；这只向 LLM 提供信息，不改变 UI 或真人玩家的可见性规则。
- 当前有效技能包含武将、临时、额外和装备技能；隐藏、内部辅助与全局规则技能不输出。技能按原始顺序去重；没有可显示名称或规则描述的技能不输出。描述使用动态描述 API，移除 HTML 和多余空白，但不截断。
- user 中的手牌仍遵循既有已知手牌规则：只输出调用者本人的手牌和调用者已知的其它玩家手牌，绝不因 LLM 上下文增强而泄露未知手牌。
- 判定区逐张输出生效名称、必要时的原始牌名、花色、点数、颜色与完整官方描述。存在 `viewAs` 时，以视为牌的描述为准。

### 调用的 game/player API

| API | 用途 | file:line |
|-----|------|-----------|
| `get.translation(player/card)` | 玩家、技能、卡牌及阵营/性别/身份的显示文本 |
| `player.getHp()` / `player.maxHp` / `player.hujia` | 当前体力、体力上限与护甲 |
| `player.getCards("h/e/j")` | 手牌、装备与判定区列表 |
| `player.getSkills(null, true, true)` | 当前有效的武将、临时、额外和装备技能 |
| `game.players` | 所有存活玩家；按座位号排序后生成 system 与 user 段落 |
| `p.getKnownCards(player)` | 对当前玩家可见的其它玩家手牌 |
| `player.isLinked()` / `player.isTurnedOver()` | 横置与翻面状态 |

## Tool schema（`llm/tools.ts`）

`buildTools` （`tools.ts`）按 `decisionPoint` 分派到 4 个子函数，每个返回不同 tool 集合。所有 function tool 的 JSON Schema 都注入必填 `reason`：字符串，描述为“简要说明选择原因。”，`minLength: 1`、`maxLength: 200`，且保持 `additionalProperties: false`。

以下表格的“工具特有参数”和“工具特有必填”仅描述各工具自身字段；**每个工具（包括 `pass`、`yes`、`no`）都额外包含并必填 `reason`**。

### chooseToUse（`tools.ts:26-85`，最多 3 个 tool）

| tool name | 工具特有参数 | 工具特有必填 | 条件 |
|-----------|------------|----------|------|
| `use_card` | `card_id: string`, `target_ids: integer[]` | 均必填 | 始终存在 |
| `use_skill` | `skill_name: string` | 必填 | 仅 `skills.length > 0` 时添加 |
| `pass` | 无 | — | 始终存在 |

### chooseToRespond（`tools.ts:87-118`，2 个 tool）

| tool name | 工具特有参数 | 工具特有必填 | 条件 |
|-----------|------------|----------|------|
| `respond_card` | `card_id: string` | 必填 | 始终存在 |
| `pass` | 无 | — | 始终存在 |

### chooseToDiscard（`tools.ts:120-152`，2 个 tool）

| tool name | 工具特有参数 | 工具特有必填 | 条件 |
|-----------|------------|----------|------|
| `discard_cards` | `card_ids: string[]` | 必填 | 始终存在 |
| `pass` | 无 | — | 始终存在 |

### chooseBool（`tools.ts:154-179`，2 个 tool）

| tool name | 工具特有参数 | 工具特有必填 | 条件 |
|-----------|------------|----------|------|
| `yes` | 无 | — | 始终存在 |
| `no` | 无 | — | 始终存在 |

## 候选收集（`llm/candidates.ts`）

### CandidateCard 接口

```typescript
export interface CandidateCard {   // candidates.ts:3-7
    card: any;
    id: string;
    name: string;
}
```

### 三个收集函数

| 函数 | 用途 | 调用的 API | file:line |
|------|------|------------|-----------|
| `getCandidateCards` | 收集可用出牌候选 | `event.filterCard` / `player.getCards(position)` / `get.translation` | `candidates.ts:13-31` |
| `getCandidateSkills` | 收集可发动技能候选 | `player.getSkills(true)` / `event._aiexclude` / `lib.skill[s]` | `candidates.ts:37-51` |
| `getCandidateTargets` | 收集卡牌可用目标 | `event.filterTarget` / `game.players` / `game.dead` | `candidates.ts:57-66` |

### cardToId 序列化

`cardToId` （`candidates.ts:72-77`）将 Card 对象序列化为 `{name}_{suit}_{number}` 格式：

| 卡牌 | 序列化结果 |
|------|-----------|
| 杀（黑桃 3） | `sha_spade_3` |
| 桃（红桃 7） | `tao_heart_7` |
| 闪（梅花 5） | `shan_club_5` |

`findCardById` （`candidates.ts:82-84`）在候选列表中按 `c.id === id` 线性搜索。

## 多轮工具与短引用

新协议使用会话短引用，卡牌为 `c0`、目标为 `p0`、按钮为 `b0`。旧 `card_id`、`card_ids` 与 `target_ids` 仍会被解析为短引用，供已有 provider 兼容使用。

| tool | 主要参数 | 用途 |
|------|----------|------|
| `use_card` | `card_ref`, `target_refs?` | 使用一张候选牌 |
| `use_skill` | `skill_name`, `card_refs?`, `target_refs?` | 选择主动技能；需要后续选择时进入会话 |
| `select_buttons` | `step_id`, `button_refs` | 提交按钮步骤 |
| `select_cards` | `step_id`, `card_refs` | 提交选牌步骤 |
| `select_targets` | `step_id`, `target_refs` | 提交选目标步骤 |
| `select_controls` | `step_id`, `control_refs` | 提交控制项步骤 |
| `select_numbers` | `step_id`, `number_refs` | 提交数值步骤 |

一次模型响应只能包含一个 tool call；多个 tool call、缺失 `tool_call_id`、过期 `step_id`、引用不在当前候选中，或数量/过滤器/最终 `filterOk` 不通过时，翻译阶段失败并回退原生 AI。候选技能会包含清理后的技能说明（最多 600 字符），仅发送当前合法技能。
