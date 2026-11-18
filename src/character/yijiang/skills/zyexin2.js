import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zyexin2" | "zzili" | "zpaiyi">} */
export const groupSkills = {
	zyexin2: {
		enable: "phaseUse",
		usable: 1,
		lose: false,
		discard: false,
		delay: false,
		selectCard: [1, Infinity],
		filterCard: true,
		sourceSkill: "zyexin",
		filter(event, player) {
			return player.getExpansions("zyexin").length > 0;
		},
		prompt: "用任意数量的手牌与等量的“权”交换",
		async content(event, trigger, player) {
			const { cards } = event;
			await player.addToExpansion({
				cards,
				animate: "give",
				source: player,
				gaintag: ["zyexin"],
			});
			const result = await player
				.chooseCardButton({
					prompt: "选择" + get.cnNumber(cards.length) + "张牌作为手牌",
					cards: player.getExpansions("zyexin"),
					select: cards.length,
					forced: true,
					ai(button) {
						return get.value(button.link);
					},
				})
				.forResult();
			await player.gain(result.links, "gain2");
		},
		ai: {
			order: 5,
			result: {
				player: 1,
			},
		},
	},
	zzili: {
		skillAnimation: true,
		juexingji: true,
		derivation: "zpaiyi",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.getExpansions("zyexin").length >= 4;
		},
		forced: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp();
			await player.addSkills("zpaiyi");
		},
		ai: { combo: "zyexin" },
	},
	zpaiyi: {
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			return player.getExpansions("zyexin").length;
		},
		async cost(event, trigger, player) {
			let result = await player
				.chooseCardButton({
					prompt: get.prompt("zpaiyi"),
					cards: player.getExpansions("zyexin"),
					ai(button) {
						return get.value(button.link);
					},
				})
				.forResult();

			if (!result.bool || !result.links?.length) {
				event.result = { bool: false };
				return;
			}

			const cards = result.links;

			result = await player
				.chooseTarget({
					selectTarget(card, player, target) {
						card = get.event().card;
						const type = get.type(card);
						switch (type) {
							case "basic":
							case "trick":
								return true;
							case "delay":
								return target.canAddJudge(card);
							case "equip":
								return target.canEquip(card, true);
						}
						return true;
					},
					ai(target) {
						const { player, card } = get.event();
						return get.effect(target, card, player, player);
					},
				})
				.set("card", cards[0])
				.forResult();

			if (!result.bool || !result.targets?.length) {
				event.result = { bool: false };
				return;
			}

			const targets = result.targets;

			event.result = {
				bool: true,
				cards,
				targets,
			};
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const { cards, targets } = event;
			const card = cards[0];
			const target = targets[0];

			switch (type) {
				case "basic":
				case "trick":
					await player.give(card, target, "give");
					break;
				case "delay":
					player.$give(card, target, false);
					await target.addJudge(card);
					break;
				case "equip":
					player.$give(card, target, false);
					await target.equip(card);
					break;
			}

			if (player === target) {
				return;
			}

			const result = await player.chooseBool({ prompt: "是否摸一张牌？" }).forResult();
			if (result.bool) {
				await player.draw();
			}
		},
		ai: {
			combo: "zyexin",
		},
	},
};
