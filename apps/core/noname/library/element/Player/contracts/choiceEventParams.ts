import type { Button, Card, Dialog, GameEvent, Player, VCard } from "../../index.js";
import type { BroadSelect, CheckButtonParams, CheckButtonTargetParams, CheckCardParams, CheckCardTargetParams, CheckTargetParams, ChooseBase } from "../type.js";

export interface EventChooseToDebateParams {
	list: Player[];
	args: any[];
}

export interface EventChooseCooperationForParams {
	target: Player;
	cardlist?: string[];
	reason?: string;
}

export interface EventChooseToMoveParams extends ChooseBase {
	list: any[];
	forced?: boolean;
	allowChooseAll?: boolean;
	processAI?(list: any[]): any[] | false;
}

export type EventChooseToMoveNewParams = ChooseBase;

export interface EventChooseToEnableParams extends CheckButtonParams {
	source?: Player;
}

export interface EventChooseToDisableParams extends CheckButtonParams {
	source?: Player;
	horse?: boolean;
}

export interface EventChooseToUseParams extends ChooseBase, CheckCardTargetParams {
	chooseonly?: boolean;
	type?: string;
	targetRequired?: boolean;
	dying?: Player;
}

export interface EventChooseToRespondParams extends ChooseBase, CheckCardParams {
	nosource?: boolean;
	card?: CardBaseUIData;
}

export interface EventChooseToGiveParams extends ChooseBase, CheckCardParams {
	target: Player;
	chooseonly?: boolean;
	dialog?: Dialog;
}

export interface EventChooseToDiscardParams extends ChooseBase, CheckCardParams {
	useCache?: boolean;
	chooseonly?: boolean;
	dialog?: Dialog;
}

export interface EventChooseSkillParams extends ChooseBase {
	func?: (...args: any[]) => unknown;
}

export interface EventDiscoverCardParams extends ChooseBase {
	use?: boolean;
	nogain?: boolean;
	num?: number;
	ai?(card: Card): number;
}

export interface EventChooseCardButtonParams extends ChooseBase {
	cards: Card[];
	select?: BroadSelect | (() => BroadSelect);
	filter?(button: Button, player: Player): boolean;
	ai?(button: Button): number;
}

export interface EventChooseVCardButtonParams extends ChooseBase {
	list: string[];
	notype?: boolean;
	select?: BroadSelect | (() => BroadSelect);
	filter?(button: Button, player: Player): boolean;
	ai?(button: Button): number;
}

export interface EventChooseButtonParams extends ChooseBase, CheckButtonParams {
	complexSelect?: boolean;
	dialog?: Dialog;
	direct?: boolean;
	createDialog?: any[];
	processAI?(): Partial<Result>;
}

export interface EventChooseCardParams extends ChooseBase, CheckCardParams {
	glow_result?: boolean;
}

export interface EventChooseCardOLParams extends EventChooseCardParams {
	list: Player[];
	args?: any[];
}

export interface EventChooseUseTargetParams extends ChooseBase, CheckTargetParams {
	cards?: Card[];
	card?: Card | VCard;
	nopopup?: boolean;
	animate?: boolean;
	throw?: boolean;
	nodistance?: boolean;
	noTargetDelay?: boolean;
	nodelayx?: boolean;
	addCount?: boolean;
}

export interface EventChooseTargetParams extends ChooseBase, CheckTargetParams {
	dialog?: Dialog;
}

export interface EventChooseCardTargetParams extends ChooseBase, CheckCardTargetParams {}

export interface EventChooseButtonTargetParams extends ChooseBase, CheckButtonTargetParams {}

export interface EventChooseControlListParams extends ChooseBase {
	list?: string[];
	ai?(event: GameEvent, player: Player): string | number;
}

export interface EventChooseControlParams extends ChooseBase {
	forced?: undefined;
	controls?: string[];
	choiceList?: string[];
	choice?: number;
	dialog?: Dialog;
	dialogcontrol?: boolean;
	seperate?: boolean;
	ai?(event: GameEvent, player: Player): string | number;
}

export interface EventChooseBoolParams extends ChooseBase {
	choice?: boolean;
	dialog?: Dialog;
	ai?(event: GameEvent, player: Player): boolean;
}

export interface EventChooseDrawRecoverParams extends ChooseBase {
	num1?: number;
	num2?: number;
	target?: Player;
	gaintag?: string[];
	ai?(event: GameEvent, player: Player): "draw_card" | "recover_hp" | "cancel2";
}

export interface ChooseNumbersObject {
	prompt: string;
	min: number;
	max: number;
}

export interface EventChooseNumbersParams extends ChooseBase {
	list: ChooseNumbersObject[];
	optionSum?: number;
	processAI?(event: GameEvent): false | number[];
	filterSelect?(num: number, index: number, event: GameEvent): boolean;
	filterOk?(event: GameEvent): boolean;
}

export interface EventChoosePlayerCardParams extends ChooseBase, CheckButtonParams {
	target: Player;
	position?: string;
	visible?: boolean;
	complexSelect?: boolean;
}

export type EventDiscardPlayerCardParams = EventChoosePlayerCardParams;

export interface EventGainPlayerCardParams extends EventChoosePlayerCardParams {
	visibleMove?: boolean;
}
