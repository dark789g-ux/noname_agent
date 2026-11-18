import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcwangzi" | "dcherong" | "dcsbmoyou" | "dcsbshiao">} */
export const groupSkills = {
	//侯昭宁
	dcwangzi: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		round: 1,
		filter(event, player) {
			return event.player !== player && player.hasDiscardableCards(player, "he");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt2(event.skill, trigger.player),
					selectCard: [1, 5],
					position: "he",
					chooseonly: true,
					allowChooseAll: true,
					ai(card) {
						const target = get.event().getTrigger().player;
						if (get.attitude(get.player(), target) > 0) {
							return 7.5 - get.value(card);
						}
						return 0;
					},
				})
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
			} = event;
			await player.discard(cards);
			const gain = [];
			while (gain.length < cards.length) {
				const card = get.cardPile2(card => get.color(card) == "black" && !gain.includes(card), "random");
				if (card) {
					gain.push(card);
				} else {
					break;
				}
			}
			if (gain.length) {
				target.addTempSkill(`${event.name}_draw`, "phaseChange");
				game.broadcastAll(
					(name, translate) => {
						lib.translate[name] = translate;
					},
					`${event.name}_draw_${player.playerid}`,
					get.translation(event.name)
				);
				const next = target.gain(gain, "draw");
				next.gaintag.add(`${event.name}_draw_${player.playerid}`);
				await next;
			}
		},
		subSkill: {
			draw: {
				audio: "dcwangzi",
				forced: true,
				charlotte: true,
				onremove(player, skill) {
					const gaintag = player
						.getCards("h")
						.flatMap(card => card.gaintag.filter(tag => tag.startsWith(skill)))
						.unique();
					gaintag.forEach(tag => player.removeGaintag(tag));
				},
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return player.hasHistory("lose", evt => {
						return (
							(evt.relatedEvent || evt.getParent()) == event &&
							Object.values(evt.gaintag_map)
								.flat()
								.some(tag => tag.startsWith("dcwangzi_draw"))
						);
					});
				},
				async content(event, trigger, player) {
					const ids = [];
					player.checkHistory("lose", evt => {
						if ((evt.relatedEvent || evt.getParent()) == trigger) {
							ids.addArray(
								Object.values(evt.gaintag_map)
									.flat()
									.reduce((list, tag) => (tag.startsWith(event.name) ? [tag.slice(event.name.length + 1), ...list] : list), [])
							);
						}
					});
					const targets = ids.map(id => (_status.connectMode ? lib.playerOL[id] : game.playerMap[id]));
					await game.doAsyncInOrder(targets, async target => game.asyncDraw([target, player]));
				},
			},
		},
	},
	dcherong: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await player.choosePlayerCard(`和戎：请选择展示${get.translation(target)}一张手牌`, target, "h", true).forResult();
			if (result?.bool && result.cards?.length) {
				await player.showCards(result.cards, `${get.translation(target)}被展示的手牌`);
			} else {
				return;
			}
			if (!player.countCards("h")) {
				return;
			}
			const card1 = result.cards[0];
			const result2 = await player
				.chooseCard(`和戎：请选择一张手牌与其交换`, true, "h")
				.set("promptx", [[card1], [dialog => dialog.buttons.forEach(i => (i.style.opacity = 1)), "handle"]])
				.set("ai", card => {
					const { target, player, cardx } = get.event();
					const bool = get.type2(card) == get.type2(cardx);
					const att = get.attitude(player, target);
					if (att > 0 && bool) {
						return 8 - get.value(card);
					}
					if (att < 0 && !bool) {
						return 7 - get.value(card);
					}
					return 0;
				})
				.set("cardx", card1)
				.set("target", target)
				.forResult();
			if (!result2.bool || !result2.cards?.length) {
				return;
			}
			const card2 = result2.cards[0];
			await player.swapHandcards(target, [card2], [card1]);
			if (get.type2(card1) == get.type2(card2)) {
				player.popup("洗具");
				player.addSkill(`${event.name}_defend`);
				await game.doAsyncInOrder(
					[player, target],
					async target => {
						const card = get.cardPile2(card => get.type(card) == "equip", "random");
						if (card) {
							await target.gain(card, "draw");
						}
					},
					() => 0
				);
			} else {
				player.popup("杯具");
				await player.discardPlayerCard(target, "he", true, 2);
				await target.damage();
			}
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					const sgn = get.sgnAttitude(player, target);
					if (sgn > 0) {
						return sgn * (get.effect(target, { name: "draw" }, player, player) + get.effect(player, { name: "draw" }, player, player));
					} else if (sgn < 0) {
						return sgn * (get.effect(target, { name: "guohe_copy2" }, player, player) + get.damageEffect(target, player, player));
					}
					return 0;
				},
			},
		},
		subSkill: {
			defend: {
				audio: "dcherong",
				charlotte: true,
				forced: true,
				trigger: { player: "damageBegin4" },
				filter(event, player) {
					return event.num > 0;
				},
				logTarget: "player",
				mark: true,
				intro: {
					content: "防止你下次受到的伤害",
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					trigger.cancel();
				},
				ai: {
					filterDamage: true,
					//纯放屁！
					skillTagFilter(player, tag, arg) {
						if (tag == "filterDamage") {
							return true;
						}
					},
				},
			},
		},
	},
	//新杀谋许攸
	dcsbmoyou: {
		audio: 2,
		init(player, skill) {
			player.addSkill(skill + "_count");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_count");
		},
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			return player.countMark("dcsbmoyou_count") >= 2;
		},
		check: () => true,
		async content(event, trigger, player) {
			player.clearMark(`${event.name}_count`, false);
			await player.draw(3);
			player.addTempSkill(`${event.name}_distance`);
			const getCards = suit => player.getDiscardableCards(player, "h", { suit: suit });
			const hasCards = suit => player.hasDiscardableCards(player, "h", { suit: suit });
			const suits = lib.suit.filter(suit => hasCards(suit));
			if (suits.length) {
				const choice = suits.slice().sort((a, b) => get.value(getCards(a)) - get.value(getCards(b)))[0];
				const result = await player
					.chooseControl({
						prompt: "谟猷：请弃置一种花色的所有手牌",
						controls: suits,
						ai() {
							return get.event().suit;
						},
					})
					.set("suit", choice)
					.forResult();
				if (result?.control) {
					const suit = result.control;
					const cards = getCards(suit);
					await player.discard(cards);
					if (
						!player
							.getCards("h")
							.map(card => get.type2(card))
							.containsAll("basic", "trick", "equip")
					) {
						player.addTempSkill(`${event.name}_basic`, { player: "dieAfter" });
						player.addTempSkill(`${event.name}_trick`, { player: "dieAfter" });
					}
				}
			}
		},
		subSkill: {
			count: {
				trigger: {
					player: "useCardAfter",
				},
				firstDo: true,
				charlotte: true,
				silent: true,
				filter(event, player) {
					return !event.skill || !event.skill.startsWith("dcsbmoyou");
				},
				async content(event, trigger, player) {
					player.addMark(event.name, 1, false);
				},
				intro: {
					content: "已使用$张牌",
				},
			},
			distance: {
				charlotte: true,
				mod: {
					targetInRange(card, player) {
						return true;
					},
				},
				mark: true,
				marktext: "距",
				intro: {
					content: "本回合使用牌无距离限制",
				},
			},
			basic: {
				mod: {
					cardUsable(card, player) {
						if (get.type(card) == "basic") {
							return Infinity;
						}
					},
				},
				trigger: {
					player: "useCard1",
				},
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					return get.type2(event.card) == "basic";
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] == "number") {
							stat[name]--;
						}
					}
				},
				mark: true,
				marktext: "基",
				intro: {
					content: "使用下一张基本牌无次数限制",
				},
			},
			trick: {
				charlotte: true,
				forced: true,
				trigger: { player: "useCard" },
				filter(event, player) {
					return get.type2(event.card) == "trick";
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					game.log(trigger.card, "不可被响应");
					trigger.directHit.addArray(game.players);
				},
				mark: true,
				marktext: "锦",
				intro: {
					content: "使用下一张锦囊牌不可响应",
				},
			},
		},
	},
	dcsbshiao: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["cardsDiscardAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			const discard = event.getd(player, "cards2").filter(card => get.type(card) != "equip");
			if (!discard.length) {
				return false;
			}
			if (event.type == "discard") {
				return true;
			}
			return get.info("dcsbshiao").isDamaged(discard);
		},
		isDamaged(cards) {
			const damageCards = game.getAllGlobalHistory("changeHp", evt => evt.getParent()?.name == "damage" && evt.getParent().cards?.length).flatMap(evt => evt.getParent().cards);
			return damageCards.containsSome(...cards);
		},
		forced: true,
		async content(event, trigger, player) {
			player.addTempSkill(`${event.name}_draw`);
			const discard = trigger.getd(player, "cards2").filter(card => get.type(card) != "equip");
			let num = player.getStorage(`${event.name}_draw`, 0);
			if (get.info(event.name).isDamaged(discard)) {
				game.log(player, "的摸牌数+1");
				num++;
			}
			if (trigger.type == "discard") {
				game.log(player, "的摸牌数-1");
				num--;
			}
			player.storage[`${event.name}_draw`] = num;
			player[num == 0 ? "unmarkSkill" : "markSkill"](`${event.name}_draw`);
		},
		subSkill: {
			draw: {
				audio: "dcsbshiao",
				init(player, skill) {
					player.storage[skill] = 0;
				},
				charlotte: true,
				onremove: true,
				forced: true,
				trigger: {
					player: "drawBegin",
				},
				filter(event, player) {
					return player.storage.dcsbshiao_draw != 0;
				},
				async content(event, trigger, player) {
					trigger.num = Math.max(0, trigger.num + player.storage[event.name]);
				},
				intro: {
					content(storage, player) {
						return `本回合你摸牌时摸牌数${storage >= 0 ? "+" + storage : storage}`;
					},
				},
			},
		},
	},
};
