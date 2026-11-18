<template>
	<div
		ref="containerRef"
		class="menu-buttons leftbutton"
		:style="paddingTopStyle"
	/>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { ui, game, get, lib, _status } from "noname";
import type { RightPaneContext } from "../types";
import { createConfig } from "../utils/configBuilder";
import { setUpdateActive } from "../menuState";
import { getConnectMenu, togglePack, favouriteVersion } from "../data/characterPackMenuData";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
	ctx: RightPaneContext;
}

const props = defineProps<Props>();

// ---------------------------------------------------------------------------
// 当前 mode（从 ctx.item.key 获取）
// ---------------------------------------------------------------------------

const mode = computed(() => props.ctx.item.key);

// ---------------------------------------------------------------------------
// DOM ref：命令式渲染的容器
// ---------------------------------------------------------------------------

const containerRef = ref<HTMLDivElement>();

// ---------------------------------------------------------------------------
// mode 是否以 mode_ 开头且非 mode_extension 且非 mode_guozhan
// 用于决定 paddingTop 和分组开关行为
// ---------------------------------------------------------------------------

const isPlainMode = computed(() => {
	return mode.value.startsWith("mode_")
		&& !mode.value.startsWith("mode_extension")
		&& mode.value !== "mode_guozhan";
});

const paddingTopStyle = computed(() => {
	if (isPlainMode.value) {
		return { paddingTop: "8px" };
	}
	return {};
});

// ---------------------------------------------------------------------------
// 获取当前模式的封禁列表
// 对应旧版 updateBanned 中的 _list 获取逻辑（252-259）
// ---------------------------------------------------------------------------

function getBannedList(): any[] {
	const connectMenu = getConnectMenu();
	if (connectMenu) {
		// Vue 版：直接使用 mode computed 而非旧版 DOM 遍历
		// 旧版 253-255: cacheMenux.pages[0].firstChild.querySelector(".active").mode
		const currentMode = mode.value;
		if (currentMode) {
			// @ts-expect-error connect_<mode>_banned 是运行时动态属性
			return lib.config["connect_" + currentMode + "_banned"] || [];
		}
		return [];
	} else {
		// @ts-expect-error <mode>_banned 是运行时动态属性
		return lib.config[get.mode() + "_banned"] || [];
	}
}

// ---------------------------------------------------------------------------
// banCharacter —— 点击武将按钮的封禁/查看逻辑（旧 229-249）
// this 语义适配：旧版 this = 按钮 DOM → Vue 版闭包捕获 buttonEl
// ---------------------------------------------------------------------------

function createBanCharacterHandler(currentMode: string, buttonEl: HTMLElement) {
	return function banCharacter(this: HTMLElement, e: Event) {
		if (_status.clicked) {
			_status.clicked = false;
			return;
		}
		if (currentMode.startsWith("mode_")
			&& !currentMode.startsWith("mode_extension")
			&& currentMode != "mode_favourite"
			&& currentMode != "mode_banned") {
			const connectMenu = getConnectMenu();
			if (!connectMenu && lib.config.show_charactercard) {
				ui.click.charactercard(
					// @ts-expect-error link 是运行时挂在按钮节点上的自定义属性
					buttonEl.link,
					buttonEl,
					currentMode == "mode_guozhan" ? "guozhan" : true,
				);
			}
			return;
		}
		ui.click.touchpop();
		const connectMenu = getConnectMenu();
		// @ts-expect-error _banning 是运行时挂在按钮节点上的自定义属性
		buttonEl._banning = connectMenu ? "online" : "offline";
		if (!connectMenu && lib.config.show_charactercard) {
			// @ts-expect-error link 是运行时挂在按钮节点上的自定义属性
			ui.click.charactercard(buttonEl.link, buttonEl);
		} else {
			ui.click.intro.call(buttonEl, e);
		}
		_status.clicked = false;
		// @ts-expect-error _banning 是运行时挂在按钮节点上的自定义属性
		delete buttonEl._banning;
	};
}

// ---------------------------------------------------------------------------
// updateBanned —— 根据当前模式封禁列表给按钮加/移除 .banned class（旧 250-265）
// ---------------------------------------------------------------------------

function createUpdateBannedHandler(buttonEl: HTMLElement) {
	return function updateBanned(this: HTMLElement) {
		const _list = getBannedList();
		if (_list && _list.includes(
			// @ts-expect-error link 是运行时挂在按钮节点上的自定义属性
			buttonEl.link,
		)) {
			buttonEl.classList.add("banned");
		} else {
			buttonEl.classList.remove("banned");
		}
	};
}

// ---------------------------------------------------------------------------
// 给按钮列表设置通用属性（noclick, listen, rarity, hp, updateBanned）
// 对应旧版 328-337 / 360-370 的按钮后处理
// ---------------------------------------------------------------------------

function setupCharacterButtons(buttons: HTMLElement[], currentMode: string) {
	for (let i = 0; i < buttons.length; i++) {
		const btn = buttons[i];
		btn.classList.add("noclick");
		btn.listen(createBanCharacterHandler(currentMode, btn));
		ui.create.rarity(btn);
		// @ts-expect-error node.hp 是运行时挂在按钮节点上的属性
		btn.node.hp.style.transition = "all 0s";
		// @ts-expect-error node.hp._innerHTML 保存初始 HTML
		btn.node.hp._innerHTML = btn.node.hp.innerHTML;
		if (currentMode != "mode_banned") {
			// @ts-expect-error updateBanned 是运行时挂在按钮节点上的自定义方法
			btn.updateBanned = createUpdateBannedHandler(btn);
		}
	}
}

// ---------------------------------------------------------------------------
// togglePack 的 onclick 包装（闭包捕获 mode，供 createConfig 使用）
// 旧版 togglePack 中 this._link.config._name → Vue 版闭包捕获 currentMode
// ---------------------------------------------------------------------------

function createTogglePackOnclick(currentMode: string) {
	return function (bool: boolean) {
		togglePack(currentMode, bool);
	};
}

// ---------------------------------------------------------------------------
// 渲染模式页面（对应旧版 createModeConfig._initLink，旧 150-396）
// 命令式 DOM 操作 —— ui.create.buttons / createConfig 是引擎核心 UI API
// ---------------------------------------------------------------------------

function renderModePage(container: HTMLDivElement, currentMode: string) {
	container.innerHTML = "";
	container.className = "menu-buttons leftbutton";

	const connectMenu = getConnectMenu();
	const _info = lib.characterPack[currentMode];
	if (!_info) return;

	let list: string[] = [];
	const boolAI = lib.config[`forbidai_user_${currentMode}`];

	for (let i in _info) {
		const characterInfo = _info[i];
		if (characterInfo.isUnseen) {
			continue;
		}
		if (connectMenu && lib.connectBanned.includes(i)) {
			continue;
		}
		list.push(i);
	}
	list.sort(lib.sort.character);
	let list2 = list.slice(0);

	// 包开关 toggle（cfgnode）
	let toggleInit: boolean;
	if (currentMode.startsWith("mode_extension")) {
		const extName = currentMode.slice(15);
		if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
			toggleInit = false;
		} else {
			if (lib.config[`extension_${extName}_characters_enable`] === undefined) {
				game.saveExtensionConfig(extName, "characters_enable", true);
			}
			toggleInit = lib.config[`extension_${extName}_characters_enable`] === true;
		}
	} else {
		toggleInit = connectMenu
			? !lib.config.connect_characters.includes(currentMode)
			: lib.config.characters.includes(currentMode);
	}
	const cfgnode = createConfig({
		name: "开启",
		_name: currentMode,
		init: toggleInit,
		onclick: createTogglePackOnclick(currentMode),
	});

	// "仅点将可用" toggle（cfgnodeAI）
	const cfgnodeAI = createConfig({
		name: "仅点将可用",
		_name: currentMode,
		init: boolAI,
		intro: "将该武将包内的武将全部设置为仅点将可用",
		onclick(bool: boolean) {
			game.saveConfig(`forbidai_user_${currentMode}`, bool);
		},
	});

	// 按模式类型放置 toggle 节点（旧 210-224）
	if (!currentMode.startsWith("mode_")) {
		cfgnodeAI.style.marginTop = "0px";
		container.appendChild(cfgnode);
		container.appendChild(cfgnodeAI);
	} else if (currentMode.startsWith("mode_extension")) {
		// 非 stockextension 的扩展包才显示"开启"开关
		// @ts-expect-error stockextension 是运行时属性
		if (!lib.config.all.stockextension.includes(currentMode.slice(15))) {
			container.appendChild(cfgnode);
			cfgnodeAI.style.marginTop = "0px";
		}
		container.appendChild(cfgnodeAI);
	} else {
		// mode_favourite / mode_banned 等，只加 paddingTop（已在 computed 中处理）
		// 不显示 toggle
	}

	// 包信息文本（旧 225-228）
	if (lib.translate[currentMode + "_charactersInfo"]) {
		const infoHtml = `<p style="padding-left: 2em; margin-block: unset;">${lib.translate[currentMode + "_charactersInfo"]}</p>`;
		container.insertAdjacentHTML("beforeend", infoHtml);
	}

	// 武将按钮网格 —— 势力分组 vs 直接渲染（旧 266-371）
	if (lib.characterSort[currentMode]) {
		renderGroupedButtons(container, currentMode, list2);
	} else {
		const buttons = ui.create.buttons(list, "character", container);
		setupCharacterButtons(buttons, currentMode);
	}

	// 隐藏武将包（旧 374-394，仅非联机且非 sgscharacters 且非 mode_）
	if (!connectMenu) {
		// @ts-expect-error sgscharacters 是运行时属性
		if (lib.config.all.sgscharacters.includes(currentMode)) {
			ui.create.div(
				".config.pointerspan",
				'<span style="opacity:0.5">该武将包不可被隐藏</span>',
				container,
			);
		} else if (!currentMode.startsWith("mode_")) {
			ui.create.div(".config.pointerspan", "<span>隐藏武将包</span>", container, function (this: HTMLElement) {
				if (this.firstChild.innerHTML == "隐藏武将包") {
					if (confirm("真的要隐藏\u201c" + get.translation(currentMode + "_character_config") + "\u201d武将包吗？\n建议使用\u201c关闭\u201d而不是\u201c隐藏\u201d功能，否则将会影响其他相关武将包的正常运行！")) {
						this.firstChild.innerHTML = "武将包将在重启后隐藏";
						lib.config.hiddenCharacterPack.add(currentMode);
						if (!lib.config.prompt_hidepack) {
							alert("隐藏的扩展包可通过选项-其它-重置隐藏内容恢复");
							game.saveConfig("prompt_hidepack", true);
						}
					}
				} else {
					this.firstChild.innerHTML = "隐藏武将包";
					lib.config.hiddenCharacterPack.remove(currentMode);
				}
				game.saveConfig("hiddenCharacterPack", lib.config.hiddenCharacterPack);
			});
		}
	}
}

// ---------------------------------------------------------------------------
// 渲染势力分组按钮（旧 266-358）
// ---------------------------------------------------------------------------

function renderGroupedButtons(container: HTMLDivElement, currentMode: string, list2: string[]) {
	const connectMenu = getConnectMenu();
	const listb = getBannedList();

	for (let pak in lib.characterSort[currentMode]) {
		const info = lib.characterSort[currentMode][pak];
		let listx: string[] = [];
		let boolx = false;
		for (let ii = 0; ii < list2.length; ii++) {
			if (info.includes(list2[ii])) {
				listx.push(list2[ii]);
				if (!listb.includes(list2[ii])) {
					boolx = true;
				}
				list2.splice(ii--, 1);
			}
		}
		if (listx.length) {
			// 分组开关配置（旧 290-324）
			let cfgnodeY: any = {
				name: lib.translate[pak],
				intro: lib.translate[pak + "_info"] || false,
				_name: pak,
				init: boolx,
				onclick(bool: boolean) {
					const banned: any[] = getBannedList().slice();
					const thisPak = pak; // 闭包捕获
					const listxInner = lib.characterSort[currentMode][thisPak];
					if (bool) {
						for (let i = 0; i < listxInner.length; i++) {
							banned.remove(listxInner[i]);
						}
					} else {
						for (let i = 0; i < listxInner.length; i++) {
							banned.add(listxInner[i]);
						}
					}
					// 保存封禁列表
					const bannedKey = connectMenu
						? "connect_" + currentMode + "_banned"
						: get.mode() + "_banned";
					game.saveConfig(bannedKey, banned);
					updateActiveFn();
				},
			};
			// mode_ 且非 mode_extension_ 且非 mode_guozhan → clear + 删除 onclick
			if (currentMode.startsWith("mode_")
				&& !currentMode.startsWith("mode_extension")
				&& currentMode !== "mode_guozhan") {
				cfgnodeY.clear = true;
				delete cfgnodeY.onclick;
			}
			const cfgnodeX = createConfig(cfgnodeY);
			container.appendChild(cfgnodeX);
			const buttons = ui.create.buttons(listx, "character", container);
			setupCharacterButtons(buttons, currentMode);
		}
	}

	// 剩余归"其他"（旧 340-358）
	if (list2.length) {
		const cfgnodeX = createConfig({
			name: "其他",
			_name: "others",
			clear: true,
		});
		container.appendChild(cfgnodeX);
		const buttons = ui.create.buttons(list2, "character", container);
		setupCharacterButtons(buttons, currentMode);
	}
}

// ---------------------------------------------------------------------------
// updateActive 函数引用 —— 由 setUpdateActive 注册
// 对应旧版 36-51：遍历当前页所有子节点，调用 updateBanned
// ---------------------------------------------------------------------------

let updateActiveFn: () => void = () => {
	const container = containerRef.value;
	if (!container) return;
	for (let i = 0; i < container.childElementCount; i++) {
		// @ts-expect-error updateBanned 是运行时挂在按钮节点上的自定义方法
		if (container.childNodes[i].updateBanned) {
			// @ts-expect-error updateBanned 是运行时挂在按钮节点上的自定义方法
			container.childNodes[i].updateBanned();
		}
	}
};

// ---------------------------------------------------------------------------
// watch mode：切换左栏项时重新渲染右栏
// ---------------------------------------------------------------------------

watch(
	() => props.ctx.item.key,
	(newMode, oldMode) => {
		if (newMode === oldMode) return;
		nextTick(() => {
			doRender();
		});
	},
);

// ---------------------------------------------------------------------------
// watch favouriteVersion：收藏变更（ui.click.favouriteCharacter →
// menuBridge.refreshCharacterPackMenu）后，若当前正在显示 mode_favourite 页则重渲染
// ---------------------------------------------------------------------------

watch(favouriteVersion, () => {
	if (mode.value === "mode_favourite") {
		doRender();
	}
});

// ---------------------------------------------------------------------------
// onMounted：首次渲染 + 注册 updateActive
// ---------------------------------------------------------------------------

onMounted(() => {
	// 注册 updateActive 到全局（替代旧版 36-51 的 setUpdateActive）
	setUpdateActive(() => {
		updateActiveFn();
	});
	doRender();
});

// ---------------------------------------------------------------------------
// 渲染逻辑
// ---------------------------------------------------------------------------

function doRender() {
	const container = containerRef.value;
	if (!container) return;
	const currentMode = mode.value;
	if (!currentMode) return;

	// 重建 lib.characterPack（mode_favourite / mode_banned 需要）
	rebuildCharacterPack(currentMode);

	renderModePage(container, currentMode);

	// 渲染完成后调用一次 updateActive，刷新 .banned 状态
	nextTick(() => {
		updateActiveFn();
	});
}

// ---------------------------------------------------------------------------
// 重建 lib.characterPack 的临时数据（mode_favourite / mode_banned 的副作用）
// 因为 buildLeftPaneData 执行后已 delete，但渲染时需要
// ---------------------------------------------------------------------------

function rebuildCharacterPack(currentMode: string) {
	if (currentMode === "mode_favourite") {
		lib.characterPack.mode_favourite = {};
		if (Array.isArray(lib.config.favouriteCharacter)) {
			for (let i = 0; i < lib.config.favouriteCharacter.length; i++) {
				let favname = lib.config.favouriteCharacter[i];
				if (lib.character[favname]) {
					lib.characterPack.mode_favourite[favname] = lib.character[favname];
				}
			}
		}
	} else if (currentMode === "mode_banned") {
		lib.characterPack.mode_banned = {};
		for (let i = 0; i < lib.config.all.mode.length; i++) {
			let banned = lib.config[lib.config.all.mode[i] + "_banned"];
			if (banned) {
				for (let j = 0; j < banned.length; j++) {
					if (lib.character[banned[j]]) {
						lib.characterPack.mode_banned[banned[j]] = lib.character[banned[j]];
					}
				}
			}
		}
	}
}
</script>
