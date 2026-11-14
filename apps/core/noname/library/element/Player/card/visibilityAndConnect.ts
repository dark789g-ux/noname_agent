import { _status, game, get } from "noname";
import type { Card, GameEvent, Player } from "../../index.js";
import type { ConnectCardsLegacyToken, ShownCardsLegacyToken } from "../contracts/cardContract.js";
import type { CardFilterInput } from "../contracts/instanceFieldsContract.js";
import type {
	EventAddShownCardsParams,
	EventConnectCardsParams,
	EventHideShownCardsParams,
	EventResetConnectCardsParams,
} from "../eventParams.js";
import "../contracts/cardContract.js";

type ConnectCardsEvent = GameEvent & {
	cards?: Card[];
	log?: boolean;
};

type ShownCardsEvent = GameEvent & {
	cards: Card[];
	gaintag: string[];
};

type ShowCardsMapEntry =
	| {
			cardPile: Card[];
			discardPile: Card[];
			ordering: Card[];
			special: Card[];
			noPosition: Card[];
	  }
	| {
			hs: Card[];
			es: Card[];
			js: Card[];
			xs: Card[];
			ss: Card[];
			cards2: Card[];
			cards: Card[];
	  };

type ShowCardsEvent = GameEvent & {
	str?: Card | Card[] | string;
	flashAnimation?: boolean;
	isFlash?: boolean;
	show_map?: Map<Player | "others", ShowCardsMapEntry>;
	getShown?: (this: ShowCardsEvent, player?: Player | null) => ShowCardsMapEntry;
};

type ViewCardsEvent = GameEvent & {
	str: string;
	cards: Card[];
};

export const cardVisibilityAndConnectMethods = {
	connectCards(this: Player, params?: EventConnectCardsParams | ConnectCardsLegacyToken): GameEvent {
		const next = game.createEvent("connectCards") as ConnectCardsEvent;
		next.player = this;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		let objParam = args.length === 1 && typeof params === "object";

		if (objParam) {
			const type = get.itemtype(params);
			if (type != null) {
				objParam = false;
			}
		}

		if (objParam) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				const type = get.itemtype(arg);
				if (type == "cards") {
					next.cards = arg;
				} else if (type == "card") {
					next.cards = [arg];
				} else if (type == "player") {
					next.source = arg;
				} else if (typeof arg == "boolean") {
					next.log = arg;
				}
			}
		}

		if (get.itemtype(next.source) != "player") {
			next.source = _status.event.player;
		}
		if (get.itemtype(next.cards) != "cards" || !next.cards) {
			next.cards = this.getCards("h");
		}
		if (!next.cards.length) {
			_status.event.next.remove(next);
			next.resolve();
		}
		if (next.log == undefined) {
			next.log = true;
		}
		next.setContent("connectCards");
		next._args = args;
		return next;
	},
	resetConnectedCards(this: Player, params?: EventResetConnectCardsParams | ConnectCardsLegacyToken): GameEvent {
		const next = game.createEvent("resetConnectedCards") as ConnectCardsEvent;
		next.player = this;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		let objParam = args.length === 1 && typeof params === "object";

		if (objParam) {
			const type = get.itemtype(params);
			if (type != null) {
				objParam = false;
			}
		}

		if (objParam) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				const type = get.itemtype(arg);
				if (type == "cards") {
					next.cards = arg;
				} else if (type == "card") {
					next.cards = [arg];
				} else if (type == "player") {
					next.source = arg;
				} else if (typeof arg == "boolean") {
					next.log = arg;
				}
			}
		}
		if (get.itemtype(next.source) != "player") {
			next.source = _status.event.player;
		}
		if (get.itemtype(next.cards) != "cards" || !next.cards) {
			next.cards = this.getConnectedCards();
		}
		if (next.log == undefined) {
			next.log = true;
		}
		if (!next.cards.length) {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.setContent("resetConnectedCards");
		next._args = args;
		return next;
	},
	*iterableGetConnectedCards(this: Player): Generator<Card, void, unknown> {
		for (const card of this.iterableGetCards("h")) {
			if (get.is.connectedCard(card)) {
				yield card;
			}
		}
	},
	getConnectedCards(this: Player): Card[] {
		return Array.from(this.iterableGetConnectedCards());
	},
	countConnectedCards(this: Player): number {
		let count = 0;
		for (const _ of this.iterableGetConnectedCards()) {
			++count;
		}
		return count;
	},
	hasConnectedCards(this: Player): boolean {
		for (const _ of this.iterableGetConnectedCards()) {
			return true;
		}
		return false;
	},
	addShownCards(this: Player, params?: EventAddShownCardsParams | ShownCardsLegacyToken): GameEvent {
		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];

		const next = game.createEvent("addShownCards", false) as ShownCardsEvent;
		next.player = this;
		next.cards = [];
		next.gaintag = [];
		if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
			Object.assign(next);
		} else {
			for (const arg of args) {
				const type = get.itemtype(arg);
				if (type == "cards") {
					next.cards.addArray(arg);
				} else if (type == "card") {
					next.cards.add(arg);
				} else if (typeof arg == "string" && arg.startsWith("visible_")) {
					next.gaintag.add(arg);
				}
			}
		}
		if (!next.cards?.length || !next.gaintag?.length) {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.setContent("addShownCards");
		next._args = args;
		return next;
	},
	hideShownCards(this: Player, params?: EventHideShownCardsParams | ShownCardsLegacyToken): GameEvent {
		const next = game.createEvent("hideShownCards", false) as ShownCardsEvent;
		next.player = this;
		next.cards = [];
		next.gaintag = [];

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				const type = get.itemtype(arg);
				if (type == "cards") {
					next.cards.addArray(arg);
				} else if (type == "card") {
					next.cards.add(arg);
				} else if (typeof arg == "string" && arg.startsWith("visible_")) {
					next.gaintag.add(arg);
				}
			}
		}
		if (!next.cards?.length) {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.setContent("hideShownCards");
		next._args = args;
		return next;
	},
	*iterableGetShownCards(this: Player): Generator<Card, void, unknown> {
		for (const card of this.iterableGetCards("h")) {
			if (get.is.shownCard(card)) {
				yield card;
			}
		}
	},
	getShownCards(this: Player): Card[] {
		return Array.from(this.iterableGetShownCards());
	},
	countShownCards(this: Player): number {
		let count = 0;
		for (const _ of this.iterableGetShownCards()) {
			++count;
		}
		return count;
	},
	hasShownCards(this: Player): boolean {
		for (const _ of this.iterableGetShownCards()) {
			return true;
		}
		return false;
	},
	*iterableGetKnownCards(this: Player, other, filter) {
		if (!other) {
			if (other === null) {
				console.trace("other参数不应传入null，可以用void 0或undefined占位；后续版本可能将不再检查，请及时更改！");
			} else if (other !== undefined) {
				console.trace("other参数不应传入假值（如false、0和空字符串）后续版本可能会废除该兼容，请及时更改！");
			}
			other = get.player() || this;
		}
		for (const card of this.iterableGetCards("h", filter)) {
			if (card.isKnownBy(other)) {
				yield card;
			}
		}
	},
	getKnownCards(this: Player, other, filter) {
		return Array.from(this.iterableGetKnownCards(other, filter));
	},
	isAllCardsKnown(this: Player, other?: Player | null): boolean {
		if (!other) {
			if (other === null) {
				console.trace("other参数不应传入null，可以用void 0或undefined占位；后续版本可能将不再检查，请及时更改！");
			} else if (other !== undefined) {
				console.trace("other参数不应传入假值（如false、0和空字符串）后续版本可能会废除该兼容，请及时更改！");
			}
			other = get.player() || this;
		}
		for (const card of this.iterableGetCards("h")) {
			if (!card.isKnownBy(other)) {
				return false;
			}
		}
		return true;
	},
	hasKnownCards(this: Player, other?: Player | null, filter?: CardFilterInput): boolean {
		for (const _ of this.iterableGetKnownCards(other, filter)) {
			return true;
		}
		return false;
	},
	countKnownCards(this: Player, other?: Player | null, filter?: CardFilterInput): number {
		let count = 0;
		for (const _ of this.iterableGetKnownCards(other, filter)) {
			++count;
		}
		return count;
	},
	showHandcards(this: Player, str?: string): GameEvent {
		const cards = this.getCards("h");

		if (typeof str !== "string") {
			str = get.translation(this) + "的手牌";
		}
		const next = this.showCards(cards, str);
		return next;
	},
	showCards(this: Player, cards: Card | Card[] | string | undefined, str?: Card | Card[] | string, flashAnimation: boolean = false, isFlash?: boolean): GameEvent {
		const next = game.createEvent("showCards") as ShowCardsEvent;
		next.player = this;
		next.str = str;
		if (typeof cards == "string") {
			str = cards;
			cards = next.str;
			next.str = str;
		}
		const itemType = get.itemtype(cards);
		if (itemType == "card" && typeof cards == "object" && cards !== null && !Array.isArray(cards)) {
			next.cards = [cards];
		} else if (itemType == "cards" && Array.isArray(cards)) {
			next.cards = cards.slice(0);
		} else {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.flashAnimation = flashAnimation;
		if (flashAnimation && isFlash == undefined) {
			next.isFlash = true;
		} else {
			next.isFlash = false;
		}
		next.getShown = function (player) {
			const event = this;
			if (!player || get.itemtype(player) != "player") {
				return (
					event.show_map?.get?.("others") || {
						cardPile: [],
						discardPile: [],
						ordering: [],
						special: [],
						noPosition: [],
					}
				);
			}
			return (
				event.show_map?.get?.(player) || {
					hs: [],
					es: [],
					js: [],
					xs: [],
					ss: [],
					cards2: [],
					cards: [],
				}
			);
		};
		next.setContent("showCards");
		// eslint-disable-next-line prefer-rest-params
		next._args = [...arguments];
		return next;
	},
	viewCards(this: Player, str: string, cards: Card[]): GameEvent {
		const next = game.createEvent("viewCards") as ViewCardsEvent;
		next.player = this;
		next.str = str;
		next.cards = cards.slice(0);
		next.setContent("viewCards");
		// eslint-disable-next-line prefer-rest-params
		next._args = Array.from(arguments);
		return next;
	},
	viewHandcards(this: Player, target: Player): GameEvent {
		const cards = target.getCards("h");
		return this.viewCards(`${get.translation(target)}的手牌`, cards);
	},
};
