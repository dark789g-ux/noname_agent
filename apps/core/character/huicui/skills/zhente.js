import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhente" | "zhente2" | "zhiwei" | "zhiwei2" | "spwanggui" | "wanggui" | "xibing">} */
export const groupSkills = {
	//陆郁生
	zhente: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		logTarget: "player",
		usable: 1,
		preHidden: true,
		filter(event, player) {
			var color = get.color(event.card);
			if (player == event.player || event.player.isDead() || color == "none" || (get.mode() == "guozhan" && color != "black")) {
				return false;
			}
			var type = get.type(event.card);
			return type == "basic" || type == "trick";
		},
		check(event, player) {
			return !event.excluded.includes(player) && get.effect(player, event.card, event.player, player) < 0;
		},
		async content(event, trigger, player) {
			const result = await trigger.player
				.chooseControl()
				.set("choiceList", ["本回合内不能再使用" + get.translation(get.color(trigger.card)) + "牌", "令" + get.translation(trigger.card) + "对" + get.translation(player) + "无效"])
				.set("prompt", get.translation(player) + "发动了【贞特】，请选择一项")
				.set("ai", function () {
					var player = _status.event.player;
					var target = _status.event.getParent().player;
					var card = _status.event.getTrigger().card,
						color = get.color(card);
					if (get.effect(target, card, player, player) <= 0) {
						return 1;
					}
					var hs = player.countCards("h", function (card) {
						return get.color(card, player) == color && player.hasValueTarget(card, null, true);
					});
					if (!hs.length) {
						return 0;
					}
					if (hs > 1) {
						return 1;
					}
					return Math.random() > 0.5 ? 0 : 1;
				})
				.forResult();
			if (result.index == 0) {
				trigger.player.addTempSkill("zhente2");
				trigger.player.storage.zhente2.add(get.color(trigger.card));
				trigger.player.markSkill("zhente2");
			} else {
				trigger.excluded.add(player);
			}
		},
	},
	zhente2: {
		mod: {
			cardEnabled(card, player) {
				const color = get.color(card);
				if (color != "unsure" && player.getStorage("zhente2").includes(color)) {
					return false;
				}
			},
			cardSavable(card, player) {
				const color = get.color(card);
				if (color != "unsure" && player.getStorage("zhente2").includes(color)) {
					return false;
				}
			},
		},
		charlotte: true,
		onremove: true,
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = [];
			}
		},
		intro: { content: "本回合内不能使用$牌" },
	},
	zhiwei: {
		audio: 2,
		trigger: {
			player: ["enterGame", "showCharacterAfter", "phaseBegin"],
			global: ["phaseBefore"],
		},
		direct: true,
		filter(event, player, name) {
			if (player.hasSkill("zhiwei2")) {
				return false;
			}
			if (!game.hasPlayer(current => current != player)) {
				return false;
			}
			if (get.mode() == "guozhan") {
				return (
					event.name == "showCharacter" &&
					event.toShow.some(name => {
						return get.character(name, 3).includes("zhiwei");
					})
				);
			}
			return event.name != "showCharacter" && (name != "phaseBefore" || game.phaseNumber == 0);
		},
		async content(event, trigger, player) {
			let result;

			result = await player
				.chooseTarget("请选择【至微】的目标", "选择一名其他角色。该角色造成伤害后，你摸一张牌，该角色受到伤害后，你随机弃置一张手牌。你弃牌阶段弃置的牌均被该角色获得。", true, lib.filter.notMe)
				.set("ai", target => {
					const att = get.attitude(_status.event.player, target);
					if (att > 0) {
						return 1 + att;
					}
					return Math.random();
				})
				.forResult();
			if (result.bool) {
				const target = result.targets[0];
				player.logSkill("zhiwei", target);
				player.storage.zhiwei2 = target;
				player.addSkill("zhiwei2");
			}
		},
	},
	zhiwei2: {
		group: ["zhiwei2_draw", "zhiwei2_discard", "zhiwei2_gain", "zhiwei2_clear"],
		charlotte: true,
		onremove: true,
		mark: "character",
		sourceSkill: "zhiwei",
		intro: {
			content: "$造成伤害后你摸一张牌；$受到伤害后你弃置一张牌；你于弃牌阶段弃置牌后交给$",
		},
		subSkill: {
			draw: {
				audio: "zhiwei",
				trigger: { global: "damageSource" },
				forced: true,
				filter(event, player) {
					return event.source == player.storage.zhiwei2;
				},
				logTarget: "source",
				async content(event, trigger, player) {
					player.draw();
				},
			},
			discard: {
				audio: "zhiwei",
				trigger: { global: "damageEnd" },
				forced: true,
				filter(event, player) {
					return (
						event.player == player.storage.zhiwei2 &&
						player.countCards("h", function (card) {
							return lib.filter.cardDiscardable(card, player, "zhiwei2_discard");
						})
					);
				},
				logTarget: "player",
				async content(event, trigger, player) {
					player.discard(
						player
							.getCards("h", function (card) {
								return lib.filter.cardDiscardable(card, player, "zhiwei2_discard");
							})
							.randomGet()
					);
				},
			},
			gain: {
				audio: "zhiwei",
				trigger: {
					player: "loseAfter",
					global: "loseAsyncAfter",
				},
				forced: true,
				filter(event, player) {
					if (event.type != "discard" || event.getlx === false || event.getParent("phaseDiscard").player != player || !player.storage.zhiwei2 || !player.storage.zhiwei2.isIn()) {
						return false;
					}
					var evt = event.getl(player);
					return evt && evt.cards2.filterInD("d").length > 0;
				},
				logTarget(event, player) {
					return player.storage.zhiwei2;
				},
				async content(event, trigger, player) {
					if (trigger.delay === false) {
						game.delay();
					}
					player.storage.zhiwei2.gain(trigger.getl(player).cards2.filterInD("d"), "gain2");
				},
			},
			clear: {
				audio: "zhiwei",
				trigger: {
					global: "die",
					player: ["hideCharacterEnd", "removeCharacterEnd"],
				},
				forced: true,
				filter(event, player) {
					if (event.name == "die") {
						return event.player == player.storage.zhiwei2;
					}
					if (event.name == "removeCharacter") {
						return event.toRemove == "luyusheng" || event.toRemove == "gz_luyusheng";
					}
					return event.toHide == "luyusheng" || event.toHide == "gz_luyusheng";
				},
				async content(event, trigger, player) {
					player.removeSkill("zhiwei2");
					if (trigger.name !== "die" || get.mode() !== "guozhan") {
						return;
					}
					if (get.character(player.name1, 3).includes("zhiwei")) {
						player.hideCharacter(0);
					}
					if (get.character(player.name2, 3).includes("zhiwei")) {
						player.hideCharacter(1);
					}
				},
			},
		},
	},
	//华歆
	spwanggui: {
		audio: "wanggui",
		trigger: { source: "damageSource" },
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.group != player.group;
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "对一名势力不同的其他角色造成1点伤害", function (card, player, target) {
					return target.group != player.group;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			target.damage();
		},
		group: "spwanggui_draw",
		subSkill: {
			draw: {
				audio: "wanggui",
				trigger: { player: "damageEnd" },
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(get.prompt("spwanggui"), "令自己摸一张牌，或和一名势力相同的其他角色各摸一张牌", function (card, player, target) {
							return target.group == player.group;
						})
						.set("ai", function (target) {
							var player = _status.event.player,
								att = get.attitude(player, target);
							if (target != player) {
								att *= 2;
							}
							if (target.hasSkillTag("nogain")) {
								att /= 1.7;
							}
							return att;
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					if (player == target) {
						await player.draw();
						return;
					}

					const list = [player, target].sortBySeat();
					await game.asyncDraw(list);
					await game.delayx();
				},
			},
		},
	},
	wanggui: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player) {
			if (player.isUnseen()) {
				return false;
			}
			if (!player.isUnseen(2)) {
				return true;
			}
			return (!player.isUnseen(0) && get.character(player.name1, 3).includes("wanggui")) || (!player.isUnseen(1) && get.character(player.name2, 3).includes("wanggui"));
		},
		usable: 1,
		preHidden: true,
		async cost(event, trigger, player) {
			if (player.isUnseen(2)) {
				event.result = await player
					.chooseTarget(get.prompt(event.skill), "望归：是否对与你势力不同的一名角色造成1点伤害？", (card, player, target) => {
						return target.isEnemyOf(player);
					})
					.set("ai", target => {
						let player = _status.event.player;
						return get.damageEffect(target, player, player);
					})
					.setHiddenSkill(event.skill)
					.forResult();
			} else {
				event.result = await player.chooseBool("望归：是否令与你势力相同的角色各摸一张牌？").setHiddenSkill(event.skill).forResult();
				event.result.targets = game.filterPlayer(current => {
					return current.isFriendOf(player);
				});
			}
		},
		async content(event, trigger, player) {
			if (player.isUnseen(2)) {
				const target = event.targets[0];
				target.damage("nocard");
			} else {
				const targets = event.targets;
				targets.sortBySeat();
				await game.asyncDraw(targets);
			}
		},
	},
	xibing: {
		audio: 2,
		trigger: { global: "useCardToPlayered" },
		filter(event, player) {
			if (player == event.player || event.targets.length != 1) {
				return false;
			}
			var bool = function (card) {
				return (card.name == "sha" || get.type(card, null, false) == "trick") && get.color(card, false) == "black";
			};
			if (!bool(event.card)) {
				return false;
			}
			var evt = event.getParent("phaseUse");
			if (evt.player != event.player) {
				return false;
			}
			return true;
		},
		usable: 1,
		logTarget: "player",
		check(event, player) {
			var target = event.player;
			var att = get.attitude(player, target);
			var num2 = Math.min(5, target.hp) - target.countCards("h");
			if (num2 <= 0) {
				return false;
			}
			var num = target.countCards("h", function (card) {
				return target.hasValueTarget(card, null, true);
			});
			if (!num) {
				return att > 0;
			}
			return (num - num2) * att < 0;
		},
		preHidden: true,
		async content(event, trigger, player) {
			const num = Math.min(5, trigger.player.hp) - trigger.player.countCards("h");
			if (num > 0) {
				trigger.player.draw(num);
				trigger.player.addTempSkill("xibing_banned");
			}
		},
		subSkill: {
			banned: {
				mod: {
					cardEnabled(card) {
						return false;
					},
					cardSavable(card) {
						return false;
					},
				},
			},
		},
	},
};
