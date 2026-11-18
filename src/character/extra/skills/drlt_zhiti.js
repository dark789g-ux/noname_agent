import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const drlt_zhitiSkills = {
	drlt_zhiti: {
		audio: 2,
		trigger: {
			global: ["juedouAfter", "chooseToCompareAfter", "compareMultipleAfter"],
			player: "damageEnd",
		},
		filter(event, player) {
			if (!player.hasDisabledSlot()) {
				return false;
			}
			if (event.name == "juedou") {
				if (![event.player, event.target].includes(player)) {
					return false;
				}
				if (!event.turn || event.turn === player) {
					return false;
				}
				const opposite = event.player === player ? event.target : event.player;
				return opposite?.isIn() && opposite.inRangeOf(player) && opposite.isDamaged();
			} else if (event.name == "damage") {
				const opposite = event.source;
				return opposite?.isIn() && opposite.inRangeOf(player) && opposite.isDamaged();
			} else {
				if (![event.player, event.target].includes(player)) {
					return false;
				}
				if (event.preserve) {
					return false;
				}
				let opposite;
				if (player === event.player) {
					if (event.num1 > event.num2) {
						opposite = event.target;
					} else {
						return false;
					}
				} else {
					if (event.num1 < event.num2) {
						opposite = event.player;
					} else {
						return false;
					}
				}
				return opposite?.isIn() && opposite.inRangeOf(player) && opposite.isDamaged();
			}
		},
		forced: true,
		async content(event, trigger, player) {
			await player.chooseToEnable();
		},
		global: "g_drlt_zhiti",
	},
	g_drlt_zhiti: {
		mod: {
			maxHandcard(player, num) {
				if (player.isDamaged()) {
					return (
						num -
						game.countPlayer(function (current) {
							return current != player && current.hasSkill("drlt_zhiti") && current.inRange(player);
						})
					);
				}
			},
		},
	},
	drlt_poxi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
			//return target!=player;
		},
		async content(event, trigger, player) {
			const { target } = event;
			const playerCards = player.getCards("h");
			const targetCards = target.getCards("h");
			const playerDiscarding = [];
			const targetDiscarding = [];
			event.list1 = playerDiscarding;
			event.list2 = targetDiscarding;

			/** @type {GameEvent} */
			let next;
			if (playerCards.length > 0) {
				next = player.chooseButton(4, ["你的手牌", playerCards, `${get.translation(target.name)}的手牌`, targetCards]);
			} else {
				next = player.chooseButton(4, [`${get.translation(target.name)}的手牌`, target.getCards("h")]);
			}
			next.set("target", target);
			next.set("filterButton", filterButton);
			next.set("ai", processAI);

			const result = await next.forResult();
			if (!result.bool) {
				return;
			}

			// 弃牌
			const cards = result.links;
			for (const card of cards) {
				if (get.owner(card) === player) {
					playerDiscarding.push(card);
				} else {
					targetDiscarding.push(card);
				}
			}
			await discardMultiples([
				[player, playerDiscarding],
				[target, targetDiscarding],
			]);

			switch (playerDiscarding.length) {
				case 0:
					await player.loseMaxHp();
					break;
				case 1: {
					let evt = get.event();
					const records = new Set();
					while (true) {
						if (records.has(evt)) {
							break;
						}
						if (evt && evt.getParent) {
							records.add(evt);
							evt = evt.getParent();
						}
						if (evt.name === "phaseUse") {
							evt.skipped = true;
							break;
						}
					}
					player.addTempSkill("drlt_poxi1", { player: "phaseAfter" });
					break;
				}
				case 3:
					await player.recover();
					break;
				case 4:
					await player.draw(4);
					break;
			}

			return;

			/**
			 * @param {Button} button
			 * @returns {boolean}
			 */
			function filterButton(button) {
				const player = get.player();

				if (get.owner(button.link) && !lib.filter.canBeDiscarded(button.link, get.owner(button.link), player)) {
					return false;
				}

				return ui.selected.buttons.every(other => get.suit(button.link) !== get.suit(other.link));
			}

			/**
			 * @param {Button} button
			 * @returns {number}
			 */
			function processAI(button) {
				const { player, target } = get.event();

				const targetCards = target.getCards("h");
				/** @type {Card[]} */
				const chosenCards = ui.selected.buttons.map(buttonx => buttonx.link);
				const targetChosen = chosenCards.filter(card => targetCards.includes(card));

				const card = button.link;
				const owner = get.owner(card);
				const val = get.value(card) || 1;

				if (owner == target) {
					if (targetChosen.length > 1) {
						return 0;
					}
					if (targetChosen.length == 0 || player.hp > 3) {
						return val;
					}
					return 2 * val;
				}

				return 7 - val;
			}

			/**
			 * @param {[Player, Card[]][]} items
			 * @returns {GameEvent?}
			 */
			async function discardMultiples(items) {
				const losingList = items.filter(([_, cards]) => cards.length);
				if (losingList.length > 1) {
					return game
						.loseAsync({
							lose_list: losingList,
							discarder: losingList[0][0],
						})
						.setContent("discardMultiple");
				} else if (losingList.length === 1) {
					const [loser, cards] = losingList[0];
					return loser.discard(cards);
				} else {
					return null;
				}
			}
		},
		ai: {
			order: 6,
			result: {
				target(target, player) {
					return -1;
				},
			},
		},
	},
	drlt_poxi1: {
		mod: {
			maxHandcard(player, num) {
				return num - 1;
			},
		},
	},
	drlt_jieying: {
		audio: 2,
		trigger: { global: "phaseDrawBegin2" },
		filter(event, player) {
			return !event.numFixed && event.player.hasMark("drlt_jieying_mark");
		},
		forced: true,
		locked: false,
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.num++;
		},
		global: "drlt_jieying_mark",
		group: ["drlt_jieying_1", "drlt_jieying_2", "drlt_jieying_3"],
		subSkill: {
			1: {
				audio: "drlt_jieying",
				trigger: { player: "phaseBegin" },
				filter(event, player) {
					return !game.hasPlayer(current => current.hasMark("drlt_jieying_mark"));
				},
				forced: true,
				async content(event, trigger, player) {
					player.addMark("drlt_jieying_mark", 1);
				},
			},
			2: {
				audio: "drlt_jieying",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return (
						player.hasMark("drlt_jieying_mark") &&
						game.hasPlayer(target => {
							return target != player && !target.hasMark("drlt_jieying_mark");
						})
					);
				},
				async cost(event, trigger, player) {
					const prompt = get.prompt("drlt_jieying");
					const prompt2 = "将“营”交给一名角色；其摸牌阶段多摸一张牌，出牌阶段使用【杀】的次数上限+1且手牌上限+1。该角色回合结束后，其移去“营”标记，然后你获得其所有手牌。";
					const filterTarget = (card, player, target) => target !== player && !target.hasMark("drlt_jieying_mark");
					const next = player.chooseTarget(prompt, prompt2, filterTarget);
					next.set("ai", processAI);

					event.result = await next.forResult();

					return;

					/**
					 * @param {Player} target
					 * @returns {number}
					 */
					function processAI(target) {
						const th = target.countCards("h");
						const att = get.attitude(_status.event.player, target);
						for (const skill in target.skills) {
							const info = get.info(skill);
							if (!info) {
								continue;
							}
							if (get.skillInfoTranslation(skill, target).includes("【杀】")) {
								return Math.abs(att);
							}
						}
						if (att > 0) {
							if (th > 3 && target.hp > 2) {
								return 0.6 * th;
							}
						}
						if (att < 1) {
							if (target.countCards("j", { name: "lebu" })) {
								return 1 + Math.min((1.5 + th) * 0.8, target.getHandcardLimit() * 0.7);
							}
							if (!th || target.getEquip("zhangba") || target.getEquip("guanshi")) {
								return 0;
							}
							if (!target.inRange(player) || player.countCards("hs", { name: "shan" }) > 1) {
								return Math.min((1 + th) * 0.3, target.getHandcardLimit() * 0.2);
							}
						}
						return 0;
					}
				},
				async content(event, trigger, player) {
					const { targets } = event;
					const [target] = targets;

					const mark = player.countMark("drlt_jieying_mark");
					player.removeMark("drlt_jieying_mark", mark);
					target.addMark("drlt_jieying_mark", mark);
				},
				ai: {
					effect: {
						player(card, player, target) {
							if (get.name(card) === "lebu" && get.attitude(player, target) < 0) {
								return 1 + Math.min((target.countCards("h") + 1.5) * 0.8, target.getHandcardLimit() * 0.7);
							}
						},
					},
				},
			},
			3: {
				audio: "drlt_jieying",
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					return player != event.player && event.player.hasMark("drlt_jieying_mark") && event.player.isIn();
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					let next = null;
					if (trigger.player.countCards("h") > 0) {
						next = trigger.player.give(trigger.player.getCards("h"), player);
					}
					trigger.player.clearMark("drlt_jieying_mark");
					if (next) {
						await next;
					}
				},
			},
			mark: {
				marktext: "营",
				intro: {
					name2: "营",
					content: "mark",
				},
				mod: {
					cardUsable(card, player, num) {
						if (player.hasMark("drlt_jieying_mark") && card.name == "sha") {
							return (
								num +
								game.countPlayer(function (current) {
									return current.hasSkill("drlt_jieying");
								})
							);
						}
					},
					maxHandcard(player, num) {
						if (player.hasMark("drlt_jieying_mark")) {
							return (
								num +
								game.countPlayer(function (current) {
									return current.hasSkill("drlt_jieying");
								})
							);
						}
					},
					aiOrder(player, card, num) {
						if (
							player.hasMark("drlt_jieying_mark") &&
							game.hasPlayer(current => {
								return current.hasSkill("drlt_jieying") && current != player && get.attitude(player, current) <= 0;
							})
						) {
							return Math.max(num, 0) + 1;
						}
					},
				},
				ai: {
					nokeep: true,
					skillTagFilter(player) {
						return (
							player.hasMark("drlt_jieying_mark") &&
							game.hasPlayer(current => {
								return current.hasSkill("drlt_jieying") && current != player;
							})
						);
					},
				},
			},
		},
	},
};
