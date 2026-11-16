import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xunyi" | "reduoji" | "spyinju" | "spyinju2" | "spchijie" | "spcunsi" | "spcunsi2" | "spguixiu" | "heji">} */
export const groupSkills = {
	//王甫赵累
	xunyi: {
		audio: 2,
		trigger: {
			global: ["phaseBefore", "dieAfter"],
			player: "enterGame",
		},
		intro: { content: "效果目标：$" },
		filter(event, player) {
			if (event.name == "die") {
				return player.getStorage("xunyi").includes(event.player);
			}
			return !player.getStorage("xunyi").length && (event.name != "phase" || game.phaseNumber == 0);
		},
		async cost(event, trigger, player) {
			player.removeSkill("xunyi_effect");
			let prompt = trigger.name == "die" ? "是否令一名其他角色获得“义”？" : "令一名其他角色获得“义”";
			event.result = await player
				.chooseTarget(lib.filter.notMe, "殉义", prompt, trigger.name != "die")
				.set("ai", function (target) {
					var player = _status.event.player;
					return Math.max(1 + get.attitude(player, target) * get.threaten(target), Math.random());
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.markAuto("xunyi", event.targets);
			player.addSkill("xunyi_effect");
		},
		subSkill: {
			effect: {
				audio: "xunyi",
				trigger: {
					global: ["damageSource", "damageEnd"],
				},
				forced: true,
				charlotte: true,
				onremove(player) {
					player.unmarkAuto("xunyi", player.getStorage("xunyi"));
				},
				getIndex(event) {
					return event.num;
				},
				filter(event, player, name) {
					if (!player.getStorage("xunyi").length) {
						return false;
					}
					let viewer = event[name == "damageEnd" ? "player" : "source"];
					let list = player.getStorage("xunyi").concat([player]);
					if (!list.includes(viewer)) {
						return false;
					}
					let target = list.find(current => current != viewer);
					if (!target || (name == "damageEnd" && !target.countCards("he"))) {
						return false;
					}
					return target.isIn() && target != event[name != "damageEnd" ? "player" : "source"];
				},
				logTarget(event, player, name) {
					return player.getStorage("xunyi")[0];
				},
				async content(event, trigger, player) {
					const bool = event.triggername == "damageEnd";
					let viewer = trigger[bool ? "player" : "source"];
					let target = viewer == player ? event.targets[0] : player;
					if (bool) {
						await target.chooseToDiscard("he", true);
					} else {
						await target.draw();
					}
				},
			},
		},
	},
	//狗剩
	reduoji: {
		audio: "duoji",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		filterCard: true,
		position: "he",
		filterTarget: lib.filter.notMe,
		discard: false,
		toStorage: true,
		delay: false,
		check(card) {
			return 3 - get.value(card);
		},
		content() {
			"step 0";
			player.$give(cards[0], target, false);
			target.markAuto("reduoji", cards);
			game.log(player, "将", cards[0], "放在了", target, "的武将牌上");
			"step 1";
			game.delay();
		},
		group: ["reduoji_equip", "reduoji_gain"],
		intro: {
			content: "cards",
			onunmark: "throw",
		},
		ai: {
			order: 1,
			result: { target: -1 },
		},
		subSkill: {
			equip: {
				audio: "duoji",
				trigger: { global: "equipAfter" },
				forced: true,
				filter(event, player) {
					if (player == event.player || !event.player.getStorage("reduoji").length || !event.player.getCards("e").includes(event.card)) {
						return false;
					}
					var evt = event.getParent(2);
					return evt.name == "useCard" && evt.player == event.player;
				},
				logTarget: "player",
				content() {
					"step 0";
					player.gain(trigger.card, trigger.player, "give", "bySelf");
					"step 1";
					var target = trigger.player,
						storage = target.getStorage("reduoji");
					if (storage.length) {
						var card = storage[0];
						target.$throw(card, 1000);
						target.unmarkAuto("reduoji", [card]);
						game.log(target, "移去了", card);
						game.cardsDiscard(card);
						target.draw();
					}
				},
			},
			gain: {
				audio: "duoji",
				trigger: { global: "phaseEnd" },
				forced: true,
				filter(event, player) {
					return event.player.getStorage("reduoji").length > 0;
				},
				logTarget: "player",
				content() {
					var target = trigger.player,
						cards = target.storage.reduoji;
					target.$give(cards, player);
					player.gain(cards, "fromStorage");
					cards.length = 0;
					target.unmarkSkill("reduoji");
					game.delay();
				},
			},
		},
	},
	//SP辛毗
	spyinju: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		content() {
			"step 0";
			target
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"引裾：对" + get.translation(player) + "使用一张杀，或跳过下回合的出牌阶段和弃牌阶段"
				)
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("complexTarget", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.targetEnabled.apply(this, arguments);
				})
				.set("sourcex", player);
			"step 1";
			if (!result.bool) {
				target.addSkill("spyinju2");
			}
		},
		ai: {
			order: 1,
			expose: 0.2,
			result: {
				target: -1.5,
				player(player, target) {
					if (!target.canUse("sha", player)) {
						return 0;
					}
					if (target.countCards("h") == 0) {
						return 0;
					}
					if (target.countCards("h") == 1) {
						return -0.1;
					}
					if (player.countCards("h", "shan") == 0) {
						return -1;
					}
					if (player.hp < 2) {
						return -2;
					}
					return -0.5;
				},
			},
			threaten: 1.1,
		},
	},
	spyinju2: {
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		charlotte: true,
		sourceSkill: "spyinju",
		content() {
			player.skip("phaseUse");
			player.skip("phaseDiscard");
			player.removeSkill("spyinju2");
			game.log(player, "跳过了出牌阶段");
			game.log(player, "跳过了弃牌阶段");
		},
		mark: true,
		intro: { content: "衣襟被拽住了，下个准备阶段开始时跳过出牌阶段和弃牌阶段" },
	},
	spchijie: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		usable: 1,
		filter(event, player) {
			return event.player != player && event.targets.length == 1;
		},
		check(event, player) {
			return get.effect(player, event.card, event.player, player) < 0;
		},
		content() {
			"step 0";
			player.judge(function (card) {
				if (get.number(card) > 6) {
					return 2;
				}
				return 0;
			}).judge2 = function (result) {
				return result.bool ? true : false;
			};
			"step 1";
			if (result.bool) {
				trigger.targets.length = 0;
				trigger.getParent().triggeredTargets2.length = 0;
				trigger.cancel();
			}
		},
	},
	//糜夫人
	spcunsi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return !player.isTurnedOver();
		},
		filterTarget: lib.filter.notMe,
		content() {
			"step 0";
			player.turnOver();
			"step 1";
			var card = get.cardPile(function (card) {
				return card.name == "sha";
			});
			if (card) {
				target.gain(card, "gain2");
			}
			"step 2";
			target.addSkill("spcunsi2");
			target.addMark("spcunsi2", 1, false);
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					var card = { name: "sha", isCard: true };
					if (
						!target.hasSkillTag("nogain") &&
						game.hasPlayer(function (current) {
							return (
								get.attitude(target, current) < 0 &&
								!current.hasShan() &&
								target.canUse(card, current) &&
								!current.hasSkillTag("filterDamage", null, {
									player: target,
									card: card,
									jiu: true,
								}) &&
								get.effect(current, card, target) > 0
							);
						})
					) {
						return 4;
					}
					return 0;
				},
			},
		},
	},
	spcunsi2: {
		charlotte: true,
		trigger: { player: "useCard1" },
		firstDo: true,
		forced: true,
		popup: false,
		onremove: true,
		sourceSkill: "spcunsi",
		filter(event, player) {
			return event.card.name == "sha";
		},
		content() {
			trigger.baseDamage += player.countMark("spcunsi2");
			player.removeSkill("spcunsi2");
		},
		marktext: "嗣",
		intro: {
			content: "下一张【杀】的伤害+#",
		},
	},
	spguixiu: {
		trigger: { player: "damageEnd" },
		forced: true,
		filter(event, player) {
			if (typeof event.spguixiu == "boolean" && !event.spguixiu) {
				return false;
			}
			return player.isTurnedOver();
		},
		content() {
			player.turnOver();
		},
		group: ["spguixiu_draw", "spguixiu_count"],
		subSkill: {
			count: {
				trigger: { player: "damageBegin2" },
				lastDo: true,
				silent: true,
				content() {
					event.spguixiu = player.isTurnedOver();
				},
			},
			draw: {
				trigger: { player: "turnOverAfter" },
				forced: true,
				filter(event, player) {
					return !player.isTurnedOver();
				},
				content() {
					player.draw();
				},
			},
		},
	},
	//那个男人的舅舅
	heji: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		direct: true,
		locked: false,
		filter(event, player) {
			if (event.targets.length != 1 || event.targets[0] == player || event.targets[0].isDead()) {
				return false;
			}
			if (event.card.name != "juedou" && (event.card.name != "sha" || get.color(event.card) != "red")) {
				return false;
			}
			if (_status.connectMode && player.countCards("h") > 0) {
				return true;
			}
			return player.hasSha() || player.hasUsableCard("juedou");
		},
		clearTime: true,
		content() {
			player
				.chooseToUse(
					function (card, player, event) {
						var name = get.name(card);
						if (name != "sha" && name != "juedou") {
							return false;
						}
						return lib.filter.cardEnabled.apply(this, arguments);
					},
					"合击：是否对" + get.translation(trigger.targets[0]) + "使用一张【杀】或【决斗】？"
				)
				.set("logSkill", "heji")
				.set("complexSelect", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.targetEnabled.apply(this, arguments);
				})
				.set("sourcex", trigger.targets[0])
				.set("addCount", false);
		},
		group: "heji_gain",
		subSkill: {
			gain: {
				trigger: { player: "useCard" },
				forced: true,
				popup: false,
				filter(event, player) {
					return event.card.isCard && event.getParent(2).name == "heji";
				},
				content() {
					var card = get.cardPile2(function (card) {
						return get.color(card, false) == "red";
					}, "random");
					if (card) {
						player.gain(card, "gain2");
					}
				},
			},
		},
		mod: {
			aiOrder(player, card, num) {
				if (get.name(card, player) == "sha" && get.color(card, player) == "red") {
					return (
						num +
						0.6 *
							(_status.event.name == "chooseToUse" &&
							player.hasHistory("useCard", function (evt) {
								return evt.card.name == "sha" && evt.cards.length == 1;
							})
								? 1
								: -1)
					);
				}
			},
		},
	},
};
