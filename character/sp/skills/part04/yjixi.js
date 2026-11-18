import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yjixi" | "xinyongsi" | "xinyongsi1" | "xinyongsi2" | "lianzhu" | "xiahui" | "xiahui2" | "shanjia" | "shanjia2" | "zhanyi" | "zhanyi_basic" | "zhanyi_basic_tao">} */
export const groupSkills = {
	yjixi: {
		derivation: "rewangzun",
		audio: "weidi",
		trigger: { player: "phaseAfter" },
		forced: true,
		filter(event, player) {
			if (player.phaseNumber < 3) {
				return false;
			}
			let num = 0;
			for (let i = player.actionHistory.length - 1; i >= 0; i--) {
				if (!player.actionHistory[i].isMe) {
					continue;
				}
				if (_status.globalHistory[i].changeHp.some(evt => evt.player == player && evt.getParent().name == "loseHp")) {
					return false;
				} else {
					num++;
					if (num >= 3) {
						break;
					}
				}
			}
			return true;
		},
		skillAnimation: true,
		animationColor: "gray",
		juexingji: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.gainMaxHp();
			await player.recover();
			let str = "摸两张牌";
			const mode = get.mode();
			let choice = "选项一";
			const list = [];
			if (mode == "identity" || (mode == "versus" && _status.mode == "four")) {
				const zhu = get.zhu(player);
				if (zhu && zhu != player && zhu.skills) {
					list.addArray(zhu.skills.filter(skill => lib.skill[skill].zhuSkill));
				}
				if (list.length) {
					str += "并获得技能" + get.translation(list);
					event.list = list;
					choice = "选项二";
				}
			}
			const result = await player
				.chooseControl()
				.set("choiceList", ["获得技能〖妄尊〗", str])
				.set("choice", choice)
				.set("ai", () => _status.event.choice)
				.forResult();
			if (result?.control == "选项一") {
				player.addSkills("rewangzun");
			} else if (result?.control == "选项二") {
				await player.draw(2);
				if (list.length) {
					await player.addSkills(list);
					game.broadcastAll(function (list) {
						game.expandSkills(list);
						for (const skill of list) {
							const info = lib.skill[skill];
							if (!info) {
								continue;
							}
							if (!info.audioname2) {
								info.audioname2 = {};
							}
							info.audioname2.old_yuanshu = "weidi";
						}
					}, list);
				}
			}
		},
	},
	xinyongsi: {
		audio: "yongsi",
		group: ["xinyongsi1", "xinyongsi2"],
		locked: true,
	},
	xinyongsi1: {
		audio: "yongsi1",
		trigger: { player: "phaseDrawBegin1" },
		forced: true,
		sourceSkill: "xinyongsi",
		filter(event, player) {
			return !event.numFixed;
		},
		content() {
			player.draw(game.countGroup());
			trigger.changeToZero();
		},
	},
	xinyongsi2: {
		audio: "yongsi2",
		trigger: { player: "phaseDiscardBegin" },
		forced: true,
		sourceSkill: "xinyongsi",
		check() {
			return false;
		},
		content() {
			"step 0";
			player.chooseToDiscard("he", "庸肆").set("prompt2", "弃置一张牌，或取消并失去1点体力").ai = function (card) {
				return 8 - get.value(card);
			};
			"step 1";
			if (!result.bool) {
				player.loseHp();
			}
		},
	},
	lianzhu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		position: "he",
		filterTarget(card, player, target) {
			return target != player;
		},
		check(card) {
			var num = get.value(card);
			if (get.color(card) == "black") {
				if (num >= 6) {
					return 0;
				}
				return 20 - num;
			} else {
				if (_status.event.player.needsToDiscard()) {
					return 7 - num;
				}
			}
			return 0;
		},
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards, target } = event;
			player.give(cards, target, true);
			if (get.color(cards[0], player) == "red") {
				return;
			}
			const result = await target
				.chooseToDiscard("he", 2, "弃置两张牌，或令" + get.translation(player) + "摸两张牌")
				.set("goon", get.attitude(target, player) < 0)
				.set("ai", function (card) {
					if (!_status.event.goon) {
						return -get.value(card);
					}
					return 6 - get.value(card);
				})
				.forResult();
			if (!result.bool) {
				await player.draw(2);
			}
		},
		ai: {
			order: 8,
			expose: 0.2,
			result: {
				target(player, target) {
					if (ui.selected.cards.length && get.color(ui.selected.cards[0]) == "red") {
						if (target.countCards("h") < player.countCards("h")) {
							return 1;
						}
						return 0.5;
					}
					return -1;
				},
			},
		},
	},
	xiahui: {
		mod: {
			ignoredHandcard(card, player) {
				if (get.color(card) == "black") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.color(card) == "black") {
					return false;
				}
			},
		},
		trigger: {
			global: "gainAfter",
			player: "loseAsyncAfter",
		},
		forced: true,
		popup: false,
		filter(event, player) {
			if (event.name == "loseAsync") {
				if (event.type != "gain") {
					return false;
				}
				return game.hasPlayer(function (current) {
					if (current == player) {
						return false;
					}
					var hs = current.getCards("h"),
						cards = event.getl(player).cards2;
					var cardsx = event.getg(current);
					for (var i of cardsx) {
						if (hs.includes(i) && cards.includes(i) && get.color(i, player) == "black") {
							return true;
						}
					}
					return false;
				});
			}
			if (event.player != player) {
				var hs = event.player.getCards("h");
				var evt = event.getl(player);
				return (
					evt &&
					evt.cards2 &&
					evt.cards2.filter(function (card) {
						return hs.includes(card) && get.color(card, player) == "black";
					}).length > 0
				);
			}
			return false;
		},
		content() {
			var cards = trigger.getl(player).cards2;
			game.countPlayer(function (current) {
				if (current == player) {
					return;
				}
				var hs = current.getCards("h"),
					cardsx = trigger.getg(current).filter(function (card) {
						return hs.includes(card) && cards.includes(card) && get.color(card, player) == "black";
					});
				if (cardsx.length > 0) {
					current.addSkill("xiahui2");
					current.addGaintag(cardsx, "xiahui");
				}
			});
		},
	},
	xiahui2: {
		mark: true,
		intro: {
			content: "不能使用、打出或弃置得到的黑色牌",
		},
		mod: {
			cardDiscardable(card, player) {
				if (card.hasGaintag("xiahui")) {
					return false;
				}
			},
			cardEnabled2(card, player) {
				if (get.itemtype(card) == "card" && card.hasGaintag("xiahui")) {
					return false;
				}
			},
		},
		trigger: { player: "changeHp" },
		forced: true,
		popup: false,
		charlotte: true,
		sourceSkill: "xiahui",
		filter(event) {
			return event.changedHp < 0;
		},
		content() {
			player.removeSkill("xiahui2");
		},
		onremove(player) {
			player.removeGaintag("xiahui");
		},
	},
	shanjia: {
		sync(player) {
			if (game.online) {
				return;
			}
			var history = player.actionHistory;
			var num = 0;
			for (var i = 0; i < history.length; i++) {
				for (var j = 0; j < history[i].useCard.length; j++) {
					if (get.type(history[i].useCard[j].card) == "equip") {
						num++;
					}
				}
			}
			player.storage.shanjia = num;
			if (num > 0) {
				player.markSkill("shanjia");
			}
		},
		audio: 2,
		intro: {
			content(storage) {
				if (storage == 0) {
					return "未使用过装备牌";
				}
				return "已使用过" + storage + "张装备牌";
			},
		},
		group: "shanjia2",
		trigger: { player: "phaseUseBegin" },
		frequent: true,
		filter(event, player) {
			lib.skill.shanjia.sync(player);
			return player.storage.shanjia > 0;
		},
		content() {
			"step 0";
			lib.skill.shanjia.sync(player);
			player.draw(Math.min(7, player.storage.shanjia));
			"step 1";
			player.chooseToDiscard("he", Math.min(7, player.storage.shanjia), true);
			"step 2";
			var useCard = false;
			if (result.bool && result.cards) {
				for (var i = 0; i < result.cards.length; i++) {
					if (result.cards[i].original == "e") {
						useCard = true;
						break;
					}
				}
			}
			if (useCard) {
				player.chooseUseTarget({ name: "sha" }, false, "是否视为使用一张【杀】？", "nodistance");
			}
		},
		ai: {
			threaten(player, target) {
				if (typeof target.storage.shanjia == "number") {
					return Math.min(2, Math.sqrt(1 + target.storage.shanjia));
				}
			},
		},
	},
	shanjia2: {
		trigger: { player: "useCard" },
		silent: true,
		sourceSkill: "shanjia",
		filter(event, player) {
			return get.type(event.card) == "equip";
		},
		content() {
			lib.skill.shanjia.sync(player);
		},
	},
	zhanyi: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		filterCard: true,
		position: "he",
		check(card) {
			var player = _status.event.player;
			if (player.hp < 3) {
				return 0;
			}
			var type = get.type(card, "trick");
			if (type == "trick") {
				return 6 - get.value(card);
			} else if (type == "equip") {
				if (
					player.hasSha() &&
					game.hasPlayer(function (current) {
						return player.canUse("sha", current) && get.attitude(player, current) < 0 && get.effect(current, { name: "sha" }, player, player) > 0;
					})
				) {
					return 6 - get.value(card);
				}
			}
			return 0;
		},
		content() {
			player.loseHp();
			switch (get.type(cards[0], "trick")) {
				case "basic":
					player.addTempSkill("zhanyi_basic");
					break;
				case "equip":
					player.addTempSkill("zhanyi_equip");
					break;
				case "trick":
					player.addTempSkill("zhanyi_trick");
					player.draw(2);
					break;
			}
		},
		ai: {
			order: 9.1,
			result: {
				player: 1,
			},
		},
	},
	zhanyi_basic: {
		group: ["zhanyi_basic_sha", "zhanyi_basic_jiu", "zhanyi_basic_tao"],
		sourceSkill: "zhanyi",
	},
	zhanyi_basic_tao: {
		enable: "chooseToUse",
		filterCard: { type: "basic" },
		viewAs: { name: "tao" },
		sourceSkill: "zhanyi",
		viewAsFilter(player) {
			if (!player.countCards("h", { type: "basic" })) {
				return false;
			}
		},
		prompt: "将一张基本牌当桃使用",
		check(card) {
			return 8 - get.value(card);
		},
		ai: {
			skillTagFilter(player) {
				if (!player.countCards("h", { type: "basic" })) {
					return false;
				}
			},
			save: true,
		},
	},
};
