import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjuxi" | "dczhuitao">} */
export const groupSkills = {
	//威公孙瓒
	dcjuxi: {
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.dcjuxi) {
					return Infinity;
				}
			},
		},
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		getList(event, player) {
			return get.inpileVCardList(info => {
				const card = get.autoViewAs({ name: info[2], nature: info[3], isCard: true, storage: { dcjuxi: true } });
				return ["basic", "trick"].includes(info[0]) && get.is.damageCard(card) && event.filterCard(card, player, event) && !player.getStorage("dcjuxi_clear").includes(info[2]);
			});
		},
		filter(event, player) {
			return !player.countCards("h", card => get.is.damageCard(card) && (player.hasUseTarget(card, true, true) || (get.info(card).notarget && lib.filter.cardEnabled(card, player, event)))) && get.info("dcjuxi").getList(event, player).length > 0;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("举袭", [get.info("dcjuxi").getList(event, player), "vcard"], "hidden");
			},
			check(button) {
				const { link } = button;
				return get.player().getUseValue(get.autoViewAs({ name: link[2], nature: link[3], isCard: true, storage: { dcjuxi: true } }));
			},
			backup(links, player) {
				return {
					audio: "dcjuxi",
					filterCard: () => false,
					selectCard: -1,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
						storage: { dcjuxi: true },
					},
					async precontent(event, trigger, player) {
						const { card } = event.result;
						const { name } = card;
						player.addTempSkill("dcjuxi_clear");
						player.markAuto("dcjuxi_clear", name);
						player.addTempSkill("dcjuxi_refresh", "phaseChange");
						player.markAuto("dcjuxi_refresh", name);
						event.getParent().addCount = false;
					},
				};
			},
			prompt(links, player) {
				return `请选择${get.translation(links[0][3]) || ""}【${get.translation(links[0][2])}】的目标`;
			},
		},
		ai: {
			order: 7,
			result: { player: 1 },
		},
		subSkill: {
			clear: {
				onremove: true,
				charlotte: true,
			},
			refresh: {
				audio: "dcjuxi",
				forced: true,
				onremove: true,
				charlotte: true,
				trigger: { global: ["loseAfter", "loseAsyncAfter", "equipAfter", "cardsDiscardAfter"] },
				filter(event, player) {
					return event.getd()?.some(card => player.getStorage("dcjuxi_refresh").includes(get.name(card)));
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					player.refreshSkill("dcjuxi");
				},
				intro: { content: "$进入弃牌堆重置【举袭】" },
			},
		},
	},
	dczhuitao: {
		audio: 2,
		comboSkill: true,
		mod: {
			aiOrder(player, card, num) {
				if (typeof card == "object") {
					const evt = lib.skill.dcjianying.getLastUsed(player);
					if (evt?.card && get.color(evt.card) == "black" && !evt.dczhuitao && get.is.damageCard(card)) {
						return num + 10;
					}
				}
			},
		},
		locked: false,
		trigger: { player: "useCard" },
		filter(event, player) {
			const { card } = event;
			if (!get.is.damageCard(card)) {
				return false;
			}
			const evt = lib.skill.dcjianying.getLastUsed(player, event);
			if (!evt || !evt.card || evt.dczhuitao) {
				return false;
			}
			return get.color(evt.card) == "black" && game.hasPlayer(target => target != player && !player.getStorage("dczhuitao_effect").includes(target));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target != player && !player.getStorage("dczhuitao_effect").includes(target);
				})
				.set("ai", target => {
					const player = get.player();
				})
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.set(event.name, true);
			const {
				targets: [target],
			} = event;
			player.addTempSkill(`${event.name}_effect`);
			player.markAuto(`${event.name}_effect`, target);
			await player.draw(2);
		},
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
		},
		subSkill: {
			effect: {
				audio: "dczhuitao",
				charlotte: true,
				onremove: true,
				mod: {
					globalFrom(from, to) {
						if (from.getStorage("dczhuitao_effect").includes(to)) {
							return -Infinity;
						}
					},
				},
				trigger: { player: "useCardAfter" },
				getIndex(event, player) {
					return event.targets.filter(target => player.getStorage("dczhuitao_effect").includes(target)).sortBySeat();
				},
				filter(event, player, name, target) {
					const { card } = event;
					return get.info("dczhuitao_effect").getNum(card) > 0 && target.isIn() && target.countDiscardableCards(player, "he") > 0;
				},
				logTarget(event, player, name, target) {
					return target;
				},
				getNum(card) {
					return [card => get.color(card) == "black", card => get.is.damageCard(card)].filter(func => func(card)).length;
				},
				prompt2(event, player) {
					return `弃置其至多${get.cnNumber(get.info("dczhuitao_effect").getNum(event.card))}张牌`;
				},
				check(event, player, name, target) {
					return get.effect(target, { name: "guohe_copy2" }, player, player);
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					const num = get.info(event.name).getNum(trigger.card);
					await player.discardPlayerCard(target, "he", [1, num], true);
				},
				intro: {
					content: "已选择过：$",
				},
			},
			mark: {
				init(player, skill) {
					const evt = lib.skill.dcjianying.getLastUsed(player);
					if (evt?.card && get.color(evt.card) == "black" && !evt.dczhuitao) {
						player.addTip(skill, "追讨 可连击");
					}
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				charlotte: true,
				trigger: { player: ["useCard1", "useCardAfter"] },
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (event.triggername == "useCard1") {
						if (get.color(trigger.card) == "black") {
							player.addTip(event.name, "追讨 可连击");
						} else {
							player.removeTip(event.name);
						}
					} else if (trigger.dczhuitao) {
						player.removeTip(event.name);
					}
				},
			},
		},
	},
};
