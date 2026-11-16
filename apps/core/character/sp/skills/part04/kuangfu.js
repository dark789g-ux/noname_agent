import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "kuangfu" | "xinfu_lingren" | "lingren_jianxiong" | "lingren_xingshang" | "xinfu_fujian" | "olfujian" | "xinfu_xionghuo" | "xinfu_shajue" | "xinfu_jianjie">} */
export const groupSkills = {
	kuangfu: {
		trigger: { source: "damageSource" },
		audio: 2,
		filter(event) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.card && event.card.name == "sha" && event.player.countCards("e");
		},
		logTarget: "player",
		preHidden: true,
		check(event, player) {
			return get.attitude(player, event.player) <= 0;
		},
		content() {
			"step 0";
			var neg = get.attitude(player, trigger.player) <= 0;
			player
				.choosePlayerCard("e", trigger.player)
				.set("ai", function (button) {
					if (_status.event.neg) {
						return get.buttonValue(button);
					}
					return 0;
				})
				.set("neg", neg);
			"step 1";
			if (result.bool) {
				event.card = result.links[0];
				if (player.canEquip(event.card)) {
					player.chooseBool("是否将" + get.translation(event.card) + "置入自己的装备区？").ai = function () {
						return true;
					};
				} else {
					event._result = { bool: false };
				}
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				trigger.player.$give(event.card, player, false);
				player.equip(event.card);
			} else {
				trigger.player.discard(event.card);
			}
		},
	},
	xinfu_lingren: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!player.isPhaseUsing() || player.hasSkill("xinfu_lingren_used") || !event.isFirstTarget) {
				return false;
			}
			return event.card.name === "sha" && (get.type(event.card) === "trick" || get.tag(event.card, "damage"));
		},
		derivation: ["new_rejianxiong", "rexingshang"],
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.name.slice(0, -5)), "选择一名目标角色并猜测其手牌构成", (card, player, target) => {
					return _status.event.targets.includes(target);
				})
				.set("ai", target => {
					return 2 - get.attitude(get.player(), target);
				})
				.set("targets", trigger.targets)
				.forResult();
		},
		async content(event, trigger, player) {
			player.addTempSkill("xinfu_lingren_used", { player: "phaseUseAfter" });
			const {
				targets: [target],
			} = event;
			const list = ["basic", "trick", "equip"].map(type => ["", "", "caoying_" + type]);
			const result = await player
				.chooseButton(["凌人：猜测其有哪些类别的手牌", [list, "vcard"]], [0, 3], true)
				.set("ai", button => {
					return get.event().choice.includes(button.link[2].slice(8));
				})
				.set(
					"choice",
					(() => {
						if (!target.countCards("h")) {
							return [];
						}
						let choice = [],
							known = target.getKnownCards(player),
							unknown = target.getCards("h", i => !known.includes(i));
						for (let i of known) {
							choice.add(get.type2(i, target));
						}
						if (!unknown.length || choice.length > 2) {
							return choice;
						}
						let rand = 0.05;
						if (!choice.includes("basic")) {
							if (unknown.some(i => get.type(i, null, target) === "basic")) {
								rand = 0.95;
							}
							if (Math.random() < rand) {
								choice.push("basic");
							}
						}
						if (!choice.includes("trick")) {
							if (unknown.some(i => get.type(i, "trick", target) === "trick")) {
								rand = 0.9;
							} else {
								rand = 0.1;
							}
							if (Math.random() < rand) {
								choice.push("trick");
							}
						}
						if (!choice.includes("equip")) {
							if (unknown.some(i => get.type(i, null, target) === "equip")) {
								rand = 0.75;
							} else {
								rand = 0.25;
							}
							if (Math.random() < rand) {
								choice.push("equip");
							}
						}
						return choice;
					})()
				)
				.forResult();
			if (!result?.bool) {
				return;
			}
			const choices = result.links.map(i => i[2].slice(8));
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			let num = 0;
			["basic", "trick", "equip"].forEach(type => {
				if (choices.includes(type) == target.hasCard(card => get.type2(card, target) === type, "h")) {
					num++;
				}
			});
			player.popup("猜对" + get.cnNumber(num) + "项");
			game.log(player, "猜对了" + get.cnNumber(num) + "项");
			if (num > 0) {
				const map = trigger.customArgs;
				const id = target.playerid;
				map[id] ??= {};
				if (typeof map[id].extraDamage != "number") {
					map[id].extraDamage = 0;
				}
				map[id].extraDamage++;
			}
			if (num > 1) {
				await player.draw(2);
			}
			if (num > 2) {
				await player.addTempSkills(get.info(event.name).derivation, { player: "phaseBegin" });
			}
		},
		ai: { threaten: 2.4 },
		subSkill: { used: { charlotte: true } },
	},
	lingren_jianxiong: { audio: 1 },
	lingren_xingshang: { audio: 1 },
	xinfu_fujian: {
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			return !game.hasPlayer(function (current) {
				return current.countCards("h") == 0;
			});
		},
		forced: true,
		content() {
			event.num = 0;
			var list = game.filterPlayer(function (target) {
				if (target.isMinHandcard()) {
					event.num = target.countCards("h");
				}
				return player != target;
			});
			if (event.num < 1) {
				event.finish();
			} else {
				var target = list.randomGet();
				var cards = target.getCards("h").randomGets(event.num);
				player.line(target);
				var content = [get.translation(target) + "的部分手牌", cards];
				game.log(player, "观看了", target, "的部分手牌");
				player.chooseControl("ok").set("dialog", content);
			}
		},
	},
	olfujian: {
		audio: "xinfu_fujian",
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		filter(event, player) {
			return game.hasPlayer(target => target != player && target.countCards("h"));
		},
		forced: true,
		async content(event, trigger, player) {
			const bool =
				game
					.filterPlayer(current => current != player)
					.map(current => current.countCards("h"))
					.toUniqued().length == 1;
			const targets = game.filterPlayer(target => {
				if (target == player || !target.countCards("h")) {
					return false;
				}
				return bool || !target.isMaxHandcard(null, current => current != player);
			});
			if (!targets?.length) {
				return;
			}
			const target = targets.randomGet();
			player.line(target);
			game.log(player, "观看了", target, "的手牌");
			await player.viewHandcards(target);
		},
	},
	xinfu_xionghuo: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countMark("xinfu_xionghuo") > 0;
		},
		filterTarget(card, player, target) {
			return player != target && !target.hasMark("xinfu_xionghuo");
		},
		content() {
			player.removeMark("xinfu_xionghuo", 1);
			target.addMark("xinfu_xionghuo", 1);
		},
		ai: {
			order: 11,
			result: {
				target(player, target) {
					if (
						(player.countMark("xinfu_xionghuo") >= 2 ||
							!game.hasPlayer(function (current) {
								return current != player && get.attitude(player, current) < 0 && current.hasMark("xinfu_xionghuo");
							})) &&
						player.countCards("h", function (card) {
							return (
								get.tag(card, "damage") &&
								player.canUse(card, target, null, true) &&
								player.getUseValue(card) > 0 &&
								get.effect_use(target, card, player) > 0 &&
								target.hasSkillTag("filterDamage", null, {
									player: player,
									card: card,
								})
							);
						})
					) {
						return 3 / Math.max(1, target.hp);
					}
					if (
						(!player.hasUnknown() &&
							game.countPlayer(function (current) {
								return get.attitude(player, current) < 0;
							}) <= 1) ||
						player.countMark("xinfu_xionghuo") >= 2
					) {
						return -1;
					}
					return 0;
				},
			},
			effect: {
				player(card, player, target) {
					if (
						player != target &&
						get.tag(card, "damage") &&
						target &&
						target.hasMark("xinfu_xionghuo") &&
						!target.hasSkillTag("filterDamage", null, {
							player: player,
							card: card,
						})
					) {
						return [1, 0, 1, -2];
					}
				},
			},
			threaten: 1.6,
		},
		marktext: "戾",
		intro: {
			name: "暴戾",
			content: "mark",
		},
		group: ["xinfu_xionghuo_init", "xinfu_xionghuo_damage", "xinfu_xionghuo_effect"],
		subSkill: {
			init: {
				audio: "xinfu_xionghuo",
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					if (player.countMark("xinfu_xionghuo") >= 3) {
						return false;
					}
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				locked: false,
				content() {
					player.addMark("xinfu_xionghuo", 3 - player.countMark("xinfu_xionghuo"));
				},
			},
			damage: {
				audio: "xinfu_xionghuo",
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return event.player.countMark("xinfu_xionghuo") > 0 && event.player != player;
				},
				forced: true,
				locked: false,
				logTarget: "player",
				content() {
					trigger.num++;
				},
			},
			effect: {
				audio: "xinfu_xionghuo",
				trigger: { global: "phaseUseBegin" },
				filter(event, player) {
					return event.player.countMark("xinfu_xionghuo") > 0 && event.player != player;
				},
				line: false,
				forced: true,
				locked: false,
				logTarget: "player",
				content() {
					"step 0";
					trigger.player.removeMark("xinfu_xionghuo", trigger.player.countMark("xinfu_xionghuo"));
					"step 1";
					var num = get.rand(0, 2);
					switch (num) {
						case 0: {
							player.line(trigger.player, "fire");
							trigger.player.damage("fire");
							trigger.player.addTempSkill("xinfu_xionghuo_disable");
							trigger.player.markAuto("xinfu_xionghuo_disable", [player]);
							break;
						}
						case 1: {
							player.line(trigger.player, "water");
							trigger.player.loseHp();
							trigger.player.addMark("xinfu_xionghuo_low", 1, false);
							trigger.player.addTempSkill("xinfu_xionghuo_low");
							break;
						}
						case 2: {
							player.line(trigger.player, "green");
							/*
							var card1=trigger.player.getCards('h').randomGet();
							var card2=trigger.player.getCards('e').randomGet();
							var list=[];
							if(card1) list.push(card1);
							if(card2) list.push(card2);
							if(list.length) player.gain(list,trigger.player,'giveAuto','bySelf');
							*/
							const cards = trigger.player.getGainableCards(player, "he");
							if (cards.length) {
								player.gain(cards.randomGets(2), trigger.player, "giveAuto", "bySelf");
							}
							break;
						}
					}
					"step 2";
					game.delay();
				},
			},
			disable: {
				mod: {
					playerEnabled(card, player, target) {
						if (card.name == "sha" && player.getStorage("xinfu_xionghuo_disable").includes(target)) {
							return false;
						}
					},
				},
				charlotte: true,
				onremove: true,
				mark: true,
				marktext: "禁",
				intro: { content: "不能对$使用【杀】" },
			},
			low: {
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("xinfu_xionghuo_low");
					},
				},
				charlotte: true,
				onremove: true,
				mark: true,
				marktext: "减",
				intro: { content: "手牌上限-#" },
			},
		},
	},
	xinfu_shajue: {
		audio: 2,
		trigger: { global: "dying" },
		filter(event, player) {
			if (event.player == player) {
				return false;
			}
			const bool1 = !player.hasSkill("xinfu_xionghuo") || player.countMark("xinfu_xionghuo") < 3;
			const bool2 = event.player.hp < 0 && get.itemtype(event.parent.cards) == "cards" && event.parent.cards.some(card => get.position(card, true) == "o");
			return bool1 || bool2;
		},
		forced: true,
		content() {
			if (!player.hasSkill("xinfu_xionghuo") || player.countMark("xinfu_xionghuo") < 3) {
				player.addMark("xinfu_xionghuo", 1);
			}
			if (trigger.player.hp < 0 && get.itemtype(trigger.parent.cards) == "cards" && trigger.parent.cards.some(card => get.position(card, true) == "o")) {
				player.gain(
					trigger.parent.cards.filter(card => get.position(card, true) == "o"),
					"gain2"
				);
			}
		},
		ai: {
			combo: "xinfu_xionghuo",
		},
	},
	xinfu_jianjie: { audio: 3 },
};
