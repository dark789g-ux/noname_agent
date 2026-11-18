import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdruwu" | "stdchengshi" | "stddingyi" | "stdzuici" | "stdjinglve" | "stdjishe" | "stdwudu" | "stdhuaiyi" | "stdfengbai" | "stdzishou" | "stdjujin">} */
export const groupSkills = {
	//蒋琬
	stdruwu: {
		audio: "olxvfa",
		enable: "chooseToUse",
		filter(event, player) {
			if (!event.stdruwu || !event.stdruwu.length) {
				return false;
			}
			if (event.filterCard(get.autoViewAs({ name: "juedou" }, "unsure"), player, event)) {
				return true;
			}
			if (event.filterCard(get.autoViewAs({ name: "wuzhong" }, "unsure"), player, event)) {
				return true;
			}
			return false;
		},
		onChooseToUse(event) {
			if (game.online || event.stdruwu) {
				return;
			}
			var list = event.player.getCards("e");
			var history = game.getGlobalHistory("everything", evt => evt.player == event.player && evt.name == "equip");
			list = list.filter(card => {
				return !history.some(evt => evt.cards && evt.cards.includes(card));
			});
			event.set("stdruwu", list);
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				if (event.filterCard(get.autoViewAs({ name: "juedou" }, "unsure"), player, event)) {
					list.push(["锦囊", "", "juedou"]);
				}
				if (event.filterCard(get.autoViewAs({ name: "wuzhong" }, "unsure"), player, event)) {
					list.push(["锦囊", "", "wuzhong"]);
				}
				return ui.create.dialog("儒武", [list, "vcard"]);
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				var player = _status.event.player;
				return player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
				});
			},
			backup(links, player) {
				return {
					filterCard(card) {
						return _status.event.stdruwu.includes(card);
					},
					position: "e",
					audio: "olxvfa",
					popname: true,
					check(card) {
						return 8 - get.value(card);
					},
					viewAs: { name: links[0][2] },
				};
			},
			prompt(links, player) {
				return "将装备区里的一张牌当做" + get.translation(links[0][2]) + "使用";
			},
		},
		hiddenCard(player, name) {
			var list = player.getCards("e");
			var history = game.getGlobalHistory("everything", evt => evt.player == player && evt.name == "equip");
			list = list.filter(card => {
				return !history.some(evt => evt.cards && evt.cards.includes(card));
			});
			if (!list.length) {
				return false;
			}
			return ["juedou", "wuzhong"].includes(name);
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
	},
	stdchengshi: {
		audio: "spjincui",
		trigger: {
			global: "die",
		},
		filter(event, player) {
			return event.player != player;
		},
		check(event, player) {
			return event.player.countCards("e") > player.countCards("e");
		},
		logTarget: "player",
		skillAnimation: true,
		limited: true,
		animationColor: "fire",
		seatRelated: "changeSeat",
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.awakenSkill(event.name);
			game.broadcastAll(
				function (target1, target2) {
					game.swapSeat(target1, target2);
				},
				player,
				target
			);
			await player.swapEquip(target);
		},
		mark: true,
		intro: {
			content: "limited",
		},
		init: (player, skill) => (player.storage[skill] = false),
	},
	//孙邵
	stddingyi: {
		audio: "mjdingyi",
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return !event.player.countCards("e");
		},
		async cost(event, trigger, player) {
			event.result = await trigger.player.chooseBool(get.prompt(event.skill), "摸一张牌").forResult();
			event.result.targets = [trigger.player];
		},
		async content(event, trigger, player) {
			await event.targets[0].draw();
		},
	},
	stdzuici: {
		audio: "mjzuici",
		trigger: {
			player: "damageEnd",
		},
		filter(event, player) {
			if (!event.source) {
				return false;
			}
			return player.canMoveCard(
				null,
				null,
				game.filterPlayer(current => current != event.source),
				event.source
			);
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			const next = player.moveCard(
				game.filterPlayer(current => current != trigger.source),
				trigger.source
			);
			next.prompt = get.prompt("stdzuici", trigger.source);
			next.prompt2 = "将场上一张牌移动到其区域内";
			next.logSkill = event.name;
			await next;
		},
	},
	//司马师
	stdjinglve: {
		audio: "jinglve",
		trigger: { global: "phaseDiscardBegin" },
		filter(event, player) {
			return player.countCards("h") > 1 && event.player != player;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), 2)
				.set("ai", card => {
					if (!_status.event.bool) {
						return 0;
					}
					return 5 - get.value(card);
				})
				.set(
					"bool",
					(() => {
						if (get.attitude(player, trigger.player) >= 0) {
							return false;
						}
						const hs = trigger.player.countCards("h"),
							dis = trigger.player.needsToDiscard(0, true, true);
						return hs && dis > 0;
					})()
				)
				.forResult();
			event.result.targets = [trigger.player];
		},
		async content(event, trigger, player) {
			const cards = event.cards,
				target = event.targets[0];
			await player.showCards(cards, get.translation(player) + "发动了【景略】");
			const next = player.give(cards, target);
			next.gaintag.add("stdjinglve");
			await next;
			trigger.player.addTempSkill("stdjinglve_discard");
			player
				.when({ global: "phaseDiscardEnd" })
				.filter(evt => evt == trigger)
				.step(async (event, trigger, player) => {
					trigger.player.removeSkill("stdjinglve_discard");
					const cards = [];
					game.getGlobalHistory("cardMove", function (evt) {
						if (evt.name == "cardsDiscard") {
							if (evt.getParent("phaseDiscard") == trigger) {
								const moves = evt.cards.filterInD("d");
								cards.addArray(moves);
							}
						}
						if (evt.name == "lose") {
							if (evt.type != "discard" || evt.position != ui.discardPile || evt.getParent("phaseDiscard") != trigger) {
								return;
							}
							const moves = evt.cards.filterInD("d");
							cards.addArray(moves);
						}
					});
					if (cards.length) {
						const { bool, links } = await player.chooseButton(["景略：是否获得本阶段弃置的一张牌？", cards]).forResult();
						if (bool) {
							await player.gain(links, "gain2");
						}
					}
				});
		},
		subSkill: {
			discard: {
				charlotte: true,
				mod: {
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("stdjinglve")) {
							return false;
						}
					},
				},
				onremove(player) {
					player.removeGaintag("stdjinglve");
				},
			},
		},
	},
	//岑昏
	stdjishe: {
		audio: "jishe",
		enable: "phaseUse",
		filter(event, player) {
			return player.getHandcardLimit() > 0;
		},
		locked: false,
		delay: false,
		async content(event, trigger, player) {
			player.addTempSkill("stdjishe_limit");
			player.addMark("stdjishe_limit", 1, false);
			player.draw("nodelay");
		},
		subSkill: {
			limit: {
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("stdjishe_limit");
					},
				},
				onremove: true,
				charlotte: true,
				marktext: "奢",
				intro: {
					content: "手牌上限-#",
				},
			},
		},
		ai: {
			order: 10,
			result: {
				player(player) {
					if (!player.needsToDiscard(1)) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	stdwudu: {
		trigger: {
			global: "damageBegin4",
		},
		filter(event, player) {
			return !event.player.countCards("h");
		},
		logTarget: "player",
		check(event, player) {
			return player.maxHp > 1 && get.damageEffect(event.player, event.source, player) < 0;
		},
		async content(event, trigger, player) {
			trigger.cancel();
			await player.loseMaxHp();
		},
	},
	//公孙渊
	stdhuaiyi: {
		audio: "rehuaiyi",
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		filter(event, player) {
			return player.countCards("h");
		},
		forced: true,
		async content(event, trigger, player) {
			const hs = player.getCards("h");
			await player.showCards(hs, get.translation(player) + "发动了【怀异】");
			const colors = [];
			for (let card of hs) {
				colors.add(get.color(card));
			}
			if (colors.length < 2) {
				return;
			}
			const result = await player
				.chooseControl(colors)
				.set("ai", () => {
					return _status.event.color;
				})
				.set(
					"color",
					(function () {
						return colors.sort((a, b) => {
							return player.countCards("h", { color: a }) - player.countCards("h", { color: b });
						})[0];
					})()
				)
				.forResult();
			const discards = player.getCards("h", { color: result.control });
			if (discards.length) {
				await player.discard(discards);
				if (game.hasPlayer(current => current != player && current.countCards("he"))) {
					const result2 = await player
						.chooseTarget(`获得至多${discards.length}名其他角色各一张牌`, [1, discards.length], true, function (card, player, target) {
							return target != player && target.countCards("he") > 0;
						})
						.set("ai", function (target) {
							const player = get.player();
							return get.effect(target, { name: "shunshou_copy2" }, player, player);
						})
						.forResult();
					await player.gainMultiple(result2.targets.sortBySeat(), "he");
					if (result2.targets.length > 1) {
						await player.loseHp();
					}
				}
			}
		},
	},
	stdfengbai: {
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		zhuSkill: true,
		logTarget: (event, player, triggername, target) => target,
		check(event, player) {
			return get.effect(event.indexedData, { name: "draw" }, player, player) > 0;
		},
		getIndex(event, player) {
			if (!event.getg || !event.getl) {
				return false;
			}
			const cards = event.getg(player);
			return game
				.filterPlayer(current => {
					if (current == player || current.group != "qun") {
						return false;
					}
					const evt = event.getl(current);
					if (!evt || !evt.es) {
						return false;
					}
					game.log(evt.es);
					return evt.es.some(card => cards.includes(card));
				})
				.sortBySeat();
		},
		async content(event, trigger, player) {
			await event.targets[0].draw();
		},
	},
	//刘表
	stdzishou: {
		audio: "zishou",
		trigger: {
			player: "phaseUseBefore",
		},
		check(event, player) {
			return player.countCards("h") + 2 <= player.getHandcardLimit();
		},
		async content(event, trigger, player) {
			await player.draw(game.countGroup());
			trigger.cancel();
		},
		ai: {
			threaten: 1.5,
		},
	},
	stdjujin: {
		trigger: {
			player: "damageEnd",
		},
		filter(event, player) {
			if (!event.source || event.source.group != "qun") {
				return false;
			}
			return player.countCards("he") > 1;
		},
		zhuSkill: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt2(event.skill), 2, "he")
				.set("ai", card => {
					const player = get.player();
					if (get.recoverEffect(player, player, player) <= 0 || player.hp >= player.maxHp) {
						return 0;
					}
					return 5 - get.value(card);
				})
				.set("chooseonly", true)
				.forResult();
		},
		async content(event, trigger, player) {
			const cards = event.cards;
			await player.discard(cards);
			if (player.isDamaged()) {
				await player.recover();
			}
		},
	},
};
