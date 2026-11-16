import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcpoyuan" | "dchuace" | "pilitoushiche">} */
export const groupSkills = {
	//刘晔
	dcpoyuan: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: ["phaseBegin", "enterGame"],
		},
		filter(event, player, name) {
			if (name == "phaseBefore" && game.phaseNumber > 0) {
				return false;
			}
			if (player.getEquip("pilitoushiche")) {
				return game.hasPlayer(function (current) {
					return current != player && current.countDiscardableCards(player, "he") > 0;
				});
			} else {
				return player.hasEquipableSlot(5);
			}
		},
		direct: true,
		content() {
			"step 0";
			if (player.getEquip("pilitoushiche")) {
				event.goto(2);
				player
					.chooseTarget(get.prompt("dcpoyuan"), "弃置一名其他角色的至多两张牌", function (card, player, target) {
						return target != player && target.countDiscardableCards(player, "he") > 0;
					})
					.set("ai", function (target) {
						var player = _status.event.player,
							cards = target.getDiscardableCards(player, "he");
						var att = get.attitude(player, target);
						if (att < 0 && target.hasSkillTag("noe")) {
							att /= 2;
						}
						var zheng = [],
							fu = [];
						for (var i of cards) {
							var val = get.value(i, target);
							if (val > 0) {
								zheng.push(i);
							} else {
								fu.push(i);
							}
						}
						zheng.sort((a, b) => get.value(b, target) - get.value(a, target));
						fu.sort((a, b) => get.value(b, target) - get.value(a, target));
						zheng = zheng.slice(0, 2);
						fu = fu.slice(0, 2);
						var eff1 = 0,
							eff2 = 0;
						for (var i of zheng) {
							eff1 += get.value(i, target);
						}
						for (var i of fu) {
							if (get.position(i) == "e") {
								eff2 += 1 - get.value(i, target);
							}
						}
						return -att * Math.max(eff1, eff2);
					});
			} else {
				player.chooseBool(get.prompt("dcpoyuan"), "装备一张【霹雳投石车】").set("ai", function () {
					return true;
				});
			}
			"step 1";
			if (result.bool) {
				player.logSkill("dcpoyuan");
				var card = game.createCard("pilitoushiche", "diamond", 9);
				player.$gain2(card);
				game.delayx();
				player.equip(card);
			}
			event.finish();
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("dcpoyuan", target);
				player.discardPlayerCard(target, true, "he", [1, 2]);
			}
		},
	},
	dchuace: {
		audio: 2,
		audioname: ["ol_re_nianshou"],
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return event.dchuace && event.dchuace.length > 0 && player.countCards("hs") > 0;
		},
		onChooseToUse(event) {
			if (game.online || event.dchuace) {
				return;
			}
			var list = lib.inpile.filter(function (i) {
				return get.type(i) == "trick" && lib.filter.filterCard({ name: i }, event.player, event);
			});
			if (!list.length) {
				event.set("dchuace", list);
				return;
			}
			var history = _status.globalHistory;
			var stop = false;
			for (var i = history.length - 1; i >= 0; i--) {
				var evt = history[i];
				if (!stop) {
					if (evt.isRound) {
						stop = true;
					}
					continue;
				} else {
					for (var j of evt.useCard) {
						list.remove(j.card.name);
					}
					if (evt.isRound) {
						break;
					}
				}
			}
			event.set("dchuace", list);
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("画策", [event.dchuace, "vcard"], "hidden");
			},
			check(button) {
				var player = _status.event.player,
					card = { name: button.link[2] };
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					audio: "dchuace",
					audioname: ["ol_re_nianshou"],
					viewAs: { name: links[0][2] },
					ai1: card => 7 - get.value(card),
					filterCard: true,
					position: "hs",
					popname: true,
				};
			},
			prompt(links, player) {
				return "将一张手牌当做【" + get.translation(links[0][2]) + "】使用";
			},
		},
		ai: {
			order: 6,
			result: { player: 1 },
		},
		subSkill: { backup: {} },
	},
	pilitoushiche: {
		trigger: { player: ["useCard", "respond"] },
		forced: true,
		equipSkill: true,
		filter(event, player) {
			return get.type(event.card) == "basic";
		},
		content() {
			if (player == _status.currentPhase) {
				trigger.baseDamage++;
			} else {
				player.draw();
			}
		},
		mod: {
			targetInRange(card, player) {
				if (get.type(card) == "basic" && player == _status.currentPhase) {
					return true;
				}
			},
		},
	},
};
