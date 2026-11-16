import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xingqi" | "xinzifu" | "mibei" | "xinmouli" | "mouli" | "zifu">} */
export const groupSkills = {
	//王凌
	xingqi: {
		audio: 2,
		trigger: { player: "useCard" },
		forced: true,
		locked: false,
		filter(event, player) {
			return get.type(event.card, null, false) != "delay" && !player.getStorage("xingqi").includes(event.card.name);
		},
		content() {
			player.markAuto("xingqi", [trigger.card.name]);
			game.log(player, "获得了一个", "#g【备(" + get.translation(trigger.card.name) + ")】");
		},
		marktext: "备",
		intro: {
			content: "$",
			onunmark(storage, player) {
				delete player.storage.xingqi;
			},
		},
		group: "xingqi_gain",
		subSkill: {
			gain: {
				trigger: { player: "phaseJieshuBegin" },
				direct: true,
				filter(event, player) {
					return player.getStorage("xingqi").length > 0;
				},
				content() {
					"step 0";
					player.removeSkill("mibei_mark");
					player.chooseButton(["星启：是否获得一张牌？", [player.getStorage("xingqi"), "vcard"]]).set("ai", function (button) {
						var card = { name: button.link[2] },
							player = _status.event.player;
						if (
							!get.cardPile2(function (cardx) {
								return cardx.name == card.name;
							})
						) {
							return 0;
						}
						return get.value(card, player) * player.getUseValue(card);
					});
					"step 1";
					if (result.bool) {
						player.logSkill("xingqi");
						var name = result.links[0][2];
						game.log(player, "移去了一个", "#g【备(" + get.translation(name) + ")】");
						player.unmarkAuto("xingqi", [name]);
						var card = get.cardPile2(function (card) {
							return card.name == name;
						});
						if (card) {
							player.gain(card, "gain2");
						}
					}
				},
			},
		},
	},
	xinzifu: {
		audio: "zifu",
		trigger: { player: "phaseUseEnd" },
		forced: true,
		filter(event, player) {
			return (
				player.getStorage("xingqi").length > 0 &&
				!player.hasHistory("useCard", function (evt) {
					return evt.getParent("phaseUse") == event;
				})
			);
		},
		content() {
			game.log(player, "移去了所有", "#g【备】");
			player.unmarkSkill("xingqi");
			player.addTempSkill("xinzifu_limit");
			player.addMark("xinzifu_limit", 1, false);
		},
		ai: {
			neg: true,
			combo: "xingqi",
		},
		subSkill: {
			limit: {
				charlotte: true,
				markimage: "image/card/handcard.png",
				intro: {
					content(storage, player) {
						var num = -player.countMark("xinzifu_limit");
						return "手牌上限" + num;
					},
				},
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("xinzifu_limit");
					},
				},
			},
		},
	},
	mibei: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		dutySkill: true,
		forced: true,
		locked: false,
		filter(event, player) {
			if (!player.storage.xingqi || !player.storage.xingqi.length) {
				return false;
			}
			var map = { basic: 0, trick: 0, equip: 0 };
			for (var i of player.storage.xingqi) {
				var type = get.type(i);
				if (typeof map[type] == "number") {
					map[type]++;
				}
			}
			for (var i in map) {
				if (map[i] < 2) {
					return false;
				}
			}
			return true;
		},
		logAudio: () => 1,
		skillAnimation: true,
		animationColor: "water",
		content() {
			"step 0";
			player.awakenSkill(event.name);
			game.log(player, "成功完成使命");
			var list = ["basic", "equip", "trick"],
				cards = [];
			for (var i of list) {
				var card = get.cardPile2(function (card) {
					return get.type(card) == i;
				});
				if (card) {
					cards.push(card);
				}
			}
			if (cards.length) {
				player.gain(cards, "gain2");
			}
			"step 1";
			player.addSkills("xinmouli");
		},
		ai: {
			combo: "xingqi",
		},
		group: ["mibei_fail", "mibei_silent"],
		derivation: "xinmouli",
		subSkill: {
			silent: {
				charlotte: true,
				trigger: { player: "phaseZhunbeiBegin" },
				silent: true,
				lastDo: true,
				filter(event, player) {
					return !player.getStorage("xingqi").length;
				},
				content() {
					player.addTempSkill("mibei_mark");
				},
			},
			mark: { charlotte: true },
			fail: {
				audio: "mibei2.mp3",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return !player.getStorage("xingqi").length && player.hasSkill("mibei_mark");
				},
				forced: true,
				content() {
					game.log(player, "使命失败");
					player.awakenSkill("mibei");
					player.loseMaxHp();
				},
			},
		},
	},
	xinmouli: {
		audio: "mouli",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.getStorage("xingqi").length > 0;
		},
		filterTarget: lib.filter.notMe,
		content() {
			"step 0";
			target.chooseButton(["谋立：是否获得一张牌？", [player.getStorage("xingqi"), "vcard"]], true).set("ai", function (button) {
				var card = { name: button.link[2] },
					player = _status.event.player;
				return get.value(card, player);
			});
			"step 1";
			if (result.bool) {
				var name = result.links[0][2];
				game.log(player, "移去了一个", "#g【备(" + get.translation(name) + ")】");
				player.unmarkAuto("xingqi", [name]);
				var card = get.cardPile2(function (card) {
					return card.name == name;
				});
				if (card) {
					target.gain(card, "gain2");
				}
			}
		},
		ai: {
			combo: "xingqi",
			order: 1,
			result: {
				target(player, target) {
					if (target.hasSkillTag("nogain")) {
						return 0;
					}
					return 1;
				},
			},
		},
	},
	mouli: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterCard: true,
		position: "h",
		filterTarget: lib.filter.notMe,
		discard: false,
		lose: false,
		delay: false,
		check(card) {
			return 8 - get.value(card);
		},
		content() {
			player.give(cards, target);
			if (!target.storage.mouli2) {
				target.storage.mouli2 = [];
			}
			if (!target.storage.mouli3) {
				target.storage.mouli3 = [];
			}
			target.storage.mouli2.add(player);
			target.storage.mouli3.push(player);
			target.addSkill("mouli_effect");
		},
		ai: {
			threaten: 1.2,
			order: 4,
			result: {
				target: 1,
			},
		},
		subSkill: {
			effect: {
				trigger: { player: "useCard" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					if (event.card.name != "sha" && event.card.name != "shan") {
						return false;
					}
					for (var i of player.storage.mouli3) {
						if (i.isIn()) {
							return true;
						}
					}
					return false;
				},
				logTarget(event, player) {
					return player.storage.mouli3;
				},
				content() {
					"step 0";
					game.delayx();
					player.storage.mouli3.sortBySeat();
					if (player.storage.mouli3.length == 1) {
						player.storage.mouli3[0].draw(3);
						player.storage.mouli3.length = 0;
						event.finish();
					} else {
						game.asyncDraw(player.storage.mouli3, 3);
					}
					"step 1";
					player.storage.mouli3.length = 0;
					game.delayx();
				},
				group: ["mouli_sha", "mouli_shan", "mouli_clear"],
				mark: true,
				intro: {
					content: "已因$获得“谋立”效果",
				},
			},
			sha: {
				enable: "chooseToUse",
				viewAs: { name: "sha" },
				filterCard: { color: "black" },
				position: "he",
				prompt: "将一张黑色牌当做杀使用",
				check(card) {
					return 6 - get.value(card);
				},
				viewAsFilter(player) {
					return player.countCards("he", { color: "black" }) > 0;
				},
				ai: {
					respondSha: true,
					skillTagFilter(player) {
						return player.countCards("he", { color: "black" }) > 0;
					},
				},
			},
			shan: {
				enable: "chooseToUse",
				viewAs: { name: "shan" },
				filterCard: { color: "red" },
				position: "he",
				prompt: "将一张红色牌当做闪使用",
				check(card) {
					return 7 - get.value(card);
				},
				viewAsFilter(player) {
					return player.countCards("he", { color: "red" }) > 0;
				},
				ai: {
					respondShan: true,
					skillTagFilter(player) {
						return player.countCards("he", { color: "red" }) > 0;
					},
				},
			},
			clear: {
				trigger: { global: ["phaseBegin", "dieAfter"] },
				forced: true,
				silent: true,
				popup: false,
				lastDo: true,
				forceDie: true,
				filter(event, player) {
					if (event.name == "die" && player == event.player) {
						return true;
					}
					return player.storage.mouli2.includes(event.player);
				},
				content() {
					if (trigger.name == "die" && player == trigger.player) {
						player.removeSkill("mouli_effect");
						delete player.storage.mouli2;
						delete player.storage.mouli3;
						return;
					}
					player.storage.mouli2.remove(trigger.player);
					while (player.storage.mouli3.includes(trigger.player)) {
						player.storage.mouli3.remove(trigger.player);
					}
					if (!player.storage.mouli2.length) {
						player.removeSkill("mouli_effect");
					}
				},
			},
		},
	},
	zifu: {
		audio: 2,
		trigger: { global: "dieAfter" },
		forced: true,
		filter(event, player) {
			return event.player.storage.mouli2 && event.player.storage.mouli2.includes(player);
		},
		content() {
			player.loseMaxHp(2);
		},
		ai: {
			combo: "mouli",
			neg: true,
		},
	},
};
