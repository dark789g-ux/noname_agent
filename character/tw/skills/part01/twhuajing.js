import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twhuajing" | "twtianshou">} */
export const groupSkills = {
	//玉真子
	twhuajing: {
		audio: 2,
		getSkills(player) {
			return player
				.getCards("e", card => get.subtype(card) == "equip1")
				.reduce((list, card) => {
					const info = get.info(card);
					if (info && info.skills) {
						return list.addArray(info.skills);
					}
					return list;
				}, []);
		},
		trigger: { global: "phaseBefore", player: "enterGame" },
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			const skills = lib.skill.twhuajing.derivation;
			for (const eff of skills) {
				player.addMark(eff, 1);
				player.unmarkSkill(eff);
			}
			player.markSkill("twhuajing");
		},
		global: "twhuajing_global",
		group: "twhuajing_use",
		derivation: ["twhuajing_jian", "twhuajing_dao", "twhuajing_fu", "twhuajing_qiang", "twhuajing_ji", "twhuajing_gong"],
		marktext: "武",
		intro: {
			markcount(storage, player) {
				return lib.skill.twhuajing.derivation.filter(skill => player.hasMark(skill)).length;
			},
			content(storage, player) {
				const skills = lib.skill.twhuajing.derivation.filter(skill => player.hasMark(skill));
				if (!skills.length) {
					return "功力已消耗殆尽";
				}
				let str = "当前武功：";
				for (const eff of skills) {
					str += "<br><li>";
					str += lib.translate[eff];
					str += "：";
					str += lib.translate[eff + "_info"];
				}
				return str;
			},
		},
		subSkill: {
			global: {
				mod: {
					attackRange(player, num) {
						const skills = lib.skill.twhuajing.derivation.filter(skill => player.hasMark(skill) || player.hasSkill(skill));
						if (skills.length) {
							return num + skills.length * game.countPlayer(target => target.hasSkill("twhuajing"));
						}
					},
				},
			},
			use: {
				audio: "twhuajing",
				enable: "phaseUse",
				filter(event, player) {
					return lib.skill.twhuajing.derivation.some(skill => player.hasMark(skill));
				},
				filterCard: true,
				selectCard: [1, 4],
				position: "h",
				complexCard: true,
				discard: false,
				lose: false,
				delay: false,
				check(card) {
					const player = get.event().player,
						skills = lib.skill.twhuajing.derivation.filter(skill => player.hasMark(skill));
					if (ui.selected.cards.some(cardx => get.suit(cardx, player) == get.suit(card, player))) {
						return 0;
					}
					return skills.length - ui.selected.cards.length;
				},
				usable: 1,
				prompt: "展示至多四张手牌，然后根据这些牌含有的花色数于本回合获得等量你拥有的“武”标记的效果",
				async content(event, trigger, player) {
					await player.showCards(event.cards, get.translation(player) + "发动了【化境】");
					const skills = lib.skill.twhuajing.derivation.filter(skill => player.hasMark(skill));
					const gainSkills = skills.randomGets(
						Math.min(skills.length, event.cards.reduce((list, cardx) => list.add(get.suit(cardx, player)), []).length)
					);
					for (const eff of gainSkills) {
						player.popup(eff);
					}
					player.addTempSkill(gainSkills);
					player.addTempSkill("twhuajing_blocker");
					player.getHistory("custom").push({ twhuajing_skills: gainSkills });
				},
				ai: {
					order: 12,
					result: {
						player(player) {
							return player.countCards("hs", card => {
								return get.name(card) == "sha" && player.hasValueTarget(card, false, true);
							});
						},
					},
				},
			},
			jian: {
				charlotte: true,
				mark: true,
				marktext: "剑",
				intro: {
					name: "化境·剑",
					name2: "剑",
					markcount: () => 0,
					content: () => lib.translate.twhuajing_jian_info,
				},
				nopop: true,
				trigger: { player: "useCardToPlayered" },
				filter(event, player) {
					return event.card.name == "sha" && event.target.countCards("he");
				},
				forced: true,
				logTarget: "target",
				async content(event, trigger, player) {
					const target = trigger.target;
					target.randomDiscard(2, player);
				},
			},
			dao: {
				charlotte: true,
				mark: true,
				marktext: "刀",
				intro: {
					name: "化境·刀",
					name2: "刀",
					markcount: () => 0,
					content: () => lib.translate.twhuajing_dao_info,
				},
				nopop: true,
				inherit: "guding_skill",
				equipSkill: false,
			},
			fu: {
				charlotte: true,
				mark: true,
				marktext: "斧",
				intro: {
					name: "化境·斧",
					name2: "斧",
					markcount: () => 0,
					content: () => lib.translate.twhuajing_fu_info,
				},
				nopop: true,
				trigger: { player: "shaMiss" },
				forced: true,
				logTarget: "target",
				async content(event, trigger, player) {
					trigger.target.damage();
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (!arg || !arg.card || arg.card.name != "sha" || !arg.baseDamage || arg.baseDamage <= 1) {
							return false;
						}
						return true;
					},
				},
			},
			qiang: {
				charlotte: true,
				mark: true,
				marktext: "枪",
				intro: {
					name: "化境·枪",
					name2: "枪",
					markcount: () => 0,
					content: () => lib.translate.twhuajing_qiang_info,
				},
				nopop: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.card.name == "sha" && get.color(event.card) == "black";
				},
				forced: true,
				async content(event, trigger, player) {
					const card = get.cardPile(card => card.name == "shan");
					if (card) {
						player.gain(card, "gain2");
					}
				},
			},
			ji: {
				charlotte: true,
				mark: true,
				marktext: "戟",
				intro: {
					name: "化境·戟",
					name2: "戟",
					markcount: () => 0,
					content: () => lib.translate.twhuajing_ji_info,
				},
				nopop: true,
				trigger: { source: "damageBegin3" },
				filter(event, player) {
					return event.card && event.card.name == "sha";
				},
				forced: true,
				async content(event, trigger, player) {
					player.draw(trigger.num);
				},
			},
			gong: {
				charlotte: true,
				mark: true,
				marktext: "弓",
				intro: {
					name: "化境·弓",
					name2: "弓",
					markcount: () => 0,
					content: () => lib.translate.twhuajing_gong_info,
				},
				nopop: true,
				trigger: { source: "damageSource" },
				filter(event, player) {
					return event.card && event.card.name == "sha" && event.player.countDiscardableCards(player, "e");
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					trigger.player.randomDiscard("e", player);
				},
			},
			blocker: {
				charlotte: true,
				init(player, skill) {
					player.disableSkill(skill, lib.skill.twhuajing.getSkills(player));
				},
				onremove(player, skill) {
					player.enableSkill(skill);
				},
				mod: {
					attackRange(player, num) {
						return num - player.getEquipRange();
					},
				},
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter", "phaseBefore"],
				},
				filter(event, player) {
					if (event.name == "phase") {
						return true;
					}
					if (event.name == "equip" && event.player == player && get.subtype(event.card) == "equip1") {
						return true;
					}
					const evt = event.getl(player);
					return evt && evt.player == player && evt.es && evt.es.some(card => get.subtype(card) == "equip1");
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					player.enableSkill("twhuajing_blocker");
					player.disableSkill("twhuajing_blocker", lib.skill.twhuajing.getSkills(player));
				},
				ai: { unequip_equip1: true },
			},
		},
	},
	twtianshou: {
		audio: 2,
		trigger: { player: "phaseEnd" },
		filter(event, player) {
			return (
				player.getHistory("sourceDamage", evt => {
					return evt.card && evt.card.name == "sha";
				}).length &&
				player
					.getHistory("custom", evt => {
						return evt.twhuajing_skills;
					})
					.reduce((list, evt) => list.addArray(evt.twhuajing_skills), [])
					.some(skill => player.hasMark(skill))
			);
		},
		forced: true,
		async content(event, trigger, player) {
			const { bool, targets } = await player
				.chooseTarget(lib.filter.notMe, true)
				.set("prompt", "天授：令一名其他角色获得1枚“武”并获得此标记的效果")
				.set("ai", target => {
					const player = get.event().player,
						att = get.attitude(player, target);
					const card = new lib.element.VCard({ name: "sha", isCard: true });
					if (att > 0) {
						return (
							game.countPlayer(aim => {
								return (
									target.canUse(card, target) &&
									get.effect(aim, card, target, player) > 0 &&
									get.effect(aim, card, target, target) > 0
								);
							}) + 10
						);
					}
					if (att == 0) {
						return 1.5 + Math.random();
					}
					return 0.1 + Math.random();
				})
				.forResult();
			if (bool) {
				const target = targets[0];
				const skills = player
					.getHistory("custom", evt => {
						return evt.twhuajing_skills;
					})
					.reduce((list, evt) => list.addArray(evt.twhuajing_skills), [])
					.filter(skill => player.hasMark(skill));
				let choiceList = skills.map(i => {
					return (
						'<div class="skill">【' +
						get.translation(lib.translate[i + "_ab"] || get.translation(i).slice(0, 2)) +
						"】</div>" +
						"<div>" +
						get.skillInfoTranslation(i, player, false) +
						"</div>"
					);
				});
				const { control } = await player
					.chooseControl(skills)
					.set("prompt", "选择令" + get.translation(target) + "获得的“武”")
					.set("choiceList", choiceList)
					.set("displayIndex", false)
					.set("ai", () => get.event().controls.randomGet())
					.forResult();
				if (control) {
					player.removeMark(control, 1);
					player.markSkill("twhuajing");
					player.popup(control, "metal");
					target.addTempSkill(control, { player: "phaseAfter" });
					target.addTempSkill("twhuajing_blocker", { player: "phaseAfter" });
					target.getHistory("custom").push({ twhuajing_skills: [control] });
					await player.draw(2);
				}
			}
		},
		ai: { combo: "twhuajing" },
	},
};
