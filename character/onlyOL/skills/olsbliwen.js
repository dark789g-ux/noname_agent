import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbliwen" | "olsbzhengyi" | "olganlu" | "olbuyi" | "olzishou" | "olzongshi" | "oljuece" | "olmieji" | "olqieting">} */
export const groupSkills = {
	//OL谋孔融
	olsbliwen: {
		audio: 2,
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object" && _status.currentPhase === player) {
					const evt = player.getLastUsed(1);
					if (evt && evt.card && ((get.suit(evt.card) && get.suit(evt.card) == get.suit(card)) || get.type2(evt.card) == get.type2(card))) {
						return num + 10;
					}
				}
			},
		},
		trigger: {
			global: "phaseBefore",
			player: ["phaseEnd", "useCardAfter", "respondAfter", "enterGame"],
		},
		filter(event, player, name) {
			if (name == "phaseEnd") {
				return game.hasPlayer(current => current !== player && current.countMark("olsbliwen") < 5) && player.hasMark("olsbliwen");
			}
			if (player.countMark("olsbliwen") >= 5) {
				return false;
			}
			if (!["respond", "useCard"].includes(event.name)) {
				return event.name !== "phase" || game.phaseNumber === 0;
			}
			const evts = game.getAllGlobalHistory("everything", evt => ["useCard", "respond"].includes(evt.name) && evt.player == player && evt != event);
			if (!evts.length) {
				return false;
			}
			const {
				lastItem: { card },
			} = evts;
			return get.suit(card) == get.suit(event.card) || get.type2(card) == get.type2(event.card);
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			if (event.triggername == "phaseEnd") {
				const list = game.filterPlayer(current => current !== player && current.countMark("olsbliwen") < 5);
				const num = Math.min(player.countMark("olsbliwen"), list.length);
				if (num > 0) {
					const result = await player
						.chooseTarget(
							"是否发动【立文】？",
							"将任意枚“贤”标记分配给等量任意其他角色",
							(card, player, target) => {
								return target !== player && target.countMark("olsbliwen") < 5;
							},
							[1, num]
						)
						.set("ai", target => get.attitude(get.event().player, target) * (target.countCards("h") + 1))
						.forResult();
					if (result?.bool) {
						player.line(result.targets);
						player.removeMark("olsbliwen", result.targets.length);
						for (const target of result.targets.sortBySeat()) {
							target.addMark("olsbliwen", 1);
						}
					}
				}
				const targets = game.filterPlayer(target => target.hasMark("olsbliwen")).sort((a, b) => b.countMark("olsbliwen") - a.countMark("olsbliwen"));
				if (!targets.length) {
					return;
				}
				player.line(targets);
				for (const target of targets) {
					const result = await target
						.chooseToUse(
							function (card) {
								const evt = _status.event;
								if (!lib.filter.cardEnabled(card, evt.player, evt)) {
									return false;
								}
								return get.position(card) == "h";
							},
							'###立文###<div class="text center">使用一张手牌，或移去所有“贤”标记并令' + get.translation(player) + "摸等量的牌</div>"
						)
						.set("addCount", false)
						.forResult();
					if (!result?.bool) {
						const num = target.countMark("olsbliwen");
						target.clearMark("olsbliwen");
						await player.draw(num);
					}
				}
			} else {
				player.addMark("olsbliwen", ["useCard", "respond"].includes(trigger.name) ? 1 : Math.min(3, 5 - player.countMark("olsbliwen")));
			}
		},
		intro: {
			name2: "贤",
			content: "mark",
		},
		marktext: "贤",
		ai: { threaten: 3 },
	},
	olsbzhengyi: {
		audio: 2,
		trigger: { global: "damageBegin4" },
		filter(event, player) {
			if (event.hasNature() || !event.player.hasMark("olsbliwen")) {
				return false;
			}
			return game.hasPlayer(target => target != event.player && target.hasMark("olsbliwen"));
		},
		logTarget(event, player) {
			return game.filterPlayer(target => target != event.player && target.hasMark("olsbliwen"));
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			const targets = game.filterPlayer(target => target != trigger.player && target.hasMark("olsbliwen"));
			const choices = [];
			const map = await game.chooseAnyOL(targets, get.info(event.name).chooseBool, [trigger]).forResult();
			for (const current of targets) {
				const { bool } = map.get(current);
				if (bool) {
					choices.add(current);
				}
				current.chat(bool ? "同意" : "拒绝");
			}
			if (!choices.length) {
				trigger.player.chat("杯具");
			} else {
				trigger.cancel();
				trigger.player.chat("洗具");
				game.log(choices, "响应了", trigger.player, "的号召");
				const max = Math.max(...choices.slice().map(current => current.getHp()));
				const target = choices.find(current => current.getHp() == max);
				if (target) {
					await target.loseHp(trigger.num);
				}
			}
		},
		chooseBool(player, trigger, eventId) {
			return player
				.chooseBool()
				.set("prompt", "是否失去" + trigger.num + "点体力，为" + get.translation(trigger.player) + "取消此次伤害？")
				.set(
					"choice",
					(function (player, trigger) {
						const target = trigger.player;
						let eff1 = get.damageEffect(target, trigger.source, player);
						if (trigger.num > 1) {
							eff1 = Math.min(-1, eff1) * trigger.num;
						}
						const eff2 = get.effect(player, { name: "losehp" }, player, player) * trigger.num;
						return eff2 > eff1;
					})(player, trigger)
				)
				.set("id", eventId)
				.set("_global_waiting", true);
		},
		ai: { combo: "olsbliwen" },
	},
	//OL界吴国太
	olganlu: {
		inherit: "xinganlu",
		async content(event, trigger, player) {
			const num = Math.abs(event.targets[0].countCards("e") - event.targets[1].countCards("e"));
			await event.targets[0].swapEquip(event.targets[1]);
			await game.delayx();
			if (player.getDamagedHp() < num) {
				await player.chooseToDiscard("he", num, true);
			}
		},
	},
	olbuyi: {
		audio: 2,
		trigger: {
			global: "dying",
		},
		filter(event, player) {
			return event.player.hp <= 0 && event.player.countCards("he") > 0;
		},
		logTarget: "player",
		async cost(event, trigger, player) {
			const target = trigger.player;
			let check;
			if (trigger.player.isUnderControl(true, player)) {
				check = player.hasCard(card => {
					return get.type(card) != "basic";
				}, "he");
			} else {
				check = get.attitude(player, target) > 0;
			}
			event.result = await player
				.choosePlayerCard(target, get.prompt(event.name.slice(0, -5), target), "he")
				.set("ai", button => {
					if (!get.event().check) {
						return 0;
					}
					if (get.event().target.isUnderControl(true, get.player())) {
						if (get.type(button.link) != "basic") {
							return 10 - get.value(button.link);
						}
						return 0;
					} else {
						return Math.random();
					}
				})
				.set("check", check)
				.set("filterButton", button => {
					if (get.player() == get.event().target) {
						return lib.filter.cardDiscardable(button.link, get.player());
					}
					return true;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = trigger.player;
			await player.showCards(event.cards, get.translation(player) + "对" + (player == target ? "自己" : get.translation(target)) + "发动了【补益】");
			if (get.type(event.cards[0]) != "basic") {
				await target.discard(event.cards[0]);
				await target.recover();
			}
		},
	},
	//OL界刘表（袁术
	olzishou: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		filter(event, player) {
			return !event.numFixed;
		},
		check(event, player) {
			return (
				player.countCards("h") <= (player.hasSkill("olzongshi") ? player.maxHp : player.hp - 2) ||
				player.skipList.includes("phaseUse") ||
				!player.countCards("h", function (card) {
					return get.tag(card, "damage") && player.hasUseTarget(card);
				})
			);
		},
		async content(event, trigger, player) {
			trigger.num += game.countGroup();
			player
				.when("phaseJieshuBegin")
				.filter(evt => evt.getParent() == trigger.getParent())
				.step(async () => {
					if (player.hasHistory("useCard", evtx => get.is.damageCard(evtx.card)) && player.countDiscardableCards(player, "he")) {
						await player.chooseToDiscard("he", game.countGroup(), true);
					}
				});
		},
		ai: { threaten: 1.5 },
	},
	olzongshi: {
		mod: {
			maxHandcard(player, num) {
				return num + game.countGroup();
			},
		},
		audio: 2,
		trigger: {
			player: "damageBegin4",
		},
		filter(event, player) {
			const source = event.source;
			if (!source || source == player || !source.isIn()) {
				return false;
			}
			return !player.getStorage("olzongshi_record").includes(source.group);
		},
		forced: true,
		logTarget: "source",
		async content(event, trigger, player) {
			const target = trigger.source;
			trigger.cancel();
			player.addSkill("olzongshi_record");
			player.markAuto("olzongshi_record", [target.group]);
			if (player.countGainableCards(target, "hej")) {
				await target.gainPlayerCard(player, "hej", true);
			}
		},
		ai: {
			filterDamage: true,
			skillTagFilter(player, tag, arg) {
				if (arg && arg.player && player.getStorage("olzongshi_record").includes(arg.player.group)) {
					return true;
				}
				return false;
			},
		},
		subSkill: {
			record: {
				charlotte: true,
				intro: {
					content: (storage, player) => `已记录势力：${get.translation(storage)}`,
				},
			},
		},
	},
	//OL界李儒
	oljuece: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target !== player && player.countCards("h") >= target.countCards("h"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return target !== player && player.countCards("h") >= target.countCards("h");
				})
				.set("ai", target => {
					const player = get.player();
					return get.damageEffect(target, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await event.targets[0].damage();
		},
	},
	olmieji: {
		audio: 2,
		inherit: "xinmieji",
		filter(event, player) {
			return player.countCards("h", { type: ["trick", "delay"] });
		},
		filterCard(card) {
			return get.type2(card) == "trick";
		},
		async content(event, trigger, player) {
			const { target, cards } = event;
			player.$throw(cards.length, 1000);
			if (!target.countCards("he", card => lib.filter.cardDiscardable(card, target))) {
				return;
			}
			const result = await target.chooseToDiscard("he", true).set("prompt", "请弃置一张锦囊牌，或依次弃置两张牌。").forResult();
			if ((!result.cards || get.type(result.cards[0], "trick", result.cards[0].original == "h" ? target : false) != "trick") && target.countCards("he", card => lib.filter.cardDiscardable(card, target))) {
				await target.chooseToDiscard("he", true).set("prompt", "请弃置第二张牌");
			}
		},
	},
	//OL界蔡夫人
	olqieting: {
		audio: 2,
		trigger: {
			global: "phaseEnd",
		},
		filter(event, player) {
			const target = event.player;
			if (target == player || !target.isIn()) {
				return false;
			}
			return !target.hasHistory("sourceDamage", evt => evt.player != target) || !target.hasHistory("useCard", evt => evt.targets && evt.targets.some(i => i != target));
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			let num = 0;
			if (!target.hasHistory("useCard", evt => evt.targets && evt.targets.some(i => i != target))) {
				num += 2;
			}
			if (!target.hasHistory("sourceDamage", evt => evt.player != target)) {
				num += 1;
			}
			const next = player.chooseButton([
				"窃听：请选择" + (num > 1 ? "一至两" : "一") + "项",
				[
					[
						["move", "将" + get.translation(target) + "装备区的一张牌置于你的装备区"],
						["draw", "摸一张牌"],
					],
					"textbutton",
				],
			]);
			next.set("selectButton", [1, num]);
			next.set("filterButton", button => {
				if (
					button.link == "move" &&
					!get
						.event()
						.getTrigger()
						.player.countCards("e", card => {
							return get.player().canEquip(card);
						})
				) {
					return false;
				}
				return true;
			});
			next.set("ai", button => {
				const target = get.event().getTrigger().player,
					val = target.hasSkillTag("noe") ? 6 : 0,
					player = get.player();
				if (
					button.link == "move" &&
					(get.attitude(player, target) > 0 ||
						!target.countCards("e", function (card) {
							return player.canEquip(card) && get.value(card, target) > val && get.effect(player, card, player, player) > 0;
						}))
				) {
					return 0;
				}
				return 1;
			});
			const { bool, links } = await next.forResult();
			event.result = {
				bool: bool,
				cost_data: links,
			};
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player,
				choices = event.cost_data;
			if (choices.includes("move")) {
				const { cards } = await player
					.choosePlayerCard(target, "e", true)
					.set("filterButton", button => {
						return get.player().canEquip(button.link);
					})
					.set("ai", button => {
						const player = get.player();
						return get.effect(player, button.link, player, player);
					})
					.forResult();
				const card = cards[0];
				target.$give(card, player, false);
				await game.delay(0.5);
				await player.equip(card);
			}
			if (choices.includes("draw")) {
				await player.draw();
			}
		},
	},
};
