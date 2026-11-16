import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqizhou" | "duanbing_heqi" | "reyingzi_heqi" | "fenwei_heqi" | "lanjiang_heqi" | "olshanxi" | "oltongduo" | "olzhubi" | "olxiaosi">} */
export const groupSkills = {
	//新贺齐
	olqizhou: {
		audio: "qizhou",
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter", "phaseBefore"],
		},
		forced: true,
		onremove: true,
		filter(event, player) {
			if (event.name != "phase" && (event.name != "equip" || event.player != player)) {
				var evt = event.getl(player);
				if (!evt || !evt.es || !evt.es.length) {
					return false;
				}
			}
			var num = player.countMark("olqizhou");
			return lib.skill.olqizhou.getSuitNum(player) != num;
		},
		content() {
			lib.skill.olqizhou.applyChange(player);
		},
		getSuitNum(player) {
			var suits = [],
				es = player.getCards("e");
			for (var i of es) {
				suits.add(get.suit(i, player));
			}
			return Math.min(4, suits.length);
		},
		applyChange(player) {
			player.removeAdditionalSkill("olqizhou");
			var num = lib.skill.olqizhou.getSuitNum(player);
			player.storage.olqizhou = num;
			if (num > 0) {
				player.addAdditionalSkill("olqizhou", lib.skill.olqizhou.derivation.slice(0, num));
			}
		},
		derivation: ["reduanbing", "reyingzi", "fenwei", "lanjiang"],
	},
	duanbing_heqi: { audio: 1 },
	reyingzi_heqi: { audio: 1 },
	fenwei_heqi: { audio: 1 },
	lanjiang_heqi: { audio: 1 },
	olshanxi: {
		audio: "shanxi",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				Array.from({ length: 5 })
					.map((_, i) => i + 1)
					.some(i => player.hasEmptySlot(i)) && game.hasPlayer(current => lib.skill.olshanxi.filterTarget(null, player, current))
			);
		},
		filterTarget(card, player, target) {
			return target != player && player.countCards("h") + target.countCards("h") > 0 && !player.inRangeOf(target);
		},
		content() {
			"step 0";
			var cards1 = player.getCards("h"),
				cards2 = target.getCards("h");
			var num = Array.from({ length: 5 })
				.map((_, i) => i + 1)
				.reduce((sum, i) => sum + player.countEmptySlot(i), 0);
			var dialog = ["闪袭：选择展示至多" + get.cnNumber(num) + "张牌"];
			if (cards1.length > 0) {
				dialog.push('<div class="text center">你的手牌</div>');
				dialog.push(cards1);
			}
			if (cards2.length > 0) {
				dialog.push('<div class="text center">' + get.translation(target) + "的手牌</div>");
				if (player.hasSkillTag("viewHandcard", null, target, true)) {
					dialog.push(cards2);
				} else {
					dialog.push([cards2.randomSort(), "blank"]);
				}
			}
			player.chooseButton(dialog, [1, num], true).set("ai", function (button) {
				var player = _status.event.player,
					target = _status.event.getParent().target;
				var card = button.link,
					cards = ui.selected.buttons.map(button => button.link);
				var hs = player.getCards("h"),
					discard = false;
				for (var i of cards) {
					if (hs.includes(i)) {
						discard = true;
						break;
					}
				}
				if (hs.includes(card)) {
					if (discard || get.name(card) != "shan") {
						return 0;
					}
					if (target.hasCard(card => get.value(card, target) > 5, "e")) {
						return 2;
					}
					return 0;
				}
				if (
					discard &&
					!target.hasCard(function (cardx) {
						return cardx != card && !cards.includes(cardx) && get.value(cardx, target) > 0;
					}, "he")
				) {
					return 0;
				}
				return 1 + Math.random();
			});
			"step 1";
			if (result.bool) {
				event.cards = result.links;
				var list1 = [],
					list2 = [];
				var hs = player.getCards("h");
				for (var card of result.links) {
					if (hs.includes(card)) {
						list1.push(card);
					} else {
						list2.push(card);
					}
				}
				event.list1 = list1;
				event.list2 = list2;
				event.videoId = lib.status.videoId++;
				game.broadcastAll(
					function (player, target, list1, list2, id) {
						var dialog = ui.create.dialog(player + "对" + target + "发动了【闪袭】");
						dialog.videoId = id;
						if (list1.length > 0) {
							dialog.add('<div class="text center">' + player + "展示的牌</div>");
							dialog.add(list1);
						}
						if (list2.length > 0) {
							dialog.add('<div class="text center">' + target + "被展示的牌</div>");
							dialog.add(list2);
						}
					},
					get.translation(player),
					get.translation(target),
					list1,
					list2,
					event.videoId
				);
				game.delay(4);
			} else {
				event.finish();
			}
			"step 2";
			game.broadcastAll("closeDialog", event.videoId);
			var list1 = event.list1.filter(card => get.name(card, player) == "shan");
			var list2 = event.list2.filter(card => get.name(card, target) == "shan");
			if (list1.length && list2.length) {
				game.loseAsync({
					lose_list: [
						[player, list1],
						[target, list2],
					],
					discarder: player,
				}).setContent("discardMultiple");
			} else if (list2.length) {
				target.discard(list2);
			} else if (list1.length) {
				player.discard(list1);
			} else {
				event.finish();
			}
			"step 3";
			if (
				target.hasCard(function (card) {
					return !cards.includes(card) && lib.filter.canBeGained(card, player, target);
				}, "he")
			) {
				player
					.gainPlayerCard(target, true, "he")
					.set("filterButton", function (button) {
						return !_status.event.cards.includes(button.link);
					})
					.set("cards", cards);
			}
		},
		ai: {
			order: 14,
			result: {
				target(player, target) {
					return -target.countCards("h");
				},
			},
		},
	},
	//刘巴
	oltongduo: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return target != player && target.countCards("h") > 0;
				})
				.set("ai", function (target) {
					var att = get.attitude(_status.event.player, target);
					if (att > 0) {
						return Math.sqrt(att) / 10;
					}
					return 5 - att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const result = await target.chooseCard("h", true, "统度：将一张手牌交给" + get.translation(player) + "，然后其于此阶段结束时将此牌置于牌堆顶").forResult();
			if (result.cards?.length) {
				player.addTempSkill("oltongduo_put");
				const next = target.give(result.cards, player);
				next.gaintag.add(event.name);
				await next;
			}
		},
		subSkill: {
			put: {
				audio: "oltongduo",
				trigger: { player: "phaseUseEnd" },
				charlotte: true,
				forced: true,
				filter(event, player) {
					return player.hasCard(card => card.hasGaintag("oltongduo"), "h");
				},
				async content(event, trigger, player) {
					const cards = player.getCards("h", card => card.hasGaintag("oltongduo"));
					game.log(player, "将", get.cnNumber(cards.length) + "张牌", "置于牌堆顶");
					game.broadcastAll(function (player) {
						const cardx = ui.create.card();
						cardx.classList.add("infohidden");
						cardx.classList.add("infoflip");
						player.$throw(cardx, 1000, "nobroadcast");
					}, player);
					await player.lose(cards, ui.cardPile, "insert");
				},
				onremove(player) {
					player.removeGaintag("oltongduo");
				},
			},
		},
	},
	olzhubi: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return player.maxHp;
		},
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.olzhubi.filterTarget(null, player, target));
		},
		group: "olzhubi_replace",
		filterTarget(card, player, target) {
			return target.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await target.chooseCard("he", true, "铸币：请重铸一张牌", lib.filter.cardRecastable).forResult();
			if (result.cards?.length) {
				await target.recast(result.cards, void 0, player => (player.draw().set("log", false).gaintag = ["olzhubi_tag"]));
			}
		},
		ai: {
			order: 6,
			result: {
				target(player, target) {
					if (target.hasCard(card => card.hasGaintag("olzhubi_tag"), "h")) {
						return 0.5;
					}
					if (target == player) {
						return target.countCards("he", card => 4 - get.value(card)) ? 1 : -1;
					}
					return (target.countCards("he") - 2) / 3;
				},
			},
		},
		subSkill: {
			replace: {
				trigger: { global: "phaseJieshuBegin" },
				filter(event, player) {
					return event.player.hasCard(card => card.hasGaintag("olzhubi_tag"), "h");
				},
				forced: true,
				locked: false,
				logTarget: "player",
				async content(event, trigger, player) {
					const cards = get.bottomCards(5, true);
					await game.cardsGotoOrdering(cards);
					const {
						targets: [target],
					} = event;
					const hs = target.getCards("h", card => card.hasGaintag("olzhubi_tag"));
					const result = await target
						.chooseToMove("铸币：用任意“币”交换牌堆底等量张牌")
						.set("filterMove", function (from, to) {
							return typeof to != "number";
						})
						.set("selectionSpec", { move: "swap" })
						.set("list", [
							["牌堆底", cards],
							["你的手牌", hs, "olzhubi_tag"],
						])
						.set("processAI", function (list) {
							var all = list[0][1].concat(list[1][1]),
								cards = all.slice(0);
							var num = _status.event.num;
							cards.sort(function (a, b) {
								return get.value(b) - get.value(a);
							});
							return [cards.slice(num), cards.slice(0, num)];
						})
						.set("num", hs.length)
						.forResult();
					if (result.bool) {
						event.forceDie = true;
						const cards2 = result.moved[0];
						const lose = [],
							gain = cards.slice();
						for (const i of cards2) {
							if (hs.includes(i)) {
								lose.push(i);
							} else {
								gain.remove(i);
							}
						}
						if (lose.length) {
							await player.lose(lose, ui.cardPile);
						}
						if (gain.length) {
							await player.gain(gain, "draw");
						}
						await game.cardsGotoPile(cards2.filter(i => !"hejsdx".includes(get.position(i, true))));
					}
				},
			},
		},
	},
	//傅肜
	olxiaosi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target.countCards("h") > 0 && player != target;
		},
		filterCard(card, player, target) {
			return get.type(card) == "basic";
		},
		check(card) {
			var player = _status.event.player;
			if (player.hasValueTarget(card)) {
				return 10 - get.value(card);
			}
			return 0.1;
		},
		content() {
			"step 0";
			if (
				target.countCards("h", card => {
					return get.type(card) == "basic" && lib.filter.cardDiscardable(card, target, "olxiaosi");
				}) == 0
			) {
				event.draw = true;
			} else {
				target.chooseToDiscard("h", true, "效死：弃置一张基本牌", { type: "basic" });
			}
			"step 1";
			var cards2 = cards.slice(0);
			if (result.bool) {
				cards2 = cards2.addArray(result.cards);
			}
			event.cards2 = cards2;
			"step 2";
			var cardsx = event.cards2.filter(i => get.position(i, true) == "d" && player.hasUseTarget(i, false));
			if (!cardsx.length) {
				event.goto(5);
			} else {
				player
					.chooseButton(["效死：是否使用其中的一张牌？", cardsx])
					.set("filterButton", button => {
						return _status.event.player.hasUseTarget(button.link, false);
					})
					.set("ai", button => {
						if (button.link.name == "jiu") {
							return 10;
						}
						return _status.event.player.getUseValue(button.link);
					});
			}
			"step 3";
			if (result.bool) {
				var card = result.links[0];
				event.cards2.remove(card);
				player.$gain2(card, false);
				game.delayx();
				player.chooseUseTarget(true, card, false, "nodistance");
			} else {
				event.goto(5);
			}
			"step 4";
			if (event.cards2.filter(i => get.position(i, true) == "d" && player.hasUseTarget(i, false)).length) {
				event.goto(2);
			}
			"step 5";
			if (event.draw) {
				player.draw();
			}
		},
		ai: {
			order: 4.5,
			result: {
				player: 1,
				target: -1,
			},
		},
	},
};
