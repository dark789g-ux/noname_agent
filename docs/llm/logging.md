# 日志系统：决策记录与 UI 查看

日志系统记录每次 LLM 决策的完整请求/响应/错误，用于调试与监控。`LLMLogger` 采用缓冲写入策略（缓冲区满 50 条自动 flush），数据存储在 IndexedDB 中，最大保留 500 条。UI 入口位于菜单「其它」→「LLM 日志」。

## LogEntry 接口

| 字段 | 类型 | 说明 | file:line |
|------|------|------|-----------|
| `id` | `string` | 格式 `log_{timestamp}_{random6}` | `logger.ts:7` |
| `timestamp` | `number` | 创建时间戳 | `logger.ts:8` |
| `decisionPoint` | `string` | 决策类型（chooseToUse 等） | `logger.ts:9` |
| `playerName` | `string` | 玩家显示名 | `logger.ts:10` |
| `durationMs` | `number` | 决策耗时（毫秒） | `logger.ts:11` |
| `status` | `LogStatus` | `"success"` / `"fallback"` / `"error"` / `"timeout"` | `logger.ts:12` |
| `fallbackReason` | `string?` | 降级原因（disabled / no_config / timeout / 错误信息） | `logger.ts:13` |
| `meta` | `{enabled, configured, model?}` | 配置快照 | `logger.ts:14-18` |
| `request` | `{messages, tools}?` | 请求数据 | `logger.ts:19-22` |
| `response` | `{toolCall?, translatedResult?}?` | 响应数据 | `logger.ts:23-26` |
| `error` | `{stage, message, httpStatus?}?` | 错误详情 | `logger.ts:27-31` |

## LLMLogger 方法表

| 方法 | 用途 | file:line |
|------|------|-----------|
| `start(decisionPoint, playerName, meta)` | 创建日志条目，返回 logId | `logger.ts:41-54` |
| `logRequest(id, messages, tools)` | 记录请求数据 | `logger.ts:60-63` |
| `logResponse(id, toolCall, translatedResult)` | 记录响应与翻译结果 | `logger.ts:65-68` |
| `logError(id, stage, message, httpStatus)` | 记录错误详情 | `logger.ts:70-73` |
| `end(id, status)` | 结束日志，计算耗时，触发 flush | `logger.ts:75-90` |
| `endFallback(id, reason)` | 记录降级原因，调用 `end(id, "fallback")` | `logger.ts:92-96` |
| `flush()` | 将缓冲区写入 IndexedDB | `logger.ts:98-114` |
| `getLogs()` | 获取所有日志（先 flush） | `logger.ts:116-119` |
| `clearLogs()` | 清空所有日志 | `logger.ts:121-124` |

## IndexedDB 存储细节

```text
STORAGE_KEY = "llm_logs"                  logger.ts:34
BUFFER_LIMIT = 50                          logger.ts:35
最大保留 = 500 条（merged.slice(-500)）    logger.ts:105
接口: game.getDB("data", key) / game.putDB("data", key, val) / game.deleteDB("data", key)
flush 失败回滚: buffer.unshift(...toFlush)  logger.ts:108
```

缓冲区满 50 条时自动触发 flush（`logger.ts:87-89`）。`getLogs()` 调用时也会先 flush（`logger.ts:117`）。

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
```
