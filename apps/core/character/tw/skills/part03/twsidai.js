import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twsidai" | "twjieyu" | "twhanyu" | "twhengjiang" | "twhengjiang2">} */
export const groupSkills = {
	twsidai: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		locked: false,
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		filter(event, player) {
			var cards = player.getCards("h", { type: "basic" });
			if (!cards.length) {
				return false;
			}
			for (var i of cards) {
				if (!game.checkMod(i, player, "unchanged", "cardEnabled2", player)) {
					return false;
				}
			}
			return event.filterCard(get.autoViewAs({ name: "sha", storage: { twsidai: true } }, cards), player, event);
		},
		viewAs: { name: "sha", storage: { twsidai: true } },
		filterCard: { type: "basic" },
		selectCard: -1,
		check: () => 1,
		onuse(result, player) {
			player.awakenSkill("twsidai");
			player.addTempSkill("twsidai_effect");
		},
		ai: {
			order: 2.9,
			result: {
				target(player, target) {
					if (get.attitude(player, target) >= 0) {
						return -20;
					}
					var cards = ui.selected.cards.slice(0);
					var names = [];
					for (var i of cards) {
						names.add(i.name);
					}
					if (names.length < player.hp) {
						return 0;
					}
					if (player.hasUnknown() && (player.identity != "fan" || !target.isZhu)) {
						return 0;
					}
					return lib.card.sha.ai.result.target.apply(this, arguments);
				},
			},
		},
		mod: {
			cardUsable(card) {
				if (card.storage && card.storage.twsidai) {
					return Infinity;
				}
			},
			targetInRange(card) {
				if (card.storage && card.storage.twsidai) {
					return true;
				}
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					if (!event.card || !event.card.storage || !event.card.storage.twsidai || event.getParent().type != "card") {
						return false;
					}
					for (var i of event.cards) {
						if (i.name == "jiu") {
							return true;
						}
					}
					return false;
				},
				forced: true,
				popup: false,
				content() {
					trigger.num *= 2;
					game.log(trigger.card, "的伤害值", "#y×2");
				},
				group: ["twsidai_tao", "twsidai_shan"],
			},
			tao: {
				trigger: { source: "damageSource" },
				filter(event, player) {
					if (!event.card || !event.card.storage || !event.card.storage.twsidai || !event.player.isIn()) {
						return false;
					}
					for (var i of event.cards) {
						if (i.name == "tao") {
							return true;
						}
					}
					return false;
				},
				forced: true,
				popup: false,
				content() {
					trigger.player.loseMaxHp();
				},
			},
			shan: {
				trigger: { player: "useCardToPlayered" },
				filter(event, player) {
					if (!event.card || !event.card.storage || !event.card.storage.twsidai || !event.target.isIn()) {
						return false;
					}
					for (var i of event.cards) {
						if (i.name == "shan") {
							return true;
						}
					}
					return false;
				},
				forced: true,
				popup: false,
				content() {
					"step 0";
					trigger.target
						.chooseToDiscard("h", { type: "basic" }, "弃置一张基本牌，否则不能响应" + get.translation(trigger.card))
						.set("ai", function (card) {
							var player = _status.event.player;
							if (
								player.hasCard("hs", function (cardx) {
									return cardx != card && get.name(cardx, player) == "shan";
								})
							) {
								return 12 - get.value(card);
							}
							return 0;
						});
					"step 1";
					if (!result.bool) {
						trigger.directHit.add(trigger.target);
					}
				},
			},
		},
	},
	twjieyu: {
		audio: 2,
		trigger: { player: ["phaseJieshuBegin", "damageEnd"] },
		round: 1,
		filter(event, player) {
			if (event.name != "phaseJieshu") {
				var history = player.getHistory("damage");
				for (var i of history) {
					if (i == event) {
						break;
					}
					return false;
				}
				var all = player.actionHistory;
				for (var i = all.length - 2; i >= 0; i--) {
					if (all[i].damage.length) {
						return false;
					}
					if (all[i].isRound) {
						break;
					}
				}
			}
			return (
				player.countCards("h") > 0 &&
				!player.hasCard(function (card) {
					return !lib.filter.cardDiscardable(card, player, "twjieyu");
				}, "h")
			);
		},
		check(event, player) {
			var cards = [],
				names = [];
			for (var i = 0; i < ui.discardPile.childNodes.length; i++) {
				var card = ui.discardPile.childNodes[i];
				if (get.type(card, null, false) == "basic" && !names.includes(card.name)) {
					cards.push(card);
					names.push(card.name);
				}
			}
			if (!names.includes("shan") || !names.includes("tao")) {
				return false;
			}
			if (player.countCards("h", "shan") < 2 && player.countCards("h", "tao") < 1) {
				return true;
			}
			return false;
		},
		content() {
			"step 0";
			player.discard(player.getCards("h"));
			"step 1";
			var cards = [],
				names = [];
			for (var i = 0; i < ui.discardPile.childNodes.length; i++) {
				var card = ui.discardPile.childNodes[i];
				if (get.type(card, null, false) == "basic" && !names.includes(card.name)) {
					cards.push(card);
					names.push(card.name);
				}
			}
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
	},
	twhanyu: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		content() {
			var cards = [],
				types = ["basic", "trick", "equip"];
			for (var i of types) {
				var card = get.cardPile2(function (card) {
					return get.type2(card, false) == i;
				});
				if (card) {
					cards.push(card);
				}
			}
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
	},
	twhengjiang: {
		audio: "hengjiang",
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			return (
				!player.hasSkill("twhengjiang2") &&
				event.targets.length == 1 &&
				["basic", "trick"].includes(get.type(event.card, null, false)) &&
				player.isPhaseUsing() &&
				game.hasPlayer(function (current) {
					return player.inRange(current) && lib.filter.targetEnabled2(event.card, player, current);
				})
			);
		},
		prompt: "是否发动【横江】？",
		prompt2(event, player) {
			return "将" + get.translation(event.card) + "的目标改为" + get.translation(lib.skill.twhengjiang.logTarget(event, player));
		},
		logTarget(event, player) {
			return game
				.filterPlayer(function (current) {
					return player.inRange(current) && lib.filter.targetEnabled2(event.card, player, current);
				})
				.sortBySeat();
		},
		check(event, player) {
			var effect1 = get.effect(event.target, event.card, player, player);
			var effect2 = 0,
				targets = lib.skill.twhengjiang.logTarget(event, player);
			for (var i of targets) {
				effect2 += get.effect(i, event.card, player, player);
			}
			return effect2 > effect1;
		},
		content() {
			var targets = lib.skill.twhengjiang.logTarget(trigger, player);
			trigger.targets.length = 0;
			trigger.targets.addArray(targets);
			trigger.getParent().triggeredTargets1.length = 0;
			trigger.getParent().twhengjiang_buffed = true;
			player.addTempSkill("twhengjiang2", "phaseUseAfter");
		},
	},
	twhengjiang2: {
		charlotte: true,
		trigger: { player: "useCardAfter" },
		forced: true,
		popup: false,
		sourceSkill: "twhengjiang",
		filter(event, player) {
			return (
				event.twhengjiang_buffed &&
				game.hasPlayer2(function (current) {
					return (
						current != player &&
						(current.hasHistory("useCard", function (evt) {
							return evt.respondTo && evt.respondTo[1] == event.card;
						}) ||
							current.hasHistory("respond", function (evt) {
								return evt.respondTo && evt.respondTo[1] == event.card;
							}))
					);
				})
			);
		},
		content() {
			player.draw(
				game.countPlayer2(function (current) {
					return (
						current != player &&
						(current.hasHistory("useCard", function (evt) {
							return evt.respondTo && evt.respondTo[1] == trigger.card;
						}) ||
							current.hasHistory("respond", function (evt) {
								return evt.respondTo && evt.respondTo[1] == trigger.card;
							}))
					);
				})
			);
		},
	},
};
