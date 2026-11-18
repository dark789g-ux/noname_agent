import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbguanwu" | "dcsbweishi" | "dcsbjuao">} */
export const groupSkills = {
	//谋关羽（绿裤子）------by 清风
	dcsbguanwu: {
		audio: 2,
		forced: true,
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		trigger: {
			player: "phaseBegin",
			source: "damageBegin2",
		},
		filter(event, player) {
			if (event.name === "phase") {
				return get.cardPile("qinglong", "field");
			}
			return Math.floor(player.countRoundHistory("useCard", evt => evt.card.name === "sha") / 2) > 0 && event.card?.name === "sha";
		},
		async content(event, trigger, player) {
			if (trigger.name === "phase") {
				const card = get.cardPile("qinglong", "field");
				if (card) {
					await player.gain({ cards: [card], animate: "gain2" });
				}
			} else {
				trigger.num += Math.floor(player.countRoundHistory("useCard", evt => evt.card.name === "sha") / 2) > 0;
			}
		},
		subSkill: {
			mark: {
				charlotte: true,
				silent: true,
				intro: { content: "本轮使用【杀】造成伤害+#" },
				trigger: { player: "useCard" },
				filter(event, player) {
					return event.card.name === "sha" && Math.floor(player.countRoundHistory("useCard", evt => evt.card.name === "sha") / 2) > 0;
				},
				async content(event, trigger, player) {
					player.setStorage(event.name, Math.floor(player.countRoundHistory("useCard", evt => evt.card.name === "sha") / 2), true);
					player.when("roundStart").step(async (event, trigger, player) => {
						player.setStorage("dcsbguanwu_mark", Math.floor(player.countRoundHistory("useCard", evt => evt.card.name === "sha") / 2), true);
						player.unmarkSkill("dcsbguanwu_mark");
					});
				},
			},
		},
	},
	dcsbweishi: {
		audio: 2,
		trigger: {
			target: "useCardToTargeted",
			global: "useCardAfter",
		},
		filter(event, player) {
			if (player === event.player || player.getStorage("dcsbweishi_used").includes(event.name)) {
				return false;
			}
			if (event.name == "useCard") {
				return get.is.damageCard(event.card) && event.targets?.includes(player);
			} else {
				return !get.is.damageCard(event.card) && player.hasDiscardableCards(player, "h");
			}
		},
		logTarget: "player",
		async cost(event, trigger, player) {
			if (trigger.name === "useCard") {
				event.result = {
					bool: true,
				};
			} else {
				const num = Math.ceil(player.countCards("h") / 2);
				event.result = await player
					.chooseToDiscard({
						prompt: `威势：弃置${num}张手牌令${get.translation(trigger.card)}对你无效`,
						filterCard: lib.filter.cardDiscardable,
						selectCard: num,
						position: "h",
						chooseonly: true,
						ai(card) {
							const { player, target, cardx } = get.event();
							if (get.effect(player, cardx, target)) {
								return 8 - get.value(card);
							}
							return 0;
						},
					})
					.set("target", trigger.player)
					.set("cardx", trigger.card)
					.forResult();
			}
		},
		async content(event, trigger, player) {
			player.addTempSkill(event.name + "_used");
			player.markAuto(event.name + "_used", [trigger.name]);
			if (trigger.name == "useCard") {
				await player.draw({ num: 2 });
				await player
					.chooseToUse({
						prompt: `威势：是否对${get.translation(trigger.player)}使用一张杀？`,
						filterCard(card, player, event) {
							if (get.name(card) != "sha") {
								return false;
							}
							return lib.filter.filterCard(card, player);
						},
						filterTarget(card, player, target) {
							const source = get.event().sourcex;
							if (target != source && !ui.selected.targets.includes(source)) {
								return false;
							}
							return lib.filter.targetEnabled(card, player, target);
						},
						ai1(card) {
							return get.value(card);
						},
						ai2(target) {
							const player = get.player();
							return get.effect(target, { name: "sha" }, player, player);
						},
					})
					.set("sourcex", trigger.player)
					.set("complexSelect", true);
			} else {
				const { cards } = event;
				await player.modedDiscard({ cards });
				trigger.getParent().targets.remove(player);
				trigger.getParent().excluded.add(player);
			}
		},
		subSkill: {
			used: { charlotte: true, onremove: true },
		},
	},
	dcsbjuao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		mod: {
			cardUsable(card, player) {
				if (card?.storage?.dcsbjuao) {
					return Infinity;
				}
			},
		},
		locked: false,
		filter(event, player) {
			if (!player.hasDiscardableCards(player, "he")) {
				return false;
			}
			const targets = game.filterPlayer(current => player.inRange(current) && player !== current);
			return (
				get.inpileVCardList(info => {
					if (info[2] != "sha" && info[0] != "trick") {
						return false;
					}
					const card = get.autoViewAs(
						{
							name: info[2],
							nature: info[3],
							isCard: true,
							storage: { dcsbjuao: true },
						},
						"unsure"
					);
					return targets.some(target => player.canUse(card, target, false, false));
				}).length > 0
			);
		},
		chooseButton: {
			dialog(event, player) {
				const targets = game.filterPlayer(current => player.inRange(current) && player !== current);
				const list = get.inpileVCardList(info => {
					if (info[2] != "sha" && info[0] != "trick") {
						return false;
					}
					const card = get.autoViewAs(
						{
							name: info[2],
							nature: info[3],
							isCard: true,
							storage: { dcsbjuao: true },
						},
						"unsure"
					);
					return targets.some(target => player.canUse(card, target, false, false));
				});
				return ui.create.dialog("倨傲", [list, "vcard"]);
			},
			check(button) {
				const player = get.player();
				return player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
					storage: { dcsbjuao: true },
				});
			},
			backup(links, player) {
				return {
					audio: "dcsbjuao",
					link: links[0],
					filterCard: lib.filter.cardDiscardable,
					position: "he",
					filterTarget(card, player, target) {
						const link = get.info("dcsbjuao_backup").link,
							cardx = get.autoViewAs(
								{
									name: link[2],
									nature: link[3],
									isCard: true,
									storage: { dcsbjuao: true },
								},
								"unsure"
							);
						return player.inRange(target) && player.canUse(cardx, target, false, false);
					},
					selectTarget: [1, Infinity],
					ai1(card) {
						return 8 - get.value(card);
					},
					ai2(target) {
						const player = get.player();
						const link = get.info("dcsbjuao_backup").link,
							card = get.autoViewAs({
								name: link[2],
								nature: link[3],
							});
						return get.effect(target, card, player, player);
					},
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						suit: "none",
						number: null,
						isCard: true,
						storage: { dcsbjuao: true },
					},
					multitarget: true,
					multiline: true,
					log: false,
					async precontent(event, trigger, player) {
						event.getParent().addCount = false;
						const { cards, targets } = event.result;
						await player.modedDiscard({ cards });
						player.logSkill("dcsbjuao", targets);
						event.result.cards = [];
						player
							.when({ player: "useCardAfter" })
							.filter(evt => evt.getParent() === event.getParent() && evt.targets?.length > 0)
							.step(async (event, trigger, player) => {
								const targets = trigger.targets.sortBySeat();
								player.line(targets);
								for (const target of targets) {
									target.addSkill("dcsbjuao_effect");
									target.markAuto("dcsbjuao_effect", [player]);
								}
							});
					},
				};
			},
			prompt(links, player) {
				return "弃置一张牌并视为对攻击范围内任意名其他角色使用" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]);
			},
		},
		subSkill: {
			backup: {},
			effect: {
				charlotte: true,
				onremove: true,
				forced: true,
				intro: { content: "下次使用【杀】或普通锦囊牌必须指定$为目标（无次数与距离限制）" },
				mod: {
					cardUsable(card) {
						if (card.name === "sha" || get.type(card) === "trick") {
							return Infinity;
						}
					},
					targetInRange(card) {
						if (card.name === "sha" || get.type(card) === "trick") {
							return true;
						}
					},
					playerEnabled(card, player, target) {
						if ((card.name === "sha" || get.type(card) === "trick") && !player.getStorage("dcsbjuao_effect").includes(target)) {
							return false;
						}
					},
				},
				trigger: { player: "useCard" },
				filter(event, player) {
					return event.card.name === "sha" || get.type(event.card) === "trick";
				},
				async content(event, trigger, player) {
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.getStat("card"),
							name = trigger.card.name;
						if (typeof stat[name] === "number" && stat[name] > 0) {
							stat[name]--;
						}
					}
					player.removeSkill(event.name);
				},
			},
		},
		ai: {
			order: 13,
			result: {
				player: 1,
			},
		},
	},
};
