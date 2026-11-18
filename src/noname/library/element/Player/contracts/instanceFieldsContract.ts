import type { ChildNodesWatcher } from "../../../cache/childNodesWatcher.js";
import type { Card, Dialog, Player, VCard } from "../../index.js";

export type WatchedCardContainer = HTMLDivElement & {
	_childNodesWatcher?: ChildNodesWatcher;
};

export type AvatarQueueNode = HTMLDivElement & {
	_avatarqueue?: string[];
	_avatarqueueinterval?: ReturnType<typeof setInterval>;
};

export type MarkNode = HTMLDivElement & {
	markcount?: HTMLDivElement;
	name?: string;
	markidentifer?: string;
	info?: { fixed?: boolean };
};

export type DiceRoll = (this: DiceNode, degrees: number | number[]) => void;

export type DiceNode = HTMLDivElement & {
	current: number[];
	roll: DiceRoll;
	over?: boolean;
	resumed?: boolean;
};

export type ThrownNodeMap = {
	cardsetion?: HTMLDivElement;
	throw_id?: number | string;
	name2?: object;
	range?: object;
};

export type ThrowInitData = [string | null | undefined, number | string | null | undefined, string, string | boolean | null | undefined];

/** 动画节点可以是普通 div；这些扩展字段来自运行时 DOM，不在这里假定其完整形状。 */
export type ThrownDomNode = HTMLDivElement & {
	_cardid?: unknown;
	selectedt?: unknown;
	node?: unknown;
	init?: unknown;
	_customintro?: unknown;
};

/** 临时获得动画节点不是真实卡牌，只复用卡牌的两个移动方法。 */
export type GainAnimationNode = HTMLDivElement & Pick<Card, "moveTo" | "moveDelete">;

/** 运行时标记可以是普通 div；其自定义字段需要在各自消费者处验证。 */
export type MarkDomNode = HTMLDivElement & {
	name?: unknown;
	markidentifer?: unknown;
	info?: unknown;
	markcount?: unknown;
	delete?: unknown;
};

export type TempSkillExpireFilter = (event: RuntimeGameEvent, player: Player, triggername: string) => boolean;
export type TempSkillExpire = Signal | Signal[] | SkillTrigger | TempSkillExpireFilter;
export type StoredTempSkillExpire = SkillTrigger | TempSkillExpireFilter;

export type CardFilterInput = string | string[] | Record<string, any> | ((card: Card) => boolean);
export type VCardFilterInput = string | string[] | Record<string, any> | ((card: VCard) => boolean);

export type ActionHistoryArrayKey = Exclude<keyof ActionHistory, "isRound" | "isMe" | "isSkipped">;
export type ActionHistoryItem<K extends ActionHistoryArrayKey> = ActionHistory[K] extends Array<infer E> ? E : never;

export interface SubPlayerConfig {
	name: string;
	skills?: string[];
	hs?: Card[];
	intro?: string;
	intro2?: string;
	hp?: number;
	maxHp?: number;
	hujia?: number;
	oncall?: (this: Skill, event: RuntimeGameEvent, trigger: RuntimeGameEvent, player: Player) => any;
	onexit?: (this: Skill, event: RuntimeGameEvent, trigger: RuntimeGameEvent, player: Player) => any;
	getFilter?: (this: Skill, event: RuntimeGameEvent, player: Player, triggername: string) => boolean;
	check?: (this: Skill, event: RuntimeGameEvent, player: Player) => boolean;
	tag?: string[];
	sex?: string;
	group?: string;
	doubleGroup?: string[];
}

export interface PlayerPopupNameObject {
	name: string;
	nature?: string | boolean | null;
}

export type PlayerPopupInput = string | Card | VCard | CardBaseUIData | PlayerPopupNameObject;

declare module "../../player.js" {
	interface Player {
		/** 动态首次赋值并在 uninit/uninitOL 中使用 delete 清理的可选运行时字段（不作为构造期 own 字段） */
		singleHp?: boolean;
		avatar?: string | null;
		skin?: { name?: string; name2?: string };
		playerid?: string;
		nickname?: string | null;
		_giveUp?: boolean;
		serving?: boolean;
		roomempty?: boolean;
		roomfull?: boolean;
		roomgaming?: boolean;
		version?: string | number;
		key?: string;
		config?: Record<string, any>;
		queueTimeout?: ReturnType<typeof setTimeout>;
		outSkills?: string[];
		torespond?: Record<string, (...args: any[]) => void>;
		waitForResult?: (...args: any[]) => void;
		_hookTrigger?: string[];
		subPlayers?: Record<string, any>;
	}
}
