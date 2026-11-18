import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanjuetu" | "clankudu" | "clanyangji" | "clandandao" | "clanqingli">} */
export const groupSkills = {
	//族杨众 —— by 星の语
	clanjuetu: {
		audio: 2,
		trigger: { player: "phaseDiscardBegin" },
		forced: true,
		async content(event, trigger, player) {
			trigger.setContent(lib.skill[event.name].phaseDiscard);
		},
		phaseDiscard: [
			async (event, trigger, player) => {
				game.log(player, "进入了弃牌阶段");
				game.broadcastAll(function (player) {
					if (lib.config.show_phase_prompt) {
						player.popup("弃牌阶段", null, false);
					}
				}, player);
				event.trigger("phaseDiscard");
			},
			async (event, trigger, player) => {
				const cards = player.getCards("h"),
					suits = cards.map(card => get.suit(card, player));
				if (!cards.length) {
					event.finish();
					return;
				}
				if (lib.suits.some(suit => suits.filter(suitx => suitx == suit).length > 1)) {
					const result = await player
						.chooseCard("请保留每种花色的手牌各一张，将其余手牌置入弃牌堆", [1, Infinity], true, (card, player) => {
							const selected = ui.selected.cards;
							if (!selected?.length) {
								return true;
							}
							return !selected.some(cardx => get.suit(cardx, player) == get.suit(card, player));
						})
						.set("complexCard", true)
						.set("suits", suits)
						.set("ai", card => get.value(card))
						.forResult();
					if (!result?.cards?.length) {
						event.finish();
						return;
					}
					const discard = cards.removeArray(result.cards);
					await player.loseToDiscardpile(discard);
				}
				if (game.hasPlayer(target => target.countDiscardableCards(target, "h"))) {
					const result2 = await player
						.chooseTarget(`绝途：令一名角色弃置一张手牌`, true, (card, player, target) => {
							return target.countDiscardableCards(target, "h");
						})
						.set("ai", target => {
							return get.effect(target, { name: "guohe_copy", position: "h" }, target, get.player());
						})
						.forResult();
					if (!result2?.targets?.length) {
						event.finish();
						return;
					}
					const target = result2.targets[0];
					player.line(target);
					//修复有些角色的牌不能在弃牌阶段弃置的bug
					const next = game.createEvent("clanjuetu_discard", false);
					next.player = player;
					next.target = target;
					next.setContent(async (event, trigger, player) => {
						const result = await target.chooseToDiscard("绝途：请弃置一张手牌", true, "h").forResult();
						if (!result?.cards?.length) {
							event.finish();
							return;
						}
						const suit = get.suit(result.cards[0], target);
						if (!player.hasCard(cardx => get.suit(cardx, player) == suit, "h")) {
							await target.damage();
						}
					});
					await next;
				}
			},
		],
	},
	clankudu: {
		audio: 2,
		limited: true,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("he", card => player.canRecast(card)) > 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt2(event.skill),
					filterCard: (card, player) => player.canRecast(card),
					selectCard: 2,
					filterTarget: true,
					position: "he",
					ai1(card) {
						return 6 - get.value(card);
					},
					ai2(target) {
						return get.attitude(get.player(), target);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const cards = event.cards,
				num = Math.min(5, Math.abs(get.number(cards[0]) - get.number(cards[1]))),
				target = event.targets[0],
				skill = event.name + "_effect";
			await player.recast(cards);
			if (num > 0) {
				target.addSkill(skill);
				target.addMark(skill, num, false);
			}
		},
		subSkill: {
			effect: {
				intro: {
					content: "<li>下#个回合结束时摸一张牌<br><li>第#个回合后执行一个额外回合",
				},
				onremove: true,
				charlotte: true,
				forced: true,
				popup: false,
				trigger: { global: "phaseEnd" },
				async content(event, trigger, player) {
					player.removeMark(event.name, 1, false);
					player.draw();
					if (!player.hasMark(event.name)) {
						player.insertPhase();
						player.removeSkill(event.name);
					}
				},
			},
		},
	},
	//族荀爽 —— by 刘巴
	clanyangji: {
		audio: 2,
		trigger: {
			player: "phaseZhunbeiBegin",
			global: "phaseAnyEnd",
		},
		filter(event, player, name) {
			if (name == "phaseZhunbeiBegin") {
				return true;
			}
			return game.hasGlobalHistory("everything", evt => {
				if (["changeHp", "gainMaxHp", "loseMaxHp"].includes(evt.name)) {
					if (evt.player != player || evt.getParent(event.name) !== event) {
						return false;
					}
					if (evt.name == "changeHp") {
						return evt.changedHp !== 0;
					}
					return true;
				}
				return false;
			});
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			const next = player.chooseToUse(get.prompt2(event.name)).set("logSkill", event.name);
			const result = await next.forResult();
			if (!result?.bool) {
				return;
			}
			const target = _status.currentPhase;
			if (!player.hasHistory("sourceDamage", evt => evt.getParent(next.name) == next) && target?.canAddJudge("lebu")) {
				await player
					.chooseToUse()
					.set("openskilldialog", `佯疾：是否将一张黑桃牌当作【乐不思蜀】对${get.translation(target)}使用？`)
					.set("norestore", true)
					.set("_backupevent", `${event.name}_backup`)
					.set("custom", {
						add: {},
						replace: { window() {} },
					})
					.backup(`${event.name}_backup`)
					.set("targetRequired", true)
					.set("complexTarget", true)
					.set("complexSelect", true)
					.set("addCount", false)
					.set("targetx", target);
			}
		},
		subSkill: {
			backup: {
				filterCard(card, player) {
					if (get.itemtype(card) !== "card") {
						return;
					}
					return get.suit(card, player) == "spade";
				},
				filterTarget(card, player, target) {
					return lib.filter.judge(card, player, target) && target === get.event().targetx;
				},
				filterOk() {
					return ui.selected.targets.length === 1;
				},
				selectTarget: -1,
				viewAs: {
					name: "lebu",
				},
				selectCard: 1,
				position: "hes",
				ai1(card) {
					return 7 - get.value(card);
				},
				ai2(target) {
					if (target == get.player() && get.player().hasSkill("clandandao")) {
						return true;
					}
					return get.effect_use.apply(this, arguments);
				},
				log: false,
			},
		},
	},
	clandandao: {
		audio: 2,
		trigger: { global: "judgeAfter" },
		forced: true,
		filter(event, player) {
			return game.getAllGlobalHistory("everything", evt => evt.name == "judge" && evt.player == event.player).indexOf(event) == 0;
		},
		async content(event, trigger, player) {
			await player.gainMaxHp();
		},
		/*subSkill: {
			add: {
				charlotte: true,
				onremove: true,
				mark: true,
				markimage: "image/card/handcard.png",
				intro: {
					content: "手牌上限+#",
				},
				mod: { maxHandcard: (player, num) => num + player.countMark("clandandao_add") },
			},
		},*/
	},
	clanqingli: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		forced: true,
		filter(event, player) {
			return player.countCards("h") < Math.min(5, player.maxHp);
		},
		async content(event, trigger, player) {
			await player.drawTo(Math.min(player.maxHp, 5));
		},
	},
};
