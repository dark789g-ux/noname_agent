import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dclima" | "dcxiaoyin" | "dchuahuo">} */
export const groupSkills = {
	//马伶俐
	dclima: {
		mod: {
			globalFrom(from, to, distance) {
				return (
					distance -
					Math.max(
						1,
						game.countPlayer(current => {
							return current.countCards("e", card => {
								return get.is.attackingMount(card) || get.is.defendingMount(card);
							});
						})
					)
				);
			},
		},
	},
	dcxiaoyin: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(current => get.distance(player, current) <= 1);
		},
		group: "dcxiaoyin_damage",
		prompt2(event, player) {
			return `亮出牌堆顶的${get.cnNumber(game.countPlayer(current => get.distance(player, current) <= 1))}张牌，获得其中的红色牌，将其中任意张黑色牌置于等量名座次连续的其他角色的武将牌上。`;
		},
		frequent: true,
		check: () => true,
		async content(event, trigger, player) {
			var count = game.countPlayer(current => get.distance(player, current) <= 1);
			var cards = game.cardsGotoOrdering(get.cards(count)).cards;
			await player.showCards(cards, `${get.translation(player)}【硝引】亮出`);
			player.gain(
				cards.filter(i => get.color(i, false) == "red"),
				"gain2"
			);
			var blackOnes = cards.filter(i => get.color(i, false) == "black");
			if (!blackOnes.length) {
				return event.finish();
			}
			var targets = game.filterPlayer(current => current != player);
			if (targets.length == 1) {
				var result = { bool: true, targets: targets };
			} else {
				var result = await player
					.chooseTarget([1, blackOnes.length], true, (card, player, target) => {
						if (player == target) {
							return false;
						}
						var selected = ui.selected.targets;
						if (!selected.length) {
							return true;
						}
						for (var i of selected) {
							if (i.getNext() == target || i.getPrevious() == target) {
								return true;
							}
						}
						return false;
					})
					.set("complexSelect", true)
					.set("complexTarget", true)
					.set("multitarget", true)
					.set("multiline", true)
					.set("ai", target => {
						if (get.event().aiTargets.includes(target)) {
							return 10;
						}
						return 0.1;
					})
					.set(
						"aiTargets",
						(() => {
							const targets = game.filterPlayer(i => i != player).sortBySeat(player),
								values = targets.map(cur => {
									const eff = get.damageEffect(cur, cur, player, "fire");
									if (eff > 0) {
										return Math.min(eff, -get.attitude(player, cur));
									}
									return eff;
								});
							let maxEff = -Infinity,
								aiTargets = [];
							for (let i = 0; i < targets.length; i++) {
								for (let j = 1; j < blackOnes.length; j++) {
									if (targets.length < j) {
										break;
									}
									let targetsx = targets.slice(i, i + j),
										tmpEff = values.slice(i, i + j).reduce((p, c) => {
											return p + c;
										}, 0);
									if (tmpEff > maxEff) {
										maxEff = tmpEff;
										aiTargets = targetsx;
									}
								}
							}
							return aiTargets;
						})()
					)
					.set("createDialog", [`###硝引：剩余的黑色牌###<div class="text center">请选择至多${get.cnNumber(blackOnes.length)}名座次连续的其他角色，然后将以下这些牌置于这些角色的武将牌上。</div>`, blackOnes])
					.forResult();
			}
			if (!result.bool) {
				event.finish();
				return;
			}
			var targets = result.targets.slice().sortBySeat(player);
			var num = targets.length;
			if (blackOnes.length == 1) {
				var result = { bool: true, links: blackOnes };
			} else {
				var result = await player
					.chooseCardButton(`###硝引：剩余的黑色牌###<div class="text center">将${get.cnNumber(num)}张黑色牌按照选择的角色的座次顺序置于这些角色武将牌上</div>`, blackOnes, true, num)
					.set("ai", () => 1)
					.forResult();
			}
			if (result.bool) {
				var cards = result.links;
				player.line(targets);
				targets.forEach((current, ind) => {
					current.addToExpansion(cards[ind], "gain2").gaintag.add("dcxiaoyin");
					game.log(current, "将", cards[ind], "当“硝引”置于了武将牌上");
				});
			}
		},
		marktext: "硝",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		subSkill: {
			damage: {
				audio: "dcxiaoyin",
				trigger: { global: "damageBegin3" },
				filter(event, player) {
					if (!event.source || !event.source.isIn()) {
						return false;
					}
					return event.player.getExpansions("dcxiaoyin").length;
				},
				//direct:true,
				async cost(event, trigger, player) {
					const source = trigger.source,
						target = trigger.player;
					const cards = target.getExpansions("dcxiaoyin");
					if (trigger.hasNature("fire")) {
						const types = cards.map(i => get.type2(i, false));
						const str = get.translation(types).replace(/(.*)、/, "$1或");
						event.result = await source
							.chooseCard(`硝引：是否弃置一张${str}牌？`, `若如此做，将${get.translation(target)}的对应的“硝引”牌置入弃牌堆，令你对其造成的伤害+1`, "he", function (card, player) {
								if (!get.event().types.includes(get.type2(card))) {
									return false;
								}
								return lib.filter.cardDiscardable.apply(this, arguments);
							})
							.set("types", types)
							.set("ai", card => {
								if (get.event().goon) {
									return 7 - get.value(card);
								}
								return 0;
							})
							.set("goon", get.damageEffect(target, player, player, "fire") > 0 && get.attitude(player, target) <= 0)
							.forResult();
					} else {
						event.result = await source
							.chooseBool(`###是否响应${get.translation(player)}的【硝引】？###获得${get.translation(target)}的一张“硝引”牌（${get.translation(cards)}），然后将你对其造成的此次伤害改为火焰伤害。`)
							.set(
								"choice",
								(() => {
									if (get.damageEffect(target, source, source, "fire") < get.damageEffect(target, source, source) - 5) {
										return false;
									}
									if (cards.map(i => get.value(i)).reduce((p, c) => p + c, 0) > 0) {
										return true;
									}
									return false;
								})()
							)
							.forResult();
					}
				},
				async content(event, trigger, player) {
					const source = trigger.source,
						target = trigger.player;
					if (trigger.hasNature("fire")) {
						source.line(target, "fire");
						const type = get.type2(event.cards[0]);
						await source.modedDiscard(event.cards);
						//await game.delayx();
						const cardsToDiscard = target.getExpansions("dcxiaoyin").filter(card => get.type2(card, false) === type);
						if (cardsToDiscard.length === 1) {
							await target.loseToDiscardpile(cardsToDiscard);
						} else if (cardsToDiscard.length > 1) {
							const result = await source.chooseButton([`请选择移去${get.translation(target)}的一张“硝引”牌`, cardsToDiscard], true).forResult();
							await target.loseToDiscardpile(result.links);
						}
						trigger.num++;
					} else {
						source.line(target, "fire");
						const cards = target.getExpansions("dcxiaoyin");
						if (cards.length === 1) {
							await source.gain(cards, target, "give");
						} else if (cards.length > 1) {
							const result = await source.chooseButton([`请选择获得${get.translation(target)}的一张“硝引”牌`, cards], true).forResult();
							await source.gain(result.links, target, "give");
						}
						game.setNature(trigger, "fire");
					}
				},
			},
		},
		ai: {
			threaten: 4,
		},
	},
	dchuahuo: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		viewAs: {
			name: "sha",
			nature: "fire",
			storage: { dchuahuo: true },
		},
		filterCard: { color: "red" },
		position: "hs",
		filter(event, player) {
			return player.countCards("hs", { color: "red" });
		},
		check(card) {
			return 6 - get.value(card);
		},
		precontent() {
			event.getParent().addCount = false;
			player
				.when("useCardToPlayer")
				.filter(evt => evt.card.storage?.dchuahuo)
				.step(async (event, trigger, player) => {
					if (!trigger.target.getExpansions("dcxiaoyin").length) {
						return;
					}
					const targets = game.filterPlayer(current => {
						return current.getExpansions("dcxiaoyin").length && lib.filter.targetEnabled2(trigger.card, player, current);
					});
					if (!targets.length) {
						return;
					}
					const result = await player
						.chooseBool(`是否更改${get.translation(trigger.card)}的目标？`, `将此牌的目标改为所有有“硝引”的角色（${get.translation(targets)}）。`)
						.set("choice", targets.map(current => get.effect(current, trigger.card, player, player)).reduce((p, c) => p + c, 0) > get.effect(trigger.target, trigger.card, player, player))
						.forResult();
					if (result.bool) {
						trigger.targets.length = 0;
						trigger.getParent().triggeredTargets1.length = 0;
						trigger.untrigger();
						player.line(targets, "fire");
						trigger.targets.addArray(targets);
						game.log(targets, "成为了", trigger.card, "的新目标");
						await game.delayx();
					}
				});
		},
		ai: {
			order: () => get.order({ name: "sha" }) + 0.2,
			result: { player: 1 },
		},
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.dchuahuo) {
					return Infinity;
				}
			},
		},
	},
};
