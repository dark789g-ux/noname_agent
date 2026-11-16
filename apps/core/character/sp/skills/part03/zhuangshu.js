import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhuangshu" | "chuiti" | "zhuangshu_basic" | "zhuangshu_trick" | "zhuangshu_equip" | "oljuanxia" | "oldingcuo">} */
export const groupSkills = {
	//冯方女
	zhuangshu: {
		audio: 2,
		trigger: {
			global: ["phaseBegin", "phaseBefore"],
			player: "enterGame",
		},
		derivation: ["zhuangshu_basic", "zhuangshu_trick", "zhuangshu_equip"],
		filter(event, player, name) {
			if (name === "phaseBegin") {
				return (
					event.player.isIn() &&
					event.player.hasEmptySlot(5) &&
					player.hasCard(card => {
						if (_status.connectMode) {
							return true;
						}
						return ["basic", "trick", "equip"].includes(get.type2(card)) && lib.filter.cardDiscardable(card, player);
					}, "he")
				);
			}
			return (event.name !== "phase" || game.phaseNumber === 0) && player.hasEnabledSlot(5);
		},
		async cost(event, trigger, player) {
			if (event.triggername == "phaseBegin") {
				const { player: target } = trigger;
				event.result = await player
					.chooseToDiscard("he", get.prompt(event.skill, target), "弃置一张牌，并根据此牌的类型，按如下关系将一张宝物牌置入该角色的装备区：{<基本牌,【琼梳】>，<锦囊牌，【犀梳】>，<装备牌，【金梳】>}。", card => {
						return ["basic", "trick", "equip"].includes(get.type2(card));
					})
					.set("ai", card => {
						const player = get.player();
						if (get.attitude(player, get.event().getTrigger().player) < 4) {
							return 0;
						}
						const name = "zhuangshu_" + get.type2(card, player);
						if (game.hasPlayer(current => current.getEquip(name) && get.attitude(player, current) > 0)) {
							return 0;
						}
						return 7 - get.value(card);
					})
					.forResult();
				if (event.result.bool) {
					event.result.targets = [target];
				}
			} else {
				const { bool, links } = await player
					.chooseButton([get.prompt(event.skill), [["zhuangshu_basic", "zhuangshu_trick", "zhuangshu_equip"], "vcard"]])
					.set("filterButton", button => {
						return !game.hasPlayer(current => current.getEquip(button.link[2]));
					})
					.forResult();
				event.result = {
					bool: bool,
					cost_data: links,
				};
			}
		},
		async content(event, trigger, player) {
			if (event.triggername == "phaseBegin") {
				const {
					cards,
					targets: [target],
				} = event;
				const name = "zhuangshu_" + get.type2(cards[0], cards[0].original == "h" ? player : false);
				if (lib.card[name] && target.isIn() && target.hasEmptySlot(5)) {
					let card;
					const target1 = game.findPlayer(current => {
						const equip = current.getEquip(name);
						return equip?.name === name;
					});
					if (target1) {
						card = target1.getEquip(name);
						target1.$give(card, target, false);
					} else {
						card = game.createCard(name, lib.card[name].cardcolor, 12);
						target.$gain2(card, false);
					}
					await game.delayx();
					await target.equip(card);
				}
			} else {
				const name = event.cost_data[0][2],
					card = game.createCard(name, lib.card[name].cardcolor, 12);
				player.$gain2(card, false);
				await game.delayx();
				await player.equip(card);
			}
		},
	},
	chuiti: {
		audio: 2,
		usable: 1,
		trigger: { global: ["loseAfter", "loseAsyncAfter"] },
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return false;
			}
			return game.hasPlayer(current => {
				const evt = event.getl(current);
				if (!evt?.cards2?.some(i => get.position(i, true) == "d" && player.hasUseTarget(i))) {
					return false;
				}
				return player == current || current.getEquips(5).some(card => card.name.startsWith("zhuangshu_"));
			});
		},
		async cost(event, trigger, player) {
			const cards = game
				.filterPlayer(current => {
					const evt = trigger.getl(current);
					if (!evt?.cards2?.some(i => get.position(i, true) == "d" && player.hasUseTarget(i))) {
						return false;
					}
					return player == current || current.getEquips(5).some(card => card.name.startsWith("zhuangshu_"));
				})
				.reduce((list, current) => list.addArray(trigger.getl(current).cards2.filter(i => get.position(i, true) == "d" && player.hasUseTarget(i))), []);
			const { bool, links } = await player
				.chooseButton(["垂涕：是否使用其中的一张牌？", cards])
				.set("ai", button => {
					return get.player().getUseValue(button.link);
				})
				.forResult();
			event.result = {
				bool: bool,
				cost_data: links,
			};
		},
		async content(event, trigger, player) {
			const {
				cost_data: [card],
			} = event;
			player.$gain2(card, false);
			await game.delayx();
			await player.chooseUseTarget(true, card, false);
		},
	},
	zhuangshu_basic: {
		audio: true,
		equipSkill: true,
		trigger: { player: "damageBegin4" },
		filter(event, player) {
			const equip = player.getEquip("zhuangshu_basic");
			return (
				event.num <=
				player.countCards("he", card => {
					if (_status.connectMode) {
						return true;
					}
					return card != equip && lib.filter.cardDiscardable(card, player);
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard("he", trigger.num, get.prompt(event.skill), `弃置${get.cnNumber(trigger.num)}张牌并防止伤害`, (card, player) => {
					return card != player.getEquip("zhuangshu_basic");
				})
				.set("ai", card => {
					const player = get.player();
					const targets = game.filterPlayer(current => get.attitude(player, current) > 0 && current.hasSkill("chuiti") && !current.storage.counttrigger?.chuiti);
					if (targets.length && !ui.selected.cards.length) {
						return (
							4 +
							Math.sign(
								game.countPlayer(current => {
									if (!targets.includes(current)) {
										return 0;
									}
									return current.getUseValue(card);
								})
							) -
							get.value(card, player)
						);
					}
					return 6 - get.value(card, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.cancel();
		},
	},
	zhuangshu_trick: {
		audio: true,
		trigger: { player: ["phaseJudgeBefore"] },
		equipSkill: true,
		async cost(event, trigger, player) {
			const { control } = await player
				.chooseControl("判定阶段", "弃牌阶段", "cancel2")
				.set("prompt", get.prompt(event.skill))
				.set("prompt2", "跳过本回合的判定阶段或弃牌阶段")
				.set("ai", () => {
					const player = get.player();
					if (
						player.hasCard(card => {
							return (
								get.effect(
									player,
									{
										name: card.viewAs || card.name,
										cards: [card],
									},
									player,
									player
								) < 0
							);
						}, "j")
					) {
						return "判定阶段";
					}
					return "弃牌阶段";
				})
				.forResult();
			event.result = {
				bool: control != "cancel2",
				cost_data: control,
			};
		},
		async content(event, trigger, player) {
			if (event.cost_data == "判定阶段") {
				trigger.cancel();
				game.log(player, "跳过了", "#y判定阶段");
			} else {
				player.skip("phaseDiscard");
				game.log(player, "跳过了", "#g弃牌阶段");
			}
		},
	},
	zhuangshu_equip: {
		audio: true,
		trigger: { player: "phaseUseEnd" },
		forced: true,
		equipSkill: true,
		filter(event, player) {
			return player.countCards("h") < Math.min(5, player.getHandcardLimit());
		},
		content() {
			player.drawTo(Math.min(5, player.getHandcardLimit()));
		},
	},
	//杨仪
	oljuanxia: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		content() {
			"step 0";
			player.chooseTarget(get.prompt2("oljuanxia"), lib.filter.notMe).set("ai", function (target) {
				var player = _status.event.player,
					list = [];
				for (var name of lib.inpile) {
					var info = lib.card[name];
					if (!info || info.type != "trick" || info.notarget || (info.selectTarget && info.selectTarget != 1)) {
						continue;
					}
					if (!player.canUse(name, target, false)) {
						continue;
					}
					var eff = get.effect(target, { name: name }, player, player);
					if (eff > 0) {
						list.push(eff);
					}
				}
				list.sort().reverse();
				if (!list.length) {
					return 0;
				}
				return list[0] + (list[1] || 0) + (list[2] || 0);
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("oljuanxia", target);
			} else {
				event.finish();
			}
			"step 2";
			var list = [];
			for (var name of lib.inpile) {
				var info = lib.card[name];
				if (!info || info.type != "trick" || info.notarget || (info.selectTarget && info.selectTarget != 1)) {
					continue;
				}
				list.push(name);
			}
			if (!list.length) {
				event.finish();
			} else {
				event.list = list;
				event.count = 0;
			}
			"step 3";
			var list = event.list.filter(function (name) {
				return player.canUse(name, target, false);
			});
			if (list.length) {
				var next = player.chooseButton(["视为对" + get.translation(target) + "使用一张牌", [list, "vcard"]]).set("ai", function (button) {
					let evt = _status.event.getParent(),
						eff = get.effect(evt.target, { name: button.link[2] }, evt.player, evt.player);
					if (evt.target.hp < 2 || get.attitude(evt.player, evt.target) > 0 || (evt.target.hp < 3 && get.tag(button.link, "damage"))) {
						return eff;
					}
					return eff + get.effect(evt.player, { name: "sha" }, evt.target, evt.player);
				});
				if (event.count == 0) {
					next.set("forced", true);
				}
			} else {
				event.stopped = true;
				event.goto(5);
			}
			"step 4";
			if (result.bool) {
				event.count++;
				var name = result.links[0][2];
				event.list.remove(name);
				player.useCard({ name: name, isCard: true }, target, false);
			} else {
				event.stopped = true;
			}
			"step 5";
			if (target.isIn() && event.count > 0) {
				if (event.count < 3 && !event.stopped && event.list.length > 0) {
					event.goto(3);
				} else {
					target.addTempSkill("oljuanxia_counter", { player: "phaseAfter" });
					if (!target.storage.oljuanxia_counter) {
						target.storage.oljuanxia_counter = {};
					}
					if (!target.storage.oljuanxia_counter[player.playerid]) {
						target.storage.oljuanxia_counter[player.playerid] = 0;
					}
					target.storage.oljuanxia_counter[player.playerid] += event.count;
				}
			}
		},
		subSkill: {
			counter: {
				trigger: { player: "phaseEnd" },
				forced: true,
				charlotte: true,
				onremove: true,
				filter(event, player) {
					var map1 = _status.connectMode ? lib.playerOL : game.playerMap,
						map2 = player.storage.oljuanxia_counter;
					if (!map2) {
						return false;
					}
					for (var i in map2) {
						if (map1[i] && map1[i].isIn() && player.canUse("sha", map1[i], false)) {
							return true;
						}
					}
					return false;
				},
				logTarget(event, player) {
					var list = [];
					var map1 = _status.connectMode ? lib.playerOL : game.playerMap,
						map2 = player.storage.oljuanxia_counter;
					if (!map2) {
						return false;
					}
					for (var i in map2) {
						if (map1[i] && map1[i].isIn()) {
							list.push(map1[i]);
						}
					}
					return list;
				},
				content() {
					"step 0";
					var list = [];
					var map1 = _status.connectMode ? lib.playerOL : game.playerMap,
						map2 = player.storage.oljuanxia_counter;
					if (!map2) {
						return false;
					}
					for (var i in map2) {
						if (map1[i] && map1[i].isIn()) {
							list.push(map1[i]);
						}
					}
					list.sortBySeat();
					event.num = 0;
					event.targets = list;
					"step 1";
					var target = targets[num];
					event.target = target;
					if (target.isIn() && player.canUse("sha", target, false)) {
						player
							.chooseBool("狷狭：是否视为对" + get.translation(target) + "依次使用" + get.cnNumber(player.storage.oljuanxia_counter[target.playerid]) + "张【杀】？")
							.set("goon", get.effect(target, { name: "sha" }, player, player) > 0)
							.set("ai", () => _status.event.goon);
					}
					"step 2";
					event.num++;
					if (result.bool) {
						event.count = player.storage.oljuanxia_counter[target.playerid];
					} else if (event.num < targets.length) {
						event.goto(1);
					} else {
						event.finish();
					}
					"step 3";
					event.count--;
					if (target.isIn() && player.canUse("sha", target, false)) {
						player.useCard({ name: "sha", isCard: true }, target, false);
					}
					if (event.count > 0) {
						event.redo();
					} else if (event.num < targets.length) {
						event.goto(1);
					}
				},
			},
		},
	},
	oldingcuo: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		usable: 1,
		async content(event, trigger, player) {
			const result = await player.draw(2).forResult();
			if (get.itemtype(result?.cards) == "cards" && result.cards.length > 1) {
				const { cards } = result;
				const color = get.color(cards[0], player);
				for (let i = 1; i < cards.length; i++) {
					if (get.color(cards[i], player) != color) {
						if (player.hasCards("h")) {
							await player.chooseToDiscard("h", true);
						}
						break;
					}
				}
			}
		},
	},
};
