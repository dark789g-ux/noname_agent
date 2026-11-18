import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rejunxingSkills = {
	rejunxing: {
		enable: "phaseUse",
		audio: 2,
		usable: 1,
		filterCard: lib.filter.cardDiscardable,
		selectCard: [1, Infinity],
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		check(card) {
			if (ui.selected.cards.length) {
				return -1;
			}
			return 6 - get.value(card);
		},
		filterTarget(card, player, target) {
			return player != target;
		},
		allowChooseAll: true,
		async content(event, trigger, player) {
			const { target, cards } = event;
			// step 0
			const result = await target
				.chooseToDiscard(cards.length, "弃置" + get.cnNumber(cards.length) + "张牌并失去1点体力，或点取消将武将牌翻面并摸" + get.cnNumber(cards.length) + "张牌", "he")
				.set("ai", function (card) {
					const player = get.event().player;
					if (get.event().cardsx?.length > 3 || player.hasSkillTag("noturn") || player.isTurnedOver() || ((get.name(card) == "tao" || get.name(card) == "jiu") && lib.filter.cardSavable(card, player, player))) {
						return -1;
					}
					if (player.hp <= 1) {
						if (
							cards.length < player.getEnemies().length &&
							player.hasCard(cardx => {
								return (get.name(cardx) == "tao" || get.name(cardx) == "jiu") && lib.filter.cardSavable(cardx, player, player);
							}, "hs")
						) {
							return 7 - get.value(card);
						}
						return -1;
					}
					return 24 - 5 * cards.length - 2 * Math.min(4, player.hp) - get.value(card);
				})
				.set("cardsx", cards)
				.forResult();
			// step 1
			if (!result.bool) {
				await target.turnOver();
				await target.draw(cards.length);
			} else {
				await target.loseHp();
			}
		},
		ai: {
			order: 2,
			threaten: 1.8,
			result: {
				target(player, target) {
					if (target.hasSkillTag("noturn")) {
						return 0;
					}
					if (target.isTurnedOver()) {
						return 2;
					}
					return -1 / (target.countCards("h") + 1);
				},
			},
		},
	},
	rejuece: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return (
					current != player &&
					current.getHistory("lose", function (evt) {
						return evt.cards2 && evt.cards2.length > 0;
					}).length > 0
				);
			});
		},
		async content(event, trigger, player) {
			// step 0
			const result = await player
				.chooseTarget(get.prompt("rejuece"), "对一名本回合失去过牌的其他角色造成1点伤害", function (card, player, target) {
					return _status.event.targets.includes(target);
				})
				.set(
					"targets",
					game.filterPlayer(function (current) {
						return (
							current != player &&
							current.getHistory("lose", function (evt) {
								return evt.cards2 && evt.cards2.length > 0;
							}).length > 0
						);
					})
				)
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				})
				.forResult();
			// step 1
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("rejuece", target);
				await target.damage();
			}
		},
	},
	remieji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h", { type: ["trick", "delay"], color: "black" });
		},
		filterCard(card) {
			return get.color(card) == "black" && get.type(card, "trick") == "trick";
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("he") > 0;
		},
		discard: false,
		delay: false,
		loseTo: "cardPile",
		insert: true,
		visible: true,
		check(card) {
			return 8 - get.value(card);
		},
		async content(event, trigger, player) {
			const { target, cards } = event;
			await player.showCards(cards, `${get.translation(player)}对${get.translation(target)}发动了【${get.translation(event.name)}】`);
			if (
				!target.countCards("he", function (card) {
					if (get.type2(card) == "trick") {
						return true;
					}
					return lib.filter.cardDiscardable(card, target, "remieji");
				})
			) {
				return;
			} else {
				const result = await target
					.chooseCard("he", true, function (card, player) {
						if (get.type2(card) == "trick") {
							return true;
						}
						return lib.filter.cardDiscardable(card, player, "remieji");
					})
					.set("prompt", "选择交给" + get.translation(player) + "一张锦囊牌，或依次弃置两张非锦囊牌。")
					.forResult();
				if (result.cards?.length) {
					const {
						cards: [card],
					} = result;
					if (get.type2(card) == "trick") {
						await target.give(card, player);
					} else {
						await target.discard(card);
						await target.chooseToDiscard("he", true, function (card) {
							return get.type2(card) != "trick";
						});
					}
				}
			}
		},
		ai: {
			order: 9,
			result: {
				target: -1,
			},
		},
	},
	decadelihuo: {
		trigger: { player: "useCard1" },
		filter(event, player) {
			if (event.card.name == "sha" && !game.hasNature(event.card)) {
				return true;
			}
			return false;
		},
		audio: "lihuo",
		prompt2(event) {
			return "将" + get.translation(event.card) + "改为火属性";
		},
		audioname: ["re_chengpu"],
		check(event, player) {
			return (
				event.baseDamage > 1 &&
				game.hasPlayer(function (current) {
					return !event.targets.includes(current) && player.canUse(event.card, current) && get.attitude(player, current) < 0 && !current.hasShan() && get.effect(current, { name: "sha", nature: "fire" }, player, player) > 0;
				})
			);
		},
		async content(event, trigger, player) {
			game.setNature(trigger.card, "fire");
		},
		group: ["decadelihuo2", "decadelihuo3"],
		ai: {
			fireAttack: true,
		},
	},
	decadelihuo2: {
		trigger: { player: "useCard2" },
		sourceSkill: "decadelihuo",
		filter(event, player) {
			if (event.card.name != "sha" || !game.hasNature(event.card, "fire")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !event.targets.includes(current) && player.canUse(event.card, current);
			});
		},
		direct: true,
		async content(event, trigger, player) {
			// step 0
			const result = await player
				.chooseTarget(get.prompt("decadelihuo"), "为" + get.translation(trigger.card) + "增加一个目标", function (card, player, target) {
					return !_status.event.sourcex.includes(target) && player.canUse(_status.event.card, target);
				})
				.set("sourcex", trigger.targets)
				.set("card", trigger.card)
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.effect(target, _status.event.card, player, player);
				})
				.forResult();
			// step 1 & 2
			if (result.bool) {
				if (!event.isMine() && !_status.connectMode) {
					await game.delayx();
				}
				const target = result.targets[0];
				player.logSkill("decadelihuo", target);
				trigger.targets.push(target);
			}
		},
	},
	decadelihuo3: {
		trigger: { player: "useCardAfter" },
		sourceSkill: "decadelihuo",
		filter(event, player) {
			return (
				event.card.name == "sha" &&
				game.hasNature(event.card, "fire") &&
				event.targets.length > 1 &&
				player.getHistory("sourceDamage", function (evt) {
					return evt.card == event.card;
				}).length > 0
			);
		},
		forced: true,
		audio: "lihuo",
		audioname: ["re_chengpu"],
		async content(event, trigger, player) {
			await player.loseHp();
		},
	},
	decadechunlao: {
		audio: "chunlao",
		audioname: ["re_chengpu"],
		enable: "chooseToUse",
		viewAs: { name: "jiu", isCard: true },
		viewAsFilter(player) {
			return !player.isLinked();
		},
		filter(event, player) {
			return !player.isLinked();
		},
		filterCard: () => false,
		selectCard: -1,
		log: false,
		async precontent(event, trigger, player) {
			player.logSkill("decadechunlao");
			await player.link();
		},
		group: ["decadechunlao2", "decadechunlaox"],
		ai: { jiuOther: true },
	},
	decadechunlaox: {
		trigger: { player: "damageBegin2" },
		silent: true,
		lastDo: true,
		sourceSkill: "decadechunlao",
		filter(event, player) {
			return !player.isLinked();
		},
		async content(event, trigger, player) {
			trigger.decadechunlaox = true;
		},
	},
	decadechunlao2: {
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		prompt: "是否发动【醇醪】将武将牌重置？",
		sourceSkill: "decadechunlao",
		filter(event, player) {
			return player.isLinked() && event.num > 1 && !event.decadechunlaox;
		},
		async content(event, trigger, player) {
			await player.link();
		},
	},
	oltianxiang: {
		audio: "tianxiang",
		audioname: ["daxiaoqiao", "re_xiaoqiao", "ol_xiaoqiao"],
		trigger: { player: "damageBegin4" },
		direct: true,
		filter(event, player) {
			return (
				player.countCards("he", function (card) {
					if (_status.connectMode && get.position(card) == "h") {
						return true;
					}
					return get.suit(card, player) == "heart";
				}) > 0 && event.num > 0
			);
		},
		async content(event, trigger, player) {
			// step 0
			const result = await player
				.chooseCardTarget({
					filterCard(card, player) {
						return get.suit(card) == "heart" && lib.filter.cardDiscardable(card, player);
					},
					filterTarget(card, player, target) {
						return player != target;
					},
					position: "he",
					ai1(card) {
						return 10 - get.value(card);
					},
					ai2(target) {
						var att = get.attitude(_status.event.player, target);
						var trigger = _status.event.getTrigger();
						var da = 0;
						if (_status.event.player.hp == 1) {
							da = 10;
						}
						var eff = get.damageEffect(target, trigger.source, target);
						if (att == 0) {
							return 0.1 + da;
						}
						if (eff >= 0 && att > 0) {
							return att + da;
						}
						if (att > 0 && target.hp > 1) {
							if (target.maxHp - target.hp >= 3) {
								return att * 1.1 + da;
							}
							if (target.maxHp - target.hp >= 2) {
								return att * 0.9 + da;
							}
						}
						return -att + da;
					},
					prompt: get.prompt("oltianxiang"),
					prompt2: lib.translate.oltianxiang_info,
				})
				.forResult();
			// step 1
			if (result.bool) {
				await player.discard(result.cards);
				var target = result.targets[0];
				const result2 = await player
					.chooseControlList(
						true,
						function (event, player) {
							var target = _status.event.target;
							var att = get.attitude(player, target);
							if (target.hasSkillTag("maihp")) {
								att = -att;
							}
							if (att > 0) {
								return 0;
							} else {
								return 1;
							}
						},
						["令" + get.translation(target) + "受到伤害来源对其造成的1点伤害，然后摸X张牌（X为其已损失体力值且至多为5）", "令" + get.translation(target) + "失去1点体力，然后获得" + get.translation(result.cards)]
					)
					.set("target", target)
					.forResult();
				player.logSkill(event.name, target);
				trigger.cancel();
				event.target = target;
				event.card = result.cards[0];
				// step 2
				if (typeof result2.index == "number") {
					event.index = result2.index;
					if (result2.index) {
						event.related = event.target.loseHp();
					} else {
						const param = trigger.source ? { source: trigger.source, nocard: true } : { nosource: true, nocard: true };
						event.related = event.target.damage(param);
					}
					await event.related;
				} else {
					return;
				}
				// step 3
				if (event.related.cancelled || target.isDead()) {
					return;
				}
				if (event.index && event.card.isInPile()) {
					await target.gain(event.card, "gain2");
				} else if (target.getDamagedHp()) {
					await target.draw({ num: Math.min(5, target.getDamagedHp()) });
				}
			}
		},
		ai: {
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (get.tag(card, "damage") && target.countCards("he") > 1) {
						return 0.7;
					}
				},
			},
		},
	},
	olhongyan: {
		audio: "rehongyan",
		mod: {
			suit(card, suit) {
				if (suit == "spade") {
					return "heart";
				}
			},
			maxHandcardBase(player, num) {
				if (
					player.countCards("e", function (card) {
						return get.suit(card, player) == "heart";
					})
				) {
					return player.maxHp;
				}
			},
		},
	},
};
