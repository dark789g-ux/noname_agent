import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yusui" | "boyan" | "rekuangcai" | "reshejian" | "refuyuan" | "reyingshui" | "rewangzu">} */
export const groupSkills = {
	//冯熙
	yusui: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return event.player != player && event.player.isIn() && get.color(event.card) == "black";
		},
		logTarget: "player",
		check(event, player) {
			var target = event.player;
			if (player.hp < 3 || get.attitude(player, target) > -3) {
				return false;
			}
			if (player.hp < target.hp) {
				return true;
			}
			if (Math.min(target.countCards("h") - player.countCards("h"), target.countCards("h")) > 3) {
				return true;
			}
			return false;
		},
		usable: 1,
		preHidden: true,
		async content(event, trigger, player) {
			let result;

			// step 0
			await player.loseHp();
			event.target = trigger.player;
			// step 1
			const target = event.target;
			let addIndex = 0;
			const list = [];
			const num = target.countCards("h") - player.countCards("h");
			if (num > 0 && target.countCards("h") > 0) {
				list.push("令其弃置" + get.cnNumber(num) + "张手牌");
			} else {
				addIndex++;
			}
			if (target.hp > player.hp) {
				list.push("令其失去" + get.cnNumber(target.hp - player.hp) + "点体力");
			}
			if (!list.length) {
				return;
			} else if (list.length == 1) {
				result = { index: 0 };
			} else {
				result = await player
					.chooseControl()
					.set("choiceList", list)
					.set("prompt", "令" + get.translation(target) + "执行一项")
					.set("ai", function () {
						const player = _status.event.player;
						const target = _status.event.getParent().target;
						return target.hp - player.hp > Math.min(_status.event.getParent().num, target.countCards("h")) / 2 ? 1 : 0;
					})
					.forResult();
			}
			// step 2
			if (result.index + addIndex == 0) {
				await target.chooseToDiscard(num, true, "h", "allowChooseAll");
			} else {
				await target.loseHp(target.hp - player.hp);
			}
		},
	},
	boyan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player;
		},
		async content(event, trigger, player) {
			const target = event.target;
			await target.drawTo(Math.min(5, target.maxHp));
			target.addTempSkill("boyan_block");
		},
		subSkill: {
			block: {
				mark: true,
				intro: { content: "不能使用或打出手牌" },
				charlotte: true,
				mod: {
					cardEnabled2(card) {
						if (get.position(card) == "h") {
							return false;
						}
					},
				},
			},
		},
		ai: {
			order: (item, player) => {
				if (
					game.hasPlayer(cur => {
						if (player === cur || get.attitude(player, cur) <= 0) {
							return false;
						}
						return Math.min(5, cur.maxHp) - cur.countCards("h") > 2;
					})
				) {
					return get.order({ name: "nanman" }, player) - 0.1;
				}
				return 10;
			},
			result: {
				target(player, target) {
					if (get.attitude(player, target) > 0) {
						return Math.max(0, Math.min(5, target.maxHp) - target.countCards("h"));
					}
					if (
						Math.max(0, Math.min(5, target.maxHp) - target.countCards("h")) <= 1 &&
						target.countCards("h", "shan") &&
						!target.hasSkillTag("respondShan", true, null, true) &&
						player.countCards("h", function (card) {
							return get.tag(card, "respondShan") && player.getUseValue(card, null, true) > 0 && get.effect(target, card, player, player) > 0;
						})
					) {
						return -2;
					}
				},
			},
		},
	},
	//祢衡
	rekuangcai: {
		audio: 2,
		forced: true,
		trigger: { player: "phaseDiscardBegin" },
		filter(event, player) {
			return !player.getHistory("useCard").length || !player.getHistory("sourceDamage").length;
		},
		async content(event, trigger, player) {
			lib.skill.rekuangcai.change(player, player.getHistory("useCard").length ? -1 : 1);
		},
		mod: {
			targetInRange(card, player) {
				if (player == _status.currentPhase) {
					return true;
				}
			},
			cardUsable(card, player) {
				if (player == _status.currentPhase) {
					return Infinity;
				}
			},
		},
		change(player, num) {
			if (typeof player.storage.rekuangcai_change != "number") {
				player.storage.rekuangcai_change = 0;
			}
			player.storage.rekuangcai_change += num;
			player.addSkill("rekuangcai_change");
		},
		group: "rekuangcai_draw",
		subSkill: {
			draw: {
				audio: "rekuangcai",
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				filter(event, player) {
					return player.getHistory("sourceDamage").length > 0;
				},
				async content(event, trigger, player) {
					player.draw(Math.min(5, player.getStat("damage")));
				},
			},
			change: {
				mod: {
					maxHandcard(player, num) {
						if (typeof player.storage.rekuangcai_change == "number") {
							return num + player.storage.rekuangcai_change;
						}
					},
				},
				charlotte: true,
				mark: true,
				intro: {
					content: num => "手牌上限" + (num < 0 ? "" : "+") + num,
				},
			},
		},
	},
	reshejian: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			if (player == event.player || event.targets.length != 1) {
				return false;
			}
			return event.player.isIn() && player.countCards("h") >= 2;
		},
		usable: 2,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard("h", [2, Infinity], get.prompt(event.skill, trigger.player), '<div class="text center">弃置至少两张手牌，然后选择一项：<br>⒈弃置其等量的牌。⒉对其造成1点伤害。</div>', "allowChooseAll")
				.set("ai", function (card) {
					if (_status.event.goon && ui.selected.cards.length < 2) {
						return 5.6 - get.value(card);
					}
					return 0;
				})
				.set(
					"goon",
					(function () {
						var target = trigger.player;
						if (get.attitude(player, target) >= 0) {
							return false;
						}
						if (get.damageEffect(target, player, player) > 0) {
							return true;
						}
						if (
							target.countCards("he", function (card) {
								return get.value(card, target) > 6;
							}) >= 2
						) {
							return true;
						}
						return false;
					})()
				)
				.set("chooseonly", true)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
			} = event;
			await player.discard(cards);
			const num = cards.length;
			let result;
			if (!target.isIn()) {
				return;
			} else if (!target.countDiscardableCards(player, "he")) {
				result = { index: 1 };
			} else {
				result = await player
					.chooseControl()
					.set("choiceList", ["弃置" + get.translation(target) + "的" + get.cnNumber(num) + "张牌", "对" + get.translation(target) + "造成1点伤害"])
					.set("ai", function () {
						const player = _status.event.player;
						const eff0 = get.effect(target, { name: "guohe_copy2" }, player, player) * Math.min(1.7, target.countCards("he"));
						const eff1 = get.damageEffect(target, player, player);
						return eff0 > eff1 ? 0 : 1;
					})
					.forResult();
			}
			if (result?.index == 0) {
				await player.discardPlayerCard(target, num, true, "he", "allowChooseAll");
			} else if (result?.index == 1) {
				await target.damage();
			}
		},
	},
	//陈登
	refuyuan: {
		audio: 2,
		trigger: { global: "useCardToTargeted" },
		logTarget: "target",
		filter(event, player) {
			return (
				event.card.name == "sha" &&
				event.target.isIn() &&
				!game.hasPlayer2(function (current) {
					return current.hasHistory("useCard", function (evt) {
						return evt.card != event.card && get.color(evt.card, false) == "red" && evt.targets && evt.targets.includes(event.target);
					});
				})
			);
		},
		check(event, player) {
			return get.attitude(player, event.target) > 0;
		},
		async content(event, trigger, player) {
			trigger.target.draw();
		},
	},
	reyingshui: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") > 0 && game.hasPlayer(current => player.inRange(current));
		},
		position: "he",
		filterCard: true,
		filterTarget(card, player, target) {
			return player.inRange(target);
		},
		discard: false,
		lose: false,
		delay: false,
		check(card) {
			if (get.type(card) == "equip") {
				return 3 - get.value(card);
			}
			return 6.5 - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.give(cards, target);
			const next = target.chooseCard("he", [2, Infinity], "交给" + get.translation(player) + "至少两张装备牌，否则受到1点伤害", { type: "equip" }, "allowChooseAll");
			if (get.damageEffect(target, player, target) >= 0) {
				next.set("ai", () => -1);
			} else {
				next.set("ai", card => (ui.selected.cards.length < 2 ? 6 - get.value(card) : 0));
			}
			const result = await next.forResult();
			if (result.bool) {
				await target.give(result.cards, player);
			} else {
				await target.damage("nocard");
			}
		},
		ai: {
			order: 5,
			tag: {
				damage: 0.5,
			},
			result: {
				target: -1.5,
			},
		},
	},
	rewangzu: {
		audio: 2,
		trigger: { player: "damageBegin1" },
		filter(event, player) {
			return event.source && player != event.source && player.hasCard(card => lib.filter.cardDiscardable(card, player, "rewangzu"), "h");
		},
		usable: 1,
		async cost(event, trigger, player) {
			var num = player.getFriends().length;
			if (
				!game.hasPlayer(function (current) {
					return current != player && current.getFriends().length > num;
				})
			) {
				event.result = await player
					.chooseToDiscard("h", get.prompt(event.skill), "弃置一张手牌并令伤害-1", "chooseonly")
					.set("ai", function (card) {
						return 7 - get.value(card);
					})
					.forResult();
			} else {
				event.result = await player.chooseBool(get.prompt(event.skill), "随机弃置一张手牌并令伤害-1").forResult();
			}
		},
		async content(event, trigger, player) {
			if (!event.cards || !event.cards.length) {
				const cards = player.getCards("h", card => lib.filter.cardDiscardable(card, player, "rewangzu"));
				if (cards.length) {
					await player.discard(cards.randomGet());
				}
			} else {
				await player.discard(event.cards);
			}
			trigger.num--;
		},
	},
};
