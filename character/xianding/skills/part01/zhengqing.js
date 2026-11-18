import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhengqing" | "zhuangpo">} */
export const groupSkills = {
	//神许褚
	zhengqing: {
		audio: 2,
		trigger: { global: "roundEnd" },
		forced: true,
		filter() {
			return (
				game.hasPlayer(current => {
					return current.countMark("zhengqing");
				}) || lib.skill.zhengqing.getMostInfoLastRound()[0] > 0
			);
		},
		getMostInfoLastRound() {
			let max = -1,
				players = [];
			const history = game.getAllGlobalHistory();
			if (history.length <= 1) {
				return [max, players];
			}
			for (let i = history.length - 1; i >= 0; i--) {
				const evts = history[i]["everything"].filter(evt => {
					if (evt.name !== "damage") {
						return false;
					}
					const source = evt.source;
					return source && source.isIn();
				});
				if (evts.length) {
					let curMax = -1,
						curPlayers = [];
					const map = {};
					for (const evt of evts) {
						const source = evt.source;
						const id = source.playerid;
						if (typeof map[id] !== "number") {
							map[id] = 0;
						}
						map[id] += evt.num;
						if (map[id] > curMax) {
							curMax = map[id];
							curPlayers = [source];
						} else if (map[id] == curMax) {
							curPlayers.add(source);
						}
					}
					if (curMax > max) {
						max = curMax;
						players = curPlayers.slice();
					} else if (curMax === max) {
						players.addArray(curPlayers);
					}
				}
				if (history[i].isRound) {
					break;
				}
			}
			return [max, players];
		},
		async content(event, trigger, player) {
			game.countPlayer(current => {
				if (current.hasMark("zhengqing")) {
					current.clearMark("zhengqing");
				}
			});
			const [num, players] = lib.skill.zhengqing.getMostInfoLastRound();
			let target;
			if (!players.length) {
				return;
			} else if (players.length === 1) {
				target = players[0];
			} else if (players.includes(player)) {
				target = player;
			} else {
				target = players.randomGet();
			}
			player.line(target, "thunder");
			const isMax =
				(player
					.getAllHistory("custom", evt => evt && evt.zhengqing_count)
					.map(evt => evt.zhengqing_count)
					.sort((a, b) => b - a)[0] || 0) <= num;
			target.addMark("zhengqing", num);
			if (target === player && isMax) {
				player.draw(Math.min(5, num));
				player.getHistory("custom").push({ zhengqing_count: num });
			} else {
				await game.asyncDraw([player, target].sortBySeat(trigger.player));
			}
		},
		marktext: "擎",
		intro: {
			name: "争擎",
			name2: "擎",
			content: "mark",
		},
	},
	zhuangpo: {
		audio: 2,
		enable: "chooseToUse",
		onChooseToUse(event) {
			if (!game.online && !event.zhuangpo_cards) {
				event.set(
					"zhuangpo_cards",
					event.player.getCards("hes", card => {
						if (get.name(card, event.player) == "sha") {
							return true;
						}
						const str = get.cardDescription(card, event.player);
						return str.includes("【杀】");
					})
				);
			}
		},
		viewAs: {
			name: "juedou",
			storage: { zhuangpo: true },
		},
		viewAsFilter() {
			return get.event().zhuangpo_cards?.length;
		},
		prompt: "将一张牌面信息包含“【杀】”的牌当【决斗】使用",
		filterCard(card, player) {
			return get.event().zhuangpo_cards.includes(card);
		},
		position: "hes",
		async precontent(event, trigger, player) {
			player.addTempSkill("zhuangpo_effect");
		},
		subSkill: {
			effect: {
				trigger: { player: "useCardToPlayered" },
				filter(event, player) {
					const card = event.card;
					if (!card?.storage?.zhuangpo) {
						return false;
					}
					return player.hasMark("zhengqing");
				},
				charlotte: true,
				group: "zhuangpo_damage",
				async cost(event, trigger, player) {
					const target = trigger.target;

					const count = player.countMark("zhengqing");
					const prompt = `###壮魄：是否移去任意枚“擎”？###若如此做，${get.translation(target)}须弃置等量的牌`;
					const numbers = [{ prompt: "请选择要移去的“擎”", min: 1, max: count }];

					const next = player.chooseNumbers(prompt, numbers);
					next.set("processAI", () => {
						const { player, target } = get.event();
						if (get.attitude(player, target) >= 0) {
							return false;
						}

						const markCount = player.countMark("zhengqing");
						const cards = target.getCards("he", card => lib.filter.cardDiscardable(card, target));
						let allIn = false;
						if (
							player.hp < 2 ||
							target.hp + target.countCards("h", card => target.canSaveCard(card, target)) <=
								1 +
									get
										.event()
										.getTrigger()
										.targets.some(current => current.hasMark("zhengqing"))
						) {
							allIn = true;
						}
						if (cards.map(card => get.value(card)).reduce((p, c) => p + c, 0) / cards.length > 5) {
							allIn = true;
						}
						if (
							!player.isPhaseUsing() ||
							!player.hasCard(card => {
								if (!get.cardDescription(card, player).includes("【杀】")) {
									return false;
								}
								return player.hasValueTarget(get.autoViewAs({ name: "juedou" }, [card]));
							})
						) {
							allIn = true;
						}
						const maxCount = Math.min(markCount, cards.length);
						const toRemoveCount = allIn ? maxCount : Math.ceil(Math.random() * maxCount);
						return [toRemoveCount];
					}).set("target", target);

					const result = await next.forResult();
					event.result = {
						bool: typeof result?.numbers?.[0] == "number",
						cost_data: result?.numbers?.[0],
					};
				},
				logTarget: "target",
				async content(event, trigger, player) {
					const { targets, cost_data: toRemoveCount } = event;
					const [target] = targets;
					player.popup(get.cnNumber(toRemoveCount) + "张");
					player.removeMark("zhengqing", toRemoveCount);
					await target.chooseToDiscard("he", toRemoveCount, true, `${get.translation(player)}对你发动了【争擎】`, `你须弃置${get.cnNumber(toRemoveCount)}张牌`);
				},
			},
			damage: {
				audio: "zhuangpo",
				trigger: { global: "damageBegin1" },
				filter(event, player) {
					const card = event.card;
					if (!card?.storage?.zhuangpo) {
						return false;
					}
					const evt = event.getParent(2);
					return (evt.targets || []).some(current => current.hasMark("zhengqing"));
				},
				charlotte: true,
				forced: true,
				async content(event, trigger) {
					trigger.num++;
				},
			},
		},
	},
};
