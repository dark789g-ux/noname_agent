import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olhuanpei" | "olwenyi" | "olmiaoxin">} */
export const groupSkills = {
	//环淑君
	olhuanpei: {
		audio: 2,
		round: 1,
		enable: "chooseToUse",
		filter(event, player) {
			/*if (player.countCards("h") == player.hp) {
				return false;
			}*/
			return get.inpileVCardList(info => {
				if (info[0] !== "basic") {
					return false;
				}
				const card = new lib.element.VCard({ name: info[2], nature: info[3], isCard: true });
				return event.filterCard(card, player, event);
			}).length;
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(info => {
					if (info[0] !== "basic") {
						return false;
					}
					const card = new lib.element.VCard({ name: info[2], nature: info[3], isCard: true });
					return event.filterCard(card, player, event);
				});
				const dialog = ui.create.dialog("环佩", [list, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				const player = get.player(),
					card = new lib.element.VCard({ name: button.link[2], nature: button.link[3], isCard: true });
				let eff = _status.event.getParent().type == "phase" ? player.getUseValue(card) : 3;
				return eff + player.hp - player.countCards("h");
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						suit: "none",
						number: null,
						isCard: true,
					},
					popname: true,
					ignoreMod: true,
					filterCard(card, player) {
						return player.countCards("h") > player.hp && lib.filter.cardDiscardable(card, player, "olhuanpei");
					},
					position: "h",
					selectCard() {
						const player = get.player(),
							num = player.countCards("h") - player.hp;
						if (num > 0) {
							return num;
						}
						return -1;
					},
					manualConfirm: true,
					check(card) {
						return 1 / Math.max(0.1, get.value(card));
					},
					async precontent(event, trigger, player) {
						player.logSkill("olhuanpei");
						const cards = event.result.cards;
						if (cards.length) {
							await player.modedDiscard(cards);
						} else {
							await player.drawTo(player.hp);
						}
						const { name, nature } = event.result.card;
						event.result.card = new lib.element.VCard({ name, nature, isCard: true });
						event.result.cards = [];
					},
				};
			},
			prompt(links, player) {
				const num = player.countCards("h") - player.hp;
				const str = num > 0 ? `弃置${get.cnNumber(num)}张手牌` : `摸${get.cnNumber(-num)}张牌`;
				return `${str}，然后视为使用一张${get.translation(links[0][3] || "")}${get.translation(links[0][2])}`;
			},
		},
		hiddenCard(player, name) {
			if (get.type(name) != "basic") {
				return false;
			}
			return player.countCards("h") != player.hp;
		},
		ai: {
			save: true,
			skillTagFilter(player, tag) {
				return player.countCards("h") != player.hp;
			},
			order: 3,
			result: {
				player(player, target) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
	},
	olwenyi: {
		audio: 2,
		trigger: { global: ["changeHpAfter"] },
		filter(event, player) {
			if (player.countMark("olwenyi_used") > player.countMark("olwenyi_limit")) {
				return false;
			}
			if (event.player.hp != 1 || event.changedHp == 0) {
				return false;
			}
			return player.hasUsableCard("tao", "use") || player.countCards("he", card => _status.connectMode || get.type(card) == "equip");
		},
		init(player, skill) {
			player.markSkill("olwenyi_limit");
		},
		onremove(player, skill) {
			player.unmarkSkill("olwenti_limit");
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([
					get.prompt(event.skill, trigger.player),
					[
						[
							["tao", "对其使用一张桃"],
							["equip", "交给其一张装备令其使用之"],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					const player = get.player();
					if (button.link == "tao") {
						return player.hasUsableCard("tao", "use");
					}
					return player.countCards("he", card => get.type(card) == "equip");
				})
				.set("ai", button => {
					const { player, target } = get.event();
					if (button.link == "tao") {
						return get.effect(target, { name: "tao" }, player, player) > 0 ? 3 : 0;
					}
					return 0;
				})
				.set("target", trigger.player)
				.forResult();
			if (!result?.bool || !result.links?.length) {
				return;
			}
			const type = result.links[0];
			if (type == "tao") {
				const result = await player
					.chooseToUse({
						prompt: `温宜：是否对${get.translation(trigger.player)}使用一张桃？`,
						filterCard(card, player) {
							if (get.name(card) != "tao") {
								return false;
							}
							return lib.filter.cardEnabled(card, player, "forceEnable");
						},
						targetRequired: true,
						filterTarget(card, player, target) {
							card ??= get.card();
							if (target != get.event().sourcex) {
								return false;
							}
							return lib.filter.targetEnabled2(card, player, target);
						},
						sourcex: trigger.player,
					})
					.set("logSkill", [event.skill, trigger.player])
					.forResult();
				if (result?.bool) {
					event.result = {
						bool: true,
						targets: [trigger.player],
						skill_popup: false,
						cost_data: type,
					};
				}
				return;
			} else {
				event.result = await player
					.chooseCard(`温宜：是否交给${get.translation(trigger.player)}一张装备牌并令其使用之？`, "he")
					.set("filterCard", (card, player) => {
						return get.type(card, player) == "equip";
					})
					.set("ai", card => {
						const { player, sourcex } = get.event();
						return get.equipValue(card, sourcex) * get.sgnAttitude(player, sourcex);
					})
					.set("sourcex", trigger.player)
					.forResult();
			}
			event.result.targets = [trigger.player];
		},
		async content(event, trigger, player) {
			const {
				cards,
				targets: [target],
				cost_data,
			} = event;
			player.addSkill("olwenyi_used");
			player.addMark("olwenyi_used", 1, false);
			player.markSkill("olwenyi_limit");
			if (cost_data == "tao") {
				//await player.useResult(cost_data.result, event);
			} else {
				await player.give(cards, target);
				if (target.getCards("h").includes(cards[0]) && target.hasUseTarget(cards[0])) {
					await target.chooseUseTarget(cards[0], true);
				}
			}
			await target.link(false);
			await target.turnOver(false);
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove(player, skill) {
					player.clearMark(skill, false);
					if (player.hasSkill("olwenyi", null, null, false)) {
						player.markSkill("olwenyi_limit");
					}
				},
			},
			limit: {
				intro: {
					markcount(storage, player) {
						const used = player.countMark("olwenyi_used"),
							max = player.countMark("olwenyi_limit") + 1;
						if (max > used) {
							return max - used;
						}
						return null;
					},
					content(storage, player) {
						const used = player.countMark("olwenyi_used"),
							max = player.countMark("olwenyi_limit") + 1;
						return `剩余可发动次数：${max - used}`;
					},
				},
			},
		},
	},
	olmiaoxin: {
		audio: 2,
		forced: true,
		trigger: {
			player: "damageEnd",
		},
		getIndex(event) {
			return event.num ?? 0;
		},
		async content(event, trigger, player) {
			const count = player.countMark("olwenyi_limit") + 1 - player.countMark("olwenyi_used");
			if (player.hasSkill("olwenyi", null, null, false) && count === 0) {
				player.addMark("olwenyi_limit", 1, false);
				game.log(player, "的", "#g【温宜】", "可发动次数+1");
				await player.draw();
			} else {
				await player.draw(2);
			}
		},
	},
};
