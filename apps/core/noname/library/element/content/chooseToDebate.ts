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

export const chooseToDebateContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
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
};
