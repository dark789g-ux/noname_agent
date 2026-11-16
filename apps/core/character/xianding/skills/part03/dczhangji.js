import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczhangji" | "dczengou">} */
export const groupSkills = {
	//清河公主
	dczhangji: {
		audio: 2,
		trigger: { global: "useCardToTargeted" },
		filter(event, player) {
			if (!event.targets || event.targets.length <= 1) {
				return false;
			}
			if (event.targets.length != event.getParent().triggeredTargets4.length) {
				return false;
			}
			return event.targets.includes(player);
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			const evtx = trigger.getParent();
			trigger.targets = [player, ...trigger.targets.remove(player)];
			evtx.targets = [player, ...evtx.targets.remove(player)];
			evtx.triggeredTargets4 = [player, ...evtx.triggeredTargets4.remove(player)];
			await player.draw(evtx.targets.length - 1);
		},
	},
	dczengou: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.maxHp > 0 && player.countCards("he") > 0;
		},
		filterCard: true,
		selectCard: () => [1, _status.event.player.maxHp],
		position: "he",
		filterTarget: lib.filter.notMe,
		discard: false,
		lose: false,
		delay: false,
		usable: 1,
		check(card) {
			if (card.name == "tao" || card.name == "jiu") {
				return 0;
			}
			return 1 / (get.value(card) || 0.5);
		},
		async content(event, trigger, player) {
			const next = player.give(event.cards, event.target);
			next.gaintag.add("dczengou_debuff");
			await next;
			await player.draw(event.cards.length);
			event.target.addSkill("dczengou_debuff");
		},
		ai: {
			order: 10,
			result: { target: -1 },
		},
		subSkill: {
			debuff: {
				charlotte: true,
				mark: true,
				intro: {
					content: "下次体力值增加或使用牌结算完毕后展示所有手牌，然后失去手牌中“谮构”牌数的体力值",
				},
				trigger: { player: ["changeHp", "useCardAfter"] },
				filter(event, player) {
					return event.name == "useCard" || event.changedHp > 0;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					await player.showHandcards();
					const cards = player.getCards("h", card => card.hasGaintag(event.name));
					player.removeSkill(event.name);
					if (cards.length) {
						await player.loseHp(cards.length);
					}
				},
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				mod: {
					aiValue(player, card, num) {
						if (get.itemtype(card) == "card" && card.hasGaintag("dczengou_debuff")) {
							return -1;
						}
					},
					aiUseful() {
						return lib.skill.dczengou.subSkill.debuff.mod.aiValue.apply(this, arguments);
					},
					aiOrder(player, card, num) {
						if (get.itemtype(card) == "card" && card.hasGaintag("dczengou_debuff")) {
							const cards = player.getCards("h", card => card.hasGaintag("dczengou_debuff"));
							if (cards.length == 1) {
								return num + 10;
							}
							return 0;
						}
					},
				},
			},
		},
	},
};
