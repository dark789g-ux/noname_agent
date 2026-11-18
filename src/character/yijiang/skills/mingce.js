import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mingce" | "xinxuanhuo" | "zhichi" | "zhichi2" | "zongxuan" | "zhiyan">} */
export const groupSkills = {
	mingce: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		position: "he",
		filterCard(card) {
			return get.name(card) == "sha" || get.type(card) == "equip";
		},
		filter(event, player) {
			return player.countCards("h", "sha") > 0 || player.countCards("he", { type: "equip" }) > 0;
		},
		check(card) {
			return 8 - get.value(card);
		},
		selectTarget: 2,
		multitarget: true,
		discard: false,
		lose: false,
		targetprompt: ["得到牌", "出杀目标"],
		filterTarget(card, player, target) {
			if (ui.selected.targets.length == 0) {
				return player != target;
			} else {
				return ui.selected.targets[0].inRange(target);
			}
		},
		delay: false,
		async content(event, trigger, player) {
			const { cards, targets } = event;
			await player.give(cards, targets[0], true);
			let result;
			if (!lib.filter.filterTarget({ name: "sha", isCard: true }, targets[0], targets[1])) {
				result = { control: "draw_card" };
			} else {
				result = await targets[0]
					.chooseControl({
						prompt: "对" + get.translation(targets[1]) + "使用一张杀，或摸一张牌",
						controls: ["draw_card", "出杀"],
						ai() {
							const { player, target } = get.event();
							if (get.effect(_status.event.target, { name: "sha" }, player, player) > 0) {
								return 1;
							}
							return 0;
						},
					})
					.set("target", targets[1])
					.forResult();
			}
			if (result.control == "draw_card") {
				await targets[0].draw();
			} else {
				await targets[0].useCard({
					card: get.autoViewAs({ name: "sha", isCard: true }),
					targets: [targets[1]],
				});
			}
		},
		ai: {
			result: {
				player(player) {
					var players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i] != player && get.attitude(player, players[i]) > 1 && get.attitude(players[i], player) > 1) {
							return 1;
						}
					}
					return 0;
				},
				target(player, target) {
					if (ui.selected.targets.length) {
						return -0.1;
					}
					return 1;
				},
			},
			order: 8.5,
			expose: 0.2,
		},
	},
	xinxuanhuo: {
		audio: 2,
		trigger: {
			player: "phaseDrawBegin1",
		},
		filter(event, player) {
			return !event.numFixed;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("xinxuanhuo"),
					filterTarget(card, player, target) {
						return player != target;
					},
					ai(target) {
						const event = get.event();
						const player = get.player();

						let att = get.attitude(player, target);
						const count = target.countCards("h");
						if (att > 0) {
							if (count < target.hp) {
								att += 2;
							}
							return att - count / 3;
						} else {
							return -1;
						}
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			trigger.changeToZero();

			const target = event.targets[0];
			await target.draw(2);

			let noSha = true;
			if (game.hasPlayer(current => target.canUse("sha", current))) {
				let result = await player
					.chooseTarget({
						prompt: "选择出杀的目标",
						filterTarget(card, player, target) {
							const event = get.event();
							return event.target.canUse("sha", target);
						},
						forced: true,
						ai(target) {
							const event = get.event();
							return get.effect(target, { name: "sha" }, event.target, event.player);
						},
					})
					.set("target", target)
					.forResult();

				if (result.bool && result.targets?.length) {
					game.log(player, "指定的出杀目标为", result.targets);
					const target2 = result.targets[0];
					target.line(target2);
					result = await target
						.chooseToUse({
							prompt: `对${get.translation(result.targets)}使用一张杀，或令${get.translation(player)}获得你的两张牌`,
							filterTarget(card, player, target) {
								return target === target2;
							},
							selectTarget: -1,
							filterCard(card) {
								return card.name === "sha";
							},
						})
						.forResult();
					noSha = !result.bool;
				}
			}

			if (noSha) {
				await player.gainPlayerCard({
					target,
					selectButton: Math.min(2, target.countCards("he")),
					position: "he",
					forced: true,
				});
			}
		},
		ai: {
			expose: 0.2,
		},
	},
	zhichi: {
		audio: 2,
		trigger: { player: "damageEnd" },
		audioname: ["re_chengong"],
		audioname2: { sxrm_caocao: "zhichi_sxrm_caocao" },
		forced: true,
		filter(event, player) {
			return _status.currentPhase != player;
		},
		async content(event, trigger, player) {
			player.addTempSkill("zhichi2", ["phaseAfter", "phaseBefore"]);
		},
	},
	zhichi2: {
		audio: "zhichi",
		trigger: { target: "useCardToBefore" },
		audioname: ["re_chengong"],
		audioname2: { sxrm_caocao: "zhichi_sxrm_caocao" },
		forced: true,
		charlotte: true,
		priority: 15,
		sourceSkill: "zhichi",
		filter(event, player) {
			return get.type(event.card) == "trick" || event.card.name == "sha";
		},
		async content(event, trigger, player) {
			game.log(player, "发动了智迟，", trigger.card, "对", trigger.target, "失效");
			trigger.cancel();
		},
		mark: true,
		intro: {
			content: "杀或普通锦囊牌对你无效",
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "trick" || card.name == "sha") {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	zongxuan: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (event.type != "discard" || event.getlx === false) {
				return;
			}
			var evt = event.getl(player);
			for (var i = 0; i < evt.cards2.length; i++) {
				if (get.position(evt.cards2[i]) == "d") {
					return true;
				}
			}
			return false;
		},
		check(trigger, player) {
			if (
				trigger.getParent(3).name != "phaseDiscard" ||
				!game.hasPlayer(function (current) {
					return current.isDamaged() && get.recoverEffect(current, player, player) > 0;
				})
			) {
				return false;
			}
			var evt = trigger.getl(player);
			for (var i = 0; i < evt.cards2.length; i++) {
				if (get.position(evt.cards2[i], true) == "d" && get.type(evt.cards2[i], false) == "equip") {
					return true;
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			const cards = [],
				cards2 = trigger.getl(player).cards2;
			cards.push(...cards2.filter(card => get.position(card, true) == "d"));
			const result = await player
				.chooseToMove("纵玄：将任意张牌置于牌堆顶（左边的牌更接近牌堆顶）", true, "allowChooseAll")
				.set("list", [["本次弃置的牌", cards], ["牌堆顶"]])
				.set("filterOk", function (moved) {
					if (moved[0].length == 1 && get.type2(moved[0][0], false) == "trick") {
						return true;
					}
					return moved[1].length > 0;
				})
				.set("processAI", function (list) {
					const cards = list[0][1].slice(0),
						player = _status.event.player;
					let result = [[], []];
					if (
						game.hasPlayer(function (current) {
							return current != player && get.attitude(player, current) > 0 && !current.hasSkillTag("nogain");
						})
					) {
						let max_val = 0;
						let max_card = false;
						for (const i of cards) {
							if (get.type2(i, false) == "trick") {
								const val = get.value(i, "raw");
								if (val > max_val) {
									max_card = i;
									max_val = val;
								}
							}
						}
						if (max_card) {
							result[0].push(max_card);
							cards.remove(max_card);
						}
					}
					if (cards.length) {
						let max_val = 0;
						let max_card = false;
						const equip = game.hasPlayer(function (current) {
							return current.isDamaged() && get.recoverEffect(current, player, player) > 0;
						});
						for (const i of cards) {
							let val = get.value(i);
							const type = get.type2(i, false);
							if (type == "basic") {
								val += 3;
							}
							if (type == "equip" && equip) {
								val += 9;
							}
							if (max_val == 0 || val > max_val) {
								max_card = i;
								max_val = val;
							}
						}
						if (max_card) {
							result[1].push(max_card);
							cards.remove(max_card);
						}
						result[0].addArray(cards);
					}
					return result;
				})
				.forResult();
			if (result.bool) {
				const cards = result.moved[1].slice(0);
				if (cards?.length) {
					cards.reverse();
					game.log(player, "将", cards, "置于牌堆顶");
					await game.cardsGotoPile(cards, "insert");
				}
			}
		},
	},
	zhiyan: {
		audio: 2,
		audioname: ["gexuan", "re_yufan"],
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("zhiyan"),
					prompt2: "令一名角色摸一张牌并展示之。若为装备牌，则其回复1点体力",
					ai(target) {
						return get.attitude(_status.event.player, target);
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			let shouldRecover = false;
			const result = await target.draw({ visible: true }).forResult();
			const card = result.cards[0];
			if (get.type(card) == "equip") {
				if (target.getCards("h").includes(card) && target.hasUseTarget(card)) {
					await target.chooseUseTarget(card, true, "nopopup");
					await game.delay();
				}
				shouldRecover = true;
			}
			if (shouldRecover) {
				await target.recover();
			}
		},
		ai: {
			expose: 0.2,
			threaten: 1.2,
		},
	},
};
