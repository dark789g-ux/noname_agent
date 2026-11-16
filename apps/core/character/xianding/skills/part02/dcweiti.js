import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcweiti" | "dcyuanrong" | "dczsshuhe" | "dcjilie">} */
export const groupSkills = {
	//吴质
	dcweiti: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("伪涕", [
					[
						["damage", "令一名角色受到1点伤害，获得两张与所有手牌点数均不同的牌"],
						["recover", "令一名角色回复1点体力，然后弃置两张点数不同的牌"],
					],
					"textbutton",
				]);
			},
			check(button) {
				const player = get.player();
				if (button.link == "recover") {
					return Math.max(
						...game.filterPlayer().map(target => {
							const sgn = get.sgnAttitude(player, target);
							return get.recoverEffect(target, player, player) - sgn * Math.min(2, target.countCards("he"));
						})
					);
				} else {
					return Math.max(
						...game.filterPlayer().map(target => {
							const sgn = get.sgnAttitude(player, target);
							return get.damageEffect(target, player, player) + sgn * 2;
						})
					);
				}
			},
			backup(links, player) {
				return {
					audio: "dcweiti",
					choice: links[0],
					filterTarget: true,
					ai1: () => 1,
					ai2(target) {
						const { choice } = get.info("dcweiti_backup");
					},
					async content(event, trigger, player) {
						const {
							targets: [target],
						} = event;
						const { choice } = get.info(event.name);
						if (choice == "damage") {
							await target.damage();
							const nums = target.getCards("h").map(card => get.number(card, target));
							let cards = [];
							while (cards.length < 2) {
								const card = get.cardPile2(card => !nums.includes(get.number(card, target)) && !cards.includes(card));
								if (card) {
									cards.push(card);
								} else {
									break;
								}
							}
							if (cards.length) {
								await target.gain({ cards, animate: "gain2" });
							}
						}
						if (choice == "recover") {
							await target.recover();
							const num = Math.min(
								2,
								target
									.getDiscardableCards(target, "he")
									.map(card => get.number(card, target))
									.toUniqued().length
							);
							if (!num) {
								return;
							}
							await target.chooseToDiscard({
								selectCard: num,
								forced: true,
								prompt: `伪涕：弃置${get.cnNumber(num)}张点数不同的牌`,
								position: "he",
								filterCard(card) {
									const player = get.player();
									return !ui.selected.cards?.some(cardx => get.number(cardx, player) == get.number(card, player));
								},
								complexCard: true,
							});
						}
					},
				};
			},
			prompt(links, player) {
				if (links[0] == "damage") {
					return "伪涕：令一名角色受到1点伤害，获得两张与所有手牌点数均不同的牌";
				} else {
					return "伪涕：令一名角色回复1点体力，然后弃置两张点数不同的牌";
				}
			},
		},
		/*async content(event, trigger, player) {
			const target = event.target;
			const result = await target
				.chooseControl("受到伤害", "回复体力")
				.set("prompt", "伪涕：请选择一项")
				.set("choiceList", ["受到1点伤害，然后获得两张点数与你所有手牌均不同的牌", "回复1点体力，然后弃置两张点数不相同的牌"])
				.set("ai", () => {
					const player = get.player();
					let eff1 = get.recoverEffect(player, player) - Math.min(2, player.countCards("he")),
						eff2 = 2 + get.damageEffect(player, player);
					return eff1 > eff2 ? "回复体力" : "受到伤害";
				})
				.forResult();
			if (result.control == "受到伤害") {
				await target.damage();
				const nums = target.getCards("h").map(card => get.number(card, target));
				let cards = [];
				while (cards.length < 2) {
					const card = get.cardPile2(card => !nums.includes(get.number(card, target)) && !cards.includes(card));
					if (card) {
						cards.push(card);
					} else {
						break;
					}
				}
				if (cards.length) {
					await target.gain(cards, "gain2");
				}
			} else {
				await target.recover();
				const num = Math.min(
					2,
					target
						.getCards("he")
						.map(card => get.number(card, target))
						.toUniqued().length
				);
				await target
					.chooseToDiscard(num, true, `弃置${get.cnNumber(num)}张点数不同的牌`, "he")
					.set("filterCard", card => {
						const player = get.player();
						return !ui.selected.cards?.some(cardx => get.number(cardx, player) == get.number(card, player));
					})
					.set("complexCard", true);
			}
		},*/
		subSkill: {
			backup: {},
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
		},
	},
	dcyuanrong: {
		getCards() {
			return get.discarded().filterInD("d");
		},
		audio: 2,
		trigger: { player: "phaseEnd" },
		filter(event, player) {
			const cards = get.info("dcyuanrong").getCards();
			return ["black", "red"].some(color => cards.some(card => get.color(card) == color));
		},
		direct: true,
		async content(event, trigger, player) {
			let cards = get.info("dcyuanrong").getCards();
			const blackCards = cards.filter(card => get.color(card) == "black");
			if (blackCards.length) {
				const vcards = get.inpileVCardList(info => {
					if (get.type(info[2]) != "trick") {
						return false;
					}
					return blackCards.some(card => {
						const cardx = get.autoViewAs({ name: info[2] }, [card]);
						return player.hasUseTarget(cardx, true, true);
					});
				});
				if (vcards.length) {
					const result = await player
						.chooseButton([`###圆融：你可以将本回合进入弃牌堆的一张黑色牌当任意普通锦囊牌使用###弃牌堆`, blackCards, "###可转化锦囊牌###", [vcards, "vcard"]], 2)
						.set("filterButton", button => {
							if (!Array.isArray(button.link)) {
								return ui.selected.buttons.length == 0;
							}
							if (ui.selected.buttons.length != 1) {
								return false;
							}
							const cardx = get.autoViewAs(
								{ name: button.link[2] },
								ui.selected.buttons.map(i => i.link)
							);
							return get.player().hasUseTarget(cardx, true, true) && ui.selected.buttons.length;
						})
						.set("complexSelect", true)
						.set("ai", button => {
							if (ui.selected.buttons.length == 0) {
								return Math.random();
							}
							if (!Array.isArray(button.link)) {
								return 0;
							}
							const cardx = get.autoViewAs({ name: button.link[2] });
							return get.player().getUseValue(cardx, true, true);
						})
						.forResult();
					if (result?.bool) {
						const cardsx = [result.links[0]];
						const name = result.links[1][2];
						const card = get.autoViewAs({ name }, cardsx);
						const next = player.chooseUseTarget(card, true, cardsx);
						if (!event.logged) {
							event.logged = true;
							next.set("logSkill", event.name);
						}
						await next;
					}
				}
			}
			cards = get.info("dcyuanrong").getCards();
			const redCards = cards.filter(card => get.color(card) == "red");
			if (redCards.length) {
				const vcards = get.inpileVCardList(info => {
					if (get.type(info[2]) != "basic") {
						return false;
					}
					return redCards.some(card => {
						const cardx = get.autoViewAs({ name: info[2] }, [card]);
						return player.hasUseTarget(cardx, true, true);
					});
				});
				if (vcards.length) {
					const result = await player
						.chooseButton([`###圆融：你可以将本回合进入弃牌堆的一张红色牌当任意基本牌使用###弃牌堆`, redCards, "###可转化基本牌###", [vcards, "vcard"]], 2)
						.set("filterButton", button => {
							if (!Array.isArray(button.link)) {
								return ui.selected.buttons.length == 0;
							}
							if (ui.selected.buttons.length != 1) {
								return false;
							}
							const cardx = get.autoViewAs(
								{ name: button.link[2] },
								ui.selected.buttons.map(i => i.link)
							);
							return get.player().hasUseTarget(cardx, true, true) && ui.selected.buttons.length;
						})
						.set("complexSelect", true)
						.set("ai", button => {
							if (ui.selected.buttons.length == 0) {
								return Math.random();
							}
							if (!Array.isArray(button.link)) {
								return 0;
							}
							const cardx = get.autoViewAs({ name: button.link[2] });
							return get.player().getUseValue(cardx, true, true);
						})
						.forResult();
					if (result?.bool) {
						const cardsx = [result.links[0]];
						const card = get.autoViewAs({ name: result.links[1][2], nature: result.links[1][3] }, cardsx);
						const next = player.chooseUseTarget(card, true, cardsx);
						if (!event.logged) {
							event.logged = true;
							next.set("logSkill", event.name);
						}
						await next;
					}
				}
			}
		},
	},
	//朱铄
	dczsshuhe: {
		audio: 2,
		trigger: { global: "useCard" },
		usable: 1,
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			return get.is.damageCard(event.card);
		},
		logTarget: "player",
		check(event, player) {
			if (get.attitude(player, event.player) > 0) {
				return true;
			}
			let eff = 2;
			if (event.targets) {
				for (let target of event.targets) {
					eff += get.effect(target, event.card, event.player, player);
				}
			}
			return eff <= 0;
		},
		async content(event, trigger, player) {
			const card = get.cardPile2(card => card.name == "jiu");
			if (card) {
				await player.gain(card, "gain2");
			}
			let eff = -1;
			if (trigger.targets) {
				for (let target of trigger.targets) {
					eff += get.effect(target, trigger.card, trigger.player, trigger.player);
				}
			}
			const result = await trigger.player
				.chooseBool()
				.set("prompt", "疏和")
				.set("prompt2", `令${get.translation(trigger.card)}无效并视为使用一张【酒】，或点取消令${get.translation(player)}摸一张牌`)
				.set("choice", eff < 0)
				.forResult();
			if (result.bool) {
				trigger.targets.length = 0;
				trigger.all_excluded = true;
				game.log(trigger.card, "被无效了");
				const card = { name: "jiu", isCard: true };
				if (trigger.player.hasUseTarget(card)) {
					const next = trigger.player.chooseUseTarget(card, false, true);
					event.next.remove(next);
					trigger.after.push(next);
				}
			} else {
				await player.draw();
			}
		},
	},
	dcjilie: {
		audio: 2,
		enable: "phaseUse",
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		selectCard() {
			return get.player().getHp();
		},
		complexCard: true,
		complexSelect: true,
		usable: 1,
		filter(event, player) {
			return player.getHp() > 0 && player.countCards("he") >= player.getHp();
		},
		check(card) {
			const player = get.player(),
				value = get.value(card);
			if (ui.selected.cards?.some(cardx => get.suit(cardx, player) == get.suit(card, player))) {
				return 3 - value;
			}
			return 7 - value;
		},
		async content(event, trigger, player) {
			let num = event.cards.map(card => get.suit(card, player)).toUniqued().length * 2;
			while (num > 0) {
				num--;
				const judgeEvent = player.judge(card => (card.name == "sha" ? 10 : -1));
				judgeEvent.set("callback", async event => {
					if (event.card?.name == "sha" && player.hasUseTarget(event.card)) {
						const next = player.chooseUseTarget(event.card, false);
						next.set("oncard", () => {
							_status.event.baseDamage += player.getHistory("useCard", evt => evt.card.name == "sha").length;
						});
						await next;
					}
				});
				await judgeEvent;
			}
		},
		ai: {
			order: 9,
			result: {
				player(player, target) {
					if (!player.hasUseTarget({ name: "sha" }, null, false)) {
						return 0;
					}
					return 1;
				},
			},
		},
	},
};
