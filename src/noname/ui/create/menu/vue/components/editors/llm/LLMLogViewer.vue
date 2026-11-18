<template>
	<div class="llm-log-viewer">
		<!-- 三级：单条日志详情（与局内玩家弹窗共用 LLMLogDetailView） -->
		<LLMLogDetailView
			v-if="selectedDetail"
			:entry="selectedDetail"
			:loading="detailLoading"
			@back="closeDetail"
		/>

		<!-- 一级：局列表 -->
		<template v-else-if="!selectedSession">
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
							<td class="llm-log-cell-time">{{ formatFullTime(s.createdAt, true) }}</td>
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
				<div v-else class="llm-log-empty">{{ loading ? "正在加载…" : "暂无对局记录" }}</div>
			</div>
		</template>

		<!-- 二级：单局日志列表 -->
		<template v-else>
			<div class="llm-log-toolbar">
				<button class="llm-log-btn" @click="backToSessions">&#8249; 返回局列表</button>
				<span class="llm-log-title">{{ formatFullTime(selectedSession.createdAt, true) }}</span>
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
							<th>首 Token</th>
							<th>状态</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="entry in currentLogs"
							:key="entry.id"
							class="llm-log-row"
							@click="openDetail(entry)"
						>
							<td class="llm-log-cell-time">{{ formatClockTime(entry.timestamp, true) }}</td>
							<td>{{ entry.decisionPoint }}</td>
							<td>{{ entry.playerName }}</td>
							<td>{{ entry.durationMs }}ms</td>
							<td>{{ formatFinalTTFT(entry) }}</td>
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
								<div v-if="entry.status === 'timeout' || entry.status === 'error'" class="llm-log-sub">
									↳ 回退本地 AI
								</div>
							</td>
						</tr>
					</tbody>
				</table>
				<div v-else class="llm-log-empty">{{ loading ? "正在加载…" : "本局暂无日志" }}</div>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { llmLogger, type GameSession, type LogEntry } from "@/llm/logger.js";
import LLMLogDetailView from "@/ui/create/llmLog/vue/components/LLMLogDetailView.vue";
import {
	getLLMLogStatusDetail,
	getLLMLogStatusPresentation,
	useLogDetailLoader,
} from "@/ui/create/llmLog/vue/llmLogStatus.js";
import { formatClockTime, formatFullTime, formatMs } from "@/ui/create/llmLog/vue/timelineTypes.js";

const selectedSession = ref<GameSession | null>(null);
const sessions = ref<GameSession[]>([]);
const currentLogs = ref<LogEntry[]>([]);
const loading = ref(false);

const { selectedDetail, detailLoading, openDetail, closeDetail } = useLogDetailLoader(id => llmLogger.getLogDetail(id));

async function loadSessions() {
	loading.value = true;
	try {
		sessions.value = await llmLogger.getGameSessions();
	} catch {
		sessions.value = [];
	} finally {
		loading.value = false;
	}
}

async function openSession(session: GameSession) {
	loading.value = true;
	try {
		currentLogs.value = await llmLogger.getLogSummariesByGame(session.gameId);
		selectedSession.value = session;
	} catch {
		currentLogs.value = [];
	} finally {
		loading.value = false;
	}
}

function backToSessions() {
	closeDetail();
	selectedSession.value = null;
}

async function refresh() {
	if (selectedDetail.value) return;
	if (!selectedSession.value) {
		await loadSessions();
	} else {
		await openSession(selectedSession.value);
	}
}

async function clearAll() {
	if (!confirm("确定清空所有已完成 LLM 日志？\n进行中的调用不会中断，结束后会重新出现在历史中。")) return;
	await llmLogger.clearLogs();
	closeDetail();
	sessions.value = [];
	currentLogs.value = [];
	selectedSession.value = null;
}

function formatFinalTTFT(entry: LogEntry): string {
	return formatMs(entry.requestTimings?.find(timing => timing.outcome === "success" && timing.ttftMs !== undefined)?.ttftMs);
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
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	overflow: hidden;
	color: #ddd;
	font-size: 12px;
}

.llm-log-toolbar {
	position: relative;
	display: flex;
	flex: 0 0 auto;
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

.llm-log-table-wrap {
	position: relative;
	flex: 1 1 auto;
	min-height: 0;
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

.llm-log-empty {
	position: relative;
	text-align: center;
	padding: 40px 0;
	color: #666;
}
</style>
