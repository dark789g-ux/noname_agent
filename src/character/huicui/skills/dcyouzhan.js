import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcyouzhan" | "dcshuangjia" | "dcbeifen" | "dcmanzhi">} */
export const groupSkills = {
	//吴班
	dcyouzhan: {
		audio: 2,
		trigger: { global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"] },
		forced: true,
		getIndex(event, player) {
			if (player != _status.currentPhase) {
				return false;
			}
			return game
				.filterPlayer(current => {
					if (current == player) {
						return false;
					}
					const evt = event.getl(current);
					return evt?.cards2?.length;
				})
				.sortBySeat();
		},
		logTarget: (event, player, triggername, target) => target,
		async content(event, trigger, player) {
			const target = event.targets[0];
			const next = player.draw();
			next.gaintag = [event.name];
			await next;
			player.addTempSkill(event.name + "_limit");
			target.addTempSkill(event.name + "_effect");
			target.addMark(event.name + "_effect", 1, false);
			target.addTempSkill(event.name + "_draw");
		},
		ai: {
			damageBonus: true,
			skillTagFilter(player, tag, arg) {
				if (!arg || !arg.target || !arg.target.hasSkill("dcyouzhan_effect")) {
					return false;
				}
			},
		},
		subSkill: {
			effect: {
				audio: "dcyouzhan",
				trigger: { player: "damageBegin3" },
				filter(event, player) {
					return player.hasMark("dcyouzhan_effect");
				},
				forced: true,
				charlotte: true,
				onremove: true,
				async content(event, trigger, player) {
					trigger.num += player.countMark(event.name);
					player.removeSkill(event.name);
				},
				mark: true,
				intro: { content: "本回合下一次受到的伤害+#" },
				ai: {
					effect: {
						target(card, player, target) {
							if (get.tag(card, "damage")) {
								return 1 + 0.5 * target.countMark("dcyouzhan_effect");
							}
						},
					},
				},
			},
			draw: {
				trigger: { global: "phaseJieshuBegin" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return !player.getHistory("damage").length;
				},
				async content(event, trigger, player) {
					await player.draw({ num: Math.min(3, player.getHistory("lose").length) });
				},
			},
			limit: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("dcyouzhan");
				},
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("dcyouzhan")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("dcyouzhan")) {
							return false;
						}
					},
				},
			},
		},
	},
	//乐蔡文姬
	dcshuangjia: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async content(event, trigger, player) {
			const cards = player.getCards("h");
			player.addGaintag(cards, "dcshuangjia_tag");
		},
		mod: {
			ignoredHandcard(card, player) {
				if (card.hasGaintag("dcshuangjia_tag")) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && card.hasGaintag("dcshuangjia_tag")) {
					return false;
				}
			},
			globalTo(from, to, distance) {
				return (
					distance +
					Math.min(
						5,
						to.countCards("h", card => card.hasGaintag("dcshuangjia_tag"))
					)
				);
			},
		},
	},
	dcbeifen: {
		audio: 2,
		trigger: {
			player: ["loseAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			var evt = event.getl(player);
			if (!evt || !evt.hs || !evt.hs.length) {
				return false;
			}
			if (event.name == "lose") {
				for (var i in event.gaintag_map) {
					if (event.gaintag_map[i].includes("dcshuangjia_tag")) {
						return true;
					}
				}
				return false;
			}
			return player.hasHistory("lose", evt => {
				if (event != evt.getParent()) {
					return false;
				}
				for (var i in evt.gaintag_map) {
					if (evt.gaintag_map[i].includes("dcshuangjia_tag")) {
						return true;
					}
				}
				return false;
			});
		},
		forced: true,
		async content(event, trigger, player) {
			const suits = new Set(lib.suit);
			for (const card of player.iterableGetCards("h", card => card.hasGaintag("dcshuangjia_tag"))) {
				suits.delete(get.suit(card));
			}
			const cards = [];
			for (const suit of suits) {
				const card = get.cardPile(cardx => get.suit(cardx, false) == suit);
				if (card) {
					cards.push(card);
				}
			}
			if (cards.length) {
				await player.gain({
					cards,
					animate: "draw",
				});
			}
		},
		mod: {
			cardUsable(card, player) {
				var len = player.countCards("h");
				var cnt = player.countCards("h", card => card.hasGaintag("dcshuangjia_tag"));
				if (2 * cnt < len) {
					return Infinity;
				}
			},
			targetInRange(card, player) {
				var len = player.countCards("h");
				var cnt = player.countCards("h", card => card.hasGaintag("dcshuangjia_tag"));
				if (2 * cnt < len) {
					return true;
				}
			},
			aiOrder(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("dcshuangjia_tag")) {
					var suits = lib.suit.slice();
					player.countCards("h", cardx => {
						if (!cardx.hasGaintag("dcshuangjia_tag")) {
							return false;
						}
						if (card == cardx) {
							return false;
						}
						suits.remove(get.suit(cardx));
					});
					if (suits.length) {
						return num + suits.length * 2.5;
					}
				}
			},
		},
	},
	//孟优
	dcmanzhi: {
		audio: 2,
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		filter(event, player) {
			if (event.name == "phaseJieshu") {
				var del = 0;
				game.getGlobalHistory("changeHp", evt => {
					if (evt.player != player) {
						return;
					}
					for (var phase of lib.phaseName) {
						var evtx = evt.getParent(phase);
						if (evtx && evtx.name == phase) {
							del += evt.changedHp;
							break;
						}
					}
				});
				if (del != 0) {
					return false;
				}
			}
			return game.hasPlayer(current => {
				if (current == player) {
					return false;
				}
				return (!player.hasSkill("dcmanzhi_1") && current.countCards("he") >= 1) || (!player.hasSkill("dcmanzhi_2") && current.countCards("hej"));
			});
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButtonTarget({
					createDialog: [
						`###${get.prompt(event.skill)}###<div class='text center'>你可以选择一项并选择一名其他角色…</div>`,
						[
							[
								["give", "令其交给你两张牌，然后其视为使用一张无距离限制的【杀】"],
								["gain", "你获得其区域内的至多两张牌，然后交给其等量的牌并摸一张牌"],
							],
							"textbutton",
						],
					],
					filterButton(button) {
						const player = get.player();
						const trigger = get.event().getTrigger();
						const chosen = [player.hasSkill("dcmanzhi_1"), player.hasSkill("dcmanzhi_2")];
						if (button.link === "give") {
							return game.hasPlayer(current => current != player && current.countCards("he") >= 2 && (!chosen[0] || trigger.name == "phaseZhunbei"));
						}
						return game.hasPlayer(current => current != player && current.hasCards("hej") && (!chosen[1] || trigger.name == "phaseZhunbei"));
					},
					filterTarget(card, player, target) {
						if (!ui.selected.buttons.length || player == target) {
							return false;
						}
						const trigger = get.event().getTrigger();
						const chosen = [player.hasSkill("dcmanzhi_1"), player.hasSkill("dcmanzhi_2")];
						const link = ui.selected.buttons[0].link;
						if (link === "give") {
							return target.countCards("he") >= 2 && (!chosen[0] || trigger.name == "phaseZhunbei");
						}
						return target.hasCards("hej") && (!chosen[1] || trigger.name == "phaseZhunbei");
					},
					ai1(button) {
						const player = get.player();
						const link = button.link;
						const trigger = get.event().getTrigger();
						if (link == "gain") {
							if (trigger.name == "phaseZhunbei" && !player.hasShan() && !game.hasPlayer(current => current != player && current.countCards("he") >= 2 && get.attitude(player, current) > 0)) {
								return 2.5;
							}
							return 1.5;
						} else {
							if (
								game.hasPlayer(current => {
									const att = get.attitude(player, current);
									return att > 0 && current.getUseValue({ name: "sha" }, false) > 5 && current.countCards("he") >= 4;
								})
							) {
								return 2;
							}
							if (player.hasShan() || player.getHp() >= 2) {
								return 1;
							}
							return 0;
						}
					},
					ai2(target) {
						const player = get.player();
						const trigger = get.event().getTrigger();
						const link = ui.selected.buttons[0].link;
						const att = get.attitude(player, target);
						if (link == "give") {
							if (att > 0 && target.getUseValue({ name: "sha" }, false) > 5 && target.countCards("he") >= 4) {
								return 2;
							}
							if (att < 0 && (target.getUseValue({ name: "jiu" }, false) <= 5 || player.getHp() >= 2)) {
								return 1;
							}
						}
						return 1 - att;
					},
				})
				.forResult();
			event.result = {
				bool: result.bool,
				targets: result.targets,
				cost_data: result.links,
			};
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (event.cost_data[0] == "give") {
				player.addTempSkill("dcmanzhi_1");
				const num = Math.min(2, target.countCards("he"));
				if (!num) {
					return;
				}
				const result = await target.chooseToGive(player, "he", true, num, `蛮智：请交给${get.translation(player)}${get.cnNumber(num)}张牌`).forResult();
				if (!result?.bool) {
					return;
				}
				await target.chooseUseTarget("sha", true, "nodistance");
			} else {
				player.addTempSkill("dcmanzhi_2");
				let result = await player.gainPlayerCard(target, "hej", [1, 2], true).forResult();
				if (!result?.bool || !target.isIn()) {
					return;
				}
				const num = result.cards.length;
				const hs = player.getCards("he");
				if (!hs.length) {
					return;
				}
				result = await player.chooseToGive(target, "he", true, num, `交给${get.translation(target)}${get.cnNumber(num)}张牌`).forResult();
				if (result?.bool) {
					await player.draw();
				}
			}
		},
		subSkill: {
			1: { charlotte: true },
			2: { charlotte: true },
		},
	},
};
