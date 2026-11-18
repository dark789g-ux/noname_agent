import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbbaojia" | "dcsbdouwei">} */
export const groupSkills = {
	//谋董承
	dcsbbaojia: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && game.hasPlayer(target => target != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget("###保驾###选择一名其他角色，为其保驾护航", true, lib.filter.notMe)
				.set("ai", target => {
					return get.attitude(get.player(), target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.setStorage("dcsbbaojia_effect", target);
			player.markSkillCharacter("dcsbbaojia_effect", target, "保驾", `你为${get.translation(target)}保驾护航`);
		},
		group: ["dcsbbaojia_effect"],
		subSkill: {
			effect: {
				audio: "dcsbbaojia",
				onremove: true,
				trigger: {
					global: "damageBegin4",
				},
				filter(event, player) {
					const target = player.storage.dcsbbaojia_effect;
					if (![player, target].includes(event.player)) {
						return false;
					}
					return (
						event.card &&
						player.hasEnabledSlot() &&
						game
							.getGlobalHistory(
								"everything",
								evt => {
									return evt.name == "damage" && evt.player == event.player && evt.card;
								},
								event
							)
							.indexOf(event) === 0
					);
				},
				async cost(event, trigger, player) {
					const list = [1, 2, 3, 4, 5].filter(num => player.hasEnabledSlot(num)).map(num => "equip" + num),
						target = trigger.player;
					const result = await player
						.chooseControl(list, "cancel2")
						.set("prompt", `###${get.prompt(event.skill, target)}###废除一个装备栏并防止其受到的伤害，且${get.translation(trigger.card)}结算完毕后你获得之。`)
						.set("ai", () => {
							if (get.attitude(get.player(), get.event().target) < 0) {
								return "cancel2";
							}
							for (var i = 5; i > 0; i--) {
								if (get.player().hasEmptySlot(i)) {
									return "equip" + i;
								}
							}
							return "cancel2";
						})
						.set("target", target)
						.forResult();
					if (result.control != "cancel2") {
						event.result = {
							bool: true,
							cost_data: result.control,
						};
					}
				},
				async content(event, trigger, player) {
					const slot = event.cost_data;
					player.line(trigger.player);
					await player.disableEquip(slot);
					trigger.cancel();
					player
						.when({ global: "useCardAfter" })
						.filter(evt => evt === trigger.getParent("useCard"))
						.step(async (event, trigger, player) => {
							const cards = (trigger.cards || []).filterInD("od");
							if (cards.length) {
								await player.gain(cards, "gain2");
							}
						});
				},
			},
		},
	},
	dcsbdouwei: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCards("h", card => get.info("dcsbdouwei").filterCard(card, player));
		},
		filterCard(card, player) {
			if (!lib.filter.cardDiscardable(card, player, "dcsbdouwei") || !get.is.damageCard(card)) {
				return false;
			}
			const cardx = get.autoViewAs({
				name: get.name(card, player),
				nature: get.nature(card, player),
				suit: get.suit(card, player),
				number: get.number(card, player),
				isCard: true,
			});
			return game.hasPlayer(target => player !== target && player.inRangeOf(target) && player.canUse(cardx, target, false, false));
		},
		check(card) {
			const player = get.player();
			const cardx = get.autoViewAs({
				name: get.name(card, player),
				nature: get.nature(card, player),
				suit: get.suit(card, player),
				number: get.number(card, player),
				isCard: true,
			});
			const eff = game.filterPlayer(current => player !== current && player.inRangeOf(current) && player.canUse(cardx, current, false, false)).reduce((num, current) => num + get.effect(current, cardx, player, player));
			return eff;
		},
		async content(event, trigger, player) {
			player.addTempSkill("dcsbdouwei_effect");
			const card = event.cards[0],
				cardx = get.autoViewAs({
					name: get.name(card, player),
					nature: get.nature(card, player),
					suit: get.suit(card, player),
					number: get.number(card, player),
					isCard: true,
					storage: { dcsbdouwei: true },
				});
			await player.chooseUseTarget(cardx, [1, Infinity], true, false).set("filterTarget", (card, player, target) => {
				if (player === target || !player.inRangeOf(target)) {
					return false;
				}
				return lib.filter.targetEnabledx(card, player, target);
			});
		},
		ai: {
			order(item, player) {
				const cards = player
					.getCards("h", card => get.info("dcsbdouwei").filterCard(card, player))
					.map(card => {
						const cardx = get.autoViewAs({
							name: get.name(card, player),
							nature: get.nature(card, player),
							suit: get.suit(card, player),
							number: get.number(card, player),
							isCard: true,
							storage: { dcsbdouwei: true },
						});
						return cardx;
					});
				if (cards.some(cardx => game.hasPlayer(target => player !== target && player.inRangeOf(target) && player.canUse(cardx, target, false, false) && get.effect(target, cardx, player, player) > 0))) {
					return 12;
				}
				return 1;
			},
			result: { player: 1 },
		},
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				intro: { content: "一名角色因你【斗围】进入濒死时，你回复1点体力并恢复一个装备栏" },
				audio: "dcsbdouwei",
				trigger: { global: "dying" },
				filter(event, player) {
					return event.reason?.card?.storage?.dcsbdouwei && event.reason.getParent().player == player;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					await player.recover();
					if (player.hasDisabledSlot()) {
						const list = [1, 2, 3, 4, 5].filter(num => player.hasDisabledSlot(num)).map(num => "equip" + num);
						const result = await player
							.chooseControl(list)
							.set("prompt", `斗围：选择一个装备栏恢复`)
							.set("ai", () => {
								const player = get.player();
								const val = slot => {
									if (
										player.hasCard(function (card) {
											return get.subtype(card) == slot;
										}, "hs")
									) {
										return 15;
									}
									return 10;
								};
								return get.event().list.sort((a, b) => val(b) - val(a))[0];
							})
							.set("list", list)
							.forResult();
						if (result?.control) {
							await player.enableEquip(result.control);
						}
					}
					player.tempBanSkill("dcsbdouwei");
				},
			},
		},
	},
};
