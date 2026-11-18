import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcgengdu" | "dcgumai">} */
export const groupSkills = {
	//新杀诸葛均
	dcgengdu: {
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		frequent: true,
		async content(event, trigger, player) {
			const cards = get.cards(4);
			await game.cardsGotoOrdering(cards);
			await player.showCards(cards, `${get.translation(player)}发动了【耕读】`);
			const list = ["red", "black"];
			const result = await player
				.chooseControl(list)
				.set("prompt", "耕读：选择一种颜色的牌获得")
				.set(
					"choiceList",
					list.map(i => {
						const colors = cards.filter(card => get.color(card) == i);
						return `${get.translation(i)}：${colors.length ? get.translation(colors) : "空气"}`;
					})
				)
				.set("ai", () => {
					return get.event().results;
				})
				.set(
					"results",
					(() => {
						let count = color => cards.filter(card => get.color(card) == color);
						let results = list.sort((a, b) => count(b) - count(a));
						return results[0];
					})()
				)
				.forResult();
			const color = result.control,
				gains = cards.filter(card => get.color(card) == color);
			if (gains?.length) {
				await player.gain(gains, "gain2");
			}
			if (["red", "black"].includes(color)) {
				player.addTempSkill(`dcgengdu_${color}`, "phaseChange");
				player.setStorage(`dcgengdu_${color}`, cards.length - gains.length, true);
			}
		},
		subSkill: {
			red: {
				enable: "chooseToUse",
				charlotte: true,
				filter(event, player) {
					const list = event.dcgengduList;
					return list.length && player.countCards("hes", { color: "red" });
				},
				usable(skill, player) {
					return player.getStorage(skill, 0);
				},
				onChooseToUse(event) {
					if (game.online || event.dcgengduList) {
						return;
					}
					const player = event.player;
					let list = lib.inpile.filter(i => {
						if (get.type(i) != "trick") {
							return false;
						}
						if (event && !event.filterCard(get.autoViewAs({ name: i }, "unsure"), player, event)) {
							return false;
						}
						return true;
					});
					game.checkGlobalHistory("useCard", evt => {
						if (list.includes(evt.card.name)) {
							list.remove(evt.card.name);
						}
					});
					event.set("dcgengduList", list);
				},
				chooseButton: {
					dialog(event, player) {
						const list = event.dcgengduList;
						return ui.create.dialog("耕读", [list, "vcard"]);
					},
					check(button) {
						if (get.event().getParent().type != "phase") {
							return 1;
						}
						return get.player().getUseValue({ name: button.link[2] });
					},
					prompt(links, player) {
						return "将一张红色牌当作" + "【" + get.translation(links[0][2]) + "】使用";
					},
					backup(links, player) {
						return {
							audio: "dcgengdu",
							filterCard(card, player) {
								return get.color(card) === "red";
							},
							popname: true,
							check(card) {
								return 6 - get.value(card);
							},
							position: "hes",
							viewAs: { name: links[0][2] },
						};
					},
				},
				hiddenCard(player, name) {
					const skill = "dcgengdu_red";
					const count = player.stat[player.stat.length - 1].skill[skill] || 0;
					if (count >= get.info(skill).usable(skill, player)) {
						return false;
					}
					return player.hasCard(card => {
						if (_status.connectMode && get.position(card) === "h") {
							return true;
						}
						return get.color(card) === "red";
					}, "hes");
				},
				ai: {
					fireAttack: true,
					skillTagFilter(player) {
						if (!player.countCards("hse", { color: "red" })) {
							return false;
						}
					},
					order: 1,
					result: {
						player(player) {
							if (_status.event.dying) {
								return get.attitude(player, _status.event.dying);
							}
							return 1;
						},
					},
				},
				intro: {
					content: "本阶段限$次，你可以将一张红色牌当作本回合未被使用过的普通锦囊牌使用",
				},
				onremove: true,
			},
			black: {
				audio: "dcgengdu",
				trigger: {
					player: "useCardAfter",
				},
				usable(skill, player) {
					return player.getStorage(skill, 0);
				},
				filter(event, player) {
					if (!player.getStorage("dcgengdu_black", 0)) {
						return false;
					}
					return get.color(event.card) == "black";
				},
				forced: true,
				locked: false,
				charlotte: true,
				async content(event, trigger, player) {
					const next = player.draw(2);
					next.gaintag.add("dcgengdu");
					await next;
					player.addTempSkill("dcgengdu_mark");
				},
				intro: {
					content: "本阶段限$次，你使用黑色牌后摸两张牌，这些牌本回合无法使用或打出且不计入手牌上限",
				},
				onremove: true,
			},
			mark: {
				charlotte: true,
				locked: true,
				onremove(player) {
					player.removeGaintag("dcgengdu");
				},
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("dcgengdu")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("dcgengdu")) {
							return false;
						}
					},
					cardEnabled(card, player) {
						if (card.cards?.some(i => i.hasGaintag("dcgengdu"))) {
							return false;
						}
					},
					cardRespondable(card, player) {
						if (card.cards?.some(i => i.hasGaintag("dcgengdu"))) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (card.cards?.some(i => i.hasGaintag("dcgengdu"))) {
							return false;
						}
					},
				},
			},
			red_backup: {},
		},
	},
	dcgumai: {
		audio: 2,
		trigger: {
			player: "damageBegin3",
			source: "damageBegin1",
		},
		round: 1,
		filter(event, player) {
			return player.countCards("h");
		},
		check(event, player, name) {
			const { card } = event;
			if (name == "damageBegin3") {
				const effect = get.damageEffect(player, event.source, player, event.nature);
				const canFilterDamage = player.hasSkillTag("filterDamage", null, {
					player: event.source,
					card: event.card,
				});
				if (canFilterDamage) return false;
				return effect < 0;
			}
			const effect = get.damageEffect(event.player, player, player, event.nature);
			const canFilterDamage = event.player.hasSkillTag("filterDamage", null, {
				player,
				card,
			});
			if (canFilterDamage) return false;
			return effect > 0;
		},
		prompt2(event, player, name) {
			const target = event.player;
			const { source } = event;
			return `${player == target ? "你" : get.translation(target)}即将受到${source ? `来自${player == source ? "你" : get.translation(source)}` : "无来源"}的${event.num}点伤害，你可以展示所有手牌，令此伤害${name == "damageBegin1" ? "+" : "-"}1`;
		},
		async content(event, trigger, player) {
			const suit = get.suit(player.getCards("h")[0], player),
				bool = player.getCards("h").every(card => get.suit(card, player) == suit);
			await player.showHandcards(`${get.translation(player)}发动了【孤脉】`);
			if (event.triggername == "damageBegin1") {
				trigger.num++;
				player.popup(" +1 ", "fire");
				game.log(player, "令此伤害+1");
			} else {
				trigger.num--;
				player.popup(" -1 ", "water");
				game.log(player, "令此伤害-1");
			}
			if (bool) {
				const result = await player
					.chooseToDiscard("h", "孤脉：你可以弃置一张手牌并重置【孤脉】")
					.set("ai", card => {
						const { goon } = get.event();
						if (!goon) {
							return 0;
						}
						return 7 - get.value(card);
					})
					.set("goon", player.storage[`${event.name}_roundcount`])
					.forResult();
				if (result?.bool) {
					player.refreshSkill(event.name);
				}
			}
		},
	},
};
