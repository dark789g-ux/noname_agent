import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const dcshibeiSkills = {
	//十周年沮授
	dcshibei: {
		trigger: { player: "damageEnd" },
		forced: true,
		audio: 2,
		check(event, player) {
			return player.getHistory("damage").indexOf(event) == 0;
		},
		filter(event, player) {
			var index = player.getHistory("damage").indexOf(event);
			return index == 0 || index == 1;
		},
		async content(event, trigger, player) {
			if (player.getHistory("damage").indexOf(trigger) > 0) {
				await player.loseHp();
			} else {
				await player.recover();
			}
		},
		subSkill: {
			damaged: {},
			ai: {},
		},
		ai: {
			maixie_defend: true,
			threaten: 0.9,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (target.hujia) {
						return;
					}
					if (player._shibei_tmp) {
						return;
					}
					if (target.hasSkill("shibei_ai")) {
						return;
					}
					if (_status.event.getParent("useCard", true) || _status.event.getParent("_wuxie", true)) {
						return;
					}
					if (get.tag(card, "damage")) {
						if (target.getHistory("damage").length > 0) {
							return [1, -2];
						} else {
							if (get.attitude(player, target) > 0 && target.hp > 1) {
								return 0;
							}
							if (
								get.attitude(player, target) < 0 &&
								!player.hasSkillTag("damageBonus", "e", {
									target: target,
									card: card,
								})
							) {
								if (card.name == "sha") {
									return;
								}
								var sha = false;
								player._shibei_tmp = true;
								var num = player.countCards("h", function (card) {
									if (card.name == "sha") {
										if (sha) {
											return false;
										} else {
											sha = true;
										}
									}
									return get.tag(card, "damage") && player.canUse(card, target) && get.effect(target, card, player, player) > 0;
								});
								delete player._shibei_tmp;
								if (player.hasSkillTag("damage")) {
									num++;
								}
								if (num < 2) {
									var enemies = player.getEnemies();
									if (enemies.length == 1 && enemies[0] == target && player.needsToDiscard()) {
										return;
									}
									return 0;
								}
							}
						}
					}
				},
			},
		},
	},
	dcjianying: {
		audio: 2,
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object" && player.isPhaseUsing()) {
					var evt = lib.skill.dcjianying.getLastUsed(player);
					if (evt && evt.card && ((get.suit(evt.card) && get.suit(evt.card) == get.suit(card)) || (evt.card.number && evt.card.number == get.number(card)))) {
						return num + 10;
					}
				}
			},
		},
		trigger: { player: "useCard" },
		frequent: true,
		getLastUsed(player, event) {
			var history = player.getAllHistory("useCard");
			var index;
			if (event) {
				index = history.indexOf(event) - 1;
			} else {
				index = history.length - 1;
			}
			if (index >= 0) {
				return history[index];
			}
			return false;
		},
		filter(event, player) {
			var evt = lib.skill.dcjianying.getLastUsed(player, event);
			if (!evt || !evt.card) {
				return false;
			}
			return (lib.suit.includes(get.suit(evt.card)) && get.suit(evt.card) == get.suit(event.card)) || (typeof get.number(evt.card, false) == "number" && get.number(evt.card, false) == get.number(event.card));
		},
		async content(event, trigger, player) {
			await player.draw("nodelay");
		},
		group: "dcjianying_mark",
		init(player) {
			var history = player.getAllHistory("useCard");
			if (history.length) {
				var trigger = history[history.length - 1];
				if (get.suit(trigger.card, player) == "none" || typeof get.number(trigger.card, player) != "number") {
					return;
				}
				player.storage.dcjianying_mark = trigger.card;
				player.markSkill("dcjianying_mark");
				game.broadcastAll(
					function (player, suit) {
						if (player.marks.dcjianying_mark) {
							player.marks.dcjianying_mark.firstChild.innerHTML = get.translation(suit);
						}
					},
					player,
					get.suit(trigger.card, player)
				);
			}
		},
		onremove(player) {
			player.unmarkSkill("dcjianying_mark");
			delete player.storage.dcjianying_mark;
		},
		subSkill: {
			mark: {
				charlotte: true,
				trigger: { player: "useCard1" },
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (get.suit(trigger.card, player) == "none" || typeof get.number(trigger.card, player) != "number") {
						player.unmarkSkill("dcjianying_mark");
					} else {
						player.storage.dcjianying_mark = trigger.card;
						player.markSkill("dcjianying_mark");
						game.broadcastAll(
							function (player, suit) {
								if (player.marks.dcjianying_mark) {
									player.marks.dcjianying_mark.firstChild.innerHTML = get.translation(suit);
								}
							},
							player,
							get.suit(trigger.card, player)
						);
					}
				},
				intro: {
					markcount(card, player) {
						return get.strNumber(get.number(card, player));
					},
					content(card, player) {
						var suit = get.suit(card, player);
						var num = get.number(card, player);
						var str = "<li>上一张牌的花色：" + get.translation(suit);
						str += "<br><li>上一张牌的点数：" + get.strNumber(num);
						return str;
					},
				},
			},
		},
	},
	//十周年步练师
	dcanxu: {
		enable: "phaseUse",
		usable: 1,
		multitarget: true,
		audio: 2,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			var num = target.countCards("h");
			if (ui.selected.targets.length) {
				return num < ui.selected.targets[0].countCards("h");
			}
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (num > players[i].countCards("h")) {
					return true;
				}
			}
			return false;
		},
		selectTarget: 2,
		async content(event, trigger, player) {
			let gainner, giver;
			const { targets } = event;
			if (targets[0].countCards("h") < targets[1].countCards("h")) {
				gainner = targets[0];
				giver = targets[1];
			} else {
				gainner = targets[1];
				giver = targets[0];
			}
			const result = await gainner.gainPlayerCard(giver, true, "h", "visibleMove").forResult();
			if (result?.cards?.length) {
				const card = result.cards[0];
				if (gainner.getCards("h").includes(card) && get.suit(card, gainner) != "spade") {
					await player.draw();
				}
			}
			if (gainner.countCards("h") == giver.countCards("h")) {
				await player.recover();
			}
		},
		ai: {
			order: 10.5,
			threaten: 2.3,
			result: {
				target(player, target) {
					var num = target.countCards("h");
					var att = get.attitude(player, target);
					if (ui.selected.targets.length == 0) {
						if (att > 0) {
							return -1;
						}
						var players = game.filterPlayer();
						for (var i = 0; i < players.length; i++) {
							var num2 = players[i].countCards("h");
							var att2 = get.attitude(player, players[i]);
							if (num2 < num) {
								if (att2 > 0) {
									return -3;
								}
								return -1;
							}
						}
						return 0;
					} else {
						return 1;
					}
				},
				player: 1,
			},
		},
	},
	dczhuiyi: {
		audio: 2,
		trigger: { player: "die" },
		skillAnimation: true,
		animationColor: "wood",
		forceDie: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2("dczhuiyi"), function (card, player, target) {
					return player != target && _status.event.sourcex != target;
				})
				.set("forceDie", true)
				.set("ai", function (target) {
					var num = get.attitude(_status.event.player, target);
					if (num > 0) {
						if (target.hp == 1) {
							num += 2;
						}
						if (target.hp < target.maxHp) {
							num += 2;
						}
					}
					return num;
				})
				.set("sourcex", trigger.source)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.recover();
			await target.draw(game.countPlayer());
		},
		ai: {
			expose: 0.5,
		},
	},
	//OL界蔡文姬
	olbeige: {
		audio: "beige",
		audioname: ["ol_caiwenji"],
		trigger: { global: "damageEnd" },
		logTarget: "player",
		filter(event, player) {
			return event.card && event.card.name == "sha" && event.player.isIn() && player.countCards("he") > 0;
		},
		check(event, player) {
			let att = get.attitude(player, event.player);
			if (event.player.hasSkill("xinleiji")) {
				return att > 0;
			}
			if (att > 0 || event.player.isHealthy()) {
				return true;
			}
			if (!event.source) {
				return true;
			}
			att = get.attitude(player, event.source);
			return att <= 0 || event.source.isTurnedOver();
		},
		prompt2: "令其进行判定，然后你可根据判定结果，弃置一张牌并令其执行对应效果。",
		async content(event, trigger, player) {
			const target = trigger.player;
			const source = trigger.source;
			let result;

			// step 0
			result = await trigger.player.judge().forResult();

			// step 1
			const judgeResult = get.copy(result);
			let str = "是否弃置一张牌",
				strt = get.translation(target),
				strs = get.translation(source),
				goon = 0;
			switch (result.suit) {
				case "heart":
					if (target.isIn() && target.isDamaged()) {
						str += "，令" + strt + "回复1点体力";
						goon = get.recoverEffect(target, player, player);
					}
					break;
				case "diamond":
					if (target.isIn()) {
						str += "，令" + strt + "摸两张牌";
						goon = 2 * get.effect(target, { name: "draw" }, player, player);
					}
					break;
				case "spade":
					if (source && source.isIn()) {
						str += "，令" + strs + "翻" + (source.isTurnedOver() ? "回正" : "") + "面";
						goon = get.attitude(player, source) * (source.isTurnedOver() ? 2 : -2);
					}
					break;
				case "club":
					if (source && source.isIn()) {
						str += "，令" + strs + "弃置两张牌";
						var cards = source
							.getCards("he")
							.sort(function (a, b) {
								return get.value(a, source) - get.value(b, source);
							})
							.slice(0, 2);
						for (var i of cards) {
							goon += get.value(i, source);
						}
						goon *= -get.sgn(get.attitude(player, source));
					}
					break;
			}
			str += "？";
			var str2 = "若弃置点数为" + get.strNumber(result.number) + "的牌则收回自己弃置的牌";
			if (get.position(result.card, true) == "d") {
				str2 += "；若弃置花色为" + get.translation(result.suit) + "的牌则获得" + get.translation(result.card);
			}
			result = await player
				.chooseToDiscard({
					position: "he",
					prompt: str,
					prompt2: str2,
				})
				.set("goon", goon)
				.set("ai", function (card) {
					const { result, goon, player } = get.event();
					let eff = Math.min(7, goon);
					if (eff <= 0) {
						return 0;
					}
					if (get.suit(card, player) == result.suit) {
						eff += get.value(result.card, player);
					}
					if (get.number(card, player) == result.number) {
						return eff;
					}
					return eff - get.value(card);
				})
				.set("result", judgeResult)
				.forResult();

			// step 2
			if (result.bool) {
				const card = result.cards[0];
				switch (judgeResult.suit) {
					case "heart":
						if (target.isIn() && target.isDamaged()) {
							await target.recover().forResult();
						}
						break;
					case "diamond":
						if (target.isIn()) {
							await target.draw(2).forResult();
						}
						break;
					case "spade":
						if (source && source.isIn()) {
							await source.turnOver().forResult();
						}
						player.addExpose(0.1);
						break;
					case "club":
						if (source && source.isIn() && source.countCards("he") > 0) {
							await source.chooseToDiscard(2, "he", true).forResult();
						}
						player.addExpose(0.1);
						break;
				}

				// step 3
				var gains = [];
				if (get.position(judgeResult.card, true) == "d" && get.suit(card, player) == judgeResult.suit) {
					gains.push(judgeResult.card);
				}
				if (get.position(card, true) == "d" && get.number(card, player) == judgeResult.number) {
					gains.push(card);
				}
				if (gains.length) {
					player.gain(gains, "gain2");
				}
			}
		},
	},
};
