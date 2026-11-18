import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "wylianji" | "moucheng" | "jingong" | "jingong2" | "jingong3" | "weikui" | "weikui2" | "lizhan">} */
export const groupSkills = {
	wylianji: {
		enable: "phaseUse",
		audio: 2,
		usable: 1,
		filter(event, player) {
			return player.hasCard(lib.skill.wylianji.filterCard);
		},
		check(card) {
			if (card.name == "sha") {
				return 1;
			} else {
				if (get.tag(card, "damage")) {
					if (get.tag(card, "multineg")) {
						return 5;
					}
					return 2;
				}
			}
			return 0;
		},
		filterCard(card) {
			return get.name(card) == "sha" || (get.type(card, "trick") == "trick" && get.color(card) == "black" && !get.info(card).multitarget && get.info(card).enable);
		},
		filterTarget(card, player, target) {
			return (
				target != player &&
				!target.isMin() &&
				(player.canUse(card, target, false) ||
					game.hasPlayer(function (current) {
						return current != player && target.canUse(card, current);
					}))
			);
		},
		discard: false,
		lose: true,
		delay: false,
		content() {
			"step 0";
			player.showCards(get.translation(player) + "对" + get.translation(target) + "发动了【连计】", cards);
			"step 1";
			var equip1 = get.cardPile2(function (card) {
				return get.subtype(card) == "equip1";
			}, "random");
			if (!equip1) {
				player.popup("杯具");
				game.log("牌堆中无装备");
				event.finish();
				return;
			}
			if (equip1.name == "qinggang" && !lib.inpile.includes("qibaodao")) {
				equip1.remove();
				equip1 = game.createCard2("qibaodao", equip1.suit, equip1.number);
			}
			target.$draw(equip1);
			target.chooseUseTarget(true, equip1, "nothrow", "nopopup");
			game.delay();
			"step 2";
			game.updateRoundNumber();
			var card = cards[0];
			var bool1 = game.hasPlayer(function (current) {
				return current != player && target.canUse(card, current);
			});
			var bool2 = player.canUse(card, target, false);
			if (bool1 && bool2) {
				target
					.chooseControl(function () {
						return 0;
					})
					.set("choiceList", ["对除" + get.translation(player) + "以外的角色使用" + get.translation(cards) + "，并将装备区里的武器牌交给该牌的一个目标角色", "视为" + get.translation(player) + "对你使用" + get.translation(cards) + "，并将装备区内的武器牌交给" + get.translation(player)]);
			} else if (bool1) {
				event.directindex = 0;
			} else if (bool2) {
				event.directindex = 1;
			} else {
				event.finish();
			}
			"step 3";
			var card = cards[0];
			if (result && typeof event.directindex != "number") {
				event.directindex = result.index;
			}
			if (event.directindex == 1) {
				event.insert(lib.skill.wylianji.content_use, {
					player: player,
					target: target,
					card: card,
				});
			} else {
				event.insert(lib.skill.wylianji.content_give, {
					player: target,
					card: card,
					targets: game.filterPlayer(function (current) {
						return current != player;
					}),
				});
			}
		},
		content_use() {
			"step 0";
			player.useCard(card, target);
			"step 1";
			if (!get.owner(card)) {
				target.gain(card, "gain2");
			}
			"step 2";
			var equip1 = target.getEquips(1);
			if (equip1.length) {
				game.delay();
				target.give(equip1, player);
				target.line(player);
			}
		},
		content_give() {
			"step 0";
			var select = get.select(get.info(card).selectTarget);
			if (select[1] == -1) {
				for (var i = 0; i < targets.length; i++) {
					if (!player.canUse(card, targets[i])) {
						targets.splice(i--, 1);
					}
				}
				if (targets.length) {
					player.useCard(card, targets);
				}
				event.list = targets.slice(0);
				event.goto(2);
			} else {
				player
					.chooseTarget(select, "选择" + get.translation(card) + "的目标", true, function (cardx, player, target) {
						var card = _status.event.card;
						return _status.event.targets.includes(target) && player.canUse(card, target);
					})
					.set("ai", function (target) {
						var card = _status.event.card;
						var player = _status.event.player;
						return get.effect(target, card, player, player);
					})
					.set("targets", targets)
					.set("card", card);
			}
			"step 1";
			if (result.bool) {
				player.useCard(card, result.targets);
				event.list = result.targets.slice(0);
			}
			"step 2";
			var equip1 = player.getEquips(1);
			if (equip1.length) {
				for (var i = 0; i < event.list.length; i++) {
					if (event.list[i].isDead()) {
						event.list.splice(i--, 1);
					}
				}
				if (event.list.length > 1) {
					player
						.chooseTarget(true, "将" + get.translation(equip1) + "交给一名角色", function (card, player, target) {
							return _status.event.list.includes(target);
						})
						.set("ai", function (target) {
							return get.attitude(player, target);
						})
						.set("list", _status.event.list);
					event.equip1 = equip1;
				} else {
					if (event.list.length == 1) {
						player.give(equip1, event.list[0]);
						player.line(event.list);
					}
					event.finish();
				}
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool && result.targets.length && event.equip1) {
				player.give(event.equip1, result.targets[0]);
				player.line(result.targets);
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (ui.selected.cards.length) {
						var card = ui.selected.cards[0];
						var bool = card.name != "sha";
						if (
							game.hasPlayer(function (current) {
								return target.canUse(card, current, bool) && get.effect(current, card, target, player) > 0;
							})
						) {
							var num = 1;
							if (target.getEquip(1)) {
								num = 0.6;
							}
							if (target.hasSkillTag("noe")) {
								num *= 2;
							}
							return num;
						}
					}
					return 0;
				},
			},
		},
	},
	moucheng: {
		audio: 2,
		derivation: ["jingong", "wy_meirenji", "wy_xiaolicangdao"],
		trigger: { global: "damageEnd" },
		forced: true,
		popup: false,
		filter(event, player) {
			return event.source != player && event.getParent(2).name == "useCard" && event.getParent(4).name == "wylianji";
		},
		init(player) {
			player.storage.moucheng = 0;
		},
		intro: {
			content: "已造成#点伤害",
		},
		juexingji: true,
		content() {
			player.storage.moucheng += trigger.num;
			if (player.hasSkill("moucheng")) {
				player.markSkill("moucheng");
				player.syncStorage("moucheng");
			}
			if (player.storage.moucheng >= 3) {
				event.trigger("mouchengAwaken");
			}
		},
		group: "moucheng_awaken",
		subSkill: {
			awaken: {
				audio: "moucheng",
				trigger: { player: "mouchengAwaken" },
				forced: true,
				skillAnimation: true,
				animationColor: "gray",
				content() {
					player.awakenSkill("moucheng");
					player.changeSkills(["jingong"], ["wylianji"]);
				},
			},
		},
		ai: {
			combo: "wylianji",
		},
	},
	jingong: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				event.xinjingong_list &&
				player.countCards("hes", function (card) {
					return card.name == "sha" || get.type(card) == "equip";
				})
			);
		},
		onChooseToUse(event) {
			if (!game.online) {
				var evt = event.getParent();
				if (evt.name != "phaseUse") {
					return;
				}
				if (!evt.xinjingong_list) {
					var list = get.inpile("trick").randomGets(2);
					if (Math.random() < 0.5) {
						list.push("wy_meirenji");
					} else {
						list.push("wy_xiaolicangdao");
					}
					evt.xinjingong_list = list;
				}
				if (!event.xinjingong_list) {
					event.set("xinjingong_list", evt.xinjingong_list);
				}
			}
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i of event.xinjingong_list) {
					list.push(["锦囊", "", i]);
				}
				return ui.create.dialog("矜功", [list, "vcard"]);
			},
			filter(button, player) {
				return lib.filter.filterCard({ name: button.link[2] }, player, _status.event.getParent());
			},
			check(button) {
				return _status.event.player.getUseValue({ name: button.link[2] });
			},
			backup(links, player) {
				return {
					audio: "jingong",
					popname: true,
					position: "hes",
					viewAs: { name: links[0][2] },
					check(card) {
						return 6 - get.value(card);
					},
					filterCard(card) {
						return card.name == "sha" || get.type(card) == "equip";
					},
					precontent() {
						player.addTempSkill("jingong2");
					},
				};
			},
			prompt(links, player) {
				return "将一张【杀】或装备牌当做" + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order: 2,
			result: {
				player(player) {
					if ((player.hp <= 2 || player.needsToDiscard()) && !player.getStat("damage")) {
						return 0;
					}
					return 1;
				},
			},
		},
	},
	jingong2: {
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		sourceSkill: "jingong",
		filter(event, player) {
			return !player.getStat("damage");
		},
		content() {
			player.loseHp();
		},
	},
	jingong3: { charlotte: true },
	weikui: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h");
		},
		content() {
			"step 0";
			player.loseHp();
			"step 1";
			if (target.countCards("h", "shan")) {
				player.viewHandcards(target);
				if (player.canUse({ name: "sha", isCard: true }, target, false)) {
					player.useCard({ name: "sha", isCard: true }, target, false);
				}
				player.storage.weikui2 = target;
				player.addTempSkill("weikui2");
			} else {
				player.discardPlayerCard(target, "visible", true, "h").set("ai", function (button) {
					return get.value(button.link, _status.event.target);
				});
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (player.hp <= 2) {
						return 0;
					}
					if (player.hp == 3) {
						return target.hp <= 2 ? -1 : 0;
					}
					return -1;
				},
			},
		},
	},
	weikui2: {
		onremove: true,
		mod: {
			globalFrom(from, to) {
				if (to == from.storage.weikui2) {
					return -Infinity;
				}
			},
		},
		mark: "character",
		intro: {
			content: "与$的距离视为1直到回合结束",
		},
	},
	lizhan: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			for (var i = 0; i < game.players.length; i++) {
				if (game.players[i].isDamaged()) {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("lizhan"), "令任意名已受伤的角色各摸一张牌", [1, Infinity], function (card, player, target) {
					return target.isDamaged();
				})
				.set("ai", function (target) {
					return get.attitude(player, target);
				});
			"step 1";
			if (result.bool) {
				player.logSkill("lizhan", result.targets);
				game.asyncDraw(result.targets);
			}
		},
		ai: {
			expose: 0.3,
			threaten: 1.3,
		},
	},
};
