import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "spyajun" | "spzundi" | "spxiangzhen" | "spfangzong" | "spxizhan" | "spjungong" | "spdengli">} */
export const groupSkills = {
	//崔琰
	spyajun: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			var hs = player.getCards("h");
			return (
				hs.length > 0 &&
				!player.hasSkillTag("noCompareSource") &&
				player.hasHistory("gain", function (evt) {
					for (var i of evt.cards) {
						if (hs.includes(i)) {
							return true;
						}
					}
					return false;
				}) &&
				game.hasPlayer(function (current) {
					return current != player && player.canCompare(current);
				})
			);
		},
		async cost(event, trigger, player) {
			let cards = [];
			const hs = player.getCards("h");
			player.getHistory("gain", function (evt) {
				cards.addArray(evt.cards);
			});
			cards = cards.filter(function (i) {
				return hs.includes(i);
			});
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt("spyajun"),
					prompt2: "操作提示：选择一张本回合新得到的牌作为拼点牌，然后选择一名拼点目标",
					cards: cards,
					filterCard(card) {
						return _status.event.cards.includes(card);
					},
					filterTarget(card, player, target) {
						return player.canCompare(target);
					},
					ai1(card) {
						return get.number(card) - get.value(card);
					},
					ai2(target) {
						return -get.attitude(_status.event.player, target) * Math.sqrt(5 - Math.min(4, target.countCards("h"))) * (target.hasSkillTag("noh") ? 0.5 : 1);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				cards: [card],
				targets: [target],
			} = event;
			const next = player.chooseToCompare(target);
			next.fixedResult ??= {};
			next.fixedResult[player.playerid] = card;
			const result = await next.forResult();
			if (result.bool) {
				const cards = [result.player, result.target].filterInD("d");
				if (cards.length) {
					const result2 = await player
						.chooseButton(["雅俊：是否将一张牌置于牌堆顶？", cards])
						.set("ai", function (button) {
							if (get.color(button.link) == "black") {
								return 1;
							}
							return 0;
						})
						.forResult();
					if (result2.bool && result2.links?.length) {
						const { links } = result2;
						game.log(player, "将", links, "置于牌堆顶");
						await game.cardsGotoPile(links, "insert");
					}
				}
			} else {
				player.addMark("spyajun_less", 1, false);
				player.addTempSkill("spyajun_less");
			}
		},
		group: "spyajun_draw",
		subSkill: {
			draw: {
				audio: "spyajun",
				trigger: { player: "phaseDrawBegin2" },
				forced: true,
				locked: false,
				filter(event, player) {
					return !event.numFixed;
				},
				async content(event, trigger, player) {
					trigger.num++;
				},
			},
			less: {
				onremove: true,
				charlotte: true,
				intro: { content: "手牌上限-#" },
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("spyajun_less");
					},
				},
			},
		},
	},
	spzundi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterCard: true,
		filterTarget: true,
		check(card) {
			return 7 - get.value(card);
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await player.judge().forResult();
			if (result.color) {
				switch (result.color) {
					case "black":
						await target.draw(3);
						break;

					case "red":
						await target.moveCard();
						break;

					default:
						break;
				}
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					if (target.canMoveCard(true)) {
						return 3;
					}
					return 1;
				},
			},
		},
	},
	//花蔓
	spxiangzhen: {
		trigger: { target: "useCardToBefore" },
		forced: true,
		audio: 2,
		filter(event, player) {
			return event.card.name == "nanman";
		},
		content() {
			trigger.cancel();
		},
		group: "spxiangzhen_draw",
		subSkill: {
			draw: {
				audio: "spxiangzhen",
				trigger: { global: "useCardAfter" },
				forced: true,
				filter(event, player) {
					return (
						event.card.name == "nanman" &&
						game.hasPlayer2(function (current) {
							return current.hasHistory("damage", function (evt) {
								return evt.card == event.card;
							});
						})
					);
				},
				async content(event, trigger, player) {
					let sources = game.filterPlayer(cur => {
						return cur.hasHistory("sourceDamage", evt => {
							return evt.card == trigger.card;
						});
					});
					sources.push(player);
					await game.asyncDraw(sources.sortBySeat());
					game.delayx();
				},
			},
		},
	},
	spfangzong: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		filter(event, player) {
			return player.countCards("h") < Math.min(8, game.countPlayer());
		},
		content() {
			player.drawTo(Math.min(8, game.countPlayer()));
		},
		mod: {
			playerEnabled(card, player, target) {
				if (player == _status.currentPhase && get.tag(card, "damage") > 0 && !player.isTempBanned("spfangzong") && player.inRange(target)) {
					return false;
				}
			},
			targetEnabled(card, player, target) {
				if (get.tag(card, "damage") > 0 && !target.isTempBanned("spfangzong") && player.inRange(target)) {
					return false;
				}
			},
		},
		ai: {
			combo: "spxizhan",
			halfneg: true,
		},
	},
	spxizhan: {
		audio: 5,
		trigger: { global: "phaseBegin" },
		filter(event, player) {
			return player != event.player;
		},
		logAudio(event, player, name, indexedData, costResult) {
			if (!costResult.cards.length) {
				return "spxizhan2.mp3";
			}
			let suit = get.suit(costResult.cards[0]);
			return "spxizhan" + [null, "spade", null, "heart", "club", "diamond"].indexOf(suit) + ".mp3";
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseToDiscard("he", "嬉战：弃置一张牌或失去1点体力", "根据弃置的牌对" + get.translation(trigger.player) + "视为使用如下牌：<br>♠，其使用【酒】；♥，你使用【无中生有】<br>♣，对其使用【铁索连环】；♦：对其使用火【杀】")
				.set("ai", function (card) {
					var player = _status.event.player,
						target = _status.event.getTrigger().player;
					var suit = get.suit(card, player),
						list;
					switch (suit) {
						case "spade":
							list = [{ name: "jiu" }, target, target];
							break;
						case "heart":
							list = [{ name: "wuzhong" }, player, player];
							break;
						case "club":
							list = [{ name: "tiesuo" }, player, target];
							break;
						case "diamond":
							list = [{ name: "sha", nature: "fire" }, player, target];
							break;
						default:
							return 0;
					}
					list[0].isCard = true;
					var eff = 0;
					if (list[1].canUse(list[0], list[2], false)) {
						eff = get.effect(list[2], list[0], list[1], player);
					}
					if (eff >= 0 || suit == "club") {
						eff = Math.max(eff, 5);
					}
					return eff * 1.5 - get.value(card);
				})
				.set("chooseonly", true)
				.forResult();
			event.result = {
				bool: true,
				cards: result.cards || [],
				targets: [trigger.player],
			};
		},
		async content(event, trigger, player) {
			if (event.cards && event.cards.length) {
				await player.discard(event.cards);
				player.tempBanSkill("spfangzong");
				var target = trigger.player,
					card = event.cards[0],
					suit = get.suit(card, player);
				if (!lib.suit.includes(suit) || ((!target || !target.isIn()) && suit != "heart")) {
					return;
				}
				switch (suit) {
					case "spade":
						await target.chooseUseTarget("jiu", true);
						break;
					case "heart":
						await player.chooseUseTarget("wuzhong", true);
						break;
					case "club":
						if (player.canUse("tiesuo", target)) {
							await player.useCard({ name: "tiesuo", isCard: true }, target);
						}
						break;
					case "diamond":
						if (player.canUse({ name: "sha", isCard: true, nature: "fire" }, target, false)) {
							await player.useCard({ name: "sha", isCard: true, nature: "fire" }, target, false);
						}
						break;
				}
			} else {
				await player.loseHp();
			}
		},
		ai: {
			halfneg: true,
		},
	},
	//高览
	spjungong: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			var num = player.countMark("spjungong_used");
			return num < player.hp || num <= player.countCards("he");
		},
		filterTarget(card, player, target) {
			return target != player && player.canUse("sha", target, false);
		},
		filterCard: true,
		position: "he",
		selectCard() {
			var player = _status.event.player,
				num = player.countMark("spjungong_used") + 1;
			if (ui.selected.cards.length || num > player.hp) {
				return num;
			}
			return [0, num];
		},
		check(card) {
			return 6 - get.value(card);
		},
		prompt() {
			var player = _status.event.player,
				num = get.cnNumber(player.countMark("spjungong_used") + 1);
			return "弃置" + num + "张牌或失去" + num + "点体力，视为使用杀";
		},
		content() {
			"step 0";
			player.addTempSkill("spjungong_used");
			player.addMark("spjungong_used", 1, false);
			if (!cards.length) {
				player.loseHp(player.countMark("spjungong_used"));
			}
			player.useCard({ name: "sha", isCard: true }, target, false);
			"step 1";
			if (
				player.hasHistory("sourceDamage", function (evt) {
					var card = evt.card;
					if (!card || card.name != "sha") {
						return false;
					}
					var evtx = evt.getParent("useCard");
					return evtx.card == card && evtx.getParent() == event;
				})
			) {
				player.tempBanSkill("spjungong");
			}
		},
		ai: {
			order(item, player) {
				return get.order({ name: "sha" }, player) + 1;
			},
			result: {
				target(player, target) {
					if (!ui.selected.cards.length) {
						return 0;
					}
					return get.effect(target, { name: "sha" }, player, target);
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "已发动过#次" },
			},
		},
	},
	spdengli: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		frequent: true,
		filter(event, player) {
			return event.card.name == "sha" && event.player.hp == event.target.hp;
		},
		content() {
			player.draw();
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					var hp = player.hp,
						evt = _status.event;
					if (evt.name == "chooseToUse" && evt.player == player && evt.skill == "spjungong" && !ui.selected.cards.length) {
						hp -= (player.getStat("skill").spjungong || 0) + 1;
					}
					if (card && card.name == "sha" && hp == target.hp) {
						return [1, 0.3];
					}
				},
				target_use(card, player, target) {
					if (card && card.name == "sha" && player.hp == target.hp) {
						return [1, 0.3];
					}
				},
			},
		},
	},
};
