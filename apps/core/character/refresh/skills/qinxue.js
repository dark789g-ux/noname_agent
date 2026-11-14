import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const qinxueSkills = {
	qinxue: {
		skillAnimation: true,
		animationColor: "wood",
		audio: 2,
		juexingji: true,
		derivation: "gongxin",
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		forced: true,
		filter(event, player) {
			if (player.countCards("h") >= player.hp + 2) {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			const { name } = event;
			player.awakenSkill(name);
			await player.loseMaxHp();
			await player.chooseDrawRecover(2, true);
			await player.addSkills("gongxin");
		},
	},
	qingjian: {
		audio: 2,
		trigger: { player: "gainAfter" },
		direct: true,
		usable: 4,
		filter(event, player) {
			var evt = event.getParent("phaseDraw");
			if (evt && evt.player == player) {
				return false;
			}
			return event.getg(player).length > 0;
		},
		async content(event, trigger, player) {
			let result;
			// step 0
			event.cards = trigger.getg(player);
			// step 1..n
			while (true) {
				result = await player
					.chooseCardTarget({
						filterCard(card) {
							return _status.event.getParent().cards.includes(card);
						},
						selectCard: [1, event.cards.length],
						filterTarget(card, player, target) {
							return player != target;
						},
						allowChooseAll: true,
						ai1(card) {
							if (ui.selected.cards.length > 0) {
								return -1;
							}
							if (card.name == "du") {
								return 20;
							}
							return _status.event.player.countCards("h") - _status.event.player.hp;
						},
						ai2(target) {
							var att = get.attitude(_status.event.player, target);
							if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
								if (target.hasSkillTag("nodu")) {
									return 0;
								}
								return 1 - att;
							}
							if (target.countCards("h") > _status.event.player.countCards("h")) {
								return 0;
							}
							return att - 4;
						},
						prompt: "请选择要送人的卡牌",
					})
					.forResult();

				// step 2
				if (result.bool) {
					player.storage.qingjian++;
					player.logSkill("qingjian", result.targets);
					await result.targets[0].gain(result.cards, player, "give");
					for (var i = 0; i < result.cards.length; i++) {
						event.cards.remove(result.cards[i]);
					}
					if (event.cards.length) {
						continue;
					}
					break;
				} else {
					player.storage.counttrigger.qingjian--;
					break;
				}
			}
		},
		ai: {
			expose: 0.3,
		},
	},
	reyingzi: {
		audio: 2,
		audioname: ["sunce", "re_sunben", "re_sunce"],
		audioname2: {
			gexuan: "reyingzi_gexuan",
			re_sunyi: "reyingzi_re_sunyi",
			heqi: "reyingzi_heqi",
			re_heqi: "reyingzi_heqi",
			boss_sunce: "reyingzi_sunce",
		},
		trigger: { player: "phaseDrawBegin2" },
		forced: true,
		preHidden: true,
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
		ai: {
			threaten: 1.5,
		},
		mod: {
			maxHandcardBase(player, num) {
				return player.maxHp;
			},
		},
	},
	refanjian: {
		selectionSpec: true,
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterTarget(card, player, target) {
			return player != target;
		},
		filterCard: true,
		check(card) {
			return 8 - get.value(card);
		},
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards, target } = event;
			let result;

			// step 0
			target.storage.refanjian = cards[0];
			await player.give(cards[0], target);

			// step 1
			if (!target.countCards("h")) {
				result = { control: "refanjian_hp" };
			} else {
				result = await target
					.chooseControl("refanjian_card", "refanjian_hp")
					.set("ai", function (event, player) {
						var cards = player.getCards("he", { suit: get.suit(player.storage.refanjian) });
						if (cards.length == 1) {
							return 0;
						}
						if (cards.length >= 2) {
							for (var i = 0; i < cards.length; i++) {
								if (get.tag(cards[i], "save")) {
									return 1;
								}
							}
						}
						if (player.hp == 1) {
							return 0;
						}
						for (var i = 0; i < cards.length; i++) {
							if (get.value(cards[i]) >= 8) {
								return 1;
							}
						}
						if (cards.length > 2 && player.hp > 2) {
							return 1;
						}
						if (cards.length > 3) {
							return 1;
						}
						return 0;
					})
					.forResult();
			}

			// step 2
			if (result.control == "refanjian_card") {
				await target.showHandcards();
			} else {
				await target.loseHp();
				return;
			}

			// step 3
			const suit = get.suit(target.storage.refanjian);
			await target.discard(
				target.getCards("he", function (i) {
					return get.suit(i) == suit && lib.filter.cardDiscardable(i, target, "refanjian");
				})
			);
			delete target.storage.refanjian;
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					return -target.countCards("he") - (player.countCards("h", "du") ? 1 : 0);
				},
			},
			threaten: 2,
		},
	},
	reqianxun: {
		audio: 2,
		trigger: {
			target: "useCardToBegin",
			player: "judgeBefore",
		},
		filter(event, player) {
			if (player.countCards("h") == 0) {
				return false;
			}
			if (event.getParent().name == "phaseJudge") {
				return true;
			}
			if (event.name == "judge") {
				return false;
			}
			if (event.targets && event.targets.length > 1) {
				return false;
			}
			if (event.card && get.type(event.card) == "trick" && event.player != player) {
				return true;
			}
		},
		async content(event, trigger, player) {
			const cards = player.getCards("h");
			if (!cards.length) {
				return;
			}
			const next = player.addToExpansion(cards, "giveAuto", player);
			next.gaintag.add("reqianxun2");
			await next;
			player.addSkill("reqianxun2");
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (player == target || !target.hasFriend()) {
						return;
					}
					var type = get.type(card);
					var nh = Math.min(
						target.countCards(),
						game.countPlayer(i => get.attitude(target, i) > 0)
					);
					if (type == "trick") {
						if (!get.tag(card, "multitarget") || get.info(card).singleCard) {
							if (get.tag(card, "damage")) {
								return [1.5, nh - 1];
							}
							return [1, nh];
						}
					} else if (type == "delay") {
						return [0.5, 0.5];
					}
				},
			},
		},
	},
	reqianxun2: {
		trigger: { global: "phaseEnd" },
		forced: true,
		audio: false,
		sourceSkill: "reqianxun",
		async content(event, trigger, player) {
			const cards = player.getExpansions("reqianxun2");
			if (cards.length) {
				await player.gain(cards, "draw");
			}
			player.removeSkill("reqianxun2");
		},
		intro: {
			mark(dialog, storage, player) {
				var cards = player.getExpansions("reqianxun2");
				if (player.isUnderControl(true)) {
					dialog.addAuto(cards);
				} else {
					return "共有" + get.cnNumber(cards.length) + "张牌";
				}
			},
			markcount: "expansion",
		},
	},
	relianying: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		direct: true,
		filter(event, player) {
			if (player.countCards("h")) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.hs && evt.hs.length;
		},
		async content(event, trigger, player) {
			const num = trigger.getl(player).hs.length;
			const result = await player
				.chooseTarget(get.prompt("relianying"), "令至多" + get.cnNumber(num) + "名角色各摸一张牌", [1, num])
				.set("ai", function (target) {
					const player = _status.event.player;
					if (player == target) {
						return get.attitude(player, target) + 10;
					}
					return get.attitude(player, target);
				})
				.forResult();
			if (!result?.bool) return;
			player.logSkill("relianying", result.targets);
			await game.asyncDraw(result.targets);
			await game.delay();
		},
		ai: {
			threaten: 0.8,
			effect: {
				player_use(card, player, target) {
					if (player.countCards("h") === 1) {
						return [1, 0.8];
					}
				},
				target(card, player, target) {
					if (get.tag(card, "loseCard") && target.countCards("h") === 1) {
						return 0.5;
					}
				},
			},
			noh: true,
			freeSha: true,
			freeShan: true,
			skillTagFilter(player) {
				return player.countCards("h") === 1;
			},
		},
	},
	retishen: {
		audio: 2,
		skillAnimation: true,
		animationColor: "soil",
		limited: true,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			if (typeof player.storage.retishen2 == "number") {
				return player.hp < player.storage.retishen2;
			}
			return false;
		},
		check(event, player) {
			if (player.hp <= 1) {
				return true;
			}
			return player.hp < player.storage.retishen2 - 1;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recover(player.storage.retishen2 - player.hp);
			await player.draw(player.storage.retishen2 - player.hp);
		},
		intro: {
			mark(dialog, content, player) {
				if (player.storage.retishen) {
					return;
				}
				if (typeof player.storage.retishen2 != "number") {
					return "上回合体力：无";
				}
				return "上回合体力：" + player.storage.retishen2;
			},
			content: "limited",
		},
		group: ["retishen2"],
	},
	retishen2: {
		trigger: { player: "phaseJieshuBegin" },
		priority: -10,
		silent: true,
		sourceSkill: "retishen",
		async content(event, trigger, player) {
			player.storage.retishen2 = player.hp;
			game.broadcast(pl => {
				pl.storage.retishen2 = pl.hp;
			}, player);
			game.addVideo("storage", player, ["retishen2", player.storage.retishen2]);
		},
		intro: {
			content(storage, player) {
				if (player.storage.retishen) {
					return;
				}
				return "上回合体力：" + storage;
			},
		},
	},
};
