import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const reqiaobianSkills = {
	//OL界张郃
	reqiaobian: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async content(event, trigger, player) {
			player.addMark("reqiaobian", 2);
			await game.delayx();
		},
		marktext: "变",
		intro: {
			name2: "变",
			content(storage, player) {
				var str = "共有" + (storage || 0) + "个标记";
				if (player.storage.reqiaobian_jieshu) {
					str = "<li>" + str + "<br><li>已记录手牌数：" + get.translation(player.storage.reqiaobian_jieshu);
				}
				return str;
			},
		},
		group: ["reqiaobian_judge", "reqiaobian_draw", "reqiaobian_use", "reqiaobian_discard", "reqiaobian_jieshu"],
		subSkill: {
			judge: {
				audio: "reqiaobian",
				trigger: { player: "phaseJudgeBefore" },
				direct: true,
				filter(event, player) {
					return player.hasMark("reqiaobian") || player.hasCard(card => lib.filter.cardDiscardable(card, player, "reqiaobian_judge"), "he");
				},
				check(event, player) {
					return player.hasCard(function (card) {
						return (
							get.effect(
								player,
								{
									name: card.viewAs || card.name,
									cards: [card],
								},
								player,
								player
							) < 0
						);
					}, "j");
				},
				async content(event, trigger, player) {
					let result;

					// step 0
					var choices = [];
					if (player.hasMark("reqiaobian")) {
						choices.push("弃置标记");
					}
					if (player.hasCard(card => lib.filter.cardDiscardable(card, player, "reqiaobian_judge"), "he")) {
						choices.push("弃置牌");
					}
					choices.push("cancel2");
					result = await player
						.chooseControl(choices)
						.set("prompt", "巧变：是否跳过判定阶段？")
						.set("ai", function () {
							var evt = _status.event;
							if (lib.skill[evt.getParent().name].check(evt.getTrigger(), evt.player)) {
								return 0;
							}
							return "cancel2";
						})
						.forResult();

					// step 1
					if (result.control != "cancel2") {
						if (result.control == "弃置牌") {
							const discardResult = await player.chooseToDiscard("he", true).forResult();
							discardResult.logSkill = event.name;
						} else {
							player.logSkill(event.name);
							player.removeMark("reqiaobian", 1);
						}

						// step 2
						trigger.cancel();
					}
				},
			},
			draw: {
				audio: "reqiaobian",
				trigger: { player: "phaseDrawBefore" },
				direct: true,
				filter(event, player) {
					return player.hasMark("reqiaobian") || player.hasCard(card => lib.filter.cardDiscardable(card, player, "reqiaobian_judge"), "he");
				},
				check(event, player) {
					return (
						game.countPlayer(function (current) {
							if (current == player || current.countGainableCards(player, "h") == 0) {
								return false;
							}
							var att = get.attitude(player, current);
							if (current.hasSkill("tuntian")) {
								return att > 0;
							}
							return att < 1;
						}) > 1
					);
				},
				async content(event, trigger, player) {
					let result;

					// step 0
					var choices = [];
					if (player.hasMark("reqiaobian")) {
						choices.push("弃置标记");
					}
					if (player.hasCard(card => lib.filter.cardDiscardable(card, player, "reqiaobian_draw"), "he")) {
						choices.push("弃置牌");
					}
					choices.push("cancel2");
					result = await player
						.chooseControl(choices)
						.set("prompt", "巧变：是否跳过摸牌阶段？")
						.set("ai", function () {
							var evt = _status.event;
							if (lib.skill[evt.getParent().name].check(evt.getTrigger(), evt.player)) {
								return 0;
							}
							return "cancel2";
						})
						.forResult();

					// step 1
					if (result.control != "cancel2") {
						if (result.control == "弃置牌") {
							const discardResult = await player.chooseToDiscard("he", true).forResult();
							discardResult.logSkill = event.name;
						} else {
							player.logSkill(event.name);
							player.removeMark("reqiaobian", 1);
						}

						// step 2
						trigger.cancel();
						if (game.hasPlayer(current => current.countGainableCards(player, "h") > 0)) {
							result = await player
								.chooseTarget("是否获得至多两名其他角色的各一张手牌？", [1, 2], function (card, player, target) {
									return target != player && target.countGainableCards(player, "h") > 0;
								})
								.set("ai", function (target) {
									var att = get.attitude(_status.event.player, target);
									if (target.hasSkill("tuntian")) {
										return att / 10;
									}
									return 1 - att;
								})
								.forResult();

							// step 3
							if (result.bool) {
								var targets = result.targets.sortBySeat();
								player.line(targets, "green");
								await player.gainMultiple(targets).forResult();
							}
						}
					}
				},
			},
			use: {
				audio: "reqiaobian",
				trigger: { player: "phaseUseBefore" },
				direct: true,
				filter(event, player) {
					return player.hasMark("reqiaobian") || player.hasCard(card => lib.filter.cardDiscardable(card, player, "reqiaobian_judge"), "he");
				},
				check(event, player) {
					if (
						player.countCards("h", function (card) {
							return player.hasValueTarget(card, null, true);
						}) > 1
					) {
						return false;
					}
					return game.hasPlayer(function (current) {
						var att = get.sgn(get.attitude(player, current));
						if (att != 0) {
							var es = current.getCards("e");
							for (var i = 0; i < es.length; i++) {
								if (
									game.hasPlayer(function (current2) {
										if (get.sgn(get.value(es[i], current)) != -att || get.value(es[i], current) < 5) {
											return false;
										}
										var att2 = get.sgn(get.attitude(player, current2));
										if (att == att2 || att2 != get.sgn(get.effect(current2, es[i], player, current2))) {
											return false;
										}
										return current != current2 && !current2.isMin() && current2.canEquip(es[i]);
									})
								) {
									return true;
								}
							}
						}
						if (att > 0) {
							var js = current.getCards("j", function (card) {
								return (
									get.effect(
										current,
										{
											name: card.viewAs || card.name,
											cards: [card],
										},
										current,
										current
									) < -2
								);
							});
							for (var i = 0; i < js.length; i++) {
								if (
									game.hasPlayer(function (current2) {
										var att2 = get.attitude(player, current2);
										if (att2 >= 0) {
											return false;
										}
										return current != current2 && current2.canAddJudge(js[i]);
									})
								) {
									return true;
								}
							}
						}
					});
				},
				async content(event, trigger, player) {
					let result;

					// step 0
					var choices = [];
					if (player.hasMark("reqiaobian")) {
						choices.push("弃置标记");
					}
					if (player.hasCard(card => lib.filter.cardDiscardable(card, player, "reqiaobian_use"), "he")) {
						choices.push("弃置牌");
					}
					choices.push("cancel2");
					result = await player
						.chooseControl(choices)
						.set("prompt", "巧变：是否跳过出牌阶段？")
						.set("ai", function () {
							var evt = _status.event;
							if (lib.skill[evt.getParent().name].check(evt.getTrigger(), evt.player)) {
								return 0;
							}
							return "cancel2";
						})
						.forResult();

					// step 1
					if (result.control != "cancel2") {
						if (result.control == "弃置牌") {
							const discardResult = await player.chooseToDiscard("he", true).forResult();
							discardResult.logSkill = event.name;
						} else {
							player.logSkill(event.name);
							player.removeMark("reqiaobian", 1);
						}

						// step 2
						trigger.cancel();
						await player.moveCard().forResult();
					}
				},
			},
			discard: {
				audio: "reqiaobian",
				trigger: { player: "phaseDiscardBefore" },
				direct: true,
				filter(event, player) {
					return player.hasMark("reqiaobian") || player.hasCard(card => lib.filter.cardDiscardable(card, player, "reqiaobian_judge"), "he");
				},
				check(event, player) {
					return player.needsToDiscard();
				},
				async content(event, trigger, player) {
					let result;

					// step 0
					var choices = [];
					if (player.hasMark("reqiaobian")) {
						choices.push("弃置标记");
					}
					if (player.hasCard(card => lib.filter.cardDiscardable(card, player, "reqiaobian_discard"), "he")) {
						choices.push("弃置牌");
					}
					choices.push("cancel2");
					result = await player
						.chooseControl(choices)
						.set("prompt", "巧变：是否跳过弃牌阶段？")
						.set("ai", function () {
							var evt = _status.event;
							if (lib.skill[evt.getParent().name].check(evt.getTrigger(), evt.player)) {
								return 0;
							}
							return "cancel2";
						})
						.forResult();

					// step 1
					if (result.control != "cancel2") {
						if (result.control == "弃置牌") {
							const discardResult = await player.chooseToDiscard("he", true).forResult();
							discardResult.logSkill = event.name;
						} else {
							player.logSkill(event.name);
							player.removeMark("reqiaobian", 1);
						}

						// step 2
						trigger.cancel();
					}
				},
			},
			jieshu: {
				audio: "reqiaobian",
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				filter(event, player) {
					return !player.getStorage("reqiaobian_jieshu").includes(player.countCards("h"));
				},
				async content(event, trigger, player) {
					player.addMark("reqiaobian", 1);
					player.markAuto("reqiaobian_jieshu", [player.countCards("h")]);
					player.storage.reqiaobian_jieshu.sort();
				},
			},
		},
	},
	//十周年徐庶
	rezhuhai: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			return player != event.player && event.player.getHistory("sourceDamage").length > 0 && event.player.isIn() && (player.countCards("h") > 0 || player.canUse("guohe", event.player));
		},
		async content(event, trigger, player) {
			const target = trigger.player;
			let result;

			// step 0
			var choiceList = ["将一张手牌当做【杀】对其使用", "视为对其使用一张【过河拆桥】"];
			var bool = false,
				hs = player.getCards("h");
			for (var i of hs) {
				if (game.checkMod(i, player, "unchanged", "cardEnabled2", player) !== false && player.canUse(get.autoViewAs({ name: "sha" }, [i]), target, false)) {
					bool = true;
					break;
				}
			}
			var choices = [];
			if (bool) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			if (player.canUse("guohe", target)) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			choices.push("cancel2");
			result = await player
				.chooseControl(choices)
				.set("choiceList", choiceList)
				.set("prompt", get.prompt("rezhuhai", target))
				.set("ai", function () {
					var choices = _status.event.controls;
					var eff1 = 0,
						eff2 = 0;
					var player = _status.event.player,
						target = _status.event.getTrigger().player;
					if (choices.includes("选项一")) {
						eff1 = get.effect(target, { name: "sha" }, player, player);
					}
					if (choices.includes("选项二")) {
						eff2 = get.effect(target, { name: "guohe" }, player, player);
					}
					if (eff1 > 0 && ((player.hasSkill("xsqianxin") && player.isDamaged()) || eff1 > eff2)) {
						return "选项一";
					}
					if (eff2 > 0) {
						return "选项二";
					}
					return "cancel2";
				})
				.forResult();

			// step 1
			if (result.control != "cancel2") {
				if (result.control == "选项一") {
					result = await player
						.chooseCard(
							"h",
							true,
							function (card, player) {
								if (!game.checkMod(card, player, "unchanged", "cardEnabled2", player)) {
									return false;
								}
								return player.canUse(get.autoViewAs({ name: "sha" }, [card]), _status.event.getTrigger().player, false);
							},
							"选择一张手牌当做【杀】对" + get.translation(trigger.player) + "使用"
						)
						.set("ai", function (card) {
							var player = _status.event.player;
							return get.effect(_status.event.getTrigger().player, get.autoViewAs({ name: "sha" }, [card]), player, player) / Math.max(1, get.value(card));
						})
						.forResult();

					// step 2
					if (result.bool) {
						await player.useCard({ name: "sha" }, result.cards, "rezhuhai", trigger.player, false).forResult();
					}
				} else {
					await player.useCard({ name: "guohe", isCard: true }, trigger.player, "rezhuhai").forResult();
				}
			}
		},
	},
	xsqianxin: {
		audio: 2,
		trigger: { source: "damageSource" },
		juexingji: true,
		forced: true,
		skillAnimation: true,
		animationColor: "orange",
		filter(event, player) {
			return player.isDamaged();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp();
			await player.addSkills("rejianyan");
		},
		derivation: "rejianyan",
	},
};
