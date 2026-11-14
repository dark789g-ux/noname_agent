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

export const gainPlayerCardContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
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
			if (event.result == "ai" && !(await applyLLMDecision(event))) {
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
};
