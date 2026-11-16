import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olweifu" | "olkuansai" | "olcuorui" | "olmouzhu" | "olyanhuo">} */
export const groupSkills = {
	//OL牵招
	olweifu: {
		audio: 2,
		enable: "phaseUse",
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		filter(event, player) {
			return player.hasCard(card => lib.filter.cardDiscardable(card, player), "he");
		},
		check(card) {
			var player = get.player();
			return (5 - get.value(card)) / Math.pow(Math.max(0.1, player.getUseValue(card)), 0.33);
		},
		content() {
			"step 0";
			player
				.judge(card => {
					var evt = get.event().getParent("olweifu");
					if (evt.name !== "olweifu") {
						return 0;
					}
					var cardx = evt.cards[0];
					if (get.type2(card) == get.type2(cardx)) {
						return 0.5;
					}
					return 0.1;
				})
				.set("callback", function () {
					var card = event.judgeResult.card;
					player.addTempSkill("olweifu_clear");
					player.addTempSkill("olweifu_add");
					if (!get.is.object(player.storage.olweifu_add)) {
						player.storage.olweifu_add = {};
					}
					var type = get.type2(card, player);
					if (typeof player.storage.olweifu_add[type] != "number") {
						player.storage.olweifu_add[type] = 0;
					}
					player.storage.olweifu_add[type]++;
					player.markSkill("olweifu_add");
					if (type == get.type2(event.getParent(2).cards[0], player)) {
						player.draw();
					}
				})
				.set("judge2", result => result.bool);
		},
		ai: {
			order: 7,
			result: {
				player(player) {
					return player.hasCard(card => {
						var type = get.type2(card);
						if (type == "equip") {
							return false;
						}
						return (
							player.hasUseTarget(card) &&
							player.getUseValue(card) > 5 &&
							game.countPlayer(current => {
								return lib.filter.targetEnabled2(card, player, current) && get.effect(current, card, player, player) > 0;
							}) +
								1 >
								(get.is.object(player.storage.olweifu_add) ? player.storage.olweifu_add[type] || 0 : 0)
						);
					}, "hs")
						? 1
						: 0;
				},
			},
		},
		subSkill: {
			clear: {
				trigger: { player: "useCard1" },
				filter(event, player) {
					var type = get.type2(event.card);
					if (get.is.object(player.storage.olweifu_add) && typeof player.storage.olweifu_add[type] == "number") {
						return true;
					}
					return false;
				},
				silent: true,
				firstDo: true,
				charlotte: true,
				content() {
					var type = get.type2(trigger.card);
					var num = player.storage.olweifu_add[type];
					delete player.storage.olweifu_add[type];
					if (get.is.empty(player.storage.olweifu_add)) {
						delete player.storage.olweifu_add;
						player.unmarkSkill("olweifu_add");
					}
					trigger._olweifu_clear = num;
				},
			},
			add: {
				trigger: { player: "useCard2" },
				filter(event, player) {
					if (!event._olweifu_clear) {
						return false;
					}
					var info = get.info(event.card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						if (
							game.hasPlayer(current => {
								return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current);
							})
						) {
							return true;
						}
					}
					return false;
				},
				onremove: true,
				charlotte: true,
				direct: true,
				content() {
					"step 0";
					var num = trigger._olweifu_clear;
					player
						.chooseTarget(get.prompt("olweifu"), "为" + get.translation(trigger.card) + "额外指定" + get.cnNumber(num) + "个目标。", [1, num], (card, player, target) => {
							return !_status.event.sourcex.includes(target) && lib.filter.targetEnabled2(_status.event.card, player, target);
						})
						.set("sourcex", trigger.targets)
						.set("ai", function (target) {
							var player = _status.event.player;
							return get.effect(target, _status.event.card, player, player);
						})
						.set("card", trigger.card);
					"step 1";
					if (result.bool) {
						var targets = result.targets;
						player.logSkill("olweifu_add", targets);
						trigger.targets.addArray(targets);
						game.log(targets, "也成为了", trigger.card, "的目标");
						if (!event.isMine() && !event.isOnline()) {
							game.delayex();
						}
					}
				},
				intro: {
					markcount: () => 0,
					content: (storage, player) => {
						if (!get.is.object(storage)) {
							return;
						}
						var str = "使用下一张以下类型的牌无距离限制，且可以额外指定对应数量个目标：";
						for (var type in storage) {
							str += "<li>" + get.translation(type) + "牌：+" + storage[type];
						}
						return str;
					},
				},
				mod: {
					targetInRange: (card, player) => {
						var type = get.type2(card);
						if (get.is.object(player.storage.olweifu_add) && typeof player.storage.olweifu_add[type] == "number") {
							return true;
						}
					},
				},
			},
		},
	},
	olkuansai: {
		audio: 2,
		trigger: { global: "useCardToPlayered" },
		filter(event, player) {
			return event.isFirstTarget && event.targets.length >= player.getHp();
		},
		usable: 1,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.name.slice(0, -5)), "令其中一个目标选择一项：1.交给你一张牌；2.令你回复1点体力。", (card, player, target) => {
					return _status.event.targets.includes(target);
				})
				.set("targets", trigger.targets)
				.set("ai", target => {
					const player = get.player();
					const att = get.attitude(player, target);
					if (att > 0) {
						return 1;
					}
					return (1 - att) / Math.sqrt(1 + target.countCards("he"));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			let position = "e";
			if (player != target) {
				position += "h";
			}
			const forced = player.isHealthy();
			const str = `请交给其一张牌${forced ? "" : "或点击“取消”令其回复1点体力"}。`;
			const bool = !target.countCards(position)
				? false
				: (
						await target
							.chooseToGive(player, `${get.translation(player)}对你发动了【款塞】`, str, position, forced)
							.set("ai", card => {
								const { player, target, recover } = get.event();
								if (recover) {
									return 0;
								}
								if (get.attitude(player, target) > 0) {
									return get.value(card, player) - get.value(card, target);
								}
								if (get.tag(card, "recover")) {
									return -1;
								}
								return 6.5 - get.value(card);
							})
							.set(
								"recover",
								(() => {
									if (forced) {
										return false;
									}
									var recoverEff = get.recoverEffect(player, target, target);
									var att = get.attitude(target, player);
									if (att < 0) {
										if (recoverEff >= 0) {
											return true;
										}
										if (
											target.hasCard(card => {
												return (get.value(card) < 6.5 && !get.tag(card, "recover")) || get.value(card) <= 0.05;
											}, position)
										) {
											return false;
										}
									} else {
										if (recoverEff > 0) {
											return true;
										}
										if (
											target.hasCard(card => {
												return get.value(card, target) < get.value(card, player);
											}, position)
										) {
											return false;
										}
									}
									return true;
								})()
							)
							.forResult()
					).bool;
			if (!bool) {
				await player.recover(target);
			}
		},
	},
	//牛金
	olcuorui: {
		audio: "cuorui",
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
			target: "useCardToTargeted",
		},
		filter(event, player) {
			if (event.name == "useCardToTargeted") {
				return get.type(event.card) == "delay" && !player.hasSkill("olcuorui_skip");
			}
			return (event.name != "phase" || game.phaseNumber == 0) && player.countCards("h") < Math.min(8, game.countPlayer());
		},
		forced: true,
		content() {
			if (trigger.name == "useCardToTargeted") {
				player.skip("phaseJudge");
				player.addTempSkill("olcuorui_skip", { player: "phaseJudgeSkipped" });
			} else {
				player.drawTo(Math.min(8, game.countPlayer()));
			}
		},
		ai: {
			effect: {
				target_use(card, player, target) {
					if (get.type(card) == "delay") {
						return 0.1;
					}
				},
			},
		},
		subSkill: {
			skip: {
				mark: true,
				intro: { content: "跳过下个判定阶段" },
			},
		},
	},
	//何进
	olmouzhu: {
		audio: "mouzhu",
		inherit: "mouzhu",
		async content(event, trigger, player) {
			const target = event.target;
			if (!player.isIn() || !target.countGainableCards(player, "h")) {
				return;
			}
			await target.chooseToGive(player, "h", true);
			if (!player.isIn() || player.countCards("h") <= target.countCards("h")) {
				return;
			}
			let list = ["sha", "juedou"].filter(name => target.hasUseTarget(get.autoViewAs({ name }, []))),
				result;
			if (!list.length) {
				return;
			} else if (list.length == 1) {
				result = { control: list[0] };
			} else {
				result = await target
					.chooseControl(list)
					.set("prompt", "谋诛：视为使用一张【杀】或【决斗】。")
					.set("ai", function (event, player) {
						return player.getUseValue(get.autoViewAs({ name: "sha" }, [])) >= player.getUseValue(get.autoViewAs({ name: "juedou" }, [])) ? "sha" : "juedou";
					})
					.forResult();
			}
			if (result?.control) {
				await target.chooseUseTarget({ name: result.control, isCard: true }, true);
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (
						get.attitude(target, player) > 0 &&
						game.hasPlayer(function (current) {
							if (current == target) {
								return false;
							}
							for (var card of [{ name: "sha" }, { name: "juedou" }]) {
								if (target.canUse(card, current) && get.effect(current, card, target, player) > 0 && get.effect(current, card, target, target) > 0) {
									return true;
								}
							}
							return false;
						}) &&
						target.countCards("h") < player.countCards("h") + 2
					) {
						return 3;
					}
					if (!target.hasValueTarget({ name: "sha" }) && !target.hasValueTarget({ name: "juedou" })) {
						return -2;
					}
					if (target.countCards("h") + 1 > player.countCards("h")) {
						return -2;
					}
					var canSave = function (player, target) {
						return target.hp + player.countCards("hs", card => player.canSaveCard(card, target)) > 1 + ((get.mode() == "identity" && target.identity == "zhu") || (get.mode() == "guozhan" && get.is.jun(target)));
					};
					if (target.hasValueTarget({ name: "sha" })) {
						var aimx = game
							.filterPlayer(current => {
								return target.canUse({ name: "sha" }, current) && get.effect(current, { name: "sha" }, target, target) > 0;
							})
							.sort((a, b) => get.effect(b, { name: "sha" }, target, target) - get.effect(a, { name: "sha" }, target, target))[0];
						if (aimx && get.effect(aimx, { name: "sha" }, target, player) < 0 && get.effect(aimx, { name: "sha" }, target, aimx) < 0 && !canSave(player, aimx)) {
							return 0;
						}
					}
					if (target.hasValueTarget({ name: "juedou" })) {
						var aimy = game
							.filterPlayer(current => {
								return target.canUse({ name: "juedou" }, current) && get.effect(current, { name: "juedou" }, target, target) > 0;
							})
							.sort((a, b) => get.effect(b, { name: "juedou" }, target, target) - get.effect(a, { name: "juedou" }, target, target))[0];
						if (aimy && get.effect(aimy, { name: "juedou" }, target, player) < 0 && get.effect(aimy, { name: "sha" }, target, aimy) < 0 && !canSave(player, aimy)) {
							return 0;
						}
					}
					return -1;
				},
			},
		},
	},
	olyanhuo: {
		audio: "yanhuo",
		trigger: { player: "die" },
		forceDie: true,
		filter(event, player) {
			if (!event.source || !event.source.isIn() || !event.source.countCards("he")) {
				return false;
			}
			return player.countCards("he") > 0;
		},
		check(event, player) {
			return get.effect(event.source, { name: "guohe_copy2" }, player, player) > 0;
		},
		logTarget: "source",
		skillAnimation: true,
		animationColor: "thunder",
		content() {
			player.discardPlayerCard(trigger.source, "he", [1, player.countCards("he")], true).set("forceDie", true);
		},
	},
};
