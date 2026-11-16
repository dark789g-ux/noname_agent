import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbzhenyu" | "dcsbjielu" | "dcshuren" | "dcsaran">} */
export const groupSkills = {
	//谋朱然
	dcsbzhenyu: {
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			if (!game.hasPlayer(current => !current.isLinked())) {
				return false;
			}
			return (
				get.inpileVCardList(info => {
					if (info[0] != "basic") {
						return false;
					}
					const card = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
					return event.filterCard(card, player, event);
				}).length > 0
			);
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(info => {
					if (info[0] != "basic") {
						return false;
					}
					const card = get.autoViewAs({ name: info[2], nature: info[3], isCard: true });
					return event.filterCard(card, player, event);
				});
				return ui.create.dialog("镇御", [list, "vcard"]);
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				return get.player().getUseValue(get.autoViewAs({ name: button.link[2], nature: button.link[3], isCard: true }));
			},
			backup(links, player) {
				return {
					audio: "dcsbzhenyu",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
					},
					selectCard: -1,
					filterCard: () => false,
					log: false,
					async precontent(event, trigger, player) {
						if (!game.hasPlayer(current => !current.isLinked())) {
							event.getParent().goto(0);
							return;
						}
						const { targets } = await player
							.chooseTarget("镇御：请横置一名角色", true, (_, player, target) => !target.isLinked())
							.set("ai", target => {
								return get.effect(target, { name: "tiesuo" }, get.player(), get.player());
							})
							.forResult();
						if (targets?.length) {
							await player.logSkill("dcsbzhenyu");
							player.line(targets[0]);
							await targets[0].link(true);
							player.addSkill("dcsbzhenyu_disable");
							player.markAuto("dcsbzhenyu_disable", event.result.card.name);
						}
					},
				};
			},
		},
		subSkill: {
			backup: {},
			disable: {
				audio: "dcsbzhenyu",
				charlotte: true,
				init(player, skill) {
					player.disableSkill(skill, "dcsbzhenyu");
				},
				onremove(player, skill) {
					player.enableSkill(skill);
				},
				trigger: {
					player: "useCard",
					global: "roundEnd",
				},
				filter(event, player) {
					if (event.name != "useCard") {
						return true;
					}
					if (!player.getStorage("dcsbzhenyu_disable").includes(get.name(event.card))) {
						return false;
					}
					return player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx != event) {
							return false;
						}
						return evt.getl(player)?.hs?.length;
					});
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
				},
			},
		},
		hiddenCard(player, name) {
			return get.type(name) == "basic" && lib.inpile.includes(name) && game.hasPlayer(current => !current.isLinked());
		},
		ai: {
			respondSha: true,
			respondShan: true,
			order: 15,
			//save: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				if (!game.hasPlayer(current => !current.isLinked())) {
					return false;
				}
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
	},
	dcsbjielu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => current.isLinked());
		},
		filterTarget(card, player, target) {
			return target.isLinked();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			await target.link(false);
			if (target.countDiscardableCards(player, "he")) {
				const { links } = await player.discardPlayerCard(target, true, "he").forResult();
				if (links?.length) {
					const number = get.number(links[0]);
					if (typeof number == "number") {
						player.setStorage("dcsbjielu_effect", [target, number], true);
						player.addTempSkill("dcsbjielu_effect");
					}
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				init(player, skill) {
					const [target, num] = player.getStorage(skill);
					if (target) {
						player.markSkillCharacter(skill, target, "截路", `若下一张进入弃牌堆的牌点数大于${num}，你对${get.translation(target)}造成1点伤害`);
					}
				},
				onremove: true,
				trigger: {
					global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter"],
				},
				filter(event, player) {
					return event.getd()?.length;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const [target, num] = player.getStorage(event.name);
					player.removeSkill(event.name);
					const number = get.number(trigger.getd()[0]);
					if (typeof number == "number") {
						if (target?.isIn() && typeof num == "number" && number > num) {
							player.logSkill("dcsbjielu", target);
							await target.damage();
						}
					}
				},
			},
		},
		ai: {
			order: 10,
			result: {
				target: -1,
			},
		},
	},
	//威孙尚香
	dcshuren: {
		audio: 2,
		audioname: ["v_sunshangxiang_shadow"],
		usable: 1,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasEnabledSlot();
		},
		async content(event, trigger, player) {
			const storage = player.getStorage("v_sunshangxiang_changeSkin", false);
			if (!storage) {
				player.changeSkin(event.name, "v_sunshangxiang_shadow");
				player.setStorage("v_sunshangxiang_changeSkin", !storage);
			}
			const { control } = await player
				.chooseToDisable({
					ai(event, player, list) {
						if (list.every(i => player.hasEmptySlot(i))) {
							return 0;
						}
						return list.filter(i => player.getCards("e", card => get.subtype(card) == i))[0];
					},
				})
				.forResult();
			if (!control) {
				return;
			}
			const restore = player.hasHistory("lose", evt => {
				let num = 1,
					list = ["loseToDiscardpile", "disableEquip", "chooseToDisable"];
				while (num < 3) {
					const evtx = evt.getParent(num);
					if (evtx?.name != list[num - 1] || evtx?.player != player) {
						return false;
					}
					num++;
				}
				return evt.getParent(4) == event;
			});
			const cards = get.cards(3, true);
			await player.showCards(cards, `${get.translation(player)}发动了【淑任】`, true).set("clearArena", false);
			const { links } = await player
				.chooseCardButton(cards, true, "淑任：请选择要获得的牌")
				.set("ai", button => {
					return get.value(button.link, get.player());
				})
				.forResult();
			if (links?.length) {
				cards.removeArray(links);
				await player.gain(links, "gain2");
			}
			const result = await player
				.chooseTarget(`淑任：可令一名其他角色获得其中一张牌`, lib.filter.notMe)
				.set("ai", target => get.attitude(get.player(), target) * (114514 - target.countCards("h")))
				.forResult();
			if (result.bool && result.targets?.length) {
				const {
					targets: [target],
				} = result;
				player.line(target);
				const result2 = await target
					.chooseCardButton(`淑任：选择获得其中一张`, cards, true)
					.set("ai", button => get.buttonValue(button))
					.forResult();
				if (result2?.links?.length) {
					const { links } = result2;
					await target.gain(links, "gain2");
				}
			}
			/**
				  .chooseButtonTarget({
					createDialog: [`淑任：可令一名其他角色获得其中一张牌`, cards],
					filterButton: true,
					filterTarget: lib.filter.notMe,
					ai1(button) {
						if (game.hasPlayer(target => get.attitude(get.player(), target) > 0)) {
							return get.buttonValue(button);
						}
						return 0;
					},
					ai2(target) {
						const player = get.player(),
							card = ui.selected.buttons[0].link;
						return get.value(card, target) * get.attitude(player, target);
					},
				})
			 */
			game.broadcastAll(ui.clear);
			if (restore) {
				if (player.getStat("skill")[event.name]) {
					delete player.getStat("skill")[event.name];
				}
				await player.recover(1);
			}
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
		},
	},
	dcsaran: {
		audio: 2,
		audioname: ["v_sunshangxiang_shadow"],
		locked: false,
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					let es = player.countCards("e");
					return num + es;
				}
			},
		},
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		getIndex(event) {
			return event.num;
		},
		frequent: "check",
		check(event, player) {
			return true;
		},
		async content(event, trigger, player) {
			const storage = player.getStorage("v_sunshangxiang_changeSkin", false);
			if (storage) {
				player.changeSkin(event.name, "v_sunshangxiang");
				player.setStorage("v_sunshangxiang_changeSkin", !storage);
			}
			if (player.hasDisabledSlot()) {
				const { bool } = await player
					.chooseBool("飒然：是否恢复一个废弃装备栏？")
					.set("ai", () => true)
					.forResult();
				if (bool) {
					await player.chooseToEnable({
						ai(event, player, list) {
							if (list.includes("equip1")) {
								return "equip1";
							} else if (list.includes("equip4")) {
								return "equip4";
							}
							return list[0];
						},
					});
				}
			}
			const findEquipCard = slot => {
				const find = card => get.type(card, null, false) == "equip" && (!slot || get.subtype(card) == slot);
				return get.cardPile2(find, "random") || get.discardPile(find, "random");
			};
			const emptySlots = Array.from({ length: 5 }, (_, i) => i + 1)
				.filter(i => player.hasEmptySlot(i))
				.map(i => "equip" + i);

			let card = null;
			if (emptySlots.length > 0) {
				for (const slot of emptySlots) {
					card = findEquipCard(slot);
					if (card) break;
				}
			}
			if (!card) {
				card = findEquipCard();
			}
			if (!card) {
				return;
			}
			if (player.hasUseTarget(card)) {
				await player.chooseUseTarget(card, true);
			}
		},
	},
};
