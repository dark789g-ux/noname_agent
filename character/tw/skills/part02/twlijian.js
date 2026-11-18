import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twlijian" | "twchungang" | "old_twchungang" | "twshijun" | "twjuxiang">} */
export const groupSkills = {
	//张昭
	twlijian: {
		getCards(event) {
			var cards = [];
			game.countPlayer2(function (current) {
				current.checkHistory("lose", function (evt) {
					if (evt.position == ui.discardPile && evt.getParent("phaseDiscard") == event) {
						cards.addArray(evt.cards);
					}
				});
			});
			game.checkGlobalHistory("cardMove", function (evt) {
				if (evt.name == "cardsDiscard" && evt.getParent("phaseDiscard") == event) {
					cards.addArray(evt.cards);
				}
			});
			return cards.filterInD("d");
		},
		audio: 2,
		sunbenSkill: true,
		trigger: { global: "phaseDiscardEnd" },
		filter(event, player) {
			if (event.player != player && event.player.isIn()) {
				return lib.skill.twlijian.getCards(event).length;
			}
			return false;
		},
		prompt2: () => "选择任意张本阶段进入弃牌堆的牌令其获得，然后你获得剩余的牌，若其获得的牌数大于你，则你可以对其造成1点伤害",
		logTarget: "player",
		async content(event, trigger, player) {
			player.removeSkill("twlijian_sunben");
			player.awakenSkill(event.name);
			player.addSkill("twlijian_sunben");
			const cards = lib.skill.twlijian.getCards(trigger),
				target = trigger.player;
			const result = await player
				.chooseToMove("力谏：请分配" + get.translation(target) + "和你获得的牌", true, "allowChooseAll")
				.set("list", [[get.translation(target) + "获得的牌", cards], ["你获得的牌"]])
				.set("processAI", function (list) {
					var player = _status.event.player;
					var target = _status.event.getTrigger().player;
					var att = get.attitude(player, target);
					var cards = _status.event.cards;
					var cardx = cards.filter(card => card.name == "du");
					var cardy = cards.removeArray(cardx);
					switch (get.sgn(att)) {
						case 1:
							return [cards, []];
						case 0:
							return [cardx, cardy];
						case -1:
							var num = Math.ceil(cards.length / 2) + (cards.length % 2 == 0 ? 1 : 0);
							if (num > 1 && player.hasSkill("twchungang")) {
								num--;
							}
							if (get.damageEffect(target, player, player) <= 0 || num > 2 || cardx.length > cardy.length) {
								return [cardx, cardy];
							}
							var num2 = cardy.length - cardx.length;
							num2 = Math.ceil(num2 / 2) + (num2 % 2 == 0 ? 1 : 0);
							cardy.sort((a, b) => get.value(b) - get.value(a));
							cardx.addArray(cardy.slice(num, cardy.length));
							return [cardx, cardy.slice(0, num)];
					}
				})
				.set("cards", cards)
				.forResult();
			if (result?.bool) {
				await target.gain(result.moved[0], "gain2");
				await player.gain(result.moved[1], "gain2");
				if (result.moved[0].length > result.moved[1].length) {
					const result2 = await player
						.chooseBool("是否对" + get.translation(target) + "造成1点伤害？")
						.set("choice", get.damageEffect(target, player, player) > 0)
						.forResult();
					if (result2?.bool) {
						player.line(target);
						await target.damage();
					}
				}
			}
		},
		subSkill: {
			sunben: {
				charlotte: true,
				init(player, skill) {
					player.setStorage(`${skill}_limit`, game.players.length + game.dead.length);
					player.setStorage(skill, 0, true);
				},
				onremove(player, skill) {
					player.setStorage(`${skill}_limit`, null);
					player.setStorage(skill, null, true);
				},
				mark: true,
				intro: {
					markcount(num) {
						return (num || 0).toString();
					},
					content(storage, player) {
						const num1 = storage || 0,
							num2 = player.countMark("twlijian_sunben_limit");
						return `弃牌堆进入牌进度：${num1}/${num2}`;
					},
				},
				trigger: {
					global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter", "equipAfter"],
				},
				filter(event, player) {
					var cards = event.getd();
					if (!cards.length) {
						return false;
					}
					var list = cards.slice();
					game.checkGlobalHistory(
						"cardMove",
						function (evt) {
							if (evt == event || evt.getParent() == event || (evt.name != "lose" && evt.name != "cardsDiscard")) {
								return false;
							}
							if (evt.name == "lose" && evt.position != ui.discardPile) {
								return false;
							}
							list.removeArray(evt.cards);
						},
						event
					);
					return list.length > 0;
				},
				forced: true,
				popup: false,
				firstDo: true,
				content() {
					"step 0";
					var cards = trigger.getd().slice();
					game.checkGlobalHistory(
						"cardMove",
						function (evt) {
							if (evt == trigger || evt.getParent() == trigger || (evt.name != "lose" && evt.name != "cardsDiscard")) {
								return false;
							}
							if (evt.name == "lose" && evt.position != ui.discardPile) {
								return false;
							}
							cards.removeArray(evt.cards);
						},
						trigger
					);
					player.addMark("twlijian_sunben", cards.length, false);
					"step 1";
					if (player.countMark("twlijian_sunben") >= player.countMark("twlijian_sunben_limit")) {
						player.removeSkill("twlijian_sunben");
						if (player.hasSkill("twlijian", null, null, false) && !player.hasSkill("twlijian")) {
							player.popup("力谏");
							player.restoreSkill("twlijian");
							game.log(player, "恢复了技能", "#g【力谏】");
						}
					}
				},
			},
		},
	},
	twchungang: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		enable: "phaseUse",
		filter(event, player, name) {
			if (!name) {
				return !player.hasSkill("twchungang_used");
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		filterTarget: true,
		selectTarget: [1, 2],
		multiline: true,
		multitarget: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, 2])
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "draw" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			if (!event.triggername) {
				player.addTempSkill("twchungang_used", { global: "phaseChange" });
			}
			const skill = `${event.name}_${player.playerid}`;
			game.addTempTag(skill, `纯刚·${get.translation(player.name)}`);
			const draw = async target => {
				target.addSkill("twchungang_effect");
				const next = target.draw("nodelay");
				next.gaintag.add(skill);
				await next;
			};
			await game.doAsyncInOrder(event.targets, draw);
		},
		ai: {
			order: 9,
			result: {
				target: 1,
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			effect: {
				charlotte: true,
				trigger: {
					player: "useCard",
				},
				getIndex(event, player) {
					return event.cards ?? [];
				},
				filter(event, player, name, card) {
					if (!card?.cardid) {
						return false;
					}
					return player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx != event) {
							return false;
						}
						const tags = evt.gaintag_map[card.cardid];
						return tags?.some(tag => {
							return tag.startsWith("twchungang_") && tag.slice(11) !== player.playerid;
						});
					});
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.chooseToDiscard("he", true);
				},
			},
		},
	},
	old_twchungang: {
		audio: "twchungang",
		init: () => {
			game.addGlobalSkill("old_twchungang_global", null, null, false);
		},
		onremove: player => {
			if (
				!game.hasPlayer(i => {
					return i.hasSkill("old_twchungang");
				}, true)
			) {
				game.removeGlobalSkill("old_twchungang_global");
			}
		},
		trigger: { global: ["gainAfter", "loseAsyncAfter"] },
		filter(event, player) {
			var evt = event.getParent("phaseDraw");
			return game.hasPlayer(target => {
				if (target == player || (evt && evt.player == target)) {
					return false;
				}
				return event.getg(target).length > 1 && target.countCards("he");
			});
		},
		forced: true,
		logTarget(event, player) {
			var evt = event.getParent("phaseDraw");
			return game.filterPlayer(target => {
				if (target == player || (evt && evt.player == target)) {
					return false;
				}
				return event.getg(target).length > 1 && target.countCards("he");
			});
		},
		content() {
			for (var i of lib.skill.old_twchungang.logTarget(trigger, player)) {
				i.chooseToDiscard("he", true);
			}
		},
		subSkill: {
			global: {
				trigger: {
					player: "dieAfter",
				},
				filter(event, player) {
					return !game.hasPlayer(i => i.hasSkill("old_twchungang", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				charlotte: true,
				content() {
					game.removeGlobalSkill("old_twchungang_global");
				},
				ai: {
					effect: {
						target(card, player, target) {
							if ((get.tag(card, "gain") || 0) < 2 && (get.tag(card, "draw") || 0) < 2) {
								return;
							}
							let evt = _status.event.getParent("phaseDraw"),
								dis = game.countPlayer(i => {
									return target !== i && i.hasSkill("old_twchungang");
								});
							if (!dis || (evt && evt.player === target)) {
								return;
							}
							return [1, -dis];
						},
					},
				},
			},
		},
	},
	//海外主公技
	//张鲁
	twshijun: {
		global: "twshijun_global",
		audio: 2,
		zhuSkill: true,
		ai: { combo: "yishe" },
		subSkill: {
			global: {
				audio: "twshijun",
				usable: 1,
				enable: "phaseUse",
				forceaudio: true,
				filter(event, player) {
					return (
						player.group == "qun" &&
						game.hasPlayer(function (current) {
							return current != player && current.hasZhuSkill("twshijun", player) && !current.getExpansions("yishe").length;
						})
					);
				},
				filterTarget(card, player, target) {
					return target != player && target.hasZhuSkill("twshijun", player) && !target.getExpansions("yishe").length;
				},
				prompt: "摸一张牌然后将一张牌作为“米”置于主公的武将牌上",
				content() {
					"step 0";
					player.draw();
					"step 1";
					if (player.countCards("he")) {
						player.chooseCard("将一张牌置于" + get.translation(target) + "的武将牌上", "he", true);
					} else {
						event.finish();
					}
					"step 2";
					if (result.bool) {
						target.addToExpansion(result.cards, player, "give").gaintag.add("yishe");
					}
				},
				ai: {
					order: 7,
					result: {
						target: 1,
					},
				},
			},
		},
	},
	//张绣
	twjuxiang: {
		global: "twjuxiang_global",
		zhuSkill: true,
		subSkill: {
			global: {
				audio: "twjuxiang",
				usable: 1,
				enable: "phaseUse",
				forceaudio: true,
				filter(event, player) {
					return (
						player.countCards("e") &&
						player.group == "qun" &&
						game.hasPlayer(function (target) {
							return (
								target != player &&
								target.hasZhuSkill("twjuxiang", player) &&
								player.countCards("e", card => target.hasEmptySlot(get.subtype(card)) || target.hasDisabledSlot(get.subtype(card)))
							);
						})
					);
				},
				filterTarget(card, player, target) {
					return (
						target != player &&
						target.hasZhuSkill("twjuxiang", player) &&
						(target.hasEmptySlot(get.subtype(ui.selected.cards[0])) || target.hasDisabledSlot(get.subtype(ui.selected.cards[0])))
					);
				},
				filterCard: { type: "equip" },
				position: "e",
				check(card) {
					return get.value(card);
				},
				prompt: "将装备区中的一张牌置入主公的装备区中或恢复主公的对应装备栏",
				discard: false,
				lose: false,
				content() {
					if (target.hasEmptySlot(get.subtype(cards[0]))) {
						player.$give(cards[0], target, false);
						target.equip(cards[0]);
					} else {
						target.gain(cards[0], player, "give");
						target.enableEquip(get.subtype(cards[0]));
					}
				},
				ai: {
					order: 7,
					result: {
						target: 1,
					},
				},
			},
		},
	},
};
