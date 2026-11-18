import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbquanmou" | "dcsbpingliao" | "dcduanxie" | "diaodu" | "diancai">} */
export const groupSkills = {
	//谋司马懿
	dcsbquanmou: {
		audio: 2,
		audioname: ["dc_sb_simayi_shadow"],
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			player.changeSkin({ characterName: "dc_sb_simayi" }, "dc_sb_simayi" + (player.storage[skill] ? "_shadow" : ""));
		},
		marktext: "☯",
		enable: "phaseUse",
		filter(event, player) {
			const selected = player.getStorage("dcsbquanmou_selected");
			return game.hasPlayer(current => !selected.includes(current) && player.inRange(current) && current.countCards("he") > 0);
		},
		filterTarget(card, player, target) {
			if (player === target) {
				return false;
			}
			const selected = player.getStorage("dcsbquanmou_selected");
			return !selected.includes(target) && player.inRange(target) && target.countCards("he") > 0;
		},
		prompt() {
			const player = get.player();
			if (player.storage.dcsbquanmou) {
				return "转换技。出牌阶段每名角色限一次，你可以令一名攻击范围内的其他角色交给你一张牌。当你于本阶段内下次对其造成伤害后，你可以选择除其外的至多三名其他角色，对这些角色依次造成1点伤害。";
			}
			return "转换技。出牌阶段每名角色限一次，你可以令一名攻击范围内的其他角色交给你一张牌。当你于本阶段内下次对其造成伤害时，取消之。";
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.changeZhuanhuanji("dcsbquanmou");
			player.markAuto("dcsbquanmou_selected", [target]);
			const { cards } = await target.chooseCard("he", true, `选择交给${get.translation(player)}一张牌`).forResult();
			if (cards && cards.length) {
				await target.give(cards, player);
				const key = `dcsbquanmou_${Boolean(!player.storage.dcsbquanmou)}`;
				player.addTempSkill(key, { global: ["phaseUseBefore", "phaseChange"] });
				player.markAuto(key, [target]);
				target.addAdditionalSkill(`${key}_${player.playerid}`, `${key}_mark`);
			}
		},
		ai: {
			order: 9,
			result: {
				player(player, target) {
					if (player.storage.dcsbquanmou) {
						return 1;
					}
					return 1 + game.countPlayer(i => player !== i && target !== i && !i.hasSkill("false_mark") && get.attitude(player, i) < 0);
				},
				target(player, target) {
					let res = target.hasSkillTag("noh") ? 0 : -1;
					if (player.storage.dcsbquanmou) {
						return res + 0.6;
					}
					return res;
				},
			},
		},
		onremove: true,
		mark: true,
		intro: {
			content: storage => {
				if (storage) {
					return "转换技。出牌阶段每名角色限一次，你可以令一名攻击范围内的其他角色交给你一张牌。当你于本阶段内下次对其造成伤害后，你可以选择除其外的至多三名其他角色，对这些角色依次造成1点伤害。";
				}
				return "转换技。出牌阶段每名角色限一次，你可以令一名攻击范围内的其他角色交给你一张牌。当你于本阶段内下次对其造成伤害时，取消之。";
			},
		},
		group: "dcsbquanmou_change",
		subSkill: {
			change: {
				audio: "dcsbquanmou",
				audioname: ["dc_sb_simayi_shadow"],
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				prompt2(event, player) {
					return "切换【权谋】为状态" + (player.storage.dcsbquanmou ? "阳" : "阴");
				},
				check: () => Math.random() > 0.5,
				content() {
					player.changeZhuanhuanji("dcsbquanmou");
				},
			},
			true: {
				charlotte: true,
				audio: "dcsbquanmou",
				audioname: ["dc_sb_simayi_shadow"],
				trigger: { source: "damageSource" },
				forced: true,
				popup: false,
				filter(event, player) {
					return player.getStorage("dcsbquanmou_true").includes(event.player);
				},
				async content(event, trigger, player) {
					const target = trigger.player;
					player.getStorage("dcsbquanmou_true").remove(target);
					target.removeAdditionalSkill(`dcsbquanmou_true_${player.playerid}`);
					if (game.hasPlayer(current => current != player && current != target)) {
						const result = await player
							.chooseTarget([1, 3], `权谋：是否对${get.translation(target)}之外的至多三名其他角色各造成1点伤害？`, (card, player, target) => {
								return target != player && target != get.event().getTrigger().player;
							})
							.set("ai", target => {
								const player = get.player();
								return get.damageEffect(target, player, player);
							})
							.forResult();
						if (result.bool) {
							await player.logSkill("dcsbquanmou", result.targets);
							for (let i of result.targets) {
								if (i.isIn()) {
									await i.damage();
								}
							}
						}
					}
				},
				onremove(player, skill) {
					game.filterPlayer(current => {
						current.removeAdditionalSkill(`${skill}_${player.playerid}`);
					});
					delete player.storage[skill];
					delete player.storage.dcsbquanmou_selected;
				},
			},
			true_mark: {
				charlotte: true,
				mark: true,
				marktext: "讨",
				intro: {
					name: "权谋 - 阴",
					content: () => {
						return `当你下次受到${get.translation(_status.currentPhase)}造成的伤害后，其可以对除你之外的至多三名其他角色各造成1点伤害。`;
					},
				},
				ai: {
					threaten: 2.5,
					effect: {
						target(card, player, target) {
							if (get.tag(card, "damage") && player && player.hasSkill("dcsbquanmou_true")) {
								let tars = game.countPlayer(i => player !== i && target !== i && get.attitude(player, target) < 0 && !target.hasSkill("dcsbquanmou_false_mark"));
								return [1, 0, 1, (6 * Math.min(3, tars)) / (3 + Math.pow(target.countCards("h"), 2))];
							}
						},
					},
				},
			},
			false: {
				charlotte: true,
				audio: "dcsbquanmou",
				audioname: ["dc_sb_simayi_shadow"],
				trigger: { source: "damageBegin2" },
				forced: true,
				filter(event, player) {
					return player.getStorage("dcsbquanmou_false").includes(event.player);
				},
				async content(event, trigger, player) {
					const target = trigger.player;
					player.getStorage("dcsbquanmou_false").remove(target);
					target.removeAdditionalSkill(`dcsbquanmou_false_${player.playerid}`);
					trigger.cancel();
				},
				onremove(player, skill) {
					game.filterPlayer(current => {
						current.removeAdditionalSkill(`${skill}_${player.playerid}`);
					});
					delete player.storage[skill];
					delete player.storage.dcsbquanmou_selected;
				},
			},
			false_mark: {
				charlotte: true,
				mark: true,
				marktext: "抚",
				intro: {
					name: "权谋 - 阳",
					content: () => {
						return `当你下次受到${get.translation(_status.currentPhase)}造成的伤害时，防止此伤害。`;
					},
				},
				ai: {
					nodamage: true,
					nofire: true,
					nothunder: true,
					skillTagFilter(player, tag, arg) {
						return arg && arg.player && arg.player.hasSkill("dcsbquanmou_false");
					},
					effect: {
						target(card, player, target) {
							if (get.tag(card, "damage") && player && player.hasSkill("dcsbquanmou_false")) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
		},
	},
	dcsbpingliao: {
		audio: 2,
		audioname: ["dc_sb_simayi_shadow"],
		trigger: { player: "useCard" },
		forced: true,
		filter(event, player) {
			return event.card.name == "sha";
		},
		logTarget(event, player) {
			return game.filterPlayer(current => player.inRange(current));
		},
		async content(event, trigger, player) {
			const unrespondedTargets = [];
			const respondedTargets = [];
			let nonnonTargetResponded = false;
			const targets = game.filterPlayer().sortBySeat();
			const prompt = `###是否打出红色基本牌响应${get.translation(player)}？###${get.translation(player)}使用了一张不公开目标的${get.translation(trigger.card)}。若你选择响应且你不是此牌的隐藏目标，则其摸两张牌；若你选择不响应且你是此牌的隐藏目标，则你本回合内不能使用或打出手牌。`;
			for (let target of targets) {
				if (target.isIn() && player.inRange(target)) {
					const result = await target
						.chooseToRespond(prompt, (card, player) => {
							if (get.type(card) !== "basic") {
								return false;
							}
							const color = get.color(card);
							return color == "red" || color == "unsure";
						})
						.set("ai", card => {
							const player = get.player(),
								event = get.event();
							const source = event.getParent().player;
							//是队友且没有其他疑似队友的选手响应 那响应一下
							if (get.attitude(player, source) > 0) {
								if (
									!event.respondedTargets.some(current => {
										return get.attitude(player, current) > 0 || get.attitude(source, current) >= 0;
									})
								) {
									return get.order(card);
								}
								return -1;
							} else {
								//不残或者没有其他的闪就不响应
								if (
									player.hp > 1 ||
									!player.hasCard("hs", i => {
										if (i == card || (card.cards && card.cards.includes(i))) {
											return false;
										}
										let name = get.name(i, player);
										return name == "shan" || name == "tao" || name == "jiu";
									})
								) {
									return 0;
								}
							}
							return event.getRand("dcsbpingliao") > 1 / Math.max(1, player.hp) ? 0 : get.order(card);
						})
						.set("respondedTargets", respondedTargets)
						.forResult();
					if (result.bool) {
						respondedTargets.push(target);
						if (!trigger.targets.includes(target)) {
							nonnonTargetResponded = true;
						}
						await game.delay();
					} else if (trigger.targets.includes(target)) {
						unrespondedTargets.push(target);
					}
				}
			}
			unrespondedTargets.forEach(current => {
				current.addTempSkill("dcsbpingliao_blocker");
				game.log(current, "本回合内无法使用或打出手牌");
			});
			if (nonnonTargetResponded) {
				player.draw(2);
				player.addTempSkill("dcsbpingliao_buff", { global: "phaseChange" });
				player.addMark("dcsbpingliao_buff", 1, false);
			}
		},
		ai: {
			ignoreLogAI: true,
			skillTagFilter(player, tag, args) {
				if (args) {
					return args.card && get.name(args.card) == "sha";
				}
			},
		},
		group: "dcsbpingliao_hide",
		subSkill: {
			hide: {
				audio: "dcsbpingliao",
				trigger: { player: "useCard0" },
				forced: true,
				filter(event, player) {
					return event.card.name == "sha";
				},
				async content(event, trigger, player) {
					trigger.hideTargets = true;
					game.log(player, "隐藏了", trigger.card, "的目标");
				},
			},
			buff: {
				onremove: true,
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("dcsbpingliao_buff");
						}
					},
				},
				mark: true,
				intro: {
					content: "本阶段内使用【杀】的次数上限+#",
				},
			},
			blocker: {
				charlotte: true,
				mod: {
					cardEnabled2(card, player) {
						if (player.getCards("h").includes(card)) {
							return false;
						}
					},
				},
				mark: true,
				marktext: "封",
				intro: {
					content: "本回合内不能使用或打出手牌",
				},
			},
		},
	},
	//陈武董袭
	dcduanxie: {
		audio: "duanxie",
		inherit: "duanxie",
		selectTarget: 1,
	},
	//吕范
	diaodu: {
		audio: 2,
		trigger: { player: ["phaseUseBegin", "logSkill"] },
		filter(event, player) {
			if (event.name == "logSkill" && event.skill != "diancai") {
				return false;
			}
			return game.hasPlayer(target => {
				return get.distance(player, target) <= 1 && target.countGainableCards(player, "e");
			});
		},
		direct: true,
		async content(event, trigger, player) {
			const { bool, targets } = await player
				.chooseTarget(get.prompt2("diaodu"), (card, player, target) => {
					return get.distance(player, target) <= 1 && target.countGainableCards(player, "e");
				})
				.set("ai", target => {
					const player = get.event().player;
					return get.effect(target, { name: "shunshou_copy", position: "e" }, player, player);
				})
				.forResult();
			if (bool) {
				const aim = targets[0];
				player.logSkill("diaodu", aim);
				const { bool, cards } = await player.gainPlayerCard(aim, "e", true).forResult();
				if (bool && game.hasPlayer(target => target != aim)) {
					const card = cards[0];
					const { bool, targets } = await player
						.chooseTarget(
							"调度：将" + get.translation(card) + "交给另一名角色",
							(card, player, target) => {
								return target != get.event().aim;
							},
							true
						)
						.set("ai", target => {
							const player = get.event().player;
							return get.attitude(player, target);
						})
						.set("aim", aim)
						.forResult();
					if (bool && get.owner(card) == player) {
						const target = targets[0];
						player.line(target, "green");
						if (target != player) {
							await player.give([card], target);
						}
						if (get.owner(card) == target) {
							const { bool } = await target.chooseUseTarget(card).forResult();
							if (bool) {
								await player.draw();
							} else {
								await target.draw();
							}
						}
					}
				}
			}
		},
	},
	diancai: {
		audio: 2,
		inherit: "mbdiancai",
		filter(event, player) {
			if (_status.currentPhase === player) {
				return false;
			}
			let num = player
				.getHistory("lose", evt => {
					return evt.cards2 && evt.cards2.length && evt.getParent("phaseUse") == event;
				})
				.reduce((sum, evt) => {
					return sum + evt.cards2.length;
				}, 0);
			return num >= Math.min(5, player.getHp());
		},
	},
};
