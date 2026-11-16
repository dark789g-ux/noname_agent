import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olshengong">} */
export const groupSkills = {
	//蒲元
	olshengong: {
		audio: 2,
		enable: "phaseUse",
		usable: 3,
		filter(event, player) {
			var list = ["equip1", "equip2", "others"].filter(i => !player.getStorage("olshengong_used").includes(i));
			if (!list.length) {
				return false;
			}
			return player.hasCard(function (card) {
				var type = get.type(card);
				if (type != "equip") {
					return false;
				}
				var subtype = get.subtype(card);
				if (subtype != "equip1" && subtype != "equip2") {
					subtype = "others";
				}
				return list.includes(subtype);
			}, "eh");
		},
		filterCard(card, player) {
			var type = get.type(card);
			if (type != "equip") {
				return false;
			}
			var subtype = get.subtype(card);
			if (subtype != "equip1" && subtype != "equip2") {
				subtype = "others";
			}
			return !player.getStorage("olshengong_used").includes(subtype);
		},
		position: "he",
		check(card) {
			var val = 7.52 - get.value(card);
			if (val <= 0) {
				return 0;
			}
			var player = _status.event.player;
			if (player.getStorage("olshengong_destroy").includes(card)) {
				val += 2;
			}
			return val;
		},
		content() {
			"step 0";
			var subtype = get.subtype(cards[0]);
			if (subtype != "equip1" && subtype != "equip2") {
				subtype = "others";
			}
			player.addTempSkill("olshengong_used", "phaseUseAfter");
			player.markAuto("olshengong_used", subtype);
			var send = function () {
				game.me.chooseControl("助力锻造！", "妨碍锻造！", "什么都不做");
				game.resume();
			};
			var sendback = function (result, player) {
				if (result) {
					var index = result.index;
					game.log(player, "选择了", ["#b助力锻造", "#g妨碍锻造", "#b什么都不做"][index]);
					if (index > 1) {
						return;
					}
					var card = get.cards()[0];
					if (!card) {
						return;
					}
					game.log(player, "展示了", card);
					event.cardsx.push(card);
					event.cards2[index].push(card);
					game.broadcastAll(
						function (id, card, name, index) {
							var dialog = get.idDialog(id);
							if (!dialog) {
								return;
							}
							var button = ui.create.button(card, "card", dialog.buttonss[index]);
							game.createButtonCardsetion(name + get.strNumber(card.number), button);
						},
						event.videoId,
						card,
						player.getName(true),
						index
					);
				}
			};
			event.players = game.filterPlayer();
			event.cardsx = [];
			event.cards2 = [[], []];
			event.videoId = lib.status.videoId++;
			event.ai_targets = [];
			game.broadcastAll(
				function (name, id) {
					var dialog = ui.create.dialog(name + "发起了“锻造”", "hidden", "forcebutton");
					dialog.videoId = id;
					dialog.classList.add("scroll1");
					dialog.classList.add("scroll2");
					dialog.classList.add("fullwidth");
					dialog.classList.add("fullheight");
					ui.arena.classList.add("choose-to-move");
					dialog.buttonss = [];

					var list = ["协力锻造的玩家", "妨碍锻造的玩家"];
					for (var i = 0; i < list.length; i++) {
						dialog.add('<div class="text center">' + list[i] + "</div>");
						var buttons = ui.create.div(".buttons", dialog.content);
						dialog.buttonss.push(buttons);
						buttons.classList.add("popup");
						buttons.classList.add("guanxing");
					}
					dialog.open();
				},
				get.translation(player),
				event.videoId
			);
			for (var i = 0; i < event.players.length; i++) {
				if (event.players[i] == player) {
					sendback({ index: 0 }, player);
				} else if (event.players[i].isOnline()) {
					event.withol = true;
					event.players[i].send(send);
					event.players[i].wait(sendback);
				} else if (event.players[i] == game.me) {
					event.withme = true;
					game.me.chooseControl("助力锻造！", "妨碍锻造！", "什么都不做").set("ai", () => {
						const player = get.player(),
							target = get.event().getParent().player;
						const att = get.attitude(player, target);
						let num = 2;
						if (att > 0) {
							num = 0;
						} else if (att < 0) {
							num = 1;
						}
						return num;
					});
					if (_status.connectMode) {
						game.me.wait(sendback);
					}
				} else {
					event.ai_targets.push(event.players[i]);
					if (_status.connectMode) {
						event.players[i].showTimer();
					}
				}
			}
			if (event.ai_targets.length) {
				event.ai_targets.randomSort();
				setTimeout(function () {
					event.interval = setInterval(function () {
						var target = event.ai_targets.shift();
						var att = get.attitude(target, player);
						var num = 2;
						if (att > 0) {
							num = 0;
						} else if (att < 0) {
							num = 1;
						}
						sendback({ index: num }, target);
						if (_status.connectMode) {
							target.hideTimer();
						}
						if (!event.ai_targets.length) {
							clearInterval(event.interval);
							if (event.withai) {
								game.resume();
							}
						}
					}, 750);
				}, 500);
			}
			"step 1";
			if (event.withme) {
				if (_status.connectMode) {
					game.me.unwait(result);
				} else {
					var index = result.index;
					game.log(game.me, "选择了", ["#b助力锻造", "#g妨碍锻造", "#b什么都不做"][index]);
					if (index > 1) {
						return;
					}
					var card = get.cards()[0];
					if (!card) {
						return;
					}
					game.log(game.me, "展示了", card);
					event.cardsx.push(card);
					event.cards2[index].push(card);
					game.broadcastAll(
						function (id, card, name, index) {
							var dialog = get.idDialog(id);
							if (!dialog) {
								return;
							}
							var button = ui.create.button(card, "card", dialog.buttonss[index]);
							game.createButtonCardsetion(name + get.strNumber(card.number), button);
						},
						event.videoId,
						card,
						game.me.getName(true),
						index
					);
				}
			}
			"step 2";
			if (event.withol && !event.resultOL) {
				game.pause();
			}
			"step 3";
			if (event.ai_targets.length > 0) {
				event.withai = true;
				game.pause();
			}
			"step 4";
			game.broadcastAll(function () {
				setTimeout(function () {
					ui.arena.classList.remove("choose-to-move");
				}, 500);
			});
			game.delay(2);
			var num1 = 0,
				num2 = 0;
			for (var i of event.cards2[0]) {
				num1 += get.number(i, false);
			}
			for (var i of event.cards2[1]) {
				num2 += get.number(i, false);
			}
			var result = 2;
			if (num1 < num2) {
				result = 0;
			} else if (num2 > 0) {
				result = 1;
			}
			event.duanzao_result = result;
			game.broadcastAll(
				function (id, result) {
					var dialog = get.idDialog(id);
					if (dialog) {
						dialog.content.firstChild.innerHTML = ["锻造失败…", "锻造成功", "完美锻造！"][result];
					}
				},
				event.videoId,
				result
			);
			"step 5";
			game.cardsGotoOrdering(event.cardsx);
			game.broadcastAll("closeDialog", event.videoId);
			"step 6";
			var subtype = get.subtype(cards[0]);
			if (subtype != "equip1" && subtype != "equip2") {
				subtype = "others";
			}
			var card_map = {
				equip1: [
					["diamond", 13, "bintieshuangji"],
					["diamond", 1, "wuxinghelingshan"],
					["spade", 13, "wutiesuolian"],
					["diamond", 12, "wushuangfangtianji"],
					["spade", 6, "chixueqingfeng"],
					["spade", 5, "guilongzhanyuedao"],
				],
				equip2: [
					["club", 1, "huxinjing"],
					["club", 2, "heiguangkai"],
					["spade", 2, "linglongshimandai"],
					["club", 1, "hongmianbaihuapao"],
					["spade", 2, "qimenbagua"],
					["spade", 9, "guofengyupao"],
				],
				others: [
					["diamond", 1, "zhaogujing"],
					["spade", 5, "sanlve"],
					["club", 12, "tianjitu"],
					["spade", 2, "taigongyinfu"],
					["diamond", 1, "shufazijinguan"],
					["club", 4, "xuwangzhimian"],
				],
			};
			if (!_status.olshengong_map) {
				_status.olshengong_map = {};
			}
			if (!_status.olshengong_maken) {
				_status.olshengong_maken = {};
			}
			var list = card_map[subtype];
			for (var i = 0; i < list.length; i++) {
				var name = list[i][2];
				if (!lib.card[name] || _status.olshengong_map[name]) {
					list.splice(i--, 1);
				}
			}
			if (!list.length) {
				event.finish();
			} else {
				player.chooseButton(["请选择一种装备牌", [list.randomGets(event.duanzao_result + 1), "vcard"]], true).set("ai", function (button) {
					return get.value({ name: button.link[2] }, player, "raw");
				});
			}
			"step 7";
			var name = result.links[0][2];
			var card;
			if (_status.olshengong_maken[name]) {
				card = _status.olshengong_maken[name];
			} else {
				card = game.createCard2(name, result.links[0][0], result.links[0][1]);
				_status.olshengong_maken[name] = card;
			}
			event.card = card;
			player.addSkill("olshengong_destroy");
			player.markAuto("olshengong_destroy", [card]);
			if (
				!game.hasPlayer(function (current) {
					return current.canEquip(card, true);
				})
			) {
				event.finish();
				return;
			}
			player
				.chooseTarget(true, "将" + get.translation(card) + "置于一名角色的装备区内", function (card, player, target) {
					return target.canEquip(_status.event.card, true);
				})
				.set("card", card)
				.set("ai", function (target) {
					var card = _status.event.getParent().card,
						player = _status.event.player;
					return get.effect(target, card, player, player);
				});
			"step 8";
			if (result.bool) {
				_status.olshengong_map[card.name] = true;
				var target = result.targets[0];
				player.line(target, "green");
				target.$gain2(card);
				game.delayx();
				target.equip(card);
			}
		},
		ai: {
			order: 10,
			result: { player: 1 },
		},
		subSkill: {
			used: { charlotte: true, onremove: true },
			destroy: {
				trigger: { global: ["loseEnd", "cardsDiscardEnd"] },
				forced: true,
				charlotte: true,
				popup: false,
				onremove: true,
				filter(event, player) {
					if (event.name == "lose" && event.position != ui.discardPile) {
						return false;
					}
					var storage = player.storage.olshengong_destroy;
					if (!storage) {
						return false;
					}
					for (var i of event.cards) {
						if (storage.includes(i)) {
							return true;
						}
					}
					return false;
				},
				content() {
					var cards = [];
					var storage = player.storage.olshengong_destroy;
					for (var i of trigger.cards) {
						if (storage.includes(i)) {
							delete _status.olshengong_map[i.name];
							storage.remove(i);
							cards.push(i);
						}
					}
					game.cardsGotoSpecial(cards);
					game.log(cards, "被移出了游戏");
					player.addTempSkill("olshengong_draw");
					player.addMark("olshengong_draw", cards.length, false);
					if (!storage.length) {
						player.removeSkill("olshengong_destroy");
					}
				},
			},
			draw: {
				audio: "olshengong",
				trigger: { global: "phaseJieshuBegin" },
				forced: true,
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return player.countMark("olshengong_draw") > 0;
				},
				content() {
					player.draw(player.countMark(event.name));
				},
			},
		},
	},
};
