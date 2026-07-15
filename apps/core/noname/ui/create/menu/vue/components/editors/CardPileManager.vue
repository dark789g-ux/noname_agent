<template>
	<div ref="containerRef" class="menu-buttons cardpile-manager">
		<!-- 选择牌堆 -->
		<div ref="pileChooseRef" class="config toggle cardpilecfg nomarginleft">
			选择牌堆
		</div>

		<!-- 各自定义牌堆节点（动态插入） -->
		<div ref="pileListContainer"></div>

		<!-- 重新启动 -->
		<div
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

		<!-- 保存面板 -->
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
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { lib, game, get, ui } from "noname";

// CardPileManager 仅在非联机模式下渲染（由 CardPackPane 的 mode==="cardpile" 控制）

// ---------------------------------------------------------------------------
// 状态
// ---------------------------------------------------------------------------

const containerRef = ref<HTMLDivElement>();
const pileChooseRef = ref<HTMLDivElement>();
const pileListContainer = ref<HTMLDivElement>();

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
	// @ts-expect-error link 是运行时挂在节点上的自定义属性
	const name = this.parentNode.link;
	// @ts-expect-error customcardpile 是运行时动态属性
	delete lib.config.customcardpile[name];
	this.parentNode.remove();
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
	const listContainer = pileListContainer.value;
	const chooseEl = pileChooseRef.value;
	if (!listContainer || !chooseEl) return;

	const node = ui.create.div(".config.toggle.cardpilecfg.nomarginleft", name);
	// @ts-expect-error link 是运行时挂在节点上的自定义属性
	node.link = name;

	const del = document.createElement("span");
	del.innerHTML = "删除";
	del.classList.add("cardpiledelete");
	del.onclick = pileDel;
	node.appendChild(del);

	if (name === "当前牌堆") {
		chooseEl.insertAdjacentElement("afterend", node);
	} else {
		listContainer.appendChild(node);
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

	// 移除旧的"当前牌堆"节点
	const container = containerRef.value;
	if (container) {
		for (let i = 0; i < container.childElementCount; i++) {
			// @ts-expect-error link 是运行时挂在节点上的自定义属性
			if (container.childNodes[i].link === "当前牌堆") {
				container.childNodes[i].remove();
				break;
			}
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
</script>

<style>
.cardpile-manager .config.cardpilecfg.nomarginleft {
	position: relative;
}
.cardpile-manager .cardpiledelete {
	position: absolute;
	right: 5px;
	top: 50%;
	transform: translateY(-50%);
	color: #aaa;
	cursor: pointer;
	font-size: 12px;
}
.cardpile-manager .cardpiledelete:hover {
	color: #f44;
}
</style>
