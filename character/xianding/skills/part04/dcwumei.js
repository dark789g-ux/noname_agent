import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcwumei" | "dczhanmeng">} */
export const groupSkills = {
	//周宣
	dcwumei: {
		audio: 2,
		round: 1,
		trigger: { player: "phaseBeforeEnd" },
		filter(event, player) {
			if (event.finished) {
				return false;
			}
			return !player.isTurnedOver() || event._noTurnOver; //笑点解析：回合开始前，但是翻面不能发动
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => get.attitude(get.player(), target))
				.forResult();
		},
		onRound(event) {
			return !event.wumei_phase;
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			const next = target.insertPhase();
			target.addSkill("dcwumei_wake");
			target.storage["dcwumei_wake"][2].add(next);
			if (!trigger._finished) {
				trigger.finish();
				trigger._finished = true;
				trigger.untrigger(true);
				trigger._triggered = 5;
				if (!lib.onround.includes(lib.skill.dcwumei.onRound)) {
					lib.onround.push(lib.skill.dcwumei.onRound);
				}
				const evt = player.insertPhase();
				evt.wumei_phase = true;
				evt.phaseList = trigger.phaseList;
				evt.relatedEvent = trigger.relatedEvent || trigger.getParent(2);
				evt.skill = trigger.skill;
				evt._noTurnOver = true;
				evt.set("phaseList", trigger.phaseList);
				evt.pushHandler("dcwumei_phase", (event, option) => {
					if (event.step === 0 && option.state === "begin") {
						event.step = 4;
						_status.globalHistory.push({
							cardMove: [],
							custom: [],
							useCard: [],
							changeHp: [],
							everything: [],
						});
						var players = game.players.slice(0).concat(game.dead);
						for (var i = 0; i < players.length; i++) {
							var current = players[i];
							current.actionHistory.push({
								useCard: [],
								respond: [],
								skipped: [],
								lose: [],
								gain: [],
								sourceDamage: [],
								damage: [],
								custom: [],
								useSkill: [],
							});
							current.stat.push({ card: {}, skill: {} });
						}
					}
				});
			}
			const nexts = trigger.getParent()?.next;
			if (nexts?.length) {
				for (let evt of nexts.slice(0)) {
					if (evt.finished) {
						continue;
					}
					if (evt == next) {
						break;
					}
					nexts.remove(evt);
					nexts.push(evt);
				}
			}
		},
		subSkill: {
			wake: {
				init(player, skill) {
					if (!player.storage[skill]) {
						player.storage[skill] = [[], [], []];
					}
				},
				charlotte: true,
				onremove: true,
				trigger: { player: ["phaseBegin", "phaseEnd"] },
				filter(event, player) {
					return player.storage["dcwumei_wake"][2].includes(event);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const name = event.triggername;
					if (name === "phaseBegin") {
						for (const playerx of game.filterPlayer()) {
							player.storage[event.name][0].push(playerx);
							player.storage[event.name][1].push(playerx.hp);
						}
						player.markSkill(event.name);
					} else {
						const storage = player.getStorage(event.name);
						if (storage.length) {
							for (let i = 0; i < storage[0].length; i++) {
								const target = storage[0][i];
								if (target?.isIn?.()) {
									if (target.hp != storage[1][i]) {
										game.log(target, "将体力从", "#y" + target.hp, "改为", "#g" + storage[1][i]);
										const next = target.changeHp(storage[1][i] - target.hp);
										next._triggered = null;
										await next;
									}
								}
							}
						}
						player.storage[event.name][2].remove(trigger);
						player.storage[event.name][0] = player.storage[event.name][1] = [];
						player[player.storage[event.name][2].length ? "unmarkSkill" : "removeSkill"](event.name);
					}
				},
				marktext: "梦",
				intro: {
					markcount: (storage = [[]]) => storage[0].length,
					content(storage = [[]], player) {
						if (!storage.length) {
							return "无信息";
						}
						var str = "所有角色于回合开始时的体力值：<br>";
						for (var i = 0; i < storage[0].length; i++) {
							var str2 = get.translation(storage[0][i]) + "：" + storage[1][i];
							if (!storage[0][i].isIn()) {
								str2 = '<span style="opacity:0.5">' + str2 + "（已故）</span>";
							}
							str += "<li>" + str2;
						}
						return str;
					},
				},
				global: "dcwumei_all",
			},
			all: {
				mod: {
					aiOrder(player, card, num) {
						if (num <= 0 || !game.hasPlayer(t => t.marks["dcwumei_wake"])) {
							return;
						}
						if (get.tag(card, "recover") && !_status.event.dying && player.hp > 0) {
							return 0;
						}
						if (get.tag(card, "damage")) {
							if (
								card.name == "sha" &&
								game.hasPlayer(cur => {
									return cur.hp < 2 && player.canUse(card, cur, null, true) && get.effect(cur, card, player, player) > 0;
								})
							) {
								return num;
							}
							if (player.needsToDiscard()) {
								return num / 5;
							}
							return 0;
						}
					},
				},
			},
		},
	},
	dczhanmeng: {
		mark: true,
		intro: {
			mark(dialog, storage, player) {
				if (!player.hasStorage("dczhanmeng_choice", 0)) {
					const history1 = game
						.filterPlayer2(lib.filter.all, true)
						.reduce((list, current) => {
							const history = current.actionHistory;
							if (history.length < 2) {
								return list;
							}
							for (let i = history.length - 2; i >= 0; i--) {
								if (history[i].isSkipped) {
									continue;
								}
								list.addArray(history[i].useCard.map(evt => get.translation(evt.card.name)));
								return list;
							}
							return list;
						}, [])
						.sort(lib.sort.card);
					if (history1.length) {
						dialog.addText("占梦①：");
						dialog.addText(history1.join("、"));
					}
				}
				if (player.hasSkill("dczhanmeng_delay")) {
					const history = player.actionHistory;
					if (history.length < 2) {
						return false;
					}
					const history2 = history[history.length - 2].useCard.reduce((list, evt) => {
						if (evt["dczhanmeng_" + player.playerid]) {
							list.add(get.translation(evt.card.name));
						}
						return list;
					}, []);
					if (history2.length) {
						dialog.addText("占梦②：");
						dialog.addText(history2.join("、"));
					}
				}
			},
		},
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			return (
				!player.hasStorage("dczhanmeng_choice", 1) ||
				!player.hasStorage("dczhanmeng_choice", 2) ||
				(!player.hasStorage("dczhanmeng_choice", 0) &&
					!game.hasPlayer2(current => {
						const history = current.actionHistory;
						if (history.length < 2) {
							return false;
						}
						for (let i = history.length - 2; i >= 0; i--) {
							if (history[i].isSkipped) {
								continue;
							}
							const list = history[i].useCard.map(evt => evt.card.name);
							return list.includes(event.card.name);
						}
						return false;
					}, true))
			);
		},
		async cost(event, trigger, player) {
			let list = [],
				choiceList = ["上回合若没有同名牌被使用过，你获得一张非伤害牌", "下回合当同名牌首次被使用后，你获得一张伤害牌", "令一名其他角色弃置两张牌，若点数之和大于10，你对其造成1点火焰伤害"];
			let used = game.hasPlayer2(current => {
				let history = current.actionHistory;
				if (history.length < 2) {
					return false;
				}
				for (let i = history.length - 2; i >= 0; i--) {
					if (history[i].isSkipped) {
						continue;
					}
					const list = history[i].useCard.map(evt => evt.card.name);
					return list.includes(trigger.card.name);
				}
				return false;
			}, true);
			if (!player.hasStorage("dczhanmeng_choice", 0) && !used) {
				list.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5; ">' + choiceList[0] + (used ? "（同名牌被使用过）" : "（已选择）") + "</span>";
			}
			if (!player.hasStorage("dczhanmeng_choice", 1)) {
				list.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "（已选择）</span>";
			}
			let other = game.hasPlayer(current => current != player);
			if (!player.hasStorage("dczhanmeng_choice", 2) && other) {
				list.push("选项三");
			} else {
				choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + (!other ? "（没人啦）" : "（已选择）") + "</span>";
			}
			const result = await player
				.chooseControl(list, "cancel2")
				.set("prompt", get.prompt("dczhanmeng"))
				.set("ai", (event, player) => {
					const choices = _status.event.controls.slice().remove("cancel2"),
						evt = _status.event.getTrigger();
					if (choices.includes("选项三")) {
						if (
							game.hasPlayer(current => {
								if (current == player || !current.countDiscardableCards(current, "he")) {
									return false;
								}
								let eff1 = get.effect(current, { name: "guohe_copy2" }, player, player) + 0.1,
									eff2 = get.damageEffect(current, player, player, "fire") + 0.1;
								if (eff1 < 0 && eff2 < 0) {
									return false;
								}
								return eff1 * eff2 > 0;
							})
						) {
							return "选项三";
						}
						choices.remove("选项三");
					}
					if (choices.includes("选项二")) {
						if (evt.card.name == "sha") {
							return "选项二";
						}
						if (get.type(evt.card, null, false) == "equip") {
							choices.remove("选项二");
						}
					}
					if (!choices.length) {
						return "cancel2";
					}
					return choices.randomGet();
				})
				.set("choiceList", choiceList)
				.forResult();
			event.result = {
				bool: result?.control ? result.control != "cancel2" : false,
				cost_data: result?.control,
			};
		},
		popup: false,
		async content(event, trigger, player) {
			player.markAuto("dczhanmeng_choice", ["选项一", "选项二", "选项三"].indexOf(event.cost_data), true);
			player.addTempSkill("dczhanmeng_choice");
			if (event.cost_data != "选项三") {
				await player.logSkill(event.name);
				game.log(player, "选择了", "#y" + event.cost_data);
			}
			if (event.cost_data == "选项一") {
				let card = get.cardPile2(card => {
					return !get.is.damageCard(card);
				});
				if (card) {
					await player.gain(card, "gain2");
				}
			} else if (event.cost_data == "选项二") {
				trigger["dczhanmeng_" + player.playerid] = true;
				player.addSkill("dczhanmeng_delay");
			} else {
				const result = await player
					.chooseTarget("占梦：令一名其他角色弃置两张牌", lib.filter.notMe, true)
					.set("ai", target => {
						let player = _status.event.player;
						let eff1 = get.effect(target, { name: "guohe_copy2" }, player, player) + 0.1,
							eff2 = get.damageEffect(target, player, player, "fire") + 0.1;
						if (eff1 < 0 && eff2 < 0) {
							return -eff1 * eff2;
						}
						return eff1 * eff2;
					})
					.forResult();
				if (result?.bool && result.targets?.length) {
					const target = result.targets[0];
					await player.logSkill(event.name, target);
					game.log(player, "选择了", "#y选项三");
					if (target.countDiscardableCards(target, "he")) {
						const result2 = await target.chooseToDiscard(2, "he", true).forResult();
						if (result2?.bool && result2.cards?.length) {
							let num = result2.cards.reduce((sum, card) => sum + get.number(card, false), 0);
							if (num > 10) {
								player.line(target, "fire");
								await target.damage("fire");
							}
						}
					}
				}
			}
		},
		subSkill: {
			choice: {
				charlotte: true,
				onremove: true,
			},
			delay: {
				charlotte: true,
				trigger: { global: ["useCardAfter", "phaseBeginStart"] },
				filter(event, player, name) {
					let history = player.actionHistory;
					if (history.length < 2) {
						return false;
					}
					let list = history[history.length - 2].useCard;
					if (name == "phaseBeginStart") {
						return !list.some(evt => evt["dczhanmeng_" + player.playerid]);
					}
					for (let evt of list) {
						if (
							evt["dczhanmeng_" + player.playerid] &&
							event.card.name == evt.card.name &&
							game
								.getGlobalHistory("useCard", evtx => {
									return evtx.card.name == event.card.name;
								})
								.indexOf(event) == 0
						) {
							return true;
						}
					}
					return false;
				},
				forced: true,
				popup: false,
				silent: true,
				async content(event, trigger, player) {
					if (event.triggername != "phaseBeginStart") {
						await player.logSkill("dczhanmeng");
						let card = get.cardPile2(card => {
							return get.is.damageCard(card);
						});
						if (card) {
							await player.gain(card, "gain2");
						}
					} else {
						player.removeSkill(event.name);
					}
				},
			},
		},
		ai: { threaten: 8 },
	},
};
