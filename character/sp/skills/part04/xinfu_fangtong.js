import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinfu_fangtong" | "xinfu_weilu" | "xinfu_zengdao" | "xinfu_zengdao2">} */
export const groupSkills = {
	xinfu_fangtong: {
		getAuto(player) {
			var hs = player.getCards("he");
			var ss = player.getExpansions("xinfu_jijun");
			var bool = false,
				max = Math.pow(2, ss.length),
				index,
				i;
			for (i = 0; i < hs.length; i++) {
				for (var j = 1; j < max; j++) {
					var num = get.number(hs[i]);
					index = j.toString(2);
					while (index.length < ss.length) {
						index = "0" + index;
					}
					for (var k = 0; k < ss.length; k++) {
						if (index[k] == "1") {
							num += get.number(ss[k]);
						}
					}
					if (num == 36) {
						bool = true;
						break;
					}
				}
				if (bool) {
					break;
				}
			}
			if (!bool) {
				return [];
			}
			var list = [hs[i]];
			for (var k = 0; k < ss.length; k++) {
				if (index[k] == "1") {
					list.push(ss[k]);
				}
			}
			return list;
		},
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			return player.countCards("he") > 0 && player.getExpansions("xinfu_jijun").length > 0;
		},
		direct: true,
		skillAnimation: true,
		animationColor: "metal",
		content() {
			"step 0";
			var info = ["是否发动【方统】？"];
			info.push('<div class="text center">' + get.translation(player) + "的“方”</div>");
			info.push(player.getExpansions("xinfu_jijun"));
			if (player.countCards("h")) {
				info.push('<div class="text center">' + get.translation(player) + "的手牌区</div>");
				info.push(player.getCards("h"));
			}
			if (player.countCards("e")) {
				info.push('<div class="text center">' + get.translation(player) + "的装备区</div>");
				info.push(player.getCards("e"));
			}
			var next = player.chooseButton();
			next.set("createDialog", info);
			next.set("selectButton", function () {
				var num = 0;
				for (var i = 0; i < ui.selected.buttons.length; i++) {
					num += get.number(ui.selected.buttons[i]);
				}
				if (num == 36) {
					return ui.selected.buttons.length;
				}
				return ui.selected.buttons.length + 2;
			});
			next.set("filterButton", function (button) {
				var player = _status.event.player,
					cards = player.getExpansions("xinfu_jijun");
				if (ui.selected.buttons.length) {
					if (!cards.includes(button.link)) {
						return false;
					}
				} else if (cards.includes(button.link)) {
					return false;
				}
				var num = 0;
				for (var i = 0; i < ui.selected.buttons.length; i++) {
					num += get.number(ui.selected.buttons[i]);
				}
				return get.number(button.link) + num <= 36;
			});
			next.set("autolist", lib.skill.xinfu_fangtong.getAuto(player));
			next.set("processAI", function () {
				if (_status.event.autolist && _status.event.autolist.length > 0) {
					return {
						bool: true,
						links: _status.event.autolist,
					};
				}
				return { bool: false };
			});
			next.set("complexSelect", true);
			"step 1";
			if (result.bool) {
				player.logSkill("xinfu_fangtong");
				var tothrow = [];
				var cards = result.links.slice(0);
				for (var i = 0; i < cards.length; i++) {
					if (get.position(cards[i]) == "x") {
						tothrow.push(cards[i]);
					} else {
						player.discard(cards[i]).delay = false;
					}
				}
				player.loseToDiscardpile(tothrow);
				player
					.chooseTarget("选择一个目标并对其造成3点雷电伤害", true, function (card, player, target) {
						return target != player;
					})
					.set("ai", function (target) {
						return get.damageEffect(target, _status.event.player, _status.event.player, "thunder");
					});
			} else {
				event.finish();
			}
			"step 2";
			var target = result.targets[0];
			player.line(target, "thunder");
			target.damage(3, "thunder");
		},
		ai: {
			combo: "xinfu_jijun",
		},
	},
	xinfu_weilu: {
		audio: 2,
		trigger: {
			player: "damageEnd",
		},
		filter(event, player) {
			return event.source && event.source.isIn() && !player.getStorage("xinfu_weilu_effect").includes(event.source);
		},
		check(event, player) {
			return get.effect(event.source, { name: "losehp" }, player, player) >= 0;
		},
		forced: true,
		logTarget: "source",
		content() {
			player.addTempSkill("xinfu_weilu_effect", { player: "die" });
			player.markAuto("xinfu_weilu_effect", [trigger.source]);
			game.delayx();
		},
		ai: {
			maixie_defend: true,
			threaten: 0.85,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					return 0.9;
				},
			},
		},
		subSkill: {
			effect: {
				audio: "xinfu_weilu",
				trigger: { player: "phaseUseBegin" },
				charlotte: true,
				forced: true,
				logTarget(event, player) {
					return player.getStorage("xinfu_weilu_effect").filter(function (current) {
						return current.isIn() && current.hp > 1;
					});
				},
				content() {
					"step 0";
					var targets = player.getStorage("xinfu_weilu_effect");
					player.removeSkill("xinfu_weilu_effect");
					event.targets = targets.sortBySeat();
					"step 1";
					var target = targets.shift();
					if (target.isIn() && target.hp > 1) {
						event._delay = true;
						var num = target.hp - 1;
						player.markAuto("xinfu_weilu_recover", [[target, num]]);
						target.loseHp(num);
					}
					if (targets.length > 0) {
						event.redo();
					} else if (!event._delay) {
						event.finish();
					}
					"step 2";
					player.addTempSkill("xinfu_weilu_recover", {
						player: ["phaseUseAfter", "phaseAfter"],
					});
					game.delayx();
				},
				onremove: true,
				intro: { content: "已将$列入“威虏”战略打击目标" },
			},
			recover: {
				audio: "xinfu_weilu",
				charlotte: true,
				trigger: { player: "phaseUseEnd" },
				forced: true,
				filter(event, player) {
					var targets = player.getStorage("xinfu_weilu_recover");
					for (var i of targets) {
						if (i[0].isIn() && i[0].isDamaged()) {
							return true;
						}
					}
					return false;
				},
				onremove: true,
				logTarget(event, player) {
					var logs = [],
						targets = player.getStorage("xinfu_weilu_recover");
					for (var i of targets) {
						if (i[0].isIn() && i[0].isDamaged()) {
							logs.add(i[0]);
						}
					}
					return logs;
				},
				content() {
					"step 0";
					event.list = player.getStorage("xinfu_weilu_recover").slice(0);
					event.list.sort(function (a, b) {
						return lib.sort.seat(a[0], b[0]);
					});
					"step 1";
					var group = event.list.shift();
					if (group[0].isIn() && group[0].isDamaged()) {
						group[0].recover(group[1]);
						event._delay = true;
					}
					if (event.list.length > 0) {
						event.redo();
					} else if (!event._delay) {
						event.finish();
					}
					"step 2";
					game.delayx();
				},
			},
		},
	},
	xinfu_zengdao: {
		audio: 2,
		limited: true,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("e") > 0;
		},
		filterTarget: lib.filter.notMe,
		skillAnimation: true,
		animationColor: "thunder",
		position: "e",
		filterCard: true,
		selectCard: [1, Infinity],
		discard: false,
		lose: false,
		allowChooseAll: true,
		content() {
			player.awakenSkill(event.name);
			target.addToExpansion(cards, player, "give").gaintag.add("xinfu_zengdao2");
			target.addSkill("xinfu_zengdao2");
		},
		ai: {
			order() {
				var player = _status.event.player,
					num = 0;
				if (player.hasCard(card => get.value(card, player) < 0, "e")) {
					return 9;
				}
				for (var i = 1; i < 6; i++) {
					num += player.countEquipableSlot(i);
				}
				if (num <= 2) {
					return 9;
				}
				var targets = player.getStorage("xinfu_weilu_recover"),
					num = 0;
				if (
					player.hp <= 2 ||
					!game.hasPlayer(current => {
						if (player == current || get.attitude(player, current) < 0 || current.hp <= 1) {
							return false;
						}
						for (var arr of targets) {
							if (current == arr[0]) {
								break;
							}
						}
						return current.hp > 2 || current.countCards("hs") > 2;
					})
				) {
					return 1;
				}
				return 0;
			},
			result: {
				target(player, target) {
					if (target.hasValueTarget({ name: "sha", isCard: true })) {
						return ui.selected.cards.length;
					}
					return 0;
				},
			},
		},
	},
	xinfu_zengdao2: {
		trigger: { source: "damageBegin1" },
		forced: true,
		charlotte: true,
		sourceSkill: "xinfu_zengdao",
		filter(event, player) {
			return player.getExpansions("xinfu_zengdao2").length > 0;
		},
		content() {
			"step 0";
			player.chooseCardButton("将一张“刀”置入弃牌堆", player.getExpansions("xinfu_zengdao2"), true);
			"step 1";
			if (result.bool) {
				trigger.num++;
				player.loseToDiscardpile(result.links);
			}
		},
		marktext: "刀",
		intro: {
			content: "expansion",
			markcount: "expansion",
			onunmark(storage, player) {
				player.removeSkill("xinfu_zengdao2");
			},
		},
	},
};
