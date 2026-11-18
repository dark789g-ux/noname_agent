import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczigu" | "dczuowei" | "dcminze" | "dcjini">} */
export const groupSkills = {
	//孙綝
	dczigu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		position: "he",
		selectCard: 1,
		check(card) {
			var player = _status.event.player;
			if (!player.hasSkill("dczuowei")) {
				return 6 - get.value(card);
			}
			if (player.countCards("h") == player.countCards("e") + 1 && !player.hasCard(card => player.hasValueTarget(card), "h")) {
				if (get.position(card) == "e") {
					return 0;
				}
				return 8 - get.value(card);
			}
			return 6 - get.value(card);
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			const targets = game.filterPlayer(current => {
				return current.countGainableCards(player, "e");
			});
			if (targets.length == 0) {
				result = { bool: false };
			} else if (targets.length == 1) {
				result = { bool: true, targets: targets };
			} else {
				result = await player
					.chooseTarget("自固：获得一名角色装备区里的一张牌", true, (card, player, target) => {
						return target.countGainableCards(player, "e");
					})
					.set("ai", target => {
						if (target == _status.event.player) {
							return 10;
						}
						if (get.attitude(_status.event.player, target) < 0) {
							if (
								target.hasCard(card => {
									return get.value(card, player) >= 6;
								})
							) {
								return 12;
							}
							return 8;
						}
						return 0;
					})
					.forResult();
			}
			// step 1
			let target;
			if (result.bool) {
				target = result.targets[0];
				event.target = target;
				result = await player.gainPlayerCard("e", target, true).forResult();
			}
			// step 2
			if (!result.bool || target == player || !result.cards || !result.cards.some(i => get.owner(i) == player)) {
				await player.draw();
			}
		},
		ai: {
			order(item, player) {
				if (!player.hasSkill("dczuowei")) {
					return 9;
				}
				if (player.countCards("h") == player.countCards("e") + 1 && !player.hasCard(card => player.hasValueTarget(card), "h")) {
					return 9;
				}
				return 1;
			},
			result: {
				player: 1,
			},
		},
	},
	dczuowei: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (_status.currentPhase != player) {
				return false;
			}
			if (!player.hasSkill("dczuowei_ban")) {
				return true;
			}
			return Math.sign(player.countCards("h") - Math.max(1, player.countCards("e"))) >= 0;
		},
		direct: true,
		locked: false,
		async content(event, trigger, player) {
			let result;
			const hs = player.countCards("h");
			const es = Math.max(1, player.countCards("e"));
			const sign = Math.sign(hs - es);
			if (sign > 0) {
				result = await player
					.chooseBool(get.prompt("dczuowei"), "令" + get.translation(trigger.card) + "不可被响应")
					.set("ai", () => 1)
					.forResult();
			} else if (sign == 0) {
				result = await player
					.chooseTarget(get.prompt("dczuowei"), "对一名其他角色造成1点伤害", lib.filter.notMe)
					.set("ai", target => {
						return get.damageEffect(target, _status.event.player, _status.event.player);
					})
					.forResult();
			} else {
				result = await player
					.chooseBool(get.prompt("dczuowei"), "摸两张牌，然后本回合你不能再触发该分支")
					.set("ai", () => 1)
					.forResult();
			}
			if (!result.bool) {
				return;
			}
			if (sign <= 0 && !event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			if (sign > 0) {
				player.logSkill("dczuowei");
				trigger.directHit.addArray(game.players);
				return;
			}
			if (sign == 0) {
				const target = result.targets[0];
				player.logSkill("dczuowei", target);
				await target.damage();
				return;
			}
			player.logSkill("dczuowei");
			await player.draw(2);
			player.addTempSkill("dczuowei_ban");
		},
		subSkill: {
			ban: { charlotte: true },
		},
		mod: {
			aiValue(player, card, num) {
				if (_status.currentPhase != player) {
					return;
				}
				const event = get.event();
				if (!player.isPhaseUsing()) {
					return;
				}
				if (event.type != "phase") {
					return;
				}
				const cardsh = [],
					cardse = [];
				for (const cardx of ui.selected.cards) {
					const pos = get.position(cardx);
					if (pos == "h") {
						cardsh.add(cardx);
					} else if (pos == "e") {
						cardse.add(cardx);
					}
				}
				const hs = player.countCards("h") - cardsh.length,
					es = Math.max(1, player.countCards("e") - cardse.length);
				const delt = hs - es;
				if (delt <= 0) {
					return;
				}
				if (get.position(card) == "h" && delt == 1) {
					return num / 1.25;
				}
			},
			aiUseful() {
				return lib.skill.dczuowei.mod.aiValue.apply(this, arguments);
			},
			aiOrder(player, card, num) {
				if (player.hasSkill("dczuowei_ban") || _status.currentPhase != player) {
					return;
				}
				const cardsh = [],
					cardse = [];
				const pos = get.position(card);
				if (pos == "h") {
					cardsh.add(card);
				} else if (pos == "e") {
					cardse.add(card);
				}
				if (get.tag(card, "draw") || get.tag(card, "gain")) {
					const hs = player.countCards("h") - cardsh.length,
						es = Math.max(1, player.countCards("e") - cardse.length + (get.type(card) == "equip"));
					if ((player.hasSkill("dczuowei_ban") && hs < es) || hs == es) {
						return num + 10;
					}
					return num / 5;
				}
			},
		},
		ai: {
			threaten: 3,
			reverseEquip: true,
			effect: {
				player_use(card, player, target, current) {
					if (_status.currentPhase != player) {
						return;
					}
					let cha = player.countCards("h") - Math.max(1, player.countCards("e"));
					if (cha == 0 || (cha < 0 && !player.hasSkill("dczuowei_ban"))) {
						return [1, 2];
					}
				},
			},
		},
	},
	//刘宠骆俊
	dcminze: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			if (player.getStorage("dcminze_targeted").includes(target)) {
				return false;
			}
			return target.countCards("h") < player.countCards("h");
		},
		filterCard(card, player) {
			if (!ui.selected.cards.length) {
				return true;
			}
			return get.name(ui.selected.cards[0]) != get.name(card);
		},
		selectCard: [1, 2],
		complexCard: true,
		position: "he",
		discard: false,
		lose: false,
		delay: false,
		group: "dcminze_draw",
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.give(cards, target);
			player.addTempSkill("dcminze_targeted", "phaseUseAfter");
			player.markAuto("dcminze_targeted", [target]);
			player.addTempSkill("dcminze_given");
			player.markAuto(
				"dcminze_given",
				cards.map(card => get.name(card, player))
			);
		},
		ai: {
			order: 6.5,
			expose: 0.2,
		},
		subSkill: {
			targeted: { onremove: true, charlotte: true },
			given: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "本回合以此法交出的牌名：$",
				},
			},
			draw: {
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return player.getStorage("dcminze_given").length;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const num = Math.min(5, player.getStorage("dcminze_given").length) - player.countCards("h");
					if (num > 0) {
						player.draw(num);
					}
				},
			},
		},
	},
	dcjini: {
		audio: 2,
		trigger: { player: "damageEnd" },
		direct: true,
		filter(event, player) {
			return player.maxHp - player.countMark("dcjini_counted") > 0;
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			result = await player
				.chooseCard(get.prompt2("dcjini"), [1, player.maxHp - player.countMark("dcjini_counted")], lib.filter.cardRecastable)
				.set("ai", card => {
					return 6 - get.value(card);
				})
				.forResult();
			// step 1
			if (result.bool) {
				const cards = result.cards;
				player.logSkill("dcjini");
				player.addTempSkill("dcjini_counted");
				player.addMark("dcjini_counted", cards.length, false);
				event.recast = player.recast(cards);
				await event.recast;
			} else {
				return;
			}
			// step 2
			if (trigger.source && trigger.source.isIn() && player.hasHistory("gain", evt => evt.getParent(2) == event.recast && evt.cards.some(value => get.name(value) == "sha"))) {
				await player
					.chooseToUse(
						function (card) {
							if (get.name(card) != "sha") {
								return false;
							}
							return lib.filter.filterCard.apply(this, arguments);
						},
						"击逆：是否对" + get.translation(trigger.source) + "使用一张不可被响应的杀？"
					)
					.set("complexSelect", true)
					.set("filterTarget", function (card, player, target) {
						if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
							return false;
						}
						return lib.filter.targetEnabled.apply(this, arguments);
					})
					.set("sourcex", trigger.source)
					.set("oncard", () => {
						_status.event.directHit.addArray(game.players);
					});
			}
		},
		subSkill: {
			counted: {
				onremove: true,
				charlotte: true,
			},
		},
	},
};
