import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type { ChooseBase } from "../type.js";

export interface EventConnectCardsParams {
	cards?: Card[];
	source?: Player;
	log?: boolean;
}

export interface EventResetConnectCardsParams {
	cards?: Card[];
	source?: Player;
	log?: boolean;
}

export interface EventAddShownCardsParams {
	cards?: Card[];
	gaintag?: string[];
}

export interface EventHideShownCardsParams {
	cards?: Card[];
	gaintag?: string[];
}

export interface EventDisableEquipParams {
	source?: Player;
	slots?: string[];
}

export interface EventEnableEquipParams {
	source?: Player;
	slots?: string[];
}

export interface EventExpandEquipParams {
	source?: Player;
	slots?: string[];
}

export interface EventMoveCardParams extends ChooseBase {
	sourceTargets?: Player[];
	aimTargets?: Player[];
	canReplace?: boolean;
	targetprompt?: string[];
	filter?(card: Card | VCard): boolean;
}

export interface EventUseCardParams {
	card: Card | VCard;
	cards?: Card[];
	targets: Player[];
	skill?: string;
	addCount?: boolean;
	noai?: boolean;
	nowuxie?: boolean;
}

export interface EventUseSkillParams {
	skill: string;
	card?: Card | VCard;
	cards?: Card[];
	targets?: Player[];
	addCount?: boolean;
}

export interface EventDrawParams {
	num?: number;
	source?: Player;
	gaintag?: string[];
	drawDeck?: number;
	visible?: boolean;
	bottom?: boolean;
	nodelay?: boolean;
}

export type EventDrawToParams = Omit<EventDrawParams, "num">;

export interface EventRandomDiscardParams {
	/** 要弃置的牌数，默认为1 */
	num?: number;
	/** 弃牌来源，令Player弃牌的角色，默认目标角色 */
	discarder?: Player;
	/** 弃牌区域，默认 "he" */
	position?: string;
	/** 是否纯随机，否则优先弃置能弃置的牌 */
	random?: boolean;
	/** 因对应Mod技能导致部分牌未被弃置时，是否为Mod技能执行对应函数。默认"popup" */
	log?: string | "popup" | "logSkill" | false;
}

export interface EventLoseToDiscardpileParams {
	cards?: Card[];
	source?: Player;
	position?: HTMLDivElement | DocumentFragment;
	blank?: boolean;
	animate?: boolean;
	notBySelf?: boolean;
	insert_card?: boolean;
}

export interface EventRandomGainParams {
	/** 要获得牌的角色 */
	target: Player;
	/** 要获得的牌数，默认为1 */
	num?: number;
	/** 弃牌区域，默认 "he" */
	position?: string;
	/** 是否在获取时显示指示线 */
	line?: boolean;
}

export interface EventDiscardParams {
	/** 要弃置的牌 */
	cards: Card[];
	/** 弃牌来源，令Player弃牌的角色 */
	discarder?: Player;
	/** 经Mod筛选后的牌要置入的区域，默认ui.discardPile */
	position?: HTMLDivElement | DocumentFragment;
	/** 是否是他人弃置。discarder设置后会自动判断 */
	notBySelf?: boolean;
}

export interface EventModedDiscardParams {
	/** 要弃置的牌 */
	cards: Card[];
	/** 弃牌来源，令Player弃牌的角色。默认目标角色 */
	discarder?: Player;
	/** 经Mod筛选后的牌要置入的区域，默认`ui.discardPile` */
	position?: HTMLDivElement | DocumentFragment;
	/** 因对应Mod技能导致部分牌未被弃置时，是否为Mod技能执行对应函数。默认`"popup"` */
	log?: string | "popup" | "logSkill" | false;
}

export interface EventRespondParams {
	cards?: Card[];
	card?: Card | VCard | CardBaseUIData;
	source?: Player | null;
	skill?: string;
	animate?: boolean;
	highlight?: boolean;
	noOrdering?: boolean;
}

/** 获取牌时可用的动画 */
export type GainAnimate = "draw" | "gain" | "gain2" | "draw2" | "give" | "giveAuto" | ((event: GameEvent) => number | Promise<void>);

export interface EventGainParams {
	cards?: Card[];
	source?: Player;
	animate?: GainAnimate;
	gaintag?: string[];
	log?: boolean;
	areaNames?: string[];
	fromStorage?: boolean;
	bySelf?: boolean;
	delay?: boolean;
}

export interface EventAddToExpansionParams {
	cards?: Card[];
	source?: Player;
	gaintag?: string[];
	animate?: GainAnimate;
	fromStorage?: boolean;
	areaNames?: string[];
	log?: boolean;
	bySelf?: boolean;
	delay?: boolean;
}

export interface EventLoseParams {
	source?: Player;
	cards?: Card[];
	position?: HTMLDivElement | DocumentFragment;
	toStorage?: boolean;
	areaNames?: string[];
	visible?: boolean;
	insert_card?: boolean;
}

export interface EventDamageParams {
	cards?: Card[];
	card?: Card | VCard;
	num?: number;
	source?: Player;
	nature?: string;
	notrigger?: boolean;
	nocard?: boolean;
	nosource?: boolean;
	nohujia?: boolean;
	unreal?: boolean;
}

export interface EventRecoverParams {
	num?: number;
	card?: Card | VCard;
	cards?: Card[];
	source?: Player;
	nocard?: boolean;
	nosource?: boolean;
}

export type EventRecoverToParams = Omit<EventRecoverParams, "num">;

export interface EventLoseMaxHpParams {
	num?: number;
	forced?: boolean;
}

export interface EventGainMaxHpParams {
	num?: number;
	forced?: boolean;
}

export interface EventJudgeParams {
	card?: Card | VCard;
	skill?: string;
	clearArena?: boolean;
	position?: HTMLDivElement | DocumentFragment;
	judge?(card: Card): number;
	judge2?(result: Partial<Result>): boolean | undefined;
}
