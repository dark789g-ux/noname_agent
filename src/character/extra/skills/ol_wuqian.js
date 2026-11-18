import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const ol_wuqianSkills = {
	ol_wuqian: {
		audio: 2,
		enable: "phaseUse",
		derivation: "wushuang",
		filter(event, player) {
			return player.countMark("baonu") >= 2 && game.hasPlayer(target => lib.skill.ol_wuqian.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target != player && !target.hasSkill("ol_wuqian_targeted");
		},
		async content(event, trigger, player) {
			const { target } = event;
			player.removeMark("baonu", 2);
			await player.addTempSkills("wushuang");
			player.popup("无双");
			// game.log(player,'获得了技能','#g【无双】');
			target.addTempSkill("ol_wuqian_targeted");
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					if (
						player.countCards("hs", card => {
							if (!player.getCardUsable({ name: card.name })) {
								return false;
							}
							if (!player.canUse(card, target)) {
								return false;
							}
							var eff1 = get.effect(target, card, player, player);
							_status.baonuCheck = true;
							var eff2 = get.effect(target, card, player, player);
							delete _status.baonuCheck;
							return eff2 > Math.max(0, eff1);
						})
					) {
						return -1;
					}
					return 0;
				},
			},
			combo: "baonu",
		},
		global: "ol_wuqian_ai",
		subSkill: {
			targeted: {
				charlotte: true,
				ai: { unequip2: true },
			},
			ai: {
				ai: {
					unequip2: true,
					skillTagFilter(player) {
						if (!_status.baonuCheck) {
							return false;
						}
					},
				},
			},
		},
	},
	wumou: {
		audio: 2,
		trigger: { player: "useCard" },
		forced: true,
		filter(event) {
			return get.type(event.card) == "trick";
		},
		async content(event, trigger, player) {
			if (!player.hasMark("baonu")) {
				await player.loseHp();
				return;
			}

			const result = await player
				.chooseControlList(["移去一枚【暴怒】标记", "失去1点体力"], true)
				.set("ai", (event, player) => {
					if (get.effect(player, { name: "losehp" }, player, player) >= 0) {
						return 1;
					}
					if (player.storage.baonu > 6) {
						return 0;
					}
					if (player.hp + player.countCards("h", "tao") > 3) {
						return 1;
					}
					return 0;
				})
				.forResult();

			if (result.index == 0) {
				player.removeMark("baonu", 1);
			} else {
				await player.loseHp();
			}
		},
		ai: {
			effect: {
				player_use(card, player) {
					if (get.type(card) == "trick" && get.value(card) < 6) {
						return [0, -2];
					}
				},
			},
			neg: true,
		},
	},
	qinyin: {
		audio: 2,
		audioname: ["mb_zhouyu"],
		trigger: { player: "phaseDiscardEnd" },
		direct: true,
		logAudio: index => (typeof index === "number" ? "qinyin" + index + ".mp3" : 2),
		logAudio2: {
			mb_zhouyu: index => (typeof index === "number" ? `qinyin_mb_zhouyu${index}.mp3` : 2),
		},
		filter(event, player) {
			var cards = [];
			player.getHistory("lose", function (evt) {
				if (evt.type == "discard" && evt.getParent("phaseDiscard") == event) {
					cards.addArray(evt.cards2);
				}
			});
			return cards.length > 1;
		},
		async content(event, trigger, player) {
			event.forceDie = true;
			if (typeof event.count !== "number") {
				event.count = 1;
			}

			for (let time = event.count; time > 0; time--) {
				let recover = 0;
				let lose = 0;
				const players = game.filterPlayer();
				for (const current of players) {
					if (current.hp < current.maxHp) {
						if (get.attitude(player, current) > 0) {
							if (current.hp < 2) {
								lose--;
								recover += 0.5;
							}
							lose--;
							recover++;
						} else if (get.attitude(player, current) < 0) {
							if (current.hp < 2) {
								lose++;
								recover -= 0.5;
							}
							lose++;
							recover--;
						}
					} else {
						if (get.attitude(player, current) > 0) {
							lose--;
						} else if (get.attitude(player, current) < 0) {
							lose++;
						}
					}
				}

				const prompt = get.prompt("qinyin") + "（剩余" + get.cnNumber(time) + "次）";
				const next = player.chooseControl("失去体力", "回复体力", "cancel2", ui.create.dialog(get.prompt("qinyin"), "hidden"));
				next.set("ai", () => {
					if (lose > recover && lose > 0) {
						return 0;
					}
					if (lose < recover && recover > 0) {
						return 1;
					}
					return 2;
				});

				const result = await next.forResult();
				if (result.control === "cancel2") {
					return;
				}

				player.logSkill("qinyin", null, null, null, [result.control == "回复体力" ? 2 : 1]);
				const bool = result.control === "回复体力";
				await game.doAsyncInOrder(game.filterPlayer(), async target => {
					if (bool) {
						await target.recover();
					} else {
						await target.loseHp();
					}
				});
			}
		},
		ai: {
			expose: 0.1,
			threaten: 2,
		},
	},
	lianpo: {
		audio: 2,
		audioname: ["new_simayi"],
		trigger: { global: "phaseAfter" },
		frequent: true,
		filter(event, player) {
			return player.getStat("kill") > 0;
		},
		async content(event, trigger, player) {
			player.insertPhase();
		},
	},
	baonu: {
		audio: 2,
		marktext: "暴",
		trigger: {
			source: "damageSource",
			player: ["damageEnd", "enterGame"],
			global: "phaseBefore",
		},
		forced: true,
		filter(event) {
			return (event.name != "damage" && (event.name != "phase" || game.phaseNumber == 0)) || event.num > 0;
		},
		async content(event, trigger, player) {
			player.addMark("baonu", trigger.name == "damage" ? trigger.num : 2);
		},
		intro: {
			name: "暴怒",
			content: "mark",
		},
		ai: {
			combo: "ol_shenfen",
			maixie: true,
			maixie_hp: true,
		},
	},
	shenfen: {
		audio: 2,
		unique: true,
		enable: "phaseUse",
		filter(event, player) {
			return player.storage.baonu >= 6;
		},
		skillAnimation: true,
		animationColor: "metal",
		limited: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.storage.baonu -= 6;
			player.markSkill("baonu");
			player.syncStorage("baonu");
			event.targets = game.filterPlayer();
			event.targets.remove(player);
			// event.targets.sort(lib.sort.seat);
			event.targets2 = event.targets.slice(0);
			player.line(event.targets, "green");

			await game.doAsyncInOrder(event.targets, target => target.damage());
			await game.doAsyncInOrder(event.targets2, async target => {
				if (target && target.countCards("he")) {
					await target.chooseToDiscard("he", true, 4);
				}
			});
		},
		ai: {
			order: 10,
			result: {
				player(player) {
					return game.countPlayer(function (current) {
						if (current != player) {
							return get.sgn(get.damageEffect(current, player, player));
						}
					});
				},
			},
			combo: "baonu",
		},
	},
	wuqian: {
		audio: 2,
		enable: "phaseUse",
		derivation: "wushuang",
		filter(event, player) {
			return player.storage.baonu >= 2 && !player.hasSkill("wushuang");
		},
		async content(event, trigger, player) {
			player.storage.baonu -= 2;
			player.addTempSkill("wushuang");
		},
		ai: {
			order: 5,
			result: {
				player(player) {
					if (!player.storage.shenfen) {
						return 0;
					}
					var cards = player.getCards("h", "sha");
					if (cards.length) {
						if (
							game.hasPlayer(function (current) {
								return player.canUse("sha", current) && get.effect(current, cards[0], player, player) > 0 && current.hasShan();
							})
						) {
							return 1;
						}
					}
					return 0;
				},
			},
			combo: "baonu",
		},
	},
	renjie: {
		audio: "renjie2",
		trigger: { player: "damageEnd" },
		forced: true,
		group: "renjie2",
		filter(event) {
			return event.num > 0;
		},
		async content(event, trigger, player) {
			player.addMark("renjie", trigger.num);
		},
		intro: {
			name2: "忍",
			content: "mark",
		},
		marktext: "忍",
		ai: {
			maixie: true,
			maixie_hp: true,
			combo: "jilue",
			effect: {
				target(card, player, target) {
					if ((!target.hasSkill("sbaiyin") && !target.hasSkill("jilue")) || !target.hasFriend()) {
						return;
					}
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -2];
					}
					if (get.tag(card, "damage")) {
						if (target.isHealthy() && target.getHp() > 2) {
							if (!target.hasSkill("jilue")) {
								return [0, 1];
							}
							return [0.7, 1];
						}
						return 0.7;
					}
				},
			},
		},
	},
	renjie2: {
		audio: 2,
		mod: {
			aiOrder: (player, card, num) => {
				if (num <= 0 || typeof card !== "object" || !player.isPhaseUsing() || player.isDying()) {
					return num;
				}
				if (player.hasSkill("sbaiyin")) {
					if (player.countMark("renjie") < 4 && player.getUseValue(card) < Math.min(4, (player.hp * player.hp) / 4)) {
						return 0;
					}
				} else if (player.hasSkill("jilue")) {
					if (player.countMark("renjie") < 3 && player.getUseValue(card) < Math.min(1.8, 0.18 * player.hp * player.hp)) {
						return 0;
					}
				}
			},
		},
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		forced: true,
		sourceSkill: "renjie",
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return false;
			}
			var evt = event.getParent("phaseDiscard"),
				evt2 = event.getl(player);
			return evt && evt2 && evt.name == "phaseDiscard" && evt.player == player && evt2.cards2 && evt2.cards2.length > 0;
		},
		async content(event, trigger, player) {
			player.addMark("renjie", trigger.getl(player).cards2.length);
		},
	},
	sbaiyin: {
		skillAnimation: "epic",
		animationColor: "thunder",
		juexingji: true,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		audio: 2,
		filter(event, player) {
			return player.countMark("renjie") >= 4;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp();
			await player.addSkills("jilue");
		},
		derivation: ["jilue", "jilue_guicai", "jilue_fangzhu", "jilue_jizhi", "jilue_zhiheng", "jilue_wansha"],
		ai: { combo: "renjie" },
	},
	jilue: {
		audio: 2,
		group: ["jilue_guicai", "jilue_fangzhu", "jilue_wansha", "jilue_zhiheng", "jilue_jizhi"],
		ai: { combo: "renjie" },
	},
};
