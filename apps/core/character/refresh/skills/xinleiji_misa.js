import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const xinleiji_misaSkills = {
	xinleiji_misa: {
		audio: "xinleiji",
		trigger: { player: "judgeEnd" },
		direct: true,
		disableReason: ["暴虐", "助祭", "弘仪", "孤影"],
		sourceSkill: "xinleiji",
		filter(event, player) {
			return !lib.skill.xinleiji_misa.disableReason.includes(event.judgestr) && ["spade", "club"].includes(event.result.suit);
		},
		async content(event, trigger, player) {
			// step 0
			event.num = 1 + ["club", "spade"].indexOf(trigger.result.suit);
			event.logged = false;
			if (event.num == 1 && player.isDamaged()) {
				event.logged = true;
				player.logSkill("xinleiji");
				await player.recover();
			}
			const result = await player
				.chooseTarget("雷击：是否对一名角色造成" + event.num + "点雷电伤害？")
				.set("ai", target => {
					const player = _status.event.player;
					let eff = get.damageEffect(target, player, target, "thunder");
					if (
						get.event().num > 1 &&
						!target.hasSkillTag("filterDamage", null, {
							player: player,
							card: null,
							nature: "thunder",
						})
					) {
						if (eff > 0) {
							eff -= 25;
						} else if (eff < 0) {
							eff *= 2;
						}
					}
					return eff * get.attitude(player, target);
				})
				.set("num", event.num)
				.forResult();

			// step 1
			if (result.bool && result.targets && result.targets.length) {
				if (!event.logged) {
					player.logSkill("xinleiji", result.targets);
				} else {
					player.line(result.targets, "thunder");
				}
				await result.targets[0].damage(event.num, "thunder");
			}
		},
	},
	xinguidao: {
		audio: 2,
		mod: {
			aiOrder(player, card, num) {
				if (num > 0 && get.itemtype(card) == "card" && get.color(card) == "black" && get.type(card) == "equip") {
					num * 1.35;
				}
			},
			aiValue(player, card, num) {
				if (num > 0 && get.itemtype(card) == "card" && get.color(card) == "black") {
					return num * 1.15;
				}
			},
			aiUseful(player, card, num) {
				if (num > 0 && get.itemtype(card) == "card" && get.color(card) == "black") {
					return num * 1.35;
				}
			},
		},
		locked: false,
		trigger: { global: "judge" },
		filter(event, player) {
			return player.hasCards("hes", { color: "black" });
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard({
					prompt: `${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`,
					filterCard(card) {
						const player = get.player();
						if (get.color(card) !== "black") {
							return false;
						}
						const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
						if (mod2 != "unchanged") {
							return mod2;
						}
						const mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
						if (mod != "unchanged") {
							return mod;
						}
						return true;
					},
					position: "hes",
					ai(card) {
						const trigger = get.event().getTrigger();
						const { player, judging } = get.event();
						const result = trigger.judge(card) - trigger.judge(judging);
						const attitude = get.attitude(player, trigger.player);
						if (attitude == 0 || result == 0) {
							if (trigger.player != player) {
								return 0;
							}
							if (game.hasPlayer(current => get.attitude(player, current) < 0)) {
								const checkx = lib.skill.xinleiji.judgeCheck(card, true) - lib.skill.xinleiji.judgeCheck(judging);
								if (checkx > 0) {
									return checkx;
								}
							}
							return 0;
						}
						let val = get.value(card);
						if (get.subtype(card) == "equip2") {
							val /= 2;
						} else {
							val /= 7;
						}
						if (attitude == 0 || result == 0) {
							return 0;
						}
						if (attitude > 0) {
							return result - val;
						}
						return -result - val;
					},
				})
				.set("judging", trigger.player.judging[0])
				.forResult();
		},
		popup: false,
		async content(event, trigger, player) {
			const next = player.respond({
				cards: event.cards,
				skill: event.name,
				highlight: true,
				noOrdering: true,
			});
			await next;
			const { cards } = next;
			if (cards?.length) {
				player.$gain2(trigger.player.judging[0]);
				await player.gain(trigger.player.judging[0]);
				const card = cards[0];
				if (get.suit(card) == "spade" && get.number(card) > 1 && get.number(card) < 10) {
					await player.draw("nodelay");
				}
				trigger.player.judging[0] = card;
				trigger.orderingCards.addArray(cards);
				game.log(trigger.player, "的判定牌改为", cards);
				await game.delay(2);
			}
		},
		ai: {
			rejudge: true,
			tag: { rejudge: 1 },
		},
	},
	reqingguo: {
		mod: {
			aiValue(player, card, num) {
				if (get.name(card) != "shan" && get.color(card) != "black") {
					return;
				}
				var cards = player.getCards("hs", function (card) {
					return get.name(card) == "shan" || get.color(card) == "black";
				});
				cards.sort(function (a, b) {
					return (get.name(b) == "shan" ? 1 : 2) - (get.name(a) == "shan" ? 1 : 2);
				});
				var geti = function () {
					if (cards.includes(card)) {
						return cards.indexOf(card);
					}
					return cards.length;
				};
				if (get.name(card) == "shan") {
					return Math.min(num, [6, 4, 3][Math.min(geti(), 2)]) * 0.6;
				}
				return Math.max(num, [6.5, 4, 3][Math.min(geti(), 2)]);
			},
			aiUseful() {
				return lib.skill.reqingguo.mod.aiValue.apply(this, arguments);
			},
		},
		locked: false,
		audio: 2,
		enable: ["chooseToRespond", "chooseToUse"],
		filterCard(card) {
			return get.color(card) == "black";
		},
		position: "hes",
		viewAs: { name: "shan" },
		viewAsFilter(player) {
			if (!player.countCards("hes", { color: "black" })) {
				return false;
			}
		},
		prompt: "将一张黑色牌当闪打出",
		check() {
			return 1;
		},
		ai: {
			order: 2,
			respondShan: true,
			skillTagFilter(player) {
				if (!player.countCards("hes", { color: "black" })) {
					return false;
				}
			},
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "respondShan") && current < 0) {
						return 0.6;
					}
				},
			},
		},
	},
	reqiangxi: {
		subSkill: {
			off: {
				sub: true,
			},
		},
		audio: 2,
		enable: "phaseUse",
		filterCard(card) {
			return get.subtype(card) == "equip1";
		},
		selectCard() {
			return [0, 1];
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			if (target.hasSkill("reqiangxi_off")) {
				return false;
			}
			return player.inRange(target);
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			// step 0
			if (cards.length === 0) {
				await player.loseHp();
			}
			// step 1
			target.addTempSkill("reqiangxi_off", "phaseUseAfter");
			await target.damage("nocard");
		},
		check(card) {
			return 10 - get.value(card);
		},
		position: "he",
		ai: {
			order: 8.5,
			result: {
				target(player, target) {
					if (!ui.selected.cards.length) {
						if (player.hp < 2) {
							return 0;
						}
						if (target.hp >= player.hp) {
							return 0;
						}
					}
					return get.damageEffect(target, player);
				},
			},
		},
		threaten: 1.5,
	},
	rehuoji: {
		selectionSpec: true,
		position: "hes",
		audio: 2,
		audioname: ["ol_sp_zhugeliang", "ol_pangtong"],
		enable: "chooseToUse",
		filterCard(card) {
			return get.color(card) == "red";
		},
		viewAs: {
			name: "huogong",
		},
		viewAsFilter(player) {
			if (!player.countCards("hes", { color: "red" })) {
				return false;
			}
		},
		prompt: "将一张红色牌当火攻使用",
		check(card) {
			var player = get.player();
			if (player.countCards("h") > player.hp) {
				return 6 - get.value(card);
			}
			return 4 - get.value(card);
		},
		ai: {
			fireAttack: true,
		},
	},
	rekanpo: {
		mod: {
			aiValue(player, card, num) {
				if (get.name(card) != "wuxie" && get.color(card) != "black") {
					return;
				}
				var cards = player.getCards("hs", function (card) {
					return get.name(card) == "wuxie" || get.color(card) == "black";
				});
				cards.sort(function (a, b) {
					return (get.name(b) == "wuxie" ? 1 : 2) - (get.name(a) == "wuxie" ? 1 : 2);
				});
				var geti = function () {
					if (cards.includes(card)) {
						return cards.indexOf(card);
					}
					return cards.length;
				};
				if (get.name(card) == "wuxie") {
					return Math.min(num, [6, 4, 3][Math.min(geti(), 2)]) * 0.6;
				}
				return Math.max(num, [6, 4, 3][Math.min(geti(), 2)]);
			},
			aiUseful() {
				return lib.skill.rekanpo.mod.aiValue.apply(this, arguments);
			},
		},
		locked: false,
		audio: 2,
		audioname: ["ol_sp_zhugeliang", "ol_pangtong"],
		position: "hes",
		enable: "chooseToUse",
		filterCard(card) {
			return get.color(card) == "black";
		},
		viewAsFilter(player) {
			return player.countCards("hes", { color: "black" }) > 0;
		},
		viewAs: {
			name: "wuxie",
		},
		prompt: "将一张黑色牌当无懈可击使用",
		check(card) {
			return 8 - get.value(card);
		},
	},
};
