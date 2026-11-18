import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "duanbi" | "tongduo" | "yangjie" | "zjjuxiang" | "xinyangjie" | "xinjuxiang" | "houfeng" | "houfeng1">} */
export const groupSkills = {
	//刘巴
	duanbi: {
		limited: true,
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			var num1 = 0,
				num2 = 0;
			var count = game.countPlayer(function (current) {
				num1 += current.countCards("h");
				num2++;
				return current != player;
			});
			return count > 0 && num1 > num2 * 2;
		},
		filterTarget: true,
		selectTarget: -1,
		multitarget: true,
		multiline: true,
		skillAnimation: true,
		animationColor: "orange",
		content() {
			"step 0";
			player.awakenSkill(event.name);
			event.num = 0;
			event.cards = [];
			event.targets.sortBySeat();
			event.targets.remove(player);
			"step 1";
			var target = targets[num];
			var num = Math.min(3, Math.floor(target.countCards("h") / 2));
			if (num > 0) {
				target.chooseToDiscard("h", true, num);
			} else {
				event._result = { bool: false };
			}
			"step 2";
			if (result.bool && Array.isArray(result.cards)) {
				event.cards.addArray(result.cards);
			}
			event.num++;
			if (event.num < targets.length) {
				event.goto(1);
			}
			"step 3";
			event.cards = cards.filter(function (i) {
				return get.position(i, true) == "d";
			});
			if (!event.cards.length) {
				event.finish();
			} else {
				player.chooseTarget("是否令一名角色" + (event.cards.length > 3 ? "随机获得三" : "获得" + get.cnNumber(event.cards.length)) + "张被弃置的牌？").set("ai", function (target) {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					if (target.hasJudge("lebu")) {
						att /= 4;
					}
					return att * Math.sqrt(Math.max(1, 5 - target.countCards("h")));
				});
			}
			"step 4";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "fire");
				target.gain(cards.randomGets(3), "gain2");
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					if (player == target) {
						return 3;
					}
					return -Math.min(3, Math.floor(target.countCards("h") / 2));
				},
			},
		},
	},
	tongduo: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		direct: true,
		usable: 1,
		filter(event, player) {
			return (
				player != event.player &&
				event.targets.length == 1 &&
				game.hasPlayer(function (current) {
					return current.countCards("he") > 0;
				})
			);
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("tongduo"), "令一名角色重铸一张牌", function (card, player, target) {
					return target.hasCard(lib.filter.cardRecastable, "he");
				})
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target) * Math.min(3, Math.floor(target.countCards("h", lib.filter.cardRecastable) / 2));
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("tongduo", target);
			} else {
				event.finish();
			}
			"step 2";
			if (!target.hasCard(lib.filter.cardRecastable, "he")) {
				event.finish();
			} else {
				target.chooseCard("he", true, "请重铸一张牌", lib.filter.cardRecastable);
			}
			"step 3";
			target.recast(result.cards);
		},
	},
	//朱儁
	yangjie: {
		audio: 2,
		group: ["yangjie_add"],
		enable: "phaseUse",
		prompt: "摸一张牌并与一名其他角色进行拼点",
		usable: 1,
		filter(event, player) {
			return !player.hasSkillTag("noCompareSource");
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0 && !target.hasSkillTag("noCompareTarget");
		},
		content() {
			"step 0";
			player.draw();
			"step 1";
			if (player.canCompare(target)) {
				player.chooseToCompare(target).set("small", true);
			} else {
				event.finish();
			}
			"step 2";
			if (!result.bool) {
				var cards = [result.player, result.target].filterInD("d");
				if (!cards.length || !game.hasPlayer(current => current != player && current != target)) {
					event.finish();
				} else {
					event.cards = cards;
					player
						.chooseTarget("请选择一名角色", "令其获得" + get.translation(cards) + "，且视为对" + get.translation(target) + "使用一张火【杀】", function (card, player, target) {
							return target != player && target != _status.event.getParent().target;
						})
						.set("ai", function (target) {
							var player = _status.event.player,
								cards = _status.event.getParent().cards,
								target2 = _status.event.getParent().target;
							var val = get.value(cards, target) * get.attitude(player, target);
							if (val <= 0) {
								return 0;
							}
							return val + target.canUse({ name: "sha", nature: "fire", isCard: true }, target2, false) ? get.effect(target2, { name: "sha", nature: "fire", isCard: true }, target, player) : 0;
						});
				}
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				var source = result.targets[0];
				event.source = source;
				player.line(source);
				source.gain(cards, "gain2");
			} else {
				event.finish();
			}
			"step 4";
			var card = { name: "sha", nature: "fire", isCard: true };
			if (target.isIn() && source.isIn() && source.canUse(card, target, false)) {
				source.useCard(card, target, false);
			}
		},
		subSkill: {
			add: {
				trigger: { player: "compare" },
				forced: true,
				popup: false,
				filter(event, player) {
					return event.getParent().name == "yangjie" && event.num1 > 1 && player.isDamaged();
				},
				content() {
					var num = player.getDamagedHp();
					game.log(player, "的拼点牌点数-", num);
					trigger.num1 = Math.max(1, trigger.num1 - num);
				},
			},
		},
		ai: {
			order: 3,
			result: { target: -1.5 },
		},
	},
	zjjuxiang: {
		audio: 2,
		trigger: { global: "dyingAfter" },
		logTarget: "player",
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		filter(event, player) {
			return event.player != player && event.player.isIn();
		},
		check(event, player) {
			return get.damageEffect(event.player, player, player) > 0;
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			trigger.player.damage();
			"step 1";
			if (trigger.player.maxHp > 0) {
				player.draw(trigger.player.maxHp);
			}
		},
		ai: { expose: 10 },
	},
	xinyangjie: {
		audio: "yangjie",
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(function (target) {
				return player.canCompare(target);
			});
		},
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		usable: 1,
		content() {
			"step 0";
			player.chooseToCompare(target).set("small", true);
			"step 1";
			if (
				!result.bool &&
				game.hasPlayer(function (current) {
					return current != player && current != target && current.canUse({ name: "sha", nature: "fire", isCard: true }, target, false);
				})
			) {
				player
					.chooseTarget("佯解：是否选择另一名其他角色？", "令其视为对" + get.translation(target) + "使用一张火【杀】", function (card, player, target) {
						return target != player && target != _status.event.getParent().target;
					})
					.set("ai", function (target) {
						var player = _status.event.player,
							target2 = _status.event.getParent().target;
						return get.effect(target2, { name: "sha", nature: "fire", isCard: true }, target, player);
					});
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var source = result.targets[0];
				player.line(source);
				game.log(player, "选择了", source);
				var card = { name: "sha", nature: "fire", isCard: true };
				if (target.isIn() && source.isIn() && source.canUse(card, target, false)) {
					source.useCard(card, target, false, "noai");
				}
			}
		},
		ai: {
			order: 3,
			result: {
				target(player, target) {
					var hs = player.getCards("h").sort(function (a, b) {
						return a.number - b.number;
					});
					var ts = target.getCards("h").sort(function (a, b) {
						return a.number - b.number;
					});
					if (!hs.length || !ts.length) {
						return 0;
					}
					if (hs[0].number <= ts[0].number) {
						return -3;
					}
					if (player.countCards("h") >= target.countCards("h")) {
						return -10;
					}
					return -1;
				},
			},
		},
	},
	xinjuxiang: {
		audio: "zjjuxiang",
		inherit: "zjjuxiang",
		content() {
			player.awakenSkill(event.name);
			trigger.player.damage();
		},
	},
	houfeng: {
		audio: 3,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			if (!["zhengsu_leijin", "zhengsu_bianzhen", "zhengsu_mingzhi"].some(i => !event.player.hasSkill(i))) {
				return false;
			}
			return player.inRange(event.player);
		},
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		round: 1,
		logAudio: () => 1,
		logTarget: "player",
		content() {
			"step 0";
			player.chooseButton(["选择" + get.translation(trigger.player) + "要进行的整肃类型", [["zhengsu_leijin", "zhengsu_bianzhen", "zhengsu_mingzhi"].filter(i => !trigger.player.hasSkill(i)), "vcard"]], true).set("ai", () => Math.random());
			"step 1";
			if (result.bool) {
				var name = result.links[0][2],
					target = trigger.player;
				target.addTempSkill("houfeng_share", {
					player: ["phaseDiscardAfter", "phaseAfter"],
				});
				target.markAuto("houfeng_share", [[player, name]]);
				target.addTempSkill(name, { player: ["phaseDiscardAfter", "phaseAfter"] });
				target.markAuto("houfeng", name);
				target.popup(name, "thunder");
				game.delayx();
			}
		},
		subSkill: {
			share: {
				audio: "houfeng",
				charlotte: true,
				onremove: ["houfeng", "houfeng_share"],
				trigger: { player: "phaseDiscardEnd" },
				forced: true,
				getIndex(event, player) {
					return player.getStorage("houfeng");
				},
				logAudio(event, player, _3, data) {
					if (!player.storage[data]) {
						return "houfeng3.mp3";
					}
					return "houfeng2.mp3";
				},
				async content(event, trigger, player) {
					player.unmarkAuto("houfeng", event.indexedData);
					if (!player.storage[event.indexedData]) {
						player.popup("整肃失败", "fire");
						game.log(player, "整肃失败");
						return;
					}
					player.popup("整肃成功", "wood");
					game.log(player, "整肃成功");
					var list = player
						.getStorage("houfeng_share")
						.filter(i => i[1] == event.indexedData && i[0].isIn())
						.map(i => i[0]);
					list.unshift(player);
					let control;
					if (list.some(i => i.isDamaged())) {
						var num1 = 0,
							num2 = 0;
						for (var target of list) {
							num1 += 2 * get.effect(target, { name: "draw" }, player, player);
							num2 += get.recoverEffect(target, player, player);
						}
						control = (
							await trigger.player
								.chooseControl("摸两张牌", "回复体力")
								.set("prompt", "整肃奖励：请选择" + get.translation(list) + "的整肃奖励")
								.set("ai", function () {
									return ["摸两张牌", "回复体力"][_status.event.goon.indexOf(Math.max.apply(Math, _status.event.goon))];
								})
								.set("goon", [num1, num2])
								.forResult()
						).control;
					} else {
						control = "摸两张牌";
					}
					if (control === "摸两张牌") {
						await game.asyncDraw(list, 2);
					} else {
						for (const target of list) {
							await target.recover();
						}
					}
					game.delayx();
				},
			},
		},
	},
	houfeng1: { audio: true },
};
