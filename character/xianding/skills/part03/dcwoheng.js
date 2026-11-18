import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcwoheng" | "dcyuhui" | "dczhengyue">} */
export const groupSkills = {
	//威孙权
	dcwoheng: {
		audio: 2,
		mark: true,
		intro: {
			markcount() {
				const useCnt = game.getRoundHistory("everything", evt => evt.name == "dcwoheng", 0).length;
				return useCnt + 1;
			},
			content() {
				const useCnt = game.getRoundHistory("everything", evt => evt.name == "dcwoheng", 0).length;
				return `令一名其他角色摸${get.cnNumber(useCnt + 1)}张牌或弃置${get.cnNumber(useCnt + 1)}张牌`;
			},
		},
		trigger: { player: "damageEnd" },
		enable: "phaseUse",
		filterTarget: lib.filter.notMe,
		prompt() {
			const num = game.getRoundHistory("everything", evt => evt.name == "dcwoheng", 0).length;
			return `令一名其他角色摸${get.cnNumber(num + 1)}张牌或弃置${get.cnNumber(num + 1)}张牌`;
		},
		async cost(event, trigger, player) {
			const num = game.getRoundHistory("everything", evt => evt.name == "dcwoheng", 0).length;
			event.result = await player
				.chooseTarget(get.prompt(event.skill), `令一名其他角色摸${get.cnNumber(num + 1)}张牌或弃置${get.cnNumber(num + 1)}张牌`, lib.filter.notMe)
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, "dcwoheng", player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.target || event.targets[0];
			const goon = event.getParent(2).name !== "dcyuhui_buff",
				useCnt = game.getRoundHistory("everything", evt => evt.name == "dcwoheng", 0).length;
			const num = goon ? useCnt : 1;
			if (!target?.isIn()) {
				return;
			}
			const str1 = "摸" + get.cnNumber(num) + "张牌";
			const str2 = "弃" + get.cnNumber(num) + "张牌";
			const list = [str1];
			if (target.countCards("he")) {
				list.push(str2);
			}
			let directcontrol =
				str1 ==
				(
					await player
						.chooseControl(list)
						.set("ai", () => get.event().choice)
						.set(
							"choice",
							get.effect(target, { name: "draw" }, player, player) *
								(() => {
									if (goon && useCnt <= 3) {
										if (target.countCards("h") + num === player.countCards("h")) {
											return 100 * num;
										}
									}
									return num;
								})() >
								get.effect(target, { name: "guohe_copy2" }, target, player) *
									(() => {
										const numx = Math.min(num, target.countDiscardableCards(target, "he"));
										if (goon && useCnt <= 3) {
											if (target.countCards("h") - numx === player.countCards("h")) {
												return 100 * numx;
											}
										}
										return numx;
									})()
								? str1
								: str2
						)
						.set("prompt", get.translation("dcwoheng") + "：令" + get.translation(target) + "…")
						.forResult()
				).control;
			if (directcontrol) {
				await target.draw(num);
			} else {
				await target.chooseToDiscard(num, true, "he");
			}
			if (useCnt > 3 || player.countCards("h") !== target.countCards("h")) {
				await player.draw(2);
				if (player.hasSkill("dcwoheng", null, null, false)) {
					player.tempBanSkill("dcwoheng");
				}
			}
		},
		group: "dcwoheng_refresh",
		subSkill: {
			refresh: {
				charlotte: true,
				trigger: { global: "roundStart" },
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.markSkill("dcwoheng");
				},
			},
		},
		ai: {
			order(item, player) {
				const num = game.getRoundHistory("everything", evt => evt.name == "dcwoheng", 0).length + 1;
				if (
					game.hasPlayer(target => {
						if (get.effect(target, { name: "draw" }, player, player) > 0) {
							if (target.countCards("h") + num === player.countCards("h")) {
								return true;
							}
						}
						if (get.effect(target, { name: "guohe_copy2" }, player, player) > 0) {
							const numx = Math.min(num, target.countDiscardableCards(target, "he"));
							if (target.countCards("h") - numx === player.countCards("h")) {
								return true;
							}
						}
						return false;
					})
				) {
					return 100;
				}
				return 7;
			},
			result: {
				player(player, target) {
					const goon = !get.event()?.getParent()?.name.includes("dcyuhui_buff"),
						useCnt = game.getRoundHistory("everything", evt => evt.name == "dcwoheng", 0).length;
					const num = goon ? useCnt + 1 : 1;
					return Math.max(
						get.effect(target, { name: "draw" }, player, player) *
							(() => {
								if (goon && useCnt < 3) {
									if (target.countCards("h") + num === player.countCards("h")) {
										return 100 * num;
									}
								}
								return num;
							})(),
						get.effect(target, { name: "guohe_copy2" }, target, player) *
							(() => {
								const numx = Math.min(num, target.countDiscardableCards(target, "he"));
								if (goon && useCnt < 3) {
									if (target.countCards("h") - numx === player.countCards("h")) {
										return 100 * numx;
									}
								}
								return numx;
							})()
					);
				},
			},
		},
	},
	dcyuhui: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(target => {
				if (target == player) {
					return false;
				}
				return target.group === "wu";
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("filterTarget", (_, player, target) => {
					if (target == player) {
						return false;
					}
					return target.group === "wu";
				})
				.set("ai", target => get.attitude(get.player(), target))
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			for (const target of targets) {
				target.addSkill("dcyuhui_buff");
				target.markAuto("dcyuhui_buff", [player]);
			}
		},
		derivation: "dcwoheng",
		subSkill: {
			buff: {
				charlotte: true,
				trigger: { player: "phaseUseBegin" },
				getIndex(event, player) {
					return player.getStorage("dcyuhui_buff");
				},
				async cost(event, trigger, player) {
					const target = event.indexedData;
					player.unmarkAuto("dcyuhui_buff", [target]);
					if (!player.getStorage("dcyuhui_buff").length) {
						player.removeSkill("dcyuhui_buff");
					}
					if (!target?.isIn() || !game.hasPlayer(target => target !== player)) {
						event.result = { bool: false };
						return;
					}
					const list = ["dcyuhui_buff", target];
					event.result = await player
						.chooseToGive(
							target,
							card => {
								return get.color(card) == "red" && get.type(card) == "basic";
							},
							"he",
							get.prompt(...list)
						)
						.set("ai", card => {
							const player = get.player();
							if (get.attitude(player, get.event().getParent().indexedData) < 0) {
								return 0;
							}
							return (
								Math.max(
									...game
										.filterPlayer(target => target !== player)
										.map(target => {
											return get.effect(target, "dcwoheng", player, player);
										})
								) - get.value(card)
							);
						})
						.set("prompt2", "交给" + get.translation(target) + "一张红色基本牌，发动一次X为1的〖斡衡〗")
						.set("logSkill", list)
						.forResult();
				},
				popup: false,
				async content(event, trigger, player) {
					const result = await player
						.chooseTarget(get.prompt("dcwoheng"), `令一名其他角色摸一张牌或弃置一张牌`, lib.filter.notMe)
						.set("ai", target => {
							const player = get.player();
							return get.effect(target, "dcwoheng", player, player);
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						await player.useSkill("dcwoheng", result.targets);
					}
				},
				intro: { content: "出牌阶段开始时，你可以交给$一张红色基本牌，发动一次X为1的〖斡衡〗" },
			},
		},
	},
	//吕据
	dczhengyue: {
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object" && player.countExpansions("dczhengyue")) {
					if (["suit", "number", "name"].some(func => get[func](card) == get[func](player.getExpansions("dczhengyue")[0]))) {
						return num + 10;
					}
				}
			},
		},
		locked: false,
		audio: 2,
		trigger: { player: "phaseBegin" },
		filter(event, player) {
			return !player.getExpansions("dczhengyue").length;
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseControl(
					Array.from({ length: 5 }).map((_, i) => get.cnNumber(i + 1) + "张"),
					"cancel2"
				)
				.set("ai", () => {
					return 4;
				})
				.set("prompt", get.prompt(event.skill))
				.set("prompt2", "将牌堆顶至多五张牌置于武将牌上")
				.forResult();
			event.result = {
				bool: result?.control !== "cancel2",
				cost_data: result?.index + 1,
			};
		},
		async content(event, trigger, player) {
			const cards = get.cards(event.cost_data);
			await game.cardsGotoOrdering(cards);
			let result;
			if (cards.length > 1) {
				const next = player.chooseToMove("征越：将这些牌以任意顺序置于武将牌上", true);
				next.set("list", [["武将牌", cards]]);
				next.set("processAI", list => [list[0][1].slice(0).randomSort()]);
				result = await next.forResult();
			} else {
				result = { bool: true, moved: [cards] };
			}
			if (result?.moved?.[0]?.length) {
				const moved = result.moved[0].reverse();
				const next = player.addToExpansion(moved, "give");
				next.gaintag.add(event.name);
				await next;
			}
			lib.skill[event.name].update(player, event.name);
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		init(player, skill) {
			player.addSkill(skill + "_mark");
			lib.skill[skill].update(player, skill);
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
			player.removeSkill(skill + "_mark");
			player.removeTip(skill);
		},
		update(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.addTip(
					skill,
					[skill, get.suit(cards[0]), get.number(cards[0]), get.name(cards[0])]
						.map((item, index) => {
							if (index == 2) {
								return get.strNumber(item);
							}
							return get.translation(item);
						})
						.join(" ")
				);
			} else {
				player.removeTip(skill);
			}
		},
		group: "dczhengyue_useCard",
		subSkill: {
			useCard: {
				audio: "dczhengyue",
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					const cards = player.getExpansions("dczhengyue");
					if (!cards.length) {
						return false;
					}
					const [card] = cards;
					if (["suit", "number", "name"].some(func => get[func](card) == get[func](event.card))) {
						return true;
					}
					return cards.length <= 5;
				},
				forced: true,
				async content(event, trigger, player) {
					const cards = player.getExpansions("dczhengyue");
					if (!cards.length) {
						player.removeTip("dczhengyue");
						return;
					}
					const [card] = cards;
					if (["suit", "number", "name"].some(func => get[func](card) == get[func](trigger.card))) {
						await player.loseToDiscardpile(card);
						await player.draw(2);
					} else {
						if (cards.length < 5 && trigger.cards?.someInD("odej")) {
							const puts = trigger.cards.filterInD("odej").randomGets(5 - cards.length);
							const next = player.addToExpansion(puts, "give");
							next.gaintag.add("dczhengyue");
							await next;
							const num = puts.length;
							if (num) {
								player.addTempSkill("dczhengyue_count");
								player.addMark("dczhengyue_count", num, false);
								if (player.countMark("dczhengyue_count") >= 2) {
									player.addTempSkill("dczhengyue_debuff");
								}
							}
						}
						if (player.hasExpansions("dczhengyue")) {
							const next = player.chooseToMove("征越：你可以调整“征越”牌的顺序", true);
							next.set("list", [["武将牌", player.getExpansions("dczhengyue")]]);
							next.set("processAI", list => [list[0][1].slice(0).randomSort()]);
							const result = await next.forResult();
							if (result?.moved?.[0]?.length) {
								const moved = result.moved[0].reverse();
								player.$gain2(moved);
								player.$addToExpansion(moved, null, ["dczhengyue"], false);
								player.markSkill("dczhengyue");
							}
						}
					}
					lib.skill["dczhengyue"].update(player, "dczhengyue");
				},
			},
			count: {
				charlotte: true,
				onremove: true,
			},
			debuff: {
				charlotte: true,
				mark: true,
				intro: { content: "本回合不能使用或打出手牌" },
				mod: {
					cardEnabled2(card, player) {
						if (get.position(card) == "h") {
							return false;
						}
					},
				},
			},
			mark: {
				charlotte: true,
				trigger: {
					player: ["loseAfter", "addToExpansionAfter"],
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter"],
				},
				filter(event, player) {
					if (event.name == "addToExpansion") {
						return event.gaintag.includes("dczhengyue");
					}
					if (event.name == "lose" && event.getlx !== false) {
						return Object.values(event.gaintag_map).flat().includes("dczhengyue");
					}
					return game.hasGlobalHistory("cardMove", evt => {
						if (evt.name != "lose" || event != evt.getParent()) {
							return false;
						}
						return Object.values(evt.gaintag_map).flat().includes("dczhengyue") && evt.player == player;
					});
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					lib.skill["dczhengyue"].update(player, "dczhengyue");
				},
			},
		},
	},
};
