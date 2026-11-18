import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yinbing" | "juedi" | "meibu" | "mumu" | "fentian" | "zhiri" | "xintan">} */
export const groupSkills = {
	yinbing: {
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		audio: 2,
		preHidden: true,
		filter(event, player) {
			return player.countCards("he", { type: "basic" }) < player.countCards("he");
		},
		marktext: "兵",
		content() {
			"step 0";
			player
				.chooseCard(
					[1, player.countCards("he") - player.countCards("he", { type: "basic" })],
					"he",
					get.prompt("yinbing"),
					function (card) {
						return get.type(card) != "basic";
					},
					"allowChooseAll"
				)
				.set("ai", function (card) {
					return 6 - get.value(card);
				})
				.setHiddenSkill("yinbing");
			"step 1";
			if (result.bool) {
				player.logSkill("yinbing");
				player.addToExpansion(result.cards, player, "give").gaintag.add("yinbing");
			}
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (card.name == "sha" || card.name == "juedou") {
						if (current < 0) {
							return 1.2;
						}
					}
				},
			},
			threaten(player, target) {
				if (target.getExpansions("yinbing").length) {
					return 2;
				}
				return 1;
			},
			combo: "juedi",
		},
		subSkill: {
			discard: {
				audio: "yinbing",
				trigger: { player: "damageEnd" },
				forced: true,
				filter(event, player) {
					return event.card && player.getExpansions("yinbing").length > 0 && (event.card.name == "sha" || event.card.name == "juedou");
				},
				content() {
					"step 0";
					player.chooseCardButton("移去一张引兵牌", true, player.getExpansions("yinbing"));
					"step 1";
					if (result.bool) {
						player.loseToDiscardpile(result.links);
					}
				},
			},
		},
		group: "yinbing_discard",
	},
	juedi: {
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.getExpansions("yinbing").length > 0;
		},
		forced: true,
		audio: 2,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("juedi"), true, function (card, player, target) {
					return player.hp >= target.hp;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					var att = get.attitude(player, target);
					if (att < 2) {
						return att - 10;
					}
					var num = att / 10;
					if (target == player) {
						num += player.maxHp - player.countCards("h") + 0.5;
					} else {
						num += _status.event.n2 * 2;
						if (target.isDamaged()) {
							if (target.hp == 1) {
								num += 3;
							} else if (target.hp == 2) {
								num += 2;
							} else {
								num += 0.5;
							}
						}
					}
					if (target.hasJudge("lebu")) {
						num /= 2;
					}
					return num;
				})
				.set("n2", player.getExpansions("yinbing").length);
			"step 1";
			if (result.bool) {
				player.line(result.targets[0], "green");
				var cards = player.getExpansions("yinbing");
				if (result.targets[0] == player) {
					player.loseToDiscardpile(cards);
					var num = player.maxHp - player.countCards("h");
					if (num > 0) {
						player.draw(num);
					}
				} else {
					var target = result.targets[0];
					target.recover();
					player.give(cards, target, "give");
					target.draw(cards.length);
				}
			}
		},
		ai: {
			combo: "yinbing",
		},
	},
	meibu: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			return event.player != player && get.distance(event.player, player, "attack") > 1;
		},
		logTarget: "player",
		check(event, player) {
			if (get.attitude(player, event.player) >= 0) {
				return false;
			}
			var e2 = player.getEquip(2);
			if (e2) {
				if (e2.name == "tengjia" || e2.name == "rewrite_tengjia") {
					return true;
				}
				if (e2.name == "bagua" || e2.name == "rewrite_bagua") {
					return true;
				}
			}
			return player.countCards("h", "shan") > 0;
		},
		content() {
			var target = trigger.player;
			target.addTempSkill("meibu_viewas");
			target.addTempSkill("meibu_range");
			target.storage.meibu = player;
			target.markSkillCharacter("meibu", player, "魅步", "锦囊牌均视为杀且" + get.translation(player) + "视为在攻击范围内");
		},
		ai: {
			expose: 0.2,
		},
		subSkill: {
			range: {
				mod: {
					targetInRange(card, player, target) {
						if (card.name == "sha" && target == player.storage.meibu) {
							return true;
						}
					},
				},
				onremove(player) {
					game.broadcast(function (player) {
						if (player.marks.meibu) {
							player.marks.meibu.delete();
							delete player.marks.meibu;
						}
					}, player);
					if (player.marks.meibu) {
						player.marks.meibu.delete();
						delete player.marks.meibu;
						game.addVideo("unmark", player, "meibu");
					}
				},
				trigger: { player: "useCard" },
				forced: true,
				popup: false,
				filter(event, player) {
					return event.skill == "meibu_viewas";
				},
				content() {
					player.removeSkill("meibu_viewas");
					game.broadcastAll(function (player) {
						if (player.marks.meibu && player.marks.meibu.info) {
							player.marks.meibu.info.content = player.marks.meibu.info.content.slice(8);
						}
					}, player);
				},
			},
			viewas: {
				mod: {
					cardEnabled(card, player) {
						if (card.name != "sha" && get.type(card, "trick") == "trick") {
							return false;
						}
					},
					cardUsable(card, player) {
						if (card.name != "sha" && get.type(card, "trick") == "trick") {
							return false;
						}
					},
					cardRespondable(card, player) {
						if (card.name != "sha" && get.type(card, "trick") == "trick") {
							return false;
						}
					},
					cardSavable(card, player) {
						if (card.name != "sha" && get.type(card, "trick") == "trick") {
							return false;
						}
					},
				},
				enable: ["chooseToUse", "chooseToRespond"],
				filterCard(card) {
					return get.type(card, "trick") == "trick";
				},
				viewAs: { name: "sha" },
				check() {
					return 1;
				},
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondSha") && current < 0) {
								return 0.8;
							}
						},
					},
					respondSha: true,
					order: 4,
					useful: -1,
					value: -1,
				},
			},
		},
	},
	mumu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard(card, player, target) {
			return card.name == "sha" || (get.type(card, "trick") == "trick" && get.color(card) == "black");
		},
		check(card) {
			return 7 - get.value(card);
		},
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			return target.getEquips(1).length > 0 || target.getEquips(2).length > 0;
		},
		content() {
			"step 0";
			var e1 = target.getEquips(1);
			var e2 = target.getEquips(2);
			event.e1 = e1;
			event.e2 = e2;
			if (e1.length && e2.length) {
				player.chooseControl("武器牌", "防具牌").set("ai", function () {
					if (_status.event.player.getEquip(2)) {
						return "武器牌";
					}
					return "防具牌";
				});
			} else if (e1.length) {
				event.choice = "武器牌";
			} else {
				event.choice = "防具牌";
			}
			"step 1";
			var choice = event.choice || result.control;
			if (choice == "武器牌") {
				if (event.e1) {
					target.discard(event.e1);
				}
				player.draw();
			} else {
				if (event.e2) {
					player.equip(event.e2);
					target.$give(event.e2, player);
				}
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (target.getEquip(2) && !player.getEquip(2)) {
						return -2;
					}
					return -1;
				},
			},
		},
	},
	fentian: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			if (player.countCards("h") >= player.hp) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return player != current && player.inRange(current) && current.countCards("he");
			});
		},
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
		content() {
			"step 0";
			player
				.chooseTarget("焚天：选择一名攻击范围内的角色，将其一张牌置于你的武将牌上", true, function (card, player, target) {
					return player != target && player.inRange(target) && target.countCards("he") > 0;
				})
				.set("ai", function (target) {
					return -get.attitude(_status.event.player, target);
				});
			"step 1";
			if (result.bool) {
				player.logSkill("fentian", result.targets);
				event.target = result.targets[0];
				player.choosePlayerCard(result.targets[0], "he", true);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				player.addToExpansion(result.links, target, "give").gaintag.add("fentian");
			}
		},
		mod: {
			attackRange(from, distance) {
				return distance + from.getExpansions("fentian").length;
			},
		},
	},
	zhiri: {
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		audio: 2,
		skillAnimation: true,
		animationColor: "fire",
		derivation: "xintan",
		filter(event, player) {
			return player.getExpansions("fentian").length >= 3;
		},
		content() {
			player.awakenSkill(event.name);
			player.loseMaxHp();
			player.storage.zhiri = true;
			player.addSkills("xintan");
		},
		ai: {
			combo: "fentian",
		},
	},
	xintan: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		filter(event, player) {
			return player.getExpansions("fentian").length >= 2;
		},
		filterTarget: true,
		prompt: "移去两张“焚”并令一名角色失去1点体力",
		content() {
			"step 0";
			player.chooseCardButton(2, "移去两张“焚”并令" + get.translation(target) + "失去1点体力", player.getExpansions("fentian"), true);
			"step 1";
			if (result.bool) {
				player.loseToDiscardpile(result.links);
				target.loseHp();
			}
		},
		ai: {
			order: 8,
			result: { target: -1 },
			combo: "fentian",
		},
	},
};
