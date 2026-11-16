import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshiji" | "dcsilun">} */
export const groupSkills = {
	//周不疑
	dcshiji: {
		audio: 2,
		trigger: {
			global: "phaseJieshuBegin",
		},
		filter(event, player) {
			return event.player.isIn() && !event.player.getHistory("sourceDamage").length;
		},
		direct: true,
		content() {
			"step 0";
			trigger.player.addTempSkill("dcshiji_forbidself");
			var list = [];
			for (var name of lib.inpile) {
				var type = get.type(name);
				if (type != "trick") {
					continue;
				}
				if (player.getStorage("dcshiji_used").includes(name)) {
					continue;
				}
				var card = {
					name: name,
					storage: { dcshiji: true },
				};
				if (trigger.player.hasUseTarget(card)) {
					list.push([type, "", name]);
				}
			}
			if (list.length) {
				player
					.chooseButton([get.prompt("dcshiji", trigger.player), [list, "vcard"]])
					.set("ai", button => {
						if (_status.event.tochoose) {
							return _status.event.getTrigger().player.getUseValue({ name: button.link[2] });
						}
						return 0;
					})
					.set(
						"tochoose",
						get.attitude(player, trigger.player) > 0 &&
							trigger.player.hasCard(card => {
								return get.value(card) < 7;
							}, "hes")
					);
			} else {
				event.finish();
			}
			"step 1";
			if (result.bool) {
				var card = {
					name: result.links[0][2],
					storage: { dcshiji: true },
				};
				var str = get.translation(card);
				player.logSkill("dcshiji", trigger.player);
				player.addTempSkill("dcshiji_used", "roundStart");
				player.markAuto("dcshiji_used", [card.name]);
				player.popup(str);
				game.log(player, "声明了", "#y" + str);
				game.broadcastAll(function (card) {
					lib.skill.dcshiji_backup.viewAs = card;
					lib.skill.dcshiji_backup.prompt = "十计：是否将一张牌当做" + get.translation(card) + "使用？";
				}, card);
				var next = trigger.player.chooseToUse();
				next.set("openskilldialog", "十计：是否将一张牌当做" + get.translation(card) + "使用？");
				next.set("norestore", true);
				next.set("addCount", false);
				next.set("_backupevent", "dcshiji_backup");
				next.set("custom", {
					add: {},
					replace: { window() {} },
				});
				next.backup("dcshiji_backup");
			}
		},
		subSkill: {
			backup: {
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				position: "hes",
				selectCard: 1,
				check: card => 7 - get.value(card),
				popname: true,
			},
			used: {
				charlotte: true,
				onremove: true,
				mark: true,
				marktext: "计",
				intro: {
					content: "本轮已声明过$",
				},
			},
			forbidself: {
				charlotte: true,
				mod: {
					targetEnabled(card, player, target) {
						if (player == target && card.storage && card.storage.dcshiji) {
							return false;
						}
					},
				},
			},
		},
	},
	dcsilun: {
		audio: 2,
		trigger: {
			player: ["phaseZhunbeiBegin", "damageEnd"],
		},
		frequent: true,
		content() {
			"step 0";
			player.draw(4);
			event.count = 0;
			event.equipCount = {};
			game.countPlayer(current => {
				event.equipCount[current.playerid] = current.countCards("e");
			}, true);
			"step 1";
			if (!player.countCards("he")) {
				event.finish();
			} else {
				player.chooseCard("四论：选择一张牌（" + (event.count + 1) + "/" + "4）", "然后选择将此牌置于场上或牌堆的两端", true, "he").set("ai", card => {
					var player = _status.event.player;
					if (["equip", "delay"].includes(get.type(card)) && player.hasValueTarget(card)) {
						return 50;
					}
					return 50 - get.value(card);
				});
			}
			"step 2";
			if (result.bool) {
				var card = result.cards[0];
				event.card = card;
				event.count++;
				var choices = ["牌堆顶", "牌堆底"];
				var type = get.type(card);
				if (
					(type == "equip" &&
						game.hasPlayer(current => {
							return current.canEquip(card);
						})) ||
					(type == "delay" &&
						game.hasPlayer(current => {
							return current.canAddJudge(card);
						}))
				) {
					choices.unshift("场上");
				}
				player
					.chooseControl(choices)
					.set("prompt", "请选择要将" + get.translation(card) + "置于的位置")
					.set("ai", () => {
						return _status.event.choice;
					})
					.set(
						"choice",
						(function () {
							if (["equip", "delay"].includes(get.type(card)) && player.hasValueTarget(card) && choices.includes("场上")) {
								return "场上";
							}
							var val = get.value(card);
							var next = _status.currentPhase;
							if (next) {
								if (trigger.name == "damage") {
									next = next.getNext();
								}
								if ((get.attitude(player, next) > 0 && val >= 6) || (get.attitude(player, next) < 0 && val <= 4.5)) {
									return "牌堆顶";
								}
							}
							return "牌堆底";
						})()
					);
			}
			"step 3";
			if (result.control == "场上") {
				var type = get.type(card);
				player
					.chooseTarget("将" + get.translation(card) + "置于一名角色的场上", true, (card, player, target) => {
						return _status.event.targets.includes(target);
					})
					.set(
						"targets",
						game.filterPlayer(current => {
							if (type == "equip") {
								return current.canEquip(card);
							}
							if (type == "delay") {
								return current.canAddJudge(card);
							}
							return false;
						})
					)
					.set("ai", target => {
						var player = _status.event.player;
						var card = _status.event.card;
						return (
							get.attitude(player, target) *
							(get.type(card) == "equip"
								? get.value(card, target)
								: get.effect(
										target,
										{
											name: card.viewAs || card.name,
											cards: [card],
										},
										target,
										target
									))
						);
					})
					.set("card", card);
			} else {
				player.$throw(card, 1000);
				var next = player.lose(card, ui.cardPile, "visible");
				if (result.control == "牌堆顶") {
					next.insert_card = true;
				}
				game.log(player, "将", card, "置于了", "#y" + result.control);
			}
			"step 4";
			if (result.bool && result.targets && result.targets.length) {
				var target = result.targets[0];
				player.line(target);
				player.$give(card, target, false);
				if (get.type(card) == "equip") {
					target.equip(card);
				} else {
					target.addJudge(card);
				}
			}
			"step 5";
			game.countPlayer(current => {
				var count = current.countCards("e");
				var prevCount = event.equipCount[current.playerid] || 0;
				if (count != prevCount) {
					current.link(false);
					current.turnOver(false);
				}
				event.equipCount[current.playerid] = count;
			});
			if (event.count < 4) {
				event.goto(1);
			}
		},
	},
};
