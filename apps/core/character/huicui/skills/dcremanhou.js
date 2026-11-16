import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcremanhou" | "dcretanluan" | "dcmanhou" | "dctanluan" | "dcxidi" | "dcchengyan">} */
export const groupSkills = {
	//群祝融
	dcremanhou: {
		audio: "dcmanhou",
		enable: "phaseUse",
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("###蛮后###摸至多四张牌并执行等量项");
			},
			chooseControl(event, player) {
				var list = Array.from({
					length: 4,
				}).map((_, i) => get.cnNumber(i + 1) + "张");
				list.push("cancel2");
				return list;
			},
			check(event, player) {
				if (get.effect(player, { name: "losehp" }, player, player) > 4 || player.countCards("hs", card => player.canSaveCard(card, player)) > 0 || player.hp > 2) {
					return "四张";
				}
				return "两张";
			},
			backup(result, player) {
				return {
					num: result.control,
					audio: "dcmanhou",
					filterCard: () => false,
					selectCard: -1,
					async content(event, trigger, player) {
						var num =
							Array.from({
								length: 4,
							})
								.map((_, i) => get.cnNumber(i + 1) + "张")
								.indexOf(lib.skill.dcremanhou_backup.num) + 1;
						await player.draw(num);
						if (num >= 1) {
							await player.removeSkills("dcretanluan");
						}
						if (num >= 2 && player.countCards("h")) {
							await player.chooseToDiscard("h", true);
						}
						if (num >= 3) {
							//await player.loseHp();
							if (game.hasPlayer(target => target.countDiscardableCards(player, "ej"))) {
								const [target] =
									(
										await player
											.chooseTarget(
												"弃置场上的一张牌",
												(card, player, target) => {
													return target.countDiscardableCards(player, "ej");
												},
												true
											)
											.set("ai", target => {
												const player = get.player();
												return get.effect(target, { name: "guohe_copy", position: "ej" }, player, player);
											})
											.forResult()
									).targets ?? [];
								if (target) {
									player.line(target);
									await player.discardPlayerCard(target, "ej", true);
								}
							}
						}
						if (num >= 4) {
							await player.loseHp();
							/*if (player.countCards("h")) {
								await player.chooseToDiscard("he", true);
							}*/
							await player.addSkills("dcretanluan");
						}
					},
				};
			},
		},
		ai: {
			order: 8,
			result: { player: 1 },
		},
		subSkill: { backup: {} },
		derivation: "dcretanluan",
	},
	dcretanluan: {
		init(player, skill) {
			if (typeof player.getStat("skill")?.[skill] === "number") {
				delete player.getStat("skill")[skill];
			}
		},
		onChooseToUse(event) {
			if (!game.online && !event.dcretanluan) {
				event.set(
					"dcretanluan",
					game.filterPlayer2().reduce((list, target) => {
						return list.addArray(
							target
								.getHistory("lose", evt => {
									return evt.type === "discard";
								})
								.map(evt => evt.cards.filterInD("d"))
								.flat()
								.unique()
						);
					}, [])
				);
			}
		},
		audio: "dctanluan",
		enable: "phaseUse",
		filter(event, player) {
			return event.dcretanluan?.some(card => player.hasUseTarget(card));
		},
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				const dialog = ui.create.dialog('###探乱###<div class="text center">' + lib.translate.dcretanluan_info + "</div>");
				dialog.add(event.dcretanluan);
				return dialog;
			},
			filter(button, player) {
				return player.hasUseTarget(button.link);
			},
			check(button) {
				const card = button.link;
				return get.player().getUseValue(card) * (get.tag(card, "damage") >= 1 ? 3 : 1);
			},
			prompt(links) {
				return '###探乱###<div class="text center">使用' + get.translation(links) + "，若此牌被【无懈可击】抵消或你因此对其他角色造成伤害，则重置〖蛮后〗</div>";
			},
			backup(links, player) {
				return {
					audio: "dctanluan",
					filterCard: () => false,
					selectCard: -1,
					popname: true,
					viewAs: links[0],
					card: links[0],
					async precontent(event, trigger, player) {
						player.addTempSkill("dcretanluan_effect");
						const card = get.info("dcretanluan_backup").card;
						event.result.cards = [card];
						event.result.card = get.autoViewAs(card, [card]);
						event.result.card.dcretanluan = true;
					},
				};
			},
		},
		subSkill: {
			backup: {},
			effect: {
				charlotte: true,
				audio: "dctanluan",
				trigger: {
					source: "damageSource",
					player: "eventNeutralized",
				},
				filter(event, player) {
					if (typeof player.getStat("skill")["dcremanhou"] !== "number") {
						return false;
					}
					if (event.name == "damage") {
						return event.card?.dcretanluan === true && event.player != player;
					}
					if (event.type != "card" && event.name != "_wuxie") {
						return false;
					}
					return event.card?.dcretanluan === true; // && !player.getStorage("dcremanhou_record").includes(event.player)
				},
				forced: true,
				async content(event, trigger, player) {
					delete player.getStat("skill")["dcremanhou"];
					player.popup("dcremanhou");
					game.log(player, "重置了技能", "【" + get.translation("dcremanhou") + "】");
					/*player.addTempSkill("dcremanhou_record");
					player.markAuto("dcremanhou_record", [trigger.player]);*/
				},
			},
			record: {
				charlotte: true,
				onremove: true,
				intro: { content: "【探乱】已记录角色：$" },
			},
		},
	},
	dcmanhou: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("###蛮后###摸至多四张牌并执行等量项");
			},
			chooseControl(event, player) {
				var list = Array.from({
					length: 4,
				}).map((_, i) => get.cnNumber(i + 1) + "张");
				list.push("cancel2");
				return list;
			},
			check(event, player) {
				if (get.effect(player, { name: "losehp" }, player, player) > 4 || player.countCards("hs", card => player.canSaveCard(card, player)) > 0 || player.hp > 2) {
					return "四张";
				}
				return "两张";
			},
			backup(result, player) {
				return {
					num: result.control,
					audio: "dcmanhou",
					filterCard: () => false,
					selectCard: -1,
					async content(event, trigger, player) {
						var num =
							Array.from({
								length: 4,
							})
								.map((_, i) => get.cnNumber(i + 1) + "张")
								.indexOf(lib.skill.dcmanhou_backup.num) + 1;
						await player.draw(num);
						if (num >= 1) {
							await player.removeSkills("dctanluan");
						}
						if (num >= 2 && player.countCards("h")) {
							await player.chooseToDiscard("h", true);
						}
						if (num >= 3) {
							await player.loseHp();
						}
						if (num >= 4) {
							if (player.countCards("he")) {
								await player.chooseToDiscard("he", true);
							}
							await player.addSkills("dctanluan");
						}
					},
				};
			},
		},
		ai: {
			order: 8,
			result: { player: 1 },
		},
		subSkill: { backup: {} },
	},
	dctanluan: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.isFirstTarget;
		},
		locked: true,
		async cost(event, trigger, player) {
			const num = trigger.targets.length,
				num1 = game.filterPlayer(current => !trigger.targets.includes(current)).length;
			if (num >= num1 && trigger.targets.some(current => current.countDiscardableCards(player, "ej"))) {
				event.result = await player
					.chooseTarget(get.prompt(event.skill), (card, player, target) => {
						const evt = _status.event.getTrigger();
						return evt.targets.includes(target) && target.countDiscardableCards(player, "ej");
					})
					.set("ai", target => {
						const player = get.player();
						const att = get.attitude(player, target);
						if (
							att > 0 &&
							(target.countCards("j") > 0 ||
								target.countCards("e", card => {
									return get.value(card, target) < 0;
								}))
						) {
							return 2;
						}
						if (att < 0 && target.countCards("e") > 0 && !target.hasSkillTag("noe")) {
							return -1;
						}
						return 0;
					})
					.forResult();
			} else {
				event.result = {
					bool: true,
				};
			}
		},
		async content(event, trigger, player) {
			if (event.targets && event.targets.length) {
				await player.discardPlayerCard(event.targets[0], "ej", `弃置${get.translation(event.targets[0])}场上的一张牌`, true);
			} else {
				player.addTempSkill("dctanluan_add");
			}
		},
		subSkill: {
			add: {
				audio: "dctanluan",
				trigger: {
					player: "useCard2",
				},
				async cost(event, trigger, player) {
					player.removeSkill("dctanluan_add");
					var goon = false;
					var info = get.info(trigger.card);
					if (!["basic", "trick"].includes(get.type(trigger.card))) {
						return;
					}
					if (trigger.targets && !info.multitarget) {
						if (
							game.hasPlayer(function (current) {
								return !trigger.targets.includes(current) && lib.filter.targetEnabled2(trigger.card, player, current);
							})
						) {
							goon = true;
						}
					}
					if (!goon) {
						return;
					}
					event.result = await player
						.chooseTarget("是否发动【探乱】？", `为${get.translation(trigger.card)}添加一个目标`, (card, player, target) => {
							const evt = _status.event.getTrigger();
							return !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target);
						})
						.set("ai", target => {
							return get.effect(target, _status.event.getTrigger().card, get.player());
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const targets = event.targets;
					player.line(targets, "green");
					trigger.targets.addArray(targets);
				},
			},
		},
	},
	//乐诸葛果
	dcxidi: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			const cards = player.getCards("h");
			player.addGaintag(cards, "dcxidi_tag");
		},
		mod: {
			ignoredHandcard(card) {
				if (card.hasGaintag("dcxidi_tag")) {
					return true;
				}
			},
			cardDiscardable(card, _, name) {
				if (name == "phaseDiscard" && card.hasGaintag("dcxidi_tag")) {
					return false;
				}
			},
		},
		group: "dcxidi_guanxing",
		subSkill: {
			guanxing: {
				audio: "dcxidi",
				trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
				forced: true,
				locked: false,
				preHidden: true,
				async content(event, trigger, player) {
					const num = Math.max(
						1,
						player.countCards("h", card => card.hasGaintag("dcxidi_tag"))
					);
					const result = player.chooseToGuanxing(num).set("prompt", "羲笛：点击或拖动将牌移动到牌堆顶或牌堆底").forResult();
					if (!result.bool || !result.moved[0].length) {
						player.addTempSkill("guanxing_fail");
					}
				},
				ai: {
					guanxing: true,
					skillTagFilter(player, tag, arg) {
						if (tag === "guanxing") {
							return true;
						}
					},
				},
			},
		},
	},
	dcchengyan: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (event.card.name != "sha" && get.type(event.card) != "trick") {
				return false;
			}
			if (!event.isFirstTarget) {
				return false;
			}
			return event.target != player;
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const target = trigger.target;
			const cards = (await player.draw().forResult()).cards;
			if (get.itemtype(cards) != "cards") {
				return;
			}
			await player.showCards(cards, get.translation(player) + "发动了【乘烟】");
			const card = cards[0];
			if (card.name == "sha" || (get.type(card, false) == "trick" && get.info(card, false).filterTarget)) {
				player.addTempSkill("dcchengyan_effect");
				player.markAuto("dcchengyan_effect", [[trigger.card, card, target]]);
			} else {
				await player.draw().set("gaintag", ["dcxidi_tag"]);
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { player: "useCardToBegin" },
				filter(event, player) {
					const storage = player.getStorage("dcchengyan_effect");
					return storage.some(list => list[0] == event.card && list[2] == event.target);
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					const list = player.getStorage("dcchengyan_effect").find(list => list[0] == trigger.card && list[2] == trigger.target);
					trigger.setContent(lib.card[list[1].name].content);
				},
			},
		},
	},
};
