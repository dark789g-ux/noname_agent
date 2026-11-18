import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const yongjinSkills = {
	yongjin: {
		audio: 2,
		audioname: ["xin_lingtong"],
		limited: true,
		skillAnimation: true,
		animationColor: "wood",
		enable: "phaseUse",
		filter(event, player, cards) {
			return game.hasPlayer(function (current) {
				var es = current.getCards("e", function (card) {
					return !cards || !cards.includes(card);
				});
				for (var i = 0; i < es.length; i++) {
					if (
						game.hasPlayer(function (current2) {
							return current != current2 && !current2.isMin() && current2.canEquip(es[i]);
						})
					) {
						return true;
					}
				}
			});
		},
		async content(event, trigger, player) {
			// step 0
			player.awakenSkill(event.name);
			event.count = 3;
			event.cards = [];

			while (event.count > 0) {
				// step 1
				event.count--;
				if (!lib.skill.yongjin.filter(null, player, event.cards)) {
					break;
				}

				const chooseTargetResult = await player
					.chooseTarget(2, function (card, player, target) {
						if (ui.selected.targets.length) {
							var from = ui.selected.targets[0];
							if (target.isMin()) {
								return false;
							}
							var es = from.getCards("e", function (card) {
								return !_status.event.cards.includes(card);
							});
							for (var i = 0; i < es.length; i++) {
								if (target.canEquip(es[i])) {
									return true;
								}
							}
							return false;
						} else {
							return (
								target.countCards("e", function (card) {
									return !_status.event.cards.includes(card);
								}) > 0
							);
						}
					})
					.set("ai", function (target) {
						var player = _status.event.player;
						var att = get.attitude(player, target);
						var sgnatt = get.sgn(att);
						if (ui.selected.targets.length == 0) {
							if (target == player && player.hasSkill("decadexuanfeng")) {
								if (
									player.countCards("e", function (card) {
										return (
											!_status.event.cards.includes(card) &&
											game.hasPlayer(function (current) {
												return current != target && current.canEquip(card) && get.effect(current, card, player, player) < 0;
											})
										);
									}) > 0
								) {
									return 18;
								}
								return 7;
							} else if (att > 0) {
								if (
									target.countCards("e", function (card) {
										return (
											get.value(card, target) < 0 &&
											!_status.event.cards.includes(card) &&
											game.hasPlayer(function (current) {
												return current != target && current.canEquip(card) && get.effect(current, card, player, player) < 0;
											})
										);
									}) > 0
								) {
									return 9;
								}
							} else if (att < 0) {
								if (
									game.hasPlayer(function (current) {
										if (current != target && get.attitude(player, current) > 0) {
											var es = target.getCards("e", function (card) {
												return !_status.event.cards.includes(card);
											});
											for (var i = 0; i < es.length; i++) {
												if (get.value(es[i], target) > 0 && current.canEquip(es[i]) && get.effect(current, es[i], player, current) > 0) {
													return true;
												}
											}
										}
									})
								) {
									return -att;
								}
							}
							return 0;
						}
						var es = ui.selected.targets[0].getCards("e", function (card) {
							return !_status.event.cards.includes(card);
						});
						var i;
						var att2 = get.sgn(get.attitude(player, ui.selected.targets[0]));
						for (i = 0; i < es.length; i++) {
							if (ui.selected.targets[0] == player && player.hasSkill("decadexuanfeng")) {
								var bool = game.hasPlayer(function (current) {
									return get.attitude(player, current) < 0 && current.countDiscardableCards(player, "he") > 0 && get.damageEffect(current, player, player) > 0;
								});
								if (
									bool &&
									player.countCards("e", function (card) {
										return !_status.event.cards.includes(card) && target.canEquip(card) && get.effect(target, card, player, player) > 0;
									})
								) {
									return 2.5 * Math.abs(att);
								} else if (bool) {
									return 1 / Math.max(1, Math.abs(att));
								} else {
									return get.damageEffect(target, player, player);
								}
							}
							if (sgnatt != 0 && att2 != 0 && sgnatt != att2 && get.sgn(get.value(es[i], ui.selected.targets[0])) == -att2 && get.sgn(get.effect(target, es[i], player, target)) == sgnatt && target.canEquip(es[i])) {
								return Math.abs(att);
							}
						}
						if (i == es.length) {
							return 0;
						}
						return -att * get.attitude(player, ui.selected.targets[0]);
					})
					.set("multitarget", true)
					.set("cards", event.cards)
					.set("targetprompt", ["被移走", "移动目标"])
					.set("prompt", "移动场上的一张装备牌")
					.forResult();

				// step 2
				if (chooseTargetResult.bool) {
					player.line2(chooseTargetResult.targets, "green");
					event.targets = chooseTargetResult.targets;
				} else {
					break;
				}

				// step 3
				await game.delay();

				// step 4
				if (event.targets.length == 2) {
					const chooseCardResult = await player
						.choosePlayerCard(
							"e",
							true,
							function (button) {
								var player = _status.event.player;
								var targets0 = _status.event.targets0;
								var targets1 = _status.event.targets1;
								if (get.attitude(player, targets0) > 0 && get.attitude(player, targets1) < 0) {
									if (get.value(button.link, targets0) < 0 && get.effect(targets1, button.link, player, targets1) > 0) {
										return 10;
									}
									return 0;
								} else {
									return get.value(button.link) * get.effect(targets1, button.link, player, player);
								}
							},
							event.targets[0]
						)
						.set("nojudge", event.nojudge || false)
						.set("targets0", event.targets[0])
						.set("targets1", event.targets[1])
						.set("filterButton", function (button) {
							if (_status.event.cards.includes(button.link)) {
								return false;
							}
							var targets1 = _status.event.targets1;
							return targets1.canEquip(button.link);
						})
						.set("cards", event.cards)
						.forResult();

					// step 5
					if (chooseCardResult.bool && chooseCardResult.links.length) {
						var link = chooseCardResult.links[0];
						event.cards.add(link);
						await event.targets[1].equip(link);
						event.targets[0].$give(link, event.targets[1]);
						await game.delay();
					} else {
						break;
					}
				} else {
					break;
				}
				// step 6 handled by while loop condition
			}
		},
		ai: {
			order: 7,
			result: {
				player(player) {
					var num = 0;
					var friends = game.filterPlayer(function (current) {
						return get.attitude(player, current) >= 4;
					});
					var vacancies = {
						equip1: 0,
						equip2: 0,
						equip3: 0,
						equip4: 0,
						equip5: 0,
					};
					for (var i = 0; i < friends.length; i++) {
						for (var j = 1; j <= 5; j++) {
							if (friends[i].hasEmptySlot(j)) {
								vacancies["equip" + j]++;
							}
						}
					}
					var sources = game.filterPlayer(function (current) {
						return ((current == player && current.hasSkill("decadexuanfeng")) || get.attitude(player, current) < 0) && current.countCards("e");
					});
					for (var i = 0; i < sources.length; i++) {
						var es = sources[i].getCards("e");
						for (var j = 0; j < es.length; j++) {
							var type = get.subtype(es[j]);
							if (sources[i] == player || (vacancies[type] > 0 && get.value(es[j]) > 0)) {
								num++;
								if (
									sources[i] == player &&
									vacancies[type] &&
									game.hasPlayer(function (current) {
										return get.attitude(player, current) < 0 && current.countDiscardableCards(player, "he") > 0 && get.damageEffect(current, player, player) > 0;
									})
								) {
									num += 0.5;
								}
								if (num >= 3) {
									return 1;
								}
								vacancies[type]--;
							}
						}
					}
					if (num && player.hp == 1) {
						return 0.5;
					}
					return 0;
				},
			},
		},
	},
	decadexuanfeng: {
		audio: "xuanfeng",
		audioname: ["boss_lvbu3", "re_heqi", "xin_lingtong"],
		mod: {
			aiOrder(player, card, num) {
				if (
					num <= 0 ||
					!player.isPhaseUsing() ||
					player.needsToDiscard() !== 2 ||
					!card.cards ||
					!card.cards.some(i => {
						return get.position(i) === "h";
					}) ||
					get.tag(card, "draw") ||
					get.tag(card, "gain")
				) {
					return;
				}
				if (get.type(card) == "equip" && player.hasCard(cardx => card != cardx && (!card.cards || !card.cards.includes(cardx)) && (player.hasSkill("yongjin") || get.subtype(card) == get.subtype(cardx)) && (get.position(cardx) == "e" || player.canUse(cardx, player)), "hes")) {
					return;
				}
				if (!game.hasPlayer(current => get.attitude(player, current) < 0 && current.countDiscardableCards(player, "he") > 0 && get.damageEffect(current, player, player) > 0)) {
					return;
				}
				return 0;
			},
		},
		trigger: {
			player: ["loseAfter", "phaseDiscardEnd"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (_status.dying.length) {
				return false;
			}
			if (event.name == "phaseDiscard") {
				var cards = [];
				player.getHistory("lose", function (evt) {
					if (evt && evt.type == "discard" && evt.getParent("phaseDiscard") == event && evt.hs) {
						cards.addArray(evt.hs);
					}
				});
				return cards.length > 1;
			} else {
				var evt = event.getl(player);
				return evt && evt.es && evt.es.length > 0;
			}
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(
					get.prompt2(event.skill),
					(card, player, target) => {
						if (player == target) {
							return false;
						}
						return target.countDiscardableCards(player, "he");
					},
					[1, 2]
				)
				.set("ai", target => {
					let player = get.event().player,
						att = get.attitude(player, target),
						hs = target.countCards("h"),
						es = target.countCards("e");
					if ((hs && target.hasSkillTag("noh")) || (es && target.hasSkillTag("noe"))) {
						att *= 0.8;
					} else {
						att = -att;
					}
					if (ui.selected.targets.length) {
						let pre = ui.selected.targets[0],
							damage = get.event().damage;
						if (get.attitude(player, pre) < 0 && (damage ? get.damageEffect(pre, player, player) > 0 : true) && pre.countCards("he") >= 2) {
							return 0;
						}
						if (damage) {
							return att + get.damageEffect(target, player, player);
						}
					}
					return att;
				})
				.set("damage", player == _status.currentPhase)
				.set("complexTarget", true)
				.forResult();
		},
		locked: false,
		async content(event, trigger, player) {
			const targets = event.targets;
			for (const target of targets) {
				let num = targets.length > 1 ? 1 : 2;
				if (get.mode() !== "identity" || player.identity !== "nei") {
					player.addExpose(0.2);
				}
				for (let i = 0; i < num; i++) {
					if (!target.countDiscardableCards(player, "he")) {
						break;
					}
					const next = player.discardPlayerCard(target, "he");
					if (i > 0) {
						next.set("prompt", `旋风：是否继续弃置${get.translation(target)}一张牌？`);
					} else {
						next.set("forced", true);
					}
				}
			}
			if (player !== _status.currentPhase) {
				return;
			}
			const result = await player
				.chooseTarget("是否对一名目标角色造成1点伤害？", (card, player, target) => {
					return _status.event.targets.includes(target);
				})
				.set("targets", targets)
				.set("ai", target => {
					const player = get.event().player;
					return get.damageEffect(target, player, player);
				})
				.forResult();
			if (result.bool) {
				player.line(result.targets[0], "thunder");
				await result.targets[0].damage();
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						return [1, 3];
					}
					if (get.tag(card, "damage") && target.hp > 2) {
						var num1 = target.countCards("h"),
							num2 = target.getHandcardLimit();
						if (num1 > num2) {
							return [1, 1];
						}
						if (num1 == num2) {
							return [1.1, _status.event.player == target ? 3 : 0.5];
						}
						if (num1 == num2 - 1) {
							return [0.1, _status.event.player == target ? 4.5 : 0.1];
						}
					}
					if (typeof card !== "object") {
						return;
					}
					if ((get.tag(card, "discard") || get.tag(card, "loseCard")) && target.countCards("h") > 0 && get.attitude(player, target) < 0) {
						return [1, -1];
					}
				},
			},
			reverseEquip: true,
			noe: true,
			threaten(player, target) {
				return target.countCards("e") + target.countCards("h") / 3;
			},
		},
	},
	oltuntian: {
		inherit: "tuntian",
		filter(event, player) {
			if (player == _status.currentPhase) {
				if (event.type != "discard") {
					return false;
				}
				var evt = event.getl(player);
				return (
					evt &&
					evt.cards2 &&
					evt.cards2.filter(function (i) {
						return get.name(i, evt.hs.includes(i) ? player : false) == "sha";
					}).length > 0
				);
			}
			if (event.name == "gain" && event.player == player) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.cards2 && evt.cards2.length > 0;
		},
	},
	olzaoxian: {
		inherit: "zaoxian",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp();
			player.addSkills("jixi");
			player.insertPhase();
		},
		ai: {
			combo: "oltuntian",
		},
	},
};
