import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "remeibu" | "remumu" | "rezhixi" | "relianzhu" | "rexiahui">} */
export const groupSkills = {
	//小虎
	remeibu: {
		audio: "meibu",
		trigger: {
			global: "phaseUseBegin",
		},
		filter(event, player) {
			return event.player != player && event.player.isIn() && event.player.inRange(player) && player.countCards("he") > 0;
		},
		direct: true,
		derivation: ["rezhixi"],
		checkx(event, player) {
			if (get.attitude(player, event.player) >= 0) {
				return false;
			}
			return event.player.countCards("h") > event.player.hp;
		},
		async content(event, trigger, player) {
			const check = lib.skill.new_meibu.checkx(trigger, player);
			const result = await player
				.chooseToDiscard(get.prompt2("remeibu", trigger.player), "he")
				.set("ai", card => {
					if (_status.event.check) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("check", check)
				.set("logSkill", ["remeibu", trigger.player])
				.forResult();
			if (result.bool) {
				const target = trigger.player;
				const card = result.cards[0];
				player.line(target, "green");
				player.markAuto("remeibu_gain", [get.suit(card, player)]);
				player.addTempSkill("remeibu_gain");
				target.addTempSkills("rezhixi", "phaseUseEnd");
			}
		},
		ai: {
			expose: 0.2,
		},
		subSkill: {
			gain: {
				trigger: { global: "loseAfter" },
				forced: true,
				charlotte: true,
				popup: false,
				onremove: true,
				filter(event, player) {
					return event.getParent(3).name == "rezhixi" && player.getStorage("remeibu_gain").includes(get.suit(event.cards[0], event.player)) && get.position(event.cards[0]) == "d";
				},
				async content(event, trigger, player) {
					player.gain(trigger.cards[0], "gain2");
				},
			},
		},
	},
	remumu: {
		audio: "mumu",
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countCards("e") > 0;
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return target.countCards("e") > 0;
				})
				.set("ai", function (target) {
					const player = _status.event.player;
					const att = get.attitude(player, target);
					const es = target.getCards("e");
					let val = 0;
					let eff;
					for (const i of es) {
						eff = -(get.value(i, target) - 0.1) * att;
						if (eff > val) {
							val = eff;
						}
					}
					return eff;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			let result;
			if (player == target) {
				result = { index: 1 };
			} else {
				const str = get.translation(target);
				result = await player
					.chooseControl()
					.set("choiceList", ["弃置" + str + "装备区的一张牌且本阶段使用【杀】的次数上限+1", "获得" + str + "装备区的一张牌且本阶段使用【杀】的次数上限-1"])
					.set("ai", function () {
						const player = _status.event.player;
						if (
							player.countCards("hs", function (card) {
								return get.name(card, player) == "sha" && player.hasValueTarget(card);
							}) < Math.max(1, player.getCardUsable("sha"))
						) {
							return 1;
						}
						return 0;
					})
					.forResult();
			}
			if (result?.index == 0) {
				player.addTempSkill(`${event.name}_effect`, "phaseUseAfter");
				await player.discardPlayerCard({ target, position: "e", forced: true });
			} else {
				player.addTempSkill(`${event.name}_debuff`, "phaseUseAfter");
				await player.gainPlayerCard({ target, position: "e", forced: true });
			}
		},
		subSkill: {
			debuff: {
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num - 1;
						}
					},
				},
				mark: true,
				intro: {
					markcount: () => -1,
					content: "出杀次数-1",
				},
			},
			effect: {
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + 1;
						}
					},
				},
				mark: true,
				intro: {
					markcount: () => 1,
					content: "出杀次数+1",
				},
			},
		},
	},
	rezhixi: {
		trigger: {
			player: "useCard",
		},
		forced: true,
		filter(event, player) {
			return (event.card.name == "sha" || get.type(event.card) == "trick") && player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			player.chooseToDiscard("h", true);
		},
		ai: {
			neg: true,
			nokeep: true,
		},
	},
	//董白
	relianzhu: {
		audio: "lianzhu",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		filterCard: true,
		discard: false,
		lose: false,
		delay: false,
		position: "he",
		filterTarget: lib.filter.notMe,
		check(card) {
			var num = get.value(card);
			if (get.color(card) == "black") {
				if (num >= 6) {
					return 0;
				}
				return 9 - num;
			} else {
				return 7 - num;
			}
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			player.give(cards, target, true);
			if (get.color(cards[0], player) == "red") {
				await player.draw();
				return;
			}
			const result = await target
				.chooseToDiscard("he", 2, "弃置两张牌，或令" + get.translation(player) + "摸两张牌")
				.set("goon", get.attitude(target, player) < 0)
				.set("ai", function (card) {
					if (!_status.event.goon) {
						return -get.value(card);
					}
					return 6 - get.value(card);
				})
				.forResult();
			if (!result.bool) {
				await player.draw(2);
			}
		},
		ai: {
			order: 3,
			expose: 0.2,
			result: {
				target(player, target) {
					if (ui.selected.cards.length && get.color(ui.selected.cards[0]) == "red") {
						if (target.countCards("h") < player.countCards("h")) {
							return 1;
						}
						return 0.5;
					}
					return -1;
				},
			},
		},
	},
	rexiahui: {
		audio: "xiahui",
		mod: {
			ignoredHandcard(card, player) {
				if (get.color(card, player) == "black") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.color(card, player) == "black") {
					return false;
				}
			},
		},
		trigger: { global: "phaseEnd" },
		forced: true,
		logTarget: "player",
		filter(event, player) {
			var target = event.player;
			return (
				target != player &&
				target.countCards("h", function (card) {
					return card.hasGaintag("rexiahui");
				}) == 0 &&
				target.getHistory("lose", function (evt) {
					for (var i in evt.gaintag_map) {
						if (evt.gaintag_map[i].includes("rexiahui")) {
							return true;
						}
					}
				}).length > 0
			);
		},
		async content(event, trigger, player) {
			trigger.player.loseHp();
		},
		group: "rexiahui_gain",
		subSkill: {
			gain: {
				trigger: { global: "gainEnd" },
				forced: true,
				popup: false,
				filter(event, player) {
					if (player == event.player) {
						return false;
					}
					var evt = event.getl(player);
					return (
						evt &&
						evt.cards2 &&
						evt.cards2.filter(function (card) {
							return get.color(card, player) == "black";
						}).length > 0
					);
				},
				async content(event, trigger, player) {
					trigger.player.addSkill("rexiahui_block");
					var cards = trigger.getl(player).cards2.filter(function (card) {
						return get.color(card, player) == "black";
					});
					trigger.player.addGaintag(cards, "rexiahui");
				},
			},
			block: {
				mod: {
					cardEnabled2(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("rexiahui")) {
							return false;
						}
					},
					cardDiscardable(card) {
						if (card.hasGaintag("rexiahui")) {
							return false;
						}
					},
				},
				charlotte: true,
				forced: true,
				popup: false,
				trigger: { player: "changeHp" },
				filter(event, player) {
					return event.changedHp < 0;
				},
				async content(event, trigger, player) {
					player.removeSkill("rexiahui_block");
				},
				onremove(player) {
					player.removeGaintag("rexiahui");
				},
			},
		},
	},
};
