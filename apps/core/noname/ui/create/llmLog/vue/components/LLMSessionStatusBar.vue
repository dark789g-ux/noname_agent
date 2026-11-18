<template>
	<div class="llm-session-status-bar">
		<div class="status-main">
			<span class="seat-name">{{ status.playerName }}</span>
			<span class="seat-tag">座位{{ status.playerSeatNum }}</span>
			<span class="sep">·</span>
			<span class="backend-name">{{ status.backendLabel }}</span>
			<span class="sep">·</span>
			<span class="model-name" :title="status.model">{{ status.model }}</span>
			<span class="mode-pill" :class="{ active: status.modeText === '常驻会话', warn: status.modeText === '已降级无状态' }">
				{{ status.modeText }}
			</span>
		</div>
		<div v-if="status.contextUsed != null" class="status-context">
			<div v-if="status.contextPercent != null" class="context-bar" :title="contextTooltip">
				<div class="context-fill" :class="{ high: status.contextPercent >= 75 }" :style="{ width: `${status.contextPercent}%` }"></div>
			</div>
			<span class="context-text" :title="contextTooltip">
				{{ formatCompactTokens(status.contextUsed) }}<template v-if="status.contextSize">/{{ formatCompactTokens(status.contextSize) }} ({{ status.contextPercent }}%)</template>
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatCompactTokens, type SessionStatusInfo } from "../timelineTypes.js";

const props = defineProps<{
	status: SessionStatusInfo;
}>();

const contextTooltip = computed(() => {
	if (props.status.contextUsed == null) return "";
	if (props.status.contextSize) {
		return `上下文占用 ${props.status.contextUsed} / ${props.status.contextSize} tokens`;
	}
	return `上下文 tokens: ${props.status.contextUsed}`;
});
</script>

<style scoped>
.llm-session-status-bar, .llm-session-status-bar div { position: static !important; }
.llm-session-status-bar { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; background: #22252a; border-bottom: 1px solid #3a3f47; font-size: 11px; color: #c7ccd4; flex-wrap: wrap; }
.status-main { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
.seat-name { font-weight: bold; color: #e8ecf2; }
.seat-tag { color: #8c96a4; }
.sep { color: #5c6370; }
.backend-name { color: #8ec0ff; }
.model-name { color: #abb2bf; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mode-pill { padding: 1px 5px; border-radius: 3px; border: 1px solid #454c57; background: #2b3038; color: #9da5b4; font-size: 10px; }
.mode-pill.active { border-color: #366e46; background: rgba(76, 175, 80, 0.14); color: #8be09e; }
.mode-pill.warn { border-color: #8c5c1f; background: rgba(255, 152, 0, 0.14); color: #ffcc80; }
.status-context { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.context-bar { width: 64px; height: 5px; border-radius: 3px; background: #333942; overflow: hidden; }
.context-fill { height: 100%; background: #4a9eff; transition: width 0.2s ease; }
.context-fill.high { background: #ff9800; }
.context-text { font-family: monospace; color: #9da5b4; white-space: nowrap; }
</style>
