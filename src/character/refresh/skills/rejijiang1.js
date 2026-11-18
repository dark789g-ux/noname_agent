import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rejijiang1Skills = {
	rejijiang1: {
		audio: "jijiang1",
		audioname: ["liushan", "re_liubei", "re_liushan", "ol_liushan"],
		trigger: { player: ["useCardBegin", "respondBegin"] },
		logTarget: "targets",
		sourceSkill: "rejijiang",
		filter(event, player) {
			return event.skill == "rejijiang";
		},
		forced: true,
		async content(event, trigger, player) {
			delete trigger.skill;
			trigger.getParent().set("jijiang", true);

			var current = player.next;

			while (current != player) {
				if (current.group == "shu") {
					var next = current.chooseToRespond("是否替" + get.translation(player) + "打出一张杀？");
					next.set("filterCard", function (card, player) {
						if (get.name(card) !== "sha") {
							return false;
						}
						return lib.filter.cardRespondable(card, player);
					});
					next.set("ai", function () {
						var event = _status.event;
						return get.attitude(event.player, event.source) - 2;
					});
					next.set("source", player);
					next.set("jijiang", true);
					next.set("skillwarn", "替" + get.translation(player) + "打出一张杀");
					next.noOrdering = true;
					next.autochoose = lib.filter.autoRespondSha;

					var result = await next.forResult();

					if (result.bool) {
						trigger.card = result.card;
						trigger.cards = result.cards;
						trigger.throw = false;
						if (typeof current.ai.shown == "number" && current.ai.shown < 0.95) {
							current.ai.shown += 0.3;
							if (current.ai.shown > 0.95) {
								current.ai.shown = 0.95;
							}
						}
						return;
					}
				}
				current = current.next;
			}

			player.addTempSkill("jijiang3");
			trigger.cancel();
			trigger.getParent().goto(0);
		},
	},
	rejijiang3: {
		trigger: { global: ["useCard", "respond"] },
		usable: 1,
		sourceSkill: "rejijiang",
		filter(event, player) {
			return event.card.name == "sha" && event.player != player && event.player.group == "shu" && event.player.isIn() && event.player != _status.currentPhase && player.hasZhuSkill("rejijiang");
		},
		async cost(event, trigger, player) {
			event.result = await trigger.player
				.chooseBool(`激将：是否令${get.translation(player)}摸一张牌？`)
				.set("ai", () => {
					const evt = _status.event;
					return get.attitude(evt.player, evt.getParent().player) > 0;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.player.line(player, "fire");
			await player.draw();
		},
	},
	//鲁肃
	olhaoshi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		filter(event, player) {
			return !event.numFixed;
		},
		check(event, player) {
			return (
				player.countCards("h") + 2 + event.num <= 5 ||
				game.hasPlayer(function (target) {
					return (
						player !== target &&
						!game.hasPlayer(function (current) {
							return current !== player && current !== target && current.countCards("h") < target.countCards("h");
						}) &&
						get.attitude(player, target) > 0
					);
				})
			);
		},
		async content(event, trigger, player) {
			trigger.num += 2;
			player.addTempSkill("olhaoshi_give", "phaseDrawAfter");
		},
		subSkill: {
			give: {
				trigger: { player: "phaseDrawEnd" },
				forced: true,
				charlotte: true,
				popup: false,
				filter(event, player) {
					return player.countCards("h") > 5;
				},
				async content(event, trigger, player) {
					let result;

					// step 0
					var targets = game.filterPlayer(function (target) {
							return (
								target != player &&
								!game.hasPlayer(function (current) {
									return current != player && current != target && current.countCards("h") < target.countCards("h");
								})
							);
						}),
						num = Math.floor(player.countCards("h") / 2);
					result = await player
						.chooseCardTarget({
							position: "h",
							filterCard: true,
							filterTarget(card, player, target) {
								return _status.event.targets.includes(target);
							},
							targets: targets,
							selectTarget: targets.length == 1 ? -1 : 1,
							selectCard: num,
							prompt: "将" + get.cnNumber(num) + "张手牌交给一名手牌数最少的其他角色",
							forced: true,
							ai1(card) {
								var goon = false,
									player = _status.event.player;
								for (var i of _status.event.targets) {
									if (get.attitude(i, player) > 0 && get.attitude(player, i) > 0) {
										goon = true;
									}
									break;
								}
								if (goon) {
									if (
										!player.hasValueTarget(card) ||
										(card.name == "sha" &&
											player.countCards("h", function (cardx) {
												return cardx.name == "sha" && !ui.selected.cards.includes(cardx);
											}) > player.getCardUsable("sha"))
									) {
										return 2;
									}
									return Math.max(2, get.value(card) / 4);
								}
								return 1 / Math.max(1, get.value(card));
							},
							ai2(target) {
								return get.attitude(_status.event.player, target);
							},
						})
						.forResult();

					// step 1
					if (result.bool) {
						var target = result.targets[0];
						player.line(target, "green");
						player.give(result.cards, target);
						player.markAuto("olhaoshi_help", [target]);
						player.addTempSkill("olhaoshi_help", { player: "phaseBeginStart" });
					}
				},
			},
			help: {
				trigger: { target: "useCardToTargeted" },
				direct: true,
				charlotte: true,
				onremove: true,
				filter(event, player) {
					if (!player.storage.olhaoshi_help || !player.storage.olhaoshi_help.length) {
						return false;
					}
					if (event.card.name != "sha" && get.type(event.card) != "trick") {
						return false;
					}
					for (var i of player.storage.olhaoshi_help) {
						if (i.countCards("h") > 0) {
							return true;
						}
					}
					return false;
				},
				async content(event, trigger, player) {
					let result;
					let targets = event.targets;
					let target = event.target;

					while (true) {
						// step 0
						if (!targets) {
							targets = player.storage.olhaoshi_help.slice(0).sortBySeat();
						}
						if (!targets.length) break;

						target = targets.shift();
						result = await target
							.chooseCard("h", "好施：是否将一张手牌交给" + get.translation(player) + "？")
							.set("ai", function (card) {
								var player = _status.event.player,
									target = _status.event.getTrigger().player;
								if (!_status.event.goon) {
									if (get.value(card, player) < 0 || get.value(card, target) < 0) {
										return 1;
									}
									return 0;
								}
								var cardx = _status.event.getTrigger().card;
								if (card.name == "shan" && get.tag(cardx, "respondShan") && target.countCards("h", "shan") < player.countCards("h", "shan")) {
									return 2;
								}
								if (card.name == "sha" && (cardx.name == "juedou" || (get.tag(card, "respondSha") && target.countCards("h", "sha") < player.countCards("h", "sha")))) {
									return 2;
								}
								if (get.value(card, target) > get.value(card, player) || target.getUseValue(card) > player.getUseValue(card)) {
									return 1;
								}
								if (player.hasSkillTag("noh")) {
									return 0.5 / Math.max(1, get.value(card, player));
								}
								return 0;
							})
							.set("goon", get.attitude(target, player) > 0)
							.forResult();

						// step 1
						if (result.bool) {
							target.logSkill("olhaoshi_help", player);
							target.give(result.cards, player);
						}
					}
				},
			},
		},
	},
	oldimeng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.oldimeng.filterTarget(null, player, current));
		},
		selectTarget: 2,
		complexTarget: true,
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			var ps = player.countCards("he");
			if (!ui.selected.targets.length) {
				var hs = target.countCards("h");
				return game.hasPlayer(function (current) {
					if (current == player || current == target) {
						return false;
					}
					var cs = current.countCards("h");
					return (hs > 0 || cs > 0) && Math.abs(hs - cs) <= ps;
				});
			}
			var current = ui.selected.targets[0],
				hs = target.countCards("h"),
				cs = current.countCards("h");
			return (hs > 0 || cs > 0) && Math.abs(hs - cs) <= ps;
		},
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const { targets } = event;
			await targets[0].swapHandcards(targets[1]);
			player.addTempSkill("oldimeng_discard", "phaseUseAfter");
			player.markAuto("oldimeng_discard", [targets]);
		},
		ai: {
			threaten: 4.5,
			pretao: true,
			nokeep: true,
			order: 1,
			expose: 0.2,
			result: {
				target(player, target) {
					if (!ui.selected.targets.length) {
						return -Math.sqrt(target.countCards("h"));
					}
					var h1 = ui.selected.targets[0].getCards("h"),
						h2 = target.getCards("h");
					if (h2.length > h1.length) {
						return 0;
					}
					var delval = get.value(h2, target) - get.value(h1, ui.selected.targets[0]);
					if (delval >= 0) {
						return 0;
					}
					return -delval * (h1.length - h2.length);
				},
			},
		},
		subSkill: {
			discard: {
				audio: "oldimeng",
				trigger: { player: "phaseUseEnd" },
				forced: true,
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return player.countCards("he") > 0;
				},
				async content(event, trigger, player) {
					for (let targets of player.getStorage("oldimeng_discard")) {
						if (targets.length < 2) {
							continue;
						}
						const num = Math.abs(targets[0].countCards("h") - targets[1].countCards("h"));
						if (num > 0 && player.countCards("he") > 0) {
							await player.chooseToDiscard("he", true, num);
						}
					}
				},
			},
		},
	},
	//贾诩
	rewansha: {
		audio: "wansha",
		audioname: ["re_jiaxu", "boss_lvbu3", "new_simayi"],
		audioname2: { shen_simayi: "jilue_wansha" },
		global: "rewansha_global",
		trigger: { global: "dyingBegin" },
		forced: true,
		logTarget: "player",
		filter(event, player) {
			return player == _status.currentPhase;
		},
		async content(event, trigger, player) {
			const targets = game.filterPlayer();
			for (const current of targets) {
				if (current != player && current != trigger.player) {
					current.addSkillBlocker("rewansha_fengyin");
				}
			}
			player.addTempSkill("rewansha_clear");
		},
		subSkill: {
			global: {
				mod: {
					cardEnabled(card, player) {
						var source = _status.currentPhase;
						if (card.name == "tao" && source && source != player && source.hasSkill("rewansha") && !player.isDying()) {
							return false;
						}
					},
					cardSavable(card, player) {
						var source = _status.currentPhase;
						if (card.name == "tao" && source && source != player && source.hasSkill("rewansha") && !player.isDying()) {
							return false;
						}
					},
				},
			},
			fengyin: {
				inherit: "fengyin",
			},
			clear: {
				trigger: { global: "dyingAfter" },
				forced: true,
				charlotte: true,
				popup: false,
				filter(event, player) {
					return !_status.dying.length;
				},
				async content(event, trigger, player) {
					player.removeSkill("rewansha_clear");
				},
				onremove() {
					game.countPlayer2(function (current) {
						current.removeSkillBlocker("rewansha_fengyin");
					});
				},
			},
		},
	},
	reluanwu: {
		audio: "luanwu",
		inherit: "luanwu",
		async contentAfter(event, trigger, player) {
			await player.chooseUseTarget("sha", "是否使用一张【杀】？", false, "nodistance");
		},
	},
	reweimu: {
		audio: 2,
		mod: {
			targetEnabled(card) {
				if (get.type2(card) == "trick" && get.color(card) == "black") {
					return false;
				}
			},
		},
		trigger: { player: "damageBegin4" },
		forced: true,
		filter(event, player) {
			return player == _status.currentPhase;
		},
		async content(event, trigger, player) {
			trigger.cancel();
			const num = trigger.num;
			await player.draw(2 * num);
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (target == _status.currentPhase && get.tag(card, "damage")) {
						return [0, 2, 0, 0];
					}
				},
			},
		},
		group: "reweimu_log",
		subSkill: {
			log: {
				audio: "reweimu",
				trigger: { global: "useCard1" },
				forced: true,
				firstDo: true,
				filter(event, player) {
					if (event.player == player) {
						return false;
					}
					if (get.color(event.card) != "black" || get.type(event.card) != "trick") {
						return false;
					}
					var info = lib.card[event.card.name];
					return info && info.selectTarget && info.selectTarget == -1 && !info.toself;
				},
				async content(_) {},
			},
		},
	},
};
