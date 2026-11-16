import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshuhe" | "dcliehou" | "suoliang" | "qinbao" | "midu" | "xianwang">} */
export const groupSkills = {
	//吕旷吕翔
	dcshuhe: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterCard: true,
		position: "h",
		discard: false,
		lose: false,
		delay: false,
		check(cardx) {
			var player = _status.event.player;
			var num1 = get.number(cardx),
				players = game.filterPlayer();
			var goon = false,
				effect = 0;
			for (var current of players) {
				var cards = current.getCards("ej", function (card) {
					var num = get.number(card);
					return num == num1;
				});
				if (cards.length) {
					goon = true;
					var att = get.attitude(player, current);
					for (var card of cards) {
						if (get.position(card) == "e") {
							var val = get.value(card, current);
							if (att <= 0) {
								effect += val;
							} else {
								effect -= val / 2;
							}
						} else {
							var eff = get.effect(current, { name: card.viewAs || card.name }, player, player);
							effect -= get.sgn(att) * eff;
						}
					}
				}
			}
			if (goon) {
				if (effect > 0) {
					return 6 + effect - get.value(cardx);
				}
				return 0;
			}
			return game.hasPlayer(function (current) {
				return current != player && get.attitude(player, current) > 0;
			})
				? 6 - get.value(cardx)
				: 0;
		},
		async content(event, trigger, player) {
			const { cards } = event;
			let result;

			await player.showCards(cards, get.translation(player) + "发动了【数合】");
			player.addMark("dcliehou", 1);

			const cards2 = [];
			const num1 = get.number(cards[0], player);
			const lose_list = [];
			const players = game.filterPlayer();

			for (const current of players) {
				const matched = current.getCards("ej", card => {
					const num = get.number(card);
					return num == num1;
				});
				if (matched.length > 0) {
					player.line(current, "thunder");
					current.$throw(matched);
					lose_list.push([current, matched]);
					cards2.addArray(matched);
				}
			}

			if (lose_list.length > 0) {
				await game
					.loseAsync({
						lose_list,
					})
					.setContent("chooseToCompareLose");

				if (cards2.length > 0) {
					await game.delayx();
					await player.gain(cards2, "gain2");
				}
				return;
			}

			result = await player
				.chooseTarget(true, lib.filter.notMe, "将" + get.translation(cards[0]) + "交给一名其他角色")
				.set("ai", target => {
					return get.attitude(_status.event.player, target);
				})
				.forResult();

			if (result.bool) {
				const target = result.targets[0];
				player.line(target, "green");
				await player.give(cards, target);
			}
		},
		ai: {
			order: 2,
			result: {
				player: 1,
			},
		},
	},
	dcliehou: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		forced: true,
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			var num = Math.min(5, 1 + player.countMark("dcliehou"));
			trigger.num += num;
			trigger._dcliehou = num;
		},
		group: "dcliehou_discard",
		subSkill: {
			discard: {
				audio: "dcliehou",
				trigger: { player: "phaseDrawEnd" },
				forced: true,
				filter(event, player) {
					return typeof event._dcliehou == "number";
				},
				async content(event, trigger, player) {
					const num = trigger._dcliehou;
					const result = await player
						.chooseToDiscard(num, "he", "弃置" + get.cnNumber(num) + "张牌，或失去1点体力")
						.set("ai", card => {
							if (_status.event.goon) {
								return 6 - get.value(card);
							}
							return 26 - get.value(card);
						})
						.set("goon", player.hp > Math.max(1, 4 - num) || get.effect(player, { name: "losehp" }, player, player) > 0)
						.forResult();
					if (!result.bool) {
						player.loseHp();
					}
				},
			},
		},
		marktext: "爵",
		intro: {
			name: "列侯(爵)",
			name2: "爵",
			content: "〖列侯〗的摸牌数+#",
		},
	},
	//管亥
	suoliang: {
		audio: 2,
		trigger: { source: "damageSource" },
		logTarget: "player",
		usable: 1,
		filter(event, player) {
			return event.player != player && event.player.maxHp > 0 && event.player.countCards("he") > 0;
		},
		check(event, player) {
			return get.attitude(player, event.player) <= 0;
		},
		async content(event, trigger, player) {
			const target = trigger.player;
			const result = await player.choosePlayerCard(target, true, "he", [1, target.maxHp], "选择" + get.translation(target) + "的至多" + get.cnNumber(target.maxHp) + "张牌").forResult();
			if (result.bool) {
				await player.showCards(result.cards, get.translation(player) + "对" + get.translation(target) + "发动了【索粮】");
				const cards = result.cards.filter(card => {
					const suit = get.suit(card, target);
					if (suit != "heart" && suit != "club") {
						return false;
					}
					return lib.filter.canBeGained(card, target, player);
				});
				if (cards.length) {
					await player.gain(cards, target, "giveAuto", "bySelf");
				} else {
					await target.modedDiscard(result.cards, player);
				}
			}
		},
	},
	qinbao: {
		audio: 2,
		trigger: { player: "useCard" },
		forced: true,
		filter(event, player) {
			return (
				(event.card.name == "sha" || get.type(event.card, null, false) == "trick") &&
				game.hasPlayer(function (current) {
					return current != player && current.countCards("h") >= player.countCards("h");
				})
			);
		},
		async content(event, trigger, player) {
			var hs = player.countCards("h");
			trigger.directHit.addArray(
				game.filterPlayer(function (current) {
					return current != player && current.countCards("h") >= hs;
				})
			);
		},
		ai: {
			threaten: 1.4,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (!arg?.target) {
					return false;
				}
				return (
					player.countCards("h", function (card) {
						return !ui.selected.cards.includes(card);
					}) <= arg.target.countCards("h")
				);
			},
		},
	},
	//胡昭
	midu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				var dialog = ui.create.dialog("弥笃：选择要废除或恢复的装备栏或判定区", "hidden");
				dialog.classList.add("withbg");
				dialog.noforcebutton = true;
				var list1 = [],
					list2 = [];
				for (var i = 1; i < 6; i++) {
					for (var j = 0; j < player.countEnabledSlot(i); j++) {
						list1.push(i);
					}
					if (player.hasDisabledSlot(i)) {
						list2.push(i);
					}
				}
				(player.isDisabledJudge() ? list2 : list1).push(-1);
				var addTable = function (list, bool) {
					const adds = [];
					for (var i of list) {
						adds.push([[i, bool], i > 0 ? get.translation("equip" + i) + "栏" : "判定区"]);
					}
					dialog.add([adds, "tdnodes"]);
				};
				if (list1.length) {
					dialog.addText("未废除");
					addTable(list1, true);
				}
				if (list2.length) {
					dialog.addText("已废除");
					addTable(list2, false);
				}
				return dialog;
			},
			filter(button, player) {
				if (!ui.selected.buttons.length) {
					return true;
				}
				if (!ui.selected.buttons[0].link[1]) {
					return false;
				}
				return button.link[1];
			},
			check(button) {
				var player = _status.event.player;
				if (!button.link[1]) {
					if (button.link[0] <= 0) {
						return -10;
					}
					if (
						player.hasCard(function (card) {
							return get.subtype(card) == "equip" + button.link[0];
						}, "hs")
					) {
						return 15;
					}
					return 10;
				}
				if (
					button.link[0] <= 0 ||
					(player.hasEmptySlot(button.link[0]) &&
						!player.hasCard(function (card) {
							return get.subtype(card) == "equip" + button.link[0] && player.canUse(card, player) && get.effect(player, card, player, player) > 0;
						}, "hs"))
				) {
					return 5;
				}
				return 0;
			},
			select: [1, Infinity],
			backup(links, player) {
				if (!links[0][1]) {
					return {
						audio: "midu",
						selectCard: -1,
						selectTarget: -1,
						filterCard: () => false,
						filterTarget: () => false,
						equip: links[0][0],
						async content(event, trigger, player) {
							var pos = lib.skill.midu_backup.equip;
							if (pos <= 0) {
								player.enableJudge();
							} else {
								player.enableEquip(pos);
							}
							player.addTempSkills("rehuomo", { player: "phaseBegin" });
						},
					};
				} else {
					return {
						audio: "midu",
						selectCard: -1,
						filterCard: () => false,
						filterTarget: true,
						equip: links.map(i => i[0]).sort(),
						async content(event, trigger, player) {
							const list = lib.skill.midu_backup.equip;
							const num = list.length;
							let bool = false;
							if (list.includes(-1)) {
								list.remove(-1);
								bool = true;
							}
							if (list.length > 0) {
								player.disableEquip(list);
							}
							if (bool) {
								player.disableJudge();
							}
							event.target.draw(num);
						},
						ai: {
							tag: {
								draw: 1,
							},
							result: {
								target: 2,
							},
						},
					};
				}
			},
			prompt(links, player) {
				if (!links[0][1]) {
					return "恢复一个装备栏或判定区并获得〖活墨〗";
				}
				var numc = get.cnNumber(links.length);
				return "废除" + numc + "个区域并令一名角色摸" + numc + "张牌";
			},
		},
		derivation: "rehuomo",
		ai: {
			order: 8,
			result: { player: 1 },
		},
		subSkill: { backup: {} },
	},
	xianwang: {
		audio: 2,
		mod: {
			globalTo(source, player, distance) {
				var num = player.countDisabledSlot();
				if (num > 0) {
					return distance + (num > 2 ? 2 : 1);
				}
			},
			globalFrom(source, player, distance) {
				var num = source.countDisabledSlot();
				if (num > 0) {
					return distance - (num > 2 ? 2 : 1);
				}
			},
		},
		ai: {
			combo: "midu",
		},
	},
};
