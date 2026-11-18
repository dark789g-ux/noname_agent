import type { Button, Card, Player } from "../index.js";

/**
 * 相比`Select`来说更加广泛的选择范围
 *
 * 当给定`number`时，表示精确选择该数量
 *
 * 当给定`[begin, end]`时，表示选择数量在该区间内
 */
export type BroadSelect = number | Select;

export interface CheckCardParams {
	/**
	 * 选择牌需要满足的条件
	 *
	 * 直接填true，则有些地方，会优先触发过滤可使用的卡牌，例如ui.click.skill,ai.basic.chooseCard
	 */
	filterCard?: boolean | ((card: Card, player: Player, event?: string) => boolean);

	/**
	 * 需要选择牌数量的范围
	 *
	 * 当值为-1时，表示选择所有满足条件的牌
	 */
	selectCard?: BroadSelect | (() => BroadSelect);

	/**
	 * 指定选择牌的位置
	 *
	 * 可选值为"hejsx"的字串全排序（"h"手牌、"e"装备、"j"判定、"s"特殊区、"x"武将牌上，及缩写"c"/"d"/"o"）
	 */
	position?: string;

	/**
	 * 选择牌的情况是否复杂
	 *
	 * 当该值为`true`时，`filterCard`和`selectCard`将在每选择一张牌后重新计算
	 */
	complexCard?: boolean;

	/**
	 * 是否允许选牌时可以使用全选/反选按钮
	 *
	 * 仅在`complexCard`不为`true`的情况下生效
	 */
	allowChooseAll?: boolean;

	/** AI选择牌时的优先级评分函数 */
	ai?(card: Card): number;
}

export interface CheckTargetParams {
	/** 选择的目标需要满足的条件 */
	filterTarget?: boolean | ((card: Card, player: Player, target: Player) => boolean);

	/** 需要选择目标的范围（当值为-1时，表示选择所有符合条件的目标） */
	selectTarget?: BroadSelect | (() => BroadSelect);

	/** 当该值为`true`时，`filterTarget`和`selectTarget`将在每选择一个目标后重新计算 */
	complexTarget?: boolean;

	/** AI选择目标时的优先级评分函数 */
	ai?(target: Player): number;
}

export interface CheckButtonParams {
	/** 选择的按钮需要满足的条件 */
	filterButton?(button: Button, player: Player): boolean;

	/** 需要选择按钮的范围（当值为-1时，表示选择所有符合条件的按钮） */
	selectButton?: BroadSelect | (() => BroadSelect);

	/** 是否允许选目标时可以使用全选/反选按钮 */
	allowChooseAll?: boolean;

	/** AI选择按钮时的优先级评分函数 */
	ai?(button: Button): number;
}

export interface CheckCardTargetParams extends CheckCardParams, CheckTargetParams {
	ai?: undefined;
	/** AI选择牌时的优先级评分函数 */
	ai1?(card: Card): number | void;
	/** AI选择目标时的优先级评分函数 */
	ai2?(target: Player): number;
}

export interface CheckButtonTargetParams extends CheckButtonParams, CheckTargetParams {
	ai?: undefined;
	/** AI选择按钮时的优先级评分函数 */
	ai1?(button: Button): number;
	/** AI选择目标时的优先级评分函数 */
	ai2?(target: Player): number;
}

export interface ChooseBase {
	forced?: boolean;
	prompt?: string;
	prompt2?: string;
}

export type {
	ChooseNumbersObject,
	EventAddShownCardsParams,
	EventAddToExpansionParams,
	EventChooseBoolParams,
	EventChooseButtonParams,
	EventChooseButtonTargetParams,
	EventChooseCardButtonParams,
	EventChooseCardOLParams,
	EventChooseCardParams,
	EventChooseCardTargetParams,
	EventChooseControlListParams,
	EventChooseControlParams,
	EventChooseCooperationForParams,
	EventChooseDrawRecoverParams,
	EventChooseNumbersParams,
	EventChoosePlayerCardParams,
	EventChooseSkillParams,
	EventChooseTargetParams,
	EventChooseToDebateParams,
	EventChooseToDisableParams,
	EventChooseToDiscardParams,
	EventChooseToEnableParams,
	EventChooseToGiveParams,
	EventChooseToMoveNewParams,
	EventChooseToMoveParams,
	EventChooseToRespondParams,
	EventChooseToUseParams,
	EventChooseUseTargetParams,
	EventChooseVCardButtonParams,
	EventConnectCardsParams,
	EventDamageParams,
	EventDisableEquipParams,
	EventDiscardParams,
	EventDiscardPlayerCardParams,
	EventDiscoverCardParams,
	EventDrawParams,
	EventDrawToParams,
	EventEnableEquipParams,
	EventExpandEquipParams,
	EventGainMaxHpParams,
	EventGainParams,
	EventGainPlayerCardParams,
	EventHideShownCardsParams,
	EventJudgeParams,
	EventLoseMaxHpParams,
	EventLoseParams,
	EventLoseToDiscardpileParams,
	EventModedDiscardParams,
	EventMoveCardParams,
	EventRandomDiscardParams,
	EventRandomGainParams,
	EventRecoverParams,
	EventRecoverToParams,
	EventResetConnectCardsParams,
	EventRespondParams,
	EventUseCardParams,
	EventUseSkillParams,
	GainAnimate,
} from "./eventParams.js";

export type {
	LegacyButtonGroup,
	LegacyButtonLink,
	LegacyButtonLinkAtom,
	LegacyCharacterSubstituteItem,
	LegacyChooseButtonAI,
	LegacyChooseButtonCreateDialog,
	LegacyChooseButtonFilter,
	LegacyChooseButtonToken,
	LegacyChooseControlAI,
	LegacyChooseControlToken,
	LegacyChooseTargetAI,
	LegacyChooseTargetFilter,
	LegacyChooseTargetToken,
	LegacyCreateButtonFactory,
	LegacyDialogAddItem,
	LegacyDialogAtom,
	LegacyDialogHandle,
	LegacyDiscardToken,
	LegacyGainToken,
	LegacyLoseToken,
	LegacyLoseToDiscardpileToken,
	LegacySkillItem,
	LegacyTDNodeItem,
	LegacyTextButtonItem,
	LegacyVCardItem,
} from "./legacyParams.js";
