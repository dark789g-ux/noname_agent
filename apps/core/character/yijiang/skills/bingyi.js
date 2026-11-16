import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "bingyi" | "xiantu" | "qiangzhi" | "qiangzhi_draw" | "dingpin" | "dingpin2" | "faen" | "jiaojin" | "chanhui">} */
export const groupSkills = {
	bingyi: {
		audio: 2,
		audioname: ["xin_guyong"],
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterx(event, player) {
			var cards = player.getCards("h");
			if (cards.length < 1) {
				return false;
			}
			var color = get.color(cards[0]);
			for (var i = 1; i < cards.length; i++) {
				if (get.color(cards[i]) != color) {
					return false;
				}
			}
			return true;
		},
		async cost(event, trigger, player) {
			if (lib.skill.bingyi.filterx(trigger, player)) {
				event.result = await player
					.chooseTarget({
						prompt: get.prompt("bingyi"),
						prompt2: "展示所有手牌，并令至多" + get.cnNumber(player.countCards("h")) + "名角色各摸一张牌",
						filterTarget: lib.filter.all,
						selectTarget: [1, player.countCards("h")],
						ai(target) {
							return get.attitude(_status.event.player, target);
						},
					})
					.forResult();
			} else {
				event.result = await player
					.chooseBool({
						prompt: get.prompt("bingyi"),
						prompt2: "展示所有手牌",
						ai() {
							return false;
						},
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			await player.showHandcards(get.translation(player) + "发动了【秉壹】");
			const targets = event.targets;
			if (targets?.length) {
				player.line(targets, "green");
				targets.sortBySeat();
				await game.asyncDraw(targets);
			}
		},
		ai: {
			expose: 0.1,
		},
	},
	xiantu: {
		audio: 2,
		logAudio(event) {
			if (typeof event == "string") {
				return "xiantu2.mp3";
			}
			return 1;
		},
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			return event.player != player;
		},
		logTarget: "player",
		prompt2: "摸两张牌，然后交给其两张牌。若该角色于本回合阶段时未杀死过角色，则你失去1点体力。",
		check(event, player) {
			if (get.attitude(player, event.player) < 5) {
				return false;
			}
			if (player.maxHp - player.hp >= 2) {
				return false;
			}
			if (player.hp == 1) {
				return false;
			}
			if (player.hp == 2 && player.countCards("h") < 2) {
				return false;
			}
			if (event.player.countCards("h") >= event.player.hp) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (get.mode() !== "identity" || player.identity !== "nei") {
				player.addExpose(0.2);
			}
			await player.draw(2);
			const result = await player
				.chooseCard(2, "he", true, `交给${get.translation(target)}两张牌`)
				.set("ai", card => {
					if (ui.selected.cards.length && card.name == ui.selected.cards[0].name) {
						return -1;
					}
					if (get.tag(card, "damage")) {
						return 1;
					}
					if (get.type(card) == "equip") {
						return 1;
					}
					return 0;
				})
				.forResult();
			if (result?.bool && result.cards?.length) {
				player.give(result.cards, target);
				player
					.when({
						global: "phaseAnyEnd",
					})
					.filter(evt => evt == event.getParent(evt.name, true, true))
					.step(async (event, trigger, player) => {
						if (
							game.hasGlobalHistory("everything", evt => {
								if (evt.name != "die" || evt.source != target) {
									return false;
								}
								return evt.getParent(trigger.name, true) == trigger;
							})
						) {
							return;
						}
						player.logSkill("xiantu", null, null, null, ["loseHp"]);
						await player.loseHp();
					});
			}
		},
		ai: {
			threaten: 1.1,
		},
	},
	qiangzhi: {
		audio: 2,
		audioname: ["re_zhangsong"],
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && current.countCards("h") > 0;
			});
		},
		subfrequent: ["draw"],
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("qiangzhi"),
					filterTarget(card, player, target) {
						return target !== player && target.countCards("h") > 0;
					},
					ai() {
						return Math.random();
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await player
				.choosePlayerCard({
					target,
					position: "h",
					forced: true,
				})
				.forResult();
			if (!result.cards?.length) {
				return;
			}
			const card = result.cards[0];
			await target.showCards(card, get.translation(target) + "因【强识】展示");
			player.storage.qiangzhi_draw = get.type(card, "trick");
			game.addVideo("storage", player, ["qiangzhi_draw", player.storage.qiangzhi_draw]);
			player.addTempSkill("qiangzhi_draw", "phaseUseEnd");
		},
	},
	qiangzhi_draw: {
		trigger: { player: "useCard" },
		frequent: true,
		popup: false,
		charlotte: true,
		prompt: "是否执行【强识】的效果摸一张牌？",
		sourceSkill: "qiangzhi",
		filter(event, player) {
			return get.type(event.card, "trick") == player.storage.qiangzhi_draw;
		},
		async content(event, trigger, player) {
			player.draw("nodelay");
		},
		onremove: true,
		mark: true,
		intro: {
			content(type) {
				return get.translation(type) + "牌";
			},
		},
	},
	dingpin: {
		audio: "pindi",
		enable: "phaseUse",
		onChooseToUse(event) {
			if (event.type != "phase" || game.online) {
				return;
			}
			var list = [],
				player = event.player;
			player.getHistory("useCard", function (evt) {
				list.add(get.type2(evt.card));
			});
			player.getHistory("lose", function (evt) {
				if (evt.type != "discard") {
					return;
				}
				for (var i of evt.cards2) {
					list.add(get.type2(i, evt.hs.includes(i) ? player : false));
				}
			});
			event.set("dingpin_types", list);
		},
		filter(event, player) {
			var list = event.dingpin_types || [];
			return (
				player.countCards("he", function (card) {
					return !list.includes(get.type2(card));
				}) > 0
			);
		},
		filterCard(card) {
			var list = _status.event.dingpin_types || [];
			return !list.includes(get.type2(card));
		},
		position: "he",
		filterTarget(card, player, target) {
			return !target.hasSkill("dingpin2");
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await target
				.judge({
					judge(card) {
						const evt = _status.event.getParent("dingpin");
						if (evt == null) {
							return 0;
						}
						const color = get.color(card);
						switch (color) {
							case "black":
								return evt.target.getDamagedHp();
							case "red":
								return get.sgn(get.attitude(evt.target, evt.player)) * -3;
						}
						return 0;
					},
					judge2(result) {
						return result.color === "black";
					},
				})
				.forResult();
			switch (result.color) {
				case "black":
					if (target.getDamagedHp() > 0) {
						await target.draw(target.getDamagedHp());
					}
					target.addTempSkill("dingpin2");
					break;
				case "red":
					await player.turnOver();
					break;
			}
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					if (player.isTurnedOver()) {
						return target.getDamagedHp();
					}
					var card = ui.cardPile.firstChild;
					if (!card) {
						return;
					}
					if (get.color(card) == "black") {
						return target.getDamagedHp();
					}
					return 0;
				},
			},
		},
	},
	dingpin2: { charlotte: true },
	faen: {
		audio: 2,
		trigger: { global: ["turnOverAfter", "linkAfter"] },
		filter(event, player) {
			if (event.name == "link") {
				return event.player.isLinked();
			}
			return !event.player.isTurnedOver();
		},
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.player.draw();
		},
		ai: {
			expose: 0.2,
		},
		global: "faen_global",
		subSkill: {
			global: {
				ai: {
					effect: {
						target(card, player, target) {
							if (card.name == "tiesuo" && !target.isLinked()) {
								return [
									1,
									0.6 *
										game.countPlayer(cur => {
											return (cur.hasSkill("faen") || cur.hasSkill("oldfaen") || cur.hasSkill("refaen") || cur.hasSkill("dcfaen")) && get.attitude(target, cur) > 0;
										}),
								];
							}
						},
					},
				},
			},
		},
	},
	jiaojin: {
		audio: 2,
		trigger: { player: "damageBegin3" },
		filter(event, player) {
			return player.countCards("he", { type: "equip" }) > 0 && event.source && event.source.hasSex("male");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard({
					prompt: "骄矜：是否弃置一张装备牌令伤害-1？",
					filterCard(card, player) {
						return get.type(card) === "equip";
					},
					position: "he",
					ai(card) {
						const event = get.event();
						const player = event.player;
						if (player.hp === 1 || event.getTrigger().num > 1) {
							return 9 - get.value(card);
						}
						if (player.hp === 2) {
							return 8 - get.value(card);
						}
						return 7 - get.value(card);
					},
				})
				.set("chooseonly", true)
				.forResult();
		},
		async content(event, trigger, player) {
			await player.discard({
				cards: event.cards,
				discarder: player,
			});
			--trigger.num;
		},
	},
	chanhui: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			if (_status.currentPhase != player) {
				return false;
			}
			if (player.hasSkill("chanhui2")) {
				return false;
			}
			if (event.targets.length > 1) {
				return false;
			}
			var card = event.card;
			if (card.name == "sha") {
				return true;
			}
			if (get.color(card) == "black" && get.type(card) == "trick") {
				return true;
			}
			return false;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("chanhui"),
					filterTarget(card, player, target) {
						if (player === target) {
							return false;
						}
						const evt = _status.event.getTrigger();
						return !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
					},
					ai(target) {
						const event = get.event();
						const trigger = event.getTrigger();
						const player = get.player();
						return get.effect(target, trigger.card, player, player) + 0.01;
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.addTempSkill("chanhui2");
			const result = await target
				.chooseCard({
					prompt: `交给${get.translation(player)}一张手牌，或成为${get.translation(trigger.card)}的额外目标`,
					ai(card) {
						return 5 - get.value(card);
					},
				})
				.forResult();
			if (result.bool) {
				await target.give(result.cards, player);
				trigger.untrigger();
				trigger.getParent().player = target;
				game.log(target, "成为了", trigger.card, "的使用者");
			} else {
				game.log(target, "成为了", trigger.card, "的额外目标");
				trigger.getParent().targets.push(target);
			}
		},
	},
};
