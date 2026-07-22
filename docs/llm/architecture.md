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

## 无 UI 选择会话（多轮协议）

选择规则由 `library/selection/` 的 `SelectionContext`、`SelectionSession`、`SelectionStep` 与 `SelectionValidator` 共同执行；它们不读取 `ui.selected` 或 `_status.event`。LLM 的牌、目标和按钮引用只在会话内有效，每一轮都会按实时事件重新验证。

```text
tool_call(use_skill/use_card)
  -> DecisionSession 归一化短引用并校验
  -> complete: materialize Result
  -> pending: select_{button|card|target|control|number}(step_id, *_refs)
  -> invalid/unsupported/timeout: { handled:false } -> 原生 AI
```

`content.ts` 通过同一个 `tryLLMDecide(event)` 接入 `chooseToUse`、`chooseToRespond`、`chooseToDiscard`、`chooseBool`、`chooseCard`、`chooseTarget`、`chooseButton`、`chooseToGive`、`chooseCardTarget`、`chooseButtonTarget`、`chooseControl` 与 `chooseNumbers` 的非本地、非联机 AI 分支。`choose*OL` 及涉及私有信息的流程不接入。

## 日志持久化与异常恢复

日志不在 LLM 决策路径上等待 IndexedDB。`logger.ts` 在内存中立即更新日志与 UI 事件，再将检查点和完成记录依序交给串行异步队列，因此存储失败不会改变 `{ handled }` 的结果。

```text
start() / 每轮完成
  -> 内存活动日志 + 异步写入 llm_log_active
end()
  -> 立即发布 llm_log_end
  -> 同一 IndexedDB 事务写 llm_logs 并删除 llm_log_active

下次启动 / 定时扫描
  -> owner 无 BroadcastChannel 响应
  -> 租约过期且 deadline + 60 秒已过
  -> 原子转存为 interrupted
```

日志存储在独立的 `${mainDbName}_llm_logs` IndexedDB 中，以单条记录保存完成日志，并为时间、对局、玩家和状态建立索引；活动日志与页面实例租约分别存于 `llm_log_active`、`llm_log_instances`。日志初始化不升级主配置库，因此不会被其他标签页持有的旧版主库连接阻塞。

旧版主库 `data/llm_logs` 数组和短暂主库 v5 日志 Store 通过跨库两阶段流程迁移：先读取源快照，将完成日志、活动检查点和实例租约幂等复制到独立库；目标提交后，在主库清理事务中重新读取源数据并做快照 CAS。只有源未变化时才删除旧数组键、清空主库 v5 日志 Store 的源记录并写迁移标记；Store 结构保留，以免触发主库 `versionchange`。CAS 失败会回滚清理并在稍后重试。

迁移标记不会屏蔽标记之后的新源记录：仍运行的旧页面若重新向主库 Store 写入，下一次扫描会执行增量迁移和 CAS 清理。独立库最多保留最近 500 条完成记录，持久化初始化、迁移或写入失败都不会阻塞游戏决策。

标签页每 30 秒更新一次、有效期 90 秒的租约，同时通过带配置前缀的 `BroadcastChannel` 响应存活探测，防止仍运行的其他标签页被误判为中断。无法确认 owner 存活的过期检查点会显示为“中断”，表示页面关闭、崩溃或 owner 失活，并不等同于回退本地 AI。日志仅保存在当前浏览器，不会自动上传或跨设备同步；流式 token 和不完整参数只保存在内存。
