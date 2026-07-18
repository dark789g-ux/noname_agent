<template>
	<!-- fragment（多根）：cardpile 模式下 CardPackPane 仅渲染本组件，以下节点渲染后
	     即其根 .menu-buttons.leftbutton 的直接子代，与旧版 cardpile page 全部直挂 page
	     的 DOM 等价。引擎 CSS 复位均为直接子代选择器（.menu-buttons > .toggle、
	     .right.pane > div > .config、.right.pane > div > .config.indent 等），
	     原 .menu-buttons.cardpile-manager 包裹层会让保存面板 absolute 脱流、各行丢失
	     margin 复位，故删除（与 CardPileEditor 同法）。 -->
	<!-- 选择牌堆 -->
	<div ref="pileChooseRef" class="config toggle cardpilecfg nomarginleft">
		选择牌堆
	</div>

	<!-- 各自定义牌堆节点（命令式创建，直插父组件根节点、以 restartRef 为锚点，
	     与旧版 page.insertBefore(node, restart) 一致；不得用无 class 包裹层，
	     否则 absolute 脱流与下方行互叠） -->

	<!-- 重新启动（兼作动态牌堆节点的插入锚点） -->
	<div
		ref="restartRef"
		class="config more"
		:style="{ display: showRestart ? '' : 'none' }"
		@click="game.reload"
	>
		重新启动
	</div>

	<!-- 保存当前牌堆 -->
	<div
		class="config more"
		:class="{ on: saveExpanded }"
		@click="toggleSaveExpanded"
	>
		保存当前牌堆 <div>&gt;</div>
	</div>

	<!-- 保存面板（直挂后命中 .right.pane > div > .config 与 .config.indent 复位，与旧版一致） -->
	<div
		v-if="saveExpanded"
		class="config cardpileadd indent"
	>
		名称：<input
			v-model="saveName"
			type="text"
			style="margin-right: 3px; width: 120px"
		/><button @click="onSavePile">确定</button>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { lib, game, get, ui } from "noname";

// CardPileManager 仅在非联机模式下渲染（由 CardPackPane 的 mode==="cardpile" 控制）

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

const pileChooseRef = ref<HTMLDivElement>();
const restartRef = ref<HTMLDivElement>();

/** 命令式创建的牌堆节点（直挂父组件根节点，卸载时手动清理） */
const pileNodes: HTMLElement[] = [];

const showRestart = ref(false);
const saveExpanded = ref(false);
const saveName = ref("自定义牌堆");

/** 是否已创建（避免重复创建） */
let pileCreated = false;

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
	pileCreated = false;
}

// ---------------------------------------------------------------------------
// createList —— 构建牌堆选择列表
// 对应旧版 541-565
// ---------------------------------------------------------------------------

function createList() {
	const chooseEl = pileChooseRef.value;
	if (!chooseEl) return;

	// 清除旧 selectlist
	const oldSelect = chooseEl.querySelector("select");
	if (oldSelect) oldSelect.remove();

	const list: string[] = ["默认牌堆"];
	// @ts-expect-error customcardpile 是运行时动态属性
	if (lib.config.customcardpile["当前牌堆"]) {
		list.push("当前牌堆");
	}
	// @ts-expect-error customcardpile 是运行时动态属性
	for (const key in lib.config.customcardpile) {
		// @ts-expect-error Array.prototype.add 是 noname 运行时扩展
		list.add(key);
	}

	let currentpile: string = get.config("cardpilename");
	if (!currentpile) {
		if (list.includes("当前牌堆")) {
			currentpile = "当前牌堆";
		} else {
			currentpile = "默认牌堆";
		}
	}

	// 命令式创建 selectlist（旧版 ui.create.selectlist）
	const pileList = ui.create.selectlist(
		list,
		currentpile,
		() => {
			// pileChoose callback（空）
		},
		function (this: HTMLSelectElement) {
			game.saveConfig("cardpilename", this.value, true);
			showRestart.value = true;
		},
	);

	pileList.style.float = "right";
	pileList.style.width = "100px";
	chooseEl.appendChild(pileList);
}

// ---------------------------------------------------------------------------
// pileDel —— 删除自定义牌堆
// 对应旧版 569-582
// ---------------------------------------------------------------------------

function pileDel(this: HTMLElement) {
	const node = this.parentNode as HTMLElement;
	// @ts-expect-error link 是运行时挂在节点上的自定义属性
	const name = node.link;
	// @ts-expect-error customcardpile 是运行时动态属性
	delete lib.config.customcardpile[name];
	node.remove();
	const pileIndex = pileNodes.indexOf(node);
	if (pileIndex > -1) {
		pileNodes.splice(pileIndex, 1);
	}
	game.saveConfig("customcardpile", lib.config.customcardpile);
	// @ts-expect-error mode_config 是运行时动态属性
	for (const i in lib.config.mode_config) {
		if (i === "global") continue;
		// @ts-expect-error mode_config 子属性是运行时动态属性
		if (lib.config.mode_config[i].cardpilename === name) {
			game.saveConfig("cardpilename", null, i);
		}
	}
	createList();
}

// ---------------------------------------------------------------------------
// createPileNode —— 创建单个牌堆节点
// 对应旧版 586-599
// ---------------------------------------------------------------------------

function createPileNode(name: string) {
	const chooseEl = pileChooseRef.value;
	const restartEl = restartRef.value;
	// fragment 下锚点的父元素即 CardPackPane 根 .menu-buttons.leftbutton
	const parent = restartEl?.parentElement;
	if (!chooseEl || !restartEl || !parent) return;

	const node = ui.create.div(".config.toggle.cardpilecfg.nomarginleft", name);
	// @ts-expect-error link 是运行时挂在节点上的自定义属性
	node.link = name;

	const del = document.createElement("span");
	del.innerHTML = "删除";
	del.classList.add("cardpiledelete");
	del.onclick = pileDel;
	node.appendChild(del);

	pileNodes.push(node);
	if (name === "当前牌堆") {
		chooseEl.insertAdjacentElement("afterend", node);
	} else {
		parent.insertBefore(node, restartEl);
	}
}

// ---------------------------------------------------------------------------
// onSavePile —— 保存当前牌堆
// 对应旧版 619-646
// ---------------------------------------------------------------------------

function onSavePile() {
	let name = saveName.value;
	// @ts-expect-error customcardpile 是运行时动态属性
	if (lib.config.customcardpile[name] || name === "默认牌堆" || name === "当前牌堆") {
		for (let i = 1; i <= 1000; i++) {
			const candidate = name + "(" + i + ")";
			// @ts-expect-error customcardpile 是运行时动态属性
			if (!lib.config.customcardpile[candidate]) {
				name = candidate;
				break;
			}
		}
	}
	// @ts-expect-error customcardpile 是运行时动态属性
	lib.config.customcardpile[name] = [
		// @ts-expect-error bannedpile 是运行时动态属性
		lib.config.bannedpile,
		// @ts-expect-error addedpile 是运行时动态属性
		lib.config.addedpile,
	];
	// @ts-expect-error customcardpile 是运行时动态属性
	delete lib.config.customcardpile["当前牌堆"];

	// @ts-expect-error lib.mode 是运行时全局对象
	for (const i in lib.mode) {
		// @ts-expect-error mode_config 是运行时动态属性
		if (
			lib.config.mode_config[i] &&
			// @ts-expect-error mode_config 子属性是运行时动态属性
			(lib.config.mode_config[i].cardpilename === "当前牌堆" ||
				// @ts-expect-error mode_config 子属性是运行时动态属性
				!lib.config.mode_config[i].cardpilename)
		) {
			game.saveConfig("cardpilename", name, i);
		}
	}

	// 移除旧的"当前牌堆"节点（直接查 pileNodes 跟踪数组，不做 DOM 范围查询，
	// 避免与 CardPileEditor 的 .config.toggle.cardpilecfg 行 class 相近而误选）
	for (let i = 0; i < pileNodes.length; i++) {
		// @ts-expect-error link 是运行时挂在节点上的自定义属性
		if (pileNodes[i].link === "当前牌堆") {
			const removed = pileNodes[i];
			removed.remove();
			pileNodes.splice(i, 1);
			break;
		}
	}

	game.saveConfig("customcardpile", lib.config.customcardpile);
	createPileNode(name);
	createList();
}

// ---------------------------------------------------------------------------
// toggleSaveExpanded
// ---------------------------------------------------------------------------

function toggleSaveExpanded() {
	saveExpanded.value = !saveExpanded.value;
}

// ---------------------------------------------------------------------------
// mounted —— 初始化牌堆管理 UI
// 对应旧版 534-647（node.create）
// ---------------------------------------------------------------------------

onMounted(() => {
	if (pileCreated) return;
	pileCreated = true;

	// 初始化 bannedpile / addedpile（确保存在）
	// @ts-expect-error bannedpile 是运行时动态属性
	if (!lib.config.bannedpile) {
		// @ts-expect-error bannedpile 是运行时动态属性
		lib.config.bannedpile = [];
	}
	// @ts-expect-error addedpile 是运行时动态属性
	if (!lib.config.addedpile) {
		// @ts-expect-error addedpile 是运行时动态属性
		lib.config.addedpile = [];
	}

	// 创建牌堆选择列表
	createList();

	// 创建各自定义牌堆节点
	// @ts-expect-error customcardpile 是运行时动态属性
	for (const key in lib.config.customcardpile) {
		createPileNode(key);
	}
});

// 动态牌堆节点命令式插在父组件根节点里，Vue 卸载 fragment 时只清理模板节点，
// 不会代为清理这些行，必须手动清理防泄漏（与 CardPileEditor 同法）
onBeforeUnmount(() => {
	for (let i = 0; i < pileNodes.length; i++) {
		pileNodes[i].remove();
	}
	pileNodes.length = 0;
});
</script>
