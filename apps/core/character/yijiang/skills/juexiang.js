import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "juexiang" | "bizhuan" | "tongbo">} */
export const groupSkills = {
	juexiang: {
		audio: 2,
		trigger: { player: "die" },
		forceDie: true,
		skillAnimation: true,
		animationColor: "thunder",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("juexiang"),
					filterTarget: lib.filter.notMe,
					ai(target) {
						const player = get.player();
						return get.attitude(player, target) / Math.sqrt(target.hp + 1);
					},
				})
				.set("forceDie", true)
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			target.addSkills(lib.skill.juexiang.derivation.randomGet());
			target.addTempSkill("juexiang_club", { player: "phaseZhunbeiBegin" });
		},
		derivation: ["juexiang_ji", "juexiang_lie", "juexiang_rou", "juexiang_he"],
		subSkill: {
			ji: {
				audio: 1,
				mark: true,
				nopop: true,
				intro: {
					content: "info",
				},
				trigger: { player: "damageEnd" },
				filter(event, player) {
					return event.source && event.source.isIn() && event.source != player && !_status.dying.length;
				},
				check(event, player) {
					return get.attitude(player, event.source) < 0;
				},
				logTarget: "source",
				async content(event, trigger, player) {
					await trigger.source.loseHp();
					const card = get.cardPile(card => get.type(card) == "equip" && trigger.source.canUse(card, trigger.source), false, "random");
					if (card) {
						await trigger.source.chooseUseTarget({
							card,
							throw: false,
							nopopup: true,
							forced: true,
						});
					}
				},
				ai: {
					maixie_defend: true,
				},
			},
			lie: {
				audio: 1,
				mark: true,
				nopop: true,
				intro: {
					content: "info",
				},
				trigger: {
					player: "recoverEnd",
					global: "dyingAfter",
				},
				getIndex(event, player, triggername) {
					if (_status.dying.length) {
						if (triggername == "recoverEnd") {
							player.storage.juexiang_lie ??= 0;
							++player.storage.juexiang_lie;
						}
						return 0;
					}

					return triggername === "dyingAfter" ? player.storage.juexiang_lie : 1;
				},
				filter(event, player) {
					return !_status.dying.length;
				},
				async cost(event, trigger, player) {
					if (event.triggername == "dyingAfter") {
						if (!player.countMark("juexiang_lie")) {
							return;
						}
						player.storage.juexiang_lie--;
					}
					event.result = await player
						.chooseTarget({
							prompt: get.prompt2("juexiang_lie"),
							filterTarget: lib.filter.notMe,
							ai(target) {
								return -get.attitude(player, target) / (1 + target.hp);
							},
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					await target.loseHp();
					const card = get.cardPile(card => get.type(card) == "equip" && target.canUse(card, target), false, "random");
					if (card) {
						await target.chooseUseTarget({
							card,
							throw: false,
							nopopup: true,
							forced: true,
						});
					}
				},
			},
			rou: {
				audio: 1,
				mark: true,
				nopop: true,
				intro: {
					content: "info",
				},
				trigger: { player: "damageEnd" },
				filter(event, player) {
					return event.source && event.source.isIn() && event.source != player && !_status.dying.length;
				},
				check(event, player) {
					var att = get.attitude(player, event.source);
					if (player.isHealthy()) {
						return att < 0;
					} else {
						return att > 0;
					}
				},
				logTarget: "source",
				async content(event, trigger, player) {
					await trigger.source.recover();
					if (trigger.source.countCards("he", { type: "equip" })) {
						await trigger.source.chooseToDiscard({
							prompt: "弃置一张装备牌",
							filterCard(card) {
								return get.type(card) === "equip";
							},
							position: "he",
							forced: true,
						});
					}
				},
				ai: {
					maixie_defend: true,
				},
			},
			he: {
				audio: 1,
				mark: true,
				nopop: true,
				intro: {
					content: "info",
				},
				trigger: { player: "recoverEnd" },
				filter(event, player) {
					return !_status.dying.length;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget({
							prompt: get.prompt2("juexiang_he"),
							filterTarget: lib.filter.notMe,
							ai(target) {
								const att = get.attitude(get.event().player, target);
								if (target.isHealthy() && target.countCards("he")) {
									return -att;
								}
								return (10 * att) / (1 + target.hp);
							},
						})
						.forResult();
				},
				logTarget: "targets",
				async content(event, trigger, player) {
					const target = event.targets[0];
					await target.recover();
					if (target.countCards("he", { type: "equip" })) {
						await target.chooseToDiscard({
							prompt: "弃置一张装备牌",
							filterCard(card) {
								return get.type(card) === "equip";
							},
							position: "he",
							forced: true,
						});
					}
				},
			},
			club: {
				mark: true,
				nopop: true,
				intro: {
					content: "info",
				},
				mod: {
					targetEnabled(card, player, target) {
						if (get.suit(card) == "club" && player != target) {
							return false;
						}
					},
				},
			},
		},
	},
	bizhuan: {
		audio: 2,
		trigger: {
			player: "useCard",
			target: "useCardToTargeted",
		},
		filter(event, player) {
			if (event.name != "useCard" && event.player == event.target) {
				return false;
			}
			if (player.getExpansions("bizhuan").length >= 4) {
				return false;
			}
			return get.suit(event.card) == "spade";
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		frequent: true,
		locked: false,
		async content(event, trigger, player) {
			await player.addToExpansion({
				cards: get.cards(),
				animate: "gain2",
				gaintag: ["bizhuan"],
			});
		},
		mod: {
			maxHandcard(player, num) {
				return num + player.getExpansions("bizhuan").length;
			},
		},
		ai: {
			notemp: true,
		},
	},
	tongbo: {
		audio: 2,
		trigger: { player: "phaseDrawAfter" },
		direct: true,
		filter(event, player) {
			return player.getExpansions("bizhuan").length > 0 && player.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			let result;
			let four = false;
			const nofour = !player.hasFriend();
			const expansions = player.getExpansions("bizhuan");
			if (expansions.length == 4) {
				const suits = new Set(["club", "spade", "heart", "diamond"]);
				const list = player.getCards("he").concat(expansions);
				for (const card of list) {
					suits.delete(get.suit(card));
					if (suits.size == 0) {
						four = true;
						break;
					}
				}
			}
			const chooseMoveEvent = player.chooseToMove({ prompt: "通博：是否交换“书”和手牌？" }).set("four", four).set("nofour", nofour);
			chooseMoveEvent.set("list", [
				[get.translation(player) + "（你）的“书”", expansions],
				["你的牌", player.getCards("he")],
			]);
			chooseMoveEvent.set("filterMove", (from, to) => typeof to != "number");
			chooseMoveEvent.set("selectionSpec", { move: "swap" });
			chooseMoveEvent.set("processAI", list => {
				const player = _status.event.player;
				const cards = list[0][1].concat(list[1][1]);
				let cards2 = [];
				if (_status.event.four) {
					const sorted = [[], [], [], []];
					for (const card of cards) {
						const index = lib.suit.indexOf(get.suit(card, false));
						if (sorted[index]) {
							sorted[index].push(card);
						}
					}
					if (_status.event.nofour) {
						sorted.sort((a, b) => a.length - b.length);
						const cards3 = cards.slice(0).sort((a, b) => get.useful(a) - get.useful(b));
						cards3.removeArray(sorted[0]);
						cards2 = cards3.slice(0, 4);
						cards.removeArray(cards2);
					} else {
						for (const i of sorted) {
							cards2.push(i.randomGet());
							cards.remove(cards2);
						}
					}
				} else {
					cards.sort((a, b) => get.useful(a) - get.useful(b));
					cards2 = cards.splice(0, player.getExpansions("bizhuan").length);
				}
				return [cards2, cards];
			});
			result = await chooseMoveEvent.forResult();

			if (result.bool) {
				const pushs = result.moved[0];
				const gains = result.moved[1];
				pushs.removeArray(player.getExpansions("bizhuan"));
				gains.removeArray(player.getCards("he"));
				if (!pushs.length || pushs.length != gains.length) {
					return;
				}
				player.logSkill("tongbo");
				await player.addToExpansion({
					cards: pushs,
					animate: "give",
					source: player,
					gaintag: ["bizhuan"],
				});
				await player.gain({
					cards: gains,
					animate: "gain2",
				});
			}

			const suits2 = new Set(["club", "spade", "heart", "diamond"]);
			const expansions2 = player.getExpansions("bizhuan");
			for (const expansion of expansions2) {
				suits2.delete(get.suit(expansion));
			}
			if (suits2.size > 0) {
				return;
			}

			const cards = player.getExpansions("bizhuan").slice(0);
			while (cards.length) {
				if (cards.length > 1) {
					result = await player
						.chooseCardButton({
							prompt: "将所有“书”交给任意名其他角色",
							forced: true,
							cards,
							select: [1, cards.length],
							ai(button) {
								if (ui.selected.buttons.length == 0) {
									return 1;
								}
								return 0;
							},
						})
						.forResult();
				} else {
					result = { links: cards.slice(0), bool: true };
				}
				if (!result.bool) {
					return;
				}

				for (const link of result.links) {
					cards.remove(link);
				}
				const togive = result.links.slice(0);
				result = await player
					.chooseTarget({
						prompt: `将${get.translation(result.links)}交给一名其他角色`,
						filterTarget(card, player, target) {
							return target !== player;
						},
						forced: true,
						ai(target) {
							const att = get.attitude(_status.event.player, target);
							if (_status.event.enemy) {
								return -att;
							}
							if (att > 0) {
								return att / (1 + target.countCards("h"));
							}
							return att / 100;
						},
					})
					.set("enemy", get.value(togive[0], player, "raw") < 0)
					.forResult();

				if (!result.targets?.length) {
					return;
				}

				const gainEvent = result.targets[0].gain({ cards: togive, animate: "draw" });
				gainEvent.giver = player;
				await gainEvent;
				player.line(result.targets[0], "green");
				game.log(result.targets[0], "获得了" + get.cnNumber(togive.length) + "张", "#g“书”");
			}
		},
		ai: {
			combo: "bizhuan",
		},
	},
};
