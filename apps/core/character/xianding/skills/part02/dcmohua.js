import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcmohua" | "dcduoyue" | "dcjunhe">} */
export const groupSkills = {
	dcmohua: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			if (_status.currentPhase == player) {
				return false;
			}
			const history = event.player.getHistory("useCard", evt => evt.isPhaseUsing(event.player) && get.type(evt.card) !== "equip");
			return history.length && player.hasUsableCard(history[0].card.name);
		},
		check(event, player) {
			const history = event.player.getHistory("useCard", evt => evt.isPhaseUsing(event.player) && get.type(evt.card) !== "equip");
			const { name } = history[0].card;
			const card = { name, storage: { dcmohua: history[0] } };
			return event.player.hasValueTarget(new lib.element.VCard(card), true, true);
		},
		round: 1,
		logTarget: "player",
		async content(event, trigger, player) {
			player.addTempSkill("dcmohua_effect");
			player.setStorage("dcmohua_effect", trigger.player);
			const history = trigger.player.getHistory("useCard", evt => evt.isPhaseUsing(trigger.player) && get.type(evt.card) !== "equip");
			for (const evt of history) {
				const { name } = evt.card;
				const card = (event.card = { name, storage: { dcmohua: evt } });
				const next = player.chooseToUse(function (card, player, target) {
					const { cardx } = get.event();
					if (!cardx || get.name(card) !== cardx.name) {
						return false;
					}
					return lib.filter.filterCard.apply(this, arguments);
				});
				next.set("dcmohua", true);
				next.set("manualConfirm", true);
				next.set("openskilldialog", `${get.translation(event.name)}：请选择【${get.translation(card.name)}】的目标`);
				next.set("cardx", card);
				const result = await next.forResult();
				if (!result?.bool) {
					break;
				}
			}
			player.removeSkill("dcmohua_effect");
		},
		onChooseToUse(event) {
			const evt = event.getParent();
			if (evt.name === "dcmohua" && evt.player === event.player) {
				const evt2 = evt.card.storage.dcmohua;
				if (Array.isArray(evt2.targets)) {
					event.targetprompt2.add(target => {
						if (target.isIn() && evt2.targets.includes(target)) {
							return "原目标";
						}
					});
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				priority: Infinity,
				trigger: { player: "useCardBefore" },
				direct: true,
				filter(event, player) {
					const target = player.getStorage("dcmohua_effect");
					return get.itemtype(target) == "player" && target?.isIn();
				},
				logTarget: (event, player) => player.getStorage("dcmohua_effect"),
				async content(event, trigger, player) {
					trigger.player = player.getStorage("dcmohua_effect");
					trigger.noai = true;
					await game.delay(0.5);
				},
				mod: {
					selectTarget(card, player, range) {
						const source = player.getStorage("dcmohua_effect");
						if (!source.isIn() || get.itemtype(source) != "player") {
							return;
						}
						const evt = get.event().getParent("chooseToUse", true, true);
						if (!evt?.dcmohua) {
							return;
						}
						let info = get.info(card);
						let select = get.copy(info.selectTarget);
						if (select == undefined) {
							if (info.filterTarget == undefined) {
								return [0, 0];
							}
							range = [1, 1];
						} else if (typeof select == "number") {
							range = [select, select];
						} else if (get.itemtype(select) == "select") {
							range = select;
						} else if (typeof select == "function") {
							range = select(card, source);
							if (typeof range == "number") {
								range = [range, range];
							}
						}
						game.checkMod(card, source, range, "selectTarget", source);
					},
					cardEnabled2(card, player, event) {
						const source = player.getStorage("dcmohua_effect");
						if (!source.isIn() || get.itemtype(source) != "player") {
							return;
						}
						const evt = get.event().getParent("chooseToUse", true, true);
						if (!evt?.dcmohua) {
							return;
						}
						let check = game.checkMod(card, source, event, "unchanged", "cardEnabled2", source);
						return check;
					},
					cardEnabled(card, player, event) {
						const source = player.getStorage("dcmohua_effect");
						if (!source.isIn() || get.itemtype(source) != "player") {
							return;
						}
						const evt = get.event().getParent("chooseToUse", true, true);
						if (!evt?.dcmohua) {
							return;
						}
						if (event === "forceEnable") {
							let mod = game.checkMod(card, source, event, "unchanged", "cardEnabled", source);
							if (mod != "unchanged") {
								return mod;
							}
							return true;
						} else {
							let filter = get.info(card).enable;
							if (!filter) {
								return;
							}
							let mod = game.checkMod(card, player, source, "unchanged", "cardEnabled", source);
							if (mod != "unchanged") {
								return mod;
							}
							if (typeof filter == "boolean") {
								return filter;
							}
							if (typeof filter == "function") {
								return filter(card, source, event);
							}
						}
					},
					cardUsable(card, player, num) {
						const source = player.getStorage("dcmohua_effect");
						if (!source.isIn() || get.itemtype(source) != "player") {
							return;
						}
						const evt = get.event().getParent("chooseToUse", true, true);
						if (!evt?.dcmohua) {
							return;
						}
						let event = _status.event;
						if (event.type == "chooseToUse_button") {
							event = event.getParent();
						}
						/*if (source != _status.event.player) {
							return true;
						}*/
						const info = get.info(card);
						if (info.updateUsable == "phaseUse") {
							if (event.getParent().name != "phaseUse") {
								return true;
							}
							if (event.getParent().player != source) {
								return true;
							}
						}
						event.addCount_extra = true;
						num = info.usable;
						if (typeof num == "function") {
							num = num(card, source);
						}
						num = game.checkMod(card, source, num, event, "cardUsable", source);
						if (typeof num != "number") {
							return true;
						}
						if (source.countUsed(card) < num) {
							return true;
						}
						if (
							game.hasPlayer(function (current) {
								return game.checkMod(card, source, current, false, "cardUsableTarget", source);
							})
						) {
							return true;
						}
						return false;
					},
					playerEnabled(card, player, target) {
						const source = player.getStorage("dcmohua_effect");
						if (!source.isIn() || get.itemtype(source) != "player") {
							return;
						}
						const evt = get.event().getParent("chooseToUse", true, true);
						if (!evt?.dcmohua) {
							return;
						}
						return lib.filter.targetEnabledx(card, source, target);
					},
					targetInRange(card, player, target) {
						const source = player.getStorage("dcmohua_effect");
						if (!source.isIn() || get.itemtype(source) != "player") {
							return;
						}
						const evt = get.event().getParent("chooseToUse", true, true);
						if (!evt?.dcmohua) {
							return;
						}
						return lib.filter.targetInRange(card, source, target);
					},
				},
				group: "dcmohua_draw",
			},
			draw: {
				charlotte: true,
				trigger: { global: "useCard" },
				filter(event, player) {
					let evt = event.getParent(2);
					if (!event.targets?.length || evt.name !== "dcmohua" || evt.player !== player) {
						return false;
					}
					evt = evt.card.storage.dcmohua;
					return evt.targets?.length && evt.targets.containsSome(...event.targets);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const evt = trigger.getParent(2);
					const targets = evt.card.storage.dcmohua.targets.filter(target => trigger.targets.includes(target));
					await player.draw(targets.length);
				},
			},
		},
	},
	//威曹操
	dcduoyue: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return game.hasPlayer(current => player.canCompare(current));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (_, player, target) => {
					return player.canCompare(target);
				})
				.set("ai", target => 10 - get.attitude(get.player(), target))
				.forResult();
		},
		async content(event, trigger, player) {
			let target = event.targets[0],
				num = 0;
			while (num < 3) {
				if (!game.hasPlayer(current => player.canCompare(current))) {
					break;
				}
				if (num > 0) {
					const result = await player
						.chooseTarget(`###掇月###请选择一名角色拼点（当前已拼点次数：${num}）`, (_, player, target) => {
							return player.canCompare(target);
						})
						.set("ai", target => get.effect(target, { name: "draw" }, get.player(), get.player()))
						.forResult();
					if (result?.bool && result?.targets?.length) {
						target = result.targets[0];
					} else {
						break;
					}
				}
				num++;
				if (player.canCompare(target)) {
					const result = await player.chooseToCompare(target).forResult();
					const winner = result?.winner;
					if (winner?.isIn()) {
						if (winner === player) {
							const { targets } = await player
								.chooseTarget(`###掇月###你可将此次摸牌改为对一名角色造成1点伤害${num < 3 ? "并中止后续拼点" : ""}`)
								.set("ai", target => {
									const { player, drawEff } = get.event();
									const damageEff = get.damageEffect(target, player, player);
									if (drawEff > damageEff) {
										return 0;
									}
									return damageEff;
								})
								.set("drawEff", (get.effect(player, { name: "draw" }, player, player) * num) / 2)
								.forResult();
							if (targets?.length) {
								player.line(targets);
								await targets[0].damage("nocard");
								break;
							}
						}
						const result = await player
							.chooseBool(`掇月：是否令${get.translation(winner)}摸${get.cnNumber(num)}张牌`)
							.set("choice", get.effect(winner, { name: "draw" }, player, player) > 0)
							.forResult();
						if (result?.bool) {
							await winner.draw(num);
						}
					}
				}
			}
		},
	},
	dcjunhe: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), "he", [1, Infinity], (card, player) => {
					if (!ui.selected.cards.length) {
						return true;
					}
					const color = get.color(card, player),
						type = get.type2(card);
					return ui.selected.cards.every(cardx => get.type2(cardx) == type) || ui.selected.cards.every(cardx => get.color(cardx) == color);
				})
				.set("complexCard", true)
				.set("ai", card => {
					const { parent: event, player } = get.event();
					let mark = player.countMark(event.skill + "_effect");
					if (mark > 5 || ui.selected.cards.length + mark > 5) {
						return 0;
					}
					return 7 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			await player.showCards(cards, `${get.translation(player)}发动了【${get.translation(event.name)}】`);
			const num = cards.length + 1;
			const name = `${event.name}_effect`;
			player.setMark(name, num, false);
			player.setStorage(`${event.name}_shown`, [...cards.map(i => get.color(i)), ...cards.map(i => get.type2(i))].unique());
			player.addSkill(name);
		},
		subSkill: {
			effect: {
				charlotte: true,
				intro: {
					content(storage, player) {
						return `下${get.cnNumber(storage)}次：造成伤害时，可弃置${get.translation(player.getStorage("dcjunhe_shown"))}牌令此伤害+1；受到伤害后摸两张牌”。`;
					},
				},
				trigger: {
					player: "damageEnd",
					source: "damageBegin1",
				},
				filter(event, player) {
					return player.hasMark("dcjunhe_effect");
				},
				async cost(event, trigger, player) {
					if (event.triggername == "damageBegin1") {
						const list = player.getStorage("dcjunhe_shown");
						const target = trigger.player;
						event.result = await player
							.chooseToDiscard(get.prompt(event.skill, target), `弃置一张符合条件的牌并令${get.translation(trigger.player)}即将受到来自你的${trigger.num}点伤害+1`, "he", (card, player) => {
								const { list } = get.event();
								const type = get.type2(card);
								const color = get.color(card);
								return list.includes(type) || list.includes(color);
							})
							.set("list", list)
							.set("goon", get.damageEffect(trigger.player, player, player) > 0)
							.set("ai", card => {
								const { goon } = get.event();
								if (!goon) {
									return 0;
								}
								return 7 - get.value(card);
							})
							.set("chooseonly", true)
							.forResult();
					} else {
						event.result = { bool: true };
					}
				},
				async content(event, trigger, player) {
					player.removeMark(event.name, 1, false);
					if (event.triggername == "damageBegin1") {
						await player.modedDiscard(event.cards);
						trigger.num++;
					} else {
						await player.draw(2);
					}
				},
			},
		},
	},
};
