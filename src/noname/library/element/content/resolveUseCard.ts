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

export const resolveUseCard: ContentFuncsByAll = [
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
];
