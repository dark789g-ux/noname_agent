import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczixi" | "dckrmingshi" | "dcmanwang" | "dcpanqin">} */
export const groupSkills = {
	//乐大乔
	dczixi: {
		init() {
			game.addGlobalSkill("dczixi_judge");
			game.broadcastAll(() => lib.skill.dczixi.video());
		},
		video() {
			const list = lib.skill.dczixi.zixiList;
			for (const name of list) {
				const namex = "dczixi_" + name;
				if (!lib.card[namex]) {
					lib.card[namex] = {
						type: "special_delay",
						fullskin: true,
						noEffect: true,
						wuxieable: false,
					};
					lib.card[namex].cardimage = name;
					lib.translate[namex] = lib.translate[name] + "·姊希";
					lib.translate[namex + "_info"] = "由【姊希】技能创造的无效果【" + lib.translate[name] + "】";
				}
			}
		},
		audio: 2,
		trigger: { player: ["phaseUseBegin", "phaseUseEnd"] },
		filter(event, player) {
			return (
				player.hasCards("he", card => {
					return (
						card.hasGaintag("eternal_dcqiqin_tag") &&
						lib.skill.dczixi.zixiList.some(name => {
							return game.hasPlayer(target => target.canAddJudge(get.autoViewAs({ name: "dczixi_" + name }, [card])));
						})
					);
				}) > 0
			);
		},
		zixiList: ["lebu", "bingliang", "shandian"],
		selectAi(player, names) {
			let max = [null, 0, null, null];
			for (let name of names) {
				let res = [null, null, 0];
				player.getCards("he", i => {
					if (!i.hasGaintag("eternal_dcqiqin_tag") || get.value(i) >= 7) {
						return false;
					}
					game.countPlayer(target => {
						if (!target.canAddJudge(get.autoViewAs({ name: "dczixi_" + name }, [i]))) {
							return;
						}
						let eff = get.effect(target, get.autoViewAs({ name }, [i]), player, player);
						if (get.attitude(player, target) > 0) {
							if (-eff > res[2]) {
								res = [target, i, -eff / 16];
							} //避免人机一直贴队友
						} else {
							if (eff > res[2]) {
								res = [target, i, eff];
							}
						}
					});
				});
				if (res[0] && res[2] > max[1]) {
					max = [get.translation(name), res[2], res[1], res[0]];
				}
			}
			return max;
		},
		direct: true,
		async content(event, trigger, player) {
			game.addVideo("skill", player, ["dczixi", []]);
			const names = lib.skill.dczixi.zixiList.filter(name => {
				return player.hasCards("he", card => {
					return card.hasGaintag("eternal_dcqiqin_tag") && game.hasPlayer(target => target.canAddJudge(get.autoViewAs({ name: "dczixi_" + name }, [card])));
				});
			});
			let map = {};
			for (const name of names) {
				map[get.translation(name)] = name;
			}
			let max = lib.skill.dczixi.selectAi(player, Object.values(map));
			const dialog = [];
			dialog.push(`###${get.prompt("dczixi")}###<div class="text center">将一张“琴”以你选择的牌名置于一名角色的判定区</div>`);
			const hs = player.getCards("h", card => card.hasGaintag("eternal_dcqiqin_tag"));
			const es = player.getCards("e", card => card.hasGaintag("eternal_dcqiqin_tag"));
			if (hs.length) {
				dialog.addArray(['<div class="text center">你的手牌</div>', hs]);
			}
			if (es.length) {
				dialog.addArray(['<div class="text center">你的装备</div>', es]);
			}
			dialog.push([Object.keys(map), "tdnodes"]);
			const { bool, links } = await player
				.chooseButton(2)
				.set("createDialog", dialog)
				.set("filterButton", button => {
					const type = typeof button.link,
						card = button.link;
					if (ui.selected.buttons.length && type == typeof ui.selected.buttons[0].link) {
						return false;
					}
					if (type == "string") {
						return true;
					}
					return (
						card.hasGaintag("eternal_dcqiqin_tag") &&
						lib.skill.dczixi.zixiList.some(name => {
							return game.hasPlayer(target => target.canAddJudge(get.autoViewAs({ name: "dczixi_" + name }, [card])));
						})
					);
				})
				.set("ai", button => {
					if (typeof button.link == "string") {
						if (button.link == get.event().max[0]) {
							return 1;
						}
						return 0;
					}
					if (button.link == get.event().max[2]) {
						return 1;
					}
					return 0;
				})
				.set("max", max)
				.forResult();
			if (bool) {
				const name = links.find(i => typeof i == "string"),
					card = links.find(j => j != name),
					cardname = map[name];
				const { bool, targets } = await player
					.chooseTarget(
						"请选择【" + name + "（" + get.translation(card) + "）】置入的目标",
						(cardx, player, target) => {
							return target.canAddJudge(get.autoViewAs({ name: "dczixi_" + get.event().cardname }, [get.event().card]));
						},
						true
					)
					.set("ai", target => {
						if (target == get.event().max[3]) {
							return 1;
						}
						return 0;
					})
					.set("card", card)
					.set("cardname", cardname)
					.set("max", max)
					.forResult();
				if (bool) {
					const target = targets[0];
					player.logSkill("dczixi", target);
					player.$give(card, target, false);
					await game.delay(0.5);
					target.addJudge({ name: "dczixi_" + cardname }, [card]);
				}
			}
		},
		ai: { combo: "dcqiqin" },
		group: "dczixi_effect",
		subSkill: {
			judge: {
				mod: {
					targetEnabled(card, player, target) {
						const list = lib.skill.dczixi.zixiList;
						const name = typeof card == "string" ? card : card.viewAs ? card.viewAs : card.name;
						if (name.indexOf("dczixi_") == 0) {
							const namex = name.slice("dczixi_".length);
							if (list.includes(namex) && target.hasJudge(namex)) {
								return false;
							}
						} else if (list.includes(name) && target.hasJudge("dczixi_" + name)) {
							return false;
						}
					},
				},
				ai: {
					threaten(player, target) {
						if (!player.hasSkill("dczixi") || ![1, 2, 3].includes(target.countCards("j"))) {
							return;
						}
						return 3 + target.countCards("j");
					},
				},
			},
			effect: {
				audio: "dczixi",
				trigger: { player: "useCardToTargeted" },
				filter(event, player) {
					return event.isFirstTarget && event.targets.length == 1 && [1, 2, 3].includes(event.target.countCards("j")) && (get.type(event.card) == "basic" || get.type(event.card) == "trick");
				},
				prompt2(event, player) {
					const target = event.target,
						str = get.translation(target);
					return ["令" + get.translation(event.card) + "对" + str + "额外结算一次", "摸两张牌", "弃置" + str + "判定区里的所有牌，对其造成3点伤害"][target.countCards("j") - 1];
				},
				check(event, player) {
					const target = event.target,
						num = target.countCards("j");
					if (num == 2) {
						return true;
					}
					if (num == 1) {
						return get.effect(target, event.card, player, player) > 0;
					}
					return get.attitude(player, target) < 0 && get.damageEffect(target, player, player) > 0;
				},
				logTarget: "target",
				async content(event, trigger, player) {
					const target = trigger.target,
						num = target.countCards("j");
					switch (num) {
						case 1:
							trigger.getParent().effectCount++;
							game.log(trigger.card, "额外结算一次");
							break;
						case 2:
							await player.draw(2);
							break;
						case 3:
							await target.discard(target.getCards("j"), player);
							await target.damage(3);
							break;
					}
				},
				ai: {
					effect: {
						player_use(card, player, target) {
							if (!target || player._dczixi_effect_use || get.tag(card, "multitarget")) {
								return;
							}
							let js = target.countCards("j");
							if (js == 1) {
								return [2, 0, 2, 0];
							} else if (js == 2) {
								return [1, 2];
							} else if (js == 3 && get.attitude(player, target) < 0) {
								player._dczixi_effect_use = true;
								let eff = get.damageEffect(target, player, player);
								delete player._dczixi_effect_use;
								if (eff > 0) {
									return [1, 0, 1, -6];
								}
							}
						},
					},
				},
			},
		},
	},
	//孔融
	dckrmingshi: {
		audio: "mingshi",
		trigger: { player: "damageBegin4" },
		filter(event, player) {
			return event.source && event.source.countCards("h") > player.countCards("h");
		},
		forced: true,
		logTarget: "source",
		async content(event, trigger, player) {
			const target = trigger.source;
			const { bool } = await target
				.chooseToDiscard("名士：弃置一张手牌，或令对" + get.translation(player) + "造成的伤害-1")
				.set("ai", card => {
					if (get.event().goon) {
						return 0;
					}
					return 6 - get.value(card);
				})
				.set("goon", get.damageEffect(player, target, target) <= 0)
				.forResult();
			if (!bool) {
				trigger.num--;
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "damage") && target != player) {
						if (_status.event.name == "dckrmingshi") {
							return;
						}
						if (get.attitude(player, target) > 0 && current < 0) {
							return "zeroplayertarget";
						}
						var bs = player.getCards("h");
						bs.remove(card);
						if (card.cards) {
							bs.removeArray(card.cards);
						} else {
							bs.removeArray(ui.selected.cards);
						}
						if (bs.length > target.countCards("h")) {
							if (bs.some(bsi => get.value(bsi) < 7)) {
								return [1, 0, 1, -0.5];
							}
							return [1, 0, 0.3, 0];
						}
						return [1, 0, 1, -0.5];
					}
				},
			},
		},
	},
	//新服SP孟获
	dcmanwang: {
		audio: "spmanwang",
		inherit: "spmanwang",
		check(card) {
			var player = _status.event.player;
			var max = Math.min(player.isDamaged() ? 3 : 2, 4 - player.countMark("dcmanwang"));
			if (!max && !player.hasSkill("dcpanqin")) {
				return 0;
			}
			if (max == 0 && ui.selected.length > 0) {
				return 0;
			}
			return 7 - ui.selected.cards.length - get.value(card);
		},
		async content(event, trigger, player) {
			const num = Math.min(event.cards.length, 4 - player.countMark("dcmanwang"));
			if (num >= 1) {
				await player.addSkills("dcpanqin");
			}
			if (num >= 2) {
				await player.draw();
			}
			if (num >= 3) {
				await player.recover();
			}
			if (num >= 4) {
				await player.draw({ num: 2 });
				await player.removeSkills("dcpanqin");
			}
		},
		ai: {
			order: 2,
			result: {
				player(player, target) {
					if (player.getUseValue({ name: "nanman" }) <= 0) {
						return 0;
					}
					if (player.getStat("skill").spmanwang && player.hasSkill("dcpanqin")) {
						return 0;
					}
					return 1;
				},
			},
		},
		derivation: "dcpanqin",
	},
	dcpanqin: {
		audio: "sppanqin",
		inherit: "sppanqin",
		async content(event, trigger, player) {
			const cards = [];
			for (const evt of player.getHistory("lose", evt => evt.type === "discard" && evt.getParent(trigger.name) === trigger)) {
				for (const card of evt.cards2) {
					if (get.position(card, true) === "d") {
						cards.add(card);
					}
				}
			}
			player.addTempSkill("dcpanqin_eff");
			await player.chooseUseTarget({
				forced: true,
				card: get.autoViewAs({ name: "nanman" }),
				cards,
			});
		},
		subSkill: {
			eff: {
				charlotte: true,
				trigger: { player: "useCard" },
				filter(event, player) {
					return event.card.name == "nanman" && event.getParent(2).name == "dcpanqin" && player.countMark("dcmanwang") < 4 && player.hasSkill("dcmanwang", null, null, false) && event.cards.length <= event.targets.length;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const { source, target, targets, card, cards, skill, forced, num } = event;
					player.addMark("dcmanwang", 1, false);
					switch (player.countMark("dcmanwang")) {
						case 1: {
							await player.draw(2);
							await player.removeSkills("dcpanqin");
							break;
						}
						case 2: {
							await player.recover();
							break;
						}
						case 3: {
							await player.draw();
							break;
						}
						case 4: {
							await player.addSkills("dcpanqin");
							break;
						}
					}
					await player.gainMaxHp();
					await player.recover();
				},
			},
		},
	},
};
