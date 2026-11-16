import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbtaozhou" | "dcsbzijin" | "dcsbhoude">} */
export const groupSkills = {
	//诸葛瑾
	dcsbtaozhou: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => {
				if (current.hasSkill("dcsbzijin")) {
					return false;
				}
				return current.countCards("h") > 0 && current !== player;
			});
		},
		derivation: "dcsbzijin",
		chooseButton: {
			dialog() {
				return ui.create.dialog("###讨州###请选择一个数字（对其他角色不可见）");
			},
			chooseControl(event, player) {
				const list = [1, 2, 3];
				list.push("cancel2");
				return list;
			},
			check() {
				const event = get.event(),
					player = get.player();
				if (
					game.hasPlayer(current => {
						return current !== player && get.attitude(player, current) < 0;
					})
				) {
					return [0, 1, 2].randomGet();
				}
				if (player.hasShan()) {
					return 2;
				}
				const rand = event.getRand();
				if (rand < 0.2) {
					return 0;
				}
				if (rand < 0.5) {
					return 1;
				}
				return 2;
			},
			backup(result, player) {
				return {
					audio: "dcsbtaozhou",
					chosenNumber: result.index + 1,
					filterCard: () => false,
					selectCard: -1,
					filterTarget(card, player, target) {
						return target.countCards("h") > 0 && target !== player;
					},
					async content(event, trigger, player) {
						const [target] = event.targets;
						const chosenNumber = get.info("dcsbtaozhou_backup").chosenNumber;
						const { cards } = await target
							.chooseToGive(`${get.translation(player)}对你发动了【讨州】`, "你可以交给其至多三张手牌", [1, 3], player)
							.set("ai", card => {
								if (get.event().att > 0) {
									if (get.event().chosenNumber < ui.selected.cards.length + (get.event().getRand() < 0.5)) {
										return 5.1 - get.value(card);
									}
									return 0;
								}
								if (ui.selected.cards.length > 1) {
									return -get.value(card);
								}
								if (ui.selected.cards.length > 0) {
									return 3.6 - get.value(card);
								}
								return 4.6 - get.value(card);
							})
							.set("att", get.attitude(target, player))
							.set("chosenNumber", chosenNumber)
							.forResult();
						const givenCount = (cards && cards.length) || 0;
						const delta = Math.abs(givenCount - chosenNumber);
						if (givenCount >= chosenNumber) {
							await game.asyncDraw([player, target]);
						} else {
							target.addSkill("dcsbtaozhou_debuff");
							target.addMark("dcsbtaozhou_debuff", delta, false);
						}
						if (delta >= 2) {
							const sha = get.autoViewAs({ name: "sha" });
							if (target.canUse(sha, player, false)) {
								await target.addSkills("dcsbzijin");
							}
						}
						const roundNumberToRestore = game.roundNumber + chosenNumber;
						player.tempBanSkill("dcsbtaozhou", "forever");
						player
							.when({ global: "roundStart" }, false)
							.filter(() => {
								return game.roundNumber >= roundNumberToRestore;
							})
							.assign({
								firstDo: true,
							})
							.step(async () => {
								delete player.storage[`temp_ban_dcsbtaozhou`];
							})
							.finish();
					},
					ai: {
						result: {
							player: 0.5,
							target() {
								const chosenNumber = get.info("dcsbtaozhou_backup").chosenNumber;
								if (chosenNumber > 1) {
									return -1;
								}
								return 0;
							},
						},
					},
				};
			},
			prompt: () => "请选择【讨州】的目标",
		},
		subSkill: {
			backup: {},
			debuff: {
				trigger: { player: "damageBegin3" },
				forced: true,
				charlotte: true,
				async content(event, trigger, player) {
					trigger.num++;
					player.removeMark("dcsbtaozhou_debuff", 1, false);
					if (!player.countMark("dcsbtaozhou_debuff")) {
						player.removeSkill("dcsbtaozhou_debuff");
					}
				},
				intro: {
					content: "下&次受到伤害时，伤害+1",
				},
			},
		},
		ai: {
			order: 9.6,
			result: {
				player: 1,
			},
		},
	},
	dcsbzijin: {
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			return !game.hasPlayer2(current => {
				return current.hasHistory("damage", evt => evt.card === event.card);
			}, true);
		},
		forced: true,
		async content(event, trigger, player) {
			const { bool } = await player
				.chooseToDiscard("自矜：弃置一张牌或失去1点体力", "he")
				.set("ai", card => {
					const player = get.player();
					if (get.effect(player, { name: "losehp" }, player, player) > 0) {
						return 0;
					}
					return 5 - get.value(card);
				})
				.forResult();
			if (!bool) {
				await player.loseHp();
			}
		},
		ai: {
			effect: {
				player_use(card, player) {
					if (get.effect(player, { name: "losehp" }, player) > 0) {
						return;
					}
					if (!get.tag(card, "damage") && get.value(card) < 5) {
						return [
							0.2,
							player.hasCard(card => {
								return get.value(card) < 3;
							}, "he")
								? -0.1
								: -2,
						];
					}
				},
			},
			neg: true,
		},
	},
	dcsbhoude: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			const target = event.player;
			const phaseUse = event.getParent("phaseUse");
			if (player == target || !phaseUse || phaseUse.name !== "phaseUse" || phaseUse.player !== target) {
				return false;
			}
			const filterx = evt => get.name(evt.card) === "sha" && get.color(evt.card) === "red";
			const filtery = evt => get.type(evt.card) === "trick" && get.color(evt.card) === "black";
			if (filterx(event) && !player.hasCards("he")) {
				return false;
			}
			if (filtery(event) && !target.hasDiscardableCards(player, "he")) {
				return false;
			}
			const evt = event.getParent();
			const history = game.getGlobalHistory(
				"useCard",
				evtx => {
					const evtxx = evtx.getParent("phaseUse");
					if (player == evtx.player || evtxx !== phaseUse) {
						return false;
					}
					if (!evtx.targets?.includes(player)) {
						return false;
					}
					if (filterx(event)) {
						return filterx(evtx);
					}
					if (filtery(event)) {
						return filtery(evtx);
					}
					return false;
				},
				evt
			);
			return history.indexOf(evt) == 0;
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			let result;
			if (get.name(trigger.card) === "sha") {
				result = await player
					.chooseToDiscard(get.prompt(event.skill, target), `弃置一张牌，令${get.translation(trigger.card)}对你无效。`, "chooseonly", "he")
					.set("ai", card => {
						if (!get.event().goon) {
							return 0;
						}
						return 5.5 - get.value(card);
					})
					.set("goon", get.effect(player, trigger.card, target, player) < 0)
					.forResult();
			} else {
				result = await player
					.discardPlayerCard(`###${get.prompt(event.skill, target)}###<div class="text center">弃置其的一张牌，令${get.translation(trigger.card)}对你无效。</div>`, target, "he")
					.set("chooseonly", true)
					.set("ai", button => {
						if (!get.event().goon) {
							return 0;
						}
						const val = get.buttonValue(button);
						if (get.attitude(get.player(), get.owner(button.link)) > 0) {
							return -val;
						}
						return val;
					})
					.set("goon", get.effect(player, trigger.card, target, player) < 0)
					.forResult();
			}
			if (result?.bool) {
				event.result = {
					bool: true,
					cost_data: {
						cards: result.cards,
						links: result.links,
					},
				};
			}
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player;
			const result = event.cost_data;
			if (result.links?.length) {
				await target.modedDiscard(result.links, player);
			} else {
				await player.discard(result.cards);
			}
			trigger.excluded.add(player);
		},
	},
};
