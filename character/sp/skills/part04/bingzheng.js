import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "bingzheng" | "fuman" | "fuman2" | "qizhou" | "shanxi" | "fenxun" | "fenxun2" | "duanbing">} */
export const groupSkills = {
	bingzheng: {
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("bingzheng"), function (card, player, target) {
					return target.countCards("h") != target.hp;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					var att = get.attitude(player, target);
					var nh = target.countCards("h");
					if (att > 0) {
						if (nh == target.hp - 1) {
							if (player == target) {
								return att + 1;
							}
							return att + 2;
						}
						if (player == target && player.needsToDiscard()) {
							return att / 3;
						}
						return att;
					} else {
						if (nh == target.hp + 1) {
							return -att;
						}
						if (nh == 0) {
							return 0;
						}
						return -att / 2;
					}
				});
			"step 1";
			if (result.bool) {
				player.logSkill("bingzheng", result.targets);
				event.target = result.targets[0];
				if (event.target.countCards("h")) {
					player
						.chooseControl(function (event, player) {
							var target = event.target;
							if (get.attitude(player, target) < 0) {
								return 1;
							}
							return 0;
						})
						.set("choiceList", ["令" + get.translation(event.target) + "摸一张牌", "令" + get.translation(event.target) + "弃置一张手牌"]);
				} else {
					event.directfalse = true;
				}
			} else {
				event.finish();
			}
			"step 2";
			if (event.directfalse || result.index == 0) {
				event.target.draw();
			} else {
				event.target.chooseToDiscard("h", true);
			}
			"step 3";
			if (event.target.countCards("h") == event.target.hp) {
				player.draw();
				if (event.target == player) {
					event.finish();
					return;
				}
				var next = player.chooseCard("是否交给" + get.translation(event.target) + "一张牌？", "he");
				next.set("ai", function (card) {
					if (get.position(card) != "h") {
						return 0;
					}
					if (_status.event.shan && card.name == "shan") {
						return 11;
					}
					if (_status.event.goon) {
						return 10 - get.value(card);
					}
					return -get.value(card, _status.event.player, "raw");
				});
				if (get.attitude(player, event.target) > 1 && player.countCards("h", "shan") > 1 && player.countCards("h") > event.target.countCards("h")) {
					next.set("shan", true);
				}
				if (get.attitude(player, event.target) > 0 && player.needsToDiscard()) {
					next.set("goon", true);
				}
			} else {
				event.finish();
			}
			"step 4";
			if (result.bool) {
				player.give(result.cards, target);
			}
		},
		ai: {
			expose: 0.2,
			threaten: 1.4,
		},
	},
	fuman: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			return !player.getStorage("fuman_used").includes(target);
		},
		filter(event, player) {
			return player.countCards("h") > 0 && game.hasPlayer(current => lib.skill.fuman.filterTarget(null, player, current));
		},
		discard: false,
		lose: false,
		delay: false,
		filterCard: true,
		async content(event, trigger, player) {
			const { cards, target } = event;
			player.addTempSkill(`${event.name}_used`, "phaseChange");
			player.markAuto(`${event.name}_used`, target);
			const next = player.give(cards, target);
			next.gaintag.add(event.name);
			await next;
			target.addSkill(`${event.name}2`);
			player.addSkill(`${event.name}_draw`);
		},
		check(card) {
			return 6 - get.value(card);
		},
		ai: {
			order: 2,
			result: {
				target(player, target) {
					if (!target.hasSha()) {
						return 1.2;
					}
					return 1;
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: `已发动过的目标：$`,
				},
			},
			draw: {
				trigger: { global: "useCardAfter" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return event.player.hasHistory("lose", function (evt) {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx != event) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("fuman")) {
								return true;
							}
						}
						return false;
					});
				},
				logTarget: "player",
				content() {
					player.draw(
						trigger.player.hasHistory("sourceDamage", function (evt) {
							return evt.card == trigger.card;
						})
							? 2
							: 1
					);
				},
			},
		},
	},
	fuman2: {
		charlotte: true,
		mod: {
			aiOrder(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("fuman")) {
					return num + 1;
				}
			},
			cardname(card, player) {
				if (get.itemtype(card) == "card" && card.hasGaintag("fuman")) {
					return "sha";
				}
			},
		},
	},
	qizhou: {
		trigger: { player: ["phaseBefore", "equipEnd", "loseEnd"] },
		forced: true,
		popup: false,
		derivation: ["mashu", "reyingzi", "reduanbing", "fenwei"],
		filter(event, player) {
			if (player.equiping) {
				return false;
			}
			var suits = [];
			var es = player.getCards("e");
			for (var i = 0; i < es.length; i++) {
				suits.add(get.suit(es[i]));
			}
			if (player.additionalSkills.qizhou) {
				return player.additionalSkills.qizhou.length != suits.length;
			} else {
				return suits.length > 0;
			}
		},
		content() {
			var suits = [];
			var es = player.getCards("e");
			for (var i = 0; i < es.length; i++) {
				suits.add(get.suit(es[i]));
			}
			player.removeAdditionalSkill("qizhou");
			switch (suits.length) {
				case 1:
					player.addAdditionalSkill("qizhou", ["mashu"]);
					break;
				case 2:
					player.addAdditionalSkill("qizhou", ["mashu", "reyingzi"]);
					break;
				case 3:
					player.addAdditionalSkill("qizhou", ["mashu", "reyingzi", "reduanbing"]);
					break;
				case 4:
					player.addAdditionalSkill("qizhou", ["mashu", "reyingzi", "reduanbing", "fenwei"]);
					break;
			}
		},
		ai: {
			threaten: 1.2,
		},
	},
	shanxi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard: { color: "red", type: "basic" },
		filterTarget(card, player, target) {
			return target != player && target.countCards("he") && player.inRange(target);
		},
		check(card) {
			return 6 - get.value(card);
		},
		content() {
			"step 0";
			player.discardPlayerCard(target, true);
			"step 1";
			if (result.bool) {
				if (get.name(result.cards[0], result.cards[0].original == "h" ? player : false) == "shan") {
					player.viewHandcards(target);
				} else {
					target.viewHandcards(player);
				}
			}
		},
		ai: {
			order: 8,
			result: {
				target: -1,
			},
		},
	},
	fenxun: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filterTarget(card, player, target) {
			return target != player;
		},
		content() {
			player.markAuto("fenxun2", [target]);
			player.addTempSkill("fenxun2");
		},
		check(card) {
			if (card.name == "sha" && _status.event.player.countCards("h", "sha") <= 1) {
				return 0;
			}
			return 6 - get.value(card);
		},
		filterCard: true,
		ai: {
			order: 4,
			result: {
				player(player, target) {
					if (get.distance(player, target) <= 1) {
						return 0;
					}
					var hs = player.getCards("h", "shunshou");
					if (hs.length && player.canUse(hs[0], target, false)) {
						return 1;
					}
					var geteff = function (current) {
						return player.canUse("sha", current, false, true) && get.effect(current, { name: "sha" }, player, player) > 0;
					};
					if (player.hasSha() && geteff(target)) {
						var num = game.countPlayer(function (current) {
							return current != player && get.distance(player, current) <= 1 && geteff(current);
						});
						if (num == 0) {
							if (
								game.hasPlayer(function (current) {
									return player.canUse("sha", current) && geteff(current) && current != target;
								})
							) {
								return 1;
							}
						} else if (num == 1) {
							return 1;
						}
					}
					return 0;
				},
			},
		},
	},
	fenxun2: {
		mark: "character",
		onremove: true,
		intro: {
			content: "到$的距离视为1",
		},
		mod: {
			globalFrom(from, to) {
				if (from.getStorage("fenxun2").includes(to)) {
					return -Infinity;
				}
			},
		},
	},
	duanbing: {
		audio: 2,
		audioname2: { heqi: "duanbing_heqi" },
		trigger: { player: "useCard2" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !event.targets.includes(current) && get.distance(player, current) <= 1 && player.canUse(event.card, current);
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("duanbing"), "为" + get.translation(trigger.card) + "增加一个目标", function (card, player, target) {
					return !_status.event.sourcex.includes(target) && get.distance(player, target) <= 1 && player.canUse(_status.event.card, target);
				})
				.set("sourcex", trigger.targets)
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.effect(target, _status.event.card, player, player);
				})
				.set("card", trigger.card);
			"step 1";
			if (result.bool) {
				if (!event.isMine() && !event.isOnline()) {
					game.delayx();
				}
				event.target = result.targets[0];
			} else {
				event.finish();
			}
			"step 2";
			player.logSkill("duanbing", event.target);
			trigger.targets.push(event.target);
		},
		ai: {
			effect: {
				player_use(card, player, target, current, isLink) {
					if (!isLink && card.name == "sha") {
						if (player._duanbingtmp) {
							return;
						}
						player._duanbingtmp = true;
						if (get.effect(target, card, player, player) <= 0) {
							delete player._duanbingtmp;
							return;
						}
						if (
							game.hasPlayer(function (current) {
								return current != target && get.distance(player, current) <= 1 && player.canUse(card, current) && get.effect(current, card, player, player) > 0;
							})
						) {
							delete player._duanbingtmp;
							return [1, 1];
						}
						delete player._duanbingtmp;
					}
				},
			},
		},
	},
};
