import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqingya" | "oltielun" | "olliantao" | "junkliantao">} */
export const groupSkills = {
	//鸭蛋
	olqingya: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			const { target } = event;
			if (event.targets.length != 1 || target == player || [player, target].some(i => i.hasSkill("undist")) || !target.isIn()) {
				return false;
			}
			if (event.card.name != "sha") {
				return false;
			}
			const [left, right, left2, right2] = get.info("saodi").getTargets(player, target);
			return (target == left2 && left.some(i => i.countDiscardableCards(player, "h"))) || (target == right2 && right.some(i => i.countDiscardableCards(player, "h")));
		},
		aiJudge(player, target, bool) {
			let left3 = false,
				right3 = false;
			let eff_left = 0,
				eff_right = 0;
			const [left, right, left2, right2] = get.info("saodi").getTargets(player, target);
			const card = { name: "guohe_copy", position: "h" };
			if (target == left2) {
				for (const i of left) {
					if (i.countDiscardableCards(player, "h")) {
						left3 = true;
						eff_left += get.effect(i, card, player, player);
					}
				}
			}
			if (target == right2) {
				for (const i of right) {
					if (i.countDiscardableCards(player, "h")) {
						right3 = true;
						eff_right += get.effect(i, card, player, player);
					}
				}
			}
			if (left3 && right3) {
				if (!bool) {
					return Math.max(eff_left, eff_right);
				}
				if (eff_left > Math.max(0, eff_right)) {
					return "↖顺时针";
				}
				if (eff_right > Math.max(0, eff_left)) {
					return "逆时针↗";
				}
				return "cancel2";
			} else if (left3) {
				if (bool) {
					return eff_left > 0 ? "↖顺时针" : "cancel2";
				}
				return eff_left;
			} else if (right3) {
				if (bool) {
					return eff_right > 0 ? "逆时针↗" : "cancel2";
				}
				return eff_right;
			} else {
				return bool ? "cancel2" : 0;
			}
		},
		async cost(event, trigger, player) {
			const choices = [];
			const { skill } = event,
				{ target } = trigger;
			const [left, right, left2, right2] = get.info("saodi").getTargets(player, target);
			if (target == left2 && left.some(i => i.countDiscardableCards(player, "h"))) {
				choices.push("↖顺时针");
			}
			if (target == right2 && right.some(i => i.countDiscardableCards(player, "h"))) {
				choices.push("逆时针↗");
			}
			choices.push("cancel2");
			const { control } = await player
				.chooseControl(choices)
				.set("prompt", get.prompt(skill))
				.set("prompt2", `弃置自己和${get.translation(target)}某个方向之间的所有角色（不包括你与其）各一张手牌`)
				.set("choices", choices)
				.set("ai", () => {
					const evt = get.event().getTrigger();
					return lib.skill.olqingya.aiJudge(evt.player, evt.target, true);
				})
				.forResult();
			if (control === "cancel2") {
				return;
			}
			const targets = [];
			game.log(player, "选择了", "#g" + control);
			if (control == "↖顺时针") {
				let current = player.getPrevious();
				while (current != target) {
					if (current.countDiscardableCards(player, "h")) {
						targets.push(current);
					}
					current = current.getPrevious();
				}
			} else {
				let current = player.getNext();
				while (current != target) {
					if (current.countDiscardableCards(player, "h")) {
						targets.push(current);
					}
					current = current.getNext();
				}
			}
			event.result = {
				bool: true,
				targets: targets,
			};
		},
		async content(event, trigger, player) {
			for (const current of event.targets.sortBySeat()) {
				if (!current.countDiscardableCards(player, "h")) {
					continue;
				}
				player.line(current);
				await player.discardPlayerCard(current, true, "h");
			}
			await game.delayx();
			let evt = trigger;
			while (true) {
				if (!evt.name || lib.phaseName.includes(evt.name)) {
					break;
				}
				evt = evt.getParent();
			}
			if (player.getHistory("custom", evtx => evtx.olqingya === evt.name).length) {
				return;
			}
			player.getHistory("custom").push({ olqingya: evt.name });
			const curPhaseName = evt.name;
			player
				.when({
					global: ["phaseAnyEnd", "phaseAfter"],
				})
				.filter(evt => {
					if (evt.name === "phase") {
						return true;
					}
					let evt2 = trigger;
					while (true) {
						if (!evt2.name || lib.phaseName.includes(evt2.name)) {
							break;
						}
						evt2 = evt2.getParent();
					}
					return evt2.name !== evt.name;
				})
				.step(async (event, trigger, player) => {
					if (trigger.name === "phase") {
						return;
					}
					const history = player.getHistory("useSkill", evt => {
							if (evt.skill !== "olqingya") {
								return false;
							}
							const evtx = evt.event.getParent(curPhaseName);
							if (!evtx || evtx.name !== curPhaseName) {
								return false;
							}
							return true;
						}),
						cards = [];
					history.forEach(evt => {
						game.countPlayer2(current => {
							current.checkHistory("lose", evtx => {
								if (evtx.getParent(4) !== evt.event) {
									return;
								}
								cards.addArray(evtx.cards.filterInD("d"));
							});
						}, true);
					});
					if (!cards.length) {
						return;
					}
					event.cards = cards;
					const result = await player
						.chooseButton(["倾轧：是否使用其中的一张牌？", event.cards])
						.set("filterButton", button => {
							return get.player().hasUseTarget(button.link);
						})
						.set("ai", button => {
							return get.player().getUseValue(button.link);
						})
						.forResult();
					if (result.bool) {
						const card = result.links[0];
						player.$gain2(card, false);
						await game.delayx();
						await player.chooseUseTarget(card, true);
					}
				});
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					if (!target || player._olqingya_judging || ui.selected.targets.length || player == target || target.hasSkill("undist")) {
						return;
					}
					if (typeof card != "object" || card.name != "sha") {
						return false;
					}
					player._olqingya_judging = true;
					var effect = lib.skill.olqingya.aiJudge(player, target);
					delete player._olqingya_judging;
					if (effect > 0) {
						return [1, effect / Math.max(0.01, get.attitude(player, player))];
					}
				},
			},
		},
	},
	oltielun: {
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		mod: {
			globalFrom(from, to, distance) {
				return distance - from.countMark("oltielun_mark");
			},
		},
		subSkill: {
			mark: {
				trigger: {
					player: "useCard1",
					global: "roundStart",
				},
				filter(event, player) {
					return event.name == "useCard" || player.hasMark("oltielun_mark");
				},
				charlotte: true,
				firstDo: true,
				silent: true,
				async content(event, trigger, player) {
					if (trigger.name == "useCard") {
						player.addMark(event.name, 1, false);
					} else {
						player.clearMark(event.name, false);
					}
				},
				intro: { content: "本轮已使用#张牌" },
			},
		},
	},
	//SP孙策
	olliantao: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.event().player,
						att = get.attitude(player, target);
					const colors = Object.keys(lib.color).filter(i => i != "none");
					if (
						!colors.some(color =>
							player.hasCard(card => {
								const juedou = get.autoViewAs({ name: "juedou" }, [card]);
								return player.canUse(juedou, target, false);
							}, "h")
						)
					) {
						return 20 + (3 - get.sgn(att)) + Math.random();
					}
					const effs = colors.reduce((list, color) => {
						const cards = player.getCards("h", card => {
							const juedou = get.autoViewAs({ name: "juedou" }, [card]);
							return player.canUse(juedou, target, false);
						});
						if (cards.length) {
							list.push(
								cards.reduce((sum, card) => {
									const juedou = get.autoViewAs({ name: "juedou" }, [card]);
									return sum + get.effect(target, juedou, player, player);
								}, 0)
							);
						}
						return list;
					}, []);
					return Math[att > 0 ? "max" : "min"].apply(Math, effs);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const colors = Object.keys(lib.color).filter(i => i != "none");
			if (colors.length && player.countCards("h")) {
				const result = await target
					.chooseControl(colors)
					.set("prompt", "连讨：请选择一个颜色")
					.set("ai", () => {
						const player = get.event().player,
							source = get.event().getParent().player;
						let controls = get.event().controls.slice();
						if (controls.length == 1) {
							return controls[0];
						}
						const getSum = function (color, player, source) {
							return source
								.getCards("h", card => {
									if (get.color(card) != color) {
										return false;
									}
									const juedou = get.autoViewAs({ name: "juedou" }, [card]);
									return source.canUse(juedou, player, false);
								})
								.reduce((num, card) => {
									const juedou = get.autoViewAs({ name: "juedou" }, [card]);
									return num + get.effect(player, juedou, source, player);
								}, 0);
						};
						return controls.sort((a, b) => getSum(b, player, source) - getSum(a, player, source))[0];
					})
					.set("prompt2", get.translation(player) + "将对你依次使用由其手牌中所有此颜色的牌转化的【决斗】")
					.forResult();
				const color = result.control;
				game.broadcastAll(
					(color, target) => {
						lib.skill.olliantao_backup.filterCardx = [color, target];
						lib.skill.olliantao_backup.filterCard = function (card, player) {
							const list = lib.skill.olliantao_backup.filterCardx;
							if (get.color(card) != list[0]) {
								return false;
							}
							const juedou = get.autoViewAs({ name: "juedou" }, [card]);
							return player.canUse(juedou, list[1], false);
						};
					},
					color,
					target
				);
				await player.showHandcards();
				while (
					target.isIn() &&
					player.hasCard(card => lib.skill.olliantao_backup.filterCard(card, player)) &&
					!game.getGlobalHistory("everything", evt => {
						return evt.name == "dying" && [player, target].includes(evt.player) && evt.getParent(event.name) == event;
					}).length
				) {
					await player
						.chooseToUse()
						.set("forced", true)
						.set("openskilldialog", "连讨：将一张" + get.translation(color) + "手牌当作【决斗】对" + get.translation(target) + "使用")
						.set("norestore", true)
						.set("_backupevent", "olliantao_backup")
						.set("custom", {
							add: {},
							replace: { window() {} },
						})
						.backup("olliantao_backup")
						.set("targetRequired", true)
						.set("complexTarget", true)
						.set("complexSelect", true)
						.set("filterTarget", function (card, player, target) {
							if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
								return false;
							}
							return lib.filter.targetEnabled.apply(this, arguments);
						})
						.set("sourcex", target)
						.set("addCount", false);
				}
			}
			const num = player
				.getHistory("sourceDamage", evt => {
					return evt.getParent(4) == event;
				})
				.reduce((sum, evt) => sum + evt.num, 0);
			if (num) {
				await player.draw(num);
			}
			if (
				event.name == "olliantao" &&
				!game.hasPlayer2(current => {
					return current.getHistory("damage", evt => {
						return evt.getParent(4) == event;
					}).length;
				})
			) {
				await player.draw(3);
				player.addTempSkill("olliantao_buff");
				player.addMark("olliantao_buff", 3, false);
			}
			if (
				event.name == "junkliantao" &&
				!target.getHistory("damage", evt => {
					return evt.getParent(4) == event;
				}).length
			) {
				await player.draw();
				player.addTempSkill("olliantao_buff");
				player.addMark("olliantao_buff", 1, false);
			}
		},
		subSkill: {
			backup: {
				viewAs: { name: "juedou" },
				position: "h",
				check: () => 1 + Math.random(),
				log: false,
			},
			buff: {
				charlotte: true,
				onremove: true,
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("olliantao_buff");
					},
					cardEnabled(card) {
						if (card.name == "sha") {
							return false;
						}
					},
				},
				intro: { content: "手牌上限+#，不能使用【杀】" },
			},
		},
	},
	//王战孙策，但是通渠
	junkliantao: {
		audio: "olliantao",
		inherit: "olliantao",
	},
};
