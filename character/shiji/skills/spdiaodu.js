import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "spdiaodu" | "spdiancai" | "mbdiaodu" | "mbdiancai" | "spyanji" | "spjianyi" | "spshangyi">} */
export const groupSkills = {
	//吕范
	spdiaodu: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		content() {
			"step 0";
			player.chooseTarget(get.prompt("spdiaodu"), "令一名角色摸一张牌，然后移动其装备区内的一张牌").set("ai", function (target) {
				var player = _status.event.player,
					att = get.attitude(player, target);
				if (att > 0) {
					if (
						target.hasCard(function (card) {
							if (
								get.value(card, target) <= 0 &&
								game.hasPlayer(function (current) {
									return current != target && current.canEquip(card, false) && get.effect(current, card, player, player) > 0;
								})
							) {
								return true;
							}
							return false;
						}, "e")
					) {
						return 2 * att;
					}
					if (
						!target.hasCard(function (card) {
							return game.hasPlayer(function (current) {
								return current != target && current.canEquip(card);
							});
						}, "e")
					) {
						return 1;
					}
				} else if (att < 0) {
					if (
						target.hasCard(function (card) {
							if (
								get.value(card, target) >= 4.5 &&
								game.hasPlayer(function (current) {
									return current != target && current.canEquip(card) && get.effect(current, card, player, player) > 0;
								})
							) {
								return true;
							}
							return false;
						}, "e")
					) {
						return -att;
					}
				}
				return 0;
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("spdiaodu", target);
				target.draw();
			} else {
				event.finish();
			}
			"step 2";
			var es = target.getCards("e", function (card) {
				return game.hasPlayer(function (current) {
					return current != target && current.canEquip(card);
				});
			});
			if (es.length) {
				if (es.length == 1) {
					event._result = { bool: true, links: es };
				} else {
					player.chooseButton(["移动" + get.translation(target) + "的一张装备牌", es], true).set("ai", function (button) {
						var player = _status.event.player,
							target = _status.event.getParent().target,
							card = button.link;
						if (
							game.hasPlayer(function (current) {
								return current != target && current.canEquip(card) && get.effect(current, card, player, player) > 0;
							})
						) {
							return -get.value(card, target) * get.attitude(player, target);
						}
						return 0;
					});
				}
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				event.card = result.links[0];
				player
					.chooseTarget(true, "选择" + get.translation(event.card) + "的移动目标", function (card, player, target) {
						return target.canEquip(_status.event.card);
					})
					.set("card", event.card)
					.set("ai", function (target) {
						var evt = _status.event;
						return get.effect(target, evt.getParent().card, evt.player, evt.player);
					});
			} else {
				event.finish();
			}
			"step 4";
			if (result.bool) {
				var target2 = result.targets[0];
				target.line(target2);
				target.$give(card, target2);
				game.delay(0.5);
				target2.equip(card);
			}
		},
	},
	spdiancai: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			return (
				player != event.player &&
				player.hasHistory("lose", function (evt) {
					return evt.hs && evt.hs.length > 0;
				})
			);
		},
		content() {
			"step 0";
			var num = 0;
			player.getHistory("lose", function (evt) {
				if (evt.hs) {
					num += evt.hs.length;
				}
			});
			num = Math.min(num, game.countPlayer());
			player.chooseTarget(get.prompt("spdiancai"), [1, num], "令至多" + get.cnNumber(num) + "名角色各摸一张牌").set("ai", function (target) {
				return get.attitude(_status.event.player, target);
			});
			"step 1";
			if (result.bool) {
				var targets = result.targets.sortBySeat(trigger.player);
				player.logSkill("spdiancai", targets);
				if (targets.length == 1) {
					targets[0].draw();
					event.finish();
				} else {
					game.asyncDraw(targets);
				}
			} else {
				event.finish();
			}
			"step 2";
			game.delayx();
		},
	},
	mbdiaodu: {
		audio: "spdiaodu",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(function (target) {
				return target.countCards("e", function (card) {
					return game.hasPlayer(function (current) {
						return current != player && current != target && current.canEquip(card);
					});
				});
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("mbdiaodu"), function (card, player, target) {
					return target.countCards("e", function (card) {
						return game.hasPlayer(function (current) {
							return current != player && current != target && current.canEquip(card);
						});
					});
				})
				.set("ai", function (target) {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (att > 0) {
						if (
							target.hasCard(function (card) {
								if (
									get.value(card, target) <= 0 &&
									game.hasPlayer(function (current) {
										return current != player && current != target && current.canEquip(card, false) && get.effect(current, card, player, player) > 0;
									})
								) {
									return true;
								}
								return false;
							}, "e")
						) {
							return 2 * att;
						}
					} else if (att < 0) {
						if (
							target.hasCard(function (card) {
								if (
									get.value(card, target) >= 4.5 &&
									game.hasPlayer(function (current) {
										return current != player && current != target && current.canEquip(card) && get.effect(current, card, player, player) > 0;
									})
								) {
									return true;
								}
								return false;
							}, "e")
						) {
							return -att;
						}
					}
					return 0;
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("mbdiaodu", target);
			} else {
				event.finish();
			}
			"step 2";
			var es = target.getCards("e", function (card) {
				return game.hasPlayer(function (current) {
					return current != target && current.canEquip(card);
				});
			});
			if (es.length == 1) {
				event._result = { bool: true, links: es };
			} else {
				player.chooseButton(["移动" + get.translation(target) + "的一张装备牌", es], true).set("ai", function (button) {
					var player = _status.event.player,
						target = _status.event.getParent().target,
						card = button.link;
					if (
						game.hasPlayer(function (current) {
							return current != player && current != target && current.canEquip(card) && get.effect(current, card, player, player) > 0;
						})
					) {
						return -get.value(card, target) * get.attitude(player, target);
					}
					return 0;
				});
			}
			"step 3";
			if (result.bool) {
				event.card = result.links[0];
				player
					.chooseTarget("请选择" + get.translation(event.card) + "的移动目标", true, function (card, player, target) {
						return target != player && target.canEquip(_status.event.card);
					})
					.set("card", event.card)
					.set("ai", function (target) {
						var evt = _status.event;
						return get.effect(target, evt.getParent().card, evt.player, evt.player);
					});
			} else {
				event.finish();
			}
			"step 4";
			if (result.bool) {
				var target2 = result.targets[0];
				target.line(target2);
				target.$give(card, target2);
				game.delay(0.5);
				target2.equip(card);
			} else {
				event.finish();
			}
			"step 5";
			target.draw();
		},
	},
	mbdiancai: {
		audio: "spdiancai",
		trigger: { global: "phaseUseEnd" },
		filter(event, player) {
			if (_status.currentPhase == player) {
				return false;
			}
			var num = 0;
			player.getHistory("lose", function (evt) {
				if (evt.cards2 && evt.getParent("phaseUse") == event) {
					num += evt.cards2.length;
				}
			});
			return num >= player.hp && player.countCards("h") < player.maxHp;
		},
		frequent: true,
		content() {
			var num = player.maxHp - player.countCards("h");
			if (num > 0) {
				player.draw(num);
			}
		},
	},
	spyanji: {
		audio: 3,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return ["zhengsu_leijin", "zhengsu_bianzhen", "zhengsu_mingzhi"].some(i => !player.hasSkill(i));
		},
		onremove: true,
		logAudio: () => 1,
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([get.prompt(event.skill), [["zhengsu_leijin", "zhengsu_bianzhen", "zhengsu_mingzhi"].filter(i => !player.hasSkill(i)), "vcard"]])
				.set("ai", () => Math.random())
				.forResult();
			event.result = {
				bool: result.bool,
				cost_data: result.links?.[0][2],
			};
		},
		async content(event, trigger, player) {
			const name = event.cost_data;
			player.addTempSkill("spyanji_share", {
				player: ["phaseDiscardAfter", "phaseAfter"],
			});
			player.addTempSkill(name, { player: ["phaseDiscardAfter", "phaseAfter"] });
			player.markAuto("spyanji", name);
			player.popup(name, "thunder");
			await game.delayx();
		},
		subSkill: {
			share: {
				audio: "spyanji",
				charlotte: true,
				trigger: { player: "phaseDiscardEnd" },
				forced: true,
				getIndex(event, player) {
					return player.getStorage("spyanji");
				},
				logAudio(event, player, _3, data) {
					if (!player.storage[data]) {
						return "spyanji3.mp3";
					}
					return "spyanji2.mp3";
				},
				async content(event, trigger, player) {
					player.unmarkAuto("spyanji", event.indexedData);
					if (!player.storage[event.indexedData]) {
						player.popup("整肃失败", "fire");
						game.log(player, "整肃失败");
						return;
					}
					player.popup("整肃成功", "wood");
					game.log(player, "整肃成功");
					await player.chooseDrawRecover(2, "整肃奖励：摸两张牌或回复1点体力", true);
				},
			},
		},
	},
	//蒋钦
	spjianyi: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		forced: true,
		filter(event, player) {
			return (
				player != event.player &&
				game.getGlobalHistory("cardMove", function (evt) {
					if (evt.name != "lose" || evt.type != "discard") {
						return false;
					}
					for (var i of evt.cards) {
						if (get.subtype(i, false) == "equip2" && get.position(i, true) == "d") {
							return true;
						}
					}
					return false;
				}).length > 0
			);
		},
		content() {
			"step 0";
			var cards = [];
			game.getGlobalHistory("cardMove", function (evt) {
				if (evt.name != "lose" || evt.type != "discard") {
					return false;
				}
				for (var i of evt.cards) {
					if (get.subtype(i, false) == "equip2" && get.position(i, true) == "d") {
						cards.push(i);
					}
				}
			});
			player.chooseButton(["俭衣：获得一张防具牌", cards], true).set("ai", function (button) {
				return get.value(button.link, _status.event.player);
			});
			"step 1";
			if (result.bool) {
				player.gain(result.links, "gain2");
			}
		},
	},
	spshangyi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") > 0 && game.hasPlayer(current => lib.skill.spshangyi.filterTarget(null, player, current));
		},
		filterCard: true,
		position: "he",
		check(card) {
			return 6 - get.value(card);
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		content() {
			target.viewHandcards(player);
			player.gainPlayerCard(target, "h", true, "visible");
		},
		ai: {
			order: 6,
			result: {
				player: 0.5,
				target(player, target) {
					if (target.hasSkillTag("noh")) {
						return 0;
					}
					return -1;
				},
			},
		},
	},
};
