import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twquanqian" | "twrouke" | "old_twquanqian" | "old_twrouke">} */
export const groupSkills = {
	//张纮
	twquanqian: {
		audio: 2,
		trigger: { global: "phaseDrawEnd" },
		sunbenSkill: true,
		filter(event, player) {
			return event.player != player && game.hasPlayer(current => current.countCards("h") > 0);
		},
		check(event, player) {
			if (get.attitude(player, event.player) > 0) {
				return true;
			}
			return !player.isMaxHandcard();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.addSkill("twquanqian_sunben");
			const max = game.findPlayer(current => current.isMaxHandcard());
			if (max) {
				const num = Math.min(5, max.countCards("h") - player.countCards("h"));
				if (num > 0) {
					await player.draw(num);
				}
			}
			if (!player.countCards("he")) {
				player.addMark("twquanqian_sunben", 1, false);
				return;
			}
			const target = trigger.player;
			const result = await player
				.chooseToGive("he", target, [1, Infinity], "allowChooseAll", `是否交给${get.translation(target)}任意张牌？`)
				.set("complexCard", true)
				.set("ai", card => {
					if (get.event().att <= 0) {
						return 0;
					}
					if (ui.selected.cards.every(cardx => get.type2(cardx) != get.type2(card))) {
						return 9 - get.value(card);
					}
					return 2 - get.value(card);
				})
				.set("att", get.attitude(player, trigger.player))
				.forResult();
			if (!result?.bool || !result.cards?.length) {
				player.addMark("twquanqian_sunben", 1, false);
				return;
			}
			const types = result.cards.map(card => get.type2(card)).toUniqued();
			if (types.length) {
				await player.draw(types.length);
			}
			const suits = result.cards.map(card => get.suit(card)).toUniqued();
			if (suits.length) {
				target.addTempSkill("twquanqian_effect");
				target.addMark("twquanqian_effect", suits.length, false);
			}
			player.addMark("twquanqian_sunben", result.cards.length, false);
		},
		subSkill: {
			sunben: {
				charlotte: true,
				init(player, skill) {
					player.clearMark(skill, false);
				},
				onremove: true,
				intro: { content: "还需#次有角色成为非延时伤害牌的目标且未受到该牌伤害" },
				trigger: { global: "useCardAfter" },
				getIndex(event) {
					return event.targets;
				},
				filter(event, player, name, target) {
					if (!event.targets?.length) {
						return false;
					}
					if (!get.is.damageCard(event.card)) {
						return false;
					}
					return !target?.hasHistory("damage", evt => evt.card == event.card);
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					player.removeMark(event.name, 1, false);
					if (!player.countMark(event.name)) {
						player.removeSkill(event.name);
						if (player.hasSkill("twquanqian", null, null, false) && !player.hasSkill("twquanqian")) {
							player.popup("劝迁");
							player.restoreSkill("twquanqian");
							game.log(player, "恢复了技能", "#g【劝迁】");
						}
					}
				},
			},
			effect: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "出杀次数+#",
				},
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("twquanqian_effect");
						}
					},
				},
			},
		},
	},
	twrouke: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			if (!get.is.damageCard(event.card)) {
				return false;
			}
			return event.player.hasHistory("sourceDamage");
		},
		logTarget: "player",
		check(event, player) {
			const getD = current => get.effect(current, { name: "draw" }, player, player);
			let eff = getD(player) + getD(event.player);
			return (
				event.targets.reduce((sum, target) => {
					return sum - get.effect(target, event.card, event.player, player);
				}, eff) >= 0
			);
		},
		async content(event, trigger, player) {
			const evt = trigger.getParent();
			evt.excluded.addArray(evt.targets);
			await game.asyncDraw([player, trigger.player]);
			let num = 0;
			trigger.player.getRoundHistory("gain", evt => {
				if (evt.getParent(2).name != event.name) {
					return false;
				}
				if (evt.cards?.length) {
					num += evt.cards.length;
				}
			});
			if (num > player.hp) {
				player.tempBanSkill(event.name, { global: "roundStart" });
				trigger.player.addTempSkill("fengyin", { global: "roundStart" });
			}
		},
	},
	old_twquanqian: {
		audio: "twquanqian",
		sunbenSkill: true,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("h") && game.countPlayer() > 1;
		},
		filterCard(card, player) {
			return !ui.selected.cards.some(cardx => get.suit(cardx, player) == get.suit(card, player));
		},
		selectCard: [1, 4],
		check(card) {
			return 1 / (get.value(card) || 0.5);
		},
		position: "h",
		complexCard: true,
		discard: false,
		lose: false,
		delay: false,
		filterTarget: lib.filter.notMe,
		usable: 1,
		async content(event, trigger, player) {
			const { name, cards, target } = event;
			player.removeSkill("old_twquanqian_sunben");
			player.awakenSkill(name);
			player.addSkill("old_twquanqian_sunben");
			await player.give(cards, target);
			if (cards.length < 2) {
				return;
			}
			const card = get.cardPile2(card => get.type(card) == "equip");
			if (card) {
				await player.gain(card, "gain2");
			}
			let result;
			if (player.countCards("h") >= target.countCards("h")) {
				if (target.countCards("h")) {
					result = { index: 1 };
				} else {
					return;
				}
			} else {
				const str = get.translation(target);
				result = await player
					.chooseControl()
					.set("choiceList", ["将手牌数摸至与" + str + "相同", "观看" + str + "的手牌并获得其一种花色的所有手牌"])
					.set("ai", () => {
						const { player, target } = get.event();
						if (target.countCards("h") - player.countCards("h") > target.countCards("h") / 4 || get.attitude(player, target) > 0) {
							return 0;
						}
						return 1;
					})
					.set("target", target)
					.forResult();
			}
			if (result?.index == 0) {
				await player.drawTo(target.countCards("h"));
				return;
			}
			const list = [],
				dialog = ["劝迁：获得" + get.translation(target) + "一种花色的所有牌"];
			for (let suit of lib.suit.concat("none")) {
				if (target.countCards("h", { suit: suit })) {
					dialog.push('<div class="text center">' + get.translation(suit + "2") + "牌</div>");
					dialog.push(target.getCards("h", { suit: suit }));
					list.push(suit);
				}
			}
			if (!list.length) {
				return;
			}
			const result2 = await player
				.chooseControl(list)
				.set("dialog", dialog)
				.set("ai", () => {
					return _status.event.control;
				})
				.set(
					"control",
					(() => {
						let getv = cards => cards.map(i => get.value(i)).reduce((p, c) => p + c, 0);
						return list.sort((a, b) => {
							return getv(target.getCards("h", { suit: b })) - getv(target.getCards("h", { suit: a }));
						})[0];
					})()
				)
				.forResult();
			if (result2?.control) {
				await player.gain(target.getCards("h", { suit: result2.control }), target, "give");
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					return target.countCards("h");
				},
			},
		},
		subSkill: {
			sunben: {
				charlotte: true,
				init(player, skill) {
					player.setStorage(skill, 0);
				},
				onremove: true,
				mark: true,
				intro: {
					markcount(num) {
						return (num || 0).toString();
					},
					content: "弃牌进度：#/6",
				},
				trigger: {
					player: "loseAfter",
					global: "loseAsyncAfter",
				},
				filter(event, player) {
					if (event.type != "discard") {
						return false;
					}
					var evt = event.getl(player);
					return evt && evt.hs && evt.hs.length;
				},
				forced: true,
				popup: false,
				firstDo: true,
				content() {
					"step 0";
					player.addMark("old_twquanqian_sunben", trigger.getl(player).hs.length, false);
					"step 1";
					if (player.countMark("old_twquanqian_sunben") >= 6) {
						player.removeSkill("old_twquanqian_sunben");
						if (player.hasSkill("old_twquanqian", null, null, false) && !player.hasSkill("old_twquanqian")) {
							player.popup("劝迁");
							player.restoreSkill("old_twquanqian");
							game.log(player, "恢复了技能", "#g【劝迁】");
						}
					}
				},
			},
		},
	},
	old_twrouke: {
		audio: "twrouke",
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			var evt = event.getParent("phaseDraw");
			if (evt && evt.player == player) {
				return false;
			}
			return event.getg(player).length > 1;
		},
		forced: true,
		content() {
			player.draw();
		},
	},
};
