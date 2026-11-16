import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "daiyan" | "fumian" | "zhongjian" | "caishi" | "ttt">} */
export const groupSkills = {
	daiyan: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		init() {
			lib.onwash.push(() => void Reflect.deleteProperty(_status, "daiyan_notao"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("daiyan"),
					filterTarget: lib.filter.notMe,
					ai(target) {
						const player = _status.event.player;
						const att = get.attitude(player, target);
						if (att > 0) {
							if (Reflect.has(_status, "daiyan_notao")) {
								return 0;
							}
							if (target === player.storage.daiyan) {
								return 0;
							}
							return (2 * att) / Math.sqrt(1 + target.hp);
						}
						if (Reflect.has(_status, "daiyan_notao")) {
							if (target === player.storage.daiyan) {
								return -3 * att;
							}
							return -att;
						}
						return 0;
					},
				})
				.forResult();

			if (!event.result.bool) {
				delete player.storage.daiyan;
			}
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const tao = get.cardPile2(card => get.suit(card) === "heart" && get.type(card) === "basic");
			if (tao) {
				await target.gain({
					cards: [tao],
					animate: "gain2",
				});
			} else {
				Reflect.set(_status, "daiyan_notao", true);
			}
			if (target === player.storage.daiyan) {
				await target.loseHp();
			}
			player.storage.daiyan = target;
		},
		ai: {
			threaten: 1.5,
			expose: 0.2,
		},
	},
	fumian: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		async cost(event, trigger, player) {
			const choices = ["摸牌阶段多摸一张牌", "使用红色牌可以多选择一个目标（限一次）"];
			let ai = (event, player) => {
				if (player.hp == 1 || player.countCards("h") < player.hp) {
					return 0;
				}
				return 1;
			};
			switch (player.storage.fumian_choice) {
				case "red":
					choices[0] = "摸牌阶段多摸两张牌";
					ai = () => 0;
					break;
				case "draw":
					choices[1] = "使用红色牌可以多选择两个目标（限一次）";
					ai = (event, player) => {
						if (player.hp == 1 || player.countCards("h") <= 1) {
							return 0;
						}
						return 1;
					};
					break;
			}

			const result = await player
				.chooseControlList({
					prompt: get.prompt("fumian"),
					list: choices,
					ai,
				})
				.forResult();

			event.result = {
				bool: result.control !== "cancel2",
				cost_data: {
					index: result.index,
					choice: result.index === 0 ? "draw" : "red",
				},
			};
		},
		async content(event, trigger, player) {
			const { index, choice } = event.cost_data;

			let draw = 1;
			let red = 2;
			if (player.storage.fumian_choice !== choice) {
				const last = player.storage.fumian_choice;
				delete player.storage.fumian_choice;
				switch (last) {
					case "draw":
						red = 2;
						break;
					case "red":
						draw = 2;
						break;
					default:
						player.storage.fumian_choice = choice;
						break;
				}
			}

			if (index === 0) {
				player.storage.fumian_draw = draw;
				player.addTempSkill("fumian_draw");
			} else {
				player.storage.fumian_red = red;
				player.addTempSkill("fumian_red");
			}
		},
		ai: {
			threaten: 1.3,
		},
		subSkill: {
			draw: {
				trigger: { player: "phaseDrawBegin2" },
				forced: true,
				popup: false,
				onremove: true,
				filter(event, player) {
					return !event.numFixed && typeof player.storage.fumian_draw == "number";
				},
				async content(event, trigger, player) {
					trigger.num += player.storage.fumian_draw;
				},
			},
			red2: {},
			red: {
				trigger: { player: "useCard2" },
				mark: true,
				onremove: true,
				intro: {
					content: "你使用红色牌可以多选择#个目标（限一次）",
				},
				filter(event, player) {
					if (get.color(event.card) != "red") {
						return false;
					}
					if (player.hasSkill("fumian_red2")) {
						return false;
					}
					var info = get.info(event.card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						if (
							game.hasPlayer(function (current) {
								return lib.filter.targetEnabled2(event.card, player, current) && !event.targets.includes(current);
							})
						) {
							return true;
						}
					}
					return false;
				},
				async cost(event, trigger, player) {
					const prompt2 = `额外指定${player.storage.fumian_red === 2 ? "至多两" : "一"}名${get.translation(trigger.card)}的目标`;
					event.result = await player
						.chooseTarget({
							prompt: get.prompt("fumian"),
							prompt2,
							filterTarget(card, player, target) {
								const event = get.event();
								if (event.targets.includes(target)) {
									return false;
								}
								return lib.filter.targetEnabled2(event.card, player, target);
							},
							selectTarget: [1, player.storage.fumian_red],
							ai(target) {
								const event = get.event();
								const trigger = event.getTrigger();
								const player = event.player;
								return get.effect(target, trigger.card, player, player);
							},
						})
						.set("targets", trigger.targets)
						.set("card", trigger.card)
						.forResult();
				},
				logTarget: "targets",
				async content(event, trigger, player) {
					if (!event.isMine()) {
						await game.delayx();
					}
					const targets = event.targets;
					if (targets) {
						trigger.targets.addArray(targets);
						player.addTempSkill("fumian_red2");
					}
				},
			},
		},
	},
	zhongjian: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + (player.hasSkill(skill + "_rewrite", null, null, false) ? 1 : 0);
		},
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			return game.hasPlayer(current => current != player && Math.min(current.hp, current.countCards("h")) > 0);
		},
		filterCard: true,
		check() {
			return Math.random();
		},
		discard: false,
		lose: false,
		delay: false,
		filterTarget(card, player, target) {
			return target != player && target.hp > 0 && target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.showCards(cards);
			if (Math.min(target.hp, target.countCards("h")) <= 0) {
				return;
			}
			const result = await player.choosePlayerCard(target, "h", Math.min(target.countCards("h"), target.hp), true).forResult();
			if (!result?.cards?.length) {
				return;
			}
			const hs = result.cards;
			await target.showCards(hs);
			const bool1 = cards.some(card => hs.some(cardx => get.color(cardx) == get.color(card)));
			const bool2 = cards.some(card => hs.some(cardx => get.number(cardx) == get.number(card)));
			if (bool1) {
				const result = !game.hasPlayer(current => current != player && current.countDiscardableCards(player, "he"))
					? { bool: false }
					: await player
							.chooseTarget((card, player, target) => {
								return target != player && target.countDiscardableCards(player, "he");
							}, "弃置一名其他角色的一张牌或摸一张牌")
							.set("ai", target => {
								const player = get.player();
								const att = get.attitude(player, target);
								if (att >= 0) {
									return 0;
								}
								if (target.countCards("he", card => get.value(card) > 5)) {
									return -att;
								}
								return 0;
							})
							.forResult();
				if (result?.targets?.length) {
					const [target] = result.targets;
					player.line(target, "green");
					await player.discardPlayerCard(target, true, "he");
				} else {
					await player.draw();
				}
			}
			if (bool2) {
				player.addTempSkill(event.name + "_rewrite", "phaseUseEnd");
			}
			if (!bool1 && !bool2) {
				player.addSkill(event.name + "_effect");
				player.addMark(event.name + "_effect", 1, false);
				player.popup("杯具");
			}
		},
		ai: {
			order: 8,
			result: {
				player(player, target) {
					return Math.min(target.hp, target.countCards("h"));
				},
			},
		},
		subSkill: {
			rewrite: { charlotte: true },
			effect: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/handcard.png",
				intro: { content: "手牌上限-#" },
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("zhongjian_effect");
					},
				},
			},
		},
	},
	caishi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin" },
		async cost(event, trigger, player) {
			const choices = [];
			const choiceList = ["令自己的手牌上限+1", "回复1点体力，然后本回合你不能对自己使用牌"];
			choices.push("选项一");
			if (player.isDamaged()) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			const result = await player
				.chooseControl(choices, "cancel2")
				.set("choiceList", choiceList)
				.set("prompt", get.prompt(event.skill))
				.set("ai", () => {
					return get.event().choice;
				})
				.set(
					"choice",
					(() => {
						if (player.isDamaged()) {
							if (player.countCards("h", "tao")) {
								return 0;
							}
							if (player.hp < 2) {
								return 1;
							}
							if (
								player.countCards("h", card => {
									const info = get.info(card);
									return info && (info.toself || info.selectTarget == -1) && player.canUse(card, player) && player.getUseValue(card) > 0;
								}) == 0
							) {
								return 1;
							}
						}
						return 0;
					})()
				)
				.forResult();
			event.result = {
				bool: result?.control !== "cancel2",
				cost_data: result?.index,
			};
		},
		async content(event, trigger, player) {
			const index = event.cost_data;
			if (index == 0) {
				player.addSkill(event.name + "_effect");
				player.addMark(event.name + "_effect", 1, false);
			} else if (index == 1) {
				await player.recover();
				player.addTempSkill(event.name + "_buff");
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/handcard.png",
				intro: { content: "手牌上限+#" },
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("caishi_effect");
					},
				},
			},
			buff: {
				charlotte: true,
				mark: true,
				intro: { content: "本回合内不能对自己使用牌" },
				mod: {
					playerEnabled(card, player, target) {
						if (player == target) {
							return false;
						}
					},
				},
			},
		},
	},
	ttt: {
		mod: {
			targetEnabled(card) {
				if (card.name == "tao") {
					return false;
				}
			},
		},
	},
};
