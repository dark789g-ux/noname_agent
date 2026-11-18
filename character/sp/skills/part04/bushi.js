import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "bushi" | "midao" | "fengpo" | "fengpo2" | "fengpo3" | "biluan" | "lixia" | "olbiluan" | "ollixia" | "rebiluan2" | "rebiluan">} */
export const groupSkills = {
	bushi: {
		audio: 2,
		trigger: { player: "damageEnd", source: "damageEnd" },
		getIndex: event => event.num,
		filter(event, player) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.player.isIn() && player.countExpansions("yishe") && event.num > 0;
		},
		async cost(event, trigger, player) {
			const result = await trigger.player.chooseCardButton("选择获得一张“米”", player.getExpansions("yishe")).forResult();
			event.result = {
				bool: result.bool,
				cost_data: result.links,
			};
		},
		async content(event, trigger, player) {
			const { player: target } = trigger;
			player.line(target);
			await target.gain(event.cost_data, "give", player, "bySelf");
		},
		ai: { combo: "yishe" },
	},
	midao: {
		audio: 2,
		trigger: { global: "judge" },
		direct: true,
		filter(event, player) {
			return player.getExpansions("yishe").length && event.player.isIn();
		},
		content() {
			"step 0";
			var list = player.getExpansions("yishe");
			player
				.chooseButton([get.translation(trigger.player) + "的" + (trigger.judgestr || "") + "判定为" + get.translation(trigger.player.judging[0]) + "，" + get.prompt("midao"), list, "hidden"], function (button) {
					var card = button.link;
					var trigger = _status.event.getTrigger();
					var player = _status.event.player;
					var judging = _status.event.judging;
					var result = trigger.judge(card) - trigger.judge(judging);
					var attitude = get.attitude(player, trigger.player);
					return result * attitude;
				})
				.set("judging", trigger.player.judging[0])
				.set("filterButton", function (button) {
					var player = _status.event.player;
					var card = button.link;
					var mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (mod2 != "unchanged") {
						return mod2;
					}
					var mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
					if (mod != "unchanged") {
						return mod;
					}
					return true;
				});
			"step 1";
			if (result.bool) {
				event.forceDie = true;
				player.respond(result.links, "midao", "highlight", "noOrdering");
				result.cards = result.links;
				var card = result.cards[0];
				event.card = card;
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				if (trigger.player.judging[0].clone) {
					trigger.player.judging[0].clone.classList.remove("thrownhighlight");
					game.broadcast(function (card) {
						if (card.clone) {
							card.clone.classList.remove("thrownhighlight");
						}
					}, trigger.player.judging[0]);
					game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
				}
				game.cardsDiscard(trigger.player.judging[0]);
				trigger.player.judging[0] = result.cards[0];
				trigger.orderingCards.addArray(result.cards);
				game.log(trigger.player, "的判定牌改为", card);
				game.delay(2);
			}
		},
		ai: {
			combo: "yishe",
			rejudge: true,
			tag: {
				rejudge: 0.6,
			},
		},
	},
	fengpo: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
		},
		filter(event, player) {
			if (event.targets.length != 1 || !["sha", "juedou"].includes(event.card.name)) {
				return false;
			}
			var evtx = event.getParent();
			return !player.hasHistory(
				"useCard",
				function (evt) {
					return evt != evtx && evt.card.name == event.card.name;
				},
				evtx
			);
		},
		async cost(event, trigger, player) {
			const str1 = get.translation(trigger.card),
				str2 = get.translation(trigger.target);
			const result = await player
				.chooseControl("摸X加1伤", "摸1加X伤", "cancel2")
				.set("prompt", get.prompt(event.skill, trigger.target))
				.set("prompt2", "你可以选择一项：1.摸X张牌，令" + str1 + "的伤害+1；2.摸一张牌，令" + str1 + "的伤害+X（X为" + str2 + "的♦牌的数量）。")
				.forResult();
			if (result.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: result.index,
				};
			}
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const {
				cost_data: index,
				targets: [target],
			} = event;
			const nd = target.countCards("he", { suit: "diamond" });
			let draw = 1,
				damage = 1;
			if (index == 0) {
				draw = nd;
			} else {
				damage = nd;
			}
			await player.draw(draw);
			const evt = trigger.getParent();
			if (typeof evt.baseDamage != "number") {
				evt.baseDamage = 1;
			}
			evt.baseDamage += damage;
		},
	},
	fengpo2: {
		trigger: { source: "damageBegin1" },
		sourceSkill: "fengpo",
		filter(event) {
			return event.card && (event.card.name == "sha" || event.card.name == "juedou") && event.notLink();
		},
		forced: true,
		audio: false,
		content() {
			if (typeof player.storage.fengpo == "number") {
				trigger.num += player.storage.fengpo;
			}
		},
	},
	fengpo3: { charlotte: true },
	//士燮
	biluan: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		check(event, player) {
			if (player.countCards("h") > player.hp) {
				return true;
			}
			if (player.hasJudge("lebu")) {
				return true;
			}
			var ng = [];
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (players[i].group != "unknown") {
					ng.add(players[i].group);
				}
			}
			ng = ng.length;
			if (ng < 2) {
				return false;
			}
			var nai = 0;
			for (var i = 0; i < players.length; i++) {
				if (players[i] != player) {
					var dist = get.distance(players[i], player, "attack");
					if (dist <= 1 && dist + ng > 1) {
						nai++;
					}
				}
			}
			return nai >= 2;
		},
		filter(event, player) {
			return (
				!event.numFixed &&
				game.hasPlayer(function (current) {
					return current != player && get.distance(current, player) <= 1;
				})
			);
		},
		content() {
			if (!player.hasSkill("rebiluan2")) {
				player.addSkill("rebiluan2");
			}
			var ng = [];
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (players[i].group != "unknown") {
					ng.add(players[i].group);
				}
			}
			player.$damagepop(ng.length, "unknownx");
			player.storage.rebiluan2 += ng.length;
			player.markSkill("rebiluan2");
			game.addVideo("storage", player, ["biluan", player.storage.rebiluan2]);
			trigger.changeToZero();
		},
	},
	lixia: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player.isIn() && event.player != player && !event.player.inRange(player);
		},
		forced: true,
		content() {
			"step 0";
			player
				.chooseTarget(
					function (card, player, target) {
						return target == player || target == _status.event.source;
					},
					true,
					"礼下：选择一个目标摸一张牌"
				)
				.set("ai", function (target) {
					if (get.attitude(player, trigger.player) > 2) {
						return 114514 - target.countCards();
					}
					return player == target ? 1 : 0;
				})
				.set("source", trigger.player);
			"step 1";
			if (result.targets.length) {
				result.targets[0].draw();
				player.line(result.targets[0], "green");
			}
			if (!player.hasSkill("rebiluan2")) {
				player.addSkill("rebiluan2");
			}
			player.storage.rebiluan2--;
			player.markSkill("rebiluan2");
			game.addVideo("storage", player, ["biluan", player.storage.rebiluan2]);
		},
		ai: {
			combo: "biluan",
			halfneg: true,
		},
	},
	olbiluan: {
		audio: "biluan",
		trigger: { player: "phaseJieshuBegin" },
		checkx(player) {
			var ng = Math.min(4, game.countPlayer());
			var nai = 0;
			for (var i = 0; i < game.players.length; i++) {
				if (game.players[i] != player) {
					var dist = get.distance(game.players[i], player, "attack");
					if (dist <= 1 && dist + ng > 1) {
						nai++;
					}
				}
			}
			return nai >= 2;
		},
		filter(event, player) {
			return (
				player.countCards("he") &&
				game.hasPlayer(function (current) {
					return current != player && get.distance(current, player) <= 1;
				})
			);
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseToDiscard("he", get.prompt2("olbiluan"))
				.set("logSkill", "olbiluan")
				.set("ai", function (card) {
					if (_status.event.check) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("check", lib.skill.olbiluan.checkx(player));
			"step 1";
			if (result.bool) {
				player.addSkill("rebiluan2");
				var num = game.countGroup();
				player.$damagepop(num, "unknownx");
				player.storage.rebiluan2 += num;
				player.markSkill("rebiluan2");
				game.addVideo("storage", player, ["rebiluan2", player.storage.rebiluan2]);
			}
		},
	},
	ollixia: {
		audio: "lixia",
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player.isIn() && event.player != player && !event.player.inRange(player);
		},
		forced: true,
		content() {
			"step 0";
			player
				.chooseTarget(
					function (card, player, target) {
						return target == player || target == _status.event.source;
					},
					true,
					"礼下：请选择一个目标令其摸牌并减少你与其他角色的距离"
				)
				.set("ai", function (target) {
					return player == target ? 1 : 0;
				})
				.set("source", trigger.player);
			"step 1";
			if (result.targets.length) {
				var num = result.targets[0] == player ? 1 : 2;
				result.targets[0].draw(num);
				player.line(result.targets[0], "green");
			}
			if (!player.hasSkill("rebiluan2")) {
				player.addSkill("rebiluan2");
			}
			player.storage.rebiluan2--;
			player.markSkill("rebiluan2");
			game.addVideo("storage", player, ["rebiluan2", player.storage.rebiluan]);
		},
		ai: {
			combo: "rebiluan",
			halfneg: true,
		},
	},
	rebiluan2: {
		mark: true,
		charlotte: true,
		intro: {
			content(storage) {
				if (storage > 0) {
					return "其他角色计算与你的距离时+" + storage;
				} else if (storage < 0) {
					return "其他角色计算与你的距离时" + storage;
				} else {
					return "无距离变化";
				}
			},
		},
		init(player) {
			if (typeof player.storage.rebiluan2 != "number") {
				player.storage.rebiluan2 = 0;
			}
		},
		mod: {
			globalTo(from, to, distance) {
				if (typeof to.storage.rebiluan2 == "number") {
					return distance + to.storage.rebiluan2;
				}
			},
		},
	},
	rebiluan: {
		audio: "biluan",
		trigger: { player: "phaseJieshuBegin" },
		checkx(player) {
			var ng = Math.min(4, game.countPlayer());
			var nai = 0;
			for (var i = 0; i < game.players.length; i++) {
				if (game.players[i] != player) {
					var dist = get.distance(game.players[i], player, "attack");
					if (dist <= 1 && dist + ng > 1) {
						nai++;
					}
				}
			}
			return nai >= 2;
		},
		filter(event, player) {
			return (
				player.countCards("he") &&
				game.hasPlayer(function (current) {
					return current != player && get.distance(current, player) <= 1;
				})
			);
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseToDiscard("he", get.prompt2("rebiluan"))
				.set("logSkill", "rebiluan")
				.set("check", lib.skill.rebiluan.checkx(player))
				.set("ai", function (card) {
					if (_status.event.check) {
						return 6 - get.value(card);
					}
					return 0;
				});
			"step 1";
			if (result.bool) {
				player.addSkill("rebiluan2");
				var ng = Math.min(4, game.countPlayer());
				player.$damagepop(ng, "unknownx");
				player.storage.rebiluan2 += ng;
				player.markSkill("rebiluan2");
				game.addVideo("storage", player, ["rebiluan2", player.storage.rebiluan2]);
			}
		},
	},
};
