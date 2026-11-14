import type { Button, Card, GameEvent, Player, VCard } from "../../index.js";
import type {
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
	EventChooseToDiscardParams,
	EventChooseToGiveParams,
	EventChooseToMoveNewParams,
	EventChooseToMoveParams,
	EventChooseToRespondParams,
	EventChooseToUseParams,
	EventChooseUseTargetParams,
	EventChooseVCardButtonParams,
	EventDiscardPlayerCardParams,
	EventDiscoverCardParams,
	EventGainPlayerCardParams,
	EventMoveCardParams,
} from "../eventParams.js";
import type { LegacyChooseButtonToken, LegacyChooseControlToken, LegacyChooseTargetToken } from "../legacyParams.js";
import type { CardFilterInput, VCardFilterInput } from "./instanceFieldsContract.js";

export interface CooperationInfo {
	target: Player;
	type: string;
	reason?: any;
}

export type CanMoveCardExtraArg = Player | Player[] | CardFilterInput | VCardFilterInput | ((card: Card | VCard) => boolean) | "canReplace" | "noReplace" | string | undefined;

declare module "../../player.js" {
	interface Player {
		// choice/phase.ts (10)
		isPhaseUsing(notmeisok?: boolean): boolean;
		insertPhase(skill?: string, insert?: boolean): GameEvent;
		phase(skill?: string): GameEvent;
		phaseZhunbei(): GameEvent;
		phaseJudge(): GameEvent;
		phaseDraw(): GameEvent;
		phaseUse(): GameEvent;
		phaseDiscard(): GameEvent;
		phaseJieshu(): GameEvent;
		skip(name: string): void;

		// choice/chooseAction.ts (4)
		chooseToUse(params?: EventChooseToUseParams): GameEvent;
		chooseToUse(...args: any[]): GameEvent;
		chooseToRespond(params?: EventChooseToRespondParams): GameEvent;
		chooseToRespond(...args: any[]): GameEvent;
		chooseToGive(params: EventChooseToGiveParams): GameEvent;
		chooseToGive(...args: any[]): GameEvent;
		chooseToDiscard(params?: EventChooseToDiscardParams): GameEvent;
		chooseToDiscard(...args: any[]): GameEvent;

		// choice/compareAndCooperation.ts (7)
		chooseToDebate(params: EventChooseToDebateParams): GameEvent;
		chooseToDebate(...args: any[]): GameEvent;
		cooperationWith(target: Player, type: string, reason?: any): void;
		chooseCooperationFor(params: EventChooseCooperationForParams): GameEvent;
		chooseCooperationFor(...args: any[]): GameEvent;
		checkCooperationStatus(target: Player, reason?: any): boolean;
		removeCooperation(info: CooperationInfo): void;
		canCompare(target: Player, goon?: boolean, bool?: boolean): boolean;
		chooseToCompare(targetOrTargets: Player | Player[], check?: (card: Card) => number): GameEvent;

		// choice/chooseButton.ts (5)
		discoverCard(list?: string[] | string | ((card: string) => boolean) | null, params?: EventDiscoverCardParams): GameEvent;
		discoverCard(list?: string[] | string | ((card: string) => boolean) | null, ...args: any[]): GameEvent;
		chooseCardButton(params: EventChooseCardButtonParams): GameEvent;
		chooseCardButton(...args: any[]): GameEvent;
		chooseVCardButton(params: EventChooseVCardButtonParams): GameEvent;
		chooseVCardButton(...args: any[]): GameEvent;
		chooseButton(params: EventChooseButtonParams): GameEvent;
		chooseButton(...tokens: LegacyChooseButtonToken[]): GameEvent;
		chooseButtonOL(list: any[], callback?: (...args: any[]) => any, ai?: (button: Button) => number): GameEvent;

		// choice/chooseCardAndTarget.ts (6)
		chooseCardOL(params: EventChooseCardOLParams): GameEvent;
		chooseCardOL(...args: any[]): GameEvent;
		chooseCard(params?: EventChooseCardParams): GameEvent;
		chooseCard(...args: any[]): GameEvent;
		chooseUseTarget(params?: EventChooseUseTargetParams): GameEvent;
		chooseUseTarget(...args: any[]): GameEvent;
		chooseTarget(params: EventChooseTargetParams): GameEvent;
		chooseTarget(...tokens: LegacyChooseTargetToken[]): GameEvent;
		chooseCardTarget(params?: EventChooseCardTargetParams): GameEvent;
		chooseCardTarget(params?: EventChooseCardTargetParams & Record<string, any>): GameEvent;
		chooseButtonTarget(params?: EventChooseButtonTargetParams): GameEvent;
		chooseButtonTarget(params?: EventChooseButtonTargetParams & Record<string, any>): GameEvent;

		// choice/chooseControlAndNumbers.ts (6)
		chooseSkill(target: Player, params?: EventChooseSkillParams): GameEvent;
		chooseSkill(target: Player, ...args: any[]): GameEvent;
		chooseControlList(params?: EventChooseControlListParams): GameEvent;
		chooseControlList(...args: any[]): GameEvent;
		chooseControl(params: EventChooseControlParams): GameEvent;
		chooseControl(...tokens: LegacyChooseControlToken[]): GameEvent;
		chooseBool(params?: EventChooseBoolParams): GameEvent;
		chooseBool(...args: any[]): GameEvent;
		chooseDrawRecover(params?: EventChooseDrawRecoverParams): GameEvent;
		chooseDrawRecover(...args: any[]): GameEvent;
		chooseNumbers(params: EventChooseNumbersParams): GameEvent;
		chooseNumbers(...args: any[]): GameEvent;

		// choice/choosePlayerCard.ts (3)
		choosePlayerCard(params: EventChoosePlayerCardParams): GameEvent;
		choosePlayerCard(...args: any[]): GameEvent;
		discardPlayerCard(params: EventDiscardPlayerCardParams): GameEvent;
		discardPlayerCard(...args: any[]): GameEvent;
		gainPlayerCard(params: EventGainPlayerCardParams): GameEvent;
		gainPlayerCard(...args: any[]): GameEvent;

		// choice/moveAndMinigame.ts (8)
		chooseToPlayBeatmap(beatmap?: any, ...args: any[]): GameEvent;
		chooseToMove(params?: EventChooseToMoveParams): GameEvent;
		chooseToMove(...args: any[]): GameEvent;
		chooseToMove_new(params?: EventChooseToMoveNewParams): GameEvent;
		chooseToMove_new(...args: any[]): GameEvent;
		chooseToGuanxing(num?: number): GameEvent;
		chooseToDuiben(target: Player): GameEvent;
		chooseToPSS(target: Player): GameEvent;
		canMoveCard(withatt?: boolean | null, nojudge?: boolean | null, ...args: CanMoveCardExtraArg[]): boolean;
		moveCard(params?: EventMoveCardParams): GameEvent;
		moveCard(...args: any[]): GameEvent;
	}
}
