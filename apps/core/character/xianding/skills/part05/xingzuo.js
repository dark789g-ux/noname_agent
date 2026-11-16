import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xingzuo" | "xingzuo2" | "miaoxian">} */
export const groupSkills = {
	//阮瑀
	xingzuo: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		frequent: true,
		async content(event, trigger, player) {
			player.addTempSkill("xingzuo2");
			const cards = get.bottomCards(3, true);
			await game.cardsGotoOrdering(cards);
			const next = player.chooseToMove("兴作：将三张牌置于牌堆底");
			const list = [["牌堆底", cards]],
				hs = player.getCards("h");
			if (hs.length) {
				list.push(["手牌", hs]);
				next.set("filterMove", function (from, to) {
					return typeof to != "number";
				});
			}
			next.set("list", list);
			next.set("selectionSpec", { move: "swap" });
			next.set("processAI", function (list) {
				var allcards = list[0][1].slice(0),
					cards = [];
				if (list.length > 1) {
					allcards = allcards.concat(list[1][1]);
				}
				var canchoose = allcards.slice(0);
				var player = _status.event.player;
				var getv = function (button) {
					if (
						button.name == "sha" &&
						allcards.filter(function (card) {
							return (
								card.name == "sha" &&
								!cards.filter(function () {
									return button == card;
								}).length
							);
						}).length > player.getCardUsable({ name: "sha" })
					) {
						return 10;
					}
					return -player.getUseValue(button, player);
				};
				while (cards.length < 3) {
					canchoose.sort(function (a, b) {
						return getv(b) - getv(a);
					});
					cards.push(canchoose.shift());
				}
				return [cards, canchoose];
			});
			const result = await next.forResult();
			if (result.bool) {
				event.forceDie = true;
				const bottom = result.moved[0];
				game.addCardKnower(bottom, player);
				player.storage.xingzuo2 = bottom;
				const lose = [],
					gain = cards;
				for (const i of bottom) {
					if (hs.includes(i)) {
						lose.push(i);
					} else {
						gain.remove(i);
					}
				}
				if (lose.length) {
					player.$throw(lose.length, 1000);
					await player.lose(lose, ui.cardPile);
				}
				if (gain.length) {
					await player.gain(gain, "draw");
				}
				const other = bottom.filter(i => !"hejsdx".includes(get.position(i, true)));
				if (other.length) {
					await game.cardsGotoPile(other);
				}
			}
		},
	},
	xingzuo2: {
		trigger: { player: "phaseJieshuBegin" },
		charlotte: true,
		onremove: true,
		sourceSkill: "xingzuo",
		filter(event, player) {
			return game.hasPlayer(function (target) {
				return target.countCards("h") > 0;
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(function (card, player, target) {
					return target.countCards("h") > 0;
				}, "兴作：是否令一名角色将其手牌与牌堆底的三张牌替换？")
				.set("ai", function (target) {
					var player = _status.event.player,
						att = get.attitude(player, target),
						hs = target.getCards("h"),
						num = hs.length;
					var getv = function (list, target) {
							var num = 0;
							for (var i of list) {
								num += get.value(i, target);
							}
							return num;
						},
						val = getv(hs, target) - getv(player.storage.xingzuo2, target);
					if (num < 3) {
						return att * Math.sqrt(Math.max(0, -val)) * 1.5;
					}
					if (num == 3) {
						return -att * Math.sqrt(Math.max(0, val));
					}
					if (player.hp < (num > 4 ? 3 : 2)) {
						return 0;
					}
					return -att * Math.sqrt(Math.max(0, val));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const cards = get.bottomCards(3, true);
			await game.cardsGotoOrdering(cards);
			const hs = target.getCards("h");
			await target.lose(hs, ui.cardPile);
			await target.gain(cards, "draw");
			if (hs.length > 3) {
				await player.loseHp();
			}
		},
	},
	miaoxian: {
		hiddenCard(player, name) {
			return get.type(name) == "trick" && !player.hasSkill("miaoxian_used") && player.countCards("h", { color: "black" }) == 1;
		},
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			if (player.hasSkill("miaoxian_used")) {
				return false;
			}
			var cards = player.getCards("h", { color: "black" });
			if (cards.length != 1) {
				return false;
			}
			var mod2 = game.checkMod(cards[0], player, "unchanged", "cardEnabled2", player);
			if (mod2 === false) {
				return false;
			}
			for (var i of lib.inpile) {
				if (
					get.type(i) == "trick" &&
					event.filterCard(
						{
							name: i,
							cards: cards,
						},
						player,
						event
					)
				) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var cards = player.getCards("h", { color: "black" });
				var list = [];
				for (var i of lib.inpile) {
					if (
						get.type(i) == "trick" &&
						event.filterCard(
							{
								name: i,
								cards: cards,
							},
							player,
							event
						)
					) {
						list.push(["锦囊", "", i]);
					}
				}
				return ui.create.dialog("妙弦", [list, "vcard"], "hidden");
			},
			check(button) {
				var player = _status.event.player;
				return player.getUseValue({ name: button.link[2] }) + 1;
			},
			backup(links, player) {
				return {
					audio: "miaoxian",
					popname: true,
					filterCard: { color: "black" },
					selectCard: -1,
					position: "h",
					viewAs: {
						name: links[0][2],
					},
					onuse(links, player) {
						player.addTempSkill("miaoxian_used");
					},
				};
			},
			prompt(links, player) {
				return "将" + get.translation(player.getCards("h", { color: "black" })[0]) + "当做" + get.translation(links[0][2]) + "使用";
			},
		},
		group: "miaoxian_use",
		subfrequent: ["use"],
		subSkill: {
			use: {
				audio: "miaoxian",
				trigger: { player: "loseAfter" },
				frequent: true,
				prompt: "是否发动【妙弦】摸一张牌？",
				filter(event, player) {
					var evt = event.getParent();
					if (evt.name != "useCard") {
						return false;
					}
					return event.hs && event.hs.length == 1 && event.cards && event.cards.length == 1 && get.color(event.hs[0], player) == "red" && !player.countCards("h", { color: "red" });
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
			backup: { audio: "miaoxian" },
			used: { charlotte: true },
		},
		ai: {
			order: 12,
			result: { player: 1 },
		},
	},
};
