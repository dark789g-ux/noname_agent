import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mbquanchong" | "mbrenxing" | "pothaoshi" | "potdimeng">} */
export const groupSkills = {
	//陈祇
	mbquanchong: {
		audio: 4,
		logAudio: index => (typeof index == "number" ? `mbquanchong${index}.mp3` : 2),
		trigger: {
			player: "phaseJieshuBegin",
		},
		forced: true,
		round: 1,
		filter(event, player) {
			return player.countDiscardableCards(player, "he");
		},
		async content(event, trigger, player) {
			if (player.countDiscardableCards(player, "he")) {
				await player.modedDiscard(player.getCards("he"));
				player.insertPhase();
				if (!player.isMaxHp(true)) {
					player
						.when({ player: "phaseBegin" }, false)
						.assign({ firstDo: true })
						.filter(evt => evt.skill == event.name)
						.step(async (event, trigger, player) => {
							player.logSkill("mbquanchong", null, null, null, [get.rand(3, 4)]);
							await player.loseHp();
						})
						.finish();
				}
			}
		},
	},
	mbrenxing: {
		audio: 2,
		trigger: { global: ["loseAfter", "loseAsyncAfter"] },
		filter(event, player) {
			if (game.players.every(target => !event.getl(target)?.cards?.length) || event.getParent("phaseDiscard", true)) {
				return false;
			}
			if (player.countMark("mbrenxing_used") >= 2) {
				return false;
			}
			return (
				game
					.getGlobalHistory("everything", evt => {
						if (!["lose", "loseAsync"].includes(evt.name) || evt.type != "discard" || evt.getParent("phaseDiscard", true)) {
							return false;
						}
						return game.players.some(target => evt.getl(target)?.cards?.length);
					})
					.indexOf(event) == 0 &&
				(_status.currentPhase?.isIn() ||
					game.hasPlayer(current => {
						return ["useCard", "respond"].every(key => !current.getHistory(key, evt => evt.card?.name == "sha").length) && current.countDiscardableCards(player, "he");
					}))
			);
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButtonTarget({
					createDialog: [
						"任行：你可选择一项",
						[
							[
								["draw", "你与当前回合角色各摸一张牌"],
								["discard", "弃置一名本回合未使用或打出过【杀】的角色一张牌"],
							],
							"textbutton",
						],
					],
					noShas: (() => {
						return game.filterPlayer(current => {
							return ["useCard", "respond"].every(key => !current.getHistory(key, evt => evt.card?.name == "sha").length) && current.countDiscardableCards(player, "he");
						});
					})(),
					filterButton(button) {
						if (button.link == "discard") {
							return get.event().noShas?.length;
						}
						return _status.currentPhase?.isIn();
					},
					selectTarget() {
						const link = ui.selected.buttons?.[0]?.link;
						return link == "discard" ? 1 : -1;
					},
					filterTarget(card, player, target) {
						const link = ui.selected.buttons?.[0]?.link;
						if (link == "discard") {
							return get.event().noShas?.includes(target);
						}
						return target == _status.currentPhase || target == player;
					},
					ai1(button) {
						const player = get.player();
						const target = _status.currentPhase;
						if (button.link === "draw" && target?.isIn()) {
							return get.effect(target, { name: "draw" }, target, player) + get.effect(player, { name: "draw" }, player, player);
						} else {
							return Math.max(...game.filterPlayer().map(current => get.effect(current, { name: "guohe_copy2" }, player, player)));
						}
					},
					ai2(target) {
						const player = get.player();
						return get.effect(target, { name: "guohe_copy2" }, player, player);
					},
				})
				.forResult();
			event.result = {
				bool: result?.bool,
				targets: result?.targets,
				cost_data: result?.links,
			};
		},
		async content(event, trigger, player) {
			const { targets, cost_data: choice } = event,
				name = "mbrenxing_used";
			player.addTempSkill(name, "roundStart");
			player.addMark(name, 1, false);
			if (choice.includes("draw")) {
				if (player == _status.currentPhase) {
					targets.push(player);
				}
				await game.asyncDraw(targets);
			} else {
				await player.discardPlayerCard(event.targets[0], "he", true);
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	//势鲁肃
	pothaoshi: {
		audio: 3,
		logAudio: () => 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target != player); //target.hp <= player.hp &&
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target != player; //target.hp <= player.hp &&
				})
				.set("ai", target => {
					return get.attitude(get.player(), target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0],
				skill = event.name + "_clear";
			target.markAuto(event.name + "_use", player);
			target.addAdditionalSkill(`${event.name}_use_${player.playerid}`, event.name + "_use");
			player.addTempSkill(skill, { player: "phaseBegin" });
			player.storage[skill].set(target, 2);
			player.addTip(
				skill,
				[...player.storage[skill].entries()]
					.map(([target, num]) => {
						return `${get.translation(skill)}${get.translation(target)} ${num}`;
					})
					.join("<br>")
			);
			player.addTempSkill(event.name + "_change", { player: "phaseBegin" });
		},
		group: ["pothaoshi_draw"],
		subSkill: {
			tag: {},
			draw: {
				audio: "pothaoshi",
				logAudio: () => "pothaoshi3.mp3",
				trigger: { player: "loseAfter" },
				forced: true,
				locked: false,
				filter(event, player) {
					const storage = player.storage["pothaoshi_clear"],
						target = event.getParent().pothaoshi;
					return event.getl(player)?.hs?.length && !player.countCards("h") && storage?.has(target) && storage.get(target) > 0;
				},
				async content(event, trigger, player) {
					const skill = "pothaoshi_clear";
					player.storage[skill].set(trigger.getParent().pothaoshi, player.storage[skill].get(trigger.getParent().pothaoshi) - 1);
					player.addTip(
						skill,
						[...player.storage[skill].entries()]
							.map(([target, num]) => {
								return `${get.translation(skill)}${get.translation(target)} ${num}`;
							})
							.join("<br>")
					);
					await player.drawTo(3);
				},
			},
			clear: {
				charlotte: true,
				init(player, skill) {
					player.storage[skill] = new Map([]);
				},
				onremove(player, skill) {
					[...player.storage[skill].entries()].forEach(([target, num]) => {
						target.unmarkAuto("pothaoshi_use", [player]);
						lib.skill.pothaoshi_use.init(target, "pothaoshi_use");
						target.removeAdditionalSkill(`pothaoshi_use_${player.playerid}`);
					});
					player.removeTip(skill);
					delete player.storage[skill];
				},
			},
			change: {
				trigger: {
					global: ["loseEnd", "loseAsyncEnd", "gainEnd", "addToExpansionEnd", "equipEnd", "addJudgeEnd"],
				},
				silent: true,
				charlrotte: true,
				filter(event, player) {
					return event.getg?.(player)?.length || event.getl?.(player)?.hs?.length;
				},
				forceDie: true,
				async content(event, trigger, player) {
					const toAdd = trigger.getg?.(player) || [],
						toRemove = trigger.getl?.(player)?.hs || [];
					event.set("toAdd", toAdd);
					event.set("toRemove", toRemove);
					await event.trigger("pothaoshiChange");
				},
			},
			use: {
				init(player, skill) {
					const toRemove = player.getCards("s", card => card.hasGaintag("pothaoshi_tag"));
					game.deleteFakeCards(toRemove);
					const cards = player.getStorage(skill).reduce((cards, target) => {
						const fake = target.isAlive() && target.countCards("h") ? game.createFakeCards(target.getCards("h")) : [];
						return cards.addArray(fake);
					}, []);
					player.directgains(cards, null, "pothaoshi_tag");
				},
				onremove(player, skill) {
					const toRemove = player.getCards("s", card => card.hasGaintag("pothaoshi_tag"));
					game.deleteFakeCards(toRemove);
				},
				mark: true,
				intro: {
					content: "你可以如手牌般使用或打出<span class=thundertext>$</span>的手牌",
				},
				forced: true,
				popup: false,
				delay: false,
				charlotte: true,
				trigger: {
					player: ["useCardBefore", "respondBefore"],
					global: ["pothaoshiChange"],
				},
				filter(event, player) {
					if (["useCard", "respond"].includes(event.name)) {
						const cards = player.getCards("s", card => card.hasGaintag("pothaoshi_tag"));
						return event.cards && event.cards.some(card => cards.includes(card));
					}
					return player.getStorage("pothaoshi_use").includes(event.player);
				},
				async content(event, trigger, player) {
					const tag = "pothaoshi_tag";
					if (["useCard", "respond"].includes(trigger.name)) {
						trigger.set("pothaoshi", player);
						const real = player.getStorage(event.name).reduce((cards, target) => {
							const hs = target.isAlive() && target.countCards("h") ? target.getCards("h") : [];
							return cards.addArray(hs);
						}, []);
						for (let i = 0; i < trigger.cards.length; i++) {
							const card = trigger.cards[i];
							const cardx = real.find(cardx => cardx.cardid == card._cardid);
							if (cardx) {
								trigger.cards[i] = cardx;
								trigger.card.cards[i] = cardx;
							}
						}
					} else {
						game.deleteFakeCards(player.getCards("s", card => trigger.toRemove.find(cardx => cardx.cardid == card._cardid)));
						player.directgains(game.createFakeCards(trigger.toAdd), null, tag);
					}
				},
			},
		},
	},
	potdimeng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.countPlayer() > 1;
		},
		filterTarget(card, player, target) {
			const selected = ui.selected.targets;
			if (!selected.length) {
				return true;
			}
			return Math.abs(target.countCards("h") - selected[0].countCards("h")) <= 3;
		},
		complexTarget: true,
		selectTarget: 2,
		multiline: true,
		multitarget: true,
		async content(event, trigger, player) {
			const { targets } = event,
				num = player.getDamagedHp();
			await targets[0].swapHandcards(targets[1]);
			if (num == 0) {
				return;
			}
			const discard = Math.min(num, player.countDiscardableCards(player, "he")),
				count = targets[0].countCards("h") - targets[1].countCards("h");
			if (discard == 0 && count == 0) {
				return;
			}
			if (count == 0) {
				await player.chooseToDiscard(`缔盟：是否弃置${get.cnNumber(discard)}张牌？`, discard, "he");
				return;
			}
			const target = targets.sort((a, b) => a.countCards("h") - b.countCards("h"))[0];
			if (discard == 0) {
				const result = await player
					.chooseBool(`缔盟：是否令${get.translation(target)}摸${get.cnNumber(num)}张牌？`)
					.set("choice", get.effect(target, { name: "draw" }, player, player) > 0)
					.forResult();
				if (result?.bool) {
					await target.draw(num);
				}
				return;
			}
			const result = await player
				.chooseToDiscard(`缔盟：弃置${get.cnNumber(discard)}张牌或令${get.translation(target)}摸${get.cnNumber(num)}张牌`, discard, "he")
				.set("targetx", target)
				.set("ai", card => {
					const player = get.player(),
						target = get.event().targetx,
						eff = get.effect(target, { name: "wuzhong" }, player, player);
					if (eff > 0) {
						return 0;
					}
					return 6.5 - get.value(card);
				})
				.forResult();
			if (!result?.cards?.length) {
				await target.draw(num);
			}
		},
		ai: {
			order: 6,
			threaten: 3,
			expose: 0.9,
			result: {
				target(player, target) {
					const list = [];
					const num = player.getDamagedHp();
					const players = game.filterPlayer();
					if (ui.selected.targets.length == 0) {
						for (let i = 0; i < players.length; i++) {
							if (players[i] != player && get.attitude(player, players[i]) > 3) {
								list.push(players[i]);
							}
						}
						list.sort(function (a, b) {
							return a.countCards("h") - b.countCards("h");
						});
						if (target == list[0]) {
							return get.attitude(player, target);
						}
						return -get.attitude(player, target);
					} else {
						const from = ui.selected.targets[0];
						for (let i = 0; i < players.length; i++) {
							if (players[i] != player && get.attitude(player, players[i]) < 1) {
								list.push(players[i]);
							}
						}
						list.sort(function (a, b) {
							return b.countCards("h") - a.countCards("h");
						});
						if (from.countCards("h") >= list[0].countCards("h")) {
							return -get.attitude(player, target);
						}
						for (let i = 0; i < list.length && from.countCards("h") < list[i].countCards("h"); i++) {
							if (list[i].countCards("h") - from.countCards("h") <= num) {
								const count = list[i].countCards("h") - from.countCards("h");
								if (count < 2 && from.countCards("h") >= 2) {
									return -get.attitude(player, target);
								}
								if (target == list[i]) {
									return get.attitude(player, target);
								}
								return -get.attitude(player, target);
							}
						}
					}
				},
			},
		},
	},
};
