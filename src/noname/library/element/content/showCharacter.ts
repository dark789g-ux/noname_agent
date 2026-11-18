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
import { useTargetSelectionSpec } from "./selectionResults.js";

export const showCharacterContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
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
				if (!event.filterTarget) next.set("selectionSpec", useTargetSelectionSpec);
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
};
