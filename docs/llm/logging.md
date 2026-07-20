# 日志系统：决策记录与 UI 查看

日志系统记录每次 LLM 决策的完整请求/响应/错误，用于调试与监控。`LLMLogger` 采用缓冲写入策略（缓冲区满 50 条自动 flush），数据存储在 IndexedDB 中，最大保留 500 条。可从菜单「其它」→「LLM 日志」查看全局日志，也可点击 AI 武将牌旁的「AI」按钮查看该玩家在本局的日志。

## LogEntry 接口

| 字段 | 类型 | 说明 | file:line |
|------|------|------|-----------|
| `id` | `string` | 格式 `log_{timestamp}_{random6}` | `logger.ts:7` |
| `gameId` | `string` | 本局唯一标识；缺失时按 `game_unknown` 兼容 | `logger.ts:8` |
| `timestamp` | `number` | 创建时间戳 | `logger.ts:9` |
| `decisionPoint` | `string` | 决策类型（chooseToUse 等） | `logger.ts:10` |
| `playerName` | `string` | 玩家显示名 | `logger.ts:11` |
| `playerSeatNum` | `number?` | 玩家座位号；用于区分同名武将 | `logger.ts:12` |
| `durationMs` | `number` | 决策耗时（毫秒） | `logger.ts:13` |
| `status` | `LogStatus` | `"success"` / `"fallback"` / `"error"` / `"timeout"` | `logger.ts:14` |
| `fallbackReason` | `string?` | 降级原因（disabled / no_config / timeout / 错误信息） | `logger.ts:15` |
| `meta` | `{enabled, configured, model?}` | 配置快照 | `logger.ts:16-20` |
| `request` | `{messages, tools}?` | 请求数据 | `logger.ts:21-24` |
| `response` | `{toolCall?, translatedResult?}?` | 响应数据 | `logger.ts:25-28` |
| `error` | `{stage, message, httpStatus?}?` | 错误详情 | `logger.ts:29-33` |

`ActiveLogSnapshot` 表示尚未结束的调用，包含 `entry`、当前累计的 `partialArgs` 和精确的 `startedAt`。玩家面板中途打开时通过快照恢复最新一条活动调用及已流式生成的内容。

## LLMLogger 方法表

| 方法 | 用途 | file:line |
|------|------|-----------|
| `start(decisionPoint, playerName, meta, seatNum?)` | 创建活动日志条目，返回 logId | `logger.ts:57-83` |
| `getActiveLogByGameAndPlayer(gameId, playerName, seatNum?)` | 获取玩家最新的活动快照 | `logger.ts:95-102` |
| `logRequest(id, messages, tools)` | 记录请求数据 | `logger.ts:104-107` |
| `logResponse(id, toolCall, translatedResult)` | 记录响应与翻译结果 | `logger.ts:109-112` |
| `logError(id, stage, message, httpStatus)` | 记录错误详情 | `logger.ts:114-117` |
| `end(id, status)` | 结束日志，计算耗时并加入写入缓冲区 | `logger.ts:119-142` |
| `endFallback(id, reason)` | 记录降级原因，调用 `end(id, "fallback")` | `logger.ts:144-148` |
| `logStreamChunk(logId, partialArgs)` | 更新活动快照并发布流式事件 | `logger.ts:156-166` |
| `flush()` | 将缓冲区写入 IndexedDB | `logger.ts:168-184` |
| `getLogs()` | flush 后合并 IndexedDB 与剩余 buffer，按 ID 去重 | `logger.ts:186-200` |
| `getLogsByGameAndPlayer(gameId, playerName, seatNum?)` | 按对局和玩家筛选完成日志 | `logger.ts:244-247` |
| `clearLogs()` | 清空已完成日志；不影响活动调用 | `logger.ts:203-206` |

## IndexedDB 存储细节

```text
STORAGE_KEY = "llm_logs"                  logger.ts:50
BUFFER_LIMIT = 50                          logger.ts:51
最大保留 = 500 条（merged.slice(-500)）    logger.ts:175
接口: game.getDB("data", key) / game.putDB("data", key, val) / game.deleteDB("data", key)
flush 失败回滚: buffer.unshift(...toFlush)  logger.ts:178
```

缓冲区满 50 条时自动触发 flush。`getLogs()` 调用时也会先 flush；若写库或读库失败，则合并仍留在内存中的 buffer，避免已完成响应在 UI 中消失。

玩家匹配先要求 `gameId` 一致；日志带有 `playerSeatNum` 时严格按座位匹配，只有旧日志缺少座位号时才按 `playerName` 回退，以兼容遗留数据且避免同名武将串日志。

## UI 入口链路

```text
otherMenuData.ts:95-99   注册左栏项 { name: "LLM 日志", key: "llm_log" }
  │
  ▼
OtherPane.vue:25         <LLMLogViewer v-else-if="ctx.item.key === 'llm_log'" />
  │
  ▼
LLMLogViewer.vue:147      import { llmLogger, type LogEntry } from "@/llm/logger.js"
                         └─ loadLogs() → llmLogger.getLogs()    :154
                         └─ clearLogs() → llmLogger.clearLogs() :166

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

“清空”会清除所有 AI 玩家已完成的日志，但不会清理 `activeLogs`、取消请求或隐藏进行中区域；活动调用结束后会重新进入历史。

## 多轮日志

多轮决策可在 `LogEntry.turns`（可选字段）中记录每轮的阶段、候选短引用、tool call、校验结论和降级原因；旧日志没有该字段时按单轮记录展示。敏感牌面和完整内部对象不写入轮次日志，仅保留面向模型的短引用和标签。
