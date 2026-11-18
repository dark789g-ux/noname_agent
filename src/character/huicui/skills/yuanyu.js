import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yuanyu" | "xiyan">} */
export const groupSkills = {
	//张瑶
	//Partly powered by 烟雨墨染
	yuanyu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		async content(event, trigger, player) {
			let result;

			// step 0
			await player.draw(2);
			// step 1
			if (player.countCards("h") > 0 && game.hasPlayer(current => current != player)) {
				const suits = lib.suit.slice(0);
				const cards = player.getExpansions("yuanyu");
				for (const i of cards) {
					suits.remove(get.suit(i, false));
				}
				let str = "选择一张手牌，作为“怨”置于武将牌上；同时选择一名其他角色，令该角色获得〖怨语〗的后续效果。";
				if (suits.length) {
					str += "目前“怨”中未包含的花色：";
					for (const i of suits) {
						str += get.translation(i);
					}
				}
				result = await player
					.chooseCardTarget({
						filterCard: true,
						filterTarget: lib.filter.notMe,
						position: "h",
						prompt: "怨语：选择置于武将牌上的牌和目标",
						prompt2: str,
						suits: suits,
						forced: true,
						ai1(card) {
							const val = get.value(card);
							const evt = _status.event;
							if (evt.suits.includes(get.suit(card, false))) {
								return 8 - val;
							}
							return 5 - val;
						},
						ai2(target) {
							const player = _status.event.player;
							if (player.storage.yuanyu_damage && player.storage.yuanyu_damage.includes(target)) {
								return 0;
							}
							return -get.attitude(player, target);
						},
					})
					.forResult();
			} else {
				return;
			}
			// step 2
			const target = result.targets[0];
			player.addSkill("yuanyu_damage");
			player.markAuto("yuanyu_damage", result.targets);
			player.line(target, "green");
			if (!target.storage.yuanyu_mark) {
				target.storage.yuanyu_mark = player;
				target.markSkillCharacter("yuanyu_mark", player, "怨语", "已获得〖怨语〗效果");
				target.addSkill("yuanyu_mark");
			}
			const next = player.addToExpansion(result.cards, player, "give");
			next.gaintag.add("yuanyu");
			await next;
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
			player.removeSkill("yuanyu_damage");
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
		subSkill: {
			mark: {
				mark: "character",
				charlotte: true,
				intro: {
					content: "已获得〖怨语〗效果",
					onunmark: true,
				},
			},
			damage: {
				trigger: { global: ["damageSource", "phaseDiscardBegin"] },
				forced: true,
				charlotte: true,
				onremove(player, skill) {
					if (player.storage[skill]) {
						for (var i of player.storage[skill]) {
							if (i.storage.yuanyu_mark == player) {
								i.unmarkSkill("yuanyu_mark");
							}
						}
					}
					delete player.storage[skill];
				},
				filter(event, player) {
					if (event.name == "damage") {
						var source = event.source;
						return source && player.getStorage("yuanyu_damage").includes(source) && source.countCards("h") > 0;
					} else {
						if (player == event.player) {
							return player.getStorage("yuanyu_damage").some(function (target) {
								return target.isIn() && target.countCards("h") > 0;
							});
						} else if (player.getStorage("yuanyu_damage").includes(event.player)) {
							return event.player.countCards("h") > 0;
						}
						return false;
					}
				},
				async content(event, trigger, player) {
					let targets;
					if (trigger.name == "phaseDiscard") {
						if (trigger.player == player) {
							targets = player
								.getStorage("yuanyu_damage")
								.filter(function (target) {
									return target.isIn() && target.countCards("h") > 0;
								})
								.sortBySeat();
						} else {
							targets = [trigger.player];
						}
					} else {
						targets = [trigger.source];
					}
					while (targets.length) {
						const target = targets.shift();
						let count = trigger.name == "damage" ? trigger.num : 1;
						while (count > 0 && target.countCards("h") > 0) {
							count--;
							var suits = lib.suit.slice(0),
								cards = player.getExpansions("yuanyu");
							for (var i of cards) {
								suits.remove(get.suit(i, false));
							}
							var next = target.chooseCard("h", true, "将一张手牌置于" + get.translation(player) + "的武将牌上");
							next.set("suits", suits);
							next.set("ai", function (card) {
								var val = get.value(card),
									evt = _status.event;
								if (evt.suits.includes(get.suit(card, false))) {
									return 5 - get.value(card);
								}
								return 8 - get.value(card);
							});
							if (suits.length) {
								var str = "目前未包含的花色：";
								for (var i of suits) {
									str += get.translation(i);
								}
								next.set("prompt2", str);
							}
							const result = await next.forResult();
							player.addToExpansion(result.cards, target, "give").gaintag.add("yuanyu");
							if (!player.hasSkill("yuanyu_damage")) {
								return;
							}
						}
					}
				},
			},
		},
	},
	xiyan: {
		audio: 2,
		trigger: { player: "addToExpansionAfter" },
		filter(event, player) {
			if (!event.gaintag.includes("yuanyu")) {
				return false;
			}
			var cards = player.getExpansions("yuanyu");
			if (cards.length < lib.suit.length) {
				return false;
			}
			var suits = lib.suit.slice(0);
			for (var i of cards) {
				suits.remove(get.suit(i));
				if (!suits.length) {
					return true;
				}
			}
			return false;
		},
		logTarget: () => _status.currentPhase,
		prompt2: "获得所有“怨”",
		check: () => true,
		async content(event, trigger, player) {
			let result;

			// step 0
			await player.removeSkill("yuanyu_damage");
			const cards = player.getExpansions("yuanyu");
			await player.gain(cards, "gain2");
			// step 1
			const target = _status.currentPhase;
			if (player == target) {
				await player.addMark("xiyan_buff", 4, false);
				await player.addTempSkill("xiyan_buff");
				delete player.getStat("skill").yuanyu;
				return;
			}
			result = await player
				.chooseBool("夕颜：是否令" + get.translation(target) + "本回合的手牌上限-4且不能使用基本牌？")
				.set("ai", () => _status.event.bool)
				.set("bool", get.attitude(player, target) < 0)
				.forResult();
			// step 2
			if (!result.bool) {
				return;
			}
			const target2 = _status.currentPhase;
			await target2.addMark("xiyan_debuff", 4, false);
			await target2.addTempSkill("xiyan_debuff");
		},
		subSkill: {
			buff: {
				charlotte: true,
				mark: true,
				marktext: " + ",
				intro: {
					content: "本回合手牌上限+#且使用牌无次数限制",
				},
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("xiyan_buff");
					},
					cardUsable(card, player) {
						return Infinity;
					},
				},
				sub: true,
			},
			debuff: {
				charlotte: true,
				mark: true,
				marktext: " - ",
				intro: {
					content: "本回合手牌上限-#且不能使用基本牌",
				},
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("xiyan_debuff");
					},
					cardEnabled(card) {
						if (get.type(card) == "basic") {
							return false;
						}
					},
					cardSavable(card) {
						if (get.type(card) == "basic") {
							return false;
						}
					},
				},
				sub: true,
			},
		},
		ai: {
			combo: "yuanyu",
		},
	},
};
