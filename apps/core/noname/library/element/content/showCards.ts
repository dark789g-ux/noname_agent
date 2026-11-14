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

export const showCardsContent: Record<string, ContentFuncByAll | ContentFuncsByAll> = {
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
};
