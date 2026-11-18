import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "weijing" | "zishu" | "xinyingyuan" | "yingyuan" | "shuimeng" | "qianya">} */
export const groupSkills = {
	weijing: {
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			if (event.type == "wuxie" || player.hasSkill("weijing_used")) {
				return false;
			}
			for (var name of ["sha", "shan"]) {
				if (event.filterCard({ name: name, isCard: true }, player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var vcards = [];
				for (var name of ["sha", "shan"]) {
					var card = { name: name, isCard: true };
					if (event.filterCard(card, player, event)) {
						vcards.push(["基本", "", name]);
					}
				}
				var dialog = ui.create.dialog("卫境", [vcards, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			backup(links, player) {
				return {
					filterCard: () => false,
					selectCard: -1,
					viewAs: {
						name: links[0][2],
						isCard: true,
					},
					popname: true,
					precontent() {
						player.logSkill("weijing");
						player.addTempSkill("weijing_used", "roundStart");
					},
				};
			},
			prompt(links, player) {
				return "卫境：视为使用一张【" + get.translation(links[0][2]) + "】";
			},
		},
		ai: {
			order(item, player) {
				var player = _status.event.player;
				var event = _status.event;
				if (event.filterCard({ name: "sha" }, player, event)) {
					if (
						!player.hasShan() &&
						!game.hasPlayer(function (current) {
							return player.canUse("sha", current) && current.hp == 1 && get.effect(current, { name: "sha" }, player, player) > 0;
						})
					) {
						return 0;
					}
					return 2.95;
				} else {
					var player = _status.event.player;
					if (player.hasSkill("qingzhong_give")) {
						return 2.95;
					}
					return 3.15;
				}
			},
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond" || player.hasSkill("weijing_used")) {
					return false;
				}
			},
			result: {
				player: 1,
			},
		},
		subSkill: {
			used: {
				mark: true,
				intro: {
					content: "本轮已发动",
				},
			},
		},
	},
	zishu: {
		audio: 2,
		locked: true,
		subSkill: {
			discard: {
				trigger: { global: "phaseEnd" },
				audio: "zishu",
				forced: true,
				filter(event, player) {
					if (_status.currentPhase != player) {
						var he = player.getCards("h");
						var bool = false;
						player.getHistory("gain", function (evt) {
							if (!bool && evt && evt.cards) {
								for (var i = 0; i < evt.cards.length; i++) {
									if (he.includes(evt.cards[i])) {
										bool = true;
									}
									break;
								}
							}
						});
						return bool;
					}
					return false;
				},
				content() {
					var he = player.getCards("h");
					var list = [];
					player.getHistory("gain", function (evt) {
						if (evt && evt.cards) {
							for (var i = 0; i < evt.cards.length; i++) {
								if (he.includes(evt.cards[i])) {
									list.add(evt.cards[i]);
								}
							}
						}
					});
					player.$throw(list, 1000);
					player.lose(list, ui.discardPile, "visible");
					game.log(player, "将", list, "置入弃牌堆");
				},
			},
			mark: {
				trigger: {
					player: "gainBegin",
					global: "phaseBeginStart",
				},
				silent: true,
				filter(event, player) {
					return event.name != "gain" || player != _status.currentPhase;
				},
				content() {
					if (trigger.name == "gain") {
						trigger.gaintag.add("zishu");
					} else {
						player.removeGaintag("zishu");
					}
				},
			},
			draw: {
				trigger: {
					player: "gainAfter",
					global: "loseAsyncAfter",
				},
				audio: "zishu",
				forced: true,
				filter(event, player) {
					if (_status.currentPhase != player || event.getg(player).length == 0) {
						return false;
					}
					return event.getParent(2).name != "zishu_draw";
				},
				content() {
					player.draw("nodelay");
				},
			},
		},
		ai: {
			threaten: 1.2,
			nogain: 1,
			skillTagFilter(player) {
				return player != _status.currentPhase;
			},
		},
		group: ["zishu_draw", "zishu_discard", "zishu_mark"],
	},
	xinyingyuan: {
		audio: "yingyuan",
		trigger: { player: "useCardAfter" },
		direct: true,
		filter(event, player) {
			if (_status.currentPhase != player) {
				return false;
			}
			var type = get.type(event.card, "trick");
			return (
				player.getHistory("custom", function (evt) {
					return evt.xinyingyuan_name == type;
				}).length == 0
			);
		},
		content() {
			"step 0";
			event.type = get.type(trigger.card, "trick");
			player
				.chooseTarget(get.prompt("xinyingyuan"), "令一名其他角色随机从牌堆中获得一张" + get.translation(event.type) + "牌", function (card, player, target) {
					return target != player;
				})
				.set("ai", function (target) {
					var att = get.attitude(_status.event.player, target);
					if (att < 3) {
						return 0;
					}
					if (target.hasJudge("lebu")) {
						att /= 2;
					}
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					return att / (1 + get.distance(player, target, "absolute"));
				});
			"step 1";
			if (result.bool) {
				player.logSkill("xinyingyuan", result.targets[0]);
				var card = get.cardPile2(function (cardx) {
					return get.type(cardx, "trick") == event.type;
				}, "random");
				if (card) {
					result.targets[0].gain(card, "log", "gain2");
				}
				player.getHistory("custom").push({ xinyingyuan_name: event.type });
			}
		},
	},
	yingyuan: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		direct: true,
		filter(event, player) {
			if (_status.currentPhase != player) {
				return false;
			}
			if (
				player.getHistory("custom", function (evt) {
					return evt.yingyuan_name == event.card.name;
				}).length > 0
			) {
				return false;
			}
			return event.cards.filterInD().length > 0;
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("yingyuan"), "将" + get.translation(trigger.cards) + "交给一名其他角色", function (card, player, target) {
					return target != player;
				})
				.set("ai", function (target) {
					if (target.hasJudge("lebu")) {
						return 0;
					}
					let att = get.attitude(_status.event.player, target),
						name = _status.event.cards[0].name;
					if (att < 3) {
						return 0;
					}
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					if (name === "sha" && target.hasSha()) {
						att /= 5;
					}
					if (name === "wuxie" && target.needsToDiscard(_status.event.cards)) {
						att /= 5;
					}
					return att / (1 + get.distance(player, target, "absolute"));
				})
				.set("cards", trigger.cards);
			"step 1";
			if (result.bool) {
				player.logSkill("yingyuan", result.targets[0]);
				result.targets[0].gain(trigger.cards.filterInD(), "gain2");
				player.getHistory("custom").push({ yingyuan_name: trigger.card.name });
			}
		},
	},
	shuimeng: {
		audio: 2,
		trigger: { player: "phaseUseAfter" },
		direct: true,
		filter(event, player) {
			return player.countCards("h");
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("shuimeng"), function (card, player, target) {
					return player.canCompare(target);
				})
				.set("ai", function (target) {
					if (!_status.event.goon) {
						return 0;
					}
					return -get.attitude(_status.event.player, target);
				})
				.set(
					"goon",
					player.needsToDiscard() ||
						player.hasCard(function (card) {
							var val = get.value(card);
							if (val < 0) {
								return true;
							}
							if (val <= 5) {
								return card.number >= 11;
							}
							if (val <= 6) {
								return card.number >= 12;
							}
							return false;
						})
				);
			"step 1";
			if (result.bool) {
				player.logSkill("shuimeng", result.targets);
				event.target = result.targets[0];
				player.chooseToCompare(event.target);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				player.chooseUseTarget({ name: "wuzhong", isCard: true }, true);
			} else {
				event.target.useCard({ name: "guohe", isCard: true }, player);
			}
		},
	},
	qianya: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return get.type(event.card, "trick") == "trick" && player.countCards("h");
		},
		async cost(event, trigger, player) {
			let nh = player.countCards("h");
			event.result = await player
				.chooseCardTarget({
					filterCard: true,
					filterTarget(card, player, target) {
						return target != player;
					},
					selectCard: [1, nh],
					allowChooseAll: true,
					ai1(card) {
						var player = _status.event.player;
						var cardname = _status.event.cardname;
						if (_status.event.du) {
							return -get.value(card, player, "raw");
						} else if (_status.event.shuimeng) {
							if (cardname == "wuzhong") {
								if (
									player.needsToDiscard(2, (i, player) => {
										return !ui.selected.cards.includes(i) && !player.canIgnoreHandcard(i);
									})
								) {
									return 10 - get.value(card, player, "raw");
								}
							} else if (cardname == "guohe") {
								if (
									player.needsToDiscard(-1, (i, player) => {
										return !ui.selected.cards.includes(i) && !player.canIgnoreHandcard(i);
									})
								) {
									return 10 - get.value(card, player, "raw");
								}
							}
							return 0;
						} else if (cardname == "lebu") {
							if (
								player.needsToDiscard(1, (i, player) => {
									return !ui.selected.cards.includes(i) && !player.canIgnoreHandcard(i);
								})
							) {
								return 8 - get.value(card, player, "raw");
							} else {
								if (!ui.selected.cards.length) {
									return 6 - get.value(card, player, "raw");
								}
								return 0;
							}
						} else if (cardname == "shunshou") {
							if (_status.event.nh <= 2) {
								return get.value(card, player, "raw");
							}
						} else if (cardname == "huogong") {
							if (player.hp == 1) {
								return get.value(card, player, "raw");
							}
						}
						if (ui.selected.cards.length) {
							return 0;
						}
						return 7 - get.value(card, player, "raw");
					},
					ai2(target) {
						var att = get.attitude(_status.event.player, target);
						var nh2 = target.countCards("h");
						var num = Math.sqrt(1 + nh2);
						var cardname = _status.event.cardname;
						if (_status.event.du) {
							return 0.5 - att;
						} else if (_status.event.shuimeng) {
							return att / num;
						} else if (cardname == "lebu") {
							return att / num;
						} else if (cardname == "shunshou") {
							if (_status.event.nh <= 2) {
								return att / num;
							}
						} else if (cardname == "huogong") {
							if (_status.event.player.hp == 1) {
								return att / num;
							}
						}
						if (_status.event.nh > nh2 + 1) {
							return att / num;
						}
						return 0;
					},
					du: player.hasCard(function (card) {
						return get.value(card, player, "raw") < 0;
					}),
					shuimeng: (function () {
						if (trigger.card.name == "guohe") {
							return trigger.getParent(2).name == "shuimeng";
						}
						if (trigger.card.name == "wuzhong") {
							return trigger.getParent(3).name == "shuimeng";
						}
					})(),
					nh: nh,
					cardname: trigger.card.name,
					prompt: get.prompt2(event.skill),
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.give(event.cards, event.targets[0]);
		},
	},
};
