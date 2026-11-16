import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczhubi" | "dcliuzhuan" | "suizheng" | "dcshuangren">} */
export const groupSkills = {
	//刘巴
	dczhubi: {
		audio: 2,
		trigger: {
			global: ["loseAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return false;
			}
			for (var i of event.cards) {
				if (get.suit(i, event.player) == "diamond" && get.position(i) === "d") {
					return true;
				}
			}
			return false;
		},
		prompt2: "检索一张【无中生有】并置于牌堆顶",
		async content(event, trigger, player) {
			const card = get.cardPile(function (card) {
				return card.name == "wuzhong" && get.suit(card) != "diamond";
			});
			if (card) {
				game.log(player, "将", card, "置于牌堆顶");
				await game.cardsGotoPile(card, "insert");
				await game.delayx();
			}
		},
	},
	dcliuzhuan: {
		audio: 2,
		group: ["dcliuzhuan_mark", "dcliuzhuan_gain"],
		mod: {
			targetEnabled(card) {
				if (card.cards) {
					for (var i of card.cards) {
						if (i.hasGaintag("dcliuzhuan_tag")) {
							return false;
						}
					}
				} else if (get.itemtype(card) == "card") {
					if (card.hasGaintag("dcliuzhuan_tag")) {
						return false;
					}
				}
			},
		},
		subSkill: {
			gain: {
				audio: "dcliuzhuan",
				trigger: { global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter"] },
				forced: true,
				logTarget: () => _status.currentPhase,
				filter(event, player) {
					var current = _status.currentPhase;
					if (!current) {
						return false;
					}
					if (event.name == "cardsDiscard") {
						var evtx = event.getParent();
						if (evtx.name != "orderingDiscard") {
							return false;
						}
						var evtx2 = evtx.relatedEvent || evtx.getParent();
						return current.hasHistory("lose", function (evtx3) {
							var evtx4 = evtx3.relatedEvent || evtx3.getParent();
							if (evtx2 != evtx4) {
								return false;
							}
							for (var i in evtx3.gaintag_map) {
								if (evtx3.gaintag_map[i].includes("dcliuzhuan_tag")) {
									return true;
								}
							}
						});
						//return false;
					} else if (event.name == "lose") {
						if (event.player != current || event.position != ui.discardPile) {
							return false;
						}
						for (var i in event.gaintag_map) {
							if (event.gaintag_map[i].includes("dcliuzhuan_tag")) {
								return true;
							}
						}
						return false;
					}
					return current.hasHistory("lose", function (evt) {
						if (evt.getParent() != event || evt.position != ui.discardPile) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dcliuzhuan_tag")) {
								return true;
							}
						}
					});
				},
				async content(event, trigger, player) {
					let cards;
					const current = _status.currentPhase;
					if (trigger.name == "lose") {
						cards = trigger.hs.filter(function (i) {
							return trigger.gaintag_map[i.cardid] && trigger.gaintag_map[i.cardid].includes("dcliuzhuan_tag") && get.position(i, true) == "d";
						});
					} else if (trigger.name == "cardsDiscard") {
						const evtx = trigger.getParent();
						const evtx2 = evtx.relatedEvent || evtx.getParent();
						let bool = false;
						const history = current.getHistory("lose", function (evtx3) {
							const evtx4 = evtx3.relatedEvent || evtx3.getParent();
							if (evtx2 != evtx4) {
								return false;
							}
							for (const i in evtx3.gaintag_map) {
								if (evtx3.gaintag_map[i].includes("dcliuzhuan_tag")) {
									return true;
								}
							}
						});
						cards = trigger.cards.filter(function (i) {
							for (const evt of history) {
								if (evt.gaintag_map[i.cardid] && evt.gaintag_map[i.cardid].includes("dcliuzhuan_tag") && get.position(i, true) == "d") {
									return true;
								}
							}
							return false;
						});
					} else {
						cards = [];
						current.getHistory("lose", function (evt) {
							if (evt.getParent() != trigger || evt.position != ui.discardPile) {
								return false;
							}
							for (const card of evt.hs) {
								if (get.position(card, true) != "d") {
									continue;
								}
								const i = card.cardid;
								if (evt.gaintag_map[i] && evt.gaintag_map[i].includes("dcliuzhuan_tag")) {
									cards.push(card);
								}
							}
						});
					}
					if (cards && cards.length > 0) {
						await player.gain(cards, "gain2");
					}
				},
			},
			mark: {
				trigger: { global: "gainBegin" },
				forced: true,
				popup: false,
				silent: true,
				lastDo: true,
				filter(event, player) {
					if (player == event.player || event.player != _status.currentPhase) {
						return false;
					}
					var evt = event.getParent("phaseDraw");
					if (evt && evt.name == "phaseDraw") {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					trigger.gaintag.add("dcliuzhuan_tag");
					trigger.player.addTempSkill("dcliuzhuan_tag");
				},
			},
			tag: {
				charlotte: true,
				onremove: (player, skill) => player.removeGaintag(skill),
			},
		},
	},
	//张勋
	suizheng: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名角色下回合内获得〖随征〗效果")
				.set("", target => {
					const player = get.player();
					const attitude = get.attitude(player, target);
					if (target.hasJudge("lebu")) {
						return attitude / 2;
					}
					return attitude * get.threaten(target) * Math.sqrt(2 + (player === target ? player.countCards("h", "sha") * 2 : target.countCards("h")));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			target.addMark("suizheng_effect", 2, false);
			target.markAuto("suizheng_source", [player]);
			target.addTempSkill("suizheng_effect", {
				player: player === target ? "phaseJieshuBefore" : "phaseAfter",
			});
		},
		subSkill: {
			effect: {
				audio: "suizheng",
				charlotte: true,
				mod: {
					targetInRange(card) {
						if (card.name == "sha") {
							return true;
						}
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("suizheng_effect");
						}
					},
				},
				trigger: { player: "phaseUseEnd" },
				forced: true,
				popup: false,
				filter(event, player) {
					const list = player.getStorage("suizheng_source");
					if (!list.some(current => current.isIn())) {
						return false;
					}
					return player.hasHistory("sourceDamage", evt => {
						return evt.player.isIn() && evt.getParent("phaseUse") == event;
					});
				},
				async content(event, trigger, player) {
					const targets = player.getStorage("suizheng_source").slice(0).sortBySeat();
					event.targets = targets;
					for (const target of targets) {
						if (!target.isIn()) {
							continue;
						}
						const list = player
							.getHistory("sourceDamage", evt => {
								return evt.player.isIn() && evt.getParent("phaseUse") == trigger && target.canUse({ name: "sha", isCard: true }, evt.player, false);
							})
							.map(evt => evt.player)
							.toUniqued();
						if (!list.length) {
							continue;
						}
						const result = await target
							.chooseTarget("随征：是否对一名角色使用【杀】？", (card, player, target) => {
								return get.event().targets.includes(target);
							})
							.set("targets", list)
							.set("ai", target => {
								const player = get.player();
								return get.effect(target, { name: "sha" }, player, player);
							})
							.forResult();
						if (result?.bool) {
							await target.useCard({ name: "sha", isCard: true }, result.targets[0], false);
						}
					}
				},
				onremove(player) {
					delete player.storage.suizheng_effect;
					delete player.storage.suizheng_source;
				},
				intro: { content: `使用【杀】无距离限制且次数上限+#` },
			},
		},
	},
	//纪灵
	dcshuangren: {
		audio: "shuangren",
		trigger: { player: "phaseUseBegin" },
		direct: true,
		preHidden: true,
		filter(event, player) {
			return (
				player.countCards("h") > 0 &&
				game.hasPlayer(function (current) {
					return current != player && player.canCompare(current);
				})
			);
		},
		async content(event, trigger, player) {
			var goon;
			if (player.needsToDiscard() > 1) {
				goon = player.hasCard(function (card) {
					return card.number > 10 && get.value(card) <= 5;
				});
			} else if (player.hasSha()) {
				goon = player.hasCard(function (card) {
					return (card.number >= 9 && get.value(card) <= 5) || get.value(card) <= 3;
				});
			} else {
				goon = player.hasCard(function (card) {
					return get.value(card) <= 5;
				});
			}
			const compareTargetResult = await player
				.chooseTarget(get.prompt2("dcshuangren"), function (card, player, target) {
					return player.canCompare(target);
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					if (_status.event.goon && get.attitude(player, target) < 0) {
						return get.effect(target, { name: "sha" }, player, player);
					}
					return 0;
				})
				.set("goon", goon)
				.setHiddenSkill(event.name)
				.forResult();
			if (!compareTargetResult.bool) {
				return;
			}
			const target = compareTargetResult.targets[0];
			player.logSkill("dcshuangren", target);
			const compareResult = await player.chooseToCompare(target).forResult();
			if (!compareResult.bool) {
				player.addTempSkill("dcshuangren_debuff", "phaseUseAfter");
				return;
			}
			if (
				game.hasPlayer(function (current) {
					if (target == current || target.group != current.group) {
						return false;
					}
					return player.canUse("sha", current, false);
				})
			) {
				var str = "请选择视为使用【杀】的目标";
				var str2 = "操作提示：选择一名角色B，或选择包含A（" + get.translation(target) + "）在内的两名角色A和B（B的势力需为" + get.translation(target.group) + "势力）";
				const useResult = await player
					.chooseTarget([1, 2], str, str2, true, function (card, player, target) {
						if (!player.canUse("sha", target, false)) {
							return false;
						}
						var current = _status.event.target;
						if (target == current) {
							return true;
						}
						if (target.group != current.group) {
							return false;
						}
						if (!ui.selected.targets.length) {
							return true;
						}
						return ui.selected.targets[0] == current;
						//return current==target;
					})
					.set("ai", function (target) {
						var player = _status.event.player;
						return get.effect(target, { name: "sha" }, player, player);
					})
					.set("target", target)
					.set("complexTarget", true)
					.forResult();
				if (useResult.bool && useResult.targets && useResult.targets.length) {
					await player.useCard({ name: "sha", isCard: true }, useResult.targets, false);
				}
			} else {
				await player.useCard({ name: "sha", isCard: true }, target, false);
			}
		},
		subSkill: {
			debuff: {
				charlotte: true,
				mod: {
					cardEnabled(card) {
						if (card.name == "sha") {
							return false;
						}
					},
				},
			},
		},
	},
};
