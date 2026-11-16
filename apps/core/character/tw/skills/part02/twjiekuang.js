import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twjiekuang" | "twneirao" | "twluanlve" | "twqingkou">} */
export const groupSkills = {
	//于夫罗
	twjiekuang: {
		audio: 2,
		trigger: { global: "useCardToTargeted" },
		filter(event, player) {
			if (!event.target || event.targets.length > 1) {
				return false;
			}
			if (_status.dying.length) {
				return false;
			}
			if (player == event.player) {
				return false;
			}
			if (event.target.hp >= player.hp) {
				return false;
			}
			if (!["basic", "trick"].includes(get.type(event.card))) {
				return false;
			}
			return true;
		},
		usable: 1,
		async cost(event, trigger, player) {
			const { target } = trigger;
			const { control } = await player
				.chooseControl("失去体力", "减体力上限", "cancel2")
				.set("prompt", get.prompt2(event.name.slice(0, -5), target))
				.set("ai", () => {
					if (_status.event.aisave) {
						if (player.isDamaged()) {
							return "减体力上限";
						}
						return "失去体力";
					}
					return "cancel2";
				})
				.set(
					"aisave",
					(() => {
						var save = false;
						if (get.attitude(player, trigger.target) > 2) {
							if (trigger.card.name == "sha") {
								if (
									player.countCards("h", "shan") ||
									player.getEquip(2) ||
									trigger.target.hp == 1 ||
									player.hp > trigger.target.hp + 1
								) {
									if (!trigger.target.countCards("h", "shan") || trigger.target.countCards("h") < player.countCards("h")) {
										save = true;
									}
								}
							} else if (trigger.card.name == "juedou" && trigger.target.hp == 1) {
								save = true;
							} else if (
								trigger.card.name == "shunshou" &&
								get.attitude(player, trigger.player) < 0 &&
								get.attitude(trigger.player, trigger.target) < 0
							) {
								save = true;
							}
						}
						return save;
					})()
				)
				.forResult();
			event.result = {
				bool: control != "cancel2",
				targets: [target],
				cost_data: control,
			};
		},
		async content(event, trigger, player) {
			await player[event.cost_data == "失去体力" ? "loseHp" : "loseMaxHp"]();
			player.addTempSkill("twjiekuang_after");
			const evt = trigger.getParent();
			evt.twjiekuang = true;
			evt.targets.remove(trigger.target);
			evt.triggeredTargets4.remove(trigger.target);
			evt.targets.push(player);
			trigger.untrigger();
			await game.delayx();
			trigger.player.line(player);
		},
		subSkill: {
			after: {
				charlotte: true,
				trigger: { global: "useCardAfter" },
				filter(event, player) {
					return event.twjiekuang;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					const card = get.autoViewAs({
						name: trigger.card.name,
						nature: trigger.card.nature,
						isCard: true,
					});
					if (
						!game.countPlayer2(current => current.hasHistory("damage", evt => evt.card == trigger.card)) &&
						player.canUse(card, trigger.player)
					) {
						await player.useCard(card, trigger.player);
					}
				},
			},
		},
	},
	twneirao: {
		audio: 2,
		derivation: "twluanlve",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return Math.max(0, player.hp) + player.maxHp <= 9;
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			player.removeSkills("twjiekuang");
			"step 1";
			var num = player.countCards("he"),
				cards = [];
			player.discard(player.getCards("he"));
			for (var i = 0; i < num; i++) {
				var card = get.cardPile(function (card) {
					return card.name == "sha" && !cards.includes(card);
				});
				if (card) {
					cards.push(card);
				}
			}
			if (cards.length) {
				player.gain(cards, "gain2");
			}
			"step 2";
			player.addSkills("twluanlve");
		},
	},
	twluanlve: {
		audio: 2,
		enable: "phaseUse",
		onremove: true,
		locked: false,
		viewAs: {
			name: "shunshou",
			storage: { twluanlve: true },
		},
		viewAsFilter(player) {
			return player.isPhaseUsing() && player.countCards("hs", { name: "sha" }) >= player.countMark("twluanlve");
		},
		filterCard(card, player) {
			if (player.countMark("twluanlve") == 0) {
				return false;
			}
			return card.name == "sha";
		},
		selectCard() {
			var player = _status.event.player;
			if (player.countMark("twluanlve") == 0) {
				return -1;
			}
			return player.countMark("twluanlve");
		},
		onChooseToUse(event) {
			if (!game.online && event.type == "phase") {
				var targets = [];
				game.countPlayer2(current => {
					var history = current.getHistory("useCard");
					if (!history.length) {
						return false;
					}
					for (var evt of history) {
						if (evt.card && evt.card.name == "shunshou" && evt.getParent("phaseUse") === event.getParent("phaseUse")) {
							targets.addArray(evt.targets);
						}
					}
				});
				event.set("twluanlve_ban", targets);
			}
		},
		position: "hs",
		log: false,
		group: ["twluanlve_directHit"],
		precontent() {
			player.logSkill("twluanlve");
			player.addMark("twluanlve", 1, false);
		},
		ai: {
			order() {
				return get.order({ name: "shunshou" }) + 1;
			},
		},
		mod: {
			playerEnabled(card, player, target) {
				if (!_status.event.twluanlve_ban || !Array.isArray(_status.event.twluanlve_ban)) {
					return;
				}
				if (
					player.isPhaseUsing() &&
					card.name == "shunshou" &&
					card.storage &&
					card.storage.twluanlve &&
					_status.event.twluanlve_ban.includes(target)
				) {
					return false;
				}
			},
		},
		subSkill: {
			directHit: {
				trigger: { player: "useCard" },
				filter(event, player) {
					return event.card.name == "shunshou";
				},
				direct: true,
				content() {
					trigger.directHit.addArray(game.players);
					game.log(trigger.card, "不可被响应");
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						return arg && arg.card && arg.card.name == "shunshou";
					},
				},
			},
		},
	},
	//冯习
	twqingkou: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return player.canUse("juedou", current, false);
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("twqingkou"), "视为对一名其他角色使用一张【决斗】", function (card, player, target) {
					return player.canUse("juedou", target, false);
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.effect(target, { name: "juedou" }, player, player);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twqingkou", target);
				player.useCard({ name: "juedou", isCard: true, storage: { twqingkou: true } }, target, false);
				player.addTempSkill("twqingkou_after");
			}
		},
		subSkill: {
			after: {
				trigger: { global: "useCardAfter" },
				filter(event, player) {
					return event.card.storage && event.card.storage.twqingkou;
				},
				charlotte: true,
				direct: true,
				content() {
					var targets = game
						.filterPlayer(current => {
							return current.hasHistory("sourceDamage", function (evt) {
								return evt.card == trigger.card;
							});
						})
						.sortBySeat();
					for (var target of targets) {
						target.draw();
						if (target == player) {
							player.skip("phaseJudge");
							game.log(player, "跳过了", "#y判定阶段");
							player.skip("phaseDiscard");
							game.log(player, "跳过了", "#y弃牌阶段");
						}
					}
				},
			},
		},
	},
};
