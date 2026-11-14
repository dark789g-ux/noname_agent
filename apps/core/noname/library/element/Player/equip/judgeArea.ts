import { _status, game, get, lib, ui } from "noname";
import type { Card, GameEvent, Player, VCard } from "../../index.js";

type DelayCardEffectEventDraft = GameEvent & {
	judge?: any;
	judge2?: any;
};

type LoseHistoryRecord = {
	player: Player;
	hs: Card[];
	es: Card[];
	js: Card[];
	ss: Card[];
	xs: Card[];
	cards: Card[];
	cards2: Card[];
	gaintag_map: Record<string, string[]>;
	vcard_map: Map<Card, VCard>;
};

type AddJudgeEventDraft = GameEvent & {
	getd: (this: GameEvent, player?: Player, key?: string, position?: HTMLElement | DocumentFragment) => Card[];
	getl: (this: GameEvent, player: Player) => LoseHistoryRecord;
	getg: (player?: Player) => Card[];
};

type JudgeEventDraft = GameEvent & {
	judge?: (card: Card) => number;
	clearArena?: boolean;
	cardname?: string;
};

export const judgeAreaMethods = {
	/**
	 * Execute the delay card effect
	 *
	 * 执行延时锦囊牌效果
	 */
	executeDelayCardEffect(this: Player, card: Card | string, target?: Player, judge?: any, judge2?: any): GameEvent {
		const executeDelayCardEffect = game.createEvent("executeDelayCardEffect") as DelayCardEffectEventDraft;
		executeDelayCardEffect.player = this;
		executeDelayCardEffect.target = target || this;
		if (typeof card == "string") {
			const virtualCard = (executeDelayCardEffect.card = ui.create.card());
			virtualCard._destroy = true;
			virtualCard.expired = true;
			const info = lib.card[card] as Record<string, any> | undefined;
			virtualCard.init(["", "", card, info && info.cardnature]);
		} else if (get.itemtype(card) == "card") {
			executeDelayCardEffect.card = card;
		} else {
			_status.event.next.remove(executeDelayCardEffect);
			executeDelayCardEffect.resolve();
		}
		executeDelayCardEffect.judge = judge;
		executeDelayCardEffect.judge2 = judge2;
		executeDelayCardEffect.setContent("executeDelayCardEffect");
		// eslint-disable-next-line prefer-rest-params
		executeDelayCardEffect._args = [...arguments];
		return executeDelayCardEffect;
	},

	/**
	 * 判断判定区是否被废除
	 */
	isDisabledJudge(this: Player): boolean {
		return Boolean(this.storage._disableJudge);
	},

	$disableJudge(this: Player): void {
		this.storage._disableJudge = true;
		for (let i = 0; i < this.node.judges.childNodes.length; i++) {
			if ((this.node.judges.childNodes[i] as HTMLElement).classList.contains("feichu")) {
				return;
			}
		}
		game.addVideo("$disableJudge", this);
		const card = game.createCard("disable_judge", "", "");
		card.fix();
		card.classList.add("feichu");
		card.style.transform = "";
		card.classList.add("drawinghidden");
		this.node.judges.insertBefore(card, this.node.judges.firstChild);
		ui.updatej(this);
	},

	$enableJudge(this: Player): void {
		game.addVideo("$enableJudge", this);
		this.storage._disableJudge = false;
		for (let i = 0; i < this.node.judges.childNodes.length; i++) {
			if ((this.node.judges.childNodes[i] as Card).name == "disable_judge") {
				this.node.judges.removeChild(this.node.judges.childNodes[i]);
				break;
			}
		}
	},

	disableJudge(this: Player): GameEvent {
		const next = game.createEvent("disableJudge");
		next.player = this;
		next.source = _status.event.player;
		next.setContent("disableJudge");
		return next;
	},

	enableJudge(this: Player): GameEvent {
		const next = game.createEvent("enableJudge");
		next.player = this;
		next.source = _status.event.player;
		next.setContent("enableJudge");
		return next;
	},

	/**
	 * 将一些牌置入到玩家的判定区
	 */
	addJudge(this: Player, card: string | Card | VCard | CardBaseUIData, cards?: (Card | VCard)[] | Card): GameEvent {
		const next = game.createEvent("addJudge") as AddJudgeEventDraft;
		const normalizedCard: Card | VCard | CardBaseUIData = typeof card == "string" ? { name: card } : card;
		if (normalizedCard instanceof lib.element.Card) {
			next.card = normalizedCard;
			if (normalizedCard.isViewAsCard) {
				const cardSymbol = normalizedCard.cardSymbol;
				const vcard: VCard | undefined = cardSymbol === undefined ? get.autoViewAs(normalizedCard, void 0, false) : normalizedCard[cardSymbol];
				next.cards = vcard?.cards ?? [normalizedCard];
			} else {
				next.cards = [normalizedCard];
			}
		} else {
			const cardList = cards === undefined && normalizedCard instanceof lib.element.VCard ? normalizedCard.cards ?? [] : cards == null ? [] : Array.isArray(cards) ? cards : [cards];
			const isPhysicalCard = (entry: Card | VCard): entry is Card => get.itemtype(entry) == "card";
			const physicalCards = cardList.filter(isPhysicalCard);
			next.cards = physicalCards;
			next.card = get.autoViewAs(normalizedCard, physicalCards);
		}
		next.player = this;
		next.setContent("addJudge");
		next.getd = function (player, key, position) {
			if (!position) {
				position = ui.discardPile;
			}
			if (!key) {
				key = "cards";
			}
			const cards: Card[] = [],
				event = this;
			game.checkGlobalHistory("cardMove", function (evt: any) {
				if (evt.name != "lose" || evt.position != position || evt.getParent() != event) {
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
			const that = this;
			const map: LoseHistoryRecord = {
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
			player.checkAllHistory("lose", function (evt: any) {
				if (evt.parent == that) {
					map.hs.addArray(evt.hs);
					map.es.addArray(evt.es);
					map.js.addArray(evt.js);
					map.ss.addArray(evt.ss);
					map.xs.addArray(evt.xs);
					map.cards.addArray(evt.cards);
					map.cards2.addArray(evt.cards2);
					for (const key in evt.gaintag_map) {
						if (!map.gaintag_map[key]) {
							map.gaintag_map[key] = [];
						}
						map.gaintag_map[key].addArray(evt.gaintag_map[key]);
					}
					evt.vcard_map.forEach((value: VCard, key: Card) => {
						map.vcard_map.set(key, value);
					});
				}
			});
			return map;
		};
		next.getg = function (player) {
			return [];
		};
		return next;
	},

	/**
	 * 返回某些牌是否能进入玩家的判定区
	 */
	canAddJudge(this: Player, card: string | Card | VCard, player?: Player): boolean {
		if (this.isDisabledJudge()) {
			return false;
		}
		let name: string | undefined;
		if (typeof card == "string") {
			name = card;
		} else {
			name = card.viewAs || card.name;
		}
		if (!name) {
			return false;
		}
		const cardInfo = lib.card[name] as Record<string, any> | undefined;
		if (!cardInfo) {
			return false;
		}
		if (!cardInfo.allowDuplicate && this.hasJudge(name)) {
			return false;
		}
		if (this.isOut()) {
			return false;
		}
		return true;
	},

	addJudgeNext(this: Player, card: Card | VCard, unlimited?: boolean): GameEvent | undefined {
		if (!card.expired) {
			const cards = get.itemtype(card) == "card" ? [card as Card] : (card.cards ?? []);
			if (
				!unlimited &&
				cards.some(card => {
					const position = get.position(card, true);
					return position != "j" && position != "o";
				})
			) {
				game.log(card, "已被移出处理区，无法置入判定区");
				return;
			}
			let target: Player | null = this;
			do {
				target = target.getNext();
				if (!target) {
					target = this;
				}
				if (lib.filter.judge(card, target, target)) {
					break;
				}
				if (target == this) {
					target = null;
				}
			} while (target);
			if (target) {
				return target.addJudge(card, cards);
			}
		} else {
			card.expired = false;
		}
	},

	judge(this: Player, params?: any): GameEvent {
		const next = game.createEvent("judge") as JudgeEventDraft;
		next.player = this;

		// eslint-disable-next-line prefer-rest-params
		const args = [...arguments];
		if (args.length === 1 && typeof params == "object" && params !== null && get.itemtype(params) == null) {
			Object.assign(next, params);
		} else {
			for (const arg of args) {
				if (get.itemtype(arg) == "card" || get.is.object(arg)) {
					next.card = arg;
				} else if (typeof arg == "string") {
					next.skill = arg;
				} else if (typeof arg == "function") {
					next.judge = arg;
				} else if (typeof arg == "boolean") {
					next.clearArena = arg;
				} else if (["div", "fragment"].includes(get.objtype(arg) as string)) {
					(next as { position?: unknown }).position = arg;
				}
			}
		}
		if (next.card && next.judge == undefined) {
			next.judge = get.judge(next.card);
			next.judge2 ??= get.judge2(next.card);
		}
		if (next.judge == undefined) {
			next.judge = function () {
				return 0;
			};
		}
		if (next.position == undefined) {
			(next as { position?: unknown }).position = ui.discardPile;
		}
		if (next.card) {
			next.cardname = next.card.viewAs || next.card.name;
		}

		let str = "";
		if (next.card) {
			str = get.translation(next.card.viewAs || next.card.name);
		} else if (next.skill) {
			str = get.translation(next.skill);
		} else {
			str = get.translation(_status.event.name);
		}
		next.judgestr = str;
		next.setContent("judge");
		return next as GameEvent;
	},

	/**
	 * 返回玩家判定区是否有某(种牌名的)牌
	 */
	hasJudge(this: Player, name: string | Card | VCard | { viewAs?: string; name?: string }): boolean {
		const targetName = name && typeof name === "object" ? name.viewAs || name.name : name;
		const judges = this.getVCards("j");
		for (let i = 0; i < judges.length; i++) {
			if (judges[i].name === targetName) {
				return true;
			}
		}
		return false;
	},

	/**
	 * 返回玩家判定区中的虚拟牌
	 */
	getVJudge(this: Player, name?: string): VCard | null {
		const judges = this.getVCards("j");
		for (let i = 0; i < judges.length; i++) {
			if (judges[i].name == name) {
				return judges[i];
			}
		}
		return null;
	},

	/**
	 * 返回玩家判定区中的牌
	 * @deprecated
	 */
	getJudge(this: Player, name?: string): Card | null {
		const judges = this.getCards("j");
		for (let i = 0; i < judges.length; i++) {
			if ((judges[i].viewAs || judges[i].name) == name) {
				return judges[i];
			}
		}
		return null;
	},
};
