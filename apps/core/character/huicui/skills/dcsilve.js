import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsilve" | "dcshuaijie" | "dcyiyong" | "dcsuchou">} */
export const groupSkills = {
	//雷普
	dcsilve: {
		audio: 2,
		trigger: {
			player: "enterGame",
			global: "phaseBefore",
		},
		onremove: ["dcsilve", "dcsilve_self"],
		filter(event, player) {
			return game.hasPlayer(current => current != player && !player.getStorage("dcsilve").includes(current)) && (event.name != "phase" || game.phaseNumber == 0);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget("私掠：请选择一名其他角色", "选择一名其他角色（暂时仅你可见），称为“私掠”角色，且你获得后续效果", true, (card, player, target) => {
					return target != player && !player.getStorage("dcsilve").includes(target);
				})
				.set("ai", target => {
					const att = get.attitude(get.player(), target);
					if (att > 0) {
						return att + 1;
					}
					if (att == 0) {
						return Math.random();
					}
					return att;
				})
				.set("animate", false)
				.forResult();
		},
		logLine: false,
		async content(event, trigger, player) {
			const [target] = event.targets;
			player.markAuto(event.name, [target]);
			player.addSkill(event.name + "_rob");
			player.addSkill(event.name + "_revenge");
			target.addSkill(event.name + "_target");
			target.storage[event.name + "_target"] ??= [];
			target.storage[event.name + "_target"].push(player);
		},
		subSkill: {
			rob: {
				audio: "dcsilve",
				trigger: { global: "damageSource" },
				filter(event, player) {
					if (!player.getStorage("dcsilve").includes(event.source)) {
						return false;
					}
					if (!event.player.isIn() || event.player == player) {
						return false;
					}
					if (player.getStorage("dcsilve_robbed").includes(event.player)) {
						return false;
					}
					return event.player.countCards("he") > 0;
				},
				charlotte: true,
				prompt2(event, player) {
					return "获得" + get.translation(event.player) + "一张牌";
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const [target] = event.targets;
					player.addTempSkill("dcsilve_robbed");
					player.markAuto("dcsilve_self", [target]);
					if (target.countGainableCards(player, "he") > 0) {
						player.markAuto("dcsilve_robbed", [target]);
						await player.gainPlayerCard(target, "he", true);
					}
					if (trigger.source && trigger.source != player) {
						trigger.source.markSkill("dcsilve_target");
					}
				},
			},
			revenge: {
				audio: "dcsilve",
				trigger: { global: "damageEnd" },
				filter(event, player) {
					if (!player.getStorage("dcsilve").includes(event.player)) {
						return false;
					}
					if (!event.player.isIn() || !event.source?.isIn() || event.source == player) {
						return false;
					}
					return true;
				},
				charlotte: true,
				direct: true,
				clearTime: true,
				async content(event, trigger, player) {
					if (trigger.player && trigger.player != player) {
						trigger.player.markSkill("dcsilve_target");
					}
					player.markAuto("dcsilve_self", [trigger.player]);
					const result = await player
						.chooseToUse("私掠：对" + get.translation(trigger.source) + "使用一张【杀】，或弃置一张手牌", function (card, player, event) {
							if (get.name(card) != "sha") {
								return false;
							}
							return lib.filter.filterCard.apply(this, arguments);
						})
						.set("targetRequired", true)
						.set("complexTarget", true)
						.set("complexSelect", true)
						.set("filterTarget", function (card, player, target) {
							if (target != _status.event.source && !ui.selected.targets.includes(_status.event.source)) {
								return false;
							}
							return lib.filter.targetEnabled.apply(this, arguments);
						})
						.set("source", trigger.source)
						.set("logSkill", event.name)
						.forResult();
					if (!result?.bool) {
						if (player.countCards("h") > 0) {
							await player.chooseToDiscard("h", true).set("logSkill", event.name);
						}
					}
				},
			},
			self: {
				marktext: "私",
				intro: {
					name: "私掠",
					content(storage, player) {
						if (!storage?.length) {
							return "没有打劫对象";
						}
						if (storage[0] == player) {
							return "已绑定" + get.translation(player) + "自己";
						}
						return "打劫对象：" + get.translation(storage);
					},
				},
			},
			target: {
				marktext: "掠",
				intro: {
					name: "私掠",
					content(storage, player) {
						return "被" + get.translation(storage) + "盯上了！";
					},
				},
			},
			robbed: { onremove: true, charlotte: true },
		},
	},
	dcshuaijie: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		filter(event, player) {
			var targets = player.getStorage("dcsilve").filter(i => i.isIn());
			if (!targets.length) {
				return true;
			}
			return (
				targets.filter(target => {
					return player.hp > target.hp && player.countCards("e") > target.countCards("e");
				}).length == targets.length
			);
		},
		async content(event, trigger, player) {
			await player.awakenSkill(event.name);
			await player.loseMaxHp();
			const choices = [];
			const choiceList = ["获得“私掠”角色至多三张牌", "从牌堆随机获得三张类型各不相同的牌"];
			const targets = player.getStorage("dcsilve").filter(i => i.isIn());
			event.targets = targets;
			if (targets.length) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5; ">' + choiceList[0] + "</span>";
			}
			choices.push("选项二");
			const result = await player
				.chooseControl(choices)
				.set("prompt", "衰劫：选择一项")
				.set("choiceList", choiceList)
				.set("ai", () => _status.event.choice)
				.set(
					"choice",
					(function () {
						let eff = 0;
						for (const target of targets) {
							eff += get.effect(target, { name: "shunshou_copy2" }, player, player) * 2;
						}
						eff -= get.effect(player, { name: "dongzhuxianji" }, player, player);
						return eff > 0 && choices.includes("选项一") ? "选项一" : "选项二";
					})()
				)
				.forResult();
			if (result.control == "选项一") {
				if (targets.length) {
					for (const target of targets) {
						if (target.countGainableCards(player, "he") > 0) {
							player.line(target);
							await player.gainPlayerCard(target, "he", true, [1, 3]);
						}
					}
				}
			} else {
				const cards = [];
				for (let i = 0; i < 3; i++) {
					const card = get.cardPile2(cardx => {
						return cards.filter(cardxx => get.type2(cardxx) == get.type2(cardx)).length == 0;
					}, "random");
					if (card) {
						cards.push(card);
					}
				}
				if (cards.length) {
					await player.gain(cards, "gain2");
				}
			}
			const currentTargets = player.getStorage("dcsilve").filter(i => i.isIn());
			for (const target of currentTargets) {
				target.unmarkAuto("dcsilve_target", [player]);
			}
			delete player.storage.dcsilve;
			delete player.storage.dcsilve_self;
			player.markAuto("dcsilve", [player]);
			player.markAuto("dcsilve_self", [player]);
		},
		ai: {
			combo: "dcsilve",
			order: 8,
			result: {
				player(player) {
					var targets = player.getStorage("dcsilve").filter(i => i.isIn());
					if (!targets.length) {
						return 1;
					}
					var att = 0;
					targets.forEach(i => (att += get.attitude(player, i)));
					if (att < 0) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	//庞会
	dcyiyong: {
		audio: 2,
		trigger: {
			source: "damageBegin1",
		},
		//usable:2,
		filter(event, player) {
			return player.countDiscardableCards(player, "he") > 0 && player != event.player;
		},
		check(event, player) {
			return get.attitude(player, event.player) < 0 && player.countCards("he", card => lib.filter.cardDiscardable(card, player, "dcyiyong") && get.value(card, player) < 7) > 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const list = [player];
			if (trigger.player.countDiscardableCards(trigger.player, "he") > 0) {
				list.push(trigger.player);
			}
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			const result = await player
				.chooseCardOL(list, "he", true, [1, Infinity], "异勇：弃置任意张牌", (card, player, target) => {
					return lib.filter.cardDiscardable(card, player, "dcyiyong");
				})
				.set("allowChooseAll", true)
				.set("ai", card => {
					const evt = _status.event.getParent(2);
					const evtx = _status.event.getParent();
					const source = evt.player,
						player = _status.event.player,
						target = evtx.list[1];
					if (!target) {
						return get.unuseful(card);
					}
					if (player == source) {
						let total = 0,
							need = 0;
						target.countCards("he", card => {
							if (lib.filter.cardDiscardable(card, target, "dcyiyong") && get.value(card) < 5) {
								need += get.number(card);
							}
						});
						for (const i of ui.selected.cards) {
							total += get.number(i);
						}
						if (total >= need + 5) {
							return 0;
						}
						let val = 6;
						if (
							target.hp <= 2 &&
							!target.hasSkillTag("filterDamage", null, {
								player: player,
								card: evt.getTrigger().card,
							})
						) {
							val += 2 + get.number(card) / 5;
						}
						if (target.countCards("he", card => get.value(card) < 5) >= 3) {
							val -= 3 + get.number(card) / 5;
						}
						return val - get.value(card);
					}
					if (ui.selected.cards.length > 1 && ui.selected.cards.length + 2 >= source.countCards("he")) {
						return 0;
					}
					if (
						player.hp <= 2 &&
						!target.hasSkillTag("filterDamage", null, {
							player: player,
							card: evt.getTrigger().card,
						})
					) {
						return 10 - get.value(card);
					}
					return 5 - get.value(card);
				})
				.forResult();
			const lose_list = [];
			for (let i = 0; i < result.length; i++) {
				const current = list[i],
					cards2 = result[i].cards;
				lose_list.push([current, cards2]);
			}
			await game.loseAsync({ lose_list: lose_list }).setContent("discardMultiple");
			const getn = function (cards) {
				return cards.map(i => get.number(i, false)).reduce((p, c) => p + c, 0);
			};
			const cards0 = result[0]?.cards || [];
			const cards1 = result[1]?.cards || [];
			const num0 = getn(cards0),
				num1 = getn(cards1);
			if (num0 <= num1) {
				await player.draw(cards1.length + 1);
			}
			if (num0 >= num1) {
				trigger.num++;
			}
		},
	},
	dcsuchou: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		forced: true,
		async content(event, trigger, player) {
			const { index } = await player
				.chooseControl()
				.set("prompt", "夙仇：请选择一项")
				.set("choiceList", ["失去1点体力，本阶段使用牌不可被响应", "减1点体力上限，本阶段使用牌不可被响应", "失去〖夙仇〗"])
				.set("ai", () => {
					const player = get.event().player;
					if (player.isHealthy()) {
						return player.maxHp <= 2 ? 2 : 0;
					}
					return 1;
				})
				.forResult();
			switch (index) {
				case 0:
					await player.loseHp();
					player.addTempSkill("dcsuchou_effect", "phaseUseAfter");
					break;
				case 1:
					await player.loseMaxHp();
					player.addTempSkill("dcsuchou_effect", "phaseUseAfter");
					break;
				case 2:
					await player.removeSkills("dcsuchou");
					break;
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				marktext: "仇",
				intro: { content: "使用牌不可被响应" },
				audio: "dcsuchou",
				trigger: { player: "useCard" },
				filter(event, player) {
					return event.card.name == "sha" || get.type(event.card) == "trick";
				},
				forced: true,
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.players);
					game.log(trigger.card, "不可被响应");
				},
				ai: { directHit_ai: true },
			},
		},
	},
};
