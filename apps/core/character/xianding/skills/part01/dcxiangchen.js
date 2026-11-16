import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcxiangchen" | "dcmingding">} */
export const groupSkills = {
	//张裕
	dcxiangchen: {
		audio: 2,
		init(player, skill) {
			if (!_status.characterlist) {
				game.initCharacterList();
			}
		},
		keepSkill: true,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			player.setStorage(event.name, target);
			player.markSkillCharacter(event.name, target, "相谶", "上次〖相谶〗的目标");
			if ((player.additionalSkills[event.name] || []).length >= 3) {
				await player.draw({ nodelay: true });
				return;
			}
			const groupx = target.group;
			const hps = [get.character(target.name).hp, get.character(target.name2).hp];
			const skillsx = player.getSkills(null, false, false).filter(skill => !get.info(skill).charlotte);
			/** @type { [skill: string, owner: string][] } */
			const skills = [];
			for (const name of _status.characterlist) {
				const { group, hp, skills: curSkills } = get.character(name);
				if (groupx != group || !hps.includes(hp)) {
					continue;
				}
				skills.unshift(
					...curSkills
						.filter(skill => {
							const info = get.info(skill);
							if (!info || info.charlotte || info.juexingji || info.hiddenSkill || info.zhuSkill || info.limited) {
								return false;
							}
							if (typeof info.groupSkill === "string" && info.groupSkill !== player.group) {
								return false;
							}
							if (info.ai && (info.ai.combo || info.ai.notemp || info.ai.neg)) {
								return false;
							}
							return !skillsx.includes(skill);
						})
						.map(/** @returns { [skill: string, owner: string] } */ skill => [skill, name])
				);
			}
			if (skills.length) {
				const result = await player
					.chooseButton({
						createDialog: [`相谶：请选择一个技能获得`, [skills.randomGets(3), "skill"]],
						forced: true,
						ai(button) {
							return get.skillRank(button.link, "inout");
						},
					})
					.forResult();
				if (result.links?.length) {
					await player.addAdditionalSkills(event.name, result.links, true);
				}
			} else {
				player.chat("天有不测风云啊");
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (target == player) {
						return Math.random() - 0.5;
					}
					const sgn = get.sgnAttitude(player, target);
					const name = target.name;
					const hp = get.character(name).hp;
					if (hp >= 3 && hp <= 5) {
						return sgn * (Math.random() + 1);
					}
					return sgn * Math.random();
				},
			},
		},
		group: ["dcxiangchen_changeHp", "dcxiangchen_clear"],
		subSkill: {
			changeHp: {
				audio: "dcxiangchen",
				trigger: { global: "changeHpAfter" },
				filter(event, player) {
					if (event.changedHp == 0 || !event.player.isIn()) {
						return false;
					}
					return event.player == player || player.getStorage("dcxiangchen", null) == event.player;
				},
				direct: true,
				async content(event, trigger, player) {
					const skill = "dcxiangchen";
					const next = player.chooseToUse({
						prompt: get.translation(skill),
						prompt2: get.skillInfoTranslation(skill, player),
					});
					next.set("norestore", true);
					next.set("_backupevent", skill);
					next.set("custom", {
						add: {},
						replace: { window() {} },
					});
					next.backup(skill);
					next.set("ai1", () => 1);
					next.set("ai2", target => {
						const eff = get.effect(target, "dcxiangchen", get.player(), get.player());
						return eff;
					});
					next.set("addSkillCount", false);
					await next;
				},
			},
			clear: {
				audio: "dcxiangchen",
				forced: true,
				locked: false,
				trigger: { player: "phaseEnd" },
				async content(event, trigger, player) {
					await player.removeAdditionalSkills("dcxiangchen");
					//await player.recover();
				},
			},
		},
	},
	dcmingding: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		trigger: { player: "dying" },
		check(event, player) {
			if (
				player.countCards("h", function (card) {
					var mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (mod2 != "unchanged") {
						return mod2;
					}
					var mod = game.checkMod(card, player, event.player, "unchanged", "cardSavable", player);
					if (mod != "unchanged") {
						return mod;
					}
					var savable = get.info(card).savable;
					if (typeof savable == "function") {
						savable = savable(card, player, event.player);
					}
					return savable;
				}) >=
				1 - event.player.hp
			) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const toRemove = player.getSkills(null, false, false).filter(skill => skill != event.name && !get.info(skill).charlotte);
			if (toRemove.length) {
				await player.removeSkills(toRemove);
			}
			await player.recoverTo(1);
			player.addTempSkill(`${event.name}_effect`, { player: "dieAfter" });
			player
				.when({ player: "phaseAfter" })
				.filter(evt => evt != trigger.getParent("phase", true))
				.then(async (event, trigger, player) => {
					player.removeSkill("dcmingding_effect");
				});
			const toAdd = [];
			game.checkAllGlobalHistory("everything", evt => {
				if (evt.name != "changeSkills" || evt.player != player || evt.getParent()?.name != "dcxiangchen") {
					return false;
				}
				toAdd.addArray(evt.addSkill);
				return true;
			});
			await player.draw({ num: Math.min(5, toAdd.length) });
			await player.addSkills(toAdd.randomGets(3));
			player.addTempSkill(`${event.name}_die`, { player: "dieAfter" });
			player.setStorage(`${event.name}_die`, trigger.getParent("phase", true));
		},
		subSkill: {
			effect: {
				audio: "dcmingding",
				charlotte: true,
				forced: true,
				intro: {
					content: "防止你受到的伤害",
				},
				mark: true,
				trigger: {
					player: "damageBegin4",
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
				ai: {
					nodamage: true,
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "damage")) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
			die: {
				audio: "dcmingding",
				charlotte: true,
				onremove: true,
				forced: true,
				intro: {
					content: "回合结束时失去所有体力",
				},
				mark: true,
				marktext: "💀",
				trigger: {
					player: "phaseEnd",
				},
				filter(event, player) {
					return event != player.storage.dcmingding_die;
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					await player.loseHp(player.getHp());
				},
			},
		},
	},
};
