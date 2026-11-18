import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcyaoyi" | "dcshoutan" | "dcfuxue">} */
export const groupSkills = {
	//路易
	dcyaoyi: {
		audio: 2,
		getZhuanhuanji(player, bool) {
			var skills = player.getSkills(null, false, false).filter(function (i) {
				return get.is.zhuanhuanji(i, player);
			});
			if (!bool) {
				return skills;
			}
			if (!skills.length) {
				return "none";
			}
			var state = lib.skill.dcyaoyi.getState(player, skills[0]);
			for (var i = 1; i < skills.length; i++) {
				if (lib.skill.dcyaoyi.getState(player, skills[i]) != state) {
					return "none";
				}
			}
			return state;
		},
		getState(player, skill) {
			var info = get.info(skill),
				zhuanhuan = info.zhuanhuanji;
			if (zhuanhuan && zhuanhuan == "number") {
				return player.countMark(skill) % 2 == 1;
			}
			return Boolean(player.storage[skill]);
		},
		trigger: {
			player: "enterGame",
			global: "phaseBefore",
		},
		forced: true,
		filter(event, player) {
			if (event.name == "phase" && game.phaseNumber != 0) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return lib.skill.dcyaoyi.getZhuanhuanji(current).length == 0;
			});
		},
		logTarget() {
			return game.filterPlayer(function (current) {
				return lib.skill.dcyaoyi.getZhuanhuanji(current).length == 0;
			});
		},
		content() {
			var targets = lib.skill.dcyaoyi.logTarget().sortBySeat();
			for (var target of targets) {
				target.addSkills("dcshoutan");
			}
			game.delayx();
		},
		derivation: "dcshoutan",
		global: "dcyaoyi_blocker",
		subSkill: {
			blocker: {
				mod: {
					targetEnabled(card, player, target) {
						if (
							player == target ||
							!game.hasPlayer(function (current) {
								return current.hasSkill("dcyaoyi");
							})
						) {
							return;
						}
						var state1 = lib.skill.dcyaoyi.getZhuanhuanji(player, true);
						if (state1 == "none") {
							return;
						}
						if (lib.skill.dcyaoyi.getZhuanhuanji(target, true) == state1) {
							return false;
						}
					},
					cardSavable(card, player, target) {
						if (
							player == target ||
							!game.hasPlayer(function (current) {
								return current.hasSkill("dcyaoyi");
							})
						) {
							return;
						}
						var state1 = lib.skill.dcyaoyi.getZhuanhuanji(player, true);
						if (state1 == "none") {
							return;
						}
						if (lib.skill.dcyaoyi.getZhuanhuanji(target, true) == state1) {
							return false;
						}
					},
				},
			},
		},
	},
	dcshoutan: {
		audio: 2,
		enable: "phaseUse",
		position: "h",
		filter(event, player) {
			if (player.hasSkill("dcyaoyi")) {
				return !player.hasSkill("dcshoutan_blocker", null, null, false);
			}
			return player.countCards("h") > 0 && !player.getStat("skill").dcshoutan;
		},
		selectCard() {
			if (_status.event.player.hasSkill("dcyaoyi")) {
				return [0, 1];
			}
			return [1, 1];
		},
		filterCard(card, player) {
			if (player.hasSkill("dcyaoyi")) {
				return false;
			}
			var color = get.color(card, player);
			if (player.storage.dcshoutan) {
				return color == "black";
			}
			return color != "black";
		},
		prompt() {
			var player = _status.event.player;
			if (player.hasSkill("dcyaoyi")) {
				return "点击“确认”来变更转换技状态";
			}
			if (player.storage.dcshoutan) {
				return "弃置一张黑色手牌，变更转换技状态";
			}
			return "弃置一张非黑色手牌，变更转换技状态";
		},
		check(card) {
			return 11 - get.value(card);
		},
		content() {
			player.changeZhuanhuanji("dcshoutan");
			player.addTempSkill("dcshoutan_blocker", {
				player: ["useCard1", "useSkillBegin", "phaseUseEnd"],
			});
		},
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage, player) {
				if (storage) {
					return "转换技。出牌阶段限一次，你可以弃置一张黑色手牌。";
				}
				return "转换技。出牌阶段限一次，你可以弃置一张不为黑色的手牌。";
			},
		},
		ai: {
			order: 0.1,
			result: {
				player(player) {
					var base = 0;
					if (ui.selected.cards.length) {
						base = get.value(ui.selected.cards[0]);
					}
					var status = player.storage.dcshoutan;
					var cards = player.getCards("hs", function (card) {
						return !ui.selected.cards.includes(card);
					});
					for (var card of cards) {
						var val1 = player.getUseValue(card, null, true);
						player.storage.dcshoutan = !status;
						var val2 = 0;
						try {
							val2 = player.getUseValue(card, null, true);
						} catch (e) {
							player.storage.dcshoutan = status;
						}
						player.storage.dcshoutan = status;
						if (val2 > val1) {
							base -= val2 - val1;
						}
					}
					if (base < 0) {
						return 1;
					}
					return 0;
				},
			},
		},
		subSkill: { blocker: { charlotte: true } },
	},
	dcfuxue: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		filter(event, player) {
			return player.hp > 0 && ui.discardPile.childNodes.length > 0;
		},
		content() {
			"step 0";
			var cards = Array.from(ui.discardPile.childNodes);
			var gains = cards.slice(0);
			var history = game.getAllGlobalHistory("cardMove", function (evt) {
				if (evt.name == "lose") {
					return evt.position == ui.discardPile;
				}
				return evt.name == "cardsDiscard";
			});
			for (var i = history.length - 1; i >= 0; i--) {
				var evt = history[i];
				var cards2 = evt.cards.filter(function (card) {
					return cards.includes(card);
				});
				if (cards2.length) {
					if (lib.skill.dcfuxue.isUse(evt)) {
						gains.removeArray(cards2);
					}
					cards.removeArray(cards2);
				}
				if (!cards.length) {
					break;
				}
			}
			if (gains.length) {
				var num = player.hp;
				player.chooseButton(["复学：选择获得" + (num > 0 ? "至多" : "") + get.cnNumber(num) + "张牌", gains], [1, num]).set("ai", function (button) {
					var player = _status.event.player,
						card = button.link;
					var getn = function (card) {
						return player.countCards("h", card.name) + ui.selected.buttons.filter(button => button.link.name == card.name).length;
					};
					var val = player.getUseValue(card);
					if (card.name == "tao" && getn(card) >= player.getDamagedHp()) {
						return 0;
					}
					if (card.name == "sha" && getn(card) >= player.getCardUsable("sha")) {
						return 0;
					}
					return val;
				});
			} else {
				event.finish();
			}
			"step 1";
			if (result.bool) {
				player.logSkill("dcfuxue");
				player.gain(result.links, "gain2").gaintag.add("dcfuxue");
			}
		},
		isUse(event) {
			if (event.name != "cardsDiscard") {
				return false;
			}
			var evtx = event.getParent();
			if (evtx.name != "orderingDiscard") {
				return false;
			}
			var evt2 = evtx.relatedEvent || evtx.getParent();
			return evt2.name == "phaseJudge" || evt2.name == "useCard";
		},
		group: "dcfuxue_draw",
		subSkill: {
			draw: {
				audio: "dcfuxue",
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				locked: false,
				mod: {
					aiOrder(player, card, num) {
						if (get.itemtype(card) == "card" && card.hasGaintag("dcfuxue")) {
							return num + 0.5;
						}
					},
				},
				filter(event, player) {
					return (
						player.hp > 0 &&
						!player.hasCard(function (card) {
							return card.hasGaintag("dcfuxue");
						}, "h")
					);
				},
				content() {
					player.draw(player.hp);
				},
			},
		},
	},
};
