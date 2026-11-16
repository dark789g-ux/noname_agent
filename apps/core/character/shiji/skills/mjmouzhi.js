import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mjmouzhi" | "mjshengxi" | "mjkuanji" | "mjdingyi" | "mjzuici">} */
export const groupSkills = {
	mjmouzhi: {
		audio: 2,
		trigger: { player: "damageBegin2" },
		forced: true,
		filter(event, player) {
			if (!event.card || get.suit(event.card) == "none") {
				return false;
			}
			var all = player.getAllHistory("damage");
			if (!all.length) {
				return false;
			}
			return all[all.length - 1].card && get.suit(all[all.length - 1].card) == get.suit(event.card);
		},
		content() {
			trigger.cancel();
		},
		group: "mjmouzhi_mark",
		intro: { content: "上次受到伤害的花色：$" },
		ai: {
			effect: {
				target: (card, player, target) => {
					if (typeof card === "object" && get.tag(card, "damage")) {
						let suit = get.suit(card);
						if (suit === "none") {
							return;
						}
						let all = target.getAllHistory("damage");
						if (!all.length || !all[all.length - 1].card) {
							return;
						}
						if (get.suit(all[all.length - 1].card) === suit) {
							return "zeroplayertarget";
						}
					}
				},
			},
		},
		subSkill: {
			mark: {
				trigger: { player: "damage" },
				silent: true,
				firstDo: true,
				content() {
					if (!trigger.card || get.suit(trigger.card) == "none") {
						player.unmarkSkill("mjmouzhi");
					} else {
						player.markSkill("mjmouzhi");
						game.broadcastAll(
							function (player, suit) {
								if (player.marks.mjmouzhi) {
									player.marks.mjmouzhi.firstChild.innerHTML = get.translation(suit);
								}
								player.storage.mjmouzhi = suit;
							},
							player,
							get.suit(trigger.card)
						);
					}
				},
			},
		},
	},
	mjshengxi: {
		audio: "shengxi",
		audioname: ["feiyi"],
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			return player.getHistory("useCard").length > 0 && player.getHistory("sourceDamage").length == 0;
		},
		content() {
			"step 0";
			var list = get.zhinangs();
			player.chooseButton(["###" + get.prompt("mjshengxi") + "###获得一张智囊或摸一张牌", [list, "vcard"], [["摸一张牌", "取消"], "tdnodes"]], true).set("ai", function (card) {
				if (card.link[2]) {
					if (
						!get.cardPile2(function (cardx) {
							return cardx.name == card.link[2];
						})
					) {
						return 0;
					}
					return (Math.random() + 1.5) * get.value({ name: card.link[2] }, _status.event.player);
				}
				if (card.link == "摸一张牌") {
					return 1;
				}
				return 0;
			});
			"step 1";
			if (result.bool && result.links[0] != "取消") {
				player.logSkill("mjshengxi");
				if (result.links[0] == "摸一张牌") {
					player.draw();
				} else {
					var card = get.cardPile2(function (card) {
						return card.name == result.links[0][2];
					});
					if (card) {
						player.gain(card, "gain2");
					}
				}
			}
		},
		group: "mjshengxi_zhunbei",
		subfrequent: ["zhunbei"],
		subSkill: {
			zhunbei: {
				audio: "shengxi",
				audioname: ["feiyi"],
				trigger: { player: "phaseZhunbeiBegin" },
				frequent: true,
				prompt2: "从游戏外或牌堆中获得一张【调剂盐梅】",
				content() {
					if (!_status.tiaojiyanmei_suits || _status.tiaojiyanmei_suits.length > 0) {
						if (!lib.inpile.includes("tiaojiyanmei")) {
							lib.inpile.add("tiaojiyanmei");
						}
						if (!_status.tiaojiyanmei_suits) {
							_status.tiaojiyanmei_suits = lib.suit.slice(0);
						}
						player.gain(game.createCard2("tiaojiyanmei", _status.tiaojiyanmei_suits.randomRemove(), 6), "gain2");
					} else {
						var card = get.cardPile2(function (card) {
							return card.name == "tiaojiyanmei";
						});
						if (card) {
							player.gain(card, "gain2");
						}
					}
				},
			},
		},
	},
	mjkuanji: {
		audio: "fyjianyu",
		usable: 1,
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (event.type != "discard") {
				return false;
			}
			const evt = event.getl(player);
			return evt?.cards2?.filterInD("d").length > 0 && game.hasPlayer(current => player != current);
		},
		async cost(event, trigger, player) {
			const cards = trigger.getl(player).cards2;
			const { links } = await player
				.chooseButton(["宽济：是否将一张牌交给一名其他角色？", cards.filterInD("d")])
				.set("ai", button => {
					const player = get.player();
					if (
						game.hasPlayer(current => {
							return current != player && get.attitude(player, current) > 0;
						})
					) {
						return Math.abs(get.value(button.link, "raw")) + 1;
					}
					return -get.value(button.link, "raw");
				})
				.forResult();
			if (!links?.length) {
				return;
			}
			const card = links[0];
			event.card = card;
			const { bool, targets } = await player
				.chooseTarget(`将${get.translation(card)}交给一名其他角色并摸一张牌`, lib.filter.notMe, true)
				.set("ai", target => {
					const evt = _status.event.getParent();
					return get.attitude(evt.player, target) * get.value(evt.card, target) * (target.hasSkillTag("nogain") ? 0.1 : 1);
				})
				.forResult();
			event.result = {
				bool: bool,
				targets: targets,
				cost_data: card,
			};
		},
		async content(event, trigger, player) {
			await event.targets[0].gain(event.cost_data, "gain2");
			await player.draw();
		},
	},
	mjdingyi: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		logTarget() {
			return game.players;
		},
		content() {
			"step 0";
			var list = [];
			for (var i = 0; i < 4; i++) {
				list.push(lib.skill["mjdingyi_" + i].title);
			}
			player
				.chooseControl()
				.set("choiceList", list)
				.set("prompt", "定仪：请选择一个全局效果")
				.set("ai", function (target) {
					var list1 = player.getEnemies().length;
					var list2 = game.players.length - list1;
					if (list2 - list1 > 1) {
						return 0;
					}
					if (game.players.length < 6) {
						return 2;
					}
					return 3;
				});
			"step 1";
			if (typeof result.index == "number") {
				var skill = "mjdingyi_" + result.index;
				game.log(player, "选择了", "#g" + lib.skill[skill].title);
				for (var i of game.players) {
					i.addSkill(skill);
				}
				game.delayx();
			}
		},
		subSkill: {
			0: {
				title: "摸牌阶段的额定摸牌数+1",
				charlotte: true,
				mark: true,
				marktext: "仪",
				trigger: { player: "phaseDrawBegin" },
				forced: true,
				filter(event, player) {
					return !event.numFixed;
				},
				content() {
					trigger.num += (player.storage.mjdingyi_plus || 0) + 1;
				},
				intro: {
					content(storage, player) {
						return "摸牌阶段的额定摸牌数+" + 1 * ((player.storage.mjdingyi_plus || 0) + 1);
					},
				},
			},
			1: {
				title: "手牌上限+2",
				charlotte: true,
				mark: true,
				marktext: "仪",
				mod: {
					maxHandcard(player, num) {
						return num + 2 * ((player.storage.mjdingyi_plus || 0) + 1);
					},
				},
				intro: {
					content(storage, player) {
						return "手牌上限+" + 2 * ((player.storage.mjdingyi_plus || 0) + 1);
					},
				},
			},
			2: {
				title: "攻击范围+1",
				charlotte: true,
				mark: true,
				marktext: "仪",
				mod: {
					attackRange(player, num) {
						return num + ((player.storage.mjdingyi_plus || 0) + 1);
					},
				},
				intro: {
					content(storage, player) {
						return "攻击范围+" + ((player.storage.mjdingyi_plus || 0) + 1);
					},
				},
			},
			3: {
				title: "脱离濒死状态后回复1点体力",
				charlotte: true,
				mark: true,
				marktext: "仪",
				trigger: { player: "dyingAfter" },
				forced: true,
				filter(event, player) {
					return player.isDamaged();
				},
				content() {
					player.recover((player.storage.mjdingyi_plus || 0) + 1);
				},
				intro: {
					content(storage, player) {
						return "脱离濒死状态后回复" + ((player.storage.mjdingyi_plus || 0) + 1) + "点体力";
					},
				},
			},
		},
	},
	mjzuici: {
		audio: "zuici",
		trigger: { player: "damageEnd" },
		filter(event, player) {
			if (!event.source || !event.source.isIn()) {
				return false;
			}
			for (var i = 0; i < 4; i++) {
				if (event.source.hasSkill("mjdingyi_" + i)) {
					return true;
				}
			}
			return false;
		},
		logTarget: "source",
		check: () => false,
		content() {
			"step 0";
			var target = trigger.source;
			event.target = target;
			for (var i = 0; i < 4; i++) {
				if (target.hasSkill("mjdingyi_" + i)) {
					target.removeSkill("mjdingyi_" + i);
				}
			}
			"step 1";
			var list = get.zhinangs();
			if (list.length) {
				player.chooseButton(["选择要令" + get.translation(target) + "获得的智囊", [list, "vcard"]], true);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var card = get.cardPile2(function (card) {
					return card.name == result.links[0][2];
				});
				if (card) {
					target.gain(card, "gain2");
				}
			}
		},
		ai: {
			combo: "mjdingyi",
		},
	},
};
