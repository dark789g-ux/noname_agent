<template>
	<div class="llm-player-log-panel">
		<LLMLogDetailView
			v-if="selectedDetail"
			:entry="selectedDetail"
			:loading="detailLoading"
			@back="closeDetail"
		/>
		<LLMSessionTimeline
			v-else
			:player-seat-num="playerSeatNum"
			:game-id="gameId"
			:player-name="playerName"
			@select-detail="openDetail"
		/>
	</div>
</template>

<script setup lang="ts">
import { llmLogger } from "@/llm/logger.js";
import { useLogDetailLoader } from "./llmLogStatus.js";
import LLMLogDetailView from "./components/LLMLogDetailView.vue";
import LLMSessionTimeline from "./components/LLMSessionTimeline.vue";

defineProps<{
	playerSeatNum: number;
	gameId: string;
	playerName: string;
}>();

const { selectedDetail, detailLoading, openDetail, closeDetail } = useLogDetailLoader(id => llmLogger.getLogDetail(id));
</script>

<style scoped>
.llm-player-log-panel, .llm-player-log-panel div { position: static !important; }
.llm-player-log-panel { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; overflow: hidden; box-sizing: border-box; color: #ddd; font-size: 12px; background: #1b1e23; }
</style>
