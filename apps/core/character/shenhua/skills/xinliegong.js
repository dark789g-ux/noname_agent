import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinliegong" | "tiaoxin" | "tiaoxin_xiahouba" | "zhiji" | "xiangle" | "fangquan" | "fangquan2" | "fangquan3" | "ruoyu">} */
export const groupSkills = {
	xinliegong: {
		mod: {
			aiOrder(player, card, num) {
				if (num > 0 && (card.name === "sha" || get.tag(card, "draw"))) {
					return num + 6;
				}
			},
			targetInRange(card, player, target) {
				if (card.name == "sha" && typeof get.number(card) == "number") {
					if (get.distance(player, target) <= get.number(card)) {
						return true;
					}
				}
			},
		},
		targetprompt2: target => {
			const player = get.player(),
				card = get.card(),
				list = [];
			if (card?.name != "sha" || !target.classList.contains("selectable")) {
				return list;
			}
			const num = card.cards?.length ?? 0;
			if (target.countCards("h") <= player.countCards("h") - num) {
				list.add("不可响应");
			}
			if (target.hp >= player.hp) {
				list.add("加伤");
			}
			return list;
		},
		onChooseToUse(event) {
			event.targetprompt2.add(lib.skill.xinliegong.targetprompt2);
		},
		onChooseTarget(event) {
			event.targetprompt2.add(lib.skill.xinliegong.targetprompt2);
		},
		audio: "liegong",
		audioname: ["re_huangzhong", "ol_huangzhong"],
		trigger: { player: "useCardToTargeted" },
		logTarget: "target",
		locked: false,
		check(event, player) {
			return get.attitude(player, event.target) <= 0;
		},
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			if (event.target.countCards("h") <= player.countCards("h")) {
				return true;
			}
			if (event.target.hp >= player.hp) {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			if (trigger.target.countCards("h") <= player.countCards("h")) {
				trigger.getParent().directHit.push(trigger.target);
			}
			if (trigger.target.hp >= player.hp) {
				const id = trigger.target.playerid;
				const map = trigger.getParent().customArgs;
				if (!map[id]) {
					map[id] = {};
				}
				if (typeof map[id].extraDamage != "number") {
					map[id].extraDamage = 0;
				}
				map[id].extraDamage++;
			}
		},
		ai: {
			threaten: 0.5,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (
					arg?.target &&
					arg?.card &&
					get.attitude(player, arg.target) <= 0 &&
					arg.card.name == "sha" &&
					player.countCards("h", function (card) {
						return card != arg.card && (!arg.card.cards || !arg.card.cards.includes(card));
					}) >= arg.target.countCards("h")
				) {
					return true;
				}
				return false;
			},
		},
	},
	tiaoxin: {
		audio: 2,
		audioname: ["sp_jiangwei", "xiahouba", "re_jiangwei", "gz_jiangwei", "ol_jiangwei"],
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.inRange(player) && target.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			const target = event.target;
			const result = await target
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"挑衅：对" + get.translation(player) + "使用一张杀，或令其弃置你的一张牌"
				)
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("complexTarget", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.filterTarget.apply(this, arguments);
				})
				.set("sourcex", player)
				.forResult();
			if (result.bool == false && target.countCards("he") > 0) {
				player.discardPlayerCard(target, "he", true);
			}
		},
		ai: {
			order: 4,
			expose: 0.2,
			result: {
				target: -1,
				player(player, target) {
					if (target.countCards("h") == 0) {
						return 0;
					}
					if (target.countCards("h") == 1) {
						return -0.1;
					}
					if (player.hp <= 2) {
						return -2;
					}
					if (player.countCards("h", "shan") == 0) {
						return -1;
					}
					return -0.5;
				},
			},
			threaten: 1.1,
		},
	},
	tiaoxin_xiahouba: { audio: 2 },
	zhiji: {
		skillAnimation: true,
		animationColor: "fire",
		audio: 2,
		audioname: ["re_jiangwei"],
		juexingji: true,
		derivation: "reguanxing",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			if (player.storage.zhiji) {
				return false;
			}
			return player.countCards("h") == 0;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.chooseDrawRecover(2, true);
			await player.loseMaxHp();
			await player.addSkills("reguanxing");
		},
	},
	xiangle: {
		audio: 2,
		audioname: ["re_liushan", "ol_liushan"],
		trigger: { target: "useCardToTargeted" },
		forced: true,
		preHidden: true,
		filter(event, player) {
			return event.card.name == "sha";
		},
		async content(event, trigger, player) {
			const eff = get.effect(player, trigger.card, trigger.player, trigger.player);
			const result = await trigger.player
				.chooseToDiscard("享乐：弃置一张基本牌，否则杀对" + get.translation(player) + "无效", function (card) {
					return get.type(card) == "basic";
				})
				.set("ai", function (card) {
					if (_status.event.eff > 0) {
						return 10 - get.value(card);
					}
					return 0;
				})
				.set("eff", eff)
				.forResult();
			if (!result?.bool) {
				trigger.getParent().excluded.add(player);
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (card.name == "sha" && get.attitude(player, target) < 0) {
						if (_status.event.name == "xiangle") {
							return;
						}
						if (get.attitude(player, target) > 0 && current < 0) {
							return "zerotarget";
						}
						const bs = player.getCards("h", { type: "basic" });
						bs.remove(card);
						if (card.cards) {
							bs.removeArray(card.cards);
						} else {
							bs.removeArray(ui.selected.cards);
						}
						if (!bs.length) {
							return "zerotarget";
						}
						if (player.hasSkill("jiu") || player.hasSkill("tianxianjiu")) {
							return;
						}
						if (bs.length <= 2) {
							for (let i = 0; i < bs.length; i++) {
								if (get.value(bs[i]) < 7) {
									return [1, 0, 1, -0.5];
								}
							}
							return [1, 0, 0.3, 0];
						}
						return [1, 0, 1, -0.5];
					}
				},
			},
		},
	},
	fangquan: {
		audio: 2,
		trigger: { player: "phaseUseBefore" },
		filter(event, player) {
			return player.countCards("h") > 0 && !player.hasSkill("fangquan3");
		},
		preHidden: true,
		async cost(event, trigger, player) {
			const fang = player.countMark("fangquan2") == 0 && player.hp >= 2 && player.countCards("h") <= player.hp + 1;
			event.result = await player
				.chooseBool(get.prompt2(event.skill))
				.set("ai", function () {
					const player = get.player();
					if (!_status.event.fang) {
						return false;
					}
					return game.hasPlayer(function (target) {
						if (target.hasJudge("lebu") || target == player) {
							return false;
						}
						if (get.attitude(player, target) > 4) {
							return get.threaten(target) / Math.sqrt(target.hp + 1) / Math.sqrt(target.countCards("h") + 1) > 0;
						}
						return false;
					});
				})
				.set("fang", fang)
				.setHiddenSkill(event.name.slice(0, -5))
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.cancel();
			player.addTempSkill("fangquan2");
			player.addMark("fangquan2", 1, false);
			//player.storage.fangquan=result.targets[0];
		},
	},
	fangquan2: {
		trigger: { player: "phaseEnd" },
		locked: true,
		log: false,
		audio: false,
		//priority:-50,
		onremove: true,
		sourceSkill: "fangquan",
		getIndex(event, player) {
			return player.countMark("fangquan2") || 1;
		},
		async cost(event, trigger, player) {
			const chooseToDiscard = player.chooseToDiscard("是否弃置一张手牌并令一名其他角色进行一个额外回合？");
			chooseToDiscard.ai = function (card) {
				return 20 - get.value(card);
			};
			if (!(await chooseToDiscard.forResult()).bool) {
				return;
			}
			const chooseTarget = player.chooseTarget(true, "请选择进行额外回合的目标角色", lib.filter.notMe);
			chooseTarget.ai = function (target) {
				const player = get.player();
				if (target.hasJudge("lebu") || get.attitude(player, target) <= 0) {
					return -1;
				}
				if (target.isTurnedOver()) {
					return 0.18;
				}
				return get.threaten(target) / Math.sqrt(target.hp + 1) / Math.sqrt(target.countCards("h") + 1);
			};
			event.result = await chooseTarget.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			player.logSkill(player.name == "re_liushan" ? "refangquan" : "fangquan", event.targets, "fire");
			target.markSkillCharacter("fangquan", player, "放权", "进行一个额外回合");
			target.insertPhase();
			player.removeMark("fangquan2");
			target.addSkill("fangquan3");
		},
	},
	fangquan3: {
		trigger: { player: ["phaseAfter", "phaseCancelled"] },
		forced: true,
		popup: false,
		audio: false,
		sourceSkill: "fangquan",
		async content(event, trigger, player) {
			player.unmarkSkill("fangquan");
			player.removeSkill("fangquan3");
		},
	},
	ruoyu: {
		skillAnimation: true,
		animationColor: "fire",
		audio: 2,
		audioname: ["re_liushan"],
		juexingji: true,
		zhuSkill: true,
		keepSkill: true,
		derivation: "rejijiang",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			return player.isMinHp();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.gainMaxHp();
			await player.recover();
			await player.addSkills("rejijiang");
		},
	},
};
