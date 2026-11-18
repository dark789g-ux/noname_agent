import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<importCardConfig["card"], "jinchan" | "qijia" | "fulei" | "qibaodao" | "zhungangshuo" | "lanyinjia" | "yinyueqiang" | "shengdong" | "zengbin" | "caomu">} */
export const cards = {
	jinchan: {
		audio: true,
		fullskin: true,
		wuxieable: true,
		type: "trick",
		notarget: true,
		global: ["g_jinchan", "g_jinchan2"],
		async content(event, trigger, player) {
			const evt = event.getParent(3)._trigger;
			if (evt.jinchan) {
				const type = get.type(evt.card, "trick");
				if (type === "basic" || type === "trick") {
					evt.neutralize();
				}
			}
			await player.draw(2);
		},
		ai: {
			useful() {
				const player = _status.event.player;
				const nj = player.countCards("h", "jinchan");
				const num = player.getHandcardLimit();
				if (nj >= num) {
					return 10;
				}
				if (nj === num - 1) {
					return 6;
				}
				return 1;
			},
			result: {
				player: 1,
			},
			value: 5,
		},
	},
	qijia: {
		audio: true,
		fullskin: true,
		type: "trick",
		enable: true,
		filterTarget(card, player, target) {
			if (target === player) {
				return false;
			}
			if (target.getEquips(5).length) {
				return target.countCards("e") > 1;
			}
			return target.hasCards("e");
		},
		async content(event, trigger, player) {
			const target = event.target;
			const e1 = [];
			const e2 = [];
			const he = target.getCards("he");
			for (const card of he) {
				if (get.type(card) !== "equip") {
					continue;
				}
				const subtype = get.subtype(card);
				if (subtype === "equip1" || subtype === "equip4") {
					e1.push(card);
				} else if (subtype === "equip2" || subtype === "equip3") {
					e2.push(card);
				}
			}
			if (!e1.length || !e2.length) {
				if (e1.length) {
					await target.discard(e1);
				} else if (e2.length) {
					await target.discard(e2);
				}
				return;
			}
			let choice = 0;
			if (e1.length > e2.length || (target.hp >= 3 && Math.random() < 0.3)) {
				choice = 1;
			}
			const result = await target
				.chooseControl(choice)
				.set("choiceList", [`弃置${get.translation(e1)}`, `弃置${get.translation(e2)}`])
				.forResult();
			if (result.index === 0) {
				await target.discard(e1);
			} else {
				await target.discard(e2);
			}
		},
		ai: {
			order: 9.01,
			useful: 1,
			value: 5,
			result: {
				target(player, target) {
					let num1 = 0;
					let num2 = 0;
					for (let i = 1; i <= 4; i++) {
						const card = target.getEquip(i);
						if (!card) {
							continue;
						}
						if (i === 1 || i === 4) {
							num1 += get.equipValue(card);
						} else {
							num2 += get.equipValue(card);
						}
					}
					let num;
					if (num1 === 0) {
						num = num2;
					} else if (num2 === 0) {
						num = num1;
					} else {
						num = Math.min(num1, num2);
					}
					if (num > 0) {
						return -0.8 - num / 10;
					}
					return 0;
				},
			},
			tag: {
				loseCard: 1,
				discard: 1,
			},
		},
	},
	fulei: {
		audio: true,
		fullskin: true,
		type: "delay",
		cardnature: "thunder",
		modTarget(card, player, target) {
			return lib.filter.judge(card, player, target);
		},
		enable(card, player) {
			return player.canAddJudge(card);
		},
		filterTarget(card, player, target) {
			return lib.filter.judge(card, player, target) && player === target;
		},
		selectTarget: [-1, -1],
		toself: true,
		judge(card) {
			if (get.suit(card) === "spade") {
				return -6;
			}
			return 6;
		},
		judge2(result) {
			if (result.bool === false) {
				return true;
			}
			return false;
		},
		cardPrompt(card) {
			let str = "出牌阶段，对你使用。你将【浮雷】置入判定区。若判定结果为♠，则目标角色受到X点雷电伤害（X为此牌判定结果为♠的次数）。判定完成后，将此牌移动到下家的判定区里。";
			if (card.storage?.fulei) {
				str += `<br><span style="font-family:yuanli">此牌已判定命中过：${card.storage.fulei}次</span>`;
			}
			return str;
		},
		async effect(event, trigger, player, result) {
			const { card } = event;
			if (result.bool === false) {
				if (card) {
					if (typeof card.storage.fulei !== "number") {
						card.storage.fulei = 1;
					} else {
						card.storage.fulei++;
					}
					await player.damage(card.storage.fulei, "thunder", "nosource");
				}
			}
			await player.addJudgeNext(card);
		},
		async cancel(event, trigger, player) {
			await player.addJudgeNext(event.card);
		},
		ai: {
			basic: {
				order: 1,
				useful: 0,
				value: 0,
			},
			result: {
				target(player, target) {
					return lib.card.shandian.ai.result.target(player, target);
				},
			},
			tag: {
				damage: 0.25,
				natureDamage: 0.25,
				thunderDamage: 0.25,
			},
		},
	},
	qibaodao: {
		audio: true,
		fullskin: true,
		type: "equip",
		subtype: "equip1",
		bingzhu: ["曹操", "王允", "董卓"],
		skills: ["qibaodao", "qibaodao2"],
		distance: { attackFrom: -1 },
		ai: {
			equipValue(card, player) {
				if (game.hasPlayer(current => player.canUse("sha", current) && current.isHealthy() && get.attitude(player, current) < 0)) {
					return 5;
				}
				return 3;
			},
			basic: {
				equipValue: 5,
			},
		},
	},
	zhungangshuo: {
		audio: true,
		fullskin: true,
		type: "equip",
		subtype: "equip1",
		bingzhu: ["周泰"],
		skills: ["zhungangshuo"],
		distance: { attackFrom: -2 },
		ai: {
			equipValue: 4,
		},
	},
	lanyinjia: {
		fullskin: true,
		type: "equip",
		subtype: "equip2",
		skills: ["lanyinjia", "lanyinjia2"],
		ai: {
			equipValue: 6,
		},
	},
	yinyueqiang: {
		audio: true,
		fullskin: true,
		type: "equip",
		subtype: "equip1",
		bingzhu: ["赵云"],
		distance: { attackFrom: -2 },
		ai: {
			basic: {
				equipValue: 4,
			},
		},
		skills: ["yinyueqiang"],
	},
	shengdong: {
		audio: true,
		fullskin: true,
		enable() {
			return game.countPlayer() > 2;
		},
		recastable() {
			return game.countPlayer() <= 2;
		},
		singleCard: true,
		type: "trick",
		complexTarget: true,
		targetprompt: ["给一张牌", "得两张牌"],
		filterTarget(card, player, target) {
			return target !== player;
		},
		filterAddedTarget(card, player, target, preTarget) {
			return target !== preTarget && target !== player;
		},
		async content(event, trigger, player) {
			if (!player.hasCards("h")) {
				return;
			}
			event.target1 = event.target;
			event.target2 = event.addedTarget;
			const result = await player
				.chooseCard({
					prompt: `将一张手牌交给${get.translation(event.target1)}`,
					position: "h",
					forced: true,
				})
				.forResult();
			await player.give(result.cards, event.target1);
			if (!event.target1.hasCards("h") || !event.target2 || !event.target2.isIn()) {
				return;
			}
			const he = event.target1.getCards("he");
			if (he.length <= 2) {
				event.directresult = he;
			} else {
				const result2 = await event.target1
					.chooseCard({
						prompt: `将两张牌交给${get.translation(event.target2)}`,
						selectCard: 2,
						position: "he",
						forced: true,
					})
					.forResult();
				event.directresult = result2.cards;
			}
			await event.target1.give(event.directresult, event.target2);
		},
		ai: {
			order: 2.5,
			value: [4, 1],
			useful: 1,
			wuxie() {
				return 0;
			},
			result: {
				target(player, target) {
					const hs = player.getCards("h");
					if (hs.length <= 1 || !hs.some(i => get.value(i) < 5.5)) {
						return 0;
					}
					const targets = get.copy(ui.selected.targets);
					if (_status.event.preTarget) {
						targets.add(_status.event.preTarget);
					}
					if (targets.length) {
						if (target.hasSkillTag("nogain")) {
							return 0.01;
						}
						return 2;
					}
					if (!target.hasCards("he")) {
						return 0;
					}
					if (player.hasFriend()) {
						return -1;
					}
					return 0;
				},
			},
		},
	},
	zengbin: {
		audio: true,
		fullskin: true,
		enable: true,
		type: "trick",
		filterTarget: true,
		async content(event, trigger, player) {
			const target = event.target;
			await target.draw(3);
			if (!target.hasCards("he", card => get.type(card) !== "basic")) {
				await target.chooseToDiscard({
					selectCard: 2,
					position: "he",
					forced: true,
					ai: get.disvalue2,
				});
				return;
			}
			const result = await target
				.chooseToDiscard({
					prompt: "增兵减灶",
					prompt2: "弃置一张非基本牌，或取消并弃置两张牌",
					filterCard(card) {
						return get.type(card) !== "basic";
					},
					position: "he",
					ai(card) {
						if (_status.event.goon) {
							return 8 - get.value(card);
						}
						return 11 - get.value(card);
					},
				})
				.set("goon", target.countCards("h", card => get.value(card, target, "raw") < 8) > 1)
				.forResult();
			if (!result.bool) {
				await target.chooseToDiscard({
					selectCard: 2,
					position: "he",
					forced: true,
					ai: get.disvalue2,
				});
			}
		},
		ai: {
			order: 7,
			useful: 4,
			value: 10,
			tag: {
				draw: 3,
				discard: 1,
			},
			result: {
				target(player, target) {
					if (target.hasJudge("lebu")) {
						return 0;
					}
					return Math.max(1, 2 - target.countCards("h") / 10);
				},
			},
		},
	},
	caomu: {
		audio: true,
		fullskin: true,
		enable: true,
		type: "delay",
		filterTarget(card, player, target) {
			return lib.filter.judge(card, player, target) && player !== target;
		},
		judge(card) {
			if (get.suit(card) === "club") {
				return 1;
			}
			return -3;
		},
		judge2(result) {
			if (result.bool === false) {
				return true;
			}
			return false;
		},
		async effect(event, trigger, player, result) {
			if (result.bool === false) {
				player.addTempSkill("caomu_skill");
			}
		},
		ai: {
			basic: {
				order: 1,
				useful: 1,
				value: 4.5,
			},
			result: {
				player(player, target) {
					return game.countPlayer(current => {
						if (get.distance(target, current) > 1 || current === target) {
							return;
						}
						const att = get.attitude(player, current);
						if (att > 3) {
							return 1.1;
						}
						if (att > 0) {
							return 1;
						}
						if (att < -3) {
							return -1.1;
						}
						if (att < 0) {
							return -1;
						}
					});
				},
				target(player, target) {
					if (target.hasJudge("bingliang")) {
						return 0;
					}
					return -1.5 / Math.sqrt(target.countCards("h") + 1);
				},
			},
		},
	},
};
