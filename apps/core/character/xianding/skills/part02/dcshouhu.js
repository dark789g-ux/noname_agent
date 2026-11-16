import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshouhu" | "dcningzhun" | "dczhijue" | "dcweiwei">} */
export const groupSkills = {
	//凌烈
	dcshouhu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		viewAs: {
			name: "sha",
			storage: {
				dcshouhu: true,
			},
			isCard: true,
		},
		selectTarget: 1,
		filterCard: () => false,
		selectCard: -1,
		async precontent(event, trigger, player) {
			event.getParent().addCount = false;
			const target = event.result.targets[0];
			player
				.when("useCardAfter")
				.filter(evt => evt.getParent() == event.getParent())
				.step(async (event, trigger, player) => {
					if (target?.isIn()) {
						player.addTempSkill("dcshouhu_distance");
						const map = player.getStorage("dcshouhu_distance", new Map());
						let num = (map.has(target) ? map.get(target) : 0) + 1;
						map.set(target, num);
						player.setStorage("dcshouhu_distance", map, true);
					}
					if (
						game.hasGlobalHistory("everything", evt => {
							if (evt.name != "dying" || evt.player != target || !evt.reason) {
								return false;
							}
							return evt.reason.getParent(evtx => evtx == trigger, true);
						})
					) {
						player.addSkill("dcshouhu_nocount");
						await player.draw({ num: player.maxHp, gaintag: ["dcshouhu_nocount"] });
					}
				});
		},
		locked: false,
		mod: {
			cardUsable(card, player, num) {
				if (card?.storage?.dcshouhu) {
					return Infinity;
				}
			},
		},
		group: "dcshouhu_reset",
		subSkill: {
			nocount: {
				inherit: "nocount",
				filter(event, player) {
					return (
						event.addCount !== false &&
						player.hasHistory("lose", evt => {
							return (evt.relatedEvent || evt.getParent()) == event && evt.hs.length && Object.values(evt.gaintag_map).flat().includes("dcshouhu_nocount");
						})
					);
				},
				mod: {
					cardUsable(card) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("dcshouhu_nocount"))) {
							return Infinity;
						}
					},
				},
			},
			reset: {
				updateDistanceMap() {
					const map = {};
					game.countPlayer(current => {
						map[current.playerid] ??= {};
						game.countPlayer(current2 => {
							map[current.playerid][current2.playerid] = current.inRange(current2);
						});
					});
					game.broadcastAll(map => {
						_status.shouhuDistanceMap = map;
					}, map);
					return _status.shouhuDistanceMap;
				},
				hasDistanceChanged(player) {
					if (!_status.shouhuDistanceMap) {
						get.info("dcshouhu_reset").updateDistanceMap();
					}
					const map = _status.shouhuDistanceMap[player.playerid];
					const bool = game.findPlayer(current => {
						return map[current.playerid] === false && player.inRange(current);
					});
					get.info("dcshouhu_reset").updateDistanceMap();
					return bool;
				},
				init(player, skill) {
					get.info(skill).updateDistanceMap();
				},
				trigger: {
					player: "chooseToUseBegin",
					global: ["logSkill", "useSkillAfter", "dieAfter", "changeHp", "equipAfter", "changeSkillsAfter"],
				},
				filter(event, player) {
					if (event.name == "chooseToUse" && event.type != "phase") {
						return false;
					}
					const stat = player.getStat("skill"),
						skill = "dcshouhu";
					if (typeof stat[skill] !== "number" || stat[skill] <= 0) {
						return false;
					}
					return get.info("dcshouhu_reset").hasDistanceChanged(player);
				},
				async cost(event, trigger, player) {
					delete player.getStat("skill")["dcshouhu"];
					game.log(player, "重置了", "#g【狩虎】");
				},
			},
			distance: {
				charlotte: true,
				onremove: true,
				intro: {
					markcount: () => null,
					content(storage, player) {
						const map = player.getStorage("dcshouhu_distance", new Map());
						if (!map.size) {
							return "无效果";
						}
						return Array.from(map.keys())
							.map(current => `计算与${get.translation(current)}的距离+${map.get(current)}`)
							.join("<br>");
					},
				},
				mod: {
					globalFrom(from, to, num) {
						const map = from.getStorage("dcshouhu_distance", new Map());
						if (map.has(to)) {
							return num + map.get(to);
						}
					},
				},
			},
		},
	},
	dcningzhun: {
		audio: 2,
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			if (player.getStorage("dcningzhun_used").length > 2) {
				return false;
			}
			return player.getHistory("useCard").indexOf(event) % 2 == 1;
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([
					get.prompt(event.skill),
					[
						[
							["decrease", "攻击范围-1"],
							["increase", "攻击范围+1"],
							["moveCard", "移动场上一张牌"],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					const player = get.player(),
						list = player.getStorage("dcningzhun_used");
					if (button.link == "moveCard" && !player.canMoveCard()) {
						return false;
					}
					return !list.includes(button.link);
				})
				.set("ai", button => {
					switch (button.link) {
						case "decrease": {
							if (player.getStorage("dcningzhun", 0) > 0) {
								return 1.5;
							}
							return 0;
						}
						case "increase": {
							if (game.hasPlayer(current => !player.inRange(current))) {
								return 2;
							}
							return 1;
						}
						default: {
							if (player.canMoveCard(true)) {
								return 3;
							}
							return 0.5;
						}
					}
				})
				.forResult();
			if (result?.bool) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		async content(event, trigger, player) {
			const name = "dcningzhun_used";
			player.addTempSkill(name);
			player.markAuto(name, event.cost_data);
			switch (event.cost_data) {
				case "decrease": {
					const count = player.getStorage(event.name, 0) - 1;
					player.setStorage(event.name, count, true);
					game.log(player, "令攻击范围-1");
					break;
				}
				case "increase": {
					const count = player.getStorage(event.name, 0) + 1;
					player.setStorage(event.name, count, true);
					game.log(player, "令攻击范围+1");
					break;
				}
				default: {
					if (player.canMoveCard()) {
						await player.moveCard();
					}
					break;
				}
			}
			if (player.getStorage(name).length > 1) {
				player.removeSkill(name);
				game.log(player, "重置了", "#g【凝准】");
			}
		},
		intro: {
			content(storage, player) {
				return `攻击范围${storage >= 0 ? "+" : ""}${storage}`;
			},
		},
		locked: false,
		mod: {
			attackRange(player, num) {
				return num + player.getStorage("dcningzhun", 0);
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	//陶璜
	dczhijue: {
		audio: 2,
		mod: {
			globalFrom(from, to, distance) {
				return distance - 2;
			},
		},
		trigger: { source: "damageSource" },
		forced: true,
		filter(event, player) {
			return player.maxHp > player.countCards("h");
		},
		async content(event, trigger, player) {
			if (player.maxHp > player.countCards("h")) {
				await player.drawTo(player.maxHp);
			}
			player.tempBanSkill(event.name);
		},
	},
	dcweiwei: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		usable: 1,
		filter(event, player) {
			return event.player != player;
		},
		check(event, player) {
			return true;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const targets = [player, target];
			await game.asyncDraw(targets, 2);
			if (!target.countCards("h") || !player.countCards("h")) {
				return;
			}
			const map = await game.chooseAnyOL(targets, get.info(event.name).chooseCard, [targets, player]).forResult();
			let card1, card2;
			for (let target of targets) {
				if (target == player) {
					card1 = map.get(target).cards[0];
				} else {
					card2 = map.get(target).cards[0];
				}
			}
			if (!card1 || !card2) {
				return;
			}
			await player.swapHandcards(target, [card1], [card2]);
			const effect = "dcweiwei_effect";
			const tag = `dcweiwei_${player.playerid}`;
			game.addTempTag(tag, `维卫·${get.translation(player)}`);
			if (target.getCards("h").includes(card1)) {
				target.addGaintag([card1], tag);
			}
			player.addTempSkill(effect);
			player.markAuto(effect, [target]);
			player
				.when({
					global: "useCardAfter",
				})
				.filter(evt => evt == trigger.getParent())
				.step(async (event, trigger, player) => {
					if (!player.getCards("h").includes(card2)) {
						return;
					}
					if (player.hasUseTarget(card2)) {
						await player.chooseUseTarget(card2);
					}
				});
		},
		chooseCard(player, targets, source, eventId) {
			const target = targets[0] == player ? targets[1] : targets[0];
			return player
				.chooseCard("h", true)
				.set("prompt", `维卫：请选择一张要与${get.translation(target)}交换的手牌`)
				.set("ai", card => {
					const { player, target, source, att } = get.event();
					const useValue = target.getUseValue(card);
					if (player == source) {
						if (att > 0) {
							return useValue;
						}
						return 6 - get.value(card);
					}
					if (att > 0) {
						return (8 - get.value(card)) * useValue;
					}
					if (useValue == 0) {
						return 114514;
					}
					return 6 - get.value(card);
				})
				.set("target", target)
				.set("source", source)
				.set("att", get.attitude(player, target))
				.set("id", eventId)
				.set("_global_waiting", true);
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					for (const target of player.getStorage(skill)) {
						target.removeGaintag(`dcweiwei_${player.playerid}`);
					}
					delete player.storage[skill];
				},
				intro: { content: "本回合结束时，你可以对$中的手牌中仍有你因【维卫】交换给其的牌的角色造成1点伤害" },
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					return player.getStorage("dcweiwei_effect").includes(event.player);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					for (const target of player.getStorage(event.name).sortBySeat()) {
						if (!target.isIn()) {
							continue;
						}
						if (target.hasCards("h", card => card.hasGaintag(`dcweiwei_${player.playerid}`))) {
							const result = await player
								.chooseBool(`维卫：你可以对${get.translation(target)}造成1点伤害`)
								.set("choice", get.damageEffect(target, player, player) > 0)
								.forResult();
							if (result.bool) {
								await target.damage(player);
							}
						}
					}
					player.removeSkill(event.name);
				},
			},
		},
	},
};
