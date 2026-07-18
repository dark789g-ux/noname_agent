<template>
	<div class="menu-sym">
		<!-- 操作按钮行 row1 -->
		<div class="menu-cheat" ref="row1Ref" :style="{ display: hasPlayers ? '' : 'none' }">
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
		<div class="menu-cheat" ref="row2Ref" :style="{ display: hasPlayers ? '' : 'none' }">
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

		<!-- 玩家按钮网格 row3 -->
		<div
			class="menu-buttons leftbutton commandbutton"
			ref="row3Ref"
			:style="{ display: hasPlayers ? '' : 'none', marginTop: '3px' }"
		></div>

		<!-- 浮动按钮："作"（对应旧版 cheatButton） -->
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
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { ui, game, get, lib, _status } from "noname";
import { menuUpdates } from "../../menuState";

// ---------------------------------------------------------------------------
// 状态
// 对应旧版闭包变量 currentrow1 / currentrow2 / buttons[i].glow / buttons[i].dead
// ---------------------------------------------------------------------------
const currentAction = ref<string | null>(null);
const currentNum = ref<number | null>(null);
const selectedTargets = ref<Set<any>>(new Set());
const hasPlayers = ref(false);
const row1Ref = ref<HTMLDivElement>();
const row2Ref = ref<HTMLDivElement>();
const row3Ref = ref<HTMLDivElement>();

// ---------------------------------------------------------------------------
// 操作按钮定义
// 对应旧版 row1: 伤害/回复/摸牌/弃牌/横置/翻面/复活/换人
// ---------------------------------------------------------------------------
const actionLabels = ["伤害", "回复", "摸牌", "弃牌", "横置", "翻面", "复活", "换人"] as const;

const actions = ref<
	Array<{ label: string; disabled: boolean }>
>(
	actionLabels.map(label => ({
		label,
		disabled: false,
	})),
);

const numbers = [1, 2, 3, 4, 5];

function numLabel(n: number): string {
	return ["一", "二", "三", "四", "五"][n - 1];
}

// ---------------------------------------------------------------------------
// norow2 / checkCheat
// 对应旧版 118-168
// ---------------------------------------------------------------------------

/**
 * 判断当前操作是否不需要 row2（横置/翻面/换人/复活）
 * 对应旧版 norow2()
 */
function norow2(): boolean {
	if (!currentAction.value) return false;
	return (
		currentAction.value === "横置" ||
		currentAction.value === "翻面" ||
		currentAction.value === "换人" ||
		currentAction.value === "复活"
	);
}

/**
 * 是否禁用 row2（所有数量按钮）
 */
const isRow2Disabled = computed(() => norow2());

/**
 * 综合判断是否可以执行作弊
 * 对应旧版 checkCheat()
 */
const canExecute = computed(() => {
	return currentAction.value !== null && (currentNum.value !== null || norow2()) && selectedTargets.value.size > 0;
});

// ---------------------------------------------------------------------------
// 点击处理
// 对应旧版 clickrow1 / clickrow2 / clickrow3
// ---------------------------------------------------------------------------

function onClickRow1(action: { label: string; disabled: boolean }) {
	if (action.disabled) return;
	if (currentAction.value === action.label) {
		currentAction.value = null;
	} else {
		currentAction.value = action.label;
	}
	// 切换到"换人"时清空已选目标
	if (currentAction.value === "换人") {
		selectedTargets.value.clear();
	}
}

function onClickRow2(num: number) {
	if (isRow2Disabled.value) return;
	if (currentNum.value === num) {
		currentNum.value = null;
	} else {
		currentNum.value = num;
	}
}

function togglePlayerTarget(player: any, buttonEl: HTMLElement) {
	if (currentAction.value === "换人") {
		// 换人：不能选自己，且只能单选
		if (player === game.me) return;
		selectedTargets.value.clear();
		selectedTargets.value.add(player);
	} else {
		// 多选切换
		if (selectedTargets.value.has(player)) {
			selectedTargets.value.delete(player);
		} else {
			selectedTargets.value.add(player);
		}
	}
	// 触发响应式更新
	selectedTargets.value = new Set(selectedTargets.value);
}

// ---------------------------------------------------------------------------
// 执行作弊
// 对应旧版 cheatButton.listen（169-243）
// ---------------------------------------------------------------------------
const emit = defineEmits<{
	(e: "cheat-executed"): void;
}>();

function executeCheat() {
	if (!canExecute.value || !currentAction.value) return;

	const num = currentNum.value;
	const targets = Array.from(selectedTargets.value);

	for (const target of targets) {
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

	// 扣除金币（旧版 238-240）
	if (ui.coin) {
		game.changeCoin(-20);
	}

	emit("cheat-executed");
}

// ---------------------------------------------------------------------------
// 刷新玩家列表
// 对应旧版 menuUpdates.push（329-398）
// ---------------------------------------------------------------------------
function refreshPlayerList() {
	// 录像/联机模式下隐藏控制页（旧版 330-346）
	if (_status.video || _status.connectMode) {
		hasPlayers.value = false;
		return;
	}

	// 收集玩家列表（旧版 347-357）
	const list: any[] = [];
	for (let i = 0; i < game.players.length; i++) {
		if (lib.character[game.players[i].name] || game.players[i].name1) {
			list.push(game.players[i]);
		}
	}
	for (let i = 0; i < game.dead.length; i++) {
		if (lib.character[game.dead[i].name] || game.dead[i].name1) {
			list.push(game.dead[i]);
		}
	}

	if (list.length === 0) {
		hasPlayers.value = false;
		return;
	}

	hasPlayers.value = true;

	// 用 ui.create.buttons 重建玩家按钮（旧版 361-368）
	if (row3Ref.value) {
		row3Ref.value.innerHTML = "";
		const buttons = ui.create.buttons(list, "player", row3Ref.value, true);
		for (let i = 0; i < buttons.length; i++) {
			const button = buttons[i] as HTMLElement & { link: any; dead?: boolean };
			// 标记死亡玩家
			if (game.dead.includes(button.link)) {
				button.dead = true;
			}
			// 绑定点击事件（旧版 clickrow3 312-328）
			button.addEventListener("click", function (e: Event) {
				e.stopPropagation();
				// 复制旧版 clickrow3 的 DOM class 逻辑
				const el = this as HTMLElement & { link: any; dead?: boolean };
				if (el.classList.contains("unselectable")) return;
				togglePlayerTarget(el.link, el);
			});
		}
	}

	// 更新操作按钮的 unselectable 状态
	// 换人（旧版 374-391）
	const replaceIdx = actionLabels.indexOf("换人");
	if (replaceIdx >= 0) {
		// 旧版 282-284：canReplaceViewpoint 检查
		// @ts-expect-error canReplaceViewpoint 是运行时方法
		if (!game.canReplaceViewpoint || !game.canReplaceViewpoint()) {
			actions.value[replaceIdx].disabled = true;
		} else if (
			lib.config.mode == "identity" ||
			lib.config.mode == "guozhan" ||
			lib.config.mode == "doudizhu"
		) {
			if (
				game.notMe ||
				(game.me &&
					(game.me._trueMe ||
						game.hasPlayer(function (current: any) {
							return current._trueMe == game.me;
						}))) ||
				!game.phaseNumber ||
				_status.qianlidanji
			) {
				actions.value[replaceIdx].disabled = true;
			} else if (
				// @ts-expect-error isMine 是运行时方法
				_status.event.isMine() &&
				ui.auto.classList.contains("hidden")
			) {
				actions.value[replaceIdx].disabled = true;
			} else {
				actions.value[replaceIdx].disabled = false;
			}
		}
	}

	// 复活（旧版 392-396）
	const reviveIdx = actionLabels.indexOf("复活");
	if (reviveIdx >= 0) {
		actions.value[reviveIdx].disabled = game.dead.length === 0;
	}
}

// ---------------------------------------------------------------------------
// 监听 currentAction / selectedTargets 以更新玩家按钮的 DOM class
// 对应旧版 checkCheat 中的 row3 遍历
// ---------------------------------------------------------------------------
watch([currentAction, selectedTargets], () => {
	if (!row3Ref.value) return;
	const children = row3Ref.value.children;
	for (let i = 0; i < children.length; i++) {
		const el = children[i] as HTMLElement & { link: any; dead?: boolean };
		if (!el.link) continue;

		// 根据当前操作过滤可显示/可选的玩家
		if (currentAction.value === "复活") {
			// 只显示死亡玩家
			el.style.display = el.dead ? "" : "none";
			el.classList.remove("glow");
			el.classList.remove("unselectable");
		} else {
			// 只显示存活玩家
			el.style.display = el.dead ? "none" : "";
			el.classList.remove("unselectable");

			// 换人时不能选自己
			if (currentAction.value === "换人" && el.link === game.me) {
				el.classList.add("unselectable");
			}
		}

		// 更新 glow 状态
		if (selectedTargets.value.has(el.link)) {
			el.classList.add("glow");
		} else {
			el.classList.remove("glow");
		}
	}

	// 复活模式时刷新 selectedTargets，只保留死亡玩家
	if (currentAction.value === "复活") {
		const newTargets = new Set<any>();
		for (const t of selectedTargets.value) {
			if (game.dead.includes(t)) {
				newTargets.add(t);
			}
		}
		selectedTargets.value = newTargets;
	}
});

// ---------------------------------------------------------------------------
// menuUpdates 注册 / 注销
// ---------------------------------------------------------------------------
onMounted(() => {
	menuUpdates.push(refreshPlayerList);
	// 初次刷新
	refreshPlayerList();
});

onUnmounted(() => {
	const idx = menuUpdates.indexOf(refreshPlayerList);
	if (idx >= 0) menuUpdates.splice(idx, 1);
});
</script>
