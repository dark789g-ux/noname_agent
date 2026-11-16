import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczouyi" | "dcyanxi">} */
export const groupSkills = {
	//吉吉国王
	dczouyi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		selectTargetAI(event, player) {
			let cache = _status.event.getTempCache("dczouyi", "results");
			if (Array.isArray(cache)) {
				return cache;
			}
			let allPlayers = game.filterPlayer(current => current != player),
				startNums = allPlayers.map(current => current.countCards("h")),
				num = player.countCards("h");
			let draw = 0,
				discard = 0,
				all = 0;
			allPlayers.forEach((current, index) => {
				let countA = 1,
					countB = 1;
				for (let i = 0; i < startNums.length; i++) {
					let numx = startNums[i];
					if (((i != index || current.countCards("e")) && numx == num + 2) || (i == index && num + 3 == numx)) {
						countA++;
					}
					if ((i != index && numx == num - 1) || (i == index && num - 3 == numx)) {
						countB++;
					}
				}
				allPlayers.forEach((current2, index2) => {
					let nums = startNums.slice(0),
						numx = num + 1,
						countC = 1;
					nums[index] -= 1;
					nums[index2] += 2;
					nums.forEach(value => {
						if (value == numx) {
							countC++;
						}
					});
					if (countC > all) {
						all = countC;
					}
				});
				if (countA > draw) {
					draw = countA;
				}
				if (countB > discard) {
					discard = countB;
				}
			});
			event.putTempCache("dczouyi", "results", [draw, discard, all]);
			return [draw, discard, all];
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog(`###诹议###${get.translation("dczouyi_info")}`, [
					[
						["draw", "你摸两张牌并可弃置一名其他角色一张牌"],
						["discard", "你弃置一张牌并可令一名其他角色摸两张牌"],
					],
					"textbutton",
				]);
			},
			filter(button, player) {
				if (button.link == "discard") {
					return player.countDiscardableCards(player, "he");
				}
				return true;
			},
			check(button) {
				const player = get.player(),
					results = get.info("dczouyi").selectTargetAI(get.event(), player);
				if (results.minBy(i => i) == results[["draw", "discard"].indexOf(button.link)]) {
					return 0;
				}
				return 1;
			},
			select: [1, 2],
			backup(links, player) {
				return {
					audio: "dczouyi",
					links: links,
					async content(event, trigger, player) {
						const { links } = get.info(event.name);
						if (links.includes("draw")) {
							await player.draw(2);
							if (game.hasPlayer(target => target.countDiscardableCards(player, "he") && target != player)) {
								const result = await player
									.chooseTarget(`诹议：弃置一名其他角色一张牌`, (card, player, target) => {
										return target.countDiscardableCards(player, "he") && target != player;
									})
									.set("ai", target => {
										const { player, readyToDiscard: bool } = get.event(),
											num = player.countCards("h") - (bool ? 1 : 0),
											numx = target.countCards("h");
										let eff = get.effect(target, { name: "guohe_copy2" }, player, player);
										if ((numx == num && target.countCards("e")) || numx == num + 1) {
											eff *= 3;
										}
										return eff;
									})
									.set("readyToDiscard", links.includes("discard"))
									.forResult();
								if (result?.targets?.length) {
									const target = result.targets[0];
									player.line(target, "yellow");
									await player.discardPlayerCard(target, "he", true);
								}
							}
						}
						if (links.includes("discard")) {
							await player.chooseToDiscard("he", true);
							const result = await player
								.chooseTarget(`诹议：令一名其他角色摸两张牌`, lib.filter.notMe)
								.set("ai", target => {
									const player = get.player(),
										num = player.countCards("h"),
										numx = target.countCards("h") + 2;
									let eff = get.effect(target, { name: "wuzhong" }, player, player);
									if (num == numx) {
										eff *= 3;
									}
									return eff;
								})
								.forResult();
							if (result?.targets?.length) {
								const target = result.targets[0];
								player.line(target, "green");
								await target.draw(2);
							}
						}
						const num = game.countPlayer(target => target.countCards("h") == player.countCards("h"));
						if (num <= 0) {
							return;
						}
						player.addMark("dcyanxi", num, false);
						if (player.isDamaged()) {
							await player.recover(num);
						}
					},
				};
			},
			prompt(links, player) {
				const map = {
					draw: "你摸两张牌并可弃置一名其他角色一张牌",
					discard: "你弃置一张牌并可令一名其他角色摸两张牌",
				};
				return `###诹议：是否执行下列选项？###${links.map(type => map[type]).join("<br>")}`;
			},
		},
		ai: {
			order(item, player) {
				if (!player) {
					return 1;
				}
				let results = lib.skill.dczouyi.selectTargetAI(get.event(), player);
				return results.maxBy(i => i) * 3;
			},
			result: {
				player: 1,
			},
		},
		subSkill: {
			backup: {},
		},
	},
	dcyanxi: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			const card = get.autoViewAs({ name: "sha", isCard: true, storage: { dcyanxi: true } });
			return event.player != player && player.countMark("dcyanxi") > 0 && player.canUse(card, event.player, false, false);
		},
		logTarget: "player",
		check(event, player) {
			const card = get.autoViewAs({ name: "sha", isCard: true, storage: { dcyanxi: true } });
			return get.effect(event.player, card, player, player) > 0;
		},
		async content(event, trigger, player) {
			const target = trigger.player,
				card = get.autoViewAs({ name: "sha", isCard: true, storage: { dcyanxi: true } });
			let isFirst = true;
			player.addTempSkill("dcyanxi_jueqing");
			while (player.countMark(event.name) > 0 && player.canUse(card, target, false, false) && target.isIn()) {
				if (isFirst) {
					isFirst = false;
				} else {
					player.logSkill(event.name, target);
				}
				player.removeMark(event.name, 1, false);
				await player.useCard(card, target, false);
			}
			player.removeSkill("dcyanxi_jueqing");
		},
		intro: {
			content: "还可以发动#次",
		},
		ai: {
			combo: "dczouyi",
		},
		subSkill: {
			jueqing: {
				trigger: {
					source: "damageBefore",
				},
				charlotte: true,
				filter(event, player) {
					return event.card?.storage?.dcyanxi;
				},
				direct: true,
				async content(event, trigger, player) {
					trigger.cancel();
					trigger.player.loseHp(trigger.num);
				},
				ai: {
					jueqing: true,
				},
			},
		},
	},
};
