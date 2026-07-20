# LLM 模块（AI 决策）

无名杀的 LLM（大语言模型）AI 决策模块，位于 `apps/core/noname/llm/`，共 9 个文件。该模块通过官方 `openai` SDK 调用 OpenAI 兼容 API（含 function calling），在 AI 玩家决策点接管决策逻辑；调用失败或超时自动降级回传统 AI。

> - 所有路径均相对于仓库根目录。
> - LLM 模块位于 `apps/core/noname/llm/`，9 个文件：`index.ts` / `decide.ts` / `client.ts` / `context.ts` / `tools.ts` / `candidates.ts` / `apply.ts` / `logger.ts` / `openLLMPlayerLog.ts`。
> - 通过官方 `openai` SDK 调用 OpenAI 兼容接口（不是手搓 fetch）。
> - 仅在 AI 玩家决策点触发（`event.result == "ai"`）。

## 总览

```text
library/element/content.ts
  ├─ chooseToUse   ───────────────┐
  ├─ chooseToRespond ─────────────┤
  ├─ chooseToDiscard ─────────────┼── event.result=="ai"
  └─ chooseBool ─────────────────┘
            │
            ▼
  llm/decide.ts  tryLLMDecide(event)
    ├─ 前置检查: llmEnabled() / llmConfigured()
    │     └─ 不通过 → {handled:false} → 引擎回退 ai.basic.*
    ├─ 候选收集
    │     ├─ getCandidateCards()  ←── event.filterCard / player.getCards("hs")
    │     └─ getCandidateSkills() ←── player.getSkills(true) / event._aiexclude
    ├─ 构造上下文
    │     └─ buildContext() → system msg + user msg (buildSnapshot 场面快照)
    ├─ 构造 tools
    │     └─ buildTools(decisionPoint) → OpenAI function calling schema
    ├─ 调用 API
    │     └─ callLLMWithTimeout(messages, tools, config)
    │           └─ openai SDK → client.chat.completions.create(body)
    ├─ 翻译结果
    │     └─ translateResult(event, toolCall, candidates) → 引擎 Result
    │           └─ findCardById / getCandidateTargets / filterTarget 验证
    └─ 成功 → {handled:true, result}
          │
    异常 catch
          └─ {handled:false} → 引擎回退 ai.basic.*
```

核心目录：`apps/core/noname/llm/`

## 选择能力与边界

LLM 通过无 UI 选择会话支持简单选牌、选目标、动态数量、`viewAs`，以及可序列化的按钮、控制项和数值步骤。技能必须声明 `selectionSpec`，或被安全的简单规则适配器识别，才会交给 LLM。

目前已审计并声明 `selectionSpec` 的代表技能为：`rerende`、`olqiangxi`、`reshenxing`、`rehuoji`、`reqice`、`xintaoluan`、`mbzhaofu`。后三者先返回技能中间结果，再由引擎创建标准 `chooseButton` 子事件；只有该事件已提供可读 `dialog.buttons[].link` 时才继续多轮选择，否则以 `unsupported chooseButton: dialog buttons are unavailable` 安全回退。`choose*OL`、对比及窥视私有牌流程同样不接入。

## 文件清单

| 文件 | 说明 |
|------|------|
| `apps/core/noname/llm/index.ts` | LLMConfig 接口定义、`getLLMConfig()` 配置读取、模块导出入口 |
| `apps/core/noname/llm/decide.ts` | 核心调度函数 `tryLLMDecide`，串联候选收集→上下文构造→API 调用→结果翻译 |
| `apps/core/noname/llm/client.ts` | OpenAI SDK 封装，`callLLMWithTimeout` 发起请求并做错误分类 |
| `apps/core/noname/llm/context.ts` | `buildContext` 构造 system + user 消息，`buildSnapshot` 生成场面快照 |
| `apps/core/noname/llm/tools.ts` | `buildTools` 按决策点构造 OpenAI function calling tool schema |
| `apps/core/noname/llm/candidates.ts` | 候选收集：卡牌/技能/目标，含 `cardToId` 序列化与 `findCardById` 反查 |
| `apps/core/noname/llm/apply.ts` | `translateResult` 将 LLM tool_call 翻译为引擎期望的 Result 格式 |
| `apps/core/noname/llm/logger.ts` | 日志系统：`LLMLogger` 类，缓冲写入 IndexedDB，最大保留 500 条 |
| `apps/core/noname/llm/openLLMPlayerLog.ts` | 打开指定 AI 武将的日志 Dialog，并挂载玩家日志面板 |

## 文档导航

| 文档 | 内容 |
|------|------|
| [architecture.md](architecture.md) | 入口调度、上游触发点、下游结果应用 |
| [api-layer.md](api-layer.md) | API 调用、上下文构造、Tool schema、候选收集 |
| [config.md](config.md) | 配置层与持久化 |
| [logging.md](logging.md) | 日志系统与 UI 入口 |
| [pitfalls.md](pitfalls.md) | 修改指引与踩坑契约 |

## 模块导出（`llm/index.ts`）

| 名称 | 类型 | 来源文件 | 用途 |
|------|------|----------|------|
| `LLMConfig` | interface | `index.ts:3-11` | 配置类型定义 |
| `getLLMConfig` | function | `index.ts:13-23` | 从 `lib.config` 读取并构造 LLMConfig |
| `llmEnabled` | function | `index.ts:25-27` | 判断 LLM 是否启用 |
| `llmConfigured` | function | `index.ts:29-32` | 判断 url/apikey/model 是否均已配置 |
| `tryLLMDecide` | function | `decide.ts:14` | 核心调度入口，唯一对外暴露的决策函数 |
| `llmLogger` | LLMLogger | `logger.ts:263` | 日志单例，供 UI 层调用 |

## 相关文档

- [../menu-dialog.md](../menu-dialog.md)（菜单对话框，含「选项-AI/LLM」配置 UI 与「配置项的下游行为：llm_thinking_effort」实例）
- [../lib-skill-format.md](../lib-skill-format.md)（技能格式参考，理解 `candidates.ts` 过滤的 enable/usable 字段）
