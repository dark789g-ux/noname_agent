import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshengdu" | "dcjieling" | "dcmoshou" | "dcyunjiu" | "dcchiying">} */
export const groupSkills = {
	//董绾
	dcshengdu: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		direct: true,
		async content(event, trigger, player) {
			const result = await player
				.chooseTarget(get.prompt2("dcshengdu"), lib.filter.notMe)
				.set("ai", target => {
					const player = _status.event.player;
					const att = get.attitude(player, target);
					const eff = get.effect(
						target,
						{
							name: "sha",
							storage: { dcjieling: true },
						},
						player,
						player
					);
					let value = att / 5;
					if (value < 0) {
						value = -value / 1.3;
					}
					value = Math.max(value - eff / 20, 0.01);
					return value;
				})
				.forResult();
			if (result.bool) {
				const target = result.targets[0];
				player.logSkill("dcshengdu", target);
				target.addMark("dcshengdu", 1);
			}
		},
		intro: { content: "mark" },
		group: "dcshengdu_effect",
		subSkill: {
			effect: {
				audio: "dcshengdu",
				trigger: { global: "gainAfter" },
				filter(event, player) {
					return event.getParent(2).name == "phaseDraw" && event.player.hasMark("dcshengdu");
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					var num = trigger.player.countMark("dcshengdu");
					player.draw(num * trigger.cards.length);
					trigger.player.removeMark("dcshengdu", num);
				},
			},
		},
	},
	dcjieling: {
		audio: 2,
		enable: "phaseUse",
		position: "hs",
		viewAs: {
			name: "sha",
			storage: { dcjieling: true },
		},
		filterCard(card, player) {
			if (player.getStorage("dcjieling_count").includes(get.suit(card))) {
				return false;
			}
			if (ui.selected.cards.length) {
				return get.suit(card) != get.suit(ui.selected.cards[0]);
			}
			return true;
		},
		selectCard: 2,
		complexCard: true,
		check(card) {
			return 6 - get.value(card);
		},
		async precontent(event, trigger, player) {
			player.addTempSkill("dcjieling_after");
			event.getParent().addCount = false;
			player.addTempSkill("dcjieling_count", "phaseUseAfter");
			player.markAuto(
				"dcjieling_count",
				event.result.cards.reduce((list, card) => list.add(get.suit(card, player)), [])
			);
		},
		ai: {
			order(item, player) {
				return get.order({ name: "sha" }) + 0.1;
			},
		},
		locked: false,
		mod: {
			targetInRange(card) {
				if (card.storage && card.storage.dcjieling) {
					return true;
				}
			},
			cardUsable(card, player, num) {
				if (card.storage && card.storage.dcjieling) {
					return Infinity;
				}
			},
		},
		subSkill: {
			after: {
				charlotte: true,
				audio: "dcjieling",
				trigger: { global: "useCardAfter" },
				filter(event, player) {
					return event.card.name == "sha" && event.card.storage && event.card.storage.dcjieling;
				},
				direct: true,
				async content(event, trigger, player) {
					const damaged = game.hasPlayer2(current => {
						return current.hasHistory("damage", evt => evt.card == trigger.card);
					});
					const targets = trigger.targets.filter(i => i.isIn());
					player.logSkill("dcjieling_after", targets);
					if (damaged) {
						for (const target of targets) {
							target.loseHp();
						}
					} else {
						for (const target of targets) {
							target.addMark("dcshengdu", 1);
						}
					}
				},
			},
			count: {
				intro: {
					content(s, p) {
						let str = "此阶段已转化过的卡牌花色：";
						for (let i = 0; i < s.length; i++) {
							str += get.translation(s[i]);
						}
						return str;
					},
				},
				charlotte: true,
				onremove: true,
			},
		},
	},
	//袁胤
	dcmoshou: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return get.color(event.card) == "black" && player.maxHp > player.countMark("dcmoshou");
		},
		frequent: true,
		prompt2(event, player) {
			const num = player.maxHp - player.countMark("dcmoshou");
			let info = "摸" + get.cnNumber(num) + "张牌";
			if (num === 1) {
				info += "，然后重置【墨守】摸牌数";
			} else if (num > 1) {
				info += "，然后令你下次以此法摸的牌数-1";
			}
			return info;
		},
		async content(event, trigger, player) {
			const { name: mark } = event;
			let num = player.maxHp - player.countMark(mark);
			if (num > 0) {
				await player.draw(num);
			}
			if (num > 1) {
				player.addMark(mark, 1, false);
			} else if (num === 1) {
				player.clearMark(mark, false);
			}
		},
		ai: {
			effect: {
				target_use(card, player, target) {
					if (typeof card === "object" && get.color(card) === "black") {
						const num = target.maxHp - target.countMark("dcmoshou");
						return [1, 0.6 * num];
					}
				},
			},
		},
		onremove: true,
		mark: true,
		intro: {
			markcount: (storage, player) => player.maxHp - player.countMark("dcmoshou"),
			content: (storage, player) => `下次【墨守】摸牌数：${player.maxHp - player.countMark("dcmoshou")}`,
		},
	},
	dcyunjiu: {
		audio: 2,
		trigger: { global: "dieAfter" },
		getCards(event, player) {
			const cards = [];
			const evt = player.getHistory("lose", evtx => evtx.getParent(2) == event)[0];
			return evt ? cards.addArray(evt.hs).addArray(evt.es).filterInD("d") : [];
		},
		filter(event, player) {
			return get.info("dcyunjiu").getCards(event, event.player).length;
		},
		async cost(event, trigger, player) {
			const { player: target } = trigger,
				cards = get.info(event.skill).getCards(trigger, target);
			let result;
			if (cards.length > 1) {
				result = await player
					.chooseCardButton("运柩：请选择要分配的牌", cards)
					.set("ai", button => {
						const player = get.player(),
							{ link } = button;
						if (!game.hasPlayer(current => player != current && get.attitude(player, current)) > 0) {
							return 6.5 - get.value(link);
						}
						return get.value(link);
					})
					.forResult();
			} else if (cards.length === 1) {
				result = { bool: true, links: cards.slice(0) };
			} else {
				return;
			}
			if (!result.bool) {
				return;
			}
			const toGive = result.links.slice(0);
			result = await player
				.chooseTarget("选择一名其他角色获得" + get.translation(toGive), lib.filter.notMe)
				.set("ai", target => {
					const { player, enemy } = get.event();
					const att = get.attitude(player, target);
					if (enemy) {
						return -att;
					} else if (att > 0) {
						return att / (1 + target.countCards("h"));
					} else {
						return Math.max(0.1, att) / 100;
					}
				})
				.set("enemy", get.value(toGive[0], player, "raw") < 0)
				.forResult();
			event.result = {
				bool: result.bool,
				targets: result.targets,
				cost_data: toGive,
			};
		},
		async content(event, trigger, player) {
			const {
				cost_data: cards,
				targets: [target],
			} = event;
			player.line(target, "green");
			await target.gain(cards, "gain2").set("giver", player);
			await player.gainMaxHp();
			await player.recover();
		},
	},
	//高翔
	dcchiying: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target.hp <= player.hp;
		},
		async content(event, tirgger, player) {
			const target = event.target,
				targets = [player];
			while (game.hasPlayer(current => target.inRange(current) && !targets.includes(current))) {
				const result = await target
					.chooseTarget("驰应：是否弃置攻击范围内一名角色一张牌？", function (card, player, target) {
						return _status.event.player.inRange(target) && !_status.event.targets.includes(target);
					})
					.set("targets", targets)
					.set("ai", function (target) {
						return get.effect(target, { name: "guohe_copy2" }, _status.event.player, _status.event.player);
					})
					.forResult();
				if (result.bool) {
					target.line(result.targets, "green");
					await target.discardPlayerCard(result.targets[0], true, "he");
					targets.addArray(result.targets);
				} else {
					break;
				}
			}
			if (target != player) {
				let cards = [];
				game.getGlobalHistory("cardMove", evt => {
					if (evt.getParent(3) == event) {
						cards.addArray(evt.cards.filter(card => get.type(card) == "basic"));
					}
				});
				cards = cards.filterInD("d");
				if (cards.length) {
					target.gain(cards, "gain2");
				}
			}
		},
		ai: {
			order: 6,
			result: {
				target(player, target) {
					var targets = game.filterPlayer(current => target.inRange(current) && current != player);
					var eff = 0;
					for (var targetx of targets) {
						var effx = get.effect(targetx, { name: "guohe_copy2" }, player, target);
						if (get.attitude(player, targetx) < 0) {
							effx /= 2;
						}
						eff += effx;
					}
					return (target == player ? 0.5 : 1) * eff * (get.attitude(player, target) <= 0 ? 0.75 : 1);
				},
			},
		},
	},
};
