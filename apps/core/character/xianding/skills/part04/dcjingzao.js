import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjingzao" | "dcenyu" | "dclianzhi" | "dclingfang" | "dcfengying" | "dcshouze">} */
export const groupSkills = {
	//程秉
	dcjingzao: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (3 + player.countMark("dcjingzao_add") - player.countMark("dcjingzao_ban") <= 0) {
				return false;
			}
			return game.hasPlayer(current => lib.skill.dcjingzao.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return player != target && !target.hasSkill("dcjingzao_temp");
		},
		content() {
			"step 0";
			target.addTempSkill("dcjingzao_temp");
			var cards = get.cards(3 + player.countMark("dcjingzao_add") - player.countMark("dcjingzao_ban"), true);
			event.cards = cards;
			game.log(player, "亮出了", event.cards);
			event.videoId = lib.status.videoId++;
			game.broadcastAll(
				function (player, target, id, cards) {
					var str = get.translation(player) + "对" + (target == game.me ? "你" : get.translation(target)) + "发动了【经造】";
					var dialog = ui.create.dialog(str, cards);
					dialog.videoId = id;
				},
				player,
				target,
				event.videoId,
				event.cards
			);
			game.addVideo("showCards", player, [get.translation(player) + "发动了【经造】", get.cardsInfo(event.cards)]);
			game.delay();
			"step 1";
			target
				.chooseToDiscard("he")
				.set("prompt", false)
				.set("filterCard", card => {
					var names = _status.event.getParent().cards.map(i => i.name);
					return names.includes(get.name(card));
				})
				.set("ai", card => {
					var target = _status.event.player,
						player = _status.event.getParent().player;
					var att = get.attitude(target, player),
						val = get.value(card);
					if (!lib.skill.dcjingzao.filter(null, player)) {
						if (att > 0) {
							return 0;
						}
						return 6 - val;
					} else {
						if (att > 0) {
							return 4 - val;
						}
						return 0;
					}
				});
			var update = function (id, source) {
				var dialog = get.idDialog(id);
				if (dialog) {
					var div = ui.create.div("", dialog.content, 1);
					var name = get.translation(source);
					div.innerHTML = "弃置一张满足条件的牌，然后" + name + "〖经造〗本回合亮出牌数+1；或点“取消”令" + name + "随机获得每种牌名的牌各一张，且〖经造〗本回合失效";
					ui.update();
				}
			};
			if (target == game.me) {
				update(event.videoId, player);
			} else if (target.isOnline()) {
				target.send(update, event.videoId, player);
			}
			"step 2";
			game.broadcastAll("closeDialog", event.videoId);
			if (result.bool) {
				player.addTempSkill("dcjingzao_add");
				player.addMark("dcjingzao_add", 1, false);
			} else {
				var cards = cards.randomSort(),
					cards2 = [];
				for (var card of cards) {
					if (!cards2.map(i => i.name).includes(card.name)) {
						cards2.push(card);
					}
				}
				if (cards2.length) {
					player.gain(cards2, "gain2");
				}
				player.addTempSkill("dcjingzao_ban");
				player.addMark("dcjingzao_ban", cards2.length, false);
			}
		},
		ai: {
			order: 7,
			result: {
				player: 1,
			},
		},
		subSkill: {
			add: { charlotte: true, onremove: true },
			ban: { charlotte: true, onremove: true },
			temp: { charlotte: true },
		},
	},
	dcenyu: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		forced: true,
		filter(event, player) {
			return (
				event.player != player &&
				game.hasPlayer2(current => {
					return current.hasHistory("useCard", evt => {
						return evt.card.name == event.card.name && evt != event.getParent() && evt.targets && evt.targets.includes(player);
					});
				}) &&
				(event.card.name == "sha" || get.type(event.card) == "trick")
			);
		},
		content() {
			trigger.getParent().excluded.add(player);
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (player === target) {
						return;
					}
					if (
						game.hasPlayer2(current => {
							return current.hasHistory("useCard", evt => evt.card.name == card.name && evt.targets && evt.targets.includes(target));
						}) &&
						(card.name == "sha" || get.type(card) == "trick")
					) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	//董贵人
	dclianzhi: {
		audio: 2,
		trigger: { player: "dying" },
		usable: 1,
		forced: true,
		locked: false,
		derivation: "dcshouze",
		group: ["dclianzhi_connect", "dclianzhi_reproach"],
		filter(event, player) {
			return player.getStorage("dclianzhi").filter(i => i && i.isIn()).length;
		},
		content() {
			player.recover();
			game.asyncDraw([player].concat(player.getStorage("dclianzhi").filter(i => i && i.isIn())).sortBySeat());
		},
		ai: {
			threaten: 0.6,
		},
		subSkill: {
			connect: {
				audio: "dclianzhi",
				trigger: {
					player: "enterGame",
					global: "phaseBefore",
				},
				forced: true,
				direct: true,
				filter(event, player) {
					return game.hasPlayer(current => current != player) && (event.name != "phase" || game.phaseNumber == 0);
				},
				content() {
					"step 0";
					player
						.chooseTarget("连枝：请选择一名其他角色", lib.translate.dclianzhi_info, true, (card, player, target) => {
							return target != player && !player.getStorage("dclianzhi").includes(target);
						})
						.set("ai", target => {
							var att = get.attitude(_status.event.player, target);
							if (att > 0) {
								return att + 1;
							}
							if (att == 0) {
								return Math.random();
							}
							return att;
						})
						.set("animate", false);
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						player.logSkill("dclianzhi");
						player.markAuto("dclianzhi", [target]);
					}
				},
			},
			reproach: {
				audio: "dclianzhi",
				trigger: { global: "dieAfter" },
				filter(event, player) {
					return player.getStorage("dclianzhi").includes(event.player);
				},
				direct: true,
				content() {
					"step 0";
					var num = Math.max(1, player.countMark("dclingfang"));
					player
						.chooseTarget(get.prompt("dclianzhi"), "选择一名其他角色，你与其各获得〖受责〗，且其获得" + num + "枚“绞”标记", (card, player, target) => {
							return target != player;
						})
						.set("ai", target => -get.attitude(_status.event.player, target));
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						player.logSkill("dclianzhi_reproach", target);
						player.addSkills("dcshouze");
						target.addSkills("dcshouze");
						target.addMark("dclingfang", Math.max(1, player.countMark("dclingfang")));
					}
				},
			},
		},
	},
	dclingfang: {
		audio: 2,
		trigger: {
			player: "phaseZhunbeiBegin",
			global: "useCardAfter",
		},
		forced: true,
		filter(event, player) {
			if (event.name != "useCard") {
				return true;
			}
			if (get.color(event.card) != "black") {
				return false;
			}
			if (event.player == player) {
				return !event.targets || !event.targets.includes(player);
			}
			return event.targets && event.targets.includes(player);
		},
		content() {
			player.addMark("dclingfang", 1);
		},
		ai: {
			combo: "dcfengying",
		},
		marktext: "绞",
		intro: {
			name: "绞",
			name2: "绞",
			content: "mark",
		},
	},
	dcfengying: {
		audio: 2,
		enable: "chooseToUse",
		group: "dcfengying_record",
		locked: false,
		filter(event, player) {
			var mark = player.countMark("dclingfang");
			if (mark <= 0 || !player.hasCard(card => get.number(card) <= mark, "hs")) {
				return false;
			}
			var storage = player.getStorage("dcfengying");
			if (!storage.length) {
				return false;
			}
			var storage2 = player.getStorage("dcfengying_used");
			return storage.some(name => {
				return !storage2.includes(name) && event.filterCard(get.autoViewAs({ name }, "unsure"), player, event);
			});
		},
		hiddenCard(player, name) {
			var list = player.getStorage("dcfengying");
			if (player.getStorage("dcfengying_used").includes(name)) {
				return false;
			}
			return list.includes(name) && player.hasCard(card => get.number(card) <= player.countMark("dclingfang"), "hs");
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var name of player.storage.dcfengying) {
					if (get.type(name) == "basic") {
						list.push(["基本", "", name]);
					}
					if (get.type(name) == "trick") {
						list.push(["锦囊", "", name]);
					}
				}
				return ui.create.dialog("风影", [list, "vcard"]);
			},
			filter(button, player) {
				var card = { name: button.link[2], storage: { dcfengying: true } };
				if (player.getStorage("dcfengying_used").includes(card.name)) {
					return false;
				}
				return _status.event.getParent().filterCard(get.autoViewAs(card, "unsure"), player, _status.event.getParent());
			},
			check(button) {
				var player = _status.event.player;
				if (player.countCards("hs", button.link[2]) > 0) {
					return 0;
				}
				if (button.link[2] == "wugu") {
					return;
				}
				var effect = player.getUseValue(button.link[2]);
				if (effect > 0) {
					return effect;
				}
				return 0;
			},
			backup(links, player) {
				return {
					filterCard(card, player, event) {
						return get.number(card) <= player.countMark("dclingfang");
					},
					audio: "dcfengying",
					selectCard: 1,
					popname: true,
					check(card) {
						return 6 - get.value(card) + get.number(card) / 15;
					},
					position: "hs",
					viewAs: {
						name: links[0][2],
						storage: { dcfengying: true },
					},
					log: false,
					precontent() {
						player.logSkill("dcfengying");
						player.addTempSkill("dcfengying_used");
						player.markAuto("dcfengying_used", [event.result.card.name]);
						event.getParent().addCount = false;
					},
				};
			},
			prompt(links, player) {
				return "将一张点数不大于" + get.strNumber(player.countMark("dclingfang")) + "的手牌当做" + get.translation(links[0][2]) + "使用（无距离和次数限制）";
			},
		},
		mod: {
			targetInRange(card) {
				if (card.storage?.dcfengying) {
					return true;
				}
			},
			cardUsable(card, player) {
				if (card.storage?.dcfengying) {
					return Infinity;
				}
			},
		},
		ai: {
			order: 4,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
			threaten: 2,
			combo: "dclingfang",
		},
		subSkill: {
			record: {
				trigger: { global: "phaseBegin" },
				filter(event, player) {
					return ui.discardPile.childNodes.length > 0;
				},
				forced: true,
				popup: false,
				content() {
					player.storage.dcfengying = [];
					for (var i = 0; i < ui.discardPile.childNodes.length; i++) {
						var card = ui.discardPile.childNodes[i];
						if (get.color(card, false) != "black") {
							continue;
						}
						if (!["basic", "trick"].includes(get.type(card))) {
							continue;
						}
						player.storage.dcfengying.add(card.name);
					}
					player.storage.dcfengying.sort((a, b) => {
						return lib.inpile.indexOf(a) - lib.inpile.indexOf(b);
					});
				},
			},
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "已使用过$" },
			},
		},
	},
	dcshouze: {
		audio: true,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		filter(event, player) {
			return player.countMark("dclingfang") > 0;
		},
		content() {
			"step 0";
			player.removeMark("dclingfang", 1);
			"step 1";
			var card = get.discardPile(card => get.color(card, false) == "black", "random");
			if (card) {
				player.gain(card, "gain2");
			}
			player.loseHp();
		},
		ai: {
			combo: "dclingfang",
			neg: true,
		},
	},
};
