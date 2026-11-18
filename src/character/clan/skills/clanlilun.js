import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanlilun" | "clanjianji" | "clanqiajue" | "clanbaichu">} */
export const groupSkills = {
	//族贝斯塔[doge]
	clanlilun: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => get.info("clanlilun").filterCard(card, player), "he");
		},
		filterCard(card, player) {
			if (player.getStorage("clanlilun").includes(card.name)) {
				return false;
			}
			if (ui.selected.cards.length && ui.selected.cards[0].name != card.name) {
				return false;
			}
			const cards = player.getCards("he", cardx => player.canRecast(cardx));
			return cards.includes(card) && cards.filter(i => i.name == card.name).length > 1;
		},
		selectCard: 2,
		position: "he",
		check(card) {
			const player = get.event().player;
			const value = function (card, player) {
				const num = player.getUseValue(card);
				return num > 0 ? num + 1 / (get.value(card) || 0.5) + 7 : 7 - get.value(card);
			};
			if (ui.selected.cards.length && value(card, player) < value(ui.selected.cards[0], player)) {
				return 20 - get.value(card);
			}
			return value(card, player);
		},
		complexCard: true,
		discard: false,
		lose: false,
		delay: 0,
		usable: 1,
		async content(event, trigger, player) {
			await player.recast(event.cards);
			if (!player.storage.clanlilun) {
				player.when({ global: "phaseAfter" }).step(async () => {
					player.unmarkSkill("clanlilun");
					delete player.storage.clanlilun;
				});
			}
			player.markAuto(
				"clanlilun",
				event.cards.slice().map(card => card.name)
			);
			const cards = event.cards.filterInD("d");
			if (cards.some(card => player.hasUseTarget(card))) {
				const { bool, links } = await player
					.chooseButton(["离论：是否使用其中的一张牌？", cards])
					.set("filterButton", button => {
						return get.event().player.hasUseTarget(button.link);
					})
					.set("ai", button => {
						return get.event().player.getUseValue(button.link);
					})
					.forResult();
				if (bool) {
					const card = links[0];
					player.$gain2(card, false);
					await game.delayx();
					await player.chooseUseTarget(true, card, false);
				}
			}
		},
		onremove: true,
		intro: { content: "本回合已重铸过$" },
		ai: {
			order(item, player) {
				let cards = player.getCards("h", card => get.info("clanlilun").filterCard(card, player) && player.getUseValue(card) > 0);
				cards = cards.filter(card => cards.filter(i => i.name == card.name).length > 1);
				if (!cards.length) {
					return 1;
				}
				cards.sort((a, b) => get.order(b) - get.order(a));
				return get.order(cards[0]) - 0.001;
			},
			result: { player: 1 },
		},
	},
	clanjianji: {
		getBool(event, player) {
			const card = new lib.element.VCard({ name: "sha", isCard: true });
			const targets = game.filterPlayer(target => {
				return event.player.getPrevious() == target || event.player.getNext() == target;
			});
			const bool = !targets.some(target => {
				return target.getHistory("useCard").length;
			});
			const goon =
				player.hasUseTarget(card) &&
				!game.getGlobalHistory("useCard", evt => {
					return evt.targets?.some(target => targets.includes(target));
				}).length;
			return [bool, goon];
		},
		limited: true,
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			if (!event.player.isIn()) {
				return false;
			}
			const targets = game.filterPlayer(target => {
				return event.player.getPrevious() == target || event.player.getNext() == target;
			});
			if (!targets.length) {
				return false;
			}
			const [bool, goon] = get.info("clanjianji").getBool(event, player);
			return bool || goon;
		},
		skillAnimation: true,
		animationColor: "watar",
		prompt2(event, player) {
			let str = "";
			const [bool, goon] = get.info("clanjianji").getBool(event, player);
			if (bool) {
				if (goon) {
					str += "你可以";
				}
				str += "与" + get.translation(get.translation(event.player)) + "各摸一张牌";
			}
			if (goon) {
				if (bool) {
					str += "，然后你可以";
				}
				str += "视为使用一张【杀】";
			}
			return str;
		},
		check(event, player) {
			const card = new lib.element.VCard({ name: "sha", isCard: true });
			const [bool, goon] = get.info("clanjianji").getBool(event, player);
			if (player.hasSkill("clanzhongliu")) {
				return goon && player.hasValueTarget(card);
			}
			return (bool && (get.attitude(player, event.player) > 0 || event.player.countCards("h") > player.countCards("h"))) || (goon && player.hasValueTarget(card));
		},
		logTarget: "player",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const card = new lib.element.VCard({ name: "sha", isCard: true });
			const [boolx, goon] = get.info(event.name).getBool(trigger, player);
			if (boolx) {
				let draw = false;
				if (goon) {
					const result = await player
						.chooseBool("是否与" + get.translation(trigger.player) + "各摸一张牌？")
						.set("choice", get.attitude(player, trigger.player) > 0 || trigger.player.countCards("h") > player.countCards("h"))
						.forResult();
					if (result?.bool) {
						draw = true;
					}
				} else {
					draw = true;
				}
				if (draw) {
					await player.draw("nodelay");
					await trigger.player.draw();
				}
			}
			if (goon) {
				await player.chooseUseTarget(card, false, !boolx);
			}
		},
	},
	//族吴乔
	clanqiajue: {
		audio: 2,
		trigger: { player: "phaseDrawBegin" },
		filter(event, player) {
			return (
				player.countCards("he", card => {
					if (_status.connectMode && get.position(card) == "h") {
						return true;
					}
					return get.color(card, player) == "black" && lib.filter.cardDiscardable(card, player);
				}) > 0
			);
		},
		direct: true,
		async content(event, trigger, player) {
			const { bool } = await player
				.chooseToDiscard((card, player) => {
					return get.color(card, player) == "black" && lib.filter.cardDiscardable(card, player);
				}, "he")
				.set("prompt", "当前手牌点数和为" + player.getCards("h").reduce((sum, card) => sum + get.number(card), 0) + "，" + get.prompt("clanqiajue"))
				.set("prompt2", lib.translate.clanqiajue_info.slice(lib.translate.clanqiajue_info.indexOf("弃置")).slice(0, -1))
				.set("ai", card => {
					const player = get.event().player,
						goon = get.position(card) == "h";
					let num = player.getCards("h").reduce((sum, card) => sum + get.number(card), 0);
					if (num - (goon ? get.number(card) : 0) > 30) {
						return 0;
					}
					return goon ? get.number(card) : 1 / (get.value(card) || 0.5);
				})
				.set("logSkill", "clanqiajue")
				.forResult();
			if (bool) {
				player
					.when({
						player: ["phaseDrawEnd", "phaseDrawCancelled", "phaseUseSkipped"],
					})
					.filter(evt => evt == trigger)
					.step(async (event, trigger, player) => {
						const cards = player.getCards("h"),
							num = cards.reduce((sum, card) => sum + get.number(card), 0);
						if (cards.length) {
							player.showCards(cards, get.translation(player) + "【跒倔】展示");
						}
						if (num > 30) {
							player.popup("杯具");
							lib.skill.chenliuwushi.change(player, -2);
						} else {
							player.popup("洗具");
							const evt = trigger.getParent("phase", true, true);
							if (evt?.phaseList) {
								evt.phaseList.splice(evt.num + 1, 0, "phaseDraw|clanqiajue");
							}
						}
					});
			}
		},
	},
	//族荀攸
	clanbaichu: {
		derivation: "qice",
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			const storage = player.storage.clanbaichu || {};
			if (Object.values(storage).includes(event.card.name)) {
				return true;
			}
			const suit = get.suit(event.card);
			if (suit == "none") {
				return false;
			}
			if (!player.hasSkill("qice")) {
				return true;
			}
			const key = `${suit}+${get.type2(event.card)}`;
			return !(key in storage);
		},
		forced: true,
		async content(event, trigger, player) {
			const storage = player.storage.clanbaichu || {},
				suit = get.suit(trigger.card);
			if (suit != "none") {
				const key = `${suit}+${get.type2(trigger.card)}`;
				if (key in storage) {
					if (!player.hasSkill("qice", null, false, false)) {
						await player.addTempSkills("qice", "roundStart");
					}
				} else {
					const list = lib.inpile.filter(name => get.type(name) == "trick");
					list.removeArray(Object.values(storage));
					if (list.length) {
						const dialog = ["百出：选择记录一种普通锦囊牌", [list, "vcard"]];
						const result = await player
							.chooseButton(dialog, true)
							.set("ai", function (button) {
								const player = get.player(),
									name = button.link[2];
								if (name == get.event().getTrigger().card.name) {
									return 1919810;
								}
								if (name == "wuxie") {
									return 114514;
								}
								return get.effect(player, { name: name }, player, player) * (1 + player.countCards("hs", name));
							})
							.forResult();
						if (result?.bool && result?.links?.length) {
							const key = `${get.suit(trigger.card)}+${get.type2(trigger.card)}`,
								name = result.links[0][2];
							player.storage.clanbaichu ??= {};
							player.storage.clanbaichu[key] = name;
							player.markSkill("clanbaichu");
							game.log(player, "记录了", "#y" + get.translation(name));
							await event.trigger("clanbaichu");
							await game.delayx();
						}
					}
				}
			}
			if (Object.values(player.getStorage("clanbaichu")).includes(trigger.card.name)) {
				await player.chooseDrawRecover(true);
			}
		},
		mark: true,
		intro: {
			markcount(storage = {}) {
				if (!storage) {
					return 0;
				}
				return Object.keys(storage).length;
			},
			mark(dialog, storage = {}) {
				if (!storage) {
					return "当前暂无记录";
				}
				const addNewRow = lib.element.dialog.addNewRow.bind(dialog);
				dialog.css({ width: "50%" });
				if (get.is.phoneLayout()) {
					dialog.classList.add("fullheight");
				}
				let types = ["basic", "trick", "equip"].concat(Object.keys(storage).map(list => list.split("+")[1])).toUniqued();
				let suits = lib.suit
					.slice()
					.reverse()
					.concat(Object.keys(storage).map(list => list.split("+")[0]))
					.toUniqued();
				addNewRow(
					...["花色"].concat(types.map(i => get.translation(i))).map(type => {
						return { item: type, ratio: type == "花色" ? 1 : 2 };
					})
				);
				for (const suit of suits) {
					let list = [{ item: get.translation(suit), ratio: 1 }];
					for (const type of types) {
						list.add({
							item: ((suit, type, storage) => {
								if (storage[suit + "+" + type]) {
									return get.translation(storage[suit + "+" + type]);
								}
								return null;
							})(suit, type, storage),
							ratio: 2,
						});
					}
					addNewRow(...list);
				}
			},
		},
		init(player, skill) {
			player.addSkill(skill + "_count");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_count");
		},
		subSkill: {
			count: {
				charlotte: true,
				init(player) {
					const storage = player.storage.clanbaichu || {};
					//移除已经记录的新组合标记
					const cards_old = player.getCards("h", card => {
						const suit = get.suit(card, false);
						return (suit === "none" || `${suit}+${get.type2(card, false)}` in storage) && card.hasGaintag("clanbaichu_new");
					});
					if (cards_old.length) {
						player.removeGaintag("clanbaichu_new", cards_old);
					}
					//添加未曾记录的新组合标记
					const cards_new = player.getCards("h", card => {
						const suit = get.suit(card, false);
						return suit !== "none" && !(`${suit}+${get.type2(card, false)}` in storage) && !card.hasGaintag("clanbaichu_new");
					});
					if (cards_new.length) {
						player.addGaintag(cards_new, "clanbaichu_new");
					}
					//添加记录锦囊的已记录标记
					const cards_trick = player.getCards("h", card => Object.values(storage).includes(get.name(card, false)) && !card.hasGaintag("clanbaichu_trick"));
					if (cards_trick.length) {
						player.addGaintag(cards_trick, "clanbaichu_trick");
					}
				},
				onremove(player) {
					player.removeGaintag("clanbaichu_new");
					player.removeGaintag("clanbaichu_trick");
				},
				trigger: {
					player: ["gainEnd", "clanbaichu", "enterGame"],
					global: ["loseAsyncEnd", "gameDrawEnd", "phaseBefore"],
				},
				filter(event, player) {
					if (["gain", "loseAsync"].includes(event.name) && !event.getg?.(player)?.length) {
						return false;
					}
					const storage = player.storage.clanbaichu || {};
					return player.hasCard(card => {
						const suit = get.suit(card, false);
						const old = (suit === "none" || `${suit}+${get.type2(card, false)}` in storage) && card.hasGaintag("clanbaichu_new");
						const newx = suit !== "none" && !(`${suit}+${get.type2(card, false)}` in storage) && !card.hasGaintag("clanbaichu_new");
						const load = Object.values(storage).includes(get.name(card, false)) && !card.hasGaintag("clanbaichu_trick");
						return old || newx || load;
					}, "h");
				},
				silent: true,
				firstDo: true,
				async content(event, trigger, player) {
					get.info(event.name).init?.(player);
				},
			},
			new: {},
			trick: {},
		},
	},
};
