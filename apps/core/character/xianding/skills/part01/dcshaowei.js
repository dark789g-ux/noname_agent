import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcshaowei" | "dcdichou">} */
export const groupSkills = {
	//威关银屏
	dcshaowei: {
		audio: 2,
		forced: true,
		locked: false,
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (event.name == "gain" && event.player == player) {
				return false;
			}
			const evt = event.getl(player);
			if (!evt?.cards2?.length) {
				return false;
			}
			return ["diamond", "heart"].some(suit => {
				return evt.cards2.some(i => get.suit(i, player) == suit) && !player.getStorage("dcshaowei_used")?.includes(suit);
			});
		},
		async content(event, trigger, player) {
			const evt = trigger.getl(player);
			if (!evt?.cards2?.length) {
				return;
			}
			const suits = ["diamond", "heart"].filter(suit => {
				return evt.cards2.some(i => get.suit(i, player) == suit) && !player.getStorage("dcshaowei_used")?.includes(suit);
			});
			if (suits.includes("diamond")) {
				let cardsx = [];
				while (cardsx.length < 3) {
					const card = get.cardPile2(i => get.color(i) == "red" && !cardsx.includes(i));
					if (card) {
						cardsx.push(card);
					} else {
						break;
					}
				}
				if (cardsx.length) {
					await player.gain(cardsx, "draw");
				}
				player.addTempSkill("dcshaowei_used");
				player.markAuto("dcshaowei_used", ["diamond"]);
			}
			if (suits.includes("heart")) {
				await player.recover();
				if (player.hasDisabledSlot()) {
					await player.chooseToEnable();
				}
				player.addTempSkill("dcshaowei_used");
				player.markAuto("dcshaowei_used", ["heart"]);
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				sub: true,
				sourceSkill: "dcshaowei",
			},
		},
	},
	dcdichou: {
		audio: 2,
		forced: true,
		intro: {
			content: "mark",
			name2: "仇",
		},
		marktext: "仇",
		trigger: {
			target: "useCardToTarget",
		},
		filter(event, player) {
			return event.player != player;
		},
		async content(event, trigger, player) {
			const target = trigger.player;
			if (target.isIn()) {
				target.addMark("dcdichou", 1);
			}
		},
		group: ["dcdichou_discard", "dcdichou_draw", "dcdichou_damage"],
		subSkill: {
			discard: {
				forced: true,
				trigger: {
					player: "phaseBegin",
				},
				filter(event, player) {
					return player.hasEnabledSlot() || game.countPlayer(i => i.countMark("dcdichou") && i.countDiscardableCards(player, "he"));
				},
				async content(event, trigger, player) {
					if (player.hasEnabledSlot()) {
						await player.chooseToDisable();
					}
					if (game.countPlayer(i => i.countMark("dcdichou") && i.countDiscardableCards(player, "he"))) {
						const result = await player
							.chooseTarget({
								prompt: "弃置一名有“仇”的角色一张牌",
								filterTarget(card, player, target) {
									return target.countMark("dcdichou") && target.countDiscardableCards(player, "he");
								},
								forced: true,
								ai: target => {
									return -get.attitude(get.player(), target);
								},
							})
							.forResult();
						const target = result.targets[0];
						const { links } = await player
							.discardPlayerCard({
								target,
								forced: true,
								position: "he",
							})
							.forResult();
						const card = links[0];
						if (!card) {
							return;
						}
						const num = get.translation(get.name(card)).length;
						if (!num) {
							return;
						}
						player.addTempSkill("dcdichou_eff");
						player.addMark("dcdichou_eff", num);
					}
				},
				sub: true,
				sourceSkill: "dcdichou",
			},
			eff: {
				audio: 2,
				charlotte: true,
				mark: true,
				intro: {
					content: "本回合攻击范围与使用【杀】的次数上限均+#",
				},
				onremove: true,
				mod: {
					attackRange(player, num) {
						return num + player.countMark("dcdichou_eff");
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("dcdichou_eff");
						}
					},
				},
				sub: true,
				sourceSkill: "dcdichou",
			},
			draw: {
				forced: true,
				trigger: {
					player: "useCardToPlayer",
				},
				filter(event, player) {
					return event.target.countMark("dcdichou");
				},
				async content(event, trigger, player) {
					const target = trigger.target;
					target.removeMark("dcdichou", 1);
					await player.draw();
				},
				sub: true,
				sourceSkill: "dcdichou",
			},
			damage: {
				forced: true,
				trigger: {
					player: "phaseEnd",
				},
				filter(event, player) {
					return game.countPlayer(i => i.countMark("dcdichou"));
				},
				async content(event, trigger, player) {
					const result = await player
						.chooseTarget({
							prompt: "对任意名有“仇”的角色各造成一点火焰伤害并移除其“仇”",
							selectTarget: [1, Infinity],
							forced: true,
							filterTarget: (card, player, target) => {
								return target.countMark("dcdichou");
							},
							ai: target => {
								const player = get.player();
								if (get.damageEffect(target, player, player, "fire") > 0) return 1;
								return 0;
							},
						})
						.forResult();
					if (!result.targets?.length) {
						return;
					}
					const targets = result.targets.sortBySeat();
					player.line(targets);
					for (let target of targets) {
						if (!target.isIn()) continue;
						target.damage("fire");
						target.removeMark("dcdichou", target.countMark("dcdichou"));
					}
				},
				sub: true,
				sourceSkill: "dcdichou",
			},
		},
	},
};
