<template>
	<div ref="containerRef">
		<!-- 编辑牌堆折叠按钮 -->
		<div
			class="config more pile"
			:class="{ on: expanded }"
			@click="toggleExpand"
		>
			编辑牌堆 <div>&gt;</div>
		</div>

		<!-- 操作栏 -->
		<div
			class="config pointerspan cardpilecfg toggle"
			:style="{ display: expanded ? '' : 'none', marginTop: '5px' }"
		>
			<button @click="onToggleAddPanel">添加卡牌</button>
			<button style="margin-left: 5px" @click="onBanAll">全部关闭</button>
			<button style="margin-left: 5px" @click="onEnableAll">全部开启</button>
		</div>

		<!-- 添加卡牌面板 -->
		<div
			v-if="showAddPanel"
			class="config toggle hidden cardpilecfg cardpilecfgadd"
			style="white-space: nowrap"
		>
			<select
				ref="addNameRef"
				style="width: 75px; margin-right: 2px; margin-left: -1px"
			></select>
			<select
				ref="addSuitRef"
				style="width: 53px; margin-right: 2px"
			></select>
			<select
				ref="addNumberRef"
				style="width: 43px; margin-right: 2px"
			></select>
			<button style="width: 40px" @click="onAddCard">确定</button>
		</div>

		<!-- 已添加卡牌列表 -->
		<div ref="addedCardsRef"></div>

		<!-- 默认牌堆卡牌列表 -->
		<div ref="defaultCardsRef"></div>

		<div class="menuplaceholder"></div>
	</div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
import { lib, game, get, ui } from "noname";

interface Props {
	mode: string;
}

const props = defineProps<Props>();

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

const containerRef = ref<HTMLDivElement>();
const addNameRef = ref<HTMLSelectElement>();
const addSuitRef = ref<HTMLSelectElement>();
const addNumberRef = ref<HTMLSelectElement>();
const addedCardsRef = ref<HTMLDivElement>();
const defaultCardsRef = ref<HTMLDivElement>();

const expanded = ref(false);
const showAddPanel = ref(false);

// ---------------------------------------------------------------------------
// recreatePile —— 对应旧版 17-22
// ---------------------------------------------------------------------------

function recreatePile() {
	// @ts-expect-error customcardpile 是运行时动态属性
	lib.config.customcardpile["当前牌堆"] = [
		// @ts-expect-error bannedpile 是运行时动态属性
		lib.config.bannedpile,
		// @ts-expect-error addedpile 是运行时动态属性
		lib.config.addedpile,
	];
	game.saveConfig("customcardpile", lib.config.customcardpile);
	game.saveConfig("cardpilename", "当前牌堆", true);
}

// ---------------------------------------------------------------------------
// toggleCardPile —— 对应旧版 147-159
// ---------------------------------------------------------------------------

function toggleCardPile(bool: boolean, modeName: string, number: number) {
	// @ts-expect-error bannedpile 是运行时动态属性
	if (!lib.config.bannedpile[modeName]) {
		// @ts-expect-error bannedpile 是运行时动态属性
		lib.config.bannedpile[modeName] = [];
	}
	if (bool) {
		// @ts-expect-error bannedpile 是运行时动态属性
		// @ts-expect-error Array.prototype.remove 是 noname 运行时扩展
		lib.config.bannedpile[modeName].remove(number);
	} else {
		// @ts-expect-error bannedpile 是运行时动态属性
		// @ts-expect-error Array.prototype.add 是 noname 运行时扩展
		lib.config.bannedpile[modeName].add(number);
	}
	recreatePile();
}

// ---------------------------------------------------------------------------
// 折叠/展开
// 对应旧版 330-343
// ---------------------------------------------------------------------------

function toggleExpand() {
	expanded.value = !expanded.value;
}

// ---------------------------------------------------------------------------
// 操作栏按钮
// 对应旧版 345-368
// ---------------------------------------------------------------------------

function onToggleAddPanel() {
	showAddPanel.value = !showAddPanel.value;
}

function onBanAll() {
	const container = defaultCardsRef.value;
	if (!container) return;
	const nodes = container.querySelectorAll(
		".config.toggle.on[type='defaultcards']",
	);
	nodes.forEach((node) => {
		node.classList.remove("on");
		// @ts-expect-error _number 是运行时挂在节点上的自定义属性
		const number = node._number;
		// @ts-expect-error _name 是运行时挂在节点上的自定义属性
		const name = node._name;
		toggleCardPile(false, name, number);
	});
}

function onEnableAll() {
	const container = defaultCardsRef.value;
	if (!container) return;
	const nodes = container.querySelectorAll(
		".config.toggle:not(.on)[type='defaultcards']",
	);
	nodes.forEach((node) => {
		node.classList.add("on");
		// @ts-expect-error _number 是运行时挂在节点上的自定义属性
		const number = node._number;
		// @ts-expect-error _name 是运行时挂在节点上的自定义属性
		const name = node._name;
		toggleCardPile(true, name, number);
	});
}

// ---------------------------------------------------------------------------
// 添加卡牌
// 对应旧版 371-438
// ---------------------------------------------------------------------------

function initAddSelectors() {
	const addNameEl = addNameRef.value;
	const addSuitEl = addSuitRef.value;
	const addNumberEl = addNumberRef.value;
	if (!addNameEl || !addSuitEl || !addNumberEl) return;

	// 构建卡牌名选择列表
	const pileaddlist: string[][] = [];
	// @ts-expect-error cards 是 Set/Array 类型扩展
	for (let i = 0; i < lib.config.cards.length; i++) {
		// @ts-expect-error cards 是索引访问的集合
		const packName = lib.config.cards[i];
		// @ts-expect-error lib.cardPack 是运行时对象
		if (!lib.cardPack[packName]) continue;
		// @ts-expect-error lib.cardPack 是运行时对象
		for (let j = 0; j < lib.cardPack[packName].length; j++) {
			// @ts-expect-error lib.cardPack 索引访问
			const cname = lib.cardPack[packName][j];
			pileaddlist.push([cname, get.translation(cname)]);
			if (cname === "sha") {
				pileaddlist.push(["huosha", "火杀"]);
				pileaddlist.push(["leisha", "雷杀"]);
				pileaddlist.push(["icesha", "冰杀"]);
				pileaddlist.push(["cisha", "刺杀"]);
			}
		}
	}

	ui.create.selectlist(pileaddlist, null, addNameEl);
	ui.create.selectlist(
		[
			["heart", "红桃"],
			["diamond", "方片"],
			["club", "梅花"],
			["spade", "黑桃"],
		],
		null,
		addSuitEl,
	);
	ui.create.selectlist(
		[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
		null,
		addNumberEl,
	);
}

function onAddCard() {
	const addSuitEl = addSuitRef.value;
	const addNumberEl = addNumberRef.value;
	const addNameEl = addNameRef.value;
	const addedContainer = addedCardsRef.value;
	const addPanel = containerRef.value?.querySelector(
		".cardpilecfgadd",
	) as HTMLElement | null;

	if (!addSuitEl || !addNumberEl || !addNameEl || !addedContainer || !addPanel) return;

	const card = [addSuitEl.value, addNumberEl.value, addNameEl.value];
	// @ts-expect-error addedpile 是运行时动态属性
	if (!lib.config.addedpile[props.mode]) {
		// @ts-expect-error addedpile 是运行时动态属性
		lib.config.addedpile[props.mode] = [];
	}
	// @ts-expect-error addedpile 是运行时动态属性
	lib.config.addedpile[props.mode].push(card);
	recreatePile();

	const cfgnode = ui.create.div(".config.toggle.cardpilecfg");
	// @ts-expect-error _info 是运行时挂在节点上的自定义属性
	cfgnode._info = card;
	cfgnode.innerHTML =
		get.translation(card[2]) +
		" " +
		get.translation(card[0]) +
		get.strNumber(card[1]);
	const cfgnodedelete = document.createElement("span");
	cfgnodedelete.classList.add("cardpiledelete");
	cfgnodedelete.innerHTML = "删除";
	cfgnodedelete.onclick = deleteAddedCardHandler;
	cfgnode.appendChild(cfgnodedelete);

	const refNode = addPanel.nextSibling;
	if (refNode) {
		addedContainer.insertBefore(cfgnode, refNode);
	} else {
		addedContainer.appendChild(cfgnode);
	}
}

// ---------------------------------------------------------------------------
// 删除已添加卡牌
// 对应旧版 410-421
// 注意：旧版 deletecard 也有 bug（remove 后读 _info），
// Vue 版修正为 remove 前保存 _info。
// ---------------------------------------------------------------------------

function deleteAddedCardHandler(this: HTMLElement) {
	const node = this.parentNode as HTMLElement;
	// @ts-expect-error _info 是运行时挂在节点上的自定义属性
	const info = node._info;
	node.remove();
	// @ts-expect-error addedpile 是运行时动态属性
	const list = lib.config.addedpile[props.mode];
	if (!list) return;
	for (let i = 0; i < list.length; i++) {
		if (list[i][0] === info[0] && list[i][1] === info[1] && list[i][2] === info[2]) {
			list.splice(i, 1);
			break;
		}
	}
	recreatePile();
}

// ---------------------------------------------------------------------------
// 初始化已添加卡牌列表
// 对应旧版 440-453
// ---------------------------------------------------------------------------

function renderAddedCards() {
	const container = addedCardsRef.value;
	if (!container) return;

	container.innerHTML = "";
	// @ts-expect-error bannedpile 是运行时动态属性
	if (!lib.config.bannedpile[props.mode]) {
		// @ts-expect-error bannedpile 是运行时动态属性
		lib.config.bannedpile[props.mode] = [];
	}
	// @ts-expect-error addedpile 是运行时动态属性
	if (!lib.config.addedpile[props.mode]) {
		// @ts-expect-error addedpile 是运行时动态属性
		lib.config.addedpile[props.mode] = [];
	}

	// @ts-expect-error addedpile 是运行时动态属性
	for (let i = 0; i < lib.config.addedpile[props.mode].length; i++) {
		// @ts-expect-error addedpile 是运行时动态属性
		const card = lib.config.addedpile[props.mode][i];
		const cfgnode = ui.create.div(".config.toggle.cardpilecfg");
		// @ts-expect-error _info 是运行时挂在节点上的自定义属性
		cfgnode._info = card;
		cfgnode.innerHTML =
			(card[2] === "sha" && card[3] ? get.translation(card[3]) : "") +
			get.translation(card[2]) +
			" " +
			get.translation(card[0]) +
			card[1];
		const cfgnodedelete = document.createElement("span");
		cfgnodedelete.classList.add("cardpiledelete");
		cfgnodedelete.innerHTML = "删除";
		cfgnodedelete.onclick = deleteAddedCardHandler;
		cfgnode.appendChild(cfgnodedelete);
		container.appendChild(cfgnode);
	}
}

// ---------------------------------------------------------------------------
// 初始化默认牌堆卡牌列表
// 对应旧版 455-469
// ---------------------------------------------------------------------------

function renderDefaultCards() {
	const container = defaultCardsRef.value;
	if (!container) return;

	container.innerHTML = "";
	// @ts-expect-error lib.cardPile 是运行时对象
	const pile = lib.cardPile[props.mode];
	if (!pile) return;

	for (let i = 0; i < pile.length; i++) {
		const card = pile[i];
		const cfgnode = ui.create.div(".config.toggle.cardpilecfg");
		cfgnode.setAttribute("type", "defaultcards");
		cfgnode.classList.add("cardpilecfg");
		// @ts-expect-error _number 是运行时挂在节点上的自定义属性
		cfgnode._number = i;
		// @ts-expect-error _name 是运行时挂在节点上的自定义属性
		cfgnode._name = props.mode;
		cfgnode.innerHTML =
			(card[2] === "sha" && card[3] ? get.translation(card[3]) : "") +
			get.translation(card[2]) +
			" " +
			get.translation(card[0]) +
			get.strNumber(card[1]);

		// @ts-expect-error bannedpile 是运行时动态属性
		const isBanned = lib.config.bannedpile[props.mode]?.includes(i);
		if (isBanned) {
			cfgnode.classList.remove("on");
		} else {
			cfgnode.classList.add("on");
		}

		// 点击 toggle
		// @ts-expect-error 闭包捕获 i
		cfgnode.addEventListener("click", function () {
			this.classList.toggle("on");
			// @ts-expect-error _number / _name 是运行时属性
			const isOn = this.classList.contains("on");
			toggleCardPile(
				isOn,
				// @ts-expect-error _name 是运行时挂在节点上的自定义属性
				this._name,
				// @ts-expect-error _number 是运行时挂在节点上的自定义属性
				this._number,
			);
		});

		container.appendChild(cfgnode);
	}
}

// ---------------------------------------------------------------------------
// mounted
// ---------------------------------------------------------------------------

onMounted(() => {
	nextTick(() => {
		renderAddedCards();
		renderDefaultCards();
		initAddSelectors();
	});
});

// 监听 mode 变化重新渲染
watch(
	() => props.mode,
	() => {
		expanded.value = false;
		showAddPanel.value = false;
		nextTick(() => {
			renderAddedCards();
			renderDefaultCards();
			initAddSelectors();
		});
	},
);
</script>

<style>
.cardpiledelete {
	position: absolute;
	right: 5px;
	top: 50%;
	transform: translateY(-50%);
	color: #aaa;
	cursor: pointer;
	font-size: 12px;
}
.cardpiledelete:hover {
	color: #f44;
}
</style>
