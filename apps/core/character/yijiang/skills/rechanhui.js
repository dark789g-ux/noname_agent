import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "rechanhui" | "rejiaojin" | "chanhui2" | "quanji" | "zili" | "paiyi" | "xianzhou" | "qieting" | "oldzhuikong">} */
export const groupSkills = {
	rechanhui: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			if (event.targets.length > 1) {
				return false;
			}
			var card = event.card;
			if (card.name == "sha" || get.type(card) == "trick") {
				return true;
			}
			return false;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("rechanhui"),
					filterTarget(card, player, target) {
						if (player === target) {
							return false;
						}
						const trigger = get.event();
						return player.canUse(trigger.card, target, false) && !trigger.targets.includes(target);
					},
					ai(target) {
						const trigger = get.event().getTrigger();
						const player = get.player();
						return get.effect(target, trigger.card, player, player) + 0.01;
					},
				})
				.set("targets", trigger.targets)
				.set("card", trigger.card)
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const result = await target
				.chooseCard({
					prompt: `交给${get.translation(player)}一张牌，或成为${get.translation(trigger.card)}的额外目标`,
					position: "he",
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
				return;
			}
			game.log(target, "成为了", trigger.card, "的额外目标");
			trigger.getParent().targets.push(target);
			player.tempBanSkill("rechanhui");
		},
	},
	rejiaojin: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return (event.card.name === "sha" || get.type(event.card) === "trick") && event.player !== player && player.hasCard(card => _status.connectMode || get.type(card) == "equip", "he");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard({
					prompt: "骄矜：是否弃置一张装备牌令" + get.translation(trigger.card) + "对你无效？",
					filterCard(card) {
						return get.type(card) === "equip";
					},
					position: "he",
					ai(card) {
						const { goon2, val } = get.event();
						if (goon2) {
							return 3 + val - get.value(card);
						}
						return 0;
					},
				})
				.set("val", get.value(trigger.cards.filterInD()))
				.set("goon2", get.effect(player, trigger.card, trigger.player, player) < 0)
				.set("chooseonly", true)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.discard({
				cards: event.cards,
				discarder: player,
			});
			const cards = trigger.cards.filterInD();
			if (cards.length) {
				await player.gain({
					cards,
					animate: "gain2",
					log: true,
				});
			}
			trigger.excluded.push(player);
			if (trigger.player.hasSex("female")) {
				player.tempBanSkill("rejiaojin");
			}
		},
	},
	chanhui2: {},
	quanji: {
		audio: 2,
		trigger: { player: "damageEnd" },
		frequent: true,
		locked: false,
		filter(event) {
			return event.num > 0;
		},
		getIndex: event => event.num,
		async content(event, trigger, player) {
			await player.draw();
			const hs = player.getCards("h");
			if (!hs.length) {
				return;
			}
			const result = hs.length == 1 ? { bool: true, cards: hs } : await player.chooseCard("h", true, "选择一张牌作为“权”").forResult();
			if (result?.bool && result?.cards?.length) {
				const next = player.addToExpansion(result.cards, player, "give");
				next.gaintag.add(event.name);
				await next;
			}
		},
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
		mod: {
			maxHandcard(player, num) {
				return num + player.getExpansions("quanji").length;
			},
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			notemp: true,
			threaten: 0.8,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage") && (player.hasSkill("paiyi") || player.hasSkill("zili"))) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						if (target.hp >= 4) {
							return [0.5, get.tag(card, "damage") * 2];
						}
						if (!target.hasSkill("paiyi") && target.hp > 1) {
							return [0.5, get.tag(card, "damage") * 1.5];
						}
						if (target.hp == 3) {
							return [0.5, get.tag(card, "damage") * 1.5];
						}
						if (target.hp == 2) {
							return [1, get.tag(card, "damage") * 0.5];
						}
					}
				},
			},
		},
	},
	zili: {
		skillAnimation: true,
		animationColor: "thunder",
		audio: 2,
		audioname: ["re_zhonghui"],
		juexingji: true,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		derivation: "paiyi",
		filter(event, player) {
			return player.countExpansions("quanji") >= 3;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp();
			await player.chooseDrawRecover(2, true, (event, player) => {
				if (player.hp == 1 && player.isDamaged()) {
					return "recover_hp";
				}
				return "draw_card";
			});
			await player.addSkills("paiyi");
		},
		ai: { combo: "quanji" },
	},
	paiyi: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		audioname: ["re_zhonghui"],
		filter(event, player) {
			return player.getExpansions("quanji").length > 0;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("排异", player.getExpansions("quanji"), "hidden");
			},
			backup(links, player) {
				return {
					audio: "paiyi",
					audioname: ["re_zhonghui"],
					filterTarget: true,
					filterCard() {
						return false;
					},
					selectCard: -1,
					card: links[0],
					delay: false,
					content: lib.skill.paiyi.contentx,
					ai: {
						order: 10,
						result: {
							target(player, target) {
								if (player != target) {
									return 0;
								}
								if (player.hasSkill("requanji") || player.countCards("h") + 2 <= player.hp + player.getExpansions("quanji").length) {
									return 1;
								}
								return 0;
							},
						},
					},
				};
			},
			prompt() {
				return "请选择〖排异〗的目标";
			},
		},
		async contentx(event, trigger, player) {
			const { target } = event;
			const card = lib.skill.paiyi_backup.card;
			await player.loseToDiscardpile(card);
			await target.draw(2);
			if (target.countCards("h") > player.countCards("h")) {
				await target.damage();
			}
		},
		ai: {
			order: 1,
			combo: "quanji",
			result: {
				player: 1,
			},
		},
	},
	xianzhou: {
		skillAnimation: true,
		animationColor: "gray",
		audio: 2,
		audioname: ["xin_caifuren", "ol_caifuren"],
		limited: true,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("e") > 0;
		},
		filterTarget(card, player, target) {
			return player != target;
		},
		delay: false,
		async content(event, trigger, player) {
			const cards = player.getCards("e");
			const target = event.target;
			const num = cards.length;
			player.awakenSkill(event.name);
			await player.give(cards, target);
			await game.delay();

			const result = await target
				.chooseTarget({
					prompt: "令" + get.translation(player) + "回复" + num + "点体力，或对攻击范围内的" + num + "名角色造成1点伤害",
					filterTarget(card, player, target2) {
						return _status.event.player.inRange(target2);
					},
					selectTarget: [1, num],
					ai(target2) {
						const target = _status.event.player;
						const player = _status.event.getParent().player;
						if (get.attitude(target, player) > 0) {
							if (player.hp + num <= player.maxHp || player.hp == 1) {
								return -1;
							}
						}
						return get.damageEffect(target2, target, target);
					},
				})
				.forResult();
			if (!result.bool) {
				await player.recover({
					num,
					source: target,
				});
				return;
			}
			target.line(result.targets, "green");
			for (const targetx of result.targets) {
				await targetx.damage({ source: target });
			}
		},
		ai: {
			order: 1,
			result: {
				target: 1,
				player(player) {
					var bool = true,
						players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i] != player && get.attitude(player, players[i]) > 2 && get.attitude(players[i], player) > 2) {
							bool = false;
							break;
						}
					}
					if (bool) {
						return -10;
					}
					if (player.hp == 1) {
						return 1;
					}
					if (game.phaseNumber < game.players.length) {
						return -10;
					}
					if (player.countCards("e") + player.hp <= player.maxHp) {
						return 1;
					}
					return -10;
				},
			},
		},
	},
	qieting: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			if (event.player == player || !event.player.isIn()) {
				return false;
			}
			var history = event.player.getHistory("useCard");
			for (var i = 0; i < history.length; i++) {
				if (!history[i].targets) {
					continue;
				}
				for (var j = 0; j < history[i].targets.length; j++) {
					if (history[i].targets[j] != event.player) {
						return false;
					}
				}
			}
			return true;
		},
		direct: true,
		async content(event, trigger, player) {
			let result;
			if (trigger.player.hasCard(card => player.canEquip(card), "e")) {
				result = await player
					.chooseControl({
						prompt: get.prompt("qieting", trigger.player),
						controls: ["移动装备", "draw_card", "cancel2"],
						ai(event, player) {
							const source = _status.event.sourcex;
							const att = get.attitude(player, source);
							if (source.hasSkillTag("noe")) {
								if (att > 0) {
									return "移动装备";
								}
							} else {
								if (att <= 0 && source.countCards("e", card => get.value(card, source) > 0 && get.effect(player, card, player, player) > 0)) {
									return "移动装备";
								}
							}
							return "draw_card";
						},
					})
					.set("sourcex", trigger.player)
					.forResult();
			} else {
				result = await player
					.chooseControl({
						prompt: get.prompt("qieting", trigger.player),
						controls: ["draw_card", "cancel2"],
						ai() {
							return "draw_card";
						},
					})
					.forResult();
			}
			if (result.control != "移动装备") {
				if (result.control == "draw_card") {
					player.logSkill("qieting");
					await player.draw();
				}
				return;
			}
			player.logSkill("qieting", trigger.player);
			result = await player
				.choosePlayerCard({
					prompt: "将一张装备牌移至你的装备区",
					target: trigger.player,
					filterButton(button) {
						return _status.event.player.canEquip(button.link);
					},
					position: "e",
					forced: true,
					ai(button) {
						return get.effect(player, button.link, player, player);
					},
				})
				.forResult();
			if (!result || !result.links || !result.links.length) {
				return;
			}
			await game.delay(2);
			trigger.player.$give(result.links[0], player, false);
			await player.equip(result.links[0]);
			player.addExpose(0.2);
		},
	},
	oldzhuikong: {
		audio: "zhuikong",
		inherit: "zhuikong",
	},
};
