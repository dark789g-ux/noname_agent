import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "chixueqingfeng" | "chixueqingfeng2" | "guilongzhanyuedao" | "wushuangfangtianji_skill" | "qiaoli" | "qingliang">} */
export const groupSkills = {
	chixueqingfeng: {
		equipSkill: true,
		trigger: { player: "useCardToPlayered" },
		filter(event) {
			return event.card.name == "sha";
		},
		logTarget: "target",
		forced: true,
		content() {
			var target = trigger.target;
			target.addTempSkill("chixueqingfeng2");
			target.markAuto("chixueqingfeng2", [trigger.card]);
		},
		ai: {
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (arg && arg.card && arg.card.name == "sha") {
					return true;
				}
				return false;
			},
		},
	},
	chixueqingfeng2: {
		equipSkill: true,
		trigger: { global: "useCardAfter" },
		forced: true,
		charlotte: true,
		popup: false,
		firstDo: true,
		onremove: true,
		filter(event, player) {
			return player.storage.chixueqingfeng2 && player.storage.chixueqingfeng2.includes(event.card);
		},
		content() {
			player.storage.chixueqingfeng2.remove(trigger.card);
			if (!player.storage.chixueqingfeng2.length) {
				player.removeSkill("chixueqingfeng2");
			}
		},
		mark: true,
		marktext: "※",
		intro: {
			content: "防具技能无效，且不能使用或打出手牌",
		},
		mod: {
			cardEnabled2(card) {
				if (get.position(card) == "h") {
					return false;
				}
			},
		},
		ai: {
			unequip2: true,
		},
	},
	guilongzhanyuedao: {
		equipSkill: true,
		trigger: { player: "useCard" },
		forced: true,
		filter(event, player) {
			return event.card && event.card.name == "sha" && get.color(event.card) == "red";
		},
		content() {
			trigger.directHit.addArray(game.players);
		},
		ai: {
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (arg && arg.card && arg.card.name == "sha" && get.color(arg.card) == "red") {
					return true;
				}
				return false;
			},
		},
	},
	wushuangfangtianji_skill: {
		equipSkill: true,
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			return event.card && event.card.name == "sha" && event.getParent().type == "card";
		},
		direct: true,
		content() {
			"step 0";
			var target = trigger.player;
			var choices = ["摸一张牌"];
			if (
				target.hasCard(function (card) {
					return lib.filter.canBeDiscarded(card, player, target);
				}, "he")
			) {
				choices.push("弃置" + get.translation(target) + "的一张牌");
			}
			player
				.chooseControl("cancel2")
				.set("choiceList", choices)
				.set("prompt", get.prompt("wushuangfangtianji_skill"))
				.set("ai", function () {
					var player = _status.event.player,
						target = _status.event.getTrigger().player;
					if (
						target.hasCard(function (card) {
							return lib.filter.canBeDiscarded(card, player, target);
						}, "he") &&
						get.effect(target, { name: "guohe_copy2" }, player, player) > get.effect(player, { name: "draw" }, player, player)
					) {
						return 1;
					}
					return 0;
				});
			"step 1";
			if (result.control == "cancel2") {
				return;
			}
			if (result.index == 0) {
				player.logSkill("wushuangfangtianji_skill");
				player.draw();
			} else {
				var target = trigger.player;
				player.logSkill("wushuangfangtianji_skill", target);
				player.discardPlayerCard(target, "he", true);
			}
		},
	},
	//芮姬
	qiaoli: {
		onChooseToUse(event) {
			if (event.type == "phase" && !game.online && !(event.qiaoli_equip1 && event.qiaoli_noequip1)) {
				let player = event.player;
				const list = player.getStorage("qiaoli_used");
				if (list.includes("equip1")) {
					event.set("qiaoli_equip1", true);
				}
				if (list.length && list.some(i => i != "equip1")) {
					event.set("qiaoli_noequip1", true);
				}
			}
		},
		audio: 2,
		enable: "phaseUse",
		viewAs: {
			name: "juedou",
			qiaoli: true,
		},
		filterCard(card, player) {
			if (get.type(card) != "equip") {
				return false;
			}
			const event = _status.event;
			if (get.subtype(card) == "equip1" && event.qiaoli_equip1) {
				return false;
			}
			if (get.subtype(card) != "equip1" && event.qiaoli_noequip1) {
				return false;
			}
			return true;
		},
		viewAsFilter(player) {
			return (
				player.isPhaseUsing() &&
				player.hasCard(function (card) {
					return lib.skill.qiaoli.filterCard(card, player);
				}, "hes")
			);
		},
		check(card) {
			if (get.position(card) == "e") {
				return 7.5 - get.value(card);
			}
			return 12 - _status.event.player.getUseValue(card);
		},
		position: "hes",
		async precontent(event, trigger, player) {
			player.addTempSkill("qiaoli_used");
			const subtype = get.subtype(event.result.cards[0]) || "equip";
			player.markAuto("qiaoli_used", [subtype]);
			player.addTempSkill("qiaoli_norespond");
			player.addTempSkill("qiaoli_effect");
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return arg && arg.card && arg.card.name == "juedou" && _status.event.skill == "qiaoli";
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			norespond: {
				charlotte: true,
				trigger: { player: "useCard1" },
				filter(event, player) {
					return event.card.qiaoli && get.subtype(event.cards[0]) != "equip1";
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.addTempSkill("qiaoli_gain");
					trigger.directHit.addArray(game.players);
					game.log(trigger.card, "不可被响应");
				},
			},
			effect: {
				charlotte: true,
				trigger: { source: "damageSource" },
				filter(event, player) {
					return event.card && event.cards && event.card.qiaoli && get.subtype(event.cards[0]) == "equip1";
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const card = trigger.cards[0];
					let num = 1;
					const info = get.info(card, false);
					if (info && info.distance && typeof info.distance.attackFrom == "number") {
						num -= info.distance.attackFrom;
					}
					const result = await player.draw({ num }).forResult();
					let { cards } = result;
					if (get.itemtype(cards) != "cards") {
						return;
					}
					const hs = player.getCards("h");
					cards = cards.filter(function (card) {
						return hs.includes(card);
					});
					if (!cards.length) {
						return;
					}
					if (_status.connectMode) {
						game.broadcastAll(function () {
							_status.noclearcountdown = true;
						});
					}
					const given_map = {};
					while (cards.some(card => !card.hasGaintag("qiaoli_given"))) {
						const result = await player
							.chooseCardTarget({
								filterCard(card) {
									return get.event().cards.includes(card) && !card.hasGaintag("qiaoli_given");
								},
								cards,
								filterTarget: lib.filter.notMe,
								selectCard: [1, cards.length],
								prompt: "巧力：是否将获得的牌分配给其他角色？",
								ai1(card) {
									return -1;
								},
								ai2(target) {
									return -1;
								},
								allowChooseAll: true,
							})
							.forResult();
						if (result.bool && result.cards?.length && result.targets?.length) {
							const {
								cards,
								targets: [target],
							} = result;
							player.addGaintag(cards, "qiaoli_given");
							const id = target.playerid;
							given_map[id] ??= [];
							given_map[id].addArray(cards);
						} else {
							break;
						}
					}
					if (_status.connectMode) {
						game.broadcastAll(function () {
							delete _status.noclearcountdown;
						});
						game.stopCountChoose();
					}
					const list = [];
					const loseCards = [];
					for (const i in given_map) {
						const source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
						const gain = given_map[source.playerid];
						player.line(source, "green");
						list.push([source, gain]);
						loseCards.push(...gain);
					}
					await game
						.loseAsync({
							gain_list: list,
							player,
							cards: loseCards,
							giver: player,
							animate: "giveAuto",
						})
						.setContent("gaincardMultiple");
				},
			},
			gain: {
				charlotte: true,
				audio: "qiaoli",
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.card.qiaoli && get.subtype(event.cards[0]) != "equip1";
				},
				forced: true,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					const card = get.cardPile(
						function (card) {
							return get.type(card) == "equip";
						},
						void 0,
						"random"
					);
					if (card) {
						await player.gain({ cards: [card], animate: "gain2" });
					}
				},
			},
		},
	},
	qingliang: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			var bool1 = event.card.name == "sha";
			var bool2 = get.type2(event.card) == "trick";
			if (!bool1 && !bool2) {
				return false;
			}
			return player != event.player && player.countCards("h") > 0;
		},
		usable: 1,
		logTarget: "player",
		check(event, player) {
			if (get.attitude(player, event.player) > 0 || event.player.hasSkillTag("nogain")) {
				return true;
			}
			const eff = get.effect(player, event.card, event.player, player);
			if (eff >= 0) {
				return false;
			}
			const suits = [],
				banned = [],
				hs = player.getCards("h");
			for (const i of hs) {
				const suit = get.suit(i, player);
				suits.add(suit);
				if (!lib.filter.cardDiscardable(i, player, "qingliang")) {
					banned.add(suit);
				}
			}
			suits.removeArray(banned);
			for (const i of suits) {
				const cards = player.getCards("h", function (card) {
					return get.suit(card, player) == i;
				});
				if (-eff / 2 - get.value(cards, player) > 0) {
					return true;
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			await player.showHandcards(get.translation(player) + "发动了【清靓】");
			const suits = [],
				banned = [],
				hs = player.getCards("h");
			for (const i of hs) {
				const suit = get.suit(i, player);
				suits.add(suit);
				if (!lib.filter.cardDiscardable(i, player, "qingliang")) {
					banned.add(suit);
				}
			}
			let result;
			if (suits.length > banned.length) {
				result = await player
					.chooseControl({
						choiceList: ["和" + get.translation(trigger.player) + "各摸一张牌", "弃置一种花色的所有手牌，令" + get.translation(trigger.card) + "对自己无效"],
						ai() {
							const player = _status.event.player,
								event = _status.event.getTrigger();
							if (get.attitude(player, event.player) > 0 || event.player.hasSkillTag("nogain")) {
								return 0;
							}
							return 1;
						},
					})
					.forResult();
				suits.removeArray(banned);
				suits.sort();
			} else {
				result = { index: 0 };
			}
			if (result.index == 0) {
				await game.asyncDraw([player, trigger.player]);
			} else {
				if (suits.length == 1) {
					result = { control: suits[0] };
				} else {
					result = await player
						.chooseControl({
							controls: suits,
							prompt: "清靓：选择弃置一种花色的所有牌",
							ai() {
								const player = _status.event.player,
									list = _status.event.controls.slice(0);
								const gett = function (suit) {
									const cards = player.getCards("h", function (card) {
										return get.suit(card, player) == suit;
									});
									return get.value(cards);
								};
								return list.sort(function (b, a) {
									return gett(b) - gett(a);
								})[0];
							},
						})
						.forResult();
				}
				const cards = player.getCards("h", function (card) {
					return get.suit(card) == result.control;
				});
				if (cards.length) {
					await player.modedDiscard(cards);
				}
				trigger.targets.remove(player);
				trigger.getParent().triggeredTargets2.remove(player);
				trigger.untrigger();
			}
		},
	},
};
