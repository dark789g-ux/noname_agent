import { _status, game, get, lib, ui } from "noname";
import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type { EventLoseParams } from "../eventParams.js";
import type { LegacyLoseToken } from "../legacyParams.js";
import "../contracts/cardContract.js";

type SwapHandcardsEvent = GameEvent & {
	cards1?: Card[];
	cards2?: Card[];
};

type LoseMapResult = {
	player: Player;
	hs: Card[];
	es: Card[];
	js: Card[];
	ss: Card[];
	xs: Card[];
	cards: Card[];
	cards2: Card[];
	gaintag_map: Record<string, Card[]>;
	vcard_map: Map<Card, VCard>;
};

type LoseDraftEvent = GameEvent & {
	forceDie: boolean;
	areaNames?: string[];
	toStorage?: boolean;
	visible?: boolean;
	insert_card?: boolean;
	getlx?: boolean;
	hs?: Card[];
	es?: Card[];
	js?: Card[];
	ss?: Card[];
	xs?: Card[];
	cards2?: Card[];
	gaintag_map?: Record<string, Card[]>;
	vcard_map: Map<Card, VCard>;
	getd: (this: LoseDraftEvent, player?: Player, key?: string, position?: HTMLElement | DocumentFragment) => Card[];
	getl: (this: LoseDraftEvent, player: Player) => LoseDraftEvent | LoseMapResult;
	getg: (this: LoseDraftEvent, player: Player) => Card[];
	[key: string]: any;
};

export const cardLoseAndDirectMethods = {
	swapHandcards(this: Player, target: Player, cards1?: Card[], cards2?: Card[]): GameEvent {
		const next = game.createEvent("swapHandcards", false) as SwapHandcardsEvent;
		next.player = this;
		next.target = target;
		if (cards1) {
			next.cards1 = cards1;
		}
		if (cards2) {
			next.cards2 = cards2;
		}
		next.setContent("swapHandcards");
		return next;
	},
	directequip(this: Player, cards: Card | VCard | (Card | VCard)[]): void {
		const cardList: (Card | VCard)[] = get.itemtype(cards) === "card" || !Array.isArray(cards) ? [cards as Card | VCard] : cards;
		for (const card of cardList) {
			this.addVirtualEquip(
				...(((): [VCard, Card[]] => {
					if (get.itemtype(card) === "vcard") {
						const vcard = card as VCard;
						return [vcard, vcard.cards ?? []];
					}
					const realCard = card as Card;
					return [realCard.cardSymbol ? realCard[realCard.cardSymbol] : get.autoViewAs(realCard, void 0, false), [realCard]];
				})())
			);
		}
		if (!_status.video) {
			game.addVideo("directequip", this, get.cardsInfo(cardList as Card[]));
		}
	},
	$addToExpansion(this: Player, cards: Card[], broadcast?: boolean | null, gaintag?: string[], check: boolean = true): Player {
		const hs = this.getCards("x");
		for (let i = 0; i < cards.length; i++) {
			if (hs.includes(cards[i]) && check) {
				cards.splice(i--, 1);
			}
		}
		for (let i = 0; i < cards.length; i++) {
			cards[i].fix();
			if (gaintag) {
				gaintag.forEach(tag => cards[i].addGaintag(tag));
			}
			this.node.expansions.insertBefore(cards[i], this.node.expansions.firstChild);
		}
		if (broadcast !== false) {
			game.broadcast(
				function (player: Player, cards: Card[], gaintag: string[] | undefined, check: boolean) {
					player.$addToExpansion(cards, null, gaintag, check);
				},
				this,
				cards,
				gaintag,
				check
			);
		}
		return this;
	},
	directgain(this: Player, cards: Card[], broadcast?: boolean | null, gaintag?: string | string[]): Player {
		const hs = this.getCards("hs");
		for (let i = 0; i < cards.length; i++) {
			if (hs.includes(cards[i])) {
				cards.splice(i--, 1);
			}
		}
		const cards1: Card[] = [];
		const cards2: Card[] = [];
		for (let i = 0; i < cards.length; i++) {
			cards[i].fix();
			if (gaintag) {
				if (typeof gaintag == "string") {
					gaintag = [gaintag];
				}
				gaintag.forEach(tag => cards[i].addGaintag(tag));
			}
			const sort = lib.config.sort_card(cards[i]);
			if (this == game.me) {
				cards[i].classList.add("drawinghidden");
			}
			if (get.is.singleHandcard() || sort > 0) {
				cards1.push(cards[i]);
			} else {
				cards2.push(cards[i]);
			}
		}
		this.node.handcards1.prepend(...cards1);
		if (cards2.length) {
			this.node.handcards2.prepend(...cards2);
		}

		if (this == game.me || _status.video) {
			ui.updatehl();
		}
		if (!_status.video) {
			game.addVideo("directgain", this, get.cardsInfo(cards));
			this.update();
		}
		if (broadcast !== false) {
			game.broadcast(
				function (player: Player, cards: Card[]) {
					player.directgain(cards);
				},
				this,
				cards
			);
		}
		return this;
	},
	directgains(this: Player, cards: Card[], broadcast?: boolean | null, gaintag?: string | string[]): Player {
		const hs = this.getCards("hs");
		for (let i = 0; i < cards.length; i++) {
			if (hs.includes(cards[i])) {
				cards.splice(i--, 1);
			}
		}
		const addLast = function (card: Card, node: HTMLDivElement) {
			if (gaintag) {
				for (let i = 0; i < node.childNodes.length; i++) {
					const add = node.childNodes[node.childNodes.length - i - 1] as Card;
					if (!add.classList.contains("glows")) {
						break;
					}
					if (typeof gaintag == "string" ? add.hasGaintag(gaintag) : gaintag.some(tag => add.hasGaintag(tag))) {
						node.insertBefore(card, add.nextSibling);
						return;
					}
				}
			}
			node.appendChild(card);
		};
		for (let i = 0; i < cards.length; i++) {
			cards[i].fix();
			cards[i].remove();
			if (gaintag) {
				if (typeof gaintag == "string") {
					gaintag = [gaintag];
				}
				gaintag.forEach(tag => cards[i].addGaintag(tag));
			}
			cards[i].classList.add("glows");
			if (this == game.me) {
				cards[i].classList.add("drawinghidden");
			}
			if (get.is.singleHandcard()) {
				addLast(cards[i], this.node.handcards1);
			} else {
				addLast(cards[i], this.node.handcards2);
			}
		}
		if (this == game.me || _status.video) {
			ui.updatehl();
		}
		if (!_status.video) {
			game.addVideo("directgains", this, {
				cards: get.cardsInfo(cards),
				gaintag,
			});
			this.update();
		}
		if (broadcast !== false) {
			game.broadcast(
				function (player: Player, cards: Card[], gaintag: string | string[] | undefined) {
					player.directgains(cards, null, gaintag);
				},
				this,
				cards,
				gaintag
			);
		}
		return this;
	},
	lose(this: Player, params?: EventLoseParams | LegacyLoseToken): GameEvent {
		const next = game.createEvent("lose") as LoseDraftEvent;
		next.player = this;
		next.forceDie = true;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			const loseParams = params as EventLoseParams;
			Object.assign(next, loseParams);
			if (loseParams.areaNames != null) {
				delete next.areaNames;
				const commonAreas = [...lib.commonArea.values()];
				for (const areaName of loseParams.areaNames) {
					if (commonAreas.some(area => area?.toName === areaName)) {
						next.toStorage = true;
						next[areaName] = true;
					}
				}
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (get.itemtype(arg) == "cards") {
					next.cards = arg.slice(0);
				} else if (get.itemtype(arg) == "card") {
					next.cards = [arg];
				} else if (["div", "fragment"].includes(get.objtype(arg))) {
					(next as { position?: HTMLElement | DocumentFragment }).position = arg;
				} else if (arg == "toStorage") {
					next.toStorage = true;
				} else if (typeof arg == "string" && Array.from(lib.commonArea.keys()).some(area => lib.commonArea.get(area)?.toName == arg)) {
					next.toStorage = true;
					next[arg] = true;
				} else if (arg == "visible") {
					next.visible = true;
				} else if (arg == "insert") {
					next.insert_card = true;
				}
			}
		}
		if (next.cards) {
			const hej = this.getCards("hejsx");
			for (let i = 0; i < next.cards.length; i++) {
				if (!hej.includes(next.cards[i] as Card)) {
					next.cards.splice(i--, 1);
				}
			}
		}
		if (!next.cards || !next.cards.length) {
			_status.event.next.remove(next);
			next.resolve();
		} else {
			if ((next as { position?: unknown }).position == undefined) {
				(next as { position?: HTMLElement | DocumentFragment }).position = ui.discardPile;
			}
			next.cards = next.cards.slice(0);
		}
		next.setContent("lose");
		next.getd = function (player, key, position) {
			if (!position) {
				position = ui.discardPile;
			}
			if (!key) {
				key = "cards";
			}
			if (this.getlx === false || (this as { position?: unknown }).position != position || (player && this.player != player) || !Array.isArray(this[key])) {
				return [];
			}
			return this[key].slice(0);
		};
		next.getl = function (player) {
			if (this.getlx !== false && this.player == player) {
				return this;
			}
			return {
				player: player,
				hs: [],
				es: [],
				js: [],
				ss: [],
				xs: [],
				cards: [],
				cards2: [],
				gaintag_map: {},
				vcard_map: new Map(),
			};
		};
		next.getg = function (_player) {
			return [];
		};
		next.vcard_map = new Map();
		return next;
	},
};
