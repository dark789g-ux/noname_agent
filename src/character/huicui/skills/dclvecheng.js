import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dclvecheng" | "dczhongji" | "dclingkong" | "dcxianshu">} */
export const groupSkills = {
	//张曼成
	dclvecheng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target } = event;
			player.addTempSkill("dclvecheng_xiongluan");
			player.markAuto("dclvecheng_xiongluan", [target]);
			var cards = player.getCards("h", "sha");
			if (cards.length) {
				player.addGaintag(cards, "dclvecheng_xiongluan");
			}
		},
		ai: {
			threaten: 3.1,
			order: 3.5,
			expose: 0.2,
			result: {
				target(player, target) {
					if (player.getStorage("dclvecheng_xiongluan").includes(target)) {
						return 0;
					}
					if (
						target.hasSkillTag(
							"freeShan",
							false,
							{
								player: player,
								type: "use",
							},
							true
						)
					) {
						return -0.6;
					}
					var hs = player.countCards("h", card => {
						if (!player.canUse(card, target)) {
							return false;
						}
						return get.name(card) == "sha" && get.effect(target, card, player, player) > 0;
					});
					var ts = target.hp;
					if (hs >= ts && ts > 1) {
						return -2;
					}
					return -1;
				},
			},
		},
		subSkill: {
			xiongluan: {
				trigger: { player: ["phaseEnd", "useCard1"] },
				charlotte: true,
				forced: true,
				popup: false,
				onremove(player, skill) {
					player.removeGaintag(skill);
					delete player.storage[skill];
				},
				filter(event, player) {
					if (event.name == "useCard") {
						if (event.addCount === false || !event.targets?.some(target => player.getStorage("dclvecheng_xiongluan").includes(target))) {
							return false;
						}
						return player.hasHistory("lose", evt => {
							const evtx = evt.relatedEvent || evt.getParent();
							if (evtx != event) {
								return false;
							}
							return Object.values(evt.gaintag_map).flat().includes("dclvecheng_xiongluan");
						});
					}
					return player.getStorage("dclvecheng_xiongluan").some(i => i.isIn());
				},
				async content(event, trigger, player) {
					if (trigger.name == "useCard") {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] == "number") {
							stat[name]--;
						}
						return;
					}
					const targets = player.getStorage(event.name).slice().sortBySeat();
					if (!targets.length) {
						return;
					}
					while (targets.length && player.isIn()) {
						const target = targets.shift();
						await target.showHandcards();
						let cards = target.getCards("h", card => {
							return get.name(card) === "sha" && target.canUse(card, player, false);
						});
						if (!cards.length) {
							continue;
						}
						let forced = false;
						while (cards.length && player.isIn()) {
							const prompt2 = forced ? `掠城：选择对${get.translation(player)}使用的【杀】` : `掠城：是否依次对${get.translation(player)}使用所有的【杀】？`;
							const result = await target
								.chooseToUse(
									forced,
									function (card, player, event) {
										if (get.itemtype(card) != "card" || get.name(card) != "sha") {
											return false;
										}
										return lib.filter.filterCard.apply(this, arguments);
									},
									prompt2
								)
								.set("targetRequired", true)
								.set("complexTarget", true)
								.set("complexSelect", true)
								.set("filterTarget", function (card, player, target) {
									if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
										return false;
									}
									return lib.filter.targetEnabled.apply(this, arguments);
								})
								.set("sourcex", player)
								.forResult();
							if (result.bool) {
								cards = target.getCards("h", card => {
									return get.name(card) === "sha" && target.canUse(card, player, false);
								});
								forced = true;
							} else {
								break;
							}
						}
					}
				},
				intro: { content: "对$使用“掠城”【杀】无任何次数限制" },
				mod: {
					cardUsableTarget(card, player, target) {
						if (!card.cards || card.cards.length != 1) {
							return;
						}
						if (card.name == "sha" && card.cards[0].hasGaintag("dclvecheng_xiongluan") && player.getStorage("dclvecheng_xiongluan").includes(target)) {
							return true;
						}
					},
				},
			},
		},
	},
	dczhongji: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (player.countCards("h") >= player.maxHp) {
				return false;
			}
			var suit = get.suit(event.card);
			return !lib.suit.includes(suit) || !player.countCards("h", { suit: suit });
		},
		check(event, player) {
			var num = Math.min(20, player.maxHp - player.countCards("h"));
			if (num <= 0) {
				return false;
			}
			var numx =
				player.getHistory("useSkill", evt => {
					return evt.skill == "dczhongji";
				}).length + 1;
			if (numx > num) {
				return false;
			}
			if (_status.currentPhase != player) {
				return true;
			}
			if (
				player.hasCard(card => {
					var suit = get.suit(card);
					return (
						player.hasValueTarget(card) &&
						!player.hasCard(cardx => {
							return cardx != card && get.suit(cardx) == suit;
						})
					);
				})
			) {
				return false;
			}
			return true;
		},
		prompt2(event, player) {
			var num = Math.min(20, player.maxHp - player.countCards("h"));
			var str = num > 0 ? "摸" + get.cnNumber(num) + "张牌，然后" : "";
			return (
				str +
				"弃置" +
				get.cnNumber(
					1 +
						player.getHistory("useSkill", evt => {
							return evt.skill == "dczhongji";
						}).length
				) +
				"张牌"
			);
		},
		async content(event, trigger, player) {
			const drawNum = Math.min(20, player.maxHp - player.countCards("h"));
			if (drawNum > 0) {
				await player.draw({
					num: drawNum,
				});
			}
			const discardNum = player.getHistory("useSkill", evt => evt.skill == "dczhongji").length;
			await player.chooseToDiscard({
				prompt: "螽集：请弃置" + get.cnNumber(discardNum) + "张牌",
				position: "he",
				forced: true,
				selectCard: discardNum,
				ai: get.unuseful,
			});
		},
		ai: {
			threaten: 3.2,
		},
	},
	//乐周妃
	dclingkong: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && player.countCards("h");
		},
		async content(event, trigger, player) {
			const cards = player.getCards("h");
			if (cards.length) {
				player.addGaintag(cards, "dclingkong_tag");
			}
		},
		mod: {
			ignoredHandcard(card, player) {
				if (card.hasGaintag("dclingkong_tag")) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && card.hasGaintag("dclingkong_tag")) {
					return false;
				}
			},
		},
		group: "dclingkong_marker",
		subSkill: {
			marker: {
				audio: "dclingkong",
				trigger: {
					player: "gainAfter",
					global: "loseAsyncAfter",
				},
				forced: true,
				filter: (event, player) => {
					const phaseDraw = event.getParent("phaseDraw");
					if (phaseDraw?.player === player) {
						return false;
					}
					const history = player.getHistory("gain", evt => {
						const phaseDraw = evt.getParent("phaseDraw");
						return !phaseDraw || phaseDraw.player !== player;
					});
					const evt = event.name == "loseAsync" ? event.childEvents?.find(evtx => evtx.name == "gain" && evtx.player == player) : event;
					if (history.indexOf(evt) !== 0) {
						return false;
					}
					const hs = player.getCards("h");
					if (!hs.length) {
						return false;
					}
					const cards = event.getg?.(player);
					return cards?.some(card => hs.includes(card));
				},
				async content(event, trigger, player) {
					let hs = player.getCards("h"),
						cards = trigger.getg(player);
					cards = cards.filter(card => hs.includes(card));
					if (cards.length) {
						player.addGaintag(cards, "dclingkong_tag");
					}
					await game.delayx();
				},
			},
		},
	},
	dcxianshu: {
		audio: 2,
		enable: "phaseUse",
		filter: (event, player) => {
			return game.hasPlayer(current => current != player) && player.hasCard(card => card.hasGaintag("dclingkong_tag"), "h");
		},
		filterCard: card => card.hasGaintag("dclingkong_tag"),
		filterTarget: lib.filter.notMe,
		discard: false,
		lose: false,
		delay: false,
		position: "h",
		check: card => {
			const player = _status.event.player,
				event = _status.event,
				color = get.color(card);
			if (color == "red") {
				return (event.getTempCache("dcxianshu", "red") ||
					event.putTempCache(
						"dcxianshu",
						"red",
						game
							.hasPlayer(current => {
								return current != player && current.hp <= player.hp && current.isDamaged() && get.recoverEffect(current, player, player) > 0;
							})
							.toString()
					)) == "true"
					? 7 - get.value(card)
					: 0;
			} else if (color == "black") {
				return (event.getTempCache("dcxianshu", "black") ||
					event.putTempCache(
						"dcxianshu",
						"black",
						game
							.hasPlayer(current => {
								return current != player && current.hp >= player.hp && get.effect(current, { name: "losehp" }, player, player) > 0;
							})
							.toString()
					)) == "true"
					? 7 - get.value(card)
					: 0;
			}
			return 6 - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.give(cards, target, true);
			const color = get.color(cards[0], player);
			if (target.isIn()) {
				const num = Math.min(Math.abs(target.getHp() - player.getHp()), 5);
				if (num > 0) {
					await player.draw({ num });
				}
			}
			if (color == "red") {
				if (target.getHp() <= player.getHp() && target.isDamaged()) {
					await target.recover();
				}
			} else if (color == "black") {
				if (target.getHp() >= player.getHp()) {
					await target.loseHp();
				}
			}
		},
		ai: {
			combo: "dclingkong",
			order: 10,
			result: {
				player(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					let num = target.getHp() - player.getHp();
					const card = ui.selected.cards[0],
						color = get.color(card);
					if (color == "red" && target.getHp() <= player.getHp() && target.isDamaged()) {
						num++;
					} else if (color == "black" && target.getHp() >= player.getHp()) {
						num--;
					}
					return Math.min(Math.abs(num), 5) * 1.1;
				},
				target(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					const card = ui.selected.cards[0],
						color = get.color(card),
						val = get.value(card, target);
					if (color == "red" && target.getHp() <= player.getHp() && target.isDamaged()) {
						return get.recoverEffect(target, player, target) + val / 1.4;
					} else if (color == "black" && target.getHp() >= player.getHp()) {
						return get.effect(target, { name: "losehp" }, player, target) + val / 1.4;
					}
					return val / 1.4;
				},
			},
		},
	},
};
