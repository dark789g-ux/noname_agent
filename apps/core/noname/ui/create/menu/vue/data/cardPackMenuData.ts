import { markRaw, ref, type Component } from "vue";
import type { menuData, LeftPaneItem, RightPaneContext } from "../types";
import { lib, game } from "noname";
import { setUpdateActiveCard, menuUpdates } from "../menuState";
import CardPackPane from "../components/CardPackPane.vue";

// ---------------------------------------------------------------------------
// 纯数据层 —— 构建左栏 LeftPaneItem[]、注册 updateActiveCard / updateNodes
// 右栏渲染由 CardPackPane.vue 负责（rightPaneComponent）
// ---------------------------------------------------------------------------

/** 左栏数据（模块级，refreshCardPack 动态追加新包） */
let _leftPaneItems: LeftPaneItem[] = [];

// ---------------------------------------------------------------------------
// 响应式版本号：refreshCardPack 调用后递增，驱动左栏刷新
// ---------------------------------------------------------------------------

const _version = ref(0);

function triggerUpdate() {
	_version.value++;
}

/**
 * 工厂函数：根据 connectMenu 构建卡牌包页的 menuData。
 * 对应旧版 cardPackMenu.js 整体（691 行）。
 *
 * @param connectMenu 是否联机菜单
 */
export function createCardPackMenuData(connectMenu: boolean): menuData {
	// ---- 旧版 60-116: updateNodes（刷新左栏项开关状态） ----
	// 对应旧版 updateNodes 函数，Vue 版不再直接操作 DOM，
	// 而是存储在 menuUpdates 中供切换 tab 时调用。
	// 但 updateNodes 实际操作 DOM classList（.off / .on），
	// Vue 版不再手动管理 DOM class，因此 updateNodes 在 Vue 版
	// 降级为刷新 lib.config 后等待 computed 重渲染。
	// 旧版 togglePack 调用 updateNodes() 来同步左栏显示 ——
	// Vue 版的 leftPaneData 初始构建一次（动态加载的新包由 refreshCardPack 追加），
	// .off 状态由 CardPackPane 内部处理。
	// 因此此处不再需要 updateNodes，togglePack 直接操作 lib.config 即可。

	// ---- 旧版 44-59: setUpdateActiveCard ----
	// Vue 版：updateActiveCard 不再需要遍历 DOM childElementCount，
	// 而是在切换左栏项时通过 computed 重新渲染 CardPackPane。
	// 旧版 index.js:529 的调用链曾间接依赖 updateActiveCard（旧版 index.js 已删除）。
	// 保留一个空实现以保持接口兼容。
	setUpdateActiveCard(function (_node?: any) {
		// Vue 版：CardPackPane 通过 watch ctx.item.key 自动重新渲染，
		// 不需要遍历 DOM 节点调用 updateBanned。
	});

	// ---- 构建左栏数据 ----
	_leftPaneItems = buildLeftPaneData(connectMenu);

	// ---- 默认激活项 ----
	// 对应旧版 510-517：选第一个非隐藏项
	const defaultActiveKey = getDefaultActiveKey(_leftPaneItems, connectMenu);

	// ---- 注册 menuUpdates 回调：切换 tab 时触发左栏刷新 ----
	menuUpdates.push(() => {
		triggerUpdate();
	});

	// ---- 返回 menuData ----
	return {
		leftPaneData: _leftPaneItems,
		getLeftPaneData() {
			// 触发 _version 依赖，确保 refreshCardPack 追加新包后左栏能刷新
			void _version.value;
			return _leftPaneItems;
		},
		getRightPane(_ctx: RightPaneContext) {
			// 右栏由 rightPaneComponent 渲染，返回空数组
			return [];
		},
		getDefaultActiveKey() {
			return defaultActiveKey;
		},
		rightPaneComponent: markRaw(CardPackPane) as Component,
	};
}

// ---------------------------------------------------------------------------
// 左栏数据构建
// 对应旧版 478-509 + 524-667
// ---------------------------------------------------------------------------

/**
 * 构建左栏 LeftPaneItem[]。
 *
 * 顺序：
 * 1. mode_banned（封禁列表）：仅非联机且 lib.config.show_ban_menu
 * 2. 常规卡牌包：遍历 lib.config.all.cards（联机过滤 connectCardPack）
 * 3. 非联机补充：Object.keys(lib.cardPack) 不在 all.cards 的
 * 4. "牌堆" 项（仅非联机）
 */
function buildLeftPaneData(connectMenu: boolean): LeftPaneItem[] {
	const items: LeftPaneItem[] = [];

	// ---- 1. mode_banned（旧版 478-492） ----
	if (!connectMenu && lib.config.show_ban_menu) {
		// 构建临时 lib.cardPack.mode_banned 用于显示
		// @ts-expect-error lib.cardPack.mode_banned 是临时属性，运行时动态构建
		lib.cardPack.mode_banned = [];
		for (let i = 0; i < lib.config.all.mode.length; i++) {
			const banned = lib.config[lib.config.all.mode[i] + "_bannedcards"];
			if (banned) {
				for (let j = 0; j < banned.length; j++) {
					// @ts-expect-error Array.prototype.add 是 noname 运行时扩展（去重 push）
					lib.cardPack.mode_banned.add(banned[j]);
				}
			}
		}
		items.push({
			name: lib.translate["mode_banned_card_config"] || "封禁卡牌",
			key: "mode_banned",
			attrs: { hidden: lib.cardPack.mode_banned.length === 0 },
		});
		// @ts-expect-error 删除临时属性
		delete lib.cardPack.mode_banned;
	}

	// ---- 2. 常规卡牌包（旧版 494-498） ----
	for (let i = 0; i < lib.config.all.cards.length; i++) {
		const packName = lib.config.all.cards[i];
		if (connectMenu && !lib.connectCardPack.includes(packName)) {
			continue;
		}
		items.push(createLeftPaneItem(packName));
	}

	// ---- 3. 非联机补充（旧版 500-508） ----
	if (!connectMenu) {
		Object.keys(lib.cardPack).forEach((key) => {
			if (!lib.config.all.cards.includes(key)) {
				items.push(createLeftPaneItem(key));
			}
		});
	}

	// ---- 4. "牌堆" 项（旧版 524-548，仅非联机） ----
	if (!connectMenu) {
		// 旧版将 "牌堆" 插在 lefttext（全部开启/关闭/恢复默认）之前，
		// 这里先追加 "牌堆"，再在下面追加批量开关动作项，整体顺序与旧版一致。
		// CardPackPane 中通过 ctx.item.key === "cardpile" 判断特殊渲染。
		items.push({
			name: "牌堆",
			key: "cardpile",
		});
	}

	// ---- 5. 批量开关动作项（旧版 650-667 的 3 个 .lefttext 按钮，仅非联机） ----
	// key 用下划线前缀保留值，不会与卡牌包名冲突；
	// attrs.action 供 LeftPaneItem 加 .lefttext 样式，attrs.onClick 由
	// MenuView.onLeftItemClick 拦截执行（不参与左栏选中态）。
	if (!connectMenu) {
		items.push(
			{ name: "全部开启", key: "_batch_on", attrs: { action: true, onClick: () => batchToggleCardPacks("on") } },
			{ name: "全部关闭", key: "_batch_off", attrs: { action: true, onClick: () => batchToggleCardPacks("off") } },
			{ name: "恢复默认", key: "_batch_default", attrs: { action: true, onClick: () => batchToggleCardPacks("default") } },
		);
	}

	return items;
}

/**
 * 创建单个卡牌包的 LeftPaneItem。
 * @param mode 卡牌包名
 */
function createLeftPaneItem(mode: string): LeftPaneItem {
	const name = lib.translate[mode + "_card_config"] || mode;
	return { name, key: mode };
}

/**
 * 获取默认激活项的 key。
 * 对应旧版 510-517：选第一个非隐藏项。
 */
function getDefaultActiveKey(
	leftPaneData: LeftPaneItem[],
	_connectMenu: boolean,
): string | null {
	// 旧版：选第一个非 display:none 的项
	// Vue 版：过滤掉 attrs.hidden 的项，返回第一个的 key（或 null 表示选第一个）
	const visible = leftPaneData.filter(
		(item) => !item.attrs || !item.attrs.hidden,
	);
	if (visible.length === 0) return null;
	return visible[0].key;
}

// ---------------------------------------------------------------------------
// refreshCardPack —— 外部 API 兼容
// 对应旧版 676-690 的返回值函数，被 ui.updateCardPackMenu.push() 调用
// （push 注册已在 index.ts 的 menu() 中接入）。
// 已按 characterPack 范式接入响应式左栏：新卡牌包动态加载后，
// 追加到模块级 _leftPaneItems 并通过 triggerUpdate() 驱动左栏实时刷新。
// ---------------------------------------------------------------------------

/**
 * 刷新卡牌包列表（动态加载新卡牌包时调用）。
 * 对应旧版 cardPackMenu.js:676-690 的返回函数。
 * 判断菜单栏有没有加载过这个卡牌包，没有则加入左栏数据。
 *
 * @param packName 新加载的卡牌包名
 * @param connectMenu 是否联机
 */
export function refreshCardPack(packName: string, connectMenu: boolean): void {
	if (_leftPaneItems.some(item => item.key === packName)) {
		return;
	}
	if (!lib.connectCardPack.includes(packName) && !lib.config.all.cards.includes(packName)) {
		if (!(connectMenu && ["mode_derivation", "mode_banned"].includes(packName))) {
			const newItem = {
				name: lib.translate[packName + "_card_config"] || packName,
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
		}
		if (connectMenu) {
			// @ts-expect-error Array.prototype.add 是 noname 运行时扩展
			lib.connectCardPack.add(packName);
		}
		triggerUpdate();
	}
}

// ---------------------------------------------------------------------------
// I2: 批量操作函数（全部开启/全部关闭/恢复默认）
// 对应旧版卡牌包左栏底部的 3 个 .lefttext 按钮。
// 已通过 buildLeftPaneData 末尾的动作项接入左栏 UI。
// ---------------------------------------------------------------------------

/**
 * 批量切换卡牌包开启状态。
 * @param mode "on" 全部开启 | "off" 全部关闭 | "default" 恢复默认
 */
export function batchToggleCardPacks(mode: "on" | "off" | "default"): void {
	// 旧版对应 cardPackMenu.js:652-663 的 3 个 .lefttext 按钮回调：
	// 一次 saveConfig 完成（saveConfig 本身会写入 lib.config.cards 并持久化）
	const all = lib.config.all.cards || [];
	if (mode === "on") {
		// 全部开启：与旧版一致，集合来源为 lib.config.all.cards
		// （slice 拷贝避免与 all.cards 共享数组引用）
		game.saveConfig("cards", all.slice());
	} else if (mode === "off") {
		// 全部关闭：与旧版一致，清空 lib.config.cards
		game.saveConfig("cards", []);
	} else {
		// 恢复默认：旧版为 game.saveConfig("cards", lib.config.defaultcards)
		game.saveConfig("cards", lib.config.defaultcards);
	}
	// 驱动左栏按最新 config 刷新（与 characterPack 版行为一致）
	triggerUpdate();
}
