import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "buqi" | "guying" | "muzhen" | "sheyi" | "tianyin">} */
export const groupSkills = {
	buqi: {
		audio: 2,
		trigger: { global: "dying" },
		forced: true,
		filter(event, player) {
			return player.getStorage("debao").length > 1;
		},
		logTarget: "player",
		content() {
			"step 0";
			var cards = player.getStorage("debao");
			if (cards.length == 2) {
				event._result = { bool: true, links: cards.slice(0) };
			} else {
				player.chooseButton(["不弃：请选择移去两张“仁”", cards], 2, true);
			}
			"step 1";
			if (result.bool) {
				var cards = result.links;
				player.unmarkAuto("debao", cards);
				player.$throw(cards, 1000);
				game.log(player, "将", cards, "置入了弃牌堆");
				game.delayx();
				game.cardsDiscard(cards);
			} else {
				event.finish();
			}
			"step 2";
			if (trigger.player.isIn() && trigger.player.isDamaged()) {
				trigger.player.recover();
			}
		},
		group: "buqi_die",
		subSkill: {
			die: {
				audio: "buqi",
				trigger: { global: "dieAfter" },
				forced: true,
				filter(event, player) {
					return player.getStorage("debao").length > 0;
				},
				content() {
					player.unmarkSkill("debao");
				},
			},
		},
		ai: {
			neg: true,
			combo: "debao",
		},
	},
	guying: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		forced: true,
		usable: 1,
		filter(event, player) {
			/* if (event.type != "discard") {
				const evt = event.getParent();
				if (evt.name != "useCard" && evt.name != "respond") {
					return false;
				}
			} */
			const target = _status.currentPhase,
				evt = event.getl(player);
			if (!evt?.cards2 || evt.cards2?.length != 1 || !target || target == player || !target.isIn()) {
				return false;
			}
			return get.position(evt.cards2[0]) == "d" || target.countCards("he") < 0;
		},
		logTarget() {
			return _status.currentPhase;
		},
		async content(event, trigger, player) {
			if (trigger.delay === false) {
				await game.delayx();
			}
			const target = _status.currentPhase,
				card = trigger.getl(player).cards2[0];
			player.addMark(event.name, 1, false);
			const choiceList = [],
				str = get.translation(player);
			let addIndex = 0;
			if (target.countGainableCards(player, "he") > 0) {
				choiceList.push("随机交给" + str + "一张牌");
			} else {
				addIndex++;
			}
			if (get.position(card) == "d") {
				choiceList.push("令" + str + "收回" + get.translation(card));
			}
			let result;
			if (choiceList.length == 1) {
				result = { index: 0 };
			} else {
				result = await target
					.chooseControl()
					.set("choiceList", choiceList)
					.set("sourcex", player)
					.set("card", card)
					.set("ai", function () {
						const player = get.player();
						const { sourcex, card } = get.event();
						if (get.value(card, sourcex) * get.attitude(player, sourcex) > 0) {
							return 0;
						}
						return Math.random() > get.value(card, sourcex) / 6 ? 1 : 0;
					})
					.forResult();
			}
			if (typeof result?.index !== "number") {
				return;
			}
			if (result.index + addIndex == 0) {
				await target.give(target.getGainableCards(player, "he").randomGet(), player);
			} else {
				await player.gain(card, "gain2");
				if (player.isIn() && player.getCards("h").includes(card) && get.type(card, null, player) == "equip") {
					await player.chooseUseTarget(card, true, "nopopup");
				}
			}
		},
		onremove: true,
		intro: { content: "已发动过#次" },
		group: "guying_discard",
		subSkill: {
			discard: {
				audio: "guying",
				trigger: { player: "phaseZhunbeiBegin" },
				forced: true,
				filter(event, player) {
					return player.countMark("guying") > 0;
				},
				async content(event, trigger, player) {
					const num = player.countMark("guying");
					player.clearMark("guying", false);
					if (num > 0) await player.chooseToDiscard("he", num, true, "allowChooseAll");
				},
			},
		},
	},
	muzhen: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			const list = player.getStorage("muzhen_used");
			if (!list.includes("gain") && player.hasCard(i => get.type(i) == "equip", "he") && game.hasPlayer(current => current != player && current.countCards("h") > 0)) {
				return true;
			}
			if (!list.includes("give") && player.countCards("he") > 0 && game.hasPlayer(current => current != player && current.countCards("e") > 0)) {
				return true;
			}
			return !list.includes("draw") && game.hasPlayer(current => current != player);
		},
		chooseButton: {
			dialog(event, player) {
				const list = [
					["gain", "将一张装备牌置于其他角色的装备区内并获得其一张手牌"],
					["give", "将至多两张牌交给一名其他角色并获得其装备区内的一张牌"],
					["draw", "你可以选择任意名其他角色，这些角色手牌数和装备区牌数每有一项与你相同，其摸一张牌，若这些角色均摸了两张牌，你摸选择角色数张牌"],
				];
				return ui.create.dialog("睦阵：请选择一项", [list, "textbutton"], "hidden");
			},
			filter(button, player) {
				const list = player.getStorage("muzhen_used");
				if (list.includes(button.link)) {
					return false;
				}
				if (button.link == "gain") {
					return player.hasCard(i => get.type(i) == "equip", "he") && game.hasPlayer(current => current != player && current.countCards("h") > 0);
				}
				if (button.link == "give") {
					return player.countCards("he") > 0 && game.hasPlayer(current => current != player && current.countCards("e") > 0);
				}
				return game.hasPlayer(current => current != player);
			},
			backup(links) {
				const index = ["gain", "give", "draw"].indexOf(links[0]);
				return {
					audio: "muzhen",
					filterTarget: [
						(card, player, target) => {
							if (target == player) {
								return false;
							}
							return target.countCards("h") > 0 && target.canEquip(ui.selected.cards[0]);
						},
						(card, player, target) => {
							if (target == player) {
								return false;
							}
							return target.countCards("e") > 0;
						},
						lib.filter.notMe,
					][index],
					selectTarget: [1, 1, [1, Infinity]][index],
					filterCard: [
						(card, player) => {
							if (get.type(card) != "equip") {
								return false;
							}
							if (ui.selected.targets.length) {
								return ui.selected.targets[0].canEquip(card);
							}
							return game.hasPlayer(current => current.countCards("h") > 0 && current.canEquip(card));
						},
						true,
						() => false,
					][index],
					selectCard: [1, [1, 2], -1][index],
					ai1(card) {
						return 8 - get.value(card);
					},
					ai2: [
						target => {
							const player = get.player();
							return get.attitude(player, target);
						},
						target => {
							const player = get.player();
							return get.attitude(player, target);
						},
						target => {
							const player = get.player();
							let cache = _status.event.getTempCache("muzhen", "targets");
							if (!Array.isArray(cache)) {
								let extras = [];
								let draws = game.filterPlayer(current => {
									if (current == player || get.attitude(player, current) <= 0) {
										return false;
									}
									let num = 0;
									for (const pos of ["h", "e"]) {
										if (current.countCards(pos) == player.countCards(pos)) {
											num++;
										}
									}
									if (num == 2) {
										extras.add(current);
									}
									return num == 1;
								});
								if (draws.length > extras.length) {
									extras.addArray(draws);
								}
								_status.event.putTempCache("muzhen", "targets", extras);
								cache = extras;
							}
							if (cache.length) {
								return cache.includes(target) ? 2 : 0;
							}
							return get.attitude(player, target) > 0;
						},
					][index],
					position: "he",
					discard: false,
					lose: false,
					delay: false,
					link: links[0],
					multiline: true,
					multitarget: true,
					async content(event, trigger, player) {
						const { cards, targets } = event,
							target = targets[0],
							{ link } = get.info(event.name);
						player.addTempSkill("muzhen_used", "phaseUseEnd");
						player.markAuto("muzhen_used", link);
						switch (link) {
							case "gain": {
								player.$giveAuto(cards[0], target);
								await game.delayx();
								await target.equip(cards[0]);
								if (target.countGainableCards(player, "h")) {
									await player.gainPlayerCard(target, "h", true);
								}
								break;
							}
							case "give": {
								await player.give(cards, target);
								if (target.countGainableCards(player, "e")) {
									await player.gainPlayerCard(target, "e", true);
								}
								break;
							}
							default: {
								targets.sortBySeat();
								let draw = true;
								await Promise.all(
									targets.map(target => {
										let num = 0;
										for (const pos of ["h", "e"]) {
											if (target.countCards(pos) == player.countCards(pos)) {
												num++;
											}
										}
										if (num != 2) {
											draw = false;
										}
										if (num > 0) {
											target.draw(num, "nodelay");
										}
										return target;
									})
								);
								if (draw) {
									await player.draw(targets.length);
								}
								break;
							}
						}
					},
				};
			},
			prompt() {
				return "请选择【睦阵】的牌和目标";
			},
		},
		ai: {
			order: 6,
			result: {
				player: 1,
			},
		},
		subSkill: {
			used: {
				onremove: true,
				charlotte: true,
			},
		},
	},
	sheyi: {
		audio: 2,
		trigger: { global: "damageBegin4" },
		filter(event, player) {
			return player != event.player && event.player.hp < player.hp && player.countCards("he") >= Math.max(1, player.hp);
		},
		round: 1,
		async cost(event, trigger, player) {
			const num = Math.max(1, player.hp),
				{ player: target } = trigger;
			event.result = await player
				.chooseCard("he", get.prompt(event.skill, target), `交给其至少${get.cnNumber(num)}张牌，防止即将受到的伤害（${trigger.num}点）`, [num, player.countCards("he")], "allowChooseAll")
				.set(
					"goon",
					(() => {
						if (get.attitude(player, target) < 0) {
							return false;
						}
						if (trigger.num < target.hp && get.damageEffect(target, trigger.source, player, trigger.nature) >= 0) {
							return false;
						}
						if (trigger.num < 2 && target.hp > trigger.num) {
							return 6 / Math.sqrt(num);
						}
						if (target == get.zhu(player)) {
							return 9;
						}
						return 8 / Math.sqrt(num);
					})()
				)
				.set("ai", card => {
					const { player, goon } = get.event();
					if (ui.selected.cards.length >= Math.max(1, player.hp)) {
						return 0;
					}
					if (typeof goon == "number") {
						return goon - get.value(card);
					}
					return 0;
				})
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const { player: target } = trigger;
			await player.give(event.cards, target);
			trigger.cancel();
		},
	},
	tianyin: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		filter(event, player) {
			var list = [];
			player.getHistory("useCard", function (evt) {
				list.add(get.type2(evt.card, false));
			});
			for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
				if (!list.includes(get.type2(ui.cardPile.childNodes[i], false))) {
					return true;
				}
			}
			return false;
		},
		content() {
			var list = [],
				cards = [];
			player.getHistory("useCard", function (evt) {
				list.add(get.type2(evt.card, false));
			});
			for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
				var type = get.type2(ui.cardPile.childNodes[i], false);
				if (!list.includes(type)) {
					list.push(type);
					cards.push(ui.cardPile.childNodes[i]);
				}
			}
			player.gain(cards, "gain2");
		},
	},
};
