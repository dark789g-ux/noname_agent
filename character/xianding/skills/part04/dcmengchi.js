import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcmengchi" | "dcfangdu" | "dcjiexing">} */
export const groupSkills = {
	//袁姬
	dcmengchi: {
		audio: "dcfangdu",
		trigger: { player: ["linkBefore", "damageEnd"] },
		forced: true,
		filter(event, player) {
			var num = player.getStat("gain");
			if (num && num > 0) {
				return false;
			}
			if (event.name == "link") {
				return !player.isLinked();
			}
			return !event.hasNature();
		},
		content() {
			if (trigger.name == "link") {
				trigger.cancel();
			} else {
				player.recover();
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.itemtype(player) != "player" || player._dcmengchi_aiChecking || target.getStat("gain")) {
						return;
					}
					if (card.name == "tiesuo" && !target.isLinked()) {
						return 0;
					}
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (!get.tag(card, "damage") || get.tag(card, "natureDamage")) {
						return;
					}
					if (target.hp <= 1) {
						return 0.75;
					}
					if (
						!target.hasSkillTag("filterDamage", null, {
							player: player,
							card: card,
						}) &&
						player.hasSkillTag("damageBonus", false, {
							target: target,
							card: card,
						})
					) {
						if (target.hp > 2) {
							return 0.5;
						}
						return 0.75;
					}
					if (get.attitude(player, target) > 0) {
						return [0, 0];
					}
					var sha = player.getCardUsable({ name: "sha" });
					player._dcmengchi_aiChecking = true;
					var num = player.countCards("h", function (card) {
						if (get.name(card) == "sha") {
							if (sha == 0) {
								return false;
							} else {
								sha--;
							}
						}
						return player.canUse(card, target) && get.effect(target, card, player, player) > 0;
					});
					delete player._dcmengchi_aiChecking;
					if (player.hasSkillTag("damage")) {
						num++;
					}
					if (num < 2) {
						return [0, 0];
					}
				},
			},
		},
		mod: {
			cardEnabled(card, player) {
				if (!player.getStat("gain")) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (!player.getStat("gain")) {
					return false;
				}
			},
		},
	},
	dcfangdu: {
		audio: 2,
		trigger: {
			player: "damageEnd",
		},
		forced: true,
		filter(event, player) {
			if (player == _status.currentPhase) {
				return false;
			}
			return (
				(!event.hasNature() &&
					!player.hasHistory(
						"damage",
						evt => {
							return !evt.hasNature() && evt != event;
						},
						event
					)) ||
				(event.hasNature() &&
					!player.hasHistory(
						"damage",
						evt => {
							return evt.hasNature() && evt != event;
						},
						event
					) &&
					event.source &&
					event.source.isIn() &&
					event.source.countGainableCards(player, "h"))
			);
		},
		content() {
			"step 0";
			if (!trigger.hasNature()) {
				player.recover();
			} else {
				var cards = trigger.source.getGainableCards(player, "h");
				if (cards.length) {
					player.gain(cards.randomGet(), trigger.source, "giveAuto", "bySelf");
				}
			}
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (player._dcfangdu_aiChecking || target == _status.currentPhase) {
						return;
					}
					if (!get.tag(card, "damage") || player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (_status.event.getParent("useCard", true) || _status.event.getParent("_wuxie", true)) {
						return;
					}
					if (!get.tag(card, "natureDamage")) {
						if (target.hasHistory("damage", evt => !evt.hasNature())) {
							return 1.5;
						} else if (
							target.hp <= 1 ||
							(player.hasSkillTag("damageBonus", false, {
								target: target,
								card: card,
							}) &&
								!target.hasSkillTag("filterDamage", null, {
									player: player,
									card: card,
								}))
						) {
							return 0.75;
						} else {
							if (get.attitude(player, target) > 0) {
								return [0, 0];
							}
							var sha = player.getCardUsable({ name: "sha" });
							player._dcfangdu_aiChecking = true;
							var num = player.countCards("h", function (card) {
								if (get.name(card) == "sha") {
									if (sha == 0) {
										return false;
									} else {
										sha--;
									}
								}
								return player.canUse(card, target) && get.effect(target, card, player, player) > 0;
							});
							delete player._dcfangdu_aiChecking;
							if (player.hasSkillTag("damage")) {
								num++;
							}
							if (num < 2) {
								return [0, 0];
							}
						}
					}
					if (get.tag(card, "natureDamage") && !target.hasHistory("damage", evt => evt.hasNature()) && player.countCards("he") > 1) {
						return [1, 1, 1, -1];
					}
				},
			},
		},
	},
	dcjiexing: {
		audio: 2,
		trigger: { player: ["recoverEnd", "damageEnd", "loseHpEnd"] },
		check(event, player) {
			var current = _status.currentPhase;
			if (!player.hasSkill("dcmengchi") || get.attitude(player, current) >= 0) {
				return true;
			}
			var num = player.getStat("gain");
			if (num && num > 0) {
				return true;
			}
			if (current.countCards("hs", card => current.canUse(card, player) && get.effect(player, card, current, player) < 0) >= 2) {
				return false;
			}
			return true;
		},
		frequent: "check",
		content() {
			player.draw().gaintag = ["dcjiexing"];
			player.addTempSkill("dcjiexing_add");
		},
		subSkill: {
			add: {
				charlotte: true,
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("dcjiexing")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("dcjiexing")) {
							return false;
						}
					},
				},
				onremove(player) {
					player.removeGaintag("dcjiexing");
				},
			},
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (get.tag(card, "recover")) {
						return [1, 1];
					}
					if (get.tag(card, "damage")) {
						var draw = 0.9;
						if (target.hasSkill("dcmengchi") && target.getStat("gain")) {
							draw = 1.8;
						}
						if (
							target.hp <= 1 ||
							(card.name == "sha" && player.hasSkill("jiu")) ||
							(get.itemtype(player) == "player" &&
								!target.hasSkillTag("filterDamage", null, {
									player: player,
									card: card,
								}) &&
								player.hasSkillTag("damageBonus", false, {
									target: target,
									card: card,
								}))
						) {
							if (target.hp > 2) {
								return [1, draw];
							}
							return;
						}
						return [1, draw];
					}
				},
			},
		},
	},
};
