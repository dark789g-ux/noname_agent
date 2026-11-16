import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "nzry_shicai" | "nzry_cunmu" | "nzry_mingren" | "nzry_zhenliang" | "nzry_jianxiang">} */
export const groupSkills = {
	nzry_shicai: {
		audio: "nzry_shicai_2",
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				if (num <= 0 || player.nzry_shicai_aiOrder || get.itemtype(card) !== "card" || player.hasSkillTag("abnormalDraw")) {
					return num;
				}
				let type = get.type2(card, false);
				if (
					player.hasHistory("useCard", evt => {
						return get.type2(evt.card, false) == type;
					})
				) {
					return num;
				}
				player.nzry_shicai_aiOrder = true;
				let val = player.getUseValue(card, true, true);
				delete player.nzry_shicai_aiOrder;
				return 20 * val;
			},
		},
		trigger: { player: ["useCardAfter", "useCardToTargeted"] },
		prompt2(event, player) {
			const cards = event.cards.filterInD("oe");
			return "你可以将" + get.translation(cards) + (cards.length > 1 ? "以任意顺序" : "") + "置于牌堆顶，然后摸一张牌";
		},
		filter(event, player) {
			if (!event.cards.someInD()) {
				return false;
			}
			let evt = event,
				type = get.type2(evt.card, false);
			if (event.name == "useCardToTargeted") {
				if (type != "equip" || player != event.target) {
					return false;
				}
				evt = evt.getParent();
			} else {
				if (type == "equip") {
					return false;
				}
			}
			return !player.hasHistory(
				"useCard",
				evtx => {
					return evtx != evt && get.type2(evtx.card, false) == type;
				},
				evt
			);
		},
		check(event, player) {
			if (get.type(event.card) == "equip") {
				if (get.subtype(event.card) == "equip6") {
					return true;
				}
				if (get.equipResult(player, player, event.card) <= 0) {
					return true;
				}
				const eff1 = player.getUseValue(event.card);
				const subtype = get.subtype(event.card);
				return (
					player.countCards("h", function (card) {
						return get.subtype(card) == subtype && player.getUseValue(card) >= eff1;
					}) > 0
				);
			}
			return true;
		},
		async content(event, trigger, player) {
			let cards = trigger.cards.filterInD();
			if (cards.length > 1) {
				const result = await player
					.chooseToMove("恃才：将牌按顺序置于牌堆顶", true)
					.set("list", [["牌堆顶", cards]])
					.set("reverse", _status.currentPhase?.next && get.attitude(player, _status.currentPhase.next) > 0)
					.set("processAI", function (list) {
						const cards = list[0][1].slice(0);
						cards.sort(function (a, b) {
							return (_status.event.reverse ? 1 : -1) * (get.value(b) - get.value(a));
						});
						return [cards];
					})
					.forResult();
				if (!result.bool) {
					return;
				}
				cards = result.moved[0];
			}
			cards.reverse();
			await game.cardsGotoPile(cards, "insert");
			game.log(player, "将", cards, "置于了牌堆顶");
			await player.draw();
		},
		subSkill: { 2: { audio: 2 } },
		ai: {
			reverseOrder: true,
			skillTagFilter(player) {
				if (
					player.getHistory("useCard", function (evt) {
						return get.type(evt.card) == "equip";
					}).length > 0
				) {
					return false;
				}
			},
			effect: {
				target_use(card, player, target) {
					if (
						player == target &&
						get.type(card) == "equip" &&
						!player.getHistory("useCard", function (evt) {
							return get.type(evt.card) == "equip";
						}).length
					) {
						return [1, 3];
					}
				},
			},
		},
	},
	nzry_cunmu: {
		audio: 2,
		audioname: ["ol_pengyang"],
		trigger: {
			player: "drawBegin",
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.bottom = true;
		},
		ai: {
			abnormalDraw: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "abnormalDraw") {
					return !arg || arg === "bottom";
				}
			},
		},
	},
	nzry_mingren: {
		audio: "nzry_mingren_1",
		drawNum: 2,
		audioname: ["sb_yl_luzhi"],
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && !player.getExpansions("nzry_mingren").length;
		},
		async content(event, trigger, player) {
			await player.draw(get.info(event.name).drawNum || 2);
			if (!player.countCards("h")) {
				return;
			}
			const result = await player
				.chooseCard("h", "将一张手牌置于武将牌上，称为“任”", true)
				.set("ai", function (card) {
					return 6 - get.value(card);
				})
				.forResult();
			if (result.bool) {
				const next = player.addToExpansion(result.cards[0], player, "give", "log");
				next.gaintag.add("nzry_mingren");
				await next;
			}
		},
		marktext: "任",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: ["nzry_mingren_1"],
		ai: { notemp: true },
		subSkill: {
			1: {
				audio: 2,
				audioname: ["sb_yl_luzhi"],
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return player.countCards("h") > 0 && player.getExpansions("nzry_mingren").length > 0;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseCard("h", get.prompt(event.skill), "选择一张手牌替换“任”（" + get.translation(player.getExpansions("nzry_mingren")[0]) + "）")
						.set("ai", function (card) {
							const player = _status.event.player;
							const color = get.color(card);
							if (color == get.color(player.getExpansions("nzry_mingren")[0])) {
								return false;
							}
							let num = 0;
							const list = [];
							player.countCards("h", function (cardx) {
								if (cardx != card || get.color(cardx) != color) {
									return false;
								}
								if (list.includes(cardx.name)) {
									return false;
								}
								list.push(cardx.name);
								switch (cardx.name) {
									case "wuxie":
										num += game.countPlayer() / 2.2;
										break;
									case "caochuan":
										num += 1.1;
										break;
									case "shan":
										num += 1;
										break;
								}
							});
							return num * (30 - get.value(card));
						})
						.forResult();
				},
				async content(event, trigger, player) {
					// 考虑到getExpansions的实际执行在addToExpansion之前喵，此处调换顺序
					const card = player.getExpansions("nzry_mingren")[0];
					const next = player.addToExpansion(event.cards[0], "log", "give", player);
					next.gaintag.add("nzry_mingren");
					await next;
					if (card) {
						await player.gain(card, "gain2");
					}
				},
			},
		},
	},
	nzry_zhenliang: {
		audio: ["nzry_zhenliang_11.mp3", "nzry_zhenliang_12.mp3"],
		drawNum: 1,
		mark: true,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage) {
				if (storage) {
					return "当你于回合外使用或打出的牌结算完成后，若此牌与“任”颜色相同，则你可以令一名角色摸一张牌。";
				}
				return "出牌阶段限一次，你可以弃置一张与“任”颜色相同的牌并对攻击范围内的一名角色造成1点伤害。";
			},
		},
		enable: "phaseUse",
		trigger: {
			player: ["useCardAfter", "respondAfter"],
		},
		filter(event, player) {
			const cards = player.getExpansions("nzry_mingren");
			if (!cards.length) {
				return false;
			}
			if (event.name == "chooseToUse") {
				if (player.storage.nzry_zhenliang || player.hasSkill("nzry_zhenliang_used", null, null, false)) {
					return false;
				}
				const color = get.color(cards[0]);
				if (!player.countCards("he", card => get.color(card) == color)) {
					return false;
				}
				return game.hasPlayer(current => player.inRange(current));
			} else {
				if (_status.currentPhase == player || !player.storage.nzry_zhenliang) {
					return false;
				}
				return get.color(event.card) == get.color(cards[0]);
			}
		},
		position: "he",
		filterCard(card, player) {
			return get.color(card) == get.color(player.getExpansions("nzry_mingren")[0]);
		},
		filterTarget(card, player, target) {
			return player.inRange(target);
		},
		check(card) {
			return 6.5 - get.value(card);
		},
		prompt: "弃置一张与“任”颜色相同的牌，并对攻击范围内的一名角色造成1点伤害。",
		async cost(event, trigger, player) {
			const skillName = event.name.slice(0, -5),
				num = get.info(skillName).drawNum;
			event.result = await player
				.chooseTarget(get.prompt(skillName), `令${(num > 1 ? "至多" : "") + get.cnNumber(num)}名角色${num > 1 ? "各" : ""}摸${get.cnNumber(num)}张牌`)
				.set("selectTarget", [1, num])
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "draw" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const skill = event.name;
			player.changeZhuanhuanji(skill);
			if (!trigger) {
				const target = event.target;
				player.addTempSkill(skill + "_used", "phaseUseAfter");
				await target.damage("nocard");
			} else {
				const targets = event.targets;
				if (targets.length === 1) {
					await targets[0].draw(get.info(skill).drawNum);
				} else {
					await game.asyncDraw(targets, get.info(skill).drawNum);
					await game.delayx();
				}
			}
		},
		ai: {
			order: 5,
			result: {
				player(player, target) {
					return get.damageEffect(target, player, player);
				},
			},
			combo: "nzry_mingren",
		},
		subSkill: { used: { charlotte: true } },
	},
	nzry_jianxiang: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return event.player != player && game.hasPlayer(current => current.isMinHandcard());
		},
		async cost(event, trigger, player) {
			const next = player.chooseTarget(get.prompt(event.skill), "令场上手牌数最少的一名角色摸一张牌", function (card, player, target) {
				return target.isMinHandcard();
			});
			next.ai = function (target) {
				const player = get.player();
				return get.attitude(player, target);
			};
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			await event.targets[0].draw();
		},
	},
};
