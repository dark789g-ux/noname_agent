import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdzhengnan" | "stdbaobian" | "stdhuituo" | "stdmingjian" | "stdpolu" | "stdchoulve" | "stdjiaozhao" | "stddanxin" | "stddianfeng">} */
export const groupSkills = {
	//关索
	stdzhengnan: {
		audio: "zhengnan",
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		filter(event, player) {
			return player.countCards("hs", { color: "red" });
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			const next = player.chooseToUse();
			next.set("openskilldialog", get.prompt2("stdzhengnan"));
			next.set("norestore", true);
			next.set("_backupevent", "stdzhengnan_backup");
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup("stdzhengnan_backup");
			await next;
			if (
				game.getGlobalHistory("everything", evt => {
					if (evt.name != "die" || evt?.source != player) {
						return false;
					}
					return evt.reason?.getParent(event.name) == event;
				}).length > 0
			) {
				await player.draw(2);
			}
		},
		subSkill: {
			backup: {
				audio: "stdzhengnan",
				filterCard(card) {
					return get.itemtype(card) == "card" && get.color(card) == "red";
				},
				position: "hs",
				viewAs: {
					name: "sha",
				},
				prompt: "将一张红色手牌当杀使用",
				check(card) {
					return 7 - get.value(card);
				},
			},
		},
	},
	//夏侯霸
	stdbaobian: {
		audio: "rebaobian",
		trigger: { player: "phaseUseBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.countCards("h");
				})
				.set("ai", target => {
					const player = get.player();
					if (player.hp < 2) {
						return 0;
					}
					return get.effect(target, { name: "guohe_copy2" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await player.loseHp();
			const target = event.targets[0],
				card = { name: "sha", isCard: true };
			const { cards } = await target.chooseToDiscard("h", true).forResult();
			if (get.type(cards[0]) == "basic" && player.canUse(card, target, false)) {
				await player.useCard(card, target, false);
			}
		},
	},
	//曹睿
	stdhuituo: {
		audio: "huituo",
		trigger: {
			player: "damageEnd",
		},
		async content(event, trigger, player) {
			const cards = game.cardsGotoOrdering(get.cards(2)).cards;
			await player.showCards(cards, get.translation(player) + "发动了【恢拓】");
			const next = player.chooseToMove("恢拓：是否交换任意张牌？");
			next.set("list", [
				["展示牌", cards, "sbhuanshi_tag"],
				["你的手牌", player.getCards("h")],
			]);
			next.set("filterMove", (from, to) => {
				return typeof to !== "number";
			});
			next.set("selectionSpec", { move: "swap" });
			next.set("processAI", list => {
				let cards = [...list[0][1], ...list[1][1]],
					player = get.player();
				cards.sort((a, b) => player.getUseValue(a, null, true) - player.getUseValue(b, null, true));
				return [cards.slice(0, 2), cards.slice(2)];
			});
			const { bool, moved } = await next.forResult();
			if (bool) {
				const puts = player.getCards("h", i => moved[0].includes(i)),
					gains = cards.filter(i => moved[1].includes(i));
				if (puts.length && gains.length) {
					player.$throw(puts, 1000);
					await player.lose(puts, ui.special);
					await player.gain(gains, "gain2");
				}
				const cardx = moved[0].slice();
				if (cardx.length) {
					await game.cardsGotoOrdering(cardx);
					await game.cardsGotoPile(cardx.slice().reverse(), "insert");
					game.updateRoundNumber();
				}
			}
		},
	},
	stdmingjian: {
		audio: "mingjian",
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		filterTarget: lib.filter.notMe,
		check(card) {
			return 7 - get.value(card);
		},
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const cards = event.cards,
				target = event.target;
			await player.showCards(cards, get.translation(player) + "发动了【明鉴】");
			await player.give(cards, target, true);
			await target
				.chooseToUse(
					function (card, player, event) {
						if (!get.event().cardx?.includes(card)) {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"明鉴：是否使用" + get.translation(cards) + "？"
				)
				.set("cardx", cards);
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					return target.getUseValue(ui.selected.cards[0]) + 1;
				},
			},
		},
	},
	//刘晔
	stdpolu: {
		audio: "polu",
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player) {
			return event.player.countDiscardableCards(player, "e");
		},
		async cost(event, trigger, player) {
			const { bool, links: cards } = await player
				.choosePlayerCard("e", trigger.player, get.prompt2(event.skill, trigger.player))
				.set("ai", button => {
					const target = get.event().getTrigger().player,
						player = get.player();
					if (get.attitude(player, target) <= 0) {
						return get.value(button.link) + 2;
					}
					if (player == target) {
						return 5 - get.value(button.link);
					}
					return 0;
				})
				.forResult();
			event.result = {
				bool: bool,
				cards: cards,
				targets: [trigger.player],
			};
		},
		async content(event, trigger, player) {
			const { targets, cards } = event;
			await targets[0].modedDiscard(cards, player);
			if (player == targets[0]) {
				await player.draw();
			}
		},
	},
	stdchoulve: {
		audio: "choulve",
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		filterTarget: lib.filter.notMe,
		check(card) {
			return 7 - get.value(card);
		},
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const cards = event.cards,
				target = event.target;
			await player.give(cards, target);
			const { bool, cards: cardx } = await target
				.chooseCard(`是否展示并交给${get.translation(player)}一张装备牌？`, "he")
				.set("filterCard", card => get.type(card) == "equip")
				.set("ai", card => {
					if (get.event().att <= 0) {
						return 0;
					}
					return 5 - get.value(card);
				})
				.set("att", get.attitude(target, player))
				.forResult();
			if (bool) {
				await target.showCards(cardx);
				await target.give(cardx, player);
			}
		},
		ai: {
			order: 7,
			result: {
				target: 1,
			},
		},
	},
	//郭皇后
	stdjiaozhao: {
		audio: "rejiaozhao",
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 1;
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (!target.countCards("h")) {
				return;
			}
			const result = await target.chooseCard("展示两张手牌", "h", 2, true).forResult();
			if (!result?.cards?.length) {
				return;
			}
			const { cards } = result;
			await target.showCards(cards);
			if (event.getParent(2).name == "stddanxin") {
				const result = await player
					.chooseButton(["是否选择其中一张牌获得？", cards])
					.set("ai", button => {
						if (button.link.name == "du") {
							return 0;
						}
						return get.value(button.link) + 1;
					})
					.forResult();
				if (result?.bool && result?.links?.length) {
					await player.gain(result.links, target, "giveAuto");
				}
			} else {
				if (!player.countCards("h")) {
					return;
				}
				const cardx = player.getCards("h").sort((a, b) => player.getUseValue(a) - player.getUseValue(b))[0];
				const result = await player
					.chooseButton(2, ["你的手牌", player.getCards("h"), `${get.translation(target)}展示的手牌`, cards])
					.set("filterButton", button => {
						const { player, cards } = get.event();
						if (!ui.selected.buttons.length) {
							return true;
						}
						let card = ui.selected.buttons[0].link;
						if (cards.includes(card)) {
							return !cards.includes(button.link);
						}
						return cards.includes(button.link);
					})
					.set("cards", cards)
					.set("cardx", cardx)
					.set("ai", button => {
						const { player, cards, cardx } = get.event();
						if (ui.selected.buttons.length) {
							return button.link == cardx;
						}
						if (!cards.includes(button.link)) {
							return 0;
						}
						if (player.getUseValue(button.link) > player.getUseValue(cardx)) {
							return 0;
						}
						return player.getUseValue(button.link) + 1;
					})
					.forResult();
				if (result?.bool && result?.links?.length) {
					const cards1 = result.links.filter(card => !cards.includes(card)),
						cards2 = result.links.filter(card => cards.includes(card));
					await player.swapHandcards(target, cards1, cards2);
				}
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					return get.attitude(player, target);
				},
			},
		},
	},
	stddanxin: {
		audio: "redanxin",
		trigger: { player: "damageEnd" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("filterTarget", (card, player, target) => {
					return target != player && target.countCards("h") > 1;
				})
				.set("ai", target => {
					return get.effect(target, { name: "shunshou_copy2" }, get.player(), get.player());
				})
				.forResult();
		},
		derivation: "stdjiaozhao",
		async content(event, trigger, player) {
			await player.useSkill("stdjiaozhao", event.targets);
		},
	},
	//吕范
	stddianfeng: {
		audio: "spdiancai",
		trigger: {
			player: ["loseAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		getIndex(event, player) {
			return game
				.filterPlayer(current => {
					let evt = event.getl(current);
					return evt?.es?.length > 0 && !current.countCards("e");
				})
				.sortBySeat();
		},
		logTarget(_1, _2, _3, target) {
			return target;
		},
		frequent: true,
		async content(event, trigger, player) {
			await player.draw();
		},
	},
};
