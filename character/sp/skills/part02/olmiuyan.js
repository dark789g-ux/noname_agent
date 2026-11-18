import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olmiuyan" | "olshilu" | "oldianjun" | "olkangrui" | "olcuipo">} */
export const groupSkills = {
	//王瓘
	olmiuyan: {
		audio: 2,
		enable: "chooseToUse",
		viewAsFilter(player) {
			return player.hasCard(card => get.color(card) == "black", "hes");
		},
		viewAs: { name: "huogong" },
		filterCard: { color: "black" },
		position: "hes",
		check(card) {
			var player = _status.event.player,
				suits = lib.suit.slice(0);
			if (
				player.countCards("h") > 4 &&
				player.hasCard(function (card) {
					suits.remove(get.suit(card));
					return suits.length == 0;
				}, "h")
			) {
				return 8 - get.value(card);
			}
			return 4 - get.value(card);
		},
		promptfunc() {
			if (_status.event.player.storage.olmiuyan) {
				return "转换技。你可以将一张黑色牌当做【火攻】使用。若此牌未造成伤害，则你令此技能失效直到本轮结束。";
			}
			return "转换技。你可以将一张黑色牌当做【火攻】使用。若此牌造成了伤害，则你获得此阶段内所有被展示过的牌。";
		},
		precontent() {
			player.changeZhuanhuanji("olmiuyan");
			var card = event.result.card;
			if (!card.storage) {
				card.storage = {};
			}
			if (player.storage.olmiuyan) {
				card.storage.olmiuyan_gain = true;
				player.addTempSkill("olmiuyan_gain");
			} else {
				card.storage.olmiuyan_remove = true;
				player.addTempSkill("olmiuyan_remove");
			}
		},
		init(player) {
			player.addSkill("olmiuyan_counter");
		},
		onremove(player) {
			player.removeSkill("olmiuyan_counter");
		},
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		ai: {
			order(item, player) {
				if (player.storage.olmiuyan) {
					return 1;
				}
				return 8;
			},
		},
		intro: {
			content(storage) {
				if (storage) {
					return "转换技。你可以将一张黑色牌当做【火攻】使用。然后若此牌未造成伤害，则你令此技能失效直到本轮结束。";
				}
				return "转换技。你可以将一张黑色牌当做【火攻】使用。然后若此牌造成了伤害，则你获得此阶段内所有被展示过的牌。";
			},
		},
		subSkill: {
			counter: {
				trigger: {
					global: ["showCardsEnd", "phaseZhunbeiBefore", "phaseJudgeBefore", "phaseDrawBefore", "phaseUseBefore", "phaseDiscardBefore", "phaseJieshuBefore"],
				},
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					if (event.name == "showCards") {
						return get.itemtype(event.cards) == "cards";
					}
					return true;
				},
				content() {
					if (trigger.name == "showCards") {
						game.broadcastAll(function (cards) {
							cards.forEach(card => card.addGaintag("olmiuyan_tag"));
						}, trigger.cards);
					} else {
						game.players.forEach(current => current.removeGaintag("olmiuyan_tag"));
					}
				},
			},
			gain: {
				audio: "olmiuyan",
				trigger: { player: "useCardAfter" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return (
						event.card.storage &&
						event.card.storage.olmiuyan_gain &&
						player.hasHistory("sourceDamage", function (evt) {
							return evt.card == event.card;
						}) &&
						game.hasPlayer(function (current) {
							return current != player && current.hasCard(card => card.hasGaintag("olmiuyan_tag"));
						})
					);
				},
				logTarget(event, player) {
					return game.filterPlayer(function (current) {
						return current != player && current.hasCard(card => card.hasGaintag("olmiuyan_tag"));
					});
				},
				content() {
					var cards = [],
						players = game.filterPlayer(current => current != player).sortBySeat();
					players.forEach(current => {
						var cardsx = current.getCards("h", function (card) {
							return card.hasGaintag("olmiuyan_tag");
						});
						if (cardsx.length) {
							cards.addArray(cardsx);
						}
					});
					player.gain(cards, "give");
				},
			},
			remove: {
				audio: "olmiuyan",
				trigger: { player: "useCardAfter" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return (
						event.card.storage &&
						event.card.storage.olmiuyan_remove &&
						!player.hasHistory("sourceDamage", function (evt) {
							return evt.card == event.card;
						})
					);
				},
				content() {
					player.tempBanSkill("olmiuyan", "roundStart");
				},
			},
		},
	},
	olshilu: {
		audio: 2,
		trigger: { player: "damageEnd" },
		forced: true,
		filter(event, player) {
			return player.hp > 0;
		},
		content() {
			"step 0";
			player.draw(Math.min(5, player.hp));
			"step 1";
			var targets = game.filterPlayer(current => current != player && current.countCards("h") > 0 && player.inRange(current));
			if (targets.length > 0) {
				if (targets.length == 1) {
					event._result = { bool: true, targets: targets };
				} else {
					player
						.chooseTarget(true, "请选择一名攻击范围内的角色", "然后你选择该角色的一张手牌，令此牌视为【杀】", function (card, player, target) {
							return target != player && target.countCards("h") > 0 && player.inRange(target);
						})
						.set("ai", function (target) {
							return -get.attitude(_status.event.player, target);
						});
				}
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.line(target, "green");
				player.choosePlayerCard(target, true, "h");
			}
			"step 3";
			if (result.bool) {
				target.addSkill("olshilu_viewas");
				target.showCards(result.cards);
				target.addGaintag(result.cards, "olshilu");
			}
		},
		ai: {
			maixie: true,
		},
		subSkill: {
			viewas: {
				mod: {
					cardname(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("olshilu")) {
							return "sha";
						}
					},
					cardnature(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("olshilu")) {
							return false;
						}
					},
				},
				charlotte: true,
			},
		},
	},
	//张翼
	oldianjun: {
		audio: 2,
		trigger: { player: "phaseEnd" },
		forced: true,
		async content(event, trigger, player) {
			await player.damage("nosource");
			trigger.phaseList.splice(trigger.num, 0, `phaseUse|${event.name}`);
		},
		ai: {
			combo: "olkangrui",
			halfneg: true,
		},
	},
	olkangrui: {
		audio: 2,
		init: () => {
			game.addGlobalSkill("olkangrui_ai");
		},
		onremove: () => {
			if (!game.hasPlayer(i => i.hasSkill("olkangrui", null, null, false), true)) {
				game.removeGlobalSkill("olkangrui_ai");
			}
		},
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.player == _status.currentPhase && event.player.getHistory("damage").indexOf(event) == 0;
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseControl("cancel2")
				.set("choiceList", ["令" + get.translation(trigger.player) + "回复1点体力，且造成伤害时本回合手牌上限为0", "令" + get.translation(trigger.player) + "于本回合下次造成的伤害+1，且造成伤害时本回合手牌上限为0"])
				.set("prompt", get.prompt("olkangrui", trigger.player))
				.set("ai", () => {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						if (get.attitude(player, trigger.player) <= 0) {
							return "cancel2";
						}
						if (!trigger.player.isDamaged()) {
							return "选项二";
						}
						var list = [];
						if (trigger.player.hp + trigger.player.countCards("hs", "tao") <= 2) {
							list.push("选项一");
						}
						if (
							trigger.player.hasCard(card => {
								if (!get.tag(card, "damage")) {
									return false;
								}
								if (
									game.hasPlayer(current => {
										return (
											get.effect(current, card, trigger.player, player) > 0 &&
											trigger.player.canUse(card, current) &&
											!current.hasSkillTag("filterDamage", null, {
												player: trigger.player,
												card: card,
											})
										);
									}, "hs")
								) {
									return true;
								}
							})
						) {
							list.push("选项二");
						}
						if (list.length) {
							return list.randomGet();
						}
						return "选项一";
					})()
				);
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("olkangrui", trigger.player);
				player.draw();
				if (result.index == 0) {
					trigger.player.recover();
					trigger.player.addTempSkill("olkangrui_nil");
				} else {
					trigger.player.addTempSkill("olkangrui_add");
					trigger.player.addMark("olkangrui_add", 1, false);
				}
			}
		},
		ai: {
			expose: 0.2,
			threaten: 1.5,
		},
		subSkill: {
			add: {
				trigger: { source: "damageBegin1" },
				charlotte: true,
				forced: true,
				onremove: ["olkangrui_add", "olkangrui_nil"],
				filter(event, player) {
					return player.hasMark("olkangrui_add");
				},
				content() {
					trigger.num += player.countMark("olkangrui_add");
					player.removeMark("olkangrui_add", player.countMark("olkangrui_add"), false);
					player.storage.olkangrui_nil = true;
					game.log(player, "本回合手牌上限基数为", "#g0");
				},
				mod: {
					maxHandcardBase(player, num) {
						if (player.storage.olkangrui_nil) {
							return 0;
						}
					},
				},
			},
			nil: {
				trigger: { source: "damageBegin1" },
				charlotte: true,
				forced: true,
				onremove: true,
				filter(event, player) {
					return !player.storage.olkangrui_nil;
				},
				content() {
					player.storage.olkangrui_nil = true;
					game.log(player, "本回合手牌上限基数为", "#g0");
				},
				mod: {
					maxHandcardBase(player, num) {
						if (player.storage.olkangrui_nil) {
							return 0;
						}
					},
				},
			},
			ai: {
				trigger: { player: "dieAfter" },
				filter: () => {
					return !game.hasPlayer(i => i.hasSkill("olkangrui", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				content: () => {
					game.removeGlobalSkill("olkangrui_ai");
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (target != player || !get.tag(card, "damage")) {
								return;
							}
							var list = game.filterPlayer(current => current.hasSkill("olkangrui") && get.attitude(current, player) > 0);
							var history = player.getHistory("damage");
							if (!list.length || history.length != 0) {
								return;
							}
							return [1, 2];
						},
					},
				},
			},
		},
	},
	//朱儁
	olcuipo: {
		audio: 2,
		trigger: { player: "useCard" },
		forced: true,
		filter(event, player) {
			return get.cardNameLength(event.card) == player.getHistory("useCard").indexOf(event) + 1;
		},
		content() {
			var card = trigger.card;
			if (card.name == "sha" || (get.type(card) == "trick" && get.tag(card, "damage") > 0)) {
				trigger.baseDamage++;
			} else {
				player.draw();
			}
		},
		/*
		trigger:{source:'damageBegin1'},
		forced:true,
		filter:function(event,player){
			var card=event.card;
			if(player!=_status.currentPhase||!card||event.getParent().type!='card') return false;
			return get.cardNameLength(card)==player.getHistory('useCard').indexOf(event.getParent(2))+1;
		},
		content:function(){
			trigger.num++;
		},*/
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object" && get.cardNameLength(card) == player.getHistory("useCard").length + 1) {
					return num + 10;
				}
			},
		},
	},
};
