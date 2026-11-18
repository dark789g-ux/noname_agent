import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdaocai" | "stdduwu" | "stdzhuan" | "stdsidi" | "stdbingzheng" | "stdduliang" | "stdzhennan" | "stdshuyong" | "stdduanbi" | "stdlirang" | "stdhuoshui" | "stdqingcheng" | "stdmumu" | "stdmeibu">} */
export const groupSkills = {
	//诸葛恪
	stdaocai: {
		audio: "aocai",
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return !player.countCards("h");
		},
		async cost(event, trigger, player) {
			const cards = get.cards(2, true);
			const result = await player
				.chooseButton(["傲才：获得其中一张牌", cards])
				.set("ai", button => {
					return get.value(button.link);
				})
				.forResult();
			event.result = {
				bool: result?.bool,
				cost_data: result?.links,
			};
		},
		async content(event, trigger, player) {
			await player.gain(event.cost_data, "gain2");
		},
	},
	stdduwu: {
		audio: "duwu",
		inherit: "duwu",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") && game.hasPlayer(current => get.info("stdduwu").filterTarget(null, player, current));
		},
		filterCard: true,
		selectCard: -1,
		position: "h",
		filterTarget(card, player, target) {
			return player.inRange(target);
		},
		check: card => 1,
		async content(event, trigger, player) {
			await event.target.damage("nocard");
		},
		ai: {
			damage: true,
			order(item, player) {
				if (
					game.hasPlayer(current => player.inRange(current) && get.effect(current, "stdduwu", player, player) > 0) &&
					!player.hasCard(card => player.hasValueTarget(card) > 0, "h")
				) {
					return 10;
				}
				return 2;
			},
			result: {
				target(player, target) {
					return get.damageEffect(target, player);
				},
			},
			threaten: 1.5,
			expose: 0.3,
		},
	},
	//孟达
	stdzhuan: {
		audio: "dclibang",
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return player.getHistory("damage").indexOf(event) == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			await player.draw(3);
			const { source } = trigger;
			if (source?.isIn() && player.countGainableCards(source, "he")) {
				await source.gainPlayerCard(player, "he", true);
			}
		},
	},
	//曹真
	stdsidi: {
		audio: "sidi",
		trigger: { global: "respond" },
		frequent: true,
		filter: event => event.card?.name == "sha",
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	//董允
	stdbingzheng: {
		audio: "bingzheng",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target.countDiscardableCards(target, "he"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.countDiscardableCards(target, "he");
				})
				.set("ai", target => {
					const player = get.player();
					if (!target.countCards("e") && target.countCards("h") - 1 == target.getHp()) {
						return get.effect(target, { name: "guohe_copy2" }, player, player);
					}
					return get.effect(target, { name: "guohe_copy2" }, player, player) + get.effect(player, { name: "losehp" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (target.countDiscardableCards(target, "he")) {
				await target.chooseToDiscard("he", true);
			}
			if (target.countCards("h") != target.getHp()) {
				await player.loseHp();
			}
		},
	},
	stdduliang: {
		trigger: { player: "damageEnd" },
		filter: event => event.num > 0,
		async content(event, trigger, player) {
			await player.draw();
			if (player.countCards("h") == player.getHp() && player.isDamaged()) {
				await player.recover();
			}
		},
	},
	//鲍三娘
	stdzhennan: {
		audio: "xinfu_zhennan",
		trigger: { global: "phaseZhunbeiBegin" },
		filter(event, player) {
			return event.player != player && player.countDiscardableCards(player, "h");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt2(event.skill, trigger.player))
				.set("ai", card => {
					const { goon } = get.event();
					return goon ? 6.5 - get.value(card) : 0;
				})
				.set("goon", get.attitude(player, trigger.player) > 0)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const { player: target } = trigger;
			player.addTempSkill(event.name + "_effect");
			player.markAuto(event.name + "_effect", [target]);
			target.addTempSkill(event.name + "_ai");
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { global: "useCardAfter" },
				filter(event, player) {
					return player.getStorage("stdzhennan_effect").includes(event.player);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.unmarkAuto(event.name, [trigger.player]);
					if (get.color(trigger.card) == "red") {
						const cards = trigger.cards?.filterInD("od");
						if (cards.length) {
							player.logSkill(event.name, trigger.player);
							await trigger.player.gain(cards, "gain2");
						}
					}
				},
			},
			ai: {
				charlotte: true,
				mod: {
					aiOrder(player, card, num) {
						if (get.itemtype(card) == "card" && get.color(card) == "red" && !["equip", "delay"].includes(get.type(card))) {
							return num + 10;
						}
					},
				},
				trigger: { player: "useCard1" },
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
				},
			},
		},
	},
	stdshuyong: {
		audio: "meiyong",
		trigger: { global: "useCard" },
		frequent: true,
		filter(event, player) {
			const target = event.player,
				last = target.getLastUsed(1);
			if (target == player || _status.currentPhase != target) {
				return false;
			}
			return last?.card?.name == event.card.name;
		},
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	//刘巴
	stdduanbi: {
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		check(event, player) {
			if (player.countCards("h") <= 2) {
				return true;
			}
			const val = player.getCards("h").reduce((sum, card) => sum + get.value(card), 0);
			return val <= 16;
		},
		async content(event, trigger, player) {
			await player.modedDiscard(player.getCards("h"));
			if (game.countPlayer() < 2) {
				return;
			}
			const result = await player
				.chooseTarget(`锻币：令两名角色各摸两张牌`, 2, true)
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "draw" }, player, player) * 2;
				})
				.forResult();
			if (result?.targets?.length) {
				const targets = result.targets.sortBySeat();
				player.line(targets);
				await game.asyncDraw(targets, 2);
			}
		},
	},
	//孔融
	stdlirang: {
		getCards(event) {
			return game
				.getGlobalHistory("everything", evt => {
					if (!evt.cards?.length) {
						return false;
					}
					return (evt.name === "cardsDiscard" || evt.position == ui.discardPile) && evt.getParent("phaseDiscard") == event;
				})
				.reduce((cards, evt) => cards.addArray(evt.cards.filterInD("d")), [])
				.filter(card => get.color(card) == "red");
		},
		trigger: { global: "phaseDiscardEnd" },
		filter(event, player) {
			return event.player != player && player.countCards("he");
		},
		logTarget: "player",
		async cost(event, trigger, player) {
			const { player: target } = trigger;
			const cards = get.info(event.skill).getCards(trigger);
			let str = `交给${get.translation(target)}一张牌`;
			if (cards.length) {
				str += `然后获得${get.translation(cards)}`;
			}
			event.result = await player
				.chooseCard(get.prompt(event.skill, target), "he", str)
				.set("ai", card => {
					const { player, targetx, cardsx } = get.event();
					const att = get.attitude(player, targetx);
					if (att > 0 && cardsx.length) {
						return 8 - get.value(card);
					}
					if (att <= 0 && cardsx.length >= 2) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("targetx", target)
				.set("cardsx", cards)
				.forResult();
		},
		async content(event, trigger, player) {
			await player.give(event.cards, trigger.player);
			const cards = get.info(event.name).getCards(trigger);
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
		},
	},
	//邹氏
	stdhuoshui: {
		audio: "rehuoshui",
		trigger: { global: "damageBegin3" },
		filter(event, player) {
			return event.player != player && event.player.countCards("j");
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.num++;
		},
	},
	stdqingcheng: {
		audio: "reqingcheng",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (player.hasJudge("lebu")) {
				return false;
			}
			return player.countCards("hes", card => get.info("stdqingcheng").filterCard(card, player)) > 1;
		},
		filterCard(card, player) {
			return get.type2(card, player) != "trick" && get.color(card, player) == "red";
		},
		position: "he",
		selectCard: 2,
		filterTarget(card, player, target) {
			return target != player && target.canAddJudge("lebu");
		},
		filterOk() {
			const {
					cards,
					targets: [target],
				} = ui.selected,
				player = get.player(),
				canAdd = (current, card) => {
					const lebu = get.autoViewAs({ name: "lebu", cards: [card] }, [card]);
					return lib.filter.judge(lebu, player, current);
				};
			return canAdd(player, cards[0]) && canAdd(target, cards[1]);
		},
		check(card) {
			return 8 - get.value(card);
		},
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards } = event;
			const targets = [player, event.target].sortBySeat();
			for (let i = 0; i < cards.length; i++) {
				const card = get.autoViewAs({ name: "lebu", cards: [cards[i]] }),
					target = targets[i];
				if ((player == target && player.canAddJudge(card)) || (player != target && player.canUse(card, target))) {
					await player.useCard(card, [cards[i]], targets[i]);
				}
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					return get.effect(target, { name: "lebu" }, player, target);
				},
			},
		},
	},
	//孙鲁育
	stdmumu: {
		audio: "mumu",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countDiscardableCards(player, "h");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt2(event.skill), "h")
				.set("ai", card => {
					if (get.event().goon) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("goon", player.canMoveCard(true, true))
				.forResult();
		},
		async content(event, trigger, player) {
			if (player.canMoveCard(null, true)) {
				await player.moveCard().set("nojudge", true);
			}
		},
	},
	stdmeibu: {
		audio: "meibu",
		trigger: { global: "useCard" },
		filter(event, player) {
			return event.player.countDiscardableCards(event.player, "h") && event.player.getEquips(1).length && event.card?.name == "sha";
		},
		logTarget: "player",
		check: (event, player) => get.attitude(player, event.player) < 0,
		async content(event, trigger, player) {
			const { player: target } = trigger;
			if (target.countDiscardableCards(target, "h")) {
				await target.chooseToDiscard("h", true);
			}
		},
	},
};
