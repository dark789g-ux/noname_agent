import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oltianhou" | "olchenshuo">} */
export const groupSkills = {
	//OL周群
	oltianhou: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		async content(event, trigger, player) {
			player.removeSkill("oltianhou_expire");
			let cards = get.cards(3, true);
			await game.cardsGotoOrdering(cards);
			if (player.countCards("h") > 0) {
				const hs = player.getCards("h");
				const result = await player
					.chooseToMove("天候：请选择你要交换的牌（靠左的为牌堆顶第一张）")
					.set("filterMove", (from, to, moved) => {
						return typeof to != "number";
					})
					.set("selectionSpec", { move: "swap" })
					.set("list", [
						["牌堆顶", cards, "牌堆顶"],
						["手牌", player.getCards("h")],
					])
					.set("processAI", list => {
						const player = get.player(),
							cards = list[0][1].concat(list[1][1]).sort(function (a, b) {
								return get.value(a) - get.value(b);
							}),
							cards2 = cards.splice(0, player.countCards("h"));
						return [cards2, cards];
					})
					.forResult();
				const { moved } = result;
				if (moved?.length) {
					const [top, hand] = moved;
					const ordering = top.filter(i => hs.includes(i));
					const gain = hand.filter(i => cards.includes(i));
					cards = top.slice();
					player.$throw(ordering.length, 1000);
					await player.lose(ordering, ui.ordering);
					game.log(player, `从牌堆顶获得了${get.cnNumber(gain.length)}张牌`);
					await player.gain(gain, "draw");
				}
			}
			await game.cardsGotoPile(cards.filterInD().reverse(), "insert");
			cards = get.cards(3, true);
			const result = await player
				.chooseButton({
					createDialog: [`天候：请选择要展示的牌`, cards],
					forced: true,
					ai(button) {
						const card = button.link;
						const suit = get.suit(card);
						if (suit === "heart") {
							return (
								1 /
								game.countPlayer(current => {
									if (player !== current && !game.hasPlayer(tar => tar.hp - current.hp > 1)) {
										return get.sgnAttitude(player, current);
									}
									return 0;
								})
							);
						}
						if (suit == "club") {
							return (
								1 /
								game.countPlayer(current => {
									if (player !== current && (current.hp < 2 || !game.hasPlayer(tar => current.hp - tar.hp > 1))) {
										return get.sgnAttitude(player, current);
									}
									return 0;
								})
							);
						}
						return 1 / get.rand(1, game.countPlayer());
					},
				})
				.forResult();
			const { links } = result;
			if (!links?.length) {
				return;
			}
			const [card] = links;
			await player.showCards(card, get.translation(player) + "发动了【天候】");
			const suit = get.suit(card, false),
				skill = "oltianhou_" + suit;
			if (!lib.skill.oltianhou.derivation.includes(skill)) {
				return;
			} else {
				event.weather_skill = skill;
				const result = await player
					.chooseTarget({
						forced: true,
						prompt: "令一名角色获得技能【" + get.translation(skill) + "】",
						prompt2: get.translation(skill + "_info"),
						ai(target) {
							return get.attitude(_status.event.player, target);
						},
					})
					.forResult();
				if (result.bool && result.targets?.length) {
					const target = result.targets[0];
					player.line(target, "green");
					player.addTempSkill("oltianhou_expire", { player: "dieAfter" });
					game.broadcastAll(function (bg) {
						_status.tempBackground = bg;
						game.updateBackground();
					}, event.weather_skill + "_bg");
					await target.addAdditionalSkills("oltianhou_" + player.playerid, event.weather_skill);
					game.addVideo("skill", player, ["oltianhou", [true, event.weather_skill + "_bg"]]);
				}
			}
		},
		video(player, info) {
			if (info[0]) {
				_status.tempBackground = info[1];
			} else {
				delete _status.tempBackground;
			}
			game.updateBackground();
		},
		derivation: ["oltianhou_spade", "oltianhou_heart", "oltianhou_club", "oltianhou_diamond"],
		subSkill: {
			expire: {
				charlotte: true,
				onremove(player) {
					var key = "oltianhou_" + player.playerid,
						players = game.players.concat(game.dead);
					for (var current of players) {
						current.removeAdditionalSkill(key);
					}
					game.removeGlobalSkill("oltianhou_" + player.playerid + "_ai");
					game.broadcastAll(function () {
						delete _status.tempBackground;
						game.updateBackground();
					});
					game.addVideo("skill", player, ["oltianhou", [false]]);
				},
			},
			spade: {
				audio: true,
				mark: true,
				marktext: "雨",
				intro: {
					content: "锁定技。其他角色造成火属性伤害时，取消之；一名角色受到雷属性伤害后，所有与其座次相邻的角色失去1点体力。",
				},
				trigger: { global: "damageEnd" },
				forced: true,
				filter(event) {
					return event.hasNature("thunder") && lib.skill.oltianhou_spade.logTarget(event).length > 0;
				},
				logTarget(event) {
					var list = [];
					if (!event.player.isIn()) {
						return [];
					}
					if (event.player.getNext().isIn()) {
						list.push(event.player.getNext());
					}
					if (event.player.getPrevious().isIn()) {
						list.add(event.player.getPrevious());
					}
					return list.sortBySeat(_status.currentPhase);
				},
				async content(event, trigger, player) {
					var targets = lib.skill.oltianhou_spade.logTarget(trigger);
					for (var i of targets) {
						await i.loseHp();
					}
					await game.delayex();
				},
				group: "oltianhou_miehuo",
				global: "oltianhou_spade_ai",
			},
			spade_ai: {
				ai: {
					effect: {
						player(card, player, target, current) {
							if (((typeof card == "object" && game.hasNature(card, "fire")) || get.tag(card, "fireDamage")) && !player.hasSkill("oltianhou_spade")) {
								return "zeroplayertarget";
							}
							if ((typeof card == "object" && game.hasNature(card, "thunder")) || get.tag(card, "thunderDamage")) {
								var list = lib.skill.oltianhou_spade.logTarget({ player: target });
								var eff = list.reduce(function (eff, current) {
									eff += get.effect(current, { name: "losehp" }, player, player) / get.attitude(player, player);
								}, 0);
								return [1, eff];
							}
						},
					},
				},
			},
			miehuo: {
				audio: "oltianhou_spade",
				trigger: { global: "damageBegin2" },
				forced: true,
				logTarget: "source",
				filter(event, player) {
					return event.hasNature("fire") && event.source && event.source.isIn() && event.source != player;
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			heart: {
				audio: true,
				mark: true,
				marktext: "暑",
				intro: {
					content: "锁定技。其他角色的结束阶段开始时，若其体力值为全场最大，则其失去1点体力。",
				},
				trigger: { global: "phaseJieshuBegin" },
				forced: true,
				filter(event, player) {
					return player != event.player && event.player.isIn() && event.player.isMaxHp();
				},
				logTarget: "player",
				async content(event, trigger, player) {
					await event.targets[0].loseHp();
				},
				global: "oltianhou_heart_ai",
			},
			heart_ai: {
				mod: {
					aiOrder(player, card, num) {
						if (
							num > 0 &&
							_status.event &&
							_status.event.type == "phase" &&
							!player.hasSkill("oltianhou_heart") &&
							get.tag(card, "recover") &&
							!player.isMaxHp() &&
							player.needsToDiscard() <= 1 &&
							!game.hasPlayer(function (current) {
								return current.hp - player.hp > 1;
							}) &&
							get.effect(player, { name: "losehp" }, player, player) < 0
						) {
							return 0;
						}
					},
				},
			},
			club: {
				audio: true,
				mark: true,
				marktext: "霜",
				intro: {
					content: "锁定技。其他角色的结束阶段开始时，若其体力值为全场最小，则其失去1点体力。",
				},
				trigger: { global: "phaseJieshuBegin" },
				forced: true,
				filter(event, player) {
					return player != event.player && event.player.isIn() && event.player.isMinHp();
				},
				logTarget: "player",
				async content(event, trigger, player) {
					await event.targets[0].loseHp();
				},
				global: "oltianhou_club_ai",
			},
			club_ai: {
				ai: {
					nokeep: true,
					skillTagFilter(player, tag, arg) {
						return _status.event && _status.event.type == "phase" && (!arg || (arg.card && get.name(arg.card) === "tao")) && !player.hasSkill("oltianhou_club") && player.isMinHp() && get.effect(player, { name: "losehp" }, player, player) < 0;
					},
				},
			},
			diamond: {
				audio: true,
				mark: true,
				marktext: "雾",
				intro: {
					content: "锁定技。其他角色使用【杀】指定与其座次不相邻唯一目标时，则其判定。若判定结果的点数大于此【杀】，则此【杀】对其无效。",
				},
				trigger: { global: "useCardToPlayer" },
				forced: true,
				filter(event, player) {
					if (event.card.name != "sha" || event.player == player || event.targets.length != 1 || !event.player.isIn()) {
						return false;
					}
					return event.target != event.player.getNext() && event.target != event.player.getPrevious();
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					const num = get.number(trigger.card);
					event.num = num;
					const result = await target
						.judge(card => {
							var num = get.number(card),
								num2 = _status.event.getParent("oltianhou_diamond").num;
							return num > num2 ? -4 : 4;
						})
						.set("judge2", result => {
							if (result.bool == false) {
								return true;
							}
							return false;
						})
						.forResult();
					if (!result.bool) {
						trigger.getParent().all_excluded = true;
						trigger.untrigger();
					}
				},
				global: "oltianhou_diamond_ai",
			},
			diamond_ai: {
				ai: {
					effect: {
						player(card, player, target) {
							if (get.name(card) == "sha" && !player.hasSkill("oltianhou_diamond") && target != player.getNext() && target != player.getPrevious()) {
								let num = get.number(card),
									max = _status.aiyh_MAXNUM || 13;
								return [num / max, 0, num / max, 0];
							}
						},
					},
				},
			},
		},
	},
	olchenshuo: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget(card, player, target) {
						return target.countCards("h") > 0;
					},
					ai(target) {
						const player = get.player();
						return 2 - (target == player ? -0.5 : get.sgnAttitude(player, target)) + Math.random();
					},
				})
				.forResult();
		},
		hasSame(info, card) {
			if (info.type == get.type2(card, false)) {
				return true;
			}
			if (info.suit != "none" && info.suit == get.suit(card, false)) {
				return true;
			}
			if (typeof info.number == "number" && info.number > 0 && info.number == get.number(card, false)) {
				return true;
			}
			return info.length == get.cardNameLength(card);
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const result = await target
				.chooseCard({
					position: "h",
					prompt: `谶说：展示一张手牌，然后${get.translation(player)}展示并获得牌堆顶的牌`,
					ai(card) {
						const att = get.attitude(get.player(), get.event().sourcex);
						if (get.type(card) == "basic") {
							if (att > 0) {
								return 1 + Math.random();
							}
							return Math.random() - 0.5;
						}
						return Math.random();
					},
					forced: true,
				})
				.set("sourcex", player)
				.forResult();
			if (!result.cards?.length) {
				return;
			}
			const {
				cards: [card],
			} = result;
			await target.showCards([card], get.translation(player) + "发动了【谶说】");
			const cardInfo = {
				type: get.type2(card, player),
				suit: get.suit(card, player),
				number: get.number(card, player),
				length: get.cardNameLength(card),
			};
			event.forceDie = true;
			event.includeOut = true;
			const cards = [];
			while (true) {
				const judgestr = get.translation(player) + "展示的第" + get.cnNumber(cards.length + 1, true) + "张【谶说】牌";
				const cardsx = get.cards();
				const result = await player
					.showCards(cardsx, judgestr, true)
					.set("clearArena", false)
					.set("log", (cards, player) => [player, "亮出了牌堆顶的", cards])
					.forResult();
				if (!result?.cards) {
					return;
				}
				cards.addArray(result.cards);
				if (cards.length >= 3 || !player.isIn() || cards.some(cardx => !lib.skill.olchenshuo.hasSame(cardInfo, cardx))) {
					game.broadcastAll(function () {
						ui.clear();
					});
					player.$gain2(cards, true);
					const owner = get.owner(card);
					if (get.position(card) == "h" && owner != player) {
						cards.push(card);
						owner?.$give(card, player);
					}
					await player.gain(cards);
					break;
				}
			}
		},
	},
};
