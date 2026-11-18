import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "shouli">} */
export const groupSkills = {
	shouli: {
		audio: 2,
		mod: {
			cardUsable(card) {
				if (card.storage?.shouli) {
					return Infinity;
				}
			},
		},
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			if (player != _status.currentPhase && (name == "sha" || name == "shan")) {
				return true;
			}
		},
		filter(event, player) {
			if (event.responded || event.shouli || event.type == "wuxie") {
				return false;
			}
			if (
				game.hasPlayer(function (current) {
					return current.getCards("e", card => get.is.attackingMount(card)).length > 0;
				}) &&
				event.filterCard(
					get.autoViewAs(
						{
							name: "sha",
							storage: { shouli: true },
						},
						"unsure"
					),
					player,
					event
				)
			) {
				return true;
			}
			if (
				game.hasPlayer(function (current) {
					return current.getCards("e", card => get.is.defendingMount(card)).length > 0;
				}) &&
				event.filterCard(
					get.autoViewAs(
						{
							name: "shan",
							storage: { shouli: true },
						},
						"unsure"
					),
					player,
					event
				)
			) {
				return true;
			}
			return false;
		},
		delay: false,
		locked: false,
		filterTarget(card, player, target) {
			var event = _status.event,
				evt = event;
			if (event._backup) {
				evt = event._backup;
			}
			var equip3 = target.getCards("e", card => get.is.defendingMount(card, false));
			var equip4 = target.getCards("e", card => get.is.attackingMount(card, false));
			if (
				equip3.length &&
				equip3.some(card =>
					evt.filterCard(
						get.autoViewAs(
							{
								name: "shan",
								storage: { shouli: true },
							},
							[card]
						),
						player,
						event
					)
				)
			) {
				return true;
			}
			return equip4.some(card => {
				var sha = get.autoViewAs(
					{
						name: "sha",
						storage: { shouli: true },
					},
					[card]
				);
				if (evt.filterCard(sha, player, event)) {
					if (!evt.filterTarget) {
						return true;
					}
					return game.hasPlayer(function (current) {
						return evt.filterTarget(sha, player, current);
					});
				}
			});
		},
		prompt: "将场上的一张坐骑牌当做【杀】或【闪】使用或打出",
		async content(event, trigger, player) {
			/** @type {GameEvent} */
			// @ts-expect-error 类型必然存在
			const evt = event.getParent(2);
			evt.set("shouli", true);

			const equip3 = event.target.getCards("e", card => get.is.defendingMount(card, false));
			const equip4 = event.target.getCards("e", card => get.is.attackingMount(card, false));

			const cardsCanUse = [];
			const backupx = _status.event;
			_status.event = evt;
			try {
				if (
					equip3.length &&
					equip3.some(card => {
						var shan = get.autoViewAs(
							{
								name: "shan",
								storage: { shouli: true },
							},
							[card]
						);
						if (evt.filterCard(shan, player, event)) {
							return true;
						}
						return false;
					})
				) {
					cardsCanUse.push("shan");
				}
				if (
					equip4.length &&
					equip4.some(card => {
						var sha = get.autoViewAs(
							{
								name: "sha",
								storage: { shouli: true },
							},
							[card]
						);
						if (
							evt.filterCard(sha, player, evt) &&
							(!evt.filterTarget ||
								game.hasPlayer(current => {
									return evt.filterTarget(sha, player, current);
								}))
						) {
							return true;
						}
						return false;
					})
				) {
					cardsCanUse.push("sha");
				}
			} catch (e) {
				game.print(e);
			}
			_status.event = backupx;

			let result;
			if (cardsCanUse.length == 1) {
				event.cardName = cardsCanUse[0];
				const cards = cardsCanUse[0] == "shan" ? equip3 : equip4;
				if (cards.length == 1) {
					result = {
						bool: true,
						links: [cards[0]],
					};
				} else {
					result = await player
						.choosePlayerCard(true, event.target, "e")
						.set("filterButton", button => {
							return _status.event.cards.includes(button.link);
						})
						.set("cards", cards)
						.forResult();
				}
			} else {
				result = await player
					.choosePlayerCard(true, event.target, "e")
					.set("filterButton", button => {
						const card = button.link;
						return get.is.attackingMount(card) || get.is.defendingMount(card);
					})
					.forResult();
			}

			if (result.bool && result.links && result.links.length) {
				const name = event.cardName || (get.is.attackingMount(result.links[0]) ? "sha" : "shan");
				if (evt.name == "chooseToUse") {
					game.broadcastAll(
						function (result, name) {
							lib.skill.shouli_backup.viewAs = {
								name: name,
								cards: [result],
								storage: { shouli: true },
							};
							lib.skill.shouli_backup.prompt = "选择" + get.translation(name) + "（" + get.translation(result) + "）的目标";
						},
						result.links[0],
						name
					);
					evt.set("_backupevent", "shouli_backup");
					evt.backup("shouli_backup");
					evt.set("openskilldialog", "选择" + get.translation(name) + "（" + get.translation(result.links[0]) + "）的目标");
					evt.set("norestore", true);
					evt.set("custom", {
						add: {},
						replace: { window() {} },
					});
				} else {
					delete evt.result.used;
					delete evt.result.skill;
					evt.result.card = get.autoViewAs(
						{
							name: name,
							cards: [result.links[0]],
							storage: { shouli: true },
						},
						result.links
					);
					evt.result.cards = [result.links[0]];
					event.target.$give(result.links[0], player, false);
					if (player !== event.target) {
						event.target.addTempSkill("fengyin");
					}
					event.target.addTempSkill("shouli_thunder");
					player.addTempSkill("shouli_thunder");
					evt.redo();
					return;
				}
			}
			evt.goto(0);
		},
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag) {
				var func = get.is[tag == "respondSha" ? "attackingMount" : "defendingMount"];
				return game.hasPlayer(function (current) {
					return current.hasCard(card => func(card, false), "e");
				});
			},
			order: 2,
			result: {
				player(player, target) {
					var att = Math.max(8, get.attitude(player, target));
					if (_status.event.type != "phase") {
						return 9 - att;
					}
					if (!player.hasValueTarget({ name: "sha" })) {
						return 0;
					}
					return 9 - att;
				},
			},
		},
		group: "shouli_init",
		subSkill: {
			thunder: {
				charlotte: true,
				trigger: { player: "damageBegin1" },
				forced: true,
				mark: true,
				async content(event, trigger, player) {
					trigger.num++;
					game.setNature(trigger, "thunder");
				},
				marktext: "⚡",
				intro: { content: "受到的伤害+1且改为雷属性" },
				ai: {
					effect: {
						target: (card, player, target) => {
							if (!get.tag(card, "damage")) {
								return;
							}
							if (
								target.hasSkillTag("nodamage", null, {
									natures: ["thunder"],
								}) ||
								target.hasSkillTag("nothunder")
							) {
								return "zeroplayertarget";
							}
							if (
								target.hasSkillTag("filterDamage", null, {
									player: player,
									card: new lib.element.VCard(
										{
											name: card.name,
											nature: "thunder",
										},
										[card]
									),
								})
							) {
								return;
							}
							return 2;
						},
					},
				},
			},
			init: {
				audio: "shouli",
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				forced: true,
				locked: false,
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				logTarget: () => game.filterPlayer(),
				async content(event, trigger, player) {
					// @ts-expect-error player.getNext()
					const targets = game.filterPlayer().sortBySeat(player.getNext());
					event.targets = targets;

					for (const target of targets) {
						if (target.isIn()) {
							const card = get.cardPile2(card => {
								if (get.cardtag(card, "gifts")) {
									return false;
								}
								var type = get.subtype(card);
								if (type != "equip3" && type != "equip4" && type != "equip6") {
									return false;
								}
								return target.canUse(card, target);
							});
							if (card) {
								await target.chooseUseTarget(card, "nopopup", "noanimate", true);
							}
						}
					}
				},
			},
			backup: {
				async precontent(event, trigger, player) {
					const cards = event.result.card?.cards;
					event.result.cards = cards;
					event.result._apply_args = { addSkillCount: false };
					const owner = get.owner(cards[0]);
					event.target = owner;
					owner.$give(cards[0], player, false);
					player.popup(event.result.card.name, "metal");
					await game.delayx();
					event.getParent().addCount = false;
					if (player != event.target) {
						event.target.addTempSkill("fengyin");
					}
					event.target.addTempSkill("shouli_thunder");
					player.addTempSkill("shouli_thunder");
				},
				filterCard: () => false,
				prompt: "请选择【杀】的目标",
				selectCard: -1,
				log: false,
			},
		},
	},
};
