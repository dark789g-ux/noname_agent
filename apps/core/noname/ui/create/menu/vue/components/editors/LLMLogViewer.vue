<template>
	<div class="llm-log-viewer">
		<!-- 一级：局列表 -->
		<template v-if="view.kind === 'sessionList'">
			<div class="llm-log-toolbar">
				<span class="llm-log-title">LLM 日志（按局）</span>
				<button class="llm-log-btn" @click="refresh">刷新</button>
				<button class="llm-log-btn" @click="clearAll">清空</button>
			</div>
			<div class="llm-log-table-wrap">
				<table v-if="sessions.length > 0" class="llm-log-table">
					<thead>
						<tr>
							<th>创建时间</th>
							<th>日志数</th>
							<th>成功/总数</th>
							<th>最近玩家</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="s in sessions"
							:key="s.gameId"
							class="llm-log-row"
							@click="openSession(s)"
						>
							<td class="llm-log-cell-time">{{ formatFullTime(s.createdAt) }}</td>
							<td>{{ s.logCount }}</td>
							<td>
								<span :class="s.successCount > 0 ? 'llm-log-status-success' : 'llm-log-status-skip'">
									{{ s.successCount }}/{{ s.logCount }}
								</span>
							</td>
							<td>{{ s.lastPlayerName }}</td>
						</tr>
					</tbody>
				</table>
				<div v-else class="llm-log-empty">暂无对局记录</div>
			</div>
		</template>

		<!-- 二级：单局日志列表 -->
		<template v-else-if="view.kind === 'logList'">
			<div class="llm-log-toolbar">
				<button class="llm-log-btn" @click="view = { kind: 'sessionList' }">&#8249; 返回局列表</button>
				<span class="llm-log-title">{{ formatFullTime(view.session.createdAt) }}</span>
				<button class="llm-log-btn" @click="refresh">刷新</button>
			</div>
			<div class="llm-log-table-wrap">
				<table v-if="currentLogs.length > 0" class="llm-log-table">
					<thead>
						<tr>
							<th>时间</th>
							<th>决策点</th>
							<th>玩家</th>
							<th>耗时</th>
							<th>状态</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="entry in currentLogs"
							:key="entry.id"
							class="llm-log-row"
							@click="view = { kind: 'logDetail', gameId: view.gameId, session: view.session, entry }"
						>
							<td class="llm-log-cell-time">{{ formatTime(entry.timestamp) }}</td>
							<td>{{ entry.decisionPoint }}</td>
							<td>{{ entry.playerName }}</td>
							<td>{{ entry.durationMs }}ms</td>
							<td>
								<span :class="['llm-log-status', statusPresentation(entry.status).className]">
									{{ statusPresentation(entry.status).icon }} {{ statusPresentation(entry.status).text }}
								</span>
								<div v-if="entry.status === 'fallback' && entry.fallbackReason" class="llm-log-sub">
									↳ {{ entry.fallbackReason }}
								</div>
								<div v-if="entry.status === 'interrupted'" class="llm-log-sub">
									↳ {{ statusDetail(entry.status, entry.fallbackReason) }}
								</div>
								<div v-if="(entry.status === 'timeout' || entry.status === 'error')" class="llm-log-sub">
									↳ 回退本地 AI
								</div>
							</td>
						</tr>
					</tbody>
				</table>
				<div v-else class="llm-log-empty">本局暂无日志</div>
			</div>
		</template>

		<!-- 三级：单条日志详情 -->
		<template v-else>
			<div class="llm-log-detail">
				<!-- 返回按钮 -->
				<div class="llm-log-toolbar">
					<button class="llm-log-btn" @click="view = { kind: 'logList', gameId: view.gameId, session: view.session }">&#8249; 返回列表</button>
				</div>

				<!-- ① 基本信息 -->
				<div class="llm-log-section">
					<div class="llm-log-section-title">基本信息</div>
					<div class="llm-log-section-body">
						<div class="llm-log-field"><span class="llm-log-label">日志ID:</span> {{ view.entry.id }}</div>
						<div class="llm-log-field"><span class="llm-log-label">时间:</span> {{ formatFullTime(view.entry.timestamp) }}</div>
						<div class="llm-log-field"><span class="llm-log-label">决策点:</span> {{ view.entry.decisionPoint }}</div>
						<div class="llm-log-field"><span class="llm-log-label">玩家:</span> {{ view.entry.playerName }}</div>
						<div class="llm-log-field"><span class="llm-log-label">耗时:</span> {{ view.entry.durationMs }}ms</div>
						<div class="llm-log-field">
							<span class="llm-log-label">状态:</span>
							<span :class="['llm-log-status', statusPresentation(view.entry.status).className]">
								{{ statusPresentation(view.entry.status).icon }} {{ statusPresentation(view.entry.status).text }}
							</span>
						</div>
					</div>
				</div>

				<!-- ② 调用元信息 -->
				<div class="llm-log-section">
					<div class="llm-log-section-title">调用元信息</div>
					<div class="llm-log-section-body">
						<div class="llm-log-field"><span class="llm-log-label">enabled:</span> {{ view.entry.meta.enabled }}</div>
						<div class="llm-log-field"><span class="llm-log-label">configured:</span> {{ view.entry.meta.configured }}</div>
						<div class="llm-log-field"><span class="llm-log-label">model:</span> {{ view.entry.meta.model || '(未设置)' }}</div>
					</div>
				</div>

				<!-- ③ 请求 prompt -->
				<div v-if="view.entry.request" class="llm-log-section">
					<div class="llm-log-section-title">请求 Prompt</div>
					<div class="llm-log-section-body">
						<LLMLogContent
							v-for="(msg, i) in view.entry.request.messages"
							:key="`${view.entry.id}-message-${i}`"
							:value="isPromptMessage(msg) ? msg.content : msg"
							:mode="isPromptMessage(msg) ? 'auto' : 'json'"
							:default-expanded="msg.role !== 'system'"
							:label="msg.role"
						/>
						<div v-if="view.entry.request.tools?.length" class="llm-log-content-group-label">tools ({{ view.entry.request.tools.length }})</div>
						<LLMLogContent
							v-for="(tool, i) in view.entry.request.tools"
							:key="`${view.entry.id}-tool-${i}`"
							:value="tool"
							mode="json"
							:default-expanded="false"
							:label="`tool: ${tool.function?.name || i + 1}`"
						/>
					</div>
				</div>

				<!-- ④ 响应结果 -->
				<div v-if="view.entry.status === 'success' && view.entry.response" class="llm-log-section">
					<div class="llm-log-section-title">响应结果</div>
					<div class="llm-log-section-body">
						<LLMLogContent v-if="view.entry.response.toolCall" :key="`${view.entry.id}-tool-call`" :value="view.entry.response.toolCall" mode="json" :default-expanded="true" label="tool_call" />
						<LLMLogContent v-if="view.entry.response.translatedResult != null" :key="`${view.entry.id}-translated-result`" :value="view.entry.response.translatedResult" mode="auto" :default-expanded="true" label="translatedResult" />
					</div>
				</div>

				<!-- ⑤ 错误详情 -->
				<div v-if="view.entry.turns?.length" class="llm-log-section">
					<div class="llm-log-section-title">多轮决策（{{ view.entry.turns.length }}）</div>
					<div class="llm-log-section-body">
						<details v-for="turn in view.entry.turns" :key="turn.index">
							<summary>第 {{ turn.index + 1 }} 轮 {{ turn.stage || "初始动作" }}</summary>
							<pre class="llm-log-json">{{ formatJson(turn) }}</pre>
						</details>
					</div>
				</div>

				<!-- ⑤ 错误详情 -->
				<div v-if="view.entry.error" class="llm-log-section">
					<div class="llm-log-section-title">错误详情</div>
					<div class="llm-log-section-body">
						<div class="llm-log-field"><span class="llm-log-label">stage:</span> {{ view.entry.error.stage }}</div>
						<div class="llm-log-field"><span class="llm-log-label">message:</span> {{ view.entry.error.message }}</div>
						<div v-if="view.entry.error.httpStatus != null" class="llm-log-field">
							<span class="llm-log-label">httpStatus:</span> {{ view.entry.error.httpStatus }}
						</div>
					</div>
				</div>

				<!-- ⑥ 回退或中断说明 -->
				<div v-if="statusDetail(view.entry.status, view.entry.fallbackReason)" class="llm-log-section">
					<div class="llm-log-section-title">{{ view.entry.status === "interrupted" ? "中断说明" : "回退说明" }}</div>
					<div class="llm-log-section-body">
						{{ statusDetail(view.entry.status, view.entry.fallbackReason) }}
					</div>
				</div>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { llmLogger, type LogEntry, type GameSession } from "@/llm/logger.js";
import { getLLMLogStatusDetail, getLLMLogStatusPresentation } from "./llmLogStatus.js";
import LLMLogContent from "./LLMLogContent.vue";

type View =
	| { kind: "sessionList" }
	| { kind: "logList"; gameId: string; session: GameSession }
	| { kind: "logDetail"; gameId: string; session: GameSession; entry: LogEntry };

const view = ref<View>({ kind: "sessionList" });
const sessions = ref<GameSession[]>([]);
const currentLogs = ref<LogEntry[]>([]);
const loading = ref(false);

async function loadSessions() {
	loading.value = true;
	try {
		sessions.value = await llmLogger.getGameSessions();
	} catch (e) {
		sessions.value = [];
	} finally {
		loading.value = false;
	}
}

async function openSession(session: GameSession) {
	loading.value = true;
	try {
		currentLogs.value = await llmLogger.getLogsByGame(session.gameId);
		view.value = { kind: "logList", gameId: session.gameId, session };
	} catch (e) {
		currentLogs.value = [];
	} finally {
		loading.value = false;
	}
}

async function refresh() {
	if (view.value.kind === "sessionList") {
		await loadSessions();
	} else if (view.value.kind === "logList") {
		await openSession(view.value.session);
	}
	// logDetail 视图刷新即返回上层
}

async function clearAll() {
	if (!confirm("确定清空所有已完成 LLM 日志？\n进行中的调用不会中断，结束后会重新出现在历史中。")) return;
	await llmLogger.clearLogs();
	sessions.value = [];
	currentLogs.value = [];
	view.value = { kind: "sessionList" };
}

function formatTime(ts: number): string {
	const d = new Date(ts);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	const ss = String(d.getSeconds()).padStart(2, "0");
	const ms = String(d.getMilliseconds()).padStart(3, "0");
	return `${hh}:${mm}:${ss}.${ms}`;
}

function formatFullTime(ts: number): string {
	const d = new Date(ts);
	const y = d.getFullYear();
	const mo = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${mo}-${day} ${formatTime(ts)}`;
}

function formatJson(data: any): string {
	try {
		return JSON.stringify(data, null, 2);
	} catch {
		return String(data);
	}
}

function isPromptMessage(message: any): message is { role: "system" | "user"; content: unknown } {
	return message?.role === "system" || message?.role === "user";
}

const statusPresentation = getLLMLogStatusPresentation;
const statusDetail = getLLMLogStatusDetail;

onMounted(() => {
	loadSessions();
});
</script>

<style scoped>
.llm-log-viewer {
	position: relative;
	display: block;
	width: 100%;
	height: 100%;
	overflow: auto;
	color: #ddd;
	font-size: 12px;
}

/* 工具栏 */
.llm-log-toolbar {
	position: relative;
	display: flex;
	align-items: center;
	padding: 6px 8px;
	border-bottom: 1px solid #444;
	gap: 6px;
}
.llm-log-title {
	font-weight: bold;
	font-size: 14px;
	flex: 1;
}
.llm-log-btn {
	background: #333;
	color: #ddd;
	border: 1px solid #555;
	border-radius: 3px;
	padding: 3px 10px;
	cursor: pointer;
	font-size: 12px;
}
.llm-log-btn:hover {
	background: #444;
}

/* 表格区域 */
.llm-log-table-wrap {
	position: relative;
	overflow: auto;
}
.llm-log-table {
	width: 100%;
	border-collapse: collapse;
}
.llm-log-table th {
	text-align: left;
	padding: 4px 8px;
	border-bottom: 1px solid #555;
	color: #aaa;
	font-weight: normal;
}
.llm-log-table td {
	padding: 4px 8px;
	border-bottom: 1px solid #333;
	vertical-align: top;
}
.llm-log-row {
	cursor: pointer;
}
.llm-log-row:hover {
	background: rgba(255, 255, 255, 0.05);
}
.llm-log-cell-time {
	font-family: monospace;
	font-size: 11px;
	color: #999;
	white-space: nowrap;
}

/* 状态样式 */
.llm-log-status-success {
	color: #4caf50;
}
.llm-log-status-error {
	color: #f44336;
}
.llm-log-status-fallback,
.llm-log-status-skip {
	color: #888;
}
.llm-log-status-timeout,
.llm-log-status-interrupted {
	color: #ff9800;
}
.llm-log-sub {
	position: relative;
	font-size: 11px;
	color: #888;
	padding-left: 12px;
	margin-top: 2px;
}

/* 空状态 */
.llm-log-empty {
	position: relative;
	text-align: center;
	padding: 40px 0;
	color: #666;
}

/* 详情视图 */
.llm-log-detail {
	position: relative;
	padding: 0 8px;
}
.llm-log-section {
	position: relative;
	margin: 8px 0;
	border: 1px solid #444;
	border-radius: 4px;
	overflow: hidden;
}
.llm-log-section-title {
	position: relative;
	background: #333;
	padding: 5px 8px;
	font-weight: bold;
	color: #ccc;
	border-bottom: 1px solid #444;
}
.llm-log-section-body {
	position: relative;
	padding: 6px 8px;
}
.llm-log-field {
	position: relative;
	margin: 3px 0;
	word-break: break-all;
}
.llm-log-label {
	color: #999;
	margin-right: 4px;
}

/* JSON 展示 */
.llm-log-json {
	background: #2a2a2a;
	border: 1px solid #3a3a3a;
	border-radius: 3px;
	padding: 6px 8px;
	margin: 4px 0;
	font-size: 11px;
	font-family: monospace;
	white-space: pre-wrap;
	word-break: break-all;
	overflow-x: auto;
	color: #ccc;
}
.llm-log-content-group-label { margin-top: 8px; color: #aaa; font-size: 12px; }

/* details/summary 样式 */
details {
	margin: 4px 0;
}
details summary {
	cursor: pointer;
	color: #aaa;
	font-size: 12px;
	padding: 2px 0;
}
details summary:hover {
	color: #ddd;
}
details[open] summary {
	margin-bottom: 4px;
}
</style>
