import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "rechuhai" | "zhangming" | "xianghai" | "xianghai_g" | "chuhai" | "chuhai2">} */
export const groupSkills = {
	//周处
	rechuhai: {
		audio: "chuhai",
		dutySkill: true,
		locked: false,
		group: ["rechuhai_add", "rechuhai_achieve", "rechuhai_fail", "rechuhai_chuhai"],
		derivation: "zhangming",
		subSkill: {
			chuhai: {
				audio: "chuhai1.mp3",
				inherit: "chuhai",
				prompt: "与一名其他角色进行拼点",
			},
			add: {
				trigger: { player: "compare" },
				forced: true,
				popup: false,
				filter(event, player) {
					return event.getParent().name == "rechuhai_chuhai" && event.num1 < 13 && player.countCards("e") < 4;
				},
				content() {
					var num = 4 - player.countCards("e");
					game.log(player, "的拼点牌点数+", num);
					trigger.num1 = Math.min(13, trigger.num1 + num);
				},
			},
			achieve: {
				audio: "chuhai2.mp3",
				trigger: { player: "equipAfter" },
				forced: true,
				skillAnimation: true,
				animationColor: "wood",
				filter(event, player) {
					return player.countCards("e") > 2;
				},
				content() {
					player.awakenSkill("rechuhai");
					game.log(player, "成功完成使命");
					if (player.isDamaged()) {
						player.recover(player.maxHp - player.hp);
					}
					player.changeSkills(["zhangming"], ["xianghai"]);
				},
			},
			fail: {
				audio: "chuhai3.mp3",
				trigger: { player: "chooseToCompareAfter" },
				forced: true,
				filter(event, player) {
					return event.getParent().name == "rechuhai_chuhai" && event.num1 < 7 && !event.result.bool;
				},
				content() {
					player.awakenSkill("rechuhai");
					game.log(player, "使命失败");
				},
			},
		},
	},
	zhangming: {
		audio: 2,
		trigger: { player: "useCard" },
		forced: true,
		filter(event, player) {
			return get.suit(event.card) == "club";
		},
		content() {
			trigger.directHit.addArray(
				game.filterPlayer(function (current) {
					return current != player;
				})
			);
		},
		group: "zhangming_damage",
		subSkill: {
			damage: {
				audio: "zhangming",
				trigger: { source: "damageEnd" },
				forced: true,
				usable: 1,
				filter(event, player) {
					return player != event.player;
				},
				logTarget: "player",
				content() {
					var list = [],
						cards = [],
						target = trigger.player,
						hs = target.getCards("h");
					if (hs.length > 0) {
						var card = hs.randomGet();
						list.push(get.type2(card, target));
						player.showCards(card, get.translation(player) + "对" + get.translation(target) + "发动了【彰名】");
					}
					target.discard(card);
					for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
						var type = get.type2(ui.cardPile.childNodes[i], false);
						if (!list.includes(type)) {
							list.push(type);
							cards.push(ui.cardPile.childNodes[i]);
						}
					}
					player.gain(cards, "gain2").gaintag.add("zhangming");
					player.addTempSkill("zhangming_keep");
				},
			},
			keep: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("zhangming");
				},
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("zhangming")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("zhangming")) {
							return false;
						}
					},
				},
			},
		},
	},
	xianghai: {
		audio: 2,
		global: "xianghai_g",
		mod: {
			cardname(card) {
				if (get.type(card, null, false) == "equip") {
					return "jiu";
				}
			},
		},
		ai: {
			threaten: 2,
		},
	},
	xianghai_g: {
		mod: {
			maxHandcard(player, num) {
				return (
					num -
					game.countPlayer(function (current) {
						return current != player && current.hasSkill("xianghai");
					})
				);
			},
		},
	},
	chuhai: {
		audio: 3,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(target => player.canCompare(target, true));
		},
		filterTarget(card, player, target) {
			return player.canCompare(target, true);
		},
		content() {
			"step 0";
			player.draw();
			"step 1";
			if (player.canCompare(target)) {
				player.chooseToCompare(target);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				player.storage.chuhai2 = target;
				player.addTempSkill("chuhai2", "phaseUseEnd");
				if (target.countCards("h") > 0) {
					player.viewHandcards(target);
					var types = [],
						cards = [],
						hs = target.getCards("h");
					for (var i of hs) {
						types.add(get.type2(i, target));
					}
					for (var i of types) {
						var card = get.cardPile(function (card) {
							return get.type2(card, false) == i;
						});
						if (card) {
							cards.push(card);
						}
					}
					if (cards.length) {
						player.gain(cards, "gain2", "log");
					}
				}
			}
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					if (
						player.countCards("hs", function (card) {
							return get.tag(card, "damage") > 0 && player.canUse(card, target, null, true) && get.effect(target, card, player, player) > 0 && player.hasValueTarget(card, null, true);
						}) > 0
					) {
						return -3;
					}
					return -1;
				},
			},
		},
	},
	chuhai2: {
		trigger: { source: "damageSource" },
		forced: true,
		charlotte: true,
		onremove: true,
		sourceSkill: "chuhai",
		filter(event, player) {
			if (event.player != player.storage.chuhai2) {
				return false;
			}
			for (var i = 1; i < 6; i++) {
				if (player.hasEmptySlot(i)) {
					return true;
				}
			}
			return false;
		},
		content() {
			for (var i = 1; i < 7; i++) {
				if (player.hasEmptySlot(i)) {
					var sub = "equip" + i,
						card = get.cardPile(function (card) {
							return get.subtype(card, false) == sub && !get.cardtag(card, "gifts") && player.canEquip(card);
						});
					if (card) {
						player.$gain2(card);
						game.delayx();
						player.equip(card);
						break;
					}
				}
			}
		},
	},
};
