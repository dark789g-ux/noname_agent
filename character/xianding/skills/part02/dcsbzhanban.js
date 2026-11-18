import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbzhanban" | "dcsbchensheng" | "dcsbtiancheng" | "dcsbyingjia" | "dcsbxianju">} */
export const groupSkills = {
	//谋刘协
	dcsbzhanban: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				const list = [1, 2, 3].map((item, index) => [index + 1, `摸${get.cnNumber(item)}张牌`]).concat([[-1, "弃置至多三张牌"]]);
				const dialog = ui.create.dialog(`斩绊：请选择是否摸牌或者弃牌`, [list.slice(0, 2), "tdnodes"], [list.slice(2, 4), "tdnodes"], "hidden");
				return dialog;
			},
			filter(button, player) {
				if (button.link == -1) {
					return player.countDiscardableCards(player, "he");
				}
				return true;
			},
			check(button) {
				const player = get.player(),
					link = button.link,
					hs = player.countCards("h"),
					nums = [],
					effs = [];
				let mine = [];
				if (link < 0) {
					// 考虑人机可能弃装备牌
					let discard = player
						.getCards("he")
						.sort((a, b) => get.value(a, player) - get.value(b, player))
						.slice(0, 3);
					let num = -discard.length;
					for (let card of discard) {
						if (get.position(card) === "e") {
							num++;
						} else {
							// 计算弃牌收益
							mine.push((mine.at(-1) || 0) - get.value(card, player));
						}
					}
					if (!num) {
						return 0;
					}
					while (num < 0) {
						// 枚举可能弃牌情况
						nums.push(hs + num);
						num++;
					}
				} else {
					nums.push(hs + link);
					mine.push(link * get.effect(player, { name: "draw" }, player, player));
				}
				for (const num of nums) {
					// 自己的摸弃牌收益+其他人的
					let eff = mine.pop();
					eff += game
						.filterPlayer(targetx => targetx !== player)
						.reduce((sum, targetx) => {
							const numx = num - targetx.countCards("h");
							let val;
							if (numx > 0) {
								val = (numx - 3) * get.effect(targetx, { name: "draw" }, player, player);
							} else if (numx < 0) {
								val = (numx + 3) * get.effect(targetx, { name: "draw" }, player, player);
							} else {
								val = get.damageEffect(targetx, player, player);
							}
							if (val < 0 && player.hasZhuSkill("dcsbtiancheng", targetx)) {
								return sum;
							}
							return sum + val;
						}, 0);
					effs.push(eff);
				}
				return Math.max(...effs);
			},
			backup(links) {
				return {
					audio: "dcsbzhanban",
					filterTarget: lib.filter.notMe,
					selectTarget: -1,
					log: false,
					link: links[0],
					async precontent(event, trigger, player) {
						player.logSkill("dcsbzhanban", event.result.targets);
						const link = lib.skill.dcsbzhanban_backup.link;
						if (link > 0) {
							await player.draw(link);
						} else if (link < 0) {
							await player.chooseToDiscard(`斩绊：请弃置一至三张牌`, "he", [1, 3], true);
						}
					},
					async content(event, trigger, player) {
						const num = player.countCards("h"),
							{ target } = event;
						if (!target) {
							return;
						}
						const numx = num - target.countCards("h");
						if (numx > 0) {
							await target.draw(numx, "nodelay");
						} else if (numx < 0) {
							await target.chooseToDiscard(-numx, "h", true, "allowChooseAll");
						}
						if (target.hasHistory("gain", evt => evt.getParent(2) == event)) {
							await target.chooseToDiscard(3, "he", true);
						} else if (target.hasHistory("lose", evt => evt.type == "discard" && evt.getlx !== false && evt.getParent(3) == event)) {
							await target.draw(3, "nodelay");
						} else {
							await target.damage();
						}
					},
				};
			},
		},
		ai: {
			order: 5,
			result: { player: 1 },
		},
	},
	dcsbchensheng: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return !player.isMaxHandcard(true) && !_status.currentPhase?.isMaxHandcard(true) && player != _status.currentPhase;
		},
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	dcsbtiancheng: {
		audio: 2,
		zhuSkill: true,
		trigger: { player: "pre_dcsbzhanban_backupBegin" },
		filter(event, player) {
			return event.player == player && game.hasPlayer(target => target != player && target.group == "qun" && event.result.targets.includes(target)) && player.hasZhuSkill("dcsbtiancheng");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, Infinity], (card, player, target) => {
					return target != player && target.group == "qun" && get.event().getTrigger().result.targets.includes(target);
				})
				.set("ai", target => {
					const num = get.player().countCards("h"),
						numx = num - target.countCards("h"),
						att = get.attitude(get.player(), target);
					let val;
					if (numx > 0) {
						val = numx - 3;
					} else if (numx < 0) {
						val = numx + 3;
					} else {
						val = -2;
					}
					val = val == 0 ? 0.5 : val;
					return val * att < 0;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			trigger.result.targets.removeArray(targets);
			await game.delayx();
		},
		ai: { combo: "dcsbzhanban" },
		derivation: "dcsbzhanban",
	},
	//谋曹洪
	dcsbyingjia: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		forced: true,
		filter(event, player) {
			return lib.skill.dcsbyingjia.logTarget(event, player).length;
		},
		logTarget(event, player) {
			return event.targets?.filter(target => target != player);
		},
		async content(event, trigger, player) {
			const targets = event.targets.filter(target => get.distance(player, target) != 1).sortBySeat();
			player.addTempSkill("dcsbyingjia_distance");
			player.markAuto("dcsbyingjia_distance", targets);
			if (!game.hasPlayer(target => target != player && get.distance(player, target) != 1)) {
				if (
					!game.hasPlayer(target => {
						return target != player && target.countCards("h") && !player.getStorage("dcsbyingjia_used").includes(target);
					})
				) {
					return;
				}
				const result = await player
					.chooseTarget(`迎驾：你可以获得一名其他角色所有手牌，然后交给其等量张牌`, (card, player, target) => {
						return player != target && target.countCards("h") && !player.getStorage("dcsbyingjia_used").includes(target);
					})
					.set("ai", target => -get.attitude(get.player(), target) * target.countCards("h"))
					.forResult();
				if (result?.bool && result?.targets?.length) {
					const target = result.targets[0];
					player.line(target);
					player.addTempSkill("dcsbyingjia_used");
					player.markAuto("dcsbyingjia_used", target);
					const cards = target.getGainableCards(player, "h");
					if (!cards.length) {
						return;
					}
					await player.gain(cards, target, "giveAuto", "bySelf");
					if (player.countCards("he")) {
						await player.chooseToGive(target, cards.length, true, "he");
					}
				}
			}
		},
		subSkill: {
			used: {
				onremove: true,
				charlotte: true,
			},
			distance: {
				onremove: true,
				charlotte: true,
				mark: true,
				intro: { content: "本回合你计算与 $ 的距离为1" },
				mod: {
					globalFrom(from, to) {
						if (from.getStorage("dcsbyingjia_distance").includes(to)) {
							return -Infinity;
						}
					},
				},
			},
		},
	},
	dcsbxianju: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(target => target != player && target.inRangeOf(player) && target.countGainableCards(player, "he"));
		},
		filterTarget(card, player, target) {
			return target != player && target.inRangeOf(player);
		},
		selectTarget: -1,
		multiline: true,
		multitarget: true,
		async content(event, trigger, player) {
			await player.gainMultiple(event.targets, "he");
			player
				.when("phaseUseEnd")
				.filter(evt => evt === event.getParent("phaseUse"))
				.step(async (event, trigger, player) => {
					const num = game.countPlayer(target => target != player && !target.inRangeOf(player));
					if (!num) {
						return;
					}
					if (player.countDiscardableCards(player, "he")) {
						await player.chooseToDiscard(num, "he", true);
					}
				});
		},
		ai: {
			order: 2,
			result: {
				player: 1,
				target: -1,
			},
		},
	},
};
