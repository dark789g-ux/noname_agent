import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjijie" | "dchuiji" | "dczhimin" | "dcjujian">} */
export const groupSkills = {
	//SP甄宓
	dcjijie: {
		audio: 2,
		trigger: {
			global: ["gainAfter", "loseAsyncAfter", "recoverAfter"],
		},
		getIndex(event, player) {
			if (event.name !== "loseAsync") {
				return [[event.player]];
			}
			return [
				game
					.filterPlayer(current => {
						return current !== player && _status.currentPhase !== current && event.getg(current).length > 0;
					})
					.sortBySeat(),
			];
		},
		filter(event, player, triggername, targets) {
			if (player.getStorage("dcjijie_used").includes(event.name == "recover" ? "recover" : "draw")) {
				return false;
			}
			if (event.name === "recover") {
				return targets[0] !== player && _status.currentPhase !== targets[0] && player.isDamaged();
			}
			return targets.some(current => {
				return current !== player && _status.currentPhase !== current && event.getg(current).length > 0;
			});
		},
		forced: true,
		logTarget(event, player, triggername, targets) {
			return targets;
		},
		async content(event, trigger, player) {
			player.addTempSkill("dcjijie_used");
			if (trigger.name === "recover") {
				player.markAuto("dcjijie_used", ["recover"]);
				await player.recover(trigger.num);
			} else {
				const count = game.countPlayer(current => {
					if (current === player || _status.currentPhase === current) {
						return 0;
					}
					return trigger.getg(current).length;
				});
				player.markAuto("dcjijie_used", ["draw"]);
				await player.draw(count);
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	dchuiji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		chooseButton: {
			dialog(event, player) {
				const name = get.translation(event.result.targets[0]);
				const dialog = ui.create.dialog(
					`惠济：请选择要令${name}执行的选项`,
					[
						[
							["draw", "令其摸两张牌"],
							["equip", "令其随机使用牌堆中的一张装备牌"],
						],
						"textbutton",
					],
					"hidden"
				);
				return dialog;
			},
			filter(button, player) {
				const target = get.event().getParent().result.targets[0];
				if (button.link === "equip" && target.isMin()) {
					return false;
				}
				return true;
			},
			check(button) {
				const player = get.player(),
					target = get.event().getParent().result.targets[0];
				const link = button.link;
				const att = Math.sign(get.attitude(player, target));
				const drawWugu = target.countCards("h") + 2 >= game.countPlayer();
				if (link === "draw") {
					return (drawWugu ? -1 : 2) * att;
				}
				return 1;
			},
			backup(links) {
				return {
					audio: "dchuiji",
					target: get.event().result.targets[0],
					link: links[0],
					filterTarget(card, player, target) {
						return target === lib.skill.dchuiji_backup.target;
					},
					selectTarget: -1,
					async content(event, trigger, player) {
						const link = lib.skill.dchuiji_backup.link;
						const { target } = event;
						if (link === "draw") {
							await target.draw(2);
						} else {
							const card = get.cardPile2(card => {
								if (get.type(card) !== "equip") {
									return false;
								}
								return target.canUse(card, target) && !get.cardtag(card, "gifts");
							});
							if (card) {
								await target.chooseUseTarget(card, true).set("nopopup", true);
							} else {
								game.log("但是牌堆里没有", target, "的装备！");
								await game.delayx();
							}
						}
						if (target.countCards("h") >= game.countPlayer()) {
							target.addTempSkill("dchuiji_effect");
							target.markAuto("dchuiji_effect", [event]);
							const card = new lib.element.VCard({ name: "wugu", storage: { fixedShownCards: [] }, isCard: true });
							if (target.hasUseTarget(card)) {
								await target.chooseUseTarget(card, true, false);
							}
						}
					},
				};
			},
			prompt(links) {
				return "点击“确定”以执行效果";
			},
		},
		subSkill: {
			backup: {},
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { player: "wuguContentBeforeBefore", global: "wuguRemained" },
				filter(event, player) {
					if (!player.getStorage("dchuiji_effect").includes(event.getParent(3))) {
						return false;
					}
					return event.name == "wuguContentBefore" || event.remained.someInD();
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					if (trigger.name == "wuguContentBefore") {
						trigger.card.storage ??= {};
						trigger.card.storage.fixedShownCards = player.getCards("h");
					} else {
						const remained = trigger.remained.filterInD();
						if (remained.length) {
							player.gain(remained, "gain2");
						}
					}
				},
			},
		},
		ai: {
			order(item, player) {
				if (!game.hasPlayer(current => current !== player && get.attitude(player, current) > 0) && game.hasPlayer(current => get.attitude(player, current) <= 0)) {
					return 10;
				}
				if (
					game.hasPlayer(current => {
						const del = player.countCards("h") - current.countCards("h"),
							toFind = [2, 4].find(num => Math.abs(del) === num);
						if (toFind === 4 && del < 0 && get.attitude(player, current) <= 0) {
							return true;
						}
						return false;
					})
				) {
					return 10;
				}
				return 1;
			},
			result: {
				target(player, target) {
					const att = get.attitude(player, target);
					const wugu = target.countCards("h") + 2 > game.countPlayer();
					if (wugu) {
						return Math.min(0, att) * Math.min(3, target.countCards("h"));
					}
					return Math.max(0, att) * Math.min(3, target.countCards("h"));
				},
			},
		},
	},
	//曹芳
	dczhimin: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return game.hasPlayer(current => current != player && current.countCards("h")) && player.getHp() > 0;
		},
		forced: true,
		group: ["dczhimin_mark", "dczhimin_draw"],
		async content(event, trigger, player) {
			const result = await player
				.chooseTarget(
					`置民：请选择至多${get.cnNumber(player.getHp())}名其他角色`,
					"你获得这些角色各自手牌中的随机一张点数最小的牌",
					(card, player, target) => {
						return target !== player && target.countCards("h");
					},
					[1, player.getHp()],
					true
				)
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "shunshou_copy", position: "h" }, player, player) + 0.1;
				})
				.forResult();
			if (!result?.targets?.length) {
				return;
			}
			const targets = result.targets.sortBySeat();
			player.line(targets, "thunder");
			const toGain = [];
			for (const target of targets) {
				const cards = target.getCards("h"),
					minNumber = cards.map(card => get.number(card)).sort((a, b) => a - b)[0];
				const gainableCards = cards
					.filter(card => {
						return get.number(card) === minNumber && lib.filter.canBeGained(card, player, target);
					})
					.randomSort();
				toGain.push(gainableCards[0]);
			}
			if (toGain.length) {
				await player.gain(toGain, "giveAuto");
			}
			await game.delayx();
		},
		ai: { threaten: 5.8 },
		mod: {
			aiOrder(player, card, num) {
				if (
					num > 0 &&
					get.itemtype(card) === "card" &&
					card.hasGaintag("dczhimin_tag") &&
					player.countCards("h", cardx => {
						return cardx.hasGaintag("dczhimin_tag") && cardx !== card;
					}) < player.maxHp
				) {
					return num / 10;
				}
			},
		},
		subSkill: {
			mark: {
				audio: "dczhimin",
				trigger: {
					player: "gainAfter",
					global: "loseAsyncAfter",
				},
				forced: true,
				filter(event, player) {
					if (_status.currentPhase === player || !event.getg(player).some(card => get.position(card) === "h" && get.owner(card) === player)) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					player.addGaintag(
						trigger.getg(player).filter(card => get.position(card) === "h" && get.owner(card) === player),
						"dczhimin_tag"
					);
				},
			},
			draw: {
				audio: "dczhimin",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				forced: true,
				filter(event, player) {
					const evt = event.getl(player);
					if (!evt.hs.length || player.maxHp <= player.countCards("h")) {
						return false;
					}
					return Object.values(evt.gaintag_map).flat().includes("dczhimin_tag");
				},
				async content(event, trigger, player) {
					await player.drawTo(player.maxHp);
				},
			},
		},
	},
	dcjujian: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		zhuSkill: true,
		filter(event, player) {
			return game.hasPlayer(current => {
				return player.hasZhuSkill("dcjujian", current) && current.group === "wei" && current !== player;
			});
		},
		filterTarget(_, player, target) {
			return player.hasZhuSkill("dcjujian", target) && target.group === "wei" && target !== player;
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.draw();
			target.addTempSkill("dcjujian_forbid", "roundStart");
			target.markAuto("dcjujian_forbid", player);
		},
		ai: {
			result: {
				target(player, target) {
					const num = target.countCards("hs", card => {
							return get.type(card) == "trick" && target.canUse(card, player) && get.effect(player, card, target, player) < -2;
						}),
						att = get.attitude(player, target);
					if (att < 0) {
						return -0.74 * num;
					}
					return 1.5;
				},
			},
		},
		subSkill: {
			forbid: {
				audio: "dcjujian",
				trigger: {
					player: "useCardToBefore",
				},
				filter(event, player) {
					if (get.type(event.card) !== "trick") {
						return false;
					}
					return player.getStorage("dcjujian_forbid").includes(event.target);
				},
				forced: true,
				charlotte: true,
				onremove: true,
				direct: true,
				async content(event, trigger, player) {
					await trigger.target.logSkill("dcjujian_forbid", player);
					trigger.cancel();
				},
				intro: {
					content: "使用普通锦囊牌对$无效",
				},
				ai: {
					effect: {
						player(card, player, target, current) {
							if (get.type(card) == "trick" && player.getStorage("dcjujian_forbid").includes(target)) {
								return "zeroplayertarget";
							}
						},
					},
				},
			},
		},
	},
};
