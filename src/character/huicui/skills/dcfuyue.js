import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcfuyue" | "dcwenlan">} */
export const groupSkills = {
	//乐曹植
	dcfuyue: {
		mod: {
			ignoredHandcard(card, player) {
				if (card.hasGaintag("dcfuyue_tag")) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name === "phaseDiscard" && card.hasGaintag("dcfuyue_tag")) {
					return false;
				}
			},
		},
		audio: 2,
		enable: ["chooseToUse"],
		hiddenCard(player, name) {
			const fuCards = player.getCards("hes", card => card.hasGaintag("dcfuyue_tag") && card.storage?.dcfuyue_name);
			return fuCards.some(card => card.storage.dcfuyue_name === name);
		},
		filter(event, player) {
			const fuCards = player.getCards("hes", card => card.hasGaintag("dcfuyue_tag") && card.storage?.dcfuyue_name);
			if (fuCards.length === 0) {
				return false;
			}
			for (const card of fuCards) {
				const cardName = card.storage.dcfuyue_name;
				const vcard = get.autoViewAs({ name: cardName }, card);
				if (event.filterCard(vcard, player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				const fuCards = player.getCards("hes", card => card.hasGaintag("dcfuyue_tag") && card.storage?.dcfuyue_name);
				const list = get.inpileVCardList(([type, _, name]) => {
					return fuCards.some(card => card.storage.dcfuyue_name == name);
				});
				return ui.create.dialog("赋乐：选择要使用的牌名", [list, "vcard"]);
			},
			filter(button, player) {
				const evt = get.event().getParent();
				const name = button.link[2];
				if (!evt?.name) {
					return false;
				}
				return evt.filterCard(get.autoViewAs({ name }, "unsure"), player, evt);
			},
			check(button) {
				const player = get.player(),
					name = button.link[2];
				return player.getUseValue(get.autoViewAs({ name }, "unsure")) + 0.1;
			},
			backup(links, player) {
				const cardName = links[0][2];
				return {
					audio: "dcfuyue",
					cardName: cardName,
					viewAs(cards) {
						return { name: lib.skill.dcfuyue_backup.cardName };
					},
					position: "hs",
					selectCard: 1,
					filterCard(card, player) {
						return card.hasGaintag("dcfuyue_tag") && card.storage?.dcfuyue_name === lib.skill.dcfuyue_backup.cardName;
					},
					popname: true,
				};
			},
			prompt(links, player) {
				const cardName = links[0][2];
				return `选择${get.translation(cardName)}的目标`;
			},
		},
		fuCardPool: ["sha", "shan", "tao", "jiu", "shunshou", "guohe", "wuxie", "wuzhong", "nanman", "wanjian", "huogong", "juedou", "jiedao", "taoyuan", "wugu", "tiesuo", "lebu", "bingliang", "shandian"],
		markAsFu: card => {
			const randomName = get
				.info("dcfuyue")
				.fuCardPool.filter(name => ![card.name, card.storage?.dcfuyue_name].includes(name))
				.randomGet();
			card.removeGaintag("dcfuyue_tag");
			card.removeGaintag(`赋(${get.translation(card.storage.dcfuyue_name)})`);
			game.broadcastAll(
				(card, name) => {
					card.storage ??= {};
					card.storage.dcfuyue_name = name;
				},
				card,
				randomName
			);
			card.addGaintag("dcfuyue_tag");
			card.addGaintag(`赋(${get.translation(card.storage.dcfuyue_name)})`);
		},
		group: ["dcfuyue_start"],
		subSkill: {
			start: {
				audio: "dcfuyue",
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name !== "phase" || game.phaseNumber === 0;
				},
				forced: true,
				locked: true,
				async content(event, trigger, player) {
					const { markAsFu } = get.info("dcfuyue");
					const cards = player.getCards("h");
					for (const card of cards) {
						if (!card.hasGaintag("dcfuyue_tag")) {
							markAsFu(card);
						}
					}
				},
			},
		},
		ai: {
			threaten: 1.5,
			order: 11,
			result: { player: 1 },
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag) {
				const fuCards = player.getCards("hes", card => card.hasGaintag("dcfuyue_tag") && card.storage?.dcfuyue_name);
				let name;
				if (tag === "respondSha") {
					name = "sha";
				} else if (tag === "respondShan") {
					name = "shan";
				} else {
					return false;
				}
				return fuCards.some(card => card.storage.dcfuyue_name === name);
			},
		},
	},
	dcwenlan: {
		audio: 2,
		marktext: "澜",
		intro: {
			name: "文澜记录",
			mark(dialog, storage) {
				if (!storage?.length) {
					dialog.addText("暂无记录");
					return;
				}
				for (let index in storage) {
					const card = storage[index];
					const realName = get.translation(card);
					if (card.storage?.dcfuyue_name) {
						const fuName = get.translation(card.storage?.dcfuyue_name) || "未知";
						dialog.addText(`倒数第${get.cnNumber(Number(index) + 1, true)}张牌：${realName} / ${fuName}`);
					} else {
						dialog.addText(`倒数第${get.cnNumber(Number(index) + 1, true)}张牌：${realName}`);
					}
				}
			},
		},
		trigger: {
			player: ["useCardAfter", "respondAfter"],
		},
		getIndex(event, player) {
			const storage = player.getStorage("dcwenlan").toReversed();
			const result = [];
			const currCard = event.cards?.[0] || event.card;
			storage.unshift(currCard);
			storage.unique();
			while (storage.length) {
				let cards = storage.slice(0, 2);
				storage.removeArray(cards);
				result.push(cards);
			}
			return result;
		},
		filter(event, player, name, info) {
			return info?.length > 1;
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.dcwenlan = true;
			const { fuCardPool, markAsFu } = get.info("dcfuyue");
			const storage = player.getStorage("dcwenlan");
			storage.removeArray(event.indexedData);
			const [currCard, prevCard] = event.indexedData;
			const prevIsFu = prevCard?.storage?.dcfuyue_name;
			const currIsFu = currCard?.storage?.dcfuyue_name;
			player.setStorage("dcwenlan", storage, true);
			let obtainedFromPile = false;
			if (prevIsFu && currIsFu) {
				const names = [prevCard.name, prevIsFu, currCard.name, currIsFu].filter(i => i);
				const allNames = [...new Set(names)];
				if (allNames.length < names.length) {
					const obtained = [];
					for (const name of allNames) {
						const card = get.cardPile2(card => card.name == name);
						if (card) {
							markAsFu(card);
							obtained.push(card);
						}
					}
					if (obtained.length > 0) {
						await player.gain({
							cards: obtained,
							animate: "gain2",
						});
						obtainedFromPile = true;
					}
				}
			}
			if (!obtainedFromPile) {
				if (!player.hasCards("h")) {
					return;
				}
				const cardResult = await player
					.chooseCard({
						prompt: `文澜：选择任意张手牌标记为“赋”或替换“赋”牌名`,
						position: "h",
						selectCard: [1, Infinity],
						allowChooseAll: true,
					})
					.set("ai", card => 5 - get.value(card))
					.forResult();
				if (cardResult?.bool && cardResult.cards?.length) {
					for (const card of cardResult.cards) {
						markAsFu(card);
					}
				}
			}
		},
		ai: {
			combo: "dcfuyue",
			threaten: 1.2,
		},
		group: ["dcwenlan_record"],
		subSkill: {
			record: {
				firstDo: true,
				charlotte: true,
				trigger: {
					player: ["useCardAfter", "respondAfter"],
				},
				filter(event) {
					return !event.dcwenlan;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					let card = trigger.cards?.[0] || trigger.card;
					player.markAuto("dcwenlan", [card]);
				},
			},
		},
	},
};
