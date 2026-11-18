import { _status, lib, get, ui } from "noname";
import { game } from "../index.js";
import type { Game } from "../index.js";

export const rulesAndNatureMethods = {
	//Stratagem
	//谋攻
	setStratagemBuffCost(this: Game, cardName: string, cost: any) {
		return game.broadcastAll((clientCardName, clientCost) => lib.stratagemBuff.cost.set(clientCardName, clientCost), cardName, cost);
	},
	setStratagemBuffEffect(this: Game, cardName: string, effect: any) {
		return game.broadcastAll((clientCardName, clientEffect) => lib.stratagemBuff.cost.set(clientCardName, clientEffect), cardName, effect);
	},
	setStratagemBuffPrompt(this: Game, cardName: string, prompt: any) {
		return game.broadcastAll((clientCardName, clientPrompt) => lib.stratagemBuff.cost.set(clientCardName, clientPrompt), cardName, prompt);
	},
	/**
	 * 添加游戏内生成使用的临时tag
	 */
	addTempTag(this: Game, id: string, translation: string): string {
		game.addVideo("addTempTag", null, [id, translation]);
		game.broadcastAll(
			(id, translation) => {
				if (!lib.translate[id]) {
					lib.translate[id] = translation;
					_status.postReconnect.addTempTag ??= [
						list => {
							for (const args of list) {
								// @ts-expect-error ignore
								game.addTempTag(...args);
							}
						},
						[],
					];
					_status.postReconnect.addTempTag[1].push([id, translation]);
				}
			},
			id,
			translation
		);
		return id;
	},
	/**
	 * 添加新的属性杀
	 */
	addNature(this: Game, nature: string, translation?: string, config?: any) {
		if (!nature) {
			throw new TypeError();
		}
		if (translation && translation.length) {
			lib.translate["nature_" + nature] = translation;
		}
		game.callHook("addNature", [nature, translation, config]);
		return nature;
	},
	/**
	 * 判断卡牌信息/事件是否有某个属性
	 */
	hasNature(this: Game, item: any, nature?: string, player?: Player | false) {
		const natures = get.natureList(item, player);
		if (!nature) {
			return natures.length > 0;
		}
		if (nature == "linked") {
			return natures.some(n => lib.linked.includes(n));
		}
		return get.is.sameNature(natures, nature);
	},
	/**
	 * 设置卡牌信息/事件的属性
	 */
	setNature(this: Game, item: any, nature?: string | string[], addNature?: boolean) {
		if (!nature) {
			nature = [];
		}
		if (!addNature) {
			item.nature = get.nature(nature);
			if (!item.nature.length) {
				delete item.nature;
			}
		} else {
			const natures = Array.isArray(nature) ? nature : nature.split(lib.natureSeparator);
			const _nature = get.natureList(item, false);
			_nature.addArray(natures);
			item.nature = _nature.join(lib.natureSeparator);
		}
		return item.nature;
	},
	/**
	 * 洗牌
	 */
	washCard(this: Game) {
		if (!ui.cardPile.hasChildNodes() && !ui.discardPile.hasChildNodes()) {
			return false;
		}
		if (_status.maxShuffle != undefined) {
			if (_status.maxShuffle == 0) {
				if (_status.maxShuffleCheck) {
					game.over(_status.maxShuffleCheck());
				} else {
					game.over("平局");
				}
				return [];
			}
			_status.maxShuffle--;
		}
		game.shuffleNumber++;
		const cards = Array.from(ui.cardPile.childNodes);
		if (_status.discarded) {
			_status.discarded.length = 0;
		}
		for (let i = 0; i < ui.discardPile.childNodes.length; i++) {
			const currentcard = ui.discardPile.childNodes[i];
			if (!(currentcard instanceof lib.element.Card)) {
				throw new TypeError("Discard pile must contain physical cards");
			}
			currentcard.vanishtag.length = 0;
			currentcard.clearKnowers();
			if (get.info(currentcard).vanish || currentcard.storage.vanish) {
				currentcard.remove();
				continue;
			}
			cards.push(currentcard);
		}
		cards.randomSort();
		return game.cardsGotoPile(cards, "triggeronly", "washCard", ["shuffleNumber", game.shuffleNumber]);
	},
	/**
	 * 基于钩子的添加势力方法
	 */
	addGroup(this: Game, id: string, short?: string | object | null, name?: string | object | null, config?: any, type = "default") {
		if (!id) {
			throw new TypeError();
		}
		if (typeof short === "object") {
			config = short;
			short = null;
		}
		if (typeof name === "object") {
			config = name;
			name = null;
		}
		if (typeof short !== "string" && short) {
			name = short;
		}
		if (["default", "all"].includes(type)) {
			lib.group.add(id);
		}
		if (["select", "all"].includes(type)) {
			lib.selectGroup.add(id);
		}
		if (short) {
			lib.translate[id] = short;
		}
		if (name) {
			lib.translate[`${id}2`] = name as string;
		}
		game.callHook("addGroup", [id, short, name, config]);
		return id;
	},
	/**
	 * 通用的调用钩子函数
	 */
	callHook<HookType extends NonameHookType, Name extends keyof NonameHookType>(this: Game, name: Name, args: Parameters<HookType[Name]>) {
		const callHook = () => {
			const hooks = lib.hooks[name];
			if (!hooks) {
				throw new TypeError(`Hook ${String(name)} is not initialized`);
			}
			for (const hook of hooks) {
				if (typeof hook == "function") {
					hook(...args);
				}
			}
		};
		if ("onload" in lib) {
			lib.onload.add(callHook);
		} else {
			callHook();
		}
	},
	//Yingbian
	//应变
	yingbianEffect(this: Game, event: GameEvent, content: any, ...rest: any[]) {
		const yingbianEffect = game.createEvent("yingbianEffect");
		yingbianEffect.player = event.player;
		yingbianEffect.card = event.card;
		yingbianEffect._trigger = event;
		yingbianEffect.setContent(content);
		yingbianEffect._args = [event, content, ...rest];
		return yingbianEffect;
	},
	setYingbianConditionColor(this: Game, yingbianCondition: string, color: string) {
		return game.broadcastAll((yingbianCondition, color) => lib.yingbian.condition.color.set(yingbianCondition, color), yingbianCondition, color);
	},
	setComplexYingbianCondition(this: Game, yingbianCondition: string, condition: any) {
		return game.broadcastAll((yingbianCondition, condition) => lib.yingbian.condition.complex.set(yingbianCondition, condition), yingbianCondition, condition);
	},
	setSimpleYingbianCondition(this: Game, yingbianCondition: string, condition: any) {
		return game.broadcastAll((yingbianCondition, condition) => lib.yingbian.condition.simple.set(yingbianCondition, condition), yingbianCondition, condition);
	},
	setYingbianEffect(this: Game, yingbianEffect: string, effect: any) {
		return game.broadcastAll((yingbianEffect, effect) => lib.yingbian.effect.set(yingbianEffect, effect), yingbianEffect, effect);
	},
	setYingbianPrompt(this: Game, yingbian: string, prompt: any) {
		return game.broadcastAll((yingbian, prompt) => lib.yingbian.prompt.set(yingbian, prompt), yingbian, prompt);
	},
};
