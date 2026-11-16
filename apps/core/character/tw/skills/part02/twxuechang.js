import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twxuechang" | "twduoren">} */
export const groupSkills = {
	//夏侯紫萼
	twxuechang: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filterTarget(card, player, target) {
			return player.canCompare(target, true);
		},
		async content(event, trigger, player) {
			const { target } = event;
			await player.draw();
			if (!player.canCompare(target)) {
				return;
			}
			const result = await player.chooseToCompare(target).forResult();
			if (result?.bool) {
				if (!target.countGainableCards(player, "he")) {
					return;
				} else {
					const result2 = await player.gainPlayerCard(target, "he", [1, 2], true).forResult();
					if (result2?.cards?.length) {
						if (result2.cards.some(card => get.type(card) == "equip")) {
							const card = { name: "sha", isCard: true };
							if (player.canUse(card, target, false, false)) {
								await player.useCard(card, target, "noai", false);
							}
						}
					}
				}
			} else {
				await player.damage(target);
				player.addSkill("twxuechang_add");
				if (!player.storage.twxuechang_add) {
					player.storage.twxuechang_add = {};
				}
				if (!player.storage.twxuechang_add[target.playerid]) {
					player.storage.twxuechang_add[target.playerid] = 0;
				}
				player.storage.twxuechang_add[target.playerid]++;
				player.markSkill("twxuechang_add");
			}
		},
		ai: {
			order: 6.5,
			result: {
				target(player, target) {
					var hs = player.getCards("h").sort(function (a, b) {
						return get.number(b) - get.number(a);
					});
					var ts = target.getCards("h").sort(function (a, b) {
						return get.number(b) - get.number(a);
					});
					if (!hs.length || !ts.length) {
						return 0;
					}
					if (get.number(hs[0]) > get.number(ts[0]) || get.number(hs[0]) - ts.length >= 9 + Math.min(2, player.hp / 2)) {
						return get.sgnAttitude(player, target) * get.effect(target, { name: "shunshou_copy2" }, player, player);
					}
					return 0;
				},
			},
		},
		subSkill: {
			add: {
				audio: "twxuechang",
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return player.storage.twxuechang_add && player.storage.twxuechang_add[event.player.playerid];
				},
				forced: true,
				charlotte: true,
				async content(event, trigger, player) {
					trigger.num += player.storage.twxuechang_add[trigger.player.playerid];
					delete player.storage.twxuechang_add[trigger.player.playerid];
					if (get.is.empty(player.storage.twxuechang_add)) {
						player.removeSkill("twxuechang_add");
					} else {
						player.markSkill("twxuechang_add");
					}
				},
				marktext: "偿",
				intro: {
					content(storage, player) {
						if (!storage) {
							return "";
						}
						var str = "";
						var map = _status.connectMode ? lib.playerOL : game.playerMap;
						for (var i in storage) {
							str += "<li>下次对" + get.translation(map[i]) + "造成的伤害+" + storage[i];
						}
						return str;
					},
				},
			},
		},
	},
	twduoren: {
		audio: 2,
		trigger: { global: "dieAfter" },
		check(event, player) {
			const skills = event.player.getStockSkills(true, true).filter(skill => {
				if (player.hasSkill(skill, null, false, false)) {
					return false;
				}
				const info = get.info(skill);
				return info && !info.hiddenSkill && !info.zhuSkill && !info.charlotte;
			});
			return skills.length > 0;
		},
		//group: "twduoren_remove",
		prompt2(event, player) {
			const skills = event.player.getStockSkills(true, true).filter(skill => {
				/*if (player.hasSkill(skill, null, false, false)) {
					return false;
				}*/
				const info = get.info(skill);
				return info && !info.hiddenSkill && !info.zhuSkill && !info.charlotte;
			});
			let str1 = "";
			for (const i of skills) {
				str1 += "〖" + get.translation(i) + "〗、";
			}
			str1 = str1.slice(0, str1.length - 1);
			let str2 = "";
			for (const i of player.getSkills(null, false, false).filter(skill => {
				const info = get.info(skill);
				return info && !info.charlotte && !player.getStockSkills(true, true).includes(skill);
			})) {
				str2 += "〖" + get.translation(i) + "〗、";
			}
			str2 = str2.slice(0, str2.length - 1);
			return `${str2.length ? `失去${str2}，然后` : ""}${str1.length ? "获得" + str1 : "听一句技能配音"}`;
		},
		filter(event, player) {
			return (
				event.player != player &&
				(player.hasAllHistory("sourceDamage", evt => evt.player == event.player) ||
					player.hasAllHistory("damage", evt => evt.source == event.player)) &&
				!event.reserveOut
			);
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.changeSkills(
				trigger.player.getStockSkills(true, true).filter(skill => {
					const info = get.info(skill);
					return info && !info.hiddenSkill && !info.zhuSkill && !info.charlotte;
				}),
				player.getSkills(null, false, false).filter(skill => {
					const info = get.info(skill);
					return info && !info.charlotte && !player.getStockSkills(true, true).includes(skill);
				})
			);
		},
		/*content() {
			"step 0";
			player.loseMaxHp();
			"step 1";
			var skills = trigger.player.getSkills(null, false, false).filter(skill => {
				if (player.hasSkill(skill, null, false, false)) {
					return false;
				}
				var info = get.info(skill);
				return info && !info.hiddenSkill && !info.zhuSkill && !info.charlotte;
			});
			if (skills.length) {
				//for(var i of skills) player.addSkillLog(i);
				player.addSkills(skills);
				player.markAuto("twduoren", skills);
				game.broadcastAll(function (list) {
					game.expandSkills(list);
					for (var i of list) {
						var info = lib.skill[i];
						if (!info) {
							continue;
						}
						if (!info.audioname2) {
							info.audioname2 = {};
						}
						info.audioname2.xia_xiahouzie = "twduoren";
					}
				}, skills);
			}
		},
		subSkill: {
			remove: {
				audio: "twduoren",
				trigger: { source: "dying" },
				filter(event, player) {
					return (
						event.player != player &&
						player.getStorage("twduoren").some(skill => {
							return player.hasSkill(skill, null, false, false);
						})
					);
				},
				forced: true,
				locked: false,
				content() {
					player.removeSkills(player.getStorage("twduoren"));
					delete player.storage.twduoren;
				},
			},
		},*/
	},
};
