import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olliyong">} */
export const groupSkills = {
	//OL武庙第一人
	olliyong: {
		audio: 2,
		enable: "phaseUse",
		onChooseToUse(event) {
			if (!game.online && event.type === "phase" && !event.olliyong_suits) {
				const player = event.player;
				event.set(
					"olliyong_suits",
					player
						.getHistory("useCard")
						.map(evt => get.suit(evt.card))
						.unique()
				);
				if (event.olliyong_suits.length) {
					event.olliyong_suits.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
					player.addTip("olliyong", get.translation("olliyong") + event.olliyong_suits.reduce((str, i) => str + get.translation(i), ""), "phaseUseAfter");
				}
			}
		},
		filter(event, player) {
			return player.hasCard(card => get.info?.("olliyong")?.filterCardx(card, player), "hes");
		},
		selectCard() {
			const player = get.player();
			if (!player.storage["olliyong"]) {
				return [1, 1];
			}
			return [-1, -1];
		},
		filterCardx(card, player) {
			const suits = get.event().olliyong_suits;
			if (!player.storage["olliyong"]) {
				if (suits?.includes(get.suit(card))) {
					return false;
				}
				return game.hasPlayer(target => player.canUse(get.autoViewAs({ name: "juedou" }, [card]), target));
			}
			return game.hasPlayer(target => target.canUse(new lib.element.VCard({ name: "juedou", isCard: true }), player));
		},
		filterCard(card, player) {
			const suits = get.event().olliyong_suits;
			if (!player.storage["olliyong"]) {
				if (suits?.includes(get.suit(card))) {
					return false;
				}
				return game.hasPlayer(target => player.canUse(get.autoViewAs({ name: "juedou" }, [card]), target));
			}
			return false;
		},
		filterTarget(孩子们这就是武庙, player, target) {
			if (!player.storage["olliyong"]) {
				return player.canUse(get.autoViewAs({ name: "juedou" }, ui.selected.cards), target);
			}
			return target.canUse(new lib.element.VCard({ name: "juedou", isCard: true }), player);
		},
		position: "hes",
		check(card) {
			const player = get.player();
			if (!player.storage["olliyong"]) {
				return player.getUseValue(get.autoViewAs({ name: "juedou" }, [card]));
			}
			return 1 / (get.value(card) || 0.5);
		},
		complexSelect: true,
		prompt() {
			return get.info("olliyong").intro.content(get.player().storage["olliyong"]);
		},
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
			} = event;
			player.changeZhuanhuanji(event.name);
			if (player.storage[event.name]) {
				await player.useCard(get.autoViewAs({ name: "juedou" }, cards), target).set("cards", cards);
			} else {
				const suits = event.getParent("chooseToUse").olliyong_suits;
				const card = get.cardPile2(c => suits.includes(get.suit(c)));
				if (card) {
					await player.gain(card, "gain2");
				}
				await game.delay(0.5);
				await target.useCard(new lib.element.VCard({ name: "juedou", isCard: true }), player, "noai");
			}
		},
		mark: true,
		marktext: "☯",
		zhuanhuanji: true,
		intro: {
			content(storage) {
				if (storage) {
					return "出牌阶段，你可以从牌堆中获得一张你本回合使用过的花色的牌，令一名角色视为对你使用【决斗】";
				}
				return "出牌阶段，你可以将一张你本回合未使用过的花色的牌当作【决斗】使用";
			},
		},
		onremove(player, skill) {
			player.removeTip(skill);
		},
		ai: {
			order: 10,
			result: {
				player(player, target) {
					const cards = ui.selected.cards;
					if (!player.storage["olliyong"]) {
						return get.effect(target, get.autoViewAs({ name: "juedou" }, cards), player, player);
					}
					return get.effect(player, new lib.element.VCard({ name: "juedou", isCard: true }), target, player);
				},
			},
		},
	},
};
