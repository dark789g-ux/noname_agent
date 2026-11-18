import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dclingxi" | "dczhifou">} */
export const groupSkills = {
	//曹宪
	dclingxi: {
		audio: 2,
		trigger: { player: ["phaseUseBegin", "phaseUseEnd"] },
		filter(event, player) {
			return player.countCards("he") && player.maxHp > 0;
		},
		direct: true,
		async content(event, trigger, player) {
			var num = player.maxHp;
			var result = await player
				.chooseCard(get.prompt("dclingxi"), "将至多" + get.cnNumber(num) + "张牌称为“翼”置于武将牌上", "he", [1, num])
				.set("ai", card => {
					let player = _status.event.player,
						dis = player.needsToDiscard(0, (i, player) => {
							return !player.canIgnoreHandcard(i) && !ui.selected.cards.includes(i);
						}),
						cards = ui.selected.cards.concat(player.getExpansions("dclingxi")),
						suit = get.suit(card, false);
					if (_status.event.suits.length < 4) {
						_status.event.suits.add(get.suit(ui.selected.cards.at(-1), false));
					}
					if (_status.event.triggerName === "phaseUseEnd") {
						if (_status.event.suits.includes(suit)) {
							return (dis ? 10 : 3) - get.useful(card);
						}
						return (dis ? 6 : 1) - get.useful(card);
					}
					_status.event.hvt.remove(ui.selected.cards.at(-1));
					if (_status.event.hvt.length === 1 && card === _status.event.hvt[0]) {
						return 0;
					}
					let temp;
					if (
						!cards.some(i => {
							temp = get.suit(i, false);
							return cards.some(j => {
								return i !== j && suit === get.suit(j, false);
							});
						}) &&
						suit === temp
					) {
						return 15 - get.value(card);
					}
					if (!_status.event.hvt.length) {
						if (_status.event.suits.includes(suit)) {
							return (dis ? 10 : 3) - get.useful(card);
						}
						return (dis ? 6 : 1) - get.useful(card);
					}
					if (_status.event.hvt.includes(card)) {
						if (!_status.event.suits.includes(suit)) {
							return 6 - get.value(card);
						}
						if (card.name === "sha") {
							return 3 - get.value(card);
						}
						return 1 - get.value(card);
					}
					return 15 - get.value(card);
				})
				.set("complexCard", true)
				.set(
					"hvt",
					player.getCards("hs", card => {
						return card.name === "zhuge" || player.hasValueTarget(card, null, true);
					})
				)
				.set(
					"suits",
					(() => {
						let suits = [];
						player.getExpansions("dclingxi").forEach(i => {
							suits.add(get.suit(i, false));
						});
						return suits;
					})()
				)
				.set("triggerName", event.triggername)
				.forResult();
			if (result.bool) {
				player.logSkill("dclingxi");
				player.addToExpansion(result.cards, player, "give").gaintag.add("dclingxi");
			}
		},
		marktext: "翼",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: "dclingxi_effect",
		subSkill: {
			effect: {
				audio: "dclingxi",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter"],
				},
				filter(event, player) {
					var num = 2 * player.getExpansions("dclingxi").reduce((list, card) => list.add(get.suit(card, false)), []).length;
					num -= player.countCards("h");
					if (!num) {
						return false;
					}
					if (event.name == "lose" && event.getlx !== false) {
						for (var i in event.gaintag_map) {
							if (event.gaintag_map[i].includes("dclingxi")) {
								return true;
							}
						}
						return false;
					}
					return game.getGlobalHistory("cardMove", function (evt) {
						if (evt.name != "lose" || event != evt.getParent()) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dclingxi") && evt.player == player) {
								return true;
							}
						}
						return false;
					}).length;
				},
				forced: true,
				locked: false,
				content() {
					var num = 2 * player.getExpansions("dclingxi").reduce((list, card) => list.add(get.suit(card, false)), []).length;
					num -= player.countCards("h");
					if (num > 0) {
						player.draw(num);
					} else {
						player.chooseToDiscard("h", -num, true, "allowChooseAll");
					}
				},
			},
		},
		ai: {
			combo: "dczhifou",
		},
	},
	dczhifou: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			var num = player.getHistory("useSkill", evt => evt.skill == "dczhifou").length + 1;
			return player.getExpansions("dclingxi").length >= num;
		},
		direct: true,
		async content(event, trigger, player) {
			var cards = player.getExpansions("dclingxi");
			var num = player.getHistory("useSkill", evt => evt.skill == "dczhifou").length + 1;
			var result = await player
				.chooseButton(["###" + get.prompt("dczhifou") + "###移去至少" + get.cnNumber(num) + "张武将牌上的“翼”", cards], [num, cards.length], "allowChooseAll")
				.set("ai", button => {
					if (!_status.event.res.bool) {
						return 0;
					}
					if (_status.event.res.cards.includes(button.link)) {
						return 1;
					}
					return 0;
				})
				.set("num", num)
				.set(
					"res",
					(() => {
						if (
							player.isPhaseUsing() &&
							player.hasCard(i => {
								return player.hasValueTarget(i, null, true);
							}, "h")
						) {
							return false;
						}
						let suits = [],
							cs = player.getExpansions("dclingxi"),
							cards = [],
							temp = num;
						for (let i = 0; i < cs.length; i++) {
							if (!temp) {
								break;
							}
							let suit = get.suit(cs[i], false);
							if (suits.includes(suit)) {
								cards.push(cs.splice(i--, 1)[0]);
								temp--;
							} else {
								suits.push(suit);
							}
						}
						while (temp > 0) {
							cards.push(cs.pop());
							temp--;
						}
						temp = suits.length * 2 - player.countCards("h");
						if (temp > 0 || (!temp && num < Math.max(2, 5 - player.hp))) {
							cs = true;
						} else {
							cs = false;
						}
						return {
							bool: cs,
							cards: cards,
						};
					})()
				)
				.forResult();
			if (result.bool) {
				player.logSkill("dczhifou");
				player.loseToDiscardpile(result.links);
				var list = [],
					choiceList = ["将一张牌称为“翼”置于你的武将牌上", "弃置两张牌", "失去1点体力"];
				if (!player.hasSkill("dczhifou_0") && game.hasPlayer(target => target.countCards("he"))) {
					list.push("置入“翼”");
				} else {
					choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
				}
				if (
					!player.hasSkill("dczhifou_1") &&
					game.hasPlayer(target => {
						return target == player ? target.countDiscardableCards(target, "he") : target.countCards("he");
					})
				) {
					list.push("弃置卡牌");
				} else {
					choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
				}
				if (!player.hasSkill("dczhifou_2")) {
					list.push("失去体力");
				} else {
					choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "</span>";
				}
				if (!list.length) {
					return;
				}
				var str = "";
				for (var i of list) {
					str += i;
					str += "、";
				}
				str = str.slice(0, -1);
				var result2 = await player
					.chooseTarget(
						"知否：令一名角色执行以下一项",
						str,
						(card, player, target) => {
							if (!player.hasSkill("dczhifou_2")) {
								return true;
							}
							if (!player.hasSkill("dczhifou_0") && target.countCards("he")) {
								return true;
							}
							return target == player ? target.countDiscardableCards(target, "he") : target.countCards("he");
						},
						true
					)
					.set("ai", target => {
						var player = _status.event.player,
							list = [];
						if (!player.hasSkill("dczhifou_0")) {
							list.push(get.effect(target, { name: "guohe_copy2" }, target, player) / 2);
						}
						if (!player.hasSkill("dczhifou_1")) {
							list.push(get.effect(target, { name: "guohe_copy2" }, target, player));
						}
						if (!player.hasSkill("dczhifou_2")) {
							list.push(get.effect(target, { name: "losehp" }, player, player));
						}
						return list.sort((a, b) => b - a)[0];
					})
					.forResult();
				if (result2.bool) {
					var target = result2.targets[0];
					player.line(target);
					list = list.filter(control => {
						if (control == "失去体力") {
							return true;
						}
						if (control == "置入“翼”" && target.countCards("he")) {
							return true;
						}
						return target.countDiscardableCards(target, "he");
					});
					var result3;
					if (!list.length) {
						game.log(target, "没有可执行项");
						return;
					} else if (list.length == 1) {
						result3 = { control: list[0] };
					} else {
						result3 = await player
							.chooseControl(list)
							.set("prompt", "知否：请选择一项")
							.set(
								"choiceList",
								choiceList.map(str => "令" + get.translation(target) + str)
							)
							.set("ai", () => {
								var player = _status.event.player;
								var target = _status.event.target;
								var getNum = function (control) {
									return [get.effect(target, { name: "guohe_copy2" }, target, player) / 2, get.effect(target, { name: "guohe_copy2" }, target, player), get.effect(target, { name: "losehp" }, target, player)][["置入“翼”", "弃置卡牌", "失去体力"].indexOf(control)];
								};
								var controls = _status.event.controls.slice();
								return controls.sort((a, b) => getNum(b) - getNum(a))[0];
							})
							.set("target", target)
							.forResult();
					}
					switch (result3.control) {
						case "置入“翼”":
							player.addTempSkill("dczhifou_0");
							var result4 = await target.chooseCard("he", choiceList[0], true).forResult();
							if (result4.bool) {
								player.addToExpansion(result4.cards, target, "give").gaintag.add("dclingxi");
							}
							break;
						case "弃置卡牌":
							player.addTempSkill("dczhifou_1");
							target.chooseToDiscard("he", 2, true);
							break;
						case "失去体力":
							player.addTempSkill("dczhifou_2");
							target.loseHp();
							break;
					}
				}
			}
		},
		subSkill: {
			0: { charlotte: true },
			1: { charlotte: true },
			2: { charlotte: true },
		},
		ai: {
			combo: "dclingxi",
		},
	},
};
