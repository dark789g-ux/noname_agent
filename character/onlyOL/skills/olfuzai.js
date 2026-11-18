import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olfuzai" | "olsbxinchuan">} */
export const groupSkills = {
	olfuzai: {
		audio: 5,
		enable: "chooseToUse",
		locked: true,
		filter(event, player) {
			const hs = player.getCards("he", card => get.type(card) == "equip");
			if (!hs.length) {
				return false;
			}
			return ["jiedao", "wuzhong"].some(name => {
				return hs.some(card => {
					const vcard = get.autoViewAs({ name: name }, [card]);
					return event.filterCard(vcard, player, event) && player.hasUseTarget(vcard);
				});
			});
		},
		chooseButton: {
			dialog(event, player) {
				const hs = player.getCards("he", card => get.type(card) == "equip");
				const list = ["jiedao", "wuzhong"].filter(name => {
					return hs.some(card => {
						const vcard = get.autoViewAs({ name: name }, [card]);
						return event.filterCard(vcard, player, event) && player.hasUseTarget(vcard);
					});
				});
				const dialog = ui.create.dialog("覆载", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				const player = get.player(),
					card = get.autoViewAs({ name: button.link[2] }, "unsure");
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
					},
					position: "he",
					filterCard(card, player) {
						return get.type(card) == "equip";
					},
					async precontent(event, trigger, player) {
						event.result.skill = "olfuzai";
					},
				};
			},
			prompt(links, player) {
				return "将一张装备牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		hiddenCard(player, name) {
			if (!["jiedao", "wuzhong"].includes(name)) {
				return false;
			}
			return player.countCards("he", card => get.type(card) == "equip") > 0;
		},
		mod: {
			cardEnabled(card, player) {
				if (["jiedao", "wuzhong"].includes(get.name(card))) {
					return;
				}
				const hs = player.getCards("he", card => get.type(card) == "equip");
				if (get.type(card) == "equip" && "cards" in card && Array.isArray(card.cards) && card.cards.containsSome(...hs)) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (["jiedao", "wuzhong"].includes(get.name(card))) {
					return;
				}
				const hs = player.getCards("he", card => get.type(card) == "equip");
				if (get.type(card) == "equip" && "cards" in card && Array.isArray(card.cards) && card.cards.containsSome(...hs)) {
					return false;
				}
			},
		},
		ai: {
			order: 8,
			result: {
				player: 1,
			},
		},
		intro: {
			content: "视为装备着：$",
		},
		onremove(player, skill) {
			//player.removeTip(skill);
			player.removeAdditionalSkill(skill);
			player.setStorage(skill, null, true);
		},
		group: "olfuzai_equip",
		subSkill: {
			equip: {
				audio: "olfuzai",
				trigger: {
					global: ["phaseBefore", "loseAfter", "loseAsyncAfter", "equipAfter", "addToExpansionAfter", "addJudgeAfter", "gainAfter"],
					player: ["enterGame", "expandEquipAfter", "disableEquipAfter", "enableEquipAfter", "changeHpAfter", "changeSkillsAfter"],
				},
				filter(event, player) {
					if (player.countCards("e")) {
						return player.getStorage("olfuzai").length;
					}
					if (event.name == "phase" && game.phaseNumber !== 0) {
						return false;
					}
					if (event.name == "changeSkills" && !event.addSkill?.includes("olfuzai")) {
						return false;
					}
					if (event.name.indexOf("Equip") > 0) {
						if (event.name == "disableEquip") {
							return player.getStorage("olfuzai").some(name => {
								const slot = get.subtype(name);
								return event.slots.includes(slot) && !player.hasEmptySlot(slot);
							});
						}
						return ["equip1", "equip2"].some(slot => {
							if (!event.slots.includes(slot) || !player.hasEmptySlot(slot)) {
								return false;
							}
							return !player.getStorage("olfuzai").some(name => get.subtype(name) == slot);
						});
					}
					if (event.name != "changeHp" && player.getStorage("olfuzai").length) {
						return false;
					}
					return player.hasEmptySlot(1) || player.hasEmptySlot(2);
				},
				forced: true,
				async content(event, trigger, player) {
					if (player.getStorage("olfuzai").length) {
						let list = [];
						if (trigger.name == "disableEquip") {
							list = player.getStorage("olfuzai").filter(name => {
								return player.hasEmptySlot(get.subtype(name));
							});
						}
						if (list.length) {
							player.setStorage("olfuzai", list, true);
							const skills = [];
							for (const name of list) {
								const info = lib.card[name];
								if (info?.skills && Array.isArray(info.skills)) {
									skills.addArray(info.skills);
								}
							}
							player.addExtraEquip(`olfuzai`, list, true);
							if (skills.length) {
								player.addAdditionalSkill("olfuzai", skills);
							}
							//player.addTip("olfuzai", list.map(name => `覆载 ${get.translation(name)}`).join("\n"));
						} else {
							player.removeExtraEquip("olfuzai");
							player.setStorage("olfuzai", [], true);
							player.removeAdditionalSkill("olfuzai");
							//player.removeTip("olfuzai");
						}
					}
					if (player.countCards("e")) {
						return;
					}
					const cards = [];
					const check = slot => {
						if (!player.hasEmptySlot(slot)) {
							return false;
						}
						return player.getStorage("olfuzai").every(name => get.subtype(name) != slot);
					};
					if (check("equip1")) {
						const equip1 = lib.inpile
							.filter(name => get.subtype(name) == "equip1")
							.concat(["qibaodao", "baipidao"])
							.randomSort();
						let card = equip1.find(name => {
							const info = lib.card[name];
							let range = 1;
							if (info?.distance?.attackFrom) {
								range -= info.distance.attackFrom;
							}
							return range == player.getHp();
						});
						if (!card) {
							card = equip1.randomGet();
						}
						cards.push(card);
					}
					if (check("equip2")) {
						const equip2 = lib.inpile.filter(name => get.subtype(name) == "equip2").randomSort();
						let card = equip2.find(name => {
							const num = get.cardNameLength(name);
							return num == player.getHp();
						});
						if (!card) {
							card = equip2.randomGet();
						}
						cards.push(card);
					}
					if (!cards.length) {
						return;
					}
					const skills = [];
					for (const name of cards) {
						const info = lib.card[name];
						if (info?.skills && Array.isArray(info.skills)) {
							skills.addArray(info.skills);
						}
					}
					player.addExtraEquip(`olfuzai`, cards, true);
					if (skills.length) {
						player.addAdditionalSkill("olfuzai", skills);
					}
					player.setStorage("olfuzai", cards, true);
					//player.addTip("olfuzai", cards.map(name => `覆载 ${get.translation(name)}`).join("\n"));
				},
				mod: {
					attackRangeBase(player) {
						const equips = player.getStorage("olfuzai");
						let range = 1;
						for (const card of equips) {
							const info = lib.card[card];
							if (info?.distance?.attackFrom) {
								range -= info.distance.attackFrom;
							}
						}
						return Math.max(player.getEquipRange(player.getCards("e")), range);
					},
				},
			},
		},
	},
	//谋戏子
	olsbxinchuan: {
		audio: 2,
		trigger: {
			global: "cardsDiscardAfter",
		},
		getSuits() {
			const suits = [];
			game.getGlobalHistory("cardMove", evt => {
				if (suits.length >= 4) {
					return;
				}
				if (evt.name == "lose") {
					if (evt.position == ui.discardPile) {
						for (let i of evt.cards) {
							if (get.position(i) == "d") {
								const suit = get.suit(i, false);
								if (suit && lib.suit.includes(suit)) {
									suits.add(suit);
								}
							}
						}
					}
				} else {
					if (evt.name == "cardsDiscard") {
						for (let i of evt.cards) {
							if (get.position(i) == "d") {
								const suit = get.suit(i, false);
								if (suit && lib.suit.includes(suit)) {
									suits.add(suit);
								}
							}
						}
					}
				}
			});
			return suits;
		},
		filter(event, player) {
			const evt = event.getParent();
			if (evt.name != "orderingDiscard") {
				return false;
			}
			const suits = get.info("olsbxinchuan").getSuits();
			if (suits.length >= 4) {
				return false;
			}
			const evtx = evt.relatedEvent || evt.getParent();
			return player.hasHistory("useCard", evtxx => {
				if (get.type2(evtxx.card) != "trick") {
					return false;
				}
				return evtx.getParent() == (evtxx.relatedEvent || evtxx.getParent());
			});
		},
		async cost(event, trigger, player) {
			const suits = get.info(event.skill).getSuits(),
				num = 4 - suits.length;
			let prompt = get.prompt2(event.skill).replaceAll("为本回合弃牌堆缺少的花色数", `目前为${num}`);
			/*let prompt = get.prompt2(event.skill).replaceAll("X次", `${get.cnNumber(num)}次`);
			prompt = `${prompt.slice(0, prompt.indexOf("（"))}${prompt.slice(prompt.indexOf("）") + 1)}`;*/
			event.result = await player
				.chooseTarget(prompt)
				.set("numx", num)
				.set("ai", target => {
					const { player, numx: num } = get.event();
					let list = [1, -1].map(key => Array.from(Array(num)).map(i => key)).flat(),
						current = target,
						map = new Map(),
						att = get.sgnAttitude(player, current),
						val = 0.4 * att;
					while (list.length) {
						let count = list.shift();
						map.set(current, (map.has(current) ? map.get(current) : 0) + count);
						val += att * count;
						if (current.countCards("h") + map.get(current) == current.getHp()) {
							current = current.getNext();
							att = get.sgnAttitude(player, current);
						}
					}
					return val;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const draw = async current => await current.draw(),
				discard = async current => {
					if (current.countDiscardableCards(current, "he")) {
						await current.chooseToDiscard("he", true);
					}
				};
			let num = 4 - get.info(event.name).getSuits().length,
				count = 0,
				current = event.targets[0];
			while (count < num) {
				if (!current) {
					break;
				}
				count++;
				await draw(current);
				if (current.countCards("h") == current.getHp()) {
					current = current.getNext();
					while (!current?.isIn()) {
						current = current.getNext();
					}
				}
				num = 4 - get.info(event.name).getSuits().length;
			}
			count = 0;
			while (count < num) {
				if (!current) {
					break;
				}
				count++;
				await discard(current);
				if (current.countCards("h") == current.getHp()) {
					current = current.getNext();
					while (!current?.isIn()) {
						current = current.getNext();
					}
				}
				num = 4 - get.info(event.name).getSuits().length;
			}
		},
	},
};
