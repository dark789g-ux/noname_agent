import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "new_xingwu" | "new_luoyan" | "new_meibu" | "new_mumu" | "new_zhixi" | "qingzhong">} */
export const groupSkills = {
	//新大小乔
	new_xingwu: {
		audio: "xingwu",
		trigger: {
			player: "phaseDiscardBegin",
		},
		direct: true,
		intro: {
			content: "expansion",
			markcount: "expansion",
			onunmark(storage, player) {
				player.removeAdditionalSkill("new_luoyan");
			},
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		content() {
			"step 0";
			player
				.chooseCard("he", get.prompt("new_xingwu"), "将一张牌置于武将牌上作为“舞”")
				.set("ai", function (card) {
					if (_status.event.goon) {
						return 20 - get.value(card);
					}
					return 7 - get.value(card);
				})
				.set("goon", player.needsToDiscard() || player.getExpansions("new_xingwu").length > 1);
			"step 1";
			if (result.bool) {
				player.logSkill("new_xingwu");
				var cards = result.cards;
				player.addToExpansion(cards, player, "give").gaintag.add("new_xingwu");
				if (player.hasSkill("new_luoyan")) {
					player.addAdditionalSkill("new_luoyan", ["oltianxiang", "liuli"]);
				}
			} else {
				event.finish();
			}
			"step 2";
			game.delayx();
			var choices = [];
			event.addIndex = 0;
			if (player.getExpansions("new_xingwu").length > 2) {
				choices.push("将三张“星舞”牌置入弃牌堆");
			} else {
				event.addIndex++;
			}
			if (
				player.countCards("h", function (card) {
					return lib.filter.cardDiscardable(card, player, "new_xingwu");
				}) > 1
			) {
				choices.push("弃置两张手牌并将武将牌翻面");
			}
			if (choices.length) {
				player
					.chooseControl("cancel2")
					.set("prompt", "星舞：是否发射核弹？")
					.set("choiceList", choices)
					.set("ai", function () {
						var player = _status.event.player;
						if (player.getExpansions("new_xingwu").length > 2) {
							return 0;
						}
						if (player.isTurnedOver() || player.identity == "fan" || player.getEnemies().length == 1) {
							return 0;
						}
						return "cancel2";
					});
			} else {
				event.finish();
			}
			"step 3";
			if (result.control != "cancel2") {
				var num = result.index + event.addIndex;
				if (num == 1) {
					event.goto(5);
					return;
				}
				if (player.getExpansions("new_xingwu").length > 3) {
					player.chooseButton(["请选择要移去的“星舞”牌", player.getExpansions("new_xingwu")], 3, true);
				} else {
					event._result = {
						bool: true,
						links: player.getExpansions("new_xingwu").slice(0),
					};
				}
			} else {
				event.finish();
			}
			"step 4";
			if (result.bool && result.links && result.links.length == 3) {
				var cards = result.links;
				player.loseToDiscardpile(cards);
				event.goto(6);
			} else {
				event.finish();
			}
			"step 5";
			player.chooseToDiscard(true, "h", 2);
			player.turnOver();
			"step 6";
			player.chooseTarget("请选择【星舞】的目标", "弃置其装备区内的所有牌。然后对其造成2点伤害（目标为女性角色则改为1点）", true, lib.filter.notMe).set("ai", function (target) {
				return (
					-get.attitude(_status.event.player, target) *
					Math.sqrt(
						4 +
							target.countCards("e", function (card) {
								return get.value(card, target) > 0;
							})
					) *
					(target.hasSex("female") ? 1 : 2)
				);
			});
			"step 7";
			if (result.bool && result.targets && result.targets.length) {
				var target = result.targets[0];
				player.line(target, "green");
				var num = target.countCards("e");
				if (num) {
					player.discardPlayerCard(target, "e", num, true);
				}
				target.damage(target.hasSex("female") ? 1 : 2);
			}
		},
		ai: {
			threaten: 1.5,
		},
	},
	new_luoyan: {
		init(player) {
			if (player.getExpansions("new_xingwu").length) {
				player.addAdditionalSkill("new_luoyan", ["oltianxiang", "liuli"]);
			}
		},
		onremove(player) {
			player.removeAdditionalSkill("new_luoyan");
		},
		derivation: ["oltianxiang", "liuli"],
		locked: true,
		ai: {
			combo: "new_xingwu",
		},
	},
	//新孙鲁育
	new_meibu: {
		audio: "meibu",
		trigger: {
			global: "phaseUseBegin",
		},
		filter(event, player) {
			return event.player != player && event.player.isIn() && player.countCards("he") > 0 && event.player.inRange(player);
		},
		direct: true,
		derivation: ["new_zhixi"],
		checkx(event, player) {
			if (get.attitude(player, event.player) >= 0) {
				return false;
			}
			var e2 = player.getEquip(2);
			if (e2) {
				if (e2.name == "tengjia" || e2.name == "rewrite_tengjia") {
					return true;
				}
				if (e2.name == "bagua" || e2.name == "rewrite_bagua") {
					return true;
				}
			}
			return event.player.countCards("h") > event.player.hp;
		},
		content() {
			"step 0";
			var check = lib.skill.new_meibu.checkx(trigger, player);
			player
				.chooseToDiscard(get.prompt2("new_meibu", trigger.player), "he")
				.set("ai", function (card) {
					if (_status.event.check) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("check", check)
				.set("logSkill", ["new_meibu", trigger.player]);
			"step 1";
			if (result.bool) {
				var target = trigger.player;
				var card = result.cards[0];
				player.line(target, "green");
				target.addTempSkills("new_zhixi", "phaseUseAfter");
				if (card.name != "sha" && !(get.type(card, "trick") == "trick" && get.color(card) == "black")) {
					target.addTempSkill("new_meibu_range", "phaseUseAfter");
					target.markAuto("new_meibu_range", player);
				}
				target.markSkillCharacter("new_meibu", player, "魅步", "锁定技，出牌阶段，你至多可使用X张牌，你使用了锦囊牌后不能再使用牌（X为你的体力值）。");
			}
		},
		ai: {
			expose: 0.2,
		},
		subSkill: {
			range: {
				onremove: true,
				charlotte: true,
				mod: {
					globalFrom(from, to, num) {
						if (from.getStorage("new_meibu_range").includes(to)) {
							return -Infinity;
						}
					},
				},
				sub: true,
			},
		},
	},
	new_mumu: {
		audio: "mumu",
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return game.hasPlayer(current => {
				if (current == player) {
					return current.getEquips(2).length > 0;
				}
				return current.countCards("e") > 0;
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("new_mumu"), "弃置一名其他角色装备区内的一张牌，或者获得一名角色装备区内的防具牌", function (card, player, target) {
					if (target == player) {
						return target.getEquips(2).length > 0;
					}
					return target.countCards("e") > 0;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					var att = get.attitude(player, target);
					if (target.getEquip(2) && player.hasEmptySlot(2)) {
						return -2 * att;
					}
					return -att;
				});
			"step 1";
			if (result.bool && result.targets && result.targets.length) {
				event.target = result.targets[0];
				player.logSkill("new_mumu", event.target);
				player.line(event.target, "green");
				var e = event.target.getEquips(2);
				event.e = e;
				if (target == player) {
					event.choice = "获得一张防具牌";
				} else if (e.length > 0) {
					player.chooseControl("弃置一张装备牌", "获得一张防具牌").set("ai", function () {
						if (_status.event.player.getEquips(2).length > 0) {
							return "弃置一张装备牌";
						}
						return "获得一张防具牌";
					});
				} else {
					event.choice = "弃置一张装备牌";
				}
			} else {
				event.finish();
			}
			"step 2";
			var choice = event.choice || result.control;
			if (choice == "弃置一张装备牌") {
				player.discardPlayerCard(event.target, "e", true);
			} else {
				if (event.e) {
					player.gain(event.e, event.target, "give", "bySelf");
					player.addTempSkill("new_mumu_notsha");
				}
			}
		},
		subSkill: {
			notsha: {
				mark: true,
				intro: {
					content: "不能使用或打出【杀】",
				},
				charlotte: true,
				mod: {
					cardEnabled(card) {
						if (card.name == "sha") {
							return false;
						}
					},
					cardRespondable(card) {
						if (card.name == "sha") {
							return false;
						}
					},
				},
			},
		},
	},
	new_zhixi: {
		mod: {
			cardEnabled(card, player) {
				if (player.storage.new_zhixi2 || player.countMark("new_zhixi") >= player.hp) {
					return false;
				}
			},
			cardUsable(card, player) {
				if (player.storage.new_zhixi2 || player.countMark("new_zhixi") >= player.hp) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (player.storage.new_zhixi2 || player.countMark("new_zhixi") >= player.hp) {
					return false;
				}
			},
		},
		trigger: {
			player: "useCard1",
		},
		forced: true,
		popup: false,
		firstDo: true,
		init(player, skill) {
			player.storage[skill] = 0;
			var evt = _status.event.getParent("phaseUse");
			if (evt && evt.player == player) {
				player.getHistory("useCard", function (evtx) {
					if (evtx.getParent("phaseUse") == evt) {
						player.storage[skill]++;
						if (get.type2(evtx.card) == "trick") {
							player.storage.new_zhixi2 = true;
						}
					}
				});
			}
		},
		onremove(player) {
			player.unmarkSkill("new_meibu");
			delete player.storage.new_zhixi;
			delete player.storage.new_zhixi2;
		},
		content() {
			player.addMark("new_zhixi", 1, false);
			if (get.type2(trigger.card) == "trick") {
				player.storage.new_zhixi2 = true;
			}
		},
		ai: {
			presha: true,
			pretao: true,
			neg: true,
			nokeep: true,
		},
	},
	qingzhong: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		check(event, player) {
			if (
				game.hasPlayer(function (current) {
					return current != player && current.isMinHandcard() && get.attitude(player, current) > 0;
				})
			) {
				return true;
			}
			if (player.countCards("h") <= 2) {
				return true;
			}
			// if(player.countCards('h')<=3&&!player.countCards('h','shan')) return true;
			//if(player.countCards('h',{type:'basic'})<=1) return true;
			return false;
		},
		content() {
			player.draw(2);
			player.addTempSkill("qingzhong_give");
		},
		subSkill: {
			give: {
				audio: "qingzhong",
				trigger: { player: "phaseUseEnd" },
				filter(event, player) {
					return !player.isMinHandcard(true);
				},
				forced: true,
				content() {
					"step 0";
					var list = game.filterPlayer(function (current) {
						return current.isMinHandcard();
					});
					if (list.length == 1) {
						if (list[0] != player) {
							player.line(list[0], "green");
							player.swapHandcards(list[0]);
						}
						event.finish();
					} else {
						player
							.chooseTarget(true, "清忠：选择一名手牌最少的角色与其交换手牌", function (card, player, target) {
								return target.isMinHandcard();
							})
							.set("ai", function (target) {
								return get.attitude(_status.event.player, target);
							});
					}
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						if (target != player) {
							player.line(target, "green");
							player.swapHandcards(target);
						}
					}
				},
			},
		},
	},
};
