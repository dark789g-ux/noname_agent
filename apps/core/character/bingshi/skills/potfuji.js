import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "potfuji" | "spmiaolve" | "spyingjia">} */
export const groupSkills = {
	potfuji: {
		audio: 5,
		enable: "phaseUse",
		logAudio: () => 2,
		filter(event, player) {
			return player.countCards("he") > 0 && game.hasPlayer(target => target !== player);
		},
		filterCard: true,
		position: "he",
		selectCard: () => [1, Infinity],
		filterTarget: lib.filter.notMe,
		selectTarget: () => ui.selected.cards.length,
		targetprompt() {
			const links = ui.selected.cards;
			return ["获得", get.translation(links[ui.selected.targets.length - 1])].join("<br>");
		},
		check(card) {
			const player = get.player();
			if (
				ui.selected.cards.length >=
				game.countPlayer(current => {
					return current != player && get.attitude(player, current) > 0;
				})
			) {
				return 0;
			}
			return 6 - get.value(card);
		},
		multiline: true,
		multitarget: true,
		complexSelect: true,
		usable: 1,
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const { targets, cards: links } = event;
			await player.showCards(links, get.translation(player) + "发动了【" + get.translation(event.name) + "】");
			const gain_list = targets.map((target, i) => [target, [links[i]]]);
			await game
				.loseAsync({
					gain_list: gain_list,
					player: player,
					cards: links,
					giver: player,
					animate: "give",
					gaintag: ["potfuji"],
				})
				.setContent("gaincardMultiple");
			for (const list of gain_list) {
				list[0].addSkill("potfuji_effect");
			}
			if (player.isMinHandcard()) {
				player.logSkill("potfuji", null, null, null, [3]);
				player.changeSkin({ characterName: "pot_yuji" }, "pot_yuji_shadow");
				get.info(event.name).dynamic(player);
				await player.draw(2);
				player.addTempSkill(["potfuji_sha", "potfuji_shan"], { player: "phaseBegin" });
			}
			player
				.when({ player: ["phaseBegin"] }, false)
				.assign({
					lastDo: true,
				})
				.step(async () => {
					player.changeSkin({ characterName: "pot_yuji" }, "pot_yuji");
					game.broadcastAll(function (player) {
						if (player.node.potfuji_dynamic) {
							player.node.potfuji_dynamic.delete();
							player.node.potfuji_dynamic2.delete();
							delete player.node.potfuji_dynamic;
							delete player.node.potfuji_dynamic2;
						}
					}, player);
				})
				.finish();
		},
		dynamic(player) {
			game.broadcastAll(function (player) {
				if (
					(() => {
						for (const sheet of document.styleSheets) {
							try {
								const rules = sheet.cssRules || sheet.rules;
								for (const rule of rules) {
									if (rule.selectorText === ".player .player_fuji") {
										return false;
									}
								}
							} catch (e) {
								continue;
							}
						}
						return true;
					})()
				) {
					lib.init.sheet(".player .player_fuji { animation: game_start 0.5s; -webkit-animation: game_start 0.5s; position: absolute; width: 100%; height: 100%; left: 0; top: 0; z-index: 4; pointer-events: none; background: linear-gradient( to top, rgba(0, 255, 255, 0.3) 0%, rgba(0, 255, 255, 0.3) 60%, rgba(0, 255, 255, 0) 80%, rgba(0, 255, 255, 0) 100% );}");
				}
				if (!player.node.potfuji_dynamic) {
					player.node.potfuji_dynamic = ui.create.div(".player_fuji", player.node.avatar);
					player.node.potfuji_dynamic2 = ui.create.div(".player_fuji", player.node.avatar2);
				}
			}, player);
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					var card = ui.selected.cards[ui.selected.targets.length];
					if (!card) {
						return 0;
					}
					if (get.value(card) < 0) {
						return -1;
					}
					return Math.sqrt(5 - Math.min(4, target.countCards("h")));
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: {
					player: ["useCard", "useCardAfter"],
					source: "damageBegin1",
				},
				mark: true,
				marktext: "符",
				intro: {
					mark(dialog, content, player) {
						const cards = player.getCards("h", card => card.hasGaintag("potfuji"));
						if (cards?.length) {
							dialog.addAuto(cards);
						} else {
							dialog.addText("无符济牌");
						}
					},
				},
				filter(event, player, name) {
					const ori_event = event.name === "damage" ? event.getParent("useCard") : event;
					if (
						!ori_event ||
						ori_event.name !== "useCard" ||
						!player.hasHistory("lose", evt => {
							const evtx = evt.relatedEvent || evt.getParent();
							if (evtx !== ori_event) {
								return false;
							}
							return Object.values(evt.gaintag_map).flat().includes("potfuji");
						})
					) {
						return false;
					}
					return name === "useCard" || ori_event.card.name === (event.name === "damage" ? "sha" : "shan");
				},
				forced: true,
				logTarget: "player",
				popup: false,
				async content(event, trigger, player) {
					if (trigger.name === "damage" || event.triggername === "useCardAfter") {
						player.logSkill("potfuji", null, null, null, [trigger.name === "damage" ? 4 : 5]);
					}
					if (trigger.name === "damage") {
						trigger.num++;
					} else if (event.triggername === "useCardAfter") {
						await player.draw();
					} else {
						const history = player.getHistory("lose", evt => {
								if ((evt.relatedEvent || evt.getParent()) !== trigger) {
									return false;
								}
								return Object.values(evt.gaintag_map).flat().includes("potfuji");
							})[0],
							cards = history.getl(player).cards2.filter(card => history.gaintag_map[card.cardid]?.includes("potfuji"));
						let gains = [];
						for (const card of cards) {
							const gain = get.cardPile2(gain => !gains.includes(gain) && get.suit(gain) === get.suit(card, false));
							if (gain) {
								gains.push(gain);
							}
						}
						if (gains.length) {
							await player.gain(gains, "gain2");
						}
					}
				},
			},
			sha: {
				charlotte: true,
				mark: true,
				marktext: "杀",
				intro: {
					name: "符济 - 杀",
					content: "使用【杀】造成的伤害+1",
				},
				audio: "potfuji4.mp3",
				trigger: { player: "useCard" },
				filter(event, player) {
					return event.card.name === "sha";
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					const gain = get.cardPile2(gain => get.suit(gain) === get.suit(trigger.card, false));
					if (gain) {
						await player.gain({
							cards: [gain],
							animate: "gain2",
						});
					}
					trigger.baseDamage++;
					player
						.when({
							player: "useCardAfter",
						})
						.filter(evt => evt === trigger)
						.step(async () => {
							player.removeSkill("potfuji_sha");
						});
				},
			},
			shan: {
				charlotte: true,
				mark: true,
				marktext: "闪",
				intro: {
					name: "符济 - 闪",
					content: "使用【闪】结算完毕后摸一张牌",
				},
				audio: "potfuji5.mp3",
				trigger: { player: "useCard" },
				filter(event, player) {
					return event.card.name === "shan";
				},
				forced: true,
				async content(event, trigger, player) {
					const gain = get.cardPile2(gain => get.suit(gain) === get.suit(trigger.card, false));
					if (gain) {
						player.gain({
							cards: [gain],
							animate: "gain2",
						});
					}
					player
						.when("useCardAfter")
						.filter(evt => evt === trigger)
						.step(async () => {
							player.removeSkill("potfuji_shan");
							await player.draw();
						});
				},
			},
		},
	},
	//势董昭
	spmiaolve: {
		audio: "twmiaolve",
		inherit: "twmiaolve",
		getIndex: () => 1,
		async cost(event, trigger, player) {
			if (trigger.name == "damage") {
				const result = await player
					.chooseButton([`###${get.prompt(event.skill)}###获得一张智囊或摸两张牌`, [get.zhinangs(), "vcard"], [["摸两张牌", "取消"], "tdnodes"]], true)
					.set("ai", button => {
						const player = get.player();
						const { link } = button;
						if (Array.isArray(link)) {
							if (!get.cardPile(cardx => cardx.name == link[2])) {
								return 0;
							}
							return (Math.random() + 1.5) * player.getUseValue({ name: link[2] });
						}
						if (link == "摸两张牌") {
							return get.effect(player, { name: "draw" }, player, player) * 2;
						}
						return 0;
					})
					.forResult();
				event.result = {
					bool: result?.bool && result?.links?.[0] != "取消",
					cost_data: result?.links,
				};
			} else {
				event.result = { bool: true };
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				if (event.cost_data[0] == "摸两张牌") {
					await player.draw(2);
				} else {
					const card = get.cardPile(card => card.name == event.cost_data[0][2]);
					if (card) {
						await player.gain(card, "gain2");
					}
				}
			} else {
				if (!lib.inpile.includes("dz_mantianguohai")) {
					lib.inpile.add("dz_mantianguohai");
				}
				if (!_status.dz_mantianguohai_suits) {
					_status.dz_mantianguohai_suits = lib.suit.slice(0);
				}
				const list = _status.dz_mantianguohai_suits.randomRemove(2).map(i => game.createCard2("dz_mantianguohai", i, 5));
				if (list.length) {
					await player.gain(list, "gain2", "log");
				}
			}
		},
	},
	spyingjia: {
		audio: "twyingjia",
		inherit: "twyingjia",
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			const {
				targets: [target],
				cards,
			} = event;
			player.awakenSkill(event.name);
			await player.discard(cards);
			target.insertPhase(event.name);
			target.addSkill(event.name + "_draw");
		},
		subSkill: {
			draw: {
				charlotte: true,
				trigger: { player: "phaseBegin" },
				filter(event, player) {
					return event.skill == "spyingjia";
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					await player.draw(2);
				},
			},
		},
	},
};
