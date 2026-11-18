import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinfu_guanchao" | "xinfu_xunxian" | "xinfu_kannan" | "xinfu_tushe">} */
export const groupSkills = {
	xinfu_guanchao: {
		subSkill: {
			dizeng: {
				mark: true,
				marktext: "增",
				intro: {
					content: "单调递增",
				},
				trigger: {
					player: "useCard",
				},
				audio: "xinfu_guanchao",
				forced: true,
				mod: {
					aiOrder(player, card, num) {
						if (typeof card.number != "number") {
							return;
						}
						var history = player.getHistory("useCard", function (evt) {
							return evt.isPhaseUsing() && evt.getParent("phaseUse") === _status.event.getParent("phaseUse");
						});
						if (history.length == 0) {
							return num + 10 * (14 - card.number);
						}
						var num = get.number(history[0].card);
						if (!num) {
							return;
						}
						for (var i = 1; i < history.length; i++) {
							var num2 = get.number(history[i].card);
							if (!num2 || num2 <= num) {
								return;
							}
							num = num2;
						}
						if (card.number > num) {
							return num + 10 * (14 - card.number);
						}
					},
				},
				filter(event, player) {
					var history = player.getHistory("useCard", function (evt) {
						return evt.isPhaseUsing() && evt.getParent("phaseUse") === event.getParent("phaseUse");
					});
					if (history.length < 2) {
						return false;
					}
					var num = get.number(history[0].card);
					if (!num) {
						return false;
					}
					for (var i = 1; i < history.length; i++) {
						var num2 = get.number(history[i].card);
						if (!num2 || num2 <= num) {
							return false;
						}
						num = num2;
					}
					return true;
				},
				content() {
					player.draw();
				},
				sub: true,
			},
			dijian: {
				mark: true,
				marktext: "减",
				intro: {
					content: "单调递减",
				},
				init(player) {
					player.storage.guanchao = 0;
				},
				onremove(player) {
					delete player.storage.guanchao;
				},
				trigger: {
					player: "useCard",
				},
				audio: "xinfu_guanchao",
				forced: true,
				mod: {
					aiOrder(player, card, num) {
						if (typeof card.number != "number") {
							return;
						}
						var history = player.getHistory("useCard", function (evt) {
							return evt.isPhaseUsing() && evt.getParent("phaseUse") === _status.event.getParent("phaseUse");
						});
						if (history.length == 0) {
							return num + 10 * card.number;
						}
						var num = get.number(history[0].card);
						if (!num) {
							return;
						}
						for (var i = 1; i < history.length; i++) {
							var num2 = get.number(history[i].card);
							if (!num2 || num2 >= num) {
								return;
							}
							num = num2;
						}
						if (card.number < num) {
							return num + 10 * card.number;
						}
					},
				},
				filter(event, player) {
					var history = player.getHistory("useCard", function (evt) {
						return evt.isPhaseUsing() && evt.getParent("phaseUse") === event.getParent("phaseUse");
					});
					if (history.length < 2) {
						return false;
					}
					var num = get.number(history[0].card);
					if (!num) {
						return false;
					}
					for (var i = 1; i < history.length; i++) {
						var num2 = get.number(history[i].card);
						if (!num2 || num2 >= num) {
							return false;
						}
						num = num2;
					}
					return true;
				},
				content() {
					player.draw();
				},
				sub: true,
			},
		},
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		direct: true,
		content() {
			"step 0";
			var list = ["递增", "递减", "取消"];
			player
				.chooseControl(list)
				.set("prompt", get.prompt2("xinfu_guanchao"))
				.set("ai", function () {
					return [0, 1].randomGet();
				});
			"step 1";
			switch (result.control) {
				case "递增": {
					player.logSkill("xinfu_guanchao");
					player.addTempSkill("xinfu_guanchao_dizeng", "phaseUseEnd");
					break;
				}
				case "递减": {
					player.logSkill("xinfu_guanchao");
					player.addTempSkill("xinfu_guanchao_dijian", "phaseUseEnd");
					break;
				}
				case "取消": {
					break;
				}
			}
		},
	},
	xinfu_xunxian: {
		usable: 1,
		audio: 2,
		trigger: {
			player: ["useCardAfter", "respond"],
		},
		filter(event, player) {
			if (
				get.itemtype(event.cards) !== "cards" ||
				!game.hasPlayer(current => {
					if (current === player) {
						return false;
					}
					return current.getHp() > player.getHp() || current.countCards("h") > player.countCards("h");
				})
			) {
				return false;
			}
			for (var i = 0; i < event.cards.length; i++) {
				if (event.cards[i].isInPile()) {
					return true;
				}
			}
			return false;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					if (target === player) {
						return false;
					}
					return target.getHp() > player.getHp() || target.countCards("h") > player.countCards("h");
				})
				.set("ai", target => {
					let att = get.attitude(_status.event.player, target),
						name = _status.event.cards[0].name;
					if (att < 3) {
						return 0;
					}
					if (target.hasJudge("lebu")) {
						att /= 5;
					}
					if (name === "sha" && target.hasSha()) {
						att /= 5;
					}
					if (name === "wuxie" && target.needsToDiscard(_status.event.cards)) {
						att /= 5;
					}
					return att / (1 + get.distance(player, target, "absolute"));
				})
				.set("cards", trigger.cards)
				.forResult();
		},
		async content(event, trigger, player) {
			let list = [];
			for (let i = 0; i < trigger.cards.length; i++) {
				if (trigger.cards[i].isInPile()) {
					list.push(trigger.cards[i]);
				}
			}
			if (get.mode() !== "identity" || player.identity !== "nei") {
				player.addExpose(0.2);
			}
			event.targets[0].gain(list, "gain2").giver = player;
		},
	},
	xinfu_kannan: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return player.hp;
		},
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.xinfu_kannan.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			if (target.hasSkill("xinfu_kannan_phase")) {
				return false;
			}
			return player.canCompare(target);
		},
		async content(event, trigger, player) {
			const { target, name: skillName } = event;
			target.addTempSkill(skillName + "_phase");
			const { bool } = await player.chooseToCompare(target).forResult();
			if (bool) {
				player.tempBanSkill(skillName);
				player.addSkill(skillName + "_effect");
				player.addMark(skillName + "_effect", 1, false);
			} else {
				target.addSkill(skillName + "_effect");
				target.addMark(skillName + "_effect", 1, false);
			}
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) + 0.4;
			},
			result: {
				target(player, target) {
					if (
						player.hasCard(function (card) {
							if (get.position(card) != "h") {
								return false;
							}
							var val = get.value(card);
							if (val < 0) {
								return true;
							}
							if (val <= 5) {
								return card.number >= 12;
							}
							if (val <= 6) {
								return card.number >= 13;
							}
							return false;
						})
					) {
						return -1;
					}
					return 0;
				},
			},
		},
		subSkill: {
			phase: { charlotte: true },
			effect: {
				charlotte: true,
				onremove: true,
				trigger: {
					player: "useCard",
				},
				filter(event) {
					return event.card?.name == "sha";
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					if (!trigger.baseDamage) {
						trigger.baseDamage = 1;
					}
					trigger.baseDamage += player.countMark(event.name);
					player.removeSkill(event.name);
				},
				intro: {
					content: "下一张杀的伤害基数+#",
				},
			},
		},
	},
	xinfu_tushe: {
		audio: 2,
		mod: {
			aiOrder(player, card, num) {
				if (get.tag(card, "multitarget")) {
					if (player.countCards("h", { type: "basic" })) {
						return num / 10;
					}
					return num * 10;
				}
				if (get.type(card) === "basic") {
					return num + 10;
				}
			},
			aiValue(player, card, num) {
				if (card.name === "zhangba") {
					return 114514;
				}
				if (["shan", "tao", "jiu"].includes(card.name)) {
					if (player.getEquip("zhangba") && player.countCards("hs") > 1) {
						return 0.01;
					}
					return num / 2;
				}
				if (get.tag(card, "multitarget")) {
					return num + game.players.length;
				}
			},
			aiUseful(player, card, num) {
				if (card.name === "zhangba") {
					return 114514;
				}
				if (get.name(card, player) === "shan") {
					if (
						player.countCards("hs", i => {
							if (card === i || (card.cards && card.cards.includes(i))) {
								return false;
							}
							return get.name(i, player) === "shan";
						})
					) {
						return -1;
					}
					return num / Math.pow(Math.max(1, player.hp), 2);
				}
			},
		},
		trigger: {
			player: "useCardToPlayered",
		},
		locked: false,
		frequent: true,
		filter(event, player) {
			if (get.type(event.card) == "equip") {
				return false;
			}
			if (event.getParent().triggeredTargets3.length > 1) {
				return false;
			}
			return event.targets.length > 0 && !player.countCards("h", { type: "basic" });
		},
		content() {
			player.draw(trigger.targets.length);
		},
		ai: {
			presha: true,
			pretao: true,
			threaten: 1.8,
			effect: {
				player_use(card, player, target) {
					if (
						typeof card === "object" &&
						card.name !== "shan" &&
						get.type(card) !== "equip" &&
						!player.countCards("h", i => {
							if (card === i || (card.cards && card.cards.includes(i))) {
								return false;
							}
							return get.type(i) === "basic";
						})
					) {
						let targets = [],
							evt = _status.event.getParent("useCard");
						targets.addArray(ui.selected.targets);
						if (evt && evt.card == card) {
							targets.addArray(evt.targets);
						}
						if (targets.length) {
							return [1, targets.length];
						}
						if (get.tag(card, "multitarget")) {
							return [1, game.players.length - 1];
						}
						return [1, 1];
					}
				},
			},
		},
	},
};
