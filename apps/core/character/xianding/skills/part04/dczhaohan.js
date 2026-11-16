import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczhaohan" | "oldjinjie" | "dcjinjie" | "oldjue" | "dcjue">} */
export const groupSkills = {
	//杨彪
	dczhaohan: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		frequent: true,
		filter(event, player) {
			return !event.numFixed;
		},
		content() {
			trigger.num += 2;
			trigger.dczhaohan = true;
			player.addTempSkill("dczhaohan_choose", "phaseDrawAfter");
		},
		subSkill: {
			choose: {
				trigger: { player: "gainAfter" },
				filter(event, player) {
					return event.getParent(2).dczhaohan && player.countCards("h") >= 2;
				},
				forced: true,
				charlotte: true,
				popup: false,
				content() {
					"step 0";
					var choices = [],
						choiceList = ["将两张手牌交给一名没有手牌的角色", "弃置两张手牌"];
					if (game.hasPlayer(current => current.countCards("h") == 0)) {
						choices.push("选项一");
					} else {
						choiceList[0] = '<span style="opacity:0.5; ">' + choiceList[0] + "</span>";
					}
					choices.push("选项二");
					if (choices.length == 1) {
						event._result = { control: "选项二" };
					} else {
						player
							.chooseControl(choices)
							.set("choiceList", choiceList)
							.set("ai", () => _status.event.choice)
							.set(
								"choice",
								(function () {
									if (
										game.hasPlayer(current => {
											return current.countCards("h") == 0 && get.attitude(player, current) > 0;
										})
									) {
										return "选项一";
									}
									return "选项二";
								})()
							);
					}
					"step 1";
					if (result.control == "选项一") {
						player.chooseCardTarget({
							filterCard: true,
							selectCard: 2,
							forced: true,
							filterTarget(card, player, target) {
								return !target.countCards("h");
							},
							ai1(card) {
								return 7 - get.value(card);
							},
							ai2(target) {
								return get.attitude(_status.event.player, target);
							},
							prompt: "将两张手牌交给一名没有手牌的角色",
						});
					} else {
						player.chooseToDiscard("昭汉：请弃置两张手牌", true, 2);
						event.finish();
					}
					"step 2";
					if (result.bool) {
						player.give(result.cards, result.targets[0]);
					}
				},
			},
		},
	},
	oldjinjie: {
		audio: "dcjinjie",
		trigger: { global: "dying" },
		hasPhase(player) {
			var history = player.actionHistory;
			for (var i = history.length - 1; i >= 0; i--) {
				if (history[i].isMe && !history[i].isSkipped) {
					return true;
				}
				if (history[i].isRound) {
					break;
				}
			}
			return false;
		},
		direct: true,
		content() {
			"step 0";
			player.chooseBool(get.prompt("oldjinjie", trigger.player), "令其摸一张牌").set("ai", () => {
				return get.attitude(_status.event.player, _status.event.getTrigger().player) > 0;
			});
			"step 1";
			if (result.bool) {
				player.logSkill("oldjinjie", trigger.player);
				trigger.player.draw();
			} else {
				event.finish();
			}
			if (lib.skill.oldjinjie.hasPhase(player)) {
				event.finish();
			}
			"step 2";
			var num = 0;
			var history = player.actionHistory;
			for (var i = history.length - 1; i >= 0; i--) {
				for (var evt of history[i].useSkill) {
					if (evt.skill == "oldjinjie") {
						num++;
					}
				}
				if (history[i].isRound) {
					break;
				}
			}
			if (num == 0) {
				player.chooseBool(get.prompt("oldjinjie", trigger.player), "令其回复1点体力").set("ai", () => {
					var player = _status.event.player;
					return get.effect(_status.event.getTrigger().player, { name: "tao" }, player, player) > 0;
				});
			} else {
				player
					.chooseToDiscard(get.prompt("oldjinjie", trigger.player), "弃置" + get.cnNumber(num) + "张牌，令其回复1点体力", "he", num)
					.set("ai", card => {
						if (_status.event.eff > 0) {
							return get.value({ name: "tao" }) - get.value(card);
						}
						return 0;
					})
					.set("eff", get.effect(trigger.player, { name: "tao" }, player, player));
			}
			"step 3";
			if (result.bool) {
				player.line(trigger.player, "green");
				trigger.player.recover();
			}
		},
	},
	dcjinjie: {
		audio: 2,
		trigger: { global: "dying" },
		async cost(event, trigger, player) {
			const target = trigger.player;
			const result = await player
				.chooseControl(
					[0, 1, 2, 3].map(i => get.cnNumber(i, true)),
					"cancel2"
				)
				.set("prompt", get.prompt(event.skill, target))
				.set("prompt2", `令${get.translation(target)}摸至多三张牌，然后你可以弃置等量的牌令其回复1点体力。`)
				.set("ai", () => {
					return get.event().choice;
				})
				.set(
					"choice",
					(() => {
						if (get.attitude(player, target) <= 0) {
							return "cancel2";
						}
						if (target === player) {
							return 3;
						}
						const unusefulCount = player.countCards("he", card => {
							return lib.filter.cardDiscardable(card, player, "dcjinjie") && get.value(card) < 5 && !player.canSaveCard(card, target);
						});
						if (
							[player, target]
								.unique()
								.map(current => {
									return current.countCards("hs", card => {
										return player.canSaveCard(card, target);
									});
								})
								.reduce((p, c) => p + c) > unusefulCount
						) {
							return 3;
						}
						return Math.min(3, unusefulCount);
					})()
				)
				.forResult();
			if (result.control !== "cancel2") {
				event.result = {
					bool: true,
					cost_data: {
						index: result.index,
					},
				};
			}
		},
		round: 1,
		logTarget: "player",
		async content(event, trigger, player) {
			const num = event.cost_data.index,
				target = trigger.player;
			if (num > 0) {
				await target.draw(num);
			}
			let next;
			if (num > 0) {
				next = player
					.chooseToDiscard(`尽节：是否弃置${get.cnNumber(num)}张牌，令${get.translation(target)}回复1点体力？`, num, "he")
					.set("ai", card => {
						if (get.event().goon) {
							return 100 / Math.max(0.01, get.value(card) + 20);
						}
						return 0;
					})
					.set(
						"goon",
						(() => {
							if (get.attitude(player, target) <= 0) {
								return false;
							}
							const count = player.countCards("hs", card => {
								return player.canSaveCard(card, target);
							});
							return (
								!count ||
								(count > 0 &&
									player.countCards("he", card => {
										return get.value(card) < 5;
									}) >= num)
							);
						})()
					);
			} else {
				next = player.chooseBool(`尽节：是否令${get.translation(target)}回复1点体力？`).set("choice", get.attitude(player, target) > 0);
			}
			const { bool } = await next.forResult();
			if (bool) {
				player.line(target, "green");
				await target.recover();
			}
		},
		subSkill: {
			round: {},
		},
	},
	oldjue: {
		audio: "dcjue",
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		filter(event, player) {
			return game.hasPlayer(current => (current.getHp() > player.getHp() || current.countCards("h") > player.countCards("h")) && player.canUse("sha", current, false));
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("oldjue"), "视为对一名体力值或手牌数大于你的角色使用一张【杀】", (card, player, target) => {
					return player.canUse("sha", target, false) && (target.getHp() > player.getHp() || target.countCards("h") > player.countCards("h"));
				})
				.set("ai", target => {
					return get.effect(target, { name: "sha" }, _status.event.player);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("oldjue", target);
				player.useCard({ name: "sha", isCard: true }, target, false);
			}
		},
	},
	dcjue: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			if (!lib.skill.dcjue.getCards().length) {
				return false;
			}
			return (
				(event.player !== player && event.player.isIn()) ||
				(event.player === player &&
					game.hasPlayer(current => {
						return current.isIn();
					}))
			);
		},
		round: 1,
		async cost(event, trigger, player) {
			let maxLimit = lib.skill.dcjue.getCards().length;
			if (trigger.player === player) {
				event.result = await player
					.chooseTarget(get.prompt(event.skill), `选择一名其他角色，视为对其依次随机使用X次【杀】/【过河拆桥】/【五谷丰登】（X为${maxLimit}与其体力上限中的较小值）。`)
					.set("filterTarget", lib.filter.notMe)
					.set("ai", target => {
						return -get.attitude(get.player(), target);
					})
					.forResult();
			} else {
				const target = trigger.player;
				maxLimit = Math.min(maxLimit, target.maxHp);
				event.result = await player
					.chooseBool(get.prompt("dcjue", target), `视为对${get.translation(target)}依次随机使用${get.cnNumber(maxLimit)}次【杀】/【过河拆桥】/【五谷丰登】。`)
					.set("choice", get.attitude(player, target) < 0)
					.forResult();
			}
		},
		logTarget: "player",
		getCards() {
			const cards = [];
			game.countPlayer2(current => {
				current.getHistory("lose", evt => {
					if (evt.type == "discard") {
						cards.addArray(evt.cards.filterInD("d"));
					}
				});
			});
			return cards;
		},
		async content(event, trigger, player) {
			const target = event.targets ? event.targets[0] : trigger.player;
			const nameList = ["sha", "guohe", "wugu"];
			let maxLimit = Math.min(lib.skill.dcjue.getCards().length, target.maxHp);
			while (maxLimit--) {
				if (!target.isIn()) {
					return;
				}
				const list = nameList.slice().randomSort();
				for (const name of list) {
					const card = new lib.element.VCard({ name, isCard: true });
					let targets = [player, target].filter(current => player.canUse(card, current));
					if (targets.length) {
						await player.useCard(card, targets);
						await game.delayx();
						break;
					}
				}
			}
		},
	},
};
