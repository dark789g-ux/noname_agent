import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "nzry_shenshi" | "xinjushou" | "xinjiewei" | "jianchu">} */
export const groupSkills = {
	nzry_shenshi: {
		audio: ["nzry_shenshi_11.mp3", "nzry_shenshi_12.mp3"],
		mark: true,
		locked: false,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage, player, skill) {
				if (storage) {
					return "其他角色对你造成伤害后，你可以观看该角色的手牌，然后交给其一张牌，当前角色回合结束时，若此牌仍在该角色的手牌区或装备区，你将手牌摸至四张";
				}
				return "出牌阶段限一次，你可以将一张牌交给一名手牌数最多的角色，然后对其造成1点伤害，若该角色因此死亡，则你可以令一名角色将手牌摸至四张";
			},
		},
		enable: "phaseUse",
		trigger: { global: "damageSource" },
		filter(event, player) {
			if (!player.countCards("he")) {
				return false;
			}
			if (event.name == "chooseToUse") {
				return !player.storage.nzry_shenshi && !player.hasSkill("nzry_shenshi_used", null, null, false) && game.hasPlayer(current => get.info("nzry_shenshi").filterTarget(null, player, current));
			}
			return event.source?.isIn() && event.source != player && event.player == player && player.storage.nzry_shenshi;
		},
		discard: false,
		line: true,
		lose: false,
		delay: false,
		position: "he",
		filterCard: true,
		filterTarget(card, player, target) {
			return target != player && !game.hasPlayer(current => current != player && current.countCards("h") > target.countCards("h"));
		},
		check(card) {
			if (get.position(card) == "h") {
				return 1;
			}
			return 5 - get.value(card);
		},
		async cost(event, trigger, player) {
			const { source } = trigger;
			const { bool } = await player
				.chooseBool(get.prompt(event.name.slice(0, -5), source))
				.set("choice", (source.countCards("h") <= source.getHp() && player.countCards("h") < 4 && !source.hasSkillTag("nogain")) || get.attitude(player, source) > 0)
				.set("prompt2", "其他角色对你造成伤害后，你可以观看该角色的手牌，然后交给其一张牌，当前角色回合结束时，若此牌仍在该角色的手牌区或装备区，你将手牌摸至四张")
				.forResult();
			event.result = {
				bool: bool,
				targets: [source],
			};
		},
		prompt: "出牌阶段限一次，你可以将一张牌交给一名手牌数最多的角色，然后对其造成1点伤害，若该角色因此死亡，则你可以令一名角色将手牌摸至四张",
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.changeZhuanhuanji(event.name);
			if (!trigger) {
				player.addTempSkill(event.name + "_used", "phaseUseAfter");
				await player.give(event.cards, target);
				await target.damage("nocard");
				if (
					!game.getGlobalHistory("everything", evt => {
						if (evt.name != "die" || evt.player != target) {
							return false;
						}
						return evt.reason?.getParent() == event;
					}).length ||
					!game.hasPlayer(current => current.countCards("h") < 4)
				) {
					return;
				}
				const result = await player
					.chooseTarget("令一名角色将手牌摸至四张", (card, player, target) => {
						return target.countCards("h") < 4;
					})
					.set("ai", target => {
						return get.attitude(player, target);
					})
					.forResult();
				if (result.bool) {
					player.line(result.targets);
					await result.targets[0].drawTo(4);
				}
			} else {
				await player.viewHandcards(target);
				const result = await player
					.chooseToGive(target, "he", true, `交给${get.translation(target)}一张牌`)
					.set("ai", card => {
						return 5 - get.value(card);
					})
					.forResult();
				if (result.bool) {
					const card = result.cards[0];
					target.addGaintag(result.cards, event.name);
					player
						.when({ global: "phaseJieshuBegin" })
						.filter(evt => evt.getParent() == trigger.getParent("phase", true) && target.getCards("he").includes(card) && player.countCards("h") < 4)
						.step(async () => {
							target.removeGaintag(event.name);
							await player.drawTo(4);
						});
				}
			}
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					return get.damageEffect(target, player, target);
				},
			},
		},
		subSkill: { used: { charlotte: true } },
	},
	xinjushou: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		async content(event, trigger, player) {
			await player.draw(4);
			await player.turnOver();
			const result = await player
				.chooseCard("h", true, "弃置一张手牌，若以此法弃置的是装备牌，则你改为使用之")
				.set("ai", function (card) {
					if (get.type(card) == "equip") {
						return 5 - get.value(card);
					}
					return -get.value(card);
				})
				.set("filterCard", lib.filter.cardDiscardable)
				.forResult();
			if (result.bool && result.cards.length) {
				const card = result.cards[0];
				if (get.type(card) == "equip" && player.hasUseTarget(card)) {
					player.chooseUseTarget(card, true, "nopopup");
				} else {
					player.discard(card);
				}
			}
		},
	},
	xinjiewei: {
		audio: 2,
		enable: "chooseToUse",
		filterCard: true,
		position: "e",
		viewAs: { name: "wuxie" },
		filter(event, player) {
			return player.countCards("e") > 0;
		},
		viewAsFilter(player) {
			return player.countCards("e") > 0;
		},
		prompt: "将一张装备区内的牌当无懈可击使用",
		check(card) {
			return 8 - get.equipValue(card);
		},
		threaten: 1.2,
		group: "xinjiewei_move",
		subSkill: {
			move: {
				trigger: { player: "turnOverEnd" },
				audio: "jiewei",
				filter(event, player) {
					return !player.isTurnedOver() && player.canMoveCard();
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseToDiscard("he", get.prompt("xinjiewei"), "弃置一张牌并移动场上的一张牌", lib.filter.cardDiscardable)
						.set("ai", function (card) {
							if (!_status.event.check) {
								return 0;
							}
							return 7 - get.value(card);
						})
						.set("check", player.canMoveCard(true))
						.forResult();
				},
				async content(event, trigger, player) {
					await player.moveCard(true);
				},
			},
		},
	},
	jianchu: {
		audio: 2,
		audioname: ["re_pangde"],
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && event.target.countDiscardableCards(player, "he") > 0;
		},
		preHidden: true,
		check(event, player) {
			return get.attitude(player, event.target) <= 0;
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const result = await player
				.discardPlayerCard(trigger.target, get.prompt("jianchu", trigger.target), true)
				.set("ai", function (button) {
					if (!_status.event.att) {
						return 0;
					}
					if (get.position(button.link) == "e") {
						if (get.subtype(button.link) == "equip2") {
							return 5 * get.value(button.link);
						}
						return get.value(button.link);
					}
					return 1;
				})
				.set("att", get.attitude(player, trigger.target) <= 0)
				.forResult();
			if (result.bool && result.links && result.links.length) {
				if (get.type(result.links[0], null, result.links[0].original == "h" ? player : false) == "equip") {
					trigger.getParent().directHit.add(trigger.target);
				} else if (trigger.cards) {
					const list = [];
					for (let i = 0; i < trigger.cards.length; i++) {
						if (get.position(trigger.cards[i], true) == "o") {
							list.push(trigger.cards[i]);
						}
					}
					if (list.length) {
						trigger.target.gain(list, "gain2", "log");
					}
				}
			}
		},
		ai: {
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "directHit_ai") {
					return (
						arg.card.name == "sha" &&
						arg.target.countCards("e", function (card) {
							return get.value(card) > 1;
						}) > 0
					);
				}
				if (arg && arg.name == "sha" && arg.target.getEquip(2)) {
					return true;
				}
				return false;
			},
		},
	},
};
