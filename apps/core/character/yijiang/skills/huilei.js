import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "huilei" | "xinenyuan" | "xinenyuan1" | "xinenyuan2" | "enyuan" | "enyuan1" | "enyuan2" | "xuanhuo" | "ganlu" | "buyi" | "pojun" | "jingce" | "xinjingce">} */
export const groupSkills = {
	huilei: {
		audio: 2,
		trigger: { player: "die" },
		forced: true,
		forceDie: true,
		filter(event) {
			return event.source && event.source.isIn();
		},
		logTarget: "source",
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			trigger.source.discard(trigger.source.getCards("he"));
		},
		ai: {
			threaten: 0.7,
		},
	},
	xinenyuan: {
		audio: 2,
		group: ["xinenyuan1", "xinenyuan2"],
	},
	xinenyuan1: {
		audio: true,
		sourceSkill: "xinenyuan",
		trigger: { player: "gainAfter", global: "loseAsyncAfter" },
		filter(event, player, triggername, target) {
			return target?.isIn();
		},
		getIndex(event, player) {
			return game
				.filterPlayer(current => {
					if (current == player) {
						return false;
					}
					return event.getl?.(current)?.cards2?.filter(card => event.getg?.(player)?.includes(card)).length >= 2;
				})
				.sortBySeat();
		},
		logTarget: (event, player, triggername, target) => target,
		check(event, player, triggername, target) {
			return get.attitude(player, target) > 0;
		},
		prompt2: (event, player, triggername, target) => `令${get.translation(target)}摸一张牌`,
		async content(event, trigger, player) {
			await event.targets[0].draw();
		},
	},
	xinenyuan2: {
		audio: true,
		trigger: { player: "damageEnd" },
		sourceSkill: "xinenyuan",
		check(event, player) {
			const att = get.attitude(player, event.source);
			const num = event.source.countCards("h");
			if (att <= 0) {
				return true;
			}
			if (num > 2) {
				return true;
			}
			if (num) {
				return att < 4;
			}
			return false;
		},
		filter(event, player) {
			return event.source?.isIn() && event.source != player && event.num > 0;
		},
		logTarget: "source",
		prompt2(event, player) {
			return "令" + get.translation(event.source) + "交给你一张手牌或失去1点体力";
		},
		getIndex: event => event.num,
		async content(event, trigger, player) {
			const result = await trigger.source
				.chooseToGive(`恩怨：交给${get.translation(player)}一张手牌，或失去1点体力`, "h", player)
				.set("ai", card => {
					const { player, target } = get.event();
					if (get.effect(player, { name: "losehp" }, player, player) >= 0) {
						return 0;
					}
					if (get.attitude(target, player) > 0) {
						return 11 - get.value(card);
					}
					return 7 - get.value(card);
				})
				.forResult();
			if (!result?.bool) {
				await trigger.source.loseHp();
			}
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1.5];
					}
					if (!target.hasFriend()) {
						return;
					}
					if (get.tag(card, "damage")) {
						return [1, 0, 0, -0.7];
					}
				},
			},
		},
	},
	enyuan: {
		audio: 4,
		audioname2: { boss_songdiwang: "boss_songdiwang_enyuan" },
		locked: true,
		group: ["enyuan1", "enyuan2"],
	},
	enyuan1: {
		audio: ["enyuan3.mp3", "enyuan4.mp3"],
		audioname2: { boss_songdiwang: "boss_songdiwang_enyuan" },
		trigger: { player: "damageEnd" },
		forced: true,
		sourceSkill: "enyuan",
		filter(event, player) {
			return event.source?.isIn() && event.source != player && event.num > 0;
		},
		logTarget: "source",
		getIndex: event => event.num,
		async content(event, trigger, player) {
			const result = await trigger.source
				.chooseToGive(
					`恩怨：交给${get.translation(player)}一张红桃手牌，或失去1点体力`,
					(card, player) => {
						return get.suit(card) == "heart";
					},
					"h",
					player
				)
				.set("ai", card => {
					const { player, target } = get.event();
					if (get.effect(player, { name: "losehp" }, player, player) >= 0) {
						return 0;
					}
					if (get.attitude(target, player) > 0) {
						return 11 - get.value(card);
					}
					return 7 - get.value(card);
				})
				.forResult();
			if (!result?.bool) {
				await trigger.source.loseHp();
			}
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -2];
					}
					if (!target.hasFriend()) {
						return;
					}
					if (get.tag(card, "damage")) {
						return [1, 0, 0, -1];
					}
				},
			},
		},
	},
	enyuan2: {
		audio: ["enyuan1.mp3", "enyuan2.mp3"],
		audioname2: { boss_songdiwang: "boss_songdiwang_enyuan" },
		trigger: { player: "recoverEnd" },
		forced: true,
		logTarget: "source",
		sourceSkill: "enyuan",
		filter(event, player) {
			return event.source?.isIn() && event.source != player && event.num > 0;
		},
		getIndex: event => event.num,
		async content(event, trigger, player) {
			await trigger.source.draw();
		},
	},
	xuanhuo: {
		audio: 2,
		usable: 1,
		enable: "phaseUse",
		discard: false,
		lose: false,
		delay: 0,
		filter(event, player) {
			return player.countCards("he", { suit: "heart" });
		},
		filterCard(card) {
			return get.suit(card) == "heart";
		},
		filterTarget(card, player, target) {
			if (game.countPlayer() == 2) {
				return false;
			}
			return player != target;
		},
		check(card) {
			var player = get.owner(card);
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (players[i] != player && get.attitude(player, players[i]) > 3) {
					break;
				}
			}
			if (i == players.length) {
				return -1;
			}
			return 5 - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards, target } = event;

			await player.give(cards, target);

			let result = await player
				.gainPlayerCard({
					target,
					position: "he",
					forced: true,
				})
				.forResult();

			if (!result.bool || !result.cards?.length) {
				return;
			}

			const card = result.cards[0];
			if (!player.hasCard(cardx => cardx === card, "h")) {
				return;
			}

			result = await player
				.chooseTarget({
					prompt: `将${get.translation(card)}交给另一名其他角色`,
					filterTarget(card, player, target) {
						return target !== get.event().sourcex && target !== player;
					},
					ai(target) {
						return get.attitude(get.event().player, target);
					},
				})
				.set("sourcex", target)
				.forResult();

			if (result.bool && result.targets?.length) {
				await player.give(card, result.targets[0], "give");
				await game.delay();
			}
		},
		ai: {
			result: {
				target: -0.5,
			},
			basic: {
				order: 9,
			},
		},
	},
	ganlu: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		selectTarget: 2,
		filterTarget(card, player, target) {
			if (target.isMin()) {
				return false;
			}
			if (ui.selected.targets.length == 0) {
				return true;
			}
			if (ui.selected.targets[0].countCards("e") == 0 && target.countCards("e") == 0) {
				return false;
			}
			return Math.abs(ui.selected.targets[0].countCards("e") - target.countCards("e")) <= player.maxHp - player.hp;
		},
		multitarget: true,
		async content(event, trigger, player) {
			const { targets } = event;
			targets[0].swapEquip(targets[1]);
		},
		ai: {
			order: 10,
			threaten(player, target) {
				return 0.8 * Math.max(1 + target.maxHp - target.hp);
			},
			result: {
				target(player, target) {
					var list1 = [];
					var list2 = [];
					var num = player.maxHp - player.hp;
					var players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (get.attitude(player, players[i]) > 0) {
							list1.push(players[i]);
						} else if (get.attitude(player, players[i]) < 0) {
							list2.push(players[i]);
						}
					}
					list1.sort(function (a, b) {
						return a.countCards("e") - b.countCards("e");
					});
					list2.sort(function (a, b) {
						return b.countCards("e") - a.countCards("e");
					});
					var delta;
					for (var i = 0; i < list1.length; i++) {
						for (var j = 0; j < list2.length; j++) {
							delta = list2[j].countCards("e") - list1[i].countCards("e");
							if (delta <= 0) {
								continue;
							}
							if (delta <= num) {
								if (target == list1[i] || target == list2[j]) {
									return get.attitude(player, target);
								}
								return 0;
							}
						}
					}
					return 0;
				},
			},
			effect: {
				target(card, player, target) {
					if (target.hp == target.maxHp && get.tag(card, "damage")) {
						return 0.2;
					}
				},
			},
		},
	},
	buyi: {
		trigger: { global: "dying" },
		//priority:6,
		audio: 2,
		audioname: ["re_wuguotai"],
		filter(event, player) {
			return event.player.hp <= 0 && event.player.countCards("h") > 0;
		},
		async cost(event, trigger, player) {
			let check;
			if (trigger.player.isUnderControl(true, player)) {
				check = player.hasCard(function (card) {
					return get.type(card) != "basic";
				});
			} else {
				check = get.attitude(player, trigger.player) > 0;
			}

			event.result = await player
				.choosePlayerCard({
					prompt: get.prompt("buyi", trigger.player),
					target: trigger.player,
					filterButton(button) {
						if (_status.event.player == _status.event.target) {
							return lib.filter.cardDiscardable(button.link, _status.event.player);
						}
						return true;
					},
					position: "h",
					ai(button) {
						if (!_status.event.check) {
							return 0;
						}
						if (_status.event.target.isUnderControl(true, _status.event.player)) {
							if (get.type(button.link) != "basic") {
								return 10 - get.value(button.link);
							}
							return 0;
						}
						return Math.random();
					},
				})
				.set("check", check)
				.forResult();

			event.result.cards = event.result.links;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const card = event.cards[0];
			await player.showCards([card], get.translation(player) + "展示的手牌");
			if (get.type(card) !== "basic") {
				await trigger.player.discard(card);
				await trigger.player.recover();
			}
		},
		ai: {
			threaten: 1.4,
		},
	},
	pojun: {
		audio: 2,
		trigger: { source: "damageSource" },
		check(event, player) {
			if (event.player.isTurnedOver()) {
				return get.attitude(player, event.player) > 0;
			}
			if (event.player.hp < 3) {
				return get.attitude(player, event.player) < 0;
			}
			return get.attitude(player, event.player) > 0;
		},
		filter(event) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.card && event.card.name == "sha" && event.player.isIn();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await trigger.player.draw(Math.min(5, trigger.player.hp));
			await trigger.player.turnOver();
		},
	},
	jingce: {
		trigger: { player: "phaseUseEnd" },
		frequent: true,
		filter(event, player) {
			return player.countUsed(null, true) >= player.hp;
		},
		async content(event, trigger, player) {
			player.draw(2);
		},
		audio: 2,
	},
	xinjingce: {
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		filter(event, player) {
			return player.countUsed(null, true) >= player.hp;
		},
		async content(event, trigger, player) {
			player.draw(2);
		},
		audio: 2,
	},
};
