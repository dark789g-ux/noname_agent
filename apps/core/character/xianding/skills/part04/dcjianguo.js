import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjianguo" | "dcdyqingshi" | "dcchanjuan" | "dcxunbie">} */
export const groupSkills = {
	//杜预
	dcjianguo: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return ["discard", "draw"].some(i => !player.getStorage("dcjianguo_used").includes(i));
		},
		chooseButton: {
			dialog(event, player) {
				var dialog = ui.create.dialog("谏国：请选择一项", "hidden");
				dialog.add([
					[
						["discard", "令一名角色摸一张牌，然后弃置一半手牌"],
						["draw", "令一名角色弃置一张牌，然后摸等同于手牌数一半的牌"],
					],
					"textbutton",
				]);
				return dialog;
			},
			filter(button, player) {
				return !player.getStorage("dcjianguo_used").includes(button.link);
			},
			check(button) {
				var player = _status.event.player;
				if (button.link == "discard") {
					var discard = Math.max.apply(
						Math,
						game
							.filterPlayer(current => {
								return lib.skill.dcjianguo_discard.filterTarget(null, player, current);
							})
							.map(current => {
								return get.effect(current, "dcjianguo_discard", player, player);
							})
					);
					return discard;
				}
				if (button.link == "draw") {
					var draw = Math.max.apply(
						Math,
						game
							.filterPlayer(current => {
								return lib.skill.dcjianguo_draw.filterTarget(null, player, current);
							})
							.map(current => {
								return get.effect(current, "dcjianguo_draw", player, player);
							})
					);
					return draw;
				}
				return 0;
			},
			backup(links) {
				return get.copy(lib.skill["dcjianguo_" + links[0]]);
			},
			prompt(links) {
				if (links[0] == "discard") {
					return "令一名角色摸一张牌，然后弃置一半手牌";
				}
				return "令一名角色弃置一张牌，然后摸等同于手牌数一半的牌";
			},
		},
		ai: {
			order: 10,
			threaten: 2.8,
			result: {
				//想让杜预两个技能自我联动写起来太累了，开摆
				player: 1,
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			backup: { audio: "dcjianguo" },
			discard: {
				audio: "dcjianguo",
				filterTarget: () => true,
				filterCard: () => false,
				selectCard: -1,
				content() {
					"step 0";
					player.addTempSkill("dcjianguo_used", "phaseUseAfter");
					player.markAuto("dcjianguo_used", ["discard"]);
					target.draw();
					game.delayex();
					"step 1";
					var num = Math.ceil(target.countCards("h") / 2);
					if (num > 0) {
						target.chooseToDiscard(num, true, "谏国：请弃置" + get.cnNumber(num) + "张手牌");
					}
				},
				ai: {
					result: {
						target(player, target) {
							return 1.1 - Math.floor(target.countCards("h") / 2);
						},
					},
					tag: {
						gain: 1,
						loseCard: 2,
					},
				},
			},
			draw: {
				audio: "dcjianguo",
				filterTarget(card, player, target) {
					return target.countCards("he");
				},
				filterCard: () => false,
				selectCard: -1,
				content() {
					"step 0";
					player.addTempSkill("dcjianguo_used", "phaseUseAfter");
					player.markAuto("dcjianguo_used", ["draw"]);
					target.chooseToDiscard("he", true, "谏国：请弃置一张牌");
					"step 1";
					var num = Math.ceil(target.countCards("h") / 2);
					if (num > 0) {
						target.draw(num);
					}
				},
				ai: {
					result: {
						target(player, target) {
							var fix = 0;
							var num = target.countCards("h");
							if (player == target && num % 2 == 1 && num >= 5) {
								fix += 1;
							}
							return Math.ceil(num / 2 - 0.5) + fix;
						},
					},
					tag: {
						loseCard: 1,
						gain: 2,
					},
				},
			},
		},
	},
	dcdyqingshi: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
		},
		filter(event, player) {
			if (player != _status.currentPhase) {
				return false;
			}
			if (!event.isFirstTarget) {
				return false;
			}
			if (event.card.name != "sha" && get.type(event.card, null, false) != "trick") {
				return false;
			}
			if (player.countCards("h") != player.getHistory("useCard").indexOf(event.getParent()) + 1) {
				return false;
			}
			return event.targets.some(target => {
				return target != player && target.isIn();
			});
		},
		direct: true,
		locked: false,
		content() {
			"step 0";
			var targets = trigger.targets.filter(target => {
				return target != player && target.isIn();
			});
			player
				.chooseTarget(get.prompt("dcdyqingshi"), "对一名不为你的目标角色造成1点伤害", (card, player, target) => {
					return _status.event.targets.includes(target);
				})
				.set("ai", target => {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				})
				.set("targets", targets);
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("dcdyqingshi", target);
				target.damage();
			}
		},
		mod: {
			aiOrder(player, card, num) {
				if (_status.currentPhase != player) {
					return;
				}
				var cardsh = [];
				if (Array.isArray(card.cards)) {
					cardsh.addArray(
						card.cards.filter(card => {
							return get.position(card) == "h";
						})
					);
				}
				var del = player.countCards("h") - cardsh.length - player.getHistory("useCard").length - 1;
				if (del < 0) {
					return;
				}
				if (del > 0) {
					if (card.name == "sha" || get.type(card, null, player) != "trick") {
						return num / 3;
					}
					return num + 1;
				}
				return num + 15;
			},
		},
	},
	//甘糜
	dcchanjuan: {
		init(player) {
			if (!player.storage.dcchanjuan) {
				player.storage.dcchanjuan = {};
			}
		},
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (
				event.targets.length != 1 ||
				!player.hasHistory("lose", evt => {
					if ((evt.relatedEvent || evt.getParent()) != event) {
						return false;
					}
					return event.cards.every(card => evt.hs.includes(card));
				})
			) {
				return false;
			}
			if (!["basic", "trick"].includes(get.type(event.card, null, false))) {
				return false;
			}
			if (event.getParent(2).name == "dcchanjuan") {
				return false;
			}
			return !player.storage.dcchanjuan[event.card.name] || player.storage.dcchanjuan[event.card.name] < 2;
		},
		direct: true,
		content() {
			"step 0";
			var card = {
				name: trigger.card.name,
				nature: trigger.card.nature,
				isCard: true,
			};
			player
				.chooseUseTarget(card, get.prompt("dcchanjuan"), false, false)
				.set("prompt2", "视为再使用一张" + get.translation(card))
				.set("logSkill", "dcchanjuan");
			"step 1";
			if (result.bool) {
				if (!player.storage.dcchanjuan[trigger.card.name]) {
					player.storage.dcchanjuan[trigger.card.name] = 0;
				}
				player.storage.dcchanjuan[trigger.card.name]++;
				var list1 = trigger.targets,
					list2 = result.targets;
				if (list1.slice().removeArray(list2).length == 0 && list2.slice().removeArray(list1).length == 0) {
					player.draw();
				}
			}
		},
		ai: { threaten: 2 },
		mark: true,
		intro: {
			markcount: storage => 0,
			content(storage) {
				var str = "已使用牌名：",
					names = Object.keys(storage);
				if (!names.length) {
					str += "无";
				} else {
					names.forEach(name => {
						str += "<br><li>【";
						str += get.translation(name);
						str += "】：";
						str += storage[name] + "次";
					});
				}
				return str;
			},
		},
	},
	dcxunbie: {
		audio: 2,
		trigger: { player: "dying" },
		filter(event, player) {
			if (player.hp > 0) {
				return false;
			}
			var characters = ["dc_ganfuren", "dc_mifuren"];
			game.countPlayer(current => {
				if (current.name1 == "dc_ganfuren" || current.name2 == "dc_ganfuren") {
					characters.remove("dc_ganfuren");
				}
				if (current.name1 == "dc_mifuren" || current.name2 == "dc_mifuren") {
					characters.remove("dc_mifuren");
				}
			});
			return (
				characters.length &&
				[player.name1, player.name2].some(name => {
					return get.character(name, 3).includes("dcxunbie");
				})
			);
		},
		check: () => true,
		skillAnimation: true,
		animationColor: "fire",
		limited: true,
		derivation: ["dcyongjue", "dcshushen", "dcshenzhi", "dcguixiu", "dccunsi"],
		content() {
			"step 0";
			player.awakenSkill(event.name);
			var characters = ["dc_ganfuren", "dc_mifuren"];
			game.countPlayer(current => {
				if (current.name1 == "dc_ganfuren" || current.name2 == "dc_ganfuren") {
					characters.remove("dc_ganfuren");
				}
				if (current.name1 == "dc_mifuren" || current.name2 == "dc_mifuren") {
					characters.remove("dc_mifuren");
				}
			});
			if (characters.length == 1) {
				event._result = { control: characters[0] };
			} else {
				player
					.chooseControl(characters)
					.set("dialog", ["选择要替换成的武将", [characters, "character"]])
					.set("ai", () => [0, 1].randomGet());
			}
			"step 1";
			var character = result.control;
			if (!_status.characterlist) {
				game.initCharacterList();
			}
			player.reinitCharacter(get.character(player.name2, 3).includes("dcxunbie") ? player.name2 : player.name1, character);
			"step 2";
			player.recover(1 - player.hp);
			player.addTempSkill("dcxunbie_muteki");
		},
		subSkill: {
			muteki: {
				audio: "dcxunbie",
				trigger: {
					player: "damageBegin4",
				},
				charlotte: true,
				forced: true,
				content() {
					trigger.cancel();
				},
				mark: true,
				intro: { content: "防止受到的所有伤害直到本回合结束" },
				ai: {
					nofire: true,
					nothunder: true,
					nodamage: true,
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "damage")) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
		},
	},
};
