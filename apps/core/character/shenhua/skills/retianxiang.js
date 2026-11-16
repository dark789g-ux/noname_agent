import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "retianxiang" | "retianxiang3" | "retianxiang2" | "xintianxiang" | "xintianxiang2" | "xintianxiang3" | "xintianxiang4" | "hongyan" | "xinhongyan">} */
export const groupSkills = {
	retianxiang: {
		audio: "tianxiang",
		audioname: ["daxiaoqiao", "re_xiaoqiao", "ol_xiaoqiao"],
		trigger: { player: "damageBegin4" },
		preHidden: true,
		filter(event, player) {
			return (
				player.countCards("h", function (card) {
					return _status.connectMode || get.suit(card, player) == "heart";
				}) > 0 && event.num > 0
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterCard(card, player) {
						return get.suit(card) == "heart" && lib.filter.cardDiscardable(card, player);
					},
					filterTarget(card, player, target) {
						return player != target;
					},
					ai1(card) {
						return 10 - get.value(card);
					},
					ai2(target) {
						const att = get.attitude(_status.event.player, target);
						const trigger = _status.event.getTrigger();
						let da = 0;
						if (_status.event.player.hp == 1) {
							da = 10;
						}
						const eff = get.damageEffect(target, trigger.source, target);
						if (att == 0) {
							return 0.1 + da;
						}
						if (eff >= 0 && att > 0) {
							return att + da;
						}
						if (att > 0 && target.hp > 1) {
							if (target.maxHp - target.hp >= 3) {
								return att * 1.1 + da;
							}
							if (target.maxHp - target.hp >= 2) {
								return att * 0.9 + da;
							}
						}
						return -att + da;
					},
					prompt: get.prompt(event.skill),
					prompt2: lib.translate[`${event.skill}_info`],
				})
				.setHiddenSkill(event.name.slice(0, -5))
				.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			const [card] = event.cards;
			trigger.cancel();
			await player.discard(event.cards);
			const result = await player
				.chooseControlList(
					true,
					function (event, player) {
						const target = _status.event.target;
						let att = get.attitude(player, target);
						if (target.hasSkillTag("maihp")) {
							att = -att;
						}
						if (att > 0) {
							return 0;
						} else {
							return 1;
						}
					},
					["令" + get.translation(target) + "受到伤害来源对其造成的1点伤害，然后摸X张牌（X为其已损失体力值且至多为5）", "令" + get.translation(target) + "失去1点体力，然后获得" + get.translation(event.cards)]
				)
				.set("target", target)
				.forResult();
			if (typeof result.index != "number") {
				return;
			}
			if (result.index) {
				event.related = target.loseHp();
			} else {
				event.related = target.damage(trigger.source || "nosource", "nocard");
			}
			await event.related;
			//if(event.related.cancelled||target.isDead()) return;
			if (result.index && card.isInPile()) {
				await target.gain(card, "gain2");
			} else if (target.getDamagedHp()) {
				await target.draw(Math.min(5, target.getDamagedHp()));
			}
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (get.tag(card, "damage") && target.countCards("he") > 1) {
						return 0.7;
					}
				},
			},
		},
	},
	retianxiang3: {
		trigger: { player: "loseHpAfter" },
		forced: true,
		popup: false,
		sourceSkill: "retianxiang",
		filter(event) {
			return event.type == "retianxiang";
		},
		vanish: true,
		async content(event, trigger, player) {
			await player.gain(player.storage.retianxiang3, "gain2");
			player.removeSkill("retianxiang3");
		},
		onremove(player) {
			const card = player.storage.retianxiang3;
			if (get.position(card) == "s") {
				game.cardsDiscard(card);
			}
			delete player.storage.retianxiang3;
		},
	},
	retianxiang2: {
		trigger: { player: "damageAfter" },
		forced: true,
		popup: false,
		sourceSkill: "retianxiang",
		filter(event) {
			return event.type == "retianxiang";
		},
		vanish: true,
		async content(event, trigger, player) {
			if (player.isDamaged()) {
				await player.draw(player.getDamagedHp());
			}
			player.removeSkill("retianxiang2");
		},
	},
	xintianxiang: {
		audio: "tianxiang",
		trigger: { player: "damageBefore" },
		filter(event, player) {
			return player.countCards("he", { suit: "heart" }) > 0 && event.num > 0 && !player.hasSkill("xintianxiang3");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterCard(card, player) {
						return get.suit(card) == "heart" && lib.filter.cardDiscardable(card, player);
					},
					filterTarget(card, player, target) {
						return player != target;
					},
					position: "he",
					ai1(card) {
						return 10 - get.value(card);
					},
					ai2(target) {
						const att = get.attitude(_status.event.player, target);
						const trigger = _status.event.getTrigger();
						let da = 0;
						if (_status.event.player.hp == 1) {
							da = 10;
						}
						if (trigger.num > 1) {
							if (target.maxHp > 5 && target.hp > 1) {
								return -att / 10 + da;
							}
							return -att + da;
						}
						const eff = get.damageEffect(target, trigger.source, target, trigger.nature);
						if (att == 0) {
							return 0.1 + da;
						}
						if (eff >= 0 && trigger.num == 1) {
							return att + da;
						}
						if (target.hp == target.maxHp) {
							return -att + da;
						}
						if (target.hp == 1) {
							if (target.maxHp <= 4 && !target.hasSkillTag("maixie")) {
								if (target.maxHp <= 3) {
									return -att + da;
								}
								return -att / 2 + da;
							}
							return da;
						}
						if (target.hp == target.maxHp - 1) {
							if (target.hp > 2 || target.hasSkillTag("maixie")) {
								return att / 5 + da;
							}
							if (att > 0) {
								return 0.02 + da;
							}
							return 0.05 + da;
						}
						return att / 2 + da;
					},
					prompt: get.prompt2(event.skill),
				})
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.player = event.targets[0];
			trigger.player.addSkill("xintianxiang2");
			trigger.player.storage.xintianxiang = player;
			await player.discard(event.cards[0]);
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (get.tag(card, "damage") && target.countCards("he") > 1) {
						return 0.7;
					}
				},
			},
		},
	},
	xintianxiang2: {
		trigger: { player: ["damageAfter", "damageCancelled", "damageZero"] },
		forced: true,
		popup: false,
		audio: false,
		vanish: true,
		sourceSkill: "xintianxiang",
		async content(event, trigger, player) {
			const source = player.storage.xintianxiang;
			if (source.isDead()) {
				return;
			}
			const num = player.maxHp - player.hp || 0;
			const str1 = "令" + get.translation(player) + "摸" + get.cnNumber(num) + "张牌";
			const str2 = "令" + get.translation(player) + "防止造成和受到的所有伤害且天香失效直到你下一回合开始";
			const att = get.attitude(source, player);
			let choice = "选项一";
			if (att < 0) {
				if (num >= 2) {
					choice = "选项二";
				}
			} else if (att > 0) {
				if (num < 2 && !player.hasSkillTag("maixie")) {
					choice = "选项二";
				}
			}
			const { control } = await source
				.chooseControl(function () {
					return _status.event.choice;
				})
				.set("choiceList", [str1, str2])
				.set("choice", choice)
				.forResult();
			if (control == "选项一") {
				if (player.isDamaged()) {
					await player.draw(player.maxHp - player.hp);
				}
			} else {
				player.storage.xintianxiang.addSkill("xintianxiang3");
				player.storage.xintianxiang.storage.xintianxiang3 = player;
				player.addSkill("xintianxiang4");
			}
			player.removeSkill("xintianxiang2");
			delete player.storage.xintianxiang;
		},
	},
	xintianxiang3: {
		trigger: { player: ["phaseZhunbeiBegin", "dieBegin"] },
		silent: true,
		sourceSkill: "xintianxiang",
		async content(event, trigger, player) {
			if (player.storage.xintianxiang3) {
				player.storage.xintianxiang3.removeSkill("xintianxiang4");
				delete player.storage.xintianxiang3;
			}
			player.removeSkill("xintianxiang3");
		},
	},
	xintianxiang4: {
		trigger: { source: "damageBefore", player: "damageBefore" },
		forced: true,
		mark: true,
		intro: {
			content: "防止造成和受到的一切伤害",
		},
		priority: 15,
		sourceSkill: "xintianxiang",
		async content(event, trigger, player) {
			trigger.cancel();
		},
		ai: {
			nofire: true,
			nothunder: true,
			nodamage: true,
			notrick: true,
			notricksource: true,
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "damage")) {
						return "zeroplayertarget";
					}
				},
				player(card, player, target, current) {
					if (get.tag(card, "damage")) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	hongyan: {
		audio: true,
		mod: {
			suit(card, suit) {
				if (suit == "spade") {
					return "heart";
				}
			},
		},
	},
	xinhongyan: {
		audio: "hongyan",
		mod: {
			suit(card, suit) {
				if (suit == "spade") {
					return "heart";
				}
			},
		},
		trigger: { global: "judge" },
		filter(event, player) {
			if (event.fixedResult && event.fixedResult.suit) {
				return event.fixedResult.suit == "heart";
			}
			return get.suit(event.player.judging[0], event.player) == "heart";
		},
		async cost(event, trigger, player) {
			const str = "红颜：" + get.translation(trigger.player) + "的" + (trigger.judgestr || "") + "判定为" + get.translation(trigger.player.judging[0]) + "，请将其改为一种花色";
			const { control } = await player
				.chooseControl("spade", "heart", "diamond", "club")
				.set("prompt", str)
				.set("ai", function () {
					const player = get.player();
					const judging = _status.event.judging;
					const trigger = _status.event.getTrigger();
					const list = lib.suit.slice(0);
					const attitude = get.attitude(player, trigger.player);
					if (attitude == 0) {
						return 0;
					}
					const getj = function (suit) {
						return trigger.judge({
							name: get.name(judging),
							nature: get.nature(judging),
							suit: suit,
							number: get.number(judging),
						});
					};
					list.sort(function (a, b) {
						return (getj(b) - getj(a)) * get.sgn(attitude);
					});
					return list[0];
				})
				.set("judging", trigger.player.judging[0])
				.forResult();
			event.result = {
				bool: control != "cancel2",
				cost_data: control,
			};
		},
		async content(event, trigger, player) {
			const control = event.cost_data;
			player.addExpose(0.25);
			player.popup(control);
			game.log(player, "将判定结果改为了", "#y" + get.translation(control + 2));
			if (!trigger.fixedResult) {
				trigger.fixedResult = {};
			}
			trigger.fixedResult.suit = control;
			trigger.fixedResult.color = get.color({ suit: control });
		},
		ai: {
			rejudge: true,
			tag: {
				rejudge: 0.4,
			},
			expose: 0.5,
		},
	},
};
