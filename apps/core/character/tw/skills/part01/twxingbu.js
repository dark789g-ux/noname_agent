import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twxingbu" | "twlifeng" | "old_twlifeng" | "twniwo">} */
export const groupSkills = {
	//谯周
	twxingbu: {
		audio: "xingbu",
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		content() {
			"step 0";
			var cards = get.cards(3);
			game.updateRoundNumber();
			event.cards = cards;
			player.showCards(cards, get.translation(player) + "发动了【星卜】");
			"step 1";
			var num = 0,
				list = [
					["荧惑守心", "出牌阶段使用【杀】的次数-1"],
					["扶匡东柱", "出牌阶段使用的第一张牌结算完成后，弃置一张牌并摸两张牌"],
					["五星连珠", "摸牌阶段多摸两张牌，出牌阶段使用【杀】的次数+1，跳过弃牌阶段"],
				];
			for (var i of cards) {
				if (get.color(i, false) == "red") {
					num++;
				}
			}
			if (num == 0) {
				num = 1;
			}
			player
				.chooseTarget("是否令一名其他角色获得“" + list[num - 1][0] + "”效果？", list[num - 1][1], lib.filter.notMe)
				.set("ai", function (target) {
					var player = _status.event.player,
						num = _status.event.getParent().num;
					var att = get.attitude(player, target);
					switch (num) {
						case 1:
							return -get.sgn(att) * target.countCards("hs", { name: "sha" }) - 1;
						case 2:
							return att;
						case 3:
							return att * (target.hasJudge("lebu") ? 3 : 1);
					}
				});
			event.num = num;
			"step 2";
			if (result.bool) {
				player.addExpose(0.15);
				var skill = "twxingbu_effect" + num;
				var target = result.targets[0];
				player.line(target);
				game.log(player, "选择了", target);
				target.popup(skill);
				target.addTempSkill(skill, { player: "phaseAfter" });
				target.addMark(skill, 1, false);
				game.delayx();
			}
			game.cardsDiscard(cards);
		},
		subSkill: {
			effect1: {
				charlotte: true,
				onremove: true,
				marktext: "惑",
				intro: { content: "出牌阶段使用【杀】的次数-#" },
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num - player.countMark("twxingbu_effect1");
						}
					},
				},
			},
			effect2: {
				charlotte: true,
				onremove: true,
				marktext: "匡",
				intro: { content: "出牌阶段使用的第一张牌结算完成后，弃置#张牌并摸#*2张牌" },
				audio: "xingbu",
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					var evt = event.getParent("phaseUse");
					if (!evt || evt.player != player) {
						return false;
					}
					return (
						player
							.getHistory("useCard", function (evtx) {
								return evtx.getParent("phaseUse") == evt;
							})
							.indexOf(event) < player.countMark("twxingbu_effect2")
					);
				},
				forced: true,
				content() {
					"step 0";
					player.chooseToDiscard(player.countMark("twxingbu_effect2"), "he", true);
					"step 1";
					player.draw(player.countMark("twxingbu_effect2") * 2);
				},
			},
			effect3: {
				charlotte: true,
				onremove: true,
				marktext: "星",
				intro: { content: "摸牌阶段多摸#*2张牌，出牌阶段使用【杀】的次数+#，跳过弃牌阶段" },
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("twxingbu_effect3");
						}
					},
				},
				audio: "xingbu",
				trigger: { player: ["phaseDrawBegin2", "phaseDiscardBefore"] },
				filter(event, player) {
					if (event.name == "phaseDiscard") {
						return true;
					}
					return !event.numFixed;
				},
				forced: true,
				content() {
					if (trigger.name == "phaseDiscard") {
						trigger.cancel();
					} else {
						trigger.num += player.countMark("twxingbu_effect3") * 2;
					}
				},
			},
		},
	},
	//幻陆逊
	twlifeng: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countDiscardableCards(player, "he") > 1;
		},
		filterCard: lib.filter.cardDiscardable,
		selectCard: 2,
		position: "he",
		filterTarget(card, player, target) {
			if (ui.selected.cards.length < 2) {
				return false;
			}
			let cards = ui.selected.cards,
				num = Math.abs(get.number(cards[0], player) - get.number(cards[1], player));
			return get.distance(target, player) == num;
		},
		check(card) {
			return 7 - get.value(card);
		},
		complexSelect: true,
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards, target } = event;
			const isDraw = cards.some(card => !card.hasGaintag("twniwo"));
			await player.discard(cards);
			await target.damage();
			if (isDraw) {
				await player.draw();
			}
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					return get.damageEffect(target, player, player);
				},
			},
		},
	},
	old_twlifeng: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (!player.countCards("he")) {
				return false;
			}
			let cardx = player.getCards("he").randomGet();
			return player.countCards("he", card => get.number(card, player) != get.number(cardx, player));
		},
		filterCard(card, player) {
			if (ui.selected.cards.length) {
				return get.number(card, player) != get.number(ui.selected.cards[0], player);
			}
			return true;
		},
		position: "he",
		selectCard: 2,
		filterTarget(card, player, target) {
			if (ui.selected.cards.length < 2) {
				return false;
			}
			let cards = ui.selected.cards,
				num = Math.abs(get.number(cards[0], player) - get.number(cards[1], player));
			return get.distance(player, target) <= num;
		},
		check(card) {
			return 7 - get.value(card);
		},
		complexSelect: true,
		async content(event, trigger, player) {
			await event.target.damage();
		},
		group: "old_twlifeng_effect",
		subSkill: {
			effect: {
				trigger: {
					source: "damageBegin3",
				},
				filter(event, player) {
					return event.getParent().name == "old_twlifeng";
				},
				async cost(event, trigger, player) {
					const target = trigger.player,
						cards = trigger.getParent().cards,
						num1 = get.number(cards[0]),
						num2 = get.number(cards[1]);
					if (target.countCards("h")) {
						let max = num1 > num2;
						const result = await target
							.chooseCard("是否重铸一张手牌？", `若此牌点数位于${num1}和${num2}之间，防止此伤害`)
							.set("ai", card => {
								const maxNum = get.event().maxNum,
									minNum = get.event().minNum;
								if (get.damageEffect(get.player(), get.event().getTrigger().source, get.player()) > 0) {
									return 0;
								}
								if (get.number(card) >= minNum && get.number(card) <= minNum) {
									return 15 - get.value(card);
								}
								return 8 - get.value(card);
							})
							.set("maxNum", max ? num1 : num2)
							.set("minNum", max ? num2 : num1)
							.forResult();
						event.result = {
							bool: result.bool,
							cards: result.cards,
						};
					} else {
						const result = await target.chooseBool("是否摸一张牌？", `若此牌点数位于${num1}和${num2}之间，防止此伤害`).forResult();
						event.result = {
							bool: result.bool,
						};
					}
					event.result.cost_data = [num1, num2];
					event.result.skill_popup = false;
				},
				async content(event, trigger, player) {
					let card,
						nums = event.cost_data,
						target = trigger.player;
					if (event.cards?.length > 0) {
						await target.recast(event.cards);
						card = event.cards[0];
					} else {
						const result = (await target.draw().forResult()).cards;
						card = result?.[0];
					}
					if (nums[0] > nums[1]) {
						nums.reverse();
					}
					if (nums[0] <= get.number(card) && nums[1] >= get.number(card)) {
						trigger.cancel();
						player.tempBanSkill("old_twlifeng");
					}
				},
			},
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					return get.damageEffect(target, player, player);
				},
			},
		},
	},
	twniwo: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return (
				player.countCards("h") &&
				game.hasPlayer(current => {
					return current != player && current.countCards("h");
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.name.slice(0, -5)), (card, player, current) => {
					return current != player && current.countCards("h");
				})
				.set("ai", target => {
					return -get.attitude(get.player(), target) / (target.countCards("h") + 1);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if ([player, target].some(current => !current.countCards("h"))) {
				return;
			}
			const dialog = ["选择你与" + get.translation(target) + "的等量张手牌"];
			if (player.countCards("h")) {
				dialog.add("你的手牌");
				dialog.add(player.getCards("h"));
			}
			if (target.countCards("h")) {
				dialog.add(get.translation(target) + "的手牌");
				let hs = target.getCards("h");
				if (player.hasSkillTag("viewHandcard", null, target, true)) {
					dialog.add(hs);
				} else {
					dialog.add([hs, "blank"]);
				}
			}
			const result = await player
				.chooseButton(dialog, true, [2, Infinity])
				.set("filterOk", () => {
					const buttons = ui.selected.buttons;
					return buttons.filter(i => get.owner(i.link) == get.player()).length * 2 == buttons.length;
				})
				.set(
					"cards",
					(function () {
						let cards = player
							.getCards("h")
							.slice(0)
							.sort((a, b) => get.value(a) - get.value(b));
						let result = [];
						while (result.length < target.countCards("h")) {
							let card = cards.shift();
							if (get.value(card) <= 5) {
								result.push(card);
							} else {
								break;
							}
						}
						return result.concat(target.getCards("h").randomGets(result.length));
					})()
				)
				.set("ai", button => {
					return get.event().cards.includes(button.link);
				})
				.forResult();
			if (!result?.links?.length) {
				return;
			}
			for (const owner of [player, target]) {
				owner.addTempSkill("twniwo_block");
				owner.addGaintag(
					result.links.filter(i => get.owner(i) == owner),
					"twniwo"
				);
			}
		},
		subSkill: {
			block: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("twniwo");
				},
				mod: {
					cardEnabled2(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("twniwo")) {
							return false;
						}
					},
				},
			},
		},
	},
};
