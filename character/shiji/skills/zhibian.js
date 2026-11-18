import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhibian" | "yuyan" | "qingjue" | "fengjie" | "fengjie2" | "spyilie" | "spfenming">} */
export const groupSkills = {
	//宗预
	zhibian: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		filter(event, player) {
			return game.hasPlayer(current => current != player && player.canCompare(current));
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("zhibian"), "与一名其他角色进行拼点", function (card, player, target) {
					return target != player && player.canCompare(target);
				})
				.set("ai", function (target) {
					if (!_status.event.goon) {
						return false;
					}
					var att = get.attitude(player, target);
					if (
						att < 0 &&
						target.countCards("e", function (card) {
							return player.canEquip(card) && get.effect(player, card, target, player) > 0;
						})
					) {
						return -att / Math.sqrt(target.countCards("h"));
					}
					if (!player.isDamaged()) {
						return false;
					}
					if (att <= 0) {
						return (1 - att) / Math.sqrt(target.countCards("h"));
					}
					return Math.sqrt((2 / att) * Math.sqrt(target.countCards("h")));
				})
				.set(
					"goon",
					(function () {
						if (
							!player.hasCard(function (card) {
								return card.number >= 14 - player.hp && get.value(card) <= 5;
							})
						) {
							return false;
						}
						return true;
					})()
				);
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("zhibian", target);
				player.chooseToCompare(target);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var list = [],
					list2 = ["将" + get.translation(target) + "装备区/判定区中的一张牌移动到你的区域内", "回复1点体力", "背水！跳过摸牌阶段，并依次执行上述所有选项"];
				if (
					target.hasCard(function (card) {
						return player.canEquip(card);
					}, "e") ||
					target.hasCard(function (card) {
						return player.canAddJudge(card);
					}, "j")
				) {
					list.push("选项一");
				}
				if (player.isDamaged()) {
					list.push("选项二");
				}
				if (list.includes("选项一")) {
					list.push("背水！");
				}
				list.push("cancel2");
				player
					.chooseControl(list)
					.set("choiceList", list2)
					.set(
						"resultx",
						(() => {
							if (!player.isDamaged()) {
								return 0;
							}
							if (player.hp <= 2) {
								return 1;
							}
							if (
								target.countCards("e", card => {
									return player.canEquip(card) && get.value(card, target) >= 4 + player.getDamagedHp();
								})
							) {
								return 1;
							}
							return 0;
						})()
					)
					.set("ai", () => {
						return get.event().resultx;
					});
			} else {
				player.loseHp();
				event.finish();
			}
			"step 3";
			if (result.control != "cancel2") {
				event.control = result.control;
				if (result.control == "选项一" || result.control == "背水！") {
					player.choosePlayerCard(target, "ej", true).set("ai", get.buttonValue);
				} else {
					event.goto(5);
				}
			} else {
				event.finish();
			}
			"step 4";
			if (result.bool) {
				var card = result.cards[0];
				target.$give(card, player, false);
				game.delayx();
				if (get.position(card) == "e") {
					player.equip(card);
				} else {
					player.addJudge(card);
				}
			}
			"step 5";
			if (event.control == "选项二" || event.control == "背水！") {
				player.recover();
			}
			if (event.control == "背水！") {
				player.skip("phaseDraw");
			}
		},
	},
	yuyan: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		forced: true,
		logTarget: "player",
		filter(event, player) {
			return event.card.name == "sha" && event.card.isCard && typeof get.number(event.card) == "number" && player.hp < event.player.hp;
		},
		content() {
			"step 0";
			var num = get.number(trigger.card);
			if (
				num >= 13 ||
				!trigger.player.hasCard(function (card) {
					if (_status.connectMode && get.position(card) == "h") {
						return true;
					}
					return get.number(card) > num;
				}, "he")
			) {
				event._result = { bool: false };
			} else {
				trigger.player
					.chooseCard(
						"he",
						function (card) {
							return get.number(card) > _status.event.number;
						},
						"交给" + get.translation(player) + "一张点数大于" + get.cnNumber(num) + "的牌，或令" + get.translation(trigger.card) + "对其无效"
					)
					.set("number", num)
					.set("", function (card) {
						if (card.name == "shan" || card.name == "tao" || card.name == "jiu") {
							return false;
						}
						return 6 - get.value(card);
					});
			}
			"step 1";
			if (result.bool) {
				trigger.player.give(result.cards, player);
			} else {
				trigger.targets.remove(player);
				trigger.getParent().triggeredTargets2.remove(player);
				trigger.untrigger();
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (card.name == "sha" && player.hp > target.hp && get.attitude(player, target) < 0) {
						var num = get.number(card);
						if (typeof num != "number") {
							return false;
						}
						var bs = player.getCards("h", function (cardx) {
							return get.number(cardx) > num && !["", "", ""].includes(cardx.name);
						});
						if (bs.length < 2) {
							return 0;
						}
						if (player.hasSkill("jiu") || player.hasSkill("tianxianjiu")) {
							return;
						}
						if (bs.length <= 2) {
							for (var i = 0; i < bs.length; i++) {
								if (get.value(bs[i]) < 6) {
									return [1, 0, 1, -0.5];
								}
							}
							return 0;
						}
						return [1, 0, 1, -0.5];
					}
				},
			},
		},
	},
	//袁涣
	qingjue: {
		audio: 2,
		trigger: { global: "useCardToPlayer" },
		logTarget: "player",
		round: 1,
		filter(event, player) {
			return event.player != player && event.target != player && event.player != event.target && event.player.hp > event.target.hp && event.targets.length == 1 && event.player.countCards("h") > 0 && !event.target.isDying() && !event.player.hasSkillTag("noCompareTarget") && !player.hasSkillTag("noCompareSource");
		},
		check(event, player) {
			var target = event.target,
				source = event.player;
			var eff1 = get.effect(target, event.card, source, player);
			if (eff1 >= 0) {
				return false;
			}
			var eff2 = get.effect(player, event.card, source, player);
			if (eff2 >= 0) {
				return true;
			}
			if (eff2 > eff1 / 3) {
				return player.hasCard(function (card) {
					return (card.number >= 9 && get.value(card) <= 5) || get.value(card) <= 3;
				});
			}
			if (eff2 > eff1 / 2) {
				return player.hasCard(function (card) {
					return card.number > 10 && get.value(card) <= 5;
				});
			}
			return player.hasCard(function (card) {
				return card.number > 11 && get.value(card) <= 5;
			});
		},
		content() {
			"step 0";
			player.draw();
			"step 1";
			if (player.canCompare(trigger.player)) {
				player.chooseToCompare(trigger.player);
			} else {
				event.finish();
			}
			"step 2";
			trigger.targets.remove(trigger.target);
			trigger.getParent().triggeredTargets1.remove(trigger.target);
			trigger.untrigger();
			if (!result.bool) {
				trigger.targets.push(player);
			}
		},
	},
	fengjie: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		content() {
			"step 0";
			player.chooseTarget("请选择【奉节】的目标", "选择一名其他角色并获得如下效果直到你下回合开始：一名角色的结束阶段开始时，你将手牌摸至（至多摸至四张）或弃置至与其体力值相等。", lib.filter.notMe, true).set("ai", function (target) {
				return (target.hp - player.countCards("h")) / get.threaten(target);
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "green");
				game.log(player, "选择了", target);
				player.storage.fengjie2 = target;
				player.addTempSkill("fengjie2", { player: "phaseBegin" });
				game.delayx();
			}
		},
	},
	fengjie2: {
		audio: "fengjie",
		trigger: { global: "phaseJieshuBegin" },
		forced: true,
		charlotte: true,
		onremove: true,
		sourceSkill: "fengjie",
		filter(event, player) {
			if (!player.storage.fengjie2 || !player.storage.fengjie2.isIn()) {
				return false;
			}
			var num1 = player.countCards("h"),
				num2 = player.storage.fengjie2.hp;
			return num1 != num2;
		},
		logTarget: (event, player) => player.storage.fengjie2,
		content() {
			var num1 = player.countCards("h"),
				num2 = player.storage.fengjie2.hp;
			if (num1 > num2) {
				player.chooseToDiscard("h", true, num1 - num2, "allowChooseAll");
			} else {
				player.drawTo(Math.min(4, num2));
			}
		},
	},
	//陈武董袭
	spyilie: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		content() {
			"step 0";
			player
				.chooseControl("选项一", "选项二", "背水！", "cancel2")
				.set("choiceList", ["本阶段内使用【杀】的次数上限+1", "本回合内使用【杀】被【闪】抵消时摸一张牌", "背水！失去1点体力并依次执行上述所有选项"])
				.set("ai", function () {
					if (
						player.countCards("hs", function (card) {
							return get.name(card) == "sha" && player.hasValueTarget(card);
						}) > player.getCardUsable({ name: "sha" })
					) {
						return 0;
					}
					return 1;
				});
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("spyilie");
				game.log(player, "选择了", "#g【毅烈】", "的", "#y" + result.control);
				if (result.index % 2 == 0) {
					player.addTempSkill("spyilie_add", "phaseUseEnd");
				}
				if (result.index > 0) {
					player.addTempSkill("spyilie_miss");
				}
				if (result.index == 2) {
					player.loseHp();
				}
			}
		},
		subSkill: {
			add: {
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + 1;
						}
					},
				},
			},
			miss: {
				charlotte: true,
				audio: "spyilie",
				trigger: { player: "shaMiss" },
				forced: true,
				content() {
					player.draw();
				},
			},
		},
	},
	spfenming: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter: (event, player) => game.hasPlayer(current => lib.skill.spfenming.filterTarget(null, player, current)),
		filterTarget(card, player, target) {
			if (target.hp > player.hp) {
				return false;
			}
			return (
				!target.isLinked() ||
				target.hasCard(
					function (card) {
						return lib.filter.canBeGained(card, player, target);
					},
					target == player ? "e" : "he"
				)
			);
		},
		content() {
			if (!target.isLinked()) {
				target.link();
			} else {
				player.gainPlayerCard(target, target == player ? "e" : "he", true);
			}
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					if (!target.isLinked()) {
						return get.effect(target, { name: "tiesuo" }, player, player);
					}
					return get.effect(target, { name: "shunshou_copy2" }, player, player);
				},
			},
		},
	},
};
