import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jisi" | "shanduan">} */
export const groupSkills = {
	jisi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		filter(event, player) {
			var skills = player.getStockSkills("一！", "五！").filter(function (skill) {
				if (skill == "jisi") {
					return false;
				}
				var info = get.info(skill);
				return info && !info.charlotte;
			});
			var history = player.getAllHistory("useSkill");
			for (var i of history) {
				if (skills.includes(i.sourceSkill) || skills.includes(i.skill)) {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			var skills2 = [];
			var skills = player.getStockSkills("只！", "因！").filter(function (skill) {
				if (skill == "jisi") {
					return false;
				}
				var info = get.info(skill);
				return info && !info.charlotte;
			});
			var history = player.getAllHistory("useSkill");
			for (var i of history) {
				if (skills.includes(i.sourceSkill)) {
					skills2.add(i.sourceSkill);
				}
				if (skills.includes(i.skill)) {
					skills2.add(i.skill);
				}
				if (skills.length == skills2.length) {
					break;
				}
			}
			event.skills2 = skills2;
			var str = "令一名其他角色获得";
			for (var i = 0; i < skills2.length; i++) {
				str += "〖" + get.translation(skills2[i]) + "〗";
				if (i != skills2.length - 1) {
					str += ";";
				}
			}
			if (skills2.length > 1) {
				str += "中的一个技能";
			}
			str += "然后你";
			if (player.countCards("h") > 0) {
				str += "弃置所有手牌，并";
			}
			str += "视为对其使用一张【杀】";
			player
				.chooseTarget(get.prompt("jisi"), str, lib.filter.notMe)
				.set("ai", function (target) {
					if (!_status.event.goon) {
						return false;
					}
					var att = get.attitude(player, target);
					if (att < 4) {
						return false;
					}
					var eff = get.effect(target, { name: "sha", isCard: true }, player, player);
					if (eff >= 0) {
						return att + eff;
					}
					if (target.hp <= 2) {
						return false;
					}
					return att / Math.max(1, -eff);
				})
				.set(
					"goon",
					(function () {
						if (player.hasUnknown() || player.identity == "nei") {
							return false;
						}
						var hs = player.getCards("h");
						if (!hs.length || get.value(hs, player) <= 9 - player.hp) {
							return true;
						}
						return false;
					})()
				);
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("jisi", target);
				player.awakenSkill(event.name);
				var list = event.skills2;
				if (list.length == 0) {
					event._result = { control: list[0] };
				}
				player
					.chooseControl(list)
					.set("prompt", "令" + get.translation(target) + "获得一个技能")
					.set("ai", () => _status.event.choice)
					.set("choice", list.includes("qianmeng") ? "qianmeng" : list.randomGet());
			} else {
				event.finish();
			}
			"step 2";
			target.addSkills(result.control);
			"step 3";
			var num = player.countCards("h");
			if (num > 0) {
				player.chooseToDiscard("h", num, true);
			}
			"step 4";
			if (player.canUse("sha", target, false)) {
				player.useCard(
					false,
					target,
					{
						name: "sha",
						isCard: true,
					},
					"noai"
				);
			}
		},
	},
	//周处
	shanduan: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter: (event, player) => player != _status.currentPhase,
		forced: true,
		content() {
			if (!player.storage.shanduan) {
				player.storage.shanduan = [1, 2, 3, 4];
			}
			var list = player.storage.shanduan;
			for (var i = 0; i < list.length; i++) {
				var num = list[i],
					add = true;
				for (var j = 0; j < list.length; j++) {
					if (list[j] < num) {
						add = false;
						break;
					}
				}
				if (add) {
					list[i]++;
					break;
				}
			}
			player.addTip("shanduan", get.translation("shanduan") + " " + player.storage["shanduan"].slice().join(" "));
			game.delayx();
		},
		init(player, skill) {
			player.storage[skill] = [1, 2, 3, 4];
			player.addTip(skill, get.translation(skill) + " " + player.storage[skill].slice().join(" "));
		},
		onremove: (player, skill) => player.removeTip(skill),
		group: ["shanduan_draw", "shanduan_use", "shanduan_discard"],
		ai: {
			notemp: true,
			threaten: 3.6,
		},
		subSkill: {
			draw: {
				audio: "shanduan",
				trigger: { player: "phaseDrawBegin" },
				filter(event, player) {
					var list = event.getParent()._shanduan;
					return !list || list.length > 0;
				},
				forced: true,
				content() {
					"step 0";
					var list = trigger.getParent()._shanduan;
					if (!list) {
						trigger.getParent()._shanduan = (player.storage.shanduan || [1, 2, 3, 4]).slice(0);
						player.storage.shanduan = [1, 2, 3, 4];
						player.addTip("shanduan", get.translation("shanduan") + " " + trigger.getParent()._shanduan.slice().join(" "));
					}
					"step 1";
					var list = trigger.getParent()._shanduan;
					if (list.length == 1) {
						event._result = { index: 0 };
					} else {
						player
							.chooseControl(list)
							.set("prompt", "善断：为摸牌阶段的摸牌数分配一个数值")
							.set("choice", list.indexOf(Math.max.apply(Math, list)))
							.set("ai", () => _status.event.choice);
					}
					"step 2";
					var list = trigger.getParent()._shanduan;
					var num = list[result.index];
					trigger.num = num;
					list.remove(num);
					game.log(player, "给", "#g摸牌阶段的摸牌数", "分配的数值是", "#y" + num);
					if (list.length) {
						player.addTip("shanduan", get.translation("shanduan") + " " + list.slice().join(" "));
					} else {
						player.addTip("shanduan", get.translation("shanduan") + " " + player.storage.shanduan.slice().join(" "));
					}
				},
			},
			use: {
				audio: "shanduan",
				trigger: { player: "phaseUseBegin" },
				filter(event, player) {
					var list = event.getParent()._shanduan;
					return !list || list.length > 0;
				},
				forced: true,
				content() {
					"step 0";
					var list = trigger.getParent()._shanduan;
					if (!list) {
						trigger.getParent()._shanduan = (player.storage.shanduan || [1, 2, 3, 4]).slice(0);
						player.storage.shanduan = [1, 2, 3, 4];
						player.addTip("shanduan", get.translation("shanduan") + " " + trigger.getParent()._shanduan.slice().join(" "));
					}
					"step 1";
					var list = trigger.getParent()._shanduan;
					if (list.length == 1) {
						event._result = { index: 0 };
					} else {
						player
							.chooseControl(list)
							.set("prompt", "善断：为攻击范围基数分配一个数值")
							.set("list", list)
							.set("ai", function () {
								var player = _status.event.player,
									list = _status.event.list,
									card = { name: "sha" };
								if (player.hasSha() && player.hasValueTarget(card, false, true) && !player.hasValueTarget(card, null, true)) {
									var range = 1;
									var equips = player.getCards("e");
									for (var i = 0; i < equips.length; i++) {
										var info = get.info(equips[i], false).distance;
										if (!info) {
											continue;
										}
										if (info.attackFrom) {
											range -= info.attackFrom;
										}
									}
									var listx = list.slice(0).sort();
									for (var i of listx) {
										if (i <= range) {
											continue;
										}
										if (
											game.hasPlayer(function (current) {
												var distance = get.distance(player, current, "attack");
												if (distance > 1 && distance <= i - range) {
													return true;
												}
												return false;
											})
										) {
											return list.indexOf(i);
										}
									}
								}
								return list.indexOf(Math.min.apply(Math, list));
							});
					}
					"step 2";
					var list = trigger.getParent()._shanduan;
					var num = list[result.index];
					if (!player.storage.shanduan_effect) {
						player.storage.shanduan_effect = {};
					}
					player.storage.shanduan_effect.range = num;
					player.addTempSkill("shanduan_effect");
					list.remove(num);
					game.log(player, "给", "#g攻击范围的基数", "分配的数值是", "#y" + num);
					if (list.length) {
						player.addTip("shanduan", get.translation("shanduan") + " " + list.slice().join(" "));
					} else {
						player.addTip("shanduan", get.translation("shanduan") + " " + player.storage.shanduan.slice().join(" "));
					}
					if (list.length == 0) {
						event.finish();
					} else if (list.length == 1) {
						event._result = { index: 0 };
					} else {
						player
							.chooseControl(list)
							.set("prompt", "为使用【杀】的次数上限分配一个数值")
							.set("list", list)
							.set("ai", function () {
								var player = _status.event.player,
									list = _status.event.list;
								var sha = player.countCards("hs", function (card) {
									return get.name(card) == "sha" && player.hasValueTarget(card, null, true);
								});
								var max = player.getCardUsable("sha");
								if (sha <= max) {
									var listx = list.slice(0).sort();
									for (var i of listx) {
										if (max + i >= sha) {
											return list.indexOf(i);
										}
									}
									return list.indexOf(Math.max.apply(Math, list));
								}
								return list.indexOf(Math.min.apply(Math, list));
							});
					}
					"step 3";
					var list = trigger.getParent()._shanduan;
					var num = list[result.index];
					if (!player.storage.shanduan_effect) {
						player.storage.shanduan_effect = {};
					}
					player.storage.shanduan_effect.sha = num;
					list.remove(num);
					game.log(player, "给", "#g使用【杀】的次数上限", "分配的数值是", "#y" + num);
					if (list.length) {
						player.addTip("shanduan", get.translation("shanduan") + " " + list.slice().join(" "));
					} else {
						player.addTip("shanduan", get.translation("shanduan") + " " + player.storage.shanduan.slice().join(" "));
					}
				},
			},
			discard: {
				audio: "shanduan",
				trigger: { player: "phaseDiscardBegin" },
				filter(event, player) {
					var list = event.getParent()._shanduan;
					return !list || list.length > 0;
				},
				forced: true,
				content() {
					"step 0";
					var list = trigger.getParent()._shanduan;
					if (!list) {
						trigger.getParent()._shanduan = (player.storage.shanduan || [1, 2, 3, 4]).slice(0);
						player.storage.shanduan = [1, 2, 3, 4];
						player.addTip("shanduan", get.translation("shanduan") + " " + trigger.getParent()._shanduan.slice().join(" "));
					}
					"step 1";
					var list = trigger.getParent()._shanduan;
					if (list.length == 1) {
						event._result = { index: 0 };
					} else {
						player
							.chooseControl(list)
							.set("prompt", "善断：为手牌上限基数分配一个数值")
							.set("choice", list.indexOf(Math.max.apply(Math, list)))
							.set("ai", () => _status.event.choice);
					}
					"step 2";
					var list = trigger.getParent()._shanduan;
					var num = list[result.index];
					if (!player.storage.shanduan_effect) {
						player.storage.shanduan_effect = {};
					}
					player.storage.shanduan_effect.limit = num;
					player.addTempSkill("shanduan_effect");
					list.remove(num);
					game.log(player, "给", "#g手牌上限的基数", "分配的数值是", "#y" + num);
					if (list.length) {
						player.addTip("shanduan", get.translation("shanduan") + " " + list.slice().join(" "));
					} else {
						player.addTip("shanduan", get.translation("shanduan") + " " + player.storage.shanduan.slice().join(" "));
					}
				},
			},
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					attackRangeBase(player) {
						var map = player.storage.shanduan_effect;
						if (typeof map?.range != "number") {
							return;
						}
						return Math.max(player.getEquipRange(player.getCards("e")), map.range);
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							var map = player.storage.shanduan_effect;
							if (typeof map?.sha != "number") {
								return;
							}
							return num - 1 + map.sha;
						}
					},
					maxHandcardBase(player, num) {
						var map = player.storage.shanduan_effect;
						if (typeof map?.limit != "number") {
							return;
						}
						return map.limit;
					},
				},
			},
		},
	},
};
