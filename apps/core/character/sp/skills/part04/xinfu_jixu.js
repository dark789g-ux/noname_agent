import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinfu_jixu" | "jixu_sha" | "xinfu_sanwen" | "xinfu_qiai" | "xinfu_denglou" | "qinguo_use" | "xinfu_qinguo" | "xinfu_jijun">} */
export const groupSkills = {
	xinfu_jixu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			if (ui.selected.targets.length) {
				return target.hp == ui.selected.targets[0].hp;
			}
			return true;
		},
		selectTarget: [1, Infinity],
		multitarget: true,
		multiline: true,
		content() {
			"step 0";
			targets.sort(lib.sort.seat);
			"step 1";
			if (!event.num) {
				event.num = 0;
			}
			if (!event.caicuolist) {
				event.caicuolist = [];
			}
			targets[event.num].chooseBool("是否押杀？").ai = function (event, player) {
				var evt = _status.event.getParent();
				if (get.attitude(targets[event.num], evt.player) > 0) {
					return evt.player.countCards("h", "sha") ? false : true;
				}
				return Math.random() < evt.player.countCards("h") / 4;
			};
			"step 2";
			if (result.bool) {
				targets[event.num].chat("有杀");
				game.log(targets[event.num], "认为", player, "#g有杀");
				if (!player.countCards("h", "sha")) {
					event.caicuolist.add(targets[event.num]);
				}
			} else {
				targets[event.num].chat("没杀");
				game.log(targets[event.num], "认为", player, "#y没有杀");
				if (player.countCards("h", "sha")) {
					event.caicuolist.add(targets[event.num]);
				}
			}
			event.num++;
			game.delay();
			if (event.num < targets.length) {
				event.goto(1);
			}
			"step 3";
			player.popup(player.countCards("h", "sha") ? "有杀" : "没杀");
			game.log(player, player.countCards("h", "sha") ? "有杀" : "没杀");
			if (event.caicuolist.length == 0) {
				var evt = _status.event.getParent("phaseUse");
				if (evt && evt.name == "phaseUse") {
					evt.skipped = true;
					event.finish();
				}
			} else {
				player.draw(event.caicuolist.length);
				if (player.countCards("h", "sha")) {
					player.addTempSkill("jixu_sha");
					player.storage.jixu_sha = event.caicuolist;
					event.finish();
				} else {
					event.num = 0;
				}
			}
			"step 4";
			if (event.num < event.caicuolist.length) {
				var target = event.caicuolist[event.num];
				player.discardPlayerCard(true, "he", target);
				event.num++;
				event.redo();
			}
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) + 0.1;
			},
			result: {
				target(player, target) {
					var raweffect = function (player, target) {
						if (player.countCards("h", "sha")) {
							return get.effect(target, { name: "sha" }, player, target);
						} else {
							var att = get.attitude(player, target);
							var nh = target.countCards("h");
							if (att > 0) {
								if (target.getEquip("baiyin") && target.isDamaged() && get.recoverEffect(target, player, player) > 0) {
									if (target.hp == 1 && !target.hujia) {
										return 1.6;
									}
									if (target.hp == 2) {
										return 0.01;
									}
									return 0;
								}
							}
							var es = target.getCards("e");
							var noe = es.length == 0 || target.hasSkillTag("noe");
							var noe2 = es.length == 1 && es[0].name == "baiyin" && target.isDamaged();
							var noh = nh == 0 || target.hasSkillTag("noh");
							if (noh && (noe || noe2)) {
								return 0;
							}
							if (att <= 0 && !target.countCards("he")) {
								return 1.5;
							}
							return -1.5;
						}
					};
					var num = game.countPlayer(function (current) {
						return current != player && current.hp == target.hp && raweffect(player, current) * get.attitude(player, current) > 0;
					});
					return raweffect(player, target) * Math.max(0, num - 1);
				},
			},
			expose: 0.4,
		},
	},
	jixu_sha: {
		audio: "xinfu_jixu",
		trigger: {
			player: "useCard",
		},
		onremove(player) {
			delete player.storage.jixu_sha;
		},
		filter(event, player) {
			if (event.card.name == "sha") {
				return game.hasPlayer(function (current) {
					return current != player && player.storage.jixu_sha.includes(current) && !event.targets.includes(current);
				});
			}
			return false;
		},
		forced: true,
		silent: true,
		popup: false,
		content() {
			player.logSkill("xinfu_jixu");
			for (var i = 0; i < player.storage.jixu_sha.length; i++) {
				if (!trigger.targets.includes(player.storage.jixu_sha[i]) && player.canUse("sha", player.storage.jixu_sha[i], false)) {
					player.line(player.storage.jixu_sha[i], trigger.card.nature);
					trigger.targets.push(player.storage.jixu_sha[i]);
				}
			}
		},
	},
	xinfu_sanwen: {
		audio: 2,
		usable: 1,
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			var cards = event.getg(player);
			if (!cards || !cards.length) {
				return false;
			}
			var namelist = [];
			var namedlist = [];
			for (var i = 0; i < cards.length; i++) {
				namelist.add(get.name(cards[i]));
			}
			var hs = player.getCards("h");
			for (var j = 0; j < hs.length; j++) {
				if (namelist.includes(get.name(hs[j])) && !cards.includes(hs[j])) {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			var namelist = [];
			var namedlist = [];
			var nameddlist = [];
			var namedddlist = [];
			var cards = trigger.getg(player);
			for (var i = 0; i < cards.length; i++) {
				namelist.add(get.name(cards[i]));
			}
			var hs = player.getCards("h");
			for (var j = 0; j < hs.length; j++) {
				if (namelist.includes(get.name(hs[j])) && !cards.includes(hs[j])) {
					namedlist.push(hs[j]);
					namedddlist.add(get.name(hs[j]));
				}
			}
			for (var k = 0; k < cards.length; k++) {
				if (namedddlist.includes(get.name(cards[k]))) {
					nameddlist.push(cards[k]);
				}
			}
			var showlist = namedlist.concat(nameddlist);
			player.showCards(showlist);
			player.discard(nameddlist);
			player.draw(2 * nameddlist.length);
		},
	},
	xinfu_qiai: {
		skillAnimation: true,
		animationColor: "gray",
		trigger: { player: "dying" },
		limited: true,
		audio: 2,
		content() {
			"step 0";
			player.awakenSkill(event.name);
			event.targets = game
				.filterPlayer(function (current) {
					return current != player;
				})
				.sortBySeat();
			if (!event.targets.length) {
				event.finish();
			}
			"step 1";
			event.current = event.targets.shift();
			if (!event.current.countCards("he")) {
				event.goto(3);
			} else {
				event.current.chooseCard("交给" + get.translation(player) + "一张牌", "he", true).set("ai", function (card) {
					var evt = _status.event.getParent();
					if (get.attitude(_status.event.player, evt.player) > 2) {
						if (card.name == "jiu") {
							return 120;
						}
						if (card.name == "tao") {
							return 110;
						}
					}
					return 100 - get.value(card);
				});
			}
			"step 2";
			if (result.bool && result.cards && result.cards.length) {
				event.current.give(result.cards, player);
			}
			"step 3";
			if (event.targets.length > 0) {
				event.goto(1);
			}
		},
	},
	xinfu_denglou: {
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		limited: true,
		filter(event, player) {
			return player.countCards("h") == 0;
		},
		skillAnimation: true,
		animationColor: "gray",
		content() {
			"step 0";
			player.awakenSkill(event.name);
			event.cards = get.cards(4);
			event.gains = [];
			event.discards = [];
			var content = ["牌堆顶的四张牌", event.cards];
			game.log(player, "观看了", "#y牌堆顶的四张牌");
			player.chooseControl("ok").set("dialog", content);
			"step 1";
			if (get.type(event.cards[0]) != "basic") {
				event.gains.push(event.cards[0]);
				event.cards.remove(event.cards[0]);
			} else {
				var bool = game.hasPlayer(function (current) {
					return player.canUse(event.cards[0], current);
				});
				if (bool) {
					player.chooseUseTarget(event.cards[0], true, false);
				} else {
					event.discards.push(event.cards[0]);
				}
				event.cards.remove(event.cards[0]);
			}
			"step 2";
			if (event.cards.length) {
				event.goto(1);
			} else {
				if (event.gains.length) {
					player.gain(event.gains, "gain2");
				}
				if (event.discards.length) {
					player.$throw(event.discards);
					game.cardsDiscard(event.discards);
				}
			}
		},
	},
	qinguo_use: { audio: 2 },
	xinfu_qinguo: {
		group: "xinfu_qinguo_recover",
		audio: "qinguo_use",
		subfrequent: ["recover"],
		trigger: {
			player: "useCardEnd",
		},
		filter(event, player) {
			return get.type(event.card) == "equip";
		},
		direct: true,
		content() {
			player.chooseUseTarget({ name: "sha" }, get.prompt("xinfu_qinguo"), "视为使用一张【杀】", false).logSkill = "xinfu_qinguo";
		},
		subSkill: {
			recover: {
				audio: "qinguo_use",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				prompt: "是否发动【勤国】回复1点体力？",
				filter(event, player) {
					if (player.isHealthy() || player.countCards("e") != player.hp) {
						return false;
					}
					var evt = event.getl(player);
					if (event.name == "equip" && event.player == player) {
						return event.cards.length != (evt.es?.length ?? 0);
					}
					return evt && evt.es.length;
				},
				frequent: true,
				content() {
					player.recover();
				},
			},
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (
						get.type(card) == "equip" &&
						!get.cardtag(card, "gifts") &&
						game.hasPlayer(function (current) {
							return target.canUse("sha", current);
						})
					) {
						return [1, 1.5];
					}
				},
			},
			noe: true,
			reverseEquip: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "noe") {
					return player.countCards("e") == player.hp + 1;
				}
				return game.hasPlayer(function (current) {
					return player.canUse("sha", current);
				});
			},
		},
	},
	xinfu_jijun: {
		ai: {
			reverseEquip: true,
			effect: {
				target_use(card, player, target, current) {
					if (get.type(card) == "equip" && player == target && player == _status.currentPhase && get.subtype(card) == "equip1") {
						return [1, 3];
					}
				},
			},
			combo: "xinfu_fangtong",
		},
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
		},
		frequent: true,
		filter(event, player) {
			if (player != _status.currentPhase) {
				return false;
			}
			if (event.getParent().triggeredTargets3.length > 1) {
				return false;
			}
			if (get.type(event.card) == "equip" && get.subtype(event.card) != "equip1") {
				return false;
			}
			if (event.targets.includes(player)) {
				return true;
			}
			return false;
		},
		callback() {
			player.addToExpansion(card, "gain2").gaintag.add("xinfu_jijun");
		},
		content() {
			player.judge(function (card) {
				return 1;
			}).callback = lib.skill.xinfu_jijun.callback;
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
			mark(dialog, content, player) {
				var content = player.getExpansions("xinfu_jijun");
				if (content && content.length) {
					dialog.addAuto(content);
					if (player == game.me || player.isUnderControl()) {
						var list = lib.skill.xinfu_fangtong.getAuto(player);
						if (list.length > 0) {
							dialog.addText("<li>推荐方案：" + get.translation(list[0]) + "+ " + get.translation(list.slice(1)));
						}
					}
				}
			},
		},
		marktext: "方",
	},
};
