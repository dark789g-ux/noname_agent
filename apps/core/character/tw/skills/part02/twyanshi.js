import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twyanshi" | "twrenchou">} */
export const groupSkills = {
	//赵娥
	twyanshi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			const cards = event.twyanshi;
			return cards?.length > 0 && player.countCards("hs") > 0;
		},
		onChooseToUse(event) {
			if (game.online || event.twyanshi) {
				return;
			}
			const targets = game.filterPlayer(current => {
					return current.hasMark("twyanshi_mark");
				}),
				player = event.player;
			if (!targets?.length) {
				event.set("twyanshi", []);
				return;
			}
			const list = get.inpileVCardList(list => {
				const info = lib.card[list[2]];
				if (!info || info.notarget || (info.selectTarget && info.selectTarget != 1)) {
					return false;
				}
				if (!get.tag({ name: list[2] }, "damage")) {
					return false;
				}
				return targets?.some(target => player.canUse(list[2], target));
			});
			event.set("twyanshi", list);
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("言誓", [event.twyanshi, "vcard"], "hidden");
			},
			check(button) {
				var player = _status.event.player,
					card = { name: button.link[2] };
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					audio: "twyanshi",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						storage: {
							twyanshi: true,
						},
					},
					ai1: card => 7 - get.value(card),
					async precontent(event, trigger, player) {
						player.addTempSkill("twyanshi_remove");
					},
					filterCard: true,
					position: "hs",
					popname: true,
				};
			},
			prompt(links, player) {
				return `将一张手牌当做${get.translation(links[0][3]) || ""}${get.translation(links[0][2])}对有“誓”的角色使用`;
			},
		},
		ai: {
			order: 6,
			result: { player: 1 },
		},
		locked: false,
		mod: {
			playerEnabled(card, player, target) {
				if (card?.storage?.twyanshi && !target?.hasMark("twyanshi_mark")) {
					return false;
				}
			},
			/*targetInRange(card, player, target) {
				if (target.hasMark("twyanshi_mark")) {
					return true;
				}
			},*/
		},
		onremove: true,
		intro: {
			content: "players",
		},
		group: ["twyanshi_hurt", "twyanshi_init"],
		subSkill: {
			hurt: {
				audio: "twyanshi",
				trigger: {
					global: "damageEnd",
				},
				forced: true,
				locked: false,
				filter(event, player) {
					if (!player.getStorage("twyanshi").includes(event.player) && player != event.player) {
						return false;
					}
					return event.player.getHistory("damage").indexOf(event) == 0;
				},
				async content(event, trigger, player) {
					await player.draw(3);
					if (trigger.source?.isIn() && trigger.source.countMark("twyanshi_mark") < 3) {
						const target = trigger.source;
						player.line(target, "green");
						target.addMark("twyanshi_mark", 1);
					}
				},
			},
			init: {
				audio: "twyanshi",
				trigger: { global: "phaseBefore", player: "enterGame" },
				locked: true,
				filter(event, player) {
					return game.hasPlayer(current => current != player) && (event.name != "phase" || game.phaseNumber == 0);
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget("言誓：选择一名其他角色", lib.filter.notMe, true)
						.set("ai", target => get.attitude(_status.event.player, target))
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					player.markAuto("twyanshi", [target]);
				},
			},
			remove: {
				trigger: {
					player: "useCardAfter",
				},
				filter(event, player) {
					return (
						event.card?.storage?.twyanshi &&
						event.targets?.some(target => {
							return target.isIn() && target.countMark("twyanshi_mark");
						})
					);
				},
				charlotte: true,
				async cost(event, trigger, player) {
					const targets = trigger.targets.filter(target => {
						return target.isIn() && target.countMark("twyanshi_mark");
					});
					player.line(targets, "fire");
					targets.forEach(target => {
						target.removeMark("twyanshi_mark", 1);
					});
				},
			},
			backup: {},
			mark: {
				marktext: "誓",
				intro: {
					name: "誓",
					name2: "誓",
					content: "mark",
				},
			},
		},
	},
	twrenchou: {
		audio: 2,
		trigger: { global: ["die", "dieAfter"] },
		forced: true,
		forceDie: true,
		filter(event, player, name) {
			if (name == "die") {
				return event.player == player && player.getStorage("twyanshi").some(i => i.isIn());
			}
			return player.getStorage("twyanshi").includes(event.player);
		},
		skillAnimation: true,
		animationColor: "water",
		async content(event, trigger, player) {
			if (trigger.player == player) {
				for (const current of player.getStorage("twyanshi").sortBySeat(_status.currentPhase)) {
					if (current.isIn()) {
						player.line(current, "green");
						await current.addSkills("twyanshi");
					}
				}
			} else {
				player.addSkill("twrenchou_fuqi");
			}
		},
		ai: {
			combo: "twyanshi",
		},
		subSkill: {
			fuqi: {
				trigger: {
					player: "useCard",
				},
				charlotte: true,
				filter(event, player) {
					const targets = get.info("twrenchou_fuqi")?.logTarget(event, player);
					return targets?.length;
				},
				logTarget(event, player) {
					return game.filterPlayer(current => {
						return current.countMark("twyanshi_mark");
					});
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.directHit.addArray(event.targets);
				},
			},
			ai: {
				ai: {
					effect: {
						target(card, player, target) {
							if (!get.tag(card, "damage")) {
								return;
							}
							if (target.hp > 1) {
								return;
							}
							var num = 0;
							game.filterPlayer(current => {
								if (current.getStorage("twyanshi").some(i => target == i)) {
									num += current.hp;
								}
							});
							var targets = target.getStorage("twyanshi").filter(i => i.isIn());
							for (var targetx of targets) {
								num += targetx.hp;
							}
							if (num >= player.hp) {
								return 0;
							}
							if (num > 0) {
								return [1, 0, 0, 0.5 - 1.5 * num];
							}
						},
					},
				},
			},
		},
	},
};
