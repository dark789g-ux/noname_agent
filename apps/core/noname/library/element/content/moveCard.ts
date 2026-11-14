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

export const moveCardContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
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
};
