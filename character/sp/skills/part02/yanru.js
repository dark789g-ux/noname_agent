import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yanru" | "hezhong">} */
export const groupSkills = {
	//费祎
	yanru: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			var num = player.countCards("h") % 2;
			return !player.getStorage("yanru_used").includes(num);
		},
		filterCard(card, player) {
			if (player.countCards("h") && player.countCards("h") % 2 == 0) {
				return lib.filter.cardDiscardable(card, player);
			}
			return false;
		},
		selectCard() {
			var player = _status.event.player;
			if (player.countCards("h") && player.countCards("h") % 2 == 0) {
				return [player.countCards("h") / 2, Infinity];
			}
			return -1;
		},
		prompt() {
			var player = _status.event.player;
			return [(player.countCards("h") ? "弃置至少一半的手牌，然后" : "") + "摸三张牌", "摸三张牌，然后弃置至少一半的手牌"][player.countCards("h") % 2];
		},
		check(card) {
			var player = _status.event.player;
			if (player.hasSkill("hezhong") && player.getStorage("hezhong_used").length < 2) {
				if (player.countCards("h") - ui.selected.cards.length > 1) {
					return 1 / (get.value(card) || 0.5);
				}
				return 0;
			}
			if (ui.selected.cards.length < player.countCards("h") / 2) {
				return 5 - get.value(card);
			}
			return 0;
		},
		allowChooseAll: true,
		discard: false,
		lose: false,
		delay: 0,
		content() {
			"step 0";
			var bool = player.countCards("h") % 2;
			if (cards) {
				player.discard(cards);
			}
			player.addTempSkill("yanru_used", "phaseUseAfter");
			player.markAuto("yanru_used", [bool]);
			player.draw(3);
			if (!bool) {
				event.finish();
			}
			"step 1";
			player.chooseToDiscard("h", "宴如：弃置至少一半手牌", [Math.floor(player.countCards("h") / 2), Infinity], true, "allowChooseAll").set("ai", card => {
				var player = _status.event.player;
				if (player.hasSkill("hezhong") && !(player.hasSkill("hezhong_0") && player.hasSkill("hezhong_1")) && player.countCards("h") - ui.selected.cards.length > 2) {
					return 1 / (get.value(card) || 0.5);
				}
				if (!player.hasSkill("hezhong") && ui.selected.cards.length < Math.floor(player.countCards("h") / 2)) {
					return 1 / (get.value(card) || 0.5);
				}
				return 0;
			});
		},
		subSkill: {
			used: { charlotte: true, onremove: true },
		},
		ai: {
			order: 3,
			result: { player: 1 },
		},
	},
	hezhong: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (player.countCards("h") != 1 || typeof get.number(player.getCards("h")[0], player) != "number") {
				return false;
			}
			if (player.getStorage("hezhong_used").length > 1) {
				return false;
			}
			let gain = 0,
				lose = 0;
			if (event.getg) {
				gain = event.getg(player).length;
			}
			if (event.getl) {
				lose = event.getl(player).hs.length;
			}
			return gain != lose;
		},
		prompt2(event, player) {
			let str = "展示最后一张手牌并摸一张牌";
			let list = player.getStorage("hezhong_used");
			if (list.length < 2) {
				str += "，然后令本回合使用点数";
				if (!list.includes("max")) {
					str += "大于";
				}
				if (!list.length) {
					str += "或";
				}
				if (!list.includes("min")) {
					str += "小于";
				}
				str += get.number(player.getCards("h")[0], player);
				str += "的普通锦囊牌额外结算一次";
			}
			return str;
		},
		frequent: true,
		content() {
			"step 0";
			player.showHandcards(get.translation(player) + "发动了【和衷】");
			event.num = get.number(player.getCards("h")[0], player);
			"step 1";
			player.draw();
			"step 2";
			if (player.getStorage("hezhong_used").includes("max")) {
				event._result = { index: 1 };
			} else if (player.getStorage("hezhong_used").includes("min")) {
				event._result = { index: 0 };
			} else {
				player
					.chooseControl()
					.set("choiceList", ["本回合使用点数大于" + num + "的普通锦囊牌额外结算一次", "本回合使用点数小于" + num + "的普通锦囊牌额外结算一次"])
					.set("ai", () => {
						var player = _status.event.player;
						var num = _status.event.num;
						if (
							player.getCards("h").reduce(function (num, card) {
								return num + (get.number(card, player) || 0);
							}, 0) >
							num * 2
						) {
							return 0;
						}
						return 1;
					})
					.set("num", num);
			}
			"step 3";
			var skill = "hezhong_" + result.index;
			player.addTempSkill(skill);
			player.addTempSkill("hezhong_used");
			player.markAuto("hezhong_used", ["max", "min"][result.index]);
			player.markAuto(skill, [num]);
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			0: {
				charlotte: true,
				onremove: true,
				marktext: "＞",
				intro: {
					markcount: list => {
						return list.reduce((str, num) => {
							return str + get.strNumber(num);
						}, "");
					},
					content: "使用的下一张点数大于$的普通锦囊牌额外结算一次",
				},
				audio: "hezhong",
				trigger: { player: "useCard" },
				filter(event, player) {
					if (get.type(event.card) != "trick") {
						return false;
					}
					if (!event.targets.length) {
						return false;
					}
					var num = get.number(event.card, player);
					return typeof num == "number" && player.getStorage("hezhong_0").some(numx => num > numx);
				},
				forced: true,
				usable: 1,
				content() {
					player.unmarkSkill("hezhong_0");
					trigger.effectCount++;
					game.log(trigger.card, "额外结算一次");
				},
				ai: {
					effect: {
						player_use(card, player, target) {
							if (card.name == "tiesuo" && (!player.storage.counttrigger || !player.storage.counttrigger.hezhong_0)) {
								return "zerotarget";
							}
						},
					},
				},
			},
			1: {
				charlotte: true,
				onremove: true,
				marktext: "<",
				intro: {
					markcount: list => {
						return list.reduce((str, num) => {
							return str + get.strNumber(num);
						}, "");
					},
					content: "使用的下一张点数小于$的普通锦囊牌额外结算一次",
				},
				audio: "hezhong",
				trigger: { player: "useCard" },
				filter(event, player) {
					if (get.type(event.card) != "trick") {
						return false;
					}
					if (!event.targets.length) {
						return false;
					}
					var num = get.number(event.card, player);
					return typeof num == "number" && player.getStorage("hezhong_1").some(numx => num < numx);
				},
				forced: true,
				usable: 1,
				content() {
					player.unmarkSkill("hezhong_1");
					trigger.effectCount++;
					game.log(trigger.card, "额外结算一次");
				},
				ai: {
					effect: {
						player_use(card, player, target) {
							if (card.name == "tiesuo" && (!player.storage.counttrigger || !player.storage.counttrigger.hezhong_1)) {
								return "zerotarget";
							}
						},
					},
				},
			},
		},
	},
};
