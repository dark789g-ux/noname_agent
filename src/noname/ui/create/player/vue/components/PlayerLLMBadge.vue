<template>
	<div
		ref="btnRef"
		class="llm-log-btn"
		:class="{ 'llm-log-btn-active': state.llmBadge.highlighted }"
		:style="{ display: state.llmBadge.visible ? '' : 'none' }"
		:title="state.llmBadge.title"
		@click.stop="handleClick"
	>
		{{ state.llmBadge.label || "AI" }}
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { _status, lib } from "noname";
import { resolvePlayerButtonState, type PlayerButtonStatusSnapshot } from "@/llm/player-button-state.js";
import type { Player } from "../../../../library/element/player.js";
import type { PlayerCardState } from "../playerCardState.js";

const props = defineProps<{
	player: Player;
	state: PlayerCardState;
	onNodeReady: (key: "llmLogBtn", el: HTMLDivElement) => void;
}>();

const btnRef = ref<HTMLDivElement | null>(null);

function handleClick() {
	const state = resolvePlayerButtonState(props.player, _status as PlayerButtonStatusSnapshot, lib.config);
	if (!state.visible) return;
	import("@/llm/openLLMPlayerLog.js")
		.then(({ openLLMPlayerLog }) => {
			openLLMPlayerLog(props.player);
		})
		.catch(() => {
			// 加载失败静默处理
		});
}

onMounted(() => {
	if (btnRef.value) {
		props.onNodeReady("llmLogBtn", btnRef.value);
	}
});
</script>

<style>
/* LLM / CLI 控场角色顶部 AI 名称徽标 */
.player > .llm-log-btn {
	position: absolute;
	left: 6px;
	right: auto;
	top: -10px;
	width: auto;
	min-width: 28px;
	max-width: calc(100% - 34px);
	height: 20px;
	padding: 0 7px;
	border-radius: 10px;
	background: rgba(32, 72, 145, 0.92);
	border: 1px solid rgba(150, 200, 255, 0.55);
	color: #fff;
	font-size: 11px;
	font-weight: 600;
	text-align: center;
	line-height: 18px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	cursor: pointer;
	z-index: 7;
	user-select: none;
	box-sizing: border-box;
	box-shadow: 0 2px 5px rgba(0, 0, 0, 0.45);
	transition: background 0.2s, box-shadow 0.2s;
}
.player:not([data-position="0"]) > .llm-log-btn {
	max-width: calc(100% - 76px);
}
.player > .llm-log-btn:hover {
	background: rgba(58, 110, 210, 1);
}
.player > .llm-log-btn.llm-log-btn-active {
	background: rgba(55, 140, 248, 1);
	box-shadow: 0 0 12px rgba(85, 170, 255, 0.95);
	animation: llm-log-btn-active-pulse 1.2s ease-in-out infinite;
}
@keyframes llm-log-btn-active-pulse {
	50% {
		background: rgba(95, 175, 255, 1);
		box-shadow: 0 0 18px rgba(125, 195, 255, 1);
	}
}
@media (prefers-reduced-motion: reduce) {
	.player > .llm-log-btn.llm-log-btn-active {
		animation: none;
	}
}
/* 阵亡角色仍保持 AI 名称徽标可读与可点击查看历史日志 */
.player.dead > .llm-log-btn {
	filter: none !important;
	opacity: 1 !important;
}
/* oldlayout 宽卡顶部右侧避让判定区与身份标记 */
#arena.oldlayout .player:not(.minskin) > .llm-log-btn {
	left: 120px;
	max-width: 96px;
	top: -10px;
}
</style>
