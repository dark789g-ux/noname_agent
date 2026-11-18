import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olxiaofan" | "oltuishi">} */
export const groupSkills = {
	//OL彭羕
	olxiaofan: {
		audio: 2,
		enable: "chooseToUse",
		onChooseToUse(event) {
			if (game.online || !ui.cardPile.childElementCount || Array.isArray(event.olxiaofan_cards)) {
				return;
			}
			const num = lib.skill.olxiaofan.getNum(event.player) + 1;
			event.set("olxiaofan_cards", Array.from(ui.cardPile.childNodes).slice(-num).reverse());
		},
		hiddenCard(player, name) {
			return !player.isTempBanned("olxiaofan") && lib.inpile.includes(name);
		},
		getNum(player) {
			return player.getHistory("useCard").reduce((list, evt) => list.add(get.type2(evt.card)), []).length;
		},
		filter(event, player) {
			if (!Array.isArray(event.olxiaofan_cards) || event.responded || event.olxiaofan) {
				return false;
			}
			return lib.inpile.some(i => event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event));
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog(lib.translate["olxiaofan"], event.olxiaofan_cards, "hidden");
			},
			filter(button, player) {
				const evt = _status.event.getParent();
				return evt.filterCard(button.link, player, evt);
			},
			check(button) {
				const card = button.link,
					player = get.player();
				if (player.getHistory("useCard").reduce((list, evt) => list.add(get.type2(evt.card)), [get.type(card)]).length > 2) {
					return 0;
				}
				return player.getUseValue(card);
			},
			backup(links, player) {
				return {
					audio: "olxiaofan",
					filterCard() {
						return false;
					},
					selectCard: -1,
					viewAs: links[0],
					card: links[0],
					async precontent(event, trigger, player) {
						const card = lib.skill.olxiaofan_backup.card;
						event.result.cards = [card];
						event.result.card = get.autoViewAs(card, [card]);
						event.result.card.olxiaofan = true;
						player
							.when("useCardAfter")
							.filter(evt => evt.card.olxiaofan)
							.step(async (event, trigger, player) => {
								let maxNum = Math.min(3, lib.skill.olxiaofan.getNum(player));
								if (maxNum > 0 && player.countCards("jeh".slice(0, maxNum)) > 0) {
									for (let i = 0; i < maxNum; i++) {
										let pos = "jeh"[i],
											hs = player.countCards(pos);
										if (hs > 0) {
											await player.chooseToDiscard(hs, pos, true);
										}
									}
								}
							});
					},
				};
			},
			prompt(links, player) {
				return "嚣翻：是否使用" + get.translation(links[0]) + "？";
			},
		},
		ai: {
			effect: {
				target(card, player, target, effect) {
					if (get.tag(card, "respondShan")) {
						return 0.7;
					}
					if (get.tag(card, "respondSha")) {
						return 0.7;
					}
				},
			},
			order: 12,
			respondShan: true,
			respondSha: true,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			backup: {},
		},
	},
	oltuishi: {
		audio: 2,
		mod: {
			wuxieJudgeEnabled: () => false,
			wuxieEnabled: () => false,
			cardEnabled: card => {
				if (card.name == "wuxie") {
					return false;
				}
			},
			targetInRange: card => {
				if (card.storage?.oltuishi) {
					return true;
				}
			},
			aiValue: (player, card, val) => {
				if (card.name == "wuxie") {
					return 0;
				}
				var num = get.number(card);
				if (typeof get.strNumber(num, false) === "string") {
					return val * 1.1;
				}
			},
			aiUseful: (player, card, val) => {
				if (card.name == "wuxie") {
					return 0;
				}
				var num = get.number(card);
				if (typeof get.strNumber(num, false) === "string") {
					return val * 1.1;
				}
			},
			aiOrder: (player, card, order) => {
				if (get.name(card) == "sha" && player.hasSkill("oltuishi_unlimit")) {
					order += 9;
				}
				var num = get.number(card);
				if (typeof get.strNumber(num, false) === "string") {
					order += 3;
				}
				return order;
			},
		},
		trigger: { player: ["useCard", "useCardAfter"] },
		filter(event, player, name) {
			if (name == "useCardAfter") {
				if (player.isTempBanned("olxiaofan")) {
					return false;
				}
				return (
					player
						.getHistory("useCard", evt => {
							return (
								!player.getHistory("sourceDamage", evt2 => {
									return evt2.card && evt2.card == evt.card;
								}).length && get.is.damageCard(evt.card)
							);
						})
						.indexOf(event) >= 2
				);
			}
			return typeof get.strNumber(get.number(event.card), false) === "string";
		},
		forced: true,
		content() {
			"step 0";
			if (event.triggername == "useCardAfter") {
				player.tempBanSkill("olxiaofan");
				event.finish();
				return;
			}
			trigger.targets.length = 0;
			trigger.all_excluded = true;
			game.log(trigger.card, "被无效了");
			"step 1";
			player.draw();
			player.addSkill("oltuishi_unlimit");
		},
		init(player) {
			player.addSkill("oltuishi_count");
			const history = player.getHistory("useCard", evt => evt.finished && get.is.damageCard(evt.card) && !player.hasHistory("sourceDamage", evt2 => evt2.card === evt.card));
			history.length > 0 && player.addMark("oltuishi_count", history.length, false);
		},
		onremove(player) {
			player.removeSkill("oltuishi_count");
			player.clearMark("oltuishi_count", false);
		},
		subSkill: {
			count: {
				charlotte: true,
				trigger: {
					player: "useCardAfter",
					global: ["phaseBefore", "phaseAfter"],
				},
				filter(event, player) {
					if (event.name === "useCard") {
						return get.is.damageCard(event.card) && !player.hasHistory("sourceDamage", evt2 => evt2.card === event.card);
					}
					return player.hasMark("oltuishi_count");
				},
				silent: true,
				content() {
					const list = trigger.name === "useCard" ? ["addMark", event.name, 1, false] : ["clearMark", event.name, false];
					player[list[0]](...list.slice(1));
				},
				marktext: "失",
				intro: { content: "本回合已有#张伤害牌未造成过伤害" },
			},
			unlimit: {
				charlotte: true,
				mod: {
					cardUsableTarget: (card, player, target) => {
						if (target.countCards("h") < player.countCards("h")) {
							return true;
						}
					},
					targetInRange: (card, player, target) => {
						if (target.countCards("h") < player.countCards("h")) {
							return true;
						}
					},
				},
				trigger: { player: "useCard1" },
				filter(event, player) {
					if (!Array.isArray(event.targets) || !event.targets.length) {
						return false;
					}
					let num = 0;
					if (Array.isArray(event.cards) && event.cards.length) {
						const history = player.getHistory("lose", evt => {
							if ((evt.relatedEvent || evt.getParent()) != event) {
								return false;
							}
							return event.cards.some(card => evt.hs.includes(card));
						});
						if (history.length) {
							num += event.cards.filter(card => history[0].hs.includes(card)).length;
						}
					}
					return event.targets.some(target => player.countCards("h") + num > target.countCards("h") + (target == player ? num : 0));
				},
				forced: true,
				popup: false,
				silent: true,
				firstDo: true,
				content() {
					player.removeSkill(event.name);
					var card = trigger.card;
					if (!card.storage) {
						card.storage = {};
					}
					card.storage.oltuishi = true;
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] === "number") {
							stat[name]--;
						}
					}
				},
				mark: true,
				marktext: "侻",
				intro: { content: "对手牌数小于你的角色使用的下一张牌无距离次数限制" },
			},
		},
	},
};
