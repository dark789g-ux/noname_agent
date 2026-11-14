import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "new_jiangchi3" | "xinfu_jijie" | "xinfu_jiyuan">} */
export const variantSupportSkills = {
	new_jiangchi3: {
		mod: {
			cardEnabled(card) {
				if (card.name === "sha") {
					return false;
				}
			},
			cardRespondable(card) {
				if (card.name === "sha") {
					return false;
				}
			},
			ignoredHandcard(card, player) {
				if (get.name(card) === "sha") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name === "phaseDiscard" && get.name(card) === "sha") {
					return false;
				}
			},
		},
	},
	xinfu_jijie: {
		selectionSpec: true,
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		async content(event, trigger, player) {
			const card = get.bottomCards()[0];
			game.cardsGotoOrdering(card);
			event.card = card;
			const { bool, targets } = await player
				.chooseTarget({
					forced: true,
					ai(target) {
						let att = get.attitude(_status.event.player, target);
						if (_status.event.du) {
							if (target.hasSkillTag("nodu")) {
								return 0.5;
							}
							return -att;
						}
						if (att > 0) {
							if (_status.event.player != target) {
								att += 2;
							}
							return att + Math.max(0, 5 - target.countCards("h"));
						}
						return att;
					},
				})
				.set("du", event.card.name === "du")
				.set("createDialog", ["机捷：选择一名角色获得此牌", [card]])
				.forResult();
			if (bool && targets?.length) {
				const target = targets[0];
				player.line(target, "green");
				const gainEvent = target.gain({
					cards: [card],
					animate: "draw",
				});
				gainEvent.giver = player;
				await gainEvent;
			}
		},
		ai: {
			order: 7.2,
			result: {
				player: 1,
			},
		},
	},
	xinfu_jiyuan: {
		trigger: {
			global: ["dying", "gainAfter", "loseAsyncAfter"],
		},
		audio: 2,
		getIndex(event, player) {
			if (event.name !== "loseAsync") {
				return [event.player];
			} else {
				return game.filterPlayer(current => current !== player && event.getg(current).length > 0).sortBySeat();
			}
		},
		filter(event, player, triggername, target) {
			if (!target?.isIn()) {
				return false;
			}
			if (event.name === "dying") {
				return true;
			}
			if (event.giver !== player) {
				return false;
			}
			if (event.name === "gain") {
				return event.player != player && event.getg(target).length > 0;
			}
			return game.hasPlayer(current => current != player && event.getg(current).length > 0);
		},
		logTarget(event, player, triggername, target) {
			return target;
		},
		check(event, player, triggername, target) {
			return get.attitude(player, target) > 0;
		},
		async content(event, trigger, player) {
			await event.targets[0].draw();
		},
	},
};
