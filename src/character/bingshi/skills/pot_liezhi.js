import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "pot_liezhi" | "pot_jugu" | "potqingyan" | "potceduan" | "old_pottuntian">} */
export const groupSkills = {
	//势臧洪
	pot_liezhi: {
		audio: 2,
		enable: "chooseToUse",
		usable: 1,
		locked: false,
		mod: {
			cardUsable(card) {
				if (card?.storage?.potliezhi) {
					return Infinity;
				}
			},
		},
		filter(event, player) {
			return ["tao", "jiu"].some(name => {
				const card = new lib.element.VCard({ name, isCard: true, storage: { potliezhi: true } });
				return event.filterCard(card, player, event);
			});
		},
		chooseButton: {
			dialog(event, player) {
				const list = ["tao", "jiu"].filter(name => {
					const card = new lib.element.VCard({ name, isCard: true, storage: { potliezhi: true } });
					return event.filterCard(card, player, event);
				});
				const dialog = ui.create.dialog("烈志", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				const player = get.player(),
					card = new lib.element.VCard({ name: button.link[2], isCard: true, storage: { potliezhi: true } });
				if (button.link[2] == "tao" && player.getDamagedHp() <= 1) {
					return 0;
				}
				return player.getUseValue(card);
			},
			prompt(links) {
				return `减少1点体力上限，视为使用一张${get.translation(links[0][2])}`;
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
						isCard: true,
						storage: {
							potliezhi: true,
						},
					},
					filterCard: () => false,
					selectCard: -1,
					manualConfirm: true,
					log: false,
					popname: true,
					async precontent(event, trigger, player) {
						event.getParent().addCount = false;
						player.logSkill("pot_liezhi");
						await player.loseMaxHp();
					},
				};
			},
		},
		hiddenCard(player, name) {
			return ["tao", "jiu"].includes(name);
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					if (player.maxHp <= 1) {
						return -2;
					}
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
	},
	pot_jugu: {
		audio: 2,
		trigger: {
			target: "useCardToTargeted",
		},
		filter(event, player) {
			return !player.isDamaged();
		},
		check(event, player) {
			return player.getHistory("useSkill", evt => evt.skill == "pot_jugu").length < 2;
		},
		async content(event, trigger, player) {
			await player.draw(2);
			const num = Math.min(player.countDiscardableCards(player, "he"), player.getHistory("useSkill", evt => evt.skill == event.name).length);
			if (num > 0) {
				await player.chooseToDiscard(num, "he", true);
			}
		},
	},
	//势陈矫
	potqingyan: {
		audio: 3,
		enable: "chooseToUse",
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			const num = Math.min(event.player.getRoundHistory("useSkill", evt => evt.skill == "potqingyan").length + 1, 5);
			event.set("qingyanCount", num);
		},
		filter(event, player) {
			if (player.countCards("h", card => card.hasGaintag("potqingyan"))) {
				return false;
			}
			if (player.countCards("h") < event.qingyanCount) {
				return false;
			}
			return ["shan", "wuxie"].some(name => {
				const card = new lib.element.VCard({ name, isCard: true });
				return event.filterCard(card, player, event);
			});
		},
		chooseButton: {
			dialog(event, player) {
				const list = ["shan", "wuxie"].filter(name => {
					const card = new lib.element.VCard({ name, isCard: true });
					return event.filterCard(card, player, event);
				});
				const dialog = ui.create.dialog("清严", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			backup(links, player) {
				const num = get.event().qingyanCount;
				return {
					filterCard: true,
					ignoreMod: true,
					position: "h",
					selectCard: num,
					popname: true,
					viewAs: {
						name: links[0][2],
						isCard: true,
						suit: "none",
						number: null,
					},
					log: false,
					async precontent(event, trigger, player) {
						player.logSkill("potqingyan");
						const evt = event.result;
						await player.showCards(evt.cards, `${get.translation(player)}发动了【清严】`);
						player.addGaintag(evt.cards, "potqingyan");
						evt.card = new lib.element.VCard({ name: evt.card.name, isCard: true });
						evt.cards = [];
					},
				};
			},
			prompt(links, player) {
				const event = get.event();
				return `###清严###展示${get.cnNumber(event.qingyanCount)}张手牌，视为使用一张${get.translation(links[0][2])}`;
			},
		},
		hiddenCard(player, name) {
			if (!["shan", "wuxie"].includes(name)) {
				return false;
			}
			if (player.countCards("h", card => card.hasGaintag("potqingyan"))) {
				return false;
			}
			const num = player.getRoundHistory("useSkill", evt => evt.skill == "potqingyan").length + 1;
			return player.countCards("h") >= num;
		},
		ai: {
			order(item, player) {
				player ??= get.player();
				return get.order({ name: "shan" }, player) + 0.1;
			},
			result: {
				player: 1,
			},
		},
	},
	potceduan: {
		audio: 3,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target.inRange(player);
		},
		async content(event, trigger, player) {
			const { target } = event,
				targets = game.filterPlayer(current => target.inRange(current) && current.countCards("h"));
			const map = await game.chooseAnyOL(targets, get.info(event.name).showCard, []).forResult();
			const cards = [];
			for (const target of targets) {
				const result = map.get(target);
				if (result?.bool && result.cards?.length) {
					cards.addArray(result.cards);
				}
			}
			if (!cards?.length) {
				return;
			}
			await player.showCards(cards, `${get.translation(player)}发动了【策断】`).set("multipleShow", true);
			const colorMap = new Map();
			for (const card of cards) {
				const color = get.color(card);
				let num = 0;
				if (colorMap.has(color)) {
					num = colorMap.get(color);
				}
				num++;
				colorMap.set(color, num);
			}
			const colors = Array.from(colorMap.keys()),
				maxColor = colors.maxBy(color => colorMap.get(color));
			if (!maxColor) {
				return;
			}
			const num = colorMap.get(maxColor);
			const cards2 = player.getCards("h", card => {
				const color = get.color(card);
				return colorMap.has(color) && colorMap.get(color) == num;
			});
			if (cards2.length) {
				const card = get.autoViewAs({ name: "sha" }, cards2);
				if (player.canUse(card, target, false, true)) {
					const next = player.useCard(card, cards2, target, false);
					await next;
					if (player.hasHistory("sourceDamage", evt => evt.getParent(2) == next)) {
						await player.draw();
					}
				}
			}
		},
		showCard(player, eventId) {
			const next = player.chooseCard("策断：展示一张手牌", "h", true);
			next.set("id", eventId);
			next.set("_global_waiting", true);
			return next;
		},
		ai: {
			order(item, player) {
				player ??= get.player();
				return get.order({ name: "sha" }, player) + 0.1;
			},
			result: {
				target(player, target) {
					const card = get.autoViewAs({ name: "sha" }, "unsure");
					if (player.canUse(card, target, false, true)) {
						return get.effect(target, card, player, target);
					}
					return 0;
				},
				player(player) {
					if (player.countCards("h") >= 4) {
						return -3;
					}
					return -1;
				},
			},
		},
	},
	//旧的势邓艾（神笔三技能互绑的三血白）
	old_pottuntian: {
		audio: "pottuntian",
		beginMarkCount: 1,
		chargeSkill: 3,
		getNum(player) {
			const num = game
				.getGlobalHistory("everything", evt => {
					if (evt.player != player || evt.name != "removeMark") {
						return false;
					}
					return evt.markName == "charge";
				})
				.reduce((sum, evt) => sum + evt.num, 0);
			return num;
		},
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCharge();
		},
		filterTarget(event, player, target) {
			return target.countCards("he");
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.removeCharge();
			const { cards } = await target
				.chooseCard("he", true, "选择一张牌置于" + get.translation(player) + "的武将牌上作为「田」")
				.set("ai", card => {
					const player = get.player(),
						target = get.event().target,
						att = get.attitude(player, target);
					if (att <= 0) {
						return 6 - get.value(card);
					}
					return target.getUseValue(card);
				})
				.set("target", player)
				.forResult();
			if (cards?.length) {
				const next = player.addToExpansion(cards, target, "give");
				next.gaintag.add("old_pottuntian");
				await next;
			}
		},
		marktext: "田",
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
		group: ["old_pottuntian_init", "old_pottuntian_biyue", "old_pottuntian_addCharge"],
		subSkill: {
			init: {
				audio: "pottuntian",
				trigger: {
					player: "enterGame",
					global: "phaseBefore",
				},
				filter(event, player) {
					if (!player.countCharge(true)) {
						return false;
					}
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const num = lib.skill.old_pottuntian.beginMarkCount;
					player.addCharge(num);
				},
			},
			biyue: {
				audio: "pottuntian",
				trigger: { player: "phaseEnd" },
				filter(event, player) {
					const num = lib.skill.old_pottuntian.getNum(player);
					return num > 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const num = lib.skill.old_pottuntian.getNum(player);
					if (num > 0) {
						await player.draw(num);
					}
				},
			},
			addCharge: {
				audio: "pottuntian",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (player == _status.currentPhase || !player.countCharge(true)) {
						return false;
					}
					//我真没招了
					if (event.name != "addToExpansion") {
						if (event.name == "lose" && event.getlx !== false) {
							for (var i in event.gaintag_map) {
								if (event.gaintag_map[i].includes("old_pottuntian")) {
									return true;
								}
							}
						}
						if (
							game.getGlobalHistory("cardMove", evt => {
								if (evt.name != "lose" || event != evt.getParent()) {
									return false;
								}
								for (var i in evt.gaintag_map) {
									if (evt.gaintag_map[i].includes("old_pottuntian") && evt.player == player) {
										return true;
									}
								}
								return false;
							}).length
						) {
							return true;
						}
					}
					if (event.name == "gain" && event.player == player) {
						return false;
					}
					const evt = event.getl(player);
					return evt && evt.cards2 && evt.cards2.length > 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					player.addCharge(1);
				},
			},
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					return get.effect(target, { name: "shunshou_copy2" }, player, player);
				},
			},
			//剩下这部分ai直接照抄手杀界屯田力
			effect: {
				target() {
					return lib.skill.tuntian.ai.effect.target.apply(this, arguments);
				},
			},
			threaten(player, target) {
				if (target.countCards("h") == 0) {
					return 2;
				}
				return 0.5;
			},
			nodiscard: true,
			nolose: true,
			notemp: true,
		},
	},
};
