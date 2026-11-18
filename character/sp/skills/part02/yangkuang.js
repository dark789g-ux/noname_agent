import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yangkuang" | "cihuang" | "sanku" | "qiongshou" | "fenrui">} */
export const groupSkills = {
	//王衍
	yangkuang: {
		audio: 2,
		trigger: { player: "recoverEnd" },
		filter(event, player) {
			return player.isHealthy();
		},
		logTarget(event, player) {
			return _status.currentPhase || player;
		},
		check(event, player) {
			var target = _status.currentPhase || player;
			if (get.attitude(player, target) > 0) {
				return true;
			}
			if (player.countCards("h") > target.countCards("h")) {
				return true;
			}
			if (!target.getCardUsable("sha")) {
				return true;
			}
			return false;
		},
		content() {
			"step 0";
			player.chooseUseTarget("jiu", true);
			"step 1";
			var target = _status.currentPhase;
			if (target) {
				target.draw("nodelay");
			}
			player.draw();
		},
	},
	cihuang: {
		audio: 2,
		trigger: {
			global: ["eventNeutralized", "shaMiss"],
		},
		direct: true,
		filter(event, player) {
			if (event.player != _status.currentPhase || !event.targets || event.targets.length != 1 || event.type != "card" || !player.countCards("he")) {
				return false;
			}
			return lib.skill.cihuang.getList(player, event.player, true);
		},
		getList(player, target, bool) {
			var natures = lib.inpile_nature.slice(0);
			var tricks = [];
			for (var name of lib.inpile) {
				var info = lib.card[name];
				if (!info || info.type != "trick" || info.notarget || (info.selectTarget && info.selectTarget != 1 && (info.selectTarget != -1 || !info.toself))) {
					continue;
				}
				tricks.push(name);
			}
			var history = player.actionHistory;
			for (var i = history.length - 1; i >= 0; i--) {
				var info = history[i];
				for (var evt of info.useCard) {
					var name = evt.card.name;
					if (name == "sha") {
						if (evt.card.nature) {
							natures.remove(evt.card.nature);
						}
					} else {
						tricks.remove(name);
					}
				}
				if (info.isRound) {
					break;
				}
			}
			var vcards = [];
			for (var i of natures) {
				if (
					player.canUse(
						{
							name: "sha",
							nature: i,
							isCard: true,
						},
						target
					)
				) {
					if (bool) {
						return true;
					} else {
						vcards.push(["基本", "", "sha", i]);
					}
				}
			}
			for (var i of tricks) {
				if (
					player.canUse(
						{
							name: i,
							isCard: true,
						},
						target
					)
				) {
					if (bool) {
						return true;
					} else {
						vcards.push(["锦囊", "", i]);
					}
				}
			}
			if (bool) {
				return false;
			}
			return vcards;
		},
		content() {
			"step 0";
			var target = trigger.player;
			var list = lib.skill.cihuang.getList(player, target);
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			player.chooseButton([get.prompt("cihuang", target), '<div class="text center">将一张牌当以下的一张牌对' + get.translation(target) + "使用</div>", [list, "vcard"]]).set("ai", function (button) {
				var card = {
						name: button.link[2],
						nature: button.link[3],
						storage: { cihuang: true },
					},
					player = _status.event.player,
					target = _status.event.getTrigger().player;
				let eff = get.effect(target, card, player, player);
				if (card.name == "jiedao" && get.attitude(player, target) > 0) {
					eff -= 10;
				}
				return eff;
			});
			"step 1";
			if (result.bool) {
				var card = {
					name: result.links[0][2],
					nature: result.links[0][3],
					storage: { cihuang: true },
				};
				event.card = card;
				player
					.chooseCard("hes", "雌黄：将一张牌当" + get.translation(card) + "对" + get.translation(trigger.player) + "使用", function (card, player) {
						return player.canUse(get.autoViewAs(_status.event.getParent().card, [card]), _status.event.target, false);
					})
					.set("target", trigger.player)
					.set("ai", function (card) {
						if (get.effect(_status.event.target, get.autoViewAs(_status.event.getParent().card, [card]), player) <= 0) {
							return false;
						}
						return 6 - get.value(card);
					});
			} else {
				event._result = { bool: false };
			}
			"step 2";
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			if (result.bool) {
				player.useCard(get.autoViewAs(event.card, result.cards), result.cards, false, trigger.player, "cihuang").oncard = function (card, player) {
					_status.event.directHit.addArray(game.filterPlayer());
				};
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return arg && arg.card && arg.card.storage && arg.card.storage.cihuang;
			},
		},
	},
	sanku: {
		audio: 2,
		trigger: { player: "dying" },
		forced: true,
		group: "sanku_nogain",
		content() {
			"step 0";
			player.loseMaxHp();
			"step 1";
			var num = player.maxHp - player.hp;
			if (num > 0) {
				player.recover(num);
			}
		},
		ai: { halfneg: true },
		subSkill: {
			nogain: {
				audio: "sanku",
				trigger: { player: "gainMaxHpBegin" },
				forced: true,
				content() {
					trigger.cancel();
				},
			},
		},
	},
	//霍峻
	qiongshou: {
		audio: 2,
		trigger: {
			player: "enterGame",
			global: "phaseBefore",
		},
		forced: true,
		filter(event, player) {
			if (event.name == "phase" && game.phaseNumber != 0) {
				return false;
			}
			return player.hasEnabledSlot();
		},
		content() {
			var list = [];
			for (var i = 1; i < 6; i++) {
				for (var j = 0; j < player.countEnabledSlot(i); j++) {
					list.push(i);
				}
			}
			player.disableEquip(list);
			player.draw(4);
		},
		mod: {
			maxHandcard(player, num) {
				return num + 4;
			},
		},
		ai: {
			halfneg: true,
			threaten: 3.2,
		},
	},
	fenrui: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		onremove: true,
		filter(event, player) {
			var es = player.countCards("e");
			return (
				(player.hasDisabledSlot() && player.countCards("he") > 0) ||
				(!player.storage.fenrui &&
					game.hasPlayer(function (current) {
						return current != player && current.countCards("e") < es;
					}))
			);
		},
		content() {
			"step 0";
			if (player.hasDisabledSlot() && player.countCards("he") > 0) {
				var str = "弃置一张牌，恢复一个装备栏并使用一张对应装备牌";
				player.chooseToDiscard("he", get.prompt("fenrui"), str).set("ai", function (card) {
					return 7 - get.value(card);
				}).logSkill = "fenrui";
			} else {
				event.goto(3);
			}
			"step 1";
			if (result.bool) {
				player.chooseToEnable().set("ai", function () {
					var player = _status.event.player;
					var list = [2, 5, 1, 3, 4];
					for (var i of list) {
						if (player.hasDisabledSlot(i)) {
							return "equip" + i;
						}
					}
				});
			} else {
				var es = player.countCards("e");
				if (
					player.storage.fenrui ||
					!game.hasPlayer(function (current) {
						return current != player && current.countCards("e") < es;
					})
				) {
					event.finish();
				} else {
					event.goto(3);
				}
			}
			"step 2";
			var func = function (card) {
				return get.subtype(card, false) == result.control && player.canUse(card, player) && !get.cardtag(card, "gifts");
			};
			var card = get.discardPile(func) || get.cardPile2(func);
			if (card) {
				player.chooseUseTarget(card, true, "nopopup");
			}
			if (player.storage.fenrui) {
				event.finish();
			}
			"step 3";
			var es = player.countCards("e");
			if (
				es > 0 &&
				game.hasPlayer(function (current) {
					return current != player && current.countCards("e") < es;
				})
			) {
				player
					.chooseTarget("是否对一名装备数小于你的角色造成伤害？", "你可以选择一名装备区内牌数小于你的角色，并对其造成X点伤害（X为你与其装备区牌数之差），但此效果每局游戏内仅限一次。", function (card, player, target) {
						return player != target && player.countCards("e") > target.countCards("e");
					})
					.set("ai", function (target) {
						var player = _status.event.player;
						var num = player.countCards("e") - target.countCards("e");
						if (get.attitude(player, target) >= 0) {
							return 0;
						}
						if (num >= Math.min(2, player.hp, target.hp)) {
							return get.damageEffect(target, player, player);
						}
						return 0;
					});
			} else {
				event.finish();
			}
			"step 4";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("fenrui_animate", target);
				player.storage.fenrui = true;
				player.unmarkSkill("fenrui");
				game.delayx();
				target.damage(player.countCards("e") - target.countCards("e"));
			}
		},
		group: "fenrui_animate",
		mark: true,
		intro: { content: "王炸尚未使用" },
		subSkill: {
			animate: {
				skillAnimation: true,
				animationColor: "fire",
			},
		},
	},
};
