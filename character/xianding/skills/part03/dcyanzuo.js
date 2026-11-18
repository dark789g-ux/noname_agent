import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcyanzuo" | "dczuyin" | "dcpijian" | "dcdufeng" | "dcjingyin" | "dcchixing" | "dcbizu" | "dcwuxie">} */
export const groupSkills = {
	//诸葛京
	dcyanzuo: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + player.countMark("dcyanzuo_add");
		},
		filter(event, player) {
			return player.countCards("he");
		},
		filterCard: true,
		check(card) {
			const player = _status.event.player;
			let val = ["trick", "basic"].includes(get.type(card, player)) ? player.getUseValue(card) : 0,
				now = 0;
			player.getExpansions("dcyanzuo").forEach(i => {
				if (!["trick", "basic"].includes(get.type(i))) {
					return;
				}
				now = Math.max(now, player.getUseValue(i));
			});
			if (val > now) {
				return val + 3;
			}
			if (now <= 0) {
				return val;
			}
			return now * 2 - get.value(card);
		},
		position: "he",
		lose: false,
		discard: false,
		async content(event, trigger, player) {
			const next = player.addToExpansion(event.cards, player, "give");
			next.gaintag.add("dcyanzuo");
			await next;
			const cards = player.getExpansions("dcyanzuo").filter(i => ["trick", "basic"].includes(get.type(i)));
			if (!cards.length) {
				return;
			}
			const result = await player
				.chooseButton(["是否视为使用其中一张牌？", cards])
				.set("filterButton", button => {
					const player = _status.event.player;
					const card = {
						name: get.name(button.link),
						suit: get.suit(button.link),
						// nature: get.nature(button.link),
						nature: button.link.nature,
						isCard: true,
					};
					return player.hasUseTarget(card);
				})
				.set("ai", button => {
					const player = _status.event.player;
					const card = {
						name: get.name(button.link),
						suit: get.suit(button.link),
						nature: get.nature(button.link),
						isCard: true,
					};
					return player.getUseValue(card);
				})
				.forResult();
			if (result.bool) {
				const card = {
					name: get.name(result.links[0]),
					suit: get.suit(result.links[0]),
					nature: get.nature(result.links[0]),
					isCard: true,
				};
				await player.chooseUseTarget(card, true, false);
			}
		},
		ai: {
			order: 9,
			result: {
				player: 1,
			},
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_add", false);
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			markcount: "expansion",
			content: "expansion",
			mark(dialog, storage, player) {
				const marks = player.countMark("dcyanzuo_add");
				if (marks > 0) {
					dialog.addText(`〖研作〗发动次数+${marks}`);
				}
				const cards = player.getExpansions("dcyanzuo");
				if (cards.length) {
					dialog.addSmall(cards);
				}
			},
		},
		subSkill: {
			add: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	dczuyin: {
		audio: 2,
		forced: true,
		trigger: {
			target: "useCardToTargeted",
		},
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			return event.card.name == "sha" || get.type(event.card) == "trick";
		},
		async content(event, trigger, player) {
			const cards = player.getExpansions("dcyanzuo");
			if (cards.some(card => card.name == trigger.card.name)) {
				trigger.getParent().all_excluded = true;
				const discards = cards.filter(card => card.name == trigger.card.name);
				if (discards.length) {
					await player.loseToDiscardpile(discards);
				}
			} else {
				if (player.countMark("dcyanzuo_add") < 2 && player.hasSkill("dcyanzuo", null, null, false)) {
					player.addSkill("dcyanzuo_add");
					player.addMark("dcyanzuo_add", 1, false);
				}
				const card = get.cardPile(card => card.name == trigger.card.name);
				if (card) {
					const next = player.addToExpansion(card, "gain2");
					next.gaintag.add("dcyanzuo");
					await next;
				}
			}
		},
	},
	dcpijian: {
		audio: 2,
		trigger: {
			player: "phaseEnd",
		},
		filter(event, player) {
			return player.getExpansions("dcyanzuo").length >= game.countPlayer();
		},
		locked: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), true)
				.set("ai", target => {
					const player = _status.event.player;
					return get.damageEffect(target, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await player.loseToDiscardpile(player.getExpansions("dcyanzuo"));
			const target = event.targets[0];
			await target.damage(2);
		},
		ai: {
			combo: "dcyanzuo",
		},
	},
	//凌操
	dcdufeng: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		forced: true,
		async content(event, trigger, player) {
			const result = await player
				.chooseButton(
					[
						get.translation(event.name) + "：请选择你要执行的选项",
						'<div class="text center">' + lib.translate[event.name + "_info"] + "</div>",
						[
							[
								"失去体力",
								...Array.from({ length: 5 })
									.map((_, i) => {
										const sub = "equip" + (i + 1).toString();
										return [sub, get.translation(sub)];
									})
									.filter(sub => player.hasEnabledSlot(sub[0])),
							],
							"tdnodes",
						],
					],
					[1, 2],
					true
				)
				.set("filterButton", button => {
					if (!ui.selected.buttons.length) {
						return true;
					}
					return (button.link === "失去体力") !== (ui.selected.buttons[0].link === "失去体力");
				})
				.set("ai", button => {
					const player = get.player(),
						choice = button.link;
					const list = Array.from({ length: 5 })
						.map((_, i) => "equip" + (i + 1).toString())
						.filter(sub => player.hasEnabledSlot(sub));
					if (player.getHp() <= 2 && list.length > 1) {
						list.remove("失去体力");
					}
					const listx = list.filter(subtype => subtype !== "失去体力" && !player.getEquips(subtype).length);
					return choice === (listx.length ? listx : list).randomGet() ? 10 : 0;
				})
				.forResult();
			if (!result?.links?.length) {
				return;
			}
			if (result.links.includes("失去体力")) {
				await player.loseHp();
			}
			if (result.links.some(sub => sub !== "失去体力")) {
				await player.disableEquip(result.links.filter(sub => sub !== "失去体力")[0]);
			}
			if (!player.isIn()) {
				return;
			}
			const num = Math.min(player.countDisabled() + player.getDamagedHp(), player.maxHp);
			if (num) {
				await player.draw(num);
				if (num > 1) {
					player.addTempSkill("dcdufeng_effect");
					player.addMark("dcdufeng_effect", num - 1, false);
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: { content: "本回合攻击范围与使用【杀】的次数上限均+#" },
				mod: {
					attackRange(player, num) {
						return num + player.countMark("dcdufeng_effect");
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("dcdufeng_effect");
						}
					},
				},
			},
		},
	},
	//柳婒
	dcjingyin: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		filter(event, player) {
			if (_status.currentPhase === event.player) {
				return false;
			}
			if (!game.hasPlayer(target => target != event.player)) {
				return false;
			}
			return event.card.name == "sha" && event.cards && event.cards.someInD();
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名角色获得" + get.translation(trigger.cards.filterInD()), (card, player, target) => {
					return target != get.event().getTrigger().player;
				})
				.set("ai", target => {
					const player = get.event().player,
						cards = get.event().cards;
					return get.attitude(player, target) * cards.reduce((sum, card) => sum + get.value(card, target), 0);
				})
				.set("cards", trigger.cards.filterInD())
				.forResult();
		},
		usable: 1,
		async content(event, trigger, player) {
			const target = event.targets[0];
			target.addSkill("dcjingyin_tag");
			target.gain(trigger.cards.filterInD(), "gain2").set("gaintag", ["dcjingyin_tag"]);
		},
		subSkill: {
			tag: {
				charlotte: true,
				mod: {
					/*
					targetInRange(card, player, target) {
						if (!card.cards) return;
						if (card.cards.some(i => i.hasGaintag("dcjingyin_tag"))) return true;
					},
					*/
					cardUsable(card, player, target) {
						if (!card.cards) {
							return;
						}
						if (card.cards.some(i => i.hasGaintag("dcjingyin_tag"))) {
							return Infinity;
						}
					},
					aiOrder(player, card, num) {
						if (get.itemtype(card) == "card" && card.hasGaintag("dcjingyin_tag")) {
							return num - 0.1;
						}
					},
				},
			},
		},
	},
	dcchixing: {
		audio: 2,
		trigger: { global: "phaseUseEnd" },
		filter(event, player) {
			return lib.skill.dcchixing.getNum(event).length;
		},
		frequent: true,
		async content(event, trigger, player) {
			const result = (await player.draw(lib.skill.dcchixing.getNum(trigger).length).forResult()).cards;
			if (Array.isArray(result) && result.some(card => get.name(card, false) == "sha")) {
				await player
					.chooseToUse(function (card) {
						const evt = _status.event;
						if (!lib.filter.cardEnabled(card, evt.player, evt)) {
							return false;
						}
						let cards = [card];
						if (Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						}
						return get.itemtype(evt.cards) == "cards" && cards.containsSome(...evt.cards) && get.name(card, false) == "sha";
					}, "迟行：是否使用一张【杀】？")
					.set("cards", result);
			}
		},
		getNum(event) {
			return game
				.getGlobalHistory("everything", evt => {
					if (evt.getParent("phaseUse") != event) {
						return false;
					}
					return evt.name == "cardsDiscard" || (evt.name == "lose" && evt.position == ui.discardPile);
				})
				.reduce((list, evt) => list.addArray(evt.cards.filter(i => i.name == "sha")), []);
		},
	},
	//卞玥
	dcbizu: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return target.countCards("h") == player.countCards("h");
		},
		filterCard: () => false,
		selectCard: [-1, -2],
		prompt: () => {
			const player = get.player();
			const targets = game.filterPlayer(current => current.countCards("h") == player.countCards("h"));
			return "令" + get.translation(targets) + (targets.length > 1 ? "各" : "") + "摸一张牌";
		},
		selectTarget: -1,
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			await game.asyncDraw(event.targets.sortBySeat());
			if (game.getGlobalHistory("everything", evt => evt.name == "dcbizu" && evt.player == player && evt != event).some(evtx => evtx.targets.length == event.targets.length && evtx.targets.every(i => event.targets.includes(i)))) {
				player.tempBanSkill("dcbizu");
				await player.recover();
			}
		},
		ai: {
			order: 4,
			result: {
				player(player, target) {
					return game.filterPlayer(current => current.countCards("h") == player.countCards("h")).reduce((e, p) => e + get.effect(p, { name: "draw" }, player, player), 0);
				},
			},
		},
	},
	dcwuxie: {
		audio: 2,
		trigger: { player: "phaseEnd" },
		filter(event, player) {
			return player.hasCards("h") && game.hasPlayer(current => current != player && current.hasCards("h"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return target != player && target.hasCards("h");
				})
				.set("ai", target => {
					const player = get.player();
					return -get.attitude(player, target) * (target.countCards("h") - player.countCards("h"));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.swapHandcards(target);
			const cards1 = player.getCards("h", card => get.is.damageCard(card));
			if (cards1.length) {
				player.$throw(cards1.length, 1000);
				await player.lose(cards1, ui.cardPile);
			}
		},
	},
};
