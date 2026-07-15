import { markRaw, type Component } from "vue";
import type { menuData, LeftPaneItem, RightPaneContext } from "../types";
import { lib, game } from "noname";
import { setUpdateActiveCard } from "../index.js";
import CardPackPane from "../components/CardPackPane.vue";

// ---------------------------------------------------------------------------
// 纯数据层 —— 构建左栏 LeftPaneItem[]、注册 updateActiveCard / updateNodes
// 右栏渲染由 CardPackPane.vue 负责（rightPaneComponent）
// ---------------------------------------------------------------------------

/** 已构建的卡牌包名集合（用于 refreshCardPack 去重） */
const _createdPackNames: string[] = [];

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
	// Vue 版的 leftPaneData 只构建一次，.off 状态由 CardPackPane 内部处理。
	// 因此此处不再需要 updateNodes，togglePack 直接操作 lib.config 即可。

	// ---- 旧版 44-59: setUpdateActiveCard ----
	// Vue 版：updateActiveCard 不再需要遍历 DOM childElementCount，
	// 而是在切换左栏项时通过 computed 重新渲染 CardPackPane。
	// 但旧版 updateActiveCard 仍被 index.js:529 调用链间接依赖（阶段 6 切换后移除）。
	// 保留一个空实现以保持接口兼容。
	setUpdateActiveCard(function (_node?: any) {
		// Vue 版：CardPackPane 通过 watch ctx.item.key 自动重新渲染，
		// 不需要遍历 DOM 节点调用 updateBanned。
	});

	// ---- 构建左栏数据 ----
	const leftPaneData = buildLeftPaneData(connectMenu);

	// ---- 默认激活项 ----
	// 对应旧版 510-517：选第一个非隐藏项
	const defaultActiveKey = getDefaultActiveKey(leftPaneData, connectMenu);

	// ---- 返回 menuData ----
	return {
		leftPaneData,
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
		// 记录已创建
		_createdPackNames.push(packName);
	}

	// ---- 3. 非联机补充（旧版 500-508） ----
	if (!connectMenu) {
		Object.keys(lib.cardPack).forEach((key) => {
			if (!lib.config.all.cards.includes(key)) {
				items.push(createLeftPaneItem(key));
				_createdPackNames.push(key);
			}
		});
	}

	// ---- 4. "牌堆" 项（旧版 524-548，仅非联机） ----
	if (!connectMenu) {
		// "牌堆" 插在 lefttext（全部开启/关闭/恢复默认）之前，
		// 但 Vue 版的 lefttext 不作为 LeftPaneItem（它们是按钮），
		// 所以直接追加到末尾即可。
		// CardPackPane 中通过 ctx.item.key === "cardpile" 判断特殊渲染。
		items.push({
			name: "牌堆",
			key: "cardpile",
		});
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
// 对应旧版 676-690 的返回值函数，被 ui.updateCardPackMenu.push() 调用。
// TODO: 阶段 6 接入 —— 当新卡牌包动态加载后，需要把新包追加到 leftPaneData
// 并触发 Vue 响应式更新。当前阶段（阶段 3F）只做标记，
// 实际接入需要 leftPaneData 改为 reactive（如 Ref<LeftPaneItem[]>）。
// ---------------------------------------------------------------------------

/**
 * 刷新卡牌包列表（动态加载新卡牌包时调用）。
 * 对应旧版 cardPackMenu.js:676-690 的返回函数。
 *
 * @param packName 新加载的卡牌包名
 * @param connectMenu 是否联机
 */
export function refreshCardPack(packName: string, connectMenu: boolean): void {
	// TODO: 阶段 6 接入 —— 将新 packName 追加到 leftPaneData（需要 reactive）
	// 当前阶段 leftPaneData 在 createCardPackMenuData 调用时一次性构建，
	// 不支持动态更新。
	// 阶段 6 接入时：
	//   1. 将 leftPaneData 改为 reactive/ref
	//   2. 此函数追加新 LeftPaneItem 到 leftPaneData
	//   3. 检查是否需要更新 lib.connectCardPack
	if (!lib.connectCardPack.includes(packName) && !lib.config.all.cards.includes(packName)) {
		if (!(connectMenu && ["mode_derivation", "mode_banned"].includes(packName))) {
			_createdPackNames.push(packName);
		}
		if (connectMenu) {
			// @ts-expect-error Array.prototype.add 是 noname 运行时扩展
			lib.connectCardPack.add(packName);
		}
	}
}

// ---------------------------------------------------------------------------
// I2: 批量操作函数（全部开启/全部关闭/恢复默认）
// 对应旧版卡牌包左栏底部的 3 个 .lefttext 按钮。
// TODO: 阶段 4/6 在左栏 UI 中接入这些函数（如 LeftPaneItem 支持按钮类型，
//   或在 CardPackPane 底部渲染按钮）。
// ---------------------------------------------------------------------------

/**
 * 批量切换卡牌包开启状态。
 * @param mode "on" 全部开启 | "off" 全部关闭 | "default" 恢复默认
 */
export function batchToggleCardPacks(mode: "on" | "off" | "default"): void {
	// TODO: 阶段 4/6 左栏 UI 接入 —— 当前仅导出数据层函数
	// 旧版对应 index.js 的 allCard / removeCard / restoreCard
	const all = lib.config.all.cards || [];
	if (mode === "on") {
		// 全部开启：将所有卡牌包加入 lib.config.cards
		lib.config.cards = all.slice();
		game.saveConfig("cards", lib.config.cards);
	} else if (mode === "off") {
		// 全部关闭：清空 lib.config.cards
		lib.config.cards = [];
		game.saveConfig("cards", lib.config.cards);
	} else {
		// 恢复默认
		game.saveConfig("cards", game.getDefaultConfig("cards"));
	}
}
