import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xianzhen" | "xianzhen2" | "xianzhen3" | "lihuo" | "lihuo2" | "lihuo3" | "chunlao" | "chunlao2" | "chunlao2_old" | "shenduan">} */
export const groupSkills = {
	xianzhen: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await player.chooseToCompare(target).forResult();
			if (result.bool) {
				player.storage[event.name] = target;
				player.addTempSkill(event.name + 2);
			} else {
				player.addTempSkill(event.name + 3);
			}
		},
		ai: {
			order(name, player) {
				var cards = player.getCards("h");
				if (player.countCards("h", "sha") == 0) {
					return 1;
				}
				for (var i = 0; i < cards.length; i++) {
					if (cards[i].name != "sha" && get.number(cards[i]) > 11 && get.value(cards[i]) < 7) {
						return 9;
					}
				}
				return get.order({ name: "sha" }) - 1;
			},
			result: {
				player(player) {
					if (player.countCards("h", "sha") > 0) {
						return 0;
					}
					var num = player.countCards("h");
					if (num > player.hp) {
						return 0;
					}
					if (num == 1) {
						return -2;
					}
					if (num == 2) {
						return -1;
					}
					return -0.7;
				},
				target(player, target) {
					var num = target.countCards("h");
					if (num == 1) {
						return -1;
					}
					if (num == 2) {
						return -0.7;
					}
					return -0.5;
				},
			},
			threaten: 1.3,
		},
	},
	xianzhen2: {
		charlotte: true,
		mod: {
			targetInRange(card, player, target) {
				if (target == player.storage.xianzhen) {
					return true;
				}
			},
			cardUsableTarget(card, player, target) {
				if (target == player.storage.xianzhen) {
					return true;
				}
			},
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (arg.target != player.storage.xianzhen) {
					return false;
				}
			},
		},
	},
	xianzhen3: {
		charlotte: true,
		mod: {
			cardEnabled(card) {
				if (card.name == "sha") {
					return false;
				}
			},
		},
	},
	lihuo: {
		trigger: { player: "useCard1" },
		filter(event, player) {
			if (event.card.name == "sha" && !game.hasNature(event.card)) {
				return true;
			}
			return false;
		},
		audio: 2,
		audioname: ["re_chengpu"],
		check(event, player) {
			return false;
		},
		async content(event, trigger, player) {
			const { card } = event;
			game.setNature(trigger.card, "fire");
			const next = game.createEvent("lihuo_clear");
			next.player = player;
			next.card = trigger.card;
			event.next.remove(next);
			next.forceDie = true;
			trigger.after.push(next);
			next.setContent(function () {
				if (
					player.isIn() &&
					player.getHistory("sourceDamage", function (evt) {
						return evt.getParent(2) == event.parent;
					}).length > 0
				) {
					player.loseHp();
				}
				game.setNature(card, [], true);
			});
		},
		group: "lihuo2",
	},
	lihuo2: {
		trigger: { player: "useCard2" },
		sourceSkill: "lihuo",
		filter(event, player) {
			if (event.card.name != "sha" || !game.hasNature(event.card, "fire")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !event.targets.includes(current) && player.canUse(event.card, current);
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("lihuo"),
					prompt2: `为${get.translation(trigger.card)}增加一个目标`,
					filterTarget(card, player, target) {
						return !_status.event.sourcex.includes(target) && player.canUse(_status.event.card, target);
					},
					ai(target) {
						const player = _status.event.player;
						return get.effect(target, _status.event.card, player, player);
					},
				})
				.set("sourcex", trigger.targets)
				.set("card", trigger.card)
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			if (!event.isMine() && !_status.connectMode) {
				await game.delayx();
			}
			const target = event.targets[0];
			trigger.targets.push(target);
		},
	},
	lihuo3: {
		trigger: { player: "useCardAfter" },
		vanish: true,
		sourceSkill: "lihuo",
		filter(event, player) {
			return event.card.name == "sha";
		},
		forced: true,
		audio: false,
		async content(event, trigger, player) {
			player.loseHp();
			player.removeSkill("lihuo3");
		},
	},
	chunlao: {
		trigger: { player: "phaseJieshuBegin" },
		audio: 2,
		audioname: ["xin_chengpu"],
		filter(event, player) {
			return player.countCards("h") > 0 && (_status.connectMode || player.countCards("h", "sha") > 0) && !player.getExpansions("chunlao").length;
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard({
					prompt: get.prompt("chunlao"),
					filterCard: get.filter({ name: "sha" }),
					selectCard: [1, Math.max(1, player.countCards("h", "sha"))],
					allowChooseAll: true,
					ai() {
						return 1;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await player.addToExpansion({
				cards: event.cards,
				source: player,
				animate: "giveAuto",
				gaintag: ["chunlao"],
			});
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					if (_status.currentPhase != player) {
						return;
					}
					if (card.name == "sha" && !player.needsToDiscard() && !player.getExpansions("chunlao").length && target.hp > 1) {
						return "zeroplayertarget";
					}
				},
			},
			threaten: 1.4,
		},
		group: "chunlao2",
	},
	chunlao2: {
		enable: "chooseToUse",
		sourceSkill: "chunlao",
		filter(event, player) {
			return event.type == "dying" && event.dying && event.dying.hp <= 0 && player.getExpansions("chunlao").length > 0;
		},
		filterTarget(card, player, target) {
			return target == _status.event.dying;
		},
		direct: true,
		clearTime: true,
		delay: false,
		selectTarget: -1,
		async content(event, trigger, player) {
			const target = event.target;
			const result = await player
				.chooseCardButton({
					prompt: get.translation("chunlao"),
					cards: player.getExpansions("chunlao"),
					forced: true,
				})
				.forResult();
			if (!result.bool || !result.links?.length) {
				return;
			}
			player.logSkill("chunlao", target);
			await player.loseToDiscardpile({
				cards: result.links,
			});
			event.type = "dying";
			await target.useCard({
				card: get.autoViewAs({ name: "jiu", isCard: true }),
				targets: [target],
			});
		},
		ai: {
			order: 6,
			skillTagFilter(player) {
				return player.getExpansions("chunlao").length > 0;
			},
			save: true,
			result: {
				target: 3,
			},
			threaten: 1.6,
		},
	},
	chunlao2_old: {
		trigger: { global: "dying" },
		sourceSkill: "chunlao",
		//priority:6,
		filter(event, player) {
			return event.player.hp <= 0 && player.storage.chunlao.length > 0;
		},
		async cost(event, trigger, player) {
			const att = get.attitude(player, trigger.player);

			event.result = await player
				.chooseCardButton({
					prompt: get.prompt("chunlao", trigger.player),
					cards: player.storage.chunlao,
					ai(button) {
						if (_status.event.att > 0) {
							return 1;
						}
						return 0;
					},
				})
				.set("att", att)
				.forResult();

			event.result.cards = event.result.links;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const cards = event.cards;
			player.$throw(cards);
			player.storage.chunlao.remove(cards[0]);
			cards[0].discard();
			player.syncStorage("chunlao");
			await trigger.player.useCard({
				card: get.autoViewAs({ name: "jiu", isCard: true }),
				targets: [trigger.player],
			});
			if (!player.storage.chunlao.length) {
				player.unmarkSkill("chunlao");
			} else {
				player.markSkill("chunlao");
			}
		},
		ai: {
			expose: 0.2,
		},
	},
	shenduan: {
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return;
			}
			var evt = event.getl(player);
			for (var i = 0; i < evt.cards2.length; i++) {
				if (get.color(evt.cards2[i], evt.hs.includes(evt.cards2[i]) ? evt.player : false) == "black" && get.type(evt.cards2[i]) == "basic" && get.position(evt.cards2[i], evt.hs.includes(evt.cards2[i]) ? evt.player : false) == "d") {
					return true;
				}
			}
			return false;
		},
		audio: 2,
		async cost(event, trigger, player) {
			const cards = [];
			const evt = trigger.getl(player);
			for (let i = 0; i < evt.cards2.length; i++) {
				if (get.color(evt.cards2[i], evt.hs.includes(evt.cards2[i]) ? evt.player : false) == "black" && get.type(evt.cards2[i], evt.hs.includes(evt.cards2[i]) ? evt.player : false) == "basic" && get.position(evt.cards2[i]) == "d") {
					cards.push(evt.cards2[i]);
				}
			}
			if (!cards.length) {
				return;
			}
			const result = await player
				.chooseButtonTarget({
					createDialog: [get.prompt2(event.skill), cards],
					filterButton: true,
					filterTarget(_, player, target) {
						const card = ui.selected.buttons[0]?.link;
						return player.canUse({ name: "bingliang", cards: [card] }, target, false);
					},
					ai1(button) {
						return Math.random();
					},
					ai2(target) {
						const player = get.player();
						return get.effect(target, { name: "bingliang" }, player, player);
					},
				})
				.forResult();
			const { bool, links, targets } = result;
			if (bool && links?.length && targets?.length) {
				cards.remove(links[0]);
				event.result = {
					bool: true,
					cost_data: [targets[0], links[0], cards],
				};
			}
		},
		async content(event, trigger, player) {
			let {
				cost_data: [target, card, cards],
			} = event;
			player.line(target);
			await player.useCard({ name: "bingliang" }, target, [card], "shenduan").set("animate", false);
			while (cards?.someInD("d")) {
				const result = await player
					.chooseButtonTarget({
						createDialog: [get.prompt2(event.name), cards],
						filterButton: true,
						filterTarget(_, player, target) {
							const card = ui.selected.buttons[0]?.link;
							return player.canUse({ name: "bingliang", cards: [card] }, target, false);
						},
						ai1(button) {
							return Math.random();
						},
						ai2(target) {
							const player = get.player();
							return get.effect(target, { name: "bingliang" }, player, player);
						},
					})
					.forResult();
				const { bool, links, targets } = result;
				if (bool && links?.length && targets?.length) {
					player.line(targets[0]);
					cards.remove(links[0]);
					await player.useCard({ name: "bingliang" }, targets[0], links, "shenduan").set("animate", false);
				} else {
					break;
				}
				cards = cards.filterInD("d");
			}
		},
	},
};
