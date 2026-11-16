import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mingfa" | "rongbei" | "yizhu" | "luanchou" | "gonghuan">} */
export const groupSkills = {
	//羊祜
	mingfa: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			return (
				player.storage.mingfa &&
				player.countCards("h") > 0 &&
				player.getCards("he").includes(player.storage.mingfa) &&
				!player.hasSkillTag("noCompareSource") &&
				game.hasPlayer(function (current) {
					return current != player && player.canCompare(current);
				})
			);
		},
		content() {
			"step 0";
			event.card = player.storage.mingfa;
			delete player.storage.mingfa;
			player
				.chooseTarget(get.prompt("mingfa"), "用" + get.translation(event.card) + "和一名其他角色拼点", function (card, player, target) {
					return player.canCompare(target);
				})
				.set("ai", function (target) {
					var player = _status.event.player,
						card = _status.event.getParent().card;
					if (
						card.number > 9 ||
						!target.countCards("h", function (cardx) {
							return cardx.number >= card.number + 2;
						})
					) {
						return -get.attitude(player, target) / Math.sqrt(target.countCards("h"));
					}
					return 0;
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("mingfa", target);
				var next = player.chooseToCompare(target);
				if (!next.fixedResult) {
					next.fixedResult = {};
				}
				next.fixedResult[player.playerid] = event.card;
			} else {
				player.removeGaintag("mingfa");
				event.finish();
			}
			"step 2";
			if (result.bool) {
				player.gainPlayerCard(target, true, "he");
				if (event.card.number == 1) {
					event.finish();
				}
			} else {
				player.addTempSkill("mingfa_block");
				event.finish();
			}
			"step 3";
			var card = get.cardPile2(function (card) {
				return card.number == event.card.number - 1;
			});
			if (card) {
				player.gain(card, "gain2");
			}
		},
		group: ["mingfa_choose", "mingfa_add", "mingfa_mark"],
		subSkill: {
			block: {
				mod: {
					playerEnabled(card, player, target) {
						if (player != target) {
							return false;
						}
					},
				},
			},
			choose: {
				trigger: { player: "phaseJieshuBegin" },
				direct: true,
				filter(event, player) {
					return player.countCards("he") > 0;
				},
				content() {
					"step 0";
					player.chooseCard("he", get.prompt("mingfa"), "选择展示自己的一张牌").set("ai", function (card) {
						return Math.min(13, get.number(card) + 2) / Math.pow(Math.min(2, get.value(card)), 0.25);
					});
					"step 1";
					if (result.bool) {
						var card = result.cards[0];
						player.logSkill("mingfa");
						player.removeGaintag("mingfa");
						player.addGaintag(card, "mingfa");
						player.storage.mingfa = card;
						player.showCards(card, get.translation(player) + "发动了【明伐】");
					}
				},
			},
			add: {
				audio: "mingfa",
				trigger: { player: "compare", target: "compare" },
				filter(event, player) {
					if (event.player == player) {
						return !event.iwhile;
					}
					return true;
				},
				forced: true,
				locked: false,
				content() {
					if (player == trigger.player) {
						trigger.num1 += 2;
						if (trigger.num1 > 13) {
							trigger.num1 = 13;
						}
					} else {
						trigger.num2 += 2;
						if (trigger.num2 > 13) {
							trigger.num2 = 13;
						}
					}
					game.log(player, "的拼点牌点数+2");
				},
			},
			mark: {
				trigger: { player: "gainEnd" },
				silent: true,
				firstDo: true,
				filter(event, player) {
					return player.storage.mingfa && event.cards.includes(player.storage.mingfa) && player.getCards("h").includes(player.storage.mingfa);
				},
				content() {
					player.addGaintag(player.storage.mingfa, "mingfa");
				},
			},
		},
	},
	rongbei: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.rongbei.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			for (var i = 1; i < 6; i++) {
				if (target.hasEmptySlot(i)) {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			event.num = 1;
			player.awakenSkill(event.name);
			"step 1";
			while (!target.hasEmptySlot(event.num)) {
				event.num++;
				if (event.num > 5) {
					event.finish();
					return;
				}
			}
			var card = get.cardPile2(function (card) {
				return get.subtype(card) == "equip" + event.num && target.canUse(card, target);
			});
			if (card) {
				target.chooseUseTarget(card, true, "nopopup");
			}
			event.num++;
			if (event.num <= 5) {
				event.redo();
			}
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					return (target.hasSkillTag("noe") ? 2 : 1) * (5 - target.countCards("e") - target.countDisabled());
				},
			},
		},
	},
	//桥公
	yizhu: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		locked: false,
		content() {
			"step 0";
			player.draw(2);
			"step 1";
			var hs = player.getCards("he");
			if (!hs.length) {
				event.finish();
			} else if (hs.length <= 2) {
				event._result = { bool: true, cards: hs };
			} else {
				player.chooseCard("he", true, 2, "选择两张牌洗入牌堆");
			}
			"step 2";
			if (result.bool) {
				player.$throw(result.cards.length, 1000);
				player.lose(result.cards, ui.cardPile).insert_index = function () {
					return ui.cardPile.childNodes[get.rand(0, game.players.length * 2 - 2)];
				};
				player.markAuto("yizhu", result.cards);
			} else {
				event.finish();
			}
			"step 3";
			game.updateRoundNumber();
			game.delayx();
		},
		intro: {
			mark(dialog, content, player) {
				if (player == game.me || player.isUnderControl()) {
					dialog.addAuto(content);
				} else {
					var names = [];
					for (var i of content) {
						names.add(i.name);
					}
					return get.translation(names);
				}
			},
		},
		group: "yizhu_use",
		subSkill: {
			use: {
				audio: "yizhu",
				trigger: { global: "useCardToPlayer" },
				filter(event, player) {
					return (
						player.storage.yizhu &&
						player.storage.yizhu.length &&
						event.player != player &&
						event.targets.length == 1 &&
						event.cards.filter(function (i) {
							return player.storage.yizhu.includes(i);
						}).length > 0
					);
				},
				logTarget: "player",
				check(event, player) {
					return get.effect(event.targets[0], event.card, event.player, player) < 0;
				},
				prompt2(event, player) {
					return "令" + get.translation(event.card) + "无效";
				},
				content() {
					trigger.cancel();
					trigger.targets.length = 0;
					trigger.getParent().triggeredTargets1.length = 0;
					var list = trigger.cards.filter(function (i) {
						return player.storage.yizhu.includes(i);
					});
					player.unmarkAuto("yizhu", list);
					game.delayx();
				},
			},
		},
	},
	luanchou: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		selectTarget: 2,
		filterTarget: true,
		multitarget: true,
		multiline: true,
		content() {
			game.countPlayer(function (current) {
				var num = current.countMark("luanchou");
				if (num) {
					current.removeMark("luanchou", num);
				}
			});
			targets.sortBySeat();
			for (var i of targets) {
				i.addMark("luanchou", 1);
			}
		},
		global: ["gonghuan", "gonghuan_clear"],
		derivation: "gonghuan",
		marktext: "姻",
		intro: {
			name: "共患",
			content: () => lib.translate.gonghuan_info,
			onunmark: true,
		},
		ai: {
			order: 10,
			expose: 0.2,
			result: {
				target(player, target) {
					if (!ui.selected.targets.length) {
						return -Math.pow(target.hp, 3);
					}
					if (target.hp >= ui.selected.targets[0].hp) {
						return 0;
					}
					return Math.pow(ui.selected.targets[0].hp - target.hp, 3);
				},
			},
		},
	},
	gonghuan: {
		audio: 2,
		forceaudio: true,
		trigger: { global: "damageBegin4" },
		usable: 1,
		forced: true,
		logTarget: "player",
		filter(event, player) {
			return (
				event.player.hp < player.hp &&
				player.hasMark("luanchou") &&
				event.player.hasMark("luanchou") &&
				game.hasPlayer(function (current) {
					return current.hasSkill("luanchou");
				})
			);
		},
		content() {
			trigger._gonghuan_player = trigger.player;
			trigger.player = player;
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (_status.luanchou_judging) {
						return;
					}
					if (get.tag(card, "damage") && target.hasMark("luanchou")) {
						var other = game.findPlayer(function (current) {
							return current != target && current.hasMark("luanchou") && current.hp > target.hp && (!current.storage.counttrigger || !current.storage.counttrigger.gonghuan);
						});
						if (!other) {
							return;
						}
						_status.luanchou_judging = true;
						var eff = [0, 0, 0, get.damageEffect(other, player, player, get.nature(card)) / get.attitude(player, player)];
						delete _status.luanchou_judging;
						return eff;
					}
				},
			},
		},
		subSkill: {
			clear: {
				trigger: { player: "damageEnd" },
				forced: true,
				popup: false,
				filter(event, player) {
					return event._gonghuan_player;
				},
				content() {
					player.removeMark("luanchou", player.countMark("luanchou"));
					trigger._gonghuan_player.removeMark("luanchou", trigger._gonghuan_player.countMark("luanchou"));
				},
			},
		},
	},
};
