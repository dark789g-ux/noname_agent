import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdqiuyuan" | "stdzhuikong" | "stdwuyou" | "stdcanshi" | "stdxiongyi" | "stdyouji" | "stdfengpo" | "stddaoshu" | "stddaizui">} */
export const groupSkills = {
	//伏皇后
	stdqiuyuan: {
		audio: "xinqiuyuan",
		inherit: "qiuyuan",
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const { card } = trigger;
			const result = await target
				.chooseToGive(`交给${get.translation(player)}一张牌，或成为${get.translation(card)}的额外目标`, player)
				.set("ai", card => {
					const { player, target } = get.event();
					return get.attitude(player, target) >= 0 ? 1 : -1;
				})
				.forResult();
			if (!result?.bool) {
				trigger.getParent().targets.push(target);
				trigger.getParent().triggeredTargets2.push(target);
				game.log(target, "成为了", card, "的额外目标");
			}
		},
	},
	stdzhuikong: {
		audio: "rezhuikong",
		trigger: { global: "phaseZhunbeiBegin" },
		check(event, player) {
			if (get.attitude(player, event.player) < -2) {
				var cards = player.getCards("h");
				if (cards.length > player.hp) {
					return true;
				}
				for (var i = 0; i < cards.length; i++) {
					var useful = get.useful(cards[i]);
					if (useful < 5) {
						return true;
					}
					if (get.number(cards[i]) > 9 && useful < 7) {
						return true;
					}
				}
			}
			return false;
		},
		filter(event, player) {
			if (player == event.player) {
				return false;
			}
			if (!player.canCompare(event.player)) {
				return false;
			}
			return (_status.connectMode && player.hasCards("h")) || player.hasCards("h", card => get.name(card) == "sha");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt(event.skill, trigger.player), "使用一张【杀】与其拼点", card => {
					return get.name(card) == "sha";
				})
				.set("ai", card => {
					if (_status.event.effect) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("effect", lib.skill.stdzhuikong.check(trigger, player))
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const next = player.chooseToCompare(target);
			if (!next.fixedResult) {
				next.fixedResult = {};
			}
			next.fixedResult[player.playerid] = event.cards[0];
			const result = await next.forResult();
			if (result?.winner) {
				const card = result[result.winner == player ? "target" : "player"];
				if (!card || !result.winner.hasUseTarget(card)) {
					return;
				}
				await result.winner.chooseUseTarget(card);
			}
		},
	},
	//关兴
	stdwuyou: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => player.canCompare(current));
		},
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await player.chooseToCompare(target).forResult();
			if (!result.bool) {
				player.addTempSkill(event.name + "_effect");
				await player.addAdditionalSkills(event.name + "_effect", "new_rewusheng");
			}
			const winner = result.winner;
			if (!winner) {
				return;
			}
			const loser = player == winner ? target : player;
			const juedou = get.autoViewAs({ name: "juedou", isCard: true });
			if (winner.canUse(juedou, loser, false)) {
				await winner.useCard(juedou, loser, false);
			}
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					return get.effect(target, { name: "juedou" }, player, player) * get.attitude(player, target);
				},
			},
		},
		derivation: "new_rewusheng",
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				marktext: "佑",
				intro: {
					content: "视为拥有〖武圣〗",
				},
			},
		},
	},
	//四象封印·少阴
	//孙皓
	stdcanshi: {
		audio: "canshi",
		inherit: "canshi",
		forced: true,
		async content(event, trigger, player) {
			trigger.changeToZero();
			await player.draw(
				Math.max(
					1,
					game.countPlayer(target => {
						if (player.hasSkill("guiming") && target != player && target.group == "wu") {
							return true;
						}
						return target.isDamaged();
					})
				)
			);
			player.addTempSkill("stdcanshi_effect");
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: { player: "useCardToPlayered" },
				filter(event, player) {
					if (event.card.name != "sha" && get.type(event.card) != "trick") {
						return false;
					}
					return event.target.isDamaged() && player.countCards("he");
				},
				forced: true,
				autodelay: true,
				async content(event, trigger, player) {
					await player.chooseToDiscard({
						forced: true,
						position: "he",
					});
				},
			},
		},
	},
	//马腾
	stdxiongyi: {
		limited: true,
		audio: "xiongyi",
		enable: "phaseUse",
		filterTarget: true,
		selectTarget: [1, Infinity],
		multitarget: true,
		multiline: true,
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const targets = event.targets.sortBySeat();
			let keep = true;
			while (true) {
				let stop = false;
				for (const target of targets) {
					let next = target
						.chooseToUse(function (card) {
							const event = get.event();
							if (!lib.filter.cardEnabled(card, event.player, event)) {
								return false;
							}
							return get.name(card) == "sha";
						}, "雄异：是否使用一张不可被响应的【杀】？")
						.set("oncard", card => {
							_status.event.directHit.addArray(game.players);
						});
					if (!keep) {
						next.set("prompt2", "若你不使用，则结束此流程");
					}
					const result = await next.forResult();
					if (!result.bool && !keep) {
						stop = true;
						break;
					}
				}
				if (keep) {
					keep = false;
				}
				if (stop) {
					break;
				}
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					if (player.hasUnknown()) {
						return 0;
					}
					return target.countCards("hs");
				},
			},
		},
	},
	stdyouji: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.canMoveCard(
				null,
				true,
				game.filterPlayer(i => {
					return i.group == "qun";
				}),
				card => {
					return [3, 4, 6].includes(parseInt(get.subtype(card)?.slice("equip".length)));
				},
				"nojudge"
			);
		},
		direct: true,
		clearTime: true,
		zhuSkill: true,
		async content(event, trigger, player) {
			await player
				.moveCard({
					prompt: get.prompt2("stdyouji"),
					sourceTargets: game.filterPlayer(i => {
						return i.group == "qun";
					}),
					filter(card) {
						return [3, 4, 6].includes(parseInt(get.subtype(card)?.slice("equip".length) ?? "0"));
					},
				})
				.set("nojudge", true)
				.set("logSkill", "stdyouji");
		},
	},
	//马云禄
	stdfengpo: {
		audio: "fengpo",
		trigger: { source: "damageBegin1" },
		filter(event, player) {
			return (
				event.card?.name == "sha" &&
				[player, event.player].some(target => {
					return target.isIn() && target.countCards("he");
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					const event = get.event().getTrigger();
					return [player, event.player]
						.filter(targetx => {
							return targetx.isIn() && targetx.countCards("he");
						})
						.includes(target);
				})
				.set("ai", target => {
					const player = get.event().player,
						aim = get.event().getTrigger().player;
					let eff = get.damageEffect(aim, player, player);
					if (aim === player && player.getDiscardableCards(player, "he", card => get.suit(card) == "diamond")) {
						eff /= 4;
					}
					return eff + get.effect(target, { name: "guohe" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await player
				.discardPlayerCard(target, "he", true)
				.set("ai", button => {
					const suit = get.suit(button.link);
					return get.event().att * (suit == "diamond" ? 5 : 1) * get.value(button.link, player);
				})
				.set("prompt", "凤魄：弃置" + (target != player ? get.translation(target) : "") + "一张牌")
				.set("prompt2", "若弃置了方片牌，则此伤害+1")
				.set("att", get.sgnAttitude(player, target))
				.forResult();
			if (result.bool) {
				if (result.cards && result.cards.some(i => get.suit(i, target) == "diamond")) {
					player.popup("洗具");
					trigger.num++;
				}
			}
		},
	},
	//蒋干
	stddaoshu: {
		audio: "daoshu",
		trigger: { global: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(target => {
				return target != event.player && target.countCards("h");
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					const event = get.event().getTrigger();
					return target != event.player && target.countCards("h");
				})
				.set("ai", target => {
					const player = get.event().player;
					if (get.attitude(player, target) >= 0) {
						return 0;
					}
					return 1 / target.countCards("h");
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.tempBanSkill("stddaoshu", "roundStart", false);
			const target = event.targets[0];
			const result = await player.choosePlayerCard(target, "h", true).forResult();
			if (result.bool) {
				const cards = result.cards || [];
				if (cards.length) {
					await player.showCards(cards, get.translation(player) + "发动了【盗书】");
					await trigger.player.gain(cards, target, "give");
					const suits = cards.reduce((list, card) => {
						return list.add(get.suit(card, target));
					}, []);
					if (suits.length) {
						for (const i of [player, trigger.player]) {
							i.addTempSkill("stddaoshu_effect");
							i.markAuto("stddaoshu_effect", suits);
						}
					}
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					cardEnabled(card, player) {
						if (player.getStorage("stddaoshu_effect").includes(get.suit(card))) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (player.getStorage("stddaoshu_effect").includes(get.suit(card))) {
							return false;
						}
					},
				},
				intro: { content: "不能使用$花色的牌" },
			},
		},
	},
	stddaizui: {
		audio: "spdaizui",
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return player.isTempBanned("stddaoshu");
		},
		forced: true,
		async content(event, trigger, player) {
			delete player.storage.temp_ban_stddaoshu;
			player.popup("盗书");
			game.log(player, "重置了技能", "#g【盗书】");
		},
		ai: {
			combo: "stddaoshu",
		},
	},
};
