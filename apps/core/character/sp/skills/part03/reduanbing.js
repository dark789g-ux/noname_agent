import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "reduanbing" | "refenxun" | "refenxun2" | "zhuishe" | "reluanzhan" | "reluanzhan_add" | "reluanzhan_remove">} */
export const groupSkills = {
	//新丁奉
	reduanbing: {
		audio: "duanbing",
		audioname2: { heqi: "duanbing_heqi" },
		trigger: { player: "useCard2" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !event.targets.includes(current) && get.distance(player, current) <= 1 && player.canUse(event.card, current);
			});
		},
		direct: true,
		preHidden: ["reduanbing", "reduanbing_sha"],
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt(event.name), "为" + get.translation(trigger.card) + "增加一个目标", function (card, player, target) {
					return !_status.event.sourcex.includes(target) && get.distance(player, target) <= 1 && player.canUse(_status.event.card, target);
				})
				.set("sourcex", trigger.targets)
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.effect(target, _status.event.card, player, player);
				})
				.set("card", trigger.card)
				.setHiddenSkill(event.name);
			"step 1";
			if (result.bool) {
				if (!event.isMine() && !event.isOnline()) {
					game.delayx();
				}
				event.target = result.targets[0];
			} else {
				event.finish();
			}
			"step 2";
			player.logSkill(event.name, event.target);
			trigger.targets.push(event.target);
		},
		ai: {
			effect: {
				player_use(card, player, target, current, isLink) {
					if (!isLink && card.name == "sha") {
						if (player._reduanbingtmp) {
							return;
						}
						player._reduanbingtmp = true;
						if (get.effect(target, card, player, player) <= 0) {
							delete player._reduanbingtmp;
							return;
						}
						if (
							game.hasPlayer(function (current) {
								return current != target && get.distance(player, current) <= 1 && player.canUse(card, current) && get.effect(current, card, player, player) > 0;
							})
						) {
							delete player._reduanbingtmp;
							return [1, 1];
						}
						delete player._reduanbingtmp;
					}
				},
			},
		},
		group: "reduanbing_sha",
		subSkill: {
			sha: {
				audio: "duanbing",
				audioname: ["heqi"],
				trigger: { player: "useCardToPlayered" },
				forced: true,
				filter(event, player) {
					const directHit = event.getParent().directHit;
					return event.card.name == "sha" && directHit !== true && !directHit.includes(event.target) && get.distance(player, event.target) <= 1;
				},
				logTarget: "target",
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
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (arg.card.name != "sha" || arg.target.countCards("h", "shan") > 1 || get.distance(player, arg.target) > 1) {
							return false;
						}
					},
				},
			},
		},
	},
	refenxun: {
		audio: "fenxun",
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filterTarget(card, player, target) {
			return target != player;
		},
		content() {
			player.markAuto("refenxun2", targets);
			player.addTempSkill("refenxun2");
		},
		ai: {
			order: 6.5,
			result: {
				player(player, target) {
					if (get.distance(player, target) <= 1) {
						return 0;
					}
					var hs = player.getCards("h", "shunshou");
					if (hs.length && player.canUse(hs[0], target, false)) {
						return 1;
					}
					var geteff = function (current) {
						return player.canUse("sha", current, false, true) && get.effect(current, { name: "sha" }, player, player) > 0;
					};
					if (player.hasSha() && geteff(target)) {
						var num = game.countPlayer(function (current) {
							return current != player && get.distance(player, current) <= 1 && geteff(current);
						});
						if (num == 0) {
							if (
								game.hasPlayer(function (current) {
									return player.canUse("sha", current) && geteff(current) && current != target;
								})
							) {
								return 1;
							}
						} else if (num == 1) {
							return 1;
						}
					}
					return 0;
				},
			},
		},
	},
	refenxun2: {
		audio: "fenxun",
		trigger: {
			player: "phaseJieshuBegin",
		},
		forced: true,
		charlotte: true,
		sourceSkill: "refenxun",
		filter(event, player) {
			return (
				player.getHistory("sourceDamage", function (evt) {
					return player.storage.refenxun2.includes(evt.player);
				}).length == 0 &&
				player.countCards("he", function (card) {
					return lib.filter.cardDiscardable(card, player, "refenxun2");
				}) > 0
			);
		},
		content() {
			player.chooseToDiscard("he", true);
		},
		onremove: true,
		intro: {
			content: "到$的距离视为1",
		},
		mod: {
			globalFrom(from, to) {
				if (from.storage.refenxun2.includes(to)) {
					return -Infinity;
				}
			},
		},
	},
	//蔡阳新技能
	zhuishe: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + 1;
				}
			},
		},
	},
	//新塌顿
	reluanzhan: {
		audio: "luanzhan",
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		forced: true,
		locked: false,
		content() {
			player.addMark("reluanzhan", 1, false);
		},
		intro: { content: "mark" },
		ai: {
			notemp: true,
		},
		group: ["reluanzhan_add", "reluanzhan_remove"],
	},
	reluanzhan_add: {
		trigger: { player: "useCard2" },
		direct: true,
		sourceSkill: "reluanzhan",
		filter(event, player) {
			if ((event.card.name != "sha" && (get.color(event.card) != "black" || get.type(event.card) != "trick")) || !player.countMark("reluanzhan")) {
				return false;
			}
			var info = get.info(event.card);
			if (info.allowMultiple == false) {
				return false;
			}
			if (event.targets && !info.multitarget) {
				if (
					game.hasPlayer(function (current) {
						return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current) && lib.filter.targetInRange(event.card, player, current);
					})
				) {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			var num = player.countMark("reluanzhan");
			var prompt2 = "为" + get.translation(trigger.card) + "增加至多" + get.cnNumber(num) + "个目标";
			player
				.chooseTarget(
					get.prompt("reluanzhan"),
					function (card, player, target) {
						if (_status.event.targets.includes(target)) {
							return false;
						}
						var player = _status.event.player;
						return lib.filter.targetEnabled2(_status.event.card, player, target) && lib.filter.targetInRange(_status.event.card, player, target);
					},
					[1, num]
				)
				.set("prompt2", prompt2)
				.set("ai", function (target) {
					var trigger = _status.event.getTrigger();
					var player = _status.event.player;
					return get.effect(target, trigger.card, player, player);
				})
				.set("card", trigger.card)
				.set("targets", trigger.targets);
			"step 1";
			if (result.bool) {
				if (!event.isMine() && !event.isOnline()) {
					game.delayx();
				}
				event.targets = result.targets;
			} else {
				event.finish();
			}
			"step 2";
			if (event.targets) {
				player.logSkill("reluanzhan", event.targets);
				trigger.targets.addArray(event.targets);
			}
		},
	},
	reluanzhan_remove: {
		audio: "luanzhan",
		trigger: { player: "useCardToPlayered" },
		forced: true,
		locked: false,
		sourceSkill: "reluanzhan",
		filter(event, player) {
			if (!event.isFirstTarget || (event.card.name != "sha" && (get.color(event.card) != "black" || get.type(event.card) != "trick")) || !player.countMark("reluanzhan")) {
				return false;
			}
			var info = get.info(event.card);
			if (info.allowMultiple == false || info.multitarget) {
				return false;
			}
			return event.targets.length < player.countMark("reluanzhan");
		},
		content() {
			player.removeMark("reluanzhan", Math.ceil(player.countMark("reluanzhan") / 2));
		},
	},
};
