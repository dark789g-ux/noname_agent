import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twqirang" | "twyuhua">} */
export const groupSkills = {
	//诸葛果
	twqirang: {
		audio: "qirang",
		trigger: { player: "equipEnd" },
		frequent: true,
		content() {
			var card = get.cardPile(function (card) {
				return get.type2(card) == "trick";
			});
			if (card) {
				player.gain(card, "gain2").gaintag.add("twqirang");
				player.addTempSkill("twqirang_use");
				player.addTempSkill("twqirang_clear", [
					"phaseZhunbeiAfter",
					"phaseDrawAfter",
					"phaseUseAfter",
					"phaseDiscardAfter",
					"phaseJieshuAfter",
					"phaseAfter",
				]);
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						return [1, 3];
					}
				},
			},
		},
		subSkill: {
			clear: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("twqirang");
				},
			},
			use: {
				audio: "qirang",
				trigger: { player: "useCard2" },
				forced: true,
				filter(event, player) {
					if (get.type2(event.card) != "trick") {
						return false;
					}
					if (
						!player.hasHistory("lose", function (evt) {
							if ((evt.relatedEvent || evt.getParent()) != event) {
								return false;
							}
							for (var i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("twqirang")) {
									return true;
								}
							}
							return false;
						})
					) {
						return false;
					}
					return true;
				},
				content() {
					"step 0";
					game.log(trigger.card, "不可被响应");
					trigger.directHit.addArray(game.players);
					var info = get.info(trigger.card);
					if (info.allowMultiple == false) {
						event.finish();
					} else if (trigger.targets) {
						if (
							!info.multitarget &&
							!game.hasPlayer(function (current) {
								return !trigger.targets.includes(current) && lib.filter.targetEnabled2(trigger.card, player, current);
							})
						) {
							event.finish();
						}
					} else {
						event.finish();
					}
					"step 1";
					var prompt2 = "为" + get.translation(trigger.card) + "增加或减少一个目标";
					player
						.chooseTarget(get.prompt("twqirang"), function (card, player, target) {
							var player = _status.event.player;
							if (_status.event.targets.includes(target)) {
								return true;
							}
							return lib.filter.targetEnabled2(_status.event.card, player, target);
						})
						.set("prompt2", prompt2)
						.set("ai", function (target) {
							var trigger = _status.event.getTrigger();
							var player = _status.event.player;
							return get.effect(target, trigger.card, player, player) * (_status.event.targets.includes(target) ? -1 : 1);
						})
						.set("targets", trigger.targets)
						.set("card", trigger.card);
					"step 2";
					if (result.bool) {
						if (!event.isMine() && !event.isOnline()) {
							game.delayx();
						}
						event.targets = result.targets;
					} else {
						event.finish();
					}
					"step 3";
					if (event.targets) {
						player.line(event.targets);
						if (trigger.targets.includes(event.targets[0])) {
							trigger.targets.removeArray(event.targets);
						} else {
							trigger.targets.addArray(event.targets);
						}
					}
				},
				mod: {
					targetInRange(card, player, target) {
						if (!card.cards) {
							return;
						}
						for (var i of card.cards) {
							if (i.hasGaintag("twqirang")) {
								return true;
							}
						}
					},
				},
			},
		},
	},
	twyuhua: {
		audio: "yuhua",
		frequent: true,
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (player == _status.currentPhase) {
				return false;
			}
			if (event.name == "gain" && player == event.player) {
				return false;
			}
			var evt = event.getl(player);
			if (!evt || !evt.cards2 || !evt.cards2.length) {
				return false;
			}
			for (var i of evt.cards2) {
				if (get.type(i, null, player) != "basic") {
					return true;
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			let num = 0,
				evt = trigger.getl(player);
			for (let i of evt.cards2) {
				if (get.type(i, null, player) != "basic" && num < 5) {
					num++;
				}
			}
			await player.chooseToGuanxing(num);
			const result = await player
				.chooseBool("羽化：是否摸" + get.cnNumber(num) + "张牌？")
				.set("frequentSkill", "twyuhua")
				.forResult();
			if (result.bool) {
				await player.draw(num);
			}
		},
		mod: {
			ignoredHandcard(card, player) {
				if (get.type(card) != "basic") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.type(card) != "basic") {
					return false;
				}
			},
		},
	},
};
