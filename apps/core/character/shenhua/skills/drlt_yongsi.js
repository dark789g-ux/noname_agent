import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "drlt_yongsi" | "drlt_yongsi1" | "drlt_weidi" | "drlt_xiongluan" | "drlt_congjian" | "drlt_wanglie">} */
export const groupSkills = {
	drlt_yongsi: {
		audio: 2,
		group: ["drlt_yongsi_1", "drlt_yongsi_2"],
		locked: true,
		subSkill: {
			1: {
				audio: "drlt_yongsi",
				trigger: {
					player: "phaseDrawBegin2",
				},
				forced: true,
				filter(event, player) {
					return !event.numFixed;
				},
				async content(event, trigger, player) {
					trigger.num = game.countGroup();
				},
			},
			2: {
				audio: "drlt_yongsi",
				trigger: {
					player: "phaseUseEnd",
				},
				forced: true,
				filter(event, player) {
					let num = 0;
					player.getHistory("sourceDamage", function (evt) {
						if (evt.getParent("phaseUse") == event) {
							num += evt.num;
						}
					});
					return !num || num > 1;
				},
				async content(event, trigger, player) {
					let numx = 0;
					player.getHistory("sourceDamage", function (evt) {
						if (evt.getParent("phaseUse") == trigger) {
							numx += evt.num;
						}
					});
					if (!numx) {
						const num = player.hp - player.countCards("h");
						if (num > 0) {
							await player.draw(num);
						}
					} else {
						player.addTempSkill("drlt_yongsi1", { player: "phaseDiscardAfter" });
					}
				},
			},
		},
	},
	drlt_yongsi1: {
		mod: {
			maxHandcard(player, num) {
				return num + player.maxHp - 2 * Math.max(0, player.hp);
			},
		},
	},
	drlt_weidi: {
		audio: 2,
		forceaudio: true,
		zhuSkill: true,
		trigger: { player: "phaseDiscardBegin" },
		filter(event, player) {
			if (!player.hasZhuSkill("drlt_weidi")) {
				return false;
			}
			return (
				player.needsToDiscard() > 0 &&
				game.countPlayer(function (current) {
					return current != player && current.group == "qun";
				}) > 0
			);
		},
		async cost(event, trigger, player) {
			const num = Math.min(
				player.needsToDiscard(),
				game.countPlayer(function (target) {
					return target != player && target.group == "qun";
				})
			);
			if (!num) {
				return;
			}
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt(event.skill),
					prompt2: "你可以将" + (num > 1 ? "至多" : "") + get.cnNumber(num) + "张手牌交给等量的其他群势力角色。先按顺序选中所有要给出的手牌，然后再按顺序选择等量的目标角色",
					selectCard: [1, num],
					selectTarget() {
						return ui.selected.cards.length;
					},
					filterTarget(card, player, target) {
						return target != player && target.group == "qun";
					},
					complexSelect: true,
					filterOk() {
						return ui.selected.cards.length == ui.selected.targets.length;
					},
					ai1(card) {
						const player = _status.event.player;
						const value = get.value(card, player, "raw");
						if (
							game.hasPlayer(function (target) {
								return target != player && target.group == "qun" && !ui.selected.targets.includes(target) && get.sgn(value) == get.sgn(get.attitude(player, target));
							})
						) {
							return 1 / Math.max(1, get.useful(card));
						}
						return -1;
					},
					ai2(target) {
						const player = _status.event.player;
						const card = ui.selected.cards[ui.selected.targets.length];
						if (card && get.value(card, player, "raw") < 0) {
							return -get.attitude(player, target);
						}
						return get.attitude(player, target);
					},
				})
				.forResult();
			if (event.result.bool) {
				event.result.bool = event.result.cards.length > 0;
			}
		},
		async content(event, trigger, player) {
			const list = [];
			for (let i = 0; i < event.targets.length; i++) {
				const target = event.targets[i];
				const card = event.cards[i];
				list.push([target, card]);
			}
			await game
				.loseAsync({
					gain_list: list,
					player: player,
					cards: event.cards,
					giver: player,
					animate: "giveAuto",
				})
				.setContent("gaincardMultiple");
		},
	},
	drlt_xiongluan: {
		audio: 2,
		mod: {
			aiOrder(player, card, num) {
				if (num <= 0 || !player.isPhaseUsing() || player.needsToDiscard() || !get.tag(card, "damage")) {
					return;
				}
				return 0;
			},
			aiUseful(player, card, num) {
				if (num <= 0 || !get.tag(card, "damage")) {
					return;
				}
				return num * player.getHp();
			},
		},
		locked: false,
		enable: "phaseUse",
		skillAnimation: true,
		animationColor: "gray",
		limited: true,
		filter(event, player) {
			return !player.isDisabledJudge() || player.hasEnabledSlot();
		},
		filterTarget(card, player, target) {
			return target != player;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const disables = [];
			for (let i = 1; i <= 5; i++) {
				for (let j = 0; j < player.countEnabledSlot(i); j++) {
					disables.push(i);
				}
			}
			if (disables.length > 0) {
				await player.disableEquip(disables);
			}
			await player.disableJudge();
			const { target } = event;
			player.addTempSkill(event.name + "_effect");
			player.markAuto(event.name + "_effect", [target]);
			target.addTempSkill(event.name + "_ban");
		},
		ai: {
			order: 13,
			result: {
				target: (player, target) => {
					let hs = player.countCards("h", card => {
							if (!get.tag(card, "damage") || get.effect(target, card, player, player) <= 0) {
								return 0;
							}
							if (get.name(card, player) === "sha") {
								if (target.getEquip("bagua")) {
									return 0.5;
								}
								if (target.getEquip("rewrite_bagua")) {
									return 0.25;
								}
							}
							return 1;
						}),
						ts =
							target.hp +
							target.hujia +
							game.countPlayer(current => {
								if (get.attitude(current, target) > 0) {
									return current.countCards("hs") / 8;
								}
								return 0;
							});
					if (hs >= ts) {
						return -hs;
					}
					return 0;
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					targetInRange(card, player, target) {
						if (player.getStorage("drlt_xiongluan_effect").includes(target)) {
							return true;
						}
					},
					cardUsableTarget(card, player, target) {
						if (player.getStorage("drlt_xiongluan_effect").includes(target)) {
							return true;
						}
					},
				},
				intro: { content: "本回合对$使用牌无距离和次数限制且其不能使用和打出手牌" },
			},
			ban: {
				charlotte: true,
				mark: true,
				mod: {
					cardEnabled2(card, player) {
						if (get.position(card) == "h") {
							return false;
						}
					},
				},
				intro: { content: "本回合不能使用或打出手牌" },
				ai: {
					effect: {
						target(card, player, target) {
							if (!target._drlt_xiongluan2_effect && get.tag(card, "damage")) {
								target._drlt_xiongluan2_effect = true;
								const eff = get.effect(target, card, player, target);
								delete target._drlt_xiongluan2_effect;
								if (eff > 0) {
									return [1, -999999];
								}
								if (eff < 0) {
									return 114514;
								}
							}
						},
					},
				},
			},
		},
	},
	drlt_congjian: {
		audio: 2,
		audioname2: { tongyuan: "ocongjian_tongyuan" },
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return get.type(event.card) == "trick" && event.targets.length > 1 && player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterCard: true,
					position: "he",
					filterTarget(card, player, target) {
						return player != target && _status.event.targets.includes(target);
					},
					ai1(card) {
						const player = get.player();
						if (card.name == "du") {
							return 20;
						}
						if (player.storage.drlt_xiongluan && get.type(card) == "equip") {
							return 15;
						}
						return 6 - get.value(card);
					},
					ai2(target) {
						const player = get.player();
						const att = get.attitude(player, target);
						if (ui.selected.cards.length && ui.selected.cards[0].name == "du") {
							if (target.hasSkillTag("nodu")) {
								return 0.1;
							}
							return 1 - att;
						}
						return att - 3;
					},
					prompt: get.prompt2(event.skill),
					targets: trigger.targets,
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.give(event.cards, target, "give");
			const num = get.type(event.cards[0]) == "equip" ? 2 : 1;
			await player.draw(num);
		},
	},
	drlt_wanglie: {
		locked: false,
		mod: {
			targetInRange(card, player, target, now) {
				if (game.online) {
					if (!player.countUsed()) {
						return true;
					}
				} else {
					const evt = _status.event.getParent("phaseUse");
					if (
						evt &&
						evt.name == "phaseUse" &&
						player.getHistory("useCard", function (evt2) {
							return evt2.getParent("phaseUse") == evt;
						}).length == 0
					) {
						return true;
					}
				}
			},
		},
		audio: 2,
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			return player.isPhaseUsing() && (event.card.name == "sha" || get.type(event.card) == "trick");
		},
		preHidden: true,
		check(event, player) {
			if (["wuzhong", "kaihua", "dongzhuxianji"].includes(event.card.name)) {
				return false;
			}
			player._wanglie_temp = true;
			let eff = 0;
			for (const i of event.targets) {
				eff += get.effect(i, event.card, player, player);
			}
			delete player._wanglie_temp;
			if (eff < 0) {
				return true;
			}
			if (
				!player.countCards("h", function (card) {
					return player.hasValueTarget(card, null, true);
				})
			) {
				return true;
			}
			if (
				get.tag(event.card, "damage") &&
				!player.needsToDiscard() &&
				!player.countCards("h", function (card) {
					return get.tag(card, "damage") && player.hasValueTarget(card, null, true);
				})
			) {
				return true;
			}
			return false;
		},
		prompt2(event) {
			return "令" + get.translation(event.card) + "不能被响应，然后本阶段不能再使用牌";
		},
		async content(event, trigger, player) {
			trigger.nowuxie = true;
			trigger.directHit.addArray(game.players);
			player.addTempSkill("drlt_wanglie2", "phaseUseAfter");
		},
		ai: {
			pretao: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "pretao") {
					return true;
				}
				if (player._wanglie_temp) {
					return false;
				}
				player._wanglie_temp = true;
				const bool = (function () {
					if (["wuzhong", "kaihua", "dongzhuxianji"].includes(arg.card.name)) {
						return false;
					}
					if (get.attitude(player, arg.target) > 0 || !player.isPhaseUsing()) {
						return false;
					}
					let cards = player.getCards("h", function (card) {
						return card != arg.card && (!arg.card.cards || !arg.card.cards.includes(card));
					});
					let sha = player.getCardUsable("sha");
					if (arg.card.name == "sha") {
						sha--;
					}
					cards = cards.filter(function (card) {
						if (card.name == "sha" && sha <= 0) {
							return false;
						}
						return player.hasValueTarget(card, null, true);
					});
					if (!cards.length) {
						return true;
					}
					if (!get.tag(arg.card, "damage")) {
						return false;
					}
					if (
						!player.needsToDiscard() &&
						!cards.filter(function (card) {
							return get.tag(card, "damage");
						}).length
					) {
						return true;
					}
					return false;
				})();
				delete player._wanglie_temp;
				return bool;
			},
		},
	},
};
