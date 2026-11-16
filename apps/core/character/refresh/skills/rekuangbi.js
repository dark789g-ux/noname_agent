import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rekuangbiSkills = {
	//十周年孙登
	rekuangbi: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2("rekuangbi"), (card, player, target) => {
					return target.countCards("he") > 0 && target != player;
				})
				.set("ai", target => {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (_status.event.goon) {
						if (att > 0) {
							return att * Math.sqrt(target.countCards("he"));
						}
						return (1 - att) / (target.countCards("he") + 1);
					}
					return (-10 * att) / (target.countCards("he") + 1);
				})
				.set("goon", player.countCards("hs", card => player.hasValueTarget(card)) >= 2)
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const result = await target
				.chooseCard("匡弼：将至多三张牌置于" + get.translation(player) + "的武将牌上", "he", [1, 3], true)
				.set("ai", card => {
					if (get.attitude(_status.event.player, _status.event.getParent().player) > 0) {
						return 7 - get.value(card);
					}
					return -get.value(card);
				})
				.forResult();
			if (result?.bool) {
				await player.addToExpansion(result.cards, target, "give").set("gaintag", ["rekuangbi_effect"]);
				player.addTempSkill("rekuangbi_effect", "phaseUseEnd");
				player.markAuto("rekuangbi_effect", [target]);
			}
		},
		subSkill: {
			effect: {
				audio: "rekuangbi",
				mod: {
					aiOrder(player, card, num) {
						if (num <= 0 || !player.getExpansions("rekuangbi_effect").length) {
							return;
						}
						let suit = get.suit(card);
						if (player.getExpansions("rekuangbi_effect").some(i => get.suit(i) == suit)) {
							return num + 10;
						}
						return num / 4;
					},
				},
				trigger: { player: "useCard" },
				charlotte: true,
				forced: true,
				filter(event, player) {
					return player.getExpansions("rekuangbi_effect").length > 0;
				},
				async content(event, trigger, player) {
					const cards = player.getExpansions("rekuangbi_effect");
					const suit = get.suit(trigger.card),
						cardsx = cards.filter(card => get.suit(card) == suit);
					const len = cardsx.length;
					let result;
					if (len > 1) {
						result = await player
							.chooseButton(["匡弼：移去一张同花色的“匡弼”牌", cards], true)
							.set("filterButton", button => {
								return get.suit(button.link) == _status.event.suit;
							})
							.set("suit", suit)
							.forResult();
					} else if (len == 1) {
						result = { bool: true, links: cardsx };
					} else {
						result = { bool: false, links: [cards.randomGet()] };
					}
					if (result?.links?.length) {
						await player.loseToDiscardpile(result.links);
						await game.delayx();
					}
					if (result?.bool) {
						await player.draw("nodelay");
						const target = player.getStorage("rekuangbi_effect")[0];
						if (target?.isIn()) {
							await target.draw();
						}
					} else {
						await player.draw();
					}
				},
				intro: {
					content: "expansion",
					markcount: "expansion",
				},
				onremove(player, skill) {
					var cards = player.getExpansions(skill);
					if (cards.length) {
						player.loseToDiscardpile(cards);
					}
					delete player.storage[skill];
				},
			},
		},
	},
	//十周年蔡邕
	rebizhuan: {
		audio: 2,
		trigger: {
			player: "useCard",
			target: "useCardToTargeted",
		},
		filter(event, player) {
			if (event.name != "useCard" && event.player == event.target) {
				return false;
			}
			var num = 4 + Math.min(player.countMark("retongbo"), game.countPlayer());
			if (player.getExpansions("rebizhuan").length >= num) {
				return false;
			}
			return get.suit(event.card) == "spade";
		},
		marktext: "书",
		intro: {
			name: "辟撰(书)",
			name2: "书",
			content: "expansion",
			markcount: "expansion",
		},
		frequent: true,
		locked: false,
		async content(event, trigger, player) {
			const next = player.addToExpansion(get.cards(), "gain2");
			next.gaintag.add("rebizhuan");
			await next;
		},
		mod: {
			maxHandcard(player, num) {
				return num + player.getExpansions("rebizhuan").length;
			},
		},
		ai: {
			notemp: true,
		},
	},
	retongbo: {
		audio: 2,
		trigger: { player: "phaseDrawAfter" },
		direct: true,
		filter(event, player) {
			return player.getExpansions("rebizhuan").length > 0 && player.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			const next = player.chooseToMove("通博：是否交换“书”和手牌？");
			next.set("list", [
				[get.translation(player) + "（你）的“书”", player.getExpansions("rebizhuan")],
				["你的牌", player.getCards("he")],
			]);
			next.set("filterMove", function (from, to) {
				return typeof to != "number";
			});
			next.set("selectionSpec", { move: "swap" });
			next.set("processAI", function (list) {
				const player = _status.event.player;
				let cards = list[0][1].concat(list[1][1]),
					cards2 = [];
				cards.sort((a, b) => {
					return get.useful(a) - get.useful(b);
				});
				cards2 = cards.splice(0, player.getExpansions("rebizhuan").length);
				return [cards2, cards];
			});
			const result = await next.forResult();
			if (result?.bool) {
				const pushs = result.moved[0],
					gains = result.moved[1];
				pushs.removeArray(player.getExpansions("rebizhuan"));
				gains.removeArray(player.getCards("he"));
				if (!pushs.length || pushs.length != gains.length) {
					return;
				}
				player.logSkill("retongbo");
				await player.addToExpansion(pushs, "give", player).set("gaintag", ["rebizhuan"]);
				await player.gain(gains, "gain2");
				const cards = player.getExpansions("rebizhuan").slice(0);
				if (cards.length < 4) {
					return;
				}
				event.given = [];
				const list = cards.map(card => get.suit(card)).unique();
				if (list.length >= 4 && player.hp <= 2) {
					event.four = true;
				}
				while (event.given.length < 4) {
					const resultx = await player
						.chooseCardButton("是否将" + get.cnNumber(4 - event.given.length) + "张“书”交给任意名其他角色？", cards, [1, 4 - event.given.length], event.given.length > 0)
						.set("ai", function (button) {
							if (!_status.event.goon) {
								return 0;
							}
							var four = _status.event.getParent().four,
								given = _status.event.getParent().given;
							if (four) {
								return get.value(button.link) + (given.map(i => get.suit(i)).includes(get.suit(button.link)) ? 0 : 10);
							}
							if (ui.selected.buttons.length == 0) {
								return get.value(button.link);
							}
							return 0;
						})
						.set(
							"goon",
							game.hasPlayer(current => current != player && get.attitude(player, current) > 0)
						)
						.forResult();
					if (resultx?.bool) {
						for (var i = 0; i < resultx.links.length; i++) {
							cards.remove(resultx.links[i]);
						}
						const togive = resultx.links.slice(0);
						event.given.addArray(togive);
						const resulty = await player
							.chooseTarget("将" + get.translation(resultx.links) + "交给一名其他角色", true, function (card, player, target) {
								return target != player;
							})
							.set("ai", function (target) {
								var att = get.attitude(_status.event.player, target);
								if (_status.event.enemy) {
									return -att;
								} else if (att > 0) {
									return att / (1 + target.countCards("h"));
								} else {
									return att / 100;
								}
							})
							.set("enemy", get.value(togive[0], player, "raw") < 0)
							.forResult();
						if (resulty?.targets?.length) {
							const target = resulty.targets[0];
							player.line(target, "green");
							game.log(target, "获得了" + get.cnNumber(togive.length) + "张", "#g“书”");
							await target.gain(togive, "draw").set("giver", player);
						}
					} else {
						return;
					}
				}
				if (event.given.length == 4) {
					const suits = lib.suit.slice(0);
					event.given.forEach(i => suits.remove(get.suit(i, player)));
					if (suits.length == 0) {
						await player.recover();
						player.addMark("retongbo", 1, false);
					}
				}
			}
		},
		marktext: "博",
		intro: {
			content(storage, player) {
				var num = 4 + Math.min(storage, game.countPlayer());
				return "“书”的上限+" + num;
			},
		},
		ai: {
			combo: "rebizhuan",
		},
	},
	//十周年陈宫
	remingce: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		position: "he",
		filterCard(card) {
			return get.name(card) == "sha" || get.type(card) == "equip";
		},
		filter(event, player) {
			return player.countCards("h", "sha") > 0 || player.countCards("he", { type: "equip" }) > 0;
		},
		check(card) {
			return 8 - get.value(card);
		},
		selectTarget: 2,
		multitarget: true,
		discard: false,
		lose: false,
		targetprompt: ["得到牌", "出杀目标"],
		filterTarget(card, player, target) {
			if (ui.selected.targets.length == 0) {
				return player != target;
			}
			return true;
		},
		delay: false,
		async content(event, trigger, player) {
			const { cards, targets } = event;
			await player.give(cards, targets[0], "visible");
			let result;
			if (!targets[0].canUse({ name: "sha", isCard: true }, targets[1], false, false)) {
				result = { control: "选项二" };
			} else {
				result = await targets[0]
					.chooseControl()
					.set("ai", function () {
						var player = _status.event.player,
							target = _status.event.target;
						return get.effect(target, { name: "sha", isCard: true }, player, player) > 0 ? 0 : 1;
					})
					.set("choiceList", ["视为对" + get.translation(targets[1]) + "使用一张【杀】，若此杀造成伤害则执行选项二", "你与" + get.translation(player) + "各摸一张牌"])
					.set("target", targets[1])
					.set("prompt", "对" + get.translation(targets[1]) + "使用一张杀，或摸一张牌")
					.forResult();
			}
			if (result?.control == "选项二") {
				await game.asyncDraw([player, targets[0]]);
				return;
			} else {
				await targets[0].useCard({ name: "sha", isCard: true }, targets[1]);
				if (
					targets[0].hasHistory("useCard", evt => {
						return evt.getParent() == event && targets[0].hasHistory("sourceDamage", evtx => evt.card == evtx.card);
					})
				) {
					await game.asyncDraw([player, targets[0]]);
				}
			}
		},
		ai: {
			result: {
				player(player) {
					var players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i] != player && get.attitude(player, players[i]) > 1 && get.attitude(players[i], player) > 1) {
							return 1;
						}
					}
					return 0;
				},
				target(player, target) {
					if (ui.selected.targets.length) {
						return -0.1;
					}
					return 1;
				},
			},
			order: 8.5,
			expose: 0.2,
		},
	},
	// 界荀攸
	reqice: {
		selectionSpec: true,
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return player.countMark("reqice_mark") + 1;
		},
		filter(event, player) {
			const hs = player.getCards("h");
			if (!hs.length) {
				return false;
			}
			if (
				hs.some(card => {
					const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					return mod2 === false;
				})
			) {
				return false;
			}
			return lib.inpile.some(name => {
				if (get.type(name) != "trick") {
					return false;
				}
				const card = get.autoViewAs({ name }, hs);
				return event.filterCard(card, player, event);
			});
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i = 0; i < lib.inpile.length; i++) {
					if (get.type(lib.inpile[i]) == "trick") {
						list.push(["锦囊", "", lib.inpile[i]]);
					}
				}
				return ui.create.dialog(get.translation("reqice"), [list, "vcard"]);
			},
			filter(button, player) {
				const event = _status.event.getParent(),
					card = get.autoViewAs(
						{
							name: button.link[2],
						},
						player.getCards("h")
					);
				return event.filterCard(card, player, event);
			},
			check(button) {
				var player = _status.event.player;
				var effect = player.getUseValue(button.link[2]);
				if (player.countCards("hs", button.link[2]) > 0) {
					return 0;
				}
				if ((player.getStat("skill").reqice || 0) < player.countMark("reqice_mark") + 1) {
					if (["draw", "gain"].some(i => get.tag(button.link[2], i) >= 1)) {
						return effect * 5;
					}
				}
				if (effect > 0) {
					return effect;
				}
				return 0;
			},
			backup(links, player) {
				return {
					filterCard: true,
					selectCard: -1,
					position: "h",
					audio: "reqice",
					popname: true,
					viewAs: { name: links[0][2] },
				};
			},
			prompt(links, player) {
				return "将所有手牌当【" + get.translation(links[0][2]) + "】使用";
			},
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					var num = 0;
					var cards = player.getCards("h");
					if (cards.length >= 3 && player.hp >= 3 && player.countMark("reqice_mark") < 2) {
						return 0;
					}
					for (var i = 0; i < cards.length; i++) {
						num += Math.max(0, get.value(cards[i], player, "raw"));
					}
					num /= cards.length;
					num /= (player.countMark("reqice_mark") + 1) * 1.3;
					num *= Math.min(cards.length, player.hp);
					return 13 - num;
				},
			},
			nokeep: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "nokeep") {
					return (!arg || (arg.card && get.name(arg.card) === "tao")) && player.isPhaseUsing() && !player.getStat("skill").reqice && player.hasCard(card => get.name(card) != "tao", "h");
				}
			},
			threaten: 1.7,
		},
		subSkill: {
			backup: {},
			mark: {
				charlotte: true,
				onremove: true,
				intro: {
					name2: "奇策",
					content: "mark",
				},
			},
		},
	},
};
