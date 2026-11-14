import { auditSelectionSpec } from "../../standard/skills/selectionAudit.js";
import { reguoseSelectionSpec } from "./selectionSpecs.js";
import { lib, game, ui, get, ai, _status } from "noname";

/** @type { NonNullable<importCharacterConfig["skill"]> } */
export const retiejiSkills = {
	retieji: {
		audio: 2,
		audioname: ["boss_lvbu3", "tw_dm_quyi"],
		trigger: { player: "useCardToPlayered" },
		check(event, player) {
			return get.attitude(player, event.target) <= 0;
		},
		filter(event, player) {
			return event.card.name == "sha";
		},
		logTarget: "target",
		async content(event, trigger, player) {
			let result;
			result = await player
				.judge(function () {
					return 0;
				})
				.forResult();
			if (!trigger.target.hasSkill("fengyin")) {
				trigger.target.addTempSkill("fengyin");
			}
			const suit = result.suit;
			const target = trigger.target;
			const num = target.countCards("h", "shan");
			result = await target
				.chooseToGive({
					target: player,
					filterCard(card) {
						return get.suit(card) === get.event().suit;
					},
					position: "he",
					prompt: `请交给${get.translation(player)}一张${get.translation(suit)}牌，否则不能使用闪抵消此杀且此杀伤害+1`,
					ai(card) {
						const num = get.event().num;
						if (num == 0) {
							return 0;
						}
						if (card.name == "shan") {
							return num > 1 ? 2 : 0;
						}
						return 8 - get.value(card);
					},
				})
				.set("num", num)
				.set("suit", suit)
				.forResult();
			if (!result.bool) {
				trigger.getParent().directHit.add(trigger.target);
				if (typeof trigger.getParent().baseDamage !== "number") {
					trigger.getParent().baseDamage = 1;
				}
				trigger.getParent().baseDamage++;
			}
		},
		ai: {
			ignoreSkill: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "directHit_ai") {
					return arg?.target && get.attitude(player, arg.target) <= 0;
				}
				if (!arg || arg.isLink || !arg.card || arg.card.name != "sha") {
					return false;
				}
				if (!arg.target || get.attitude(player, arg.target) >= 0) {
					return false;
				}
				if (!arg.skill || !lib.skill[arg.skill] || lib.skill[arg.skill].charlotte || lib.skill[arg.skill].persevereSkill || get.is.locked(arg.skill) || !arg.target.getSkills(true, false).includes(arg.skill)) {
					return false;
				}
			},
			directHit_ai: true,
		},
	},
	reyicong: {
		trigger: {
			player: ["changeHp"],
		},
		audio: 2,
		audioname2: { gongsunzan: "yicong" },
		forced: true,
		filter(event, player) {
			return get.sgn(player.hp - 2.5) != get.sgn(player.hp - 2.5 - event.num);
		},
		async content(event, trigger, player) {},
		mod: {
			globalFrom(from, to, current) {
				return current - 1;
			},
			globalTo(from, to, current) {
				if (to.hp <= 2) {
					return current + 1;
				}
			},
		},
		ai: {
			threaten: 0.8,
		},
	},
	reqiaomeng: {
		audio: "qiaomeng",
		trigger: { source: "damageSource" },
		direct: true,
		filter(event, player) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.card && event.card.name == "sha" && event.player.countDiscardableCards(player, "hej");
		},
		async content(event, trigger, player) {
			// step 0
			const result = await player.discardPlayerCard(get.prompt("reqiaomeng", trigger.player), "hej", trigger.player).set("logSkill", ["reqiaomeng", trigger.player]).forResult();

			// step 1
			if (result?.bool) {
				const card = result.cards[0];
				if (get.position(card) == "d") {
					const subtype = get.subtype(card);
					if (subtype == "equip3" || subtype == "equip4" || subtype == "equip6") {
						await player.gain(card, player, "gain2");
					}
				}
			}
		},
	},
	qiaomeng: {
		audio: 2,
		audioname: ["xin_gongsunzan"],
		trigger: { source: "damageSource" },
		direct: true,
		filter(event, player) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.card && event.card.name == "sha" && event.cards && get.color(event.cards) == "black" && event.player.countDiscardableCards(player, "e");
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			result = await player.discardPlayerCard(get.prompt("qiaomeng", trigger.player), "e", trigger.player).set("logSkill", ["qiaomeng", trigger.player]).forResult();

			// step 1
			if (result?.bool) {
				const card = result.cards[0];
				if (get.position(card) == "d") {
					const subtype = get.subtype(card);
					if (subtype == "equip3" || subtype == "equip4" || subtype == "equip6") {
						await player.gain(card, player, "gain2");
					}
				}
			}
		},
	},
	rekurou: {
		selectionSpec: true,
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard: lib.filter.cardDiscardable,
		check(card) {
			return 8 - get.value(card);
		},
		position: "he",
		async content(event, trigger, player) {
			await player.loseHp();
		},
		ai: {
			order: 8,
			result: {
				player(player) {
					if (player.needsToDiscard(3) && !player.hasValueTarget({ name: "sha" }, false)) {
						return -1;
					}
					return get.effect(player, { name: "losehp" }, player, player);
				},
			},
			neg: true,
		},
	},
	zhaxiang: {
		audio: 2,
		audioname2: { ol_sb_jiangwei: "zhaxiang_ol_sb_jiangwei" },
		trigger: { player: "loseHpEnd" },
		filter(event, player) {
			return player.isIn() && event.num > 0;
		},
		getIndex: event => event.num,
		forced: true,
		async content(event, trigger, player) {
			await player.draw(3);
			if (player.isPhaseUsing()) {
				player.addTempSkill(event.name + "_effect");
				player.addMark(event.name + "_effect", 1, false);
			}
		},
		subSkill: {
			effect: {
				mod: {
					targetInRange(card, player, target, now) {
						if (card.name == "sha" && get.color(card) == "red") {
							return true;
						}
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("zhaxiang_effect");
						}
					},
				},
				charlotte: true,
				onremove: true,
				audio: "zhaxiang",
				audioname2: { ol_sb_jiangwei: "zhaxiang_ol_sb_jiangwei" },
				trigger: { player: "useCard" },
				sourceSkill: "zhaxiang",
				filter(event, player) {
					return event.card?.name == "sha" && get.color(event.card) == "red";
				},
				forced: true,
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.players);
				},
				intro: { content: "<li>使用【杀】的次数上限+#<br><li>使用红色【杀】无距离限制且不能被【闪】响应" },
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						return arg?.card?.name == "sha" && get.color(arg.card) == "red";
					},
				},
			},
		},
		ai: {
			maihp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, 1];
						}
						return 1.2;
					}
					if (get.tag(card, "loseHp")) {
						if (target.hp <= 1) {
							return;
						}
						var using = target.isPhaseUsing();
						if (target.hp <= 2) {
							return [1, player.countCards("h") <= 1 && using ? 3 : 0];
						}
						if (using && target.countCards("h", { name: "sha", color: "red" })) {
							return [1, 3];
						}
						return [1, target.countCards("h") <= target.hp || (using && game.hasPlayer(current => current != player && get.attitude(player, current) < 0 && player.inRange(current))) ? 3 : 2];
					}
				},
			},
		},
	},
	zhuhai: {
		audio: 2,
		audioname: ["gz_re_xushu"],
		trigger: { global: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			return event.player.isIn() && event.player.getStat("damage") && lib.filter.targetEnabled({ name: "sha" }, player, event.player) && (player.hasSha() || (_status.connectMode && player.countCards("h") > 0));
		},
		clearTime: true,
		async content(event, trigger, player) {
			await player
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"诛害：是否对" + get.translation(trigger.player) + "使用一张杀？"
				)
				.set("logSkill", "zhuhai")
				.set("complexSelect", true)
				.set("complexTarget", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.targetEnabled.apply(this, arguments);
				})
				.set("sourcex", trigger.player);
		},
	},
	qianxin: {
		skillAnimation: true,
		animationColor: "orange",
		audio: 2,
		juexingji: true,
		trigger: { source: "damageSource" },
		forced: true,
		derivation: "jianyan",
		filter(event, player) {
			return player.hp < player.maxHp;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.addSkills("jianyan");
			await player.loseMaxHp();
		},
	},
	jianyan: {
		selectionSpec: true,
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		delay: false,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.hasSex("male");
			});
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			result = await player
				.chooseControl(["red", "black", "basic", "trick", "equip"])
				.set("ai", function () {
					var player = _status.event.player;
					if (!player.hasShan()) {
						return "basic";
					}
					if (player.countCards("e") <= 1) {
						return "equip";
					}
					if (player.countCards("h") > 2) {
						return "trick";
					}
					return "red";
				})
				.forResult();

			// step 1
			let func = function (card) {
				if (get.color(card) == result.control) {
					return true;
				}
				if (get.type(card, "trick") == result.control) {
					return true;
				}
				return false;
			};
			event.card = get.cardPile(func, "cardPile", "top");
			if (!event.card) {
				if (get.cardPile(func, "discardPile", "top")) {
					await game.washCard();
					event.card = get.cardPile(func, "cardPile", "top");
				}
				if (!event.card) {
					return;
				}
			}
			await player.showCards([event.card]);

			// step 2
			result = await player
				.chooseTarget(true, "选择一名男性角色送出" + get.translation(event.card), function (card, player, target) {
					return target.hasSex("male");
				})
				.set("ai", function (target) {
					var att = get.attitude(_status.event.player, target);
					if (_status.event.neg) {
						return -att;
					}
					return att;
				})
				.set("neg", get.value(event.card, player, "raw") < 0)
				.forResult();

			// step 3
			player.line(result.targets, "green");
			await result.targets[0].gain(event.card, "gain2");
		},
		ai: {
			order: 9,
			result: {
				player(player) {
					if (
						game.hasPlayer(function (current) {
							return current.hasSex("male") && get.attitude(player, current) > 0;
						})
					) {
						return 2;
					}
					return 0;
				},
			},
			threaten: 1.2,
		},
	},
	reguose: {
		selectionSpec: reguoseSelectionSpec,
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		discard: false,
		lose: false,
		delay: false,
		filter(event, player) {
			return player.countCards("hes", { suit: "diamond" }) > 0;
		},
		position: "hes",
		filterCard: { suit: "diamond" },
		filterTarget(card, player, target) {
			if (get.position(ui.selected.cards[0]) != "s" && lib.filter.cardDiscardable(ui.selected.cards[0], player, "reguose") && target.hasJudge("lebu")) {
				return true;
			}
			if (player == target) {
				return false;
			}
			if (!game.checkMod(ui.selected.cards[0], player, "unchanged", "cardEnabled2", player)) {
				return false;
			}
			return player.canUse({ name: "lebu", cards: ui.selected.cards }, target);
		},
		check(card) {
			return 7 - get.value(card);
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (event.target.hasJudge("lebu")) {
				await player.discard(event.cards);
				await target.discard(event.target.getJudge("lebu"));
			} else {
				await player.useCard({ name: "lebu" }, event.target, event.cards).set("audio", false);
			}
			await player.draw();
		},
		ai: {
			result: {
				target(player, target) {
					if (target.hasJudge("lebu")) {
						return -get.effect(target, { name: "lebu" }, player, target);
					}
					return get.effect(target, { name: "lebu" }, player, target);
				},
			},
			order: 9,
		},
	},
};

auditSelectionSpec(retiejiSkills.reguose);
