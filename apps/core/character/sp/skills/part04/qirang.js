import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "qirang" | "yuhua" | "chenqing" | "mozhi" | "ranshang" | "ranshang2" | "hanyong" | "hanyong3" | "yishe">} */
export const groupSkills = {
	qirang: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		frequent: true,
		filter(event, player) {
          return get.type(event.card) == "equip";
        },
		content() {
			var card = get.cardPile(function (card) {
				return get.type(card, "trick") == "trick";
			});
			if (card) {
				var next = player.gain(card, "gain2");
				if (get.type(card) == "trick") {
					next.gaintag.add("qirang");
				} else {
					player.addMark("qirang_mark", 1, false);
					player.addTempSkill("qirang_mark", { player: "phaseBegin" });
				}
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						return [1, 3];
					}
				},
			},
			threaten: 1.3,
		},
		group: "qirang_use",
		subSkill: {
			mark: {
				charlotte: true,
				onremove(player) {
					var evt = _status.event;
					if (evt.name != "phase") {
						evt = evt.getParent("phase");
					}
					if (evt && evt.player == player) {
						if (!evt.qirang_num) {
							evt.qirang_num = 0;
						}
						evt.qirang_num += player.storage.qirang_mark;
					}
					delete player.storage.qirang_mark;
				},
				intro: {
					content: "下回合发动〖羽化〗时卜算量+#",
				},
			},
			use: {
				audio: "qirang",
				trigger: { player: "useCard2" },
				direct: true,
				filter(event, player) {
					if (get.type(event.card) != "trick") {
						return false;
					}
					if (!event.targets || event.targets.length != 1) {
						return false;
					}
					var info = get.info(event.card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (
						!player.hasHistory("lose", function (evt) {
							if ((evt.relatedEvent || evt.getParent()) != event) {
								return false;
							}
							for (var i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("qirang")) {
									return true;
								}
							}
							return false;
						})
					) {
						return false;
					}
					if (!info.multitarget) {
						if (
							game.hasPlayer(function (current) {
								return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current) && lib.filter.targetInRange(event.card, player, current);
							})
						) {
							return true;
						}
					}
					return false;
				},
				content() {
					"step 0";
					var prompt2 = "为" + get.translation(trigger.card) + "增加一个目标";
					player
						.chooseTarget(get.prompt("qirang"), function (card, player, target) {
							var player = _status.event.player;
							if (_status.event.targets.includes(target)) {
								return false;
							}
							return lib.filter.targetEnabled2(_status.event.card, player, target) && lib.filter.targetInRange(_status.event.card, player, target);
						})
						.set("prompt2", prompt2)
						.set("ai", function (target) {
							var trigger = _status.event.getTrigger();
							var player = _status.event.player;
							return get.effect(target, trigger.card, player, player) * (_status.event.targets.includes(target) ? -1 : 1);
						})
						.set("targets", trigger.targets)
						.set("card", trigger.card);
					"step 1";
					if (result.bool) {
						if (!event.isMine() && !event.isOnline()) {
							game.delayx();
						}
						event.targets = result.targets;
					} else {
						event.finish();
					}
					"step 2";
					if (event.targets) {
						player.logSkill("qirang_use", event.targets);
						trigger.targets.addArray(event.targets);
					}
				},
			},
		},
	},
	yuhua: {
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		forced: true,
		audio: 2,
		async content(event, trigger, player) {
			let num = 1,
				evt = trigger.getParent();
			if (evt.qirang_num) {
				num += evt.qirang_num;
			}
			const result = await player.chooseToGuanxing(Math.min(5, num)).set("prompt", "观星：点击或拖动将牌移动到牌堆顶或牌堆底").forResult();
			if ((!result.bool || !result.moved[0].length) && event.triggername == "phaseZhunbeiBegin") {
				player.addTempSkill("guanxing_fail");
			}
		},
		mod: {
			ignoredHandcard(card, player) {
				if (get.type(card) != "basic") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.type(card) != "basic") {
					return false;
				}
			},
		},
		ai: {
			guanxing: true,
		},
	},
	chenqing: {
		audio: 2,
		trigger: { global: "dying" },
		filter(event, player) {
			return event.player.hp <= 0 && game.hasPlayer(current => current != player && current != event.player);
		},
		round: 1,
		async cost(event, trigger, player) {
			const { player: target } = trigger;
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target != player && target != get.event().targetx;
				})
				.set("ai", target => {
					const { player, targetx } = get.event();
					if (get.attitude(player, targetx) > 0) {
						const att1 = get.attitude(target, player);
						const att2 = get.attitude(target, targetx);
						const att3 = get.attitude(player, target);
						if (att3 < 0) {
							return 0;
						}
						return att1 / 2 + att2 + att3;
					}
					return 0;
				})
				.set("targetx", target)
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			await target.draw(4);
			if (!target.countCards("he", card => lib.filter.cardDiscardable(card, target, "chenqing"))) {
				return;
			}
			const { player: tosave } = trigger;
			const att = get.attitude(target, tosave);
			const hastao = target.countCards("hs", card => target.canSaveCard(card, tosave)) >= 1 - tosave.hp;
			const result = await target
				.chooseToDiscard(4, true, "he")
				.set("ai", card => {
					const { hastao, att } = get.event();
					if (!hastao && att > 0) {
						const suit = get.suit(card);
						for (let i = 0; i < ui.selected.cards.length; i++) {
							if (get.suit(ui.selected.cards[i]) == suit) {
								return -4 - get.value(card);
							}
						}
					}
					if (att < 0 && ui.selected.cards.length == 3) {
						const suit = get.suit(card);
						for (let i = 0; i < ui.selected.cards.length; i++) {
							if (get.suit(ui.selected.cards[i]) == suit) {
								return -get.value(card);
							}
						}
						return -10 - get.value(card);
					}
					return -get.value(card);
				})
				.set("hastao", hastao)
				.set("att", att)
				.forResult();
			if (result?.cards?.length === 4) {
				const suits = result.cards.map(card => get.suit(card)).toUniqued();
				const tao = get.autoViewAs({ name: "tao", isCard: true });
				if (suits.length == 4 && lib.filter.cardSavable(tao, target, tosave)) {
					await target.useCard(tao, tosave);
				}
			}
		},
		ai: {
			expose: 0.2,
			threaten: 1.5,
		},
	},
	mozhi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.getHistory("useCard", evt => evt.isPhaseUsing() && ["basic", "trick"].includes(get.type(evt.card))).length > 0 && player.countCards("hs") > 0;
		},
		direct: true,
		async content(event, trigger, player) {
			let count = 2;
			let history = player.getHistory("useCard", evt => evt.isPhaseUsing() && ["basic", "trick"].includes(get.type(evt.card)));
			while (count-- && history.length && player.countCards("hs")) {
				let card = history.shift().card;
				card = { name: card.name, nature: card.nature };
				if (player.hasUseTarget(card, true, true)) {
					const name = `${event.name}_backup`;
					game.broadcastAll(
						(name, card) => {
							lib.skill[name].viewAs = card;
						},
						name,
						card
					);
					const next = player.chooseToUse();
					next.logSkill = event.name;
					next.set("openskilldialog", `默识：将一张手牌当${get.translation(card)}使用`);
					next.set("norestore", true);
					next.set("_backupevent", name);
					next.set("custom", {
						add: {},
						replace: { window() {} },
					});
					next.backup(name);
					const result = await next.forResult();
					if (!result?.bool) {
						break;
					}
				} else {
					break;
				}
			}
		},
		subSkill: {
			backup: {
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				selectCard: 1,
				position: "hs",
				popname: true,
				log: false,
			},
		},
	},
	ranshang: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.hasNature("fire");
		},
		forced: true,
		check() {
			return false;
		},
		content() {
			player.addMark("ranshang", trigger.num);
		},
		intro: {
			name2: "燃",
			content: "mark",
		},
		ai: {
			neg: true,
			effect: {
				target(card, player, target, current) {
					if (card.name == "sha") {
						if (game.hasNature(card, "fire") || player.hasSkill("zhuque_skill")) {
							return 2;
						}
					}
					if (get.tag(card, "fireDamage") && current < 0) {
						return 2;
					}
				},
			},
		},
		group: "ranshang2",
	},
	ranshang2: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		sourceSkill: "ranshang",
		filter(event, player) {
			return player.countMark("ranshang") > 0;
		},
		content() {
			player.loseHp(player.countMark("ranshang"));
			if (player.countMark("ranshang") > 2) {
				player.loseMaxHp(2);
				player.draw(2);
			}
		},
	},
	hanyong: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			return event.card && (event.card.name == "nanman" || event.card.name == "wanjian" || (event.card.name == "sha" && !game.hasNature(event.card) && get.suit(event.card) == "spade")) && player.isDamaged();
		},
		content() {
			trigger.baseDamage++;
			if (game.roundNumber <= player.hp) {
				player.addMark("ranshang", 1);
			}
		},
	},
	hanyong3: {
		audio: false,
		trigger: { source: "damageBegin1" },
		forced: true,
		onremove: true,
		sourceSkill: "hanyong",
		filter(event, player) {
			return event.card == player.storage.hanyong3;
		},
		content() {
			trigger.num++;
		},
	},
	yishe: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return !player.getExpansions("yishe").length;
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		content() {
			"step 0";
			player.draw(2);
			"step 1";
			var cards = player.getCards("he");
			if (!cards.length) {
				event.finish();
			} else if (cards.length <= 2) {
				event._result = { bool: true, cards: cards };
			} else {
				player.chooseCard(2, "he", true, "选择两张牌作为“米”");
			}
			"step 2";
			if (result.bool) {
				player.addToExpansion(result.cards, player, "give").gaintag.add("yishe");
			}
		},
		group: "yishe_recover",
		ai: { combo: "bushi" },
		subSkill: {
			recover: {
				audio: "yishe",
				trigger: {
					player: ["loseAfter"],
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (player.isHealthy()) {
						return false;
					}
					var evt = event.getl(player);
					if (!evt || !evt.xs || !evt.xs.length || player.getExpansions("yishe").length > 0) {
						return false;
					}
					if (event.name == "lose") {
						for (var i in event.gaintag_map) {
							if (event.gaintag_map[i].includes("yishe")) {
								return true;
							}
						}
						return false;
					}
					return player.hasHistory("lose", function (evt) {
						if (event != evt.getParent()) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("yishe")) {
								return true;
							}
						}
						return false;
					});
				},
				forced: true,
				content() {
					player.recover();
				},
			},
		},
	},
};
