import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olmiluo" | "oljueyan">} */
export const groupSkills = {
	//谋小乔 —— by 星の语
	//洗脚女将，再添一员（？）
	olmiluo: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") && game.hasPlayer(target => target != player);
		},
		filterCard: true,
		position: "he",
		selectCard: () => [1, 2],
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
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const { targets, cards: links } = event;
			await player.showCards(links, get.translation(player) + "发动了【" + get.translation(event.name) + "】");
			const gain_list = targets.reduce((list, target, i) => {
				const card = links[i];
				if (get.owner(card) == player && "he".includes(get.position(card))) {
					return [...list, [target, card]];
				}
				return list;
			}, []);
			await game
				.loseAsync({
					gain_list: gain_list,
					player: player,
					cards: links,
					giver: player,
					animate: "give",
					gaintag: ["olmiluo"],
				})
				.setContent("gaincardMultiple");
			player.addTempSkill(event.name + "_clear", "roundStart");
			player.markAuto(event.name + "_clear", targets);
		},
		group: ["olmiluo_end"],
		subSkill: {
			clear: {
				charlotte: true,
				onremove(player, skill) {
					player.storage[skill].forEach(target => {
						target.removeGaintag("olmiluo");
					});
					delete player.storage[skill];
				},
			},
			end: {
				audio: "olmiluo",
				trigger: {
					global: "roundEnd",
				},
				filter(event, player) {
					return player.getStorage("olmiluo_clear").some(target => target.isIn());
				},
				async cost(event, trigger, player) {
					const next = player
						.chooseTarget(`###${get.prompt(event.skill)}###令一名没有“迷落”牌的角色失去1点体力，或令一名有“迷落”牌的角色回复1点体力。`, (card, player, target) => {
							return player.getStorage("olmiluo_clear").includes(target);
						})
						.set("ai", target => {
							const player = get.player();
							if (target.countCards("h", card => card.hasGaintag("olmiluo"))) {
								return get.recoverEffect(target, player, player);
							}
							return get.effect(target, { name: "losehp" }, player, player);
						});
					next.set(
						"targetprompt2",
						next.targetprompt2.concat([
							target => {
								if (!target.isIn() || !get.event().filterTarget(null, get.player(), target)) {
									return false;
								}
								return target.countCards("h", card => card.hasGaintag("olmiluo")) ? "回复体力" : "失去体力";
							},
						])
					);
					event.result = await next.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					if (target.countCards("h", card => card.hasGaintag("olmiluo"))) {
						if (target.isDamaged()) {
							await target.recover();
						}
					} else {
						await target.loseHp();
					}
				},
			},
		},
		ai: {
			order: 5,
			result: {
				player: 1,
			},
		},
	},
	oljueyan: {
		audio: 2,
		enable: "chooseToUse",
		hiddenCard(player, name) {
			const storage = player.getStorage("oljueyan_round");
			return player.hasCard(card => {
				const type = get.type(card, player);
				const color = get.color(card, player);
				if (type == "trick" || (type == "basic" && color == "red")) {
					return !storage.includes(type) && get.name(card, player) == name;
				}
				return false;
			}, "h");
		},
		filter(event, player) {
			const storage = player.getStorage("oljueyan_round");
			return player.hasCard(card => {
				const type = get.type(card, player);
				const color = get.color(card, player);
				if (type == "trick" || (type == "basic" && color == "red")) {
					return (
						event.filterCard(
							get.autoViewAs({
								name: get.name(card, player),
								suit: "none",
								nature: get.nature(card, player),
								number: null,
								isCard: true,
							}),
							player,
							event
						) && !storage.includes(type)
					);
				}
				return false;
			}, "h");
		},
		filterCard(card, player, event) {
			event = event || _status.event;
			const storage = player.getStorage("oljueyan_round");
			const type = get.type(card, player);
			if (type == "trick" || (type == "basic" && get.color(card, player) == "red")) {
				return (
					event._backup.filterCard(
						get.autoViewAs({
							name: get.name(card, player),
							suit: "none",
							nature: get.nature(card, player),
							number: null,
							isCard: true,
						}),
						player,
						event
					) && !storage.includes(type)
				);
			}
			return false;
		},
		ignoreMod: true,
		position: "h",
		viewAs(cards, player) {
			if (cards.length) {
				const card = cards[0];
				return {
					name: get.name(card, player),
					suit: "none",
					nature: get.nature(card, player),
					number: null,
					isCard: true,
				};
			}
			return null;
		},
		prompt: "展示并视为使用手牌中一张普通锦囊牌或红色基本牌",
		async precontent(event, trigger, player) {
			const cards = event.result.cards;
			const type = get.type(event.result.card);
			player.addTempSkill("oljueyan_round", "roundStart");
			player.markAuto("oljueyan_round", type);
			await player.showCards(cards, `${get.translation(player)}发动了【绝颜】`);
			delete event.result.cards;
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
		group: ["oljueyan_draw"],
		subSkill: {
			round: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已使用过 $",
				},
			},
			draw: {
				audio: "oljueyan",
				trigger: {
					player: "showCardsAfter",
				},
				filter(event, player) {
					const map = lib.skill.oljueyan_draw.getFirstShow(player);
					return (
						event.getShown(player)?.hs?.length &&
						Object.values(map)
							.flat()
							.some(evt => evt == event)
					);
				},
				getFirstShow(player) {
					const history = game.getAllGlobalHistory(),
						map = {};
					if (history.length <= 1) {
						return map;
					}
					for (let i = history.length - 1; i >= 0; i--) {
						history[i]["everything"]
							.slice()
							.reverse()
							.forEach(evt => {
								if (evt.name !== "showCards") {
									return false;
								}
								const cards = evt.getShown(player).hs;
								if (cards.length) {
									cards
										.map(card => get.suit(card))
										.unique()
										.forEach(suit => (map[suit] = evt));
								}
							});
						if (history[i].isRound) {
							break;
						}
					}
					return map;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const map = lib.skill.oljueyan_draw.getFirstShow(player),
						num = Object.values(map)
							.flat()
							.filter(evt => evt == trigger).length,
						skill = "oljueyan",
						str = Object.keys(map)
							.sort((a, b) => lib.suit.indexOf(a) - lib.suit.indexOf(b))
							.map(i => get.translation(i))
							.join("");
					player.addTip(skill, `${get.translation(skill)} ${str}`, "roundStart");
					await player.draw(num);
				},
			},
		},
	},
};
