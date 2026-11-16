import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twsbganglie" | "twsbqingjian" | "twwushen" | "twwuhun">} */
export const groupSkills = {
	//tw谋夏侯惇
	twsbganglie: {
		audio: "sbganglie",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (!event.twsbganglie_enabledTargets) {
				return false;
			}
			return game.hasPlayer(current => {
				return lib.skill.twsbganglie.filterTarget(null, player, current);
			});
		},
		onChooseToUse(event) {
			if (game.online || event.type !== "phase") {
				return;
			}
			const player = event.player;
			const chosen = player
				.getAllHistory("useSkill", evt => evt.skill === "twsbganglie")
				.reduce((list, evt) => {
					if (evt.targets) {
						return list.addArray(evt.targets);
					}
				}, []);
			let targets = player
				.getAllHistory("damage", evt => evt.source && evt.source.isIn())
				.map(evt => evt.source)
				.unique();
			targets.removeArray(chosen);
			event.set("twsbganglie_enabledTargets", targets);
		},
		filterTarget(card, player, target) {
			return get.event().twsbganglie_enabledTargets.includes(target);
		},
		selectTarget: [1, Infinity],
		async content(event, trigger, player) {
			await event.target.damage(2);
		},
		ai: {
			order: 6,
			result: {
				target: -2,
			},
		},
	},
	twsbqingjian: {
		audio: "sbqingjian",
		trigger: {
			global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter", "equipAfter"],
		},
		forced: true,
		locked: false,
		filter(event, player) {
			if (player.getExpansions("twsbqingjian").length >= Math.max(1, player.getHp() + 1)) {
				return false;
			}
			if (event.name !== "cardsDiscard") {
				if (event.position !== ui.discardPile) {
					return false;
				}
				if (
					!game.hasPlayer(current => {
						const evt = event.getl(current);
						return evt.cards?.someInD("od");
					})
				) {
					return false;
				}
			} else {
				const evt = event.getParent();
				if (evt.relatedEvent && evt.relatedEvent.name === "useCard") {
					return false;
				}
			}
			return true;
		},
		group: "twsbqingjian_give",
		async content(event, trigger, player) {
			let cards = trigger.cards.filterInD("od").slice();
			const maxNum = Math.max(1, player.getHp() + 1);
			const myLen = player.getExpansions("twsbqingjian").length,
				cardsLen = trigger.cards.length;
			const num = Math.min(cardsLen, maxNum - myLen);
			if (num > 0) {
				cards = cards.randomGets(num);
			}
			const next = player.addToExpansion(cards, "gain2");
			next.gaintag.add("twsbqingjian");
			await next;
		},
		marktext: "俭",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		subSkill: {
			give: {
				audio: "sbqingjian",
				trigger: { player: "phaseUseEnd" },
				filter(event, player) {
					return player.getExpansions("twsbqingjian").length > 0;
				},
				async cost(event, trigger, player) {
					if (_status.connectMode) {
						game.broadcastAll(() => {
							_status.noclearcountdown = true;
						});
					}
					const given_map = {},
						targets = [],
						expansions = player.getExpansions("twsbqingjian");
					do {
						const result =
							expansions.length > 1
								? await player
										.chooseButtonTarget({
											createDialog: [`清俭：请选择要分配的牌`, expansions],
											selectButton: [1, Infinity],
											filterTarget: true,
											ai1(button) {
												return get.value(button.link);
											},
											canHidden: true,
											complexSelect: true,
											ai2(target) {
												const att = get.attitude(get.player(), target);
												if (get.value(ui.selected.buttons[0]?.link, player, "raw") < 0) {
													return Math.max(0.01, 100 - att);
												} else if (att > 0) {
													return Math.max(0.1, att / Math.sqrt(2 + target.countCards("h")));
												} else {
													return Math.max(0.01, (100 + att) / 200);
												}
											},
										})
										.forResult()
								: await player
										.chooseTarget(`清俭：是否令一名角色获得${get.translation(expansions)}？`)
										.set("ai", target => {
											const att = get.attitude(_status.event.player, target);
											if (_status.event.enemy) {
												return -att;
											} else if (att > 0) {
												return att / (1 + target.countCards("h"));
											} else {
												return att / 100;
											}
										})
										.set("enemy", get.value(expansions[0], player, "raw") < 0)
										.forResult();
						if (result?.bool) {
							if (!result.links?.length) {
								result.links = expansions.slice(0);
							}
							expansions.removeArray(result.links);
							let id = result.targets[0]?.playerid;
							if (!given_map[id]) {
								given_map[id] = [];
							}
							given_map[id].addArray(result.links);
							targets.addArray(result.targets);
						} else {
							break;
						}
					} while (expansions.length > 0);
					if (_status.connectMode) {
						game.broadcastAll(() => {
							delete _status.noclearcountdown;
							game.stopCountChoose();
						});
					}
					event.result = {
						bool: targets.length,
						targets: targets?.sortBySeat(),
						cost_data: given_map,
					};
				},
				async content(event, trigger, player) {
					const gain_list = [],
						given_map = event.cost_data;
					for (const i in given_map) {
						const source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
						gain_list.push([source, given_map[i]]);
						game.log(source, "获得了", given_map[i]);
					}
					await game
						.loseAsync({
							gain_list,
							giver: player,
							animate: "gain2",
						})
						.setContent("gaincardMultiple");
				},
			},
		},
	},
	//tw神关羽
	twwushen: {
		mod: {
			cardname(card, player, name) {
				if (get.suit(card) == "heart") {
					return "sha";
				}
			},
			cardnature(card, player) {
				if (get.suit(card) == "heart") {
					return false;
				}
			},
			targetInRange(card) {
				if (card.name === "sha") {
					const suit = get.suit(card);
					if (suit === "heart" || suit === "unsure") {
						return true;
					}
				}
			},
			cardUsable(card) {
				if (card.name === "sha") {
					const suit = get.suit(card);
					if (suit === "heart" || suit === "unsure") {
						return Infinity;
					}
				}
			},
		},
		audio: "wushen",
		trigger: { player: "useCard2" },
		forced: true,
		filter(event, player) {
			return event.card.name == "sha" && (get.suit(event.card) == "heart" || !player.hasSkill("twwushen_phase", null, null, false));
		},
		logTarget(event, player) {
			if (get.suit(event.card) == "heart") {
				var targets = game.filterPlayer(function (current) {
					return !event.targets.includes(current) && current.hasMark("twwuhun") && lib.filter.targetEnabled(event.card, player, current);
				});
				if (targets.length) {
					return targets.sortBySeat();
				}
			}
			return null;
		},
		async content(event, trigger, player) {
			if (!player.hasSkill("twwushen_phase", null, null, false)) {
				trigger.directHit.addArray(game.players);
				player.addTempSkill("twwushen_phase", [
					"phaseZhunbeiAfter",
					"phaseJudgeAfter",
					"phaseDrawAfter",
					"phaseUseAfter",
					"phaseDiscardAfter",
					"phaseJieshuAfter",
				]);
			}
			if (get.suit(trigger.card) == "heart") {
				if (trigger.addCount !== false) {
					trigger.addCount = false;
					if (player.stat[player.stat.length - 1].card.sha > 0) {
						player.stat[player.stat.length - 1].card.sha--;
					}
				}
				const targets = game.filterPlayer(current => {
					return (
						!trigger.targets.includes(current) &&
						current.hasMark("twwuhun") &&
						(lib.filter.targetEnabled(trigger.card, player, current) ?? false)
					);
				});
				if (targets.length) {
					trigger.targets.addArray(targets.sortBySeat());
					game.log(targets, "也成为了", trigger.card, "的目标");
				}
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return arg.card.name == "sha" && !player.hasSkill("twwushen_phase", null, null, false);
			},
		},
		subSkill: { phase: { charlotte: true } },
	},
	twwuhun: {
		audio: "wuhun",
		trigger: { player: "die" },
		forceDie: true,
		skillAnimation: true,
		animationColor: "soil",
		locked: true,
		check(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && current.hasMark("twwuhun") && get.attitude(player, current) < 0;
			});
		},
		async content(event, trigger, player) {
			const judge = player.judge(card => {
				const name = get.name(card, false);
				return name === " tao" || name === "taoyuan" ? -25 : 15;
			});
			judge.set("forceDie", true);
			judge.set("judge2", result => result.bool);

			const judgeResult = await judge.forResult();
			if (!judgeResult?.bool) {
				return;
			}

			const num = game.countPlayer(current => current !== player && current.hasMark("twwuhun"));
			if (num === 0) {
				return;
			}

			const prompt = "请选择【武魂】的目标";
			const prompt2 = "选择至少一名拥有“梦魇”标记的角色。令这些角色各自失去X点体力（X为其“梦魇”标记数）";
			const next = player.chooseTarget(prompt, prompt2, [1, num], true);
			next.set("filterTarget", (card, _player, target) => target !== player && target.hasMark("twwuhun"));
			next.set("forceDie", true);
			next.set("ai", target => -get.attitude(get.player(), target));

			const result = await next.forResult();
			if (!result.targets?.length) {
				return;
			}

			const targets = result.targets.sortBySeat();
			player.line(targets);

			for (const target of targets) {
				const num = target.countMark("twwuhun");
				if (num > 0) {
					await target.loseHp(num);
				}
			}
		},
		marktext: "魇",
		intro: {
			name: "梦魇",
			content: "mark",
			onunmark: true,
		},
		group: "twwuhun_gain",
		subSkill: {
			gain: {
				audio: "wuhun",
				trigger: {
					player: "damageEnd",
					source: "damageSource",
				},
				forced: true,
				filter(event, player, name) {
					if (event.player == event.source) {
						return false;
					}
					var target = lib.skill.twwuhun_gain.logTarget(event, player);
					if (!target || !target.isIn()) {
						return false;
					}
					return name == "damageEnd" || target.hasMark("twwuhun");
				},
				logTarget(event, player) {
					if (player == event.player) {
						return event.source;
					}
					return event.player;
				},
				async content(event, trigger, player) {
					const target = lib.skill.twwuhun_gain.logTarget(trigger, player);
					target.addMark("twwuhun", player == trigger.source ? 1 : trigger.num);
					await game.delayx();
				},
			},
		},
		ai: {
			notemp: true,
			maixie_defend: true,
			effect: {
				target: (card, player, target) => {
					if (!get.tag(card, "damage") || !target.hasFriend()) {
						return;
					}
					let die = [],
						extra = [null, 0],
						temp;
					game.filterPlayer(i => {
						if (!i.hasMark("twwuhun")) {
							return false;
						}
						temp = get.attitude(target, i);
						if (temp < 0) {
							die.push(i);
						} else {
							temp = Math.sqrt(temp) * i.countMark("twwuhun");
							if (!extra[0] || temp < extra[1]) {
								extra = [i, temp];
							}
						}
					});
					if (extra[0] && !die.length) {
						die.push(extra[0]);
					}
					if (target.hp + target.hujia > 1 && (!die.length || get.attitude(player, target) <= 0)) {
						die.add(player);
					}
					if (die.length) {
						return [
							1,
							0,
							1,
							die.reduce((num, i) => {
								return (num -= 2 * get.sgnAttitude(player, i));
							}, 0),
						];
					}
				},
			},
		},
	},
};
