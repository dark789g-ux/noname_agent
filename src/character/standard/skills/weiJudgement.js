import { guicaiCostSpec } from "./selectionSpecs.js";
import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "guicai" | "ganglie" | "ganglie_three" | "tuxi" | "luoyi" | "luoyi2" | "tiandu">} */
export const weiJudgementSkills = {
	guicai: {
		audio: 2,
		audioname2: { xin_simayi: "jilue_guicai" },
		trigger: { global: "judge" },
		preHidden: true,
		filter(event, player) {
			return player.hasCards(get.mode() === "guozhan" ? "hes" : "hs");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard({
					prompt: `${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`,
					filterCard(card) {
						const player = get.player();
						const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
						if (mod2 !== "unchanged") {
							return !!mod2;
						}
						const mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
						if (mod !== "unchanged") {
							return !!mod;
						}
						return true;
					},
					position: get.mode() === "guozhan" ? "hes" : "hs",
					ai(card) {
						const trigger = get.event().getTrigger();
						const { player, judging } = get.event();
						const result = trigger.judge(card) - trigger.judge(judging);
						const attitude = get.attitude(player, trigger.player);
						let val = get.value(card);
						if (get.subtype(card) == "equip2") {
							val /= 2;
						} else {
							val /= 4;
						}
						if (attitude == 0 || result == 0) {
							return 0;
						}
						if (attitude > 0) {
							return result - val;
						}
						return -result - val;
					},
				})
				.set("selectionSpec", guicaiCostSpec)
				.set("judging", trigger.player.judging[0])
				.setHiddenSkill(event.skill)
				.forResult();
		},
		//技能的logSkill跟着打出牌走 不进行logSkill
		popup: false,
		async content(event, trigger, player) {
			const next = player.respond({
				cards: event.cards,
				skill: event.name,
				highlight: true,
				noOrdering: true,
			});
			await next;
			const { cards } = next;
			if (cards?.length) {
				if (trigger.player.judging[0].clone) {
					trigger.player.judging[0].clone.classList.remove("thrownhighlight");
					game.broadcast(card => {
						if (card.clone) {
							card.clone.classList.remove("thrownhighlight");
						}
					}, trigger.player.judging[0]);
					game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
				}
				await game.cardsDiscard(trigger.player.judging[0]);
				trigger.player.judging[0] = cards[0];
				trigger.orderingCards.addArray(cards);
				game.log(trigger.player, "的判定牌改为", cards);
				await game.delay(2);
			}
		},
		ai: {
			rejudge: true,
			tag: { rejudge: 1 },
		},
	},
	ganglie: {
		audio: 2,
		trigger: { player: "damageEnd" },
		check(event, player) {
			if (!event.source?.isIn()) {
				return Math.random() < 0.5;
			}
			return get.attitude(player, event.source) <= 0;
		},
		prompt2(event, player) {
			let str = "你可以判定。";
			if (event.source?.isIn()) {
				str += `若结果不为红桃，则${get.translation(event.source)}须弃置两张手牌，否则其受到来自你的1点伤害。`;
			}
			return str;
		},
		async content(event, trigger, player) {
			const { source } = trigger;
			let result = await player
				.judge({
					judge(card) {
						if (get.suit(card) === "heart") {
							return -2;
						}
						return 2;
					},
					judge2(result) {
						return result.bool;
					},
				})
				.forResult();
			if (!result?.bool || !source?.isIn()) {
				return;
			}
			result =
				source.countDiscardableCards(source, "h") < 2
					? { bool: false }
					: await source
							.chooseToDiscard({
								prompt: `弃置两张手牌，否则${get.translation(player)}对你造成1点伤害`,
								selectCard: 2,
								ai(card) {
									if (card.name === "tao") {
										return -10;
									}
									if (card.name === "jiu" && get.player().hp === 1) {
										return -10;
									}
									return get.unuseful(card) + 2.5 * (5 - (get.owner(card)?.hp ?? 0));
								},
							})
							.forResult();
			if (!result?.bool) {
				await source.damage();
			}
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1];
					}
					return 0.8;
					// if(get.tag(card,'damage')&&get.damageEffect(target,player,player)>0) return [1,0,0,-1.5];
				},
			},
		},
	},
	ganglie_three: {
		audio: "ganglie",
		trigger: { player: "damageEnd" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget(card, player, target) {
						return target.isEnemyOf(player);
					},
					ai(target) {
						return -get.attitude(get.player(), target) / Math.sqrt(1 + target.countCards("h"));
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			event.target = event.targets[0];
			const { judge } = await player
				.judge({
					judge(card) {
						if (get.suit(card) === "heart") {
							return -2;
						}
						return 2;
					},
					judge2(result) {
						return result.bool;
					},
				})
				.forResult();
			if (judge < 2) {
				return;
			}
			const { bool: chooseToDiscardResultBool } = await event.target
				.chooseToDiscard({
					selectCard: 2,
					ai(card) {
						if (card.name === "tao") {
							return -10;
						}
						if (card.name === "jiu" && _status.event.player.hp == 1) {
							return -10;
						}
						return get.unuseful(card) + 2.5 * (5 - (get.owner(card)?.hp ?? 0));
					},
				})
				.forResult();
			if (chooseToDiscardResultBool === false) {
				await event.target.damage();
			}
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1];
					}
					return 0.8;
					// if(get.tag(card,'damage')&&get.damageEffect(target,player,player)>0) return [1,0,0,-1.5];
				},
			},
		},
	},
	tuxi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		filter(event, player) {
			return !event.numFixed;
		},
		async cost(event, trigger, player) {
			let num = game.countPlayer(current => current !== player && get.attitude(player, current) <= 0 && current.hasCards("h"));
			let check = num >= 2;
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill),
					prompt2: "获得其他一至两名角色的各一张手牌",
					filterTarget(card, player, target) {
						return player !== target && target.hasCards("h");
					},
					selectTarget: [1, 2],
					ai(target) {
						const { player, aicheck } = get.event();
						if (!aicheck) {
							return 0;
						}
						const att = get.attitude(player, target);
						if (target.hasSkill("tuntian")) {
							return att / 10;
						}
						return 1 - att;
					},
				})
				.set("aicheck", check)
				.forResult();
		},
		async content(event, trigger, player) {
			await player.gainMultiple(event.targets);
			trigger.changeToZero();
			await game.delay();
		},
		ai: {
			threaten: 2,
			expose: 0.3,
		},
	},
	luoyi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		check(event, player) {
			if (player.skipList.includes("phaseUse") || player.countCards("h") < 3) {
				return false;
			}
			if (!player.hasSha()) {
				return false;
			}
			return game.hasPlayer(current => get.attitude(player, current) < 0 && player.canUse("sha", current));
		},
		preHidden: true,
		filter(event, player) {
			return !event.numFixed && event.num > 0;
		},
		async content(event, trigger, player) {
			player.addTempSkill("luoyi2", "phaseJieshuBegin");
			trigger.num--;
		},
	},
	luoyi2: {
		trigger: { source: "damageBegin1" },
		sourceSkill: "luoyi",
		filter(event) {
			return event.card && (event.card.name === "sha" || event.card.name === "juedou") && event.notLink();
		},
		charlotte: true,
		forced: true,
		async content(event, trigger, player) {
			trigger.num++;
		},
		ai: {
			damageBonus: true,
		},
	},
	tiandu: {
		audio: 2,
		audioname: ["re_guojia", "xizhicai", "gz_nagisa"],
		trigger: { player: "judgeEnd" },
		preHidden: true,
		frequent(event) {
			//if(get.mode()=='guozhan') return false;
			return event.result.card?.name !== "du";
		},
		check(event) {
			return event.result.card?.name !== "du";
		},
		filter(event, player) {
			return get.position(event.result.card, true) === "o";
		},
		async content(event, trigger, player) {
			player.gain({
				cards: [trigger.result.card],
				animate: "gain2",
			});
		},
	},
};
