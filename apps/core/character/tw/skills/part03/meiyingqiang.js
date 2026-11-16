import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "meiyingqiang" | "cuijin" | "jintao" | "equan" | "manji" | "beini" | "dingfa" | "dz_mantianguohai">} */
export const groupSkills = {
	meiyingqiang: {
		equipSkill: true,
		trigger: {
			player: ["loseAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (player == _status.currentPhase) {
				return false;
			}
			var evt = event.getl(player);
			if (!evt || !evt.cards2 || !evt.cards2.length) {
				return false;
			}
			var list = player.getHistory("lose", function (evt) {
				return evt.cards2 && evt.cards2.length;
			});
			if (event.name == "lose") {
				if (list.indexOf(event) != 0) {
					return false;
				}
			} else {
				if (
					!player.hasHistory("lose", function (evt) {
						return evt.getParent() == event && list.indexOf(evt) == 0;
					})
				) {
					return false;
				}
			}
			return _status.connectMode || !lib.config.skip_shan || player.hasSha();
		},
		direct: true,
		content() {
			if (trigger.delay === false) {
				game.delayx();
			}
			player
				.chooseToUse("梅影枪：是否使用一张【杀】？", function (card) {
					if (get.name(card) != "sha") {
						return false;
					}
					return lib.filter.cardEnabled.apply(this, arguments);
				})
				.set("addCount", false).logSkill = "meiyingqiang";
		},
	},
	cuijin: {
		audio: 2,
		trigger: { global: "useCard" },
		filter(event, player) {
			return event.card.name === "sha" && (event.player === player || player.inRange(event.player)) && player.hasCards("he");
		},
		checkx(event, player) {
			const nature = get.nature(event.card);
			const userDamage = get.damageEffect(event.player, player, player);
			let damageBonus = 0,
				mayDamage = 0,
				odds = -1;
			for (let tar of event.targets) {
				if (
					event.player.hasSkillTag("jueqing", false, tar) ||
					tar.hasSkillTag("filterDamage", null, {
						player: event.player,
						card: event.card,
					})
				) {
					continue;
				}
				const hitOdds = 1 - tar.mayHaveShan(player, "use", true, "odds");
				if (
					hitOdds >= 1 ||
					event.player.hasSkillTag(
						"directHit_ai",
						true,
						{
							target: tar,
							card: event.card,
						},
						true
					)
				) {
					damageBonus += get.damageEffect(tar, event.player, player, nature);
				} else {
					odds = Math.max(odds, hitOdds);
					mayDamage += hitOdds * get.damageEffect(tar, event.player, player, nature);
				}
			}
			if (damageBonus) {
				return damageBonus;
			}
			if (!mayDamage || odds < 0) {
				return get.damageEffect(event.player, player, player);
			}
			return mayDamage + (1 - odds) * get.damageEffect(event.player, player, player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard("chooseonly", "he", get.prompt(event.skill, trigger.player), `弃置一张牌并令${get.translation(trigger.player)}使用的${get.translation(trigger.card)}伤害+1，但若其未造成伤害，则你对其造成1点伤害。`)
				.set("ai", function (card) {
					const goon = get.event().goon;
					if (goon) {
						return goon - get.value(card);
					}
					return 0;
				})
				.set(
					"goon",
					(() => {
						const num = (lib.skill.cuijin.checkx(trigger, player) * player.countCards("he")) / 10;
						return num;
					})()
				)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.discard(event.cards);
			if (typeof trigger.baseDamage !== "number") {
				trigger.baseDamage = 1;
			}
			trigger.baseDamage++;
			player.addTempSkill("cuijin_damage");
			player.markAuto("cuijin_damage", [trigger.card]);
		},
		subSkill: {
			damage: {
				trigger: { global: "useCardAfter" },
				forced: true,
				popup: false,
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return player.getStorage("cuijin_damage").includes(event.card);
				},
				async content(event, trigger, player) {
					player.unmarkAuto(event.name, [trigger.card]);
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
					if (
						trigger.player.isIn() &&
						!game.hasPlayer2(function (current) {
							return current.hasHistory("damage", function (evt) {
								return evt.card === trigger.card;
							});
						})
					) {
						player.line(trigger.player, "green");
						await player.draw();
						await trigger.player.damage();
					}
				},
			},
		},
	},
	jintao: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + 1;
				}
			},
			targetInRange(card) {
				if (card.name == "sha") {
					return true;
				}
			},
		},
		audio: 2,
		trigger: { player: "useCard" },
		forced: true,
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != player) {
				return false;
			}
			var index = player
				.getHistory("useCard", function (evtx) {
					return evtx.card.name == "sha" && evtx.getParent("phaseUse") == evt;
				})
				.indexOf(event);
			return index == 0 || index == 1;
		},
		content() {
			var evt = trigger.getParent("phaseUse");
			var index = player
				.getHistory("useCard", function (evtx) {
					return evtx.card.name == "sha" && evtx.getParent("phaseUse") == evt;
				})
				.indexOf(trigger);
			if (index == 0) {
				game.log(trigger.card, "伤害+1");
				if (typeof trigger.baseDamage != "number") {
					trigger.baseDamage = 1;
				}
				trigger.baseDamage++;
			} else {
				game.log(trigger.card, "不可被响应");
				trigger.directHit.addArray(game.players);
			}
		},
	},
	equan: {
		audio: 2,
		trigger: { global: "damageEnd" },
		forced: true,
		filter(event, player) {
			return player == _status.currentPhase && event.player.isIn();
		},
		logTarget: "player",
		content() {
			trigger.player.addMark("equan", trigger.num, false);
		},
		group: ["equan_block", "equan_lose"],
		marktext: "毒",
		intro: {
			name: "恶泉(毒)",
			name2: "毒",
		},
		subSkill: {
			lose: {
				audio: "equan",
				trigger: { player: "phaseZhunbeiBegin" },
				forced: true,
				filter() {
					return game.hasPlayer(function (current) {
						return current.hasMark("equan");
					});
				},
				logTarget() {
					return game.filterPlayer(function (current) {
						return current.hasMark("equan");
					});
				},
				content() {
					game.countPlayer(function (current) {
						var num = current.countMark("equan");
						if (num) {
							current.removeMark("equan", num);
							current.loseHp(num);
						}
					});
				},
			},
			block: {
				trigger: { global: "dyingBegin" },
				forced: true,
				logTarget: "player",
				filter(event, player) {
					var evt = event.getParent(2);
					return evt.name == "equan_lose" && evt.player == player;
				},
				content() {
					trigger.player.addTempSkill("baiban");
				},
			},
		},
	},
	manji: {
		audio: 2,
		trigger: { global: "loseHpAfter" },
		forced: true,
		filter(event, player) {
			return player != event.player && (player.hp >= event.player.hp || player.isDamaged());
		},
		logTarget: "player",
		content() {
			if (player.hp <= trigger.player.hp) {
				player.recover();
			}
			if (player.hp >= trigger.player.hp) {
				player.draw();
			}
		},
		ai: {
			combo: "equan",
		},
	},
	beini: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target.hp >= player.hp;
		},
		content() {
			"step 0";
			var str = get.translation(target);
			player
				.chooseControl()
				.set("choiceList", ["摸两张牌，然后令" + str + "视为对自己使用【杀】", "令" + str + "摸两张牌，然后视为对其使用【杀】"])
				.set("ai", function () {
					var evt = _status.event.getParent(),
						player = evt.player,
						target = evt.target;
					var card = { name: "sha", isCard: true },
						att = get.attitude(player, target) > 0;
					if (!target.canUse(card, player, false) || get.effect(player, card, target, player) >= 0) {
						return 0;
					}
					if (att && (!player.canUse(card, target, false) || get.effect(target, card, player, player) >= 0)) {
						return 1;
					}
					if (target.hasSkill("nogain") && player.canUse(card, target, false) && get.effect(target, card, player, player) > 0) {
						return 1;
					}
					if (player.hasShan()) {
						return 0;
					}
					if (att && target.hasShan()) {
						return 1;
					}
					return 0;
				});
			"step 1";
			var list = [player, target];
			if (result.index == 1) {
				list.reverse();
			}
			event.list = list;
			list[0].draw(2);
			"step 2";
			var list = event.list;
			if (list[1].isIn() && list[0].isIn() && list[1].canUse("sha", list[0], false)) {
				list[1].useCard({ name: "sha", isCard: true }, list[0], false, "noai");
			}
		},
		ai: {
			order: 5,
			expose: 0,
			result: {
				player(player, target) {
					var card = { name: "sha", isCard: true },
						att = get.attitude(player, target) > 0;
					if (!target.canUse(card, player, false) || get.effect(player, card, target, player) >= 0) {
						return 2;
					}
					if (att && (!player.canUse(card, target, false) || get.effect(target, card, player, player) >= 0)) {
						return 2;
					}
					if (target.hasSkill("nogain") && player.canUse(card, target, false)) {
						return get.effect(target, card, player, player);
					}
					if (player.hasShan()) {
						return 1;
					}
					if (att && target.hasShan()) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	dingfa: {
		audio: 2,
		trigger: { player: "phaseDiscardAfter" },
		filter(event, player) {
			let num = 0;
			player.getHistory("lose", evt => {
				num += evt.cards2.length;
			});
			return num >= player.hp;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(
					get.prompt(event.name.slice(0, -5)),
					"操作提示：选择自己以回复体力，或选择其他角色以造成伤害",
					(card, player, target) => {
						return target == player ? player.isDamaged() : true;
					}
				)
				.set("ai", target => {
					const player = get.player();
					return target != player ? get.damageEffect(target, player, player) : get.recoverEffect(player, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (target == player) {
				await player.recover();
			} else {
				await target.damage();
			}
		},
	},
	dz_mantianguohai: {
		mod: {
			ignoredHandcard(card, player) {
				if (get.name(card) == "dz_mantianguohai") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.name(card) == "dz_mantianguohai") {
					return false;
				}
			},
		},
	},
};
