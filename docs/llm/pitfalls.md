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

- 修改 system 文案：编辑 `context.ts:30` 的 `content` 字符串。
- 修改场面信息：编辑 `buildSnapshot` 函数（`context.ts:43-167`），调整段落结构或增减信息。
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
