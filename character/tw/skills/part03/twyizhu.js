import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twyizhu" | "twluanchou" | "twgonghuan">} */
export const groupSkills = {
	//桥公
	twyizhu: {
		audio: "yizhu",
		group: ["twyizhu_use", "twyizhu_discard"],
		trigger: {
			player: ["phaseJieshuBegin", "enterGame"],
			global: "phaseBefore",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			const num = Math.min(4, game.countPlayer());
			await player.draw(num);
			const hs = player.getCards("he");
			if (!hs.length) {
				return;
			}
			const result =
				hs.length > 2
					? await player.chooseCard("he", true, 2, "选择两张牌洗入牌堆").forResult()
					: {
							bool: true,
							cards: hs,
						};
			if (result?.bool) {
				player.$throw(result.cards.length, 1000);
				const next = player.lose(result.cards, ui.cardPile);
				next.insert_index = function () {
					return ui.cardPile.childNodes[get.rand(0, Math.min(4, game.countPlayer()) * 2 - 2)];
				};
				player.markAuto("twyizhu", result.cards);
				await next;
				game.updateRoundNumber();
				await game.delayx();
			}
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
		subSkill: {
			use: {
				audio: "yizhu",
				trigger: { global: "useCardToPlayer" },
				filter(event, player) {
					return (
						player.getStorage("twyizhu").length &&
						event.player != player &&
						event.targets.length == 1 &&
						event.cards.filter(function (i) {
							return player.getStorage("twyizhu").includes(i);
						}).length > 0
					);
				},
				logTarget: "player",
				forced: true,
				locked: false,
				content() {
					"step 0";
					var list = [];
					if (
						!game.hasPlayer(function (current) {
							return current != trigger.target && lib.filter.targetEnabled2(trigger.card, trigger.player, current);
						})
					) {
						event.goto(3);
					}
					var filter = function (event, player) {
						var card = event.card,
							info = get.info(card);
						if (info.allowMultiple == false) {
							return false;
						}
						if (!info.multitarget) {
							return game.hasPlayer(current => lib.filter.targetEnabled2(card, player, current));
						}
						return false;
					};
					var enable = filter(trigger.getParent(), trigger.player);
					var prompt2 = "操作提示：";
					if (enable) {
						prompt2 += "选择一名合法的其他角色，以增加其为目标；或";
					}
					prompt2 += "选择目标角色（" + get.translation(trigger.target) + "）和另一名合法的角色，以取消前者为目标并增加后者为目标";
					player
						.chooseTarget(
							"遗珠：是否" + (enable ? "增加或" : "") + "修改目标？",
							prompt2,
							[enable ? 1 : 2, 2],
							(card, player, target) => {
								var evt = _status.event.getTrigger(),
									card = evt.card;
								if (target == evt.target) {
									return true;
								}
								if (ui.selected.targets.length && ui.selected.targets[0] != evt.target) {
									return false;
								}
								return lib.filter.targetEnabled2(card, evt.player, target);
							}
						)
						.set("targetprompt", target => {
							return target == _status.event.targetx ? "取消目标" : "增加目标";
						})
						.set("filterOk", () => {
							if (ui.selected.targets.length == 1 && ui.selected.targets[0] == _status.event.targetx) {
								return false;
							}
							return true;
						})
						.set("ai", target => {
							var evt = _status.event.getTrigger(),
								card = evt.card,
								player = _status.event.player;
							if (target == evt.target && get.effect(evt.target, card, evt.player, player) < 0) {
								return 100;
							}
							if (target == evt.target) {
								return -100;
							}
							return get.effect(target, card, evt.player, player);
						})
						.set("targetx", trigger.target)
						.set("card", trigger.card);
					"step 1";
					if (result.bool) {
						var target = result.targets[result.targets[0] == trigger.target ? 1 : 0];
						if (result.targets.length > 1) {
							player.line2([trigger.target, target]);
							trigger.targets.remove(trigger.target);
							trigger.getParent().triggeredTargets1.remove(trigger.target);
							trigger.untrigger();
						} else {
							player.line(target);
						}
						trigger.targets.push(target);
					}
					"step 2";
					var list = trigger.cards.filter(function (i) {
						return player.getStorage("twyizhu").includes(i);
					});
					player.unmarkAuto("twyizhu", list);
					player.draw();
					game.delayx();
				},
			},
			discard: {
				trigger: {
					global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter", "equipAfter"],
				},
				silent: true,
				forced: true,
				locked: false,
				filter(event, player) {
					return (
						player.getStorage("twyizhu").length &&
						event.getd().filter(function (i) {
							return player.getStorage("twyizhu").includes(i);
						}).length > 0
					);
				},
				content() {
					var list = trigger.getd().filter(function (i) {
						return player.getStorage("twyizhu").includes(i);
					});
					player.unmarkAuto("twyizhu", list);
				},
			},
		},
	},
	twluanchou: {
		audio: "luanchou",
		enable: "phaseUse",
		usable: 1,
		selectTarget: 2,
		filterTarget: true,
		multitarget: true,
		multiline: true,
		content() {
			"step 0";
			game.filterPlayer()
				.sortBySeat()
				.forEach(function (current) {
					current.removeSkills("twgonghuan");
				});
			"step 1";
			targets.sortBySeat();
			for (var i of targets) {
				i.addSkills("twgonghuan");
			}
		},
		derivation: "twgonghuan",
		ai: {
			order: 10,
			expose: 0.2,
			result: {
				target(player, target) {
					return Math.max(0.1, target.hp) * (get.attitude(player, target) + 20);
				},
			},
		},
	},
	twgonghuan: {
		audio: "gonghuan",
		trigger: { global: "damageBegin4" },
		usable: 1,
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			return !event.twgonghuan && event.player.hp <= player.hp && event.player.hasSkill("twgonghuan");
		},
		check(event, player) {
			if (
				get.damageEffect(event.player, event.source, player) > 0 ||
				(get.attitude(player, event.player) > 0 && get.damageEffect(event.player, event.source, event.player) > 0)
			) {
				return false;
			}
			return (
				get.attitude(player, event.player) > 0 &&
				event.player.hp < player.hp &&
				((["君", "主"].includes(lib.translate[event.player.identity]) && !["野", "内"].includes(lib.translate[player.identity])) ||
					player.hp + player.hujia - event.num > 0)
			);
		},
		logTarget: "player",
		content() {
			trigger.cancel();
			player
				.damage(trigger.source ? trigger.source : "nosource", trigger.nature, trigger.num)
				.set("card", trigger.card)
				.set("cards", trigger.cards).twgonghuan = true;
		},
	},
};
