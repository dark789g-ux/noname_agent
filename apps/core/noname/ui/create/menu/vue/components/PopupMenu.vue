/**
 * 当前未启用：NonameConfig 内联了菜单构建逻辑，本组件保留作声明式重构参考。
 */
<template>
	<!-- PopupMenu 不渲染到自己的模板位置，而是通过 popupHost 挂到全局 popupContainer -->
	<!-- 此组件为空壳，仅提供 onMounted 时的命令式 DOM 构建逻辑 -->
	<div></div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { get, lib, ui } from "noname";
import type { SelectConfigData } from "./../../../../../../typings/type";
import { openPopup, setNoclose, closePopup } from "../utils/popupHost";
import { doMenuItem } from "../utils/configInteract";

interface PopupMenuProps {
	config: SelectConfigData;
	configNodeEl: HTMLElement;
	/** 定位坐标（已经换算到 ui.window 坐标系） */
	clientX: number;
	clientY: number;
	/** 关闭时的回调（移除 .on class 等） */
	onclose: () => void;
}

const props = defineProps<PopupMenuProps>();

/**
 * 构建 updateBr 闭包 —— 每 3 个子元素插入 <br> 换行
 * 1:1 迁移旧版 node._link.menu.updateBr（index.js:271-285）
 */
function updateBr(menu: HTMLElement) {
	// 清除已有的 <br>
	var brs = Array.from(menu.querySelectorAll(".menu.visual>br"));
	while (brs.length) {
		brs.shift().remove();
	}
	// 每 3 个元素插入 <br>
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

/**
 * 构建 visualMenu 分支的菜单内容
 * 1:1 迁移 index.js:234-296 visualMenu 分支
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
			// visualBar 点击时设置 noclose 一次性保护
			// 旧版：this.parentNode.parentNode.noclose = true
			// 但 menu 此时已挂到 popupContainer，parentNode 是 popupContainer
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
 * 构建普通（非 visual）分支的菜单内容
 * 1:1 迁移 index.js:288-296 普通分支
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

onMounted(() => {
	var config = props.config;
	var menu = ui.create.div(".menu");

	// 构建菜单内容
	if (config.visualMenu) {
		buildVisualMenu(menu, config, props.configNodeEl);
	} else {
		buildTextMenu(menu, config, props.configNodeEl);
	}

	// @ts-expect-error _link 是运行时挂在节点上的自定义属性
	menu._link = props.configNodeEl;

	// 通过 openPopup 挂到 popupContainer 并定位
	openPopup(menu, props.clientX, props.clientY, () => {
		props.onclose();
	});
});
</script>
