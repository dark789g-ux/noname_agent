import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhuandui" | "tianbian" | "jianzheng" | "qingxian">} */
export const groupSkills = {
	zhuandui: {
		audio: 2,
		group: ["zhuandui_respond", "zhuandui_use"],
		subSkill: {
			use: {
				audio: "zhuandui",
				trigger: { player: "useCardToPlayered" },
				check(event, player) {
					return get.attitude(player, event.target) < 0;
				},
				filter(event, player) {
					return event.card.name == "sha" && player.canCompare(event.target);
				},
				logTarget: "target",
				async content(event, trigger, player) {
					const result = await player.chooseToCompare(trigger.target).forResult();
					if (result.bool) {
						trigger.getParent().directHit.add(trigger.target);
					}
				},
			},
			respond: {
				audio: "zhuandui",
				trigger: { target: "useCardToTargeted" },
				check(event, player) {
					return get.effect(player, event.card, event.player, player) < 0;
				},
				filter(event, player) {
					return event.card.name == "sha" && player.canCompare(event.player);
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const result = await player.chooseToCompare(trigger.player).forResult();
					if (result.bool) {
						trigger.getParent().excluded.add(player);
					}
				},
			},
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (player._zhuandui_temp || tag !== "directHit_ai") {
					return false;
				}
				player._zhuandui_temp = true;
				var bool = (function () {
					if (arg.card.name != "sha" || get.attitude(player, arg.target) >= 0 || !arg.target.countCards("h")) {
						return false;
					}
					if (
						arg.target.countCards("h") == 1 &&
						(!arg.target.hasSkillTag(
							"freeShan",
							false,
							{
								player: player,
								card: arg.card,
								type: "use",
							},
							true
						) ||
							player.hasSkillTag("unequip", false, {
								name: arg.card ? arg.card.name : null,
								target: arg.target,
								card: arg.card,
							}) ||
							player.hasSkillTag("unequip_ai", false, {
								name: arg.card ? arg.card.name : null,
								target: arg.target,
								card: arg.card,
							}))
					) {
						return true;
					}
					return (
						player.countCards("h", function (card) {
							return card != arg.card && (!arg.card.cards || !arg.card.cards.includes(card)) && get.value(card) <= 4 && (get.number(card) >= 11 + arg.target.countCards("h") / 2 || get.suit(card, player) == "heart");
						}) > 0
					);
				})();
				delete player._zhuandui_temp;
				return bool;
			},
			effect: {
				target_use(card, player, target, current) {
					if (card.name == "sha" && current < 0) {
						return 0.7;
					}
				},
			},
		},
	},
	tianbian: {
		audio: 2,
		enable: "chooseCard",
		check(event, player) {
			var player = _status.event.player;
			return !player.hasCard(function (card) {
				var val = get.value(card);
				return val < 0 || (val <= 4 && (get.number(card) >= 11 || get.suit(card) == "heart"));
			}, "h")
				? 20
				: 0;
		},
		filter(event) {
			return event.type == "compare" && !event.directresult;
		},
		onCompare(player) {
			return game.cardsGotoOrdering(get.cards()).cards;
		},
		ai: {
			forceWin: true,
			skillTagFilter(player, tag, arg) {
				return arg.card && get.suit(arg.card, false) == "heart";
			},
		},
		group: "tianbian_number",
		subSkill: {
			number: {
				trigger: { player: "compare", target: "compare" },
				filter(event, player) {
					if (event.player == player) {
						return !event.iwhile && get.suit(event.card1) == "heart"; //&&event.card1.vanishtag.includes('tianbian');
					} else {
						return get.suit(event.card2) == "heart"; //&&event.card2.vanishtag.includes('tianbian');
					}
				},
				silent: true,
				async content(event, trigger, player) {
					game.log(player, "拼点牌点数视为", "#yK");
					if (player == trigger.player) {
						trigger.num1 = 13;
					} else {
						trigger.num2 = 13;
					}
				},
			},
		},
	},
	jianzheng: {
		audio: 2,
		trigger: { global: "useCardToPlayer" },
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			return event.player != player && event.card.name == "sha" && !event.targets.includes(player) && event.player.inRange(player);
		},
		async cost(event, trigger, player) {
			const { targets, player: playerx, card } = trigger;
			let effect = 0;
			for (let i = 0; i < targets.length; i++) {
				effect -= get.effect(targets[i], card, playerx, player);
			}
			if (effect > 0) {
				if (get.color(card) != "black") {
					effect = 0;
				} else {
					effect = 1;
				}
				if (targets.length == 1) {
					if (targets[0].hp == 1) {
						effect++;
					}
					if (effect > 0 && targets[0].countCards("h") < player.countCards("h")) {
						effect++;
					}
				}
				if (effect > 0) {
					effect += 6;
				}
			}
			event.result = await player
				.chooseCard("h", get.prompt2(event.skill, playerx))
				.set("ai", function (card) {
					if (_status.event.effect >= 0) {
						const val = get.value(card);
						if (val < 0) {
							return 10 - val;
						}
						return _status.event.effect - val;
					}
					return 0;
				})
				.set("effect", effect)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				cards: [card],
			} = event;
			game.log(player, "将", card, "置于牌堆顶");
			player.$throw(card, 1000);
			await player.lose(card, ui.cardPile, "visible", "insert");
			trigger.targets.length = 0;
			trigger.getParent().triggeredTargets1.length = 0;
			if (get.color(trigger.card) != "black") {
				trigger.getParent().targets.push(player);
				trigger.player.line(player);
				await game.delay();
			}
		},
		ai: {
			threaten: 1.1,
			expose: 0.25,
		},
	},
	qingxian: {
		audio: 2,
		group: ["qingxian_jilie", "qingxian_rouhe", "qingxian_dying"],
		ai: {
			threaten: 0.8,
			maixie: true,
			maixie_hp: true,
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (target.hp > 1 && target.hasFriend()) {
							return 0.4;
						}
					}
				},
			},
		},
		subSkill: {
			rouhe: {
				audio: "qingxian",
				trigger: { player: "recoverEnd" },
				filter(event, player) {
					return !_status.dying.length;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget({
							prompt: get.prompt("qingxian"),
							prompt2: "当你回复体力后，你可以令一名其他角色执行一项：失去1点体力，随机使用一张装备牌；回复1点体力，弃置一张装备牌。若其以此法使用或弃置的牌为梅花，你回复1点体力",
							filterTarget(card, player, target) {
								return target !== player;
							},
							ai(target) {
								const att = get.attitude(_status.event.player, target);
								if (target.isHealthy() && att > 0) {
									return 0;
								}
								if (target.hp == 1 && att != 0) {
									if (att > 0) {
										return 9;
									} else {
										return 10;
									}
								} else {
									return Math.sqrt(Math.abs(att));
								}
							},
						})
						.forResult();
				},
				logTarget: "targets",
				async content(event, trigger, player) {
					await lib.skill.qingxian.content_choose(event, trigger, player);
				},
			},
			jilie: {
				audio: "qingxian",
				trigger: { player: "damageEnd" },
				filter(event, player) {
					return event.source?.isIn() && !_status.dying.length;
				},
				check(event, player) {
					if (get.attitude(player, event.source) > 0 && event.source.isHealthy()) {
						return false;
					}
					return true;
				},
				logTarget: "source",
				prompt2: "当你受到伤害后，你可以令伤害来源执行一项：失去1点体力，随机使用一张装备牌；回复1点体力，弃置一张装备牌。若其以此法使用或弃置的牌为梅花，你回复1点体力",
				async content(event, trigger, player) {
					await lib.skill.qingxian.content_choose(event, trigger, player);
				},
			},
		},
		/**
		 * @type {ContentFuncByAll}
		 */
		async content_choose(event, trigger, player) {
			const { targets: [target] } = event;

			let resultIndex;
			if (target.isHealthy()) {
				resultIndex = 0;
			} else {
				let index;
				if (get.attitude(player, target) > 0) {
					index = 1;
				} else {
					index = 0;
				}

				const chooseResult = await player
					.chooseControlList({
						list: ["令" + get.translation(target) + "失去1点体力，随机使用一张装备牌", "令" + get.translation(target) + "回复1点体力，弃置一张装备牌"],
						forced: true,
						ai(event, player) {
							return get.event().index;
						},
					})
					.set("index", index)
					.forResult();
				resultIndex = chooseResult?.index || index;
			}
			let card = null;
			if (resultIndex == 0) {
				await target.loseHp();
				card = get.cardPile(card => get.type(card) == "equip" && target.canUse(card, target), false, "random");
				if (card) {
					await target.chooseUseTarget({
						card,
						throw: false,
						nopopup: true,
						forced: true,
					});
				}
			} else {
				await target.recover();
				if (target.countCards("he", { type: "equip" })) {
					const discardResult = await target
						.chooseToDiscard({
							prompt: "弃置一张装备牌",
							filterCard(card) {
								return get.type(card) === "equip";
							},
							position: "he",
							forced: true,
							ai(card) {
								let val = -get.value(card);
								if (get.suit(card) === "club") {
									val += get.event().att * 10;
								}
								return val;
							},
						})
						.set("att", get.sgnAttitude(target, player))
						.forResult();
					if (discardResult && discardResult.cards) {
						card = discardResult.cards[0];
					}
				}
			}
			if (card && get.suit(card) === "club") {
				await player.draw();
			}
		},
	},
};
