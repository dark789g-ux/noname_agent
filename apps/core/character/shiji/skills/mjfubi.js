import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mjfubi" | "boming" | "ejian" | "yuanqing" | "shuchen" | "hxrenshi" | "hxrenshi2" | "debao">} */
export const groupSkills = {
	mjfubi: {
		audio: "fubi",
		enable: "phaseUse",
		filter(event, player) {
			if (player.hasSkill("mjfubi_round")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				for (var i = 0; i < 4; i++) {
					if (current.hasSkill("mjdingyi_" + i)) {
						return true;
					}
				}
			});
		},
		filterCard: true,
		selectCard: [0, 1],
		filterTarget(card, player, target) {
			if (ui.selected.cards.length) {
				for (var i = 0; i < 4; i++) {
					if (target.hasSkill("mjdingyi_" + i)) {
						return true;
					}
				}
			}
			var num = 0;
			for (var i = 0; i < 4; i++) {
				if (target.hasSkill("mjdingyi_" + i)) {
					return true;
				}
			}
			return num > 1 && num < 4;
		},
		check: () => false,
		position: "he",
		content() {
			"step 0";
			player.addTempSkill("mjfubi_round", "roundStart");
			if (cards.length) {
				player.addSkill("mjfubi_clear");
				player.markAuto("mjfubi_clear", [target]);
				target.addMark("mjdingyi_plus", 1, false);
				game.log(target, "的", "#g【定仪】", "效果增加一倍");
				event.finish();
				return;
			}
			var list = [],
				nums = [];
			for (var i = 0; i < 4; i++) {
				if (!target.hasSkill("mjdingyi_" + i)) {
					list.push(lib.skill["mjdingyi_" + i].title);
					nums.push(i);
				}
			}
			if (list.length) {
				event.nums = nums;
				player
					.chooseControl()
					.set("choiceList", list)
					.set("prompt", "辅弼：请选择为" + get.translation(target) + "更换的〖定仪〗效果")
					.set("ai", function () {
						var player = _status.event.player,
							target = _status.event.getParent().target;
						if (get.attitude(player, target) > 0 && !target.hasSkill("mjdingyi_0")) {
							return 0;
						}
						return _status.event.getParent().nums.length - 1;
					});
			} else {
				event.finish();
			}
			"step 1";
			for (var i = 0; i < 4; i++) {
				if (target.hasSkill("mjdingyi_" + i)) {
					target.removeSkill("mjdingyi_" + i);
				}
			}
			target.addSkill("mjdingyi_" + event.nums[result.index]);
			game.log(target, "的效果被改为", "#g" + lib.skill["mjdingyi_" + event.nums[result.index]].title);
		},
		ai: {
			order: 10,
			expose: 0,
			result: {
				target(player, target) {
					if (target.hasSkill("mjdingyi_0")) {
						return -1;
					}
					return 2;
				},
			},
			combo: "mjdingyi",
		},
		subSkill: {
			round: {},
			clear: {
				trigger: { player: ["phaseBegin", "dieBegin"] },
				forced: true,
				popup: false,
				charlotte: true,
				content() {
					while (player.storage.mjfubi_clear && player.storage.mjfubi_clear.length) {
						var target = player.storage.mjfubi_clear.shift();
						if (target.hasMark("mjdingyi_plus")) {
							target.removeMark("mjdingyi_plus", 1, false);
						}
					}
					delete player.storage.mjfubi_clear;
					player.removeSkill("mjfubi_clear");
				},
			},
		},
	},
	boming: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		filterCard: true,
		position: "he",
		filterTarget: lib.filter.notMe,
		discard: false,
		lose: false,
		delay: false,
		content() {
			player.give(cards, target);
		},
		check(card) {
			return 5 - get.value(card);
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					var card = ui.selected.cards[0];
					if (player.hasSkill("ejian") && !player.getStorage("ejian").includes(target)) {
						var dam = get.damageEffect(target, player, target);
						if (dam > 0) {
							return dam;
						}
						var type = get.type(card, null, target),
							ts = target.getCards("he", function (card) {
								return get.type(card) == type;
							});
						if (ts.length) {
							var val = get.value(ts, target);
							if (val > get.value(card)) {
								return -Math.max(1, val);
							}
							return 0;
						}
					}
					return get.value(card, target) / 1.5;
				},
			},
		},
		group: "boming_draw",
		subSkill: {
			draw: {
				audio: "boming",
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				locked: false,
				filter(event, player) {
					return (
						player.getHistory("lose", function (evt) {
							return evt.getParent(2).name == "boming";
						}).length > 1
					);
				},
				content() {
					player.draw();
				},
			},
		},
	},
	ejian: {
		audio: 2,
		trigger: { global: "gainAfter" },
		forced: true,
		filter(event, player) {
			var evt = event.getParent(),
				target = event.player;
			if (evt.name != "boming" || evt.player != player || player.getStorage("ejian").includes(target) || !target.isIn()) {
				return false;
			}
			var he = target.getCards("he"),
				card = event.cards[0];
			if (!he.includes(card)) {
				return false;
			}
			var type = get.type2(card);
			for (var i of he) {
				if (i != card && get.type2(i) == type) {
					return true;
				}
			}
			return false;
		},
		logTarget: "player",
		content() {
			"step 0";
			event.cardType = get.type2(trigger.cards[0]);
			event.target = trigger.player;
			player.markAuto("ejian", [event.target]);
			event.target
				.chooseControl()
				.set("choiceList", ["受到1点伤害", "展示手牌并弃置所有" + get.translation(event.cardType) + "牌"])
				.set("ai", function (event, player) {
					if (get.damageEffect(player, _status.event.getParent().player, player) >= 0) {
						return 0;
					}
					var type = _status.event.cardType,
						cards = player.getCards("he", function (card) {
							return get.type2(card) == type;
						});
					if (cards.length == 1) {
						return 1;
					}
					if (cards.length >= 2) {
						for (var i = 0; i < cards.length; i++) {
							if (get.tag(cards[i], "save")) {
								return 0;
							}
						}
					}
					if (player.hp == 1) {
						return 1;
					}
					for (var i = 0; i < cards.length; i++) {
						if (get.value(cards[i]) >= 8) {
							return 0;
						}
					}
					if (cards.length > 2 && player.hp > 2) {
						return 0;
					}
					if (cards.length > 3) {
						return 0;
					}
					return 1;
				})
				.set("cardType", event.cardType);
			"step 1";
			if (result.index == 1) {
				if (target.countCards("h") > 0) {
					target.showHandcards();
				}
			} else {
				target.damage();
				event.finish();
			}
			"step 2";
			target.discard(
				target.getCards("he", function (card) {
					return get.type2(card) == event.cardType;
				})
			);
		},
		ai: { combo: "boming", halfneg: true },
		onremove: true,
		intro: { content: "已对$发动过此技能" },
	},
	yuanqing: {
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		forced: true,
		filter(event, player) {
			return player.hasHistory("useCard", function (evt) {
				return evt.getParent("phaseUse") == event;
			});
		},
		content() {
			var map = {},
				cards = [];
			player.getHistory("useCard", function (evt) {
				let type = get.type2(evt.card, false);
				if (!map[type]) {
					map[type] = [];
				}
			});
			for (var i = 0; i < ui.discardPile.childNodes.length; i++) {
				var card = ui.discardPile.childNodes[i],
					type = get.type2(card, false);
				if (map[type]) {
					map[type].push(card);
				}
			}
			for (var i in map) {
				if (map[i].length) {
					cards.push(map[i].randomGet());
				}
			}
			if (cards.length) {
				player.$gain2(cards, false);
				game.cardsGotoSpecial(cards, "toRenku");
				game.log(player, "将", cards, "置入了仁库");
				game.delayx();
			}
		},
		init(player) {
			player.storage.renku = true;
		},
		ai: {
			combo: "shuchen",
		},
	},
	shuchen: {
		audio: 2,
		init(player) {
			player.storage.renku = true;
		},
		trigger: { global: "dying" },
		forced: true,
		filter(event, player) {
			return _status.renku.length > 3;
		},
		logTarget: "player",
		content() {
			player.gain(_status.renku, "gain2", "fromRenku");
			trigger.player.recover();
		},
		ai: {
			combo: "yuanqing",
		},
	},
	hxrenshi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return (
				player.countCards("h") > 0 &&
				(!player.storage.hxrenshi2 ||
					game.hasPlayer(function (current) {
						return !player.storage.hxrenshi2.includes(current);
					}))
			);
		},
		filterCard: true,
		filterTarget(card, player, target) {
			return !player.storage.hxrenshi2 || !player.storage.hxrenshi2.includes(target);
		},
		position: "h",
		discard: false,
		lose: false,
		delay: false,
		check(cardx) {
			var player = _status.event.player;
			if (
				player.getStorage("debao").length == 1 &&
				(!game.hasPlayer(function (current) {
					return get.attitude(player, current) > 0 && current.hp * 1.5 + current.countCards("h") < 4;
				}) ||
					game.hasPlayer(function (current) {
						return get.attitude(player, current) <= 0 && current.hp * 1.5 + current.countCards("h") < 4;
					}))
			) {
				return 0;
			}
			return 5 - get.value(cardx);
		},
		content() {
			player.addTempSkill("hxrenshi2", "phaseUseEnd");
			player.markAuto("hxrenshi2", targets);
			player.give(cards, target);
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					if (ui.selected.cards.length) {
						return get.value(ui.selected.cards[0], target) + 0.1;
					}
					return 0;
				},
			},
		},
	},
	hxrenshi2: {
		onremove: true,
	},
	debao: {
		audio: 2,
		trigger: { global: "gainAfter" },
		forced: true,
		filter(event, player) {
			if (player == event.player || player.getStorage("debao").length >= player.maxHp) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.cards2 && evt.cards2.length > 0;
		},
		content() {
			var cards = get.cards();
			player.markAuto("debao", cards);
			player.$gain2(cards[0], false);
			game.cardsGotoSpecial(cards);
			game.log(player, "将", cards[0], "放在了武将牌上");
			game.delayx();
		},
		marktext: "仁",
		intro: { content: "cards", onunmark: "throw" },
		group: "debao_gain",
		subSkill: {
			gain: {
				audio: "debao",
				trigger: { player: "phaseZhunbeiBegin" },
				forced: true,
				filter(event, player) {
					return player.getStorage("debao").length > 0;
				},
				content() {
					var cards = player.storage.debao;
					player.gain(cards, "gain2", "fromStorage");
					cards.length = 0;
					player.unmarkSkill("debao");
				},
			},
		},
	},
};
