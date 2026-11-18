import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rezhiyuSkills = {
	rezhiyu: {
		audio: 2,
		trigger: { player: "damageEnd" },
		async content(event, trigger, player) {
			await player.draw();
			if (!player.countCards("h")) {
				return;
			} else {
				await player.showHandcards();
			}
			let result;
			if (!trigger.source?.isIn()) {
				result = { bool: false, cards: [] };
			} else {
				result = await trigger.source.chooseToDiscard("智愚：请弃置一张手牌", true).forResult();
			}
			let cards = player.getCards("h");
			const bool = cards.map(card => get.color(card, player)).unique().length == 1;
			if (bool) {
				cards = result.cards.filterInD("d");
				if (cards.length) {
					await player.gain(cards, "gain2");
				}
				player.addMark("reqice_mark", 1);
				player.addTempSkill("reqice_mark", { player: "phaseAfter" });
			}
		},
		ai: {
			maixie_defend: true,
			threaten: 0.85,
		},
	},
	oljiang: {
		audio: "jiang",
		inherit: "jiang",
		group: "oljiang_gain",
		subSkill: {
			gain: {
				audio: "jiang",
				audioname: ["sp_lvmeng", "re_sunben", "re_sunce"],
				trigger: { global: ["loseAfter", "loseAsyncAfter"] },
				usable: 1,
				filter(event, player) {
					if (player.hp < 1 || event.type != "discard" || event.position != ui.discardPile) {
						return false;
					}
					var filter = card => card.name == "juedou" || (card.name == "sha" && get.color(card, false) == "red");
					var cards = event.getd().filter(filter);
					if (!cards.filter(card => get.position(card, true) == "d").length) {
						return false;
					}
					var searched = false;
					if (
						game.getGlobalHistory("cardMove", function (evt) {
							if (searched || evt.type != "discard" || evt.position != ui.discardPile) {
								return false;
							}
							var evtx = evt;
							if (evtx.getlx === false) {
								evtx = evt.getParent();
							}
							var cards = evtx.getd().filter(filter);
							if (!cards.length) {
								return false;
							}
							searched = true;
							return evtx != event;
						}).length > 0
					) {
						return false;
					}
					return true;
				},
				prompt2(event, player) {
					var cards = event.getd().filter(function (card) {
						return (card.name == "juedou" || (card.name == "sha" && get.color(card, false) == "red")) && get.position(card, true) == "d";
					});
					return "失去1点体力并获得" + get.translation(cards);
				},
				check(event, player) {
					return player.hp > 1 && !player.storage.olhunzi;
				},
				async content(event, trigger, player) {
					await player.loseHp();
					const cards = trigger.getd().filter(card => {
						return (card.name == "juedou" || (card.name == "sha" && get.color(card, false) == "red")) && get.position(card, true) == "d";
					});
					if (cards.length > 0) {
						await player.gain(cards, "gain2");
					}
				},
			},
		},
	},
	//李儒
	dcmieji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hasCard(lib.skill.dcmieji.filterCard, "eh");
		},
		position: "he",
		filterCard(card) {
			if (get.subtype(card) == "equip1") {
				return true;
			}
			return get.color(card) == "black" && get.type(card, "trick") == "trick";
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		discard: false,
		delay: false,
		check(card) {
			return 8 - get.value(card);
		},
		loseTo: "cardPile",
		insert: true,
		visible: true,
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.showCards(cards);
			const result = await target.chooseToDiscard("he", true).set("prompt", "请弃置一张锦囊牌，或依次弃置两张非锦囊牌。").forResult();
			if (
				(!result.cards || get.type(result.cards[0], "trick", result.cards[0].original == "h" ? target : false) != "trick") &&
				target.countCards("he", function (card) {
					return get.type(card, "trick") != "trick";
				})
			) {
				await target
					.chooseToDiscard("he", true, function (card) {
						return get.type(card, "trick") != "trick";
					})
					.set("prompt", "请弃置第二张非锦囊牌");
			}
		},
		ai: {
			order: 9,
			result: {
				target: -1,
			},
		},
	},
	dcfencheng: {
		audio: 2,
		audioname: ["ol_liru"],
		audioname2: {
			ol_sb_dongzhuo: "dcfencheng_ol_sb_dongzhuo",
		},
		enable: "phaseUse",
		filterTarget: lib.filter.notMe,
		limited: true,
		line: "fire",
		skillAnimation: "epic",
		animationColor: "fire",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			let targets = game.filterPlayer(current => current != player);
			targets.sortBySeat(event.target);
			let num = 1;
			if (targets.length) {
				for (const target of targets) {
					if (target.isIn()) {
						player.line(target, "fire");
						const result = await target
							.chooseToDiscard("he", "焚城：弃置至少" + get.cnNumber(num) + "张牌，或受到2点火焰伤害", [num, Infinity], "allowChooseAll")
							.set("ai", card => {
								if (ui.selected.cards.length >= get.event().num) {
									return -1;
								}
								if (get.player().hasSkillTag("nofire")) {
									return -1;
								}
								if (get.event().res >= 0) {
									return 6 - get.value(card);
								}
								if (get.type(card) != "basic") {
									return 10 - get.value(card);
								}
								return 8 - get.value(card);
							})
							.set("num", num)
							.set("res", get.damageEffect(target, player, target, "fire"))
							.forResult();

						if (!result?.bool) {
							await target.damage(2, "fire");
							num = 1;
						} else {
							num = result.cards.length + 1;
						}
					}
				}
			}
		},
		subSkill: { ol_sb_dongzhuo: { audio: 1 } },
		ai: {
			order: 1,
			result: {
				player(player, target) {
					if (player.hasUnknown(2)) {
						return 0;
					}
					let num = 0,
						eff = 0,
						players = game
							.filterPlayer(current => {
								return current != player;
							})
							.sortBySeat(target);
					for (const target of players) {
						if (get.damageEffect(target, player, target, "fire") >= 0) {
							num = 0;
							continue;
						}
						let shao = false;
						num++;
						if (
							target.countCards("he", card => {
								if (get.type(card) != "basic") {
									return get.value(card) < 10;
								}
								return get.value(card) < 8;
							}) < num
						) {
							shao = true;
						}
						if (shao) {
							eff -= 4 * (get.realAttitude || get.attitude)(player, target);
							num = 0;
						} else {
							eff -= (num * (get.realAttitude || get.attitude)(player, target)) / 4;
						}
					}
					if (eff < 4) {
						return 0;
					}
					return eff;
				},
			},
		},
	},
	//朱桓
	refenli: {
		audio: 2,
		group: ["refenli_draw", "refenli_use", "refenli_discard"],
		subfrequent: ["discard"],
		subSkill: {
			draw: {
				audio: "refenli",
				trigger: { player: "phaseJudgeBefore" },
				prompt: "是否发动【奋励】跳过判定和摸牌阶段？",
				filter(event, player) {
					return player.isMaxHandcard();
				},
				check(event, player) {
					if (player.hasJudge("lebu") || player.hasJudge("bingliang")) {
						return true;
					}
					if (!player.hasSkill("repingkou") || player.getHistory("skipped").length > 0) {
						return false;
					}
					return game.hasPlayer(function (current) {
						return get.attitude(player, current) < 0 && current.hp == 1 && get.damageEffect(current, player, player) > 0;
					});
				},
				async content(event, trigger, player) {
					trigger.cancel();
					player.skip("phaseDraw");
				},
			},
			use: {
				audio: "refenli",
				trigger: { player: "phaseUseBefore" },
				prompt: "是否发动【奋励】跳过出牌阶段？",
				filter(event, player) {
					return player.isMaxHp();
				},
				check(event, player) {
					if (!player.hasSkill("repingkou")) {
						return false;
					}
					if (!player.needsToDiscard() || (player.countCards("e") && player.isMaxEquip())) {
						return true;
					}
					if (player.getHistory("skipped").length > 0) {
						return false;
					}
					return game.hasPlayer(function (current) {
						return get.attitude(player, current) < 0 && current.hp == 1 && get.damageEffect(current, player, player) > 0;
					});
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			discard: {
				audio: "refenli",
				trigger: { player: "phaseDiscardBefore" },
				prompt: "是否发动【奋励】跳过弃牌阶段？",
				frequent: true,
				filter(event, player) {
					return player.isMaxEquip() && player.countCards("e");
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
		},
		ai: {
			combo: "repingkou",
		},
	},
	repingkou: {
		audio: 2,
		trigger: { player: "phaseEnd" },
		filter(event, player) {
			return player.getHistory("skipped").length > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget([1, player.getHistory("skipped").length], get.prompt2("repingkou"), "对至多" + get.cnNumber(player.getHistory("skipped").length) + "名其他角色各造成1点伤害。若你选择的角色数小于最大角色数，则你可以弃置其中一名目标角色装备区内的一张牌", function (card, player, target) {
					return target != player;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets.slice(0).sortBySeat();
			for (const target of targets) {
				if (target.isIn()) {
					await target.damage();
				}
			}
			if (targets.length >= player.getHistory("skipped").length) {
				return;
			}
			const targets2 = targets.filter(function (target) {
				return target.countDiscardableCards(player, "e") > 0;
			});
			if (targets2.length > 0) {
				const result = await player
					.chooseTarget("是否弃置一名目标角色的一张装备牌？", function (card, player, target) {
						return _status.event.targets.includes(target);
					})
					.set("targets", targets2)
					.set("ai", function (target) {
						var att = get.attitude(player, target),
							eff = 0;
						target.getCards("e", function (card) {
							var val = get.value(card, target);
							eff = Math.max(eff, -val * att);
						});
						return eff;
					})
					.forResult();
				if (result.bool) {
					const target = result.targets[0];
					player.line(target, "green");
					const card = target.getDiscardableCards(player, "e").randomGet();
					if (card) {
						await target.discard(card);
					}
				}
			}
		},
		ai: {
			effect: {
				target(card) {
					if (card.name == "lebu" || card.name == "bingliang") {
						return 0.5;
					}
				},
			},
			combo: "refenli",
		},
	},
	//典韦
	olqiangxi: {
		selectionSpec(event, player) {
			return {
				steps: [
					{ type: "card", select: player.hp < 1 ? 1 : [0, 1], required: player.hp < 1 },
					{ type: "target", select: 1 },
				],
			};
		},
		audio: "qiangxi",
		audioname: ["ol_dianwei", "boss_lvbu3"],
		enable: "phaseUse",
		usable: 2,
		filter(event, player) {
			if (player.hp < 1 && !player.hasCard(card => lib.skill.olqiangxi.filterCard(card), "he")) {
				return false;
			}
			return game.hasPlayer(current => lib.skill.olqiangxi.filterTarget(null, player, current));
		},
		filterCard(card) {
			return get.subtype(card) == "equip1";
		},
		position: "he",
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			var stat = player.getStat()._olqiangxi;
			return !stat || !stat.includes(target);
		},
		selectCard() {
			if (_status.event.player.hp < 1) {
				return 1;
			}
			return [0, 1];
		},
		async content(event, trigger, player) {
			const { cards, target } = event;

			var stat = player.getStat();
			if (!stat._olqiangxi) {
				stat._olqiangxi = [];
			}
			stat._olqiangxi.push(target);
			if (!cards.length) {
				await player.damage("nosource", "nocard");
			}
			await target.damage("nocard");
		},
		ai: {
			damage: true,
			order: 8,
			result: {
				player(player, target) {
					if (ui.selected.cards.length) {
						return 0;
					}
					if (player.hp >= target.hp) {
						return -0.9;
					}
					if (player.hp <= 2) {
						return -10;
					}
					return get.damageEffect(player, player, player);
				},
				target(player, target) {
					if (!ui.selected.cards.length) {
						if (player.hp < 2) {
							return 0;
						}
						if (player.hp == 2 && target.hp >= 2) {
							return 0;
						}
						if (target.hp > player.hp) {
							return 0;
						}
					}
					return get.damageEffect(target, player, target);
				},
			},
			threaten: 1.5,
		},
	},
};
