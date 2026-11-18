import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcyinlu">} */
export const groupSkills = {
	//孟节
	dcyinlu: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		derivation: ["dcyinlu_lequan", "dcyinlu_huoxi", "dcyinlu_zhangqi", "dcyinlu_yunxiang"],
		global: ["dcyinlu_lequan", "dcyinlu_huoxi", "dcyinlu_zhangqi", "dcyinlu_yunxiang"],
		group: "dcyinlu_move",
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		hasMark(target) {
			return lib.skill.dcyinlu.derivation.some(i => target.hasMark(i));
		},
		async content(event, trigger, player) {
			event.marks = lib.skill.dcyinlu.derivation.slice(0, 3);
			if (game.countPlayer() > 2) {
				const result = await player
					.chooseTarget("引路：令三名角色分别获得〖引路〗标记", true, 3)
					.set("targetprompt", () => {
						return get.translation(lib.skill.dcyinlu.derivation[ui.selected.targets.length - 1]);
					})
					.set("complexSelect", true)
					.set("ai", target => {
						const player = _status.event.player;
						if (ui.selected.targets.length == 2) {
							return get.effect(target, { name: "losehp" }, player, player);
						}
						return get.attitude(player, target);
					})
					.forResult();
				if (result.bool) {
					const targets = result.targets;
					player.line(targets);
					for (let i = 0; i < targets.length; i++) {
						targets[i].addMark(event.marks[i]);
						if (player != targets[i] && targets[i].identityShown) {
							if (get.mode() != "identity" || player.identity != "nei") {
								player.addExpose(0.3);
							}
						}
					}
				}
			} else {
				player.logSkill("dcyinlu", game.players);
				const list = [];
				for (const mark of event.marks) {
					list.push([mark, '<div class="popup text" style="width:calc(100% - 10px);display:inline-block"><div class="skill">【' + get.translation(mark) + "】</div><div>" + lib.translate[mark + "_info"] + "</div></div>"]);
				}
				let target = game.filterPlayer(i => i != player)[0];
				if (!game.hasPlayer(current => current != player)) {
					target = player;
				}
				event.target = target;
				const result = await player
					.chooseButton(["引路：令" + get.translation(target) + "获得2枚〖引路〗标记", [list, "textbutton"]])
					.set("ai", button => {
						const mark = button.link;
						if (mark == "dcyinlu_lequan") {
							return 9;
						}
						if (mark == "dcyinlu_zhangqi") {
							return 10;
						}
						return 8;
					})
					.set("forced", true)
					.set("selectButton", 2)
					.set("forcebutton", true)
					.forResult();
				if (result.bool) {
					const marks = result.links;
					for (const mark of marks) {
						target.addMark(mark, 1);
					}
					if (player != target && target.identityShown) {
						if (get.mode() != "identity" || player.identity != "nei") {
							player.addExpose(0.3);
						}
					}
					event.marks.removeArray(marks);
					for (const mark of event.marks) {
						player.addMark(mark, 1);
					}
				}
			}
			player.addMark("dcyinlu_yunxiang", 1);
			player.addMark("dcyinlu_xiang", 1);
			game.log(player, "获得了1点芸香值");
		},
		subSkill: {
			move: {
				audio: "dcyinlu",
				trigger: {
					player: "phaseZhunbeiBegin",
					global: "die",
				},
				direct: true,
				filter(event, player) {
					if (event.name == "die") {
						return lib.skill.dcyinlu.hasMark(event.player);
					}
					return game.hasPlayer(current => {
						return lib.skill.dcyinlu.hasMark(current);
					});
				},
				async content(event, trigger, player) {
					if (trigger.name != "die") {
						if (_status.connectMode) {
							game.broadcastAll(function () {
								_status.noclearcountdown = true;
							});
						}
						try {
							const targetResult = await player
								.chooseTarget(get.prompt("dcyinlu_move"), "移动一名角色的〖引路〗标记", 2, (card, player, target) => {
									if (ui.selected.targets.length == 0) {
										return lib.skill.dcyinlu.hasMark(target);
									}
									return true;
								})
								.set("ai", target => {
									const player = _status.event.player;
									if (ui.selected.targets.length == 0) {
										const owned = lib.skill.dcyinlu.derivation.filter(i => target.hasMark(i));
										const att = get.attitude(player, target);
										if (att > 0) {
											if (owned.includes("dcyinlu_zhangqi")) {
												return target.hasCard({ suit: "spade" }, "he") ? 5 : 10;
											}
											if (
												owned.includes("dcyinlu_lequan") &&
												target.isHealthy() &&
												game.hasPlayer(current => {
													return current != target && get.recoverEffect(current, player, player) > 0;
												})
											) {
												return 2;
											}
											return 0;
										}
										if (att < 0) {
											if (owned.some(i => i != "dcyinlu_zhangqi")) {
												return 8;
											}
											return 0;
										}
										if (
											owned.includes("dcyinlu_zhangqi") &&
											game.hasPlayer(current => {
												return current != target && get.effect(current, { name: "losehp" }, player, player) > 0;
											})
										) {
											return 3;
										}
										return 1;
									} else {
										const targetx = ui.selected.targets[0];
										const att = get.attitude(player, targetx),
											att2 = get.attitude(player, target);
										const owned = lib.skill.dcyinlu.derivation.filter(i => targetx.hasMark(i));
										if (att > 0) {
											if (owned.includes("dcyinlu_zhangqi")) {
												return -att2;
											}
											if (owned.includes("dcyinlu_lequan")) {
												return get.recoverEffect(target, player, player);
											}
										} else if (att < 0) {
											if (owned.some(i => i != "dcyinlu_zhangqi")) {
												return att2;
											}
										} else {
											if (owned.includes("dcyinlu_zhangqi")) {
												return get.effect(target, { name: "losehp" }, player, player);
											}
											return att2;
										}
									}
									return Math.random();
								})
								.set("complexTarget", true)
								.forResult();
							if (!targetResult.bool) {
								return;
							}
							const marks = lib.skill.dcyinlu.derivation;
							const targets = targetResult.targets;
							const owned = marks.filter(mark => targets[0].hasMark(mark));
							let mark;
							if (owned.length == 1) {
								mark = owned[0];
							} else {
								const controlResult = await player
									.chooseControl(owned)
									.set("prompt", "引路：选择要移动" + get.translation(targets[0]) + "的标记")
									.set(
										"choiceList",
										owned.map(mark => {
											return '<div class="skill">【' + get.translation(mark) + "】</div><div>" + lib.translate[mark + "_info"] + "</div>";
										})
									)
									.set("displayIndex", false)
									.set("ai", () => {
										return _status.event.choice;
									})
									.set(
										"choice",
										(function () {
											const att = get.attitude(player, targets[0]),
												att2 = get.attitude(player, targets[1]);
											if (att > 0) {
												if (owned.includes("dcyinlu_zhangqi") && att2 < 0) {
													return "dcyinlu_zhangqi";
												}
												if (owned.includes("dcyinlu_lequan") && att2 > 0) {
													return "dcyinlu_lequan";
												}
											} else if (att < 0) {
												const marksx = owned.filter(i => i != "dcyinlu_zhangqi");
												if (marksx.length && att2 > 0) {
													return marksx[0];
												}
												return owned[0];
											} else {
												if (owned.includes("dcyinlu_zhangqi")) {
													return "dcyinlu_zhangqi";
												}
											}
											if (owned.length > 1) {
												owned.remove("dcyinlu_zhangqi");
											}
											return owned[0];
										})()
									)
									.forResult();
								mark = controlResult.control;
							}
							const count = targets[0].countMark(mark);
							player.logSkill("dcyinlu_move", targets, false);
							player.line2(targets, mark == "dcyinlu_zhangqi" ? "fire" : "green");
							targets[0].removeMark(mark, count);
							targets[1].addMark(mark, count);
							if (player != targets[1] && targets[1].identityShown) {
								if (get.mode() != "identity" || player.identity != "nei") {
									player.addExpose(0.3);
								}
							}
							return;
						} finally {
							if (_status.connectMode) {
								game.broadcastAll(function () {
									delete _status.noclearcountdown;
									game.stopCountChoose();
								});
							}
						}
					}

					event.marks = lib.skill.dcyinlu.derivation.filter(mark => trigger.player.hasMark(mark));
					while (event.marks.length) {
						const mark = event.marks[0];
						const result = await player
							.chooseTarget("引路：是否转移“" + get.translation(mark) + "”标记？")
							.set("ai", target => {
								const player = _status.event.player,
									mark = _status.event.mark;
								if (mark == "dcyinlu_zhangqi") {
									return get.effect(target, { name: "losehp" }, player, player) + 0.1;
								}
								if (mark == "dcyinlu_lequan") {
									return get.recoverEffect(target, player, player) + get.attitude(player, target) / 5;
								}
								return get.attitude(player, target);
							})
							.set("mark", mark)
							.forResult();
						if (result.bool) {
							const target = result.targets[0];
							player.logSkill("dcyinlu_move", target);
							const count = trigger.player.countMark(mark);
							trigger.player.removeMark(mark, count, false);
							target.addMark(mark, count);
							if (player != target && target.identityShown) {
								if (get.mode() != "identity" || player.identity != "nei") {
									player.addExpose(0.3);
								}
							}
						}
						event.marks.shift();
					}
				},
			},
			lequan: {
				trigger: { player: "phaseJieshuBegin" },
				direct: true,
				charlotte: true,
				filter(event, player) {
					return player.hasMark("dcyinlu_lequan") && game.hasPlayer(current => current.hasSkill("dcyinlu"));
				},
				marktext: "乐",
				intro: {
					name: "乐泉",
					name2: "乐泉",
					markcount: () => 0,
					content: "结束阶段，你可以弃置一张♦牌，然后回复1点体力。",
				},
				async content(event, trigger, player) {
					const result = await player
						.chooseToDiscard("乐泉：是否弃置一张♦牌，然后回复1点体力？", { suit: "diamond" }, "he")
						.set("ai", card => {
							if (_status.event.goon) {
								return 7 - get.value(card);
							}
							return 0;
						})
						.set("logSkill", "dcyinlu_lequan")
						.set("goon", get.recoverEffect(player, player))
						.forResult();
					if (result.bool) {
						await player.recover();
					}
				},
			},
			huoxi: {
				trigger: { player: "phaseJieshuBegin" },
				direct: true,
				charlotte: true,
				filter(event, player) {
					return player.hasMark("dcyinlu_huoxi") && game.hasPlayer(current => current.hasSkill("dcyinlu"));
				},
				marktext: "藿",
				intro: {
					name: "藿溪",
					name2: "藿溪",
					markcount: () => 0,
					content: "结束阶段，你可以弃置一张♥牌，然后摸两张牌。",
				},
				async content(event, trigger, player) {
					const result = await player
						.chooseToDiscard("藿溪：是否弃置一张♥牌，然后摸两张牌？", { suit: "heart" }, "he")
						.set("ai", card => {
							return 6 - get.value(card);
						})
						.set("logSkill", "dcyinlu_huoxi")
						.forResult();
					if (result.bool) {
						await player.draw(2);
					}
				},
			},
			zhangqi: {
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				direct: true,
				charlotte: true,
				filter(event, player) {
					return player.hasMark("dcyinlu_zhangqi") && game.hasPlayer(current => current.hasSkill("dcyinlu"));
				},
				marktext: "瘴",
				intro: {
					name: "瘴气",
					name2: "瘴气",
					markcount: () => 0,
					content: "锁定技。结束阶段，你须弃置一张♠牌，否则失去1点体力。",
				},
				async content(event, trigger, player) {
					const result = await player
						.chooseToDiscard("瘴气：弃置一张♠牌，或失去1点体力", { suit: "spade" }, "he")
						.set("ai", card => {
							if (_status.event.goon) {
								return 7 - get.value(card);
							}
							return 0;
						})
						.set("logSkill", "dcyinlu_zhangqi")
						.set("goon", get.effect(player, { name: "losehp" }, player) < 0)
						.forResult();
					if (!result.bool) {
						player.logSkill("dcyinlu_zhangqi");
						await player.loseHp();
					}
				},
			},
			yunxiang: {
				trigger: { player: ["phaseJieshuBegin", "damageBegin4"] },
				direct: true,
				charlotte: true,
				filter(event, player) {
					if (!game.hasPlayer(current => current.hasSkill("dcyinlu"))) {
						return false;
					}
					if (event.name == "phaseJieshu") {
						return player.hasMark("dcyinlu_yunxiang");
					}
					return player.hasMark("dcyinlu_yunxiang") && player.hasMark("dcyinlu_xiang");
				},
				onremove(player) {
					delete player.storage.dcyinlu_xiang;
				},
				marktext: "芸",
				intro: {
					name: "芸香",
					name2: "芸香",
					markcount(storage, player) {
						return player.countMark("dcyinlu_xiang");
					},
					content(storage, player) {
						return "①结束阶段，你可以弃置一张♣牌，获得1点“芸香”值。②当你受到伤害时，你可以扣减所有“芸香”值，减少等量的伤害。<li>当前芸香值：" + player.countMark("dcyinlu_xiang");
					},
				},
				async content(event, trigger, player) {
					let result;
					if (trigger.name == "phaseJieshu") {
						result = await player
							.chooseToDiscard("芸香：是否弃置一张♣牌，获得1枚“香”？", { suit: "club" }, "he")
							.set("ai", card => {
								return 6 - get.value(card) + 2.5 * _status.event.player.countMark("dcyinlu_xiang");
							})
							.set("logSkill", "dcyinlu_yunxiang")
							.forResult();
					} else {
						result = await player
							.chooseBool("芸香：是否移去所有“香”，令此伤害-" + player.countMark("dcyinlu_xiang") + "？")
							.set("ai", () => {
								return _status.event.bool;
							})
							.set("bool", get.damageEffect(player, trigger.source, player) < 0)
							.forResult();
					}
					if (result.bool) {
						if (trigger.name == "phaseJieshu") {
							player.addMark("dcyinlu_xiang", 1, false);
							game.log(player, "获得了1点芸香值");
						} else {
							player.logSkill("dcyinlu_yunxiang");
							var num = player.countMark("dcyinlu_xiang");
							player.removeMark("dcyinlu_xiang", num, false);
							game.log(player, "扣减了", num, "点芸香值");
							trigger.num = Math.max(0, trigger.num - num);
						}
					}
				},
			},
		},
	},
};
