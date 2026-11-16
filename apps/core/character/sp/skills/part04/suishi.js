import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "suishi" | "suishi2" | "sijian" | "quji" | "junbing" | "xiongyi" | "gzshushen" | "shushen" | "shenzhi" | "wuji">} */
export const groupSkills = {
	suishi: {
		audio: 2,
		trigger: { global: "dying" },
		forced: true,
		popup: false,
		logAudio(event, player, name) {
			if (name == "dying") {
				return "suishi1.mp3";
			}
			return "suishi2.mp3";
		},
		filter(event, player) {
			return event.player != player && event.parent.name == "damage" && event.parent.source && event.parent.source != event.player;
		},
		content() {
			"step 0";
			var str;
			if (trigger.parent.source == player) {
				str = "随势：是否摸一张牌？";
			} else {
				str = "随势：是否令" + get.translation(player) + "摸一张牌？";
			}
			trigger.parent.source
				.chooseBool(str)
				.set("ai", function () {
					return get.attitude(_status.event.player, _status.event.target) > 0;
				})
				.set("target", player);
			"step 1";
			if (result.bool) {
				player.logSkill("suishi");
				trigger.parent.source.line(player, "green");
				player.draw();
			}
		},
		ai: {
			halfneg: true,
		},
		group: "suishi2",
	},
	suishi2: {
		trigger: { global: "dieAfter" },
		forced: true,
		popup: false,
		sourceSkill: "suishi",
		filter(event, player) {
			return event.player != player && event.source && event.source != player && event.source != event.player;
		},
		content() {
			"step 0";
			var str;
			if (trigger.source == player) {
				str = "随势：是否失去1点体力？";
			} else {
				str = "随势：是否令" + get.translation(player) + "失去1点体力？";
			}
			trigger.source
				.chooseBool(str)
				.set("ai", function () {
					return get.attitude(_status.event.player, _status.event.target) < 0;
				})
				.set("target", player);
			"step 1";
			if (result.bool) {
				player.logSkill("suishi");
				trigger.source.line(player, "green");
				player.loseHp();
			}
		},
	},
	sijian: {
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		direct: true,
		audio: 2,
		preHidden: true,
		filter(event, player) {
			if (player.countCards("h")) {
				return false;
			}
			if (event.name == "gain" && event.player == player) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.hs && evt.hs.length > 0;
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("sijian"), "弃置一名其他角色的一张牌", function (card, player, target) {
					return player != target && target.countCards("he") > 0;
				})
				.set("ai", function (target) {
					return -get.attitude(_status.event.player, target);
				})
				.setHiddenSkill(event.name);
			"step 1";
			if (result.bool) {
				player.logSkill("sijian", result.targets);
				event.target = result.targets[0];
				player.discardPlayerCard(event.target, true);
			} else {
				event.finish();
			}
		},
		ai: {
			expose: 0.2,
		},
	},
	quji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filterCard: true,
		selectCard() {
			var player = _status.event.player;
			return player.getDamagedHp();
		},
		filterTarget(card, player, target) {
			return target.hp < target.maxHp;
		},
		filter(event, player) {
			return player.hp < player.maxHp;
		},
		selectTarget() {
			return [1, ui.selected.cards.length];
		},
		complexSelect: true,
		check(card) {
			if (get.color(card) == "black") {
				return -1;
			}
			return 9 - get.value(card);
		},
		content() {
			"step 0";
			target.recover();
			"step 1";
			if (target == targets[targets.length - 1]) {
				for (var i = 0; i < cards.length; i++) {
					if (get.color(cards[i], player) == "black") {
						player.loseHp();
						break;
					}
				}
			}
		},
		ai: {
			result: {
				target: 1,
			},
			order: 6,
		},
	},
	junbing: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player.countCards("h") <= 1 && (player == event.player || player.hasSkill("junbing"));
		},
		async cost(event, trigger, player) {
			event.result = await trigger.player
				.chooseBool(player == trigger.player ? get.prompt(event.skill) : "是否响应" + get.translation(player) + "的【郡兵】？", "摸一张牌" + (player == trigger.player ? "" : "，将所有手牌交给" + get.translation(player) + "，然后其交给你等量张牌"))
				.set("ai", () => get.event().choice)
				.set(
					"choice",
					(function () {
						let num = player.countCards("h"),
							att = get.attitude(trigger.player, player);
						if (num == 0) {
							return true;
						}
						if (num == 1) {
							return att > -1;
						}
						if (num == 2) {
							return att > 0;
						}
						return att > 1;
					})()
				)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = trigger.player;
			if (target != player) {
				game.log(target, "响应了", player, "的", "#g【郡兵】");
			}
			await target.draw();
			let cards = target.getCards("h");
			if (target == player || !cards.length) {
				return;
			}
			await target.give(cards, player);
			let num = cards.length,
				result;
			if (player.countCards("he") > num) {
				result = await player
					.chooseCard("郡兵：请还给" + get.translation(target) + get.translation(num) + "张牌", "he", true, num)
					.set("ai", card => {
						let player = _status.event.player,
							target = get.event().target;
						if (get.attitude(player, target) <= 0) {
							if (card.name == "du") {
								return 30;
							}
							return -get.value(card);
						}
						return 6 - get.value(card);
					})
					.set("target", target)
					.forResult();
			} else {
				result = {
					bool: player.hasCard(i => true, "he"),
					cards: player.getCards("he"),
				};
			}
			if (result.bool) {
				await player.give(result.cards, target);
			}
		},
	},
	xiongyi: {
		skillAnimation: true,
		animationColor: "gray",
		enable: "phaseUse",
		audio: 2,
		limited: true,
		filterTarget(card, player, target) {
			if (get.mode() == "guozhan") {
				if (player == target) {
					return true;
				}
				if (player.identity == "unknown") {
					if (!player.wontYe("qun")) {
						return false;
					}
					return target.identity == "qun";
				}
				return target.isFriendOf(player);
			} else {
				return true;
			}
		},
		multitarget: true,
		multiline: true,
		selectTarget() {
			if (get.mode() == "guozhan") {
				return -1;
			}
			return [1, Infinity];
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			game.asyncDraw(targets, 3);
			"step 1";
			if (player.isDamaged()) {
				if (get.mode() == "guozhan") {
					if (player.isMinor(true)) {
						player.recover();
					}
				} else if (player.isMinHp()) {
					player.recover();
				}
			}
		},
		ai: {
			order: 1,
			result: {
				target(player) {
					var num = player.countCards("h");
					if (player.hp == 1) {
						return 1;
					}
					if (player.hp == 2 && num <= 2) {
						return 1;
					}
					if (player.hp == 3 && num <= 1) {
						return 1;
					}
					if (game.phaseNumber < game.players.length * 2) {
						return 0;
					}
					if (player.hasUnknown()) {
						return 0;
					}
					return 1;
				},
			},
		},
	},
	gzshushen: {
		audio: "shushen",
		trigger: { player: "recoverAfter" },
		direct: true,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return player != current && player.sameIdentityAs(current);
			});
		},
		content() {
			"step 0";
			event.num = trigger.num || 1;
			"step 1";
			player
				.chooseTarget(get.prompt2("gzshushen"), function (card, player, target) {
					return target != player && player.sameIdentityAs(target);
				})
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target);
				});
			"step 2";
			if (result.bool) {
				player.logSkill("gzshushen", result.targets);
				result.targets[0].draw();
				if (event.num > 1) {
					event.num--;
					event.goto(1);
				}
			}
		},
		ai: {
			threaten: 0.8,
			expose: 0.1,
		},
	},
	shushen: {
		audio: 2,
		trigger: { player: "recoverAfter" },
		filter(event, player) {
			return game.hasPlayer(current => current != player) && event.num > 0;
		},
		getIndex: event => event.num,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.player();
					return get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await event.targets[0].chooseDrawRecover(2, true);
		},
		ai: {
			threaten: 0.8,
			expose: 0.1,
		},
	},
	shenzhi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		check(event, player) {
			if (player.hp > 2) {
				return false;
			}
			var cards = player.getCards("h");
			if (cards.length < player.hp) {
				return false;
			}
			if (cards.length > 3) {
				return false;
			}
			for (var i = 0; i < cards.length; i++) {
				if (get.value(cards[i]) > 7 || get.tag(cards[i], "recover") >= 1) {
					return false;
				}
			}
			return true;
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		preHidden: true,
		content() {
			"step 0";
			var cards = player.getCards("h");
			event.bool = cards.length >= player.hp;
			player.discard(cards);
			"step 1";
			if (event.bool) {
				player.recover();
			}
		},
	},
	wuji: {
		skillAnimation: true,
		animationColor: "orange",
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		juexingji: true,
		filter(event, player) {
			return player.getStat("damage") >= 3;
		},
		content() {
			"step 0";
			player.removeSkills("huxiao");
			player.gainMaxHp();
			"step 1";
			player.recover();
			player.awakenSkill(event.name);
			var card = get.cardPile("qinglong", "field");
			if (card) {
				player.gain(card, "gain2", "log");
			}
		},
	},
};
