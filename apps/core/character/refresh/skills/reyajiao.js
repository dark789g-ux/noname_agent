import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const reyajiaoSkills = {
	reyajiao: {
		audio: 2,
		trigger: { player: ["respond", "useCard"] },
		frequent: true,
		filter(event, player) {
			return player != _status.currentPhase && get.itemtype(event.cards) == "cards";
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			event.card = get.cards()[0];
			game.broadcast(function (card) {
				ui.arena.classList.add("thrownhighlight");
				card.copy("thrown", "center", "thrownhighlight", ui.arena).addTempClass("start");
			}, event.card);
			event.node = event.card.copy("thrown", "center", "thrownhighlight", ui.arena).addTempClass("start");
			ui.arena.classList.add("thrownhighlight");
			game.addVideo("thrownhighlight1");
			game.addVideo("centernode", null, get.cardInfo(event.card));

			if (get.type(event.card, "trick") == get.type(trigger.card, "trick")) {
				result = await player
					.chooseTarget("选择获得此牌的角色")
					.set("ai", function (target) {
						var att = get.attitude(_status.event.player, target);
						if (_status.event.du) {
							if (target.hasSkillTag("nodu")) {
								return 0;
							}
							return -att;
						}
						if (att > 0) {
							return att + Math.max(0, 5 - target.countCards("h"));
						}
						return att;
					})
					.set("du", event.card.name == "du")
					.forResult();
			} else {
				result = await player.chooseBool("是否弃置" + get.translation(event.card) + "？").forResult();
				event.disbool = true;
			}

			await game.delay(2);

			// step 1
			if (event.disbool) {
				if (!result.bool) {
					game.log(player, "展示了", event.card);
					ui.cardPile.insertBefore(event.card, ui.cardPile.firstChild);
				} else {
					game.log(player, "展示并弃掉了", event.card);
					await event.card.discard();
				}
				game.addVideo("deletenode", player, [get.cardInfo(event.node)]);
				event.node.delete();
				game.broadcast(function (card) {
					ui.arena.classList.remove("thrownhighlight");
					if (card.clone) {
						card.clone.delete();
					}
				}, event.card);
			} else if (result.targets) {
				player.line(result.targets, "green");
				await result.targets[0].gain(event.card, "log");
				event.node.moveDelete(result.targets[0]);
				game.addVideo("gain2", result.targets[0], [get.cardInfo(event.node)]);
				game.broadcast(
					function (card, target) {
						ui.arena.classList.remove("thrownhighlight");
						if (card.clone) {
							card.clone.moveDelete(target);
						}
					},
					event.card,
					result.targets[0]
				);
			} else {
				game.log(player, "展示并弃掉了", event.card);
				await event.card.discard();
				game.addVideo("deletenode", player, [get.cardInfo(event.node)]);
				event.node.delete();
				game.broadcast(function (card) {
					ui.arena.classList.remove("thrownhighlight");
					if (card.clone) {
						card.clone.delete();
					}
				}, event.card);
			}
			game.addVideo("thrownhighlight2");
			ui.arena.classList.remove("thrownhighlight");
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (get.tag(card, "respond") && target.countCards("h") > 1) {
						return [1, 0.2];
					}
				},
			},
		},
	},
	rejianxiong: {
		audio: 2,
		audioname: ["shen_caopi", "mb_caocao"],
		audioname2: { caoteng: "rejianxiong_caoteng" },
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return get.itemtype(event.cards) == "cards" && get.position(event.cards[0], true) == "o";
		},
		async content(event, trigger, player) {
			player.$gain2(trigger.cards);
			await player.gain(trigger.cards);
			await player.draw();
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1];
					}
					if (get.tag(card, "damage")) {
						return [1, 0.55];
					}
				},
			},
		},
	},
	rejianxiong_old: {
		audio: "rejianxiong",
		audioname2: {
			gz_caocao: "jianxiong",
		},
		trigger: { player: "damageEnd" },
		async cost(event, trigger, player) {
			let list = ["摸牌"];
			if (get.itemtype(trigger.cards) == "cards" && trigger.cards.filterInD().length) {
				list.push("拿牌");
			}
			list.push("cancel2");
			const { control } = await player
				.chooseControl(list)
				.set("prompt", get.prompt2(event.skill))
				.set("ai", () => {
					const player = get.event().player,
						trigger = get.event().getTrigger();
					const cards = trigger.cards ? trigger.cards.filterInD() : [];
					if (get.event().controls.includes("拿牌")) {
						if (
							cards.reduce((sum, card) => {
								return sum + (card.name == "du" ? -1 : 1);
							}, 0) > 1 ||
							player.getUseValue(cards[0]) > 6
						) {
							return "拿牌";
						}
					}
					return "摸牌";
				})
				.forResult();
			event.result = { bool: control != "cancel2", cost_data: control };
		},
		async content(event, trigger, player) {
			if (event.cost_data == "摸牌") {
				await player.draw();
			} else {
				await player.gain(trigger.cards.filterInD(), "gain2");
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1];
					}
					if (get.tag(card, "damage") && player != target) {
						return [1, 0.6];
					}
				},
			},
		},
	},
	reyiji: {
		audio: 2,
		audioname: ["yj_sb_guojia", "yj_sb_guojia_shadow"],
		trigger: { player: "damageEnd" },
		frequent: true,
		filter(event) {
			return event.num > 0;
		},
		async content(event, trigger, player) {
			// initialize counters (mimic step 0)
			event.num = 1;
			event.count = 1;

			let result;
			// repeat for trigger.num times (event.count starts at 1)
			while (event.count <= trigger.num) {
				// step 1: draw/gain two cards
				await player.gain(get.cards(2));
				player.$draw(2);

				// step 2/3: allow up to two give-aways per iteration
				while (true) {
					result = await player
						.chooseCardTarget({
							filterCard: true,
							selectCard: [1, 2],
							filterTarget(card, player, target) {
								return player != target && target != event.temp;
							},
							ai1(card) {
								if (ui.selected.cards.length > 0) return -1;
								if (card.name == "du") return 20;
								return _status.event.player.countCards("h") - _status.event.player.hp;
							},
							ai2(target) {
								var att = get.attitude(_status.event.player, target);
								if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
									if (target.hasSkillTag("nodu")) return 0;
									return 1 - att;
								}
								return att - 4;
							},
							prompt: "请选择要送人的卡牌",
						})
						.forResult();

					if (result?.bool) {
						// move chosen cards to storage
						await player.lose(result.cards, ui.special, "toStorage");
						const tar = result.targets[0];
						if (tar.hasSkill("reyiji2")) {
							tar.storage.reyiji2 = tar.storage.reyiji2.concat(result.cards);
						} else {
							tar.addSkill("reyiji2");
							tar.storage.reyiji2 = result.cards;
						}
						player.$give(result.cards.length, tar, false);
						player.line(result.targets, "green");
						game.addVideo("storage", tar, ["reyiji2", get.cardsInfo(tar.storage.reyiji2), "cards"]);

						// if this is the first give in this iteration, allow a second give (to a different target)
						if (event.num === 1) {
							event.temp = tar;
							event.num++;
							continue; // go back to chooseCardTarget (step 2)
						}

						// finished gives for this iteration -> prepare next iteration (if any)
						delete event.temp;
						event.num = 1;
						event.count++;
						break;
					} else {
						// player declined to give; if more iterations remain, continue loop; otherwise finish
						if (event.count < trigger.num) {
							delete event.temp;
							event.num = 1;
							event.count++;
							break;
						}
						return;
					}
				}

				// loop continues while(event.count <= trigger.num)
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						var num = 1;
						if (get.attitude(player, target) > 0) {
							if (player.needsToDiscard()) {
								num = 0.7;
							} else {
								num = 0.5;
							}
						}
						if (player.hp >= 4) {
							return [1, num * 2];
						}
						if (target.hp == 3) {
							return [1, num * 1.5];
						}
						if (target.hp == 2) {
							return [1, num * 0.5];
						}
					}
				},
			},
			threaten: 0.6,
		},
	},
	reyiji2: {
		trigger: { player: "phaseDrawBegin" },
		forced: true,
		mark: true,
		popup: "遗计拿牌",
		audio: false,
		sourceSkill: "reyiji",
		async content(event, trigger, player) {
			await player.$draw(player.storage.reyiji2.length);
			await player.gain(player.storage.reyiji2, "fromStorage");
			delete player.storage.reyiji2;
			player.removeSkill("reyiji2");
			await game.delay();
		},
		intro: {
			content: "cardCount",
		},
	},
	yijue: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player != target && target.countCards("h");
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			let result;

			// step 0
			result = await player.chooseToCompare(target).set("small", true).forResult();

			// step 1
			if (result.bool) {
				if (!target.hasSkill("fengyin")) {
					target.addTempSkill("fengyin");
				}
				target.addTempSkill("yijue2");
				return;
			} else if (target.hp < target.maxHp) {
				result = await player
					.chooseBool("是否让目标回复1点体力？")
					.set("ai", function () {
						return get.recoverEffect(target, player, player) > 0;
					})
					.forResult();
			} else {
				return;
			}

			// step 2
			if (result.bool) {
				await target.recover();
			}
		},
		ai: {
			result: {
				target(player, target) {
					var hs = player.getCards("h");
					if (hs.length < 3) {
						return 0;
					}
					var bool = false;
					for (var i = 0; i < hs.length; i++) {
						if (get.number(hs[i]) >= 9 && get.value(hs[i]) < 7) {
							bool = true;
							break;
						}
					}
					if (!bool) {
						return 0;
					}
					if (target.countCards("h") > target.hp + 1 && get.recoverEffect(target) > 0) {
						return 1;
					}
					if (player.canUse("sha", target) && (player.countCards("h", "sha") || player.countCards("he", { color: "red" }))) {
						return -2;
					}
					return -0.5;
				},
			},
			order: 9,
		},
	},
	yijue2: {
		charlotte: true,
		mark: true,
		mod: {
			cardEnabled2(card) {
				if (get.position(card) == "h") {
					return false;
				}
			},
		},
		intro: { content: "不能使用或打出手牌" },
	},
};
