import { auditSelectionSpec } from "../../standard/skills/selectionAudit.js";
import { rejieyinSelectionSpec } from "./selectionSpecs.js";
import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rejieyinSkills = {
	rejieyin: {
		selectionSpec: rejieyinSelectionSpec,
		audio: 2,
		enable: "phaseUse",
		filterCard: true,
		usable: 1,
		position: "he",
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		check(card) {
			var player = _status.event.player;
			if (get.position(card) == "e") {
				var subtype = get.subtype(card);
				if (
					!game.hasPlayer(function (current) {
						return current != player && get.attitude(player, current) > 0 && !current.countCards("e", { subtype: subtype });
					})
				) {
					return 0;
				}
				if (player.countCards("h", { subtype: subtype })) {
					return 20 - get.value(card);
				}
				return 10 - get.value(card);
			} else {
				if (player.countCards("e")) {
					return 0;
				}
				if (player.countCards("h", { type: "equip" })) {
					return 0;
				}
				return 8 - get.value(card);
			}
		},
		filterTarget(card, player, target) {
			if (!target.hasSex("male")) {
				return false;
			}
			var card = ui.selected.cards[0];
			if (!card) {
				return false;
			}
			if (get.position(card) == "e" && !target.canEquip(card)) {
				return false;
			}
			return true;
		},
		discard: false,
		delay: false,
		lose: false,
		async content(event, trigger, player) {
			const { cards, target } = event;
			let result;

			// step 0
			if (get.position(cards[0]) == "e") {
				result = { index: 0 };
			} else if (get.type(cards[0]) != "equip" || !target.canEquip(cards[0])) {
				result = { index: 1 };
			} else {
				result = await player
					.chooseControl()
					.set("choiceList", ["将" + get.translation(cards[0]) + "置入" + get.translation(target) + "的装备区", "弃置" + get.translation(cards[0])])
					.set("ai", () => 1)
					.forResult();
			}

			// step 1
			if (result.index == 0) {
				player.$give(cards, target, false);
				await target.equip(cards[0]);
			} else {
				await player.discard(cards);
			}

			// step 2
			if (player.hp > target.hp) {
				await player.draw();
				if (target.isDamaged()) {
					await target.recover();
				}
			} else if (player.hp < target.hp) {
				await target.draw();
				if (player.isDamaged()) {
					await player.recover();
				}
			}
		},
		ai: {
			order() {
				var player = _status.event.player;
				var es = player.getCards("e");
				for (var i = 0; i < es.length; i++) {
					if (player.countCards("h", { subtype: get.subtype(es[i]) })) {
						return 10;
					}
				}
				return 2;
			},
			result: {
				player(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					let card = ui.selected.cards[0],
						val = -get.value(card, player) / 6;
					if (get.position(card) == "e") {
						val += 2;
					}
					if (player.hp > target.hp) {
						val++;
					} else if (player.hp < target.hp && player.isDamaged()) {
						val += get.recoverEffect(player, player, player) / get.attitude(player, player);
					}
					return val;
				},
				target(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					let card = ui.selected.cards[0],
						val = get.position(card) == "e" ? get.value(card, target) / 6 : 0;
					if (target.hp > player.hp) {
						val++;
					} else if (target.hp < player.hp && target.isDamaged()) {
						val += get.recoverEffect(target, target, target) / get.attitude(target, target);
					}
					return val;
				},
			},
		},
	},
	rejiuyuan: {
		audio: 2,
		zhuSkill: true,
		trigger: { global: "recoverBefore" },
		direct: true,
		filter(event, player) {
			return player != event.player && event.player.group == "wu" && player.hp <= event.player.hp && event.getParent().name != "rejiuyuan" && player.hasZhuSkill("rejiuyuan", event.player) && event.player === _status.currentPhase;
		},
		async content(event, trigger, player) {
			// step 0
			const result = await trigger.player
				.chooseBool("是否对" + get.translation(player) + "发动【救援】？", "改为令其回复1点体力，然后你摸一张牌")
				.set("ai", function () {
					const evt = _status.event;
					return get.attitude(evt.player, evt.getParent().player) > 0;
				})
				.forResult();

			// step 1
			if (result.bool) {
				player.logSkill("rejiuyuan");
				trigger.player.line(player, "green");
				trigger.cancel();
				await player.recover(trigger.player);
				await trigger.player.draw();
			}
		},
	},
	rezhiheng: {
		selectionSpec: true,
		audio: 2,
		audioname2: { shen_caopi: "rezhiheng_shen_caopi", new_simayi: "rezhiheng_new_simayi" },
		mod: {
			aiOrder(player, card, num) {
				if (num <= 0 || get.itemtype(card) !== "card" || get.type(card) !== "equip") {
					return num;
				}
				let eq = player.getEquip(get.subtype(card));
				if (eq && get.equipValue(card) - get.equipValue(eq) < Math.max(1.2, 6 - player.hp)) {
					return 0;
				}
			},
		},
		locked: false,
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filterCard: lib.filter.cardDiscardable,
		discard: false,
		lose: false,
		delay: false,
		selectCard: [1, Infinity],
		allowChooseAll: true,
		check(card) {
			let player = _status.event.player;
			if (
				get.position(card) == "h" &&
				!player.countCards("h", "du") &&
				(player.hp > 2 ||
					!player.countCards("h", i => {
						return get.value(i) >= 8;
					}))
			) {
				return 1;
			}
			if (get.position(card) == "e") {
				let subs = get.subtypes(card);
				if (subs.includes("equip2") || subs.includes("equip3")) {
					return player.getHp() - get.value(card);
				}
			}
			return 6 - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards } = event;
			event.num = 1;
			const hs = player.getCards("h");
			if (!hs.length) {
				event.num = 0;
			}
			for (let i = 0; i < hs.length; i++) {
				if (!cards.includes(hs[i])) {
					event.num = 0;
					break;
				}
			}
			await player.discard(cards);
			await player.draw(event.num + cards.length);
		},
		//group:'rezhiheng_draw',
		subSkill: {
			draw: {
				trigger: { player: "loseEnd" },
				silent: true,
				filter(event, player) {
					if (event.getParent(2).skill != "rezhiheng" && event.getParent(2).skill != "jilue_zhiheng") {
						return false;
					}
					if (player.countCards("h")) {
						return false;
					}
					for (var i = 0; i < event.cards.length; i++) {
						if (event.cards[i].original == "h") {
							return true;
						}
					}
					return false;
				},
				async content(event, trigger, player) {
					player.addTempSkill("rezhiheng_delay", trigger.getParent(2).skill + "After");
				},
			},
			delay: {},
		},
		ai: {
			order(item, player) {
				if (player.hasCard(i => get.value(i) > Math.max(6, 9 - player.hp), "he")) {
					return 1;
				}
				return 10;
			},
			result: {
				player: 1,
			},
			nokeep: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "nokeep") {
					return (!arg || (arg && arg.card && get.name(arg.card) === "tao")) && player.isPhaseUsing() && !player.getStat().skill.rezhiheng && player.hasCard(card => get.name(card) !== "tao", "h");
				}
			},
			threaten: 1.55,
		},
	},
	rezhiheng_new_simayi: { audio: 1 },
	reqicai: {
		audio: 2,
		mod: {
			targetInRange(card, player, target, now) {
				var type = get.type(card);
				if (type == "trick" || type == "delay") {
					return true;
				}
			},
			canBeDiscarded(card, player, target) {
				if (get.position(card) == "e" && get.subtypes(card).some(subtype => ["equip2", "equip5"].includes(subtype)) && player != target) {
					return false;
				}
			},
		},
	},
	rejizhi: {
		audio: 2,
		audioname2: {
			lukang: "rejizhi_lukang",
			zj_lukang: "rejizhi_lukang",
			new_simayi: "rejizhi_new_simayi",
		},
		locked: false,
		trigger: { player: "useCard" },
		frequent: true,
		filter(event) {
			return get.type(event.card, "trick") == "trick" && event.card.isCard;
		},
		init(player) {
			player.storage.rejizhi = 0;
		},
		async content(event, trigger, player) {
			const result = await player.draw("nodelay").forResult();
			event.card = result.cards[0];
			if (get.type(event.card) !== "basic") {
				return;
			}

			const result2 = await player
				.chooseBool(`是否弃置${get.translation(event.card)}并令本回合手牌上限+1？`)
				.set("ai", (evt, player) => _status.currentPhase === player && player.needsToDiscard(-3) && _status.event.value < 6)
				.set("value", get.value(event.card, player))
				.forResult();

			if (result2.bool) {
				await player.discard(event.card);
				player.storage.rejizhi++;
				if (_status.currentPhase === player) {
					player.markSkill("rejizhi");
				}
			}
		},
		ai: {
			threaten: 1.4,
			noautowuxie: true,
		},
		mod: {
			maxHandcard(player, num) {
				return num + player.storage.rejizhi;
			},
		},
		intro: {
			content: "本回合手牌上限+#",
		},
		group: "rejizhi_clear",
		subSkill: {
			clear: {
				trigger: { global: "phaseAfter" },
				silent: true,
				async content(event, trigger, player) {
					player.storage.rejizhi = 0;
					player.unmarkSkill("rejizhi");
				},
			},
		},
	},
	rejizhi_new_simayi: { audio: 1 },
	rebiyue: {
		audio: 2,
		audioname2: { sp_diaochan: "biyue" },
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		async content(event, trigger, player) {
			await player.draw(player.countCards("h") ? 1 : 2);
		},
	},
};

auditSelectionSpec(rejieyinSkills.rejieyin);
