import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjianli" | "dcqingzheng" | "dcdulu" | "dcfuji">} */
export const groupSkills = {
	//桓阶
	dcjianli: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filterCard: true,
		selectCard: [1, 2],
		position: "he",
		filterTarget: lib.filter.notMe,
		check(card) {
			if (get.tag(card, "damage")) {
				return 10 - get.value(card);
			}
			return 5 - get.value(card);
		},
		lose: false,
		discard: false,
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.give(cards, target);
			const result = await target
				.chooseToUse({
					filterCard(card) {
						if (get.itemtype(card) != "card" || (get.position(card) != "h" && get.position(card) != "s")) {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					prompt: "谏立：是否使用一张手牌？",
					addCount: false,
					ai1(card) {
						const player = get.player();
						if (get.tag(card, "damage") && player.hasValueTarget(card)) {
							return 10 + get.cacheOrder(card);
						}
						return get.cacheOrder(card);
					},
				})
				.forResult();
			if (!result?.bool || !target.hasHistory("sourceDamage", evt => evt.getParent(4) === event)) {
				target.line(player);
				await player.damage(target, "nocard");
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (
						player.countCards("he", card => {
							return get.tag(card, "damage") && target.hasValueTarget(card);
						})
					) {
						return 2;
					}
					return get.damageEffect(player, target, target);
				},
				player(player, target) {
					if (
						player.countCards("he", card => {
							return get.tag(card, "damage") && target.hasValueTarget(card);
						})
					) {
						return 3;
					}
					if (player.hp <= 1) {
						return 1;
					}
					return 2;
				},
			},
		},
	},
	dcqingzheng: {
		audio: 2,
		trigger: {
			player: ["changeHpAfter", "loseAfter"],
			global: ["gainAfter", "equipAfter", "loseAsyncAfter", "addToExpansionAfter", "addJudgeAfter"],
		},
		getIndex(event, player) {
			const result = [],
				evt = event.getl?.(player);
			if (event.name == "changeHp") {
				result.add("hp");
			}
			if (evt?.hs?.length || event.getg?.(player)?.length) {
				result.add("hs");
			}
			if (evt?.es?.length || (event.name == "equip" && event.player == player)) {
				result.add("es");
			}
			return result;
		},
		filter(event, player, name, type) {
			if (player.getStorage("dcqingzheng_used").length > 2) {
				return false;
			}
			if (type == "hp") {
				return event.changedHp !== 0 && player.getHp() == 1;
			}
			return player.countCards(type[0]) == 1;
		},
		async cost(event, trigger, player) {
			let num = 0;
			if (player.getHp() === 1) {
				num++;
			}
			["e", "h"].forEach(pos => {
				if (player.countCards(pos) === 1) {
					num++;
				}
			});
			const result = await player
				.chooseButton([
					get.prompt(event.skill),
					[
						[
							["draw", `摸${get.cnNumber(num)}张牌`],
							["recover", `回复${num}点体力`],
							["equip", `将牌堆中${get.cnNumber(num)}张装备牌置入装备区`],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					const { player, chosenList: list } = get.event();
					if (list.includes(button.link)) {
						return false;
					}
					return button.link != "recover" || player.isDamaged();
				})
				.set("chosenList", player.getStorage(`${event.skill}_used`))
				.set("ai", button => {
					const { player } = get.event();
					switch (button.link) {
						case "draw": {
							return get.effect(player, { name: "draw" }, player, player);
						}
						case "recover": {
							return get.recoverEffect(player);
						}
						default: {
							return 3 - player.countCards("e");
						}
					}
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		async content(event, trigger, player) {
			let num = 0;
			if (player.getHp() === 1) {
				num++;
			}
			["e", "h"].forEach(pos => {
				if (player.countCards(pos) === 1) {
					num++;
				}
			});
			const { cost_data } = event,
				name = `${event.name}_used`;
			player.addTempSkill(name);
			player.markAuto(name, cost_data);
			if (num <= 0) {
				return;
			}
			switch (cost_data) {
				case "draw": {
					await player.draw(num);
					break;
				}
				case "recover": {
					await player.recover(num);
					break;
				}
				default: {
					let cards = [];
					while (cards.length < num) {
						let card = get.cardPile2(card => !cards.includes(card) && get.type(card) == "equip" && player.canEquip(card));
						if (!card) {
							card = get.cardPile2(card => !cards.includes(card) && get.type(card) == "equip" && player.canEquip(card, true));
						}
						if (card) {
							cards.add(card);
							player.$gain2(card);
							await player.equip(card);
						} else {
							break;
						}
					}
					break;
				}
			}
			if (num > 2) {
				player.removeSkill(name);
				game.log(player, "重置了", "#g【清政】");
				player.addGaintag(player.getCards("h"), event.name);
				player.addSkill("dcqingzheng_effect");
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			effect: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag("dcqingzheng");
				},
				trigger: {
					player: "useCard1",
				},
				filter(event, player) {
					if (event.addCount === false) {
						return false;
					}
					return player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx !== event || !evt.hs.length) {
							return false;
						}
						return Object.values(evt.gaintag_map).flat().includes("dcqingzheng");
					});
				},
				async cost(event, trigger, player) {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] == "number") {
						stat[name]--;
					}
				},
				mod: {
					cardUsable(card) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("dcqingzheng"))) {
							return Infinity;
						}
					},
				},
			},
		},
	},
	//刘懿君
	dcdulu: {
		audio: 2,
		enable: "phaseUse",
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			const targets = game
				.getAllGlobalHistory("useCard", evt => evt.targets?.includes(event.player))
				.map(evt => evt.player)
				.toUniqued();
			event.set("dcduluTargets", targets);
		},
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => get.info("dcdulu").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return player != target && get.event().dcduluTargets.includes(target);
		},
		selectTarget: [1, Infinity],
		async content(event, trigger, player) {
			const { target, name } = event,
				skill = `${name}_effect`;
			await target.damage();
			await target.randomDiscard("h", player);
			player.addSkill(skill);
			player.markAuto(skill, target);
			player
				.when(["phaseEnd", `${name}Begin`])
				.filter(evt => {
					if (evt.name == "phase") {
						return evt != event.getParent("phase");
					}
					return evt.target == target;
				})
				.step(async (event, trigger, player) => {
					player.unmarkAuto(skill, target);
				});
		},
		ai: {
			order: 6,
			result: {
				target(player, target) {
					return get.damageEffect(target, player, target);
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			effect: {
				audio: "dcdulu",
				charlotte: true,
				onremove: true,
				intro: {
					content: "$进入濒死时，你获得其所有黑色牌",
				},
				trigger: {
					global: "dying",
				},
				filter(event, player) {
					return event.player?.isIn() && player.getStorage("dcdulu_effect").includes(event.player);
				},
				forced: true,
				locked: false,
				logTarget: "player",
				async content(event, trigger, player) {
					const target = trigger.player,
						cards = target.getGainableCards(player, "he", card => get.color(card, target) == "black");
					if (cards.length) {
						await player.gain(cards, target, "giveAuto");
					}
				},
			},
		},
	},
	dcfuji: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			if (event.player == player) {
				return false;
			}
			return true;
		},
		round: 1,
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			if (!player.countCards("h")) {
				return;
			}
			await target.viewHandcards(player);
			player.addTempSkill(`${event.name}_effect`, "roundStart");
			player
				.when({
					global: "phaseEnd",
				})
				.filter(evt => evt == trigger.getParent("phase"))
				.step(async (event, trigger, player) => {
					await player.recover();
					await player.draw(3);
				});
		},
		subSkill: {
			effect: {
				audio: "dcfuji",
				charlotte: true,
				onremove: true,
				trigger: { target: "useCardToPlayered" },
				intro: { content: "本轮其他角色使用牌指定你为目标后，你可将所有手牌交给一名其他角色并令此牌无效" },
				mark: true,
				filter(event, player) {
					if (!player.countCards("h") || !game.hasPlayer(current => current != player)) {
						return false;
					}
					return event.player != player;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(get.prompt(event.skill), `将所有手牌交给一名其他角色，令${get.translation(trigger.card)}无效`, lib.filter.notMe)
						.set("ai", target => {
							const player = get.player();
							const att = get.attitude(player, target);
							const { card, player: source, targets } = get.event().getTrigger();
							const eff = targets.reduce((sum, current) => {
								return sum + get.effect(current, card, source, player);
							}, 0);
							if (att > 0) {
								return (-eff - 4) * (114514 - target.countCards("h"));
							}
							return 0;
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const {
							targets: [target],
						} = event,
						cards = player.getCards("h");
					if (!cards.length) {
						return;
					}
					await player.give(cards, target);
					const evt = trigger.getParent();
					if (evt) {
						game.log(trigger.card, "被无效了");
						evt.all_excluded = true;
					}
				},
			},
		},
	},
};
