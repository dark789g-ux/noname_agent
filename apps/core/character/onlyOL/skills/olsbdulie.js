import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbdulie" | "olsbdouchan" | "olsbfumeng" | "olsbguidao" | "olsbzhuri">} */
export const groupSkills = {
	//OL谋太史慈
	olsbdulie: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			if (event.player == player || !event.isFirstTarget || event.targets.length != 1) {
				return false;
			}
			if (player.getAttackRange() <= 0) {
				return;
			}
			return ["basic", "trick"].includes(get.type(event.card));
		},
		prompt2(event, player) {
			return "令" + get.translation(event.card) + "额外结算一次，此牌结算完毕后，你摸等同于你攻击范围的牌";
		},
		check(event, player) {
			const num = Math.min(5, player.getAttackRange());
			if (get.effect(player, event.card, event.player, player) > 0) {
				return true;
			}
			if (event.card.name == "guohe" || event.card.name == "shunshou" || event.card.name == "zhujinqiyuan") {
				return num > (event.effectCount || 0);
			}
			if (!get.tag(event.card, "damage")) {
				return true;
			}
			return num > 1;
		},
		usable: 1,
		async content(event, trigger, player) {
			trigger.getParent().effectCount++;
			player
				.when({ global: "useCardAfter" })
				.filter(evt => evt == trigger.getParent())
				.step(async () => {
					const num = Math.min(5, player.getAttackRange());
					if (num > 0) {
						await player.draw(num);
					}
				});
		},
	},
	olsbdouchan: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		async content(event, trigger, player) {
			const card = get.cardPile2(card => card.name == "juedou");
			if (card) {
				player.gain(card, "gain2");
			} else if (player.countMark("olsbdouchan") < game.players.length + game.dead.length) {
				player.addMark("olsbdouchan", 1, false);
			}
		},
		mod: {
			attackRange(player, num) {
				return num + player.countMark("olsbdouchan");
			},
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + player.countMark("olsbdouchan");
				}
			},
		},
		intro: { content: "<li>攻击距离+#<br><li>使用【杀】的次数上限+#" },
	},
	//OL谋关羽
	//可以和手杀谋关羽组成卧龙凤雏了
	olsbfumeng: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return player.countCards("h", card => {
				if (_status.connectMode) {
					return true;
				}
				return get.name(card, player) != "sha";
			});
		},
		direct: true,
		async content(event, trigger, player) {
			const { bool, cards } = await player
				.chooseCard(
					get.prompt2("olsbfumeng"),
					[1, Infinity],
					(card, player) => {
						return get.name(card, player) != "sha";
					},
					"allowChooseAll"
				)
				.set("ai", card => {
					const player = get.event().player;
					if (player.hasSkill("olsbfumeng")) {
						return 7 - get.value(card);
					}
					return 4.5 - get.value(card);
				})
				.forResult();
			if (!bool) {
				return;
			}
			player.logSkill("olsbfumeng");
			player.addSkill("olsbfumeng_buff");
			player.addGaintag(cards, "olsbfumeng_buff");
		},
		subSkill: {
			buff: {
				charlotte: true,
				mod: {
					cardname(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("olsbfumeng_buff")) {
							return "sha";
						}
					},
				},
			},
		},
	},
	olsbguidao: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (event.olsbguidao_num > 2) {
				return false;
			}
			const card = new lib.element.VCard({ name: "juedou", storage: { olsbguidao: true }, isCard: true });
			return (
				game.hasPlayer(target => {
					return player.canUse(card, target, false);
				}) &&
				player.countCards("he", cardx => {
					return player.canRecast(cardx);
				}) >= 2 &&
				player.countCards("he", cardx => {
					return get.name(cardx, player) == "sha" && player.canRecast(cardx);
				}) >= event.olsbguidao_num
			);
		},
		onChooseToUse(event) {
			if (!game.online && !event.olsbguidao_num) {
				const player = event.player,
					history = player.getHistory("custom", evt => evt.olsbguidao_num);
				if (!history.length) {
					event.set("olsbguidao_num", 1);
				} else {
					const evt = history[history.length - 1];
					event.set("olsbguidao_num", evt.olsbguidao_num);
				}
			}
		},
		filterCard(card, player) {
			const num = get.event().olsbguidao_num;
			if (ui.selected.cards.filter(cardx => get.name(cardx, player) == "sha").length < num && get.name(card, player) != "sha") {
				return false;
			}
			return player.canRecast(card);
		},
		selectCard: 2,
		position: "he",
		check(card) {
			const player = get.event().player;
			if (get.name(card, player) == "sha") {
				return 1 / (get.value(card) || 0.5);
			}
			return 7 - get.value(card);
		},
		complexCard: true,
		lose: false,
		discard: false,
		delay: 0,
		filterTarget(card, player, target) {
			const cardx = new lib.element.VCard({ name: "juedou", storage: { olsbguidao: true }, isCard: true });
			return player.canUse(cardx, target, false);
		},
		prompt() {
			let str = "重铸两张牌";
			const num = get.event().olsbguidao_num;
			if (num > 0) {
				str += "（至少重铸" + get.cnNumber(num) + "张【杀】）";
			}
			str += "并视为使用【决斗】";
			return str;
		},
		async content(event, trigger, player) {
			const target = event.target,
				cards = event.cards;
			player.getHistory("custom").push({
				olsbguidao_num: cards.filter(card => get.name(card, player) == "sha").length + 1,
			});
			const card = new lib.element.VCard({ name: "juedou", storage: { olsbguidao: true }, isCard: true });
			await player.recast(cards);
			player.addTempSkill("olsbguidao_buff");
			if (player.canUse(card, target, false)) {
				player.useCard(card, target, false);
			}
		},
		ai: {
			order(item, player) {
				const card = new lib.element.VCard({ name: "juedou", storage: { olsbguidao: true }, isCard: true });
				const order = get.order(card, player);
				if (order <= 0) {
					return 0;
				}
				return order + 0.1;
			},
			result: {
				target(player, target) {
					const card = new lib.element.VCard({
						name: "juedou",
						storage: { olsbguidao: true },
						isCard: true,
					});
					return get.sgn(get.attitude(player, target)) * get.effect(target, card, player, player);
				},
			},
		},
		subSkill: {
			buff: {
				charlotte: true,
				trigger: { global: "damageBegin3" },
				filter(event, player) {
					if (!event.card || !event.card.storage || !event.card.storage.olsbguidao) {
						return false;
					}
					if (!event.source || event.source != player) {
						return false;
					}
					const evt = event.getParent("useCard");
					return evt.player == player && evt.targets.includes(event.player);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const target = trigger.player;
					const { control } = await target
						.chooseControl("【杀】更多", "非【杀】更多")
						.set("prompt", "归刀：请猜测" + get.translation(player) + "手牌中【杀】与非【杀】牌数哪个更多")
						.set("prompt2", "若猜错，则" + get.translation(trigger.card) + "对你造成的伤害+1")
						.set("ai", () => _status.event.controls.randomGet())
						.forResult();
					const goon1 = player.countCards("h", card => get.name(card, player) == "sha") >= player.countCards("h", card => get.name(card, player) != "sha");
					const goon2 = player.countCards("h", card => get.name(card, player) != "sha") >= player.countCards("h", card => get.name(card, player) == "sha");
					if ((goon1 && control == "【杀】更多") || (goon2 && control == "非【杀】更多")) {
						target.popup("洗具");
						game.log(target, "猜测", "#g正确");
					} else {
						target.popup("杯具");
						game.log(target, "猜测", "#y错误");
						trigger.num++;
					}
				},
			},
		},
	},
	//OL谋姜维
	olsbzhuri: {
		audio: 2,
		trigger: {
			player: "phaseAnyEnd",
		},
		filter(event, player) {
			if (!game.hasPlayer(target => player.canCompare(target))) {
				return false;
			}
			return player.getHistory("gain", evt => evt.getParent(event.name) == event).length + player.getHistory("lose", evt => evt.getParent(event.name) == event && evt.hs.length).length;
		},
		direct: true,
		async content(event, trigger, player) {
			var result = await player
				.chooseTarget(get.prompt2("olsbzhuri"), (card, player, target) => {
					return player.canCompare(target);
				})
				.set("ai", target => {
					var player = _status.event.player;
					var ts = target.getCards("h").sort((a, b) => get.number(a) - get.number(b));
					if (get.attitude(player, target) < 0) {
						var hs = player.getCards("h").sort((a, b) => get.number(b) - get.number(a));
						var ts = target.getCards("h").sort((a, b) => get.number(b) - get.number(a));
						if (get.number(hs[0]) > get.number(ts[0])) {
							return 1;
						}
						if (get.effect(player, { name: "losehp" }, player, player) > 0) {
							return Math.random() + 0.2;
						}
						if (player.getHp() > 2) {
							return Math.random() - 0.5;
						}
						return 0;
					}
					return 0;
				})
				.forResult();
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("olsbzhuri", target);
				var result2 = await player.chooseToCompare(target).forResult();
				if (result2.bool) {
					var cards = [result2.player, result2.target].filterInD("d");
					cards = cards.filter(card => player.hasUseTarget(card));
					if (cards.length) {
						var result3 = await player
							.chooseButton(["是否使用其中的牌？", cards])
							.set("ai", button => _status.event.player.getUseValue(button.link))
							.forResult();
						if (result3.bool) {
							var card = result3.links[0];
							player.$gain2(card, false);
							await game.delayx();
							await player.chooseUseTarget(true, card, false);
						}
					}
				} else {
					var list = lib.skill.olsbranji.getList(trigger);
					var result3 = await player
						.chooseControl("失去体力", "技能失效")
						.set("prompt", "逐日：失去1点体力，或令此技能于本回合失效")
						.set("ai", () => {
							var player = _status.event.player;
							if (player.getHp() > 2) {
								var list = _status.event.list;
								list.removeArray(player.skipList);
								if (list.includes("phaseDraw") || list.includes("phaseUse")) {
									return "失去体力";
								}
							}
							if (get.effect(player, { name: "losehp" }, player, player) > 0) {
								return "失去体力";
							}
							return "技能失效";
						})
						.set("list", list.slice(trigger.getParent().num, list.length))
						.forResult();
					if (result3.control == "失去体力") {
						player.loseHp(1);
					} else {
						player.addTempSkill("olsbzhuri_block");
						player.tempBanSkill("olsbzhuri");
					}
				}
			}
		},
		subSkill: {
			block: {
				charlotte: true,
				mark: true,
				marktext: '<span style="text-decoration: line-through;">日</span>',
				intro: { content: "追不动太阳了" },
			},
		},
	},
};
