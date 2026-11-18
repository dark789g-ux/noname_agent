import { markRaw, ref } from "vue";
import { game, get, lib } from "noname";
import type { menuData, LeftPaneItem, RightPaneContext } from "../types";
import CharacterPackPane from "../components/CharacterPackPane.vue";
import { setUpdateActive, menuUpdates } from "../menuState";
import { menuBridge } from "../utils/menuBridge";

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

/**
 * 收藏变更版本号：menuBridge.refreshCharacterPackMenu 触发递增，
 * CharacterPackPane watch 后在显示 mode_favourite 页时重渲染右栏。
 */
export const favouriteVersion = ref(0);

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

	// 5. 批量开关动作项（旧版 470-492 的 3 个 .lefttext 按钮，仅非联机）
	// key 用下划线前缀保留值，不会与武将包名冲突；
	// attrs.action 供 LeftPaneItem 加 .lefttext 样式，attrs.onClick 由
	// MenuView.onLeftItemClick 拦截执行（不参与左栏选中态）。
	if (!connectMenu) {
		items.push(
			{ name: "全部开启", key: "_batch_on", attrs: { action: true, onClick: () => batchToggleCharacterPacks("on") } },
			{ name: "全部关闭", key: "_batch_off", attrs: { action: true, onClick: () => batchToggleCharacterPacks("off") } },
			{ name: "恢复默认", key: "_batch_default", attrs: { action: true, onClick: () => batchToggleCharacterPacks("default") } },
		);
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
	return _leftPaneItems.map(item => {
		// 动作项（批量开关）不参与开关状态标记，保留原 attrs（action/onClick）
		if (item.attrs?.action) {
			return item;
		}
		return {
			...item,
			attrs: {
				enabled: isPackEnabled(item.key),
			},
		};
	});
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
// 已通过 index.ts 的 menu() 接入：
//   ui.updateCharacterPackMenu.push(packName => refreshCharacterPack(packName))
//   （旧版为 index.js:524-525 的 ui.updateCharacterPackMenu.push(characterPackMenu(connectMenu))）
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
		const newItem = {
			name: lib.translate[packName + "_character_config"] || packName,
			key: packName,
		};
		// 旧版 createModeConfig(packName, start.firstChild, node1) 将新包插在
		// 「全部开启」按钮之前，这里同样保持批量开关动作项固定在左栏底部。
		const actionIndex = _leftPaneItems.findIndex(item => item.attrs?.action);
		if (actionIndex === -1) {
			_leftPaneItems.push(newItem);
		} else {
			_leftPaneItems.splice(actionIndex, 0, newItem);
		}
		if (_connectMenu) {
			lib.connectCharacterPack.add(packName);
		}
		triggerUpdate();
	}
}

// ---------------------------------------------------------------------------
// 外部 API：收藏变更刷新 —— 旧版 ui.favouriteCharacter 的桥接替代
// 旧版 414: ui.favouriteCharacter = favouriteCharacterNode.link（DOM 引用），
// Vue 版由 menuBridge.refreshCharacterPackMenu 替代：ui.click.favouriteCharacter
// 收藏变更后调用，重建左栏数据（收藏项显隐）并递增 favouriteVersion，
// 驱动 CharacterPackPane 重渲染当前显示的 mode_favourite 页。
// 模块级注册：无组件生命周期依赖，菜单 app 存活期间始终可用。
// ---------------------------------------------------------------------------

/**
 * 重建左栏数据并触发刷新（原地修改，保持 menuData.leftPaneData 等既有引用有效）。
 * 收藏项显隐逻辑在 buildLeftPaneData 内（空收藏不生成 mode_favourite 项，
 * 与旧版空则隐藏对齐）。
 */
function refreshCharacterPackMenu() {
	const items = buildLeftPaneData(_connectMenu);
	_leftPaneItems.length = 0;
	_leftPaneItems.push(...items);
	triggerUpdate();
	favouriteVersion.value++;
}

menuBridge.refreshCharacterPackMenu = refreshCharacterPackMenu;

// ---------------------------------------------------------------------------
// I2: 批量操作函数（全部开启/全部关闭/恢复默认）
// 对应旧版武将包左栏底部的 3 个 .lefttext 按钮。
// 已通过 buildLeftPaneData 末尾的动作项接入左栏 UI。
// ---------------------------------------------------------------------------

/**
 * 批量切换武将包开启状态。
 * @param mode "on" 全部开启 | "off" 全部关闭 | "default" 恢复默认
 */
export function batchToggleCharacterPacks(mode: "on" | "off" | "default"): void {
	// 旧版对应 characterPackMenu.js:472-490 的 3 个 .lefttext 按钮回调：
	// 一次 saveConfig 完成；扩展包无 saveExtensionConfig 特殊路径，
	// 仅以 mode_extension_ 前缀键进入 lib.config.characters
	if (mode === "on") {
		// 全部开启：与旧版一致，集合为 Object.keys(lib.characterPack)
		// 过滤 mode_（已安装的 stock 扩展包除外）
		game.saveConfig(
			"characters",
			Object.keys(lib.characterPack).filter(name => {
				return !name.startsWith("mode_") || (name.startsWith("mode_extension_") && lib.config.all.stockextension.includes(name.slice(15)));
			})
		);
	} else if (mode === "off") {
		// 全部关闭：与旧版一致，清空 lib.config.characters
		game.saveConfig("characters", []);
	} else {
		// 恢复默认：旧版为 game.saveConfig("characters", lib.config.defaultcharacters)
		game.saveConfig("characters", lib.config.defaultcharacters);
	}
	triggerUpdate();
}
