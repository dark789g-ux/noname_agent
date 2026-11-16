import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "huamu" | "qianmeng" | "liangyuan">} */
export const groupSkills = {
	//曹宪曹华
	huamu: {
		audio: 6,
		trigger: { player: "useCardAfter" },
		locked: false,
		filter(event, player) {
			if (
				!player.hasHistory("lose", function (evt) {
					const evtx = evt.relatedEvent || evt.getParent();
					return evt.hs.length > 0 && evtx == event;
				}) ||
				!event.cards.filterInD("oe").length
			) {
				return false;
			}
			var history = game.getGlobalHistory("useCard");
			var index = history.indexOf(event);
			if (index < 1) {
				return false;
			}
			return get.color(event.card) != get.color(history[index - 1].card);
		},
		prompt2: event => "将" + get.translation(event.cards.filterInD("oe")) + "置于武将牌上",
		check(event, player) {
			if (
				!game.hasPlayer(function (current) {
					return current.hasSkill("qianmeng", null, null, false) && get.attitude(player, current) > 0;
				})
			) {
				return false;
			}
			var cards = event.cards.filterInD("e");
			if (!cards.length) {
				return true;
			}
			var card = cards[0];
			if (get.owner(card) == player) {
				if (get.value(card, player) <= 0) {
					return true;
				}
				var subtype = get.subtype(card);
				if (
					player.hasCard("hs", function (card) {
						return get.subtype(card) == subtype && player.canUse(card, player) && get.effect(player, card, player, player) > 0;
					})
				) {
					return true;
				}
			}
			return false;
		},
		content() {
			var cards = trigger.cards.filterInD("oe");
			player.addToExpansion(cards, "gain2").gaintag.add("huamu");
		},
		ai: {
			reverseOrder: true,
			combo: "qianmeng",
		},
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object") {
					var history = game.getGlobalHistory("useCard");
					if (!history.length) {
						return;
					}
					var evt = history[history.length - 1];
					if (evt && evt.card && get.color(evt.card) != get.color(card)) {
						return num + 4;
					}
				}
			},
		},
		marktext: "木",
		intro: {
			name: "灵杉&玉树",
			markcount(storage, player) {
				var red = [],
					black = [];
				var cards = player.getExpansions("huamu");
				for (var i of cards) {
					var color = get.color(i, false);
					(color == "red" ? red : black).push(i);
				}
				return "" + black.length + "/" + red.length;
			},
			content: "expansion",
			mark(dialog, storage, player) {
				var red = [],
					black = [];
				var cards = player.getExpansions("huamu");
				for (var i of cards) {
					var color = get.color(i, false);
					(color == "red" ? red : black).push(i);
				}
				if (black.length) {
					dialog.addText("灵杉");
					dialog.addSmall(black);
				}
				if (red.length) {
					dialog.addText("玉树");
					dialog.addSmall(red);
				}
			},
		},
	},
	qianmeng: {
		audio: 2,
		trigger: {
			global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (event.name == "addToExpansion") {
				if (event.gaintag.includes("huamu")) {
					var cards = event.player.getExpansions("huamu"),
						red = cards.filter(function (i) {
							return get.color(i, false) == "red";
						});
					if (cards.length == red.length || red.length == 0 || cards.length == red.length * 2) {
						return true;
					}
				}
			}
			if (event.name == "lose" && event.getlx !== false) {
				for (var i in event.gaintag_map) {
					if (event.gaintag_map[i].includes("huamu")) {
						var cards = event.player.getExpansions("huamu"),
							red = cards.filter(function (i) {
								return get.color(i, false) == "red";
							});
						return cards.length == red.length || red.length == 0 || cards.length == red.length / 2;
					}
				}
				return false;
			}
			return (
				game.getGlobalHistory("cardMove", function (evt) {
					if (evt.name != "lose" || event != evt.getParent()) {
						return false;
					}
					for (var i in evt.gaintag_map) {
						if (evt.gaintag_map[i].includes("huamu")) {
							var cards = evt.player.getExpansions("huamu"),
								red = cards.filter(function (i) {
									return get.color(i, false) == "red";
								});
							return cards.length == red.length || red.length == 0 || cards.length == red.length / 2;
						}
					}
					return false;
				}).length > 0
			);
		},
		forced: true,
		content() {
			player.draw();
		},
		ai: { combo: "huamu" },
	},
	liangyuan: {
		audio: 2,
		enable: "chooseToUse",
		hiddenCard(player, name) {
			if (player.getStorage("liangyuan_used").includes(name)) {
				return false;
			}
			if (name == "tao") {
				return game.hasPlayer(function (current) {
					var storage = current.getExpansions("huamu");
					return (
						storage.length > 0 &&
						storage.filter(function (i) {
							return get.color(i, false) == "red";
						}).length > 0
					);
				});
			} else if (name == "jiu") {
				return game.hasPlayer(function (current) {
					var storage = current.getExpansions("huamu");
					return (
						storage.length > 0 &&
						storage.filter(function (i) {
							return get.color(i, false) == "black";
						}).length > 0
					);
				});
			}
			return false;
		},
		filter(event, player) {
			if (event.type == "wuxie") {
				return false;
			}
			if (
				!player.getStorage("liangyuan_used").includes("tao") &&
				event.filterCard(get.autoViewAs({ name: "tao" }, "unsure"), player, event) &&
				game.hasPlayer(function (current) {
					var storage = current.getExpansions("huamu");
					return (
						storage.length > 0 &&
						storage.filter(function (i) {
							return get.color(i, false) == "red";
						}).length > 0
					);
				})
			) {
				return true;
			}
			if (
				!player.getStorage("liangyuan_used").includes("jiu") &&
				event.filterCard(get.autoViewAs({ name: "jiu" }, "unsure"), player, event) &&
				game.hasPlayer(function (current) {
					var storage = current.getExpansions("huamu");
					return (
						storage.length > 0 &&
						storage.filter(function (i) {
							return get.color(i, false) == "black";
						}).length > 0
					);
				})
			) {
				return true;
			}
			return false;
		},
		chooseButton: {
			dialog() {
				return ui.create.dialog("良缘", [["tao", "jiu"], "vcard"], "hidden");
			},
			filter(button, player) {
				var evt = _status.event.getParent();
				var name = button.link[2],
					color = name == "tao" ? "red" : "black";
				if (player.getStorage("liangyuan_used").includes(name)) {
					return false;
				}
				var cards = [];
				game.countPlayer(function (current) {
					cards.addArray(
						current.getExpansions("huamu").filter(function (i) {
							return get.color(i, false) == color;
						})
					);
				});
				if (!cards.length) {
					return false;
				}
				var card = get.autoViewAs({ name: name }, cards);
				return evt.filterCard(card, player, evt);
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				var player = _status.event.player;
				var name = button.link[2],
					color = name == "tao" ? "red" : "black";
				var cards = [];
				game.countPlayer(function (current) {
					cards.addArray(
						current.getExpansions("huamu").filter(function (i) {
							return get.color(i, false) == color;
						})
					);
				});
				var card = get.autoViewAs({ name: name }, cards);
				return player.getUseValue(card, null, true);
			},
			backup(links, player) {
				var name = links[0][2],
					color = name == "tao" ? "red" : "black";
				var cards = [];
				game.countPlayer(function (current) {
					cards.addArray(
						current.getExpansions("huamu").filter(function (i) {
							return get.color(i, false) == color;
						})
					);
				});
				if (!cards.length) {
					return false;
				}
				var card = get.autoViewAs({ name: name }, cards);
				return {
					viewAs: card,
					color: color,
					selectCard: -1,
					filterCard: () => false,
					log: false,
					precontent() {
						player.addTempSkill("liangyuan_used", "roundStart");
						player.markAuto("liangyuan_used", event.result.card.name);
						player.logSkill("liangyuan");
						var list = [],
							color = lib.skill.liangyuan_backup.color;
						var cards = [];
						game.countPlayer(function (current) {
							var cardsx = current.getExpansions("huamu").filter(function (i) {
								return get.color(i, false) == color;
							});
							if (cardsx.length) {
								cards.addArray(cardsx);
								list.push([current, cardsx]);
								current.$throw(cardsx);
								game.log(current, "将", cardsx, "化作“" + (color == "black" ? "灵杉" : "玉树") + "”良缘");
							}
						});
						event.result.cards = cards;
						event.result._apply_args = { throw: false };
						game.loseAsync({
							lose_list: list,
						}).setContent("chooseToCompareLose");
					},
				};
			},
			prompt(links, player) {
				var name = links[0][2],
					color = name == "tao" ? "玉树" : "灵杉";
				return "将场上所有的“" + color + "”当做【" + get.translation(name) + "】使用";
			},
		},
		subSkill: { used: { charlotte: true, onremove: true } },
		ai: {
			order(item, player) {
				if (!player) {
					player = _status.event.player;
				}
				return (
					get.order({
						name: lib.skill.liangyuan.hiddenCard(player, "jiu") ? "jiu" : "tao",
					}) + 4
				);
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
			combo: "huamu",
			threaten: 3,
		},
	},
};
