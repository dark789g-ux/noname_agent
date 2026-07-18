# API 调用层：从场面快照到 tool_call

本份覆盖 LLM 决策的完整核心数据流：`candidates.ts` 收集可用卡牌/技能/目标候选；`context.ts` 将候选与场面状态组装为 prompt；`tools.ts` 按决策点生成 function calling schema；`client.ts` 发起 API 调用并解析响应。

```text
candidates.ts            context.ts             tools.ts              client.ts
  getCandidateCards() ──▶                      buildTools() ──▶ callLLMWithTimeout()
  getCandidateSkills()─▶ buildContext() ──▶                    ◀── 响应解析
  getCandidateTargets()   buildSnapshot()
```

## API 调用层（`llm/client.ts`）

### ToolCallResult 接口

```typescript
export interface ToolCallResult {   // client.ts:12-15
    name: string;
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
| parse 阶段 | `"parse"` | `"No message..."` / `"No tool_calls..."` / `"Bad tool_call arguments JSON: ..."` | `undefined` | `client.ts:50,55,64` |

`throwErr` 工具函数（`client.ts:96-101`）构造带 `stage` / `httpStatus` 属性的 Error 并抛出。

### 响应解析流程

```text
resp.choices[0].message                  client.ts:48
  └─ msg 不存在 → throwErr("parse", "No message in LLM response")
  └─ msg.tool_calls[0]                   client.ts:53
       └─ tc 不存在 → throwErr("parse", "No tool_calls in LLM response")
       └─ name = tc.function.name        client.ts:58
       └─ rawArgs = tc.function.arguments client.ts:59
       └─ JSON.parse(rawArgs)             client.ts:62
            └─ 解析失败 → throwErr("parse", "Bad tool_call arguments JSON: ...")
       └─ return { name, arguments: args }  client.ts:67
```

## 上下文构造（`llm/context.ts`）

### 消息结构

`buildContext` （`context.ts:19-41`）返回包含两条消息的数组：

```text
messages[0]  role: "system"
  └─ content: "你是三国杀的 AI 玩家。根据当前场面从可用 tools 中选择最优动作。只返回一个 tool_call。"
              (context.ts:30)

messages[1]  role: "user"
  └─ content: buildSnapshot() 生成的场面快照文本
```

### buildSnapshot 段落

`buildSnapshot` （`context.ts:43-167`）构造 8 段场面信息：

| # | 段落 | 格式 | file:line |
|---|------|------|-----------|
| 1 | 决策类型 | `## 决策类型：{description}` | `context.ts:52` |
| 2 | 提示 | `## 提示：{event.prompt}` | `context.ts:55-56` |
| 3 | 对话 | `## 对话：{event.dialog}` | `context.ts:58-59` |
| 4 | 当前玩家 | `## 当前玩家：{name}` + 体力/手牌数/装备/技能 | `context.ts:63-93` |
| 5 | 其它玩家 | `## 其它玩家：` + 体力/手牌/装备/已知手牌 | `context.ts:96-135` |
| 6 | 可用卡牌 | `## 可用卡牌：` + `[idx] name (ID: id)` | `context.ts:138-145` |
| 7 | 可用技能 | `## 可用技能：` + `[idx] skillName (translatedName)` | `context.ts:148-154` |
| 8 | 弃牌要求 | `## 弃牌要求：最少 N 张，最多 M 张`（仅 `chooseToDiscard`） | `context.ts:157-164` |

### 调用的 game/player API

| API | 用途 | file:line |
|-----|------|-----------|
| `get.translation(player/card)` | 玩家/卡牌的中文显示名 | `context.ts:64,77,102,112,123,151` |
| `player.getHp()` / `player.maxHp` | 当前/最大体力 | `context.ts:65-66` |
| `player.getCards("h")` / `player.getCards("e")` | 手牌/装备列表 | `context.ts:67,75` |
| `player.getSkills(true)` | 已觉醒技能列表 | `context.ts:86` |
| `game.players` | 所有存活玩家 | `context.ts:97` |
| `p.getKnownCards(player)` | 对当前玩家可见的已知手牌 | `context.ts:120-121` |

## Tool schema（`llm/tools.ts`）

`buildTools` （`tools.ts:8-24`）按 `decisionPoint` 分派到 4 个子函数，每个返回不同 tool 集合。

### chooseToUse（`tools.ts:26-85`，最多 3 个 tool）

| tool name | parameters | required | 条件 |
|-----------|------------|----------|------|
| `use_card` | `card_id: string`, `target_ids: integer[]` | 均必填 | 始终存在 |
| `use_skill` | `skill_name: string` | 必填 | 仅 `skills.length > 0` 时添加 |
| `pass` | 无 | — | 始终存在 |

### chooseToRespond（`tools.ts:87-118`，2 个 tool）

| tool name | parameters | required | 条件 |
|-----------|------------|----------|------|
| `respond_card` | `card_id: string` | 必填 | 始终存在 |
| `pass` | 无 | — | 始终存在 |

### chooseToDiscard（`tools.ts:120-152`，2 个 tool）

| tool name | parameters | required | 条件 |
|-----------|------------|----------|------|
| `discard_cards` | `card_ids: string[]` | 必填 | 始终存在 |
| `pass` | 无 | — | 始终存在 |

### chooseBool（`tools.ts:154-179`，2 个 tool）

| tool name | parameters | required | 条件 |
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
