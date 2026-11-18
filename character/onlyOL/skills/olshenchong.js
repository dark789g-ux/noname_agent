import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olshenchong" | "olrefeiyang" | "oljulian" | "ollonglin" | "olzhendan">} */
export const groupSkills = {
	olshenchong: {
		limited: true,
		audio: "jsrgshenchong",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(target => {
				return target !== player && lib.skill.olshenchong.derivation.some(i => !target.hasSkill(i, null, false, false));
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target !== player && lib.skill.olshenchong.derivation.some(i => !target.hasSkill(i, null, false, false));
				})
				.set("ai", target => {
					if (player.hasUnknown()) {
						return 0;
					}
					return get.effect(target, "jsrgshenchong", player, player);
				})
				.forResult();
		},
		skillAnimation: true,
		animationColor: "soil",
		async content(event, trigger, player) {
			const {
				targets: [target],
				name: skillName,
			} = event;
			player.awakenSkill(skillName);
			await target.addSkills(get.info(skillName).derivation);
			player.addSkill(skillName + "_die");
			player.markAuto(skillName + "_die", [target]);
		},
		derivation: ["olrefeiyang", "jsrgbahu"],
		subSkill: {
			die: {
				charlotte: true,
				audio: "jsrgshenchong",
				trigger: { player: "die" },
				filter(event, player) {
					return (event.source?.isIn() && event.source.countCards("h")) || player.getStorage("olshenchong_die").some(current => current.isIn());
				},
				forced: true,
				forceDie: true,
				async content(event, trigger, player) {
					const source = trigger.source;
					if (source?.isIn() && source.countCards("h")) {
						player.line(source);
						await source.chooseToDiscard(source.countCards("h"), "h", true);
						await game.delayx();
					}
					const targets = player
						.getStorage("olshenchong_die")
						.filter(current => current.isIn())
						.sortBySeat();
					if (targets.length > 0) {
						player.line(targets);
						for (const current of targets) {
							await current.removeSkills(current.getSkills(null, false, false));
						}
						await game.delayx();
					}
				},
			},
		},
	},
	olrefeiyang: {
		trigger: { player: "phaseJudgeBegin" },
		filter(event, player) {
			return (
				player.countCards("j") &&
				player.countCards("he", card => {
					if (get.position(card) === "h" && _status.connectMode) {
						return false;
					}
					return lib.filter.cardDiscardable(card, player);
				}) > 1
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard("he", 2, get.prompt(event.skill), "弃置两张牌，然后弃置判定区里的所有牌")
				.set("logSkill", event.skill)
				.set("ai", card => {
					return _status.event.goon ? 7 - get.value(card) : 0;
				})
				.set(
					"goon",
					(() => {
						if (player.hasSkillTag("rejudge") && player.countCards("j") < 2) {
							return false;
						}
						return player.hasCard(function (card) {
							if (get.tag(card, "damage") && get.damageEffect(player, player, _status.event.player, get.natureList(card)) >= 0) {
								return false;
							}
							return (
								get.effect(
									player,
									{
										name: card.viewAs || card.name,
										cards: [card],
									},
									player,
									player
								) < 0
							);
						}, "j");
					})()
				)
				.forResult();
			event.result.skill_popup = false;
		},
		async content(event, trigger, player) {
			await player.discardPlayerCard(player, "j", true, player.countCards("j"));
		},
	},
	oljulian: {
		audio: "jsrgjulian",
		inherit: "jsrgjulian",
		filter(event, player) {
			const { player: source } = event;
			const skill = "oljulian";
			if (source == player || source.group != "qun" || source.countMark(`${skill}_count`) >= lib.skill[skill].maxNum) {
				return false;
			}
			const evt = event.getParent("phaseDraw");
			return (!evt || evt.player != source) && event.getParent().name == "draw" && event.getParent(2).name != skill && player.hasZhuSkill(skill, event.player);
		},
		maxNum: 1,
		group: "oljulian_gain",
		subSkill: {
			gain: {
				audio: ["jsrgjulian3.mp3", "jsrgjulian4.mp3"],
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return lib.skill["oljulian_gain"].logTarget(null, player).length;
				},
				prompt: "是否发动【聚敛】？",
				prompt2: "获得其他所有群势力角色的各一张牌",
				logTarget(event, player) {
					return game
						.filterPlayer(current => {
							return current.group == "qun" && current.countGainableCards(player, "he") > 0 && current != player;
						})
						.sortBySeat();
				},
				async content(event, trigger, player) {
					for (const target of event.targets) {
						await player.gainPlayerCard(target, "he", true);
					}
				},
			},
			count: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	//闪赵云
	ollonglin: {
		audio: "jsrglonglin",
		inherit: "jsrglonglin",
		async content(event, trigger, player) {
			const juedou = new lib.element.VCard({ name: "juedou", storage: { ollonglin: true }, isCard: true });
			const result = await player
				.chooseToDiscard(get.prompt2("ollonglin"), "he")
				.set("ai", card => {
					if (get.event().goon) {
						return 5 - get.value(card);
					}
					return 0;
				})
				.set(
					"goon",
					(trigger.player.canUse(juedou, player) ? Math.max(0, get.effect(player, juedou, trigger.player, trigger.player)) : 0) +
						trigger.targets
							.map(target => {
								return get.effect(target, trigger.card, trigger.player, player);
							})
							.reduce((p, c) => {
								return p + c;
							}, 0) <
						-4
				)
				.set("logSkill", ["ollonglin", trigger.player])
				.forResult();
			if (result.bool) {
				trigger.excluded.addArray(trigger.targets);
				await game.delayx();
				if (trigger.player.canUse(juedou, player)) {
					const result = await trigger.player
						.chooseBool(`是否视为对${get.translation(player)}使用一张【决斗】？`)
						.set("choice", get.effect(player, juedou, trigger.player, trigger.player) >= 0)
						.forResult();
					if (result.bool) {
						player.addTempSkill("ollonglin_source");
						trigger.player.useCard(juedou, player);
					}
				}
			}
		},
		subSkill: {
			source: {
				charlotte: true,
				trigger: { source: "damageSource" },
				filter(event, player) {
					return event.card?.storage?.ollonglin;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.line(trigger.player);
					trigger.player.addTempSkill("ollonglin_forbid", {
						player: "useCard1",
						global: "phaseUseAfter",
					});
				},
			},
			forbid: {
				charlotte: true,
				mark: true,
				intro: { content: "不能指定其他角色为目标" },
				mod: {
					playerEnabled(card, player, target) {
						if (target !== player) {
							return false;
						}
					},
				},
			},
		},
	},
	olzhendan: {
		audio: "jsrgzhendan",
		enable: ["chooseToUse", "chooseToRespond"],
		onChooseToUse(event) {
			if (!game.online && !event.onzhendan) {
				event.set("olzhendan", get.info("olzhendan").getUsed(event.player));
			}
		},
		onChooseToRespond(event) {
			if (!game.online && !event.onzhendan) {
				event.set("olzhendan", get.info("olzhendan").getUsed(event.player));
			}
		},
		filter(event, player) {
			if (event.type === "wuxie") {
				return false;
			}
			if (
				!player.hasCard(card => {
					return _status.connectMode || get.type(card) !== "basic";
				}, "hs")
			) {
				return false;
			}
			return get.inpileVCardList(info => {
				if (info[0] !== "basic" || event.olzhendan?.includes(info[2])) {
					return false;
				}
				return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
			}).length;
		},
		chooseButton: {
			dialog(event, player) {
				const vcards = get.inpileVCardList(info => {
					if (info[0] !== "basic" || event.olzhendan?.includes(info[2])) {
						return false;
					}
					return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
				});
				return ui.create.dialog("镇胆", [vcards, "vcard"]);
			},
			check(button) {
				if (get.event().getParent().type !== "phase") {
					return 1;
				}
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				return {
					audio: "jsrgzhendan",
					popname: true,
					viewAs: { name: links[0][2], nature: links[0][3] },
					filterCard(card, player) {
						return get.type2(card) !== "basic";
					},
					position: "hs",
				};
			},
			prompt(links, player) {
				return "将一张非基本手牌当作" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用或打出";
			},
		},
		hiddenCard(player, name) {
			if (!lib.inpile.includes(name) || get.type(name) !== "basic" || player.isTempBanned("olzhendan")) {
				return false;
			}
			return (
				!get.info("olzhendan").getUsed(player).includes(name) &&
				player.hasCard(card => {
					return _status.connectMode || get.type(card) !== "basic";
				}, "hs")
			);
		},
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				return get.info("olzhendan").hiddenCard(player, name.slice("respond".length).toLowerCase());
			},
			order: 0.5,
			result: {
				player(player) {
					if (get.event().dying) {
						return get.attitude(player, get.event().dying);
					}
					return 1;
				},
			},
		},
		getUsed: player =>
			player
				.getRoundHistory("useCard", evt => get.type(evt.card) === "basic")
				.map(evt => evt.card.name)
				.unique(),
		group: "olzhendan_damage",
		subSkill: {
			backup: {},
			damage: {
				audio: "jsrgzhendan",
				trigger: {
					player: "damageEnd",
					global: "roundEnd",
				},
				filter(event, player) {
					if (event.name === "damage" && !player.isTempBanned("olzhendan")) {
						return true;
					}
					const history = _status.globalHistory;
					if (event.name !== "damage" || !history[history.length - 1].isRound) {
						for (let i = history.length - (event.name === "damage" ? 2 : 1); i >= 0; i--) {
							if (
								game.hasPlayer2(current => {
									const actionHistory = current.actionHistory[i];
									return actionHistory.isMe && !actionHistory.isSkipped;
								})
							) {
								return true;
							}
							if (history[i].isRound) {
								break;
							}
						}
					}
					return false;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const history = _status.globalHistory;
					let num = 0;
					if (trigger.name !== "damage" || !history[history.length - 1].isRound) {
						for (let i = history.length - (trigger.name === "damage" ? 2 : 1); i >= 0; i--) {
							game.hasPlayer2(current => {
								const actionHistory = current.actionHistory[i];
								return actionHistory.isMe && !actionHistory.isSkipped;
							}) && num++;
							if (num === 5 || history[i].isRound) {
								break;
							}
						}
					}
					num > 0 && (await player.draw(num));
					trigger.name === "damage" && player.tempBanSkill("olzhendan", "roundStart");
				},
			},
		},
	},
};
