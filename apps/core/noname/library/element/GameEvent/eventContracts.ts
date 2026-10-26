import type { GameEvent } from "../gameEvent.js";
import type { Player, Card, Button } from "../index.js";
import type { BroadSelect } from "../Player/type.js";
import type { EventCompiledContent } from "./compilers/IContentCompiler.js";
import type GameEventManager from "./GameEventManager.js";
import type { EventLogSkill } from "./logSkill.js";
import type { CardMoveCandidate } from "../../experimental/cardInput.js";

export type triggerSkillTodo = {
	skill: string;
	player: Player;
	priority: number;
	indexedData?: any;
};

export type triggerPlayerTodo<T extends Player | "firstDo" | "lastDo" = Player | "firstDo" | "lastDo"> = {
	player: T;
	todoList: triggerSkillTodo[];
	doneList: triggerSkillTodo[];
};

/**
 * The values that are actually stored in an event's `num` slot.  The generic
 * only describes that value domain; it never means that `num` has already
 * been assigned.  A required `num` comes solely from an actual producer write
 * (for example `initializeEvent`).
 */
export type GameEventNumberValue = number | ((player: Player) => number) | undefined;

/** Draw/respond use booleans; gain preserves legacy strings and its event callback. */
export type EventAnimation = boolean | string | ((event: GameEvent) => number | Promise<void>);

export type GameEventCustomCallbacks = {
	add: {
		button?: () => void;
		card?: () => void;
		confirm?: (bool: boolean) => void;
		target?: () => void;
		window?: (clicked?: boolean) => void;
	};
	replace: {
		button?: (button: HTMLDivElement) => void;
		card?: (card: Card) => void;
		confirm?: (bool: boolean) => void;
		target?: (player: Player, event?: MouseEvent | TouchEvent) => void;
		window?: () => void;
	};
};

export type GameEventSetValue = GameEventCustomCallbacks | object | string | number | boolean | null | undefined;

export type EventSelectionRange = BroadSelect | (() => BroadSelect);

export type EventButtonFilter = (button: Button, player: Player) => boolean;

export type EventCardFilter = (card: Card, player: Player, event?: GameEvent<GameEventNumberValue>) => boolean;

export type EventTargetFilter = (card: Card, player: Player, target: Player) => boolean;

/**
 * Legacy selection callbacks are installed by distinct choice-event
 * producers.  The event object carries only one slot, while those producers
 * legitimately call it with different values.  Method bivariance expresses
 * that existing callback boundary without pretending every individual choice
 * event accepts every value.
 */
export type LegacySelectionCallback<Value, Return> = {
	callback(value?: Value, values?: Value[]): Return;
}["callback"];

export type EventFinalFilter = LegacySelectionCallback<GameEvent<GameEventNumberValue> | Card[][], boolean>;

/**
 * Old extensions may preserve arbitrary choice state in these slots.  Core
 * only snapshots, restores and deletes the values; it never interprets them.
 */
export type LegacySelectionChoice = unknown;

export type EventSelectionState = {
	filterButton?: EventButtonFilter;
	selectButton?: EventSelectionRange;
	filterTarget?: EventTargetFilter;
	selectTarget?: EventSelectionRange;
	deadTarget?: boolean;
	chessForceAll?: boolean;
	filterCard?: EventCardFilter;
	selectCard?: EventSelectionRange;
	position?: string;
	fakeforce?: boolean;
	allowChooseAll?: boolean;
	complexSelect?: boolean;
	complexCard?: boolean;
	complexTarget?: boolean;
	ignoreMod?: boolean;
	filterCard2?: EventCardFilter;
	selectionSpec?: SelectionSpec | SelectionSpecFactory | true;
};

export type EventSelectionBackup = EventSelectionState & {
	forced?: boolean;
	_aiexclude: (string | Card)[];
	_buttonChoice?: LegacySelectionChoice;
	_cardChoice?: LegacySelectionChoice;
	_targetChoice?: LegacySelectionChoice;
	_skillChoice?: string[];
	/** Choice-specific content must validate this legacy callback before invoking it. */
	ai1?: unknown;
	/** Choice-specific content must validate this legacy callback before invoking it. */
	ai2?: unknown;
	filterOk?: EventFinalFilter;
	selectionSpecExists: boolean;
};

/**
 * Handler keys are legacy dynamic event-property names.  They are not all
 * `on*` keys: skill producers also register names such as `dcwumei_phase`.
 * The key is accepted by the handler methods only; it is deliberately not a
 * class index signature because the same event object also owns unrelated
 * DOM callbacks such as `onEnd01`.
 */
export type GameEventHandlerKey = string;

export type GameEventDefaultHandlerKey = `on${string}` | "";

export type GameEventHandler = (event: GameEvent<GameEventNumberValue>, option: { state?: "begin" | "end" }) => void;

export type GameEventSetEntry<N extends GameEventNumberValue> = {
	[K in keyof GameEventSetFields<N>]: readonly [key: K, value: GameEventSetFields<N>[K]];
}[keyof GameEventSetFields<N>];

/**
 * `getParent` historically returns a plain object when an optional ancestor is
 * absent.  Property reads on that object produce `undefined`, but it is not an
 * event and cannot provide event methods.
 */
export type GameEventParentFallback = {
	readonly [key: string]: undefined;
};

/**
 * Lifecycle and queue state shared by the event manager.  This deliberately
 * excludes rule payloads such as card, cards, targets and num: an event can
 * enter the queue before any producer has initialized those fields.
 */
export interface EventExecution {
	name: string;
	manager: GameEventManager;
	parent?: EventExecution;
	childEvents: EventExecution[];
	next: EventExecution[];
	after: EventExecution[];
	content?: EventCompiledContent;
	_trigger?: EventExecution;
	_triggered?: number | null;
	_result: GameEventIntermediateResult;
	finished?: boolean;
	forceDie?: boolean;
	includeOut?: boolean;
	step: number;
	_oncancel?: () => unknown;
	getDefaultHandlerType(): string;
	callHandler(type: string, event: EventExecution, option: { state?: "begin" | "end" }): void;
	updateStep(): void;
	finish(): void;
	clearStepCache(key?: string | null): void;
	waitNext(): Promise<Partial<Result> | void>;
}

/** A compiler runs only actual GameEvent instances, never arbitrary queue records. */
export type ActiveEventExecution = GameEvent<GameEventNumberValue> & EventExecution;

/**
 * Fields whose producers are currently known to initialize them before the
 * resulting event is returned.  Modules may augment this interface as they
 * document additional creation paths; it intentionally is not a string-keyed
 * bag of extension values.
 */
export interface EventCreationFields<N extends GameEventNumberValue = GameEventNumberValue> {
	player: Player | null | undefined;
	target: Player | "cardPile" | null | undefined;
	targets: Player[];
	card: Card | VCard;
	cards: CardMoveCandidate[];
	num: number | N | undefined;
	_trigger: GameEvent<GameEventNumberValue>;
	triggername: string;
	delay: boolean | undefined;
	targetRequired: boolean | undefined;
	nodelay: boolean | undefined;
	nodelayx: boolean | undefined;
	delayx: boolean | undefined;
	isDelay: boolean | undefined;
	nopopup: boolean | undefined;
	throw: boolean | undefined;
	noTargetDelay: boolean | undefined;
	targetDelay: boolean | undefined;
	postAi: boolean | undefined;
	all_excluded: boolean | undefined;
	insert_card: boolean | undefined;
	washCard: boolean | undefined;
	_triggeronly: boolean | undefined;
	popup: boolean | undefined;
	compareMeanwhile: boolean | undefined;
	compareMultiple: boolean | undefined;
	videoId: number | undefined;
	dialogid: number | undefined;
	discardid: number | undefined;
	animate: EventAnimation | undefined;
}

/**
 * Keys accepted by the legacy `set` API.  This is deliberately a closed map:
 * modules extend it only after documenting a real producer, rather than using
 * the class's legacy dynamic-property index as an escape hatch.
 */
export interface GameEventSetFields<N extends GameEventNumberValue = GameEventNumberValue> extends EventCreationFields<N> {
	custom: GameEventCustomCallbacks;
	hsskill: string;
	addCount: boolean | undefined;
	direct: boolean | undefined;
	visible: boolean | undefined;
	nojudge: boolean | undefined;
	forceDie: boolean | undefined;
	includeOut: boolean | undefined;
	nodistance: boolean | undefined;
	prompt2: string | undefined;
	centerprompt2: boolean | undefined;
	chooseonly: boolean | undefined;
	norestore: boolean | undefined;
}

export type EventCreationFieldInput<N extends GameEventNumberValue, T extends Partial<EventCreationFields<N>>> = T & Record<Exclude<keyof T, keyof EventCreationFields<N>>, never>;

export type GameDrawNumber = number | ((player: Player) => number);

export type GameDrawNumberValue = GameDrawNumber | undefined;

export type GameDrawSupportFields = {
	otherPile?: Record<
		string,
		{
			getCards?: (num?: number) => Card[];
			discard?: (card: Card) => void;
		}
	>;
	gaintag?: Record<string, string | string[] | ((num: number | undefined, cards: Card[]) => [Card[], string | string[]][])>;
	changeCard?: string | false;
	dialog?: Dialog;
	bool?: boolean;
	switchToAuto?: () => void;
};

/** The dynamic content entry can run before a caller has initialized num. */
export type RawGameDrawEvent = GameEvent<GameDrawNumberValue> & GameDrawSupportFields;

export type GameDrawFields = GameDrawSupportFields & {
	player: Player | null | undefined;
	num: GameDrawNumber;
	targets: Player[];
};

/**
 * This is still a GameEvent instance.  The intersection records assignments
 * made by the gameDraw producer; unlike an Omit-based structural view it
 * keeps the class's private identity and copy-constructor compatibility.
 */
export type GameDrawEvent = RawGameDrawEvent & GameDrawFields;

export type GameDrawEventDraft = RawGameDrawEvent;

/**
 * The small set of named content entries whose implementations have an
 * independently documented event-field requirement.  A literal name is
 * checked against these requirements; an arbitrary runtime string remains a
 * guarded dynamic-content entry and therefore carries no field promise.
 */
export interface EventContentFieldRequirements {
	gameDraw: GameDrawFields;
	/** The discard factory expands wrappers and writes this snapshot before binding. */
	cardsDiscard: { cards: CardMoveCandidate[] };
}

export type EventContentNameFor<E, Name extends string> = Name & (NoInfer<Name> extends keyof EventContentFieldRequirements ? (E extends EventContentFieldRequirements[NoInfer<Name>] ? Name : never) : Name);

export interface EventSelectionFields {
	customreplacetarget?: (player: Player, event?: MouseEvent | TouchEvent) => void;
	filterButton?: EventButtonFilter;
	selectButton?: EventSelectionRange;
	filterTarget?: EventTargetFilter;
	selectTarget?: EventSelectionRange;
	deadTarget?: boolean;
	chessForceAll?: boolean;
	filterCard?: EventCardFilter;
	selectCard?: EventSelectionRange;
	position?: string;
	fakeforce?: boolean;
	allowChooseAll?: boolean;
	complexSelect?: boolean;
	complexCard?: boolean;
	complexTarget?: boolean;
	ignoreMod?: boolean;
	filterCard2?: EventCardFilter;
	selectionSpec?: SelectionSpec | SelectionSpecFactory | true;
	_backup?: EventSelectionBackup;
	_buttonChoice?: LegacySelectionChoice;
	_cardChoice?: LegacySelectionChoice;
	_targetChoice?: LegacySelectionChoice;
	_skillChoice?: string[];
	/** Choice-specific content must validate this legacy callback before invoking it. */
	ai1?: unknown;
	/** Choice-specific content must validate this legacy callback before invoking it. */
	ai2?: unknown;
	filterOk?: EventFinalFilter;
}
