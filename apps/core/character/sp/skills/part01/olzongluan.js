import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olzongluan" | "olzhaohuo" | "olwenren" | "olsiqi" | "olqiaozhi">} */
export const groupSkills = {
	//OL陶谦
	olzongluan: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(t => t.hasUseTarget(new lib.element.VCard({ name: "sha", storage: { olzongluan: true }, isCard: true })));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.hasUseTarget(new lib.element.VCard({ name: "sha", storage: { olzongluan: true }, isCard: true }));
				})
				.set("ai", target => {
					const player = get.player(),
						card = new lib.element.VCard({ name: "sha", storage: { olzongluan: true }, isCard: true });
					let targets = game.filterPlayer(current => {
						if (!target.canUse(card, current)) {
							return false;
						}
						return get.effect(current, card, target, player) > 0;
					});
					if (!targets.length) {
						return 0;
					}
					if (targets.some(current => get.effect(current, card, target, target) > 0)) {
						targets = targets.filter(current => get.effect(current, card, target, target) > 0);
					} else {
						targets = [targets.sort((a, b) => get.effect(b, card, target, target) - get.effect(a, card, target, target))[0]];
					}
					return targets.reduce((sum, current) => sum + get.effect(current, card, target, player), 0);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const next = target.chooseUseTarget(new lib.element.VCard({ name: "sha", storage: { olzongluan: true }, isCard: true }), true, false).set("selectTarget", [1, Infinity]);
			await next;
			const num = game.countPlayer2(current => current.hasHistory("damage", evt => evt.getParent(3) == next), true);
			if (num > 0) {
				await player.chooseToDiscard(num, true, "he", "allowChooseAll");
			}
		},
		init(player, skill) {
			game.addGlobalSkill(`${skill}_effect`);
		},
		subSkill: {
			effect: {
				mod: {
					playerEnabled(card, player, target) {
						if (card.storage?.olzongluan && !player.inRange(target)) {
							return false;
						}
					},
				},
			},
		},
	},
	olzhaohuo: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			if (event.player == player || player != _status.currentPhase || !event.player.isIn()) {
				return false;
			}
			return event.player.getHistory("damage").indexOf(event) === 0 && event.player.countCards("h");
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			player.addTempSkill("olzhaohuo_tag");
			const next = trigger.player.chooseToGive(player, true, "h");
			next.gaintag.add("olzhaohuo_tag");
			await next;
		},
		subSkill: {
			tag: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				mod: {
					cardEnabled2(card) {
						if ([card].concat(card.cards || []).some(c => get.itemtype(c) === "card" && c.hasGaintag("olzhaohuo_tag"))) {
							return false;
						}
					},
					ignoredHandcard(card) {
						if (card.hasGaintag("olzhaohuo_tag")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name === "phaseDiscard" && card.hasGaintag("olzhaohuo_tag")) {
							return false;
						}
					},
				},
			},
		},
	},
	olwenren: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		selectTarget: [1, Infinity],
		async content(event, trigger, player) {
			const { target } = event;
			const num = !target.countCards("h") + (target.countCards("h") <= player.countCards("h"));
			if (num) {
				await target.draw(num);
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					return !target.countCards("h") || target.countCards("h") <= player.countCards("h") ? 1 : 0;
				},
			},
		},
	},
	//OL薛灵芸
	olsiqi: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			const cardPile = Array.from(ui.cardPile.childNodes).reverse();
			return cardPile[0] && get.color(cardPile[0]) === "red";
		},
		frequent: true,
		/*
		async cost(event, trigger, player) {
			const cardPile = Array.from(ui.cardPile.childNodes).reverse();
			const redCards = [];
			for (const card of cardPile) {
				if (get.color(card) == "red") {
					redCards.push(card);
					if (redCards.length >= 3) break;
				} else break;
			}
			const result = await player
				.chooseNumbers(get.prompt2("olsiqi"), [{ prompt: "请选择你要亮出的牌数", min: 1, max: redCards.length }])
				.set("processAI", () => {
					return [get.event().maxNum];
				})
				.set("maxNum", redCards.length)
				.forResult();
			if (result.bool) {
				const number = result.numbers[0];
				event.result = {
					bool: result.bool,
					cost_data: number,
				};
			}
		},
		*/
		async content(event, trigger, player) {
			let cards = [];
			const cardPile = Array.from(ui.cardPile.childNodes).reverse();
			for (const card of cardPile) {
				if (get.color(card) == "red") {
					cards.push(card);
					if (cards.length >= 3 /*event.cost_data*/) {
						break;
					}
				} else {
					break;
				}
			}
			if (!cards.length) {
				return;
			}
			const next = game.cardsGotoOrdering(cards);
			await next;
			cards = next.cards.slice();
			if (!cards.length) {
				return;
			}
			await player.showCards(cards, get.translation(player) + "发动了【思泣】");
			while (cards.length) {
				if (
					cards.every(card => {
						if (!lib.filter.cardEnabled(card, player)) {
							return true;
						}
						const name = ["tao", "wuzhong"];
						if (name.includes(card.name) || get.type(card) == "equip") {
							return !game.hasPlayer(target => lib.filter.targetEnabled2(card, player, target));
						}
						return true;
					})
				) {
					break;
				}
				const result2 = await player
					.chooseCardButton({
						cards,
						prompt: "思泣：请选择要使用的牌",
						filter(button) {
							const card = button.link;
							if (!lib.filter.cardEnabled(card, player)) {
								return false;
							}
							if (["tao", "wuzhong"].includes(card.name) || get.type(card) == "equip") {
								return game.hasPlayer(target => lib.filter.targetEnabled2(card, get.player(), target));
							}
							return false;
						},
						ai(button) {
							return get.player().getUseValue(button.link);
						},
					})
					.forResult();
				if (result2.bool) {
					const card = result2.links[0];
					game.broadcastAll(card => {
						lib.skill.olsiqi_backup.viewAs = card;
						lib.skill.olsiqi_backup.card = card;
					}, card);
					player.addTempSkill("olsiqi_target");
					const next = player.chooseToUse();
					next.set("openskilldialog", `思泣：请选择${get.translation(card)}的目标`);
					next.set("forced", true);
					next.set("norestore", true);
					next.set("_backupevent", "olsiqi_backup");
					next.set("custom", {
						add: {},
						replace: { window() {} },
					});
					next.backup("olsiqi_backup");
					next.set("addCount", false);
					player
						.when("chooseToUseBegin")
						.filter(evt => evt === next)
						.step(async (event, trigger, player) => (trigger.filterCard = () => false));
					const result3 = await next.forResult();
					player.removeSkill("olsiqi_target");
					if (result3.bool) {
						cards.remove(card);
						continue;
					}
				}
				break;
			}
			if (cards.length) {
				await player.draw({
					num: cards.filter(card => {
						if (!lib.filter.cardEnabled(card, player)) {
							return true;
						}
						const name = ["tao", "wuzhong"];
						if (name.includes(card.name) || get.type(card) == "equip") {
							return !game.hasPlayer(target => lib.filter.targetEnabled2(card, player, target));
						}
						return true;
					}).length,
				});
			}
		},
		group: "olsiqi_lose",
		subSkill: {
			backup: {
				filterCard: () => false,
				selectCard: -1,
				filterTarget: lib.filter.targetEnabled2,
				log: false,
				async precontent(event, trigger, player) {
					const { card } = get.info("olsiqi_backup");
					event.result.cards = [card];
					event.result.card = get.autoViewAs(card, [card]);
				},
			},
			lose: {
				audio: "olsiqi",
				trigger: {
					player: "loseAfter",
					global: ["loseAsyncAfter", "cardsDiscardAfter", "equipAfter", "addJudgeAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					return event.getd(player, "cards2").some(i => get.color(i, player) === "red");
				},
				forced: true,
				locked: true,
				async content(event, trigger, player) {
					const list = trigger.getd(player).filter(i => get.color(i, player) === "red");
					await game.cardsGotoPile(list);
					game.log(player, "将", list, "置入了牌堆底");
				},
			},
			target: {
				mod: {
					selectTarget(card, player, range) {
						if (_status._olsiqi_check) {
							return;
						}
						const event = get.event();
						if (!event || event.name !== "chooseToUse" || event.getParent().name !== "olsiqi") {
							return;
						}
						_status._olsiqi_check = true;
						const bool = game.countPlayer(target => lib.filter.targetEnabled2(card, player, target)) > 1;
						delete _status._olsiqi_check;
						if (bool) {
							if (range[0] !== 1) {
								range[0] = 1;
							}
							if (range[1] !== 1) {
								range[1] = 1;
							}
						}
					},
					cardEnabled2(card, player) {
						if (_status._olsiqi_check) {
							return;
						}
						const event = get.event();
						if (!event || event.name !== "chooseToUse" || event.getParent().name !== "olsiqi") {
							return;
						}
						_status._olsiqi_check = true;
						const bool = game.hasPlayer(target => lib.filter.targetEnabled2(card, player, target));
						delete _status._olsiqi_check;
						if (bool) {
							return true;
						}
					},
					cardEnabled(card, player) {
						if (_status._olsiqi_check) {
							return;
						}
						const event = get.event();
						if (!event || event.name !== "chooseToUse" || event.getParent().name !== "olsiqi") {
							return;
						}
						_status._olsiqi_check = true;
						const bool = game.hasPlayer(target => lib.filter.targetEnabled2(card, player, target));
						delete _status._olsiqi_check;
						if (bool) {
							return true;
						}
					},
					playerEnabled(card, player, target) {
						if (_status._olsiqi_check) {
							return;
						}
						const event = get.event();
						if (!event || event.name !== "chooseToUse" || event.getParent().name !== "olsiqi") {
							return;
						}
						_status._olsiqi_check = true;
						const bool = lib.filter.targetEnabled2(card, player, target);
						delete _status._olsiqi_check;
						if (bool) {
							return true;
						}
					},
				},
				charlotte: false,
			},
		},
	},
	olqiaozhi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (!player.hasCard(card => lib.filter.cardDiscardable(card, player), "he")) {
				return false;
			}
			return !player.hasCard(card => card.hasGaintag("olqiaozhi"), "h");
		},
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		check(card) {
			const player = get.player();
			return 7 - get.value(card) + (player.hasSkill("olshqi") && get.color(card) === "red" ? 3 : 0);
		},
		async content(event, trigger, player) {
			const next = game.cardsGotoOrdering(get.cards(2));
			await next;
			const cards = next.cards;
			const videoId = lib.status.videoId++;
			game.broadcastAll(
				(player, id, cards) => {
					const dialog = ui.create.dialog(get.translation(player) + "发动了【巧织】", cards);
					dialog.videoId = id;
				},
				player,
				videoId,
				cards
			);
			const time = get.utc();
			game.addVideo("showCards", player, [get.translation(player) + "发动了【巧织】", get.cardsInfo(cards)]);
			await game.delay(2.5);
			game.broadcastAll(
				(player, id) => {
					const dialog = get.idDialog(id);
					if (player === game.me && !_status.auto) {
						dialog.content.childNodes[0].textContent = "巧织：选择获得其中一张牌";
					}
				},
				player,
				videoId
			);
			const { links } = await player
				.chooseButton([1, 1], true)
				.set("ai", button => {
					return Math.max(get.value(button.link), get.useful(button.link));
				})
				.set("dialog", videoId)
				.forResult();
			const time2 = 1000 - (get.utc() - time);
			if (time2 > 0) {
				await game.delay(0, time2);
			}
			game.broadcastAll("closeDialog", videoId);
			if (!links?.length) {
				return;
			}
			const next2 = player.gain(links, "gain2");
			next2.gaintag.add("olqiaozhi");
			await next2;
		},
		ai: {
			order: 1,
			result: { player: 1 },
		},
	},
};
