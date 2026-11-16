import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhuikong" | "oldqiuyuan" | "qiuyuan" | "gongji" | "gongji2" | "zhuiyi" | "old_anxu" | "anxu">} */
export const groupSkills = {
	zhuikong: {
		audio: 2,
		trigger: { global: "phaseZhunbeiBegin" },
		check(event, player) {
			if (get.attitude(player, event.player) < -2) {
				var cards = player.getCards("h");
				if (cards.length > player.hp) {
					return true;
				}
				for (var i = 0; i < cards.length; i++) {
					var useful = get.useful(cards[i]);
					if (useful < 5) {
						return true;
					}
					if (get.number(cards[i]) > 9 && useful < 7) {
						return true;
					}
				}
			}
			return false;
		},
		logTarget: "player",
		filter(event, player) {
			return player.hp < player.maxHp && player.canCompare(event.player);
		},
		async content(event, trigger, player) {
			const result = await player.chooseToCompare(trigger.player).forResult();
			if (result.bool) {
				if (event.name == "zhuikong") {
					trigger.player.addTempSkill("zishou2");
				} else {
					trigger.player.skip("phaseUse");
				}
			} else {
				trigger.player.storage.zhuikong_distance = player;
				trigger.player.addTempSkill("zhuikong_distance");
			}
		},
		subSkill: {
			distance: {
				sub: true,
				onremove: true,
				mod: {
					globalFrom(from, to, distance) {
						if (from.storage.zhuikong_distance == to) {
							return -Infinity;
						}
					},
				},
			},
		},
	},
	oldqiuyuan: {
		audio: "qiuyuan",
		inherit: "qiuyuan",
		filter(event, player) {
			return (
				event.card.name == "sha" &&
				game.hasPlayer(current => {
					return current != player && !event.targets.includes(current) && current.countCards("h") > 0 && lib.filter.targetEnabled(event.card, event.player, current);
				})
			);
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const { card } = trigger;
			const result = await target
				.chooseToGive("he", `交给${get.translation(player)}一张牌，若此牌不为【闪】，则成为${get.translation(card)}的额外目标`, player, true)
				.set("ai", card => {
					const { player, target } = get.event();
					return Math.sign(Math.sign(get.attitude(player, target)) - 0.5) * get.value(card, player, "raw");
				})
				.forResult();
			if (!result?.bool || !result?.cards?.length || get.name(result.cards[0], target) !== "shan") {
				trigger.getParent().targets.push(target);
				trigger.getParent().triggeredTargets2.push(target);
				game.log(target, "成为了", card, "的额外目标");
			}
		},
	},
	qiuyuan: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			return (
				event.card.name == "sha" &&
				game.hasPlayer(current => {
					return current != player && !event.targets.includes(current) && lib.filter.targetEnabled(event.card, event.player, current);
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					const evt = get.event().getTrigger();
					return target != player && !evt.targets.includes(target) && lib.filter.targetEnabled(evt.card, evt.player, target);
				})
				.set("ai", target => {
					const evt = get.event().getTrigger();
					const player = get.player();
					return get.effect(target, evt.card, evt.player, player) + 0.1;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const { card } = trigger;
			const { bool } = await target
				.chooseToGive({ name: "shan" }, `交给${get.translation(player)}一张【闪】，或成为${get.translation(card)}的额外目标`, player)
				.set("ai", card => {
					const { player, target } = get.event();
					return get.attitude(player, target) >= 0 ? 1 : -1;
				})
				.forResult();
			if (!bool) {
				trigger.getParent().targets.push(target);
				trigger.getParent().triggeredTargets2.push(target);
				game.log(target, "成为了", card, "的额外目标");
			}
		},
		ai: {
			expose: 0.2,
			effect: {
				target_use(card, player, target) {
					if (card.name != "sha") {
						return;
					}
					var players = game.filterPlayer();
					if (get.attitude(player, target) <= 0) {
						for (var i = 0; i < players.length; i++) {
							var target2 = players[i];
							if (player != target2 && target != target2 && player.canUse(card, target2, false) && get.effect(target2, { name: "shacopy", nature: card.nature, suit: card.suit }, player, target) > 0 && get.effect(target2, { name: "shacopy", nature: card.nature, suit: card.suit }, player, player) < 0) {
								if (target.hp == target.maxHp) {
									return 0.3;
								}
								return 0.6;
							}
						}
					} else {
						for (var i = 0; i < players.length; i++) {
							var target2 = players[i];
							if (player != target2 && target != target2 && player.canUse(card, target2, false) && get.effect(target2, { name: "shacopy", nature: card.nature, suit: card.suit }, player, player) > 0) {
								if (player.canUse(card, target2)) {
									return;
								}
								if (target.hp == target.maxHp) {
									return [0, 1];
								}
								return [0, 0];
							}
						}
					}
				},
			},
		},
	},
	gongji: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		position: "he",
		filterCard: true,
		check(card) {
			if (get.type(card) != "equip") {
				return 0;
			}
			var player = _status.currentPhase;
			if (player.countCards("he", { subtype: get.subtype(card) }) > 1) {
				return 11 - get.equipValue(card);
			}
			return 6 - get.equipValue(card);
		},
		async content(event, trigger, player) {
			const { cards } = event;
			player.addTempSkill("gongji2");
			if (get.type(cards[0], null, cards[0].original == "h" ? player : false) != "equip") {
				return;
			}
			const result = await player
				.chooseTarget({
					prompt: "是否弃置一名角色的一张牌？",
					filterTarget(card, player, target) {
						return player != target && target.countCards("he") > 0;
					},
					ai(target) {
						const player = _status.event.player;
						if (get.attitude(player, target) < 0) {
							return Math.max(0.5, get.effect(target, { name: "sha" }, player, player));
						}
						return 0;
					},
				})
				.forResult();
			if (!result.bool || !result.targets?.length) {
				return;
			}
			player.line(result.targets, "green");
			const target = result.targets[0];
			await player.discardPlayerCard({
				target,
				position: "he",
				forced: true,
				ai: get.buttonValue,
			});
		},
		ai: {
			order: 9,
			result: {
				player: 1,
			},
		},
	},
	gongji2: {
		mod: {
			attackRangeBase() {
				return Infinity;
			},
		},
	},
	zhuiyi: {
		audio: 2,
		audioname: ["re_bulianshi"],
		trigger: { player: "die" },
		skillAnimation: true,
		animationColor: "wood",
		forceDie: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("zhuiyi"),
					filterTarget(card, player, target) {
						return player !== target && _status.event.sourcex !== target;
					},
					ai(target) {
						let num = get.attitude(_status.event.player, target);
						if (num > 0) {
							if (target.hp == 1) {
								num += 2;
							}
							if (target.hp < target.maxHp) {
								num += 2;
							}
						}
						return num;
					},
				})
				.set("forceDie", true)
				.set("sourcex", trigger.source)
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.line(target, "green");
			await target.recover();
			await target.draw(3);
		},
		ai: {
			expose: 0.5,
		},
	},
	old_anxu: {
		enable: "phaseUse",
		usable: 1,
		multitarget: true,
		audio: "anxu",
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			var num = target.countCards("h");
			if (ui.selected.targets.length) {
				return num < ui.selected.targets[0].countCards("h");
			}
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (num > players[i].countCards("h")) {
					return true;
				}
			}
			return false;
		},
		selectTarget: 2,
		async content(event, trigger, player) {
			const { targets } = event;
			let gainner;
			let giver;
			if (targets[0].countCards("h") < targets[1].countCards("h")) {
				gainner = targets[0];
				giver = targets[1];
			} else {
				gainner = targets[1];
				giver = targets[0];
			}
			const result = await gainner
				.gainPlayerCard({
					target: giver,
					position: "h",
					forced: true,
					visibleMove: true,
				})
				.forResult();
			if (!result.cards?.length) {
				return;
			}
			const card = result.cards[0];
			if (get.suit(card) == "spade") {
				return;
			}
			await player.draw();
		},
		ai: {
			order: 10.5,
			threaten: 2.3,
			result: {
				target(player, target) {
					var num = target.countCards("h");
					var att = get.attitude(player, target);
					if (ui.selected.targets.length == 0) {
						if (att > 0) {
							return -1;
						}
						var players = game.filterPlayer();
						for (var i = 0; i < players.length; i++) {
							var num2 = players[i].countCards("h");
							var att2 = get.attitude(player, players[i]);
							if (num2 < num) {
								if (att2 > 0) {
									return -3;
								}
								return -1;
							}
						}
						return 0;
					} else {
						return 1;
					}
				},
				player: 1,
			},
		},
	},
	anxu: {
		enable: "phaseUse",
		usable: 1,
		multitarget: true,
		audio: 2,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			var num = target.countCards("h");
			if (ui.selected.targets.length) {
				return num < ui.selected.targets[0].countCards("h");
			}
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (num > players[i].countCards("h")) {
					return true;
				}
			}
			return false;
		},
		selectTarget: 2,
		async content(event, trigger, player) {
			const { targets } = event;
			let gainner;
			let giver;
			if (targets[0].countCards("h") < targets[1].countCards("h")) {
				gainner = targets[0];
				giver = targets[1];
			} else {
				gainner = targets[1];
				giver = targets[0];
			}
			const result = await giver
				.chooseCard({
					prompt: "选择一张手牌交给" + get.translation(gainner),
					forced: true,
				})
				.forResult();
			const card = result.cards[0];
			await giver.give(card, gainner);
			if (gainner.countCards("h") === giver.countCards("h")) {
				await player.chooseDrawRecover(true);
			}
		},
		ai: {
			order: 10.5,
			threaten: 1.6,
			result: {
				target(player, target) {
					var num = target.countCards("h");
					var att = get.attitude(player, target);
					if (ui.selected.targets.length == 0) {
						if (att > 0) {
							return -1;
						}
						var players = game.filterPlayer();
						for (var i = 0; i < players.length; i++) {
							var num2 = players[i].countCards("h");
							var att2 = get.attitude(player, players[i]);
							if (att2 >= 0 && num2 < num) {
								return -1;
							}
						}
						return 0;
					} else {
						return 1;
					}
				},
				player: 0.1,
			},
		},
	},
};
