import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshenduan" | "dckegou" | "dcdixian" | "old_dckegou" | "old_dcjiduan" | "old_dcdixian">} */
export const groupSkills = {
	//武陆抗
	dcshenduan: {
		audio: 2,
		trigger: { global: "chooseToCompareBegin" },
		filter(event, player) {
			if (player === event.player) {
				return true;
			}
			return (event?.targets?.includes(player) || player == event.target) && player.countDiscardableCards(player, "he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(`###${get.prompt(event.skill)}###弃置一张牌，然后用牌堆中点数最大的牌拼点`, "he")
				.set("ai", card => {
					const player = get.player();
					const number = get.number(card);
					if (number >= 11 || player.hasCard(card => get.number(card) >= 12, "h")) {
						return 0;
					}
					return 7 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const cards = lib.skill.dcshenduan.getExtreCard("max");
			await game.cardsGotoOrdering(cards);
			if (!trigger.fixedResult) {
				trigger.fixedResult = {};
			}
			trigger.fixedResult[player.playerid] = cards[0];
		},
		//获得牌堆X个点数不同且为极大或极小的牌各一张
		getExtreCard(str, count = 1) {
			let cards = [];
			if (!["max", "min"].includes(str) || count < 1) {
				return cards;
			}
			let num = str == "max" ? 13 : 1;
			while (num > 0 && num < 14) {
				const card = get.cardPile2(card => {
					return get.number(card, false) == num;
				});
				if (card) {
					cards.add(card);
					if (cards.length == count) {
						break;
					}
				}
				str == "max" ? num-- : num++;
			}
			return cards;
		},
		group: ["dcshenduan_effect"],
		subSkill: {
			effect: {
				audio: "dcshenduan",
				trigger: { global: ["chooseToCompareAfter", "compareMultipleAfter"] },
				filter(event, player, name) {
					if (event.preserve || event.result?.cancelled) {
						return false;
					}
					if (!lib.skill.dcshenduan_effect.logTarget(event, player).length) {
						return false;
					}
					if (event.name == "compareMultiple") {
						return true;
					}
					return !event.compareMultiple;
				},
				logTarget(event, player) {
					let list = [];
					if (event.targets?.length) {
						list.push([event.player, event.result.num1[0], event.result.player]);
						for (const i in event.targets) {
							list.push([event.targets[i], event.result.num2[i], event.result.targets[i]]);
						}
					} else {
						list = [
							[event.player, event.num1, event.card1],
							[event.target, event.num2, event.card2],
						];
					}
					event.set("dcshenduan_list", list);
					return list
						.filter(arr => arr[1] == 13)
						.map(arr => arr[0])
						.filter(target => target.isIn());
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const targets = [player].concat(event.targets.sortBySeat());
					for (const target of targets) {
						const card = lib.skill.dcshenduan.getExtreCard("min");
						if (card) {
							game.log(target, "从牌堆获得一张牌");
							await target.gain(card, "draw");
						} else {
							break;
						}
					}
					const putter = trigger.name == "compareMultiple" ? trigger.winner : trigger.result.winner;
					if (putter?.isIn()) {
						const card = trigger.dcshenduan_list?.filter(arr => arr[0] === putter)[0][2];
						if (get.owner(card)) {
							return;
						}
						game.log(putter, "将", card, "置于牌堆底");
						await game.cardsGotoPile(card);
					}
				},
			},
		},
	},
	dckegou: {
		audio: 2,
		enable: "phaseUse",
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			if (!game.hasPlayer(target => player.canCompare(target))) {
				return false;
			}
			if (event.name == "chooseToUse") {
				return !player.hasSkill("dckegou_used");
			}
			return _status.currentPhase != player && (player.hasHistory("useCard") || player.hasHistory("respond"));
		},
		precontent() {
			player.addTempSkill("dckegou_used", "phaseUseAfter");
		},
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => player.canCompare(target))
				.set("ai", target => -get.attitude(get.player(), target) / target.countCards("h"))
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			while (player.canCompare(target)) {
				const result = await player.chooseToCompare(target).forResult();
				if (result.bool) {
					const cards = lib.skill.dcshenduan.getExtreCard("min", Math.min(3, Math.abs(result.num1 - result.num2)));
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
					break;
				} else {
					if (target.canUse({ name: "sha", isCard: true }, player, false, false)) {
						await target.useCard(get.autoViewAs({ name: "sha", isCard: true }), player, false);
					}
					if (!player.canCompare(target)) {
						break;
					}
					const result2 = await player
						.chooseBool(`克构：是否继续与${get.translation(target)}拼点`)
						.set("ai", () => get.attitude(get.player(), get.event().target) < 0)
						.set("target", target)
						.forResult();
					if (!result2.bool) {
						break;
					}
				}
			}
		},
		ai: {
			order: 5,
			result: {
				target: -1,
			},
		},
		subSkill: {
			used: {
				charlotte: true,
			},
		},
	},
	dcdixian: {
		audio: 2,
		limited: true,
		enable: "phaseUse",
		chooseButton: {
			dialog(event, player) {
				const card = lib.skill.dcshenduan.getExtreCard("min")[0];
				const num = get.number(card, false);
				return ui.create.dialog(get.prompt2("dcdixian") + `<span class=thundertext> 当前牌堆最小点数为：${get.strNumber(num)}</span>`);
			},
			chooseControl(event, player) {
				const choices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(i => get.strNumber(i));
				choices.push("cancel2");
				return choices;
			},
			check(event, player) {
				return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].randomGet();
			},
			backup(result, player) {
				return {
					audio: "dcdixian",
					skillAnimation: true,
					animationColor: "metal",
					num: result.control,
					async content(event, trigger, player) {
						player.awakenSkill("dcdixian");
						const num = get.numString(lib.skill.dcdixian_backup.num);
						const card = get.cardPile2(card => get.number(card, false) < num);
						if (!card) {
							await player.draw(num);
							player.addSkill("dcdixian_effect");
							player.markAuto("dcdixian_effect", [num]); //用数组存还是考虑到后续重置限定技的问题（）
						} else {
							const discard = Array.from(ui["discardPile"].childNodes).filter(cardx => get.number(cardx, false) == 13);
							const cards = Array.from(ui["cardPile"].childNodes)
								.filter(cardx => get.number(cardx, false) == 13)
								.concat(discard);
							if (cards.length) {
								//照搬武陆逊的写法，父子在技能代码上也有联系，这很合理吧（）
								const next = player.gain(cards);
								next.shown_cards = discard;
								next.set("animate", event => {
									const player = event.player,
										cards = event.cards,
										shown = event.shown_cards;
									if (shown.length < cards.length) {
										var num = cards.length - shown.length;
										player.$draw(num);
										game.log(player, "从牌堆获得了", get.cnNumber(num), "张点数为K的牌");
									}
									if (shown.length > 0) {
										player.$gain2(shown, false);
										game.log(player, "从弃牌堆获得了", shown);
									}
									return 500;
								});
								await next;
							}
						}
					},
				};
			},
		},
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
		subSkill: {
			effect: {
				mark: true,
				intro: {
					markcount: () => 0,
					content: `使用点数小于等于$的牌无距离次数限制`,
				},
				charlotte: true,
				onremove: true,
				mod: {
					cardUsable(card, player) {
						const num = get.number(card, player) || 0;
						if (player.getStorage("dcdixian_effect").some(numx => num <= numx)) {
							return Infinity;
						}
					},
					targetInRange(card, player, target) {
						const num = get.number(card, player) || 0;
						if (player.getStorage("dcdixian_effect").some(numx => num <= numx)) {
							return true;
						}
					},
				},
			},
		},
	},
	//牢武陆抗 —— by 刘巴
	old_dckegou: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return event.player != player && _status.discarded.length > 0;
		},
		forced: true,
		async content(event, trigger, player) {
			const discardPile = _status.discarded;
			let maxNumber = Math.max(...discardPile.map(c => get.number(c)));
			await player.gain(discardPile.filter(c => get.number(c) === maxNumber).randomGets(1), "gain2");
		},
	},
	old_dcjiduan: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter: (event, player) => event.isFirstTarget && event.targets.filter(c => !player.getStorage("old_dcjiduan_used").includes(c)).some(z => z.countCards("h")),
		async cost(event, trigger, player) {
			let targets = trigger.targets.filter(c => !player.getStorage(event.name + "_used").includes(c));
			event.result = await player
				.chooseTarget("急断：请选择一名角色")
				.set("filterTarget", (card, player, target) => targets.includes(target) && target.countCards("h"))
				.set("ai", target => {
					let items = target.getCards("h");
					let count = [...new Set(items.map(item => get.suit(item, target)))].length;
					let player = get.player();
					if (get.attitude(player, target) > 0) {
						return (4 - count) * get.effect(target, { name: "draw" }, target, player);
					}
					if (get.attitude(player, target) < 0) {
						return count * get.effect(target, { name: "guohe_copy2" }, player);
					}
				})
				.forResult();
		},
		async content(event, trigger, player) {
			let target = event.targets[0];
			let numberx = get.number(trigger.card);
			const show = await target
				.chooseCard()
				.set("forced", true)
				.set("prompt", `${get.translation(event.name)}：请展示一张手牌`)
				.set("prompt2", `若此牌点数小于${numberx}则你被${get.translation(player)}执行摸牌或弃牌效果`)
				.set("ai", card => {
					if (get.attitude(get.player(), _status.event.getParent().player) <= 0) {
						return get.number(card) >= numberx;
					} else {
						return get.number(card) < numberx;
					}
				})
				.set("numberx", numberx)
				.forResult();
			if (show) {
				await target.showCards(show.cards);
			}
			if (numberx != 13) {
				player.markAuto(event.name + "_used", target);
			}
			player.when({ global: ["phaseBeginStart", "phaseEnd"] }).step(async () => (player.storage.old_dcjiduan_used = []));
			if (get.number(show.cards[0]) >= numberx) {
				return;
			}
			const result = await player
				.chooseControlList(get.prompt(event.name), ["令" + get.translation(target) + "摸手牌中没有的花色各一张牌", "令" + get.translation(target) + "弃置每种花色的手牌各一张"], true)
				.set("ai", () => {
					if (get.attitude(get.player(), target) <= 0) {
						return 1;
					} else {
						return 0;
					}
				})
				.set("target", target)
				.forResult();
			let suitx = [...new Set(target.getCards("h").map(item => get.suit(item, target)))];
			if (result.index == 0) {
				let suits = lib.suit.filter(c => !suitx.includes(c));
				let gains = [];
				for (const suit of suits) {
					const card = get.cardPile(card => get.suit(card) === suit && !gains.includes(card));
					if (card) {
						gains.push(card);
					}
				}
				if (gains.length) {
					await target.gain(gains, "gain2");
				}
			} else {
				let num = target.getDiscardableCards(target, "h").length;
				if (num) {
					await target
						.chooseToDiscard("h", Math.min(suitx.length, num), true)
						.set("filterCard", (card, player) => !ui.selected.cards.length || !ui.selected.cards.some(i => get.suit(i, player) === get.suit(card, player)))
						.set("prompt", "请弃置不同花色的牌")
						.set("complexCard", true)
						.set("ai", function (card) {
							const player = get.player();
							if (!player.hasValueTarget(card)) {
								return 5;
							}
							return 5 - get.value(card);
						});
				}
			}
		},
	},
	old_dcdixian: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		onChooseToUse(event) {
			if (!game.online && !event.old_dcdixian) {
				event.set("old_dcdixian", ui.cardPile.childNodes.length);
			}
		},
		filter(event, player) {
			if (!event.old_dcdixian) {
				return false;
			}
			return player.hasCard(card => lib.filter.cardDiscardable(card, player), "h");
		},
		filterCard: lib.filter.cardDiscardable,
		selectCard: [1, Infinity],
		check(card) {
			return 6 - get.value(card);
		},
		allowChooseAll: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.addSkill(event.name + "_mark");
			const cardPile = Array.from(ui.cardPile.childNodes).sort(lib.sort.number2);
			if (!cardPile.length) {
				return;
			}
			const next = player.gain(cardPile.splice(0, event.cards.length), "draw");
			next.gaintag.add(event.name);
			await next;
		},
		ai: {
			order: 10,
			result: {
				player: 1,
			},
			threaten: 1.5,
		},
		subSkill: {
			mark: {
				charlotte: true,
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("old_dcdixian")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name === "phaseDiscard" && card.hasGaintag("old_dcdixian")) {
							return false;
						}
					},
				},
			},
		},
	},
};
