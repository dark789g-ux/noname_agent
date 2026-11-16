import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xiansi2" | "shibei" | "shibei_old" | "shibei2" | "jianying" | "zzhenggong" | "zquanji" | "zbaijiang" | "zyexin">} */
export const groupSkills = {
	xiansi2: {
		audio: 2,
		enable: "chooseToUse",
		audioname2: {
			re_liufeng: "rexiansi",
		},
		viewAs: {
			name: "sha",
			isCard: true,
		},
		filter(event, player) {
			return game.hasPlayer(current => current.hasSkill("xiansix") && current.getExpansions("xiansi").length > 1 && event.filterTarget({ name: "sha" }, player, current));
		},
		filterTarget(card, player, target) {
			let bool = false;
			const players = ui.selected.targets.slice(0);
			for (const current of players) {
				if (current.hasSkill("xiansix") && current.getExpansions("xiansi").length > 1) {
					bool = true;
				}
			}
			if (!bool && (!target.hasSkill("xiansix") || target.getExpansions("xiansi").length <= 1)) {
				return false;
			}
			return _status.event._backup.filterTarget.apply(this, arguments);
		},
		filterCard() {
			return false;
		},
		selectCard: -1,
		complexSelect: true,
		forceaudio: true,
		prompt: "弃置一名有【逆】的角色的两张【逆】，然后视为对包含其在内的角色使用【杀】。",
		delay: false,
		log: false,
		async precontent(event, trigger, player) {
			const targets = event.result.targets.filter(current => current.getExpansions("xiansi").length > 1 && current.hasSkill("xiansix"));
			if (!targets.length) {
				return;
			}

			let target;
			if (targets.length == 1) {
				target = targets[0];
			} else {
				const result = await player
					.chooseTarget({
						prompt: "选择弃置【陷嗣】牌的目标",
						filterTarget(card, player, target) {
							return get.event().list.includes(target);
						},
						forced: true,
						ai(target) {
							const player = get.player();
							return get.attitude(player, target);
						},
					})
					.set("list", targets)
					.forResult();
				if (!result.bool || !result.targets.length) {
					return;
				}
				target = result.targets[0];
			}

			let links;
			if (target.getExpansions("xiansi").length == 2) {
				links = target.getExpansions("xiansi").slice(0);
			} else {
				const result = await player.chooseCardButton("移去两张“逆”", 2, target.getExpansions("xiansi"), true).forResult();
				if (!result.bool) {
					return;
				}
				links = result.links;
			}

			player.logSkill("xiansi2_log", target);
			game.trySkillAudio("xiansi2", target, true);
			await target.loseToDiscardpile(links);
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) + 0.05;
			},
		},
		subSkill: {
			log: {},
		},
	},
	shibei: {
		trigger: { player: "damageEnd" },
		forced: true,
		audio: 2,
		audioname: ["xin_jushou"],
		audioname2: { sxrm_caocao: "shibei_sxrm_caocao" },
		check(event, player) {
			return player.getHistory("damage").indexOf(event) == 0;
		},
		async content(event, trigger, player) {
			if (player.getHistory("damage").indexOf(trigger) > 0) {
				player.loseHp();
			} else {
				player.recover();
			}
		},
		subSkill: {
			damaged: {},
			ai: {},
		},
		ai: {
			maixie_defend: true,
			threaten: 0.9,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (target.hujia) {
						return;
					}
					if (player._shibei_tmp) {
						return;
					}
					if (target.hasSkill("shibei_ai")) {
						return;
					}
					if (_status.event.getParent("useCard", true) || _status.event.getParent("_wuxie", true)) {
						return;
					}
					if (get.tag(card, "damage")) {
						if (target.getHistory("damage").length > 0) {
							return [1, -2];
						} else {
							if (get.attitude(player, target) > 0 && target.hp > 1) {
								return 0;
							}
							if (get.attitude(player, target) < 0 && !player.hasSkillTag("damageBonus")) {
								if (card.name == "sha") {
									return;
								}
								var sha = false;
								player._shibei_tmp = true;
								var num = player.countCards("h", function (card) {
									if (card.name == "sha") {
										if (sha) {
											return false;
										} else {
											sha = true;
										}
									}
									return get.tag(card, "damage") && player.canUse(card, target) && get.effect(target, card, player, player) > 0;
								});
								delete player._shibei_tmp;
								if (player.hasSkillTag("damage")) {
									num++;
								}
								if (num < 2) {
									var enemies = player.getEnemies();
									if (enemies.length == 1 && enemies[0] == target && player.needsToDiscard()) {
										return;
									}
									return 0;
								}
							}
						}
					}
				},
			},
		},
	},
	shibei_old: {
		audio: 2,
		trigger: { player: "damageAfter" },
		forced: true,
		async content(event, trigger, player) {
			const result = await player
				.judge({
					judge(card) {
						if (player.hasSkill("shibei2")) {
							if (get.color(card) == "black") {
								return -1;
							}
						} else {
							if (get.color(card) == "red") {
								return 1;
							}
						}
						return 0;
					},
				})
				.forResult();
			if (result.judge > 0) {
				await player.recover();
			} else if (result.judge < 0) {
				await player.loseHp();
			}
			if (!player.hasSkill("shibei2")) {
				player.addTempSkill("shibei2");
			}
		},
	},
	shibei2: {},
	jianying: {
		audio: 2,
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object" && player.isPhaseUsing()) {
					var evt = player.getLastUsed();
					if (!evt || !evt.card || evt.getParent("phaseUse") !== _status.event.getParent("phaseUse")) {
						return num;
					}
					if ((get.suit(evt.card) && get.suit(evt.card) == get.suit(card)) || (evt.card.number && evt.card.number == get.number(card))) {
						return num + 10;
					}
				}
			},
		},
		trigger: { player: "useCard" },
		frequent: true,
		filter(event, player) {
			if (!player.isPhaseUsing()) {
				return false;
			}
			player.addTip("jianying", "渐营 " + get.translation(get.suit(event.card, player)) + get.translation(get.strNumber(get.number(event.card, player))), true);
			var evt = player.getLastUsed(1);
			if (!evt || !evt.card) {
				return false;
			}
			var evt2 = evt.getParent("phaseUse");
			if (!evt2 || evt2.name != "phaseUse" || evt2 !== event.getParent("phaseUse")) {
				return false;
			}
			return (get.suit(evt.card) != "none" && get.suit(evt.card) == get.suit(event.card)) || (typeof get.number(evt.card, false) == "number" && get.number(evt.card, false) == get.number(event.card));
		},
		async content(event, trigger, player) {
			player.draw("nodelay");
		},
		group: "jianying_mark",
		init(player) {
			if (player.isPhaseUsing()) {
				var evt = _status.event.getParent("phaseUse");
				var history = player.getHistory("useCard", function (evt2) {
					return evt2.getParent("phaseUse") == evt;
				});
				if (history.length) {
					var trigger = history[history.length - 1];
					if (get.suit(trigger.card, player) == "none" || typeof get.number(trigger.card, player) != "number") {
						return;
					}
					player.storage.jianying_mark = trigger.card;
					player.markSkill("jianying_mark");
					game.broadcastAll(
						function (player, suit) {
							if (player.marks.jianying_mark) {
								player.marks.jianying_mark.firstChild.innerHTML = get.translation(suit);
							}
						},
						player,
						get.suit(trigger.card, player)
					);
					player.when("phaseUseAfter").step(async () => {
						player.unmarkSkill("jianying_mark");
						delete player.storage.jianying_mark;
					});
				}
			}
		},
		onremove(player) {
			player.unmarkSkill("jianying_mark");
			delete player.storage.jianying_mark;
		},
		subSkill: {
			mark: {
				charlotte: true,
				trigger: { player: "useCard1" },
				filter(event, player) {
					return player.isPhaseUsing();
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (get.suit(trigger.card, player) == "none" || typeof get.number(trigger.card, player) != "number") {
						player.unmarkSkill("jianying_mark");
					} else {
						player.storage.jianying_mark = trigger.card;
						player.markSkill("jianying_mark");
						game.broadcastAll(
							function (player, suit) {
								if (player.marks.jianying_mark) {
									player.marks.jianying_mark.firstChild.innerHTML = get.translation(suit);
								}
							},
							player,
							get.suit(trigger.card, player)
						);
						player.when("phaseUseAfter").step(async () => {
							player.unmarkSkill("jianying_mark");
							delete player.storage.jianying_mark;
						});
					}
				},
				intro: {
					markcount(card, player) {
						return get.strNumber(get.number(card, player));
					},
					content(card, player) {
						var suit = get.suit(card, player);
						var num = get.number(card, player);
						var str = "<li>上一张牌的花色：" + get.translation(suit);
						str += "<br><li>上一张牌的点数：" + get.strNumber(num);
						return str;
					},
				},
			},
		},
	},
	zzhenggong: {
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.source && event.source.countCards("e") > 0;
		},
		async cost(event, trigger, player) {
			const att = get.attitude(player, trigger.source);
			const result = await player
				.gainPlayerCard({
					prompt: get.prompt("zzhenggong"),
					target: trigger.source,
					position: "e",
					ai(button) {
						if (att <= 0) {
							return get.equipValue(button.link);
						}
						return 0;
					},
				})
				.set("chooseonly", true)
				.forResult();

			event.result = {
				bool: result.bool,
				cards: result.links,
			};
		},
		logTarget: "source",
		async content(event, trigger, player) {
			const cards = event.cards;
			await player.gain({
				cards,
				source: trigger.source,
			});
			const card = cards[0];
			if (player.hasCard(cardx => cardx === card, "h")) {
				player.$give(card, player, false);
				await player.equip(card);
			}
		},
		ai: {
			maixie_defend: true,
		},
	},
	zquanji: {
		trigger: { global: "phaseBegin" },
		check(event, player) {
			const att = get.attitude(player, event.player);
			if (att < 0) {
				const nh1 = event.player.countCards("h");
				const nh2 = player.countCards("h");
				return nh1 <= 2 && nh2 > nh1 + 1;
			}
			if (att > 0 && event.player.hasJudge("lebu") && event.player.countCards("h") > event.player.hp + 1) {
				return true;
			}
			return false;
		},
		logTarget: "player",
		filter(event, player) {
			return event.player != player && player.canCompare(event.player);
		},
		async content(event, trigger, player) {
			const { player: target } = trigger;
			const result = await player.chooseToCompare(target);
			if (result?.bool) {
				target.skip("phaseZhunbei");
				target.skip("phaseJudge");
			}
		},
		ai: { expose: 0.2 },
	},
	zbaijiang: {
		skillAnimation: true,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		derivation: ["zyexin", "zzili", "zpaiyi"],
		filter(event, player) {
			return player.countCards("e") >= 2;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.gainMaxHp();
			player.changeSkills(["zyexin", "zzili"], ["zquanji", "zzhenggong"]);
		},
	},
	zyexin: {
		trigger: { player: "damageEnd", source: "damageSource" },
		marktext: "权",
		frequent: true,
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		async content(event, trigger, player) {
			player.addToExpansion("zyexin", get.cards(), "gain2").gaintag.add("zyexin");
		},
		group: "zyexin2",
	},
};
