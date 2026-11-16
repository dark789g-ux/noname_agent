import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanshixi" | "clanjianbai">} */
export const groupSkills = {
	// 族陆郁生
	clanshixi: {
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
		},
		onChooseToUse(event) {
			if (!game.online && !event.clanshixi) {
				const player = event.player;
				const storage = player.getStorage("clanshixi", {});
				const list = Object.entries(storage).filter(([suit, name]) => {
					if (!player.hasCards("he", card => get.suit(card, player) === suit)) {
						return false;
					}
					const card = get.autoViewAs({ name, isCard: true }, "unsure");
					if (!lib.skill.clanshixi.filterx(card) || !event.filterCard(card, player, event)) {
						return false;
					}
					return true;
				});
				event.set("clanshixi", list);
			}
		},
		hiddenCard(player, name) {
			const storage = player.getStorage("clanshixi", {});
			for (const [suit, cardName] of Object.entries(storage)) {
				if (cardName == name && player.hasCards("he", card => get.suit(card, player) === suit)) {
					return true;
				}
			}
			return false;
		},
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			return event.clanshixi?.length > 0;
		},
		filterx(card) {
			if (get.type(card, null, false) !== "trick") {
				return false;
			}
			const info = get.info(card, false);
			if (!info || info.notarget) {
				return false;
			}
			return info.toself || info.singleCard || !info.selectTarget || info.selectTarget == 1;
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.addNewRowList(player.getCards("he"), "suit", player);
				const storage = player.getStorage("clanshixi", {});
				const str = Object.entries(storage)
					.map(([suit, name]) => {
						return `${get.translation(suit)}：${get.translation(name)}`;
					})
					.join("；");
				const dialog = ui.create.dialog();
				dialog.add([
					[[`###拾昔###<div class="text center">将一种花色的所有牌置入弃牌堆视为使用对应花色记录的普通锦囊牌<br>当前花色及对应的牌：${str}</div>`], "addNewRow"],
					[
						dialog => {
							dialog.classList.add("fullheight");
							dialog.forcebutton = false;
							dialog._scrollset = false;
						},
						"handle",
					],
					list.map(item => [Array.isArray(item) ? item : [item], "addNewRow"]),
				]);
				dialog.direct = true;
				return dialog;
			},
			filter(button, player) {
				if (!button.links.length) {
					return false;
				}
				const evt = get.event().getParent();
				return evt.clanshixi.some(([suit, name]) => suit === button.link);
			},
			check(button) {
				const player = get.player();
				const evt = get.event().getParent();
				const { clanshixi } = evt;
				const name = clanshixi.find(([suit, name]) => suit === button.link)[1];
				if (button.links.length >= 3) {
					return 0;
				}
				if (evt.type != "phase") {
					return 1;
				}
				return get.player().getUseValue({ name: name });
			},
			backup(links, player) {
				return {
					audio: "clanshixi",
					suit: links[0],
					filterCard: { suit: links[0] },
					selectCard: -1,
					position: "he",
					popname: true,
					viewAs: {
						name: player.storage.clanshixi[links[0]],
						cards: [],
						isCard: true,
					},
					ignoreMod: true,
					log: false,
					async precontent(event, trigger, player) {
						player.logSkill("clanshixi");
						const cards = event.result.cards;
						await player.loseToDiscardpile(cards);
						const viewAs = new lib.element.VCard({ name: event.result.card.name, isCard: true });
						event.result.card = viewAs;
						event.result.cards = [];
					},
				};
			},
			prompt(links, player) {
				const suit = links[0];
				const cards = player.getCards("he", { suit });
				const card = { name: player.storage.clanshixi[suit] };
				return `###拾昔###将${get.translation(cards)}置入弃牌堆，视为使用【${get.translation(card)}】`;
			},
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
				if (!storage || Object.keys(storage).length === 0) {
					return "当前暂无记录";
				}
				let str = "已记录花色和牌名：<br>";
				for (const suit of lib.suit.slice()) {
					const name = storage[suit];
					if (name) {
						str += get.translation(suit) + "：" + get.poptip(name) + "<br>";
					}
				}
				return str;
			},
		},
		ai: {
			order(item, player) {
				const storage = player.getStorage("clanshixi", {});
				const list = Object.entries(storage)
					.filter(([suit, name]) => player.hasCards("he", card => get.suit(card, player) === suit))
					.map(([suit, name]) => {
						return { name };
					})
					.filter(card => player.getUseValue(card, true, true) > 0);
				if (!list.length) {
					return 0;
				}
				list.sort((a, b) => (player.getUseValue(b, true, true) || 0) - (player.getUseValue(a, true, true) || 0));
				return get.order(list[0], player) * 0.99;
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			mark: {
				init(player, skill) {
					const history = player.getAllHistory("useCard", evt => get.suit(evt.card) !== "none" && lib.skill.clanshixi.filterx(evt.card));
					if (history.length) {
						player.storage.clanshixi ??= {};
						const storage = player.storage.clanshixi;
						for (const evt of history) {
							if (Object.keys(storage).length == lib.suits.length) {
								break;
							}
							const card = evt.card;
							const suit = get.suit(card);
							const name = get.name(card);
							if (!(suit in storage)) {
								player.storage.clanshixi[suit] = name;
							}
						}
						player.markSkill("clanshixi");
					}
				},
				onremove(player, skill) {
					player.setStorage("clanshixi", null, true);
				},
				audio: "clanshixi",
				trigger: { player: "useCard1" },
				filter(event, player) {
					const card = event.card;
					if (!lib.skill.clanshixi.filterx(card)) {
						return false;
					}
					const suit = get.suit(card);
					if (suit === "none") {
						return false;
					}
					const storage = player.getStorage("clanshixi", {});
					return !(suit in storage);
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					const suit = get.suit(trigger.card);
					const name = trigger.card.name;
					player.storage.clanshixi ??= {};
					player.storage.clanshixi[suit] = name;
					player.markSkill("clanshixi");
					game.log(player, "记录了", "#y" + get.translation(name), "（" + get.translation(suit) + "）");
				},
			},
		},
	},
	clanjianbai: {
		audio: 2,
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
		},
		intro: {
			content: "已使用过的类别：$",
			onunmark: true,
		},
		trigger: { player: "useCardAfter" },
		forced: true,
		filter(event, player) {
			const type = get.type2(event.card);
			if (player.getHistory("useCard", evt => get.type2(evt.card) == type).indexOf(event) != 0) {
				return false;
			}
			return player.hasCards("he");
		},
		async content(event, trigger, player) {
			player.addTempSkill("clanjianbai_effect");
			const hs = player.getCards("he");
			const suits = [...new Set(hs.map(card => get.suit(card)))];
			if (suits.length === 0) {
				return;
			}
			const result =
				suits.length === 1
					? { control: suits[0] }
					: await player
							.chooseControl(lib.suits.slice().filter(suit => suits.includes(suit)))
							.set("prompt", "坚白：请选择要保留的花色")
							.set("ai", () => {
								const { player, suits } = get.event();
								let max = -1;
								let best = suits[0];
								for (const suit of suits) {
									const cards = player.getCards("he", card => get.suit(card) === suit);
									let value = cards.reduce((sum, card) => sum + get.value(card), 0);
									if (value > max) {
										max = value;
										best = suit;
									}
								}
								return best;
							})
							.set("suits", suits)
							.forResult();
			const keepSuit = result?.control;
			if (!keepSuit) {
				return;
			}
			player.popup(keepSuit);
			game.log(player, "选择了", "#g" + get.translation(keepSuit));
			const keepCards = player.getCards("he", card => get.suit(card) === keepSuit);
			for (const card of keepCards) {
				const skill = "clanjianbai_effect";
				let tag = card.gaintag?.find(tag => tag.startsWith(skill));
				if (tag) {
					player.removeGaintag(tag, [card]);
					tag = skill + (parseInt(tag.slice(skill.length)) + 1);
				} else {
					tag = skill + "1";
				}
				game.addTempTag(tag, `坚白+${tag.slice(skill.length)}`);
				player.addGaintag([card], tag);
			}
			const rescastCards = player.getCards("he", card => get.suit(card) !== keepSuit && player.canRecast(card));
			if (rescastCards.length > 0) {
				await player.recast(rescastCards);
			}
		},
		subSkill: {
			mark: {
				charlotte: true,
				init(player, skill) {
					const types = player
						.getHistory("useCard")
						.map(evt => get.type2(evt.card))
						.toUniqued();
					if (types.length) {
						player.markAuto("clanjianbai", types);
					}
				},
				onremove(player, skill) {
					player.setStorage("clanjianbai", null, true);
				},
				trigger: { player: "useCard1", global: "phaseAfter" },
				filter(event, player) {
					if (event.name == "phase") {
						return true;
					}
					const type = get.type2(event.card);
					return !player.getStorage("clanjianbai").includes(type);
				},
				forced: true,
				silent: true,
				async content(event, trigger, player) {
					if (trigger.name == "phase") {
						player.setStorage("clanjianbai", null, true);
					} else {
						const type = get.type2(trigger.card);
						player.markAuto("clanjianbai", [type]);
					}
				},
			},
			effect: {
				audio: "clanjianbai",
				charlotte: true,
				onremove(player, skill) {
					let tags = player.getCards("h", card => card.gaintag?.some(tag => tag.startsWith(skill)));
					if (tags.length) {
						tags = tags
							.slice()
							.map(card => card.gaintag.find(tag => tag.startsWith(skill)))
							.unique();
						tags.forEach(tag => player.removeGaintag(tag));
					}
				},
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					return player.hasCards("he") && game.hasPlayer(current => current != player);
				},
				direct: true,
				forced: true,
				async content(event, trigger, player) {
					if (player.hasCards("he") && player.hasCards("he") && game.hasPlayer(current => current != player)) {
						const result = await player
							.chooseCardTarget({
								prompt: "坚白：交给一名其他角色一张牌",
								position: "he",
								selectCard: 1,
								filterTarget: lib.filter.notMe,
								forced: true,
								ai1(card) {
									let tag = card.gaintag?.find(tag => tag.startsWith("clanjianbai_effect"));
									let count = 0;
									if (tag) {
										count = parseInt(tag.slice("clanjianbai_effect".length)) || 0;
									}
									return 5 - get.value(card) + count * 10;
								},
								ai2(target) {
									return get.attitude(get.player(), target);
								},
							})
							.forResult();
						if (result?.bool && result.cards?.length && result.targets?.length) {
							const {
								targets: [target],
								cards,
							} = result;
							const giveCard = cards[0];
							let count = 0;
							const tag = giveCard.gaintag?.find(tag => tag.startsWith(event.name));
							if (tag) {
								count = parseInt(tag.slice(event.name.length)) || 0;
							}
							player.logSkill(event.name, target);
							await player.give(cards, target);
							if (count > 0) {
								await player.draw(count);
							}
						}
					}
				},
			},
		},
	},
};
