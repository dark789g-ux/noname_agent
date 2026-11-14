import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rehujiaSkills = {
	//界护驾
	rehujia: {
		audio: "hujia",
		inherit: "hujia",
		filter(event, player) {
			if (event.responded) {
				return false;
			}
			if (player.storage.hujiaing) {
				return false;
			}
			if (!player.hasZhuSkill("rehujia")) {
				return false;
			}
			if (!event.filterCard({ name: "shan" }, player, event)) {
				return false;
			}
			return game.hasPlayer(current => current != player && current.group == "wei");
		},
		ai: {
			respondShan: true,
			skillTagFilter(player) {
				if (player.storage.hujiaing) {
					return false;
				}
				if (!player.hasZhuSkill("rehujia")) {
					return false;
				}
				return game.hasPlayer(current => current != player && current.group == "wei");
			},
		},
		group: "rehujia_draw",
		subSkill: {
			draw: {
				trigger: { global: ["useCard", "respond"] },
				usable: 1,
				filter(event, player) {
					return event.card.name == "shan" && event.player != player && event.player.group == "wei" && event.player.isIn() && event.player != _status.currentPhase && player.hasZhuSkill("rehujia");
				},
				async cost(event, trigger, player) {
					event.result = await trigger.player
						.chooseBool(`护驾：是否令${get.translation(player)}摸一张牌？`)
						.set("ai", () => {
							const evt = _status.event;
							return get.attitude(evt.player, evt.getParent().player) > 0;
						})
						.forResult();
				},
				async content(event, trigger, player) {
					trigger.player.line(player, "fire");
					await player.draw();
				},
			},
		},
	},
	//夏侯氏
	reqiaoshi: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player != player && event.player.countCards("h") == player.countCards("h") && event.player.isIn();
		},
		check(event, player) {
			return get.attitude(player, event.player) >= 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			while (player.isIn() && target.isIn()) {
				const list1 = (await player.draw("nodelay").forResult()).cards;
				const list2 = (await target.draw().forResult()).cards;
				await game.delayx();
				if (
					[list1, list2].every(cards => get.itemtype(cards) == "cards") &&
					list1.length == list2.length &&
					list1
						.map(card => get.suit(card, player))
						.toUniqued()
						.every(suit => list2.some(card => get.suit(card, target) == suit))
				) {
					const result = await player.chooseBool("是否继续发动【樵拾】？", `和${get.translation(target)}各摸一张牌`).forResult();
					if (!result?.bool) {
						break;
					}
				} else {
					break;
				}
			}
		},
		ai: { expose: 0.1 },
	},
	reyanyu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasCard(card => lib.skill.reyanyu.filterCard(card, player), "h");
		},
		filterCard: (card, player) => get.name(card) == "sha" && player.canRecast(card),
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards } = event;
			await player.recast(cards);
		},
		ai: {
			basic: {
				order: 1,
			},
			result: {
				player: 1,
			},
		},
		group: "reyanyu2",
	},
	reyanyu2: {
		trigger: { player: "phaseUseEnd" },
		direct: true,
		sourceSkill: "reyanyu",
		filter: (event, player) => player.hasHistory("useSkill", evt => evt.skill == "reyanyu" && evt.event.getParent(2) == event) && game.hasPlayer(target => target.hasSex("male") && target != player),
		async content(event, trigger, player) {
			let result;

			// step 0
			const num = Math.min(3, player.getHistory("useSkill", evt => evt.skill == "reyanyu" && evt.event.getParent(2) == trigger).length);
			result = await player
				.chooseTarget(get.prompt("reyanyu"), "令一名男性角色摸" + get.cnNumber(num) + "张牌", function (card, player, target) {
					return target.hasSex("male") && target != player;
				})
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target);
				})
				.forResult();

			// step 1
			if (result.bool) {
				player.logSkill("reyanyu", result.targets);
				await result.targets[0].draw(num).forResult();
			}
		},
	},
	//虞翻
	xinzongxuan: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (event.type != "discard") {
				return false;
			}
			var evt = event.getl(player);
			if (!evt || !evt.cards2) {
				return false;
			}
			for (var i = 0; i < evt.cards2.length; i++) {
				if (get.position(evt.cards2[i]) == "d") {
					return true;
				}
			}
			return false;
		},
		check(trigger, player) {
			if (trigger.getParent(3).name == "phaseDiscard") {
				return true;
			}
			if (
				!game.hasPlayer(function (current) {
					return current != player && get.attitude(player, current) > 0 && !current.hasSkillTag("nogain");
				})
			) {
				return false;
			}
			var cards = trigger.getl(player).cards2;
			for (var i = 0; i < cards.length; i++) {
				if (get.position(cards[i], true) == "d" && get.type2(cards[i], false) == "trick") {
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
				.set("list", [["本次弃置的牌（请将要给出的锦囊牌留在这里）", cards], ["牌堆顶"]])
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
						var max_val = 0;
						var max_card = false;
						for (var i of cards) {
							if (get.type2(i, false) == "trick") {
								var val = get.value(i, "raw");
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
						var max_val = 0;
						var max_card = false;
						var equip = game.hasPlayer(function (current) {
							return current.isDamaged() && get.recoverEffect(current, player, player) > 0;
						});
						for (var i of cards) {
							var val = get.value(i);
							var type = get.type2(i, false);
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
				const list = result.moved[0].filter(function (i) {
					return get.type2(i, false) == "trick";
				});
				if (!list.length || !game.hasPlayer(current => current != player)) {
					return;
				}
				const result2 = await player
					.chooseButtonTarget({
						createDialog: ["纵玄：是否将一张锦囊牌交给一名其他角色？", list],
						filterButton: true,
						filterTarget: lib.filter.notMe,
						ai1(button) {
							if (_status.event.goon) {
								return Math.max(0.1, get.value(button.link, "raw"));
							}
							return 0;
						},
						forced: !result.moved[1].length,
						goon: game.hasPlayer(function (current) {
							return current != player && get.attitude(player, current) > 0 && !current.hasSkillTag("nogain");
						}),
						ai2(target) {
							const card = ui.selected.buttons[0].link,
								player = get.player();
							let eff = Math.max(0.1, get.value(card, target)) * get.attitude(player, target);
							if (target.hasSkill("nogain")) {
								eff /= 10;
							}
							return eff;
						},
					})
					.forResult();
				if (result2.bool && result2.links?.length && result2.targets?.length) {
					const {
						links: cards,
						targets: [target],
					} = result2;
					player.line(target, "green");
					await target.gain(cards, "gain2");
				}
			}
		},
	},
	xinzhiyan: {
		audio: "zhiyan",
		audioname: ["re_yufan", "xin_yufan"],
		audioname2: { gexuan: "zhiyan_gexuan" },
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		async content(event, trigger, player) {
			let result = await player
				.chooseTarget(get.prompt("zhiyan"), "令一名角色摸一张牌并展示之。若为基本牌则你摸一张牌；若为装备牌，则其回复1点体力")
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target) * (target.isDamaged() ? 2 : 1);
				})
				.forResult();
			if (!result.bool) {
				return;
			}

			var target = result.targets[0];
			player.logSkill("xinzhiyan", result.targets);
			var needRecover = false;
			result = await target.draw("visible").forResult();

			var card = result?.cards?.[0];
			if (get.type(card) == "basic") {
				player.draw();
			}

			if (get.type(card) == "equip") {
				if (target.getCards("h").includes(card) && target.hasUseTarget(card)) {
					target.chooseUseTarget(card, true, "nopopup");
					game.delay();
				}
				needRecover = true;
			}

			if (needRecover) {
				target.recover();
			}
		},
		ai: {
			expose: 0.2,
			threaten: 1.2,
		},
	},
	//新主公技
	xinhuangtian: {
		audio: "xinhuangtian2",
		audioname: ["zhangjiao", "re_zhangjiao"],
		global: "xinhuangtian2",
		zhuSkill: true,
	},
	xinhuangtian2: {
		audio: 2,
		enable: "phaseUse",
		discard: false,
		lose: false,
		delay: false,
		line: true,
		prepare(cards, player, targets) {
			targets[0].logSkill("xinhuangtian");
		},
		prompt() {
			var player = _status.event.player;
			var list = game.filterPlayer(function (target) {
				return target != player && target.hasZhuSkill("xinhuangtian", player);
			});
			var str = "将一张【闪】或黑桃手牌交给" + get.translation(list);
			if (list.length > 1) {
				str += "中的一人";
			}
			return str;
		},
		filter(event, player) {
			if (player.group != "qun") {
				return false;
			}
			if (
				!game.hasPlayer(function (target) {
					return target != player && target.hasZhuSkill("xinhuangtian", player) && !target.hasSkill("xinhuangtian3");
				})
			) {
				return false;
			}
			return player.hasCard(function (card) {
				return lib.skill.xinhuangtian2.filterCard(card, player);
			}, "h");
		},
		filterCard(card, player) {
			return get.name(card, player) == "shan" || get.suit(card, player) == "spade";
		},
		log: false,
		visible: true,
		filterTarget(card, player, target) {
			return target != player && target.hasZhuSkill("xinhuangtian", player) && !target.hasSkill("xinhuangtian3");
		},
		//usable:1,
		//forceaudio:true,
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.give(cards, target);
			target.addTempSkill("xinhuangtian3", "phaseUseEnd");
		},
		ai: {
			expose: 0.3,
			order: 10,
			result: {
				target: 5,
			},
		},
	},
	xinhuangtian3: {},
	rejijiang: {
		selectionSpec: true,
		audio: "jijiang1",
		audioname: ["liushan", "re_liubei", "re_liushan", "ol_liushan"],
		group: ["rejijiang1", "rejijiang3"],
		zhuSkill: true,
		filter(event, player) {
			if (
				!player.hasZhuSkill("rejijiang") ||
				!game.hasPlayer(function (current) {
					return current != player && current.group == "shu";
				})
			) {
				return false;
			}
			return !event.jijiang && (event.type != "phase" || !player.hasSkill("jijiang3"));
		},
		enable: ["chooseToUse", "chooseToRespond"],
		viewAs: { name: "sha" },
		filterCard: () => false,
		selectCard: -1,
		ai: {
			order() {
				return get.order({ name: "sha" }) + 0.3;
			},
			respondSha: true,
			skillTagFilter(player) {
				if (
					!player.hasZhuSkill("rejijiang") ||
					!game.hasPlayer(function (current) {
						return current != player && current.group == "shu";
					})
				) {
					return false;
				}
			},
		},
	},
};
