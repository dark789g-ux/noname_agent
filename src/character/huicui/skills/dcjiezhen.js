import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjiezhen" | "dczecai" | "dcyinshi" | "xizhen">} */
export const groupSkills = {
	//黄承彦
	dcjiezhen: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player;
		},
		async content(event, trigger, player) {
			const { target } = event;
			const skills = target.getSkills(null, false, false).filter(skill => {
				if (skill == "bazhen") {
					return;
				}
				var info = get.info(skill);
				return info && !get.is.locked(skill) && !info.limited && !info.juexingji && !info.zhuSkill && !info.charlotte && !info.persevereSkill;
			});
			target.addAdditionalSkills("dcjiezhen_blocker", "bazhen");
			target.addSkill("dcjiezhen_blocker");
			target.markAuto("dcjiezhen_blocker", skills);
			player.addSkill("dcjiezhen_clear");
			player.markAuto("dcjiezhen_clear", [target]);
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					var skills = target.getSkills(null, false, false).filter(function (i) {
						if (i == "bazhen") {
							return;
						}
						var info = get.info(i);
						return info && !get.is.locked(i) && !info.limited && !info.juexingji && !info.zhuSkill && !info.charlotte && !info.persevereSkill;
					});
					if (!skills.length && target.hasEmptySlot(2)) {
						return 1;
					}
					return -0.5 * skills.length;
				},
			},
		},
		subSkill: {
			blocker: {
				init(player, skill) {
					player.addSkillBlocker(skill);
				},
				onremove(player, skill) {
					player.removeSkillBlocker(skill);
					player.removeAdditionalSkill(skill);
					delete player.storage.dcjiezhen_blocker;
				},
				charlotte: true,
				locked: true,
				skillBlocker(skill, player) {
					return skill != "bazhen" && skill != "dcjiezhen_blocker" && !lib.skill[skill].charlotte && !lib.skill[skill].persevereSkill && player.getStorage("dcjiezhen_blocker").includes(skill);
				},
				mark: true,
				marktext: "阵",
				intro: {
					markcount: () => 0,
					content(storage, player, skill) {
						if (storage.length) {
							return "失效技能：" + get.translation(storage);
						}
						return "无失效技能";
					},
				},
			},
			clear: {
				audio: "dcjiezhen",
				charlotte: true,
				trigger: {
					global: ["judgeAfter", "die"],
					player: "phaseBegin",
				},
				forced: true,
				forceDie: true,
				onremove: true,
				filter(event, player) {
					if (event.name == "die") {
						return player == event.player || player.getStorage("dcjiezhen_clear").includes(event.player);
					} else if (event.name == "judge") {
						return event.skill == "bagua" && player.getStorage("dcjiezhen_clear").includes(event.player);
					}
					return player.getStorage("dcjiezhen_clear").length > 0;
				},
				logTarget(event, player) {
					if (event.name != "phase") {
						return event.player;
					}
					return player.getStorage("dcjiezhen_clear");
				},
				async content(event, trigger, player) {
					const targets = player.getStorage("dcjiezhen_clear");
					if (trigger.name == "die" && player == trigger.player) {
						for (const target of targets) {
							target.removeSkill("dcjiezhen_blocker");
						}
						player.removeSkill("dcjiezhen_clear");
						return;
					}
					const list = trigger.name == "phase" ? targets.slice(0).sortBySeat() : [trigger.player];
					for (const target of list) {
						const storage = player.getStorage("dcjiezhen_clear");
						if (storage.includes(target)) {
							storage.remove(target);
							target.removeSkill("dcjiezhen_blocker");
							if (target.isIn() && target.countGainableCards(player, "hej") > 0) {
								await player.gainPlayerCard(target, "hej", true);
							}
						}
					}
					player.removeSkill("dcjiezhen_clear");
				},
			},
		},
		derivation: "bazhen",
	},
	dczecai: {
		audio: 2,
		trigger: { global: "roundEnd" },
		limited: true,
		skillAnimation: true,
		animationColor: "soil",
		getMax() {
			const getNum = function (current) {
				var history = current.actionHistory;
				var num = 0;
				for (var i = history.length - 1; i >= 0; i--) {
					for (var j = 0; j < history[i].useCard.length; j++) {
						if (get.type2(history[i].useCard[j].card, false) == "trick") {
							num++;
						}
					}
					if (history[i].isRound) {
						break;
					}
				}
				return num;
			};
			let max = 0,
				current = false,
				targets = game.filterPlayer();
			for (const target of targets) {
				const num = getNum(target);
				if (num > max) {
					max = num;
					current = target;
				} else if (num == max) {
					current = false;
				}
			}
			return current;
		},
		async cost(event, trigger, player) {
			const target = lib.skill.dczecai.getMax();
			let str = "令一名其他角色获得〖集智〗直到下一轮结束";
			if (target && target != player) {
				str += "；若选择的目标为" + get.translation(target) + "，则其获得一个额外的回合";
			}
			event.result = await player
				.chooseTarget(lib.filter.notMe, get.prompt(event.skill), str)
				.set("maximum", event.target)
				.set("ai", function (target) {
					if (target != _status.event.maximum) {
						return 0;
					}
					return get.attitude(_status.event.player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const target = event.targets[0];
			await target.addAdditionalSkills("dczecai_effect", "rejizhi");
			target.addTempSkill("dczecai_effect", "roundEnd");
			if (target == lib.skill.dczecai.getMax()) {
				target.insertPhase();
			}
		},
		derivation: "rejizhi",
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				marktext: "才",
				intro: { content: "已拥有技能〖集智〗" },
			},
		},
	},
	dcyinshi: {
		audio: 2,
		trigger: { player: "damageBegin" },
		usable: 1,
		filter(event, player) {
			return !event.card || get.color(event.card) == "none";
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.cancel();
		},
		group: "dcyinshi_gain",
		subSkill: {
			gain: {
				audio: "dcyinshi",
				trigger: { global: "judgeEnd" },
				forced: true,
				filter(event, player) {
					return event.skill == "bagua" && event.result.card && get.position(event.result.card, true) == "o";
				},
				async content(event, trigger, player) {
					player.gain(trigger.result.card, "gain2");
				},
			},
		},
	},
	//高览
	xizhen: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && (player.canUse("sha", current, false) || player.canUse("juedou", current, false));
			});
		},
		async content(event, trigger, player) {
			const targetResult = await player
				.chooseTarget(get.prompt("xizhen"), "视为对一名角色使用【杀】或【决斗】", function (card, player, target) {
					return target != player && (player.canUse("sha", target, false) || player.canUse("juedou", target, false));
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					var eff1 = 0,
						eff2 = 0;
					if (player.canUse("sha", target, false)) {
						eff1 = get.effect(target, { name: "sha" }, player, player);
					}
					if (player.canUse("juedou", target, false)) {
						eff2 = get.effect(target, { name: "juedou" }, player, player);
					}
					var effx = Math.max(eff1, eff2);
					if (effx <= 0) {
						return 0;
					}
					if (target.isHealthy()) {
						effx *= 3;
					}
					if (get.attitude(player, target) > 0) {
						effx *= 1.6;
					}
					return effx;
				})
				.forResult();
			if (!targetResult.bool) {
				return;
			}
			const target = targetResult.targets[0];
			player.logSkill("xizhen", target);
			const list = [];
			if (player.canUse("sha", target, false)) {
				list.push("sha");
			}
			if (player.canUse("juedou", target, false)) {
				list.push("juedou");
			}
			let control;
			if (list.length == 1) {
				control = list[0];
			} else {
				const controlResult = await player
					.chooseControl(list)
					.set("prompt", "视为对" + get.translation(target) + "使用…")
					.set("target", target)
					.set("ai", function () {
						var player = _status.event.player,
							target = _status.event.target;
						var eff1 = get.effect(target, { name: "sha" }, player, player),
							eff2 = get.effect(target, { name: "juedou" }, player, player);
						return eff1 > eff2 ? 0 : 1;
					})
					.forResult();
				control = controlResult.control;
			}
			await player.useCard({ name: control, isCard: true }, target, false);
			if (target.isIn()) {
				player.storage.xizhen_effect = target;
				player.addTempSkill("xizhen_effect", "phaseUseAfter");
			}
		},
		subSkill: {
			effect: {
				audio: "xizhen",
				charlotte: true,
				onremove: true,
				trigger: { global: ["useCard", "respond"] },
				logTarget(event, player) {
					return player.storage.xizhen_effect;
				},
				forced: true,
				filter(event, player) {
					return Array.isArray(event.respondTo) && event.respondTo[0] == player && player.storage.xizhen_effect && player.storage.xizhen_effect.isIn();
				},
				async content(event, trigger, player) {
					const target = player.storage.xizhen_effect;
					await target.recover();
					await player.draw(target.isHealthy() ? 2 : 1);
				},
				mark: "character",
				intro: { content: "已指定$为目标" },
			},
		},
	},
};
