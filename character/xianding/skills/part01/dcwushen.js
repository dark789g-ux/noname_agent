import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcwushen" | "dcwuhun" | "dclongnu" | "dcjieying">} */
export const groupSkills = {
	//神关羽
	dcwushen: {
		audio: "wushen",
		mod: {
			cardname(card, player, name) {
				if (get.suit(card) === "heart") {
					return "sha";
				}
			},
			cardnature(card, player) {
				if (get.suit(card) === "heart") {
					return false;
				}
			},
			targetInRange(card) {
				if (card.name === "sha") {
					const suit = get.suit(card);
					if (suit === "heart" || suit === "unsure") {
						return true;
					}
				}
			},
			cardUsable(card) {
				if (card.name === "sha") {
					const suit = get.suit(card);
					if (suit === "heart" || suit === "unsure") {
						return Infinity;
					}
				}
			},
		},
		trigger: { player: "useCard" },
		filter(event, player) {
			return event.card.name === "sha" && get.suit(event.card) === "heart";
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.addCount !== false) {
				trigger.addCount = false;
				if (player.stat[player.stat.length - 1].card.sha > 0) {
					player.stat[player.stat.length - 1].card.sha--;
				}
			}
			trigger.card.storage ??= {};
			trigger.card.storage[event.name] = true;
		},
		group: "dcwushen_damage",
		subSkill: {
			damage: {
				trigger: {
					source: "damageSource",
				},
				filter(event, player) {
					if (!event.card || event.card.name != "sha" || get.suit(event.card) != "heart") {
						return false;
					}
					return event.card.storage?.dcwushen;
				},
				forced: true,
				silent: true,
				async content(event, trigger, player) {
					await player.draw({ num: 1 });
				},
			},
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "respondSha") && current < 0) {
						return 0.6;
					}
				},
			},
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return arg.card.name === "sha" && get.suit(arg.card) === "heart";
			},
		},
	},
	dcwuhun: {
		marktext: "魇",
		intro: {
			name: "梦魇",
			content: "mark",
			onunmark: true,
		},
		audio: "wuhun2",
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		filter(event, player, name) {
			const target = name === "damageSource" ? event.player : event.source;
			return target?.isIn() && event.num > 0;
		},
		forced: true,
		logTarget(event, player, name) {
			return name === "damageSource" ? event.player : event.source;
		},
		async content(event, trigger, player) {
			const { targets } = event;
			targets[0].addMark(event.name, trigger.num);
		},
		group: "dcwuhun_die",
		subSkill: {
			die: {
				audio: "wuhun2",
				trigger: {
					player: "die",
				},
				filter(event, player) {
					return game.hasPlayer(function (current) {
						return current != player && current.hasMark("dcwuhun");
					});
				},
				forced: true,
				direct: true,
				forceDie: true,
				skillAnimation: true,
				animationColor: "soil",
				async content(event, trigger, player) {
					let maxNum = 0;
					for (const current of game.players) {
						if (current === player) {
							continue;
						}

						const markNum = current.countMark("dcwuhun");
						maxNum = Math.max(maxNum, markNum);
					}
					const num = maxNum;
					let result = await player
						.chooseTarget({
							forced: true,
							prompt: "###请选择【武魂】的目标###令其进行判定，若判定结果不为【桃】或【桃园结义】，则其死亡",
							filterTarget(card, player, target) {
								return target != player && target.countMark("dcwuhun") == get.event().num;
							},
							ai: target => -get.attitude(get.player(), target),
							forceDie: true,
							num,
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						const target = result.targets[0];
						event.target = target;
						player.logSkill(event.name, target);
						player.line(target, { color: [255, 255, 0] });
						await game.delay(2);
						result = await target
							.judge({
								judgestr: get.translation(event.name),
								judge: card => (["tao", "taoyuan"].includes(card.name) ? 10 : -10),
								jugde2: result => !result.bool,
							})
							.forResult();
						if (!result.bool) {
							await target.die();
						}
					}
				},
			},
		},
		ai: {
			notemp: true,
			effect: {
				target: (card, player, target) => {
					if (!target.hasFriend()) {
						return;
					}
					let rec = get.tag(card, "recover"),
						damage = get.tag(card, "damage");
					if (!rec && !damage) {
						return;
					}
					if (damage && player.hasSkillTag("jueqing", false, target)) {
						return 1.7;
					}
					let die = [null, 1],
						temp;
					game.filterPlayer(i => {
						temp = i.countMark("dcwuhun");
						if (i === player && target.hp + target.hujia > 1) {
							temp++;
						}
						if (temp > die[1]) {
							die = [i, temp];
						} else if (temp === die[1]) {
							if (!die[0]) {
								die = [i, temp];
							} else if (get.attitude(target, i) < get.attitude(target, die[0])) {
								die = [i, temp];
							}
						}
					});
					if (die[0]) {
						if (damage) {
							return [1, 0, 1, (-6 * get.sgnAttitude(player, die[0])) / Math.max(1, target.hp)];
						}
						return [1, (6 * get.sgnAttitude(player, die[0])) / Math.max(1, target.hp)];
					}
				},
			},
		},
	},
	//神刘备
	dclongnu: {
		audio: "nzry_longnu",
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage, player, skill) {
				if (storage) {
					return "锁定技，出牌阶段开始时，你减1点体力上限并摸体力值张牌，然后本阶段内你的锦囊牌均视为雷杀（无次数限制且不计入次数限制）";
				}
				return "锁定技，出牌阶段开始时，你失去1点体力并摸已损失体力值张牌，然后本阶段内你的红色手牌均视为火杀（无距离限制）";
			},
		},
		trigger: {
			player: "phaseUseBegin",
		},
		forced: true,
		async content(event, trigger, player) {
			const storage = player.getStorage(event.name, false);
			player.changeZhuanhuanji(event.name);
			let num;
			if (storage) {
				await player.loseMaxHp();
				num = player.getHp();
			} else {
				await player.loseHp();
				num = player.getDamagedHp();
			}
			if (num > 0) {
				await player.draw({ num });
			}
			if (storage) {
				player.addTempSkill("dclongnu_2", "phaseUseAfter");
			} else {
				player.addTempSkill("dclongnu_1", "phaseUseAfter");
			}
		},
		subSkill: {
			1: {
				charlotte: true,
				mod: {
					cardname(card, player) {
						if (get.color(card) === "red") {
							return "sha";
						}
					},
					cardnature(card, player) {
						if (get.color(card) === "red") {
							return "fire";
						}
					},
					targetInRange(card) {
						if (get.color(card) === "red") {
							return true;
						}
					},
				},
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondSha") && current < 0) {
								return 0.6;
							}
						},
					},
					respondSha: true,
				},
			},
			2: {
				charlotte: true,
				mod: {
					cardname(card, player) {
						if (["trick", "delay"].includes(lib.card[card.name].type)) {
							return "sha";
						}
					},
					cardnature(card, player) {
						if (["trick", "delay"].includes(lib.card[card.name].type)) {
							return "thunder";
						}
					},
					cardUsable(card, player) {
						if (card.name == "sha" && game.hasNature(card, "thunder")) {
							return Infinity;
						}
					},
				},
				trigger: {
					player: "useCard",
				},
				filter(event, player) {
					return event.card.name === "sha" && game.hasNature(event.card, "thunder") && event.addCount !== false;
				},
				forced: true,
				silent: true,
				async content(event, trigger, player) {
					trigger.addCount = false;
					if (player.stat[player.stat.length - 1].card.sha > 0) {
						player.stat[player.stat.length - 1].card.sha--;
					}
				},
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondSha") && current < 0) {
								return 0.6;
							}
						},
					},
					respondSha: true,
				},
			},
		},
		ai: {
			fireAttack: true,
			halfneg: true,
			threaten: 1.05,
		},
	},
	dcjieying: {
		audio: "nzry_jieying",
		trigger: {
			player: ["linkBefore", "enterGame"],
			global: "phaseBefore",
		},
		forced: true,
		filter(event, player) {
			if (event.name === "link") {
				return player.isLinked();
			}
			return (event.name != "phase" || game.phaseNumber === 0) && !player.isLinked();
		},
		async content(event, trigger, player) {
			if (trigger.name != "link") {
				await player.link(true);
			} else {
				trigger.cancel();
			}
		},
		group: "dcjieying_phaseJieshu",
		global: "dcjieying_global",
		subSkill: {
			phaseJieshu: {
				audio: "nzry_jieying",
				trigger: {
					player: "phaseJieshuBegin",
				},
				filter(event, player) {
					return game.hasPlayer(function (current) {
						return current != player && !current.isLinked();
					});
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget({
							prompt: "结营:请选择横置的目标",
							forced: true,
							filterTarget(card, player, target) {
								return target != player && !target.isLinked();
							},
							ai(target) {
								return get.effect(target, { name: "tiesuo" }, player, player);
							},
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const { targets } = event;
					await targets[0].link(true);
					const result = await player
						.chooseTarget({
							prompt: "结营:请选择摸牌的目标",
							forced: true,
							selectTarget: [1, Infinity],
							filterTarget(card, player, target) {
								return target.isLinked();
							},
							ai(target) {
								return get.effect(target, { name: "draw" }, player, player);
							},
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						result.targets.sortBySeat(player);
						player.logSkill(event.name, result.targets);
						player.line(result.targets);
						await game.asyncDraw(result.targets);
					}
				},
			},
			global: {
				charlotte: true,
				mod: {
					maxHandcard(player, num) {
						if (
							game.hasPlayer(function (current) {
								return current.hasSkill("dcjieying");
							}) &&
							player.isLinked()
						) {
							return num + 2;
						}
					},
				},
			},
		},
		ai: {
			noLink: true,
			effect: {
				target(card) {
					if (card.name === "tiesuo") {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
};
