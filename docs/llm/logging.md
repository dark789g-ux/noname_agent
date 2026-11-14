# 日志系统：决策记录与 UI 查看

日志系统记录每次 LLM 决策的完整请求/响应/错误，用于调试与监控。完成日志会立即加入串行异步持久化队列，游戏决策不会等待 IndexedDB 事务；数据仅保存在当前浏览器，最大保留 500 条。可从菜单「其它」→「LLM 日志」查看全局日志，也可点击 AI 武将牌旁的「AI」按钮查看该玩家在本局的日志。

## LogEntry 接口

| 字段 | 类型 | 说明 | file:line |
|------|------|------|-----------|
| `id` | `string` | 格式 `log_{timestamp}_{random6}` | `logger-types.ts` |
| `gameId` | `string` | 本局唯一标识；缺失时按 `game_unknown` 兼容 | `logger-types.ts` |
| `timestamp` | `number` | 创建时间戳 | `logger-types.ts` |
| `decisionPoint` | `string` | 决策类型（chooseToUse 等） | `logger-types.ts` |
| `playerName` | `string` | 玩家显示名 | `logger-types.ts` |
| `playerSeatNum` | `number?` | 玩家座位号；用于区分同名武将 | `logger-types.ts` |
| `durationMs` | `number` | 决策耗时（毫秒） | `logger-types.ts` |
| `status` | `LogStatus` | `"success"` / `"fallback"` / `"error"` / `"timeout"` / `"interrupted"` | `logger-types.ts` |
| `fallbackReason` | `string?` | 降级原因（disabled / no_config / timeout / 错误信息） | `logger-types.ts` |
| `meta` | `{enabled, configured, model?}` | 配置快照 | `logger-types.ts` |
| `request` | `{messages, tools}?` | 请求数据 | `logger-types.ts` |
| `response` | `{toolCall?, translatedResult?}?` | 响应数据；新日志的 `toolCall.reason` 为模型选择原因 | `logger-types.ts` |
| `error` | `{stage, message, httpStatus?}?` | 错误详情 | `logger-types.ts` |
| `requestTimings` | `RequestTiming[]?` | provider 请求尝试的时序；缺失代表旧日志或未启用该遥测 | `logger-types.ts` |

`ActiveLogSnapshot` 表示尚未结束的调用，包含 `entry`、当前累计的 `partialArgs` 和精确的 `startedAt`。玩家面板中途打开时通过快照恢复最新一条活动调用及已流式生成的内容。

## LLMLogger 方法表

| 方法 | 用途 | file:line |
|------|------|-----------|
| `start(decisionPoint, playerName, meta, seatNum?)` | 创建活动日志条目，返回 logId | `logger.ts:57-83` |
| `getActiveLogByGameAndPlayer(gameId, playerName, seatNum?)` | 获取玩家最新的活动快照 | `logger.ts:95-102` |
| `logRequest(id, messages, tools)` | 记录请求数据 | `logger.ts:104-107` |
| `logResponse(id, toolCall, translatedResult)` | 记录响应与翻译结果 | `logger.ts:109-112` |
| `logError(id, stage, message, httpStatus)` | 记录错误详情 | `logger.ts:114-117` |
| `end(id, status)` | 结束日志，计算耗时并立即排入异步持久化队列 | `logger.ts` |
| `endFallback(id, reason)` | 记录降级原因，调用 `end(id, "fallback")` | `logger.ts:144-148` |
| `startRequestAttempt(id, turn, attempt, transport)` | 创建一次独立 provider 请求尝试并写活动检查点 | `logger.ts` |
| `markRequestFirstChunk` / `markRequestTTFT` | 标记首个 SSE chunk / 首个有效 token；TTFT 只触发一次活动检查点 | `logger.ts` |
| `finishRequestAttempt` | 标记请求成功或错误及完整响应耗时；最终随 `end()` 落库 | `logger.ts` |
| `logStreamChunk(logId, partialArgs)` | 更新活动快照并发布流式事件 | `logger.ts` |
| `flush()` | 等待当前持久化队列排空 | `logger.ts` |
| `getLogs()` | 等待队列屏障后查询 IndexedDB，并合并暂存的失败记录 | `logger.ts` |
| `getLogsByGameAndPlayer(gameId, playerName, seatNum?)` | 按对局和玩家筛选完成日志 | `logger.ts:244-247` |
| `clearLogs()` | 清空已完成日志；不影响活动调用 | `logger.ts:203-206` |

## IndexedDB 存储细节

本地浏览器现通过本地服务将以下逻辑表保存在项目的 `data/noname.sqlite` 中，首次使用时只读迁移原 IndexedDB，后续以 SQLite 为准。Electron、Cordova 等原生客户端沿用下述 IndexedDB 布局。完整说明见 [SQLite 存储](../sqlite-storage.md)。

```text
主配置库: mainDbName（不为日志升级版本）
独立日志库: `${mainDbName}_llm_logs`
  llm_logs            一条已完成决策一条记录，按时间、对局、玩家与状态建立索引
  llm_log_active      尚未完成的决策检查点
  llm_log_instances   页面实例租约
最大保留 = 最近 500 条已完成记录
```

日志使用独立数据库，打开或创建日志 Store 不会升级主配置库，也不会因其他标签页持有主库旧连接而阻塞游戏启动。独立库打开失败不会缓存失败结果，后续初始化或写入可以重试。

旧版主库 `data/llm_logs` 数组以及短暂存在过的主库 v5 日志 Store 采用跨库两阶段迁移：先只读快照，将完成日志按 ID、活动检查点按版本、租约按更新时间幂等复制到独立库并提交；随后在主库清理事务中重新读取源数据并与快照比较。只有快照 CAS 一致时，才删除旧数组键、清空主库 `llm_logs`、`llm_log_active`、`llm_log_instances` 中的源记录并写入迁移标记；源 Store 结构保留，避免触发主库 `versionchange`。快照变化或任一阶段失败都会回滚清理并保留源数据，稍后重新迁移。

迁移标记只表示某次快照已完成，不会让后续扫描盲目跳过源数据。若仍运行的旧页面在标记写入后又向主库 v5 Store 写入记录，新页面会检测到非空源 Store，执行增量幂等迁移并再次 CAS 清理。

新写入由串行 Promise 队列处理，普通失败按退避重试，配额不足时先清理最旧完成日志后重试。最终仍未写入的记录保留在内存 pending 集合，并在后续写入、查询或页面隐藏时再次尝试；持久化失败不会影响游戏决策。

`start()` 与每个请求 attempt 开始会异步写入活动检查点；每轮完整决策完成后更新检查点；首个 TTFT 只额外写入一次检查点；`end()` 在同一个事务内写入完成记录并删除检查点。其余流式 token、首 chunk 与不完整 arguments 仅保存在内存，不会造成逐 chunk 的 IndexedDB 写入。

## 首 Token 延迟与请求尝试

`requestTimings` 的每一项对应一次调用 provider 的 HTTP 请求：`turnIndex`/`attemptIndex` 从 0 开始，`transport` 为 `stream` 或 `nonstream`，`startedAtOffsetMs` 相对日志条目开始；`firstChunkMs`、`ttftMs`、`responseMs` 相对该 attempt 开始。`outcome` 为 `pending`、`success` 或 `error`；失败时可带 `errorStage`。

流式请求的首 chunk 指 SDK 解析出的第一个 SSE chunk，即使它只有 role、id/name 或空 delta。TTFT 只在首次出现非空 `delta.content`、`tool_calls[*].function.arguments` 或兼容的 `function_call.arguments` 时记录。因此 role-only、工具名、空分片都不会被误当作首 Token；非流式请求没有分片，首 chunk 与 TTFT 显示为 `--`。所有遥测回调均被隔离，回调本身抛错不能改变请求结果。

首轮流式失败并回退非流式时，会记录两个 attempt：失败的 `stream`（可保留其真实 TTFT）和后续 `nonstream`。全局列表只展示成功 attempt 的 TTFT，避免把失败流式调用冒充为最终成功请求；详情表会完整展示所有尝试。多轮决策每一轮都有独立的 attempt 序列，SDK 内部重试仍归入同一 attempt。

页面关闭或崩溃发生在完成前时，活动检查点可能保留 `pending` attempt；其没有 `responseMs` 和最终 outcome，这属于可恢复的中断现场而非成功请求。为保持兼容性，不升级 IndexedDB 版本或索引，旧日志缺少 `requestTimings` 时 UI 一律显示 `--`。

每个标签页维护 30 秒心跳、90 秒有效期的实例租约，并用带配置前缀的 `BroadcastChannel` 确认 owner 是否存活。启动时及每分钟扫描活动检查点；只有 owner 在 300ms 内不响应、租约已过期且决策 deadline 额外过期 60 秒后，才把记录原子地转为 `interrupted`。`BroadcastChannel` 不可用时退化为租约和 deadline 判定。中断日志保留已完成轮次，并显示“页面关闭、崩溃或页面实例失活”的说明；它不表示已回退本地 AI。

日志保存在本机：本地浏览器使用 SQLite，原生客户端使用 IndexedDB，不上传外部服务器、不跨设备同步。SQLite 模式的存储故障会显示错误并等待用户重试。进入持久化队列前会清洗非 JSON 对象和鉴权信息；流式内容不会写入数据库。

## 日志内容展示

“玩家 LLM 思考”弹窗和菜单「其它」→「LLM 日志」共用同一内容组件。请求中的 `system`、`user`，以及响应的 `translatedResult` 在值为字符串时按安全 Markdown 展示；对象、数组和 `tool_call` 始终以格式化 JSON 展示。请求 `assistant`、`tool` 消息维持 JSON 展示，`tools` 按工具拆分为独立 JSON 块。

字符串可切换“渲染 / 原文”。原文直接显示保存的字符：真实换行仍是换行，字面量 `\\n` 不会被转换。超过 200px 的内容可展开或收起；`system` 与每个 `tool` 默认收起，其余目标字段默认展开。

Markdown 禁用原始 HTML 与自动链接，只允许绝对 `http` / `https` 链接，并统一使用新窗口的 `noopener noreferrer nofollow` 属性。图片不会创建 `img` 或保留 URL，而会显示“图片已禁用：alt”占位。Markdown 输出在插入页面前还会经过 DOMPurify allowlist；不允许脚本、SVG、表单、样式和事件属性。

玩家匹配先要求 `gameId` 一致；日志带有 `playerSeatNum` 时严格按座位匹配，只有旧日志缺少座位号时才按 `playerName` 回退，以兼容遗留数据且避免同名武将串日志。

## UI 入口链路

```text
ui/create/menu/vue/data/otherMenuData.ts  注册左栏项 { name: "LLM 日志", key: "llm_log" }
  │
  ▼
ui/create/menu/vue/components/OtherPane.vue  <LLMLogViewer v-else-if="ctx.item.key === 'llm_log'" />
  │
  ▼
ui/create/menu/vue/components/editors/LLMLogViewer.vue
                         └─ loadSessions/openSession() → llmLogger.getGameSessions()/getLogsByGame()
                         └─ clearAll() → llmLogger.clearLogs()

AI 武将牌旁「AI」按钮
  │
  ▼
openLLMPlayerLog.ts       创建专属 Dialog，传入 gameId、playerName、playerSeatNum
  │
  ▼
LLMPlayerLogPanel.vue     先订阅 start/chunk/end
                         ├─ 读取活动快照，恢复正在生成的 partialArgs 与耗时
                         ├─ 异步查询已完成历史，按日志 ID 合并并按时间倒序
                         └─ end 即使没有对应 start 事件，也会合并到历史
```

玩家面板的事件订阅必须早于活动快照和 IndexedDB 查询，防止打开面板期间结束的调用丢失。刷新和实时结束事件都使用相同的按 ID 合并逻辑，因此查询结果不会覆盖刚收到的日志。

### 玩家日志 Dialog 交互契约

游戏画面全局最多存在一个玩家 LLM 日志 Dialog。同一玩家的「AI」按钮再次点击时关闭当前面板；点击另一玩家的按钮时，先关闭旧面板，再打开新玩家的面板。

关闭 Dialog 只卸载面板 UI，并从 `ui.dialogs` 清理对应引用，不会取消、超时或中断正在执行的 LLM 请求。之后重新打开该玩家面板时，组件会读取最新的 active snapshot，恢复当前生成内容与计时状态。

### 武将牌活动指示器

`llm/index.ts` 在 `initLLMGameHooks()` 中仅订阅一次 `llm_log_start` 与 `llm_log_end`。订阅回调把完整 `LogEntry` 交给 `player-button-state.ts` 的 `Map<logId, entry>`，并刷新 `game.players` 和 `game.dead` 的按钮；新对局开始时清空该 Map。

玩家优先按 `gameId + playerSeatNum` 匹配活动日志；旧日志缺失座位号时按同局 `playerName` 回退。多个日志可同时绑定同一武将，只有最后一个结束后才取消活动状态。`derive()` 使活动日志的按钮始终可见、可点击且亮蓝呼吸，即使 LLM 配置被关闭或玩家控制权变化；无障碍的 `prefers-reduced-motion` 环境会保留静态高亮而不播放动画。

“清空”会清除所有 AI 玩家已完成的日志，但不会清理 `activeLogs`、取消请求或隐藏进行中区域；活动调用结束后会重新进入历史。

## 多轮日志

多轮决策可在 `LogEntry.turns`（可选字段）中记录每轮的阶段、候选短引用、tool call、校验结论和降级原因；新日志会在每轮及最终响应的 `toolCall` 顶层保存 `reason`。旧日志的 `reason` 缺失时按兼容数据处理。敏感牌面和完整内部对象不写入轮次日志，仅保留面向模型的短引用和标签。
