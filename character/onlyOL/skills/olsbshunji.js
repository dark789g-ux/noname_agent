import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbshunji" | "olsbyishi" | "olbachao">} */
export const groupSkills = {
	//谋董昭
	olsbshunji: {
		audio: 3,
		trigger: {
			global: "damageEnd",
		},
		filter(event, player) {
			return !player.getStorage("olsbshunji_used").includes(event.player) && event.player?.isIn();
		},
		logTarget: "player",
		check(event, player) {
			const target = event.player;
			if (target == player) {
				return true;
			}
			const att = get.attitude(player, target);
			const hs = player.getCards("he", card => !player.hasCard(cardx => cardx != card && get.name(cardx) == get.name(card) && !player.getStorage(`olsbshunji_damaged`).includes(get.name(card)), "he"));
			if (hs.length && att <= 0 && get.damageEffect(target, player, player) > 0) {
				return true;
			}
			if (att > 0 && player.hasCard(card => !hs.includes(card), "he")) {
				return true;
			}
			return false;
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseControl("一张", "两张", "cancel2")
				.set("prompt", get.prompt2(event.skill, trigger.player))
				.set("ai", () => {
					const { resultx, att } = get.event();
					if (!resultx) {
						return "cancel2";
					}
					return att > 0 ? 1 : 0;
				})
				.set("att", get.attitude(player, trigger.player))
				.set("resultx", get.info(event.skill).check(trigger, player))
				.forResult();
			if (result.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: result.index + 1,
				};
			}
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: num,
			} = event;
			player.addTempSkill(`${event.name}_used`, "roundStart");
			player.markAuto(`${event.name}_used`, target);
			await player.draw(num);
			if (player == target) {
				return;
			}
			const damaged = player.getStorage(`${event.name}_damaged`);
			const hs = player.getCards("he", card => !damaged.includes(get.name(card), "he"));
			if (hs.length) {
				player.addGaintag(hs, `${event.name}_tag`);
			}
			const result = await player
				.chooseToGive(target, "he", true, num)
				.set("hs", hs)
				.set("custom", {
					add: {
						confirm(bool) {
							get.player().removeGaintag(`olsbshunji_tag`);
						},
					},
					replace: {},
				})
				.set("ai", card => {
					const { player, target, hs } = get.event();
					const att = get.attitude(player, target);
					if (att > 0) {
						if (hs.includes(card)) {
							return 0;
						}
						return get.value(card);
					} else {
						if (hs.includes(card)) {
							return 7.5 - get.value(card);
						}
						return 5 - get.value(card);
					}
				})
				.forResult();
			player.removeGaintag(`${event.name}_tag`);
			if (result?.bool && result.cards?.length) {
				const { cards } = result;
				const names = cards
					.filter(card => {
						const name = get.name(card);
						return !player.hasCard(i => get.name(i) == name, "he") && !damaged.includes(name);
					})
					.map(card => get.name(card))
					.toUniqued();
				if (names?.length) {
					player.markAuto(`${event.name}_damaged`, names);
					await target.damage();
				}
			}
		},
		subSkill: {
			used: {
				intro: {
					content: "本轮已触发：$",
				},
				charlotte: true,
				onremove: true,
			},
			tag: {
				name: "可伤害",
			},
		},
	},
	olsbyishi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard(card, player) {
			const { cards } = ui.selected;
			if (!cards?.length) {
				return true;
			}
			return !cards.some(cardx => get.suit(cardx) == get.suit(card));
		},
		filterOk() {
			const { cards } = ui.selected;
			if (cards?.length) {
				const player = get.player();
				const suits = player
					.getCards("h")
					.map(card => get.suit(card))
					.unique();
				return cards.map(card => get.suit(card)).unique().length == suits.length;
			}
			return false;
		},
		complexCard: true,
		selectCard: [1, Infinity],
		lose: false,
		discard: false,
		delay: false,
		check(card) {
			return get.value(card);
		},
		async content(event, trigger, player) {
			const { cards } = event;
			await player.showCards(cards, `${get.translation(player)}发动了【${get.translation(event.name)}】`);
			let discard = player.getCards("h", card => !cards.includes(card));
			if (discard.length) {
				await player.loseToDiscardpile(discard);
			}
			if (player.canMoveCard()) {
				const result = await player.moveCard(true).forResult();
				if (result?.card && !discard?.length) {
					const { card } = result;
					player.addTempSkill(`${event.name}_draw`, { player: "phaseBeginStart" });
					player.markAuto(`${event.name}_draw`, get.suit(card));
				}
			}
		},
		subSkill: {
			draw: {
				audio: "olsbyishi",
				charlotte: true,
				onremove: true,
				forced: true,
				intro: {
					content: "不因使用失去$牌后，摸一张牌",
				},
				trigger: {
					player: "loseAfter",
					global: ["loseAsyncAfter", "gainAfter", "addToExpansionAfter", "equipAfter", "addJudgeAfter"],
				},
				filter(event, player) {
					if (event.name.startsWith("lose")) {
						const evt = event.relatedEvent || event.getParent();
						if (evt.name == "useCard") {
							return false;
						}
					}
					const suits = player.getStorage("olsbyishi_draw");
					return event.getl?.(player)?.cards2?.some(card => suits.includes(get.suit(card)));
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
		},
		ai: {
			order: 2,
			result: {
				player(player, target) {
					const suits = player
						.getCards("h")
						.map(card => get.suit(card))
						.unique();
					const num = player.needsToDiscard();
					if (player.canMoveCard(true) && num >= player.countCards("h") - suits.length) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	//魔曹操
	olbachao: {
		audio: 5,
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		logTarget(event, player) {
			return game.filterPlayer(current => current != player);
		},
		check(event, player) {
			if (player.hp > 1) {
				return true;
			}
			return game.countPlayer(current => current != player) > 1;
		},
		chooseToGive(target, player) {
			const next = target.chooseCard(`霸朝：是否交给${get.translation(player)}一张牌`, "he");
			/*next.set("filterCard", card => {
				return get.type(card) != "basic";
			});*/
			next.set("sourcex", player);
			next.set("att", get.attitude(target, player));
			next.set("ai", card => {
				const { player, att, sourcex } = get.event();
				if (att > 0) {
					return 15 - get.value(card);
				}
				if (game.countPlayer(current => current != sourcex) <= 3) {
					return (get.type(card) != "basic" ? 10 : 8) - get.value(card);
				}
				return 0;
			});
			return next;
		},
		async content(event, trigger, player) {
			const map = await game.chooseAnyOL(event.targets, get.info(event.name).chooseToGive, [player]).forResult();
			if (!map.size) {
				return;
			}
			const cards = [];
			for (const target of Array.from(map.keys())) {
				const result = map.get(target);
				if (result?.bool && result.cards?.length) {
					cards.addArray(result.cards);
				}
			}
			let next;
			if (cards.length) {
				next = player.gain(cards, "giveAuto");
				await next;
			}
			const targets = game.filterPlayer(current => {
				return !current.hasHistory("lose", evt => evt.getParent() == next && get.type(evt.cards[0]) != "basic");
			});
			if (!targets.length) {
				return;
			}
			const result = await player
				.chooseTarget("霸朝：是否对一名未交给你非基本牌的角色造成1点伤害", (card, player, target) => {
					return get.event().targetx.includes(target);
				})
				.set("targetx", targets)
				.set("ai", target => {
					const player = get.player();
					return get.damageEffect(target, player, player);
				})
				.forResult();
			if (result?.bool && result.targets?.length) {
				const target = result.targets[0];
				player.line(target, "green");
				await target.damage(player);
				if (target == player) {
					player.addTempSkill("olbachao_effect", { global: "phaseAnyAfter" });
					player.addGaintag(player.getCards("h"), "olbachao_effect");
					if (!player.hasSkill("olrumo", null, null, false)) {
						player.addSkill("olrumo");
					}
				}
			}
		},
		subSkill: {
			effect: {
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				trigger: {
					player: "useCard1",
				},
				firstDo: true,
				charlotte: true,
				filter(event, player) {
					if (event.addCount === false) {
						return false;
					}
					return player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx != event) {
							return false;
						}
						return Object.values(evt.gaintag_map)?.flat()?.includes("olbachao_effect");
					});
				},
				async cost(event, trigger, player) {
					trigger.addCount = false;
					const stat = player.getStat("card"),
						name = trigger.card.name;
					if (typeof stat[name] == "number" && stat[name] > 0) {
						stat[name]--;
					}
				},
				mod: {
					targetInRange(card, player) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("olbachao_effect"))) {
							return true;
						}
					},
					cardUsable(card, player) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("olbachao_effect"))) {
							return Infinity;
						}
					},
				},
			},
		},
	},
};
