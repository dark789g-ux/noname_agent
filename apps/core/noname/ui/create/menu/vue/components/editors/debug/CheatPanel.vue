<template>
	<div class="menu-sym">
		<!-- 操作按钮行 row1 -->
		<div class="menu-cheat" :style="{ display: hasPlayers ? '' : 'none' }">
			<div
				v-for="action in actions"
				:key="action.label"
				class="menubutton"
				:class="{
					selectedx: currentAction === action.label,
					unselectable: action.disabled,
				}"
				@click="onClickRow1(action)"
			>
				{{ action.label }}
			</div>
		</div>

		<!-- 数量按钮行 row2 -->
		<div class="menu-cheat" :style="{ display: hasPlayers ? '' : 'none' }">
			<div
				v-for="num in numbers"
				:key="num"
				class="menubutton"
				:class="{
					selectedx: currentNum === num,
					unselectable: isRow2Disabled,
				}"
				@click="onClickRow2(num)"
			>
				{{ numLabel(num) }}
			</div>
		</div>

		<!-- 玩家按钮网格 row3（声明式 v-for + v-char-bg，保持 buttonPresets.player DOM 契约） -->
		<div
			class="menu-buttons leftbutton commandbutton"
			:style="{ display: hasPlayers ? '' : 'none', marginTop: '3px' }"
		>
			<div
				v-for="(item, idx) in playerItems"
				v-show="currentAction === '复活' ? item.isDead : !item.isDead"
				:key="idx"
				v-char-bg:character="item.isCardBg ? undefined : item.bgName"
				class="button character"
				:class="{
					cardbg: item.isCardBg,
					glow: selectedTargets.has(item.player),
					unselectable: isPlayerUnselectable(item),
				}"
				@click.stop="onClickPlayer(item)"
			>
				<div v-if="item.isCardBg" class="avatar_name">{{ item.seatLabel }}</div>
				<div class="name"></div>
				<div class="intro"></div>
			</div>
		</div>

		<!-- 浮动按钮："作" -->
		<div
			class="menubutton round highlight cheat-float-btn"
			:class="{ glowing: canExecute }"
			@click="executeCheat"
		>
			作
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { _status, game, get, lib, ui } from "noname";
import { menuUpdates } from "../../../menuState";
import { vCharBg } from "../shared/vCharBg.js";

interface CheatPlayerItem {
	player: any;
	isDead: boolean;
	isCardBg: boolean;
	seatLabel: string;
	bgName: string;
}

const emit = defineEmits<{
	(e: "cheat-executed"): void;
}>();

const currentAction = ref<string | null>(null);
const currentNum = ref<number | null>(null);
const selectedTargets = ref<Set<any>>(new Set());
const playerItems = ref<CheatPlayerItem[]>([]);
const hasPlayers = ref(false);

const actionLabels = ["伤害", "回复", "摸牌", "弃牌", "横置", "翻面", "复活", "换人"] as const;
const actions = ref<Array<{ label: string; disabled: boolean }>>(
	actionLabels.map(label => ({ label, disabled: false }))
);
const numbers = [1, 2, 3, 4, 5];

function numLabel(n: number): string {
	return ["一", "二", "三", "四", "五"][n - 1];
}

function norow2(): boolean {
	return (
		currentAction.value === "横置" ||
		currentAction.value === "翻面" ||
		currentAction.value === "换人" ||
		currentAction.value === "复活"
	);
}

const isRow2Disabled = computed(() => norow2());
const canExecute = computed(
	() => currentAction.value !== null && (currentNum.value !== null || norow2()) && selectedTargets.value.size > 0
);

function isPlayerUnselectable(item: CheatPlayerItem): boolean {
	return currentAction.value === "换人" && item.player === game.me;
}

function onClickRow1(action: { label: string; disabled: boolean }) {
	if (action.disabled) return;
	currentAction.value = currentAction.value === action.label ? null : action.label;
	if (currentAction.value === "换人") {
		selectedTargets.value = new Set();
	}
}

function onClickRow2(num: number) {
	if (isRow2Disabled.value) return;
	currentNum.value = currentNum.value === num ? null : num;
}

function onClickPlayer(item: CheatPlayerItem) {
	if (isPlayerUnselectable(item)) return;
	const player = item.player;
	const next = new Set(selectedTargets.value);
	if (currentAction.value === "换人") {
		if (player === game.me) return;
		next.clear();
		next.add(player);
	} else if (next.has(player)) {
		next.delete(player);
	} else {
		next.add(player);
	}
	selectedTargets.value = next;
}

function executeCheat() {
	if (!canExecute.value || !currentAction.value) return;
	const num = currentNum.value;
	for (const target of Array.from(selectedTargets.value)) {
		switch (currentAction.value) {
			case "伤害":
				target.damage(num, "nosource");
				break;
			case "回复":
				target.recover(num, "nosource");
				break;
			case "摸牌":
				target.draw(num);
				break;
			case "弃牌":
				target.discard(target.getCards("he").randomGets(num));
				break;
			case "横置":
				target.link();
				break;
			case "翻面":
				target.turnOver();
				break;
			case "复活":
				target.revive(target.maxHp);
				break;
			case "换人": {
				// @ts-expect-error isMine 是运行时方法
				if (_status.event.isMine()) {
					if (!ui.auto.classList.contains("hidden")) {
						setTimeout(() => {
							ui.click.auto();
							setTimeout(() => {
								ui.click.auto();
								game.swapPlayer(target);
							}, 500);
						});
					}
				} else {
					game.swapPlayer(target);
				}
				break;
			}
		}
	}
	if (ui.coin) game.changeCoin(-20);
	emit("cheat-executed");
}

function toCheatPlayerItem(player: any, isDead: boolean): CheatPlayerItem {
	const isUnknown = Boolean(player.name && player.name.startsWith("unknown"));
	const isCardBg = isUnknown && Boolean(player.node?.name_seat);
	return {
		player,
		isDead,
		isCardBg,
		seatLabel: isCardBg ? get.translation(player.name) : "",
		bgName: isUnknown ? player.name1 : player.name,
	};
}

function updateReplaceActionDisabled() {
	const replaceIdx = actionLabels.indexOf("换人");
	if (replaceIdx < 0) return;
	// @ts-expect-error canReplaceViewpoint 是运行时方法
	if (!game.canReplaceViewpoint || !game.canReplaceViewpoint()) {
		actions.value[replaceIdx].disabled = true;
		return;
	}
	if (lib.config.mode === "identity" || lib.config.mode === "guozhan" || lib.config.mode === "doudizhu") {
		const hasSwapLock =
			game.notMe ||
			(game.me && (game.me._trueMe || game.hasPlayer((c: any) => c._trueMe == game.me))) ||
			!game.phaseNumber ||
			_status.qianlidanji;
		// @ts-expect-error isMine 是运行时方法
		const isHiddenAutoMine = _status.event.isMine() && ui.auto.classList.contains("hidden");
		actions.value[replaceIdx].disabled = Boolean(hasSwapLock || isHiddenAutoMine);
	}
}

function refreshPlayerList() {
	if (_status.video || _status.connectMode) {
		hasPlayers.value = false;
		playerItems.value = [];
		return;
	}

	const items: CheatPlayerItem[] = [];
	for (const p of game.players) {
		if (lib.character[p.name] || p.name1) items.push(toCheatPlayerItem(p, false));
	}
	for (const p of game.dead) {
		if (lib.character[p.name] || p.name1) items.push(toCheatPlayerItem(p, true));
	}

	playerItems.value = items;
	hasPlayers.value = items.length > 0;
	if (!items.length) return;

	updateReplaceActionDisabled();
	const reviveIdx = actionLabels.indexOf("复活");
	if (reviveIdx >= 0) {
		actions.value[reviveIdx].disabled = game.dead.length === 0;
	}
}

watch(currentAction, next => {
	if (next !== "复活") return;
	selectedTargets.value = new Set(Array.from(selectedTargets.value).filter(t => game.dead.includes(t)));
});

onMounted(() => {
	menuUpdates.push(refreshPlayerList);
	refreshPlayerList();
});

onUnmounted(() => {
	const idx = menuUpdates.indexOf(refreshPlayerList);
	if (idx >= 0) menuUpdates.splice(idx, 1);
});
</script>
