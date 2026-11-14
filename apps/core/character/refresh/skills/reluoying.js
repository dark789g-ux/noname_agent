import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const reluoyingSkills = {
	reluoying: {
		audio: 2,
		audioname: ["dc_caozhi", "ol_caozhi"],
		group: ["reluoying_discard", "reluoying_judge"],
		subfrequent: ["judge"],
		subSkill: {
			discard: {
				audio: "reluoying",
				audioname: ["dc_caozhi", "ol_caozhi"],
				trigger: { global: ["loseAfter", "loseAsyncAfter"] },
				filter(event, player) {
					if (event.type != "discard" || event.getlx === false) {
						return false;
					}
					var cards = event.cards.slice(0);
					var evt = event.getl(player);
					if (evt && evt.cards) {
						cards.removeArray(evt.cards);
					}
					for (var i = 0; i < cards.length; i++) {
						if (cards[i].original != "j" && get.suit(cards[i], event.player) == "club" && get.position(cards[i], true) == "d") {
							return true;
						}
					}
					return false;
				},
				direct: true,
				async content(event, trigger, player) {
					// step 0
					if (trigger.delay == false) {
						await game.delay();
					}
					// step 1
					var cards = [],
						cards2 = trigger.cards.slice(0),
						evt = trigger.getl(player);
					if (evt && evt.cards) {
						cards2.removeArray(evt.cards);
					}
					for (var i = 0; i < cards2.length; i++) {
						if (cards2[i].original != "j" && get.suit(cards2[i], trigger.player) == "club" && get.position(cards2[i], true) == "d") {
							cards.push(cards2[i]);
						}
					}
					let result;
					if (cards.length) {
						result = await player
							.chooseButton(["落英：选择要获得的牌", cards], [1, cards.length])
							.set("ai", function (button) {
								return get.value(button.link, _status.event.player, "raw");
							})
							.forResult();
					}
					// step 2
					if (result && result.bool) {
						player.logSkill(event.name);
						await player.gain(result.links, "gain2", "log");
					}
				},
			},
			judge: {
				audio: "reluoying",
				audioname: ["dc_caozhi", "ol_caozhi"],
				trigger: { global: "cardsDiscardAfter" },
				direct: true,
				filter(event, player) {
					var evt = event.getParent().relatedEvent;
					if (!evt || evt.name != "judge") {
						return;
					}
					if (evt.player == player) {
						return false;
					}
					if (get.position(event.cards[0], true) != "d") {
						return false;
					}
					return get.suit(event.cards[0]) == "club";
				},
				async content(event, trigger, player) {
					// step 0
					const result = await player
						.chooseButton(["落英：选择要获得的牌", trigger.cards], [1, trigger.cards.length])
						.set("ai", function (button) {
							return get.value(button.link, _status.event.player, "raw");
						})
						.forResult();
					// step 1
					if (result.bool) {
						player.logSkill(event.name);
						await player.gain(result.links, "gain2", "log");
					}
				},
			},
		},
	},
	chengzhang: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		derivation: "rejiushi_mark",
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "water",
		filter(event, player) {
			var num = 0;
			player.getAllHistory("sourceDamage", function (evt) {
				num += evt.num;
			});
			if (num >= 7) {
				return true;
			}
			player.getAllHistory("damage", function (evt) {
				num += evt.num;
			});
			return num >= 7;
		},
		async content(event, trigger, player) {
			player.markSkill("rejiushi_mark");
			player.awakenSkill(event.name);
			player.storage.chengzhang = true;
			await player.recover();
			await player.draw();
		},
		ai: {
			combo: "rejiushi",
		},
	},
	rejiushi: {
		audio: 2,
		group: ["rejiushi1", "rejiushi3", "rejiushi_gain"],
		subfrequent: ["gain"],
		subSkill: {
			gain: {
				audio: "rejiushi",
				trigger: { player: "turnOverAfter" },
				frequent: true,
				filter(event, player) {
					return player.storage.chengzhang == true;
				},
				prompt: "是否发动【酒诗】，从牌堆中随机获得一张锦囊牌？",
				async content(event, trigger, player) {
					const card = get.cardPile2(card => get.type2(card) == "trick", "random");
					if (card) {
						await player.gain(card, "gain2", "log");
					}
				},
			},
		},
	},
	rejiushi1: {
		hiddenCard(player, name) {
			if (name == "jiu") {
				return !player.isTurnedOver();
			}
			return false;
		},
		audio: "rejiushi",
		enable: "chooseToUse",
		sourceSkill: "rejiushi",
		filter(event, player) {
			if (player.classList.contains("turnedover")) {
				return false;
			}
			return event.filterCard({ name: "jiu", isCard: true }, player, event);
		},
		async content(event, trigger, player) {
			if (_status.event.getParent(2).type == "dying") {
				event.dying = player;
				event.type = "dying";
			}
			await player.turnOver();
			await player.useCard({ name: "jiu", isCard: true }, player);
		},
		ai: {
			save: true,
			skillTagFilter(player, tag, arg) {
				return !player.isTurnedOver() && _status.event?.dying == player;
			},
			order: 5,
			result: {
				player(player) {
					if (_status.event.parent.name == "phaseUse") {
						if (player.countCards("h", "jiu") > 0) {
							return 0;
						}
						if (player.getEquip("zhuge") && player.countCards("h", "sha") > 1) {
							return 0;
						}
						if (!player.countCards("h", "sha")) {
							return 0;
						}
						var targets = [];
						var target;
						var players = game.filterPlayer();
						for (var i = 0; i < players.length; i++) {
							if (get.attitude(player, players[i]) < 0) {
								if (player.canUse("sha", players[i], true, true)) {
									targets.push(players[i]);
								}
							}
						}
						if (targets.length) {
							target = targets[0];
						} else {
							return 0;
						}
						var num = get.effect(target, { name: "sha" }, player, player);
						for (var i = 1; i < targets.length; i++) {
							var num2 = get.effect(targets[i], { name: "sha" }, player, player);
							if (num2 > num) {
								target = targets[i];
								num = num2;
							}
						}
						if (num <= 0) {
							return 0;
						}
						var e2 = target.getEquip(2);
						if (e2) {
							if (e2.name == "tengjia") {
								if (!player.countCards("h", { name: "sha", nature: "fire" }) && !player.getEquip("zhuque")) {
									return 0;
								}
							}
							if (e2.name == "renwang") {
								if (!player.countCards("h", { name: "sha", color: "red" })) {
									return 0;
								}
							}
							if (e2.name == "baiyin") {
								return 0;
							}
						}
						if (player.getEquip("guanshi") && player.countCards("he") > 2) {
							return 1;
						}
						return target.countCards("h") > 3 ? 0 : 1;
					}
					if (player == _status.event.dying || player.isTurnedOver()) {
						return 3;
					}
				},
			},
			effect: {
				target(card, player, target) {
					if (target.isTurnedOver()) {
						if (get.tag(card, "damage")) {
							if (player.hasSkillTag("jueqing", false, target)) {
								return [1, -2];
							}
							if (target.hp == 1) {
								return;
							}
							return [1, target.countCards("h") / 2];
						}
					}
				},
			},
		},
	},
	rejiushi3: {
		audio: "rejiushi",
		trigger: { player: "damageEnd" },
		sourceSkill: "rejiushi",
		check(event, player) {
			return player.isTurnedOver();
		},
		filter(event, player) {
			if (
				player.hasHistory("useCard", evt => {
					if (evt.card.name != "jiu" || evt.getParent().name != "rejiushi1") {
						return false;
					}
					return evt.getParent("damage", true) == event;
				})
			) {
				return false;
			}
			return player.isTurnedOver();
		},
		prompt(event, player) {
			var str = "是否发动【酒诗】，将武将牌翻面";
			if (!player.storage.chengzhang) {
				str += "，并获得牌堆中的一张锦囊牌";
			}
			str += "？";
			return str;
		},
		async content(event, trigger, player) {
			await player.turnOver();
			if (!player.storage.chengzhang) {
				const card = get.cardPile2(card => get.type2(card) == "trick");
				if (card) {
					await player.gain(card, "gain2", "log");
				}
			}
		},
	},
	rejiushi_mark: {
		mark: true,
		marktext: "改",
		intro: {
			content: "当你需要使用【酒】时，若你的武将牌正面向上，你可以翻面，视为使用一张【酒】。当你受到伤害后，若你的武将牌于受到伤害时背面向上，你可以翻面。当你翻面时，你获得牌堆中的一张随机锦囊牌。",
		},
	},
	rehongyan: {
		audio: 2,
		mod: {
			suit(card, suit) {
				if (suit == "spade") {
					return "heart";
				}
			},
		},
		trigger: { player: "loseEnd" },
		filter(event, player) {
			if (player == _status.currentPhase || !event.visible || player.hp <= player.countCards("h")) {
				return false;
			}
			for (var i = 0; i < event.cards2.length; i++) {
				if (get.suit(event.cards2[i], player) == "heart") {
					return true;
				}
			}
			return false;
		},
		frequent: true,
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	reqimou: {
		limited: true,
		audio: 2,
		enable: "phaseUse",
		skillAnimation: true,
		animationColor: "orange",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const result = await player
				.chooseNumbers(get.prompt(event.name), [{ prompt: "请选择你要失去的体力值", min: 1, max: player.getHp() }], true)
				.set("processAI", () => {
					const player = get.player();
					let num = player.getHp() - 1;
					if (player.countCards("hs", { name: ["tao", "jiu"] })) {
						num = player.getHp();
					}
					return [num];
				})
				.forResult();
			const number = result.numbers[0];
			player.storage.reqimou2 = number;
			await player.loseHp(number);
			await player.draw(number);
			player.addTempSkill("reqimou2");
		},
		ai: {
			order: 14,
			result: {
				player(player) {
					if (player.hp < 3) {
						return false;
					}
					var mindist = player.hp;
					if (player.countCards("hs", card => player.canSaveCard(card, player))) {
						mindist++;
					}
					if (
						game.hasPlayer(function (current) {
							return get.distance(player, current) <= mindist && player.canUse("sha", current, false) && get.effect(current, { name: "sha" }, player, player) > 0;
						})
					) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	reqimou2: {
		onremove: true,
		mod: {
			cardUsable(card, player, num) {
				if (typeof player.storage.reqimou2 == "number" && card.name == "sha") {
					return num + player.storage.reqimou2;
				}
			},
			globalFrom(from, to, distance) {
				if (typeof from.storage.reqimou2 == "number") {
					return distance - from.storage.reqimou2;
				}
			},
		},
	},
	olniepan: {
		audio: 2,
		enable: "chooseToUse",
		skillAnimation: true,
		limited: true,
		animationColor: "orange",
		filter(event, player) {
			if (event.type == "dying") {
				if (player != event.dying) {
					return false;
				}
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			// step 0
			player.awakenSkill(event.name);
			player.storage.olniepan = true;
			await player.discard(player.getCards("hej"));
			// step 1
			await player.link(false);
			// step 2
			await player.turnOver(false);
			// step 3
			await player.draw(3);
			// step 4
			if (player.hp < 3) {
				await player.recover(3 - player.hp);
			}
			// step 5
			const result = await player
				.chooseControl("bazhen", "olhuoji", "olkanpo")
				.set("prompt", "选择获得一个技能")
				.set("ai", () => {
					let player = get.event().player,
						threaten = get.threaten(player);
					if (!player.hasEmptySlot(2)) {
						return "olhuoji";
					}
					if (threaten < 0.8) {
						return "olkanpo";
					}
					if (threaten < 1.6) {
						return "bazhen";
					}
					return ["olhuoji", "bazhen"].randomGet();
				})
				.forResult();
			// step 6
			player.addSkills(result.control);
		},
		derivation: ["bazhen", "olhuoji", "olkanpo"],
		ai: {
			order: 1,
			skillTagFilter(player, tag, target) {
				if (player != target || player.storage.olniepan) {
					return false;
				}
			},
			save: true,
			result: {
				player(player) {
					if (player.hp <= 0) {
						return 10;
					}
					if (player.hp <= 2 && player.countCards("he") <= 1) {
						return 10;
					}
					return 0;
				},
			},
			threaten(player, target) {
				if (!target.storage.olniepan) {
					return 0.6;
				}
			},
		},
	},
};
