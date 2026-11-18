import { game, get, lib, ui } from "noname";
import type { Card, GameEvent, Player, VCard } from "../../index.js";
import type { ThrowInitData, ThrownNodeMap } from "../contracts/instanceFieldsContract.js";
import { getThrownCardId, isThrownNode, isThrownNodeMap, replaceThrownCardsetion } from "../dom/nodeGuards.js";

type ThrowSourceEvent = GameEvent & {
	id?: number | string;
	lose_map?: Record<string, Card[]>;
	card?: Card | VCard;
	cards?: Card[];
};

export const throwAnimationMethods = {
	$throw(this: Player, card, time?: number, init?: boolean | "nobroadcast", nosource?: boolean | null, cardsetion?: string | false | null, id?: number | string): Card | HTMLDivElement | undefined {
		if (!cardsetion && cardsetion !== false && lib.config.card_animation_info) {
			let source: Player = this;
			if (["useCard", "respond"].includes(get.event().name)) {
				const eventPlayer = get.player();
				if (eventPlayer) {
					source = eventPlayer;
					cardsetion = get.cardsetion(source);
				}
				const activeEvent = get.event() as ThrowSourceEvent;
				if (!activeEvent.id) activeEvent.id = get.id();
				if (!id) id = activeEvent.id;
			}
		}
		if (typeof card == "number") {
			let tmp = card;
			card = [];
			while (tmp--) {
				let cardx = ui.create.card();
				cardx.classList.add("infohidden");
				cardx.classList.add("infoflip");
				if (cardsetion) {
					let next = ui.create.div(".cardsetion", cardsetion, cardx);
					next.style.setProperty("display", "block", "important");
					const cardNode: ThrownNodeMap | undefined = cardx.node;
					if (isThrownNode(cardx) && cardNode) {
						if (!isThrownNodeMap(cardNode)) {
							throw new TypeError("thrown node map must be an object");
						}
						if (id) {
							cardNode.throw_id = id;
						}
						replaceThrownCardsetion(cardx, next);
					}
				}
				card.push(cardx);
			}
		}
		if (init !== false) {
			if (init !== "nobroadcast") {
				game.broadcast(
					function (player, card, time, init, nosource, cardsetion, id) {
						player.$throw(card, time, init, nosource, cardsetion, id);
					},
					this,
					card,
					time,
					init,
					nosource,
					cardsetion,
					id
				);
			}
			if (get.itemtype(card) != "cards") {
				if (get.itemtype(card) == "card") {
					card = [card];
				} else {
					return;
				}
			}
			game.addVideo("throw", this, [get.cardsInfo(card), time, nosource]);
		}
		if (game.chess) {
			this.chessFocus();
		}
		if (get.itemtype(card) == "cards") {
			const nodes: any[] = [];

			for (let i = 0; i < card.length; i++) {
				nodes.push(this.$throw(card[i], time, false, nosource, cardsetion, id));
			}
			const curEvent = get.event() as ThrowSourceEvent;
			const playerid = this.playerid;
			if (playerid && ["useCard", "respond"].includes(curEvent.name) && curEvent.lose_map?.[playerid] === card) {
				const eventCard = curEvent.card;
				const eventCards = curEvent.cards;
				const isCard = eventCard?.isCard && eventCards?.length == 1;
				const isCard2 =
					eventCards?.length == 1 &&
					eventCard != null &&
					(["name", "suit", "number", "nature"] as const).every(key => {
						let singleCard = eventCards[0];
						if (key == "nature") {
							if (singleCard.nature == void 0 && eventCard.nature === false) {
								return true;
							}
						}
						return singleCard[key] == eventCard[key];
					});
				// 是否允许显示转化牌的详情并且是转化牌哦
				if (lib.config.card_animation_info && nodes.length && (!isCard || !isCard2) && (eventCards?.length ?? 0) >= 1) {
					async function makeViewAsCard(event, lastCardid) {
						const isThrownCard = (node: Node | null | undefined): node is HTMLDivElement & { _cardid?: unknown; node?: unknown; init?: unknown; _customintro?: unknown } => node instanceof HTMLDivElement;
						const getThrownCardId = (node: HTMLDivElement & { _cardid?: unknown }): unknown => {
							return node._cardid;
						};
						const getThrownNodeMap = (node: HTMLDivElement & { node?: unknown }): { cardsetion?: unknown; name2?: unknown; range?: unknown } | undefined => {
							const nodeMap = node.node;
							if (!nodeMap) return;
							if (typeof nodeMap !== "object" && typeof nodeMap !== "function") {
								throw new TypeError("thrown node map must be an object");
							}
							return nodeMap as { cardsetion?: unknown; name2?: unknown; range?: unknown };
						};
						const getThrownCardsetion = (node: HTMLDivElement & { node?: unknown }): Node | undefined => {
							const cardsetion = getThrownNodeMap(node)?.cardsetion;
							if (cardsetion === undefined) return;
							if (!(cardsetion instanceof Node)) {
								throw new TypeError("thrown card section must be a Node");
							}
							return cardsetion;
						};
						const vcard = event.card;
						const throwns = Array.from(ui.arena.querySelectorAll(".card.thrown")).reverse();
						const lastCard = throwns.find(c => {
							return isThrownCard(c) && getThrownCardId(c) == lastCardid;
						});
						if (!isThrownCard(lastCard)) return;
						const curCards = event.cards;

						function waitForTransition(node: HTMLDivElement, time?: number): Promise<void> {
							return new Promise(resolve => {
								node.listenTransition(() => {
									resolve();
								}, time);
							});
						}

						function waitForAnimation(node: HTMLDivElement, keyframes: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
							return new Promise(resolve => {
								node.animate(keyframes, options).onfinish = () => {
									resolve();
								};
							});
						}

						function reinitClonedCard(card: HTMLDivElement & { node?: unknown; init?: unknown }, data: ThrowInitData) {
							const cardNode = getThrownNodeMap(card);
							if (!cardNode || !card.init) return;
							const Card = lib.element.Card;
							const oldPrototype = Object.getPrototypeOf(card);
							Object.setPrototypeOf(card, Card.prototype);
							if (!(card instanceof Card)) {
								throw new TypeError("cloned card must adopt the Card prototype");
							}
							const init = card.init;
							if (typeof init !== "function") {
								throw new TypeError("cloned card init method must be callable");
							}
							cardNode.name2 = {};
							cardNode.range = {};
							init.call(card, data);
							delete cardNode.name2;
							delete cardNode.range;
							Object.setPrototypeOf(card, oldPrototype);
						}

						await waitForTransition(lastCard, 500);

						const number = get.number(vcard, false);
						let vcardStr = "转化",
							vcardSkill;
						if (event.skill) {
							vcardSkill = event.skill;
						} else {
							const modSkills = Object.values(event.modSkill).find((name: any) => {
								return name && lib.translate[name];
							});
							if (modSkills) {
								vcardSkill = modSkills;
								vcardStr = "视为";
							}
						}
						if (typeof vcardSkill != "string" || !lib.translate[vcardSkill]) {
							vcardSkill = "";
						}
						let suit = get.suit(vcard, false),
							color = get.color(vcard, false),
							color2 = color == "red" ? "red" : "black";
						const numberText = typeof number == "number" ? String(number) : `<span style="color:${color2}">${vcardStr}</span>`;
						const initData: ThrowInitData = [suit, numberText, get.name(vcard, false) || "", get.nature(vcard, false)];

						const position = getThrownCardsetion(lastCard);
						const initMask = ui.create.div(".initmask");

						if (position) lastCard.insertBefore(initMask, position);
						else lastCard.appendChild(initMask);

						await waitForAnimation(initMask, [{ opacity: 0 }, { opacity: 1 }], {
							duration: 150,
							fill: "forwards",
							iterations: 1,
						});

						reinitClonedCard(lastCard, initData);

						await waitForAnimation(initMask, [{ opacity: 1 }, { opacity: 0 }], {
							duration: 150,
							fill: "forwards",
							iterations: 1,
						});

						initMask.remove();

						lastCard.style.pointerEvents = "all";

						lastCard.addEventListener(
							lib.config.touchscreen ? "touchend" : "click",
							function (e: Event | Touch) {
								lastCard._customintro = function (uiintro, evt) {
									delete lastCard._customintro;

									const newUiintro = get.nodeintro(lastCard, false, evt);

									if (!newUiintro) {
										return false;
									}
									newUiintro.add('<div class="text center">由' + get.translation(vcardSkill) + vcardStr + "</div>");
									newUiintro.add(curCards);

									const first = newUiintro.content.firstElementChild;
									const buttons = newUiintro.content.lastElementChild;
									if (first && buttons) {
										newUiintro.content.insertBefore(buttons, first.nextSibling);
									}

									uiintro.contentContainer.insertBefore(newUiintro.content, uiintro.content);
									uiintro.contentContainer.removeChild(uiintro.content);
									uiintro.content = newUiintro.content;
									newUiintro.close();
								};

								if (e instanceof TouchEvent && e.changedTouches[0]) {
									e = e.changedTouches[0];
								}
								return ui.click.intro.call(lastCard, e);
							},
							true
						);
					}

					let lastNode = nodes[nodes.length - 1];
					const loseMap = (get.event() as ThrowSourceEvent).lose_map;
					if (loseMap) {
						const id = this.playerid;
						let ids: string[] = [];
						for (let key in loseMap) {
							if (key != "noowner" && loseMap[key].length > 0) {
								ids.add(key);
							}
						}
						if (!id || ids.indexOf(id) == -1 || ids.indexOf(id) != ids.length - 1) {
							lastNode = {
								_cardid: -1,
							};
						}
					}
					const lastCardId = lastNode && isThrownNode(lastNode) ? getThrownCardId(lastNode) : undefined;
					if (init !== "nobroadcast") game.broadcastAll(makeViewAsCard, curEvent, lastCardId);
					else makeViewAsCard(curEvent, lastCardId);
				}
			}

			return nodes[nodes.length - 1];
		} else {
			let node;
			if (card == void 0 || card.length == 0) return;
			let cardx = card.copy("thrown");
			if (id) cardx.node.throw_id = id;
			node = this.$throwordered(cardx, nosource, cardsetion);
			if (time != void 0) {
				node.fixed = true;
				setTimeout(function () {
					node.delete();
				}, time);
			}
			lib.listenEnd(node);
			return node;
		}
	},
};
