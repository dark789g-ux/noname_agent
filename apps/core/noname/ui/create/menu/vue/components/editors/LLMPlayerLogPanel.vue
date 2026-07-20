<template>
	<div class="llm-player-log-panel">
		<!-- 详情视图 -->
		<div v-if="selectedDetail" class="detail-view">
			<div class="toolbar">
				<button class="btn" @click="selectedDetail = null">&#8249; 返回</button>
			</div>

			<!-- 1. 基本信息 -->
			<div class="detail-card">
				<div class="detail-card-title">基本信息</div>
				<div class="detail-card-body">
					<div class="field"><span class="label">日志ID:</span> {{ selectedDetail.id }}</div>
					<div class="field">
						<span class="label">时间:</span> {{ formatFullTime(selectedDetail.timestamp) }}
					</div>
					<div class="field">
						<span class="label">决策点:</span> {{ selectedDetail.decisionPoint }}
					</div>
					<div class="field">
						<span class="label">玩家:</span>
						{{ selectedDetail.playerName }} [座位{{ selectedDetail.playerSeatNum }}]
					</div>
					<div class="field">
						<span class="label">耗时:</span> {{ selectedDetail.durationMs }}ms
					</div>
					<div class="field">
						<span class="label">状态:</span>
						<span :class="statusClass(selectedDetail.status)">
							{{ statusIcon(selectedDetail.status) }} {{ statusText(selectedDetail.status) }}
						</span>
					</div>
				</div>
			</div>

			<!-- 2. 调用元信息 -->
			<div class="detail-card">
				<div class="detail-card-title">调用元信息</div>
				<div class="detail-card-body">
					<div class="field">
						<span class="label">enabled:</span> {{ selectedDetail.meta.enabled }}
					</div>
					<div class="field">
						<span class="label">configured:</span> {{ selectedDetail.meta.configured }}
					</div>
					<div class="field">
						<span class="label">model:</span>
						{{ selectedDetail.meta.model || "(未设置)" }}
					</div>
				</div>
			</div>

			<!-- 3. 请求 Prompt（可折叠） -->
			<div v-if="selectedDetail.request" class="detail-card">
				<div class="detail-card-title">请求 Prompt</div>
				<div class="detail-card-body">
					<details open>
						<summary>messages</summary>
						<div
							v-for="(msg, i) in selectedDetail.request.messages"
							:key="i"
							class="msg-card"
							:class="'msg-' + msg.role"
						>
							<div class="msg-role">{{ msg.role }}</div>
							<pre class="code-block">{{ formatJson(msg.content || msg) }}</pre>
						</div>
					</details>
					<details v-if="selectedDetail.request.tools?.length">
						<summary>tools ({{ selectedDetail.request.tools.length }})</summary>
						<div
							v-for="(tool, i) in selectedDetail.request.tools"
							:key="i"
							class="msg-card"
						>
							<div class="msg-role">tool: {{ tool.function?.name }}</div>
						</div>
					</details>
				</div>
			</div>

			<!-- 4. 响应 -->
			<div
				v-if="selectedDetail.status === 'success' && selectedDetail.response"
				class="detail-card"
			>
				<div class="detail-card-title">响应结果</div>
				<div class="detail-card-body">
					<div v-if="selectedDetail.response.toolCall" class="field">
						<span class="label">tool_call:</span>
						{{ selectedDetail.response.toolCall.name }}
					</div>
					<pre
						v-if="selectedDetail.response.toolCall"
						class="code-block"
					>{{ formatJson(selectedDetail.response.toolCall.arguments) }}</pre>
					<div
						v-if="selectedDetail.response.translatedResult != null"
						class="field"
						style="margin-top: 8px"
					>
						<span class="label">translatedResult:</span>
					</div>
					<pre
						v-if="selectedDetail.response.translatedResult != null"
						class="code-block"
					>{{ formatJson(selectedDetail.response.translatedResult) }}</pre>
				</div>
			</div>

			<!-- 5. 错误 / 回退 -->
			<div v-if="selectedDetail.turns?.length" class="detail-card">
				<div class="detail-card-title">多轮决策（{{ selectedDetail.turns.length }}）</div>
				<div class="detail-card-body">
					<details v-for="turn in selectedDetail.turns" :key="turn.index">
						<summary>第 {{ turn.index + 1 }} 轮 {{ turn.stage || "初始动作" }}</summary>
						<pre class="code-block">{{ formatJson(turn) }}</pre>
					</details>
				</div>
			</div>

			<!-- 5. 错误 / 回退 -->
			<div v-if="selectedDetail.error" class="detail-card card-error">
				<div class="detail-card-title">错误详情</div>
				<div class="detail-card-body">
					<div class="field">
						<span class="label">stage:</span> {{ selectedDetail.error.stage }}
					</div>
					<div class="field">
						<span class="label">message:</span> {{ selectedDetail.error.message }}
					</div>
					<div
						v-if="selectedDetail.error.httpStatus != null"
						class="field"
					>
						<span class="label">httpStatus:</span>
						{{ selectedDetail.error.httpStatus }}
					</div>
				</div>
			</div>

			<div v-if="selectedDetail.fallbackReason" class="detail-card card-fallback">
				<div class="detail-card-title">回退说明</div>
				<div class="detail-card-body">
					{{ selectedDetail.fallbackReason }}
				</div>
			</div>
		</div>

		<!-- 主视图 -->
		<template v-else>
			<!-- 进行中区 -->
			<div v-if="currentCall" class="active-call">
				<div class="active-header">
					<span class="active-indicator"></span>
					【进行中】{{ currentCall.decisionPoint }}
				</div>
				<div class="stream-area">
					<pre class="stream-text">{{ streamText || "等待 LLM 响应..." }}</pre>
				</div>
				<div class="active-meta">
					已生成 {{ streamText.length }} 字 / 用时 {{ elapsedMs }}ms
				</div>
			</div>

			<!-- 历史列表 -->
			<div class="history-section">
				<div class="section-title">历史（共 {{ history.length }} 次）</div>
				<div v-if="history.length === 0" class="empty">暂无历史日志</div>
				<div v-else class="history-list">
					<div
						v-for="entry in history"
						:key="entry.id"
						class="history-item"
						@click="selectedDetail = entry"
					>
						<span class="time">{{ formatTime(entry.timestamp) }}</span>
						<span class="decision">{{ entry.decisionPoint }}</span>
						<span
							class="status"
							:class="statusClass(entry.status)"
						>
							{{ statusIcon(entry.status) }}
						</span>
						<span class="duration">{{ entry.durationMs }}ms</span>
					</div>
				</div>
			</div>

			<!-- 工具栏 -->
			<div class="toolbar">
				<button class="btn" :disabled="isClearing" @click="refresh">刷新</button>
				<button class="btn" :disabled="isClearing" @click="clearLogs">
					{{ isClearing ? "清空中…" : "清空" }}
				</button>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { llmLogger, type ActiveLogSnapshot, type LogEntry } from "@/llm/logger.js";
import { lib } from "noname";

const props = defineProps<{
	playerSeatNum: number;
	gameId: string;
	playerName: string;
}>();

const currentCall = ref<LogEntry | null>(null);
const streamText = ref("");
const streamStartedAt = ref<number | null>(null);
const history = ref<LogEntry[]>([]);
const selectedDetail = ref<LogEntry | null>(null);
const elapsedMs = ref(0);
const isClearing = ref(false);

let elapsedTimer: number | null = null;
let historyQueryGeneration = 0;

function matchesPlayer(entry: LogEntry): boolean {
	if ((entry.gameId || "game_unknown") !== props.gameId) return false;
	if (entry.playerSeatNum !== undefined) return entry.playerSeatNum === props.playerSeatNum;
	return entry.playerName === props.playerName;
}

function mergeHistory(entries: LogEntry[]): void {
	const merged = new Map<string, LogEntry>();
	for (const entry of history.value) merged.set(entry.id, entry);
	for (const entry of entries) merged.set(entry.id, entry);
	history.value = Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp);
}

function stopElapsedTimer(): void {
	if (elapsedTimer === null) return;
	window.clearInterval(elapsedTimer);
	elapsedTimer = null;
}

function startElapsedTimer(startedAt: number): void {
	stopElapsedTimer();
	streamStartedAt.value = startedAt;
	elapsedMs.value = Math.max(0, Date.now() - startedAt);
	elapsedTimer = window.setInterval(() => {
		if (streamStartedAt.value !== null) {
			elapsedMs.value = Math.max(0, Date.now() - streamStartedAt.value);
		}
	}, 100);
}

function showActive(snapshot: ActiveLogSnapshot): void {
	currentCall.value = snapshot.entry;
	streamText.value = snapshot.partialArgs;
	startElapsedTimer(snapshot.startedAt);
}

function clearActive(): void {
	stopElapsedTimer();
	currentCall.value = null;
	streamText.value = "";
	streamStartedAt.value = null;
	elapsedMs.value = 0;
}

function restoreLatestActive(): void {
	const active = llmLogger.getActiveLogByGameAndPlayer(
		props.gameId,
		props.playerName,
		props.playerSeatNum,
	);
	if (active) {
		showActive(active);
	} else {
		clearActive();
	}
}

// 事件处理器引用，用于 unsubscribe
const handlers = {
	start(entry: LogEntry) {
		if (!matchesPlayer(entry)) return;
		showActive({ entry, partialArgs: "", startedAt: entry.timestamp });
	},
	chunk(payload: { logId: string; partialArgs: string }) {
		if (!currentCall.value || payload.logId !== currentCall.value.id) return;
		streamText.value = payload.partialArgs;
	},
	end(entry: LogEntry) {
		if (!matchesPlayer(entry)) return;
		mergeHistory([entry]);
		if (!currentCall.value || entry.id === currentCall.value.id) {
			restoreLatestActive();
		}
	},
};

onMounted(async () => {
	// 先订阅再读快照与历史，避免查询 IndexedDB 期间漏掉实时事件。
	// lib.announce.subscribe(name, method) 返回 method 本身（不是 unsubscribe 函数）
	// 取消订阅需要用 lib.announce.unsubscribe(name, method)
	lib.announce.subscribe("llm_log_start", handlers.start);
	lib.announce.subscribe("llm_log_chunk", handlers.chunk);
	lib.announce.subscribe("llm_log_end", handlers.end);
	restoreLatestActive();
	await refresh();
});

onUnmounted(() => {
	lib.announce.unsubscribe("llm_log_start", handlers.start);
	lib.announce.unsubscribe("llm_log_chunk", handlers.chunk);
	lib.announce.unsubscribe("llm_log_end", handlers.end);
	stopElapsedTimer();
});

// ---------------------------------------------------------------------------
// 方法
// ---------------------------------------------------------------------------

async function refresh() {
	if (isClearing.value) return;
	const generation = ++historyQueryGeneration;
	const logs = await llmLogger.getLogsByGameAndPlayer(
		props.gameId,
		props.playerName,
		props.playerSeatNum,
	);
	if (generation !== historyQueryGeneration) return;
	mergeHistory(logs);
}

async function clearLogs() {
	if (isClearing.value) return;
	if (
		!confirm(
			`确定清空所有 AI 玩家的全部已完成 LLM 日志吗？\n进行中的调用不会中断，结束后会重新出现在历史中。`,
		)
	) {
		return;
	}
	historyQueryGeneration++;
	isClearing.value = true;
	const clearedIds = new Set(history.value.map(entry => entry.id));
	try {
		await llmLogger.clearLogs();
		history.value = history.value.filter(entry => !clearedIds.has(entry.id));
		selectedDetail.value = null;
	} finally {
		isClearing.value = false;
	}
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

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

function formatJson(obj: any): string {
	try {
		return JSON.stringify(obj, null, 2);
	} catch {
		return String(obj);
	}
}

function statusClass(status: string): string {
	switch (status) {
		case "success":
			return "status-success";
		case "fallback":
			return "status-fallback";
		case "error":
			return "status-error";
		case "timeout":
			return "status-timeout";
		default:
			return "";
	}
}

function statusIcon(status: string): string {
	switch (status) {
		case "success":
			return "\u2713";
		case "fallback":
			return "\u21A9";
		case "error":
			return "\u2717";
		case "timeout":
			return "\u23F1";
		default:
			return "?";
	}
}

function statusText(status: string): string {
	switch (status) {
		case "success":
			return "成功";
		case "fallback":
			return "回退";
		case "error":
			return "错误";
		case "timeout":
			return "超时";
		default:
			return status;
	}
}
</script>

<style scoped>
.llm-player-log-panel, .llm-player-log-panel div { position: static !important; }
.llm-player-log-panel { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; overflow: hidden; box-sizing: border-box; color: #ddd; font-size: 12px; }
.active-call, .stream-area, .active-meta, .history-section, .section-title, .empty, .detail-view, .detail-card, .detail-card-title, .detail-card-body, .field, .msg-card, .msg-role { display: block; box-sizing: border-box; }
.toolbar { display: flex; flex: 0 0 auto; align-items: center; padding: 6px 8px; border-bottom: 1px solid #444; gap: 6px; }
.llm-player-log-panel > .toolbar { border-top: 1px solid #444; border-bottom: 0; }
.btn { background: #333; color: #ddd; border: 1px solid #555; border-radius: 3px; padding: 3px 10px; cursor: pointer; font-size: 12px; }
.btn:hover { background: #444; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:disabled:hover { background: #333; }
.active-call { flex: 0 0 auto; margin: 8px; border: 1px solid #4a9eff; border-radius: 4px; background: rgba(74, 158, 255, 0.08); overflow: hidden; }
.active-header { display: flex; align-items: center; gap: 6px; padding: 6px 8px; font-weight: bold; color: #4a9eff; }
.active-indicator { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4a9eff; animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.stream-area { padding: 0 8px; }
.stream-text { font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; color: #ccc; margin: 0; max-height: 150px; overflow: auto; background: transparent; border: none; }
.active-meta { padding: 4px 8px 6px; color: #888; font-size: 11px; }
.history-section { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 8px; }
.section-title { font-weight: bold; font-size: 13px; margin-bottom: 6px; color: #aaa; }
.empty { text-align: center; padding: 40px 0; color: #666; }
.history-list { display: flex; flex-direction: column; gap: 2px; }
.history-item { display: flex; align-items: center; padding: 5px 8px; border-radius: 3px; cursor: pointer; gap: 8px; }
.history-item:hover { background: rgba(255, 255, 255, 0.06); }
.history-item .time { font-family: monospace; font-size: 11px; color: #999; white-space: nowrap; }
.history-item .decision { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.history-item .duration { font-family: monospace; font-size: 11px; color: #888; }
.status-success { color: #4caf50; }
.status-fallback { color: #ff9800; }
.status-error { color: #f44336; }
.status-timeout { color: #ff9800; }
.detail-view { flex: 1 1 auto; min-height: 0; padding: 0; overflow: auto; }
.detail-card { margin: 8px; border: 1px solid #444; border-radius: 4px; overflow: hidden; }
.detail-card-title { background: #333; padding: 5px 8px; font-weight: bold; color: #ccc; border-bottom: 1px solid #444; }
.detail-card-body { padding: 6px 8px; }
.card-error .detail-card-title { color: #f44336; }
.card-fallback .detail-card-title { color: #ff9800; }
.field { margin: 3px 0; word-break: break-all; }
.label { color: #999; margin-right: 4px; }
.code-block { background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 3px; padding: 6px 8px; margin: 4px 0; font-size: 11px; font-family: monospace; white-space: pre-wrap; word-break: break-all; overflow: auto; max-height: 200px; color: #ccc; }
.msg-card { margin: 4px 0; border: 1px solid #3a3a3a; border-radius: 3px; overflow: hidden; }
.msg-role { padding: 3px 6px; font-size: 11px; font-weight: bold; color: #aaa; background: #2a2a2a; border-bottom: 1px solid #3a3a3a; }
.msg-system .msg-role { color: #64b5f6; }
.msg-user .msg-role { color: #81c784; }
.msg-assistant .msg-role { color: #ffb74d; }
.msg-card .code-block { border: none; margin: 0; border-radius: 0; }
details { margin: 4px 0; }
details summary { cursor: pointer; color: #aaa; font-size: 12px; padding: 2px 0; }
details summary:hover { color: #ddd; }
details[open] summary { margin-bottom: 4px; }
</style>
