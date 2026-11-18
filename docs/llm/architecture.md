# 架构：调度、触发与应用

本份覆盖 LLM 模块的三层架构：`decide.ts` 是调度核心，串联候选收集→上下文构造→API 调用→结果翻译；上游 `content/` 在 17 种 AI 选择事件触发 `tryLLMDecide`；下游 `apply.ts` 将 LLM 返回的 tool_call 翻译为引擎可消费的 Result 对象。

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

## 上游：事件组合入口与选择模块

`library/element/content.ts` 保留原注册路径与顺序，实现位于 `content/`。`selectionResults.ts` 的 `applyLLMDecision` 只在有完整结果时替换当前选择；失败保留原生 AI 分支。

| 模块 | 直接接入事件 |
| --- | --- |
| `chooseToUse.ts`、`chooseToRespond.ts` | 使用／响应 |
| `chooseToGive.ts` | 给牌与弃牌 |
| `discoverCard.ts` | 按钮 |
| `chooseCard.ts` | 选牌、目标、牌与目标、按钮与目标 |
| `chooseControl.ts` | 选项、是否发动 |
| `emptyEvent.ts` | 数值 |
| `choosePlayerCard.ts`、`gainPlayerCard.ts` | 选择、弃置、获得他人区域牌 |
| `chooseToMove.ts`、`chooseToMove_new.ts` | 已审核的移动、分堆与排序 |

`chooseUseTarget`、`chooseDrawRecover`、`chooseToGuanxing` 及集合选择继续通过实际子事件接入。真人和远端控制分支不额外请求模型。范围与测试见 [skill-support.md](skill-support.md)。

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

## 无 UI 选择与通用桥接（多轮协议）

选择规则优先使用显式 `SelectionSpec` 无 UI 会话（`library/selection/`）；当 `selectionSpec === undefined` 时由 `generic-skill-plan.ts` 推导步骤，并由 `legacy-bridge.ts` 的 `withVirtualSelection` 在单个同步求值窗口内临时桥接 `ui.selected`、`_status.event` 与 `event._backup`（`finally` 恢复，不泄漏全局状态）。LLM 的牌、目标和按钮引用只在会话内有效，每一轮都会按实时事件重新验证；可恢复的选择验证错误可通过 `checkpoint()` / `rollback()` 回滚会话状态，并在剩余 `maxTurns` 与 `deadline` 预算内借助 `appendRejectedHistory` 让模型重试一次修正参数。

```text
tool_call(use_skill/use_card)
  -> DecisionSession 归一化短引用并校验（checkpoint + 预算内 rollback 重试可恢复错误）
  -> complete: materialize Result
  -> pending: select_{button|card|target|control|number}(step_id, *_refs)
  -> TOCTOU/unsupported/budget exhausted/explicit-spec error: { handled:false } -> 原生 AI
```

`content.ts` 通过同一个 `tryLLMDecide(event)` 接入 `chooseToUse`、`chooseToRespond`、`chooseToDiscard`、`chooseBool`、`chooseCard`、`chooseTarget`、`chooseButton`、`chooseToGive`、`chooseCardTarget`、`chooseButtonTarget`、`chooseControl` 与 `chooseNumbers` 的非本地、非联机 AI 分支。集合选择通过其标准子事件间接接入；私有信息按当前决策角色与实际查看权限隔离。

## 日志持久化与异常恢复

日志不在 LLM 决策路径上等待 IndexedDB。`logger.ts` 在内存中立即更新日志与 UI 事件，再将检查点和完成记录依序交给串行异步队列，因此存储失败不会改变 `{ handled }` 的结果。

```text
start() / attempt 开始 / 首个 TTFT / 每轮完成
  -> 内存活动日志 + 异步写入 llm_log_active
end()
  -> 立即发布 llm_log_end
  -> 同一 IndexedDB 事务写 llm_logs 并删除 llm_log_active

下次启动 / 定时扫描
  -> owner 无 BroadcastChannel 响应
  -> 租约过期且 deadline + 60 秒已过
  -> 原子转存为 interrupted
```

首轮优先 stream；若 stream 在非解析错误下失败，调度会在同一轮创建第二个 nonstream attempt。后续多轮使用各自的 nonstream attempt。每个 attempt 以单调时钟记录首 chunk、首有效 token 和完整响应耗时；只有首次 TTFT 会写额外活动检查点，其余 chunk 只发布实时 UI 事件。

日志存储在独立的 `${mainDbName}_llm_logs` IndexedDB 中，以单条记录保存完成日志，并为时间、对局、玩家和状态建立索引；活动日志与页面实例租约分别存于 `llm_log_active`、`llm_log_instances`。日志初始化不升级主配置库，因此不会被其他标签页持有的旧版主库连接阻塞。

旧版主库 `data/llm_logs` 数组和短暂主库 v5 日志 Store 通过跨库两阶段流程迁移：先读取源快照，将完成日志、活动检查点和实例租约幂等复制到独立库；目标提交后，在主库清理事务中重新读取源数据并做快照 CAS。只有源未变化时才删除旧数组键、清空主库 v5 日志 Store 的源记录并写迁移标记；Store 结构保留，以免触发主库 `versionchange`。CAS 失败会回滚清理并在稍后重试。

迁移标记不会屏蔽标记之后的新源记录：仍运行的旧页面若重新向主库 Store 写入，下一次扫描会执行增量迁移和 CAS 清理。独立库最多保留最近 500 条完成记录，持久化初始化、迁移或写入失败都不会阻塞游戏决策。

标签页每 30 秒更新一次、有效期 90 秒的租约，同时通过带配置前缀的 `BroadcastChannel` 响应存活探测，防止仍运行的其他标签页被误判为中断。无法确认 owner 存活的过期检查点会显示为“中断”，表示页面关闭、崩溃或 owner 失活，并不等同于回退本地 AI。日志仅保存在当前浏览器，不会自动上传或跨设备同步；流式 token 和不完整参数只保存在内存。

## 常驻会话 Harness、静态工具集与后端传输层

`decide.ts` 统一通过 `llm/harness/` 维护按 `gameId:seatNum` 索引的座位级常驻长会话（`SeatSession`），配合全局静态 14 工具集（`STATIC_DECISION_TOOLS`）最大化前缀缓存（Prefix Cache）命中率并减少每轮增量 Token 消耗：

```text
tryLLMDecide(event)
  ├─ collectDecisionPromptFacts(event) + getEventsSince(lastEventSeq)
  ├─ resolveAllowedToolNames(...) ──► 仅在 user 消息末尾附加「## 本步允许工具：...」
  ├─ Harness (SeatSession + PromptPlanner)
  │     ├─ 首轮 / 重建 / 后端变更 / 窗口截断 ──► full prompt（规则 + 开局档案 + 态势）
  │     └─ 同会话续接 ─────────────────────────► incremental prompt（lastEventSeq 之后新增事件 + 当前状态与候选）
  ├─ Transport 调度
  │     ├─ OpenAI API（OpenAITransport）: 固定传入 STATIC_DECISION_TOOLS（14 个静态工具），浏览器维护不可变 transcript（剔除历史 reasoning_content）
  │     ├─ agy / codex（RemoteSessionTransport）: 经 SSE 调用 @noname/fs `/_llm/session/turn`；仅 reset=true 时在系统指令内嵌入全量 14 工具手册，增量轮省略工具列表并固定 STATIC_CLI_DECISION_SCHEMA
  │     └─ 增量轮 session_lost / 进程崩溃 ──► 自动以 reset=true + fullTranscript 原地重建常驻会话
  ├─ 调度层越界门禁：校验 toolCall.name ∈ allowedToolNames，越界则走 stage:"translate" 同会话内重试
  └─ 新对局 onGameStart(prevGameId) ──► 清理上一局浏览器会话与远端 CLI 进程
```

`@noname/fs`（`packages/fs/src/llm/`）承载常驻进程托管：
- `rpc-stdio.ts`：通用 stdio NDJSON JSON-RPC 客户端（超时、Abort、进程崩溃与 `ENOENT` 错误归因）。
- `acp-adapter.ts`：常驻 `agy acp` 进程（空临时沙箱目录、自动拒绝 `session/request_permission` 等本地工具请求），流式转发 `agent_thought_chunk`、`agent_message_chunk` 与 `usage_update`。
- `codex-app-adapter.ts`：常驻 `codex app-server` 进程（`initialize` / `initialized`、`thread/start`、`turn/start` 携带 `outputSchema` 与 `effort`），流式转发 `item/reasoning/summaryTextDelta`、`item/agentMessage/delta` 与 `thread/tokenUsage/updated`。
- `session-host.ts` / `session-routes.ts`：按 `sessionKey` 串行排队、30 分钟空闲自动回收、提供 `POST /_llm/session/turn`、`DELETE /_llm/session/:key`、`POST /_llm/session/reset-game`（均受本机回环地址与 Origin 白名单校验）。
