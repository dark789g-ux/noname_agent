import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mbqingdao" | "mbxiugeng" | "mbchenshe" | "mbchizhang" | "mbduanyang">} */
export const groupSkills = {
	//国渊
	mbqingdao: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		filter(event, player) {
			return event.player != player && get.is.damageCard(event.card) && event.targets?.includes(player);
		},
		async cost(event, trigger, player) {
			const damaged = player.hasHistory("damage", evt => evt.card && evt.getParent(2) == trigger);
			let result;
			if (damaged) {
				//新函数chooseButtonTarget第一次使用，用法跟chooseCardTarget类似
				result = await player
					.chooseButtonTarget({
						createDialog: [
							`###${get.prompt(event.skill)}###<div class="text center">从牌堆或弃牌堆中获得一张【闪】，或弃置一名角色区域内的一张牌</div>`,
							[
								[
									["shan", "获得【闪】"],
									["discard", "弃置牌"],
								],
								"tdnodes",
							],
						],
						filterButton(button) {
							if (button.link == "discard") {
								return game.hasPlayer(target => target.countDiscardableCards(get.player(), "hej"));
							}
							return true;
						},
						filterTarget(card, player, target) {
							return target.countDiscardableCards(player, "hej");
						},
						selectTarget() {
							if (ui.selected.buttons.length) {
								const link = ui.selected.buttons[0].link;
								if (link == "discard") {
									return 1;
								}
								return 0;
							}
							return 0;
						},
						filterOk() {
							if (ui.selected.buttons.length) {
								const link = ui.selected.buttons[0].link;
								if (link == "discard") {
									return ui.selected.targets.length == 1;
								}
								return true;
							}
							return false;
						},
						ai1(button) {
							const player = get.player();
							if (button.link == "discard") {
								const values = game
									.filterPlayer(target => target.countDiscardableCards(player, "hej"))
									.map(target => get.effect(target, { name: "guohe_copy" }, player, player))
									.sort((a, b) => b - a);
								return values.length ? values[0] : 0;
							}
							if (button.link == "shan") {
								if (!player.countCards("h", "shan")) {
									return get.effect(player, { name: "wuzhong" }, player, player) * 2;
								}
								return get.effect(player, { name: "wuzhong" }, player, player) / 3;
							}
						},
						ai2(target) {
							if (ui.selected.buttons[0].link != "discard") {
								return 1;
							}
							return get.effect(target, { name: "guohe_copy" }, get.player(), get.player());
						},
					})
					.forResult();
			} else {
				result = await player
					.chooseButton([
						`###${get.prompt(event.skill)}###<div class="text center">从牌堆或弃牌堆中获得一张【杀】，或使用一张手牌（无距离限制）</div>`,
						[
							[
								["sha", "获得【杀】"],
								["use", "使用手牌"],
							],
							"tdnodes",
						],
					])
					.set("filterButton", button => {
						if (button.link == "use") {
							return get.player().hasCard(card => get.player().hasUseTarget(card, false, false), "hs");
						}
						return true;
					})
					.set("ai", button => {
						const player = get.player();
						if (button.link == "use") {
							const values = player
								.getCards("hs", card => player.hasUseTarget(card, false, false))
								.map(card => player.getUseValue(card))
								.sort((a, b) => b - a);
							return values.length ? values[0] * 1.5 : 0;
						}
						if (button.link == "sha") {
							if (!player.countCards("h", "sha")) {
								return get.effect(player, { name: "wuzhong" }, player, player);
							}
							return get.effect(player, { name: "wuzhong" }, player, player) / 3;
						}
					})
					.forResult();
			}
			if (result.bool) {
				event.result = {
					bool: true,
					cost_data: {
						links: result.links,
						targets: result?.targets || [],
					},
				};
			}
		},
		async content(event, trigger, player) {
			const link = event.cost_data.links[0],
				targets = event.cost_data.targets;
			if (link == "sha" || link == "shan") {
				const card = get.cardPile(card => card.name == link);
				if (card) {
					await player.gain(card, "gain2");
				} else {
					player.chat(`孩子们，一张${get.translation(link)}都没有力`);
				}
			}
			if (link == "discard" && targets.length) {
				player.line(targets);
				if (!targets[0].countDiscardableCards(player, "hej")) {
					return;
				}
				await player.discardPlayerCard(targets[0], "hej", true);
			}
			if (link == "use" && player.hasCard(card => player.hasUseTarget(card, false, false), "hs")) {
				await player.chooseToUse({
					filterCard(card) {
						if (get.itemtype(card) != "card" || !["h", "s"].includes(get.position(card))) {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					filterTarget(card, player, target) {
						return lib.filter.targetEnabled.apply(this, arguments);
					},
					prompt: "清蹈：使用一张手牌（无距离限制）",
					addCount: false,
					forced: true,
				});
			}
		},
	},
	mbxiugeng: {
		audio: 4,
		logAudio: index => (typeof index === "number" ? "mbxiugeng" + index + ".mp3" : 2),
		trigger: { player: "phaseBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, 2])
				.set("ai", target => get.attitude(get.player(), target))
				.forResult();
		},
		async content(event, trigger, player) {
			player.line(event.targets);
			for (const target of event.targets.sortBySeat()) {
				target.removeSkill("mbxiugeng_effect");
				target.setStorage("mbxiugeng_effect", target.countCards("h"));
				target.addSkill("mbxiugeng_effect");
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				forced: true,
				popup: false,
				init(player, skill) {
					const storage = player.storage[skill];
					if (storage >= 0) {
						player.addTip(skill, `${get.translation(skill)} ${storage}`);
					}
				},
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				mark: true,
				intro: {
					content: "当前记录值为：#",
				},
				trigger: { player: "phaseDrawBegin" },
				async content(event, trigger, player) {
					const record = player.storage[event.name];
					if (typeof record === "number") {
						player.logSkill("mbxiugeng", null, null, null, [player.countCards("h") >= record ? 4 : 3]);
						if (player.countCards("h") <= record) {
							await player.draw({ num: 2 });
						}
						if (player.countCards("h") >= record) {
							player.addSkill("mbxiugeng_handcard");
							player.addMark("mbxiugeng_handcard", 1, false);
						}
					}
					player.removeSkill(event.name);
				},
			},
			handcard: {
				markimage: "image/card/handcard.png",
				charlotte: true,
				onremove: true,
				intro: {
					content: "手牌上限+#",
				},
				mark: true,
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("mbxiugeng_handcard");
					},
				},
			},
		},
	},
	mbchenshe: {
		audio: 3,
		logAudio: index => (typeof index === "number" ? "mbchenshe" + index + ".mp3" : 2),
		trigger: { global: "dying" },
		filter(event, player) {
			return event.player != player && lib.skill.mbchenshe.logTarget(event, player).length;
		},
		logTarget(event, player) {
			return [player, event.player, event.source].filter(target => target?.isIn() && target?.countDiscardableCards(player, "he"));
		},
		check(event, player) {
			const targets = lib.skill.mbchenshe.logTarget(event, player);
			return (
				targets.reduce((sum, target) => {
					return sum + get.effect(target, { name: "guohe_copy2" }, player, player);
				}, 0) > 0
			);
		},
		async content(event, trigger, player) {
			const targets = lib.skill.mbchenshe.logTarget(trigger, player),
				cards = [];
			for (const target of targets) {
				let result;
				if (!target.countDiscardableCards(player, "he")) {
					continue;
				}
				if (target == player) {
					result = await target.chooseToDiscard(`陈赦：请弃置一张牌`, "he", true).forResult();
				} else {
					result = await player.discardPlayerCard(`陈赦：请弃置${get.translation(target)}一张牌`, target, "he", true).forResult();
				}
				if (result?.cards) {
					cards.addArray(result.cards);
				}
			}
			if (cards.length == 3 && cards.map(card => get.suit(card, false)).unique().length == 1) {
				player.logSkill("mbchenshe", trigger.player, null, null, [3]);
				await trigger.player.recoverTo(trigger.player.maxHp);
				await player.removeSkills(event.name);
			}
		},
	},
	//手杀黄祖
	mbchizhang: {
		mod: {
			targetInRange(card, player, target) {
				if (get.is.damageCard(card)) {
					return true;
				}
			},
		},
		locked: false,
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return (
				event.isFirstTarget &&
				get.is.damageCard(event.card) &&
				player.countDiscardableCards(player, "h") &&
				player.hasHistory("lose", evt => {
					const evtx = evt.relatedEvent || evt.getParent();
					return evtx == event.getParent() && evt.hs?.length;
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt2(event.skill), [1, Infinity], "chooseonly")
				.set("ai", card => {
					const suits = ui.selected.cards?.map(card => get.suit(card, get.player())).unique();
					if (suits?.includes(get.suit(card, get.player()))) {
						return 0;
					}
					return 6 - get.value(card);
				})
				.forResult();
		},
		logTarget(event, player) {
			return game.filterPlayer(target => target != player);
		},
		async content(event, trigger, player) {
			const cards = event.cards,
				colors = cards.map(card => get.color(card)).unique(),
				targets = game.filterPlayer(target => target != player);
			await player.discard(cards);
			targets.forEach(target => target.addTempSkill(event.name + "_global"));
			trigger.card.storage ??= {};
			trigger.card.storage.mbchizhang = [targets, colors];
		},
		subSkill: {
			global: {
				charlotte: true,
				mod: {
					cardEnabled(card, player) {
						let evt = get.event();
						if (evt.name != "chooseToUse") {
							evt = evt.getParent("chooseToUse");
						}
						if (!evt?.respondTo || !evt.respondTo[1]?.storage?.mbchizhang) {
							return;
						}
						const color = get.color(card, player),
							colors = evt.respondTo[1].storage.mbchizhang[1],
							targets = evt.respondTo[1].storage.mbchizhang[0];
						if (color === "unsure" || !targets.includes(player)) {
							return;
						}
						if (colors.includes(color)) {
							return false;
						}
					},
					cardRespondable(card, player) {
						let evt = get.event();
						if (evt.name != "chooseToRespond") {
							evt = evt.getParent("chooseToRespond");
						}
						if (!evt?.respondTo || !evt.respondTo[1]?.storage?.mbchizhang) {
							return;
						}
						const color = get.color(card, player),
							colors = evt.respondTo[1].storage.mbchizhang[1],
							targets = evt.respondTo[1].storage.mbchizhang[0];
						if (color === "unsure" || !targets.includes(player)) {
							return;
						}
						if (colors.includes(color)) {
							return false;
						}
					},
				},
			},
		},
	},
	mbduanyang: {
		audio: 3,
		logAudio: index => (typeof index === "number" ? "mbduanyang" + index + ".mp3" : 2),
		trigger: {
			player: "loseAfter",
			global: ["loseAsyncAfter", "equipAfter", "addJudgeAfter", "gainAfter", "addToExpansionAfter"],
		},
		usable: 1,
		filter(event, player) {
			if (event.getParent().name == "useCard") {
				return false;
			}
			return event.getl(player)?.hs?.some(card => get.name(card, false) == "sha" && !get.owner(card));
		},
		async content(event, trigger, player) {
			const card = trigger
				.getl(player)
				.hs.filter(card => get.name(card, false) == "sha" && !get.owner(card))
				.randomGet();
			await player.addToExpansion(card, "gain2").set("gaintag", ["mbduanyang"]);
		},
		intro: {
			markcount: "expansion",
			content: "expansion",
		},
		group: ["mbduanyang_damage", "mbduanyang_use"],
		subSkill: {
			use: {
				audio: ["mbduanyang1.mp3", "mbduanyang2.mp3"],
				charlotte: true,
				trigger: {
					global: "phaseAnyEnd",
				},
				filter(event, player) {
					return player.getExpansions("mbduanyang").length;
				},
				forced: true,
				async content(event, trigger, player) {
					for (const card of player.getExpansions("mbduanyang")) {
						if (!player.hasUseTarget(card, true, false)) {
							continue;
						}
						player.$gain2(card);
						const sha = get.autoViewAs(card, [card]);
						//sha.storage ??= {};
						sha.storage.mbduanyang = true;
						await player.chooseUseTarget(sha, [card], true, false);
					}
					await player.loseToDiscardpile(player.getExpansions("mbduanyang"));
				},
			},
			damage: {
				popup: false,
				trigger: { source: "damageSource" },
				filter(event, player) {
					const target = event.player;
					return event.card?.storage?.mbduanyang && event.card?.name == "sha" && target.isIn() && target.countCards("hej", card => target.canRecast(card));
				},
				async cost(event, trigger, player) {
					const target = trigger.player;
					event.result = await player.choosePlayerCard(get.prompt2(event.skill, target), target, "hej", [1, 2], card => target.canRecast(card)).forResult();
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const cards = event.cards,
						target = trigger.player;
					player.logSkill("mbduanyang", target, null, null, [3]);
					await target.recast(cards);
					await player.draw(4);
				},
			},
		},
	},
};
