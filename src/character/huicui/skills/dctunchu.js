import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dctunchu" | "dcshuliang" | "dcduanti" | "dcshicao">} */
export const groupSkills = {
	//李丰
	dctunchu: {
		audio: 2,
		trigger: { global: "gameDrawBegin" },
		forced: true,
		async content(event, trigger, player) {
			const me = player;
			const numx = trigger.num;
			const sum = game.players.slice().concat(game.dead).length * 4;
			trigger.num = player => (player == me ? sum : typeof numx == "function" ? numx(player) : numx);
		},
		mod: {
			cardDiscardable(card, player) {
				if (get.position(card) == "h") {
					return false;
				}
			},
			canBeDiscarded(card, player) {
				if (get.position(card) == "h") {
					return false;
				}
			},
			aiOrder(player, card, num) {
				if (num > 0 && get.name(card, player) == "huogong") {
					return 0;
				}
			},
			aiValue(player, card, num) {
				if (num > 0 && get.name(card, player) == "huogong") {
					return 0.01;
				}
			},
			aiUseful(player, card, num) {
				if (num > 0 && get.name(card, player) == "huogong") {
					return 0;
				}
			},
		},
		group: "dctunchu_limit",
		subSkill: {
			limit: {
				audio: "dctunchu",
				trigger: { player: "phaseZhunbeiBegin" },
				filter(event, player) {
					return player.countCards("h") > player.getHp();
				},
				forced: true,
				async content(event, trigger, player) {
					player.addTempSkill("dctunchu_debuff");
					player.addMark("dctunchu_debuff", 3, false);
				},
			},
			debuff: {
				mark: true,
				intro: {
					markcount(storage) {
						return (storage || 0).toString();
					},
					content(storage) {
						return "还可使用" + (storage || 0).toString() + "张牌";
					},
				},
				charlotte: true,
				onremove: true,
				trigger: { player: "useCard0" },
				filter(event, player) {
					return player.hasMark("dctunchu_debuff");
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					player.removeMark("dctunchu_debuff", 1, false);
				},
				mod: {
					cardEnabled(card, player) {
						if (player.hasMark("dctunchu_debuff")) {
							return;
						}
						if (get.itemtype(card) == "card" && get.position(card) == "h") {
							return false;
						}
						if (card.cards && (card.cards || []).some(i => get.position(i) == "h")) {
							return false;
						}
					},
					cardSavable() {
						return lib.skill.dctunchu.subSkill.debuff.mod.cardEnabled.apply(this, arguments);
					},
				},
			},
		},
	},
	dcshuliang: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return player.countCards("he") && game.hasPlayer(target => !target.countCards("h"));
		},
		async cost(event, trigger, player) {
			const num = Math.min(
				player.countCards("he"),
				game.countPlayer(target => !target.countCards("h"))
			);
			let list = [];
			while (num - list.length > 0) {
				const { bool, targets, cards } = await player
					.chooseCardTarget({
						prompt: list.length ? "是否继续发动【输粮】？" : get.prompt(event.skill),
						prompt2: lib.translate.dcshuliang_info,
						position: "he",
						animate: false,
						filterCard(card, player) {
							return !get.event().list.some(list => list[1] == card);
						},
						filterTarget(card, player, target) {
							return !target.countCards("h") && !get.event().list.some(list => list[0] == target);
						},
						ai1(card) {
							if (card.name == "du") {
								return 200;
							}
							let info = get.info(card);
							if (info && info.toself) {
								return 10;
							}
							return get.unuseful(card);
						},
						ai2(target) {
							const player = get.event().player,
								att = get.attitude(player, target);
							if (
								player.hasCard(card => {
									return card.name == "du" && !get.event().list.some(list => list[1] == card);
								}, "h") &&
								!target.countCards("h") &&
								!get.event().list.some(list => list[0] == target) &&
								!target.hasSkillTag("nodu")
							) {
								return -200 * att;
							}
							return att;
						},
					})
					.set("list", list)
					.forResult();
				if (bool) {
					list.push([targets[0], cards[0]]);
					player.addGaintag(cards, "olsujian_given");
				} else {
					break;
				}
			}
			event.result = {
				bool: Boolean(list.length),
				targets: list.slice().map(list => list[0]),
				cards: list.slice().flatMap(list => list[1]),
				cost_data: list,
			};
		},
		async content(event, trigger, player) {
			const list = event.cost_data;
			await game
				.loseAsync({
					gain_list: list,
					player: player,
					cards: event.cards,
					giver: player,
					animate: "giveAuto",
				})
				.setContent("gaincardMultiple");
			for (let i = 0; i < list.length; i++) {
				const target = event.targets[i],
					card = event.cards[i];
				if (get.owner(card) == target && get.position(card) == "h" && target.canUse(card, target)) {
					await target.chooseUseTarget(card);
				}
			}
		},
	},
	//吴普
	dcduanti: {
		audio: 2,
		trigger: {
			player: ["useCardAfter", "respondAfter"],
		},
		forced: true,
		filter(event, player) {
			return event._copdcduanti;
		},
		onremove: ["dcduanti", "dcduanti_counter"],
		group: "dcduanti_counter",
		async content(event, trigger, player) {
			await player.recover();
			if (player.countMark("dcduanti") >= 5) {
				return;
			}
			player.addMark("dcduanti", 1, false);
			await player.gainMaxHp();
		},
		subSkill: {
			counter: {
				trigger: {
					player: ["useCard1", "respond"],
				},
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (!player.countMark("dcduanti_counter")) {
						const num = game.getAllGlobalHistory("everything", evt => {
							return evt.player === player && ["useCard", "respond"].includes(evt.name) && evt !== trigger;
						}).length;
						if (num) {
							player.addMark("dcduanti_counter", num, false);
						}
					}
					player.addMark("dcduanti_counter", 1, false);
					if (player.countMark("dcduanti_counter") % 5 === 0) {
						trigger._copdcduanti = true;
					}
					player.markSkill("dcduanti");
				},
			},
		},
		intro: {
			markcount(storage, player) {
				return player.countMark("dcduanti_counter");
			},
			content(storage, player) {
				return `<li>已使用过${get.cnNumber(player.countMark("dcduanti_counter"))}张牌<br><li>已以此法增加${player.countMark("dcduanti")}点体力上限`;
			},
		},
	},
	dcshicao: {
		audio: 2,
		enable: "phaseUse",
		onremove: ["dcshicao_aiRecord"],
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("###识草###选择一种类型与要摸牌的来源", [["caoying_basic", "caoying_trick", "caoying_equip"], "vcard"], [["牌堆顶", "牌堆底"], "tdnodes"]);
			},
			check(button) {
				const player = get.player();
				const bottom = player.storage.dcshicao_bottom,
					aiStorage = player.getStorage("dcshicao_aiRecord");
				if (bottom && aiStorage.length > 0 && ui.cardPile.lastChild && get.name(ui.cardPile.lastChild, false) === get.name(aiStorage.lastItem, false)) {
					if (button.link === "牌堆底" || button.link[2].slice(8) === get.type2(aiStorage.lastItem, false)) {
						return 20;
					}
				}
				if (button.link === "牌堆顶" || button.link[2].slice(8) === "basic") {
					return 10;
				}
				return 5 + Math.random();
			},
			filter(button, player) {
				if (!ui.selected.buttons.length) {
					return true;
				}
				return ui.selected.buttons[0].parentNode != button.parentNode;
			},
			select: 2,
			backup(links, player) {
				if (links[0].includes("牌堆")) {
					links.reverse();
				}
				return {
					audio: "dcshicao",
					type: links[0][2].slice(8),
					pos: links[1],
					filterCard: () => false,
					selectCard: -1,
					async content(event, trigger, player) {
						let { type, pos } = lib.skill.dcshicao_backup;
						game.log(player, "声明了", `#y${get.translation(type)}牌`);
						const next = player.draw();
						const bottom = pos === "牌堆底";
						if (bottom) {
							next.set("bottom", true);
							if (player.getStorage("dcshicao_aiRecord").length > 0) {
								player.storage.dcshicao_aiRecord.pop();
							}
						}
						const drawnCards = (await next.forResult()).cards;
						if (get.type2(drawnCards[0], player) === type) {
							return;
						}
						let cards;
						if (!bottom) {
							cards = get.bottomCards(2);
							cards.reverse();
						} else {
							cards = get.cards(2);
						}
						await game.cardsGotoOrdering(cards);
						await player.viewCards(`${bottom ? "牌堆顶" : "牌堆底"}的两张牌(靠左的在牌堆更靠上)`, cards);
						player.storage.dcshicao_record = cards.slice();
						player.storage.dcshicao_aiRecord = cards.slice();
						player.storage.dcshicao_bottom = !bottom;
						const skill = "dcshicao";
						player.localMarkSkill(skill, player, event);
						if (bottom) {
							cards.reverse();
						}
						await game.cardsGotoPile(cards, bottom ? "insert" : null);
						player.tempBanSkill(skill);
					},
					ai: {
						result: { player: 1 },
					},
				};
			},
			prompt(links, player) {
				return `点击“确定”，从${links[1]}摸一张牌`;
			},
		},
		intro: {
			mark(dialog, content, player) {
				var cards = player.getStorage("dcshicao_record");
				if (cards && cards.length) {
					if (player.isUnderControl(true)) {
						dialog.addText(`上一次观看的${player.storage.dcshicao_bottom ? "牌堆底" : "牌堆顶"}的牌：`);
						dialog.addAuto(cards);
						dialog.addText("（牌堆顶——牌堆底）");
					} else {
						return "不给看";
					}
				}
			},
		},
		subSkill: {
			backup: {},
		},
		ai: {
			order: 8,
			result: {
				player: 1,
			},
		},
	},
};
