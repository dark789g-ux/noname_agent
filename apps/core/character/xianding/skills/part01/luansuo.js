import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "luansuo" | "fengliao" | "kunyu">} */
export const groupSkills = {
	//神庞统
	//复活神将
	luansuo: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		filter(event, player) {
			return game.hasPlayer(target => target.countCards("h"));
		},
		forced: true,
		logTarget(event, player) {
			return game.filterPlayer(target => target.countCards("h"));
		},
		async content(event, trigger, player) {
			for (const target of event.targets) {
				target.addTempSkill("luansuo_debuff");
				target.addGaintag(target.getCards("h"), "luansuo_debuff");
			}
		},
		global: "luansuo_discard",
		subSkill: {
			discard: {
				mod: {
					cardDiscardable(card) {
						if (_status.currentPhase?.hasSkill("luansuo") && get.position(card) === "h") {
							return false;
						}
					},
					canBeDiscarded(card) {
						if (_status.currentPhase?.hasSkill("luansuo") && get.position(card) === "h") {
							return false;
						}
					},
				},
			},
			debuff: {
				mod: {
					cardname(card) {
						if (get.itemtype(card) !== "card" || get.position(card) !== "h") {
							return;
						}
						if (card.hasGaintag("luansuo_debuff")) {
							return "tiesuo";
						}
					},
					cardnature(card) {
						if (get.itemtype(card) !== "card" || get.position(card) !== "h") {
							return;
						}
						if (card.hasGaintag("luansuo_debuff")) {
							return false;
						}
					},
					aiOrder(player, card, num) {
						if (num > 0 && get.name(card, player) === "huogong") {
							return 0;
						}
					},
					aiValue(player, card, num) {
						if (num > 0 && get.name(card, player) === "huogong") {
							return 0.01;
						}
					},
					aiUseful(player, card, num) {
						if (num > 0 && get.name(card, player) === "huogong") {
							return 0;
						}
					},
				},
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				trigger: {
					global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter", "cardsDiscardAfter"],
				},
				filter(event, player) {
					return player.hasCard(card => {
						if (!card.hasGaintag("luansuo_debuff")) {
							return false;
						}
						return event.getd().some(cardx => get.suit(card) === get.suit(cardx));
					}, "h");
				},
				silent: true,
				firstDo: true,
				async content(event, trigger, player) {
					const cards = player.getCards("h", card => {
						if (!card.hasGaintag(event.name)) {
							return false;
						}
						return trigger.getd().some(cardx => get.suit(card) === get.suit(cardx));
					});
					player.removeGaintag(event.name, cards);
				},
			},
		},
	},
	fengliao: {
		audio: 2,
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			get.info(skill).init(player, skill);
		},
		init(player, skill) {
			player.addTip(skill, `${get.translation(skill)} ${player.storage[skill] ? "伤害" : "摸牌"}`);
		},
		onremove(player, skill) {
			player.removeTip(skill);
		},
		mark: true,
		marktext: "☯",
		intro: { content: storage => `你使用牌指定唯一目标后，你${storage ? "对其造成1点火焰伤害" : "令其摸一张牌"}` },
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.targets.length == 1;
		},
		forced: true,
		logTarget: "target",
		async content(event, trigger, player) {
			player.changeZhuanhuanji(event.name);
			const { target } = trigger;
			if (player.storage[event.name]) {
				await target.draw();
			} else {
				await target.damage("fire");
			}
		},
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object" && num > 0) {
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
					if (
						(() => {
							if (
								!(() => {
									if (range[1] !== -1) {
										return range[1] <= 1;
									}
									return game.countPlayer(i => player.canUse(card, i)) === 1;
								})()
							) {
								return false;
							}
							let targets = game.filterPlayer(i => player.canUse(card, i));
							if (!targets.length) {
								return false;
							}
							_status._fengliao_check = true;
							targets.sort((a, b) => get.effect(b, card, player, player) - get.effect(a, card, player, player));
							delete _status._fengliao_check;
							return (player.storage.fengliao ? get.damageEffect(targets[0], player, player, "fire") : get.effect(targets[0], { name: "draw" }, player, player)) > 0;
						})()
					) {
						return num + 15;
					}
				}
			},
		},
		ai: {
			fireAttack: true,
			effect: {
				player(card, player, target) {
					if (_status._fengliao_check) {
						return;
					}
					if (typeof card !== "object" || !player || !target) {
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
					if (
						(() => {
							if (range[1] !== -1) {
								return !ui.selected.targets.length;
							}
							return !game.hasPlayer(i => i !== target && player.canUse(card, i));
						})()
					) {
						return [
							1,
							(() => {
								_status._fengliao_check = true;
								const num = player.storage.fengliao ? get.sgn(get.damageEffect(target, player, player, "fire")) * 2 : get.sgn(get.effect(target, { name: "draw" }, player, player));
								delete _status._fengliao_check;
								return num;
							})(),
						];
					}
				},
			},
		},
	},
	kunyu: {
		audio: 2,
		trigger: { global: "_saveAfter" },
		filter(event, player) {
			if (event.dying != player || !player.isDying()) {
				return false;
			}
			return get.cardPile2(card => get.tag(card, "fireDamage") && get.is.damageCard(card));
		},
		forced: true,
		async content(event, trigger, player) {
			let card = get.cardPile2(card => card.name == "huogong", "bottom");
			if (!card) {
				card = get.cardPile2(card => get.tag(card, "fireDamage") && card.name == "sha", "bottom");
			}
			if (!card) {
				card = get.cardPile2(card => get.tag(card, "fireDamage") && get.is.damageCard(card), "bottom");
			}
			if (!card) {
				return;
			}
			await game.cardsGotoSpecial(card);
			game.log(player, "将", card, "移出游戏");
			await player.recoverTo(1);
		},
		group: "kunyu_debuff",
		subSkill: {
			debuff: {
				audio: "kunyu",
				trigger: {
					global: "phaseBefore",
					player: ["gainMaxHpBegin", "loseMaxHpBegin", "enterGame"],
				},
				forced: true,
				filter(event, player) {
					let bool = player.maxHp !== 1;
					if (event.name === "phase") {
						return bool && game.phaseNumber === 0;
					}
					return true;
				},
				async content(event, trigger, player) {
					if (["gainMaxHp", "loseMaxHp"].includes(trigger.name)) {
						trigger.cancel();
					} else {
						player.maxHp = 1;
						player.update();
					}
				},
			},
		},
	},
};
