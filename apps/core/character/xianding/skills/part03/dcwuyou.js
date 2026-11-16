import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcwuyou" | "dcyixian">} */
export const groupSkills = {
	dcwuyou: {
		audio: 2,
		global: "dcwuyou_g",
		subSkill: {
			g: {
				audio: "dcwuyou",
				forceaudio: true,
				enable: "phaseUse",
				filter(event, player) {
					if (!player.hasCards("h")) {
						return false;
					}
					return game.hasPlayer(current => {
						return current.hasSkill("dcwuyou") && !current.hasSkill("dcwuyou_targeted");
					});
				},
				filterCard: true,
				chessForceAll: true,
				filterTarget(card, player, target) {
					return target.hasSkill("dcwuyou") && !target.hasSkill("dcwuyou_targeted");
				},
				selectTarget() {
					const count = game.countPlayer(current => {
						return current.hasSkill("dcwuyou") && !current.hasSkill("dcwuyou_targeted");
					});
					return count > 1 ? 1 : -1;
				},
				check(card) {
					const player = get.player();
					const hasFriend = game.hasPlayer(current => {
						return current.hasSkill("dcwuyou") && !current.hasSkill("dcwuyou_targeted") && get.attitude(player, current) > 0;
					});
					return (hasFriend ? 7 : 1) - get.value(card);
				},
				prompt() {
					const player = get.player(),
						list = game.filterPlayer(current => {
							return current.hasSkill("dcwuyou") && !current.hasSkill("dcwuyou_targeted");
						}),
						list2 = list.filter(current => current !== player);
					const moreThanOne = list.length > 1,
						includesMe = list.includes(player);
					let str = "选择一张手牌，";
					if (includesMe) {
						str += `点击“确定”，${moreThanOne ? "或" : ""}`;
					}
					if (moreThanOne || !includesMe) {
						str += `将此牌交给${get.translation(list2)}${list2.length > 1 ? "中的一人" : ""}，`;
					}
					str += "然后执行后续效果。";
					return str;
				},
				discard: false,
				lose: false,
				delay: false,
				async content(event, trigger, player) {
					const { target } = event;
					target.addTempSkill("dcwuyou_targeted", "phaseUseAfter");
					const isMe = target === player;
					let { cards } = event;
					if (!isMe) {
						await player.give(cards, target);
					}
					const names = lib.inpile
						.filter(name => {
							return get.type2(name) !== "equip";
						})
						.randomGets(5);
					if (names.includes("sha")) {
						const natures = lib.inpile_nature.slice(0);
						natures.unshift(null);
						names[names.indexOf("sha")] = ["sha", natures.randomGet()];
					}
					const vcard = names.map(namex => {
						let name = namex,
							nature;
						if (Array.isArray(namex)) {
							[name, nature] = namex;
						}
						const info = [get.type(name), "", name, nature];
						return info;
					});
					let str = `###武佑：你可以选择一个牌名###<div class='text center'>${isMe ? `令${get.translation(cards)}视为你选择牌名的牌且无距离和次数限制` : `然后交给${get.translation(player)}一张手牌，此牌视为你选择牌名的牌且无距离和次数限制`}</div>`;
					const next = target
						.chooseButton([str, [vcard, "vcard"]])
						.set("user", player)
						.set("ai", button => {
							const player = get.player(),
								user = get.event().user;
							return user.getUseValue({ name: button.link[2], nature: button.link[3] }) * get.attitude(player, user);
						});
					const result = await next.forResult();
					if (!result?.links?.length) {
						return;
					}
					const { links } = result;
					const viewAs = { name: links[0][2], nature: links[0][3] };
					if (!isMe) {
						cards = (
							await target
								.chooseToGive(player)
								.set("ai", card => {
									const player = get.event().player,
										target = get.event().getParent().player;
									if (get.attitude(player, target) <= 0) {
										return 0;
									}
									return 6 - get.value(card);
								})
								.forResult()
						)?.cards;
					}
					if (!cards) {
						return;
					}
					const card = cards[0];
					if (player.getCards("h").includes(card)) {
						if (!player.storage.dcwuyou_transfer) {
							player.storage.dcwuyou_transfer = {};
						}
						player.storage.dcwuyou_transfer[card.cardid] = viewAs;
						player.addGaintag(cards, "dcwuyou_transfer");
						player.addSkill("dcwuyou_transfer");
					}
				},
				ai: {
					order: 10,
					result: {
						player(player, target) {
							if (get.attitude(player, target) > 0) {
								return 1;
							}
							return 0;
						},
						target: 0.5,
					},
				},
			},
			transfer: {
				trigger: { player: "useCard1" },
				forced: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					if (event.addCount === false) {
						return false;
					}
					return player.hasHistory("lose", evt => {
						if ((evt.relatedEvent || evt.getParent()) != event) {
							return false;
						}
						for (const i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dcwuyou_transfer")) {
								return true;
							}
						}
						return false;
					});
				},
				async content(event, trigger, player) {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				},
				mod: {
					cardname(card, player) {
						const map = player.storage.dcwuyou_transfer;
						if (map && map[card.cardid] && get.itemtype(card) == "card" && card.hasGaintag("dcwuyou_transfer")) {
							return map[card.cardid].name;
						}
					},
					cardnature(card, player) {
						const map = player.storage.dcwuyou_transfer;
						if (map && map[card.cardid] && get.itemtype(card) == "card" && card.hasGaintag("dcwuyou_transfer")) {
							return map[card.cardid].nature || false;
						}
					},
					cardUsable(card) {
						if (!card.cards) {
							return;
						}
						if (card.cards.some(card => card.hasGaintag("dcwuyou_transfer"))) {
							return Infinity;
						}
					},
					targetInRange(card, player) {
						if (!card.cards) {
							return;
						}
						if (card.cards.some(card => card.hasGaintag("dcwuyou_transfer"))) {
							return true;
						}
					},
				},
			},
			targeted: { charlotte: true },
		},
	},
	dcyixian: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		chooseButton: {
			dialog(event, player) {
				const dialog = ui.create.dialog("义贤：你可以选择一项", "hidden");
				dialog.add([
					[
						["field", "获得场上的所有装备牌"],
						["discardPile", "获得弃牌堆中的所有装备牌"],
					],
					"textbutton",
				]);
				return dialog;
			},
			check(button) {
				const player = get.player();
				if (button.link == "field") {
					return game
						.filterPlayer()
						.map(current => {
							const cards = current.getCards("e"),
								att = get.sgnAttitude(player, current);
							return cards
								.map(card => {
									return Math.max(player.hasSkill("dcjuewu") ? 5 : 0, get.value(card, player)) - get.value(card, current) * att;
								})
								.reduce((p, c) => p + c, 0);
						})
						.reduce((p, c) => p + c, 0);
				}
				if (button.link == "discardPile") {
					return Array.from(ui.discardPile.childNodes)
						.filter(card => {
							return get.type(card) === "equip";
						})
						.map(card => {
							return Math.max(player.hasSkill("dcjuewu") ? 5 : 0, get.value(card, player));
						})
						.reduce((p, c) => p + c, 0);
				}
				return 0.1;
			},
			backup(links) {
				return {
					audio: "dcyixian",
					filterCard: () => false,
					selectCard: -1,
					pos: links[0],
					filterTarget: () => false,
					selectTarget: -1,
					skillAnimation: true,
					animationColor: "metal",
					async content(event, trigger, player) {
						player.awakenSkill("dcyixian");
						const position = lib.skill.dcyixian_backup.pos;
						let cards = [];
						if (position === "field") {
							cards.addArray(
								game
									.filterPlayer()
									.map(current => current.getCards("e"))
									.flat()
							);
						} else {
							cards.addArray(
								Array.from(ui.discardPile.childNodes).filter(card => {
									return get.type(card) === "equip";
								})
							);
						}
						if (!cards.length) {
							return;
						}
						await player.gain(cards, position === "field" ? "give" : "gain2");
						const pairs = game.filterPlayer().map(current => {
							let lostNum = 0;
							current.checkHistory("lose", evt => {
								if (evt.getParent(2) === event) {
									lostNum += evt.cards2.length;
								}
							});
							return [current, lostNum];
						});
						for (const pair of pairs) {
							const [target, num] = pair;
							if (!num) {
								continue;
							}
							const { bool } = await player
								.chooseBool(`是否令${get.translation(target)}摸${get.cnNumber(num)}张牌并回复1点体力？`)
								.set("choice", get.effect(target, { name: "draw" }, player, player) + get.recoverEffect(target, player, player) / 5 > 0)
								.forResult();
							if (bool) {
								player.line(target, "green");
								await target.draw(num);
								await target.recover();
							}
							if (!event.isMine() && !event.isOnline()) {
								await game.delayx();
							}
						}
					},
				};
			},
			prompt(links) {
				return `点击“确定”，从${links[0] === "field" ? "场上" : "弃牌堆中"}获得所有装备牌`;
			},
		},
		subSkill: {
			backup: {},
		},
		ai: {
			order: 10,
			threaten: 2.9,
			result: {
				player(player) {
					const enemies = game.filterPlayer(current => {
							return (!get.rawAttitude || get.rawAttitude(player, current) < 0) && get.attitude(player, current) >= 0;
						}),
						knownEnemies = game.filterPlayer(current => {
							return get.attitude(player, current) < 0;
						});
					if ((!knownEnemies.length && player.countCards("e") > 1) || (player.getHp() > 3 && enemies.length > 0 && knownEnemies.length < 2 && knownEnemies.length < enemies.length && !knownEnemies.some(enemy => get.attitude(player, enemy) <= -9))) {
						return 0;
					}
					const val1 = game
						.filterPlayer()
						.map(current => {
							const cards = current.getCards("e"),
								att = get.sgnAttitude(player, current);
							return cards
								.map(card => {
									return Math.max(player.hasSkill("dcjuewu") ? 5 : 0, get.value(card, player)) - get.value(card, current) * att;
								})
								.reduce((p, c) => p + c, 0);
						})
						.reduce((p, c) => p + c, 0);
					const val2 = Array.from(ui.discardPile.childNodes)
						.filter(card => {
							return get.type(card) === "equip";
						})
						.map(card => {
							return Math.max(player.hasSkill("dcjuewu") ? 5 : 0, get.value(card, player));
						})
						.reduce((p, c) => p + c, 0);
					return Math.max(val1, val2) > 20 ? 4 : 0;
				},
			},
		},
	},
};
