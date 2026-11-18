<template>
	<div class="llm-decision-block" :class="{ 'is-active': active, 'is-failed': !active && entry.status !== 'success' }">
		<div class="decision-header">
			<span class="decision-time">{{ formatClockTime(entry.timestamp) }}</span>
			<button
				v-if="entry.id"
				type="button"
				class="decision-log-id"
				:class="{ 'is-copied': copied }"
				:title="copied ? `已复制: ${entry.id}` : `点击复制日志ID: ${entry.id}`"
				@click.stop="handleCopyId"
			>
				{{ copied ? "✓ 已复制" : formatShortLogId(entry.id) }}
			</button>
			<span v-if="active" class="active-dot"></span>
			<span class="decision-point">{{ entry.decisionPoint === "chooseCharacter" ? "开局选将" : entry.decisionPoint }}</span>
			<span class="decision-meta">
				<template v-if="active">{{ formatDurationSec(elapsedMs) }}</template>
				<template v-else>{{ formatDurationSec(entry.durationMs) }}</template>
			</span>
			<span v-if="usageBadge" class="decision-usage">{{ usageBadge }}</span>
			<span v-if="!active" class="decision-status" :class="statusInfo.className" :title="statusInfo.text">
				{{ statusInfo.icon }}
			</span>
			<button v-if="!active" class="detail-btn" @click="emit('select-detail', entry)">详情</button>
		</div>

		<div class="decision-body">
			<template v-if="active">
				<LLMThinkingBlock
					:thought="activeStream?.thought || ''"
					:active="isActiveThinking"
					:thinking-ms="liveThinkingMs || activeStream?.thinkingMs"
					:thought-tokens="activeStream?.usage?.thoughtTokens"
				/>
				<div v-if="activeOutputText" class="active-output">
					<span class="output-label">{{ activeOutputLabel }}</span>
					<pre class="output-preview">{{ activeOutputText }}</pre>
				</div>
				<div v-else-if="!isActiveThinking" class="waiting-hint">正在等待模型响应…</div>
			</template>

			<template v-else>
				<template v-if="entry.turns?.length">
					<div v-for="turn in entry.turns" :key="turn.index" class="turn-row">
						<LLMThinkingBlock
							v-if="turn.thinking || turn.thinkingMs || turn.toolCall?.reasoningContent"
							:thought="turn.thinking || turn.toolCall?.reasoningContent || ''"
							:thinking-ms="turn.thinkingMs"
							:thought-tokens="turn.usage?.thoughtTokens"
						/>
						<LLMToolCallLine
							v-if="turn.toolCall"
							:name="turn.toolCall.name"
							:args="turn.toolCall.arguments"
							:reason="turn.toolCall.reason"
							:ref-labels="turn.refLabels || entry.refLabels"
							:result="turn.result"
							:error="turn.error"
						/>
					</div>
				</template>

				<template v-else-if="entry.response?.toolCall">
					<LLMThinkingBlock
						v-if="entry.response.toolCall.reasoningContent"
						:thought="entry.response.toolCall.reasoningContent"
					/>
					<LLMToolCallLine
						:name="entry.response.toolCall.name"
						:args="entry.response.toolCall.arguments"
						:reason="entry.response.toolCall.reason"
						:ref-labels="entry.refLabels"
						:result="entry.response.translatedResult"
					/>
				</template>

				<div v-if="entry.decisionPoint === 'chooseCharacter' && entry.response?.execution === 'automatic'" class="decision-note">
					本地选择：{{ formatCharacterSelectionResult(entry.response.translatedResult, entry.refLabels) }}
				</div>
				<div v-if="entry.error" class="decision-note note-error">
					✕ [{{ entry.error.stage }}] {{ entry.error.message }}
				</div>
				<div v-if="entry.fallbackReason" class="decision-note note-fallback">
					↪ {{ entry.fallbackReason }}
				</div>
			</template>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { LogEntry, StreamProgressPayload } from "@/llm/logger-types.js";
import { getLLMLogStatusPresentation } from "../llmLogStatus.js";
import {
	copyToClipboard,
	formatCharacterSelectionResult,
	formatClockTime,
	formatDurationSec,
	formatShortLogId,
	formatUsageSummary,
} from "../timelineTypes.js";
import LLMThinkingBlock from "./LLMThinkingBlock.vue";
import LLMToolCallLine from "./LLMToolCallLine.vue";

const props = defineProps<{
	entry: LogEntry;
	active?: boolean;
	activeStream?: StreamProgressPayload | null;
	partialArgs?: string;
	elapsedMs?: number;
	liveThinkingMs?: number;
}>();

const emit = defineEmits<{
	(e: "select-detail", entry: LogEntry): void;
}>();

const statusInfo = computed(() => getLLMLogStatusPresentation(props.entry.status));

const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | null = null;

function clearCopyTimer(): void {
	if (copyTimer !== null) {
		clearTimeout(copyTimer);
		copyTimer = null;
	}
}

watch(
	() => props.entry.id,
	() => {
		clearCopyTimer();
		copied.value = false;
	}
);

onBeforeUnmount(clearCopyTimer);

async function handleCopyId(): Promise<void> {
	if (!props.entry.id) return;
	const ok = await copyToClipboard(props.entry.id);
	if (!ok) return;
	copied.value = true;
	clearCopyTimer();
	copyTimer = setTimeout(() => {
		copied.value = false;
		copyTimer = null;
	}, 1500);
}

const isActiveThinking = computed(() => {
	if (!props.active) return false;
	const stream = props.activeStream;
	if (!stream) return false;
	return stream.phase === "thinking" || (stream.phase === "idle" && Boolean(stream.thought));
});

const activeOutputText = computed(() => (props.activeStream ? props.activeStream.text : props.partialArgs || ""));
const activeOutputLabel = computed(() => (props.activeStream?.phase === "tool_calling" ? "● 正在组装决策参数" : "● 输出中"));

const usageBadge = computed(() => {
	if (props.active) return formatUsageSummary(props.activeStream?.usage);
	const turns = props.entry.turns || [];
	for (let i = turns.length - 1; i >= 0; i--) {
		const summary = formatUsageSummary(turns[i]?.usage);
		if (summary) return summary;
	}
	return "";
});
</script>

<style scoped>
.llm-decision-block, .llm-decision-block div { position: static !important; }
.llm-decision-block { border: 1px solid #353b45; border-radius: 5px; background: #23272e; padding: 7px 9px; margin-bottom: 6px; }
.llm-decision-block.is-active { border-color: #4a9eff; background: rgba(74, 158, 255, 0.08); }
.llm-decision-block.is-failed { border-color: #5c4338; }
.decision-header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.decision-time { font-family: monospace; font-size: 11px; color: #8c95a3; }
.decision-log-id { font-family: monospace; font-size: 11px; line-height: 1.2; color: #9aa4b2; background: #1c2026; border: 1px solid #383f4a; border-radius: 3px; padding: 1px 5px; cursor: pointer; flex-shrink: 0; }
.decision-log-id:hover { color: #e2e7ef; border-color: #556070; background: #282d36; }
.decision-log-id.is-copied { color: #8be09e; border-color: #315c3d; background: rgba(76, 175, 80, 0.14); }
.active-dot { width: 7px; height: 7px; border-radius: 50%; background: #4a9eff; animation: llm-dot-pulse 1s ease-in-out infinite; }
@keyframes llm-dot-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.decision-point { flex: 1 1 auto; min-width: 120px; font-weight: 600; color: #e2e7ef; font-size: 12px; }
.decision-meta, .decision-usage { font-family: monospace; font-size: 11px; color: #8c95a3; }
.decision-status { font-size: 12px; }
.detail-btn { background: #2e343e; color: #cfd6e0; border: 1px solid #48505e; border-radius: 3px; padding: 1px 6px; font-size: 11px; cursor: pointer; }
.detail-btn:hover { background: #3b424f; color: #fff; }
.decision-body { margin-top: 4px; }
.turn-row + .turn-row { margin-top: 4px; padding-top: 4px; border-top: 1px dashed #323741; }
.active-output { margin-top: 4px; }
.output-label { display: block; font-size: 11px; color: #8ec0ff; margin-bottom: 2px; }
.output-preview { margin: 0; padding: 5px 7px; border-radius: 3px; background: rgba(0, 0, 0, 0.25); color: #cfd6e0; font-family: monospace; font-size: 11px; white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow: auto; }
.waiting-hint { font-size: 11px; color: #8c95a3; padding: 2px 0; }
.decision-note { margin-top: 4px; font-size: 11px; word-break: break-word; }
.note-error { color: #ff8a80; }
.note-fallback { color: #ffb74d; }
.llm-log-status-success { color: #4caf50; }
.llm-log-status-fallback, .llm-log-status-timeout { color: #ff9800; }
.llm-log-status-error { color: #f44336; }
.llm-log-status-interrupted { color: #ffb74d; }
</style>
