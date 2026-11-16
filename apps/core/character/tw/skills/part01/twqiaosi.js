import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twqiaosi" | "twbaizu">} */
export const groupSkills = {
	//袁谭
	twqiaosi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return get.info("twqiaosi").getCards(player).length;
		},
		check(event, player) {
			const cards = get.info("twqiaosi").getCards(player);
			if (cards.reduce((sum, card) => sum + get.value(card), 0)) {
				return false;
			}
			if (cards.length >= player.getHp() || cards.some(card => get.name(card, player) == "tao" || get.name(card, player) == "jiu")) {
				return true;
			}
			return player.getHp() > 2 && cards.length > 1;
		},
		prompt2(event, player) {
			const cards = get.info("twqiaosi").getCards(player);
			let str = "获得" + get.translation(cards);
			if (cards.length < player.getHp()) {
				str += "，然后你失去1点体力";
			}
			return str;
		},
		async content(event, trigger, player) {
			const cards = get.info("twqiaosi").getCards(player);
			await player.gain(cards, "gain2");
			if (cards.length < player.getHp()) {
				await player.loseHp();
			}
		},
		getCards(player) {
			let cards = [],
				targets = game.players.slice().concat(game.dead.slice());
			for (const target of targets) {
				if (target == player) {
					continue;
				}
				const history = target.getHistory("lose", evt => evt.position == ui.discardPile);
				if (history.length) {
					for (const evt of history) {
						cards.addArray(evt.cards2.filterInD("d"));
					}
				}
			}
			const historyx = game.getGlobalHistory("cardMove", evt => {
				if (evt.name != "cardsDiscard") {
					return false;
				}
				const evtx = evt.getParent();
				if (evtx.name != "orderingDiscard") {
					return false;
				}
				const evt2 = evtx.relatedEvent || evtx.getParent();
				const current = evt2.player;
				if (evt2.name == "phaseJudge" || current == player) {
					return false;
				}
				return current.hasHistory("lose", evtx3 => {
					const evtx4 = evtx3.relatedEvent || evtx3.getParent();
					if (evt2 != evtx4) {
						return false;
					}
					return evtx3.getl(current).cards2.length > 0;
				});
			});
			if (historyx.length) {
				for (const evtx of historyx) {
					cards.addArray(evtx.cards.filterInD("d"));
				}
			}
			return cards;
		},
	},
	twbaizu: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return (
				player.isDamaged() &&
				player.countCards("h") &&
				game.hasPlayer(target => {
					return target != player && target.countCards("h");
				}) &&
				player.getHp() + player.countMark("twbaizu_lizhan")
			);
		},
		locked: true,
		async cost(event, trigger, player) {
			const sum = player.getHp() + player.countMark("twbaizu_lizhan"),
				filterTarget = (_, player, target) => {
					return target != player && target.countCards("h");
				};
			let targets = game.filterPlayer(target => filterTarget(null, player, target));
			if (targets.length > sum) {
				targets = (
					await player
						.chooseTarget(
							"请选择【败族】的目标",
							"令你和这些角色同时弃置一张手牌，然后你对与你弃置牌类别相同的其他角色各造成1点伤害",
							filterTarget,
							sum,
							true
						)
						.set("ai", target => {
							const player = get.event().player;
							return get.effect(target, { name: "guohe_copy2" }, target, player) + get.damageEffect(target, player, player);
						})
						.forResult()
				).targets;
			}
			event.result = { bool: true, targets };
		},
		async content(event, trigger, player) {
			const targets = event.targets.slice().sortBySeat();
			player.line(targets);
			let list = [player].concat(targets).filter(target => target.countDiscardableCards(target, "h"));
			if (list.length) {
				let discards = [];
				const result = await player
					.chooseCardOL(
						list,
						"败族：请弃置一张手牌",
						(card, player) => {
							return lib.filter.cardDiscardable(card, player);
						},
						true
					)
					.set("ai", get.unuseful)
					.forResult();
				if (result) {
					for (let i = 0; i < result.length; i++) {
						discards.push([list[i], result[i].cards]);
					}
					await game.loseAsync({ lose_list: discards }).setContent("discardMultiple");
					list = list.filter(i => get.type2(result[0].cards[0]) == get.type2(result[list.indexOf(i)].cards[0]));
					if (list.length) {
						for (const i of list) {
							if (i === player) {
								continue;
							}
							player.line(i);
							await i.damage();
						}
					}
				}
			}
			player.when({ global: "phaseEnd" }).step(async () => {
				player.popup("历战");
				player.addMark("twbaizu_lizhan", 1, false);
				game.log(player, "触发了", "#g【败族】", "的", "#y历战", "效果");
			});
		},
		subSkill: {
			lizhan: {
				charlotte: true,
				onremove: true,
				marktext: "战",
				intro: { content: "【败族】目标选择数+#" },
			},
		},
	},
};
