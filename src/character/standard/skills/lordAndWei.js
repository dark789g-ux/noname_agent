import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdqingjiao" | "stdxiaoguo" | "stdshushen" | "stdkuangfu" | "rewangzun" | "rewangzun2" | "retongji" | "hujia" | "jianxiong" | "fankui">} */
export const lordAndWeiSkills = {
	//主公吕布
	stdqingjiao: {
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		zhuSkill: true,
		filter(event, player) {
			return player.hasHistory("sourceDamage", evt => evt.player !== player && evt.player?.group === "qun");
		},
		forced: true,
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	//标准版乐进
	stdxiaoguo: {
		audio: "xiaoguo",
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return (
				event.player.isIn() &&
				event.player !== player &&
				player.hasCards("h", card => {
					if (_status.connectMode) {
						return true;
					}
					return get.type(card) === "basic" && lib.filter.cardDiscardable(card, player);
				})
			);
		},
		async cost(event, trigger, player) {
			const target = trigger.player;

			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt(event.skill),
					filterCard(card, player) {
						return get.type(card) === "basic";
					},
					chooseonly: true,
					ai(card) {
						return get.event().eff - get.useful(card);
					},
				})
				.set(
					"eff",
					(() => {
						if (target.hasSkillTag("noe")) {
							return get.attitude(_status.event.player, target);
						}
						return get.damageEffect(target, player, _status.event.player);
					})()
				)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player;
			await player.discard({
				cards: event.cards,
				discarder: player,
			});
			const { bool } = await target
				.chooseToDiscard({
					prompt: "弃置一张装备牌，或受到1点伤害",
					filterCard: get.filter({ type: "equip" }),
					position: "he",
					ai(card) {
						if (get.event().damage > 0) {
							return 0;
						}
						if (get.event().noe) {
							return 12 - get.value(card);
						}
						return -get.event().damage - get.value(card);
					},
				})
				.set("damage", get.damageEffect(target, player, target))
				.set("noe", target.hasSkillTag("noe"))
				.forResult();
			if (!bool) {
				await target.damage();
			}
		},
	},
	//标准版甘夫人
	stdshushen: {
		audio: "shushen",
		trigger: { player: "recoverEnd" },
		getIndex(event) {
			return event.num || 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget: lib.filter.notMe,
					ai(target) {
						return get.attitude(get.player(), target);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.draw(target.hasCards("h") ? 1 : 2);
		},
		ai: { threaten: 0.8, expose: 0.1 },
	},
	stdkuangfu: {
		audio: "xinkuangfu",
		trigger: { source: "damageSource" },
		forced: true,
		filter(event, player) {
			if (player.hasSkill("stdkuangfu_used")) {
				return false;
			}
			return player.isPhaseUsing() && event.card && event.card.name === "sha" && event.player !== player && event.player.isIn();
		},
		async content(event, trigger, player) {
			player.addTempSkill("stdkuangfu_used", "phaseChange");
			if (trigger.player.hp < player.hp) {
				await player.draw(2);
			} else {
				await player.loseHp();
			}
		},
		ai: {
			halfneg: true,
		},
		subSkill: {
			used: {
				charlotte: true,
			},
		},
	},
	rewangzun: {
		trigger: { global: "phaseZhunbeiBegin" },
		forced: true,
		audio: "wangzun",
		filter(event, player) {
			return event.player.hp > player.hp;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.draw();
			let zhu = false;
			const target = trigger.player;
			switch (get.mode()) {
				case "identity": {
					zhu = target.isZhu;
					break;
				}
				case "guozhan": {
					zhu = get.is.jun(target);
					break;
				}
				case "versus": {
					zhu = target.identity == "zhu";
					break;
				}
				case "doudizhu": {
					zhu = target == game.zhu;
					break;
				}
			}
			if (zhu) {
				await player.draw();
				target.addTempSkill("rewangzun2");
				target.addMark("rewangzun2", 1, false);
			}
		},
	},
	rewangzun2: {
		onremove: true,
		mod: {
			maxHandcard(player, num) {
				return num - player.countMark("rewangzun2");
			},
		},
		intro: { content: "手牌上限-#" },
	},
	retongji: {
		trigger: { global: "useCardToTarget" },
		logTarget: "target",
		audio: "tongji",
		filter(event, player) {
			return event.card.name === "sha" && event.player !== player && !event.targets.includes(player) && event.target.inRange(player) && event.target.hasCards("he");
		},
		async cost(event, trigger, player) {
			event.result = await trigger.target
				.chooseToDiscard({
					prompt: get.prompt("retongji", player),
					prompt2: `弃置一张牌，将${get.translation(trigger.card)}转移给${get.translation(player)}`,
					position: "he",
					chooseonly: true,
					ai(card) {
						if (!_status.event.check) {
							return -1;
						}
						return get.unuseful(card) + 9;
					},
				})
				.set(
					"check",
					(() => {
						if (trigger.target.hasCards("h", "shan")) {
							return -get.attitude(trigger.target, player);
						}
						if (get.attitude(trigger.target, player) < 5) {
							return 6 - get.attitude(trigger.target, player);
						}
						if (trigger.target.hp === 1 && !player.hasCards("h", "shan")) {
							return 10 - get.attitude(trigger.target, player);
						}
						if (trigger.target.hp === 2 && !player.hasCards("h", "shan")) {
							return 8 - get.attitude(trigger.target, player);
						}
						return -1;
					})() > 0
				)
				.forResult();
		},
		async content(event, trigger, player) {
			const evt = trigger.getParent();
			if (evt == null) {
				throw new ReferenceError("找不到触发【同疾】的使用牌事件");
			}
			await trigger.target.discard({
				cards: event.cards,
				discarder: trigger.target,
			});
			evt.triggeredTargets2.remove(trigger.target);
			evt.targets.remove(trigger.target);
			evt.targets.push(player);
		},
		ai: {
			neg: true,
		},
	},
	hujia: {
		audio: 2,
		audioname: ["re_caocao"],
		audioname2: {
			pe_jun_caocao: "sbhujia",
		},
		zhuSkill: true,
		trigger: { player: ["chooseToRespondBefore", "chooseToUseBefore"] },
		filter(event, player) {
			if (event.responded) {
				return false;
			}
			if (player.storage.hujiaing) {
				return false;
			}
			if (!player.hasZhuSkill("hujia")) {
				return false;
			}
			if (!event.filterCard({ name: "shan", isCard: true }, player, event)) {
				return false;
			}
			return game.hasPlayer(current => current !== player && current.group === "wei");
		},
		check(event, player) {
			if (get.damageEffect(player, event.player, player) >= 0) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			let current = player.next;
			while (true) {
				event.current = current;
				if (current === player) {
					return;
				}

				let bool = false;
				if (current.group === "wei") {
					if ((current === game.me && !_status.auto) || get.attitude(current, player) > 2 || current.isOnline()) {
						player.storage.hujiaing = true;
						const next = current.chooseToRespond({
							prompt: `是否替${get.translation(player)}打出一张闪？`,
							filterCard: get.filter({ name: "shan" }),
							ai() {
								const event = get.event();
								return get.attitude(event.player, event.source) - 2;
							},
						});
						next.set("skillwarn", `替${get.translation(player)}打出一张闪`);
						next.autochoose = lib.filter.autoRespondShan;
						next.set("source", player);
						bool = !!(await next.forResult()).bool;
					}
				}
				player.storage.hujiaing = false;
				if (bool) {
					trigger.result = { bool: true, card: { name: "shan", isCard: true } };
					trigger.responded = true;
					trigger.animate = false;
					if (typeof current.ai.shown === "number" && current.ai.shown < 0.95) {
						current.ai.shown += 0.3;
						if (current.ai.shown > 0.95) {
							current.ai.shown = 0.95;
						}
					}
					return;
				} else {
					current = current.next;
				}
			}
		},
		ai: {
			respondShan: true,
			skillTagFilter(player) {
				if (player.storage.hujiaing) {
					return false;
				}
				if (!player.hasZhuSkill("hujia")) {
					return false;
				}
				return game.hasPlayer(current => current != player && current.group == "wei");
			},
		},
	},
	jianxiong: {
		audio: 2,
		audioname2: { caoying: "lingren_jianxiong" },
		preHidden: true,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return get.itemtype(event.cards) === "cards" && get.position(event.cards[0], true) === "o";
		},
		async content(event, trigger, player) {
			player.gain({
				cards: trigger.cards,
				animate: "gain2",
			});
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1];
					}
					if (get.tag(card, "damage")) {
						return [1, 0.55];
					}
				},
			},
		},
	},
	fankui: {
		audio: 2,
		trigger: { player: "damageEnd" },
		logTarget: "source",
		preHidden: true,
		filter(event, player) {
			return event.num > 0 && event.source?.hasGainableCards(player, event.source !== player ? "he" : "e");
		},
		async content(event, trigger, player) {
			player.gainPlayerCard({
				target: trigger.source,
				position: trigger.source !== player ? "he" : "e",
				forced: true,
			});
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.countCards("he") > 1 && get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -1.5];
						}
						if (get.attitude(target, player) < 0) {
							return [1, 1];
						}
					}
				},
			},
		},
	},
};
