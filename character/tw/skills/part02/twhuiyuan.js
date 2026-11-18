import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twhuiyuan" | "twshoushou" | "twzhiqu" | "twxianfeng">} */
export const groupSkills = {
	//公孙范
	twhuiyuan: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != player) {
				return false;
			}
			var type = get.type2(event.card);
			return !player.hasHistory("gain", evtx => {
				if (evtx.getParent("phaseUse") != evt) {
					return false;
				}
				return evtx.cards.some(card => get.type2(card) == type);
			});
		},
		direct: true,
		content() {
			"step 0";
			var prompt2 =
				"展示一名角色的一张手牌。若展示牌为" +
				get.translation(get.type2(trigger.card)) +
				"牌，则你获得之，否则其弃置之并摸一张牌。然后若其在你的攻击范围内，且你不在其攻击范围内，你对其造成1点伤害";
			player
				.chooseTarget(get.prompt("twhuiyuan"), prompt2, (card, player, target) => {
					return target.countCards("h");
				})
				.set("ai", target => {
					var player = _status.event.player;
					var att = get.attitude(player, target);
					return -att + (player.inRange(target) && !target.inRange(player) ? get.damageEffect(target, player, player) / 3 : 0);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twhuiyuan", target);
				player.choosePlayerCard(target, "h", true, "回援：展示" + get.translation(target) + "一张手牌");
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var card = result.cards[0];
				target.showCards([card], get.translation(target) + "【回援】展示");
				if (get.type2(card) == get.type2(trigger.card)) {
					if (lib.filter.canBeGained(card, target, player)) {
						player.gain(card, target, "giveAuto", "bySelf");
					}
				} else {
					if (lib.filter.canBeDiscarded(card, target, player)) {
						target.discard(card, player);
						target.draw();
					}
				}
			} else {
				event.finish();
			}
			"step 3";
			if (player.inRange(target) && !target.inRange(player)) {
				game.log(player, "触发了", "#y搏击", "效果");
				player.line(target);
				target.damage();
			}
		},
		ai: {
			expose: 0.2,
			threaten: 3,
		},
	},
	twshoushou: {
		audio: 2,
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			var cards = event.getg(player);
			if (!cards.length) {
				return false;
			}
			return (
				game.hasPlayer(current => {
					return event.getl(current).cards2.length;
				}) &&
				game.hasPlayer(current => {
					return current.inRange(player);
				})
			);
		},
		forced: true,
		locked: false,
		group: "twshoushou_damage",
		onremove(player) {
			if (player.countMark("twshoushou_plus") - player.countMark("twshoushou_minus") == 0) {
				player.removeSkill("twshoushou_distance");
			}
		},
		content() {
			player.addSkill("twshoushou_distance");
			player.addMark("twshoushou_plus", 1, false);
		},
		ai: {
			neg: true,
		},
		subSkill: {
			damage: {
				audio: "twshoushou",
				trigger: {
					player: "damageEnd",
					source: "damageSource",
				},
				filter(event, player) {
					return game.hasPlayer(current => {
						return current != player && !current.inRange(player);
					});
				},
				forced: true,
				locked: false,
				content() {
					player.addSkill("twshoushou_distance");
					player.addMark("twshoushou_minus", 1, false);
				},
			},
			distance: {
				mark: true,
				marktext: "绶",
				intro: {
					markcount(storage, player) {
						return player.countMark("twshoushou_plus") - player.countMark("twshoushou_minus");
					},
					content(storage, player) {
						var dis = player.countMark("twshoushou_plus") - player.countMark("twshoushou_minus");
						return "其他角色至你的距离" + (dis >= 0 ? "+" : "") + dis;
					},
				},
				mod: {
					globalTo(from, to, distance) {
						return distance + to.countMark("twshoushou_plus") - to.countMark("twshoushou_minus");
					},
				},
			},
		},
	},
	//严纲
	twzhiqu: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		content() {
			"step 0";
			var count = get.cnNumber(
				game.countPlayer(current => {
					return get.distance(player, current) <= 1;
				})
			);
			player
				.chooseTarget(
					get.prompt("twzhiqu"),
					"选择一名其他角色并视为使用牌堆顶" +
						count +
						"张牌中的【杀】。若你与其均在对方的攻击范围内，你改为依次对其使用牌堆顶" +
						count +
						"张牌中的【杀】或锦囊牌。",
					lib.filter.notMe
				)
				.set("ai", target => {
					var player = _status.event.player;
					return get.effect(target, { name: "sha" }, player, player) * (get.distance(player, target) == 1 ? 2 : 1);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twzhiqu", target);
				event.fight = player.inRange(target) && target.inRange(player);
				if (event.fight) {
					game.log(player, "触发了", "#y搏击", "效果");
				}
				event.cards = game
					.cardsGotoOrdering(
						get.cards(
							game.countPlayer(current => {
								return get.distance(player, current) <= 1;
							})
						)
					)
					.cards.slice();
			} else {
				event.finish();
			}
			"step 2";
			if (player.isIn() && target.isIn() && cards.length) {
				do {
					var card = cards.shift();
				} while (get.name(card) != "sha" && (!event.fight || get.type2(card) != "trick") && cards.length);
				if (get.name(card) != "sha" && (!event.fight || get.type2(card) != "trick")) {
					return;
				}
				player.showCards([card], get.translation(player) + "发动了【直取】");
				player
					.chooseUseTarget(card, true, false, "nodistance")
					.set("filterTarget", function (card, player, target) {
						var evt = _status.event;
						if (_status.event.name == "chooseTarget") {
							evt = evt.getParent();
						}
						if (target != player && target != evt.twzhiqu_target) {
							return false;
						}
						return lib.filter.targetEnabledx(card, player, target);
					})
					.set("twzhiqu_target", target);
				event.redo();
			}
		},
	},
	twxianfeng: {
		audio: 2,
		trigger: { source: "damageSource" },
		filter(event, player) {
			if (!player.isPhaseUsing()) {
				return false;
			}
			if (player == event.player) {
				return false;
			}
			if (!event.player.isIn()) {
				return false;
			}
			if (!event.card) {
				return false;
			}
			return event.card.name == "sha" || (get.type(event.card) == "trick" && get.tag(event.card, "damage"));
		},
		logTarget: "player",
		check(event, player) {
			let att = get.attitude(player, event.player);
			if (att > 0) {
				return true;
			}
			if (!player.hasSkill("twzhiqu")) {
				return false;
			}
			let cnt = game.countPlayer(current => get.distance(player, current) === 2);
			if (cnt > 2 || (cnt === 2 && Math.abs(att) < 2) || (cnt && Math.abs(att) < 1)) {
				return true;
			}
			return false;
		},
		content() {
			"step 0";
			var target = trigger.player;
			event.target = target;
			target
				.chooseControl()
				.set("choiceList", [
					"你摸一张牌，然后直到" + get.translation(player) + "下个回合开始时，其至其他角色的距离-1",
					get.translation(player) + "摸一张牌，然后直到其下个回合开始时，你至其的距离-1",
				])
				.set("prompt", "先锋：请选择一项")
				.set("ai", () => {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						var att = get.attitude(target, player);
						if (att === 0) {
							return 0;
						}
						if (player.hasSkill("twzhiqu")) {
							var cnt = game.countPlayer(current => get.distance(player, current) === 2);
							if (att > 0) {
								if (cnt || player.needsToDiscard(1)) {
									return 0;
								}
								return 1;
							}
							if (!cnt) {
								return 0;
							}
							if (cnt >= 2 || get.distance(target, player, "attack") === 2 || get.distance(target, player) === 2) {
								return 1;
							}
							return 0;
						}
						if (
							att < 0 ||
							(player.needsToDiscard(1) &&
								game.hasPlayer(function (current) {
									return current !== player && current !== target && !player.inRange(current);
								}))
						) {
							return 0;
						}
						return [0, 1].randomGet();
					})()
				);
			"step 1";
			if (result.index == 0) {
				target.draw();
				player.addTempSkill("twxianfeng_me", { player: "phaseBegin" });
				player.addMark("twxianfeng_me", 1, false);
			} else {
				player.draw();
				target.addSkill("twxianfeng_others");
				game.broadcastAll(
					(target, id) => {
						if (!target.storage.twxianfeng_others) {
							target.storage.twxianfeng_others = {};
						}
						if (typeof target.storage.twxianfeng_others[id] !== "number") {
							target.storage.twxianfeng_others[id] = 1;
						} else {
							target.storage.twxianfeng_others[id]++;
						}
					},
					target,
					player.playerid
				);
			}
		},
		subSkill: {
			me: {
				charlotte: true,
				mark: true,
				intro: { content: "至其他角色的距离-#" },
				mod: {
					globalFrom(from, to, distance) {
						return distance - from.countMark("twxianfeng_me");
					},
				},
			},
			others: {
				trigger: { global: ["phaseBegin", "die"] },
				filter(event, player) {
					return player.storage.twxianfeng_others && player.storage.twxianfeng_others[event.player.playerid];
				},
				charlotte: true,
				mark: true,
				forced: true,
				intro: {
					markcount(storage, player) {
						var max = 0;
						for (var id in storage) {
							if (storage[id] > max) {
								max = storage[id];
							}
						}
						return max;
					},
					content(storage, player) {
						if (!storage) {
							return "";
						}
						var str = "";
						var map = _status.connectMode ? lib.playerOL : game.playerMap;
						for (var id in storage) {
							str += "至" + get.translation(map[id]) + "的距离-" + storage[id] + "、";
						}
						return str.slice(0, -1);
					},
				},
				content() {
					delete player.storage.twxianfeng_others[trigger.player.playerid];
					if (get.is.empty(player.storage.twxianfeng_others)) {
						player.removeSkill("twxianfeng_others");
					}
				},
				mod: {
					globalFrom(from, to, distance) {
						if (from.storage.twxianfeng_others && typeof from.storage.twxianfeng_others[to.playerid] == "number") {
							return distance - from.storage.twxianfeng_others[to.playerid];
						}
					},
				},
			},
		},
	},
};
