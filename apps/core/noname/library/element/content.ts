// 不经过编译
import { _status, game, get, lib, ui, ai } from "noname";
import { GameEvent, initializeEvent, type RawGameDrawEvent } from "./gameEvent.js";
import { Player } from "./player.js";
import type { LegacyChooseButtonCreateDialog } from "./Player/legacyParams";

import { delay } from "@/util/index.js";
import { tryLLMDecide } from "@/llm/index.js";
import { forwardEventLogSkill, getLogSkillName } from "./GameEvent/logSkill.js";
import { getButtonSubtypes } from "./GameEvent/buttonSubtypes.js";
import { isImportModePayload, isSelectionResultObject as isBoundarySelectionResultObject, normalizeSelectionResult as normalizeBoundarySelectionResult, type SelectionResultRuntime } from "./GameEvent/resultBoundary.js";
import { getRegisteredSkill, requireRegisteredSkill } from "../skillRegistry.js";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const selectionResultRuntime: SelectionResultRuntime = {
	isCard(value): value is Card {
		return value instanceof lib.element.Card;
	},
	isPlayer(value): value is Player {
		return value instanceof lib.element.Player;
	},
	isVCard(value): value is VCard {
		return value instanceof lib.element.VCard;
	},
	isSelectableButton(value): value is SelectableResultButton {
		return typeof HTMLDivElement !== "undefined" && value instanceof HTMLDivElement;
	},
};

function isAIResult(value: GameEventResult): boolean {
	return value == "ai";
}

function isSelectionResultObject(value: unknown): value is Partial<Result> {
	return isBoundarySelectionResultObject(value, selectionResultRuntime);
}

function normalizeSelectionResult(value: unknown): EventResult {
	return normalizeBoundarySelectionResult(value, selectionResultRuntime);
}

function isCardLinks(value: unknown): value is Card[] {
	return Array.isArray(value) && value.every(link => link instanceof lib.element.Card);
}

function isVCardLinks(value: unknown): value is VCard[] {
	return Array.isArray(value) && value.every(link => link instanceof lib.element.VCard);
}

function isCardMatrix(value: unknown): value is Card[][] {
	return Array.isArray(value) && value.every(isCardLinks);
}

function normalizeChooseButtonTargetResult(value: unknown): EventResult {
	const result = normalizeSelectionResult(value);
	if (typeof result !== "string" && Array.isArray(result.targets) && !result.targets.every(target => target instanceof lib.element.Player)) {
		return "cancelled";
	}
	return result;
}

/**
 * Replace a local AI result only when LLM translation completed. Returning
 * false deliberately preserves event.result === "ai" for the legacy AI.
 */
async function applyLLMDecision(event) {
	const decision = await tryLLMDecide(event);
	if (!decision?.handled || !decision.result) {
		return false;
	}
	event.result = decision.result;
	game.uncheck();
	return true;
}

/**
 * A child chooseButton owns an explicit headless final predicate only when its
 * UI filter is the default accept-all predicate or the skill supplied an
 * adapter. A legacy filterOk may read ui.selected, so omitting the contract
 * intentionally makes LLM validation fall back instead of accepting it.
 */
function attachChooseButtonSelectionSpec(next, skill, event, player) {
	const chooseButton = skill.chooseButton;
	if (typeof chooseButton.filterOk !== "function") {
		next.set("selectionSpec", { finalPredicate: () => true });
		return;
	}
	const rawSpec = chooseButton.selectionSpec ?? skill.selectionSpec;
	const source = rawSpec === true ? undefined : typeof rawSpec === "function" ? rawSpec(event, player) : rawSpec;
	if (source && typeof source.finalPredicate === "function") {
		next.set("selectionSpec", { finalPredicate: source.finalPredicate });
	}
}

// 未来再改
export const Content: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
	async emptyEvent(event) {
		await event.trigger(event.name);
	},
	async _save(event, trigger) {
		event.dying = trigger.getPlayer();

		const dying = trigger.getPlayer();
		const acted = new Set();
		const prompt = `${get.translation(trigger.getPlayer())}濒死，是否帮助？`;

		outer: while (!trigger.getPlayer().isDead()) {
			const player = event.getPlayer();
			acted.add(player);

			const taoEnemyConfig = lib.config.tao_enemy && dying.side !== player.side && lib.config.mode != "identity" && lib.config.mode != "guozhan" && !dying.hasSkillTag("revertsave");
			let result: EventResult = { bool: false };
			if (!taoEnemyConfig && player.canSave(dying) && player.isIn()) {
				const selectedResult = await player
					.chooseToUse({
						filterCard(card, player, name) {
							const event = <GameEvent>(<unknown>name) || _status.event;
							return lib.filter.cardSavable(card, player, event.dying);
						},
						filterTarget(card, player, target) {
							if (target != _status.event.dying) {
								return false;
							}
							if (!card) {
								return false;
							}
							const info = get.info(card);
							if (!info.singleCard || ui.selected.targets.length == 0) {
								let mod = game.checkMod(card, player, target, "unchanged", "playerEnabled", player);
								if (mod == false) {
									return false;
								}
								mod = game.checkMod(card, player, target, "unchanged", "targetEnabled", target);
								if (mod !== "unchanged") {
									return mod ?? false;
								}
							}
							return true;
						},
						prompt,
						prompt2: `当前体力：${dying.hp}`,
						ai1(card) {
							if (typeof card == "string") {
								const info = get.info(card);
								if (info.ai && info.ai.order) {
									if (typeof info.ai.order == "number") {
										return info.ai.order;
									} else if (typeof info.ai.order == "function") {
										return info.ai.order();
									}
								}
							}
							return 1;
						},
						ai2(target) {
							const effect_use = get.effect_use(target);
							if (effect_use <= 0) {
								return effect_use;
							}
							return get.effect(target);
						},
						type: "dying",
						targetRequired: true,
						dying,
					})
					.forResult();
				result = normalizeSelectionResult(selectedResult);
			} /* else {
				result = { bool: false };
			}*/

			if (event.finished) {
				break;
			}
			if (typeof result !== "string" && result.bool) {
				if (Number(dying.hp) > 0 || trigger.nodying || dying.nodying || !dying.isAlive() || dying.isOut() || dying.removed) {
					trigger.untrigger();
					break;
				}
			} else {
				let next = player.next;
				const cacheNext = new Set();

				while (true) {
					if (acted.has(next) || cacheNext.has(next)) {
						break outer;
					}

					if (!next.isOut()) {
						event.player = next;
						break;
					}

					cacheNext.add(next);
					next = next.next;
				}
			}
		}
	},
	async chooseNumbers(event, trigger, player) {
		if (event.chooseTime && _status.connectMode && !game.online) {
			event.time = lib.configOL.choose_timeout;
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.chooseTime);
		}
		let result;
		if (!Array.isArray(event.numbers)) {
			event.numbers = [];
		}
		if (!event.numbers.length) {
			event.list.forEach(item => {
				if (Array.isArray(item)) {
					if (["asc", "sort"].includes(item[0])) {
						event.numbers.push(item.slice(1).sort((a, b) => a - b)[0]);
					} else if (item[0] == "desc") {
						event.numbers.push(item.slice(1).sort((a, b) => b - a)[0]);
					} else {
						event.numbers.push(item[0]);
					}
				} else {
					event.numbers.push(item.min || 0);
				}
			});
		}
		if (event.isMine()) {
			result = await new Promise((resolve, reject) => {
				_status.imchoosing = true;
				event.settleed = false;
				event.dialog = ui.create.dialog(event.prompt || "请调整以下数值", "forcebutton", "hidden");
				if (event.prompt2) {
					event.dialog.addText(event.prompt2);
				}
				event.switchToAuto = () => {
					if (!event.filterOk(event)) {
						if (!event.forced) {
							event._result = { bool: false };
						} else {
							event._result = "ai";
						}
					} else {
						event._result = "ai";
					}
					event.dialog.close();
					if (ui.confirm) {
						ui.confirm.close();
					}
					game.resume();
					_status.imchoosing = false;
					resolve(event._result);
				};

				function optionUpdate(select) {
					const index = parseInt(select.id.slice(6));
					const item = event.list[index];
					const current = event.numbers[index];
					while (select.childElementCount) {
						select.removeChild(select.firstChild);
					}
					if (Array.isArray(item)) {
						let numbers;
						if (["asc", "sort"].includes(item[0])) {
							numbers = item.slice(1).sort((a, b) => a - b);
						} else if (item[0] == "desc") {
							numbers = item.slice(1).sort((a, b) => b - a);
						} else {
							numbers = item;
						}
						for (const num of numbers) {
							const option = document.createElement("option");
							option.innerHTML = num;
							if (event.optprompt) {
								if (typeof event.optprompt == "string") {
								option.innerHTML = event.optprompt.replace("#", num).replace("$", String(get.cnNumber(num, true)));
								} else if (typeof event.optprompt == "function") {
									option.innerHTML = event.optprompt(num, index);
								}
							}
							option.value = num;
							if (num == current) {
								option.selected = true;
							}
							if (!event.filterSelect(num, index, event)) {
								option.disabled = true;
							}
							select.appendChild(option);
						}
					} else {
						let actual;
						const max = item.max || 9;
						if (event.optionSum) {
							actual = event.optionSum - event.numbers.reduce((sum, num) => sum + num, 0) + current;
						}
						for (let num = item.min || 0; num <= Math.min(actual || max, max); num += item.base || 1) {
							const option = document.createElement("option");
							option.innerHTML = num;
							if (event.optprompt) {
								if (typeof event.optprompt == "string") {
								option.innerHTML = event.optprompt.replace("#", num).replace("$", String(get.cnNumber(num, true)));
								} else if (typeof event.optprompt == "function") {
									option.innerHTML = event.optprompt(num, index);
								}
							}
							option.value = num;
							if (num == current) {
								option.selected = true;
							}
							if (!event.filterSelect(num, index, event)) {
								option.disabled = true;
							}
							select.appendChild(option);
						}
					}
				}

				for (const [index, item] of event.list.entries()) {
					event.dialog.addText(item.prompt || "选择一个数值");
					const select = document.createElement("select");
					select.id = `select${index}`;
					select.classList.add("add-setting");
					select.style.margin = "0";
					select.style.width = "30%";
					select.style.position = "relative";
					select.onchange = () => {
						event.numbers[parseInt(select.id.slice(6))] = parseInt(select.value);
						event.dialog.content.querySelectorAll(`[id ^= 'select']`).forEach(select => optionUpdate(select));
						if (event.filterOk(event)) {
							if (event.forced) {
								ui.create.confirm("o");
							} else {
								ui.create.confirm("oc");
							}
						} else {
							if (!event.forced) {
								ui.create.confirm("c");
							} else if (ui.confirm) {
								ui.confirm.close();
							}
						}
					};
					optionUpdate(select);
					event.dialog.content.appendChild(select);
				}
				event.dialog.add(" <br> ");
				event.dialog.open();
				event.custom.replace.confirm = bool => {
					if (bool) {
						event._result = { bool: true, numbers: event.numbers };
					} else {
						event._result = { bool: false };
					}
					event.dialog.close();
					if (ui.confirm) {
						ui.confirm.close();
					}
					game.resume();
					_status.imchoosing = false;
					resolve(event._result);
				};
				if (event.filterOk(event)) {
					if (event.forced) {
						ui.create.confirm("o");
					} else {
						ui.create.confirm("oc");
					}
				} else {
					if (!event.forced) {
						ui.create.confirm("c");
					} else if (ui.confirm) {
						ui.confirm.close();
					}
				}
				game.pause();
				game.countChoose();
				event.choosing = true;
			});
		} else if (event.isOnline()) {
			result = normalizeSelectionResult(await event.sendAsync());
		} else {
			result = "ai";
		}
		if (event.time) {
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.time);
		}
		const llmHandled = result == "ai" && (await applyLLMDecision(event));
		if (llmHandled) {
			result = event.result;
		}
		if (!llmHandled && (!result || result == "ai" || (event.forced && !result.bool)) && event.processAI) {
			const numbers = event.processAI(event);
			if (typeof numbers == "boolean") {
				if (numbers == true) {
					result = { bool: true, numbers: event.numbers };
				} else {
					result = { bool: false };
				}
			} else if (Array.isArray(numbers)) {
				result = { bool: true, numbers };
			} else {
				result = { bool: false };
			}
		}
		event.result = result;
	},
	//变更武将牌
	async changeCharacter(event, trigger, player) {
		const rawPairs = [player.name1];
		if (player.name2 && lib.character[player.name2]) {
			rawPairs.push(player.name2);
		}
		event.rawPairs = rawPairs;
		const newPairs = event.newPairs;
		for (const name of newPairs) {
			if (!lib.character[name]) {
				console.warn(`警告：Player[${player.name}]试图将武将牌变更为不存在的武将:`, name);
				return;
			}
		}
		const removeSkills: string[] = [];
		const addSkills: string[] = [];
		//进行Log
		if (event.log !== false) {
			//变更前后数量相同的情况
			if (rawPairs.length == newPairs.length) {
				for (let i = 0; i < Math.min(2, rawPairs.length); i++) {
					const rawName = rawPairs[i];
					const newName = newPairs[i];
					if (rawName != newName) {
						game.log(player, `将${i == 0 ? "主" : "副"}将从`, `#b${get.translation(rawName)}`, "变更为了", `#b${get.translation(newName)}`);
					}
				}
			} else if (rawPairs.length == 1 && newPairs.length == 2) {
				game.log(player, "将单将", `#b${get.translation(rawPairs[0])}`, "变更为了双将", `#b${get.translation(newPairs[0])}+${get.translation(newPairs[1])}`);
			} else if (rawPairs.length == 2 && newPairs.length == 1) {
				game.log(player, "将双将", `#b${get.translation(rawPairs[0])}+${get.translation(rawPairs[1])}`, "变更为了单将", `#b${get.translation(newPairs[0])}`);
			}
		}
		//确定要失去和获得的技能
		//失去技能时全部失去，但获得技能时，非主公角色不能获得主公技。
		rawPairs.forEach(name => {
			removeSkills.addArray(lib.character[String(name)][3]);
		});
		newPairs.forEach(name => {
			addSkills.addArray(
				lib.character[name][3].filter(skill => {
					const info = get.info(skill);
					if (!info || (info.zhuSkill && !player.isZhu2())) {
						return false;
					}
					return true;
				})
			);
		});
		//实际变更武将牌
		player.reinit2(newPairs);
		//操作武将牌堆
		if (_status.characterlist) {
			_status.characterlist.removeArray(newPairs);
			_status.characterlist.addArray(rawPairs);
		}
		//变更一下获得前后的技能
		const next = player.changeSkills(addSkills, removeSkills);
		if (!next) {
			return;
		}
		if (event.log === false) {
			next.$handle = (current, add, remove, evt) => {
				if (add.length) {
					current.addSkill(add);
				}
				if (remove.length) {
					current.removeSkill(remove);
				}
			};
		}
		await next;
		//变更角色的所属势力。如果新将是双势力，重选一下势力。 国战不因换将而重选势力
		if (event.changeGroup !== false && get.mode() != "guozhan") {
			let newGroups: string[] = [];
			if (!player.isUnseen(1)) {
				const doubleGroups = get.is.double(player.name1, []);
				if (Array.isArray(doubleGroups)) {
					newGroups = doubleGroups;
				} else {
					const group = get.character(player.name1, 1);
					if (typeof group == "string") {
						newGroups = [group];
					}
				}
			} else if (player.name2 && !player.isUnseen(2)) {
				const doubleGroups = get.is.double(player.name2, []);
				if (Array.isArray(doubleGroups)) {
					newGroups = doubleGroups;
				} else {
					const group = get.character(player.name2, 1);
					if (typeof group == "string") {
						newGroups = [group];
					}
				}
			}
			if (newGroups.length > 1) {
				const result = await player.chooseControl({ controls: newGroups, prompt: "请选择一个新的势力" }).forResult();
				if (typeof result == "string" || typeof result.control != "string") {
					return;
				}
				if (result.control != player.group) {
					await player.changeGroup(result.control);
				}
			} else if (newGroups.length == 1 && newGroups[0] != player.group) {
				await player.changeGroup(newGroups[0]);
			}
		}
	},
	//变更技能
	async changeSkills(event, trigger, player) {
		//获取玩家当前已有的技能
		const ownedSkills = player.getSkills(true, false, false);
		//去重检查
		event.addSkill.unique();
		event.removeSkill.unique();
		//避免失去还没拥有的技能
		event.removeSkill = event.removeSkill.filter(skill => ownedSkills.includes(skill));
		const duplicatedSkills = event.addSkill.filter(skill => event.removeSkill.includes(skill));
		if (duplicatedSkills.length) {
			event.addSkill.removeArray(duplicatedSkills);
			event.removeSkill.removeArray(duplicatedSkills);
		}
		//if (!event.addSkill.length&&!event.removeSkill.length) return;
		//手动触发时机
		await event.trigger("changeSkillsBefore");
		await event.trigger("changeSkillsBegin");
		//处理失去和获得的技能
		if (event.$handle) {
			event.$handle(player, event.addSkill, event.removeSkill, event);
		} else {
			if (event.addSkill.length) {
				player.addSkill(event.addSkill);
				game.log(
					player,
					"获得了技能",
					...event.addSkill
						.filter(i => i in lib.translate)
						.map(i => {
							if (event.popup) {
								player.popup(i);
							}
							return `#g【${get.translation(i)}】`;
						})
				);
			}
			if (event.removeSkill.length) {
				player.removeSkill(event.removeSkill);
				game.log(
					player,
					"失去了技能",
					...event.removeSkill
						.filter(i => i in lib.translate)
						.map(i => {
							if (event.popup) {
								player.popup(i);
							}
							return `#g【${get.translation(i)}】`;
						})
				);
			}
		}
		//手动触发时机
		await event.trigger("changeSkillsEnd");
		await event.trigger("changeSkillsAfter");
	},
	//连接牌
	async connectCards(event, trigger, player) {
		const { source, cards, log } = event;
		const shown = cards.filter(card => get.is.connectedCard(card));
		const hidden = cards.filter(card => !shown.includes(card));
		event.shownCards = shown;
		event.hiddenCards = hidden;
		game.addConnectedCards(cards);
		if (log) {
			game.log(source, `连接了<span class="bluetext">${player == source ? "自己" : get.translation(player)}</span>的`, event.cards);
		}
	},
	//重置连接牌
	async resetConnectedCards(event, trigger, player) {
		const { source, cards, log } = event;
		game.removeConnectedCards(cards);
		if (log) {
			game.log(source, `重置了<span class="bluetext">${player == source ? "自己" : get.translation(player)}</span>的连接牌（`, event.cards, "）");
		}
	},
	//增加明置手牌
	async addShownCards(event, _trigger, player) {
		const hs = player.getCards("h");
		const showingCards = event.cards.filter(showingCard => hs.includes(showingCard));
		const shown = player.getShownCards();

		for (const tag of event.gaintag) {
			player.addGaintag(showingCards, tag);
		}

		event.cards = showingCards.filter(showingCard => !shown.includes(showingCard));
		if (!event.cards.length) {
			return;
		}

		game.log(player, "明置了", event.cards);
		//if (event.animate != false) player.$give(event.cards, player, false);
		await event.trigger("addShownCardsAfter");
	},
	//隐藏明置手牌
	async hideShownCards(event, _trigger, player) {
		const shown = player.getShownCards();
		const hidingCards = event.cards.filter(hidingCard => shown.includes(hidingCard));

		if (!hidingCards.length) {
			return;
		}

		if (event.gaintag.length) {
			for (const tag of event.gaintag) {
				player.removeGaintag(tag, hidingCards);
			}
		} else {
			const map = new Map();
			for (const hidingCard of hidingCards) {
				for (const tag of hidingCard.gaintag) {
					if (tag.startsWith("eternal_") && !tag.slice(8).startsWith("visible_")) {
						continue;
					}
					if (!tag.startsWith("visible_")) {
						continue;
					}

					if (!map.has(tag)) {
						map.set(tag, []);
					}

					map.get(tag).push(hidingCard);
				}
			}

			for (const [tag, card] of map) {
				player.removeGaintag(tag, card);
			}
		}

		hidingCards.removeArray(player.getShownCards());
		if (!hidingCards.length) {
			return;
		}
		event.cards = hidingCards;
		game.log(player, "取消明置了", event.cards);
		//if (event.animate != false) player.$give(hidingCards, player, false);
		await event.trigger("hideShownCardsAfter");
	},
	//Execute the delay card effect
	//执行延时锦囊牌效果
	//TODO: 修改此处的虚拟牌/实体牌判断
	async executeDelayCardEffect(event, trigger, player) {
		const { card } = event;
		const target = event.getTarget();

		target.$phaseJudge(card);
		event.cancelled = false;
		event.cardName = card.viewAs || card.name;
		target.popup(event.cardName, "thunder");

		if (!lib.card[event.cardName].effect) {
			await game.delay();
			return;
		} else if (!lib.card[event.cardName].judge) {
			await game.delay();
			event.nojudge = true;
		}

		await event.trigger("executeDelayCardEffect");
		if (event.cancelled || event.nojudge) {
			return;
		}

		const judgeEvent = player.judge({ card });
		const judge = event.judge;
		const judge2 = event.judge2;
		if (typeof judge === "function") {
			judgeEvent.judge = judge;
		}
		if (typeof judge2 === "function") {
			judgeEvent.judge2 = judge2;
		}

		const result = await judgeEvent.forResult();

		if (event.excluded) {
			delete event.excluded;
		} else {
			const cardName = event.cardName;
			if (event.cancelled && !event.direct) {
				const cardCancel = lib.card[cardName].cancel;
				if (cardCancel) {
					const next = game.createEvent(`${cardName}Cancel`);
					next.setContent(cardCancel);
						next.cards = card instanceof lib.element.Card ? [card] : card.cards ?? [];
					if (!card.viewAs) {
						const autoViewAs = get.autoViewAs(card);
						next.card = autoViewAs;
						autoViewAs.expired = card.expired;
					} else {
						const autoViewAs = get.autoViewAs(
							{
								name: cardName,
							},
							next.cards
						);
						next.card = autoViewAs;
						autoViewAs.expired = card.expired;
					}
					next.player = player;

					await next;
				}
			} else {
				const next = game.createEvent(cardName);
				next.setContent(lib.card[cardName].effect);
				next._result = result;
				next.cards = card instanceof lib.element.Card ? [card] : card.cards ?? [];
				if (!card.viewAs) {
					const autoViewAs = get.autoViewAs(card);
					next.card = autoViewAs;
					autoViewAs.expired = card.expired;
				} else {
					const autoViewAs = get.autoViewAs(
						{
							name: cardName,
						},
						next.cards
					);
					next.card = autoViewAs;
					autoViewAs.expired = card.expired;
				}
				next.player = player;
				await next;
			}
		}

		ui.clear();
		if (card instanceof lib.element.Card) {
			card.delete();
		}
	},
	//Gift
	//赠予
	async gift(event, trigger, player) {
		const { cards } = event;
		const target = event.getTarget();

		for (const card of cards) {
			event.card = card;
			await event.trigger("gift");

			if (event.deniedGifts.includes(card)) {
				game.log(target, "拒绝了", player, "赠予的", card);
				await event.trigger("giftDeny");

				const next = player.loseToDiscardpile({ cards: [card] });
				next.log = false;
				await next;

				await event.trigger("giftDenied");

				continue;
			}

			game.log(player, "将", card, "赠予了", target);
			player.$give(card, target, false);

			await game.delay(0.5);
			await event.trigger("giftAccept");

			if (get.type(card) == "equip") {
				const next = target.equip(card);
				next.log = false;
				await next;
			} else {
				const next = target.gain({ cards: [card], source: player });
				next.visible = true;
				await next;
			}

			await event.trigger("giftAccepted");
		}

		await game.delayx();
	},
	//Recast
	//重铸
	async recast(event, trigger, player) {
		const { cards } = event;

		game.log(player, "重铸了", cards);
		if (typeof event.recastingLose === "function") {
			const lose = event.trigger("recastingLose");
			const recast = event.recastingLose(player, cards);
			const lost = event.trigger("recastingLost");
			// ?
			event.recastingLosingEvents.push(...event.next.filter(value => value.name != "arrangeTrigger"));
			await lose;
			await recast;
			await lost;
		}

		await event.trigger("recast");

		if (typeof event.recastingGain === "function") {
			const gain = event.trigger("recastingGain");
			const recast = event.recastingGain(player, cards);
			const gained = event.trigger("recastingGained");
			// ?
			event.recastingGainingEvents.push(...event.next.filter(value => value.name != "arrangeTrigger"));
			await gain;
			await recast;
			await gained;
		}
	},
	//装备栏相关
	async disableEquip(event, trigger, player) {
		const cards: Card[] = [];
		event.cards = cards;
		const slots: string[] = [];
		if (get.is.mountCombined()) {
			for (const slot of event.slots) {
				if (slot == "equip3" || slot == "equip4") {
					slots.add("equip3_4");
				} else {
					slots.add(slot);
				}
			}
		} else {
			slots.addArray(event.slots);
		}

		slots.sort();
		if (!slots.length) {
			return;
		}

		for (const slot of slots) {
			const left = player.countEnabledSlot(slot);

			let slot_key = slot;
			let lose: number;
			if (slot == "equip3_4") {
				lose = Math.min(left, Math.max(get.numOf(event.slots, "equip3"), get.numOf(event.slots, "equip4")));
				slot_key = "equip3";
			} else {
				lose = Math.min(left, get.numOf(event.slots, slot));
			}

			if (lose > 0) {
				game.log(player, `废除了${get.cnNumber(lose)}个`, `#g${get.translation(slot)}栏`);
				player.disabledSlots ??= {};
				player.disabledSlots[slot_key] ??= 0;
				player.disabledSlots[slot_key] += lose;

				const discardingCards = player.getCards("e", card => {
					if (event.cards.includes(card)) {
						return false;
					}
					if (slot == "equip3_4") {
						return get.subtypes(card).some(subtype => subtype == "equip3" || subtype == "equip4");
					}
					return get.subtypes(card).includes(slot);
				});
				if (discardingCards.length < 0) {
					continue;
				}

				let result: EventResult;
				if (lose < left) {
					let source = event.source;
					const num = cards.length - (left - lose);
					if (!source || !source.isIn()) {
						source = player;
					}

					const selectedResult = await source
						.chooseButton({
							createDialog: [`选择${player == source ? "你" : get.translation(player)}的${get.cnNumber(num)}张${get.translation(slot)}牌置入弃牌堆`, cards],
							forced: true,
							selectButton: [1, num],
						})
						.set("filterOk", () => {
							const evt = get.event();

							let result = 0;
							for (const button of ui.selected.buttons) {
								if (evt.slot == "equip3_4") {
									result += Math.max(get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), "equip3"), get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), "equip4"));
								} else {
									result += get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), evt.slot);
								}
							}

							return result === evt.required;
						})
						.set("required", num)
						.set("slot", slot)
						.forResult();
					result = normalizeSelectionResult(selectedResult);
				} else {
					result = { bool: true, links: discardingCards };
				}

				if (typeof result !== "string" && result.bool && isCardLinks(result.links)) {
					cards.addArray(result.links);
				}
			}
		}

		player.$syncDisable();
		if (cards.length > 0) {
			await player.loseToDiscardpile({ cards });
		}
	},
	async enableEquip(event, trigger, player) {
		const { slots } = event;
		if (!slots.length) {
			return;
		}

		const slotsx: string[] = [...new Set<string>(slots)].sort();
		for (const slot of slotsx) {
			const lost = player.countDisabledSlot(slot);
			const gain = Math.min(lost, get.numOf(slots, slot));
			if (lost <= 0) {
				continue;
			}

			game.log(player, `恢复了${get.cnNumber(gain)}个`, `#g${get.translation(slot)}栏`);
			player.disabledSlots ??= {};
			player.disabledSlots[slot] ??= 0;
			player.disabledSlots[slot] -= gain;
		}

		player.$syncDisable();
	},
	async expandEquip(event, trigger, player) {
		const { slots } = event;

		if (!slots.length) {
			return;
		}

		const slotsx: string[] = [];
		if (get.is.mountCombined()) {
			for (const slot of slots) {
				if (slot == "equip3" || slot == "equip4") {
					slotsx.add("equip3_4");
				} else {
					slotsx.add(slot);
				}
			}
		} else {
			slotsx.addArray(slots);
		}
		slotsx.sort();

		for (const slot of slotsx) {
			let expand = get.numOf(slots, slot);
			let slot_key = slot;
			if (slot == "equip3_4") {
				expand = Math.max(get.numOf(slots, "equip3"), get.numOf(slots, "equip4"));
				slot_key = "equip3";
			}
			game.log(player, `获得了${get.cnNumber(expand)}个额外的`, `#g${get.translation(slot)}栏`);

			player.expandedSlots ??= {};
			player.expandedSlots[slot_key] ??= 0;
			player.expandedSlots[slot_key] += expand;
		}

		player.$syncExpand();
	},
	//选择顶装备要顶的牌
	async replaceEquip(event, trigger, player) {
		const vcards: VCard[] = [];
		const cardSymbol = event.card.cardSymbol;
		const vcard = cardSymbol !== undefined ? event.card[cardSymbol] : undefined;
		vcards.push(vcard || get.autoViewAs(event.card, void 0, false));
		const specializedVCards: VCard[] = [];
		const normalVCards: VCard[] = [];
		const replacedCards: VCard[] = [];
		vcards.forEach(card => {
			const info = get.info(card, false);
			(info?.customSwap ? specializedVCards : normalVCards).push(card);
		});
		specializedVCards.forEach(card => {
			const info = get.info(card, false);
			replacedCards.addArray(player.getVCards("e", card => info.customSwap(card)));
		});
		const types = normalVCards.reduce<string[]>((types, card) => types.concat(get.subtypes(card, false)), []);
		if (types.length > 0) {
			const slots = types;
			const slotsx: string[] = [];
			if (get.is.mountCombined()) {
				slots.forEach(type => {
					if (type == "equip3" || type == "equip4") {
						slotsx.add("equip3_4");
					} else {
						slotsx.add(type);
					}
				});
			} else {
				slotsx.addArray(slots);
			}
			slotsx.sort();
			for (const slot of slotsx) {
				const left = player.countEquipableSlot(slot);
				let lose;
				if (slot == "equip3_4") {
					lose = Math.min(left, Math.max(get.numOf(slots, "equip3"), get.numOf(slots, "equip4")));
				} else {
					lose = Math.min(left, get.numOf(slots, slot));
				}
				let result: EventResult | undefined;
				if (lose <= 0) {
					continue;
				} else {
					const cards = player.getVEquips(slot).filter(card => !replacedCards.includes(card) && lib.filter.canBeReplaced(card, player));
					if (cards.length > 0) {
						if (lose >= left) {
							result = { bool: true, links: cards };
						} else if (cards.length > left - lose) {
							let source = event.source;
							const num = cards.length - (left - lose);
							if (!source || !source.isIn()) {
								source = player;
							}
							const chooseEvent = source
								.chooseButton({
									createDialog: [`选择替换掉${get.cnNumber(num)}张${get.translation(slot)}装备牌`, [cards, "vcard"]],
									forced: true,
									selectButton: [1, num],
								})
								.set("filterOk", () => {
									const evt = _status.event;
									return (
										ui.selected.buttons.reduce((num, button) => {
											if (evt.slot == "equip3_4") {
												return num + Math.max(get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), "equip3"), get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), "equip4"));
											}
											return num + get.numOf(getButtonSubtypes("link" in button ? button.link : undefined), evt.slot);
										}, 0) == evt.required
									);
								})
								.set("required", num)
								.set("slot", slot);
							result = normalizeSelectionResult(await chooseEvent.forResult());
						}
					}
				}
				if (typeof result !== "string" && isVCardLinks(result?.links)) {
					replacedCards.addArray(result.links);
				}
			}
		}
		event.result = {
			vcards: replacedCards,
			cards: player.getCards("e", i => {
				const cardSymbol = i.cardSymbol;
				return cardSymbol !== undefined && replacedCards.includes(i[cardSymbol]);
			}),
		};
	},
	//装备牌
	async equip(event, trigger, player) {
		event.visible = true;
		//先确定这次的cards是什么成分也防止有人在equipBegin之类的时机往里面塞垃圾
		if (event.cards.length > 1 && event.cards.some(cardx => cardx.isViewAsCard)) {
			//实体牌数大于1且里面有虚拟假牌，终止此事件
			event.untrigger();
			return;
		}
		//进行第一轮先行判断，让所有装备牌的原主失去装备牌
		const loseCards: Card[] = [];
		//判断card是不是假牌，如果是改为失去假牌
		if (event.card.isViewAsCard) {
			loseCards.add(event.card);
		} else {
			loseCards.addArray(event.cards);
		}
		if (loseCards.length) {
			type LoseMap = { [playerid: string]: [Card[], Card[], Card[]] };
			const map: LoseMap = {};
			for (const i of loseCards) {
				const owner = get.owner(i, "judge");
				if (owner && (owner != player || get.position(i) != "e")) {
					const id = owner.playerid;
					if (typeof id !== "string") {
						continue;
					}
					if (!map[id]) {
						map[id] = [[], [], []];
					}
					map[id][0].push(i);
					const position = get.position(i);
					if (position == "h") {
						map[id][1].push(i);
					} else {
						map[id][2].push(i);
					}
				} else if (!event.updatePile && get.position(i) == "c") {
					event.updatePile = true;
				}
				if (event.visible) {
					i.addKnower("everyone");
				}
			}
			event.losing_map = map;
			for (const i in map) {
				const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				const next = owner.lose({ cards: map[i][0], position: ui.special }).set("type", "equip").set("forceDie", true).set("getlx", false);
				if (event.visible == true) {
					next.visible = true;
				}
				await next;
				event.relatedLose = next;
			}
			for (const [key, value] of lib.commonArea) {
				const list = (_status[value.areaStatusName] || []).filter(card => loseCards.includes(card));
				if (event[value.fromName] || list.length) {
					const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards: list });
					next.setContent(value.removeHandeler);
					next.player = player;
					next.type = event.name;
					await next;
				}
			}
		}
		player.equiping = true;
		const handleEquip = async card => {
			const cards = event.cards;
			const cardInfo = get.info(card, false);
			if (player.isMin() || !player.canEquip(card)) {
				await game.cardsDiscard(cards);
				delete player.equiping;
				return;
			}
			let audioSubtype = get.subtype(card);
			if (audioSubtype == "equip6") {
				audioSubtype = "equip3";
			}
			game.broadcastAll(type => {
				if (lib.config.background_audio) {
					game.playAudio("effect", type);
				}
			}, audioSubtype);
			player.addVirtualEquip(card, cards);
			//player.$equip(card);
			//game.addVideo("equip", player, get.cardInfo(card));
			if (event.log != false) {
				const isViewAsCard = cards.length !== 1 || cards[0].name !== card.name;
				if (isViewAsCard && cards.length) {
					game.log(player, `装备了<span class="yellowtext">${get.translation(card)}</span>（`, cards, "）");
				} else {
					game.log(player, "装备了", card);
				}
			}
			if (cardInfo.onEquip && (!cardInfo.filterEquip || cardInfo.filterEquip(card, player))) {
				if (Array.isArray(cardInfo.onEquip)) {
					for (const onEquip of cardInfo.onEquip) {
						const next = game.createEvent(`equip_${card.name}`);
						next.setContent(onEquip);
						next.player = player;
						next.card = event.vcards[0];
						await next;
					}
				} else {
					const next = game.createEvent(`equip_${card.name}`);
					next.setContent(cardInfo.onEquip);
					next.player = player;
					next.card = event.vcards[0];
					await next;
				}
				if (cardInfo.equipDelay != false) {
					await game.delayx();
				}
			}
			delete player.equiping;
			if (event.delay) {
				await game.delayx();
			}
		};
		//检查实体牌会不会被销毁
		let stop = false;
		const list: Card[] = [];
		for (const cardx of event.cards) {
			if (cardx.willBeDestroyed("equip", player, event)) {
				cardx.selfDestroy(event);
				stop = true;
			} else if ("hejx".includes(get.position(cardx, true))) {
				stop = true;
			} else {
				list.add(cardx);
			}
		}
		if (stop) {
			if (list.length) {
				await game.cardsDiscard(list);
			}
			return;
		}

		event.vcards = [];
		const card = event.card;
		if (get.itemtype(card) === "card" && !card.isViewAsCard) {
			//cards = [card];
			event.card = card.cardSymbol ? card[card.cardSymbol] : get.autoViewAs(card, void 0, false);
			event.vcards.push(event.card);
		} else {
			if (get.itemtype(card) === "card" && card.isViewAsCard) {
				const cardSymbol = card.cardSymbol;
				const cardSymbolKey = cardSymbol === undefined ? "undefined" : cardSymbol;
				event.vcards.push(card[cardSymbolKey]);
			} else {
				event.vcards.push(card);
			}
		}
		//准备上装备时的处理
		const cardInfo = get.info(event.card, false);
		if (cardInfo.prepareEquip && (!cardInfo.filterEquip || cardInfo.filterEquip(event.card, player))) {
			const next = game.createEvent(`prepare_${event.card.name}`);
			next.setContent(cardInfo.prepareEquip);
			next.player = player;
			next.card = event.card;
			await next;
		}
		//同时播放所有装备牌的装备动画
		if (event.cards.length) {
			if (event.draw) {
				player.$draw(event.cards);
				await game.delay(0, 300);
			} else {
				game.broadcast(
					(cards, player) => {
						cards.forEach(card => {
							if (card.clone) {
								card.clone.moveDelete(player);
							}
						});
					},
					event.cards,
					player
				);
				event.cards.forEach(card => {
					if (card.clone) {
						card.clone.moveDelete(player);
						game.addVideo("gain2", player, get.cardsInfo([card.clone]));
					}
				});
			}
		}
		//将多张装备牌的牌替换事件合并为一个，废弃卡牌的replaceEquip自定义事件属性（反正没人用）
		const replaceEquipEvent = game.createEvent("replaceEquip");
		replaceEquipEvent.player = player;
		replaceEquipEvent.card = event.card;
		replaceEquipEvent.setContent("replaceEquip");
		const result = await replaceEquipEvent.forResult();
		if (typeof result !== "string" && Array.isArray(result.cards) && get.itemtype(result.cards) == "cards") {
			event.swapped = true;
			const loseEvent = player.lose({ cards: result.cards, visible: true }).set("type", "equip").set("getlx", false);
			loseEvent.swapEquip = true;
			if (get.info(event.card, false)?.loseThrow) {
				player.$throw(result.cards, 1000);
			}
			await loseEvent;
			for (const card of result.cards) {
				if (card.willBeDestroyed("discardPile", player, event)) {
					card.selfDestroy(event);
				}
			}
		}
		//就算是vcard也应该用lose处理
		/*result?.vcards?.forEach(card => {
			player.removeVirtualEquip(card);
		});*/
		//然后处理每一张装备牌的装备
		await handleEquip(event.card);
		//如果event.card是实体牌，改为虚拟牌
		if (event.card instanceof lib.element.Card) {
			const cardSymbol = event.card.cardSymbol;
			if (cardSymbol !== undefined) {
				const virtualCard = event.card[cardSymbol];
				if (virtualCard instanceof lib.element.VCard) {
					event.card = virtualCard;
				}
			}
		}
		if (event.updatePile) {
			game.updateRoundNumber();
		}
	},
	//装备栏 END
	async changeGroup(event, trigger, player) {
		event.originGroup = player.group;
		event.group ??= player.group;

		const group = event.group;
		game.addVideo("changeGroup", player, group);
		player.getHistory("custom").push(event);

		if (event.broadcast !== false) {
			game.broadcast(
				(player, group) => {
					player.group = group;
					player.node.name.dataset.nature = get.groupnature(group);
				},
				player,
				group
			);
		}

		player.group = group;
		player.node.name.dataset.nature = get.groupnature(group);

		if (event.log !== false) {
			game.log(player, "将势力变为了", `#y${get.translation(group + 2)}`);
		}
	},
	async chooseToDebate(event, trigger, player) {
		const { list } = event;

		let targets: Player[] = list.filter(target => target.hasCards("h"));

		let result: EventResult | Partial<Result>[];
		if (targets.length) {
			if (event.fixedResult) {
				targets = targets.removeArray(event.fixedResult.map(i => i[0]));
			}

			if (targets.length) {
				const next = player
					.chooseCardOL({
						list: targets,
						prompt: `${get.translation(player)}发起了议事，请选择展示的手牌`,
						forced: true,
						glow_result: false,
						ai: event.ai ?? (() => Math.random()),
					})
					.set("type", "debate")
					.set("source", player)
					.set(
						"aiCard",
						event.aiCard ??
							(target => {
								const getAi = get.event().ai || (() => Math.random());
								const hs = target.getCards("h").sort((a, b) => getAi(b) - getAi(a));
								return { bool: true, cards: [hs[0]] };
							})
					);

				const debateResult = await next.forResult();
				if (Array.isArray(debateResult) && debateResult.every(item => typeof item === "object" && item !== null && !Array.isArray(item))) {
					result = debateResult;
				} else {
					result = normalizeSelectionResult(debateResult);
				}
			} else {
				event.noselected = true;
				result = { bool: false };
			}
		} else {
			result = { bool: false };
		}

		const resultList: Partial<Result>[] = [];
		if (Array.isArray(result)) {
			resultList.push(...result);
		} else if (typeof result == "object" && result !== null) {
			resultList.push(result);
		}

		type DebatePair = [player: Player, card: Card | string];
		const red: DebatePair[] = [];
		const black: DebatePair[] = [];
		const others: DebatePair[] = [];

		const otherColors = new Map<string, DebatePair[]>();

		event.opinions = ["red", "black"];
		event.videoId = lib.status.videoId++;

		if (!event.noselected) {
			for (let i = 0; i < targets.length; i++) {
				const target = targets[i];
				const debateResult = resultList[i];
				if (!target || !debateResult || !Array.isArray(debateResult.cards) || !debateResult.cards.length) {
					continue;
				}
				const card = debateResult.cards[0];
				const color = get.color(card, target);
				if (color == "red") {
					red.push([target, card]);
				} else if (color == "black") {
					black.push([target, card]);
				} else {
					others.push([target, card]);
				}
			}
		}

		if (event.fixedResult) {
			for (const list of event.fixedResult) {
				const color = typeof list[1] == "string" ? list[1] : get.color(list[1], list[0]);
				if (color == "red") {
					red.push(list);
				} else if (color == "black") {
					black.push(list);
				} else {
					others.push(list);
				}
				targets.push(list[0]);
			}
		}

		if (event.debateIgnore !== false) {
			event.opinions.add("others");
		} else {
			const colors = new Map<string, DebatePair[]>();
			for (const list of others) {
				const cardColor = typeof list[1] == "string" ? list[1] : get.color(list[1], list[0]);
				const color = cardColor ?? "unknown";

				if (!colors.has(color)) {
					colors.set(color, [list]);
				} else {
					const colorPairs = colors.get(color);
					if (colorPairs) {
						colorPairs.push(list);
					}
				}
			}
			for (const [color, pairs] of colors) {
				event.opinions.add(color);
				otherColors.set(color, pairs);
			}
		}

		event.targets = targets;
		// 再次失算了
		const colors: Record<string, DebatePair[]> = {
			red,
			black,
			others,
		};
		for (const [color, list] of otherColors) {
			colors[color] = list;
		}
		Object.assign(event, colors);
		await event.trigger("debateShowOpinion");

		/**
		 * @param {string} color
		 * @returns {[player: Player, card: Card | string][]}
		 */
		const getPairs = color => {
			switch (color) {
				case "red":
					return red;
				case "black":
					return black;
				case "others":
					return others;
				default:
					return otherColors.get(color) ?? [];
			}
		};

		for (const color of event.opinions) {
			const pairs = getPairs(color);

			if (pairs.length) {
				game.log(
					[...new Set(pairs.map(pair => pair[0]))],
					color == "other" ? "没有意见" : `意见为<span class="firetext">${get.translation(color)}</span>`,
					pairs.length ? "，展示了" : "",
					pairs.map(pair => pair[1])
				);
				for (const [target, card] of pairs) {
					if (typeof card != "string") {
						await target.showCards(card).set("triggeronly", true);
					}
				}
			}
		}

		game.broadcastAll(showDebateResult, get.translation(player), event.videoId, event, colors);

		await game.delay(4);

		// @ts-check
		game.broadcastAll(lib.message.client.closeDialog, event.videoId);

		const opinions = event.opinions.filter(i => i != "others").toSorted((a, b) => getPairs(b).length - getPairs(a).length);

		const opinion = getPairs(opinions[0]).length > getPairs(opinions[1]).length ? opinions[0] : null;
		if (opinion) {
			game.log(player, "本次发起的议事结果为", opinion == "red" ? '<span class="firetext">红色</span>' : `#g${get.translation(opinion)}`);
		} else {
			game.log(player, "本次发起的议事无结果");
		}

		event.result = {
			bool: true,
			opinion,
			opinions: event.opinions,
			targets,
		};
		for (const color of event.opinions) {
			event.result[color] = getPairs(color);
		}

		if (event.callback) {
			const next = game.createEvent("debateCallback", false);
			next.player = player;
			next.debateResult = get.copy(event.result);
			next.setContent(event.callback);

			await next;
		}

		return;

		/**
		 * > 以前真的没出过问题吗
		 *
		 * @param {string} name
		 * @param {number} id
		 * @param {GameEvent} event
		 * @param {Record<string, [player: Player, card: Card | string][]>} colors
		 */
		function showDebateResult(name, id, event, colors) {
			const dialog = ui.create.dialog(`${name}发起了议事`, "hidden", "forcebutton");
			dialog.videoId = id;
			dialog.classList.add("scroll1");
			dialog.classList.add("scroll2");
			dialog.classList.add("fullwidth");

			if (event.opinions.includes("others")) {
				if (colors.other?.length > 2) {
					dialog.classList.add("fullheight");
				}
				for (const color of event.opinions) {
					if (color == "others" && !colors.other?.length) {
						continue;
					}
					dialog.addNewRow(
						{ item: get.translation(color), ratio: 1 },
						{
							item: colors[color].slice().map(list => {
								let element = get.copy(list[1]);
								if (typeof element == "string") {
									if (!lib.card[`debate_${element}`]) {
										lib.card[`debate_${element}`] = {};
										lib.translate[`debate_${element}`] = get.translation(element);
									}
									element = new lib.element.VCard(game.createCard(`debate_${element}`, " ", " "));
								}
								element._custom = button => {
									game.createButtonCardsetion(list[0].getName(true), button);
								};
								return element;
							}),
							ratio: 8,
							overflow: "scroll",
						}
					);
				}
			} else {
				dialog.buttonss = [];
				dialog.add('<div class="text center">意见</div>');
				const buttons = ui.create.div(".buttons", dialog.content);
				dialog.buttonss.push(buttons);
				buttons.classList.add("popup");
				buttons.classList.add("guanxing");
				for (const color of event.opinions) {
					for (const list of colors[color]) {
						let button;
						if (typeof list[1] == "string") {
							button = ui.create.button(["", "", list[1]], "vcard", dialog.buttonss[0]);
						} else {
							button = ui.create.button(list[1], "card", dialog.buttonss[0]);
						}
						game.createButtonCardsetion(list[0].getName(true), button);
					}
				}
			}

			dialog.open();
		}
	},
	async delay(event) {
		await game[event.name].apply(game, event._args);
	},
	async chooseCooperationFor(event, trigger, player) {
		const target = event.getTarget();

		const next = player.chooseButton({
			createDialog: [`选择和${get.translation(target)}的协力方式`, [event.cardlist, "vcard"]],
			forced: true,
		});
		next.set("ai", event.ai ?? (() => Math.random()));

		const result = await next.forResult();
		if (typeof result !== "string" && result.bool && Array.isArray(result.links) && result.links[0]) {
			player.cooperationWith(target, result.links[0][2].slice(12), event.reason);
		}
	},

	// 苏婆！
	async chooseToPlayBeatmap(event, trigger, player) {
		if (game.online) {
			return;
		}
		if (_status.connectMode) {
			event.time = lib.configOL.choose_timeout;
		}
		event.videoId = lib.status.videoId++;
		//给其他角色看的演奏框
		game.broadcastAll(
			(player, id, beatmap) => {
				if (_status.connectMode) {
					lib.configOL.choose_timeout = (Math.ceil((beatmap.timeleap[beatmap.timeleap.length - 1] + beatmap.speed * 100 + (beatmap.current || 0)) / 1000) + 5).toString();
				}
				if (player == game.me) {
					return;
				}
				let str = `${get.translation(player)}正在演奏《${beatmap.name}》...`;
				if (!_status.connectMode) {
					str += "<br>（点击屏幕可以跳过等待AI操作）";
				}
				ui.create.dialog(str).videoId = id;
				if (ui.backgroundMusic) {
					ui.backgroundMusic.pause();
				}
				if (lib.config.background_audio) {
					if (beatmap.filename.startsWith("ext:")) {
						game.playAudio(beatmap.filename);
					} else {
						game.playAudio("effect", beatmap.filename);
					}
				}
			},
			player,
			event.videoId,
			event.beatmap
		);

			const beatmap = event.beatmap;
			let result: Partial<Result>;
		if (event.isMine()) {
			// 摆了，有空再修
			const { promise, resolve } = Promise.withResolvers<Partial<Result>>();

			const timeleap = beatmap.timeleap.slice(0);
			let current = beatmap.current;
			//获取两个音符的时间间隔
			const getTimeout = () => {
				const time = timeleap.shift();
				const out = time - current;
				current = time;
				return out;
			};
			//初始化一堆变量
			let score = 0;
			const added = timeleap.length;
			const number_of_tracks = beatmap.number_of_tracks || 6;
			const custom_mapping = Array.isArray(beatmap.mapping);
			const mapping = custom_mapping ? beatmap.mapping.slice() : beatmap.mapping;
			let hitsound = beatmap.hitsound || "hitsound.wav";
			if (hitsound.startsWith("ext:")) {
				hitsound = `${lib.assetURL}extension/${hitsound.slice(4)}`;
			} else {
				hitsound = `${lib.assetURL}audio/effect/${hitsound}`;
			}
			const hitsound_audio = new Audio(hitsound);
			hitsound_audio.volume = 0.25;
			let abs = 1;
			let node_pos = 0;
			if (custom_mapping) {
				node_pos = mapping.shift();
			} else if (mapping == "random") {
				abs = get.rand(number_of_tracks);
				node_pos = abs;
			}
			let combo = 0;
			let max_combo = 0;
			const nodes: HTMLDivElement[] = [];
			const nodePositions = new WeakMap<HTMLDivElement, number>();
			const nodeTimeouts = new WeakMap<HTMLDivElement, ReturnType<typeof setTimeout>>();
			let roundmenu = false;
			//隐藏菜单按钮
			if (ui.roundmenu && ui.roundmenu.style.display != "none") {
				roundmenu = true;
				ui.roundmenu.style.display = "none";
			}
			if (ui.backgroundMusic) {
				ui.backgroundMusic.pause();
			}
			event.settleed = false;
			//建个框框
			const dialog = ui.create.dialog("forcebutton", "hidden");
			event.dialog = dialog;
			event.dialog.textPrompt = event.dialog.add(`<div class="text center">${beatmap.prompt || "在音符滑条和底部判定区重合时点击屏幕！"}</div>`);
			event.switchToAuto = () => {};
			event.dialog.classList.add("fixed");
			event.dialog.classList.add("scroll1");
			event.dialog.classList.add("scroll2");
			event.dialog.classList.add("fullwidth");
			event.dialog.classList.add("fullheight");
			event.dialog.classList.add("noupdate");
			event.dialog.style.overflow = "hidden";
			//结束后操作
			event.settle = () => {
				if (event.settleed) {
					return;
				}
				event.settleed = true;
				//评分
				const acc = Math.floor((score / (added * 5)) * 100);
				if (!Array.isArray(lib.config.choose_to_play_beatmap_accuracies)) {
					lib.config.choose_to_play_beatmap_accuracies = [];
				}
				lib.config.choose_to_play_beatmap_accuracies.push(acc);
				if (lib.config.choose_to_play_beatmap_accuracies.length > 5) {
					lib.config.choose_to_play_beatmap_accuracies.shift();
				}
				game.saveConfigValue("choose_to_play_beatmap_accuracies");
				let rank;
				if (acc == 100) {
					rank = ["SS", "metal"];
				} else if (acc >= 94) {
					rank = ["S", "orange"];
				} else if (acc >= 87) {
					rank = ["A", "wood"];
				} else if (acc >= 80) {
					rank = ["B", "water"];
				} else if (acc >= 65) {
					rank = ["C", "thunder"];
				} else {
					rank = ["D", "fire"];
				}
				event.dialog.textPrompt.innerHTML = `<div class="text center">演奏结束！<br>最大连击数：${max_combo}  精准度：${acc}%</div>`;
				game.getMe().$fullscreenpop(`<span style="font-family:xinwei">演奏评级：<span data-nature="${rank[1]}">${rank[0]}</span></span>`, null, null, false);
				//返回结果并继续游戏
				setTimeout(() => {
					event.dialog.close();
					_status.imchoosing = false;
					if (roundmenu) {
						ui.roundmenu.style.display = "";
					}
					if (ui.backgroundMusic && !isNaN(ui.backgroundMusic.duration)) {
						ui.backgroundMusic.play();
					}
					hitsound_audio.remove();
					resolve({
						bool: true,
						accuracy: acc,
						rank: rank,
					});
				}, 1000);
			};
			event.dialog.open();
			//操作容差
			const height = event.dialog.offsetHeight;
			const width = event.dialog.offsetWidth;
			const range1 = beatmap.range1 || [90, 110];
			const range2 = beatmap.range2 || [93, 107];
			const range3 = beatmap.range3 || [96, 104];
			const speed = beatmap.speed || 25;
			//初始化底部的条子
			const judger = ui.create.div("");
			judger.style["background-image"] = beatmap.judgebar_color || "linear-gradient(rgba(240, 235, 3, 1), rgba(230, 225, 5, 1))";
			judger.style["border-radius"] = "3px";
			judger.style.position = "absolute";
			judger.style.opacity = "0.3";
			const heightj = Math.ceil(height * (beatmap.judgebar_height || 0.1));
			judger.style.height = `${heightj}px`;
			judger.style.width = `${width}px`;
			judger.style.left = "0px";
			judger.style.top = `${height - heightj}px`;
			event.dialog.appendChild(judger);
			//生成每个音符
			const addNode = () => {
				const node = ui.create.div("");
				nodes.push(node);
				node.style["background-image"] = beatmap.node_color || "linear-gradient(rgba(120, 120, 240, 1), rgba(100, 100, 230, 1))";
				node.style["border-radius"] = "3px";
				node.style.position = "absolute";
				node.style.height = `${Math.ceil(height / 10)}px`;
				node.style.width = `${Math.ceil(width / number_of_tracks) - 10}px`;
				nodePositions.set(node, get.utc());
				event.dialog.appendChild(node);

				node.style.left = `${Math.ceil((width * node_pos) / number_of_tracks + 5)}px`;
				node.style.top = `-${Math.ceil(height / 10)}px`;
				ui.refresh(node);
				node.style.transition = `all ${speed * 110}ms linear`;
				node.style.transform = `translateY(${Math.ceil(height * 1.1)}px)`;
				const timeout = setTimeout(() => {
					if (nodes.includes(node)) {
						nodes.remove(node);
						player.popup("Miss", "fire", false);
						if (player.damagepopups.length) {
							player.$damagepop();
						}
						combo = 0;
					}
				}, speed * 110);
				nodeTimeouts.set(node, timeout);

				if (custom_mapping) {
					node_pos = mapping.shift();
				} else if (mapping == "random") {
					while (node_pos == abs) {
						node_pos = get.rand(number_of_tracks);
					}
					abs = node_pos;
				} else {
					node_pos += abs;
					if (node_pos > number_of_tracks - 1) {
						abs = -1;
						node_pos = number_of_tracks - 2;
					} else if (node_pos < 0) {
						abs = 1;
						node_pos = 1;
					}
				}
				if (timeleap.length) {
					setTimeout(() => {
						addNode();
					}, getTimeout());
				} else {
					setTimeout(
						() => {
							event.settle();
						},
						speed * 110 + 100
					);
				}
			};
			//点击时的判断操作
			const click = () => {
				if (!nodes.length) {
					return;
				}
				for (const node of nodes) {
					//用生成到点击的时间差来判断距离
					const time = get.utc();
					const position = nodePositions.get(node);
					if (position === undefined) {
						continue;
					}
					const top = (time - position) / speed;
					if (top > range1[1]) {
						continue;
					} else if (top < range1[0]) {
						return;
					}
					nodes.remove(node);
					const timeout = nodeTimeouts.get(node);
					if (timeout !== undefined) {
						clearTimeout(timeout);
					}
					node.style.transform = "";
					node.style.transition = "all 0s";
					node.style.top = `${height * ((top - 10) / 100)}px`;
					ui.refresh(node);
					node.style.transition = "all 0.5s";
					node.style.transform = "scale(1.2)";
					node.delete();
					if (top >= range3[0] && top < range3[1]) {
						score += 5;
						player.popup("Perfect", "orange", false);
					} else if (top >= range2[0] && top < range2[1]) {
						score += 3;
						player.popup("Great", "wood", false);
					} else {
						score += 1;
						player.popup("Good", "soil", false);
					}
					if (player.damagepopups.length) {
						player.$damagepop();
					}
					combo++;
					max_combo = Math.max(combo, max_combo);
					hitsound_audio.currentTime = 0;
					if (hitsound_audio.paused) {
						Promise.resolve(hitsound_audio.play()).catch(() => void 0);
					}
					break;
				}
			};
			document.addEventListener(lib.config.touchscreen ? "touchstart" : "mousedown", click);

			game.countChoose();
			setTimeout(
				() => {
					if (!lib.config.background_audio) {
						return;
					}
					if (beatmap.filename.startsWith("ext:")) {
						game.playAudio(beatmap.filename);
					} else {
						game.playAudio("effect", beatmap.filename);
					}
				},
				Math.floor(speed * 100 * (0.9 + beatmap.judgebar_height)) + beatmap.current
			);
			setTimeout(() => {
				addNode();
			}, getTimeout());

			result = await promise;
		} else if (event.isOnline()) {
			const remoteResult = await event.sendAsync();
			type BeatmapResult = {
				bool: boolean;
				accuracy: number;
				rank: [string, string];
			};
			const isRecord = (value: unknown): value is Record<string, unknown> => typeof value == "object" && value !== null && !Array.isArray(value);
			if (isRecord(remoteResult)) {
				const bool = remoteResult.bool;
				const accuracy = remoteResult.accuracy;
				const rank = remoteResult.rank;
				if (
					typeof bool == "boolean" &&
					typeof accuracy == "number" &&
					Number.isFinite(accuracy) &&
					Array.isArray(rank) &&
					rank.length == 2 &&
					typeof rank[0] == "string" &&
						typeof rank[1] == "string"
				) {
					const normalizedResult: BeatmapResult = {
						bool,
						accuracy,
						rank: [rank[0], rank[1]],
					};
					result = normalizedResult;
				} else {
					result = {};
				}
			} else {
				result = {};
			}
		} else {
			game.countChoose();

			const songDuration = beatmap.timeleap[beatmap.timeleap.length - 1] + beatmap.speed * 100 + 1000 + (beatmap.current || 0);
			const control = new AbortController();
			const songPlaybackDelay = delayExt(songDuration, { signal: control.signal, rejectOnAbort: false });

			const delays = [songPlaybackDelay];
			if (!_status.connectMode) {
				const skip = () => {
					Array.from(ui.window.getElementsByTagName("audio")).forEach(audio => {
						if (audio.currentSrc.includes(beatmap.filename.startsWith("ext:") ? beatmap.name : beatmap.filename)) {
							audio.remove();
						}
					});
					control.abort();
				};

				document.addEventListener(lib.config.touchscreen ? "touchend" : "click", skip);
				const skipDelay = delayExt(songDuration, { signal: control.signal, rejectOnAbort: false }).then(() => {
					document.removeEventListener(lib.config.touchscreen ? "touchend" : "click", skip);
				});
				delays.push(skipDelay);
			}

			await Promise.all(delays);

			_status.imchoosing = false;
			//Algorithm: Generate the random number range using the mean and the half standard deviation of accuracies of the player's last 5 plays
			//算法：用玩家的上5次游玩的准确率的平均数和半标准差生成随机数范围
			const chooseToPlayBeatmapAccuracies = (lib.config.choose_to_play_beatmap_accuracies || []).concat(
				Array.from(
					{
						length: 6 - (lib.config.choose_to_play_beatmap_accuracies || []).length,
					},
					() => get.rand(70, 100)
				)
			);
			const mean = Math.round(chooseToPlayBeatmapAccuracies.reduce((previousValue, currentValue) => previousValue + currentValue) / chooseToPlayBeatmapAccuracies.length);
			const half_standard_deviation = Math.round(Math.sqrt(chooseToPlayBeatmapAccuracies.reduce((previousValue, currentValue) => previousValue + Math.pow(currentValue - mean, 2), 0)) / 2);
			const acc = Math.min(Math.max(get.rand.apply(get, beatmap.aiAcc || [mean - half_standard_deviation - get.rand(0, half_standard_deviation), mean + half_standard_deviation + get.rand(0, half_standard_deviation)]), 0), 100);
			let rank;
			if (acc == 100) {
				rank = ["SS", "metal"];
			} else if (acc >= 94) {
				rank = ["S", "orange"];
			} else if (acc >= 87) {
				rank = ["A", "green"];
			} else if (acc >= 80) {
				rank = ["B", "water"];
			} else if (acc >= 65) {
				rank = ["C", "thunder"];
			} else {
				rank = ["D", "fire"];
			}
			if (event.dialog) {
				event.dialog.close();
			}
			if (event.control) {
				event.control.close();
			}

			result = {
				bool: true,
				accuracy: acc,
				rank: rank,
			};
		}

		game.broadcastAll(
			(id, time) => {
				if (_status.connectMode) {
					lib.configOL.choose_timeout = time;
				}
				const dialog = get.idDialog(id);
				if (dialog) {
					dialog.close();
				}
				if (ui.backgroundMusic && !isNaN(ui.backgroundMusic.duration)) {
					ui.backgroundMusic.play();
				}
			},
			event.videoId,
			event.time
		);

		event.result = result;

		return;

		/**
		 * 暂停x毫秒
		 *
		 * @param { number } ms - 毫秒数
		 * @returns { Promise<void> }
		 */
		function delayExt(ms: number, option: { signal?: AbortSignal; rejectOnAbort?: boolean } = {}) {
			const { signal, rejectOnAbort = true } = option;
			if (signal?.aborted) {
				return rejectOnAbort ? Promise.reject(signal.reason) : Promise.resolve();
			}

			return new Promise<void>((resolve, reject) => {
				const abort = () => {
					clearTimeout(timeout);
					if (rejectOnAbort) {
						reject(signal?.reason);
					} else {
						resolve();
					}
				};
				const done = () => {
					signal?.removeEventListener("abort", abort);
					clearTimeout(timeout);
					resolve();
				};
				const timeout = setTimeout(done, ms);
				signal?.addEventListener("abort", abort, { once: true });
			});
		}
	},

	async chooseToMove(event, trigger, player) {
		if (event.chooseTime && _status.connectMode && !game.online) {
			event.time = lib.configOL.choose_timeout;
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.chooseTime);
		}

		let result;
		if (event.isMine()) {
			result = await new Promise(resolve => {
				// 兼容旧版本扩展使用guanxing_button喵
				ui.selected.guanxing_button = null;
				// 使用guanxing_buttons作为数组喵，因为buttons会被uncheck清除但是选中状态不会喵，导致不同步哦
				ui.selected.guanxing_buttons = [];

				const list = event.list;
				const filterMove = event.filterMove;
				const filterOk = event.filterOk;
				// 如果只有一行那么多选一般来说就没什么意义喵
				const canMultiselect = list.length > 1 && lib.config.choose_all_button && event.allowChooseAll;

				//_status.imchoosing = true;
				event.settleed = false;

				event.dialog = ui.create.dialog(event.prompt || "请选择要操作的牌", "hidden", "forcebutton");

				event.switchToAuto = () => {
					if (!filterOk(event.moved)) {
						if (!event.forced) {
							event._result = { bool: false };
						} else {
							event._result = "ai";
						}
					} else {
						event._result = {
							bool: true,
							moved: event.moved,
						};
					}
					event.dialog.close();
					if (ui.confirm) {
						ui.confirm.close();
					}
					game.resume();
					_status.imchoosing = false;
					setTimeout(() => {
						ui.arena.classList.remove("choose-to-move");
					}, 500);
					resolve(event._result);
				};
				event.dialog.classList.add("scroll1");
				event.dialog.classList.add("scroll2");
				event.dialog.classList.add("fullwidth");
				if (list.length > 2) {
					ui.arena.classList.add("choose-to-move");
					event.dialog.classList.add("fullheight");
				}

				/**
				 * 保存每次移动后的对应实体牌的位置
				 */
				const moved: Card[][] = [];
				event.moved = moved;
				/**
				 * 所有可移动的buttons数组
				 */
				type GuanxingButton = HTMLDivElement & { copy?: HTMLDivElement };
				type GuanxingContainer = HTMLDivElement & {
					_link: number;
					textPrompt?: (cards: Card[]) => string;
				};
				const buttonss: GuanxingContainer[] = [];
				event.buttonss = buttonss;
				/**
				 * 是否处于拖拽动画中(禁止其他的选择，拖拽)
				 */
				event.isPlayingAnimation = false;

				// 动画时长
				const animationDuration = lib.config.animation_choose_to_move ? 300 : 0;

				// 初始化触摸点位置和元素偏移量
				let touchStartX = 0;
				let touchStartY = 0;
				let elementOffsetX = 0;
				let elementOffsetY = 0;
				let currentElement: GuanxingButton | undefined;
				/**
				 * 每次移动后更新数据
				 */
				const updateButtons = () => {
					for (const i of buttonss) {
						// 更新每次移动后的对应实体牌的位置
						event.moved[i._link] = get.links(Array.from(i.children));
						// 更新这个buttons的提示文本
						if (typeof i.textPrompt == "function") {
							const previousSibling = i.previousSibling;
							if (previousSibling instanceof HTMLElement) {
								previousSibling.innerHTML = `<div class="text center">${i.textPrompt(event.moved[i._link])}</div>`;
							}
						}
					}
					if (filterOk(event.moved)) {
						ui.create.confirm("o");
					} else {
						if (!event.forced) {
							ui.create.confirm("c");
						} else if (ui.confirm) {
							ui.confirm.close();
						}
					}
				};

				/**
				 * 计算可以批量移动的按钮
				 *
				 * @param {Button[]} buttonList
				 * @param {HTMLDivElement} buttonsDiv
				 * @param {"first"|"last"} position
				 */
				const filterBatchMove = (buttonList: Button[], buttonsDiv: GuanxingContainer, position: "first" | "last"): Button[] => {
					const parent = buttonList[0]?.parentElement;

					if (!parent) {
						return [];
					}

					const original: Element[] = Array.from(parent.children);
					const filtered: Button[] = [];
					const movedButtons = new Set<Element>();
					const eventMoved = Object.assign({}, event.moved);
					const addChildren = position === "first" ? b => buttonsDiv.insertBefore(b, buttonsDiv.firstChild) : b => buttonsDiv.appendChild(b);
					const addMovedList = position === "first" ? l => event.moved[buttonsDiv._link].unshift(l) : l => event.moved[buttonsDiv._link].push(l);

					for (const button of buttonList) {
						if (button.parentElement !== parent) {
							continue;
						}

						if (!filterMove(button, buttonsDiv._link, event.moved)) {
							continue;
						}

						filtered.push(button);
						movedButtons.add(button);
						addChildren(button);
						addMovedList(button.link);
					}

					let previous: Element | null = null;

					for (const button of original) {
						if (!movedButtons.has(button)) {
							previous = button;
							continue;
						}

						if (!previous) {
							parent.insertBefore(button, parent.firstChild);
						} else {
							parent.insertBefore(button, previous.nextSibling);
						}

						previous = button;
					}

					Object.assign(event.moved, eventMoved);
					return filtered;
				};

				const updateSelectAllButtons = () => {
					const buttons = Array.from(event.dialog.querySelectorAll(".select-all")).filter((button): button is HTMLElement => button instanceof HTMLElement);

					for (const button of buttons) {
						const nextElementSibling = button.nextElementSibling;
						const hasSelected = nextElementSibling instanceof HTMLElement && nextElementSibling.querySelector(".glow2");
						button.innerHTML = hasSelected ? "反选" : "全选";
					}
				};

				/**
				 * 移除所有符合条件的选中按钮
				 *
				 * @param { ((button: HTMLDivElement) => boolean)? } filter
				 */
				const clearSelected = (filter?: (button: HTMLDivElement) => boolean) => {
					for (let i = ui.selected.guanxing_buttons.length; i--; ) {
						const button = ui.selected.guanxing_buttons[i];

						if (!filter || filter(button)) {
							ui.selected.guanxing_buttons.splice(i, 1);
							button.classList.remove("glow2");
						}
					}

					ui.selected.guanxing_button = ui.selected.guanxing_buttons[0] || null;
					updateSelectAllButtons();
				};

				/**
				 * 选中所有传入的按钮
				 * 只能多选相同容器的按钮
				 *
				 * @param { HTMLDivElement[] } button
				 */
				const selectButtons = (...buttons) => {
					if (!buttons.length) {
						return;
					}

					const container = buttons[0].parentElement;
					clearSelected(button => button.parentElement !== container);
					buttons = buttons.filter(button => button.parentElement === container);

					buttons.forEach(button => {
						button.classList.add("glow2");
					});

					ui.selected.guanxing_buttons.addArray(buttons);
					ui.selected.guanxing_button = ui.selected.guanxing_buttons[0] || null;
					updateSelectAllButtons();
				};

				/**
				 * 切换按钮的选中状态
				 *
				 * @param {HTMLElement} button
				 * @returns {boolean}
				 */
				const toggleButton = button => {
					const nextState = !button.classList.contains("glow2");

					if (!nextState) {
						button.classList.remove("glow2");
						ui.selected.guanxing_buttons.remove(button);
						ui.selected.guanxing_button = ui.selected.guanxing_buttons[0] || null;
						updateSelectAllButtons();
					} else {
						if (!canMultiselect) {
							clearSelected(); // 对于不能多选就要清空之前的选择喵
						}
						selectButtons(button); // 这里要使用selectButtons排除其他容器的按钮喵
					}

					return nextState;
				};

				/**
				 * 反转容器中所有按钮的选择状态
				 *
				 * @param { HTMLDivElement } container
				 */
				const revertSelection = container => {
					const selecteds = new Set(ui.selected.guanxing_buttons.filter(button => button.parentElement === container));
					const nextSelecteds = Array.from(container.children).filter((button): button is GuanxingButton => button instanceof HTMLDivElement && !selecteds.has(button));

					clearSelected();
					selectButtons(...nextSelecteds);
				};

				/**
				 * 确认是否是拖拽开始
				 *
				 * 按下时，是不能判断出是否拖拽开始的，得在move事件才可以
				 *
				 * @param { TouchEvent | MouseEvent } e
				 */
				const dragStart = e => {
					if (event.isPlayingAnimation) {
						return;
					}
					const container = e.currentTarget;
					if (!(container instanceof HTMLElement)) {
						return;
					}
					// 左键按下
					if (e instanceof MouseEvent) {
						if (e.which != 1) {
							return;
						}
					}
					// 单个手指按下
					if (window.TouchEvent && e instanceof TouchEvent) {
						if (e.touches.length != 1) {
							return;
						}

						e = e.touches[0];
					}
					// 判断按下的元素是否是card
					const cards = Array.from(container.children).filter((element): element is GuanxingButton => element instanceof HTMLDivElement);
					const target = cards.find(card =>
						// Node.contains()
						e.target instanceof Node && card.contains(e.target)
					);
					if (target) {
						if (!target.copy) {
							const copy = target.cloneNode(true);
							if (!(copy instanceof HTMLDivElement)) {
								return;
							}
							copy.style.opacity = "0.75";
							copy.style.pointerEvents = "none";
							target.copy = copy;
						}
						touchStartX = e.clientX / game.documentZoom;
						touchStartY = e.clientY / game.documentZoom;
						elementOffsetX = target.getBoundingClientRect().x / game.documentZoom - touchStartX;
						elementOffsetY = target.getBoundingClientRect().y / game.documentZoom - touchStartY;
						currentElement = target;
						// e.stopPropagation();
					}
				};

				/**
				 * 判断出是否拖拽开始
				 *
				 * move事件是在button元素上监听的，而不是在dialog.content上。
				 *
				 * @param { TouchEvent | MouseEvent } e
				 */
				const onDrag = e => {
					if (event.isPlayingAnimation) {
						return;
					}
					if (e instanceof MouseEvent) {
						if (e.which != 1) {
							return;
						}
					}
					if (window.TouchEvent && e instanceof TouchEvent) {
						if (e.touches.length != 1) {
							return;
						}

						e = e.touches[0];
					}
					if (!currentElement || !currentElement.copy) {
						return;
					}

					// 获取点击位置
					const ex = e.clientX / game.documentZoom;
					const ey = e.clientY / game.documentZoom;

					// 如果是首次移动距离
					if (!document.contains(currentElement.copy)) {
						// 检查过小的移动距离，防止误触
						if (Math.abs(ex - touchStartX) < 10 && Math.abs(ey - touchStartY) < 10) {
							// 我们取消本次移动
							return;
						}
					}

					// 选中单个按钮
					clearSelected();
					selectButtons(currentElement);
					// 显示拖拽的元素
					const copy: HTMLDivElement = currentElement.copy;
					if (!ui.window.contains(copy)) {
						copy.style.position = "absolute";
						copy.style.transition = "none";
						copy.style.zIndex = "100";
						copy.css({
							boxShadow: "0px 0px 7px 2px rgba(233, 30, 77, 0.95)",
						});
						ui.window.appendChild(copy);
					}

					copy.style.left = `${ex + elementOffsetX}px`;
					copy.style.top = `${ey + elementOffsetY}px`;

					// 当拖动到对话框最上面或者最下面我们滚动内容
					const bounds = event.dialog.getBoundingClientRect();
					const relY = e.clientY - bounds.top;
					const minY = bounds.height * 0.1;
					const maxY = bounds.height * 0.9;

					if (relY < minY) {
						// 让event.dialog.content向上滚动
						event.dialog.content.parentElement.scrollTop -= 15;
					} else if (relY > maxY) {
						// 让event.dialog.content向下滚动
						event.dialog.content.parentElement.scrollTop += 15;
					}
				};

				const dragEnd = e => {
					if (event.isPlayingAnimation) {
						return;
					}
					if (e instanceof MouseEvent) {
						if (e.which != 1) {
							return;
						}
					}
					if (window.TouchEvent && e instanceof TouchEvent) {
						if (e.changedTouches.length != 1) {
							return;
						}

						e = e.changedTouches[0];
					}

					const isDragging = ui.selected.guanxing_buttons.length === 1 && document.contains(ui.selected.guanxing_buttons[0]?.copy);

					buttonss.forEach(btn => {
						Array.from(btn.children).filter((element): element is GuanxingButton => element instanceof HTMLDivElement).forEach(element => {
							if (element.copy && ui.window.contains(element.copy)) {
								ui.window.removeChild(element.copy);
							}
						});
					});

					// 如果点击的是全选按钮我们不处理喵
					if (e.target.classList.contains("select-all")) {
						return;
					}

					// 获取鼠标位置喵
					const clientX = e.clientX / game.documentZoom;
					const clientY = e.clientY / game.documentZoom;
					let aniamtionPromise: Promise<void> | undefined;

					let spannedSingle = false;

					// 我们要判断是不是跨区的单个交换喵，但是如果是拖拽的情况下一定是单个交换喵，所以没必要进行额外判断喵
					if (!isDragging && ui.selected.guanxing_buttons.length === 1) {
						const curCard = ui.selected.guanxing_buttons[0];
						const target = e.target;
						if (!curCard.contains(target)) {
							const buttons = buttonss.find(b => b.contains(target));
							if (buttons && !buttons.contains(curCard)) {
								// 此时用户点击了第一张牌，并在另一个区域点击了第二张牌喵
								spannedSingle = true;
							}
						}
					}

					// 如果是拖动移动、非多选或者跨区单个交换的情况下，我们走原来的代码喵
					if (isDragging || (!canMultiselect && ui.selected.guanxing_buttons.length === 1) || spannedSingle) {
						const curCard = ui.selected.guanxing_buttons[0];
						// 鼠标当前处于哪个元素上
						const target = document.elementFromPoint(clientX * game.documentZoom, clientY * game.documentZoom);
						// 相当于没移动，让它自己触发后续的click
						if (curCard.contains(target)) {
							return;
						}
						// 停止拖拽的目标处于哪个buttons区域中
						const buttons = buttonss.find(b =>
							// Node.contains()
							b.contains(target)
						);
						// 不能拖拽到区域外
						if (!buttons) {
							return;
						}
						const children = Array.from(buttons.children).filter((element): element is GuanxingButton => element instanceof HTMLDivElement);
						// 与card交换位置
						const card = children.find(element => element.contains(target));
						// 判断是否可以移动
						if (!card) {
							if (!filterMove(curCard, buttons._link, event.moved)) {
								return;
							}
						} else {
							if (!filterMove(card, curCard, event.moved)) {
								return;
							}
						}

						// 用flip动画移动过去喵
						if (!card) {
							// 如果拖动在按钮区域而不是按钮
							// 那么我们计算应该拖动到最前面还是最后面喵
							let position: "first" | "last" | Node | undefined;

							if (buttons.children.length) {
								const firstChild = buttons.firstElementChild;
								if (firstChild && clientX < firstChild.getBoundingClientRect().left / game.documentZoom) {
									position = "first";
								}
							} else {
								position = "last";
							}

							// 执行动画喵
							aniamtionPromise = game.$elementGoto(curCard, buttons, position, animationDuration);
						} else {
							// 如果拖动到按钮上面，我们交换两个按钮喵
							const buttons2 = curCard.parentElement;
							const pos1 = card.nextElementSibling || "last";
							const pos2 = curCard.nextElementSibling || "last";

							// 执行动画喵
							aniamtionPromise = game.$elementSwap(curCard, card, animationDuration);
						}

						clearSelected();
					} else if (ui.selected.guanxing_buttons.length) {
						// 获取当前点击的节点喵
						const target = e.target;
						// 寻找点击的是那个区域哦喵
						const buttons = buttonss.find(b => b.contains(target));

						if (!buttons || buttons !== target) {
							// 如果点击的是按钮或者区域外喵
							return; // 不产生任何效果喵，点击选中由其他位置实现喵，此处仅负责移动哦
						}

						// 判断一下要移动到哪里去哦喵
						let position: "first" | "last" | Node | undefined;

						if (buttons.children.length) {
							const firstChild = buttons.firstElementChild;

							if (firstChild && clientX < firstChild.getBoundingClientRect().left / game.documentZoom) {
								position = firstChild; // 此处不可以使用"first"喵，会导致倒序哦喵
							}
						} else {
							position = "last";
						}

						const selected = filterBatchMove(ui.selected.guanxing_buttons, buttons, position !== "last" ? "first" : "last");
						const subPromises: Promise<void>[] = [];

						for (const element of selected) {
							subPromises.push(game.$elementGoto(element, buttons, position, animationDuration));
						}

						aniamtionPromise = Promise.all(subPromises).then(() => undefined);
						clearSelected();
					}

					if (aniamtionPromise) {
						event.isPlayingAnimation = true;

						aniamtionPromise.then(() => {
							event.isPlayingAnimation = false;
							updateButtons();
						});
					}

					currentElement = undefined;
				};

				// 根据数据创建区域
				for (const [i, item] of list.entries()) {
					const tex = event.dialog.add(`<div class="text center">${item[0]}</div>`);
					tex.classList.add("choosetomove");
					if (canMultiselect) {
						const selectAll = ui.create.div(".select-all.popup.pointerdiv", event.dialog.content);
						selectAll.innerHTML = "全选";
						selectAll.listen(e => {
							if (!(e.target instanceof Element) || !(e.target.nextElementSibling instanceof HTMLDivElement)) {
								return;
							}
							revertSelection(e.target.nextElementSibling);
						});
					}
					const buttons: GuanxingContainer = Object.assign(ui.create.div(".buttons.popup.guanxing", event.dialog.content), { _link: i });
					buttons.addEventListener(lib.config.touchscreen ? "touchstart" : "mousedown", dragStart, true);
					event.dialog.addEventListener(lib.config.touchscreen ? "touchmove" : "mousemove", onDrag, true);
					event.dialog.addEventListener(lib.config.touchscreen ? "touchend" : "mouseup", dragEnd, true);
					buttonss.push(buttons);
					if (item[1]) {
						if (get.itemtype(item[1]) == "cards") {
							const cardsb = ui.create.buttons(item[1], "card", buttons);
							if (item[2] && typeof item[2] == "string") {
								for (const ij of cardsb) {
									if (typeof ij === "object" && ij !== null && "node" in ij && typeof ij.node === "object" && ij.node !== null && "gaintag" in ij.node && ij.node.gaintag instanceof HTMLElement) {
										ij.node.gaintag.innerHTML = get.translation(item[2]);
									}
								}
							}
						} else if (item[1].length == 2) {
							ui.create.buttons(item[1][0], item[1][1], buttons);
						}
					}
					if (item[2] && typeof item[2] == "function") {
						buttons.textPrompt = item[2];
					}
				}
				const tex = event.dialog.add('<div class="text center">点击或拖动两张牌以交换位置；点击一张牌并点击其他区域或拖动到其他区域以移动卡牌</div>');
				tex.classList.add("choosetomove");

				event.dialog.open();
				updateButtons();

				event.custom.replace.button = (button: HTMLDivElement) => {
					if (event.isPlayingAnimation) {
						return;
					}
					const node = button.parentNode;
					if (!(node instanceof HTMLDivElement) || !buttonss.includes(node)) {
						return;
					}
					toggleButton(button);
				};
				event.custom.replace.confirm = (bool: boolean) => {
					if (event.isPlayingAnimation) {
						return;
					}
					buttonss.forEach(btn => {
						for (const element of Array.from(btn.children).filter((child): child is GuanxingButton => child instanceof HTMLDivElement)) {
							if (element.copy && ui.window.contains(element.copy)) {
								ui.window.removeChild(element.copy);
								delete element.copy;
							}
						}
					});
					if (bool) {
						event._result = {
							bool: true,
							moved: event.moved,
						};
					} else {
						event._result = { bool: false };
					}
					event.dialog.close();
					if (ui.confirm) {
						ui.confirm.close();
					}
					game.resume();
					_status.imchoosing = false;
					setTimeout(() => {
						ui.arena.classList.remove("choose-to-move");
					}, 500);
					resolve(event._result);
				};

				game.pause();
				game.countChoose();
				event.choosing = true;
			});

			delete ui.selected.guanxing_button;
			delete ui.selected.guanxing_buttons;
		} else if (event.isOnline()) {
			result = normalizeSelectionResult(await event.sendAsync());
		} else {
			result = "ai";
		}

		if (event.time) {
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.time);
		}

		if ((!result || result == "ai" || (event.forced && !result.bool)) && event.processAI) {
			const moved = event.processAI(event.list);
			if (moved) {
				result = {
					bool: true,
					moved,
				};
			} else {
				result = { bool: false };
			}
		}

		event.result = result;
	},
	async showCharacter(event, trigger, player) {
		await event.trigger("showCharacterBegin");
		await event.trigger("showCharacterEnd");
		await event.trigger("showCharacterAfter");
		if (get.mode() == "identity" && player.isZhu) {
			await event.trigger("zhuUpdate");
		}
	},
	async removeCharacter(event, trigger, player) {
		player.$removeCharacter(event.num);
	},
	chooseUseTarget: [
		async (event, trigger, player) => {
			// 摆了
			let { card } = event;
			const { cards } = event;
			const targets = event.getTargets();

			if (get.is.object(card) && event.viewAs === false) {
				card.isCard = true;
			}
			if (cards && get.itemtype(card) != "card") {
				card = get.copy(card);
				card.cards = cards.slice(0);
				event.card = card;
			}
			let evt = event.getParent("chooseToUse", true);
			if (get.itemtype(evt) !== "event") {
				evt = event;
			}
			if (!lib.filter.cardEnabled(card, player) || (event.addCount !== false && !lib.filter.cardUsable(card, player, evt))) {
				event.result = { bool: false };
				event.finish();
				return;
			}

			const info = get.info(card);
			let range;
			if (!info.notarget) {
				const select = get.copy(info.selectTarget);
				range = get.select(select);
				if (event.selectTarget) {
					range = get.select(event.selectTarget);
					if (typeof range == "number") {
						range = [range, range];
					}
				}
				game.checkMod(card, player, range, "selectTarget", player);
			}

			if (info.notarget || range[1] <= -1) {
				if (!info.notarget && range[1] <= -1) {
					for (let i = 0; i < targets.length; i++) {
						if (event.filterTarget) {
							if (!event.filterTarget(card, player, targets[i])) {
								targets.splice(i--, 1);
							}
						} else if (!player.canUse(card, targets[i], event.nodistance ? false : undefined, event.addCount === false ? undefined : true)) {
							targets.splice(i--, 1);
						}
					}
					if (targets.length) {
						event.targets2 = targets;
					} else {
						event.finish();
						return;
					}
				} else {
					event.targets2 = [];
				}
				if (event.forced) {
					return { bool: true };
				} else {
					const next = player.chooseBool();
					next.set("prompt", event.prompt || `是否${event.targets2.length ? "对" : ""}${get.translation(event.targets2)}使用${get.translation(card)}?`);
					if (event.hsskill) {
						next.setHiddenSkill(event.hsskill);
					}
					if (event.prompt2) {
						next.set("prompt2", event.prompt2);
					}
					next.set(
						"choice",
						(() => {
							let eff = 0;
							for (const target of event.targets2) {
								eff += get.effect(target, card, player, player);
							}
							return eff > 0;
						})()
					);
					if (typeof event.ai == "function") {
						next.set("ai", event.ai);
					}

					return next.forResult();
				}
			} else {
				if (event.filterTarget) {
					const targets = game.filterPlayer2(current => event.filterTarget(card, player, current), undefined, true);
					if (targets.length < range[0]) {
						return { bool: false };
					} else if (!info.complexTarget && targets.length == range[0] && range[0] == range[1] && event.forced) {
						event.targets2 = targets;
						return { bool: true };
					}
				}

				const next = player.chooseTarget();
				next.set("_get_card", card);
				next.set(
					"filterTarget",
					event.filterTarget ||
						((card, player, target) => {
						if (!_status.event.getTargets().includes(target)) {
								return false;
							}
							if (!_status.event.nodistance && !lib.filter.targetInRange(card, player, target)) {
								return false;
							}
							return lib.filter.targetEnabledx(card, player, target);
						})
				);
				next.set("ai", event.ai || get.effect_use);
				next.set("selectTarget", event.selectTarget || lib.filter.selectTarget);
				if (event.nodistance) {
					next.set("nodistance", true);
				}
				if (event.forced) {
					next.set("forced", true);
				}
				if (event.addCount !== false) {
					next.set("addCount_extra", true);
				}
				next.set("targets", targets);
				next.set("prompt", event.prompt || `选择${get.translation(card)}的目标`);
				if (event.prompt2) {
					next.set("prompt2", event.prompt2);
				}
				if (event.hsskill) {
					next.setHiddenSkill(event.hsskill);
				}

				return next.forResult();
			}
		},
		async (event, trigger, player, result) => {
			const { card, cards } = event;

			if (result.bool) {
				event.result = {
					bool: true,
					targets: event.targets2 || result.targets,
				};
				const args = [card, event.targets2 || result.targets];
				if (cards) {
					args.push(cards.slice());
				}
				const next = player.useCard(...args);
				next.oncard = event.oncard;
				if (cards) {
					next.cards = cards.slice(0);
				}
				if (event.nopopup) {
					next.nopopup = true;
				}
				if (event.animate === false) {
					next.animate = false;
				}
				if (event.throw === false) {
					next.throw = false;
				}
				if (event.addCount === false) {
					next.addCount = false;
				}
				if (event.noTargetDelay) {
					next.targetDelay = false;
				}
				if (event.nodelayx) {
					next.delayx = false;
				}
				if (event.logSkill) {
					if (typeof event.logSkill == "string") {
						next.skill = event.logSkill;
					} else if (Array.isArray(event.logSkill)) {
						forwardEventLogSkill(player, event.logSkill);
					}
				}
				await next;
			} else {
				event.result = { bool: false };
			}
		},
	],
	async chooseToDuiben(event, trigger, player) {
		const target = event.getTarget();

		event.title ??= "对策";
		event.namelist ??= ["全军出击", "分兵围城", "奇袭粮道", "开城诱敌"];
		event.translationList ??= ["若对方选择“开城诱敌”，你胜", "若对方选择“奇袭粮道”，你胜", "若对方选择“全军出击”，你胜", "若对方选择“分兵围城”，你胜"];
		event.ai ??= () => 1 + Math.random();

		const cardNameList = ["db_atk1", "db_atk2", "db_def1", "db_def2"];
		game.broadcastAll(loadImages, cardNameList, event.namelist, event.translationList);
		game.log(player, "向", target, "发起了", `#y${event.title}`);

		const defendChoices = ["db_def1", "db_def2"];
		const attackChoices = ["db_atk1", "db_atk2"];
		const defendVCards = defendChoices.map(name => ["", "", name]);
		const attackVCards = attackChoices.map(name => ["", "", name]);
		const defendButtons = [defendVCards, "vcard"];
		const attackButtons = [attackVCards, "vcard"];
		const defendChoose = [`${event.title}：请选择一种策略`, defendButtons];
		const attackChoose = [`${event.title}：请选择一种策略`, attackButtons];

		let playerResult;
		let targetResult;
		if (_status.connectMode) {
			const playerChoose = [player, defendChoose, true];
			const targetChoose = [target, attackChoose, true];

			const choose = [playerChoose, targetChoose];
			const result = await player
				.chooseButtonOL(choose, () => {}, event.ai)
				.set("switchToAuto", () => {
					_status.event.result = "ai";
				})
				.set("processAI", () => {
					const buttons = _status.event.dialog.buttons;
					return {
						bool: true,
						links: [buttons.randomGet().link],
					};
				})
				.forResult();

			if (typeof result === "string" || !player.playerid || !target.playerid) return;
			const playerData = result[player.playerid];
			const targetData = result[target.playerid];
			if (!playerData || !Array.isArray(playerData.links) || !targetData || !Array.isArray(targetData.links)) return;
			const playerLink = playerData.links[0];
			const targetLink = targetData.links[0];
			if (!Array.isArray(playerLink) || typeof playerLink[2] !== "string" || !Array.isArray(targetLink) || typeof targetLink[2] !== "string") return;
			playerResult = playerLink[2];
			targetResult = targetLink[2];
		} else {
			const playerChooseEvent = player.chooseButton(defendChoose, true);
			playerChooseEvent.ai = event.ai;
			const playerResultData = await playerChooseEvent.forResult();
			if (typeof playerResultData === "string" || !Array.isArray(playerResultData.links)) return;
			const playerLink = playerResultData.links[0];
			if (!Array.isArray(playerLink) || typeof playerLink[2] !== "string") return;
			playerResult = playerLink[2];

			const targetChooseEvent = target.chooseButton(attackChoose, true);
			targetChooseEvent.ai = event.ai;
			const targetResultData = await targetChooseEvent.forResult();
			if (typeof targetResultData === "string" || !Array.isArray(targetResultData.links)) return;
			const targetLink = targetResultData.links[0];
			if (!Array.isArray(targetLink) || typeof targetLink[2] !== "string") return;
			targetResult = targetLink[2];
		}

		game.broadcast(() => void ui.arena.classList.add("thrownhighlight"));
		ui.arena.classList.add("thrownhighlight");
		game.addVideo("thrownhighlight1");
		target.$compare(game.createCard(targetResult, "", ""), player, game.createCard(playerResult, "", ""));
		game.log(target, "选择的策略为", `#g${get.translation(targetResult)}`);
		game.log(player, "选择的策略为", `#g${get.translation(playerResult)}`);
		await game.delay(0, lib.config.game_speed == "vvfast" ? 4000 : 1500);

		const playerResultType = playerResult.slice(6);
		const targetResultType = targetResult.slice(6);
		let resultPopup;
		if (playerResultType == targetResultType) {
			resultPopup = `${get.translation(player) + event.title}成功`;
			player.popup("胜", "wood");
			target.popup("负", "fire");
			game.log(player, "#g胜");
			event.result = { bool: true };
		} else {
			resultPopup = `${get.translation(player) + event.title}失败`;
			target.popup("胜", "wood");
			player.popup("负", "fire");
			game.log(target, "#g胜");
			event.result = { bool: false };
		}
		event.result.player = playerResult;
		event.result.target = targetResult;
		game.broadcastAll(popup => {
			const dialog = ui.create.dialog(popup);
			dialog.classList.add("center");
			setTimeout(() => void dialog.close(), 1000);
		}, resultPopup);

		const skill = `${event.getParent().name}_${event.result.bool ? `true${playerResult}` : "false"}`;
		game.trySkillAudio(skill, player, true, null, null, [event, event.player]);

		await game.delay(2);

		game.broadcastAll(() => void ui.arena.classList.remove("thrownhighlight"));
		game.addVideo("thrownhighlight2");
		if (event.clear !== false) {
			game.broadcastAll(ui.clear);
		}

		return;

		/**
		 * @param {string[]} cardNameList
		 * @param {string[]} nameList
		 * @param {string[]} translationList
		 */
		function loadImages(cardNameList, nameList, translationList) {
			for (const [i, cardName] of cardNameList.entries()) {
				const name = nameList[i];
				const translation = translationList[i];

				lib.card[cardName].image = `image/card/${cardName}${nameList[0] == "全军出击" ? "" : `_${name}`}.jpg`;
				lib.translate[cardName] = name;
				lib.translate[`${cardName}_info`] = translation;
			}
		}
	},
	async chooseToPSS(event, trigger, player) {
		const target = event.getTarget();

		game.log(player, "对", target, "发起了猜拳");

		const pssChoices = ["pss_stone", "pss_scissor", "pss_paper"];
		const pssVCards = pssChoices.map(name => ["", "", name]);
		const pssButtons = [pssVCards, "vcard"];
		const pssChoose = ["猜拳：请选择一种手势", pssButtons];

		let playerResult;
		let targetResult;
		if (_status.connectMode) {
			const choose = [
				[player, pssChoose, true],
				[target, pssChoose, true],
			];

			const result = await player
				.chooseButtonOL(
					choose,
					() => {},
					() => 1 + Math.random()
				)
				.set("switchToAuto", () => {
					_status.event.result = "ai";
				})
				.set("processAI", () => {
					const buttons = _status.event.dialog.buttons;
					return {
						bool: true,
						links: [buttons.randomGet().link],
					};
				})
				.forResult();

			if (typeof result === "string" || !player.playerid || !target.playerid) return;
			const playerData = result[player.playerid];
			const targetData = result[target.playerid];
			if (!playerData || !Array.isArray(playerData.links) || !targetData || !Array.isArray(targetData.links)) return;
			const playerLink = playerData.links[0];
			const targetLink = targetData.links[0];
			if (!Array.isArray(playerLink) || typeof playerLink[2] !== "string" || !Array.isArray(targetLink) || typeof targetLink[2] !== "string") return;
			playerResult = playerLink[2];
			targetResult = targetLink[2];
		} else {
			const playerChooseEvent = player.chooseButton(pssChoose, true);
			playerChooseEvent.ai = () => 1 + Math.random();
			const playerResultData = await playerChooseEvent.forResult();
			if (typeof playerResultData === "string" || !Array.isArray(playerResultData.links)) return;
			const playerLink = playerResultData.links[0];
			if (!Array.isArray(playerLink) || typeof playerLink[2] !== "string") return;
			playerResult = playerLink[2];

			const targetChooseEvent = target.chooseButton(pssChoose, true);
			targetChooseEvent.ai = () => 1 + Math.random();
			const targetResultData = await targetChooseEvent.forResult();
			if (typeof targetResultData === "string" || !Array.isArray(targetResultData.links)) return;
			const targetLink = targetResultData.links[0];
			if (!Array.isArray(targetLink) || typeof targetLink[2] !== "string") return;
			targetResult = targetLink[2];
		}

		game.broadcastAll(() => void ui.arena.classList.add("thrownhighlight"));
		game.addVideo("thrownhighlight1");
		player.$compare(game.createCard(playerResult, "", ""), target, game.createCard(targetResult, "", ""));
		game.log(player, "选择的手势为", `#g${get.translation(playerResult)}`);
		game.log(target, "选择的手势为", `#g${get.translation(targetResult)}`);

		await game.delay(0, 1500);

		const mes = playerResult.slice(4);
		const tes = targetResult.slice(4);
		let str;
		if (mes == tes) {
			str = "二人平局";
			player.popup("平", "metal");
			target.popup("平", "metal");
			game.log("猜拳的结果为", "#g平局");
			event.result = { tie: true };
		} else {
			if ({ paper: "stone", scissor: "paper", stone: "scissor" }[mes] == tes) {
				str = `${get.translation(player)}胜利`;
				player.popup("胜", "wood");
				target.popup("负", "fire");
				game.log(player, "#g胜");
				event.result = { bool: true };
			} else {
				str = `${get.translation(target)}胜利`;
				target.popup("胜", "wood");
				player.popup("负", "fire");
				game.log(target, "#g胜");
				event.result = { bool: false };
			}
		}

		game.broadcastAll(str => {
			const dialog = ui.create.dialog(str);
			dialog.classList.add("center");
			setTimeout(() => void dialog.close(), 1000);
		}, str);
		await game.delay(2);

		game.broadcastAll(() => void ui.arena.classList.remove("thrownhighlight"));
		game.addVideo("thrownhighlight2");
		if (event.clear !== false) {
			game.broadcastAll(ui.clear);
		}
	},
	async cardsDiscard(event, trigger, player) {
		const { cards } = event;

		game.getGlobalHistory().cardMove.push(event);
		let withPile = false;
		for (const card of cards) {
			if (card.willBeDestroyed("discardPile", null, event)) {
				card.selfDestroy(event);
				continue;
			}

			if (get.position(card, true) == "c") {
				withPile = true;
			}

			card.discard();
		}
		if (withPile) {
			game.updateRoundNumber();
		}
		const waitings: GameEvent[] = [];
		for (const [key, value] of lib.commonArea) {
			const list = (_status[value.areaStatusName] || []).filter(card => cards.includes(card));
			if (event[value.fromName] || list.length) {
				const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
				next.setContent(value.removeHandeler);
				next.player = player;
				next.type = event.name;
				waitings.push(next);
			}
		}
		await Promise.all(waitings);
	},
	async orderingDiscard(event, trigger, player) {
		const cards = event.relatedEvent.orderingCards.filter(card => get.position(card, true) == "o");
		if (cards.length) {
			await game.cardsDiscard(cards);
		}
	},
	async cardsGotoOrdering(event, trigger, player) {
		const { cards } = event;
		game.getGlobalHistory().cardMove.push(event);
		let withPile = false;
		for (const card of cards) {
			if (card.willBeDestroyed("ordering", null, event)) {
				card.selfDestroy(event);
				continue;
			}
			if (get.position(card, true) == "c") {
				withPile = true;
			}
			card.fix();
			ui.ordering.appendChild(card);
		}
		if (withPile) {
			game.updateRoundNumber();
		}
		const waitings: GameEvent[] = [];
		for (const [key, value] of lib.commonArea) {
			const list = (_status[value.areaStatusName] || []).filter(card => cards.includes(card));
			if (event[value.fromName] || list.length) {
				const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
				next.setContent(value.removeHandeler);
				next.player = player;
				next.type = event.name;
				waitings.push(next);
			}
		}
		const evt = event.relatedEvent || event.getParent();
		if (!evt.orderingCards) {
			evt.orderingCards = [];
		}
		if (!evt.noOrdering && !evt.cardsOrdered) {
			evt.cardsOrdered = true;
			const next = game.createEvent("orderingDiscard", false);
			event.next.remove(next);
			evt.after.push(next);
			next.relatedEvent = evt;
			next.setContent("orderingDiscard");
			waitings.push(next);
		}
		if (!evt.noOrdering) {
			evt.orderingCards.addArray(cards);
		}
		event.result = { cards };
		await Promise.all(waitings);
	},
	async cardsGotoSpecial(event, trigger, player) {
		const { cards } = event;

		game.getGlobalHistory().cardMove.push(event);

		let withPile = false;
		for (const card of cards) {
			if (card.willBeDestroyed("special", null, event)) {
				card.selfDestroy(event);
				continue;
			}
			if (get.position(card, true) == "c") {
				withPile = true;
			}
			card.fix();
			ui.special.appendChild(card);
		}
		if (withPile) {
			game.updateRoundNumber();
		}

		const waitings: GameEvent[] = [];
		for (const [key, value] of lib.commonArea) {
			if (event[value.toName]) {
				const next = initializeEvent(game.createEvent(`lose_${value.toName}`), { cards });
				next.setContent(value.addHandeler);
				next.player = player;
				next.relatedEvent = event;
				next.type = event.name;
				waitings.push(next);
			}
		}

		await Promise.all(waitings);
	},
	async cardsGotoPile(event, trigger, player) {
		const { cards } = event;
		const waitings: GameEvent[] = [];
		if (event.washCard) {
			const washCardEvent = event.trigger("washCard");
			if (washCardEvent) {
				waitings.push(washCardEvent);
			}
			for (let i = 0; i < lib.onwash.length; ++i) {
				if (lib.onwash[i]() == "remove") {
					lib.onwash.splice(i--, 1);
				}
			}
		}
		game.getGlobalHistory().cardMove.push(event);
		if (!event._triggeronly) {
			game.$cardsGotoPile(event);
			for (const [key, value] of lib.commonArea) {
				const list = (_status[value.areaStatusName] || []).filter(card => cards.includes(card));
				if (event[value.fromName] || list.length) {
					const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
					next.setContent(value.removeHandeler);
					next.player = player;
					next.type = event.name;
					waitings.push(next);
				}
			}
		}

		await Promise.all(waitings);
	},
	async chooseToEnable(event, trigger, player) {
		const { source } = event;
		if (event.selectButton) {
			const list: string[] = Array(5);
			for (let i = 0; i < 5; i++) {
				list[i] = `equip${i + 1}`;
			}
			const realList = list.filter(current => player.hasDisabledSlot(current));
			if (!list.length) {
				return;
			}

			if (event.selectButton[0] >= realList.length) {
				event.list = list;
				event.result = { links: list };
				await player.enableEquip({ slots: list.slice() });
			} else {
				const sortedList = list.toSorted().map(current => [current, get.translation(current)]);
				event.list = sortedList;
				let str = `请选择恢复${get.translation(player.name)}的`;
				const selectButton = get.select(event.selectButton);
				if (selectButton[0] == selectButton[1]) {
					str += get.cnNumber(selectButton[0]);
				} else if (selectButton[1] == Infinity) {
					str += `至少${get.cnNumber(selectButton[0])}`;
				} else {
					str += `${get.cnNumber(selectButton[0])}至${get.cnNumber(selectButton[1])}`;
				}
				str += "个装备栏";

				if (!source) {
					throw new TypeError("chooseToEnable requires an event source");
				}
				const next = source.chooseButton({
					selectButton,
					forced: true,
					createDialog: [str, [sortedList, "tdnodes"]],
				});
				next.set("filterButton", button => player.hasDisabledSlot(button.link));

				event.ai ??= () => Math.random();
				next.set("ai", event.ai);

				const result = await next.forResult();
				if (!isSelectionResultObject(result)) {
					event.result = result;
					return;
				}
				event.result = { links: result.links };
				const { links } = result;
				if (!Array.isArray(links) || !links.every(link => typeof link == "string")) {
					return;
				}
				await player.enableEquip({ slots: links.slice() });
			}
		} else {
			const list: string[] = [];
			for (let i = 1; i <= 5; i++) {
				if (player.hasDisabledSlot(i)) {
					list.push(`equip${i}`);
				}
			}
			if (!list.length) {
				return;
			}

			if (list.length == 1) {
				event.list = list;
				const control = list[0];
				event.result = { control };
				await player.enableEquip({ slots: [control] });
			} else {
				if (!source) {
					throw new TypeError("chooseToEnable requires an event source");
				}
				const next = source.chooseControl({ controls: list });
				next.set("prompt", `请选择恢复${get.translation(player.name)}的一个装备栏`);
				event.ai ??= (event, player, list) => list.randomGet();
				event.ai = event.ai(event.getParent(), player, list);
				next.ai = () => event.ai;
				const result = await next.forResult();
				if (!isSelectionResultObject(result)) {
					event.result = result;
					return;
				}
				event.result = { control: result.control };
				const { control } = result;
				if (typeof control != "string") {
					return;
				}
				await player.enableEquip({ slots: [control] });
			}
		}
	},
	async chooseToDisable(event, trigger, player) {
		const { source } = event;
		if (event.selectButton) {
			const list: string[] = Array(5);
			for (let i = 0; i < 5; i++) {
				list[i] = `equip${i + 1}`;
			}
			const realList = list.filter(current => player.hasEnabledSlot(current));
			if (event.horse) {
				if (list.includes("equip3") && (get.is.mountCombined() || list.includes("equip4"))) {
					list.push("equip3_4");
					realList.push("equip3_4");
				}
				list.remove("equip3", "equip4");
				realList.remove("equip3", "equip4");
			}
			if (!list.length) {
				return;
			}

			let links: string[] | undefined;
			if (event.selectButton[0] >= realList.length) {
				event.list = list;
				links = list;
			} else {
				const sortedList = list.toSorted().map(current => [current, get.translation(current)]);
				event.list = sortedList;
				let str = `请选择废除${get.translation(player.name)}的`;
				const selectButton = get.select(event.selectButton);
				if (selectButton[0] == selectButton[1]) {
					str += get.cnNumber(selectButton[0]);
				} else if (selectButton[1] == Infinity) {
					str += `至少${get.cnNumber(selectButton[0])}`;
				} else {
					str += `${get.cnNumber(selectButton[0])}至${get.cnNumber(selectButton[1])}`;
				}
				str += "个装备栏";

				if (!source) {
					throw new TypeError("chooseToDisable requires an event source");
				}
				const next = source.chooseButton({
					selectButton,
					forced: true,
					createDialog: [str, [sortedList, "tdnodes"]],
				});
				next.set("filterButton", button => player.hasEnabledSlot(button.link));
				event.ai ??= () => Math.random();
				next.set("ai", event.ai);

				const result = await next.forResult();
				if (result && typeof result == "object" && "links" in result && Array.isArray(result.links)) {
					const selected = result.links.filter(link => typeof link == "string");
					if (selected.length) {
						links = selected;
					}
				}
			}

			if (!links) {
				return;
			}
			event.result = { links };
			const slots = links.slice();
			if (slots.includes("equip3_4")) {
				slots.remove("equip3_4");
				slots.add("equip3");
				slots.add("equip4");
			}
			await player.disableEquip({ slots });
		} else {
			const list: string[] = [];
			for (let i = 1; i <= 5; i++) {
				if (player.hasEnabledSlot(i)) {
					list.push(`equip${i}`);
				}
			}
			if (event.horse) {
				if (list.includes("equip3") && (get.is.mountCombined() || list.includes("equip4"))) {
					list.push("equip3_4");
				}
				list.remove("equip3");
				list.remove("equip4");
			}
			if (!list.length) {
				return;
			}

			let control: string | undefined;
			if (list.length == 1) {
				event.list = list;
				control = list[0];
			} else {
			list.sort();
			event.list = list;

				if (!source) {
					throw new TypeError("chooseToDisable requires an event source");
				}
				const next = source.chooseControl({ controls: list });
				next.set("prompt", `请选择废除${get.translation(player.name)}的一个装备栏`);
				event.ai ??= (event, player, list) => list.randomGet();
				event.ai = event.ai(event.getParent(), player, list);
				next.ai = () => event.ai;

				const nextResult = await next.forResult();
				if (nextResult && typeof nextResult == "object" && typeof nextResult.control == "string") {
					control = nextResult.control;
				}
			}
			if (!control) {
				return;
			}
			event.result = { control };
			if (control == "equip3_4") {
				await player.disableEquip({ slots: ["equip3", "equip4"] });
			} else {
				await player.disableEquip({ slots: [control] });
			}
		}
	},
	async swapEquip(event, trigger, player) {
		const target = event.getTarget();
		const cards = [player.getCards("e"), target.getCards("e")];
		event.cards1 = cards[0];
		event.cards2 = cards[1];
		await game
			.loseAsync({
				player: player,
				target: target,
				cards1: cards[0],
				cards2: cards[1],
			})
			.setContent("swapHandcardsx");

		for (const card of cards[1]) {
			const vcard = card.cardSymbol === undefined ? get.autoViewAs(card, void 0, false) : card[card.cardSymbol];
			if (!vcard) {
				continue;
			}
			if (vcard.cards?.length && vcard.cards.some(i => get.position(i, true) !== "o")) {
				continue;
			}
			await player.equip(vcard);
		}
		for (const card of cards[0]) {
			const vcard = card.cardSymbol === undefined ? get.autoViewAs(card, void 0, false) : card[card.cardSymbol];
			if (!vcard) {
				continue;
			}
			if (vcard.cards?.length && vcard.cards.some(i => get.position(i, true) !== "o")) {
				continue;
			}
			await target.equip(vcard);
		}
	},
	async disableJudge(event, trigger, player) {
		game.log(player, "废除了判定区");
		const js = player.getCards("j");
		player.storage._disableJudge = true;
		if (js.length) {
			await player.discard({ cards: js });
		}
		game.broadcastAll(player => {
			player.$disableJudge();
		}, player);
	},
	async enableJudge(event, trigger, player) {
		if (!player.storage._disableJudge) {
			return;
		}
		game.log(player, "恢复了判定区");
		game.broadcastAll(player => {
			player.$enableJudge();
		}, player);
	},
	/*----分界线----*/
	async phasing(event, trigger, player) {
		while (ui.dialogs.length) {
			ui.dialogs[0].close();
		}
		game.phaseNumber++;
		player.phaseNumber++;
		game.broadcastAll(
			(player, player2, num, popup) => {
				if (lib.config.glow_phase) {
					if (player2) {
						player2.classList.remove("glow_phase");
					}
					player.classList.add("glow_phase");
				}
				player.phaseNumber = num;
				if (popup && lib.config.show_phase_prompt) {
					player.popup("回合开始", undefined, false);
				}
			},
			player,
			_status.currentPhase,
			player.phaseNumber,
			!player.noPhaseDelay
		);
		_status.currentPhase = player;
		_status.discarded = [];
		game.syncState();
		game.addVideo("phaseChange", player);
		if (game.phaseNumber >= 1 && !lib.configOL.observeReady) {
			delete player._start_cards;
			if (lib.configOL.observe) {
				lib.configOL.observeReady = true;
				game.send("server", "config", lib.configOL);
			}
		}
		game.log();
		game.log(player, "的回合开始");
		player._noVibrate = true;
		if (get.config("identity_mode") != "zhong" && get.config("identity_mode") != "purple" && !_status.connectMode) {
			let num;
			switch (get.config("auto_identity")) {
				case "one":
					num = 1;
					break;
				case "two":
					num = 2;
					break;
				case "three":
					num = 3;
					break;
				case "always":
					num = -1;
					break;
				default:
					num = 0;
					break;
			}
			if (num && !_status.identityShown && game.phaseNumber > game.players.length * num && game.showIdentity) {
				if (!_status.video) {
					player.popup("显示身份");
				}
				_status.identityShown = true;
				game.showIdentity(false);
			}
		}
		player.ai.tempIgnore = [];
		if (ui.land && ui.land.player == player) {
			game.addVideo("destroyLand");
			ui.land.destroy();
		}

		await event.trigger("phaseBeginStart");
	},
	async toggleSubPlayer(event, trigger, player) {
		const list = event.list || player.storage.subplayer.skills.slice(0);
		list.remove(player.storage.subplayer.name2);
		event.list = list;

		if (!event.directresult) {
			if (list.length > 1) {
				const dialog = ui.create.dialog("更换一个随从", "hidden");
				dialog.add([list, "character"]);
				const result = await player.chooseButton(dialog, true).forResult();
				if (result && typeof result == "object" && "bool" in result && result.bool && "links" in result && Array.isArray(result.links) && typeof result.links[0] == "string") {
					event.directresult = result.links[0];
				}
			} else if (list.length == 1) {
				event.directresult = list[0];
			} else {
				return;
			}
		} else {
			if (!list.includes(event.directresult)) {
				return;
			}
		}

		if (!event.directresult) {
			return;
		}

		let waiting: GameEvent | null = null;
		if (player.storage.subplayer) {
			const current = player.storage.subplayer.name2;
			if (event.directresult == current) {
				return;
			}
			player.storage[current].hp = player.hp;
			player.storage[current].maxHp = player.maxHp;
			player.storage[current].hujia = player.hujia;
			player.storage[current].hs = player.getCards("h");
			player.storage[current].es = player.getVCards("e");

			const next = player.lose({ cards: player.getCards("he"), position: ui.special });
			next._triggered = null;
			waiting = next;

			const cfg = player.storage[event.directresult];
			player.storage.subplayer.name2 = event.directresult;
			player.reinit(current, event.directresult, [cfg.hp, cfg.maxHp, cfg.hujia]);
			if (player.name == event.directresult || player.name1 == event.directresult) {
				const groupx = cfg.group || "qun";
				player.group = groupx;
				player.node.name.dataset.nature = get.groupnature(groupx);
			}
			if (cfg.hs.length) {
				player.directgain(cfg.hs);
			}
			if (cfg.es.length) {
				player.directequip(cfg.es);
			}
		}

		if (waiting != null) {
			await waiting;
		}
	},
	async exitSubPlayer(event, trigger, player) {
		if (player.storage.subplayer) {
			const current = player.storage.subplayer.name2;
			const goon = player.name == current || player.name1 == current;
			if (event.remove) {
				player.lose({ cards: player.getCards("he"), position: ui.discardPile })._triggered = null;
			} else {
				player.storage[current].hp = player.hp;
				player.storage[current].maxHp = player.maxHp;
				player.storage[current].hujia = player.hujia;
				player.storage[current].hs = player.getCards("h");
				player.storage[current].es = player.getVCards("e");
				player.lose({ cards: player.getCards("he"), position: ui.special })._triggered = null;
			}
			player.reinit(current, player.storage.subplayer.name, [player.storage.subplayer.hp, player.storage.subplayer.maxHp, player.storage.subplayer.hujia]);
			if (goon) {
				const groupx = player.storage.subplayer.group || "qun";
				player.group = groupx;
				player.node.name.dataset.nature = get.groupnature(groupx);
			}
			player.update();
			if (event.remove) {
				if (player.storage[current].onremove) {
					player.storage[current].onremove(player, current);
				}
				delete player.storage[current];
				player.storage.subplayer.skills.remove(current);
				game.log(player, "牺牲了随从", `#g${current}`);
			} else {
				game.log(player, "收回了随从", `#g${current}`);
			}
			player.addSkill(player.storage.subplayer.skills);
		}

		if (player.storage.subplayer) {
			player.directgain(player.storage.subplayer.hs);
			player.directequip(player.storage.subplayer.es);
		}
		player.removeSkill("subplayer");

		if (event.remove) {
			await event.trigger("subPlayerDie");
		}
	},
	async callSubPlayer(event, trigger, player) {
		const list = player.getSubPlayers(event.tag);
		event.list = list;
		if (!event.directresult) {
			if (list.length > 1) {
				const dialog = ui.create.dialog("调遣一个随从", "hidden");
				dialog.add([list, "character"]);
				const result = await player.chooseButton(dialog, true).forResult();

				if (typeof result !== "string" && result.bool && Array.isArray(result.links) && result.links[0]) {
					event.directresult = result.links[0];
				}
			} else if (list.length == 1) {
				event.directresult = list[0];
			} else {
				return;
			}
		} else {
			if (!list.includes(event.directresult)) {
				return;
			}
		}

		if (!event.directresult) {
			await game.delay();
			return;
		}

		const cfg = player.storage[event.directresult];
		const source: string = cfg.source || player.name;
		const name = event.directresult;
		game.log(player, "调遣了随从", `#g${name}`);
		player.storage.subplayer = {
			name: source,
			name2: event.directresult,
			hp: player.hp,
			maxHp: player.maxHp,
			hujia: player.hujia,
			skills: event.list.slice(0),
			hs: player.getCards("h"),
			es: player.getVCards("e"),
			intro2: cfg.intro2,
			group: player.group,
		};
		player.removeSkill(event.list);
		player.reinit(source, name, [cfg.hp, cfg.maxHp, cfg.hujia]);
		if (player.name == name || player.name1 == name) {
			const groupx = cfg.group || "qun";
			player.group = groupx;
			player.node.name.dataset.nature = get.groupnature(groupx);
		}
		player.addSkill("subplayer");
		player.lose(player.getCards("he"), ui.special)._triggered = null;
		if (cfg.hs.length) {
			player.directgain(cfg.hs);
		}
		if (cfg.es.length) {
			player.directequip(cfg.es);
		}

		await game.delay();
	},
	async addExtraTarget(event, trigger, player) {
		const { card } = event;
		const targets = event.getTargets();

		const info = get.info(card);
		for (const target of targets) {
			let result: Partial<Result>;
			if (target == event.target && event.addedTarget) {
				event.addedTargets.push(event.addedTarget);
				result = { bool: false };
			} else if (game.hasPlayer(current => info.filterAddedTarget(card, player, current, target))) {
				const next = player.chooseTarget({
					prompt: `${get.translation(event.card)}：选择${get.translation(target)}对应的指向目标`,
					filterTarget: (_card, player, target) => {
						const card = get.card();
						const info = get.info(card);
						return info.filterAddedTarget(card, player, target, _status.event.preTarget);
					},
					forced: true,
					ai: target => get.effect(target, get.card(), player, _status.event.player),
				});
				next.set("_get_card", card);
				next.set("preTarget", target);

				const nextResult = await next.forResult();
				if (!isSelectionResultObject(nextResult)) {
					result = { bool: false };
				} else {
					result = nextResult;
				}
			} else {
				event.addedTargets.push(false);
				result = { bool: false };
			}
			if (result.bool && Array.isArray(result.targets) && result.targets[0]) {
				event.addedTargets.push(result.targets[0]);
				player.line2([target, result.targets[0]]);
			}
		}
	},
	async reverseOrder(event, trigger, player) {
		const { card } = event;
		await game.delay();

		let choice;
		if (get.tag(card, "multineg")) {
			choice = player.previous.side == player.side ? "逆时针" : "顺时针";
		} else {
			choice = player.next.side == player.side ? "逆时针" : "顺时针";
		}

		const result = await player
			.chooseControl({ controls: ["顺时针", "逆时针"], ai: (event, player) => _status.event.choice || "逆时针" })
			.set("prompt", `选择${get.translation(card)}的结算方向`)
			.set("choice", choice)
			.set("forceDie", true)
			.forResult();

		if (typeof result !== "string" && result.control == "顺时针") {
			const evt = event.getParent(undefined, true);
			if (!evt) {
				throw new Error(`${event.name} event requires a parent to sort its targets.`);
			}
			const targets = evt.getTargets();
			const sorter = _status.currentPhase || player;
			evt.fixedSeat = true;
			targets.sortBySeat(sorter);
			targets.reverse();
			const lastTarget = targets[targets.length - 1];
			if (lastTarget == sorter) {
				targets.pop();
				targets.unshift(lastTarget);
			}
		}
	},
	async addJudgeCard(event) {
		const { card, cards } = event;
		const target = event.getTarget();
		if ((!card?.cards || !card.cards.some(card => get.position(card, true) !== "o")) && target.canAddJudge(card)) {
			await target.addJudge(card, cards);
		}
	},
	async equipCard(event) {
		const { card } = event;
		const target = event.getTarget();

		if (!card?.cards || !card.cards.some(card => get.position(card, true) !== "o")) {
			await target.equip(card);
		}
		//if (cards.length && get.position(cards[0], true) == "o") target.equip(cards[0]);
	},
	async gameDraw(event: RawGameDrawEvent, trigger, player: Player | null | undefined) {
		const { num } = event;
		if (_status.brawl && _status.brawl.noGameDraw) {
			return;
		}
		if (!player) {
			throw new Error("gameDraw requires an initialized player.");
		}
		const targets = event.getTargets();

		const end = player;

		const waitings: GameEvent[] = [];
		do {
			if (targets.includes(player)) {
				const numx = typeof num == "function" ? num(player) : num;

				/*otherPile主要是针对那些用专属牌堆，不从一般牌堆摸牌的角色（如陈寿），该属性目前只有两个键值对，且都为函数
				 *getCards函数与获得牌相关，只传入要获得的牌数num作为参数
				 *discard与手气卡换牌后弃置牌相关，只传入要弃置的牌card作为参数
				 */
				const cards: Card[] = [];
				const playerid = player.playerid;
				const otherGetCards = playerid ? event.otherPile?.[playerid]?.getCards : undefined;
				//先看有没有专属牌堆，再看其他的
				if (otherGetCards) {
					cards.addArray(otherGetCards(numx));
				} else if (player.getTopCards) {
					cards.addArray(player.getTopCards(numx));
				} else {
					cards.addArray(get.cards(numx));
				}
				//别问，问就是初始手牌要有标记 by 星の语
				//event.gaintag支持函数、字符串、数组。数组就是添加一连串的标记；函数的返回格式为[[cards1,gaintag1],[cards2,gaintag2]...]
				if (playerid && event.gaintag?.[playerid]) {
					const gaintag = event.gaintag[playerid];
					const list = typeof gaintag == "function" ? gaintag(numx, cards) : [[cards, gaintag]];
					game.broadcastAll(
						(player, list) => {
							for (let i = list.length - 1; i >= 0; i--) {
								player.directgain(list[i][0], null, list[i][1]);
							}
						},
						player,
						list
					);
				} else {
					player.directgain(cards);
				}
			}

			if (player.singleHp === true && get.mode() != "guozhan" && (lib.config.mode != "doudizhu" || _status.mode != "online")) {
				const next = player.doubleDraw();
				waitings.push(next);
			}

			player._start_cards = player.getCards("h");
			player = player.next;
		} while (player != end);

		event.changeCard = get.config("change_card");
		if (_status.connectMode || (lib.config.mode == "single" && _status.mode != "wuxianhuoli") || (lib.config.mode == "doudizhu" && _status.mode == "online") || (lib.config.mode != "identity" && lib.config.mode != "guozhan" && lib.config.mode != "doudizhu" && lib.config.mode != "single")) {
			event.changeCard = "disabled";
		}

		await Promise.all(waitings);

		const me = game.me;
		if (!me || !targets.includes(me) || event.changeCard == "disabled" || _status.auto || !me.countCards("h")) {
			return;
		}

		event.dialog = ui.create.dialog("是否使用手气卡？");
		ui.create.confirm("oc");
		event.custom.replace.confirm = bool => {
			_status.event.bool = bool;
			game.resume();
		};

		while (true) {
			if (event.changeCard == "once") {
				event.changeCard = "disabled";
			} else if (event.changeCard == "twice") {
				event.changeCard = "once";
			} else if (event.changeCard == "disabled") {
				event.bool = false;
				_status.imchoosing = false;
				break;
			}

			_status.imchoosing = true;
			event.switchToAuto = () => {
				_status.event.bool = false;
				game.resume();
			};
			await game.pause();
			_status.imchoosing = false;
			if (!event.bool) {
				break;
			}

			if (game.changeCoin) {
				game.changeCoin(-3);
			}
			/*otherPile主要是针对那些用专属牌堆，不从一般牌堆摸牌的角色（如陈寿），该属性目前只有两个键值对，且都为函数
			 *getCards函数与获得牌相关，只传入要获得的牌数num作为参数
			 *discard与手气卡换牌后弃置牌相关，只传入要弃置的牌card作为参数
			 */
			const hs = game.getMe().getCards("h");
			const cards: Card[] = [];
			const gameMePlayerid = game.getMe().playerid;
			const otherGetCards = gameMePlayerid ? event.otherPile?.[gameMePlayerid]?.getCards : undefined;
			const otherDiscacrd = gameMePlayerid ? event.otherPile?.[gameMePlayerid]?.discard : undefined;
			//先弃牌
			game.addVideo("lose", game.getMe(), [get.cardsInfo(hs), [], [], []]);
			for (const card of hs) {
				card.removeGaintag(true);
				if (otherDiscacrd) {
					otherDiscacrd(card);
				} else {
					card.discard(false);
				}
			}
			//再摸牌，先看有没有专属牌堆
			if (otherGetCards) {
				cards.addArray(otherGetCards(hs.length));
			} else {
				cards.addArray(get.cards(hs.length));
			}
			//添加标记相关
			//别问，问就是初始手牌要有标记 by 星の语
			//event.gaintag支持函数、字符串、数组。数组就是添加一连串的标记；函数的返回格式为[[cards1,gaintag1],[cards2,gaintag2]...]
			if (gameMePlayerid && event.gaintag?.[gameMePlayerid]) {
				const gaintag = event.gaintag[gameMePlayerid];
				const list = typeof gaintag == "function" ? gaintag(hs.length, cards) : [[cards, gaintag]];
				for (let i = list.length - 1; i >= 0; i--) {
					game.getMe().directgain(list[i][0], null, list[i][1]);
				}
			} else {
				game.getMe().directgain(cards);
			}
			game.getMe()._start_cards = game.getMe().getCards("h");
		}

		if (event.dialog) {
			event.dialog.close();
		}
		if (ui.confirm) {
			ui.confirm.close();
		}
		game.getMe()._start_cards = game.getMe().getCards("h");
	},
	async phaseLoop(event, trigger, player) {
		let num = 1;
		let current = player;
		while (current.getSeatNum() === 0) {
			current.setSeatNum(num);
			current = current.next;
			num++;
		}
		while (true) {
			const phasePlayer = event.player;
			if (phasePlayer && game.players.includes(phasePlayer)) {
				lib.onphase.forEach(i => i());
				const phase = event.getPlayer().phase();
				event.next.remove(phase);
				let isRoundEnd: boolean | undefined = false;
				if (lib.onround.every(i => i(phase, event.getPlayer()))) {
					isRoundEnd = _status.roundSkipped;
					if (_status.isRoundFilter) {
						isRoundEnd = _status.isRoundFilter(phase, event.getPlayer());
					} else if (_status.seatNumSettled) {
						const seatNum = event.getPlayer().getSeatNum();
						if (seatNum != 0) {
							const lastPhasedPlayer = _status.lastPhasedPlayer;
							if (!lastPhasedPlayer || seatNum < lastPhasedPlayer.getSeatNum()) {
								isRoundEnd = true;
							}
						}
					} else if (event.getPlayer() == _status.roundStart) {
						isRoundEnd = true;
					}
					if (isRoundEnd && _status.globalHistory.some(i => "isRound" in i && i.isRound)) {
						game.log();
						await event.trigger("roundEnd");
					}
				}
				event.next.push(phase);
				await phase;
			}
			await event.trigger("phaseOver");
			const findNext = current => {
					const players = game.players
						.slice(0)
						.concat(game.dead)
						.sort((a, b) => {
							const aPosition = a.dataset.position;
							const bPosition = b.dataset.position;
							return aPosition === undefined || bPosition === undefined ? 0 : parseInt(aPosition) - parseInt(bPosition);
						});
				const position = current.dataset.position;
				if (position === undefined) {
					return players[0];
				}
				for (const player of players) {
					const playerPosition = player.dataset.position;
					if (playerPosition !== undefined && parseInt(playerPosition) > parseInt(position)) {
						return player;
					}
				}
				return players[0];
			};
			event.player = findNext(event.player);
		}
	},
	async loadPackage(event, trigger, player) {
		for (const pack of event.packages) {
			const [path, file] = pack.split("/");
			window.game = game;
			await lib.init.promises.js(lib.assetURL + path, file);
			if (!lib.config.dev) {
				delete window.game;
			}

			const characters = lib.imported.character;
			const cards = lib.imported.card;
			for (const charaPackName in characters) {
				const charaPack = characters[charaPackName];
				if (charaPack.character) {
					const characterPack = lib.characterPack[charaPackName];
					if (characterPack) {
						Object.assign(characterPack, charaPack.character);
					} else {
						lib.characterPack[charaPackName] = charaPack.character;
					}
				}
				if (charaPack.forbid && charaPack.forbid.includes(lib.config.mode)) {
					continue;
				}
				if (charaPack.mode && charaPack.mode.includes(lib.config.mode) == false) {
					continue;
				}

				// ???
				// if (Array.isArray(lib[j]) && Array.isArray(character[i][j])) {
				// 	lib[j].addArray(character[i][j]);
				// 	continue;
				// }
				for (const itemName in charaPack) {
					if (itemName == "name" || itemName == "mode" || itemName == "forbid" || itemName == "characterSort") {
						continue;
					}
					const item = charaPack[itemName];
					for (const termName in item) {
						const term = item[termName];

						if (itemName == "character") {
							const character = get.convertedCharacter(term);

							if (character.isBoss || character.isHiddenBoss) {
								lib.config.forbidai.add(termName);
							}
							if (lib.config[`forbidai_user_${charaPackName}`] && lib.config.forbidai_user?.includes(termName)) {
								lib.config.forbidai.add(termName);
							}
							for (const skill of character.skills) {
								lib.skilllist.add(skill);
							}
						}
						if (itemName == "translate" && termName == charaPackName) {
							lib[itemName][`${termName}_character_config`] = term;
						} else {
							if (lib[itemName][termName] == null) {
								const descriptor = Object.getOwnPropertyDescriptor(item, termName);
								if (descriptor) {
									Object.defineProperty(lib[itemName], termName, descriptor);
								}
							} else if (Array.isArray(lib[itemName][termName]) && Array.isArray(term)) {
								lib[itemName][termName].addArray(term);
							} else {
								console.log(`duplicated ${itemName} in character ${charaPackName}:\n${termName}:\nlib.${itemName}.${termName}`, lib[itemName][termName], `\ncharacter.${charaPackName}.${itemName}.${termName}`, term);
							}
						}
					}
				}

				for (const cardPackName in cards) {
					lib.cardPack[cardPackName] ??= [];
					const cardPack = lib.cardPack[cardPackName];
					if (cards[cardPackName].card) {
						for (const cardName in cards[cardPackName].card) {
							if (!cards[cardPackName].card[cardName].hidden && cards[cardPackName].translate[`${cardName}_info`]) {
								cardPack.push(cardName);
							}
						}
					}
					for (const itemName in cards[cardPackName]) {
						const item = cards[cardPackName][itemName];
						if (itemName == "name" || itemName == "mode" || itemName == "forbid") {
							continue;
						}
						if (itemName == "list") {
							continue;
						}
						for (const termName in item) {
							const term = item[termName];
							if (itemName == "skill" && termName[0] == "_" && !lib.config.cards.includes(cardPackName)) {
								continue;
							}
							if (itemName == "translate" && termName == cardPackName) {
								lib[itemName][`${termName}_card_config`] = term;
							} else {
								if (lib[itemName][termName] == undefined) {
									const descriptor = Object.getOwnPropertyDescriptor(item, termName);
									if (descriptor) {
										Object.defineProperty(lib[itemName], termName, descriptor);
									}
								} else {
									console.log(`duplicated ${itemName} in card ${cardPackName}:\n${termName}\nlib.${itemName}.${termName}`, lib[itemName][termName], `\ncard.${cardPackName}.${itemName}.${termName}`, term);
								}
							}
						}
					}
				}
			}
		}
	},
	async loadMode(event) {
		await game.loadModeAsync(event.mode, exports => {
			event.result = exports;
			const importedMode = lib.imported.mode;
			if (importedMode?.[event.mode]) {
				delete importedMode[event.mode];
			}
		});
	},
	async forceOver(event) {
		while (ui.controls.length) {
			ui.controls[0].close();
		}
		while (ui.dialogs.length) {
			ui.dialogs[0].close();
		}
		if (event.bool != "noover") {
			game.over(event.bool);
		}
		if (event.callback) {
			event.callback();
		}
	},
	async arrangeTrigger(event, trigger, player) {
		const doingList = event.doingList.slice(0);

		while (doingList.length > 0) {
			event.doing = doingList.shift();
			while (true) {
				if (trigger.filterStop && trigger.filterStop()) {
					return;
				}
				const usableSkills = event.doing.todoList.filter(info => lib.filter.filterTrigger(trigger, info.player, event.triggername, info.skill, info.indexedData));
				if (usableSkills.length == 0) {
					break;
				} else {
					event.doing.todoList = event.doing.todoList.filter(i => i.priority <= usableSkills[0].priority);
					//firstDo时机和lastDo时机不进行技能优先级选择
					if (get.itemtype(event.doing.player) !== "player") {
						event.current = usableSkills[0];
					} else {
						event.choice = usableSkills.filter(n => n.priority == usableSkills[0].priority);
						//现在只要找到一个同优先度技能为silent，或没有技能描述的技能 便优先执行该技能
						const silentSkill = event.choice.find(item => {
							const skillInfo = getRegisteredSkill(lib.skill, item.skill);
							return skillInfo && (skillInfo.silent || !lib.translate[item.skill]);
						});
						if (silentSkill) {
							event.current = silentSkill;
						} else {
							const currentChoice = event.choice[0];
							const skillsToChoose = event.choice.map(i => i.skill).unique();
							if (event.choice.length === 1 || skillsToChoose.length === 1) {
								event.current = currentChoice;
							} else {
								const currentPlayer = currentChoice.player;
								const next = currentPlayer.chooseControl(skillsToChoose.map(skill => get.skillTranslation(skill, currentPlayer, true)));
								next.set("prompt", "选择下一个触发的技能");
								next.set("forceDie", true);
								next.set("arrangeSkill", true);
								next.set("includeOut", true);
								const result = await next.forResult();
								//千里走单骑全责，把敌人打死可能会打断chooseControl
								if (result) {
									event.current = usableSkills.find(info => info.skill == skillsToChoose[result.index]);
								} else {
									event.current = usableSkills[0];
								}
							}
						}
					}
					event.doing.doneList.push(event.current);
					event.doing.todoList.remove(event.current);
					const triggerEvent = game.createTrigger(event.triggername, event.current.skill, event.current.player, trigger, event.current.indexedData);
					if (!triggerEvent) {
						continue;
					}
					const result = await triggerEvent.forResult();
					if (get.itemtype(event.doing.player) === "player" && result === "cancelled") {
						for (let i = 0; i < event.doing.todoList.length; i++) {
							if (event.current.skill === event.doing.todoList[i].skill) {
								event.doing.doneList.push(event.doing.todoList.splice(i--, 1)[0]);
							}
						}
					}
				}
			}
		}
	},
	async createTrigger(event, trigger, player) {
		const requireSkill = () => {
			if (!event.skill) {
				throw new TypeError("createTrigger requires an event skill");
			}
			return event.skill;
		};
		let skill = requireSkill();
		const info = get.info(skill);

		if (!game.expandSkills(player.getSkills().concat(lib.skill.global)).includes(skill) && !event.uncheckHasSkill) {
			const hidden = player.hiddenSkills.slice(0);
			const invisible = player.invisibleSkills.slice(0);
			game.expandSkills(hidden);
			game.expandSkills(invisible);
			if (hidden.includes(skill)) {
				if (!info.silent && player.hasSkillTag("nomingzhi", false, null, true)) {
					return;
				} else if ((!info.direct && typeof info.cost !== "function") || (get.is.locked(skill, player) && typeof info.cost == "function")) {
					await event.trigger("triggerHidden");
				} else {
					event.skillHidden = true;
				}
			} else if (invisible.includes(skill)) {
				await event.trigger("triggerInvisible");
			} else {
				let flag = true;
				for (const skill in player.additionalSkills) {
					if (skill.startsWith("hidden:")) {
						continue;
					}

					if (!game.expandSkills(player.additionalSkills[skill]).includes(skill)) {
						continue;
					}

					flag = false;
					break;
				}
				if (flag) {
					return;
				}
			}
		}
		skill = requireSkill();

		if (event.cancelled) {
			return;
		}
		if (skill.startsWith("player_when_")) {
			requireRegisteredSkill(lib.skill, skill).triggered = true;
		}

		let result: EventResult;
		if (event.revealed || info.forced) {
			result = { bool: true };
		} else {
			const checkFrequent = info => {
				if (player.hasSkillTag("nofrequent", false, skill)) {
					return false;
				}
				if (typeof info.frequent == "boolean") {
					return info.frequent;
				}
				if (typeof info.frequent == "function") {
					return info.frequent(trigger, player, event.triggername, event.indexedData);
				}
				if (info.frequent == "check" && typeof info.check == "function") {
					return info.check(trigger, player, event.triggername, event.indexedData);
				}
				return false;
			};

			if (info.direct) {
				if (player.isUnderControl()) {
					game.swapPlayerAuto(player);
				}
				result = { bool: true };
				event._direct = true;
			} else if (typeof info.cost === "function") {
				if (checkFrequent(info)) {
					event.frequentSkill = true;
				}
				if (player.isUnderControl()) {
					game.swapPlayerAuto(player);
				}
				//创建cost事件
				const next = game.createEvent(`${skill}_cost`);
				next.player = player;
				if (event.frequentSkill) {
					next.set("frequentSkill", skill);
				}
				next.set("forceDie", true);
				next.set("includeOut", true);
				next._trigger = trigger;
				next.triggername = event.triggername;
				next.skillHidden = event.skillHidden;
				next.indexedData = event.indexedData;
				if (info.forceDie) {
					next.forceDie = true;
				}
				if (info.forceOut) {
					next.includeOut = true;
				}
					next.skill = skill;
					next.setContent(info.cost);

				result = normalizeSelectionResult(await next.forResult());
			} else {
				if (checkFrequent(info)) {
					event.frequentSkill = true;
				}
				let str;
				const check = info.check;
				if (info.prompt) {
					str = info.prompt;
				} else if (typeof info.logTarget == "string") {
					const logTarget = trigger[info.logTarget];
					str = logTarget && !Array.isArray(logTarget) && typeof logTarget !== "string" ? get.prompt(skill, logTarget, player) : get.prompt(skill, undefined, player);
				} else if (typeof info.logTarget == "function") {
					const logTarget = info.logTarget(trigger, player, event.triggername, event.indexedData);
					if (logTarget && !Array.isArray(logTarget) && typeof logTarget !== "string") {
						str = get.prompt(skill, logTarget, player);
					} else {
						str = get.prompt(skill, undefined, player);
					}
				} else {
					str = get.prompt(skill, undefined, player);
				}
				if (typeof str == "function") {
					str = str(trigger, player, event.triggername, event.indexedData);
				}

				const next = player.chooseBool(str);
				if (event.frequentSkill) {
					next.set("frequentSkill", skill);
				}
				next.set("forceDie", true);
				next.set("includeOut", true);
				next.set("ai", () => !check || check(trigger, player, event.triggername, event.indexedData));

				if (typeof info.prompt2 == "function") {
					next.set("prompt2", info.prompt2(trigger, player, event.triggername, event.indexedData));
				} else if (typeof info.prompt2 == "string") {
					next.set("prompt2", info.prompt2);
				} else if (info.prompt2 != false) {
					if (lib.dynamicTranslate[skill]) {
						next.set("prompt2", lib.dynamicTranslate[skill](player, skill));
					} else if (lib.translate[`${skill}_info`]) {
						next.set("prompt2", lib.translate[`${skill}_info`]);
					}
				}

				if (trigger.skillwarn) {
					if (next.prompt2) {
						next.set("prompt2", `<span class="thundertext">${trigger.skillwarn}。</span>${next.prompt2}`);
					} else {
						next.set("prompt2", trigger.skillwarn);
					}
				}

				result = normalizeSelectionResult(await next.forResult());
				}
		}
		skill = requireSkill();

		if (typeof result !== "string" && result.control) {
			result.bool = !result.control.includes("cancel");
		}
		if (typeof result === "string" || !result.bool) {
			if (info.oncancel) {
				info.oncancel(trigger, player);
			}
			if (event.indexedData === true) {
				event.result = "cancelled";
			}
			return;
		}

		let autodelay = info.autodelay;
		if (typeof autodelay == "function") {
			autodelay = autodelay(trigger, player);
		}
		if (autodelay && (info.forced || !event.isMine())) {
			if (typeof autodelay == "number") {
				await game.delayx(autodelay);
			} else {
				await game.delayx();
			}
		}
		skill = requireSkill();

		let targets: Player | Player[] | null | undefined = null;
		if (Array.isArray(result.targets) && result.targets.length > 0) {
			targets = result.targets.slice(0);
		} else if (info.logTarget) {
			if (typeof info.logTarget === "string") {
				const logTarget = trigger[info.logTarget];
				if (Array.isArray(logTarget)) {
					targets = logTarget;
				} else if (logTarget && typeof logTarget !== "string") {
					targets = logTarget;
				}
			} else if (typeof info.logTarget === "function") {
				const logTarget = info.logTarget(trigger, player, event.triggername, event.indexedData);
				if (Array.isArray(logTarget)) {
					targets = logTarget;
				} else if (logTarget && typeof logTarget !== "string") {
					targets = logTarget;
				}
			}
		}
		if (targets && !Array.isArray(targets)) {
			targets = [targets];
		}
		if (info.popup != false && !info.direct && !("skill_popup" in result && !result["skill_popup"])) {
			const popup_info = typeof info.popup === "string" ? [skill, info.popup] : skill;
			const args = [trigger, player, event.triggername, event.indexedData, result];
			player.logSkill(popup_info, info.logLine === false ? null : targets, info.line, null, args);
		}
		if (info.usable !== undefined) {
			player.getStat("triggerSkill")[skill] ??= 0;
			player.getStat("triggerSkill")[skill]++;
		}

		const finalizeTrigger = async () => {
			const finalizedSkill = requireSkill();
			if (finalizedSkill.startsWith("player_when_")) {
				player.removeSkill(finalizedSkill);
				game.broadcastAll(skill => {
					delete lib.skill[skill];
					delete lib.translate[skill];
				}, finalizedSkill);
			}
			if (!player._hookTrigger) {
				return;
			}
			if (
				player._hookTrigger.some(i => {
					const info = requireRegisteredSkill(lib.skill, i).hookTrigger;
					return info && info.after && info.after(event, player, event.triggername);
				})
			) {
				await event.trigger("triggerAfter");
			}
		};
		if (!info.content) {
			await finalizeTrigger();
			return;
		}
		const next = game.createEvent(skill);
		next.player = player;
		next._trigger = trigger;
		next.triggername = event.triggername;
		next.setContent(info.content);

		next.skillHidden = event.skillHidden;
		if (info.forceDie) {
			next.forceDie = true;
		}
		if (info.forceOut) {
			next.includeOut = true;
		}
		//传入数据
		if (Array.isArray(targets)) {
			next.targets = targets.slice(0);
		}
		if (typeof result !== "string" && Array.isArray(result.cards)) {
			next.cards = result.cards.slice(0);
		}
		//语法糖部分
		if (typeof result !== "string" && result.cost_data !== undefined) {
			next.cost_data = result.cost_data;
		}
		next.indexedData = event.indexedData;

		await next;

		await finalizeTrigger();
	},
	async playVideoContent(event, trigger, player) {
		await game.delay(0, 500);

		if (!game.chess) {
			ui.control.innerHTML = "";
			const nodes = [...ui.arena.childNodes];
			for (const node of nodes) {
				if (node == ui.canvas) {
					continue;
				}
				if (node == ui.control) {
					continue;
				}
				if (node == ui.mebg) {
					continue;
				}
				if (node == ui.me) {
					continue;
				}
				if (node == ui.roundmenu) {
					continue;
				}
				node.remove();
			}
			ui.sidebar.innerHTML = "";
			ui.cardPile.innerHTML = "";
			ui.discardPile.innerHTML = "";
			ui.special.innerHTML = "";
			ui.ordering.innerHTML = "";
		}

		const systemFirst = ui.system.firstElementChild;
		const systemLast = ui.system.lastElementChild;
		if (!(systemFirst instanceof HTMLElement) || !(systemLast instanceof HTMLElement)) {
			return;
		}
		systemFirst.innerHTML = "";
		systemLast.innerHTML = "";
		systemFirst.appendChild(ui.config2);
		if (ui.updateVideoMenu) {
			ui.updateVideoMenu();
		}

		_status.videoDuration = 1 / parseFloat(lib.config.video_default_play_speed.slice(0, -1));
		ui.create.system("返回", () => {
			const mode = localStorage.getItem(`${lib.configprefix}playbackmode`);
			if (mode) {
				game.saveConfig("mode", mode);
			}
			game.reload();
		});
		ui.create.system("重播", () => {
			_status.replayvideo = true;
			const mode = lib.config.mode;
			const playback = _status.playback;
			if (mode && playback) {
				game.playVideo(playback, mode);
			}
		});
		ui.create.system("暂停", ui.click.pause, true).id = "pausebutton";
		const atempo = ui.create.system(
			"原速",
			() => {
				_status.videoDuration = 1;
				updateDuration();
			},
			true
		);
		const slow = ui.create.system(
			"减速",
			() => {
				_status.videoDuration *= 1.5;
				updateDuration();
			},
			true
		);
		const fast = ui.create.system(
			"加速",
			() => {
				_status.videoDuration /= 1.5;
				updateDuration();
			},
			true
		);
		const updateDuration = () => {
			atempo.innerHTML = `原速(当前${Math.round(100 / _status.videoDuration) / 100}倍速)`;
			if (_status.videoDuration > 1) {
				slow.classList.add("glow");
			} else {
				slow.classList.remove("glow");
			}
			if (_status.videoDuration < 1) {
				fast.classList.add("glow");
			} else {
				fast.classList.remove("glow");
			}
		};
		updateDuration();
		ui.system.style.display = "";
		ui.refresh(ui.system);
		ui.system.show();
		ui.window.show();
		if (lib.config.mode != "versus" && lib.config.mode != "boss") {
			ui.arena.style.display = "";
			ui.refresh(ui.arena);
			ui.arena.show();
		}
		if (!game.chess) {
			game.playerMap = {};
		}
		game.finishCards();

		// 不确定，但录像年久失修，还是加上吧
		await event.waitNext();

		while (event.video.length) {
			const content = event.video.shift();
			// console.log(content);
			if (content.type == "delay") {
				await game.delay(content.content);
			} else if (content.type == "play") {
				window.play = {};
				if (!event.playtoload) {
					event.playtoload = 1;
				} else {
					event.playtoload++;
				}
				const script = lib.init.js(`${lib.assetURL}play`, content.name);
				let cleaned = false;
				const cleanup = () => {
					if (cleaned) {
						return;
					}
					cleaned = true;
					if (event.playtoload > 0) {
						event.playtoload--;
					}
					if (event.playtoload == 0) {
						delete window.play;
					}
				};
				if (!script) {
					cleanup();
					continue;
				}
				script.addEventListener("load", () => {
					const play = window.play;
					const video = play?.[content.name];
					try {
						video?.video?.(content.init);
					} finally {
						cleanup();
					}
				}, { once: true });
				script.addEventListener("error", cleanup, { once: true });
			} else if (typeof content.player == "string" && game.playerMap[content.player] && game.playerMap[content.player].classList && !game.playerMap[content.player].classList.contains("obstacle")) {
				await game.videoContent[content.type](game.playerMap[content.player], content.content);
			} else {
				await game.videoContent[content.type](content.content);
			}
			if (event.video.length) {
				await game.delay(0, _status.videoDuration * Math.min(2000, event.video[0].delay));
			}

			// 同上，~~早知道不改成Async Content了~~
			await event.waitNext();
		}

		_status.over = true;
		const finalSystem = ui.system.lastElementChild;
		if (finalSystem && "hide" in finalSystem && typeof finalSystem.hide === "function") {
			finalSystem.hide();
			delay(500).then(() => void (finalSystem.innerHTML = ""));
		}
	},
	async waitForPlayer(event, trigger, player) {
		ui.auto.hide();
		ui.pause.hide();

		game.createServer();
		if (!lib.translate.zhu) {
			lib.translate.zhu = "主";
		}
		if (event.func) {
			event.func();
		}
		if (!lib.configOL.number) {
			lib.configOL.number = parseInt(lib.configOL.player_number);
		}
		if (game.onlineroom) {
			game.send("server", "config", lib.configOL);
		}

		ui.create.connectPlayers(game.ip);

		const connectPlayers = game.connectPlayers;
		if (!connectPlayers) {
			return;
		}
		const me = connectPlayers[0];
		me.setIdentity("zhu");
		me.initOL(get.connectNickname(), lib.config.connect_avatar);
		me.playerid = "1";
		game.onlinezhu = "1";
		_status.waitingForPlayer = true;

		await game.pause();

		_status.waitingForPlayer = false;
		lib.configOL.gameStarted = true;
		if (game.onlineroom) {
			game.send("server", "config", lib.configOL);
		}
		for (const player of connectPlayers) {
			player.delete();
		}
		delete game.connectPlayers;
		if (ui.roomInfo) {
			ui.roomInfo.remove();
			delete ui.roomInfo;
		}
		if (ui.exitroom) {
			ui.exitroom.remove();
			delete ui.exitroom;
		}
		game.broadcast("gameStart");
		game.delay(2);
		ui.auto.show();
		ui.pause.show();
		if (lib.config.show_cardpile) {
			ui.cardPileButton.style.display = "";
		}
		if (lib.config.show_commonCardpile) {
			ui.commonCardPileButton.style.display = "";
		}
	},
	async replaceHandcards(event, trigger, player) {
		const currentMe = game.me;
		if (!currentMe || !event.getPlayers().includes(currentMe)) {
			return;
		}

		const result = await currentMe.chooseBool({ prompt: "是否置换手牌？" }).forResult();
		if (result && typeof result !== "string" && result.bool) {
			/*otherPile主要是针对那些用专属牌堆，不从一般牌堆摸牌的角色（如陈寿），该属性目前只有两个键值对，且都为函数
			 *getCards函数与获得牌相关，只传入要获得的牌数num作为参数
			 *discard与手气卡换牌后弃置牌相关，只传入要弃置的牌card作为参数
			 */
			const playerid = game.getMe().playerid;
			const hs = game.getMe().getCards("h");
			const cards: Card[] = [];
			const pileConfig = typeof playerid == "string" ? event.otherPile?.[playerid] : undefined;
			const otherGetCards = pileConfig?.getCards;
			const otherDiscacrd = pileConfig?.discard;
			//先弃牌
			game.addVideo("lose", game.getMe(), [get.cardsInfo(hs), [], [], []]);
			for (const card of hs) {
				card.removeGaintag(true);
				if (otherDiscacrd) {
					otherDiscacrd(card);
				} else {
					card.discard(false);
				}
			}
			//再摸牌，先看有没有专属牌堆
			if (otherGetCards) {
				cards.addArray(otherGetCards(hs.length));
			} else {
				cards.addArray(get.cards(hs.length));
			}
			//添加标记相关
			//event.gaintag支持函数、字符串、数组。数组就是添加一连串的标记；函数的返回格式为[[cards1,gaintag1],[cards2,gaintag2]...]
			if (typeof playerid == "string" && event.gaintag?.[playerid]) {
				const gaintag = event.gaintag[playerid];
				const list = typeof gaintag == "function" ? gaintag(hs.length, cards) : [[cards, gaintag]];
				for (let i = list.length - 1; i >= 0; i--) {
					game.getMe().directgain(list[i][0], null, list[i][1]);
				}
			} else {
				game.getMe().directgain(cards);
			}
			game.getMe()._start_cards = cards;
		}
	},
	async replaceHandcardsOL(event, trigger, player) {
		const chooseRemote = () => {
			game.getMe().chooseBool({ prompt: "是否置换手牌？" });
			game.resume();
		};
		const chooseMe = () => {
			return game.getMe().chooseBool({ prompt: "是否置换手牌？" });
		};
		const choose = (current: Player) => {
			return new Promise<boolean>(resolve => {
				if (current.isOnline()) {
					current.wait(result => resolve(!!result?.bool));
					current.send(chooseRemote);
					return;
				} else if (current === game.me) {
					const next = chooseMe();
					game.getMe().wait(result => resolve(!!result?.bool));
					next.forResult()
						.then(result => game.getMe().unwait(result))
						.catch(() => resolve(false));
				} else {
					resolve(false);
				}
			});
		};

		const events = event.getPlayers().map(async (current: Player & { playerid?: string }) => {
			const result = await choose(current);

			if (!result) {
				return;
			}

			/*otherPile主要是针对那些用专属牌堆，不从一般牌堆摸牌的角色（如陈寿），该属性目前只有两个键值对，且都为函数
			 *getCards函数与获得牌相关，只传入要获得的牌数num作为参数
			 *discard与手气卡换牌后弃置牌相关，只传入要弃置的牌card作为参数
			 */
			const hs = current.getCards("h");
			const cards: Card[] = [];
			const playerid = current.playerid;
			const otherGetCards = playerid === undefined ? undefined : event.otherPile?.[playerid]?.getCards;
			const otherDiscard = playerid === undefined ? undefined : event.otherPile?.[playerid]?.discard;
			//先弃牌
			game.broadcastAll(
				(player, hs, otherDiscard) => {
					game.addVideo("lose", player, [get.cardsInfo(hs), [], [], []]);
					for (const card of hs) {
						card.removeGaintag(true);
						if (otherDiscard) {
							otherDiscard(card);
						} else {
							card.discard(false);
						}
					}
				},
				current,
				hs,
				otherDiscard
			);
			//再摸牌，先看有没有专属牌堆
			if (otherGetCards) {
				cards.addArray(otherGetCards(hs.length));
			} else {
				cards.addArray(get.cards(hs.length));
			}
			//添加标记相关
			//event.gaintag支持函数、字符串、数组。数组就是添加一连串的标记；函数的返回格式为[[cards1,gaintag1],[cards2,gaintag2]...]
			if (playerid !== undefined && event.gaintag?.[playerid]) {
				const gaintag = event.gaintag[playerid];
				const list = typeof gaintag == "function" ? gaintag(hs.length, cards) : [[cards, gaintag]];
				game.broadcastAll(
					(player, list) => {
						for (let i = list.length - 1; i >= 0; i--) {
							player.directgain(list[i][0], null, list[i][1]);
						}
					},
					current,
					list
				);
			} else {
				current.directgain(cards);
			}
			current._start_cards = cards;
		});
		await Promise.allSettled(events);
	},
	phase: [
		async (event, trigger, player) => {
			//规则集中的“回合开始后③（处理“游戏开始时”的时机）”
			//提前phaseBefore时机解决“游戏开始时”时机和“一轮开始时”先后
			await event.trigger("phaseBefore");
		},
		async (event, trigger, player) => {
			game.phaseNumber++;
			//初始化阶段列表
			event.phaseList ??= ["phaseZhunbei", "phaseJudge", "phaseDraw", "phaseUse", "phaseDiscard", "phaseJieshu"];
			if (typeof event.num != "number") {
				event.num = 0;
			}
			//规则集中的“回合开始后①”，更新游戏轮数，触发“一轮游戏开始时”
			let isRound: boolean | undefined = false;
			if (lib.onround.every((onRound: (event: GameEvent, player?: Player) => boolean) => onRound(event, player))) {
				isRound = _status.roundSkipped;
				if (_status.isRoundFilter) {
					isRound = _status.isRoundFilter(event, player);
				} else if (_status.seatNumSettled) {
					const seatNum = player.getSeatNum();
					if (seatNum != 0) {
						const lastPhasedPlayer = _status.lastPhasedPlayer;
						if (!lastPhasedPlayer || get.itemtype(lastPhasedPlayer) != "player" || seatNum < lastPhasedPlayer.getSeatNum()) {
							isRound = true;
						}
						_status.lastPhasedPlayer = player;
					}
				} else if (player == _status.roundStart) {
					isRound = true;
				}
				if (isRound) {
					delete _status.roundSkipped;
					game.roundNumber++;
					event._roundStart = true;
					game.updateRoundNumber();
					for (const current of game.players) {
						if (current.isOut() && current.outCount > 0) {
							current.outCount--;
							if (current.outCount == 0 && !current.outSkills) {
								current.in();
							}
						}
					}
					//await event.trigger("roundStart");
				}
			}
			_status.globalHistory.push({
				cardMove: [],
				custom: [],
				useCard: [],
				changeHp: [],
				everything: [],
			});
			const players = game.players.slice(0).concat(game.dead);
			for (const current of players) {
				current.actionHistory.push({
					useCard: [],
					respond: [],
					skipped: [],
					lose: [],
					gain: [],
					sourceDamage: [],
					damage: [],
					custom: [],
					useSkill: [],
				});
				current.stat.push({ card: {}, skill: {}, triggerSkill: {} });
				if (isRound) {
					current.getHistory().isRound = true;
					current.getStat().isRound = true;
				}
			}
			if (isRound) {
				const globalHistory: GameHistory & { isRound?: boolean } = game.getGlobalHistory();
				globalHistory.isRound = true;
				await event.trigger("roundStart");
			}
		},
		async (event, trigger, player) => {
			//规则集中的“回合开始后②（1v1武将登场专用）”
			await event.trigger("phaseBeforeStart");
		},
		async (event, trigger, player) => {
			//规则集中的“回合开始后④（卑弥呼〖纵傀〗的时机）”
			await event.trigger("phaseBeforeEnd");
		},
		async (event, trigger, player) => {
			//规则集中的“回合开始后⑤”，进行翻面检测
			if (player.isTurnedOver() && !event._noTurnOver) {
				const next = player.turnOver();
				player.phaseSkipped = true;
				const players = game.players.slice(0).concat(game.dead);
				for (const current of players) {
					current.getHistory().isSkipped = true;
					current.getStat().isSkipped = true;
				}
				event.cancel();
				return next.forResult();
			} else {
				player.phaseSkipped = false;
				player.getHistory().isMe = true;
				player.getStat().isMe = true;
			}
		},
		async (event, trigger, player) => {
			//规则集中的“回合开始后⑥”，更新“当前回合角色”
			while (ui.dialogs.length) {
				ui.dialogs[0].close();
			}
			player.phaseNumber++;
			game.broadcastAll(
				(player, num, popup) => {
					if (lib.config.glow_phase) {
						player.classList.add("glow_phase");
					}
					player.phaseNumber = num;
					_status.currentPhase = player;
					if (popup && lib.config.show_phase_prompt) {
						player.popup("回合开始", undefined, false);
					}
				},
				player,
				player.phaseNumber,
				!player.noPhaseDelay
			);
			_status.currentPhase = player;
			_status.discarded = [];
			game.syncState();
			game.addVideo("phaseChange", player);
			if (game.phaseNumber >= 1 && !lib.configOL.observeReady) {
				if (lib.configOL.observe) {
					lib.configOL.observeReady = true;
					game.send("server", "config", lib.configOL);
				}
			}
			game.log();
			const skill = event.skill && get.sourceSkillFor(event.skill);
			game.log(player, "的", skill ? `#y【${get.translation(skill)}】` : "", "回合开始");
			player._noVibrate = true;
			if (get.config("identity_mode") != "zhong" && get.config("identity_mode") != "purple" && !_status.connectMode) {
				let num;
				switch (get.config("auto_identity")) {
					case "one":
						num = 1;
						break;
					case "two":
						num = 2;
						break;
					case "three":
						num = 3;
						break;
					case "always":
						num = -1;
						break;
					default:
						num = 0;
						break;
				}
				if (num && !_status.identityShown && game.phaseNumber > game.players.length * num && game.showIdentity) {
					if (!_status.video) {
						player.popup("显示身份");
					}
					_status.identityShown = true;
					game.showIdentity(false);
				}
			}
			player.ai.tempIgnore = [];
			if (ui.land && ui.land.player == player) {
				game.addVideo("destroyLand");
				ui.land.destroy();
			}
		},
		async (event, trigger, player) => {
			//规则集中的“回合开始后⑦”，国战武将明置武将牌
			await event.trigger("phaseBeginStart");
		},
		async (event, trigger, player) => {
			//规则集中的“回合开始后⑨”，进行当先，化身等操作
			//没有⑧ 因为⑧用不到
			await event.trigger("phaseBegin");
		},
		//阶段部分
		async (event, trigger, player) => {
			// phase 的第一步会将 num 初始化为 0；这里保留旧的数值运算语义，
			// 仅让未初始化的动态事件继续按 JavaScript 的 NaN 路径执行。
			const num = Number(event.num);
			if (num < event.phaseList.length) {
				//规则集中没有的新时机 可以用来插入额外阶段啥的
				if (player.isIn()) {
					await event.trigger("phaseChange");
				}
			} else {
				event.goto(11);
			}
		},
		async (event, trigger, player) => {
			const num = Number(event.num);

			if (!player.isIn() || num >= event.phaseList.length) {
				return;
			}

			const list = event.phaseList[num].split("|");
			const phase = list[0].split("-");
			let skip = false;
			if (phase[0].startsWith("skip")) {
				event.currentPhase = `phase${phase[0].slice(4)}`;
				skip = true;
			} else {
				event.currentPhase = phase[0];
			}
			const next = player[event.currentPhase]();
			next.phaseIndex = num;
			if (list.length > 1) {
				next._extraPhaseReason = list[1];
			}
			if (skip) {
				next.isSkipped = true;
				if (phase.length > 1) {
					next._skipPhaseReason = phase[1];
				}
				game.log(player, "跳过了", event.currentPhase);
			}
			if (event.currentPhase == "phaseDraw" || event.currentPhase == "phaseDiscard") {
				if (!player.noPhaseDelay) {
					if (player == game.me) {
						await game.delay();
					} else {
						await game.delayx();
					}
				}
			}

			return next.forResult();
		},
		async (event, trigger, player) => {
			if (event.currentPhase == "phaseUse") {
				game.broadcastAll(() => {
					if (ui.tempnowuxie) {
						ui.tempnowuxie.close();
						delete ui.tempnowuxie;
					}
				});
				delete player._noSkill;
			}
			event.num = Number(event.num) + 1;
		},
		async (event, trigger, player) => {
			if (Number(event.num) < event.phaseList.length) {
				event.goto(8);
			} else if (!event._phaseEndTriggered) {
				event._phaseEndTriggered = true;
				event.redo();
				await event.trigger("phaseEnd");
			}
		},
		async (event, trigger, player) => {
			await event.trigger("phaseAfter");
		},
		async (event, trigger, player) => {
			//删除当前回合角色 此时处于“不属于任何角色的回合”的阶段
			game.broadcastAll(player => {
				player.classList.remove("glow_phase");
				delete _status.currentPhase;
			}, player);
		},
	],
	async phaseZhunbei(event, trigger, player) {
		game.log(player, "进入了准备阶段");
		await event.trigger(event.name);
	},
	phaseJudge: [
		async (event, trigger, player) => {
			game.log(player, "进入了判定阶段");
			event.cards = player.getCards("j");
		},
		async (event, trigger, player) => {
			if (!event.cards.length) {
				event.finish();
				return;
			}
			const card = event.cards.shift();
			if (!card) {
				event.finish();
				return;
			}
			event.card = card;
			const cardName = card.name;
			const cardInfo = lib.card[cardName];
			const cardSymbol = card.cardSymbol;
			const VJudge = cardSymbol === undefined ? undefined : card[cardSymbol];
			if (cardInfo.noEffect || !player.getCards("j").includes(card)) {
				event.redo();
			} else {
				await player.lose(card, "visible", ui.ordering);
				player.$phaseJudge(card);
				event.cancelled = false;
				await event.trigger("phaseJudge");
				player.popup(cardName, "thunder");
				if (!cardInfo.effect) {
					await game.delay();
					event.redo();
				} else if (!cardInfo.judge) {
					await game.delay();
					event.nojudge = true;
				} else {
					event.nojudge = false;
				}
			}
		},
		async (event, trigger, player) => {
			if (!event.cancelled && !event.nojudge) {
				const card = event.card;
				if (!(card instanceof lib.element.Card)) {
					return;
				}
				event.result = await player.judge({ card }).set("type", "phase").forResult();
			}
		},
		async (event, trigger, player) => {
			const name = event.card.name;
			const cardSymbol = event.card.cardSymbol;
			const VJudge = cardSymbol === undefined ? undefined : event.card[cardSymbol];
			if (event.excluded) {
				delete event.excluded;
			} else if (event.cancelled && !event.direct) {
				if (lib.card[name].cancel) {
					const next = game.createEvent(`${name}Cancel`);
					next.setContent(lib.card[name].cancel);
					next.card = VJudge;
					next.cards = VJudge?.cards ?? [];
					next.player = player;
					await next;
				}
			} else {
				const next = game.createEvent(name);
				next.setContent(lib.card[name].effect);
				next._result = event.result;
				next.card = VJudge;
				next.cards = VJudge?.cards ?? [];
				next.player = player;
				await next;
			}
			ui.clear();
			event.goto(1);
		},
	],
	phaseDraw: [
		async event => {
			game.log(event.player, "进入了摸牌阶段");
			await event.trigger("phaseDrawBegin1");
		},
		async event => {
			await event.trigger("phaseDrawBegin2");
		},
		async (event, trigger, player) => {
			if (game.modPhaseDraw) {
				return game.modPhaseDraw(player, event.num);
			} else {
				const eventNum = Number(event.num);
				if (eventNum > 0) {
					let num = eventNum;

					if (event.attachDraw) {
						for (const card of event.attachDraw) {
							ui.cardPile.insertBefore(card, ui.cardPile.firstChild);
						}
						num += event.attachDraw.length;
					}

					const next = player.draw(num);
					if (event.attachDraw) {
						next.minnum = event.attachDraw.length;
					}
					return next.forResult();
				}
			}
		},
		async (event, trigger, player, result) => {
			if (result.bool && result.cards) {
				event.cards = result.cards;
			}
		},
	],
	phaseUse: [
		async (event, trigger, player) => {
			const stat = player.getStat();
			for (const skill in stat.skill) {
				let bool = false;
				const info = getRegisteredSkill(lib.skill, skill);
				if (!info) {
					continue;
				}
				if (info.enable != undefined) {
					if (typeof info.enable == "string" && info.enable == "phaseUse") {
						bool = true;
					} else if (typeof info.enable == "object" && info.enable.includes("phaseUse")) {
						bool = true;
					}
				}
				if (bool) {
					stat.skill[skill] = 0;
				}
			}
			for (const card in stat.card) {
				const bool = false;
				const info = lib.card[card];
				if (!info) {
					continue;
				}
				if (info.updateUsable == "phaseUse") {
					stat.card[card] = 0;
				}
			}
		},
		async (event, trigger, player) => {
			await event.trigger("phaseUseBefore");
		},
		async (event, trigger, player) => {
			await event.trigger("phaseUseBegin");
		},
		async (event, trigger, player) => {
			if (!event.logged) {
				game.log(player, "进入了出牌阶段");
				event.logged = true;
			}
			const next = player.chooseToUse();
			if (!lib.config.show_phaseuse_prompt) {
				next.set("prompt", false);
			}
			next.set("type", "phase");
			return next.forResult();
		},
		async (event, trigger, player, result) => {
			if (result.bool && !event.skipped) {
				event.goto(3);
			}
			game.broadcastAll(() => {
				if (ui.tempnowuxie) {
					ui.tempnowuxie.close();
					delete ui.tempnowuxie;
				}
			});
		},
		async (event, trigger, player) => {
			await event.trigger("phaseUseEnd");
		},
		async (event, trigger, player) => {
			await event.trigger("phaseUseAfter");
		},
	],
	phaseDiscard: [
		async (event, trigger, player) => {
			game.log(player, "进入了弃牌阶段");
			event.num = player.needsToDiscard();
			if (event.num <= 0) {
				event.finish();
				return;
			} else {
				game.broadcastAll(player => {
					if (lib.config.show_phase_prompt) {
					player.popup("弃牌阶段", undefined, false);
					}
				}, player);
			}
			await event.trigger("phaseDiscard");
		},
		async (event, trigger, player) => {
			const num = Number(event.num);
			return player.chooseToDiscard({ selectCard: [num, num], forced: true, useCache: true, allowChooseAll: true }).forResult();
		},
		async (event, trigger, player, result) => {
			if (result.bool && result.cards) {
				event.cards = result.cards;
			}
		},
	],
	async phaseJieshu(event, trigger, player) {
		game.log(player, "进入了结束阶段");
		await event.trigger(event.name);
	},
	chooseToUse: [
		async (event, trigger, player) => {
			if (event.responded) {
				return;
			}
			if (game.modeSwapPlayer && !_status.auto && player.isUnderControl() && !lib.filter.wuxieSwap(event)) {
				game.modeSwapPlayer(player);
			}
			const skills = player.getSkills("invisible").concat(lib.skill.global);
			game.expandSkills(skills);
			for (const name of skills) {
				const info = getRegisteredSkill(lib.skill, name);
				if (info && info.onChooseToUse) {
					info.onChooseToUse(event);
				}
			}
			if (_status.noclearcountdown !== "direct") {
				_status.noclearcountdown = true;
			}
			if (event.type == "phase") {
				if (event.isMine()) {
					event.endButton = ui.create.control("结束回合", "stayleft", () => {
						const evt = _status.event;
						if (evt.name != "chooseToUse" || evt.type != "phase") {
							return;
						}
						if (evt.skill) {
							ui.click.cancel();
						}
						ui.click.cancel();
					});
					event.fakeforce = true;
				} else {
					if (event.endButton) {
						event.endButton.close();
						delete event.endButton;
					}
					event.fakeforce = false;
				}
			}
			if (event.getPlayer().isUnderControl() && !_status.auto) {
				event.result = {
					bool: false,
				};
				return;
			} else if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				}
				if (event.type == "wuxie") {
					if (ui.tempnowuxie) {
						const triggerevent = event.getTrigger();
						if (triggerevent && triggerevent.targets && triggerevent.num == triggerevent.targets.length - 1) {
							ui.tempnowuxie.close();
						}
					}
					if (lib.filter.wuxieSwap(event)) {
						event.result = {
							bool: false,
						};
						return;
					}
				}
				const ok = game.check();
				const cardinfo = get.info(get.card()) || {};
				const skillinfo = event.skill ? get.info(event.skill) : undefined;
				if (!ok || !lib.config.auto_confirm || cardinfo?.manualConfirm || skillinfo?.manualConfirm) {
					game.pause();
					if (lib.config.enable_vibrate && player._noVibrate) {
						delete player._noVibrate;
						game.vibrate();
					}
					if (typeof event.prompt == "string") {
						if (event.openskilldialog) {
							event.skillDialog = ui.create.dialog(event.openskilldialog);
							delete event.openskilldialog;
							event.dialog = event.prompt;
						} else {
							event.dialog = ui.create.dialog(event.prompt);
							if (event.prompt2) {
								event.dialog.addText(event.prompt2);
							}
						}
					} else if (typeof event.prompt == "function") {
						event.dialog = ui.create.dialog(event.prompt(event));
					} else if (event.prompt == undefined) {
						let str;
						if (typeof event.filterCard == "object") {
							const filter = event.filterCard;
							str = `请使用${get.cnNumber(event.selectCard[0])}张`;
							if (filter.name) {
								str += get.translation(filter.name);
							} else {
								str += "牌";
							}
						} else {
							str = "请选择要使用的牌";
						}
						if (event.openskilldialog) {
							event.skillDialog = ui.create.dialog(event.openskilldialog);
							delete event.openskilldialog;
							event.dialog = str;
						} else if (typeof event.skillDialog != "string") {
							event.dialog = ui.create.dialog(str);
						} else {
							event.dialog = str;
						}
					}
				} else {
					delete event.openskilldialog;
				}
			} else if (event.isOnline()) {
				event.send();
			} else {
				event.result = "ai";
			}
		},
			async (event, trigger, player) => {
				const { forced } = event;

				if (event.result != "ai") {
					return;
				}

				// LLM 失败或拒绝该事件时保持既有本地 AI 降级。
				if (await applyLLMDecision(event)) {
					return;
				}

				const ok = game.check();
				if (ok) {
					ui.click.ok();
				} else if (ai.basic.chooseCard(event.ai1) || forced) {
						if ((ai.basic.chooseTarget(event.ai2) || forced) && (!event.filterOk || event.filterOk())) {
							ui.click.ok();
							event._aiexcludeclear = true;
						} else {
							if (!event.norestore) {
								if (event.skill) {
									const skill = event.skill;
									ui.click.cancel();
									event._aiexclude.add(skill);
									const info = get.info(skill);
									if (info.sourceSkill) {
										event._aiexclude.add(info.sourceSkill);
									}
								} else {
									get.card(true).aiexclude();
									game.uncheck();
								}
								event.redo();
								game.resume();
							} else {
								ui.click.cancel();
							}
						}
					} else if (event.skill && !event.norestore) {
						const skill = event.skill;
						ui.click.cancel();
						event._aiexclude.add(skill);
						const info = get.info(skill);
						if (info.sourceSkill) {
							event._aiexclude.add(info.sourceSkill);
						}
						event.redo();
						game.resume();
					} else {
						ui.click.cancel();
					}
					const result: EventResult = event.result;
					const hasBoolResult = (value: EventResult): value is Partial<Result> => typeof value == "object" && value != null && "bool" in value;
					if (event.aidelay && hasBoolResult(result) && result.bool) {
						await game.delayx();
					}
				},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event.endButton) {
				event.endButton.close();
				delete event.endButton;
			}
			event.resume();

			if (!event.result) {
				return;
			}

			if (event.result._sendskill) {
				lib.skill[event.result._sendskill[0]] = event.result._sendskill[1];
			}

			if (typeof event.result.skill !== "string" || !event.result.skill) {
				return;
			}

				const info = get.info(event.result.skill);
				if (info && info.chooseButton) {
					const chooseButton = info.chooseButton;
					if (event.dialog && typeof event.dialog == "object") {
						event.dialog.close();
					}
					const dialogFactory = chooseButton.dialog;
					const dialog = typeof dialogFactory == "function" ? dialogFactory(event, player) : dialogFactory;
					if (!dialog) {
						event.result = { bool: false };
						return;
					}

					let next;
					if (chooseButton.chooseControl) {
						next = player.chooseControl({ controls: chooseButton.chooseControl(event, player) });
					if (dialog.direct) {
						next.direct = true;
					}
					if (dialog.forceDirect) {
						next.forceDirect = true;
					}
					next.dialog = dialog;
						next.set("ai", chooseButton.check || (() => 0));
					if (event.id) {
						next._parent_id = event.id;
					}
					next.type = "chooseToUse_button";
				} else {
					next = player.chooseButton(dialog);
					if (dialog.direct) {
						next.direct = true;
					}
					if (dialog.forceDirect) {
						next.forceDirect = true;
					}
						next.set("ai", chooseButton.check || (() => 1));
						next.set("filterButton", chooseButton.filter || (() => true));
						next.set("selectButton", chooseButton.select || 1);
						next.set(
							"complexSelect",
							(() => {
								if (chooseButton.complexSelect !== false) {
									if (chooseButton.complexSelect === undefined && chooseButton.allowChooseAll === true) {
									// 如果complexSelect没有被显式的定义但是全选被显式要求了，那么我们默认认为调用者需要全选而不是complexSelect喵
									return false;
								} else {
									return true;
								}
							}
							return false;
							})()
						);
						next.set("filterOk", chooseButton.filterOk || (() => true));
						attachChooseButtonSelectionSpec(next, info, event, player);
						next.set("allowChooseAll", chooseButton.allowChooseAll);
					if (event.id) {
						next._parent_id = event.id;
					}
					next.type = "chooseToUse_button";
				}
				event.buttoned = event.result.skill;

				return next.forResult();
			} else if (info && info.precontent && !game.online && !event.nouse) {
				const next = game.createEvent(`pre_${event.result.skill}`);

				next.setContent(info.precontent);
				next.set("result", event.result);
				next.set("player", player);

				return next.forResult();
			}
		},
		async (event, trigger, player, result) => {
			if (!event.buttoned) {
				return;
			}

			if (result.bool || (result.control && result.control != "cancel2")) {
				const sourceInfo = get.info(event.buttoned);
				const info = sourceInfo?.chooseButton;
				const hasControl = typeof result.control == "string" && result.control != "cancel2";
				const links = result.links;
				const backupInput = info?.chooseControl ? result : links;
				if (!info || typeof info.backup != "function" || backupInput === undefined || (!info.chooseControl && !Array.isArray(backupInput)) || (info.chooseControl && !hasControl)) {
					event.goto(0);
					delete event.buttoned;
					return;
				}
				const backup = info.backup(backupInput, player);
				if (sourceInfo.selectionSpec !== undefined) {
					backup.selectionSpec = true;
				}
				lib.skill[`${event.buttoned}_backup`] = backup;
				backup.sourceSkill = event.buttoned;
				if (game.online) {
					event._sendskill = [`${event.buttoned}_backup`, backup];
				} else {
					game.broadcast(
						(skill, audio) => {
							let info = lib.skill[skill];
							if (!info) {
								info = {};
								lib.skill[skill] = info;
							}
							if (Array.isArray(info)) {
								throw new TypeError("A backup skill must not be an array");
							}
							info.audio = audio;
						},
						`${event.buttoned}_backup`,
						backup.audio
					);
				}
					event.backup(`${event.buttoned}_backup`);
					if (backup.selectionSpec) {
						event.selectionSpec = { finalPredicate: () => true };
					}
				if (typeof info.prompt == "function") {
					event.openskilldialog = info.prompt(backupInput, player);
				}
			} else {
				ui.control.addTempClass("nozoom", 100);
				event._aiexclude.add(event.buttoned);
			}

			event.goto(0);
			delete event.buttoned;
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event._aiexcludeclear) {
				delete event._aiexcludeclear;
				event._aiexclude.length = 0;
			}
			delete _status.noclearcountdown;
			const skillDialog = event.skillDialog;
			if (skillDialog && (typeof skillDialog == "object" || typeof skillDialog == "function") && "close" in skillDialog && typeof skillDialog.close == "function") {
				skillDialog.close();
			}
			if (event.result && event.result.bool && !game.online && !event.nouse) {
				if (event.result?.cancel) {
					event.goto(0);
				} else {
					const oldLogSkill = event.logSkill;
					if (event.chooseonly) {
						event.logSkill = false;
					}
					if (!event.chooseonly) {
						//event.done = player.useResult(event.result, event);
						const next = player.useResult(event.result, event);
					} else {
						event.result.cost_data = { result: event.result };
						if (oldLogSkill) {
							event.result.cost_data.logSkill = oldLogSkill;
						}
					}
				}
			} else if (event._sendskill) {
				event.result._sendskill = event._sendskill;
			}
				if (!event.result?.bool || event.result?._noHidingTimer) {
					const skill = getLogSkillName(event.result, event.logSkill);
					if (skill) {
						const info = get.info(skill);
						if (info.direct && !info.clearTime) {
							_status.noclearcountdown = "direct";
						}
					}
				}
			if (event.dialog && typeof event.dialog == "object") {
				event.dialog.close();
			}
			if (!_status.noclearcountdown) {
				game.stopCountChoose();
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event._result && event.result) {
				event.result.result = event._result;
			}
		},
	],
	chooseToRespond: [
		async (event, trigger, player) => {
			if (event.responded) {
				delete event.dialog;
				return;
			}

			const skills = player.getSkills("invisible").concat(lib.skill.global);
			game.expandSkills(skills);
			for (const skill of skills) {
				const info = getRegisteredSkill(lib.skill, skill);
				if (info && info.onChooseToRespond) {
					info.onChooseToRespond(event);
				}
			}
			if (_status.noclearcountdown !== "direct") {
				_status.noclearcountdown = true;
			}
			if (!_status.connectMode && lib.config.skip_shan && event.autochoose && event.autochoose()) {
				event.result = { bool: false };
			} else {
				if (game.modeSwapPlayer && !_status.auto && player.isUnderControl()) {
					game.modeSwapPlayer(player);
				}
				if (event.isMine()) {
					if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
						ui.click.cancel();
						return;
					}
					const ok = game.check();
					const cardinfo = get.info(get.card()) || {};
					const skillinfo = event.skill ? get.info(event.skill) : undefined;
					if (!ok || !lib.config.auto_confirm || cardinfo?.manualConfirm || skillinfo?.manualConfirm) {
						game.pause();
						if (event.openskilldialog) {
							event.skillDialog = ui.create.dialog(event.openskilldialog);
							delete event.openskilldialog;
							event.dialog = event.prompt;
						} else {
							if (event.prompt) {
								event.dialog = ui.create.dialog(event.prompt);
							}
							if (event.prompt2) {
								event.dialog.addText(event.prompt2);
							}
						}
					} else {
						delete event.openskilldialog;
					}
				} else if (event.isOnline()) {
					event.send();
				} else {
					event.result = "ai";
				}
			}
		},
			async (event, trigger, player) => {
				const { forced } = event;

				if (event.result != "ai") {
					return;
				}

				// LLM 失败或拒绝该事件时保持既有本地 AI 降级。
				if (await applyLLMDecision(event)) {
					return;
				}

				const ok = game.check();
				if (ok) {
					ui.click.ok();
				} else if (ai.basic.chooseCard(event.ai1 || event.ai) || forced) {
						if ((ai.basic.chooseTarget(event.ai2) || forced) && (!event.filterOk || event.filterOk())) {
							ui.click.ok();
							event._aiexcludeclear = true;
						} else {
							if (!event.norestore) {
								if (event.skill) {
									const skill = event.skill;
									ui.click.cancel();
									event._aiexclude.add(skill);
									const info = get.info(skill);
									if (info.sourceSkill) {
										event._aiexclude.add(info.sourceSkill);
									}
								} else {
									get.card(true).aiexclude();
									game.uncheck();
								}
								event.redo();
								game.resume();
							} else {
								ui.click.cancel();
							}
						}
					} else if (event.skill && !event.norestore) {
						const skill = event.skill;
						ui.click.cancel();
						event._aiexclude.add(skill);
						const info = get.info(skill);
						if (info.sourceSkill) {
							event._aiexclude.add(info.sourceSkill);
						}
						event.redo();
						game.resume();
					} else {
						ui.click.cancel();
					}
				const result: EventResult = event.result;
				const hasBoolResult = (value: EventResult): value is Partial<Result> => typeof value == "object" && value != null && "bool" in value;
				if (event.aidelay && hasBoolResult(result) && result.bool) {
						game.delayx();
					}
				},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			event.resume();
			if (!event.result) {
				return;
			}

			if (event.result._sendskill) {
				lib.skill[event.result._sendskill[0]] = event.result._sendskill[1];
			}
			if (typeof event.result.skill === "string" && event.result.skill) {
				const info = get.info(event.result.skill);
				if (info && info.chooseButton) {
					if (event.dialog && typeof event.dialog == "object") {
						event.dialog.close();
					}
					const chooseButton = info.chooseButton;
					if (typeof chooseButton.dialog != "function") {
						return;
					}
					const dialog = chooseButton.dialog(event, player);

					let next;
					if (chooseButton.chooseControl) {
						next = player.chooseControl({ controls: chooseButton.chooseControl(event, player) });
						if (dialog.direct) {
							next.direct = true;
						}
						if (dialog.forceDirect) {
							next.forceDirect = true;
						}
						next.dialog = dialog;
						next.set("ai", chooseButton.check || (() => 0));
					} else {
						next = player.chooseButton(dialog);
						if (dialog.direct) {
							next.direct = true;
						}
						if (dialog.forceDirect) {
							next.forceDirect = true;
						}
						next.set("ai", chooseButton.check || (() => 1));
						next.set("filterButton", chooseButton.filter || (() => true));
						next.set("selectButton", chooseButton.select || 1);
						next.set("filterOk", chooseButton.filterOk || (() => true));
						attachChooseButtonSelectionSpec(next, info, event, player);
						next.set(
							"complexSelect",
							(() => {
								if (chooseButton.complexSelect !== false) {
									if (chooseButton.complexSelect === undefined && chooseButton.allowChooseAll === true) {
										// 如果complexSelect没有被显式的定义但是全选被显式要求了，那么我们默认认为调用者需要全选而不是complexSelect喵
										return false;
									} else {
										return true;
									}
								}
								return false;
							})()
						);
						next.set("allowChooseAll", chooseButton.allowChooseAll);
					}
					event.buttoned = event.result.skill;

					return next.forResult();
				} else if (info && info.precontent && !game.online) {
					const next = game.createEvent(`pre_${event.result.skill}`);
					next.setContent(info.precontent);
					next.set("result", event.result);
					next.set("player", player);
					return next.forResult();
				}
			}
		},
		async (event, trigger, player, result) => {
			if (!event.buttoned) {
				return;
			}

			if (result.bool || (result.control && result.control != "cancel2")) {
				const sourceInfo = get.info(event.buttoned);
				const info = sourceInfo?.chooseButton;
				if (!info || typeof info.backup != "function") {
					event.goto(0);
					delete event.buttoned;
					return;
				}
				const links = info.chooseControl ? result : (result.links ?? []);
				const backup = info.backup(links, player);
				if (sourceInfo?.selectionSpec !== undefined) {
					backup.selectionSpec = true;
				}
				lib.skill[`${event.buttoned}_backup`] = backup;
				backup.sourceSkill = event.buttoned;
				if (game.online) {
					event._sendskill = [`${event.buttoned}_backup`, backup];
				} else {
					game.broadcast(
						(skill, audio) => {
							let info = lib.skill[skill];
							if (!info) {
								info = {};
								lib.skill[skill] = info;
							}
							if (Array.isArray(info)) {
								throw new TypeError("A backup skill must not be an array");
							}
							info.audio = audio;
						},
						`${event.buttoned}_backup`,
						backup.audio
					);
				}
				event.backup(`${event.buttoned}_backup`);
				if (backup.selectionSpec) {
					event.selectionSpec = { finalPredicate: () => true };
				}
				if (typeof info.prompt == "function") {
					event.openskilldialog = info.prompt(links, player);
				}
			} else {
				ui.control.addTempClass("nozoom", 100);
				event._aiexclude.add(event.buttoned);
			}
			event.goto(0);
			delete event.buttoned;
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string" || isImportModePayload(event.result)) event.result = {};
			delete _status.noclearcountdown;
			if (event.skillDialog && "close" in event.skillDialog && typeof event.skillDialog.close == "function") {
				event.skillDialog.close();
			}
			if (event.result.bool && !game.online) {
				let info;
				if (event.result._sendskill) {
					lib.skill[event.result._sendskill[0]] = event.result._sendskill[1];
				}
				if (event.onresult) {
					event.onresult(event.result);
				}
					if (!event.result?.bool || event.result?._noHidingTimer) {
						const skill = getLogSkillName(event.result, event.logSkill);
						if (skill) {
							info = get.info(skill);
							if (info.direct && !info.clearTime) {
								_status.noclearcountdown = "direct";
							}
						}
					}
				if (event.logSkill) {
					if (typeof event.logSkill == "string") {
						player.logSkill(event.logSkill);
					} else if (Array.isArray(event.logSkill)) {
					forwardEventLogSkill(player, event.logSkill);
					}
				}
				if (!event.result.card && typeof event.result.skill === "string") {
					event.result.used = event.result.skill;
					player.useSkill({ skill: event.result.skill, cards: event.result.cards, targets: event.result.targets });
				} else if (event.result?.cancel) {
					event.goto(0);
				} else {
					if (info && info.prerespond) {
						info.prerespond(event.result, player);
					}
					const next = player.respond({
						cards: event.result.cards,
						card: event.result.card,
						animate: event.animate,
						skill: typeof event.result.skill === "string" ? event.result.skill : undefined,
						source: event.source,
					});
					if (event.result.noanimate) {
						next.animate = false;
					}
					const parent = event.parent;
					if (!parent) {
						throw new Error("chooseToRespond requires a parent event.");
					}
					if (parent.card && parent.type == "card") {
						next.set("respondTo", [parent.player, parent.card]);
					}
					if (event.noOrdering) {
						next.noOrdering = true;
					}
					if (event.result._apply_args) {
						for (const i in event.result._apply_args) {
							next[i] = event.result._apply_args[i];
						}
					}
				}
			} else if (event._sendskill) {
				event.result._sendskill = event._sendskill;
			}
			if (event.dialog && event.dialog.close) {
				event.dialog.close();
			}
			if (!_status.noclearcountdown) {
				game.stopCountChoose();
			}
		},
	],
	chooseToGive: [
		async (event, trigger, player) => {
			const target = event.getTarget();
			event.result = {
				bool: true,
				confirm: "ok",
				buttons: [],
				links: [],
				cards: [],
				targets: [],
			};
			event.filterCard = (event => {
				const filterCard = event.filterCard;
				return (card, player) => {
						if (!lib.filter.canBeGained(card, event.getTarget(), player)) {
						return false;
					}
					return filterCard.call(event, card, player);
				};
			})(event);
			if (event.directresult) {
				event.result.cards = event.directresult.slice(0);
				event.goto(2);
				return;
			}
			const directFilter = event.forced && typeof event.filterOk != "function" && typeof event.selectCard != "function" && !event.complexCard;
			const cards = directFilter && typeof event.filterCard == "function" ? player.getCards(event.position).filter(card => !card.classList.contains("uncheck") && lib.filter.cardAiIncluded(card) && event.filterCard(card, player)) : [];
			const range = get.select(event.selectCard);
			if (directFilter && (range[0] >= cards.length || range[1] <= -1)) {
				if (player.isOut()) {
					event.result.cards = [];
				} else {
					event.result.cards = cards;
				}
			} else if (event.isMine()) {
				game.check();
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				}
				game.pause();
				if (range[1] > 1 && typeof event.selectCard != "function") {
					ui.create.cardChooseAll();
					event.aiChoose = ui.create.control("AI代选", () => {
						if (typeof event.ai == "function") {
							ai.basic.chooseCard(event.ai);
						}
						if (typeof _status.event.custom?.add?.card == "function") {
							_status.event.custom.add.card();
						}
						ui.selected.cards.forEach(i => i.updateTransform(true));
					});
				}
				if (Array.isArray(event.dialog)) {
					event.dialog = ui.create.dialog.apply(this, event.dialog);
					event.dialog.open();
					event.dialog.classList.add("noselect");
				} else if (event.prompt != false) {
					let prompt;
					if (typeof event.prompt == "string") {
						prompt = event.prompt;
					} else {
						let select;
						if (range[0] == range[1]) {
							select = get.cnNumber(range[0]);
						} else if (range[1] == Infinity) {
							select = `至少${get.cnNumber(range[0])}`;
						} else {
							select = `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
						}
						const position = event.position == "h" ? "手" : event.position == "e" ? "装备" : "";
						prompt = `请交给${get.translation(target)}${select}张${position}牌`;
					}
					event.dialog = ui.create.dialog(prompt);
					if (event.prompt2) {
						event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
					}
					if (Array.isArray(event.promptx)) {
						event.promptx.forEach(i => event.dialog.add(i));
					}
					if (Array.isArray(event.selectCard)) {
						event.promptbar = event.dialog.add(`0/${get.numStr(event.selectCard[1], "card")}`);
						event.custom.add.card = () => {
							_status.event.promptbar.innerHTML = `${ui.selected.cards.length}/${get.numStr(_status.event.selectCard[1], "card")}`;
						};
					}
				} else if (get.itemtype(event.dialog) == "dialog") {
					event.dialog.style.display = "";
					event.dialog.open();
				}
			} else if (event.isOnline()) {
				event.send();
			} else {
				event.result = "ai";
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result != "ai") {
				return;
			}
			if (await applyLLMDecision(event)) {
				return;
			} else if (event.processAI) {
				event.result = event.processAI();
			} else {
				game.check();
				if ((ai.basic.chooseCard(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
					ui.click.ok();
				} else if (event.skill) {
					ui.click.cancel();
					event._aiexclude.add(event.skill);
					event.redo();
					game.resume();
				} else {
					ui.click.cancel();
				}
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			event.resume();
			if (event.cardChooseAll) {
				event.cardChooseAll.close();
			}
			if (event.aiChoose) {
				event.aiChoose.close();
			}
			if (event.glow_result && event.result.cards && !event.directresult) {
				event.result.cards.forEach(i => i.classList.add("glow"));
			}
			if (event.dialog) {
				event.dialog.close();
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (!event.result.bool || !event.result.cards || game.online) {
				event.finish();
				return;
			}

			event.cards = event.result.cards.slice(0);
			if (event.logSkill) {
				if (Array.isArray(event.logSkill)) {
					forwardEventLogSkill(player, event.logSkill);
				} else {
					player.logSkill(event.logSkill);
				}
			}
			if (event.autodelay && !event.isMine()) {
				if (typeof event.autodelay == "number") {
					game.delayx(event.autodelay);
				} else {
					game.delayx();
				}
			}
		},
		async (event, trigger, player) => {
			const { cards } = event;
			const target = event.getTarget();
			if (event.boolline) {
				player.line(target, "green");
			}
			event.done = target.gain(event.cards, player);
			event.done.gaintag.addArray(event.gaintag);
			event.done.giver = player;
			if (event.delay !== false) {
				event.done.animate = event.visibleMove ? "give" : "giveAuto";
			} else {
				target[event.visibleMove ? "$give" : "$giveAuto"](cards, player);
				if (event.visibleMove) {
					event.done.visible = true;
				}
			}
		},
	],
	chooseToDiscard: [
		async (event, trigger, player) => {
			event.filterCard = (event => {
				const filterCard = event.filterCard;
				return (card, player) => {
					if (!lib.filter.cardDiscardable(card, player, event)) {
						return false;
					}
					return filterCard.call(event, card, player);
				};
			})(event);
			if (_status.noclearcountdown !== "direct") {
				_status.noclearcountdown = true;
			}
			/*if (!player.getCards(event.position).filter(card => event.filterCard(card, player)).length) {
				event.result = {
					bool: false,
					cards: [],
				};
			} else */
			if (event.autochoose()) {
				const cards = player.getCards(event.position);
				event.result = {
					bool: true,
					autochoose: true,
					cards,
					rawcards: player.getCards(event.position),
				};
				for (let i = 0; i < cards.length; i++) {
					if (!lib.filter.cardDiscardable(cards[i], player, event)) {
						cards.splice(i--, 1);
					}
				}
			} else {
				if (game.modeSwapPlayer && !_status.auto && player.isUnderControl()) {
					game.modeSwapPlayer(player);
				}
				event.rangecards = player.getCards(event.position);
				for (let i = 0; i < event.rangecards.length; i++) {
					if (lib.filter.cardDiscardable(event.rangecards[i], player, event)) {
						event.rangecards.splice(i--, 1);
					} else {
						event.rangecards[i].uncheck("chooseToDiscard");
					}
				}
				const directFilter = event.forced && typeof event.filterOk != "function" && typeof event.selectCard != "function" && !event.complexCard;
				const cards = directFilter ? player.getCards(event.position).filter(card => !card.classList.contains("uncheck") && lib.filter.cardAiIncluded(card) && event.filterCard(card, player)) : [];
				const range = get.select(event.selectCard);
				if (directFilter && (range[0] >= cards.length || range[1] <= -1)) {
					if (player.isOut()) {
						event.result = {
							cards: [],
						};
					} else {
						event.result = {
							bool: true,
							cards: cards,
						};
					}
				} else if (event.isMine()) {
					game.check();
					if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
						ui.click.cancel();
						return;
					}
					game.pause();
					if (range[1] > 1 && typeof event.selectCard != "function") {
						ui.create.cardChooseAll();
						event.promptdiscard = ui.create.control("AI代选", () => {
							ai.basic.chooseCard(event.ai);
							if (typeof _status.event.custom?.add?.card == "function") {
								_status.event.custom.add.card();
							}
							for (const card of ui.selected.cards) {
								card.updateTransform(true);
							}
						});
					}
					if (Array.isArray(event.dialog)) {
						event.dialog = ui.create.dialog.apply(this, event.dialog);
						event.dialog.open();
						event.dialog.classList.add("noselect");
					} else if (event.prompt != false) {
						let str;
						if (typeof event.prompt == "string") {
							str = event.prompt;
						} else {
							str = "请弃置";
							if (range[0] == range[1]) {
								str += get.cnNumber(range[0]);
							} else if (range[1] == Infinity) {
								str += `至少${get.cnNumber(range[0])}`;
							} else {
								str += `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
							}
							str += "张";
							if (event.position == "h" || event.position == undefined) {
								str += "手";
							}
							if (event.position == "e") {
								str += "装备";
							}
							str += "牌";
						}
						event.dialog = ui.create.dialog(str);
						if (event.prompt2) {
							event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
						}
						if (Array.isArray(event.selectCard)) {
							event.promptbar = event.dialog.add(`0/${get.numStr(event.selectCard[1], "card")}`);
							event.custom.add.card = () => {
								_status.event.promptbar.innerHTML = `${ui.selected.cards.length}/${get.numStr(_status.event.selectCard[1], "card")}`;
							};
						}
					} else if (get.itemtype(event.dialog) == "dialog") {
						event.dialog.style.display = "";
						event.dialog.open();
					}
				} else if (event.isOnline()) {
					event.result = normalizeSelectionResult(await event.sendAsync());
				} else {
					event.result = "ai";
				}
			}
		},
			async (event, trigger, player) => {
				if (event.result == "ai") {
					// LLM 失败或拒绝该事件时保持既有本地 AI 降级。
					if (await applyLLMDecision(event)) {
						return;
					}
					if (event.processAI) {
						event.result = event.processAI();
					} else {
						game.check();
						if (((event.ai ? ai.basic.chooseCard(event.ai) : false) || event.forced) && (!event.filterOk || event.filterOk())) {
							ui.click.ok();
						} else if (event.skill) {
							const skill = event.skill;
							ui.click.cancel();
							event._aiexclude.add(skill);
							event.redo();
							game.resume();
						} else {
							ui.click.cancel();
						}
					}
				}
			if (event.rangecards) {
				for (const card of event.rangecards) {
					card.recheck("chooseToDiscard");
				}
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			event.resume();
			if (event.cardChooseAll) {
				event.cardChooseAll.close();
			}
			if (typeof event.promptdiscard?.close == "function") {
				event.promptdiscard.close();
			}
			if (event.result) {
				if (event.result._sendskill) {
					lib.skill[event.result._sendskill[0]] = event.result._sendskill[1];
				}
				if (typeof event.result.skill === "string" && event.result.skill) {
					const info = get.info(event.result.skill);
					if (info && info.precontent && !game.online) {
						const next = game.createEvent(`pre_${event.result.skill}`);
						next.setContent(info.precontent);
						next.set("result", event.result);
						next.set("player", player);
						await next;
					}
				}
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event.result.bool && event.result.cards?.length && !game.online && event.autodelay && !event.isMine()) {
				if (typeof event.autodelay == "number") {
					await game.delayx(event.autodelay);
				} else {
					await game.delayx();
				}
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			delete _status.noclearcountdown;
			if (typeof event.dialog?.close == "function") {
				event.dialog.close();
			}
			if (!game.online && event.result.bool) {
				if (event.logSkill) {
					if (typeof event.logSkill == "string") {
						player.logSkill(event.logSkill);
					} else if (Array.isArray(event.logSkill)) {
					forwardEventLogSkill(player, event.logSkill);
					}
				}
				if (!event.chooseonly) {
					const next = event.result.cards ? player.discard({ cards: event.result.cards.slice() }) : player.discard();
					if (typeof event.delay == "boolean") {
						next.delay = event.delay;
					}
					next.discarder = player;
					event.done = next;
					await next;
				}
			} else if (event._sendskill) {
				event.result._sendskill = event._sendskill;
			}
			if (!_status.noclearcountdown) {
				game.stopCountChoose();
			}
		},
	],
	async gaincardMultiple(event, trigger, player) {
		const { cards } = event;
		event.type = "gain";
		if (event.animate == "give" || event.animate == "gain2") {
			event.visible = true;
		}
		if (player && cards) {
			event._lose = true;
			await player.lose({ cards: cards.slice(), position: ui.special }).set("type", "gain").set("forceDie", true).set("getlx", false);
		}

		let delay;
		const animate = event.animate;
		switch (animate) {
			case "draw":
				for (const pair of event.gain_list) {
					if (get.itemtype(pair[1]) == "card") {
						pair[1] = [pair[1]];
					}
					if (event._lose) {
						pair[1] = pair[1].filter(card => !cards.includes(card) || !player.getCards("hejsx").includes(card));
					}
					if (pair[1].length > 0) {
						pair[0].$draw(pair[1].length);
					}
				}
				delay = game.delay(0, get.delayx(500, 500));
				break;
			case "gain":
				for (const pair of event.gain_list) {
					if (get.itemtype(pair[1]) == "card") {
						pair[1] = [pair[1]];
					}
					if (event._lose) {
						pair[1] = pair[1].filter(card => !cards.includes(card) || !player.getCards("hejsx").includes(card));
					}
					if (pair[1].length > 0) {
						pair[0].$gain(pair[1].length);
					}
				}
				delay = game.delay(0, get.delayx(700, 700));
				break;
			case "gain2":
			case "draw2":
				for (const pair of event.gain_list) {
					if (get.itemtype(pair[1]) == "card") {
						pair[1] = [pair[1]];
					}
					if (event._lose) {
						pair[1] = pair[1].filter(card => !cards.includes(card) || !player.getCards("hejsx").includes(card));
					}
					if (pair[1].length > 0) {
						pair[0].$gain2(pair[1]);
					}
				}
				delay = game.delay(0, get.delayx(500, 500));
				break;
			case "give":
			case "giveAuto": {
				if (!player) {
					break;
				}
				const evt = event.getl(player);
				for (const pair of event.gain_list) {
					if (get.itemtype(pair[1]) == "card") {
						pair[1] = [pair[1]];
					}
					if (event._lose) {
						pair[1] = pair[1].filter(card => !cards.includes(card) || !player.getCards("hejsx").includes(card));
					}
					const shown = pair[1].slice(0);
					const hidden: Card[] = [];
					if (event.animate == "giveAuto") {
						for (const card of pair[1]) {
							if (evt.hs.includes(card)) {
								shown.remove(card);
								hidden.push(card);
							}
						}
					}
					if (shown.length > 0) {
						player.$give(shown, pair[0]);
					}
					if (hidden.length > 0) {
						player.$giveAuto(hidden, pair[0]);
					}
				}
				delay = game.delay(0, get.delayx(500, 500));
				break;
			}
			default: {
				if (typeof animate === "function") {
					const animateResult = animate(event);
					if (typeof animateResult === "number") {
						delay = game.delay(0, get.delayx(animateResult, animateResult));
					} else {
						animateResult.finally(() => void game.resume());
						delay = game.pause();
					}
				}
				break;
			}
		}
		const nexts: GameEvent[] = [];
		for (const pair of event.gain_list) {
			if (pair[1].length > 0) {
				const next = pair[0].gain(pair[1]);
				next.getlx = false;
				if (event.visible) {
					next.visible = true;
				}
				if (event.giver) {
					next.giver = event.giver;
				}
				if (event.gaintag) {
					next.gaintag.addArray(event.gaintag);
				}
				nexts.push(next);
			}
		}
		await delay;
		await Promise.all(nexts);
		await game.delayx();
	},
	async discardMultiple(event, trigger, player) {
		event.type = "discard";
		event.visible = true;
		if (!event.position) {
			event.position = ui.discardPile;
		}

		const allCards: Card[] = [];
		const events: GameEvent[] = [];
		event.cards = allCards;
		for (const [target, cards] of event.lose_list) {
			const next = target.lose(cards, event.position);
			game.log(target, "弃置了", cards);
			next.type = "discard";
			next.animate = false;
			next.delay = false;
			allCards.addArray(cards);
			next.getlx = false;

			events.push(next);
		}

		const evt = event;
		const { cards } = event;
		if (evt.animate != false) {
			evt.discardid = lib.status.videoId++;
			game.broadcastAll(
				(list, id, cards) => {
					for (const item of list) {
						for (const j of item[1]) {
							j.classList.remove("glow");
							j.classList.remove("glows");
						}
						item[0].$throw(item[1], null, "nobroadcast");
					}
					const cardnodes: Card[] & { _discardtime?: number } = [];
					cardnodes._discardtime = get.time();
					for (const ix of list) {
						const card = ix[1];
						for (const card of cards) {
							if (card.clone) {
								cardnodes.push(card.clone);
							}
						}
					}
					ui.todiscard[id] = cardnodes;
				},
				event.lose_list,
				evt.discardid,
				cards
			);
			if (lib.config.sync_speed && cards[0] && cards[0].clone) {
				if (evt.delay != false) {
					const waitingForTransition = get.time();
					evt.waitingForTransition = waitingForTransition;
					cards[0].clone.listenTransition(() => {
						if (_status.waitingForTransition == waitingForTransition && _status.paused) {
							game.resume();
						}
						delete evt.waitingForTransition;
					});
				} else {
					const parent = evt.getParent(undefined, true);
					if (parent?.discardTransition) {
						delete parent.discardTransition;
						const waitingForTransition = get.time();
						parent.waitingForTransition = waitingForTransition;
						cards[0].clone.listenTransition(() => {
							if (_status.waitingForTransition == waitingForTransition && _status.paused) {
								game.resume();
							}
							const currentParent = evt.getParent(undefined, true);
							if (currentParent) {
								delete currentParent.waitingForTransition;
							}
						});
					}
				}
			}
		}

		await Promise.all(events);

		if (event.delay != false) {
			if (event.waitingForTransition) {
				_status.waitingForTransition = event.waitingForTransition;
				await game.pause();
			} else {
				await game.delayx();
			}
		}
	},
	addToExpansionMultiple: [
		async (event, trigger, player) => {
			if (event.animate == "give") {
				event.visible = true;
			}
			event.type = "addToExpansion";
			event.gaintag ??= [];
			event.cards ??= [];
			if (event.lose_list) {
				const playersById = _status.connectMode ? lib.playerOL : game.playerMap;
				for (const list of event.lose_list) {
					const source = list[0];
					const sourceId = source.playerid;
					if (!playersById || typeof sourceId != "string" || !playersById[sourceId]) {
						event.cards = [];
						event.finish();
						return;
					}
					for (const card of list[1]) {
						const owner = get.owner(card, "judge");
						if (owner && (owner != source || get.position(card) != "x")) {
							const ownerId = owner.playerid;
							if (!playersById || typeof ownerId != "string" || !playersById[ownerId]) {
								event.cards = [];
								event.finish();
								return;
							}
						}
					}
				}
				const map: Record<string, [Card[], Card[], Card[]]> = {};
				const map2: Record<string, Card[]> = {};
				for (const list of event.lose_list) {
					const player = list[0];
					const cards = list[1];
					const myId = player.playerid;
					if (typeof myId != "string") {
						event.cards = [];
						event.finish();
						return;
					}
					event.cards.addArray(cards);
					if (!map2[myId]) {
						map2[myId] = [];
					}
					for (const i of cards) {
						const owner = get.owner(i, "judge");
						if (owner && (owner != player || get.position(i) != "x")) {
							const id = owner.playerid;
							if (typeof id != "string") {
								event.cards = [];
								event.finish();
								return;
							}
							if (!map[id]) {
								map[id] = [[], [], []];
							}
							map[id][0].push(i);
							map2[myId].push(i);
							const position = get.position(i);
							if (position == "h") {
								map[id][1].push(i);
							} else {
								map[id][2].push(i);
							}
						} else if (!event.updatePile && get.position(i) == "c") {
							event.updatePile = true;
						}
					}
				}
				event.losing_map = map;
				event.gaining_map = map2;
				for (const i in map) {
					const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
					if (!owner) {
						event.finish();
						return;
					}
					const next = owner.lose({ cards: map[i][0], position: ui.special }).set("forceDie", true).set("getlx", false);
					next.set("relatedEvent", event.getParent());
					next.set("forceDie", true);
					next.set("getlx", false);
					if (event.visible == true) {
						next.set("visible", true);
					}
					await next;
				}
			} else {
				event.finish();
				return;
			}
		},
		async (event, trigger, player) => {
			const { cards: cardsx } = event;
			/*event.cards = cards = cards.map(i => (i.cards ? i.cards : [i])).flat();*/
			if (event.lose_list) {
			const map: Record<string, [Card[], Card[], Card[]]> = {};
				for (const list of event.lose_list) {
					const player = list[0];
					const cards = list[1];
					for (let i = 0; i < cards.length; i++) {
						const card = cards[i];
						if (card.willBeDestroyed("expansion", player, event)) {
							card.selfDestroy(event);
							cards.splice(i--, 1);
							cardsx.remove(card);
						} else if (event.losing_map) {
							for (const id in event.losing_map) {
								if (event.losing_map[id][0].includes(card)) {
									const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
									if (!source) {
										event.finish();
										return;
									}
									const hs = source.getCards("hejsx");
									if (hs.includes(card)) {
										cards.splice(i--, 1);
										cardsx.remove(card);
									}
								}
							}
						}
					}
				}
			}
			if (cardsx.length == 0) {
				event.finish();
				return;
			}
		},
		async (event, trigger, player) => {
			const { lose_list } = event;
			for (const [source, cards] of lose_list) {
				for (const [key, value] of lib.commonArea) {
					const list = (_status[value.areaStatusName] || []).filter(card => cards.includes(card));
					if (event[value.fromName] || list.length) {
						const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
						next.setContent(value.removeHandeler);
						next.player = source;
						next.type = event.type;
						await next;
					}
				}
			}
		},
		async (event, trigger, player) => {
			const animate = event.animate;
			const postAnimate = (player, cards) => {
				player.$addToExpansion(cards, null, event.gaintag);
				for (const id of event.gaintag) {
					player.markSkill(id);
				}
			};

			const playersById = _status.connectMode ? lib.playerOL : game.playerMap;
			const gainingMap: Record<string, Card[]> = event.gaining_map;
			const waitings: Promise<void>[] = [];
			for (const [id, cards] of Object.entries(gainingMap)) {
				const player2 = playersById && playersById[id];
				if (!player2) {
					event.finish();
					return;
				}
				const hs = player2.getCards("x");
				const cards2: Card[] = cards.filter(card => !hs.includes(card));
				for (const card of cards2) {
					if (_status.discarded) {
						_status.discarded.remove(card);
					}
					for (let i = 0; i < card.vanishtag.length; i++) {
						if (card.vanishtag[i][0] !== "_") {
							card.vanishtag.splice(i--, 1);
						}
					}
				}

				let animateTime: number | Promise<void> | null = null;
				switch (animate) {
					case "draw":
						player2.$draw(cards2.length);
						if (event.log) {
							game.log(player2, "将", get.cnNumber(cards2.length), "张牌置于了武将牌上");
						}
						animateTime = 500;
						break;
					case "gain":
						player2.$gain(cards2, false);
						animateTime = 700;
						break;
					case "gain2":
					case "draw2":
						animateTime = 300;
						if (player2.$gain2(cards2) && player2 === game.me) {
							animateTime = 500;
						}
						break;
					case "give":
					case "giveAuto": {
						const evtmap: Record<string, [Card[], Card[], Card[]]> = event.losing_map;
						const entries: [string, Card[]][] = [];
						for (const [id, slots] of Object.entries(evtmap)) {
							entries.push([id, slots[0]]);
						}
						const getOwner = card => {
							const entry = entries.find(entry => entry[1].includes(card));
							if (entry) {
								const owner = playersById && playersById[entry[0]];
								if (!owner) {
									event.finish();
									return null;
								}
								return owner;
							}
							return null;
						};
						const gainmap: Record<string, Card[]> = {};
						for (const cardx of cards2) {
							const owner = getOwner(cardx);
							if (owner) {
								const id = owner.playerid;
								if (typeof id != "string") {
									continue;
								}
								if (!gainmap[id]) {
									gainmap[id] = [];
								}
								gainmap[id].push(cardx);
							}
						}
						if (animate === "give") {
							for (const i in gainmap) {
								const source = playersById && playersById[i];
								if (!source || !evtmap[i]) {
									continue;
								}
								source.$give(evtmap[i][0], player2, false);
								if (event.log) {
									game.log(player2, "将", evtmap[i][0], "置于了武将牌上");
								}
							}
						} else {
							for (const id in gainmap) {
								const source = playersById && playersById[id];
								if (!source || !evtmap[id]) {
									continue;
								}
								if (evtmap[id][1].length) {
									source.$giveAuto(evtmap[id][1], player2, false);
									if (event.log) {
										game.log(player2, "将", get.cnNumber(evtmap[id][1].length), "张牌置于了武将牌上");
									}
								}
								if (evtmap[id][2].length) {
									source.$give(evtmap[id][2], player2, false);
									if (event.log) {
										game.log(player2, "将", evtmap[id][2], "置于了武将牌上");
									}
								}
							}
						}
						animateTime = 500;
						break;
					}
					default:
						if (typeof animate === "function") {
							animateTime = animate(event);
						}
						break;
				}

				if (animateTime == null) {
					postAnimate(player2, cards2);
					continue;
				}

				const waiting = typeof animateTime === "number" ? delay(get.delayx(animateTime, animateTime)) : animateTime;
				waitings.push(waiting.then(() => postAnimate(player2, cards2)));
			}

			if (waitings.length) {
				Promise.allSettled(waitings).finally(() => void game.resume());
				await game.pause();
				game.delayx();
			}

			if (event.updatePile) {
				game.updateRoundNumber();
			}
		},
	],
	loseToDiscardpileMultiple: [
		async (event, trigger, player) => {
			event.visible = true;
			if (!event.position) {
				event.position = ui.discardPile;
			}
			event.type = "loseToDiscardpile";
			const cards: Card[] = [];
			event.cards = cards;
			for (const [target, targetCards] of event.lose_list) {
				const next = target.lose(targetCards, event.position);
				game.log(target, "将", targetCards, `置入了${lib.areaList.get(event.position.id)}`);
				next.animate = false;
				next.delay = false;
				cards.addArray(targetCards);
				next.getlx = false;
			}
			const evt = event;
			if (evt.animate != false) {
				evt.discardid = lib.status.videoId++;
				game.broadcastAll(
					(list: [Player, Card[]][], id: number, cards: Card[]) => {
						for (const item of list) {
							for (const j of item[1]) {
								j.classList.remove("glow");
								j.classList.remove("glows");
							}
							item[0].$throw(item[1], null, "nobroadcast");
						}
						const cardnodes: CardNodeList = [];
						cardnodes._discardtime = get.time();
						for (const card of cards) {
							if (card.clone) {
								cardnodes.push(card.clone);
							}
						}
						ui.todiscard[id] = cardnodes;
					},
					event.lose_list,
					evt.discardid,
					cards
				);
				if (lib.config.sync_speed && cards[0] && cards[0].clone) {
					if (evt.delay != false) {
						const waitingForTransition = get.time();
						evt.waitingForTransition = waitingForTransition;
						cards[0].clone.listenTransition(() => {
							if (_status.waitingForTransition == waitingForTransition && _status.paused) {
								game.resume();
							}
							delete evt.waitingForTransition;
						});
					} else {
						const parent = evt.getParent(undefined, true);
						if (parent?.discardTransition) {
							delete parent.discardTransition;
							const waitingForTransition = get.time();
							parent.waitingForTransition = waitingForTransition;
							cards[0].clone.listenTransition(() => {
								if (_status.waitingForTransition == waitingForTransition && _status.paused) {
									game.resume();
								}
								const currentParent = evt.getParent(undefined, true);
								if (currentParent) {
									delete currentParent.waitingForTransition;
								}
							});
						}
					}
				}
			}
		},
		async (event, trigger, player) => {
			if (event.delay != false) {
				if (event.waitingForTransition) {
					_status.waitingForTransition = event.waitingForTransition;
					game.pause();
				} else {
					await game.delayx();
				}
			}
		},
	],
	async chooseToCompareLose(event) {
		const waitings = event.lose_list.map(async ([player, cards]) => {
			const next = player.lose(cards, ui.ordering);
			next.relatedEvent = event.relatedEvent || event.getParent();
			next.getlx = false;
			await next;
		});
		await Promise.all(waitings);
	},
	chooseToCompareMeanwhile: [
		async (event, trigger, player) => {
			const targets = event.getTargets();
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			if (player.countCards("h") == 0 && !fixedResultFor(player)) {
				event.result = { cancelled: true, bool: false };
				event.finish();
				return;
			}
			for (const target of targets) {
				if (target.countCards("h") == 0 && !fixedResultFor(target)) {
					event.result = { cancelled: true, bool: false };
					event.finish();
					return;
				}
			}
			if (!event.multitarget) {
				targets.sort(lib.sort.seat);
			}
			game.log(player, "对", targets, "发起了共同拼点");
			event.compareMeanwhile = true;
			event.filterCard ??= lib.filter.all;
		},
		async (event, trigger, player) => {
			const targets = event.getTargets();
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			event._result = [];
			event.list = targets.filter(current => !fixedResultFor(current));
			if (event.list.length || !fixedResultFor(player)) {
				if (!fixedResultFor(player)) {
					event.list.unshift(player);
				}
				player.chooseCardOL(event.list, "请选择拼点牌", true).set("filterCard", event.filterCard).set("type", "compare").set("ai", event.ai).set("source", player).aiCard = target => {
					const hs = target.getCards("h");
					const event: GameEvent = _status.event;
					event.player = target;
					const compareAi = event.ai;
					if (typeof compareAi == "function") {
						hs.sort((a, b) => compareAi(b) - compareAi(a));
					}
					delete event.player;
					return { bool: true, cards: [hs[0]] };
				};
			}
		},
		async (event, trigger, player, result: Partial<Result> | Partial<Result>[]) => {
			type CompareResult = Pick<Partial<Result>, "bool" | "skill"> & { cards: Card[] };
			const isCompareResult = (value: Partial<Result>): value is CompareResult => Array.isArray(value.cards) && (value.skill === undefined || typeof value.skill == "string");
			if (!Array.isArray(result) || !result.every(isCompareResult)) {
				return;
			}
			const cards: Card[] = [];
			const lose_list: [Player, Card[]][] = [];
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			const playerFixedCard = fixedResultFor(player);
			if (playerFixedCard) {
				event.list.unshift(player);
				result.unshift({ bool: true, cards: [playerFixedCard] });
				lose_list.push([player, [playerFixedCard]]);
			} else {
				const skill = result[0].skill;
				const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : undefined;
				if (skill !== undefined && typeof onCompare == "function") {
					player.logSkill(skill);
					result[0].cards = onCompare(player);
				} else {
					lose_list.push([player, result[0].cards]);
				}
			}
			const targets = event.getTargets();
			for (const target of targets) {
				if (event.list.includes(target)) {
					const i = event.list.indexOf(target);
					const skill = result[i].skill;
					const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : undefined;
					if (skill !== undefined && typeof onCompare == "function") {
						event.list[i].logSkill(skill);
						result[i].cards = onCompare(event.list[i]);
					} else {
						lose_list.push([target, result[i].cards]);
					}
					cards.push(result[i].cards[0]);
				} else {
					const fixedCard = fixedResultFor(target);
					if (fixedCard) {
						cards.push(fixedCard);
						lose_list.push([target, [fixedCard]]);
					}
				}
			}
			if (lose_list.length) {
				game.loseAsync({
					lose_list: lose_list,
				}).setContent("chooseToCompareLose");
			}
			event.lose_list = lose_list;
			event.getNum = card => {
				for (const i of event.lose_list) {
					if (i[1].includes && i[1].includes(card)) {
						return get.number(card, i[0]);
					}
				}
				return get.number(card, false);
			};
			event.cardlist = cards;
			event.cards = cards;
			event.card1 = result[0].cards[0];
			event.num1 = event.getNum(event.card1);
			event.iwhile = 0;
			event.winner = null;
			event.maxNum = -1;
			event.tempplayer = event.player;
			event.result = {
				winner: null,
				player: event.card1,
				targets: event.cardlist.slice(0),
				num1: [],
				num2: [],
			};
		},
		async (event, trigger, player) => {
			event.trigger("compareCardShowBefore");
		},
		async (event, trigger, player) => {
			const { cards } = event;
			const targets = event.getTargets();
			player.$compareMultiple(event.card1, targets, cards);
			game.log(player, "的拼点牌为", event.card1);
			await player.showCards(event.card1).set("triggeronly", true);
			const func = async (card, index) => {
				game.log(targets[index], "的拼点牌为", card);
				await targets[index].showCards(card).set("triggeronly", true);
			};
			await game.doAsyncInOrder(event.cardlist, func, () => 1);
			player.addTempClass("target");
			game.delay(0, lib.config.game_speed == "vvfast" ? 4000 : 1000);
		},
		async (event, trigger, player) => {
			event.target = null;
			event.trigger("compare");
		},
		async (event: GameEvent, trigger, player) => {
			const targets = event.getTargets();
			if (event.iwhile < targets.length) {
				event.target = targets[event.iwhile];
				event.target.addTempClass("target");
				event.card2 = event.cardlist[event.iwhile];
				event.num2 = event.getNum(event.card2);
				delete event.player;
				event.trigger("compare");
			} else {
				event.iwhile = 0;
				game.delay(0, 1000);
				event.goto(9);
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			event.result.num1[event.iwhile] = event.num1;
			event.result.num2[event.iwhile] = event.num2;
			const list = [
				[event.tempplayer, event.num1],
				[event.target, event.num2],
			];
			for (const i of list) {
				if (i[1] > event.maxNum) {
					event.maxNum = i[1];
					event.winner = i[0];
				} else if (event.winner && i[1] == event.maxNum && i[0] != event.winner) {
					event.winner = null;
				}
			}
		},
		async (event, trigger, player) => {
			event.iwhile++;
			event.goto(6);
		},
		async (event, trigger, player) => {
			event.player = event.tempplayer;
			event.trigger("compareFixing");
		},
		async (event: GameEvent, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event.player) {
				delete event.player;
			}
			const targets = event.getTargets();
			if (event.iwhile < targets.length) {
				event.target = targets[event.iwhile];
				event.card2 = event.cardlist[event.iwhile];
				event.num2 = event.result.num2[event.iwhile];
				event.trigger("compareFixing");
			} else {
				event.goto(12);
			}
		},
		async (event, trigger, player) => {
			event.iwhile++;
			event.goto(10);
		},
		async (event, trigger) => {
			if (typeof event.result === "string") event.result = {};
			const targets = event.getTargets();
			const player = (event.player = event.tempplayer);
			delete event.tempplayer;
			event.str = "无人拼点成功";
			const winner = event.forceWinner || event.winner;
			if (winner) {
				event.result.winner = winner;
				event.str = `${get.translation(winner)}拼点成功`;
				game.log(winner, "拼点成功");
				winner.popup("胜");
			} else {
				game.log("#b无人", "拼点成功");
			}
			const list = [player].addArray(targets);
			list.remove(winner);
			for (const i of list) {
				i.popup("负");
			}
		},
		async (event, trigger, player) => {
			if (event.str) {
				game.broadcastAll(str => {
					const dialog = ui.create.dialog(str);
					dialog.classList.add("center");
					setTimeout(() => {
						dialog.close();
					}, 1000);
				}, event.str);
			}
			game.delay(3);
		},
		async (event, trigger, player) => {
			game.broadcastAll(ui.clear);
		},
		async (event, trigger, player) => {
			event.cards.add(event.card1);
		},
	],
	chooseToCompareMultiple: [
		async (event, trigger, player) => {
			const targets = event.getTargets();
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			if (!fixedResultFor(player) && player.countCards("h") == 0) {
				event.result = { cancelled: true, bool: false };
				event.finish();
				return;
			}
			for (const target of targets) {
				if (!fixedResultFor(target) && target.countCards("h") == 0) {
					event.result = { cancelled: true, bool: false };
					event.finish();
					return;
				}
			}
			if (!event.multitarget) {
				targets.sort(lib.sort.seat);
			}
			game.log(player, "对", targets, "发起拼点");
			event.filterCard ??= lib.filter.all;
		},
		async (event, trigger, player) => {
			const targets = event.getTargets();
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			event._result = [];
			event.list = targets.filter(current => !fixedResultFor(current));
			if (event.list.length || !fixedResultFor(player)) {
				if (!fixedResultFor(player)) {
					event.list.unshift(player);
				}
				player.chooseCardOL(event.list, "请选择拼点牌", true).set("filterCard", event.filterCard).set("type", "compare").set("ai", event.ai).set("source", player).aiCard = target => {
					const hs = target.getCards("h");
					const event: GameEvent = _status.event;
					event.player = target;
					const compareAi = event.ai;
					if (typeof compareAi == "function") {
						hs.sort((a, b) => compareAi(b) - compareAi(a));
					}
					delete event.player;
					return { bool: true, cards: [hs[0]] };
				};
			}
		},
		async (event, trigger, player, result: Partial<Result> | Partial<Result>[]) => {
			type CompareResult = Pick<Partial<Result>, "bool" | "skill"> & { cards: Card[] };
			const isCompareResult = (value: Partial<Result>): value is CompareResult => Array.isArray(value.cards) && value.cards.length > 0 && (value.skill === undefined || typeof value.skill == "string");
			if (!Array.isArray(result) || !result.every(isCompareResult) || result.length < event.list.length) {
				return;
			}
			const cards: Card[] = [];
			const lose_list: [Player, Card[]][] = [];
			const fixedResultFor = (current: Player): Card | undefined => {
				const playerid = current.playerid;
				return playerid === undefined ? undefined : event.fixedResult?.[playerid];
			};
			const playerFixedCard = fixedResultFor(player);
			if (playerFixedCard) {
				event.list.unshift(player);
				result.unshift({ bool: true, cards: [playerFixedCard] });
				lose_list.push([player, [playerFixedCard]]);
			} else {
				const skill = result[0].skill;
				const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : undefined;
				if (skill !== undefined && typeof onCompare == "function") {
					player.logSkill(skill);
					result[0].cards = onCompare(player);
				} else {
					lose_list.push([player, result[0].cards]);
				}
			}
			const targets = event.getTargets();
			for (const target of targets) {
				if (event.list.includes(target)) {
					const i = event.list.indexOf(target);
					const skill = result[i].skill;
					const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : undefined;
					if (skill !== undefined && typeof onCompare == "function") {
						event.list[i].logSkill(skill);
						result[i].cards = onCompare(event.list[i]);
					} else {
						lose_list.push([target, result[i].cards]);
					}
					cards.push(result[i].cards[0]);
				} else {
					const fixedCard = fixedResultFor(target);
					if (fixedCard) {
						cards.push(fixedCard);
						lose_list.push([target, [fixedCard]]);
					}
				}
			}
			if (lose_list.length) {
				game.loseAsync({
					lose_list: lose_list,
				}).setContent("chooseToCompareLose");
			}
			event.lose_list = lose_list;
			event.getNum = card => {
				for (const i of event.lose_list) {
					if (i[1].includes && i[1].includes(card)) {
						return get.number(card, i[0]);
					}
				}
				return get.number(card, false);
			};
			event.cardlist = cards;
			event.cards = cards;
			event.card1 = result[0].cards[0];
			event.num1 = event.getNum(event.card1);
			event.iwhile = 0;
			event.result = {
				player: event.card1,
				targets: event.cardlist.slice(0),
				num1: [],
				num2: [],
			};
		},
		async (event, trigger, player) => {
			event.trigger("compareCardShowBefore");
		},
		async (event, trigger, player) => {
			game.log(player, "的拼点牌为", event.card1);
			player.showCards(event.card1).set("triggeronly", true);
		},
		async (event, trigger, player) => {
			const targets = event.getTargets();
			if (event.iwhile < targets.length) {
				event.target = targets[event.iwhile];
				event.target.addTempClass("target");
				player.addTempClass("target");
				event.card2 = event.cardlist[event.iwhile];
				event.num2 = event.getNum(event.card2);
				game.log(event.target, "的拼点牌为", event.card2);
				player.line(event.target);
				player.$compare(event.card1, event.target, event.card2);
				event.target.showCards(event.card2).set("triggeronly", true);
			} else {
				event.goto(12);
			}
		},
		async (event, trigger, player) => {
			await game.delay(0, lib.config.game_speed == "vvfast" ? 4000 : 1500);
			await event.trigger("compare");
		},
		async (event, trigger, player) => {
			event.iiwhile = event.iwhile;
			delete event.iwhile;
			event.trigger("compareFixing");
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			const target = event.getTarget();
			event.result.num1[event.iiwhile] = event.num1;
			event.result.num2[event.iiwhile] = event.num2;
			if (event.forceWinner === player || (event.forceWinner !== target && event.num1 > event.num2)) {
				event.winner = player;
				event.str = `${get.translation(player)}拼点成功`;
				player.popup("胜");
				target.popup("负");
			} else {
				event.str = `${get.translation(player)}拼点失败`;
				if (event.forceWinner !== target && event.num1 == event.num2) {
					player.popup("平");
					target.popup("平");
				} else {
					event.winner = target;
					player.popup("负");
					target.popup("胜");
				}
			}
		},
		async (event, trigger, player) => {
			game.broadcastAll(str => {
				const dialog = ui.create.dialog(str);
				dialog.classList.add("center");
				setTimeout(() => dialog.close(), 1000);
			}, event.str);
			game.delay(2);
		},
		async (event, trigger, player) => {
			if (event.callback) {
				game.broadcastAll(
					(card1, card2) => {
						if (card1.clone) {
							card1.clone.style.opacity = 0.5;
						}
						if (card2.clone) {
							card2.clone.style.opacity = 0.5;
						}
					},
					event.card1,
					event.card2
				);
				const next = game.createEvent("compareMultiple");
				next.player = player;
				next.target = event.target;
				next.card1 = event.card1;
				next.card2 = event.card2;
				next.num1 = event.num1;
				next.num2 = event.num2;
				next.winner = event.winner;
				next.setContent(event.callback);
				event.compareMultiple = true;
			}
		},
		async (event, trigger, player) => {
			game.broadcastAll(ui.clear);
			delete event.winner;
			delete event.forceWinner;
			event.iwhile = event.iiwhile + 1;
			event.goto(5);
		},
		async (event, trigger, player) => {
			event.cards.add(event.card1);
		},
	],
	chooseToCompare: [
		async (event, trigger, player) => {
			const target = event.target;
			const targetPlayer = target instanceof lib.element.Player ? target : undefined;
			if (typeof target === "string" && target === "cardPile") {
				event.compareWithCardPile = true;
				event.compareType ??= "top";
			}
			if (!event.compareWithCardPile && !targetPlayer) {
				event.finish();
				return;
			}
			if (!event.position || typeof event.position != "string") {
				event.position = "h";
			}
			const playerid = player.playerid;
			const playerHasFixedResult = typeof playerid == "string" && event.fixedResult?.[playerid] != undefined;
			const targetHasFixedResult = targetPlayer && typeof targetPlayer.playerid == "string" && event.fixedResult?.[targetPlayer.playerid] != undefined;
			if ((!playerHasFixedResult && player.countCards(event.position) == 0) || (!event.compareWithCardPile && targetPlayer && !targetHasFixedResult && targetPlayer.countCards(event.position) == 0)) {
				event.result = { cancelled: true, bool: false };
				event.finish();
				return;
			}
			game.log(player, "对", event.compareWithCardPile ? "牌堆" : target, "发起", event.isDelay ? "延时" : "", "拼点");
			event.filterCard ??= lib.filter.all;
		},
		async (event, trigger, player) => {
			const target = event.target;
			event.list = [player, event.target instanceof lib.element.Player ? event.target : undefined].filter((current): current is Player => current instanceof lib.element.Player && (typeof current.playerid != "string" || event.fixedResult?.[current.playerid] == undefined));
			if (event.list.length) {
				player.chooseCardOL(event.list, "请选择拼点牌", true, event.position).set("small", event.small).set("filterCard", event.filterCard).set("type", "compare").set("ai", event.ai).set("source", player).aiCard = target => {
					const hs = target.getCards("h");
					const event = _status.event;
					const previousPlayer = event.player;
					event.player = target;
					try {
						const ai = event.ai;
						if (typeof ai == "function") {
							hs.sort((a, b) => ai(b) - ai(a));
						}
					} finally {
						event.player = previousPlayer;
					}
					return { bool: true, cards: [hs[0]] };
				};
			}
		},
		async (event, trigger, player, result) => {
			const target = event.target;
			const lose_list: [Player, Card[]][] = [];
			const playerid = player.playerid;
			if (typeof playerid == "string" && event.fixedResult?.[playerid]) {
				lose_list.push([player, [event.fixedResult[playerid]]]);
			} else {
				const skill = result[0].skill;
				const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : undefined;
				if (skill !== undefined && typeof onCompare == "function") {
					player.logSkill(result[0].skill);
					result[0].cards = onCompare(player);
				}
				lose_list.push([player, result[0].cards]);
			}
			event.card1 = lose_list[0][1][0];
			if (target && target !== "cardPile" && event.list.includes(target)) {
				const index = event.list.indexOf(target);
				const skill = result[index].skill;
					const onCompare = skill ? getRegisteredSkill(lib.skill, skill)?.onCompare : undefined;
				if (skill !== undefined && typeof onCompare == "function") {
					target.logSkill(result[index].skill);
					result[index].cards = onCompare(target);
				}
				lose_list.push([target, result[index].cards]);
			} else if (target && target !== "cardPile" && typeof target.playerid == "string" && event.fixedResult?.[target.playerid]) {
				lose_list.push([target, [event.fixedResult[target.playerid]]]);
			}
			let card2;
			if (event.compareWithCardPile) {
				if (event.compareType == "top") {
					const cards = get.cards();
					if (!cards.length) {
						event.finish();
						return;
					}
					const ordering = game.cardsGotoOrdering(cards);
					if (ordering) {
						card2 = ordering.cards[0];
					}
				} else if (event.compareType == "bottom") {
					const cards = get.bottomCards();
					if (!cards.length) {
						event.finish();
						return;
					}
					const ordering = game.cardsGotoOrdering(cards);
					if (ordering) {
						card2 = ordering.cards[0];
					}
				}
			} else {
				card2 = lose_list[1][1][0];
			}
			event.card2 = card2;
			event.lose_list = lose_list;
		},
		async (event, trigger, player) => {
			const target = event.target;
			if (target && target !== "cardPile" && (event.card2.number >= 10 || event.card2.number <= 4)) {
				if (target.countCards("h") > 2) {
					event.addToAI = true;
				}
			}
		},
		async (event, trigger, player) => {
			if (event.lose_list.length) {
				game.loseAsync({
					lose_list: event.lose_list,
				}).setContent("chooseToCompareLose");
			}
		},
		async (event, trigger, player) => {
			const target = event.target;
			if (event.isDelay) {
				const cards = [];
				for (const current of event.lose_list) {
					current[0].$giveAuto(current[1], current[0], false);
					cards.addArray(current[1]);
				}
				game.cardsGotoSpecial(cards);
				const evt = event;
				player
					.when({
						global: ["dieAfter", "phaseEnd"],
					})
					.assign({
						forceDie: true,
					})
					.filter((event, player) => event.name == "phase" || [player, target].includes(event.player))
					.step(async (event, trigger, player) => {
						if (cards?.some(card => get.position(card) == "s")) {
							evt.isDestroyed = true;
							await game.cardsGotoOrdering(cards);
							await game.cardsDiscard(cards);
						}
					});
				event.untrigger();
				event.finish();
			} else {
				event.trigger("compareCardShowBefore");
			}
		},
		async (event, trigger, player) => {
			game.broadcastAll(() => ui.arena.classList.add("thrownhighlight"));
			game.addVideo("thrownhighlight1");
			player.$compare(event.card1, event.compareWithCardPile ? player : event.getTarget(), event.card2);
		},
		async (event, trigger, player) => {
			const target = event.target;
			game.log(player, "的拼点牌为", event.card1);
			await player.showCards(event.card1).set("triggeronly", true);
			game.log(event.compareWithCardPile ? "牌堆" : target, "的拼点牌为", event.card2);
			if (event.compareWithCardPile) {
				await player.showCards(event.card2).set("triggeronly", true);
			} else {
				await event.getTarget().showCards(event.card2).set("triggeronly", true);
			}
			const getNum = card => {
				for (const i of event.lose_list) {
					if (i[1].includes(card)) {
						return get.number(card, i[0]);
					}
				}
				return get.number(card, false);
			};
			event.num1 = getNum(event.card1);
			event.num2 = getNum(event.card2);
			event.trigger("compare");
		},
		async (event, trigger, player) => {
			game.delay(0, lib.config.game_speed == "vvfast" ? 4000 : 1500);
		},
		async (event, trigger, player) => {
			event.result = {
				player: event.card1,
				target: event.card2,
				num1: event.num1,
				num2: event.num2,
			};
			event.trigger("compareFixing");
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			const target = event.target;
			if (event.forceWinner === player || (event.forceWinner !== target && event.num1 > event.num2)) {
				event.result.bool = true;
				event.result.winner = player;
				event.str = `${get.translation(player)}拼点成功`;
				player.popup("胜");
				if (target && target !== "cardPile" && get.itemtype(target) == "player") {
					target.popup("负");
				}
			} else {
				event.result.bool = false;
				event.str = `${get.translation(player)}拼点失败`;
				if (event.forceWinner !== target && event.num1 == event.num2) {
					event.result.tie = true;
					player.popup("平");
					if (target && target !== "cardPile" && get.itemtype(target) == "player") {
						target.popup("平");
					}
				} else {
					if (target && target !== "cardPile" && get.itemtype(target) == "player") {
						event.result.winner = target;
					}
					player.popup("负");
					if (target && target !== "cardPile" && get.itemtype(target) == "player") {
						target.popup("胜");
					}
				}
			}
		},
		async (event, trigger, player) => {
			game.broadcastAll(str => {
				const dialog = ui.create.dialog(str);
				dialog.classList.add("center");
				setTimeout(() => dialog.close(), 1000);
			}, event.str);
			game.delay(2);
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			const target = event.target;
			if (target && target !== "cardPile" && typeof target.ai.shown == "number" && target.ai.shown <= 0.85 && event.addToAI) {
				target.ai.shown += 0.1;
			}
			game.broadcastAll(() => ui.arena.classList.remove("thrownhighlight"));
			game.addVideo("thrownhighlight2");
			if (event.clear !== false) {
				game.broadcastAll(ui.clear);
			}
			if (typeof event.preserve == "function") {
				event.preserve = event.preserve(event.result);
			} else if (event.preserve == "win") {
				event.preserve = event.result.bool;
			} else if (event.preserve == "lose") {
				event.preserve = !event.result.bool;
			}
		},
	],
	chooseToCompareEffect: [
		async (event, trigger, player) => {
			const evt = event.parentEvent;
			for (const key of ["target", "card1", "card2", "lose_list", "forceWinner", "clear", "preserve"]) {
				event[key] = evt[key];
			}
			event.result = {};
			if (evt.isDestroyed) {
				event.finish();
				event.untrigger();
				return;
			}
		},
		async (event, trigger, player) => {
			const target = event.getTarget();
			await game.cardsGotoOrdering([event.card1, event.card2]);
			game.log(player, "揭示了和", target, "的延时拼点结果");
			await game.delayx();
			await event.trigger("compareCardShowBefore");
		},
		async (event, trigger, player) => {
			const target = event.getTarget();
			game.broadcastAll(() => ui.arena.classList.add("thrownhighlight"));
			ui.arena.classList.add("thrownhighlight");
			game.addVideo("thrownhighlight1");
			player.$compare(event.card1, target, event.card2);
		},
		async (event, trigger, player) => {
			const target = event.getTarget();
			game.log(player, "的拼点牌为", event.card1);
			game.log(target, "的拼点牌为", event.card2);
			const getNum = card => {
				for (const i of event.lose_list) {
					if (i[1].includes(card)) {
						return get.number(card, i[0]);
					}
				}
				return get.number(card, false);
			};
			event.num1 = getNum(event.card1);
			event.num2 = getNum(event.card2);
			await event.trigger("compare");
		},
		async (event, trigger, player) => {
			await game.delay(0, lib.config.game_speed == "vvfast" ? 4000 : 1500);
		},
		async (event, trigger, player) => {
			event.result = {
				player: event.card1,
				target: event.card2,
				num1: event.num1,
				num2: event.num2,
			};
			await event.trigger("compareFixing");
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			const target = event.getTarget();
			if (event.forceWinner === player || (event.forceWinner !== target && event.num1 > event.num2)) {
				event.result.bool = true;
				event.result.winner = player;
				event.str = `${get.translation(player)}拼点成功`;
				player.popup("胜");
				target.popup("负");
			} else {
				event.result.bool = false;
				event.str = `${get.translation(player)}拼点失败`;
				if (event.forceWinner !== target && event.num1 == event.num2) {
					event.result.tie = true;
					player.popup("平");
					target.popup("平");
				} else {
					event.result.winner = target;
					player.popup("负");
					target.popup("胜");
				}
			}
		},
		async (event, trigger, player) => {
			game.broadcastAll(str => {
				const dialog = ui.create.dialog(str);
				dialog.classList.add("center");
				setTimeout(() => dialog.close(), 1000);
			}, event.str);
			await game.delay(2);
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			const target = event.getTarget();
			if (typeof target.ai.shown == "number" && target.ai.shown <= 0.85 && event.addToAI) {
				target.ai.shown += 0.1;
			}
			game.broadcastAll(() => ui.arena.classList.remove("thrownhighlight"));
			game.addVideo("thrownhighlight2");
			if (event.clear !== false) {
				game.broadcastAll(ui.clear);
			}
			if (typeof event.preserve == "function") {
				event.preserve = event.preserve(event.result);
			} else if (event.preserve == "win") {
				event.preserve = event.result.bool;
			} else if (event.preserve == "lose") {
				event.preserve = !event.result.bool;
			}
		},
		async (event, trigger, player) => {
			await event.trigger("chooseToCompareEnd");
			await event.trigger("chooseToCompareAfter");
		},
	],
	async chooseSkill(event, trigger, player) {
		let list;
		const target = event.target;
		if (!target) {
			throw new Error("chooseSkill requires a target.");
		}
		if (typeof target == "string") {
			list = get.gainableSkillsName(target, event.func);
		} else {
			list = target.getGainableSkills(event.func);
		}
		if (!list.length) {
			event.result = { bool: false };
			return;
		}
		event.skillai = list => get.max(list, get.skillRank, "item");

		let result: string;
		if (event.isMine()) {
			const { promise, resolve } = Promise.withResolvers<string>();
			const dialog = ui.create.dialog("forcebutton");
			dialog.add(event.prompt || "选择获得一项技能");
			_status.event.list = list;
			const clickItem = skill => () => {
				resolve(skill);
			};
			for (const skill of list) {
				if (lib.translate[`${skill}_info`]) {
					let translation = get.translation(skill);
					if (translation[0] == "新" && translation.length == 3) {
						translation = translation.slice(1, 3);
					} else {
						translation = translation.slice(0, 2);
					}
					const item = dialog.add(`<div class="popup pointerdiv" style="width:80%;display:inline-block"><div class="skill">【${translation}】</div><div>${lib.translate[`${skill}_info`]}</div></div>`);
					if (item instanceof HTMLDivElement) {
						const firstChild = item.firstElementChild;
						if (firstChild instanceof HTMLElement) {
							firstChild.addEventListener("click", clickItem(skill));
							Object.assign(firstChild, { link: skill });
						}
					}
				}
			}
			dialog.add(ui.create.div(".placeholder"));
			event.dialog = dialog;
			event.switchToAuto = () => {
				resolve(event.skillai(event.list));
			};
			_status.imchoosing = true;
			result = await promise;
		} else {
			result = event.skillai(list);
		}

		_status.imchoosing = false;
		if (event.dialog) {
			event.dialog.close();
		}
		event.result = { bool: true, skill: result };
	},
	async discoverCard(event, trigger, player) {
		if (typeof event.result === "string") event.result = {};
		const { num = 3 } = event;

		let choice;
		if (typeof event.list == "string" || typeof event.list == "function") {
			choice = get.inpile(event.list).randomGets(num);
		} else if (Array.isArray(event.list)) {
			choice = event.list.randomGets(num);
		} else {
			choice = Array.from(event.list).randomGets(num);
		}

		if (!choice.length) {
			return;
		}

		let prompt = event.prompt;
		if (!prompt) {
			prompt = "选择一张牌";
			if (event.use) {
				prompt += "使用之";
			} else if (!event.nogain) {
				prompt += "获得之";
			}
		}

		let next;
		if (typeof choice[0] === "string") {
			next = player.chooseVCardButton(choice, prompt, event.forced);
			if (event.ai) {
				next.set("ai", event.ai);
			}
		} else if (get.itemtype(choice[0]) == "card") {
			next = player.chooseCardButton(choice, prompt, event.forced);
			if (event.ai) {
				next.set("ai", event.ai);
			}
		} else {
			return;
		}

		const result = await next.forResult();
		if (typeof result === "string" || !result.bool || !Array.isArray(result.links) || !result.links.length) {
			event.result = { bool: typeof result !== "string" && result.bool === true, card: undefined, choice: undefined };
			return;
		}

		event.result = {
			bool: true,
			card: undefined,
			choice: undefined,
		};
		if (result.links.length) {
			const link = result.links[0];
			let togain: Card | undefined;
			if (get.itemtype(link) == "card") {
				event.result.card = link;
				togain = link;
			} else if (Array.isArray(link)) {
				const choiceName = link[2];
				if (typeof choiceName == "string") {
					event.result.choice = choiceName;
					togain = game.createCard(choiceName);
				}
			}
			if (togain) {
				if (event.use) {
					await player.chooseUseTarget({ card: togain });
				} else if (!event.nogain) {
					game.log(player, "获得了一张牌");
					await player.gain({ cards: [togain], animate: "draw" });
				}
			}
		}
	},
	chooseButton: [
		async (event, trigger, player) => {
			if (typeof event.dialog == "number") {
				event.dialog = get.idDialog(event.dialog);
			}
			if (event.createDialog && !event.dialog) {
				if (Array.isArray(event.createDialog)) {
					event.createDialog.add("hidden");
					event.dialog = ui.create.dialog.apply(this, event.createDialog);
				}
				event.closeDialog = true;
			}
			if (event.dialog == undefined) {
				event.dialog = ui.dialog;
			}
			if (event.isMine() || event.dialogdisplay) {
				event.dialog.style.display = "";
				event.dialog.open();
			}

			const filterButton = event.filterButton ?? (() => true);
			const selectButton = get.select(event.selectButton);
			const buttons = event.dialog.buttons;
			const buttonsx: Button[] = [];
			let num = 0;
			for (const button of buttons) {
				if (filterButton(button, player)) {
					num++;
					buttonsx.add(button);
				}
			}
			if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				} else if ((event.direct && num == selectButton[0]) || event.forceDirect) {
					const buttons = buttonsx.slice(0, num);
					event.result = {
						bool: true,
						button: [buttons],
						links: get.links(buttons),
					};
					event.dialog.close();
				} else {
					ui.create.buttonChooseAll();
					game.check();
					game.pause();
				}
			} else if (event.isOnline()) {
				if ((event.direct && num == 1) || event.forceDirect) {
					const buttons = buttonsx.slice(0, num);
					event.result = {
						bool: true,
						button: [buttons],
						links: get.links(buttons),
					};
					event.dialog.close();
				} else {
					event.send();
				}
				delete event.callback;
			} else {
				event.result = "ai";
			}
			if (event.onfree) {
				lib.init.onfree();
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result == "ai") {
				if (await applyLLMDecision(event)) {
					// Keep callback, dialog cleanup and resume behavior below.
				} else if (event.processAI) {
					event.result = event.processAI();
				} else {
					game.check();
					const aiResult = typeof event.ai == "function" ? ai.basic.chooseButton(event.ai) : false;
					if ((aiResult || forced) && (!event.filterOk || event.filterOk())) {
						ui.click.ok();
					} else {
						ui.click.cancel();
					}
				}
			}
			if (event.closeDialog) {
				event.dialog.close();
			}
			if (event.callback) {
				event.callback(event.player, event.result);
			}
			event.resume();
		},
	],
	async chooseCardOL(event, trigger, player) {
		const targets: Player[] = event.list;
		event.targets = targets.slice(0);
		// chooseCardOL only starts chooseCard events. The sole "viewed" producer is
		// viewCards, whose event never enters this aggregation protocol.
		type ChooseCardOLResult = Exclude<EventResult, "viewed">;
		const applySet = (next, set) => {
			for (const [key, value] of set) {
				next.set(key, value);
			}
			return next;
		};
		const chooseRemote = (args, set) => {
			const next = game.getMe().chooseCard(...args);
			for (const [key, value] of set) {
				next.set(key, value);
			}
			game.resume();
		};
		const chooseLocal = (current: Player) => {
			return applySet(current.chooseCard(...event._args), event._set);
		};
		const resolveAiCard = (target: Player): Partial<Result> => {
			try {
				return event.aiCard ? event.aiCard(target) : { bool: false, cards: [] };
			} catch {
				return {};
			}
		};
		const choose = (current: Player) => {
			return new Promise<ChooseCardOLResult>(resolve => {
				if (current.isOnline()) {
					current.wait(result => resolve(result ?? {}));
					current.send(chooseRemote, event._args, event._set);
					return;
				} else if (current === game.me) {
					const next = chooseLocal(game.getMe());
					game.getMe().wait(result => resolve(result ?? {}));
					next.forResult()
						.then(result => game.getMe().unwait(result))
						.catch(() => resolve({}));
				} else {
					const next = chooseLocal(current);
					next.forResult()
						.then(resolve)
						.catch(() => resolve({}));
				}
			});
		};
		const toCardResult = (result: ChooseCardOLResult, target: Player): Partial<Result> => {
			if (result === "ai") {
				return resolveAiCard(target);
			}
			if (result === "cancelled") {
				return { bool: false, cards: [] };
			}
			return result;
		};

		let results: Partial<Result>[];
		if (_status.connectMode) {
			const events: Promise<Partial<Result>>[] = targets.map(async target => {
				try {
					const result = await choose(target);
					return toCardResult(result, target);
				} catch {
					return {};
				}
			});
			results = await Promise.all(events);
		} else {
			results = [];
			for (const target of targets) {
				const result = await chooseLocal(target).forResult().catch(() => ({}));
				results.push(toCardResult(result, target));
			}
		}

		event.result = results;
	},
	async chooseButtonOL(event, trigger, player) {
		const list = event.list;

		const chooseRemote = (args, callback, switchToAuto, processAI) => {
			const next = game.getMe().chooseButton(...args);
			next.callback = callback;
			next.switchToAuto = switchToAuto;
			next.processAI = processAI;
			next.complexSelect = true;
			game.resume();
		};
		const chooseLocal = (current: Player, args) => {
			const next = current.chooseButton(...args);
			next.callback = event.callback;
			next.switchToAuto = event.switchToAuto;
			next.processAI = event.processAI;
			return next;
		};
		const choose = (current: Player, args) => {
			return new Promise<EventResult>(resolve => {
				let settled = false;
				const finish = (result: EventResult) => {
					if (settled) {
						return;
					}
					settled = true;
					resolve(result);
				};
				const chooseAuto = () => {
					if (settled) {
						return;
					}
					const next = chooseLocal(current, args);
					next.forResult()
						.then(result => finish(normalizeSelectionResult(result)))
						.catch(() => finish({}));
				};
				if (current.isOnline()) {
					current.wait(result => {
						if (result === "ai") {
							chooseAuto();
							return () => game.resume();
						}
						finish(result ?? {});
					});
					current.send(chooseRemote, args, event.callback, event.switchToAuto, event.processAI);
					return;
				} else if (current === game.me) {
					const next = chooseLocal(game.getMe(), args);
					game.getMe().wait(result => finish(result ?? {}));
					next.forResult()
						.then(result => game.getMe().unwait(result))
						.catch(() => finish({}));
				} else {
					const next = chooseLocal(current, args);
					next.forResult()
						.then(result => finish(normalizeSelectionResult(result)))
						.catch(() => finish({}));
				}
			});
		};

		let results: Record<string, Partial<Result>>;
		if (_status.connectMode) {
			const events = list.map(async ([target, ...args]) => {
				try {
					const result = await choose(target, args);
					return { target, result };
				} catch {
					return { target, result: {} };
				}
			});
			results = {};
			for (const { target, result } of await Promise.all(events)) {
				if (typeof target.playerid == "string") {
					results[target.playerid] = result === "cancelled" ? { bool: false, buttons: [] } : result;
				}
			}
		} else {
			results = {};
			for (const [target, ...args] of list) {
				const result = await chooseLocal(target, args).forResult().catch(() => ({}));
				if (typeof target.playerid == "string") {
					results[target.playerid] = result === "cancelled" ? { bool: false, buttons: [] } : result;
				}
			}
		}

		event.result = results;
	},
	async chooseAnyOL(event, trigger, player) {
		const { func, args } = event;
		const targets = event.getTargets();
		const map = new Map();
		const locals = targets.slice();
		const humans = targets.filter(current => current === game.me || current.isOnline());
		//分别处理人类玩家和其他玩家
		locals.removeArray(humans);
		const eventId = get.id();
		const send = (...sendArgs) => {
			const [func, ...args] = sendArgs;
			func(...args);
			game.resume();
		};
		//让读条不消失
		event._global_waiting = true;
		let time = 10000;
		if (lib.configOL && lib.configOL.choose_timeout) {
			time = parseInt(lib.configOL.choose_timeout) * 1000;
		}
		targets.forEach(current => current.showTimer(time));
		if (humans.length > 0) {
			const solve = (resolve, reject) => (result, player) => {
				if (result) {
					map.set(player, result);
				}
				resolve();
			};
			await Promise.all(
				humans.map(
					current =>
						new Promise((resolve, reject) => {
							if (current.isOnline()) {
								current.send(send, func, current, ...args, eventId);
								current.wait(solve(resolve, reject));
							} else {
								const next = func(current, ...args, eventId);
								const solver = solve(resolve, reject);
								if (_status.connectMode) {
									game.getMe().wait(solver);
								}
								return next.forResult().then(result => {
									if (_status.connectMode) {
										game.getMe().unwait(result, current);
									} else {
										solver(result, current);
									}
								});
							}
						})
				)
			).catch(() => {});
			game.broadcastAll("cancel", eventId);
		}
		if (locals.length > 0) {
			//模拟ai先后作答
			for (const current of locals.randomSort()) {
				const result = await func(current, ...args, eventId).forResult();
				if (result) {
					map.set(current, result);
				}
			}
		}
		//清除读条
		delete event._global_waiting;
		targets.forEach(current => current.hideTimer(time));
		event.result = map;
	},
	chooseCard: [
		async (event, trigger, player) => {
			if (event.directresult) {
				event.result = {
					buttons: [],
					cards: event.directresult.slice(0),
					targets: [],
					confirm: "ok",
					bool: true,
					links: [],
				};
			} else if (event.autochoose()) {
				event.result = {
					bool: true,
					autochoose: true,
					cards: player.getCards(event.position),
					confirm: "ok",
					buttons: [],
					targets: [],
					links: [],
				};
			} else {
				if (event.isMine()) {
					game.check();
					game.pause();
					if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
						ui.click.cancel();
						return;
					}
					if (event.custom === undefined) {
						event.custom = {
							add: {},
							replace: {},
						};
					}
					ui.create.cardChooseAll();
					if (event.prompt != false) {
						let str;
						if (typeof event.prompt == "string") {
							str = event.prompt;
						} else {
							str = "请选择";
							const range = get.select(event.selectCard);
							if (range[0] == range[1]) {
								str += get.cnNumber(range[0]);
							} else if (range[1] == Infinity) {
								str += `至少${get.cnNumber(range[0])}`;
							} else {
								str += `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
							}
							str += "张";
							if (event.position == "h" || event.position == undefined) {
								str += "手";
							}
							if (event.position == "e") {
								str += "装备";
							}
							str += "牌";
						}
						event.dialog = ui.create.dialog(str);
						if (event.prompt2) {
							event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
						}
						if (Array.isArray(event.promptx)) {
							for (const prompt of event.promptx) {
								event.dialog.add(prompt);
							}
						}
						if (Array.isArray(event.selectCard)) {
							event.promptbar = event.dialog.add(`0/${get.numStr(event.selectCard[1], "card")}`);
							if (event.custom.add.card === undefined) {
								event.custom.add.card = () => {
									_status.event.promptbar.innerHTML = `${ui.selected.cards.length}/${get.numStr(_status.event.selectCard[1], "card")}`;
								};
							}
						}
					}
				} else if (event.isOnline()) {
					event.send();
				} else {
					event.result = "ai";
				}
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result != "ai") {
				return;
			}
			if (await applyLLMDecision(event)) {
				return;
			} else if (event.processAI) {
				event.result = event.processAI();
			} else {
				game.check();
				if ((ai.basic.chooseCard(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
					ui.click.ok();
				} else if (event.skill) {
					const skill = event.skill;
					ui.click.cancel();
					event._aiexclude.add(skill);
					event.redo();
					game.resume();
				} else {
					ui.click.cancel();
				}
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			event.resume();
			if (event.cardChooseAll) {
				event.cardChooseAll.close();
			}
			if (event.glow_result && event.result.cards && !event.directresult) {
				for (const card of event.result.cards) {
					card.classList.add("glow");
				}
			}
			if (event.dialog) {
				event.dialog.close();
			}
		},
	],
	chooseTarget: [
		async (event, trigger, player) => {
			const skills = player.getSkills("invisible").concat(lib.skill.global);
			game.expandSkills(skills);
			for (const skill of skills) {
				const info = getRegisteredSkill(lib.skill, skill);
				if (info?.onChooseTarget) {
					info.onChooseTarget(event, player);
				}
			}
			if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				}
				game.check();
				game.pause();
				if (event.createDialog && !event.dialog && Array.isArray(event.createDialog)) {
					event.dialog = ui.create.dialog.apply(this, event.createDialog);
				} else if (event.prompt != false) {
					let str;
					if (typeof event.prompt == "string") {
						str = event.prompt;
					} else {
						str = "请选择";
						const range = get.select(event.selectTarget);
						if (range[0] == range[1]) {
							str += get.cnNumber(range[0]);
						} else if (range[1] == Infinity) {
							str += `至少${get.cnNumber(range[0])}`;
						} else {
							str += `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
						}
						str += "个目标";
					}
					event.dialog = ui.create.dialog(str);
					if (event.prompt2) {
						event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
					}
					if (event.promptbar != "none") {
						event.promptbar = event.dialog.add(`0/${get.numStr(get.select(event.selectTarget)[1], "target")}`);
						event.custom.add.target = () => {
							_status.event.promptbar.innerHTML = `${ui.selected.targets.length}/${get.numStr(get.select(event.selectTarget)[1], "target")}`;
						};
					}
				} else if (get.itemtype(event.dialog) == "dialog") {
					event.dialog.open();
				}
			} else if (event.isOnline()) {
				event.send();
			} else {
				event.result = "ai";
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (isAIResult(event.result)) {
				if (await applyLLMDecision(event)) {
					// Keep target animation and dialog cleanup below.
				} else if (event.processAI) {
					event.result = event.processAI();
				} else {
					game.check();
					if ((ai.basic.chooseTarget(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
						ui.click.ok();
					} else {
						ui.click.cancel();
					}
				}
			}
			if (typeof event.result === "string" || isImportModePayload(event.result)) event.result = {};
			if (event.result.bool && event.animate !== false && Array.isArray(event.result.targets)) {
				for (const target of event.result.targets) {
					target.addTempClass("target");
				}
			}
			if (event.dialog) {
				event.dialog.close();
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string") event.result = {};
			if (event.onresult) {
				event.onresult(event.result);
			}
			if (typeof event.result === "string") event.result = {};
			if (event.result.bool && event.autodelay && !event.isMine()) {
				if (typeof event.autodelay == "number") {
					await game.delayx(event.autodelay);
				} else {
					await game.delayx();
				}
			}
		},
	],
	chooseCardTarget: [
		async (event, trigger, player) => {
			if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				}
				ui.create.cardChooseAll();
				game.check();
				game.pause();
				if (event.prompt != false) {
					event.dialog = ui.create.dialog(event.prompt || "请选择卡牌和目标");
					if (event.prompt2) {
						event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
					}
				}
			} else if (event.isOnline()) {
				event.send();
			} else {
				event.result = "ai";
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result != "ai") {
				return;
			}
			if (await applyLLMDecision(event)) {
				return;
			} else if (event.processAI) {
				event.result = event.processAI();
			} else {
				game.check();
				if (ai.basic.chooseCard(event.ai1) || forced) {
					if ((ai.basic.chooseTarget(event.ai2) || forced) && (!event.filterOk || event.filterOk())) {
						ui.click.ok();
						_status.event._aiexclude.length = 0;
					} else {
						ui.click.cancel();
					}
				} else {
					ui.click.cancel();
				}
			}
		},
		async (event, trigger, player) => {
			event.resume();
			if (event.cardChooseAll) {
				event.cardChooseAll.close();
			}
			if (typeof event.result !== "string" && event.result.bool && event.animate !== false && Array.isArray(event.result.targets)) {
				for (const target of event.result.targets) {
					target.addTempClass("target");
				}
			}
			if (event.dialog) {
				event.dialog.close();
			}
		},
	],
	//先选择按钮再选择目标的函数，可以简化一些交互流程，目前可以隐藏弹窗
	//该事件目前采用async contents的写法
	chooseButtonTarget: [
		async (event, _trigger, player) => {
			//根据player.chooseButtonTarget获取到的dialog信息创建对话框，也支持createDialog
			if (typeof event.dialog == "number") {
				event.dialog = get.idDialog(event.dialog);
			}
			if (event.createDialog && !event.dialog) {
				if (Array.isArray(event.createDialog)) {
					event.createDialog.add("hidden");
					event.dialog = ui.create.dialog.apply(this, event.createDialog);
				}
				event.closeDialog = true;
			}
			if (event.dialog == undefined) {
				event.dialog = ui.dialog;
			}
			if (event.isMine() || event.dialogdisplay) {
				event.dialog.style.display = "";
				event.dialog.open();
			}
			if (event.isMine()) {
				if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
					ui.click.cancel();
					return;
				}
				if (event.canHidden) {
					//增加隐藏窗口的按钮
					const func = (_event: GameEvent) => {
						const event = get.event();
						const controls: Array<string | ((link: string) => void)> = [
							link => {
								ui.selected.buttons.length = 0;
								game.check();
								return;
							},
						];
						event.controls = [
							ui.create.control(
								controls.concat([
									"隐藏窗口",
									"stayleft",
									link => {
										const control = event.controls[0];
										if (event.dialog.style.display == "none") {
											control.childNodes[0].innerHTML = "隐藏窗口";
											event.dialog.style.display = "";
										} else {
											control.childNodes[0].innerHTML = "显示窗口";
											event.dialog.style.display = "none";
										}
									},
								])
							),
						];
					};
					if (event.isMine()) {
						func(event);
					} else if (event.isOnline()) {
						event.getPlayer().send(func, event);
					}
					if (event.custom == undefined) {
						event.custom = {
							add: {},
							replace: {},
						};
					}
					const addConfirm = event.custom.add.confirm;
					event.custom.add.confirm = bool => {
						if (typeof bool != "boolean") {
							return;
						}
						const event = get.event();
						if (event.controls) {
							event.controls.forEach(i => i.close());
						}
						if (ui.confirm) {
							ui.confirm.close();
						}
						if (typeof addConfirm == "function") {
							addConfirm.call(this, bool);
						}
						game.uncheck();
					};
				}
				ui.create.buttonChooseAll();
				game.check();
				game.pause();
				} else if (event.isOnline()) {
					const result = await event.sendAsync();
					event.result = normalizeChooseButtonTargetResult(result);
			} else {
				//考虑中途托管的情况
				event.result = "ai";
			}
		},
		async (event, _trigger, player, result) => {
			//处理ai的选择结果
			if (event.result != "ai") {
				return;
			}

			if (await applyLLMDecision(event)) {
				return;
			} else if (event.processAI) {
				event.result = event.processAI();
			} else {
				game.check();
				if (ai.basic.chooseButton(event.ai1) || event.forced) {
					if ((ai.basic.chooseTarget(event.ai2) || event.forced) && (!event.filterOk || event.filterOk())) {
						ui.click.ok();
						_status.event._aiexclude.length = 0;
					} else {
						ui.click.cancel();
					}
				} else {
					ui.click.cancel();
				}
			}
		},
		async (event, _trigger, player, result) => {
			//处理选择的结果
			event.resume();
			if (typeof event.result !== "string" && event.result.bool && event.animate !== false && Array.isArray(event.result.targets)) {
				for (const target of event.result.targets) {
					target.addTempClass("target");
				}
			}
			if (event.dialog) {
				event.dialog.close();
			}
		},
	],
	chooseControl: [
		async (event, trigger, player) => {
			if (event.controls.length == 0) {
				if (event.sortcard) {
					let sortnum = 2;
					if (event.sorttop) {
						sortnum = 1;
					}
					for (let i = 0; i < event.sortcard.length + sortnum; i++) {
						event.controls.push(get.cnNumber(i, true));
					}
				} else if (event.choiceList) {
					for (const [i] of event.choiceList.entries()) {
						event.controls.push(`选项${get.cnNumber(i + 1, true)}`);
					}
				} else {
					event.finish();
					return;
				}
			} else if (event.choiceList && event.controls.length == 1 && event.controls[0] == "cancel2") {
				event.controls.shift();
				for (const [i] of event.choiceList.entries()) {
					event.controls.push(`选项${get.cnNumber(i + 1, true)}`);
				}
				// ?
				event.controls.push("cancel2");
			}

			if (event.isMine()) {
				if (event.arrangeSkill) {
					const hidden = player.hiddenSkills.slice(0);
					game.expandSkills(hidden);
					if (hidden.length) {
						for (const control of event.controls) {
							if (_status.prehidden_skills.includes(control) && hidden.includes(control)) {
								event.result = {
									bool: true,
									control,
								};
								return;
							}
						}
					}
				} else if (event.hsskill && _status.prehidden_skills.includes(event.hsskill) && event.controls.includes("cancel2")) {
					event.result = {
						bool: true,
						control: "cancel2",
					};
					return;
				}
				if (event.sortcard) {
					let prompt = event.prompt || "选择一个位置";
					if (event.tosort) {
						prompt += `放置${get.translation(event.tosort)}`;
					}
					event.dialog = ui.create.dialog(prompt, "hidden");
					if (event.sortcard && event.sortcard.length) {
						event.dialog.addSmall(event.sortcard);
					} else {
						event.dialog.buttons = [];
						event.dialog.add(ui.create.div(".buttons"));
					}
					const buttons = event.dialog.content.lastChild;
					let sortnum = 2;
					if (event.sorttop) {
						sortnum = 1;
					}
					for (let i = 0; i < event.dialog.buttons.length + sortnum; i++) {
						const item = Object.assign(ui.create.div(".button.card.pointerdiv.mebg"), { link: String(get.cnNumber(i, true)) });
						item.style.width = "50px";
						buttons.insertBefore(item, event.dialog.buttons[i]);
						item.innerHTML = `<div style="font-family: xinwei;font-size: 25px;height: 75px;line-height: 25px;top: 8px;left: 10px;width: 30px;">第${get.cnNumber(i + 1, true)}张</div>`;
						if (i == event.dialog.buttons.length + 1) {
							const firstChild = item.firstChild;
							if (firstChild instanceof HTMLElement) {
								firstChild.innerHTML = "牌堆底";
							}
						}
						item.listen(ui.click.dialogcontrol);
					}

					event.dialog.forcebutton = true;
					event.dialog.classList.add("forcebutton");
					event.dialog.open();
				} else if (event.dialogcontrol) {
					event.dialog = ui.create.dialog(event.prompt || "选择一项", "hidden");
					for (const control of event.controls) {
						const item = event.dialog.add(`<div class="popup text pointerdiv" style="width:calc(100% - 10px);display:inline-block">${control}</div>`);
						item.firstChild.listen(ui.click.dialogcontrol);
						item.firstChild.link = control;
					}
					event.dialog.forcebutton = true;
					event.dialog.classList.add("forcebutton");
					if (event.addDialog) {
						for (const dialog of event.addDialog) {
							if (get.itemtype(dialog) == "cards") {
								event.dialog.addSmall(dialog);
							} else {
								event.dialog.add(dialog);
							}
						}
						event.dialog.add(ui.create.div(".placeholder.slim"));
					}
					event.dialog.open();
				} else {
					if (event.seperate || lib.config.seperate_control) {
						const controls = event.controls.slice(0);
						controls.remove("cancel2");
						if ((event.direct && controls.length == 1) || event.forceDirect) {
							event.result = {
								control: event.controls[0],
								links: get.links([event.controls[0]]),
							};
							return;
						} else {
							event.controlbars = [];
							for (const control of event.controls) {
								event.controlbars.push(ui.create.control([control]));
							}
						}
					} else {
						const controls = event.controls.slice(0);
						controls.remove("cancel2");
						if ((event.direct && controls.length == 1) || event.forceDirect) {
							event.result = {
								control: event.controls[0],
								links: get.links([event.controls[0]]),
							};
							return;
						}
						event.controlbar = ui.create.control(event.controls);
					}
					if (event.dialog) {
						if (Array.isArray(event.dialog)) {
							event.dialog = ui.create.dialog.apply(this, event.dialog);
						}
						event.dialog.open();
					} else if (event.choiceList) {
						event.dialog = ui.create.dialog(event.prompt || "选择一项", "hidden");
						event.dialog.forcebutton = true;
						event.dialog.open();
						for (const [i, choice] of event.choiceList.entries()) {
							event.dialog.add(`<div class="popup text" style="width:calc(100% - 10px);display:inline-block">${event.displayIndex !== false ? `选项${get.cnNumber(i + 1, true)}：` : ""}${choice}</div>`);
						}
					} else if (event.prompt) {
						event.dialog = ui.create.dialog(event.prompt);
						if (event.prompt2) {
							event.dialog.addText(event.prompt2, Boolean(event.prompt2.length <= 20 || event.centerprompt2));
						}
					}
				}
				game.pause();
				game.countChoose();
				event.choosing = true;
			} else if (event.isOnline()) {
				event.send();
			} else {
				event.result = "ai";
			}
		},
		async (event, trigger, player) => {
			if (event.result == "ai") {
				if (await applyLLMDecision(event)) {
					// Keep the shared cleanup below: it sets index and resumes the event.
				} else {
					event.result = {};
					if (event.ai) {
						const result = event.ai(event.getParent(), player);
						if (typeof result == "number") {
							event.result.control = event.controls[result];
						} else {
							event.result.control = result;
						}
					} else {
						event.result.control = event.controls[event.choice];
					}
				}
			}
			const result = normalizeSelectionResult(event.result);
			if (typeof result !== "string") {
				result.index = event.controls.indexOf(result.control);
			}
			event.result = result;
			event.choosing = false;
			_status.imchoosing = false;
			if (event.dialog && event.dialog.close) {
				event.dialog.close();
			}
			if (event.controlbar) {
				event.controlbar.close();
			}
			if (event.controlbars) {
				for (const controlBar of event.controlbars) {
					controlBar.close();
				}
			}
			event.resume();
		},
	],
	async chooseBool(event, trigger, player) {
		if (event.isMine()) {
			if (event.frequentSkill && !lib.config.autoskilllist.includes(event.frequentSkill)) {
				ui.click.ok();
				return;
			} else if (event.hsskill && _status.prehidden_skills.includes(event.hsskill)) {
				ui.click.cancel();
				return;
			}
			ui.create.confirm("oc");
			if (event.createDialog && !event.dialog) {
				if (Array.isArray(event.createDialog)) {
					event.dialog = ui.create.dialog.apply(this, event.createDialog);
					if (event.dialogselectx) {
						for (const button of event.dialog.buttons) {
							button.classList.add("selectedx");
						}
					}
				}
			}
			if (event.dialog) {
				event.dialog.open();
			} else if (event.prompt) {
				event.dialog = ui.create.dialog(event.prompt);
				if (event.prompt2) {
					event.dialog.addText(event.prompt2, event.prompt2.length <= 20);
				}
			}

			game.countChoose();
			event.choosing = true;
			await game.pause();
			} else if (event.isOnline()) {
				const result = await event.sendAsync();
				event.result = normalizeSelectionResult(result);
		} else {
			event.result = "ai";
		}

		if (event.result == "ai") {
			// LLM 失败或拒绝该事件时保持既有本地 AI 降级。
			if (!(await applyLLMDecision(event))) {
				if (event.ai) {
					event.choice = event.ai(event.getParent(), player);
				}
				event.result = { bool: event.choice };
			}
		}
		_status.imchoosing = false;
		event.choosing = false;
		if (event.dialog) {
			event.dialog.close();
		}
		game.resume();
	},
	async chooseDrawRecover(event, trigger, player) {
		const { forced } = event;
		const target = event.getTarget();
		const controls = ["draw_card"];
		if (target.isDamaged()) {
			event.num2 = Math.min(event.num2, target.getDamagedHp());
			controls.push("recover_hp");
		}
		if (!forced) {
			controls.push("cancel2");
		}
		let result;
		if (controls.length == 1) {
			result = { control: controls[0] };
		} else {
			const prompt =
				event.prompt ||
				(() => {
					let str = ``;
					if (!forced) {
						str += `是否`;
					}
					if (player !== target) {
						str += `令${get.translation(target)}`;
					}
					str += `摸${get.cnNumber(event.num1)}张牌`;
					if (target.isDamaged()) {
						str += `或回复${event.num2}点体力`;
					}
					if (!forced) {
						str += `？`;
					}
					return str;
				})();
			const next = player.chooseControl(controls);
			next.set("prompt", prompt);
			if (event.hsskill) {
				next.setHiddenSkill(event.hsskill);
			}
			next.set(
				"ai",
				event.ai ||
					(() => {
						const player = get.player();
						const parent = get.event().getParent(undefined, true);
						if (!parent) {
							throw new Error("chooseDrawRecover requires a parent event.");
						}
						const target = parent.getTarget();
						const { num1, num2 } = parent;
						const att = get.attitude(player, target);
						const choices = get.event().controls.slice();
						const eff1 = get.recoverEffect(target, player, player);
						const eff2 = get.effect(target, { name: "draw" }, player, player) * 2;
						if (choices.includes("recover_hp") && eff1 > 0 && (target.hp == 1 || target.needsToDiscard() || target.hasSkillTag("maixie_hp") || num2 > num1 || (num2 == num1 && target.needsToDiscard(1)))) {
							return "recover_hp";
						}
						if (eff2 > 0) {
							return "draw_card";
						}
						if (choices.includes("cancel2") && att <= 0) {
							return "cancel2";
						}
						return choices.randomGet();
					})
			);
			result = await next.forResult();
		}
		if (result?.control != "cancel2") {
			if (event.logSkill) {
				if (typeof event.logSkill == "string") {
					player.logSkill(event.logSkill);
				} else if (Array.isArray(event.logSkill)) {
					forwardEventLogSkill(player, event.logSkill);
				}
			}
			if (result?.control == "draw_card") {
				const next = target.draw(event.num1);
				next.gaintag.addArray(event.gaintag);
				await next;
			} else if (result?.control == "recover_hp") {
				await target.recover(event.num2);
			}
		}
		event.result = result;
	},
	choosePlayerCard: [
		async (event, trigger, player) => {
			const target = event.getTarget();

			if (!event.dialog) {
				event.dialog = ui.create.dialog("hidden");
			} else if (!event.isMine()) {
				event.dialog.style.display = "none";
			}
			const select = get.select(event.selectButton);
			if (event.prompt == undefined) {
				let str = `请选择${get.translation(target)}的`;
				if (select[0] == select[1]) {
					str += get.cnNumber(select[0]);
				} else if (select[1] == Infinity) {
					str += `至少${get.cnNumber(select[0])}`;
				} else {
					str += `${get.cnNumber(select[0])}至${get.cnNumber(select[1])}`;
				}
				str += "张";
				if (event.position == "h" || event.position == undefined) {
					str += "手";
				}
				if (event.position == "e") {
					str += "装备";
				}
				str += "牌";
				event.prompt = str;
			}
			event.dialog.add(event.prompt);
			if (event.prompt2) {
				event.dialog.addText(event.prompt2);
			}
			let expand_length = 0;
			const cs = target.getCards(event.position);
			const directFilter = event.forced && typeof event.filterOk != "function" && typeof event.selectButton != "function" && event.filterButton == lib.filter.all;
			let directh = !lib.config.unauto_choose && !event.isOnline() && select[0] == select[1] && (!event.complexSelect || select[1] === 1);

			for (const position of event.position) {
				if (position == "h") {
					const hs = target.getCards("h");
					if (hs.length) {
						expand_length += Math.ceil(hs.length / 6);
						const title = event.dialog.add('<div class="text center" style="margin: 0px;">手牌区</div>');
						title.style.margin = "0px";
						title.style.padding = "0px";
						hs.randomSort();
						if (event.visible || target.isUnderControl(true, player) || player.hasSkillTag("viewHandcard", null, target, true)) {
							event.dialog.add(hs);
							directh = false;
						} else {
							const shown = hs.filter(card => get.is.shownCard(card));
							if (shown.length) {
								const hidden = hs.filter(card => !shown.includes(card));
								const buttons = ui.create.div(".buttons", event.dialog.content);
								event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
								event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
								if (event.dialog.forcebutton !== false) {
									event.dialog.forcebutton = true;
								}
								if (event.dialog.buttons.length > 3) {
									event.dialog.classList.remove("forcebutton-auto");
								} else if (!event.dialog.noforcebutton) {
									event.dialog.classList.add("forcebutton-auto");
								}
								directh = false;
							} else {
								event.dialog.add([hs, "blank"]);
							}
						}
					}
				} else if (position == "e") {
					const es = target.getCards("e");
					if (es.length) {
						expand_length += Math.ceil(es.length / 6);
						const title = event.dialog.add('<div class="text center" style="margin: 0px;">装备区</div>');
						title.style.margin = "0px";
						title.style.padding = "0px";
						event.dialog.add(es);
						directh = false;
					}
				} else if (position == "j") {
					const js = target.getCards("j");
					if (js.length) {
						expand_length += Math.ceil(js.length / 6);
						const title = event.dialog.add('<div class="text center" style="margin: 0px;">判定区</div>');
						title.style.margin = "0px";
						title.style.padding = "0px";
						const shown = js.filter(card => {
							const name = card.viewAs || card.name;
							const info = lib.card[name];
							if (!info || !info.blankCard) {
								return true;
							}
							return false;
						});
						if (shown.length < js.length && !target.isUnderControl(true)) {
							const hidden = js.filter(card => !shown.includes(card));
							const buttons = ui.create.div(".buttons", event.dialog.content);
							event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
							event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
							if (event.dialog.forcebutton !== false) {
								event.dialog.forcebutton = true;
							}
							if (event.dialog.buttons.length > 3) {
								event.dialog.classList.remove("forcebutton-auto");
							} else if (!event.dialog.noforcebutton) {
								event.dialog.classList.add("forcebutton-auto");
							}
						} else {
							event.dialog.add(js);
						}
						directh = false;
					}
				}
			}
			if (event.dialog.buttons.length == 0) {
				event.finish();
				return;
			}
			if (directFilter && select[0] >= cs.length) {
				event.result = {
					bool: true,
					buttons: event.dialog.buttons,
					links: cs,
				};
			} else if (directFilter && directh) {
				const buttons = event.dialog.buttons.randomGets(select[0]);
				event.result = {
					bool: true,
					buttons,
					links: [],
				};
				for (const button of buttons) {
					event.result.links?.push(button.link);
				}
			} else {
				if (event.isMine()) {
					if (event.hsskill && !event.forced && _status.prehidden_skills.includes(event.hsskill)) {
						ui.click.cancel();
						return;
					}
					event.dialog.open();
					ui.create.buttonChooseAll();
					game.check();
					game.pause();
					if (expand_length > 2) {
						ui.arena.classList.add("choose-player-card");
						event.dialog.classList.add("fullheight");
					}
				} else if (event.isOnline()) {
					event.send();
				} else {
					event.result = "ai";
				}
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result == "ai") {
				game.check();
				if ((ai.basic.chooseButton(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
					ui.click.ok();
				} else {
					ui.click.cancel();
				}
			}
			event.dialog.close();
			if (typeof event.result !== "string" && isCardLinks(event.result.links)) {
				event.result.cards = event.result.links.slice(0);
			}
			event.resume();
			delay(500).then(() => void ui.arena.classList.remove("choose-player-card"));
		},
	],
	discardPlayerCard: [
		async (event, trigger, player) => {
			const target = event.getTarget();

			if (event.directresult) {
				event.result = {
					buttons: [],
					cards: event.directresult.slice(0),
					links: event.directresult.slice(0),
					targets: [],
					confirm: "ok",
					bool: true,
				};
				event.cards = event.directresult.slice(0);
				event.goto(2);
				return;
			}

			if (!event.dialog) {
				event.dialog = ui.create.dialog("hidden");
			} else if (!event.isMine()) {
				event.dialog.style.display = "none";
			}

			if (event.prompt == null) {
				let str = `弃置${get.translation(target)}`;
				const range = get.select(event.selectButton);
				if (range[0] == range[1]) {
					str += get.cnNumber(range[0]);
				} else if (range[1] == Infinity) {
					str += `至少${get.cnNumber(range[0])}`;
				} else {
					str += `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
				}
				str += "张";
				if (event.position == "h" || event.position == undefined) {
					str += "手";
				}
				if (event.position == "e") {
					str += "装备";
				}
				str += "牌";
				event.prompt = str;
			}
			if (event.prompt) {
				event.dialog.add(event.prompt);
			}
			if (event.prompt2) {
				event.dialog.addText(event.prompt2);
			}

			let expand_length = 0;
			const cs = target.getCards(event.position);
			const select = get.select(event.selectButton);
			const directFilter = event.forced && typeof event.filterOk != "function" && typeof event.selectButton != "function" && event.filterButton == lib.filter.all;
			let directh = !lib.config.unauto_choose && !event.isOnline() && select[0] == select[1] && (!event.complexSelect || select[1] === 1);

			for (const position of event.position) {
				if (position == "h") {
					const hs = target.getDiscardableCards(player, "h");
					expand_length += Math.ceil(hs.length / 6);
					if (hs.length) {
						const title = event.dialog.add('<div class="text center" style="margin: 0px;">手牌区</div>');
						title.style.margin = "0px";
						title.style.padding = "0px";
						hs.randomSort();
						if (event.visible || target.isUnderControl(true, player) || player.hasSkillTag("viewHandcard", null, target, true)) {
							event.dialog.add(hs);
							directh = false;
						} else {
							const shown = hs.filter(card => get.is.shownCard(card));
							if (shown.length) {
								const hidden = hs.filter(card => !shown.includes(card));
								const buttons = ui.create.div(".buttons", event.dialog.content);
								event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
								event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
								if (event.dialog.forcebutton !== false) {
									event.dialog.forcebutton = true;
								}
								if (event.dialog.buttons.length > 3) {
									event.dialog.classList.remove("forcebutton-auto");
								} else if (!event.dialog.noforcebutton) {
									event.dialog.classList.add("forcebutton-auto");
								}
								directh = false;
							} else {
								event.dialog.add([hs, "blank"]);
							}
						}
					}
				} else if (position == "e") {
					const es = target.getDiscardableCards(player, "e");
					if (es.length) {
						expand_length += Math.ceil(es.length / 6);
						const title = event.dialog.add('<div class="text center" style="margin: 0px;">装备区</div>');
						title.style.margin = "0px";
						title.style.padding = "0px";
						event.dialog.add(es);
						directh = false;
					}
				} else if (position == "j") {
					const js = target.getDiscardableCards(player, "j");
					if (js.length) {
						expand_length += Math.ceil(js.length / 6);
						const title = event.dialog.add('<div class="text center" style="margin: 0px;">判定区</div>');
						title.style.margin = "0px";
						title.style.padding = "0px";
						const shown = js.filter(card => {
							const name = card.viewAs || card.name;
							const info = lib.card[name];
							if (!info || !info.blankCard) {
								return true;
							}
							return false;
						});
						if (shown.length < js.length && !target.isUnderControl(true)) {
							const hidden = js.filter(card => !shown.includes(card));
							const buttons = ui.create.div(".buttons", event.dialog.content);
							event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
							event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
							if (event.dialog.forcebutton !== false) {
								event.dialog.forcebutton = true;
							}
							if (event.dialog.buttons.length > 3) {
								event.dialog.classList.remove("forcebutton-auto");
							} else if (!event.dialog.noforcebutton) {
								event.dialog.classList.add("forcebutton-auto");
							}
						} else {
							event.dialog.add(js);
						}
						directh = false;
					}
				}
			}
			if (event.dialog.buttons.length == 0) {
				event.result = {
					bool: false,
				};
				event.dialog.close();
				event.finish();
				return;
			}

			if (directFilter && select[0] >= cs.length) {
				event.result = {
					bool: true,
					buttons: event.dialog.buttons,
					links: cs,
				};
			} else if (directFilter && directh) {
				const buttons = event.dialog.buttons.randomGets(select[0]);
				event.result = {
					bool: true,
					buttons,
					links: [],
				};
				for (const button of buttons) {
					event.result.links?.push(button.link);
				}
			} else {
				if (event.isMine()) {
					event.dialog.open();
					ui.create.buttonChooseAll();
					game.check();
					game.pause();
					if (expand_length > 2) {
						ui.arena.classList.add("discard-player-card");
						event.dialog.classList.add("fullheight");
					}
				} else if (event.isOnline()) {
					event.send();
				} else {
					event.result = "ai";
				}
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result == "ai") {
				game.check();
				if ((ai.basic.chooseButton(event.ai) || forced) && (!event.filterOk || event.filterOk())) {
					ui.click.ok();
				} else {
					ui.click.cancel();
				}
			}
			event.dialog.close();
		},
		async (event, trigger, player) => {
			event.resume();
			delay(500).then(() => void ui.arena.classList.remove("discard-player-card"));
			if (typeof event.result !== "string" && event.result.bool && isCardLinks(event.result.links) && !game.online) {
				if (event.logSkill) {
					if (typeof event.logSkill == "string") {
						player.logSkill(event.logSkill);
					} else if (Array.isArray(event.logSkill)) {
						forwardEventLogSkill(player, event.logSkill);
					}
				}
				const cards = event.result.links.slice(0);
				event.result.cards = cards.slice(0);
				event.cards = cards;
				await event.trigger("rewriteDiscardResult");
			}
		},
		async (event, trigger, player) => {
			const target = event.getTarget();
			if (event.boolline) {
				player.line(target, "green");
			}
			if (!event.chooseonly) {
				const next = target.discard(event.cards);
				next.discarder = player;
				event.done = next;
				if (event.delay === false) {
					next.set("delay", false);
				}
				await next;
			}
		},
	],
	gainPlayerCard: [
		async (event, trigger, player) => {
			const target = event.getTarget();
			if (event.directresult) {
				event.result = {
					buttons: [],
					cards: event.directresult.slice(0),
					links: event.directresult.slice(0),
					targets: [],
					confirm: "ok",
					bool: true,
				};
				event.cards = event.directresult.slice(0);
				event.goto(2);
				return;
			}

			if (!event.dialog) {
				event.dialog = ui.create.dialog("hidden");
			} else if (!event.isMine()) {
				event.dialog.style.display = "none";
			}

			if (event.prompt == null) {
				let str = `获得${get.translation(target)}`;
				const range = get.select(event.selectButton);
				if (range[0] == range[1]) {
					str += get.cnNumber(range[0]);
				} else if (range[1] == Infinity) {
					str += `至少${get.cnNumber(range[0])}`;
				} else {
					str += `${get.cnNumber(range[0])}至${get.cnNumber(range[1])}`;
				}
				str += "张";
				if (event.position == "h" || event.position == undefined) {
					str += "手";
				}
				if (event.position == "e") {
					str += "装备";
				}
				str += "牌";
				event.prompt = str;
			}

			if (event.prompt) {
				event.dialog.add(event.prompt);
			}
			if (event.prompt2) {
				event.dialog.addText(event.prompt2);
			}

			let expand_length = 0;
			const cs = target.getCards(event.position);
			const select = get.select(event.selectButton);
			const directFilter = event.forced && typeof event.filterOk != "function" && typeof event.selectButton != "function" && event.filterButton == lib.filter.all;
			let directh = !lib.config.unauto_choose && !event.isOnline() && select[0] == select[1] && (!event.complexSelect || select[1] === 1);

			for (const position of event.position) {
				if (position == "h") {
					const hs = target.getGainableCards(player, "h");
					if (hs.length) {
						expand_length += Math.ceil(hs.length / 6);
						const title = event.dialog.add('<div class="text center" style="margin: 0px;">手牌区</div>');
						title.style.margin = "0px";
						title.style.padding = "0px";
						hs.randomSort();
						if (event.visible || target.isUnderControl(true, player) || player.hasSkillTag("viewHandcard", null, target, true)) {
							event.dialog.add(hs);
							directh = false;
						} else {
							const shown = hs.filter(card => get.is.shownCard(card));
							if (shown.length) {
								const hidden = hs.filter(card => !shown.includes(card));
								const buttons = ui.create.div(".buttons", event.dialog.content);
								event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
								event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
								if (event.dialog.forcebutton !== false) {
									event.dialog.forcebutton = true;
								}
								if (event.dialog.buttons.length > 3) {
									event.dialog.classList.remove("forcebutton-auto");
								} else if (!event.dialog.noforcebutton) {
									event.dialog.classList.add("forcebutton-auto");
								}
								directh = false;
							} else {
								event.dialog.add([hs, "blank"]);
							}
						}
					}
				} else if (position == "e") {
					const es = target.getGainableCards(player, "e");
					if (es.length) {
						expand_length += Math.ceil(es.length / 6);
						const title = event.dialog.add('<div class="text center" style="margin: 0px;">装备区</div>');
						title.style.margin = "0px";
						title.style.padding = "0px";
						event.dialog.add(es);
						directh = false;
					}
				} else if (position == "j") {
					const js = target.getGainableCards(player, "j");
					if (js.length) {
						expand_length += Math.ceil(js.length / 6);
						const title = event.dialog.add('<div class="text center" style="margin: 0px;">判定区</div>');
						title.style.margin = "0px";
						title.style.padding = "0px";
						const shown = js.filter(card => {
							const name = card.viewAs || card.name;
							const info = lib.card[name];
							if (!info || !info.blankCard) {
								return true;
							}
							return false;
						});
						if (shown.length < js.length && !target.isUnderControl(true)) {
							const hidden = js.filter(card => !shown.includes(card));
							const buttons = ui.create.div(".buttons", event.dialog.content);
							event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(shown, "card", buttons));
							event.dialog.buttons = event.dialog.buttons.concat(ui.create.buttons(hidden, "blank", buttons));
							if (event.dialog.forcebutton !== false) {
								event.dialog.forcebutton = true;
							}
							if (event.dialog.buttons.length > 3) {
								event.dialog.classList.remove("forcebutton-auto");
							} else if (!event.dialog.noforcebutton) {
								event.dialog.classList.add("forcebutton-auto");
							}
						} else {
							event.dialog.add(js);
						}
						directh = false;
					}
				}
			}

			if (event.dialog.buttons.length == 0) {
				event.result = {
					bool: false,
				};
				event.dialog.close();
				event.finish();
				return;
			}

			if (directFilter && select[0] >= cs.length) {
				event.result = {
					bool: true,
					buttons: event.dialog.buttons,
					links: cs,
				};
			} else if (directFilter && directh) {
				event.result = {
					bool: true,
					buttons: event.dialog.buttons.randomGets(select[0]),
					links: [],
				};
				const buttons = event.result.buttons;
				const links = event.result.links;
				if (Array.isArray(buttons) && Array.isArray(links)) {
					for (const button of buttons) {
						links.push("link" in button ? button.link : undefined);
					}
				}
			} else {
				if (event.isMine()) {
					event.dialog.open();
					ui.create.buttonChooseAll();
					game.check();
					game.pause();
					if (expand_length > 2) {
						ui.arena.classList.add("gain-player-card");
						event.dialog.classList.add("fullheight");
					}
				} else if (event.isOnline()) {
					event.send();
				} else {
					event.result = "ai";
				}
			}
		},
		async (event, trigger, player) => {
			const { forced } = event;
			if (event.result == "ai") {
				game.check();
				const aiResult = typeof event.ai == "function" ? ai.basic.chooseButton(event.ai) : false;
				if ((aiResult || forced) && (!event.filterOk || event.filterOk())) {
					ui.click.ok();
				} else {
					ui.click.cancel();
				}
			}
			event.dialog.close();
		},
		async (event, trigger, player) => {
			event.resume();
			delay(500).then(() => void ui.arena.classList.remove("gain-player-card"));
			if (game.online || typeof event.result === "string" || !event.result.bool || !isCardLinks(event.result.links)) {
				event.finish();
			}
		},
		async (event, trigger, player) => {
			if (typeof event.result === "string" || !event.result.bool || !isCardLinks(event.result.links) || game.online) {
				return;
			}
			if (event.logSkill && !game.online) {
				if (typeof event.logSkill == "string") {
					player.logSkill(event.logSkill);
				} else if (Array.isArray(event.logSkill)) {
					forwardEventLogSkill(player, event.logSkill);
				}
			}

			const cards = event.result.links.slice(0);
			event.result.cards = cards.slice(0);
			event.cards = cards;
			await event.trigger("rewriteGainResult");
		},
		async (event, trigger, player) => {
			const { cards } = event;
			const target = event.getTarget();
			if (event.boolline) {
				player.line(target, "green");
			}
			if (!event.chooseonly) {
				const waiting = null;
				if (event.delay !== false) {
					const next = player.gain({
						cards: event.cards,
						source: target,
						animate: event.visibleMove ? "give" : "giveAuto",
						bySelf: true,
					});
					next.gaintag.addArray(event.gaintag);
					event.done = next;
				} else {
					const next = player.gain({ cards: event.cards, source: target, bySelf: true, delay: false });
					next.gaintag.addArray(event.gaintag);
					event.done = next;
					target[event.visibleMove ? "$give" : "$giveAuto"](cards, player);
					if (event.visibleMove) {
						next.visible = true;
					}
				}
			} else {
				target[event.visibleMove ? "$give" : "$giveAuto"](cards, player);
			}
		},
	],
	/**
	 * @deprecated
	 */
	async showHandcards(event, trigger, player) {
		if (player.countCards("h") == 0) {
			return;
		}

		const cards = player.getCards("h");
		const next = player.showCards(cards);
		next.setContent(() => {});

		let str = `${get.translation(player.name)}的手牌`;
		if (typeof event.prompt == "string") {
			str = event.prompt;
		}
		event.dialog = ui.create.dialog(str, cards);
		event.dialogid = lib.status.videoId++;
		event.dialog.videoId = event.dialogid;
		game.broadcast(
			(str, cards, id) => {
				ui.create.dialog(str, cards).videoId = id;
			},
			str,
			cards,
			event.dialogid
		);
		game.log(player, "展示了", cards);
		game.addVideo("showCards", player, [str, get.cardsInfo(cards)]);
		await game.delayx(2);
		await next;
		game.broadcast(lib.message.client.closeDialog, event.dialogid);
		event.dialog.close();
	},
	async showCards(event, trigger, player) {
		const { cards, str, flashAnimation, triggeronly, isFlash, multipleShow } = event;
		if (get.itemtype(cards) != "cards") {
			return event.finish();
		}
		//初始化show_map用来存储展示牌的位置和来源
		type ShowMapOthers = {
			cardPile: Card[];
			discardPile: Card[];
			ordering: Card[];
			special: Card[];
			noPosition: Card[];
		};
		type ShowMapOwner = {
			hs: Card[];
			es: Card[];
			js: Card[];
			xs: Card[];
			ss: Card[];
			cards2: Card[];
			cards: Card[];
		};
		type ShowMapEntry = ShowMapOthers | ShowMapOwner;
		const showMap = new Map<Player | "others", ShowMapEntry>();
		const others: ShowMapOthers = {
			cardPile: [],
			discardPile: [],
			ordering: [],
			special: [],
			noPosition: [],
		};
		showMap.set("others", others);
		event.show_map = showMap;
		//触发展示牌时机该时机允许修改展示牌
		await event.trigger("showCards");

		if (get.itemtype(cards) != "cards") {
			return;
		}

		//确定要展示的牌
		event.result = {
			cards: cards.slice(0),
			show_map: event.show_map,
		};
		await event.trigger("showCardsFixing");
		if (typeof event.result == "string" || !Array.isArray(event.result.cards) || !event.result.cards.every(card => get.itemtype(card) == "card")) {
			return;
		}
		event.cards = event.result.cards;

		//被展示牌的所在的区域
		const directLose: Card[] = [];
		event.directLose = directLose;
		const ownerLose = new Map<Player, Card[]>();
		event.ownerLose = ownerLose;
		for (const card of cards) {
			const pos = get.position(card, true);
			const owner = get.owner(card);
			if (owner && !event.show_map.has(owner)) {
				const ownerEntry: ShowMapOwner = {
					hs: [],
					es: [],
					js: [],
					xs: [],
					ss: [],
					cards2: [],
					cards: [],
				};
				event.show_map.set(owner, ownerEntry);
				ownerLose.set(owner, []);
			}
			const ownerEntry = owner ? event.show_map.get(owner) : undefined;
			//给牌分区域处理，各回各家各找各妈
			if ("hejsx".includes(pos) && owner) {
				if (!ownerEntry || !("hs" in ownerEntry)) {
					continue;
				}
				if (pos == "h") {
					ownerEntry.hs.push(card);
				} else if (pos == "e") {
					ownerEntry.es.push(card);
				} else if (pos == "j") {
					ownerEntry.js.push(card);
				} else if (pos == "s") {
					ownerEntry.ss.push(card);
				} else {
					ownerEntry.xs.push(card);
				}
				ownerEntry.cards.push(card);
				if ("he".includes(pos)) {
					ownerEntry.cards2.push(card);
				}
				ownerLose.get(owner)?.push(card);
			} else if ("cds".includes(pos)) {
				directLose.push(card);
				if (pos == "c") {
					others.cardPile.push(card);
				} else if (pos == "d") {
					others.discardPile.push(card);
				} else {
					others.special.push(card);
				}
			} else {
				directLose.push(card);
				if (pos == "o") {
					others.ordering.push(card);
				} else if (card.original == "c") {
					others.cardPile.push(card);
				} else if (card.original == "d") {
					others.discardPile.push(card);
				} else if (card.original == "s") {
					others.special.push(card);
				} else {
					others.noPosition.push(card);
				}
			}
		}

		//仅触发时机，不做后续处理
		if (triggeronly) {
			return;
		}

		//这部分是处理将牌置入处理区的，一般只有亮出才会置入
		if (!event.noOrdering && isFlash) {
			//有noOrdering属性亮出牌就不会把牌丢进处理区
			//showCards的relatedEvent属性是牌要在某个特定事件之后进入弃牌堆的，比如一些需要多次亮出牌的，因为多个展示牌事件独立，不set的话会在展示牌事件结束后就置入弃牌堆
			if (Array.from(ownerLose.values())?.flat()?.length > 0) {
				const next = game.loseAsync({ lose_list: Array.from(ownerLose.entries()) }).set("relatedEvent", event.relatedEvent || event.getParent());
				next.setContent("chooseToCompareLose");
				await next;
			}
			if (directLose.length > 0) {
				const ordering = game.cardsGotoOrdering(directLose);
				if (ordering) {
					await ordering.set("relatedEvent", event.relatedEvent || event.getParent());
				}
			}
		}

		//展示牌的动画
		if (!event.str) {
			event.str = `${get.translation(player.name)}展示的牌`;
		}
		if (!flashAnimation) {
			//允许自定义dialog，类似chooseButton
			if (typeof event.dialog == "number") {
				event.videoId = event.dialog;
				event.dialog = get.idDialog(event.dialog);
			} else {
				event.videoId = lib.status.videoId++;
			}
			if (event.createDialog && !event.dialog) {
				if (Array.isArray(event.createDialog)) {
					//event.createDialog.add("hidden");
					game.broadcastAll(
						(id, createDialog) => {
							const dialog = ui.create.dialog.apply(this, createDialog);
							dialog.videoId = id;
						},
						event.videoId,
						event.createDialog
					);
				}
				//event.closeDialog = true;
			}
			if (event.dialog == undefined) {
				game.broadcastAll(
					(id, str, cards) => {
						const dialog = ui.create.dialog(str, cards);
						dialog.videoId = id;
					},
					event.videoId,
					event.str,
					cards
				);
			}
			event.dialog = get.idDialog(event.videoId);

			const createDialog = (cards2, id, customButton) => {
				const dialog = get.idDialog(id);
				if (!dialog) {
					return;
				}
				dialog.forcebutton = true;
				//dialog.style.display = "none";
				//处理隐藏牌（这东西有人用过？）
				if (cards2) {
					for (const button of dialog.buttons) {
						if (cards2.includes(button.link)) {
							button.className = "button card";
							button.innerHTML = "";
						}
					}
				}
				//允许自定义展示牌时对话框里的按钮
				if (typeof customButton == "function") {
					dialog.buttons.forEach(button => customButton(button));
				}
				//dialog.style.display = "";
			};
			const customButton = event.customButton || (() => {});
			//创建对话框
			createDialog(event.hiddencards, event.videoId, customButton);
			game.broadcast(
				(func, cards2, id, customButton) => {
					func(cards2, id, customButton);
				},
				createDialog,
				event.hiddencards,
				event.videoId,
				customButton
			);
			//处理历史记录的log
			game.addVideo("showCards", player, [event.str, get.cardsInfo(cards)]);
		} else {
			event.videoId = lib.status.videoId++;
			for (const card of cards) {
				game.addVideo("judge1", player, [get.cardInfo(card), event.str, event.videoId]);
			}
			//创建动画，其实就跟judge的类似
			game.broadcastAll(
				(player, cards, str, id, cardids) => {
					let event;
					if (game.online) {
						event = {};
					} else {
						event = _status.event;
					}
					event.nodes ??= [];
					cards.forEach((card, index) => {
						let node;
						const cardid = cardids[index];
						if (game.chess) {
							node = card.copy("thrown", "center", ui.arena).addTempClass("start");
						} else {
							node = player.$throwordered(card.copy(), true);
						}
						if (lib.cardOL) {
							lib.cardOL[cardid] = node;
						}
						node.cardid = cardid;
						node.classList.add("thrownhighlight");
						event.nodes.push(node);
					});
					ui.arena.classList.add("thrownhighlight");
					event.dialog = ui.create.dialog(str);
					event.dialog.classList.add("center");
					event.dialog.videoId = id;
				},
				player,
				cards,
				event.str,
				event.videoId,
				cards.map(i => get.id())
			);
		}

		//允许自定义log的内容，log函数参数为对应角色要展示的牌cards和角色player
		const cards2 = cards.slice(0);
		if (event.hiddencards && !isFlash) {
			cards2.removeArray(event.hiddencards);
		}
		if (event.log != false) {
			const str = isFlash ? "亮出了" : "展示了";
			//multipleShow属性是表示是否有多个展示牌的角色的意思
			if (multipleShow !== true) {
				const logList = event.log?.(cards2, player) || [player, str, cards2];
				game.log(...logList);
			} else {
				const targets = Array.from(ownerLose.keys());
				for (const target of targets.sortBySeat()) {
					const cardsx = ownerLose.get(target)?.filter(card => !event.hiddenCards?.includes(card));
					if (cardsx?.length) {
						const logList = event.log?.(cardsx, target) || [target, str, cardsx];
						game.log(...logList);
					}
				}
				if (directLose.length) {
					const logList = event.log?.(directLose, player) || [player, str, directLose];
					game.log(...logList);
				}
			}
		}
		//添加知情者
		cards.forEach(card => card.addKnower("everyone"));
		//增加延迟，允许自定义
		const delay = Math.max(2, Math.min(5, cards.length));
		await game.delayx(event.delay_time || delay);

		//关闭对话框，结束动画
		if (!flashAnimation) {
			if (event.closeDialog != false) {
				game.broadcastAll(lib.message.client.closeDialog, event.videoId);
			}
		} else {
			//亮出牌的还需要清理一次中央的区域残留的动画效果
			if (event.clearArena !== false) {
				game.broadcastAll(() => ui.clear());
			}
			event.highlightRemove = () => {
				game.broadcastAll(id => {
					const dialog = get.idDialog(id);
					if (dialog) {
						dialog.close();
					}
					ui.arena.classList.remove("thrownhighlight");
				}, event.videoId);
			};
			if (event.removeHighlight !== false) {
				event.highlightRemove();
			}
			game.addVideo("judge2", null, event.videoId);
		}

		//新增callback事件
		if (event.callback) {
			const next = game.createEvent("showCardsCallback", false);
			next.player = player;
			next.cards = event.result.cards;
			next.result = event.result;
			next.setContent(event.callback);
			await next;
		}
	},
		async viewCards(event, trigger, player) {
			game.addCardKnower(event.cards, player);

			let result: Partial<Result>;
		if (player == game.me) {
			event.dialog = ui.create.dialog(event.str, event.cards);
			if (event.isMine()) {
				game.countChoose();
				event.choosing = true;
				await new Promise(resolve => {
					ui.create.confirm("o", resolve);
				});
				ui?.confirm?.close();
			} else {
				event.result = "viewed";
				const wait = delay(2 * lib.config.duration).then(() => {
					event.dialog.close();
				});
				await game.delayx(2);
				await wait;
				return;
			}
		} else if (event.isOnline()) {
			await event.sendAsync();
		} else {
			return;
		}

		event.result = "viewed";
		_status.imchoosing = false;
		event.choosing = false;
		if (event.dialog) {
			event.dialog.close();
		}
	},
	async moveCard(event, trigger, player) {
		if (!player.canMoveCard(null, event.nojudge, event.sourceTargets, event.aimTargets, event.filter, event.canReplace ? "canReplace" : "noReplace")) {
			return;
		}

		const next = player.chooseTarget(2, (card, player, target) => {
			const filterCard = get.event().filter;
			if (ui.selected.targets.length) {
				if (!get.event().aimTargets.includes(target)) {
					return false;
				}
				const from = ui.selected.targets[0];
				const js = from.getCards("j", filterCard);
				for (const judgeCard of js) {
					if (_status.event.nojudge) {
						break;
					}
					if (target.canAddJudge(judgeCard)) {
						return true;
					}
				}
				if (target.isMin()) {
					return false;
				}
				const es = from.getCards("e", filterCard);
				for (const equipCard of es) {
					if (target.canEquip(equipCard, _status.event.canReplace)) {
						return true;
					}
				}
				return false;
			} else {
				if (!get.event().sourceTargets.includes(target)) {
					return false;
				}
				return game.hasPlayer(current => {
					if (!get.event().aimTargets.includes(current) || target == current) {
						return false;
					}
					const js = target.getCards("j", filterCard);
					for (const judgeCard of js) {
						if (_status.event.nojudge) {
							break;
						}
						if (current.canAddJudge(judgeCard)) {
							return true;
						}
					}
					if (current.isMin()) {
						return false;
					}
					const es = target.getCards("e", filterCard);
					for (const equipCard of es) {
						if (current.canEquip(equipCard, _status.event.canReplace)) {
							return true;
						}
					}
					return false;
				});
			}
		});
		next.set("nojudge", event.nojudge || false);
		next.set("ai", target => {
			const player = _status.event.player;
			const att = get.attitude(player, target);
			const sgnatt = get.sgn(att);
			const aimTargets = get.event().aimTargets;
			const filterCard = get.event().filter;
			if (ui.selected.targets.length == 0) {
				if (att > 0) {
					let noEffect = true;
					if (
						!_status.event.nojudge &&
						target.countVCards("j", card => {
							if (!filterCard(card)) {
								return false;
							}
							if (get.effect(target, card, target, target) <= -5) {
								noEffect = false;
							}
							return game.hasPlayer(current => {
								if (!aimTargets.includes(current)) {
									return false;
								}
								return current != target && current.canAddJudge(card) && get.attitude(player, current) < 0;
							});
						})
					) {
						return noEffect ? 8 : 14;
					}
					if (
						target.countVCards("e", card => {
							if (!filterCard(card)) {
								return false;
							}
							return (
								get.value(card, target) < 0 &&
								game.hasPlayer(current => {
									if (!aimTargets.includes(current)) {
										return false;
									}
									return current != target && get.attitude(player, current) < 0 && current.canEquip(card, _status.event.canReplace) && get.effect(target, card, player, player) < 0;
								})
							);
						}) > 0
					) {
						return 9;
					}
				} else if (att < 0) {
					if (
						game.hasPlayer(current => {
							if (current != target && get.attitude(player, current) > 0) {
								const es = target.getCards("e", filterCard);
								for (const equipCard of es) {
									if (get.value(equipCard, target) > 0 && current.canEquip(equipCard, _status.event.canReplace) && get.effect(current, equipCard, player, player) > (_status.event.canReplace ? get.effect(target, equipCard, player, player) : 0)) {
										return true;
									}
								}
							}
							return false;
						})
					) {
						return -att;
					}
				}
				return 0;
			}
			const current = ui.selected.targets[0];
			const pos = get.event().nojudge ? "e" : "ej";
			const cards = current.getCards(pos, filterCard);
			const att2 = get.sgn(get.attitude(player, current));
			let maxEff = 0;
			for (const card of cards) {
				if (att2 <= 0 && get.sgn(get.value(card, current)) < 0) {
					continue;
				}
				const att3 = get.sgn(get.attitude(player, target));
				let val = get.effect(target, card, player, target);
				if (att3 != get.sgn(val)) {
					continue;
				}
				if (att2 > 0 && get.position(card) == "e") {
					val /= 2;
				}
				if (Math.abs(val) > maxEff) {
					maxEff = Math.abs(val);
				}
			}
			return maxEff;
		});
		next.set("multitarget", true);
		next.set("targetprompt", _status.event.targetprompt || ["被移走", "移动目标"]);
		next.set("prompt", event.prompt || "移动场上的一张牌");
		next.set("filter", event.filter);
		next.set("sourceTargets", event.sourceTargets || game.filterPlayer());
		next.set("aimTargets", event.aimTargets || game.filterPlayer());
		next.set("canReplace", event.canReplace);
		next.set("custom", get.copy(event.custom));
		if (event.prompt2) {
			next.set("prompt2", event.prompt2);
		}
		if (event.forced) {
			next.set("forced", true);
		}

		let result = await next.forResult();
		event.result = result;
		if (typeof result === "string" || !result.bool || !Array.isArray(result.targets)) {
			return;
		}
		const targets = result.targets;

		if (event.logSkill) {
			if (typeof event.logSkill == "string") {
				player.logSkill(event.logSkill, result.targets, false);
			} else if (Array.isArray(event.logSkill)) {
				if (event.logSkill.length >= 3) {
					event.logSkill[1] = result.targets;
					event.logSkill[2] = false;
				} else if (event.logSkill.length) {
					event.logSkill = [event.logSkill[0], result.targets, false];
				}
				forwardEventLogSkill(player, event.logSkill);
			}
		}
		player.line2(targets, "green");
		await game.delay();

		if (targets.length == 2) {
			const dialogArgs: LegacyChooseButtonCreateDialog = ["请选择要移动的牌"];
			const es = targets[0].getCards("e", card => event.filter(card) && targets[1].canEquip(card, event.canReplace));
			const js = event.nojudge ? [] : targets[0].getCards("j", card => event.filter(card) && targets[1].canAddJudge(card));
			if (es.length) {
				dialogArgs.push(`<div class="text center">装备区</div>`);
				dialogArgs.push([es, "vcard"]);
			}
			if (js.length) {
				dialogArgs.push(`<div class="text center">判定区</div>`);
				dialogArgs.push([js, "vcard"]);
			}
			if (es.length + js.length === 1) {
				result = {
					bool: true,
					links: es.length > 0 ? es : js,
				};
			} else {
				result = await player
					.chooseButton(dialogArgs, true, button => {
						const player = _status.event.player;
						const targets0 = _status.event.targets0;
						const targets1 = _status.event.targets1;
						if (get.attitude(player, targets0) > 0 && get.attitude(player, targets1) < 0) {
							if (get.position(button.link) == "j") {
								return 12;
							}
							if (get.value(button.link, targets0) < 0 && get.effect(targets1, button.link, player, targets1) > 0) {
								return 10;
							}
							return 0;
						} else {
							if (get.position(button.link) == "j") {
								return -10;
							}
							return get.value(button.link) * get.effect(targets1, button.link, player, targets1);
						}
					})
					.set("target", targets[0])
					.set("nojudge", event.nojudge || false)
					.set("targets0", targets[0])
					.set("targets1", targets[1])
					/*.set("filterButton", button => {
				const targets1 = _status.event.targets1;
				if (!get.event().filter(button.link)) {
					return false;
				}
				if (get.position(button.link) == "j") {
					if (_status.event.nojudge) {
						return false;
					}
					return targets1.canAddJudge(button.link);
				} else {
					return targets1.canEquip(button.link, _status.event.canReplace);
				}
			})*/
					.set("filter", event.filter)
					.set("canReplace", event.canReplace)
					.set("custom", get.copy(event.custom))
					.forResult();
			}
		} else {
			return;
		}

		if (typeof result === "string" || !result.bool || !Array.isArray(result.links) || !result.links.length) {
			return;
		}
		if (result.links.length) {
			const link = result.links[0];
			let position = "j";
			let waiting;
			if (targets[0].getCards("e").includes(link)) {
				position = "e";
				/*if (!link.cards?.length) {
					targets[0].removeVirtualEquip(link);
				}*/
				waiting = targets[1].equip(link);
			} else {
				/*if (!link.cards?.length) {
					targets[0].removeVirtualJudge(link);
				}*/
				waiting = targets[1].addJudge(link, link?.cards);
			}
			if (link.cards?.length) {
				targets[0].$give(link.cards, targets[1], false);
			}
			game.log(targets[0], "的", link, "被移动给了", targets[1]);
			if (typeof event.result !== "string") {
				event.result.card = link;
				event.result.position = position;
			}
			await waiting;
			await game.delay();
		}
	},
	useCard: [
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			if (!event.card) {
				console.log("err: no card", get.translation(event.player));
				event.finish();
				return;
			}
			if (!get.info(event.card, false).noForceDie) {
				event.forceDie = true;
			}
			//player.using=cards;
			let cardaudio = true;

			if (event.skill) {
				const skill = requireRegisteredSkill(lib.skill, event.skill);
				if (skill.audio) {
					cardaudio = false;
				}
				if (skill.log != false) {
					player.logSkill(event.skill, false, null, null, [event, event.player]);
				}
				if (get.info(event.skill).popname) {
					player.tryCardAnimate(event.card, event.card.name, "metal", true);
				}
			} else if (!event.nopopup) {
				const popupTranslation = lib.translate[`${event.card.name}_pop`];
				if (popupTranslation) {
					player.tryCardAnimate(event.card, popupTranslation, "metal");
				} else {
					player.tryCardAnimate(event.card, event.card.name, "metal");
				}
			}
			if (event.audio === false) {
				cardaudio = false;
			}
			if (cardaudio) {
				game.broadcastAll(
					(player, card) => {
						game.playCardAudio(card, player);
					},
					player,
					event.card
				);
			}
			event.id = get.id();
			if (!Array.isArray(event.excluded)) {
				event.excluded = [];
			}
			if (!Array.isArray(event.directHit)) {
				event.directHit = [];
			}
			if (typeof event.customArgs != "object" || typeof event.customArgs.default != "object") {
				event.customArgs = { default: {} };
			}
			if (typeof event.baseDamage != "number") {
				event.baseDamage = get.info(event.card, false).baseDamage || 1;
			}
			if (typeof event.effectCount != "number") {
				event.effectCount = get.info(event.card, false).effectCount || 1;
			}
			event.effectedCount = 0;
			if (event.oncard) {
				event.oncard(event.card, event.player);
			}
			player.actionHistory[player.actionHistory.length - 1].useCard.push(event);
			game.getGlobalHistory().useCard.push(event);
			if (event.addCount !== false) {
				const cardStats = player.stat[player.stat.length - 1].card;
				const cardName = event.card.name;
				cardStats[cardName] = (cardStats[cardName] ?? 0) + 1;
			}
			if (event.skill && event.addSkillCount !== false) {
				if (player.stat[player.stat.length - 1].skill[event.skill] == undefined) {
					player.stat[player.stat.length - 1].skill[event.skill] = 1;
				} else {
					player.stat[player.stat.length - 1].skill[event.skill]++;
				}
				const sourceSkill = get.info(event.skill).sourceSkill;
				if (sourceSkill) {
					if (player.stat[player.stat.length - 1].skill[sourceSkill] == undefined) {
						player.stat[player.stat.length - 1].skill[sourceSkill] = 1;
					} else {
						player.stat[player.stat.length - 1].skill[sourceSkill]++;
					}
				}
			}
			const loseMap: Record<string, Card[]> = { noowner: [] };
			event.lose_map = loseMap;
			if (typeof player.playerid == "string") {
				loseMap[player.playerid] = [];
			}
			const cards_ow = event.cards.slice();
			while (cards_ow.length) {
				const owner = get.owner(cards_ow[0]);
				if (owner) {
					const id = owner.playerid;
					const Cards_card = cards.filter(card => get.owner(card) == owner);
					cards_ow.removeArray(Cards_card);
					owner.getCards("ej").forEach(card => {
						const cardSymbol = card.cardSymbol;
						const virtualCard = cardSymbol === undefined ? undefined : card[cardSymbol];
						const virtualCards = virtualCard instanceof lib.element.VCard ? virtualCard.cards : undefined;
						const cardsx = Array.isArray(virtualCards) ? virtualCards.filter(cardx => cards.includes(cardx)) : undefined;
						if (!cardsx || !cardsx.length) {
							return;
						}
						event.cards.removeArray(cardsx);
						event.cards.add(card);
					});
					if (typeof id == "string") {
						loseMap[id] ??= [];
						loseMap[id].addArray(Cards_card);
					} else {
						loseMap.noowner.addArray(Cards_card);
					}
				} else {
					const noownerCard = cards_ow.shift();
					if (noownerCard) {
						loseMap.noowner.add(noownerCard);
					}
				}
			}
			player.useCardAnimateBefore?.(event, trigger, player);
			if (event.animate != false && event.throw !== false) {
				let throw_cards = event.cards;
				let virtualCard_str = "";
				for (const id in loseMap) {
					if (id == "noowner") {
						continue;
					}
					const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
					const throws = loseMap[id];
					if (owner == player) {
						if (!throw_cards.length && lib.config.card_animation_info) {
							const virtualCard = ui.create.card();
							virtualCard._destroy = true;
							virtualCard.expired = true;
							const info = lib.card[card.name];
							const number = card.number;
							virtualCard.init([get.suit(card), typeof number == "number" ? number : "虚拟", card.name, card.nature]);
							const infoNode = virtualCard.querySelector(".info");
							if (infoNode instanceof HTMLElement) {
								virtualCard_str = infoNode.innerHTML;
							}
							throw_cards = [virtualCard];
							throws.add(virtualCard);
						}
						if (lib.config.card_animation_info) {
							throws.addArray(loseMap.noowner);
						}
					}
					if (throws.length) {
						owner.$throw(throws);
					}
				}
				if (loseMap.noowner.length && !lib.config.card_animation_info) {
					for (const card of loseMap.noowner) {
						game.broadcastAll(
							(player, card, cardid) => {
								let event;
								if (game.online) {
									event = {};
								} else {
									event = _status.event;
								}
								if (game.chess) {
									event.node = card.copy("thrown", "center", ui.arena).addTempClass("start");
								} else {
									event.node = player.$throwordered(card.copy(), true);
								}
								if (lib.cardOL) {
									lib.cardOL[cardid] = event.node;
								}
								event.node.cardid = cardid;
								event.node.classList.add("thrownhighlight");
							},
							player,
							card,
							get.id()
						);
					}
				}
				if (lib.config.card_animation_info) {
					game.broadcastAll(
						(cards, card, card_cards, str) => {
							for (const nodex of cards) {
								const node = nodex.clone;
								if (nodex._tempName) {
									nodex._tempName.delete();
									delete nodex._tempName;
								}
								if (!node) {
									continue;
								}
								if (str) {
									const infoNode = node.querySelector(".info");
									if (infoNode instanceof HTMLElement) {
										infoNode.innerHTML = str;
									}
								}
								const cardCards = card instanceof lib.element.VCard ? card.cards : undefined;
								const hasCardCards = Array.isArray(cardCards) && cardCards.length > 0;
								if (cards.length > 1 || !card.isCard || card.name != node.name || card.nature != node.nature || !hasCardCards) {
									ui.create.cardTempName(card, node);
									if (node._tempName && (!card_cards || card_cards.length <= 0)) {
										node._tempName.innerHTML = node._tempName.innerHTML.slice(0, node._tempName.innerHTML.indexOf("<span", -1));
										node._tempName.innerHTML += "<span style='color:black'>虚拟</span></span>";
									}
									}
							}
						},
						throw_cards,
						event.card,
						event.cards,
						virtualCard_str
					);
				}
				if (lib.config.sync_speed && throw_cards[0] && throw_cards[0].clone) {
					const waitingForTransition = get.time();
					const waitingEvent: GameEvent & { waitingForTransition?: number } = event;
					waitingEvent.waitingForTransition = waitingForTransition;
					throw_cards[0].clone.listenTransition(() => {
						if (_status.waitingForTransition == waitingForTransition && _status.paused) {
							game.resume();
						}
						delete waitingEvent.waitingForTransition;
					});
				}
			}
			if (event.cards.length) {
				const ownerCards = event.cards.filter(card => get.owner(card));
				const directDiscard = event.cards.filter(card => !get.owner(card));
				if (ownerCards.length) {
					let ownerx: Player | undefined;
					for (const card of ownerCards) {
						const owner = get.owner(card);
						if (!owner) {
							continue;
						}
						ownerx = owner;
						break;
					}
					if (
						cards.some(card => {
							const owner = get.owner(card);
							if (!owner) {
								return true;
							}
							return owner != ownerx;
						})
					) {
						await game.loseAsync({ player: player, cards: ownerCards }).setContent(async (event, trigger, player) => {
							const cards = event.cards;
							const cards_noowner: Card[] = [];
							while (cards.length) {
								const owner = get.owner(cards[0]);
								if (!owner) {
									const noownerCard = cards.shift();
									if (noownerCard) {
										cards_noowner.add(noownerCard);
									}
								} else {
									const id = owner.playerid;
									const onLoseCards = cards.filter(card => get.owner(card) == owner);
									event.cards.removeArray(onLoseCards);
									await owner.lose({ cards: onLoseCards, position: ui.ordering, visible: true }).set("relatedEvent", event.getParent()).set("getlx", false).set("type", "use");
								}
							}
							if (cards_noowner.length) {
								const ordering = game.cardsGotoOrdering(cards_noowner);
								if (ordering) {
									await ordering.set("relatedEvent", event.getParent());
								}
							}
						});
					} else if (ownerx) {
						await ownerx.lose({ cards: ownerCards, position: ui.ordering, visible: true }).set("type", "use");
					}
				}
				if (directDiscard.length) {
					loseMap.noowner.addArray(directDiscard);
					await game.cardsGotoOrdering(directDiscard);
				}
			}
			await event.trigger("useCard0");
		},
		async (event, trigger, player) => {
			const { cards, card } = event;
			// useCard 的游标只索引由事件写入的普通 targets 数组。未初始化时
			// 保持原来数组访问得到 undefined、比较走 false 的 NaN 语义。
			const num = Number(event.num);
			const targets = event.getTargets();
			const target = targets[num];
			if (event.animate != false && event.line != false && !event.hideTargets) {
				if (event.card.name == "wuxie" && event.getParent()._info_map) {
					let evtmap = event.getParent()._info_map;
					if (evtmap._source) {
						evtmap = evtmap._source;
					}
					const lining = (evtmap.multitarget ? evtmap.targets : evtmap.target) || event.player;
					if (Array.isArray(lining)) {
						const trigger = event.getTrigger();
						if (!trigger) {
							throw new Error("useCard line animation requires its triggering event.");
						}
						if (trigger.name == "jiedao") {
							player.line(lining[0], "green");
						} else {
							player.line(lining, "green");
						}
					} else {
						player.line(lining, "green");
					}
				} else if (event.card.name == "youdishenru" && event.getParent().source) {
					let lining = event.getParent().sourcex || event.getParent().source2 || event.getParent().source;
					if (lining == player && event.getParent().sourcex2) {
						lining = event.getParent().sourcex2;
					}
					if (Array.isArray(lining)) {
						const trigger = event.getTrigger();
						if (!trigger) {
							throw new Error("useCard line animation requires its triggering event.");
						}
						if (trigger.name == "jiedao") {
							player.line(lining[0], "green");
						} else {
							player.line(lining, "green");
						}
					} else {
						player.line(lining, "green");
					}
					} else {
						const config: { color?: string | number[] } = {};
						const nature = get.natureList(event.card)[0];
						if (typeof nature == "string" && (nature || (event.card instanceof lib.element.Card && event.card.classList.contains(nature)))) {
							config.color = nature;
					}
					if (event.addedTarget) {
						player.line2(targets.concat(event.addedTargets), config);
					} else if (get.info(event.card, false).multitarget && targets.length > 1 && !get.info(event.card, false).multiline) {
						player.line2(targets, config);
					} else {
						player.line(targets, config);
					}
				}
			}
			if (targets.length && !event.hideTargets) {
				const str = targets.length == 1 && targets[0] == player ? "#b自己" : targets.sortBySeat();
				if (cards.length && !event.card.isCard) {
					if (event.addedTarget) {
						game.log(player, "对", str, "使用了", event.card, "（", cards, "，指向", event.addedTargets, "）");
					} else {
						game.log(player, "对", str, "使用了", event.card, "（", cards, "）");
					}
				} else {
					if (event.addedTarget) {
						game.log(player, "对", str, "使用了", event.card, "（指向", event.addedTargets, "）");
					} else {
						game.log(player, "对", str, "使用了", event.card);
					}
				}
			} else {
				if (cards.length && !event.card.isCard) {
					if (event.addedTarget) {
						game.log(player, "使用了", event.card, "（", cards, "，指向", event.addedTargets, "）");
					} else {
						game.log(player, "使用了", event.card, "（", cards, "）");
					}
				} else {
					if (event.addedTarget) {
						game.log(player, "使用了", event.card, "（指向", event.addedTargets, "）");
					} else {
						game.log(player, "使用了", event.card);
					}
				}
			}
			if (event.card.name == "wuxie") {
				const trigger = event.getTrigger();
				if (!trigger) {
					throw new Error("wuxie history requires its triggering event.");
				}
				game.logv(player, [event.card, cards], [trigger.card]);
			} else {
				game.logv(player, [event.card, cards], targets);
			}
			await event.trigger("useCard1");
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			await event.trigger("yingbian");
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			await event.trigger("useCard2");
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			await event.trigger("useCard");
			event._oncancel = () => {
				game.broadcastAll(id => {
					if (ui.tempnowuxie && ui.tempnowuxie._origin == id) {
						ui.tempnowuxie.close();
						delete ui.tempnowuxie;
					}
				}, event.id);
			};
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			event.sortTarget = (animate, sort) => {
				const { card, num, fixedSeat } = event;
				const targets = event.getTargets();
				const info = get.info(card, false);
				if (num !== 0 || targets.length <= 1) {
					return;
				}
				if (!info.multitarget && !fixedSeat && !sort) {
					targets.sortBySeat(_status.currentPhase || player);
				}
				if (!animate) {
					return;
				}
				for (const target of targets) {
					target.addTempClass("target");
				}
			};
			event.sortTarget();
			event._triggerTo = async (name: string, key: string, first: string, last?: boolean) => {
				const { cards } = event;
				const targets = event.getTargets();
				if (event.all_excluded) {
					return;
				}
				if (!event[key]) {
					event[key] = [];
				}
				const triggeredTargets = event[key] as Player[];
				const target = getTriggerTarget(event, triggeredTargets);
				if (!target) {
					return;
				}
				triggeredTargets.push(target);
				const next = game.createEvent(name, false);
				if (!event[first]) {
					event[first] = true;
					next.isFirstTarget = true;
				}
				next.setContent("emptyEvent");
				next.targets = targets;
				next.target = target;
				next.card = event.card;
				next.cards = cards;
				next.player = player;
				next.skill = event.skill;
				next.excluded = event.excluded;
				next.directHit = event.directHit;
				next.customArgs = event.customArgs;
				if (event.forceDie) {
					next.forceDie = true;
				}
				if (last && event.getTargets().length === event[key].length) {
					event.sortTarget();
				}
				await next;
				event.redo();
				return;

				function getTriggerTarget(event: GameEvent, triggered: Player[]) {
					const sortedTargets = [...event.getTargets()];
					const remainingTargets = new Map<Player, number>();
					for (const target of sortedTargets) {
						remainingTargets.set(target, (remainingTargets.get(target) || 0) + 1);
					}
					for (const target of triggered) {
						const count = remainingTargets.get(target);
						if (count) {
							remainingTargets.set(target, count - 1);
						}
					}
					sortedTargets.sortBySeat(_status.currentPhase || event.player || undefined);
					for (const target of sortedTargets) {
						if ((remainingTargets.get(target) || 0) > 0) {
							return target;
						}
					}
					return null;
				}
			};
		},
		async (event, trigger, player) => {
			await event._triggerTo("useCardToPlayer", "triggeredTargets1", "isFirstTarget1");
		},
		async (event, trigger, player) => {
			await event._triggerTo("useCardToTarget", "triggeredTargets2", "isFirstTarget2");
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			const info = get.info(event.card, false);
			if (!info.nodelay && event.animate != false) {
				if (event.delayx !== false) {
					if (event.waitingForTransition) {
						_status.waitingForTransition = event.waitingForTransition;
						game.pause();
					} else {
						game.delayx();
					}
				}
			}
		},
		async (event, trigger, player) => {
			await event._triggerTo("useCardToPlayered", "triggeredTargets3", "isFirstTarget3");
		},
		async (event, trigger, player) => {
			await event._triggerTo("useCardToTargeted", "triggeredTargets4", "isFirstTarget4", true);
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			const target = event.target;
			if (event.all_excluded) {
				return;
			}
			event.effectedCount++;
			event.num = 0;
			const info = get.info(event.card, false);
			if (info.contentBefore) {
				const next = game.createEvent(`${event.card.name}ContentBefore`);
				next.setContent(info.contentBefore);
				next.targets = targets;
				next.card = event.card;
				next.cards = cards;
				next.player = player;
				next.skill = event.skill;
				next.type = "precard";
				if (event.forceDie) {
					next.forceDie = true;
				}
				await next;
			} else if (info.reverseOrder && get.is.versus() && targets.length > 1) {
				const next = game.createEvent(`${event.card.name}ContentBefore`);
				next.setContent("reverseOrder");
				next.targets = targets;
				next.card = event.card;
				next.cards = cards;
				next.player = player;
				next.skill = event.skill;
				next.type = "precard";
				if (event.forceDie) {
					next.forceDie = true;
				}
				await next;
			} else if (info.singleCard && info.filterAddedTarget && event.addedTargets && event.addedTargets.length < targets.length) {
				const next = game.createEvent(`${event.card.name}ContentBefore`);
				next.setContent("addExtraTarget");
				next.target = target;
				next.targets = targets;
				next.card = event.card;
				next.cards = cards;
				next.player = player;
				next.skill = event.skill;
				next.type = "precard";
				next.addedTarget = event.addedTarget;
				next.addedTargets = event.addedTargets;
				if (event.forceDie) {
					next.forceDie = true;
				}
				await next;
			}
		},
		async (event, trigger, player) => {
			const { cards, card } = event;
			// useCard 的游标只索引由事件写入的普通 targets 数组。未初始化时
			// 保持原来数组访问得到 undefined、比较走 false 的 NaN 语义。
			const num = Number(event.num);
			const targets = event.getTargets();
			const target = targets[num];
			if (event.all_excluded) {
				return;
			}
			const info = get.info(event.card, false);
			if (num == 0 && targets.length > 1) {
				event.sortTarget(true, true);
			}
			if (target && target.isDead() && !info?.deadTarget) {
				return;
			}
			if (target && target.isOut() && !info?.includeOut) {
				return;
			}
			if (target && target.removed) {
				return;
			}
			if (target && info.ignoreTarget && info.ignoreTarget(event.card, player, target)) {
				const next = game.createEvent("useCardToIgnored", false);
				next.setContent("emptyEvent");
				next.targets = targets;
				next.target = target;
				next.num = num;
				next.card = event.card;
				next.cards = cards;
				next.player = player;
				await next;
				return;
			}
			if (targets.length == 0 && !info.notarget) {
				return;
			}
			if (target && event.excluded.includes(target)) {
				const next = game.createEvent("useCardToExcluded", false);
				next.setContent("emptyEvent");
				next.targets = targets;
				next.target = target;
				next.num = num;
				next.card = event.card;
				next.cards = cards;
				next.player = player;
				await next;
				return;
			}
			const next = game.createEvent(event.card.name);
			next.setContent(info.content);
			next.targets = targets;
			next.card = event.card;
			next.cards = cards;
			next.player = player;
			next.num = num;
			next.type = "card";
			next.skill = event.skill;
			next.multitarget = info.multitarget;
			next.preResult = event.preResult;
			next.baseDamage = event.baseDamage;
			if (event.forceDie) {
				next.forceDie = true;
			}
			if (event.addedTargets) {
				next.addedTargets = event.addedTargets;
				next.addedTarget = event.addedTargets[num];
				next._targets = event._targets;
			}
			if (info.targetDelay === false) {
				event.targetDelay = false;
			}
			next.target = target;
			for (const i in event.customArgs.default) {
				next[i] = event.customArgs.default[i];
			}
			if (target && event.customArgs[String(target.playerid)]) {
				const customArgs = event.customArgs[String(target.playerid)];
				for (const i in customArgs) {
					next[i] = customArgs[i];
				}
			}
			if (target && event.directHit !== true && event.directHit.includes(target)) {
				next.directHit = true;
			}
			if (target && !info.multitarget) {
				if (num == 0 && targets.length > 1) {
					// const ttt=next.target;
					// setTimeout(() => { ttt.addTempClass('target'); },0.5*lib.config.duration);
				} else {
					target.addTempClass("target");
				}
			}
			if (!info.nodelay && num > 0) {
				if (event.targetDelay !== false) {
					await game.delayx(0.5);
				}
			}
			event._result = await next.forResult();
		},
		async (event, trigger, player) => {
			const { cards, card } = event;
			const num = Number(event.num);
			const targets = event.getTargets();
			if (event.all_excluded) {
				return;
			}
			if (!get.info(event.card, false).multitarget && num < targets.length - 1 && !event.cancelled) {
				event.num = Number(event.num) + 1;
				event.goto(12);
			}
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			if (event.all_excluded) {
				return;
			}
			if (get.info(event.card, false).contentAfter) {
				const next = game.createEvent(`${event.card.name}ContentAfter`);
				next.setContent(get.info(event.card, false).contentAfter);
				next.targets = targets;
				next.card = event.card;
				next.cards = event.cards;
				next.player = player;
				next.skill = event.skill;
				next.preResult = event.preResult;
				next.type = "postcard";
				if (event.forceDie) {
					next.forceDie = true;
				}
				await next;
			}
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			if (event.all_excluded) {
				return;
			}
			if (event.effectedCount < event.effectCount) {
				if (document.getElementsByClassName("thrown").length) {
					if (event.delayx !== false && get.info(event.card, false).finalDelay !== false) {
						game.delayx();
					}
				}
				event.goto(11);
			}
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			if (event.postAi) {
				const currentPlayer = event.getPlayer();
				if (!currentPlayer.logAi) {
					throw new TypeError("postAi requires the player's logAi callback");
				}
				currentPlayer.logAi(targets, event.card);
			}
			if (event._result) {
				event.result = event._result;
			}
			//delete player.using;
			if (document.getElementsByClassName("thrown").length) {
				if (event.delayx !== false && get.info(event.card, false).finalDelay !== false) {
					game.delayx();
				}
			} else {
				event.finish();
			}
		},
		async (event, trigger, player) => {
			const { cards, card, num } = event;
			const targets = event.getTargets();
			if (typeof event._oncancel === "function") {
				event._oncancel();
			}
		},
	],
	useSkill: [
		async (event, trigger, player) => {
			const { cards, skill } = event;
			const targets = event.getTargets();
			if (!skill) {
				throw new TypeError("useSkill requires an event skill");
			}
			const info = get.info(skill);
			if (!info.noForceDie) {
				event.forceDie = true;
			}
			if (!info.noForceOut) {
				event.includeOut = true;
			}
			event._skill = skill;

			const checkShow = player.checkShow(skill);
			const waitings: GameEvent[] = [];
			let losecard: GameEvent | null = null;
			if (info.discard != false && info.lose != false && !info.viewAs) {
				const next = player.discard({ cards });
				next.delay = false;
				if (lib.config.low_performance) {
					event.discardTransition = true;
				}
				waitings.push(next);
			} else {
				if (info.lose != false) {
					if (info.losetrigger == false) {
						const next = player.lose({ cards, position: ui.special });
						losecard = next;
						next._triggered = null;
					} else {
						const next = player.lose({ cards, position: ui.special });
						losecard = next;
						if (info.visible) {
							next.visible = true;
						}
						if (info.loseTo) {
							next.position = ui[info.loseTo];
						}
						if (info.insert) {
							next.insert_card = true;
						}
						if (next.position == ui.special && info.toStorage) {
							next.toStorage = true;
						}
					}
				}
				if (!info.prepare && info.viewAs) {
					player.$throw(cards);
					if (losecard) {
						losecard.visible = true;
					}
					if (lib.config.sync_speed && cards[0] && cards[0].clone) {
						const waitingForTransition = get.time();
						event.waitingForTransition = waitingForTransition;
						cards[0].clone.listenTransition(() => {
							if (_status.waitingForTransition == waitingForTransition && _status.paused) {
								game.resume();
							}
							delete event.waitingForTransition;
						}, 1000);
					}
				}
			}
			if (losecard) {
				waitings.push(losecard);
			}
			if (info.line != false && targets.length) {
				const config: { color?: string | number[] } = {};
				const line = info.line;
				if (line && typeof line === "object" && "color" in line && Array.isArray(line.color)) {
					config.color = line.color;
				} else if (info.line == "fire") {
					config.color = "fire";
				} else if (info.line == "thunder") {
					config.color = "thunder";
				} else if (info.line === undefined || info.line == "green") {
					config.color = "green";
				}
				if (info.multitarget && !info.multiline && targets.length > 1) {
					player.line2(targets, config);
				} else {
					player.line(targets, config);
				}
			}
			let str = "";
			if (targets && targets.length && info.log != "notarget") {
				str += `对<span class="bluetext">${targets[0] == player ? "自己" : get.translation(targets[0])}`;
				for (const target of targets.slice(1)) {
					str += `、${target == player ? "自己" : get.translation(target)}`;
				}
				str += "</span>";
			}
			str += "发动了";
			if (!info.direct && info.log !== false) {
				game.trySkillAudio(skill, player, undefined, undefined, null, [event, event.player]);
				game.log(player, str, `【${get.skillTranslation(skill, player)}】`);
				if (info.logv !== false) {
					game.logv(player, skill, targets);
				}
				player.trySkillAnimate(skill, skill, checkShow);
			}
			const stat = player.stat[player.stat.length - 1];
			if (stat) {
				if (event.addCount != false) {
					if (stat.skill[skill] == undefined) {
						stat.skill[skill] = 1;
					} else {
						stat.skill[skill]++;
					}
					const sourceSkill = get.info(skill).sourceSkill;
					if (sourceSkill) {
						if (stat.skill[sourceSkill] == undefined) {
							stat.skill[sourceSkill] = 1;
						} else {
							stat.skill[sourceSkill]++;
						}
					}
				}
				if (stat.allSkills == undefined) {
					stat.allSkills = 1;
				} else {
					stat.allSkills++;
				}
			}
			if (info.prepare) {
				switch (info.prepare) {
					case "give":
						if (losecard) {
							losecard.visible = true;
						}
						player.$give(cards, targets[0]);
						break;
					case "give2":
						player.$give(cards.length, targets[0]);
						break;
					case "throw":
						if (losecard) {
							losecard.visible = true;
						}
						player.$throw(cards);
						break;
					case "throw2":
						player.$throw(cards.length);
						break;
					default:
						if (typeof info.prepare === "function") {
							info.prepare(cards, player, targets);
						}
				}
			}
			if (info.round) {
				const roundname = `${skill}_roundcount`;
				player.storage[roundname] = game.roundNumber;
				player.syncStorage(roundname);
				player.markSkill(roundname);
			}
			const name = skill;
			const players = player.getSkills(false, false, false);
			const equips = player.getSkills("e");
			const global = lib.skill.global.slice(0);
			const logInfo: History_UseSkill = {
				skill: name,
				targets: targets ?? false,
				event: _status.event,
			};
			if (info.sourceSkill) {
				logInfo.sourceSkill = info.sourceSkill;
				if (global.includes(info.sourceSkill)) {
					logInfo.type = "global";
				} else if (players.includes(info.sourceSkill)) {
					logInfo.type = "player";
				} else if (equips.includes(info.sourceSkill)) {
					logInfo.type = "equip";
				}
			} else {
				if (global.includes(name)) {
					logInfo.sourceSkill = name;
					logInfo.type = "global";
				} else if (players.includes(name)) {
					logInfo.sourceSkill = name;
					logInfo.type = "player";
				} else if (equips.includes(name)) {
					logInfo.sourceSkill = name;
					logInfo.type = "equip";
				} else {
					let bool = false;
					for (const skill of players) {
						const expand = [skill];
						game.expandSkills(expand);
						if (expand.includes(name)) {
							bool = true;
							logInfo.sourceSkill = skill;
							logInfo.type = "player";
							break;
						}
					}
					if (!bool) {
						for (const skill of players) {
							const expand = [skill];
							game.expandSkills(expand);
							if (expand.includes(name)) {
								logInfo.sourceSkill = skill;
								logInfo.type = "equip";
								break;
							}
						}
					}
				}
			}
			if (logInfo.sourceSkill !== undefined) {
				event.sourceSkill = logInfo.sourceSkill;
			}
			if (logInfo.type !== undefined) {
				event.type = logInfo.type;
			}
			if (!info.direct && info.log !== false) {
				player.getHistory("useSkill").push(logInfo);
				await event.trigger("useSkill");
			}

			return Promise.all(waitings);
		},
		async (event, trigger, player) => {
			const { cards, targets } = event;
			const skill = event.skill;
			if (!skill) {
				return;
			}
			const info = get.info(skill);
			if (info && info.contentBefore) {
				const next = game.createEvent(`${skill}ContentBefore`);
				next.setContent(info.contentBefore);
				next.targets = targets;
				next.cards = cards;
				next.player = player;
				next.skill = skill;
				if (event.forceDie) {
					next.forceDie = true;
				}
				if (event.includeOut) {
					next.includeOut = true;
				}
				return next.forResult();
			}
		},
		async (event, trigger, player) => {
			const { cards } = event;
			// skill 内容复用 useCard 的目标游标；targets 是普通 Player[]，
			// 所以 Number 保留未初始化游标原有的 NaN/undefined 访问结果。
			const num = Number(event.num);
			const targets = event.getTargets();

			if (!event.skill) {
				const currentPlayer = event.getPlayer();
				console.log("error: no skill", get.translation(currentPlayer), currentPlayer.getSkills());
				if (event._skill) {
					event.skill = event._skill;
					console.log(event._skill);
				} else {
					event.finish();
					return;
				}
			}

			const skill = event.skill;
			if (!skill) {
				event.finish();
				return;
			}
			const info = get.info(skill);

			if ((targets[num] && targets[num].isDead() && !info?.deadTarget) || (targets[num] && targets[num].isOut() && !info?.includeOut) || (targets[num] && targets[num].removed)) {
				if (!info.multitarget && num < targets.length - 1) {
					event.num = Number(event.num) + 1;
					event.redo();
				}
				return;
			}

			if (!info?.content) {
				event.finish();
				return;
			}
			const next = game.createEvent(skill);
			next.setContent(info.content);
			next.targets = targets;
			next.cards = cards;
			next.player = player;
			next.num = num;
			next.multitarget = info.multitarget;
			if (num == 0 && next.targets.length > 1) {
				if (!info.multitarget) {
					lib.tempSortSeat = player;
					targets.sort(lib.sort.seat);
					delete lib.tempSortSeat;
				}
				for (const target of targets) {
					target.addTempClass("target");
				}
			}
			next.target = targets[num];
			if (event.forceDie) {
				next.forceDie = true;
			}
			if (event.includeOut) {
				next.includeOut = true;
			}
			if (next.target && !info.multitarget) {
				if (num == 0 && targets.length > 1) {
					// const ttt=next.target;
					// setTimeout(() => { ttt.addTempClass('target'); },0.5*lib.config.duration);
				} else {
					next.target.addTempClass("target");
				}
			}
			if (num == 0) {
				if (typeof info.delay == "number") {
					game.delay(info.delay);
				} else if (info.delay !== false) {
					if (event.waitingForTransition) {
						_status.waitingForTransition = event.waitingForTransition;
						game.pause();
					} else {
						await game.delayx();
					}
				}
			} else {
				await game.delayx(0.5);
			}
			if (!info.multitarget && num < targets.length - 1) {
				event.num = Number(event.num) + 1;
				event.redo();
			}
		},
		async (event, trigger, player) => {
			const { cards } = event;
			const targets = event.getTargets();
			const skill = event.skill;
			if (!skill) {
				return;
			}
			const info = get.info(skill);
			if (info && info.contentAfter) {
				const next = game.createEvent(`${skill}ContentAfter`);
				next.setContent(info.contentAfter);
				next.targets = targets;
				next.cards = cards;
				next.player = player;
				next.skill = skill;
				if (event.forceDie) {
					next.forceDie = true;
				}
				if (event.includeOut) {
					next.includeOut = true;
				}
				return next.forResult();
			}
		},
		async (event, trigger, player) => {
			const allSkills = player.getStat().allSkills;
			if (allSkills !== undefined && allSkills > 200) {
				player._noSkill = true;
				console.log(player.name, event.skill);
			}
			if (document.getElementsByClassName("thrown").length) {
				if (event.skill && get.info(event.skill).delay !== false && get.info(event.skill).delay !== 0) {
					await game.delayx();
				}
			} else {
				event.finish();
			}
		},
		async () => {
			ui.clear();
		},
	],
	async draw(event, trigger, player) {
		// if(lib.config.background_audio){
		//     game.playAudio('effect','draw');
		// }
		// game.broadcast(() => {
		//     if(lib.config.background_audio){
		//         game.playAudio('effect','draw');
		//     }
		// });
		// draw 的数值路径原先已会在算术中将 undefined 转成 NaN；保留该语义。
		let num = Number(event.num);
		if (typeof event.minnum == "number" && num < event.minnum) {
			num = event.minnum;
		}
		if (event.drawDeck) {
			if (event.drawDeck > num) {
				event.drawDeck = num;
			}
			num -= event.drawDeck;
		}
		let logList;
		if (event.log != false) {
			logList = [player];
			if (num > 0) {
				if (event.bottom) {
					logList.add(`从牌堆底摸了${get.cnNumber(num)}张牌`);
				} else {
					logList.add(`摸了${get.cnNumber(num)}张牌`);
				}
			}
			if (event.drawDeck) {
				logList.add(`从牌库中获得了${get.cnNumber(event.drawDeck)}张牌`);
			}
		}
		let cards: Card[] = [];
		if (num > 0) {
			//otherGetCards属性是从专属牌堆摸牌，没有再看其他的
			if (event.otherGetCards) {
				cards.addArray(event.otherGetCards(num));
			} else if (event.bottom) {
				cards.addArray(get.bottomCards(num));
			} else if (player.getTopCards) {
				cards.addArray(player.getTopCards(num));
			} else {
				cards.addArray(get.cards(num));
			}
		} else {
			cards = [];
		}
		if (event.drawDeck) {
			cards = cards.concat(player.getDeckCards(event.drawDeck));
		}
		if (get.itemtype(cards) == "cards") {
			let next;
			if (event.animate != false) {
				if (event.visible) {
					next = player.gain({ cards: cards.slice(), animate: "gain2", log: false });
					logList.addArray(["（", cards, "）"]);
				} else {
					next = player.gain({ cards: cards.slice(), animate: "draw" });
				}
			} else {
				next = player.gain({ cards: cards.slice() });
				if (event.$draw) {
					player.$draw(cards.length);
				}
			}
			if (logList?.length) {
				game.log(...logList);
			}
			next.gaintag.addArray(event.gaintag);
			await next;
		}
		event.result = {
			bool: true,
			cards,
		};
	},
	async discard(event, trigger, player) {
		const { cards } = event;
		game.log(player, "弃置了", cards);
		event.done = player.lose({ cards, position: event.position, visible: true });
		event.done.type = "discard";
		if (event.discarder) {
			event.done.discarder = event.discarder;
		}
		await event.done;
		await event.trigger("discard");
	},
	async loseToDiscardpile(event, trigger, player) {
		const { cards } = event;
		if (event.log != false) {
			game.log(player, "将", cards, "置入了弃牌堆");
		}
		const next = player.lose({ cards, position: event.position });
		if (event.insert_index) {
			next.insert_index = event.insert_index;
		}
		if (event.insert_card) {
			next.insert_card = true;
		}
		if (!event.blank) {
			next.visible = true;
		}
		next.type = "loseToDiscardpile";
		event.done = next;
		await next;
		await event.trigger("loseToDiscardpile");
	},
	respond: [
		async (event, trigger, player) => {
			const { cards, card } = event;
			let cardaudio = true;
			if (event.skill) {
				const skill = requireRegisteredSkill(lib.skill, event.skill);
				if (skill.audio) {
					cardaudio = false;
				}
				if (skill.log != false) {
					const logAudioArgs: Video["content"] = [event, event.player];
					player.logSkill(event.skill, false, null, null, logAudioArgs);
				}
				/*if (get.info(event.skill).popname) {
					player.tryCardAnimate(event.card, event.card.name, "metal", true);
				}*/
				player.checkShow(event.skill, true);
				const onrespond = skill.onrespond;
				if (typeof onrespond == "function" && !game.online) {
					onrespond.call(skill, event, player);
				}
			} else if (!event.nopopup) {
				if (event.card && typeof event.card.name == "string") {
					const card =
						event.card instanceof lib.element.Card || event.card instanceof lib.element.VCard
							? event.card
							: new lib.element.VCard(event.card);
					player.tryCardAnimate(card, card.name, "wood");
				}
			}
			if (cardaudio && event.getParent(3).name == "useCard") {
				game.broadcastAll(
					(player, card) => {
						game.playCardAudio(card, player);
					},
					player,
					event.card
				);
			}
			if (event.skill && event.addSkillCount !== false) {
				if (player.stat[player.stat.length - 1].skill[event.skill] == undefined) {
					player.stat[player.stat.length - 1].skill[event.skill] = 1;
				} else {
					player.stat[player.stat.length - 1].skill[event.skill]++;
				}
				const sourceSkill = get.info(event.skill).sourceSkill;
				if (sourceSkill) {
					if (player.stat[player.stat.length - 1].skill[sourceSkill] == undefined) {
						player.stat[player.stat.length - 1].skill[sourceSkill] = 1;
					} else {
						player.stat[player.stat.length - 1].skill[sourceSkill]++;
					}
				}
			}
			if (cards.length && (cards.length > 1 || cards[0].name != event.card.name)) {
				game.log(player, "打出了", event.card, "（", cards, "）");
			} else {
				game.log(player, "打出了", event.card);
			}
			player.actionHistory[player.actionHistory.length - 1].respond.push(event);
			const loseMap: Record<string, Card[]> = { noowner: [] };
			event.lose_map = loseMap;
			if (typeof player.playerid == "string") {
				loseMap[player.playerid] = [];
			}
			const cards_ow = event.cards.slice();
			while (cards_ow.length) {
				const owner = get.owner(cards_ow[0]);
				if (owner) {
					const id = owner.playerid;
					const Cards_card = cards.filter(card => get.owner(card) == owner);
					cards_ow.removeArray(Cards_card);
					owner.getCards("ej").forEach(card => {
						const cardSymbol = card.cardSymbol;
						const cardsx = cardSymbol !== undefined ? card[cardSymbol]?.cards?.filter(cardx => cards.includes(cardx)) : undefined;
						if (!cardsx?.length) {
							return;
						}
						event.cards.removeArray(cardsx);
						event.cards.add(card);
					});
					if (typeof id == "string") {
						loseMap[id] ??= [];
						loseMap[id].addArray(Cards_card);
					} else {
						loseMap.noowner.addArray(Cards_card);
					}
				} else {
					const noownerCard = cards_ow.shift();
					if (noownerCard) {
						loseMap.noowner.add(noownerCard);
					}
				}
			}
			player.respondAnimateBefore?.(event, trigger, player);
			if (event.animate != false && event.throw !== false) {
				let throw_cards = cards;
				let virtualCard_str = "";
				for (const id in loseMap) {
					if (id == "noowner") {
						continue;
					}
					const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
					const throws = loseMap[id];
					if (owner == player) {
						if (!throw_cards.length && lib.config.card_animation_info) {
							const virtualCard = ui.create.card(undefined, undefined, undefined);
							virtualCard._destroy = true;
							virtualCard.expired = true;
							const info = lib.card[card.name];
							const number = card.number;
							virtualCard.init([get.suit(card), typeof number == "number" ? number : "虚拟", card.name, card.nature]);
							const infoNode = virtualCard.querySelector(".info");
							if (infoNode instanceof HTMLElement) {
								virtualCard_str = infoNode.innerHTML;
							}
							throw_cards = [virtualCard];
							throws.add(virtualCard);
						}
						if (lib.config.card_animation_info) {
							throws.addArray(loseMap.noowner);
						}
					}
					if (throws.length) {
						owner.$throw(throws);
					}
				}
				if (loseMap.noowner.length && !lib.config.card_animation_info) {
					for (const card of loseMap.noowner) {
						game.broadcastAll(
							(player, card, cardid) => {
								let event;
								if (game.online) {
									event = {};
								} else {
									event = _status.event;
								}
								if (game.chess) {
									event.node = card.copy("thrown", "center", ui.arena).addTempClass("start");
								} else {
									event.node = player.$throwordered(card.copy(), true);
								}
								if (lib.cardOL) {
									lib.cardOL[cardid] = event.node;
								}
								event.node.cardid = cardid;
								event.node.classList.add("thrownhighlight");
							},
							player,
							card,
							get.id()
						);
					}
				}
				if (lib.config.card_animation_info) {
					game.broadcastAll(
						(cards, card, card_cards, str, judgeing) => {
							for (const nodex of cards) {
								const node = nodex.clone;
								if (nodex._tempName) {
									nodex._tempName.delete();
									delete nodex._tempName;
								}
								if (!node) {
									continue;
								}
								if (str) {
									const infoNode = node.querySelector(".info");
									if (infoNode instanceof HTMLElement) {
										infoNode.innerHTML = str;
									}
								}
						if ((cards.length > 1 || !card.isCard || card.name != node.name || card.nature != node.nature || !card.cards?.length) && !judgeing) {
									ui.create.cardTempName(card, node);
									if (node._tempName && card_cards?.length <= 0) {
										node._tempName.innerHTML = node._tempName.innerHTML.slice(0, node._tempName.innerHTML.indexOf("<span", -1));
										node._tempName.innerHTML += "<span style='color:black'>虚拟</span></span>";
									}
								}
							}
						},
						throw_cards,
						event.card,
						event.cards,
						virtualCard_str,
						Boolean(event.highlight)
					);
				}
				if (event.highlight) {
					for (const card of throw_cards) {
						if (card.clone) {
							card.clone.classList.add("thrownhighlight");
							game.addVideo("highlightnode", player, get.cardInfo(card));
						}
					}
				}
				if (event.highlight) {
					game.broadcast(cards => {
						for (const card of cards) {
							if (card.clone) {
								card.clone.classList.add("thrownhighlight");
							}
						}
					}, throw_cards);
				}
			}
			if (cards.length) {
				const ownerCards = cards.filter(card => get.owner(card));
				const directDiscard = cards.filter(card => !get.owner(card));
				if (ownerCards.length) {
					let ownerx: Player | undefined;
					for (const card of ownerCards) {
						const owner = get.owner(card);
						if (!owner) {
							continue;
						}
						ownerx = owner;
						break;
					}
					if (
						cards.some(card => {
							const owner = get.owner(card);
							return owner != ownerx;
						})
					) {
						await game.loseAsync({ player: player, cards: ownerCards }).setContent(async (event, trigger, player) => {
							const cards = event.cards;
								const cards_noowner: Card[] = [];
							while (cards.length) {
								const owner = get.owner(cards[0]);
								if (!owner) {
									const noownerCard = cards.shift();
									if (noownerCard) {
										cards_noowner.add(noownerCard);
									}
								} else {
									const id = owner.playerid;
									const onLoseCards = cards.filter(card => get.owner(card) == owner);
									event.cards.removeArray(onLoseCards);
									await owner.lose(onLoseCards, "visible", ui.ordering).set("relatedEvent", event.getParent()).set("getlx", false).set("type", "use");
								}
							}
							if (cards_noowner.length) {
								const ordering = game.cardsGotoOrdering(cards_noowner);
								if (ordering) {
									await ordering.set("relatedEvent", event.getParent());
								}
							}
						});
					} else {
						if (ownerx) {
							await ownerx.lose({ cards: ownerCards, position: ui.ordering, visible: true }).set("type", "use");
						}
					}
				}
				if (directDiscard.length) {
					loseMap.noowner.addArray(directDiscard);
					await game.cardsGotoOrdering(directDiscard);
				}
			}
			await event.trigger("respond");
			await game.delayx(0.5);
		},
	],
	async swapHandcards(event, trigger, player) {
		const target = event.getTarget();

		event.cards1 = event.cards1 || player.getCards("h");
		event.cards2 = event.cards2 || target.getCards("h");
		await game
			.loseAsync({
				player: player,
				target: target,
				cards1: event.cards1,
				cards2: event.cards2,
			})
			.setContent("swapHandcardsx");
		await game
			.loseAsync({
				gain_list: [
					[player, event.cards2.filterInD()],
					[target, event.cards1.filterInD()],
				],
			})
			.setContent("gaincardMultiple");
		await game.delayx();
	},
	async swapHandcardsx(event, trigger, player) {
		const target = event.getTarget();
		const { cards1, cards2 } = event;

		player.$giveAuto(cards1, target);
		target.$giveAuto(cards2, player);

		let delayed = false;

		let cards = cards1;
		const next1 = player.lose(cards, ui.ordering);
		next1.getlx = false;
		next1.relatedEvent = event.getParent();
		if (player == game.me) {
			delayed = true;
		} else {
			next1.delay = false;
		}

		await next1;

		cards = event.cards2;
		const next2 = target.lose(cards, ui.ordering);
		next2.getlx = false;
		next2.relatedEvent = event.getParent();
		if (target == game.me) {
			delayed = true;
		} else {
			next2.delay = false;
		}

		await next2;

		if (!delayed) {
			await game.delay();
		}
	},
	async gainMultiple(event, trigger, player) {
		const targets = [...event.getTargets()].sortBySeat();
		const map = new Map<Player, Card[]>();

		for (const target of targets.sortBySeat()) {
			const next = player
				.gainPlayerCard({ target, position: event.position, forced: true })
				.set("boolline", false)
				.set("delay", false);
			next.gaintag.addArray(event.gaintag);
			const result = await next.forResult();
			if (typeof result !== "string" && result.bool && Array.isArray(result.cards) && result.cards.length) {
				map.set(target, result.cards);
			}
		}

		event.cards = Array.from(map.values()).flat();
		event.result = {
			bool: true,
			cards: event.cards,
			targets: targets,
			gain_map: map,
		};

		await game.delay();
	},
	gain: [
		async (event, trigger, player) => {
			const { cards } = event;
			if (event.animate == "give" || event.animate == "gain2" || event.animate == "draw2") {
				event.visible = true;
			}
			if (Array.isArray(cards) && !cards.some(card => get.itemtype(card) !== "card")) {
				const map: Record<string, [Card[], Card[], Card[]]> = {};
				for (const i of cards) {
					const owner = get.owner(i, "judge");
					if (owner && (owner != player || get.position(i) != "h")) {
						const id = owner.playerid;
						if (typeof id !== "string") continue;
						if (!map[id]) {
							map[id] = [[], [], []];
						}
						map[id][0].push(i);
						const position = get.position(i);
						if (position == "h") {
							map[id][1].push(i);
						} else {
							map[id][2].push(i);
						}
					} else if (!event.updatePile && get.position(i) == "c") {
						event.updatePile = true;
					}
					if (event.visible) {
						i.addKnower("everyone");
					}
				}
				event.losing_map = map;
				for (const i in map) {
					const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
					const next = owner.lose({ cards: map[i][0], position: ui.special }).set("type", "gain").set("forceDie", true).set("getlx", false);
					if (event.visible == true) {
						next.visible = true;
					}
					event.relatedLose = next;
				}
			} else {
				const name = event.getParent(event.getlx === false ? 2 : 1).name;
				console.warn(`请检查技能：${name}中关于gain的写法`);
				event.finish();
			}
		},
		async (event, trigger, player) => {
			let { cards } = event;
			event.cards = cards = cards.map(i => (i.cards ? i.cards : [i])).flat();
			for (let i = 0; i < cards.length; i++) {
				if (cards[i].willBeDestroyed("handcard", player, event)) {
					cards[i].selfDestroy(event);
					cards.splice(i--, 1);
				} else if (event.losing_map) {
					for (const id in event.losing_map) {
						if (event.losing_map[id][0].includes(cards[i])) {
							const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
							const hs = source.getCards("hejsx");
							if (hs.includes(cards[i])) {
								cards.splice(i--, 1);
							} else {
								cards[i].addKnower(source);
							}
						}
					}
				}
			}
			if (cards.length == 0) {
				event.finish();
				return;
			}
			player.getHistory("gain").push(event);
			//if(event.source&&event.delay!==false) game.delayx();
		},
		async (event, trigger, player) => {
			const { cards } = event;
			const stat = player.getStat();
			if (stat.gain == undefined) {
				stat.gain = cards.length;
			} else {
				stat.gain += cards.length;
			}
		},
		async (event, trigger, player) => {
			const { cards } = event;
			for (const [key, value] of lib.commonArea) {
				const list = (_status[value.areaStatusName] || []).filter(card => cards.includes(card));
				if (event[value.fromName] || list.length) {
					const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
					next.setContent(value.removeHandeler);
					next.player = player;
					next.type = event.name;
					await next;
				}
			}
		},
		async (event, trigger, player) => {
			const { cards } = event;
			let sort;
			const frag1 = document.createDocumentFragment();
			const frag2 = document.createDocumentFragment();
			const hs = player.getCards("hs");
			for (let i = 0; i < cards.length; i++) {
				if (hs.includes(cards[i])) {
					cards.splice(i--, 1);
				}
			}
			for (const card of cards) {
				sort = lib.config.sort_card(card);
				if (lib.config.reverse_sort) {
					sort = -sort;
				}
				if (["o", "d"].includes(get.position(card, true))) {
					card.addKnower("everyone");
				}
				card.fix();
				card.style.transform = "";
				event.gaintag.forEach(tag => card.addGaintag(tag));
				if (event.knowers) {
					card.addKnower(event.knowers); //添加事件设定的知情者。
				}
				if (_status.discarded) {
					_status.discarded.remove(card);
				}
				// cards[num].vanishtag.length=0;
				for (let num2 = 0; num2 < card.vanishtag.length; num2++) {
					if (card.vanishtag[num2][0] != "_") {
						card.vanishtag.splice(num2--, 1);
					}
				}
				if (player == game.me) {
					card.classList.add("drawinghidden");
				}
				if (get.is.singleHandcard() || sort > 1) {
					frag1.appendChild(card);
				} else {
					frag2.appendChild(card);
				}
			}
			const addv = () => {
				if (player == game.me) {
					game.addVideo("gain12", player, [get.cardsInfo(Array.from(frag1.childNodes)), get.cardsInfo(Array.from(frag2.childNodes)), event.gaintag]);
				}
			};
			const broadcast = () => {
				game.broadcast(
					(player, cards, num, gaintag) => {
						player.directgain(cards, null, gaintag);
						_status.cardPileNum = num;
					},
					player,
					cards,
					ui.cardPile.childNodes.length,
					event.gaintag
				);
			};
			const postAnimate = () => {
				addv();
				player.node.handcards1.insertBefore(frag1, player.node.handcards1.firstChild);
				player.node.handcards2.insertBefore(frag2, player.node.handcards2.firstChild);
				player.update();
				if (player === game.me) {
					ui.updatehl();
				}
				broadcast();
			};

			let animateTime: number | Promise<void> | null = null;
			const animate = event.animate;
			switch (animate) {
				case "draw":
					player.$draw(cards.length);
					animateTime = 500;
					break;
				case "gain":
					player.$gain(cards, event.log);
					animateTime = 700;
					break;
				case "draw2":
				case "gain2":
					animateTime = 300;
					if (player.$gain2(cards, event.log) && player === game.me) {
						animateTime = 500;
					}
					break;
				case "give":
				case "giveAuto": {
					const evtmap = event.losing_map;
					if (animate === "give") {
						for (const id in evtmap) {
							const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
							source.$give(evtmap[id][0], player, event.log);
						}
					} else {
						for (const id in evtmap) {
							const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
							if (evtmap[id][1].length) {
								source.$giveAuto(evtmap[id][1], player, event.log);
							}
							if (evtmap[id][2].length) {
								source.$give(evtmap[id][2], player, event.log);
							}
						}
					}
					animateTime = 500;
					break;
				}
				default:
					if (typeof animate === "function") {
						animateTime = animate(event);
					}
					break;
			}
			if (animateTime == null) {
				postAnimate();
			} else {
				const waiting = typeof animateTime === "number" ? delay(get.delayx(animateTime, animateTime)) : animateTime;
				waiting.then(postAnimate).finally(() => void game.resume());
				await game.pause();
				game.delayx();
			}

			if (event.updatePile) {
				game.updateRoundNumber();
			}
		},
	],
	addToExpansion: [
		async (event, trigger, player) => {
			const { cards } = event;
			if (event.animate == "give") {
				event.visible = true;
			}
			if (get.itemtype(cards) == "cards") {
				type LoseMap = { [playerid: string]: [Card[], Card[], Card[]] };
				const map: LoseMap = {};
				for (const i of cards) {
					const owner = get.owner(i, "judge");
					if (owner && (owner != player || get.position(i) != "x")) {
						const id = owner.playerid;
						if (typeof id !== "string") {
							continue;
						}
						if (!map[id]) {
							map[id] = [[], [], []];
						}
						map[id][0].push(i);
						const position = get.position(i);
						if (position == "h") {
							map[id][1].push(i);
						} else {
							map[id][2].push(i);
						}
					} else if (!event.updatePile && get.position(i) == "c") {
						event.updatePile = true;
					}
					if (event.visible) {
						i.addKnower("everyone");
					}
				}
				event.losing_map = map;
				for (const i in map) {
					const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
					const next = owner.lose(map[i][0], ui.special).set("type", "loseToExpansion").set("forceDie", true).set("getlx", false);
					if (event.visible == true) {
						next.visible = true;
					}
					event.relatedLose = next;
				}
			} else {
				event.finish();
			}
		},
		async (event, trigger, player) => {
			let { cards } = event;
			const { source } = event;
			event.cards = cards = cards.map(i => (i.cards ? i.cards : [i])).flat();
			for (let i = 0; i < cards.length; i++) {
				if (cards[i].willBeDestroyed("expansion", player, event)) {
					cards[i].selfDestroy(event);
					cards.splice(i--, 1);
				} else if (event.losing_map) {
					for (const id in event.losing_map) {
						if (event.losing_map[id][0].includes(cards[i])) {
							const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
							const hs = source.getCards("hejsx");
							if (hs.includes(cards[i])) {
								cards.splice(i--, 1);
							}
						} else {
							cards[i].addKnower(source);
						}
					}
				}
			}
			if (cards.length == 0) {
				event.finish();
				return;
			}
		},
		async (event, trigger, player) => {
			const { cards } = event;
			for (const [key, value] of lib.commonArea) {
				const list = (_status[value.areaStatusName] || []).filter(card => cards.includes(card));
				if (event[value.fromName] || list.length) {
					const next = initializeEvent(game.createEvent(`from_${value.fromName}`), { cards });
					next.setContent(value.removeHandeler);
					next.player = player;
					next.type = event.name;
					await next;
				}
			}
		},
		async (event, trigger, player) => {
			const { cards } = event;
			const hs = player.getCards("x");
			for (let i = 0; i < cards.length; i++) {
				if (hs.includes(cards[i])) {
					cards.splice(i--, 1);
				}
			}
			for (const card of cards) {
				if (["o", "d"].includes(get.position(card, true))) {
					card.addKnower("everyone");
				}
				if (_status.discarded) {
					_status.discarded.remove(card);
				}
				for (let num2 = 0; num2 < card.vanishtag.length; num2++) {
					if (card.vanishtag[num2][0] != "_") {
						card.vanishtag.splice(num2--, 1);
					}
				}
			}

			const postAnimate = () => {
				player.$addToExpansion(cards, null, event.gaintag);
				for (const gaintag of event.gaintag) {
					player.markSkill(gaintag);
				}
			};

			let animateTime: number | Promise<void> | null = null;
			const animate = event.animate;
			switch (animate) {
				case "draw":
					player.$draw(cards.length);
					if (event.log) {
						game.log(player, "将", get.cnNumber(cards.length), "张牌置于了武将牌上");
					}
					animateTime = 500;
					break;
				case "gain":
					player.$gain(cards, false);
					animateTime = 700;
					break;
				case "gain2":
				case "draw2": {
					animateTime = 300;
					if (player.$gain2(cards) && player === game.me) {
						animateTime = 500;
					}
					break;
				}
				case "give":
				case "giveAuto": {
					const evtmap = event.losing_map;
					if (animate === "give") {
						for (const id in evtmap) {
							const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
							source.$give(evtmap[id][0], player, false);
							if (event.log) {
								game.log(player, "将", evtmap[id][0], "置于了武将牌上");
							}
						}
					} else {
						for (const id in evtmap) {
							const source = (_status.connectMode ? lib.playerOL : game.playerMap)[id];
							if (evtmap[id][1].length) {
								source.$giveAuto(evtmap[id][1], player, false);
								if (event.log) {
									game.log(player, "将", get.cnNumber(evtmap[id][1].length), "张牌置于了武将牌上");
								}
							}
							if (evtmap[id][2].length) {
								source.$give(evtmap[id][2], player, false);
								if (event.log) {
									game.log(player, "将", evtmap[id][2], "置于了武将牌上");
								}
							}
						}
					}
					animateTime = 500;
					break;
				}
				default:
					if (typeof animate === "function") {
						animateTime = animate(event);
					}
					break;
			}

			if (animateTime == null) {
				postAnimate();
			} else {
				const waiting = typeof animateTime === "number" ? delay(get.delayx(animateTime, animateTime)) : animateTime;
				waiting.then(postAnimate).finally(() => void game.resume());
				await game.pause();
				game.delayx();
			}

			if (event.updatePile) {
				game.updateRoundNumber();
			}
		},
	],
	lose: [
		async (event, trigger, player) => {
			const { cards } = event;
			const evt = event.getParent(undefined, true);
			if (!evt || (evt.name != "discard" || event.type != "discard") && (evt.name != "loseToDiscardpile" || event.type != "loseToDiscardpile")) {
				event.delay = false;
				return;
			}
			if (evt.delay === false) {
				event.delay = false;
			}
			if (evt.animate != false) {
				evt.discardid = lib.status.videoId++;
				game.broadcastAll(
					(player, cards, id, visible) => {
						const cardx = cards
							.slice()
							.map(i => (i.cards ? i.cards : [i]))
							.flat();
						player.$throw(cardx, null, "nobroadcast");
						const cardnodes: CardNodeList = [];
						cardnodes._discardtime = get.time();
						for (const card of cardx) {
							if (card.clone) {
								cardnodes.push(card.clone);
								if (!visible) {
									card.clone.classList.add("infohidden");
									card.clone.classList.add("infoflip");
								}
							}
						}
						ui.todiscard[id] = cardnodes;
					},
					player,
					cards,
					evt.discardid,
					event.visible
				);
				if (lib.config.sync_speed && cards[0] && cards[0].clone) {
					if (evt.delay != false) {
						const waitingForTransition = get.time();
						evt.waitingForTransition = waitingForTransition;
						cards[0].clone.listenTransition(() => {
							if (_status.waitingForTransition == waitingForTransition && _status.paused) {
								game.resume();
							}
							delete evt.waitingForTransition;
						});
					} else if (evt.getParent(undefined, true)?.discardTransition) {
						const parent = evt.getParent(undefined, true);
						if (!parent) {
							return;
						}
						delete parent.discardTransition;
						const waitingForTransition = get.time();
						parent.waitingForTransition = waitingForTransition;
						cards[0].clone.listenTransition(() => {
							if (_status.waitingForTransition == waitingForTransition && _status.paused) {
								game.resume();
							}
							const currentParent = evt.getParent(undefined, true);
							if (currentParent) {
								delete currentParent.waitingForTransition;
							}
						});
					}
				}
			}
		},
		async (event, trigger, player) => {
			const { cards } = event;
			event.vcards = {
				//这玩意拿来存储假牌
				cards: [],
				es: [],
				js: [],
			};
			//这个拿来存储虚拟牌对应的实体牌
			event.vcard_cards = [];
			event.gaintag_map = {};
			const hs: Card[] = [];
			const es: Card[] = [];
			const js: Card[] = [];
			const ss: Card[] = [];
			const xs: Card[] = [];
			const unmarks: string[] = [];
			if (event.insert_card && event.position == ui.cardPile) {
				event.cards.reverse();
			}
			const hej = player.getCards("hejsx");
			event.stockcards = cards.slice(0);
			for (let i = 0; i < cards.length; i++) {
				const cardx = [cards[i]];
				if (!hej.includes(cards[i])) {
					cards.splice(i--, 1);
					continue;
				} else if (cards[i].parentElement) {
					const parent = cards[i].parentElement;
					if (!parent) {
						continue;
					}
					if (parent.classList.contains("equips")) {
						cards[i].original = "e";
						const cardSymbol = cards[i].cardSymbol;
						const VEquip = cardSymbol === undefined ? undefined : cards[i][cardSymbol];
						if (VEquip && cards[i].isViewAsCard) {
							//判断是否是假牌
							const loseCards = VEquip.cards;
							//解体！
							cardx.addArray(loseCards);
							event.vcard_cards.addArray(loseCards);
							loseCards.forEach(cardi => {
								cardi.original = "e";
								delete cardi.destiny;
								es.push(cardi);
								event.vcard_map.set(cardi, VEquip || get.autoViewAs(cards[i], void 0, false));
							});
						} else {
							es.push(cards[i]);
							event.vcard_map.set(cards[i], VEquip || get.autoViewAs(cards[i], void 0, false));
							event.vcard_cards.add(cards[i]);
						}
						event.vcards.cards.push(cards[i]);
						event.vcards.es.push(cards[i]);
					} else if (parent.classList.contains("judges")) {
						cards[i].original = "j";
						const cardSymbol = cards[i].cardSymbol;
						const VJudge = cardSymbol === undefined ? undefined : cards[i][cardSymbol];
						if (VJudge && cards[i].isViewAsCard) {
							//判断是否是假牌
							const loseCards = VJudge.cards;
							//解体！
							cardx.addArray(loseCards);
							event.vcard_cards.addArray(loseCards);
							loseCards.forEach(cardi => {
								cardi.original = "j";
								delete cardi.destiny;
								js.push(cardi);
								event.vcard_map.set(cardi, VJudge || get.autoViewAs(cards[i], void 0, false));
							});
						} else {
							js.push(cards[i]);
							event.vcard_map.set(cards[i], VJudge || get.autoViewAs(cards[i], void 0, false));
							event.vcard_cards.add(cards[i]);
						}
						event.vcards.cards.push(cards[i]);
						event.vcards.js.push(cards[i]);
					} else if (parent.classList.contains("expansions")) {
						cards[i].original = "x";
						xs.push(cards[i]);
						event.vcard_map.set(cards[i], get.autoViewAs(cards[i], void 0, false));
						if (cards[i].gaintag && cards[i].gaintag.length) {
							unmarks.addArray(cards[i].gaintag);
						}
					} else if (parent.classList.contains("handcards")) {
						if (cards[i].classList.contains("glows")) {
							cards[i].original = "s";
							ss.push(cards[i]);
							event.vcard_map.set(cards[i], get.autoViewAs(cards[i], void 0, false));
						} else {
							cards[i].original = "h";
							hs.push(cards[i]);
							event.vcard_map.set(cards[i], get.autoViewAs(cards[i], void 0, player));
						}
					} else {
						Object.assign(cards[i], { original: null });
					}
				}
				for (const card of cardx) {
					if (card.gaintag && card.gaintag.length) {
						if (card.cardid !== undefined) {
							event.gaintag_map[card.cardid] = card.gaintag.slice(0);
						}
						//仅移除非永久标记
						const tags = card.gaintag.filter(tag => !tag.startsWith("eternal_"));
						tags.forEach(tag => card.removeGaintag(tag));
					}

					card.style.transform += " scale(0.2)";
					card.classList.remove("glow");
					card.classList.remove("glows");
					card.recheck();

					const info = lib.card[card.name];
					if ("_destroy" in card) {
						if (card._destroy) {
							card.delete();
							card.destroyed = card._destroy;
							continue;
						}
					} else if (event.position && card.willBeDestroyed(event.position.id, null, event)) {
						card.selfDestroy(event);
						continue;
					} else if (info.destroy) {
						card.delete();
						card.destroyed = info.destroy;
						continue;
					}
					/*else if ("destroyed" in cardx[j]) {
						
					}*/
					if (event.position) {
						if (_status.discarded) {
							if (event.position == ui.discardPile) {
								_status.discarded.add(card);
							} else {
								_status.discarded.remove(card);
							}
						}
						if (event.insert_index) {
							card.fix();
							event.position.insertBefore(card, event.insert_index(event, card));
						} else if (event.insert_card) {
							card.fix();
							event.position.insertBefore(card, event.position.firstChild);
						} else if (event.position == ui.cardPile) {
							card.fix();
							event.position.appendChild(card);
						} else {
							card.goto(event.position);
						}
					} else {
						card.remove();
					}
					//if(ss.includes(cardx[j])) cards.splice(i--,1);
				}
			}
			if (player == game.me) {
				ui.updatehl();
			}
			ui.updatej(player);
			game.broadcast(
				(player, cards, num) => {
					for (const card of cards) {
						//cards[i].removeGaintag(true);
						//仅移除非永久标记
						const tags = card.gaintag.filter(tag => !tag.startsWith("eternal_"));
						tags.forEach(tag => card.removeGaintag(tag));
						card.classList.remove("glow");
						card.classList.remove("glows");
						card.fix();
						card.remove();
					}
					if (player == game.me) {
						ui.updatehl();
					}
					ui.updatej(player);
					_status.cardPileNum = num;
				},
				player,
				cards.slice(),
				ui.cardPile.childNodes.length
			);
			game.addVideo("lose", player, [get.cardsInfo(hs), get.cardsInfo(es), get.cardsInfo(js), get.cardsInfo(ss)]);
			event.cards2 = hs.concat(es);
			cards.removeArray(event.vcards.cards);
			cards.addArray(event.vcard_cards);
			player.getHistory("lose").push(event);
			game.getGlobalHistory().cardMove.push(event);
			player.update();
			game.addVideo("loseAfter", player);
			event.num = 0;
			if (event.position == ui.ordering) {
				const evt = event.relatedEvent || event.getParent();
				if (!evt.orderingCards) {
					evt.orderingCards = [];
				}
				if (!evt.noOrdering && !evt.cardsOrdered) {
					evt.cardsOrdered = true;
					const next = game.createEvent("orderingDiscard", false);
					event.next.remove(next);
					evt.after.push(next);
					next.relatedEvent = evt;
					next.setContent("orderingDiscard");
				}
				if (!evt.noOrdering) {
					evt.orderingCards.addArray(cards);
				}
			} else if (event.position == ui.cardPile) {
				game.updateRoundNumber();
			}
			if (unmarks.length) {
				for (const i of unmarks) {
					const skill = getRegisteredSkill(lib.skill, i);
					player[(skill && skill.mark) || player.hasCard(card => card.hasGaintag(i), "x") ? "markSkill" : "unmarkSkill"](i);
				}
			}
			event.hs = hs;
			event.es = es;
			event.js = js;
			event.ss = ss;
			event.xs = xs;
			game.clearCardKnowers(hs);
			if (hs.length && !event.visible) {
				player.getCards("h").forEach(hcard => {
					hcard.clearKnowers();
				});
			}
		},
		async (event, trigger, player) => {
			// 虚拟装备列表由前序步骤构建为普通数组；游标未初始化时
			// Number 仍使访问落在不存在的 NaN 属性上，不会伪造第 0 项。
			const num = Number(event.num);
			if (num < event.vcards.cards.length) {
				if (event.vcards.es.includes(event.vcards.cards[num])) {
					event.loseEquip = true;
					const VEquip = event.vcards.cards[num][event.vcards.cards[num].cardSymbol];
					if (VEquip) {
						player.removeVirtualEquip(VEquip);
						//player.removeEquipTrigger(cards[num]);
						const info = get.info(VEquip, false);
						if (info.onLose && (!info.filterLose || info.filterLose(VEquip, player))) {
							event.goto(3);
							event.currentVEquip = VEquip;
							return;
						}
					}
				} else if (event.vcards.js.includes(event.vcards.cards[num])) {
					const VJudge = event.vcards.cards[num][event.vcards.cards[num].cardSymbol];
					if (VJudge) {
						player.removeVirtualJudge(VJudge);
					}
				}
				event.num = Number(event.num) + 1;
				event.redo();
			} else {
				if (event.loseEquip) {
					player.addEquipTrigger();
				}
				event.goto(4);
			}
		},
		async (event, trigger, player) => {
			const VEquip = event.currentVEquip;
			const info = get.info(VEquip, false);
			if (info.loseDelay != false && (player.isAlive() || info.forceDie)) {
				player.popup(VEquip.name);
				game.delayx();
			}
			if (Array.isArray(info.onLose)) {
				for (const onLose of info.onLose) {
					const next = game.createEvent(`lose_${VEquip.name}`);
					next.setContent(onLose);
					if (info.forceDie) {
						next.forceDie = true;
					}
					next.player = player;
					next.card = VEquip;
					next.cards = VEquip.cards;
				}
			} else {
				const next = game.createEvent(`lose_${VEquip.name}`);
				next.setContent(info.onLose);
				next.player = player;
				if (info.forceDie) {
					next.forceDie = true;
				}
				next.card = VEquip;
				next.cards = VEquip.cards;
			}
			event.num = Number(event.num) + 1;
			event.goto(2);
		},
		async (event, trigger, player) => {
			const { cards } = event;
			event.cards = cards.map(i => (i.cards ? i.cards : [i])).flat();
			for (const [key, value] of lib.commonArea) {
				if (event[value.toName]) {
					const next = initializeEvent(game.createEvent(`lose_${value.toName}`), { cards });
					next.setContent(value.addHandeler);
					next.player = player;
					next.relatedEvent = event;
					next.type = event.name;
					await next;
				}
			}
		},
		async (event, trigger, player) => {
			const evt = event.getParent();
			if (evt.name != "discard" && event.type != "discard" && evt.name != "loseToDiscardpile" && event.type != "loseToDiscardpile") {
				return;
			}
			if (event.animate === false || event.delay === false) {
				return;
			}
			if (evt.delay != false) {
				if (evt.waitingForTransition) {
					_status.waitingForTransition = evt.waitingForTransition;
					game.pause();
				} else {
					game.delayx();
				}
			}
		},
	],
	damage: [
		async (event, trigger, player) => {
			event.forceDie = true;
			event.includeOut = true;
			if (event.unreal) {
				event.goto(4);
				return;
			}
			game.callHook("checkDamage1", [event, player]);
			await event.trigger("damageBegin1");
		},
		async (event, trigger, player) => {
			game.callHook("checkDamage2", [event, player]);
			await event.trigger("damageBegin2");
		},
		async (event, trigger, player) => {
			game.callHook("checkDamage3", [event, player]);
			await event.trigger("damageBegin3");
		},
		async (event, trigger, player) => {
			game.callHook("checkDamage4", [event, player]);
			event.trigger("damageBegin4");
		},
		async (event, trigger, player) => {
			const { source } = event;
			const num = Number(event.num);
				if (Number(player.hujia) > 0 && !player.hasSkillTag("nohujia") && !event.nohujia) {
				let damageAudioInfo = lib.natureAudio.hujia_damage[event.nature];
				if (!damageAudioInfo || damageAudioInfo == "normal") {
					damageAudioInfo = `effect/hujia_damage${num > 1 ? "2" : ""}.mp3`;
				} else if (damageAudioInfo == "default") {
					damageAudioInfo = `effect/hujia_damage_${event.nature}${num > 1 ? "2" : ""}.mp3`;
				} else {
					damageAudioInfo = damageAudioInfo[num > 1 ? 2 : 1];
				}
				game.broadcastAll(damageAudioInfo => {
					if (lib.config.background_audio) {
						game.playAudio(damageAudioInfo);
					}
				}, damageAudioInfo);
			} else {
				let damageAudioInfo = lib.natureAudio.damage[event.nature];
				if (!damageAudioInfo || damageAudioInfo == "normal") {
					damageAudioInfo = `effect/damage${num > 1 ? "2" : ""}.mp3`;
				} else if (damageAudioInfo == "default") {
					damageAudioInfo = `effect/damage_${event.nature}${num > 1 ? "2" : ""}.mp3`;
				} else {
					damageAudioInfo = damageAudioInfo[num > 1 ? 2 : 1];
				}
				game.broadcastAll(damageAudioInfo => {
					if (lib.config.background_audio) {
						game.playAudio(damageAudioInfo);
					}
				}, damageAudioInfo);
			}
			let str = event.unreal ? "视为受到了" : "受到了";
			if (source) {
				str += `来自<span class="bluetext">${source == player ? "自己" : get.translation(source)}</span>的`;
			}
			str += `${get.cnNumber(num)}点`;
			if (event.nature) {
				str += `${get.translation(event.nature)}属性`;
			}
			str += "伤害";
			game.log(player, str);
			const playerStat = player.stat[player.stat.length - 1];
			if (playerStat) {
				if (playerStat.damaged == undefined) {
					playerStat.damaged = num;
				} else {
					playerStat.damaged += num;
				}
			}
			if (source) {
				source.getHistory("sourceDamage").push(event);
				const sourceStat = source.stat[source.stat.length - 1];
				if (sourceStat) {
					if (sourceStat.damage == undefined) {
						sourceStat.damage = num;
					} else {
						sourceStat.damage += num;
					}
				}
			}
			player.getHistory("damage").push(event);
			if (!event.unreal) {
				if (event.notrigger) {
					player.changeHp(-num, false)._triggered = null;
				} else {
					player.changeHp(-num, false);
				}
			}
			if (event.animate !== false) {
				player.$damage(source);
				const natures = (event.nature || "").split(lib.natureSeparator);
				game.broadcastAll(
					(natures, player) => {
						if (lib.config.animation && !lib.config.low_performance) {
							if (natures.includes("fire")) {
								player.$fire();
							}
							if (natures.includes("thunder")) {
								player.$thunder();
							}
						}
					},
					natures,
					player
				);
			const numx = player.hasSkillTag("nohujia") ? num : Math.max(0, num - Number(player.hujia));
				player.$damagepop(-numx, natures[0]);
			}
			if (event.unreal) {
				event.goto(6);
			}
			if (!event.notrigger) {
				if (num == 0) {
					await event.trigger("damageZero");
					event._triggered = null;
				} else {
					await event.trigger("damage");
				}
			}
		},
		async (event, trigger, player) => {
			const { source } = event;
			let next;
			if (Number(player.hp) <= 0 && player.isAlive() && !event.nodying) {
				await game.delayx();
				event._dyinged = true;
				next = player.dying(event);
			}
			if (source && lib.config.border_style == "auto") {
				let dnum = 0;
				for (const stat of source.stat) {
					if (stat.damage != undefined) {
						dnum += stat.damage;
					}
				}
				if (dnum >= 2) {
					if (lib.config.autoborder_start == "silver") {
						dnum += 4;
					} else if (lib.config.autoborder_start == "gold") {
						dnum += 8;
					}
				}
				if (lib.config.autoborder_count == "damage") {
					source.node.framebg.dataset.decoration = "";
					if (dnum >= 10) {
						source.node.framebg.dataset.auto = "gold";
						if (dnum >= 12) {
							source.node.framebg.dataset.decoration = "gold";
						}
					} else if (dnum >= 6) {
						source.node.framebg.dataset.auto = "silver";
						if (dnum >= 8) {
							source.node.framebg.dataset.decoration = "silver";
						}
					} else if (dnum >= 2) {
						source.node.framebg.dataset.auto = "bronze";
						if (dnum >= 4) {
							source.node.framebg.dataset.decoration = "bronze";
						}
					}
					if (dnum >= 2) {
						source.classList.add("topcount");
					}
				} else if (lib.config.autoborder_count == "mix") {
					source.node.framebg.dataset.decoration = "";
					switch (source.node.framebg.dataset.auto) {
						case "bronze":
							if (dnum >= 4) {
								source.node.framebg.dataset.decoration = "bronze";
							}
							break;
						case "silver":
							if (dnum >= 8) {
								source.node.framebg.dataset.decoration = "silver";
							}
							break;
						case "gold":
							if (dnum >= 12) {
								source.node.framebg.dataset.decoration = "gold";
							}
							break;
					}
				}
			}
			if (next) {
				return next.forResult();
			}
		},
		async (event, trigger, player) => {
			if (!event.notrigger) {
				await event.trigger("damageSource");
			}
		},
	],
	async recover(event, trigger, player) {
		let num = Number(event.num);
		if (num > Number(player.maxHp) - Number(player.hp)) {
			num = Number(player.maxHp) - Number(player.hp);
			event.num = num;
		}
		if (num > 0) {
			delete event.filterStop;
			if (lib.config.background_audio) {
				game.playAudio("effect", "recover");
			}
			game.broadcast(() => {
				if (lib.config.background_audio) {
					game.playAudio("effect", "recover");
				}
			});
			game.broadcastAll(player => {
				if (lib.config.animation && !lib.config.low_performance) {
					player.$recover();
				}
			}, player);
			player.$damagepop(num, "wood");
			game.log(player, `回复了${get.cnNumber(num)}点体力`);

			await player.changeHp(num, false);
		} else {
			event._triggered = null;
		}
	},
	async loseHp(event, trigger, player) {
		const num = Number(event.num);
		if (num <= 0) {
			event._triggered = null;
			return;
		}

		if (lib.config.background_audio) {
			game.playAudio("effect", "loseHp");
		}
		game.broadcast(() => {
			if (lib.config.background_audio) {
				game.playAudio("effect", "loseHp");
			}
		});
		game.log(player, `失去了${get.cnNumber(num)}点体力`);

		await player.changeHp(-num);

		if (Number(player.hp) <= 0 && !event.nodying) {
			await game.delayx();
			event._dyinged = true;
			await player.dying(event);
		}
	},
	async doubleDraw(event, trigger, player) {
		const result = await player.chooseBool({ prompt: "你的主副将体力上限之和是奇数，是否摸一张牌？" }).forResult();
		if (isRecord(result) && result.bool === true) {
			await player.draw();
		}
	},
	async loseMaxHp(event, trigger, player) {
		const num = Number(event.num);
		game.broadcastAll(() => {
			if (lib.config.background_audio) {
				game.playAudio("effect", "loseMaxHp");
			}
		});
		game.log(player, `减少了${get.cnNumber(num)}点体力上限`);
		event.originalHp = player.getHp();
		event.originalMaxHp = player.maxHp;
		player.maxHp = Number(player.maxHp) - num;
		if (isNaN(Number(player.maxHp))) {
			player.maxHp = 0;
		}
		event.changedMaxHp = Number(player.maxHp) - event.originalMaxHp;
		event.loseHp = Math.max(0, Number(player.hp) - Number(player.maxHp));
		player.update();
		event.changedHp = player.getHp() - Math.max(0, event.originalHp);

		if (Number(player.maxHp) <= 0) {
			await player.die(event);
		}
	},
	async gainMaxHp(event, trigger, player) {
		const num = Number(event.num);
		game.log(player, `增加了${get.cnNumber(num)}点体力上限`);
		event.originalHp = player.getHp();
		event.originalMaxHp = player.maxHp;
		player.maxHp = Number(player.maxHp) + num;
		event.changedMaxHp = Number(player.maxHp) - event.originalMaxHp;
		event.changedHp = 0;
		player.update();
	},
	async changeHp(event, trigger, player) {
		let num = Number(event.num);
		const { originalHp } = event;
		event.originalMaxHp = player.maxHp;
		event.changedMaxHp = 0;
		//add to GlobalHistory
		game.getGlobalHistory().changeHp.push(event);
		//changeHujia moved here
		if (num < 0 && Number(player.hujia) > 0 && event.getParent().name == "damage" && !player.hasSkillTag("nohujia") && !event.getParent().nohujia) {
			event.hujia = Math.min(-num, Number(player.hujia));
			const parent = event.getParent(undefined, true);
			if (!parent) {
				throw new Error("damage event parent disappeared before armor absorption was recorded.");
			}
			parent.hujia = event.hujia;
			event.num = Number(event.num) + event.hujia;
			//log moved to changeHujia
			//game.log(player, `的护甲抵挡了${get.cnNumber(event.hujia)}点伤害`);
			player.changeHujia(-event.hujia).type = "damage";
		}
		//old part
		// 体力的变化值
		num = Number(event.num);
		player.hp = Number(player.hp) + num;
		if (isNaN(Number(player.hp))) {
			player.hp = 0;
		}
		if (Number(player.hp) > Number(player.maxHp)) {
			player.hp = player.maxHp;
		}
		player.update();

		// 体力值的变化值
		event.changedHp = player.getHp() - Math.max(0, originalHp);

		if (event.popup !== false) {
			player.$damagepop(num, "water");
		}
		if (_status.dying.includes(player) && Number(player.hp) > 0) {
			_status.dying.remove(player);
			game.broadcast(list => {
				_status.dying = list;
			}, _status.dying);
			let evt = event.getParent("_save");
			if (evt && evt.finish) {
				evt.finish();
			}
			evt = event.getParent("dying");
			if (evt && evt.finish) {
				evt.finish();
			}
		}
		await event.trigger("changeHp");
	},
	async changeHujia(event, trigger, player) {
		let num = Number(event.num);
		if (num > 0) {
			game.log(player, `获得了${get.cnNumber(num)}点护甲`);
		} else if (num < 0) {
			if (-num > Number(player.hujia)) {
				num = -Number(player.hujia);
				event.num = num;
			}
			switch (
				event.type //log moved here
			) {
				case "damage":
					game.log(player, `的护甲抵挡了${get.cnNumber(-num)}点伤害`);
					break;
				case "lose":
					game.log(player, `失去了${get.cnNumber(-num)}点护甲`);
					break;
			}
		}
		player.hujia = Number(player.hujia) + num;
		//if(player.hujia<0){
		//	player.hujia=0;
		//}
		player.update();
	},
	dying: [
		async (event, trigger, player) => {
			event.forceDie = true;
			if (player.isDying() || Number(player.hp) > 0) {
				event.finish();
				return;
			}
			_status.dying.unshift(player);
			game.broadcast(list => {
				_status.dying = list;
			}, _status.dying);
			await event.trigger("dying");
			game.log(player, "濒死");
		},
		async (event, trigger, player) => {
			delete event.filterStop;
			if (Number(player.hp) > 0 || event.nodying) {
				_status.dying.remove(player);
				game.broadcast(list => {
					_status.dying = list;
				}, _status.dying);
				event.finish();
			} else if (!event.skipTao) {
				let start: Player | false | undefined = false;
				const starts = [_status.currentPhase, event.source, event.player, game.me ?? undefined, game.players[0]];
				for (const current of starts) {
					if (current != null && get.itemtype(current) == "player" && game.players.concat(game.dead).includes(current)) {
						start = game.players
							.slice()
							.sortBySeat(current)
							.find(i => !i.isOut());
						if (start) {
							break;
						}
					}
				}
				if (start) {
					const next = game.createEvent("_save");
					next.player = start;
					next._trigger = event;
					next.triggername = "_save";
					next.forceDie = true;
					next.setContent("_save");
					await next;
				}
			}
		},
		async (event, trigger, player) => {
			_status.dying.remove(player);
			game.broadcast(list => {
				_status.dying = list;
			}, _status.dying);
			if (Number(player.hp) <= 0 && !event.nodying && !player.nodying) {
				await player.die(event.reason);
			}
		},
	],
	die: [
		async (event, trigger, player) => {
			const { reason, source } = event;
			event.forceDie = true;
			//只有真正死亡才会影响每轮起始的角色（注意：不是每个模式都有这个属性，只有个别几个模式有，身份22斗地主都是判断的onround来决定是否进入下一轮）
			if (_status.roundStart == player && !event.reserveOut) {
				_status.roundStart = player.next || player.getNext() || game.players[0];
			}
			if (ui.land && ui.land.player == player) {
				game.addVideo("destroyLand");
				ui.land.destroy();
			}
			//因为隐匿等原因看不到武将牌的需要展示出来
			let unseen = false;
			if (player.classList.contains("unseen")) {
				player.classList.remove("unseen");
				unseen = true;
			}
			//加载侧边的历史记录栏关于这次死亡事件的信息
			const logvid = game.logv(player, "die", source || undefined);
			event.logvid = logvid?.logvid;
			if (unseen) {
				player.classList.add("unseen");
			}
			if (source) {
				game.log(player, "被", source, "杀害");
				const stat = source.stat[source.stat.length - 1];
				if (stat) {
					if (stat.kill == undefined) {
						stat.kill = 1;
					} else {
						stat.kill++;
					}
				}
			} else {
				game.log(player, "阵亡");
			}

			/*player.removeEquipTrigger();
			for (const i in lib.skill.globalmap) {
				if (lib.skill.globalmap[i].includes(player)) {
					lib.skill.globalmap[i].remove(player);
					if (lib.skill.globalmap[i].length == 0 && !lib.skill[i].globalFixed) {
						game.removeGlobalSkill(i);
					}
				}
			}*/
			game.broadcastAll(player => {
				player.classList.add("dead");
				player.removeLink();
				player.classList.remove("turnedover");
				player.classList.remove("out");
				player.node.count.innerHTML = "0";
				player.node.hp.hide();
				player.node.equips.hide();
				player.node.count.hide();
				player.previous.next = player.next;
				player.next.previous = player.previous;
				game.players.remove(player);
				game.dead.push(player);
				_status.dying.remove(player);
			}, player);

			//是否播放阵亡语音
			if (!event.noDieAudio) {
				game.tryDieAudio(player);
			}
			//添加死亡动画（包括录像的）
			if (!event.reserveOut) {
				game.addVideo("diex", player);
				if (event.animate !== false) {
					player.$die();
				}
			}
			//将体力值修改为0
			/*if (event.reserveOut && !game.countPlayer()) {
				game.over();
			} else */
			if (player.hp != 0) {
				await player.changeHp(0 - Number(player.hp), false).set("forceDie", true);
			}
		},
		async (event, trigger, player) => {
			const { source } = event;
			//是否执行展示身份牌和胜负判断的操作
			if (player.dieAfter && !event.reserveOut && !event.noDieAfter) {
				await player.dieAfter(source);
			}
		},
		async (event, trigger, player) => {
			game.callHook("checkDie", [event, player]);
			await event.trigger("die");
		},
		async (event, trigger, player) => {
			const { reason, source } = event;
			if (player.isDead()) {
				// || event.reserveOut
				//死亡移除武将牌的标记显示，有些不想移除的可以放进excludeMark排除（比如十常侍的常侍标记）
				if (!game.reserveDead) {
					const exclude = event.excludeMark;
					for (const mark in player.marks) {
						if (exclude.includes(mark)) {
							continue;
						}
						player.unmarkSkill(mark);
					}
					let count = 1;
					const list = Array.from(player.node.marks.childNodes);
					count += exclude.filter(name => list.some(i => "name" in i && i.name == name)).length;
					const func = (player, count, exclude) => {
						while (player.node.marks.childNodes.length > count) {
							let node = player.node.marks.lastChild;
							if (exclude.includes(node.name)) {
								node = node.previousSibling;
							}
							node.remove();
						}
					};
					func(player, count, exclude);
					game.broadcast(
						(func, player, count, exclude) => {
							func(player, count, exclude);
						},
						func,
						player,
						count,
						exclude
					);
					player.removeTip();
				}
				//移除临时技能
				for (const i in player.tempSkills) {
					player.removeSkill(i);
				}
				const skills = player.getSkills();
				for (const skill of skills) {
					if (requireRegisteredSkill(lib.skill, skill).temp) {
						player.removeSkill(skill);
					}
				}
				//武将牌返回武将牌堆
				if (_status.characterlist && !event.reserveOut) {
					if (lib.character[String(player.name)]) {
						const name = player.name;
						if (name === undefined) throw new TypeError("Returning a character requires an initialized name");
						if (!name.startsWith("gz_shibing") && !name.startsWith("gz_jun_")) _status.characterlist.add(player.name);
					}
					if (lib.character[String(player.name1)]) {
						const name1 = player.name1;
						if (name1 === undefined) throw new TypeError("Returning a character requires an initialized primary name");
						if (!name1.startsWith("gz_shibing") && !name1.startsWith("gz_jun_")) _status.characterlist.add(player.name1);
					}
					const name2 = player.name2;
					if (name2 && lib.character[name2] && !name2.startsWith("gz_shibing") && !name2.startsWith("gz_jun_")) {
						_status.characterlist.add(name2);
					}
				}
				//死亡弃置所有牌包括s和x区域的
				event.cards = player.getCards("hejsx");
				if (event.cards.length) {
					await player.discard(event.cards).set("forceDie", true);
					//player.$throw(event.cards,1000);
				}
			}
		},
		async (event, trigger, player) => {
			const { source } = event;
			//是否执行击杀奖惩的操作
			if (player.dieAfter2 && !event.reserveOut && !event.noDieAfter2) {
				await player.dieAfter2(source);
			}
		},
		async (event, trigger, player) => {
			const { reason, source } = event;
			if (!event.reserveOut) {
				//真正的死亡才会显示再战那些按钮，以及隐藏一些按钮什么的
				game.broadcastAll(player => {
					if (game.online && player == game.me && !_status.over && !game.controlOver && !ui.exit) {
						if (lib.mode[lib.configOL.mode].config.dierestart) {
							ui.create.exit();
						}
					}
				}, player);
				if (!_status.connectMode && player == game.me && !_status.over && !game.controlOver) {
					ui.control.show();
					if (get.config("revive") && lib.mode[lib.config.mode].config.revive && !ui.revive) {
						ui.revive = ui.create.control("revive", ui.click.dierevive);
					}
					if (get.config("continue_game") && !ui.continue_game && lib.mode[lib.config.mode].config.continue_game && !_status.brawl && !game.no_continue_game) {
						ui.continue_game = ui.create.control("再战", game.reloadCurrent);
					}
					if (get.config("dierestart") && lib.mode[lib.config.mode].config.dierestart && !ui.restart) {
						ui.restart = ui.create.control("restart", game.reload);
					}
				}

				if (!_status.connectMode && player == game.me && !game.modeSwapPlayer) {
					// _status.auto=false;
					if (ui.auto) {
						// ui.auto.classList.remove('glow');
						ui.auto.hide();
					}
					if (ui.wuxie) {
						ui.wuxie.hide();
					}
				}

				if (typeof _status.coin == "number" && source && !_status.auto) {
					if (source == game.me || source.isUnderControl()) {
						_status.coin += 10;
					}
				}
			}
			if (source && lib.config.border_style == "auto" && (lib.config.autoborder_count == "kill" || lib.config.autoborder_count == "mix")) {
				switch (source.node.framebg.dataset.auto) {
					case "gold":
					case "silver":
						source.node.framebg.dataset.auto = "gold";
						break;
					case "bronze":
						source.node.framebg.dataset.auto = "silver";
						break;
					default:
						source.node.framebg.dataset.auto = lib.config.autoborder_start || "bronze";
				}
				if (lib.config.autoborder_count == "kill") {
					source.node.framebg.dataset.decoration = source.node.framebg.dataset.auto;
				} else {
					let dnum = 0;
					for (const stat of source.stat) {
						if (stat.damage != undefined) {
							dnum += stat.damage;
						}
					}
					source.node.framebg.dataset.decoration = "";
					switch (source.node.framebg.dataset.auto) {
						case "bronze":
							if (dnum >= 4) {
								source.node.framebg.dataset.decoration = "bronze";
							}
							break;
						case "silver":
							if (dnum >= 8) {
								source.node.framebg.dataset.decoration = "silver";
							}
							break;
						case "gold":
							if (dnum >= 12) {
								source.node.framebg.dataset.decoration = "gold";
							}
							break;
					}
				}
				source.classList.add("topcount");
			}
		},
	],
	//进入休整状态
	async rest(event, trigger, player) {
		const { type = "phase", count = -1 } = event.restMap; //, audio
		const playerid = player.playerid;
		if (typeof playerid !== "string" || _status._rest_return?.[playerid]) {
			return;
		}
		/*if (audio) {
			game.broadcastAll(audio => {
				if (lib.config.background_speak) {
					game.playAudio("die", audio);
				}
			}, audio);
		}*/

		game.log(player, "进入了修整状态");
		player.classList.remove("dead");
		game.dead.remove(player);
		game.players.add(player);
		game.arrangePlayers();
		game.broadcastAll(
			(id, type, count) => {
				if (typeof id !== "string") {
					return;
				}
				_status._rest_return ??= {};
				_status._rest_return[id] = {
					type: type,
					count: count,
				};
			},
			playerid,
			type,
			count
		);
		player.markSkill("_rest_return");

		game.log(player, "移出了游戏");
		game.broadcastAll(player => {
			player.classList.add("out");
		}, player);
		player.addSkill("undist");

		await event.trigger("rest");
	},
	//结束休整状态
	async restEnd(event, trigger, player) {
		const { hp = player.maxHp } = event.restEndMap; //, audio
		const playerid = player.playerid;
		if (typeof playerid !== "string" || !_status._rest_return?.[playerid]) {
			return;
		}
		/*if (typeof audio == "string") {
			game.broadcastAll(audio => {
				if (lib.config.background_speak) {
					game.playAudio("die", audio);
				}
			}, audio);
		}*/

		game.log(player, "结束了休整");
		game.broadcastAll(id => {
			if (typeof id === "string" && _status._rest_return) {
				delete _status._rest_return[id];
			}
		}, playerid);
		player.unmarkSkill("_rest_return");

		game.log(player, "移回了游戏");
		game.broadcastAll(player => {
			player.classList.remove("out");
		}, player);
		player.removeSkill("undist");

		await player.reviveEvent(hp, false);
		await event.trigger("restEnd");
	},
	//复活事件
	async revive(event, trigger, player) {
		const { hp, log } = event;
		if (log !== false) {
			game.log(player, "复活");
		}
		game.broadcastAll(
			(player, hp) => {
				if (Number(player.maxHp) < 1) {
					player.maxHp = 1;
				}
				player.hp = hp;
				game.addVideo("revive", player);
				player.classList.remove("dead");
				player.removeAttribute("style");
				player.node.avatar.style.transform = "";
				player.node.avatar2.style.transform = "";
				player.node.hp.show();
				player.node.equips.show();
				player.node.count.show();
				player.update();
				let playerx;
				playerx = player.previousSeat;
				while (playerx.isDead()) {
					playerx = playerx.previousSeat;
				}
				playerx.next = player;
				player.previous = playerx;
				playerx = player.nextSeat;
				while (playerx.isDead()) {
					playerx = playerx.nextSeat;
				}
				playerx.previous = player;
				player.next = playerx;
				game.players.add(player);
				game.dead.remove(player);
				if (player == game.me) {
					if (ui.auto) {
						ui.auto.show();
					}
					if (ui.wuxie) {
						ui.wuxie.show();
					}
					if (ui.revive) {
						ui.revive.close();
						delete ui.revive;
					}
					if (ui.exit) {
						ui.exit.close();
						delete ui.exit;
					}
					if (ui.swap) {
						ui.swap.close();
						delete ui.swap;
					}
					if (ui.restart) {
						ui.restart.close();
						delete ui.restart;
					}
					if (ui.continue_game) {
						ui.continue_game.close();
						delete ui.continue_game;
					}
					if (player.node.dieidentity) {
						player.node.dieidentity.delete();
						delete player.node.dieidentity;
					}
				}
			},
			player,
			hp
		);
	},
	//暂时还是只能一次加一张牌，需要后续跟进处理
	//一次加一张够用了
	async addJudge(event, trigger, player) {
		let card;
		let cardName;
		if (typeof event.card == "string") {
			cardName = event.card;
			card = get.autoViewAs({ name: cardName }, event.cards);
			event.card = card;
		} else {
			cardName = event.card.name;
			if (get.itemtype(event.card) === "card") {
				if (event.card.cardSymbol !== undefined) {
					const cardSymbol = event.card.cardSymbol;
					const symbolCard = event.card[cardSymbol];
					if (symbolCard) {
						event.cards = symbolCard.cards;
						if (!event.card.isViewAsCard) {
							event.card = symbolCard;
						}
					}
				} else {
					card = get.autoViewAs(event.card, void 0, false);
					event.card = card;
					event.cards = event.card.cards ?? [];
				}
			} else if (!event.card.cards?.length && event.cards?.length) {
				card = get.autoViewAs({ name: cardName, isCard: true }, event.cards);
				event.card = card;
			} else if (!event.cards) {
				event.cards = [];
			}
		}
		card = event.card;
		const cards = event.cards;
		const cardInfo = lib.card[cardName];
		const visible = cardInfo && !cardInfo.blankCard;
		event.visible = visible;
		//失去牌的一长串
		const loseCards: Card[] = [];
		if (event.card instanceof lib.element.Card && event.card.isViewAsCard) {
			loseCards.add(event.card);
		} else {
			loseCards.addArray(event.cards);
		}
		if (loseCards.length) {
			const map: Record<string, [Card[], Card[], Card[]]> = {};
			for (const i of loseCards) {
				const owner = get.owner(i, "judge");
				if (owner /* && (owner != player || get.position(i) != "e")*/) {
					const id = owner.playerid;
					if (typeof id !== "string") {
						continue;
					}
					if (!map[id]) {
						map[id] = [[], [], []];
					}
					map[id][0].push(i);
					const position = get.position(i);
					if (position == "h") {
						map[id][1].push(i);
					} else {
						map[id][2].push(i);
					}
				} else if (!event.updatePile && get.position(i) == "c") {
					event.updatePile = true;
				}
				if (event.visible) {
					i.addKnower("everyone");
				}
			}
			event.losing_map = map;
			for (const i in map) {
				const owner = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				const next = owner.lose(map[i][0], ui.special).set("type", "addJudge").set("forceDie", true).set("getlx", false);
				if (event.visible == true) {
					next.visible = true;
				}
				await next;
				event.relatedLose = next;
			}
			let stop = false;
			const list: Card[] = [];
			for (const cardx of event.cards) {
				if (cardx.willBeDestroyed("judge", player, event)) {
					cardx.selfDestroy(event);
					stop = true;
				} else if ("hejx".includes(get.position(cardx, true))) {
					stop = true;
				} else {
					list.add(cardx);
				}
			}
			if (stop) {
				if (list.length) {
					await game.cardsDiscard(list);
				}
				return;
			}
		}
		if (!cardInfo.effect && !cardInfo.noEffect) {
			if (event.cards.length) {
				await game.cardsDiscard(event.cards);
			}
			return;
		}
		game.broadcastAll(
			/**
			 * @param {Player} player
			 * @param {Card | VCard} card
			 * @param {Card[]} cards
			 */
			(player, card, cards) => {
				const cardsCloned = cards.filter(card => card instanceof lib.element.Card && card.clone && (card.clone.parentNode == player.parentNode || card.clone.parentNode == ui.arena));
				if (cardsCloned.length) {
					cardsCloned.forEach(card => {
						if (card instanceof lib.element.Card && card.clone) {
							card.clone.moveDelete(player);
						}
					});
					game.addVideo("gain2", player, get.cardsInfo(cardsCloned));
				}
			},
			player,
			event.card,
			loseCards
		);
		player.addVirtualJudge(event.card, event.cards);
		const isViewAsCard = cards?.length !== 1 || cards[0].name !== card.name || !card.isCard;
		if (isViewAsCard && cards?.length) {
			if (cardInfo.blankCard) {
				game.log(player, `被扣置了<span class="yellowtext">${get.translation(cardName)}</span>`);
			} else {
				game.log(player, `被贴上了<span class="yellowtext">${get.translation(cardName)}</span>（`, cards, "）");
			}
		} else {
			game.log(player, "被贴上了", card);
		}
		if (get.itemtype(event.card) == "card") {
			const cardSymbol = event.card.cardSymbol;
			if (cardSymbol !== undefined) {
				const symbolCard = event.card[cardSymbol];
				if (symbolCard) {
					event.card = symbolCard;
				}
			}
		}
	},
	judge: [
		async (event, trigger, player) => {
			const judgestr = `${get.translation(player)}的${event.judgestr}判定`;
			event.videoId = lib.status.videoId++;
			let rawCard = event.directresult;
			if (!rawCard) {
				if (player.getTopCards) {
					rawCard = player.getTopCards()[0];
				} else {
					rawCard = get.cards()[0];
				}
			}
			if (!rawCard) {
				event.finish();
				return;
			}
			const normalizedCard = rawCard instanceof lib.element.Card || rawCard instanceof lib.element.VCard ? rawCard : get.autoViewAs(rawCard, void 0, false);
			const cardj = normalizedCard instanceof lib.element.Card ? normalizedCard : normalizedCard?.cards?.[0];
			if (!cardj) {
				event.finish();
				return;
			}
			let waiting;
			const owner = cardj instanceof lib.element.Card ? get.owner(cardj) : undefined;
			if (owner) {
				waiting = owner.lose(cardj, "visible", ui.ordering);
			} else {
				const nextj = game.cardsGotoOrdering(cardj);
				if (event.position != ui.discardPile) {
					nextj.noOrdering = true;
				}
				waiting = nextj;
			}
			player.judging.unshift(cardj);
			game.addVideo("judge1", player, [get.cardInfo(player.judging[0]), judgestr, event.videoId]);
			game.broadcastAll(
				(player, card, str, id, cardid) => {
					let event;
					if (game.online) {
						event = {};
					} else {
						event = _status.event;
					}
					if (game.chess) {
						event.node = card.copy("thrown", "center", ui.arena).addTempClass("start");
					} else {
						event.node = player.$throwordered(card.copy(), true);
					}
					if (lib.cardOL) {
						lib.cardOL[cardid] = event.node;
					}
					event.node.cardid = cardid;
					event.node.classList.add("thrownhighlight");
					ui.arena.classList.add("thrownhighlight");
					event.dialog = ui.create.dialog(str);
					event.dialog.classList.add("center");
					event.dialog.videoId = id;
				},
				player,
				player.judging[0],
				judgestr,
				event.videoId,
				get.id()
			);

			game.log(player, `进行${event.judgestr}判定，亮出的判定牌为`, player.judging[0]);
			await game.delay(2);
			if (!event.noJudgeTrigger) {
				await event.trigger("judge");
			}
			return waiting.forResult();
		},
		async (event, trigger, player) => {
			const rawJudgedCard = player.judging[0];
			const judgedCard = rawJudgedCard instanceof lib.element.Card ? rawJudgedCard : rawJudgedCard ? get.autoViewAs(rawJudgedCard, void 0, false) : undefined;
			if (!judgedCard) {
				event.finish();
				return;
			}
			event.result = {
				card: judgedCard,
				name: judgedCard.name,
				number: get.number(judgedCard),
				suit: get.suit(judgedCard),
				color: get.color(judgedCard),
				node: event.node,
			};
			if (event.fixedResult) {
				for (const i in event.fixedResult) {
					event.result[i] = event.fixedResult[i];
				}
			}
			event.result.judge = event.judge(event.result);
			if (event.result.judge > 0) {
				event.result.bool = true;
			} else if (event.result.judge < 0) {
				event.result.bool = false;
			} else {
				event.result.bool = null;
			}
			player.judging.shift();
			game.checkMod(player, event.result, "judge", player);
			if (event.judge2) {
				const judge2 = event.judge2(event.result);
				if (typeof judge2 == "boolean") {
					player.tryJudgeAnimate(judge2);
				}
			}
			if (event.clearArena != false) {
				game.broadcastAll(ui.clear);
			}
			game.broadcast(id => {
				const dialog = get.idDialog(id);
				if (dialog) {
					dialog.close();
				}
				ui.arena.classList.remove("thrownhighlight");
			}, event.videoId);
			event.dialog.close();
			game.addVideo("judge2", null, event.videoId);
			ui.arena.classList.remove("thrownhighlight");
			game.log(player, "的判定结果为", event.result.card);
			const triggerFixing = event.trigger("judgeFixing");
			let callback: GameEvent | null = null;
			if (event.callback) {
				const next = game.createEvent("judgeCallback", false);
				next.player = player;
				next.card = judgedCard;
				next.judgeResult = get.copy(event.result);
				next.setContent(event.callback);
				callback = next;
			} else {
				if (judgedCard instanceof lib.element.Card && !get.owner(judgedCard)) {
					if (event.position != ui.discardPile) {
						event.position.appendChild(judgedCard);
					}
				}
			}
			await triggerFixing;
			if (callback && event.next.includes(callback)) {
				await callback;
			}
		},
	],
	async turnOver(event, trigger, player) {
		game.log(player, "翻面");
		game.broadcastAll(player => player.classList.toggle("turnedover"), player);
		game.addVideo("turnOver", player, player.classList.contains("turnedover"));
	},
	async link(event, trigger, player) {
		const isLinked = player.isLinked();
		game.log(player, `${isLinked ? "解除" : "被"}连环`);
		game.broadcastAll(
			(player, isLinked) => {
				if (lib.config.background_audio) {
					game.playAudio("effect", `link${isLinked ? "_clear" : ""}`);
				}
				player.classList.remove("target");
				player.classList.toggle(get.is.linked2(player) ? "linked2" : "linked");
				ui.updatej(player);
				ui.updatem(player);
			},
			player,
			isLinked
		);
		game.addVideo("link", player, player.isLinked());
	},
	async chooseToGuanxing(event, trigger, player) {
		const cards = get.cards(event.num);
		await game.cardsGotoOrdering(cards);
		const next = player.chooseToMove({ allowChooseAll: true, list: [] });
		next.set("forceDie", event.forceDie);
		next.set("includeOut", event.includeOut);
		next.set("list", [["牌堆顶", cards], ["牌堆底"]]);
		next.set("prompt", event.prompt || "点击或拖动将牌移动到牌堆顶或牌堆底");
		next.processAI =
			event.processAI ||
			(list => {
				const cards = list[0][1];
				const player = _status.event.player;
				let target = _status.currentPhase || player;
				const name = _status.event.getTrigger()?.name;
				const countWuxie = current => {
					let num = current.getKnownCards(player, card => get.name(card, current) === "wuxie");
					if (num && current !== player) {
						return num;
					}
					const skills = current.getSkills("invisible").concat(lib.skill.global);
					game.expandSkills(skills);
					for (const skill of skills) {
						const ifo = get.info(skill);
						if (!ifo) {
							continue;
						}
						if (ifo.viewAs && typeof ifo.viewAs == "object" && ifo.viewAs.name == "wuxie") {
							if (!ifo.viewAsFilter || ifo.viewAsFilter(current)) {
								num++;
								break;
							}
						} else {
							const hiddenCard = ifo.hiddenCard;
							if (typeof hiddenCard == "function" && hiddenCard(current, "wuxie")) {
								num++;
								break;
							}
						}
					}
					return num;
				};
				const top: Card[] = [];
				switch (name) {
					case "phaseJieshu":
						if (!target) {
							throw new Error("chooseToGuanxing requires a phase player.");
						}
						target = target.next;
					// [falls through]
					case "phaseZhunbei": {
						if (!target) {
							throw new Error("chooseToGuanxing requires a phase player.");
						}
						const att = get.sgn(get.attitude(player, target));
						const judges = target.getCards("j");
						let needs = 0;
						let wuxie = countWuxie(target);
						for (let i = Math.min(cards.length, judges.length) - 1; i >= 0; i--) {
							const j = judges[i];
							const cardj = j.viewAs ? { name: j.viewAs, cards: j.cards || [j] } : j;
							if (wuxie > 0 && get.effect(target, j, target, target) < 0) {
								wuxie--;
								continue;
							}
							const judge = get.judge(j);
							cards.sort((a, b) => (judge(b) - judge(a)) * att);
							if (judge(cards[0]) * att < 0) {
								needs++;
								continue;
							} else {
								top.unshift(cards.shift());
							}
						}
						if (needs > 0 && needs >= judges.length) {
							return [top, cards];
						}
						cards.sort((a, b) => (get.value(b, target) - get.value(a, target)) * att);
						while (needs--) {
							top.unshift(cards.shift());
						}
						while (cards.length) {
							if (get.value(cards[0], target) > 6 == att > 0) {
								top.push(cards.shift());
							} else {
								break;
							}
						}
						return [top, cards];
					}
					default:
						cards.sort((a, b) => get.value(b, target) - get.value(a, target));
						while (cards.length) {
							if (get.value(cards[0], target) > 6) {
								top.push(cards.shift());
							} else {
								break;
							}
						}
						return [top, cards];
				}
			});
		const result = await next.forResult();
		if (typeof result == "string" || !("moved" in result) || !isCardMatrix(result.moved)) {
			return;
		}
		const moved = result.moved;
		const top: Card[] = moved[0] ?? [];
		const bottom: Card[] = moved[1] ?? [];
		top.reverse();
		await game.cardsGotoPile(top.concat(bottom), ["top_cards", top], (event, card) => {
			if (event && Array.isArray(event.top_cards) && event.top_cards.includes(card)) {
				return ui.cardPile.firstChild;
			}
			return null;
		});
		game.addCardKnower(top, [player]);
		game.addCardKnower(bottom, [player]);
		event.result = {
			bool: true,
			moved: [top, bottom],
		};
		player.popup(`${get.cnNumber(top.length)}上${get.cnNumber(bottom.length)}下`);
		game.log(player, `将${get.cnNumber(top.length)}张牌置于牌堆顶`);
		await game.delayx();
	},
	async chooseToMove_new(event, trigger, player) {
		//联机时间
		if (player.isUnderControl()) {
			game.swapPlayerAuto(player);
		}
		if (event.chooseTime && _status.connectMode && !game.online) {
			event.time = lib.configOL.choose_timeout;
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.chooseTime);
		}

		let result: EventResult | null;
		if (event.isMine()) {
			const { promise, resolve } = Promise.withResolvers<EventResult>();
			const animationDuration = lib.config.animation_choose_to_move ? 300 : 0;
			//自动选择
			event.switchToAuto = () => {
				if (!event.filterOk(event.moved)) {
					if (!event.forced) {
						event._result = { bool: false };
					} else {
						event._result = "ai";
					}
				} else {
					event._result = {
						bool: true,
						moved: event.moved,
					};
				}
				event.dialog.close();
				if (ui.confirm) {
					ui.confirm.close();
				}
				game.resume();
				_status.imchoosing = false;
				setTimeout(() => {
					ui.arena.classList.remove("choose-to-move");
				}, 500);
				resolve(normalizeSelectionResult(event._result));
			};
			//创造dialog
			event.dialog = ui.create.dialog();
			event.dialog.addNewRow(event.prompt || "请选择要操作的牌");
			event.dialog.selectedCard = null;
			event.dialog.isBusy = false;
			event.dialog.classList.add("scroll1");
			event.dialog.classList.add("scroll2");
			event.dialog.classList.add("fullwidth");
			if (get.is.phoneLayout() || event.list.length > 2) {
				ui.arena.classList.add("choose-to-move");
				event.dialog.classList.add("fullheight");
			}
			//刷新，确认是否返回结果
			function updateButtons() {
				event.moved = Array.from({
					length: event.list.slice().reduce((sum, currentList) => {
						if (!Array.isArray(currentList[0])) {
							currentList = [currentList];
						}
						return (sum += currentList.length);
					}, 0),
				}).map((_, i) => {
					const num = 2 * (i + 1);
					const container = event.dialog.itemContainers[num];
					if (!(container instanceof HTMLDivElement)) {
						throw new TypeError("Move dialog item container is not initialized");
					}
					return Array.from(container.children).map(child => ("link" in child ? child.link : undefined));
				});
				if (event.filterOk(event.moved)) {
					ui.create.confirm("o");
				} else {
					if (!event.forced) {
						ui.create.confirm("c");
					} else if (ui.confirm) {
						ui.confirm.close();
					}
				}
			}
			//点击每个卡的事件
			function clickItem(card, container, allContainers) {
				if (event.dialog.isBusy) {
					return;
				}
				if (event.dialog.selectedCard) {
					if (card !== event.dialog.selectedCard && event.filterMove(event.dialog.selectedCard, card, event.moved)) {
						event.dialog.isBusy = true;
						game.$swapElement(card, event.dialog.selectedCard, animationDuration).then(() => {
							event.dialog.isBusy = false;
							updateButtons();
						});
					}
					event.dialog.selectedCard.classList.remove("selected");
					event.dialog.selectedCard = null;
				} else {
					event.dialog.selectedCard = card;
					card.classList.add("selected");
				}
			}
			//点击容器的事件回调
			function clickItemContainer(itemContainer, i, allContainers) {
				if (event.dialog.isBusy || !event.dialog.selectedCard) {
					return;
				}
				if (itemContainer.contains(event.dialog.selectedCard)) {
					return;
				}
				const index = Array.from(event.dialog.itemContainers).indexOf(itemContainer) / 2 - 1;
				if (event.filterMove(event.dialog.selectedCard, index, event.moved)) {
					event.dialog.isBusy = true;
					game.$elementGoto(event.dialog.selectedCard, itemContainer, undefined, animationDuration).then(() => {
						event.dialog.isBusy = false;
						updateButtons();
					});
				}
				event.dialog.selectedCard.classList.remove("selected");
				event.dialog.selectedCard = null;
			}
			//框的部分属性
			const itemContainerCss = event.itemContainerCss || {
				justifyContent: "center",
				minHeight: "100px",
			};
			for (const item of event.list) {
				let currentList = item.slice();
				if (!Array.isArray(currentList[0])) {
					currentList = [currentList];
				}
				event.dialog.addNewRow(
					...currentList
						.slice()
						.map(listx => [{ item: listx[0], ratio: 1 }, listx[1]?.length ? { item: listx[1], ratio: 6 / currentList.length, itemContainerCss, clickItem, clickItemContainer } : { item: listx[1], ratio: 6 / currentList.length, itemContainerCss, clickItemContainer }])
						.flat()
				);
			}
			event.dialog.open();
			updateButtons();
			//获取结果
			event.custom.replace.confirm = bool => {
				let result;
				if (bool) {
					result = {
						bool: true,
						moved: event.moved,
					};
				} else {
					result = { bool: false };
				}
				event.dialog.close();
				if (ui.confirm) {
					ui.confirm.close();
				}
				_status.imchoosing = false;
				setTimeout(() => {
					ui.arena.classList.remove("choose-to-move");
				}, 500);
				resolve(result);
			};
			//开搞
			game.countChoose();
			event.choosing = true;
			result = await promise;
		} else if (event.isOnline()) {
			const remoteResult = await event.sendAsync();
			result = normalizeSelectionResult(remoteResult);
		} else {
			result = "ai";
		}
		//时间限制
		if (event.time) {
			game.broadcastAll(time => {
				lib.configOL.choose_timeout = time;
			}, event.time);
		}
		//结果获取
		const resultBool = typeof result == "string" ? undefined : result?.bool;
		if ((!result || result == "ai" || (event.forced && !resultBool)) && event.processAI) {
			const moved = event.processAI(event.list);
			if (moved) {
				result = {
					bool: true,
					moved: moved,
				};
			} else {
				result = { bool: false };
			}
		}
		event.result = result ?? "cancelled";
	},
};
