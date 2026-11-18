import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdshuangrui" | "stdzengou" | "stdfeili" | "stdfuqi" | "stdjiaozi" | "stdkengqiang" | "stdshangjue" | "stdyingmen" | "stdpingjian">} */
export const groupSkills = {
	//四象封印·朱雀
	//黄舞蝶
	stdshuangrui: {
		audio: "dcshuangrui",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			await player
				.chooseToUse()
				.set("openskilldialog", `###${get.prompt(event.name)}###将任意张手牌当作【杀】使用`)
				.set("norestore", true)
				.set("_backupevent", `${event.name}_backup`)
				.set("custom", {
					add: {},
					replace: { window() {} },
				})
				.backup(`${event.name}_backup`)
				.set("targetRequired", true)
				.set("complexTarget", true)
				.set("complexSelect", true)
				.set("addCount", false)
				.set("logSkill", event.name);
		},
		/*ai: {
			effect: {
				player_use(card, player, target) {
					const hs = player.countCards("h"),
						evt = _status.event,
						selected = ui.selected.cards;
					if (evt.name == "chooseToUse" && evt.player == player && evt.skill == "stdshuangrui_backup") {
						if (hs.length - selected.length == target.countCards("h")) {
							return [1, 0.3];
						}
					}
				},
			},
		},*/
		subSkill: {
			backup: {
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				viewAs: {
					name: "sha",
				},
				selectCard: [1, Infinity],
				position: "h",
				precontent(event, trigger, player) {
					player
						.when("useCard")
						.filter(evt => evt.getParent() == event.getParent())
						.step(async (event, trigger, player) => {
							const num = player.countCards("h");
							if (trigger.targets?.some(target => target.countCards("h") === num)) {
								trigger.directHit.addArray(game.players);
								game.log(trigger.card, "不可被响应");
							}
						});
				},
				ai1(card) {
					if (ui.selected.cards.length) {
						return 0;
					}
					return 5 - get.value(card);
				},
			},
		},
	},
	//清河公主
	stdzengou: {
		audio: "mbzengou",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(target => target.countCards("h"));
		},
		filterTarget(card, player, target) {
			return target.countCards("h");
		},
		async content(event, trigger, player) {
			const { target } = event;
			const cards = target.getCards("h");
			if (!cards.length) {
				delete player.getStat()["stdzengou"];
				return;
			}
			let result;
			if (cards.length <= 2) {
				await player.viewHandcards(target);
				result = { bool: true, links: cards };
			} else {
				result = await player
					.chooseCardButton(`谮构：请选择要展示的两张牌`, 2, true, cards)
					.set("ai", button => {
						if (get.type(button.link) == "basic" && !["shan", "du"].includes(get.name(button.link))) {
							return 0;
						}
						return get.value(button.link);
					})
					.forResult();
				cards.forEach(card => card.addKnower(player));
			}
			if (result?.links?.length) {
				const shown = result.links;
				await player.showCards(shown, `${get.translation(player)}展示了${get.translation(target)}的牌`);
				const names = shown.map(card => get.name(card, target));
				const viewAs = info => get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
				const list = get.inpileVCardList(info => {
					if (info[0] == "basic" && !names.includes(info[2])) {
						return player.hasUseTarget(viewAs(info), false, false);
					}
				});
				if (!list.length) {
					player.popup("杯具");
					await target.draw();
					return;
				}
				const result2 = await player
					.chooseButton([`谮构：请选择要视为使用的基本牌`, [list, "vcard"]], true)
					.set("viewAs", viewAs)
					.set("ai", button => get.player().getUseValue(get.event().viewAs(button.link)))
					.forResult();
				if (result2.links?.length) {
					await player.chooseUseTarget(viewAs(result2.links[0]), true);
				}
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					return -target.countCards("h");
				},
			},
		},
	},
	stdfeili: {
		audio: "mbfeili",
		trigger: { player: "damageBegin4" },
		filter(event, player) {
			return player.countDiscardableCards(player, "he") > 1 || (player.hasSkill("stdzengou") && !player.isTempBanned("stdzengou"));
		},
		async cost(event, trigger, player) {
			const list = [`弃置两张牌`, `令〖谮构〗本轮失效`];
			const bool1 = player.countDiscardableCards(player, "he") > 1;
			const bool2 = player.hasSkill("stdzengou") && !player.isTempBanned("stdzengou");
			const ai1 = player.countDiscardableCards(player, "he", card => 7 - get.value(card)) > 1;
			const ai2 = (() => {
				if (trigger.num >= player.getHp() + player.hujia) {
					return true;
				}
				const curLen = player.actionHistory.length;
				for (let i = curLen - 1; i >= 0; i--) {
					const history = player.actionHistory[i];
					if (history.isMe && !history.isSkipped) {
						return true;
					}
					if (history.isRound) {
						break;
					}
				}
				return false;
			})();
			if (bool1 && bool2) {
				const result = await player
					.chooseControl("cancel2")
					.set("choiceList", list)
					.set("prompt", get.prompt2(event.skill))
					.set("choice", ai2 ? 1 : ai1 ? 0 : 2)
					.forResult();
				if (result?.control !== "cancel2") {
					event.result = { bool: true, cost_data: result.index };
				}
			} else if (bool1) {
				const result = await player.chooseBool(get.prompt(event.skill), `${list[0]}，防止此次伤害`).set("choice", ai1).forResult();
				if (result?.bool) {
					event.result = { bool: true, cost_data: 0 };
				}
			} else if (bool2) {
				const result = await player.chooseBool(get.prompt(event.skill), `${list[1]}，防止此次伤害`).set("choice", ai2).forResult();
				if (result?.bool) {
					event.result = { bool: true, cost_data: 1 };
				}
			}
		},
		async content(event, trigger, player) {
			const index = event.cost_data;
			if (index == 0) {
				await player.chooseToDiscard("he", 2, true);
			} else {
				player.tempBanSkill("stdzengou", "roundStart");
			}
			trigger.cancel();
		},
	},
	//麴义
	stdfuqi: {
		audio: "fuqi",
		global: "stdfuqi_ai",
		subSkill: {
			ai: {
				directHit_ai: true,
				skillTagFilter(player, tag, arg) {
					if (arg.card?.name == "sha") {
						if (player.hasSkill("stdfuqi")) {
							return get.distance(arg.target, player) == 1;
						}
						if (arg.target.hasSkill("stdfuqi")) {
							return get.distance(player, arg.target) == 1;
						}
					}
				},
			},
		},
		forced: true,
		trigger: {
			global: "useCard",
		},
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			if (event.player == player) {
				return event.targets.some(target => get.distance(target, player) == 1);
			}
			return event.targets.includes(player) && get.distance(event.player, player) == 1;
		},
		async content(event, trigger, player) {
			trigger.directHit.addArray(game.players);
			game.log(trigger.card, "不可被响应");
		},
	},
	stdjiaozi: {
		audio: "jiaozi",
		forced: true,
		trigger: { source: "damageBegin1" },
		filter(event, player) {
			return (
				player.isMaxHandcard() && game.getGlobalHistory("everything", evt => evt.name == "damage" && evt.source == player).indexOf(event) == 0
			);
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
	},
	//文鸳
	stdkengqiang: {
		audio: "dckengqiang",
		usable: 1,
		trigger: { player: "useCard" },
		filter(event, player) {
			return get.is.damageCard(event.card);
		},
		async cost(event, trigger, player) {
			const list = [`摸两张牌`, `失去一点体力，令${get.translation(trigger.card)}伤害+1`];
			const eff1 = get.effect(player, { name: "wuzhong" }, player, player);
			const eff2 =
				get.effect(player, { name: "losehp" }, player, player) +
				Math.max(trigger.targets.map(target => get.damageEffect(target, player, player)));
			const result = await player
				.chooseControl("cancel2")
				.set("choiceList", list)
				.set("prompt", get.prompt2(event.skill))
				.set("choice", eff1 >= eff2 ? 0 : 1)
				.forResult();
			if (result?.control != "cancel2") {
				event.result = { bool: true, cost_data: result.index };
			}
		},
		async content(event, trigger, player) {
			const index = event.cost_data;
			if (index == 0) {
				await player.draw(2);
			} else if (index == 1) {
				await player.loseHp();
				game.log(trigger.card, "造成的伤害+1");
				trigger.baseDamage++;
			}
		},
	},
	stdshangjue: {
		audio: "dcshangjue",
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		trigger: { player: "dying" },
		check: () => true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recoverTo(player.maxHp);
			if (player.hasSkill("stdkengqiang", null, null, false)) {
				const result = await player.chooseBool(`殇决：是否失去〖铿锵〗重置此技能`).set("choice", false).forResult();
				if (result?.bool) {
					await player.removeSkills("stdkengqiang");
					player.restoreSkill(event.name);
				}
			}
		},
	},
	//许劭
	stdyingmen: {
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return !player.countExpansions("stdyingmen");
		},
		async content(event, trigger, player) {
			await player.draw(2);
			const result = await player
				.chooseCard(`盈门：将两张基本牌或普通锦囊牌置于武将牌上，称为“访客”`, "he", true, 2, card =>
					["basic", "trick"].includes(get.type(card))
				)
				.set("ai", card => get.player().getUseValue(card))
				.forResult();
			if (result?.cards?.length) {
				const { cards } = result;
				const next = player.addToExpansion(cards, "give");
				next.gaintag.add(event.name);
				await next;
			}
		},
		intro: {
			markcount: "expansion",
			content: "expansion",
		},
		ai: {
			order: 9,
			result: {
				player: 1,
			},
		},
	},
	stdpingjian: {
		enable: ["chooseToUse"],
		hiddenCard(player, name) {
			return player.getExpansions("stdyingmen").some(card => get.name(card) == name);
		},
		filter(event, player) {
			return player
				.getExpansions("stdyingmen")
				.some(card => event.filterCard(get.autoViewAs({ name: get.name(card), nature: get.nature(card) }, "unsure"), player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const cards = player.getExpansions("stdyingmen");
				const list = get.inpileVCardList(info => {
					return cards.some(card => get.name(card) == info[2] && get.nature(card) == info[3]);
				});
				return ui.create.dialog("评鉴", [list, "vcard"], "hidden");
			},
			filter(button) {
				const evt = get.event().getParent();
				const link = button.link;
				return evt.filterCard(get.autoViewAs({ name: link[2], nature: link[3] }, "unsure"), get.player(), evt);
			},
			check(button) {
				const link = button.link;
				return get.player().getUseValue(get.autoViewAs({ name: link[2], nature: link[3] }, "unsure"));
			},
			backup(links, player) {
				return {
					filterCard(card, player) {
						return get.itemtype(card) == "card";
					},
					position: "h",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					log: false,
					async precontent(event, trigger, player) {
						player.logSkill("stdpingjian");
						const result = await player
							.chooseCardButton(`评鉴：请移去一张“访客”`, true, player.getExpansions("stdyingmen"))
							.set("ai", button => -get.player().getUseValue(button.link))
							.forResult();
						if (result?.links?.length) {
							await player.loseToDiscardpile(result.links);
						}
					},
					ai1(card) {
						return 7 - get.value(card);
					},
				};
			},
			prompt(links, player) {
				return `将一张手牌当做${(get.translation(links[0][3]) || "") + get.translation(links[0][2])}使用`;
			},
		},
		ai: {
			order: 7,
			combo: "stdyingmen",
			result: {
				player: 1,
			},
		},
	},
};
