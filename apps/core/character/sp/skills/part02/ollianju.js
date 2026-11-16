import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "ollianju" | "olsilv" | "relianju" | "resilv">} */
export const groupSkills = {
	//李婉
	ollianju: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			var history = player.getHistory("useCard");
			if (!history.length) {
				return false;
			}
			var evt = history[history.length - 1];
			return evt.cards && evt.cards.filterInD("d").length;
		},
		direct: true,
		content() {
			"step 0";
			var history = player.getHistory("useCard");
			var evt = history[history.length - 1];
			event.evt = evt;
			player
				.chooseTarget(get.prompt("ollianju"), "令一名角色获得" + get.translation(evt.cards.filterInD("d")) + "并记录" + get.translation(evt.card.name), lib.filter.notMe)
				.set("ai", target => {
					var player = _status.event.player,
						att = get.attitude(player, target);
					var cards = _status.event.cards;
					if (cards.filter(card => get.name(card, false) == "du").length >= Math.ceil(cards.length / 2)) {
						att *= -1;
					}
					if (target.skipList.includes("phaseUse") || target.hasJudge("lebu")) {
						return att / 20;
					}
					return att;
				})
				.set("cards", evt.cards.filterInD("d"));
			"step 1";
			if (result.bool) {
				var evt = event.evt;
				var target = result.targets[0];
				player.logSkill("oliandui", target);
				target.gain(evt.cards.filterInD("d"), "gain2");
				player.addSkill("ollianju_effect");
				player.storage.ollianju = evt.card.name;
				player.markSkill("ollianju");
				if (!player.storage.ollianju_effect[target.playerid]) {
					player.storage.ollianju_effect[target.playerid] = [];
				}
				player.storage.ollianju_effect[target.playerid].add(evt.card.name);
			}
		},
		onunmark: true,
		intro: {
			content(storage, player) {
				var str = "当前最后一次记录牌名：" + get.translation(storage);
				if (player.storage.ollianju_effect) {
					for (var i in player.storage.ollianju_effect) {
						var target = game.findPlayer(target => target.playerid == i);
						if (!i) {
							continue;
						}
						str += "<br>";
						str += get.translation(target) + "的下个结束阶段，其可令你获得其本回合使用的最后一张牌对应的所有位于弃牌堆的实体牌";
						str += "，然后若此牌名为" + get.translation(player.storage.ollianju_effect[i]) + "，则你失去1点体力，否则你可以视为使用" + get.translation(player.storage.ollianju_effect[i]);
					}
				}
				return str;
			},
		},
		subSkill: {
			effect: {
				init(player) {
					if (!player.storage.ollianju_effect) {
						player.storage.ollianju_effect = {};
					}
				},
				charlotte: true,
				trigger: { global: ["phaseJieshuBegin", "die"] },
				filter(event, player) {
					return player.storage.ollianju_effect[event.player.playerid];
				},
				direct: true,
				content() {
					"step 0";
					if (trigger.name == "phaseJieshu") {
						event.list = player.storage.ollianju_effect[trigger.player.playerid];
					}
					delete player.storage.ollianju_effect[trigger.player.playerid];
					var history = trigger.player.getHistory("useCard");
					var evt = history[history.length - 1];
					event.evt = evt;
					if (trigger.name == "die" || !history.length || !evt.cards || !evt.cards.filterInD("d").length) {
						event.finish();
					}
					"step 1";
					var evt = event.evt;
					trigger.player.chooseBool(get.prompt("ollianju", player), "令" + get.translation(player) + "获得" + get.translation(evt.cards.filterInD("d")) + (event.list.includes(evt.card.name) ? "，然后" + get.translation(player) + "失去1点体力" : "")).set("choice", get.attitude(trigger.player, player) > 0 && (!event.list.includes(evt.card.name) || player.getHp() > 1));
					"step 2";
					if (result.bool) {
						var evt = event.evt,
							cards = evt.cards.filterInD("d");
						trigger.player.line(player);
						player.gain(cards, "gain2");
						if (event.list.includes(evt.card.name)) {
							player.loseHp();
						} else {
							var card = {
								name: evt.card.name,
								isCard: true,
							};
							if (player.hasUseTarget(card)) {
								player.chooseUseTarget(card, false);
							}
						}
					}
				},
			},
		},
	},
	olsilv: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "gainAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			var name = player.storage.ollianju;
			if (!name) {
				return false;
			}
			const list = player.getStorage("olsilv_used");
			if (event.getg) {
				return event.getg(player).some(card => card.name == name) && !list.includes("gain");
			}
			return event.getl(player).cards2.some(card => card.name == name) && !list.includes("lose");
		},
		forced: true,
		content() {
			"step 0";
			player.addTempSkill("olsilv_used");
			player.markAuto("olsilv_used", trigger.getg ? "gain" : "lose");
			if (!trigger.visible) {
				var cards,
					name = player.storage.ollianju;
				if (trigger.getg) {
					cards = trigger.getg(player).filter(card => card.name == name);
				} else {
					cards = trigger.getl(player).cards2.filter(card => card.name == name);
				}
				if (cards.length) {
					player.showCards(cards, get.translation(player) + "发动了【思闾】");
				}
			}
			"step 1";
			player.draw();
		},
		ai: { combo: "ollianju" },
		subSkill: {
			used: { charlotte: true },
		},
	},
	relianju: {
		audio: "ollianju",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.hasHistory("useCard", evt => {
				return (evt.cards || []).some(card => get.position(card, true) == "d");
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名其他角色获得你本回合使用的且进入弃牌堆的至多两张颜色相同的牌", lib.filter.notMe)
				.set("ai", target => {
					const player = get.event().player;
					let att = get.attitude(_status.event.player, target);
					if (target.hasJudge("lebu")) {
						att /= 2;
					}
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					return att / (1 + get.distance(player, target, "absolute"));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const cards = player
					.getHistory("useCard", evt => {
						return (evt.cards || []).some(card => get.position(card, true) == "d");
					})
					.reduce((sum, evt) => {
						return sum.addArray(evt.cards.filter(card => get.position(card, true) == "d"));
					}, []),
				target = event.targets[0];
			const result = await player
				.chooseButton(["联句：选择令" + get.translation(target) + "获得的牌", cards], [1, 2], true)
				.set("filterButton", button => {
					return !ui.selected.buttons.some(but => get.color(but.link) != get.color(button.link));
				})
				.set("ai", button => {
					return get.value(button.link, get.event().target);
				})
				.set("target", target)
				.forResult();
			if (result.bool) {
				const color = get.color(result.links[0], false);
				const next = target.gain(result.links, "gain2");
				next.gaintag.add("resilv");
				await next;
				player
					.when({ global: "phaseJieshuBegin" })
					.filter(
						evt => evt.player == target /*&&
							target.hasHistory("useCard", evt => {
								return (evt.cards || []).some(card => get.position(card, true) == "d" && get.color(card) != color);
							})*/
					)
					.step(async (event, trigger, player) => {
						const cards = trigger.player
							.getHistory("useCard", evt => {
								return (evt.cards || []).some(card => get.position(card, true) == "d" && get.color(card) != color);
							})
							.reduce((sum, evt) => {
								return sum.addArray(evt.cards.filter(card => get.position(card, true) == "d" && get.color(card) != color));
							}, []);
						if (!cards?.length) {
							return;
						}
						const result = await player
							.chooseButton(["联句：请选择获得的牌", cards], [1, 2], true)
							.set("filterButton", button => {
								return !ui.selected.buttons.some(but => get.color(but.link) != get.color(button.link));
							})
							.set("ai", button => {
								return get.value(button.link, get.event().target);
							})
							.forResult();
						if (result?.bool && result?.links?.length) {
							const next = player.gain(result.links, "gain2");
							next.gaintag.add("resilv");
							await next;
						}
					});
			}
		},
	},
	resilv: {
		audio: "olsilv",
		trigger: { player: "damageEnd" },
		forced: true,
		async content(event, trigger, player) {
			const next = player.draw();
			next.gaintag.add("resilv");
			await next;
		},
		//group: "resilv_restore",
		init(player, skill) {
			player.addSkill(`${skill}_restore`);
		},
		onremove(player, skill) {
			player.removeSkill(`${skill}_restore`);
		},
		subSkill: {
			restore: {
				audio: "olsilv",
				charlotte: true,
				trigger: { global: ["loseAfter", "loseAsyncAfter"] },
				filter(event, player) {
					if (event.type != "discard" || event.getlx === false) {
						return false;
					}
					if (event.name == "lose") {
						if (!event.player.isIn()) {
							return false;
						}
						return event.cards2.some(card => {
							return (event.gaintag_map[card.cardid] || []).includes("resilv") && get.position(card, true) == "d";
						});
					}
					return game.hasPlayer(target => {
						return target.hasHistory("lose", evt => {
							if (evt.getParent() != event || evt.position != ui.discardPile) {
								return false;
							}
							return evt.cards2.some(card => {
								if (get.position(card, true) != "d") {
									return false;
								}
								return (evt.gaintag_map[card.cardid] || []).includes("resilv");
							});
						});
					});
				},
				forced: true,
				logTarget(event, player) {
					if (event.name == "lose") {
						return event.player;
					}
					return game
						.filterPlayer(target => {
							return target.hasHistory("lose", evt => {
								if (evt.getParent() != event || evt.position != ui.discardPile) {
									return false;
								}
								return evt.cards2.some(card => {
									if (get.position(card, true) != "d") {
										return false;
									}
									return evt.gaintag_map[card.cardid] && evt.gaintag_map[card.cardid].includes("resilv");
								});
							});
						})
						.sortBySeat();
				},
				async content(event, trigger, player) {
					if (trigger.name == "lose") {
						await trigger.player.gain(
							trigger.cards2.filter(card => {
								return (trigger.gaintag_map[card.cardid] || []).includes("resilv") && get.position(card, true) == "d";
							}),
							"gain2"
						);
					} else {
						for (const target of lib.skill.resilv_restore.logTarget(trigger, player)) {
							await target.gain(
								target
									.getHistory("lose", evt => {
										if (evt.getParent() != trigger || evt.position != ui.discardPile) {
											return false;
										}
										return evt.cards2.some(card => {
											if (get.position(card, true) != "d") {
												return false;
											}
											return (evt.gaintag_map[card.cardid] || []).includes("resilv");
										});
									})
									.reduce((sum, evt) => {
										return sum.addArray(
											evt.cards2.filter(card => {
												if (get.position(card, true) != "d") {
													return false;
												}
												return (evt.gaintag_map[card.cardid] || []).includes("resilv");
											})
										);
									}, []),
								"gain2"
							);
						}
					}
				},
			},
		},
	},
};
