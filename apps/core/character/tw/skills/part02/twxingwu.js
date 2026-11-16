import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twxingwu" | "twpingting" | "tianxiang_daxiaoqiao" | "liuli_daxiaoqiao" | "twxuewei" | "twliechi">} */
export const groupSkills = {
	//大小乔
	twxingwu: {
		audio: "xingwu",
		trigger: { player: "phaseDiscardBegin" },
		filter(event, player) {
			return player.countCards("he");
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseCard("he", get.prompt("twxingwu"), "将一张牌置于武将牌上作为“星舞”")
				.set("ai", function (card) {
					if (_status.event.goon) {
						return 20 - get.value(card);
					}
					return 7 - get.value(card);
				})
				.set("goon", player.needsToDiscard() || player.getExpansions("twxingwu").length > 1);
			"step 1";
			if (result.bool) {
				player.logSkill("twxingwu");
				var cards = result.cards;
				player.addToExpansion(cards, player, "give").gaintag.add("twxingwu");
			} else {
				event.finish();
			}
			"step 2";
			game.delayx();
			if (player.getExpansions("twxingwu").length < 3 || !game.hasPlayer(current => current != player)) {
				event.finish();
			}
			"step 3";
			player
				.chooseButton(["是否移去三张“星舞”牌并发射核弹？", player.getExpansions("twxingwu")], 3)
				.set("ai", function (button) {
					if (_status.event.goon) {
						return 1;
					}
					return 0;
				})
				.set(
					"goon",
					game.hasPlayer(current => get.damageEffect(current, player, player) < 0)
				);
			"step 4";
			if (result.bool) {
				player.loseToDiscardpile(result.links);
			} else {
				event.finish();
			}
			"step 5";
			player
				.chooseTarget(
					"星舞：选择一名其他角色",
					"弃置其装备区内的所有牌。然后对其造成2点伤害（若其性别包含女性则改为1点）",
					true,
					lib.filter.notMe
				)
				.set("ai", function (target) {
					return (
						get.damageEffect(target, player, player) *
						Math.sqrt(
							4 +
								target.countCards("e", function (card) {
									return get.value(card, target) > 0;
								})
						) *
						(target.hasSex("female") ? 1 : 2)
					);
				});
			"step 6";
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
		intro: {
			content: "expansion",
			markcount: "expansion",
			onunmark(storage, player) {
				if (player.hasSkill("twpingting")) {
					return;
				}
				player.removeAdditionalSkill("twpingting");
			},
		},
		onremove(player, skill) {
			if (player.hasSkill("twpingting")) {
				return;
			}
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
	},
	twpingting: {
		trigger: { global: ["roundStart", "dying"] },
		init(player, skill) {
			if (player.getExpansions("twxingwu").length) {
				player.addAdditionalSkill(skill, ["tianxiang", "liuli"]);
			} else {
				player.removeAdditionalSkill(skill);
			}
		},
		filter(event, player) {
			if (event.name == "dying") {
				return player == _status.currentPhase && event.player != player;
			}
			return true;
		},
		forced: true,
		group: "twpingting_update",
		derivation: ["tianxiang", "liuli"],
		content() {
			"step 0";
			player.draw();
			player.chooseCard("he", "娉婷：将一张牌置于武将牌上，称为“星舞”", true).set("ai", function (card) {
				return -get.value(card);
			});
			"step 1";
			if (result.bool) {
				var cards = result.cards;
				player.addToExpansion(cards, player, "give").gaintag.add("twxingwu");
			}
		},
		onremove(player, skill) {
			if (player.hasSkill("twxingwu")) {
				return;
			}
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		subSkill: {
			update: {
				trigger: { player: ["loseAfter", "loseAsyncAfter", "addToExpansionAfter"] },
				filter(event, player) {
					var cards = player.getExpansions("twxingwu"),
						skills = player.additionalSkills.twpingting;
					return !((cards.length && skills && skills.length) || (!cards.length && (!skills || !skills.length)));
				},
				forced: true,
				silent: true,
				content() {
					lib.skill.twpingting.init(player, "twpingting");
				},
			},
		},
	},
	tianxiang_daxiaoqiao: { audio: 2, inherit: "tianxiang" },
	liuli_daxiaoqiao: { audio: 2, inherit: "liuli" },
	//傅肜
	twxuewei: {
		audio: "xuewei",
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			return event.player != player && game.players.length > 2 && !player.hasSkill("twxuewei_round");
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("twxuewei"), function (card, player, target) {
					return target != player && target != _status.event.getTrigger().player;
				})
				.set("ai", function (target) {
					if (get.attitude(player, _status.event.getTrigger().player) >= 0) {
						return 0;
					}
					return get.attitude(player, target);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twxuewei", trigger.player, false);
				player.addTempSkill("twxuewei_round", "roundStart");
				player.line2([trigger.player, target]);
				trigger.player
					.chooseControl("选项一", "选项二")
					.set("choiceList", [
						"本回合不能对" + get.translation(target) + "使用【杀】且手牌上限-2",
						"令" + get.translation(player) + "视为对你使用一张【决斗】",
					])
					.set("ai", function () {
						var player = _status.event.player,
							source = _status.event.getParent().player;
						if (get.effect(player, { name: "juedou" }, source, player) > 0) {
							return 1;
						}
						if (player.hp - player.countCards("h") > 2 || player.hp <= 2) {
							return 0;
						}
						return 1;
					});
			} else {
				event.finish();
			}
			"step 2";
			game.log(trigger.player, "选择了", "#g【血卫】", "的", "#y" + result.control);
			if (result.control == "选项一") {
				trigger.player.markAuto("twxuewei_block", [target]);
				trigger.player.addTempSkill("twxuewei_block");
			} else {
				player.useCard({ name: "juedou", isCard: true }, trigger.player, false);
			}
		},
		subSkill: {
			round: { charlotte: true },
			block: {
				charlotte: true,
				onremove: true,
				locked: true,
				mark: true,
				marktext: "卫",
				intro: {
					content(storage, player) {
						if (!storage || !storage.length) {
							return;
						}
						return "不能对" + get.translation(storage) + "使用【杀】；手牌上限-" + 2 * storage.length;
					},
				},
				mod: {
					maxHandcard(player, num) {
						return num - 2 * player.getStorage("twxuewei_block").length;
					},
					playerEnabled(card, player, target) {
						if (card.name == "sha" && player.getStorage("twxuewei_block").includes(target)) {
							return false;
						}
					},
				},
			},
		},
	},
	twliechi: {
		audio: "liechi",
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return (
				event.source &&
				event.source.hp >= player.hp &&
				(event.source.countCards("h") > player.countCards("h") || event.source.countCards("he"))
			);
		},
		direct: true,
		content() {
			"step 0";
			var num = trigger.source.countCards("h") - player.countCards("h");
			event.num = num;
			var list = [],
				choiceList = [
					"令" + get.translation(trigger.source) + "弃置" + get.cnNumber(num) + "张手牌",
					"弃置" + get.translation(trigger.source) + "一张牌",
					"背水！弃置一张装备牌，然后依次执行以上所有选项",
				];
			if (trigger.source.countCards("h") > player.countCards("h")) {
				list.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			if (trigger.source.countCards("he")) {
				list.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			if (
				trigger.source.countCards("h") > player.countCards("h") &&
				trigger.source.countCards("he") &&
				player.countCards("he", { type: "equip" }) &&
				game.getGlobalHistory("changeHp", evt => {
					return evt.player == player && evt.getParent()._dyinged;
				}).length
			) {
				list.push("背水！");
			} else {
				choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "（未进入过濒死状态）</span>";
			}
			player
				.chooseControl(list, "cancel2")
				.set("prompt", get.prompt("twliechi", trigger.source))
				.set("choiceList", choiceList)
				.set("ai", () => _status.event.choice)
				.set(
					"choice",
					(function () {
						if (get.attitude(player, trigger.source) > 0) {
							return "cancel2";
						}
						if (list.includes("背水！")) {
							return "背水！";
						}
						if (num > 1) {
							return "选项一";
						}
						return "选项二";
					})()
				);
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("twliechi", trigger.source);
				game.log(player, "选择了", "#g【烈斥】", "的", "#y" + result.control);
				if (result.control != "选项二") {
					trigger.source.chooseToDiscard("h", num, true, "allowChooseAll");
				}
				if (result.control != "选项一") {
					player.discardPlayerCard(trigger.source, "he", true);
				}
				if (result.control == "背水！") {
					player.chooseToDiscard("he", { type: "equip" }, true);
				}
			}
		},
	},
};
