import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbjuemou" | "dcsbfuzhan" | "dcsbchuanyu" | "dcsbyitou">} */
export const groupSkills = {
	//谋姜维
	dcsbjuemou: {
		audio: 2,
		audioname: ["dc_sb_jiangwei_shadow"],
		zhuanhuanji(player, skill) {
			player.storage[skill] = !player.storage[skill];
			player.changeSkin({ characterName: "dc_sb_jiangwei" }, "dc_sb_jiangwei" + (player.storage[skill] ? "_shadow" : ""));
		},
		marktext: "☯",
		mark: true,
		intro: {
			content(storage, player) {
				if (!storage) {
					return `当你使用锦囊牌时，${player.storage.dcsbjuemou_rewrite ? "或回合开始/结束时，" : ""}可对自己造成1点伤害并摸已损失体力值数张牌。`;
				}
				return `当你使用锦囊牌时，${player.storage.dcsbjuemou_rewrite ? "或回合开始/结束时，" : ""}可令一名角色弃置另一名角色一张牌并受到其造成的1点伤害。`;
			},
		},
		trigger: {
			player: ["useCard", "phaseBegin", "phaseEnd"],
		},
		filter(event, player) {
			if (event.name == "useCard") {
				return get.type2(event.card) == "trick";
			}
			return player.storage.dcsbjuemou_rewrite;
		},
		async cost(event, trigger, player) {
			const storage = player.storage.dcsbjuemou;
			if (!storage) {
				event.result = await player
					.chooseBool(`###${get.prompt(event.skill)}###对自己造成1点伤害并摸已损失体力值张牌`)
					.set("ai", () => true)
					.forResult();
			} else {
				event.result = await player
					.chooseTarget(`###${get.prompt(event.skill)}###令一名角色弃置另一名角色一张牌并受到其造成的1点伤害`, 2, (card, player, target) => {
						return true; //不检测可行性这一块
						/*const selected = ui.selected.targets;
						if (!selected.length) {
							return game.hasPlayer(targetx => targetx.countDiscardableCards(target, "he"));
						}
						return target.countDiscardableCards(selected[0], "he");*/
					})
					.set("complexTarget", true)
					.set("complexSelect", true)
					.set("targetprompt", ["受到伤害", "被弃牌"])
					.set("ai", target => {
						const selected = ui.selected.targets,
							player = get.player();
						if (!selected.length) {
							return Math.max(
								...game
									.filterPlayer(targetx => targetx.countDiscardableCards(target, "he"))
									.map(targetx => {
										return get.effect(targetx, { name: "guohe_copy2" }, target, player) + get.damageEffect(target, targetx, player);
									})
							);
						}
						return get.effect(selected[0], { name: "guohe_copy2" }, target, player) + get.damageEffect(target, selected[0], player);
					})
					.forResult();
			}
		},
		line: false,
		async content(event, trigger, player) {
			const storage = player.storage.dcsbjuemou;
			player.changeZhuanhuanji(event.name);
			if (!storage) {
				await player.damage();
				await player.draw(player.getDamagedHp());
			} else {
				const source = event.targets[0],
					target = event.targets[1];
				player.line2([source, target], "green");
				if (target.countDiscardableCards(source, "he")) {
					await source.discardPlayerCard(target, "he", true);
				}
				await source.damage(target);
			}
		},
		ai: {
			threaten: 1.5,
		},
		group: ["dcsbjuemou_change", "dcsbjuemou_recover"],
		subSkill: {
			recover: {
				audio: "dcsbjuemou",
				audioname: ["dc_sb_jiangwei_shadow"],
				trigger: { player: "dying" },
				filter(event, player) {
					return event.reason?.name == "damage" && event.reason.getParent()?.name == "dcsbjuemou";
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.recoverTo(1);
				},
			},
			rewrite: {
				charlotte: true,
			},
			change: {
				audio: "dcsbjuemou",
				audioname: ["dc_sb_jiangwei_shadow"],
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				prompt2(event, player) {
					return "切换【绝谋】为状态" + (player.storage.dcsbjuemou ? "阳" : "阴");
				},
				check: () => Math.random() > 0.5,
				content() {
					player.changeZhuanhuanji("dcsbjuemou");
				},
			},
		},
	},
	dcsbfuzhan: {
		audio: 2,
		audioname: ["dc_sb_jiangwei_shadow"],
		derivation: ["dcsbjuemou_rewrite"],
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		trigger: { global: "dyingAfter" },
		filter(event, player) {
			return event.player.isIn();
		},
		check(event, player) {
			if (player.hp <= 2) {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recoverTo(player.maxHp);
			player.storage.dcsbjuemou_rewrite = true;
			game.log(player, "修改了", "#g【绝谋】");
		},
	},
	//谋胡烈
	dcsbchuanyu: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return player.hasCards("he");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt(event.skill),
					prompt2: "将一张牌交给一名角色，称为“舆”",
					filterCard: true,
					position: "he",
					filterTarget: true,
					ai1(card) {
						const player = get.player();
						if (["equip", "delay"].includes(get.type(card))) {
							return 0;
						}
						return Math.max(0.1, player.getUseValue(card));
					},
					ai2(target) {
						const player = get.player();
						let att = get.attitude(player, target);
						if (target.hasSkillTag("nogain")) {
							att /= 9;
						}
						return 4 + att;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			if (!player.storage[event.name]) {
				player
					.when({ global: "roundStart" })
					.filter(evt => evt != trigger)
					.step(async () => {
						player.unmarkSkill("dcsbchuanyu");
						delete player.storage.dcsbchuanyu;
					});
			}
			const {
				cards,
				targets: [target],
			} = event;
			player.line(target);
			player.markAuto(event.name, target);
			if (target == player) {
				player.addGaintag(cards, event.name + "_tag");
			} else {
				await player.give(cards, target).set("gaintag", [event.name + "_tag"]);
			}
		},
		intro: { content: "本轮获得过“舆”的角色：$" },
		group: ["dcsbchuanyu_give", "dcsbchuanyu_discard"],
		subSkill: {
			give: {
				audio: "dcsbchuanyu",
				trigger: { global: ["cardsDiscardAfter"] },
				filter(event, player) {
					return lib.skill.dcsbchuanyu_give.getCards(event, player).length > 0 && game.hasPlayer(target => !player.getStorage("dcsbchuanyu").includes(target));
				},
				getCards(event, player) {
					const evt = event.getParent();
					if (evt.name !== "orderingDiscard") {
						return [];
					}
					const evt2 = evt.relatedEvent || evt.getParent();
					if (evt2.name != "useCard" || !event.getd?.()?.length) {
						return [];
					}
					const historys = game.getGlobalHistory("everything", evt => {
						if (evt.name != "lose" || evt.getParent() != evt2) {
							return false;
						}
						return Object.values(evt.gaintag_map).flat().includes("dcsbchuanyu_tag");
					});
					return event.getd().filter(card => {
						return historys.some(evt => evt.gaintag_map?.[card.cardid]?.includes("dcsbchuanyu_tag"));
					});
				},
				async cost(event, trigger, player) {
					const cards = lib.skill.dcsbchuanyu_give.getCards(trigger, player);
					event.result = await player
						.chooseTarget(`###${get.prompt(event.skill)}###将${get.translation(cards)}交给本轮未获得过“舆”的一名角色`, (card, player, target) => {
							return !player.getStorage("dcsbchuanyu").includes(target);
						})
						.set("ai", target => {
							const player = get.player(),
								val = get.event().val;
							let att = get.attitude(player, target);
							if (val < 4) {
								att = Math.max(0.1, att);
							}
							return att;
						})
						.set("val", Math.max(...cards.map(card => get.value(card))))
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0],
						cards = lib.skill.dcsbchuanyu_give.getCards(trigger, player);
					player.markAuto("dcsbchuanyu", target);
					await target.gain(cards, "gain2").set("gaintag", ["dcsbchuanyu_tag"]);
				},
			},
			discard: {
				audio: "dcsbchuanyu",
				trigger: { global: "roundEnd" },
				filter(event, player) {
					return game.hasPlayer(current => current.hasCards("h", card => card.hasGaintag("dcsbchuanyu_tag")));
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const lose_list = [];
					game.players.forEach(target => {
						const cards = target.getCards("h", card => card.hasGaintag("dcsbchuanyu_tag"));
						if (cards.length) {
							lose_list.push([target, cards]);
						}
					});
					if (lose_list.length) {
						await game
							.loseAsync({
								lose_list: lose_list,
								discarder: player,
							})
							.setContent("discardMultiple");
					}
					let list = player.getStorage("dcsbchuanyu").filter(target => target.isIn());
					const result = await player
						.chooseTarget("传舆：你可以选择一名角色", `${get.translation(list)}${list.length > 1 ? "依次" : ""}视为对其使用一张无距离限制的【杀】`)
						.set("ai", target => {
							const player = get.player();
							return get.effect(target, { name: "sha" }, player, player);
						})
						.forResult();
					if (result?.bool) {
						const target = result.targets[0];
						const card = get.autoViewAs({ name: "sha", isCard: true });
						list = list.filter(target => target.isIn()).sortBySeat();
						while (list.length) {
							const source = list.shift();
							if (source.canUse(card, target, false, false)) {
								await source.useCard(card, target, false);
							}
						}
					}
				},
			},
		},
	},
	dcsbyitou: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			return event.player != player && event.player.isMaxHandcard() && player.countCards("h");
		},
		check(event, player) {
			if (player.countCards("h", card => get.value(card) - 5) < 1) {
				return true;
			}
			return get.attitude(player, event.player) > 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player;
			player.addTempSkill(event.name + "_effect");
			player.markAuto(event.name + "_effect", target);
			await player.give(player.getCards("h"), target);
		},
		subSkill: {
			effect: {
				audio: "dcsbyitou",
				onremove: true,
				charlotte: true,
				forced: true,
				trigger: { global: "damageSource" },
				filter(event, player) {
					return player.getStorage("dcsbyitou_effect").includes(event.source);
				},
				async content(event, trigger, player) {
					await player.draw();
				},
				intro: { content: "players" },
			},
		},
	},
};
