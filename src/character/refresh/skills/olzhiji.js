import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const olzhijiSkills = {
	olzhiji: {
		skillAnimation: true,
		animationColor: "fire",
		audio: 2,
		juexingji: true,
		//priority:-10,
		derivation: "reguanxing",
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		forced: true,
		filter(event, player) {
			return player.countCards("h") == 0;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.chooseDrawRecover(2, true);
			player.loseMaxHp();
			player.addSkills("reguanxing");
		},
	},
	//界郭图逢纪
	rejigong: {
		audio: 2,
		direct: true,
		trigger: { player: "phaseUseBegin" },
		async content(event, trigger, player) {
			const result = await player
				.chooseControl("一张", "两张", "三张", "cancel2")
				.set("prompt", get.prompt2("rejigong"))
				.set("ai", () => "三张")
				.forResult();
			if (result.control != "cancel2") {
				player.logSkill("rejigong");
				player.addTempSkill("rejigong2");
				player.draw(1 + result.index);
			}
		},
	},
	rejigong2: {
		audio: "rejigong",
		mod: {
			maxHandcardBase(player) {
				if (game.online) {
					return player.getStat("damage") || 0;
				}
				var num = 0;
				player.getHistory("sourceDamage", function (evt) {
					num += evt.num;
				});
				return num;
			},
		},
		trigger: { player: "phaseUseEnd" },
		forced: true,
		charlotte: true,
		sourceSkill: "rejigong",
		filter(event, player) {
			if (player.isHealthy()) {
				return false;
			}
			var num = 0;
			player.getHistory("sourceDamage", function (evt) {
				num += evt.num;
			});
			if (!num) {
				return false;
			}
			var num2 = 0;
			player.getHistory("gain", function (evt) {
				var evtx = evt.getParent(2);
				if (evtx.name == "rejigong" && evtx.player == player) {
					num2 += evt.cards.length;
				}
			});
			return num >= num2;
		},
		async content(event, trigger, player) {
			await player.recover();
		},
	},
	reshizhi: {
		audio: 2,
		mod: {
			cardname(card, player) {
				if (card.name == "shan" && player.hp == 1) {
					return "sha";
				}
			},
		},
		trigger: { source: "damageEnd" },
		forced: true,
		filter(event, player) {
			return event.card && event.card.name == "sha" && player.hp == 1 && event.cards && event.cards.length == 1 && event.cards[0].name == "shan";
		},
		async content(event, trigger, player) {
			await player.recover();
		},
		ai: {
			halfneg: true,
		},
	},
	//界陈群
	redingpin: {
		audio: 2,
		enable: "phaseUse",
		onChooseToUse(event) {
			if (event.type != "phase" || game.online) {
				return;
			}
			var list = [],
				player = event.player;
			player.getHistory("useCard", function (evt) {
				list.add(get.type2(evt.card));
			});
			player.getHistory("lose", function (evt) {
				if (evt.type != "discard" || evt.getParent(2).redingpin_ignore) {
					return;
				}
				for (var i of evt.cards2) {
					list.add(get.type2(i, evt.hs.includes(i) ? player : false));
				}
			});
			event.set("redingpin_types", list);
		},
		filter(event, player) {
			var list = event.redingpin_types || [];
			return (
				player.countCards("he", function (card) {
					return !list.includes(get.type2(card));
				}) > 0
			);
		},
		filterCard(card) {
			var list = _status.event.redingpin_types || [];
			return !list.includes(get.type2(card));
		},
		position: "he",
		filterTarget(card, player, target) {
			return !target.hasSkill("redingpin2");
		},
		async content(event, trigger, player) {
			const { target } = event;
			const judgeResult = await target
				.judge(function (card) {
					var evt = _status.event.getParent("redingpin"),
						suit = get.suit(card);
					switch (suit) {
						case "club":
						case "spade":
							return evt.target.hp;
						case "diamond":
							return get.sgn(get.attitude(evt.target, evt.player)) * -3;
					}
					return 0;
				})
				.forResult();
			judgeResult.judge2 = function (result) {
				if (result.color == "black") {
					return true;
				}
				return false;
			};
			switch (judgeResult.suit) {
				case "spade":
				case "club":
					if (target.hp > 0) {
						target.draw(Math.min(3, target.hp));
					}
					target.addTempSkill("redingpin2");
					break;
				case "heart":
					event.getParent().redingpin_ignore = true;
					break;
				case "diamond":
					player.turnOver();
					break;
			}
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					if (player.isTurnedOver()) {
						return target.hp;
					}
					var card = ui.cardPile.firstChild;
					if (!card) {
						return;
					}
					if (get.color(card) == "black") {
						return target.hp;
					}
					return 0;
				},
			},
		},
	},
	redingpin2: { charlotte: true },
	refaen: {
		audio: 2,
		audioname: ["dc_chenqun"],
		trigger: { global: ["turnOverAfter", "linkAfter"] },
		logTarget: "player",
		filter(event, player) {
			if (event.name == "link") {
				return event.player.isLinked();
			}
			return true;
		},
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		async content(event, trigger, player) {
			await trigger.player.draw();
		},
		global: "faen_global",
	},
	dcfaen: {
		audio: "refaen",
		audioname: ["dc_chenqun"],
		trigger: { global: ["turnOverAfter", "linkAfter"] },
		logTarget: "player",
		filter(event, player) {
			if (event.name == "link") {
				return event.player.isLinked();
			}
			return !event.player.isTurnedOver();
		},
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		async content(event, trigger, player) {
			await trigger.player.draw();
		},
		global: "faen_global",
	},
	//界曹彰
	xinjiangchi: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		async content(event, trigger, player) {
			const list = ["摸一张牌", "摸两张牌，本回合内不能使用或打出【杀】"];
			if (
				player.countCards("he", function (card) {
					return lib.filter.cardDiscardable(card, player, "xinjiangchi") > 0;
				}) > 0
			) {
				list.push("弃置一张牌，本回合可以多使用一张【杀】且无距离限制");
			}
			const result = await player
				.chooseControl("cancel2")
				.set("prompt", get.prompt("xinjiangchi"))
				.set("choiceList", list)
				.set("ai", function () {
					var player = _status.event.player;
					if (
						!player.countCards("hs", function (card) {
							return get.name(card) == "sha" && player.hasValueTarget(card, false);
						})
					) {
						return 1;
					}
					return 0;
				})
				.forResult();
			if (result.control != "cancel2") {
				player.logSkill("xinjiangchi");
				switch (result.index) {
					case 0: {
						player.draw();
						break;
					}
					case 1: {
						await player.draw(2);
						player.addTempSkill("xinjiangchi_less");
						break;
					}
					case 2: {
						await player.chooseToDiscard("he", true);
						player.addTempSkill("xinjiangchi_more");
						break;
					}
				}
			}
		},
		subSkill: {
			less: {
				mod: {
					cardEnabled(card) {
						if (card.name == "sha") {
							return false;
						}
					},
					cardRespondable(card) {
						if (card.name == "sha") {
							return false;
						}
					},
				},
				charlotte: true,
			},
			more: {
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + 1;
						}
					},
					targetInRange(card) {
						if (card.name == "sha") {
							return true;
						}
					},
				},
				charlotte: true,
			},
		},
	},
	//界周仓和程普
	ollihuo: {
		mod: {
			aiOrder(player, card, num) {
				if (card.name == "sha" && !player.getHistory("useCard").length) {
					return num + 7;
				}
			},
		},
		trigger: { player: "useCard1" },
		filter(event, player) {
			if (event.card.name == "sha" && !game.hasNature(event.card)) {
				return true;
			}
			return false;
		},
		audio: "lihuo",
		locked: false,
		prompt2(event) {
			return "将" + get.translation(event.card) + "改为火属性";
		},
		audioname: ["re_chengpu"],
		check(event, player) {
			return (
				(event.baseDamage > 1 || player.getHistory("useCard").indexOf(event) == 0) &&
				(player.hp > 1 || player.getExpansions("rechunlao").length) &&
				game.hasPlayer(function (current) {
					return !event.targets.includes(current) && player.canUse(event.card, current) && get.attitude(player, current) < 0 && !current.hasShan() && get.effect(current, { name: "sha", nature: "fire" }, player, player) > 0;
				})
			);
		},
		async content(event, trigger, player) {
			game.setNature(trigger.card, "fire");
			trigger.lihuo_changed = true;
		},
		group: ["ollihuo2", "ollihuo3", "ollihuo4"],
		ai: {
			fireAttack: true,
		},
	},
	ollihuo2: {
		trigger: { player: "useCard2" },
		sourceSkill: "ollihuo",
		filter(event, player) {
			if (event.card.name != "sha" || !game.hasNature(event.card, "fire")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !event.targets.includes(current) && lib.filter.targetEnabled(event.card, player, current) && lib.filter.targetInRange(event.card, player, current);
			});
		},
		direct: true,
		async content(event, trigger, player) {
			const targetResult = await player
				.chooseTarget(get.prompt("ollihuo"), "为" + get.translation(trigger.card) + "增加一个目标", function (card, player, target) {
					return !_status.event.sourcex.includes(target) && lib.filter.targetInRange(_status.event.card, player, target) && lib.filter.targetEnabled(_status.event.card, player, target);
				})
				.set("sourcex", trigger.targets)
				.set("card", trigger.card)
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.effect(target, _status.event.card, player, player);
				})
				.forResult();
			if (!targetResult.bool) {
				return;
			}
			if (!event.isMine() && !_status.connectMode) {
				game.delayx();
			}
			const target = targetResult.targets[0];
			player.logSkill("ollihuo", target);
			trigger.targets.push(target);
		},
	},
	ollihuo3: {
		trigger: { player: "useCardEnd" },
		sourceSkill: "ollihuo",
		filter(event, player) {
			return (
				event.lihuo_changed == true &&
				player.getHistory("sourceDamage", function (evt) {
					return evt.card == event.card;
				}).length > 0
			);
		},
		forced: true,
		audio: "lihuo",
		audioname: ["re_chengpu"],
		async content(event, trigger, player) {
			await player.loseHp();
		},
	},
	ollihuo4: {
		trigger: { player: "useCardAfter" },
		frequent: true,
		audio: "lihuo",
		audioname: ["re_chengpu"],
		sourceSkill: "ollihuo",
		filter(event, player) {
			return event.card.name == "sha" && player.getHistory("useCard").indexOf(event) == 0 && event.cards.filterInD().length > 0;
		},
		async content(event, trigger, player) {
			const cards = trigger.cards.filterInD();
			const next = player.addToExpansion(cards, "gain2");
			next.gaintag.add("rechunlao");
			await next;
		},
	},
};
