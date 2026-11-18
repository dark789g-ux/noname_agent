import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olchanshuang" | "olzhanjin">} */
export const groupSkills = {
	//李异
	olchanshuang: {
		audio: 2,
		enable: "phaseUse",
		filterTarget: lib.filter.notMe,
		usable: 1,
		async content(event, trigger, player) {
			const { target } = event;
			const choiceList = ["重铸一张牌", "使用一张【杀】", "弃置两张牌"],
				list = ["重铸", "出杀", "弃牌", "无法选择"];
			let result = [];
			for (let current of [player, target]) {
				let list1 = list.slice(),
					choiceList1 = choiceList.slice();
				list1 = list1.filter(control => {
					if (control == "无法选择") {
						return false;
					}
					if (control == "重铸") {
						return current.countCards("he", card => current.canRecast(card));
					}
					if (control == "出杀") {
						return current.countCards("he", card => card.name == "sha" && current.hasUseTarget(card));
					}
					if (control == "弃牌") {
						return current.countCards("he", card => lib.filter.cardDiscardable(card, current)) > 1;
					}
				});
				choiceList1 = choiceList.filter(control => {
					if (choiceList.indexOf(control) == 0) {
						return current.countCards("he", card => current.canRecast(card));
					}
					if (choiceList.indexOf(control) == 1) {
						return current.countCards("he", card => card.name == "sha" && current.hasUseTarget(card));
					}
					if (choiceList.indexOf(control) == 2) {
						return current.countCards("he", card => lib.filter.cardDiscardable(card, current)) > 1;
					}
				});
				if (list1.length) {
					if (list1.length == 1) {
						result.push(list.indexOf(list1[0]));
					} else {
						let result1 = await current
							.chooseControl(list1)
							.set("ai", () => {
								const current = _status.event.player;
								const controls = _status.event.controls.slice();
								if (controls.includes("出杀") && current.countCards("hs", card => card.name == "sha" && current.hasValueTarget(card))) {
									return "出杀";
								}
								if (controls.includes("重铸")) {
									return "重铸";
								}
								return "弃牌";
							})
							.set("choiceList", choiceList1)
							.forResult();
						if (result1?.control) {
							result.push(list.indexOf(result1.control));
						}
					}
				} else {
					result.push(3);
				}
			}
			player.popup(list[result[0]]);
			target.popup(list[result[1]]);
			for (let current of [player, target]) {
				if (!current.isIn()) {
					continue;
				}
				switch (list[result[current == player ? 0 : 1]]) {
					case "重铸": {
						if (current.countCards("he", card => current.canRecast(card))) {
							let result2 = await current.chooseCard("he", "请重铸一张牌", (card, player) => player.canRecast(card), true).forResult();
							if (result2?.bool && result2?.cards?.length) {
								await current.recast(result2.cards);
							}
						}
						break;
					}
					case "出杀": {
						if (current.hasUsableCard("sha")) {
							await current.chooseToUse({
								prompt: "请使用一张【杀】",
								filterCard(card, player) {
									if (card.name != "sha") {
										return false;
									}
									return lib.filter.filterCard.apply(this, arguments);
								},
								forced: true,
								ai1(card) {
									return _status.event.player.getUseValue(card);
								},
								addCount: false,
							});
						}
						break;
					}
					case "弃牌": {
						if (current.countCards("he", card => lib.filter.cardDiscardable(card, current))) {
							await current.chooseToDiscard("he", 2, true);
						}
						break;
					}
				}
			}
		},
		ai: {
			order(item, player) {
				return get.order({ name: "sha" }, player) - 0.1;
			},
			result: {
				target(player, target) {
					const att = get.attitude(player, target);
					if (
						target.countCards("hs", card => {
							return (
								card.name == "sha" &&
								game.hasPlayer(current => {
									return target.canUse(card, current) && get.effect(current, card, target, target) > 0 && get.effect(current, card, target, player) > 0;
								})
							);
						})
					) {
						return 3;
					}
					if (att > 0) {
						return 2;
					}
					if (!target.countCards("h")) {
						return get.sgn(att) + (att == 0 ? 1 : 0);
					}
					return 0;
				},
			},
		},
		group: "olchanshuang_end",
		subSkill: {
			end: {
				audio: "olchanshuang",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return (
						player.hasHistory("lose", evt => {
							if (evt.type == "discard") {
								var evtx = evt.getl(player);
								return evtx && evtx.cards2.length == 2;
							}
							return evt.getParent(2).name == "recast";
						}) || player.hasHistory("useCard", evt => evt.card.name == "sha")
					);
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					let num = 0;
					if (player.hasHistory("lose", evt => evt.getParent(2).name == "recast")) {
						num++;
					}
					if (player.hasHistory("useCard", evt => evt.card.name == "sha")) {
						num++;
					}
					if (
						player.hasHistory("lose", evt => {
							if (evt.type == "discard") {
								var evtx = evt.getl(player);
								return evtx && evtx.cards2.length == 2;
							}
						})
					) {
						num++;
					}
					if (num && player.countCards("he", card => player.canRecast(card))) {
						let result = await player.chooseCard("he", "请重铸一张牌", (card, player) => player.canRecast(card), true).forResult();
						if (result?.bool && result?.cards?.length) {
							await player.recast(result.cards);
						}
					}
					if (num > 1 && player.countCards("he", card => card.name == "sha" && player.hasUseTarget(card))) {
						await player.chooseToUse({
							prompt: "请使用一张【杀】",
							filterCard(card, player) {
								if (card.name != "sha") {
									return false;
								}
								return lib.filter.filterCard.apply(this, arguments);
							},
							forced: true,
							ai1(card) {
								return _status.event.player.getUseValue(card);
							},
						});
					}
					if (num > 2 && player.countCards("he", card => lib.filter.cardDiscardable(card, player))) {
						await player.chooseToDiscard("he", 2, true);
					}
				},
			},
		},
	},
	olzhanjin: {
		audio: 2,
		locked: true,
		init(player, skill) {
			player.addExtraEquip(skill, "guanshi", true, player => player.hasEmptySlot(1) && lib.card.guanshi);
		},
		onremove(player, skill) {
			player.removeExtraEquip(skill);
		},
		group: "olzhanjin_guanshi",
		subSkill: {
			guanshi: {
				audio: "olzhanjin",
				nobracket: true,
				equipSkill: true,
				trigger: { player: ["shaMiss", "eventNeutralized"] },
				filter(event, player) {
					if (!player.hasEmptySlot(1) || !lib.card.guanshi || player.hasSkillTag("unequip_equip1")) {
						return false;
					}
					if (event.type != "card" || event.card.name != "sha" || !event.target.isIn()) {
						return false;
					}
					return player.countCards("he") >= 2;
				},
				direct: true,
				locked: false,
				content() {
					"step 0";
					player
						.chooseToDiscard(get.prompt("olzhanjin_guanshi"), "弃置两张牌，令" + get.translation(trigger.card) + "强制命中", 2, "he")
						.set("ai", function (card) {
							var evt = _status.event.getTrigger();
							if (get.attitude(evt.player, evt.target) < 0) {
								if (player.needsToDiscard()) {
									return 15 - get.value(card);
								}
								if (evt.baseDamage + evt.extraDamage >= Math.min(2, evt.target.hp)) {
									return 8 - get.value(card);
								}
								return 5 - get.value(card);
							}
							return -1;
						})
						.set("complexCard", true).logSkill = "olzhanjin_guanshi";
					"step 1";
					if (result.bool) {
						if (event.triggername == "shaMiss") {
							trigger.untrigger();
							trigger.trigger("shaHit");
							trigger._result.bool = false;
							trigger._result.result = null;
						} else {
							trigger.unneutralize();
						}
					}
				},
				mod: {
					attackRangeBase(player) {
						var num = lib.card?.guanshi?.distance?.attackFrom;
						if (typeof num != "number" || !player.hasEmptySlot(1)) {
							return;
						}
						return Math.max(player.getEquipRange(player.getCards("e")), 1 - num);
					},
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (player._olzhanjin_guanshi_temp || !player.hasEmptySlot(1) || !lib.card.guanshi || player.hasSkillTag("unequip_equip1")) {
							return;
						}
						player._olzhanjin_guanshi_temp = true;
						var bool =
							get.attitude(player, arg.target) < 0 &&
							arg.card &&
							arg.card.name == "sha" &&
							player.countCards("he", card => {
								return card != arg.card && (!arg.card.cards || !arg.card.cards.includes(card)) && get.value(card) < 5;
							}) > 1;
						delete player._olzhanjin_guanshi_temp;
						return bool;
					},
					effect: {
						target(card, player, target) {
							if (player.hasSkillTag("unequip_equip1")) {
								return;
							}
							if (player == target && get.subtype(card) == "equip1") {
								if (get.equipValue(card) <= get.equipValue({ name: "guanshi" })) {
									return 0;
								}
							}
						},
					},
				},
			},
		},
	},
};
