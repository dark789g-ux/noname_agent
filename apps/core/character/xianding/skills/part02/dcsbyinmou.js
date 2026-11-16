import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbyinmou" | "dcsbhongce">} */
export const groupSkills = {
	//谋庞统
	dcsbyinmou: {
		audio: 2,
		audioname: ["dc_sb_pangtong_shadow"],
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			player.changeSkin({ characterName: "dc_sb_pangtong" }, "dc_sb_pangtong" + (player.storage[skill] ? "_shadow" : ""));
		},
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				return `每个回合结束时，若本回合有角色失去手牌数不小于其当前手牌数，你可观看牌堆顶三张牌并交给其中一名角色其中一张，此牌离开其手牌区时，${storage ? "其弃置体力值张手牌" : "摸体力值张牌（至多摸五）"}。`;
			},
		},
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return get.info("dcsbyinmou").getTargets().length > 0;
		},
		getTargets() {
			return game.filterPlayer(target => {
				let cards = [];
				target.checkHistory("lose", evt => {
					if (evt.hs?.length) {
						cards.addArray(evt.hs);
					}
				});
				return cards.length >= target.countCards("h");
			});
		},
		prompt2(event, player) {
			const targets = get.info("dcsbyinmou").getTargets();
			return `${get.skillInfoTranslation("dcsbyinmou", player, false)}<br><span class=bluetext>可选目标：${get.translation(targets)}</span>`;
		},
		check(event, player) {
			const targets = get.info("dcsbyinmou").getTargets();
			let sgn = 1;
			if (player.getStorage("dcsbyinmou", false)) {
				sgn = -1;
			}
			return targets.some(target => get.attitude(player, target) * sgn > 0);
		},
		async content(event, trigger, player) {
			const bool = !!player.getStorage(event.name, false);
			const targets = get.info(event.name).getTargets();
			player.changeZhuanhuanji(event.name);
			const cards = get.cards(3, true);
			const result = await player
				.chooseButtonTarget({
					createDialog: [`寅谋：将一张牌交给一名角色`, cards],
					targets: targets,
					filterTarget(card, player, target) {
						return get.event().targets?.includes(target);
					},
					bool: bool,
					forced: true,
					filterButton: true,
					ai1(button) {
						return get.value(button.link) * (!bool ? 1 : -1);
					},
					ai2(target) {
						return get.attitude(get.player(), target) * (!bool ? 1 : -1) * (114514 - target.countCards("h"));
					},
				})
				.forResult();
			if (!result?.bool || !result.links?.length || !result.targets?.length) {
				return;
			}
			const {
				links: [card],
				targets: [target],
			} = result;
			player.line(target, "green");
			target.addSkill(`${event.name}_effect`);
			game.log(player, "将牌堆顶的一张牌交给了", target);
			const next = target.gain(card, "draw");
			next.gaintag.add(`${event.name}${bool ? "_shadow" : ""}`);
			await next;
		},
		group: ["dcsbyinmou_change"],
		subSkill: {
			effect: {
				trigger: {
					player: "loseAfter",
					global: ["gainAfter", "loseAsyncAfter", "addJudgeAfter", "equipAfter", "addToExpansionAfter"],
				},
				getIndex(event, player) {
					return event.getl(player).hs;
				},
				filter(event, player, name, card) {
					if (!card || !card.cardid) {
						return false;
					}
					const evt = event.getl(player);
					const gaintag = evt.gaintag_map[card.cardid];
					if (Array.isArray(gaintag)) {
						if (gaintag.includes("dcsbyinmou")) {
							return player.getHp() > 0;
						}
						if (gaintag.includes("dcsbyinmou_shadow")) {
							return player.countDiscardableCards(player, "h") > 0 && player.getHp() > 0;
						}
					}
					return false;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const card = event.indexedData,
						gaintag = trigger.getl(player).gaintag_map[card.cardid];
					if (!Array.isArray(gaintag)) {
						return;
					}
					if (gaintag.includes("dcsbyinmou")) {
						const num = Math.min(5, player.getHp());
						if (num > 0) {
							await player.draw(num);
						}
					}
					if (gaintag.includes("dcsbyinmou_shadow")) {
						const num = Math.min(player.countDiscardableCards(player, "h"), player.getHp());
						if (num > 0) {
							await player.chooseToDiscard(num, "h", true, "allowChooseAll");
						}
					}
				},
			},
			change: {
				audio: "dcsbyinmou",
				audioname: ["dc_sb_pangtong_shadow"],
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				prompt2(event, player) {
					return "切换【寅谋】为状态" + (player.storage.dcsbyinmou ? "阳" : "阴");
				},
				check: () => Math.random() > 0.5,
				async content(event, trigger, player) {
					player.changeZhuanhuanji("dcsbyinmou");
				},
			},
		},
	},
	dcsbhongce: {
		audio: 5,
		audioname: ["dc_sb_pangtong_shadow"],
		trigger: { global: "roundStart" },
		enable: "phaseUse",
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			const evts = event.player.getAllHistory("custom", evt => evt.skill == "dcsbhongce");
			event.set("hongceEvts", evts);
		},
		filter(event, player) {
			if (event.name == "phase") {
				return game.roundNumber == 1;
			}
			return !player.hasSkill("dcsbhongce_used") && event.hongceEvts?.length;
		},
		filterTarget(card, player, target) {
			const { hongceEvts: evts } = get.event();
			const link = evts[0].link;
			return link == "draw" || target.countCards("h") > 0;
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseTarget("宏策：令一名角色选择一项执行", get.skillInfoTranslation(event.skill), true)
				.set("ai", target => {
					const player = get.player();
					return get.attitude(player, target);
				})
				.forResult();
			if (result?.bool && result.targets?.length) {
				event.result = {
					bool: true,
					targets: result.targets,
				};
			}
		},
		prompt(event, player) {
			// 起许劭【评荐】询问发动触发技时会读技能的prompt以生成“是否发动某某技能”的技能提示，使用trigger和enable一起写的写法时需要注意prompt里分类讨论
			if (event.name == "phase") {
				return get.prompt("dcsbhongce", null, player);
			}
			const link = event.hongceEvts?.[0]?.link;
			switch (link) {
				case "sha": {
					return "令一名角色弃置半数手牌（向上取整）并获得等量张伤害牌，视为使用一张【杀】";
				}
				case "recast": {
					return "令一名角色重铸一张手牌，视为使用一张单目标普通锦囊牌";
				}
				default: {
					return "令一名角色摸三张牌，这些牌不计入手牌上限";
				}
			}
		},
		logAudio(event, player) {
			if (event.name == "phase") {
				return 2;
			} else {
				const evts = player.getAllHistory("custom", evt => evt.skill == "dcsbhongce");
				if (evts.length) {
					const link = evts[0].link;
					switch (link) {
						case "sha":
							return player.storage.dcsbyinmou ? "dcsbhongce_dc_sb_pangtong_shadow3.mp3" : "dcsbhongce3.mp3";
						case "recast":
							return player.storage.dcsbyinmou ? "dcsbhongce_dc_sb_pangtong_shadow4.mp3" : "dcsbhongce4.mp3";
						default:
							return player.storage.dcsbyinmou ? "dcsbhongce_dc_sb_pangtong_shadow5.mp3" : "dcsbhongce5.mp3";
					}
				}
			}
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			let link;
			if (trigger?.name == "phase") {
				const result = await target
					.chooseButton(
						[
							`宏策：选择一项执行`,
							[
								[
									["sha", "弃置半数手牌（向上取整）并获得等量张伤害牌，视为使用一张【杀】"],
									["recast", "重铸一张手牌，视为使用一张单目标普通锦囊牌"],
									["draw", "摸三张牌，这些牌不计入手牌上限"],
								],
								"textbutton",
							],
						],
						true
					)
					.set("filterButton", button => {
						return button.link == "draw" || get.player().hasCards("h");
					})
					.set("ai", () => Math.random())
					.forResult();
				if (result?.bool && result.links?.length) {
					link = result.links[0];
					player.getHistory("custom").push({ skill: event.name, link: link });
				}
			} else {
				player.addTempSkill("dcsbhongce_used", { global: "phaseAnyAfter" });
				const evts = player.getAllHistory("custom", evt => evt.skill == event.name);
				if (evts.length) {
					link = evts[0].link;
				}
			}
			if (!link) {
				return;
			}
			switch (link) {
				case "sha": {
					const num = Math.ceil(target.countCards("h") / 2);
					if (num > 0) {
						const result = await target
							.chooseToDiscard("宏策：弃置半数手牌（向上取整）并获得等量张伤害牌", num, true, "allowChooseAll")
							.set("ai", card => {
								return 7 - get.value(card);
							})
							.forResult();
						if (result?.bool && result.cards?.length) {
							const cards = [];
							while (cards.length < result.cards.length) {
								const card = get.cardPile2(card => get.is.damageCard(card) && !cards.includes(card), "random");
								if (card) {
									cards.add(card);
								} else {
									break;
								}
							}
							if (cards.length) {
								await target.gain(cards, "gain2").set("log", false);
							}
						}
					}
					const card = new lib.element.VCard({ name: "sha", isCard: true });
					if (target.hasUseTarget(card)) {
						await target.chooseUseTarget(card, false, true);
					}
					break;
				}
				case "recast": {
					if (target.hasCards("h", lib.filter.cardRecastable)) {
						const result = await target
							.chooseCard("h", true, "宏策：请重铸一张手牌", lib.filter.cardRecastable)
							.set("ai", card => {
								return 8 - get.value(card);
							})
							.forResult();
						if (result?.bool && result.cards?.length) {
							await target.recast(result.cards);
						}
					}
					const list = get.inpileVCardList(info => {
						if (info[0] != "trick") {
							return false;
						}
						const infox = lib.card[info[2]];
						if (infox.notarget) {
							return false;
						}
						const check = () => {
							const select = infox.selectTarget;
							if (select !== undefined) {
								if (Array.isArray(select)) {
									if (select[0] < 0) {
										return infox.toself;
									}
									return select[0] == 1 && select[1] == 1;
								}
								if (select < 0) {
									return infox.toself;
								}
								return select == 1;
							}
							return true;
						};
						if (!check()) {
							return false;
						}
						const card = new lib.element.VCard({ name: info[2], isCard: true });
						return target.hasUseTarget(card);
					});
					if (!list.length) {
						return;
					}
					const result =
						list.length > 1
							? await target
									.chooseButton(["宏策：视为使用一张单目标普通锦囊牌", [list, "vcard"]], true)
									.set("ai", button => {
										const card = new lib.element.VCard({ name: button.link[2], isCard: true });
										return get.player().getUseValue(card);
									})
									.forResult()
							: {
									bool: true,
									links: list,
								};
					if (result?.bool && result.links?.length) {
						const card = new lib.element.VCard({ name: result.links[0][2], isCard: true });
						if (target.hasUseTarget(card)) {
							await target.chooseUseTarget(card, true, false);
						}
					}
					break;
				}
				default: {
					target.addSkill("dcsbhongce_limit");
					const next = target.draw(3);
					next.gaintag.add("dcsbhongce");
					await next;
					break;
				}
			}
		},
		ai: {
			order: 7,
			result: {
				target: 2,
			},
		},
		subSkill: {
			used: {
				charlotte: true,
			},
			limit: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag("dcsbhongce");
				},
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("dcsbhongce")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("dcsbhongce")) {
							return false;
						}
					},
				},
			},
		},
	},
};
