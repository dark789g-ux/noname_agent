import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbronghuo" | "dcsbyingmou">} */
export const groupSkills = {
	//周瑜
	//无 双 万 军 取 首
	dcsbronghuo: {
		audio: 2,
		audioname: ["dc_sb_zhouyu_shadow"],
		trigger: { player: "useCard" },
		filter(event, player) {
			return (event.card.name == "sha" && game.hasNature(event.card, "fire")) || event.card.name == "huogong";
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.baseDamage += game.countGroup();
		},
		ai: { threaten: 3.5 },
		group: ["dcsbronghuo_target"],
		subSkill: {
			target: {
				audio: "dcsbronghuo",
				forced: true,
				trigger: {
					global: "damageEnd",
				},
				filter(event, player) {
					return event.hasNature("fire");
				},
				async content(event, trigger, player) {
					player.addTempSkill("dcsbronghuo_effect", { player: "dieAfter" });
				},
			},
			effect: {
				charlotte: true,
				mark: true,
				intro: {
					content: "下一次使用火【杀】或【火攻】可以额外指定1个目标",
				},
				forced: true,
				popup: false,
				trigger: {
					player: "useCard2",
				},
				filter(event, player) {
					return get.info("dcsbronghuo").filter(event, player);
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					const { targets, card } = trigger;
					const targetsx = game.filterPlayer(target => !targets.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target));
					if (targets?.length) {
						const result = await player
							.chooseTarget({
								prompt: `融火：你可以为${get.translation(card)}增加1名目标`,
								filterTarget(card, player, target) {
									return get.event().targets.includes(target);
								},
								ai(target) {
									return get.effect(target, get.event().card, get.player(), get.player());
								},
							})
							.set("targets", targetsx)
							.set("card", card)
							.forResult();
						if (result?.bool) {
							const { targets } = result;
							player.logSkill("dcsbronghuo", targets);
							game.log(targets, "成为了", card, "的额外目标");
							trigger.targets.addArray(targets);
						}
					}
				},
			},
		},
	},
	dcsbyingmou: {
		mark: true,
		marktext: "☯",
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			player.changeSkin({ characterName: "dc_sb_zhouyu" }, "dc_sb_zhouyu" + (player.storage[skill] ? "_shadow" : ""));
		},
		intro: {
			content(storage) {
				return "每回合限一次，当你对其他角色使用牌后，你可以选择其中一名目标角色，" + (storage ? "令一名手牌数为全场最大的角色对其使用手牌中所有的【杀】和伤害类锦囊牌（若其没有可使用的牌则将手牌数弃至与你相同）。" : "你将手牌数摸至与其相同（至多摸五张），然后视为对其使用一张【火攻】。");
			},
		},
		audio: 2,
		audioname: ["dc_sb_zhouyu_shadow"],
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			return event.targets?.some(target => target != player && target.isIn());
		},
		usable: 1,
		async cost(event, trigger, player) {
			const { targets } = trigger;
			const skillName = event.name.slice(0, -5);
			const storage = player.storage[skillName];
			let next;
			if (storage) {
				next = player
					.chooseCardTarget({
						prompt: get.prompt(skillName),
						prompt2: "选择一名目标角色，令一名手牌数为全场最大的角色对其使用手牌中所有的【杀】和伤害类锦囊牌（若其没有可使用的牌则将手牌数弃至与你相同）",
						filterTarget(card, player, target) {
							if (!ui.selected.targets.length) {
								return _status.event.targets.includes(target);
							}
							return target.isMaxHandcard();
						},
						selectTarget: 2,
						complexSelect: true,
						complexTarget: true,
						multitarget: true,
						targetprompt: ["目标角色", "使用角色"],
						filterCard: () => false,
						selectCard: -1,
						ai2(target) {
							const player = get.player();
							const getNum = (player, target, source) => {
								return player
									.getCards("h", card => {
										if (get.name(card) != "sha" && (get.type(card) != "trick" || !get.tag(card, "damage"))) {
											return false;
										}
										return player.canUse(card, target, false);
									})
									.reduce((sum, card) => sum + get.effect(target, card, player, source), 0);
							};
							if (!ui.selected.targets.length) {
								const targets = game.filterPlayer(target => target.isMaxHandcard());
								targets.sort((a, b) => getNum(b, target, player) - getNum(a, target, player));
								return getNum(targets[0], target, player) + 1;
							}
							return getNum(target, ui.selected.targets[0], player) + 1;
						},
					})
					.set("targets", targets);
			} else {
				next = player
					.chooseTarget(get.prompt(skillName), "选择一名目标角色，将手牌数摸至与其相同，然后视为对其使用一张【火攻】", (card, player, target) => _status.event.targets.includes(target))
					.set("ai", target => {
						const player = get.player();
						return Math.max(0, Math.min(5, target.countCards("h") - player.countCards("h"))) * 2 + get.effect(target, { name: "huogong" }, player, player);
					})
					.set("targets", targets);
			}
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const { targets, name: skillName } = event;
			player.changeZhuanhuanji(skillName);
			const target = targets[0];
			let bool = false;
			if (!player.storage[skillName]) {
				player.line2(targets);
				let source = targets[1],
					discard = true;
				while (true) {
					const cards = source.getCards("h", card => {
						return get.name(card) == "sha" || (get.type(card) == "trick" && get.tag(card, "damage"));
					});
					if (cards.length) {
						if (discard) {
							discard = false;
						}
						let card = cards.filter(cardx => source.canUse(cardx, target, false)).randomGet();
						if (card) {
							const next = source.useCard(card, target, false);
							await next;
							if (target.hasHistory("damage", evt => evt.card == next.card)) {
								bool = true;
							}
						}
					} else {
						break;
					}
				}
				if (discard && player.countCards("h") < source.countCards("h")) {
					await source.chooseToDiscard(source.countCards("h") - player.countCards("h"), "h", true, "allowChooseAll");
				}
			} else {
				if (player.countCards("h") < target.countCards("h")) {
					await player.draw(Math.min(5, target.countCards("h") - player.countCards("h")));
				}
				if (player.canUse({ name: "huogong" }, target, false)) {
					const next = player.useCard({ name: "huogong" }, target, false);
					await next;
					if (target.hasHistory("damage", evt => evt.card == next.card)) {
						bool = true;
					}
				}
			}
			if (!bool) {
				player.line(target, "fire");
				await target.damage("fire");
			}
		},
		group: "dcsbyingmou_change",
		subSkill: {
			change: {
				audio: "dcsbyingmou",
				audioname: ["dc_sb_zhouyu_shadow"],
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				prompt2(event, player) {
					return "切换【英谋】为状态" + (player.storage.dcsbyingmou ? "阳" : "阴");
				},
				check: () => Math.random() > 0.5,
				content() {
					player.changeZhuanhuanji("dcsbyingmou");
				},
			},
		},
	},
};
