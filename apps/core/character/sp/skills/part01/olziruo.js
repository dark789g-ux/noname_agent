import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olziruo" | "olxvfa">} */
export const groupSkills = {
	//蒋琬
	olziruo: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (!event.olziruo || !event.olziruo[player.playerid]) {
				return false;
			}
			return event.olziruo[player.playerid][player.storage.olziruo ? 1 : 0];
		},
		forced: true,
		async content(event, trigger, player) {
			player.changeZhuanhuanji("olziruo");
			await player.draw("nodelay");
		},
		mark: true,
		marktext: "☯",
		zhuanhuanji: true,
		intro: { content: storage => "当你使用最" + (storage ? "右" : "左") + "侧的卡牌时，你摸一张牌。你以此法摸牌后本回合不能整理手牌。" },
		global: "olziruo_mark",
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object") {
					const cards = player.getCards("h");
					if (cards.indexOf(card) == (player.storage.olziruo ? cards.length - 1 : 0)) {
						return num + 10;
					}
				}
			},
		},
		group: ["olziruo_gain", "olziruo_sort"],
		subSkill: {
			mark: {
				charlotte: true,
				trigger: { player: "useCardBegin" },
				filter(event, player) {
					const cards = player.getCards("h");
					if (!cards.length) {
						return false;
					}
					return (event.cards || []).some(card => cards[0] == card || cards[cards.length - 1] == card);
				},
				forced: true,
				popup: false,
				content() {
					const cards = player.getCards("h");
					if (!trigger.olziruo) {
						trigger.olziruo = {};
					}
					trigger.olziruo[player.playerid] = [trigger.cards.some(card => cards[0] == card), trigger.cards.some(card => cards[cards.length - 1] == card)];
				},
			},
			gain: {
				trigger: {
					player: "gainAfter",
				},
				filter(event, player) {
					if (player.hasSkill("olziruo_ban", null, null, false)) {
						return false;
					}
					return event.getParent().name == "draw" && event.getParent(2).name == "olziruo";
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.addTempSkill("olziruo_ban");
				},
			},
			ban: {
				charlotte: true,
				mark: true,
				intro: {
					content: "本回合不能整理手牌",
				},
				ai: { noSortCard: true },
			},
			sort: {
				enable: "chooseToUse",
				filter(event, player) {
					return player.countCards("h") > 1 && !player.hasSkillTag("noSortCard");
				},
				direct: true,
				lose: false,
				discard: false,
				delay: 0,
				prompt: "整理手牌顺序",
				async content(event, trigger, player) {
					event.getParent(2).goto(0);
					if (_status.connectMode || !event.isMine()) {
						player.tempBanSkill("olziruo_sort", { player: ["useCard1", "useSkillBegin", "chooseToUseEnd"] });
					}
					const next = player.chooseToMove("自若：请整理手牌顺序", true);
					next.set("list", [["手牌", player.getCards("h")]]);
					next.set("processAI", list => {
						let player = get.player(),
							cards = list[0][1].slice(0);
						cards.sort((a, b) => get.useful(b, player) - get.useful(a, player));
						if (player.storage.olziruo) {
							cards.reverse();
						}
						return [cards];
					});
					const result = await next.forResult();
					if (!result || !result.bool) {
						return;
					}
					let hs = result.moved[0].reverse();
					player.sortHandcardOL(hs);
				},
				ai: {
					order: 10,
					result: { player: 1 },
				},
			},
		},
	},
	olxvfa: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			const list = player.getStorage("olxvfa_used");
			return (!list.includes("0") && player.countCards("h")) || (!list.includes("1") && player.getExpansions("olxvfa").length);
		},
		chooseButton: {
			dialog(_, player) {
				let dialog = ui.create.dialog("蓄发：请选择一项", "hidden");
				const list = [
					["0", "将至少一半手牌称为“蓄发”置于武将牌上，然后可以将一张牌当作“蓄发”牌中的一张普通锦囊牌使用"],
					["1", "移去至少一半“蓄发”牌，然后可以将一张牌当作其中一张普通锦囊牌使用"],
				].filter(listx => {
					if (player.getStorage("olxvfa_used").includes(listx[0])) {
						return false;
					}
					if (listx[0] == "0") {
						return player.countCards("h");
					}
					return player.getExpansions("olxvfa").length;
				});
				dialog.add([list, "textbutton"]);
				if (list.length == 1) {
					dialog.direct = true;
				}
				return dialog;
			},
			filter(button, player) {
				if (player.getStorage("olxvfa_used").includes(button.link)) {
					return false;
				}
				if (button.link == "0") {
					return player.countCards("h");
				}
				return player.getExpansions("olxvfa").length;
			},
			check: () => 1 + Math.random(),
			backup: links => get.copy(lib.skill["olxvfa_" + ["put", "remove"][parseInt(links[0])]]),
			prompt(links) {
				if (links[0] == "0") {
					return "###蓄发###将至少一半手牌称为“蓄发”置于武将牌上，然后可以将一张牌当作“蓄发”牌中的一张普通锦囊牌使用";
				}
				return "###蓄发###移去一半“蓄发”牌，然后可以将一张牌当作其中一张普通锦囊牌使用";
			},
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		subSkill: {
			backup: {},
			used: { charlotte: true, onremove: true },
			put: {
				audio: "olxvfa",
				filterCard: true,
				selectCard: () => [Math.ceil(get.event().player.countCards("h") / 2), Infinity],
				position: "h",
				check(card) {
					const player = get.event().player,
						value = player.getUseValue(card, true);
					if (value > 0) {
						return get.type(card) == "trick" ? 20 + value : 0;
					}
					return 15 - get.value(card) - get.useful(card);
				},
				allowChooseAll: true,
				lose: false,
				discard: false,
				delay: 0,
				async content(event, trigger, player) {
					player.addTempSkill("olxvfa_used", "phaseUseAfter");
					player.markAuto("olxvfa_used", ["0"]);
					await player.addToExpansion(event.cards, player, "give").set("gaintag", ["olxvfa"]);
					const cards = player.getExpansions("olxvfa");
					if (cards.some(card => get.type(card) == "trick" && player.hasCard(cardx => player.hasUseTarget(get.autoViewAs({ name: card.name }, [cardx]), true), "hes"))) {
						const result = await player
							.chooseButton(['###蓄发###<div class="text center">是否将一张牌当作一张“蓄发”牌使用？</div>', cards])
							.set("filterButton", button => {
								const player = get.event().player,
									card = button.link;
								return get.type(card) == "trick" && player.hasCard(cardx => player.hasUseTarget(get.autoViewAs({ name: card.name }, [cardx]), true), "hes");
							})
							.set("ai", button => {
								const player = get.event().player,
									card = button.link;
								return player.getUseValue({ name: card.name, isCard: true }, true);
							})
							.forResult();
						if (result.bool) {
							const card = result.links[0];
							game.broadcastAll(function (card) {
								lib.skill.olxvfa_backupx.viewAs = { name: card.name };
							}, card);
							await player
								.chooseToUse()
								.set("openskilldialog", "###蓄发###将一张牌当作【" + get.translation(card.name) + "】使用")
								.set("norestore", true)
								.set("addCount", false)
								.set("_backupevent", "olxvfa_backupx")
								.set("custom", {
									add: {},
									replace: { window() {} },
								})
								.backup("olxvfa_backupx");
						}
					}
				},
			},
			remove: {
				audio: "olxvfa",
				filterCard: () => false,
				selectCard: -1,
				delay: 0,
				async content(event, trigger, player) {
					player.addTempSkill("olxvfa_used", "phaseUseAfter");
					player.markAuto("olxvfa_used", ["1"]);
					const cards = player.getExpansions("olxvfa"),
						num = Math.ceil(cards.length / 2);
					const result = await player
						.chooseButton(['###蓄发###<div class="text center">请移去至少' + get.cnNumber(num) + "张“蓄发”牌</div>", cards], [num, Infinity], true, "allowChooseAll")
						.set("ai", button => {
							const player = get.event().player,
								value = player.getUseValue(button.link, true);
							if (value > 0 && get.type(button.link) == "trick") {
								if (
									!ui.selected.buttons.some(but => {
										return get.type(but.link) == "trick" && player.getUseValue(but.link, true) > 0;
									})
								) {
									return 20 + value;
								}
								return 0;
							}
							return 1 / (get.useful(button.link) || 0.5);
						})
						.forResult();
					if (result.bool) {
						const cardx = result.links;
						await player.loseToDiscardpile(cardx);
						if (cardx.some(card => get.type(card) == "trick" && player.hasCard(cardxx => player.hasUseTarget(get.autoViewAs({ name: card.name }, [cardxx]), true), "hes"))) {
							const result2 = await player
								.chooseButton(['###蓄发###<div class="text center">是否将一张牌当作一张移去的“蓄发”牌使用？</div>', cardx])
								.set("filterButton", button => {
									const player = get.event().player,
										card = button.link;
									return get.type(card) == "trick" && player.hasCard(cardx => player.hasUseTarget(get.autoViewAs({ name: card.name }, [cardx]), true), "hes");
								})
								.set("ai", button => {
									const player = get.event().player,
										card = button.link;
									return player.getUseValue({ name: card.name, isCard: true }, true);
								})
								.forResult();
							if (result2.bool) {
								const card = result2.links[0];
								game.broadcastAll(function (card) {
									lib.skill.olxvfa_backupx.viewAs = { name: card.name };
								}, card);
								await player
									.chooseToUse()
									.set("openskilldialog", "###蓄发###将一张牌当作【" + get.translation(card.name) + "】使用")
									.set("norestore", true)
									.set("addCount", false)
									.set("_backupevent", "olxvfa_backupx")
									.set("custom", {
										add: {},
										replace: { window() {} },
									})
									.backup("olxvfa_backupx");
							}
						}
					}
				},
			},
			backupx: {
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				position: "hes",
				check(card) {
					const player = get.event().player;
					if (player.hasValueTarget(card, true, true)) {
						return 0;
					}
					if (player.hasSkill("olziruo")) {
						const cards = player.getCards("h");
						if (cards.indexOf(card) == (player.storage.olziruo ? cards.length - 1 : 0)) {
							return 15 - get.value(card);
						}
					}
					return 5 - get.value(card);
				},
				log: false,
			},
		},
		ai: {
			order: 1,
			result: { player: 1 },
		},
	},
};
