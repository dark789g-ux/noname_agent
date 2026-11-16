import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczisheng" | "dcxianlve" | "dchaoxian" | "dcsbxieshi" | "dcsbzhubo" | "dcsbqijue">} */
export const groupSkills = {
	//武废------by 清风
	dczisheng: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			const cards = event.cards;
			if (!cards?.length) {
				return false;
			}
			const num = event.cards?.map(card => get.number(card)).reduce((a, b) => a + b);
			return num > 3 && num % 3 === 0;
		},
		async cost(event, trigger, player) {
			const cards = Array.from(ui.cardPile.childNodes)
				.filter(card => get.number(card) == 3)
				.randomGets(3);
			if (cards.length) {
				const result = await player
					.chooseButton({
						createDialog: ["恣胜：你可以获得其中一张牌", cards],
						ai(button) {
							return player.getUseValue(button.link);
						},
					})
					.forResult();
				if (result?.bool && result.links?.length) {
					event.result = {
						bool: true,
						cost_data: result.links,
					};
				}
			} else {
				player.popup("没喽");
			}
		},
		async content(event, trigger, player) {
			const { cost_data: cards } = event;
			await player.gain({ cards, animate: "gain2" });
		},
		group: "dczisheng_dam",
		subSkill: {
			dam: {
				audio: "dczisheng",
				trigger: {
					player: "gainAfter",
					global: ["loseAfter", "loseAsyncAfter"],
				},
				getIndex(event, player) {
					if ((event.name === "loseAsync" && event.type === "gain") || event.name === "gain") {
						return game.filterPlayer(current => {
							if (player === current) {
								return false;
							}
							const cards1 = event.getl?.(current)?.cards2;
							const cards2 = event.getg?.(player);
							return cards2?.containsSome(...cards1);
						});
					} else {
						if (event.type !== "discard") {
							return 0;
						}
						if ((event.discarder || event.getParent(2)?.player) !== player) {
							return false;
						}
						return game.filterPlayer(current => {
							if (player === current) {
								return false;
							}
							const cards = event.getl?.(current)?.cards2;
							return cards.length > 0;
						});
					}
				},
				logTarget(event, player, name, indexedData) {
					return indexedData;
				},
				filter(event, player, name, indexedData) {
					return indexedData?.getHp() > 0;
				},
				prompt2(event, player, name, indexedData) {
					let num = 0;
					if ((event.name === "loseAsync" && event.type === "gain") || event.name === "gain") {
						num = Math.min(indexedData.getHp(), event.getg(player).filter(card => event.getl(indexedData).cards2.includes(card)).length);
					} else {
						num = Math.min(indexedData.getHp(), event.getl(indexedData).cards2.length);
					}
					return `对其造成${num}点伤害`;
				},
				check(event, player, name, indexedData) {
					return get.damageEffect(indexedData, player, player);
				},
				async content(event, trigger, player) {
					const target = event.indexedData;
					if ((trigger.name === "loseAsync" && trigger.type === "gain") || trigger.name === "gain") {
						const num = Math.min(target.getHp(), trigger.getg(player).filter(card => trigger.getl(target).cards2.includes(card)).length);
						await target.damage({ num });
					} else {
						const num = Math.min(target.getHp(), trigger.getl(target).cards2.length);
						await target.damage({ num });
					}
				},
			},
		},
	},
	dcxianlve: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => get.info("dcxianlve").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			if (player == target || player.getStorage("dcxianlve_used").includes(target) || !target.hasCards("h")) {
				return false;
			}
			return target.hasHistory("damage", evt => evt.num > 0) || target.hasHistory("lose", evt => evt.cards2?.length);
		},
		async content(event, trigger, player) {
			if (!player.storage[event.name + "_369"]) {
				player.setStorage(event.name + "_369", [3, 6, 9], true);
			}
			const { target } = event;
			player.addTempSkill(event.name + "_used");
			player.markAuto(event.name + "_used", [target]);
			const cards = target.getCards("h");
			await player.viewCards(`${get.translation(target)}的手牌`, cards);
			player.addSkill(event.name + "_mark");
			const Map = { 11: "J", 12: "Q", 13: "K", 1: "A" };
			const nums = player
				.getStorage(event.name + "_mark")
				.concat(cards.map(card => get.number(card)))
				.unique();
			nums.sort((a, b) => a - b).map(num => Map[num] || num);
			player.setStorage(event.name + "_mark", nums, true);
			while (true) {
				if (player.storage[event.name + "_369"].length && nums.length > player.storage[event.name + "_369"][0]) {
					await player.draw(3);
					player.storage[event.name + "_369"].shift();
				} else {
					break;
				}
			}
			if (nums.length >= 13 - (player.storage[event.name + "_dying"] || 0)) {
				player.removeSkill(event.name + "_mark");
				player.setStorage(event.name + "_369", [3, 6, 9], true);
				player.setStorage(event.name + "_dying", 0, true);
				if (player.hasSkill("dchaoxian", null, false, false) && player.awakenedSkills.includes("dchaoxian")) {
					player.restoreSkill("dchaoxian");
					game.log(player, "重置了", "#g【豪贤】");
				}
			}
		},
		group: ["dcxianlve_dying"],
		subSkill: {
			used: { charlotte: true, onremove: true },
			mark: {
				charlotte: true,
				onremove: true,
				intro: {
					content(storage, player) {
						let str = `已记录点数：${storage}`;
						if (player.storage.dcxianlve_dying && player.storage.dcxianlve_dying > 0) {
							str += `<br>刷新【豪贤】所需要点数数量-${get.translation(player.storage.dcxianlve_dying)}`;
						}
						return str;
					},
				},
			},
			dying: {
				audio: "dcxianlve",
				forced: true,
				trigger: { source: "dying" },
				filter(event, player) {
					return event.reason?.name === "damage";
				},
				async content(event, trigger, player) {
					const num = 3 + (player.storage[event.name] || 0);
					player.setStorage(event.name, num, true);
				},
			},
		},
		ai: {
			order: 10,
			result: {
				player(player, target) {
					return target.countCards("h");
				},
			},
		},
	},
	dchaoxian: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		enable: "phaseUse",
		manualConfirm: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const cards = Array.from(ui.discardPile.childNodes).filter(card => get.number(card) === 3);
			if (cards.length) {
				const next = game.cardsGotoPile(cards);
				next.set("insert_index", () => {
					return ui.cardPile.childNodes[get.rand(0, ui.cardPile.childNodes.length - 1)];
				});
				await next;
				game.log(player, `将${cards.length}张牌洗入了牌堆`);
			}
			const targets = game.filterPlayer(current => current !== player && current.hasGainableCards(player, "h"));
			const cardx = targets.reduce((a, b) => a.addArray(b.getGainableCards(player, "h", card => get.number(card) === 3)), []);
			player.line(targets);
			if (cardx.length) {
				await player.gain({ cards: cardx, animate: "giveAuto" });
			}
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
		},
	},
	//谋杨奉
	dcsbxieshi: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		getZhongyangCards(player) {
			let cards = game
				.getGlobalHistory("cardMove", evt => {
					return (evt.name == "lose" && evt.position == ui.discardPile) || evt.name == "cardsDiscard";
				})
				.map(evt => evt.cards)
				.flat()
				.unique()
				.filter(card => {
					if (!["basic", "trick"].includes(get.type(card))) return false;
					const cardx = new lib.element.VCard({ name: card.name, nature: card.nature, isCard: true });
					return player.hasUseTarget(cardx);
				});
			if (!cards?.length) cards = [];
			return cards;
		},
		filter(event, player) {
			let storage = player.getStorage("dcsbxieshi_mark");
			if (typeof storage != "number") return false;
			return event.player != player && storage != player.countCards("h") && lib.skill["dcsbxieshi"].getZhongyangCards(player).length;
		},
		async cost(event, trigger, player) {
			const cards = lib.skill["dcsbxieshi"].getZhongyangCards(player);
			const result = await player
				.chooseButton({
					createDialog: ["挟势：视为使用一张本回合进入过弃牌堆的牌", cards],
					ai: button => {
						const card = button.link,
							player = get.player();
						const cardx = new lib.element.VCard({ name: card.name, nature: card.nature, isCard: true });
						return player.getUseValue(cardx);
					},
				})
				.forResult();
			event.result = {
				bool: result.bool,
				cost_data: result.bool ? result.links[0] : undefined,
			};
		},
		async content(event, trigger, player) {
			const card = event.result.cost_data;
			if (!card) {
				return;
			}
			const cardx = new lib.element.VCard({ name: card.name, nature: card.nature, isCard: true });
			if (!player.hasUseTarget(cardx)) {
				return;
			}
			await player.chooseUseTarget(cardx, true);
		},
		group: "dcsbxieshi_record",
		subSkill: {
			record: {
				trigger: { global: "phaseBegin" },
				filter(event, player) {
					return event.player != player;
				},
				forced: true,
				popup: false,
				charlotte: true,
				async content(event, trigger, player) {
					player.addTempSkill("dcsbxieshi_mark");
					player.storage["dcsbxieshi_mark"] = player.countCards("h");
				},
				sub: true,
				sourceSkill: "dcsbxieshi",
			},
			mark: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
				},
				sub: true,
				sourceSkill: "dcsbxieshi",
			},
		},
	},
	dcsbzhubo: {
		usable: 1,
		trigger: {
			global: ["damageBegin1", "damageBegin3"],
		},
		init(player, skill) {
			player.storage[skill] = {
				awaken1: false,
				awaken2: false,
			};
		},
		filter(event, player, name) {
			const target = name == "damageBegin1" ? event.source : event.player;
			if (target.isPhaseUsing()) {
				return false;
			}
			let awaken1 = false,
				awaken2 = false;
			if (player.storage["dcsbzhubo"]) {
				({ awaken1, awaken2 } = player.storage["dcsbzhubo"]);
			}
			return (awaken2 && target == player) || (awaken1 && name == "damageBegin3") || name == "damageBegin1";
		},
		async content(event, trigger, player) {
			let triggername = event.triggername;
			let awaken1 = false,
				awaken2 = false;
			if (player.storage["dcsbzhubo"]) {
				({ awaken1, awaken2 } = player.storage["dcsbzhubo"]);
			}
			if (!awaken2) {
				await player.loseHp();
			}
			const target = triggername == "damageBegin1" ? trigger.source : trigger.player;
			const result = await player
				.chooseControl({
					controls: ["伤害+1", "各摸2张牌"],
					controlList: [`令${get.translation(target)}${triggername == "damageBegin1" ? "造成" : "受到"}的伤害+1`, `与${get.translation(target)}各摸2张牌`],
					ai: () => {
						const { target, triggername } = get.event,
							player = get.player();
						if (get.attitude(player, target) > 0) {
							return 1;
						}
						if (triggername == "damageBegin1") {
							return 1;
						}
						return 0;
					},
				})
				.set("target", target)
				.set("triggername", triggername)
				.forResult();
			if (result.index == 0) {
				trigger.num++;
			} else {
				await game.asyncDraw([player, target], 2);
			}
		},
		check(event, player, name) {
			let awaken1 = false,
				awaken2 = false;
			if (player.storage["dcsbzhubo"]) {
				({ awaken1, awaken2 } = player.storage["dcsbzhubo"]);
			}
			let target = name == "damageBegin1" ? event.source : event.player;
			if (get.attitude(player, target) > 0) {
				return true;
			}
			return name == "damageBegin3";
		},
	},
	dcsbqijue: {
		limited: true,
		skillAnimation: true,
		animationColor: "gray",
		init(player, skill) {
			player.storage[skill] = false;
		},
		trigger: {
			global: "dying",
		},
		check(event, player) {
			return get.attitude(player, event.player);
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const target = event.player;
			await event.player.recover(2);
			await event.player.draw(2);
			if (!player.hasSkill("dcsbzhubo")) {
				return;
			}
			if (!player.storage["dcsbzhubo"]) {
				player.storage["dcsbzhubo"] = {
					awaken1: false,
					awaken2: false,
				};
			}
			player.storage["dcsbzhubo"][player == event.player ? "awaken2" : "awaken1"] = true;
		},
	},
};
