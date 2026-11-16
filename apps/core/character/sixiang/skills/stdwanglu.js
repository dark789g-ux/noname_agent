import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdwanglu" | "stdjinhui" | "stdqingman" | "stdfuli" | "stddehua" | "stdlianrong" | "stdyuanzhuo" | "stdbizun" | "stdhuangong" | "stdzhuying" | "stdzhongshi" | "stdjuxian" | "stdlijun">} */
export const groupSkills = {
	//张奋
	stdwanglu: {
		audio: "dcwanglu",
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target.countDiscardableCards(player, "e", card => get.type(card) == "equip");
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await player.discardPlayerCard(target, "e", card => get.type(card) == "equip", true).forResult();
			if (result?.cards?.length) {
				const card = result.cards[0];
				if (get.subtype(card) == "equip1") {
					let num = 1;
					const info = get.info(card, false);
					if (info && info.distance && typeof info.distance.attackFrom == "number") {
						num -= info.distance.attackFrom;
					}
					await target.draw(num);
				}
			}
		},
		ai: {
			order: 5,
			result: {
				target: -1,
			},
		},
	},
	//赵嫣
	stdjinhui: {
		audio: "jinhui",
		trigger: { player: "phaseZhunbeiBegin" },
		check: () => true,
		async content(event, trigger, player) {
			const cards = get.cards(3, true);
			await player.showCards(cards, `${get.translation(player)}发动了【锦绘】`, true).set("clearArena", false);
			const targets = [player];
			if (game.hasPlayer(target => target != player)) {
				const result = await player
					.chooseTarget(`锦绘：与一名其他角色依次使用其中一张牌（不能连续使用相同颜色的牌）`, true, lib.filter.notMe)
					.set("ai", target => get.attitude(get.player(), target))
					.forResult();
				if (result?.targets?.length) {
					const [target] = result.targets;
					player.line(target);
					targets.add(target);
				}
			}
			game.broadcastAll(ui.clear);
			const colors = [];
			for (const target of targets) {
				if (cards.some(card => target.hasUseTarget(card, true, false) && !colors.includes(get.color(card)))) {
					const result = await target
						.chooseCardButton("锦绘：请使用其中一张牌", cards, true)
						.set("filterButton", button => {
							return get.event().cards.includes(button.link);
						})
						.set(
							"cards",
							cards.filter(card => target.hasUseTarget(card, true, false) && !colors.includes(get.color(card)))
						)
						.set("ai", button => get.player().getUseValue(button.link))
						.forResult();
					if (result?.links?.length) {
						const [card] = result.links;
						colors.add(get.color(card));
						cards.remove(card);
						await target.chooseUseTarget(card, true, false);
					}
				}
			}
		},
	},
	stdqingman: {
		audio: "qingman",
		forced: true,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			const num = player.countCards("h");
			let num2 = 0;
			for (let i = 1; i <= 5; i++) {
				num2 += player.countEmptySlot(i);
			}
			return num < Math.min(3, num2);
		},
		async content(event, trigger, player) {
			let num2 = 0;
			for (let i = 1; i <= 5; i++) {
				num2 += player.countEmptySlot(i);
			}
			await player.drawTo(Math.min(3, num2));
		},
	},
	//刘理
	stdfuli: {
		audio: "dcfuli",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h");
		},
		manualConfirm: true,
		async content(event, trigger, player) {
			const func = async function (target) {
				await target.showHandcards();
				const hs = target.getDiscardableCards(target, "h", card => get.tag(card, "damage") && get.type(card) != "delay");
				if (hs.length) {
					await target.discard(hs);
				}
				if (target != player && target.isDamaged()) {
					await target.recover();
				}
			};
			await func(player);
			if (game.hasPlayer(target => target != player)) {
				const result = await player
					.chooseTarget(
						`抚黎：令一名其他角色展示所有手牌并弃置其中的所有伤害类牌（没有则不弃）并回复1体力`,
						true,
						(card, player, target) => {
							return player != target && target.countCards("h");
						}
					)
					.set("ai", target => get.recoverEffect(target, get.player(), get.player()))
					.forResult();
				if (result?.targets?.length) {
					const [target] = result.targets;
					player.line(target);
					await func(target);
				}
			}
		},
		ai: {
			order: 1,
			result: {
				player(player, target) {
					if (game.hasPlayer(target => get.recoverEffect(target, player, player) > 0)) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	stddehua: {
		audio: "dcdehua",
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return player.getHistory("lose").reduce((list, evt) => list.addArray(evt.cards), []).length == 2;
		},
		async cost(event, trigger, player) {
			const list = get.inpileVCardList(info => {
				if (info[0] != "basic") {
					return false;
				}
				return player.hasUseTarget(get.autoViewAs({ name: info[2], nature: info[3], isCard: true }));
			});
			if (list.length) {
				const result = await player
					.chooseButton([get.prompt2(event.skill), [list, "vcard"]])
					.set("ai", button => get.player().getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3], isCard: true })))
					.forResult();
				if (result?.links?.length) {
					event.result = {
						bool: true,
						cost_data: result.links[0],
					};
				}
			}
		},
		async content(event, trigger, player) {
			const link = event.cost_data;
			const card = get.autoViewAs({ name: link[2], nature: link[3], isCard: true });
			await player.chooseUseTarget(card, true);
		},
	},
	//珍藏封印
	//张美人
	stdlianrong: {
		trigger: {
			global: ["loseAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return false;
			}
			return game.hasPlayer2(
				target => target != player && event.getl?.(target)?.cards2.some(card => get.suit(card) == "heart" && get.position(card, true) == "d")
			);
		},
		async cost(event, trigger, player) {
			const cards = game
				.filterPlayer2(target => target != player)
				.map(target => trigger.getl?.(target)?.cards2?.filter(card => get.suit(card) == "heart" && get.position(card, true) == "d"))
				.flat();
			const result = await player
				.chooseCardButton(get.prompt2(event.skill), cards, [1, Infinity])
				.set("ai", button => {
					return get.value(button.link, get.player(), "raw");
				})
				.forResult();
			if (result?.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links,
				};
			}
		},
		async content(event, trigger, player) {
			const cards = event.cost_data;
			await player.gain(cards, "gain2");
		},
	},
	stdyuanzhuo: {
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.stdyuanzhuo.filterTarget(void 0, player, target));
		},
		filterTarget(card, player, target) {
			return target != player && target.countDiscardableCards(player, "he");
		},
		async content(event, trigger, player) {
			const { target } = event;
			await player.discardPlayerCard(target, "he", true);
			const card = get.autoViewAs({ name: "huogong", isCard: true });
			if (target.canUse(card, player, true, false)) {
				await target.useCard(card, player, false);
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					return -get.effect(target, { name: "guohe_copy2" }, player, player);
				},
			},
		},
	},
	//王美人
	stdbizun: {
		enable: ["chooseToUse"],
		usable: 1,
		onChooseToUse(event) {
			const player = event.player;
			if (!event.stdbizun) {
				const list = get.inpileVCardList(info => {
					if (!["sha", "shan"].includes(info[2])) {
						return false;
					}
					return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
				});
				event.set("stdbizun", list);
			}
		},
		hiddenCard(player, name) {
			return ["sha", "shan"].includes(name) && player.countCards("hes", card => get.type(card, player) == "equip");
		},
		filter(event, player) {
			return player.countCards("hes", card => get.type(card, player) == "equip") && event.stdbizun.length > 0;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("避尊", [event.stdbizun, "vcard"]);
			},
			filter(button) {
				return get
					.event()
					.getParent()
					.filterCard(get.autoViewAs({ name: button.link[2], nature: button.link[3] }, "unsure"), get.player(), get.event().getParent());
			},
			check(button) {
				const player = get.player();
				return player.getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3] }, "unsure"));
			},
			backup(links, player) {
				return {
					popname: true,
					filterCard(card, player) {
						return get.type(card, player) === "equip";
					},
					selectCard: 1,
					check(card) {
						return 7 - get.value(card);
					},
					position: "hes",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					log: false,
					async precontent(event, trigger, player) {
						player.logSkill("stdbizun");
						player
							.when({ player: "useCardAfter" })
							.filter(evt => evt.getParent() == event.getParent())
							.step(async (event, trigger, player) => {
								const target = game.findPlayer(targetx => targetx.canMoveCard() && targetx.isMaxHandcard(true));
								if (target) {
									await target.moveCard();
								}
							});
					},
				};
			},
			prompt(links, player) {
				return `将一张装备牌当做${get.translation(links[0][3]) || ""}${get.translation(links[0][2])}使用`;
			},
		},
	},
	stdhuangong: {
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (player.countCards("ej")) {
				return false;
			}
			const evt = event.getl(player);
			return evt?.es?.length || evt.js?.length;
		},
		forced: true,
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	//庞林
	stdzhuying: {
		trigger: { global: "damageBegin3" },
		filter(event, player) {
			return event.player != player && !event.hasNature() && !event.player.isLinked();
		},
		check(event, player) {
			return get.effect(event.player, { name: "tiesuo" }, player, player) > 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player;
			await target.link(true);
		},
	},
	stdzhongshi: {
		forced: true,
		trigger: { source: "damageBegin1" },
		filter(event, player) {
			return player.isLinked() != event.player.isLinked();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.num++;
		},
	},
	//黄崇
	stdjuxian: {
		trigger: { global: "gainBefore" },
		filter(event, player) {
			return event.player != player && event.cards.some(card => get.owner(card) == player && "he".includes(get.position(card)));
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.cancel();
		},
		mod: {
			cardGiftable(card, player, target) {
				if (player != target && get.type(card, null, false) != "equip") {
					return false;
				}
			},
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (card.name == "shunshou") {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	stdlijun: {
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target.countCards("h"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, player.getHp()], (card, player, target) => {
					return target.countCards("h");
				})
				.set("ai", target => {
					const player = get.player(),
						att = get.attitude(player, target);
					if (att > 0) {
						return target.countCards("h", card => target.hasValueTarget(card, true, false));
					}
					return true;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			for (const target of targets.sortBySeat()) {
				const result = await player.choosePlayerCard(target, `励军：请展示${get.translation(target)}一张手牌`, "h", true).forResult();
				if (result?.cards?.length) {
					const card = result.cards[0];
					await player.showCards([card], `${get.translation(target)}被展示的牌`);
					let resultx;
					if (target.hasUseTarget(card, true, false)) {
						resultx = await target.chooseUseTarget(`励军：使用${get.translation(card)}或者取消并弃置之`, card, false).forResult();
					} else {
						resultx = { bool: false };
					}
					if (!resultx.bool) {
						await target.modedDiscard(card);
					}
				}
			}
		},
	},
};
