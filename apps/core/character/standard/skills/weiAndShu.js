import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yiji" | "luoshen" | "qingguo" | "rende" | "rende1" | "jijiang">} */
export const weiAndShuSkills = {
	yiji: {
		audio: 2,
		trigger: { player: "damageEnd" },
		frequent: true,
		filter(event) {
			return event.num > 0;
		},
		getIndex(event, player, triggername) {
			return event.num;
		},
		async content(event, trigger, player) {
			const cards = get.cards(2);
			await game.cardsGotoOrdering(cards);
			if (_status.connectMode) {
				game.broadcastAll(() => {
					_status.noclearcountdown = true;
				});
			}
			event.given_map = {};
			if (!cards.length) {
				return;
			}

			do {
				const { bool, links } =
					cards.length == 1
						? { links: cards.slice(0), bool: true }
						: await player
								.chooseCardButton({
									prompt: "遗计：请选择要分配的牌",
									cards,
									select: [1, cards.length],
									forced: true,
									ai() {
										if (ui.selected.buttons.length === 0) {
											return 1;
										}
										return 0;
									},
								})
								.forResult();
				if (!bool || !links?.length) {
					return;
				}
				cards.removeArray(links);
				event.togive = links.slice(0);
				const { targets } = await player
					.chooseTarget({
						prompt: `选择一名角色获得${get.translation(links)}`,
						forced: true,
						ai(target) {
							const { player, enemy } = get.event();
							const att = get.attitude(player, target);
							if (enemy) {
								return -att;
							} else if (att > 0) {
								return att / (1 + target.countCards("h"));
							} else {
								return att / 100;
							}
						},
					})
					.set("enemy", get.value(event.togive[0], player, "raw") < 0)
					.forResult();
				if (targets?.length) {
					const id = targets[0].playerid;
					const map = event.given_map;
					if (id != null) {
						if (!map[id]) {
							map[id] = [];
						}
						map[id].addArray(event.togive);
					}
				}
			} while (cards.length > 0);
			if (_status.connectMode) {
				game.broadcastAll(() => {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			const list = [];
			for (const i in event.given_map) {
				const source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				player.line(source, "green");
				if (player !== source && (get.mode() !== "identity" || player.identity !== "nei")) {
					player.addExpose(0.2);
				}
				list.push([source, event.given_map[i]]);
			}
			await game
				.loseAsync({
					gain_list: list,
					giver: player,
					animate: "draw",
				})
				.setContent("gaincardMultiple");
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						let num = 1;
						if (get.attitude(player, target) > 0) {
							if (player.needsToDiscard()) {
								num = 0.7;
							} else {
								num = 0.5;
							}
						}
						if (target.hp >= 4) {
							return [1, num * 2];
						}
						if (target.hp == 3) {
							return [1, num * 1.5];
						}
						if (target.hp == 2) {
							return [1, num * 0.5];
						}
					}
				},
			},
		},
	},
	luoshen: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		frequent: true,
		preHidden: true,
		async content(event, trigger, player) {
			event.cards ??= [];
			while (true) {
				const judgeEvent = player.judge({
					judge(card) {
						if (get.color(card) == "black") {
							return 1.5;
						}
						return -1.5;
					},
					judge2(result) {
						return result.bool;
					},
				});
				if (get.mode() !== "guozhan" && !player.hasSkillTag("rejudge")) {
					judgeEvent.set("callback", async event => {
						if (event.judgeResult.color === "black" && get.position(event.card, true) === "o") {
							await player.gain({
								cards: [event.card],
								animate: "gain2",
							});
						}
					});
				} else {
					judgeEvent.set("callback", async event => {
						if (event.judgeResult.color === "black") {
							event.getParent().orderingCards.remove(event.card);
						}
					});
				}
				const result = await judgeEvent.forResult();
				if (!result?.bool || !result.card) {
					break;
				}

				event.cards.push(result.card);
				const result2 = await player
					.chooseBool({
						prompt: "是否再次发动【洛神】？",
					})
					.set("frequentSkill", "luoshen")
					.forResult();
				if (!result2?.bool) {
					break;
				}
			}
			if (event.cards.someInD()) {
				await player.gain({
					cards: event.cards.filterInD(),
					animate: "gain2",
				});
			}
		},
	},
	qingguo: {
		mod: {
			aiValue(player, card, num) {
				if (get.name(card) != "shan" && get.color(card) != "black") {
					return;
				}
				const cards = player.getCards("hs", card => get.name(card) == "shan" || get.color(card) == "black");
				cards.sort((a, b) => {
					return (get.name(b) == "shan" ? 1 : 2) - (get.name(a) == "shan" ? 1 : 2);
				});
				const geti = () => {
					if (cards.includes(card)) {
						cards.indexOf(card);
					}
					return cards.length;
				};
				if (get.name(card) == "shan") {
					return Math.min(num, [6, 4, 3][Math.min(geti(), 2)]) * 0.6;
				}
				return Math.max(num, [6.5, 4, 3][Math.min(geti(), 2)]);
			},
			aiUseful(...args) {
				return lib.skill.qingguo.mod?.aiValue?.(...args) ?? 0;
			},
		},
		locked: false,
		audio: 2,
		audioname: ["sb_zhenji"],
		audioname2: {
			re_zhenji: "reqingguo",
		},
		enable: ["chooseToRespond", "chooseToUse"],
		filterCard(card) {
			return get.color(card) === "black";
		},
		viewAs: { name: "shan" },
		viewAsFilter(player) {
			if (!player.hasCards("hs", { color: "black" })) {
				return false;
			}
		},
		position: "hs",
		prompt: "将一张黑色手牌当闪使用或打出",
		check() {
			return 1;
		},
		ai: {
			order: 3,
			respondShan: true,
			skillTagFilter(player) {
				if (!player.hasCards("hs", { color: "black" })) {
					return false;
				}
			},
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "respondShan") && current < 0) {
						return 0.6;
					}
				},
			},
		},
	},
	rende: {
		audio: 2,
		enable: "phaseUse",
		filterCard: true,
		selectCard: [1, Infinity],
		allowChooseAll: true,
		discard: false,
		lose: false,
		delay: 0,
		filterTarget(card, player, target) {
			return player != target;
		},
		check(card) {
			if (ui.selected.cards.length > 1) {
				return 0;
			}
			if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
				return 0;
			}
			if (!ui.selected.cards.length && card.name == "du") {
				return 20;
			}
			const player = get.owner(card);
			if (player == null) {
				return 0;
			}
			// let num = 0;
			const evt2 = _status.event.getParent();
			const num = player
				.iterHistory("lose", evt => evt.getParent()?.skill === "rende" && evt.getParent(3) === evt2)
				.map(evt => evt.cards.length)
				.reduce((a, b) => a + b, 0);
			if (player.hp === player.maxHp || num > 1 || player.countCards("h") <= 1) {
				if (ui.selected.cards.length) {
					return -1;
				}
				const players = game.filterPlayer();
				for (const current of players) {
					if (current.hasSkill("haoshi") && !current.isTurnedOver() && !current.hasJudge("lebu") && get.attitude(player, current) >= 3 && get.attitude(current, player) >= 3) {
						return 11 - get.value(card);
					}
				}
				if (player.countCards("h") > player.hp) {
					return 10 - get.value(card);
				}
				if (player.countCards("h") > 2) {
					return 6 - get.value(card);
				}
				return -1;
			}
			return 10 - get.value(card);
		},
		async content(event, trigger, player) {
			const evt2 = event.getParent(3);
			const num = player
				.iterHistory("lose", evt => evt.getParent(2)?.name === "rende" && evt.getParent(5) === evt2)
				.map(evt => evt.cards.length)
				.reduce((a, b) => a + b, 0);
			await player.give(event.cards, event.target);
			if (num < 2 && num + event.cards.length > 1) {
				await player.recover();
			}
		},
		ai: {
			order(skill, player) {
				if (player == null) {
					return 0;
				}
				if (player.hp < player.maxHp && player.storage.rende < 2 && player.countCards("h") > 1) {
					return 10;
				}
				return 1;
			},
			result: {
				target(player, target) {
					if (target.hasSkillTag("nogain")) {
						return 0;
					}
					if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
						return target.hasSkillTag("nodu") ? 0 : -10;
					}
					if (target.hasJudge("lebu")) {
						return 0;
					}
					const nh = target.countCards("h");
					const np = player.countCards("h");
					if (player.hp == player.maxHp || player.storage.rende < 0 || player.countCards("h") <= 1) {
						if (nh >= np - 1 && np <= player.hp && !target.hasSkill("haoshi")) {
							return 0;
						}
					}
					return Math.max(1, 5 - nh);
				},
			},
			effect: {
				target_use(card, player, target) {
					if (player == target && get.type(card) == "equip") {
						if (player.countCards("e", { subtype: get.subtype(card) })) {
							const players = game.filterPlayer();
							for (let i = 0; i < players.length; i++) {
								if (players[i] != player && get.attitude(player, players[i]) > 0) {
									return 0;
								}
							}
						}
					}
				},
			},
			threaten: 0.8,
		},
	},
	rende1: {
		trigger: { player: "phaseUseBegin" },
		silent: true,
		sourceSkill: "rende",
		async content(event, trigger, player) {
			player.storage.rende = 0;
		},
	},
	jijiang: {
		audio: "jijiang1",
		audioname: ["liushan", "re_liubei", "re_liushan", "ol_liushan"],
		audioname2: {
			pe_jun_liubei: "sbjijiang",
		},
		group: ["jijiang1"],
		zhuSkill: true,
		filter(event, player) {
			if (!player.hasZhuSkill("jijiang") || !game.hasPlayer(current => current !== player && current.group === "shu")) {
				return false;
			}
			return !event.jijiang && (event.type !== "phase" || !player.hasSkill("jijiang3"));
		},
		enable: ["chooseToUse", "chooseToRespond"],
		viewAs: { name: "sha" },
		filterCard() {
			return false;
		},
		selectCard: -1,
		ai: {
			order() {
				return get.order({ name: "sha" }) + 0.3;
			},
			respondSha: true,
			skillTagFilter(player) {
				if (!player.hasZhuSkill("jijiang") || !game.hasPlayer(current => current != player && current.group == "shu")) {
					return false;
				}
			},
		},
	},
};
