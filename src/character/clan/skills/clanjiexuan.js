import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanjiexuan" | "clanmingjie">} */
export const groupSkills = {
	//族王允
	clanjiexuan: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		zhuanhuanji: "number",
		mark: true,
		marktext: "☯",
		intro: {
			markcount: () => 0,
			content(storage) {
				return "限定技，转换技。你可以将一张" + ((storage || 0) % 2 ? "黑色牌当【过河拆桥】" : "红色牌当【顺手牵羊】") + "使用。";
			},
		},
		viewAs(cards, player) {
			var storage = player.storage.clanjiexuan;
			var name = (storage || 0) % 2 ? "guohe" : "shunshou";
			return { name: name };
		},
		check(card) {
			var player = _status.event.player;
			var storage = player.storage.clanjiexuan;
			var name = (storage || 0) % 2 ? "guohe" : "shunshou";
			var fix = player.hasSkill("clanzhongliu") && (get.position(card) != "h" || get.suit(card) == "spade") ? 2 : 1;
			return (get.value({ name: name }, player) - get.value(card)) * fix;
		},
		position: "hes",
		filterCard(card, player) {
			var storage = player.storage.clanjiexuan;
			return get.color(card) == ((storage || 0) % 2 ? "black" : "red");
		},
		prompt() {
			var storage = _status.event.player.storage.clanjiexuan;
			if ((storage || 0) % 2) {
				return "将一张黑色牌当【过河拆桥】使用";
			}
			return "将一张红色牌当【顺手牵羊】使用";
		},
		skillAnimation: true,
		animationColor: "thunder",
		log: false,
		async precontent(event, trigger, player) {
			const skill = "clanjiexuan";
			player.logSkill(skill);
			player.changeZhuanhuanji(skill);
			player.awakenSkill(skill, true);
		},
		ai: {
			order(item, player) {
				player = player || _status.event.player;
				var storage = _status.event.player.storage.clanjiexuan;
				var name = (storage || 0) % 2 ? "guohe" : "shunshou";
				return get.order({ name: name }) + 0.1;
			},
		},
	},
	clanmingjie: {
		init(player) {
			player.addSkill("clanmingjie_record");
		},
		initSkill(skill) {
			if (!lib.skill[skill]) {
				lib.skill[skill] = {
					charlotte: true,
					onremove: true,
					mark: true,
					marktext: "戒",
					intro: {
						markcount: () => 0,
						content: storage => "已被" + get.translation(storage[1]) + "指定为【铭戒】目标",
					},
					group: "clanmingjie_clear",
				};
				lib.translate[skill] = "铭戒";
				lib.translate[skill + "_bg"] = "戒";
			}
		},
		onremove(player) {
			player.removeSkill("clanmingjie_record");
		},
		audio: 2,
		enable: "phaseUse",
		limited: true,
		filterTarget(card, player, target) {
			return !Object.keys(target.storage).some(skill => {
				return skill.startsWith("clanmingjiex_" + player.playerid + "_") && target.storage[skill][0] === 1 + (_status.currentPhase === target);
			});
		},
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.awakenSkill(event.name);
			player.addSkill("clanmingjie_effect");
			let skill;
			do {
				skill = "clanmingjiex_" + player.playerid + "_" + Math.random().toString(36).slice(-8);
			} while (lib.skill[skill] != null);
			game.broadcastAll(lib.skill.clanmingjie.initSkill, skill);
			target.addSkill(skill);
			target.storage[skill] = [_status.currentPhase === target ? 2 : 1, player];
			target.markSkill(skill);
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					if (player.hasSkill("clanzhongliu") || player.hp == 1) {
						if (
							!player.hasCard(card => {
								var info = get.info(card);
								if (info.allowMultiple == false) {
									return false;
								}
								if (!lib.filter.targetEnabled2(card, player, target)) {
									return false;
								}
								return game.hasPlayer(current => {
									return player.canUse(card, current) && get.effect(current, card, player, player) > 0 && current != target && get.effect(target, card, player, player) > 0;
								});
							}, "hs")
						) {
							return 0;
						}
					} else {
						if (
							player.countCards("hs", card => {
								var info = get.info(card);
								if (info.allowMultiple == false) {
									return false;
								}
								if (!lib.filter.targetEnabled2(card, player, target)) {
									return false;
								}
								return game.hasPlayer(current => {
									return player.canUse(card, current) && get.effect(current, card, player, player) > 0 && current != target && get.effect(target, card, player, player) > 0;
								});
							}) < 3
						) {
							return 0;
						}
					}
					return get.sgnAttitude(player, target);
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				audio: "clanmingjie",
				mod: {
					aiOrder(player, card, num) {
						if (get.suit(card) == "spade") {
							return num + 3;
						}
					},
				},
				trigger: { player: "useCard2" },
				filter(event, player) {
					const { card } = event;
					const info = get.info(card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						return game.filterPlayer().some(current => {
							if (!Object.keys(current.storage).some(skill => skill.startsWith("clanmingjiex_" + player.playerid + "_"))) {
								return false;
							}
							return !event.targets.includes(current) && lib.filter.targetEnabled2(card, player, current) && lib.filter.targetInRange(card, player, current);
						});
					}
					return false;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(
							get.prompt(event.skill),
							"令任意【铭戒】目标角色成为" + get.translation(trigger.card) + "的目标",
							(card, player, target) => {
								const trigger = get.event().getTrigger();
								if (trigger.targets.includes(target) || !Object.keys(target.storage).some(skill => skill.startsWith("clanmingjiex_" + player.playerid + "_"))) {
									return false;
								}
								return lib.filter.targetEnabled2(trigger.card, player, target) && lib.filter.targetInRange(trigger.card, player, target);
							},
							[1, Infinity]
						)
						.set("ai", target => {
							const player = get.player();
							const trigger = get.event().getTrigger();
							return get.effect(target, trigger.card, player, player);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const targets = event.targets.sortBySeat();
					trigger.targets.addArray(targets);
					game.log(targets, "成为了", trigger.card, "的额外目标");
				},
				group: "clanmingjie_targeted",
			},
			clear: {
				charlotte: true,
				trigger: { player: "phaseAfter" },
				filter(event, player) {
					return Object.keys(player.storage).some(i => i.startsWith("clanmingjiex_"));
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					const storages = Object.keys(player.storage).filter(i => i.startsWith("clanmingjiex_"));
					for (const skill of storages) {
						player.storage[skill][0]--;
						if (!player.storage[skill][0]) {
							player.removeSkill(skill);
						}
					}
				},
			},
			targeted: {
				charlotte: true,
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					if (
						!Object.keys(event.player.storage).some(skill => {
							return skill.startsWith("clanmingjiex_" + player.playerid + "_") && event.player.storage[skill][0] == 1;
						})
					) {
						return false;
					}
					return player.getStorage("clanmingjie_record").someInD("d");
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					let cards = player.getStorage("clanmingjie_record").slice().filterInD("d");
					while (cards.some(card => get.position(card, true) == "d" && player.hasUseTarget(card))) {
						const result = await player
							.chooseButton(["铭戒：是否使用这些牌？", cards])
							.set("filterButton", button => {
								return get.player().hasUseTarget(button.link);
							})
							.set("ai", button => {
								return get.player().getUseValue(button.link);
							})
							.forResult();
						if (result.bool) {
							const card = result.links[0];
							cards.remove(card);
							player.$gain2(card, false);
							await game.delayx();
							await player.chooseUseTarget(card, true);
						} else {
							break;
						}
					}
				},
			},
			record: {
				charlotte: true,
				trigger: { global: ["useCard", "respond", "useCard1", "phaseAfter"] },
				filter(event, player, name) {
					if (name == "useCard1") {
						return get.suit(event.card) == "spade";
					}
					if (event.name == "phase") {
						return true;
					}
					if (!Array.isArray(event.respondTo)) {
						return false;
					}
					return get.type(event.respondTo[1]) != "trick" || ["caochuan", "wuxie"].includes(event.card.name);
				},
				silent: true,
				forced: true,
				async content(event, trigger, player) {
					const { storage } = player;
					if (trigger.name == "phase") {
						delete storage.clanmingjie_record;
					} else {
						const history = game.getGlobalHistory("everything", evt => {
							if (event.triggername == "useCard1") {
								return evt == trigger;
							}
							return evt.name == "useCard" && evt.card == trigger.respondTo[1];
						});
						if (history?.length) {
							player.markAuto("clanmingjie_record", history[0].cards);
						}
					}
				},
			},
		},
	},
};
