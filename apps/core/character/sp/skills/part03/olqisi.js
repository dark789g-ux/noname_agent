import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqisi" | "zhaogujing_skill" | "sanlve_skill" | "xuwangzhimian" | "shufazijinguan_skill" | "qimenbagua" | "guofengyupao" | "hongmianbaihuapao_skill" | "linglongshimandai_skill" | "bintieshuangji_skill">} */
export const groupSkills = {
	olqisi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		filter(event, player) {
			return !event.numFixed && event.num > 0;
		},
		check(event, player) {
			if (player.hasEmptySlot(2) || player.hasEmptySlot(5) || player.hasEmptySlot(1)) {
				return true;
			}
			return false;
		},
		prompt2: "摸牌阶段开始时，你可以少摸一张牌并声明一种装备牌的副类别，然后从牌堆或弃牌堆中获得一张该副类别的牌。",
		content() {
			"step 0";
			player
				.chooseControl("equip1", "equip2", "equip6", "equip5")
				.set("prompt", "选择获得一种副类别的装备牌")
				.set("ai", function (card) {
					if (player.hasEmptySlot(2)) {
						return "equip2";
					}
					if (player.hasEmptySlot(5)) {
						return "equip5";
					}
					if (player.hasEmptySlot(1)) {
						return "equip1";
					}
					return "equip6";
				});
			"step 1";
			var card = get.cardPile(function (card) {
				var type = get.subtype(card);
				if (result.control == "equip6") {
					return type == "equip3" || type == "equip4";
				}
				return type == result.control;
			});
			if (card) {
				trigger.num--;
				player.gain(card, "gain2");
			}
		},
		group: "olqisi_init",
		subSkill: {
			init: {
				audio: "olqisi",
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				forced: true,
				locked: false,
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				content() {
					"step 0";
					var i = 0;
					var list = [];
					while (i++ < 2) {
						var card = get.cardPile(function (card) {
							if (get.type(card) != "equip") {
								return false;
							}
							return list.length == 0 || get.subtype(card) != get.subtype(list[0]);
						});
						if (card) {
							list.push(card);
						}
					}
					if (!list.length) {
						event.finish();
						return;
					}
					event.list = list;
					player.gain(event.list, "gain2");
					"step 1";
					game.delay(1);
					var card = event.list.shift();
					if (player.getCards("h").includes(card)) {
						player.$give(card, player, false);
						player.equip(card);
					}
					if (event.list.length) {
						event.redo();
					}
				},
			},
		},
	},
	//蒲元衍生
	zhaogujing_skill: {
		equipSkill: true,
		trigger: { player: "phaseUseEnd" },
		direct: true,
		filter(event, player) {
			return player.hasCard(function (card) {
				if (_status.connectMode) {
					return true;
				}
				var type = get.type(card, null, player);
				return type == "basic" || type == "trick";
			}, "h");
		},
		content() {
			"step 0";
			player
				.chooseCard("h", get.prompt("zhaogujing_skill"), "展示并视为使用一张基本牌或普通锦囊牌", function (card, player) {
					var type = get.type(card, null, player);
					return type == "basic" || type == "trick";
				})
				.set("ai", function (card) {
					var player = _status.event.player,
						name = get.name(card, player);
					if (name == "jiu") {
						return 0;
					}
					return player.getUseValue({
						name: name,
						nature: get.nature(card, player),
						isCard: true,
					});
				});
			"step 1";
			if (result.bool) {
				player.logSkill("zhaogujing_skill");
				player.showCards(result.cards, get.translation(player) + "发动了【照骨镜】");
				var card = {
					name: get.name(result.cards[0], player),
					nature: get.nature(result.cards[0], player),
					isCard: true,
				};
				player.chooseUseTarget(card, true, false);
			}
		},
	},
	sanlve_skill: {
		equipSkill: true,
		mod: {
			maxHandcard(player, num) {
				return num + 1;
			},
			attackRange(player, num) {
				return num + 1;
			},
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + 1;
				}
			},
		},
	},
	xuwangzhimian: {
		equipSkill: true,
		trigger: { player: "phaseDrawBegin2" },
		forced: true,
		filter(event, player) {
			return !event.numFixed;
		},
		content() {
			trigger.num += 2;
		},
		mod: {
			maxHandcard(player, num) {
				return num - 1;
			},
		},
	},
	shufazijinguan_skill: {
		equipSkill: true,
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("shufazijinguan"), "对一名其他角色造成1点伤害", function (card, player, target) {
					return player != target;
				})
				.set("ai", function (target) {
					return get.damageEffect(target, player, player);
				});
			"step 1";
			if (result.bool) {
				player.logSkill("shufazijinguan_skill", result.targets[0]);
				result.targets[0].damage();
			}
		},
	},
	qimenbagua: {
		equipSkill: true,
		trigger: { target: "useCardToBefore" },
		forced: true,
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			if (player.hasSkillTag("unequip2")) {
				return false;
			}
			if (
				event.player.hasSkillTag("unequip", false, {
					name: event.card ? event.card.name : null,
					target: player,
					card: event.card,
				})
			) {
				return false;
			}
			return true;
		},
		content() {
			trigger.cancel();
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (card.name != "sha") {
						return;
					}
					if (
						target.hasSkillTag("unequip2") ||
						player.hasSkillTag("unequip", false, {
							name: card ? card.name : null,
							target: player,
							card: card,
						}) ||
						player.hasSkillTag("unequip_ai", false, {
							name: card ? card.name : null,
							target: player,
							card: card,
						})
					) {
						return;
					}
					return "zeroplayertarget";
				},
			},
		},
	},
	guofengyupao: {
		equipSkill: true,
		mod: {
			targetEnabled(card, player, target) {
				if (player == target || get.type(card) != "trick") {
					return;
				}
				if (target.hasSkillTag("unequip2")) {
					return;
				}
				if (
					player.hasSkillTag("unequip", false, {
						name: card ? card.name : null,
						target: player,
						card: card,
					})
				) {
					return;
				}
				return false;
			},
		},
	},
	hongmianbaihuapao_skill: {
		equipSkill: true,
		trigger: {
			player: "damageBegin4",
		},
		filter(event, player) {
			if (!event.hasNature("linked")) {
				return false;
			}
			if (player.hasSkillTag("unequip2")) {
				return false;
			}
			if (
				event.source &&
				event.source.hasSkillTag("unequip", false, {
					name: event.card ? event.card.name : null,
					target: player,
					card: event.card,
				})
			) {
				return false;
			}
			return true;
		},
		forced: true,
		content() {
			trigger.cancel();
		},
		ai: {
			nofire: true,
			nothunder: true,
			effect: {
				target(card, player, target, current) {
					if (!get.tag(card, "natureDamage")) {
						return;
					}
					if (
						!target.hasSkillTag("unequip2") &&
						!player.hasSkillTag("unequip", false, {
							name: card ? card.name : null,
							target: player,
							card: card,
						}) &&
						!player.hasSkillTag("unequip_ai", false, {
							name: card ? card.name : null,
							target: player,
							card: card,
						})
					) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	linglongshimandai_skill: {
		equipSkill: true,
		trigger: {
			target: "useCardToTargeted",
		},
		filter(event, player) {
			if ((event.targets && event.targets.length > 1) || event.player == player) {
				return false;
			}
			if (player.hasSkillTag("unequip2")) {
				return false;
			}
			var evt = event.getParent();
			if (
				evt.player &&
				evt.player.hasSkillTag("unequip", false, {
					name: evt.card ? evt.card.name : null,
					target: player,
					card: evt.card,
				})
			) {
				return false;
			}
			return true;
		},
		audio: true,
		check(event, player) {
			return get.effect(player, event.card, event.player, player) <= 0;
		},
		prompt2: event => "进行一次判定。若结果为♥，则" + get.translation(event.card) + "对你无效",
		content() {
			"step 0";
			player.judge("linglongshimandai", function (card) {
				return get.suit(card) == "heart" ? 1.5 : -0.5;
			}).judge2 = function (result) {
				return result.bool ? true : false;
			};
			"step 1";
			if (result.judge > 0) {
				trigger.getParent().excluded.add(player);
			}
		},
		ai: {
			effect: {
				target_use(card, player, target, effect) {
					if (
						effect > 0 ||
						player.hasSkillTag("unequip", false, {
							name: card ? card.name : null,
							target: player,
							card: card,
						}) ||
						player.hasSkillTag("unequip_ai", false, {
							name: card ? card.name : null,
							target: player,
							card: card,
						})
					) {
						return;
					}
					return 0.75;
				},
			},
		},
	},
	bintieshuangji_skill: {
		equipSkill: true,
		trigger: { player: "shaMiss" },
		filter(event, player) {
			return player.hp > 0;
		},
		prompt2(event, player) {
			var prompt = "失去1点体力，然后";
			var cards = event.cards.filterInD();
			if (cards.length) {
				prompt += "获得" + get.translation(cards) + "、";
			}
			prompt += "摸一张牌、本回合使用【杀】的次数上限+1";
			return prompt;
		},
		check(event, player) {
			if (get.effect(player, { name: "losehp" }, player, player) > 0) {
				return true;
			}
			return player.hp > event.target.hp && event.cards.filterInD().length > 0;
		},
		content() {
			"step 0";
			player.loseHp();
			"step 1";
			var cards = trigger.cards.filterInD();
			if (cards.length) {
				player.gain(cards, "gain2");
			}
			player.draw();
			"step 2";
			player.addTempSkill("bintieshuangji_skill_effect");
			player.addMark("bintieshuangji_skill_effect", 1, false);
		},
		subSkill: {
			effect: {
				charlotte: true,
				intro: { content: "使用【杀】的次数上限+#" },
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("bintieshuangji_skill_effect");
						}
					},
				},
			},
		},
	},
};
