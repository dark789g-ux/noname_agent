import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twqianxi" | "twqianxi2" | "twqianxi3" | "twcuorui" | "twliewei" | "twzhengrong" | "twhongju" | "twqingce" | "twsaotao">} */
export const groupSkills = {
	//马岱
	twqianxi: {
		audio: "qianxi",
		trigger: { player: "phaseZhunbeiBegin" },
		preHidden: true,
		async content(event, trigger, player) {
			await player.draw();
			if (
				!player.hasCard(card => {
					return lib.filter.cardDiscardable(card, player, "tweqianxi");
				}, "he")
			) {
				return;
			}
			const { cards } = await player
				.chooseToDiscard("he", true)
				.set("ai", card => {
					let player = get.event().player;
					if (get.color(card, player)) {
						return 7 - get.value(card, player);
					}
					return 4 - get.value(card, player);
				})
				.forResult();
			if (
				!cards ||
				!game.hasPlayer(target => {
					return player != target && get.distance(player, target) <= 1;
				})
			) {
				return;
			}
			const color = get.color(cards[0], player);
			const { targets } = await player
				.chooseTarget(function (card, player, target) {
					return player != target && get.distance(player, target) <= 1;
				}, true)
				.set("ai", function (target) {
					return get.effect(target, { name: "sha" }, _status.event.player, _status.event.player) + 5;
				})
				.forResult();
			if (targets) {
				const target = targets[0];
				player.line(target);
				target.addTempSkill("twqianxi2");
				target.markAuto("twqianxi2", color);
				player.addTempSkill("twqianxi_self");
				player.markAuto("twqianxi_self", [target]);
			}
		},
		subSkill: {
			self: {
				audio: "qianxi",
				charlotte: true,
				onremove: true,
				forced: true,
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return player.hasHistory("sourceDamage", evt => {
						if (!evt.card || evt.card.name != "sha" || !evt.player.isIn()) {
							return false;
						}
						if (player.getStorage("twqianxi_self").includes(evt.player)) {
							return true;
						}
						return false;
					});
				},
				async content(event, trigger, player) {
					let targets = [];
					player.getHistory("sourceDamage", evt => {
						if (!evt.card || evt.card.name != "sha") {
							return false;
						}
						if (player.getStorage("twqianxi_self").includes(evt.player)) {
							targets.add(evt.player);
						}
						return false;
					});
					player.line(targets);
					for (const target of targets) {
						target.addTempSkill("twqianxi3", { player: "phaseAfter" });
						target.markAuto("twqianxi3", target.storage.twqianxi2);
					}
				},
			},
		},
	},
	twqianxi2: {
		mark: true,
		charlotte: true,
		onremove: true,
		intro: {
			markcount: () => 0,
			content(storage) {
				return "不能使用或打出" + get.translation(storage) + "手牌";
			},
		},
		mod: {
			cardEnabled2(card, player) {
				if (get.itemtype(card) == "card" && player.getStorage("twqianxi2").includes(get.color(card)) && get.position(card) == "h") {
					return false;
				}
			},
		},
	},
	twqianxi3: {
		mod: {
			cardEnabled2(card, player) {
				if (get.itemtype(card) == "card" && !player.getStorage("twqianxi3").includes(get.color(card)) && get.position(card) == "h") {
					return false;
				}
			},
		},
		mark: true,
		intro: {
			content(storage) {
				return "不能使用或打出非" + get.translation(storage) + "手牌";
			},
		},
		charlotte: true,
		onremove: true,
	},
	//牛金
	twcuorui: {
		audio: "cuorui",
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countCards("h") > player.countCards("h");
			});
		},
		check(event, player) {
			var num = 0;
			for (var target of game.players) {
				if (target != player && target.countCards("h") > num) {
					num = target.countCards("h");
				}
			}
			num = Math.min(num, 5 + player.countCards("h"));
			return num - player.countCards("h") >= 2;
		},
		prompt(event, player) {
			var num = 0;
			for (var target of game.players) {
				if (target != player && target.countCards("h") > num) {
					num = target.countCards("h");
				}
			}
			num = Math.min(num, 5 + player.countCards("h"));
			return get.prompt("twcuorui") + "（可摸" + get.cnNumber(num - player.countCards("h")) + "张牌）";
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			var num = 0;
			for (var target of game.players) {
				if (target != player && target.countCards("h") > num) {
					num = target.countCards("h");
				}
			}
			num = Math.min(num, 5 + player.countCards("h"));
			player.drawTo(num);
			if (!player.isDisabledJudge()) {
				player.disableJudge();
				event.finish();
			} else {
				player.chooseTarget("挫锐：是否对一名其他角色造成1点伤害？", lib.filter.notMe).set("ai", function (target) {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				});
			}
			"step 1";
			if (result.bool) {
				player.line(result.targets[0]);
				result.targets[0].damage();
			}
		},
	},
	twliewei: {
		audio: "liewei",
		trigger: { source: "dieAfter" },
		forced: true,
		content() {
			"step 0";
			if (!player.hasSkill("twcuorui", null, null, false) || !player.awakenedSkills.includes("twcuorui")) {
				event._result = { index: 0 };
			} else {
				player
					.chooseControl()
					.set("prompt", "裂围：请选择一项")
					.set("choiceList", ["摸两张牌", "重置〖挫锐〗"])
					.set("ai", function () {
						return 1;
					});
			}
			"step 1";
			if (result.index == 0) {
				player.draw(2);
			} else {
				player.restoreSkill("twcuorui");
			}
		},
	},
	//母兵脸
	twzhengrong: {
		audio: "drlt_zhenrong",
		trigger: { player: "useCardAfter", source: "damageSource" },
		filter(event, player) {
			if (!event.isPhaseUsing(player)) {
				return false;
			}
			if (event.name == "damage") {
				return (
					player
						.getHistory("sourceDamage", evt => {
							return evt.getParent("phaseUse") == event.getParent("phaseUse");
						})
						.indexOf(event) == 0
				);
			}
			if (!event.targets || event.targets.every(target => target == player)) {
				return false;
			}
			return (
				player
					.getAllHistory("useCard", function (evt) {
						if (!evt.isPhaseUsing(player)) {
							return false;
						}
						if (evt.targets.every(target => target == player)) {
							return false;
						}
						return true;
					})
					.indexOf(event) %
					2 ==
				1
			);
		},
		direct: true,
		content() {
			"step 0";
			if (
				!game.hasPlayer(function (target) {
					return target != player && target.countCards("he");
				})
			) {
				event.finish();
				return;
			}
			player
				.chooseTarget(get.prompt("twzhengrong"), "将一名其他角色的一张牌置于武将牌上，称为“荣”", function (card, player, target) {
					return target != player && target.countCards("he");
				})
				.set("ai", function (target) {
					return get.effect(target, { name: "guohe_copy2" }, _status.event.player, _status.event.player);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = result.targets[0];
				player.logSkill("twzhengrong", target);
				player.choosePlayerCard(target, "he", true);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				player.addToExpansion(result.links, target, "give").gaintag.add("twzhengrong");
			}
		},
		marktext: "荣",
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
	},
	twhongju: {
		derivation: ["twqingce", "twsaotao"],
		audio: "drlt_hongju",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "thunder",
		filter(event, player) {
			return player.getExpansions("twzhengrong").length >= 3;
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			player.draw(player.getExpansions("twzhengrong").length);
			"step 1";
			if (player.countCards("h") == 0) {
				event.goto(3);
			} else {
				var next = player.chooseToMove("鸿举：请选择要交换的手牌和“荣”");
				next.set("list", [
					[get.translation(player) + "（你）的“荣”", player.getExpansions("twzhengrong"), "twzhengrong_tag"],
					["手牌区", player.getCards("h")],
				]);
				next.set("filterMove", function (from, to) {
					return typeof to != "number";
				});
				next.set("selectionSpec", { move: "swap" });
				next.set("processAI", function (list) {
					var player = _status.event.player,
						cards = list[0][1].concat(list[1][1]).sort(function (a, b) {
							return player.getUseValue(a) - player.getUseValue(b);
						}),
						cards2 = cards.splice(0, player.getExpansions("twzhengrong").length);
					return [cards2, cards];
				});
			}
			"step 2";
			if (result.bool) {
				var pushs = result.moved[0],
					gains = result.moved[1];
				pushs.removeArray(player.getExpansions("twzhengrong"));
				gains.removeArray(player.getCards("h"));
				if (!pushs.length || pushs.length != gains.length) {
					return;
				}
				player.addToExpansion(pushs, player, "giveAuto").gaintag.add("twzhengrong");
				game.log(player, "将", pushs, "作为“荣”置于武将牌上");
				player.gain(gains, "gain2");
			}
			"step 3";
			player.addSkills("twqingce");
			player
				.chooseBool("是否减1点体力上限并获得〖扫讨〗？")
				.set("ai", () => _status.event.bool)
				.set("bool", player.isDamaged() && player.countCards("h") >= 3 ? (Math.random() < 0.5 ? true : false) : false);
			"step 4";
			if (result.bool) {
				player.loseMaxHp();
				player.addSkills("twsaotao");
				game.delayx();
			}
		},
		ai: {
			combo: "twzhengrong",
		},
	},
	twqingce: {
		enable: "phaseUse",
		audio: "drlt_qingce",
		filter(event, player) {
			return player.getExpansions("twzhengrong").length > 0;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("清侧：请选择要移去的“荣”", player.getExpansions("twzhengrong"), "hidden");
			},
			backup(links, player) {
				return {
					card: links[0],
					filterCard() {
						return false;
					},
					selectCard: -1,
					filterTarget(card, player, target) {
						return target.countDiscardableCards(player, "hej") > 0;
					},
					delay: false,
					audio: "drlt_qingce",
					content: lib.skill.twqingce.contentx,
					ai: {
						result: {
							target(player, target) {
								return get.effect(target, { name: "guohe" }, player, target);
							},
						},
					},
				};
			},
			prompt: () => "弃置一名角色区域内的一张牌",
		},
		contentx() {
			"step 0";
			var card = lib.skill.twqingce_backup.card;
			player.loseToDiscardpile([card]);
			"step 1";
			if (target.countDiscardableCards(player, "hej") > 0) {
				player.discardPlayerCard("hej", true, target);
			}
		},
		ai: {
			combo: "twzhengrong",
			order: 8,
			result: {
				player(player) {
					if (
						game.hasPlayer(function (target) {
							return (
								get.effect(target, { name: "guohe" }, player, player) >
								4 * Math.max(0, 5 - player.getExpansions("twzhengrong").length)
							);
						})
					) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	twsaotao: {
		trigger: { player: "useCard" },
		filter(event, player) {
			return event.card.name == "sha" || get.type(event.card) == "trick";
		},
		forced: true,
		content() {
			trigger.directHit.addArray(game.players);
			game.log(trigger.card, "不可被响应");
		},
		ai: { directHit_ai: true },
	},
};
