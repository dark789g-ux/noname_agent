import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqingxi" | "oljieyong" | "olzhuohun" | "olchenshi" | "olqiaoshi" | "olyanyu" | "juanjia">} */
export const groupSkills = {
	olqingxi: {
		audio: 2,
		trigger: {
			source: "damageBegin1",
		},
		filter(event, player) {
			return event.card?.name == "sha" && event.getParent(evt => evt.name == "useCard" && evt.card == event.card, true)?.targets?.includes(event.player);
		},
		logTarget: "player",
		check(event, player) {
			return get.damageEffect(event.player, player, player) > 0;
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			let result;
			if (player.getEquips(1).length > 0) {
				result = { index: 2 };
			} else if (!target.hasDiscardableCards(target, "he") || !player.getAttackRange()) {
				result = { index: 1 };
			} else {
				result = await target
					.chooseControl({
						choiceList: [`弃置${get.cnNumber(player.getAttackRange())}张牌`, `此次伤害+1`],
						choice: (() => {
							if (target.hp == 1) {
								return 0;
							}
							if (player.getAttackRange() > 2) {
								return 1;
							}
							return 0;
						})(),
						prompt: `${get.translation(player)}对你发动了【倾袭】，请选择一项`,
					})
					.forResult();
			}
			if (typeof result.index !== "number") {
				return;
			}
			if (result.index % 2 == 0) {
				await target
					.chooseToDiscard({
						forced: true,
						position: "he",
						selectCard: player.getAttackRange(),
					})
					.forResult();
			}
			if (result.index > 0) {
				trigger.num++;
			}
			if (result.index == 2) {
				await player.modedDiscard({ cards: player.getEquips(1) });
			}
		},
	},
	//界关平
	oljieyong: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		viewAsFilter(player) {
			return player.countCards("h", { color: "red" }) == 1;
		},
		viewAs: {
			name: "sha",
		},
		filterCard(card, player) {
			return get.color(card) == "red";
		},
		selectCard: -1,
	},
	//魔张飞
	olzhuohun: {
		audio: 6,
		forced: true,
		mod: {
			cardname(card, player) {
				if (_status.currentPhase == player && card.name == "shan") {
					return "sha";
				}
			},
		},
		trigger: {
			global: ["changeHpAfter", "loseMaxHpAfter", "gainMaxHpAfter"],
		},
		filter(event, player) {
			if (_status.currentPhase != player) {
				return false;
			}
			const curColor = get.hpColor(event.player);
			const prevColor = get.hpColor({ hp: event.originalHp, maxHp: event.originalMaxHp });
			if (curColor == prevColor) {
				return false;
			}
			const list = [];
			for (const evt of _status.globalHistory[_status.globalHistory.length - 1]["everything"]) {
				if (!["changeHp", "gainMaxHp", "loseMaxHp"].includes(evt.name)) {
					continue;
				}
				if (evt.player != event.player) {
					continue;
				}
				const { originalHp, originalMaxHp, changedHp, changedMaxHp } = evt;
				const cur = get.hpColor({ hp: originalHp + changedHp, maxHp: originalMaxHp + changedMaxHp });
				const prev = get.hpColor({ hp: originalHp, maxHp: originalMaxHp });
				if (cur == prev || list.includes(cur)) {
					continue;
				}
				list.add(cur);
				if (cur == curColor && evt == event) {
					return true;
				}
			}
			return false;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				targets: [target],
				name,
			} = event;
			const bool = player.storage[name];
			if (!bool) {
				await player.draw();
			} else {
				await player.drawTo(player.maxHp);
				const color = get.hpColor(trigger.player);
				switch (color) {
					case "green":
						target.addTempSkill(`${name}_draw`);
						break;
					case "yellow":
						target.addTempSkill("fengyin");
						break;
					case "red":
						if (!game.hasPlayer2(i => i.isDying())) {
							await target.loseHp(target.getHp());
						}
						break;
					default:
						break;
				}
			}
		},
		subSkill: {
			draw: {
				charlotte: true,
				forced: true,
				mark: true,
				intro: {
					content: "本回合摸牌改为从牌堆获得等量【杀】",
				},
				trigger: {
					player: "drawBefore",
				},
				async content(event, trigger, player) {
					trigger.cancel();
					const { num } = trigger;
					const cards = [];
					for (let i = 0; i < num; i++) {
						const card = get.cardPile2(card => get.name(card) == "sha" && !cards.includes(card));
						if (card) {
							cards.push(card);
						} else {
							break;
						}
					}
					if (cards.length) {
						await player.gain({ cards, animate: "gain2" });
					} else {
						player.chat("是啊，摸什么");
					}
				},
			},
		},
	},
	olchenshi: {
		audio: 3,
		forced: true,
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		filter(event, player, name) {
			const { card } = event;
			const checkCard = card => {
				return ["sha", "juedou"].includes(get.name(card));
			};
			if (!card || !checkCard(card) || player.hasSkill("olrumo", null, false, false)) {
				return false;
			}
			return (
				player
					.getAllHistory(name == "damageSource" ? "sourceDamage" : "damage", evt => {
						return evt.card && checkCard(evt.card);
					})
					.reduce((sum, evt) => sum + evt.num, 0) >= 3
			);
		},
		skillAnimation: true,
		animationColor: "red",
		async content(event, trigger, player) {
			await player.recover();
			player.setStorage("olzhuohun", true);
			game.log(player, "修改了〖灼魂〗");
			player.addSkill("olrumo");
		},
		group: ["olchenshi_useCard"],
		subSkill: {
			useCard: {
				audio: "olchenshi",
				forced: true,
				trigger: {
					player: ["useCard2"],
					global: ["useCard"],
				},
				filter(event, player, name) {
					const { card, targets } = event;
					if (get.name(card) != "sha" || get.color(card) != "black") {
						return false;
					}
					if (name == "useCard2") {
						return game.hasPlayer(target => {
							return !targets.includes(target) && get.hpColor(target) != get.hpColor(player) && lib.filter.targetEnabled2(card, player, target);
						});
					}
					return event.player == player ? targets.some(target => get.hpColor(target) == get.hpColor(player)) : get.hpColor(event.player) == get.hpColor(player) && targets.includes(player);
				},
				async content(event, trigger, player) {
					const { card, targets, cards } = trigger;
					if (event.triggername == "useCard2") {
						const result = await player
							.chooseTarget({
								prompt: `瞋视：为${get.translation(card)}增加任意个目标`,
								selectTarget: [1, Infinity],
								filterTarget(card, player, target) {
									return !get.event().targets.includes(target) && get.hpColor(target) != get.hpColor(player) && lib.filter.targetEnabled2(get.event().card, player, target);
								},
								ai(target) {
									return get.effect(target, get.event().card, get.player(), get.player());
								},
							})
							.set("targets", targets)
							.set("card", card)
							.forResult();
						if (result.bool && result.targets?.length) {
							const { targets } = result;
							player.line(targets);
							trigger.targets.addArray(targets);
							game.log(targets, "成为", card, "的额外目标");
						}
					} else {
						if (trigger.addCount !== false) {
							trigger.addCount = false;
							const stat = trigger.player.getStat().card,
								name = card.name;
							if (typeof stat[name] == "number") {
								stat[name]--;
							}
						}
						trigger.card.name = "juedou";
						delete trigger.card.nature;
						for (const node of cards) {
							const clone = node.clone;
							if (clone) {
								ui.create.cardTempName(card, clone);
							}
						}
					}
				},
			},
		},
	},
	//界夏侯氏
	olqiaoshi: {
		audio: 2,
		trigger: {
			global: "phaseJieshuBegin",
		},
		logTarget: () => _status.currentPhase,
		filter(event, player) {
			return _status.currentPhase?.isIn();
		},
		check(event, player) {
			return get.attitude(player, _status.currentPhase) > 0;
		},
		async content(event, trigger, player) {
			let { targets } = event;
			targets = [player, ...targets];
			await game.asyncDraw(targets);
			if (targets[0].countCards("h") != targets[1].countCards("h")) {
				player.tempBanSkill(event.name, "roundStart");
			}
		},
		ai: {
			expose: 0.25,
			tag: {
				draw: 1,
			},
		},
	},
	olyanyu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => get.name(card) == "sha" && player.canRecast(card), "h");
		},
		filterCard: (card, player) => get.name(card) == "sha" && player.canRecast(card),
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			await player.recast(event.cards);
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
		},
		group: ["olyanyu_draw"],
		subSkill: {
			draw: {
				audio: "olyanyu",
				trigger: {
					player: "phaseUseEnd",
				},
				filter(event, player) {
					return player.getHistory("lose", evt => evt.getParent("phaseUse") == event).reduce((list, evt) => list.addArray(evt.cards2.filter(card => get.name(card) == "sha")), []).length >= 2 && game.hasPlayer(target => target.sex == "male");
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget({
							prompt: get.prompt(event.skill),
							prompt2: "令一名男性角色摸两张牌",
							filterTarget(card, player, target) {
								return target.sex == "male";
							},
							ai(target) {
								return get.effect(target, { name: "draw" }, get.player(), get.player());
							},
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					await target.draw({ num: 2 });
				},
			},
		},
	},
	//神典韦
	juanjia: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && player.hasEnabledSlot(2);
		},
		async content(event, trigger, player) {
			await player.disableEquip(2);
			await player.expandEquip(1);
		},
	},
};
