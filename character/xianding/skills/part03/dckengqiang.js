import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dckengqiang" | "dckuichi" | "dcshangjue" | "dckunli" | "dcsbkongwu" | "old_dcsbkongwu">} */
export const groupSkills = {
	//文鸳
	dckengqiang: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			const num = player.storage.dcshangjue ? 2 : 1;
			return player.getStorage("dckengqiang_used").length < num && get.is.damageCard(event.card);
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([
					get.prompt(event.skill, trigger.player),
					[
						[
							["draw", "摸体力上限张牌"],
							["damage", `令${get.translation(trigger.card)}伤害+1` + (trigger.cards?.length ? `且于此牌造成伤害时获得${get.translation(trigger.cards)}` : "")],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					const player = get.player();
					return !player.getStorage("dckengqiang_used").includes(button.link);
				})
				.set("ai", button => {
					return get.event().value[button.link] || 0;
				})
				.set(
					"value",
					(function () {
						let draw = player.maxHp * get.effect(player, { name: "draw" }, player, player),
							damage =
								trigger.targets.reduce((sum, target) => {
									return sum + get.damageEffect(target, player, player);
								}, 0) || 0;
						if (trigger.cards) {
							damage += trigger.cards.reduce((acc, card) => {
								return acc + get.value(card, player);
							}, 0);
						}
						return { damage, draw };
					})()
				)
				.forResult();
			event.result = {
				bool: result.bool,
				cost_data: result.links,
			};
		},
		async content(event, trigger, player) {
			const result = event.cost_data[0];
			player.addTempSkill("dckengqiang_used");
			player.markAuto("dckengqiang_used", result);
			if (result == "draw") {
				await player.draw(player.maxHp);
			} else {
				player.addTempSkill(event.name + "_effect");
				player.markAuto(event.name + "_effect", [trigger.card]);
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return event.card && player.getStorage("dckengqiang_effect").includes(event.card);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					trigger.num++;
					const cards = (trigger.cards || []).filterInD("od");
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				},
			},
		},
	},
	dckuichi: {
		audio: 2,
		trigger: {
			player: "phaseEnd",
		},
		filter(event, player) {
			if (
				player
					.getHistory("gain", evt => {
						return evt.getParent().name == "draw" && evt.cards.length;
					})
					.reduce((sum, evt) => sum + evt.cards.length, 0) < player.maxHp
			) {
				return false;
			}
			if (
				player
					.getHistory("sourceDamage", evt => {
						return evt.num > 0;
					})
					.reduce((sum, evt) => sum + evt.num, 0) < player.maxHp
			) {
				return false;
			}
			return true;
		},
		forced: true,
		async content(event, trigger, player) {
			await player.loseHp();
		},
	},
	dcshangjue: {
		skillAnimation: true,
		animationColor: "fire",
		juexingji: true,
		audio: 2,
		derivation: "dckunli",
		trigger: { player: "dying" },
		forced: true,
		filter(event, player) {
			return player.hp < 1;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.storage[event.name] = true;
			await player.recoverTo(1);
			await player.gainMaxHp();
			await player.addSkills("dckunli");
		},
	},
	dckunli: {
		skillAnimation: true,
		animationColor: "fire",
		juexingji: true,
		audio: 2,
		trigger: { player: "dying" },
		forced: true,
		filter(event, player) {
			return player.hp < 2;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recoverTo(2);
			await player.gainMaxHp();
			await player.removeSkills("dckuichi");
		},
	},
	//这是俺拾嘞（谋胡车儿）
	dcsbkongwu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player != target && target.hasCards("h");
		},
		check(card) {
			return 6 - get.value(card);
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await player
				.choosePlayerCard({
					prompt: "孔武：请选择要展示的牌",
					target,
					position: "h",
					forced: true,
				})
				.forResult();
			const { cards } = result;
			if (cards?.length) {
				await player.showCards(cards, `${get.translation(player)}对${get.translation(target)}发动了〖孔武〗`);
				const [card] = cards;
				await target.modedDiscard({ cards: target.getCards("h", { suit: get.suit(card) }) });
				let num = target.countCards("he", cardx => get.type2(card) == get.type2(cardx));
				let isDamaged = false;
				if (num) {
					const vcard = get.autoViewAs({ name: "sha", isCard: true });
					while (num > 0) {
						num--;
						if (player.canUse(vcard, target, false, false)) {
							const next = player.useCard({ card: vcard, targets: [target], addCount: false });
							await next;
							if (target.hasHistory("damage", evt => evt.card == next.card)) {
								isDamaged = true;
							}
						} else {
							break;
						}
					}
				}
				if (!isDamaged) {
					await player.drawTo(player.maxHp);
				}
				player.when({ global: "phaseAnyEnd" }).then(async (event, trigger, player) => {
					if (target.isIn() && target.hp <= player.hp && target.countCards("h") <= player.countCards("h")) {
						player.line(target, "green");
						target.addTempSkill("dcsbkongwu_effect", { player: "phaseAfter" });
					}
				});
			}
		},
		subSkill: {
			effect: {
				trigger: {
					player: ["phaseDrawBegin", "phaseBegin", "equipAfter"],
				},
				direct: true,
				forced: true,
				charlotte: true,
				filter(event, player) {
					if (event.name == "phaseDraw") {
						return !event.numFixed;
					}
					return true;
				},
				async content(event, trigger, player) {
					if (trigger.name == "phaseDraw") {
						trigger.num--;
						player.logSkill(event.name);
					} else {
						player.disableSkill(event.name, get.skillsFromEquips(player.getCards("e")));
					}
				},
				onremove(player, skill) {
					player.enableSkill(skill);
				},
				mark: true,
				marktext: "※",
				intro: {
					content: "摸牌阶段少摸一张牌，装备牌失效",
				},
				mod: {
					attackRangeBase(player, num) {
						if (player != _status.currentPhase) {
							return;
						}
						return 1;
					},
					globalFrom(from, to, distance) {
						if (from != _status.currentPhase) {
							return;
						}
						let num = 0;
						for (let i of from.getVCards("e")) {
							const info = get.info(i).distance;
							if (!info) {
								continue;
							}
							if (info.globalFrom) {
								num += info.globalFrom;
							}
						}
						return distance - num;
					},
					globalTo(from, to, distance) {
						if (to != _status.currentPhase) {
							return;
						}
						let num = 0;
						for (let i of to.getVCards("e")) {
							const info = get.info(i).distance;
							if (!info) {
								continue;
							}
							if (info.globalTo) {
								num += info.globalTo;
							}
							if (info.attackTo) {
								num += info.attackTo;
							}
						}
						return distance - num;
					},
				},
			},
		},
		ai: {
			order: 5,
			result: {
				target(player, target) {
					return -target.countCards("h");
				},
			},
		},
	},
	old_dcsbkongwu: {
		audio: "dcsbkongwu",
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		selectCard() {
			const player = get.player();
			return [1, player.maxHp];
		},
		position: "he",
		zhuanhuanji: true,
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				return "出牌阶段限一次，你可以弃置至多体力上限张牌并选择一名其他角色，" + (storage ? "视为对其使用等量张【杀】。" : "弃置其等量张牌。") + "若此阶段结束时其手牌数和体力值均不大于你，其下回合摸牌阶段少摸一张牌且装备技能失效。";
			},
		},
		filterTarget: lib.filter.notMe,
		allowChooseAll: true,
		async content(event, trigger, player) {
			const target = event.target;
			player.changeZhuanhuanji(event.name);
			if (player.storage.old_dcsbkongwu) {
				const num = Math.min(event.cards.length, target.countCards("he"));
				if (num > 0) {
					await player.discardPlayerCard("he", target, true, num, "allowChooseAll");
				}
			} else {
				let used = 0,
					card = { name: "sha", isCard: true };
				while (used < event.cards.length && target.isIn() && player.canUse(card, target, false)) {
					used++;
					await player.useCard(card, target, false);
				}
			}
			player.when("phaseUseEnd").step(async (event, trigger, player) => {
				if (target.isIn() && target.hp <= player.hp && target.countCards("h") <= player.countCards("h")) {
					player.line(target, "green");
					target.addTempSkill("old_dcsbkongwu_effect", { player: "phaseEnd" });
				}
			});
		},
		//这里需要写ai，但是地方太小我写不下
		check(card) {
			return 4 - get.value(card);
		},
		ai: {
			order: 5,
			result: {
				target: -1,
			},
		},
		getSkills(player) {
			return player.getCards("e").reduce((list, card) => {
				const info = get.info(card);
				if (info && info.skills) {
					return list.addArray(info.skills);
				}
				return list;
			}, []);
		},
		subSkill: {
			effect: {
				trigger: {
					player: ["phaseDrawBegin", "phaseBegin", "equipAfter"],
				},
				direct: true,
				forced: true,
				charlotte: true,
				filter(event, player) {
					if (event.name == "phaseDraw") {
						return !event.numFixed;
					}
					return true;
				},
				content() {
					if (trigger.name == "phaseDraw") {
						trigger.num--;
						player.logSkill(event.name);
					} else {
						player.disableSkill(event.name, lib.skill.old_dcsbkongwu.getSkills(player));
					}
				},
				onremove(player, skill) {
					player.enableSkill(skill);
				},
				mark: true,
				marktext: "※",
				intro: {
					content: "摸牌阶段少摸一张牌，装备牌失效",
				},
				mod: {
					attackRangeBase(player, num) {
						if (player != _status.currentPhase) {
							return;
						}
						return 1;
					},
					globalFrom(from, to, distance) {
						if (from != _status.currentPhase) {
							return;
						}
						let num = 0;
						for (let i of from.getVCards("e")) {
							const info = get.info(i).distance;
							if (!info) {
								continue;
							}
							if (info.globalFrom) {
								num += info.globalFrom;
							}
						}
						return distance - num;
					},
					globalTo(from, to, distance) {
						if (to != _status.currentPhase) {
							return;
						}
						let num = 0;
						for (let i of to.getVCards("e")) {
							const info = get.info(i).distance;
							if (!info) {
								continue;
							}
							if (info.globalTo) {
								num += info.globalTo;
							}
							if (info.attackTo) {
								num += info.attackTo;
							}
						}
						return distance - num;
					},
				},
			},
		},
	},
};
