import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczhaowen" | "dcjiudun" | "dcjincui">} */
export const groupSkills = {
	//阮籍
	dczhaowen: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		check(event, player) {
			return player.hasCard(card => {
				return get.color(card) == "black" || (get.color(card) == "red" && player.hasValueTarget(card));
			});
		},
		content() {
			"step 0";
			player.showHandcards();
			"step 1";
			player.addTempSkill("dczhaowen_effect");
			game.broadcastAll(function (cards) {
				cards.forEach(card => card.addGaintag("dczhaowen_tag"));
			}, player.getCards("h"));
		},
		ai: {
			threaten: 3,
		},
		subSkill: {
			effect: {
				audio: "dczhaowen",
				enable: "chooseToUse",
				charlotte: true,
				onremove(player) {
					player.removeGaintag("dczhaowen_tag");
				},
				hiddenCard(player, name) {
					return (
						get.type(name) == "trick" &&
						!player.getStorage("dczhaowen_viewed").includes(name) &&
						player.countCards("h", card => {
							return get.color(card) == "black" && card.hasGaintag("dczhaowen_tag");
						}) > 0
					);
				},
				filter(event, player) {
					if (
						!player.hasCard(card => {
							return get.color(card) == "black" && card.hasGaintag("dczhaowen_tag");
						})
					) {
						return false;
					}
					var storage = player.getStorage("dczhaowen_viewed");
					for (var i of lib.inpile) {
						if (!storage.includes(i) && get.type(i) == "trick" && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
							return true;
						}
					}
					return false;
				},
				chooseButton: {
					dialog(event, player) {
						var cards = player.getCards("h", card => {
							return get.color(card) == "black" && card.hasGaintag("dczhaowen_tag");
						});
						var storage = player.getStorage("dczhaowen_viewed");
						var list = [];
						for (var i of lib.inpile) {
							if (!storage.includes(i) && get.type(i) == "trick" && event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
								list.push(["锦囊", "", i]);
							}
						}
						return ui.create.dialog("昭文", [list, "vcard"], "hidden");
					},
					check(button) {
						var player = _status.event.player;
						return player.getUseValue({ name: button.link[2] }) + 1;
					},
					backup(links, player) {
						return {
							audio: "dczhaowen",
							popname: true,
							filterCard(card, player) {
								return get.color(card) == "black" && card.hasGaintag("dczhaowen_tag");
							},
							selectCard: 1,
							position: "h",
							viewAs: {
								name: links[0][2],
							},
							onuse(links, player) {
								player.addTempSkill("dczhaowen_viewed");
								player.markAuto("dczhaowen_viewed", [links.card.name]);
							},
						};
					},
					prompt(links, player) {
						return "将一张展示过的黑色手牌当做" + get.translation(links[0][2]) + "使用";
					},
				},
				group: "dczhaowen_draw",
				mod: {
					aiOrder(player, card, num) {
						var cards = [];
						if (card.cards) {
							cards.addArray(cards);
						}
						if (get.itemtype(card) == "card") {
							cards.push(card);
						}
						for (var cardx of cards) {
							if (get.color(cardx) != "red") {
								continue;
							}
							if (cardx.hasGaintag("dczhaowen_tag")) {
								return num + 0.2;
							}
						}
					},
				},
				ai: {
					order: 12,
					result: {
						player: 1,
					},
				},
			},
			draw: {
				audio: "dczhaowen",
				forced: true,
				charlotte: true,
				trigger: { player: "useCard" },
				filter(event, player) {
					var cards = event.cards.filter(card => get.color(card, player) == "red");
					return player.hasHistory("lose", evt => {
						if (event != (evt.relatedEvent || evt.getParent())) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dczhaowen_tag")) {
								if (cards.some(card => card.cardid == i)) {
									return true;
								}
							}
						}
					});
				},
				content() {
					var num = 0;
					var cards = trigger.cards.filter(card => get.color(card, player) == "red");
					player.getHistory("lose", evt => {
						if (trigger != (evt.relatedEvent || evt.getParent())) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dczhaowen_tag")) {
								if (cards.some(card => card.cardid == i)) {
									num++;
								}
							}
						}
					});
					while (num--) {
						player.draw();
					}
				},
				ai: {
					effect: {
						player_use(card, player, target) {
							if (get.itemtype(card) === "card" && card.hasGaintag("dczhaowen_tag") && get.color(card, player) === "red") {
								return [1, 1];
							}
						},
					},
				},
			},
			viewed: {
				onremove: true,
				charlotte: true,
			},
			effect_backup: {
				audio: "dczhaowen",
			},
		},
	},
	dcjiudun: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			if (event.player == player || get.color(event.card) != "black") {
				return false;
			}
			if (player.hasSkill("jiu")) {
				return player.countCards("h", card => {
					return _status.connectMode || lib.filter.cardDiscardable(card, player, "dcjiudun");
				});
			}
			return true;
		},
		direct: true,
		content() {
			"step 0";
			if (player.hasSkill("jiu")) {
				player
					.chooseToDiscard(get.prompt("dcjiudun"), '<div class="text center">弃置一张手牌，令' + get.translation(trigger.card) + "对你无效</div>")
					.set("logSkill", "dcjiudun")
					.set("ai", card => {
						if (_status.event.goon) {
							return 4.5 + Math.max(0, 3 - player.hp) - get.value(card);
						}
						return 0;
					})
					.set(
						"goon",
						(function () {
							if (get.effect(player, trigger.card, trigger.player, player) < -4 * Math.max(0, 5 - Math.sqrt(player.countCards("h")))) {
								return true;
							}
							return false;
						})()
					);
				event.goto(2);
			} else {
				player.chooseBool(get.prompt("dcjiudun"), "摸一张牌，然后视为使用一张【酒】").set("ai", () => 1);
			}
			"step 1";
			if (result.bool) {
				player.logSkill("dcjiudun");
				player.draw();
				player.chooseUseTarget("jiu", true);
			}
			event.finish();
			"step 2";
			if (result.bool) {
				trigger.excluded.add(player);
				game.log(trigger.card, "对", player, "无效");
			}
		},
		ai: {
			jiuSustain: true,
			skillTagFilter(player, tag, name) {
				if (name != "phase") {
					return false;
				}
			},
			effect: {
				target(card, player, target) {
					if (player === target || typeof card !== "object" || get.color(card) !== "black") {
						return;
					}
					if (target.hasSkill("jiu")) {
						if (
							card.name !== "huogong" &&
							get.tag(card, "damage") &&
							get.attitude(player, target) <= 0 &&
							target.hasCard(i => {
								return _status.connectMode || lib.filter.cardDiscardable(i, player, "dcjiudun");
							}, "h")
						) {
							return [0, -1];
						}
					} else {
						return [1, 1.2];
					}
				},
			},
		},
	},
	//武诸葛
	dcjincui: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return true;
		},
		forced: true,
		group: "dcjincui_advent",
		async content(event, trigger, player) {
			let num = 0;
			for (let i = 0; i < ui.cardPile.childNodes.length; i++) {
				let card = ui.cardPile.childNodes[i];
				if (get.number(card) == 7) {
					num++;
					if (num >= player.maxHp) {
						break;
					}
				}
			}
			if (num < 1) {
				num = 1;
			}
			if (num > player.hp) {
				await player.recover(num - player.hp);
			} else if (num < player.hp) {
				await player.loseHp(player.hp - num);
			}
			const result = await player
				.chooseToGuanxing(player.hp)
				.set("prompt", "尽瘁：点击或拖动将牌移动到牌堆顶或牌堆底")
				.set("processAI", list => {
					let cards = list[0][1],
						player = _status.event.player,
						target = _status.currentPhase || player,
						name = _status.event.getTrigger().name,
						countWuxie = current => {
							let num = current.getKnownCards(player, card => {
								return get.name(card, current) === "wuxie";
							});
							if (num && current !== player) {
								return num;
							}
							let skills = current.getSkills("invisible").concat(lib.skill.global);
							game.expandSkills(skills);
							for (let i = 0; i < skills.length; i++) {
								let ifo = get.info(skills[i]);
								if (!ifo) {
									continue;
								}
								if (ifo.viewAs && typeof ifo.viewAs != "function" && ifo.viewAs.name == "wuxie") {
									if (!ifo.viewAsFilter || ifo.viewAsFilter(current)) {
										num++;
										break;
									}
								} else {
									let hiddenCard = ifo.hiddenCard;
									if (typeof hiddenCard == "function" && hiddenCard(current, "wuxie")) {
										num++;
										break;
									}
								}
							}
							return num;
						},
						top = [],
						bottom = [];
					for (let i = 0; i < cards.length; i++) {
						if (get.number(cards[i]) == 7) {
							bottom.addArray(cards.splice(i--, 1));
						}
					}
					switch (name) {
						case "phaseJieshu":
							target = target.next;
						// [falls through]
						case "phaseZhunbei": {
							let att = get.sgn(get.attitude(player, target)),
								judges = target.getCards("j"),
								needs = 0,
								wuxie = countWuxie(target);
							for (let i = Math.min(cards.length, judges.length) - 1; i >= 0; i--) {
								let j = judges[i],
									cardj = j.viewAs ? { name: j.viewAs, cards: j.cards || [j] } : j;
								if (wuxie > 0 && get.effect(target, j, target, target) < 0) {
									wuxie--;
									continue;
								}
								let judge = get.judge(j);
								cards.sort((a, b) => {
									return (judge(b) - judge(a)) * att;
								});
								if (judge(cards[0]) * att < 0) {
									needs++;
									continue;
								} else {
									top.unshift(cards.shift());
								}
							}
							if (needs > 0 && needs >= judges.length) {
								bottom.addArray(cards);
								return [top, bottom];
							}
							cards.sort((a, b) => {
								return (get.value(b, target) - get.value(a, target)) * att;
							});
							while (needs--) {
								top.unshift(cards.shift());
							}
							while (cards.length) {
								if (get.value(cards[0], target) > 6 == att > 0) {
									top.unshift(cards.shift());
								} else {
									break;
								}
							}
							bottom.addArray(cards);
							return [top, bottom];
						}
						default:
							cards.sort((a, b) => {
								return get.value(b, target) - get.value(a, target);
							});
							while (cards.length) {
								if (get.value(cards[0], target) > 6) {
									top.unshift(cards.shift());
								} else {
									break;
								}
							}
							bottom.addArray(cards);
							return [top, bottom];
					}
				})
				.forResult();
			if (!result.bool || !result.moved[0].length) {
				player.addTempSkill("guanxing_fail");
			}
		},
		ai: {
			guanxing: true,
			effect: {
				target(card, player, target) {
					if (!get.tag(card, "damage")) {
						return;
					}
					var num = 0,
						bool = false;
					for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
						var card = ui.cardPile.childNodes[i];
						if (get.number(card) == 7) {
							num++;
							if (num >= target.hp) {
								bool = true;
								break;
							}
						}
					}
					if (bool) {
						return 0.2;
					}
				},
			},
			threaten: 0.6,
		},
		subSkill: {
			advent: {
				audio: "dcjincui",
				trigger: { global: "phaseBefore", player: "enterGame" },
				forced: true,
				filter(event, player) {
					return (event.name != "phase" || game.phaseNumber == 0) && player.countCards("h") < 7;
				},
				content() {
					player.drawTo(7);
				},
			},
		},
	},
};
