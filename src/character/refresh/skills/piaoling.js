import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const piaolingSkills = {
	piaoling: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		async content(event, trigger, player) {
			const result = await player
				.judge(function (card) {
					return get.suit(card) == "heart" ? 2 : 0;
				})
				.set("judge2", function (result) {
					return result.bool ? true : false;
				})
				.forResult();
			if (result?.card && result.suit == "heart") {
				const { card } = result;
				if (get.position(card, true) == "d") {
					const result2 = await player
						.chooseTarget("飘零：令一名角色获得" + get.translation(card) + "，或点【取消】将其置于牌堆顶")
						.set("ai", function (target) {
							var player = _status.event.player;
							var att = get.attitude(player, target);
							if (player == target) {
								att /= 2;
							}
							return att;
						})
						.forResult();
					if (result2.bool && result2.targets?.length) {
						const {
							targets: [target],
						} = result2;
						player.line(target, "green");
						await target.gain(card, "gain2");
						if (player == target) {
							await player.chooseToDiscard("he", true);
						}
					} else {
						game.log(player, "将", card, "置于牌堆顶");
						await game.cardsGotoPile(card, "insert");
					}
				}
			}
		},
	},
	xinyicong: {
		audio: "yicong",
		mod: {
			globalFrom(from, to, current) {
				return current - Math.max(0, from.hp - 1);
			},
			globalTo(from, to, current) {
				return current + Math.max(0, to.getDamagedHp() - 1);
			},
		},
		ai: {
			threaten: 0.8,
		},
	},
	rezongshi: {
		audio: 2,
		mod: {
			maxHandcard(player, num) {
				return num + game.countGroup();
			},
		},
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			return player.countCards("h") > player.hp;
		},
		async content(event, trigger, player) {
			player.addTempSkill("rezongshi_paoxiao");
		},
	},
	rezongshi_paoxiao: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return Infinity;
				}
			},
		},
	},
	olbaonue: {
		audio: 2,
		zhuSkill: true,
		trigger: { global: "damageSource" },
		filter(event, player) {
			if (player == event.source || !event.source || event.source.group != "qun") {
				return false;
			}
			return player.hasZhuSkill("olbaonue", event.source);
		},
		getIndex: event => event.num,
		logTarget: "source",
		async content(event, trigger, player) {
			const next = player.judge(card => {
				if (get.suit(card) == "spade") {
					return 4;
				}
				return 0;
			});
			next.set("callback", async event => {
				if (event.judgeResult.suit == "spade") {
					await player.recover();
					if (get.position(event.judgeResult.card, true) == "o") {
						await player.gain(event.judgeResult.card, "gain2", "log");
					}
				}
			});
			next.judge2 = result => result.bool;
			await next;
		},
	},
	rezishou: {
		audio: "zishou",
		audioname: ["re_liubiao"],
		trigger: { player: "phaseDrawBegin2" },
		check(event, player) {
			return (
				player.countCards("h") <= (player.hasSkill("zongshi") ? player.maxHp : player.hp - 2) ||
				player.skipList.includes("phaseUse") ||
				!player.countCards("h", function (card) {
					return get.tag(card, "damage") && player.hasUseTarget(card);
				})
			);
		},
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			trigger.num += game.countGroup();
			player.addTempSkill("rezishou2");
		},
		ai: {
			threaten: 1.5,
		},
	},
	rezishou2: {
		audio: "rezishou",
		trigger: {
			source: "damageBegin2",
			//player:'phaseJieshuBegin',
		},
		forced: true,
		sourceSkill: "rezishou",
		filter(event, player) {
			if (event.name == "damage") {
				return event.player != player;
			}
			if (player.getHistory("skipped").includes("phaseUse")) {
				return false;
			}
			return (
				player.getHistory("useCard", function (evt) {
					if (evt.targets && evt.targets.length && evt.isPhaseUsing()) {
						var targets = evt.targets.slice(0);
						while (targets.includes(player)) {
							targets.remove(player);
						}
						return targets.length > 0;
					}
					return false;
				}).length == 0
			);
		},
		popup: false,
		async content(event, trigger, player) {
			// step 0
			if (trigger.name == "damage") {
				player.logSkill("rezishou", trigger.player);
				trigger.cancel();
				return;
			} else {
				var filterTarget = function (card, player, target) {
					return (
						target != player &&
						target.countCards("e", function (card) {
							return player.canEquip(card);
						})
					);
				};
				if (
					game.hasPlayer(function (current) {
						return filterTarget(null, player, current);
					})
				) {
					const result = await player
						.chooseTarget(filterTarget, "是否将一名其他角色装备区内的一张牌移动到自己的装备区？")
						.set("ai", function (target) {
							var player = _status.event.player;
							var att = get.attitude(player, target);
							if (att > 0 && !target.hasSkillTag("noe")) {
								return 0;
							}
							var num = 0;
							target.countCards("e", function (card) {
								if (player.canEquip(card)) {
									var eff = get.effect(player, card, player, player);
									if (eff > num) {
										num = eff;
									}
								}
							});
							if (num <= 0) {
								return 0;
							}
							if (att < 0) {
								return num * -att;
							}
							return 1 / num;
						})
						.forResult();
					// step 1
					if (result.bool) {
						var target = result.targets[0];
						event.target = target;
						player.logSkill("rezishou", target);
						const result2 = await player
							.choosePlayerCard(target, "e", "将一张装备牌移至你的装备区")
							.set("filterButton", function (button) {
								return _status.event.player.canEquip(button.link);
							})
							.forResult();
						// step 2
						if (result2 && result2.links && result2.links.length) {
							await game.delay(2);
							await target.$give(result2.links[0], player, false);
							await player.equip(result2.links[0]);
							player.addExpose(0.2);
						}
					}
				}
			}
		},
		ai: {
			effect: {
				player(card, player, target) {
					if (get.tag(card, "damage")) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	decadepojun: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		direct: true,
		filter(event, player) {
			return event.card.name == "sha" && event.target.hp > 0 && event.target.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			// step 0
			const next = player.choosePlayerCard(trigger.target, "he", [1, Math.min(trigger.target.hp, trigger.target.countCards("he"))], get.prompt("decadepojun", trigger.target), "allowChooseAll");
			next.set("ai", function (button) {
				if (!_status.event.goon) {
					return 0;
				}
				const val = get.value(button.link);
				if (button.link == _status.event.target.getEquip(2)) {
					return 2 * (val + 3);
				}
				return val;
			});
			next.set("goon", get.attitude(player, trigger.target) <= 0);
			next.set("forceAuto", true);
			const result = await next.forResult();
			// step 1
			if (result.bool) {
				event.cards = result.cards;
				const target = trigger.target;
				player.logSkill("decadepojun", trigger.target);
				target.addSkill("decadepojun2");
				const next = target.addToExpansion(result.cards, "giveAuto", target);
				next.gaintag.add("decadepojun2");
				await next;
			} else {
				return;
			}
			// step 2
			let discard = false,
				draw = false;
			for (const i of event.cards) {
				const type = get.type2(i);
				if (type == "equip") {
					discard = true;
				}
				if (type == "trick") {
					draw = true;
				}
			}
			let result2;
			if (discard) {
				event.equip = true;
				result2 = await player
					.chooseButton(
						[
							"选择一张牌置入弃牌堆",
							event.cards.filter(function (card) {
								return get.type(card) == "equip";
							}),
						],
						true
					)
					.set("ai", function (button) {
						return get.value(button.link, _status.event.getTrigger().target);
					})
					.forResult();
			}
			if (draw) {
				event.draw = true;
			}
			// step 3
			if (event.equip && result2 && result2.links && result2.links.length) {
				await trigger.target.loseToDiscardpile(result2.links);
			}
			if (event.draw) {
				await player.draw();
			}
		},
		ai: {
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (get.attitude(player, arg.target) > 0) {
					return false;
				}
				if (tag == "directHit_ai") {
					return arg.target.hp >= Math.max(1, arg.target.countCards("h") - 1);
				}
				if (arg && arg.name == "sha" && arg.target.getEquip(2)) {
					return true;
				}
				return false;
			},
		},
	},
	decadepojun2: {
		trigger: { global: "phaseEnd" },
		forced: true,
		popup: false,
		charlotte: true,
		sourceSkill: "decadepojun",
		filter(event, player) {
			return player.getExpansions("decadepojun2").length > 0;
		},
		async content(event, trigger, player) {
			const cards = player.getExpansions("decadepojun2");
			game.log(player, "收回了" + get.cnNumber(cards.length) + "张“破军”牌");
			await player.gain(cards, "draw");
			player.removeSkill("decadepojun2");
		},
		intro: {
			markcount: "expansion",
			mark(dialog, storage, player) {
				var cards = player.getExpansions("decadepojun2");
				if (player.isUnderControl(true)) {
					dialog.addAuto(cards);
				} else {
					return "共有" + get.cnNumber(cards.length) + "张牌";
				}
			},
		},
	},
	hanzhan: {
		audio: 2,
		trigger: {
			global: "chooseToCompareBegin",
		},
		filter(event, player) {
			if (player == event.player) {
				return true;
			}
			if (event.targets) {
				return event.targets.includes(player);
			}
			return player == event.target;
		},
		logTarget(event, player) {
			if (player != event.player) {
				return event.player;
			}
			return event.targets || event.target;
		},
		prompt2(event, player) {
			return "令其改为使用随机的手牌进行拼点";
		},
		check(trigger, player) {
			var num = 0;
			var targets = player == trigger.player ? (trigger.targets ? trigger.targets.slice(0) : [trigger.target]) : [trigger.player];
			while (targets.length) {
				var target = targets.shift();
				if (target.getCards("h").length > 1) {
					num -= get.attitude(player, target);
				}
			}
			return num > 0;
		},
		async content(event, trigger, player) {
			const targets = player == trigger.player ? (trigger.targets ? trigger.targets.slice(0) : [trigger.target]) : [trigger.player];
			if (!trigger.fixedResult) {
				trigger.fixedResult = {};
			}
			for (const target of targets) {
				const hs = target.getCards("h");
				if (hs.length) {
					trigger.fixedResult[target.playerid] = hs.randomGet();
				}
			}
		},
		group: "hanzhan_gain",
		subfrequent: ["gain"],
	},
};
