import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcyunzheng" | "dchuoxin" | "dcjigu" | "dcsirui">} */
export const groupSkills = {
	//乐邹氏
	dcyunzheng: {
		audio: 2,
		init() {
			game.addGlobalSkill("dcyunzheng_global");
		},
		onremove() {
			if (!game.hasPlayer(i => i.hasSkill("dcyunzheng", null, null, false), true)) {
				game.removeGlobalSkill("dcyunzheng_global");
			}
		},
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			const cards = player.getCards("h");
			player.addGaintag(cards, "eternal_dcyunzheng_tag");
		},
		mod: {
			ignoredHandcard(card) {
				if (card.hasGaintag("eternal_dcyunzheng_tag")) {
					return true;
				}
			},
			cardDiscardable(card, _, name) {
				if (name == "phaseDiscard" && card.hasGaintag("eternal_dcyunzheng_tag")) {
					return false;
				}
			},
		},
		group: "dcyunzheng_fengyin",
		subSkill: {
			fengyin: {
				audio: "dcyunzheng",
				trigger: {
					global: ["phaseBefore", "loseAfter", "loseAsyncAfter", "gainAfter", "equipAfter", "addJudgeAfter", "addToExpansionAfter"],
					player: ["dchuoxin_update", "enterGame"],
				},
				filter(event, player) {
					if (
						["lose", "loseAsync", "equip", "addJudge", "addToExpansion"].includes(event.name) &&
						!game.hasPlayer(target => {
							const evt = event.getl(target);
							return evt && (evt.hs || []).length;
						})
					) {
						return false;
					}
					return game.hasPlayer(target => {
						if (player === target) {
							return false;
						}
						return target.hasCard(card => card.hasGaintag("eternal_dcyunzheng_tag"), "h") == !target.hasSkill("dcyunzheng_block");
					});
				},
				logTarget(event, player) {
					return game
						.filterPlayer(target => {
							if (player === target) {
								return false;
							}
							return target.hasCard(card => card.hasGaintag("eternal_dcyunzheng_tag"), "h") == !target.hasSkill("dcyunzheng_block");
						})
						.sortBySeat();
				},
				forced: true,
				async content(event, trigger, player) {
					const targets = game
						.filterPlayer(target => {
							if (player === target) {
								return false;
							}
							return target.hasCard(card => card.hasGaintag("eternal_dcyunzheng_tag"), "h") == !target.hasSkill("dcyunzheng_block");
						})
						.sortBySeat();
					for (const target of targets) {
						target[target.hasSkill("dcyunzheng_block") ? "removeSkill" : "addSkill"]("dcyunzheng_block");
					}
				},
			},
			global: {
				mod: {
					aiValue(player, card, num) {
						if (num <= 0 || get.itemtype(card) !== "card" || !card.hasGaintag("eternal_dcyunzheng_tag")) {
							return;
						}
						if (player.hasSkill("dcyunzheng")) {
							return num * 1.2;
						}
						return num / 10;
					},
					aiUseful(player, card, num) {
						if (num <= 0 || get.itemtype(card) !== "card" || !card.hasGaintag("eternal_dcyunzheng_tag")) {
							return;
						}
						if (player.hasSkill("dcyunzheng")) {
							return num * 1.2;
						}
						return num / 10;
					},
					aiOrder(player, card, num) {
						if (num <= 0 || get.itemtype(card) !== "card" || !card.hasGaintag("eternal_dcyunzheng_tag")) {
							return;
						}
						if (player.hasSkill("dcyunzheng")) {
							return num * 0.8;
						}
						return num * 10;
					},
				},
				trigger: {
					player: "dieAfter",
				},
				filter(event, player) {
					return !game.hasPlayer(cur => cur.hasSkill("dcyunzheng", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				async content(event, trigger, player) {
					game.removeGlobalSkill("dcyunzheng_gloabl");
					game.countPlayer(cur => cur.removeSkill("dcyunzheng_block"));
				},
			},
			block: {
				inherit: "fengyin",
			},
		},
	},
	dchuoxin: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			return (
				get.type(event.card) !== "equip" &&
				game.hasPlayer(current => {
					return player !== current && current.countCards("h");
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget(card, player, target) {
						return player !== target && target.countCards("h") > 0;
					},
					ai(target) {
						let att = get.attitude(get.player(), target);
						if (att > 0) {
							return 0;
						}
						if (!target.hasSkill("dcyunzheng_block")) {
							att *=
								target.getSkills(null, false, false).filter(i => {
									return lib.skill.dcyunzheng_block.skillBlocker(i, target);
								}).length + 1;
						}
						return 1 - att;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await player
				.choosePlayerCard({
					prompt: "惑心：展示" + get.translation(target) + "的一张手牌",
					position: "h",
					target,
					forced: true,
				})
				.forResult();
			const tag = "eternal_dcyunzheng_tag";
			if (result.bool) {
				let cards = result.cards.slice();
				await player.showCards(cards, get.translation(player) + "发动了【惑心】");
				const cardx = cards.filter(card => card.hasGaintag(tag) || get.suit(card) == get.suit(trigger.card));
				if (cards.some(card => !card.hasGaintag(tag))) {
					target.addGaintag(
						cards.filter(card => !card.hasGaintag(tag)),
						"eternal_dcyunzheng_tag"
					);
					await event.trigger("dchuoxin_update");
				}
				if (cardx.length) {
					const result2 = await player
						.chooseBool({
							prompt: "惑心：是否获得" + get.translation(cardx) + "？",
							choice: get.value(cardx, player) > 7,
						})
						.forResult();
					if (result2.bool) {
						await player.gain({
							cards: cardx,
							source: target,
							animate: "give",
						});
						/*if (cardx[0].hasGaintag("eternal_dcyunzheng_tag")) {
							next.gaintag.add("eternal_dcyunzheng_tag");
						}*/
						//await event.trigger("dchuoxin_update");
					}
					cards.removeArray(cardx);
				}
			}
		},
	},
	//乐祢衡
	dcjigu: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			const cards = player.getCards("h");
			player.addGaintag(cards, "dcjigu");
		},
		mod: {
			ignoredHandcard(card) {
				if (card.hasGaintag("dcjigu")) {
					return true;
				}
			},
			cardDiscardable(card, _, name) {
				if (name == "phaseDiscard" && card.hasGaintag("dcjigu")) {
					return false;
				}
			},
		},
		group: "dcjigu_temp",
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			temp: {
				audio: "dcjigu",
				trigger: {
					player: "damageEnd",
					source: "damageSource",
				},
				filter(event, player) {
					return player.countCards("e") == player.countCards("h", card => card.hasGaintag("dcjigu"));
				},
				forced: true,
				prompt2(event, player) {
					return (
						"摸" +
						get.cnNumber(
							Array.from({ length: 5 })
								.map((_, i) => i + 1)
								.reduce((sum, i) => sum + player.countEmptySlot(i), 0)
						) +
						"张牌"
					);
				},
				async content(event, trigger, player) {
					player.addTempSkill("dcjigu_used", { global: "roundStart" });
					player.addMark("dcjigu_used", 1, false);
					await player.draw(
						Array.from({ length: 5 })
							.map((_, i) => i + 1)
							.reduce((sum, i) => sum + player.countEmptySlot(i), 0)
					);
					let num1 = player.countMark("dcjigu_used");
					let num2 = game.countPlayer2(current => {
						return current.actionHistory.some(i => i.isMe && !i.isSkipped);
					});
					if (num1 >= num2) {
						player.tempBanSkill(event.name, "roundStart");
					}
				},
			},
		},
	},
	dcsirui: {
		audio: 2,
		mod: {
			targetInRange(card) {
				if (card.storage && card.storage.dcsirui) {
					return true;
				}
			},
			cardUsable(card, player, num) {
				if (card.storage && card.storage.dcsirui) {
					return Infinity;
				}
			},
		},
		enable: "phaseUse",
		filter(event, player) {
			if (!player.countCards("hes")) {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2];
					if (get.type(name) != "basic" && get.type(name) != "trick") {
						return false;
					}
					return true;
				})
				.some(card => player.hasCard(cardx => get.cardNameLength(cardx) == get.cardNameLength(card[2]) && player.hasUseTarget(get.autoViewAs({ name: card[2], nature: card[3], storage: { dcsirui: true } }, [cardx]), false, false), "hes"));
		},
		usable: 1,
		locked: false,
		chooseButton: {
			dialog(event, player) {
				const list = get
					.inpileVCardList(info => {
						const name = info[2];
						if (get.type(name) != "basic" && get.type(name) != "trick") {
							return false;
						}
						return true;
					})
					.filter(card => player.hasCard(cardx => get.cardNameLength(cardx) == get.cardNameLength(card[2]) && player.hasUseTarget(get.autoViewAs({ name: card[2], nature: card[3], storage: { dcsirui: true } }, [cardx]), false, false), "hes"));
				return ui.create.dialog("思锐", [list, "vcard"]);
			},
			check(button) {
				return get.event().player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
					storage: { dcsirui: true },
				});
			},
			backup(links, player) {
				return {
					audio: "dcsirui",
					filterCard(card, player) {
						return get.cardNameLength(card) == get.cardNameLength(lib.skill.dcsirui_backup.viewAs.name);
					},
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						storage: { dcsirui: true },
					},
					check(card) {
						return 7 - get.value(card);
					},
					position: "hes",
					async precontent(event, trigger, player) {
						event.getParent().addCount = false;
					},
				};
			},
			prompt(links, player) {
				return "将一张字数为" + get.cardNameLength(links[0][2]) + "的牌当作" + get.translation(links[0][3] || "") + "【" + get.translation(links[0][2]) + "】使用";
			},
		},
		ai: {
			order(item, player) {
				let list = get
					.inpileVCardList(info => {
						const name = info[2];
						if (get.type(name) != "basic" && get.type(name) != "trick") {
							return false;
						}
						return true;
					})
					.filter(card => player.hasCard(cardx => get.cardNameLength(cardx) == get.cardNameLength(card[2]) && player.hasUseTarget(get.autoViewAs({ name: card[2], nature: card[3] }, [cardx]), false, false), "hes"))
					.map(card => {
						return { name: card[2], nature: card[3] };
					})
					.filter(card => player.getUseValue(card, true, true) > 0);
				if (!list.length) {
					return 0;
				}
				list.sort((a, b) => (player.getUseValue(b, true, true) || 0) - (player.getUseValue(a, true, true) || 0));
				return get.order(list[0], player) * 0.99;
			},
			result: { player: 1 },
		},
		subSkill: {
			backup: { audio: "dcsirui" },
		},
	},
};
