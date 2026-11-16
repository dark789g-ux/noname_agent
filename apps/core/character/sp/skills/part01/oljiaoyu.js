import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oljiaoyu" | "olneixun" | "olxianying">} */
export const groupSkills = {
	//OL郭照
	oljiaoyu: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return [1, 2, 3, 4, 5].some(i => player.countEmptySlot(i));
		},
		forced: true,
		async content(event, trigger, player) {
			let num = [1, 2, 3, 4, 5].map(i => player.countEmptySlot(i)).reduce((p, c) => p + c, 0);
			if (!num) {
				return;
			}
			event.cards ??= [];
			while (num--) {
				const judgeEvent = player.judge();
				judgeEvent.judge2 = result => result.bool;
				judgeEvent.set("callback", async event => {
					event.getParent(2).cards.push(event.judgeResult.card);
				});
				await judgeEvent;
			}
			if (!event.cards.someInD("d")) {
				return;
			}
			event.cards = event.cards.filterInD("d");
			const list = Object.keys(lib.color);
			const color = event.cards
				.map(card => get.color(card))
				.unique()
				.sort((a, b) => list.indexOf(a) - list.indexOf(b));
			if (!color.length) {
				return;
			}
			const dialog = ["椒遇：选择获得一种颜色的牌"];
			for (let i = 0; i < color.length; i++) {
				const colorx = color[i];
				const cards = event.cards.filter(card => get.color(card) == colorx);
				if (cards.length) {
					dialog.addArray([`<span class="text center">${get.translation(colorx)}</span>`, cards]);
				}
			}
			const result =
				color.length > 1
					? await player
							.chooseControl(color)
							.set("ai", () => {
								let { player, controls } = get.event();
								const { cards } = get.event().getParent();
								return controls.sort((a, b) => {
									return get.value(cards.filter(card => get.color(card) === b)) - get.value(cards.filter(card => get.color(card) === a));
								})[0];
							})
							.set("dialog", dialog)
							.forResult()
					: { control: color[0] };
			const control = result?.control;
			if (control) {
				player.popup(control);
				game.log(player, "声明了", "#g" + get.translation(control));
				const effect = "oljiaoyu_effect";
				player.addTempSkill(effect, "roundStart");
				player.markAuto(effect, [control]);
				player.storage[effect].sort((a, b) => list.indexOf(a) - list.indexOf(b));
				player.addTip(effect, get.translation(effect) + player.getStorage(effect).reduce((str, color) => str + get.translation(color), " "));
				player.addTempSkill("oljiaoyu_phaseChange", "roundStart");
				const cards = event.cards.filter(card => get.color(card) === control);
				if (cards.length) {
					await player.gain(cards, "gain2");
				}
			}
		},
		subSkill: {
			phaseChange: {
				audio: "oljiaoyu",
				trigger: { player: "phaseEnd" },
				forced: true,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					player.addSkill("oljiaoyu_ban");
					trigger.phaseList.splice(trigger.num, 0, "phaseUse|oljiaoyu");
				},
			},
			ban: {
				charlotte: true,
				mod: {
					cardEnabled(card, player) {
						const event = get.event().getParent("phaseUse");
						if (event._extraPhaseReason !== "oljiaoyu" || event.player !== player) {
							return;
						}
						if (get.color(card) == "unsure") {
							return true;
						}
						if ([card].concat(card.cards || []).some(cardx => !player.getStorage("oljiaoyu_effect").includes(get.color(cardx)))) {
							return false;
						}
					},
					cardSavable(card, player) {
						return lib.skill.oljiaoyu_ban.mod.cardEnabled.apply(this, arguments);
					},
				},
				trigger: { player: "phaseUseBegin" },
				filter(event, player) {
					if (event._extraPhaseReason !== "oljiaoyu") {
						return false;
					}
					return game.hasPlayer(current => player != current);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const targets = game.filterPlayer(current => player !== current);
					if (targets.length) {
						for (const target of targets) {
							target.addTempSkill("oljiaoyu_debuff", "phaseChange");
							target.storage.oljiaoyu_debuff = player;
						}
					}
				},
			},
			debuff: {
				charlotte: true,
				onremove: true,
				mod: {
					cardEnabled(card, player) {
						const target = player.storage.oljiaoyu_debuff;
						if (!target?.isIn() || !target.countCards("e")) {
							return;
						}
						if (get.color(card) == "unsure") {
							return true;
						}
						if ([card].concat(card.cards || []).some(cardx => target.hasCard(c => get.color(c) === get.color(cardx), "e"))) {
							return false;
						}
					},
					cardSavable(card, player) {
						return lib.skill.oljiaoyu_debuff.mod.cardEnabled.apply(this, arguments);
					},
				},
				trigger: { global: "damageBegin4" },
				forced: true,
				popup: false,
				content() {
					player.removeSkill(event.name);
				},
			},
			effect: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				intro: { content: "本轮〖椒遇〗声明的颜色为：$" },
			},
		},
	},
	olneixun: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		forced: true,
		filter(event, player) {
			if (event.player == player || event.player != _status.currentPhase) {
				return false;
			}
			if (event.player.getHistory("useCard", evt => get.type(evt.card) != "equip").indexOf(event) !== 0) {
				return false;
			}
			const storage = player.getStorage("oljiaoyu_effect");
			if (!storage.length) {
				return false;
			}
			return storage.includes(get.color(event.card)) ? player.countCards("he") : event.player.countGainableCards(player, "he");
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const { card, player: target } = trigger;
			const bool = player.getStorage("oljiaoyu_effect").includes(get.color(card));
			const effect = event.name + "_effect";
			if (bool && player.countCards("he")) {
				await player.chooseToGive(target, "he", true).set("ai", card => {
					const { player, target } = get.event();
					const att = get.attitude(player, target);
					if (att > 0 && player.hasSkill("oljiaoyu") && get.position(card) == "e") {
						return 10 - get.value(card);
					}
					return 6 - get.value(card);
				});
				player.addTempSkill(effect, { player: "phaseAfter" });
				const next = player.draw();
				next.gaintag.add(effect);
				await next;
			} else if (!bool && target.countGainableCards(player, "he")) {
				player.addTempSkill(effect, { player: "phaseAfter" });
				const next = player.gainPlayerCard(target, "he", true);
				next.gaintag.add(effect);
				await next;
				await target.draw();
			}
		},
		ai: { combo: "oljiaoyu" },
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("olneixun_effect")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("olneixun_effect")) {
							return false;
						}
					},
				},
			},
		},
	},
	//OL秦朗
	olxianying: {
		audio: 2,
		trigger: { player: ["damageEnd", "phaseZhunbeiBegin"] },
		check(event, player) {
			const num = player.getRoundHistory("useSkill", evt => evt.skill == "olxianying").length;
			if (num > 2) {
				const num2 = player.countCards("he");
				return !num2 || num2 > num + 1 || num2 + 2 < num + 1;
			}
			return true;
		},
		async content(event, trigger, player) {
			await player.draw(2);
			const hs = player.getCards("he", card => lib.filter.cardDiscardable(card, player, "olxianying"));
			const record = event.name + "_record",
				effect = event.name + "_effect",
				storage = player.getStorage(record),
				choices = Array.from({ length: hs.length + 1 })
					.map((_, i) => i)
					.filter(i => !storage.includes(i));
			player.addTempSkill(record, "roundStart");
			let result;
			switch (Math.sign(hs.length - Math.min(...choices))) {
				case -1:
					result = { bool: false };
					break;
				case 0:
					result = { bool: true, cards: hs };
					break;
				case 1:
					result = await player
						.chooseToDiscard("he", [0, Infinity], get.prompt(event.name), `你可以弃置任意张牌，若这些牌同名，则本回合结束时你可以视为使用之${storage.length ? `（本轮已弃置过的牌数：${storage}）` : ``}`, true, "allowChooseAll")
						.set("filterOk", () => {
							return !get.event().storage.includes(ui.selected.cards.length);
						})
						.set("chooseonly", true)
						.set("storage", storage)
						.set("choices", choices)
						.set("ai", card => {
							const { player, names, choices } = get.event();
							const list = names.filter(i => i[1] > choices.remove(0)[0]).map(i => i[0]);
							if (list.length) {
								let num = choices.remove(0)[0];
								if (ui.selected.cards.length >= num) {
									return 0;
								}
								if (!list.includes(get.name(card, player))) {
									return 0;
								}
								return 15 - get.value(card);
							} else {
								let num = choices[0];
								if (ui.selected.cards.length >= num) {
									return 0;
								}
								return 6 - get.value(card);
							}
						})
						.set(
							"names",
							(function () {
								const hs = player.getCards("he", card => {
									if (!lib.filter.cardDiscardable(card, player)) {
										return false;
									}
									return player.hasValueTarget(card) && ["basic", "trick"].includes(get.type(card));
								});
								return hs
									.map(i => get.name(i, player))
									.reduce((arr, name) => {
										const index = arr.find(item => item[0] == name);
										if (!index) {
											arr.push([name, 1]);
										} else {
											index[1]++;
										}
										return arr;
									}, [])
									.sort((a, b) => b[1] - a[1]);
							})()
						)
						.forResult();
					break;
			}
			if (result?.bool) {
				const cards = result.cards || [];
				if (cards.length) {
					await player.discard(cards);
				}
				player.markAuto(record, [cards.length]);
				player.storage[record].sort((a, b) => a - b);
				player.addTip(record, [get.translation(record), ...player.storage[record]].join(" "));
				const names = cards.map(card => get.name(card, player)).toUniqued();
				if (names.length !== 1 || !["basic", "trick"].includes(get.type(names[0]))) {
					return;
				}
				player.addTempSkill(effect);
				player.storage[effect].push(names[0]);
				player.markSkill(effect);
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend() || target.getStorage("olxianying_record").length > 3) {
							return;
						}
						if (target.hp >= 4) {
							return [1, 2];
						}
						if (target.hp == 3) {
							return [1, 1.5];
						}
						if (target.hp == 2) {
							return [1, 0.5];
						}
					}
				},
			},
		},
		subSkill: {
			record: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				intro: { content: "本轮因【贤膺】已经弃置牌数：$" },
			},
			effect: {
				charlotte: true,
				onremove: true,
				init(player, skill) {
					player.storage[skill] ??= [];
				},
				trigger: { global: "phaseEnd" },
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					let cards = player.getStorage(event.name).filter(name => player.hasUseTarget(get.autoViewAs({ name: name, isCard: true })));
					while (cards.length) {
						const { bool, links } = await player
							.chooseButton(["贤膺：是否使用视为其中一张牌？", [cards, "vcard"]])
							.set("filterButton", button => {
								return get.player().hasUseTarget(button.link[2]);
							})
							.set("ai", button => {
								return get.player().getUseValue(button.link[2]);
							})
							.forResult();
						if (bool) {
							const name = links[0][2],
								card = get.autoViewAs({ name: name, isCard: true });
							cards.remove(name);
							await game.delayx();
							await player.chooseUseTarget(true, card, false);
						} else {
							break;
						}
					}
					player.removeSkill(event.name);
				},
				intro: { content: (storage, player) => `本回合结束时可以视为使用牌名：${storage.map(i => get.translation(i)).join("、")}` },
			},
		},
	},
};
