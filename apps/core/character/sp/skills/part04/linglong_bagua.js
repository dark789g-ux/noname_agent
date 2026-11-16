import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "linglong_bagua" | "zhenwei" | "zhenwei2" | "xunzhi" | "yawang" | "yawang2" | "luoyan_tianxiang" | "luoyan_liuli" | "luoyan" | "xingwu">} */
export const groupSkills = {
	linglong_bagua: {
		audio: "linglong",
		audioname2: { re_jsp_huangyueying: "relinglong" },
		inherit: "bagua_skill",
		sourceSkill: "linglong",
		filter(event, player) {
			if (!lib.skill.bagua_skill.filter(event, player)) {
				return false;
			}
			if (!player.hasEmptySlot(2)) {
				return false;
			}
			return true;
		},
		ai: {
			respondShan: true,
			freeShan: true,
			skillTagFilter(player, tag, arg) {
				if (tag !== "respondShan" && tag !== "freeShan") {
					return;
				}
				if (!player.hasEmptySlot(2) || player.hasSkillTag("unequip2")) {
					return false;
				}
				if (!arg || !arg.player) {
					return true;
				}
				if (
					arg.player.hasSkillTag("unequip", false, {
						target: player,
					})
				) {
					return false;
				}
				return true;
			},
			effect: {
				target(card, player, target) {
					if (player == target && get.subtype(card) == "equip2") {
						if (get.equipValue(card) <= 7.5) {
							return 0;
						}
					}
					if (target.getEquip(2)) {
						return;
					}
					return lib.skill.bagua_skill.ai.effect.target.apply(this, arguments);
				},
			},
		},
	},
	zhenwei: {
		audio: 2,
		audioname: ["re_wenpin"],
		trigger: {
			global: "useCardToTarget",
		},
		direct: true,
		filter(event, player) {
			if (player == event.target || player == event.player) {
				return false;
			}
			if (!player.countCards("he")) {
				return false;
			}
			if (event.targets.length > 1) {
				return false;
			}
			if (!event.target) {
				return false;
			}
			if (event.target.hp >= player.hp) {
				return false;
			}

			var card = event.card;
			if (card.name == "sha") {
				return true;
			}
			if (get.color(card) == "black" && get.type(card, "trick") == "trick") {
				return true;
			}
			return false;
		},
		content() {
			"step 0";
			var save = false;
			if (get.attitude(player, trigger.target) > 2) {
				if (trigger.card.name == "sha") {
					if (player.countCards("h", "shan") || player.getEquip(2) || trigger.target.hp == 1 || player.hp > trigger.target.hp + 1) {
						if (!trigger.target.countCards("h", "shan") || trigger.target.countCards("h") < player.countCards("h")) {
							save = true;
						}
					}
				} else if (trigger.card.name == "juedou" && trigger.target.hp == 1) {
					save = true;
				} else if (trigger.card.name == "shunshou" && get.attitude(player, trigger.player) < 0 && get.attitude(trigger.player, trigger.target) < 0) {
					save = true;
				}
			}
			var next = player.chooseToDiscard("he", get.prompt(event.name, trigger.target), "弃置一张牌，将" + get.translation(trigger.card) + "转移给自己，或令此牌对其无效");
			next.logSkill = [event.name, trigger.target];
			next.set("ai", function (card) {
				if (_status.event.aisave) {
					return 7 - get.value(card);
				}
				return 0;
			});
			next.set("aisave", save);
			"step 1";
			if (result.bool) {
				player
					.chooseControl("转移", "失效", function () {
						var trigger = _status.event.getTrigger();
						var player = _status.event.player;
						if (trigger.card.name == "sha") {
							if (player.countCards("h", "shan")) {
								return "转移";
							}
						} else if (trigger.card.name == "juedou") {
							if (player.countCards("h", "sha")) {
								return "转移";
							}
						}
						return "失效";
					})
					.set("prompt", "将" + get.translation(trigger.card) + "转移给你，或令其失效");
			} else {
				event.finish();
			}
			"step 2";
			if (result.control == "转移") {
				player.draw();
				trigger.getParent().targets.remove(trigger.target);
				trigger.getParent().triggeredTargets2.remove(trigger.target);
				trigger.getParent().targets.push(player);
				trigger.untrigger();
				trigger.player.line(player);
				game.delayx();
			} else {
				var cards = trigger.cards.filterInD();
				if (cards.length > 0) {
					trigger.player.addSkill("zhenwei2");
					trigger.player.addToExpansion(cards, "gain2").gaintag.add("zhenwei2");
				}
				trigger.targets.length = 0;
				trigger.getParent().triggeredTargets2.length = 0;
			}
		},
		ai: {
			threaten: 1.1,
		},
	},
	zhenwei2: {
		audio: false,
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		trigger: { global: "phaseEnd" },
		forced: true,
		charlotte: true,
		sourceSkill: "zhenwei",
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		content() {
			"step 0";
			var cards = player.getExpansions("zhenwei2");
			if (cards.length) {
				player.gain(cards, "gain2");
			}
			"step 1";
			player.removeSkill("zhenwei2");
		},
	},
	xunzhi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		locked: false,
		init(player) {
			player.storage.xunzhi = 0;
		},
		filter(event, player) {
			var previous = player.getPrevious();
			var next = player.getNext();
			if (previous && next) {
				return player.hp != previous.hp && player.hp != next.hp;
			}
			return false;
		},
		check(event, player) {
			return player.hp >= 3 && player.countCards("h") > player.hp + 1 + player.storage.xunzhi;
		},
		content() {
			player.loseHp();
			player.storage.xunzhi += 2;
		},
		mark: true,
		intro: {
			content(storage, player) {
				return "手牌上限+" + player.storage.xunzhi;
			},
		},
		mod: {
			maxHandcard(player, num) {
				if (typeof player.storage.xunzhi == "number") {
					return num + player.storage.xunzhi;
				}
			},
		},
	},
	yawang: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		forced: true,
		filter(event, player) {
			return !event.numFixed;
		},
		check(event, player) {
			var num = game.countPlayer(function (target) {
				return target.hp == player.hp;
			});
			if (!player.hasSkill("xunzhi2")) {
				var nh = player.countCards("h");
				if (nh > 5) {
					return false;
				}
				if (num == 3 && nh > 3) {
					return false;
				}
			}
			return num >= 3;
		},
		content() {
			trigger.changeToZero();
			var num = game.countPlayer(function (target) {
				return target.hp == player.hp;
			});
			if (num) {
				player.draw(num);
			}
			player.storage.yawang = num;
			player.addTempSkill("yawang2");
		},
		ai: {
			halfneg: true,
		},
	},
	yawang2: {
		mod: {
			cardEnabled(card, player) {
				if (_status.currentPhase != player) {
					return;
				}
				if (player.countUsed() >= player.storage.yawang) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (_status.currentPhase != player) {
					return;
				}
				if (player.countUsed() >= player.storage.yawang) {
					return false;
				}
			},
		},
	},
	luoyan_tianxiang: {
		inherit: "tianxiang",
		filter(event, player) {
			if (!player.storage.xingwu || !player.storage.xingwu.length) {
				return false;
			}
			if (player.hasSkill("tianxiang")) {
				return false;
			}
			return lib.skill.tianxiang.filter(event, player);
		},
	},
	luoyan_liuli: {
		inherit: "liuli",
		filter(event, player) {
			if (!player.storage.xingwu || !player.storage.xingwu.length) {
				return false;
			}
			if (player.hasSkill("liuli")) {
				return false;
			}
			return lib.skill.liuli.filter(event, player);
		},
	},
	luoyan: {
		locked: true,
		group: ["luoyan_tianxiang", "luoyan_liuli"],
		derivation: ["tianxiang", "liuli"],
		ai: {
			combo: "xingwu",
		},
	},
	xingwu: {
		audio: 2,
		group: ["xingwu_color", "xingwu_color2"],
		subSkill: {
			color: {
				trigger: { player: "phaseZhunbeiBegin" },
				silent: true,
				content() {
					player.storage.xingwu_color = ["black", "red"];
				},
			},
			color2: {
				trigger: { player: "useCard" },
				silent: true,
				filter(event, player) {
					return Array.isArray(player.storage.xingwu_color) && _status.currentPhase == player;
				},
				content() {
					player.storage.xingwu_color.remove(get.color(trigger.card));
				},
			},
		},
		trigger: { player: "phaseDiscardBegin" },
		direct: true,
		filter(event, player) {
			if (!player.storage.xingwu_color) {
				return false;
			}
			var length = player.storage.xingwu_color.length;
			if (length == 0) {
				return false;
			}
			var hs = player.getCards("h");
			if (hs.length == 0) {
				return false;
			}
			if (length == 2) {
				return true;
			}
			var color = player.storage.xingwu_color[0];
			for (var i = 0; i < hs.length; i++) {
				if (get.color(hs[i]) == color) {
					return true;
				}
			}
			return false;
		},
		intro: {
			content: "cards",
		},
		init(player) {
			player.storage.xingwu = [];
		},
		content() {
			"step 0";
			player
				.chooseCard(get.prompt("xingwu"), function (card) {
					return _status.event.player.storage.xingwu_color.includes(get.color(card));
				})
				.set("ai", function (card) {
					var player = _status.event.player;
					if (player.storage.xingwu.length == 2) {
						if (
							!game.hasPlayer(function (current) {
								return current != player && current.hasSex("male") && get.damageEffect(current, player, player) > 0 && get.attitude(player, current) < 0;
							})
						) {
							return 0;
						}
					}
					return 7 - get.value(card);
				});
			"step 1";
			if (result.bool) {
				player.logSkill("xingwu");
				if (player.storage.xingwu.length < 2) {
					player.$give(result.cards, player);
				}
				player.lose(result.cards, ui.special);
				player.storage.xingwu = player.storage.xingwu.concat(result.cards);
				player.markSkill("xingwu");
				player.syncStorage("xingwu");
			} else {
				event.finish();
			}
			"step 2";
			if (player.storage.xingwu.length == 3) {
				player.$throw(player.storage.xingwu);
				while (player.storage.xingwu.length) {
					player.storage.xingwu.shift().discard();
				}
				player.unmarkSkill("xingwu");
				player
					.chooseTarget(function (card, player, target) {
						return target != player && target.hasSex("male");
					}, "对一名男性角色造成2点伤害并弃置其装备区内的牌")
					.set("ai", function (target) {
						var player = _status.event.player;
						if (get.attitude(player, target) > 0) {
							return -1;
						}
						return get.damageEffect(target, player, player) + target.countCards("e") / 2;
					});
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				var target = result.targets[0];
				target.damage(2);
				event.target = target;
				player.line(target, "green");
			} else {
				event.finish();
			}
			"step 4";
			if (event.target && event.target.isIn()) {
				var es = event.target.getCards("e");
				if (es.length) {
					event.target.discard(es);
				}
			}
		},
		ai: {
			threaten: 1.5,
		},
	},
};
