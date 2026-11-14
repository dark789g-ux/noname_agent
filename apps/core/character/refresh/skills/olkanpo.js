import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const olkanpoSkills = {
	olkanpo: {
		audio: "rekanpo",
		audioname: ["ol_sp_zhugeliang", "ol_pangtong"],
		trigger: { player: "useCard" },
		forced: true,
		locked: false,
		popup: false,
		group: "olkanpo_viewAs",
		filter(event, player) {
			return event.card.name == "wuxie";
		},
		async content(event, trigger, player) {
			trigger.directHit.addArray(game.players);
		},
		subSkill: { viewAs: { inherit: "rekanpo", audio: "rekanpo" } },
	},
	//新杀界曹植
	dcjiushi: {
		audio: 2,
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			return event.card.name == "jiu";
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			player.addTempSkill("dcjiushi_sha", { player: "phaseEnd" });
			player.addMark("dcjiushi_sha", 1, false);
		},
		group: ["dcjiushi_use", "dcjiushi_damage"],
		subSkill: {
			use: {
				audio: "dcjiushi",
				enable: "chooseToUse",
				hiddenCard(player, name) {
					if (name == "jiu") {
						return !player.isTurnedOver();
					}
					return false;
				},
				filter(event, player) {
					if (player.isTurnedOver()) {
						return false;
					}
					return event.filterCard({ name: "jiu", isCard: true }, player, event);
				},
				async content(event, trigger, player) {
					if (_status.event.getParent(2).type == "dying") {
						event.dying = player;
						event.type = "dying";
					}
					await player.turnOver();
					await player.useCard({ name: "jiu", isCard: true }, player);
				},
				ai: {
					save: true,
					skillTagFilter(player, tag, arg) {
						return !player.isTurnedOver() && _status.event?.dying == player;
					},
					order: 5,
					result: {
						player(player) {
							if (_status.event.parent.name == "phaseUse") {
								if (player.countCards("h", "jiu") > 0) {
									return 0;
								}
								if (player.getEquip("zhuge") && player.countCards("h", "sha") > 1) {
									return 0;
								}
								if (!player.countCards("h", "sha")) {
									return 0;
								}
								var targets = [];
								var target;
								var players = game.filterPlayer();
								for (var i = 0; i < players.length; i++) {
									if (get.attitude(player, players[i]) < 0) {
										if (player.canUse("sha", players[i], true, true)) {
											targets.push(players[i]);
										}
									}
								}
								if (targets.length) {
									target = targets[0];
								} else {
									return 0;
								}
								var num = get.effect(target, { name: "sha" }, player, player);
								for (var i = 1; i < targets.length; i++) {
									var num2 = get.effect(targets[i], { name: "sha" }, player, player);
									if (num2 > num) {
										target = targets[i];
										num = num2;
									}
								}
								if (num <= 0) {
									return 0;
								}
								var e2 = target.getEquip(2);
								if (e2) {
									if (e2.name == "tengjia") {
										if (
											!player.countCards("h", {
												name: "sha",
												nature: "fire",
											}) &&
											!player.getEquip("zhuque")
										) {
											return 0;
										}
									}
									if (e2.name == "renwang") {
										if (!player.countCards("h", { name: "sha", color: "red" })) {
											return 0;
										}
									}
									if (e2.name == "baiyin") {
										return 0;
									}
								}
								if (player.getEquip("guanshi") && player.countCards("he") > 2) {
									return 1;
								}
								return target.countCards("h") > 3 ? 0 : 1;
							}
							if (player == _status.event.dying || player.isTurnedOver()) {
								return 3;
							}
						},
					},
					effect: {
						target(card, player, target) {
							if (target.isTurnedOver()) {
								if (get.tag(card, "damage")) {
									if (player.hasSkillTag("jueqing", false, target)) {
										return [1, -2];
									}
									if (target.hp == 1) {
										return;
									}
									return [1, target.countCards("h") / 2];
								}
							}
						},
					},
				},
			},
			damage: {
				audio: "dcjiushi",
				trigger: { player: "damageEnd" },
				check(event, player) {
					return player.isTurnedOver();
				},
				prompt: "是否发动【酒诗】，将武将牌翻面？",
				filter(event, player) {
					if (event.checkJiushi) {
						return true;
					}
					return false;
				},
				async content(event, trigger, player) {
					await player.turnOver();
				},
			},
			sha: {
				charlotte: true,
				onremove: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("dcjiushi_sha");
						}
					},
				},
			},
		},
	},
	//OL界黄忠
	remoshi: {
		trigger: { source: "damageSource" },
		forced: true,
		filter(event, player) {
			return event.player.isIn() && event.card && event.card.name == "sha" && event.cards.filterInD("od").length && event.notLink() && [2, 3, 4].some(i => event.player.getEquips(i).length > 0);
		},
		group: "remoshi_retrieve",
		async content(event, trigger, player) {
			trigger.player.addSkill("remoshi_stuck");
			const next = trigger.player.addToExpansion(trigger.cards.filterInD("od"), "gain2");
			next.gaintag.add("remoshi_stuck");
			await next;
		},
		subSkill: {
			retrieve: {
				audio: "remoshi",
				trigger: {
					global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player, name, target) {
					return target.isIn() && target.countExpansions("remoshi_stuck");
				},
				getIndex(event, player) {
					const keys = ["equip2", "equip3", "equip4"];
					return game
						.filterPlayer(current => {
							if (event.name == "gain" && current == player) {
								return false;
							}
							const cards = current.getExpansions("remoshi_stuck");
							if (!cards.length) {
								return false;
							}
							const evt = event.getl(current);
							if (evt && evt.cards2 && evt.cards2.some(i => get.subtypes(i).some(slot => keys.includes(slot)))) {
								return true;
							}
						})
						.sortBySeat();
				},
				forced: true,
				logTarget: (event, player, name, target) => target,
				async content(event, trigger, player) {
					const target = event.indexedData;
					const cards = target.getExpansions("remoshi_stuck");
					await player.gain(cards, target, "give", "bySelf");
				},
			},
			stuck: {
				marktext: "矢",
				charlotte: true,
				intro: {
					name: "没矢",
					name2: "矢",
					content: "expansion",
					markcount: "expansion",
				},
				onremove(player, skill) {
					var cards = player.getExpansions(skill);
					if (cards.length) {
						player.loseToDiscardpile(cards);
					}
				},
			},
		},
	},
	//界文聘
	rezhenwei: {
		audio: "zhenwei",
		inherit: "zhenwei",
		filter(event, player) {
			if (player == event.target || player == event.player) {
				return false;
			}
			if (!player.countCards("he")) {
				return false;
			}
			if (event.targets.length > 1) {
				return false;
			}
			if (!event.target) {
				return false;
			}
			if (event.target.hp > player.hp) {
				return false;
			}
			var card = event.card;
			if (card.name == "sha") {
				return true;
			}
			if (get.color(card) == "black" && get.type(card, "trick") == "trick") {
				return true;
			}
			return false;
		},
	},
	//界关张……
	retongxin: {
		mod: {
			attackRange: (player, num) => num + 2,
		},
	},
	//马忠
	refuman: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return !player.getStorage("refuman_used").includes(target);
		},
		filter(event, player) {
			return player.countCards("he") > 0 && game.hasPlayer(current => lib.skill.refuman.filterTarget(null, player, current));
		},
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		async content(event, trigger, player) {
			const card = get.discardPile(card => card.name == "sha"),
				{ target } = event;
			if (card) {
				target.addTempSkill("refuman2", { player: "phaseAfter" });
				player.addSkill("refuman_draw");
				const next = target.gain(card, "gain2");
				next.gaintag.add("refuman");
				await next;
			}
			player.addTempSkill(event.name + "_used", "phaseChange");
			player.markAuto(event.name + "_used", target);
		},
		check(card) {
			return get.discardPile(card => card.name == "sha") ? 6 - get.value(card) : 0;
		},
		ai: {
			order: 2,
			result: {
				target(player, target) {
					if (!target.hasSha()) {
						return 1.2;
					}
					return 1;
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已发动过角色：$",
				},
			},
			draw: {
				charlotte: true,
				audio: "refuman",
				trigger: { global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"] },
				getIndex(event, player) {
					return game
						.filterPlayer2(target => {
							const evt = event.getParent();
							if (!["useCard", "respond"].includes(evt?.name) && !target.isIn()) {
								return false;
							}
							if (event.name == "lose") {
								if (target !== event.player || event.refuman_active) {
									return false;
								}
								return Object.values(event.gaintag_map).flat().includes("refuman");
							}
							return target.hasHistory("lose", evt => {
								if (event !== evt.getParent() || evt.refuman_active) {
									return false;
								}
								return Object.values(evt.gaintag_map).flat().includes("refuman");
							});
						})
						.sortBySeat();
				},
				forced: true,
				filter: (event, player, name, target) => target,
				logTarget: (event, player, name, target) => target,
				async content(event, trigger, player) {
					const [target] = event.targets,
						evt = trigger.getParent();
					if (["useCard", "respond"].includes(evt?.name)) {
						await game.asyncDraw([target, player]);
					} else {
						await target.draw();
					}
					trigger.refuman_active = true;
				},
			},
		},
	},
	refuman2: {
		charlotte: true,
		onremove(player) {
			player.removeGaintag("refuman");
		},
		mod: {
			aiOrder(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("refuman")) {
					return num + 1;
				}
			},
		},
	},
	//十周年陈群
	repindi: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return !player.getStorage("repindi_target").includes(target);
		},
		filterCard(card, player) {
			return !player.getStorage("repindi_type").includes(get.type2(card));
		},
		check(card) {
			var num = _status.event.player.getStat("skill").repindi || 0;
			return 6 + num - get.value(card);
		},
		position: "he",
		async content(event, trigger, player) {
			const { target, cards } = event,
				num = player.getStat("skill").repindi;
			player.addTempSkill("repindi_clear", ["phaseUseAfter", "phaseAfter"]);
			player.markAuto("repindi_target", [target]);
			player.markAuto("repindi_type", [get.type2(cards[0], cards[0].original == "h" ? player : false)]);
			player.syncStorage();
			let result;
			if (target.countCards("he") == 0) {
				result = { index: 0 };
			} else {
				result = await player
					.chooseControlList(true, ["令" + get.translation(target) + "摸" + get.cnNumber(num) + "张牌", "令" + get.translation(target) + "弃置" + get.cnNumber(num) + "张牌"], function () {
						return _status.event.choice;
					})
					.set("choice", get.attitude(player, target) > 0 ? 0 : 1)
					.forResult();
			}
			if (result?.index == 0) {
				await target.draw(num);
			} else {
				await target.chooseToDiscard(num, "he", true);
			}
			if (target.isDamaged()) {
				await player.link();
			}
		},
		subSkill: {
			clear: {
				trigger: { player: "phaseAfter" },
				charlotte: true,
				silent: true,
				onremove(player) {
					delete player.storage.repindi_target;
					delete player.storage.repindi_type;
				},
			},
		},
		ai: {
			order: 8,
			threaten: 1.9,
			result: {
				target(player, target) {
					var att = get.attitude(player, target);
					var num = (player.getStat("skill").repindi || 0) + 1;
					if (att <= 0 && target.countCards("he") < num) {
						return 0;
					}
					return get.sgn(att);
				},
			},
		},
	},
};
