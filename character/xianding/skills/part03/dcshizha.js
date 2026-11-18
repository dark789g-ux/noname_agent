import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshizha" | "dcgaojian" | "old_dcshizha" | "old_dcgaojian">} */
export const groupSkills = {
	//谋汉尼拔
	dcshizha: {
		audio: 2,
		usable: 1,
		trigger: { global: "changeHpAfter" },
		check: () => true,
		async content(event, trigger, player) {
			const cards = get.cards(3, true);
			await player.viewCards("牌堆顶三张牌", cards);
			const result = await player
				.chooseCardButton(`识诈：获得其中一张牌并秘密记录牌名`, true, cards)
				.set("ai", button => {
					const { player } = get.event();
					if (!player.getStorage("dcshizha_effect").includes(get.name(button.link))) {
						return get.buttonValue(button) + 2;
					}
					return get.buttonValue(button);
				})
				.forResult();
			const { links } = result;
			if (links?.length) {
				const [card] = links;
				game.log(player, "获得一张牌");
				player.addTempSkill(`${event.name}_effect`, "roundEnd");
				player.markAuto(`${event.name}_effect`, card.name);
				await player.gain(card, "draw");
			}
		},
		subSkill: {
			effect: {
				audio: "dcshizha",
				charlotte: true,
				onremove: true,
				intro: {
					content(storage, player, skill) {
						if (player.isUnderControl(true)) {
							return `已记录：${get.translation(storage)}`;
						} else {
							return `已记录${storage?.length || 0}个牌名`;
						}
					},
				},
				trigger: {
					global: "useCard",
				},
				filter(event, player) {
					return player.getStorage("dcshizha_effect").includes(event.card.name);
				},
				direct: true,
				async content(event, trigger, player) {
					const { card, targets, player: target } = trigger;
					player.unmarkAuto(event.name, card.name);
					let eff = 0;
					if (card.name == "wuxie" || card.name == "shan") {
						if (get.attitude(player, target) < -1) {
							eff = -1;
						}
					} else if (targets && targets.length) {
						for (let i = 0; i < targets.length; i++) {
							eff += get.effect(targets[i], card, target, player);
						}
					}
					const result = await player
						.chooseBool(`识诈：是否令${get.translation(card)}无效`)
						.set("choice", eff < 0)
						.forResult();
					if (result?.bool) {
						player.logSkill("dcshizha", target);
						game.log(card, "被无效了");
						trigger.all_excluded = true;
						trigger.targets.length = 0;
					}
				},
			},
		},
	},
	dcgaojian: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		async content(event, trigger, player) {
			const { target } = event;
			const cards = [];
			do {
				const card = get.cards(1, true)[0];
				cards.push(card);
				await target.showCards(card, void 0, true);
				if (get.is.damageCard(card)) {
					await target.damage(cards.length, "fire");
					break;
				}
				let result;
				if (cards.length > game.players.length) {
					result = { index: 1 };
				} else {
					result = await target
						.chooseControl()
						.set("prompt", "告谏：请选择一项")
						.set("choice", Math.random() > 0.2 ? 1 : 0)
						.set("choiceList", [`获得${get.translation(card)}并再次亮牌`, `直至其回合结束其攻击范围-${cards.length}`])
						.forResult();
				}
				if (result.index == 0) {
					if (get.position(card, true) == "o") {
						await target.gain(card, "gain2");
					}
				} else {
					target.addTempSkill(`${event.name}_attackRange`, { player: "phaseAfter" });
					target.addMark(`${event.name}_attackRange`, cards.length, false);
					break;
				}
			} while (target.isIn());
		},
		ai: {
			order: 7,
			result: {
				target: -1,
			},
		},
		subSkill: {
			attackRange: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/attackRange.png",
				intro: {
					markcount: storage => -storage,
					content: "攻击范围-#",
				},
				mod: {
					attackRange(player, num) {
						return num - player.countMark("dcgaojian_attackRange");
					},
				},
			},
		},
	},
	old_dcshizha: {
		audio: "dcshizha",
		trigger: { global: "useCard" },
		usable: 1,
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			let history = game.getGlobalHistory("everything");
			for (let i = history.length - 1; i >= 0; i--) {
				const evt = history[i];
				if (evt == event || evt.player != event.player) {
					continue;
				}
				if (evt.name == "useCard") {
					return false;
				}
				if (evt.name == "changeHp" && evt.num != 0) {
					return true;
				}
			}
			return false;
		},
		check(event, player) {
			let eff = 0;
			if (event.card.name == "wuxie" || event.card.name == "shan") {
				if (get.attitude(player, event.player) < -1) {
					eff = -1;
				}
			} else if (event.targets && event.targets.length) {
				for (var i = 0; i < event.targets.length; i++) {
					eff += get.effect(event.targets[i], event.card, event.player, player);
				}
			}
			return eff < 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.targets.length = 0;
			trigger.all_excluded = true;
			if (trigger.cards?.someInD()) {
				await player.gain(trigger.cards.filterInD(), "gain2");
			}
		},
	},
	old_dcgaojian: {
		audio: "dcgaojian",
		trigger: {
			global: "cardsDiscardAfter",
		},
		filter(event, player) {
			if (!player.isPhaseUsing()) {
				return false;
			}
			var evt = event.getParent();
			if (evt.name != "orderingDiscard") {
				return false;
			}
			var evtx = evt.relatedEvent || evt.getParent();
			return evtx.name == "useCard" && evtx.player == player && get.type2(evtx.card) == "trick";
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					return get.attitude(get.player(), target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			let showCards = [],
				useCard;
			while (showCards.length < 5) {
				const cards = game.cardsGotoOrdering(get.cards()).cards;
				showCards.addArray(cards);
				target.showCards(cards, get.translation(player) + "发动了【告谏】");
				if (get.type2(cards[0]) == "trick") {
					useCard = cards[0];
					break;
				}
			}
			const goon1 = useCard && target.hasUseTarget(useCard);
			const goon2 = showCards.length > 0 && target.countCards("h") > 0;
			if (!goon1 && !goon2) {
				return;
			}
			let resultx;
			if (!goon1) {
				resultx = { control: "交换牌" };
			} else if (!goon2) {
				resultx = { control: "使用牌" };
			} else {
				resultx = await target
					.chooseControl("使用牌", "交换牌")
					.set("choiceList", [`使用${get.translation(useCard)}`, `使用任意张手牌与${get.translation(showCards)}中的等量牌交换`])
					.set("ai", () => {
						if (_status.event.useValue > 2) {
							return "使用牌";
						}
						return "交换牌";
					})
					.set("useValue", target.getUseValue(useCard))
					.forResult();
			}
			if (resultx.control == "使用牌") {
				await target.chooseUseTarget(useCard, true);
			} else {
				const result = await target
					.chooseToMove("告谏：是否交换其中任意张牌？")
					.set("list", [
						["你的手牌", target.getCards("h"), "old_dcgaojian_tag"],
						["展示牌", showCards],
					])
					.set("filterMove", (from, to) => {
						return typeof to != "number";
					})
					.set("selectionSpec", { move: "swap" })
					.set("filterOk", moved => {
						return moved[1].some(card => get.owner(card));
					})
					.set("processAI", list => {
						const num = Math.min(list[0][1].length, list[1][1].length);
						const cards1 = list[0][1].slice().sort((a, b) => get.value(a, "raw") - get.value(b, "raw"));
						const cards2 = list[1][1].slice().sort((a, b) => get.value(b, "raw") - get.value(a, "raw"));
						return [cards1.slice().addArray(cards2.slice(0, num)), cards2.slice().addArray(cards1.slice(0, num))];
					})
					.forResult();
				if (result.bool) {
					const lose = result.moved[1].slice();
					const gain = result.moved[0].slice().filter(i => !get.owner(i));
					if (lose.some(i => get.owner(i))) {
						await target.lose(
							lose.filter(i => get.owner(i)),
							ui.special
						);
					}
					await game.cardsGotoPile(lose.reverse(), "insert");
					game.updateRoundNumber();
					if (gain.length) {
						await target.gain(gain, "draw");
					}
				} else {
					if (!showCards.length) {
						return;
					}
					await game.cardsGotoPile(showCards.slice().reverse(), "insert");
					game.updateRoundNumber();
				}
			}
		},
	},
};
