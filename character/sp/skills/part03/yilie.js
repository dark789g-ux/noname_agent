import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yilie" | "tongxie">} */
export const groupSkills = {
	yilie: {
		audio: 2,
		enable: "chooseToUse",
		hiddenCard(player, name) {
			if (get.type(name) == "basic" && lib.inpile.includes(name) && !player.getStorage("yilie_count").includes(name)) {
				var hs = player.getCards("hs");
				if (hs.length < 2) {
					return false;
				}
				var bool = false,
					map = {};
				for (var card of hs) {
					var color = get.color(card);
					if (!map[color]) {
						map[color] = true;
					} else {
						bool = true;
						break;
					}
				}
				return bool;
			}
		},
		filter(event, player) {
			if (event.type == "wuxie") {
				return false;
			}
			var list = player.getStorage("yilie_count");
			var hs = player.getCards("hs");
			if (hs.length < 2) {
				return false;
			}
			var bool = false,
				map = {};
			for (var card of hs) {
				var color = get.color(card);
				if (!map[color]) {
					map[color] = true;
				} else {
					bool = true;
					break;
				}
			}
			if (!bool) {
				return false;
			}
			for (var name of lib.inpile) {
				if (get.type(name) != "basic" || list.includes(name)) {
					continue;
				}
				var card = { name };
				if (event.filterCard(get.autoViewAs(card, "unsure"), player, event)) {
					return true;
				}
				if (name == "sha") {
					for (var nature of lib.inpile_nature) {
						card.nature = nature;
						if (event.filterCard(get.autoViewAs(card, "unsure"), player, event)) {
							return true;
						}
					}
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				var storage = player.getStorage("yilie_count");
				for (var i of lib.inpile) {
					if (get.type(i) != "basic" || storage.includes(i)) {
						continue;
					}
					var card = { name: i };
					if (event.filterCard(get.autoViewAs(card, "unsure"), player, event)) {
						list.push(["基本", "", i]);
					}
					if (i == "sha") {
						for (var j of lib.inpile_nature) {
							card.nature = j;
							if (event.filterCard(get.autoViewAs(card, "unsure"), player, event)) {
								list.push(["基本", "", i, j]);
							}
						}
					}
				}
				return ui.create.dialog("义烈", [list, "vcard"], "hidden");
			},
			check(button) {
				var player = _status.event.player;
				var evt = _status.event.getParent();
				var name = button.link[2],
					card = { name: name, nature: button.link[3] };
				if (name == "shan") {
					return 2;
				}
				if (evt.type == "dying") {
					if (get.attitude(player, evt.dying) < 2) {
						return 0;
					}
					if (name == "jiu") {
						return 2.1;
					}
					return 1.9;
				}
				if (evt.type == "phase") {
					if (button.link[2] == "jiu") {
						if (player.getUseValue({ name: "jiu" }) <= 0) {
							return 0;
						}
						var cards = player.getCards("hs", cardx => get.value(cardx) < 8);
						cards.sort((a, b) => get.value(a) - get.value(b));
						if (cards.some(cardx => get.name(cardx) == "sha" && !cards.slice(0, 2).includes(cardx))) {
							return player.getUseValue({ name: "jiu" });
						}
						return 0;
					}
					return player.getUseValue(card) / 4;
				}
				return 1;
			},
			backup(links, player) {
				return {
					audio: "yilie",
					selectCard: 2,
					filterCard(card, player) {
						var color = get.color(card);
						if (ui.selected.cards.length) {
							return color == get.color(ui.selected.cards[0]);
						}
						return player.hasCard(function (cardx) {
							return card != cardx && get.color(cardx) == color;
						}, "hs");
					},
					position: "hs",
					complexCard: true,
					check: card => 8 - get.value(card),
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					precontent() {
						var name = event.result.card.name;
						player.addTempSkill("yilie_count", "roundStart");
						player.markAuto("yilie_count", [name]);
					},
				};
			},
			prompt(links, player) {
				var name = links[0][2];
				var nature = links[0][3];
				return "将两张颜色相同的手牌当做" + (get.translation(nature) || "") + get.translation(name) + "使用";
			},
		},
		ai: {
			order(item, player) {
				if (player && _status.event.type == "phase") {
					var add = false,
						max = 0;
					var names = lib.inpile.filter(name => get.type(name) == "basic" && !player.getStorage("yilie_count").includes(name));
					if (names.includes("sha")) {
						add = true;
					}
					names = names.map(namex => {
						return { name: namex };
					});
					if (add) {
						lib.inpile_nature.forEach(nature => names.push({ name: "sha", nature: nature }));
					}
					names.forEach(card => {
						if (player.getUseValue(card) > 0) {
							var temp = get.order(card);
							if (card.name == "jiu") {
								var cards = player.getCards("hs", cardx => get.value(cardx) < 8);
								cards.sort((a, b) => get.value(a) - get.value(b));
								if (!cards.some(cardx => get.name(cardx) == "sha" && !cards.slice(0, 2).includes(cardx))) {
									temp = 0;
								}
							}
							if (temp > max) {
								max = temp;
							}
						}
					});
					if (max > 0) {
						max -= 0.001;
					}
					return max;
				}
				return 0.5;
			},
			respondShan: true,
			respondSha: true,
			fireAttack: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				var hs = player.getCards("hs");
				if (hs.length < 2) {
					return false;
				}
				var bool = false,
					map = {};
				for (var card of hs) {
					var color = get.color(card);
					if (!map[color]) {
						map[color] = true;
					} else {
						bool = true;
						break;
					}
				}
				if (!bool) {
					return false;
				}
				var storage = player.storage.yilie_count;
				var name;
				switch (tag) {
					case "respondShan":
						name = "shan";
						break;
					default:
						name = "sha";
						break;
				}
				if (storage && storage.includes(name)) {
					return false;
				}
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			count: { charlotte: true, onremove: true },
			backup: { audio: "yilie" },
		},
	},
	//赵俨
	tongxie: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		content() {
			"step 0";
			player.chooseTarget(get.prompt("tongxie"), "选择至多两名其他角色作为“同协角色”", lib.filter.notMe, [0, 2]).set("ai", function (target) {
				return get.attitude(_status.event.player, target);
			});
			"step 1";
			if (result.bool) {
				var targets = result.targets;
				targets.add(player);
				player.logSkill("tongxie", targets);
				player.addTempSkill("tongxie_effect", { player: "phaseBegin" });
				player.markAuto("tongxie_effect", targets);
				var min = player.countCards("h"),
					min_player = player;
				for (var i of targets) {
					if (i == player) {
						continue;
					}
					var num = i.countCards("h");
					if (num < min) {
						min = num;
						min_player = i;
					} else if (num == min) {
						min_player = false;
					}
				}
				if (min_player) {
					min_player.draw();
				} else {
					game.delayx();
				}
			}
		},
		subSkill: {
			effect: {
				audio: "tongxie",
				charlotte: true,
				trigger: { global: "useCardAfter" },
				onremove: true,
				forced: true,
				popup: false,
				filter(event, player) {
					if (event.card.name != "sha" || event.targets.length != 1 || !event.targets[0].isIn()) {
						return false;
					}
					if (event.getParent(2).name == "tongxie_effect") {
						return false;
					}
					var list = player.getStorage("tongxie_effect"),
						target = event.targets[0];
					if (!list.includes(event.player)) {
						return false;
					}
					for (var i of list) {
						if (i == event.player || !i.isIn()) {
							continue;
						}
						if (!i.canUse("sha", target, false)) {
							continue;
						}
						if (_status.connectMode && i.countCards("hs") > 0) {
							return true;
						}
						if (i.hasSha()) {
							return true;
						}
					}
					return false;
				},
				content() {
					"step 0";
					event.targets = player
						.getStorage("tongxie_effect")
						.filter(function (i) {
							return i !== trigger.player;
						})
						.sortBySeat();
					event.target = trigger.targets[0];
					"step 1";
					var current = targets.shift();
					if (current.isIn() && target.isIn() && current.canUse("sha", target, false) && (_status.connectMode || current.hasSha())) {
						current
							.chooseToUse(
								function (card, player, event) {
									if (get.name(card) != "sha") {
										return false;
									}
									return lib.filter.filterCard.apply(this, arguments);
								},
								"同协：是否对" + get.translation(target) + "使用一张杀？"
							)
							.set("targetRequired", true)
							.set("complexTarget", true)
							.set("complexSelect", true)
							.set("filterTarget", function (card, player, target) {
								if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
									return false;
								}
								return lib.filter.targetEnabled.apply(this, arguments);
							})
							.set("sourcex", target)
							.set("logSkill", "tongxie_effect")
							.set("addCount", false);
						if (targets.length > 0) {
							event.redo();
						}
					}
				},
				group: ["tongxie_damage", "tongxie_count"],
			},
			damage: {
				audio: "tongxie",
				charlotte: true,
				trigger: { global: "damageBegin4" },
				filter(event, player) {
					var list = player.getStorage("tongxie_effect");
					if (!list.includes(event.player)) {
						return false;
					}
					for (var i of list) {
						if (i != event.player && i.isIn() && !i.hasSkill("tongxie_count2", null, null, false)) {
							return true;
						}
					}
					return false;
				},
				forced: true,
				popup: false,
				content() {
					"step 0";
					event.targets = player
						.getStorage("tongxie_effect")
						.filter(function (i) {
							return i != trigger.player && i.isIn() && !i.hasSkill("tongxie_count2", null, null, false);
						})
						.sortBySeat();
					event.num = 0;
					"step 1";
					var target = targets[num];
					event.num++;
					event.target = target;
					target.chooseBool("同协：是否为" + get.translation(trigger.player) + "阻挡伤害？", "失去1点体力，防止" + get.translation(trigger.player) + "即将受到的" + get.cnNumber(trigger.num) + "点伤害").set("ai", function () {
						var player = _status.event.player,
							target = _status.event.getTrigger().player;
						var trigger = _status.event.getTrigger();
						var eff1 = get.damageEffect(target, trigger.source, player, trigger.nature);
						if (trigger.num > 1) {
							eff1 = Math.min(-1, eff1) * trigger.num;
						}
						var eff2 = get.effect(player, { name: "losehp" }, player, player);
						return eff2 > eff1;
					});
					"step 2";
					if (result.bool) {
						target.logSkill("tongxie_damage", trigger.player);
						trigger.cancel();
						target.loseHp();
					} else if (num < targets.length) {
						event.goto(1);
					}
				},
			},
			count: {
				trigger: { global: "loseHpEnd" },
				charlotte: true,
				forced: true,
				firstDo: true,
				popup: false,
				silent: true,
				filter(event, player) {
					return player.getStorage("tongxie_effect").includes(event.player);
				},
				content() {
					trigger.player.addTempSkill("tongxie_count2");
				},
			},
			count2: { charlotte: true },
		},
	},
};
