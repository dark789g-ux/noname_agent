import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "huanshi" | "mingzhe" | "duwu" | "duwu2" | "yicong" | "yongsi" | "yongsi1" | "yongsi2" | "bifa" | "bifa2" | "songci">} */
export const groupSkills = {
	huanshi: {
		audio: 2,
		trigger: { global: "judge" },
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		logTarget: "player",
		check(event, player) {
			if (get.attitude(player, event.player) <= 0) {
				return false;
			}
			var cards = player.getCards("he");
			var judge = event.judge(event.player.judging[0]);
			for (var i = 0; i < cards.length; i++) {
				var judge2 = event.judge(cards[i]);
				if (judge2 > judge) {
					return true;
				}
				if (_status.currentPhase != player && judge2 == judge && get.color(cards[i]) == "red" && get.useful(cards[i]) < 5) {
					return true;
				}
			}
			return false;
		},
		content() {
			"step 0";
			var target = trigger.player;
			var judge = trigger.judge(target.judging[0]);
			var attitude = get.attitude(target, player);
			target
				.choosePlayerCard("请选择代替判定的牌", "he", "visible", true, player)
				.set("ai", function (button) {
					var card = button.link;
					var judge = _status.event.judge;
					var attitude = _status.event.attitude;
					var result = trigger.judge(card) - judge;
					var player = _status.event.player;
					if (result > 0) {
						return 20 + result;
					}
					if (result == 0) {
						if (_status.currentPhase == player) {
							return 0;
						}
						if (attitude >= 0) {
							return get.color(card) == "red" ? 7 : 0 - get.value(card);
						} else {
							return get.color(card) == "black" ? 10 : 0 + get.value(card);
						}
					}
					if (attitude >= 0) {
						return get.color(card) == "red" ? 0 : -10 + result;
					} else {
						return get.color(card) == "black" ? 0 : -10 + result;
					}
				})
				.set("filterButton", function (button) {
					var player = _status.event.target;
					var card = button.link;
					var mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (mod2 != "unchanged") {
						return mod2;
					}
					var mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
					if (mod != "unchanged") {
						return mod;
					}
					return true;
				})
				.set("judge", judge)
				.set("attitude", attitude);
			"step 1";
			if (result.bool) {
				event.card = result.links[0];
				player.respond(event.card, "highlight", "noOrdering").nopopup = true;
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				if (trigger.player.judging[0].clone) {
					trigger.player.judging[0].clone.classList.remove("thrownhighlight");
					game.broadcast(function (card) {
						if (card.clone) {
							card.clone.classList.remove("thrownhighlight");
						}
					}, trigger.player.judging[0]);
					game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
				}
				game.cardsDiscard(trigger.player.judging[0]);
				trigger.player.judging[0] = event.card;
				trigger.orderingCards.add(event.card);
				game.log(trigger.player, "的判定牌改为", event.card);
				game.delay(2);
			}
		},
		ai: {
			rejudge: true,
			tag: {
				rejudge: 1,
			},
		},
	},
	mingzhe: {
		audio: 2,
		audioname2: { wangyuanji: "qc_mingzhe" },
		trigger: {
			player: ["useCard", "respond", "loseAfter"],
			global: "loseAsyncAfter",
		},
		frequent: true,
		getIndex(event, player) {
			if (event.name.indexOf("lose") != 0) {
				return 1;
			}
			return event.getl?.(player)?.cards2?.filter(card => get.color(card, player) == "red").length;
		},
		filter(event, player) {
			if (player == _status.currentPhase) {
				return false;
			}
			if (event.name.indexOf("lose") != 0) {
				return get.color(event.card) == "red";
			}
			return event.type == "discard";
		},
		async content(event, trigger, player) {
			await player.draw();
		},
		ai: { threaten: 0.7 },
	},
	duwu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.hp > 0 && current.hp <= player.countCards("he") && player.inRange(current);
			});
		},
		filterCard() {
			if (ui.selected.targets.length) {
				return false;
			}
			return true;
		},
		position: "he",
		selectCard: [1, Infinity],
		complexSelect: true,
		complexCard: true,
		filterTarget(card, player, target) {
			return target != player && target.hp > 0 && player.inRange(target) && ui.selected.cards.length == target.hp;
		},
		check(card) {
			var player = _status.event.player;
			if (
				game.hasPlayer(function (current) {
					return current != player && current.hp > 0 && player.inRange(current) && ui.selected.cards.length == current.hp && get.damageEffect(current, player, player) > 0;
				})
			) {
				return 0;
			}
			switch (ui.selected.cards.length) {
				case 0:
					return 8 - get.value(card);
				case 1:
					return 6 - get.value(card);
				case 2:
					return 3 - get.value(card);
				default:
					return 0;
			}
		},
		content() {
			player.addTempSkill("duwu2");
			target.damage("nocard");
		},
		ai: {
			damage: true,
			order: 2,
			result: {
				target(player, target) {
					return get.damageEffect(target, player);
				},
			},
			threaten: 1.5,
			expose: 0.3,
		},
	},
	duwu2: {
		trigger: { global: "dyingAfter" },
		forced: true,
		popup: false,
		charlotte: true,
		sourceSkill: "duwu",
		filter(event, player) {
			if (!event.player.isIn() || !event.reason) {
				return false;
			}
			let evt = event.reason.getParent();
			return evt.name == "duwu" && evt.player == player;
		},
		content() {
			player.loseHp();
			player.tempBanSkill("duwu");
		},
	},
	yicong: {
		trigger: {
			player: ["changeHp"],
		},
		audio: 2,
		audioname: ["re_gongsunzan"],
		forced: true,
		filter(event, player) {
			return get.sgn(player.hp - 2.5) != get.sgn(player.hp - 2.5 - event.num);
		},
		content() {},
		mod: {
			globalFrom(from, to, current) {
				if (from.hp > 2) {
					return current - 1;
				}
			},
			globalTo(from, to, current) {
				if (to.hp <= 2) {
					return current + 1;
				}
			},
		},
		ai: {
			threaten: 0.8,
		},
	},
	yongsi: {
		audio: 2,
		group: ["yongsi1", "yongsi2"],
		locked: true,
		ai: {
			threaten: 3.2,
		},
	},
	yongsi1: {
		audio: true,
		trigger: { player: "phaseDrawBegin2" },
		forced: true,
		sourceSkill: "yongsi",
		filter(event, player) {
			return !event.numFixed;
		},
		content() {
			trigger.num += game.countGroup();
		},
	},
	yongsi2: {
		audio: true,
		trigger: { player: "phaseDiscardBegin" },
		forced: true,
		sourceSkill: "yongsi",
		content() {
			player.chooseToDiscard(game.countGroup(), "he", true);
		},
	},
	bifa: {
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		audio: 2,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		content() {
			"step 0";
			player.chooseCardTarget({
				filterCard: true,
				filterTarget(card, player, target) {
					return player != target && !target.getExpansions("bifa2").length;
				},
				ai1(card) {
					return 7 - get.value(card);
				},
				ai2(target) {
					var num = target.hasSkillTag("maixie") ? 2 : 0;
					return -get.attitude(_status.event.player, target) - num;
				},
				prompt: get.prompt2("bifa"),
			});
			"step 1";
			if (result.bool) {
				event.forceDie = true;
				var target = result.targets[0];
				event.target = target;
				player.logSkill("bifa", result.targets[0]);
				event.card = result.cards[0];
				target.storage.bifa2 = [result.cards[0], player];
				if (!_status.connectMode && player.isUnderControl(true)) {
					player.$giveAuto(result.cards[0], target, false);
				} else {
					player.$give(1, target, false);
				}
				target.addToExpansion(result.cards[0]).gaintag.add("bifa2");
			} else {
				event.finish();
			}
			"step 2";
			if (target.getExpansions("bifa2").includes(card)) {
				target.addSkill("bifa2");
			} else {
				delete target.storage.bifa2;
			}
		},
		ai: {
			threaten: 1.7,
			expose: 0.3,
		},
	},
	bifa2: {
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		charlotte: true,
		audio: false,
		sourceSkill: "bifa",
		filter(event, player) {
			return player.storage.bifa2 && player.getExpansions("bifa2").includes(player.storage.bifa2[0]);
		},
		content() {
			"step 0";
			if (player.storage.bifa2[1].isIn() && player.countCards("h")) {
				player
					.chooseCard(get.translation(player.storage.bifa2[1]) + "的笔伐牌为：", function (card) {
						return get.type(card, "trick") == _status.event.type;
					})
					.set("ai", function (card) {
						return 8 - get.value(card);
					})
					.set("type", get.type(player.storage.bifa2[0], "trick"))
					.set("promptx", [[player.storage.bifa2[0]], "请交给其一张与此牌类别相同的手牌，否则失去1点体力"]);
			} else {
				event.directfalse = true;
			}
			"step 1";
			if (result.bool && !event.directfalse) {
				player.give(result.cards, player.storage.bifa2[1]);
				player.gain(player.storage.bifa2[0], "draw");
			} else {
				player.loseHp();
			}
			"step 2";
			player.removeSkill("bifa2");
		},
		marktext: "檄",
		intro: {
			markcount: () => 1,
			name: "笔伐",
			content: "已成为〖笔伐〗的目标",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
			delete player.storage[skill];
		},
	},
	songci: {
		onChooseToUse(event) {
			event.targetprompt2.add(target => {
				if (event.skill !== "songci" || !target.classList.contains("selectable")) {
					return;
				}
				if (target.countCards("h") > target.hp) {
					return "弃牌";
				} else {
					return "摸牌";
				}
			});
		},
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => get.info("songci").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return !player.getStorage("songci").includes(target);
		},
		logAudio(event, player) {
			const target = event.targets[0],
				goon = target.countCards("h") > target.hp;
			return goon ? "songci2.mp3" : "songci1.mp3";
		},
		async content(event, trigger, player) {
			const { target } = event,
				goon = target.countCards("h") > target.hp;
			player.markAuto(event.name, [target]);
			if (goon) {
				await target.chooseToDiscard(2, "he", true);
			} else {
				await target.draw(2);
			}
		},
		intro: { content: "已对$发动过〖颂词〗" },
		ai: {
			order: 7,
			threaten: 1.6,
			expose: 0.2,
			result: {
				target(player, target) {
					if (target.countCards("h") <= target.hp) {
						return 1;
					} else if (target.countCards("h") > target.hp) {
						return -1;
					}
				},
			},
		},
		group: "songci_draw",
		subSkill: {
			draw: {
				audio: "songci",
				trigger: { player: "phaseDiscardEnd" },
				forced: true,
				filter(event, player) {
					return !game.hasPlayer(current => {
						return !player.getStorage("songci").includes(current);
					});
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
		},
	},
};
