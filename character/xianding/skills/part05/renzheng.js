import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "renzheng" | "jinjian" | "tiqi" | "baoshu">} */
export const groupSkills = {
	//骆统
	renzheng: {
		audio: 2,
		trigger: { global: ["damageCancelled", "damageZero", "damageAfter"] },
		forced: true,
		filter(event, player, name) {
			if (name == "damageCancelled") {
				return true;
			}
			for (var i of event.change_history) {
				if (i < 0) {
					return true;
				}
			}
			return false;
		},
		content() {
			player.draw(2);
		},
	},
	jinjian: {
		audio: 2,
		trigger: { source: "damageBegin1" },
		logTarget: "player",
		filter(event, player) {
			return !event.jinjian_source2 && !player.hasSkill("jinjian_source2");
		},
		prompt2: "令即将对其造成的伤害+1",
		check(event, player) {
			return (
				get.attitude(player, event.player) < 0 &&
				!event.player.hasSkillTag("filterDamage", null, {
					player: player,
					card: event.card,
				})
			);
		},
		content() {
			trigger.jinjian_source = true;
			trigger.num++;
			player.addTempSkill("jinjian_source2");
		},
		group: "jinjian_player",
		subSkill: {
			player: {
				audio: "jinjian",
				trigger: { player: "damageBegin4" },
				filter(event, player) {
					return !event.jinjian_player2 && !player.hasSkill("jinjian_player2");
				},
				prompt2: "令即将受到的伤害-1",
				content() {
					trigger.jinjian_player = true;
					trigger.num--;
					player.addTempSkill("jinjian_player2");
				},
			},
			source2: {
				trigger: { source: "damageBegin1" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return !event.jinjian_source;
				},
				content() {
					trigger.num--;
					trigger.jinjian_source2 = true;
					player.removeSkill("jinjian_source2");
				},
				marktext: " -1 ",
				intro: {
					content: "下次造成的伤害-1",
				},
			},
			player2: {
				trigger: { player: "damageBegin3" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return !event.jinjian_player;
				},
				content() {
					trigger.num++;
					trigger.jinjian_player2 = true;
					player.removeSkill("jinjian_player2");
				},
				marktext: " +1 ",
				intro: {
					content: "下次受到的伤害+1",
				},
			},
		},
		ai: {
			maixie_defend: true,
			threaten: 0.9,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					//if(target.hujia) return;
					if (player._jinjian_tmp) {
						return;
					}
					if (_status.event.getParent("useCard", true) || _status.event.getParent("_wuxie", true)) {
						return;
					}
					if (get.tag(card, "damage")) {
						if (target.hasSkill("jinjian_player2")) {
							return [1, -2];
						} else {
							if (get.attitude(player, target) > 0) {
								return [0, 0.2];
							}
							if (get.attitude(player, target) < 0 && !player.hasSkillTag("damageBonus")) {
								var sha = player.getCardUsable({ name: "sha" });
								player._jinjian_tmp = true;
								var num = player.countCards("h", function (card) {
									if (card.name == "sha") {
										if (sha == 0) {
											return false;
										} else {
											sha--;
										}
									}
									return get.tag(card, "damage") && player.canUse(card, target) && get.effect(target, card, player, player) > 0;
								});
								delete player._jinjian_tmp;
								if (player.hasSkillTag("damage")) {
									num++;
								}
								if (num < 2) {
									return [0, 0.8];
								}
							}
						}
					}
				},
			},
		},
	},
	//冯妤
	tiqi: {
		audio: 2,
		trigger: { global: ["phaseDrawEnd", "phaseDrawSkipped", "phaseDrawCancelled"] },
		filter(event, player) {
			if (player == event.player) {
				return false;
			}
			var num = 0;
			event.player.getHistory("gain", function (evt) {
				if (evt.getParent().name == "draw" && evt.getParent("phaseDraw") == event) {
					num += evt.cards.length;
				}
			});
			return num != 2;
		},
		frequent: true,
		logTarget: "player",
		content() {
			"step 0";
			var num = 0;
			trigger.player.getHistory("gain", function (evt) {
				if (evt.getParent().name == "draw" && evt.getParent("phaseDraw") == trigger) {
					num += evt.cards.length;
				}
			});
			num = Math.abs(num - 2);
			event.num = num;
			player.draw(num);
			"step 1";
			if (trigger.player.isIn()) {
				player
					.chooseControl(" +" + num + " ", " -" + num + " ", "cancel2")
					.set("prompt", "是否改变" + get.translation(trigger.player) + "本回合的手牌上限？")
					.set("ai", function () {
						var sgn = get.sgn(get.attitude(_status.event.player, _status.event.getTrigger().player));
						if (sgn == 0) {
							return 2;
						}
						if (sgn == 1) {
							return 0;
						}
						return 1;
					});
			} else {
				event.finish();
			}
			"step 2";
			if (result.index < 2) {
				var target = trigger.player;
				player.line(target);
				if (!target.storage.tiqi_effect) {
					target.storage.tiqi_effect = 0;
				}
				target.storage.tiqi_effect += num * get.sgn(0.5 - result.index);
				target.addTempSkill("tiqi_effect");
				target.markSkill("tiqi_effect");
			}
		},
		subSkill: {
			effect: {
				mod: {
					maxHandcard(player, num) {
						if (typeof player.storage.tiqi_effect == "number") {
							return num + player.storage.tiqi_effect;
						}
					},
				},
				charlotte: true,
				onremove: true,
				mark: true,
				intro: {
					content: num => "手牌上限" + (num < 0 ? "" : "+") + num,
				},
			},
		},
	},
	baoshu: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		filter(event, player) {
			return player.maxHp > 0;
		},
		content() {
			"step 0";
			player.chooseTarget([1, player.maxHp], get.prompt("baoshu"), "令至多" + get.cnNumber(player.maxHp) + "名角色重置武将牌并获得“梳”").set("ai", function (target) {
				var att = get.attitude(player, target);
				if (att <= 0) {
					return 0;
				}
				//if(target.isTurnedOver()) return 3*att;
				if (target.isLinked() && get.effect(target, { name: "tiesuo" }, player, player) > 0) {
					return 1.6 * att;
				}
				if (ui.selected.targets.length >= Math.sqrt(1 + player.maxHp)) {
					return 0;
				}
				if (target != player) {
					return 1.3 * att;
				}
				return att;
			});
			"step 1";
			if (result.bool) {
				var targets = result.targets;
				targets.sortBySeat();
				player.logSkill("baoshu", targets);
				event.targets = targets;
				event.num = 0;
				event.num2 = 1 + player.maxHp - targets.length;
			} else {
				event.finish();
			}
			"step 2";
			var target = targets[num];
			event.target = target;
			if (!target.isIn()) {
				if (num < targets.length - 1) {
					event.num++;
					event.goto(2);
				} else {
					event.finish();
				}
			} else if (target.isLinked()) {
				target.link();
			}
			"step 3";
			if (target.isIn()) {
				target.addSkill("baoshu_draw");
				target.addMark("baoshu", event.num2);
			}
			if (num < targets.length - 1) {
				event.num++;
				event.goto(2);
			} else {
				event.finish();
			}
		},
		marktext: "梳",
		intro: {
			name2: "梳",
			content: "mark",
			onunmark(storage, player) {
				delete player.storage.baoshu;
				player.removeSkill("baoshu_draw");
			},
		},
		//group: "baoshu_draw",
		subSkill: {
			draw: {
				trigger: { player: "phaseDrawBegin2" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return !event.numFixed && player.hasMark("baoshu");
				},
				content() {
					var num = player.countMark("baoshu");
					trigger.num += num;
					trigger.player.removeMark("baoshu", num);
				},
			},
		},
	},
};
