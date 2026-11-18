import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "new_juexiang" | "new_canyun" | "qingxian_draw" | "zhenjun" | "rezhenjun" | "fenli" | "pingkou">} */
export const groupSkills = {
	new_juexiang: {
		audio: "juexiang",
		trigger: {
			player: "die",
		},
		forced: true,
		forceDie: true,
		skillAnimation: true,
		animationColor: "water",
		derivation: ["new_canyun"],
		async content(event, trigger, player) {
			const source = trigger.source;
			if (source && source.isIn()) {
				await source.discard(source.getCards("e"));
				await source.loseHp();
			}
			const { targets } = await player
				.chooseTarget("【绝响】：是否令一名其他角色获得技能〖残韵〗？", lib.filter.notMe)
				.set("ai", target => {
					let att = get.attitude(get.player(), target);
					if (target.countCards("ej", { suit: "club" })) {
						att = att * 2;
					}
					return 10 + att;
				})
				.set("forceDie", true)
				.forResult();
			if (!targets || !targets.length) {
				return;
			}
			const target = targets[0];
			player.line(target, "thunder");
			await target.addSkills("new_canyun");
			const result = await target
				.chooseTarget("是否弃置场上的一张牌，获得技能〖绝响〗？", (card, player, target) => {
					return target.getDiscardableCards(player, "ej").some(i => get.suit(i) == "club");
				})
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "guohe_copy2" }, player, player);
				})
				.forResult();
			if (result.bool) {
				await target.discardPlayerCard(result.targets[0], "ej", true).set("filterButton", button => {
					return get.suit(button.link) == "club";
				});
				await target.addSkills("new_juexiang");
			}
		},
	},
	new_canyun: {
		group: ["qingxian_draw"],
		complexCard: true,
		complexSelect: true,
		marktext: "韵",
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = [];
			}
		},
		intro: {
			content(storage) {
				var str = "";
				var str2 = "<li>出牌阶段限一次，你可以弃置至多X张牌并选择等量的其他角色（不能选择已经成为过〖残韵〗目标的角色）。这些角色中，装备区内牌数少于你的回复1点体力，等于你的摸一张牌，多于你的失去1点体力。若你以此法指定的角色数等于X，则你摸一张牌。（X为你的体力值）";
				if (storage.length > 0) {
					for (var i = 0; i < storage.length; i++) {
						str += "、";
						str += get.translation(storage[i]);
					}
					str = str.slice(1);
					str2 += "<br><li>已对" + str + "发动过〖残韵〗";
				}
				return str2;
			},
		},
		mark: true,
		enable: "phaseUse",
		usable: 1,
		check(cardx) {
			var player = _status.event.player;
			var number = game.countPlayer(function (target) {
				if (player == target) {
					return false;
				}
				var pe = player.countCards("e", function (card) {
					return card != cardx && ui.selected.cards.includes(card) == false;
				});
				var te = target.countCards("e");
				if (pe > te && target.isDamaged() && get.attitude(player, target) > 2) {
					return true;
				} else if (pe < te && get.attitude(player, target) < 0) {
					return true;
				}
				return false;
			});
			if (ui.selected.cards.length < number) {
				return 6 - get.value(cardx);
			} else {
				return 0;
			}
		},
		filter(event, player) {
			if (!player.storage.new_canyun) {
				player.storage.new_canyun = [];
			}
			return game.hasPlayer(function (current) {
				return current != player && !player.storage.new_canyun.includes(current);
			});
		},
		filterTarget(card, player, target) {
			return target != player && !player.storage.new_canyun.includes(target);
		},
		selectTarget() {
			return ui.selected.cards.length;
		},
		filterCard: true,
		selectCard() {
			var player = _status.event.player;
			return [1, player.hp];
		},
		targetprompt(target) {
			var pe = _status.event.player.countCards("e", function (card) {
				return ui.selected.cards.includes(card) == false;
			});
			var te = target.countCards("e");
			if (pe > te) {
				return "回复体力";
			} else if (pe == te) {
				return "摸一张牌";
			} else if (pe < te) {
				return "失去体力";
			}
		},
		line: "thunder",
		position: "he",
		async content(event, trigger, player) {
			const { target } = event;
			player.storage.new_canyun.push(target);
			const pe = player.countCards("e");
			const te = target.countCards("e");
			if (pe > te) {
				await target.recover();
			} else if (pe == te) {
				await target.draw();
			} else if (pe < te) {
				await target.loseHp();
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					var pe = player.countCards("e");
					var te = target.countCards("e");
					if (pe > te && target.isDamaged()) {
						return 2;
					} else if (pe == te) {
						return 1;
					} else if (pe < te) {
						return -2.5;
					} else {
						return 0;
					}
				},
			},
		},
	},
	qingxian_draw: {
		trigger: {
			player: ["new_qingxianAfter", "new_canyunAfter"],
		},
		forced: true,
		popup: false,
		silent: false,
		filter(event, player) {
			return event.target == event.targets[event.targets.length - 1] && event.targets.length == player.hp;
		},
		async content(event, trigger, player) {
			await player.draw();
		},
	},
	zhenjun: {
		audio: ["jieyue", 2],
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countCards("h") > current.hp;
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("zhenjun"),
					filterTarget(card, player, target) {
						return target.countCards("h") > target.hp;
					},
					ai(target) {
						const player = get.player();
						return -get.attitude(player, target) * (target.countCards("e") + 1);
					},
				})
				.forResult();
		},
		line: "thunder",
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const num = target.countCards("h") - target.hp;

			let result = await player
				.discardPlayerCard({
					target,
					selectButton: num,
					forced: true,
					allowChooseAll: true,
				})
				.forResult();

			if (!result.bool || !result.cards?.length) {
				return;
			}

			let num2 = 0;
			const num3 = result.cards.length;
			for (const card of result.cards) {
				if (get.type(card, null, card.original === "h" ? target : false) !== "equip") {
					num2++;
				}
			}

			if (num2 <= 0) {
				return;
			}
			const prompt = `弃置${get.cnNumber(num2)}张牌，或令${get.translation(target)}摸${get.cnNumber(num3)}张牌`;
			result = await player
				.chooseToDiscard({
					prompt,
					selectCard: num2,
					position: "he",
					allowChooseAll: true,
					ai(card) {
						return 5 - get.value(card);
					},
				})
				.forResult();
			if (!result.bool) {
				await target.draw(num3);
			}
		},
	},
	rezhenjun: {
		audio: ["jieyue", 2],
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countCards("h") > 0;
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2("rezhenjun"), (card, player, target) => {
					return target.countCards("he");
				})
				.set("ai", target => {
					const player = get.player();
					return -get.attitude(player, target) * (target.countCards("e") + 1);
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const num = Math.max(target.countCards("h") - target.hp, 1);

			let result = await player
				.discardPlayerCard({
					target,
					selectButton: num,
					forced: true,
					allowChooseAll: true,
				})
				.forResult();
			if (!result.bool || !result.cards?.length) {
				return;
			}

			let num2 = 0;
			for (const card of result.cards) {
				if (get.type(card) !== "equip") {
					num2++;
				}
			}

			if (num2 <= 0) {
				return;
			}

			const prompt = `弃置${get.cnNumber(num2)}张牌，或令${get.translation(target)}摸${get.cnNumber(num2)}张牌`;
			result = await player
				.chooseToDiscard({
					prompt,
					selectCard: num2,
					position: "he",
					allowChooseAll: true,
					ai(card) {
						return 5 - get.value(card);
					},
				})
				.forResult();
			if (!result.bool) {
				await target.draw(num2);
			}
		},
	},
	fenli: {
		audio: 2,
		audioname: ["xin_zhuhuan"],
		group: ["fenli_draw", "fenli_use", "fenli_discard"],
		subfrequent: ["discard"],
		subSkill: {
			draw: {
				audio: "fenli",
				audioname: ["xin_zhuhuan"],
				trigger: { player: "phaseDrawBefore" },
				prompt: "是否发动【奋励】跳过摸牌阶段？",
				filter(event, player) {
					return player.isMaxHandcard();
				},
				check(event, player) {
					if ((!player.hasSkill("pingkou") && !player.hasSkill("xinpingkou")) || player.getHistory("skipped").length > 0) {
						return false;
					}
					return game.hasPlayer(function (current) {
						return get.attitude(player, current) < 0 && current.hp == 1 && get.damageEffect(current, player, player) > 0;
					});
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			use: {
				audio: "fenli",
				audioname: ["xin_zhuhuan"],
				trigger: { player: "phaseUseBefore" },
				prompt: "是否发动【奋励】跳过出牌阶段？",
				filter(event, player) {
					return player.isMaxHp();
				},
				check(event, player) {
					if (!player.hasSkill("pingkou") && !player.hasSkill("xinpingkou")) {
						return false;
					}
					if (!player.needsToDiscard() || (player.countCards("e") && player.isMaxEquip())) {
						return true;
					}
					if (player.getHistory("skipped").length > 0) {
						return false;
					}
					return game.hasPlayer(function (current) {
						return get.attitude(player, current) < 0 && current.hp == 1 && get.damageEffect(current, player, player) > 0;
					});
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
			discard: {
				audio: "fenli",
				audioname: ["xin_zhuhuan"],
				trigger: { player: "phaseDiscardBefore" },
				prompt: "是否发动【奋励】跳过弃牌阶段？",
				frequent: true,
				filter(event, player) {
					return player.isMaxEquip() && player.countCards("e") > 0;
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
			},
		},
		ai: {
			combo: "pingkou",
		},
	},
	pingkou: {
		audio: 2,
		trigger: { player: "phaseEnd" },
		filter(event, player) {
			return player.getHistory("skipped").length > 0;
		},
		async cost(event, trigger, player) {
			const skippedCount = player.getHistory("skipped").length;
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("pingkou"),
					filterTarget(card, player, target) {
						return target !== player;
					},
					selectTarget: [1, skippedCount],
					ai(target) {
						return get.damageEffect(target, get.player(), get.player());
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			// @ts-ignore
			await game.doAsyncInOrder(event.targets, target => target.damage());
		},
		ai: {
			effect: {
				target(card) {
					if (card.name == "lebu" || card.name == "bingliang") {
						return 0.5;
					}
				},
			},
			combo: "fenli",
		},
	},
};
