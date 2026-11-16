import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "bazhan" | "jiaoying" | "jiaoying2" | "jiaoying3" | "jiaoying3_draw">} */
export const groupSkills = {
	//樊玉凤
	bazhan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		zhuanhuanji: true,
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				return "出牌阶段限一次，" + (storage ? "你可以获得一名其他角色的至多两张手牌。" : "你可以将至多两张手牌交给一名其他角色。") + "若以此法移动的牌包含【酒】或♥牌，则你可令得到牌的角色执行一项：①回复1点体力。②复原武将牌。";
			},
		},
		filter(event, player) {
			if (player.storage.bazhan) {
				return game.hasPlayer(function (current) {
					return current != player && current.countGainableCards(player, "h") > 0;
				});
			}
			return player.countCards("h") > 0;
		},
		filterCard: true,
		discard: false,
		lose: false,
		selectCard() {
			if (_status.event.player.storage.bazhan) {
				return 0;
			}
			return [1, 2];
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			if (player.storage.bazhan) {
				return target.countGainableCards(player, "h") > 0;
			}
			return true;
		},
		prompt() {
			if (_status.event.player.storage.bazhan) {
				return "获得一名其他角色的至多两张手牌";
			}
			return "将至多两张手牌交给一名其他角色";
		},
		delay: false,
		check(card) {
			var player = _status.event.player;
			var bool1 = false,
				bool2 = false;
			for (var i of game.players) {
				if (get.attitude(player, i) <= 0 || player == i) {
					continue;
				}
				bool1 = true;
				if (i.isDamaged() || i.isTurnedOver()) {
					bool2 = true;
					break;
				}
			}
			if (bool2 && !ui.selected.cards.length && (get.suit(card, player) == "heart" || get.name(card, player) == "jiu")) {
				return 10;
			}
			if (bool1) {
				return 9 - get.value(card);
			}
			if (get.color(card) == "red") {
				return 5 - get.value(card);
			}
			return 0;
		},
		content() {
			"step 0";
			if (player.storage.bazhan) {
				event.recover = player;
				player.gainPlayerCard(target, "h", true, "visibleMove", [1, 2]);
			} else {
				event.recover = target;
				player.give(cards, target);
			}
			player.changeZhuanhuanji("bazhan");
			"step 1";
			var target = event.recover;
			var cards = event.cards;
			if (result.bool && result.cards && result.cards.length) {
				cards = result.cards;
			}
			if (
				!cards ||
				!target ||
				!target.getCards("h").filter(function (i) {
					return cards.includes(i);
				}).length ||
				(function () {
					for (var card of cards) {
						if (get.suit(card, target) == "heart" || get.name(card, target) == "jiu") {
							return false;
						}
					}
					return true;
				})()
			) {
				event.finish();
				return;
			}
			var list = [];
			event.addIndex = 0;
			var str = get.translation(target);
			event.target = target;
			if (target.isDamaged()) {
				list.push("令" + str + "回复1点体力");
			} else {
				event.addIndex++;
			}
			if (target.isLinked() || target.isTurnedOver()) {
				list.push("令" + get.translation(target) + "复原武将牌");
			}
			if (!list.length) {
				event.finish();
			} else {
				player
					.chooseControl("cancel2")
					.set("choiceList", list)
					.set("ai", function () {
						var evt = _status.event.getParent();
						if (get.attitude(evt.player, evt.target) < 0) {
							return "cancel2";
						}
						if (evt.target.hp > 1 && evt.target.isTurnedOver()) {
							return 1 - evt.addIndex;
						}
						return 0;
					});
			}
			"step 2";
			if (result.control == "cancel2") {
				event.finish();
			} else if (result.index + event.addIndex == 0) {
				event.recover.recover();
				event.finish();
			} else if (event.recover.isLinked()) {
				event.recover.link();
			}
			"step 3";
			if (event.recover.isTurnedOver()) {
				event.recover.turnOver();
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (player.storage.bazhan) {
						return -1;
					}
					if (ui.selected.cards.length) {
						var cards = ui.selected.cards,
							card = cards[0];
						if (get.value(cards, target) < 0) {
							return -0.5;
						}
						if (get.attitude(player, target) > 0) {
							if ((target.isDamaged() || target.isTurnedOver()) && (get.suit(card, target) == "heart" || get.name(card, target) == "jiu")) {
								return 3;
							}
							if (target.hasUseTarget(card) && target.getUseValue(card) > player.getUseValue(card, null, true)) {
								return 1.4;
							}
							return 1;
						}
					}
					return 0;
				},
			},
		},
	},
	jiaoying: {
		audio: 2,
		trigger: {
			global: ["gainAfter", "loseAsyncAfter"],
		},
		forced: true,
		getIndex(event, player) {
			if (!event.getl || !event.getg) {
				return [];
			}
			let evt = event.getl(player);
			if (!evt || !evt.hs || !evt.hs.length) {
				return [];
			}
			return game
				.filterPlayer(current => {
					let evtx = event.getg(current);
					return evtx && evtx.some(card => evt.hs.includes(card));
				})
				.sortBySeat();
		},
		logTarget(_1, _2, _3, target) {
			return target;
		},
		async content(event, trigger, player) {
			const target = event.indexedData;
			if (!target.storage.jiaoying2) {
				target.storage.jiaoying2 = [];
			}
			const cs = trigger.getl(player).hs,
				cards = trigger.getg(target).filter(card => cs.includes(card));
			for (let i of cards) {
				target.storage.jiaoying2.add(get.color(i, player));
			}
			target.addTempSkill("jiaoying2");
			target.markSkill("jiaoying2");
			player.addTempSkill("jiaoying3");
			if (!player.storage.jiaoying3) {
				player.storage.jiaoying3 = [];
			}
			player.storage.jiaoying3.add(target);
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				var target = arg.target;
				if (target.getStorage("jiaoying2").includes("red") && get.tag(arg.card, "respondShan") && !target.hasSkillTag("respondShan", true, null, true)) {
					return true;
				}
				return false;
			},
		},
	},
	jiaoying2: {
		onremove: true,
		charlotte: true,
		mod: {
			cardEnabled2(card, player) {
				if (player.getStorage("jiaoying2").includes(get.color(card))) {
					return false;
				}
			},
		},
		intro: {
			content: "本回合内不能使用或打出$牌",
		},
	},
	jiaoying3: {
		onremove: true,
		trigger: { global: "useCard1" },
		silent: true,
		firstDo: true,
		charlotte: true,
		sourceSkill: "jiaoying",
		filter(event, player) {
			return player.storage.jiaoying3.includes(event.player);
		},
		content() {
			while (player.storage.jiaoying3.includes(trigger.player)) {
				player.storage.jiaoying3.remove(trigger.player);
			}
			if (!player.storage.jiaoying3.length) {
				player.removeSkill("jiaoying3");
			}
		},
		group: "jiaoying3_draw",
	},
	jiaoying3_draw: {
		trigger: { global: "phaseEnd" },
		direct: true,
		charlotte: true,
		sourceSkill: "jiaoying",
		filter(event, player) {
			return (
				player.getStorage("jiaoying3").length > 0 &&
				game.hasPlayer(function (current) {
					return current.countCards("h") < 5;
				})
			);
		},
		content() {
			"step 0";
			player.storage.jiaoying3.shift();
			player
				.chooseTarget("醮影：令一名角色将手牌摸至五张", function (card, player, target) {
					return target.countCards("h") < 5;
				})
				.set("ai", function (target) {
					var att = get.attitude(_status.event.player, target);
					if (att > 2) {
						return 5 - target.countCards("h");
					}
					return att / 3;
				});
			"step 1";
			if (result.bool) {
				player.logSkill("jiaoying", result.targets);
				for (var i = 0; i < result.targets.length; i++) {
					result.targets[i].drawTo(5);
				}
				if (lib.skill.jiaoying3_draw.filter(null, player)) {
					event.goto(0);
				}
			}
		},
	},
};
