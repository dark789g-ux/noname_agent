import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "rekenshang" | "olkenshang" | "oljianman">} */
export const groupSkills = {
	//马休马铁
	rekenshang: {
		audio: "olkenshang",
		enable: "chooseToUse",
		filterCard: true,
		selectCard: [2, Infinity],
		viewAsFilter(player) {
			return player.countCards("hes") > 1;
		},
		check(card) {
			var player = _status.event.player;
			if (
				game.countPlayer(function (current) {
					return current != player && player.canUse("sha", current) && get.effect(current, { name: "sha" }, player, player) > 0;
				}) <= ui.selected.cards.length
			) {
				return 0;
			}
			if (_status.event.player.countCards("hes") >= 3) {
				return 8 - ui.selected.cards.length - get.value(card);
			}
			return 6 - ui.selected.cards.length - get.value(card);
		},
		position: "hes",
		viewAs: {
			name: "sha",
			storage: { olkenshang: true },
		},
		onuse(links, player) {
			player.addTempSkill("rekenshang_effect");
		},
		allowChooseAll: true,
		ai: {
			order(item, player) {
				if (player.countCards("hes") >= 3) {
					return 6;
				}
				return 4;
			},
			result: {
				target(player, target, card, isLink) {
					let eff = -1.5,
						odds = 1.35,
						num = 1;
					if (isLink) {
						let cache = _status.event.getTempCache("sha_result", "eff");
						if (typeof cache !== "object" || cache.card !== get.translation(card)) {
							return eff;
						}
						if (cache.odds < 1.35 && cache.bool) {
							return 1.35 * cache.eff;
						}
						return cache.odds * cache.eff;
					}
					if (
						player.hasSkill("jiu") ||
						player.hasSkillTag("damageBonus", true, {
							target: target,
							card: card,
						})
					) {
						if (
							target.hasSkillTag("filterDamage", null, {
								player: player,
								card: card,
								jiu: true,
							})
						) {
							eff = -0.5;
						} else {
							num = 2;
							if (get.attitude(player, target) > 0) {
								eff = -7;
							} else {
								eff = -4;
							}
						}
					}
					if (
						!player.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: target,
								card: card,
							},
							true
						)
					) {
						odds -= 0.7 * target.mayHaveShan(player, "use", true, "odds");
					}
					_status.event.putTempCache("sha_result", "eff", {
						bool: target.hp > num && get.attitude(player, target) > 0,
						card: get.translation(card),
						eff: eff,
						odds: odds,
					});
					return odds * eff;
				},
			},
			respondSha: true,
			skillTagFilter: player => player.countCards("hes") > 1,
		},
		subSkill: {
			effect: {
				audio: "olkenshang",
				trigger: { player: "useCard2" },
				charlotte: true,
				group: "rekenshang_after",
				direct: true,
				filter(event, player) {
					return (
						event.card.storage &&
						event.card.storage.olkenshang &&
						game.countPlayer(function (current) {
							return current != player && lib.filter.targetEnabled2(event.card, player, current) && lib.filter.targetInRange(event.card, player, current);
						}) >= event.cards.length
					);
				},
				content() {
					"step 0";
					player
						.chooseTarget(trigger.cards.length, "是否更改" + get.translation(trigger.card) + "的目标？", "选择" + get.cnNumber(trigger.cards.length) + "名角色作为" + get.translation(trigger.card) + "的目标，覆盖原先存在的目标", function (card, player, target) {
							var evt = _status.event.getTrigger();
							return target != player && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
						})
						.set("ai", function (target) {
							var evt = _status.event.getTrigger();
							return get.effect(target, evt.card, evt.player, evt.player);
						});
					"step 1";
					if (result.bool) {
						if (player != event.player && !player.isOnline()) {
							game.delayx();
						}
					} else {
						event.finish();
					}
					"step 2";
					var targets = result.targets;
					player.logSkill("rekenshang_effect", targets);
					trigger.targets.length = 0;
					trigger.targets.addArray(targets);
					game.log(targets, "成为了", trigger.card, "的新目标");
				},
			},
			after: {
				audio: "olkenshang",
				trigger: { player: "useCardAfter" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					if (event.card.name != "sha" || !event.card.storage || !event.card.storage.olkenshang) {
						return false;
					}
					var num = 0;
					game.countPlayer2(current => {
						current.getHistory("damage", evt => {
							if (evt.card == event.card) {
								num += evt.num;
							}
						});
					});
					return num < event.cards.length;
				},
				content() {
					player.draw();
				},
			},
		},
	},
	olkenshang: {
		audio: 2,
		enable: "phaseUse",
		filterCard: true,
		selectCard: [1, Infinity],
		check(card) {
			return 5.5 - get.value(card);
		},
		position: "hes",
		viewAs: {
			name: "sha",
			storage: { olkenshang: true },
		},
		onuse(links, player) {
			player.addTempSkill("olkenshang_effect");
		},
		allowChooseAll: true,
		ai: {
			order: 1,
			threaten: 1.1,
			effect: {
				player_use(card, player, target) {
					if (_status._olkenshang_aiChecking || ui.selected.targets.length) {
						return;
					}
					if (typeof card != "object" || !card.storage || !card.storage.olkenshang) {
						return false;
					}
					_status._olkenshang_aiChecking = true;
					var eff = 0;
					var targets = game.filterPlayer(current => current != player && player.canUse(card, current, false) && !player.inRange(current));
					for (var target of targets) {
						eff += get.effect(target, card, player, player);
					}
					delete _status._olkenshang_aiChecking;
					if (eff > 0) {
						return [0, eff / Math.max(0.01, get.attitude(player, player))];
					}
				},
			},
		},
		subSkill: {
			effect: {
				audio: "olkenshang",
				trigger: { player: "useCard2" },
				charlotte: true,
				logTarget(event, player) {
					return game.filterPlayer(current => current != player && player.canUse(event.card, current, false) && !player.inRange(current));
				},
				prompt2: "将此牌目标改为攻击范围外的所有其他角色",
				group: "olkenshang_after",
				check(event, player) {
					var eff1 = 0,
						eff2 = 0;
					for (var target of event.targets) {
						eff1 += get.effect(target, event.card, event.player, player);
					}
					var targets = game.filterPlayer(current => current != player && player.canUse(event.card, current, false) && !player.inRange(current));
					for (var target of targets) {
						eff2 += get.effect(target, event.card, event.player, player);
					}
					return eff2 > eff1;
				},
				filter(event, player) {
					return event.card.name == "sha" && event.card.storage && event.card.storage.olkenshang && event.targets.length && game.filterPlayer(current => current != player && player.canUse(event.card, current, false) && !player.inRange(current)).length;
				},
				content() {
					"step 0";
					trigger.targets.removeArray(trigger.targets);
					var targets = game.filterPlayer(current => current != player && player.canUse(trigger.card, current, false) && !player.inRange(current));
					if (targets.length) {
						trigger.targets.addArray(targets);
					}
				},
			},
			after: {
				audio: "olkenshang",
				trigger: { player: "useCardAfter" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					if (event.card.name != "sha" || !event.card.storage || !event.card.storage.olkenshang) {
						return false;
					}
					var num = 0;
					game.countPlayer2(current => {
						current.getHistory("damage", evt => {
							if (evt.card == event.card) {
								num += evt.num;
							}
						});
					});
					return num > 0;
				},
				content() {
					"step 0";
					var num = 0,
						len = trigger.cards.length;
					game.countPlayer2(current => {
						current.getHistory("damage", evt => {
							if (evt.card == trigger.card) {
								num += evt.num;
							}
						});
					});
					if (len > num) {
						player.draw(num);
						event.finish();
					} else {
						var skills = player.getSkills(null, false, false).filter(skill => {
							var info = get.info(skill);
							if (!info || info.charlotte || get.skillInfoTranslation(skill, player).length == 0) {
								return false;
							}
							return true;
						});
						if (skills.length == 1) {
							event._result = { control: skills[0] };
						} else {
							player
								.chooseControl(skills)
								.set(
									"choiceList",
									skills.map(i => {
										return '<div class="skill">【' + get.translation(lib.translate[i + "_ab"] || get.translation(i).slice(0, 2)) + "】</div><div>" + get.skillInfoTranslation(i, player, false) + "</div>";
									})
								)
								.set("displayIndex", false)
								.set("prompt", "垦伤：选择失去一个技能")
								.set("ai", () => {
									var choices = _status.event.controls.slice();
									var negs = choices.filter(i => {
										var info = get.info(i);
										if (!info || !info.ai) {
											return false;
										}
										return info.ai.neg || info.ai.halfneg;
									});
									if (negs.length) {
										return negs.randomGet();
									}
									if (choices.includes("mashu")) {
										return "mashu";
									}
									return choices.randomGet();
								});
						}
					}
					"step 1";
					player.removeSkills(result.control);
				},
			},
		},
	},
	//董荼那
	oljianman: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		forced: true,
		direct: true,
		filter(event, player) {
			var history = game.getGlobalHistory("useCard", evt => {
				return get.type(evt.card) == "basic";
			});
			if (history.length < 2) {
				return false;
			}
			var users = history.slice(0, 2).map(i => i.player);
			var list = users.filter(user => user == player);
			if (list.length == 1) {
				var target = users.filter(user => user != player)[0];
				return target && target.isIn() && target.countDiscardableCards(player, "he");
			}
			if (list.length == 2) {
				return history.slice(0, 2).some(evt => {
					var card = evt.card;
					return player.hasUseTarget({
						name: card.name,
						nature: card.nature,
						isCard: true,
					});
				});
			}
			return false;
		},
		content() {
			"step 0";
			var history = game.getGlobalHistory("useCard", evt => {
				return get.type(evt.card) == "basic";
			});
			var list = history
				.slice(0, 2)
				.map(i => i.player)
				.filter(user => user == player);
			if (list.length == 1) {
				var users = history.slice(0, 2).map(i => i.player);
				var target = users.filter(user => user != player)[0];
				player.logSkill("oljianman", target);
				player.discardPlayerCard(target, "he", true);
				event.finish();
			} else if (list.length == 2) {
				var evts = history.slice(0, 2);
				var vcard = [];
				for (var evt of evts) {
					var card = evt.card;
					if (vcard.length && vcard[0][2] == card.name && vcard[0][3] == card.nature) {
						continue;
					}
					if (player.hasUseTarget({ name: card.name, nature: card.nature, isCard: true })) {
						vcard.push(["基本", "", card.name, card.nature]);
					}
				}
				if (vcard.length == 1) {
					event._result = { bool: true, links: [vcard[0]] };
				} else {
					player.chooseButton(["鹣蛮：视为使用其中一张牌", [vcard, "vcard"]]).set("ai", function (button) {
						return _status.event.player.getUseValue({
							name: button.link[2],
							nature: button.link[3],
						});
					});
				}
			} else {
				event.finish();
			}
			"step 1";
			if (result.bool) {
				var card = { name: result.links[0][2], nature: result.links[0][3], isCard: true };
				player
					.chooseUseTarget(card, true)
					.set("logSkill", "oljianman")
					.set("prompt", "鹣蛮：选择" + get.translation(card) + "的目标");
			}
		},
	},
};
