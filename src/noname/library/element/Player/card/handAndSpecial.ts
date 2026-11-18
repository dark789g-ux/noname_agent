import { _status, game, get, lib, ui } from "noname";
import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type { RecastCallback } from "../contracts/cardContract.js";
import "../contracts/cardContract.js";

type GiftDraftEvent = GameEvent & {
	deniedGifts: Card[];
};

type LogMutableEvent = GameEvent & {
	log?: boolean;
};

type RecastDraftEvent = GameEvent & {
	recastingLose: RecastCallback;
	recastingLosingEvents: GameEvent[];
	recastingGain: RecastCallback;
	recastingGainingEvents: GameEvent[];
};

type LoseToSpecialDraftEvent = GameEvent & {
	cards: Card[];
	tag: string;
	toStorage: boolean;
	target: Player;
};

type LoseWithGetlxEvent = GameEvent & {
	set(key: "getlx", value: boolean): GameEvent;
};

export const cardHandAndSpecialMethods = {
	sortHandcard(this: Player, sort?: unknown): boolean | undefined {
		if (this.hasSkillTag("noSortCard")) {
			return false;
		}

		const hs = this.getCards("h").slice();
		if (!hs.length) {
			return false;
		}
		const cards1: Card[] = [];
		const cards2: Card[] | null = !get.is.singleHandcard() ? [] : null;

		if (typeof sort == "function") {
			Reflect.apply(hs.sort, hs, [sort]);
		} else if (Array.isArray(sort)) {
			hs.sort((a, b) => sort.indexOf(a) - sort.indexOf(b));
		} else if (this.hasSkillTag("sortCardByNum")) {
			const getn = (card: Card) => {
				const num = get.number(card, this);
				if (typeof num != "number") {
					return NaN;
				}
				if (num < 3) {
					return 13 + num;
				}
				return num;
			};
			hs.sort((a, b) => getn(b) - getn(a));
		} else {
			hs.sort(function (b, a) {
				if (a.name != b.name) {
					return lib.sort.card(a.name, b.name);
				} else if (a.suit != b.suit) {
					const suitA = typeof a.suit == "string" ? a.suit : "";
					const suitB = typeof b.suit == "string" ? b.suit : "";
					return lib.suit.indexOf(suitA) - lib.suit.indexOf(suitB);
				} else {
					return typeof a.number == "number" && typeof b.number == "number" ? a.number - b.number : NaN;
				}
			});
		}
		if (this.getCards("h").every((card, index) => hs[index] == card)) {
			return false;
		}

		this.node.handcards1.style.visibility = "hidden";
		this.node.handcards2.style.visibility = "hidden";
		hs.forEach(card => {
			const sortVal = lib.config.sort_card(card);
			if (sortVal < 0 && cards2) {
				cards2.unshift(card);
			} else {
				cards1.unshift(card);
			}
		});

		this.node.handcards1.prepend(...cards1);
		if (cards2) {
			this.node.handcards2.prepend(...cards2);
		}
		this.node.handcards1.style.visibility = "visible";
		this.node.handcards2.style.visibility = "visible";
		if (this == game.me) {
			ui.updatehl();
		}
	},
	sortHandcardOL(this: Player, sort?: unknown): void {
		const bool = this.sortHandcard(sort);
		if (_status.connectMode && bool !== false) {
			if (game.online) {
				game.send(
					"syncHandcard",
					this.getCards("h")
						.map(i => i.cardid)
						.filter((id): id is string => typeof id == "string")
				);
			} else {
				game.syncHandcard(
					this,
					this.getCards("h")
						.map(i => i.cardid)
						.filter((id): id is string => typeof id == "string")
				);
			}
		}
	},
	canIgnoreHandcard(this: Player, card: Card): boolean {
		return lib.filter.ignoredHandcard(card, this);
	},
	gift(this: Player, cards: Card | Card[], target: Player): GameEvent {
		const next = game.createEvent("gift") as GiftDraftEvent;
		next.player = this;
		next.target = target;
		const isArray = Array.isArray(cards);
		if (cards && !isArray) {
			next.cards = [cards];
		} else if (isArray && cards.length) {
			next.cards = cards;
		} else {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.deniedGifts = [];
		next.setContent("gift");
		// eslint-disable-next-line prefer-rest-params
		next._args = [...arguments];
		return next;
	},
	canGift(this: Player, card: Card, target: Player, strict?: boolean): boolean {
		return lib.filter.cardGiftable(card, this, target, strict);
	},
	refuseGifts(this: Player, card: Card, player: Player): boolean {
		return this.hasSkillTag("refuseGifts", null, {
			player: player,
			card: card,
		});
	},
	getGiftAIResultTarget(this: Player, card: Card, target: Player): number {
		if (!card || !this.canGift(card, target, true) || target.refuseGifts(card, this)) {
			return 0;
		}
		if (get.type(card, null, target) == "equip") {
			let eff = get.effect(target, card, target, target);
			const att = get.sgnAttitude(this, target);
			if (att < 0) {
				if (eff == 0) {
					eff -= 0.1;
				}
				if (target.canEquip(card)) {
					eff--;
				}
			} else {
				if (att > 0 && target.canEquip(card) && eff > 0) {
					eff++;
				}
			}
			return eff;
		}
		if (card.name == "du") {
			if (["usedu", "keepdu"].some(tag => this.hasSkillTag(tag))) {
				return 0;
			}
			const att = get.sgnAttitude(this, target);
			if (this.hasSkillTag("nodu")) {
				if (["usedu", "keepdu"].some(tag => target.hasSkillTag(tag))) {
					return get.attitude(this, target) - 0.01;
				}
				return -att * Math.max(1, 4 - target.getHp());
			}
			if (get.effect(this, { name: "losehp" }, this, this) > 0) {
				return -att * Math.max(1, 4 - target.getHp());
			}
			return this.getHp() > target.getHp() ? -1 : 0;
		}
		if (target.hasSkillTag("nogain")) {
			return 0;
		}
		return Math.max(1, get.value(card, this) - get.value(card, target));
	},
	getGiftEffect(this: Player, card: Card, target: Player): number {
		return this.getGiftAIResultTarget(card, target) * get.attitude(this, target);
	},
	recast(this: Player, cards: Card | Card[], recastingLose?: RecastCallback | null, recastingGain?: RecastCallback | null): GameEvent {
		const recast = game.createEvent("recast") as RecastDraftEvent;
		recast.player = this;
		const isArray = Array.isArray(cards);
		if (cards && !isArray) {
			recast.cards = [cards];
		} else if (isArray && cards.length) {
			recast.cards = cards;
		} else {
			_status.event.next.remove(recast);
			recast.resolve();
		}
		if (typeof recastingLose != "function") {
			if (recastingLose === null) {
				console.trace(`recast的recastingLose参数不应传入null,可以用void 0或undefined占位`);
			}
			recastingLose = (player, cards) => {
				const next = player.loseToDiscardpile(cards) as LogMutableEvent;
				next.log = false;
				return next;
			};
		}
		recast.recastingLose = recastingLose;
		recast.recastingLosingEvents = [];
		if (typeof recastingGain != "function") {
			if (recastingLose === null) {
				console.trace(`recast的recastingGain参数不应传入null,可以用void 0或undefined占位`);
			}
			recastingGain = (player, cards) => {
				const next = player.draw(cards.length) as LogMutableEvent;
				next.log = false;
				return next;
			};
		}
		recast.recastingGain = recastingGain;
		recast.recastingGainingEvents = [];
		recast.setContent("recast");
		// eslint-disable-next-line prefer-rest-params
		recast._args = [...arguments];
		return recast;
	},
	canRecast(this: Player, card: Card | VCard | CardBaseUIData, source?: Player | null, strict?: boolean): boolean {
		return lib.filter.cardRecastable(card as Card, this, source ?? undefined, strict);
	},
	loseToSpecial(this: Player, cards: Card[], tag: string, target?: Player): GameEvent {
		const next = game.loseAsync({
			player: this,
			cards: cards,
			tag: tag,
			toStorage: true,
			target: target || this,
		});
		next.setContent(async function (event, trigger, player) {
			const specialEvent = event as LoseToSpecialDraftEvent;
			if (!player) {
				return;
			}
			await (player.lose(specialEvent.cards, ui.special) as LoseWithGetlxEvent).set("getlx", false);
			let cards = (specialEvent.cards as Card[]).slice();
			cards.removeArray(player.getCards("hejsx"));
			if (cards.length) {
				specialEvent.target.directgains(cards, null, specialEvent.tag);
			}
		});
		return next;
	},
	addGaintag(this: Player, cards: Card | Card[], tag: string): void {
		const cardArr = Array.isArray(cards) ? cards : [cards];
		game.addVideo("addGaintag", this, [get.cardsInfo(cardArr), tag]);
		game.broadcastAll(
			function (player: Player, cards: Card[], tag: string) {
				const hs = player.getCards("hejsx");
				for (const i of cards) {
					if (hs.includes(i)) {
						i.addGaintag(tag);
					}
				}
			},
			this,
			cardArr,
			tag
		);
	},
	removeGaintag(this: Player, tag: string, cards?: Card | Card[]): void {
		let cardArr: Card[];
		if (Array.isArray(cards)) {
			cardArr = cards;
		} else if (cards) {
			cardArr = [cards];
		} else {
			cardArr = this.getCards("h");
		}
		game.addVideo("removeGaintag", this, [tag, get.cardsInfo(cardArr)]);
		game.broadcastAll(
			function (player: Player, tag: string, cards: Card[]) {
				for (const i of cards) {
					i.removeGaintag(tag);
				}
			},
			this,
			tag,
			cardArr
		);
	},
	getExpansions(this: Player, tag: string): Card[] {
		return this.getCards("x", card => card.hasGaintag(tag));
	},
	countExpansions(this: Player, tag: string): number {
		return this.countCards("x", card => card.hasGaintag(tag));
	},
	hasExpansions(this: Player, tag: string): boolean {
		return this.hasCards("x", card => card.hasGaintag(tag));
	},
	getHandcardLimit(this: Player): number {
		let num = Math.max(Number(this.hp), 0);
		num = game.checkMod(this, num, "maxHandcardBase", this);
		num = game.checkMod(this, num, "maxHandcard", this);
		num = game.checkMod(this, num, "maxHandcardFinal", this);
		return Math.max(0, num);
	},
	needsToDiscard(this: Player, add?: number | Card[] | Card, filter?: (card: Card, player: Player, cards: Card[]) => boolean, pure?: boolean): number {
		let cards = this.getCards("h"),
			num = 0;
		if (typeof add === "number") {
			num = add;
		} else if (Array.isArray(add) && add.every(card => card instanceof lib.element.Card)) {
			cards.addArray(add);
		} else if (add instanceof lib.element.Card) {
			cards.push(add);
		}
		const activeFilter: (card: Card, player: Player, cards: Card[]) => boolean =
			typeof filter === "function" ? filter : (card, player) => !player.canIgnoreHandcard(card);
		cards = cards.filter(card => {
			return activeFilter(card, this, cards);
		});
		num += cards.length - this.getHandcardLimit();
		if (pure) {
			return num;
		}
		return Math.max(0, num);
	},
};
