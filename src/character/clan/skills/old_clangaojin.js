import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "old_clangaojin" | "clanpoxi" | "clananran" | "clangaobian" | "clankaiji">} */
export const groupSkills = {
	//距离变化后神将
	old_clangaojin: {
		audio: 2,
		updateDistanceMap() {
			const obj = {};
			for (const i of game.players) {
				if (!obj[i.playerid]) {
					obj[i.playerid] = {};
				}
				for (const j of game.players) {
					//i到j的距离
					obj[i.playerid][j.playerid] = get.distance(i, j);
				}
			}
			_status.playerDistanceMap = obj;
		},
		hasDistanceChanged(player) {
			const map = _status.playerDistanceMap;
			if (!map) {
				lib.skill.old_clangaojin.updateDistanceMap();
			}
			let bool = false;
			for (const i of game.players) {
				if (map[player.playerid][i.playerid] != get.distance(player, i)) {
					bool = true;
				}
			}
			lib.skill.old_clangaojin.updateDistanceMap();
			return bool;
		},
		init: () => lib.skill.old_clangaojin.updateDistanceMap(),
		trigger: {
			global: ["logSkill", "useSkillAfter", "dieAfter", "changeHp", "equipAfter", "changeSkillsAfter"],
		},
		forced: true,
		filter(event, player) {
			return lib.skill.old_clangaojin.hasDistanceChanged(player);
		},
		async content(event, trigger, player) {
			await player.draw();
		},
		group: "old_clangaojin_buff",
		subSkill: {
			buff: {
				audio: "old_clangaojin",
				trigger: {
					global: ["phaseBefore", "roundStart"],
					player: ["enterGame"],
				},
				filter(event, player, name) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				async content(event, trigger, player) {
					player.addMark(event.name, player.getHandcardLimit(), false);
				},
				mod: {
					globalFrom(from, to, current) {
						return current - from.countMark("old_clangaojin_buff");
					},
				},
				intro: {
					content: "计算与其他角色的距离-#",
				},
			},
		},
	},
	clanpoxi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(_, player, target) {
			if (!target.countDiscardableCards(player, "he")) {
				return false;
			}
			return get.distance(player, target) <= 1;
		},
		mod: {
			globalFrom(from, to, current) {
				return current + from.countMark("clanpoxi");
			},
		},
		intro: {
			content: "计算与其他角色的距离+#",
		},
		async content(event, trigger, player) {
			const { target } = event;
			const { cards } = await player
				.discardPlayerCard(target, true)
				.set("ai", function (button) {
					if (!["basic", "equip"].includes(get.type(button.link))) {
						return 0;
					}
					return Math.random();
				})
				.forResult();
			if (["basic", "equip"].includes(get.type(cards?.[0]))) {
				await player.chooseUseTarget({ name: "sha", isCard: true }, cards);
			}
		},
		group: ["clanpoxi_directHit", "clanpoxi_check"],
		subSkill: {
			directHit: {
				direct: true,
				trigger: {
					player: "useCard",
				},
				filter(event, player) {
					return event.getParent(2).name == "clanpoxi";
				},
				async content(event, trigger, player) {
					const { bool } = await player.chooseBool("破袭：是否令此牌不可被响应？").forResult();
					if (bool) {
						trigger.directHit.addArray(trigger.targets);
					}
				},
			},
			check: {
				silent: true,
				trigger: {
					source: "damageSource",
				},
				filter(event, player) {
					return event.getParent(4).name == "clanpoxi";
				},
				async content(event, trigger, player) {
					player.addMark("clanpoxi", 1, false);
				},
			},
		},
		ai: {
			order: 7,
			result: {
				player: 2,
				target: -1,
			},
		},
	},
	//族王沈
	clananran: {
		audio: 2,
		trigger: { player: ["phaseUseBegin", "damageEnd"] },
		async cost(event, trigger, player) {
			const count = Math.min(4, player.countMark("clananran_used") + 1);
			const result = await player
				.chooseButton([
					get.prompt2(event.skill),
					[
						[
							["draw", `摸${get.cnNumber(count)}张牌`],
							["asyncDraw", `令至多${get.cnNumber(count)}名角色摸一张牌`],
						],
						"textbutton",
					],
				])
				.set("ai", button => {
					const player = get.player(),
						count = Math.min(4, player.countMark("clananran_used") + 1);
					if (button.link === "draw") {
						return get.effect(player, { name: "draw" }, player, player) * count;
					}
					return game
						.filterPlayer(target => get.effect(target, { name: "draw" }, player, player) > 0)
						.sort((a, b) => {
							return get.effect(b, { name: "draw" }, player, player) - get.effect(a, { name: "draw" }, player, player);
						})
						.slice(0, count)
						.reduce((sum, target) => sum + get.effect(target, { name: "draw" }, player, player), 0);
				})
				.forResult();
			event.result = {
				bool: result.bool,
				cost_data: result.links?.[0],
			};
		},
		async content(event, trigger, player) {
			const tag = "clananran_tag",
				mark = "clananran_used";
			player.addSkill(mark);
			if (player.countMark(mark) < 4) {
				player.addMark(mark, 1, false);
			}
			const count = player.countMark(mark);
			const { cost_data } = event,
				map = { player: "useCard1", global: "phaseAfter" };
			if (cost_data == "draw") {
				player.addTempSkill(tag, map);
				await player.draw(count).set("gaintag", [tag]);
			} else {
				const result = await player.chooseTarget(`岸然：令至多${get.cnNumber(count)}名角色各摸一张牌`, [1, count], true).forResult();
				if (result.targets?.length) {
					for (const i of result.targets.sortBySeat()) {
						i.addTempSkill(tag, map);
						await i.draw("nodelay").set("gaintag", [tag]);
					}
					await game.delayx();
				}
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: { content: "当前【岸然】X为#" },
			},
			tag: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				mod: {
					cardEnabled(card) {
						if ([card].concat(card.cards || []).some(c => get.itemtype(c) === "card" && c.hasGaintag("clananran_tag"))) {
							return false;
						}
					},
					cardSavable(card) {
						if ([card].concat(card.cards || []).some(c => get.itemtype(c) === "card" && c.hasGaintag("clananran_tag"))) {
							return false;
						}
					},
				},
			},
		},
	},
	clangaobian: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			const targets = game.filterPlayer2(target => target.hasHistory("damage"));
			return targets.length == 1 && targets[0]?.isIn();
		},
		forced: true,
		logTarget(event, player) {
			return game.findPlayer2(target => target.hasHistory("damage"));
		},
		async content(event, trigger, player) {
			const target = game.findPlayer2(target => target.hasHistory("damage"));
			const discarded = _status.discarded.filter(c => c.name == "sha");
			const bool = discarded.some(c => target.hasUseTarget(c));
			const result = bool
				? await target
						.chooseButton(
							[
								"告变：请选择一项",
								[
									[
										["sha", "使用本回合进入弃牌堆的一张【杀】"],
										["loseHp", "失去1点体力"],
									],
									"textbutton",
								],
							],
							true
						)
						.set(
							"discarded",
							discarded.filter(c => target.hasUseTarget(c))
						)
						.set("ai", button => {
							const { player, discarded: cards } = get.event();
							return {
								sha: Math.max(...cards.map(card => player.getUseValue(card))),
								loseHp: get.effect(player, { name: "losehp" }, player, player),
							}[button.link];
						})
						.forResult()
				: { bool: true, links: ["loseHp"] };
			if (result.links[0] == "sha") {
				const result2 = await target
					.chooseCardButton("告变：请选择其中一张【杀】使用", discarded, true)
					.set("filterButton", button => {
						return get.player().hasUseTarget(button.link);
					})
					.forResult();
				if (result2?.bool && result2.links?.length) {
					await target.chooseUseTarget(result2.links[0], true, false);
				}
			} else {
				await target.loseHp();
			}
		},
	},
	// 族王昶
	clankaiji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (!event.clankaiji_enabledTargets) {
				return false;
			}
			return game.hasPlayer(current => get.info("clankaiji").filterTarget(null, player, current));
		},
		onChooseToUse(event) {
			if (game.online || event.type !== "phase") {
				return;
			}
			const player = event.player;
			const chosen = player.getRoundHistory("useSkill", evt => evt.skill === "clankaiji").reduce((list, evt) => list.add(evt.targets[0]), []);
			event.set("clankaiji_enabledTargets", chosen);
		},
		filterTarget(card, player, target) {
			return !get.event().clankaiji_enabledTargets.includes(target) && player.countDiscardableCards(target, "h");
		},
		async content(event, trigger, player) {
			const { target } = event;
			const { links: cards } = await target
				.discardPlayerCard(player, "h", true)
				.set("ai", button => {
					const { player, target } = get.event(),
						{ link } = button;
					if (get.attitude(player, target) > 0) {
						if (target.hasUseTarget(link)) {
							return 10;
						}
						return 6 - get.value(link);
					}
					if (player.hasSkillTag("viewHandcard", null, target, true)) {
						if (!target.hasUseTarget(link)) {
							return 10;
						}
						return get.value(link);
					}
					if (get.is.shownCard(link) && !target.hasUseTarget(link)) {
						return 10;
					}
					return 1;
				})
				.forResult();
			if (!cards || !cards.someInD("d")) {
				return;
			}
			const card = cards.filterInD("d");
			await game.delayx();
			const { bool } = await player.chooseUseTarget(`你可以使用${get.translation(card)}然后摸一张牌`, card, false).forResult();
			if (bool) {
				await player.draw();
			}
		},
		ai: {
			order: 3,
			result: {
				player(player, target) {
					if (!player.hasCard(card => player.hasUseTarget(card, undefined, true), "h")) {
						return -1;
					}
					if (player == target || get.attitude(player, target) > 0) {
						return 1;
					}
					if (player.countCards("h", card => player.hasUseTarget(card, undefined, true)) >= player.countCards("h", card => !player.hasUseTarget(card, undefined, true))) {
						return -0.5 + Math.random();
					}
					return -1;
				},
			},
		},
	},
};
