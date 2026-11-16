import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqiejian" | "olnishou" | "olchenglie">} */
export const groupSkills = {
	//屈晃
	olqiejian: {
		audio: 2,
		trigger: { global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"] },
		getIndex(event, player) {
			return game
				.filterPlayer(current => {
					if (current.countCards("h")) {
						return false;
					}
					const evt = event.getl(current);
					return evt?.hs?.length && !player.getStorage("olqiejian_ban").includes(current);
				})
				.sortBySeat(_status.currentPhase);
		},
		filter: (event, player, name, target) => target?.isIn(),
		logTarget: (event, player, name, target) => target,
		check: (event, player, name, target) =>
			get.attitude(player, target) > 0 ||
			target.hasCard(card => {
				return get.value(card, target) * get.sgnAttitude(player, target) < -6;
			}, "ej"),
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			await player.draw("nodelay");
			await target.draw();
			const targets = [player, target].filter(i => i.countDiscardableCards(player, "ej"));
			const result = !targets.length
				? { bool: false, targets: [] }
				: await player
						.chooseTarget("切谏：选择一名角色", `弃置你或${get.translation(target)}场上的一张牌；或点击“取消”令你于本轮不能再对其发动此技能`, (card, player, target) => {
							return get.event().targets.includes(target);
						})
						.set("ai", target => {
							const player = get.player();
							const sign = get.sgnAttitude(player, target);
							return (
								6 -
								target
									.getCards("ej")
									.map(i => {
										let val = 0;
										if (get.position(i) == "e") {
											val = get.value(i, target);
										} else {
											val = get.effect(
												player,
												{
													name: i.viewAs || i.name,
													cards: [i],
												},
												target,
												target
											);
										}
										return sign * val;
									})
									.sort((a, b) => a - b)[0]
							);
						})
						.set("targets", targets)
						.forResult();
			if (result.bool) {
				const targetx = result.targets[0];
				if (targetx.countDiscardableCards(player, "ej")) {
					await player.discardPlayerCard(targetx, "ej", true);
				}
			} else {
				player.addTempSkill(event.name + "_ban", "roundStart");
				player.markAuto(event.name + "_ban", [target]);
			}
		},
		subSkill: {
			ban: {
				onremove: true,
				charlotte: true,
				intro: { content: "本轮不能再对$发动〖切谏〗" },
			},
		},
	},
	olnishou: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["loseAsyncAfter", "equipAfter"],
		},
		forced: true,
		filter(event, player) {
			var phaseName;
			for (var name of lib.phaseName) {
				var evt = event.getParent(name);
				if (!evt || evt.name != name) {
					continue;
				}
				phaseName = name;
			}
			var cards = event.getd(player, "es");
			return (
				cards.length &&
				(cards.some(card => {
					if (get.position(card, true) != "d") {
						return false;
					}
					return player.hasUseTarget(get.autoViewAs({ name: "shandian" }, [card]));
				}) ||
					(phaseName && !player.hasSkill("olnishou_swap")))
			);
		},
		direct: true,
		content() {
			"step 0";
			var cards = trigger.getd(player, "es");
			var choices = [];
			var choiceList = ["将" + (cards.length ? get.translation(cards[0]) : "这些牌中第一张能当【闪电】对你使用的牌") + "当【闪电】使用", "本阶段结束时，你与一名手牌数最少的角色交换手牌"];
			cards = cards.filter(card => {
				if (get.position(card, true) != "d") {
					return false;
				}
				return player.hasUseTarget(get.autoViewAs({ name: "shandian" }, [card]));
			});
			event.cards = cards;
			var phaseName;
			for (var name of lib.phaseName) {
				var evt = trigger.getParent(name);
				if (!evt || evt.name != name) {
					continue;
				}
				phaseName = name;
			}
			if (cards.length) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			if (phaseName && !player.hasSkill("olnishou_swap")) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			event.phaseName = phaseName;
			if (!choices.length) {
				event.finish();
			} else {
				player
					.chooseControl(choices)
					.set("choiceList", choiceList)
					.set("prompt", "泥首：选择一项")
					.set("ai", (event, player) => {
						if (get.event().controls.length == 1) {
							return 0;
						} else if (
							game.hasPlayer(current => {
								return current != player && current.isMinHandcard() && get.attitude(player, current) > 0;
							})
						) {
							return 1;
						}
						return 0;
					});
			}
			"step 1";
			player.logSkill("olnishou");
			game.log(player, "选择了", "#y" + result.control);
			if (result.control == "选项一") {
				var card = cards[0];
				player.chooseUseTarget({ name: "shandian" }, [card], true);
			} else {
				var name = event.phaseName;
				player.storage.olnishou_swap = name;
				player.addTempSkill("olnishou_swap", name + "After");
			}
		},
		ai: {
			neg: true,
		},
		subSkill: {
			swap: {
				audio: "olnishou",
				charlotte: true,
				forced: true,
				direct: true,
				onremove: true,
				trigger: {
					global: ["phaseZhunbeiEnd", "phaseJudgeEnd", "phaseDrawEnd", "phaseUseEnd", "phaseDiscardEnd", "phaseJieshuEnd"],
				},
				content() {
					"step 0";
					if (trigger.name != player.storage.olnishou_swap || !event.player.isIn()) {
						player.removeSkill("olnishou_swap");
						event.finish();
						return;
					}
					player.chooseTarget("泥首：与一名手牌数最少的角色交换手牌", true, (card, player, target) => {
						return target.isMinHandcard();
					});
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						player.logSkill("olnishou_swap", target);
						if (target != player) {
							player.swapHandcards(target);
						}
					}
					"step 2";
					player.removeSkill("olnishou_swap");
				},
			},
		},
	},
	//马承
	olchenglie: {
		audio: 2,
		trigger: { player: "useCard2" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !event.targets.includes(current) && player.canUse(event.card, current);
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "为" + get.translation(trigger.card) + "多指定至多两个目标，并发动后续效果", [1, 2], (card, player, target) => {
					var evt = _status.event.getTrigger();
					return !evt.targets.includes(target) && player.canUse(evt.card, target);
				})
				.set("ai", function (target) {
					var player = _status.event.player,
						evt = _status.event.getTrigger();
					return get.effect(target, evt.card, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			let { targets } = event;
			trigger.targets.addArray(targets);
			targets = trigger.targets;
			let cards = get.cards(targets.length, true);
			await player.showCards(cards, get.translation(player) + "发动了【骋烈】", true).set("clearArena", false);
			const hs = player.getCards("h");
			const next = player.chooseToMove("骋烈：是否交换一张牌？");
			next.set("list", [
				["〖骋烈〗展示", cards, "olchenglie"],
				["你的手牌", hs],
			]);
			next.set("filterMove", function (from, to, moved) {
				if (typeof to == "number") {
					return false;
				}
				var player = _status.event.player;
				var hs = player.getCards("h");
				var changed = hs.filter(function (card) {
					return !moved[1].includes(card);
				});
				var changed2 = moved[1].filter(function (card) {
					return !hs.includes(card);
				});
				if (changed.length < 1) {
					return true;
				}
				var pos1 = moved[0].includes(from.link) ? 0 : 1,
					pos2 = moved[0].includes(to.link) ? 0 : 1;
				if (pos1 == pos2) {
					return true;
				}
				if (pos1 == 0) {
					if (changed.includes(from.link)) {
						return true;
					}
					return changed2.includes(to.link);
				}
				if (changed2.includes(from.link)) {
					return true;
				}
				return changed.includes(to.link);
			});
			next.set("processAI", function (list) {
				var cards1 = list[0][1].slice(),
					cards2 = list[1][1].slice();
				var card1 = cards1.sort((a, b) => get.value(b) - get.value(a))[0];
				var card2 = cards2.sort((a, b) => get.value(a) - get.value(b))[0];
				if (card1 && card2 && get.value(card1) > get.value(card2)) {
					cards1.remove(card1);
					cards2.remove(card2);
					cards1.push(card2);
					cards2.push(card1);
				}
				return [cards1, cards2];
			});
			const result = await next.forResult();
			if (result.moved?.length) {
				const { moved } = result;
				let card1, card2;
				for (const i of moved[0]) {
					if (!cards.includes(i)) {
						card1 = i;
					}
				}
				for (const i of moved[1]) {
					if (!hs.includes(i)) {
						card2 = i;
					}
				}
				if (card1 && card2) {
					player.$throw(1, 1000);
					cards.forEach((i, ind, arr) => {
						if (i == card2) {
							arr[ind] = card1;
						}
					});
					/*await player
						.lose(card1, ui.cardPile)
						.set("insert_index", event => event.cardx)
						.set("cardx", card2);*/
					await player.lose(card1, ui.ordering);
					await player.gain(card2, "draw");
					game.log(player, "交换了一张牌");
				}
				game.broadcastAll(ui.clear);
				//await game.cardsGotoOrdering(cards);
				const given = [];
				const cardsx = cards.slice();
				while (targets.some(i => !given.includes(i) && i.isIn()) && cardsx.length) {
					const result = await player
						.chooseButtonTarget({
							createDialog: ["骋烈：将这些牌置于目标角色的武将牌上", cardsx],
							forced: true,
							filterButton: true,
							filterTarget(card, player, target) {
								return !get.event().given.includes(target) && get.event().targets.includes(target);
							},
							given: given,
							targets: targets,
							ai2(target) {
								const color = get.color(ui.selected.buttons[0].link),
									player = _status.event.player;
								const evt = _status.event.getTrigger();
								if (color == "red") {
									const eff = get.effect(target, evt.card, player, target),
										att = get.attitude(player, target);
									if (eff >= 0 && att < 0) {
										return -1;
									}
									if (eff < 0 && att < 0 && target.hasCard(card => ["shan", "caochuan"].includes(get.name(card)), "hs")) {
										return 10;
									}
								}
								return 1;
							},
						})
						.forResult();
					if (result.targets?.length && result.links?.length) {
						const {
							targets: [target],
							links: [card],
						} = result;
						player.line(target);
						given.push(target);
						const next = target.addToExpansion(card);
						next.gaintag.add(event.name);
						player.addTempSkill("olchenglie_effect", "phaseUseAfter");
						trigger.card.storage ??= {};
						trigger.card.storage.olchenglie = player;
						target.storage.olchenglie_viewer = player;
						cardsx.remove(card);
						const cardx = player == game.me || player.isUnderControl() ? card : 1;
						player.$give(cardx, target, false);
						await next;
					}
					await game.delayx();
				}
			}
		},
		marktext: "骋",
		intro: {
			markcount: "expansion",
			mark(dialog, content, player) {
				var content = player.getExpansions("olchenglie");
				if (content && content.length) {
					if (game.me == player.storage.olchenglie_viewer) {
						dialog.addAuto(content);
					} else {
						return "有" + get.cnNumber(content.length) + "张扣置的“骋烈”牌";
					}
				}
			},
			content(content, player) {
				var content = player.getExpansions("olchenglie");
				if (content && content.length) {
					if (game.me == player.storage.olchenglie_viewer) {
						return get.translation(content);
					}
					return "有" + get.cnNumber(content.length) + "张扣置的“骋烈”牌";
				}
			},
		},
		subSkill: {
			effect: {
				trigger: { global: "useCardAfter" },
				forced: true,
				charlotte: true,
				forceDie: true,
				popup: false,
				filter(event, player) {
					return event.card.storage && event.card.storage.olchenglie;
				},
				async content(event, trigger, player) {
					const targets = game
						.filterPlayer(current => {
							var cards = current.getExpansions("olchenglie");
							return cards.some(i => get.color(i, false) == "red");
						})
						.sortBySeat();
					const togive = trigger.card.storage.olchenglie;
					if (targets?.length && togive.isIn()) {
						await game.doAsyncInOrder(targets, async target => {
							player.line(target);
							if (
								target.hasHistory("useCard", evt => {
									return evt.respondTo && evt.respondTo[1] == trigger.card;
								})
							) {
								return target.chooseToGive("骋烈：交给" + get.translation(togive) + "一张牌", true, "he", player);
							} else {
								return target.recover();
							}
						});
					}
					await game.doAsyncInOrder(
						game.filterPlayer(target => {
							return target.countExpansions("olchenglie");
						}),
						async target => {
							delete target.storage.olchenglie_viewer;
							return target.loseToDiscardpile(target.getExpansions("olchenglie"));
						}
					);
				},
			},
		},
	},
};
