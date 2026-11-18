import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "juesi" | "shefu" | "shefu2" | "benyu" | "jili" | "zhidao">} */
export const groupSkills = {
	juesi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => get.info("juesi").filterCard(card, player), "h") && game.hasPlayer(current => get.info("juesi").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("he") > 0 && player.inRange(target);
		},
		filterCard(card, player) {
			return get.name(card) == "sha" && lib.filter.cardDiscardable(card, player, "juesi");
		},
		async content(event, trigger, player) {
			const { target } = event;
			const juedou = get.autoViewAs({ name: "juedou", isCard: true });
			if (!target.countDiscardableCards(target, "he")) {
				return;
			}
			const result = await target.chooseToDiscard("he", true).forResult();
			if (target.hp >= player.hp && result?.cards?.length && result.cards[0].name != "sha" && player.canUse(juedou, target)) {
				await player.useCard(juedou, target);
			}
		},
		ai: {
			order: 2,
			result: {
				target(player, target) {
					if (get.effect(target, { name: "juedou" }, player, player) <= 0) {
						return 0;
					}
					if (target.hp < player.hp) {
						if (player.countCards("h") > player.hp) {
							return -0.1;
						}
						return 0;
					}
					var hs1 = target.getCards("h", "sha");
					var hs2 = player.getCards("h", "sha");
					if (hs1.length > hs2.length) {
						return 0;
					}
					var hsx = target.getCards("h");
					if (hsx.length > 2 && hs2.length <= 1 && hsx[0].number < 6) {
						return 0;
					}
					if (hsx.length > 3 && hs2.length <= 1) {
						return 0;
					}
					if (hs1.length > hs2.length - 1 && hs1.length > 0 && (hs2.length <= 1 || hs1[0].number > hs2[0].number)) {
						return 0;
					}
					return -1;
				},
			},
		},
	},
	shefu: {
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		audio: 2,
		init(player) {
			if (!player.storage.shefu) {
				player.storage.shefu = [];
			}
			if (!player.storage.shefu2) {
				player.storage.shefu2 = [];
			}
		},
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			content: "cards",
			onunmark(storage, player) {
				player.storage.shefu = [];
				player.storage.shefu2 = [];
			},
			mark(dialog, content, player) {
				if (content && content.length) {
					dialog.addAuto(content);
					if (player.isUnderControl(true)) {
						var str = "";
						for (var i = 0; i < player.storage.shefu2.length; i++) {
							str += get.translation(player.storage.shefu2[i]);
							if (i < player.storage.shefu2.length - 1) {
								str += "、";
							}
						}
						dialog.add('<div class="text center">' + str + "</div>");
					}
				}
			},
		},
		content() {
			"step 0";
			var list1 = [],
				list2 = [],
				list3 = [];
			for (var i = 0; i < lib.inpile.length; i++) {
				var type = get.type(lib.inpile[i]);
				if (type == "basic") {
					list1.push(["基本", "", lib.inpile[i]]);
				} else if (type == "trick") {
					list2.push(["锦囊", "", lib.inpile[i]]);
				} else if (type == "delay") {
					list3.push(["锦囊", "", lib.inpile[i]]);
				}
			}
			player
				.chooseButton([get.prompt("shefu"), [list1.concat(list2).concat(list3), "vcard"]])
				.set("filterButton", function (button) {
					var player = _status.event.player;
					if (player.storage.shefu2 && player.storage.shefu2.includes(button.link[2])) {
						return false;
					}
					return true;
				})
				.set("ai", function (button) {
					var rand = _status.event.rand;
					switch (button.link[2]) {
						case "sha":
							return 5 + rand[1];
						case "tao":
							return 4 + rand[2];
						case "lebu":
							return 3 + rand[3];
						case "shan":
							return 4.5 + rand[4];
						case "wuzhong":
							return 4 + rand[5];
						case "shunshou":
							return 3 + rand[6];
						case "nanman":
							return 2 + rand[7];
						case "wanjian":
							return 2 + rand[8];
						default:
							return rand[0];
					}
				})
				.set("rand", [Math.random(), Math.random(), Math.random(), Math.random(), Math.random(), Math.random(), Math.random(), Math.random(), Math.random()]);
			"step 1";
			if (result.bool) {
				event.cardname = result.links[0][2];
				player.logSkill("shefu");
				player.chooseCard("he", "选择一张牌作为“伏兵”", true);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var card = result.cards[0];
				event.card = card;
				player.addToExpansion(card, player, "give").gaintag.add("shefu");
			}
			"step 3";
			if (player.getExpansions("shefu").includes(event.card)) {
				player.storage.shefu.push(card);
				player.storage.shefu2.push(event.cardname);
				if (player.isOnline2()) {
					player.send(function (storage) {
						game.me.storage.shefu2 = storage;
					}, player.storage.shefu2);
				}
				player.syncStorage("shefu");
				player.markSkill("shefu");
			}
		},
		group: ["shefu2"],
	},
	shefu2: {
		trigger: { global: ["useCard"] },
		//priority:15,
		audio: "shefu",
		sourceSkill: "shefu",
		filter(event, player) {
			if (_status.currentPhase == player || event.player == player || event.all_excluded) {
				return false;
			}
			return (
				player.storage.shefu2 &&
				player.storage.shefu2.includes(event.card.name) &&
				event.player.getHistory("lose", function (evt) {
					return (evt.relatedEvent || evt.getParent()) == event && evt.hs && evt.hs.length == event.cards.length;
				}).length
			);
		},
		direct: true,
		content() {
			"step 0";
			var effect = 0;
			if (trigger.card.name == "wuxie" || trigger.card.name == "shan") {
				if (get.attitude(player, trigger.player) < -1) {
					effect = -1;
				}
			} else if (trigger.targets && trigger.targets.length) {
				for (var i = 0; i < trigger.targets.length; i++) {
					effect += get.effect(trigger.targets[i], trigger.card, trigger.player, player);
				}
			}
			var str = "设伏：是否令" + get.translation(trigger.player);
			if (trigger.targets && trigger.targets.length) {
				str += "对" + get.translation(trigger.targets);
			}
			str += "使用的" + get.translation(trigger.card) + "失效？";
			var next = player.chooseBool(str, function () {
				var player = _status.event.player;
				var trigger = _status.event.getTrigger();
				if (_status.event.effect < 0) {
					if (trigger.card.name == "sha") {
						var target = trigger.targets[0];
						if (target == player) {
							return !player.countCards("h", "shan");
						} else {
							return target.hp == 1 || (target.countCards("h") <= 2 && target.hp <= 2);
						}
					} else {
						return true;
					}
				}
				return false;
			});
			next.set("effect", effect);
			"step 1";
			if (result.bool) {
				player.logSkill("shefu", trigger.player);
				var index = player.storage.shefu2.indexOf(trigger.card.name);
				if (index != -1) {
					var card = player.storage.shefu[index];
					player.loseToDiscardpile(card);
					player.storage.shefu.splice(index, 1);
					player.storage.shefu2.splice(index, 1);
					if (player.storage.shefu.length == 0) {
						player.unmarkSkill("shefu");
					} else {
						player.syncStorage("shefu");
						player.markSkill("shefu");
						if (player.isOnline2()) {
							player.send(function (storage) {
								game.me.storage.shefu2 = storage;
							}, player.storage.shefu2);
						}
					}
				}
				trigger.targets.length = 0;
				trigger.all_excluded = true;
				if (trigger.player == _status.currentPhase) {
					trigger.player.addTempSkill("baiban");
				}
			}
		},
		ai: {
			threaten: 1.8,
			expose: 0.3,
		},
	},
	benyu: {
		audio: 2,
		audioname2: { sxrm_caocao: "benyu_sxrm_caocao" },
		trigger: { player: "damageEnd" },
		filter(event, player) {
			if (!event.source) {
				return false;
			}
			var nh1 = player.countCards("h");
			var nh2 = event.source.countCards("h");
			var eh = player.countCards("e");
			if (nh1 + eh > nh2 && event.source.isIn()) {
				return true;
			}
			if (nh1 < Math.min(5, nh2)) {
				return true;
			}
		},
		direct: true,
		content() {
			"step 0";
			var num1 = player.countCards("h");
			var num2 = trigger.source.countCards("h");
			var eh = player.countCards("he", function (card) {
				return lib.filter.cardDiscardable(card, player, "benyu");
			});
			var bool1 = false,
				bool2 = false;
			if (num1 < Math.min(num2, 5)) {
				bool1 = true;
			}
			if (eh > num2 && trigger.source.isIn()) {
				bool2 = true;
			}
			if (bool1 && bool2) {
				event.chosen = true;
				player
					.chooseControl("cancel2")
					.set("prompt", get.prompt("benyu", trigger.source))
					.set("choiceList", ["将手牌摸至" + get.cnNumber(Math.min(num2, 5)) + "张", "弃置至少" + get.cnNumber(num2 + 1) + "张牌并对其造成1点伤害"]);
			} else if (bool2) {
				event.goto(3);
			}
			"step 1";
			if (event.chosen) {
				if (result.control == "cancel2") {
					event.finish();
				} else if (result.index == 1) {
					event.goto(3);
				} else {
					event._result = { bool: true };
				}
			} else {
				player.chooseBool(get.prompt("benyu", trigger.source), "将手牌摸至" + get.cnNumber(Math.min(trigger.source.countCards("h"), 5)) + "张");
			}
			"step 2";
			if (result.bool) {
				player.logSkill("benyu", trigger.source);
				player.drawTo(Math.min(trigger.source.countCards("h"), 5));
			}
			event.finish();
			"step 3";
			var num = trigger.source.countCards("h") + 1;
			var args = [[num, player.countCards("he")], "he"];
			if (event.chosen) {
				player.logSkill("benyu", trigger.source);
				args.push(true);
			} else {
				args.push(get.prompt("benyu", trigger.source));
				args.push("弃置" + get.cnNumber(num) + "张牌并对其造成1点伤害");
			}
			var next = player.chooseToDiscard.apply(player, args);
			if (!event.chosen) {
				next.logSkill = ["benyu", trigger.source];
			}
			next.set("ai", function (card) {
				var trigger = _status.event.getTrigger();
				var player = _status.event.player;
				if (ui.selected.cards.length >= _status.event.num) {
					return -1;
				}
				if (get.damageEffect(trigger.source, player, player) > 0 && (get.value(card, player) < 0 || _status.event.num <= 2)) {
					return 8 - get.value(card);
				}
				return -1;
			});
			next.set("num", num);
			"step 4";
			if (result.bool) {
				trigger.source.damage();
			}
		},
	},
	jili: {
		audio: 2,
		trigger: {
			global: "useCardToTarget",
		},
		forced: true,
		check(event, player) {
			return get.effect(player, event.card, event.player, player) > 0;
		},
		filter(event, player) {
			if (get.color(event.card) != "red") {
				return false;
			}
			if (!event.targets) {
				return false;
			}
			if (event.player == player) {
				return false;
			}
			if (event.targets.includes(player)) {
				return false;
			}
			if (get.info(event.card).multitarget) {
				return false;
			}
			var type = get.type(event.card);
			if (type != "basic" && type != "trick") {
				return false;
			}
			if (lib.filter.targetEnabled2(event.card, event.player, player)) {
				for (var i = 0; i < event.targets.length; i++) {
					if (get.distance(event.targets[i], player) <= 1) {
						return true;
					}
				}
			}
			return false;
		},
		autodelay: true,
		content() {
			trigger.getParent().targets.add(player);
			trigger.player.line(player, "green");
		},
	},
	zhidao: {
		audio: 2,
		mod: {
			aiOrder(player, card, num) {
				if (num > 0 && !player.hasSkill("zhidao2") && !get.tag(card, "damage") && (!lib.filter.targetEnabled(card, player, player) || get.effect(player, card, player) <= 0)) {
					return num + 10;
				}
			},
		},
		trigger: { source: "damageSource" },
		filter(event, player) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return player.isPhaseUsing() && event.player.isIn() && event.player.countCards("hej") > 0 && event.player != player && !player.hasSkill("zhidao2");
		},
		forced: true,
		content() {
			var num = 0;
			if (trigger.player.countCards("h")) {
				num++;
			}
			if (trigger.player.countCards("e")) {
				num++;
			}
			if (trigger.player.countCards("j")) {
				num++;
			}
			if (num) {
				player.gainPlayerCard(trigger.player, num, "hej", true).set("filterButton", function (button) {
					for (var i = 0; i < ui.selected.buttons.length; i++) {
						if (get.position(button.link) == get.position(ui.selected.buttons[i].link)) {
							return false;
						}
					}
					return true;
				});
			}
			player.addTempSkill("zhidao2");
		},
	},
};
