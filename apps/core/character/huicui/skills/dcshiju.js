import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshiju" | "dcyingshi" | "dcgangu" | "dckuizhen">} */
export const groupSkills = {
	//蒋济
	dcshiju: {
		audio: 2,
		global: "dcshiju_global",
		subSkill: {
			global: {
				audio: "dcshiju",
				forceaudio: true,
				enable: "phaseUse",
				filter(event, player) {
					if (!player.countCards("he")) {
						return false;
					}
					return game.hasPlayer(current => current.hasSkill("dcshiju") && !current.hasSkill("dcshiju_targeted"));
				},
				filterTarget(card, player, target) {
					return target.hasSkill("dcshiju") && !target.hasSkill("dcshiju_targeted");
				},
				selectTarget() {
					const num = game.countPlayer(current => current.hasSkill("dcshiju") && !current.hasSkill("dcshiju_targeted"));
					return num > 1 ? 1 : -1;
				},
				filterCard: true,
				position: "he",
				check(card) {
					const player = get.player();
					if (get.type(card) === "equip") {
						const subtype = get.subtype(card);
						let valueFix = 0;
						if (
							game.hasPlayer(current => {
								if (!current.hasSkill("dcshiju") || current.hasSkill("dcshiju_targeted")) {
									return false;
								}
								if (current.hasUseTarget(card) && !player.countEmptySlot(subtype)) {
									return true;
								}
							})
						) {
							valueFix += 5;
						}
						return valueFix + 6 - get.value(card);
					}
					if(get.is.damageCard(card)) {
						return 10 - get.value(card);
					}
					return 6 - get.value(card);
				},
				prompt() {
					const list = game.filterPlayer(current => {
						return current.hasSkill("dcshiju") && !current.hasSkill("dcshiju_targeted");
					});
					return `将一张牌交给${get.translation(list)}${list.length > 1 ? "中的一人" : ""}，其可以使用此牌，且你本回合的攻击范围+X（X为其装备区的牌数）。若此牌为装备牌或此牌造成了伤害，你与其各摸两张牌。`;
				},
				discard: false,
				lose: false,
				log: false,
				prepare(cards, player, targets) {
					targets[0].logSkill("dcshiju");
				},
				async content(event, trigger, player) {
					const card = event.cards[0],
						target = event.target;
					target.addTempSkill("dcshiju_targeted", "phaseUseAfter");
					if (target != player) {
						await player.give(card, target);
					} else if (get.type(card) == "equip" && get.position(card) == "e") {
						await player.give(card, target);
					}
					if (!target.getCards("h").includes(card)) {
						return;
					}
					const next = target
						.chooseUseTarget(card)
						.set("ai", (event, player) => {
							const { giver } = event;
							return get.attitude(player, giver) >= 0;
						})
						.set("giver", player);
					const result = await next.forResult();
					if (!result?.bool) {
						return;
					}
					const count = target.countCards("e");
					if (count > 0) {
						player.addTempSkill("dcshiju_range");
						player.addMark("dcshiju_range", count, false);
					}
					if(get.type(card) == "equip" || player.hasHistory("sourceDamage", evt => evt.getParent(3) === next)) {
						await game.asyncDraw([player, target], 2);
					}
				},
				ai: {
					order: 8,
					result: {
						target(player, target) {
							const card = ui.selected.cards[0];
							if (!card) {
								return;
							}
							if (target.hasSkillTag("nogain")) {
								return 0;
							}
							if (card.name == "du" && target.hasSkillTag("nodu")) {
								return 0;
							}
							if (get.value(card) < 0) {
								return -5;
							}
							const nh = target.countCards("h");
							return Math.max(1, 5 - nh);
						},
					},
				},
			},
			range: {
				charlotte: true,
				onremove: true,
				mod: {
					attackRange(player, num) {
						return num + player.countMark("dcshiju_range");
					},
				},
				intro: { content: "本回合攻击范围+#" },
			},
			targeted: { charlotte: true },
		},
	},
	dcyingshi: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!event.isFirstTarget) {
				return false;
			}
			if (event.card.storage?.dcyingshi) {
				return false;
			}
			return get.type(event.card) === "trick";
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget()
				.set("prompt", get.prompt2(event.skill))
				.set("filterTarget", (card, player, target) => {
					return get.event().getTrigger().targets.includes(target);
				})
				.set("ai", target => {
					const player = get.player(),
						trigger = get.event().getTrigger();
					const num = player.countCards("e");
					const effect = get.effect(target, trigger.card, player, player);
					if (!num) {
						if (effect > 0 && get.attitude(player, target) < 0) {
							return 0;
						}
						return effect;
					}
					return Math.max(effect, get.effect(target, { name: "guohe_copy2" }, target, player) * num);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0],
				count = player.countCards("e");
			let result;
			if (count > 0) {
				const prompt = `###${get.translation(player)}对你发动了【应时】###弃置${get.cnNumber(count)}张牌，令其本回合不能再发动〖应时〗，或令其于此牌结算后视为对你使用一张同名牌"`;
				result = await target
					.chooseToDiscard(prompt, count, "he")
					.set("ai", card => {
						if (get.event().goon) {
							return 15 - get.value(card);
						}
						return 0;
					})
					.set("goon", !get.tag(trigger.card, "norepeat") && get.effect(target, trigger.card, trigger.player, target) < 0)
					.forResult();
			} else {
				result = await target
					.chooseBool(`###${get.translation(player)}对你发动了【应时】###你可以令其本回合不能再发动〖应时〗，或令其于此牌结算后视为对你使用一张同名牌"`)
					.set("choice", !get.tag(trigger.card, "norepeat") && get.effect(target, trigger.card, trigger.player, target) < 0)
					.forResult();
			}
			if (result?.bool) {
				player.tempBanSkill("dcyingshi");
			} else {
				const cardx = {
					name: trigger.card.name,
					nature: trigger.card.nature,
					isCard: true,
					storage: { dcyingshi: true },
				};
				player
					.when({ global: "useCardAfter" })
					.filter(evt => evt === trigger.getParent())
					.step(async (event, trigger, player) => {
						const next = player.useCard(get.copy(cardx), target, false);
						if (trigger.addedTarget) {
							next.addedTarget = trigger.addedTarget;
						}
						if (trigger.addedTargets && trigger.addedTargets.length) {
							next.addedTargets = trigger.addedTargets.slice(0);
						}
					});
			}
		},
	},
	//公孙修
	dcgangu: {
		audio: 2,
		trigger: { global: "loseHpAfter" },
		filter(event, player) {
			return event.player !== player;
		},
		usable: 1,
		forced: true,
		async content(event, trigger, player) {
			await player.draw(3);
			await player.loseHp();
		},
		ai: {
			combo: "dckuizhen",
			halfneg: true,
		},
	},
	dckuizhen: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => {
				return lib.skill.dckuizhen.filterTarget(null, player, current);
			});
		},
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			return target.countCards("h") >= player.countCards("h") || target.getHp() >= player.getHp();
		},
		usable: 1,
		async content(event, trigger, player) {
			const { target } = event,
				juedou = new lib.element.VCard({ name: "juedou", isCard: true });
			if (target.canUse(juedou, player, false)) {
				await target.useCard(juedou, player, "noai");
			}
			if (
				player.hasHistory("damage", evt => {
					return evt.getParent(3) === event;
				})
			) {
				await player.viewHandcards(target);
				const shas = target.getGainableCards(player, "h").filter(card => get.name(card) === "sha");
				if (shas.length) {
					player.addSkill("dckuizhen_effect");
					const next = player.gain(shas, "give", target);
					next.gaintag.add("dckuizhen");
					await next;
				}
			} else {
				await target.loseHp();
			}
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) + 1;
			},
			result: {
				player(player, target) {
					let eff = get.effect(player, { name: "juedou" }, target, player),
						shas = target.mayHaveSha(player, "respond", null, "count") - player.mayHaveSha(player, "respond", null, "count");
					if (shas > 0) {
						eff += shas * get.effect(target, { name: "shunshou" }, player, player);
					}
					return eff;
				},
				target(player, target) {
					let eff = get.effect(player, { name: "juedou" }, target, target),
						shas = target.mayHaveSha(player, "respond", null, "count") - player.mayHaveSha(player, "respond", null, "count");
					if (shas < -1) {
						eff += get.effect(target, { name: "losehp" }, target, target);
					} else if (shas > 0) {
						eff += shas * get.effect(target, { name: "shunshou" }, player, target);
					}
					return eff;
				},
			},
		},
		subSkill: {
			effect: {
				trigger: { player: "useCard1" },
				forced: true,
				popup: false,
				firstDo: true,
				charlotte: true,
				filter(event, player) {
					if (event.addCount === false) {
						return false;
					}
					return player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx != event) {
							return false;
						}
						for (const i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dckuizhen")) {
								return true;
							}
						}
						return false;
					});
				},
				async content(event, trigger, player) {
					trigger.addCount = false;
					var stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] == "number") {
						stat[name]--;
					}
				},
				mod: {
					cardUsable(card) {
						if (!card.cards) {
							return;
						}
						if (card.cards.some(card => card.hasGaintag("dckuizhen"))) {
							return Infinity;
						}
					},
				},
			},
		},
	},
};
