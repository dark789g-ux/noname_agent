import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olpingyuan" | "olliaoyi" | "ol_piliche" | "olchunhui" | "olxiasheng" | "olqiumu">} */
export const groupSkills = {
	//刘晔
	olpingyuan: {
		audio: 2,
		trigger: {
			player: ["enterGame", "phaseBegin"],
			global: "phaseBefore",
		},
		filter(event, player, name) {
			if (name == "phaseBegin") {
				return true;
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async cost(event, trigger, player) {
			if (!player.getEquip("ol_piliche")) {
				const name = "ol_piliche";
				let card;
				const target = game.findPlayer(current => {
					const equip = current.getEquip(name);
					return equip?.name === name;
				});
				if (target) {
					card = target.getEquip(name);
				} else {
					card = game.createCard(name, lib.card[name].cardcolor, 9);
				}
				if (!player.canEquip(card, true)) {
					return;
				}
				event.result = await player
					.chooseBool({
						prompt: get.prompt(event.skill),
						prompt2: `将${get.translation(card)}置于装备区（顶替原装备）并摸一张牌`,
						choice: true,
					})
					.forResult();
				event.result.cards = [card];
			} else {
				const choiceList = [`移动霹雳车`, "视为使用一张【杀】"];
				const controls = [];
				const bool1 = player.canMoveCard(void 0, true, player, card => get.name(card) == "ol_piliche");
				const bool2 = player.hasUseTarget({ name: "sha", isCard: true }, void 0, false);
				if (bool1) {
					controls.push("选项一");
				}
				if (bool2) {
					controls.push("选项二");
				}
				if (!controls.length) {
					return;
				}
				const result = await player
					.chooseControl({
						controls: [...controls, "cancel2"],
						choiceList,
						choice: (() => {
							const goon1 = player.canMoveCard(true, true, player, card => get.name(card) == "ol_piliche");
							const goon2 = player.hasValueTarget({ name: "sha", isCard: true }, void 0, false);
							if (!bool1) {
								return goon2 ? 0 : 2;
							}
							if (!bool2) {
								return goon1 ? 0 : 2;
							}
							return goon2 ? 1 : 2;
						})(),
						prompt: get.prompt(event.skill),
						prompt2: "移动霹雳车或视为使用一张【杀】",
					})
					.forResult();
				event.result = {
					bool: result.control != "cancel2",
					cost_data: {
						index: ["选项一", "选项二"].indexOf(result.control),
					},
				};
			}
		},
		async content(event, trigger, player) {
			const { cards } = event;
			if (cards?.length) {
				const card = cards[0];
				const owner = get.owner(card);
				if (owner) {
					owner.$give(card, player, false);
				} else {
					player.$gain2(card, false);
				}
				await game.delayx();
				await player.equip(card);
				await player.draw();
			} else {
				const { index } = event.cost_data;
				if (index == 0) {
					await player.moveCard({ forced: true, sourceTargets: [player], filter: card => get.name(card) == "ol_piliche" });
				} else {
					await player.chooseUseTarget({
						card: get.autoViewAs({ name: "sha", isCard: true }),
						forced: true,
						addCount: false,
					});
				}
			}
		},
	},
	olliaoyi: {
		audio: 2,
		trigger: {
			global: "useCard",
		},
		filter(event, player) {
			const target = _status.currentPhase;
			return target == event.player && !player.getStorage("olliaoyi_used").includes(target) && target.getHistory("useCard", evt => evt.targets.includes(player)).indexOf(event) == 0;
		},
		logTarget: () => _status.currentPhase,
		async cost(event, trigger, player) {
			const target = _status.currentPhase;
			const choiceList = ["摸一张牌", `令${get.translation(trigger.card)}对你无效`];
			const result = await player
				.chooseControl({
					controls: ["cancel2"],
					choiceList,
					prompt: get.prompt2(event.skill, target),
					choice: get.effect(player, trigger.card, target, player) >= 0 ? 0 : 1,
				})
				.forResult();
			event.result = {
				bool: result.control != "cancel2",
				cost_data: {
					index: result.index,
				},
			};
		},
		async content(event, trigger, player) {
			const {
				cost_data: { index },
				targets: [target],
			} = event;
			player.addSkill(`${event.name}_used`);
			player.markAuto(`${event.name}_used`, target);
			if (index == 0) {
				await player.draw();
			} else {
				game.log(trigger.card, "对", player, "无效");
				trigger.excluded.add(player);
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已触发过目标：$",
				},
			},
		},
	},
	ol_piliche: {
		equipSkill: true,
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			return event.player != player && event.player.countDiscardableCards(player, "hej") > 0;
		},
		check(event, player) {
			return get.effect(event.player, { name: "guohe_copy" }, player, player) > 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			await player.discardPlayerCard({ target, position: "hej", forced: true });
		},
	},
	//曹金玉
	olchunhui: {
		audio: 2,
		forced: true,
		locked: false,
		trigger: {
			player: ["damageEnd", "phaseZhunbeiBegin"],
		},
		filter(event, player) {
			return game.hasPlayer(target => target != player && target.countCards("he"));
		},
		async content(event, trigger, player) {
			const bool = player.storage[`${event.name}_rewrite`];
			const color = bool ? "black" : "red";
			const result = await player
				.chooseTarget({
					prompt: `###${get.translation(event.name)}###令一名角色交给你一张牌`,
					forced: true,
					filterTarget(card, player, target) {
						return target != player && target.countCards("he");
					},
					ai(target) {
						return -get.attitude(get.player(), target) * (114514 - target.countCards("he"));
					},
				})
				.forResult();
			const {
				targets: [target],
			} = result;
			player.line(target);
			const result2 = await target
				.chooseToGive({
					prompt: `夏晟：交给${get.translation(player)}一张牌`,
					forced: true,
					position: "he",
					target: player,
					ai(card) {
						if (get.color(card, false) == "black") {
							return 7 - get.value(card);
						}
						return 6 - get.value(card);
					},
				})
				.forResult();
			const {
				cards: [card],
			} = result2;
			if (get.color(card, false) == "black") {
				[player, target].forEach(current => {
					current.addTempSkill(`${event.name}_effect`, "roundStart");
					current.setStorage(`${event.name}_effect`, color, true);
				});
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				trigger: {
					player: "useCard2",
				},
				forced: true,
				popup: false,
				filter(event, player) {
					return get.color(event.card) == player.storage.olchunhui_effect;
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					const { card, targets } = trigger;
					let bool1 = true;
					const bool2 = targets?.length > 1;
					//判断能不能多指，有好几个方面（allowMultiple为true、没有multiTarget、是否有能够增加的目标，缺一不可）
					const info = get.info(card);
					const addTargets = game.filterPlayer(function (target) {
						return !targets.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
					});
					if (info.allowMultiple == false || !targets.length || info.multitarget || !addTargets.length) {
						bool1 = false;
					}
					//能否增加和能否减少分开判断
					if (bool1 || bool2) {
						const next = player
							.chooseTarget({
								prompt: `###${get.translation(event.name)}###为${get.translation(card)}增加或减少一个目标（至多减至一）`,
								filterTarget(card, player, target) {
									const { bool1, bool2, targetsx, targetsy } = get.event();
									return (bool1 && targetsx.includes(target)) || (bool2 && targetsy.includes(target));
								},
								ai(target) {
									const targets = get.event().targetsy;
									const card = get.event().getTrigger().card;
									const player = get.player();
									return get.effect(target, card, player, player) * (targets.includes(target) ? -1 : 1);
								},
							})
							.set("bool1", bool1)
							.set("bool2", bool2)
							.set("targetsx", addTargets)
							.set("targetsy", targets);
						//加个宝宝提示（）
						next.targetprompt2.push(target => {
							if (!target.classList.contains("selectable")) {
								return false;
							}
							if (get.event().targetsy.includes(target)) {
								return `可减少目标`;
							}
						});
						const result = await next.forResult();
						if (result?.bool && result.targets?.length) {
							const {
								targets: [target],
							} = result;
							player.line(target);
							if (targets.includes(target)) {
								trigger.targets.remove(target);
								game.log(target, "从", card, "的目标中移除");
							} else {
								trigger.targets.add(target);
								game.log(target, "成为", card, "的额外目标");
							}
						}
					}
				},
				intro: {
					content: "下次使用$牌可以增加或减少一个目标（至多减至1）",
				},
			},
		},
	},
	olxiasheng: {
		audio: 2,
		trigger: {
			player: ["useCard", "useCard2"],
		},
		filter(event, player, name) {
			const black = player.countCards("h", { color: "black" });
			const red = player.countCards("h", { color: "red" });
			const { targets, card } = event;
			const info = get.info(card);
			const color = get.color(card);
			const bool =
				name == "useCard"
					? true
					: info.allowMultiple !== false &&
						!info.multitarget &&
						targets?.length &&
						game.hasPlayer(function (target) {
							return !targets.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
						});
			if (player.storage.olxiasheng_rewrite) {
				return black > red && color == "black" && bool;
			}
			if (name == "useCard") {
				return black < red && color == "black" && bool;
			}
			if (name == "useCard2") {
				return black > red && color == "red" && bool;
			}
			return false;
		},
		forced: true,
		async content(event, trigger, player) {
			if (event.triggername == "useCard") {
				await player.draw({ nodelay: true });
			} else {
				const { targets, card } = trigger;
				const result = await player
					.chooseTarget({
						prompt: `###${get.translation(event.name)}###为${get.translation(card)}增加一个目标`,
						filterTarget(card, player, target) {
							const { targets } = get.event();
							return targets.includes(target);
						},
						ai(target) {
							const card = get.event().getTrigger().card;
							const player = get.player();
							return get.effect(target, card, player, player);
						},
					})
					.set(
						"targets",
						game.filterPlayer(target => {
							return !targets.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
						})
					)
					.forResult();
				if (result?.bool && result.targets?.length) {
					const {
						targets: [target],
					} = result;
					player.line(target);
					trigger.targets.add(target);
					game.log(target, "成为", card, "的额外目标");
				}
			}
		},
	},
	olqiumu: {
		audio: 2,
		forced: true,
		trigger: { global: "dying" },
		filter(event, player) {
			const color = player.storage.olqiumu_rewrite ? "black" : "red";
			return game.hasGlobalHistory("useCard", evt => evt.targets.includes(event.player) && get.color(evt.card) == color);
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const cards = target.getGainableCards(player, "he", card => get.color(card) == "black");
			if (cards.length) {
				await player.gain({
					cards,
					source: target,
					animate: "giveAuto",
				});
			}
			if (!player.storage[`${event.name}_rewrite`]) {
				const list = ["olchunhui", "olxiasheng", "olqiumu"].filter(i => !player.storage[`${i}_rewrite`]);
				const result = await player
					.chooseControl({
						prompt: "秋暮：请选择要修改的技能",
						controls: list,
						choice: 0,
					})
					.forResult();
				const { control } = result;
				game.log(player, "修改了", `#g【${get.translation(control)}】`);
				player.setStorage(`${control}_rewrite`, true);
			}
		},
	},
};
