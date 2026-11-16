import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yachai" | "qingtan" | "jianliang" | "weimeng">} */
export const groupSkills = {
	//何晏
	yachai: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.source && event.source.isIn();
		},
		logTarget: "source",
		check(event, player) {
			if (get.attitude(player, event.source) <= 0) {
				return true;
			}
			return event.source.countCards("h") < Math.sqrt(event.source.getHp());
		},
		async content(event, trigger, player) {
			const target = trigger.source,
				str = get.translation(player);
			const th = target.countCards("h");
			const num = Math.ceil(th / 2);
			let result;
			if (th > 0) {
				const list = ["本回合不能使用手牌，然后" + str + "摸两张牌", "展示所有手牌，并将其中一种花色的所有牌交给" + str, "弃置" + get.cnNumber(num) + "张手牌"];
				result = await target
					.chooseControl()
					.set("choiceList", list)
					.set("ai", () => get.event().idx)
					.set(
						"idx",
						(function () {
							let att = get.sgn(get.attitude(target, player)),
								use = get.effect(player, { name: "draw" }, player, target) * 1.5,
								give = {},
								discard = [];
							target.countCards("h", i => {
								discard.add(i);
								let suit = get.suit(i, target),
									val = target.getUseValue(i, null, true);
								give[suit] ??= 0;
								give[suit] += get.value(i);
								if (val > 1) {
									use -= Math.sqrt(Math.abs(val));
								}
							});
							discard.sort((a, b) => get.value(a) - get.value(b));
							discard = discard.slice(0, Math.min(num, discard.length)).reduce((sum, card) => sum + get.value(card), 0);
							give = att * Math.min(...Object.values(give));
							const res = [use, give, -discard];
							return res.indexOf(Math.max(...res));
						})()
					)
					.forResult();
			} else {
				result = { index: 0 };
			}
			switch (result?.index) {
				case 0:
					target.addTempSkill("yachai_block");
					await player.draw(2);
					return;
				case 1: {
					await target.showHandcards();
					const map = {},
						hs = target.getCards("h");
					for (const i of hs) {
						map[get.suit(i, target)] ??= [];
						map[get.suit(i, target)].push(i);
					}
					const list = Object.keys(map).filter(i => lib.suit.includes(i));
					let result2;
					if (!list.length) {
						return;
					} else if (list.length == 1) {
						result2 = { control: list[0] };
					} else {
						result2 = await target
							.chooseControl({
								controls: list,
								prompt: "将一种花色的牌交给" + get.translation(player),
								choice: (() => {
									const suit = list.slice().sort((a, b) => {
										return get.value(map[a], target) - get.value(map[b], target);
									})[0];
									return list.indexOf(suit);
								})(),
							})
							.forResult();
					}
					if (result2?.control) {
						const cards = map[result2.control].filter(function (card) {
							return lib.filter.canBeGained(card, player, target, "yachai");
						});
						if (cards.length) {
							await target.give(cards, player, "give");
						}
					}
					return;
				}
				case 2:
					await target.chooseToDiscard("h", true, num);
			}
		},
		subSkill: {
			block: {
				mark: true,
				intro: { content: "不能使用手牌" },
				charlotte: true,
				mod: {
					cardEnabled(card, player) {
						let hs = player.getCards("h"),
							cards = [card];
						if (Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						}
						for (let i of cards) {
							if (hs.includes(i)) {
								return false;
							}
						}
					},
					cardSavable(card, player) {
						let hs = player.getCards("h"),
							cards = [card];
						if (Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						}
						for (let i of cards) {
							if (hs.includes(i)) {
								return false;
							}
						}
					},
				},
			},
		},
	},
	qingtan: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filter(event, player) {
			return game.hasPlayer(current => current.countCards("h") > 0);
		},
		filterTarget(card, player, target) {
			return target.countCards("h") > 0;
		},
		selectTarget: -1,
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const { targets } = event;
			targets.sortBySeat();
			const next = player
				.chooseCardOL(targets, "请选择要展示的牌", true)
				.set("ai", function (card) {
					return -get.value(card);
				})
				.set("source", player);
			next.aiCard = function (target) {
				const hs = target.getCards("h");
				return { bool: true, cards: [hs.randomGet()] };
			};
			next._args.remove("glow_result");
			const result = await next.forResult();
			const listMap = new Map();
			for (let i = 0; i < targets.length; i++) {
				listMap.set(result[i].cards[0], targets[i]);
			}
			const cards = Array.from(listMap.keys()).flat();
			await player
				.showCards(cards, get.translation(player) + "发动了【清谈】")
				.set("customButton", button => {
					const target = get.owner(button.link);
					if (target) {
						game.createButtonCardsetion(`${target.getName(true)}`, button);
					}
				})
				.set("delay_time", 4)
				.set("multipleShow", true);
			const list = [],
				map = {};
			for (const card of cards) {
				const color = get.color(card);
				map[color] ??= [];
				map[color].push(card);
			}
			const dialog = ["清谈：你可以获得一种颜色的所有牌"];
			for (const color of Object.keys(lib.color)) {
				if (map[color]) {
					// @ts-ignore
					dialog.push([
						map[color].map(card => [card, listMap.get(card)]),
						(item, type, position, noclick, node) => {
							node = ui.create.buttonPresets.card(item[0], type, position, noclick);
							game.createButtonCardsetion(`${item[1].getName(true)}`, node);
							return node;
						},
					]);
					list.push(color);
				}
			}
			if (list.length) {
				const result = await player
					.chooseControl(list, "cancel2")
					.set("dialog", dialog)
					.set("list", list)
					.set("map", map)
					.set("listMap", listMap)
					.set("ai", () => {
						let max = 0,
							res = "cancel2";
						const { list, map, player, listMap } = get.event();
						for (let color of list) {
							let temp = 0;
							for (let card of map[color]) {
								temp += get.value(card, player) + get.sgn(get.attitude(player, listMap.get(card))) * (6 - get.value(card, listMap.get(card)));
							}
							for (let colorx in map) {
								if (colorx === color) {
									continue;
								}
								for (let cardx of map[colorx]) {
									temp -= get.sgn(get.attitude(player, listMap.get(cardx))) * get.value(cardx, listMap.get(cardx));
								}
							}
							if (temp > max) {
								res = color;
								max = temp;
							}
						}
						return res;
					})
					.forResult();
				if (result?.control != "cancel2") {
					const color = result.control;
					player.chat(get.translation(color + 2));
					game.log(player, "选择了", "#y" + get.translation(color + 2));
					const cards2 = cards.filter(card => get.color(card) == color);
					await player.gain(cards2, "give");
					const draws = cards2.map(card => listMap.get(card));
					await game.asyncDraw(draws);
					for (let i = 0; i < cards.length; i++) {
						if (!cards2.includes(cards[i])) {
							await targets[i].modedDiscard(cards[i], player);
						}
					}
					await game.delayx();
				}
			}
		},
		ai: {
			order: 7,
			result: {
				player: 0.3,
				target: -1,
			},
		},
	},
	//邓芝
	jianliang: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		filter(event, player) {
			return !player.isMaxHandcard();
		},
		direct: true,
		async content(event, trigger, player) {
			const result = await player
				.chooseTarget(get.prompt("jianliang"), "令至多两名角色各摸一张牌", [1, 2])
				.set("ai", target => {
					return Math.sqrt(5 - Math.min(4, target.countCards("h"))) * get.attitude(_status.event.player, target);
				})
				.forResult();
			if (result.bool) {
				const targets = result.targets.sortBySeat();
				player.logSkill("jianliang", targets);
				if (targets.length == 1) {
					await targets[0].draw();
				} else {
					await game.asyncDraw(targets);
				}
			}
			game.delayx();
		},
	},
	weimeng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => get.info("weimeng").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return player.hp > 0 && target != player && target.countGainableCards(player, "h") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (!target.countGainableCards(player, "h") || player.hp <= 0) {
				return;
			}
			let result = await player.gainPlayerCard(target, "h", true, [1, player.hp]).forResult();
			if (result?.bool && target.isIn()) {
				const num = result.cards.length;
				const number1 = result.cards.reduce((num, card) => (num += get.number(card, player)), 0);
				event.number1 = number1;
				result = await player.chooseToGive(target, "he", true, `危盟：选择交给${get.translation(target)}${get.cnNumber(num)}张牌`, `（已得到牌的点数和：${number1}）`, num).forResult();
				if (result?.bool) {
					const number2 = result.cards.reduce((num, card) => (num += get.number(card, player)), 0);
					event.number2 = number2;
					if (number1 < number2) {
						await player.draw();
					} else if (number1 > number2) {
						await player.discardPlayerCard(target, true, "hej");
					}
				}
			}
		},
		ai: {
			order: 6,
			tag: {
				lose: 1,
				loseCard: 1,
				gain: 1,
			},
			result: {
				target(player, target) {
					return -Math.pow(Math.min(player.hp, target.countCards("h")), 2) / 4;
				},
			},
		},
	},
};
