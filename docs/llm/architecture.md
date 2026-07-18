# 架构：调度、触发与应用

本份覆盖 LLM 模块的三层架构：`decide.ts` 是调度核心，串联候选收集→上下文构造→API 调用→结果翻译；上游 `content.ts` 在 4 个 AI 决策点触发 `tryLLMDecide`；下游 `apply.ts` 将 LLM 返回的 tool_call 翻译为引擎可消费的 Result 对象。

## 入口与调度（`llm/decide.ts`）

`tryLLMDecide(event)` （`llm/decide.ts:14`）是 LLM 决策的唯一入口，返回 `Promise<{ handled: boolean; result?: any }>`。

### 调度步骤

| 步骤 | 代码位置 | 说明 |
|------|----------|------|
| 1 | `decide.ts:15-16` | 取 `decisionPoint = event.name`，`player = event.player` |
| 2 | `decide.ts:17-24` | 取 playerName、config，调用 `llmLogger.start()` 获取 logId |
| 3 | `decide.ts:27-29` | `llmEnabled()` 前置检查，不通过 → `endFallback("disabled")`，返回 `{handled:false}` |
| 4 | `decide.ts:31-33` | `llmConfigured()` 前置检查，不通过 → `endFallback("no_config")`，返回 `{handled:false}` |
| 5 | `decide.ts:37-38` | `getCandidateCards` + `getCandidateSkills` 收集候选 |
| 6 | `decide.ts:41` | `buildContext(event, {cards, skills})` → messages |
| 7 | `decide.ts:42` | `buildTools(decisionPoint, {cards, skills})` → tools |
| 8 | `decide.ts:43` | `llmLogger.logRequest(logId, messages, tools)` |
| 9 | `decide.ts:46` | `callLLMWithTimeout(messages, tools, config)` → toolCall |
| 10 | `decide.ts:49` | `translateResult(event, toolCall, {cards, skills})` → result |
| 11 | `decide.ts:50-51` | `llmLogger.logResponse` + `llmLogger.end(logId, "success")` |
| 12 | `decide.ts:53` | 返回 `{handled: true, result}` |
| catch | `decide.ts:54-63` | 异常处理（见下方流程图） |

### catch 降级分支

```text
catch (e: any)                                    decide.ts:54
  │
  ├─ stage = e?.stage || "fetch"                  decide.ts:55
  ├─ llmLogger.logError(logId, stage, msg, http) decide.ts:58
  │
  ├─ 判断 fallbackReason:                        decide.ts:60
  │     stage=="fetch" && msg.includes("timed out")
  │       → "timeout"
  │       → 否则 msg 原文
  │
  ├─ llmLogger.endFallback(logId, fallbackReason) decide.ts:61
  └─ return { handled: false }                    decide.ts:62
        │
        ▼
  引擎回退到 ai.basic.* 传统 AI
```

## 上游：触发点（`library/element/content.ts`）

`content.ts` 中 4 个决策点在 `event.result == "ai"` 时调用 `tryLLMDecide`，返回 `handled:false` 时继续走传统 AI 分支。

导入位于 `content.ts:8`：`import { tryLLMDecide } from "@/llm/index.js"`

| 决策点 | file:line | 触发条件 | 例子场景 |
|--------|-----------|----------|----------|
| `chooseToUse` | `content.ts:5186` | `event.result != "ai"` 时跳过 | 出牌阶段选牌/使用技能/跳过 |
| `chooseToRespond` | `content.ts:5471` | `event.result != "ai"` 时跳过 | 被杀时选择出闪/跳过 |
| `chooseToDiscard` | `content.ts:5983` | `event.result == "ai"` | 弃牌阶段选择弃置手牌 |
| `chooseBool` | `content.ts:8361` | `event.result == "ai"` | 技能触发时的"是/否"选择 |

所有 4 个调用点的回退模式一致：

```text
llmResult = await tryLLMDecide(event)
  ├─ llmResult.handled && llmResult.result
  │     → event.result = llmResult.result; game.uncheck(); return
  └─ 否则 → 继续执行 ai.basic.* 传统 AI 逻辑
```

## 下游：结果应用（`llm/apply.ts`）

`translateResult` （`apply.ts:10-46`）将 LLM 返回的 `tool_call` 按 name 分派翻译。apply.ts 不直接改游戏状态，只返回引擎可消费的 Result 对象。

| tool name | 返回结构 | 引擎消费方式 | file:line |
|-----------|----------|---------------|-----------|
| `use_card` | `{ bool: true, card, cards: [card], targets }` | content.ts 将 result 赋给 event.result，引擎据此选牌+选目标 | `apply.ts:48-95` |
| `respond_card` | `{ bool: true, card, cards: [card] }` | 引擎将 card 作为响应牌打出 | `apply.ts:97-121` |
| `use_skill` | `{ bool: true, skill: skillName }` | 引擎发动指定技能 | `apply.ts:123-144` |
| `discard_cards` | `{ bool: true, cards }` | 引擎弃置指定卡牌 | `apply.ts:146-173` |
| `end_phase` / `pass` | `{ bool: false }` | 引擎跳过当前操作 | `apply.ts:30-33` |
| `yes` | `{ bool: true }` | 引擎确认选择 | `apply.ts:34-36` |
| `no` | `{ bool: false }` | 引擎取消选择 | `apply.ts:37-39` |

未知 tool name 抛出 `stage:"translate"` 错误（`apply.ts:40-44`），被 `decide.ts` catch 后降级。
