<template>
	<div
		ref="btnRef"
		class="player-main-switch-btn"
		:class="{ 'with-llm-badge': state.llmBadge.visible }"
		v-show="!state.isMainPlayer"
		title="切换为主角色并查看手牌"
		@click="handleClick"
	>
		视角
	</div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { _status, game, ui } from "noname";
import type { Player } from "../../../../library/element/player.js";
import type { PlayerCardState } from "../playerCardState.js";

const props = defineProps<{
	player: Player;
	state: PlayerCardState;
	onNodeReady: (key: string, el: HTMLDivElement) => void;
}>();

const btnRef = ref<HTMLDivElement | null>(null);

function handleClick(event: MouseEvent): void {
	event.stopPropagation();
	const target = props.player;
	if (!target || target === game.me) return;
	if (target.isDead?.() || target.classList?.contains("dead")) return;
	if (_status.gameStarted === false) return;
	if (_status.connectMode || game.online) return;

	const initialHuman = (_status as Record<string, unknown>).llmInitialHumanPlayer;
	if (!_status.auto && target !== initialHuman) {
		ui.click?.auto?.();
	}

	game.swapPlayer(target, null, {
		animate: true,
		preserveIdentity: true,
	});
}

onMounted(() => {
	if (btnRef.value) {
		props.onNodeReady("mainSwitchBtn", btnRef.value);
	}
});
</script>

<style>
.player > .player-main-switch-btn {
	position: absolute;
	top: -10px;
	left: 6px;
	height: 20px;
	padding: 0 7px;
	border-radius: 10px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	line-height: 20px;
	font-weight: 600;
	letter-spacing: 0.2px;
	color: #ffe8b3;
	background: rgba(120, 82, 24, 0.92);
	border: 1px solid rgba(255, 215, 130, 0.65);
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
	cursor: pointer;
	z-index: 7;
	white-space: nowrap;
	user-select: none;
	transition:
		transform 0.16s ease,
		box-shadow 0.16s ease,
		background 0.16s ease;
}

.player > .player-main-switch-btn.with-llm-badge {
	left: auto;
	right: 30px;
}

.player > .player-main-switch-btn:hover {
	transform: translateY(-1px);
	background: rgba(145, 100, 30, 0.96);
	box-shadow: 0 3px 10px rgba(255, 200, 90, 0.35);
}

.player.dead > .player-main-switch-btn {
	display: none;
}

#arena.oldlayout .player > .player-main-switch-btn {
	top: 2px;
}

.player.player-seat-gliding {
	transition:
		transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
		left 0.45s cubic-bezier(0.22, 1, 0.36, 1),
		top 0.45s cubic-bezier(0.22, 1, 0.36, 1),
		right 0.45s cubic-bezier(0.22, 1, 0.36, 1),
		bottom 0.45s cubic-bezier(0.22, 1, 0.36, 1) !important;
}

@keyframes player-main-switched-glow {
	0% {
		box-shadow: 0 0 0 0 rgba(255, 215, 130, 0.75);
	}
	50% {
		box-shadow: 0 0 20px 6px rgba(255, 215, 130, 0.55);
	}
	100% {
		box-shadow: 0 0 0 0 rgba(255, 215, 130, 0);
	}
}

.player.player-main-switched {
	animation: player-main-switched-glow 0.65s ease-out;
}
</style>
