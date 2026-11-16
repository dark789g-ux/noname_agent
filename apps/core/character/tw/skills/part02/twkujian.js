import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twkujian" | "twruilian" | "twruilian2">} */
export const groupSkills = {
	//阎象
	twkujian: {
		audio: 3,
		enable: "phaseUse",
		filterCard: true,
		selectCard: [1, 3],
		usable: 1,
		discard: false,
		lose: false,
		delay: false,
		filterTarget: lib.filter.notMe,
		global: "twkujian_ai",
		check(card) {
			if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
				return 0;
			}
			if (!ui.selected.cards.length && card.name == "du") {
				return 20;
			}
			var player = get.owner(card);
			if (ui.selected.cards.length >= Math.max(2, player.countCards("h") - player.hp)) {
				return 0;
			}
			if (player.hp == player.maxHp || player.storage.jsprende < 0 || player.countCards("h") <= 1) {
				var players = game.filterPlayer();
				for (var i = 0; i < players.length; i++) {
					if (
						players[i].hasSkill("haoshi") &&
						!players[i].isTurnedOver() &&
						!players[i].hasJudge("lebu") &&
						get.attitude(player, players[i]) >= 3 &&
						get.attitude(players[i], player) >= 3
					) {
						return 11 - get.value(card);
					}
				}
				if (player.countCards("h") > player.hp) {
					return 10 - get.value(card);
				}
				if (player.countCards("h") > 2) {
					return 6 - get.value(card);
				}
				return -1;
			}
			return 10 - get.value(card);
		},
		logAudio: () => 1,
		content() {
			player.give(cards, target).gaintag.add("twkujianx");
			player.addSkill("twkujian_draw");
			player.addSkill("twkujian_discard");
		},
		ai: {
			expose: 0.2,
			order: 7,
			result: {
				target(player, target) {
					if (target.hasSkillTag("nogain")) {
						return 0;
					}
					if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
						if (target.hasSkillTag("nodu")) {
							return 0;
						}
						return -10;
					}
					if (target.hasJudge("lebu")) {
						return 0;
					}
					var nh = target.countCards("h");
					var np = player.countCards("h");
					if (player.hp == player.maxHp || player.storage.jsprende < 0 || player.countCards("h") <= 1) {
						if (nh >= np - 1 && np <= player.hp && !target.hasSkill("haoshi")) {
							return 0;
						}
					}
					return Math.max(1, 5 - nh);
				},
			},
			effect: {
				target_use(card, player, target) {
					if (player == target && get.type(card) == "equip") {
						if (player.countCards("e", { subtype: get.subtype(card) })) {
							if (
								game.hasPlayer(function (current) {
									return current != player && get.attitude(player, current) > 0;
								})
							) {
								return 0;
							}
						}
					}
				},
			},
		},
		subSkill: {
			draw: {
				audio: "twkujian2.mp3",
				trigger: { global: ["useCardAfter", "respondAfter"] },
				forced: true,
				logTarget: "player",
				charlotte: true,
				filter(event, player) {
					return player !== event.player;
					/*event.player.hasHistory("lose", evt => {
							const evtx = evt.relatedEvent || evt.getParent();
							if (event != evtx) {
								return false;
							}
							for (var i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("twkujianx")) {
									return true;
								}
							}
						})*/
				},
				getIndex(event, player) {
					let num = 0;
					event.player.getHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (event != evtx) {
							return false;
						}
						for (let i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("twkujianx")) {
								num++;
							}
						}
					});
					return num;
				},
				async content(event, trigger, player) {
					await game.asyncDraw([player, trigger.player]);
					await game.delayx();
				},
			},
			discard: {
				audio: "twkujian3.mp3",
				trigger: {
					global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				forced: true,
				charlotte: true,
				filter(event, player, name, target) {
					return target.isIn();
				},
				getIndex(event, player) {
					let targets = [];
					game.filterPlayer(current => {
						if (player === current) {
							return false;
						}
						let evt = event.getl(current);
						if (!evt || !evt.hs || !evt.hs.length) {
							return false;
						}
						if (event.name == "lose") {
							let name = event.getParent().name;
							if (name == "useCard" || name == "respond") {
								return false;
							}
							for (let i in event.gaintag_map) {
								if (event.gaintag_map[i].includes("twkujianx")) {
									targets.push(current);
								}
							}
							return false;
						}
						return current.hasHistory("lose", function (evt) {
							if (event != evt.getParent()) {
								return false;
							}
							let name = evt.relatedEvent?.name;
							if (name == "useCard" || name == "respond") {
								return false;
							}
							for (let i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("twkujianx")) {
									targets.push(current);
								}
							}
							return false;
						});
					});
					return targets.sortBySeat();
				},
				logTarget(event, player, triggername, target) {
					return target;
				},
				async content(event, trigger, player) {
					let targets = [player, event.indexedData].sortBySeat();
					for (let tar of targets) {
						if (tar.countCards("he") > 0) {
							await tar.chooseToDiscard("he", true);
						}
					}
				},
			},
			ai: {
				charlotte: true,
				ai: {
					effect: {
						player_use(card, player, target) {
							if (
								card.cards &&
								card.cards.some(i => i.hasGaintag("twkujianx")) &&
								game.hasPlayer(current => {
									return get.attitude(player, current) > 0;
								})
							) {
								return [1, 1];
							}
						},
					},
				},
				mod: {
					aiOrder(player, card, num) {
						if (
							get.itemtype(card) == "card" &&
							card.hasGaintag("twkujianx") &&
							game.hasPlayer(current => {
								return get.attitude(player, current) > 0;
							})
						) {
							return num + 0.5;
						}
					},
					aiValue(player, card, num) {
						if (
							get.itemtype(card) == "card" &&
							card.hasGaintag("twkujianx") &&
							game.hasPlayer(current => {
								return get.attitude(player, current) > 0;
							})
						) {
							return num + 0.5;
						}
					},
				},
			},
		},
	},
	twruilian: {
		audio: 2,
		trigger: { global: "roundStart" },
		direct: true,
		content() {
			"step 0";
			player.chooseTarget(get.prompt2("twruilian")).set("ai", function (target) {
				var player = _status.event.player,
					att = get.attitude(player, target),
					eff = att / (player == target ? 2 : 1) + 1;
				if (att >= 0) {
					if (target.hasSkill("yongsi")) {
						return eff * 5;
					}
					if (target.hasSkill("zhiheng") || target.hasSkill("rezhiheng")) {
						return eff * 4;
					}
					if (target.hasSkill("rekurou")) {
						return eff * 3;
					}
					if (target.hasSkill("xinlianji") || target.hasSkill("dclianji")) {
						return eff * 2;
					}
					if (target.needsToDiscard()) {
						return eff * 1.5;
					}
					return eff;
				}
				return 0;
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("twruilian", target);
				player.markAuto("twruilian2", [target]);
				player.addSkill("twruilian2");
			}
		},
	},
	twruilian2: {
		trigger: { global: "phaseEnd" },
		direct: true,
		charlotte: true,
		onremove: true,
		sourceSkill: "twruilian",
		filter(event, player) {
			return player.getStorage("twruilian2").includes(event.player);
		},
		intro: { content: "已选择$" },
		content() {
			"step 0";
			player.removeSkill("twruilian2");
			var target = trigger.player;
			event.target = target;
			var cards = [];
			target.getHistory("lose", function (evt) {
				if (evt.type == "discard") {
					cards.addArray(evt.cards2);
				}
			});
			if (cards.length < 2) {
				event.finish();
			} else {
				event.cards = cards;
			}
			"step 1";
			var list = [];
			for (var type of ["basic", "trick", "equip"]) {
				for (var card of event.cards) {
					if (get.type2(card) == type) {
						list.push(type);
						break;
					}
				}
			}
			list.push("cancel2");
			player
				.chooseControl(list)
				.set("prompt", "睿敛：是否与" + get.translation(target) + "各获得一种类型的牌？")
				.set("ai", function () {
					var player = _status.event.player,
						list = _status.event.controls;
					if (player.hp <= 3 && !player.countCards("h", { name: ["shan", "tao"] }) && list.includes("basic")) {
						return "basic";
					}
					if (player.countCards("he", { type: "equip" }) < 2 && list.includes("equip")) {
						return "equip";
					}
					if (list.includes("trick")) {
						return "trick";
					}
					return list.remove("cancel2").randomGet();
				});
			"step 2";
			if (result.control != "cancel2") {
				player.logSkill("twruilian2", target);
				var type = result.control;
				var list = [target, player].sortBySeat(_status.currentPhase),
					cards = [];
				for (var current of list) {
					var card = get.discardPile(function (card) {
						return get.type2(card) == type && !cards.includes(card);
					});
					if (card) {
						cards.push(card);
						current.gain(card, "gain2");
					}
				}
			}
		},
	},
};
