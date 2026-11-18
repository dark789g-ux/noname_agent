import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "potchiyun" | "potyanhui" | "potfentao">} */
export const groupSkills = {
	//potential--潜在, 潜力, 可能, 电位, 潜能, 势
	//势周瑜------by 清风
	potchiyun: {
		audio: 2,
		audioname2: {
			pot_zhouyu_shadow: "potchiyun_pot_zhouyu_shadow",
		},
		logAudio2: {
			pot_zhouyu_shadow: (event, player) => "potchiyun_pot_zhouyu_shadow" + (player.storage.potchiyun1 ? get.rand(3, 4) : get.rand(1, 2)) + ".mp3",
		},
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			if ((player.storage.potchiyun1 || player.storage.potchiyun2) && player != _status.currentPhase) {
				return false;
			}
			return (
				event.getg?.(player)?.length &&
				lib.phaseName.some(phase => {
					return (
						player
							.getHistory("gain", evt => evt.getParent(phase) === event.getParent(phase))
							.map(evt => (event.name == "gain" ? evt : evt.getParent()))
							.indexOf(event) === 0
					);
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt(event.skill),
					prompt2: "炽沄：交给一名其他角色任意张手牌",
					filterCard: true,
					selectCard: [1, Infinity],
					filterTarget: lib.filter.notMe,
					position: "h",
					complexCard: true,
					ai1(card) {
						if (ui.selected.cards?.length) {
							return 0;
						}
						return 8 - get.value(card);
					},
					ai2(target) {
						const player = get.player();
						if (player.storage.potchiyun1) {
							return get.attitude(player, target);
						} else {
							return -get.attitude(player, target);
						}
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
			} = event;
			const colors = cards.map(card => get.color(card)).unique();
			await player.give(cards, target);
			const list = [],
				choiceList = ["展示所有" + get.translation(colors) + "手牌并受到来自" + get.translation(player) + "的一点火焰伤害", "令" + get.translation(player) + "摸两张牌，然后你进入连环状态"];
			if (target.hasCards("h", card => colors.includes(get.color(card))) && !player.storage[event.name + "1"]) {
				list.push("选项一");
			} else {
				choiceList[0] = `<span style="opacity:0.5">` + choiceList[0] + "</span>";
			}
			if (!player.storage[event.name + "2"]) {
				list.push("选项二");
			} else {
				choiceList[1] = `<span style="opacity:0.5">` + choiceList[1] + "</span>";
			}
			if (!list.length) {
				return;
			}
			const result =
				list.length > 1
					? await target
							.chooseControl(list)
							.set("choiceList", choiceList)
							.set("prompt", "请选择一项")
							.set("ai", () => get.event().controls.randomGet())
							.forResult()
					: { control: list[0] };
			if (typeof result?.control == "string") {
				if (result.control == "选项一") {
					await target.showCards(
						target.getCards("h", card => colors.includes(get.color(card))),
						`${get.translation(player)}发动了【${get.translation(event.name)}】`
					);
					await target.damage("fire");
				} else {
					target.line(player);
					await player.draw({ num: 2 });
					await target.link(true);
				}
			}
		},
		subSkill: {
			pot_zhouyu_shadow: { audio: 4 },
		},
	},
	potyanhui: {
		audio: 6,
		audioname: ["pot_zhouyu_shadow"],
		logAudio: (player, indexedData) => "potyanhui" + (lib.skill.potyanhui.audioname.includes(player.skin.name) ? "_pot_zhouyu_shadow" : "") + (indexedData ? indexedData : get.rand(1, 2)) + ".mp3",
		popup: false,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if ((player.storage.potyanhui1 || player.storage.potyanhui2) && player != _status.currentPhase) {
				return false;
			}
			return event.targets?.some(target => target.hasCards("h")) && event.isFirstTarget;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill),
					prompt2: "焰洄：展示一名目标角色的一张手牌",
					filterTarget(card, player, target) {
						return get.event().targets?.includes(target);
					},
					ai(target) {
						return -get.attitude(get.player(), target);
					},
				})
				.set("targets", trigger.targets)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (!target.hasCards("h")) {
				return;
			}
			player.logSkill(event.name, [target], null, null, [player]);
			const result = await player
				.choosePlayerCard({
					forced: true,
					position: "h",
					prompt: `展示${get.translation(target)}的一张手牌`,
					target,
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				const cards = result.links;
				const shown = game
					.getGlobalHistory("everything", evt => {
						return evt.name == "showCards" && evt.cards?.length > 0;
					})
					.map(evt => evt.cards)
					.flat();
				await target.showCards(cards, `${get.translation(player)}发动了【${get.translation(event.name)}】`);
				if (shown.includes(cards[0])) {
					await target.modedDiscard({ cards, discarder: player });
				}
			}
			if (!player.hasSkill(event.name + "_used")) {
				player.addTempSkill("potyanhui_used", "phaseAnyAfter");
				player.when({ global: "phaseAnyEnd" }).step(async (event, trigger, player) => {
					const bool1 =
							game.hasPlayer(current => {
								return current.hasHistory("lose", evt => evt.type == "discard" && evt.getParent(2).name == "potyanhui" && evt.getParent(trigger.name) == event.getParent(trigger.name));
							}) && !player.storage.potyanhui1,
						bool2 =
							game.hasPlayer2(current => {
								return game.hasGlobalHistory("everything", evt => {
									return evt.name == "showCards" && evt.cards?.length > 0 && evt.player == current;
								});
							}) && !player.storage.potyanhui2;
					if (!bool1 && !bool2) {
						return;
					}
					const num = game.countPlayer2(current => {
						return game.hasGlobalHistory("everything", evt => {
							return evt.name == "showCards" && evt.cards?.length > 0 && evt.player == current;
						});
					});
					const targets = game.filterPlayer(current => {
						return current.hasHistory("lose", evt => evt.type == "discard" && evt.getParent(2).name == "potyanhui" && evt.getParent(trigger.name) == event.getParent(trigger.name));
					});
					const result = await player
						.chooseButtonTarget({
							createDialog: [
								"焰洄：请选择一项",
								[
									[
										["damage", "对一名本阶段因此弃置过牌的角色造成1点火焰伤害（" + get.translation(targets) + ")"],
										["draw", "摸" + num + "张牌"],
									],
									"textbutton",
								],
							],
							complexSelect: true,
							forced: true,
							filterButton(button) {
								if (button.link == "damage") {
									return get.event().targets?.length && !player.storage.potyanhui1;
								}
								return get.event().num && !player.storage.potyanhui2;
							},
							filterTarget(card, player, target) {
								return get.event().targets?.includes(target);
							},
							selectTarget() {
								if (ui.selected.buttons?.[0]?.link == "damage") {
									return 1;
								}
								return -1;
							},
							ai1(button) {
								const player = get.player();
								if (button.link == "draw") {
									if (player.isPhaseUsing()) {
										return 0;
									}
									return get.event().num * get.effect(player, { name: "draw" }, player, player);
								}
								return Math.max(
									...game.filterPlayer().map(current => {
										return get.damageEffect(current, player, player, "fire");
									})
								);
							},
							ai2(target) {
								const player = get.player();
								return get.damageEffect(target, player, player, "fire");
							},
						})
						.set("num", num)
						.set("targets", targets)
						.forResult();
					if (result?.bool && result.links?.length) {
						const {
							links: [link],
							targets: [target],
						} = result;
						if (link == "damage") {
							if (target?.isIn()) {
								player.line(target);
								player.logSkill("potyanhui", [target], null, null, [player, get.rand(5, 6)]);
								await target.damage("fire");
							}
						} else {
							player.logSkill("potyanhui", null, null, null, [player, get.rand(3, 4)]);
							await player.draw({ num });
						}
					}
				});
			}
		},
		init(player, skill) {
			player.addSkill(skill + "_mark");
			game.countPlayer(current => {
				const cards = current.getCards("h", card => {
					const shown = game
						.getGlobalHistory("everything", evt => {
							return evt.name == "showCards" && evt.cards?.length > 0;
						})
						.map(evt => evt.cards)
						.flat();
					return shown.includes(card);
				});
				if (cards.length) {
					current.addGaintag(cards, skill);
				}
			});
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
			game.countPlayer(current => current.removeGaintag(skill));
		},
		subSkill: {
			used: { charlotte: true },
			mark: {
				popup: false,
				forced: true,
				silent: true,
				charlotte: true,
				trigger: {
					global: ["showCardsAfter", "gainAfter", "loseAsyncAfter", "phaseAfter"],
				},
				filter(event, player) {
					return player == _status.currentPhase || (!player.storage.potyanhui1 && !player.storage.potyanhui2);
				},
				getIndex(event, player) {
					if (event.name == "phase") {
						return game.filterPlayer();
					}
					if (event.name == "showCards") {
						return [event.player];
					}
					return game.filterPlayer(current => {
						if (!event.getg?.(current)?.length) {
							return false;
						}
						return current.hasCards("h", card => {
							const shown = game
								.getGlobalHistory("everything", evt => {
									return evt.name == "showCards" && evt.cards?.length > 0;
								})
								.map(evt => evt.cards)
								.flat();
							return shown.includes(card);
						});
					});
				},
				async content(event, trigger, player) {
					const target = event.indexedData;
					if (trigger.name == "phase") {
						target.removeGaintag("potyanhui");
					} else if (trigger.name == "showCards") {
						const cards = trigger.cards;
						game.broadcastAll(cards => {
							cards.forEach(card => card.addGaintag("potyanhui"));
						}, cards);
					} else {
						const cards = target.getCards("h", card => {
							const shown = game
								.getGlobalHistory("everything", evt => {
									return evt.name == "showCards" && evt.cards?.length > 0;
								})
								.map(evt => evt.cards)
								.flat();
							return shown.includes(card);
						});
						if (cards.length) {
							target.addGaintag(cards, "potyanhui");
						}
					}
				},
			},
		},
	},
	potfentao: {
		audio: 2,
		forced: true,
		audioname2: {
			pot_zhouyu_shadow: "potfentao_pot_zhouyu_shadow",
		},
		logAudio2: {
			pot_zhouyu_shadow: (event, player) => "potfentao_pot_zhouyu_shadow" + (player.storage.potfentao2 ? get.rand(3, 4) : get.rand(1, 2)) + ".mp3",
		},
		trigger: { global: "damageBegin4" },
		filter(event, player) {
			if ((player.storage.potfentao1 || player.storage.potfentao2) && player != _status.currentPhase) {
				return false;
			}
			return event.hasNature("fire") && event.player.isLinked() && player != event.player;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = event.targets[0],
				bool1 = player.storage[event.name + "1"],
				bool2 = player.storage[event.name + "2"];
			if (bool1 && bool2) {
				return;
			}
			if (target?.isIn()) {
				let result;
				if (bool2) {
					result = { bool: false };
				} else {
					const forced = bool1 ? true : false;
					if (bool1 && !target.hasDiscardableCards(target, "he")) {
						return;
					}
					result = target.hasDiscardableCards(target, "he")
						? await target
								.chooseToDiscard({
									forced,
									prompt: `${get.translation(player)}对你发动了焚涛：请选择弃置一半牌` + (bool1 ? "" : "或点击“取消”令本次传导伤害+1"),
									position: "he",
									selectCard: Math.ceil(target.countCards("he") / 2),
									ai(card) {
										const { player, num } = get.event();
										if (num + 1 >= player.getHp() + player.hujia) {
											return 114514 - get.value(card);
										}
										return 7 - get.value(card);
									},
								})
								.set("num", trigger.num)
								.forResult()
						: { bool: false };
				}
				if (!result?.bool || !result.cards?.length) {
					//购卡的新巧思-2-3-4-5-6
					if (trigger.notLink()) {
						trigger.num++;
						player.removeSkill(event.name + "_dam");
					} else {
						player.addTempSkill(event.name + "_dam");
						player.addMark(event.name + "_dam", 1, false);
						trigger.num += player.countMark(event.name + "_dam");
					}
				} else {
					target
						.when({ player: "damageAfter" })
						.filter(evt => evt === trigger)
						.step(async (event, trigger, player2) => {
							player.logSkill("potfentao", target, null, null, [event, player]);
							await player2.link(true);
						});
				}
			}
		},
		subSkill: {
			dam: { charlotte: true, onremove: true },
			pot_zhouyu_shadow: { audio: 4 },
		},
	},
};
