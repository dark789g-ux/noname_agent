import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "shuangren" | "kuanshi" | "xiashu" | "sheyan">} */
export const groupSkills = {
	shuangren: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		preHidden: true,
		filter(event, player) {
			return (
				player.countCards("h") > 0 &&
				game.hasPlayer(function (current) {
					return current != player && player.canCompare(current);
				})
			);
		},
		content() {
			"step 0";
			var goon;
			if (player.needsToDiscard() > 1) {
				goon = player.hasCard(function (card) {
					return card.number > 10 && get.value(card) <= 5;
				});
			} else {
				goon = player.hasCard(function (card) {
					return (card.number >= 9 && get.value(card) <= 5) || get.value(card) <= 3;
				});
			}
			player
				.chooseTarget(get.prompt2("shuangren"), function (card, player, target) {
					return player.canCompare(target);
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					if (_status.event.goon && get.attitude(player, target) < 0) {
						return get.effect(target, { name: "sha" }, player, player);
					}
					return 0;
				})
				.set("goon", goon)
				.setHiddenSkill(event.name);
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("shuangren", target);
				player.chooseToCompare(target);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var target = event.target;
				if (
					game.hasPlayer(function (current) {
						if (target == current) {
							return false;
						}
						if (!player.canUse("sha", current, false)) {
							return false;
						}
						return target.isFriendOf(current);
					})
				) {
					var str = "对一名与" + get.translation(target) + "势力相同的";
					player
						.chooseTarget(str + "角色使用一张杀", true, function (card, player, target) {
							if (!player.canUse("sha", target, false)) {
								return false;
							}
							if (get.mode() == "guozhan") {
								return target.isFriendOf(_status.event.identity);
							}
							return true;
						})
						.set("ai", function (target) {
							var player = _status.event.player;
							return get.effect(target, { name: "sha" }, player, player);
						})
						.set("identity", target);
				} else {
					player.useCard({ name: "sha", isCard: true }, target, false);
					event.finish();
				}
			} else {
				player.addTempSkill("zishou2");
				event.finish();
			}
			"step 3";
			if (result.bool && result.targets && result.targets.length) {
				player.useCard({ name: "sha", isCard: true }, result.targets[0], false);
			}
		},
	},
	kuanshi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					if (get.attitude(get.player(), target) > 0) {
						return 1 / Math.sqrt(target.hp + 1);
					}
					return 0;
				})
				.set("animate", false)
				.forResult();
		},
		logLine: false,
		async content(event, trigger, player) {
			const [target] = event.targets;
			player.addTempSkill(event.name + "_effect", { player: "phaseBegin" });
			player.markAuto(event.name + "_effect", [target]);
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				audio: "kuanshi",
				trigger: { global: "damageBegin4" },
				forced: true,
				filter(event, player) {
					return event.num > 1 && player.getStorage("kuanshi_effect").includes(event.player);
				},
				logtarget: "player",
				async content(event, trigger, player) {
					const target = trigger.player;
					if (player.getStorage(event.name).includes(target)) {
						player.getStorage(event.name).remove(target);
					}
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
					trigger.cancel();
					player.skip("phaseDraw");
				},
			},
		},
	},
	xiashu: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		content() {
			"step 0";
			var maxval = 0;
			var hs = player.getCards("h");
			for (var i = 0; i < hs.length; i++) {
				maxval = Math.max(maxval, get.value(hs[i]));
			}
			player
				.chooseTarget(get.prompt2("xiashu"), lib.filter.notMe)
				.set("ai", function (target) {
					var player = _status.event.player;
					var maxval = _status.event.maxval;
					var dh = target.countCards("h") - player.countCards("h");
					var att = get.attitude(player, target);
					if (target.hasSkill("qingjian")) {
						return false;
					}
					if (dh <= 0) {
						return 0;
					}
					if (att > 0) {
						return 0.1;
					}
					if (maxval >= 8) {
						return 0;
					}
					if (att == 0) {
						return 0.2;
					}
					if (dh >= 3) {
						return dh;
					}
					if (dh == 2) {
						if (maxval <= 7) {
							return dh;
						}
					}
					if (maxval <= 6) {
						return dh;
					}
					return 0;
				})
				.set("maxval", maxval);
			"step 1";
			if (result.bool) {
				player.logSkill("xiashu", result.targets);
				event.target = result.targets[0];
				var hs = player.getCards("h");
				player.give(hs, event.target);
			} else {
				event.finish();
			}
			"step 2";
			var hs = event.target.getCards("h");
			if (!hs.length) {
				event.finish();
				return;
			}
			hs.sort(function (a, b) {
				return get.value(b, player, "raw") - get.value(a, player, "raw");
			});
			event.target
				.chooseCard([1, hs.length], "展示至少一张手牌", true, "allowChooseAll")
				.set("ai", function (card) {
					var rand = _status.event.rand;
					var list = _status.event.list;
					if (_status.event.att) {
						if (ui.selected.cards.length >= Math.ceil(list.length / 2)) {
							return 0;
						}
						var value = get.value(card);
						if (_status.event.getParent().player.isHealthy()) {
							value += (get.tag(card, "damage") ? 1.5 : 0) + (get.tag(card, "draw") ? 2 : 0);
						}
						return value;
					}
					if (ui.selected.cards.length >= Math.floor(list.length / 2)) {
						return 0;
					}
					return list.indexOf(card) % 2 == rand ? 1 : 0;
				})
				.set("rand", Math.random() < 0.6 ? 1 : 0)
				.set("list", hs)
				.set("att", get.attitude(event.target, player) > 0);
			"step 3";
			event.target.showCards(result.cards);
			event.cards1 = result.cards;
			event.cards2 = event.target.getCards("h", function (card) {
				return !event.cards1.includes(card);
			});
			"step 4";
			var choice;
			var num1 = event.cards1.length;
			var num2 = event.cards2.length;
			if (get.attitude(event.target, player) > 0 && num1 >= num2) {
				choice = 0;
			} else if (num1 == num2) {
				choice = Math.random() < 0.45 ? 0 : 1;
			} else if (num1 > num2) {
				if (num1 - num2 == 1) {
					choice = Math.random() < 0.6 ? 0 : 1;
				} else {
					choice = 0;
				}
			} else {
				if (num2 - num1 == 1) {
					choice = Math.random() < 0.6 ? 1 : 0;
				} else {
					choice = 1;
				}
			}
			player
				.chooseControl(function (event, player) {
					return _status.event.choice;
				})
				.set("choiceList", ["获得" + get.translation(event.target) + "展示的牌", "获得" + get.translation(event.target) + "未展示的牌"])
				.set("choice", choice);
			"step 5";
			if (result.index == 0) {
				player.gain(event.cards1, target, "give", "bySelf");
			} else {
				player.gain(event.cards2, target, "giveAuto", "bySelf");
			}
		},
		ai: {
			expose: 0.1,
		},
	},
	sheyan: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			if (!event.targets?.includes(player)) {
				return false;
			}
			const info = get.info(event.card);
			if (!info || info.type != "trick") {
				return false;
			}
			if (info.multitarget) {
				return false;
			}
			if (event.targets.length > 1) {
				return true;
			}
			return game.hasPlayer(current => {
				return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, event.player, current);
			});
		},
		async cost(event, trigger, player) {
			const bool1 = game.hasPlayer(current => {
				return !trigger.targets.includes(current) && lib.filter.targetEnabled2(trigger.card, trigger.player, current);
			});
			const bool2 = trigger.targets.length > 1;
			let str = "";
			if (bool1) {
				str += `为${get.translation(trigger.card)}增加一个目标`;
			}
			if (bool1 && bool2) {
				str += `，或`;
			}
			if (bool2) {
				str += `令${get.translation(trigger.card)}对其中一个目标无效`;
			}
			const next = player
				.chooseTarget(get.prompt(event.skill), str, (card, player, target) => {
					const trigger = get.event().getTrigger();
					if (trigger.targets.includes(target) && trigger.targets.length > 1) {
						return true;
					}
					return !trigger.targets.includes(target) && lib.filter.targetEnabled2(trigger.card, trigger.player, target);
				})
				.set("ai", target => {
					const player = get.player();
					const trigger = get.event().getTrigger();
					return get.effect(target, trigger.card, player, player) * (trigger.targets.includes(target) ? -1 : 1);
				})
				.set("targets", trigger.targets);
			next.targetprompt2.add(target => {
				const trigger = get.event().getTrigger();
				if (!target.classList.contains("selectable") || !trigger.targets.includes(target)) {
					return;
				}
				return "可无效";
			});
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			event.type = trigger.targets.includes(target) ? "remove" : "add";
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			if (event.type == "remove") {
				trigger.getParent().excluded.add(target);
				game.log(trigger.card, "对", target, "无效");
			} else {
				trigger.targets.add(target);
				game.log(target, "成为了", trigger.card, "的目标");
			}
		},
		ai: { expose: 0.2 },
	},
};
