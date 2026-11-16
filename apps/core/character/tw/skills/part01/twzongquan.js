import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twzongquan" | "twguimou" | "twqiji" | "twpiankuang">} */
export const groupSkills = {
	//幻司马懿
	twzongquan: {
		audio: 2,
		trigger: {
			player: ["phaseZhunbeiBegin", "phaseJieshuBegin"],
		},
		async cost(event, trigger, player) {
			const history = player.getAllHistory("useSkill", evt => evt.skill == "twzongquan"),
				judgeEvent = game.getAllGlobalHistory(
					"everything",
					evt => evt.name == "judge" && evt.player == player && evt.getParent().name == "twzongquan"
				);
			event.result = await player
				.chooseTarget(
					get.prompt(event.skill),
					`选择一名角色，然后你进行判定，并令其执行相应效果` +
						(history.length > 0 ? `（上次选择的目标：${get.translation(history.at(-1).targets[0])}` : ``) +
						(judgeEvent.length > 0 ? `；上次判定的结果：${get.translation(judgeEvent.at(-1).result.color)}）` : ``)
				)
				.set("ai", target => {
					const player = get.player(),
						att = get.attitude(player, target);
					if (player.getAllHistory("useSkill", evt => evt.skill == "twzongquan").length) {
						const history = game.getAllGlobalHistory("everything", evt => {
							if (evt.name != "judge") {
								return false;
							}
							const evtx = evt.getParent();
							return evtx.name == "twguimou" && evtx.player == player && evtx != trigger.getParent();
						});
						const evt = history[history.length - 1];
						if (evt && evt.getParent().targets[0] == target) {
							const color = evt.color;
							if (color == "black" && att > 0) {
								return 1919810;
							}
							if (color == "red" && att < 0) {
								return 114514;
							}
						}
					}
					return Math.abs(att);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const next = player.judge(card => {
				return get.color(card) == "black" ? -2 : 2;
			});
			next.judge2 = result => result.bool;
			const result = await next.forResult();
			const history = player.getAllHistory("useSkill", evt => evt.skill == "twzongquan"),
				judgeEvent = game.getAllGlobalHistory(
					"everything",
					evt => evt.name == "judge" && evt.player == player && evt.getParent().name == "twzongquan"
				);
			let num;
			if (
				history.length > 1 &&
				judgeEvent.length > 1 &&
				target == history.at(-2).targets[0] &&
				result.color != judgeEvent.at(-2).result.color
			) {
				num = 3;
			} else {
				num = 1;
			}
			if (result.color == "red") {
				await target.draw(num);
			} else if (result.color == "black" && target.countCards("he")) {
				await target.chooseToDiscard("he", num, true);
			}
			const card = result.card;
			if (get.position(card) != "d") {
				return;
			}
			const { targets } = await player
				.chooseTarget(`令一名角色获得${get.translation(card)}`)
				.set("ai", target => {
					const player = get.player();
					let att = get.attitude(player, target);
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					return att;
				})
				.forResult();
			if (!targets || !targets.length) {
				return;
			}
			await targets[0].gain(card, "gain2");
		},
	},
	twguimou: {
		audio: 2,
		trigger: {
			global: "judge",
		},
		usable: 2,
		popup: false,
		async content(event, trigger, player) {
			const cards = get.bottomCards(4, true);
			const { links } = await player
				.chooseButton(
					[
						get.translation(trigger.player) +
							"的" +
							(trigger.judgestr || "") +
							"判定为" +
							get.translation(trigger.player.judging[0]) +
							"，" +
							get.prompt("twguimou"),
						cards,
					],
					true
				)
				.set("filterButton", button => {
					const player = get.player(),
						card = button.link;
					const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (mod2 != "unchanged") {
						return mod2;
					}
					const mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
					if (mod != "unchanged") {
						return mod;
					}
					return true;
				})
				.set("ai", button => {
					const card = button.link,
						trigger = get.event().getTrigger();
					const player = get.player(),
						judging = get.event().judging;
					const result = trigger.judge(card) - trigger.judge(judging) + 0.00001;
					const attitude = get.attitude(player, trigger.player);
					const name = trigger.getParent().name;
					if (name == "twzongquan") {
						const target = trigger.getParent().targets[0];
						const history = game.getAllGlobalHistory("everything", evt => {
							if (evt.name != "judge") {
								return false;
							}
							const evtx = evt.getParent();
							return evtx.name == "twzongquan" && evtx.player == player && evtx != trigger.getParent();
						});
						const evt = history[history.length - 1];
						if (evt && evt.getParent().targets[0] == target) {
							if (get.color(card) != evt.color) {
								return 114514 * result * attitude;
							}
						}
					}
					return result * attitude;
				})
				.set("judging", trigger.player.judging[0])
				.forResult();
			if (!links || !links.length) {
				return;
			}
			cards.removeArray(links);
			await player.respond(links, "twguimou", "highlight", "noOrdering");
			if (trigger.player.judging[0].clone) {
				trigger.player.judging[0].clone.classList.remove("thrownhighlight");
				game.broadcast(function (card) {
					if (card.clone) {
						card.clone.classList.remove("thrownhighlight");
					}
				}, trigger.player.judging[0]);
				game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
			}
			await game.cardsDiscard(trigger.player.judging[0]);
			trigger.player.judging[0] = links[0];
			trigger.orderingCards.addArray(links);
			game.log(trigger.player, "的判定牌改为", links[0]);
			await game.delay(2);
			const next = player.chooseToMove("鬼谋：将卡牌以任意顺序置于牌堆顶");
			next.set("list", [["牌堆顶", cards]]);
			next.set("processAI", function (list) {
				const player = get.player(),
					target = get.event().getTrigger().name == "phaseZhunbei" ? player : player.next;
				const att = get.sgn(get.attitude(player, target));
				const check = function (card) {
					const judge = player.getCards("j")[cards.length];
					if (judge) {
						return get.judge(judge)(card) * att;
					}
					return player.getUseValue(card) * att;
				};
				const cards = list[0][1].slice(0);
				cards.sort(function (a, b) {
					return check(b) * att - check(a) * att;
				});
				return [cards];
			});
			next.set("namex", event.triggername);
			const { moved } = await next.forResult();
			const top = moved[0].reverse();
			await game.cardsGotoPile(top, ["top_cards", top], (event, card) => {
				if (event.top_cards.includes(card)) {
					return ui.cardPile.firstChild;
				}
				return null;
			});
		},
	},
	//幻魏延
	twqiji: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countCards("h") && game.hasPlayer(current => player.canUse({ name: "sha", isCard: true }, current, false));
		},
		async cost(event, trigger, player) {
			const num = player
				.getCards("h")
				.map(card => get.type2(card))
				.toUniqued().length;
			event.result = await player
				.chooseTarget(
					get.prompt(event.skill),
					`选择一名角色其他角色视为对其使用${get.cnNumber(num)}张无距离限制且不计入次数的【杀】`,
					(card, player, target) => {
						return player.canUse({ name: "sha", isCard: true }, target, false);
					}
				)
				.set("ai", target => {
					const player = get.player();
					const eff = get.effect(target, { name: "sha", isCard: true }, player, player);
					if (target.hasSkill("bagua_skill") || target.hasSkill("rw_bagua_skill") || target.hasSkill("bazhen")) {
						return 0;
					}
					return eff;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0],
				sha = get.autoViewAs({ name: "sha", isCard: true, storage: { twqiji: true } });
			let num = player
				.getCards("h")
				.map(card => get.type2(card))
				.toUniqued().length;
			target.addTempSkill("twqiji_buff", "phaseUseAfter");
			while (target.isIn() && num--) {
				await player.useCard(sha, target, false);
			}
		},
		subSkill: {
			buff: {
				charlotte: true,
				trigger: { global: "useCardToPlayer" },
				filter(event, player) {
					if (!event.card.storage?.twqiji || !event.targets.includes(player)) {
						return false;
					}
					return (
						event.isFirstTarget &&
						game.hasPlayer(
							current =>
								current != player &&
								!player.getStorage("twqiji_used").includes(current) &&
								lib.filter.targetEnabled2(event.card, event.player, current)
						)
					);
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget("令一名本回合未以此法选择的角色摸一张牌，然后其可以将此杀转移给自己", (card, player, target) => {
							const event = get.event().getTrigger();
							return (
								target != player &&
								!player.getStorage("twqiji_used").includes(target) &&
								lib.filter.targetEnabled2(event.card, event.player, target)
							);
						})
						.set("ai", target => {
							const player = get.player(),
								trigger = get.event().getTrigger();
							if (get.attitude(player, target) <= 0 || get.effect(player, trigger.card, trigger.player, player) > 0) {
								return 0;
							}
							if (target.countCards("h", "shan") || target.getEquip(2) || target.hp > player.hp + 1) {
								return 10;
							}
							return get.effect(target, { name: "draw" }, player, player);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					player.addTempSkill("twqiji_used");
					player.markAuto("twqiji_used", target);
					await target.draw();
					const result = await target
						.chooseBool(`是否将${get.translation(trigger.card)}转移给自己`)
						.set("choice", () => {
							let save = false;
							if (target.countCards("h", "shan") || target.getEquip(2) || player.hp == 1 || target.hp > player.hp + 1) {
								if (!player.countCards("h", "shan") || target.countCards("h") < player.countCards("h")) {
									save = true;
								}
							}
							return save;
						})
						.forResult();
					if (!result?.bool) {
						return;
					}
					const evt = trigger.getParent();
					evt.triggeredTargets1.remove(player);
					evt.targets.remove(player);
					evt.targets.push(target);
				},
			},
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "已选择过$" },
			},
		},
	},
	twpiankuang: {
		audio: 2,
		trigger: {
			player: "useCardAfter",
			source: "damageBegin1",
		},
		filter(event, player) {
			if (event.name == "useCard") {
				return (
					event.card.name == "sha" && player == _status.currentPhase && !player.hasHistory("sourceDamage", evt => evt.card == event.card)
				);
			}
			return event.card?.name == "sha" && event.getParent().type == "card" && player.hasHistory("sourceDamage", evt => evt.card?.name == "sha");
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.name == "useCard") {
				player.addTempSkill(event.name + "_effect");
				player.addMark(event.name + "_effect", 1, false);
			} else {
				trigger.num++;
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/handcard.png",
				intro: { content: "手牌上限-#" },
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("twpiankuang_effect");
					},
				},
			},
		},
	},
};
