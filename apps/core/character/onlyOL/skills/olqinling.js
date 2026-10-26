import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqinling" | "olyaoming" | "olzhenshan" | "olqianju">} */
export const groupSkills = {
	olqinling: {
		audio: 2,
		enable: "chooseToUse",
		usable: 1,
		locked: false,
		mod: {
			cardUsable(card) {
				if (card.storage?.olqinling) {
					return Infinity;
				}
			},
		},
		filter(event, player) {
			if (!player.hasDiscardableCards(player, "he")) {
				return false;
			}
			return get.inpileVCardList(info => {
				if (info[2] != "sha") {
					return false;
				}
				return event.filterCard(
					get.autoViewAs(
						{
							name: info[2],
							nature: info[3],
							isCard: true,
							storage: { olqinling: true },
						},
						"unsure"
					),
					player,
					event
				);
			}).length;
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(info => {
					if (info[2] != "sha") {
						return false;
					}
					return event.filterCard(
						get.autoViewAs(
							{
								name: info[2],
								nature: info[3],
								storage: { olqinling: true },
							},
							"unsure"
						),
						player,
						event
					);
				});
				return ui.create.dialog("侵凌", [list, "vcard"]);
			},
			filter(button, player) {
				return _status.event.getParent().filterCard(
					{
						name: button.link[2],
						nature: button.link[3],
						storage: { olqinling: true },
					},
					player,
					_status.event.getParent()
				);
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				const player = get.player();
				return player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
				});
			},
			backup(links, player) {
				return {
					filterCard: lib.filter.cardDiscardable,
					audio: "olqinling",
					popname: true,
					check(card) {
						return 8 - get.value(card);
					},
					position: "he",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
						suit: "none",
						color: "none",
						number: null,
					},
					log: false,
					ignoreMod: true,
					async precontent(event, trigger, player) {
						player.logSkill("olqinling");
						event.getParent().addCount = false;
						const { cards } = event.result;
						await player.modedDiscard(cards);
						event.result.cards = [];
						player
							.when({ player: "useCardAfter" })
							.filter(evt => evt.getParent() == event.getParent())
							.step(async (event, trigger, player) => {
								if (player.hasHistory("sourceDamage", evt => evt.card == trigger.card)) {
									await player.draw({ num: 1 });
								} else {
									await player.addToExpansion({
										cards,
										source: player,
										animate: "give",
										gaintag: ["olxiansi"],
									});
								}
							});
					},
				};
			},
			prompt(links, player) {
				return "弃置一张牌并视为使用" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]);
			},
		},
		hiddenCard(player, name) {
			return name == "sha" && player.hasDiscardableCards(player, "he");
		},
		ai: {
			fireAttack: true,
			respondSha: true,
			skillTagFilter(player) {
				if (!player.hasDiscardableCards(player, "he")) {
					return false;
				}
			},
			order: 3,
			result: {
				player: 1,
			},
		},
	},
	//界全琮
	olyaoming: {
		audio: 2,
		derivation: ["olzhenshan"],
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		usable: 1,
		async cost(event, trigger, player) {
			const next = player.chooseTarget({
				prompt: get.prompt2(event.skill),
				filterTarget(card, player, target) {
					let bool = false;
					if (player.countCards("h") <= target.countCards("h")) {
						bool = target.hasDiscardableCards(player, "he");
					}
					if (player.countCards("h") >= target.countCards("h")) {
						bool = true;
					}
					return bool;
				},
				ai(target) {
					let eff = 0;
					const player = get.player();
					if (player.countCards("h") >= target.countCards("h")) {
						eff += get.effect(target, { name: "draw" }, player, player);
					}
					if (player.countCards("h") <= target.countCards("h")) {
						eff += get.effect(target, { name: "guohe_copy2" }, player, player);
					}
					if (!player.getStorage("olyaoming_effect").includes(target)) {
						eff += 2;
					}
					return eff;
				},
			});
			next.targetprompt2.add(target => {
				if (!target.classList.contains("selectable")) {
					return;
				}
				let str = "";
				const player = get.player();
				if (player.countCards("h") >= target.countCards("h")) {
					str += "摸牌";
				}
				if (player.countCards("h") <= target.countCards("h")) {
					str += "弃牌";
				}
				return str;
			});
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			if (player.countCards("h") <= target.countCards("h")) {
				await player.discardPlayerCard({ target, position: "he", forced: true });
			}
			if (player.countCards("h") >= target.countCards("h")) {
				await target.draw();
			}
			if (_status.currentPhase == target) {
				player.addTempSkill("olzhenshan");
			}
			player.addSkill(event.name + "_effect");
			player.markAuto(event.name + "_effect", target);
		},
		subSkill: {
			effect: {
				forced: true,
				charlotte: true,
				popup: false,
				trigger: {
					global: ["phaseBeginStart"],
				},
				intro: {
					content: `$的回合内，你视为拥有技能${get.poptip("olzhenshan")}。`,
				},
				filter(event, player) {
					return player.getStorage("olyaoming_effect").includes(event.player);
				},
				async content(event, trigger, player) {
					player.addTempSkill("olzhenshan");
				},
			},
		},
	},
	olzhenshan: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		filter(event, player) {
			if (event.type == "wuxie") {
				return false;
			}
			const nh = player.countCards("h");
			if (
				!game.hasPlayer(function (current) {
					return current != player && current.countCards("h") < nh;
				})
			) {
				return false;
			}
			for (const i of lib.inpile) {
				if (get.type(i) != "basic") {
					continue;
				}
				const card = { name: i, isCard: true };
				if (event.filterCard(card, player, event)) {
					return true;
				}
				if (i == "sha") {
					for (const j of lib.inpile_nature) {
						card.nature = j;
						if (event.filterCard(card, player, event)) {
							return true;
						}
					}
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				const list = [];
				for (const i of lib.inpile) {
					if (get.type(i) != "basic") {
						continue;
					}
					const card = { name: i, isCard: true };
					if (event.filterCard(card, player, event)) {
						list.push(["基本", "", i]);
					}
					if (i == "sha") {
						for (const j of lib.inpile_nature) {
							card.nature = j;
							if (event.filterCard(card, player, event)) {
								list.push(["基本", "", i, j]);
							}
						}
					}
				}
				return ui.create.dialog("振赡", [list, "vcard"], "hidden");
			},
			check(button) {
				const player = _status.event.player;
				const card = { name: button.link[2], nature: button.link[3] };
				if (card.name == "jiu") {
					return 0;
				}
				if (
					game.hasPlayer(function (current) {
						return get.effect(current, card, player, player) > 0;
					})
				) {
					if (card.name == "sha") {
						const eff = player.getUseValue(card);
						if (eff > 0) {
							return 2.9 + eff / 10;
						}
						return 0;
					} else if (card.name == "tao" || card.name == "shan") {
						return 4;
					}
				}
				return 0;
			},
			backup(links, player) {
				return {
					filterCard: () => false,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
						storage: {
							olzhenshan: player,
						},
					},
					selectCard: -1,
					log: false,
					async precontent(event, trigger, player) {
						const result = await player
							.chooseTarget({
								prompt: "赈赡：选择一名手牌数小于你的角色交换手牌",
								filterTarget(card, player, target) {
									return target != player && target.countCards("h") < player.countCards("h");
								},
								forced: true,
								ai(target) {
									return get.attitude(get.player(), target) * Math.sqrt(target.countCards("h") + 1);
								},
							})
							.forResult();
						if (result?.bool) {
							player.logSkill("olzhenshan", result.targets);
							await player.swapHandcards(result.targets[0]);
							player.addTempSkill("olzhenshan_restore");
						} else {
							event.result.cancel = true;
						}
					},
				};
			},
			prompt(links, player) {
				return "选择" + get.translation(links[0][3] || "") + "【" + get.translation(links[0][2]) + "】的目标";
			},
		},
		ai: {
			order() {
				const player = _status.event.player;
				const event = _status.event;
				const nh = player.countCards("h");
				if (
					game.hasPlayer(function (current) {
						return get.attitude(player, current) > 0 && current.countCards("h") < nh;
					})
				) {
					if (event.type == "dying") {
						if (event.filterCard({ name: "tao" }, player, event)) {
							return 0.5;
						}
					} else {
						if (event.filterCard({ name: "tao" }, player, event) || event.filterCard({ name: "shan" }, player, event)) {
							return 4;
						}
						if (event.filterCard({ name: "sha" }, player, event)) {
							return 2.9;
						}
					}
				}
				return 0;
			},
			save: true,
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (player.getStat().skill.olzhenshan > 0) {
					return false;
				}
				const nh = player.countCards("h");
				return game.hasPlayer(function (current) {
					return current != player && current.countCards("h") < nh;
				});
			},
			result: {
				player(player) {
					if (_status.event.type == "dying") {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			restore: {
				charlotte: true,
				trigger: {
					global: ["useCardAfter", "respondAfter"],
				},
				filter(event, player) {
					return event.card?.storage?.olzhenshan == player;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.refreshSkill("olyaoming");
				},
			},
		},
	},
	//界曹休
	olqianju: {
		audio: 2,
		mod: {
			globalFrom(from, to, distance) {
				return distance - from.getDamagedHp();
			},
			cardUsable(card, player, num) {
				if (card.name == "sha" && !game.hasPlayer(target => target != player && !player.inRange(target))) {
					return num + 1;
				}
			},
		},
	},
};
