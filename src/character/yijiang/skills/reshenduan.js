import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "reshenduan" | "reyonglve" | "yonglve" | "yonglve2" | "benxi" | "sidi" | "sidi2" | "sidi3">} */
export const groupSkills = {
	reshenduan: {
		audio: 2,
		trigger: {
			global: "loseAsyncAfter",
			player: "loseAfter",
		},
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return;
			}
			var evt = event.getl(player);
			for (var i = 0; i < evt.cards2.length; i++) {
				if (get.color(evt.cards2[i], player) == "black" && ["basic", "equip"].includes(get.type(evt.cards2[i], evt.hs.includes(evt.cards2[i]) ? evt.player : false)) && get.position(evt.cards2[i]) == "d") {
					return true;
				}
			}
			return false;
		},
		async cost(event, trigger, player) {
			const cards = [];
			const evt = trigger.getl(player);
			for (let i = 0; i < evt.cards2.length; i++) {
				if (get.color(evt.cards2[i], player) == "black" && ["basic", "equip"].includes(get.type(evt.cards2[i], evt.hs.includes(evt.cards2[i]) ? evt.player : false)) && get.position(evt.cards2[i]) == "d") {
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
	reyonglve: {
		audio: 2,
		trigger: { global: "phaseJudgeBegin" },
		filter(event, player) {
			return event.player != player && event.player.countCards("j") > 0;
		},
		async cost(event, trigger, player) {
			const att = get.attitude(player, trigger.player);
			const nh = trigger.player.countCards("h");
			let eff = get.effect(trigger.player, { name: "sha", isCard: true }, player, player);
			if (player.inRange(trigger.player) || !player.canUse({ name: "sha", isCard: true }, trigger.player, false)) {
				eff = 0;
			}

			event.result = await player
				.discardPlayerCard({
					prompt: get.prompt("yonglve", trigger.player),
					target: trigger.player,
					position: "j",
					ai(button) {
						const name = button.link.viewAs || button.link.name;
						const { att, nh, eff } = get.event();
						const trigger = get.event().getTrigger();
						if (att > 0 && eff >= 0) {
							return 1;
						}
						if (att >= 0 && eff > 0) {
							return 1;
						}
						if (
							att > 0 &&
							(trigger.player.hp >= 3 ||
								trigger.player.hasSkillTag("freeShan", false, {
									player: _status.event.player,
									card: new lib.element.VCard({ name: "sha", isCard: true }),
									type: "use",
								}) ||
								trigger.player.countCards("h", "shan"))
						) {
							if (name == "lebu" && nh > trigger.player.hp) {
								return 1;
							}
							if (name == "bingliang" && nh < trigger.player.hp) {
								return 1;
							}
						}
						return 0;
					},
				})
				.set("att", att)
				.set("nh", nh)
				.set("eff", eff)
				.set("chooseonly", true)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await trigger.player.discard({
				cards: event.cards,
				discarder: player,
			});
			if (!player.inRange(trigger.player) && player.canUse({ name: "sha", isCard: true }, trigger.player, false)) {
				await player.useCard({
					card: get.autoViewAs({ name: "sha", isCard: true }),
					targets: [trigger.player],
				});
			} else {
				await player.draw();
			}
		},
	},
	yonglve: {
		trigger: { global: "phaseJudgeBegin" },
		audio: 2,
		filter(event, player) {
			return event.player != player && event.player.countCards("j") > 0 && player.inRange(event.player);
		},
		async cost(event, trigger, player) {
			const att = get.attitude(player, trigger.player);
			const nh = trigger.player.countCards("h");
			let eff = get.effect(trigger.player, { name: "sha", isCard: true }, player, player);
			if (!player.canUse({ name: "sha", isCard: true }, trigger.player)) {
				eff = 0;
			}
			event.result = await player
				.discardPlayerCard({
					prompt: get.prompt("yonglve", trigger.player),
					target: trigger.player,
					position: "j",
					ai(button) {
						const name = button.link.viewAs || button.link.name;
						const { att, nh, eff } = get.event();
						const trigger = get.event().getTrigger();
						if (att > 0 && eff >= 0) {
							return 1;
						}
						if (att >= 0 && eff > 0) {
							return 1;
						}
						if (
							att > 0 &&
							(trigger.player.hp >= 3 ||
								trigger.player.hasSkillTag("freeShan", false, {
									player: _status.event.player,
									card: new lib.element.VCard({ name: "sha", isCard: true }),
									type: "use",
								}) ||
								trigger.player.countCards("h", "shan"))
						) {
							if (name == "lebu" && nh > trigger.player.hp) {
								return 1;
							}
							if (name == "bingliang" && nh < trigger.player.hp) {
								return 1;
							}
						}
						return 0;
					},
				})
				.set("att", att)
				.set("nh", nh)
				.set("eff", eff)
				.set("chooseonly", true)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await trigger.player.discard({
				cards: event.cards,
				discarder: player,
			});
			let related;
			let used = false;
			if (player.canUse({ name: "sha", isCard: true }, trigger.player)) {
				used = true;
				related = await player.useCard({
					card: get.autoViewAs({ name: "sha", isCard: true }),
					targets: [trigger.player],
				});
			}
			if (!used || !game.hasPlayer2(current => current.hasHistory("damage", evt => evt.getParent(2) == related))) {
				await player.draw();
			}
		},
		//group:'yonglve2'
	},
	yonglve2: {
		trigger: { source: "damage" },
		forced: true,
		popup: false,
		sourceSkill: "yonglve",
		filter(event) {
			return event.parent.skill == "yonglve";
		},
		async content(event, trigger, player) {
			player.storage.yonglve = true;
		},
	},
	benxi: {
		audio: 2,
		trigger: { player: "useCard2" },
		forced: true,
		filter(event, player) {
			return player.isPhaseUsing();
		},
		async content(event, trigger, player) {},
		mod: {
			globalFrom(from, to, distance) {
				if (_status.currentPhase == from) {
					return distance - from.countUsed();
				}
			},
			selectTarget(card, player, range) {
				if (_status.currentPhase == player) {
					if (card.name == "sha" && range[1] != -1) {
						if (
							!game.hasPlayer(function (current) {
								return get.distance(player, current) > 1;
							})
						) {
							range[1]++;
						}
					}
				}
			},
		},
		ai: {
			unequip: true,
			skillTagFilter(player) {
				if (
					game.hasPlayer(function (current) {
						return get.distance(player, current) > 1;
					})
				) {
					return false;
				}
			},
		},
	},
	sidi: {
		audio: 2,
		trigger: { global: "useCard" },
		filter(event, player) {
			if (event.card.name != "shan") {
				return false;
			}
			if (event.player == player) {
				return true;
			}
			return _status.currentPhase == player;
		},
		frequent: true,
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		async content(event, trigger, player) {
			player.addToExpansion(get.cards(), "gain2").gaintag.add("sidi");
		},
		group: "sidi2",
	},
	sidi2: {
		trigger: { global: "phaseUseBegin" },
		sourceSkill: "sidi",
		filter(event, player) {
			if (event.player == player || event.player.isDead()) {
				return false;
			}
			if (!player.getExpansions("sidi").length) {
				return false;
			}
			return true;
		},
		check(event, player) {
			if (get.attitude(player, event.player) >= 0) {
				return false;
			}
			if (event.player.getEquip("zhuge")) {
				return false;
			}
			if (event.player.hasSkill("paoxiao")) {
				return false;
			}
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (event.player.canUse("sha", players[i]) && get.attitude(player, players[i]) > 0) {
					break;
				}
			}
			if (i == players.length) {
				return false;
			}
			var nh = event.player.countCards("h");
			var nsha = event.player.countCards("h", "sha");
			if (nh < 2) {
				return false;
			}
			switch (nh) {
				case 2:
					if (nsha) {
						return Math.random() < 0.4;
					}
					return Math.random() < 0.2;
				case 3:
					if (nsha) {
						return Math.random() < 0.8;
					}
					return Math.random() < 0.3;
				case 4:
					if (nsha > 1) {
						return true;
					}
					if (nsha) {
						return Math.random() < 0.9;
					}
					return Math.random() < 0.5;
				default:
					return true;
			}
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const cards = player.getExpansions("sidi");
			let button;
			if (cards.length == 1) {
				button = cards[0];
			} else {
				const result = await player
					.chooseCardButton({
						prompt: "弃置一张“司敌”牌",
						cards,
						forced: true,
					})
					.forResult();
				if (result.bool && result.links?.length) {
					button = result.links[0];
				}
			}
			if (button) {
				await player.loseToDiscardpile(button);
				trigger.player.addTempSkill("sidi3", "phaseUseAfter");
				trigger.player.addMark("sidi3", 1, false);
			}
		},
	},
	sidi3: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num - player.countMark("sidi3");
				}
			},
		},
		onremove: true,
	},
};
