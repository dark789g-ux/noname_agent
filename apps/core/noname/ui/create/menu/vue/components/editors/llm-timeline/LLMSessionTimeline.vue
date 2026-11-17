<template>
	<div class="llm-session-timeline">
		<LLMSessionStatusBar :status="sessionStatus" />

		<div class="timeline-scroll-wrap">
			<div ref="timelineEl" class="timeline-scroll" @scroll="handleScroll">
				<div v-if="isLoading && history.length === 0 && !currentCall" class="timeline-empty">
					正在加载决策记录…
				</div>
				<div v-else-if="history.length === 0 && !currentCall" class="timeline-empty">
					暂无决策时间线，等待该玩家下次决策…
				</div>

				<template v-for="(entry, index) in history" :key="entry.id">
					<LLMSessionMarker
						v-for="(marker, mIdx) in buildTimelineMarkers(entry, index)"
						:key="`${entry.id}-marker-${mIdx}`"
						:marker="marker"
					/>
					<LLMDecisionBlock
						:entry="entry"
						@select-detail="emit('select-detail', $event)"
					/>
				</template>

				<template v-if="currentCall">
					<LLMSessionMarker
						v-for="(marker, mIdx) in buildTimelineMarkers(currentCall, history.length)"
						:key="`${currentCall.id}-active-marker-${mIdx}`"
						:marker="marker"
					/>
					<LLMDecisionBlock
						:entry="currentCall"
						:active="true"
						:active-stream="activeStream"
						:partial-args="partialArgs"
						:elapsed-ms="elapsedMs"
						:live-thinking-ms="liveThinkingMs"
					/>
				</template>
			</div>

			<button
				v-if="!isFollowing"
				class="jump-latest-btn"
				:class="{ 'has-new': hasNewBelow }"
				@click="scrollToBottom"
			>
				{{ hasNewBelow ? "↓ 有新输出，回到最新" : "↓ 回到最新" }}
			</button>
		</div>

		<div class="toolbar">
			<button class="btn" :disabled="isClearing" @click="refresh">刷新</button>
			<button class="btn" :disabled="isClearing" @click="clearLogs">
				{{ isClearing ? "清空中…" : "清空" }}
			</button>
			<span class="toolbar-summary">共 {{ history.length }} 次已完成决策</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { LogEntry } from "@/llm/logger-types.js";
import LLMDecisionBlock from "./LLMDecisionBlock.vue";
import LLMSessionMarker from "./LLMSessionMarker.vue";
import LLMSessionStatusBar from "./LLMSessionStatusBar.vue";
import { buildTimelineMarkers } from "./types.js";
import { useLLMSeatTimeline } from "./useLLMSeatTimeline.js";

const props = defineProps<{
	playerSeatNum: number;
	gameId: string;
	playerName: string;
}>();

const emit = defineEmits<{
	(e: "select-detail", entry: LogEntry): void;
}>();

const {
	timelineEl,
	currentCall,
	activeStream,
	partialArgs,
	history,
	elapsedMs,
	liveThinkingMs,
	isLoading,
	isClearing,
	isFollowing,
	hasNewBelow,
	sessionStatus,
	handleScroll,
	scrollToBottom,
	refresh,
	clearLogs,
} = useLLMSeatTimeline(props);
</script>

<style scoped>
.llm-session-timeline, .llm-session-timeline div { position: static !important; }
.llm-session-timeline { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; overflow: hidden; }
.timeline-scroll-wrap { position: relative !important; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.timeline-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 8px 10px; }
.timeline-empty { text-align: center; padding: 48px 12px; color: #757e8c; font-size: 12px; }
.jump-latest-btn { position: absolute !important; right: 16px; bottom: 12px; z-index: 5; background: #2c3543; color: #dce4f0; border: 1px solid #4d607a; border-radius: 999px; padding: 4px 10px; font-size: 11px; cursor: pointer; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); }
.jump-latest-btn:hover { background: #374354; }
.jump-latest-btn.has-new { border-color: #4a9eff; color: #8ec0ff; }
.toolbar { display: flex; flex: 0 0 auto; align-items: center; padding: 6px 8px; border-top: 1px solid #444; gap: 6px; background: #1e2126; }
.btn { background: #333; color: #ddd; border: 1px solid #555; border-radius: 3px; padding: 3px 10px; cursor: pointer; font-size: 12px; }
.btn:hover { background: #444; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.toolbar-summary { margin-left: auto; font-size: 11px; color: #8c95a3; }
</style>
