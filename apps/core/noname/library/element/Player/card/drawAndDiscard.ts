import { _status, game, get, lib } from "noname";
import type { Card, GameEvent, Player } from "../../index.js";
import type { DrawLegacyToken, ModedDiscardLegacyToken, RandomDiscardLegacyToken } from "../contracts/cardContract.js";
import type {
	EventDiscardParams,
	EventDrawParams,
	EventDrawToParams,
	EventLoseToDiscardpileParams,
	EventModedDiscardParams,
	EventRandomDiscardParams,
} from "../eventParams.js";
import type { LegacyDiscardToken, LegacyLoseToDiscardpileToken, LegacyLoseToken } from "../legacyParams.js";
import "../contracts/cardContract.js";

type DrawDraftEvent = GameEvent & {
	num: number;
	$draw?: boolean;
	nodelay?: boolean;
	visible?: boolean;
	bottom?: boolean;
	drawDeck?: number;
	gaintag?: string[];
};

type DiscardDraftEvent = GameEvent & {
	discarder?: Player;
	notBySelf?: boolean;
};

type ModedDiscardDraftEvent = GameEvent & {
	discarder: Player;
	cards: Card[];
	log: string | false;
	notBySelf?: boolean;
	skills: string[];
	protected_cards: Card[];
	done?: GameEvent & { type?: string; discarder?: Player };
};

type LoseToDiscardpileDraftEvent = GameEvent & {
	notBySelf?: boolean;
	insert_card?: boolean;
	blank?: boolean;
};

export const cardDrawAndDiscardMethods = {
	drawTo(this: Player, num: number, args?: EventDrawToParams | DrawLegacyToken[]): GameEvent {
		const num2 = num - this.countCards("h");
		let next: DrawDraftEvent;
		if (Array.isArray(args)) {
			next = this.draw({ num: num2 }) as unknown as DrawDraftEvent;
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.source = arg as Player;
				} else if (typeof arg == "boolean") {
					next.animate = arg;
				} else if (arg == "nodelay") {
					next.animate = false;
					next.$draw = true;
				} else if (arg == "visible") {
					next.visible = true;
				} else if (arg == "bottom") {
					next.bottom = true;
				} else if (typeof arg == "object" && arg && "drawDeck" in arg && arg.drawDeck != undefined) {
					next.drawDeck = arg.drawDeck;
				}
			}
		} else if (get.is.object(args) && get.itemtype(args) == null) {
			next = this.draw({ num: num2, ...(args as EventDrawToParams) }) as unknown as DrawDraftEvent;
		} else {
			next = this.draw({ num: num2 }) as unknown as DrawDraftEvent;
		}
		return next as unknown as GameEvent;
	},
	draw(this: Player, params?: number | EventDrawParams | DrawLegacyToken): GameEvent {
		const next = game.createEvent("draw") as unknown as DrawDraftEvent;
		next.player = this;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		const event = _status.event;
		if (args.length === 1 && typeof params === "number") {
			next.num = params;
		} else if (args.length === 1 && typeof params === "object" && !Array.isArray(params) && params != null && get.itemtype(params) == null) {
			const drawParams = params as EventDrawParams;
			Object.assign(next, drawParams);
			if (drawParams.nodelay) {
				delete next.nodelay;
				next.animate = false;
				next.$draw = true;
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (typeof arg == "number") {
					next.num = arg;
				} else if (typeof arg == "boolean") {
					next.animate = arg;
				} else if (arg == "nodelay") {
					next.animate = false;
					next.$draw = true;
				} else if (arg == "visible") {
					next.visible = true;
				} else if (arg == "bottom") {
					next.bottom = true;
				} else if (typeof arg == "object" && arg && arg.drawDeck != undefined) {
					next.drawDeck = arg.drawDeck;
				}
			}
		}
		if (typeof next.num != "number") {
			next.num = 1;
		}
		if (next.num <= 0) {
			_status.event.next.remove(next as unknown as GameEvent);
			next.resolve();
		}
		if (get.itemtype(next.source) != "player") {
			const source = event.player;
			if (source) {
				next.source = source;
			}
		}
		next.setContent("draw");
		if (lib.config.mode == "stone" && _status.mode == "deck" && next.drawDeck == undefined && !next.player?.isMin() && next.num > 1) {
			next.drawDeck = 1;
		}
		(next as { result?: unknown }).result = [];
		next.gaintag ??= [];
		return next;
	},
	randomDiscard(this: Player, params?: EventRandomDiscardParams | RandomDiscardLegacyToken): GameEvent {
		let position = "he";
		let discarder: Player = this;
		let num = 1;
		let random = false;
		let log: string | false = "popup";

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && get.is.object(params) && params != null && get.itemtype(params) == null) {
			const rdParams = params as EventRandomDiscardParams;
			num = rdParams.num ?? num;
			discarder = rdParams.discarder ?? discarder;
			position = rdParams.position ?? position;
			random = rdParams.random ?? random;
			log = rdParams.log ?? log;
		} else {
			for (const arg of args) {
				if (typeof arg === "number") {
					num = arg;
				} else if (get.itemtype(arg) == "player") {
					discarder = arg;
				} else if (get.itemtype(arg) === "position") {
					position = arg;
				} else if (arg === "random") {
					random = true;
				} else if (arg === false || typeof arg === "string") {
					log = arg;
				}
			}
		}
		let cards: Card[];
		if (random) {
			cards = this.getCards(position).randomGets(num);
		} else {
			const discardable = this.getDiscardableCards(discarder, position);
			cards = discardable.randomGets(num);
			if (cards.length < num) {
				cards.addArray(this.getCards(position, c => !discardable.includes(c)).randomGets(num - cards.length));
			}
		}
		const next = this.modedDiscard({
			cards,
			discarder,
			log,
		});
		return next;
	},
	discard(this: Player, params?: EventDiscardParams | LegacyDiscardToken): GameEvent {
		const next = game.createEvent("discard") as DiscardDraftEvent;
		next.player = this;
		next.num = 0;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			const discardParams = params as EventDiscardParams;
			Object.assign(next, discardParams);
			if (discardParams.discarder != null && discardParams.discarder !== this) {
				next.notBySelf = true;
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) === "player") {
					next.discarder = arg;
					if (this !== next.discarder) {
						next.notBySelf = true;
					}
				} else if (get.itemtype(arg) === "cards") {
					next.cards = arg.slice(0);
				} else if (get.itemtype(arg) === "card") {
					next.cards = [arg];
				} else if (["div", "fragment"].includes(get.objtype(arg))) {
					(next as { position?: HTMLDivElement | DocumentFragment }).position = arg;
				} else if (arg === "notBySelf") {
					next.notBySelf = true;
				}
			}
		}
		if (get.itemtype(next.cards) !== "cards") {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.setContent("discard");
		return next;
	},
	modedDiscard(this: Player, params?: EventModedDiscardParams | ModedDiscardLegacyToken): GameEvent {
		const next = game.createEvent("discard") as unknown as ModedDiscardDraftEvent;
		next.player = this;
		next.discarder = this;
		next.cards = [];
		next.log = "popup";

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			const modParams = params as EventModedDiscardParams;
			Object.assign(next, modParams);
			if (modParams.discarder != null && modParams.discarder !== this) {
				next.notBySelf = true;
			}
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) === "player") {
					next.discarder = arg;
					if (this !== next.discarder) {
						next.notBySelf = true;
					}
				} else if (get.itemtype(arg) === "cards") {
					next.cards = arg.slice(0);
				} else if (get.itemtype(arg) === "card") {
					next.cards = [arg];
				} else if (["div", "fragment"].includes(get.objtype(arg))) {
					(next as { position?: HTMLDivElement | DocumentFragment }).position = arg;
				} else if (arg === false || typeof arg === "string") {
					next.log = arg;
				}
			}
		}
		if (!next.cards.length) {
			_status.event.next.remove(next as unknown as GameEvent);
			next.resolve();
		}
		next.skills = [];
		next.protected_cards = [];
		const currentEvent = _status.event as GameEvent | string;
		const event = typeof currentEvent === "string" ? currentEvent : (currentEvent.getParent() as GameEvent).name;
		let skills: string[] = [];
		if (typeof this.getModableSkills === "function") {
			skills = this.getModableSkills();
		} else if (typeof this.getSkills === "function") {
			skills = this.getSkills().concat(lib.skill.global);
			game.expandSkills(skills);
			skills = skills.filter(i => {
				const info = get.info(i);
				return info && info.mod;
			});
			skills.sort((a, b) => get.priority(a) - get.priority(b));
		}
		for (let skill of skills) {
			const skillInfo = get.info(skill);
			if (!skillInfo.mod) {
				throw new TypeError(`Expected mod configuration for ${skill}`);
			}
			const canBeDiscarded = skillInfo.mod.canBeDiscarded;
			if (canBeDiscarded) {
				for (let i = 0; i < next.cards.length; i++) {
					let arg: Parameters<NonNullable<Mod["canBeDiscarded"]>> = [next.cards[i] as Card, next.discarder, this, event, "unchanged"],
						result = canBeDiscarded.call(game, ...arg);
					if (result !== undefined && typeof arg[arg.length - 1] !== "object") {
						arg[arg.length - 1] = result;
					}
					if (!arg[arg.length - 1]) {
						next.skills.add(skill);
						next.protected_cards.push(next.cards.splice(i--, 1)[0] as Card);
					}
				}
			}
			const discardSkillInfo = get.info(skill);
			if (!discardSkillInfo.mod) {
				throw new TypeError(`Expected mod configuration for ${skill}`);
			}
			const cardDiscardable = discardSkillInfo.mod.cardDiscardable;
			if (cardDiscardable) {
				for (let i = 0; i < next.cards.length; i++) {
					let arg: Parameters<NonNullable<Mod["cardDiscardable"]>> = [next.cards[i] as Card, this, event, "unchanged"],
						result = cardDiscardable.call(game, ...arg);
					if (result !== undefined && typeof arg[arg.length - 1] !== "object") {
						arg[arg.length - 1] = result;
					}
					if (!arg[arg.length - 1]) {
						next.skills.add(skill);
						next.protected_cards.push(next.cards.splice(i--, 1)[0] as Card);
					}
				}
			}
		}
		next.setContent(async (event, trigger, player) => {
			const modEvent = event as unknown as ModedDiscardDraftEvent;
			if (!player) {
				return;
			}
			if (modEvent.skills.length && modEvent.log) {
				for (let i of modEvent.skills) {
					if (typeof player[modEvent.log] === "function") {
						player[modEvent.log](i);
					}
				}
			}
			const cards = modEvent.cards;
			if (cards.length) {
				game.log(player, "弃置了", cards);
				modEvent.done = player.lose(cards, (modEvent as { position?: HTMLDivElement | DocumentFragment }).position as LegacyLoseToken, "visible") as GameEvent & { type?: string; discarder?: Player };
				modEvent.done.type = "discard";
				if (modEvent.discarder) {
					modEvent.done.discarder = modEvent.discarder;
				}
				await modEvent.done;
				await event.trigger("discard");
			}
			event.result = {
				bool: cards.length > 0,
				cards,
				skills: modEvent.skills,
				protected_cards: modEvent.protected_cards,
			};
		});
		return next as unknown as GameEvent;
	},
	loseToDiscardpile(this: Player, params?: EventLoseToDiscardpileParams | LegacyLoseToDiscardpileToken): GameEvent {
		const next = game.createEvent("loseToDiscardpile") as LoseToDiscardpileDraftEvent;
		next.player = this;
		next.num = 0;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "player") {
					next.source = arg;
				} else if (get.itemtype(arg) == "cards") {
					next.cards = arg.slice(0);
				} else if (get.itemtype(arg) == "card") {
					next.cards = [arg];
				} else if (typeof arg == "boolean") {
					next.animate = arg;
				} else if (["div", "fragment"].includes(get.objtype(arg))) {
					(next as { position?: HTMLDivElement | DocumentFragment }).position = arg;
				} else if (arg == "notBySelf") {
					next.notBySelf = true;
				} else if (arg == "insert") {
					next.insert_card = true;
				} else if (arg == "blank") {
					next.blank = true;
				}
			}
		}
		if (next.cards == undefined) {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.setContent("loseToDiscardpile");
		return next;
	},
	doubleDraw(this: Player): GameEvent {
		const next = game.createEvent("doubleDraw");
		if (get.is.changban()) {
			_status.event.next.remove(next);
			next.resolve();
		}
		next.player = this;
		next.setContent("doubleDraw");
		return next;
	},
};
