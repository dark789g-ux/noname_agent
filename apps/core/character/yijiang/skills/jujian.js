import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jujian" | "yizhong" | "jueqing" | "shangshi" | "luoying" | "jiushi" | "jiushi1" | "jiushi3" | "zongshi" | "zishou" | "zishou2" | "olddanshou">} */
export const groupSkills = {
	jujian: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		filterCard: true,
		position: "he",
		selectCard: [1, 3],
		check(card) {
			var player = get.owner(card);
			if (get.type(card) == "trick") {
				return 10;
			}
			if (player.countCards("h") - player.hp - ui.selected.cards.length > 0) {
				return 8 - get.value(card);
			}
			return 4 - get.value(card);
		},
		filterTarget(card, player, target) {
			return player != target;
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			target.draw(cards.length);
			if (cards.length == 3) {
				if (get.type(cards[0], "trick") == get.type(cards[1], "trick") && get.type(cards[0], "trick") == get.type(cards[2], "trick")) {
					player.recover();
				}
			}
		},
		ai: {
			expose: 0.2,
			order: 1,
			result: {
				target: 1,
			},
		},
	},
	yizhong: {
		trigger: { target: "shaBefore" },
		forced: true,
		audio: 2,
		filter(event, player) {
			if (!player.hasEmptySlot(2)) {
				return false;
			}
			return event.card.name == "sha" && get.color(event.card) == "black";
		},
		async content(event, trigger, player) {
			trigger.cancel();
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (player == target && get.subtypes(card).includes("equip2")) {
						if (get.equipValue(card) <= 8) {
							return 0;
						}
					}
					if (!player.hasEmptySlot(2)) {
						return;
					}
					if (card.name == "sha" && get.color(card) == "black") {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	jueqing: {
		audio: 2,
		audioname: ["ol_zhangchunhua"],
		trigger: { source: "damageBefore" },
		forced: true,
		async content(event, trigger, player) {
			trigger.cancel();
			trigger.player.loseHp(trigger.num);
		},
		ai: {
			jueqing: true,
		},
	},
	shangshi: {
		audio: 2,
		audioname: ["ol_zhangchunhua"],
		audioname2: {
			re_zhangchunhua: "reshangshi",
		},
		trigger: {
			player: ["loseAfter", "changeHp", "gainMaxHpAfter", "loseMaxHpAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		frequent: true,
		filter(event, player) {
			if (event.getl && !event.getl(player)) {
				return false;
			}
			return player.countCards("h") < player.getDamagedHp();
		},
		async content(event, trigger, player) {
			player.draw(player.getDamagedHp() - player.countCards("h"));
		},
		ai: {
			noh: true,
			freeSha: true,
			freeShan: true,
			skillTagFilter(player, tag) {
				if (player.maxHp - player.hp < player.countCards("h")) {
					return false;
				}
			},
		},
	},
	luoying: {
		//unique:true,
		//gainable:true,
		audio: 2,
		group: ["luoying_discard", "luoying_judge"],
		subfrequent: ["judge"],
		subSkill: {
			discard: {
				audio: "luoying",
				trigger: { global: "loseAfter" },
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
				async cost(event, trigger, player) {
					if (trigger.delay == false) {
						await game.delay();
					}
					const cards2 = trigger.cards.slice(0);
					const evt = trigger.getl(player);
					if (evt && evt.cards) {
						cards2.removeArray(evt.cards);
					}
					const cards = cards2.filter(card => card.original !== "j" && get.suit(card, trigger.player) === "club" && get.position(card, true) === "d");
					if (!cards.length) {
						return;
					}

					event.result = await player
						.chooseButton({
							createDialog: ["落英：选择要获得的牌", cards],
							selectButton: [1, cards.length],
							ai(button) {
								return get.value(button.link, _status.event.player, "raw");
							},
						})
						.forResult();
					event.result.cards = event.result.links;
				},
				async content(event, trigger, player) {
					await player.gain({
						cards: event.cards,
						animate: "gain2",
						log: true,
					});
				},
			},
			judge: {
				audio: "luoying",
				trigger: { global: "cardsDiscardAfter" },
				//frequent:'check',
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
				async cost(event, trigger, player) {
					const result = await player
						.chooseButton({
							createDialog: ["落英：选择要获得的牌", trigger.cards],
							selectButton: [1, trigger.cards.length],
							ai(button) {
								return get.value(button.link, _status.event.player, "raw");
							},
						})
						.forResult();

					event.result = {
						bool: result.bool,
						cards: result.links,
					};
				},
				async content(event, trigger, player) {
					await player.gain({
						cards: event.cards,
						animate: "gain2",
						log: true,
					});
				},
			},
		},
	},
	jiushi: {
		audio: "jiushi1",
		group: ["jiushi1", "jiushi3"],
	},
	jiushi1: {
		audio: 2,
		enable: "chooseToUse",
		sourceSkill: "jiushi",
		hiddenCard(player, name) {
			if (name == "jiu") {
				return !player.isTurnedOver();
			}
			return false;
		},
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
	jiushi3: {
		audio: "jiushi1",
		trigger: { player: "damageEnd" },
		sourceSkill: "jiushi",
		check(event, player) {
			return player.isTurnedOver();
		},
		prompt: "是否发动【酒诗】，将武将牌翻面？",
		filter(event, player) {
			if (event.checkJiushi) {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			player.turnOver();
		},
	},
	zongshi: {
		audio: 2,
		mod: {
			maxHandcard(player, num) {
				return num + game.countGroup();
			},
		},
	},
	zishou: {
		audio: 2,
		audioname: ["re_liubiao"],
		trigger: { player: "phaseDrawBegin2" },
		check(event, player) {
			return player.countCards("h") <= (player.hasSkill("zongshi") ? player.maxHp : player.hp - 2) || player.skipList.includes("phaseUse");
		},
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			trigger.num += game.countGroup();
			player.addTempSkill("zishou2");
		},
		ai: {
			threaten: 1.5,
		},
	},
	zishou2: {
		mod: {
			playerEnabled(card, player, target) {
				if (player != target) {
					return false;
				}
			},
		},
	},
	olddanshou: {
		audio: "danshou",
		trigger: { source: "damageSource" },
		//priority:9,
		check(event, player) {
			return get.attitude(player, event.player) <= 0;
		},
		async content(event, trigger, player) {
			await player.draw();
			const cards = Array.from(ui.ordering.childNodes);
			cards.forEach(card => card.discard());
			const evt = _status.event.getParent("phase", true);
			if (evt) {
				game.resetSkills();
				_status.event = evt;
				_status.event.finish();
				_status.event.untrigger(true);
			}
		},
		ai: {
			jueqing: true,
		},
	},
};
