import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbhengye" | "dcsbyingbo">} */
export const groupSkills = {
	//新杀谋吕蒙
	dcsbhengye: {
		audio: 2,
		trigger: {
			source: ["damageSource", "dieAfter"],
			player: ["phaseDrawBegin2"],
			global: "phaseBegin",
		},
		init(player, skill) {
			player.setStorage(skill, [0, 0, 0, 0]);
			player.addTip(skill, `${get.translation(skill)} ${player.getStorage(skill).join(" ")}`);
		},
		onremove(player, skill) {
			player.setStorage(skill, [0, 0, 0, 0]);
			player.removeTip(skill);
		},
		forced: true,
		filter(event, player) {
			if (event.name == "die") {
				return true;
			}
			const list = player.getStorage("dcsbhengye", [0, 0, 0, 0]);
			if (event.name == "phase") {
				return event.player == player && list.some(num => num >= 3);
			}
			if (event.name == "phaseDraw") {
				return !event.numFixed && list[0] > 0;
			}
			/*if (!event.hasNature()) {
				return false;
			}*/
			return list.some(num => num < 3);
		},
		async content(event, trigger, player) {
			const skill = event.name;
			if (trigger.name == "die") {
				get.info(skill).init(player, skill);
				return;
			}
			if (trigger.name == "phase") {
				await player.recover();
				return;
			}
			const list = player.getStorage(skill, [0, 0, 0, 0]);
			if (trigger.name == "phaseDraw") {
				trigger.num += list[0];
				return;
			}
			/*const result = await player
				.chooseButton(
					[
						"横野：令一项数值+1（至多+3）",
						[
							[0, "摸牌阶段摸牌数"],
							[1, "出牌阶段出杀次数"],
							[2, "手牌上限"],
							[3, "攻击范围"],
						].map(i => [[i], "tdnodes"]),
						[
							dialog => {
								dialog.buttons.forEach(i => {
									i.style.setProperty("width", "200px", "important");
									i.style.setProperty("text-align", "center", "important");
								});
							},
							"handle",
						],
					],
					true
				)
				.set("filterButton", button => {
					const { link } = button,
						{ player, numList } = get.event();
					return numList[link] < 3;
				})
				.set("numList", list)
				.set("ai", button => {
					const { link } = button,
						{ player, numList } = get.event();
					if (link == 1) {
						if (
							player.countCards("hs", card => {
								if (get.name(card) != "sha") {
									return false;
								}
								return player.hasValueTarget(card, null, false) && !player.hasValueTarget(card);
							})
						) {
							return 3;
						}
						return 0;
					}
					return 3.1 - link;
				})
				.forResult();
			if (result?.bool) {
				for (let i = 0; i < list.length; i++) {
					if (result.links?.length && !result.links.includes(i)) {
						continue;
					}
					list[i] = Math.min(3, list[i] + 1);
				}
				player.setStorage(skill, list);
				player.addTip(skill, `${get.translation(skill)} ${player.getStorage(skill).join(" ")}`);
			}*/
			player.setStorage(
				skill,
				list.map(i => i + 1)
			);
			player.addTip(skill, `${get.translation(skill)} ${player.getStorage(skill).join(" ")}`);
		},
		mod: {
			maxHandcard(player, num) {
				const list = player.getStorage("dcsbhengye", [0, 0, 0, 0]);
				return num + list[2];
			},
			attackRange(player, num) {
				const list = player.getStorage("dcsbhengye", [0, 0, 0, 0]);
				return num + list[3];
			},
			cardUsable(card, player, num) {
				if (card.name != "sha") {
					return;
				}
				const list = player.getStorage("dcsbhengye", [0, 0, 0, 0]);
				return num + list[1];
			},
		},
	},
	dcsbyingbo: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			return get.is.damageCard(event.card);
		},
		forced: true,
		async content(event, trigger, player) {
			if (
				game.getRoundHistory(
					"useCard",
					evt => {
						return evt.card.name == trigger.card.name && evt != trigger;
					},
					trigger,
					0
				).length
			) {
				const skill = "dcsbyingbo_fire";
				player.markAuto(skill, trigger.card);
				player.addTempSkill(skill);
			} else {
				trigger.directHit.addArray(game.players);
				player
					.when("useCardAfter")
					.filter(evt => evt == trigger)
					.step(async (event, trigger, player) => {
						if (!game.hasPlayer(current => current != player)) {
							return;
						}
						const cards = trigger.cards?.filterInD();
						if (!cards?.length) {
							return;
						}
						const result = await player
							.chooseTarget(`英博：是否将${get.translation(cards)}交给一名其他角色？`, lib.filter.notMe)
							.set("ai", target => {
								const { player, cardx } = get.event();
								return cardx.reduce((sum, card) => {
									return sum + get.value(card, target) * get.attitude(player, target);
								}, 0);
							})
							.set("cardx", cards)
							.forResult();
						if (result?.bool && result.targets?.length) {
							const target = result.targets[0];
							player.logSkill("dcsbyingbo", target);
							await target.gain(cards, "gain2");
						}
					});
			}
		},
		subSkill: {
			fire: {
				charlotte: true,
				onremove: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					if (!event.card || !event.notLink()) {
						return false;
					}
					return player.getStorage("dcsbyingbo_fire").includes(event.card);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					game.setNature(trigger, "fire");
					trigger.num++;
				},
			},
		},
	},
};
