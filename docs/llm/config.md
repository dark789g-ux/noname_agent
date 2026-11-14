# 配置层：LLMConfig 与菜单项

配置层是 LLM 模块与用户/存档的接口，由 `llm/index.ts` 定义类型与读取函数，由 `library/configuration/options/llm.ts` 定义菜单 UI。所有配置通过 `lib.config` 存取，输入项在失焦或按 Enter 后保存；本地浏览器使用 SQLite，原生客户端使用 IndexedDB，详见 [SQLite 存储](../sqlite-storage.md)。

## LLMConfig 接口字段映射表

| LLMConfig 字段 | `lib.config` 来源 | 默认值 | file:line |
|----------------|--------------------|--------|-----------|
| `enabled` | `lib.config.llm_enabled` | `false`（`!!` 转布尔） | `index.ts:15` |
| `url` | `lib.config.llm_url` | `""`，读取时清理历史富文本 | `index.ts` / `config.ts` |
| `apikey` | `lib.config.llm_apikey` | `""`，读取时清理历史富文本 | `index.ts` / `config.ts` |
| `model` | `lib.config.llm_model` | `""`，读取时清理历史富文本 | `index.ts` / `config.ts` |
| `thinkingEffort` | `lib.config.llm_thinking_effort` | `"medium"`（`|| "medium"` 兜底） | `index.ts:19` |
| `maxRetries` | `lib.config.llm_max_retries` | `0`（`Number(...) \|\| 0` 兜底） | `index.ts:20` |
| `timeoutSec` | `lib.config.llm_timeout` | `30`（`Number(...) \|\| 30` 兜底） | `index.ts:21` |

## 菜单配置项表

配置项定义在 `library/configuration/options/llm.ts`，归属于菜单「选项 → AI / LLM」分组。

| 配置项 key | name | init | 类型 | item | intro 简述 | file:line |
|------------|------|------|------|------|-----------|-----------|
| `llm_enabled` | 启用 LLM AI 助手 | `false` | toggle | — | 启用后 AI 决策改由 LLM 接管，失败自动回退 | `index.js:5163-5166` |
| `llm_url` | API 地址 | `""` | input | — | OpenAI 兼容 baseURL，SDK 自动拼接路径 | `index.js:5168-5175` |
| `llm_apikey` | API 密钥 | `""` | input | — | API Key，仅存本地 | `index.js:5177-5184` |
| `llm_model` | 模型名称 | `""` | input | — | 如 gpt-4o-mini、deepseek-chat 等 | `index.js:5186-5193` |
| `llm_thinking_effort` | 思考深度 | `"medium"` | switcher | `none/low/medium/high` | 推理模型思考投入程度 | `index.js:5195-5204` |
| `llm_max_retries` | 最大重试次数 | `"0"` | switcher | `0/1/2/3` | openai SDK 自动重试次数 | `index.js:5206-5215` |
| `llm_timeout` | 超时（秒） | `"30"` | input | — | 超时自动回退本地 AI | `index.js:5217-5228` |

## 持久化机制

- `llm_url` / `llm_apikey` / `llm_model`：通过 `config-input.ts` 按纯文本粘贴和保存，去除首尾空白；失焦后同步菜单缓存，重建组件不会恢复旧值。主动清空仍可保存。
- API 地址必须为完整的 HTTP(S) URL；非法值会在输入框下提示，保留原有已保存配置。请求前再次校验，失败以 `config` 阶段记录并回退本地 AI，不重复尝试流式和非流式请求。
- 启动加载配置后，`migrateLLMTextConfig` 在惰性 DOM 容器内提取历史 HTML 的文本并保存；仅处理三个 LLM 文本字段，不改其他配置。
- `llm_timeout` / `llm_decision_timeout`：失焦后校验数值范围并调用 `game.saveConfig` 持久化。
- `llm_enabled` / `llm_thinking_effort` / `llm_max_retries`：由 `configInteract.ts` 的 `doToggle` / `doMenuItem` 统一处理持久化（toggle/switcher 形态，无自定义 `onblur`）。

LLM 配置在开局时建立快照，设置界面保存后提示“下局生效”。使用 `pnpm -F noname test:llm-config` 检查纯文本保存、历史值清理、地址校验、两种存储后端及默认目标范围解析。

## 多轮决策配置

| `lib.config` key | 默认值 | 有效范围 | 说明 |
|---|---:|---|---|
| `llm_max_turns` | `4` | 1–8 | 启用 LLM 后单次决策的最大请求次数；保存的预算继续生效。 |
| `llm_decision_timeout` | `60` | 10–300 秒 | 一个多轮会话的总时限；每轮仍受 `llm_timeout` 限制，并取两者中较小的剩余时限。 |

启用 LLM 后自动允许多轮，旧 `llm_multi_turn: false` 不再生效，独立菜单开关已移除。轮次和超时在对局开始时随配置快照。若服务端不接受 tool-role 多轮消息，本局会记为不支持并直接降级，避免每次选择重复请求。
