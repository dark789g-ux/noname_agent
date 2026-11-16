import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhengrong" | "hongju" | "qingce" | "drlt_zhenrong" | "drlt_hongju" | "drlt_qingce" | "drlt_zhengu">} */
export const groupSkills = {
	//新毌丘俭
	zhengrong: {
		trigger: { player: "useCardToPlayered" },
		audio: "drlt_zhenrong",
		filter(event, player) {
			if (!event.isFirstTarget) {
				return false;
			}
			if (!["basic", "trick"].includes(get.type(event.card))) {
				return false;
			}
			if (get.tag(event.card, "damage")) {
				return game.hasPlayer(function (current) {
					return event.targets.includes(current) && current.countCards("h") >= player.countCards("h") && current.countCards("he") > 0;
				});
			}
			return false;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "将一名手牌数不小于你的目标角色的一张牌置于你的武将牌上，成为「荣」", function (card, player, target) {
					return _status.event.targets.includes(target) && target.countCards("h") >= player.countCards("h") && target.countCards("he") > 0;
				})
				.set("ai", function (target) {
					return (1 - get.attitude(_status.event.player, target)) / target.countCards("he");
				})
				.set("targets", trigger.targets)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const next = player.choosePlayerCard(target, "he", true);
			next.ai = get.buttonValue;
			const result = await next.forResult();
			if (result.bool) {
				const card = result.links[0];
				const next = player.addToExpansion(card, "give", "log", target);
				next.gaintag.add("zhengrong");
				await next;
			}
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		marktext: "荣",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
	},
	hongju: {
		trigger: { player: "phaseZhunbeiBegin" },
		audio: "drlt_hongju",
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "thunder",
		derivation: "qingce",
		filter(event, player) {
			return player.getExpansions("zhengrong").length >= 3;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const cards = player.getExpansions("zhengrong");
			if (cards.length && player.countCards("h")) {
				const next = player.chooseToMove("征荣：是否交换“荣”和手牌？");
				next.set("list", [
					[get.translation(player) + "（你）的“荣”", cards],
					["手牌区", player.getCards("h")],
				]);
				next.set("filterMove", function (from, to) {
					return typeof to != "number";
				});
				next.set("selectionSpec", { move: "swap" });
				next.set("processAI", function (list) {
					const player = _status.event.player,
						cards = list[0][1].concat(list[1][1]).sort(function (a, b) {
							return get.value(a) - get.value(b);
						}),
						cards2 = cards.splice(0, player.getExpansions("zhengrong").length);
					return [cards2, cards];
				});
				const result = await next.forResult();
				if (result.bool) {
					const pushs = result.moved[0],
						gains = result.moved[1];
					pushs.removeArray(player.getExpansions("zhengrong"));
					gains.removeArray(player.getCards("h"));
					if (pushs.length && pushs.length == gains.length) {
						const next = player.addToExpansion(pushs);
						next.gaintag.add("zhengrong");
						await next;
						await player.gain(gains, "gain2", "log");
					}
				}
			}
			await player.addSkills("qingce");
			game.log(player, "获得了技能", "#g【清侧】");
			await player.loseMaxHp();
		},
		ai: { combo: "zhengrong" },
	},
	qingce: {
		enable: "phaseUse",
		audio: "drlt_qingce",
		filter(event, player) {
			return player.getExpansions("zhengrong").length > 0 && player.countCards("h") > 0;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("请选择要获得的「荣」", player.getExpansions("zhengrong"), "hidden");
			},
			backup(links, player) {
				return {
					card: links[0],
					filterCard: true,
					position: "h",
					filterTarget(card, player, target) {
						return target.countDiscardableCards(player, "ej") > 0;
					},
					delay: false,
					audio: "drlt_qingce",
					content: lib.skill.qingce.contentx,
					ai: {
						result: {
							target(player, target) {
								const att = get.attitude(player, target);
								if (
									att > 0 &&
									(target.countCards("j") > 0 ||
										target.countCards("e", function (card) {
											return get.value(card, target) < 0;
										}))
								) {
									return 2;
								}
								if (att < 0 && target.countCards("e") > 0 && !target.hasSkillTag("noe")) {
									return -1;
								}
								return 0;
							},
						},
					},
				};
			},
			prompt(links, player) {
				return "选择弃置一张手牌，获得" + get.translation(links[0]) + "并弃置一名角色装备区或判定区内的一张牌";
			},
		},
		async contentx(event, trigger, player) {
			const card = lib.skill.qingce_backup.card;
			await player.gain(card, "gain2", "log");
			if (event.target.countDiscardableCards(player, "ej") > 0) {
				await player.discardPlayerCard("ej", true, event.target);
			}
		},
		ai: {
			combo: "zhengrong",
			order: 8,
			result: {
				player(player) {
					if (
						game.hasPlayer(function (current) {
							const att = get.attitude(player, current);
							if ((att > 0 && current.countCards("j") > 0) || (att < 0 && current.countCards("e") > 0)) {
								return true;
							}
							return false;
						})
					) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	//阴雷
	drlt_zhenrong: {
		marktext: "荣",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		audio: 2,
		trigger: { source: "damageSource" },
		filter(event, player) {
			return event.player != player && event.player.countCards("h") > player.countCards("h");
		},
		async cost(event, trigger, player) {
			const result = await player
				.choosePlayerCard("hej", get.prompt(event.skill), trigger.player)
				.set("ai", function (button) {
					const { player, target } = get.event();
					return -get.attitude(player, target) + 1;
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = result;
				event.result.cards = result.links;
			}
		},
		async content(event, trigger, player) {
			const next = player.addToExpansion(event.cards, trigger.player, "give", "log");
			next.gaintag.add("drlt_zhenrong");
			await next;
		},
	},
	drlt_hongju: {
		skillAnimation: true,
		animationColor: "thunder",
		audio: 2,
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		forced: true,
		unique: true,
		juexingji: true,
		derivation: ["drlt_qingce"],
		filter(event, player) {
			return player.getExpansions("drlt_zhenrong").length >= 3 && game.dead.length > 0;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const cards = player.getExpansions("drlt_zhenrong");
			if (cards.length && player.countCards("h")) {
				const next = player.chooseToMove("征荣：是否交换“荣”和手牌？");
				next.set("list", [
					[get.translation(player) + "（你）的“荣”", cards],
					["手牌区", player.getCards("h")],
				]);
				next.set("filterMove", function (from, to) {
					return typeof to != "number";
				});
				next.set("selectionSpec", { move: "swap" });
				next.set("processAI", function (list) {
					const player = _status.event.player,
						cards = list[0][1].concat(list[1][1]).sort(function (a, b) {
							return get.value(a) - get.value(b);
						}),
						cards2 = cards.splice(0, player.getExpansions("drlt_zhenrong").length);
					return [cards2, cards];
				});
				const result = await next.forResult();
				if (result.bool) {
					const pushs = result.moved[0],
						gains = result.moved[1];
					pushs.removeArray(player.getExpansions("drlt_zhenrong"));
					gains.removeArray(player.getCards("h"));
					if (pushs.length && pushs.length == gains.length) {
						const next = player.addToExpansion(pushs);
						next.gaintag.add("drlt_zhenrong");
						await next;
						await player.gain(gains, "gain2", "log");
					}
				}
			}
			await player.addSkills("drlt_qingce");
			await player.loseMaxHp();
		},
		ai: {
			combo: "drlt_zhenrong",
		},
	},
	drlt_qingce: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.getExpansions("drlt_zhenrong").length > 0;
		},
		filterTarget(card, player, target) {
			return target.countDiscardableCards(player, "ej") > 0;
		},
		async content(event, trigger, player) {
			const next = player.chooseCardButton(player.getExpansions("drlt_zhenrong"), 1, "请选择需要弃置的“荣”", true);
			next.ai = button => 6 - get.value(button.link);
			const result = await next.forResult();
			if (result.bool) {
				const cards = result.links;
				await player.loseToDiscardpile(cards);
				await player.discardPlayerCard(event.target, "ej", 1, true);
			}
		},
		ai: {
			combo: "drlt_zhenrong",
			order: 13,
			result: {
				target(player, target) {
					if (get.attitude(player, target) > 0 && target.countCards("j") > 0) {
						return 1;
					}
					return -1;
				},
			},
		},
	},
	drlt_zhengu: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.player();
					const num = Math.min(5, player.countCards("h")) - target.countCards("h");
					const att = get.attitude(player, target);
					return num * att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.addSkill("drlt_zhengu_mark");
			player.markAuto("drlt_zhengu_mark", [target]);
		},
		async sync(player, target) {
			const num = player.countCards("h");
			const num2 = target.countCards("h");
			if (num < num2) {
				await target.chooseToDiscard(num2 - num, true, "h", "allowChooseAll");
			} else {
				await target.drawTo(Math.min(5, num));
			}
		},
		subSkill: {
			mark: {
				charlotte: true,
				onremove: true,
				intro: { content: "你的回合结束时和$的下个回合结束时，其将手牌摸至或弃置至与你手牌数相同（至多摸至五张）" },
				audio: "drlt_zhengu",
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					if (player == event.player) {
						return player.getStorage("drlt_zhengu_mark").some(current => current.isIn());
					}
					return player.getStorage("drlt_zhengu_mark").includes(event.player);
				},
				forced: true,
				logTarget(event, player) {
					return player == event.player
						? player
								.getStorage("drlt_zhengu_mark")
								.filter(current => current.isIn())
								.sortBySeat()
						: event.player;
				},
				async content(event, trigger, player) {
					if (player == trigger.player) {
						for (const target of event.targets.sortBySeat()) {
							if (!target.isIn()) {
								continue;
							}
							await lib.skill.drlt_zhengu.sync(player, target);
						}
					} else {
						const target = event.targets[0];
						player.unmarkAuto(event.name, [target]);
						if (!player.getStorage(event.name).length) {
							player.removeSkill(event.name);
						}
						await lib.skill.drlt_zhengu.sync(player, target);
					}
				},
			},
		},
	},
};
