import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olcangxin" | "olrunwei" | "olgangshu" | "oljianxuan">} */
export const groupSkills = {
	//OL陆郁生
	olcangxin: {
		audio: 2,
		trigger: { player: "damageBegin4" },
		filter(event, player) {
			return (
				game
					.getGlobalHistory(
						"everything",
						evt => {
							return evt.name == "damage" && evt.player == player;
						},
						event
					)
					.indexOf(event) == 0
			);
		},
		checkx(event, player) {
			var target = event.source;
			return get.damageEffect(player, target, player) <= 0;
		},
		forced: true,
		content() {
			"step 0";
			var cards = get.bottomCards(3, true);
			player
				.chooseButton(["###藏心：请选择要弃置的牌###若以此法弃置了红桃牌，则减少弃置红桃牌数的伤害", cards], [0, cards.length], true, "allowChooseAll")
				.set("ai", function (button) {
					if (!_status.event.bool && get.suit(button.link, false) == "heart") {
						return 0;
					}
					if (get.suit(button.link, false) != "heart") {
						return 1;
					}
					const num = get.event().getTrigger().num;
					if (num > ui.selected.buttons.filter(but => get.suit(but.link, false) == "heart").length) {
						return 1;
					}
					return 0;
				})
				.set("bool", lib.skill.olcangxin.checkx(trigger, player));
			"step 1";
			if (result.bool) {
				player.$throw(result.links, 1000);
				game.cardsDiscard(result.links);
				const num = result.links.filter(card => get.suit(card, false) == "heart").length;
				if (num) {
					trigger.num -= Math.min(trigger.num, num);
				}
			} else {
				event.finish();
			}
			"step 2";
			game.delayx();
		},
		group: "olcangxin_yingzi",
		subSkill: {
			yingzi: {
				audio: "olcangxin",
				trigger: { player: "phaseDrawBegin" },
				forced: true,
				content() {
					var cards = get.bottomCards(3, true);
					player.showCards(cards, get.translation(player) + "发动了【藏心】");
					var num = cards.filter(card => get.suit(card, false) == "heart").length;
					if (num) {
						player.draw(num);
					}
				},
			},
		},
	},
	olrunwei: {
		audio: 2,
		trigger: { global: "phaseDiscardBegin" },
		filter(event, player) {
			return event.player.isDamaged();
		},
		async cost(event, trigger, player) {
			let str = get.translation(trigger.player);
			const result = await player
				.chooseControl("弃牌，+1", "摸牌，-1", "cancel2")
				.set("choiceList", ["令" + str + "弃置一张牌，且其本回合手牌上限+1", "令" + str + "摸一张牌，且其本回合手牌上限-1"])
				.set("ai", function () {
					let player = _status.event.player,
						target = _status.event.getTrigger().player,
						att = get.sgn(get.attitude(player, target));
					if (!att) {
						return 2;
					}
					let dis = target.needsToDiscard(0, null, true),
						res = [
							-att *
								(1 +
									Math.max(
										0,
										dis -
											(target.hasCard(i => {
												return get.value(i, target) <= 6;
											}, "e")
												? 1
												: 2)
									)),
							att * (1 - Math.max(0, dis + 2)),
							-att * dis,
						];
					return res.indexOf(Math.max(...res));
				})
				.set("prompt", get.prompt(event.skill, trigger.player))
				.forResult();
			event.result = {
				bool: result.control !== "cancel2",
				cost_data: result.index,
			};
		},
		logTarget: "player",
		async content(event, trigger, player) {
			if (event.cost_data === 0) {
				await trigger.player
					.chooseToDiscard("he", true)
					.set("ai", card => {
						if (get.position(card) == "e") {
							return get.event().e - get.value(card);
						}
						return 1 / (get.value(card) || 0.5);
					})
					.set(
						"e",
						(function () {
							if (
								!trigger.player.hasCard(i => {
									return get.value(i, trigger.player) <= 6;
								}, "e")
							) {
								return 0;
							}
							if (!trigger.player.needsToDiscard(-2)) {
								return 0;
							}
							return 6.2;
						})()
					);
				trigger.player.addTempSkill("olrunwei_+");
				trigger.player.addMark("olrunwei_+", 1, false);
			}
			if (event.cost_data === 1) {
				await trigger.player.draw();
				trigger.player.addTempSkill("olrunwei_-");
				trigger.player.addMark("olrunwei_-", 1, false);
			}
		},
		subSkill: {
			"+": {
				charlotte: true,
				onremove: true,
				marktext: "+",
				intro: { content: "手牌上限+#" },
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("olrunwei_+");
					},
				},
			},
			"-": {
				charlotte: true,
				onremove: true,
				marktext: "-",
				intro: { content: "手牌上限-#" },
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("olrunwei_-");
					},
				},
			},
		},
	},
	//曹羲
	olgangshu: {
		audio: 2,
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			return get.type2(event.card, false) != "basic";
		},
		getInfo: player => {
			if (!player.storage.olgangshu_buff) {
				player.storage.olgangshu_buff = [0, 0, 0];
			}
			return player.storage.olgangshu_buff;
		},
		direct: true,
		group: "olgangshu_reset",
		content() {
			"step 0";
			var info = lib.skill.olgangshu.getInfo(player);
			player
				.chooseControl("攻击范围(" + info[0] + ")", "摸牌数(" + info[1] + ")", "使用杀的上限(" + info[2] + ")", "cancel2")
				.set("prompt", get.prompt("olgangshu"))
				.set("prompt2", '<div class="text center">令以下一个数值+1（每项至多+5）：<br>1.攻击范围；<br>2.下个摸牌阶段的摸牌数；<br>3.使用【杀】的次数上限。</div>')
				.set("ai", () => {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						var info = lib.skill.olgangshu.getInfo(player);
						if (info[1] == 0) {
							return 1;
						}
						if (
							info[2] < 5 &&
							player.hasCard(card => {
								return get.name(card) == "sha" && player.hasValueTarget(card);
							}, "hs") &&
							!player.getCardUsable("sha")
						) {
							return 2;
						}
						if (
							info[0] < 5 &&
							!game.hasPlayer(current => {
								return player.inRange(current) && get.effect(current, { name: "sha" }, player, player) > 0;
							})
						) {
							return 0;
						}
						var rand = Math.random();
						var list = [0, 1, 2].filter(i => info[i] < 5);
						if (!list.length) {
							return "cancel2";
						}
						if (rand < 0.2 && list.includes(0)) {
							return 0;
						}
						if (rand < 0.7 && list.includes(1)) {
							return 1;
						}
						if (rand < 1.0 && list.includes(2)) {
							return 2;
						}
						return list.randomGet();
					})()
				);
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("olgangshu");
				player.addSkill("olgangshu_buff");
				var info = lib.skill.olgangshu.getInfo(player);
				info[result.index] = Math.min(5, info[result.index] + 1);
				game.log(player, "的", result.control.slice(0, result.control.indexOf("(")), "#y+1");
				player.markSkill("olgangshu_buff");
				lib.skill.olgangshu.subSkill.buff.init(player);
			}
		},
		ai: {
			threaten: 3,
		},
		subSkill: {
			buff: {
				audio: "olgangshu",
				init(player) {
					let info = lib.skill.olgangshu.getInfo(player);
					player.addTip("olgangshu_buff", "刚述 " + info.slice().join(" "));
				},
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				trigger: { player: "phaseDrawBegin2" },
				forced: true,
				filter(event, player) {
					var info = lib.skill.olgangshu.getInfo(player);
					if (!info[1]) {
						return false;
					}
					return !event.numFixed;
				},
				content() {
					var info = lib.skill.olgangshu.getInfo(player);
					trigger.num += info[1];
					info[1] = 0;
					player.markSkill("olgangshu_buff");
				},
				mod: {
					attackRange(player, range) {
						var info = lib.skill.olgangshu.getInfo(player);
						if (info) {
							return range + info[0];
						}
					},
					cardUsable(card, player, num) {
						if (card.name != "sha") {
							return;
						}
						var info = lib.skill.olgangshu.getInfo(player);
						if (info) {
							return num + info[2];
						}
					},
				},
				mark: true,
				intro: {
					markcount(storage, player) {
						var info = lib.skill.olgangshu.getInfo(player);
						var str = "";
						info.forEach(num => (str += parseFloat(num)));
						return str;
					},
					content(storage, player) {
						var info = lib.skill.olgangshu.getInfo(player);
						var str = "";
						if (info[0] > 0) {
							str += "<li>攻击范围+" + info[0];
						}
						if (info[1] > 0) {
							str += "<li>下个摸牌阶段摸牌数+" + info[1];
						}
						if (info[2] > 0) {
							str += "<li>使用【杀】的次数上限+" + info[2];
						}
						return str;
					},
				},
			},
			reset: {
				audio: "olgangshu",
				trigger: {
					global: ["shaMiss", "eventNeutralized"],
				},
				filter(event, player) {
					if (event.type != "card") {
						return false;
					}
					var responder;
					if (event.name == "sha") {
						responder = event.target;
					} else {
						responder = event._neutralize_event.player;
					}
					return player == responder;
				},
				forced: true,
				locked: false,
				content() {
					player.removeSkill("olgangshu_buff");
					game.log(player, "重置了", "#g【刚述】", "的数值");
				},
			},
		},
	},
	oljianxuan: {
		audio: 2,
		trigger: {
			player: "damageEnd",
		},
		direct: true,
		content() {
			"step 0";
			var info = lib.skill.olgangshu.getInfo(player);
			var list = [];
			list.add(player.getAttackRange());
			list.add(2 + info[1]);
			list.add(player.getCardUsable("sha", true));
			list.sort();
			var str = list.join("、").replace(/(.*)、/, "$1或");
			event.list = list;
			player
				.chooseTarget(get.prompt("oljianxuan"), "令一名角色摸一张牌，然后若其手牌数为" + str + "，其重复此流程")
				.set("ai", target => {
					var list = _status.event.list;
					var player = _status.event.player;
					var att = get.attitude(player, target);
					if (att <= 0) {
						return 0;
					}
					var num = target.countCards("h") + 1;
					var value = 1;
					while (true) {
						if (list.includes(num)) {
							value++;
							num++;
						} else {
							break;
						}
					}
					return value + att / 10;
				})
				.set("list", list);
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("oljianxuan", target);
				if (player != target) {
					player.addExpose(0.15);
				}
			} else {
				event.finish();
			}
			"step 2";
			target.draw();
			"step 3";
			if (event.list.includes(target.countCards("h"))) {
				event.goto(2);
			}
		},
		ai: {
			combo: "olgangshu",
			maixie: true,
		},
	},
};
