import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdkoujing" | "stdcuorui" | "stdzhijie" | "stdshushenx" | "stdanran" | "stdgaobian" | "stdyuqi" | "stdshanshen" | "stdfushi" | "stdanda" | "stdzhuguo">} */
export const groupSkills = {
	//四象封印玄武
	//柯比能
	stdkoujing: {
		audio: "kousheng",
		enable: "phaseUse",
		usable: 1,
		group: ["stdkoujing_effect"],
		selectCard: [1, Infinity],
		position: "hs",
		filterCard: true,
		check(card) {
			return 6 - get.value(card);
		},
		viewAsFilter(player) {
			return player.countCards("hs") > 0;
		},
		viewAs(cards, player) {
			if (cards.length) {
				return {
					name: "sha",
					storage: {
						stdkoujing: player,
					}
				}
			}
			return null;
		},
		mod: {
			cardUsable(card, player) {
				if (card.storage?.stdkoujing) {
					return Infinity;
				}
			},
			targetInRange(card, player) {
				if (card.storage?.stdkoujing) {
					return true;
				}
			}
		},
		ai: {
			order: 3,
			result: {
				player: 1,
			}
		},
		subSkill: {
			effect: {
				audio: "kousheng",
				trigger: {
					global: ["damageEnd"],
				},
				filter(event, player) {
					return event.card?.storage?.stdkoujing == player;
				},
				async cost(event, trigger, player) {
					const target = trigger.player;
					event.result = await target
						.chooseBool({
							prompt: `寇旌：是否与${get.translation(target)}交换手牌`,
							choice: target.countCards("h") < player.countCards("h") && get.attitude(target, player) <= 0,
						})
						.forResult();
				},
				logTarget: "player",
				async content(event, trigger, player) {
					await event.targets[0].swapHandcards(player);
				},
			},
		},
	},
	//牛金
	stdcuorui: {
		audio: "cuorui",
		trigger: {
			global: ["phaseBefore"],
			source: ["die"],
			player: ["enterGame"],
		},
		check: () => true,
		frequent: true,
		filter(event, player, name) {
			if (player.countCards("h") >= Math.min(7, game.players.length)) {
				return false;
			}
			if (event.name != "die") {
				return game.phaseNumber == 0 || event.name != "phase";
			}
			return !event.reserveOut;
		},
		async content(event, trigger, player) {
			const num = Math.min(7, game.players.length);
			await player.drawTo(num);
		},
	},
	//甘夫人
	stdzhijie: {
		audio: "mbzhijie",
		trigger: {
			global: ["phaseUseBegin"],
		},
		round: 1,
		filter(event, player) {
			return event.player.countCards("h") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.choosePlayerCard({
					prompt: get.prompt2(event.skill, trigger.player),
					target: trigger.player,
					position: "h",
					ai(button) {
						if (get.attitude(get.player(), get.event().target) > 0) {
							return get.event().target.getUseValue(button.link);
						}
						return 0;
					},
				})
				.set("target", trigger.player)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				cards: [card],
				targets: [target],
			} = event;
			await player.showCards(card, `${get.translation(player)}对${get.translation(target)}发动了【智诫】`);
			const type = get.type2(card);
			player.addTempSkill(`${event.name}_effect`, "phaseChange");
			player.setStorage(`${event.name}_effect`, [target, type], true);
		},
		subSkill: {
			effect: {
				audio: "mbzhijie",
				charlotte: true,
				trigger: {
					global: ["useCard"],
				},
				forced: true,
				filter(event, player) {
					const storage = player.getStorage("stdzhijie_effect");
					if (event.player != storage[0]) {
						return false;
					}
					const index =
						event.player
							.getHistory("useCard", evt => {
								let type = get.type2(evt.card);
								return evt.isPhaseUsing(event.player) && type == storage[1];
							})
							.indexOf(event) + 1;
					return index > 0 && index < 4;
				},
				async content(event, trigger, player) {
					await player.draw({ nodelay: true });
				},
				intro: {
					markcount: () => 0,
					content(storage) {
						return `${get.translation(storage[0])}前三次使用${get.translation(storage[1])}牌，你摸一张牌`;
					},
				},
			},
		},
	},
	stdshushenx: {
		audio: "mbshushen",
		trigger: {
			global: ["phaseEnd"],
		},
		filter(event, player) {
			return player.getStat()?.gain > 2;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget: lib.filter.notMe,
					ai(target) {
						return get.recoverEffect(target, get.player(), get.player());
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await event.targets[0].recover();
		},
	},
	//王沈
	stdanran: {
		audio: "clananran",
		trigger: {
			player: ["damageEnd"],
		},
		check: () => true,
		frequent: true,
		async content(event, trigger, player) {
			const num = Math.min(player.countMark(event.name + "_used") + 1, 4);
			await player.draw({ num });
			if (player.countMark(event.name + "_used") < 3) {
				player.addSkill(event.name + "_used");
				player.addMark(event.name + "_used", 1, false);
			}
		},
		subSkill: {
			used: {
				onremove: true,
				charlotte: true,
				intro: {
					markcount: storage => storage + 1,
					content: storage => `当前摸牌数：${storage + 1}`,
				},
			},
		},
	},
	stdgaobian: {
		audio: "clangaobian",
		trigger: {
			global: ["phaseEnd"],
		},
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			const targets = game.filterPlayer2(target => target.hasHistory("damage"));
			return targets.length == 1 && targets[0]?.isIn();
		},
		forced: true,
		async content(event, trigger, player) {
			const target = game.findPlayer2(target => target.hasHistory("damage"));
			if (!target) {
				return;
			}
			let discarded = _status.discarded.filter(c => c.name == "sha");
			let bool = discarded.some(c => target.hasUseTarget(c));
			let num = get.attitude(target, player);
			let result = bool
				? await target
						.chooseButton({
							createDialog: [
								"选择一项",
								[
									[
										["sha", "使用本回合进入弃牌堆的一张【杀】"],
										["re", `重置${get.translation(player)}的〖岸然〗`],
									],
									"textbutton",
								],
							],
							forced: true,
							ai(button) {
								const { player, discarded: cards, attitude: num } = get.event();
								return {
									sha: Math.max(...cards.map(card => player.getUseValue(card))),
									re: num,
								}[button.link];
							},
						})
						.set("discarded", discarded)
						.set("attitude", num)
						.forResult()
				: {
						bool: true,
						links: ["re"],
					};
			if (result.links?.[0] == "sha") {
				const result2 = await target
					.chooseCardButton({
						prompt: "告变：请选择其中一张【杀】使用",
						cards: discarded,
						forced: true,
					})
					.set("filterButton", button => {
						return get.player().hasUseTarget(button.link);
					})
					.set("ai", button => {
						return get.player().getUseValue(button.link);
					})
					.forResult();
				if (result2?.bool && result2.links?.length) {
					await target.chooseUseTarget(result2.links[0], true, false);
				}
			} else {
				player.refreshSkill("stdanran");
			}
		},
	},
	//曹金玉
	stdyuqi: {
		audio: "yuqi",
		trigger: {
			global: ["damageEnd"],
		},
		filter(event, player) {
			return get.distance(event.player, player) <= player.getHp() && event.player.isIn();
		},
		logTarget: "player",
		check(event, player) {
			return get.effect(event.player, { name: "draw" }, player, player) > 0;
		},
		async content(event, trigger, player) {
			await event.targets[0].draw();
		},
	},
	stdshanshen: {
		audio: "shanshen",
		trigger: {
			global: ["die"],
		},
		filter(event, player) {
			return !event.reserveOut && event.reason?.source != player && player.isDamaged();
		},
		logTarget: "player",
		check: () => true,
		async content(event, trigger, player) {
			await player.recover();
		},
	},
	//吕伯奢
	stdfushi: {
		audio: "olfushi",
		enable: ["chooseToUse"],
		viewAsFilter(player) {
			return player.hasCard("sha", "hs");
		},
		selectCard: [1, Infinity],
		filterCard(card, player) {
			return get.name(card) == "sha";
		},
		selectTarget: () => [1, ui.selected.cards.length],
		complexCard: true,
		viewAs: {
			name: "sha",
		},
		group: ["stdfushi_effect"],
		subSkill: {
			effect: {
				trigger: {
					global: ["useCardAfter"],
				},
				forced: true,
				filter(event, player) {
					return (
						event.cards.length > 0 &&
						get.distance(player, event.player) <= 1 &&
						event.player.getHistory("useCard", evt => evt.card.name == "sha").indexOf(event) == 0
					);
				},
				async content(event, trigger, player) {
					await player.gain({
						cards: trigger.cards,
						animate: "gain2"
					});
				},
			},
		},
	},
	//吴珂
	stdanda: {
		audio: "mbanda",
		trigger: {
			global: ["dying"],
		},
		round: 1,
		filter(event, player) {
			return event.source?.isIn();
		},
		logTarget: "player",
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		async content(event, trigger, player) {
			const { targets: [target] } = event;
			const { source } = trigger;
			let result = await source
				.chooseToGive({
					prompt: `交给${get.translation(target)}一张牌否则其回复一点体力`,
					target,
					position: "he",
					ai(card) {
						const { player, target } = get.event();
						if (get.recoverEffect(target, player, player) > 0) {
							return 0;
						}
						return get.tag(card, "save") ? 5.5 - get.value(card) : 7.5 - get.value(card);
					}
				})
				.forResult();
			if (!result.bool) {
				await target.recover();
			}
		},
	},
	stdzhuguo: {
		audio: "mbzhuguo",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(target => target.countCards("h") < 2);
		},
		filterTarget(card, player, target) {
			return target.countCards("h") < 2;
		},
		async content(event, trigger, player) {
			await event.targets[0].drawTo(2);
		},
	},
};
