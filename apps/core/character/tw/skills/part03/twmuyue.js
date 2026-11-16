import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twmuyue" | "twchayi" | "twshengxi" | "twkuanji" | "shengxi_feiyi" | "twyulong" | "twjianming">} */
export const groupSkills = {
	//陈震
	twmuyue: {
		audio: "shameng1.mp3",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") || player.hasSkill("twmuyue_effect");
		},
		chooseButton: {
			dialog() {
				var list = [];
				for (var i of lib.inpile) {
					var type = get.type(i);
					if (type == "basic" || type == "trick") {
						list.push([type, "", i]);
					}
				}
				return ui.create.dialog("睦约", [list, "vcard"]);
			},
			check(button) {
				if (
					!get.cardPile2(function (cardx) {
						return cardx.name == button.link[2];
					})
				) {
					return 0;
				}
				return get.value({ name: button.link[2] });
			},
			backup(links, player) {
				return {
					audio: "twmuyue",
					filterCard(card, player, target) {
						return !player.hasSkill("twmuyue_effect");
					},
					selectCard() {
						var player = _status.event.player;
						return player.hasSkill("twmuyue_effect") ? -1 : 1;
					},
					check(card) {
						return 7 - get.value(card);
					},
					position: "he",
					card: links[0],
					filterTarget: true,
					content() {
						"step 0";
						var card = lib.skill.twmuyue_backup.card;
						event.card = card;
						player.removeSkill("twmuyue_effect");
						var cardx = get.cardPile2(function (cardx) {
							return cardx.name == card[2];
						});
						player.line(target, "green");
						if (cardx) {
							target.gain(cardx, "gain2");
						} else {
							player.chat("无牌可得了吗？！");
							game.log("但是牌堆中已经没有", "#g【" + get.translation(card[2]) + "】", "了！");
						}
						"step 1";
						if (cards && cards.length && get.name(cards[0], player) == card[2]) {
							player.addSkill("twmuyue_effect");
						}
					},
					ai: {
						result: {
							target(player, target) {
								var att = Math.abs(get.attitude(player, target));
								if (target.hasSkill("nogain")) {
									att /= 10;
								}
								return att / Math.sqrt(get.distance(player, target, "absolute"));
							},
						},
					},
				};
			},
			prompt(links, player) {
				return (
					(player.hasSkill("twmuyue_effect") ? "" : "弃置一张牌，") + "令一名角色从牌堆中获得一张【" + get.translation(links[0][2]) + "】"
				);
			},
		},
		ai: {
			order: 3,
			result: { player: 1 },
		},
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				intro: { content: "下一次发动【睦约】无需弃牌" },
			},
			backup: {},
		},
	},
	twchayi: {
		audio: "shameng2.mp3",
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		content() {
			"step 0";
			player.chooseTarget(get.prompt2("twchayi"), lib.filter.notMe).set("ai", function (target) {
				var player = _status.event.player;
				return -get.attitude(player, target);
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twchayi", target);
				if (!target.countCards("h")) {
					event._result = { index: 1 };
				} else {
					target.chooseControl().set("choiceList", ["展示手牌", "下一次使用牌时候弃一张牌"]);
				}
			} else {
				event.finish();
			}
			"step 2";
			target.storage.twchayi_re = [result.index, target.countCards("h")];
			target.addSkill("twchayi_re");
			target.markSkill("twchayi_re");
			if (result.index == 0) {
				target.showCards(target.getCards("h"), get.translation(target) + "的手牌");
			} else {
				target.addMark("twchayi_effect", 1, false);
				target.addSkill("twchayi_effect");
			}
		},
		subSkill: {
			effect: {
				intro: { content: "使用下一张牌时弃置&张牌" },
				charlotte: true,
				onremove: true,
				audio: "twchayi",
				trigger: { player: "useCard" },
				forced: true,
				content() {
					player.chooseToDiscard("he", true, player.countMark("twchayi_effect"));
					player.removeSkill("twchayi_effect");
				},
			},
			re: {
				charlotte: true,
				onremove: true,
				audio: "twchayi",
				trigger: { player: "phaseEnd" },
				direct: true,
				filter(event, player) {
					return player.storage.twchayi_re;
				},
				content() {
					if (player.countCards("h") != player.storage.twchayi_re[1]) {
						player.popup("察异");
						if (player.storage.twchayi_re[0] == 0) {
							player.addMark("twchayi_effect", 1, false);
							player.addSkill("twchayi_effect");
						} else {
							player.showCards(player.getCards("h"), get.translation(player) + "的手牌");
						}
					}
					player.removeSkill("twchayi_re");
				},
				marktext: "异",
				intro: {
					markcount(storage, player) {
						if (!storage || !storage.length) {
							return 0;
						}
						return storage[1];
					},
					content(storage, player) {
						if (!storage || !storage.length) {
							return;
						}
						return (
							"下个回合结束时，若你的手牌数不为" + storage[1] + "，你" + (storage[0] == 0 ? "下次使用牌时弃置一张牌" : "展示所有手牌")
						);
					},
				},
			},
		},
	},
	//费祎
	twshengxi: {
		audio: "shengxi_feiyi",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.getHistory("useCard").length > 0 && player.getHistory("sourceDamage").length == 0;
		},
		direct: true,
		content() {
			"step 0";
			var list = get.zhinangs();
			player.chooseButton(["###" + get.prompt("twshengxi") + "###获得一张智囊并摸一张牌", [list, "vcard"]]).set("ai", function (card) {
				return (Math.random() + 0.5) * get.value({ name: card.link[2] }, _status.event.player);
			});
			"step 1";
			if (result.bool) {
				player.logSkill("twshengxi");
				var card = get.cardPile2(function (card) {
					return card.name == result.links[0][2];
				});
				if (card) {
					player.gain(card, "gain2");
				}
				player.draw();
			}
		},
		group: "twshengxi_zhunbei",
		subfrequent: ["zhunbei"],
		subSkill: {
			zhunbei: {
				audio: "shengxi_feiyi",
				trigger: { player: "phaseZhunbeiBegin" },
				frequent: true,
				prompt2: "从游戏外或牌堆中获得一张【调剂盐梅】",
				content() {
					if (!_status.tiaojiyanmei_suits || _status.tiaojiyanmei_suits.length > 0) {
						if (!lib.inpile.includes("tiaojiyanmei")) {
							game.broadcastAll(function () {
								lib.inpile.add("tiaojiyanmei");
							});
						}
						if (!_status.tiaojiyanmei_suits) {
							_status.tiaojiyanmei_suits = lib.suit.slice(0);
						}
						player.gain(game.createCard2("tiaojiyanmei", _status.tiaojiyanmei_suits.randomRemove(), 6), "gain2");
					} else {
						var card = get.cardPile2(function (card) {
							return card.name == "tiaojiyanmei";
						});
						if (card) {
							player.gain(card, "gain2");
						}
					}
				},
			},
		},
	},
	twkuanji: {
		audio: "fyjianyu",
		trigger: {
			player: "loseAfter",
			global: ["cardsDiscardAfter", "loseAsyncAfter", "equipAfter"],
		},
		filter(event, player) {
			if (event.name != "cardsDiscard") {
				return event.getd(player, "cards2").length > 0;
			} else {
				if (event.cards.filterInD("d").length <= 0) {
					return false;
				}
				const evt = event.getParent();
				if (evt.name != "orderingDiscard") {
					return false;
				}
				const evtx = evt.relatedEvent || evt.getParent();
				if (evtx.player != player) {
					return false;
				}
				if (evtx.name == "useCard") {
					return false;
				}
				return player.hasHistory("lose", evtxx => {
					return evtx == (evtxx.relatedEvent || evtxx.getParent());
				});
			}
		},
		usable: 1,
		async cost(event, trigger, player) {
			const cards = trigger.name != "cardsDiscard" ? trigger.getd(player, "cards2") : trigger.cards.filterInD("d");
			const result = await player
				.chooseButtonTarget({
					createDialog: [get.prompt2(event.skill), cards],
					filterTarget: lib.filter.notMe,
					ai1(button) {
						const player = get.player();
						if (
							game.hasPlayer(current => {
								return current != player && get.attitude(player, current) > 0;
							})
						) {
							return Math.abs(get.value(button.link, "raw")) + 1;
						}
						return -get.value(button.link, "raw");
					},
					ai2(target) {
						const player = get.player();
						return (
							get.attitude(player, target) * get.value(ui.selected.buttons[0].link, target) * (target.hasSkillTag("nogain") ? 0.1 : 1)
						);
					},
				})
				.forResult();
			event.result = {
				bool: result?.bool,
				targets: result?.targets,
				cost_data: result?.links,
			};
		},
		async content(event, trigger, player) {
			await event.targets[0].gain(event.cost_data, "gain2");
		},
	},
	shengxi_feiyi: { audio: 2 },
	//王越
	twyulong: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!event.isFirstTarget) {
				return false;
			}
			if (event.card.name != "sha") {
				return false;
			}
			return event.targets.some(target => player.canCompare(target));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return _status.event.getTrigger().targets.includes(target) && player.canCompare(target);
				})
				.set("ai", target => {
					const player = get.player();
					if (player.hasCard(card => get.value(card) < 6, "h")) {
						return -get.attitude(player, target);
					}
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (!player.canCompare(target)) {
				return;
			}
			const result = await player.chooseToCompare(target).forResult();
			const color = get.color(result.player, false);
			if (color == "black") {
				trigger.getParent().baseDamage++;
				game.log(trigger.card, "的伤害+1");
			} else if (color == "red") {
				trigger.directHit.addArray(game.players);
				game.log(trigger.card, "不可被响应");
			}
			player
				.when("useCardAfter")
				.filter(evt => evt == trigger.getParent())
				.step(async (event, trigger, player) => {
					const bool = game.hasPlayer2(current => current.hasHistory("damage", evt => evt.card == trigger.card), true);
					if (bool !== result.bool) {
						return;
					}
					player.logSkill("twyulong");
					if (bool) {
						if (trigger.addCount !== false) {
							trigger.addCount = false;
							const stat = player.getStat("card"),
								name = trigger.card.name;
							if (typeof stat[name] == "number" && stat[name] > 0) {
								stat[name]--;
							}
							game.log(trigger.card, "不计入次数限制");
						}
					} else {
						if (trigger.cards?.someInD()) {
							await player.gain(trigger.cards.filterInD(), "gain2");
						}
					}
				});
		},
	},
	twjianming: {
		audio: 2,
		trigger: {
			player: ["useCard", "respond"],
			global: "loseAsyncAfter",
		},
		getIndex(event, player) {
			if (event.name == "loseAsync") {
				if (!event.getParent()?.name?.startsWith("chooseToCompare")) {
					return [];
				}
				if (!event.getl?.(player)?.cards2?.length) {
					return [];
				}
				return event.getl(player).cards2;
			} else {
				if (event.card.name != "sha") {
					return [];
				}
				return [event.card];
			}
		},
		filter(event, player, name, card) {
			const suit = get.suit(card);
			if (!lib.suit.includes(suit)) {
				return false;
			}
			return !player.getStorage("twjianming_used").includes(suit);
		},
		forced: true,
		async content(event, trigger, player) {
			const skill = "twjianming_used";
			player.addTempSkill(skill);
			player.markAuto(skill, get.suit(event.indexedData));
			player.addTip(
				skill,
				`剑鸣${player
					.getStorage(skill)
					.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a))
					.map(suit => get.translation(suit))
					.join("")}`
			);
			await player.draw();
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove(player, skill) {
					player.removeTip(skill);
					player.setStorage(skill, []);
				},
			},
		},
	},
};
