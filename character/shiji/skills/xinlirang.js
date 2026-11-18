import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinlirang" | "xinmingshi" | "spmingshi" | "splirang" | "xinguixiu" | "qingyu" | "xuancun" | "mbyongjue">} */
export const groupSkills = {
	//孔融
	xinlirang: {
		audio: "splirang",
		trigger: { global: "phaseDrawBegin2" },
		logTarget: "player",
		filter(event, player) {
			return !event.numFixed && event.player != player && player.countMark("xinlirang") == 0;
		},
		prompt2: "获得一枚“谦”并令其多摸两张牌",
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		content() {
			trigger.num += 2;
			player.addMark("xinlirang", 1);
			player.addTempSkill("xinlirang_gain");
		},
		marktext: "谦",
		intro: {
			name: "谦",
			content: "mark",
		},
		group: "xinlirang_skip",
		subSkill: {
			gain: {
				audio: "splirang",
				trigger: { global: "phaseDiscardEnd" },
				direct: true,
				filter(event, player) {
					return event.player.hasHistory("lose", function (evt) {
						return evt.type == "discard" && evt.cards2.filterInD("d").length > 0 && evt.getParent("phaseDiscard") == event;
					});
				},
				content() {
					"step 0";
					var cards = [];
					trigger.player.getHistory("lose", function (evt) {
						if (evt.type == "discard" && evt.getParent("phaseDiscard") == trigger) {
							cards.addArray(evt.cards2.filterInD("d"));
						}
					});
					player.chooseButton(["礼让：是否获得其中至多两张牌？", cards], [1, 2]);
					"step 1";
					if (result.bool) {
						player.logSkill("xinlirang_gain", trigger.player);
						player.gain(result.links, "gain2");
					}
				},
			},
			skip: {
				audio: "splirang",
				trigger: { player: "phaseBegin" },
				forced: true,
				filter(event, player) {
					return player.hasMark("xinlirang");
				},
				async content(event, trigger, player) {
					player.skip("phaseDraw");
					player.removeMark("xinlirang", player.countMark("xinlirang"));
				},
			},
		},
	},
	xinmingshi: {
		audio: "spmingshi",
		trigger: { player: "damageEnd" },
		forced: true,
		logTarget: "source",
		filter(event, player) {
			return event.source && event.source.isIn() && player.hasMark("xinlirang") && event.source.countCards("hej") > 0;
		},
		content() {
			"step 0";
			trigger.source
				.discardPlayerCard(trigger.source, "hej", true)
				.set("color", get.attitude(trigger.source, player) > 0 ? "red" : "black")
				.set("ai", function (card) {
					return (get.color(card.link) == _status.event.color ? 4 : 0) - get.value(card.link);
				});
			"step 1";
			if (result.bool && result.cards && result.cards.length) {
				var card = result.cards[0];
				if (get.color(card, trigger.source) == "red") {
					player.recover();
				} else if (get.position(card, true) == "d") {
					player.gain(card, "gain2");
				}
			}
		},
		ai: {
			combo: "xinlirang",
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage") && target.hasMark("xinlirang")) {
						var cards = [card];
						if (card.cards && card.cards.length) {
							cards.addArray(card.cards);
						}
						if (ui.selected.cards.length) {
							cards.addArray(ui.selected.cards);
						}
						if (
							!player.countCards("he", function (card) {
								return !cards.includes(card);
							})
						) {
							return;
						}
						if (
							!player.countCards("h", function (card) {
								return !cards.includes(card) && get.color(card) == "black" && get.value(card, player) < 6;
							})
						) {
							return "zerotarget";
						}
						return 0.5;
					}
				},
			},
		},
	},
	spmingshi: {
		audio: 2,
		trigger: { player: "damageEnd" },
		forced: true,
		logTarget: "source",
		filter(event, player) {
			return event.source && player !== event.source && event.source.hasDiscardableCards(event.source, "he");
		},
		getIndex: event => event.num,
		async content(event, trigger, player) {
			const { source } = trigger;
			if (source.countDiscardableCards(source, "he")) {
				await source.chooseToDiscard("he", true);
			}
		},
		ai: {
			threaten: 0.8,
			maixie: true,
			maixie_defend: true,
		},
	},
	splirang: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			var hs = player.getCards("h");
			if (!hs.length) {
				return false;
			}
			for (var i of hs) {
				if (!lib.filter.cardDiscardable(i, player, "splirang")) {
					return false;
				}
			}
			return true;
		},
		filterCard: true,
		selectCard: -1,
		content() {
			"step 0";
			cards = cards.filterInD("d");
			if (!cards.length || player.hp < 1) {
				event.goto(3);
			} else {
				player.chooseButton(["将任意张牌交给一名其他角色", cards], [1, Math.min(cards.length, player.hp)]).set("ai", function (button) {
					return get.value(button.link);
				});
			}
			"step 1";
			if (result.bool) {
				event.cards = result.links;
				player.chooseTarget(true, "令一名角色获得" + get.translation(event.cards), lib.filter.notMe).set("ai", function (target) {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					if (target.hasJudge("lebu")) {
						att /= 5;
					}
					return att;
				});
			} else {
				event.goto(3);
			}
			"step 2";
			if (result.targets && result.targets.length) {
				var target = result.targets[0];
				player.line(target, "green");
				target.gain(cards, "gain2");
			}
			"step 3";
			player.draw();
		},
		ai: {
			order: 0.1,
			result: {
				player(player) {
					var hs = player.getCards("h");
					if (
						hs.length <= player.hp &&
						game.hasPlayer(function (current) {
							return current != player && get.attitude(player, current) > 0 && !current.hasJudge("lebu") && !current.hasSkillTag("nogain");
						})
					) {
						return 1;
					}
					if (get.value(hs, player) < 6) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	//糜夫人
	xinguixiu: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		filter(event, player) {
			return player.hp % 2 == 1 || player.isDamaged();
		},
		content() {
			if (player.hp % 2 == 1) {
				player.draw();
			} else {
				player.recover();
			}
		},
	},
	qingyu: {
		audio: 3,
		dutySkill: true,
		locked: false,
		group: ["qingyu_achieve", "qingyu_fail", "qingyu_defend"],
		subSkill: {
			defend: {
				audio: "qingyu1.mp3",
				trigger: { player: "damageBegin2" },
				filter(event, player) {
					return (
						player.countCards("he", function (card) {
							return lib.filter.cardDiscardable(card, player, "qingyu_defend");
						}) > 1
					);
				},
				forced: true,
				content() {
					trigger.cancel();
					player.chooseToDiscard(2, "he", true);
				},
			},
			achieve: {
				audio: "qingyu3.mp3",
				trigger: { player: "phaseZhunbeiBegin" },
				forced: true,
				skillAnimation: true,
				animationColor: "fire",
				filter(event, player) {
					return player.isHealthy() && player.countCards("h") < game.roundNumber;
				},
				content() {
					game.log(player, "成功完成使命");
					player.awakenSkill("qingyu");
					player.addSkills("xuancun");
				},
			},
			fail: {
				audio: "qingyu2.mp3",
				trigger: { player: "dying" },
				forced: true,
				async content(event, trigger, player) {
					game.log(player, "使命失败");
					player.awakenSkill("qingyu");
					await player.loseMaxHp();
					const targets = game.filterPlayer(current => current != player);
					if (!targets.length) {
						return;
					}
					const result =
						targets.length > 1
							? await player
									.chooseTarget(`令一名其他角色获得${get.poptip("mbyongjue")}`, true, lib.filter.notMe)
									.set("ai", target => {
										return get.attitude(get.player(), target);
									})
									.forResult()
							: {
									bool: true,
									targets: targets,
								};
					if (result?.bool && result.targets?.length) {
						const target = result.targets[0];
						player.line(target);
						await target.addSkills("mbyongjue");
					}
				},
			},
		},
		derivation: ["xuancun", "mbyongjue"],
	},
	xuancun: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return player != event.player && player.countCards("h") < player.hp;
		},
		logTarget: "player",
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		prompt2(event, player) {
			return "令其摸" + get.cnNumber(Math.min(2, player.hp - player.countCards("h"))) + "张牌";
		},
		content() {
			trigger.player.draw(Math.min(2, player.hp - player.countCards("h")));
		},
	},
	mbyongjue: {
		audio: "yongjue",
		trigger: {
			global: "useCard",
		},
		filter(event, player) {
			if (event.player != _status.currentPhase || event.card.name != "sha") {
				return false;
			}
			return event.player.getHistory("useCard").indexOf(event) == 0;
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			player
				.when({
					global: "useCardAfter",
				})
				.filter(evt => evt == trigger)
				.step(async (event, trigger, player) => {
					const cards = trigger.cards.filterInD("od");
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				});
		},
	},
};
