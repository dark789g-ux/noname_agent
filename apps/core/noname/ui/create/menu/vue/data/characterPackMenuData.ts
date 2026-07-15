import { markRaw, ref } from "vue";
import { game, get, lib } from "noname";
import type { menuData, LeftPaneItem, RightPaneContext } from "../types";
import CharacterPackPane from "../components/CharacterPackPane.vue";
import { setUpdateActive, menuUpdates } from "../index.js";

// ---------------------------------------------------------------------------
// 模块级状态：当前 connectMenu 值（由工厂捕获）
// CharacterPackPane 通过 renderModePage 闭包使用
// ---------------------------------------------------------------------------

let _connectMenu = false;

/**
 * 获取当前 connectMenu 值（供 CharacterPackPane 使用）
 */
export function getConnectMenu(): boolean {
	return _connectMenu;
}

// ---------------------------------------------------------------------------
// togglePack —— 包开关逻辑（旧 108-137）
// 1:1 迁移，this._link.config._name → 闭包捕获 mode
// ---------------------------------------------------------------------------

export function togglePack(mode: string, bool: boolean): boolean | undefined {
	// 扩展武将包开启逻辑
	if (mode.startsWith("mode_extension")) {
		const extName = mode.slice(15);
		if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
			return false;
		}
		game.saveExtensionConfig(extName, "characters_enable", bool);
	} else {
		if (_connectMenu) {
			if (!bool) {
				lib.config.connect_characters.add(mode);
			} else {
				lib.config.connect_characters.remove(mode);
			}
			game.saveConfig("connect_characters", lib.config.connect_characters);
		} else {
			if (bool) {
				lib.config.characters.add(mode);
			} else {
				lib.config.characters.remove(mode);
			}
			game.saveConfig("characters", lib.config.characters);
		}
	}
	triggerUpdate();
	return undefined;
}

// ---------------------------------------------------------------------------
// 响应式版本号：togglePack / 全部开关 调用后递增，驱动左栏刷新
// ---------------------------------------------------------------------------

const _version = ref(0);

function triggerUpdate() {
	_version.value++;
}

// ---------------------------------------------------------------------------
// 判断一个 mode 是否处于开启状态（用于左栏 .off 标记）
// 对应旧版 updateNodes 逻辑（52-107）
// ---------------------------------------------------------------------------

function isPackEnabled(mode: string): boolean {
	if (mode.startsWith("mode_")) {
		// 扩展武将包开启逻辑
		if (mode.startsWith("mode_extension")) {
			const extName = mode.slice(15);
			if (!game.hasExtension(extName) || !game.hasExtensionLoaded(extName)) {
				return false;
			}
			return lib.config[`extension_${extName}_characters_enable`] == true;
		}
		// mode_favourite / mode_banned / 其它 mode_ 不显示开关
		return true;
	}
	if (mode == "custom") {
		return true;
	}
	if (_connectMenu) {
		return !lib.config.connect_characters.includes(mode);
	} else {
		return lib.config.characters.includes(mode);
	}
}

// ---------------------------------------------------------------------------
// 左栏数据构建（buildLeftPaneData，旧 402-452）
// 返回 LeftPaneItem[]，包含武将包 + 特殊项
// ---------------------------------------------------------------------------

/**
 * 构建左栏数据列表。
 * mode_favourite / mode_banned 为空时不出现在列表中（简化版处理，
 * 旧版是 display:none 但占位；Vue 版 LeftPaneItem 无隐藏字段）。
 *
 * @param connectMenu 是否联机
 */
function buildLeftPaneData(connectMenu: boolean): LeftPaneItem[] {
	let items: LeftPaneItem[] = [];
	let keysSeen: Set<string> = new Set();

	// 1. mode_favourite（收藏夹）：仅非联机
	if (lib.config.show_favourite_menu && !connectMenu && Array.isArray(lib.config.favouriteCharacter)) {
		lib.characterPack.mode_favourite = {};
		for (let i = 0; i < lib.config.favouriteCharacter.length; i++) {
			let favname = lib.config.favouriteCharacter[i];
			if (lib.character[favname]) {
				lib.characterPack.mode_favourite[favname] = lib.character[favname];
			}
		}
		if (!get.is.empty(lib.characterPack.mode_favourite)) {
			items.push({
				name: lib.translate["mode_favourite_character_config"],
				key: "mode_favourite",
			});
			keysSeen.add("mode_favourite");
		}
		delete lib.characterPack.mode_favourite;
	}

	// 2. mode_banned（封禁列表）：仅非联机
	if (!connectMenu && lib.config.show_ban_menu) {
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
		if (!get.is.empty(lib.characterPack.mode_banned)) {
			items.push({
				name: lib.translate["mode_banned_character_config"],
				key: "mode_banned",
			});
			keysSeen.add("mode_banned");
		}
		delete lib.characterPack.mode_banned;
	}

	// 3. 常规武将包
	let characterlist: string[] = connectMenu ? lib.connectCharacterPack : lib.config.all.characters;
	for (let i = 0; i < characterlist.length; i++) {
		let mode = characterlist[i];
		if (keysSeen.has(mode)) continue;
		items.push({
			name: lib.translate[mode + "_character_config"] || mode,
			key: mode,
		});
		keysSeen.add(mode);
	}

	// 4. 非联机补充：Object.keys(lib.characterPack) 中不在 characterlist 的
	if (!connectMenu) {
		Object.keys(lib.characterPack).forEach(key => {
			if (!keysSeen.has(key)) {
				items.push({
					name: lib.translate[key + "_character_config"] || key,
					key: key,
				});
				keysSeen.add(key);
			}
		});
	}

	return items;
}

// ---------------------------------------------------------------------------
// 导出：leftPaneDataRef（带 _version 响应式依赖）
// 左栏渲染需要知道每个 mode 的开启状态（.off 标记），
// 通过 computed 依赖 _version 实现响应式刷新
// ---------------------------------------------------------------------------

let _leftPaneItems: LeftPaneItem[] = [];

/**
 * 获取左栏数据（带当前开关状态标记）
 * 返回的 LeftPaneItem 的 attrs.enabled 表示该包是否开启
 */
export function getLeftPaneItems(): LeftPaneItem[] {
	// 触发 _version 依赖，确保 togglePack 后左栏能刷新
	void _version.value;
	return _leftPaneItems.map(item => ({
		...item,
		attrs: {
			enabled: isPackEnabled(item.key),
		},
	}));
}

// ---------------------------------------------------------------------------
// 工厂函数：创建武将包页 menuData
// ---------------------------------------------------------------------------

/**
 * 创建武将包页的 menuData。
 *
 * @param connectMenu 是否联机
 */
export function createCharacterPackMenuData(connectMenu: boolean): menuData {
	_connectMenu = connectMenu;

	// 构建左栏数据（一次性，副作用：构建/删除 mode_favourite / mode_banned）
	_leftPaneItems = buildLeftPaneData(connectMenu);

	// 注册 updateActive 回调（旧 36-51）
	// CharacterPackPane 在 onMounted 时调用 registerUpdateActiveFn，
	// 这里先注册一个空操作，等 CharacterPackPane 挂载后覆盖
	setUpdateActive(() => {
		// 由 CharacterPackPane.registerUpdateActiveFn 提供实际实现
	});

	// 注册 menuUpdates 回调（旧 494 updateNodes）
	menuUpdates.push(() => {
		triggerUpdate();
	});

	const data: menuData = {
			leftPaneData: _leftPaneItems,

			getLeftPaneData() {
				return getLeftPaneItems();
			},

			getRightPane(_ctx: RightPaneContext) {
			// 右栏由 CharacterPackPane 渲染，不返回配置项
			return [];
		},

		getDefaultActiveKey(_connectMenu: boolean): string | null {
			// 返回 null 表示选第一个
			return null;
		},

		rightPaneComponent: markRaw(CharacterPackPane),
	};

	return data;
}

// ---------------------------------------------------------------------------
// 外部 API：刷新武将包（旧 501-513 返回值）
// TODO: 阶段 6 接入 ui.updateCharacterPackMenu.push(refreshCharacterPack)
//   旧版 ui.updateCharacterPackMenu.push(characterPackMenu(connectMenu))
//   在 index.js:524-525。阶段 6 入口切换时，在 index.ts 的 menu() 中
//   调用 refreshCharacterPack 或将此函数推入 ui.updateCharacterPackMenu。
// ---------------------------------------------------------------------------

/**
 * 刷新武将包（新包加载后调用）。
 * 判断菜单栏有没有加载过这个武将包，没有则加入左栏数据。
 *
 * @param packName 新加载的武将包名称
 */
export function refreshCharacterPack(packName: string): void {
	if (_leftPaneItems.some(item => item.key === packName)) {
		return;
	}
	if (!lib.connectCharacterPack.includes(packName) && !lib.config.all.characters.includes(packName)) {
		_leftPaneItems.push({
			name: lib.translate[packName + "_character_config"] || packName,
			key: packName,
		});
		if (_connectMenu) {
			lib.connectCharacterPack.add(packName);
		}
		triggerUpdate();
	}
}

// ---------------------------------------------------------------------------
// TODO: 阶段 6 外部 API —— ui.favouriteCharacter
// 旧版 414: ui.favouriteCharacter = favouriteCharacterNode.link
// Vue 版没有 favouriteCharacterNode DOM，无法直接赋值。
// 需要在阶段 6 评估外部代码如何使用 ui.favouriteCharacter，
// 再决定是否提供替代方案（如 ref 引用 CharacterPackPane 实例）。
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// I2: 批量操作函数（全部开启/全部关闭/恢复默认）
// 对应旧版武将包左栏底部的 3 个 .lefttext 按钮。
// TODO: 阶段 4/6 在左栏 UI 中接入这些函数（如 LeftPaneItem 支持按钮类型，
//   或在 CharacterPackPane 底部渲染按钮）。
// ---------------------------------------------------------------------------

/**
 * 批量切换武将包开启状态。
 * @param mode "on" 全部开启 | "off" 全部关闭 | "default" 恢复默认
 */
export function batchToggleCharacterPacks(mode: "on" | "off" | "default"): void {
	// TODO: 阶段 4/6 左栏 UI 接入 —— 当前仅导出数据层函数
	// 旧版对应 index.js 的 allCharacter / removeCharacter / restoreCharacter
	if (mode === "on") {
		// 全部开启：将所有武将包加入 lib.config.characters
		const all = lib.config.all.characters || [];
		for (let i = 0; i < all.length; i++) {
			togglePack(all[i], true);
		}
	} else if (mode === "off") {
		// 全部关闭：将所有武将包从 lib.config.characters 移除
		const all = lib.config.all.characters || [];
		for (let i = 0; i < all.length; i++) {
			togglePack(all[i], false);
		}
	} else {
		// 恢复默认
		game.saveConfig("characters", game.getDefaultConfig("characters"));
		triggerUpdate();
	}
}
