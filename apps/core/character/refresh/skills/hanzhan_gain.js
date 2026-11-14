import { auditSelectionSpec } from "../../standard/skills/selectionAudit.js";
import { ollongdanSelectionSpec } from "./selectionSpecs.js";
import { lib, game, ui, get, ai, _status } from "noname";

/** @type { NonNullable<importCharacterConfig["skill"]> } */
export const hanzhan_gainSkills = {
	hanzhan_gain: {
		trigger: {
			global: "chooseToCompareAfter",
		},
		audio: "hanzhan",
		sourceSkill: "hanzhan",
		filter(event, player) {
			if (event.preserve) {
				return false;
			}
			if (player != event.player && player != event.target && (!event.targets || !event.targets.includes(player))) {
				return false;
			}
			for (var i of event.lose_list) {
				if (Array.isArray(i[1])) {
					for (var j of i[1]) {
						if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
							return true;
						}
					}
				} else {
					var j = i[1];
					if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
						return true;
					}
				}
			}
			return false;
		},
		frequent: true,
		prompt2(event, player) {
			var cards = [],
				max = 0;
			for (var i of event.lose_list) {
				if (Array.isArray(i[1])) {
					for (var j of i[1]) {
						if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
							var num = get.number(j, i[0]);
							if (num > max) {
								cards = [];
								max = num;
							}
							if (num == max) {
								cards.push(j);
							}
						}
					}
				} else {
					var j = i[1];
					if (get.name(j, i[0]) == "sha" && get.position(j, true) == "o") {
						var num = get.number(j, i[0]);
						if (num > max) {
							cards = [];
							max = num;
						}
						if (num == max) {
							cards.push(j);
						}
					}
				}
			}
			return "获得" + get.translation(cards);
		},
		async content(event, trigger, player) {
			const cards = [];
			let max = 0;
			for (const entry of trigger.lose_list) {
				const owner = entry[0];
				const item = entry[1];
				if (Array.isArray(item)) {
					for (const j of item) {
						if (get.name(j, owner) === "sha" && get.position(j, true) === "o") {
							const num = get.number(j, owner);
							if (num > max) {
								cards.length = 0;
								max = num;
							}
							if (num === max) {
								cards.push(j);
							}
						}
					}
				} else {
					const j = item;
					if (get.name(j, owner) === "sha" && get.position(j, true) === "o") {
						const num = get.number(j, owner);
						if (num > max) {
							cards.length = 0;
							max = num;
						}
						if (num === max) {
							cards.push(j);
						}
					}
				}
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
		},
	},
	rejianchu: {
		audio: 2,
		audioname: ["re_pangde"],
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && event.target.countDiscardableCards(player, "he") > 0;
		},
		direct: true,
		async content(event, trigger, player) {
			// step 0
			const result = await player
				.discardPlayerCard(trigger.target, get.prompt("rejianchu", trigger.target))
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
				.set("logSkill", ["rejianchu", trigger.target])
				.set("att", get.attitude(player, trigger.target) <= 0)
				.forResult();
			// step 1
			if (result.bool && result.links && result.links.length) {
				if (get.type(result.links[0], null, result.links[0].original == "h" ? player : false) != "basic") {
					trigger.getParent().directHit.add(trigger.target);
					player.addTempSkill("rejianchu2");
					player.addMark("rejianchu2", 1, false);
				} else if (trigger.cards) {
					var list = [];
					for (var i = 0; i < trigger.cards.length; i++) {
						if (get.position(trigger.cards[i], true) == "o") {
							list.push(trigger.cards[i]);
						}
					}
					if (list.length) {
						await trigger.target.gain(list, "gain2", "log");
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
	rejianchu2: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + player.countMark("rejianchu2");
				}
			},
		},
		onremove: true,
	},
	wulie: {
		trigger: { player: "phaseJieshuBegin" },
		audio: 2,
		direct: true,
		limited: true,
		skillAnimation: true,
		animationColor: "wood",
		filter(event, player) {
			return player.hp > 0;
		},
		async content(event, trigger, player) {
			// step 0
			const result = await player
				.chooseTarget([1, player.hp], get.prompt2("wulie"), lib.filter.notMe)
				.set("ai", function (target) {
					var player = _status.event.player;
					if (player.hasUnknown()) {
						return 0;
					}
					if (player.hp - ui.selected.targets.length > 1 + player.countCards("hs", card => player.canSaveCard(card, player))) {
						return get.attitude(player, target);
					}
					return 0;
				})
				.forResult();
			// step 1
			if (result.bool) {
				var targets = result.targets.sortBySeat();
				player.logSkill("wulie", targets);
				player.awakenSkill(event.name);
				await player.loseHp(targets.length);
				while (targets.length) {
					targets[0].addSkill("wulie2");
					targets.shift().addMark("wulie2");
				}
			}
		},
	},
	wulie2: {
		marktext: "烈",
		intro: { name2: "烈", content: "mark" },
		trigger: { player: "damageBegin3" },
		forced: true,
		sourceSkill: "wulie",
		async content(event, trigger, player) {
			trigger.cancel();
			player.removeMark("wulie2", 1);
			if (!player.storage.wulie2) {
				player.removeSkill("wulie2");
			}
		},
	},
	regongji: {
		mod: {
			attackRangeBase(player) {
				if (player.getEquips(3).length > 0 || player.getEquips(4).length > 0) {
					return Infinity;
				}
			},
		},
		locked: false,
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filter(event, player) {
			return player.hasCard(function (card) {
				return lib.skill.regongji.filterCard(card);
			}, "eh");
		},
		filterCard(card, player) {
			return get.type(card) != "basic";
		},
		filterTarget(card, player, target) {
			return target != player && target.countDiscardableCards(player, "he") > 0;
		},
		check(card) {
			return 4.5 - get.value(card);
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (target.countDiscardableCards(player, "he") > 0) {
				await player.discardPlayerCard(target, "he", true);
			}
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					var att = get.attitude(player, target);
					var nh = target.countCards("h");
					if (att > 0) {
						if (target.getEquip("baiyin") && target.isDamaged() && get.recoverEffect(target, player, player) > 0) {
							if (target.hp == 1 && !target.hujia) {
								return 1.6;
							}
							if (target.hp == 2) {
								return 0.01;
							}
							return 0;
						}
					}
					var es = target.getCards("e");
					var noe = es.length == 0 || target.hasSkillTag("noe");
					var noe2 = es.length == 1 && es[0].name != "tengjia" && get.value(es[0]) <= 0;
					var noh = nh == 0 || target.hasSkillTag("noh");
					if (noh && (noe || noe2)) {
						return 0;
					}
					if (att <= 0 && !target.countCards("he")) {
						return 1.5;
					}
					return -1.5;
				},
			},
			tag: {
				loseCard: 1,
				discard: 1,
			},
		},
	},
	ollongdan: {
		selectionSpec: ollongdanSelectionSpec,
		mod: {
			aiValue(player, card, num) {
				if (card.name != "sha" && card.name != "shan") {
					return;
				}
				var geti = function () {
					var cards = player.getCards("hs", function (card) {
						return card.name == "sha" || card.name == "shan";
					});
					if (cards.includes(card)) {
						return cards.indexOf(card);
					}
					return cards.length;
				};
				return Math.max(num, [7, 5, 5, 3][Math.min(geti(), 3)]);
			},
			aiUseful() {
				return lib.skill.ollongdan.mod.aiValue.apply(this, arguments);
			},
		},
		locked: false,
		audio: "longdan_sha",
		audioname: ["re_zhaoyun", "huan_zhaoyun", "sp_zhaoyun"],
		audioname2: { tongyuan: "longdan_tongyuan" },
		hiddenCard(player, name) {
			if (name == "tao") {
				return player.countCards("hs", "jiu") > 0;
			}
			if (name == "jiu") {
				return player.countCards("hs", "tao") > 0;
			}
			return false;
		},
		enable: ["chooseToUse", "chooseToRespond"],
		position: "hs",
		prompt: "将杀当做闪，或将闪当做杀，或将桃当做酒，或将酒当做桃使用或打出",
		viewAs(cards, player) {
			if (cards.length) {
				var name = false;
				switch (get.name(cards[0], player)) {
					case "sha":
						name = "shan";
						break;
					case "shan":
						name = "sha";
						break;
					case "tao":
						name = "jiu";
						break;
					case "jiu":
						name = "tao";
						break;
				}
				if (name) {
					return { name: name };
				}
			}
			return null;
		},
		check(card) {
			var player = _status.event.player;
			if (_status.event.type == "phase") {
				var max = 0;
				var name2;
				var list = ["sha", "tao", "jiu"];
				var map = { sha: "shan", tao: "jiu", jiu: "tao" };
				for (var i = 0; i < list.length; i++) {
					var name = list[i];
					if (player.countCards("hs", map[name]) > (name == "jiu" ? 1 : 0) && player.getUseValue({ name: name }) > 0) {
						var temp = get.order({ name: name });
						if (temp > max) {
							max = temp;
							name2 = map[name];
						}
					}
				}
				if (name2 == get.name(card, player)) {
					return 1;
				}
				return 0;
			}
			return 1;
		},
		filterCard(card, player, event) {
			event = event || _status.event;
			var filter = event._backup.filterCard;
			var name = get.name(card, player);
			if (name == "sha" && filter({ name: "shan", cards: [card] }, player, event)) {
				return true;
			}
			if (name == "shan" && filter({ name: "sha", cards: [card] }, player, event)) {
				return true;
			}
			if (name == "tao" && filter({ name: "jiu", cards: [card] }, player, event)) {
				return true;
			}
			if (name == "jiu" && filter({ name: "tao", cards: [card] }, player, event)) {
				return true;
			}
			return false;
		},
		filter(event, player) {
			var filter = event.filterCard;
			if (filter(get.autoViewAs({ name: "sha" }, "unsure"), player, event) && player.countCards("hs", "shan")) {
				return true;
			}
			if (filter(get.autoViewAs({ name: "shan" }, "unsure"), player, event) && player.countCards("hs", "sha")) {
				return true;
			}
			if (filter(get.autoViewAs({ name: "tao" }, "unsure"), player, event) && player.countCards("hs", "jiu")) {
				return true;
			}
			if (filter(get.autoViewAs({ name: "jiu" }, "unsure"), player, event) && player.countCards("hs", "tao")) {
				return true;
			}
			return false;
		},
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag) {
				var name;
				switch (tag) {
					case "respondSha":
						name = "shan";
						break;
					case "respondShan":
						name = "sha";
						break;
				}
				if (!player.countCards("hs", name)) {
					return false;
				}
			},
			order(item, player) {
				if (player && _status.event.type == "phase") {
					var max = 0;
					var list = ["sha", "tao", "jiu"];
					var map = { sha: "shan", tao: "jiu", jiu: "tao" };
					for (var i = 0; i < list.length; i++) {
						var name = list[i];
						if (player.countCards("hs", map[name]) > (name == "jiu" ? 1 : 0) && player.getUseValue({ name: name }) > 0) {
							var temp = get.order({ name: name });
							if (temp > max) {
								max = temp;
							}
						}
					}
					if (max > 0) {
						max += 0.3;
					}
					return max;
				}
				return 4;
			},
		},
	},
};

auditSelectionSpec(hanzhan_gainSkills.ollongdan);
