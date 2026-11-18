import { _status, lib, get, ui } from "noname";
import { getRegisteredSkill } from "../../library/skillRegistry.js";
import type { GameEvent as GameEventClass, GameEventNumberValue } from "../../library/element/gameEvent.js";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const playerAndSkillQueryMethods = {
	filterSkills(this: Game, skills: string[], player: Player, exclude?: string[]) {
		const out = skills.slice().removeArray(Object.keys(player.disabledSkills));
		if (!player.storage.skill_blocker || !player.storage.skill_blocker.length) {
			return out;
		}
		return out.filter(value => (exclude && exclude.includes(value)) || !get.is.blocked(value, player));
	},
	expandSkills(this: Game, skills: string[], subSkill = false) {
		const expandedSkills: string[] = [];
		return skills.addArray(
			skills.reduce((previousValue, currentValue) => {
				const info = get.info(currentValue);
				if (info) {
					if (info.group) {
						const adds = (Array.isArray(info.group) ? info.group : [info.group]).filter(i => lib.skill[i]);
						previousValue.push(...adds);
					}
					if (subSkill && info.subSkill) {
						const adds = Object.keys(info.subSkill)?.filter(i => lib.skill[`${currentValue}_${i}`]);
						if (adds?.length) {
							previousValue.push(...adds.map(i => `${currentValue}_${i}`));
						}
					}
				} else {
					console.log(currentValue);
				}
				return previousValue;
			}, expandedSkills)
		);
	},
	css(this: Game, style: { [key: string]: any }) {
		return Object.keys(style).forEach(value => {
			let uiStyle = ui.style[value];
			if (!uiStyle) {
				uiStyle = ui.style[value] = document.createElement("style");
				document.head.appendChild(uiStyle);
			}
			uiStyle.innerHTML = `${value}${JSON.stringify(style[value]).replace(/"/g, "")}`;
		});
	},
	hasPlayer(this: Game, func: (player: Player) => boolean, includeOut?: boolean) {
		return game.players.some(value => (includeOut || !value.isOut()) && func(value));
	},
	hasPlayer2(this: Game, func: (player: Player) => boolean, includeOut?: boolean) {
		return game.players.concat(game.dead).some(value => (includeOut || !value.isOut()) && func(value));
	},
	countPlayer(this: Game, func?: (player: Player) => number | boolean, includeOut?: boolean) {
		if (typeof func != "function") {
			func = lib.filter.all;
		}
		return game.players.reduce((previousValue, currentValue) => {
			if (!includeOut && currentValue.isOut()) {
				return previousValue;
			}
			const result = func(currentValue);
			if (typeof result == "number") {
				previousValue += result;
			} else if (result) {
				previousValue++;
			}
			return previousValue;
		}, 0);
	},
	countPlayer2(this: Game, func: (player: Player) => number | boolean = lib.filter.all, includeOut?: boolean) {
		if (typeof func != "function") {
			func = lib.filter.all;
		}
		return game.players.concat(game.dead).reduce((previousValue, currentValue) => {
			if (!includeOut && currentValue.isOut()) {
				return previousValue;
			}
			const result = func(currentValue);
			if (typeof result == "number") {
				previousValue += result;
			} else if (result) {
				previousValue++;
			}
			return previousValue;
		}, 0);
	},
	filterPlayer(this: Game, func?: (player: Player) => boolean, list?: Player[], includeOut?: boolean): Player[] {
		if (!Array.isArray(list)) {
			list = [];
		}
		if (typeof func != "function") {
			func = lib.filter.all;
		}
		return list.addArray(game.players.filter(value => (includeOut || !value.isOut()) && func(value)));
	},
	filterPlayer2(this: Game, func?: (player: Player) => boolean, list?: Player[], includeOut?: boolean): Player[] {
		if (!Array.isArray(list)) {
			list = [];
		}
		if (typeof func != "function") {
			func = lib.filter.all;
		}
		return list.addArray(game.players.concat(game.dead).filter(value => (includeOut || !value.isOut()) && func(value)));
	},
	findPlayer(this: Game, func: (player: Player) => boolean, includeOut?: boolean) {
		return game.players.find(value => (includeOut || !value.isOut()) && func(value)) || null;
	},
	findPlayer2(this: Game, func: (player: Player) => boolean, includeOut?: boolean) {
		return game.players.concat(game.dead).find(value => (includeOut || !value.isOut()) && func(value)) || null;
	},
	findCards(this: Game, func: (value: string, card: object) => boolean, all?: boolean) {
		return Object.keys(lib.card).filter(value => {
			if (!lib.translate[`${value}_info`]) {
				return false;
			}
			if (lib.card[value].mode && lib.card[value].mode.includes(lib.config.mode) == false) {
				return false;
			}
			if (!all && !lib.inpile.includes(value)) {
				return false;
			}
			return func(value, lib.card[value]);
		});
	},
	countGroup(this: Game) {
		const list = lib.group.slice(0);
		return game.countPlayer(current => {
			const group = current.group;
			if (group === undefined || !list.includes(group)) {
				return false;
			}
			list.remove(group);
			return true;
		});
	},
	/**
	 * 此函数用于计算函数的时间消耗。
	 */
	testRunCost(this: Game, func: Function): number {
		const time = Date.now();
		func();
		const past = Date.now() - time;
		console.log(past);
		return past;
	},
	/**
	 * 此方法用于对所有targets按顺序执行一个async函数。
	 */
	async doAsyncInOrder<T, R>(this: Game, targets: T[], asyncFunc: (target: T, i: number) => R | PromiseLike<R>, sort?: (a: T, b: T) => number) {
		if (!sort) {
			sort = lib.sort.seat;
		}
		const sortedTargets = targets.sort(sort);
		for (let i = 0; i < sortedTargets.length; i++) {
			const target = sortedTargets[i];
			await Promise.try(asyncFunc, target, i);
		}
	},
	/**
	 * 此方法用于让所有targets同时执行一个选择函数
	 */
	chooseAnyOL(this: Game, targets: Player[], func: Function, args: any[]): GameEvent {
		const next = game.createEvent("chooseAnyOL");
		next.targets = targets;
		next.player = _status.event.player;
		next.func = func;
		next.args = args;
		next.setContent("chooseAnyOL");
		return next;
	},
	/**
	 * 用于玩家使用非自己手牌时生成的可以选择的假牌（其实就是复制一份出来）。
	 */
	createFakeCards(this: Game, cards: Card[] | Card, isBlank = false, tempname?: string): Card[] {
		if (!Array.isArray(cards)) {
			cards = [cards];
		}
		return cards.map(card => {
			const cardx = ui.create.card();
			cardx.isFake = true;
			cardx._cardid = card.cardid;
			if (isBlank) {
				cardx.init([null, null, tempname || "猜猜看啊", null]);
				game.broadcastAll(cardx => {
					cardx.classList.add("infohidden");
					cardx.classList.add("infoflip");
				}, cardx);
			} else {
				cardx.init(get.cardInfo(card));
			}
			return cardx;
		});
	},
	/**
	 * 用于删除createFakeCards生成的假牌。
	 */
	deleteFakeCards(this: Game, cards: Card[] | Card): Card[] {
		if (!Array.isArray(cards)) {
			cards = [cards];
		}
		const fake = cards.filter(card => card.isFake && card._cardid),
			other = cards.removeArray(fake),
			wild: Card[] = [],
			map: Record<string, Card[]> = {};
		fake.forEach(card => {
			const owner = get.owner(card);
			if (!owner) {
				wild.push(card);
				return;
			}
			map[owner.playerid] ??= [];
			map[owner.playerid].push(card);
		});
		wild.forEach(i => i.delete());
		for (const id in map) {
			const target = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
			const mappedCards = map[id];
			if (target?.isOnline2()) {
				target.send(
					function (cards, player) {
						cards.forEach(i => i.delete());
						if (player == game.me) {
							ui.updatehl();
						}
					},
					mappedCards,
					target
				);
			}
			mappedCards.forEach(i => i.delete());
			if (target == game.me) {
				ui.updatehl();
			}
		}
		return other;
	},
	/**
	 * 删除当前的poptip对话框
	 */
	closePoptipDialog(this: Game) {
		if (_status.poptip?.length) {
			_status.poptip[0].delete();
			_status.poptip[1].remove();
			delete _status.poptip;
		}
	},
	/**
	 * find the skillname of the event
	 * 获取触发事件的技能
	 */
	findSkill(this: Game, event: GameEvent, includeCharlotteSkill = false, includeEquipSkill = false, includeGlobalSkill = false): string | null {
		let skill = "";
		let count = 0;
		let evt: GameEventClass<GameEventNumberValue> | undefined = event as any;
		do {
			evt = evt?.parent;
			let name = evt?.skill || evt?.name;
			if (!name) {
				break;
			}
			if (name.startsWith("pre_")) {
				name = name.slice(4);
			}
			for (const suffix of ["_backup", "ContentBefore", "ContentAfter", "_cost"]) {
				if (name.endsWith(suffix)) {
					name = name.slice(0, name.lastIndexOf(suffix));
				}
			}
			skill = get.sourceSkillFor(name);
			const info = getRegisteredSkill(lib.skill, skill);
			if (!info || !Object.keys(info).length) {
				continue;
			}
			if ((!includeCharlotteSkill && info.charlotte) || (!includeEquipSkill && info.equipSkill) || (!includeGlobalSkill && lib.skill.global.includes(skill))) {
				return null;
			}
			return skill;
		} while (++count < 5);
		return null;
	},
};
