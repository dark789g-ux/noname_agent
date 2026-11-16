import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dchuashang" | "dcyuzhi">} */
export const groupSkills = {
	//崔令仪
	dchuashang: {
		createCard(type) {
			if (!_status.postReconnect.dchuashang) {
				_status.postReconnect.dchuashang = [
					function (list) {
						for (const type of list) {
							lib.skill.dchuashang.createCard(type);
						}
					},
					[],
				];
			}
			_status.postReconnect.dchuashang[1].add(type);
			if (!lib.card[`dchuashang_${type}`]) {
				lib.translate[`dchuashang_${type}`] = "华裳";
				const card = {
					derivation: "cuilingyi",
					fullskin: true,
					image: "image/card/cuilingyi_huashang.png",
					type,
					ai: { basic: { equipValue: 2 } },
					originalType: type,
					cardPrompt(card) {
						let str = `原本是一张${get.translation(this.originalType)}牌。`,
							subtypes = get.subtypes(card);
						if (subtypes?.length) {
							str = `${str.slice(0, -1)}，被置入了${subtypes.map(i => `${get.translation(i)}栏`).join("、")}。`;
						}
						return str;
					},
					async onLose(event, trigger, player) {
						// 神秘结算
						event.cards.forEach(card => {
							card.fix();
							ui.discardPile.appendChild(card);
							game.log(card, "被置入了弃牌堆");
						});
						if (event.getParent(2).name == "gain") {
							const remove = event.getParent(2).cards.filter(card => card[card.cardSymbol] == event.card);
							event.getParent(2).cards.removeArray(remove);
						}
					},
				};
				lib.translate[`dchuashang_${type}_info`] = `原本是一张${get.translation(type)}牌。`;
				lib.card[`dchuashang_${type}`] = card;
				game.finishCard(`dchuashang_${type}`);
			}
		},
		video(player, info) {
			for (const type of info[0]) {
				lib.skill.dchuashang.createCard(type);
			}
		},
		audio: 2,
		group: ["dchuashang_gaoda", "dchuashang_init"],
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			const suit = get.suit(event.card);
			return player.hasCards("h", card => get.suit(card, player) == suit && get.type(card, player) != "equip");
		},
		async cost(event, trigger, player) {
			const equips = [],
				suit = get.suit(trigger.card),
				cards = player.getCards("h", card => get.suit(card, player) == suit && get.type(card, player) != "equip");
			for (let i = 1; i < 6; i++) {
				if (!player.hasEquipableSlot(i)) {
					continue;
				}
				equips.push([i, get.translation("equip" + i)]);
			}
			if (!equips.length) {
				return;
			}
			const result = await player
				.chooseButton([`###${get.prompt(event.skill)}###<div class="text center">你可将一张相同花色的非装备手牌置入你的装备区</div>`, [equips, "tdnodes"], cards], 2)
				.set("filterButton", button => {
					if (ui.selected.buttons.length && typeof button.link == typeof ui.selected.buttons[0].link) {
						return false;
					}
					return true;
				})
				.set("ai", button => {
					const player = get.player(),
						suits = player
							.getCards("e")
							.map(card => get.suit(card))
							.unique(),
						suit = get.suit(get.event().getTrigger().card);
					if (typeof button.link == "number") {
						const card = player.getEquips(button.link);
						if (card) {
							const val = get.value(card);
							if (val > 0) {
								return 0;
							}
							return 5 - val;
						}
						switch (button.link) {
							case 3:
								return 4.5;
							case 4:
								return 4.4;
							case 5:
								return 4.3;
							case 2:
								return 3.1;
							case 1: {
								return 3.2;
							}
						}
					} else {
						if (suits.includes(suit)) {
							return 0;
						}
						return 7 - get.value(button.link);
					}
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				const links = result.links;
				if (typeof links[1] == "number") {
					links.reverse();
				}
				event.result = {
					bool: true,
					cost_data: {
						slot: links[0],
						card: links[1],
					},
				};
			}
		},
		async content(event, trigger, player) {
			const slot = event.cost_data.slot,
				card = event.cost_data.card;
			const type = get.type2(card);
			const list = [type];
			game.addVideo("skill", player, ["dchuashang", [list]]);
			game.broadcastAll(
				(player, list) => {
					for (const type of list) {
						lib.skill.dchuashang.createCard(type);
					}
				},
				player,
				list
			);
			const cardx = get.autoViewAs({ name: `dchuashang_${type}` }, [card]);
			cardx.subtypes = [`equip${slot}`];
			await player.equip(cardx);
		},
		mod: {
			targetInRange(card, player, target) {
				if (
					player
						.getCards("e")
						.map(i => get.color(i))
						.unique().length == 2
				) {
					return true;
				}
			},
		},
		locked: false,
		subSkill: {
			init: {
				audio: "dchuashang",
				forced: true,
				locked: false,
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				async content(event, trigger, player) {
					const colors = Object.keys(lib.color);
					for (const color of colors) {
						const card = get.cardPile(cardx => get.color(cardx) == color);
						if (card) {
							const choices = [];
							for (let i = 0; i <= 5; i++) {
								if (player.hasEmptySlot(i)) {
									choices.push(`equip${i}`);
								}
							}
							if (!choices.length) {
								break;
							}
							const slot = choices.randomGet();
							const type = get.type2(card);
							const list = [type];
							game.addVideo("skill", player, ["dchuashang", [list]]);
							game.broadcastAll(
								(player, list) => {
									for (const type of list) {
										lib.skill.dchuashang.createCard(type);
									}
								},
								player,
								list
							);
							const cardx = get.autoViewAs({ name: `dchuashang_${type}` }, [card]);
							cardx.subtypes = [slot];
							await player.equip(cardx);
						}
					}
				},
			},
			gaoda: {
				audio: "dchuashang",
				forced: true,
				locked: false,
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					const num = player
						.getCards("e")
						.map(card => get.suit(card))
						.unique().length;
					return player.countCards("h") < num;
				},
				async content(event, trigger, player) {
					const num = player
						.getCards("e")
						.map(card => get.suit(card))
						.unique().length;
					await player.drawTo(num);
				},
				ai: {
					noh: true,
					skillTagFilter(player, tag) {
						if (
							tag == "noh" &&
							player
								.getCards("e")
								.map(card => get.suit(card))
								.unique().length < player.countCards("h")
						) {
							return false;
						}
					},
				},
			},
		},
	},
	dcyuzhi: {
		audio: 2,
		forced: true,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			return event.card.name == "sha";
		},
		async content(event, trigger, player) {
			let result;
			const choices = [];
			if (!player.hasSkill("dcyuzhi_delete") && player.countDiscardableCards(player, "e")) {
				choices.push(`弃置一张装备区内的牌，于下次需要使用【闪】响应此【杀】时视为使用之并失去此选项至你的回合开始`);
			}
			choices.push(`此【杀】伤害+1`);
			if (choices.length == 1) {
				result = { index: 1 };
			} else {
				const directHit = trigger.getParent().directHit;
				result = await player
					.chooseControl()
					.set("choiceList", choices)
					.set("choice", !player.hasShan("use") || directHit === true || (Array.isArray(directHit) && directHit.includes(player)) ? 0 : 1)
					.forResult();
			}
			if (result?.index == 0) {
				player.addTempSkill("dcyuzhi_delete", { player: "phaseBeforeStart" });
				await player.chooseToDiscard("e", true);
				player
					.when("chooseToUseBegin")
					.filter((evt, player) => {
						if (evt.responded) {
							return false;
						}
						const card = get.autoViewAs({ name: "shan", isCard: true });
						if (!evt.filterCard(card, player, evt)) {
							return false;
						}
						return evt.respondTo[1] === trigger.card;
					})
					.step(async (event, trigger, player) => {
						trigger.result = {
							bool: true,
							card: { name: "shan", isCard: true },
						};
						trigger.untrigger();
						trigger.set("responded", true);
					});
			} else if (result?.index == 1) {
				game.log(trigger.card, "伤害+1");
				trigger.getParent().baseDamage++;
			}
		},
		ai: {
			neg: true,
		},
		subSkill: {
			delete: {
				charlotte: true,
			},
		},
	},
};
