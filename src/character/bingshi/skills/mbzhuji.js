import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mbzhuji" | "mbxuye" | "mbkuangxiang" | "potguansha" | "potjiyu">} */
export const groupSkills = {
	mbzhuji: {
		audio: 4,
		trigger: { player: "phaseUseEnd" },
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		logAudio: index => (typeof index === "number" ? "mbzhuji" + index + ".mp3" : 2),
		popup: false,
		async cost(event, trigger, player) {
			const list = get.addNewRowList(player.getCards("h"), "suit", player);
			const result = await player
				.chooseButton([
					[
						[[`${get.translation(event.skill)}：请选择一个花色的牌`], "addNewRow"],
						[
							dialog => {
								dialog.classList.add("fullheight");
								dialog.forcebutton = false;
								dialog._scrollset = false;
							},
							"handle",
						],
						list.map(item => [Array.isArray(item) ? item : [item], "addNewRow"]),
					],
				])
				.set("filterButton", button => {
					const player = get.player();
					if (!button.links.length || button.links.some(card => !lib.filter.cardDiscardable(card, player, get.event().getParent().name))) {
						return false;
					}
					return true;
				})
				.set("ai", button => {
					const player = get.player();
					const es = player.countCards("e");
					if (!es) {
						return 4 - button.links.length;
					}
					if (button.links.length > es && button.links.length <= 3) {
						return 5 - button.links.length;
					}
					return 0;
				})
				.forResult();
			if (result?.bool && result?.links?.length) {
				event.result = {
					bool: result?.bool,
					cost_data: result?.links,
					cards: player.getCards("h").filter(card => result?.links?.includes(get.suit(card, player))),
				};
			}
		},
		async content(event, trigger, player) {
			const cards = event.cards;
			const suit = get.suit(cards[0], player);
			//官方结算是对比弃牌前的
			const es = player.countCards("e");
			const next = player.modedDiscard(cards);
			await next;
			const card = get.cardPile2(card => get.type(card) == "equip" && get.suit(card) == suit);
			if (!card) {
				player.chat(`孩子们，牌堆没有${get.translation(suit)}装备牌了`);
				return;
			}
			await player.gain(card, "draw");
			if (player.hasCard(cardx => cardx == card, "h")) {
				await player.chooseUseTarget(card, true);
			}
			const num = next.cards.length;
			player.logSkill("mbzhuji", null, null, null, [num >= es ? get.rand(1, 2) : get.rand(3, 4)]);
			if (num >= es) {
				const result = await player
					.chooseButton(
						[
							"筑墼：选择一项执行",
							[
								[
									["draw", "摸两张牌"],
									["recover", "回复1点体力"],
									["hujia", "获得1点护甲"],
								],
								"textbutton",
							],
						],
						true
					)
					.set("filterButton", button => {
						const player = get.player();
						if (button.link == "recover") {
							return player.isDamaged();
						}
						if (button.link == "hujia") {
							return player.hujia < 5;
						}
						return true;
					})
					.set("ai", button => {
						if (button.link == "recover") {
							return get.recoverEffect(player, player, player) > 0 ? 1 : 0;
						}
						return Math.random();
					})
					.forResult();
				if (!result?.bool || !result.links?.length) {
					return;
				}
				switch (result.links[0]) {
					case "draw": {
						await player.draw(2);
						break;
					}
					case "recover": {
						await player.recover();
						break;
					}
					case "hujia": {
						await player.changeHujia(1, null, true);
						break;
					}
				}
			}
		},
	},
	//庞羲
	mbxuye: {
		audio: 3,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.player.isMinHandcard() && event.player.isAlive();
		},
		usable: 1,
		logTarget: "player",
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		logAudio: index => "mbxuye" + (typeof index === "number" ? index : [1, 3].randomGet()) + ".mp3",
		async content(event, trigger, player) {
			const target = event.targets[0]; //兼容匡襄后续效果才这么写的
			const isMax = target.isMaxHandcard();
			await target.draw(2);
			//player.logSkill("mbxuye", [target], null, null, !isMax && target.isMaxHandcard() && target.countCards("ej") > 0 ? [1] : [get.rand(2, 3)]);
			if (!isMax && target.isMaxHandcard() && target.countCards("hej") > 0) {
				player.logSkill("mbxuye", target, null, null, [2]);
				const result = await player.choosePlayerCard(`蓄业：将${get.translation(target)}场上一张牌置于牌堆顶`, target, "hej", true).forResult();
				const card = result.cards[0];
				target.$throw(card, 1000);
				game.log(player, "将", card, "置于牌堆顶");
				await target.lose(card, ui.cardPile, "insert");
				game.updateRoundNumber();
			}
		},
		ai: { expose: 0.2 },
	},
	mbkuangxiang: {
		audio: 3,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => {
				return target != player && target.countCards("h") <= player.countCards("h");
			});
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") <= player.countCards("h");
		},
		usable: 1,
		logAudio: index => "mbkuangxiang" + [1, 3].randomGet() + ".mp3",
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.addTempSkill("mbkuangxiang_effect", { player: "phaseUseBegin" });
			player.markAuto("mbkuangxiang_effect", [player, target]);
			await player.swapHandcards(target);
		},
		derivation: "mbxuye",
		//ai待补充
		ai: {
			order: 6,
			result: {
				target(player, target) {
					const hs1 = player.getCards("h"),
						hs2 = target.getCards("h");
					return get.value(hs1, player) - get.value(hs2, target);
				},
			},
		},
		group: ["mbkuangxiang_mark"],
		subSkill: {
			//给交换的牌上标记
			mark: {
				charlotte: true,
				trigger: { global: "loseAsyncBegin" },
				filter(event, player) {
					return event.getParent(2).name == "mbkuangxiang" && event.getParent(2).player == player;
				},
				silent: true,
				firstDo: true,
				async content(event, trigger, player) {
					//考虑场上出现复数个技能的情况
					game.broadcastAll(player => {
						lib.translate["mbkuangxiang_" + player.playerid] = "匡襄";
					}, player);
					trigger.set("gaintag", ["mbkuangxiang_" + player.playerid]);
				},
			},
			effect: {
				charlotte: true,
				onremove(player, skill) {
					game.filterPlayer(target => {
						return player.storage[skill].includes(target);
					}).forEach(target => target.removeGaintag("mbkuangxiang_" + player.playerid));
					delete player.storage[skill];
				},
				intro: { content: "players" },
				audio: "mbkuangxiang2.mp3",
				trigger: { global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"] },
				getIndex(event, player) {
					return game
						.filterPlayer2(target => {
							if (!player.getStorage("mbkuangxiang_effect").includes(target)) {
								return false;
							}
							let evt = event.getl(target);
							if (!evt?.hs?.length) {
								return false;
							}
							if (event.name == "lose") {
								return Object.values(event.gaintag_map)
									.flat()
									.includes("mbkuangxiang_" + player.playerid);
							}
							return target.hasHistory("lose", evtx => {
								return (
									evtx.getParent() == event &&
									evtx.hs.length &&
									Object.values(evtx.gaintag_map)
										.flat()
										.includes("mbkuangxiang_" + player.playerid)
								);
							});
						})
						.sortBySeat();
				},
				check: () => true,
				prompt2: "你执行一次〖蓄业〗的效果：摸两张牌，然后若手牌数因此成为全场最多，你将场上的一张牌置于牌堆顶。",
				filter(event, player, triggername, target) {
					return !target.hasCard(card => card.hasGaintag("mbkuangxiang_" + player.playerid), "h");
				},
				async content(event, trigger, player) {
					var next = game.createEvent("mbkuangxiang_xuye");
					next.set("player", player);
					next.set("targets", [player]);
					next.setContent(lib.skill.mbxuye.content);
				},
			},
		},
	},
	//势娄圭
	potguansha: {
		limited: true,
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		filter(event, player) {
			return player.countCards("he");
		},
		check(event, player) {
			return player.getCards("he").reduce((sum, card) => sum + get.info("zhiheng").check(card), 0) > 0;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const cards = player.getCards("he");
			await player.loseToDiscardpile(cards);
			let gains = [];
			while (gains.length < cards.length) {
				const card = get.cardPile2(card => get.type(card) === "basic" && !gains.includes(card));
				if (card) {
					gains.push(card);
				} else {
					break;
				}
			}
			if (gains.length) {
				await player.gain(gains, "gain2");
				player.addTempSkill("potguansha_hand");
				player.addMark("potguansha_hand", gains.length, false);
			}
		},
		subSkill: {
			hand: {
				charlotte: true,
				onremove: true,
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("potguansha_hand");
					},
				},
				intro: { content: "手牌上限+#" },
			},
		},
	},
	potjiyu: {
		audio: 3,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => lib.filter.cardDiscardable(card, player), "h");
		},
		filterCard: lib.filter.cardDiscardable,
		check(card) {
			return 8 - get.value(card);
		},
		prompt() {
			return lib.translate["potjiyu_info"].split("②")[0].slice(1);
		},
		usable: 1,
		async content(event, trigger, player) {
			let gains = [];
			let types = [get.type2(event.cards[0])];
			while (true) {
				const card = get.cardPile2(card => !types.includes(get.type2(card)));
				if (card) {
					gains.push(card);
					types.push(get.type2(card));
				} else {
					break;
				}
			}
			if (gains.length) {
				player.addTempSkill("potjiyu_effect", ["phaseBefore", "phaseChange", "phaseAfter", ...lib.phaseName.map(i => i + "After")]);
				await player.gain({
					cards: gains,
					animate: "gain2",
					gaintag: ["potjiyu_effect"],
				});
			}
		},
		ai: {
			order: 10,
			result: { player: 1 },
		},
		group: "potjiyu_refresh",
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
					if (typeof player.storage?.counttrigger?.["potjiyu_refresh"] === "number") {
						delete player.storage.counttrigger["potjiyu_refresh"];
					}
				},
			},
			refresh: {
				audio: "potjiyu",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (player.hasCard(card => card.hasGaintag("potjiyu_effect"), "h") || typeof player.getStat("skill")?.["potjiyu"] !== "number") {
						return false;
					}
					const evt = event.getl(player);
					if (!evt?.hs?.length) {
						return false;
					}
					if (event.name === "lose") {
						return Object.values(event.gaintag_map).flat().includes("potjiyu_effect");
					}
					return player.hasHistory("lose", evt => {
						if (event !== evt.getParent()) {
							return false;
						}
						return Object.values(evt.gaintag_map).flat().includes("potjiyu_effect");
					});
				},
				usable: 2,
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					delete player.getStat("skill")["potjiyu"];
					player.popup("potjiyu");
					game.log(player, "重置了技能", "#g【" + get.translation("potjiyu") + "】");
				},
			},
		},
	},
};
