import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twfujian" | "twjianwei" | "twtanfeng">} */
export const groupSkills = {
	//夏侯恩
	twfujian: {
		audio: 2,
		group: "twfujian_lose",
		trigger: {
			global: "phaseBefore",
			player: ["enterGame", "phaseZhunbeiBegin"],
		},
		filter(event, player) {
			if (player.getEquips(1).length) {
				return false;
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		content() {
			var card = get.cardPile2(function (card) {
				return get.type(card) == "equip" && get.subtype(card) == "equip1";
			}, "random");
			event.card = card;
			if (card) {
				player.equip(card);
			} else {
				game.log("但是牌堆中没有武器牌了！");
				event.finish();
			}
		},
		subSkill: {
			lose: {
				audio: "twfujian",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (player == _status.currentPhase) {
						return false;
					}
					if (event.name == "gain" && event.player == player) {
						return false;
					}
					var evt = event.getl(player);
					if (evt && evt.cards2 && evt.cards2.some(i => get.subtype(i) == "equip1")) {
						return true;
					}
					return false;
				},
				forced: true,
				content() {
					player.loseHp();
				},
			},
		},
	},
	twjianwei: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			if (!player.getEquips(1).length) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return player.inRange(current) && player.canCompare(current);
			});
		},
		pindianCheck(player, target) {
			var hs = player.getCards("h").sort(function (a, b) {
				return b.number - a.number;
			});
			var ts = target.getCards("h").sort(function (a, b) {
				return b.number - a.number;
			});
			if (!hs.length || !ts.length) {
				return 0;
			}
			if (
				Math.min(13, hs[0].number + player.getAttackRange()) > ts[0].number ||
				(ts[0].number > 9 && get.value(ts[0]) <= 5) ||
				target.countCards("j")
			) {
				return true;
			}
			return false;
		},
		direct: true,
		locked: false,
		group: ["twjianwei_pindian", "twjianwei_zhaocha"],
		content() {
			"step 0";
			player
				.chooseTarget(
					get.prompt("twjianwei"),
					"与攻击范围内的一名角色拼点。若你赢，你获得其每个区域里的一张牌；若其赢，其获得你装备区里的武器牌",
					function (card, player, target) {
						return player.inRange(target) && player.canCompare(target);
					}
				)
				.set("ai", function (target) {
					var player = _status.event.player;
					if (lib.skill.twjianwei.pindianCheck(player, target)) {
						return -5 * get.attitude(player, target);
					}
					return -get.attitude(player, target);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twjianwei", target);
				player.chooseToCompare(target);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var num = 0;
				if (target.countCards("h")) {
					num++;
				}
				if (target.countCards("e")) {
					num++;
				}
				if (target.countCards("j")) {
					num++;
				}
				if (num) {
					player.gainPlayerCard(target, num, "hej", true).set("filterButton", function (button) {
						for (var i = 0; i < ui.selected.buttons.length; i++) {
							if (get.position(button.link) == get.position(ui.selected.buttons[i].link)) {
								return false;
							}
						}
						return true;
					});
				}
			} else if (!result.tie) {
				var card = player.getEquips(1);
				if (card.length) {
					target.gain(card, player, "give");
				}
			}
		},
		mod: {
			aiValue(player, card, num) {
				if (card.name == "qinggang" || card.name == "qibaodao") {
					return num / 5;
				}
			},
		},
		ai: {
			unequip: true,
			unequip_ai: true,
			skillTagFilter(player, tag, arg) {
				if (!arg || !arg.card || arg.card.name != "sha" || !player.getEquip(1)) {
					return false;
				}
			},
		},
		subSkill: {
			pindian: {
				audio: "twjianwei",
				trigger: { player: "compare", target: "compare" },
				filter(event, player) {
					if (!player.getEquips(1).length || player.getAttackRange() <= 0) {
						return false;
					}
					if (event.player == player) {
						return !event.iwhile;
					}
					return true;
				},
				forced: true,
				locked: false,
				content() {
					var num = player.getAttackRange();
					if (player == trigger.player) {
						trigger.num1 += num;
						if (trigger.num1 > 13) {
							trigger.num1 = 13;
						}
					} else {
						trigger.num2 += num;
						if (trigger.num2 > 13) {
							trigger.num2 = 13;
						}
					}
					game.log(player, "的拼点牌点数+" + num);
				},
			},
			//你是故意找茬是不是
			zhaocha: {
				trigger: { global: "phaseZhunbeiBegin" },
				filter(event, player) {
					if (event.player == player) {
						return false;
					}
					return event.player.canCompare(player);
				},
				direct: true,
				content() {
					"step 0";
					trigger.player
						.chooseBool(
							"剑威：是否与" + get.translation(player) + "拼点？",
							"若你赢，你获得其装备区里的武器牌；若其赢，其获得你每个区域里的一张牌"
						)
						.set("ai", () => _status.event.choice)
						.set("choice", get.attitude(trigger.player, player) < 0 && !lib.skill.twjianwei.pindianCheck(player, trigger.player));
					"step 1";
					if (result.bool) {
						trigger.player.logSkill("twjianwei", player);
						trigger.player.chooseToCompare(player);
					} else {
						event.finish();
					}
					"step 2";
					if (!result.tie) {
						if (result.bool) {
							var card = player.getEquips(1);
							if (card.length) {
								trigger.player.gain(card, player, "give");
							}
						} else {
							var num = 0;
							if (trigger.player.countCards("h")) {
								num++;
							}
							if (trigger.player.countCards("e")) {
								num++;
							}
							if (trigger.player.countCards("j")) {
								num++;
							}
							if (num) {
								player.gainPlayerCard(trigger.player, num, "hej", true).set("filterButton", function (button) {
									for (var i = 0; i < ui.selected.buttons.length; i++) {
										if (get.position(button.link) == get.position(ui.selected.buttons[i].link)) {
											return false;
										}
									}
									return true;
								});
							}
						}
					}
				},
			},
		},
	},
	//夏侯尚
	twtanfeng: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && current.countDiscardableCards(player, "hej") > 0;
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("twtanfeng"), function (card, player, target) {
					return target != player && target.countDiscardableCards(player, "hej") > 0;
				})
				.set("ai", function (target) {
					var player = _status.event.player,
						num = 1;
					if (get.attitude(player, target) > 0) {
						num = 3;
					} else if (!target.countCards("he") || !target.canUse("sha", player)) {
						if (target.hp + target.countCards("hs", { name: ["tao", "jiu"] }) <= 1) {
							num = 2;
						} else {
							num = 1.2;
						}
					}
					return (
						get.effect(target, { name: "guohe" }, player, player) * num * (player.hp <= 1 && get.attitude(player, target) <= 0 ? 0 : 1)
					);
				})
				.setHiddenSkill(event.name);
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twtanfeng", target);
				player.discardPlayerCard(target, "hej", true);
			} else {
				event.finish();
			}
			"step 2";
			target.chooseCardTarget({
				position: "hes",
				prompt: "选择一张牌当做【杀】对" + get.translation(player) + "使用",
				prompt2: "或点击“取消”，受到其造成的1点火焰伤害，并令其跳过本回合的一个阶段（准备阶段和结束阶段除外）",
				filterCard(card, player) {
					return player.canUse(get.autoViewAs({ name: "sha" }, [card]), _status.event.getParent().player, false);
				},
				filterTarget(card, player, target) {
					var source = _status.event.getParent().player;
					if (target != source && !ui.selected.targets.includes(source)) {
						return false;
					}
					card = get.autoViewAs({ name: "sha" }, [card]);
					return lib.filter.filterTarget.apply(this, arguments);
				},
				selectTarget() {
					var card = get.card(),
						player = get.player();
					if (!card) {
						return;
					}
					card = get.autoViewAs({ name: "sha" }, [card]);
					var range = [1, 1];
					game.checkMod(card, player, range, "selectTarget", player);
					return range;
				},
				ai1(card) {
					var player = _status.event.player,
						target = _status.event.getParent().player;
					var eff = get.effect(target, get.autoViewAs({ name: "sha" }, [card]), player, player);
					var eff2 = get.damageEffect(player, target, player, "fire");
					if (eff < 0 || eff2 > 0 || eff2 > eff || get.tag(card, "recover")) {
						return 0;
					}
					return (player.hp == 1 ? 10 : 6) - get.value(card);
				},
				ai2(target) {
					if (target == _status.event.getParent().player) {
						return 100;
					}
					return get.effect(target, { name: "sha" }, _status.event.player);
				},
			});
			"step 3";
			if (result.bool) {
				var cards = result.cards,
					targets = result.targets;
				var cardx = get.autoViewAs({ name: "sha" }, cards);
				target.useCard(cardx, cards, targets, false);
				event.finish();
			} else {
				player.line(target, "fire");
				target.damage(1, "fire");
			}
			"step 4";
			if (!target.isIn()) {
				event.finish();
				return;
			}
			var list = [];
			var list2 = [];
			event.map = {
				phaseJudge: "判定阶段",
				phaseDraw: "摸牌阶段",
				phaseUse: "出牌阶段",
				phaseDiscard: "弃牌阶段",
			};
			for (var i of ["phaseJudge", "phaseDraw", "phaseUse", "phaseDiscard"]) {
				if (!player.skipList.includes(i)) {
					i = event.map[i];
					list.push(i);
					if (i != "判定阶段" && i != "弃牌阶段") {
						list2.push(i);
					}
				}
			}
			target
				.chooseControl(list)
				.set("prompt", "探锋：令" + get.translation(player) + "跳过一个阶段")
				.set("ai", function () {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						var att = get.attitude(target, player);
						var num = player.countCards("j");
						if (att > 0) {
							if (list.includes("判定阶段") && num > 0) {
								return "判定阶段";
							}
							return "弃牌阶段";
						}
						if (list.includes("摸牌阶段") && player.hasJudge("lebu")) {
							return "摸牌阶段";
						}
						if ((list.includes("出牌阶段") && player.hasJudge("bingliang")) || player.needsToDiscard() > 0) {
							return "出牌阶段";
						}
						return list2.randomGet();
					})()
				);
			"step 5";
			for (var i in event.map) {
				if (event.map[i] == result.control) {
					player.skip(i);
				}
			}
			target.popup(result.control);
			target.line(player);
			game.log(player, "跳过了", "#y" + result.control);
		},
	},
};
