import { game, get, lib, ui } from "noname";
import type { EventContentCallback } from "../../GameEvent/compilers/IContentCompiler.js";
import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type { RandomGainLegacyToken } from "../contracts/cardContract.js";
import type { EventAddToExpansionParams, EventGainParams, EventRandomGainParams } from "../eventParams.js";
import type { LegacyGainToken } from "../legacyParams.js";
import "../contracts/cardContract.js";

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

type LoseHistoryRecord = {
	name?: string;
	player?: Player | null;
	parent?: GameEvent;
	getParent(): GameEvent | unknown;
	position?: unknown;
	hs: Card[];
	es: Card[];
	js: Card[];
	ss: Card[];
	xs: Card[];
	cards: Card[];
	cards2: Card[];
	gaintag_map: Record<string, Card[]>;
	vcard_map: Map<Card, VCard>;
	[key: string]: any;
};

type GainDraftEvent = GameEvent & {
	cards: Card[];
	areaNames?: string[];
	log?: boolean;
	fromStorage?: boolean;
	bySelf?: boolean;
	delay?: boolean;
	getlx?: boolean;
	gaintag?: string[];
	giver?: Player;
	getd: (this: GainDraftEvent, player?: Player, key?: string, position?: HTMLElement | DocumentFragment) => Card[];
	getl: (this: GainDraftEvent, player: Player) => LoseMapResult;
	getg: (this: GainDraftEvent, player: Player) => Card[];
	[key: string]: any;
};

type GainMultipleDraftEvent = GameEvent & {
	position: string;
	gaintag: string[];
};

export const cardGainAndExpansionMethods = {
	randomGain(this: Player, params?: EventRandomGainParams | RandomGainLegacyToken): GameEvent {
		let position = "he";
		let num = 1;
		let target: Player | null = null;
		let line = false;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && get.is.object(params) && params != null && get.itemtype(params) == null) {
			const rgParams = params as EventRandomGainParams;
			num = rgParams.num ?? num;
			position = rgParams.position ?? position;
			target = rgParams.target ?? target;
			line = rgParams.line ?? line;
		} else {
			for (const arg of args) {
				if (typeof arg == "number") {
					num = arg;
				} else if (get.itemtype(arg) == "position") {
					position = arg;
				} else if (get.itemtype(arg) == "player") {
					target = arg;
				} else if (typeof arg == "boolean") {
					line = arg;
				}
			}
		}

		if (target == null) {
			return this.gain({
				cards: [],
				log: true,
				bySelf: true,
			});
		}

		const cards = target.getCards(position).randomGets(num);
		const next = this.gain({
			cards,
			source: target,
			log: true,
			bySelf: true,
		});
		if (line) {
			const contents = lib.element.content.gain;
			if (Array.isArray(contents)) {
				const newContents: EventContentCallback[] = [
					async (event, _trigger, player) => {
						if (player && event.target && event.target !== "cardPile") {
							player.line(event.target, "green");
						}
					},
					...(contents as unknown as EventContentCallback[]),
				];
				next.setContent(newContents);
			} else if (typeof contents === "function") {
				next.setContent(async (event, trigger, player) => {
					if (player && event.target && event.target !== "cardPile") {
						player.line(event.target, "green");
					}
					await (contents as unknown as EventContentCallback)(event, trigger, player);
				});
			}
		}
		return next;
	},
	gainMultiple(this: Player, targets: Player[], position: string = "h"): GameEvent {
		const next = game.createEvent("gainMultiple", false) as GainMultipleDraftEvent;
		next.setContent("gainMultiple");
		next.player = this;
		next.targets = targets;
		next.position = position || "h";
		next.gaintag = [];
		return next;
	},
	gain(this: Player, params?: EventGainParams | LegacyGainToken): GameEvent {
		const next = game.createEvent("gain") as unknown as GainDraftEvent;
		next.player = this;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length == 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			const gainParams = params as EventGainParams;
			Object.assign(next, gainParams);
			if (gainParams?.areaNames != null) {
				delete next.areaNames;
				const commonAreas = [...lib.commonArea.values()];
				for (const areaName of gainParams.areaNames) {
					if (commonAreas.some(area => area?.fromName === areaName)) {
						next.fromStorage = true;
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
				} else if (arg === "log") {
					next.log = true;
				} else if (arg == "fromStorage") {
					next.fromStorage = true;
				} else if (typeof arg == "string" && [...lib.commonArea.keys()].some(area => lib.commonArea.get(area)?.fromName == arg)) {
					next.fromStorage = true;
					next[arg] = true;
				} else if (arg == "bySelf") {
					next.bySelf = true;
				} else if (typeof arg == "string") {
					next.animate = arg;
				} else if (typeof arg == "boolean") {
					next.delay = arg;
				}
			}
		}
		if (next.animate == "gain2" || next.animate == "draw2") {
			if (!("log" in next)) {
				next.log = true;
			}
		}
		if (get.itemtype(next.cards) !== "cards") {
			next.cards = [];
		}
		next.setContent("gain");
		next.getd = function (player, key, position) {
			if (!position) {
				position = ui.discardPile;
			}
			if (!key) {
				key = "cards";
			}
			const cards: Card[] = [],
				event = this;
			game.checkGlobalHistory("cardMove", function (rawEvt) {
				const evt = rawEvt as unknown as LoseHistoryRecord;
				if (evt.name != "lose" || evt.position != position || evt.getParent() != (event as unknown as GameEvent)) {
					return;
				}
				if (player && player != evt.player) {
					return;
				}
				cards.addArray(evt[key]);
			});
			return cards;
		};
		next.getl = function (player) {
			const that = this as unknown as GameEvent;
			const map: LoseMapResult = {
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
			player.checkAllHistory("lose", function (rawEvt) {
				const evt = rawEvt as unknown as LoseHistoryRecord;
				if (evt.parent == that) {
					map.hs.addArray(evt.hs);
					map.es.addArray(evt.es);
					map.js.addArray(evt.js);
					map.ss.addArray(evt.ss);
					map.xs.addArray(evt.xs);
					map.cards.addArray(evt.cards);
					map.cards2.addArray(evt.cards2);
					for (let key in evt.gaintag_map) {
						if (!map.gaintag_map[key]) {
							map.gaintag_map[key] = [];
						}
						map.gaintag_map[key].addArray(evt.gaintag_map[key]);
					}
					evt.vcard_map.forEach((value, key) => {
						map.vcard_map.set(key, value);
					});
				}
			});
			return map;
		};
		next.getg = function (player) {
			if (this.getlx === false || player != this.player || !this.cards) {
				return [];
			}
			return (this.cards as Card[]).slice(0);
		};
		next.gaintag ??= [];
		return next as unknown as GameEvent;
	},
	addToExpansion(this: Player, params?: EventAddToExpansionParams | LegacyGainToken): GameEvent {
		const next = game.createEvent("addToExpansion") as unknown as GainDraftEvent;
		next.player = this;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && params != null && get.is.object(params) && get.itemtype(params) == null) {
			const expParams = params as EventAddToExpansionParams;
			Object.assign(next, expParams);
			if (expParams.areaNames != null) {
				delete next.areaNames;
				const commonAreas = [...lib.commonArea.values()];
				for (const areaName of expParams.areaNames) {
					if (commonAreas.some(area => area?.fromName === areaName)) {
						next.fromStorage = true;
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
				} else if (arg === "log") {
					next.log = true;
				} else if (arg == "fromStorage") {
					next.fromStorage = true;
				} else if (typeof arg == "string" && Array.from(lib.commonArea.keys()).some(area => lib.commonArea.get(area)?.fromName == arg)) {
					next.fromStorage = true;
					next[arg] = true;
				} else if (arg == "bySelf") {
					next.bySelf = true;
				} else if (typeof arg == "string") {
					next.animate = arg;
				} else if (typeof arg == "boolean") {
					next.delay = arg;
				}
			}
		}
		if (next.animate == "gain2" || next.animate == "draw2" || next.animate == "give") {
			if (!("log" in next)) {
				next.log = true;
			}
		}
		if (get.itemtype(next.cards) !== "cards") {
			next.cards = [];
		}
		next.setContent("addToExpansion");
		next.getd = function (player, key, position) {
			if (!position) {
				position = ui.discardPile;
			}
			if (!key) {
				key = "cards";
			}
			const cards: Card[] = [],
				event = this;
			game.checkGlobalHistory("cardMove", function (rawEvt) {
				const evt = rawEvt as unknown as LoseHistoryRecord;
				if (evt.name != "lose" || evt.position != position || evt.getParent() != (event as unknown as GameEvent)) {
					return;
				}
				if (player && player != evt.player) {
					return;
				}
				cards.addArray(evt[key]);
			});
			return cards;
		};
		next.getl = function (player) {
			const that = this as unknown as GameEvent;
			const map: LoseMapResult = {
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
			player.checkAllHistory("lose", function (rawEvt) {
				const evt = rawEvt as unknown as LoseHistoryRecord;
				if (evt.parent == that) {
					map.hs.addArray(evt.hs);
					map.es.addArray(evt.es);
					map.js.addArray(evt.js);
					map.ss.addArray(evt.ss);
					map.xs.addArray(evt.xs);
					map.cards.addArray(evt.cards);
					map.cards2.addArray(evt.cards2);
					for (let key in evt.gaintag_map) {
						if (!map.gaintag_map[key]) {
							map.gaintag_map[key] = [];
						}
						map.gaintag_map[key].addArray(evt.gaintag_map[key]);
					}
					evt.vcard_map.forEach((value, key) => {
						map.vcard_map.set(key, value);
					});
				}
			});
			return map;
		};
		next.getg = function (_player) {
			return [];
		};
		next.gaintag ??= [];
		return next as unknown as GameEvent;
	},
	give(this: Player, cards: Card | Card[], target: Player, visible?: boolean): GameEvent {
		const next = target.gain({
			cards: Array.isArray(cards) ? cards : [cards],
			source: this,
			animate: visible ? "give" : "giveAuto",
		}) as unknown as GainDraftEvent;
		next.giver = this;
		return next as unknown as GameEvent;
	},
};
