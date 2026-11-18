import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jinhui" | "qingman">} */
export const groupSkills = {
	//赵嫣
	jinhui: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		manualConfirm: true,
		async content(event, trigger, player) {
			/** @type { Card[] } */
			const cards = [];
			while (cards.length < 3) {
				const card = get.cardPile2(card => {
					if (cards.some(cardx => cardx.name == card.name)) {
						return false;
					}
					const info = get.info(card, false);
					if (info.ai && info.ai.tag && info.ai.tag.damage) {
						return false;
					}
					return !info.notarget && (info.toself || info.singleCard || !info.selectTarget || info.selectTarget == 1);
				});
				if (card) {
					cards.push(card);
				} else {
					break;
				}
			}
			if (!cards.length) {
				return;
			}

			await player.showCards(cards, `${get.translation(player)}发动了【锦绘】`);
			await game.cardsGotoOrdering(cards);
			if (!game.hasPlayer(current => current !== player)) {
				return;
			}

			let result = await player
				.chooseTarget({
					prompt: "选择【锦绘】的目标",
					filterTarget: lib.filter.notMe,
					forced: true,
					ai(target) {
						const event = get.event();
						const cards = event.getParent().cards.slice(0);

						let max_effect = 0;
						let max_effect_player = 0;
						for (const card of cards) {
							const targetx = lib.skill.jinhui.getUsableTarget(card, target, player);
							if (targetx) {
								const effect2 = get.effect(targetx, card, target, target);
								const effect3 = get.effect(targetx, card, target, player);
								if (effect2 > max_effect) {
									max_effect = effect2;
									max_effect_player = effect3;
								}
							}
						}
						return max_effect_player;
					},
				})
				.forResult();
			if (!result?.bool || !result.targets?.length) {
				return;
			}

			const target = result.targets[0];
			player.line(target, "green");

			const targetCards = cards.filter(card => lib.skill.jinhui.getUsableTarget(card, target, player));
			if (targetCards.length) {
				if (targetCards.length == 1) {
					result = { bool: true, links: targetCards };
				} else {
					result = await target
						.chooseButton({
							createDialog: ["选择按“锦绘”规则使用一张牌", targetCards],
							forced: true,
							ai(button) {
								const event = get.event();
								const player = get.player();
								const target = event.getParent().player;
								const card = button.link;

								const targetx = lib.skill.jinhui.getUsableTarget(card, player, target);
								const effect = get.effect(targetx, card, player, player);
								const cards = event.getParent().cards.slice(0);
								let effect2 = 0;
								let effect3 = 0;
								cards.remove(button.link);
								for (const card of cards) {
									const targetx2 = lib.skill.jinhui.getUsableTarget(card, target, player);
									if (targetx2) {
										effect2 += get.effect(targetx2, card, target, target);
										effect3 += get.effect(targetx2, card, target, player);
									}
								}
								if (effect2 > 0) {
									effect += effect3;
								}
								return effect;
							},
						})
						.forResult();
				}
				if (result?.bool) {
					const card = result.links[0];
					cards.remove(card);
					const targetx = lib.skill.jinhui.getUsableTarget(card, target, player);
					await target.useCard({
						card,
						targets: [targetx],
						addCount: false,
						noai: true,
					});
				}
			}

			const selfCards = cards.filter(card => lib.skill.jinhui.getUsableTarget(card, player, target));
			while (selfCards.length) {
				result = await player
					.chooseButton({
						createDialog: ["是否按“锦绘”规则使用其中一张牌？", selfCards],
						ai(button) {
							const { player, target } = get.event();
							const card = button.link;
							const targetx = lib.skill.jinhui.getUsableTarget(card, player, target);
							return get.effect(targetx, card, player, player);
						},
					})
					.set("target", target)
					.forResult();

				if (!result?.bool) {
					return;
				}
				const card = result.links[0];
				selfCards.remove(card);
				const targetx = lib.skill.jinhui.getUsableTarget(card, player, target);
				if (targetx) {
					await player.useCard({
						card,
						targets: [targetx],
						addCount: false,
						noai: true,
					});
				}
			}
		},
		getUsableTarget(card, player, target) {
			const info = get.info(card, false);
			if (info.toself) {
				return player.canUse(card, player, false) ? player : false;
			}
			return target?.isIn() && player.canUse(card, target, false) ? target : false;
		},
		ai: {
			order: 5,
			result: { player: 1 },
		},
	},
	qingman: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		forced: true,
		logTarget: "player",
		filter(event, player) {
			if (!event.player.isIn()) {
				return false;
			}
			var num = player.countCards("h");
			if (num >= 5) {
				return false;
			}
			var num2 = 0;
			for (var i = 1; i <= 5; i++) {
				num2 += event.player.countEmptySlot(i);
			}
			return num < num2;
		},
		async content(event, trigger, player) {
			var num2 = 0;
			for (var i = 1; i <= 5; i++) {
				num2 += trigger.player.countEmptySlot(i);
			}
			player.drawTo(num2);
		},
	},
};
