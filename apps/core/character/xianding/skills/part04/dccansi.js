import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dccansi" | "dcfozong" | "dcluochong" | "dcaichen">} */
export const groupSkills = {
	//笮融
	dccansi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		content() {
			"step 0";
			player.recover();
			if (!game.hasPlayer(current => current != player)) {
				event.finish();
			} else {
				player.chooseTarget("残肆：选择一名其他角色", true, lib.filter.notMe).set("ai", target => {
					var player = _status.event.player;
					var list = ["recover", "sha", "juedou", "huogong"];
					return list.reduce((p, c) => {
						return p + get.effect(target, { name: c }, player, player);
					}, 0);
				});
			}
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.line(target, "fire");
				target.recover();
				event.list = ["sha", "juedou", "huogong"];
				player.addTempSkill("dccansi_draw");
				player.storage.dccansi_draw = target;
			} else {
				event.finish();
			}
			"step 2";
			var card = { name: event.list.shift(), isCard: true };
			if (target.isIn() && player.canUse(card, target, false)) {
				player.useCard(card, target, false);
			}
			if (event.list.length) {
				event.redo();
			}
			"step 3";
			player.removeSkill("dccansi_draw");
		},
		subSkill: {
			draw: {
				audio: "dccansi",
				trigger: { global: "damageEnd" },
				forced: true,
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return event.getParent(3).name == "dccansi" && player.storage.dccansi_draw == event.player;
				},
				content() {
					for (var i = 0; i < trigger.num; i++) {
						player.draw(2);
					}
				},
			},
		},
		ai: {
			threaten: 5,
			expose: 0.3,
		},
	},
	dcfozong: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countCards("h") > 7;
		},
		forced: true,
		direct: true,
		intro: {
			markcount: "expansion",
			content: "expansion",
		},
		content() {
			"step 0";
			var num = player.countCards("h") - 7;
			player.chooseCard("佛宗：将" + get.cnNumber(num) + "张手牌置于武将上", true, num);
			"step 1";
			if (result.bool) {
				var cards = result.cards;
				player.logSkill("dcfozong");
				player.addToExpansion(cards, player, "give").gaintag.add("dcfozong");
			}
			"step 2";
			var cards = player.getExpansions("dcfozong");
			if (cards.length < 7) {
				event.finish();
			} else {
				event.targets = game.filterPlayer(i => i != player).sortBySeat(player);
				game.delayx();
			}
			"step 3";
			var target = targets.shift();
			event.target = target;
			player.line(target);
			var cards = player.getExpansions("dcfozong");
			if (!cards.length) {
				event._result = { bool: false };
			} else {
				target
					.chooseButton(['###佛宗###<div class="text center">获得一张牌并令' + get.translation(player) + "回复1点体力，或点击“取消”令其失去1点体力</div>", cards])
					.set("ai", button => {
						if (_status.event.refuse) {
							return get.value(button.link) - 7.5;
						}
						return get.value(button.link);
					})
					.set("refuse", get.attitude(target, player) < 1 && get.effect(player, { name: "losehp" }, player, target) > 0);
			}
			"step 4";
			if (result.bool) {
				var card = result.links[0];
				target.gain(card, "give", player);
				player.recover(target);
			} else {
				player.loseHp();
			}
			"step 5";
			if (targets.length) {
				event.goto(3);
			}
		},
		ai: { halfneg: true },
	},
	//滕芳兰
	dcluochong: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return game.hasPlayer(current => current.countDiscardableCards(player, "hej") > 0);
		},
		direct: true,
		async content(event, trigger, player) {
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			const lose_list = [];
			let num = 4 - player.countMark("dcluochong");
			let log = false;
			while (num > 0) {
				const result = await player
					.chooseTarget(get.prompt("dcluochong"), `弃置任意名角色区域内的累计至多${num}张牌`, (card, player, target) => {
						return target.hasCard(card => {
							return lib.filter.canBeDiscarded(card, player, target, "dcluochong");
						}, "hej");
					})
					.set("ai", target => {
						const player = _status.event.player,
							discarded = _status.event.lose_list.find(item => item[0] == target);
						if (discarded) {
							if (target == player) {
								return 0;
							}
							const num = discarded[1].length;
							if (num > 1 && player.hp + player.hujia > 2) {
								return 0;
							}
						}
						if (target == player) {
							if (ui.cardPile.childNodes.length > 80 && player.hasCard(card => get.value(card) < 8)) {
								return 20;
							}
							return 0;
						}
						return get.effect(target, { name: "guohe_copy2" }, player, player);
					})
					.set("lose_list", lose_list)
					.forResult();
				if (result.bool) {
					if (!log) {
						player.logSkill("dcluochong");
						log = true;
					}
					const target = result.targets[0];
					const { cards } = await player
						.choosePlayerCard(target, true, "hej", [1, num], `选择弃置${get.translation(target)}区域内的牌`, "allowChooseAll")
						.set("filterButton", button => {
							const card = button.link,
								target = _status.event.target,
								player = get.player();
							return lib.filter.canBeDiscarded(card, player, target, "dcluochong");
						})
						.set("lose_list", lose_list)
						.set("ai", button => {
							if (ui.selected.buttons.length > 0) {
								return false;
							}
							var val = get.buttonValue(button);
							if (get.attitude(_status.event.player, _status.event.target) > 0) {
								return -val;
							}
							return val;
						})
						.forResult();
					num -= cards.length;
					const index = lose_list.find(item => item[0] == target);
					if (!index) {
						lose_list.push([target, cards]);
					} else {
						index[1].addArray(cards);
					}
					await target.modedDiscard(cards, player);
				} else {
					break;
				}
			}
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			if (lose_list.length > 0 && lose_list.some(i => i[1].length > 2)) {
				game.log(player, "可弃置牌数", "#g-1");
				player.addMark("dcluochong", 1, false);
			}
		},
		ai: {
			threaten: 2.5,
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "delay" && current < 0) {
						var current2 = _status.currentPhase;
						if (current2 && current2.getSeatNum() > target.getSeatNum()) {
							return 0.1;
						}
					}
				},
			},
		},
	},
	dcaichen: {
		audio: 2,
		init(player) {
			game.addGlobalSkill("dcaichen_hit");
		},
		onremove(player) {
			if (!game.hasPlayer(current => current.hasSkill("dcaichen", null, null, false), true)) {
				game.removeGlobalSkill("dcaichen_hit");
			}
		},
		trigger: {
			player: ["loseAfter", "phaseDiscardBefore"],
			target: "useCardToTargeted",
		},
		filter(event, player, name) {
			if (event.name == "phaseDiscard") {
				return ui.cardPile.childNodes.length > 40;
			}
			if (name == "useCardToTargeted") {
				return ui.cardPile.childNodes.length < 40 && get.suit(event.card) == "spade";
			}
			const evt = event.getParent(2);
			if (evt.name != "dcluochong" || evt.player != player || player.hasHistory("lose", evtx => evtx.getParent("dcluochong", true) == evt && evtx != event)) {
				return false;
			}
			if (!event.getl(player).cards.length) {
				return false;
			}
			return ui.cardPile.childNodes.length > 80;
		},
		forced: true,
		content() {
			if (trigger.name.indexOf("lose") == 0) {
				player.draw(2);
			} else if (trigger.name == "phaseDiscard") {
				trigger.cancel();
				game.log(player, "跳过了弃牌阶段");
			} else {
				trigger.directHit.add(player);
				game.log(player, "不可响应", trigger.card);
			}
		},
		subSkill: {
			hit: {
				trigger: { player: "dieAfter" },
				filter(event, player) {
					return !game.hasPlayer(current => current.hasSkill("dcaichen", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				content() {
					game.removeGlobalSkill("dcaichen_hit");
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						return arg && arg.card && arg.target && arg.target.hasSkill("dcaichen") && ui.cardPile.childNodes.length < 40 && get.suit(arg.card) === "spade";
					},
				},
			},
		},
	},
};
