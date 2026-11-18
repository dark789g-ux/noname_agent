import "./lifecycleAndPlayerContract.js";
import "./mediaAndIoContract.js";

export type GameHistoryEventKey = "cardMove" | "custom" | "useCard" | "changeHp" | "everything";

export type GlobalHistoryEvent<K extends GameHistoryEventKey> = K extends "everything" ? RuntimeGameEvent : GameEvent;

export type GameHistory = { [K in GameHistoryEventKey]: GlobalHistoryEvent<K>[] } & { isRound?: boolean };

export type Video = {
	name?: string;
	type: string;
	player?: string;
	content?: string | any[];
	delay: number;
};

export type Videos = {
	mode: string;
	name: string[];
	name1: string | undefined;
	name2?: string;
	time: number;
	video: Video[];
	win: boolean;
	starred?: boolean;
};

export type HistoryLogNode = HTMLDivElement & {
	node: {
		avatar?: HTMLDivElement;
		avatar2?: HTMLDivElement;
		text?: HTMLDivElement;
	};
	logvid: string;
	added: (string | Card[] | [Card | VCard, Card[]])[];
	cards?: Card[];
	players?: Player[];
	targets?: Player[] | (Card | VCard)[];
	type?: string;
	skill?: string;
	player?: Player;
	source?: Player | Player[] | (Card | VCard)[];
	dead?: boolean;
	removetimeout?: ReturnType<typeof setTimeout>;
};

export type ArenaLogNode = HTMLDivElement & {
	timeout?: number;
};

/**
 * 卡牌配置数据（lib.card[name] 的元素）。
 * 区别于运行时 Card 实例：这是纯数据对象，描述卡牌的静态属性。
 */
export interface CardData {
	audio?: boolean | string;
	image?: string;
	fullskin?: boolean;
	fullimage?: boolean;
	cardimage?: string;
	type?: string;
	subtype?: string;
	nature?: string;
	enable?: boolean;
	distance?: string;
	range?: string;
	content?: unknown;
	derive?: unknown;
	ai?: unknown;
	exportimage?: unknown;
	skills?: Record<string, unknown>;
	tags?: Record<string, unknown>;
}
