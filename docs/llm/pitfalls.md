# 修改指引与踩坑契约

修改 LLM 模块前必读的契约清单。前半部分给出 5 种常见修改场景所需改动的文件清单，后半部分列出 7 条不可违反的踩坑与契约。

## 修改指引

### 接入新决策点

需改动 4 个文件：

1. **content.ts**：在新的 `event.result == "ai"` 分支添加 `tryLLMDecide(event)` 调用，失败回退传统 AI。
2. **tools.ts**：在 `buildTools` 的 switch 中新增 case，定义对应的 tool schema。
3. **apply.ts**：在 `translateResult` 的 switch 中新增 case，返回引擎期望的 Result 结构。
4. **candidates.ts**（可选）：如新决策点需要收集特殊候选（如目标），添加对应函数。

### 调整 prompt

- 修改 system 文案、场上武将采集或场面信息：编辑 `context.ts`；纯文本清理、排序和渲染规则位于 `prompt-format.ts`。
- 修改决策描述映射：编辑 `DECISION_DESCRIPTIONS`（`context.ts:8-13`）。

### 增加新配置项

需改动 2 个文件：

1. **library/index.js**：在 `llm` 配置分组（`index.js:5160-5231`）添加新配置项。
2. **llm/index.ts**：在 `LLMConfig` 接口（`index.ts:3-11`）添加新字段，在 `getLLMConfig()`（`index.ts:13-23`）添加映射。

### 换 LLM 厂商

- 修改 `llm_url` 配置为目标厂商的 OpenAI 兼容 baseURL。
- 注意 `reasoning_effort` 兼容性：非 OpenAI 推理模型选「无」。
- 浏览器模式需注意 CORS，可能需要自建代理。

### 查看日志

菜单「其它」→「LLM 日志」，展示所有决策日志。支持清除。

## ⚠ 踩坑与契约

### ⚠ 动作快照与严格回退

`chooseToUse` / `chooseToRespond` 不再向模型提供全局“当前可选目标”，而是提供动作级候选。直接实体牌与经技能转换同一实体牌是不同动作，材料牌、目标范围和 `pN` 子集不得合并。`pN` 在整次决策中稳定；事件允许死亡目标时才将死亡角色加入目标池。

`selectionSpec` 缺失的技能是正常不支持，应从动作列表排除。已声明 headless 支持却遇到 UI-only `filterOk`、无法解析的范围、过滤器异常或同一步顺序依赖，属于 `translate/action-resolution` 错误，整次调用回退原生 AI，不能把异常静默当作“不可选”。步骤的集合/顺序语义只能通过 `selectionMode: "set" | "sequential"` 声明，禁止根据过滤函数的参数个数猜测；`sequential` 当前不支持。`complexSelect`、`complexTarget`、`filterAddedTarget`、`changeTarget` 等 legacy 目标标志当前必须无条件严格回退，即使存在普通 target step 也不能视为覆盖；只有未来新增无歧义的 headless 契约及 addedTarget/changeTarget 专用 materializer 后才能支持。动态动作必须能够在前一步完成后生成有限、精确的下一步；pending 后必须追加 assistant tool message、tool result 和新的 user stage 描述。自动选择由 `DecisionSession` 内部推进，不向模型额外暴露空 `select_targets` 轮。

技能步骤只能由共享 planner 推导。不要用“存在前序选牌”作为动态目标的判断条件，也不要遗漏 `selectionSpec: true` 的 `viewAs` 隐式目标步骤。普通 `chooseToRespond` 的实体牌没有目标；若事件确实需要响应后选目标，必须以显式 headless 目标步骤声明，并在选牌成功后才初始化该 pending。目标范围必须包含 `event.selectTarget` 和 `selectTarget` mod；`raw.items` 中的 Card/Player 要按对象身份反查快照引用，禁止在局部步骤重新生成 `cN/pN`。每轮 inspection 还需与当前动作的材料/目标子集取交集，并只输出实时 `available`。

### ⚠ 提示词快照、全知身份与私有信息边界

`tryLLMDecide` 每次调用只生成一次场面快照，后续选择会话的多轮请求必须复用它，不能在中途重新采集状态。这样同一决策的 tool 调用与上下文保持一致。

system 中的场上信息仅来自 `game.players`，按座位号排序，未分配座位排末尾；它包含真实 `player.identity`，不检查 `identityShown`。此全知信息只供 LLM 决策使用，绝不能反向改变 UI、联机同步或真人玩家的信息可见性。

user 中手牌披露继续遵循调用者视角：只保留本人手牌与 `getKnownCards(player)` 已知的他人手牌。不得因为身份全知或提示词增强而输出未知手牌。

当前有效技能应覆盖武将、临时、额外和装备技能，同时排除隐藏、内部辅助和全局规则技能；技能描述以及判定牌描述移除 HTML 和多余空白后必须完整保留，不得为了控制 token 截断。判定牌有 `viewAs` 时，描述以生效牌为准，并保留必要的原始牌名。

### ⚠ baseURL 语义（破坏性）

`llm_url` 是 **baseURL**（不含 `/chat/completions`），openai SDK 内部自动拼接。老存档中保存的完整 endpoint 会失效。

- SDK 初始化：`new OpenAI({ baseURL: config.url, ... })`（`client.ts:26-32`）
- 配置项定义：`library/index.js:5168-5175`

| 状态 | 值 | 说明 |
|------|----|------|
| 正确 | `https://api.openai.com/v1` | baseURL 格式，SDK 拼接为 `.../v1/chat/completions` |
| 正确 | `http://localhost:11434/v1` | Ollama 等兼容服务 |
| 错误 | `https://api.openai.com/v1/chat/completions` | 旧版完整 endpoint，SDK 拼接为 `.../chat/completions/chat/completions`，请求 404 |

### ⚠ reasoning_effort 仅 OpenAI 推理模型支持

`reasoning_effort` 是 OpenAI o1/o3 系列推理模型专用参数。非推理模型（GPT-4o、deepseek-chat 等）或其它厂商接口会忽略或报错。

- 条件逻辑：`client.ts:43-45`，`"none"` 时不传该字段，其余原样传递。

| 菜单显示 | `thinkingEffort` 值 | request body |
|----------|---------------------|--------------|
| 无 | `"none"` | 不传 `reasoning_effort` |
| 低 | `"low"` | `"low"` |
| 中 | `"medium"` | `"medium"` |
| 高 | `"high"` | `"high"` |

### ⚠ 错误 stage 分类是契约

`decide.ts` 和 `logger.ts` 依赖 `err.message` 的字面量和 `err.stage` 枚举值做分支判断。改 `client.ts` 的错误映射时**必须保持 stage 与 message 字面量稳定**。

- `decide.ts:60`：`message.includes("timed out")` 识别超时降级。
- `client.ts:68-101`：错误分类映射，stage 取值**仅** `"fetch"` / `"parse"`（`"translate"` 由 `apply.ts` 抛出，见 `apply.ts:41-43`）。
- `logger.ts:4`：`ErrorStage = "fetch" | "parse" | "translate"`。

### ⚠ APIConnectionTimeoutError 继承自 APIConnectionError

`instanceof` 检查必须**先子类后父类**，否则所有超时会被吞进"普通连接错误"分支。

```typescript
// client.ts:72-80 —— 正确顺序
if (e instanceof APIConnectionTimeoutError) {   // 先子类
    throwErr("fetch", "LLM request timed out");
}
if (e instanceof APIConnectionError) {         // 后父类
    throwErr("fetch", `LLM fetch error: ${e.message}`);
}
```

### ⚠ CORS 限制（浏览器/Cordova）

浏览器直连 OpenAI 会被 CORS 拦截，需自建代理；Electron 模式可直接使用。此限制与旧版一致。

- `library/index.js:5166`（`llm_enabled` intro）
- `library/index.js:5172`（`llm_url` intro）

### ⚠ 降级链是设计契约

任何异常都返回 `{handled: false}` 让引擎回退传统 AI。`content.ts` 的 4 个调用点（`content.ts:5186,5471,5983,8361`）均依赖此契约：`tryLLMDecide` 失败时自然滑落到 `ai.basic.*` 逻辑。

改 `decide.ts` 时不要破坏降级——catch 块必须始终返回 `{ handled: false }`（`decide.ts:62`）。

### ⚠ 跨平台分支统一

SDK 用 `dangerouslyAllowBrowser: true`（`client.ts:31`）强制所有平台（浏览器/Cordova/Electron renderer）走 browser 分支使用原生 `fetch`，避免 Electron context isolation 下 Node 分支（`http`/`https` 模块）不可用导致初始化失败。

### ⚠ 多轮选择必须经过会话校验

不要把 LLM 返回的数组直接写入 `event.result`，也不要为异步选择临时修改 `ui.selected` 或 `_status.event`。必须经 `DecisionSession`/`SelectionValidator` 校验候选成员、去重、动态数量、过滤器和最终 `filterOk` 后才 materialize 引擎 Result。任一阶段无效、超时、超轮次或 provider 不支持 tool-role，均返回 `{ handled:false }`。

遗留事件的 `filterOk` 若依赖 DOM 全局选择态，无法由无 UI 会话可靠重放；这类事件必须通过 `selectionSpec.finalPredicate(readonlyContext, event, player)` 提供等价的纯校验，缺失时安全降级，不得跳过组合校验。

`selectionSpec: true` 仅适用于已审计、可由 `filterCard`、`selectCard`、`filterTarget`、`selectTarget` 与 `viewAs` 无 UI 重放的技能。`chooseButton.backup` 技能可先返回技能中间结果并依赖引擎创建后续标准 `chooseButton` 事件；该事件必须具备可读的 `dialog.buttons[].link`，否则以精确的 `unsupported chooseButton: dialog buttons are unavailable` 回退。自定义 dialog 或私有信息未满足该条件时不能仅加标记宣称支持。

标准 `chooseButton.filterOk` 未定义时，事件层会附加 `finalPredicate: () => true`，与原本的默认接受语义一致。若技能自定义了 `chooseButton.filterOk`，则必须在 `chooseButton.selectionSpec`（或技能 `selectionSpec`）提供纯 `finalPredicate`；缺失 adapter 时 LLM 会回退。已通过 LLM 校验的按钮结果生成 `${skill}_backup` 后，backup 继承 `selectionSpec: true`，使后续视为牌使用/响应继续走无 UI 校验链。
