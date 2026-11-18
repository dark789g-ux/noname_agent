import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "liaoyi" | "binglun" | "mjweipo" | "mjweipo_effect" | "mjweipo_remove" | "mjchenshi" | "mjchenshi_player" | "mjchenshi_target">} */
export const groupSkills = {
	liaoyi: {
		audio: 2,
		trigger: { global: "phaseBegin" },
		filter(event, player) {
			if (player == event.player) {
				return false;
			}
			const num = event.player.getHp() - event.player.countCards("h");
			if (num < 0) {
				return true;
			}
			return num > 0 && _status.renku.length >= Math.min(4, num);
		},
		logTarget: "player",
		prompt2(event, player) {
			const target = event.player,
				num = target.getHp() - target.countCards("h");
			if (num < 0) {
				return `令${get.translation(target)}将${get.cnNumber(Math.min(4, -num))}张牌置入仁库`;
			}
			return `令${get.translation(target)}从仁库中获得${get.cnNumber(Math.min(4, num))}张牌`;
		},
		check(event, player) {
			const target = event.player,
				num = target.getHp() - target.countCards("h"),
				att = get.attitude(player, target);
			if (num < 0) {
				if (
					target.countCards("e", function (card) {
						return get.value(card, target) <= 0;
					}) >=
					-num / 2
				) {
					return att > 0;
				}
				return att <= 0;
			}
			return att > 0;
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			let num = target.getHp() - target.countCards("h");
			if (num < 0) {
				num = Math.min(4, -num);
				const hs = target.getCards("he");
				if (!hs.length) {
					return;
				}
				const result = hs.length <= num ? { bool: true, cards: hs } : await target.chooseCard("he", true, `将${get.cnNumber(num)}张牌置于仁库中`, num).forResult();
				if (result?.bool) {
					target.$throw(result.cards, 1000);
					game.log(target, "将", result.cards, "置入了仁库");
					await target.lose(result.cards, ui.special, "toRenku");
					await game.delayx();
				}
			} else {
				num = Math.min(4, num);
				if (!_status.renku.length) {
					return;
				}
				const result = await target
					.chooseButton([`选择获得${get.cnNumber(num)}张牌`, _status.renku], num, true)
					.set("ai", button => {
						return get.value(button.link, get.player());
					})
					.set("direct", true)
					.forResult();
				if (result?.bool) {
					await target.gain(result.links, "gain2", "fromRenku");
				}
			}
		},
	},
	binglun: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return _status.renku.length > 0;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("病论", _status.renku);
			},
			backup(links, player) {
				var obj = lib.skill.binglun_backup;
				obj.card = links[0];
				return obj;
			},
			prompt: () => "请选择【病论】的目标",
		},
		subSkill: {
			backup: {
				audio: "binglun",
				filterCard: () => false,
				selectCard: -1,
				filterTarget: true,
				delay: false,
				content() {
					"step 0";
					var card = lib.skill.binglun_backup.card;
					game.log(card, "从仁库进入了弃牌堆");
					player.$throw(card, 1000);
					game.delayx();
					game.cardsDiscard(card).fromRenku = true;
					"step 1";
					target
						.chooseControl()
						.set("choiceList", ["摸一张牌", "于自己的下回合结束后回复1点体力"])
						.set("ai", function () {
							if (_status.event.player.isHealthy()) {
								return 0;
							}
							return 1;
						});
					"step 2";
					if (result.index == 0) {
						target.draw();
					} else {
						target.addSkill("binglun_recover");
						target.addMark("binglun_recover", 1, false);
					}
				},
				ai: {
					result: {
						target(player, target) {
							if (target.isDamaged()) {
								return 1.5;
							}
							return 1;
						},
					},
				},
			},
			recover: {
				trigger: { player: "phaseEnd" },
				forced: true,
				popup: false,
				onremove: true,
				charlotte: true,
				content() {
					if (player.isDamaged()) {
						player.logSkill("binglun_recover");
						player.recover(player.countMark("binglun_recover"));
					}
					player.removeSkill("binglun_recover");
				},
				intro: {
					content: "下回合结束时回复#点体力",
				},
				ai: { threaten: 1.7 },
			},
		},
		ai: {
			combo: "jishi",
			order: 2,
			result: {
				player: 1,
			},
		},
	},
	mjweipo: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (player.hasSkill("mjweipo_used")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !current.hasSkill("mjweipo_effect");
			});
		},
		filterTarget(card, player, target) {
			return !target.hasSkill("mjweipo_effect");
		},
		content() {
			"step 0";
			player.addTempSkill("mjweipo_used");
			var list = ["binglinchengxiax"];
			list.addArray(get.zhinangs());
			player.chooseButton(["危迫：选择一个智囊", [list, "vcard"]], true).set("ai", function (button) {
				return _status.event.getParent().target.getUseValue({ name: button.link[2] });
			});
			"step 1";
			if (result.bool) {
				var name = result.links[0][2];
				game.log(player, "选择了", "#y" + get.translation(name));
				target.storage.mjweipo_effect = name;
				target.storage.mjweipo_source = player;
				target.addSkill("mjweipo_effect");
				game.delayx();
			}
		},
		subSkill: {
			used: {
				charlotte: true,
			},
		},
		ai: {
			order: 7.1,
			result: {
				target(player, target) {
					if (target == player) {
						return player.countCards("hs", "sha") > 0 ? 10 : 0.01;
					}
					return (target.countCards("hs", "sha") + 0.5) * Math.sqrt(Math.max(1, target.hp));
				},
			},
		},
	},
	mjweipo_effect: {
		audio: "mjweipo",
		enable: "phaseUse",
		sourceSkill: "mjweipo",
		filter(event, player) {
			return player.countCards("h", "sha") > 0;
		},
		prompt() {
			return "弃置一张【杀】并获得一张" + get.translation(_status.event.player.storage.mjweipo_effect);
		},
		filterCard: { name: "sha" },
		check(card) {
			return 6 - get.value(card);
		},
		position: "h",
		popname: true,
		content() {
			var name = player.storage.mjweipo_effect,
				card = false;
			if (name == "binglinchengxiax") {
				if (!_status.binglinchengxiax) {
					_status.binglinchengxiax = [
						["spade", 7],
						["club", 7],
						["club", 13],
					];
					game.broadcastAll(function () {
						lib.inpile.add("binglinchengxiax");
					});
				}
				if (_status.binglinchengxiax.length) {
					var info = _status.binglinchengxiax.randomRemove();
					card = game.createCard2("binglinchengxiax", info[0], info[1]);
				}
			}
			if (!card) {
				card = get.cardPile2(name);
			}
			if (card) {
				player.gain(card, "gain2");
			}
			player.removeSkill("mjweipo_effect");
		},
		ai: {
			order: 7,
			result: { player: 1 },
		},
		mark: true,
		marktext: "迫",
		intro: { content: "可弃置一张【杀】并获得【$】" },
		group: "mjweipo_remove",
	},
	mjweipo_remove: {
		trigger: { global: ["phaseBegin", "die"] },
		forced: true,
		firstDo: true,
		popup: false,
		sourceSkill: "mjweipo",
		filter(event, player) {
			return event.player == player.storage.mjweipo_source;
		},
		content() {
			player.removeSkill("mjweipo_effect");
		},
	},
	mjchenshi: {
		audio: 2,
		global: ["mjchenshi_player", "mjchenshi_target"],
		ai: { combo: "mjweipo" },
	},
	mjchenshi_player: {
		trigger: { player: "useCardToPlayered" },
		sourceSkill: "mjchenshi",
		filter(event, player) {
			if (!event.card || event.card.name != "binglinchengxiax" || !event.isFirstTarget) {
				return false;
			}
			return (
				player.countCards("he") > 0 &&
				game.hasPlayer(function (current) {
					return current != player && current.hasSkill("mjchenshi");
				})
			);
		},
		async cost(event, trigger, player) {
			const list = game.filterPlayer(function (current) {
				return current != player && current.hasSkill("mjchenshi");
			});
			event.result = await player
				.chooseCardTarget({
					prompt: "是否交给" + get.translation(list) + "一张牌，将牌堆顶三张牌中不为【杀】的牌置于弃牌堆？",
					filterCard: true,
					position: "he",
					filterTarget(card, player, target) {
						return _status.event.list.includes(target);
					},
					list: list,
					selectTarget: list.length > 1 ? 1 : -1,
					goon: (function () {
						for (var i of list) {
							if (get.attitude(player, i) > 0) {
								return 1;
							}
							return -1;
						}
					})(),
					ai1(card) {
						if (_status.event.goon > 0) {
							return 7 - get.value(card);
						}
						return 0.01 - get.value(card);
					},
					ai2(target) {
						var card = ui.selected.cards[0];
						return get.value(card, target) * get.attitude(_status.event.player, target);
					},
				})
				.forResult();
		},
		popup: false,
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
			} = event;
			target.logSkill("mjchenshi");
			player.line(target, "green");
			trigger.getParent().mjchenshi_ai = true;
			await player.give(cards, target);
			const top = get.cards(3, true).filter(card => get.name(card) != "sha");
			if (top.length) {
				game.log(top, "进入了弃牌堆");
				player.$throw(top, 1000);
				await game.cardsDiscard(top);
				await game.delayx();
			}
		},
	},
	mjchenshi_target: {
		trigger: { target: "useCardToTargeted" },
		sourceSkill: "mjchenshi",
		filter(event, player) {
			if (!event.card || event.card.name != "binglinchengxiax") {
				return false;
			}
			return (
				player.countCards("he") > 0 &&
				game.hasPlayer(function (current) {
					return current != player && current.hasSkill("mjchenshi");
				})
			);
		},
		async cost(event, trigger, player) {
			const list = game.filterPlayer(function (current) {
				return current != player && current.hasSkill("mjchenshi");
			});
			event.result = await player
				.chooseCardTarget({
					prompt: "是否交给" + get.translation(list) + "一张牌，将牌堆顶三张牌中的【杀】置于弃牌堆？",
					filterCard: true,
					position: "he",
					filterTarget(card, player, target) {
						return _status.event.list.includes(target);
					},
					list: list,
					selectTarget: list.length > 1 ? 1 : -1,
					goon: (function () {
						if (trigger.getParent().chenshi_ai) {
							return 1;
						}
						for (var i of list) {
							if (get.attitude(player, i) > 0) {
								return 1;
							}
							return -1;
						}
					})(),
					ai1(card) {
						if (_status.event.goon > 0) {
							return 7 - get.value(card);
						}
						return 3 - get.value(card);
					},
					ai2(target) {
						var card = ui.selected.cards[0];
						return Math.max(0.1, get.value(card, target) * get.attitude(_status.event.player, target));
					},
				})
				.forResult();
		},
		popup: false,
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
			} = event;
			target.logSkill("mjchenshi");
			player.line(target, "green");
			await player.give(cards, target);
			const top = get.cards(3, true).filter(card => get.name(card) == "sha");
			if (top.length) {
				game.log(top, "进入了弃牌堆");
				player.$throw(top, 1000);
				await game.cardsDiscard(top);
				await game.delayx();
			}
		},
	},
};
