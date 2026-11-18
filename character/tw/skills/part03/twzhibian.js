import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twzhibian" | "twyuyan">} */
export const groupSkills = {
	//宗预
	twzhibian: {
		audio: "zhibian",
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return game.hasPlayer(current => current != player && player.canCompare(current));
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("twzhibian"), "与一名其他角色拼点", function (card, player, target) {
					return target != player && player.canCompare(target);
				})
				.set("ai", function (target) {
					if (!_status.event.goon) {
						return false;
					}
					var att = get.attitude(player, target);
					if (
						att < 0 &&
						(target.countCards("h") > 1 ||
							target.countCards("e", function (card) {
								return player.canEquip(card) && get.effect(player, card, target, player) > 0;
							}))
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
				player.logSkill("twzhibian", target);
				player.chooseToCompare(target);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var list = [],
					list2 = [
						"将" + get.translation(target) + "区域中的一张牌移动到你的区域内",
						"回复1点体力",
						"背水！弃置一张非基本牌，并依次执行上述所有选项",
					];
				if (
					target.countCards("h") ||
					target.hasCard(function (card) {
						return player.canEquip(card);
					}, "e") ||
					target.hasCard(function (card) {
						return player.canAddJudge(card);
					}, "j")
				) {
					list.push("选项一");
				} else {
					list2[0] = '<span style="opacity:0.5">' + list2[0] + "</span>";
				}
				if (player.isDamaged()) {
					list.push("选项二");
				} else {
					list2[1] = '<span style="opacity:0.5">' + list2[1] + "</span>";
				}
				if (!list.length) {
					event.finish();
					return;
				}
				if (player.countCards("he", card => get.type(card) != "basic")) {
					list.push("背水！");
				} else {
					list2[2] = '<span style="opacity:0.5">' + list2[2] + "</span>";
				}
				list.push("cancel2");
				player
					.chooseControl(list)
					.set("prompt", "直辩：选择一项")
					.set("choiceList", list2)
					.set("ai", function () {
						var target = _status.event.getParent().target;
						if (
							_status.event.controls.includes("背水！") &&
							player.isDamaged() &&
							(target.countCards("h") ||
								target.countCards("e", function (card) {
									return player.canEquip(card) && get.value(card, target) >= 4 + player.getDamagedHp();
								}))
						) {
							return 2;
						}
						if (
							player.isDamaged() &&
							(player.hp <= 2 ||
								(!target.countCards("h") &&
									!target.countCards("e", function (card) {
										return player.canEquip(card) && get.value(card, target) >= 4 + player.getDamagedHp();
									})))
						) {
							return 1;
						}
						return 0;
					});
			} else {
				player.loseHp();
				event.finish();
			}
			"step 3";
			if (result.control != "cancel2") {
				event.control = result.control;
				if (
					result.control == "背水！" &&
					player.countCards("he", function (card) {
						return get.type(card) != "basic";
					})
				) {
					player.chooseToDiscard("he", true, function (card) {
						return get.type(card) != "basic";
					});
				}
			} else {
				event.finish();
			}
			"step 4";
			if (event.control == "选项一" || event.control == "背水！") {
				player.choosePlayerCard(target, "hej", true).set("ai", get.buttonValue);
			} else {
				event.goto(6);
			}
			"step 5";
			if (result.bool) {
				var card = result.cards[0];
				switch (get.position(card)) {
					case "h":
						player.gain(card, target, "giveAuto");
						break;
					case "e":
						target.$give(card, player, false);
						player.equip(card);
						break;
					case "j":
						target.$give(card, player, false);
						player.addJudge(card);
						break;
				}
			}
			"step 6";
			if (event.control == "选项二" || event.control == "背水！") {
				player.recover();
			}
		},
	},
	twyuyan: {
		audio: "yuyan",
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			return event.card.name == "sha" && event.card.isCard && player.hp < event.player.hp;
		},
		forced: true,
		logTarget: "player",
		content() {
			"step 0";
			var num = get.number(trigger.card),
				str = "";
			if (typeof num == "number") {
				str = "点数大于" + get.cnNumber(num) + "的";
			} else {
				str = "非基本";
			}
			if (
				(typeof num == "number" &&
					(num >= 13 ||
						!trigger.player.hasCard(function (card) {
							if (_status.connectMode && get.position(card) == "h") {
								return true;
							}
							return get.number(card) > num;
						}, "he"))) ||
				(typeof num != "number" &&
					!trigger.player.hasCard(function (card) {
						if (_status.connectMode && get.position(card) == "h") {
							return true;
						}
						return get.type(card) != "basic";
					}, "he"))
			) {
				event._result = { bool: false };
			} else {
				trigger.player
					.chooseCard(
						"he",
						function (card) {
							if (typeof _status.event.number == "number") {
								return get.number(card) > _status.event.number;
							}
							return get.type(card) != "basic";
						},
						"交给" + get.translation(player) + "一张" + str + "牌，或取消" + get.translation(trigger.card) + "对其的目标"
					)
					.set("number", num)
					.set("ai", function (card) {
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
				target_use(card, player, target, current) {
					if (card.name == "sha" && player.hp > target.hp && get.attitude(player, target) < 0) {
						var num = get.number(card);
						var bs = player.getCards("h", function (cardx) {
							return (
								(typeof num == "number" ? get.number(cardx) > num : get.type(cardx) != "basic") && !["", "", ""].includes(cardx.name)
							);
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
};
