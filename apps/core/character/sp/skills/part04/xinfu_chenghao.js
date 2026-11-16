import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinfu_chenghao" | "xinfu_wuniang" | "xinfu_xushen" | "xinfu_falu" | "xinfu_dianhua" | "xinfu_zhenyi">} */
export const groupSkills = {
	xinfu_chenghao: {
		audio: 2,
		trigger: {
			global: "damageEnd",
		},
		filter(event, player) {
			return event.lianhuanable == true && event.player.isIn();
		},
		frequent: true,
		content() {
			"step 0";
			event.cards = game.cardsGotoOrdering(
				get.cards(
					game.countPlayer(function (current) {
						return current.isLinked();
					}) + 1
				)
			).cards;
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			event.given_map = {};
			"step 1";
			if (event.cards.length > 1) {
				player.chooseCardButton("称好：请选择要分配的牌", true, event.cards, [1, event.cards.length]).set("ai", function (button) {
					if (ui.selected.buttons.length == 0) {
						return 1;
					}
					return 0;
				});
			} else if (event.cards.length == 1) {
				event._result = { links: event.cards.slice(0), bool: true };
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				event.cards.removeArray(result.links);
				event.togive = result.links.slice(0);
				player
					.chooseTarget("选择一名角色获得" + get.translation(result.links), true)
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
					.set("enemy", get.value(event.togive[0], player, "raw") < 0);
			}
			"step 3";
			if (result.targets.length) {
				var id = result.targets[0].playerid,
					map = event.given_map;
				if (!map[id]) {
					map[id] = [];
				}
				map[id].addArray(event.togive);
			}
			if (cards.length > 0) {
				event.goto(1);
			}
			"step 4";
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			var list = [];
			for (var i in event.given_map) {
				var source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				player.line(source, "green");
				list.push([source, event.given_map[i]]);
			}
			game.loseAsync({
				gain_list: list,
				giver: player,
				animate: "draw",
			}).setContent("gaincardMultiple");
		},
	},
	xinfu_wuniang: {
		trigger: {
			player: ["useCard", "respond"],
		},
		audio: 2,
		direct: true,
		filter(event, player) {
			return event.card.name == "sha";
		},
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("xinfu_wuniang"), "获得一名其他角色的一张牌，然后其和场上所有的“关索”摸一张牌。", function (card, player, target) {
					if (player == target) {
						return false;
					}
					return target.countGainableCards(player, "he") > 0;
				})
				.set("ai", function (target) {
					return 10 - get.attitude(_status.event.player, target);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("xinfu_wuniang", target);
				player.line(target, "fire");
				event.draws = game.filterPlayer(function (current) {
					if (current == target) {
						return true;
					}
					return current.name == "guansuo" || current.name2 == "guansuo";
				});
				player.gainPlayerCard(target, "he", true);
			} else {
				event.finish();
			}
			"step 2";
			game.asyncDraw(event.draws, 1);
			game.delay();
		},
	},
	xinfu_xushen: {
		derivation: ["xinfu_zhennan"],
		audio: 2,
		subSkill: {
			count: {
				trigger: {
					player: "recoverBegin",
				},
				forced: true,
				silent: true,
				popup: false,
				filter(event, player) {
					if (!event.card || event.card.name != "tao") {
						return false;
					}
					if (!event.source || !event.source.hasSex("male")) {
						return false;
					}
					if (!player.isDying()) {
						return false;
					}
					if (
						game.hasPlayer(function (current) {
							return current.name == "guansuo" || current.name2 == "guansuo";
						})
					) {
						return false;
					}
					return true;
				},
				content() {
					trigger.xinfu_xushen = true;
				},
				sub: true,
			},
		},
		group: ["xinfu_xushen_count"],
		trigger: {
			player: "recoverAfter",
		},
		limited: true,
		init(player) {
			player.storage.xinfu_xushen = false;
		},
		filter(event, player) {
			if (player.storage.xinfu_xushen) {
				return false;
			}
			if (player.isDying()) {
				return false;
			}
			return event.xinfu_xushen == true;
		},
		direct: true,
		skillAnimation: true,
		animationColor: "fire",
		content() {
			"step 0";
			trigger.source.chooseBool("【许身】：是否将自己的一张武将牌替换为“关索”？").set("ai", function () {
				return false;
			});
			"step 1";
			if (result.bool) {
				player.awakenSkill(event.name);
				player.logSkill("xinfu_xushen", trigger.source);
				if (trigger.source.name2 != undefined) {
					trigger.source.chooseControl(trigger.source.name1, trigger.source.name2).set("prompt", "请选择要更换的武将牌");
				} else {
					event._result = { control: trigger.source.name1 };
				}
			} else {
				event.finish();
			}
			"step 2";
			trigger.source.reinitCharacter(result.control, "guansuo");
			player.recover();
			player.addSkills("xinfu_zhennan");
		},
		mark: true,
		intro: {
			content: "limited",
		},
	},
	xinfu_falu: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "enterGame"],
			global: ["loseAsyncAfter", "phaseBefore"],
		},
		filter(event, player) {
			if (event.name.indexOf("lose") != 0) {
				return event.name != "phase" || game.phaseNumber == 0;
			}
			if (event.type != "discard" || event.getlx === false) {
				return false;
			}
			var evt = event.getl(player);
			for (var i = 0; i < evt.cards2.length; i++) {
				if (!player.hasMark("xinfu_falu_" + get.suit(evt.cards2[i]))) {
					return true;
				}
			}
			return false;
		},
		forced: true,
		content() {
			if (trigger.name.indexOf("lose") !== 0) {
				for (var i = 0; i < lib.suit.length; i++) {
					if (!player.hasMark("xinfu_falu_" + lib.suit[i])) {
						player.addMark("xinfu_falu_" + lib.suit[i]);
					}
				}
				return;
			}
			var evt = trigger.getl(player);
			for (var i = 0; i < evt.cards2.length; i++) {
				var suit = get.suit(evt.cards2[i]);
				if (!player.hasMark("xinfu_falu_" + suit)) {
					player.addMark("xinfu_falu_" + suit);
				}
			}
		},
		ai: {
			combo: ["xinfu_dianhua", "zhenyi"],
			threaten(player, target) {
				//用不了this.combo，获取effect时ai被单独提出来this就丢失了（恼）
				return 1 + ["xinfu_dianhua", "zhenyi"].filter(skill => target.hasSkill(skill)).length;
			},
		},
		subSkill: {
			spade: {
				marktext: "♠︎️",
				intro: {
					name: "紫薇",
					content: "mark",
				},
			},
			heart: {
				marktext: "♥︎️",
				intro: {
					name: "玉清",
					content: "mark",
				},
			},
			club: {
				marktext: "♣︎️",
				intro: {
					name: "后土",
					content: "mark",
				},
			},
			diamond: {
				marktext: "♦︎",
				intro: {
					name: "勾陈",
					content: "mark",
				},
			},
		},
	},
	xinfu_dianhua: {
		audio: 2,
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		filter(event, player) {
			return lib.suit.some(suit => player.hasMark(`xinfu_falu_${suit}`));
		},
		frequent: true,
		async content(event, trigger, player) {
			const num = lib.suit.filter(suit => player.hasMark(`xinfu_falu_${suit}`)).length;
			await player.chooseToGuanxing(num).set("prompt", "点化：点击或拖动将牌移动到牌堆顶或牌堆底");
		},
		ai: { combo: "xinfu_falu" },
	},
	xinfu_zhenyi: { audio: 2 },
};
