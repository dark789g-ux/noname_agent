import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "drlt_wanglie2" | "liangyin" | "kongsheng" | "kongsheng_ai" | "kongsheng2" | "nzry_juzhan" | "nzry_feijun" | "nzry_binglve" | "nzry_huaiju_ai" | "nzry_huaiju" | "tachibana_effect">} */
export const groupSkills = {
	drlt_wanglie2: {
		mod: {
			cardEnabled(card, player) {
				return false;
			},
		},
	},
	liangyin: {
		audio: 2,
		group: ["liangyin_1", "liangyin_2"],
		subSkill: {
			1: {
				audio: "liangyin",
				trigger: {
					global: ["loseAfter", "addToExpansionAfter", "cardsGotoSpecialAfter", "loseAsyncAfter"],
				},
				filter(event, player, name) {
					if (event.name == "lose" || event.name == "loseAsync") {
						return event.getlx !== false && event.toStorage == true;
					}
					if (event.name == "cardsGotoSpecial") {
						return !event.notrigger;
					}
					return true;
				},
				async cost(event, trigger, player) {
					const next = player.chooseTarget("是否发动【良姻】令手牌数大于你的一名角色摸一张牌？", function (card, player, target) {
						return target != player && target.countCards("h") > player.countCards("h");
					});
					next.ai = function (target) {
						const player = get.player();
						return get.attitude(player, target);
					};
					event.result = await next.forResult();
				},
				async content(event, trigger, player) {
					await event.targets[0].draw();
				},
			},
			2: {
				audio: "liangyin",
				trigger: {
					global: "gainAfter",
				},
				filter(event, player) {
					return (
						event.fromStorage == true ||
						game.hasPlayer2(function (current) {
							const evt = event.getl(current);
							return evt && evt.xs && evt.xs.length > 0;
						})
					);
				},
				async cost(event, trigger, player) {
					const next = player.chooseTarget("是否发动【良姻】令手牌数小于你的一名角色弃置一张牌？", function (card, player, target) {
						return target != player && target.countCards("h") < player.countCards("h") && target.countCards("he") > 0;
					});
					next.ai = function (target) {
						const player = get.player();
						return -get.attitude(player, target);
					};
					event.result = await next.forResult();
				},
				async content(event, trigger, player) {
					await event.targets[0].chooseToDiscard("he", 1, true);
				},
			},
		},
	},
	kongsheng: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt(event.skill), "将任意张牌置于武将牌上", "he", [1, player.countCards("he")], "allowChooseAll")
				.set("ai", function (card) {
					const player = get.player();
					if (get.position(card) == "e") {
						return 1 - get.value(card);
					}
					if (card.name == "shan" || card.name == "du" || !player.hasValueTarget(card)) {
						return 1;
					}
					return 4 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.addSkill("kongsheng2");
			const next = player.addToExpansion(event.cards, "log", "give", player);
			next.gaintag.add("kongsheng2");
			await next;
		},
	},
	kongsheng_ai: { ai: { reverseOrder: true } },
	kongsheng2: {
		audio: "kongsheng",
		marktext: "箜",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		trigger: {
			player: "phaseJieshuBegin",
		},
		sourceSkill: "kongsheng",
		filter(event, player) {
			return player.getExpansions("kongsheng2").length > 0;
		},
		forced: true,
		charlotte: true,
		async content(event, trigger, player) {
			player.addTempSkill("kongsheng_ai", "kongsheng2After");
			while (true) {
				const cards = player.getExpansions("kongsheng2").filter(function (i) {
					return get.type(i, null, false) == "equip" && player.hasUseTarget(i);
				});
				if (cards.length > 0) {
					let [card] = cards;
					if (cards.length > 1) {
						const result = await player
							.chooseButton(true, ["选择要使用的装备牌", cards])
							.set("ai", function (button) {
								return get.order(button.link);
							})
							.forResult();
						if (!result.bool) {
							continue;
						}
						[card] = result.links;
					}
					await player.chooseUseTarget(card, true);
				} else {
					break;
				}
			}
			const cards2 = player.getExpansions("kongsheng2");
			if (cards2.length) {
				await player.gain(cards2, "gain2");
			}
		},
	},
	nzry_juzhan: {
		audio: ["nzry_juzhan_11.mp3", "nzry_juzhan_12.mp3"],
		mark: true,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage, player, skill) {
				if (storage) {
					return "当你使用【杀】指定一名角色为目标后，你可以获得其一张牌，然后你本回合内不能再对其使用牌";
				}
				return "当你成为其他角色【杀】的目标后，你可以与其各摸一张牌，然后其本回合内不能再对你使用牌";
			},
		},
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			if (!player.storage.nzry_juzhan) {
				return player != event.player;
			}
			return player == event.player && event.target.countGainableCards(player, "he");
		},
		logTarget(event, player) {
			return player.storage.nzry_juzhan ? event.target : event.player;
		},
		check(event, player) {
			const target = get.info("nzry_juzhan").logTarget(event, player);
			return get.attitude(player, target) < 0;
		},
		prompt2(event, player) {
			const target = get.info("nzry_juzhan").logTarget(event, player);
			return player.storage.nzry_juzhan ? `获得${get.translation(target)}一张牌，然后你本回合内不能再对其使用牌` : `与${get.translation(target)}各摸一张牌，然后其本回合内不能再对你使用牌`;
		},
		async content(event, trigger, player) {
			const { name: skill } = event,
				target = get.info(skill).logTarget(trigger, player);
			player.changeZhuanhuanji(skill);
			const storage = player.storage[skill];
			const list = [player, target];
			if (storage) {
				await game.asyncDraw([player, target].sortBySeat());
				await game.delayx();
				list.reverse();
			} else {
				await player.gainPlayerCard(target, "he", true);
			}
			list[0].addTempSkill(skill + "_effect");
			list[0].markAuto(skill + "_effect", [list[1]]);
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					playerEnabled(card, player, target) {
						if (player.getStorage("nzry_juzhan_effect").includes(target)) {
							return false;
						}
					},
				},
				intro: { content: "本回合不能对$使用牌" },
			},
		},
	},
	nzry_feijun: {
		init: player => {
			if (!Array.isArray(player.storage.nzry_feijun)) {
				player.storage.nzry_feijun = [];
			}
		},
		intro: {
			content(storage) {
				if (!storage || !storage.length) {
					return "尚未发动";
				}
				const str = get.translation(storage);
				return "已对" + str + "发动过〖飞军〗";
			},
		},
		mark: true,
		enable: "phaseUse",
		usable: 1,
		position: "he",
		audio: 2,
		filter(event, player) {
			return (
				game.hasPlayer(function (current) {
					return current.countCards("h") >= player.countCards("h");
				}) ||
				game.hasPlayer(function (current) {
					return current.countCards("e") >= player.countCards("e");
				}) > 0
			);
		},
		filterCard: true,
		check(card) {
			return 5 - get.value(card);
		},
		async content(event, trigger, player) {
			const list = [];
			if (
				game.hasPlayer(function (current) {
					return current.countCards("h") > player.countCards("h");
				})
			) {
				list.push("令一名手牌数大于你的角色交给你一张牌");
			}
			if (
				game.hasPlayer(function (current) {
					return current.countCards("e") > player.countCards("e");
				}) > 0
			) {
				list.push("令一名装备区内牌数大于你的角色弃置一张装备牌");
			}
			if (list.length == 0) {
				return;
			}
			let index;
			if (list.length < 2) {
				if (
					game.hasPlayer(function (current) {
						return current.countCards("h") > player.countCards("h");
					})
				) {
					index = 0;
				} else {
					index = 1;
				}
			} else {
				({ index } = await player
					.chooseControl()
					.set("ai", function () {
						if (
							game.hasPlayer(function (current) {
								return current.countCards("h") > player.countCards("h") && get.attitude(player, current) < 0;
							})
						) {
							return 0;
						}
						return 1;
					})
					.set("choiceList", list)
					.forResult());
			}
			let result;
			if (index == 0) {
				result = await player
					.chooseTarget(function (card, player, target) {
						return target != player && target.countCards("h") > player.countCards("h");
					}, "选择一名手牌数大于你的角色")
					.set("ai", function (target) {
						return -get.attitude(player, target);
					})
					.forResult();
			} else {
				const next = player.chooseTarget(function (card, player, target) {
					return target.countCards("e") > player.countCards("e") && target != player;
				}, "选择一名装备区里牌数大于你的角色");
				next.ai = function (target) {
					return -get.attitude(player, target);
				};
				result = await next.forResult();
			}
			if (!result.bool) {
				return;
			}
			const target = result.targets[0];
			const list2 = player.getStorage("nzry_feijun");
			if (!list2.includes(target)) {
				event._nzry_binglve = true;
				player.markAuto("nzry_feijun", [target]);
			}
			player.line(target, "green");
			if (index == 0) {
				const result = await target
					.chooseCard("he", true, "选择一张牌交给" + get.translation(player))
					.set("ai", function (card) {
						return 6 - get.value(card);
					})
					.forResult();
				if (result.bool) {
					target.give(result.cards, player);
				}
			} else {
				await target.chooseToDiscard("he", true, { type: "equip" }, "请弃置一张装备牌");
			}
		},
		ai: {
			order: 11,
			result: {
				player(player) {
					if (
						game.hasPlayer(function (current) {
							return (current.countCards("h") > player.countCards("h") || current.countCards("e") > player.countCards("e")) && get.attitude(player, current) < 0 && player.getStorage("nzry_feijun").includes(current);
						}) ||
						game.hasPlayer(function (current) {
							return current.countCards("h") > player.countCards("h") && get.attitude(player, current) < 0;
						}) ||
						(player.countCards("h") >= 2 &&
							game.hasPlayer(function (current) {
								return current.countCards("e") > player.countCards("e") && get.attitude(player, current) < 0;
							}))
					) {
						return 1;
					}
				},
			},
		},
	},
	nzry_binglve: {
		audio: 2,
		trigger: { player: "nzry_feijunAfter" },
		forced: true,
		filter(event, player) {
			return event._nzry_binglve == true;
		},
		async content(event, trigger, player) {
			await player.draw(2);
		},
		ai: { combo: "nzry_feijun" },
	},
	nzry_huaiju_ai: {
		charlotte: true,
		ai: {
			filterDamage: true,
			skillTagFilter(player, tag, arg) {
				if (!player.hasMark("nzry_huaiju")) {
					return false;
				}
				if (
					!game.hasPlayer(function (current) {
						return current.hasSkill("tachibana_effect");
					})
				) {
					return false;
				}
				if (arg && arg.player) {
					if (arg.player.hasSkillTag("jueqing", false, player)) {
						return false;
					}
				}
			},
		},
	},
	nzry_huaiju: {
		marktext: "橘",
		intro: {
			name: "怀橘",
			name2: "橘",
			content: "当前有#个“橘”",
		},
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async content(event, trigger, player) {
			player.addMark("nzry_huaiju", 3);
			player.addSkill("nzry_huaiju_ai");
		},
		group: ["tachibana_effect"],
	},
	//没错 这是个橘
	tachibana_effect: {
		audio: "nzry_huaiju",
		sourceSkill: "nzry_huaiju",
		trigger: {
			global: ["damageBegin4", "phaseDrawBegin2"],
		},
		forced: true,
		filter(event, player) {
			return event.player.hasMark("nzry_huaiju") && (event.name == "damage" || !event.numFixed);
		},
		async content(event, trigger, player) {
			player.line(trigger.player, "green");
			if (trigger.name == "damage") {
				trigger.cancel();
				trigger.player.removeMark("nzry_huaiju", 1);
			} else {
				trigger.num++;
			}
		},
	},
};
