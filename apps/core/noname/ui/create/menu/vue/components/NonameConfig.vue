<template>
	<!-- clear 形态 -->
	<div
		v-if="isClear"
		v-show="isVisible"
		ref="configNodeRef"
		class="config"
		:class="{ pointerspan: !config.nopointer }"
		:style="clearStyle"
		@click="handleClearClick"
	>
		<span>{{ config.name }}</span>
	</div>

	<!-- Array.isArray(init) 的非交互 switcher 外观（旧版 void 0 分支） -->
	<div v-else-if="isArrayInitSwitcher" v-show="isVisible" class="config">
		<span>{{ config.name }}</span>
	</div>

	<!-- switcher 形态（item 且非 Array.isArray(init)） -->
	<div
		v-else-if="isSwitcher"
		v-show="isVisible"
		ref="configNodeRef"
		class="config switcher"
		@click="handleSwitcherClick"
	>
		<span>{{ config.name }}</span>
		<div class="config-choosing">{{ choosingText }}</div>
	</div>

	<!-- range 形态（旧版 void 0 空分支，仅显示名称，无交互） -->
	<div
		v-else-if="isRange"
		v-show="isVisible"
		class="config"
	>
		<span>{{ config.name }}</span>
	</div>

	<!-- input 形态 -->
	<div
		v-else-if="isInput"
		v-show="isVisible"
		ref="configNodeRef"
		class="config switcher"
	>
		<span>{{ config.name }}</span>
		<div
			ref="inputRef"
			:contenteditable="!config.fixed ? 'true' : undefined"
			:data-placeholder="config.name"
			class="config-input"
			@keydown="handleInputKeydown"
		></div>
	</div>

	<!-- toggle 形态（默认） -->
	<div
		v-else
		v-show="isVisible"
		ref="configNodeRef"
		class="config toggle"
		:class="{ on: isToggleOn }"
		@click="handleToggleClick"
	>
		<span>{{ config.name }}</span>
		<NonameToggle />
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, toRaw, watch } from "vue";
import { _status, game, get, lib, ui } from "noname";
import type { SelectConfigData } from "./../../../../../../typings/type";
import { doToggle, doMenuItem } from "../utils/configInteract";
import { openPopup, closePopup, setNoclose } from "../utils/popupHost";
import NonameToggle from "./NonameToggle.vue";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
	config: SelectConfigData;
}

const props = defineProps<Props>();

// ---------------------------------------------------------------------------
// Setup 早期：config.item 为 function 时立即求值一次
// 1:1 迁移 index.js:224-226
// 使用 toRaw 获取原始对象，避免 vue/no-mutating-props 报错
// 旧版会修改传入的 config 对象（数据层依赖此副作用），此处保持相同语义
// ---------------------------------------------------------------------------

if (props.config.item && typeof props.config.item == "function") {
	// @ts-expect-error 旧版对 config.item 赋值修改原始对象，Vue 下通过 toRaw 避免代理警告
	toRaw(props.config).item = props.config.item();
}

// ---------------------------------------------------------------------------
// 形态判定
// ---------------------------------------------------------------------------

const isClear = computed(() => !!props.config.clear);
// Array.isArray(init) 且有 item：旧版 void 0 分支，只有 name 的空壳节点
const isArrayInitSwitcher = computed(() => !!props.config.item && Array.isArray(props.config.init));
const isSwitcher = computed(() => {
	if (!props.config.item) return false;
	// Array.isArray(init) → void 0（不交互）
	if (Array.isArray(props.config.init)) return false;
	return true;
});
const isRange = computed(() => {
	// @ts-expect-error range 不在 SelectConfigData 类型声明中，但旧版存在此分支
	return !!props.config.range;
});
const isInput = computed(() => !!props.config.input);

/** 是否可见（响应 update 函数适配器的 _hidden 翻转） */
const isVisible = computed(() => !(props.config as any)._hidden);

// toggle on 状态
const isToggleOn = computed(() => props.config.init === true);

// choosing 文本（switcher 当前选中项）
const choosingText = computed(() => {
	var init = props.config.init;
	var item = props.config.item;
	if (item && typeof item === "object" && init !== undefined) {
		return item[init as string] || init;
	}
	return String(init);
});

// clear 样式
const clearStyle = computed(() => {
	// 旧版按 innerHTML 长度判断（含 <span></span> 标签 13 字符）：
	// node.innerHTML.length >= 15 等效于 name.length >= 2
	if (props.config.name && props.config.name.length >= 2) {
		return { height: "auto" as const };
	}
	return {};
});

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const configNodeRef = ref<HTMLElement>();
const inputRef = ref<HTMLDivElement>();

// ---------------------------------------------------------------------------
// PopupMenu 动态渲染相关
// ---------------------------------------------------------------------------

/**
 * 弹出菜单的 popupNode —— 用于存储命令式创建的 .menu 节点
 * 旧版存储在 node._link.menu，新版用 ref 保持每个组件实例独立
 */
const popupMenuEl = ref<HTMLDivElement | null>(null);

// 动态地址源更新 item 后，旧弹出菜单的子项不能继续复用；下次打开时按最新
// item 重建。更新通常由同页 clear 按钮触发，若菜单仍打开则一并关闭它。
watch(
	() => props.config.item,
	() => {
		if (popupMenuEl.value?.isConnected) {
			closePopup();
		}
		popupMenuEl.value = null;
	},
	{ deep: true },
);

/**
 * 构建 .menu 节点并打开 —— 1:1 迁移 clickSwitcher（index.js:54-98）
 */
function handleSwitcherClick() {
	var nodeEl = configNodeRef.value;
	if (!nodeEl) return;
	if (nodeEl.classList.contains("disabled")) return;

	nodeEl.classList.add("on");

	// 构建 .menu 节点（或复用已有）
	if (!popupMenuEl.value) {
		popupMenuEl.value = ui.create.div(".menu");

		var config = props.config;

		// visualMenu 分支
		if (config.visualMenu) {
			buildVisualMenu(popupMenuEl.value, config, nodeEl);
		} else {
			// 普通分支
			buildTextMenu(popupMenuEl.value, config, nodeEl);
		}

		// @ts-expect-error _link 是运行时挂在节点上的自定义属性
		popupMenuEl.value._link = nodeEl;
	}

	// 三分支定位（1:1 迁移 index.js:60-98）
	var pos1 = nodeEl.lastChild!.getBoundingClientRect();
	var pos2 = ui.window.getBoundingClientRect();
	var clientX = pos1.left + pos1.width + 5 - pos2.left;
	var clientY = pos1.top - pos2.top;

	if (popupMenuEl.value.classList.contains("visual")) {
		// visual 分支
		openPopup(popupMenuEl.value, clientX, clientY, () => {
			nodeEl.classList.remove("on");
		});
	} else if (popupMenuEl.value.childElementCount > 10) {
		// >10 项居中分支
		clientY = Math.min((ui.window.offsetHeight - 400) / 2, pos1.top - pos2.top);
		lib.setScroll(popupMenuEl.value);
		openPopup(popupMenuEl.value, clientX, clientY, () => {
			nodeEl.classList.remove("on");
		});
	} else {
		// 普通分支
		openPopup(popupMenuEl.value, clientX, clientY, () => {
			nodeEl.classList.remove("on");
		});
	}
}

/**
 * 构建 visualMenu 分支（内联，避免 PopupMenu 组件的额外开销）
 * 1:1 迁移 index.js:234-296
 */
function buildVisualMenu(
	menu: HTMLDivElement,
	config: SelectConfigData,
	configNodeEl: HTMLElement,
) {
	menu.classList.add("visual");

	var updateVisual = function (this: HTMLElement) {
		// @ts-expect-error _link 是运行时挂在节点上的自定义属性
		config.visualMenu(this, this._link, config.item[this._link] || this._link, config);
	};

	var createNode = function (i: string, before?: HTMLElement) {
		var visualMenu = ui.create.div();
		if (config.visualBar) {
			if (before) {
				menu.insertBefore(visualMenu, before);
			} else {
				menu.insertBefore(visualMenu, menu.lastChild);
			}
		} else {
			menu.appendChild(visualMenu);
		}
		ui.create.div(".name", get.verticalStr(config.item[i] || i), visualMenu);
		// @ts-expect-error _link 是运行时挂在节点上的自定义属性
		visualMenu._link = i;
		if (config.visualMenu(visualMenu, i, config.item[i] || i, config) !== false) {
			visualMenu.listen(function clickMenuItem(this: HTMLElement) {
				doMenuItem(configNodeEl, this, config);
				closePopup();
			});
		}
		// @ts-expect-error update 是运行时挂在节点上的自定义属性
		visualMenu.update = updateVisual;
	};

	if (config.visualBar) {
		var visualBar = ui.create.div(menu, function () {
			setNoclose();
		});
		menu.classList.add("withbar");
		config.visualBar(visualBar, config.item, createNode, configNodeEl);
		// @ts-expect-error update 是运行时挂在节点上的自定义属性
		visualBar.update = function () {
			config.visualBar(visualBar, config.item, createNode, configNodeEl);
		};
	}

	for (var i in config.item) {
		createNode(i);
	}

	lib.setScroll(menu);

	// @ts-expect-error updateBr 是运行时挂在节点上的自定义属性
	menu.updateBr = function () {
		updateBr(menu);
	};
	// @ts-expect-error updateBr 是运行时挂在节点上的自定义属性
	menu.updateBr();
}

/**
 * 构建普通分支
 * 1:1 迁移 index.js:288-296
 */
function buildTextMenu(
	menu: HTMLDivElement,
	config: SelectConfigData,
	configNodeEl: HTMLElement,
) {
	for (var i in config.item) {
		var textMenu = ui.create.div("", config.item[i] || i, menu, function clickMenuItem(this: HTMLElement) {
			doMenuItem(configNodeEl, this, config);
			closePopup();
		});
		// @ts-expect-error _link 是运行时挂在节点上的自定义属性
		textMenu._link = i;
		if (config.textMenu) {
			config.textMenu(textMenu, i, config.item[i] || i, config);
		}
		lib.setScroll(menu);
	}
}

/**
 * updateBr —— 每 3 个子元素插入 <br>
 * 1:1 迁移 index.js:271-285
 */
function updateBr(menu: HTMLElement) {
	var brs = Array.from(menu.querySelectorAll(".menu.visual>br"));
	while (brs.length) {
		brs.shift().remove();
	}
	var split: ChildNode[] = [];
	for (var i = 1; i < menu.childElementCount; i++) {
		if (i % 3 == 0) {
			split.push(menu.childNodes[i]);
		}
	}
	for (var i = 0; i < split.length; i++) {
		menu.insertBefore(ui.create.node("br"), split[i]);
	}
}

// ---------------------------------------------------------------------------
// Toggle 处理
// ---------------------------------------------------------------------------

function handleToggleClick() {
	var nodeEl = configNodeRef.value;
	if (!nodeEl) return;
	doToggle(nodeEl, props.config);
}

// ---------------------------------------------------------------------------
// Clear 处理（listen clickToggle 但实际是空操作）
// ---------------------------------------------------------------------------

function handleClearClick() {
	// 旧版 clear 分支也 listen clickToggle（index.js:306）
	// clickToggle 调用 classList.toggle("on")（对 clear 无 toggle class 无效）+
	// config.onclick + config.update
	var nodeEl = configNodeRef.value;
	if (!nodeEl) return;
	doToggle(nodeEl, props.config);
}

// ---------------------------------------------------------------------------
// Input 处理
// ---------------------------------------------------------------------------

function handleInputKeydown(e: KeyboardEvent) {
	if (e.key == "Enter") {
		e.preventDefault();
		e.stopPropagation();
		(e.target as HTMLElement).blur();
	}
}

/**
 * 初始化 input 的 onblur（四分支）
 * 1:1 迁移 index.js:325-353
 */
function initInputOnblur(input: HTMLDivElement, config: SelectConfigData) {
	if (config.name == "联机昵称") {
		input.innerHTML = config.init || "无名玩家";
		input.onblur = function () {
			input.innerHTML = input.innerHTML.replace(/<br>/g, "");
			if (!input.innerHTML || get.is.banWords(input.innerHTML)) {
				input.innerHTML = "无名玩家";
			}
			input.innerHTML = input.innerHTML.slice(0, 12);
			game.saveConfig("connect_nickname", input.innerHTML);
			game.saveConfig("connect_nickname", input.innerHTML, "connect");
		};
	} else if (config.name == "联机头像") {
		// @ts-expect-error connect_avatar 是运行时挂在 lib.config 上的属性
		var currentId = lib.config.connect_avatar || config.init || "caocao";
		input.innerHTML = lib.translate[currentId] || "曹操";
		input.onblur = config.onblur;
	} else if (config.name == "联机大厅") {
		input.innerHTML = config.init || lib.hallURL;
		input.onblur = function () {
			if (!input.innerHTML) {
				input.innerHTML = lib.hallURL;
			}
			input.innerHTML = input.innerHTML.replace(/<br>/g, "");
			game.saveConfig("hall_ip", input.innerHTML, "connect");
		};
	} else {
		input.innerHTML = config.init;
		input.onblur = config.onblur;
	}
}

// ---------------------------------------------------------------------------
// onMounted：挂 intro + input 初始化 + toggle .on 初始化
// 1:1 迁移 index.js:196-361 的生命周期部分
// ---------------------------------------------------------------------------

onMounted(() => {
	var config = props.config;

	// intro 处理（非 clear 时）
	if (!config.clear) {
		if (config.name != "开启") {
			if (config.name == "屏蔽弱将") {
				config.intro = "强度过低的武将（孙策除外）不会出现在选将框，也不会被AI选择";
			} else if (config.name == "屏蔽强将") {
				config.intro = "强度过高的武将不会出现在选将框，也不会被AI选择";
			} else if (!config.intro) {
				config.intro = "设置" + config.name;
			}
		}

		// 找到对应 DOM 节点挂 intro
		var introTarget = configNodeRef.value;
		if (introTarget) {
			lib.setIntro(introTarget, function (uiintro) {
				if (lib.config.touchscreen) {
					_status.dragged = true;
				}
				uiintro.style.width = "170px";
				var str = config.intro;
				if (typeof str == "function") {
					str = str();
				}
				uiintro._place_text = uiintro.add('<div class="text" style="display:inline">' + str + "</div>");
			});
		}
	}

	// input 分支初始化
	if (config.input && inputRef.value) {
		var input = inputRef.value;
		if (!config.fixed) {
			input.contentEditable = "true";
			// @ts-expect-error webkitUserSelect 是非标准 CSS 属性
			input.style.webkitUserSelect = "text";
		}
		// 注：min-width/max-width/overflow/white-space 由 menu.css 的 .config-input 统一控制
		initInputOnblur(input, config);
	}

	// toggle 分支：init === true 加 .on
	// （isToggleOn computed 已处理，但需要直接操作 DOM classList）
	if (!config.item && !config.input && !config.clear) {
		// @ts-expect-error range 不在 SelectConfigData 类型声明中
		if (!config.range) {
			// 这是 toggle 分支
			// isToggleOn computed 会自动添加 .on class
			// 但旧版是直接操作 DOM：node.classList.add("on")
			// Vue 的 :class="{ on: isToggleOn }" 已处理，无需额外操作
		}
	}
});
</script>
