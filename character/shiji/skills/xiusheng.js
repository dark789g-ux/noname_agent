import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xiusheng" | "yinlang" | "huaibi" | "gebo" | "spsongshu" | "jishi" | "xinliaoyi">} */
export const groupSkills = {
	//刘璋
	xiusheng: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			return (
				player.storage.yinlang &&
				game.hasPlayer(function (current) {
					return current.group == player.storage.yinlang;
				})
			);
		},
		content() {
			"step 0";
			if (player.storage.xiusheng && player.storage.xiusheng.length > 0) {
				player.unmarkSkill("xiusheng");
			}
			"step 1";
			event.num = game.countPlayer(function (current) {
				return current.group == player.storage.yinlang;
			});
			if (event.num > 0) {
				player.draw(event.num);
			} else {
				event.finish();
			}
			"step 2";
			var he = player.getCards("he");
			if (!he.length) {
				event.finish();
			} else if (he.length < num) {
				event._result = { bool: true, cards: he };
			} else {
				player.chooseCard("he", true, num, "选择" + get.cnNumber(num) + "张牌作为生");
			}
			"step 3";
			if (result.bool) {
				var cards = result.cards;
				player.markAuto("xiusheng", cards);
				game.log(player, "将", cards, "放在了武将牌上");
				player.lose(cards, ui.special, "toStorage");
			}
			"step 4";
			game.delayx();
		},
		intro: {
			content: "cards",
			onunmark: "throw",
		},
		ai: { combo: "yinlang" },
	},
	yinlang: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		direct: true,
		filter(event, player) {
			return (
				!player.hasSkill("yinlang_round") &&
				game.hasPlayer(function (current) {
					return current.group && current.group != "unknown";
				})
			);
		},
		content() {
			"step 0";
			var list = [];
			game.countPlayer(function (current) {
				if (current.group && current.group != "unknown") {
					list.add(current.group);
				}
			});
			list.sort(function (a, b) {
				return lib.group.indexOf(a) - lib.group.indexOf(b);
			});
			if (!player.hasSkill("yinlang")) {
				list.push("cancel2");
			}
			player
				.chooseControl(list)
				.set("prompt", "引狼：请选择一个势力")
				.set("ai", function () {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						var getn = function (group) {
							return game.countPlayer(function (current) {
								if (current.group != group) {
									return false;
								}
								if (get.attitude(current, player) > 0) {
									return 1.5;
								}
								if (!current.inRange(player)) {
									return 1;
								}
								return 0.6;
							});
						};
						list.sort(function (a, b) {
							return getn(b) - getn(a);
						});
						return list[0];
					})()
				);
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill(
					"yinlang",
					game.filterPlayer(function (current) {
						return current.group == result.control;
					})
				);
				game.log(player, "选择了", "#y" + get.translation(result.control + 2));
				player.storage.yinlang = result.control;
				player.markSkill("yinlang");
			}
		},
		ai: { combo: "xiusheng" },
		intro: { content: "已选择了$势力" },
		group: "yinlang_gain",
		subSkill: {
			round: {},
			gain: {
				audio: "yinlang",
				trigger: { global: "phaseUseBegin" },
				forced: true,
				locked: false,
				filter(event, player) {
					return event.player.group == player.storage.yinlang && event.player.isIn() && player.getStorage("xiusheng").length > 0;
				},
				logTarget: "player",
				content() {
					"step 0";
					var str = get.translation(player);
					event.target = trigger.player;
					event.target
						.chooseControl()
						.set("choiceList", ["获得" + str + "的一张“生”，然后本阶段使用牌时只能指定其为目标", "令" + str + "获得一张“生”"])
						.set("ai", function () {
							var evt = _status.event.getParent(),
								player = evt.target,
								target = evt.player;
							if (get.attitude(player, target) > 0) {
								return 1;
							}
							if (
								!player.countCards("hs", function (card) {
									return player.hasValueTarget(card, null, true) && (!player.canUse(card, target, null, true) || get.effect(target, card, player, player) < 0);
								})
							) {
								return 0;
							}
							return 1;
						});
					"step 1";
					event.gainner = result.index == 0 ? target : player;
					if (result.index == 0) {
						event.block = true;
					}
					event.gainner.chooseButton(["选择获得一张“生”", player.storage.xiusheng], true);
					"step 2";
					player.unmarkAuto("xiusheng", result.links);
					event.gainner.gain(result.links, "gain2");
					if (event.block) {
						target.markAuto("yinlang_block", [player]);
						target.addTempSkill("yinlang_block", "phaseUseAfter");
					}
				},
			},
			block: {
				mod: {
					playerEnabled(card, player, target) {
						var info = get.info(card);
						if (info && info.singleCard && ui.selected.cards.length) {
							return;
						}
						if (!player.getStorage("yinlang_block").includes(target)) {
							return false;
						}
					},
				},
				onremove: true,
			},
		},
	},
	huaibi: {
		audio: 2,
		zhuSkill: true,
		mod: {
			maxHandcard(player, num) {
				if (player.storage.yinlang && player.hasZhuSkill("huaibi")) {
					return (
						num +
						game.countPlayer(function (current) {
							return current.group == player.storage.yinlang;
						})
					);
				}
			},
		},
		ai: { combo: "yinlang" },
	},
	//张温
	gebo: {
		audio: 2,
		trigger: { global: "recoverAfter" },
		forced: true,
		content() {
			game.cardsGotoSpecial(get.cards(), "toRenku");
		},
		ai: {
			combo: "spsongshu",
		},
	},
	spsongshu: {
		audio: 2,
		trigger: { global: "phaseDrawBegin1" },
		logTarget: "player",
		filter(event, player) {
			return event.player.hp > player.hp && player.hp > 0 && !event.numFixed && _status.renku.length > 0;
		},
		check(event, player) {
			var num = Math.min(5, player.hp, _status.renku.length);
			if (num <= event.num) {
				return get.attitude(player, event.player) < 0;
			}
			return false;
		},
		content() {
			"step 0";
			trigger.changeToZero();
			var num = Math.min(5, player.hp, _status.renku.length);
			trigger.player.chooseButton(["选择获得" + get.cnNumber(num) + "张牌", _status.renku], true, num);
			"step 1";
			if (result.bool) {
				var cards = result.links;
				trigger.player.gain(cards, "gain2", "fromRenku");
				trigger.player.addTempSkill("spsongshu_block");
			}
		},
		init(player) {
			player.storage.renku = true;
		},
		subSkill: {
			block: {
				mod: {
					playerEnabled(card, player, target) {
						if (player != target) {
							return false;
						}
					},
				},
				mark: true,
				intro: { content: "不能对其他角色使用牌" },
			},
		},
		ai: {
			combo: "gebo",
		},
	},
	//张机
	jishi: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		forced: true,
		filter(event, player) {
			return (
				event.cards.filterInD().length > 0 &&
				!player.getHistory("sourceDamage", function (evt) {
					return evt.card == event.card;
				}).length
			);
		},
		content() {
			var cards = trigger.cards.filterInD();
			game.log(player, "将", cards, "置于了仁库");
			game.cardsGotoSpecial(cards, "toRenku");
		},
		init(player) {
			player.storage.renku = true;
		},
		group: "jishi_draw",
		subSkill: {
			draw: {
				audio: "jishi",
				trigger: {
					global: ["gainAfter", "cardsDiscardAfter"],
				},
				forced: true,
				filter(event, player) {
					return event.fromRenku == true && !event.outRange;
				},
				content() {
					player.draw();
				},
			},
		},
		ai: {
			combo: "binglun",
		},
	},
	xinliaoyi: {
		audio: "liaoyi",
		trigger: { global: "phaseBegin" },
		filter(event, player) {
			if (player == event.player) {
				return false;
			}
			if (_status.renku.length) {
				return true;
			}
			return event.player.countCards("h") > event.player.getHp();
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			const num = Math.max(0, target.countCards("h") - target.getHp());
			const choiceList = ["令其从仁库中获得一张牌", `令其将${get.cnNumber(num)}张手牌置入仁库`];
			const choices = [];
			if (_status.renku.length) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			if (target.countCards("h") > target.getHp()) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			if (!choices.length) {
				return;
			}
			const result = await player
				.chooseControl(choices, "cancel2")
				.set("prompt", get.prompt("xinliaoyi", target))
				.set("choiceList", choiceList)
				.set("ai", () => {
					const { player, target, controls } = get.event();
					const att = get.attitude(player, target);
					if (att > 0) {
						if (controls.includes("选项一")) {
							return "选项一";
						}
						return "cancel2";
					} else {
						if (controls.includes("选项二")) {
							return "选项二";
						}
						return "cancel2";
					}
				})
				.set("target", target)
				.forResult();
			event.result = {
				bool: result.control != "cancel2",
				cost_data: result.control,
			};
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const control = event.cost_data;
			if (control == "选项一") {
				if (!_status.renku.length) {
					return;
				}
				const result = await target
					.chooseButton(true, ["选择获得一张牌", _status.renku])
					.set("ai", button => {
						return get.value(button.link, get.player());
					})
					.set("direct", true)
					.forResult();
				if (result?.bool) {
					await target.gain(result.links, "gain2", "fromRenku");
				}
			} else {
				const hs = target.getCards("h");
				const num = Math.max(0, target.countCards("h") - target.getHp());
				if (!hs.length) {
					return;
				}
				const result = hs.length <= num ? { bool: true, cards: hs } : await target.chooseCard("h", true, `将${get.cnNumber(num)}张手牌置于仁库中`, num).forResult();
				if (result?.bool) {
					target.$throw(result.cards, 1000);
					game.log(target, "将", result.cards, "置入了仁库");
					await target.lose(result.cards, ui.special, "toRenku");
					await game.delayx();
				}
			}
		},
		init(player) {
			player.storage.renku = true;
		},
		ai: { threaten: 3.4 },
	},
};
