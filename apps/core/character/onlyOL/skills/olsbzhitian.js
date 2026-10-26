import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbzhitian" | "olsbwujing" | "olsbzhijue">} */
export const groupSkills = {
	//谋诸葛亮
	olsbzhitian: {
		audio: 2,
		clickableFilter(player) {
			//return player.isPhaseUsing();
			return player.hasSkill("olsbzhitian") && player.hasSkill("olsbzhitian_viewTop");
		},
		init(player, skill) {
			if (player.isPhaseUsing()) {
				player.addTempSkill(`${skill}_viewTop`, { global: ["phaseChange", "phaseAfter", "phaseBeforeStart"] });
			}
		},
		forced: true,
		locked: false,
		trigger: { player: "phaseUseBegin" },
		async content(event, trigger, player) {
			player.addTempSkill(`${event.name}_viewTop`, { global: ["phaseChange", "phaseAfter", "phaseBeforeStart"] });
		},
		clickable(player) {
			if (player.isUnderControl(true)) {
				const cards = lib.skill.olsbzhitian.getCards(player);
				function createDialogWithControl(result) {
					const dialog = ui.create.dialog("知天", "peaceDialog");
					result.length > 0 ? dialog.add(result, true) : dialog.addText("牌堆顶无牌");
					const control = ui.create.control("确定", () => dialog.close());
					dialog._close = dialog.close;
					dialog.hide = dialog.close = function (...args) {
						control.close();
						return dialog._close(...args);
					};
					if (_status.olsbzhitian_clickable) {
						_status.olsbzhitian_clickable.close();
					}
					_status.olsbzhitian_clickable = dialog;
					dialog.open();
				}
				if (cards instanceof Promise) {
					cards.then(([ok, result]) => createDialogWithControl(result));
				} else {
					createDialogWithControl(cards);
				}
			}
		},
		getCards(player) {
			let cards = [];
			const num = Math.max(1, 7 - player.countMark("olsbzhitian"));
			if (game.online) {
				return game.requestSkillData("olsbzhitian", "getTopCards", 10000);
			} else {
				if (ui.cardPile.hasChildNodes !== false) {
					cards = Array.from(ui.cardPile.childNodes).slice(0, num);
				}
			}
			return cards;
		},
		sync: {
			getTopCards(client) {
				if (ui.cardPile.hasChildNodes !== false) {
					return Array.from(ui.cardPile.childNodes).slice(0, Math.max(1, 7 - client.countMark("olsbzhitian")));
				}
				return [];
			},
		},
		mark: true,
		marktext: "牌",
		intro: {
			markcount(storage = 0, player) {
				return Math.max(1, 7 - storage);
			},
			mark(dialog, count = 0, player, event, skill) {
				const intronode = ui.create.div(".menubutton.pointerdiv", "点击发动", function () {
					if (!this.classList.contains("disabled")) {
						this.classList.add("disabled");
						this.style.opacity = 0.5;
						lib.skill[skill].clickable(player);
					}
				});
				if (!_status.gameStarted || !player.isUnderControl(true) || !lib.skill[skill].clickableFilter(player)) {
					intronode.classList.add("disabled");
					intronode.style.opacity = 0.5;
				}
				dialog.addText(`观看牌数-${count}`);
				dialog.add(intronode);
			},
		},
		group: ["olsbzhitian_huogong"],
		subSkill: {
			viewTop: {
				charlotte: true,
			},
			huogong: {
				enable: "chooseToDiscard",
				filter(event, player) {
					return event.getParent().name == "huogong" && get.itemtype(_status.pileTop) == "card" && !event.olsbzhitian_huogong;
				},
				async precontent(event, trigger, player) {
					const evt = event.getParent();
					const cards = await get.info("olsbzhitian").getCards(player);
					const result = await player
						.chooseButton([`知天：请选择一张牌作为此次“火攻”需要弃置的牌`, cards])
						.set("filterButton", button => {
							return get.event().links.includes(button.link);
						})
						.set(
							"links",
							cards.filter(card => evt.filterCard(card, player))
						)
						.set("ai", button => Math.random())
						.forResult();
					if (result?.links?.length) {
						const cards = result.links;
						event.result.bool = result.bool;
						event.result.cards = cards;
						player.logSkill("olsbzhitian");
						player
							.when("discardBegin")
							.filter(evtx => evtx.getParent() == evt)
							.step(async (event, trigger, player) => {
								trigger.setContent(async (event, trigger, player) => {
									const { cards } = event;
									player.$throw(cards, 1000);
									game.log(player, "弃置了", "#g牌堆", "的", cards);
									await game.cardsDiscard(cards);
								});
							});
					} else {
						evt.set(event.name.slice(4), true);
						evt.goto(0);
					}
				},
			},
			tag: {},
		},
	},
	olsbwujing: {
		audio: 2,
		trigger: {
			global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter", "equipAfter"],
		},
		forced: true,
		priority: 10,
		filter(event, player) {
			if (player !== _status.currentPhase) {
				return false;
			}
			if (event.name.indexOf("lose") == 0) {
				if (event.getlx === false || event.position != ui.discardPile) {
					return false;
				}
			} else if (event.name == "cardsDiscard") {
				const evt = event.getParent();
				if (evt.relatedEvent?.name == "useCard") {
					return false;
				}
			}
			return event.getd?.()?.length;
		},
		async content(event, trigger, player) {
			player.addSkill(event.name + "_effect");
		},
		group: ["olsbwujing_draw"],
		subSkill: {
			draw: {
				audio: "olsbwujing",
				trigger: {
					global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter", "equipAfter"],
				},
				forced: true,
				priority: 9,
				filter(event, player) {
					return get.info("olsbwujing_draw").getEvents().indexOf(event) == 0;
				},
				getEvents() {
					return game.getGlobalHistory("cardMove", event => {
						if (event.name == "lose") {
							if (event.position != ui.discardPile) {
								return false;
							}
							return event.cards?.some(card => !event.hs?.includes(card));
						} else if (event.name == "cardsDiscard") {
							const evt = event.getParent();
							if (evt.name !== "orderingDiscard") {
								return true;
							}
							const evt2 = evt.relatedEvent || evt.getParent();
							if (evt2) {
								const hs = game.filterPlayer2().reduce((list, target) => {
									const cards = [];
									target.checkHistory("lose", evtx => {
										const evtx2 = evtx.relatedEvent || evtx.getParent();
										if (evtx2 !== evt2) {
											return false;
										}
										cards.addArray(evtx.hs);
									});
									return list.addArray(cards);
								}, []);
								return event.cards?.some(card => !hs.includes(card));
							}
						}
						return false;
					});
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
			effect: {
				mod: {
					cardUsable: () => Infinity,
				},
				trigger: {
					player: "useCard1",
				},
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				content() {
					player.removeSkill(event.name);
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] === "number") {
							stat[name]--;
						}
					}
				},
				mark: true,
				intro: {
					content: "使用下一张牌无次数限制",
				},
			},
		},
	},
	olsbzhijue: {
		audio: 5,
		zhuanhuanji: true,
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				if (!storage) {
					return `出牌阶段，你可将牌堆顶的一张牌当【火攻】使用，若你以此法未造成伤害，你令〖知天〗可见牌与观看牌数-1（至少减至1），然后你摸两张牌。`;
				}
				return `出牌阶段，你可将一种颜色的手牌置入弃牌堆（每种颜色每回合限一次），然后可视为使用其中一张基本牌或普通锦囊牌，若你以此法未造成伤害，你令〖知天〗可见牌与观看牌数-1（至少减至1），然后你摸两张牌。`;
			},
		},
		enable: "phaseUse",
		filter(event, player) {
			const bool = player.storage.olsbzhijue;
			if (!bool) {
				return event.filterCard(get.autoViewAs({ name: "huogong" }, "unsure"), player, event);
			}
			if (bool) {
				const used = player.getStorage("olsbzhijue_used");
				return player.hasCard(card => !used.includes(get.color(card, player)), "h");
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				const bool = player.storage.olsbzhijue;
				const dialog = ui.create.dialog("智绝", "hidden");
				if (!bool) {
					dialog.add([["huogong"], "vcard"]);
					dialog.direct = true;
				} else {
					const colors = player
						.getCards("h")
						.map(card => get.color(card, player))
						.unique();
					dialog.addText("请将一种颜色的手牌置入弃牌堆");
					dialog.add([colors.map(i => [i, get.translation(i)]), "tdnodes"]);
				}
				return dialog;
			},
			filter(button, player) {
				if (button.link == "huogong") {
					return true;
				}
				return !player.getStorage("olsbzhijue_used").includes(button.link);
			},
			check(button) {
				if (button.link == "huogong") {
					return true;
				}
				const player = get.player();
				return 114514 - player.countCards("h", card => get.color(card, player) == button.link);
			},
			backup(links, player) {
				const bool = player.storage.olsbzhijue;
				const backup = get.copy(lib.skill[`olsbzhijue_${!bool ? "yang" : "yin"}`]);
				if (bool) {
					backup.filterCard = function (card, player) {
						return get.color(card, player) == links[0];
					};
					backup.link = links[0];
				}
				return backup;
			},
			prompt(links, player) {
				const link = links[0];
				if (!player.storage.olsbzhijue) {
					return `将牌堆顶的${get.translation(_status.pileTop)}当火攻使用`;
				} else {
					return `将${get.translation(link)}手牌置入弃牌堆`;
				}
			},
		},
		ai: {
			order: 5,
			result: {
				player: 1,
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已置入过的颜色：$",
				},
			},
			backup: {},
			yang: {
				audio: "olsbzhijue",
				logAudio: () => ["olsbzhijue", 3],
				filterCard: () => false,
				selectCard: -1,
				viewAs(cards, player) {
					const event = get.event(),
						filter = event._backup.filterCard;
					const viewAs = {
						name: "huogong",
						cards: [_status.pileTop],
					};
					if (filter(get.autoViewAs(viewAs, _status.pileTop), player, event)) {
						return viewAs;
					}
					return null;
				},
				async precontent(event, trigger, player) {
					//player.logSkill("olsbzhijue");
					player.changeZhuanhuanji("olsbzhijue");
					event.result.cards = get.cards(1, true);
					player.addTempSkill("olsbzhijue_effect");
				},
			},
			yin: {
				audio: "olsbzhijue",
				logAudio: () => ["olsbzhijue4.mp3", "olsbzhijue5.mp3"],
				position: "h",
				selectCard: -1,
				lose: false,
				discard: false,
				delay: false,
				async content(event, trigger, player) {
					player.changeZhuanhuanji("olsbzhijue");
					player.addTempSkill("olsbzhijue_used");
					player.markAuto("olsbzhijue_used", get.info(event.name).link);
					const { cards } = event;
					await player.loseToDiscardpile(cards);
					let noDamage = true;
					const viewAs = card => new lib.element.VCard({ name: card.name, nature: card.nature, isCard: true });
					const cardsx = cards.filter(card => ["basic", "trick"].includes(get.type(card)) && player.hasUseTarget(viewAs(card)));
					if (cardsx.length) {
						const result = await player
							.chooseButton([`智绝：你可视为使用其中一张基本牌或普通锦囊牌`, cards])
							.set("cards", cardsx)
							.set("filterButton", button => get.event().cards.includes(button.link))
							.set("ai", button => {
								const player = get.player(),
									card = button.link;
								return player.getUseValue({ name: card.name, nature: card.nature, isCard: true });
							})
							.forResult();
						if (result?.links?.length) {
							const card = viewAs(result.links[0]);
							const next = player.chooseUseTarget(card, true);
							await next;
							if (
								game.hasPlayer2(
									target =>
										target.hasHistory("damage", evt => {
											return evt.getParent("useCard", true)?.getParent() == next;
										}),
									true
								)
							) {
								noDamage = false;
							}
						}
					}
					if (noDamage && player.countMark("olsbzhitian") < 6) {
						await player.useResult({ skill: "olsbzhijue_effect" }, event);
					}
				},
			},
			effect: {
				audio: "olsbzhijue",
				logAudio(event, player) {
					const bool = player.getStorage("olsbzhijue", false);
					if (bool) {
						return ["olsbzhijue4.mp3", "olsbzhijue5.mp3"];
					}
					return ["olsbzhijue", 3];
				},
				forced: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.skill == "olsbzhijue_backup" && !game.hasPlayer2(target => target.hasHistory("damage", evt => evt.card == event.card), true) && player.countMark("olsbzhitian") < 6;
				},
				async content(event, trigger, player) {
					player.addMark("olsbzhitian", 1, false);
					await player.draw(2);
				},
			},
		},
	},
};
