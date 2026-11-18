<template>
	<div
		ref="rootRef"
		class="llm-opening-progress"
		:class="{ 'is-dragging': isDragging }"
		:style="rootStyle"
		@pointerdown="onPointerDown"
	>
		<div class="progress-main">
			<span class="progress-title">LLM 选将</span>
			<span class="progress-count">{{ state.completed }}/{{ state.total }}</span>
			<div class="progress-track" :title="`已完成 ${percent}%`">
				<div class="progress-fill" :style="{ width: `${percent}%` }"></div>
			</div>
		</div>
		<div class="progress-badges">
			<span class="pill">{{ state.elapsedSec }}秒</span>
			<span v-if="state.waitingText" class="pill waiting">等待 {{ state.waitingText }}</span>
			<span v-if="state.fallbacks > 0" class="pill warn">回退 {{ state.fallbacks }}</span>
			<span v-if="state.skipped" class="pill muted">已跳过</span>
		</div>
		<button
			type="button"
			class="skip-btn"
			:disabled="state.skipped"
			@pointerdown.stop
			@click="emit('skip')"
		>
			跳过剩余 LLM 选将
		</button>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import type { OpeningProgressViewState } from "./progress.js";

const props = defineProps<{
	state: OpeningProgressViewState;
}>();

const emit = defineEmits<{
	skip: [];
	"update:offset": [offset: { x: number; y: number }];
}>();

const rootRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);

const percent = computed(() => {
	if (props.state.total <= 0) return 0;
	return Math.min(100, Math.max(0, Math.round((props.state.completed / props.state.total) * 100)));
});

const rootStyle = computed(() => ({
	transform: `translate(calc(-50% + ${props.state.offsetX}px), ${props.state.offsetY}px)`,
}));

let dragCleanup: (() => void) | null = null;

function clampOffset(x: number, y: number, zoom: number) {
	const vw = (typeof window !== "undefined" ? window.innerWidth : 0) / zoom;
	const vh = (typeof window !== "undefined" ? window.innerHeight : 0) / zoom;
	const el = rootRef.value;
	if (!vw || !vh || !el) return { x, y };
	const margin = 8;
	const halfW = el.offsetWidth / 2;
	const maxX = Math.max(0, vw / 2 - halfW - margin);
	const minX = -maxX;
	const minY = -12 + margin;
	const maxY = Math.max(minY, vh - 12 - el.offsetHeight - margin);
	return {
		x: Math.round(Math.min(maxX, Math.max(minX, x))),
		y: Math.round(Math.min(maxY, Math.max(minY, y))),
	};
}

function onPointerDown(e: PointerEvent) {
	if (e.button !== 0) return;
	const target = e.target as HTMLElement | null;
	if (target?.closest?.("button")) return;

	dragCleanup?.();
	const zoom = (globalThis as { game?: { documentZoom?: number } }).game?.documentZoom || 1;
	const startX = e.clientX;
	const startY = e.clientY;
	const baseX = props.state.offsetX;
	const baseY = props.state.offsetY;
	isDragging.value = true;

	const onMove = (ev: PointerEvent) => {
		const dx = (ev.clientX - startX) / zoom;
		const dy = (ev.clientY - startY) / zoom;
		emit("update:offset", clampOffset(baseX + dx, baseY + dy, zoom));
	};

	const stop = () => {
		isDragging.value = false;
		dragCleanup?.();
	};

	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", stop);
	window.addEventListener("pointercancel", stop);
	dragCleanup = () => {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", stop);
		window.removeEventListener("pointercancel", stop);
		dragCleanup = null;
	};
}

onBeforeUnmount(() => {
	dragCleanup?.();
	isDragging.value = false;
});
</script>

<style scoped>
.llm-opening-progress div { position: static !important; }
.llm-opening-progress {
	position: fixed;
	left: 50%;
	top: 12px;
	z-index: 1000;
	display: flex;
	align-items: center;
	gap: 10px;
	flex-wrap: wrap;
	max-width: 92vw;
	padding: 8px 12px;
	background: rgba(26, 29, 36, 0.94);
	backdrop-filter: blur(8px);
	color: #c7ccd4;
	border: 1px solid #3a3f47;
	border-radius: 8px;
	box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
	font-size: 12px;
	line-height: 1.4;
	pointer-events: auto;
	cursor: grab;
	user-select: none;
	touch-action: none;
}
.llm-opening-progress.is-dragging { cursor: grabbing; }
.progress-main { display: flex; align-items: center; gap: 8px; }
.progress-title { font-weight: 600; color: #e8ecf2; white-space: nowrap; }
.progress-count { font-family: monospace; font-weight: 600; color: #8ec0ff; white-space: nowrap; }
.progress-track { width: 72px; height: 5px; border-radius: 3px; background: #333942; overflow: hidden; }
.progress-fill { height: 100%; background: #4a9eff; transition: width 0.2s ease; }
.progress-badges { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pill { padding: 1px 6px; border-radius: 4px; border: 1px solid #454c57; background: #2b3038; color: #9da5b4; font-size: 11px; white-space: nowrap; }
.pill.waiting { border-color: #36577a; background: rgba(74, 158, 255, 0.14); color: #9ecbff; }
.pill.warn { border-color: #8c5c1f; background: rgba(255, 152, 0, 0.14); color: #ffcc80; }
.pill.muted { border-color: #454c57; background: rgba(157, 165, 180, 0.12); color: #9da5b4; }
.skip-btn {
	margin-left: 2px;
	padding: 4px 10px;
	border-radius: 5px;
	border: 1px solid #4f5866;
	background: #2e3440;
	color: #e8ecf2;
	font-size: 12px;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.15s ease, border-color 0.15s ease;
}
.skip-btn:hover:not(:disabled) { background: #3b4252; border-color: #6c7789; }
.skip-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
