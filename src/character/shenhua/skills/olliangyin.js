import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olliangyin" | "olkongsheng">} */
export const groupSkills = {
	//周妃
	olliangyin: {
		audio: "liangyin",
		trigger: {
			global: ["loseAfter", "addToExpansionAfter", "cardsGotoSpecialAfter", "loseAsyncAfter"],
		},
		filter(event, player, name) {
			if (event.name == "lose" || event.name == "loseAsync") {
				return event.getlx !== false && event.toStorage == true;
			}
			if (event.name == "cardsGotoSpecial") {
				return !event.notrigger;
			}
			return true;
		},
		usable: 1,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "选择一名其他角色，你与其各摸一张牌", lib.filter.notMe)
				.set("ai", function (target) {
					const player = _status.event.player,
						num = player.getExpansions("olkongsheng").length - 1;
					const att = get.attitude(player, target);
					if (att <= 0) {
						return 0;
					}
					if (target.countCards("h") == num && target.isDamaged() && get.recoverEffect(target, player, player) > 0) {
						return 3 * att;
					}
					return att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await game.asyncDraw([player, target].sortBySeat());
			await game.delayx();
			let num = player.getExpansions("olkongsheng").length;
			let check = player => {
				if (!player.isIn() || player.isHealthy()) {
					return false;
				}
				return player.countCards("h") == num;
			};
			if (check(player) || check(target)) {
				const choiceList = ["令自己回复1点体力", "令" + get.translation(target) + "回复1点体力"];
				const choices = [];
				if (check(player)) {
					choices.push("选项一");
				} else {
					choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
				}
				if (check(target)) {
					choices.push("选项二");
				} else {
					choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
				}
				choices.push("cancel2");
				const { control } = await player
					.chooseControl(choices)
					.set("choiceList", choiceList)
					.set("prompt", "良姻：是否令一名角色回复体力？")
					.set("ai", function () {
						const player = _status.event.player,
							target = _status.event.getParent().targets[0];
						let list = _status.event.controls.slice(0),
							eff1 = 0,
							eff2 = 0;
						if (list.includes("选项一")) {
							eff1 = get.recoverEffect(player, player, player);
						}
						if (list.includes("选项二")) {
							eff2 = get.recoverEffect(target, player, player);
						}
						if (eff1 > Math.max(0, eff2)) {
							return "选项一";
						}
						if (eff2 > 0) {
							return "选项二";
						}
						return "cancel2";
					})
					.forResult();
				if (control == "选项一") {
					await player.recover();
				} else if (control == "选项二") {
					await target.recover();
				}
			}
		},
		group: "olliangyin_gain",
		subSkill: {
			gain: {
				audio: "liangyin",
				trigger: {
					global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					return game.hasPlayer(function (current) {
						const evt = event.getl(current);
						return evt && (evt.xs.length > 0 || evt.ss.length > 0);
					});
				},
				usable: 1,
				async cost(event, trigger, player) {
					if (!player.countCards("he") || !game.hasPlayer(current => current != player && current.countCards("he") > 0)) {
						return;
					}
					event.result = await player
						.chooseCardTarget({
							prompt: get.prompt("olliangyin"),
							prompt2: "弃置一张牌，并令一名其他角色也弃置一张牌",
							position: "he",
							filterCard: lib.filter.cardDiscardable,
							filterTarget(card, player, target) {
								return target != player && target.countCards("he") > 0;
							},
							ai1(card) {
								let player = _status.event.player;
								if (_status.event.me) {
									if (get.position(card) === _status.event.me) {
										return 12 - player.hp - get.value(card);
									}
									return 0;
								}
								return 5 - get.value(card);
							},
							ai2(target) {
								let player = _status.event.player,
									att = get.attitude(player, target);
								if (att > 0 && (_status.event.me || target.isHealthy())) {
									return -att;
								}
								if (
									att > 0 &&
									(target.countCards("he") > target.hp ||
										target.hasCard(function (card) {
											return get.value(card, target) <= 0;
										}, "e"))
								) {
									return att;
								}
								return -att;
							},
							me: (() => {
								if (player.isHealthy() || get.recoverEffect(player, player, _status.event.player) <= 0) {
									return false;
								}
								let ph = player.countCards("h"),
									num = player.getExpansions("olkongsheng").length;
								if (ph === num) {
									if (player.hasSkillTag("noh")) {
										return "h";
									}
									return "e";
								}
								if (ph - 1 === num) {
									return "h";
								}
								return false;
							})(),
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					await player.discard(event.cards);
					await target.chooseToDiscard("he", true);
					await game.delayx();
					const num = player.getExpansions("olkongsheng").length;
					const check = player => {
						if (!player.isIn() || player.isHealthy()) {
							return false;
						}
						return player.countCards("h") == num;
					};
					if (check(player) || check(target)) {
						const choiceList = ["令自己回复1点体力", "令" + get.translation(target) + "回复1点体力"];
						const choices = [];
						if (check(player)) {
							choices.push("选项一");
						} else {
							choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
						}
						if (check(target)) {
							choices.push("选项二");
						} else {
							choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
						}
						choices.push("cancel2");
						const { control } = await player
							.chooseControl(choices)
							.set("choiceList", choiceList)
							.set("prompt", "良姻：是否令一名角色回复体力？")
							.set("ai", function () {
								const player = _status.event.player,
									target = _status.event.getParent().targets[0];
								let list = _status.event.controls.slice(0),
									eff1 = 0,
									eff2 = 0;
								if (list.includes("选项一")) {
									eff1 = get.recoverEffect(player, player, player);
								}
								if (list.includes("选项二")) {
									eff2 = get.recoverEffect(target, player, player);
								}
								if (eff1 > Math.max(0, eff2)) {
									return "选项一";
								}
								if (eff2 > 0) {
									return "选项二";
								}
								return "cancel2";
							})
							.forResult();
						if (control == "选项一") {
							await player.recover();
						} else if (control == "选项二") {
							await target.recover();
						}
					}
				},
			},
		},
	},
	olkongsheng: {
		audio: "kongsheng",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard("he", [1, player.countCards("he")], get.prompt(event.skill), "将任意张牌作为“箜”置于武将牌上", "allowChooseAll")
				.set("ai", function (card) {
					const player = _status.event.player,
						num = player.getExpansions("olkongsheng") + ui.selected.cards.length;
					if (
						ui.selected.cards.length > 0 &&
						game.hasPlayer(function (current) {
							if (current.isHealthy() || get.recoverEffect(current, player, player) <= 0) {
								return false;
							}
							const num2 =
								current.countCards("h", function (card) {
									if (current != player) {
										return true;
									}
									return !ui.selected.cards.includes(card);
								}) + 1;
							return num == num2;
						})
					) {
						return 0;
					}
					if (get.type(card, null, false) == "equip") {
						for (const i of ui.selected.cards) {
							if (get.type(i, null, false) == "equip") {
								return 0;
							}
						}
						return 5 - get.value(card);
					}
					if (!player.hasValueTarget(card)) {
						return 1;
					}
					return 0;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const next = player.addToExpansion(event.cards, player, "give");
			next.gaintag.add("olkongsheng");
			await next;
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		group: "olkongsheng_kessoku",
		subSkill: {
			kessoku: {
				audio: "kongsheng",
				trigger: { player: "phaseJieshuBegin" },
				forced: true,
				locked: false,
				filter(event, player) {
					return (
						player.getExpansions("olkongsheng").filter(function (card) {
							return get.type(card, null, false) != "equip";
						}).length > 0
					);
				},
				async content(event, trigger, player) {
					let cards = player.getExpansions("olkongsheng").filter(function (card) {
						return get.type(card, null, false) != "equip";
					});
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
					cards = player.getExpansions("olkongsheng");
					if (cards.length <= 0) {
						return;
					}
					const result = await player
						.chooseTarget(true, "令一名角色使用以下装备牌", get.translation(cards))
						.set("ai", function (target) {
							const player = _status.event.player;
							return get.effect(target, { name: "losehp" }, player, player);
						})
						.forResult();
					const target = result.targets[0];
					player.line(target, "green");
					while (true) {
						const cards = player.getExpansions("olkongsheng").filter(function (i) {
							return target.hasUseTarget(i);
						});
						if (cards.length) {
							let card = cards[0];
							if (cards.length > 1) {
								const result = await target
									.chooseButton(true, ["选择要使用的装备牌", cards])
									.set("ai", function (button) {
										return get.order(button.link);
									})
									.forResult();
								if (!result.bool) {
									break;
								}
								card = result.links[0];
							}
							await target.chooseUseTarget(card, true);
						} else {
							break;
						}
					}
					await target.loseHp();
				},
			},
		},
	},
};
