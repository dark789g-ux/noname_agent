import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olhuanshi" | "olhongyuan" | "olmingzhe" | "xindiaodu">} */
export const groupSkills = {
	//新诸葛瑾
	olhuanshi: {
		audio: "huanshi",
		trigger: { global: "judge" },
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		logTarget: "player",
		prompt2(event, player) {
			var str = get.translation(event.player) + "的" + event.judgestr + "判定为" + get.translation(event.player.judging[0]) + "。你可以令其观看你的牌，其选择一张牌进行改判。";
			if (!player.hasSkill("olhuanshi_mark", null, null, false)) {
				str += "然后你可以重铸任意张牌。";
			}
			return str;
		},
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
			if (!player.countCards("h") || player.hasSkill("olhuanshi_mark", null, null, false)) {
				event.finish();
			}
			"step 3";
			player.chooseCard("是否重铸任意张手牌？", "操作提示：选择要重铸的牌并点击“确定”", [1, player.countCards("h")], lib.filter.cardRecastable, "allowChooseAll").set("ai", function (card) {
				var player = _status.event.player,
					cards = ui.selected.cards;
				if (!player.hasSkill("olmingzhe")) {
					return 5 - get.value(card);
				}
				for (var i of cards) {
					if (get.color(i, player) == "red") {
						return 5 - get.value(card);
					}
				}
				return 7.5 - get.value(card);
			});
			"step 4";
			if (result.bool) {
				player.addTempSkill("olhuanshi_mark");
				player.recast(result.cards);
			}
		},
		ai: {
			rejudge: true,
			tag: {
				rejudge: 1,
			},
		},
		subSkill: { mark: { charlotte: true } },
	},
	olhongyuan: {
		audio: "hongyuan",
		trigger: { player: "gainAfter", global: "loseAsyncAfter" },
		filter(event, player) {
			if (!player.countCards("he") || player.hasSkill("olhongyuan_blocker", null, null, false)) {
				return false;
			}
			return event.getg(player).length >= 2;
		},
		async content(event, trigger, player) {
			player.addTempSkill("olhongyuan_blocker", ["phaseZhunbeiBefore", "phaseJudgeBefore", "phaseDrawBefore", "phaseUseBefore", "phaseDiscardBefore", "phaseJieshuBefore", "phaseBefore"]);
			let selectedTargets = [];
			while (
				selectedTargets.length < 2 &&
				player.countCards("he") &&
				game.hasPlayer(target => {
					return target != player && !selectedTargets.includes(target);
				})
			) {
				const { bool, targets, cards } = await player
					.chooseCardTarget({
						prompt: "弘援：将一张牌交给一名其他角色",
						filterCard: true,
						position: "he",
						filterTarget(card, player, target) {
							return target != player && !get.event().selectedTargets.includes(target);
						},
						complexCard: true,
						complexTarget: true,
						complexSelect: true,
						ai1(card) {
							const player = get.event().player;
							if (
								!game.hasPlayer(current => {
									if (get.event().selectedTargets.includes(current)) {
										return false;
									}
									return current != player && get.attitude(player, current) > 0 && !current.hasSkillTag("nogain");
								})
							) {
								return -get.value(card);
							}
							return 4 + (player.hasSkill("olmingzhe") && get.color(card) == "red" ? 2 : 0) - Math.max(player.getUseValue(card), get.value(card, player));
						},
						ai2(target) {
							const player = _status.event.player,
								att = get.attitude(player, target);
							if (!ui.selected.cards.length) {
								return att;
							}
							const card = ui.selected.cards[0],
								val = get.value(card, target);
							if (val < 0) {
								return -att * Math.sqrt(-val);
							}
							return att * Math.sqrt(val + 2);
						},
					})
					.set("selectedTargets", selectedTargets)
					.forResult();
				if (bool) {
					const target = targets[0];
					selectedTargets.push(target);
					player.line(target);
					await player.give(cards, target);
				} else {
					break;
				}
			}
		},
		ai: { threaten: 0.8 },
		subSkill: { blocker: { charlotte: true } },
	},
	olmingzhe: {
		audio: "mingzhe",
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		forced: true,
		filter(event, player) {
			if (player.isPhaseUsing()) {
				return false;
			}
			var evt = event.getl(player);
			for (var i of evt.cards2) {
				if (get.color(i, player) == "red") {
					return true;
				}
			}
			return false;
		},
		content() {
			if (!trigger.visible) {
				var cards = trigger.getl(player).hs.filter(function (i) {
					return get.color(i, player) == "red";
				});
				if (cards.length > 0) {
					player.showCards(cards, get.translation(player) + "发动了【明哲】");
				}
			}
			player.draw();
		},
	},
	//吕范
	xindiaodu: {
		audio: "diaodu",
		group: "xindiaodu_use",
		frequent: true,
		preHidden: true,
		isFriendOf(player, target) {
			if (get.mode() == "guozhan") {
				return player.isFriendOf(target);
			}
			return player.group == target.group;
		},
		subSkill: {
			temp: { charlotte: true },
			use: {
				trigger: {
					global: "useCard",
				},
				filter(event, player) {
					return get.type(event.card) == "equip" && event.player.isIn() && lib.skill.xindiaodu.isFriendOf(player, event.player) && (player == event.player || player.hasSkill("xindiaodu")) && !event.player.hasSkill("xindiaodu_temp");
				},
				direct: true,
				content() {
					"step 0";
					var next = trigger.player.chooseBool("是否发动【调度】摸一张牌？");
					if (player.hasSkill("xindiaodu")) {
						next.set("frequentSkill", "xindiaodu");
					}
					if (player == trigger.player) {
						next.setHiddenSkill("xindiaodu");
					}
					"step 1";
					if (result.bool) {
						player.logSkill("xindiaodu", trigger.player);
						trigger.player.draw("nodelay");
						trigger.player.addTempSkill("xindiaodu_temp");
					}
				},
			},
		},
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return lib.skill.xindiaodu.isFriendOf(current, player) && current.countGainableCards(player, "e") > 0;
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2(event.name), function (card, player, current) {
					return lib.skill.xindiaodu.isFriendOf(current, player) && current.countGainableCards(player, "e") > 0;
				})
				.setHiddenSkill(event.name).ai = function (target) {
				var num = 1;
				if (target.hasSkill("gz_xiaoji")) {
					num += 2.5;
				}
				if (target.isDamaged() && target.getEquip("baiyin")) {
					num += 2.5;
				}
				if (target.hasSkill("xuanlve")) {
					num += 2;
				}
				return num;
			};
			"step 1";
			if (result.bool) {
				event.target1 = result.targets[0];
				player.logSkill(event.name, event.target1);
				player.gainPlayerCard(event.target1, "e", true);
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool && player.getCards("h").includes(result.cards[0])) {
				event.card = result.cards[0];
				player
					.chooseTarget("是否将" + get.translation(event.card) + "交给一名其他角色？", function (card, player, current) {
						return current != player && current != _status.event.target1 && lib.skill.xindiaodu.isFriendOf(current, player);
					})
					.set("target1", event.target1);
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "green");
				player.give(card, target);
			}
		},
	},
};
