import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "youdi" | "fuhun" | "wusheng_guanzhang" | "paoxiao_guanzhang" | "fencheng" | "mieji" | "junxing" | "juece" | "jiefan">} */
export const groupSkills = {
	youdi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("youdi"),
					filterTarget: lib.filter.notMe,
					ai(target) {
						if (!_status.event.goon) {
							return 0;
						}
						if (target.countCards("he") == 0) {
							return 0;
						}
						return -get.attitude(_status.event.player, target);
					},
				})
				.set("goon", player.countCards("h", "sha") <= player.countCards("h") / 3)
				.forResult();
		},
		async content(event, trigger, player) {
			await game.delay();
			const target = event.targets[0];

			const result = await target
				.discardPlayerCard({
					target: player,
					position: "he",
					forced: true,
				})
				.forResult();
			if (result.links?.length && result.links[0].name != "sha" && target.countGainableCards(player, "he")) {
				await player.gainPlayerCard({
					target,
					position: "he",
					forced: true,
				});
			}
		},
		ai: {
			expose: 0.2,
		},
	},
	fuhun: {
		enable: ["chooseToUse", "chooseToRespond"],
		filterCard: true,
		selectCard: 2,
		position: "hs",
		audio: 2,
		audioname: ["re_guanzhang"],
		derivation: ["new_rewusheng", "olpaoxiao"],
		viewAs: { name: "sha" },
		prompt: "将两张手牌当杀使用或打出",
		viewAsFilter(player) {
			return player.countCards("hs") > 1;
		},
		check(card) {
			if (_status.event.player.hasSkill("new_rewusheng") && get.color(card) == "red") {
				return 0;
			}
			if (_status.event.name == "chooseToRespond") {
				if (card.name == "sha") {
					return 0;
				}
				return 6 - get.useful(card);
			}
			if (_status.event.player.countCards("hs") < 4) {
				return 6 - get.useful(card);
			}
			return 7 - get.useful(card);
		},
		ai: {
			respondSha: true,
			skillTagFilter(player) {
				if (player.countCards("hs") < 2) {
					return false;
				}
			},
			order(item, player) {
				if (player.hasSkill("new_rewusheng") && player.hasSkill("olpaoxiao")) {
					return 1;
				}
				if (player.countCards("hs") < 4) {
					return 1;
				}
				return 4;
			},
		},
		group: "fuhun_effect",
		subSkill: {
			effect: {
				audio: "fuhun",
				audioname: ["re_guanzhang"],
				trigger: { source: "damageSource" },
				forced: true,
				sourceSkill: "fuhun",
				filter(event, player) {
					if (["new_rewusheng", "olpaoxiao"].every(skill => player.hasSkill(skill, null, false, false))) {
						return false;
					}
					return event.getParent().skill == "fuhun";
				},
				async content(event, trigger, player) {
					await player.addTempSkills(["new_rewusheng", "olpaoxiao"]);
				},
			},
		},
	},
	wusheng_guanzhang: { audio: 2 },
	paoxiao_guanzhang: { audio: 2 },
	fencheng: {
		skillAnimation: "epic",
		animationColor: "gray",
		audio: "xinfencheng",
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return player != target;
		},
		limited: true,
		selectTarget: -1,
		line: "fire",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const { target } = event;
			const res = get.damageEffect(target, player, target, "fire");
			const num = Math.max(1, target.countCards("e"));
			const result = await target
				.chooseToDiscard({
					prompt: "弃置" + get.cnNumber(num) + "张牌或受到1点火焰伤害",
					selectCard: num,
					position: "he",
					allowChooseAll: true,
					ai(card) {
						const res = _status.event.res;
						const num = _status.event.num;
						const player = _status.event.player;
						if (res >= 0) {
							return -1;
						}
						if (num > 2 && player.hp > 1) {
							return -1;
						}
						if (num > 1 && player.hp > 2) {
							return -1;
						}
						if (get.position(card) == "e") {
							return 10 - get.value(card);
						}
						return 6 - get.value(card);
					},
				})
				.set("res", res)
				.set("num", num)
				.forResult();
			if (!result?.bool) {
				await target.damage({ nature: "fire" });
			}
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					var num = 0,
						players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (player != players[i] && get.damageEffect(players[i], player, players[i], "fire") < 0) {
							var att = get.attitude(player, players[i]);
							if (att > 0) {
								num -= Math.max(1, players[i].countCards("e"));
							} else if (att < 0) {
								num += Math.max(1, players[i].countCards("e"));
							}
						}
					}
					if (players.length < 5) {
						return num - 1;
					} else {
						return num - 2;
					}
				},
			},
		},
	},
	mieji: {
		trigger: { player: "useCard2" },
		audio: 2,
		filter(event, player) {
			if (get.type(event.card) != "trick" || get.color(event.card) != "black") {
				return false;
			}
			if (!event.targets || event.targets.length != 1) {
				return false;
			}
			var info = get.info(event.card);
			if (info.allowMultiple == false) {
				return false;
			}
			if (event.targets && !info.multitarget) {
				if (
					game.hasPlayer(function (current) {
						return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current) && lib.filter.targetInRange(event.card, player, current);
					})
				) {
					return true;
				}
			}
			return false;
		},
		position: "he",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("mieji"),
					prompt2: "为" + get.translation(trigger.card) + "增加一个额外目标",
					filterTarget(_card, _player, target) {
						const { player, card, targets } = get.event();
						if (targets.includes(target)) {
							return false;
						}
						return lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
					},
					ai(target) {
						const event = get.event();
						const trigger = event.getTrigger();
						const player = event.player;
						return get.effect(target, trigger.card, player, player);
					},
				})
				.set("autodelay", true)
				.set("targets", trigger.targets)
				.set("card", trigger.card)
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			trigger.targets.push(event.targets[0]);
		},
	},
	junxing: {
		enable: "phaseUse",
		audio: 2,
		usable: 1,
		filterCard: true,
		selectCard: [1, Infinity],
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		check(card) {
			if (ui.selected.cards.length) {
				return -1;
			}
			var val = get.value(card);
			if (get.type(card) == "basic") {
				return 8 - get.value(card);
			}
			return 5 - get.value(card);
		},
		filterTarget(card, player, target) {
			return player != target;
		},
		allowChooseAll: true,
		async content(event, trigger, player) {
			const { cards, target } = event;
			const types = new Set(cards.map(card => get.type2(card, player)));
			const result = await target
				.chooseToDiscard({
					filterCard(card) {
						return !_status.event.types.has(get.type2(card));
					},
					ai(card) {
						if (_status.event.player.isTurnedOver()) {
							return -1;
						}
						return 8 - get.value(card);
					},
				})
				.set("types", types)
				.set("dialog", ["弃置一张与" + get.translation(player) + "弃置的牌类别均不同的牌，或将武将牌翻面", "hidden", cards])
				.forResult();
			if (!result.bool) {
				await target.turnOver();
				await target.draw(cards.length);
			}
		},
		ai: {
			order: 2,
			expose: 0.3,
			threaten: 1.8,
			result: {
				target(player, target) {
					if (target.hasSkillTag("noturn")) {
						return 0;
					}
					if (target.isTurnedOver()) {
						return 2;
					}
					return -1 / (target.countCards("h") + 1);
				},
			},
		},
	},
	juece: {
		audio: 2,
		audioname: ["dc_liru", "ol_liru"],
		trigger: {
			global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		getIndex(event, player) {
			if (_status.currentPhase !== player) {
				return [];
			}
			return game.filterPlayer(current => {
				if (current === player || current.countCards("h") > 0) {
					return false;
				}
				const evt = event.getl(current);
				return evt?.hs?.length > 0;
			});
		},
		filter(event, player, _name, target) {
			return _status.currentPhase === player;
		},
		check(event, player) {
			return get.damageEffect(event.player, player, player) > 0;
		},
		async cost(event, trigger, player) {
			/** @type {Player} */
			const target = event.indexedData;

			const result = await player
				.chooseBool({
					prompt: get.prompt2("juece", target),
					ai() {
						const { player, target } = get.event();
						return get.damageEffect(target, player, player) >= 0;
					},
				})
				.set("target", target)
				.forResult();

			event.result = {
				bool: result.bool,
				targets: [target],
			};
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.damage();
		},
		ai: {
			threaten: 1.1,
		},
	},
	jiefan: {
		skillAnimation: true,
		animationColor: "wood",
		audio: 2,
		audioname: ["re_handang"],
		limited: true,
		enable: "phaseUse",
		filterTarget: true,
		async content(event, trigger, player) {
			const { target } = event;
			player.awakenSkill(event.name);
			const players = game.filterPlayer(current => current !== target && current.inRange(target));
			players.sortBySeat(target);
			for (const current of players) {
				current.addTempClass("target");
				player.line(current, "green");
				let shouldDraw = true;
				if (current.countCards("he") && target.isIn()) {
					const result = await current
						.chooseToDiscard({
							prompt: "弃置一张武器牌或让" + get.translation(target) + "摸一张牌",
							filterCard: get.filter({ subtype: "equip1" }),
							position: "he",
							ai(card) {
								if (get.attitude(_status.event.player, _status.event.target) < 0) {
									return 7 - get.value(card);
								}
								return -1;
							},
						})
						.set("target", target)
						.forResult();
					shouldDraw = !result.bool;
				}
				if (shouldDraw) {
					await target.draw();
				}
			}
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					if (player.hp > 2) {
						if (game.phaseNumber < game.players.length * 2) {
							return 0;
						}
					}
					var num = 0,
						players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i] != target && players[i].inRange(target)) {
							num++;
						}
					}
					return num;
				},
			},
		},
	},
};
