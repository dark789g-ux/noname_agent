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
import { ref } from "vue";
import { llmLogger, type LogEntry } from "@/llm/logger.js";
import { loadLogDetailEntry } from "./llmLogStatus.js";
import LLMLogDetailView from "./LLMLogDetailView.vue";
import LLMSessionTimeline from "./llm-timeline/LLMSessionTimeline.vue";

defineProps<{
	playerSeatNum: number;
	gameId: string;
	playerName: string;
}>();

const selectedDetail = ref<LogEntry | null>(null);
const detailLoading = ref(false);
let detailGeneration = 0;

function closeDetail(): void {
	detailGeneration++;
	detailLoading.value = false;
	selectedDetail.value = null;
}

async function openDetail(entry: LogEntry): Promise<void> {
	const generation = ++detailGeneration;
	selectedDetail.value = entry;
	await loadLogDetailEntry(
		entry,
		id => llmLogger.getLogDetail(id),
		value => (detailLoading.value = value),
		() => generation === detailGeneration && selectedDetail.value?.id === entry.id,
		full => (selectedDetail.value = full)
	);
}
</script>

<style scoped>
.llm-player-log-panel, .llm-player-log-panel div { position: static !important; }
.llm-player-log-panel { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; overflow: hidden; box-sizing: border-box; color: #ddd; font-size: 12px; background: #1b1e23; }
</style>
