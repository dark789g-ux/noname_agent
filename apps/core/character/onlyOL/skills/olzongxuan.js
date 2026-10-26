import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olzongxuan" | "olzhiyan" | "olsbhetao" | "olsbshenli" | "olsbyufeng" | "sizhaojian_skill">} */
export const groupSkills = {
	//虞翻
	olzongxuan: {
		audio: 2,
		trigger: { global: ["loseAfter", "loseAsyncAfter"] },
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return false;
			}
			return get.info("olzongxuan").getCards(event, player).length;
		},
		check(event, player) {
			if (event.getParent(3).name != "phaseDiscard") {
				return false;
			}
			const cards = get.info("olzongxuan").getCards(event, player);
			return game.hasPlayer(target => {
				if (cards.some(i => get.type(i, null, target) == "equip") && (get.attitude(player, target) > 0 || get.recoverEffect(target, player, player) > 0)) {
					return true;
				}
				if (cards.some(i => get.type(i, null, target) != "equip") && target.getHp() >= player.getHp() && get.effect(target, { name: "losehp" }, player, player) > 0) {
					return true;
				}
				return false;
			});
		},
		async content(event, trigger, player) {
			const { bool, moved } = await player
				.chooseToMove("纵玄：将任意张牌置于牌堆顶", true)
				.set("list", [["本次弃置的牌", get.info("olzongxuan").getCards(trigger, player)], ["牌堆顶"]])
				.set("filterOk", moved => moved[1].length)
				.set("processAI", list => {
					const player = get.event().player;
					const cards = list[0][1].slice(),
						cards2 = cards.filter(card => {
							return game.hasPlayer(target => {
								if (get.type(card, null, target) == "equip" && (get.attitude(player, target) > 0 || get.recoverEffect(target, player, player) > 0)) {
									return true;
								}
								if (get.type(card, null, target) != "equip" && target.getHp() >= player.getHp() && get.effect(target, { name: "losehp" }, player, player) > 0) {
									return true;
								}
								return false;
							});
						}),
						cards3 = cards2.length ? cards2.randomGet() : cards.randomGet();
					return [[], [cards3]];
				})
				.forResult();
			if (bool) {
				let cards = moved[1].slice();
				game.log(player, "将", cards, "置于了牌堆顶");
				await game.cardsGotoPile(cards.reverse(), "insert");
			}
		},
		getCards(event, player) {
			let cards = [];
			for (const target of [player, player.getPrevious()]) {
				const evt = event.getl(target);
				if (evt && evt.cards2 && evt.cards2.some(i => get.position(i) == "d")) {
					if (
						target == player ||
						target
							.getHistory("lose", evt => {
								return evt.type == "discard" && evt.getlx !== false;
							})
							.indexOf(event) == 0
					) {
						cards.addArray(evt.cards2.filter(i => get.position(i) == "d"));
					}
				}
			}
			return cards;
		},
	},
	olzhiyan: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player == player || event.player == player.getPrevious();
		},
		direct: true,
		async content(event, trigger, player) {
			const { bool, targets } = await player
				.chooseTarget(get.prompt2("olzhiyan"))
				.set("ai", target => {
					const player = get.event().player,
						cards = get.event().cards;
					if (!cards.length) {
						return 0;
					}
					const card = cards[0],
						att = get.attitude(player, target);
					if (get.type(card, null, target) == "equip" && (get.attitude(player, target) > 0 || get.recoverEffect(target, player, player) > 0)) {
						return get.recoverEffect(target, player, player) * 20 + att / 114514;
					}
					if (get.type(card, null, target) != "equip") {
						if (target.getHp() !== player.getHp()) {
							return get.effect(target, { name: "losehp" }, player, player) * 20 - att / 114514;
						}
						return get.effect(target, { name: "draw" }, player, player);
					}
					return 0;
				})
				.set("cards", Array.from(ui.cardPile.childNodes || []) || [])
				.forResult();
			if (bool) {
				const target = targets[0];
				player.logSkill("olzhiyan", target);
				const result = (await target.draw("visible").forResult()).cards;
				if (result) {
					const card = result[0];
					if (get.type(card, null, target) == "equip") {
						if (target.getCards("h").includes(card) && target.hasUseTarget(card)) {
							const { bool } = await target.chooseUseTarget(card, true, "nopopup").forResult();
							if (bool) {
								await target.recover();
							}
						}
					} else if (target.getHp() !== player.getHp()) {
						await target.loseHp();
					}
				}
			}
		},
		ai: { expose: 0.2 },
	},
	//OL谋袁绍
	//真·四世三公——袁神，启动
	olsbhetao: {
		audio: 6,
		trigger: { global: "useCardToPlayered" },
		filter(event, player) {
			return (
				event.player != player &&
				event.isFirstTarget &&
				event.targets.length > 1 &&
				player.countCards("he", card => {
					if (get.position(card) == "h" && _status.connectMode) {
						return true;
					}
					return get.color(card) == get.color(event.card) && lib.filter.cardDiscardable(card, player);
				})
			);
		},
		direct: true,
		async content(event, trigger, player) {
			const { bool, cards, targets } = await player
				.chooseCardTarget({
					prompt: get.prompt("olsbhetao"),
					filterCard(card, player) {
						return get.color(card) == get.color(get.event().getTrigger().card) && lib.filter.cardDiscardable(card, player);
					},
					position: "he",
					filterTarget(card, player, target) {
						return get.event().getTrigger().targets.includes(target);
					},
					ai1(card) {
						return 7.5 - get.value(card);
					},
					ai2(target) {
						const player = get.event().player,
							trigger = get.event().getTrigger();
						const att = get.attitude(player, target),
							eff = get.effect(target, trigger.card, trigger.player, player);
						if (trigger.card.name == "tiesuo") {
							return eff > 0 ? 0 : get.sgn(att) * (2 + get.sgn(att));
						}
						const sum = trigger.targets.reduce((i, j) => i + get.effect(j, trigger.card, trigger.player, player), 0);
						return eff * 2 - sum;
					},
				})
				.set("prompt2", "弃置一张" + get.translation(get.color(trigger.card)) + "牌，令" + get.translation(trigger.card) + "改为对其中一个目标结算两次")
				.forResult();
			if (bool) {
				const target = targets[0];
				player.logSkill("olsbhetao", target);
				player.changeSkin({ characterName: "ol_sb_yuanshao" }, "ol_sb_yuanshao");
				player.discard(cards);
				trigger.getParent().effectCount++;
				trigger.getParent().excluded.addArray(game.filterPlayer(i => trigger.targets.includes(i) && target != i));
			}
		},
		ai: { threaten: 3.5 },
		global: "olsbhetao_ai",
		subSkill: {
			ai: {
				ai: {
					effect: {
						player_use(card, player) {
							if (
								typeof card != "object" ||
								!game.hasPlayer(target => {
									return target.hasSkill("olsbhetao") && (get.attitude(player, target) < 0 || get.attitude(target, player) < 0);
								}) ||
								game.countPlayer(target => {
									return player.canUse(card, target);
								}) < 2
							) {
								return;
							}
							const select = get.info(card).selectTarget;
							let range;
							if (select == undefined) {
								range = [1, 1];
							} else if (typeof select == "number") {
								range = [select, select];
							} else if (get.itemtype(select) == "select") {
								range = select;
							} else if (typeof select == "function") {
								range = select(card, player);
								if (typeof range == "number") {
									range = [range, range];
								}
							}
							game.checkMod(card, player, range, "selectTarget", player);
							if (range[1] == -1 || (range[1] > 1 && ui.selected.targets && ui.selected.targets.length)) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
		},
	},
	olsbshenli: {
		audio: 6,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!player.isPhaseUsing() || player.hasSkill("olsbshenli_used")) {
				return false;
			}
			return (
				event.card.name == "sha" &&
				game.hasPlayer(target => {
					return !event.targets.includes(target) && player.canUse(event.card, target, false);
				}) &&
				event.isFirstTarget
			);
		},
		check(event, player) {
			const targets = game.filterPlayer(target => player.canUse(event.card, target, false));
			const num1 = event.targets.reduce((sum, target) => sum + get.effect(target, event.card, player, player), 0);
			const num2 = targets.reduce((sum, target) => sum + get.effect(target, event.card, player, player), 0);
			if (num2 >= num1) {
				return true;
			}
			let num = event.baseDamage || 1;
			if (event.extraDamage) {
				num += event.extraDamage;
			}
			let extra_num = 0;
			for (const target of targets) {
				if (
					target.mayHaveShan(player, "use") &&
					!player.hasSkillTag(
						"directHit_ai",
						true,
						{
							target: target,
							card: event.card,
						},
						true
					)
				) {
					if (player.hasSkillTag("jueqing", false, target)) {
						extra_num--;
					} else if (
						target.hasSkillTag("filterDamage", null, {
							player: event.player,
							card: event.card,
						})
					) {
						extra_num++;
					}
				} else {
					extra_num += num;
				}
			}
			const sum = targets.length + extra_num;
			return num2 + (sum > player.countCards("h") ? Math.min(5, sum) : 0) + (sum > player.getHp() ? num2 : 0) >= num1;
		},
		async content(event, trigger, player) {
			player.changeSkin({ characterName: "ol_sb_yuanshao" }, "ol_sb_yuanshao_shadow");
			player.addTempSkill(event.name + "_used", "phaseUseAfter");
			trigger.getParent().targets.addArray(
				game.filterPlayer(target => {
					return !trigger.targets.includes(target) && player.canUse(trigger.card, target, false);
				})
			);
			player
				.when("useCardAfter")
				.filter(evt => evt == trigger.getParent())
				.step(async (event, trigger, player) => {
					const sum = player
						.getHistory("sourceDamage", evt => evt.card && evt.card == trigger.card)
						.reduce((num, evt) => {
							return num + evt.num;
						}, 0);
					const bool = sum > player.countCards("h"),
						goon = sum > player.getHp();
					if (bool) {
						await player.draw(Math.min(5, sum));
					}
					if (goon) {
						const targets = game.filterPlayer(target => trigger.targets.includes(target) && player.canUse(trigger.card, target, false));
						if (
							targets.length &&
							(!trigger.cards ||
								!trigger.cards.length ||
								trigger.cards.every(card => {
									return !get.owner(card);
								}))
						) {
							await player.useCard(trigger.card, trigger.cards, targets, false);
						}
					}
				});
		},
		ai: { threaten: 3.5 },
		subSkill: { used: { charlotte: true } },
	},
	olsbyufeng: {
		audio: 3,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			const card = get.cardPile("sizhaojian", "field") || game.createCard2("sizhaojian", "diamond", 6);
			return (event.name != "phase" || game.phaseNumber == 0) && player.canEquip(card, true);
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			if (lib.card.sizhaojian.inShanShanFestival()) {
				game.broadcastAll(() => lib.inpile.add("sizhaojian"));
			}
			const card = get.cardPile("sizhaojian", "field") || game.createCard2("sizhaojian", "diamond", 6);
			if (get.owner(card)) {
				get.owner(card).$give(card, player, false);
			} else {
				player.$gain2(card, false);
				await game.delayx();
			}
			player.equip(card);
		},
		subSkill: {
			block: {
				mod: {
					cardEnabled(card, player) {
						if (!player.storage.olsbyufeng_block) {
							return;
						}
						const storage = player.getStorage("olsbyufeng_block");
						let evt = get.event();
						if (evt.name != "chooseToUse") {
							evt = evt.getParent("chooseToUse");
						}
						if (!evt || !evt.respondTo || !storage.some(i => i.cardid == evt.respondTo[1].cardid)) {
							return;
						}
						const num = get.number(card);
						if (num != "unsure" && typeof num == "number" && num < get.number(evt.respondTo[1])) {
							return false;
						}
					},
				},
				onremove(player) {
					delete player.storage.olsbyufeng_block;
				},
				charlotte: true,
				trigger: {
					player: ["damageBefore", "damageCancelled", "damageZero"],
					target: ["shaMiss", "useCardToExcluded", "useCardToEnd"],
					global: ["useCardEnd"],
				},
				filter(event, player) {
					const evt = event.getParent("useCard", true, true);
					if (evt && evt.effectedCount < evt.effectCount) {
						return false;
					}
					if (!event.card || !player.storage.olsbyufeng_block) {
						return false;
					}
					return player.getStorage("olsbyufeng_block").includes(event.card);
				},
				forced: true,
				popup: false,
				firstDo: true,
				content() {
					player.unmarkAuto(event.name, [trigger.card]);
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
				},
			},
		},
	},
	sizhaojian_skill: {
		equipSkill: true,
		mod: {
			aiOrder(player, card, num) {
				if (card.name == "sha" && typeof get.number(card) == "number") {
					return num + get.number(card) / 114514;
				}
			},
		},
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && typeof get.number(event.card) == "number";
		},
		forced: true,
		locked: false,
		logTarget: "target",
		async content(event, trigger, player) {
			const target = trigger.target;
			target.addTempSkill("olsbyufeng_block");
			target.markAuto("olsbyufeng_block", [trigger.card]);
		},
	},
};
