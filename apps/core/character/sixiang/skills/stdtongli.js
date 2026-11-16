import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdtongli" | "stdshezang" | "stdjianying" | "stdshibei" | "stdjianjie" | "stdchenghao" | "stdzhengjing" | "stdkuangcai" | "stdshejian" | "stdgongqiao">} */
export const groupSkills = {
	//张璇
	stdtongli: {
		audio: "tongli",
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			const evtx = event.getParent("phaseUse");
			const num = game
				.filterPlayer()
				.map(i => i.getCards("ej").map(card => get.suit(card)))
				.flat()
				.unique().length;
			return (
				player.isPhaseUsing() &&
				player.getHistory("useCard", evt => evt.getParent("phaseUse") == evtx).length == num &&
				["basic", "trick"].includes(get.type(event.card))
			);
		},
		check(event, player) {
			return !get.tag(event.card, "norepeat") ^ (event.targets?.reduce((sum, i) => sum + get.effect(i, event.card, player, player), 0) < 0);
		},
		async content(event, trigger, player) {
			trigger.effectCount++;
			game.log(trigger.card, "额外结算一次");
		},
	},
	stdshezang: {
		audio: "shezang",
		trigger: { player: "dying" },
		filter(event, player) {
			return player.canMoveCard(
				null,
				true,
				game.filterPlayer(target => target != player),
				player
			);
		},
		check(event, player) {
			return player.canMoveCard(
				true,
				true,
				game.filterPlayer(target => target != player),
				player
			);
		},
		async content(event, trigger, player) {
			let num = 0;
			const goon = () =>
				num++ < 4 &&
				player.canMoveCard(
					null,
					true,
					game.filterPlayer(target => target != player),
					player
				);
			while (goon()) {
				await player
					.moveCard(
						num < 2,
						game.filterPlayer(target => target != player),
						player
					)
					.set("nojudge", true);
			}
		},
	},
	//沮授
	stdjianying: {
		audio: "jianying",
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.canMoveCard();
		},
		check(event, player) {
			return player.canMoveCard(true);
		},
		async content(event, trigger, player) {
			const result = await player.moveCard(true).forResult();
			if (result?.card) {
				const { card } = result;
				player.addTempSkill(`${event.name}_draw`, "phaseChange");
				player.markAuto(`${event.name}_draw`, card);
			}
		},
		subSkill: {
			draw: {
				charlotte: true,
				audio: "jianying",
				forced: true,
				trigger: {
					player: "useCard",
				},
				onremove: true,
				filter(event, player) {
					const storage = player.getStorage("stdjianying_draw");
					const check = card => get.suit(card) == get.suit(event.card) || get.number(card) == get.number(event.card);
					return (
						storage.some(i => check(i)) &&
						player
							.getHistory("useCard", evt => check(evt.card) && evt.getParent("phaseUse") == event.getParent("phaseUse"))
							.indexOf(event) == 0
					);
				},
				async content(event, trigger, player) {
					await player.draw();
				},
				intro: {
					content: "cards",
				},
			},
		},
	},
	stdshibei: {
		audio: "shibei",
		forced: true,
		locked: false,
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		trigger: { player: "damageEnd" },
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recover();
		},
	},
	//四象封印·白虎
	//司马徽
	stdjianjie: {
		audio: "jianjie",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target.countCards("he"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, 3], (card, player, target) => {
					return target.countCards("he");
				})
				.set("ai", target => get.attitude(get.player(), target) * target.countCards("he"))
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets.sortBySeat();
			const map = new Map();
			for (const target of targets) {
				const result = await player.choosePlayerCard(target, `请选择${get.translation(target)}要展示的牌`, "he", true).forResult();
				if (result?.cards?.length) {
					map.set(target, result.cards[0]);
				}
			}
			await player
				.showCards(Array.from(map.values()), get.translation(player) + "发动了【荐杰】")
				.set("customButton", button => {
					const target = get.owner(button.link);
					if (target) {
						button.node.gaintag.innerHTML = target.getName();
					}
				})
				.set("delay_time", Math.max(2.5, map.size));
			await game.doAsyncInOrder(targets, async (target, index) => {
				const card = map.get(target);
				let vcard;
				switch (get.color(card, target)) {
					case "red":
						vcard = get.autoViewAs({ name: "huogong" }, [card]);
						break;
					case "black":
						vcard = get.autoViewAs({ name: "tiesuo" }, [card]);
						break;
					default:
						return;
				}
				return target.chooseUseTarget(vcard, [card], false);
			});
		},
	},
	stdchenghao: {
		audio: "xinfu_chenghao",
		trigger: { global: "damageBegin3" },
		usable: 1,
		filter(event, player) {
			return event.hasNature();
		},
		check: () => true,
		async content(event, trigger, player) {
			const cards = get.cards(1, true);
			await player.viewCards("称好：牌堆顶的一张牌", cards);
			const result = await player
				.chooseTarget(`将${get.translation(cards)}交给一名角色`, true)
				.set("ai", function (target) {
					const att = get.attitude(_status.event.player, target);
					if (_status.event.enemy) {
						return -att;
					} else if (att > 0) {
						return att / (1 + target.countCards("h"));
					} else {
						return att / 100;
					}
				})
				.set("enemy", get.value(cards[0], player, "raw") < 0)
				.forResult();
			if (result?.targets?.length) {
				const [target] = result.targets;
				player.line(target, "green");
				await target.gain(cards, "draw");
			}
		},
	},
	//郑玄
	stdzhengjing: {
		audio: "zhengjing",
		trigger: { player: "phaseDrawBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		async content(event, trigger, player) {
			const hs = player.getCards("h");
			const top = get.cards(Math.min(3, hs.length), true);
			const cards = hs.concat(top);
			await player
				.showCards(cards, get.translation(player) + "发动了【整经】")
				.set("customButton", button => {
					if (!get.owner(button.link)) {
						button.node.gaintag.innerHTML = "牌堆顶";
					}
				})
				.set("delay_time", Math.min(4, cards.length * 1.5));
			if (game.hasPlayer(target => target != player)) {
				const map = Object.groupBy(cards, i => get.suit(i, player));
				const list = get.addNewRowList(cards, "suit", player);
				const result = await player
					.chooseButtonTarget({
						createDialog: [
							[
								[[`整经：选择一名其他角色令其获得其中一种花色的牌`], "addNewRow"],
								[
									dialog => {
										dialog.classList.add("fullheight");
										dialog.forcebutton = false;
										dialog._scrollset = false;
									},
									"handle",
								],
								list.map(item => [Array.isArray(item) ? item : [item], "addNewRow"]),
							],
						],
						forced: true,
						filterTarget: lib.filter.notMe,
						filterButton(button) {
							return button.links.length > 0;
						},
						ai1(button) {
							const player = get.player();
							if (!game.hasPlayer(current => player != current && get.attitude(player, current) > 0)) {
								return button.links.length;
							}
							return 1 / button.links.length;
						},
						ai2(target) {
							const att = get.attitude(get.player(), target);
							if (att > 0) {
								return att / (1 + target.countCards("h"));
							} else {
								return att / 100;
							}
						},
					})
					.forResult();
				if (result?.links?.length && result.targets?.length) {
					const suit = result.links[0];
					const target = result.targets[0];
					cards.removeArray(map[suit]);
					player.line(target);
					await target
						.gain(map[suit])
						.set("giver", player)
						.set(
							"given",
							map[suit].filter(i => hs.includes(i))
						)
						.set("animate", event => {
							const player = event.player;
							const giver = event.giver;
							const cards = event.cards;
							const given = event.given;
							const top = cards.removeArray(given);
							if (given.length) {
								giver.$give(given, player);
							}
							if (top.length) {
								player.$gain2(top, true);
							}
							return 500;
						});
				}
			}
			await player.gain(cards, "gain2");
		},
	},
	//祢衡
	stdkuangcai: {
		audio: "rekuangcai",
		mod: {
			cardUsable(card, player) {
				if (player.isPhaseUsing() && get.event().stdkuangcai < 2) {
					return Infinity;
				}
			},
			targetInRange(card, player) {
				if (player.isPhaseUsing() && get.event().stdkuangcai < 2) {
					return true;
				}
			},
		},
		forced: true,
		onChooseToUse(event) {
			const player = event.player;
			if (!game.online && !event.stdkuangcai && event.type == "phase") {
				event.set("stdkuangcai", player.getHistory("useCard", evt => evt.getParent("phaseUse") == event.getParent("phaseUse")).length);
			}
		},
		trigger: { player: "useCard" },
		filter(event, player) {
			if (!player.isPhaseUsing()) {
				return false;
			}
			return player.getHistory("useCard", evt => evt.getParent("phaseUse") == event.getParent("phaseUse")).indexOf(event) < 2;
		},
		async content(event, trigger, player) {
			if (trigger.addCount !== false) {
				trigger.addCount = false;
				const stat = player.getStat().card,
					name = trigger.card.name;
				if (typeof stat[name] == "number") {
					stat[name]--;
				}
			}
			player
				.when("useCardAfter")
				.filter(evt => evt == trigger)
				.step(async (event, trigger, player) => {
					if (player.hasHistory("sourceDamage", evt => evt.card === trigger.card)) {
						await player.draw();
					} else {
						await player.chooseToDiscard("he", true);
					}
				});
		},
	},
	stdshejian: {
		audio: "reshejian",
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return event.player != player && event.targets.length == 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt2(event.skill, trigger.player), "h", 2, "chooseonly")
				.set("ai", card => {
					const eff = get.damageEffect(get.event().source, get.player(), get.player());
					if (eff > 0) {
						return 7 - get.value(card);
					}
					return 0;
				})
				.set("source", trigger.player)
				.forResult();
		},
		async content(event, trigger, player) {
			await player.discard(event.cards);
			const target = trigger.player;
			player
				.when({ global: "phaseJieshuBegin" })
				.filter(evt => evt.getParent("phase") === trigger.getParent("phase"))
				.step(async (event, trigger, player) => {
					if (target.isIn()) {
						player.line(target);
						await target.damage();
					}
				});
		},
	},
	//马钧
	stdgongqiao: {
		audio: "gongqiao",
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		async content(event, trigger, player) {
			const cards = [];
			const { target } = event;
			let card;
			while (true) {
				card = get.cards(1, true)[0];
				cards.push(card);
				await player
					.showCards(card, `${get.translation(player)}【工巧】亮出的第${get.cnNumber(cards.length, true)}张牌`, true)
					.set("clearArena", false);
				if (get.type(card) == "equip") {
					cards.remove(card);
					break;
				}
			}
			game.broadcastAll(ui.clear);
			if (card && target.hasUseTarget(card)) {
				await target.chooseUseTarget(card, true);
			}
			if (cards.length) {
				const hs = target.getCards("h");
				if (hs.length) {
					target.$throw(hs, 1000);
					game.log(target, "将", hs, "置入处理区");
					await target.lose(hs, ui.ordering);
				}
				await target.gain(cards, "gain2");
			}
		},
		ai: {
			order: 1,
			result: {
				target: 1,
			},
		},
	},
};
