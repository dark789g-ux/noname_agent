import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twyilie" | "twfenming" | "twgongji" | "twgongji2" | "twjiefan" | "twjiefan2" | "jiefan_re_handang">} */
export const groupSkills = {
	//陈武董袭
	twyilie: {
		audio: "duanxie",
		trigger: { player: "phaseUseBegin" },
		direct: true,
		content() {
			"step 0";
			player
				.chooseControl("选项一", "选项二", "背水！", "cancel2")
				.set("choiceList", [
					"本阶段内使用【杀】的次数上限+1",
					"本回合内使用【杀】指定处于连环状态的目标后，或使用【杀】被【闪】抵消时，摸一张牌",
					"背水！失去1点体力并依次执行上述所有选项",
				])
				.set("ai", function () {
					if (
						player.countCards("hs", function (card) {
							return get.name(card) == "sha" && player.hasValueTarget(card);
						}) > player.getCardUsable({ name: "sha" })
					) {
						return player.hp > 2 ? 2 : 0;
					}
					return 1;
				})
				.set("prompt", get.prompt("twyilie"));
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("twyilie");
				game.log(player, "选择了", "#g【毅烈】", "的", "#y" + result.control);
				if (result.index % 2 == 0) {
					player.addTempSkill("twyilie_add", "phaseUseEnd");
				}
				if (result.index > 0) {
					player.addTempSkill("twyilie_miss");
				}
				if (result.index == 2) {
					player.loseHp();
				}
			}
		},
		subSkill: {
			add: {
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + 1;
						}
					},
				},
				mark: true,
				intro: { content: "本阶段使用【杀】的次数上限+1" },
			},
			miss: {
				charlotte: true,
				audio: "duanxie",
				trigger: { player: ["useCardToTargeted", "shaMiss"] },
				filter(event, player, name) {
					if (name == "useCardToTargeted") {
						return event.card.name == "sha" && event.target.isLinked();
					}
					return true;
				},
				forced: true,
				content() {
					player.draw();
				},
			},
		},
	},
	twfenming: {
		audio: "fenming",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(function (target) {
				return target != player && (target.countCards("he") || !target.isLinked());
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("twfenming"), function (card, player, target) {
					return target != player && (target.countCards("he") || !target.isLinked());
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twfenming", target);
				var list = [],
					choiceList = [
						"令" + get.translation(target) + "弃置一张牌",
						"令" + get.translation(target) + "横置",
						"背水！横置并依次令" + get.translation(target) + "执行上述所有选项",
					];
				if (target.countCards("he")) {
					list.push("选项一");
				} else {
					choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
				}
				if (!target.isLinked()) {
					list.push("选项二");
				} else {
					choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
				}
				if (target.countCards("he") && !target.isLinked() && !player.isLinked()) {
					list.push("背水！");
				} else {
					choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "</span>";
				}
				if (list.length == 1) {
					event._result = { control: list[0] };
				} else {
					player
						.chooseControl(list)
						.set("choiceList", choiceList)
						.set("ai", function () {
							var list = _status.event.controls;
							if (list.includes("背水！")) {
								return "背水！";
							}
							if (list.includes("选项一")) {
								return "选项一";
							}
							return "选项二";
						})
						.set("prompt", "奋命：请选择一项");
				}
			} else {
				event.finish();
			}
			"step 2";
			game.log(player, "选择了", "#y" + result.control);
			if (result.control != "选项二") {
				target.chooseToDiscard("he", true);
			}
			if (result.control != "选项一" && !target.isLinked()) {
				target.link(true);
			}
			if (result.control == "背水！" && !player.isLinked()) {
				player.link(true);
			}
		},
	},
	//韩当
	twgongji: {
		audio: "gongji",
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filterCard: true,
		locked: false,
		filter(event, player) {
			return player.countCards("he");
		},
		check(card) {
			var base = 0,
				player = _status.event.player,
				suit = get.suit(card, player),
				added = false,
				added2 = false,
				added3;
			if (
				get.type(card) == "equip" &&
				game.hasPlayer(function (target) {
					var att = get.attitude(player, target);
					if (att >= 0) {
						return 0;
					}
					if (
						target.countCards("he", function (card) {
							return get.value(card) > 5;
						})
					) {
						return -att;
					}
				})
			) {
				base += 6;
			}
			var hs = player.getCards("h");
			var muniu = player.getEquip("muniu");
			if (muniu && card != muniu && muniu.cards) {
				hs = hs.concat(muniu.cards);
			}
			for (var i of hs) {
				if (i != card && get.name(i) == "sha") {
					if (get.suit(i, player) == suit) {
						if (player.hasValueTarget(i, false)) {
							added3 = true;
							base += 5.5;
						}
					} else {
						if (player.hasValueTarget(i, false)) {
							added2 = true;
						}
						if (!added && !player.hasValueTarget(i, null, true) && player.hasValueTarget(i, false, true)) {
							base += 4;
							added = true;
						}
					}
				}
			}
			if (added3 && !added2) {
				base -= 4.5;
			}
			return base - get.value(card);
		},
		content() {
			"step 0";
			player.addTempSkill("twgongji2");
			player.markAuto("twgongji2", [get.suit(cards[0], player)]);
			"step 1";
			if (get.type(cards[0], null, cards[0].original == "h" ? player : false) == "equip") {
				player
					.chooseTarget("是否弃置一名角色的一张牌？", function (card, player, target) {
						return player != target && target.countCards("he");
					})
					.set("ai", function (target) {
						var player = _status.event.player;
						return get.effect(target, { name: "guohe_copy2" }, player, player);
					});
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				player.line(result.targets, "green");
				player.discardPlayerCard(result.targets[0], "he", true);
			}
		},
		mod: {
			attackRangeBase() {
				return Infinity;
			},
		},
		ai: {
			order: 4.5,
			result: { player: 1 },
		},
	},
	twgongji2: {
		charlotte: true,
		onremove: true,
		mark: true,
		intro: { content: "使用$花色的杀无任何次数限制" },
		trigger: { player: "useCard1" },
		sourceSkill: "twgongji",
		filter(event, player) {
			if (
				_status.currentPhase == player &&
				event.card.name == "sha" &&
				player.getStorage("twgongji2").includes(get.suit(event.card)) &&
				event.addCount !== false
			) {
				return true;
			}
			return false;
		},
		forced: true,
		locked: false,
		popup: false,
		firstDo: true,
		content() {
			trigger.addCount = false;
			if (player.stat[player.stat.length - 1].card.sha > 0) {
				player.stat[player.stat.length - 1].card.sha--;
			}
		},
		mod: {
			cardUsable(card, player) {
				if (card.name == "sha") {
					const suit = get.suit(card);
					if (suit === "unsure" || player.getStorage("twgongji2").includes(suit)) {
						return Infinity;
					}
				}
			},
			aiOrder(player, card, num) {
				if (get.name(card) == "sha" && !player.getStorage("twgongji2").includes(get.suit(card))) {
					return num + 1;
				}
			},
		},
	},
	twjiefan: {
		skillAnimation: true,
		animationColor: "wood",
		audio: "jiefan",
		limited: true,
		enable: "phaseUse",
		filterTarget: true,
		content() {
			"step 0";
			player.awakenSkill(event.name);
			event.players = game.filterPlayer(function (current) {
				return current != target && current.inRange(target);
			});
			event.players.sortBySeat();
			"step 1";
			if (event.players.length) {
				event.current = event.players.shift();
				event.current.addTempClass("target");
				player.line(event.current, "green");
				if (!event.current.countCards("he") || !target.isIn()) {
					event._result = { bool: false };
				} else {
					event.current
						.chooseToDiscard({ subtype: "equip1" }, "he", "解烦：弃置一张武器牌，或令" + get.translation(target) + "摸一张牌")
						.set("ai", function (card) {
							if (!_status.event.target.isIn()) {
								return 0;
							}
							if (get.attitude(_status.event.player, _status.event.target) < 0) {
								return 7 - get.value(card);
							}
							return -1;
						})
						.set("target", target);
				}
			} else {
				player.addSkill("twjiefan2");
				player.markAuto("twjiefan2", [target]);
				event.finish();
			}
			"step 2";
			if (!result.bool && target.isIn()) {
				target.draw();
			}
			event.goto(1);
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					if (player.hp > 2 && game.phaseNumber < game.players.length * 2) {
						return 0;
					}
					var num = 0,
						players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i] != target && players[i].inRange(target)) {
							num++;
						}
					}
					return num;
				},
			},
		},
	},
	twjiefan2: {
		charlotte: true,
		onremove: true,
		trigger: { global: "dying" },
		sourceSkill: "twjiefan",
		filter(event, player) {
			return player.getStorage("twjiefan2").includes(event.player);
		},
		forced: true,
		popup: false,
		content() {
			player.removeSkill("twjiefan2");
			player.restoreSkill("twjiefan");
		},
	},
	jiefan_re_handang: { audio: 2 },
};
