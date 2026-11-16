import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "shangyi" | "shengxi" | "shoucheng" | "hengzheng" | "yongjue" | "guixiu" | "cunsi" | "fenming" | "duanxie" | "xiaoguo">} */
export const groupSkills = {
	shangyi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player != target && target.countCards("h");
		},
		content() {
			"step 0";
			player.chooseCardButton(target, target.getCards("h")).set("filterButton", function (button) {
				return get.color(button.link) == "black";
			});
			"step 1";
			if (result.bool) {
				target.discard(result.links[0]);
			}
		},
		ai: {
			order: 11,
			result: {
				target(player, target) {
					return -target.countCards("h");
				},
			},
			threaten: 1.1,
		},
	},
	shengxi: {
		trigger: { player: "phaseDiscardBegin" },
		frequent: true,
		filter(event, player) {
			return !player.getStat("damage");
		},
		content() {
			player.draw(2);
		},
		audio: 2,
		audioname: ["liushan"],
	},
	shoucheng: {
		init(player) {
			game.addGlobalSkill("shoucheng_draw", player);
		},
		onremove: () => {
			if (!game.hasPlayer(i => i.hasSkill("shoucheng", null, null, false), true)) {
				game.removeGlobalSkill("shoucheng_draw");
			}
		},
		trigger: {
			global: ["equipAfter", "addJudgeAfter", "loseAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		audio: 2,
		direct: true,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				if (current == _status.currentPhase) {
					return false;
				}
				var evt = event.getl(current);
				return evt && evt.hs && evt.hs.length && current.countCards("h") == 0;
			});
		},
		content() {
			"step 0";
			event.list = game
				.filterPlayer(function (current) {
					if (current == _status.currentPhase) {
						return false;
					}
					var evt = trigger.getl(current);
					return evt && evt.hs && evt.hs.length;
				})
				.sortBySeat(_status.currentPhase);
			"step 1";
			var target = event.list.shift();
			event.target = target;
			if (target.isIn() && target.countCards("h") == 0) {
				player.chooseBool(get.prompt2("shoucheng", target)).set("ai", function () {
					return get.attitude(_status.event.player, _status.event.getParent().target) > 0;
				});
			} else {
				event.goto(3);
			}
			"step 2";
			if (result.bool) {
				player.logSkill(event.name, target);
				if (player !== target && (get.mode() !== "identity" || player.identity !== "nei")) {
					player.addExpose(0.15);
				}
				target.draw();
			}
			"step 3";
			if (event.list.length) {
				event.goto(1);
			}
		},
		ai: {
			threaten: 1.3,
		},
		subSkill: {
			draw: {
				trigger: { player: "dieAfter" },
				filter(event, player) {
					return !game.hasPlayer(current => {
						return current.hasSkill("shoucheng", null, null, false);
					}, true);
				},
				content() {
					game.removeGlobalSkill("shoucheng_draw");
				},
				ai: {
					noh: true,
					skillTagFilter(player, tag, arg) {
						if (player === _status.currentPhase || player.countCards("h") !== 1) {
							return false;
						}
						return game.hasPlayer(current => {
							return current.hasSkill("shoucheng") && player.isFriendOf(current);
						});
					},
				},
			},
		},
	},
	hengzheng: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		preHidden: true,
		filter(event, player) {
			return !event.numFixed && (player.hp == 1 || player.countCards("h") == 0);
		},
		check(event, player) {
			var num = game.countPlayer(function (current) {
				if (current.countCards("he") && current != player && get.attitude(player, current) <= 0) {
					return true;
				}
				if (current.countCards("j") && current != player && get.attitude(player, current) > 0) {
					return true;
				}
			});
			return num >= 2;
		},
		content() {
			"step 0";
			var targets = game.filterPlayer();
			targets.remove(player);
			targets.sort(lib.sort.seat);
			event.targets = targets;
			event.num = 0;
			trigger.changeToZero();
			player.line(targets, "green");
			"step 1";
			if (num < event.targets.length) {
				if (event.targets[num].countCards("hej")) {
					player.gainPlayerCard(event.targets[num], "hej", true);
				}
				event.num++;
				event.redo();
			}
		},
		ai: {
			noh: true,
			skillTagFilter(player, tag) {
				if (tag == "noh") {
					if (player.countCards("h") != 1) {
						return false;
					}
				}
			},
			threaten(player, target) {
				if (target.hp == 1) {
					return 2.5;
				}
				return 1;
			},
		},
	},
	yongjue: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		usable: 1,
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			if (event.player == player) {
				return false;
			}
			if (event.targets.includes(player)) {
				return false;
			}
			if (event.cards) {
				for (var i = 0; i < event.cards.length; i++) {
					if (get.position(event.cards[i], true) == "o") {
						return true;
					}
				}
			}
			return false;
		},
		frequent: true,
		content() {
			var cards = trigger.cards.slice(0);
			for (var i = 0; i < cards.length; i++) {
				if (get.position(cards[i], true) != "o") {
					cards.splice(i--, 1);
				}
			}
			player.gain(cards, "gain2");
		},
	},
	guixiu: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		frequent: true,
		filter(event, player) {
			return event.card.name == "sha" && player.countCards("h") < player.hp;
		},
		content() {
			player.draw();
		},
	},
	cunsi: {
		skillAnimation: true,
		animationColor: "orange",
		audio: 2,
		enable: "phaseUse",
		limited: true,
		derivation: "yongjue",
		filter(event, player) {
			return player.countCards("h") && !player.isTurnedOver();
		},
		filterTarget(card, player, target) {
			return player != target && target.hasSex("male");
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			var cards = player.getCards("h");
			player.give(cards, target);
			"step 1";
			target.addSkills("yongjue");
			"step 2";
			target.markSkillCharacter("yongjue", player, "存嗣", '<div class="skill">【勇决】</div><div>每当其他角色于回合内使用一张杀，若目标不是你，你可以获得之，每回合限一次</div>');
			player.turnOver();
		},
		ai: {
			order: 4,
			result: {
				target(player, target) {
					if (target.isMin()) {
						return 0;
					}
					if (player.hp > 1) {
						if (game.phaseNumber < game.players.length) {
							return 0;
						}
						if (target.hp == 1 && target.maxHp > 2) {
							return 0;
						}
						if (get.attitude(player, target) < 5) {
							return 0;
						}
					}
					if (get.attitude(player, target) < 5) {
						return 0;
					}
					if (target.hp == 1 && target.maxHp > 2) {
						return 0.2;
					}
					if (target == game.me) {
						return 1.2;
					}
					return 1;
				},
			},
			expose: 0.5,
			threaten: 1.5,
		},
	},
	fenming: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		check(event, player) {
			const num = game.countPlayer(function (current) {
				if (current.isLinked() && current.countCards("he")) {
					return get.effect(current, { name: "guohe_copy2" }, player, player);
				}
			});
			return num > 0;
		},
		filter(event, player) {
			return player.isLinked();
		},
		preHidden: true,
		prompt: "是否发动【奋命】？",
		logTarget(event, player) {
			return game.filterPlayer(function (current) {
				if (current.isLinked() && current.countCards("he")) {
					return true;
				}
			});
		},
		content() {
			"step 0";
			event.targets = game.filterPlayer(function (current) {
				if (current.isLinked() && current.countCards("he")) {
					return true;
				}
			});
			event.num = 0;
			event.targets.sort(lib.sort.seat);
			"step 1";
			if (event.num < event.targets.length) {
				var target = event.targets[event.num];
				if (player == target) {
					player.chooseToDiscard(true, "he");
				} else {
					player.discardPlayerCard(true, "he", target);
				}
				event.num++;
				event.redo();
			}
		},
	},
	duanxie: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && !current.isLinked();
			});
		},
		filterTarget(card, player, target) {
			return player != target && !target.isLinked();
		},
		selectTarget() {
			return [1, Math.max(1, _status.event.player.getDamagedHp())];
		},
		content() {
			if (!target.isLinked()) {
				target.link();
			}
		},
		contentAfter() {
			if (!player.isLinked()) {
				player.link();
			}
		},
		ai: {
			result: {
				player(player) {
					return player.isLinked() ? 0 : -0.8;
				},
				target(player, target) {
					return get.effect(target, { name: "tiesuo" }, player, target) / get.attitude(target, target);
				},
			},
			order: 2,
			expose: 0.3,
			effect: {
				target(card) {
					if (card.name == "tiesuo") {
						return 0.5;
					}
				},
			},
		},
	},
	xiaoguo: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player.isIn() && event.player != player && player.countCards("h");
		},
		direct: true,
		content() {
			"step 0";
			var next = player.chooseToDiscard(get.prompt("xiaoguo", trigger.player));
			next.set("ai", function (card) {
				return _status.event.eff - get.useful(card);
			});
			next.set("logSkill", ["xiaoguo", trigger.player]);
			next.set(
				"eff",
				(function () {
					if (trigger.player.hasSkillTag("noe")) {
						return get.attitude(_status.event.player, trigger.player);
					}
					return get.damageEffect(trigger.player, player, _status.event.player);
				})()
			);
			"step 1";
			if (result.bool) {
				if (get.mode() !== "identity" || player.identity !== "nei") {
					player.addExpose(0.15);
				}
				trigger.player
					.chooseToDiscard("he", "弃置一张装备牌并令" + get.translation(player) + "摸一张牌，或受到1点伤害", { type: "equip" })
					.set("ai", function (card) {
						if (_status.event.damage > 0) {
							return 0;
						}
						if (_status.event.noe) {
							return 12 - get.value(card);
						}
						return -_status.event.damage - get.value(card);
					})
					.set("damage", get.damageEffect(trigger.player, player, trigger.player))
					.set("noe", trigger.player.hasSkillTag("noe"));
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				player.draw();
			} else {
				trigger.player.damage();
			}
		},
	},
};
