import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rejianyanSkills = {
	rejianyan: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filter(event, player) {
			return game.hasPlayer(current => current.group == "key" || current.hasSex("male"));
		},
		chooseButton: {
			dialog() {
				return ui.create.dialog("###荐言###" + get.translation("rejianyan_info"));
			},
			chooseControl(event, player) {
				const list = [],
					storage = player.getStorage("rejianyan_used");
				if (!storage.includes("color")) {
					list.addArray(["red", "black"]);
				}
				if (!storage.includes("type")) {
					list.addArray(["basic", "trick", "equip"]);
				}
				list.push("cancel2");
				return list;
			},
			check() {
				if (!_status.event.player.getStorage("rejianyan_used").includes("color")) {
					return "red";
				}
				return "trick";
			},
			backup(result, player) {
				return {
					audio: "rejianyan",
					filterCard: () => false,
					selectCard: -1,
					info: result.control,
					async content(event, trigger, player) {
						let result;

						// step 0
						let card = false;
						let info = lib.skill.rejianyan_backup.info;
						let info2 = info in lib.color ? "color" : "type";
						player.addTempSkill("rejianyan_used", "phaseUseEnd");
						let func = card => get[info2 == "type" ? "type2" : "color"](card) == info;
						player.markAuto("rejianyan_used", info2);
						card = get.cardPile2(func, "top");
						event.card = card;
						if (!card) {
							if (get.discardPile(func, "top")) {
								await game.washCard();
								card = get.cardPile2(func, "top");
							}
							if (!card) {
								return;
							}
						}
						player.showCards(card, get.translation(player) + "发动了【荐言】");

						// step 1
						result = await player
							.chooseTarget(true, "选择一名角色获得" + get.translation(card), function (card, player, target) {
								return target.group == "key" || target.hasSex("male");
							})
							.set("ai", function (target) {
								var player = _status.event.player,
									att = get.attitude(player, target);
								if (target.hasSkill("nogain")) {
									att /= 10;
								}
								return att / Math.sqrt(get.distance(player, target, "absolute"));
							})
							.forResult();

						// step 2
						if (result.bool) {
							var target = result.targets[0];
							player.line(target, "green");
							target.gain(card, "gain2");
						}
					},
					ai: { result: { player: 1 } },
				};
			},
		},
		ai: {
			order: 8,
			result: {
				player(player, target) {
					if (game.hasPlayer(current => (current.group == "key" || current.hasSex("male")) && get.attitude(player, current) > 0)) {
						return 1;
					}
					return 0;
				},
			},
		},
		subSkill: { used: { charlotte: true, onremove: true }, backup: {} },
	},
	//野兽高顺
	decadexianzhen: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		filter(event, player) {
			return player.countCards("h") > 0 && !player.hasSkill("decadexianzhen2") && !player.hasSkill("decadexianzhen3");
		},
		async content(event, trigger, player) {
			const target = event.target;
			let result;

			// step 0
			result = await player.chooseToCompare(target).forResult();

			// step 1
			if (result.bool) {
				player.storage.decadexianzhen2 = target;
				player.addTempSkill("decadexianzhen2");
			} else {
				player.addTempSkill("decadexianzhen3");
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
	decadexianzhen2: {
		audio: "decadexianzhen",
		charlotte: true,
		onremove: true,
		sourceSkill: "decadexianzhen",
		mod: {
			targetInRange(card, player, target) {
				if (target == player.storage.decadexianzhen2) {
					return true;
				}
			},
			cardUsableTarget(card, player, target) {
				if (target == player.storage.decadexianzhen2) {
					return true;
				}
			},
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (arg.target != player.storage.decadexianzhen2) {
					return false;
				}
			},
		},
		group: "decadexianzhen2_damage",
		subSkill: {
			damage: {
				audio: "decadexianzhen",
				trigger: { source: "damageBegin1" },
				forced: true,
				filter(event, player) {
					return (
						event.card &&
						event.player == player.storage.decadexianzhen2 &&
						!player.hasHistory("custom", function (evt) {
							return evt.name == "decadexianzhen" && evt.cardname == event.card.name;
						})
					);
				},
				logTarget: "player",
				async content(event, trigger, player) {
					trigger.num++;
					player.getHistory("custom").push({
						name: "decadexianzhen",
						cardname: trigger.card.name,
					});
				},
			},
		},
	},
	decadexianzhen3: {
		charlotte: true,
		mod: {
			cardEnabled(card) {
				if (card.name == "sha") {
					return false;
				}
			},
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
	decadejinjiu: {
		global: "decadejinjiu_global",
		mod: {
			cardname(card) {
				if (card.name == "jiu") {
					return "sha";
				}
			},
			cardnumber(card) {
				if (card.name == "jiu") {
					return 13;
				}
			},
		},
		audio: 2,
		audioname2: {
			ol_gaoshun: "rejinjiu",
		},
		trigger: { player: ["useCard1", "respond"] },
		filter(event, player) {
			return event.card.name == "sha" && !event.skill && event.cards && event.cards.length == 1 && event.cards[0].name == "jiu";
		},
		forced: true,
		firstDo: true,
		async content(_) {},
		subSkill: {
			global: {
				mod: {
					cardEnabled(card, player) {
						if (card.name == "jiu") {
							var source = _status.currentPhase;
							if (source && source != player && source.hasSkill("decadejinjiu")) {
								return false;
							}
						}
					},
					cardSavable(card, player) {
						if (card.name == "jiu") {
							var source = _status.currentPhase;
							if (source && source != player && source.hasSkill("decadejinjiu")) {
								return false;
							}
						}
					},
				},
			},
		},
	},
	rebotu: {
		audio: "botu",
		trigger: { player: "phaseEnd" },
		frequent: true,
		filter(event, player) {
			if (player.countMark("rebotu_used") >= Math.min(3, game.countPlayer())) {
				return false;
			}
			var suits = [];
			game.getGlobalHistory("cardMove", function (evt) {
				if (suits.length >= 4) {
					return;
				}
				if (evt.name == "lose") {
					if (evt.position == ui.discardPile) {
						for (var i of evt.cards) {
							suits.add(get.suit(i, false));
						}
					}
				} else {
					if (evt.name == "cardsDiscard") {
						for (var i of evt.cards) {
							suits.add(get.suit(i, false));
						}
					}
				}
			});
			return suits.length >= 4;
		},
		async content(event, trigger, player) {
			player.addTempSkill("rebotu_used", "roundStart");
			player.addMark("rebotu_used", 1, false);
			player.insertPhase();
		},
		group: "rebotu_mark",
		subSkill: {
			used: {
				onremove: true,
				charlotte: true,
			},
			mark: {
				trigger: {
					global: ["loseAfter", "cardsDiscardAfter"],
					player: "phaseAfter",
				},
				forced: true,
				firstDo: true,
				silent: true,
				filter(event, player) {
					if (event.name == "phase") {
						return true;
					}
					if (player != _status.currentPhase) {
						return false;
					}
					if (event.name == "lose") {
						return event.position == ui.discardPile;
					}
					return true;
				},
				async content(event, trigger, player) {
					if (trigger.name == "phase") {
						player.unmarkSkill("rebotu_mark");
						return;
					}
					const suits = [];
					game.getGlobalHistory("cardMove", evt => {
						if (suits.length >= 4) {
							return false;
						}
						if (evt.name == "lose") {
							if (evt.position == ui.discardPile) {
								for (const c of evt.cards) {
									suits.add(get.suit(c, false));
								}
							}
						} else if (evt.name == "cardsDiscard") {
							for (const c of evt.cards) {
								suits.add(get.suit(c, false));
							}
						}
						return false;
					});
					player.storage.rebotu_mark = suits;
					player.markSkill("rebotu_mark");
				},
				intro: {
					onunmark: true,
					content: "本回合已有$花色的牌进入过弃牌堆",
				},
			},
		},
	},
	xinganlu: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		selectTarget: 2,
		delay: 0,
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
			return true;
		},
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const targets = event.targets;

			// step 0
			await targets[0].swapEquip(targets[1]).forResult();

			// step 1
			await game.delayex().forResult();
			var num = Math.abs(targets[0].countCards("e") - targets[1].countCards("e"));
			if (num > player.getDamagedHp()) {
				await player.chooseToDiscard("h", 2, true).forResult();
			}
		},
		ai: {
			order: 10,
			expose: 0.2,
			threaten(player, target) {
				return 0.8 * Math.max(1 + target.maxHp - target.hp);
			},
			result: {
				target(player, target) {
					if (!ui.selected.targets.length) {
						return -get.value(target.getCards("e"), target);
					}
					var target2 = ui.selected.targets[0];
					var eff_target = get.value(target2.getCards("e"), target) - get.value(target.getCards("e"), target);
					if (get.sgn(eff_target) == get.sgn(-get.value(target2.getCards("e"), target2))) {
						return 0;
					}
					return eff_target;
				},
			},
		},
	},
	xinbuyi: {
		audio: 2,
		trigger: { global: "dying" },
		filter(event, player) {
			return event.player.countCards("h") > 0;
		},
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		async content(event, trigger, player) {
			let result;
			if (player == trigger.player) {
				result = await player
					.chooseCard("h", true)
					.set("ai", function (card) {
						if (get.type(card) != "basic") {
							return 100 - get.value(card);
						}
						return 0;
					})
					.forResult();
			} else {
				result = await player.choosePlayerCard("h", trigger.player, true).forResult();
			}
			var card = result.cards[0],
				target = trigger.player;
			player.showCards(card, get.translation(player) + "对" + (player == target ? "自己" : get.translation(target)) + "发动了【补益】");
			if (get.type(card, null, target) != "basic") {
				target.discard(card);
				target.recover();
				if (target.countCards("h") == 1) {
					target.draw();
				}
			}
		},
		logTarget: "player",
	},
};
