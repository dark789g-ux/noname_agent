import { _status, game, get, lib, ui, ai } from "noname";
import { GameEvent, initializeEvent, type RawGameDrawEvent } from "../gameEvent.js";
import { Player } from "../player.js";
import type { LegacyChooseButtonCreateDialog } from "../Player/legacyParams";
import { delay } from "@/util/index.js";
import { tryLLMDecide } from "@/llm/index.js";
import { forwardEventLogSkill, getLogSkillName } from "../GameEvent/logSkill.js";
import { getButtonSubtypes } from "../GameEvent/buttonSubtypes.js";
import { isImportModePayload, isSelectionResultObject as isBoundarySelectionResultObject, normalizeSelectionResult as normalizeBoundarySelectionResult, type SelectionResultRuntime } from "../GameEvent/resultBoundary.js";
import { getRegisteredSkill, requireRegisteredSkill } from "../../skillRegistry.js";
import { isRecord, isAIResult, isSelectionResultObject, normalizeSelectionResult, isCardLinks, isVCardLinks, isCardMatrix, normalizeChooseButtonTargetResult, applyLLMDecision, attachChooseButtonSelectionSpec } from "./selectionResults.js";

export const emptyEventContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
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
};
