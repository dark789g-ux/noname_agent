import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twyujue_give" | "twgezhi" | "twfengqi">} */
export const groupSkills = {
	twyujue_give: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (!player.countCards("he")) {
				return false;
			}
			var targets = game.filterPlayer(function (current) {
				return current != player && current.hasSkill("twyujue");
			});
			if (!targets.length) {
				return false;
			}
			for (var target of targets) {
				var num = 2;
				if (player.group == "qun" && target.hasZhuSkill("twfengqi", player)) {
					num = 4;
				}
				if (target.countMark("twyujue_clear") < num) {
					return true;
				}
			}
			return false;
		},
		selectCard() {
			var player = _status.event.player;
			var targets = game.filterPlayer(function (current) {
				return current != player && current.hasSkill("twyujue");
			});
			return [
				1,
				Math.max.apply(
					Math,
					targets.map(function (target) {
						var num = 2;
						if (player.group == "qun" && target.hasZhuSkill("twfengqi", player)) {
							num = 4;
						}
						return num - target.countMark("twyujue_clear");
					})
				),
			];
		},
		filterCard: true,
		filterTarget(card, player, target) {
			if (!target.hasSkill("twyujue")) {
				return false;
			}
			var num = 2;
			if (player.group == "qun" && target.hasZhuSkill("twfengqi", player)) {
				num = 4;
			}
			return num - target.countMark("twyujue_clear") >= Math.max(1, ui.selected.cards.length);
		},
		selectTarget() {
			var player = _status.event.player;
			var targets = game.filterPlayer(function (current) {
				return current != player && current.hasSkill("twyujue");
			});
			return targets.length > 1 ? 1 : -1;
		},
		complexSelect: true,
		prompt() {
			var player = _status.event.player;
			var targets = game.filterPlayer(function (current) {
				return current != player && current.hasSkill("twyujue");
			});
			return "将任意张牌交给" + get.translation(targets) + (targets.length > 1 ? "中的一人" : "");
		},
		position: "he",
		discard: false,
		lose: false,
		delay: false,
		check(card) {
			if (ui.selected.cards.length) {
				return 0;
			}
			var player = _status.event.player;
			if (
				game.hasPlayer(function (current) {
					return lib.skill.twyujue_give.filterTarget(null, player, current) && get.attitude(player, current) > 0;
				})
			) {
				var val = get.value(card);
				if (val <= 0 && get.position(card) == "e") {
					return 100 - val;
				}
				if (
					!player.hasSkill("twyujue_effect1") &&
					player.hasCard(function (cardx) {
						return cardx != card && player.getUseValue(cardx, null, true) > 0;
					}, "hs")
				) {
					return 6 - get.value(card);
				}
				if (
					!player.hasSkill("twyujue_effect0") &&
					game.hasPlayer(function (current) {
						return (
							player.inRange(current) &&
							current.countDiscardableCards(player, "he") > 0 &&
							get.effect(current, { name: "guohe_copy2" }, player, player) > 0
						);
					})
				) {
					return 5.5 - get.value(card);
				}
			}
			return 0;
		},
		content() {
			game.trySkillAudio("twyujue", target);
			player.give(cards, target);
			target.addTempSkill("twyujue_clear");
			target.addMark("twyujue_clear", cards.length, false);
		},
		ai: {
			order: 10,
			result: { target: 1 },
		},
	},
	twgezhi: {
		audio: 2,
		trigger: { player: "useCard" },
		direct: true,
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != player) {
				return false;
			}
			var type = get.type2(event.card, false);
			return !player.hasHistory(
				"useCard",
				function (evtx) {
					return evtx != event && get.type2(evtx.card, false) == type && evtx.getParent("phaseUse") == evt;
				},
				event
			);
		},
		content() {
			"step 0";
			if (!event.isMine() && !event.isOnline()) {
				game.delayx();
			}
			player.chooseCard("是否发动【革制】重铸一张牌？", lib.filter.cardRecastable).set("ai", function (card) {
				return 5.5 - get.value(card);
			});
			"step 1";
			if (result.bool) {
				player.logSkill("twgezhi");
				player.recast(result.cards);
			}
		},
		group: "twgezhi_buff",
		subSkill: {
			buff: {
				audio: "twgezhi",
				trigger: { player: "phaseUseEnd" },
				direct: true,
				filter(event, player) {
					return (
						player.getHistory("lose", function (evt) {
							return evt.getParent(3).name == "twgezhi" && evt.getParent("phaseUse") == event;
						}).length > 1
					);
				},
				content() {
					"step 0";
					player
						.chooseTarget(
							get.prompt("twgezhi"),
							"你可以令一名角色选择获得一个其未获得过的效果：⒈攻击范围+2；⒉手牌上限+2；⒊加1点体力上限。",
							function (card, player, target) {
								return !target.hasSkill("twgezhi_选项一") || !target.hasSkill("twgezhi_选项二") || !target.hasSkill("twgezhi_选项三");
							}
						)
						.set("ai", function (target) {
							return get.attitude(_status.event.player, target);
						});
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						event.target = target;
						player.logSkill("twgezhi", target);
						var list = [];
						for (var i = 1; i <= 3; i++) {
							var str = "选项" + get.cnNumber(i, true);
							if (!target.hasSkill("twgezhi_" + str)) {
								list.push(str);
							}
						}
						if (list.length == 1) {
							event._result = { control: list[0] };
						} else {
							target
								.chooseControl(list)
								.set("choiceList", ["令自己的攻击范围+2", "令自己的手牌上限+2", "令自己的体力上限+1"])
								.set("ai", function () {
									var player = _status.event.player,
										controls = _status.event.controls;
									if (
										controls.includes("选项一") &&
										game.hasPlayer(function (current) {
											return (
												(get.realAttitude || get.attitude)(player, current) < 0 && get.distance(player, current, "attack") > 1
											);
										})
									) {
										return "选项一";
									}
									if (controls.includes("选项二") && player.needsToDiscard()) {
										return "选项二";
									}
									if (controls.includes("选项三")) {
										return "选项三";
									}
									return controls.randomGet();
								});
						}
					} else {
						event._triggered = null;
						event.finish();
					}
					"step 2";
					target.addSkill("twgezhi_" + result.control);
					if (result.control == "选项三") {
						target.gainMaxHp();
					}
					"step 3";
					game.delayx();
				},
			},
			选项一: {
				charlotte: true,
				mod: {
					attackFrom(from, to, distance) {
						return distance - 2;
					},
				},
				mark: true,
				marktext: " +2 ",
				intro: { content: "攻击范围+2" },
			},
			选项二: {
				charlotte: true,
				mod: {
					maxHandcard(player, num) {
						return num + 2;
					},
				},
				mark: true,
				marktext: " +2 ",
				intro: { content: "手牌上限+2" },
			},
			选项三: {
				charlotte: true,
				mark: true,
				marktext: " +1 ",
				intro: { content: "体力上限+1" },
			},
		},
	},
	twfengqi: {
		locked: true,
		zhuSkill: true,
		trigger: { player: "twgezhi_buffAfter" },
		direct: true,
		filter(event, player) {
			if (!event.target || !event.target.isIn() || !player.hasZhuSkill("twfengqi", event.target)) {
				return false;
			}
			var target = event.target;
			return target.getStockSkills(true, true).some(skill => {
				if (target.hasSkill(skill)) {
					return false;
				}
				var info = get.info(skill);
				return info && info.zhuSkill;
			});
		},
		skillAnimation: true,
		animationColor: "thunder",
		content() {
			"step 0";
			event.target = trigger.target;
			event.target.chooseBool(get.prompt("twfengqi"), "获得武将牌上的所有主公技");
			"step 1";
			if (result.bool) {
				target.logSkill("twfengqi", player);
				var skills = target.getStockSkills(true, true).filter(skill => {
					if (target.hasSkill(skill)) {
						return false;
					}
					var info = get.info(skill);
					return info && info.zhuSkill;
				});
				target.addSkills(skills);
				//for(var i of skills) target.addSkillLog(i);
			}
		},
		ai: {
			combo: "twyujue",
		},
	},
};
