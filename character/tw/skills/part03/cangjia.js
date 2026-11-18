import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "cangjia" | "duohui" | "yueyuan" | "zhengfu">} */
export const groupSkills = {
	//TW☆法正
	cangjia: {
		audio: "youtan",
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player, name) {
			const evt = event.getParent("phaseUse", true);
			if (evt && evt.player == player) {
				return false;
			}
			const cards = event.getg(player);
			return cards?.length && cards.some(card => !player.getStorage("cangjia").includes(get.suit(card)));
		},
		intro: { content: "已记录花色：$" },
		forced: true,
		onremove(player, skill) {
			player.removeTip(skill);
			player.setStorage(skill, []);
		},
		async content(event, trigger, player) {
			const suits = trigger
				.getg(player)
				.map(card => get.suit(card))
				.removeArray(player.getStorage(event.name));
			if (suits?.length) {
				player.markAuto(event.name, suits);
				player.addTip(
					event.name,
					`藏铗${player
						.getStorage(event.name)
						.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a))
						.map(i => get.translation(i))
						.join("")}`
				);
			}
		},
		group: "cangjia_defend",
		subSkill: {
			defend: {
				forced: true,
				trigger: {
					target: "useCardToTargeted",
				},
				filter(event, player) {
					if (!event.player || event.player === player) {
						return false;
					}
					return !player.getStorage("cangjia").includes(get.suit(event.card));
				},
				async content(event, trigger, player) {
					const source = trigger.card.player;
					if(!source || !source.isIn()) {
						trigger.getParent()?.excluded.add(player);
						return;
					}
					if (!source.hasCards("he", card => lib.filter.cardDiscardable(card, source, event.skill))) {
						trigger.getParent()?.excluded.add(player);
					} else {
						const result = await source
							.chooseToDiscard({
								prompt: `藏铗：弃置一张牌，否则${get.translation(trigger.card)}对${get.translation(player)}无效`,
								position:"he",
								ai(card) {
									return 20 - get.value(card);
								},
							})
							.forResult();
						if (!result.bool) trigger.getParent()?.excluded.add(player);
					}
				},
			},
		},
	},
	duohui: {
		audio: "ciren",
		global: "duohui_global",
		subSkill: {
			global: {
				trigger: {
					player: "phaseZhunbeiBegin",
				},
				filter(event, player) {
					if (!player.countCards("he")) {
						return false;
					}
					return game.hasPlayer(current => {
						return current != player && current.hasSkill("duohui");
					});
				},
				async cost(event, trigger, player) {
					const targets = game.filterPlayer(current => current != player && current.hasSkill("duohui"));
					event.result = await player
						.chooseCardTarget({
							prompt: get.prompt("duohui"),
							prompt2: `将一张牌交给${get.translation(targets)}${targets.length > 1 ? "中的一人" : ""}，令其交给你另一张同花色牌，或你摸一张牌`,
							position: "he",
							filterCard: true,
							filterTarget(card, player, target) {
								return get.event().targetx.includes(target);
							},
							targetx: targets,
							ai1(card) {
								return 6 - get.value(card);
							},
							ai2(target) {
								const player = get.player();
								return get.attitude(player, target);
							},
						})
						.forResult();
					event.result.skill_popup = false;
				},
				async content(event, trigger, player) {
					const {
							cards,
							targets: [target],
						} = event,
						suit = get.suit(cards[0]);
					await target.logSkill("duohui", player);
					await player.give(cards, target);
					const result = await target
						.chooseToGive(player, `堕洄：交给${get.translation(player)}另一张${get.translation(suit)}牌，否则其摸一张牌`, "he")
						.set("filterCard", card => {
							const { player, preCards, suit } = get.event();
							return !preCards.includes(card) && get.suit(card) == suit;
						})
						.set("ai", card => {
							const { player, att } = get.event(),
								value = get.value(card);
							if (value <= 0 && att <= 0) {
								return 10;
							}
							if (value > 15 && att > 0) {
								return 10;
							}
							return 0;
						})
						.set("att", get.attitude(target, player))
						.set("preCards", cards)
						.set("suit", suit)
						.forResult();
					if (!result?.bool) {
						await player.draw();
					}
				},
			},
		},
	},
	yueyuan: {
		audio: "zhancai",
		enable: "phaseUse",
		usable: 4,
		filter(event, player) {
			return player.getStorage("cangjia").length;
		},
		prompt() {
			const num = get.player().getStorage("cangjia").length;
			return `摸${get.cnNumber(num)}张牌，然后移去一个记录的花色`;
		},
		manualConfirm: true,
		async content(event, trigger, player) {
			const skill = "cangjia";
			await player.draw(player.getStorage(skill).length);
			const list = player.getStorage(skill);
			if (!list?.length) {
				return;
			}
			const result = await player
				.chooseButton(["跃渊：移去一个花色", [list.map(suit => ["", "", `lukai_${suit}`]), "vcard"]], true)
				.set("ai", button => {
					const player = get.player(),
						suit = button.link[2].slice(6);
					const num = player.countCards("hs", card => {
						return get.suit(card) == suit && player.hasValueTarget(card);
					});
					if (num > 0) {
						return 1 / num;
					}
					return 2;
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				player.unmarkAuto(
					skill,
					result.links.map(i => i[2].slice(6))
				);
				player.addTip(
					skill,
					`藏铗${player
						.getStorage(skill)
						.map(i => get.translation(i))
						.join("")}`
				);
			}
		},
		ai: {
			order: 9,
			combo: "cangjia",
			result: {
				player(player) {
					return player.getStorage("cangjia").filter(suit => {
						return (
							player.countCards("hs", card => {
								return get.suit(card) == suit && player.hasValueTarget(card);
							}) === 0
						);
					}).length;
				},
			},
		},
	},
	//英文版特典武将凯撒
	zhengfu: {
		trigger: {
			player: "useCardToPlayered",
		},
		check(event, player) {
			return get.attitude(player, event.target) < 0;
		},
		filter(event, player) {
			return event.card.name == "sha";
		},
		logTarget: "target",
		async cost(event, trigger, player) {
			const list = ["basic", "trick", "equip"].map(type => ["", "", `caoying_${type}`]);
			const result = await player
				.chooseButton([get.prompt2(event.skill, trigger.target), [list, "vcard"]])
				.set("ai", button => {
					const type = button.link[2].slice(8),
						{ player, target } = get.event();
					if (get.attitude(player, target) > 0) {
						return 0;
					}
					if (target.hasKnownCards(player, card => get.type2(card) == type)) {
						return Math.random();
					}
					return ["basic", "equip", "trick"].indexOf(type) + Math.random();
				})
				.set("target", trigger.target)
				.set("forceAuto", true)
				.forResult();
			if (result.bool) {
				event.result = {
					bool: true,
					targets: [trigger.target],
					cost_data: result.links[0][2].slice(8),
				};
			}
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: type,
			} = event;
			const result = await target
				.chooseCard("he", `交给${get.translation(player)}一张${get.translation(type)}牌，否则此【杀】不可被闪避`, card => {
					return get.type2(card) == get.event().type;
				})
				.set("ai", card => {
					const num = get.event().num;
					if (num == 0) {
						return 0;
					}
					if (card.name == "shan") {
						return num > 1 ? 2 : 0;
					}
					return 8 - get.value(card);
				})
				.set("num", target.countCards("h", "shan"))
				.set("type", type)
				.forResult();
			if (result.bool) {
				await target.give(result.cards, player);
			} else {
				trigger.getParent().directHit.add(target);
				await game.delayx();
			}
		},
	},
};
