import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcliangxiu" | "dcxunjie" | "dcjiaowei" | "dcfeibai" | "dccaisi" | "dczhuoli">} */
export const groupSkills = {
	//蒯祺
	dcliangxiu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => {
				const type = get.type2(card, player);
				return player.hasCard(cardx => {
					if (card == cardx) {
						return false;
					}
					return get.type2(cardx, player) != type;
				}, "he");
			}, "he");
		},
		filterCard(card, player) {
			if (!ui.selected.cards.length) {
				return true;
			}
			return get.type2(ui.selected.cards[0], player) != get.type2(card, player);
		},
		selectCard: 2,
		check(card) {
			const player = get.player();
			const bannedTypes = [];
			bannedTypes.addArray(player.getStorage("dcliangxiu"));
			if (!ui.selected.cards.length) {
				let val = get.value(card);
				if (val > 5.5) {
					return 0;
				}
				if (bannedTypes.includes(get.type2(card, player))) {
					return 7.5 - val;
				}
				return 5.5 - val;
			}
			bannedTypes.addArray(ui.selected.cards.map(card => get.type2(card, player)));
			bannedTypes.add(get.type2(card, player));
			const filter = card => !bannedTypes.includes(get.type2(card, player));
			if (!get.cardPile(filter)) {
				return 0;
			}
			return 6 - get.value(card);
		},
		position: "he",
		complexCard: true,
		onremove: true,
		async content(event, trigger, player) {
			let cards = [];
			const bannedTypes = [];
			bannedTypes.addArray(event.cards.map(card => get.type2(card, player)));
			bannedTypes.addArray(player.getStorage("dcliangxiu"));

			const filter = card => !bannedTypes.includes(get.type2(card, player));
			const piles = ["cardPile", "discardPile"];
			for (const pile of piles) {
				for (let i = 0; i < ui[pile].childNodes.length; i++) {
					const card = ui[pile].childNodes[i];
					if (filter(card)) {
						cards.add(card);
						if (cards.length >= 2) {
							break;
						}
					}
				}
				if (cards.length >= 2) {
					break;
				}
			}
			if (!cards.length) {
				player.chat("没牌了…");
				game.log("但是哪里都找不到没有符合条件的牌！");
				return;
			}
			player.markAuto("dcliangxiu", cards.map(card => get.type2(card, false)).toUniqued());
			player.when({ global: "phaseChange" }).step(async () => {
				player.unmarkSkill("dcliangxiu");
			});
			if (_status.connectMode) {
				game.broadcastAll(() => (_status.noclearcountdown = true));
			}
			let given_map = {};
			while (cards.length) {
				let result;
				if (cards.length == 1) {
					result = { bool: true, links: cards.slice() };
				} else {
					result = await player
						.chooseCardButton("良秀：请选择要分配的牌", cards, [1, cards.length], true)
						.set("ai", button => {
							if (!ui.selected.buttons.length) {
								return get.buttonValue(button);
							}
							return 0;
						})
						.forResult();
				}
				const gives = result.links;
				const result2 = await player
					.chooseTarget("选择获得" + get.translation(gives) + "的角色", cards.length == 1)
					.set("ai", target => {
						return get.attitude(get.event().player, target) * get.sgn(get.sgn(get.event().goon) + 0.5);
					})
					.set(
						"goon",
						gives.reduce((sum, card) => sum + get.value(card), 0)
					)
					.forResult();
				if (result2.bool) {
					cards.removeArray(gives);
					const id = result2.targets[0].playerid;
					if (!given_map[id]) {
						given_map[id] = [];
					}
					given_map[id].addArray(gives);
				}
			}
			if (_status.connectMode) {
				game.broadcastAll(() => delete _status.noclearcountdown);
			}
			let list = [];
			for (const i in given_map) {
				const source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				player.line(source, "green");
				game.log(source, "获得了", given_map[i]);
				list.push([source, given_map[i]]);
			}
			await game
				.loseAsync({
					gain_list: list,
					giver: player,
					animate: "gain2",
				})
				.setContent("gaincardMultiple");
			game.delayx();
		},
		intro: {
			content: "已因此技能获得过$牌",
			onunmark: true,
		},
		ai: {
			order: 2,
			result: { player: 1 },
		},
	},
	dcxunjie: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			if (["handcard", "hp"].every(i => player.isTempBanned(`dcxunjie_${i}`))) {
				return false;
			}
			return player.hasHistory("gain", evt => {
				return !evt.getParent("phaseDraw", true);
			});
		},
		direct: true,
		async content(event, trigger, player) {
			const choices = [];
			const choiceList = ["令一名角色将手牌数摸或弃置至与其体力值相同", "令一名角色将体力回复或失去至与其手牌数相同"];
			if (!player.isTempBanned("dcxunjie_handcard")) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "（已被选择过）</span>";
			}
			if (!player.isTempBanned("dcxunjie_hp")) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "（已被选择过）</span>";
			}
			let result;
			if (_status.connectMode) {
				game.broadcastAll(() => {
					_status.noclearcountdown = true;
				});
			}
			if (choices.length == 1) {
				result = { control: choices[0] };
			} else {
				result = await player
					.chooseControl(choices, "cancel2")
					.set("choiceList", choiceList)
					.set("prompt", get.prompt("dcxunjie"))
					.set("ai", () => {
						return get.event().choice;
					})
					.set(
						"choice",
						(() => {
							const getValue = (index, target) => {
								let att = get.attitude(player, target);
								att = Math.sign(att) * Math.sqrt(Math.abs(att));
								let delt = target.getHp(true) - target.countCards("h");
								if (index == 1 && delt < 0) {
									delt = 0;
								}
								return (1 - 3 * index) * att * delt;
							};
							const list = game
								.filterPlayer()
								.map(current => {
									const val0 = getValue(0, current),
										val1 = getValue(1, current);
									return [val0, val1, Math.max(val0, val1)];
								})
								.sort((a, b) => {
									return b[2] - a[2];
								});
							const toChoose = list[0];
							if (toChoose[2] <= 0) {
								return "cancel2";
							}
							return toChoose[0] > toChoose[1] ? 0 : 1;
						})()
					)
					.forResult();
			}
			if (result.control == "cancel2") {
				if (_status.connectMode) {
					game.broadcastAll(() => {
						delete _status.noclearcountdown;
						game.stopCountChoose();
					});
				}
				return;
			}
			let prompt = "";
			const choice = result.control,
				index = choice == "选项一" ? 0 : 1;
			if (choices.length == 1) {
				prompt = `###${get.prompt("dcxunjie")}###<div class="text center">${choiceList[index]}</div>`;
			} else {
				prompt = `###殉节：请选择一名角色###<div class="text center">${choiceList[index].replace("一名", "该")}</div>`;
			}
			result = await player
				.chooseTarget(prompt)
				.set("ai", target => {
					const player = get.player(),
						index = get.event().index;
					let att = get.attitude(player, target);
					att = Math.sign(att) * Math.sqrt(Math.abs(att));
					let delt = target.getHp(true) - target.countCards("h");
					if (index == 1 && delt < 0) {
						delt = 0;
					}
					return (1 - 2 * index) * att * delt;
				})
				.set("index", index)
				.forResult();
			if (_status.connectMode) {
				game.broadcastAll(() => {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			if (!result.bool) {
				return;
			}
			const target = result.targets[0];
			player.logSkill("dcxunjie", target);
			player.tempBanSkill(`dcxunjie_${index == 0 ? "handcard" : "hp"}`, "roundStart", false);
			const delt = (target.getHp(true) - target.countCards("h")) * (1 - 2 * index);
			if (delt == 0) {
				return;
			} else if (index == 0) {
				target[delt > 0 ? "draw" : "chooseToDiscard"](Math.abs(delt), true, "allowChooseAll");
			} else {
				target[delt > 0 ? "recover" : "loseHp"](Math.abs(delt));
			}
		},
	},
	//乐蔡邕
	dcjiaowei: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		group: "dcjiaowei_prevent",
		async content(event, trigger, player) {
			const cards = player.getCards("h");
			player.addGaintag(cards, "dcjiaowei_tag");
		},
		mod: {
			ignoredHandcard(card, player) {
				if (card.hasGaintag("dcjiaowei_tag")) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && card.hasGaintag("dcjiaowei_tag")) {
					return false;
				}
			},
		},
		subSkill: {
			prevent: {
				audio: "dcjiaowei",
				trigger: {
					player: "loseAfter",
					global: ["loseAsyncAfter", "addJudgeAfter", "equipAfter", "gainAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (player.hasSkill("dcjiaowei_effect")) {
						return false;
					}
					if (!event.getl?.(player)?.hs?.length) {
						return false;
					}
					if (event.name === "lose") {
						return Object.values(event.gaintag_map).flat().includes("dcjiaowei_tag");
					}
					return player.hasHistory("lose", evt => {
						if (event !== evt.getParent()) {
							return false;
						}
						return Object.values(evt.gaintag_map).flat().includes("dcjiaowei_tag");
					});
				},
				forced: true,
				async content(event, trigger, player) {
					player.addTempSkill("dcjiaowei_effect");
				},
			},
			effect: {
				audio: "dcjiaowei",
				trigger: { player: "damageBegin4" },
				forced: true,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					trigger.cancel();
				},
				mark: true,
				intro: { content: "防止本回合下次受到的伤害" },
			},
		},
	},
	dcfeibai: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		locked: false,
		prompt(event, player) {
			const history = player.getHistory("useCard");
			const ind = history.indexOf(event) - 1,
				evt = history[ind];
			const len = get.cardNameLength(event.card) + (evt ? get.cardNameLength(evt.card) : 0);
			return `${get.prompt("dcfeibai")}（字数之和为${len}）`;
		},
		async content(event, trigger, player) {
			const history = player.getHistory("useCard");
			const ind = history.indexOf(trigger) - 1,
				evt = history[ind],
				cards = [];
			const len = get.cardNameLength(trigger.card) + (evt ? get.cardNameLength(evt.card) : 0);
			while (cards.length < 2) {
				const card = get.cardPile(cardx => get.cardNameLength(cardx, false) === len && !cards.includes(cardx));
				if (!card) {
					break;
				}
				cards.add(card);
			}
			if (cards.length) {
				const result = await player
					.chooseCardButton(`飞白：获得一张牌`, cards, true)
					.set("ai", button => get.value(button.link, player))
					.forResult();
				if (result?.links?.length) {
					await player.gain(result.links, "gain");
				}
			} else {
				await player.draw(2).gaintag.add("dcjiaowei_tag");
				player.tempBanSkill(event.name);
			}
		},
		mod: {
			aiOrder(player, card, num) {
				const evt = player.getLastUsed();
				const len = get.cardNameLength(card) + (evt ? get.cardNameLength(evt.card) : 0);
				const cardx = get.cardPile(card => get.cardNameLength(card, false) === len);
				if (cardx) {
					return num + 8 + (len == 2 || len == 4 ? 2 : 0);
				}
			},
		},
	},
	//庞山民
	dccaisi: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			return get.type(event.card) == "basic" && _status.currentPhase;
		},
		prompt2(event, player) {
			const num = Math.pow(2, player.countMark("dccaisi_more"));
			return `从${player == _status.currentPhase ? "" : "弃"}牌堆中随机获得${get.cnNumber(num)}张非基本牌`;
		},
		async content(event, trigger, player) {
			const position = player == _status.currentPhase ? "cardPile2" : "discardPile";
			let cards = [],
				num = Math.pow(2, player.countMark("dccaisi_more"));
			while (num > 0) {
				num--;
				let card = get[position](card => get.type(card) != "basic" && !cards.includes(card), "random");
				if (card) {
					cards.add(card);
				} else {
					break;
				}
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			} else {
				player.chat("没有非基本牌…");
				game.log(`但是${position == "discardPile" ? "弃" : ""}牌堆里没有非基本牌！`);
			}
			const sum = player.getHistory("useSkill", evt => evt.skill == "dccaisi").length;
			if (sum <= player.maxHp) {
				player.addTempSkill("dccaisi_more");
				player.addMark("dccaisi_more", 1, false);
			} else {
				player.tempBanSkill("dccaisi");
			}
		},
		subSkill: { more: { charlotte: true, onremove: true } },
	},
	dczhuoli: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		forced: true,
		filter(event, player) {
			return player.getHistory("useCard").length > player.getHp() || player.getHistory("gain").reduce((sum, evt) => sum + evt.cards.length, 0) > player.getHp();
		},
		async content(event, trigger, player) {
			if (player.maxHp < game.countPlayer2()) {
				await player.gainMaxHp();
			}
			await player.recover();
		},
	},
};
