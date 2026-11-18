import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "benghuai" | "baonue" | "baonue2" | "luanwu" | "wansha" | "wansha2" | "weimu" | "huoji" | "bazhen" | "bazhen_bagua" | "kanpo" | "niepan">} */
export const groupSkills = {
	benghuai: {
		audio: 2,
		audioname: ["re_dongzhuo", "ol_dongzhuo"],
		audioname2: {
			zhugedan: "benghuai_zhugedan",
			re_zhugedan: "benghuai_re_zhugedan",
		},
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		check() {
			return false;
		},
		filter(event, player) {
			return !player.isMinHp();
		},
		async content(event, trigger, player) {
			const { control } = await player
				.chooseControl("baonue_hp", "baonue_maxHp", function (event, player) {
					if (player.hp == player.maxHp) {
						return "baonue_hp";
					}
					if (player.hp < player.maxHp - 1 || player.hp <= 2) {
						return "baonue_maxHp";
					}
					return "baonue_hp";
				})
				.set("prompt", "崩坏：失去1点体力或减1点体力上限")
				.forResult();
			if (control == "baonue_hp") {
				await player.loseHp();
			} else {
				await player.loseMaxHp(true);
			}
		},
		ai: {
			threaten: 0.5,
			neg: true,
		},
	},
	baonue: {
		group: "baonue2",
		audioname: ["re_dongzhuo"],
		audio: "baonue2",
		zhuSkill: true,
	},
	baonue2: {
		audio: 2,
		audioname: ["re_dongzhuo"],
		//forceaudio:true,
		trigger: { global: "damageSource" },
		sourceSkill: "baonue",
		filter(event, player) {
			if (player == event.source || !event.source || event.source.group != "qun") {
				return false;
			}
			return player.hasZhuSkill("baonue", event.source);
		},
		async cost(event, trigger, player) {
			event.result = await trigger.source
				.chooseBool("是否对" + get.translation(player) + "发动【暴虐】？")
				.set("choice", get.attitude(trigger.source, player) > 0)
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.source.line(player, "green");
			const next = trigger.source.judge(function (card) {
				if (get.suit(card) == "spade") {
					return 4;
				}
				return 0;
			});
			next.judge2 = function (result) {
				return result.bool ? true : false;
			};
			const result = await next.forResult();
			if (result.suit == "spade") {
				await player.recover();
			}
		},
	},
	luanwu: {
		audio: 2,
		audioname: ["re_jiaxu"],
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => player != current);
		},
		limited: true,
		skillAnimation: "epic",
		animationColor: "thunder",
		filterTarget: lib.filter.notMe,
		selectTarget: -1,
		multiline: true,
		async contentBefore(event, trigger, player) {
			player.awakenSkill(event.skill);
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await target
				.chooseToUse(
					"乱武：使用一张【杀】或失去1点体力",
					function (card) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					function (card, player, target) {
						if (player == target) {
							return false;
						}
						var dist = get.distance(player, target);
						if (dist > 1) {
							if (
								game.hasPlayer(function (current) {
									return current != player && get.distance(player, current) < dist;
								})
							) {
								return false;
							}
						}
						return lib.filter.filterTarget.apply(this, arguments);
					}
				)
				.set("ai2", function () {
					return get.effect_use.apply(this, arguments) - get.event().effect;
				})
				.set("effect", get.effect(target, { name: "losehp" }, target, target))
				.set("addCount", false)
				.forResult();
			if (!result?.bool) {
				await target.loseHp();
			}
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					if (lib.config.mode == "identity" && game.zhu.isZhu && player.identity == "fan") {
						if (game.zhu.hp == 1 && game.zhu.countCards("h") <= 2) {
							return 1;
						}
					}
					const players = game.filterPlayer();
					let num = 0;
					for (let i = 0; i < players.length; i++) {
						let att = get.attitude(player, players[i]);
						if (att > 0) {
							att = 1;
						}
						if (att < 0) {
							att = -1;
						}
						if (players[i] != player && players[i].hp <= 3) {
							const hs = players[i].countCards("hs");
							if (hs === 0) {
								num += att / players[i].hp;
							} else if (hs === 1) {
								num += att / 2 / players[i].hp;
							} else if (hs === 2) {
								num += att / 4 / players[i].hp;
							}
						}
						if (players[i].hp == 1) {
							num += att * 1.5;
						}
					}
					if (player.hp == 1) {
						return -num;
					}
					if (player.hp == 2) {
						return -game.players.length / 4 - num;
					}
					return -game.players.length / 3 - num;
				},
			},
		},
	},
	wansha: {
		locked: true,
		audio: 2,
		audioname: ["re_jiaxu", "boss_lvbu3", "new_simayi"],
		audioname2: { shen_simayi: "jilue_wansha" },
		global: "wansha2",
		trigger: { global: "dying" },
		priority: 15,
		forced: true,
		preHidden: true,
		filter(event, player, name) {
			return _status.currentPhase == player && event.player != player;
		},
		async content() {},
	},
	wansha2: {
		mod: {
			cardSavable(card, player) {
				if (card.name == "tao" && _status.currentPhase?.isIn() && _status.currentPhase.hasSkill("wansha") && _status.currentPhase != player) {
					if (!player.isDying()) {
						return false;
					}
				}
			},
			cardEnabled(card, player) {
				if (card.name == "tao" && _status.currentPhase?.isIn() && _status.currentPhase.hasSkill("wansha") && _status.currentPhase != player) {
					if (!player.isDying()) {
						return false;
					}
				}
			},
		},
	},
	weimu: {
		trigger: { global: "useCard1" },
		audio: 2,
		audioname2: {
			wangyuanji: "qc_weimu",
			boss_chujiangwang: "boss_chujiangwang_weimu",
		},
		forced: true,
		firstDo: true,
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			if (get.color(event.card) != "black" || get.type(event.card) != "trick") {
				return false;
			}
			var info = lib.card[event.card.name];
			return info && info.selectTarget && info.selectTarget == -1 && !info.toself;
		},
		async content(event, trigger, player) {},
		mod: {
			targetEnabled(card) {
				if ((get.type(card) == "trick" || get.type(card) == "delay") && get.color(card) == "black") {
					return false;
				}
			},
		},
	},
	huoji: {
		audio: 2,
		enable: "chooseToUse",
		filterCard(card) {
			return get.color(card) == "red";
		},
		viewAs: { name: "huogong" },
		viewAsFilter(player) {
			if (!player.countCards("hs", { color: "red" })) {
				return false;
			}
		},
		position: "hs",
		prompt: "将一张红色牌当火攻使用",
		check(card) {
			const player = get.player();
			if (player.countCards("h") > player.hp) {
				return 6 - get.value(card);
			}
			return 3 - get.value(card);
		},
		ai: {
			fireAttack: true,
		},
	},
	bazhen: {
		audio: 2,
		audioname: ["re_sp_zhugeliang", "ol_sp_zhugeliang", "ol_pangtong"],
		group: "bazhen_bagua",
		locked: true,
		init(player, skill) {
			player.addExtraEquip(skill, "bagua", true, player => player.hasEmptySlot(2) && lib.card.bagua);
		},
		onremove(player, skill) {
			player.removeExtraEquip(skill);
		},
	},
	bazhen_bagua: {
		audio: "bazhen",
		audioname: ["re_sp_zhugeliang", "ol_sp_zhugeliang", "ol_pangtong"],
		equipSkill: true,
		noHidden: true,
		inherit: "bagua_skill",
		sourceSkill: "bazhen",
		filter(event, player) {
			if (!lib.skill.bagua_skill.filter(event, player)) {
				return false;
			}
			if (!player.hasEmptySlot(2)) {
				return false;
			}
			return true;
		},
		ai: {
			respondShan: true,
			freeShan: true,
			skillTagFilter(player, tag, arg) {
				if (tag !== "respondShan" && tag !== "freeShan") {
					return;
				}
				if (!player.hasEmptySlot(2) || player.hasSkillTag("unequip2")) {
					return false;
				}
				if (!arg || !arg.player) {
					return true;
				}
				if (
					arg.player.hasSkillTag("unequip", false, {
						target: player,
					})
				) {
					return false;
				}
				return true;
			},
			effect: {
				target(card, player, target) {
					if (player == target && get.subtype(card) == "equip2") {
						if (get.equipValue(card) <= 7.5) {
							return 0;
						}
					}
					if (!target.hasEmptySlot(2)) {
						return;
					}
					return lib.skill.bagua_skill.ai.effect.target.apply(this, arguments);
				},
			},
		},
	},
	kanpo: {
		mod: {
			aiValue(player, card, num) {
				if (get.name(card) != "wuxie" && get.color(card) != "black") {
					return;
				}
				const cards = player.getCards("hs", function (card) {
					return get.name(card) == "wuxie" || get.color(card) == "black";
				});
				cards.sort(function (a, b) {
					return (get.name(b) == "wuxie" ? 1 : 2) - (get.name(a) == "wuxie" ? 1 : 2);
				});
				const geti = function () {
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
				return lib.skill.kanpo.mod.aiValue.apply(this, arguments);
			},
		},
		locked: false,
		audio: 2,
		enable: "chooseToUse",
		filterCard(card) {
			return get.color(card) == "black";
		},
		viewAsFilter(player) {
			return player.countCards("hs", { color: "black" }) > 0;
		},
		viewAs: { name: "wuxie" },
		position: "hs",
		prompt: "将一张黑色手牌当无懈可击使用",
		check(card) {
			const tri = _status.event.getTrigger();
			if (tri && tri.card && tri.card.name == "chiling") {
				return -1;
			}
			return 8 - get.value(card);
		},
		threaten: 1.2,
	},
	niepan: {
		audio: 2,
		audioname: ["re_pangtong"],
		audioname2: { sb_pangtong: "sbniepan" },
		enable: "chooseToUse",
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		filter(event, player) {
			if (event.type == "dying") {
				if (player != event.dying) {
					return false;
				}
				return true;
			} else if (event.getParent().name == "phaseUse") {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.storage.niepan = true;
			await player.discard(player.getCards("hej"));
			await player.link(false);
			await player.turnOver(false);
			await player.draw(3);
			if (player.hp < 3) {
				await player.recover(3 - player.hp);
			}
		},
		ai: {
			order: 0.5,
			skillTagFilter(player, tag, target) {
				if (player != target || player.storage.niepan) {
					return false;
				}
			},
			save: true,
			result: {
				player(player) {
					if (player.hp <= 0) {
						return 10;
					}
					if (player.hp <= 1 && player.countCards("he") <= 1) {
						return 10;
					}
					return 0;
				},
			},
			threaten(player, target) {
				if (!target.storage.niepan) {
					return 0.6;
				}
			},
		},
	},
};
