import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "spmanwang" | "sppanqin" | "zengou" | "qhzhangji" | "rebaobian" | "yuanchou" | "juesheng">} */
export const groupSkills = {
	//SP孟获
	spmanwang: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		selectCard: [1, Infinity],
		check(card) {
			var player = _status.event.player;
			var max = Math.min(player.isDamaged() ? 3 : 2, 4 - player.countMark("spmanwang"));
			if (!max && !player.hasSkill("sppanqin")) {
				return 0;
			}
			if (max == 0 && ui.selected.length > 0) {
				return 0;
			}
			return 7 - ui.selected.cards.length - get.value(card);
		},
		allowChooseAll: true,
		content() {
			var num = Math.min(cards.length, 4 - player.countMark("spmanwang"));
			if (num >= 1) {
				player.addSkills("sppanqin");
			}
			if (num >= 2) {
				player.draw();
			}
			if (num >= 3) {
				player.recover();
			}
			if (num >= 4) {
				player.draw(2);
				player.removeSkills("sppanqin");
			}
		},
		intro: { content: "已经移去过#个选项" },
		ai: {
			order: 2,
			result: {
				player(player, target) {
					if (player.getUseValue({ name: "nanman" }) <= 0) {
						return 0;
					}
					if (player.getStat("skill").spmanwang && player.hasSkill("sppanqin")) {
						return 0;
					}
					return 1;
				},
			},
		},
		derivation: "sppanqin",
	},
	sppanqin: {
		audio: 2,
		trigger: { player: ["phaseUseEnd", "phaseDiscardEnd"] },
		filter(event, player) {
			var cards = [],
				bool = true;
			player.getHistory("lose", function (evt) {
				if (!bool || evt.type != "discard" || evt.getParent(event.name) != event) {
					return false;
				}
				for (var i of evt.cards2) {
					if (get.position(i, true) == "d") {
						cards.add(i);
						if (!game.checkMod(i, player, "unchanged", "cardEnabled2", player)) {
							bool = false;
						}
					}
				}
			});
			if (!bool || !cards.length) {
				return false;
			}
			return player.hasUseTarget(get.autoViewAs({ name: "nanman" }, cards));
		},
		prompt2(event, player) {
			var cards = [];
			player.getHistory("lose", function (evt) {
				if (evt.type != "discard" || evt.getParent(event.name) != event) {
					return false;
				}
				for (var i of evt.cards2) {
					if (get.position(i, true) == "d") {
						cards.add(i);
					}
				}
			});
			return "将" + get.translation(cards) + "（共计" + get.cnNumber(cards.length) + "张牌）当做【南蛮入侵】使用";
		},
		check(event, player) {
			var cards = [],
				bool = true;
			player.getHistory("lose", function (evt) {
				if (!bool || evt.type != "discard" || evt.getParent(event.name) != event) {
					return false;
				}
				for (var i of evt.cards2) {
					if (get.position(i, true) == "d") {
						cards.add(i);
						if (!game.checkMod(i, player, "unchanged", "cardEnabled2", player)) {
							bool = false;
						}
					}
				}
			});
			if (!bool || !cards.length) {
				return false;
			}
			return player.hasValueTarget(get.autoViewAs({ name: "nanman" }, cards));
		},
		content() {
			"step 0";
			var cards = [];
			player.getHistory("lose", function (evt) {
				if (evt.type != "discard" || evt.getParent(trigger.name) != trigger) {
					return false;
				}
				for (var i of evt.cards2) {
					if (get.position(i, true) == "d") {
						cards.add(i);
					}
				}
			});
			player.chooseUseTarget(true, { name: "nanman" }, cards);
			player.addTempSkill("sppanqin_eff");
		},
		subSkill: {
			eff: {
				trigger: { player: "useCard" },
				charlotte: true,
				forced: true,
				popup: false,
				filter(event, player) {
					return event.card.name == "nanman" && event.getParent(2).name == "sppanqin" && player.countMark("spmanwang") < 4 && player.hasSkill("spmanwang", null, null, false) && event.cards.length <= event.targets.length;
				},
				content() {
					player.addMark("spmanwang", 1, false);
					switch (player.countMark("spmanwang")) {
						case 1:
							player.draw(2);
							player.removeSkills("sppanqin");
							break;
						case 2:
							player.recover();
							break;
						case 3:
							player.draw();
							break;
						case 4:
							player.addSkills("sppanqin");
							break;
					}
				},
			},
		},
	},
	//清河公主
	zengou: {
		audio: 2,
		trigger: { global: "useCard" },
		filter(event, player) {
			return (
				event.card.name == "shan" &&
				player.inRange(event.player) &&
				(player.hp > 0 ||
					player.hasCard(function (card) {
						return get.type(card) != "basic" && lib.filter.cardDiscardable(card, player, "zengou");
					}, "eh"))
			);
		},
		logTarget: "player",
		check(event, player) {
			if (get.attitude(player, event.player) >= 0) {
				return false;
			}
			if (get.damageEffect(event.player, event.getParent(3).player, player, get.nature(event.card)) <= 0) {
				return false;
			}
			if (
				player.hasCard(function (card) {
					return get.type(card) != "basic" && get.value(card) < 7 && lib.filter.cardDiscardable(card, player, "zengou");
				}, "eh")
			) {
				return true;
			}
			return player.hp > Math.max(1, event.player.hp);
		},
		content() {
			"step 0";
			trigger.all_excluded = true;
			var str = "弃置一张非基本牌";
			if (player.hp > 0) {
				str += "，或点「取消」失去1点体力";
			}
			var next = player
				.chooseToDiscard(
					str,
					function (card) {
						return get.type(card) != "basic";
					},
					"he"
				)
				.set("ai", function (card) {
					return 7 - get.value(card);
				});
			if (player.hp <= 0) {
				next.set("forced", true);
			}
			"step 1";
			if (!result.bool) {
				player.loseHp();
			}
			"step 2";
			var cards = trigger.cards.filterInD();
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
	},
	qhzhangji: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			if (!event.player.isIn()) {
				return false;
			}
			if (player.getHistory("sourceDamage").length > 0) {
				return true;
			}
			if (player.getHistory("damage").length > 0) {
				return event.player.countCards("he") > 0;
			}
			return false;
		},
		content() {
			"step 0";
			event.target = trigger.player;
			if (player.getHistory("sourceDamage").length) {
				player
					.chooseBool(get.prompt("qhzhangji", event.target), "令" + get.translation(event.target) + "摸两张牌")
					.set("choice", get.attitude(player, event.target) > 0)
					.set("ai", () => _status.event.choice);
			} else {
				event.goto(2);
			}
			"step 1";
			if (result.bool) {
				player.logSkill("qhzhangji", target);
				event.logged = true;
				target.draw(2);
			}
			"step 2";
			if (target.isIn() && target.countCards("he") > 0 && player.getHistory("damage").length > 0) {
				player
					.chooseBool(get.prompt("qhzhangji", event.target), "令" + get.translation(event.target) + "弃置两张牌")
					.set("choice", get.attitude(player, event.target) < 0)
					.set("ai", () => _status.event.choice);
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				if (!event.logged) {
					player.logSkill("qhzhangji", target);
				}
				target.chooseToDiscard("he", true, 2);
			}
		},
	},
	//十周年夏侯霸
	rebaobian: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			for (var i of lib.skill.rebaobian.derivation) {
				if (!player.hasSkill(i, null, null, false)) {
					return true;
				}
			}
			return false;
		},
		forced: true,
		content() {
			for (var i of lib.skill.rebaobian.derivation) {
				if (!player.hasSkill(i, null, null, false)) {
					player.addSkills(i);
					break;
				}
			}
		},
		ai: {
			maixie: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage") && !target.hasSkill("tiaoxin", null, null, false)) {
						if (!target.hasFriend()) {
							return;
						}
						if (target.hp >= 4) {
							return [0, 1];
						}
					}
				},
			},
		},
		derivation: ["tiaoxin", "olpaoxiao", "xinshensu"],
	},
	//范强张达
	yuanchou: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		filter(event) {
			return event.card.name == "sha" && get.color(event.card) == "black";
		},
		forced: true,
		logTarget: "target",
		content() {
			trigger.target.addTempSkill("qinggang2");
			trigger.target.storage.qinggang2.add(trigger.card);
		},
		ai: {
			unequip_ai: true,
			skillTagFilter(player, tag, arg) {
				if (arg && arg.name == "sha" && get.color(arg.card) == "black") {
					return true;
				}
				return false;
			},
		},
		global: "yuanchou_ai",
		subSkill: {
			ai: {
				unequip_ai: true,
				skillTagFilter(player, tag, arg) {
					if (arg && arg.name == "sha" && get.color(arg.card) == "black" && arg.target && arg.target.hasSkill("yuanchou")) {
						return true;
					}
					return false;
				},
			},
		},
	},
	juesheng: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		viewAs: { name: "juedou", isCard: true },
		filterCard: () => false,
		selectCard: -1,
		precontent() {
			player.awakenSkill("juesheng");
			player.addTempSkill("juesheng_counter");
		},
		ai: {
			result: {
				player(player, target) {
					let num = Math.max(target.getAllHistory("useCard", evt => evt.card.name == "sha").length,1);
					if (num < target.hp) {
						return 0;
					}
					return num * lib.card.juedou.ai.result.player.apply(this, arguments);
				},
				target(player, target) {
					let num = Math.max(target.getAllHistory("useCard", evt => evt.card.name == "sha").length,1);
					if (num < target.hp) {
						return 0;
					}
					let res = num * lib.card.juedou.ai.result.target.apply(this, arguments);
					if (res >= 0) {
						return 0;
					}
					return res;
				},
			},
		},
		subSkill: {
			counter: {
				trigger: { global: "damageBegin1" },
				forced: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					var evt = event.getParent();
					return evt.skill == "juesheng" && evt.player == player;
				},
				content() {
					var target = trigger.getParent().target;
					trigger.num = Math.max( target.getAllHistory("useCard", evt => evt.card.name == "sha").length,1);
					target.addTempSkills("juesheng", { player: "phaseAfter" });
				},
			},
		},
	},
};
