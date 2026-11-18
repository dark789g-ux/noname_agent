import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbwuwei" | "dcsbfengmin" | "dcsbzhiwang">} */
export const groupSkills = {
	//关平
	dcsbwuwei: {
		locked: false,
		mod: {
			targetInRange(card) {
				if (card.storage?.dcsbwuwei) {
					return true;
				}
			},
			cardUsable(card, player, num) {
				if (card.storage?.dcsbwuwei) {
					return Infinity;
				}
			},
			aiOrder(player, card, num) {
				if (player.countMark("dcsbwuwei_count") == (player.getStat().skill.dcsbwuwei || 0)) {
					return;
				}
				if (num > 0 && get.itemtype(card) === "card" && player.countCards("h") <= 2) {
					return 0;
				}
			},
		},
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + player.countMark("dcsbwuwei_count");
		},
		filter(event, player) {
			const colors = player.getCards("h").reduce((list, card) => list.add(get.color(card)), []);
			return colors.some(color => event.filterCard(get.autoViewAs({ name: "sha", storage: { dcsbwuwei: true } }, player.getCards("h", { color: color })), player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.addNewRowList(player.getCards("h"), "color");
				const dialog = ui.create.dialog();
				dialog.add([
					[[`###武威###<div class="text center">${get.translation("dcsbwuwei", "info")}</div>`], "addNewRow"],
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
				const evt = _status.event.getParent();
				return evt.filterCard(get.autoViewAs({ name: "sha", storage: { dcsbwuwei: true } }, player.getCards("h", { color: button.link })), player, evt);
			},
			check(button) {
				const player = get.player();
				const color = button.link;
				const cards = button.links;
				const types = cards.reduce((list, card) => list.add(get.type2(card, player)), []);
				const count = cards.length;
				const num = types.length;
				return (Math.min(count, num) * num) / Math.max(0.1, get.value(cards));
			},
			backup(links, player) {
				return {
					audio: "dcsbwuwei",
					viewAs: { name: "sha", storage: { dcsbwuwei: true } },
					filterCard: { color: links[0] },
					selectCard: -1,
					position: "h",
					popname: true,
					async precontent(event, trigger, player) {
						player.addTempSkill("dcsbwuwei_effect");
						event.getParent().addCount = false;
					},
				};
			},
			prompt(links, player) {
				return `将所有${get.translation(links[0])}手牌当作无距离和次数限制的【杀】使用`;
			},
		},
		ai: {
			respondSha: true,
			order(item, player) {
				return get.order({ name: "sha" }, player) - 0.001;
			},
			result: { player: 1 },
			skillTagFilter(player, tag, arg) {
				if (arg === "respond" || !player.hasCards("h")) {
					return false;
				}
			},
		},
		subSkill: {
			backup: {},
			effect: {
				charlotte: true,
				trigger: { player: "useCardBefore" },
				filter(event, player) {
					return (event.card.storage || {}).dcsbwuwei && (event.cards || []).length;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const types = trigger.cards.reduce((list, card) => list.add(get.type2(card, player)), []);
					let num = types.length;
					const chosen = [];
					while (num--) {
						const list = ["摸一张牌", "令目标角色本回合非锁定技失效", "令本回合〖武威〗可发动次数+1"];
						for (let index = 0; index < 3; index++) {
							if (chosen.includes(index)) {
								list[index] += "（已选择过）";
							}
						}
						const num1 = player.countCards("h") - trigger.cards.length;
						const num2 = player.countMark("dcsbwuwei_count") - (player.getStat().skill.dcsbwuwei || 0);
						const result = await player
							.chooseButton([`武威：请选择一项${num > 0 ? `（还须选择${num}次）` : ""}`, [list.map((item, i) => [i, item]), "textbutton"]])
							.set("forced", true)
							.set("ai", button => {
								const { player, left, num1, num2, chosen } = get.event();
								const link = button.link;
								if (num1 == 0) {
									// 没牌摸牌
									return link == 0 ? 2 : 0;
								} else {
									if (num2 == 0) {
										// 没次数+次数
										return link == 2 ? 1 : 0;
									} else {
										if (num2 > 2) {
											// 次数够无脑摸
											return link == 0 ? 2 : 0;
										}
										if (!chosen.includes(0)) {
											// 优先摸
											return link == 0 ? 2 : 0;
										}
										if (left > 0) {
											// 有剩余再+次数
											return link == 2 ? 2 : 0;
										}
										// 总之无脑摸
										return link == 0 ? 2 : 0;
									}
								}
							})
							.set("left", num)
							.set("num1", num1)
							.set("num2", num2)
							.set("chosen", chosen)
							.forResult();
						if (result?.bool) {
							const index = result.links[0];
							chosen.add(index);
							game.log(player, "选择了", "#g【武威】", "的", "#y第" + get.cnNumber(index + 1, true) + "项");
							if (index == 0) {
								await player.draw();
							}
							if (index == 1) {
								for (const target of trigger.targets || []) {
									target.addTempSkill("dcsbwuwei_fengyin");
								}
							}
							if (index == 2) {
								player.addTempSkill("dcsbwuwei_count");
								player.addMark("dcsbwuwei_count", 1, false);
							}
						}
					}
					if ([0, 1, 2].every(index => chosen.includes(index))) {
						if (typeof trigger.baseDamage !== "number") {
							trigger.baseDamage = 1;
						}
						trigger.baseDamage++;
						game.log(trigger.card, "造成的伤害", "#y+1");
					}
				},
			},
			count: {
				charlotte: true,
				onremove: true,
				intro: { content: "本回合〖武威〗可发动次数+#" },
			},
			fengyin: {
				inherit: "fengyin",
			},
		},
	},
	//曹昂
	dcsbfengmin: {
		audio: 2,
		trigger: { global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"] },
		filter(event, player, name, target) {
			if (
				!target ||
				!target.isIn() ||
				!Array.from({ length: 5 })
					.map((_, i) => i + 1)
					.reduce((sum, i) => sum + target.countEmptySlot(i), 0)
			) {
				return false;
			}
			const evt = event.getl(target);
			return evt?.es?.length;
		},
		usable: 1,
		forced: true,
		getIndex(event, player) {
			return game.filterPlayer(target => {
				if (
					!target ||
					!target.isIn() ||
					!Array.from({ length: 5 })
						.map((_, i) => i + 1)
						.reduce((sum, i) => sum + target.countEmptySlot(i), 0)
				) {
					return false;
				}
				const evt = event.getl(target);
				return evt?.es?.length;
			});
		},
		logTarget: (_1, _2, _3, target) => target,
		async content(event, trigger, player) {
			player.addMark("dcsbfengmin", 1, false);
			const target = event.indexedData;
			await player.draw(
				Array.from({ length: 5 })
					.map((_, i) => i + 1)
					.reduce((sum, i) => sum + target.countEmptySlot(i), 0)
			);
			/*if (player.countMark("dcsbfengmin") > player.getDamagedHp()) {
				player.tempBanSkill("dcsbfengmin");
			}*/
		},
		//intro: { content: "本局游戏已发动过#次此技能" },
	},
	dcsbzhiwang: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		async content(event, trigger, player) {
			await player.discardPlayerCard("e", player, player.countCards("e"), true);
			if (
				player.hasHistory("lose", evt => {
					return evt.type == "discard" && evt.getParent(3) == event && evt?.es?.length;
				})
			) {
				const cards = Array.from(ui.discardPile.childNodes).filter(
					card =>
						get.is.damageCard(card) &&
						game.hasPlayer(current => {
							return current != player && current.hasUseTarget(card, true);
						})
				);
				if (!cards?.length) {
					return;
				}
				const result = await player
					.chooseButtonTarget({
						createDialog: ["质亡：令一名其他角色使用一张牌", cards],
						forced: true,
						filterTarget(card, player, target) {
							if (player == target) {
								return false;
							}
							const buttons = ui.selected.buttons;
							return buttons?.length && target.hasUseTarget(buttons[0].link, true);
						},
						ai1(button) {
							let max = 0;
							game.filterPlayer(current => {
								if (current == player || !current.hasUseTarget(button.link, true)) {
									return false;
								}
								max = Math.max(max, current.getUseValue(button.link, true));
							});
							return max;
						},
						ai2(target) {
							const buttons = ui.selected.buttons;
							if (!buttons?.length) {
								return 0;
							}
							return target.getUseValue(buttons[0].link, true);
						},
					})
					.forResult();
				if (result?.bool) {
					const {
						links: [card],
						targets: [target],
					} = result;
					target.addTempSkill("dcsbzhiwang_nosource");
					const map = target.getStorage("dcsbzhiwang_nosource", new Map());
					map.set(player, card);
					target.setStorage("dcsbzhiwang_nosource", map);
					if (target.hasUseTarget(card, true)) {
						await target.chooseUseTarget(card, true, false).set("oncard", (card, target) => {
							const map = target.getStorage("dcsbzhiwang_nosource", new Map());
							map.forEach((cardx, player) => {
								if (card.cards?.includes(cardx)) {
									map.set(player, card);
								}
							});
							target.setStorage("dcsbzhiwang_nosource", map);
						});
					}
				}
			}
		},
		subSkill: {
			nosource: {
				charlotte: true,
				onremove: true,
				trigger: {
					source: "damageBefore",
				},
				silent: true,
				filter(event, player) {
					const list = player.getStorage("dcsbzhiwang_nosource", new Map());
					const card = list.get(event.player);
					return event.source && card && get.autoViewAs(card) == event.card;
				},
				async content(event, trigger, player) {
					delete trigger.source;
				},
			},
		},
	},
};
