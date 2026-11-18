import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcqingleng" | "dczhendu">} */
export const groupSkills = {
	//董絮
	dcqingleng: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return event.card.color == "black" && !get.is.convertedCard(event.card);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.countDiscardableCards(player, "he");
				})
				.set("ai", target => get.effect(target, { name: "guohe_copy2" }, get.player(), get.player()))
				.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			const result = await player.discardPlayerCard(target, "he", true).forResult();
			if (result?.cards?.length) {
				const [card] = result.cards;
				if (get.type(card) == "equip") {
					trigger.getParent().excluded.add(player);
					//trigger.triggeredTargets4.remove(player);
				} else if (["basic", "trick"].includes(get.type(trigger.card))) {
					const resultx = await player
						.chooseBool({
							prompt: `是否令你下次〖酖毒〗使用牌可以视为使用${get.translation(trigger.card)}`,
							choice: player.hasValueTarget(trigger.card, false, false),
						})
						.forResult();
					if (resultx?.bool) {
						player.markAuto("dczhendu_effect", get.autoViewAs(trigger.card));
					}
				}
			}
		},
	},
	dczhendu: {
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		filter(event, player) {
			return player.countCards("he", card => ["basic", "trick"].includes(get.type(card, player)));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), [1, 5], (card, player) => {
					return ["basic", "trick"].includes(get.type(card, player));
				})
				.set("ai", card => {
					return get.player().hasValueTarget(card, false, false);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			await player.showCards(cards, `${get.translation(player)}发动了【酖毒】`);
			player.addSkill(event.name + "_effect");
			player.markAuto(
				event.name + "_effect",
				cards.map(card => get.autoViewAs(card))
			);
		},
		subSkill: {
			effect: {
				audio: "dczhendu",
				trigger: { player: "phaseBegin" },
				onremove: true,
				forced: true,
				charlotte: true,
				filter(event, player) {
					return player.getStorage("dczhendu_effect").length > 0;
				},
				async content(event, trigger, player) {
					const cards = player.getStorage(event.name).slice();
					player.removeSkill(event.name);
					player.addTempSkill("dczhendu_draw");
					while (
						cards.some(card => {
							if (!["basic", "trick"].includes(get.type(card))) {
								return false;
							}
							const cardx = {
								name: card.name,
								nature: card.nature,
								suit: card.suit,
								number: card.number,
								isCard: true,
							};
							return player.hasUseTarget(cardx, false, false);
						})
					) {
						const result = await player
							.chooseButton({
								createDialog: [`酖毒：你可以视为使用其中一张牌`, [cards, "vcard"]],
								ai(button) {
									const player = get.player();
									const card = button.link;
									const cardx = {
										name: card.name,
										nature: card.nature,
										suit: card.suit,
										number: card.number,
										isCard: true,
									};
									return player.getUseValue(cardx);
								},
								filterButton(button) {
									const player = get.player();
									const card = button.link;
									const cardx = {
										name: card.name,
										nature: card.nature,
										suit: card.suit,
										number: card.number,
										isCard: true,
									};
									return ["basic", "trick"].includes(get.type(card)) && player.hasUseTarget(cardx, false, false);
								},
							})
							.forResult();
						if (result?.links?.length) {
							const [card] = result.links;
							cards.remove(card);
							const VCard = {
								name: card.name,
								nature: card.nature,
								suit: card.suit,
								number: card.number,
								isCard: true,
							};
							await player.chooseUseTarget(VCard, true, false, "nodistance");
						} else {
							break;
						}
					}
					player.removeSkill("dczhendu_draw");
				},
				intro: {
					mark(dialog, storage, player) {
						dialog.add([storage, "vcard"]);
					},
				},
			},
			draw: {
				audio: "dczhendu",
				forced: true,
				charlotte: true,
				trigger: { global: ["recoverEnd", "damageEnd"] },
				async content(event, trigger, player) {
					const next = player.draw();
					next.gaintag.add("dczhendu_handcard");
					player.addTempSkill("dczhendu_handcard");
					await next;
				},
			},
			handcard: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("dczhendu_handcard")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("dczhendu_handcard")) {
							return false;
						}
					},
				},
			},
		},
	},
};
