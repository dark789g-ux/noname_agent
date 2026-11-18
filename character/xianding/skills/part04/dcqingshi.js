import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcqingshi" | "dczhizhe">} */
export const groupSkills = {
	dcqingshi: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (!player.isPhaseUsing()) {
				return false;
			}
			if (player.getStorage("dcqingshi_clear").includes(event.card.name)) {
				return false;
			}
			if (
				player.hasCard(card => {
					return get.name(card) == event.card.name;
				})
			) {
				return true;
			}
			return false;
		},
		direct: true,
		content() {
			"step 0";
			var choices = [];
			var choiceList = ["令" + get.translation(trigger.card) + "对其中一个目标角色造成的伤害+1", "令任意名其他角色各摸一张牌", "摸三张牌，然后〖情势〗于本回合失效"];
			if (trigger.targets && trigger.targets.length) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "(无目标角色)</span>";
			}
			if (game.countPlayer(i => i != player)) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			choices.push("选项三");
			player
				.chooseControl(choices, "cancel2")
				.set("choiceList", choiceList)
				.set("prompt", get.prompt("dcqingshi"))
				.set("ai", () => {
					return _status.event.choice;
				})
				.set(
					"choice",
					(() => {
						var choicesx = choices.slice();
						var cards = player.getCards("hs");
						var bool1 =
								get.tag(trigger.card, "damage") &&
								choicesx.includes("选项一") &&
								trigger.targets.some(current => {
									return get.attitude(player, current) < 0;
								}),
							bool2 = choicesx.includes("选项二");
						if (bool2) {
							bool2 = game.countPlayer(function (current) {
								return player != current && get.attitude(player, current) > 0;
							});
						} else {
							bool2 = 0;
						}
						if (bool1 || bool2) {
							for (var i = 0; i < cards.length; i++) {
								var name = get.name(cards[i]);
								if (player.getStorage("dcqingshi_clear").includes(name)) {
									continue;
								}
								for (var j = i + 1; j < cards.length; j++) {
									if (name === get.name(cards[j]) && get.position(cards[i]) + get.position(cards[j]) !== "ss" && player.hasValueTarget(cards[i])) {
										choicesx.remove("选项三");
										break;
									}
								}
							}
						}
						if (bool2 > 2) {
							return "选项二";
						}
						if (choicesx.includes("选项三")) {
							return "选项三";
						}
						if (bool2 === 2) {
							return "选项二";
						}
						if (bool1) {
							return "选项一";
						}
						if (bool2) {
							return "选项二";
						}
						return "cancel2";
					})()
				);
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("dcqingshi");
				game.log(player, "选择了", "#y" + result.control);
				var index = ["选项一", "选项二", "选项三"].indexOf(result.control) + 1;
				player.addTempSkill("dcqingshi_clear");
				player.markAuto("dcqingshi_clear", [trigger.card.name]);
				var next = game.createEvent("dcqingshi_after");
				next.player = player;
				next.card = trigger.card;
				next.setContent(lib.skill.dcqingshi["content" + index]);
			}
		},
		content1() {
			"step 0";
			player
				.chooseTarget("令" + get.translation(card) + "对其中一个目标造成的伤害+1", true, (card, player, target) => {
					return _status.event.targets.includes(target);
				})
				.set("ai", target => {
					return 2 - get.attitude(_status.event.player, target);
				})
				.set("targets", event.getParent().getTrigger().targets);
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target);
				player.addTempSkill("dcqingshi_ex");
				if (!player.storage.dcqingshi_ex) {
					player.storage.dcqingshi_ex = [];
				}
				player.storage.dcqingshi_ex.push([target, card]);
			}
		},
		content2() {
			"step 0";
			player.chooseTarget("令任意名其他角色各摸一张牌", [1, Infinity], true, lib.filter.notMe).set("ai", target => {
				return get.attitude(_status.event.player, target);
			});
			"step 1";
			if (result.bool) {
				var targets = result.targets;
				targets.sortBySeat();
				player.line(targets);
				game.asyncDraw(targets);
				game.delayex();
			}
		},
		content3() {
			"step 0";
			player.draw(3);
			player.tempBanSkill("dcqingshi");
		},
		subSkill: {
			ex: {
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return (
						player.storage.dcqingshi_ex &&
						player.storage.dcqingshi_ex.some(info => {
							return info[0] == event.player && info[1] == event.card;
						})
					);
				},
				forced: true,
				charlotte: true,
				popup: false,
				onremove: true,
				content() {
					trigger.num++;
					for (var i = 0; i < player.storage.dcqingshi_ex.length; i++) {
						if (player.storage.dcqingshi_ex[i][1] == trigger.card) {
							player.storage.dcqingshi_ex.splice(i--, 1);
						}
					}
				},
			},
			clear: {
				onremove: true,
				charlotte: true,
			},
		},
		ai: {
			threaten: 6,
		},
	},
	dczhizhe: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		filterCard: true,
		position: "h",
		discard: false,
		lose: false,
		delay: false,
		skillAnimation: true,
		animationColor: "metal",
		check(card) {
			if (get.type(card) != "basic" && get.type(card) != "trick") {
				return 0;
			}
			return get.value(card) - 7.5;
		},
		content() {
			"step 0";
			var card = cards[0];
			player.awakenSkill(event.name);
			var cardx = game.createCard2(card.name, card.suit, card.number, card.nature);
			player.gain(cardx).gaintag.add("dczhizhe");
			player.addSkill("dczhizhe_effect");
		},
		ai: {
			order: 15,
			result: {
				player: 1,
			},
		},
		subSkill: {
			effect: {
				mod: {
					aiOrder(player, card, num) {
						if (num > 0 && get.itemtype(card) === "card" && card.hasGaintag("dczhizhe")) {
							return num + 0.16;
						}
					},
					aiValue(player, card, num) {
						if (num > 0 && get.itemtype(card) === "card" && card.hasGaintag("dczhizhe")) {
							return 2 * num;
						}
					},
					aiUseful(player, card, num) {
						if (num > 0 && !player._dczhizhe_mod && get.itemtype(card) === "card" && card.hasGaintag("dczhizhe")) {
							if (player.canIgnoreHandcard(card)) {
								return Infinity;
							}
							player._dczhizhe_mod = true;
							if (
								player.hp < 3 &&
								player.needsToDiscard(0, (i, player) => {
									return !player.canIgnoreHandcard(i) && get.useful(i) > 6;
								})
							) {
								return num * 1.5;
							}
							return num * 10;
						}
					},
				},
				audio: "dczhizhe",
				trigger: { player: ["useCardAfter", "respondAfter"] },
				charlotte: true,
				forced: true,
				filter(event, player) {
					return player.hasHistory("lose", function (evt) {
						if ((evt.relatedEvent || evt.getParent()) != event) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dczhizhe")) {
								if (
									event.cards.some(card => {
										return get.position(card, true) == "o" && card.cardid == i;
									})
								) {
									return true;
								}
							}
						}
						return false;
					});
				},
				content() {
					"step 0";
					var cards = [];
					player.getHistory("lose", function (evt) {
						if ((evt.relatedEvent || evt.getParent()) != trigger) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dczhizhe")) {
								var cardsx = trigger.cards.filter(card => {
									return get.position(card, true) == "o" && card.cardid == i;
								});
								if (cardsx.length) {
									cards.addArray(cardsx);
								}
							}
						}
					});
					if (cards.length) {
						player.gain(cards, "gain2").gaintag.addArray(["dczhizhe", "dczhizhe_clear"]);
						player.addTempSkill("dczhizhe_clear");
					}
				},
			},
			clear: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("dczhizhe_clear");
				},
				mod: {
					cardEnabled2(card, player) {
						var cards = [];
						if (card.cards) {
							cards.addArray(cards);
						}
						if (get.itemtype(card) == "card") {
							cards.push(card);
						}
						for (var cardx of cards) {
							if (cardx.hasGaintag("dczhizhe_clear")) {
								return false;
							}
						}
					},
					cardRespondable(card, player) {
						var cards = [];
						if (card.cards) {
							cards.addArray(cards);
						}
						if (get.itemtype(card) == "card") {
							cards.push(card);
						}
						for (var cardx of cards) {
							if (cardx.hasGaintag("dczhizhe_clear")) {
								return false;
							}
						}
					},
					cardSavable(card, player) {
						var cards = [];
						if (card.cards) {
							cards.addArray(cards);
						}
						if (get.itemtype(card) == "card") {
							cards.push(card);
						}
						for (var cardx of cards) {
							if (cardx.hasGaintag("dczhizhe_clear")) {
								return false;
							}
						}
					},
				},
			},
		},
	},
};
