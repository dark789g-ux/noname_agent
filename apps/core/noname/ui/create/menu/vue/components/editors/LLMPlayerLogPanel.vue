<template>
	<div class="llm-player-log-panel">
		<LLMLogDetailView
			v-if="selectedDetail"
			:entry="selectedDetail"
			@back="selectedDetail = null"
		/>
		<LLMSessionTimeline
			v-else
			:player-seat-num="playerSeatNum"
			:game-id="gameId"
			:player-name="playerName"
			@select-detail="selectedDetail = $event"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { LogEntry } from "@/llm/logger-types.js";
import LLMLogDetailView from "./LLMLogDetailView.vue";
import LLMSessionTimeline from "./llm-timeline/LLMSessionTimeline.vue";

defineProps<{
	playerSeatNum: number;
	gameId: string;
	playerName: string;
}>();

const selectedDetail = ref<LogEntry | null>(null);
</script>

<style scoped>
.llm-player-log-panel, .llm-player-log-panel div { position: static !important; }
.llm-player-log-panel { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; overflow: hidden; box-sizing: border-box; color: #ddd; font-size: 12px; background: #1b1e23; }
</style>
