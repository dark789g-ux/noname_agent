import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "spolxixiang" | "spolaige" | "spolzhubei">} */
export const groupSkills = {
	//SP曹操
	spolxixiang: {
		audio: 2,
		enable: "phaseUse",
		onChooseToUse(event) {
			if (!game.online && !event.spolxixiang_num) {
				event.set("spolxixiang_num", 1 + game.getGlobalHistory("everything", evt => evt.name === "useCard" && get.type(evt.card) === "basic").length);
			}
		},
		filter(event, player) {
			if (player.countCards("hes") < event.spolxixiang_num) {
				return false;
			}
			return ["sha", "juedou"].some(name => !player.getStorage("spolxixiang_used").includes(name) && event.filterCard({ name: name, storage: { spolxixiang: true } }, player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const dialog = ui.create.dialog(
					"西向",
					[
						["sha", "juedou"].filter(name => {
							return !player.getStorage("spolxixiang_used").includes(name) && event.filterCard({ name: name, storage: { spolxixiang: true } }, player, event);
						}),
						"vcard",
					],
					"hidden"
				);
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				return get.player().getUseValue({ name: button.link[2], storage: { spolxixiang: true } }) * (button.link[2] == "juedou" ? 3 : 1);
			},
			backup(links) {
				return {
					audio: "spolxixiang",
					viewAs: { name: links[0][2], storage: { spolxixiang: true } },
					filterCard: true,
					selectCard: [get.event().spolxixiang_num, Infinity],
					filterTarget: lib.filter.targetEnabled,
					ai1(card) {
						if (ui.selected.cards.length) {
							return 0;
						}
						return 6 - get.value(card);
					},
					position: "hes",
					allowChooseAll: true,
					precontent() {
						event.getParent().addCount = false;
						player.addTempSkill("spolxixiang_effect");
						player.addTempSkill("spolxixiang_used", "phaseUseAfter");
						player.markAuto("spolxixiang_used", [event.result.card.name]);
					},
				};
			},
			prompt(links) {
				return "将至少" + get.cnNumber(get.event().spolxixiang_num) + "张牌当作【" + get.translation(links[0][2]) + "】使用";
			},
		},
		ai: {
			order(item, player) {
				const event = get.event();
				return (
					Math.max(
						...["sha", "juedou"]
							.filter(name => {
								return !player.getStorage("spolxixiang_used").includes(name) && event.filterCard({ name: name, storage: { spolxixiang: true } }, player, event);
							})
							.map(name => get.order({ name: name, storage: { spolxixiang: true } }, player))
					) + 0.2
				);
			},
			result: { player: 1 },
		},
		locked: false,
		mod: {
			cardUsable(card) {
				if (card?.storage?.spolxixiang) {
					return Infinity;
				}
			},
		},
		subSkill: {
			backup: {},
			used: {
				charlotte: true,
				onremove: true,
			},
			effect: {
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return (
						event.skill == "spolxixiang_backup" &&
						(event.targets || []).some(current => {
							if (!current.isIn()) {
								return false;
							}
							return current.getHp() > player.countCards("h") || (current.getHp() > player.getHp() && (player.isDamaged() || current.countGainableCards(player, "he")));
						})
					);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					for (const target of trigger.targets.sortBySeat()) {
						if (target.getHp() > player.countCards("h")) {
							await player.draw();
						}
						if (target.getHp() > player.getHp()) {
							await player.recover();
							if (target.countGainableCards(player, "he")) {
								await player.gainPlayerCard(target, "he", true);
							}
						}
					}
				},
			},
		},
	},
	spolaige: {
		audio: 2,
		trigger: { global: "dyingAfter" },
		filter(event, player) {
			return game.getGlobalHistory("everything", evt => evt.name == "dying").indexOf(event) == 1;
		},
		juexingji: true,
		forced: true,
		skillAnimation: "epic",
		animationColor: "thunder",
		async content(event, trigger, player) {
			const { player: target } = trigger,
				num = target.maxHp;
			player.awakenSkill(event.name);
			player.changeSkin({ characterName: "sp_ol_caocao" }, "sp_ol_caocao_shadow");
			await player.changeSkills(["spolzhubei"], ["spolxixiang"]);
			if (player.countCards("h") < num) {
				await player.drawTo(num);
			}
			if (player.getHp() < num) {
				await player.recoverTo(num);
			}
		},
		derivation: "spolzhubei",
	},
	spolzhubei: {
		audio: 2,
		enable: "phaseUse",
		onChooseToUse(event) {
			if (!game.online && !event.spolzhubei_num) {
				event.set("spolzhubei_num", 1 + game.getGlobalHistory("everything", evt => evt.name === "useCard" && get.type(evt.card) === "basic").length);
			}
		},
		filter(event, player) {
			if (player.getStorage("spolzhubei_used").length > 1) {
				return false;
			}
			return game.hasPlayer(current => get.info("spolzhubei").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return player != target;
		},
		prompt(event, player) {
			if (event.spolzhubei_num) {
				return `出牌阶段各限一次，你可以令一名其他角色将至少${get.cnNumber(event.spolzhubei_num)}张牌当作无距离和任何次数限制的【杀】或【决斗】对你使用。`;
			}
			return "出牌阶段各限一次，你可以令一名其他角色将至少X张牌当作无距离和任何次数限制的【杀】或【决斗】对你使用（X为本回合所有角色本回合使用基本牌的次数+1）。";
		},
		async content(event, trigger, player) {
			const { target } = event,
				num = event.getParent(2).spolzhubei_num;
			const list = get.inpileVCardList(info => {
				if (!["sha", "juedou"].includes(info[2]) || info[3]) {
					return false;
				}
				return !player.getStorage("spolzhubei_used").includes(info[2]);
			});
			if (!list.length) {
				return;
			}
			const links =
				list.length == 1
					? list
					: (
							await target
								.chooseButton([`请选择要对${get.translation(player)}使用的牌`, [list, "vcard"]], true)
								.set("ai", button => {
									const player = get.player(),
										target = get.event().getParent().player,
										{ link } = button;
									return get.effect(target, { name: link[2] }, player, player);
								})
								.forResult()
						).links;
			if (!links?.length) {
				return;
			}
			const viewAs = { name: links[0][2] };
			player.addTempSkill("spolzhubei_used", "phaseUseAfter");
			player.markAuto("spolzhubei_used", [viewAs.name]);
			const count = target.countCards("hes", cardx => target.canUse(get.autoViewAs({ name: viewAs.name }, [cardx]), player, false));
			if (count >= num) {
				game.broadcastAll(
					(viewAs, num) => {
						lib.skill.spolzhubei_backup.viewAs = viewAs;
						lib.skill.spolzhubei_backup.selectCard = [num, Infinity];
					},
					viewAs,
					num
				);
				const next = target.chooseToUse();
				next.set("openskilldialog", `逐北：将至少${get.cnNumber(num)}张牌当作${get.translation(viewAs.name)}对${get.translation(player)}使用`);
				next.set("norestore", true);
				next.set("_backupevent", "spolzhubei_backup");
				next.set("custom", {
					add: {},
					replace: { window() {} },
				});
				next.backup("spolzhubei_backup");
				next.set("targetRequired", true);
				next.set("complexSelect", true);
				next.set("complexTarget", true);
				next.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.targetEnabled.apply(this, arguments);
				});
				next.set("sourcex", player);
				next.set("addCount", false);
				next.set("forced", true);
				player
					.when({ player: "damageEnd" })
					.filter(evt => evt.getParent(4) == event && evt.cards.someInD())
					.step(async (event, trigger, player) => {
						await player.gain(trigger.cards.filterInD(), "gain2");
					});
				player
					.when({ global: "useCardAfter" })
					.filter(evt => evt.getParent(2) == event && !player.hasHistory("damage", evtx => evtx.card == evt.card) && (player.isDamaged() || (evt.player.isIn() && [player, evt.player].some(current => current.countCards("h")))))
					.step(async () => {
						await player.recover();
						if (target.isIn() && [player, target].some(current => current.countCards("h"))) {
							const { bool } = await player
								.chooseBool(`逐北`, `与${get.translation(target)}交换手牌？`)
								.set("choice", get.attitude(player, target) > 0 || player.countCards("h") < target.countCards("h"))
								.forResult();
							if (bool) {
								await player.swapHandcards(target);
							}
						}
					});
				await next;
			} else {
				await player.recover();
				if (target.isIn() && [player, target].some(current => current.countCards("h"))) {
					const { bool } = await player
						.chooseBool(`逐北`, `与${get.translation(target)}交换手牌？`)
						.set("choice", get.attitude(player, target) > 0 || player.countCards("h") < target.countCards("h"))
						.forResult();
					if (bool) {
						await player.swapHandcards(target);
					}
				}
			}
		},
		ai: {
			order: 2,
			result: {
				player(player, target, cardx) {
					return (
						1 +
						Math.max.apply(
							Math,
							["sha", "juedou"].filter(name => !player.getStorage("spolzhubei_used").includes(name) && target.canUse(get.autoViewAs({ name: name }, [cardx]), player, false)).map(name => get.effect(player, { name: name }, target, player))
						)
					);
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			backup: {
				filterCard(card, player) {
					return get.itemtype(card) == "card";
				},
				position: "hes",
				ai1(card) {
					if (ui.selected.cards.length) {
						return 0;
					}
					return 5 - get.value(card);
				},
				log: false,
				allowChooseAll: true,
			},
		},
	},
};
