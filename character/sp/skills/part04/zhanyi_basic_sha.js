import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhanyi_basic_sha" | "zhanyi_basic_jiu" | "zhanyi_equip" | "zhanyi_trick" | "dingpan" | "hongde" | "ziyuan" | "jugu" | "tuifeng" | "tuifeng2" | "tuifeng3" | "weidi">} */
export const groupSkills = {
	zhanyi_basic_sha: {
		enable: "chooseToUse",
		filterCard: { type: "basic" },
		viewAs: { name: "sha" },
		sourceSkill: "zhanyi",
		viewAsFilter(player) {
			if (!player.countCards("h", { type: "basic" })) {
				return false;
			}
		},
		prompt: "将一张基本牌当杀使用",
		check(card) {
			return 4 - get.value(card);
		},
		ai: {
			skillTagFilter(player) {
				if (!player.countCards("h", { type: "basic" })) {
					return false;
				}
			},
			respondSha: true,
		},
	},
	zhanyi_basic_jiu: {
		enable: "chooseToUse",
		filterCard: { type: "basic" },
		viewAs: { name: "jiu" },
		sourceSkill: "zhanyi",
		viewAsFilter(player) {
			if (!player.countCards("h", { type: "basic" })) {
				return false;
			}
		},
		prompt: "将一张基本牌当酒使用",
		check(card) {
			if (_status.event.type == "dying") {
				return 1;
			}
			return 4 - get.value(card);
		},
		ai: {
			skillTagFilter(player) {
				return player.countCards("h", { type: "basic" }) > 0 && player.hp <= 0;
			},
			save: true,
		},
	},
	zhanyi_equip: {
		trigger: { player: "shaBegin" },
		forced: true,
		sourceSkill: "zhanyi",
		filter(event, player) {
			return event.target.countCards("he") > 0;
		},
		check(event, player) {
			return get.attitude(player, event.target) < 0;
		},
		content() {
			trigger.target.chooseToDiscard("he", true, 2);
		},
	},
	zhanyi_trick: {
		mod: {
			targetInRange() {
				return true;
			},
		},
	},
	dingpan: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.dingpan.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target.countCards("e") > 0;
		},
		usable(skill, player) {
			let num,
				mode = get.mode();
			if (mode == "identity" || mode == "doudizhu") {
				if (mode == "identity" && _status.mode == "purple") {
					num = player.getEnemies().length;
				} else {
					num = get.population("fan");
				}
			} else if (mode == "versus") {
				if (!_status.mode || _status.mode != "two") {
					num = player.getEnemies().length;
				} else {
					const target = game.findPlayer(x => {
						return !game.hasPlayer(y => {
							return x != y && y.getFriends().length > x.getFriends().length;
						});
					});
					num = target ? target.getFriends(true).length : 1;
				}
			} else {
				num = 1;
			}
			return num;
		},
		content() {
			"step 0";
			target.draw();
			"step 1";
			var goon = get.damageEffect(target, player, target) >= 0;
			if (!goon && target.hp >= 4 && get.attitude(player, target) < 0) {
				var es = target.getCards("e");
				for (var i = 0; i < es.length; i++) {
					if (get.equipValue(es[i], target) >= 8) {
						goon = true;
						break;
					}
				}
			}
			target
				.chooseControl(function () {
					if (_status.event.goon) {
						return "选项二";
					}
					return "选项一";
				})
				.set("goon", goon)
				.set("prompt", "定叛")
				.set("choiceList", ["令" + get.translation(player) + "弃置你装备区里的一张牌", "获得你装备区内的所有牌并受到1点伤害"]);
			"step 2";
			if (result.control == "选项一") {
				player.discardPlayerCard(target, true, "e");
				event.finish();
			} else {
				target.gain(target.getCards("e"), "gain2");
			}
			"step 3";
			game.delay(0.5);
			target.damage();
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (get.damageEffect(target, player, target) >= 0) {
						return 2;
					}
					var att = get.attitude(player, target);
					if (att == 0) {
						return 0;
					}
					var es = target.getCards("e");
					if (att > 0 && (target.countCards("h") > 2 || target.needsToDiscard(1))) {
						return 0;
					}
					if (es.length == 1 && att > 0) {
						return 0;
					}
					for (var i = 0; i < es.length; i++) {
						var val = get.equipValue(es[i], target);
						if (val <= 4) {
							if (att > 0) {
								return 1;
							}
						} else if (val >= 7) {
							if (att < 0) {
								return -1;
							}
						}
					}
					return 0;
				},
			},
		},
	},
	hongde: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "gainAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		direct: true,
		filter(event, player) {
			var num = event.getl(player).cards2.length;
			if (event.getg) {
				num = Math.max(num, event.getg(player).length);
			}
			return num > 1;
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("hongde"), "令一名其他角色摸一张牌", function (card, player, target) {
					return target != player;
				})
				.set("ai", function (target) {
					return get.attitude(get.player(), target);
				});
			"step 1";
			if (result.bool) {
				player.logSkill("hongde", result.targets);
				result.targets[0].draw();
			}
		},
	},
	ziyuan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard(card) {
			var num = 0;
			for (var i = 0; i < ui.selected.cards.length; i++) {
				num += get.number(ui.selected.cards[i]);
			}
			return get.number(card) + num <= 13;
		},
		complexCard: true,
		selectCard() {
			var num = 0;
			for (var i = 0; i < ui.selected.cards.length; i++) {
				num += get.number(ui.selected.cards[i]);
			}
			if (num == 13) {
				return ui.selected.cards.length;
			}
			return ui.selected.cards.length + 2;
		},
		discard: false,
		lose: false,
		delay: false,
		filterTarget(card, player, target) {
			return player != target;
		},
		check(card) {
			var num = 0;
			for (var i = 0; i < ui.selected.cards.length; i++) {
				num += get.number(ui.selected.cards[i]);
			}
			if (num + get.number(card) == 13) {
				return 9 - get.value(card);
			}
			if (ui.selected.cards.length == 0) {
				var cards = _status.event.player.getCards("h");
				for (var i = 0; i < cards.length; i++) {
					for (var j = i + 1; j < cards.length; j++) {
						if (cards[i].number + cards[j].number == 13) {
							if (cards[i] == card || cards[j] == card) {
								return 8.5 - get.value(card);
							}
						}
					}
				}
			}
			return 0;
		},
		content() {
			player.give(cards, target, "give");
			target.recover();
		},
		ai: {
			order(skill, player) {
				if (
					game.hasPlayer(function (current) {
						return current.hp < current.maxHp && current != player && get.recoverEffect(current, player, player) > 0;
					})
				) {
					return 10;
				}
				return 1;
			},
			result: {
				player(player, target) {
					if (get.attitude(player, target) < 0) {
						return -1;
					}
					var eff = get.recoverEffect(target, player, player);
					if (eff < 0) {
						return 0;
					}
					if (eff > 0) {
						if (target.hp == 1) {
							return 3;
						}
						return 2;
					}
					if (player.needsToDiscard()) {
						return 1;
					}
					return 0;
				},
			},
			threaten: 1.3,
		},
	},
	jugu: {
		audio: 2,
		mod: {
			maxHandcard(player, num) {
				return num + player.maxHp;
			},
		},
		trigger: { global: "phaseBefore", player: "enterGame" },
		forced: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		content() {
			player.draw(player.maxHp);
		},
	},
	tuifeng: {
		audio: 2,
		trigger: { player: "damageEnd" },
		direct: true,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		content() {
			"step 0";
			player.chooseCard(get.prompt2("tuifeng"), "he", [1, trigger.num]).set("ai", function (card) {
				if (card.name == "du") {
					return 20;
				}
				return 7 - get.useful(card);
			});
			"step 1";
			if (result.bool) {
				player.logSkill("tuifeng");
				player.addToExpansion(result.cards, player, "give").gaintag.add("tuifeng");
			}
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		marktext: "锋",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		group: "tuifeng2",
		ai: {
			threaten: 0.8,
			maixie: true,
			maixie_hp: true,
			notemp: true,
		},
	},
	tuifeng2: {
		audio: "tuifeng",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		sourceSkill: "tuifeng",
		filter(event, player) {
			return player.getExpansions("tuifeng").length > 0;
		},
		content() {
			var cards = player.getExpansions("tuifeng");
			player.draw(2 * cards.length);
			player.addTempSkill("tuifeng3");
			player.addMark("tuifeng3", cards.length, false);
			player.loseToDiscardpile(cards);
		},
	},
	tuifeng3: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + player.countMark("tuifeng3");
				}
			},
		},
		onremove: true,
		charlotte: true,
	},
	weidi: {
		available(mode) {
			return mode == "identity" || (mode == "versus" && _status.mode == "four");
		},
		init(player) {
			const list = [];
			const zhu = get.zhu(player);
			if (zhu && zhu != player && zhu.skills) {
				for (var i = 0; i < zhu.skills.length; i++) {
					if (lib.skill[zhu.skills[i]] && lib.skill[zhu.skills[i]].zhuSkill) {
						list.push(zhu.skills[i]);
					}
				}
			}
			player.addAdditionalSkill("weidi", list);
			game.broadcastAll(function (list) {
				game.expandSkills(list);
				for (var i of list) {
					var info = lib.skill[i];
					if (!info) {
						continue;
					}
					if (!info.audioname2) {
						info.audioname2 = {};
					}
					info.audioname2.yuanshu = "weidi";
				}
			}, list);
		},
		trigger: { global: ["gameStart", "changeSkillsAfter"] },
		forced: true,
		audio: 2,
		filter(event, player) {
			const mode = get.mode();
			if (mode != "identity" && (mode != "versus" || _status.mode != "four")) {
				return false;
			}
			const zhu = get.zhu(player);
			if (!zhu || zhu == player) {
				return false;
			}
			if (event.name == "gameStart") {
				return true;
			}
			return (
				event.player == zhu &&
				(event.addSkill.some(skill => {
					return lib.skill[skill] && lib.skill[skill].zhuSkill;
				}) ||
					event.addSkill.some(skill => {
						return lib.skill[skill] && lib.skill[skill].zhuSkill;
					}))
			);
		},
		async content(event, trigger, player) {
			lib.skill.weidi.init(player);
		},
	},
};
