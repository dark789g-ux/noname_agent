<template>
	<div class="llm-seat-panel">
		<div class="llm-seat-header">
			<div class="llm-section-title">按行动顺位分配 AI 后端</div>
			<button type="button" class="llm-reset-btn" @click="resetAllToDefault">
				全部重置为跟随默认
			</button>
		</div>

		<div class="llm-seat-note">
			按行动顺位（1号位 = 首家行动）生效；未开启「玩家角色接入 LLM」时，玩家本人座位保持手动操控。
		</div>

		<div class="llm-seat-grid">
			<div v-for="seat in SEAT_NUMBERS" :key="seat" class="llm-seat-item">
				<span class="llm-seat-label">{{ seat }}号位</span>
				<select
					v-model="seatBackends[String(seat)]"
					class="llm-seat-select"
					@change="saveSeatBackends"
					@keydown.stop
					@keyup.stop
				>
					<option value="default">跟随默认（{{ defaultBackendLabel }}）</option>
					<option value="openai">OpenAI API（{{ backendLabels.openai }}）</option>
					<option value="agy">agy CLI（{{ backendLabels.agy }}）</option>
					<option value="codex">codex CLI（{{ backendLabels.codex }}）</option>
					<option value="local">本地规则 AI</option>
				</select>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { game, lib, ui } from "noname";
import {
	defaultSeatBackends,
	readBackendsFromRawConfig,
	SEAT_NUMBERS,
	type LLMBackendKind,
	type SeatBackendChoice,
} from "@/llm/backends.js";

interface Props {
	defaultBackend: LLMBackendKind;
	backendLabels: {
		openai: string;
		agy: string;
		codex: string;
	};
}

const props = defineProps<Props>();

const initial = readBackendsFromRawConfig(lib.config, document);
const seatBackends = reactive<Record<string, SeatBackendChoice>>({ ...initial.seatBackends });

const defaultBackendLabel = computed(() => {
	if (props.defaultBackend === "local") return "本地规则 AI";
	if (props.defaultBackend === "agy") return props.backendLabels.agy;
	if (props.defaultBackend === "codex") return props.backendLabels.codex;
	return props.backendLabels.openai;
});

function saveSeatBackends() {
	const plain: Record<string, SeatBackendChoice> = {};
	for (const seat of SEAT_NUMBERS) {
		const key = String(seat);
		plain[key] = seatBackends[key] || "default";
	}
	game.saveConfig("llm_seat_backends", plain);
	ui?.updateLLMLogButtons?.();
}

function resetAllToDefault() {
	const defaults = defaultSeatBackends();
	for (const seat of SEAT_NUMBERS) {
		const key = String(seat);
		seatBackends[key] = defaults[key];
	}
	saveSeatBackends();
}
</script>

<style scoped>
.llm-seat-panel,
.llm-seat-panel div {
	position: relative;
	display: block;
	transition: none;
	box-sizing: border-box;
}

.llm-seat-panel {
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.14);
	border-radius: 8px;
	padding: 12px;
	margin-top: 10px;
}

.llm-seat-header {
	display: flex !important;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 6px;
}

.llm-section-title {
	font-size: 14px;
	font-weight: bold;
	color: #eef3fa;
}

.llm-reset-btn {
	padding: 4px 10px;
	border-radius: 5px;
	border: 1px solid rgba(255, 255, 255, 0.22);
	background: rgba(255, 255, 255, 0.08);
	color: #dce5f2;
	font-size: 12px;
	cursor: pointer;
}

.llm-reset-btn:hover {
	background: rgba(255, 255, 255, 0.16);
}

.llm-seat-note {
	font-size: 12px;
	color: #aebccf;
	line-height: 1.4;
	margin-bottom: 10px;
}

.llm-seat-grid {
	display: grid !important;
	grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
	gap: 8px;
}

.llm-seat-item {
	display: flex !important;
	align-items: center;
	gap: 8px;
	padding: 6px 8px;
	border-radius: 6px;
	background: rgba(0, 0, 0, 0.22);
	border: 1px solid rgba(255, 255, 255, 0.09);
}

.llm-seat-label {
	min-width: 44px;
	font-size: 12px;
	font-weight: 600;
	color: #dce6f4;
	flex-shrink: 0;
}

.llm-seat-select {
	flex: 1;
	min-width: 0;
	padding: 4px 6px;
	border-radius: 4px;
	border: 1px solid rgba(255, 255, 255, 0.2);
	background: rgba(0, 0, 0, 0.35);
	color: #f3f6fb;
	font-size: 12px;
	user-select: text;
	-webkit-user-select: text;
}

.llm-seat-select option {
	background: #242932;
	color: #f3f6fb;
}
</style>
