import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twjiexun" | "twxingzhui" | "twjuchen">} */
export const groupSkills = {
	//薛综
	twjiexun: {
		intro: { content: "已发动#次" },
		audio: "jiexun",
		trigger: { player: "phaseJieshuBegin" },
		onremove: true,
		direct: true,
		derivation: ["twfunanx", "twjiexunx"],
		content() {
			"step 0";
			var suits = {};
			game.countPlayer(current => {
				for (var card of current.getCards("ej")) {
					if (typeof suits[get.suit(card)] != "number") {
						suits[get.suit(card)] = 0;
					}
					suits[get.suit(card)]++;
				}
			});
			var choices = lib.suit.slice();
			choices.push("cancel2");
			var str = lib.suit
				.map(suit => {
					return get.translation(suit) + "：" + get.cnNumber(suits[suit] || 0) + "张";
				})
				.join("；");
			player
				.chooseControl(choices)
				.set("prompt", get.prompt("twjiexun") + "（已发动过" + get.cnNumber(player.countMark("twjiexun")) + "次）")
				.set("ai", function () {
					var player = _status.event.player;
					var map = {};
					game.countPlayer(current => {
						for (var card of current.getCards("ej")) {
							if (typeof map[get.suit(card)] != "number") {
								map[get.suit(card)] = 0;
							}
							map[get.suit(card)]++;
						}
					});
					for (var suit in map) {
						map[suit] = Math.abs(map[suit]);
					}
					var bool = game.hasPlayer(current => get.attitude(player, current) > 0 && player != current);
					var list = lib.suit.slice().sort((a, b) => (bool ? 1 : -1) * ((map[b] || 0) - (map[a] || 0)));
					if ((bool && map[list[0]] > 0) || !bool || player.hasMark("twjiexun")) {
						return list[0];
					}
					return "cancel2";
				})
				.set("prompt2", get.skillInfoTranslation("twjiexun", player, false) + "<br>" + str);
			"step 1";
			if (result.control != "cancel2") {
				var suit = result.control;
				event.suit = suit;
				var num1 = game.countPlayer(function (current) {
					return current.countCards("ej", { suit: suit });
				});
				var num2 = player.countMark("twjiexun");
				event.num1 = num1;
				event.num2 = num2;
				var str = "令一名其他角色摸" + get.cnNumber(num1) + "张牌";
				if (num2) {
					str += "，然后弃置" + get.cnNumber(num2) + "张牌";
				}
				player
					.chooseTarget("请选择【诫训】的目标", str, lib.filter.notMe)
					.set("ai", function (target) {
						var player = _status.event.player,
							att = get.attitude(player, target);
						return _status.event.eff * get.sgn(att) + att / 114514;
					})
					.set("eff", num1 >= num2 && num1 > 0 ? 1 : -1);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twjiexun", target);
				if (player.hasMark("twjiexun") || event.num1) {
					player.addExpose(0.2);
				}
				player.popup(event.suit);
				game.log(player, "选择了", "#y" + get.translation(event.suit));
				player.addMark("twjiexun", 1, false);
				if (event.num1) {
					target.draw(event.num1);
				}
			} else {
				event.finish();
			}
			"step 3";
			if (event.num2) {
				target.chooseToDiscard(event.num2, true, "he");
			} else {
				event.finish();
			}
			"step 4";
			if (result?.cards?.length > 0 && result.autochoose && result.cards?.length === result.rawcards?.length && !player.hasSkill("funan_jiexun")) {
				player
					.chooseControl()
					.set("choiceList", ["摸" + get.cnNumber(event.num2) + "张牌，将【诫训】的发动次数归零", "修改【复难】和【诫训】"])
					.set("ai", () => _status.event.choice)
					.set("prompt", "诫训：选择一项")
					.set("choice", event.num2 >= 4 ? 0 : event.num2 <= 1 ? 1 : [0, 1].randomGet());
			} else {
				event.finish();
			}
			"step 5";
			if (result.index == 0) {
				player.draw(event.num2);
				player.removeMark("twjiexun", player.countMark("twjiexun"), false);
				game.log(player, "归零了", "#g【诫训】", "的发动次数");
			} else {
				game.log(player, "修改了", "#g【复难】", "和", "#g【诫训】");
				player.addSkill("funan_jiexun");
			}
		},
	},
	//张宁
	twxingzhui: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		mahouSkill: true,
		filter(event, player) {
			return !player.hasSkill("twxingzhui_mahou");
		},
		content() {
			"step 0";
			player.loseHp();
			player
				.chooseControl("1回合", "2回合", "3回合")
				.set("prompt", "请选择施法时长")
				.set("ai", function () {
					return 2;
				});
			"step 1";
			player.storage.twxingzhui_mahou = [result.index + 1, result.index + 1];
			player.addTempSkill("twxingzhui_mahou", { player: "die" });
		},
		ai: {
			order: 2,
			result: {
				player(player, target) {
					if (!player.hasFriend()) {
						return 0;
					}
					if (player.hp > 1) {
						return 1;
					}
					return 0;
				},
			},
		},
		subSkill: {
			mahou: {
				trigger: { global: "phaseEnd" },
				forced: true,
				popup: false,
				charlotte: true,
				content() {
					"step 0";
					var list = player.storage.twxingzhui_mahou;
					list[1]--;
					if (list[1] == 0) {
						game.log(player, "的", "#g星坠", "魔法生效");
						player.logSkill("twxingzhui");
						var num = list[0];
						event.num = num;
						var cards = game.cardsGotoOrdering(get.cards(num * 2)).cards;
						event.cards = cards;
						player.showCards(cards, get.translation(player) + "发动了【星坠】");
						player.removeSkill("twxingzhui_mahou");
					} else {
						game.log(player, "的", "#g星坠", "魔法剩余", "#g" + list[1] + "回合");
						player.markSkill("twxingzhui_mahou");
						event.finish();
					}
					"step 1";
					var cards2 = [];
					for (var card of event.cards) {
						if (get.color(card, false) == "black") {
							cards2.push(card);
						}
					}
					if (!cards2.length) {
						event.finish();
					} else {
						event.cards2 = cards2;
						var str = "令一名其他角色获得其中的黑色牌（" + get.translation(cards2) + "）";
						if (cards2.length >= event.num) {
							str += "，然后对其造成" + get.cnNumber(event.num) + "点伤害";
						}
						player.chooseTarget("请选择〖星坠〗的目标", str, lib.filter.notMe).set("ai", function (target) {
							var player = _status.event.player;
							if (_status.event.getParent().cards2.length >= _status.event.getParent().num) {
								return get.damageEffect(target, player, player, "thunder");
							}
							return get.attitude(player, target);
						});
					}
					"step 2";
					if (result.bool) {
						var target = result.targets[0];
						player.line(target);
						target.gain(event.cards2, "gain2");
						if (event.cards2.length >= num) {
							target.damage(event.num, "thunder");
						}
					}
				},
				mark: true,
				onremove: true,
				marktext: "♗",
				intro: {
					name: "施法：星坠",
					markcount(storage) {
						if (storage) {
							return storage[1];
						}
						return 0;
					},
					content(storage) {
						if (storage) {
							return "经过" + storage[1] + "个“回合结束时”后，亮出牌堆顶的" + get.cnNumber(storage[0] * 2) + "张牌并执行后续效果";
						}
						return "未指定施法效果";
					},
				},
			},
		},
	},
	twjuchen: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return (
				game.hasPlayer(function (current) {
					return current != player && current.countCards("h") > player.countCards("h");
				}) &&
				game.hasPlayer(function (current) {
					return current != player && current.hp > player.hp;
				})
			);
		},
		logTarget(event, player) {
			return game.players.sortBySeat(player);
		},
		content() {
			"step 0";
			event.num = 0;
			event.cards = [];
			event.targets = game.players.sortBySeat(player);
			"step 1";
			var target = targets[num];
			if (target.countCards("he")) {
				target.chooseToDiscard("he", true);
			} else {
				event._result = { bool: false };
			}
			"step 2";
			if (result.bool && Array.isArray(result.cards)) {
				event.cards.addArray(result.cards);
			}
			event.num++;
			if (event.num < targets.length) {
				event.goto(1);
			} else {
				game.delayx();
			}
			"step 3";
			var cards = cards.filter(function (i) {
				return get.position(i, true) == "d" && get.color(i, false) == "red";
			});
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
	},
};
