import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "hengwu" | "dccangming" | "dcchouxi" | "dcjichao">} */
export const groupSkills = {
	hengwu: {
		audio: 2,
		trigger: { player: ["useCard", "respond"] },
		frequent: true,
		filter(event, player) {
			var suit = get.suit(event.card);
			if (
				!lib.suit.includes(suit) ||
				player.hasCard(function (card) {
					return get.suit(card, player) == suit;
				}, "h")
			) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return current.hasCard(function (card) {
					return get.suit(card, current) == suit;
				}, "e");
			});
		},
		async content(event, trigger, player) {
			const suit = get.suit(trigger.card);

			const num = game.countPlayer(current => {
				return current.countCards("e", card => get.suit(card, current) == suit);
			});
			await player.draw(num);
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					if (typeof card !== "object") {
						return;
					}
					let suit = get.suit(card);
					if (
						!lib.suit.includes(suit) ||
						player.hasCard(function (i) {
							return get.suit(i, player) == suit;
						}, "h")
					) {
						return;
					}
					return [
						1,
						0.8 *
							game.countPlayer(current => {
								return current.countCards("e", card => {
									return get.suit(card, current) == suit;
								});
							}),
					];
				},
				target: (card, player, target) => {
					if (
						card.name === "sha" &&
						!player.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: target,
								card: card,
							},
							true
						) &&
						game.hasPlayer(current => {
							return current.hasCard(cardx => {
								return get.subtype(cardx) === "equip3";
							}, "e");
						})
					) {
						return [0, -0.5];
					}
				},
			},
		},
	},
	//新杀神孙权
	dccangming: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			if (event.name == "phase" && game.phaseNumber != 0) {
				return false;
			}
			return game.hasPlayer(target => target.hasCards("h"));
		},
		logTarget() {
			return game.filterPlayer(target => target.hasCards("h"));
		},
		async content(event, trigger, player) {
			const { name, targets } = event;
			const lose_list = targets.sortBySeat().map(target => [target, target.getCards("h")]);
			game.addGlobalSkill("dccangming_gain");
			await game
				.loseAsync({
					lose_list: lose_list,
					player: player,
					log: true,
					animate: "giveAuto",
					gaintag: [name],
				})
				.setContent("addToExpansionMultiple");
		},
		marktext: "溟",
		intro: {
			markcount: "expansion",
			mark(dialog, storage, player) {
				const cards = player.getExpansions("dccangming");
				if (player.isUnderControl(true)) {
					dialog.addAuto(cards);
				} else {
					return "共有" + get.cnNumber(cards.length) + "张牌";
				}
			},
		},
		group: "dccangming_draw",
		subSkill: {
			draw: {
				audio: "dccangming",
				trigger: { global: ["addToExpansionEnd", "loseAsyncEnd"] },
				filter(event, player) {
					if (event.getlx == false) {
						return false;
					}
					if (event.name == "loseAsync" && event.type != "addToExpansion") {
						return false;
					}
					return event.gaintag?.includes("dccangming");
				},
				forced: true,
				async content(event, trigger, player) {
					const { cards } = trigger;
					const types = cards.map(card => get.color(card)).unique();
					await player.draw(types.length);
				},
			},
			gain: {
				trigger: { player: ["phaseBegin", "damageEnd"] },
				filter(event, player) {
					return player.hasExpansions("dccangming");
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					game.log(player, "获得了", get.cnNumber(player.countExpansions("dccangming")), "张牌");
					await player.gain(player.getExpansions("dccangming"), "draw");
				},
			},
		},
	},
	dcchouxi: {
		audio: 2,
		enable: "phaseUse",
		onChooseToUse(event) {
			if (game.online || event.dcchouxiList) {
				return;
			}
			const player = event.player;
			const cards = game.filterPlayer().flatMap(current => current.getExpansions("dccangming"));
			const list = get.inpileVCardList(info => {
				if (!["basic", "trick"].includes(info[0]) || player.getStorage("dcchouxi_used").includes(info[2])) {
					return false;
				}
				if (!cards.some(card => get.name(card) == info[2] && get.is.sameNature([card, info[3]], true))) {
					return false;
				}
				return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3], storage: { dcchouxi: true } }, "unsure"), player, event);
			});
			event.set("dcchouxiList", list);
		},
		filter(event, player) {
			if (!event.dcchouxiList?.length) {
				return false;
			}
			return player.hasCards("hes");
		},
		chooseButton: {
			dialog(event, player) {
				const list = event.dcchouxiList;
				const dialog = ui.create.dialog("筹汐", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				const player = get.player(),
					card = get.autoViewAs({ name: button.link[2], nature: button.link[3], storage: { dcchouxi: true } }, "unsure");
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					audio: "dcchouxi",
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						storage: {
							dcchouxi: true,
						},
					},
					filterCard: true,
					position: "hes",
					check(card) {
						return 5 - get.value(card);
					},
					async precontent(event, trigger, player) {
						player.addTempSkill("dcchouxi_used");
						player.markAuto("dcchouxi_used", event.result.card.name);
						event.getParent().addCount = false;
					},
				};
			},
			prompt(links, player) {
				return `将一张牌当作${get.translation(links[0][3] || "")}【${get.translation(links[0][2])}】使用`;
			},
		},
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.dcchouxi) {
					return Infinity;
				}
			},
			targetInRange(card, player) {
				if (card?.storage?.dcchouxi) {
					return true;
				}
			},
		},
		ai: {
			combo: ["dccangming", "dcjichao"],
			order: 8,
			result: { player: 1 },
		},
		subSkill: {
			backup: {},
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "本回合【筹汐】已使用过牌名：$" },
			},
		},
	},
	dcjichao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => current != player && current.countCards("he") > 0);
		},
		chooseButton: {
			dialog(event, player) {
				const choiceList = [
					["one", "令一名其他角色将随机一半手牌（向上取整）和装备区的牌置于武将牌上"],
					["all", "令所有其他角色将所有牌置于武将牌上"],
				];
				const dialog = ui.create.dialog("激潮", [choiceList, "textbutton"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			filter(button, player) {
				return button.link == "one" || !player.hasSkill("dcjichao_blocker");
			},
			check(button) {
				const player = get.player();
				if (button.link == "all") {
					return 2;
				}
				return 1;
			},
			backup(links, player) {
				return {
					audio: "dcjichao",
					choice: links[0],
					manualConfirm: true,
					filterTarget(card, player, target) {
						return target != player && target.countCards("he") > 0;
					},
					selectTarget() {
						const { choice } = get.info("dcjichao_backup");
						if (choice == "all") {
							return -1;
						}
						return 1;
					},
					multitarget: true,
					multiline: true,
					async content(event, trigger, player) {
						const { targets, name } = event;
						const { choice } = get.info(name);
						if (choice == "all") {
							player.addTempSkill("dcjichao_blocker", { player: "dieAfter" });
						}
						const getCards = function (target) {
							let cards = target.getCards("h");
							if (choice !== "all") {
								let num = Math.ceil(cards.length / 2);
								if (num > 0) {
									cards = cards.randomGets(num);
								}
							}
							cards = [...cards, ...target.getCards("e")];
							return cards;
						};
						if (choice == "all") {
							await game
								.loseAsync({
									lose_list: targets.sortBySeat().map(target => [target, getCards(target)]),
									player: player,
									log: true,
									animate: "giveAuto",
									gaintag: ["dccangming"],
								})
								.setContent("addToExpansionMultiple");
						} else {
							const [target] = targets;
							const next = target.addToExpansion(getCards(target), target, "giveAuto");
							next.gaintag.add("dccangming");
							await next;
						}
					},
					ai1: () => 1,
					ai2(target) {
						const player = get.player();
						return -get.attitude(player, target);
					},
				};
			},
			prompt(links, player) {
				if (links[0] == "all") {
					return "令所有其他角色将所有牌置于武将牌上，称为“溟”";
				}
				return "令一名其他角色将随机一半手牌（向上取整）和装备区的牌置于武将牌上，称为“溟”";
			},
		},
		ai: {
			order(item, player) {
				player ??= get.player();
				if (
					game.hasPlayer(current => {
						if (current == player || !current.countCards("h")) {
							return false;
						}
						if (get.attitude(player, current) > 0) {
							return false;
						}
						return player.countCards("hs", card => player.canUse(card, current) && get.effect(current, card, player, player) > 0) > 0;
					})
				) {
					return 9;
				}
				return 1;
			},
			result: {
				player(player, target) {
					if (
						game.hasPlayer(current => {
							if (current == player || !current.countCards("h")) {
								return false;
							}
							return get.attitude(player, current) < 0;
						})
					) {
						return 1;
					}
					return 0;
				},
			},
		},
		subSkill: {
			blocker: {
				charlotte: true,
				silent: true,
				init(player, skill) {
					player.addMark(skill, 3, false);
				},
				onremove: true,
				intro: {
					content: "还需造成#点伤害",
				},
				trigger: {
					source: "damage",
				},
				filter(event, player) {
					return event.num > 0;
				},
				async content(event, trigger, player) {
					const { num } = trigger;
					player.removeMark(event.name, num, false);
					if (!player.hasMark(event.name)) {
						player.removeSkill(event.name);
					}
				},
			},
			backup: {},
		},
	},
};
