import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbjinjin" | "olfendi" | "oljuxiang" | "olpingtao">} */
export const groupSkills = {
	olsbjinjin: {
		audio: 2,
		enable: "chooseToUse",
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			event.set("olsbjinjin", get.discarded().filterInD("d"));
		},
		filter(event, player) {
			if (!event.olsbjinjin?.length) {
				return false;
			}
			return get.inpileVCardList(info => {
				if (info[0] !== "trick") {
					return false;
				}
				const card = new lib.element.VCard({ name: info[2], isCard: true });
				return event.filterCard(card, player, event);
			}).length;
		},
		chooseButton: {
			dialog(event, player) {
				const cards = get.inpileVCardList(info => {
					if (info[0] !== "trick") {
						return false;
					}
					const card = new lib.element.VCard({ name: info[2], isCard: true });
					return event.filterCard(card, player, event);
				});
				return ui.create.dialog("金烬", [cards, "vcard"]);
			},
			check(button) {
				const player = get.player(),
					link = button.link;
				const card = new lib.element.VCard({ name: link[2], isCard: true });
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					audio: "olsbjinjin",
					filterCard: () => false,
					selectCard: -1,
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
					},
					log: false,
					async precontent(event, trigger, player) {
						const skill = "olsbjinjin";
						player.logSkill(skill);
						const cards = get.discarded().filterInD("d");
						if (cards.length) {
							const num = cards.reduce((list, card) => list.add(get.suit(card, false)), []).length;
							const result =
								cards.length == 1
									? { bool: true, links: cards }
									: await player
											.chooseButton(["金烬：移出任意张花色各不相同的牌", cards], [1, num], true)
											.set("filterButton", button => {
												const suit = get.suit(button.link, false);
												return ui.selected.buttons?.every(buttonx => get.suit(buttonx.link, false) !== suit);
											})
											.set("complexSelect", true)
											.forResult();
							if (result?.bool && result.links?.length) {
								const next = player.addToExpansion(result.links, "draw2");
								next.gaintag.add(skill);
								await next;
								game.log(player, "将", result.links, "移出了游戏");
							}
						}
						await player.removeSkills(skill);
						player.markSkill(skill);
						player
							.when({
								global: "phaseEnd",
							})
							.filter(evt => player.hasHistory("damage"))
							.step(async (event, trigger, player) => {
								const result = await player
									.chooseTarget(`###金烬###令一名角色获得〖金烬〗${player.countExpansions(skill) ? `和${get.translation(player.getExpansions(skill))}` : ""}`, true)
									.set("ai", target => {
										return get.attitude(get.player(), target);
									})
									.forResult();
								if (result?.bool && result.targets?.length) {
									const target = result.targets[0];
									player.line(target, "green");
									const cards = player.getExpansions(skill);
									if (cards?.length) {
										await target.gain(cards, "give", player);
									}
									await target.addSkills(skill);
								}
							})
							.assign({ audio: "olsbjinjin", popup: true })
							.translation("金烬");
					},
				};
			},
			prompt(links, player) {
				return `###金烬###选择${get.translation(links[0][2])}的目标`;
			},
		},
		marktext: "烬",
		intro: {
			mark(dialog, storage, player) {
				const cards = player.getExpansions("olsbjinjin");
				if (player.isUnderControl(true)) {
					dialog.addAuto(cards);
				} else {
					return "共有" + get.cnNumber(cards.length) + "张牌";
				}
			},
			markcount: "expansion",
		},
		hiddenCard(player, name) {
			if (get.type(name) != "trick") {
				return false;
			}
			return get.discarded().filterInD("d").length;
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: { backup: {} },
	},
	//闪朱儁
	olfendi: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.targets.length == 1 && event.card.name == "sha" && event.targets[0].countCards("h") > 0;
		},
		logTarget: "target",
		async cost(event, trigger, player) {
			const { target } = trigger;
			event.result = await player
				.choosePlayerCard(target, "h", [1, player.maxHp], `分敌：展示${get.translation(target)}至多${get.cnNumber(player.maxHp, true)}张手牌`, "allowChooseAll")
				.set("ai", button => {
					if (_status.event.all) {
						return 1;
					}
					if (ui.selected.buttons.length) {
						return 0;
					}
					return Math.random();
				})
				.set("all", !target.mayHaveShan(player, "use") && Math.random() < 0.75)
				.set("forceAuto", true)
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards, name } = event,
				{ target } = trigger;
			await target.showCards(cards, get.translation(player) + "对" + get.translation(target) + "发动了【分敌】");
			target.addTempSkill("olfendi_tag");
			target.addGaintag(cards, "olfendi_tag");
			target.markAuto("olfendi_tag", [trigger.getParent()]);
			player
				.when({
					source: "damageSource",
					player: "useCardAfter",
				})
				.filter(evt => {
					if (evt.name == "useCard") {
						return evt == trigger.getParent();
					}
					return evt.getParent(evtx => evtx == trigger.getParent(), true) && evt.player == target;
				})
				.step(async (event, trigger, player) => {
					if (trigger.name == "useCard") {
						return;
					}
					player.logSkill(name, [target]);
					const cardsx = [...target.getCards("h"), ...Array.from(ui.discardPile)].filter(card => cards.includes(card));
					if (cardsx.length) {
						await player.gain(cardsx, "give");
					}
				});
		},
		subSkill: {
			tag: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
					delete player.storage[skill];
				},
				trigger: { global: "useCardAfter" },
				filter(event, player) {
					return player.getStorage("olfendi_tag").includes(event);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const { name } = event;
					player.unmarkAuto(name, [trigger]);
					if (!player.getStorage(name).length) {
						player.removeSkill(name);
					}
				},
				mod: {
					cardEnabled(card, player) {
						if (!card?.cards?.length || card.cards?.some(i => !i.hasGaintag("olfendi_tag"))) {
							return false;
						}
						if (get.itemtype(card) == "card") {
							if (!card.hasGaintag("olfendi_tag")) {
								return false;
							}
						}
					},
					cardRespondable(card, player) {
						return lib.skill.olfendi_tag.mod.cardEnabled.apply(this, arguments);
					},
					cardSavable(card, player) {
						return lib.skill.olfendi_tag.mod.cardEnabled.apply(this, arguments);
					},
				},
			},
		},
	},
	oljuxiang: {
		audio: 2,
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		usable: 1,
		filter(event, player) {
			const evt = event.getParent("phaseDraw");
			if (evt?.name == "phaseDraw") {
				return false;
			}
			const hs = player.getCards("h"),
				cards = event.getg(player).filter(i => hs.includes(i));
			return cards.length && cards.every(card => lib.filter.cardDiscardable(card, player, "oljuxiang"));
		},
		check(event, player) {
			const target = _status.currentPhase;
			if (!target || get.attitude(player, target) <= 0) {
				return false;
			}
			const evt = event.getParent("phase");
			if (!evt || !evt.phaseList.some((phase, index) => index >= evt.num && phase.startsWith("phaseUse"))) {
				return false;
			}
			if (target.getCardUsable({ name: "sha" }) >= target.countCards("hs", "sha")) {
				return false;
			}
			if (!target.hasValueTarget({ name: "sha" })) {
				return false;
			}
			const hs = player.getCards("h"),
				cards = event.getg(player).filter(i => hs.includes(i));
			return cards.reduce((val, card) => val + get.value(card), 0) < 10;
		},
		prompt2(event, player) {
			const hs = player.getCards("h"),
				cards = event.getg(player).filter(i => hs.includes(i)),
				target = _status.currentPhase;
			let str = `弃置${get.translation(cards)}`;
			if (target?.isIn()) {
				str = `${str}，然后令${get.translation(target)}本回合出杀次数+${cards.length}`;
			}
			return str;
		},
		async content(event, trigger, player) {
			const hs = player.getCards("h"),
				cards = trigger.getg(player).filter(i => hs.includes(i));
			await player.modedDiscard(cards);
			const target = _status.currentPhase;
			if (target?.isIn()) {
				player.line(target);
				target.addTempSkill("oljuxiang_sha");
				target.addMark("oljuxiang_sha", cards.length, false);
			}
		},
		subSkill: {
			sha: {
				charlotte: true,
				intro: { content: "使用【杀】的次数上限+#" },
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("oljuxiang_sha");
						}
					},
				},
			},
		},
	},
	//闪孙坚
	olpingtao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target } = event;
			const att = get.attitude(target, player);
			const card = new lib.element.VCard({ name: "sha", isCard: true });
			const bool = player.canUse(card, target, false, true);
			if (!bool && !target.countCards("he")) {
				return;
			}
			const result = await target
				.chooseToGive(player, `${get.translation(player)}对你发动了【平讨】`, `交给其一张牌并令其本回合使用的下一张【杀】可额外选择一个目标${bool ? "；或点击“取消”令其视为对你使用一张【杀】" : ""}`, "he")
				.set("ai", card => {
					const { give, att } = get.event();
					if (give) {
						if (card.name == "tao" || card.name == "jiu") {
							return 0;
						}
						return 8 - get.value(card);
					}
					if (att < 0 && card.name == "sha") {
						return -1;
					}
					return 6 - get.value(card);
				})
				.set("forced", !bool)
				.set("give", !bool || ((att >= 0 || (target.hp == 1 && target.countCards("hs", "shan") <= 1)) && get.effect(target, { name: "sha" }, player, target) < 0))
				.set("att", att)
				.forResult();
			if (result?.bool && result.cards?.length) {
				player.addTempSkill(event.name + "_sha");
				player.addMark(event.name + "_sha", 1, false);
			} else if (player.canUse(card, target, false, true)) {
				await player.useCard(card, target);
			}
		},
		ai: {
			expose: 0.15,
			order: 8,
			result: {
				target(player, target) {
					if (get.attitude(player, target) >= 0) {
						return Math.sqrt(target.countCards("he"));
					}
					if (player.countCards("hs", "sha")) {
						return -0.2;
					}
					return get.effect(target, { name: "sha", isCard: true }, player, target);
				},
			},
		},
		subSkill: {
			sha: {
				charlotte: true,
				onremove: true,
				marktext: "讨",
				intro: { content: "本回合使用的下一张【杀】可以额外指定#个目标" },
				trigger: {
					player: "useCard1",
				},
				filter(event, player) {
					return event.card?.name == "sha" && player.countMark("olpingtao_sha");
				},
				async cost(event, trigger, player) {
					const targets = game.filterPlayer(current => {
							return !trigger.targets?.includes(current) && lib.filter.targetEnabled2(trigger.card, trigger.player, current) && lib.filter.targetInRange(trigger.card, trigger.player, current);
						}),
						num = Math.min(player.countMark(event.skill), targets.length);
					player.clearMark(event.skill, false);
					if (num <= 0) {
						return;
					}
					event.result = await player
						.chooseTarget(`平讨：为此杀额外指定至多${get.cnNumber(num, true)}个目标`, [1, num], (card, player, target) => {
							return get.event().targetx.includes(target);
						})
						.set("targetx", targets)
						.set("ai", target => {
							const trigger = get.event().getTrigger();
							return get.effect(target, trigger.card, trigger.player, trigger.player);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					trigger.targets.addArray(event.targets);
				},
			},
		},
	},
};
