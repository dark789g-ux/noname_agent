import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mbshuanghuai" | "potwanglie" | "pothongyi">} */
export const groupSkills = {
	mbshuanghuai: {
		audio: 3,
		logAudio: index => (typeof index === "number" ? "mbshuanghuai" + index + ".mp3" : 3),
		init(player, skill) {
			const history = player.getAllHistory("useSkill", evt => evt.skill == skill && evt.targets);
			if (history.length) {
				const target = history[history.length - 1].targets[0];
				if (target) {
					player.storage[skill] = target;
					player.markSkill(skill);
					player.addTip(skill, `霜怀 ${get.translation(target)}`);
				}
			}
		},
		onremove(player, skill) {
			delete player.storage[skill];
			player.removeTip(skill);
		},
		trigger: { global: "damageBegin4" },
		usable: 1,
		filter(event, player) {
			return get.distance(event.player, player) <= 1; // && player != event.player
		},
		popup: false,
		logTarget: "player",
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([
					get.prompt2(event.skill, trigger.player),
					[
						[
							["cancel", `防止此伤害`],
							["tao", `令其从弃牌堆获得一张【桃】`],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					return get.event().links.includes(button.link);
				})
				.set(
					"links",
					["cancel", "tao"].filter(link => {
						if (link == "tao") {
							const card = get.discardPile(cardx => cardx.name == "tao");
							if (!card) {
								return false;
							}
						}
						return true;
					})
				)
				.set("ai", button => {
					const trigger = get.event().getTrigger(),
						eff = get.damageEffect(trigger.player, trigger.source, get.player());
					if (eff > 0) {
						return 0;
					}
					if (trigger.player.hasSkillTag("maixie") && trigger.num === 1 && button.link == "tao") {
						return 1 + Math.random();
					}
					return Math.random();
				})
				.forResult();
			if (result.bool) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		async content(event, trigger, player) {
			const link = event.cost_data,
				target = trigger.player,
				last = player.storage[event.name];
			player.logSkill("mbshuanghuai", target, null, null, [link == "cancel" ? 1 : 2]);
			if (link == "cancel") {
				trigger.cancel();
			} else {
				const card = get.discardPile("tao");
				if (card) {
					await target.gain(card, "gain2");
				}
			}
			if (last && last == target) {
				await game.asyncDraw([player, target]);
				return;
			}
			if (last && last != target) {
				player.logSkill("mbshuanghuai", null, null, null, [3]);
				await player.loseHp();
			}
			player.storage[event.name] = target;
			player.markSkill(event.name);
			player.addTip(event.name, `霜怀 ${get.translation(target)}`);
		},
		intro: {
			content: "player",
			markcount: () => 0,
		},
	},
	//势陈到
	potwanglie: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), "h")
				.set("ai", card => {
					const player = get.player();
					if (player.hasValueTarget(card, true)) {
						return player.getUseValue(card, false, true) * (get.tag(card, "damage") && get.type(card) != "delay" ? 2 : 1);
					}
					return 0.1 + Math.random();
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const card = event.cards[0];
			player.addGaintag(card, "potwanglie");
			player.addTempSkill(event.name + "_effect", "phaseUseAfter");
			await game.delayx();
		},
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				if (!player.isPhaseUsing() || typeof card !== "object" || num <= 0) {
					return;
				}
				if (get.itemtype(card) == "card" && card.hasGaintag("potwanglie")) {
					num / 20;
				}
				return num;
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("potwanglie");
				},
				mod: {
					targetInRange(card, player, target) {
						if (card.cards?.some(cardx => cardx.hasGaintag("potwanglie"))) {
							return true;
						}
					},
				},
				audio: "potwanglie",
				trigger: { player: ["useCard", "useCardAfter"] },
				filter(event, player) {
					return player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (event !== evtx) {
							return false;
						}
						return Object.values(evt.gaintag_map).flat().includes("potwanglie");
					});
				},
				silent: true,
				async content(event, trigger, player) {
					if (event.triggername == "useCard") {
						player.logSkill(event.name);
						if (Array.isArray(trigger.directHit)) {
							trigger.directHit.addArray(game.players);
						}
						game.log(trigger.card, "不可被响应");
					} else {
						player.addTempSkill("potwanglie_debuff", "phaseUseAfter");
					}
				},
				ai: {
					directHit_ai: true,
					skillTagFilter(player, tag, arg) {
						if (arg?.card?.cards?.some(card => card.hasGaintag("potwanglie"))) {
							return true;
						}
					},
				},
			},
			debuff: {
				mark: true,
				charlotte: true,
				intro: { content: "本阶段不能对其他角色使用牌" },
				mod: {
					playerEnabled(card, player, target) {
						if (player !== target) {
							return false;
						}
					},
				},
			},
		},
	},
	pothongyi: {
		audio: 4,
		locked: true,
		popup: false,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.hasMark("pothongyi");
		},
		//提前若为
		maxMark() {
			//if (get.mode() == "doudizhu") return 1;
			return 5;
		},
		logAudio: index => (typeof index === "number" ? "pothongyi" + index + ".mp3" : 2),
		async cost(event, trigger, player) {
			const num = player.countMark("pothongyi");
			let list = [`摸${get.cnNumber(num)}张牌`, `移去所有“毅”标记`];
			const result = await player
				.chooseControl()
				.set("prompt", get.translation(event.skill) + "：请选择一项执行，并于结束阶段执行另一项")
				.set("choiceList", list)
				.set("num", num)
				.set("ai", () => {
					return 1;
				})
				.forResult();
			event.result = { bool: true, cost_data: result.index };
		},
		async content(event, trigger, player) {
			player.logSkill("pothongyi", null, null, null, [get.rand(3, 4)]);
			const control = event.cost_data;
			const num = player.countMark("pothongyi");
			if (!num) {
				return;
			}
			if (control == 0) {
				player.draw({ num });
			} else if (control == 1) {
				player.clearMark("pothongyi");
			}
			//初版势陈到的遗产，默哀吧
			/*for (let i = 0; i < num; i++) {
					const card = new lib.element.VCard({ name: "sha", isCard: true });
					if (player.hasUseTarget(card)) await player.chooseUseTarget(card, true, false).set("prompt2", `还可以再使用${num - i}张`);
					else break;
				}*/
			player
				.when({ player: "phaseJieshuBegin" })
				.filter(evt => evt.getParent("phase") == trigger.getParent("phase"))
				.step(async (event, trigger, player) => {
					if (control == 1) {
						await player.draw({ num });
					} else if (control == 0) {
						player.clearMark("pothongyi");
					}
				});
		},
		marktext: "毅",
		intro: {
			name2: "毅",
			content: "mark",
		},
		group: "pothongyi_mark",
		subSkill: {
			mark: {
				audio: ["pothongyi1.mp3", "pothongyi2.mp3"],
				trigger: {
					global: "phaseBefore",
					source: "damageSource",
					player: ["enterGame", "damageEnd"],
				},
				//getIndex: event => (event.name === "damage" ? event.num : 1),
				filter(event, player) {
					if (player.countMark("pothongyi") >= get.info("pothongyi").maxMark()) {
						return false;
					}
					return event.name != "phase" || game.phaseNumber == 0;
				},
				forced: true,
				async content(event, trigger, player) {
					const num = get.info("pothongyi").maxMark() - player.countMark("pothongyi");
					player.addMark("pothongyi", Math.min(trigger.name === "damage" ? 1 : 4, num));
				},
			},
		},
	},
};
