import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jingyu" | "lvxin" | "huandao">} */
export const groupSkills = {
	//十周年神华佗
	jingyu: {
		audio: 2,
		trigger: {
			global: ["useSkill", "logSkillBegin"],
		},
		filter(event, player) {
			if (["global", "equip"].includes(event.type)) {
				return false;
			}
			let skill = get.sourceSkillFor(event);
			if (!skill || skill === "jingyu") {
				return false;
			}
			let info = get.info(skill);
			if (!info || info.charlotte || info.equipSkill) {
				return false;
			}
			return !player.getStorage("jingyu_used").includes(skill);
		},
		direct: true,
		forced: true,
		async content(event, trigger, player) {
			if (!player.storage.jingyu_used) {
				player
					.when({ global: "roundStart" }, false)
					.assign({
						firstDo: true,
					})
					.step(async () => delete player.storage.jingyu_used)
					.finish();
			}
			let skill = get.sourceSkillFor(trigger);
			player.markAuto("jingyu_used", skill);
			player.logSkill(event.name);
			await player.draw();
		},
		ai: { threaten: 6 },
	},
	lvxin: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		filterTarget: lib.filter.notMe,
		filter() {
			const round = game.roundNumber;
			return typeof round == "number" && round > 0;
		},
		check(card) {
			const round = game.roundNumber,
				player = get.player();
			let valueFix = 0;
			if (["sha", "shan"].includes(get.name(card, false))) {
				valueFix += 3;
			}
			if (
				(round <= 2 &&
					player.hasCard(card => {
						return ["sha", "shan"].includes(get.name(card)) && get.value(card) <= 3;
					})) ||
				game.hasPlayer(current => {
					return current !== player && get.attitude(player, current) > 0;
				})
			) {
				return 6 - get.value(card) + valueFix;
			}
			return 4.5 - get.value(card) + valueFix;
		},
		delay: false,
		discard: false,
		lose: false,
		async content(event, trigger, player) {
			const { target, cards } = event,
				round = Math.min(5, game.roundNumber);
			const name = get.translation(target);
			await player.give(cards, target);
			const result = await player
				.chooseControl(["摸牌", "弃牌"])
				.set("choiceList", [`令${name}摸${get.cnNumber(round)}张牌`, `令${name}随机弃置${get.cnNumber(round)}张手牌`])
				.set("prompt", "滤心：请选择一项")
				.set("ai", () => {
					return get.event().choice;
				})
				.set("choice", get.attitude(player, target) > 0 ? "摸牌" : "弃牌")
				.forResult();
			let cards2 = [];
			const makeDraw = result.index === 0;
			if (makeDraw) {
				const result = await target.draw(round).forResult();
				cards2 = result.cards;
			} else {
				if (cards.length > 0) {
					const evt = target.randomDiscard(round, "h");
					await evt;
					cards2 = evt.done.cards2;
				}
			}
			const cardName = get.name(cards[0], player);
			if (
				cards2.some(card => {
					return get.name(card, target) === cardName;
				})
			) {
				const skillName = `lvxin_${makeDraw ? "recover" : "lose"}`;
				target.addSkill(skillName);
				target.addMark(skillName, 1, false);
			}
		},
		subSkill: {
			recover: {
				trigger: { player: ["useSkill", "logSkillBegin", "useCard", "respond"] },
				filter(event, player) {
					if (["global", "equip"].includes(event.type)) {
						return false;
					}
					if ((get.info(event.skill) || {}).charlotte) {
						return false;
					}
					const skill = get.sourceSkillFor(event);
					const info = get.info(skill);
					return info && !info.charlotte && !info.equipSkill;
				},
				forced: true,
				onremove: true,
				charlotte: true,
				async content(event, trigger, player) {
					player.recover(player.countMark(event.name));
					player.removeSkill(event.name);
				},
				intro: { content: "下次发动技能时回复#点体力" },
			},
			lose: {
				trigger: { player: ["useSkill", "logSkillBegin", "useCard", "respond"] },
				filter(event, player) {
					if (["global", "equip"].includes(event.type)) {
						return false;
					}
					if ((get.info(event.skill) || {}).charlotte) {
						return false;
					}
					const skill = get.sourceSkillFor(event);
					const info = get.info(skill);
					return info && !info.charlotte && !info.equipSkill;
				},
				forced: true,
				onremove: true,
				charlotte: true,
				async content(event, trigger, player) {
					player.loseHp(player.countMark(event.name));
					player.removeSkill(event.name);
				},
				intro: { content: "下次发动技能时失去#点体力" },
			},
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					const round = game.roundNumber;
					if (
						round <= 2 &&
						target.countCards("h") > round * 2 &&
						player.getCards("h").some(card => {
							return ["sha", "shan"].includes(get.name(card)) && get.value(card) <= 3;
						})
					) {
						return 1;
					}
					if (get.attitude(player, target) > 0) {
						return round + Math.sqrt(1 + target.getDamagedHp());
					}
					return -(round + Math.sqrt(Math.max(0, 2 - target.getHp())));
				},
			},
		},
	},
	huandao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		limited: true,
		filterTarget: lib.filter.notMe,
		skillAnimation: true,
		animationColor: "metal",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const { target } = event;
			await target.turnOver(false);
			await target.link(false);
			let names = [target.name1 || target.name];
			if (target.name2) {
				names.add(target.name2);
			}
			names = names.map(name => get.rawName(name));
			if (!_status.characterlist) {
				game.initCharacterList();
			}
			_status.characterlist.randomSort();
			let ownedSkills = target.getSkills(null, false, false),
				ownedSkillsName = ownedSkills.map(skill => get.translation(skill));
			let skillToGain = null;
			outer: for (const name of _status.characterlist) {
				const info = lib.character[name];
				if (!names.includes(get.rawName(name))) {
					continue;
				}
				const skills = info[3].slice().randomSort();
				while (skills.length) {
					const skill = skills.shift(),
						skillName = get.translation(skill);
					if (!ownedSkillsName.includes(skillName)) {
						skillToGain = skill;
						break outer;
					}
				}
			}
			if (!skillToGain) {
				return;
			}
			player.popup(skillToGain);
			player.line(target, "green");
			let prompt2 = "若你选择是，则你于获得此技能后须失去一个其他技能。<br><br>";
			if (lib.skill[skillToGain].nobracket) {
				prompt2 += `<div class="skilln">${get.translation(skillToGain)}</div><div><span style="font-family: yuanli">${get.skillInfoTranslation(skillToGain, null, false)}</span></div><br><br>`;
			} else {
				const translation = lib.translate[skillToGain + "_ab"] || get.translation(skillToGain).slice(0, 2);
				prompt2 += `<div class="skill">【${translation}】</div><div><span style="font-family: yuanli">${get.skillInfoTranslation(skillToGain, null, false)}</span></div><br><br>`;
			}
			const { bool } = await target
				.chooseBool(`寰道：是否获得技能〖${get.translation(skillToGain)}〗？`, prompt2)
				.set(
					"choice",
					(() => {
						const rank = get.skillRank(skillToGain, "inout") + 1;
						return ownedSkills.some(skill => {
							const info = get.info(skill);
							if (info) {
								if (target.awakenedSkills.includes(skill) && (info.limited || info.juexingji || info.dutySkill)) {
									return true;
								}
								if (info.ai && (info.ai.neg || info.ai.halfneg)) {
									return true;
								}
							}
							return get.skillRank(skill, "inout") < rank;
						});
					})()
				)
				.forResult();
			if (!bool) {
				target.chat("拒绝");
				game.log(target, "拒绝获得技能", `#g【${get.translation(skillToGain)}】`);
				await game.delay();
				return;
			}
			await target.addSkills(skillToGain);
			ownedSkills = target.getSkills(null, false, false).filter(skill => {
				if (skill === skillToGain) {
					return false;
				}
				const info = get.info(skill);
				if (!info || info.charlotte || !get.skillInfoTranslation(skill, player).length) {
					return false;
				}
				return true;
			});
			if (!ownedSkills) {
				return;
			}
			const { control } = await target
				.chooseControl(ownedSkills)
				.set(
					"choiceList",
					ownedSkills.map(skill => {
						return `<div class="skill">【${get.translation(lib.translate[skill + "_ab"] || get.translation(skill).slice(0, 2))}】</div><div>${get.skillInfoTranslation(skill, target, false)}</div>`;
					})
				)
				.set("displayIndex", false)
				.set("prompt", "寰道：选择失去一个技能")
				.set("ai", () => {
					return get.event().choice;
				})
				.set(
					"choice",
					(() => {
						const uselessSkills = ownedSkills.filter(skill => {
							const info = get.info(skill);
							if (!info) {
								return false;
							}
							if (target.awakenedSkills.includes(skill) && (info.limited || info.juexingji || info.dutySkill)) {
								return true;
							}
							if (info.ai && (info.ai.neg || info.ai.halfneg)) {
								return true;
							}
							return false;
						});
						if (uselessSkills.length) {
							return uselessSkills.randomGet();
						}
						return ownedSkills.sort((a, b) => {
							return get.skillRank(a, "inout") - get.skillRank(b, "inout");
						})[0];
					})()
				)
				.forResult();
			await target.removeSkills(control);
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					if (!_status.characterlist) {
						game.initCharacterList();
					}
					if (game.roundNumber * game.countPlayer() <= (1.5 * game.countPlayer2()) / Math.sqrt(player.getDamagedHp() + 1)) {
						return 0;
					}
					const ownedSkills = target.getSkills(null, false, false).filter(skill => {
						const info = get.info(skill);
						if (!info || info.charlotte || !get.skillInfoTranslation(skill, player).length) {
							return false;
						}
						return true;
					});
					const uselessSkills = ownedSkills.filter(skill => {
						const info = get.info(skill);
						if (!info) {
							return false;
						}
						if (target.awakenedSkills.includes(skill) && (info.limited || info.juexingji || info.dutySkill)) {
							return true;
						}
						if (info.ai && (info.ai.neg || info.ai.halfneg)) {
							return true;
						}
						return false;
					});
					if (uselessSkills.length) {
						return 3;
					}
					let names = [target.name1 || target.name];
					if (target.name2) {
						names.add(target.name2);
					}
					names = names.map(name => get.rawName(name));
					if (_status.characterlist.some(name => names.includes(get.rawName(name)))) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
};
