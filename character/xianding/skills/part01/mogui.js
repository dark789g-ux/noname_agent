import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "mogui" | "zunjian" | "rencheng">} */
export const groupSkills = {
	//刘璿
	mogui: {
		audio: 2,
		trigger: { player: ["phaseJudgeBegin", "phaseDrawBegin", "phaseDiscardBegin"] },
		filter(event, player) {
			if (player != _status.currentPhase) {
				return false;
			}
			const storage = player.getStorage("mogui");
			if (event.name === "phaseJudge") {
				return !storage.includes("phaseJudge");
			}
			if (event.name === "phaseDraw") {
				return !storage.includes("phaseDraw");
			}
			if (event.name === "phaseDiscard") {
				return !storage.includes("phaseDiscard") && player.hasCards("he");
			}
			return false;
		},
		async cost(event, trigger, player) {
			const storage = player.getStorage(event.skill);
			if (trigger.name === "phaseJudge" && !storage.includes(trigger.name)) {
				event.result = await player
					.chooseTarget(get.prompt(event.skill), "令一名角色回复1点体力并弃置判定区所有牌")
					.set("ai", target => {
						const player = get.player();
						const att = get.attitude(player, target);
						if (!player.awakenedSkills.includes("zunjian")) {
							return att;
						}
						const effectOk = get.recoverEffect(target, player, player) > 0;
						const hasBadCards = target.hasCards("j", card => {
							const vcard = {
								name: card.viewAs || card.name,
								cards: [card],
							};
							return get.effect(target, vcard, target, target) < -1;
						});
						return att * (effectOk + hasBadCards);
					})
					.forResult();
			} else if (trigger.name === "phaseDraw" && !storage.includes(trigger.name)) {
				event.result = await player
					.chooseTarget(get.prompt(event.skill), "令一名角色摸牌阶段摸牌数和使用【杀】的次数上限+1")
					.set("ai", target => {
						const player = get.player();
						return get.attitude(player, target);
					})
					.forResult();
			} else if (trigger.name === "phaseDiscard" && !storage.includes(trigger.name)) {
				event.result = await player
					.chooseCardTarget({
						prompt: get.prompt(event.skill),
						prompt2: "弃置至多五张牌，令一名角色手牌上限+1并摸等量张牌",
						filterCard: lib.filter.cardDiscardable,
						selectCard: [1, 5],
						allowChooseAll: true,
						filterTarget: true,
						position: "he",
						ai1(card) {
							return 7 - get.value(card);
						},
						ai2(target) {
							const player = get.player();
							return get.attitude(player, target);
						},
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cards,
			} = event;
			player.markAuto(event.name, [trigger.name]);
			if (trigger.name == "phaseJudge") {
				await target.recover();
				const cards = target.getCards("j");
				if (cards.length > 0) {
					await target.discard(cards, target);
				}
			} else if (trigger.name == "phaseDraw") {
				target.addMark(event.name + "_effect", 1, false);
				target.addSkill(event.name + "_effect");
			} else if (trigger.name == "phaseDiscard") {
				await player.discard(cards);
				target.addMark(event.name + "_hand", 1, false);
				target.addSkill(event.name + "_hand");
				await target.draw(cards.length);
			}
		},
		onremove: true,
		intro: { content: `已移除选项：$` },
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: { content: "摸牌阶段摸牌数和使用【杀】的次数上限+#" },
				trigger: { player: "phaseDrawBegin2" },
				forced: true,
				popup: false,
				filter(event, player) {
					return !event.numFixed;
				},
				async content(event, trigger, player) {
					trigger.num += player.countMark(event.name);
				},
				mod: {
					cardUsable(card, player, num) {
						if (card.name === "sha") {
							return num + player.countMark("mogui_effect");
						}
					},
				},
			},
			hand: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/handcard.png",
				intro: { content: "手牌上限+#" },
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("mogui_hand");
					},
				},
			},
		},
	},
	zunjian: {
		audio: 2,
		derivation: ["mogui", "rencheng", "rencheng_rewrite"],
		trigger: { player: "phaseBegin" },
		filter(event, player) {
			return player.getStorage("mogui").length > 2;
		},
		juexingji: true,
		forced: true,
		skillAnimation: true,
		animationColor: "orange",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recover();
			const result = await player
				.chooseControl(["选项一", "选项二"])
				.set("prompt", "遵谏：请选择一项")
				.set("choiceList", ["摸两张牌并重置【漠规】", "回复1点体力，然后失去【漠规】并修改【仁诚】"])
				.set("ai", () => {
					const player = get.player();
					if (player.getDamagedHp() >= 2) {
						return "选项二";
					}
					return "选项一";
				})
				.forResult();
			if (result?.control === "选项一") {
				await player.draw(2);
				player.setStorage("mogui", [], true);
			} else if (result?.control === "选项二") {
				await player.recover();
				await player.removeSkills("mogui");
				player.storage.rencheng = true;
				game.log(player, "修改了", "#g【仁诚】");
			}
		},
		ai: { combo: "mogui" },
	},
	rencheng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		manualConfirm: true,
		async content(event, trigger, player) {
			const bool = player.storage[event.name];
			const num = bool ? 3 : 2;
			await player.draw(num);
			if (!game.hasPlayer(current => current != player) || !player.hasCards("he")) {
				return;
			}
			const result = await player
				.chooseCardTarget({
					prompt: `仁诚：你可交给一名其他角色至多${get.cnNumber(num)}张牌`,
					position: "he",
					selectCard: [1, num],
					filterTarget: lib.filter.notMe,
					ai1(card) {
						return 7 - get.value(card);
					},
					ai2(target) {
						const player = get.player();
						let att = get.attitude(player, target);
						if (target.hasSkillTag("nogain")) {
							att /= 10;
						}
						return att;
					},
				})
				.forResult();
			if (result?.bool && result.cards?.length && result.targets?.length) {
				const {
					targets: [target],
					cards,
				} = result;
				player.line(target);
				await player.give(cards, target);
				if (!bool) {
					return;
				}
				if (cards.some(card => get.type(card) === "basic")) {
					target.addSkill(event.name + "_effect");
				}
				if (cards.some(card => get.type2(card) === "trick") && game.hasPlayer(current => current.hasDiscardableCards(player, "hej"))) {
					const result = await player
						.chooseTarget({
							prompt: "仁诚：你可以选择一名角色，然后弃置其区域内的一张牌",
							filterTarget(card, player, target) {
								return target.hasDiscardableCards(player, "hej");
							},
							ai(target) {
								const player = get.player();
								return get.effect(target, { name: "guohe_copy" }, player, player);
							},
						})
						.forResult();
					if (result?.targets?.length) {
						const [target] = result.targets;
						player.line(target);
						await player.discardPlayerCard(target, "hej", true);
					}
				}
				if (cards.some(card => get.type(card) === "equip")) {
					await player.recover();
					await target.recover();
				}
			}
		},
		ai: {
			order: 7,
			result: { player: 1 },
		},
		subSkill: {
			rewrite: {},
			effect: {
				charlotte: true,
				mark: true,
				intro: { content: "下个出牌阶段使用牌无距离限制" },
				trigger: { player: "phaseUseBegin" },
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					player.addTempSkill("rencheng_nodistance", "phaseUseAfter");
				},
			},
			nodistance: {
				charlotte: true,
				mark: true,
				intro: { content: "本阶段使用牌无距离限制" },
				mod: {
					targetInRange(card, player, target) {
						return true;
					},
				},
			},
		},
	},
};
