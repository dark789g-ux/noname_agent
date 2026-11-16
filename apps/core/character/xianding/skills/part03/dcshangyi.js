import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshangyi" | "dcniaoxiang" | "dcsuishi" | "dcchuanxin" | "dcfengshi" | "dcsbzuojun" | "dcsbmuwang">} */
export const groupSkills = {
	//蒋钦
	dcshangyi: {
		audio: "shangyi",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") > 0 && game.hasPlayer(current => lib.skill.dcshangyi.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return target != player;
		},
		async content(event, trigger, player) {
			const target = event.target;
			await target.viewHandcards(player);
			if (!target.countCards("h")) {
				return;
			}
			await player.discardPlayerCard(target, "h", [1, 2], "visible", "是否弃置" + get.translation(target) + "不同花色的黑色牌至多各一张？").set("filterButton", button => {
				if (get.color(button.link) !== "black") {
					return false;
				}
				return ui.selected.buttons?.every(buttonx => {
					return get.suit(buttonx.link) !== get.suit(button.link);
				});
			});
		},
		ai: {
			order: 6,
			result: {
				player: 0.5,
				target(player, target) {
					if (!target.countCards("h")) {
						return 1;
					}
					return -2;
				},
			},
		},
	},
	dcniaoxiang: {
		audio: "zniaoxiang",
		trigger: { player: "useCardToPlayered" },
		forced: true,
		filter(event, player) {
			if (!event.target.inRange(player)) {
				return false;
			}
			if (event.card.name != "sha") {
				return false;
			}
			const directHit = event.getParent().directHit;
			return Array.isArray(directHit) && !directHit.includes(event.target);
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const id = trigger.target.playerid;
			const map = trigger.getParent().customArgs;
			if (!map[id]) {
				map[id] = {};
			}
			if (typeof map[id].shanRequired == "number") {
				map[id].shanRequired++;
			} else {
				map[id].shanRequired = 2;
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (!arg.target.inRange(player)) {
					return false;
				}
				if (arg.card.name != "sha" || arg.target.countCards("h", "shan") > 1) {
					return false;
				}
			},
		},
	},
	//田丰
	dcsuishi: {
		audio: "suishi",
		trigger: {
			global: ["dying", "dieAfter"],
		},
		forced: true,
		logAudio(event, player, name) {
			if (name == "dying") {
				return "suishi1.mp3";
			}
			return "suishi2.mp3";
		},
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			if (event.name == "dying") {
				return event.reason?.name == "damage" && event.reason.source?.group == player.group;
			}
			return event.player?.group == player.group && player.countCards("h");
		},
		async content(event, trigger, player) {
			if (trigger.name == "dying") {
				await player.draw();
			} else {
				await player.chooseToDiscard("h", [1, Infinity], true, "allowChooseAll").set("ai", card => {
					if (get.player().countCards("h") - ui.selected.cards.length > 1) {
						return 2 - get.value(card);
					}
					return 4 - get.value(card);
				});
			}
		},
		ai: {
			halfneg: true,
		},
	},
	//张任
	dcchuanxin: {
		audio: "chuanxin",
		trigger: { source: "damageBegin2" },
		filter(event, player) {
			if (!player.isPhaseUsing()) {
				return false;
			}
			if (!event.card || !["sha", "juedou"].includes(event.card.name)) {
				return false;
			}
			const evt = event.getParent(2);
			return evt.name === "useCard" && evt.card?.name === event.card.name;
		},
		logTarget: "player",
		check(event, player) {
			const target = event.player;
			const bool = target.countDiscardableCards(target, "e") > 0;
			const goon = target.countDiscardableCards(target, "h") >= 2;
			const def = get.damageEffect(target, player, player);
			if (!bool && !goon) {
				return def < 0;
			}
			return (
				Math.min(
					def,
					...(() => {
						let list = [];
						if (bool) {
							list.push(get.effect(target, { name: "guohe_copy", position: "e" }, target, player) * Math.sqrt(target.countDiscardableCards(target, "e")) + get.effect(target, { name: "losehp" }, target, player));
						}
						if (goon) {
							list.push(get.effect(target, { name: "guohe_copy", position: "h" }, target, player) * Math.sqrt(Math.min(2, target.countDiscardableCards(target, "h"))));
						}
						return list;
					})()
				) > 0
			);
		},
		async content(event, trigger, player) {
			trigger.cancel();
			let result;
			const target = event.targets[0];
			const bool = target.countDiscardableCards(target, "e") > 0;
			const goon = target.countDiscardableCards(target, "h") >= 2;
			if (!bool && !goon) {
				return;
			}
			if (bool && goon) {
				result = await target
					.chooseControl()
					.set("choiceList", ["弃置装备区内的所有牌并失去1点体力", "弃置两张手牌，然后非锁定技本回合失效"])
					.set("ai", () => {
						const player = get.player();
						const bool = get.effect(player, { name: "guohe_copy", position: "e" }, player, player) * Math.sqrt(player.countDiscardableCards(player, "e")) + get.effect(player, { name: "losehp" }, player, player);
						const goon = get.effect(player, { name: "guohe_copy", position: "h" }, player, player) * Math.sqrt(Math.min(2, player.countDiscardableCards(player, "h")));
						return bool > goon ? 0 : 1;
					})
					.forResult();
			} else {
				result = { index: bool ? 0 : 1 };
			}
			if (result.index == 1) {
				await target.chooseToDiscard("h", 2, true);
				target.addTempSkill("fengyin");
			} else {
				await target.discard(trigger.player.getDiscardableCards(target, "e"));
				await target.loseHp();
			}
		},
	},
	dcfengshi: {
		audio: "zfengshi",
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (event.card.name != "sha" || event.target.inRange(player)) {
				return false;
			}
			return event.target.getCards("e", card => ["equip2", "equip3"].includes(get.subtype(card))).length;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.choosePlayerCard("e", trigger.target, get.prompt2(event.skill, trigger.target))
				.set("filterButton", button => {
					return ["equip2", "equip3"].includes(get.subtype(button.link));
				})
				.set("ai", button => {
					if (get.attitude(get.player(), get.event().getTrigger().target) > 0) {
						return 0;
					}
					return get.value(button.link) + 1;
				})
				.forResult();
			event.result.targets = [trigger.target];
		},
		async content(event, trigger, player) {
			await event.targets[0].discard(event.cards);
		},
	},
	//谋沮授
	dcsbzuojun: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = (await target.draw(3).forResult()).cards;
			const { index } = await target
				.chooseControl()
				.set("choiceList", [`${get.translation(result)}不能被你使用且不计入你的手牌上限`, `失去1点体力，再摸一张牌并使用其中任意张牌，然后弃置其余牌`])
				.set("ai", () => {
					const player = get.player(),
						cards = get.event().cards;
					let eff = get.effect(player, { name: "losehp" }, player, player) + get.effect(player, { name: "draw" }, player, player);
					for (const card of cards) {
						eff += player.getUseValue(card);
					}
					return eff > 6 ? 1 : 0;
				})
				.set("cards", result)
				.forResult();
			if (index == 0) {
				target.addGaintag(result, "dcsbzuojun_tag");
				target.addSkill("dcsbzuojun_effect");
				target
					.when({ player: "phaseEnd" }, false)
					.filter(evt => evt != event.getParent("phase"))
					.assign({
						firstDo: true,
					})
					.step(async (event, trigger, player) => {
						player.removeGaintag("dcsbzuojun_tag", result);
						if (!player.hasCard(card => card.hasGaintag("dcsbzuojun_tag"))) {
							player.removeSkill("dcsbzuojun_effect");
						}
					})
					.finish();
			} else {
				await target.loseHp();
				const result2 = (await target.draw().forResult()).cards;
				let cards = result.slice().concat(result2);
				while (cards.some(i => get.owner(i) == target && target.hasUseTarget(i))) {
					const result = await target
						.chooseToUse(function (card, player, event) {
							if (get.itemtype(card) != "card" || !get.event().cards.includes(card)) {
								return false;
							}
							return lib.filter.filterCard.apply(this, arguments);
						}, "佐军：是否使用其中的一张牌？")
						.set("cards", cards)
						.set("addCount", false)
						.forResult();
					if (result.bool) {
						cards.removeArray(result.cards);
						await game.delayx();
					} else {
						break;
					}
				}
				cards = cards.filter(i => get.owner(i) == target);
				if (cards.length) {
					await target.modedDiscard(cards);
				}
			}
		},
		ai: {
			order: 10,
			result: {
				target: 1,
			},
		},
		subSkill: {
			tag: {},
			effect: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("dcsbzuojun_tag");
				},
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("dcsbzuojun_tag")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("dcsbzuojun_tag")) {
							return false;
						}
					},
					cardEnabled(card, player) {
						if (card.cards?.some(i => i.hasGaintag("dcsbzuojun_tag"))) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (card.cards?.some(i => i.hasGaintag("dcsbzuojun_tag"))) {
							return false;
						}
					},
				},
			},
		},
	},
	dcsbmuwang: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["cardsDiscardAfter", "loseAsyncAfter", "equipAfter"],
		},
		forced: true,
		filter(event, player) {
			if (player.getHistory("useSkill", evt => evt.skill == "dcsbmuwang").length) {
				return false;
			}
			const filter = card => ["basic", "trick"].includes(get.type(card));
			if (event.name != "cardsDiscard") {
				return event.getd(player, "cards2").filter(filter).length > 0;
			} else {
				if (event.cards.filterInD("d").filter(filter).length <= 0) {
					return false;
				}
				const evt = event.getParent();
				if (evt.name != "orderingDiscard") {
					return false;
				}
				const evtx = evt.relatedEvent || evt.getParent();
				if (evtx.player != player) {
					return false;
				}
				return player.hasHistory("lose", evtxx => {
					return evtx == (evtxx.relatedEvent || evtxx.getParent());
				});
			}
		},
		async content(event, trigger, player) {
			let cards;
			if (trigger.name != "cardsDiscard") {
				cards = trigger.getd(player, "cards2");
			} else {
				cards = trigger.cards.filterInD("d");
			}
			cards = cards.filter(card => ["basic", "trick"].includes(get.type(card)));
			if (cards.length) {
				const next = player.gain(cards.randomGet(), "gain2");
				next.gaintag.add("dcsbmuwang_tag");
				await next;
				player.addTempSkill("dcsbmuwang_lose");
			}
		},
		subSkill: {
			tag: {},
			lose: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("dcsbmuwang_tag");
				},
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (!player.countCards("he")) {
						return false;
					}
					const evt = event.getl(player);
					if (!evt || !evt.cards2 || !evt.cards2.length) {
						return false;
					}
					if (event.name == "lose") {
						return evt.cards2.some(card => (evt.gaintag_map[card.cardid] || []).includes("dcsbmuwang_tag"));
					}
					return player.hasHistory("lose", evt => {
						if (event != evt.getParent()) {
							return false;
						}
						return evt.cards2.some(card => (evt.gaintag_map[card.cardid] || []).includes("dcsbmuwang_tag"));
					});
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					if (player.countCards("he")) {
						await player.chooseToDiscard("he", true);
					}
				},
			},
		},
	},
};
