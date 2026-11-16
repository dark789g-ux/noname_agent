import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhiba" | "zhijian" | "guzheng" | "beige" | "duanchang">} */
export const groupSkills = {
	zhiba: {
		global: "zhiba_global",
		audioname: ["re_sunben"],
		audioname2: {
			pe_jun_sunce: "olzhiba",
		},
		audio: 2,
		zhuSkill: true,
		subSkill: {
			global: {
				enable: "phaseUse",
				prompt() {
					const player = get.player();
					const list = game.filterPlayer(target => target.hasZhuSkill("zhiba", player) && player.canCompare(target));
					let str = "和" + get.translation(list);
					if (list.length > 1) {
						str += "中的一人";
					}
					str += "进行拼点。若你没赢，其可以获得两张拼点牌。";
					return str;
				},
				filter(event, player) {
					if (player.group != "wu") {
						return false;
					}
					return game.hasPlayer(target => target.hasZhuSkill("zhiba", player) && player.canCompare(target));
				},
				filterTarget(card, player, target) {
					return target.hasZhuSkill("zhiba", player) && player.canCompare(target);
				},
				log: false,
				prepare(cards, player, targets) {
					targets[0].logSkill("zhiba");
				},
				usable: 1,
				async content(event, trigger, player) {
					const { target } = event;
					if (["hunzi", "rehunzi"].some(skill => target.storage[skill])) {
						const { bool } = await target
							.chooseBool("是否拒绝〖制霸〗拼点？")
							.set("choice", get.attitude(target, player) <= 0)
							.forResult();
						if (bool) {
							game.log(target, "拒绝了拼点");
							target.chat("拒绝");
							return;
						}
					}
					if (!player.canCompare(target)) {
						return;
					}
					const result = await player
						.chooseToCompare(target, card => {
							if (card.name == "du") {
								return 20;
							}
							const player = get.owner(card);
							const target = get.event().getParent().target;
							if (player != target && get.attitude(player, target) > 0) {
								return -get.number(card);
							}
							return get.number(card);
						})
						.set("preserve", "lose")
						.forResult();
					if (result.bool == false) {
						const list = [result.player, result.target].filterInD("d");
						if (!list.length) {
							return;
						}
						const next = target.chooseBool("是否获得" + get.translation(list) + "？").set("ai", () => get.value(list) > 0);
						if ((await next.forResult()).bool) {
							await target.gain(list, "gain2");
						}
					}
				},
				ai: {
					basic: {
						order: 1,
					},
					expose: 0.2,
					result: {
						target(player, target) {
							if (player.countCards("h", "du") && get.attitude(player, target) < 0) {
								return -1;
							}
							if (player.countCards("h") <= player.hp) {
								return 0;
							}
							let maxnum = 0;
							const cards2 = target.getCards("h");
							for (let i = 0; i < cards2.length; i++) {
								if (get.number(cards2[i]) > maxnum) {
									maxnum = get.number(cards2[i]);
								}
							}
							if (maxnum > 10) {
								maxnum = 10;
							}
							if (maxnum < 5 && cards2.length > 1) {
								maxnum = 5;
							}
							const cards = player.getCards("h");
							for (let i = 0; i < cards.length; i++) {
								if (get.number(cards[i]) < maxnum) {
									return 1;
								}
							}
							return 0;
						},
					},
				},
			},
		},
	},
	zhijian: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("h", { type: "equip" }) > 0;
		},
		filterCard(card) {
			return get.type(card) == "equip";
		},
		check(card) {
			const player = _status.currentPhase;
			if (player.countCards("he", { subtype: get.subtype(card) }) > 1) {
				return 11 - get.equipValue(card);
			}
			return 6 - get.value(card);
		},
		filterTarget(card, player, target) {
			if (target.isMin()) {
				return false;
			}
			return player != target && target.canEquip(card);
		},
		async content(event, trigger, player) {
			await event.target.equip(event.cards[0]);
			await player.draw();
		},
		discard: false,
		lose: false,
		prepare(cards, player, targets) {
			player.$give(cards, targets[0], false);
		},
		ai: {
			basic: {
				order: 10,
			},
			result: {
				target(player, target) {
					const card = ui.selected.cards[0];
					if (card) {
						return get.effect(target, card, target, target);
					}
					return 0;
				},
			},
			threaten: 1.3,
		},
	},
	guzheng: {
		audio: 2,
		audioname: ["re_zhangzhang"],
		trigger: { global: "phaseDiscardAfter" },
		filter(event, player) {
			if (event.player != player && event.player.isIn()) {
				return (
					event.player.getHistory("lose", function (evt) {
						return evt.type == "discard" && evt.getParent("phaseDiscard") == event && evt.hs.someInD("d");
					}).length > 0
				);
			}
			return false;
		},
		checkx(event, player, cards, cards2) {
			if (cards.length > 2 || get.attitude(player, event.player) > 0) {
				return true;
			}
			for (let i = 0; i < cards2.length; i++) {
				if (get.value(cards2[i], event.player, "raw") < 0) {
					return true;
				}
			}
			return false;
		},
		preHidden: true,
		async cost(event, trigger, player) {
			const cards = [],
				cards2 = [];
			const target = trigger.player;
			game.getGlobalHistory("cardMove", function (evt) {
				if (evt.name == "cardsDiscard") {
					if (evt.getParent("phaseDiscard") == trigger) {
						const moves = evt.cards.filterInD("d");
						cards.addArray(moves);
						cards2.removeArray(moves);
					}
				}
				if (evt.name == "lose") {
					if (evt.type != "discard" || evt.position != ui.discardPile || evt.getParent("phaseDiscard") != trigger) {
						return;
					}
					const moves = evt.cards.filterInD("d");
					cards.addArray(moves);
					if (evt.player == target) {
						cards2.addArray(moves);
					} else {
						cards2.removeArray(moves);
					}
				}
			});
			if (!cards2.length) {
				return;
			}
			if (cards.length == 1) {
				event.card = cards[0];
				event.result = await player
					.chooseBool()
					.set("createDialog", [get.prompt(event.skill, target), '<span class="text center">点击“确认”以令其收回此牌</span>', cards])
					.set("choice", lib.skill.guzheng.checkx(trigger, player, cards, cards2))
					.set("ai", function () {
						return _status.event.choice;
					})
					.setHiddenSkill(event.skill)
					.forResult();
				event.result.cost_data = {
					action: "single",
					cards: cards,
				};
			} else {
				event.result = await player
					.chooseButton(2, [get.prompt(event.skill, target), '<span class="text center">被选择的牌将成为对方收回的牌</span>', cards, [["获得剩余的牌", "放弃剩余的牌"], "tdnodes"]])
					.set("filterButton", function (button) {
						const type = typeof button.link;
						if (ui.selected.buttons.length && type == typeof ui.selected.buttons[0].link) {
							return false;
						}
						return type == "string" || _status.event.allowed.includes(button.link);
					})
					.set("allowed", cards2)
					.set("check", lib.skill.guzheng.checkx(trigger, player, cards, cards2))
					.set("ai", function (button) {
						if (typeof button.link == "string") {
							return button.link == "获得剩余的牌" ? 1 : 0;
						}
						if (_status.event.check) {
							return 20 - get.value(button.link, _status.event.getTrigger().player);
						}
						return 0;
					})
					.setHiddenSkill(event.skill)
					.forResult();
				event.result.cost_data = {
					action: "multiple",
					cards: event.result.links,
				};
			}
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player;
			const action = event.cost_data.action;
			const cards = event.cost_data.cards;
			if (action != "multiple") {
				const gain = target.gain(cards[0], "gain2");
				gain.giver = player;
				await gain;
			} else {
				if (typeof cards[0] != "string") {
					cards.reverse();
				}
				const [, card] = cards;
				const gain = target.gain(card, "gain2");
				gain.giver = player;
				await gain;
				if (cards[0] != "获得剩余的牌") {
					return;
				}
			}
			//避免插入结算改变弃牌堆 重新判断一次
			cards.length = 0;
			game.getGlobalHistory("cardMove", function (evt) {
				if (evt.name == "cardsDiscard") {
					if (evt.getParent("phaseDiscard") == trigger) {
						const moves = evt.cards.filterInD("d");
						cards.addArray(moves);
					}
				}
				if (evt.name == "lose") {
					if (evt.type != "discard" || evt.position != ui.discardPile || evt.getParent("phaseDiscard") != trigger) {
						return;
					}
					const moves = evt.cards.filterInD("d");
					cards.addArray(moves);
				}
			});
			if (cards.length > 0) {
				await player.gain(cards, "gain2");
			}
		},
		ai: {
			threaten: 1.3,
			expose: 0.2,
		},
	},
	beige: {
		audio: 2,
		audioname: ["re_caiwenji", "ol_caiwenji"],
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.card && event.card.name == "sha" && event.source && event.player.isIn() && player.countCards("he");
		},
		checkx(event, player) {
			const att1 = get.attitude(player, event.player);
			const att2 = get.attitude(player, event.source);
			return att1 > 0 && att2 <= 0;
		},
		preHidden: true,
		async cost(event, trigger, player) {
			const next = player.chooseToDiscard("he", get.prompt2(event.skill, trigger.player));
			const check = lib.skill.beige.checkx(trigger, player);
			next.set("ai", function (card) {
				if (_status.event.goon) {
					return 8 - get.value(card);
				}
				return 0;
			});
			next.set("goon", check);
			next.setHiddenSkill(event.skill);
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const result = await trigger.player.judge().forResult();
			switch (result.suit) {
				case "heart":
					await trigger.player.recover();
					break;
				case "diamond":
					await trigger.player.draw(2);
					break;
				case "club":
					await trigger.source.chooseToDiscard("he", 2, true);
					break;
				case "spade":
					await trigger.source.turnOver();
					break;
			}
		},
		ai: {
			expose: 0.3,
		},
	},
	duanchang: {
		audio: 2,
		audioname: ["re_caiwenji", "ol_caiwenji"],
		forbid: ["boss"],
		trigger: { player: "die" },
		forced: true,
		forceDie: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event) {
			return event.source && event.source.isIn();
		},
		async content(event, trigger, player) {
			trigger.source.clearSkills();
		},
		logTarget: "source",
		ai: {
			maixie_defend: true,
			threaten(player, target) {
				if (target.hp == 1) {
					return 0.2;
				}
				return 1.5;
			},
			effect: {
				target(card, player, target, current) {
					if (!target.hasFriend()) {
						return;
					}
					if (target.hp <= 1 && get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return 3;
						}
						return [1, 0, 0, -3 * get.threaten(player)];
					}
				},
			},
		},
	},
};
