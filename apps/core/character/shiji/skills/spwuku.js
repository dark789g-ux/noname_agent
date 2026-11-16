import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "spwuku" | "spsanchen" | "spmiewu" | "qinzheng" | "qinzheng_count" | "spqiai" | "spshanxi" | "spshanxi_suoming" | "spshanxi_bj">} */
export const groupSkills = {
	spwuku: {
		audio: 2,
		trigger: { global: "useCard" },
		forced: true,
		preHidden: true,
		filter(event, player) {
			if (get.type(event.card) != "equip") {
				return false;
			}
			var gz = get.mode() == "guozhan";
			if (gz && event.player.isFriendOf(player)) {
				return false;
			}
			return player.countMark("spwuku") < (gz ? 2 : 3);
		},
		content() {
			player.addMark("spwuku", 1);
		},
		marktext: "库",
		intro: {
			content: "mark",
		},
		ai: {
			combo: "spmiewu",
			threaten: 3.6,
		},
	},
	spsanchen: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return player.countMark("spwuku") > 2;
		},
		content() {
			player.awakenSkill(event.name);
			player.gainMaxHp();
			player.recover();
			player.addSkills("spmiewu");
		},
		ai: {
			combo: "spwuku",
		},
		derivation: "spmiewu",
	},
	spmiewu: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		filter(event, player) {
			if (!player.countMark("spwuku") || !player.countCards("hse") || player.hasSkill("spmiewu_used")) {
				return false;
			}
			return get.inpileVCardList(info => {
				if (!["basic", "trick", "delay"].includes(info[0])) {
					return false;
				}
				return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
			}).length;
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(info => {
					if (!["basic", "trick", "delay"].includes(info[0])) {
						return false;
					}
					return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
				});
				return ui.create.dialog("灭吴", [list, "vcard"]);
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				const player = get.player();
				if (["wugu", "zhulu_card", "yiyi", "lulitongxin", "lianjunshengyan", "diaohulishan"].includes(button.link[2])) {
					return 0;
				}
				return player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
				});
			},
			backup(links, player) {
				return {
					filterCard: true,
					audio: "spmiewu",
					popname: true,
					check(card) {
						return 8 - get.value(card);
					},
					position: "hse",
					viewAs: { name: links[0][2], nature: links[0][3] },
					log: false,
					async precontent(event, trigger, player) {
						player
							.when({ player: ["useCardAfter", "respondAfter"] })
							.filter(evt => evt.getParent() == event.getParent())
							.step(async (event, trigger, player) => {
								await player.draw();
							});
						player.addTempSkill("spmiewu_used");
						player.logSkill("spmiewu");
						player.removeMark("spwuku", 1);
					},
				};
			},
			prompt(links, player) {
				return "将一张牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		hiddenCard(player, name) {
			if (!lib.inpile.includes(name)) {
				return false;
			}
			const type = get.type2(name);
			return ["basic", "trick"].includes(type) && player.countMark("spwuku") > 0 && !player.hasSkill("spmiewu_used");
		},
		ai: {
			combo: "spwuku",
			fireAttack: true,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player) {
				if (!player.countMark("spwuku") || !player.countCards("hse") || player.hasSkill("spmiewu_used")) {
					return false;
				}
			},
			order: 7,
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
			backup: {},
			used: { charlotte: true },
		},
	},
	qinzheng: {
		audio: 2,
		trigger: { player: ["useCard", "respond"] },
		forced: true,
		filter(event, player) {
			var num = player.getAllHistory("useCard").length + player.getAllHistory("respond").length;
			return num % 3 == 0 || num % 5 == 0 || num % 8 == 0;
		},
		content() {
			var num = player.getAllHistory("useCard").length + player.getAllHistory("respond").length;
			var cards = [];
			if (num % 3 == 0) {
				var card = get.cardPile2(function (card) {
					return card.name == "sha" || card.name == "shan";
				});
				if (card) {
					cards.push(card);
				}
			}
			if (num % 5 == 0) {
				var card = get.cardPile2(function (card) {
					return ["tao", "jiu", "zong", "xionghuangjiu"].includes(card.name);
				});
				if (card) {
					cards.push(card);
				}
			}
			if (num % 8 == 0) {
				var card = get.cardPile2(function (card) {
					return ["juedou", "wuzhong", "zengbin", "sadouchengbing", "dongzhuxianji", "tongzhougongji"].includes(card.name);
				});
				if (card) {
					cards.push(card);
				}
			}
			if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
		group: "qinzheng_count",
		intro: {
			content(num) {
				var str = "<li>总次数：";
				str += num;
				str += "<br><li>杀/闪：";
				str += num % 3;
				str += "/3<br><li>桃/酒：";
				str += num % 5;
				str += "/5<br><li>决斗/无中生有：";
				str += num % 8;
				str += "/8";
				return str;
			},
		},
	},
	qinzheng_count: {
		trigger: { player: ["useCard1", "respond"] },
		silent: true,
		firstDo: true,
		noHidden: true,
		sourceSkill: "qinzheng",
		content() {
			player.storage.qinzheng = player.getAllHistory("useCard").length + player.getAllHistory("respond").length;
			player.markSkill("qinzheng");
		},
	},
	spqiai: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				player.countCards("he", function (card) {
					return get.type(card) != "basic";
				}) > 0
			);
		},
		filterCard(card) {
			return get.type(card) != "basic";
		},
		position: "he",
		filterTarget: lib.filter.notMe,
		delay: false,
		discard: false,
		lose: false,
		check(card) {
			var player = _status.event.player;
			if (get.position(card) == "e" && card.name == "jinhe") {
				return 10;
			}
			if (player.isHealthy()) {
				return 7 - get.value(card);
			}
			return 9 - get.value(card);
		},
		content() {
			"step 0";
			player.give(cards, target, true);
			"step 1";
			if (!target.isIn()) {
				event.finish();
				return;
			}
			if (player.isHealthy()) {
				event._result = { index: 1 };
			} else {
				var str = get.translation(player);
				target.chooseControl().set("choiceList", ["令" + str + "回复1点体力", "令" + str + "摸两张牌"]);
			}
			"step 2";
			if (result.index == 0) {
				player.recover();
			} else {
				player.draw(2);
			}
		},
		ai: {
			order: 8,
			result: {
				player: 1,
				target(player, target) {
					if (ui.selected.cards.length) {
						var card = ui.selected.cards[0];
						var val = get.value(card, target);
						if (val < 0) {
							return -1;
						}
						if (target.hasSkillTag("nogain")) {
							return 0;
						}
						var useval = target.getUseValue(card);
						if (val < 1 || useval <= 0) {
							return 0.1;
						}
						return Math.sqrt(useval);
					}
					return 0;
				},
			},
		},
	},
	spshanxi: {
		audio: 2,
		init(player) {
			game.addGlobalSkill("spshanxi_bj");
		},
		onremove(player) {
			if (!game.hasPlayer(current => current.hasSkill("spshanxi", null, null, false), true)) {
				game.removeGlobalSkill("spshanxi_bj");
			}
		},
		trigger: { player: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && !current.hasMark("spshanxi");
			});
		},
		content() {
			"step 0";
			var eff = 0;
			var target = game.findPlayer(function (current) {
				return current != player && current.hasMark("spshanxi");
			});
			if (target) {
				eff = -get.attitude(player, target) / Math.sqrt(Math.max(1, target.hp));
			}
			player
				.chooseTarget(get.prompt("spshanxi"), "令一名其他角色获得“檄”", function (card, player, target) {
					return target != player && !target.hasMark("spshanxi");
				})
				.set("ai", function (target) {
					return -get.attitude(_status.event.player, target) / Math.sqrt(Math.max(1, target.hp)) - _status.event.eff;
				})
				.set("eff", eff);
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("spshanxi", target);
				game.countPlayer(function (current) {
					if (current == target) {
						current.addMark("spshanxi", 1);
					} else {
						var num = current.countMark("spshanxi");
						if (num > 0) {
							current.removeMark("spshanxi", num);
						}
					}
				});
			}
		},
		marktext: "檄",
		intro: {
			name2: "檄",
			content: "已被设下索命檄文",
		},
		group: "spshanxi_suoming",
		ai: { threaten: 3.3 },
	},
	spshanxi_suoming: {
		audio: "spshanxi",
		trigger: { global: "recoverAfter" },
		forced: true,
		sourceSkill: "spshanxi",
		filter(event, player) {
			return event.player.hasMark("spshanxi") && event.player.hp > 0;
		},
		logTarget: "player",
		content() {
			"step 0";
			if (trigger.player.countCards("he") < 2) {
				event._result = { bool: false };
			} else {
				trigger.player.chooseCard("he", 2, "交给" + get.translation(player) + "两张牌，或失去1点体力").set("ai", function (card) {
					return 9 - get.value(card);
				});
			}
			"step 1";
			if (!result.bool) {
				trigger.player.loseHp();
			} else {
				trigger.player.give(result.cards, player);
			}
		},
	},
	spshanxi_bj: {
		trigger: { player: "dieAfter" },
		sourceSkill: "spshanxi",
		filter(event, player) {
			for (let i of game.players) {
				if (i.hasSkill("spshanxi_suoming", null, null, false)) {
					return false;
				}
			}
			return true;
		},
		silent: true,
		forceDie: true,
		charlotte: true,
		content() {
			game.removeGlobalSkill("spshanxi_bj");
		},
		ai: {
			effect: {
				target(card, player, target) {
					let suoming = game.findPlayer(current => current.hasSkill("spshanxi_suoming"));
					if (suoming && _status.event && target === _status.event.dying && target.hasMark("spshanxi")) {
						if (target.countCards("he") < 2) {
							return "zerotarget";
						}
						return [1, get.attitude(target, suoming) > 0 ? 0 : -1.2];
					}
				},
			},
		},
	},
};
