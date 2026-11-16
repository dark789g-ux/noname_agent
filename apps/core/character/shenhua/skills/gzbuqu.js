import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "gzbuqu" | "buqu" | "fenji" | "new_fenji" | "leiji">} */
export const groupSkills = {
	gzbuqu: {
		audio: 2,
		trigger: { player: "changeHp" },
		filter(event, player) {
			return player.hp <= 0 && event.num < 0;
		},
		marktext: "创",
		intro: {
			markcount: "expansion",
			content: "expansion",
		},
		group: "gzbuqu_recover",
		frequent: true,
		ondisable: true,
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				//delete player.nodying;
				player.loseToDiscardpile(cards);
				if (player.hp <= 0) {
					player.dying({});
				}
			}
		},
		process(player) {
			//delete player.nodying;
			const nums = [];
			const cards = player.getExpansions("gzbuqu");
			for (let i = 0; i < cards.length; i++) {
				if (nums.includes(get.number(cards[i]))) {
					return false;
				} else {
					nums.push(get.number(cards[i]));
				}
			}
			return true;
			//player.nodying=true;
		},
		subSkill: {
			recover: {
				trigger: { player: "recoverAfter" },
				filter(event, player) {
					return player.getExpansions("gzbuqu").length > 0 && event.num > 0;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					for (let i = trigger.num; i > 0; i--) {
						let cards = player.getExpansions("gzbuqu");
						const count = cards.length;
						if (count <= 0 || player.hp + count <= 1) {
							return;
						}
						if (count > 1) {
							cards = (
								await player
									.chooseCardButton("不屈：移去一张“创”", true, cards)
									.set("ai", function (button) {
										const buttons = get.selectableButtons();
										for (let i = 0; i < buttons.length; i++) {
											if (buttons[i] != button && get.number(buttons[i].link) == get.number(button.link) && !ui.selected.buttons.includes(buttons[i])) {
												return 1;
											}
										}
										return 0;
									})
									.forResult()
							).links;
						}
						await player.loseToDiscardpile(cards);
					}
					if (lib.skill.gzbuqu.process(player)) {
						if (player.isDying()) {
							const histories = [event];
							let evt = event;
							while (true) {
								evt = event.getParent("dying");
								if (!evt || evt.name != "dying" || histories.includes(evt)) {
									break;
								}
								histories.push(evt);
								if (evt.player == player) {
									evt.nodying = true;
								}
							}
						}
					}
				},
			},
		},
		async content(event, trigger, player) {
			const num = -trigger.num - Math.max(player.hp - trigger.num, 1) + 1;
			const next = player.addToExpansion(get.cards(num), "gain2");
			next.gaintag.add("gzbuqu");
			await next;
			await player.showCards(get.translation(player) + "的不屈牌", player.getExpansions("gzbuqu"));
			if (lib.skill.gzbuqu.process(player)) {
				const evt = trigger.getParent();
				if (evt.name == "damage" || evt.name == "loseHp") {
					evt.nodying = true;
				}
			}
		},
		ai: {
			mingzhi: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage") || get.tag(card, "loseHp")) {
						let num = target.getExpansions("gzbuqu").length || target.getHp();
						return (num + 1) / 5;
					}
				},
			},
		},
	},
	buqu: {
		audio: 2,
		audioname: ["key_yuri"],
		trigger: { player: "chooseToUseBefore" },
		forced: true,
		preHidden: true,
		filter(event, player) {
			return event.type == "dying" && player.isDying() && event.dying == player && !event.getParent()._buqu;
		},
		async content(event, trigger, player) {
			trigger.getParent()._buqu = true;
			const [card] = get.cards();
			const next = player.addToExpansion(card, "gain2");
			next.gaintag.add("buqu");
			await next;
			const cards = player.getExpansions("buqu"),
				num = get.number(card);
			player.showCards(cards, "不屈");
			for (let i = 0; i < cards.length; i++) {
				if (cards[i] != card && get.number(cards[i]) == num) {
					await player.loseToDiscardpile(card);
					return;
				}
			}
			trigger.cancel();
			trigger.result = { bool: true };
			if (player.hp <= 0) {
				await player.recover(1 - player.hp);
			}
		},
		mod: {
			maxHandcardBase(player, num) {
				if (get.mode() != "guozhan" && player.getExpansions("buqu").length) {
					return player.getExpansions("buqu").length;
				}
			},
		},
		ai: {
			save: true,
			mingzhi: true,
			skillTagFilter(player, tag, target) {
				if (player != target) {
					return false;
				}
			},
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage") || get.tag(card, "loseHp")) {
						let num = target.getExpansions("buqu").length || target.getHp();
						return (num + 1) / 5;
					}
				},
			},
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
	},
	fenji: {
		audio: 2,
		trigger: { global: ["gainAfter", "loseAfter", "loseAsyncAfter"] },
		filter(event, player) {
			if (event.name == "lose") {
				if (event.type != "discard" || !event.player.isIn()) {
					return false;
				}
				if ((event.discarder || event.getParent(2).player) == event.player) {
					return false;
				}
				if (!event.getl(event.player).hs.length) {
					return false;
				}
				return true;
			} else if (event.name == "gain") {
				if (event.giver || event.getParent().name == "gift") {
					return false;
				}
				const cards = event.getg(event.player);
				if (!cards.length) {
					return false;
				}
				return game.hasPlayer(current => {
					if (current == event.player) {
						return false;
					}
					const hs = event.getl(current).hs;
					for (const i of hs) {
						if (cards.includes(i)) {
							return true;
						}
					}
					return false;
				});
			} else if (event.type == "gain") {
				if (event.giver || !event.player || !event.player.isIn()) {
					return false;
				}
				const hs = event.getl(event.player);
				return game.hasPlayer(current => {
					if (current == event.player) {
						return false;
					}
					const cards = event.getg(current);
					for (const i of cards) {
						if (hs.includes(i)) {
							return true;
						}
					}
				});
			} else if (event.type == "discard") {
				if (!event.discarder) {
					return false;
				}
				return game.hasPlayer(current => {
					return current != event.discarder && event.getl(current).hs.length > 0;
				});
			}
			return false;
		},
		getIndex(event) {
			const targets = [];
			if (event.name == "gain") {
				const cards = event.getg(event.player);
				targets.addArray(
					game.filterPlayer(current => {
						if (current == event.player) {
							return false;
						}
						const hs = event.getl(current).hs;
						for (const i of hs) {
							if (cards.includes(i)) {
								return true;
							}
						}
						return false;
					})
				);
			} else if (event.name == "loseAsync" && event.type == "discard") {
				targets.addArray(
					game.filterPlayer(current => {
						return current != event.discarder && event.getl(current).hs.length > 0;
					})
				);
			} else {
				targets.push(event.player);
			}
			return targets;
		},
		logTarget: (event, player, triggername, target) => target,
		check(event, player, triggername, target) {
			if (get.attitude(player, target) <= 0) {
				return false;
			}
			return 2 * get.effect(target, { name: "draw" }, player, player) + get.effect(player, { name: "losehp" }, player, player) > 0;
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			await player.loseHp();
			await target.draw(2);
		},
	},
	new_fenji: {
		audio: "fenji",
		trigger: { global: "phaseAfter" },
		filter(event, player) {
			if (event.player.countCards("h") == 0 && event.player.isIn()) {
				return true;
			}
			return false;
		},
		preHidden: true,
		check(event, player) {
			if (get.attitude(get.event().player, event.player) <= 0) {
				return false;
			}
			return 2 * get.effect(event.player, { name: "draw" }, player, get.event().player) + get.effect(player, { name: "losehp" }, player, get.event().player) > 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			player.line(trigger.player, "green");
			await trigger.player.draw(2);
			await player.loseHp();
		},
	},
	leiji: {
		audio: 2,
		trigger: { player: ["useCard", "respond"] },
		filter(event, player) {
			return event.card.name == "shan";
		},
		preHidden: true,
		line: "thunder",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					const player = get.player();
					if (target.hasSkill("hongyan")) {
						return 0;
					}
					return get.damageEffect(target, player, player, "thunder");
				})
				.setHiddenSkill(event.skill)
				.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			const next = target.judge(card => {
				if (get.suit(card) == "spade") {
					return -4;
				}
				return 4;
			});
			next.judge2 = result => !result.bool;
			const result = await next.forResult();
			if (!result?.bool) {
				await target.damage(2, "thunder");
			}
		},
		ai: {
			mingzhi: false,
			useShan: true,
			effect: {
				target_use(card, player, target, current) {
					if (
						get.tag(card, "respondShan") &&
						!player.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: target,
								card: card,
							},
							true
						) &&
						game.hasPlayer(function (current) {
							return get.attitude(target, current) < 0 && get.damageEffect(current, target, target, "thunder") > 0;
						})
					) {
						if (card.name === "sha") {
							if (!target.mayHaveShan(player, "use")) {
								return;
							}
						} else if (!target.mayHaveShan(player)) {
							return 1 - 0.1 * Math.min(5, target.countCards("hs"));
						}
						if (!target.hasSkillTag("rejudge")) {
							return [1, 1];
						}
						let pos = player.hasSkillTag("viewHandcard", null, target, true) ? "hes" : "e";
						if (
							target.hasCard(function (cardx) {
								return get.suit(cardx) === "spade";
							}, pos)
						) {
							return [1, 4];
						}
						if (pos === "e") {
							return [1, Math.min(4, 1 + 0.75 * Math.max(1, target.countCards("hs")))];
						}
						return [1, 1];
					}
				},
			},
		},
	},
};
