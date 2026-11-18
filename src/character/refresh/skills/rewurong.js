import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rewurongSkills = {
	rewurong: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;

			// step 0
			if (target.countCards("h") == 0 || player.countCards("h") == 0) {
				return;
			}

			// step 1
			const sendback = function () {
				if (_status.event != event) {
					return function () {
						event.resultOL = _status.event.resultOL;
					};
				}
			};

			if (player.isOnline()) {
				player.wait(sendback);
				event.ol = true;
				player.send(function () {
					game.me.chooseCard(true).set("glow_result", true).ai = function () {
						return Math.random();
					};
					game.resume();
				});
			} else {
				event.localPlayer = true;
				const hasShan = !target.countCards("h", "shan");
				player.chooseCard(true).set("glow_result", true).ai = function (card) {
					if (hasShan && get.name(card) == "sha") {
						return 1;
					}
					return Math.random();
				};
			}

			if (target.isOnline()) {
				target.wait(sendback);
				event.ol = true;
				target.send(function () {
					const rand = Math.random() < 0.4;
					game.me
						.chooseCard(true)
						.set("glow_result", true)
						.set("ai", function (card) {
							if (rand) {
								return card.name == "shan" ? 1 : 0;
							}
							return card.name == "shan" ? 0 : 1;
						});
					game.resume();
				});
			} else {
				event.localTarget = true;
			}

			// step 2
			let result;
			if (event.localPlayer) {
				result = await player
					.chooseCard(true)
					.set("glow_result", true)
					.set("ai", function (card) {
						if (!target.countCards("h", "shan") && get.name(card) == "sha") {
							return 1;
						}
						return Math.random();
					})
					.forResult();
				event.card1 = result.cards[0];
			}

			if (event.localTarget) {
				const rand = Math.random() < 0.4;
				result = await target
					.chooseCard(true)
					.set("glow_result", true)
					.set("ai", function (card) {
						if (rand) {
							return card.name == "shan" ? 1 : 0;
						}
						return card.name == "shan" ? 0 : 1;
					})
					.forResult();
				event.card2 = result.cards[0];
			}

			// step 3
			if (!event.resultOL && event.ol) {
				game.pause();
			}

			// step 4
			try {
				if (!event.card1) {
					event.card1 = event.resultOL[player.playerid].cards[0];
				}
				if (!event.card2) {
					event.card2 = event.resultOL[target.playerid].cards[0];
				}
				if (!event.card1 || !event.card2) {
					throw new Error("err");
				}
			} catch (e) {
				console.log(e);
				return;
			}

			game.broadcastAll(
				function (card1, card2) {
					card1.classList.remove("glow");
					card2.classList.remove("glow");
				},
				event.card1,
				event.card2
			);

			// step 5
			game.broadcastAll(function () {
				ui.arena.classList.add("thrownhighlight");
			});
			game.addVideo("thrownhighlight1");
			player.$compare(event.card1, target, event.card2);
			game.delay(4);

			// step 6
			let next = game.createEvent("showCards");
			next.player = player;
			next.cards = [event.card1];
			next.setContent("emptyEvent");
			game.log(player, "展示了", event.card1);

			// step 7
			next = game.createEvent("showCards");
			next.player = target;
			next.cards = [event.card2];
			next.setContent("emptyEvent");
			game.log(target, "展示了", event.card2);

			// step 8
			const name1 = get.name(event.card1);
			const name2 = get.name(event.card2);

			if (name1 == "sha" && name2 != "shan") {
				target.$gain2(event.card2);
				const clone = event.card1.clone;
				if (clone) {
					clone.style.transition = "all 0.5s";
					clone.style.transform = "scale(1.2)";
					clone.delete();
					game.addVideo("deletenode", player, get.cardsInfo([clone]));
				}
				game.broadcast(function (card) {
					const clone = card.clone;
					if (clone) {
						clone.style.transition = "all 0.5s";
						clone.style.transform = "scale(1.2)";
						clone.delete();
					}
				}, event.card1);
				await target.damage("nocard");
			} else if (name1 != "sha" && name2 == "shan") {
				target.$gain2(event.card2);
				const clone = event.card1.clone;
				if (clone) {
					clone.style.transition = "all 0.5s";
					clone.style.transform = "scale(1.2)";
					clone.delete();
					game.addVideo("deletenode", player, get.cardsInfo([clone]));
				}
				game.broadcast(function (card) {
					const clone = card.clone;
					if (clone) {
						clone.style.transition = "all 0.5s";
						clone.style.transform = "scale(1.2)";
						clone.delete();
					}
				}, event.card1);
				await player.gainPlayerCard(target, true, "he");
			} else {
				player.$gain2(event.card1);
				target.$gain2(event.card2);
			}

			game.broadcastAll(function () {
				ui.arena.classList.remove("thrownhighlight");
			});
			game.addVideo("thrownhighlight2");
		},
		ai: {
			order: 6,
			result: {
				target: -1,
			},
		},
	},
	cangzhuo: {
		trigger: { player: "phaseDiscardBegin" },
		frequent: true,
		audio: 2,
		filter(event, player) {
			return (
				player.getHistory("useCard", function (card) {
					return get.type(card.card, "trick") == "trick";
				}).length == 0
			);
		},
		async content(event, trigger, player) {
			player.addTempSkill("cangzhuo2");
		},
	},
	cangzhuo2: {
		mod: {
			ignoredHandcard(card, player) {
				if (get.type(card, "trick") == "trick") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.type(card, "trick") == "trick") {
					return false;
				}
			},
		},
	},
	shebian: {
		audio: 2,
		trigger: { player: "turnOverEnd" },
		check(event, player) {
			return player.canMoveCard(true, true);
		},
		filter(event, player) {
			return player.canMoveCard(null, true);
		},
		async content(event, trigger, player) {
			await player.moveCard().set("nojudge", true);
		},
	},
	rexianzhen: {
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
			// step 0
			const target = event.target;
			const result = await player.chooseToCompare(target).forResult();
			// step 1
			if (result.player && get.name(result.player, player) == "sha") {
				player.addTempSkill("rexianzhen4");
			}
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
	rexianzhen2: {
		charlotte: true,
		mod: {
			targetInRange(card, player, target) {
				if (target == player.storage.rexianzhen) {
					return true;
				}
			},
			cardUsableTarget(card, player, target) {
				if (target == player.storage.rexianzhen) {
					return true;
				}
			},
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (arg.target != player.storage.rexianzhen) {
					return false;
				}
			},
		},
	},
	rexianzhen3: {
		charlotte: true,
		mod: {
			cardEnabled(card) {
				if (card.name == "sha") {
					return false;
				}
			},
		},
	},
	rexianzhen4: {
		mod: {
			ignoredHandcard(card, player) {
				if (get.name(card) == "sha") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.name(card) == "sha") {
					return false;
				}
			},
		},
	},
	rejinjiu: {
		mod: {
			cardname(card, player) {
				if (card.name == "jiu") {
					return "sha";
				}
			},
		},
		ai: {
			skillTagFilter(player) {
				if (!player.countCards("h", "jiu")) {
					return false;
				}
			},
			respondSha: true,
		},
		audio: 2,
		trigger: { player: ["useCard1", "respond"] },
		firstDo: true,
		forced: true,
		filter(event, player) {
			return event.card.name == "sha" && !event.skill && event.cards.length == 1 && event.cards[0].name == "jiu";
		},
		async content(event, trigger, player) {},
		group: "rejinjiu2",
		global: "rejinjiu3",
	},
	rejinjiu3: {
		mod: {
			cardEnabled(card, player) {
				if (card.name == "jiu" && _status.currentPhase && _status.currentPhase != player && _status.currentPhase.hasSkill("rejinjiu")) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (card.name == "jiu" && _status.currentPhase && _status.currentPhase != player && _status.currentPhase.hasSkill("rejinjiu")) {
					return false;
				}
			},
		},
	},
	rejinjiu2: {
		audio: "rejinjiu",
		forced: true,
		trigger: { player: "damageBegin3" },
		sourceSkill: "rejinjiu",
		filter(event, player) {
			return event.getParent(2).jiu == true;
		},
		async content(event, trigger, player) {
			trigger.num -= trigger.getParent(2).jiu_add;
		},
		ai: {
			filterDamage: true,
			skillTagFilter(player, tag, arg) {
				return arg && arg.jiu == true;
			},
		},
	},
};
