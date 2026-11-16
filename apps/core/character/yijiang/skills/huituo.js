import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "huituo" | "duodao" | "reanjian" | "reanjian2" | "reanjian3" | "reanjian4" | "reduodao" | "anjian" | "xinpojun" | "xinpojun2" | "qiaoshi" | "yanyu" | "yanyu2">} */
export const groupSkills = {
	huituo: {
		audio: 2,
		audioname: ["re_caorui"],
		trigger: { player: "damageEnd" },
		direct: true,
		async content(event, trigger, player) {
			const forced = event.forced === undefined ? false : event.forced;
			const info = get.skillInfoTranslation("huituo", player, false);
			const str = `###${forced ? "恢拓：请选择一名角色" : get.prompt("huituo")}###令一名角色判定。若结果为红色，其回复1点体力；若结果为黑色，其摸${get.cnNumber(trigger.num)}张牌`;
			let result = await player
				.chooseTarget(str, event.forced)
				.set("ai", function (target) {
					const player = get.player();
					if (get.attitude(player, target) > 0) {
						return get.recoverEffect(target, player, player) + 1;
					}
					return 0;
				})
				.forResult();
			if (result?.bool) {
				player.logSkill(event.name, result.targets);
				const target = result.targets[0];
				event.target = target;
				result = await target
					.judge(card => {
						if (target.isDamaged()) {
							if (get.color(card) == "red") {
								return -1;
							}
						}
						if (get.color(card) == "red") {
							return 1;
						}
						return 0;
					})
					.forResult();
				switch (result?.color) {
					case "red":
						await event.target.recover();
						break;

					case "black":
						await event.target.draw(trigger.num);
						break;

					default:
						break;
				}
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
		},
	},
	duodao: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return player.countCards("he") > 0 && event.source && event.card && event.card.name == "sha";
		},
		async cost(event, trigger, player) {
			let prompt = "弃置一张牌，然后",
				cards = trigger.source.getEquips(1).filter(card => {
					return lib.filter.canBeGained(card, player, trigger.source);
				});
			if (cards.length) {
				prompt += "获得" + get.translation(trigger.source) + "装备区中的" + get.translation(cards);
			} else {
				prompt += "无事发生";
			}
			event.result = await player
				.chooseToDiscard("he", get.prompt(event.skill, trigger.source), prompt)
				.set("ai", function (card) {
					let eff = get.event().eff;
					if (typeof eff === "number") {
						return eff - get.value(card);
					}
					return 0;
				})
				.set(
					"eff",
					(function () {
						let es = trigger.source.getEquips(1).filter(card => {
							return lib.filter.canBeGained(card, player, trigger.source);
						});
						if (!es.length) {
							return false;
						}
						if (get.attitude(player, trigger.source) > 0) {
							return (
								-2 *
								es.reduce((acc, card) => {
									return acc + get.value(card, trigger.source);
								}, 0)
							);
						}
						return es.reduce((acc, card) => {
							return acc + get.value(card, player);
						}, 0);
					})()
				)
				.forResult();
		},
		logTarget: "source",
		async content(event, trigger, player) {
			const cards = trigger.source.getEquips(1).filter(card => {
				return lib.filter.canBeGained(card, player, trigger.source);
			});
			if (cards.length) {
				player.gain(cards, trigger.source, "give", "bySelf");
			}
		},
		ai: {
			maixie_defend: true,
		},
	},
	reanjian: {
		trigger: { player: "useCardToPlayered" },
		forced: true,
		audio: 2,
		filter(event, player) {
			return event.card.name == "sha" && !event.target.inRange(player);
		},
		logTarget: "target",
		async content(event, trigger, player) {
			trigger.getParent().reanjian_buffed = true;
			const map = trigger.customArgs;
			const id = trigger.target.playerid;
			if (!map[id]) {
				map[id] = {};
			}
			if (!map[id].extraDamage) {
				map[id].extraDamage = 0;
			}
			map[id].extraDamage++;
			trigger.target.addTempSkill("reanjian2");
			trigger.target.addTempSkill("reanjian4");
			trigger.target.storage.reanjian2.add(trigger.card);
		},
		ai: {
			unequip_ai: true,
			skillTagFilter(player, tag, arg) {
				if (arg && arg.name == "sha" && arg.target && !arg.target.inRange(player)) {
					return true;
				}
				return false;
			},
		},
	},
	reanjian2: {
		firstDo: true,
		sourceSkill: "reanjian",
		ai: { unequip2: true },
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = [];
			}
		},
		onremove: true,
		trigger: {
			player: ["damage", "damageCancelled", "damageZero"],
			target: ["shaMiss", "useCardToExcluded"],
		},
		charlotte: true,
		filter(event, player) {
			const evt = event.getParent("useCard", true, true);
			if (evt && evt.effectedCount < evt.effectCount) {
				return false;
			}
			return player.storage.reanjian2 && event.card && player.storage.reanjian2.includes(event.card);
		},
		silent: true,
		forced: true,
		popup: false,
		priority: 12,
		async content(event, trigger, player) {
			player.storage.reanjian2.remove(trigger.card);
			if (!player.storage.reanjian2.length) {
				player.removeSkill("reanjian2");
			}
		},
	},
	reanjian3: {
		mod: {
			cardSavable(card) {
				if (card.name == "tao") {
					return false;
				}
			},
		},
	},
	reanjian4: {
		trigger: { player: "dyingBegin" },
		forced: true,
		silent: true,
		firstDo: true,
		sourceSkill: "reanjian",
		filter(event, player) {
			return (event.getParent(2).reanjian_buffed = true);
		},
		async content(event, trigger, player) {
			player.addTempSkill("reanjian3", { global: ["dyingEnd", "phaseEnd"] });
		},
	},
	reduodao: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return event.card.name == "sha" && player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			let prompt = "弃置一张牌，然后",
				cards = trigger.player.getEquips(1).filter(card => {
					return lib.filter.canBeGained(card, player, trigger.player);
				});
			if (cards.length) {
				prompt += "获得" + get.translation(trigger.player) + "装备区中的" + get.translation(cards);
			} else {
				prompt += "无事发生";
			}
			event.result = await player
				.chooseToDiscard("he", get.prompt(event.skill, trigger.player), prompt)
				.set("ai", function (card) {
					let eff = get.event().eff;
					if (typeof eff === "number") {
						return eff - get.value(card);
					}
					return 0;
				})
				.set(
					"eff",
					(function () {
						let es = trigger.player.getEquips(1).filter(card => {
							return lib.filter.canBeGained(card, player, trigger.player);
						});
						if (!es.length) {
							return false;
						}
						if (get.attitude(player, trigger.player) > 0) {
							return (
								-2 *
								es.reduce((acc, card) => {
									return acc + get.value(card, trigger.player);
								}, 0)
							);
						}
						return (
							2 *
							es.reduce((acc, card) => {
								return acc + get.value(card, player);
							}, 0)
						);
					})()
				)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const cards = trigger.player.getEquips(1).filter(card => {
				return lib.filter.canBeGained(card, player, trigger.player);
			});
			if (cards.length) {
				player.gain(cards, trigger.player, "give", "bySelf");
			}
		},
	},
	anjian: {
		audio: 2,
		trigger: { source: "damageBegin1" },
		check(event, player) {
			return get.attitude(player, event.player) <= 0;
		},
		forced: true,
		filter(event, player) {
			return event.getParent().name == "sha" && !event.player.inRange(player);
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
	},
	xinpojun: {
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && player.isPhaseUsing() && event.target.hp > 0 && event.target.countCards("he") > 0;
		},
		audio: "pojun",
		async cost(event, trigger, player) {
			event.result = await player
				.choosePlayerCard({
					prompt: get.prompt("xinpojun", trigger.target),
					target: trigger.target,
					selectButton: [1, Math.min(trigger.target.countCards("he"), trigger.target.hp)],
					allowChooseAll: true,
				})
				.set("forceAuto", true)
				.forResult();

			event.result.cards = event.result.links;
		},
		logTarget(event) {
			return event?.target;
		},
		async content(event, trigger, player) {
			const target = trigger.target;
			await target.addToExpansion({
				cards: event.cards,
				source: target,
				animate: "giveAuto",
				gaintag: ["xinpojun2"],
			});
			target.addSkill("xinpojun2");
		},
		ai: {
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (get.attitude(player, arg.target) > 0 || !player.isPhaseUsing()) {
					return false;
				}
				if (tag == "directHit_ai") {
					return arg.target.hp >= Math.max(1, arg.target.countCards("h") - 1);
				}
				if (arg && arg.name == "sha" && arg.target.getEquip(2)) {
					return true;
				}
				return false;
			},
		},
	},
	xinpojun2: {
		trigger: { global: "phaseEnd" },
		forced: true,
		popup: false,
		charlotte: true,
		sourceSkill: "xinpojun",
		filter(event, player) {
			return player.getExpansions("xinpojun2").length > 0;
		},
		async content(event, trigger, player) {
			const cards = player.getExpansions("xinpojun2");
			await player.gain({
				cards,
				animate: "draw",
			});
			game.log(player, "收回了" + get.cnNumber(cards.length) + "张“破军”牌");
			player.removeSkill("xinpojun2");
		},
		intro: {
			markcount: "expansion",
			mark(dialog, storage, player) {
				var cards = player.getExpansions("xinpojun2");
				if (player.isUnderControl(true)) {
					dialog.addAuto(cards);
				} else {
					return "共有" + get.cnNumber(cards.length) + "张牌";
				}
			},
		},
	},
	qiaoshi: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player != player && event.player.countCards("h") == player.countCards("h") && event.player.isIn();
		},
		check(event, player) {
			return get.attitude(player, event.player) >= 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			game.asyncDraw([trigger.player, player]);
		},
	},
	yanyu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => lib.skill.yanyu.filterCard(card, player), "h");
		},
		filterCard: (card, player) => get.name(card) == "sha" && player.canRecast(card),
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards } = event;
			player.recast(cards);
		},
		ai: {
			basic: {
				order: 1,
			},
			result: {
				player: 1,
			},
		},
		group: "yanyu2",
	},
	yanyu2: {
		trigger: { player: "phaseUseEnd" },
		filter(event, player) {
			return (
				player.getHistory("useSkill", function (evt) {
					return evt.event.getParent("phaseUse") == event && evt.skill == "yanyu";
				}).length >= 2
			);
		},
		sourceSkill: "yanyu",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("yanyu"),
					prompt2: "令一名男性角色摸两张牌",
					filterTarget(card, player, target) {
						return target.hasSex("male") && target !== player;
					},
					ai(target) {
						return get.attitude(_status.event.player, target);
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			await event.targets[0].draw(2);
		},
	},
};
