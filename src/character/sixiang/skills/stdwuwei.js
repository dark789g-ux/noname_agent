import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdwuwei" | "stdleiruo" | "stddechong" | "stdyinzu" | "stdqiyue" | "xuanhuafu_skill" | "stdjieji" | "stdfengzhan" | "baipishuangbi_skill" | "stdruixi" | "stdyimou" | "stdmutao">} */
export const groupSkills = {
	//曹熊
	stdwuwei: {
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return player.countCards("he", card => get.type(card, player) == "equip" && game.hasPlayer(target => target.canEquip(card, true)));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt2(event.skill),
					filterCard(card, player) {
						return get.type(card, player) == "equip";
					},
					filterTarget(card, player, target) {
						if (get.position(card) == "e" && target == player) {
							return false;
						}
						return target.canEquip(card, true);
					},
					position: "he",
					ai1(card) {
						return 6 - get.value(card);
					},
					ai2(target) {
						const card = ui.selected.cards[0],
							att = get.attitude(get.player(), target),
							range = target.getAttackRange(),
							cardrange = 1 - (get.info(card, false)?.distance?.attackFrom || 0);
						if (att <= 0 && cardrange > range) {
							return get.effect(target, { name: "guohe_copy2" }, get.player(), get.player());
						}
						return att * get.equipValue(card, target);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const card = event.cards[0],
				target = event.targets[0],
				range = target.getAttackRange();
			await target.equip(card);
			const num = target.getAttackRange() - range;
			if (num > 0 && target.countDiscardableCards(player, "he")) {
				await player.discardPlayerCard(target, "he", num, true);
			}
		},
	},
	stdleiruo: {
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target != player && target.countGainableCards(player, "e"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target != player && target.countGainableCards(player, "e");
				})
				.set("ai", target => {
					if (!get.player().hasShan()) {
						return false;
					}
					return get.effect(target, { name: "shunshou_copy2" }, get.player(), get.player());
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.gainPlayerCard(target, "e", true);
			const card = get.autoViewAs({ name: "sha", isCard: true });
			if (target.canUse(card, player, false, false)) {
				const result = await target
					.chooseBool(`羸弱：是否视为对${get.translation(player)}使用一张无距离限制的【杀】`)
					.set("choice", get.effect(player, card, target, target) > 0)
					.forResult();
				if (result?.bool) {
					await target.useCard(card, player, false);
				}
			}
		},
	},
	//毛皇后
	stddechong: {
		trigger: { global: "phaseZhunbeiBegin" },
		filter(event, player) {
			return event.player != player && player.countCards("he");
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseCard(
					get.prompt2(event.skill, trigger.player),
					"he",
					[1, Infinity],
					(card, player) => {
						const target = get.event().getTrigger().player;
						return lib.filter.canBeGained(card, target, player);
					},
					"allowChooseAll"
				)
				.set("ai", card => {
					const player = get.player(),
						target = get.event().getTrigger().player,
						att = get.attitude(player, target);
					if (att <= 0) {
						const num = target.countCards("h", card => !target.hasValueTarget(card));
						if (num >= target.hp) {
							return 6 - get.value(card);
						}
						return 0;
					}
					if (att > 0) {
						return target.getUseValue(card) - 2;
					}
				})
				.forResult();
			if (result?.cards?.length) {
				event.result = {
					bool: true,
					targets: [trigger.player],
					cost_data: result.cards,
				};
			}
		},
		async content(event, trigger, player) {
			const cards = event.cost_data,
				target = event.targets[0];
			await player.give(cards, target);
			player
				.when({ global: "phaseDiscardBegin" })
				.filter(evt => evt.player == target)
				.step(async (event, trigger, player) => {
					if (trigger.stddechong) {
						return;
					}
					trigger.set("stddechong", true);
					const target = trigger.player;
					if (target.countCards("h") >= target.hp) {
						const result = await player
							.chooseBool(`得宠：是否对${get.translation(target)}造成1点伤害`)
							.set("choice", get.damageEffect(target, player, player) > 0)
							.forResult();
						if (result?.bool) {
							await target.damage();
						}
					}
				});
		},
	},
	stdyinzu: {
		locked: true,
		global: ["stdyinzu_global"],
		subSkill: {
			global: {
				charlotte: true,
				mod: {
					attackRange(player, num) {
						const count = game.countPlayer(current => current.hasSkill("stdyinzu"));
						if (!count) {
							return;
						}
						const sub = player.countCards("h") - player.hp;
						if (sub > 0) {
							return num + count;
						}
						return num - count;
					},
				},
			},
		},
	},
	//郑聪
	stdqiyue: {
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && player.hasEquipableSlot(1);
		},
		async content(event, trigger, player) {
			const card = game.createCard2("xuanhuafu", "diamond", 5);
			await player.gain(card, "gain2");
		},
	},
	xuanhuafu_skill: {
		equipSkill: true,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			const card = event.card;
			if (card.name != "sha" || !event.isFirstTarget) {
				return false;
			}
			return game.hasPlayer(
				target =>
					get.distance(target, event.target) == 1 &&
					lib.filter.targetInRange(card, player, target) &&
					lib.filter.targetEnabled2(card, player, target) &&
					!event.targets.includes(target)
			);
		},
		async cost(event, trigger, player) {
			const card = trigger.card;
			const targets = game.filterPlayer(
				target =>
					get.distance(target, trigger.target) == 1 &&
					lib.filter.targetInRange(card, player, target) &&
					lib.filter.targetEnabled2(card, player, target) &&
					!trigger.targets.includes(target)
			);
			if (targets.length == 1) {
				event.result = { bool: true, targets: targets };
			} else {
				event.result = await player
					.chooseTarget(`宣花斧：为${get.translation(card)}额外指定一个目标`, true, (card, player, target) => {
						return get.event().targetsx.includes(target);
					})
					.set("targetsx", targets)
					.set("ai", target => get.effect(target, get.event().getTrigger().card, get.player(), get.player()))
					.forResult();
			}
		},
		async content(event, trigger, player) {
			const { targets } = event;
			trigger.targets.addArray(targets);
		},
	},
	stdjieji: {
		trigger: { source: "damageSource" },
		filter(event, player) {
			return (
				event.player != player &&
				event.player.isIn() &&
				event.card?.name == "sha" &&
				player.getHistory("useCard", evt => evt.card.name == "sha").indexOf(event.getParent("useCard")) == 0 &&
				event.player.countGainableCards(player, "he")
			);
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player;
			await player.gainPlayerCard(target, "he", true);
			const card = get.autoViewAs({ name: "sha", isCard: true });
			if (target.canUse(card, player, false, false)) {
				await target.useCard(card, player, false, "noai");
			}
		},
	},
	//姜婕
	stdfengzhan: {
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && player.hasEquipableSlot(1);
		},
		async content(event, trigger, player) {
			const card = game.createCard2("baipishuangbi", "spade", 2);
			await player.gain(card, "gain2");
		},
	},
	baipishuangbi_skill: {
		trigger: { player: "useCardToPlayered" },
		equipSkill: true,
		forced: true,
		filter(event, player) {
			return event.card.name == "sha" && player.differentSexFrom(event.target) && !player.countCards("h");
		},
		async content(event, trigger, player) {
			trigger.getParent().baseDamage++;
		},
	},
	stdruixi: {
		trigger: {
			global: "phaseJieshuBegin",
		},
		filter(event, player) {
			return (
				player.countCards("hes") && player.hasUseTarget(get.autoViewAs({ name: "sha" }, "unsure"), false, false) && player.hasHistory("lose")
			);
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			await player
				.chooseToUse()
				.set("openskilldialog", `###${get.prompt(event.name)}###将一张牌当作无距离限制的【杀】使用`)
				.set("norestore", true)
				.set("_backupevent", `${event.name}_backup`)
				.set("custom", {
					add: {},
					replace: { window() {} },
				})
				.backup(`${event.name}_backup`)
				.set("targetRequired", true)
				.set("complexTarget", true)
				.set("complexSelect", true)
				.set("addCount", false)
				.set("logSkill", event.name);
		},
		subSkill: {
			backup: {
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				filterTarget(card, player, target) {
					return lib.filter.targetEnabled.apply(this, arguments);
				},
				viewAs: {
					name: "sha",
				},
				selectCard: 1,
				position: "hes",
				ai1(card) {
					return 7 - get.value(card);
				},
			},
		},
	},
	//四象封印·青龙
	//标鲍信
	stdyimou: {
		audio: "yimou",
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return player.countCards("he") && game.hasPlayer(target => target != player) && event.num > 0;
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseCardTarget({
					prompt: get.prompt2(event.skill),
					filterCard: true,
					position: "he",
					filterTarget: lib.filter.notMe,
					ai1(card) {
						return 1 / Math.max(0.1, get.value(card));
					},
					ai2(target) {
						var player = _status.event.player,
							att = get.attitude(player, target);
						if (target.hasSkillTag("nogain")) {
							att /= 9;
						}
						return 4 + att;
					},
				})
				.forResult();
			if (result?.bool) {
				event.result = {
					bool: true,
					cost_data: result.cards,
					targets: result.targets,
				};
			}
		},
		async content(event, trigger, player) {
			const target = event.targets[0],
				cards = event.cost_data;
			await player.give(cards, target);
		},
	},
	stdmutao: {
		audio: "mutao",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target.countCards("h"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.countCards("h");
				})
				.set("ai", target => get.damageEffect(target, get.player(), get.player()))
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.showHandcards();
			if (target.countCards("h", card => get.name(card, target) == "sha")) {
				await target.damage();
			}
		},
	},
};
