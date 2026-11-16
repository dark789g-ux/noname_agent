import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twlingfa_tao" | "twzhian" | "twyujue">} */
export const groupSkills = {
	twlingfa_tao: {
		audio: "twlingfa",
		trigger: { global: "useCardAfter" },
		charlotte: true,
		forced: true,
		filter(event, player) {
			return player != event.player && event.card.name == "tao" && event.player.countCards("he") > 0;
		},
		logTarget: "player",
		content() {
			"step 0";
			game.delayx();
			trigger.player
				.chooseCard("he", "令法：交给" + get.translation(player) + "一张牌，否则受到来自其的1点伤害")
				.set("goon", get.damageEffect(trigger.player, player, trigger.player) < 0)
				.set("ai", function (card) {
					if (!_status.event.goon) {
						return 0;
					}
					return 8 - get.value(card);
				});
			"step 1";
			if (!result.bool) {
				trigger.player.damage();
			} else {
				trigger.player.give(result.cards, player);
			}
		},
		mark: true,
		marktext: '<span style="text-decoration: line-through;">桃</span>',
		intro: { content: "其他角色使用【桃】结算结束后，若其有牌，则其需交给你一张牌，否则你对其造成1点伤害。" },
		sourceSkill: "twlingfa",
	},
	twzhian: {
		audio: 3,
		trigger: { global: "useCardAfter" },
		filter(event, player) {
			const target = event.player;
			if (player == target || !target.isIn()) {
				return false;
			}
			const type = get.type(event.card);
			if (type != "delay" && type != "equip") {
				return false;
			}
			if ((event.cards ?? []).length > 0) {
				const card = event.cards[0];
				const owner = get.owner(card);
				if (owner) {
					const position = get.position(card);
					if (position == "e" || position == "j") {
						return true;
					}
				}
			}
			return true;
		},
		async cost(event, trigger, player) {
			let [choiceList, choices] = [[], []];
			if ((trigger.cards ?? []).length > 0) {
				const card = trigger.cards[0];
				const str = get.translation(card);
				const owner = get.owner(card);
				let choice1 = `弃置${owner ? get.translation(owner) + "区域内的" : ""}${str}`;
				if (lib.filter.canBeDiscarded(card, player, owner)) {
					choices.push("弃置卡牌");
				} else {
					choice1 = `<span style="opacity:0.5">${choice1}</span>`;
				}
				choiceList.push(choice1);
				let choice2 = `弃置一张手牌，获得${str}`;
				if (player.hasCard(card => lib.filter.cardDiscardable(card, player, event.skill), "h") && lib.filter.canBeGained(card, player, owner)) {
					choices.push("获得卡牌");
				} else {
					choice2 = `<span style="opacity:0.5">${choice2}</span>`;
				}
				choiceList.push(choice2);
			}
			let choice3 = `对${get.translation(trigger.player)}造成1点伤害`;
			if (trigger.player.isIn()) {
				choices.push("造成伤害");
			} else {
				choice3 = `<span style="opacity:0.5">${choice3}</span>`;
			}
			choiceList.push(choice3);
			const result = await player
				.chooseControl(choices, "cancel2")
				.set("choiceList", choiceList)
				.set("prompt", get.prompt(event.skill))
				.set("ai", () => {
					const event = get.event(),
						{ player, skill } = event,
						trigger = event.getTrigger(),
						card = trigger.cards[0],
						owner = get.owner(card);
					const getEffect = choice => {
						if (choice == "cancel2") {
							return 0.1;
						}
						if (choice == "造成伤害") {
							return get.damageEffect(trigger.player, player, player);
						}
						let result;
						if (get.position(card) == "j") {
							result =
								-get.effect(
									player,
									{
										name: card.viewAs || card.name,
										cards: [card],
									},
									player,
									player
								) * get.sgn(get.attitude(player, owner));
						} else {
							result = -(get.value(card, owner) - 0.01) * get.sgn(get.attitude(player, owner));
						}
						if (choice == "弃置卡牌") {
							return result;
						}
						if (player.hasCard(cardx => lib.filter.cardDiscardable(cardx, player, "twzhian") && get.value(cardx, player) < get.value(card, player), "h")) {
							return result * 1.2;
						}
						return 0;
					};
					let choices = event.controls.slice();
					choices.sort((a, b) => getEffect(b) - getEffect(a));
					return choices[0];
				})
				.forResult();
			const control = result.control;
			event.result = {
				bool: control && control !== "cancel2",
				cost_data: control,
			};
		},
		usable: 1,
		popup: false,
		async content(event, trigger, player) {
			const card = (trigger.cards ?? [])[0];
			const str = get.translation(card);
			const owner = get.owner(card);
			switch (event.cost_data) {
				case "弃置卡牌":
					player.logSkill(event.name, owner);
					await owner.modedDiscard(card, player);
					break;
				case "获得卡牌": {
					const next = player.chooseToDiscard("h", true);
					next.logSkill = [event.name, owner];
					const result = await next.forResult();
					if (result?.bool && owner.getCards("ej").includes(card)) {
						await player.gain([card], owner, "give", "bySelf");
					}
					break;
				}
				case "造成伤害":
					player.logSkill(event.name, trigger.player);
					await trigger.player.damage();
					break;
			}
		},
		ai: { expose: 0.2 },
		global: "twzhian_ai",
		subSkill: {
			ai: {
				ai: {
					effect: {
						player_use(card, player, target) {
							if (get.type(card) !== "delay" && get.type(card) !== "equip") {
								return 1;
							}
							let za = game.findPlayer(cur => cur.hasSkill("twzhian") && !cur.storage.counttrigger?.twzhian && get.attitude(player, cur) <= 0);
							if (za) {
								return [0.5, -0.8];
							}
						},
					},
				},
			},
		},
	},
	twyujue: {
		audio: 2,
		global: "twyujue_give",
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		direct: true,
		filter(event, player) {
			if (player == _status.currentPhase) {
				return false;
			}
			var cards = event.getg(player);
			if (!cards.length) {
				return false;
			}
			return game.hasPlayer(function (current) {
				if (current == player) {
					return false;
				}
				var evt = event.getl(current);
				if (!evt || !evt.cards2 || !evt.cards2.filter(card => cards.includes(card)).length) {
					return false;
				}
				return !current.hasSkill("twyujue_effect0") || !current.hasSkill("twyujue_effect1");
			});
		},
		content() {
			"step 0";
			var cards = trigger.getg(player);
			var list = game
				.filterPlayer(function (current) {
					if (current == player) {
						return false;
					}
					var evt = trigger.getl(current);
					if (!evt || !evt.cards2 || !evt.cards2.filter(card => cards.includes(card)).length) {
						return false;
					}
					return !current.hasSkill("twyujue_effect0") || !current.hasSkill("twyujue_effect1");
				})
				.sortBySeat();
			event.targets = list;
			"step 1";
			var target = event.targets.shift();
			if (target.isIn()) {
				event.target = target;
				var num = 2;
				if (target.hasSkill("twyujue_effect0")) {
					num--;
				}
				if (target.hasSkill("twyujue_effect1")) {
					num--;
				}
				var cards = trigger.getg(player);
				num = Math.min(num, trigger.getl(target).cards2.filter(i => cards.includes(i)).length);
				if (num > 0) {
					event.count = num;
				} else if (targets.length > 0) {
					event.redo();
				} else {
					event.finish();
				}
			} else if (targets.length > 0) {
				event.redo();
			} else {
				event.finish();
			}
			"step 2";
			event.count--;
			player
				.chooseBool(
					get.prompt("twyujue", target),
					"可令其选择本回合内未选择过的一项：⒈弃置攻击范围内一名角色的一张牌。⒉下一次使用牌时，从牌堆中获得一张同类别的牌。"
				)
				.set("ai", function () {
					var evt = _status.event.getParent();
					return get.attitude(evt.player, evt.target) > 0;
				});
			"step 3";
			if (result.bool) {
				player.logSkill("twyujue", target);
				var list = [0, 1];
				if (target.hasSkill("twyujue_effect0")) {
					list.remove(0);
				}
				if (target.hasSkill("twyujue_effect1")) {
					list.remove(1);
				}
				if (!list.length) {
					event.goto(6);
				} else if (list.length == 1) {
					event._result = { index: list[0] };
				} else {
					target
						.chooseControl()
						.set("choiceList", ["弃置攻击范围内一名角色的一张牌", "下一次使用牌时，从牌堆中获得一张同类别的牌"])
						.set("ai", function () {
							var player = _status.event.player;
							if (
								game.hasPlayer(function (current) {
									return (
										player.inRange(current) &&
										current.countDiscardableCards(player, "he") > 0 &&
										get.effect(current, { name: "guohe_copy2" }, player, player) > 0
									);
								})
							) {
								return 0;
							}
							return 1;
						});
				}
			} else {
				event.goto(6);
			}
			"step 4";
			target.addTempSkill("twyujue_effect" + result.index);
			if (result.index == 0) {
				if (
					game.hasPlayer(function (current) {
						return target.inRange(current) && current.countDiscardableCards(target, "he") > 0;
					})
				) {
					target
						.chooseTarget("弃置攻击范围内一名角色的一张牌", true, function (card, player, target) {
							return player.inRange(target) && target.countDiscardableCards(player, "he") > 0;
						})
						.set("ai", function (target) {
							var player = _status.event.player;
							return get.effect(target, { name: "guohe_copy2" }, player, player);
						});
				} else {
					event.goto(6);
				}
			} else {
				event.goto(6);
			}
			"step 5";
			if (result.bool) {
				var target2 = result.targets[0];
				target.line(target2, "green");
				target.discardPlayerCard(target2, "he", true);
			}
			"step 6";
			game.delayx();
			if (event.count > 0) {
				event.goto(2);
			} else if (targets.length) {
				event.goto(1);
			}
		},
		subSkill: {
			clear: {
				onremove: true,
			},
			effect0: { charlotte: true },
			effect1: {
				charlotte: true,
				trigger: { player: "useCard" },
				usable: 1,
				forced: true,
				popup: false,
				content() {
					player.unmarkSkill("twyujue_effect1");
					var type2 = get.type2(trigger.card, false);
					var card = get.cardPile2(function (card) {
						return get.type2(card, false) == type2;
					});
					if (card) {
						trigger.player.gain(card, "gain2");
					}
				},
				mark: true,
				marktext: "爵",
				intro: { content: "使用下一张牌时，从牌堆中获得一张类型相同的牌" },
			},
		},
	},
};
