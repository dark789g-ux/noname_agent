import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jianjie" | "xinfu_yinshi">} */
export const groupSkills = {
	jianjie: {
		group: ["jianjie_use", "jianjie_die"],
		derivation: ["jianjie_huoji", "jianjie_lianhuan", "jianjie_yeyan"],
		audio: "xinfu_jianjie",
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return player.phaseNumber <= 1 && game.hasPlayer(current => current != player);
		},
		logAudio: () => ["xinfu_jianjie1.mp3", "xinfu_jianjie2.mp3"],
		content() {
			"step 0";
			player.chooseTarget("荐杰：选择一名其他角色获得“龙印”", lib.filter.notMe, true).set("ai", target => {
				return get.attitude(get.player(), target);
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "fire");
				lib.skill.jianjie.addMark("huoji", player, target);
				event.target = target;
				game.delayx();
			} else {
				event.finish();
			}
			"step 2";
			if (
				game.hasPlayer(current => {
					return current != player && current != target;
				})
			) {
				player
					.chooseTarget(
						"荐杰：选择一名其他角色获得“凤印”",
						function (card, player, target) {
							return target != player && target != _status.event.getParent().target;
						},
						true
					)
					.set("ai", target => {
						return get.attitude(get.player(), target);
					});
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "thunder");
				lib.skill.jianjie.addMark("lianhuan", player, target);
				game.delayx();
			}
		},
		ai: {
			threaten: 3,
		},
		hasMark: (mark, player, target) => {
			if (!target) {
				return player.getStorage("jianjie_" + mark).length > 0;
			}
			return target.getStorage("jianjie_" + mark).includes(player);
		},
		addMark: (mark, player, target) => {
			mark = "jianjie_" + mark;
			target.addAdditionalSkill(`${mark}_${player.playerid}`, mark);
			target.markAuto(mark, [player]);
			game.log(player, "令", target, "获得了", `#g“${mark == "jianjie_huoji" ? "龙印" : "凤印"}”`);
		},
		removeMark: (mark, player, target, log) => {
			if (lib.skill.jianjie.hasMark(mark, player, target, log)) {
				mark = "jianjie_" + mark;
				target.removeAdditionalSkill(`${mark}_${player.playerid}`);
				target.unmarkAuto(mark, [player]);
				if (log) {
					game.log(target, "移去了", player, "给予的", `#g“${mark == "jianjie_huoji" ? "龙印" : "凤印"}”`);
				} else {
					game.log(player, "移去了", target, "的", `#g“${mark == "jianjie_huoji" ? "龙印" : "凤印"}”`);
				}
			}
		},
		subSkill: {
			use: {
				audio: ["xinfu_jianjie1.mp3", "xinfu_jianjie2.mp3"],
				enable: "phaseUse",
				usable: 1,
				filter(event, player) {
					if (player.phaseNumber <= 1) {
						return false;
					}
					const skill = lib.skill.jianjie;
					return game.hasPlayer(function (current) {
						return skill.hasMark("huoji", player, current) || skill.hasMark("lianhuan", player, current);
					});
				},
				filterTarget(card, player, target) {
					if (ui.selected.targets.length == 0) {
						const skill = lib.skill.jianjie;
						return skill.hasMark("huoji", player, target) || skill.hasMark("lianhuan", player, target);
					}
					return true;
				},
				selectTarget: 2,
				complexSelect: true,
				complexTarget: true,
				multitarget: true,
				prompt: "移动场上的“龙印”或“凤印”",
				targetprompt: ["失去印", "获得印"],
				content() {
					"step 0";
					var skill = lib.skill.jianjie;
					var bool1 = skill.hasMark("huoji", player, targets[0]),
						bool2 = skill.hasMark("lianhuan", player, targets[0]);
					if (bool1 && bool2) {
						player.chooseControl("龙印", "凤印").set("prompt", "选择要移动的“印”");
					} else {
						event._result = { control: bool1 ? "龙印" : "凤印" };
					}
					"step 1";
					var skill = lib.skill.jianjie,
						mark = result.control == "龙印" ? "huoji" : "lianhuan";
					skill.removeMark(mark, player, targets[0]);
					skill.addMark(mark, player, targets[1]);
					if (skill.hasMark("huoji", player, targets[1]) && skill.hasMark("lianhuan", player, targets[1])) {
						game.broadcastAll(function () {
							if (lib.config.background_speak) {
								game.playAudio("skill", "xinfu_jianjie3");
							}
						});
					}
					game.delayx();
				},
				ai: {
					order: 8,
					result: {
						target(player, target) {
							if (ui.selected.targets.length == 0) {
								return get.attitude(player, target) < 0 ? -999 : -3;
							} else {
								return target.countCards("h") + 1;
							}
						},
					},
					expose: 0.4,
				},
			},
			die: {
				audio: "xinfu_jianjie",
				trigger: { global: "die" },
				filter(event, player) {
					const skill = lib.skill.jianjie;
					return skill.hasMark("huoji", player, event.player) || skill.hasMark("lianhuan", player, event.player);
				},
				forced: true,
				logTarget: "player",
				logAudio: () => ["xinfu_jianjie1.mp3", "xinfu_jianjie2.mp3"],
				content() {
					"step 0";
					if (lib.skill.jianjie.hasMark("huoji", player, trigger.player)) {
						player.chooseTarget("荐杰：选择一名角色获得“龙印”", true).set("ai", target => {
							return get.attitude(get.player(), target);
						});
					} else {
						event.goto(2);
					}
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						player.line(target, "fire");
						lib.skill.jianjie.addMark("huoji", player, target);
						if (lib.skill.jianjie.hasMark("huoji", player, target) && lib.skill.jianjie.hasMark("lianhuan", player, target)) {
							game.broadcastAll(function () {
								if (lib.config.background_speak) {
									game.playAudio("skill", "xinfu_jianjie3");
								}
							});
						}
						game.delayx();
					} else {
						event.finish();
					}
					"step 2";
					if (lib.skill.jianjie.hasMark("lianhuan", player, trigger.player)) {
						player.chooseTarget("荐杰：选择一名角色获得“凤印”", true).set("ai", target => {
							return get.attitude(get.player(), target);
						});
					} else {
						event.finish();
					}
					"step 3";
					if (result.bool) {
						var target = result.targets[0];
						player.line(target, "thunder");
						lib.skill.jianjie.addMark("lianhuan", player, target);
						if (lib.skill.jianjie.hasMark("huoji", player, target) && lib.skill.jianjie.hasMark("lianhuan", player, target)) {
							game.broadcastAll(function () {
								if (lib.config.background_speak) {
									game.playAudio("skill", "xinfu_jianjie3");
								}
							});
						}
						game.delayx();
					}
				},
			},
			huoji: {
				audio: "huoji",
				marktext: "龙",
				intro: {
					name: "龙印",
					content: "<li>出牌阶段限三次。你可以将一张红色牌当作【火攻】使用，且你以此法使用【火攻】的作用效果改为“目标角色随机展示一张手牌A，然后你可以弃置一张与A颜色相同的牌，对目标造成1点火属性伤害”。<br><li>若你同时拥有“凤印”，则你视为拥有技能〖业炎〗。（发动〖业炎〗时，弃置所有“龙印”和“凤印”）",
				},
				inherit: "rehuoji",
				usable: 3,
				charlotte: true,
				viewAsFilter(player) {
					const storage = player.getStorage("jianjie_huoji");
					if (
						!storage.some(source => {
							return source.isIn() && source.hasSkill("jianjie");
						})
					) {
						return false;
					}
					return player.hasCard(card => get.color(card) == "red", "she");
				},
				group: ["jianjie_yeyan", "jianjie_huoji_effect"],
			},
			huoji_effect: {
				trigger: { player: "huogongBegin" },
				forced: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					return event.skill == "jianjie_huoji";
				},
				content() {
					trigger.setContent(lib.skill.olhuoji.huogongContent);
				},
			},
			lianhuan: {
				audio: "lianhuan",
				marktext: "凤",
				intro: {
					name: "凤印",
					content: "<li>出牌阶段限三次。你可以将一张♣牌当作【铁索连环】使用或重铸，且你以此法使用【铁索连环】的目标数上限+1。<br><li>若你同时拥有“龙印”，则你视为拥有技能〖业炎〗。（发动〖业炎〗时，弃置所有“龙印”和“凤印”）",
				},
				charlotte: true,
				usable: 3,
				filter(event, player) {
					const storage = player.getStorage("jianjie_lianhuan");
					if (
						!storage.some(source => {
							return source.isIn() && source.hasSkill("jianjie");
						})
					) {
						return false;
					}
					if (!player.hasCard(card => get.suit(card) == "club", "she")) {
						return false;
					}
					return event.type == "phase" || event.filterCard({ name: "tiesuo" }, player, event);
				},
				hiddenCard(player, name) {
					return name == "tiesuo" && player.hasCard(card => get.suit(card) == "club", "she");
				},
				position: "hes",
				inherit: "lianhuan",
				group: ["jianjie_yeyan", "jianjie_lianhuan_effect"],
			},
			lianhuan_effect: {
				trigger: { player: "useCard2" },
				filter(event, player) {
					if (event.skill != "jianjie_lianhuan") {
						return false;
					}
					var info = get.info(event.card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						if (
							game.hasPlayer(current => {
								return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current);
							})
						) {
							return true;
						}
					}
					return false;
				},
				charlotte: true,
				forced: true,
				popup: false,
				content() {
					"step 0";
					player
						.chooseTarget("是否为" + get.translation(trigger.card) + "额外指定一个目标？", (card, player, target) => {
							return !_status.event.sourcex.includes(target) && lib.filter.targetEnabled2(_status.event.card, player, target);
						})
						.set("sourcex", trigger.targets)
						.set("ai", function (target) {
							var player = _status.event.player;
							return get.effect(target, _status.event.card, player, player);
						})
						.set("card", trigger.card);
					"step 1";
					if (result.bool) {
						if (!event.isMine() && !event.isOnline()) {
							game.delayex();
						}
					} else {
						event.finish();
					}
					"step 2";
					if (result.bool) {
						var targets = result.targets;
						player.line(targets, "thunder");
						trigger.targets.addArray(targets);
						game.log(targets, "也成为了", trigger.card, "的目标");
					}
				},
			},
			yeyan: {
				audio: "yeyan",
				inherit: "yeyan",
				filter(event, player) {
					const huoji = player.getStorage("jianjie_huoji"),
						lianhuan = player.getStorage("jianjie_lianhuan");
					return (
						huoji.length > 0 &&
						lianhuan.some(source => {
							return huoji.includes(source) && source.isIn() && source.hasSkill("jianjie");
						})
					);
				},
				contentBefore() {
					player.awakenSkill(event.skill);
					var skill = lib.skill.jianjie;
					var huoji = player.getStorage("jianjie_huoji").slice(0),
						lianhuan = player.getStorage("jianjie_lianhuan").slice(0);
					huoji.forEach(source => {
						skill.removeMark("huoji", source, player, true);
					});
					lianhuan.forEach(source => {
						skill.removeMark("lianhuan", source, player, true);
					});
				},
			},
		},
	},
	xinfu_yinshi: {
		audio: 2,
		trigger: { player: "damageBegin4" },
		forced: true,
		filter(event, player) {
			const skill = lib.skill.jianjie;
			if (skill.hasMark("huoji", player) || skill.hasMark("lianhuan", player)) {
				return false;
			}
			if (!player.hasEmptySlot(2)) {
				return false;
			}
			if (event.hasNature()) {
				return true;
			}
			return get.type(event.card, "trick") == "trick";
		},
		content() {
			trigger.cancel();
		},
		ai: {
			notrick: true,
			nofire: true,
			nothunder: true,
			effect: {
				target(card, player, target, current) {
					const skill = lib.skill.jianjie;
					if (skill.hasMark("huoji", target) || skill.hasMark("lianhuan", target)) {
						return false;
					}
					if (player == target && get.subtype(card) == "equip2") {
						if (get.equipValue(card) <= 8) {
							return 0;
						}
					}
					if (!target.hasEmptySlot(2)) {
						return;
					}
					if (get.tag(card, "natureDamage")) {
						return "zeroplayertarget";
					}
					if (get.type(card) == "trick" && get.tag(card, "damage")) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
};
