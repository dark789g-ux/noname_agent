import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dccilv" | "dctongdao" | "dcsbfuxi" | "dcsbhaoyi">} */
export const groupSkills = {
	//朱佩兰
	dccilv: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return get.type(event.card) == "trick" && player.getStorage("dccilv").length < 3;
		},
		async content(event, trigger, player) {
			await player.draw(3 - player.getStorage("dccilv").length);
			if (player.countCards("h") > player.maxHp) {
				let result,
					list = ["无效", "防伤", "获得"].filter(i => !player.getStorage("dccilv").includes(i));
				if (list.length == 1) {
					result = { control: list[0] };
				} else {
					result = await player
						.chooseControl(list)
						.set("prompt", "辞虑：选择执行并移去一项")
						.set("ai", () => {
							const player = get.event().player,
								trigger = get.event().getTrigger(),
								card = trigger.card;
							let controls = get.event().controls.slice();
							if (controls.includes("防伤")) {
								if (get.tag(card, "damage")) {
									return "防伤";
								} else {
									controls.remove("防伤");
								}
							}
							if (get.effect(player, trigger.card, trigger.player, player) < 0 && controls.includes("无效")) {
								return "无效";
							}
							return controls[controls.length - 1];
						})
						.forResult();
				}
				const choice = result.control;
				player.popup(choice);
				game.log(player, "选择了", "#y" + choice);
				switch (choice) {
					case "无效":
						trigger.getParent().excluded.add(player);
						game.log(trigger.card, "对", player, "无效");
						break;
					case "防伤":
						trigger.player.addTempSkill("dccilv_effect");
						trigger.player.markAuto("dccilv_effect", [trigger.card]);
						break;
					case "获得":
						player
							.when({ global: "useCardAfter" })
							.filter(evt => evt == trigger.getParent())
							.step(async (event, trigger, player) => {
								const cards = (trigger.cards || []).filterInD();
								if (cards.length) {
									await player.gain(cards, "gain2");
								}
							});
						break;
				}
				player.markAuto("dccilv", [choice]);
			}
		},
		mark: true,
		intro: {
			markcount: storage => 3 - (storage || []).length,
			content: storage => ((storage || []).length ? "已移去了" + storage + "项" : "暂未移去任何项"),
		},
		subSkill: {
			effect: {
				audio: "dccilv",
				charlotte: true,
				onremove: true,
				trigger: { source: "damageBegin2" },
				filter(event, player) {
					const evt = event.getParent(2);
					return evt && evt.name == "useCard" && player.getStorage("dccilv_effect").includes(evt.card);
				},
				forced: true,
				content() {
					trigger.cancel();
				},
				ai: {
					notricksource: true,
					skillTagFilter(player, tag, arg) {
						return player.getStorage("dccilv_effect").includes(arg.card);
					},
					effect: {
						player(card, player, target) {
							if (player.getStorage("dccilv_effect").includes(card)) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
		},
	},
	dctongdao: {
		limited: true,
		audio: 2,
		trigger: { player: "dying" },
		skillAnimation: true,
		animationColor: "fire",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					const player = get.event().player;
					if (player.hp + player.countCards("hs", card => player.canSaveCard(card, player)) > 0) {
						return target == player ? 1 : 0;
					}
					return target.hp + 114514;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.awakenSkill(event.name);
			const removeSkills = target.getSkills(null, false, false).filter(i => {
				const info = get.info(i);
				return !info || !info.charlotte;
			});
			if (removeSkills.length) {
				target.removeSkill(removeSkills);
			}
			const gainSkills = target.getStockSkills(true, true).filter(i => {
				const info = get.info(i);
				return info && !info.charlotte && (!info.zhuSkill || target.isZhu2());
			});
			if (gainSkills.length) {
				//抽象
				//混沌初开——牢戏
				Object.keys(target.storage)
					.filter(i => gainSkills.some(skill => i.startsWith(skill)))
					.forEach(storage => delete target.storage[storage]);
				target.addSkill(gainSkills);
				const suffixs = ["used", "round", "block", "blocker"];
				for (const skill of gainSkills) {
					const info = get.info(skill);
					if (info.usable !== undefined) {
						if (typeof target.getStat("triggerSkill")[skill] == "number" && target.getStat("triggerSkill")[skill] >= 1) {
							delete target.getStat("triggerSkill")[skill];
						}
						if (typeof target.getStat("skill")[skill] == "number" && target.getStat("skill")[skill] >= 1) {
							delete target.getStat("skill")[skill];
						}
					}
					if (info.round && target.storage[skill + "_roundcount"]) {
						delete target.storage[skill + "_roundcount"];
					}
					if (target.storage[`temp_ban_${skill}`]) {
						delete target.storage[`temp_ban_${skill}`];
					}
					if (target.awakenedSkills.includes(skill)) {
						target.restoreSkill(skill);
					}
					for (const suffix of suffixs) {
						if (target.hasSkill(skill + "_" + suffix)) {
							target.removeSkill(skill + "_" + suffix);
						}
					}
				}
			}
			if (target != player && target.hp > player.hp) {
				await player.recoverTo(target.hp);
			}
		},
	},
	//张绣
	dcsbfuxi: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			const target = event.player;
			if (!player.countCards("he") && !target.countCards("he") && !player.canUse(new lib.element.VCard({ name: "sha", isCard: true }), target, false)) {
				return false;
			}
			return event.player != player && event.player.isMaxHandcard();
		},
		async cost(event, trigger, player) {
			const target = trigger.player,
				str = get.translation(target);
			let result;
			if (!player.countCards("he")) {
				result = await player
					.chooseBool(get.prompt(event.skill, target), "弃置" + str + "的一张牌，然后视为对其使用一张【杀】")
					.set("choice", get.effect(target, { name: "guohe_copy2" }, player, player) + get.effect(target, new lib.element.VCard({ name: "sha", isCard: true }), player, player) > 0)
					.forResult();
				result.index = 1;
			} else if (!target.countCards("he") && !player.canUse(new lib.element.VCard({ name: "sha", isCard: true }), target, false)) {
				result = await player
					.chooseBool(get.prompt(event.skill, target), "交给" + str + "一张牌，然后摸两张牌")
					.set("choice", get.attitude(player, target) > 0 || player.hasCard(card => card.name == "du", "h"))
					.forResult();
				result.index = 0;
			} else {
				result = await player
					.chooseControl("给牌", "出杀", "cancel2")
					.set("choiceList", ["交给" + str + "一张牌，然后摸两张牌", "弃置" + str + "的一张牌，然后视为对其使用一张【杀】"])
					.set("ai", () => {
						const player = get.event().player,
							target = get.event().target;
						const num = get.effect(target, { name: "guohe_copy2" }, player, player) + get.effect(target, new lib.element.VCard({ name: "sha", isCard: true }), player, player);
						if (num <= 0 && get.attitude(player, target) < 0) {
							return "cancel2";
						}
						return get.attitude(player, target) >= 0 ? 0 : 1;
					})
					.set("target", target)
					.forResult();
				result.bool = result.control != "cancel2";
			}
			if (result.bool) {
				result.targets = [target];
				result.cost_data = result.index;
			}
			event.result = result;
		},
		async content(event, trigger, player) {
			const target = trigger.player;
			if (event.cost_data == 0) {
				await player.chooseToGive(target, "he", true);
				await player.draw(2);
			} else {
				await player.discardPlayerCard(target, "he", true);
				const sha = new lib.element.VCard({ name: "sha", isCard: true });
				if (player.canUse(sha, target, false)) {
					await player.useCard(sha, target, false);
				}
			}
		},
	},
	dcsbhaoyi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return lib.skill.dcsbhaoyi.getCards().length;
		},
		frequent: true,
		prompt(event, player) {
			return get.prompt("dcsbhaoyi") + "（可获得" + get.translation(lib.skill.dcsbhaoyi.getCards()) + "）";
		},
		async content(event, trigger, player) {
			let cardx = lib.skill.dcsbhaoyi.getCards();
			await player.gain(cardx, "gain2");
			cardx = cardx.filter(i => get.owner(i) == player && get.position(i) == "h");
			if (!cardx.length) {
				return;
			}
			if (_status.connectMode) {
				game.broadcastAll(() => (_status.noclearcountdown = true));
			}
			let given_map = [];
			while (player.hasCard(card => cardx.includes(card) && !card.hasGaintag("olsujian_given"), "h") && game.hasPlayer(current => player !== current)) {
				const { bool, cards, targets } = await player
					.chooseCardTarget({
						filterCard(card, player) {
							return get.event().cards.includes(card) && !card.hasGaintag("olsujian_given");
						},
						selectCard: [1, Infinity],
						position: "h",
						filterTarget: lib.filter.notMe,
						prompt: "豪义：请选择要分配的卡牌和目标",
						allowChooseAll: true,
						ai1(card) {
							return !ui.selected.cards.length && card.name == "du" ? 1 : 0;
						},
						ai2(target) {
							const player = get.event().player;
							const card = ui.selected.cards[0];
							if (card) {
								return get.value(card, target) * get.attitude(player, target);
							}
							return 0;
						},
					})
					.set("cards", cardx)
					.forResult();
				if (bool) {
					const target = targets[0];
					if (given_map.some(i => i[0] == target)) {
						given_map[given_map.indexOf(given_map.find(i => i[0] == target))][1].addArray(cards);
					} else {
						given_map.push([target, cards]);
					}
					player.addGaintag(cards, "olsujian_given");
				} else {
					break;
				}
			}
			if (_status.connectMode) {
				game.broadcastAll(() => {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			if (given_map.length) {
				await game
					.loseAsync({
						gain_list: given_map,
						player: player,
						cards: given_map.slice().flatMap(list => list[1]),
						giver: player,
						animate: "giveAuto",
					})
					.setContent("gaincardMultiple");
			}
		},
		getCards() {
			let cards = [],
				targets = game.players.slice().concat(game.dead.slice());
			for (const target of targets) {
				const history = target.getHistory("lose", evt => evt.position == ui.discardPile);
				if (history.length) {
					for (const evt of history) {
						cards.addArray(evt.cards2.filterInD("d"));
					}
				}
			}
			const historyx = game.getGlobalHistory("cardMove", evt => evt.name == "cardsDiscard");
			if (historyx.length) {
				for (const evtx of historyx) {
					cards.addArray(evtx.cards.filterInD("d"));
				}
			}
			for (const target of targets) {
				const history = target.getHistory(
					"useCard",
					evt =>
						(evt.cards || []).length &&
						target.getHistory("sourceDamage", evtx => {
							return evtx.card && evtx.card == evt.card;
						}).length
				);
				if (history.length) {
					for (const evt of history) {
						cards.removeArray(evt.cards.filterInD("d"));
					}
				}
			}
			return cards.filter(card => get.is.damageCard(card));
		},
	},
};
