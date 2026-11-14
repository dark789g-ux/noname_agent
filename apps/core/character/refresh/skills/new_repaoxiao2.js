import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const new_repaoxiao2Skills = {
	new_repaoxiao2: {
		charlotte: true,
		mod: {
			targetInRange(card, player) {
				if (card.name == "sha") {
					return true;
				}
			},
		},
	},
	new_tishen: {
		trigger: {
			player: "phaseUseEnd",
		},
		check(event, player) {
			var num = 0;
			var he = player.getCards("he");
			for (var i = 0; i < he.length; i++) {
				if (get.type(he[i], "trick") == "trick") {
					num++;
				}
				if (get.type(he[i]) == "equip") {
					var subtype = get.subtype(he[i]);
					if (subtype == "equip3" || subtype == "equip4" || subtype == "equip6") {
						num++;
					}
				}
			}
			return num == 0 || num <= player.countCards("h") - player.getHandcardLimit();
		},
		async content(event, trigger, player) {
			const list = [];
			const he = player.getCards("he");
			for (const card of he) {
				if (get.type(card, "trick") == "trick") {
					list.push(card);
				}
				if (get.type(card) == "equip") {
					const subtype = get.subtype(card);
					if (subtype == "equip3" || subtype == "equip4" || subtype == "equip6") {
						list.push(card);
					}
				}
			}
			if (list.length) {
				await player.discard(list);
			}
			player.addTempSkill("new_tishen2", { player: "phaseBefore" });
		},
		audio: "retishen",
	},
	new_tishen2: {
		audio: "retishen",
		trigger: {
			global: "useCardAfter",
		},
		filter(event, player) {
			return event.card.name == "sha" && event.targets && event.targets.includes(player) && !player.hasHistory("damage", evt => evt.card == event.card) && event.cards.filterInD("od").length;
		},
		forced: true,
		charlotte: true,
		sourceSkill: "new_tishen",
		async content(event, trigger, player) {
			await player.gain(trigger.cards.filterInD("od"), "gain2");
		},
	},
	new_qingjian: {
		audio: "qingjian",
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		usable: 1,
		filter(event, player) {
			const evt = event.getParent("phaseDraw");
			if (evt?.player == player) {
				return false;
			}
			return event.getg(player).length > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					position: "he",
					filterCard: true,
					selectCard: [1, Infinity],
					filterTarget: lib.filter.notMe,
					ai1(card) {
						const player = get.player();
						if (card.name != "du" && get.attitude(player, _status.currentPhase) < 0 && _status.currentPhase?.needsToDiscard()) {
							return -1;
						}
						for (var i = 0; i < ui.selected.cards.length; i++) {
							if (get.type(ui.selected.cards[i]) == get.type(card) || (ui.selected.cards[i].name == "du" && card.name != "du")) {
								return -1;
							}
						}
						if (card.name == "du") {
							return 20;
						}
						return player.countCards("h") - player.hp;
					},
					allowChooseAll: true,
					ai2(target) {
						const player = get.player();
						if (get.attitude(player, _status.currentPhase) < 0) {
							return -1;
						}
						const att = get.attitude(player, target);
						if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
							if (target.hasSkillTag("nodu")) {
								return 0;
							}
							return 1 - att;
						}
						if (target.countCards("h") > player.countCards("h")) {
							return 0;
						}
						return att - 4;
					},
					prompt: get.prompt2(event.name.slice(0, -5)),
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cards,
			} = event;
			await player.showCards(cards);
			await player.give(cards, target);
			const current = _status.currentPhase;
			if (current?.isIn()) {
				current.addTempSkill("qingjian_add");
				current.addMark("qingjian_add", cards.map(card => get.type2(card)).toUniqued().length, false);
			}
		},
		ai: { expose: 0.3 },
	},
	qingjian_add: {
		mark: true,
		intro: { content: "手牌上限+#" },
		mod: {
			maxHandcard(player, num) {
				return num + player.countMark("qingjian_add");
			},
		},
		charlotte: true,
		onremove: true,
	},
	new_reqingnang: {
		selectionSpec: true,
		subSkill: {
			off: {
				sub: true,
			},
		},
		audio: 2,
		enable: "phaseUse",
		filterCard: true,
		check(card) {
			var player = _status.event.player;
			if (
				game.countPlayer(function (current) {
					return get.recoverEffect(current, player, player) > 0 && get.attitude(player, current) > 2;
				}) > 1 &&
				get.color(card) == "black" &&
				player.countCards("h", { color: "red" }) > 0
			) {
				return 3 - get.value(card);
			}
			return 9 - get.value(card);
		},
		filterTarget(card, player, target) {
			if (target.hp >= target.maxHp || target.hasSkill("new_reqingnang_off")) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			target.addTempSkill("new_reqingnang_off");
			if (get.color(cards[0]) == "black") {
				player.tempBanSkill("new_reqingnang");
			}
			await target.recover();
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					if (target.hp == 1) {
						return 5;
					}
					if (player == target && player.countCards("h") > player.hp) {
						return 5;
					}
					return 2;
				},
			},
			threaten: 2,
		},
	},
	reyaowu: {
		trigger: { player: "damageBegin3" },
		audio: "new_reyaowu",
		forced: true,
		filter(event) {
			return event.card && (get.color(event.card) != "red" || (event.source && event.source.isIn()));
		},
		async content(event, trigger, player) {
			if (get.color(trigger.card) == "red") {
				await trigger.source.draw();
			} else {
				await trigger.player.draw();
			}
		},
		ai: {
			effect: {
				target: (card, player, target) => {
					if (typeof card !== "object" || !get.tag(card, "damage")) {
						return;
					}
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (get.color(card) === "red") {
						return [1, 0, 1, 0.6];
					}
					return [1, 0.6];
				},
			},
		},
	},
	new_reyaowu: {
		trigger: {
			player: "damageBegin3",
		},
		//priority:1,
		audio: 2,
		audioname: ["sb_huaxiong", "ol_huaxiong"],
		filter(event) {
			return event.card && event.card.name == "sha" && (get.color(event.card) != "red" || (event.source && event.source.isIn()));
		},
		forced: true,
		async content(event, trigger, player) {
			if (get.color(trigger.card) != "red") {
				await player.draw();
			} else {
				await trigger.source.chooseDrawRecover(true);
			}
		},
		ai: {
			effect: {
				target: (card, player, target, current) => {
					if (card.name == "sha") {
						if (get.color(card) == "red") {
							let num = player.isDamaged() ? 1.6 : 0.7;
							if (get.attitude(player, target) > 0 && player.hp < 3) {
								return [1, 0, 1, num];
							}
							return [1, 0, 1, num / 2];
						}
						return [1, 0.6];
					}
				},
			},
		},
	},
	reguanxing: {
		audio: "guanxing",
		audioname: ["jiangwei", "re_jiangwei", "re_zhugeliang", "ol_jiangwei"],
		audioname2: { gexuan: "guanxing_gexuan" },
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		frequent: true,
		filter(event, player, name) {
			if (name == "phaseJieshuBegin") {
				return player.hasSkill("reguanxing_on");
			}
			return true;
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseToGuanxing(game.countPlayer() < 4 ? 3 : 5)
				.set("prompt", "观星：点击或拖动将牌移动到牌堆顶或牌堆底")
				.forResult();
			if ((!result.bool || !result.moved[0].length) && event.triggername == "phaseZhunbeiBegin") {
				player.addTempSkill(["reguanxing_on", "guanxing_fail"]);
			}
		},
		subSkill: {
			on: { charlotte: true },
		},
		ai: {
			guanxing: true,
		},
	},
	reluoshen: {
		audio: 2,
		locked: false,
		trigger: { player: "phaseZhunbeiBegin" },
		frequent: true,
		async content(event, trigger, player) {
			player.addTempSkill("reluoshen_add");

			const cards = new Set();
			let continuing = false;
			do {
				const next = player.judge({
					judge(card) {
						return get.color(card) === "black" ? 1.5 : -1.5;
					},
					judge2(result) {
						return result.bool;
					},
				});

				if (get.mode() !== "guozhan" && !player.hasSkillTag("rejudge")) {
					next.set("callback", async (event, trigger, player) => {
						if (event.judgeResult.color === "black" && get.position(event.card, true) === "o") {
							await player.gain({
								cards: [event.card],
								gaintag: ["reluoshen"],
							});
						}
					});
				} else {
					next.set("callback", async (event, trigger, player) => {
						if (event.judgeResult.color === "black") {
							event.getParent().orderingCards.remove(event.card);
						}
					});
				}

				const result = await next.forResult();

				if (!result.bool) {
					break;
				}

				cards.add(result.card);
				const continueResult = await player.chooseBool({ prompt: "是否继续进行判定？" }).set("frequentSkill", "reluoshen").forResult();
				continuing = continueResult.bool;
			} while (continuing);

			const gainning = [...cards].filter(card => get.position(card, true) === "o");
			if (gainning.length) {
				await player.gain({
					cards: gainning,
					animate: "gain2",
					gaintag: ["reluoshen"],
				});
			}
		},
		subSkill: {
			add: {
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("reluoshen")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("reluoshen")) {
							return false;
						}
					},
				},
				onremove(player) {
					player.removeGaintag("reluoshen");
				},
			},
		},
	},
};
