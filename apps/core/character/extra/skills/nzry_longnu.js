import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const nzry_longnuSkills = {
	nzry_longnu: {
		mark: true,
		locked: true,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage, player, skill) {
				if (player.storage.nzry_longnu == true) {
					return "锁定技，出牌阶段开始时，你减1点体力上限并摸一张牌，然后本阶段内你的锦囊牌均视为雷杀且无使用次数限制";
				}
				return "锁定技，出牌阶段开始时，你失去1点体力并摸一张牌，然后本阶段内你的红色手牌均视为火杀且无距离限制";
			},
		},
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		forced: true,
		async content(event, trigger, player) {
			player.changeZhuanhuanji("nzry_longnu");
			if (player.storage.nzry_longnu != true) {
				await player.loseMaxHp();
			} else {
				await player.loseHp();
			}
			await player.draw();

			if (player.storage.nzry_longnu != true) {
				player.addTempSkill("nzry_longnu_2", "phaseUseAfter");
			} else {
				player.addTempSkill("nzry_longnu_1", "phaseUseAfter");
			}
		},
		subSkill: {
			1: {
				mod: {
					cardname(card, player) {
						if (get.color(card) == "red") {
							return "sha";
						}
					},
					cardnature(card, player) {
						if (get.color(card) == "red") {
							return "fire";
						}
					},
					targetInRange(card) {
						if (get.color(card) == "red") {
							return true;
						}
					},
				},
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondSha") && current < 0) {
								return 0.6;
							}
						},
					},
					respondSha: true,
				},
			},
			2: {
				mod: {
					cardname(card, player) {
						if (["trick", "delay"].includes(lib.card[card.name].type)) {
							return "sha";
						}
					},
					cardnature(card, player) {
						if (["trick", "delay"].includes(lib.card[card.name].type)) {
							return "thunder";
						}
					},
					cardUsable(card, player) {
						if (card.name == "sha" && game.hasNature(card, "thunder")) {
							return Infinity;
						}
					},
				},
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondSha") && current < 0) {
								return 0.6;
							}
						},
					},
					respondSha: true,
				},
			},
		},
		ai: {
			fireAttack: true,
			halfneg: true,
			threaten: 1.05,
		},
	},
	nzry_jieying: {
		audio: 2,
		locked: true,
		global: "g_nzry_jieying",
		ai: {
			effect: {
				target(card) {
					if (card.name == "tiesuo") {
						return "zeroplayertarget";
					}
				},
			},
		},
		group: ["nzry_jieying_1", "nzry_jieying_2"],
		subSkill: {
			1: {
				audio: "nzry_jieying",
				trigger: {
					player: ["linkBefore", "enterGame"],
					global: "phaseBefore",
				},
				forced: true,
				filter(event, player) {
					if (event.name == "link") {
						return player.isLinked();
					}
					return (event.name != "phase" || game.phaseNumber == 0) && !player.isLinked();
				},
				async content(event, trigger, player) {
					if (trigger.name != "link") {
						await player.link(true);
					} else {
						trigger.cancel();
					}
				},
				ai: {
					noLink: true,
				},
			},
			2: {
				audio: "nzry_jieying",
				trigger: {
					player: "phaseJieshuBegin",
				},
				filter(event, player) {
					return game.hasPlayer(function (current) {
						return current != player && !current.isLinked();
					});
				},
				async cost(event, trigger, player) {
					const next = player.chooseTarget("请选择【结营】的目标");
					next.set("forced", true);
					next.set("filterTarget", (card, player, target) => target != player && !target.isLinked());
					next.set("ai", () => 1 + Math.random());

					event.result = await next.forResult();
				},
				async content(event, trigger, player) {
					const { targets } = event;
					await targets[0].link(true);
				},
			},
		},
	},
	g_nzry_jieying: {
		mod: {
			maxHandcard(player, num) {
				if (
					game.countPlayer(function (current) {
						return current.hasSkill("nzry_jieying");
					}) > 0 &&
					player.isLinked()
				) {
					return num + 2;
				}
			},
		},
	},
	nzry_junlve: {
		audio: 2,
		intro: { content: "当前有#个标记" },
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player) {
			return event.num > 0;
		},
		forced: true,
		async content(event, trigger, player) {
			player.addMark(event.name, trigger.num);
		},
		ai: { combo: "nzry_cuike" },
	},
	nzry_cuike: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		async cost(event, trigger, player) {
			const str = player.countMark("nzry_junlve") % 2 == 1 ? "对一名角色造成1点伤害" : "横置一名角色并弃置其区域内的一张牌";
			event.result = await player
				.chooseTarget(get.prompt(event.skill), str)
				.set("ai", target => {
					const player = get.player();
					const num = player.countMark("nzry_junlve") % 2;
					if (num == 1) {
						return get.damageEffect(target, player, player);
					}
					return get.effect(target, { name: "guohe_copy" }, player, player) + (!target.isLinked() ? 2 : 0);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			const [target] = targets;
			if (player.countMark("nzry_junlve") % 2 == 1) {
				await target.damage();
			} else {
				await target.link(true);
				await player.discardPlayerCard(target, 1, "hej", true);
			}
			if (player.countMark("nzry_junlve") <= 7) {
				return;
			}
			const targetsx = game.filterPlayer(target => target !== player);
			const result = await player
				.chooseBool(`是否弃置所有“军略”标记${targetsx.length ? `并对${get.translation(targetsx)}造成1点伤害` : ""}？`)
				.set("choice", targetsx.reduce((num, target) => num + get.damageEffect(target, player, player), 0) > 0)
				.forResult();
			if (result?.bool) {
				player.line(targetsx);
				player.clearMark("nzry_junlve");
				await game.doAsyncInOrder(targetsx, target => target.damage());
			}
		},
		ai: {
			notemp: true,
		},
	},
	nzry_dinghuo: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		enable: "phaseUse",
		filter(event, player) {
			return player.countMark("nzry_junlve") > 0 && game.hasPlayer(current => current.isLinked());
		},
		check(event, player) {
			const targets = game.filterPlayer(current => get.attitude(player, current) < 0 && current.isLinked());
			const num = targets.length;
			return player.countMark("nzry_junlve") >= num && (num == game.countPlayer(current => get.attitude(player, current) < 0) || (num <= 2 && targets.filter(current => current.countCards("e") > 0).length > 0));
		},
		filterTarget(card, player, target) {
			return target.isLinked();
		},
		selectTarget() {
			return [1, _status.event.player.countMark("nzry_junlve")];
		},
		multiline: true,
		multitarget: true,
		async content(event, trigger, player) {
			let { targets } = event;
			player.awakenSkill(event.name);
			player.clearMark("nzry_junlve");
			for (const target of targets.sortBySeat()) {
				await target.discard(target.getCards("e"));
			}
			targets = targets.filter(current => current.isIn());
			if (!targets.length) {
				return;
			}
			const result = await player
				.chooseTarget(true, "对一名目标角色造成1点火焰伤害", (card, player, target) => {
					return _status.event.targets.includes(target);
				})
				.set("targets", targets)
				.set("ai", target => {
					const player = get.player();
					return get.damageEffect(target, player, player, "fire");
				})
				.forResult();
			if (result?.bool) {
				await result.targets[0].damage("fire");
			}
		},
		ai: {
			order: 1,
			fireAttack: true,
			combo: "nzry_junlve",
			result: {
				target(player, target) {
					if (target.hasSkillTag("nofire")) {
						return 0;
					}
					if (lib.config.mode == "versus") {
						return -1;
					}
					if (player.hasUnknown()) {
						return 0;
					}
					return get.damageEffect(target, player) - target.countCards("e");
				},
			},
		},
	},
	drlt_duorui: {
		audio: 2,
		init(player, skill) {
			if (!player.storage.drlt_duorui) {
				player.storage.drlt_duorui = [];
			}
		},
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			if (player.storage.drlt_duorui.length || event.player === player) {
				return false;
			}
			return event.player.isIn() && _status.currentPhase == player;
		},
		check(event, player) {
			if (get.attitude(_status.event.player, event.player) >= 0) {
				return false;
			}
			if (player.hasEnabledSlot() && !player.hasEnabledSlot(5)) {
				return false;
			}
			return true;
		},
		bannedList: ["bifa", "buqu", "gzbuqu", "songci", "funan", "xinfu_guhuo", "reguhuo", "huashen", "rehuashen", "old_guhuo", "shouxi", "xinpojun", "taoluan", "xintaoluan", "xinfu_yingshi", "zhenwei", "zhengnan", "xinzhengnan"],
		logTarget: "player",
		async content(event, trigger, player) {
			const skills = getFilteredSkills(trigger.player);
			event.skills = skills;

			if (player.hasEnabledSlot()) {
				const next = player.chooseToDisable();
				next.set("ai", (event, player, list) => {
					if (list.includes("equip5")) {
						return "equip5";
					}
					return list.randomGet();
				});
				await next;
			}

			if (!skills.length) {
				return;
			}

			const result = await player
				.chooseButton(["请选择要获得的技能", [skills, "skill"]], true)
				.set("ai", () => Math.random())
				.forResult();

			player.addTempSkills(result.links, { player: "dieAfter" });
			player.storage.drlt_duorui = result.links;
			player.storage.drlt_duorui_player = trigger.player;
			trigger.player.storage.drlt_duorui = result.links;
			trigger.player.addTempSkill("drlt_duorui1", { player: "phaseAfter" });

			return;

			/**
			 * 获取能获得的技能列表
			 *
			 * @param {Player} player - 角色对象
			 * @returns {string[]} 技能列表
			 */
			function getFilteredSkills(player) {
				const result = [];

				if (player.name1 != null) {
					result.push(...lib.character[player.name1][3]);
				} else {
					result.push(...lib.character[player.name][3]);
				}

				if (player.name2 != null) {
					result.push(...lib.character[player.name2][3]);
				}

				return result.filter(skill => {
					const info = get.info(skill);
					return info && !info.charlotte && !info.persevereSkill && !info.hiddenSkill && !info.zhuSkill && !info.juexingji && !info.limited && !info.dutySkill && !(info.unique && !info.gainable) && !lib.skill.drlt_duorui.bannedList.includes(skill);
				});
			}
		},
		group: ["duorui_clear"],
	},
	duorui_clear: {
		trigger: { global: ["phaseAfter", "dieAfter"] },
		filter(event, player) {
			if (!player.storage.drlt_duorui_player || !player.storage.drlt_duorui) {
				return false;
			}
			return player.storage.drlt_duorui_player == event.player && player.storage.drlt_duorui.length;
		},
		silent: true,
		forced: true,
		popup: false,
		async content(event, trigger, player) {
			player.removeSkills(player.storage.drlt_duorui[0]);
			delete player.storage.drlt_duorui_player;
			player.storage.drlt_duorui = [];
		},
	},
	drlt_duorui1: {
		init(player, skill) {
			player.disableSkill(skill, player.storage.drlt_duorui);
		},
		onremove(player, skill) {
			player.enableSkill(skill);
		},
		locked: true,
		mark: true,
		charlotte: true,
		intro: {
			content(storage, player, skill) {
				var list = [];
				for (var i in player.disabledSkills) {
					if (player.disabledSkills[i].includes(skill)) {
						list.push(i);
					}
				}
				if (list.length) {
					var str = "失效技能：";
					for (var i = 0; i < list.length; i++) {
						if (lib.translate[list[i] + "_info"]) {
							str += get.translation(list[i]) + "、";
						}
					}
					return str.slice(0, str.length - 1);
				}
			},
		},
	},
};
