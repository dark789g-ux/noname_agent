import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zaoli" | "yiyong" | "shanxie" | "liubing">} */
export const groupSkills = {
	//孙翊
	zaoli: {
		trigger: { player: "phaseBegin" },
		audio: 2,
		forced: true,
		filter(event, player) {
			return player.countMark("zaoli") > 0;
		},
		content() {
			"step 0";
			event.num = player.storage.zaoli;
			player.removeMark("zaoli", event.num);
			if (player.countCards("he") > 0) {
				player.chooseToDiscard(true, "he", [1, Infinity], "躁厉：弃置至少一张牌", "allowChooseAll").set("ai", function (card) {
					if (card.hasGaintag("zaoli")) {
						return 1;
					}
					return 5 - get.value(card);
				});
			}
			"step 1";
			if (result.bool) {
				num += result.cards.length;
			}
			player.draw(num);
			"step 2";
			if (event.num > 2) {
				player.loseHp();
			}
		},
		mod: {
			cardEnabled2(card, player) {
				if (player == _status.currentPhase && get.itemtype(card) == "card" && card.hasGaintag("zaoli")) {
					return false;
				}
			},
		},
		group: ["zaoli_add", "zaoli_count"],
		init(player) {
			if (player == _status.currentPhase) {
				var hs = player.getCards("h");
				player.getHistory("gain", function (evt) {
					hs.removeArray(evt.cards);
				});
				if (hs.length) {
					player.addGaintag(hs, "zaoli");
				}
			}
		},
		onremove(player) {
			player.removeGaintag("zaoli");
			delete player.storage.zaoli;
		},
		intro: { content: "mark" },
		subSkill: {
			add: {
				audio: "zaoli",
				trigger: { player: ["useCard", "respond"] },
				forced: true,
				filter(event, player) {
					return (
						player.countMark("zaoli") < 4 &&
						player.hasHistory("lose", function (evt) {
							const evtx = evt.relatedEvent || evt.getParent();
							return evt.hs && evt.hs.length > 0 && evtx == event;
						})
					);
				},
				content() {
					player.addMark("zaoli", 1);
				},
			},
			count: {
				trigger: { global: "phaseBeginStart" },
				forced: true,
				firstDo: true,
				silent: true,
				filter(event, player) {
					if (player == event.player) {
						return player.countCards("h") > 0;
					}
					return player.hasCard(function (card) {
						return card.hasGaintag("zaoli");
					}, "h");
				},
				content() {
					if (player == trigger.player) {
						player.addGaintag(player.getCards("h"), "zaoli");
					} else {
						player.removeGaintag("zaoli");
					}
				},
			},
		},
	},
	//王双
	yiyong: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.card && event.card.name == "sha" && event.source && event.source.isIn() && player != event.source && event.cards.filterInD().length > 0 && player.getEquips(1).length > 0;
		},
		check(event, player) {
			var card = {
					name: "sha",
					cards: event.cards.filterInD(),
				},
				target = event.source;
			return !player.canUse(card, target, false) || get.effect(target, card, player, player) > 0;
		},
		content() {
			"step 0";
			event.cards = trigger.cards.filterInD();
			player.gain(event.cards, "gain2");
			"step 1";
			var target = trigger.source,
				hs = player.getCards("h");
			if (
				target &&
				target.isIn() &&
				hs.length >= cards.length &&
				cards.filter(function (i) {
					return hs.includes(i);
				}).length == cards.length &&
				player.canUse({ name: "sha", cards: cards }, target, false)
			) {
				var next = player.useCard({ name: "sha" }, cards, target, false);
				if (!target.getEquips(1).length) {
					next.baseDamage = 2;
				}
			}
		},
	},
	shanxie: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		//filterTarget:function(card,player,target){
		//	return target!=player&&target.getEquip(1);
		//},
		//selectTarget:[0,1],
		content() {
			var card = get.cardPile2(function (card) {
				return get.subtype(card) == "equip1";
			});
			if (card) {
				player.gain(card, "gain2");
			} else {
				var targets = game.filterPlayer(function (current) {
					return current.getEquips(1).length > 0;
				});
				if (targets.length) {
					var target = targets.randomGet();
					player.gain(target.getEquips(1), target, "give", "bySelf");
				}
			}
		},
		content_old() {
			"step 0";
			if (!target) {
				var card = get.cardPile2(function (card) {
					return get.subtype(card) == "equip1";
				});
				if (card) {
					player.gain(card, "gain2");
				}
				event.finish();
			} else {
				var card = target.getEquip(1);
				if (card) {
					event.card = card;
					player.gain(card, target, "give");
				} else {
					event.finish();
				}
			}
			"step 1";
			if (player.getCards("h").includes(card) && get.type(card, null, player) == "equip" && player.hasUseTarget(card)) {
				player.chooseUseTarget(card, true, "nopopup");
			}
			"step 2";
			var hs = target.getCards("h", function (card) {
				return target.canUse(get.autoViewAs({ name: "sha" }, [card]), player, false);
			});
			if (hs.length) {
				if (hs.length == 1) {
					event._result = { bool: true, cards: hs };
				} else {
					target
						.chooseCard("h", true, "将一张牌当做【杀】对" + get.translation(player) + "使用", function (card) {
							return _status.event.cards.includes(card);
						})
						.set("cards", hs)
						.set("ai", function (card) {
							return get.effect(_status.event.getParent().player, get.autoViewAs({ name: "sha" }, [card]), _status.event.player);
						});
				}
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				target.useCard({ name: "sha" }, result.cards, player, false);
			}
		},
		ai: {
			order: 9,
			result: { player: 1 },
		},
		group: ["shanxie_exclude", "shanxie_shan"],
		subSkill: {
			exclude: {
				trigger: { global: "useCard" },
				forced: true,
				locked: false,
				filter(event, player) {
					if (event.card.name != "shan" || event.getParent(2).player != player) {
						return false;
					}
					var num = get.number(event.card);
					return !num || num <= player.getAttackRange() * 2;
				},
				logTarget: "player",
				content() {
					trigger.all_excluded = true;
				},
				sub: true,
			},
			shan: {
				trigger: { player: "useCardToPlayered" },
				filter(event, player) {
					return event.target.isAlive() && event.card.name == "sha";
				},
				silent: true,
				content() {
					trigger.target.addTempSkill("shanxie_banned");
					trigger.target.storage.shanxie_banned = {
						card: trigger.card,
						num: player.getAttackRange() * 2,
					};
				},
				sub: true,
			},
			banned: {
				init(player) {
					player.storage.shanxie_banned = {};
				},
				onremove(player) {
					delete player.storage.shanxie_banned;
				},
				trigger: { global: "useCardEnd" },
				filter(event, player) {
					return event.card == player.storage.shanxie_banned.card;
				},
				silent: true,
				content() {
					player.removeSkill("shanxie_banned");
				},
				ai: {
					effect: {
						player(card, player, target) {
							if (get.name(card) == "shan") {
								let num = get.number(card);
								if (!num || num <= player.storage.shanxie_banned.num) {
									return "zeroplayertarget";
								}
							}
						},
					},
				},
			},
		},
	},
	//吴景流兵
	liubing: {
		audio: 2,
		trigger: { player: "useCard1" },
		forced: true,
		filter(event, player) {
			if (event.card.name != "sha" || !event.cards || !event.cards.length) {
				return false;
			}
			var evt = event.getParent("phaseUse");
			return (
				evt &&
				evt.player == player &&
				player
					.getHistory("useCard", function (evt2) {
						return evt2.card.name == "sha" && evt2.cards && evt2.cards.length && evt2.getParent("phaseUse") == evt;
					})
					.indexOf(event) == 0
			);
		},
		content() {
			game.log(player, "将", trigger.card, "的花色改为", "#y♦");
			trigger.card.suit = "diamond";
			trigger.card.color = "red";
		},
		group: "liubing_gain",
		subSkill: {
			gain: {
				trigger: { global: "useCardAfter" },
				forced: true,
				audio: "liubing",
				filter(event, player) {
					return (
						event.player != player &&
						event.card.isCard &&
						event.card.name == "sha" &&
						get.color(event.card) == "black" &&
						event.cards.filterInD().length > 0 &&
						event.player.isPhaseUsing() &&
						!event.player.hasHistory("sourceDamage", function (evt) {
							return evt.card == event.card;
						})
					);
				},
				logTarget: "player",
				content() {
					player.gain(trigger.cards.filterInD(), "gain2");
				},
			},
		},
	},
};
