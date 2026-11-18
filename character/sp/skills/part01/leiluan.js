import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "leiluan" | "fuchao" | "olleiluan" | "olfuchao">} */
export const groupSkills = {
	//孔淑 —— by 刘巴
	leiluan: {
		audio: 2,
		onChooseToUse(event) {
			if (!game.online && !event.leiluan) {
				const player = event.player;
				let basic = lib.inpile.filter(i => get.type(i) == "basic");
				player.getRoundHistory("useCard", evt => {
					if (get.type(evt.card) == "basic") {
						basic.remove(evt.card.name);
					}
				});
				event.set("leiluan", [basic, lib.skill.leiluan.getNum()]);
			}
		},
		getNum() {
			return Math.max(
				1,
				game.countPlayer(current => current.isLinked())
			);
		},
		enable: "chooseToUse",
		filter(event, player) {
			if (!event.leiluan || player.countCards("hes") < event.leiluan[1] || event.type == "wuxie") {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2],
						type = get.type(name);
					return type == "basic" && event.leiluan[0].includes(name);
				})
				.some(card => {
					return event.filterCard({ name: card[2], nature: card[3] }, player, event);
				});
		},
		chooseButton: {
			dialog(event, player) {
				const list = get
					.inpileVCardList(info => {
						const name = info[2],
							type = get.type(name);
						return type == "basic" && event.leiluan[0].includes(name);
					})
					.filter(card => {
						return event.filterCard({ name: card[2], nature: card[3] }, player, event);
					});
				return ui.create.dialog("累卵", [list, "vcard"]);
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				return {
					audio: "leiluan",
					filterCard: true,
					selectCard: get.event().leiluan[1],
					check(card) {
						return 1 / (get.value(card) || 0.5);
					},
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					position: "hes",
					popname: true,
					allowChooseAll: true,
					async precontent(event, trigger, player) {
						player.addTempSkill("leiluan_effect");
					},
				};
			},
			prompt(links) {
				return "将" + get.cnNumber(get.event().leiluan[1]) + "张牌当作" + (get.translation(links[0][3]) || "") + "【" + get.translation(links[0][2]) + "】使用";
			},
		},
		hiddenCard(player, name) {
			if (player.getStat("skill").leiluan) {
				return false;
			}
			let basic = lib.inpile.filter(i => get.type(i) == "basic");
			player.getRoundHistory("useCard", evt => {
				if (get.type(evt.card) == "basic") {
					basic.remove(evt.card.name);
				}
			});
			const num = lib.skill.leiluan.getNum();
			return basic.includes(name) && player.countCards("hes") >= num;
		},
		ai: {
			order(item, player) {
				if (player && get.event().type == "phase") {
					let list = get
						.inpileVCardList(info => {
							return get.info("leiluan").hiddenCard(player, info[2]);
						})
						.map(card => {
							return { name: card[2], nature: card[3] };
						})
						.filter(card => player.getUseValue(card, true, true) > 0);
					if (!list.length) {
						return 0;
					}
					list.sort((a, b) => {
						return player.getUseValue(b, true, true) - player.getUseValue(a, true, true);
					});
					return get.order(list[0], player) * 1.01;
				}
				return 0.001;
			},
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond") {
					return false;
				}
				const name = tag == "respondSha" ? "sha" : "shan";
				return get.info("leiluan").hiddenCard(player, name);
			},
			result: {
				player: 1,
			},
		},
		subSkill: {
			backup: {},
			effect: {
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				charlotte: true,
				forced: true,
				locked: false,
				popup: false,
				filter(event, player) {
					if (event.getParent().skill !== "leiluan_backup" || player.countCards("h")) {
						return false;
					}
					const evt = event.getl(player);
					return evt && evt.player === player && evt.hs && evt.hs.length;
				},
				async content(event, trigger, player) {
					await player.draw(2);
					let cards = get.discarded().filter(c => get.type(c) === "trick");
					if (cards?.length) {
						const result = await player
							.chooseButton(["累卵：获得一张普通锦囊牌", cards], true)
							.set("ai", button => get.buttonValue(button))
							.forResult();
						if (result?.bool && result?.links?.length) {
							await player.gain(result.links, "gain2");
						}
					}
					player.tempBanSkill("leiluan", { player: "damageEnd" });
				},
			},
		},
	},
	fuchao: {
		audio: 2,
		trigger: {
			player: "useCardAfter",
			global: "roundEnd",
		},
		filter(event, player) {
			if (event.name == "useCard") {
				return _status.currentPhase?.isIn() && !_status.currentPhase.isLinked() && get.type(event.card) === "basic";
			}
			return true;
		},
		forced: true,
		logTarget(event, player) {
			if (event.name == "useCard") {
				return _status.currentPhase;
			}
			return game.filterPlayer(current => current.isLinked() || current === player).sortBySeat();
		},
		async content(event, trigger, player) {
			if (trigger.name === "useCard") {
				await _status.currentPhase.link(true);
			} else {
				await game.asyncDraw([player].concat(game.filterPlayer(current => current.isLinked()).sortBySeat()));
				if (game.hasPlayer(current => current.isLinked())) {
					const num = lib.skill.leiluan.getNum();
					for (const target of game.filterPlayer(current => current.isLinked()).sortBySeat()) {
						if (!target.isIn() || !target.countDiscardableCards(target, "he")) {
							continue;
						}
						await target.chooseToDiscard(num, "he", true);
					}
				}
			}
		},
	},
	olleiluan: {
		audio: "leiluan",
		onChooseToUse(event) {
			if (!game.online && !event.olleiluan) {
				const player = event.player;
				let basic = lib.inpile.filter(i => get.type(i) == "basic");
				player.getRoundHistory("useCard", evt => {
					if (get.type(evt.card) == "basic") {
						basic.remove(evt.card.name);
					}
				});
				event.set("olleiluan", [basic, lib.skill.olleiluan.getNum(player)]);
			}
		},
		getNum(player) {
			let i = 0,
				num = 0,
				keep = true;
			while (i < game.roundNumber) {
				if (player.getRoundHistory("useSkill", evt => evt.skill == "olleiluan_backup" || evt.skill == "olleiluan_effect", i).length > 0) {
					keep = false;
					num++;
				} else if (!keep) {
					break;
				}
				i++;
			}
			return Math.max(1, num);
		},
		enable: "chooseToUse",
		filter(event, player) {
			if (!event.olleiluan || player.countCards("hes") < event.olleiluan[1] || event.type == "wuxie") {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2],
						type = get.type(name);
					return type == "basic" && event.olleiluan[0].includes(name);
				})
				.some(card => {
					return event.filterCard({ name: card[2], nature: card[3] }, player, event);
				});
		},
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				const list = get
					.inpileVCardList(info => {
						const name = info[2],
							type = get.type(name);
						return type == "basic" && event.olleiluan[0].includes(name);
					})
					.filter(card => {
						return event.filterCard({ name: card[2], nature: card[3] }, player, event);
					});
				return ui.create.dialog("累卵", [list, "vcard"]);
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				return {
					audio: "leiluan",
					filterCard: true,
					selectCard: () => get.event().olleiluan[1],
					check(card) {
						return 1 / (get.value(card) || 0.5);
					},
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					position: "hes",
					popname: true,
				};
			},
			prompt(links) {
				return "将" + get.cnNumber(get.event().olleiluan[1]) + "张牌当作" + (get.translation(links[0][3]) || "") + "【" + get.translation(links[0][2]) + "】使用";
			},
		},
		hiddenCard(player, name) {
			if (player.getStat("skill").olleiluan) {
				return false;
			}
			let basic = lib.inpile.filter(i => get.type(i) == "basic");
			player.getRoundHistory("useCard", evt => {
				if (get.type(evt.card) == "basic") {
					basic.remove(evt.card.name);
				}
			});
			const num = lib.skill.olleiluan.getNum(player);
			return basic.includes(name) && player.countCards("he") >= num;
		},
		ai: {
			order(item, player) {
				if (player && get.event().type == "phase") {
					let list = get
						.inpileVCardList(info => {
							return get.info("olleiluan").hiddenCard(player, info[2]);
						})
						.map(card => {
							return { name: card[2], nature: card[3] };
						})
						.filter(card => player.getUseValue(card, true, true) > 0);
					if (!list.length) {
						return 0;
					}
					list.sort((a, b) => {
						return player.getUseValue(b, true, true) - player.getUseValue(a, true, true);
					});
					return get.order(list[0], player) * 1.01;
				}
				return 0.001;
			},
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond") {
					return false;
				}
				const name = tag == "respondSha" ? "sha" : "shan";
				return get.info("olleiluan").hiddenCard(player, name);
			},
			result: { player: 1 },
		},
		frequent: true,
		subfrequent: ["effect"],
		group: "olleiluan_effect",
		subSkill: {
			backup: {},
			effect: {
				audio: "olleiluan",
				trigger: { global: "roundEnd" },
				filter(event, player) {
					return player.getRoundHistory("useCard", evt => get.type(evt.card) == "basic").length >= lib.skill.olleiluan.getNum(player);
				},
				frequent: true,
				prompt2(event, player) {
					return "摸" + get.cnNumber(lib.skill.olleiluan.getNum(player)) + "张牌，然后视为使用一张本轮进入弃牌堆的普通锦囊牌";
				},
				async content(event, trigger, player) {
					await player.draw(lib.skill.olleiluan.getNum(player));
					let cards = [];
					const historys = _status.globalHistory;
					for (let i = historys.length - 1; i >= 0; i--) {
						const history = historys[i].everything;
						for (let j = history.length - 1; j >= 0; j--) {
							const evt = history[j];
							if (evt.name == "cardsDiscard" || (evt.name == "lose" && evt.position == ui.discardPile)) {
								cards.addArray(evt.cards.filterInD("d").reverse());
							}
						}
						if (historys[i].isRound) {
							break;
						}
					}
					cards.reverse();
					cards = cards.filter(card => get.type(card, false) == "trick" && player.hasUseTarget(card));
					if (cards.length) {
						const result = await player
							.chooseButton(["视为使用其中一张普通锦囊牌", cards], true)
							.set("ai", button => {
								const card = {
									name: get.name(button.link, false),
									nature: get.nature(button.link, false),
									suit: "none",
									number: null,
									isCard: true,
								};
								return get.player().getUseValue(card);
							})
							.forResult();
						if (result.bool) {
							const card = {
								name: get.name(result.links[0], false),
								nature: get.nature(result.links[0], false),
								suit: "none",
								number: null,
								isCard: true,
							};
							if (player.hasUseTarget(card)) {
								await player.chooseUseTarget(card, false, true);
							}
						}
					}
				},
			},
		},
	},
	olfuchao: {
		audio: "fuchao",
		trigger: { player: ["useCard", "respond"] },
		filter(event, player) {
			return Array.isArray(event.respondTo) && event.respondTo[0] != player;
		},
		forced: true,
		logTarget: event => event.respondTo[0],
		async content(event, trigger, player) {
			const evt = game.getGlobalHistory("useCard", evt => evt.card == trigger.respondTo[1])[0];
			let result;
			if (!player.countCards("he") && !evt.player.countCards("he")) {
				result = { index: 1 };
			} else {
				result = await player
					.chooseControl()
					.set("choiceList", ["弃置你与" + get.translation(evt.player) + "的各一张牌，然后其他角色不可响应此牌", "令" + get.translation(evt.card) + "对其他角色无效，然后" + get.translation(evt.card) + "对你额外结算一次"])
					.set("prompt", "覆巢：请选择一项")
					.set("ai", () => 0) //插眼，PZ157
					.forResult();
			}
			const targets = game.filterPlayer(i => i != player);
			if (result.index == 0) {
				await player.chooseToDiscard("he", true);
				await player.discardPlayerCard(evt.player, "he", true);
				if (targets.length) {
					evt.directHit.addArray(targets);
					game.log(targets, "不可响应", evt.card);
				}
			} else {
				evt.effectCount++;
				evt.excluded.addArray(targets);
				if (targets.length) {
					game.log(evt.card, "对", targets, "无效");
				}
			}
		},
	},
};
