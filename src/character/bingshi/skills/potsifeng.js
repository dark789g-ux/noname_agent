import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "potsifeng" | "pothuilv" | "potsongyan" | "potshishi">} */
export const groupSkills = {
	//势曹真------by 清风
	potsifeng: {
		audio: 6,
		logAudio: () => 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		check(event, player) {
			return game.hasPlayer(current => get.attitude(player, current) < 0);
		},
		async content(event, trigger, player) {
			const cards = get.cards(3, true);
			if (!cards.length) {
				return;
			}
			await game.cardsGotoOrdering(cards);
			while (cards.length) {
				const result = await player
					.chooseButtonTarget({
						createDialog: [`伺锋：请选择要分配的“伺锋”牌和目标（先选择的牌在前面）`, cards],
						forced: true,
						allowChooseAll: true,
						selectButton: [1, Infinity],
						filterTarget: lib.filter.notMe,
						ai1(button) {
							return 1 + Math.random();
						},
						ai2(target) {
							const player = get.player();
							return -get.attitude(player, target);
						},
					})
					.forResult();
				if (result?.bool && result.targets?.length) {
					const {
						links,
						targets: [target],
					} = result;
					cards.removeArray(links);
					player.line(target);
					await target.addToExpansion({ cards: links.reverse(), source: player, animate: "give", gaintag: [event.name] });
				}
			}
		},
		intro: {
			name: "伺锋",
			markcount: "expansion",
			content: "expansion",
		},
		group: ["potsifeng_use", "potsifeng_effect"],
		subSkill: {
			use: {
				audio: "potsifeng",
				logAudio: () => ["potsifeng3.mp3", "potsifeng4.mp3"],
				forced: true,
				trigger: { global: "useCardAfter" },
				filter(event, player) {
					return event.player.hasExpansions("potsifeng") && event.player == _status.currentPhase;
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const color = get.color(trigger.card),
						{
							targets: [target],
						} = event,
						card = target.getExpansions("potsifeng")[0];
					await target.loseToDiscardpile({ cards: [card] });
					if (color != get.color(card) && target.hasDiscardableCards(target, "h")) {
						await target.chooseToDiscard({ forced: true, position: "h" });
					}
				},
			},
			effect: {
				audio: "potsifeng",
				logAudio: () => ["potsifeng5.mp3", "potsifeng6.mp3"],
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					return event.player.hasExpansions("potsifeng");
				},
				logTarget: "player",
				async cost(event, trigger, player) {
					const list = ["对其造成一点伤害", "获得其所有“伺锋”牌"];
					const result = await player
						.chooseControl({
							controls: list,
							prompt: "对" + get.translation(trigger.player) + "发动【伺锋】",
							ai() {
								const { player, controls, target } = get.event();
								const cards = target.getExpansions("potsifeng");
								if (get.attitude(player, target) > 0) {
									controls.remove("对其造成一点伤害");
								}
								if (cards.length >= 3) {
									controls.remove("对其造成一点伤害");
								}
								return controls.slice(0).randomGet();
							},
						})
						.set("target", trigger.player)
						.forResult();
					if (typeof result?.index == "number") {
						event.result = {
							bool: true,
							cost_data: result.index,
						};
					}
				},
				async content(event, trigger, player) {
					const target = event.targets[0],
						cards = target.getExpansions("potsifeng");
					if (event.cost_data == 0) {
						await target.loseToDiscardpile({ cards });
						await target.damage();
					} else {
						await player.gain({ cards: cards, animate: "gain2" });
					}
				},
			},
		},
	},
	//势吕壹------by 清风
	pothuilv: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			if (player == event.player) {
				return false;
			}
			return ["red", "black"].some(color => !player.getStorage("pothuilv_round").includes(color));
		},
		async cost(event, trigger, player) {
			const list = ["red", "black", "cancel2"].removeArray(player.getStorage(event.skill + "_round")),
				target = trigger.player;
			const result = await player
				.chooseControl({
					controls: list,
					prompt: get.prompt(event.skill, target),
					prompt2: "令其从牌堆中获得一张此颜色的牌",
					ai() {
						const { player, controls, target } = get.event();
						if (get.attitude(player, target) > 0) {
							return "cancel2";
						}
						if (controls.includes("red")) {
							return "red";
						}
						return controls.slice(0).remove("cancel2").randomGet();
					},
				})
				.set("target", target)
				.forResult();
			if (typeof result?.control == "string" && result.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: result.control,
				};
			}
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				cost_data: color,
				targets: [target],
			} = event;
			player.addTempSkill(event.name + "_round", "roundStart");
			player.markAuto(event.name + "_round", [color]);
			const card = get.cardPile2(card => get.color(card) == color);
			if (card) {
				player.addTempSkill(event.name + "_effect", "phaseUseAfter");
				player.markAuto(event.name + "_effect", [card]);
				player
					.when({ global: "phaseUseEnd" })
					.filter(evt => evt == trigger)
					.then(async (event, trigger, player) => {
						trigger.pothuilv_check = true;
					});
				target.addTempSkill(event.name + "_mark", "phaseUseAfter");
				await target.gain({
					cards: [card],
					animate: "gain2",
					gaintag: ["pothuilv_mark"],
				});
				await target.showCards(card, `${get.translation(player)}发动了【${get.translation(event.name)}】`);
			} else {
				player.chat("没牌喽");
			}
		},
		subSkill: {
			round: { charlotte: true, onremove: true },
			mark: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
			},
			effect: {
				audio: "pothuilv",
				charlotte: true,
				onremove: true,
				trigger: { global: "phaseUseEnd" },
				filter(event, player) {
					if (!event.pothuilv_check) {
						return false;
					}
					const bool1 = event.player.hasHistory("useCard", evt => evt.getParent("phaseUse") == event && evt.cards?.some(card => player.getStorage("pothuilv_effect").includes(card)));
					const bool2 = player.getStorage("pothuilv_effect").some(card => get.position(card) !== "d");
					return bool1 || bool2;
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					const target = event.targets[0];
					const bool1 = target.hasHistory("useCard", evt => evt.getParent("phaseUse") == trigger && evt.cards?.some(card => player.getStorage(event.name).includes(card)));
					const bool2 = player.getStorage(event.name).some(card => get.position(card) !== "d");
					if (bool1) {
						await target.damage();
					}
					if (bool2) {
						await player.damage({ source: target, unreal: true });
						const cards = player.getStorage(event.name).filter(card => get.position(card) !== "d");
						if (cards.length && game.hasPlayer(current => current != target)) {
							const result = await player
								.chooseTarget({
									prompt: `隳律：你可以将${get.translation(cards)}交给另一名角色`,
									filterTarget(card, player, target) {
										return target != get.event().target;
									},
									ai(target) {
										const player = get.player();
										if (get.event().cards.some(card => get.name(card) == "du")) {
											return -get.attitude(player, target);
										}
										return get.attitude(player, target);
									},
								})
								.set("cards", cards)
								.set("target", target)
								.forResult();
							if (result?.bool && result.targets?.length) {
								const target = result.targets[0];
								player.line(target);
								await target.gain({
									cards: cards,
									animate: "gain2",
									giver: player,
								});
							}
						}
					}
				},
			},
		},
	},
	potsongyan: {
		audio: 2,
		trigger: { player: ["phaseZhunbeiBegin", "damageEnd"] },
		filter(event, player) {
			return player.hasUseTarget(get.autoViewAs({ name: "wuzhong", isCard: true }));
		},
		prompt2: "视为使用一张【无中生有】",
		frequent: true,
		async content(event, trigger, player) {
			game.filterPlayer().forEach(current => current.addTempSkill(event.name + "_wuxie"));
			await player.chooseUseTarget(get.autoViewAs({ name: "wuzhong", isCard: true }), true);
			game.filterPlayer().forEach(current => current.removeSkill(event.name + "_wuxie"));
		},
		getColors(player) {
			const colors = player
				.getRoundHistory("lose", evt => evt.type == "discard")
				.flatMap(evt => evt.cards)
				.map(card => get.color(card))
				.unique();
			return colors;
		},
		subSkill: {
			wuxie: {
				charlotte: true,
				onChooseToUse(event) {
					if (!game.online && !event.potsongyan) {
						const player = event.player;
						event.set("potsongyan", get.info("potsongyan").getColors(player));
					}
				},
				enable: "chooseToUse",
				filter(event, player) {
					if (event.type != "wuxie") {
						return false;
					}
					return player.hasCards("hes", card => (event.potsongyan || []).includes(get.color(card)));
				},
				position: "hes",
				filterCard(card, player) {
					return get.event().potsongyan?.includes(get.color(card));
				},
				viewAs: { name: "wuxie" },
				prompt: "将一张牌当做【无懈可击】使用",
				check(card) {
					return 8 - get.value(card);
				},
			},
		},
	},
	potshishi: {
		getRespondEvts(event, player) {
			let respondEvts = [];
			for (const current of game.filterPlayer2(current => current != player, null, true)) {
				respondEvts.addArray(current.getAllHistory("useCard", evt => evt.respondTo?.[0] === player, event));
				respondEvts.addArray(current.getAllHistory("respond", evt => evt.respondTo?.[0] === player, event));
			}
			return respondEvts;
		},
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			delete player.storage[skill];
			player.removeSkill(skill + "_mark");
		},
		intro: { content: "$不能响应你使用的牌，直到你使用牌被其他角色响应" },
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			const respondEvts = get.info("potshishi").getRespondEvts(null, player);
			if (
				player.hasAllHistory("useCard", evt => {
					return respondEvts.some(evtx => evtx.respondTo[1] == evt.card);
				})
			) {
				return false;
			}
			return get.info("potshishi").logTarget(event, player).length > 0;
		},
		forced: true,
		logTarget(event, player) {
			return player
				.getAllHistory("damage", evt => evt.source?.isIn())
				.map(evt => evt.source)
				.toUniqued()
				.sortBySeat();
		},
		async content(event, trigger, player) {
			trigger.directHit.addArray(event.targets);
			game.log(event.targets, "不可响应", trigger.card);
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (player.getStorage("potshishi").includes(arg?.target)) {
					return true;
				}
			},
		},
		subSkill: {
			mark: {
				charlotte: true,
				trigger: {
					player: "damage",
					global: ["useCard", "respond"],
				},
				filter(event, player) {
					const respondEvts = get.info("potshishi").getRespondEvts(event.name == "damage" ? null : event, player);
					if (event.name == "damage") {
						if (get.itemtype(event.source) !== "player" || player.getStorage("potshishi").includes(event.source)) {
							return false;
						}
						return !player.hasAllHistory("useCard", evt => {
							return respondEvts.some(evtx => evtx.respondTo[1] == evt.card);
						});
					}
					if (!player.getStorage("potshishi").length) {
						return false;
					}
					if (!Array.isArray(event.respondTo)) {
						return false;
					}
					if (player == event.player || event.respondTo[0] !== player) {
						return false;
					}
					return respondEvts.indexOf(event) == 0;
				},
				silent: true,
				firstDo: true,
				async content(event, trigger, player) {
					if (trigger.name == "damage") {
						player.markAuto("potshishi", [trigger.source]);
					} else {
						player.setStorage("potshishi", [], true);
					}
				},
			},
		},
	},
};
