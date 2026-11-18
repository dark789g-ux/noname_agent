import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcwangyuan" | "dclingyin" | "dcliying" | "dcyuandi" | "dcxinyou">} */
export const groupSkills = {
	//芮姬
	dcwangyuan: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "logSkill"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		frequent: true,
		filter(event, player, name) {
			if (player == _status.currentPhase) {
				return name == "logSkill" && event.skill == "dcliying" && player.getExpansions("dcwangyuan").length < game.countPlayer2();
			}
			if (name == "logSkill") {
				return false;
			}
			if (player.getExpansions("dcwangyuan").length >= game.countPlayer2()) {
				return false;
			}
			if (event.name == "gain" && event.player == player) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.cards2 && evt.cards2.length > 0;
		},
		content() {
			"step 0";
			var cards = player.getExpansions("dcwangyuan");
			var card = get.cardPile2(cardx => {
				var type = get.type2(cardx);
				return (type == "basic" || type == "trick") && !cards.some(cardxx => get.name(cardx, false) == get.name(cardxx, false));
			}, "random");
			if (card) {
				player.addToExpansion(card, "gain2").gaintag.add("dcwangyuan");
			}
		},
		ai: {
			combo: "dclingyin",
		},
		marktext: "妄",
		intro: {
			name: "妄(妄缘/铃音)",
			content: "expansion",
			markcount: "expansion",
		},
	},
	dclingyin: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.getExpansions("dcwangyuan").length;
		},
		direct: true,
		content() {
			"step 0";
			var cards = player.getExpansions("dcwangyuan");
			player
				.chooseButton([get.prompt("dclingyin") + "（当前轮数：" + get.cnNumber(game.roundNumber, true) + "）", cards], [1, game.roundNumber])
				.set("ai", button => {
					var color = _status.event.color,
						player = _status.event.player;
					if (ui.selected.buttons.length > 0 && ui.selected.buttons.length == player.getExpansions("dcwangyuan").length - 1) {
						return 0;
					}
					if (color == 1) {
						return get.value(button.link);
					}
					if (color) {
						return get.color(button.link) == color ? 1 : 0;
					}
					return 0;
				})
				.set(
					"color",
					(function () {
						var cardsR = cards.filter(i => get.color(i) == "red");
						if (cardsR.length == cards.length || cardsR.length == 0 || cards.length <= game.roundNumber) {
							return 1;
						}
						if (cardsR.length <= game.roundNumber) {
							return "red";
						}
						if (cards.length - cardsR.length <= game.roundNumber) {
							return "black";
						}
						return 1;
					})()
				);
			"step 1";
			if (result.bool) {
				player.logSkill("dclingyin");
				var cards = result.links;
				player.gain(cards, "gain2");
				var cardsx = player.getExpansions("dcwangyuan").removeArray(cards);
				if (cardsx.length <= 1 || get.color(cardsx) != "none") {
					player.addTempSkill("dclingyin_effect");
					player.addMark("dclingyin_effect", 1, false);
					game.log(player, "获得了", "#g【铃音】", "的后续效果");
				}
			}
		},
		ai: {
			combo: "dcwangyuan",
			threaten: 3,
		},
		subSkill: {
			effect: {
				audio: "dclingyin",
				enable: "phaseUse",
				trigger: { source: "damageBegin1" },
				viewAs: { name: "juedou" },
				charlotte: true,
				forced: true,
				onremove: true,
				prompt: "将一张武器牌或防具牌当【决斗】使用",
				filterCard(card) {
					return get.subtype(card) == "equip1" || get.subtype(card) == "equip2";
				},
				position: "hes",
				filter(event, player) {
					if (event.name == "chooseToUse") {
						return player.countCards("hes", { subtype: ["equip1", "equip2"] }) > 0;
					}
					return event.player != player;
				},
				content() {
					trigger.num += player.countMark("dclingyin_effect");
				},
				ai: {
					damageBonus: true,
				},
			},
		},
	},
	dcliying: {
		audio: 2,
		usable: 1,
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			const cards = event.getg(player).filter(i => get.owner(i) == player && get.position(i) == "h");
			if (!cards.length) {
				return false;
			}
			const evt = event.getParent("phaseDraw");
			if (evt?.name == "phaseDraw") {
				return false;
			}
			return true;
		},
		async cost(event, trigger, player) {
			const cards = trigger.getg(player).filter(i => get.owner(i) == player && get.position(i) == "h");
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt(event.name.slice(0, -5)),
					prompt2: "选择本次获得的任意张牌交给一名其他角色，然后摸一张牌",
					filterTarget: lib.filter.notMe,
					filterCard: card => _status.event.cards.includes(card),
					cards: cards,
					selectCard: [1, cards.length],
					ai1(card) {
						if (ui.selected.cards.length) {
							return 0;
						}
						return 3 / (Math.abs(get.value(card)) + 0.1);
					},
					ai2(target) {
						return get.value(ui.selected.cards, target) * get.attitude(_status.event.player, target);
					},
					allowChooseAll: true,
				})
				.set("cards", cards)
				.forResult();
		},
		async content(event, trigger, player) {
			await player.give(event.cards, event.targets[0]);
			await player.draw();
		},
	},
	//谢灵毓
	dcyuandi: {
		audio: 2,
		init: () => {
			game.addGlobalSkill("dcyuandi_ai");
		},
		onremove: () => {
			if (!game.hasPlayer(i => i.hasSkill("dcyuandi", null, null, false), true)) {
				game.removeGlobalSkill("dcyuandi_ai");
			}
		},
		trigger: { global: "useCard" },
		filter(event, player) {
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != event.player) {
				return false;
			}
			if (event.player == player || !event.targets || event.targets.length > 1 || event.targets[0] != event.player) {
				return false;
			}
			return (
				event.player
					.getHistory("useCard", evtx => {
						return evtx.getParent("phaseUse") == evt;
					})
					.indexOf(event) == 0
			);
		},
		direct: true,
		content() {
			"step 0";
			var target = trigger.player;
			var name = get.translation(target);
			var choices = ["选项二"];
			var choiceList = ["弃置" + name + "一张手牌", "你与" + name + "各摸一张牌"];
			if (target.countDiscardableCards(player, "h")) {
				choices.unshift("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5; ">' + choiceList[0] + "</span>";
			}
			player
				.chooseControl(choices, "cancel2")
				.set("choiceList", choiceList)
				.set("ai", () => {
					return _status.event.choice;
				})
				.set("prompt", get.prompt("dcyuandi", trigger.player))
				.set(
					"choice",
					(function () {
						if (get.attitude(player, target) < 0) {
							if (choices.includes("选项一")) {
								return "选项一";
							}
							return "cancel2";
						}
						return "选项二";
					})()
				);
			"step 1";
			if (result.control != "cancel2") {
				var target = trigger.player;
				player.logSkill("dcyuandi", target);
				if (result.control == "选项一") {
					player.discardPlayerCard(target, "h", true);
					if (get.mode() !== "identity" || player.identity !== "nei") {
						player.addExpose(0.15);
					}
				} else {
					game.asyncDraw([target, player]);
				}
			}
		},
		subSkill: {
			ai: {
				mod: {
					aiOrder(player, card, num) {
						var info = get.info(card);
						if (!info || !info.toself) {
							return;
						}
						var evt = _status.event.getParent("phaseUse");
						if (!evt || evt.player != player) {
							return;
						}
						if (player.hasHistory("useCard", evtx => evtx.getParent("phaseUse") == evt)) {
							return;
						}
						if (
							game.hasPlayer(current => {
								return current.hasSkill("dcyuandi") && get.attitude(player, current) >= 0;
							})
						) {
							return num + 10;
						}
						return num / 3;
					},
				},
				trigger: { player: "dieAfter" },
				filter: () => {
					return !game.hasPlayer(i => i.hasSkill("dcyuandi", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				content: () => {
					game.removeGlobalSkill("dcyuandi_ai");
				},
			},
		},
	},
	dcxinyou: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") < player.maxHp || player.isDamaged();
		},
		content() {
			"step 0";
			player.recover(player.getDamagedHp(true));
			player.drawTo(player.maxHp);
			"step 1";
			var check = 0;
			if (
				player.hasHistory("gain", evt => {
					return evt.getParent(2) == event && evt.cards.length >= 3;
				})
			) {
				check |= 1;
			}
			if (
				game.getGlobalHistory("changeHp", evt => {
					return evt.getParent().name == "recover" && evt.getParent(2) == event;
				}).length
			) {
				check |= 2;
			}
			if (check > 0) {
				player.addTempSkill("dcxinyou_effect");
				player.storage.dcxinyou_effect = check;
			}
		},
		ai: {
			order: 1,
			result: { player: 1 },
		},
		subSkill: {
			effect: {
				audio: "dcxinyou",
				trigger: { player: "phaseJieshuBegin" },
				charlotte: true,
				forced: true,
				onremove: true,
				filter(event, player) {
					return player.storage.dcxinyou_effect;
				},
				content() {
					if ((player.storage.dcxinyou_effect & 1) > 0) {
						player.loseHp();
					}
					if ((player.storage.dcxinyou_effect & 2) > 0) {
						player.chooseToDiscard("心幽：请弃置一张牌", 1, true, "he");
					}
				},
			},
		},
	},
};
