import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twxiawei" | "wangxing" | "twqiongji" | "twwanwei" | "twyuejian">} */
export const groupSkills = {
	//桥蕤
	twxiawei: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		locked: false,
		group: ["twxiawei_init", "twxiawei_lose", "twxiawei_unmark"],
		content() {
			"step 0";
			player
				.chooseControl("1", "2", "3", "4", "cancel2")
				.set("prompt", get.prompt("twxiawei"))
				.set("prompt2", "妄行：将X+1张牌置于武将牌上，称为“威”")
				.set("ai", function () {
					var player = _status.event.player;
					if (player.maxHp > 3) {
						return 3;
					}
					return Math.min(3, player.countCards("he") + 1);
				});
			"step 1";
			if (result.control != "cancel2") {
				var num = result.index + 1,
					cards = get.cards(num + 1);
				player.logSkill("twxiawei");
				player.addTempSkill("wangxing");
				player.addMark("wangxing", num, false);
				player.$gain2(cards, false);
				game.log(player, "将", cards, "作为“威”置于了武将牌上");
				player.loseToSpecial(cards, "twxiawei").visible = true;
			} else {
				event.finish();
			}
			"step 2";
			player.markSkill("twxiawei");
			game.delayx();
		},
		marktext: "威",
		intro: {
			mark(dialog, storage, player) {
				var cards = player.getCards("s", function (card) {
					return card.hasGaintag("twxiawei");
				});
				if (!cards || !cards.length) {
					return;
				}
				dialog.addAuto(cards);
			},
			markcount(storage, player) {
				return player.countCards("s", function (card) {
					return card.hasGaintag("twxiawei");
				});
			},
			onunmark(storage, player) {
				var cards = player.getCards("s", function (card) {
					return card.hasGaintag("twxiawei");
				});
				if (cards.length) {
					player.loseToDiscardpile(cards);
				}
			},
		},
		mod: {
			aiOrder(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("twxiawei")) {
					return num + 0.5;
				}
			},
		},
		subSkill: {
			init: {
				audio: "twxiawei",
				trigger: { global: "phaseBefore", player: "enterGame" },
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				locked: false,
				content() {
					"step 0";
					var cards = [];
					for (var i = 1; i <= 2; i++) {
						var card = get.cardPile2(function (card) {
							return !cards.includes(card) && get.type(card) == "basic";
						});
						if (card) {
							cards.push(card);
						}
					}
					if (cards.length) {
						player.$gain2(cards, false);
						game.log(player, "将", cards, "作为“威”置于了武将牌上");
						player.loseToSpecial(cards, "twxiawei").visible = true;
					} else {
						event.finish();
					}
					"step 1";
					player.markSkill("twxiawei");
					game.delayx();
				},
			},
			lose: {
				audio: "twxiawei",
				trigger: { player: "phaseBegin" },
				filter(event, player) {
					return player.countCards("s", function (card) {
						return card.hasGaintag("twxiawei");
					});
				},
				forced: true,
				locked: false,
				content() {
					var cards = player.getCards("s", function (card) {
						return card.hasGaintag("twxiawei");
					});
					player.loseToDiscardpile(cards);
				},
			},
			unmark: {
				trigger: { player: "loseAfter" },
				filter(event, player) {
					if (!event.ss || !event.ss.length) {
						return false;
					}
					return !player.countCards("s", function (card) {
						return card.hasGaintag("twxiawei");
					});
				},
				charlotte: true,
				forced: true,
				silent: true,
				content() {
					player.unmarkSkill("twxiawei");
				},
			},
		},
	},
	wangxing: {
		trigger: { player: "phaseEnd" },
		charlotte: true,
		onremove: true,
		forced: true,
		popup: false,
		filter(event, player) {
			return player.countMark("wangxing") > 0;
		},
		content() {
			"step 0";
			player
				.chooseToDiscard(
					"he",
					player.countMark("wangxing"),
					"妄行：请弃置" + get.cnNumber(player.countMark("wangxing")) + "张牌，或减1点体力上限"
				)
				.set("ai", function (card) {
					var player = _status.event.player;
					if (player.maxHp == 1) {
						return 100 - get.value(card);
					}
					return 5 + Math.max(0, 5 - player.maxHp) - get.value(card);
				});
			"step 1";
			if (!result.bool) {
				player.loseMaxHp();
			}
		},
		intro: { content: "回合结束时，你须弃置#张牌，否则减1点体力上限" },
	},
	twqiongji: {
		audio: 2,
		trigger: { player: ["useCardAfter", "respondAfter", "damageBegin3"] },
		filter(event, player) {
			if (event.name == "damage") {
				return !player.countCards("s", function (card) {
					return card.hasGaintag("twxiawei");
				});
			}
			return (
				!player.hasSkill("twqiongji_silent") &&
				player.getHistory("lose", function (evt) {
					if ((evt.relatedEvent || evt.getParent()) != event) {
						return false;
					}
					for (var i in evt.gaintag_map) {
						if (evt.gaintag_map[i].includes("twxiawei")) {
							return true;
						}
					}
					return false;
				}).length > 0
			);
		},
		forced: true,
		content() {
			if (trigger.name == "damage") {
				trigger.num++;
			} else {
				player.draw();
				player.addTempSkill("twqiongji_silent");
			}
		},
		ai: {
			combo: "twxiawei",
			halfneg: true,
		},
		subSkill: { silent: { charlotte: true } },
	},
	//卞夫人
	twwanwei: {
		audio: "spwanwei",
		trigger: { global: "damageBegin4" },
		filter(event, player) {
			return event.player.isMinHp();
		},
		check(event, player) {
			return get.attitude(player, event.player) > 0 && event.player.hp < player.hp;
		},
		usable: 1,
		logTarget: "player",
		prompt2(event, player) {
			if (player != event.player) {
				return "防止" + get.translation(event.player) + "即将受到的" + event.num + "点伤害，然后你失去1点体力";
			} else if (
				event.player == player ||
				!game.hasPlayer(function (current) {
					return current != player && current.maxHp > player.maxHp;
				})
			) {
				return "于当前回合的结束阶段获得牌堆顶的牌并亮出牌堆底的牌，若展示的牌能被使用，你使用之";
			}
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			if (target != player) {
				trigger.cancel();
				await player.loseHp();
			}
			if (target == player || player.isMaxMaxHp()) {
				player.addTempSkill("twwanwei_effect");
			}
		},
		subSkill: {
			effect: {
				audio: "spwanwei",
				charlotte: true,
				trigger: { global: "phaseJieshuBegin" },
				prompt2: "获得牌堆顶的牌并亮出牌堆底的牌，若展示的牌能被使用，你使用之",
				async content(event, trigger, player) {
					await player.gain(get.cards(1, true), "gain2");
					const card = get.bottomCards(1, true)[0];
					await player.showCards(card, get.translation(player) + "挽危：牌堆底的牌", true);
					if (player.hasUseTarget(card)) {
						await player.chooseUseTarget(card, true);
					}
				},
			},
		},
	},
	twyuejian: {
		audio: "spyuejian",
		enable: "phaseUse",
		filterCard: true,
		selectCard() {
			var player = _status.event.player;
			var num = Math.max(1, player.countCards("h") - player.getHandcardLimit());
			return [1, num];
		},
		complexCard: true,
		discard: false,
		/*loseTo: "cardPile",
		insert: true,
		visible: true,*/
		lose: false,
		delay: false,
		position: "he",
		usable: 1,
		check(card) {
			if (ui.selected.cards.length >= 3) {
				return 0;
			}
			var player = _status.event.player;
			var num = Math.max(1, player.countCards("h") - player.getHandcardLimit());
			if (num >= 3) {
				return 5 - get.value(card);
			}
			if (num >= 2 && player.isDamaged() && ui.selected.cards.length < 1) {
				return 7 - get.value(card);
			}
			if (num >= 1 && player.isDamaged() && !ui.selected.cards.length) {
				return 6 - get.value(card);
			}
			return 0;
		},
		async content(event, trigger, player) {
			const { cards } = event;
			const next = player.chooseToMove();
			next.set("list", [["牌堆顶", cards], ["牌堆底"]]);
			next.set("prompt", "约俭：将这些牌置于牌堆顶或牌堆底");
			next.set("processAI", function (list) {
				var cards = list[0][1].slice(0),
					player = _status.event.player;
				var target = player.next;
				var att = get.sgn(get.attitude(player, target));
				var top = [];
				var judges = target.getCards("j");
				var stopped = false;
				if (player != target || !target.hasWuxie()) {
					for (var i = 0; i < judges.length; i++) {
						var judge = get.judge(judges[i]);
						cards.sort(function (a, b) {
							return (judge(b) - judge(a)) * att;
						});
						if (judge(cards[0]) * att < 0) {
							stopped = true;
							break;
						} else {
							top.unshift(cards.shift());
						}
					}
				}
				var bottom;
				if (!stopped) {
					cards.sort(function (a, b) {
						return (get.value(b, player) - get.value(a, player)) * att;
					});
					while (cards.length) {
						if (get.value(cards[0], player) <= 5 == att > 0) {
							break;
						}
						top.unshift(cards.shift());
					}
				}
				bottom = cards.sort(function (a, b) {
					return player.getUseValue(a) - player.getUseValue(b);
				});
				return [top, bottom];
			});
			const result = await next.forResult();
			if (result.moved?.length) {
				const {
					moved: [top, bottom],
				} = result;
				top.reverse();
				player.$throw(cards.length, 1000);
				player.popup(get.cnNumber(top.length) + "上" + get.cnNumber(bottom.length) + "下");
				game.log(player, `将${get.cnNumber(top.length)}张牌置于牌堆顶`);
				game.log(player, `将${get.cnNumber(bottom.length)}张牌置于牌堆底`);
				await player
					.lose(top.concat(bottom), ui.cardPile)
					.set("top_cards", top)
					.set("insert_index", (event, card) => {
						if (event.top_cards.includes(card)) {
							return ui.cardPile.firstChild;
						}
						return null;
					});
				await game.delayx();
			}
			if (cards.length >= 3) {
				await player.gainMaxHp();
			}
			if (cards.length >= 2) {
				await player.recover();
			}
			if (cards.length >= 1) {
				player.addSkill("twyuejian_effect");
				player.addMark("twyuejian_effect", 1, false);
			}
		},
		ai: {
			order: 5,
			result: { player: 1 },
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				marktext: "俭",
				intro: {
					content: "手牌上限+#",
				},
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("twyuejian_effect");
					},
				},
			},
		},
	},
};
