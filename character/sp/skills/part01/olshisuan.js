import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olshisuan" | "olzonglve" | "olkuangxiang" | "olrenxia" | "oltingji" | "olxuanliu">} */
export const groupSkills = {
	//牛辅
	olshisuan: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return player.hasCard(card => lib.filter.cardRecastable(card, player), "he");
		},
		forced: true,
		async content(event, trigger, player) {
			const result = await player.chooseToDiscard("he", true, "chooseonly").set("filterCard", lib.filter.cardRecastable).set("prompt", "请重铸一张牌").forResult();
			await player.recast(result.cards);
			const source = trigger.source;
			if (source?.isIn()) {
				player.line(source);
				const resultx = await source
					.chooseToGive(player, "e", "蓍算：交给" + get.translation(player) + "一张装备区的牌，或失去1点体力或将武将牌翻面")
					.set("ai", card => {
						const player = get.player();
						if (get.effect(player, { name: "losehp" }, player, player) > 0 || player.isTurnedOver()) {
							return 0;
						}
						return 8 - get.value(card);
					})
					.forResult();
				if (!resultx?.bool) {
					const result = await source
						.chooseControl("失去体力", "翻面")
						.set("ai", () => {
							const player = get.player(),
								target = get.event().getParent().player;
							if (player.isTurnedOver()) {
								return 0;
							}
							return get.effect(player, { name: "losehp" }, player, player) > 0
								? 0
								: (() => {
										if (player.hasCard(card => get.tag(card, "damage") && player.canUse(card, target, true, true) && player.getCardUsable(get.name(card)) >= 2 && get.effect(target, card, player, player) > 0, "hs")) {
											return 1;
										}
										return player.getHp() + player.countCards("hs", { name: "tao" }) <= 2 ? 1 : 0;
									})();
						})
						.set("prompt", "失去1点体力或将武将牌翻面")
						.forResult();
					if (result.index === 0) {
						await source.loseHp();
					} else {
						await source.turnOver();
					}
				}
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (_status._olshisuan_temp) {
						return;
					}
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target) || get.effect(player, { name: "losehp" }, player, player) > 0 || player.isTurnedOver()) {
							return [1, -2];
						}
						if (
							player.hasCard(
								cardx =>
									get.tag(cardx, "damage") &&
									player.canUse(cardx, target, true, true) &&
									!(card => {
										let list = [card];
										if (card.cards) {
											list.addArray(card.cards);
										}
										return list;
									})(card).includes(cardx) &&
									player.getCardUsable(get.name(card)) >= 2 &&
									(() => {
										_status._olshisuan_temp = true;
										let eff = get.effect(target, card, player, player) > 0;
										delete _status._olshisuan_temp;
										return eff;
									})(),
								"hs"
							)
						) {
							return [1, -2];
						}
						return [1, -0.5];
					}
				},
			},
		},
	},
	olzonglve: {
		audio: 2,
		trigger: { source: "damageSource" },
		filter(event, player) {
			if (event.player === player || !event.player.isIn() || !event.player.countCards("hej")) {
				return false;
			}
			return event.card?.name === "sha" && (!event.cards.length || event.cards.some(i => get.name(i, false) !== "sha"));
		},
		forced: true,
		locked: false,
		logTarget: "player",
		content() {
			const target = trigger.player;
			const num = ["h", "e", "j"].reduce((sum, pos) => sum + Boolean(target.countCards(pos)), 0);
			if (num) {
				player.gainPlayerCard(target, num, "hej", true).set("filterButton", button => {
					return !ui.selected.buttons.some(but => get.position(button.link) == get.position(but.link));
				});
			}
		},
		group: "olzonglve_wusheng",
		subSkill: {
			wusheng: {
				audio: "olzonglve",
				enable: "phaseUse",
				usable: 1,
				filter(event, player) {
					return player.countCards("hes") > 0;
				},
				filterCard: true,
				position: "hes",
				viewAs: { name: "sha" },
				prompt: "将一张牌当作【杀】使用",
				check(card) {
					return 6 - get.value(card);
				},
				ai: {
					respondSha: true,
					skillTagFilter(player, tag, arg) {
						if (arg === "respond" || !player.isPhaseUsing()) {
							return false;
						}
						if (player.getStat("skill").olzhonglve_wusheng || !player.countCards("hes")) {
							return false;
						}
					},
				},
			},
		},
	},
	//成公英
	olkuangxiang: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target.countCards("h") !== 4);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget(card, player, target) {
						return target.countCards("h") !== 4;
					},
					ai(target) {
						const att = get.attitude(get.player(), target);
						const num = target.countCards("h");
						if (num > 4) {
							return -att * (num - 4);
						}
						return att * Math.max(0, 4 - target.countCards("h"));
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const num = target.countCards("h");
			if (num > 4) {
				await target.chooseToDiscard("h", num - 4, true, "allowChooseAll");
			} else {
				const cards = (await target.draw(4 - num).forResult()).cards;
				if (Array.isArray(cards) && cards.length) {
					const black = cards.filter(card => get.color(card) === "black");
					const red = cards.filter(card => get.color(card) === "red").length;
					if (black.length) {
						target.addSkill("olkuangxiang_effect");
						target.addGaintag(black, "olkuangxiang_effect");
					}
					if (red > 0) {
						target.addSkill("olkuangxiang_buff");
						target.addMark("olkuangxiang_buff", red, false);
					}
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					if (!event.card) {
						return false;
					}
					const evt = event.getParent("useCard");
					if (!evt || evt.card !== event.card || evt.cards?.length !== 1) {
						return false;
					}
					return player.hasHistory("lose", evtx => (evtx.relatedEvent || evtx.getParent()) === evt && Object.keys(evtx.gaintag_map).some(i => evtx.gaintag_map[i].includes("olkuangxiang_effect")));
				},
				forced: true,
				logTarget: "player",
				content() {
					trigger.num++;
				},
			},
			buff: {
				charlotte: true,
				onremove: true,
				intro: { content: "下个摸牌阶段少摸#张牌" },
				trigger: { player: "phaseDrawBegin1" },
				filter(event, player) {
					return !event.numFixed;
				},
				forced: true,
				content() {
					trigger.num -= player.countMark(event.name);
					player.removeSkill(event.name);
				},
			},
		},
	},
	//王匡
	olrenxia: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				var dialog = ui.create.dialog("任侠：请选择一项", "hidden");
				dialog.add([
					[
						["discard", "重复弃置两张牌，直至手牌中没有【杀】或伤害类锦囊牌"],
						["draw", "重复摸两张牌，直至手牌中有【杀】或伤害类锦囊牌"],
					],
					"textbutton",
				]);
				return dialog;
			},
			filter(button, player) {
				if (button.link == "discard") {
					return player.hasCard(card => {
						if (!lib.filter.cardDiscardable(card, player, "renxia_discard")) {
							return false;
						}
						return card.name == "sha" || (get.type(card) == "trick" && get.tag(card, "damage") && get.type(card) != "delay");
					}, "he");
				}
				return true;
			},
			check(button) {
				const player = get.player();
				if (button.link == "discard") {
					return 2;
				}
				let bool = card => get.type(card) == "trick" && get.tag(card, "damage") && get.type(card) != "delay";
				if (player.countCards("h", "sha") > 1 && player.countCards("h", bool) > 1) {
					return 1;
				}
				return 3;
			},
			backup(links) {
				return get.copy(lib.skill["olrenxia_" + links[0]]);
			},
		},
		subSkill: {
			backup: { audio: "olrenxia" },
			discard: {
				audio: "olrenxia",
				async content(event, trigger, player) {
					while (true) {
						if (
							player.hasCard(card => {
								if (!lib.filter.cardDiscardable(card, player, "renxia_discard")) {
									return false;
								}
								return card.name == "sha" || (get.type(card) == "trick" && get.tag(card, "damage") && get.type(card) != "delay");
							}, "he")
						) {
							await player.chooseToDiscard(2, "he", true).set("ai", card => {
								let player = get.player();
								let bool = card => get.type(card) == "trick" && get.tag(card, "damage") && get.type(card) != "delay";
								if (card.name == "sha" || bool(card)) {
									return 10 - get.value(card);
								}
								return 5 - get.value(card);
							});
						} else {
							break;
						}
					}
					const evt = event.getParent("phaseUse", true);
					if (!evt || event.name == "renxia_discard") {
						return;
					}
					player
						.when("phaseUseEnd")
						.filter(evtx => evtx == evt)
						.step(async () => {
							const next = game.createEvent("renxia_draw", false);
							next.player = player;
							next.setContent(lib.skill.olrenxia_draw.content);
						});
				},
			},
			draw: {
				audio: "olrenxia",
				async content(event, trigger, player) {
					while (true) {
						await player.draw(2);
						if (player.hasCard(card => card.name == "sha" || (get.type(card) == "trick" && get.tag(card, "damage") > 0), "h")) {
							break;
						}
					}
					const evt = event.getParent("phaseUse", true);
					if (!evt || event.name == "renxia_draw") {
						return;
					}
					player
						.when("phaseUseEnd")
						.filter(evtx => evtx == evt)
						.step(async () => {
							const next = game.createEvent("renxia_discard", false);
							next.player = player;
							next.setContent(lib.skill.olrenxia_discard.content);
						});
				},
			},
		},
		ai: {
			order: 1,
			result: { player: 1 },
		},
	},
	//桥玄 —— by 刘巴
	oltingji: {
		audio: 2,
		mod: {
			inRange(from, to) {
				if (_status.currentPhase == from && !to.isDamaged()) {
					return true;
				}
			},
		},
		trigger: { global: "useCardToTargeted" },
		filter(event, player) {
			return event.target !== player && event.target.isIn() && !event.target.isDamaged() && _status.currentPhase === player;
		},
		forced: true,
		popup: false,
		async content(event, trigger, player) {
			trigger.getParent().directHit.add(trigger.target);
		},
	},
	olxuanliu: {
		audio: 2,
		trigger: {
			player: "phaseUseEnd",
		},
		filter(event, player) {
			return player.getHistory("sourceDamage", evt => {
				return evt.getParent("phaseUse") == event;
			}).length;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target !== player;
				})
				.set("ai", target => {
					return get.attitude(get.player(), target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			let target = event.targets[0];
			while (true) {
				await target.draw();
				const result = await target
					.chooseToUse({
						filterCard(card) {
							if (get.itemtype(card) != "card" || (get.position(card) != "h" && get.position(card) != "s")) {
								return false;
							}
							return lib.filter.filterCard.apply(this, arguments);
						},
						prompt: "是否使用一张手牌",
						addCount: false,
					})
					.forResult();
				if (
					result?.bool &&
					result.card &&
					player.getHistory("useCard", evt => {
						const card = evt.card;
						return !player.getStorage(event.name + "_save").includes(get.name(result.card, target)) && get.name(result.card, target) === get.name(card, target) && evt.getParent("phaseUse") === trigger;
					}).length
				) {
					player.markAuto(event.name + "_save", [get.name(result.card, target)]);
					player.addTempSkill(event.name + "_save");
				} else {
					return;
				}
			}
		},
		subSkill: {
			save: {
				charlotte: true,
				onremove: true,
			},
		},
	},
};
