import { lib, game, get } from "noname";
import type { OptionPair } from "../shared/entityOptions.js";

export interface PileCardItem {
	card: any[];
	label: string;
	enabled: boolean;
	index: number;
}

export interface AddedPileItem {
	card: any[];
	label: string;
}

export const PILE_SUIT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "heart", label: "红桃" },
	{ value: "diamond", label: "方片" },
	{ value: "club", label: "梅花" },
	{ value: "spade", label: "黑桃" },
];

export const PILE_NUMBER_OPTIONS: ReadonlyArray<number> = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function customCardPileMap(): Record<string, any> {
	// @ts-expect-error customcardpile 是运行时动态属性
	return lib.config.customcardpile;
}

function bannedPileMap(): Record<string, number[]> {
	// @ts-expect-error bannedpile 是运行时动态属性
	return lib.config.bannedpile;
}

function addedPileMap(): Record<string, any[]> {
	// @ts-expect-error addedpile 是运行时动态属性
	return lib.config.addedpile;
}

/** 将内存中的禁用/附加牌堆写回「当前牌堆」方案并持久化。 */
export function syncCurrentCustomPile(): void {
	customCardPileMap()["当前牌堆"] = [bannedPileMap(), addedPileMap()];
	game.saveConfig("customcardpile", customCardPileMap());
	game.saveConfig("cardpilename", "当前牌堆", true);
}

/** 确保指定卡牌包在 bannedpile / addedpile 中存在数组容器。 */
export function ensureModePileConfig(mode: string): void {
	const banned = bannedPileMap();
	if (!banned[mode]) banned[mode] = [];
	const added = addedPileMap();
	if (!added[mode]) added[mode] = [];
}

/** 格式化牌堆行展示文案。 */
export function formatPileCardLabel(card: any[], useStrNumber = true): string {
	const nature = card[2] === "sha" && card[3] ? get.translation(card[3]) : "";
	const numText = useStrNumber ? get.strNumber(card[1]) : String(card[1]);
	return `${nature}${get.translation(card[2])} ${get.translation(card[0])}${numText}`;
}

export function loadModeAddedCards(mode: string): AddedPileItem[] {
	ensureModePileConfig(mode);
	return addedPileMap()[mode].map((card: any[]) => ({
		card,
		label: formatPileCardLabel(card, false),
	}));
}

export function loadModeDefaultCards(mode: string): PileCardItem[] {
	// @ts-expect-error lib.cardPile 是运行时对象
	const pile = lib.cardPile[mode];
	if (!Array.isArray(pile)) return [];
	const banned = bannedPileMap()[mode] || [];
	return pile.map((card: any[], index: number) => ({
		card,
		label: formatPileCardLabel(card, true),
		enabled: !banned.includes(index),
		index,
	}));
}

/** 构建可添加到牌堆的卡牌选项（将 sha 展开为火/雷/冰/刺杀）。 */
export function getAddableCardOptions(): OptionPair[] {
	const list: OptionPair[] = [];
	// @ts-expect-error lib.config.cards 是运行时扩展数组
	const enabledPacks = lib.config.cards || [];
	for (let i = 0; i < enabledPacks.length; i++) {
		const packName = enabledPacks[i];
		// @ts-expect-error lib.cardPack 是运行时对象
		const cards = lib.cardPack[packName];
		if (!cards) continue;
		for (let j = 0; j < cards.length; j++) {
			const cname = cards[j];
			list.push([cname, get.translation(cname)]);
			if (cname === "sha") {
				list.push(["huosha", "火杀"]);
				list.push(["leisha", "雷杀"]);
				list.push(["icesha", "冰杀"]);
				list.push(["cisha", "刺杀"]);
			}
		}
	}
	return list;
}

export function setModeCardEnabled(mode: string, index: number, enabled: boolean): void {
	ensureModePileConfig(mode);
	const list = bannedPileMap()[mode];
	if (enabled) {
		// @ts-expect-error Array.prototype.remove 是 noname 运行时扩展
		list.remove(index);
	} else {
		// @ts-expect-error Array.prototype.add 是 noname 运行时扩展
		list.add(index);
	}
	syncCurrentCustomPile();
}

export function addCardToModePile(mode: string, card: [string, number | string, string]): AddedPileItem {
	ensureModePileConfig(mode);
	addedPileMap()[mode].push(card);
	syncCurrentCustomPile();
	return { card, label: formatPileCardLabel(card, true) };
}

export function removeAddedCardAt(mode: string, index: number): void {
	const list = addedPileMap()[mode];
	if (!list || index < 0 || index >= list.length) return;
	list.splice(index, 1);
	syncCurrentCustomPile();
}

export function ensureGlobalPileContainers(): void {
	// @ts-expect-error bannedpile / addedpile 可能尚未初始化
	if (!lib.config.bannedpile) lib.config.bannedpile = [];
	// @ts-expect-error addedpile 可能尚未初始化
	if (!lib.config.addedpile) lib.config.addedpile = [];
}

export function getCustomPileKeys(): string[] {
	return Object.keys(customCardPileMap());
}

export function getAvailablePileOptions(): string[] {
	const options: string[] = ["默认牌堆"];
	const map = customCardPileMap();
	if (map["当前牌堆"] && !options.includes("当前牌堆")) {
		options.push("当前牌堆");
	}
	for (const key of Object.keys(map)) {
		if (!options.includes(key)) options.push(key);
	}
	return options;
}

export function resolveCurrentPileSelection(options: string[]): string {
	const current = get.config("cardpilename");
	if (current) return current;
	return options.includes("当前牌堆") ? "当前牌堆" : "默认牌堆";
}

export function deleteNamedCustomPile(name: string): void {
	const map = customCardPileMap();
	delete map[name];
	game.saveConfig("customcardpile", map);
	// @ts-expect-error mode_config 是运行时动态属性
	for (const modeName in lib.config.mode_config) {
		if (modeName === "global") continue;
		// @ts-expect-error mode_config 子属性是运行时动态属性
		if (lib.config.mode_config[modeName]?.cardpilename === name) {
			game.saveConfig("cardpilename", null, modeName);
		}
	}
}

export function saveNamedCustomPile(rawName: string): string {
	const map = customCardPileMap();
	let name = rawName;
	if (map[name] || name === "默认牌堆" || name === "当前牌堆") {
		for (let i = 1; i <= 1000; i++) {
			const candidate = `${name}(${i})`;
			if (!map[candidate]) {
				name = candidate;
				break;
			}
		}
	}
	map[name] = [bannedPileMap(), addedPileMap()];
	delete map["当前牌堆"];

	// @ts-expect-error lib.mode / mode_config 是运行时动态属性
	for (const modeName in lib.mode) {
		// @ts-expect-error mode_config 子属性是运行时动态属性
		const cfg = lib.config.mode_config[modeName];
		if (cfg && (cfg.cardpilename === "当前牌堆" || !cfg.cardpilename)) {
			game.saveConfig("cardpilename", name, modeName);
		}
	}
	game.saveConfig("customcardpile", map);
	return name;
}
