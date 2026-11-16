import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcdeshao" | "dcmingfa" | "lianzhou" | "jinglan" | "xingchong" | "liunian">} */
export const groupSkills = {
	//羊祜
	dcdeshao: {
		audio: 2,
		usable: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return player != event.player && get.color(event.card) == "black";
		},
		logTarget: "player",
		check(event, player) {
			var eff = get.effect(player, { name: "draw" }, player, player);
			if (player.countCards("h") + 1 <= event.player.countCards("h") && event.player.countCards("he") > 0) {
				eff += get.effect(event.player, { name: "guohe_copy2" }, player, player);
			}
			return eff;
		},
		async content(event, trigger, player) {
			await player.draw();
			var target = trigger.player;
			if (player.countCards("h") <= target.countCards("h") && target.countCards("he") > 0) {
				await player.discardPlayerCard(target, true, "he");
				player.addExpose(0.2);
			}
		},
	},
	dcmingfa: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		direct: true,
		filter(event, player) {
			return player.isPhaseUsing() && (event.card.name == "sha" || get.type(event.card) == "trick") && event.cards.filterInD().length > 0 && !player.getExpansions("dcmingfa").length;
		},
		async content(event, trigger, player) {
			var str,
				cards = trigger.cards.filterInD(),
				card = trigger.card;
			if (cards.length == 1 && card.name == cards[0].name && (card.nature || false) == (cards[0].nature || false)) {
				str = get.translation(cards[0]);
			} else {
				str = get.translation(trigger.card) + "（" + get.translation(cards) + "）";
			}
			var cardx = {
				name: trigger.card.name,
				nature: trigger.card.nature,
				isCard: true,
			};
			const result = await player
				.chooseTarget(lib.filter.notMe, get.prompt("dcmingfa"), "将" + str + "作为“明伐”牌置于武将牌上，并选择一名其他角色。该角色下回合结束时对其执行〖明伐〗的后续效果。")
				.set("card", cardx)
				.set(
					"goon",
					(function () {
						var getMax = function (card) {
							return Math.max.apply(
								Math,
								game
									.filterPlayer(function (current) {
										return current != player && lib.filter.targetEnabled2(card, player, current);
									})
									.map(function (i) {
										return get.effect(i, card, player, player) * Math.sqrt(Math.min(i.getHandcardLimit(), 1 + i.countCards("h")));
									})
									.concat([0])
							);
						};
						var eff1 = getMax(cardx);
						if (
							player.hasCard(function (card) {
								if ((card.name != "sha" && get.type(card) != "trick") || !player.hasValueTarget(card, null, true)) {
									return false;
								}
								return (
									getMax({
										name: get.name(card),
										nature: get.nature(card),
										isCard: true,
									}) >= eff1
								);
							}, "hs")
						) {
							return false;
						}
						return true;
					})()
				)
				.set("ai", function (target) {
					if (!_status.event.goon) {
						return 0;
					}
					var player = _status.event.player,
						card = _status.event.card;
					if (!lib.filter.targetEnabled2(card, player, target)) {
						return 0;
					}
					return get.effect(target, card, player, player) * Math.sqrt(Math.min(target.getHandcardLimit(), 1 + target.countCards("h")));
				})
				.forResult();
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("dcmingfa", target);
				var card = {
					name: trigger.card.name,
					nature: trigger.card.nature,
					isCard: true,
				};
				player.storage.dcmingfa_info = [card, target];
				player.addToExpansion(trigger.cards.filterInD(), "gain2").gaintag.add("dcmingfa");
			}
		},
		group: "dcmingfa_use",
		ai: { expose: 0.2 },
		intro: {
			mark(dialog, storage, player) {
				var cards = player.getExpansions("dcmingfa");
				if (!cards.length) {
					return "没有“明伐”牌";
				} else {
					dialog.add(cards);
				}
				var info = player.storage.dcmingfa_info;
				if (info) {
					dialog.addText("记录牌：" + get.translation(info[0]) + "<br>记录目标：" + get.translation(info[1]));
				}
			},
			content: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
			delete player.storage.dcmingfa_info;
		},
		subSkill: {
			use: {
				audio: "dcmingfa",
				trigger: { global: ["phaseEnd", "die"] },
				forced: true,
				filter(event, player) {
					if (!player.storage.dcmingfa_info || !player.getExpansions("dcmingfa").length) {
						return false;
					}
					return event.player == player.storage.dcmingfa_info[1];
				},
				async content(event, trigger, player) {
					const target = trigger.player;
					event.target = target;
					const card = player.storage.dcmingfa_info[0];
					delete player.storage.dcmingfa_info;
					event.card = card;
					const count = Math.max(1, Math.min(5, target.countCards("h")));
					if (event.player.isIn()) {
						for (let i = 0; i < count; i++) {
							if (target.isIn() && lib.filter.targetEnabled2(card, player, target)) {
								await player.useCard(get.copy(card), target);
							}
						}
					}
					const cards = player.getExpansions("dcmingfa");
					if (cards.length > 0) {
						await player.loseToDiscardpile(cards);
					}
				},
			},
		},
	},
	//蔡瑁张允
	lianzhou: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			if (!player.isLinked()) {
				return true;
			}
			return game.hasPlayer(function (current) {
				return current != player && current.hp == player.hp && !current.isLinked();
			});
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			if (!player.isLinked()) {
				await player.link();
			}
			// step 1
			const num = game.countPlayer(current => {
				return current != player && current.hp == player.hp && !current.isLinked();
			});
			if (num <= 0) {
				return;
			}
			result = await player
				.chooseTarget([1, num], "选择横置任意名体力值等于你的角色", function (card, player, current) {
					return current != player && current.hp == player.hp && !current.isLinked();
				})
				.set("ai", function (target) {
					const player = _status.event.player;
					return get.effect(target, { name: "tiesuo" }, player, player);
				})
				.forResult();
			// step 2
			if (result.bool) {
				const targets = result.targets.sortBySeat();
				player.line(targets, "green");
				for (const i of targets) {
					i.link();
				}
			}
		},
		ai: { halfneg: true },
	},
	jinglan: {
		audio: 2,
		trigger: { source: "damageSource" },
		forced: true,
		async content(event, trigger, player) {
			var delta = player.countCards("h") - player.hp;
			if (delta > 0) {
				player.chooseToDiscard("h", 4, true);
			} else if (delta == 0) {
				player.chooseToDiscard("he", true);
				player.recover();
			} else {
				player.damage("fire", "nosource");
				player.draw(5);
			}
		},
		ai: { halfneg: true },
	},
	//滕公主
	xingchong: {
		audio: 2,
		trigger: { global: "roundStart" },
		direct: true,
		filter(event, player) {
			return player.maxHp > 0;
		},
		async content(event, trigger, player) {
			var list = [];
			for (var i = 0; i <= Math.min(5, player.maxHp); i++) {
				list.push(get.cnNumber(i) + "张");
			}
			list.push("cancel2");
			const controlResult = await player
				.chooseControl(list)
				.set("prompt", get.prompt("xingchong"))
				.set("prompt2", "请首先选择摸牌的张数")
				.set("ai", function () {
					var player = _status.event.player,
						num1 = player.maxHp,
						num2 = player.countCards("h");
					if (num1 <= num2) {
						return 0;
					}
					return Math.ceil((num1 - num2) / 2);
				})
				.forResult();
			if (controlResult.control == "cancel2") {
				return;
			}
			player.logSkill("xingchong");
			const num2 = controlResult.index;
			if (num2 > 0) {
				await player.draw(num2);
			}
			const num = Math.min(5, player.maxHp) - num2;
			if (num == 0) {
				return;
			}
			if (player.countCards("h") <= 0) {
				return;
			}
			const cardResult = await player
				.chooseCard("h", [1, Math.min(player.countCards("h"), num)], "请选择要展示的牌")
				.set("ai", () => 1 + Math.random())
				.forResult();
			if (cardResult.bool) {
				var cards = cardResult.cards;
				player.showCards(cards, get.translation(player) + "发动了【幸宠】");
				player.addGaintag(cards, "xingchong");
				player.addTempSkill("xingchong_effect", "roundStart");
			}
		},
		subSkill: {
			effect: {
				audio: "xingchong",
				trigger: {
					player: ["loseAfter"],
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					var evt = event.getl(player);
					if (!evt || !evt.cards2 || !evt.cards2.length) {
						return false;
					}
					if (event.name == "lose") {
						for (var i in event.gaintag_map) {
							if (event.gaintag_map[i].includes("xingchong")) {
								return true;
							}
						}
						return false;
					}
					return player.hasHistory("lose", function (evt) {
						if (event != evt.getParent()) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("xingchong")) {
								return true;
							}
						}
						return false;
					});
				},
				forced: true,
				popup: false,
				charlotte: true,
				onremove(player) {
					player.removeGaintag("xingchong");
				},
				async content(event, trigger, player) {
					if (trigger.delay === false) {
						await game.delayx();
					}
					player.logSkill("xingchong_effect");
					let num = 0;
					if (trigger.name === "lose") {
						for (const i in trigger.gaintag_map) {
							if (trigger.gaintag_map[i].includes("xingchong")) {
								num++;
							}
						}
					} else {
						player.getHistory("lose", evt => {
							if (trigger !== evt.getParent()) {
								return false;
							}
							for (const i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("xingchong")) {
									num++;
								}
							}
						});
					}
					await player.draw(2 * num);
				},
			},
		},
	},
	liunian: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		forced: true,
		filter(event, player) {
			return game.hasGlobalHistory("cardMove", function (evt) {
				return evt.washCard && (evt.shuffleNumber == 1 || evt.shuffleNumber == 2);
			});
		},
		async content(event, trigger, player) {
			// step 0
			if (
				game.hasGlobalHistory("cardMove", function (evt) {
					return evt.washCard && evt.shuffleNumber == 1;
				})
			) {
				player.gainMaxHp();
				await game.delayx();
			}
			// step 1
			if (
				game.hasGlobalHistory("cardMove", function (evt) {
					return evt.washCard && evt.shuffleNumber == 2;
				})
			) {
				player.recover();
				await game.delayx();
			} else {
				return;
			}
			// step 2
			player.addSkill("liunian_effect");
			player.addMark("liunian_effect", 10, false);
		},
		subSkill: {
			effect: {
				charlotte: true,
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("liunian_effect");
					},
				},
				marktext: "年",
				intro: {
					content: "手牌上限+#",
				},
			},
		},
	},
};
