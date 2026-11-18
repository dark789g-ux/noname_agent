import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "weiyi" | "jinzhi" | "zyqiao" | "chengshang">} */
export const groupSkills = {
	//潘淑
	weiyi: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			if (player.getStorage("weiyi").includes(event.player) || !event.player.isIn()) {
				return false;
			}
			return event.player.hp >= player.hp || event.player.isDamaged();
		},
		direct: true,
		content() {
			"step 0";
			var list = [];
			if (trigger.player.hp >= player.hp) {
				list.push("失去体力");
			}
			if (trigger.player.hp <= player.hp && trigger.player.isDamaged()) {
				list.push("回复体力");
			}
			list.push("cancel2");
			player
				.chooseControl(list)
				.set("prompt", get.prompt2("weiyi", trigger.player))
				.set("ai", function () {
					var player = _status.event.player,
						target = _status.event.getTrigger().player;
					var att = get.attitude(player, target),
						eff = get.recoverEffect(target, player, player);
					if (target.hp <= player.hp && target.isDamaged() && att > 2 && eff > 0) {
						if (player == target) {
							var storage = player.getStorage("weiyi");
							if (
								player.hp >= 2 &&
								game.hasPlayer(function (current) {
									return current.hp == player.hp + 1 && !storage.includes(current) && get.attitude(player, current) < 0;
								})
							) {
								return "cancel2";
							}
						}
						return "回复体力";
					}
					if (target.hp >= player.hp && att < -2 && eff < 0) {
						return "失去体力";
					}
					return "cancel2";
				});
			"step 1";
			if (result.control != "cancel2") {
				var target = trigger.player;
				player.logSkill("weiyi", target);
				player.markAuto("weiyi", [target]);
				target[result.control == "失去体力" ? "loseHp" : "recover"]();
			}
		},
		onremove: true,
		intro: {
			content: "已令$对汝威服",
		},
	},
	jinzhi: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			if (get.type(name) == "basic" && lib.inpile.includes(name) && player.countMark("jinzhi_used") < player.countCards("he")) {
				return true;
			}
		},
		filter(event, player) {
			if (event.responded || event.jinzhi || player.countMark("jinzhi_used") >= player.countCards("he")) {
				return false;
			}
			for (var i of lib.inpile) {
				if (get.type(i) == "basic" && event.filterCard({ name: i, isCard: true }, player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i of lib.inpile) {
					if (get.type(i) == "basic" && event.filterCard({ name: i, isCard: true }, player, event)) {
						list.push(["基本", "", i]);
						if (i == "sha") {
							for (var j of lib.inpile_nature) {
								list.push(["基本", "", "sha", j]);
							}
						}
					}
				}
				return ui.create.dialog("锦织", [list, "vcard"], "hidden");
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				if (button.link[2] == "shan") {
					return 3;
				}
				var player = _status.event.player;
				if (button.link[2] == "jiu") {
					if (player.getUseValue({ name: "jiu" }) <= 0) {
						return 0;
					}
					if (player.countCards("h", "sha")) {
						return player.getUseValue({ name: "jiu" });
					}
				}
				return player.getUseValue({ name: button.link[2], nature: button.link[3] }) / 4;
			},
			backup(links, player) {
				return {
					selectCard: player.countMark("jinzhi_used") + 1,
					filterCard(card, player) {
						if (ui.selected.cards.length) {
							if (get.color(card) != get.color(ui.selected.cards[0])) {
								return false;
							}
						}
						return lib.filter.cardDiscardable.apply(this, arguments);
					},
					complexCard: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						suit: "none",
						number: null,
						isCard: true,
					},
					position: "he",
					ignoreMod: true,
					check(card) {
						var player = _status.event.player,
							color = get.color(card, player);
						if (player.countCards("he", { color: color }) <= player.countMark("jinzhi_used") || (ui.selected.cards.length && get.color(ui.selected.cards[0], player) != color)) {
							return -1;
						}
						if (
							lib.skill.jinzhi_backup.viewAs.name == "jiu" &&
							!player.countCards("h", function (cardx) {
								return card != cardx && !ui.selected.cards.includes(cardx) && get.name(cardx, player) == "sha";
							})
						) {
							return 0;
						}
						return Math.min(0.01, 6 - get.value(card));
					},
					log: false,
					precontent() {
						player.logSkill("jinzhi");
						player.addTempSkill("jinzhi_used", "roundStart");
						player.addMark("jinzhi_used", 1, false);
						var cards = event.result.cards;
						player.discard(cards);
						player.draw();
						event.result.card = {
							name: event.result.card.name,
							nature: event.result.card.nature,
							isCard: true,
						};
						event.result.cards = [];
						if (cards.length > 1) {
							var color = get.color(cards[0], player);
							for (var i = 1; i < cards.length; i++) {
								if (get.color(cards[i], player) != color) {
									var evt = event.getParent();
									evt.set("jinzhi", true);
									evt.goto(0);
									return;
								}
							}
						}
					},
				};
			},
			prompt(links, player) {
				var name = links[0][2];
				var nature = links[0][3];
				return "弃置" + get.cnNumber(player.countMark("jinzhi_used") + 1) + "张颜色相同的牌并摸一张牌，然后视为使用" + (get.translation(nature) || "") + get.translation(name);
			},
		},
		ai: {
			order(item, player) {
				if (_status.event.type == "phase" && !player.countMark("jinzhi_used") && player.getUseValue({ name: "jiu" }, null, true) > 0 && player.countCards("h", "sha")) {
					return get.order({ name: "jiu" }) + 1;
				}
				return 1;
			},
			respondShan: true,
			respondSha: true,
			skillTagFilter(player) {
				if (player.countMark("jinzhi_used") >= player.countCards("he")) {
					return false;
				}
			},
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
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "本轮已发动过#次" },
			},
		},
	},
	//宗预
	zyqiao: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		logTarget: "player",
		usable: 2,
		preHidden: true,
		filter(event, player) {
			var source = event.player;
			if (source == player) {
				return false;
			}
			if (get.mode() == "guozhan" && source.isFriendOf(player)) {
				return false;
			}
			return source.countDiscardableCards(player, "he") > 0;
		},
		check(event, player) {
			var target = event.player;
			if (get.attitude(player, target) >= 0) {
				return false;
			}
			if (
				!player.countCards("he", function (card) {
					return lib.filter.cardDiscardable(card, player, "zyqiao");
				})
			) {
				return true;
			}
			if (player.countCards("he", card => get.value(card, player) < 5)) {
				return true;
			}
			if (target.countCards("he", card => get.value(card, target) > 6) && player.countCards("he", card => get.value(card, player) < 7)) {
				return true;
			}
			return false;
		},
		content() {
			"step 0";
			player.discardPlayerCard(trigger.player, true, "he");
			"step 1";
			if (
				player.countCards("he", function (card) {
					return lib.filter.cardDiscardable(card, player, "zyqiao");
				})
			) {
				player.chooseToDiscard("he", true);
			}
		},
	},
	chengshang: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (!lib.suit.includes(get.suit(event.card, false)) || typeof get.number(event.card) != "number") {
				return false;
			}
			if (
				player.getHistory("sourceDamage", function (evt) {
					return evt.card == event.card;
				}).length
			) {
				return false;
			}
			var phsu = event.getParent("phaseUse");
			if (!phsu || phsu.player != player) {
				return false;
			}
			if (
				player.getHistory("gain", function (evt) {
					return evt.getParent().name == "chengshang" && phsu === evt.getParent("phaseUse");
				}).length
			) {
				return false;
			}
			for (var i of event.targets) {
				if (i != player && (get.mode() != "guozhan" || i.isEnemyOf(player))) {
					return true;
				}
			}
			return false;
		},
		preHidden: true,
		content() {
			var suit = get.suit(trigger.card);
			var number = get.number(trigger.card);
			var cards = [];
			for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
				var card = ui.cardPile.childNodes[i];
				if (card.suit == suit && card.number == number) {
					cards.push(card);
				}
			}
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
	},
};
