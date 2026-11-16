<template>
	<div class="llm-detail-view">
		<div class="toolbar">
			<button class="btn" @click="emit('back')">&#8249; 返回</button>
		</div>

		<!-- 1. 基本信息 -->
		<div class="detail-card">
			<div class="detail-card-title">基本信息</div>
			<div class="detail-card-body">
				<div class="field"><span class="label">日志ID:</span> {{ entry.id }}</div>
				<div class="field"><span class="label">时间:</span> {{ formatFullTime(entry.timestamp) }}</div>
				<div class="field"><span class="label">决策点:</span> {{ entry.decisionPoint }}</div>
				<div class="field"><span class="label">玩家:</span> {{ entry.playerName }} [座位{{ entry.playerSeatNum }}]</div>
				<div class="field"><span class="label">耗时:</span> {{ entry.durationMs }}ms</div>
				<div class="field">
					<span class="label">状态:</span>
					<span :class="statusPresentation(entry.status).className">
						{{ statusPresentation(entry.status).icon }} {{ statusPresentation(entry.status).text }}
					</span>
				</div>
				<div v-if="entry.session" class="field">
					<span class="label">会话模式:</span>
					<span class="session-badge" :class="`mode-${entry.session.mode}`">
						{{ sessionModeLabel(entry.session) }}
					</span>
					<span v-if="entry.session.rebuilt" class="session-badge mode-rebuilt">
						↻ 重建{{ entry.session.rebuildReason ? `: ${entry.session.rebuildReason}` : "" }}
					</span>
					<span v-if="entry.session.degraded" class="session-badge mode-degraded">
						⚠ 降级{{ entry.session.degradeReason ? `: ${entry.session.degradeReason}` : "" }}
					</span>
				</div>
				<div v-if="entry.session?.contextUsed != null" class="field">
					<span class="label">上下文占用:</span>
					{{ formatCompactTokens(entry.session.contextUsed) }}
					<template v-if="entry.session.contextSize"> / {{ formatCompactTokens(entry.session.contextSize) }}</template>
				</div>
			</div>
		</div>

		<!-- 2. 调用元信息 -->
		<div class="detail-card">
			<div class="detail-card-title">调用元信息</div>
			<div class="detail-card-body">
				<div class="field"><span class="label">enabled:</span> {{ entry.meta.enabled }}</div>
				<div class="field"><span class="label">configured:</span> {{ entry.meta.configured }}</div>
				<div class="field"><span class="label">backend:</span> {{ entry.meta.providerLabel || entry.meta.backend || "openai" }}</div>
				<div class="field"><span class="label">model:</span> {{ entry.meta.model || "(未设置)" }}</div>
				<div v-if="entry.session?.sessionKey" class="field"><span class="label">sessionKey:</span> {{ entry.session.sessionKey }}</div>
			</div>
		</div>

		<!-- 3. 请求 Prompt（可折叠） -->
		<div v-if="entry.request" class="detail-card">
			<div class="detail-card-title">请求 Prompt</div>
			<div class="detail-card-body">
				<LLMLogContent
					v-for="(msg, i) in entry.request.messages"
					:key="`${entry.id}-message-${i}`"
					:value="isPromptMessage(msg) ? msg.content : msg"
					:mode="isPromptMessage(msg) ? 'auto' : 'json'"
					:default-expanded="msg.role !== 'system'"
					:label="msg.role"
				/>
				<div v-if="entry.request.tools?.length" class="content-group-label">tools ({{ entry.request.tools.length }})</div>
				<LLMLogContent
					v-for="(tool, i) in entry.request.tools"
					:key="`${entry.id}-tool-${i}`"
					:value="tool"
					mode="json"
					:default-expanded="false"
					:label="`tool: ${tool.function?.name || i + 1}`"
				/>
			</div>
		</div>

		<!-- 4. 响应 -->
		<div v-if="entry.status === 'success' && entry.response" class="detail-card">
			<div class="detail-card-title">响应结果</div>
			<div class="detail-card-body">
				<LLMLogContent v-if="entry.response.toolCall?.reasoningContent" :key="`${entry.id}-reasoning-content`" :value="entry.response.toolCall.reasoningContent" mode="auto" :default-expanded="true" label="reasoning_content" />
				<LLMLogContent v-if="entry.response.toolCall" :key="`${entry.id}-tool-call`" :value="stripToolCallReasoning(entry.response.toolCall)" mode="json" :default-expanded="true" label="tool_call" />
				<LLMLogContent v-if="entry.response.translatedResult != null" :key="`${entry.id}-translated-result`" :value="entry.response.translatedResult" mode="auto" :default-expanded="true" label="translatedResult" />
			</div>
		</div>

		<!-- 5. 请求尝试 -->
		<div v-if="entry.requestTimings?.length" class="detail-card">
			<div class="detail-card-title">请求尝试</div>
			<div class="detail-card-body timing-table-wrap">
				<table class="timing-table">
					<thead><tr><th>轮</th><th>尝试</th><th>传输</th><th>首 Chunk</th><th>首 Token</th><th>完整响应</th><th>结果</th></tr></thead>
					<tbody>
						<tr v-for="timing in entry.requestTimings" :key="`${timing.turnIndex}-${timing.attemptIndex}`">
							<td>{{ timing.turnIndex + 1 }}</td>
							<td>{{ timing.attemptIndex + 1 }}</td>
							<td>{{ timing.transport }}</td>
							<td>{{ formatMs(timing.firstChunkMs) }}</td>
							<td>{{ formatMs(timing.ttftMs) }}</td>
							<td>{{ formatMs(timing.responseMs) }}</td>
							<td>{{ timing.outcome }}{{ timing.errorStage ? ` (${timing.errorStage})` : "" }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>

		<!-- 6. 多轮决策 -->
		<div v-if="entry.turns?.length" class="detail-card">
			<div class="detail-card-title">多轮决策（{{ entry.turns.length }}）</div>
			<div class="detail-card-body">
				<div v-for="turn in entry.turns" :key="turn.index" class="turn-detail-block">
					<div class="turn-detail-header">
						<span>第 {{ turn.index + 1 }} 轮 {{ turn.stage || "初始动作" }}</span>
						<span v-if="turn.thinkingMs" class="turn-meta-chip">思考 {{ formatDurationSec(turn.thinkingMs) }}</span>
						<span v-if="turnUsageLabel(turn)" class="turn-meta-chip">{{ turnUsageLabel(turn) }}</span>
					</div>
					<LLMLogContent
						v-if="turn.thinking || turn.toolCall?.reasoningContent"
						:key="`${entry.id}-turn-${turn.index}-thinking`"
						:value="turn.thinking || turn.toolCall?.reasoningContent"
						mode="auto"
						:default-expanded="false"
						:label="`思考过程${turn.thinkingMs ? ` (${formatDurationSec(turn.thinkingMs)})` : ''}`"
					/>
					<details>
						<summary>原始 Turn JSON</summary>
						<pre class="code-block">{{ formatJson(turn) }}</pre>
					</details>
				</div>
			</div>
		</div>

		<!-- 7. 错误 / 回退 -->
		<div v-if="entry.error" class="detail-card card-error">
			<div class="detail-card-title">错误详情</div>
			<div class="detail-card-body">
				<div class="field"><span class="label">stage:</span> {{ entry.error.stage }}</div>
				<div class="field"><span class="label">message:</span> {{ entry.error.message }}</div>
				<div v-if="entry.error.httpStatus != null" class="field"><span class="label">httpStatus:</span> {{ entry.error.httpStatus }}</div>
			</div>
		</div>

		<div v-if="statusDetail(entry.status, entry.fallbackReason)" class="detail-card" :class="entry.status === 'interrupted' ? 'card-interrupted' : 'card-fallback'">
			<div class="detail-card-title">{{ entry.status === "interrupted" ? "中断说明" : "回退说明" }}</div>
			<div class="detail-card-body">
				{{ statusDetail(entry.status, entry.fallbackReason) }}
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { LogEntry, LogSessionMeta, LogTurn } from "@/llm/logger-types.js";
import { getLLMLogStatusDetail, getLLMLogStatusPresentation, stripToolCallReasoning } from "./llmLogStatus.js";
import LLMLogContent from "./LLMLogContent.vue";
import { formatCompactTokens, formatDurationSec, formatUsageSummary } from "./llm-timeline/types.js";

defineProps<{
	entry: LogEntry;
}>();

const emit = defineEmits<{
	(e: "back"): void;
}>();

function formatTime(ts: number): string {
	const d = new Date(ts);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	const ss = String(d.getSeconds()).padStart(2, "0");
	return `${hh}:${mm}:${ss}`;
}

function formatFullTime(ts: number): string {
	const d = new Date(ts);
	const y = d.getFullYear();
	const mo = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${mo}-${day} ${formatTime(ts)}`;
}

function formatJson(obj: unknown): string {
	try {
		return JSON.stringify(obj, null, 2);
	} catch {
		return String(obj);
	}
}

function formatMs(value: number | undefined): string {
	return value === undefined ? "--" : `${Math.round(value)}ms`;
}

function isPromptMessage(message: any): message is { role: "system" | "user"; content: unknown } {
	return message?.role === "system" || message?.role === "user";
}

function sessionModeLabel(session: LogSessionMeta): string {
	if (session.mode === "incremental") {
		const count = session.addedEventsCount;
		return count != null ? `增量 (+${count} 事件)` : "增量";
	}
	return "全量";
}

function turnUsageLabel(turn: LogTurn): string {
	return formatUsageSummary(turn.usage);
}

const statusPresentation = getLLMLogStatusPresentation;
const statusDetail = getLLMLogStatusDetail;
</script>

<style scoped>
.llm-detail-view, .llm-detail-view div { position: static !important; }
.llm-detail-view { flex: 1 1 auto; min-height: 0; padding: 0; overflow: auto; }
.detail-card, .detail-card-title, .detail-card-body, .field, .turn-detail-block { display: block; box-sizing: border-box; }
.toolbar { display: flex; flex: 0 0 auto; align-items: center; padding: 6px 8px; border-bottom: 1px solid #444; gap: 6px; }
.btn { background: #333; color: #ddd; border: 1px solid #555; border-radius: 3px; padding: 3px 10px; cursor: pointer; font-size: 12px; }
.btn:hover { background: #444; }
.detail-card { margin: 8px; border: 1px solid #444; border-radius: 4px; overflow: hidden; }
.detail-card-title { background: #333; padding: 5px 8px; font-weight: bold; color: #ccc; border-bottom: 1px solid #444; }
.detail-card-body { padding: 6px 8px; }
.card-error .detail-card-title { color: #f44336; }
.card-fallback .detail-card-title { color: #ff9800; }
.card-interrupted .detail-card-title { color: #ffb74d; }
.field { margin: 3px 0; word-break: break-all; }
.label { color: #999; margin-right: 4px; }
.session-badge { display: inline-block; padding: 1px 6px; margin-right: 4px; border-radius: 3px; font-size: 11px; border: 1px solid #555; background: #2d2d2d; color: #ddd; }
.mode-incremental { border-color: #3f7a4d; color: #8be09e; background: rgba(76, 175, 80, 0.12); }
.mode-rebuilt { border-color: #3b6f9c; color: #8cc4ff; background: rgba(74, 158, 255, 0.12); }
.mode-degraded { border-color: #9c6a24; color: #ffcc80; background: rgba(255, 152, 0, 0.14); }
.turn-detail-block { border-bottom: 1px dashed #3a3a3a; padding: 6px 0; }
.turn-detail-block:last-child { border-bottom: 0; padding-bottom: 0; }
.turn-detail-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; color: #bbb; font-size: 12px; margin-bottom: 4px; }
.turn-meta-chip { font-size: 11px; color: #8c96a4; background: #26292e; border-radius: 3px; padding: 1px 5px; }
.code-block { background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 3px; padding: 6px 8px; margin: 4px 0; font-size: 11px; font-family: monospace; white-space: pre-wrap; word-break: break-all; overflow-x: auto; color: #ccc; }
.content-group-label { margin-top: 8px; color: #aaa; font-size: 12px; }
.timing-table-wrap { overflow-x: auto; }
.timing-table { width: 100%; border-collapse: collapse; font-size: 11px; white-space: nowrap; }
.timing-table th, .timing-table td { padding: 3px 5px; border-bottom: 1px solid #444; text-align: left; }
details { margin: 4px 0; }
details summary { cursor: pointer; color: #aaa; font-size: 12px; padding: 2px 0; }
details summary:hover { color: #ddd; }
details[open] summary { margin-bottom: 4px; }
.llm-log-status-success { color: #4caf50; }
.llm-log-status-fallback, .llm-log-status-timeout { color: #ff9800; }
.llm-log-status-error { color: #f44336; }
.llm-log-status-interrupted { color: #ffb74d; }
</style>
