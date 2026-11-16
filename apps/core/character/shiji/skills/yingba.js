import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yingba" | "scfuhai" | "pinghe" | "tianzuo">} */
export const groupSkills = {
	yingba: {
		audio: 2,
		mod: {
			aiOrder(player, card, num) {
				if (num > 0 && _status.event && _status.event.type == "phase" && get.tag(card, "recover")) {
					if (player.needsToDiscard()) {
						return num / 3;
					}
					return 0;
				}
			},
			targetInRange(card, player, target) {
				if (target.hasMark("yingba_mark")) {
					return true;
				}
			},
		},
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => get.info("yingba").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return target != player && target.maxHp > 1;
		},
		async content(event, trigger, player) {
			const { target } = event;
			await target.loseMaxHp();
			if (target.isIn()) {
				target.addMark("yingba_mark", 1);
			}
			await player.loseMaxHp();
		},
		locked: false,
		//global:'yingba_mark',
		ai: {
			threaten(player, target) {
				if (player === target || player.isDamaged() || get.attitude(player, target) > 0) {
					return 1;
				}
				return 8 / player.maxHp;
			},
			order: 11,
			result: {
				player(player, target) {
					if (player.maxHp == 1) {
						return -2.5;
					}
					return -0.25;
				},
				target(player, target) {
					if (target.isHealthy()) {
						return -2;
					}
					if (!target.hasMark("yingba_mark")) {
						return -1;
					}
					return -0.2;
				},
			},
		},
		subSkill: {
			mark: {
				marktext: "定",
				intro: {
					name: "平定",
					content: "mark",
					onunmark: true,
				},
				mod: {
					maxHandcard(player, numx) {
						const num = player.countMark("yingba_mark");
						if (num) {
							return numx + num * game.countPlayer(current => current.hasSkill("yingba"));
						}
					},
				},
			},
		},
	},
	scfuhai: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		forced: true,
		filter(event, player) {
			return event.target.hasMark("yingba_mark");
		},
		logTarget: "target",
		async content(event, trigger, player) {
			trigger.getParent().directHit.add(trigger.target);
			if (player.getHistory("gain", evt => evt.getParent(2).name == "scfuhai").length < 2) {
				await player.draw();
			}
		},
		group: ["scfuhai_die"],
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return arg && arg.target && arg.target.hasMark("yingba_mark");
			},
			combo: "yingba",
		},
		subSkill: {
			usea: {
				audio: "scfuhai",
				trigger: { player: "useCardAfter" },
				forced: true,
				filter(event, player) {
					return lib.skill.scfuhai_usea.logTarget(event, player).length > 0;
				},
				logTarget(event, player) {
					return event.targets.filter(target => target.hasMark("yingba_mark")).sortBySeat();
				},
				async content(event, trigger, player) {
					let num = 0;
					for (const target of trigger.targets) {
						const numx = target.countMark("yingba_mark");
						if (numx) {
							num += numx;
							target.clearMark("yingba_mark");
						}
					}
					if (num) {
						await player.gainMaxHp(num);
					}
				},
			},
			die: {
				audio: "scfuhai",
				trigger: { global: "die" },
				forced: true,
				filter(event, player) {
					return event.player.hasMark("yingba_mark");
				},
				async content(event, trigger, player) {
					const num = trigger.player.countMark("yingba_mark");
					await player.gainMaxHp(num);
					await player.draw(num);
				},
			},
		},
	},
	pinghe: {
		derivation: "yingba",
		audio: 2,
		mod: {
			maxHandcardBase(player) {
				return player.getDamagedHp();
			},
		},
		trigger: { player: "damageBegin4" },
		forced: true,
		filter(event, player) {
			return event.source && event.source != player && player.maxHp > 1 && player.hasCards("h");
		},
		async content(event, trigger, player) {
			trigger.cancel();
			await player.loseMaxHp();
			if (game.hasPlayer(current => current != player) && player.hasCards("h")) {
				const result = await player
					.chooseCardTarget({
						prompt: "请选择【冯河】的牌和目标",
						prompt2: `将一张手牌交给一名其他角色并防止伤害${player.hasSkill("yingba") ? `，然后令${get.translation(trigger.source)}获得1枚“平定”标记` : ""}`,
						filterCard: true,
						forced: true,
						filterTarget: lib.filter.notMe,
						ai1(card) {
							const player = get.player();
							if (
								get.tag(card, "recover") &&
								!game.hasPlayer(current => {
									return get.attitude(current, player) > 0 && !current.hasSkillTag("nogain");
								})
							) {
								return 0;
							}
							return 1 / Math.max(0.1, get.value(card));
						},
						ai2(target) {
							const player = get.player();
							let att = get.attitude(player, target);
							if (target.hasSkillTag("nogain")) {
								att /= 9;
							}
							return 4 + att;
						},
					})
					.forResult();
				if (result?.bool) {
					const target = result.targets[0];
					player.line(target, "green");
					await player.give(result.cards, target);
					if (player.hasSkill("yingba")) {
						trigger.source.addMark("yingba_mark", 1);
					}
				}
			}
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player !== target && target.maxHp > 1 && target.countCards("h") > 0) {
						if (get.tag(card, "damage") && target.hasSkill("yingba")) {
							let damage = 1.6;
							if (target.isHealthy()) {
								damage += 1.6;
							}
							if (
								game.hasPlayer(cur => {
									return cur !== target && get.attitude(target, cur) > 0;
								})
							) {
								damage -= 0.9;
							}
							return [0, -damage, 0, -0.4];
						}
						if (card.name === "tiesuo") {
							return 0.4;
						}
					}
					if (get.tag(card, "recover") && _status.event.type == "phase" && !player.needsToDiscard()) {
						return 0;
					}
				},
			},
		},
	},
	tianzuo: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && !lib.inpile.includes("qizhengxiangsheng");
		},
		async content(event, trigger, player) {
			game.addGlobalSkill("tianzuo_global");
			const cards = [];
			for (let i = 2; i < 10; i++) {
				cards.push(game.createCard2("qizhengxiangsheng", i % 2 ? "club" : "spade", i));
			}
			game.broadcastAll(() => void lib.inpile.add("qizhengxiangsheng"));
			game.cardsGotoPile(cards, () => {
				return ui.cardPile.childNodes[get.rand(0, ui.cardPile.childNodes.length - 1)];
			});
		},
		group: "tianzuo_remove",
		subSkill: {
			remove: {
				audio: "tianzuo",
				trigger: { target: "useCardToBefore" },
				forced: true,
				priority: 15,
				filter(event, player) {
					return event.card && event.card.name == "qizhengxiangsheng";
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (card && card.name == "qizhengxiangsheng") {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
			global: {
				trigger: { player: "useCardToPlayered" },
				forced: true,
				popup: false,
				filter(event, player) {
					return event.card.name == "qizhengxiangsheng";
				},
				async content(event, trigger, player) {
					const target = trigger.target;
					event.target = target;
					let result = await player
						.chooseControl("奇兵", "正兵")
						.set("prompt", "请选择" + get.translation(target) + "的标记")
						.set(
							"choice",
							(function () {
								var e1 = 1.5 * get.sgn(get.damageEffect(target, player, target));
								var e2 = 0;
								if (target.countGainableCards(player, "h") > 0 && !target.hasSkillTag("noh")) {
									e2 = -1;
								}
								var es = target.getGainableCards(player, "e");
								if (es.length) {
									e2 = Math.min(
										e2,
										(function () {
											var max = 0;
											for (var i of es) {
												max = Math.max(max, get.value(i, target));
											}
											return -max / 4;
										})()
									);
								}
								if (Math.abs(e1 - e2) <= 0.3) {
									return Math.random() < 0.5 ? "奇兵" : "正兵";
								}
								if (e1 < e2) {
									return "奇兵";
								}
								return "正兵";
							})()
						)
						.set("ai", function () {
							return _status.event.choice;
						})
						.forResult();

					let map = trigger.getParent().customArgs,
						id = target.playerid;
					if (!map[id]) {
						map[id] = {};
					}
					map[id].qizheng_name = result.control;
				},
			},
			rewrite: {
				audio: "tianzuo",
				trigger: { global: "useCardToTargeted" },
				filter(event, player) {
					return event.card.name == "qizhengxiangsheng";
				},
				logTarget: "target",
				prompt2: "观看其手牌并修改“奇正相生”标记",
				async content(event, trigger, player) {
					let target = trigger.target;
					event.target = target;
					if (player != target && target.countCards("h") > 0) {
						await player.viewHandcards(target);
					}
					let result = await player
						.chooseControl("奇兵", "正兵")
						.set("prompt", "请选择" + get.translation(target) + "的标记")
						.set(
							"choice",
							(function () {
								var shas = target.getCards("h", "sha"),
									shans = target.getCards("h", "shan");
								var e1 = 1.5 * get.sgn(get.damageEffect(target, player, target));
								var e2 = 0;
								if (target.countGainableCards(player, "h") > 0 && !target.hasSkillTag("noh")) {
									e2 = -1;
								}
								var es = target.getGainableCards(player, "e");
								if (es.length) {
									e2 = Math.min(
										e2,
										(function () {
											var max = 0;
											for (var i of es) {
												max = Math.max(max, get.value(i, target));
											}
											return -max / 4;
										})()
									);
								}
								if (get.attitude(player, target) > 0) {
									if (shas.length >= Math.max(1, shans.length)) {
										return "奇兵";
									}
									if (shans.length > shas.length) {
										return "正兵";
									}
									return e1 > e2 ? "奇兵" : "正兵";
								}
								if (shas.length) {
									e1 = -0.5;
								}
								if (shans.length) {
									e2 = -0.7;
								}
								if (Math.abs(e1 - e2) <= 0.3) {
									return Math.random() < 0.5 ? "奇兵" : "正兵";
								}
								var rand = Math.random();
								if (e1 < e2) {
									return rand < 0.1 ? "奇兵" : "正兵";
								}
								return rand < 0.1 ? "正兵" : "奇兵";
							})()
						)
						.set("ai", () => _status.event.choice)
						.forResult();

					let map = trigger.getParent().customArgs,
						id = target.playerid;
					if (!map[id]) {
						map[id] = {};
					}
					map[id].qizheng_name = result.control;
					map[id].qizheng_aibuff = get.attitude(player, target) > 0;
				},
			},
		},
	},
};
