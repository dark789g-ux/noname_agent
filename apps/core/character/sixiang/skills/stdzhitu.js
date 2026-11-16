import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdzhitu" | "stdyizheng" | "stdrangjie" | "stdtaoluan" | "stdcansi" | "stdlingjian" | "stdmingshi" | "stdxianlu" | "stdtianshu">} */
export const groupSkills = {
	//标裴秀
	stdzhitu: {
		enable: "chooseToUse",
		filter(event, player) {
			if (player.countCards("he") < 2) {
				return false;
			}
			return get.inpileVCardList(info => {
				if (info[0] != "trick") {
					return false;
				}
				return event.filterCard(get.autoViewAs({ name: info[2] }, "unsure"), player, event);
			}).length;
		},
		hiddenCard(player, name) {
			if (get.type(name) == "trick" && lib.inpile.includes(name) && player.countCards("he") > 1) {
				return true;
			}
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(info => info[0] == "trick");
				return ui.create.dialog("制图", [list, "vcard"]);
			},
			filter(button, player) {
				return get.event().getParent().filterCard({ name: button.link[2] }, player, get.event().getParent());
			},
			check(button) {
				const player = get.player();
				return player.getUseValue({ name: button.link[2] }) + 1;
			},
			backup(links, player) {
				return {
					audio: "fjzhitu",
					filterCard(card, player) {
						const selected = ui.selected.cards;
						if (!selected.length) {
							return true;
						}
						return get.number(card, player) + selected.reduce((sum, card) => sum + get.number(card, get.player()), 0) <= 13;
					},
					selectCard: [2, Infinity],
					filterOk() {
						const selected = ui.selected.cards;
						if (!selected.length) {
							return false;
						}
						return selected.reduce((sum, card) => sum + get.number(card, get.player()), 0) == 13;
					},
					ai1(card) {
						const player = get.player();
						const name = lib.skill.stdzhitu_backup.viewAs.name;
						if (ui.selected.cards.length > 1 || card.name == name) {
							return 0;
						}
						const sum = ui.selected.cards.reduce((sumx, cardx) => sumx + get.number(cardx, player), 0);
						if (sum + get.number(card, player) == 13) {
							return 7 - get.value(card);
						}
						return 6 - get.value(card);
					},
					position: "hes",
					popname: true,
					viewAs: { name: links[0][2] },
				};
			},
			prompt(links, player) {
				return "将至少两张点数和等于13的牌当作" + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
	},
	//标杨彪
	stdyizheng: {
		audio: "yizheng",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target.hp >= player.hp && player.canCompare(target));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.hp >= player.hp && player.canCompare(target);
				})
				.set("ai", target => {
					const player = get.player(),
						hs = player.getCards("h").sort(function (a, b) {
							return b.number - a.number;
						}),
						ts = target.getCards("h").sort(function (a, b) {
							return b.number - a.number;
						}),
						eff = get.damageEffect(target, player, player);
					if (hs[0].number > ts[0].number) {
						return eff;
					}
					return 0;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (!player.canCompare(target)) {
				return;
			}
			const result = await player.chooseToCompare(target).forResult();
			if (result.winner) {
				const winner = result.winner,
					loser = winner == player ? target : player;
				winner.line(loser);
				await loser.damage(winner);
			}
		},
	},
	stdrangjie: {
		audio: "rangjie",
		trigger: {
			player: "damageEnd",
		},
		filter(event, player) {
			return player.canMoveCard() && event.num > 0;
		},
		check(event, player) {
			return player.canMoveCard(true);
		},
		async content(event, trigger, player) {
			player.moveCard(true);
		},
	},
	//标皇甫嵩
	stdtaoluan: {
		audio: "sptaoluan",
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("he") && event.player != player;
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseCard(get.prompt2(event.skill, trigger.player), "he")
				.set("ai", card => {
					const target = get.event().getTrigger().player,
						att = get.attitude(get.player(), target),
						shan = target.countCards("h", "shan");
					if (att < 0 && shan.length) {
						return (card.name == "shan" ? 8 : 6) - get.value(card);
					}
					return 0;
				})
				.forResult();
			if (result?.cards?.length) {
				event.result = {
					bool: true,
					cost_data: result.cards,
					targets: [trigger.player],
				};
			}
		},
		async content(event, trigger, player) {
			const cards = event.cost_data,
				target = trigger.player;
			await player.give(cards, target);
			await target.showHandcards();
			await target.modedDiscard(target.getCards("h", card => get.name(card, target) == "shan"));
		},
	},
	//标笮融
	stdcansi: {
		audio: "dccansi",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countCards("he") && game.hasPlayer(target => player.inRange(target)); //&&player.countGainableCards(target,"he")
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(`残肆：令攻击范围内的一名角色获得你一张牌，然后视为对其依次使用【杀】,【决斗】`, true, (card, player, target) => {
					return player.inRange(target);
				})
				.set("ai", target => {
					const cards = [get.autoViewAs({ name: "sha", isCard: true }), get.autoViewAs({ name: "juedou", isCard: true })];
					return cards.reduce((eff, card) => eff + get.effect(target, card, get.player(), get.player()), 0);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const { bool } = await target.gainPlayerCard(player, "he", true).forResult();
			if (!bool) {
				return;
			}
			await game.delayx();
			for (let name of ["sha", "juedou"]) {
				const card = get.autoViewAs({ name: name, isCard: true });
				if (player.canUse(card, target, false, false)) {
					await player.useCard(card, target, false);
				}
			}
		},
	},
	//标庞德公
	stdlingjian: {
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			return (
				player.getHistory("useCard", evt => evt.card?.name == "sha").indexOf(event) == 0 &&
				!player.hasHistory("sourceDamage", evt => evt.card && evt.getParent("useCard") === event) &&
				player.hasSkill("stdmingshi", null, false, false) &&
				player.awakenedSkills.includes("stdmingshi")
			);
		},
		forced: true,
		async content(event, trigger, player) {
			player.restoreSkill("stdmingshi");
			player.popup("明识");
			game.log(player, "恢复了技能", "#g【明识】");
		},
		ai: { combo: "stdmingshi" },
	},
	stdmingshi: {
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		chooseButton: {
			dialog(event, player) {
				const dialog = ui.create.dialog(`###明识###请选择一项`);
				dialog.add([
					[
						["draw", "摸两张牌"],
						["recover", "回复1点体力"],
						["damage", "对一名角色造成1点伤害"],
						["move", "移动场上的一张牌"],
					],
					"textbutton",
				]);
				return dialog;
			},
			filter(button) {
				const player = get.player();
				const { link } = button;
				if (link == "recover") {
					return player.isDamaged();
				}
				if (link == "move") {
					return player.canMoveCard();
				}
				return true;
			},
			check(button) {
				const player = get.player();
				const { link } = button;
				if (link == "recover") {
					return get.recoverEffect(player, player, player);
				}
				if (link == "draw") {
					return get.effect(player, { name: "wuzhong" }, player, player);
				}
				if (link == "damage") {
					return game
						.filterPlayer()
						.map(target => get.damageEffect(target, player, player))
						.sort((a, b) => b - a)[0];
				}
				if (button.link == "move") {
					return 2;
				}
				return 0;
			},
			backup(links, player) {
				return {
					link: links[0],
					delay: false,
					async content(event, trigger, player) {
						player.awakenSkill("stdmingshi");
						const { link } = get.info(event.name);
						switch (link) {
							case "draw":
								await player.draw(2);
								break;
							case "recover":
								if (player.isDamaged()) {
									await player.recover();
								}
								break;
							case "damage": {
								const result = await player
									.chooseTarget(`明识：对一名角色造成1点伤害`, true)
									.set("ai", target => {
										const player = get.player();
										return get.damageEffect(target, player, player);
									})
									.forResult();
								if (result?.targets?.length) {
									player.line(result.targets);
									await result.targets[0].damage();
								}
								break;
							}
							case "move":
								if (player.canMoveCard()) {
									await player.moveCard(true);
								}
								break;
						}
					},
				};
			},
		},
		ai: {
			order: 10,
			result: { player: 1 },
		},
		subSkill: { backup: {} },
	},
	//标南华老仙
	stdxianlu: {
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(target => target.countCards("e", { type: "equip" }));
		},
		filterTarget(card, player, target) {
			return target.countCards("e", { type: "equip" });
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (!target.countCards("e", { type: "equip" })) {
				return false;
			}
			const result = await player.discardPlayerCard(target, "e", true, card => get.type(card) == "equip").forResult();
			if (result?.cards) {
				const card = result.cards[0];
				if (get.color(card, false) == "red") {
					if (player.canAddJudge("lebu")) {
						await player.addJudge("lebu", [card]);
					}
					await target.damage();
				}
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target, card) {
					return -1 / target.countCards("e");
				},
			},
		},
	},
	stdtianshu: {
		mod: {
			maxHandcard(player, num) {
				return num + game.countGroup() - 1;
			},
		},
	},
};
