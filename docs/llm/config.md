# 配置层：LLMConfig 与菜单项

配置层是 LLM 模块与用户/存档的接口，由 `llm/index.ts` 定义类型与读取函数，由 `library/index.js` 定义菜单 UI。所有配置通过 `lib.config` 存取，部分配置项在 `onblur` 回调中持久化到 IndexedDB。

## LLMConfig 接口字段映射表

| LLMConfig 字段 | `lib.config` 来源 | 默认值 | file:line |
|----------------|--------------------|--------|-----------|
| `enabled` | `lib.config.llm_enabled` | `false`（`!!` 转布尔） | `index.ts:15` |
| `url` | `lib.config.llm_url` | `""`（`String(...)` 包裹） | `index.ts:16` |
| `apikey` | `lib.config.llm_apikey` | `""`（`String(...)` 包裹） | `index.ts:17` |
| `model` | `lib.config.llm_model` | `""`（`String(...)` 包裹） | `index.ts:18` |
| `thinkingEffort` | `lib.config.llm_thinking_effort` | `"medium"`（`|| "medium"` 兜底） | `index.ts:19` |
| `maxRetries` | `lib.config.llm_max_retries` | `0`（`Number(...) \|\| 0` 兜底） | `index.ts:20` |
| `timeoutSec` | `lib.config.llm_timeout` | `30`（`Number(...) \|\| 30` 兜底） | `index.ts:21` |

## 菜单配置项表

配置项定义在 `library/index.js:5160-5231`，归属于菜单「选项 → AI / LLM」分组。

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

- `llm_url` / `llm_apikey` / `llm_model` / `llm_timeout`：各配置项的 `onblur` 回调中调用 `game.saveConfig(key, value)` 持久化到 IndexedDB（`index.js:5174,5183,5192,5227`）。
- `llm_enabled` / `llm_thinking_effort` / `llm_max_retries`：由 `configInteract.ts` 的 `doToggle` / `doMenuItem` 统一处理持久化（toggle/switcher 形态，无自定义 `onblur`）。

## 多轮决策配置

| `lib.config` key | 默认值 | 有效范围 | 说明 |
|---|---:|---|---|
| `llm_multi_turn` | `false` | boolean | 关闭时仅允许单轮简单动作，保持旧存档行为。 |
| `llm_max_turns` | `4` | 1–8 | 单次决策可发送的最大请求轮次；关闭多轮时实际为 1。 |
| `llm_decision_timeout` | `60` | 10–300 秒 | 一个多轮会话的总时限；每轮仍受 `llm_timeout` 限制，并取两者中较小的剩余时限。 |

这三个值在对局开始时随 LLM 配置快照。若服务端不接受 tool-role 多轮消息，本局会记为不支持并直接降级，避免每次选择重复请求。
