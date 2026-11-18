import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olgoude" | "oljici">} */
export const groupSkills = {
	//OL孟达
	olgoude: {
		audio: 2,
		trigger: {
			global: "phaseEnd",
		},
		filter(event, player) {
			var list = [];
			game.countPlayer(current => {
				if (current.group != player.group) {
					return false;
				}
				var listx = lib.skill.olgoude.getActed(current);
				list.addArray(listx);
			});
			return list.length && list.length < 4;
		},
		getActed(target) {
			var list = [];
			if (
				target.hasHistory("gain", evt => {
					return evt.getParent().name == "draw" && evt.cards.length == 1;
				})
			) {
				list.push(1);
			}
			if (
				game.hasPlayer2(current => {
					return current.hasHistory("lose", evt => {
						if (evt.type != "discard") {
							return false;
						}
						if ((evt.discarder || evt.getParent(2).player) != target) {
							return false;
						}
						var evtx = evt.getl(current);
						if (!evtx || evtx.hs.length != 1) {
							return false;
						}
						return true;
					});
				})
			) {
				list.push(2);
			}
			if (
				target.hasHistory("useCard", evt => {
					if (evt.card.name == "sha" && evt.cards && !evt.cards.length) {
						return true;
					}
					return false;
				})
			) {
				list.push(3);
			}
			if (
				target.hasHistory("custom", evt => {
					return evt.name == "changeGroup";
				})
			) {
				list.push(4);
			}
			return list;
		},
		direct: true,
		content() {
			"step 0";
			var list = [1, 2, 3, 4];
			game.countPlayer(current => {
				if (current.group != player.group) {
					return false;
				}
				var listx = lib.skill.olgoude.getActed(current);
				list.removeArray(listx);
			});
			var list2 = list.slice();
			var nochai = false,
				nosha = false;
			if (
				!game.hasPlayer(current => {
					return current.countDiscardableCards(player, "h");
				})
			) {
				nochai = true;
				list2.remove(2);
			}
			if (
				!game.hasPlayer(current => {
					return player.canUse({ name: "sha", isCard: true }, current, true, false);
				})
			) {
				nosha = true;
				list2.remove(3);
			}
			var choices = list2.map(i => {
				return "选项" + get.cnNumber(i, true);
			});
			var choiceList = ["摸一张牌", "弃置一名角色的一张手牌", "视为使用一张【杀】", "将势力改为任意一个势力"].map((text, ind) => {
				var hint = "";
				if (list2.includes(ind + 1)) {
					return text;
				} else if (!list.includes(ind + 1)) {
					hint += "已被执行过且";
				}
				if (ind == 1 && nochai && !list2.includes(ind + 1)) {
					hint += "无有手牌角色且";
				}
				if (ind == 2 && nosha && !list2.includes(ind + 1)) {
					hint += "无可选目标且";
				}
				hint = hint.slice(0, -1);
				return '<span style="opacity:0.5">' + text + "（" + hint + "）</span>";
			});
			choices.push("cancel2");
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			player
				.chooseControl(choices)
				.set("choiceList", choiceList)
				.set("prompt", get.prompt("olgoude"))
				.set("ai", () => {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						var fn = function (control) {
							switch (control) {
								case "选项一":
									return player.getUseValue({ name: "draw" });
								case "选项二":
									return Math.max.apply(
										Math,
										game.filterPlayer().map(current => {
											if (current.hasSkillTag("noh")) {
												return -1;
											}
											return -1.5 * get.attitude(player, current) - Math.max(0, current.countCards("h") - 2) / 3;
										})
									);
								case "选项三":
									return player.getUseValue({ name: "sha" });
								case "选项四":
									var myPopulation =
										game.countPlayer(current => {
											return current.group == player.group;
										}) - 1;
									var value = Math.max.apply(
										Math,
										lib.group.map(group => {
											return (
												game.countPlayer(current => {
													return current.group == group && current != player;
												}) - myPopulation
											);
										})
									);
									return 10 * value + 0.1 * (Math.random() - 0.5);
								case "cancel2":
									return 0;
							}
						};
						var choicesx = choices.map(choice => {
							return [choice, fn(choice)];
						});
						choicesx = choicesx.sort((a, b) => {
							return b[1] - a[1];
						});
						var choice = choicesx[0];
						if (choice[1] < 0) {
							return "cancel2";
						}
						return choice[0];
					})()
				);
			"step 1";
			if (result.control == "cancel2") {
				event.finish();
				return;
			}
			var contents = {
				选项一() {
					player.logSkill("olgoude");
					player.draw();
				},
				选项二() {
					"step 0";
					player
						.chooseTarget("苟得：弃置一名角色的一张手牌", true, (card, player, target) => {
							return target.countDiscardableCards(player, "h");
						})
						.set("ai", target => {
							if (target.hasSkillTag("noh")) {
								return 0;
							}
							return -get.attitude(_status.event.player, target);
						});
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						if (_status.connectMode) {
							game.broadcastAll(function () {
								delete _status.noclearcountdown;
								game.stopCountChoose();
							});
						}
						player.logSkill("olgoude", target);
						player.discardPlayerCard(target, true, "h");
					}
				},
				选项三() {
					player.chooseUseTarget("sha", true, false).set("logSkill", "olgoude").set("prompt", "苟得：选择【杀】的目标");
				},
				选项四() {
					"step 0";
					var list = lib.group.slice();
					var maxGroup = list.slice().sort((a, b) => {
						return (
							game.countPlayer(current => {
								return current.group == b && current != player;
							}) -
							game.countPlayer(current => {
								return current.group == a && current != player;
							})
						);
					})[0];
					player
						.chooseControl(list)
						.set("prompt", "苟得：请选择要变更为的势力")
						.set("ai", () => {
							return _status.event.choice;
						})
						.set("choice", maxGroup);
					"step 1";
					if (_status.connectMode) {
						game.broadcastAll(function () {
							delete _status.noclearcountdown;
							game.stopCountChoose();
						});
					}
					var group = result.control;
					player.logSkill("olgoude");
					player.changeGroup(group);
					player.popup(group + "2", get.groupnature(group, "raw"));
				},
			};
			var next = game.createEvent("olgoude_" + result.control);
			next.player = player;
			next.setContent(contents[result.control]);
		},
		ai: {
			threaten: 3,
			effect: {
				player_use(card, player, target) {
					if (
						typeof card == "object" &&
						card.cards &&
						card.cards.some(card => {
							return get.position(card) == "h";
						}) &&
						!get.tag(card, "draw") &&
						!get.tag(card, "gain") &&
						!get.tag(card, "discard") &&
						player == _status.currentPhase &&
						player.needsToDiscard() == 1 &&
						game.countPlayer(current => {
							return current.group == player.group && current != player;
						}) <= 1 &&
						lib.group.some(group => {
							return (
								game.countPlayer(current => {
									return current.group == group && current != player;
								}) > 2
							);
						})
					) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	//OL新改王朗
	oljici: {
		audio: "jici",
		trigger: {
			player: "compare",
			target: "compare",
		},
		filter(event, player) {
			if (event.player == player) {
				if (event.iwhile) {
					return false;
				}
				return event.num1 <= player.countMark("gushe");
			}
			return event.num2 <= player.countMark("gushe");
		},
		content() {
			var num = player.countMark("gushe");
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
			var stat = player.getStat().skill;
			delete stat.gushe;
		},
		ai: {
			combo: "gushe",
		},
	},
};
