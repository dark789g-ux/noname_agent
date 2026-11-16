import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olpijing" | "olqushi" | "olweijie">} */
export const groupSkills = {
	//刘磐
	olpijing: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return (event.card.name == "sha" || get.type(event.card) == "trick") && event.targets.length == 1;
		},
		usable: 1,
		locked: false,
		async cost(event, trigger, player) {
			const num = Math.max(1, player.getDamagedHp());
			event.result = await player
				.chooseTarget(get.prompt(event.skill), [1, num], (card, player, target) => {
					const trigger = get.event().getTrigger();
					if (target == player) {
						return false;
					}
					if (trigger.targets.includes(target)) {
						return true;
					}
					return lib.filter.targetEnabled2(trigger.card, player, target) && lib.filter.targetInRange(trigger.card, player, target);
				})
				.set("ai", target => {
					const player = get.event().player,
						trigger = get.event().getTrigger();
					return (trigger.targets.includes(target) ? -1 : 1) * get.effect(target, trigger.card, player, player) * (target.getStorage("olpijing_effect").includes(player) ? 2 : 1) + get.effect(target, { name: "shunshou_copy2" }, player, player);
				})
				.set("prompt2", "令至多" + get.cnNumber(num) + "名角色成为或取消成为" + get.translation(trigger.card) + "的目标并随机交给你一张牌")
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets;
			for (const i of targets) {
				trigger.targets[!trigger.targets.includes(i) ? "add" : "remove"](i);
			}
			for (const target of targets) {
				target.addSkill("olpijing_effect");
				target.markAuto("olpijing_effect", [player]);
				const cards = target.getGainableCards(player, "he");
				if (cards.length) {
					await target.give(cards.randomGets(1), player);
				}
			}
		},
		mod: {
			aiOrder(player, card, num) {
				if (!(card.name == "sha" || get.type(card) == "trick")) {
					return;
				}
				const info = get.info(card);
				if (
					info &&
					!info.notarget &&
					(info.toself || info.singleCard || !info.selectTarget || info.selectTarget == 1) &&
					game.countPlayer(target => {
						if (get.effect(target, card, player, player) <= 0) {
							return false;
						}
						return lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
					}) > 1
				) {
					return num + 0.01;
				}
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "使用的下一张基本牌或普通锦囊牌指定唯一目标时，可指定$为额外目标或摸一张牌",
				},
				trigger: { player: "useCardToPlayer" },
				filter(event, player) {
					return (get.type(event.card) == "basic" || get.type(event.card) == "trick") && event.targets.length == 1;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const storage = player.getStorage("olpijing_effect");
					player.removeSkill("olpijing_effect");
					const { bool, targets } = await player
						.chooseTarget("披荆：请选择此牌的额外目标", [1, storage.length], (card, player, target) => {
							const trigger = get.event().getTrigger();
							return !trigger.targets.includes(target) && get.event().storage.includes(target) && lib.filter.targetEnabled2(trigger.card, player, target) && lib.filter.targetInRange(trigger.card, player, target);
						})
						.set("prompt2", "不选择的角色视为你选择摸牌项")
						.set("ai", target => {
							const player = get.event().player,
								trigger = get.event().getTrigger();
							return get.effect(target, trigger.card, player, player) - get.effect(player, { name: "draw" }, player, player);
						})
						.set("storage", storage)
						.forResult();
					if (bool) {
						player.line(targets);
						trigger.targets.addArray(targets);
						if (storage.length - targets.length > 0) {
							player.draw(storage.length - targets.length);
						}
					} else {
						player.draw(storage.length);
					}
				},
			},
		},
	},
	//郭图
	olqushi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		delay: false,
		async content(event, trigger, player) {
			await player.draw();
			if (player.countCards("h") && game.hasPlayer(target => target != player)) {
				const { bool, targets, cards } = await player
					.chooseCardTarget({
						forced: true,
						prompt: "将一张手牌作为“趋”扣置于其他角色的武将牌上",
						filterTarget: lib.filter.notMe,
						filterCard: true,
						position: "h",
						ai1(card) {
							if (get.type2(card, false) == "equip") {
								return 1 - get.value(card);
							}
							return 7 - get.value(card);
						},
						ai2(target) {
							const att = get.sgn(get.sgn(get.attitude(get.event().player, target)) + 0.5);
							return (target.countCards("h") + 1) * att;
						},
					})
					.forResult();
				if (bool) {
					const target = targets[0];
					target.addSkill("olqushi_effect");
					target.markAuto("olqushi_effect", [player]);
					game.log(player, "将一张牌扣置于", target, "的武将牌上");
					target.addToExpansion(cards, player, "giveAuto").gaintag.add("olqushi_effect");
				}
			}
		},
		ai: {
			order: 1,
			result: { player: 1 },
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					const cards = player.getExpansions(skill);
					if (cards.length) {
						player.loseToDiscardpile(cards);
					}
				},
				marktext: "趋",
				intro: {
					content: "expansion",
					markcount: "expansion",
					mark(dialog, storage, player) {
						if (storage.some(source => source.isUnderControl(true))) {
							dialog.add(player.getExpansions("olqushi_effect"));
						} else {
							return "共扣置" + get.cnNumber(player.getExpansions("olqushi_effect").length) + "张“趋”";
						}
					},
				},
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const cards = player.getExpansions("olqushi_effect");
					if (cards.length) {
						await player.loseToDiscardpile(cards);
						const targets = player
							.getStorage("olqushi_effect")
							.filter(i => {
								return i.isIn();
							})
							.sortBySeat();
						const num = Math.min(
							player
								.getHistory("useCard", evt => {
									return evt.targets && evt.targets.length;
								})
								.reduce((targets, evt) => {
									targets.addArray(evt.targets);
									return targets;
								}, []).length,
							5
						);
						if (
							targets.length &&
							num > 0 &&
							player.getHistory("useCard", evt => {
								return cards.some(card => get.type2(card) == get.type2(evt.card));
							}).length
						) {
							for (const target of targets) {
								await target.draw(num);
							}
						}
					}
					player.removeSkill("olqushi_effect");
				},
			},
		},
	},
	olweijie: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		filter(event, player) {
			if (
				!game.hasPlayer(target => {
					return get.distance(player, target) == 1 && target.countDiscardableCards(player, "h");
				}) ||
				_status.currentPhase === player ||
				event.olweijie
			) {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2];
					return get.type(name) == "basic";
				})
				.some(card => event.filterCard({ name: card[2], nature: card[3], isCard: true }, player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const list = get
					.inpileVCardList(info => {
						const name = info[2];
						return get.type(name) == "basic";
					})
					.filter(card => event.filterCard({ name: card[2], nature: card[3], isCard: true }, player, event));
				return ui.create.dialog("诿解", [list, "vcard"]);
			},
			filter(button, player) {
				return get.event().getParent().filterCard({ name: button.link[2], nature: button.link[3], isCard: true }, player, _status.event.getParent());
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				return get.event().player.getUseValue({ name: button.link[2], nature: button.link[3], isCard: true });
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
					},
					filterCard: () => false,
					selectCard: -1,
					log: false,
					async precontent(event, trigger, player) {
						let stop = false;
						const result = await player
							.chooseTarget("请选择一名距离为1的角色", "弃置其一张手牌，若此牌牌名为【" + get.translation(event.result.card.name) + "】，则视为你使用/打出之", (card, player, target) => {
								return get.distance(player, target) == 1 && target.countDiscardableCards(player, "h");
							})
							.set("ai", target => 1 - get.sgn(get.attitude(get.event().player, target)))
							.forResult();
						if (result?.bool) {
							const target = result.targets[0];
							player.logSkill("olweijie", target);
							player.tempBanSkill("olweijie", null, false);
							const result2 = await player
								.discardPlayerCard(target, "h", true)
								.set("prompt2", "若弃置的牌名为【" + get.translation(event.result.card.name) + "】，则视为你使用/打出之")
								.set("ai", button => {
									if (button.link.isKnownBy(get.event().player) && button.link.name == get.event().namex) {
										return 114514;
									}
									return 1 + Math.random();
								})
								.set("namex", event.result.card.name)
								.forResult();
							if (result2?.bool) {
								const card = result2.cards[0];
								if (get.name(card, target) == event.result.card.name) {
									player.popup("洗具");
									stop = true;
								} else {
									player.popup("杯具");
								}
							}
						}
						if (!stop) {
							const evt = event.getParent();
							evt.set("olweijie", true);
							evt.goto(0);
							delete evt.openskilldialog;
							return;
						}
					},
				};
			},
			prompt(links, player) {
				const nature = get.translation(links[0][3]) || "";
				const name = "【" + get.translation(links[0][2]) + "】";
				return "弃置距离为1的一名角色的一张手牌，若此牌牌名为" + name + "，则你视为使用" + nature + name;
			},
		},
		ai: {
			order: 10,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag) {
				const name = tag == "respondSha" ? "sha" : "shan";
				return lib.skill.olweijie.hiddenCard(player, name);
			},
			result: {
				player(player) {
					if (_status.event.dying && get.attitude(player, _status.event.dying) <= 0) {
						return 0;
					}
					return game.hasPlayer(target => {
						if (get.attitude(player, target) > 0) {
							return false;
						}
						return get.distance(player, target) == 1 && target.countCards("h");
					})
						? 1
						: 0;
				},
			},
		},
		hiddenCard(player, name) {
			if (!lib.inpile.includes(name) || _status.currentPhase === player || player.isTempBanned("olweijie")) {
				return false;
			}
			return (
				get.type(name) == "basic" &&
				game.hasPlayer(target => {
					return get.distance(player, target) == 1 && target.countCards("h");
				})
			);
		},
	},
};
