import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twsidao" | "twrangyi" | "twrangyi2" | "twbaimei" | "twhuzhu" | "twliancai" | "twqijia" | "twzhuchen" | "twxiaolian" | "twtijin">} */
export const groupSkills = {
	twsidao: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: ["enterGame", "phaseZhunbei"],
		},
		filter(event, player) {
			if (event.name == "phaseZhunbei") {
				const card = player.storage.twsidao;
				return card?.isInPile() && player.hasUseTarget(card);
			}
			return (event.name != "phase" || game.phaseNumber == 0) && !player.storage.twsidao;
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phaseZhunbei") {
				event.result = { bool: true };
			} else {
				const result = await player
					.chooseButton(["请选择你的初始法宝", [["gx_lingbaoxianhu", "gx_taijifuchen", "gx_chongyingshenfu"], "vcard"]], true)
					.set("ai", button => {
						return button.link[2] == "gx_chongyingshenfu" ? 2 : 1;
					})
					.forResult();
				event.result = {
					bool: result?.bool,
					cost_data: result?.links,
				};
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "phaseZhunbei") {
				await player.chooseUseTarget(player.storage.twsidao, "nopopup", true);
			} else {
				const name = event.cost_data[0][2];
				const card = game.createCard2(name, "heart", 1);
				game.broadcastAll(name => lib.inpile.add(name), name);
				player.storage.twsidao = card;
				await player.chooseUseTarget(card, "nopopup", true);
			}
		},
	},
	twrangyi: {
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterTarget: lib.filter.notMe,
		delay: 0,
		content() {
			"step 0";
			event.cards = player.getCards("h");
			player.give(event.cards, target).gaintag.add("twrangyi");
			target.addTempSkill("twrangyi2");
			"step 1";
			target.chooseToUse({
				prompt: "请使用得到的一张牌，或者受到来自" + get.translation(player) + "的1点伤害",
				filterCard(card, player) {
					if (get.itemtype(card) != "card" || !card.hasGaintag("twrangyi")) {
						return false;
					}
					return lib.filter.filterCard(card, player, event);
				},
				cards: cards,
			});
			"step 2";
			target.removeSkill("twrangyi2");
			if (!result.bool) {
				target.damage("nocard");
			}
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					var hs = player.getCards("h");
					for (var i = 0; i < hs.length; i++) {
						var hi = hs[i];
						if (hi.name == "tao" || target.hasValueTarget(hi, null, true)) {
							return 1;
						}
					}
					return get.damageEffect(target, player, target);
				},
			},
		},
	},
	twrangyi2: {
		trigger: { player: "useCard" },
		forced: true,
		popup: false,
		charlotte: true,
		sourceSkill: "twrangyi",
		filter(event, player) {
			var evt = event.getParent(2);
			return (
				evt.name == "twrangyi" &&
				evt.player.isIn() &&
				player.countCards("h", function (card) {
					return card.hasGaintag("twrangyi");
				}) > 0
			);
		},
		content() {
			var cards = player.getCards("h", function (card) {
				return card.hasGaintag("twrangyi");
			});
			game.delayx();
			player.give(cards, trigger.getParent(2).player);
		},
		onremove(player) {
			player.removeGaintag("twrangyi");
		},
	},
	twbaimei: {
		trigger: {
			player: "damageBegin4",
		},
		forced: true,
		filter(event, player) {
			if (player.countCards("h")) {
				return false;
			}
			if (event.hasNature()) {
				return true;
			}
			return get.type(event.card, "trick") == "trick";
		},
		content() {
			trigger.cancel();
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (target.countCards("h")) {
						return;
					}
					if (get.tag(card, "natureDamage")) {
						return "zeroplayertarget";
					}
					if (get.type(card) == "trick" && get.tag(card, "damage")) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	twhuzhu: {
		enable: "phaseUse",
		usable: 1,
		filter(e, player) {
			return player.countCards("e") > 0;
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		content() {
			"step 0";
			target.chooseCard("交给" + get.translation(player) + "一张手牌", "h", true);
			"step 1";
			target.give(result.cards, player);
			"step 2";
			if (player.countGainableCards(player, "e")) {
				target.gainPlayerCard(player, "e", true);
			}
			"step 3";
			if (target.isDamaged() && target.hp <= player.hp) {
				player.chooseBool("是否令" + get.translation(target) + "回复1点体力？").set("ai", function () {
					return get.recoverEffect(target, player, player);
				});
			}
			"step 4";
			if (result.bool) {
				target.recover();
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					var eff = target.isDamaged() && target.hp <= player.hp ? get.recoverEffect(target, player, target) : 0;
					if (eff <= 0 && !player.countGainableCards(target, "e")) {
						return -1;
					}
					return eff;
				},
			},
		},
	},
	twliancai: {
		trigger: { player: ["turnOverEnd", "phaseJieshuBegin"] },
		filter(card, player, target) {
			return target == "phaseJieshuBegin" || player.countCards("h") < player.hp;
		},
		filterTarget(card, player, target) {
			return target != player && target.countGainableCards(player, "e") > 0;
		},
		check(card, player) {
			if (card.name == "turnOver") {
				return true;
			}
			if (player.isTurnedOver()) {
				return true;
			}
			if (player.hp - player.countCards("h") > 1) {
				return true;
			}
			return game.hasPlayer(function (current) {
				return lib.skill.twliancai.filterTarget(null, player, current) && lib.skill.twliancai.filterAI(current);
			});
		},
		filterAI(target) {
			var player = _status.event.player;
			var att = get.attitude(player, target);
			if (target.isDamaged() && target.countCards("e", "baiyin") && att > 0) {
				return 2 * att;
			}
			return -att;
		},
		prompt2(card, player, target) {
			return card.name == "phaseJieshu" ? "将武将牌翻面，然后获得一名其他角色装备区内的一张牌" : "将手牌摸至与体力值相同";
		},
		content() {
			"step 0";
			if (event.triggername == "phaseJieshuBegin") {
				player.turnOver();
			} else {
				player.draw(player.hp - player.countCards("h"));
				event.finish();
			}
			"step 1";
			player.chooseTarget("获得一名角色装备区内的一张牌", lib.skill.twliancai.filterTarget).ai = lib.skill.twliancai.filterAI;
			"step 2";
			if (result.bool) {
				player.line(result.targets, "thunder");
				player.gainPlayerCard("e", true, result.targets[0]);
			}
		},
	},
	twqijia: {
		//group:'twqijia_alka',
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("e", function (card) {
				return !player.getStorage("twqijia_alka").includes(get.subtype(card));
			});
		},
		filterTarget(card, player, target) {
			return target != player && player.canUse({ name: "sha" }, target);
		},
		position: "e",
		filterCard(card, player) {
			return !player.getStorage("twqijia_alka").includes(get.subtype(card));
		},
		content() {
			"step 0";
			player.addTempSkill("twqijia_alka");
			player.storage.twqijia_alka.push(get.subtype(cards[0]));
			player.useCard({ name: "sha" }, target, false);
		},
		subSkill: {
			alka: {
				charlotte: true,
				onremove(player) {
					delete player.storage.twqijia_alka;
					delete player.storage.twzhuchen;
					player.unmarkSkill("twzhuchen");
				},
				init(player, skill) {
					if (!player.storage[skill]) {
						player.storage[skill] = [];
					}
					if (!player.storage.twzhuchen) {
						player.storage.twzhuchen = [];
					}
				},
				mod: {
					globalFrom(from, to, distance) {
						if (from.storage.twzhuchen && from.storage.twzhuchen.includes(to)) {
							return -Infinity;
						}
					},
				},
			},
		},
		check(card) {
			return 7 - get.value(card);
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) - 0.2;
			},
			result: {
				target(player, target) {
					return get.effect(target, { name: "sha" }, player, player);
				},
			},
		},
	},
	twzhuchen: {
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("h", lib.skill.twzhuchen.filterCard) > 0;
		},
		filterCard(card, player) {
			var name = get.name(card, player);
			return name == "tao" || name == "jiu";
		},
		filterTarget: lib.filter.notMe,
		content() {
			player.addTempSkill("twqijia_alka");
			player.storage.twzhuchen.add(target);
			player.markSkill("twzhuchen");
		},
		intro: {
			content(content, player) {
				return "至" + get.translation(content) + "的距离视为1";
			},
		},
	},
	twxiaolian: {
		trigger: { global: "useCardToTarget" },
		logTarget: "target",
		filter(event, player) {
			return event.card && event.card.name == "sha" && event.player != player && event.targets.length == 1 && event.targets[0] != player;
		},
		check(event, player) {
			return get.effect(event.targets[0], event.card, event.player, player) <= get.effect(player, event.card, event.player, player);
		},
		content() {
			trigger.getParent().twxiaolian = trigger.targets[0];
			trigger.targets.length = 0;
			trigger.getParent().triggeredTargets2.length = 0;
			trigger.targets.push(player);
		},
		group: "twxiaolian_damage",
		subSkill: {
			distance: {
				sub: true,
				charlotte: true,
				init(player, skill) {
					if (!player.storage[skill]) {
						player.storage[skill] = [];
					}
				},
				mark: true,
				marktext: "马",
				intro: {
					content: "cards",
					onunmark: "throw",
				},
				mod: {
					globalTo(from, to, distance) {
						if (from != to && to.storage.twxiaolian_distance) {
							return distance + to.storage.twxiaolian_distance.length;
						}
					},
				},
			},
			damage: {
				sub: true,
				trigger: { player: "damageEnd" },
				direct: true,
				filter(event, player) {
					return event.getParent(2).twxiaolian != undefined;
				},
				content() {
					"step 0";
					var target = trigger.getParent(2).twxiaolian;
					event.target = target;
					player.chooseCard("是否将一张牌当做【马】置于" + get.translation(target) + "的武将牌旁？", "he").ai = function (card) {
						if (get.attitude(_status.event.player, _status.event.getParent("twxiaolian_damage").target) > 2) {
							return 7 - get.value(card);
						}
						return 0;
					};
					"step 1";
					if (result.bool) {
						player.logSkill("twxiaolian", target);
						player.lose(result.cards, ui.special, "toStorage");
						target.addSkill("twxiaolian_distance");
						target.storage.twxiaolian_distance.addArray(result.cards);
						target.markSkill("twxiaolian_distance");
					}
				},
			},
		},
	},
	twtijin: {
		trigger: { global: "useCardToPlayer" },
		filter(event, player) {
			return (
				event.card?.name == "sha" &&
				event.player != player &&
				event.target != player &&
				event.targets.length == 1 &&
				player.inRange(event.player)
			);
		},
		logTarget: "target",
		check(event, player) {
			return get.effect(event.targets[0], event.card, event.player, player) <= get.effect(player, event.card, event.player, player);
		},
		content() {
			"step 0";
			trigger.targets.length = 0;
			trigger.getParent().triggeredTargets1.length = 0;
			trigger.targets.push(player);
			var next = game.createEvent("twtijin_discard", null, trigger.getParent(2));
			next.player = player;
			next.target = trigger.player;
			next.setContent(function () {
				if (target.isDead() || !target.countCards("he")) {
					return;
				}
				player.line(target, "green");
				player.discardPlayerCard(target, true, "he");
			});
		},
	},
};
