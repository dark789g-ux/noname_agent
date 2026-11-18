import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dccuxi" | "dcduorui" | "dczhiti">} */
export const groupSkills = {
	//神张辽
	dccuxi: {
		audio: 2,
		trigger: {
			global: "phaseBegin",
		},
		filter(event, player) {
			return event.player !== player && event.player.isIn() && player.countDiscardableCards(player, "he") >= 2;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard({
					prompt: `是否弃置两张牌对${get.translation(trigger.player)}发动“${get.translation(event.skill)}”？`,
					prompt2: "令其选择让你执行该摸牌阶段，或受到你造成的一点伤害",
					position: "he",
					selectCard: [2, 2],
					ai(card) {
						return 6 - get.value(card);
					},
					chooseonly: true,
				})
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.discard({ cards: event.cards, discarder: player });
			const result = await trigger.player
				.chooseControl({
					choiceList: [`让${get.translation(player)}执行你本回合摸牌阶段`, `受到${get.translation(player)}造成的一点伤害`],
					ai(event, player) {
						if (get.damageEffect(player, event.player, player) >= 0 || player.getHp() > 3) {
							return 1;
						}
						return 0;
					},
				})
				.forResult();
			if (result?.control && result.control != "cancel2") {
				if (result.index === 0) {
					trigger.player.addTempSkill(`${event.name}_draw`);
					trigger.player.setStorage(`${event.name}_draw`, player, true);
					trigger.player.markSkillCharacter(`${event.name}_draw`, player, "猝袭", `本回合的摸牌阶段被${get.translation(player)}夺取`);
				} else {
					await trigger.player.damage({ num: 1, source: player });
				}
			}
		},
		subSkill: {
			draw: {
				charlotte: true,
				onremove: true,
				trigger: {
					player: "phaseDrawBefore",
				},
				filter(event, player) {
					return player.getStorage("dccuxi_draw")?.isIn();
				},
				silent: true,
				async content(event, trigger, player) {
					const source = player.getStorage("dccuxi_draw");
					source.logSkill(event.name, player);
					trigger.player = source;
				},
			},
		},
	},
	dcduorui: {
		audio: 2,
		trigger: {
			source: "damageBegin1",
		},
		filter(event, player) {
			return event.player.hasEnabledSlot() || event.player.getSkills(null, false).length;
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseControl({
					prompt: get.prompt(event.skill, trigger.player),
					controls: ["cancel2"],
					choiceList: [`废除其一个装备栏直到你的下个出牌阶段开始`, `令其武将牌上的一个技能失效直到你的下个出牌阶段开始`],
					ai(event, player) {
						const target = event.getTrigger().player;
						if (get.attitude(player, target) > 0) {
							return "cancel2";
						} else if (target.hasSkillTag("maixie")) {
							return 1;
						} else if (target.hasCards("e")) {
							return 0;
						}
						return 1;
					},
				})
				.forResult();
			event.result = {
				bool: result?.control !== "cancel2",
				targets: [trigger.player],
				cost_data: { index: result?.index ?? null },
			};
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: { index },
			} = event;
			const storage = player.getStorage(event.name, []);
			let phseUse = trigger.getParent(evt => evt.name === "phaseUse" && evt.player === player, true);
			let info = storage.find(info => info.player === target && info.phaseUse === phseUse);
			let infoIndex = storage.findIndex(info => info.player === target && info.phaseUse === phseUse);
			if (phseUse == undefined) {
				phseUse = "next";
			}
			if (!info) {
				infoIndex = "add";
				info = { player: target, phaseUse: phseUse };
			}
			if (index === 0) {
				const result = await target.chooseToDisable({ source: player }).forResult();
				if (result?.control && result.control !== "cancel2") {
					info.equip ??= [];
					info.equip.push(result.control);
				}
			} else {
				const undisabledSkill = target.getSkills(null, false);
				const result = await player
					.chooseSkill(target, {
						prompt: `选择失效${get.translation(target)}一项技能`,
						func: (info, skill) => !info.charlotte && undisabledSkill.includes(skill),
					})
					.forResult();
				if (result?.bool) {
					target.disableSkill(`${event.name}_${player.playerid}`, result.skill);
					info.skill ??= [];
					info.skill.push(result.skill);
				}
			}
			if (info.equip?.length || info.skill?.length) {
				if (infoIndex === "add") {
					storage.add(info);
				} else {
					storage[infoIndex] = info;
				}
				player.setStorage(event.name, storage, true);
			}
		},
		group: "dcduorui_restore",
		subSkill: {
			restore: {
				charlotte: true,
				trigger: {
					player: "phaseUseBegin",
				},
				filter(event, player) {
					const storage = player.getStorage("dcduorui", []);
					return storage.some(info => {
						if (!info.player?.isIn() || info.phaseUse === event) {
							return false;
						}
						return info.equip?.length || info.skill?.length;
					});
				},
				forced: true,
				silent: true,
				async content(event, trigger, player) {
					lib.tempSortSeat = player;
					const storage = player.getStorage("dcduorui", []).sort(({ player: a }, { player: b }) => lib.sort.seat(a, b));
					delete lib.tempSortSeat;
					const newStorage = [];
					while (storage.length) {
						const info = storage.shift();
						if (!info.player?.isIn() || info.phaseUse == trigger) {
							newStorage.push(info);
						}
						if (!info.equip?.length && !info.skill?.length) {
							continue;
						}
						if (info.equip?.length) {
							await info.player.enableEquip(info.equip);
						}
						if (info.skill?.length) {
							info.player.enableSkill(`dcduorui_${player.playerid}`);
						}
					}
					player.setStorage("dcduorui", newStorage, true);
				},
			},
		},
	},
	dczhiti: {
		audio: 2,
		trigger: {
			player: "phaseDrawBegin2",
		},
		filter(event, player) {
			if (event.numFixed) {
				return false;
			}
			return game.hasPlayer(current => current.hasDisabledSlot());
		},
		forced: true,
		async content(event, trigger, player) {
			trigger.num += game.countPlayer(current => current.countDisabledSlot());
		},
		group: "dczhiti_drawEnd",
		subSkill: {
			drawEnd: {
				audio: "dczhiti",
				trigger: {
					global: "phaseDiscardEnd",
				},
				filter(event, player) {
					return event.player !== player && event.player.hasDisabledSlot() && event.player.hasDiscardableCards(player, "hej");
				},
				async cost(event, trigger, player) {
					event.result = await player
						.discardPlayerCard({
							target: trigger.player,
							position: "hej",
							selectButton: trigger.player.countDisabledSlot(),
							allowChooseAll: true,
							chooseonly: true,
						})
						.forResult();
				},
				logTarget: "player",
				async content(event, trigger, player) {
					await trigger.player.discard({ cards: event.cards, discarder: player });
				},
			},
		},
	},
};
