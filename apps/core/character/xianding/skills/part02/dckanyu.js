import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dckanyu" | "dczhee" | "dcgongtu" | "dchangzhu">} */
export const groupSkills = {
	//郭缇萦
	dckanyu: {
		audio: 2,
		trigger: {
			player: "damageBegin4",
			global: "judgeBegin",
		},
		frequent: true,
		async content(event, trigger, player) {
			const top = get.cards(1, true),
				bottom = get.bottomCards(1, true);
			await game.cardsGotoOrdering([...top, ...bottom]);
			const next = player.chooseToMove_new(get.translation(event.name), true);
			next.set("list", [
				["获得", []],
				[
					["牌堆顶", top],
					["牌堆底", bottom],
				],
			]);
			next.set("top", top);
			next.set("filterMove", (from, to, moved) => {
				if (typeof to != "number") {
					return false;
				}
				if (get.event().top?.includes(from.link) && to == 2) {
					return false;
				}
				return true;
			});
			next.set("processAI", list => {
				let player = get.player(),
					trigger = get.event().getTrigger(),
					cards = list[1].map(i => i[1]).flat();
				//只要贪不死就往死里贪
				if (!trigger?.judge || !trigger.player) {
					return [cards, [], []];
				}
				let att = get.sgnAttitude(player, trigger.player);
				cards.sort((a, b) => {
					return (trigger.judge(b) - trigger.judge(a)) * att;
				});
				if (trigger.judge(cards[0]) > 0) {
					return [cards.slice(1), cards.slice(0, 1), []];
				}
				return [cards, [], []];
			});
			const result = await next.forResult();
			if (!result?.bool) {
				return;
			}
			const [gains, tops, bottoms] = result.moved;
			if (gains.length) {
				await player.gain(gains, "gain2");
				const name = `${event.name}_tiandu`,
					map = player.getStorage(name, new Map());
				gains.forEach(card => {
					const suit = get.suit(card, false),
						number = get.number(card, false);
					const numbers = map.has(suit) ? map.get(suit) : [];
					map.set(suit, numbers.concat([number]));
				});
				player.setStorage(name, map, true);
				player.addSkill(name);
			}
			tops.reverse();
			await game.cardsGotoPile(tops.concat(bottoms), ["top_cards", tops], (event, card) => {
				if (event.top_cards.includes(card)) {
					return ui.cardPile.firstChild;
				}
				return null;
			});
			await game.delay();
		},
		subSkill: {
			tiandu: {
				charlotte: true,
				onremove: true,
				marktext: "舆",
				intro: {
					content: "雷公助我！",
					mark(dialog, storage, player) {
						const addNewRow = lib.element.dialog.addNewRow.bind(dialog);
						dialog.css({ width: "50%" });
						if (get.is.phoneLayout()) {
							dialog.classList.add("fullheight");
						}
						const records = player.getStorage("dckanyu_tiandu", new Map());
						let suits = lib.suit.slice(),
							numbers = Array.from(Array(13)).map((value, index) => index + 1);
						addNewRow(
							...[" "].concat(numbers.map(number => get.strNumber(number))).map(number => {
								return { item: number, ratio: number == " " ? 1 : 2 };
							})
						);
						for (const suit of suits) {
							let list = [{ item: get.translation(suit), ratio: 1 }];
							for (const number of numbers) {
								list.add({
									item: ((suit, number, records) => {
										if (suit == "spade" && number >= 2 && number <= 9) {
											return "⚡";
										}
										if (records.has(suit) && records.get(suit).includes(number)) {
											return "⚡";
										}
										return "<span class='greentext'>●</span>";
									})(suit, number, records),
									ratio: 2,
								});
							}
							addNewRow(...list);
						}
					},
				},
				trigger: {
					player: "judgeBefore",
				},
				filter(event, player) {
					return event.card?.name == "shandian";
				},
				firstDo: true,
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.judgeFromKanyu = trigger.judge;
					trigger.judge = function (card) {
						const { player, judgeFromKanyu } = this;
						const suit = get.suit(card, false),
							number = get.number(card, false),
							map = player.getStorage("dckanyu_tiandu", new Map());
						if (map.has(suit) && map.get(suit).includes(number)) {
							return -5;
						}
						return judgeFromKanyu(card);
					};
				},
			},
		},
	},
	dczhee: {
		audio: 2,
		trigger: {
			player: "enterGame",
			global: ["phaseBefore", "phaseEnd"],
		},
		filter(event, player, name) {
			if (name == "phaseBefore" && game.phaseNumber !== 0) {
				return false;
			}
			const pos = name == "phaseEnd" ? "discardPile" : "cardPile";
			return Array.from(ui[pos].childNodes).some(card => card.name == "shandian" && player.canAddJudge(card));
		},
		forced: true,
		async content(event, trigger, player) {
			const name = event.triggername;
			const card = get[name == "phaseEnd" ? "discardPile" : "cardPile2"](card => {
				return card.name == "shandian" && player.canAddJudge(card);
			});
			if (card) {
				await player.addJudge(card);
			}
		},
	},
	//苏越
	dcgongtu: {
		audio: 2,
		trigger: {
			player: "enterGame",
			global: ["phaseBefore", "useCard"],
		},
		filter(event, player) {
			if (event.name == "useCard") {
				const types = player.getStorage("dcgongtu"),
					evt = game.getAllGlobalHistory("useCard", () => true, event).at(-2);
				if (!evt?.card || !types.length) {
					return false;
				}
				return get.type2(evt.card) === types[0] && get.type2(event.card) === types[1];
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async cost(event, trigger, player) {
			if (trigger.name == "useCard") {
				const result = await player
					.chooseNumbers(get.prompt(event.skill), [
						{
							prompt: "请选择第一个点数",
							min: 1,
							max: 13,
						},
						{
							prompt: "请选择第二个点数",
							min: 1,
							max: 13,
						},
					])
					.set("filterOk", event => {
						return event.numbers.toUniqued()?.length == 2;
					})
					.set("processAI", () => {
						const list = Array.from({ length: 13 }).map((val, idx) => idx + 1);
						return [list.randomRemove(), list.randomRemove()];
					})
					.forResult();
				if (result?.bool) {
					event.result = {
						bool: true,
						cost_data: result.numbers,
					};
				}
			} else {
				const types = ["basic", "trick", "equip"].map(type => ["", "", `caoying_${type}`]);
				const result = await player
					.chooseButton([get.prompt(event.skill), "依次选择两种类型", [types, "vcard"]], 2)
					.set("ai", () => Math.random())
					.forResult();
				if (result.bool) {
					event.result = {
						bool: true,
						cost_data: result.links.map(type => type[2].slice(8)),
					};
				}
			}
		},
		onremove(player, skill) {
			player.setStorage(skill, null);
			player.removeTip(skill);
		},
		async content(event, trigger, player) {
			if (trigger.name == "useCard") {
				const { cost_data: nums } = event;
				const gain = [];
				for (const num of nums) {
					const card = get.cardPile2(card => get.number(card) == num);
					if (card) {
						gain.push(card);
					}
				}
				if (gain.length) {
					await player.gain(gain, "gain2");
				}
			} else {
				const { name, cost_data: types } = event;
				player.setStorage(name, types);
				player.addTip(name, `宫图 ${types.map(type => get.translation(type)[0]).join("")}`);
			}
		},
		global: "dcgongtu_ai",
		subSkill: {
			ai: {
				locked: false,
				mod: {
					aiOrder(player, card, num) {
						const evt = game.getAllGlobalHistory("useCard", () => true).at(-1);
						if (!evt?.card) {
							return;
						}
						const sgn = game
							.filterPlayer(current => {
								return current.hasSkill("dcgongtu") && current.getStorage("dcgongtu")?.[0] == get.type2(evt.card);
							})
							.reduce((sgn, current) => {
								const type = current.getStorage("dcgongtu")[1];
								if ((get.type2(card) == type) == get.attitude(player, current) > 0) {
									return sgn + 1;
								}
								return sgn - 1;
							}, 1);
						return Math.max(0.5, num + sgn * 10);
					},
				},
			},
		},
	},
	dchangzhu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		selectCard: [1, Infinity],
		position: "he",
		lose: false,
		discard: false,
		allowChooseAll: true,
		check(card) {
			if (ui.selected.cards.length > 2) {
				return 0;
			}
			return 4 - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards, name } = event;
			const next = player.addToExpansion(cards, player, "give");
			next.gaintag.add(name);
			await next;
			const numbers = cards
					.map(card => get.number(card))
					.toUniqued()
					.sort((a, b) => a - b),
				str = numbers.map(number => get.strNumber(number));
			const result = await player
				.chooseTarget(`夯筑：令一名其他角色弃置所有点数为${str.join("、")}的牌`, true, lib.filter.notMe)
				.set("ai", target => {
					return -get.attitude(get.player(), target) * target.countCards("he");
				})
				.forResult();
			if (result?.bool) {
				const target = result.targets[0];
				player.line(target);
				const cards = target.getDiscardableCards(target, "he", card => numbers.includes(get.number(card)));
				if (cards.length) {
					await target.discard(cards);
				}
				/*target.addSkill("dchangzhu_effect");
				target
					.when({
						global: ["phaseBegin", "die"],
					})
					.filter(evt => evt.player == player)
					.step(async (event, trigger, player) => {
						player.removeSkill("dchangzhu_effect");
					});
				target.markAuto("dchangzhu_effect", numbers);*/
			}
			const exps = player.getExpansions(name).slice(0);
			let allNum = [],
				sameNum = [];
			for (const card of exps) {
				const num = get.number(card);
				if (allNum.includes(num)) {
					sameNum.add(num);
				} else {
					allNum.add(num);
				}
			}
			if (sameNum.length) {
				allNum.removeArray(sameNum);
				const sames = exps.filter(card => sameNum.includes(get.number(card)));
				if (sames.length) {
					exps.removeArray(sames);
					await player.loseToDiscardpile(sames);
					await player.draw(sames.length);
				}
			}
			if (allNum.length >= 13) {
				const result2 = await player
					.chooseTarget(`###夯筑###是否将${get.translation(exps)}交给一名角色并令其回复所有体力？`)
					.set("ai", target => {
						return get.attitude(get.player(), target) * target.getDamagedHp();
					})
					.forResult();
				if (result2?.bool) {
					const target = result2.targets[0];
					player.line(target);
					await target.gain(exps, "giveAuto", player);
					await target.recoverTo(target.maxHp);
				}
			}
		},
		intro: {
			markcount: "expansion",
			content: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getStorage(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		subSkill: {
			/*effect: {
				onremove: true,
				intro: {
					content(storage, player) {
						if (!Array.isArray(storage)) {
							return "无效果";
						}
						const numbers = storage.sort((a, b) => a - b).map(number => get.strNumber(number));
						return `你无法使用或打出点数为${numbers.join("、")}的牌`;
					},
				},
				locked: false,
				charlotte: true,
				mod: {
					cardEnabled(card, player) {
						const num = get.number(card, player),
							list = player.getStorage("dchangzhu_effect");
						if (list.includes(num)) {
							return false;
						}
					},
					cardSavable(card, player) {
						const num = get.number(card, player),
							list = player.getStorage("dchangzhu_effect");
						if (list.includes(num)) {
							return false;
						}
					},
					cardRespondable(card, player) {
						const num = get.number(card, player),
							list = player.getStorage("dchangzhu_effect");
						if (list.includes(num)) {
							return false;
						}
					},
				},
			},*/
		},
	},
};
