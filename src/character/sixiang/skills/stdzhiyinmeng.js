import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdzhiyinmeng" | "stdhehe" | "stdzhiyi" | "stdshefu" | "stdyibing" | "stdbazhan" | "stdzhanying">} */
export const groupSkills = {
	//邓芝
	//只因盟
	stdzhiyinmeng: {
		audio: "weimeng",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countCards("he");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt2(event.skill),
					filterTarget: lib.filter.notMe,
					filterCard: true,
					position: "he",
					selectCard: [1, Infinity],
					complexCard: true,
					complexTarget: true,
					complexSelect: true,
					allowChooseAll: true,
					ai1(card) {
						if (ui.selected.cards.length && card.name != "du") {
							return 0;
						}
						if (card.name == "du") {
							return 114514;
						}
						return 5 - get.value(card);
					},
					ai2(target) {
						if (!ui.selected.cards.length) {
							return 0;
						}
						const player = get.event().player,
							att = get.attitude(player, target);
						if (ui.selected.cards[0].name == "du") {
							if (!target.hasSkillTag("nodu")) {
								return -att;
							}
							return -0.00001 * att;
						}
						return att;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.give(event.cards, target);
			await target.chooseToGive("he", [1, Infinity], player, "allowChooseAll");
		},
	},
	stdhehe: {
		audio: "jianliang",
		trigger: { player: "phaseDrawEnd" },
		filter(event, player) {
			return game.hasPlayer(target => {
				return target != player && target.countCards("h") == player.countCards("h");
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(
					get.prompt2(event.skill),
					(card, player, target) => {
						return target != player && target.countCards("h") == player.countCards("h");
					},
					[1, 2]
				)
				.set("ai", target => {
					const player = get.event().player;
					return get.effect(target, { name: "draw" }, player, player);
				})
				.forResult();
		},
		locked: true,
		async content(event, trigger, player) {
			await game.asyncDraw(event.targets);
			await game.delayx();
		},
	},
	//张翼
	stdzhiyi: {
		audio: "zhiyi",
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return player.getHistory("useCard", evt => {
				return evt.card.name == "sha";
			}).length;
		},
		forced: true,
		async content(event, trigger, player) {
			const result = await player.chooseUseTarget("执义：视为使用【杀】，或摸一张牌", { name: "sha" }, false).forResult();
			if (!result.bool) {
				await player.draw();
			}
		},
	},
	//大魏汉尼拔
	stdshefu: {
		audio: "shefu",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt(event.skill), "将一张手牌置于武将牌上", "h")
				.set("ai", card => {
					return (
						(lib.card.list
							.slice()
							.map(list => list[2])
							.filter(name => {
								return card.name == name;
							}).length -
							1) /
						(get.value(card) || 0.5)
					);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await player.addToExpansion({
				cards: event.cards,
				source: player,
				animate: "giveAuto",
				gaintag: ["stdshefu"],
			});
		},
		marktext: "伏",
		intro: {
			markcount: "expansion",
			mark(dialog, _, player) {
				const cards = player.getExpansions("stdshefu");
				if (player.isUnderControl(true) && cards.length) {
					dialog.addAuto(cards);
				} else {
					return "共有" + get.cnNumber(cards.length) + "张“伏兵”";
				}
			},
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: "stdshefu_effect",
		subSkill: {
			effect: {
				audio: "shefu",
				trigger: { global: "useCard" },
				filter(event, player) {
					return player.getExpansions("stdshefu").some(card => card.name == event.card.name);
				},
				async cost(event, trigger, player) {
					let result = await player
						.chooseButton(["###" + get.prompt("stdshefu") + "###弃置一张同名牌，令此牌无效", player.getExpansions("stdshefu")])
						.set("filterButton", button => {
							return button.link.name == get.event().getTrigger().card.name;
						})
						.set("ai", button => {
							return get.event().goon ? 1 : 0;
						})
						.set("goon", lib.skill.sbkanpo.subSkill.kanpo.check(trigger, player))
						.forResult();
					if (result.bool && result.links) {
						result.cards = result.links.slice();
						delete result.links;
					}
					event.result = result;
				},
				async content(event, trigger, player) {
					await player.loseToDiscardpile(event.cards);
					trigger.targets.length = 0;
					trigger.all_excluded = true;
				},
			},
		},
	},
	stdyibing: {
		audio: "benyu",
		trigger: { global: "dying" },
		filter(event, player) {
			return event.player != player && event.player.countCards("eh");
		},
		logTarget: "player",
		check(event, player) {
			return get.effect(event.player, { name: "shunshou_copy2" }, player, player) > 0;
		},
		async content(event, trigger, player) {
			await player.gainPlayerCard(trigger.player, "he", `获得${get.translation(trigger.player)}一张牌`, true);
		},
	},
	//樊玉凤
	stdbazhan: {
		audio: "bazhan",
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterCard: true,
		position: "h",
		filterTarget(card, player, target) {
			return target != player && target.hasSex("male");
		},
		discard: false,
		lose: false,
		delay: false,
		usable: 2,
		check(card) {
			if (card.name == "du") {
				return 114514;
			}
			return 5 - get.value(card);
		},
		async content(event, trigger, player) {
			const target = event.target;
			await player.showCards(event.cards);
			await player.give(event.cards, target, "visible");
			if (target.countCards("h")) {
				await target
					.chooseToGive(player, (card, player) => {
						return get.type2(card) != get.type2(get.event().cards[0]);
					})
					.set("cards", event.cards);
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					const cardxx = ui.selected.cards[0];
					if (cardxx.name == "du") {
						return -100;
					}
					if (!player.hasSkill("stdzhanying")) {
						return 1;
					}
					if (target.countMark("stdzhanying_count") == target.countCards("h") + 1) {
						const cards = player.getCards("hs", card => {
							return (
								card != cardxx &&
								get.tag(card, "damage") &&
								player.canUse(card, target) &&
								get.effect(target, card, player, player) > 0
							);
						});
						if (!cards.length) {
							return 1;
						}
						let cardx = cards.filter(card => get.name(card) == "sha");
						cardx.sort((a, b) => get.effect(target, b, player, player) - get.effect(target, a, player, player));
						cardx = cardx.slice(Math.min(cardx.length, player.getCardUsable("sha")), cardx.length);
						cards.removeArray(cardx);
						return -cards.reduce((sum, card) => sum + get.effect(target, card, player, player), 0);
					}
					return 1;
				},
			},
		},
	},
	stdzhanying: {
		audio: "jiaoying",
		trigger: { global: "damageBegin2" },
		filter(event, player) {
			if (_status.currentPhase !== player) {
				return false;
			}
			return event.player.countCards("h") > event.player.countMark("stdzhanying_count");
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.num++;
		},
		global: "stdzhanying_mark",
		subSkill: {
			count: {
				charlotte: true,
				onremove: true,
				intro: {
					markcount: storage => (storage || 0).toString(),
					content: "本回合开始时手牌数为#张",
				},
			},
			mark: {
				charlotte: true,
				trigger: { global: "phaseBegin" },
				filter(event, player) {
					return event.player.hasSkill("stdzhanying", null, null, false);
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					player.addTempSkill("stdzhanying_count");
					player.addMark("stdzhanying_count", player.countCards("h"), false);
				},
				mod: {
					cardEnabled(card, player) {
						if (!_status.currentPhase || !_status.currentPhase.hasSkill("stdzhanying")) {
							return;
						}
						if (get.color(card) == "red" && player.countMark("stdzhanying_count") < player.countCards("h")) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (!_status.currentPhase || !_status.currentPhase.hasSkill("stdzhanying")) {
							return;
						}
						if (get.color(card) == "red" && player.countMark("stdzhanying_count") < player.countCards("h")) {
							return false;
						}
					},
				},
			},
		},
	},
};
