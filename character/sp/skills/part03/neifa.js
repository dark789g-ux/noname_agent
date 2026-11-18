import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "neifa" | "neifa_basic" | "neifa_nobasic" | "neifa_use" | "yuxu" | "xjshijian">} */
export const groupSkills = {
	//二袁
	neifa: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		content() {
			"step 0";
			_status.noclearcountdown = true;
			if (
				game.hasPlayer(function (current) {
					return current.countGainableCards(player, "ej") > 0;
				})
			) {
				player
					.chooseControl("cancel2")
					.set("choiceList", ["摸两张牌，然后弃置一张牌", "获得场上的一张牌，然后弃置一张牌"])
					.set("prompt", get.prompt("neifa"))
					.set("ai", function () {
						if (
							game.hasPlayer(function (current) {
								var att = get.attitude(player, current);
								if (att == 0) {
									return false;
								}
								if (att < 0) {
									return (
										current.countCards("e", function (card) {
											return get.value(card, current) > 5;
										}) > 0
									);
								}
								return (
									current.countCards("ej", function (card) {
										return get.position(card) == "j" || get.value(card, current) <= 0;
									}) > 0
								);
							})
						) {
							return 1;
						}
						return 0;
					});
			} else {
				player.chooseControl("ok", "cancel2").set("prompt", get.prompt2("neifa"));
			}
			"step 1";
			if (result.control == "cancel2") {
				delete _status.noclearcountdown;
				if (!_status.noclearcountdown) {
					game.stopCountChoose();
				}
				event.finish();
				return;
			} else if (result.index == 1) {
				player
					.chooseTarget("请选择一名角色，获得其装备区或判定区内的一张牌", true, function (card, player, target) {
						return target.countGainableCards(player, "ej") > 0;
					})
					.set("ai", function (target) {
						var player = _status.event.player;
						var att = get.attitude(player, target);
						if (
							att > 0 &&
							target.countCards("ej", function (card) {
								return get.position(card) == "j" || get.value(card, target) <= 0;
							})
						) {
							return 2 * att;
						} else if (
							att < 0 &&
							target.countCards("e", function (card) {
								return get.value(card, target) > 5;
							})
						) {
							return -att;
						}
						return -1;
					});
			} else {
				delete _status.noclearcountdown;
				if (!_status.noclearcountdown) {
					game.stopCountChoose();
				}
				player.logSkill("neifa");
				player.draw(2);
				event.goto(3);
			}
			"step 2";
			delete _status.noclearcountdown;
			if (!_status.noclearcountdown) {
				game.stopCountChoose();
			}
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("neifa", target);
				player.gainPlayerCard(target, "ej", true);
			}
			"step 3";
			player.chooseToDiscard(true, "he").set("ai", function (cardx) {
				var player = _status.event.player;
				var num = 0;
				var hs = player.getCards("h");
				var muniu = player.getEquip("muniu");
				var subs = [];
				if (muniu && muniu.cards) {
					hs = hs.concat(muniu.cards);
				}
				if (get.type(cardx) == "basic") {
					var shas = hs.filter(function (card) {
						return card != cardx && get.name(card, player) == "sha" && player.hasValueTarget(card);
					});
					var numx = player.countCards("h", function (card) {
						return get.type2(card, player) != "basic";
					});
					num += Math.min(numx, Math.max(0, shas.length - player.getCardUsable("sha"))) * 0.7;
					num +=
						Math.min(
							player.getCardUsable("sha") + numx,
							shas.filter(function (card) {
								return (
									game.countPlayer(function (current) {
										return player.canUse(card, current) && get.effect(current, card, player, player) > 0;
									}) > 1
								);
							}).length
						) * 1.1;
					var taos = Math.min(
						player.maxHp - player.hp,
						hs.filter(function (card) {
							return cardx != card && get.name(card, player) == "tao";
						}).length
					);
					num += taos * player.getDamagedHp() * 1.2;
				} else {
					var numx = Math.sqrt(
						Math.min(
							5,
							player.countCards("h", function (card) {
								return get.type2(card, player) == "basic";
							})
						)
					);
					if (numx) {
						num +=
							(numx *
								Math.min(
									2,
									hs.filter(function (card) {
										if (card == cardx || get.type(card) != "equip" || !player.hasUseTarget(card)) {
											return false;
										}
										subs.add(get.subtype(card));
										return true;
									}).length
								) *
								(2.5 + player.countCards("e"))) /
							2.5;
					}
					num +=
						hs.filter(function (card) {
							return card != cardx && get.type2(card) == "trick" && player.hasValueTarget(card);
						}).length * 0.65;
				}
				if (get.position(cardx) == "e" && cardx.name != "muniu" && subs.includes(get.subtype(card))) {
					num += 3;
				}
				return num * 1.5 - get.value(cardx);
			});
			"step 4";
			if (result.bool && result.cards && result.cards.length) {
				var name = get.type(result.cards[0]) == "basic" ? "neifa_basic" : "neifa_nobasic";
				player.addTempSkill(name);
				var num = Math.min(
					5,
					player.countCards("h", function (cardx) {
						return (name == "neifa_basic") != (get.type2(cardx, player) == "basic");
					})
				);
				if (num > 0) {
					player.addMark(name, num, false);
				} else {
					player.storage[name] = 0;
				}
			}
		},
		ai: {
			threaten: 3,
		},
	},
	neifa_basic: {
		mark: true,
		marktext: "伐",
		onremove: true,
		intro: {
			name: "内伐 - 基本牌",
			content: "本回合内不能使用锦囊牌和装备牌，使用【杀】选择目标时可以额外指定一个目标且使用【杀】的目标次数上限+#。",
		},
		mod: {
			cardEnabled(card, player) {
				if (["trick", "equip"].includes(get.type(card, "trick"))) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (["trick", "equip"].includes(get.type(card, "trick"))) {
					return false;
				}
			},
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + player.countMark("neifa_basic");
				}
			},
		},
		trigger: { player: "useCard2" },
		sourceSkill: "neifa",
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !event.targets.includes(current) && player.canUse(event.card, current);
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("neifa"), "为" + get.translation(trigger.card) + "额外指定一个目标", function (card, player, target) {
					return !_status.event.sourcex.includes(target) && player.canUse(_status.event.card, target);
				})
				.set("sourcex", trigger.targets)
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.effect(target, _status.event.card, player, player);
				})
				.set("card", trigger.card);
			"step 1";
			if (result.bool) {
				if (!event.isMine() && !event.isOnline()) {
					game.delayx();
				}
				event.targets = result.targets;
			} else {
				event.finish();
			}
			"step 2";
			player.logSkill("neifa", event.targets);
			trigger.targets.addArray(event.targets);
		},
	},
	neifa_nobasic: {
		trigger: { player: "useCard2" },
		direct: true,
		mark: true,
		marktext: "伐",
		onremove: true,
		mod: {
			cardEnabled(card, player) {
				if (get.type(card) == "basic") {
					return false;
				}
			},
			cardSavable(card, player) {
				if (get.type(card) == "basic") {
					return false;
				}
			},
		},
		intro: {
			name: "内伐 - 非基本牌",
			content: "本回合内不能使用基本牌，使用普通锦囊牌选择目标时可以增加或减少一个目标，且本回合的出牌阶段内前两次使用装备牌时摸#张牌。",
		},
		sourceSkill: "neifa",
		filter(event, player) {
			if (get.type(event.card) != "trick") {
				return false;
			}
			if (event.targets && event.targets.length > 0) {
				return true;
			}
			var info = get.info(event.card);
			if (info.allowMultiple == false) {
				return false;
			}
			if (event.targets && !info.multitarget) {
				if (
					game.hasPlayer(function (current) {
						return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current) && lib.filter.targetInRange(event.card, player, current);
					})
				) {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			var prompt2 = "为" + get.translation(trigger.card) + "增加或减少一个目标";
			player
				.chooseTarget(get.prompt("neifa"), function (card, player, target) {
					var player = _status.event.player;
					if (_status.event.targets.includes(target)) {
						return true;
					}
					return lib.filter.targetEnabled2(_status.event.card, player, target) && lib.filter.targetInRange(_status.event.card, player, target);
				})
				.set("prompt2", prompt2)
				.set("ai", function (target) {
					var trigger = _status.event.getTrigger();
					var player = _status.event.player;
					return get.effect(target, trigger.card, player, player) * (_status.event.targets.includes(target) ? -1 : 1);
				})
				.set("targets", trigger.targets)
				.set("card", trigger.card);
			"step 1";
			if (result.bool) {
				if (!event.isMine() && !event.isOnline()) {
					game.delayx();
				}
				event.targets = result.targets;
			} else {
				event.finish();
			}
			"step 2";
			if (event.targets) {
				player.logSkill("neifa", event.targets);
				if (trigger.targets.includes(event.targets[0])) {
					trigger.targets.removeArray(event.targets);
				} else {
					trigger.targets.addArray(event.targets);
				}
			}
		},
		group: "neifa_use",
	},
	neifa_use: {
		audio: "neifa",
		usable: 2,
		trigger: { player: "useCard" },
		forced: true,
		sourceSkill: "neifa",
		filter(event, player) {
			return get.type(event.card) == "equip" && player.countMark("neifa_nobasic") > 0;
		},
		content() {
			player.draw(player.countMark("neifa_nobasic"));
		},
		ai: {
			reverseOrder: true,
			skillTagFilter(player) {
				if (player.storage.counttrigger && player.storage.counttrigger.neifa_use >= 2) {
					return false;
				}
			},
			effect: {
				player_use(card, player, target) {
					if (player.countSkill("neifa_use") < 2 && get.type(card) == "equip") {
						return [1, player.countMark("neifa_nobasic")];
					}
				},
			},
		},
	},
	//许靖
	yuxu: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != player) {
				return false;
			}
			return true;
		},
		direct: true,
		content() {
			"step 0";
			var draw = !player.hasMark("yuxu_used");
			if (draw) {
				player.chooseBool(get.prompt2("yuxu")).set("ai", () => 1);
			} else {
				event.goto(2);
			}
			"step 1";
			if (result.bool) {
				player.logSkill("yuxu");
				player.draw();
				player.addMark("yuxu_used", 1, false);
				player.addTempSkill("yuxu_used", "phaseUseAfter");
			}
			event.finish();
			"step 2";
			player.logSkill("yuxu");
			player.removeMark("yuxu_used", player.countMark("yuxu_used"), false);
			player.chooseToDiscard("he", true);
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	xjshijian: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		direct: true,
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != event.player) {
				return false;
			}
			return (
				event.player
					.getHistory("useCard", function (evtt) {
						return evtt.getParent("phaseUse") == evt;
					})
					.indexOf(event) == 1 && player.countCards("he") > 0
			);
		},
		content() {
			"step 0";
			var next = player.chooseToDiscard("he", get.prompt("xjshijian", trigger.player), "弃置一张牌并令其获得技能〖誉虚〗至回合结束");
			next.set("logSkill", ["xjshijian", trigger.player]);
			next.set("check", get.attitude(player, trigger.player) > 0 && trigger.player.countCards("h") > 2);
			next.ai = function (card) {
				if (_status.event.check) {
					return 5 - get.value(card);
				}
				return -1;
			};
			"step 1";
			if (result.bool) {
				trigger.player.addTempSkills("yuxu");
			}
		},
		ai: {
			expose: 0.25,
		},
	},
};
