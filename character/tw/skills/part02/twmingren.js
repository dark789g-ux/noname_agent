import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twmingren" | "twzhenliang" | "twfenwu" | "twfupan">} */
export const groupSkills = {
	//卢植
	twmingren: {
		marktext: "任",
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
		group: "twmingren_change",
		audio: "nzry_mingren_1",
		trigger: { global: "phaseBefore", player: "enterGame" },
		forced: true,
		locked: false,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && !player.getExpansions("twmingren").length;
		},
		async content(event, trigger, player) {
			await player.draw();
			if (!player.countCards("h")) {
				return;
			}
			const result = await player
				.chooseCard("h", "明任：将一张手牌置于武将牌上，称为“任”", true)
				.set("ai", function (card) {
					return 6 - get.value(card);
				})
				.forResult();
			if (result.bool) {
				const next = player.addToExpansion(result.cards[0], player, "give", "log");
				next.gaintag.add(event.name);
				await next;
			}
		},
		subSkill: {
			change: {
				audio: "nzry_mingren_1",
				trigger: { player: ["phaseUseBegin", "phaseUseEnd"] },
				filter(event, player) {
					return player.countCards("he") && player.getExpansions("twmingren").length;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseCard(
							"he",
							get.prompt(event.skill),
							"选择一张牌替换“任”（" + get.translation(player.getExpansions("twmingren")[0]) + "）"
						)
						.set("ai", card => {
							const player = _status.event.player;
							const color = get.color(card);
							if (color == get.color(player.getExpansions("twmingren")[0])) {
								return false;
							}
							let num = 0;
							const list = [];
							player.countCards("he", function (cardx) {
								if (cardx != card || get.color(cardx) != color) {
									return false;
								}
								if (list.includes(cardx.name)) {
									return false;
								}
								list.push(cardx.name);
								switch (cardx.name) {
									case "wuxie":
										num += game.countPlayer() / 2.2;
										break;
									case "caochuan":
										num += 1.1;
										break;
									case "shan":
										num += 1;
										break;
								}
							});
							return num * (30 - get.value(card));
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const card = player.getExpansions("twmingren")[0];
					const next = player.addToExpansion(event.cards[0], "log", "give", player);
					next.gaintag.add("twmingren");
					await next;
					if (card) {
						await player.gain(card, "gain2");
					}
				},
			},
		},
		ai: { combo: "twzhenliang" },
	},
	twzhenliang: {
		inherit: "nzry_zhenliang",
		intro: {
			content(storage, player, skill) {
				if (storage) {
					return "当你或你攻击范围内的一名角色于你的回合外受到伤害时，你可以弃置一张牌令此伤害-1。然后若你以此法弃置的牌颜色与“任”的颜色相同，你摸一张牌。";
				}
				return "出牌阶段限一次。你可以弃置一张牌并对攻击范围内的一名角色造成1点伤害。然后若你以此法弃置的牌颜色与“任”的颜色相同，你摸一张牌。";
			},
		},
		trigger: { global: "damageBegin4" },
		filter(event, player) {
			if (!player.countCards("he")) {
				return false;
			}
			if (event.name == "chooseToUse") {
				if (player.storage.twzhenliang || player.hasSkill("twzhenliang_used", null, null, false)) {
					return false;
				}
				return game.hasPlayer(current => player.inRange(current));
			} else {
				if (_status.currentPhase == player || !player.storage.twzhenliang) {
					return false;
				}
				return (event.num > 0 && event.player == player) || player.inRange(event.player);
			}
		},
		async cost(event, trigger, player) {
			const { player: target } = trigger;
			const { bool, cards } = await player
				.chooseToDiscard("he", get.prompt(event.name.slice(0, -5), target), "弃置一张牌令此伤害-1")
				.set("ai", card => {
					const { player, goon } = get.event();
					if (goon) {
						const cardx = player.getExpansions("twmingren")[0];
						if (cardx && get.color(cardx) == get.color(card, player)) {
							return 10 - get.value(card);
						}
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("goon", get.attitude(player, target) > 0)
				.forResult();
			event.result = {
				bool: bool,
				cards: cards,
				targets: [target],
			};
		},
		filterCard: true,
		check(card) {
			const player = get.player(),
				cardx = player.getExpansions("twmingren")[0];
			if (cardx && get.color(cardx, player) == get.color(card, player)) {
				return 10 - get.value(card);
			}
			return 7 - get.value(card);
		},
		prompt: "弃置一张牌并对攻击范围内的一名角色造成1点伤害",
		async content(event, trigger, player) {
			const {
				targets: [target],
				name: skill,
				cards,
			} = event;
			player.changeZhuanhuanji(skill);
			const cardx = player.getExpansions("twmingren")[0];
			if (!trigger) {
				player.addTempSkill(skill + "_used", "phaseUseAfter");
				await target.damage("nocard");
			} else {
				trigger.num--;
			}
			if (cardx && get.color(cards[0], player) == get.color(cardx, player)) {
				await player.draw();
			}
		},
		ai: {
			order: 5,
			result: {
				player(player, target) {
					return get.damageEffect(target, player, player);
				},
			},
		},
		subSkill: { used: { charlotte: true } },
	},
	//张南
	twfenwu: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && player.canUse("sha", current, false, false);
			});
		},
		direct: true,
		content() {
			"step 0";
			var list = [];
			player.getHistory("useCard", function (evt) {
				if (get.type(evt.card) != "basic") {
					return;
				}
				var name = evt.card.name,
					nature = game.hasNature(evt.card) ? get.nature(evt.card) : "";
				if (!list.includes(name + nature)) {
					list.push(name + nature);
				}
			});
			event.addDamage = list.length > 1;
			player
				.chooseTarget(
					get.prompt("twfenwu"),
					"失去1点体力并视为使用一张无距离限制的【杀】" + (event.addDamage ? "（伤害基数+1）" : ""),
					function (card, player, target) {
						return target != player && player.canUse("sha", target, false, false);
					}
				)
				.set("ai", function (target) {
					var player = _status.event.player;
					if (player.hp + player.countCards("hs", { name: ["tao", "jiu"] }) <= 1) {
						return -1;
					}
					var num = 1;
					if (
						(!target.mayHaveShan(player, "use") ||
							player.hasSkillTag(
								"directHit_ai",
								true,
								{
									target: target,
									card: { name: "sha" },
								},
								true
							)) &&
						!target.hasSkillTag("filterDamage", null, {
							player: player,
							card: { name: "sha" },
						})
					) {
						num = 1.3;
					}
					return get.effect(target, { name: "sha" }, player, player) * num;
				});
			"step 1";
			if (result.bool) {
				var num = 1;
				var target = result.targets[0];
				player.logSkill("twfenwu", target);
				player.loseHp();
				if (event.addDamage) {
					num = 2;
					game.log("#y杀", "的伤害基数+1");
				}
				player.useCard({ name: "sha", isCard: true }, target, false).baseDamage = num;
			}
		},
	},
	//呼厨泉
	twfupan: {
		audio: 3,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		onremove: true,
		async content(event, trigger, player) {
			player.storage.twfupan ??= {};
			await player.draw(trigger.num);
			if (
				!player.countCards("he") ||
				!game.hasPlayer(current => {
					return !(player.storage.twfupan[current.playerid] >= 2) && player != current;
				})
			) {
				return;
			}
			const next = player.chooseCardTarget({
				filterCard: true,
				position: "he",
				forced: true,
				filterTarget(card, player, target) {
					return !(player.storage.twfupan[target.playerid] >= 2) && player != target;
				},
				ai1(card) {
					const player = get.player();
					if (get.value(card, false, "raw") < 0) {
						return 20 * get.value(card);
					}
					if (player == _status.currentPhase) {
						return 20 - player.getUseValue(card);
					}
					return 20 - get.value(card);
				},
				ai2(target) {
					const player = get.player();
					const att = get.attitude(player, target);
					if (ui.selected.cards.length && get.value(ui.selected.cards[0], false, "raw") < 0) {
						return -0.1 - att;
					}
					if (player.storage.twfupan[target.playerid] === undefined) {
						return 5;
					} else if (player.storage.twfupan[target.playerid] === 1) {
						return get.damageEffect(target, player, player);
					}
					return 1;
				},
				prompt: "请选择要交出的卡牌和目标角色",
			});
			next.set(
				"targetprompt2",
				next.targetprompt2.concat([
					target => {
						const evt = get.event();
						if (!target.isIn() || !evt.filterTarget(null, evt.player, target)) {
							return;
						}
						return !evt.player.storage.twfupan[target.playerid] ? "你摸两张牌" : "可对其<br>造成伤害";
					},
				])
			);
			const result = await next.forResult();
			if (result?.cards?.length && result.targets?.length) {
				const {
					cards,
					targets: [target],
				} = result;
				player.line(target, "green");
				await player.give(cards, target);
				if (!player.storage.twfupan[target.playerid]) {
					player.storage.twfupan[target.playerid] = 1;
					await player.draw(2);
				} else {
					const result = await player
						.chooseBool(`复叛：是否对${get.translation(target)}造成1点伤害？`, "然后你不能再因此技能交给其牌")
						.set("ai", () => _status.event.bool)
						.set("bool", get.damageEffect(target, player, player) > 0)
						.forResult();
					if (result?.bool) {
						player.storage.twfupan[target.playerid]++;
						player.line(target, "fire");
						await target.damage();
					}
				}
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			threaten: 0.9,
		},
	},
};
