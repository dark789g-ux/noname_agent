import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "rexianyuan" | "twxianyuan" | "twlingyin" | "twkuiduan">} */
export const groupSkills = {
	//幻诸葛果
	rexianyuan: {
		audio: "twxianyuan",
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			return event.player.hasMark("rexianyuan");
		},
		forced: true,
		locked: false,
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player,
				str = get.translation(target);
			const num = target.countMark("rexianyuan");
			let choice;
			if (!target.countCards("h")) {
				choice = 1;
			} else {
				choice = (
					await player
						.chooseControl()
						.set("choiceList", [
							"观看" + str + "的手牌并将其中至多" + get.cnNumber(num) + "张牌置于牌堆顶",
							"令" + str + "摸" + get.cnNumber(num) + "张牌",
						])
						.set("ai", () => (get.attitude(get.player(), get.event().getTrigger().player) > 0 ? 1 : 0))
						.forResult()
				).index;
			}
			if (typeof choice != "number") {
				return;
			}
			if (choice == 0) {
				const result = await player
					.choosePlayerCard(
						target,
						"h",
						"visible",
						[1, num],
						true,
						'###仙援###<div class="text center">将其中至多' + get.cnNumber(num) + "张牌置于牌堆顶（先选择的在上）</div>"
					)
					.forResult();
				if (result.bool && result.cards?.length) {
					const cards = result.cards.slice();
					target.$throw(cards.length, 1000);
					await target.lose(cards, ui.cardPile, "insert");
				}
			} else {
				await target.draw(num);
			}
			if (_status.currentPhase !== player) {
				target.clearMark("rexianyuan");
			}
		},
		limit: 3,
		intro: { content: "mark" },
		group: ["rexianyuan_give", "rexianyuan_gain"],
		subSkill: {
			give: {
				audio: "twxianyuan",
				enable: "phaseUse",
				filter(event, player) {
					return player.hasMark("rexianyuan") && game.hasPlayer(i => lib.skill.rexianyuan.subSkill.give.filterTarget(null, player, i));
				},
				filterTarget(card, player, target) {
					return target != player && target.countMark("rexianyuan") < lib.skill.rexianyuan.limit;
				},
				prompt: "将“仙援”标记分配给其他角色",
				async content(event, trigger, player) {
					const target = event.target;
					const gives = Array.from({ length: player.countMark("rexianyuan") }).map((_, i) => get.cnNumber(i + 1) + "枚");
					let give;
					if (gives.length == 1) {
						give = 0;
					} else {
						give = (
							await player
								.chooseControl(gives)
								.set("ai", () => 0)
								.set("prompt", "仙援：将任意枚“仙援”标记分配给" + get.translation(target))
								.forResult()
						).index;
					}
					if (typeof give != "number") {
						return;
					}
					give++;
					player.removeMark("rexianyuan", give);
					target.addMark("rexianyuan", give);
				},
				ai: {
					order: 1,
					result: {
						player: 1,
						target(player, target) {
							const sgn = get.sgn(get.attitude(player, target));
							return sgn == 0 ? 0.5 : sgn * (2 - sgn);
						},
					},
				},
			},
			gain: {
				audio: "twxianyuan",
				trigger: { global: "roundStart" },
				filter(event, player) {
					return player.countMark("rexianyuan") < lib.skill.rexianyuan.limit;
				},
				forced: true,
				locked: false,
				content() {
					player.addMark("rexianyuan", Math.min(2, lib.skill.rexianyuan.limit - player.countMark("rexianyuan")));
				},
			},
		},
	},
	twxianyuan: {
		audio: 2,
		enable: "phaseUse",
		onChooseToUse(event) {
			if (!game.online && event.type == "phase" && !event.twxianyuan) {
				const player = event.player;
				event.set(
					"twxianyuan",
					player
						.getRoundHistory("useSkill", evt => {
							return evt.skill == "twxianyuan";
						})
						.reduce((list, evt) => {
							return list.add(evt.targets[0]);
						}, [])
				);
			}
		},
		filter(event, player) {
			return player.countCards("he") && game.hasPlayer(target => lib.skill.twxianyuan.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return player != target && !get.event().twxianyuan.includes(target);
		},
		filterCard: true,
		selectCard: [1, 2],
		position: "he",
		check(card) {
			return 5 - get.value(card);
		},
		usable: 3,
		lose: false,
		discard: false,
		delay: 0,
		prompt: "将至多两张牌标记为“仙援”并交给一名本轮未以此法交给其牌的角色",
		content() {
			const ID = player.playerid;
			const skill = "twxianyuan_effect",
				skillID = "twxianyuan_" + ID;
			if (!lib.skill[skillID]) {
				game.broadcastAll(skillID => {
					lib.skill[skillID] = { charlotte: true };
					lib.translate[skillID] = "仙援";
				}, skillID);
			}
			if (!target.storage[skill]) {
				target.storage[skill] = {};
			}
			if (!target.storage[skill][player.playerid]) {
				target.storage[skill][player.playerid] = 0;
			}
			target.storage[skill][player.playerid] += cards.length;
			player.give(cards, target).gaintag.add(skillID);
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					const att = get.attitude(player, target);
					return att * (att > 0 ? 2 : 1);
				},
			},
		},
		group: ["twxianyuan_effect", "twxianyuan_remove"],
		subSkill: {
			effect: {
				audio: "twxianyuan",
				trigger: { global: "phaseUseBegin" },
				filter(event, player) {
					return event.player.hasCard(card => card.hasGaintag("twxianyuan_" + player.playerid), "h");
				},
				prompt2(event, player) {
					const num = event.player.storage["twxianyuan_effect"][player.playerid];
					return "观看其手牌并将其中至多" + get.cnNumber(num) + "张牌以任意顺序置于牌堆顶";
				},
				check(event, player) {
					return get.attitude(player, event.player) < 0;
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const target = trigger.player,
						num = target.storage["twxianyuan_effect"][player.playerid];
					const result = await player
						.chooseToMove("仙援：将" + get.translation(target) + "的至多" + get.cnNumber(num) + "张牌以任意顺序置于牌堆顶", true)
						.set("list", [[get.translation(target) + "的手牌", target.getCards("h"), "dcsushou_tag"], ["牌堆顶"]])
						.set("filterOk", moved => {
							const num = get.event().num;
							return moved[1].length >= 1 && moved[1].length <= num;
						})
						.set("num", num)
						.set("processAI", list => {
							const num = get.event().num;
							let cards = list[0][1],
								sgn = get.attitude(get.event().player, get.event().getTrigger().player) > 0 ? 1 : -1;
							cards.sort((a, b) => get.value(a) * sgn - get.value(b) * sgn);
							return [cards.slice(sgn > 0 ? 1 : num, cards.length), cards.slice(0, sgn > 0 ? 1 : num)];
						})
						.forResult();
					if (result.bool) {
						const cards = result.moved[1];
						target.$throw(cards.length, 1000);
						game.log(target, "的" + get.cnNumber(cards.length) + "张牌被置入了", "#y牌堆顶");
						await target.lose(cards.reverse(), ui.cardPile, "insert");
					}
				},
			},
			remove: {
				audio: "twxianyuan",
				trigger: { player: "phaseBegin" },
				filter(event, player) {
					return game.hasPlayer(target => target.hasCard(card => card.hasGaintag("twxianyuan_" + player.playerid), "h"));
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const targets = game.filterPlayer(target => target.hasCard(card => card.hasGaintag("twxianyuan_" + player.playerid), "h"));
					const sum = targets.reduce(
						(num, target) => num + target.countCards("h", card => card.hasGaintag("twxianyuan_" + player.playerid)),
						0
					);
					for (const target of targets) {
						target.removeGaintag("twxianyuan_" + player.playerid);
					}
					await player.draw(sum);
				},
			},
		},
	},
	twlingyin: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			return get.type(event.card) == "trick";
		},
		async content(event, trigger, player) {
			const cards = get.cards(1, true),
				card = cards[0];
			await player.showCards(cards, get.translation(player) + "发动了【灵隐】");
			if (get.color(card, false) == get.color(trigger.card)) {
				await player.gain(cards, "gain2");
			}
			if (get.suit(card, false) == get.suit(trigger.card)) {
				trigger.getParent().excluded.add(player);
				game.log(trigger.card, "对", player, "无效");
			}
			if (get.color(card, false) != get.color(trigger.card)) {
				await game.cardsDiscard(cards);
				player.$throw(cards);
				game.log(cards, "被置入了弃牌堆");
			}
		},
	},
	//幻张郃
	twkuiduan: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (event.card.name != "sha" || event.targets.length != 1) {
				return false;
			}
			return player.countCards("h") + event.target.countCards("h") > 0;
		},
		forced: true,
		logTarget: "target",
		async content(event, trigger, player) {
			const targets = [player, trigger.target];
			for (const target of targets) {
				if (!target.countCards("h")) {
					continue;
				}
				target.addSkill("twkuiduan_card");
				target.addGaintag(target.getCards("h").randomGets(2), "twkuiduan_card");
			}
		},
		mod: {
			ignoredHandcard(card, player) {
				if (card.hasGaintag("twkuiduan_card")) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && card.hasGaintag("twkuiduan_card")) {
					return false;
				}
			},
		},
		group: "twkuiduan_damage",
		subSkill: {
			draw: {
				charlotte: true,
				audio: "twkuiduan",
				forced: true,
				trigger: { global: "damageSource" },
				filter(event, player) {
					return event.card?.storage?.twkuiduan && event.source?.isIn();
				},
				logTarget: "source",
				async content(event, trigger, player) {
					const target = trigger.source;
					if (target?.isIn()) {
						const num = Math.min(
							5,
							player.countCards("h", card => card.hasGaintag("twkuiduan_card") || get.name(card, player) == "sha")
						);
						if (num > 0) {
							await target.draw(num);
						}
					}
				},
			},
			damage: {
				audio: "twkuiduan",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return player.hasUseTarget(get.autoViewAs({ name: "juedou", isCard: true }), false, false);
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget("溃端：视为对一名其他角色使用一张【决斗】", true, (card, player, target) => {
							return player.canUse(get.autoViewAs({ name: "juedou", isCard: true }), target, false, false);
						})
						.set("ai", target => get.effect(target, { name: "juedou" }, get.player(), get.player()))
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					player.addTempSkill("twkuiduan_draw");
					await player.useCard(get.autoViewAs({ name: "juedou", isCard: true, storage: { twkuiduan: true } }), target, false);
				},
				/*trigger: { global: "damageBegin1" },
				filter(event, player) {
					if (!event.source) {
						return false;
					}
					const evtx = event.getParent(2);
					if (
						!evtx ||
						evtx.name != "useCard" ||
						!event.source.hasHistory("lose", evt => {
							if (evt.getParent() != evtx) {
								return false;
							}
							for (var i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("twkuiduan_card")) {
									return true;
								}
							}
						})
					) {
						return false;
					}
					return event.source.countCards("h", card => card.hasGaintag("twkuiduan_card")) > event.player.countCards("h", card => card.hasGaintag("twkuiduan_card"));
				},
				forced: true,
				logTarget: "source",
				content() {
					trigger.num++;
				},*/
			},
			card: {
				charlotte: true,
				mod: {
					aiOrder(player, card, num) {
						if (get.itemtype(card) == "card" && card.hasGaintag("twkuiduan_card")) {
							return num + 1;
						}
					},
					cardname(card, player) {
						if (get.itemtype(card) == "card" && card.hasGaintag("twkuiduan_card")) {
							return "sha";
						}
					},
					cardnature(card, player) {
						if (get.itemtype(card) == "card" && card.hasGaintag("twkuiduan_card")) {
							return false;
						}
					},
				},
			},
		},
	},
};
