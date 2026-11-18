import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twsuizheng" | "twtuidao" | "twqianju" | "twqingxi" | "twzaoli">} */
export const groupSkills = {
	//魏续
	twsuizheng: {
		audio: 3,
		trigger: { global: "phaseBefore", player: "enterGame" },
		filter(event, player) {
			return game.hasPlayer(current => current != player) && (event.name != "phase" || game.phaseNumber == 0);
		},
		forced: true,
		logAudio: () => 1,
		content() {
			"step 0";
			player.chooseTarget("请选择【随征】的目标", lib.translate.twsuizheng_info, lib.filter.notMe, true).set("ai", function (target) {
				var player = _status.event.player;
				return Math.max(1 + get.attitude(player, target) * get.threaten(target), Math.random());
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target);
				game.log(player, "选择了", target, "作为", "“随征”角色");
				player.markAuto("twsuizheng", [target]);
				player.addSkill("twsuizheng_draw");
				player.addSkill("twsuizheng_xianfu");
			}
		},
		ai: { expose: 0.3 },
		intro: { content: "已选择$为“随征”角色" },
		subSkill: {
			draw: {
				charlotte: true,
				audio: "twsuizheng3.mp3",
				trigger: { global: "damageSource" },
				filter(event, player) {
					return player.getStorage("twsuizheng").includes(event.source);
				},
				forced: true,
				logTarget: "source",
				content() {
					player.draw();
				},
			},
			xianfu: {
				audio: "twsuizheng2.mp3",
				trigger: { global: "damageEnd" },
				filter(event, player) {
					return player.getStorage("twsuizheng").includes(event.player) && event.player.isIn();
				},
				forced: true,
				charlotte: true,
				logTarget: "player",
				content() {
					"step 0";
					player
						.chooseToDiscard(
							2,
							"随征：弃置两张基本牌",
							"若你弃牌，你令" +
								get.translation(trigger.player) +
								"回复1点体力；或点击“取消”失去1点体力，令" +
								get.translation(trigger.player) +
								"获得一张【杀】或【决斗】",
							{ type: "basic" }
						)
						.set("ai", function (card) {
							if (_status.event.refuse) {
								return -1;
							}
							return 6 - get.value(card);
						})
						.set("refuse", get.attitude(player, trigger.player) <= 0 || get.effect(player, { name: "losehp" }) >= 0);
					"step 1";
					if (result.bool) {
						trigger.player.recover();
					} else {
						player.loseHp();
						var card = get.cardPile(function (card) {
							return card.name == "sha" || card.name == "juedou";
						});
						if (card) {
							trigger.player.gain(card, "gain2");
						}
					}
				},
			},
		},
	},
	twtuidao: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			var targets = player.getStorage("twsuizheng");
			if (!targets.length) {
				return false;
			}
			return targets.some(target => target.hp <= 2 || !target.isIn());
		},
		check(event, player) {
			var targets = player.getStorage("twsuizheng");
			var val = 0;
			for (var target of targets) {
				if (target.hp <= 2 && target.isIn()) {
					val -= get.attitude(player, target);
				} else if (!target.isIn()) {
					val += 6;
				}
			}
			return val > 0;
		},
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		content() {
			"step 0";
			player.awakenSkill(event.name);
			var list1 = ["equip3", "equip4"].map(i => get.translation(i)),
				list2 = ["basic", "trick", "equip"].map(i => get.translation(i));
			var targets = player.getStorage("twsuizheng"),
				str = get.translation(targets);
			if (targets.length) {
				str = "与" + str;
			}
			player
				.chooseButton(2, true, [
					"颓盗：废除你" + str + "的一个坐骑栏废除并选择一个类别",
					"坐骑栏",
					[list1, "tdnodes"],
					"类别",
					[list2, "tdnodes"],
				])
				.set("filterButton", function (button) {
					var list = _status.event.list,
						link = button.link;
					if (ui.selected.buttons.length) {
						if (list.includes(ui.selected.buttons[0].link) && list.includes(link)) {
							return false;
						}
						if (!list.includes(ui.selected.buttons[0].link) && !list.includes(link)) {
							return false;
						}
					}
					return true;
				})
				.set("ai", function (button) {
					var player = _status.event.player;
					var list = _status.event.list,
						link = button.link;
					if (list.includes(link)) {
						if (player.hasDisabledSlot(4)) {
							return "攻击马";
						}
						if (player.hasDisabledSlot(3)) {
							return "防御马";
						}
						return "攻击马";
					}
					if (!list.includes(link)) {
						var player = _status.event.player;
						var targets = player.getStorage("twsuizheng");
						for (var target of targets) {
							if (target.isIn()) {
								var listx = [0, 0, 0],
									list2 = ["basic", "trick", "equip"].map(i => get.translation(i));
								for (var i of target.getCards("he")) {
									listx[list2.indexOf(get.translation(get.type2(i)))]++;
								}
								return list2[listx.indexOf(Math.max.apply(Math, listx))];
							}
						}
						return 1 + Math.random();
					}
				})
				.set("list", list1);
			"step 1";
			if (result.links[0].indexOf("马") == -1) {
				result.links.reverse();
			}
			var subtype = result.links[0] == "防御马" ? "equip3" : "equip4",
				type = { 基本: "basic", 锦囊: "trick", 装备: "equip" }[result.links[1]];
			player.disableEquip(subtype);
			var targets = player.getStorage("twsuizheng");
			for (var target of targets) {
				if (target && target.isIn()) {
					target.disableEquip(subtype);
					var cards = target.getCards("he", card => get.type2(card) == type);
					player.gain(cards, target, "give");
					event.gainners = cards;
				} else {
					var cards = [];
					for (var i = 1; i <= 2; i++) {
						var card = get.cardPile2(function (card) {
							return !cards.includes(card) && get.type2(card) == type;
						});
						if (card) {
							cards.push(card);
						} else {
							break;
						}
					}
					player.gain(cards, "gain2");
					event.gainners = cards;
				}
			}
			"step 2";
			player
				.chooseTarget("请重新选择【随征】目标", true, function (card, player, target) {
					return !player.getStorage("twsuizheng").includes(target);
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					return Math.max(1 + get.attitude(player, target) * get.threaten(target), Math.random());
				});
			"step 3";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target);
				game.log(player, "选择了", target, "作为", "“随征”角色");
				delete player.storage.twsuizheng;
				player.markAuto("twsuizheng", [target]);
			}
		},
		ai: { combo: "twsuizheng" },
	},
	//曹休
	twqianju: {
		audio: "xinqingxi1.mp3",
		trigger: { source: "damageSource" },
		filter(event, player) {
			return get.distance(player, event.player) <= 1 && player.countCards("e") < 5;
		},
		forced: true,
		usable: 1,
		content() {
			var card = get.cardPile(function (card) {
				return get.type(card) == "equip" && player.canEquip(card);
			});
			if (card) {
				player.$gain2(card);
				game.delayx();
				player.equip(card);
			}
		},
		mod: {
			globalFrom(from, to, distance) {
				return distance - from.countCards("e");
			},
		},
	},
	twqingxi: {
		audio: "xinqingxi2.mp3",
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && player.getHistory("useCard", evt => evt.card.name == "sha").indexOf(event.getParent()) == 0;
		},
		check(event, player) {
			return true;
		},
		logTarget: "target",
		content() {
			"step 0";
			var target = trigger.target;
			event.target = target;
			if (!target.countCards("e")) {
				event._result = { index: 0 };
			} else {
				target
					.chooseControl()
					.set("ai", function () {
						if (_status.event.goon || player.hp > 2) {
							return 0;
						}
						return 1;
					})
					.set("choiceList", [
						"令" + get.translation(player) + "摸" + get.cnNumber(Math.max(1, player.countCards("e"))) + "张牌，且此【杀】不可被响应",
						"弃置装备区中的所有牌并弃置" + get.translation(player) + "装备区等量的牌，此【杀】造成的伤害+1",
					])
					.set("goon", get.attitude(target, player) > 0);
			}
			"step 1";
			if (result.index == 0) {
				player.draw(Math.max(1, player.countCards("e")));
				trigger.getParent().directHit.add(target);
				game.log(trigger.card, "不可被", target, "响应");
				event.finish();
			} else {
				var num = target.countCards("e");
				target.discard(target.getCards("e"));
				target.discardPlayerCard(player, "e", num, true);
			}
			"step 2";
			var map = trigger.customArgs;
			var id = target.playerid;
			if (!map[id]) {
				map[id] = {};
			}
			if (!map[id].extraDamage) {
				map[id].extraDamage = 0;
			}
			map[id].extraDamage++;
			game.log(trigger.card, "对", target, "造成的伤害+1");
			game.delayx();
		},
	},
	//孙翊
	twzaoli: {
		audio: "zaoli",
		trigger: { player: "phaseUseBegin" },
		init(player) {
			if (player.isPhaseUsing()) {
				var hs = player.getCards("h");
				player.getHistory("gain", function (evt) {
					hs.removeArray(evt.cards);
				});
				if (hs.length) {
					player.addGaintag(hs, "twzaoli");
				}
			}
		},
		filter(event, player) {
			return player.countCards("he");
		},
		forced: true,
		group: "twzaoli_mark",
		content() {
			"step 0";
			if (player.countCards("h", card => get.type(card) != "equip")) {
				player
					.chooseCard(
						"h",
						[1, Infinity],
						true,
						"躁厉：请选择至少一张非装备手牌，你弃置这些牌和所有装备牌",
						(card, player) => {
							return get.type(card) != "equip" && lib.filter.cardDiscardable(card, player, "twzaoli");
						},
						"allowChooseAll"
					)
					.set("ai", function (card) {
						if (!card.hasGaintag("twzaoli_temp")) {
							return 5 - get.value(card);
						}
						return 1;
					});
			}
			"step 1";
			var cards = player.getCards("he", { type: "equip" });
			var subtype = [];
			event.subtype = subtype.addArray(cards.map(card => get.subtype(card)));
			cards.addArray(result.cards || []);
			if (cards.length) {
				player.discard(cards);
			}
			event.cards = cards;
			"step 2";
			player.draw(cards.length);
			"step 3";
			var num = 0;
			if (event.subtype.length) {
				for (var i of event.subtype) {
					var card = get.cardPile2(function (card) {
						return get.type(card) == "equip" && get.subtype(card) == i;
					});
					if (card) {
						num++;
						player.$gain2(card);
						game.delayx();
						player.equip(card);
					}
				}
			}
			if (num <= 2) {
				event.finish();
			}
			"step 4";
			player.loseHp();
		},
		onremove(player) {
			player.removeGaintag("twzaoli");
		},
		mod: {
			cardEnabled2(card, player) {
				if (player.isPhaseUsing() && get.itemtype(card) == "card" && card.hasGaintag("twzaoli")) {
					return false;
				}
			},
		},
		subSkill: {
			mark: {
				trigger: { player: ["phaseUseBegin", "phaseUseAfter", "phaseAfter"] },
				filter(event, player) {
					return player.countCards("h");
				},
				direct: true,
				firstDo: true,
				content() {
					if (event.triggername == "phaseUseBegin") {
						var hs = player.getCards("h");
						player.getHistory("gain", function (evt) {
							hs.removeArray(evt.cards);
						});
						if (hs.length) {
							player.addGaintag(hs, "twzaoli");
						}
					} else {
						player.removeGaintag("twzaoli");
					}
				},
			},
		},
	},
};
