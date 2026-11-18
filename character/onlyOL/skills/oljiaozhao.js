import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oljiaozhao" | "oldanxin" | "old_oljiaozhao" | "old_oldanxin">} */
export const groupSkills = {
	//界郭皇后 ——by 阿巴阿巴
	oljiaozhao: {
		audio: 2,
		derivation: ["oljiaozhao_lv1", "oljiaozhao_lv2"],
		onChooseToUse(event) {
			if (!game.online && event.type == "phase" && !event.oljiaozhao_list && !event.player.countMark("oldanxin")) {
				event.set(
					"oljiaozhao_list",
					game
						.getRoundHistory("useCard")
						.map(evt => get.name(evt.card))
						.unique()
				);
			}
		},
		hiddenCard(player, name) {
			const event = get.event();
			if (!lib.inpile.includes(name) || !["basic", "trick"].includes(get.type(name)) || player.hasSkill("oljiaozhao_used")) {
				return false;
			}
			const num = player.countMark("oldanxin");
			if (!num) {
				return event.type == "phase" && player.countCards("hes") > 0 && !event.oljiaozhao_list?.includes(name);
			}
			return num == 1 ? player.countCards("hes") > 0 : true;
		},
		enable: ["chooseToUse"],
		getList(event, player) {
			const num = player.countMark("oldanxin");
			const exclude = event.oljiaozhao_list || [];
			return get.inpileVCardList(info => {
				if (!["basic", "trick"].includes(info[0]) || exclude.includes(info[2])) {
					return false;
				}
				let vcard = [{ name: info[2], nature: info[3] }];
				if (num < 2) {
					// @ts-ignore
					vcard = [...vcard, "unsure"];
				} else {
					vcard[0].isCard = true;
				}
				return event.filterCard(get.autoViewAs(...vcard), player, event);
			});
		},
		filter(event, player) {
			const num = player.countMark("oldanxin");
			if (!num && event.type != "phase") {
				return false;
			}
			if (player.hasSkill("oljiaozhao_used")) {
				return false;
			}
			return get.info("oljiaozhao").getList(event, player).length > 0 && (num < 2 ? player.countCards("hes") > 0 : true);
		},
		chooseButton: {
			dialog(event, player) {
				const dialog = ui.create.dialog("矫诏", [get.info("oljiaozhao").getList(event, player), "vcard"], "hidden");
				return dialog;
			},
			check(button) {
				return (
					get.player().getUseValue({
						name: button.link[2],
						nature: button?.link[2],
					}) || 0.1
				);
			},
			backup(links, player) {
				const num = player.countMark("oldanxin");
				const viewAs = { name: links[0][2], nature: links[0][3] };
				if (num == 2) {
					viewAs.isCard = true;
				}
				return {
					log: false,
					viewAs,
					selectCard: num < 2 ? 1 : 0,
					filterCard: num < 2 ? true : () => false,
					position: "hes",
					async precontent(event, trigger, player) {
						const num = player.countMark("oldanxin");
						player.logSkill("oljiaozhao");
						player.addTempSkill("oljiaozhao_used", !num ? "phaseChange" : "roundStart");
					},
				};
			},
			prompt(links, player) {
				const num = player.countMark("oldanxin");
				const card = `${get.translation(links[0][3]) || ""}${get.translation(links[0][2])}`;
				if (num < 2) {
					return `###矫诏###将一张牌当作${card}使用`;
				}
				return `###矫诏###视为使用${card}`;
			},
		},
		ai: {
			order: 9,
			fireAttack: true,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond") {
					return false;
				}
				return (
					player.countMark("oldanxin") > 0 &&
					(() => {
						switch (tag) {
							case "fireAttack":
								return ["sha"];
							default:
								return [tag.slice("respond".length).toLowerCase()];
						}
					})().some(name => get.info("oljiaozhao").hiddenCard(player, name))
				);
			},
			result: {
				player(player) {
					if (_status.event.dying && player.countMark("oldanxin") > 0) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
			},
			lv1: {
				nopop: true,
			},
			lv2: {
				nopop: true,
			},
			backup: {},
		},
	},
	oldanxin: {
		audio: 2,
		trigger: {
			player: "damageEnd",
		},
		frequent: true,
		intro: { content: "当前升级等级：Lv#" },
		async content(event, trigger, player) {
			const num = player.countMark("oldanxin");
			if (num > 0) {
				await player.draw({ num });
			}
			if (num < 2) {
				player.addMark("oldanxin", 1, false);
				if (num == 1) {
					player.removeSkill("oljiaozhao_used");
				}
			}
		},
		ai: {
			maixie: true,
			effect: {
				target: (card, player, target) => {
					if (!get.tag(card, "damage") || !game.hasPlayer(targetx => targetx != target && targetx.isFriendsOf(target))) {
						return;
					}
					if (target.hp + target.hujia < 2 || player.hasSkillTag("jueqing", false, target)) {
						return 2;
					}
					if (!target.hasSkill("oljiaozhao")) {
						return [1, 1];
					}
					return [1, 0.8 * target.hp - 0.4 * target.countMark("oldanxin")];
				},
			},
		},
	},
	old_oljiaozhao: {
		audio: "oljiaozhao",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return (
				get.inpileVCardList(info => {
					if (!["basic", "trick"].includes(info[0])) {
						return false;
					}
					if (player.countMark("old_oldanxin") > 1) {
						return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3], storage: { old_oljiaozhao: player } }), player, event);
					}
					return player.countMark("old_oldanxin") || !player.getStorage("old_oljiaozhao_used").includes(info[2]);
				}).length > 0
			);
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(info => {
					if (!["basic", "trick"].includes(info[0])) {
						return false;
					}
					if (player.countMark("old_oldanxin") > 1) {
						return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3], storage: { old_oljiaozhao: player } }), player, event);
					}
					return player.countMark("old_oldanxin") || !player.getStorage("old_oljiaozhao_used").includes(info[2]);
				});
				const dialog = ui.create.dialog("矫诏", [list, "vcard"]);
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				return (
					get.player().getUseValue({
						name: button.link[2],
						nature: button?.link[2],
						storage: { old_oljiaozhao: get.player() },
					}) || 0.1
				);
			},
			backup(links, player) {
				if (player.countMark("old_oldanxin") > 1) {
					return {
						audio: "old_oljiaozhao",
						viewAs: {
							name: links[0][2],
							nature: links[0][3],
							storage: { old_oljiaozhao: player },
							isCard: true,
						},
						filterCard: () => false,
						selectCard: -1,
						popname: true,
					};
				} else {
					return {
						ai1(card) {
							return 8 - get.value(card);
						},
						viewasCard: {
							name: links[0][2],
							nature: links[0][3],
							storage: { old_oljiaozhao: player },
						},
						filterCard: true,
						discard: false,
						lose: false,
						delay: false,
						async content(event, trigger, player) {
							const card = event.cards[0];
							await player.showCards(card);
							const fakecard = get.info(event.name)?.viewasCard;
							game.broadcastAll(card => {
								card.addGaintag("old_oljiaozhao");
							}, card);
							player.addSkill("old_oljiaozhao_used");
							player.markAuto("old_oljiaozhao_used", fakecard.name);
							player.chat(get.translation(fakecard));
							game.log(player, "声明了", "#g" + get.translation(fakecard));
							player.addTempSkill("old_oljiaozhao_viewas");
							const map = player.getStorage("old_oljiaozhao_viewas", new Map());
							map.set(card, (map.get(card) || []).concat([fakecard]));
							player.setStorage("old_oljiaozhao_viewas", map);
						},
						ai: {
							order: 9,
							result: {
								player: 8,
							},
						},
					};
				}
			},
			prompt(links, player) {
				let card = `${get.translation(links[0][3]) || ""}${get.translation(links[0][2])}`;
				if (player.countMark("old_oldanxin") > 1) {
					return `###矫诏###视为使用一张${card}（你不是此牌的合法目标）`;
				}
				return `###矫诏###展示一张手牌，本回合你可将此牌当做${card}使用（你不是此牌的合法目标）。`;
			},
		},
		ai: {
			order: 9,
			result: {
				player: 8,
			},
		},
		locked: false,
		mod: {
			targetEnabled(card, player, target) {
				if (card.storage?.old_oljiaozhao == target) {
					return false;
				}
			},
		},
		derivation: ["old_oljiaozhao_lv1", "old_oljiaozhao_lv2"],
		subSkill: {
			lv1: {
				nopop: true,
			},
			lv2: {
				nopop: true,
			},
			backup: {},
			viewas_backup: {},
			used: {
				onremove: true,
				charlotte: true,
			},
			viewas: {
				enable: "chooseToUse",
				charlotte: true,
				locked: false,
				mod: {
					targetEnabled(card, player, target) {
						if (card.storage?.old_oljiaozhao == target) {
							return false;
						}
					},
				},
				onChooseToUse(event) {
					if (game.online || event.old_oljiaozhao_record) {
						return;
					}
					event.set("old_oljiaozhao_record", event.player.getStorage("old_oljiaozhao_viewas", new Map()));
				},
				filter(event, player) {
					const map = event.old_oljiaozhao_record;
					return (
						map &&
						player.countCards("h", card => {
							if (!map.has(card)) {
								return false;
							}
							return map.get(card)?.some(vcard => {
								return event.filterCard(get.autoViewAs(vcard, [card]), player, event);
							});
						})
					);
				},
				chooseButton: {
					dialog(event, player) {
						const map = event.old_oljiaozhao_record,
							list = [],
							names = [];
						map.forEach((vcards, card) => {
							if (!player.getCards("h").includes(card)) {
								return false;
							}
							for (let vcard of vcards) {
								if (event.filterCard(get.autoViewAs(vcard, [card]), player, event)) {
									list.push(vcard);
									names.push(card);
								}
							}
						});
						const dialog = ui.create.dialog("矫诏", [list, "vcard"]);
						for (let i = 0; i < dialog.buttons?.length; i++) {
							dialog.buttons[i].node.gaintag.innerHTML = get.translation(names[i]);
						}
						dialog.direct = true;
						return dialog;
					},
					check(button) {
						return get.player().getUseValue({
							name: button.link[2],
							nature: button.link[3],
							storage: { old_oljiaozhao: get.player() },
						});
					},
					backup(links, player) {
						return {
							audio: "old_oljiaozhao",
							viewAs: links[0],
							record: get.event().old_oljiaozhao_record,
							filterCard(card) {
								const { viewAs, record } = get.info("old_oljiaozhao_viewas_backup");
								return card.hasGaintag("old_oljiaozhao") && record?.has(card) && record.get(card)?.includes(viewAs);
							},
							popname: true,
						};
					},
					prompt(links, player) {
						return `###矫诏###将对应“矫诏”牌当做${get.translation(get.translation(links[0]))}使用`;
					},
				},
				hiddenCard(player, name) {
					if (!lib.inpile.includes(name)) {
						return false;
					}
					const map = player.getStorage("old_oljiaozhao_viewas", new Map());
					return map.some((vcards, card) => {
						return player.getCards("h").includes(card) && vcards.some(vcard => vcard.name == name);
					});
				},
				onremove(player, skill) {
					player.removeGaintag("old_oljiaozhao");
					player.removeStorage(skill);
				},
				ai: {
					order: 8,
					result: {
						player: 1,
					},
				},
			},
		},
	},
	old_oldanxin: {
		audio: "oldanxin",
		trigger: {
			player: "damageEnd",
		},
		frequent: true,
		intro: { content: "当前升级等级：Lv#" },
		async content(event, trigger, player) {
			await player.draw();
			if (player.countMark("old_oldanxin") < 2) {
				player.addMark("old_oldanxin", 1, false);
			}
		},
		ai: {
			maixie: true,
			effect: {
				target: (card, player, target) => {
					if (!get.tag(card, "damage")) {
						return;
					}
					if (target.hp + target.hujia < 2 || player.hasSkillTag("jueqing", false, target)) {
						return 2;
					}
					if (!target.hasSkill("old_oljiaozhao") || target.countMark("old_oldanxin") > 1) {
						return [1, 1];
					}
					return [1, 0.8 * target.hp - 0.4];
				},
			},
		},
	},
};
