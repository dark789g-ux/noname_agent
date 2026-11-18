import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olxianlve" | "olzaowang">} */
export const groupSkills = {
	//董昭
	olxianlve: {
		audio: 2,
		trigger: { global: ["phaseBegin", "useCardAfter"] },
		filter(event, player) {
			if (event.name == "useCard") {
				return event.player != player && event.olxianlve_map?.[player.playerid] && event.card.name == player.storage.olxianlve && !player.hasSkill("olxianlve_used", null, null, false);
			}
			return get.info("jsrgzhenglve").isFirst(event.player) && get.inpileVCardList(info => info[0] == "trick").length;
		},
		async cost(event, trigger, player) {
			if (trigger.name == "useCard") {
				event.result = { bool: true };
			} else {
				const list = get.inpileVCardList(info => info[0] == "trick");
				const { bool, links } = await player
					.chooseButton([get.prompt(event.skill), [list, "vcard"]])
					.set("ai", button => {
						switch (button.link[2]) {
							case "wuxie":
								return 0.6 + Math.random();
							case "wuzhong":
							case "dongzhuxianji":
								return 0.5 + Math.random();
							case "guohe":
							case "zhujinqiyuan":
								return 0.4 + Math.random();
							default:
								return Math.random();
						}
					})
					.forResult();
				event.result = {
					bool: bool,
					cost_data: links,
				};
			}
		},
		async content(event, trigger, player) {
			if (trigger.name != "useCard") {
				player.storage[event.name] = event.cost_data[0][2];
				player.markSkill(event.name);
			} else {
				player.addTempSkill(event.name + "_used");
				const result = (await player.draw(2).forResult()).cards;
				const ai_list = [];
				if (get.itemtype(result) == "cards" && player.getCards("h").some(card => result.includes(card))) {
					if (_status.connectMode) {
						game.broadcastAll(() => (_status.noclearcountdown = true));
					}
					let given_map = [];
					let toGive = player.getCards("h").filter(card => result.includes(card));
					while (toGive.some(card => !card.hasGaintag("olsujian_given")) && game.hasPlayer(current => player != current)) {
						const { bool, cards, targets } = await player
							.chooseCardTarget({
								filterCard(card, player) {
									return get.event().cards.includes(card) && !card.hasGaintag("olsujian_given");
								},
								cards: toGive,
								filterTarget: lib.filter.notMe,
								selectCard: [1, toGive.length],
								prompt: "是否将得到的牌分配给其他角色？",
								ai1(card) {
									return !ui.selected.cards.length ? 1 : 0;
								},
								ai2(target) {
									const player = get.player(),
										card = ui.selected.cards[0];
									let val = target.getUseValue(card);
									if (target.isPhaseUsing() && get.type2(card) == "trick") {
										val *= 3;
									}
									if (val > 0) {
										return val * get.attitude(player, target) * 2;
									}
									return get.value(card, target) * get.attitude(player, target);
								},
							})
							.forResult();
						if (bool) {
							const target = targets[0];
							if (given_map.some(i => i[0] == target)) {
								given_map[given_map.indexOf(given_map.find(i => i[0] == target))][1].addArray(cards);
							} else {
								given_map.push([target, cards]);
							}
							player.addGaintag(cards, "olsujian_given");
							toGive.removeArray(cards);
							if (targets[0].isPhaseUsing() && get.type2(cards[0]) == "trick") {
								ai_list.push(cards[0].name);
							}
						} else {
							break;
						}
					}
					if (_status.connectMode) {
						game.broadcastAll(() => {
							delete _status.noclearcountdown;
							game.stopCountChoose();
						});
					}
					if (given_map.length) {
						await game
							.loseAsync({
								gain_list: given_map,
								player: player,
								cards: given_map.slice().flatMap(list => list[1]),
								giver: player,
								animate: "giveAuto",
							})
							.setContent("gaincardMultiple");
					}
				}
				const list = get.inpileVCardList(info => info[0] == "trick");
				if (!list.length) {
					return;
				}
				const { bool, links } = await player
					.chooseButton([get.prompt(event.name), [list, "vcard"]])
					.set("ai", button => {
						if (get.event().list.includes(button.link[2])) {
							return 2 + Math.random();
						}
						switch (button.link[2]) {
							case "wuxie":
								return 0.6 + Math.random();
							case "wuzhong":
							case "dongzhuxianji":
								return 0.5 + Math.random();
							case "guohe":
							case "zhujinqiyuan":
								return 0.4 + Math.random();
							default:
								return Math.random();
						}
					})
					.set("list", ai_list)
					.forResult();
				if (bool) {
					player.storage[event.name] = links[0][2];
					player.markSkill(event.name);
				}
			}
		},
		onremove: true,
		intro: {
			content(name, player) {
				return "已声明" + (player.isUnderControl(true) ? "【" + get.translation(name) + "】" : "一个牌名");
			},
		},
		group: "olxianlve_count",
		subSkill: {
			count: {
				trigger: { global: "useCard1" },
				silent: true,
				forced: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					return event.player != player && event.card.name == player.storage.olxianlve;
				},
				content() {
					if (!trigger.olxianlve_map) {
						trigger.olxianlve_map = {};
					}
					trigger.olxianlve_map[player.playerid] = true;
				},
			},
			used: { charlotte: true },
		},
	},
	olzaowang: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "water",
		filterTarget: true,
		async content(event, trigger, player) {
			const { target } = event;
			player.awakenSkill(event.name);
			await target.gainMaxHp();
			await target.recover();
			await target.draw(3);
			if (get.mode() == "identity" && _status.mode !== "purple") {
				await target.addSkill(event.name + "_effect");
			}
		},
		ai: {
			order: 2,
			result: {
				target(player, target) {
					if (player.hasUnknown(2)) {
						return 0;
					}
					if (get.mode() == "identity" && _status.mode !== "purple") {
						if (target.identity == "zhong") {
							return 20;
						}
						if (target.identity == "zhu") {
							return 10;
						}
						if (target.identity == "nei") {
							return 5;
						}
						if (!target.hasFriend()) {
							return 5;
						}
						return 0;
					}
					return 1;
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: { global: "dieBegin" },
				filter(event, player) {
					return event.player.identity == "zhu" && ["zhong", "mingzhong"].includes(player.identity);
				},
				forced: true,
				forceDie: true,
				skillAnimation: true,
				animationColor: "orange",
				async content(event, trigger, player) {
					game.broadcastAll(
						(player, target) => {
							target.identity = player.identity;
							if (player.identity == "mingzhong") {
								game.zhong = target;
							}
							delete target.isZhu;
							player.identity = "zhu";
							game.zhu = player;
							player.showIdentity();
							target.showIdentity();
						},
						player,
						trigger.player
					);
					await event.trigger("zhuUpdate");
				},
				mark: true,
				marktext: "王",
				intro: { content: "造了个王" },
				group: "olzaowang_kill",
			},
			kill: {
				charlotte: true,
				trigger: { player: "die" },
				forced: true,
				forceDie: true,
				skillAnimation: true,
				animationColor: "wood",
				filter(event, player) {
					return player.identity == "fan" && event.source && ["zhu", "zhong", "mingzhong"].includes(event.source.identity);
				},
				content() {
					game.over(["zhu", "zhong", "mingzhong"].includes(game.me.identity));
				},
			},
		},
	},
};
