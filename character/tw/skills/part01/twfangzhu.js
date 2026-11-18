import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twfangzhu" | "twsongwei">} */
export const groupSkills = {
	twfangzhu: {
		getList: [
			{
				cost: 1,
				prompt: () => "令一名其他角色于手牌中只能使用基本牌直到其回合结束",
				filter: player =>
					get.mode() != "doudizhu" && game.hasPlayer(target => target != player && !target.getStorage("twfangzhu_ban").includes("basic")),
				filterTarget: {
					filterTarget: (card, player, target) => target != player && !target.getStorage("twfangzhu_ban").includes("basic"),
				},
				async content(player, target) {
					target.addTempSkill("twfangzhu_ban", { player: "phaseEnd" });
					target.markAuto("twfangzhu_ban", ["basic"]);
					lib.skill.twfangzhu_ban.init(target, "twfangzhu_ban");
				},
				ai: {
					result: {
						target(player, target) {
							return -(target.countCards("hs") + 2) / 3;
						},
					},
				},
			},
			{
				cost: 2,
				prompt: () => "令一名其他角色于手牌中只能使用锦囊牌直到其回合结束",
				filter: player => game.hasPlayer(target => target != player && !target.getStorage("twfangzhu_ban").includes("trick")),
				filterTarget: {
					filterTarget: (card, player, target) => target != player && !target.getStorage("twfangzhu_ban").includes("trick"),
				},
				async content(player, target) {
					target.addTempSkill("twfangzhu_ban", { player: "phaseEnd" });
					target.markAuto("twfangzhu_ban", ["trick"]);
					lib.skill.twfangzhu_ban.init(target, "twfangzhu_ban");
				},
				ai: {
					result: {
						target(player, target) {
							return -(target.countCards("hs") + 2) / 2;
						},
					},
				},
			},
			{
				cost: 3,
				prompt: () => "令一名其他角色于手牌中只能使用装备牌直到其回合结束",
				filter: player =>
					get.mode() != "doudizhu" && game.hasPlayer(target => target != player && !target.getStorage("twfangzhu_ban").includes("equip")),
				filterTarget: {
					filterTarget: (card, player, target) => target != player && !target.getStorage("twfangzhu_ban").includes("equip"),
				},
				async content(player, target) {
					target.addTempSkill("twfangzhu_ban", { player: "phaseEnd" });
					target.markAuto("twfangzhu_ban", ["equip"]);
					lib.skill.twfangzhu_ban.init(target, "twfangzhu_ban");
				},
				ai: {
					result: {
						target(player, target) {
							return -target.countCards("hs") - 2;
						},
					},
				},
			},
			{
				cost: 2,
				prompt: () => "令一名其他角色的非Charlotte技能失效直到其回合结束",
				filter: player => get.mode() != "doudizhu" && game.hasPlayer(target => target != player),
				filterTarget: {
					filterTarget: lib.filter.notMe,
				},
				async content(player, target) {
					target.addTempSkill("twfangzhu_baiban", { player: "phaseEnd" });
				},
				ai: {
					result: {
						target(player, target) {
							return (
								-target.getSkills(null, false).filter(i => get.info(i) && !get.info(i).charlotte).length *
								get.threaten(target, player)
							);
						},
					},
				},
			},
			{
				cost: 2,
				prompt: () => "令一名其他角色不能响应另一名角色使用的牌直到其回合结束",
				filter(player) {
					return game.hasPlayer(target => {
						if (target !== player) {
							return game.hasPlayer(current => {
								if (current !== target) {
									return !current.getStorage("twfangzhu_kill").includes(target);
								}
								return false;
							});
						}
						return false;
					});
				},
				filterTarget: {
					filterTarget(card, player, target) {
						return ui.selected.targets.length > 0 || target !== player;
					},
					selectTarget: 2,
					targetprompt: ["被响应", "响应源"],
					multitarget: true,
				},
				async content(player, target, source) {
					source.addTempSkill("twfangzhu_kill", { player: "phaseEnd" });
					source.markAuto("twfangzhu_kill", [target]);
				},
			},
			{
				cost: 3,
				prompt: () => "令一名其他角色将武将牌翻面",
				filter: player => game.hasPlayer(target => target != player),
				filterTarget: {
					filterTarget: lib.filter.notMe,
				},
				async content(player, target) {
					await target.turnOver();
				},
				ai: {
					result: {
						target(player, target) {
							return target.isTurnedOver() ? 3.5 : -3.5;
						},
					},
				},
			},
		],
		audio: "sbfangzhu",
		enable: "phaseUse",
		filter(event, player) {
			return get.info("twfangzhu").getList.some(effect => {
				return player.countMark("twxingshang") >= effect.cost && effect.filter(player);
			});
		},
		usable: 1,
		chooseButton: {
			dialog() {
				let dialog = ui.create.dialog("放逐：请选择一项", "hidden");
				const list = get.info("twfangzhu").getList.slice();
				dialog.add([
					list.map(effect => {
						return [effect, "移去" + effect.cost + "个“颂”标记，" + effect.prompt()];
					}),
					"textbutton",
				]);
				return dialog;
			},
			filter(button, player) {
				const effect = button.link;
				return player.countMark("twxingshang") >= effect.cost && effect.filter(player);
			},
			check(button) {
				const player = get.event().player,
					effect = button.link;
				return Math.max(
					...game
						.filterPlayer(target => {
							const filterTarget = effect.filterTarget.filterTarget;
							if (!filterTarget) {
								return target == player;
							}
							if (typeof filterTarget == "function") {
								return filterTarget(null, player, target);
							}
							return true;
						})
						.map(target => {
							game.broadcastAll(effect => (lib.skill["twxingshang_aiSkill"].ai = effect.ai || {}), effect);
							return get.effect(target, "twxingshang_aiSkill", player, player);
						})
				);
			},
			backup(links, player) {
				const effect = links[0];
				return {
					effect: effect,
					audio: "sbfangzhu",
					audioname: ["mb_caomao"],
					filterCard: () => false,
					selectCard: -1,
					...effect.filterTarget,
					async content(event, trigger, player) {
						const effect = lib.skill.twfangzhu_backup.effect;
						player.removeMark("twxingshang", effect.cost);
						await effect.content(player, ...event.targets);
					},
					ai: effect.ai,
				};
			},
			prompt(links, player) {
				const effect = links[0],
					str = "###放逐###";
				return str + '<div class="text center">' + "移去" + effect.cost + "个“颂”标记，" + effect.prompt() + "</div>";
			},
		},
		ai: {
			combo: "twxingshang",
			order: 7,
			result: {
				player(player) {
					const list = get.info("twfangzhu").getList.filter(effect => {
						return player.countMark("twxingshang") >= effect.cost && effect.filter(player);
					});
					return Math.max(
						...list.map(effect => {
							return Math.max(
								...game
									.filterPlayer(target => {
										const filterTarget = effect.filterTarget.filterTarget;
										if (!filterTarget) {
											return target == player;
										}
										if (typeof filterTarget == "function") {
											return filterTarget(null, player, target);
										}
										return true;
									})
									.map(target => {
										game.broadcastAll(effect => (lib.skill["twxingshang_aiSkill"].ai = effect.ai || {}), effect);
										return get.effect(target, "twxingshang_aiSkill", player, player);
									})
							);
						})
					);
				},
			},
		},
		subSkill: {
			backup: {},
			baiban: {
				init(player, skill) {
					player.addSkillBlocker(skill);
					player.addTip(skill, "放逐 技能失效");
				},
				onremove(player, skill) {
					player.removeSkillBlocker(skill);
					player.removeTip(skill);
				},
				inherit: "baiban",
				marktext: "逐",
			},
			kill: {
				charlotte: true,
				onremove: true,
				marktext: "放",
				intro: { content: "$不能响应你使用的牌" },
				trigger: { player: "useCard1" },
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					trigger.directHit.addArray(player.getStorage(event.name));
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						return player.getStorage("twfangzhu_kill").includes(arg?.target);
					},
				},
			},
			ban: {
				charlotte: true,
				mark: true,
				marktext: "禁",
				intro: {
					markcount: () => 0,
					content(storage) {
						if (storage.length > 1) {
							return "不能使用手牌";
						}
						return "于手牌中只能使用" + get.translation(storage[0]) + "牌";
					},
				},
				init(player, skill) {
					let storage = player.getStorage(skill);
					if (storage.length) {
						player.addTip(skill, "放逐 限" + (storage.length === 1 ? get.translation(storage[0])[0] : "手牌"));
					}
				},
				onremove(player, skill) {
					player.removeTip(skill);
					delete player.storage[skill];
				},
				mod: {
					cardEnabled(card, player) {
						const storage = player.getStorage("twfangzhu_ban");
						const hs = player.getCards("h"),
							cards = [card];
						if (Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						}
						if (cards.containsSome(...hs) && (storage.length > 1 || !storage.includes(get.type2(card)))) {
							return false;
						}
					},
					cardSavable(card, player) {
						const storage = player.getStorage("twfangzhu_ban");
						const hs = player.getCards("h"),
							cards = [card];
						if (Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						}
						if (cards.containsSome(...hs) && (storage.length > 1 || !storage.includes(get.type2(card)))) {
							return false;
						}
					},
				},
			},
		},
	},
	twsongwei: {
		audio: "sbsongwei",
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			if (player.countMark("twxingshang") >= get.info("twxingshang").getLimit) {
				return false;
			}
			return game.hasPlayer(target => target.group == "wei" && target != player);
		},
		zhuSkill: true,
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			player.addMark(
				"twxingshang",
				Math.min(
					get.info("twxingshang").getLimit - player.countMark("twxingshang"),
					2 * game.countPlayer(target => target.group == "wei" && target != player)
				)
			);
		},
		group: "twsongwei_delete",
		subSkill: {
			delete: {
				audio: "sbsongwei",
				enable: "phaseUse",
				filter(event, player) {
					if (player.storage.twsongwei_delete) {
						return false;
					}
					return game.hasPlayer(target => lib.skill.twsongwei.subSkill.delete.filterTarget(null, player, target));
				},
				filterTarget(card, player, target) {
					return target != player && target.group == "wei" && target.getStockSkills(false, true).length;
				},
				skillAnimation: true,
				animationColor: "thunder",
				async content(event, trigger, player) {
					player.storage.twsongwei_delete = true;
					player.awakenSkill(event.name);
					event.target.removeSkills(event.target.getStockSkills(false, true));
				},
				ai: {
					order: 13,
					result: {
						target(player, target) {
							return -target.getStockSkills(false, true).length;
						},
					},
				},
			},
		},
	},
};
