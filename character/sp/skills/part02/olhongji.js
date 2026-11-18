import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olhongji" | "olxinggu" | "olxianbi" | "olzenrun">} */
export const groupSkills = {
	//张世平
	olhongji: {
		audio: 2,
		trigger: { global: "phaseZhunbeiBegin" },
		filter(event, player) {
			const list = player.getStorage("olhongji_used");
			if (event.player.isMinHandcard() && !list.includes("min")) {
				return true;
			}
			if (event.player.isMaxHandcard() && !list.includes("max")) {
				return true;
			}
			return false;
		},
		direct: true,
		content() {
			"step 0";
			let target = trigger.player;
			event.target = target;
			const list = player.getStorage("olhongji_used");
			let bool1 = target.isMinHandcard() && !list.includes("min"),
				str1 = "其手牌数为全场最少。你可以令其于本回合摸牌阶段结束后执行一个额外的摸牌阶段，然后本轮你不能再发动该分支。";
			let bool2 = target.isMaxHandcard() && !list.includes("max"),
				str2 = "其手牌数为全场最多。你可以令其于本回合出牌阶段结束后执行一个额外的出牌阶段，然后本轮你不能再发动该分支。";
			if (bool1 && !bool2) {
				event.branch = 0;
				player
					.chooseBool(get.prompt("olhongji", target), str1)
					.set("ai", () => {
						return _status.event.bool;
					})
					.set("bool", get.attitude(player, trigger.player) > 1);
			} else if (!bool1 && bool2) {
				event.branch = 1;
				player
					.chooseBool(get.prompt("olhongji", target), str2)
					.set("ai", () => {
						return _status.event.bool;
					})
					.set("bool", get.attitude(player, trigger.player) > 1);
			} else if (bool1 && bool2) {
				player
					.chooseControl("摸牌阶段", "出牌阶段", "cancel2")
					.set("prompt", get.prompt("olhongji", target))
					.set("choiceList", [str1.slice(13), str2.slice(13)])
					.set("ai", () => _status.event.bool)
					.set("bool", () => (get.attitude(player, trigger.player) > 1 ? [0, 1].randomGet() : "cancel2"));
			}
			"step 1";
			var choice = -1;
			if ((event.branch == 0 && result.bool) || result.control == "摸牌阶段") {
				choice = 0;
			}
			if ((event.branch == 1 && result.bool) || result.control == "出牌阶段") {
				choice = 1;
			}
			if (choice == 0) {
				player.logSkill("olhongji", target);
				target.addTempSkill("olhongji_draw");
			} else if (choice == 1) {
				player.logSkill("olhongji", target);
				target.addTempSkill("olhongji_use");
			}
			player.addTempSkill("olhongji_used", "roundStart");
			player.markAuto("olhongji_used", ["min", "max"][choice]);
		},
		ai: { expose: 0.25 },
		subSkill: {
			used: { charlotte: true, onremove: true },
			draw: {
				trigger: { player: "phaseDrawAfter" },
				charlotte: true,
				forced: true,
				popup: false,
				content() {
					const evt = trigger.getParent("phase", true, true);
					if (evt?.phaseList) {
						evt.phaseList.splice(evt.num + 1, 0, "phaseDraw|olhongji");
					}
					player.removeSkill(event.name);
				},
			},
			use: {
				trigger: { player: "phaseUseAfter" },
				charlotte: true,
				forced: true,
				popup: false,
				content() {
					const evt = trigger.getParent("phase", true, true);
					if (evt?.phaseList) {
						evt.phaseList.splice(evt.num + 1, 0, "phaseUse|olhongji");
					}
					player.removeSkill(event.name);
				},
			},
		},
	},
	olxinggu: {
		audio: 2,
		trigger: { global: "phaseBefore", player: "enterGame" },
		forced: true,
		locked: false,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: "olxinggu_trade",
		content() {
			"step 0";
			var cards = [];
			for (var i = 0; i < 3; i++) {
				var card = get.cardPile2(function (card) {
					if (cards.includes(card)) {
						return false;
					}
					var type = get.subtype(card);
					return type == "equip3" || type == "equip4" || type == "equip6";
				});
				if (card) {
					cards.add(card);
				} else {
					break;
				}
			}
			if (cards.length) {
				player.addToExpansion(cards, "draw").gaintag.add("olxinggu");
			}
		},
		marktext: "贾",
		intro: {
			markcount: "expansion",
			mark(dialog, content, player) {
				var content = player.getExpansions("olxinggu");
				if (content && content.length) {
					if (player == game.me || player.isUnderControl()) {
						dialog.addAuto(content);
					} else {
						return "剩余" + get.cnNumber(content.length) + "匹马";
					}
				}
			},
		},
		subSkill: {
			trade: {
				audio: "olxinggu",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return player.getExpansions("olxinggu").length;
				},
				direct: true,
				content() {
					"step 0";
					var cards = player.getExpansions("olxinggu");
					if (_status.connectMode) {
						game.broadcastAll(function () {
							_status.noclearcountdown = true;
						});
					}
					player
						.chooseButton([get.prompt("olxinggu"), cards])
						.set("ai", button => {
							if (_status.event.toChoose == button.link) {
								return 1;
							}
							return 0;
						})
						.set(
							"toChoose",
							!event.aiCancel &&
								cards.find(card => {
									return game.hasPlayer(current => {
										if (!lib.skill.zhijian.filterTarget(card, player, current)) {
											return false;
										}
										return get.effect(current, card, player, player) > 0;
									});
								})
						);
					"step 1";
					if (result.bool) {
						var card = result.links[0];
						event.card = card;
						player
							.chooseTarget("将" + get.translation(card) + "置入一名其他角色的装备区", lib.skill.zhijian.filterTarget)
							.set("ai", target => {
								var player = _status.event.player;
								return get.effect(target, _status.event.card, player, player);
							})
							.set("card", card);
					} else {
						if (_status.connectMode) {
							game.broadcastAll(function () {
								delete _status.noclearcountdown;
								game.stopCountChoose();
							});
						}
						event.finish();
					}
					"step 2";
					if (result.bool) {
						var target = result.targets[0];
						event.target = target;
						if (_status.connectMode) {
							game.broadcastAll(function () {
								delete _status.noclearcountdown;
								game.stopCountChoose();
							});
						}
						player.logSkill("olxinggu", target);
						player.$give(card, target, false);
					} else {
						if (!event.isMine() && !event.isOnline()) {
							event.aiCancel = true;
						}
						event.goto(0);
					}
					"step 3";
					target.equip(card);
					"step 4";
					var card = get.cardPile2(cardx => {
						return get.suit(cardx) == "diamond";
					});
					if (card) {
						player.gain(card, "gain2");
					} else {
						game.log("但是牌堆中并没有♦牌了！");
						player.chat("做了个亏本买卖…");
					}
				},
			},
		},
	},
	//孙弘
	olxianbi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return !player.getStorage("olzenrun").includes(target) && target.countCards("e") != player.countCards("h");
		},
		content() {
			"step 0";
			var del = target.countCards("e") - player.countCards("h");
			if (del == 0) {
				event.finish();
			} else if (del > 0) {
				player.draw(Math.min(5, del));
			} else {
				player.chooseToDiscard("险诐：弃置" + get.cnNumber(-del) + "张手牌", -del, "h", true, "allowChooseAll");
				player.addTempSkill("olxianbi_gain");
			}
		},
		ai: {
			order: 5,
			result: {
				player(player, target) {
					return player.countCards("h", card => {
						return get.value(card) > 6;
					}) >= target.countCards("e")
						? 0
						: 1;
				},
			},
		},
		subSkill: {
			gain: {
				trigger: {
					player: "loseAfter",
				},
				filter(event, player) {
					return event.getParent(3).name == "olxianbi";
				},
				forced: true,
				charlotte: true,
				popup: false,
				content() {
					var cards = [],
						cards2 = trigger.cards;
					for (var cardx of cards2) {
						var type = get.type2(cardx, player);
						var card = get.discardPile(function (card) {
							return get.type2(card, false) == type && !cards2.includes(card) && !cards.includes(card);
						}, "random");
						if (card) {
							cards.push(card);
						}
					}
					if (cards.length) {
						player.gain(cards, "gain2");
					}
				},
			},
		},
	},
	olzenrun: {
		audio: 2,
		trigger: { player: "drawBefore" },
		filter(event, player) {
			return (
				!player.hasSkill("olzenrun_used") &&
				game.hasPlayer(current => {
					return (
						!player.getStorage("olzenrun").includes(current) &&
						current != player &&
						current.hasCard(function (card) {
							return lib.filter.canBeGained(card, player, current);
						}, "he")
					);
				})
			);
		},
		direct: true,
		check(event, player) {
			return true;
		},
		content() {
			"step 0";
			var num = trigger.num;
			player
				.chooseTarget(get.prompt("olzenrun"), "改为获得一名其他角色" + get.cnNumber(num) + "张牌", (card, player, target) => {
					return (
						!player.getStorage("olzenrun").includes(target) &&
						target != player &&
						target.hasCard(function (card) {
							return lib.filter.canBeGained(card, player, target);
						}, "he")
					);
				})
				.set("ai", target => {
					return get.attitude(_status.event.player, target) / 5 + Math.random() + 2.5;
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("olzenrun", target);
				player.addTempSkill("olzenrun_used", ["phaseZhunbeiAfter", "phaseJudgeAfter", "phaseDrawAfter", "phaseUseAfter", "phaseDiscardAfter", "phaseJieshuAfter"]);
				trigger.cancel();
				player.gainPlayerCard(target, trigger.num, "he", true);
			}
			"step 2";
			if (result.bool) {
				var cards = result.cards;
				var num = cards.length;
				event.num = num;
				target
					.chooseControl()
					.set("choiceList", ["摸" + get.cnNumber(num) + "张牌", "令其不能再对你发动〖险诐〗和〖谮润〗"])
					.set("prompt", get.translation(player) + "对你发动了【谮润】，请选择一项")
					.set("ai", () => {
						if (_status.event.bool) {
							return 0;
						}
						return 1;
					})
					.set("bool", get.attitude(target, player) > 0 || (num == 1 && Math.random() < 0.5) || num >= 2);
			} else {
				event.finish();
			}
			"step 3";
			game.log(target, "选择了", "#y" + result.control);
			if (result.index == 0) {
				target.draw(num);
			} else {
				player.markAuto("olzenrun", [target]);
			}
		},
		subSkill: {
			used: {
				charlotte: true,
			},
		},
	},
};
