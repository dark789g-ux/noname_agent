import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbjigu" | "olsbjiewan" | "olguanbian" | "olxiongni" | "olfengshang">} */
export const groupSkills = {
	//谋邓艾
	olsbjigu: {
		audio: 2,
		trigger: { global: ["cardsDiscardAfter", "phaseBegin"] },
		filter(event, player) {
			const num1 = player.maxHp,
				num2 = player.countExpansions("olsbjigu");
			if (event.name == "cardsDiscard") {
				if (num2 >= num1) {
					return false;
				}
				if (!event.cards.filterInD("d").some(card => get.suit(card) != "heart")) {
					return false;
				}
				const evtx = event.getParent();
				if (evtx.name !== "orderingDiscard") {
					return false;
				}
				const evt2 = evtx.relatedEvent || evtx.getParent();
				return evt2.name == "useCard" && evt2.player != event.getParent("phaseUse")?.player;
			}
			return event.player.maxHp == num1 && num2 && player.countCards("h");
		},
		locked: true,
		async cost(event, trigger, player) {
			if (trigger.name == "cardsDiscard") {
				event.result = {
					bool: true,
				};
			} else {
				const next = player.chooseToMove("积谷：是否交换“谷”和手牌？");
				next.set("list", [
					[get.translation(player) + "（你）的“谷”", player.getExpansions("olsbjigu")],
					["手牌区", player.getCards("h")],
				]);
				next.set("filterMove", (from, to) => {
					return typeof to != "number";
				});
				next.set("processAI", list => {
					let player = get.player(),
						cards = list[0][1].concat(list[1][1]).sort((a, b) => get.useful(a) - get.useful(b)),
						cards2 = cards.splice(0, player.getExpansions("olsbjigu").length);
					return [cards2, cards];
				});
				const { bool, moved } = await next.forResult();
				event.result = {
					bool: bool,
					cost_data: moved,
				};
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "cardsDiscard") {
				const cards = trigger.cards.filter(card => get.position(card, true) == "d" && get.suit(card) != "heart");
				const next = player.addToExpansion(cards, "gain2");
				next.gaintag.add(event.name);
				await next;
			} else {
				const { cost_data: moved } = event;
				const pushs = moved[0],
					gains = moved[1];
				pushs.removeArray(player.getExpansions(event.name));
				gains.removeArray(player.getCards("h"));
				if (!pushs.length || pushs.length != gains.length) {
					return;
				}
				const next = player.addToExpansion(pushs);
				next.gaintag.add(event.name);
				await next;
				await player.gain(gains, "draw");
			}
		},
		marktext: "谷",
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
	},
	olsbjiewan: {
		audio: 2,
		trigger: { global: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		filter(event, player) {
			const num1 = player.maxHp,
				num2 = player.countExpansions("olsbjigu");
			if (event.name == "phaseZhunbei") {
				if (!num1 && num2 < 1) {
					return false;
				}
				return player.countCards("hs", card => player.hasUseTarget(get.autoViewAs({ name: "shunshou", storage: { olsbjiewan: true } }, [card]), false, false));
			}
			return player.countCards("h") == num2 && !player.isMaxMaxHp(true);
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phaseJieshu") {
				event.result = {
					bool: true,
				};
			} else {
				const next = player.chooseButton([
					"解腕：是否选择一项执行？",
					[
						[
							["lose", "减少1点体力上限"],
							["discard", "移去两张“谷”"],
						],
						"textbutton",
					],
				]);
				next.set("filterButton", button => {
					const { link } = button,
						player = get.player();
					return (link == "lose" && player.maxHp > 0) || (link == "discard" && player.countExpansions("olsbjigu") > 1);
				});
				next.set("ai", button => {
					const { link } = button,
						player = get.player();
					if (player.getUseValue({ name: "shunshou" } <= 0)) {
						return 0;
					}
					let num1 = player.maxHp,
						num2 = player.countExpansions("olsbjigu"),
						num3 = player.countCards("h");
					if (num3 == num2 - 1 && link == "discard") {
						return 3;
					}
					if (
						(num3 == num2 + 1 || player.maxHp > 3) &&
						(player.isDamaged() || event.getRand() < 0.5) &&
						!game.hasPlayer(current => {
							if (player == current) {
								return false;
							}
							return current.maxHp <= num1 - 1 && num1 - 1 < 3;
						}) &&
						link == "lose"
					) {
						return 2;
					}
					return 0;
				});
				const { bool, links } = await next.forResult();
				event.result = {
					bool: bool,
					cost_data: links,
				};
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "phaseJieshu") {
				await player.gainMaxHp();
			} else {
				const { cost_data: links } = event;
				if (links.includes("lose")) {
					await player.loseMaxHp();
				} else {
					const result = await player
						.chooseButton([`解腕：移去两张“谷”`, player.getExpansions("olsbjigu")], 2, true)
						.set("ai", button => 6 - get.value(button.link))
						.set("direct", true)
						.forResult();
					if (result?.links?.length) {
						await player.loseToDiscardpile(result.links);
					}
				}
				if (!player.countCards("hs", card => player.hasUseTarget(get.autoViewAs({ name: "shunshou", storage: { olsbjiewan: true } }, [card]), void 0, false))) {
					return;
				}
				const next = player.chooseToUse();
				next.set("openskilldialog", `###${get.prompt(event.name)}###将一张手牌当距离限制为${Math.max(1, player.countExpansions("olsbjigu"))}的【顺手牵羊】使用`);
				next.set("norestore", true);
				next.set("_backupevent", `${event.name}_backup`);
				next.set("forced", true);
				next.set("custom", {
					add: {},
					replace: { window() {} },
				});
				next.set("targetRequired", true);
				next.set("complexSelect", true);
				next.backup(`${event.name}_backup`);
				await next;
			}
		},
		locked: false,
		mod: {
			targetInRange(card, player, target) {
				if (card?.storage?.olsbjiewan) {
					return 1 - Math.max(1, player.countExpansions("olsbjigu"));
				}
			},
		},
		subSkill: {
			backup: {
				audio: "olsbjiewan",
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				viewAs: {
					name: "shunshou",
					storage: {
						olsbjiewan: true,
					},
				},
				position: "hs",
				ai1(card) {
					const player = get.player();
					if (player.hasSkill("olsbjigu") && get.suit(card) != "heart") {
						return 10;
					}
					return 6 - get.value(card);
				},
			},
		},
	},
	//谋董卓
	olguanbian: {
		audio: 2,
		trigger: {
			global: ["phaseBefore", "roundEnd"],
			player: ["enterGame", "olxiongniAfter", "olfengshangAfter"],
		},
		filter(event, player, name) {
			if (name == "roundEnd") {
				return game.roundNumber == 1;
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			if (event.triggername == "roundEnd" || ["olxiongni", "olfengshang"].includes(trigger.name)) {
				await player.removeSkills(event.name);
			} else {
				player.addMark(event.name, game.players.length + game.dead.length, false);
			}
		},
		mod: {
			maxHandcard(player, num) {
				return num + player.countMark("olguanbian");
			},
			globalFrom(from, to, current) {
				return current + from.countMark("olguanbian");
			},
			globalTo(from, to, current) {
				return current + to.countMark("olguanbian");
			},
		},
		intro: {
			content: "<li>手牌上限+#<br><li>计算与其他角色的距离+#<br><li>其他角色计算与你的距离+#",
		},
	},
	olxiongni: {
		audio: 6,
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			if (!game.hasPlayer(target => target != player)) {
				return false;
			}
			return player.countCards("he", card => _status.connectMode || lib.filter.cardDiscardable(card, player));
		},
		async cost(event, trigger, player) {
			const skillName = event.name.slice(0, -5);
			event.result = await player
				.chooseToDiscard(get.prompt2(skillName), "he")
				.set("ai", card => {
					const player = get.player();
					if (!game.hasPlayer(target => player != target && get.damageEffect(target, player, player) > 0)) {
						return 0;
					}
					if (get.suit(card, player) == "heart") {
						return 8 - get.value(card);
					}
					return 7.5 - get.value(card);
				})
				.set("logSkill", [skillName, get.info(skillName).logTarget(trigger, player)])
				.forResult();
		},
		popup: false,
		logTarget: (event, player) => game.filterPlayer(target => target != player).sortBySeat(),
		async content(event, trigger, player) {
			player.changeSkin({ characterName: "ol_sb_dongzhuo" }, "ol_sb_dongzhuo_shadow1");
			const suit = get.suit(event.cards[0]);
			for (const target of event.targets) {
				const { bool } = await target
					.chooseToDiscard(`弃置一张${get.translation(suit)}牌，否则${get.translation(player)}对你造成1点伤害`, "he", (card, player) => {
						return get.event().suit == get.suit(card);
					})
					.set("ai", card => {
						const player = get.player(),
							target = get.event().getParent().player;
						if (get.damageEffect(player, target, player) > 0) {
							return 0;
						}
						return 7.5 - get.value(card);
					})
					.set("suit", suit)
					.forResult();
				if (!bool) {
					await target.damage();
				}
			}
		},
	},
	olfengshang: {
		audio: 6,
		getCards(player) {
			const cards = [];
			game.checkGlobalHistory("cardMove", evt => {
				if (evt.name != "cardsDiscard" && (evt.name != "lose" || evt.position != ui.discardPile)) {
					return;
				}
				cards.addArray(evt.cards.filter(card => !player.getStorage("olfengshang_clear").includes(get.suit(card))));
			});
			return cards.filterInD("d");
		},
		enable: "phaseUse",
		trigger: { global: "dying" },
		filter(event, player) {
			const cards = event.name == "chooseToUse" ? event.olfengshang_cards || [] : get.info("olfengshang").getCards(player);
			if (
				!cards
					.map(i => get.suit(i))
					.unique()
					.some(suit => cards.filter(card => get.suit(card) == suit).length > 1)
			) {
				return false;
			}
			return !player.hasSkill("olfengshang_" + (event.name === "chooseToUse" ? "used" : "round"), null, null, false);
		},
		onChooseToUse(event) {
			if (!game.online && !event.olfengshang_cards) {
				event.set("olfengshang_cards", get.info("olfengshang").getCards(event.player));
			}
		},
		prompt: event => (event.name === "chooseToUse" ? get.info("olfengshang").prompt2() : get.prompt("olfengshang")),
		prompt2: () => lib.translate["olfengshang_info"].split("你可以")[1],
		async content(event, trigger, player) {
			player.addTempSkill(event.name + (trigger ? "_round" : "_used"), trigger ? "phaseAfter" : "phaseUseAfter");
			if (_status.connectMode) {
				game.broadcastAll(() => (_status.noclearcountdown = true));
			}
			player.changeSkin({ characterName: "ol_sb_dongzhuo" }, "ol_sb_dongzhuo_shadow2");
			const cards = !trigger ? event.getParent(2).olfengshang_cards : get.info(event.name).getCards(player);
			const result = await player
				.chooseButtonTarget({
					createDialog: ["封赏：选择两张牌依次分配给两名角色", cards],
					forced: true,
					selectButton: 2,
					cardx: cards,
					filterButton(button) {
						const { link } = button;
						if (!ui.selected.buttons?.length) {
							return get.event().cardx.filter(card => get.suit(card) == get.suit(link)).length > 1;
						}
						return get.suit(link) == get.suit(ui.selected.buttons[0].link);
					},
					ai1(button) {
						return get.buttonValue(button);
					},
					complexSelect: true,
					filterTarget: true,
					selectTarget: 2,
					ai2(target) {
						const player = get.player(),
							att = get.attitude(player, target);
						let button = ui.selected.buttons[ui.selected.targets.length];
						if (!button?.link) {
							return 0;
						}
						if (get.value(button.link, player, "raw") < 0) {
							return Math.max(0.01, 100 - att);
						} else if (att > 0) {
							if (player.getUseValue({ name: "jiu" }) && player != target) {
								return 10;
							}
							return Math.max(0.1, att / Math.sqrt(1 + target.countCards("h")));
						} else {
							return Math.max(0.01, (100 + att) / 200);
						}
					},
				})
				.forResult();
			if (_status.connectMode) {
				game.broadcastAll(() => {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			player.addTempSkill("olfengshang_clear", "roundStart");
			player.markAuto("olfengshang_clear", [get.suit(result.links[0])]);
			player.storage["olfengshang_clear"].sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
			player.addTip("olfengshang_clear", ["olfengshang", ...player.getStorage("olfengshang_clear")].map(i => get.translation(i)).join(""));
			const gain_list = [];
			for (let i = 0; i < result.links.length; i++) {
				const source = result.targets[i];
				player.line(source, "green");
				game.log(source, "获得了", result.links[i]);
				gain_list.push([source, result.links[i]]);
			}
			await game
				.loseAsync({
					gain_list,
					giver: player,
					animate: "gain2",
				})
				.setContent("gaincardMultiple");
			await game.delayx();
			if (!player.hasHistory("gain", evt => evt.getParent(2) == event) && player.hasUseTarget({ name: "jiu", isCard: true }, true, false)) {
				await player.chooseUseTarget({ name: "jiu", isCard: true }, true, false);
			}
		},
		ai: {
			order: 7,
			result: { player: 1 },
		},
		subSkill: {
			used: { charlotte: true },
			round: { charlotte: true },
			clear: {
				marktext: "赏",
				charlotte: true,
				onremove(player, skill) {
					player.removeTip(skill);
					delete player.storage[skill];
				},
				intro: { content: "本轮已赏赐过$花色的牌" },
			},
		},
	},
};
