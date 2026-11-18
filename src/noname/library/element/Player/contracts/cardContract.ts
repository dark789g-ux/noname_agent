import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type {
	EventAddShownCardsParams,
	EventAddToExpansionParams,
	EventConnectCardsParams,
	EventDiscardParams,
	EventDrawParams,
	EventDrawToParams,
	EventGainParams,
	EventHideShownCardsParams,
	EventLoseParams,
	EventLoseToDiscardpileParams,
	EventModedDiscardParams,
	EventRandomDiscardParams,
	EventRandomGainParams,
	EventResetConnectCardsParams,
	EventRespondParams,
	EventUseCardParams,
	EventUseSkillParams,
} from "../eventParams.js";
import type { LegacyDiscardToken, LegacyGainToken, LegacyLoseToDiscardpileToken, LegacyLoseToken } from "../legacyParams.js";
import type { CardFilterInput, VCardFilterInput } from "./instanceFieldsContract.js";

export type VCardQueryFilter = VCardFilterInput | (string | undefined)[];
export type ConnectCardsLegacyToken = Card | Card[] | Player | boolean;
export type ShownCardsLegacyToken = Card | Card[] | string;
export type UseCardLegacyToken = Card | VCard | CardBaseUIData | Card[] | Player | Player[] | string | boolean | null | undefined;
export type UseSkillLegacyToken = Card | VCard | Card[] | Player[] | string | boolean | null | undefined;
export type RespondLegacyToken = Card | VCard | CardBaseUIData | Card[] | Player | string | boolean | null | undefined;
export type DrawLegacyToken = number | Player | boolean | "nodelay" | "visible" | "bottom" | { drawDeck?: number } | string | null | undefined;
export type RandomDiscardLegacyToken = number | Player | string | false | null | undefined;
export type ModedDiscardLegacyToken = Player | Card | Card[] | HTMLDivElement | DocumentFragment | string | false | null | undefined;
export type RandomGainLegacyToken = number | string | Player | boolean | null | undefined;
export type RecastCallback = (player: Player, cards: Card[]) => any;

declare module "../../player.js" {
	interface Player {
		// zoneQuery.ts (18)
		iterableGetVCards(arg1?: string, arg2?: VCardQueryFilter): Generator<VCard, void, unknown>;
		getVCards(arg1?: string, arg2?: VCardQueryFilter): VCard[];
		countVCards(arg1?: string, arg2?: VCardQueryFilter): number;
		iterableGetCards(position?: string, filter?: CardFilterInput): Generator<Card, void, unknown>;
		getCards(position?: string, filter?: CardFilterInput): Card[];
		iterableGetDiscardableCards(player: Player, position?: string, filter?: CardFilterInput): Generator<Card, void, unknown>;
		getDiscardableCards(player: Player, position?: string, filter?: CardFilterInput): Card[];
		iterableGetGainableCards(player: Player, position?: string, filter?: CardFilterInput): Generator<Card, void, unknown>;
		getGainableCards(player: Player, position?: string, filter?: CardFilterInput): Card[];
		countCards(position?: string, filter?: CardFilterInput): number;
		getCardIndex(arg1: string | undefined, name: string, card: Card, max?: number): number;
		countDiscardableCards(player: Player, position?: string, filter?: CardFilterInput): number;
		countGainableCards(player: Player, position?: string, filter?: CardFilterInput): number;
		hasCards(position?: string, filter?: CardFilterInput): boolean;
		hasDiscardableCards(player: Player, position?: string, filter?: CardFilterInput): boolean;
		hasGainableCards(player: Player, position?: string, filter?: CardFilterInput): boolean;
		hasCard(pattern: CardFilterInput, position?: string): boolean;
		hasVCard(name?: VCardQueryFilter, position?: string): boolean;

		// visibilityAndConnect.ts (21)
		connectCards(params?: EventConnectCardsParams): GameEvent;
		connectCards(...args: ConnectCardsLegacyToken[]): GameEvent;
		resetConnectedCards(params?: EventResetConnectCardsParams): GameEvent;
		resetConnectedCards(...args: ConnectCardsLegacyToken[]): GameEvent;
		iterableGetConnectedCards(): Generator<Card, void, unknown>;
		getConnectedCards(): Card[];
		countConnectedCards(): number;
		hasConnectedCards(): boolean;
		addShownCards(params?: EventAddShownCardsParams): GameEvent;
		addShownCards(...args: ShownCardsLegacyToken[]): GameEvent;
		hideShownCards(params?: EventHideShownCardsParams): GameEvent;
		hideShownCards(...args: ShownCardsLegacyToken[]): GameEvent;
		iterableGetShownCards(): Generator<Card, void, unknown>;
		getShownCards(): Card[];
		countShownCards(): number;
		hasShownCards(): boolean;
		iterableGetKnownCards(other?: Player | null, filter?: CardFilterInput): Generator<Card, void, unknown>;
		getKnownCards(other?: Player | null, filter?: CardFilterInput): Card[];
		isAllCardsKnown(other?: Player | null): boolean;
		hasKnownCards(other?: Player | null, filter?: CardFilterInput): boolean;
		countKnownCards(other?: Player | null, filter?: CardFilterInput): number;
		showHandcards(str?: string): GameEvent;
		showCards(cards: Card | Card[], str?: string, flashAnimation?: boolean, isFlash?: boolean): GameEvent;
		showCards(str: string, cards: Card | Card[], flashAnimation?: boolean, isFlash?: boolean): GameEvent;
		showCards(cards: Card | Card[] | string | undefined, str?: Card | Card[] | string, flashAnimation?: boolean, isFlash?: boolean): GameEvent;
		viewCards(str: string, cards: Card[]): GameEvent;
		viewHandcards(target: Player): GameEvent;

		// handAndSpecial.ts (18)
		sortHandcard(sort?: unknown): boolean | undefined;
		sortHandcardOL(sort?: unknown): void;
		canIgnoreHandcard(card: Card): boolean;
		gift(cards: Card | Card[], target: Player): GameEvent;
		canGift(card: Card, target: Player, strict?: boolean): boolean;
		refuseGifts(card: Card, player: Player): boolean;
		getGiftAIResultTarget(card: Card, target: Player): number;
		getGiftEffect(card: Card, target: Player): number;
		recast(cards: Card | Card[], recastingLose?: RecastCallback | null, recastingGain?: RecastCallback | null): GameEvent;
		canRecast(card: Card | VCard | CardBaseUIData, source?: Player | null, strict?: boolean): boolean;
		loseToSpecial(cards: Card[], tag: string, target?: Player): GameEvent;
		addGaintag(cards: Card | Card[], tag: string): void;
		removeGaintag(tag: string, cards?: Card | Card[]): void;
		getExpansions(tag: string): Card[];
		countExpansions(tag: string): number;
		hasExpansions(tag: string): boolean;
		getHandcardLimit(): number;
		needsToDiscard(add?: number | Card[] | Card, filter?: (card: Card, player: Player, cards: Card[]) => boolean, pure?: boolean): number;

		// usability.ts (9)
		canRespond(event: GameEvent, card?: Card | VCard | CardBaseUIData | string, type?: string | boolean): boolean | undefined;
		canSave(target: Player): boolean;
		canSaveCard(card: Card | VCard | CardBaseUIData, target: Player): boolean;
		hasUsableCard(name: string, type?: string | boolean): boolean;
		canUse(card: Card | VCard | CardBaseUIData | string, target: Player, distance?: boolean, includecard?: boolean | GameEvent): boolean;
		hasUseTarget(card: Card | VCard | CardBaseUIData | string, distance?: boolean, includecard?: boolean | GameEvent): boolean;
		hasValueTarget(card: Card | VCard | CardBaseUIData | string, distance?: boolean, includecard?: boolean | GameEvent): boolean;
		getUseValue(card: Card | VCard | CardBaseUIData | string, distance?: boolean, includecard?: boolean | GameEvent): number;
		getCardUsable(card: Card | VCard | CardBaseUIData | string, pure?: boolean): number;

		// aiEstimation.ts (10)
		addExpose(num: number): this;
		attitudeTo(target: Player): number;
		hasFriend(): boolean;
		hasUnknown(num?: number): boolean;
		isUnknown(player?: Player): boolean;
		hasWuxie(info?: unknown): boolean;
		hasSha(respond?: string | boolean, noauto?: boolean): boolean;
		hasShan(respond?: string | boolean): boolean;
		mayHaveSha(viewer?: Player | null, type?: "use" | "respond", ignore?: Card[] | Card | null, rvt?: "bool"): boolean;
		mayHaveSha(viewer: Player | null | undefined, type: "use" | "respond" | undefined, ignore: Card[] | Card | null | undefined, rvt: "count" | "odds"): number;
		mayHaveSha(viewer?: Player | null, type?: "use" | "respond", ignore?: Card[] | Card | null, rvt?: "bool" | "count" | "odds"): boolean | number;
		mayHaveShan(viewer?: Player | null, type?: "use" | "respond", ignore?: Card[] | Card | boolean | null, rvt?: "bool"): boolean;
		mayHaveShan(viewer: Player | null | undefined, type: "use" | "respond" | undefined, ignore: Card[] | Card | boolean | null | undefined, rvt: "count" | "odds"): number;
		mayHaveShan(viewer?: Player | null, type?: "use" | "respond", ignore?: Card[] | Card | boolean | null, rvt?: "bool" | "count" | "odds"): boolean | number;

		// useAndRespond.ts (4)
		useResult(result: Partial<Result> & Record<string, any>, event?: GameEvent): GameEvent | undefined;
		useCard(params: EventUseCardParams): GameEvent;
		useCard(...args: UseCardLegacyToken[]): GameEvent;
		useSkill(params: EventUseSkillParams): GameEvent;
		useSkill(...args: UseSkillLegacyToken[]): GameEvent;
		respond(params: EventRespondParams): GameEvent;
		respond(...args: RespondLegacyToken[]): GameEvent;

		// drawAndDiscard.ts (7)
		drawTo(num: number, args?: EventDrawToParams | DrawLegacyToken[]): GameEvent;
		draw(params?: number | EventDrawParams): GameEvent;
		draw(...args: DrawLegacyToken[]): GameEvent;
		randomDiscard(params?: EventRandomDiscardParams): GameEvent;
		randomDiscard(...args: RandomDiscardLegacyToken[]): GameEvent;
		discard(params: EventDiscardParams): GameEvent;
		discard(...tokens: LegacyDiscardToken[]): GameEvent;
		modedDiscard(params?: EventModedDiscardParams): GameEvent;
		modedDiscard(...args: ModedDiscardLegacyToken[]): GameEvent;
		loseToDiscardpile(params: EventLoseToDiscardpileParams): GameEvent;
		loseToDiscardpile(...tokens: LegacyLoseToDiscardpileToken[]): GameEvent;
		doubleDraw(): GameEvent;

		// gainAndExpansion.ts (5)
		randomGain(params?: EventRandomGainParams): GameEvent;
		randomGain(...args: RandomGainLegacyToken[]): GameEvent;
		gainMultiple(targets: Player[], position?: string): GameEvent;
		gain(params: EventGainParams): GameEvent;
		gain(...tokens: LegacyGainToken[]): GameEvent;
		addToExpansion(params?: EventAddToExpansionParams): GameEvent;
		addToExpansion(...tokens: LegacyGainToken[]): GameEvent;
		give(cards: Card | Card[], target: Player, visible?: boolean): GameEvent;

		// loseAndDirect.ts (6)
		swapHandcards(target: Player, cards1?: Card[], cards2?: Card[]): GameEvent;
		directequip(cards: Card | VCard | (Card | VCard)[]): void;
		$addToExpansion(cards: Card[], broadcast?: boolean | null, gaintag?: string[], check?: boolean): this;
		directgain(cards: Card[], broadcast?: boolean | null, gaintag?: string | string[]): this;
		directgains(cards: Card[], broadcast?: boolean | null, gaintag?: string | string[]): this;
		lose(params: EventLoseParams): GameEvent;
		lose(...tokens: LegacyLoseToken[]): GameEvent;
	}
}
