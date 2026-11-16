import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twshangyi" | "twxiangyu" | "twgyshenxing" | "twbingyi" | "bingyi_xin_guyong">} */
export const groupSkills = {
	//蒋钦
	twshangyi: {
		audio: "spshangyi",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				player.countCards("he") &&
				game.hasPlayer(function (current) {
					return current != player && current.countCards("h");
				})
			);
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h");
		},
		filterCard: true,
		position: "he",
		async content(event, trigger, player) {
			const { target } = event;
			await target.viewHandcards(player);
			var chooseButton;
			if (player.countCards("h")) {
				chooseButton = player.chooseButton(
					[1, 2],
					[
						'###尚义###<div class="text center">选择' + get.translation(target) + "的一张手牌以弃置，或选择你与其的各一张牌以交换</div>",
						'<div class="text center">' + get.translation(target) + "的手牌</div>",
						target.getCards("h"),
						'<div class="text center">你的手牌</div>',
						player.getCards("h"),
					],
					true
				);
			} else {
				chooseButton = player.chooseButton(
					[
						'###尚义###<div class="text center">弃置' + get.translation(target) + "的一张手牌</div>",
						'<div class="text center">' + get.translation(target) + "的手牌</div>",
						target.getCards("h"),
					],
					true
				);
			}
			chooseButton.set("target", target);
			chooseButton.set("ai", function (button) {
				var player = _status.event.player,
					owner = get.owner(button.link),
					color = get.color(button.link, owner),
					value = get.value(button.link, owner);
				if (player.countCards("h")) {
					if (!ui.selected.buttons.length) {
						if (
							player.countCards("h", function (card) {
								return get.color(card, player) == "red" && get.value(card) < 6;
							}) &&
							color == "red" &&
							value > 7
						) {
							return value * 3;
						}
						return value;
					} else {
						if (get.value(ui.selected.buttons[0].link) < 4) {
							return 0;
						}
						return 4 + (get.color(ui.selected.buttons[0].link, get.owner(ui.selected.buttons[0].link)) == "red" ? 3 : 1) - value;
					}
				} else {
					if (color == "black") {
						return value * 1.5;
					}
					return value;
				}
			});
			chooseButton.set("filterButton", function (button) {
				if (get.itemtype(button.link) != "card") {
					return false;
				}
				if (!ui.selected.buttons.length && get.owner(button.link) != _status.event.target) {
					return false;
				}
				if (ui.selected.buttons.length && get.owner(ui.selected.buttons[0].link) == get.owner(button.link)) {
					return false;
				}
				return true;
			});
			const result = await chooseButton.forResult();
			if (result.bool) {
				if (result.links.length == 1) {
					const cards = (await target.modedDiscard(result.links, player).forResult()).cards;
					if (get.color(cards[0], target) === "black") {
						await player.draw();
					}
				} else {
					var links = result.links.slice();
					if (get.owner(links[0]) != player) {
						links.reverse();
					}
					var card1 = links[0],
						card2 = links[1];
					await player.swapHandcards(target, [card1], [card2]);
					if (get.color(card1, player) === "red" && get.color(card2, target) === "red") {
						await player.draw();
					}
				}
			}
		},
		ai: {
			order: 10,
			result: { target: -1 },
		},
	},
	twxiangyu: {
		group: "twxiangyu_lose",
		audio: "zniaoxiang",
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && get.distance(player, event.player) < player.getAttackRange();
		},
		forced: true,
		logTarget: "target",
		init(player) {
			var target = _status.currentPhase;
			if (!target || !target != player) {
				return;
			}
			if (!player.getStorage("twxiangyu_range").length) {
				var targets = game.filterPlayer(current => {
					return current.getHistory("lose").length;
				});
				if (targets.length) {
					player.addTempSkill("twxiangyu_range");
					player.markAuto("twxiangyu_range", targets);
				}
			}
		},
		content() {
			var id = trigger.target.playerid;
			var map = trigger.getParent().customArgs;
			if (!map[id]) {
				map[id] = {};
			}
			if (typeof map[id].shanRequired == "number") {
				map[id].shanRequired++;
			} else {
				map[id].shanRequired = 2;
			}
		},
		mod: {
			attackRange(player, num) {
				return num + Math.min(5, player.getStorage("twxiangyu_range").length);
			},
		},
		subSkill: {
			lose: {
				trigger: {
					global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					return (
						player == _status.currentPhase &&
						game.hasPlayer(function (current) {
							if (player.getStorage("twxiangyu_range").includes(current)) {
								return false;
							}
							var evt = event.getl(current);
							return evt && evt.cards2 && evt.cards2.length > 0;
						})
					);
				},
				silent: true,
				charlotte: true,
				content() {
					player.addTempSkill("twxiangyu_range");
					player.markAuto(
						"twxiangyu_range",
						game.filterPlayer(function (current) {
							if (player.getStorage("twxiangyu_range").includes(current)) {
								return false;
							}
							var evt = trigger.getl(current);
							return evt && evt.cards2 && evt.cards2.length > 0;
						})
					);
					player.syncStorage("twxiangyu_range");
				},
			},
			range: {
				marktext: "羽",
				intro: {
					content(storage, player) {
						var num = Math.min(5, storage ? storage.length : 0);
						return "攻击范围+" + num;
					},
				},
				charlotte: true,
				onremove: true,
			},
		},
	},
	//顾雍
	twgyshenxing: {
		audio: "xinshenxing",
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("he") >= Math.min(2, player.countMark("twgyshenxing_used"));
		},
		selectCard() {
			return Math.min(2, _status.event.player.countMark("twgyshenxing_used"));
		},
		prompt() {
			return "弃置" + get.cnNumber(Math.min(2, _status.event.player.countMark("twgyshenxing_used"))) + "张牌并摸一张牌";
		},
		check(card) {
			var num = _status.event.player.countCards("h", { color: get.color(card) });
			if (get.position(card) == "e") {
				num++;
			}
			return (Math.max(4, 7.1 - num) - get.value(card)) / num;
		},
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		content() {
			player.draw();
			player.addTempSkill("twgyshenxing_used", "phaseUseAfter");
			player.addMark("twgyshenxing_used", 1, false);
		},
		ai: {
			order(item, player) {
				if (!player.hasMark("twgyshenxing_used")) {
					return 10;
				}
				return 1;
			},
			result: { player: 1 },
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				marktext: "慎",
				intro: { content: "已发动过#次" },
			},
		},
	},
	twbingyi: {
		audio: "bingyi_xin_guyong",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		filterx(event, player) {
			var cards = player.getCards("h");
			if (cards.length == 1) {
				return true;
			}
			var color = get.color(cards[0], player),
				type = get.type2(cards[0], player);
			for (var i = 1; i < cards.length; i++) {
				if (color && get.color(cards[i], player) != color) {
					color = false;
				}
				if (type && get.type2(cards[i], player) != type) {
					type = false;
				}
				if (!color && !type) {
					return false;
				}
			}
			return true;
		},
		filtery(event, player) {
			var cards = player.getCards("h");
			if (player.countCards("h") <= 1) {
				return false;
			}
			var color = get.color(cards[0], player),
				type = get.type2(cards[0], player);
			var colorx = true,
				typex = true;
			for (var i = 1; i < cards.length; i++) {
				if (color && get.color(cards[i], player) != color) {
					colorx = false;
				}
				if (type && get.type2(cards[i], player) != type) {
					typex = false;
				}
			}
			return colorx && typex;
		},
		direct: true,
		content() {
			"step 0";
			event.boolx = false;
			if (lib.skill.twbingyi.filtery(trigger, player)) {
				event.boolx = true;
			}
			if (lib.skill.twbingyi.filterx(trigger, player)) {
				player
					.chooseTarget(
						get.prompt("twbingyi"),
						"选择至多" +
							get.cnNumber(player.countCards("h")) +
							"名角色，你展示所有手牌，这些角色各摸一张牌" +
							(event.boolx ? "，然后你移去所有“慎”" : ""),
						[0, player.countCards("h")]
					)
					.set("ai", function (target) {
						return get.attitude(_status.event.player, target);
					}).animate = false;
			} else {
				player.chooseBool(get.prompt("twbingyi"), "展示所有手牌").ai = function () {
					return false;
				};
			}
			"step 1";
			if (result.bool) {
				player.logSkill("twbingyi");
				player.showHandcards(get.translation(player) + "发动了【秉壹】");
				event.targets = result.targets;
			} else {
				event.finish();
			}
			"step 2";
			if (targets && targets.length) {
				player.line(targets, "green");
				targets.sortBySeat();
				game.asyncDraw(targets);
			}
			"step 3";
			if (event.boolx) {
				player.removeMark("twgyshenxing", player.countMark("twgyshenxing"));
			}
		},
		ai: { expose: 0.1 },
	},
	bingyi_xin_guyong: { audio: 2 },
};
