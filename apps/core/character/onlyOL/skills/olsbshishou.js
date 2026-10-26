import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbshishou" | "olxianzhen" | "olsbweilin" | "olsbduoshou">} */
export const groupSkills = {
	olsbshishou: {
		audio: 6,
		trigger: {
			global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (player.getEquip(1)) {
				return false;
			}
			const card = get.cardPile("sizhaojian", "field") || game.createCard2("sizhaojian", "diamond", 6);
			if (!player.canEquip(card, true)) {
				return false;
			}
			return game.hasPlayer(target => {
				if (target == player || target.group != "qun") {
					return false;
				}
				const evt = event.getl(target);
				return evt && evt.player == target && evt.es && evt.es.length > 0;
			});
		},
		direct: true,
		zhuSkill: true,
		async content(event, trigger, player) {
			const targets = game
				.filterPlayer(target => {
					if (target == player || target.group != "qun") {
						return false;
					}
					const evt = trigger.getl(target);
					return evt && evt.player == target && evt.es && evt.es.length > 0;
				})
				.sortBySeat();
			const card = get.cardPile("sizhaojian", "field") || game.createCard2("sizhaojian", "diamond", 6);
			for (const target of targets) {
				const { bool } = await target
					.chooseBool(get.prompt("olsbshishou", player), "将" + get.translation(card) + "置入" + get.translation(player) + "的装备区中")
					.set("choice", get.attitude(target, player) > 0)
					.forResult();
				if (bool) {
					target.logSkill("olsbshishou", player);
					if (get.owner(card)) {
						get.owner(card).$give(card, player, false);
					} else {
						player.$gain2(card, false);
						await game.delayx();
					}
					player.equip(card);
					break;
				}
			}
		},
	},
	//界高顺
	olxianzhen: {
		audio: "rexianzhen",
		inherit: "xianzhen",
		async content(event, trigger, player) {
			const target = event.target;
			const { bool } = await player.chooseToCompare(target).forResult();
			if (bool) {
				player.markAuto("olxianzhen_effect", [target]);
				player.addTempSkill("olxianzhen_effect");
			} else {
				player.markAuto("olxianzhen_buff", [target]);
				player.addTempSkill("olxianzhen_buff");
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				audio: "rexianzhen",
				mod: {
					targetInRange(card, player, target) {
						if (player.getStorage("olxianzhen_effect").includes(target)) {
							return true;
						}
					},
					cardUsableTarget(card, player, target) {
						if (player.getStorage("olxianzhen_effect").includes(target)) {
							return true;
						}
					},
				},
				trigger: { player: "useCard2" },
				filter(event, player) {
					if (event.card.name != "sha" && get.type(event.card) != "trick") {
						return false;
					}
					if (!Array.isArray(event.targets)) {
						return false;
					}
					return game.hasPlayer(target => {
						if (!player.getStorage("olxianzhen_effect").includes(target)) {
							return false;
						}
						return !event.targets.includes(target) && lib.filter.targetEnabled2(event.card, player, target);
					});
				},
				async cost(event, trigger, player) {
					const targets = game.filterPlayer(target => {
						if (!player.getStorage("olxianzhen_effect").includes(target)) {
							return false;
						}
						return !trigger.targets.includes(target) && lib.filter.targetEnabled2(trigger.card, player, target);
					});
					if (targets.length == 1) {
						const target = targets[0];
						const { bool } = await player.chooseBool(get.prompt(event.skill, target), "令" + get.translation(target) + "也成为" + get.translation(trigger.card) + "的目标").forResult();
						event.result = { bool: bool, targets: targets };
					} else {
						event.result = await player
							.chooseTarget(get.prompt(event.skill), "令任意名【陷阵】拼点成功的目标角色也成为" + get.translation(trigger.card) + "的目标", (card, player, target) => {
								const trigger = get.event().getTrigger();
								if (!player.getStorage("olxianzhen_effect").includes(target)) {
									return false;
								}
								return !trigger.targets.includes(target) && lib.filter.targetEnabled2(trigger.card, player, target);
							})
							.set("ai", target => {
								const player = get.event().player,
									trigger = get.event().getTrigger();
								return get.effect(target, trigger.card, player, player);
							})
							.forResult();
					}
				},
				content() {
					trigger.targets.addArray(event.targets);
					game.log(event.targets, "成为了", trigger.card, "的额外目标");
				},
				ai: {
					unequip: true,
					skillTagFilter(player, tag, arg) {
						if (!arg || !arg.target || !player.getStorage("olxianzhen_effect").includes(arg.target)) {
							return false;
						}
					},
					effect: {
						player_use(card, player, target, current, isLink) {
							if (isLink || !target || player._olxianzhen_effect_temp) {
								return;
							}
							if (!player.getStorage("olxianzhen_effect").includes(target) && ["sha", "guohe", "shunshou", "huogong", "juedou"].includes(card.name)) {
								player._olxianzhen_effect_temp = true;
								let eff = get.effect(target, card, player, player);
								delete player._olxianzhen_effect_temp;
								if (eff > 0) {
									return [1, 2];
								}
							}
						},
					},
				},
			},
			buff: {
				charlotte: true,
				onremove: true,
				mod: {
					playerEnabled(card, player, target) {
						if (get.name(card, player) == "sha" && player.getStorage("olxianzhen_buff").includes(target)) {
							return false;
						}
					},
					ignoredHandcard(card, player) {
						if (get.name(card, player) == "sha") {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && get.name(card, player) == "sha") {
							return false;
						}
					},
				},
			},
		},
	},
	//新OL谋关羽
	olsbweilin: {
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			return get
				.inpileVCardList(info => {
					const name = info[2];
					if (name != "sha" && name != "jiu") {
						return false;
					}
					return get.type(name) == "basic";
				})
				.some(card => player.hasCard(cardx => event.filterCard({ name: card[2], nature: card[3], cards: [cardx] }, player, event), "hes"));
		},
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				const list = get
					.inpileVCardList(info => {
						const name = info[2];
						if (name != "sha" && name != "jiu") {
							return false;
						}
						return get.type(name) == "basic";
					})
					.filter(card => player.hasCard(cardx => event.filterCard({ name: card[2], nature: card[3], cards: [cardx] }, player, event), "hes"));
				return ui.create.dialog("威临", [list, "vcard"]);
			},
			filter(button, player) {
				return _status.event.getParent().filterCard(get.autoViewAs({ name: button.link[2], nature: button.link[3] }, "unsure"), player, _status.event.getParent());
			},
			check(button) {
				if (_status.event.getParent().type != "phase") {
					return 1;
				}
				const player = get.event().player,
					value = player.getUseValue({ name: button.link[2], nature: button.link[3] });
				if (button.link[2] == "sha" && !player.getHistory("useCard", evt => get.type(evt.card) == "basic").length) {
					if (value > 0) {
						return value + 20;
					}
				}
				return value;
			},
			backup(links, player) {
				return {
					audio: "olsbweilin",
					filterCard: true,
					popname: true,
					check(card) {
						const name = lib.skill.olsbweilin_backup.viewAs.name,
							color = get.color(card);
						const phase = _status.event.getParent().type == "phase";
						if (phase && name == "sha" && color == "red") {
							return 10 - get.value(card);
						}
						if (name == "tao") {
							return 7 + [-2, 0, 2][["black", "red", "none"].indexOf(color)] - get.value(card);
						}
						return 6 - get.value(card);
					},
					position: "hse",
					viewAs: { name: links[0][2], nature: links[0][3] },
					precontent() {
						player.addTempSkill("olsbweilin_effect");
					},
					ai: {
						directHit_ai: true,
						skillTagFilter(player, tag, arg) {
							if (get.event().skill != "olsbweilin_backup") {
								return false;
							}
							return arg && arg.card && arg.card.name == "sha" && get.color(arg.card) == "red";
						},
					},
				};
			},
			prompt(links, player) {
				return "将一张牌当作" + (get.translation(links[0][3]) || "") + "【" + get.translation(links[0][2]) + "】使用";
			},
		},
		hiddenCard(player, name) {
			if (!lib.inpile.includes(name) || name != "jiu") {
				return false;
			}
			return get.type(name) == "basic" && !player.getStat("skill").olsbweilin && player.countCards("hes");
		},
		ai: {
			fireAttack: true,
			respondSha: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				if (player.getStat("skill").olsbweilin || !player.countCards("hes")) {
					return false;
				}
			},
			order(item, player) {
				if (player && _status.event.type == "phase" && player.hasValueTarget({ name: "sha" }, true, true)) {
					let max = 0,
						names = get.inpileVCardList(info => {
							const name = info[2];
							if (name != "sha" && name != "jiu") {
								return false;
							}
							return get.type(name) == "basic";
						});
					names = names.map(namex => {
						return { name: namex[2], nature: namex[3] };
					});
					names.forEach(card => {
						if (player.getUseValue(card) > 0) {
							let temp = get.order(card);
							if (card.name == "jiu") {
								let cards = player.getCards("hs", cardx => get.value(cardx) < 8);
								cards.sort((a, b) => get.value(a) - get.value(b));
								if (!cards.some(cardx => get.name(cardx) == "sha" && !cards.slice(0, 2).includes(cardx))) {
									temp = 0;
								}
							}
							if (temp > max) {
								max = temp;
							}
						}
					});
					if (max > 0) {
						max += 15;
					}
					return max;
				}
				return 0.5;
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
		subSkill: {
			backup: {},
			effect: {
				charlotte: true,
				trigger: { player: "useCardToBegin" },
				filter(event, player) {
					return event.target?.isIn() && event.skill === "olsbweilin_backup";
				},
				forced: true,
				popup: false,
				content() {
					const target = trigger.target;
					target.addTempSkill("olsbweilin_wusheng");
					target.markAuto("olsbweilin_wusheng", [get.color(trigger.card)]);
				},
			},
			wusheng: {
				charlotte: true,
				onremove: true,
				mod: {
					cardname(card, player) {
						if (player.getStorage("olsbweilin_wusheng").includes(get.color(card))) {
							return "sha";
						}
					},
				},
				intro: { content: "手牌中所有$牌均视为【杀】" },
			},
		},
	},
	olsbduoshou: {
		init(player) {
			if (player.getHistory("useCard", evt => get.color(evt.card) == "red").length) {
				player.addTempSkill("olsbduoshou_used");
			}
		},
		mod: {
			targetInRange(card, player, target) {
				if (get.color(card) == "red" && !player.hasSkill("olsbduoshou_used")) {
					return true;
				}
			},
		},
		audio: 2,
		trigger: {
			player: "useCard",
			source: "damageSource",
		},
		filter(event, player) {
			if (event.name == "damage") {
				return player.getHistory("sourceDamage").indexOf(event) == 0;
			}
			if (get.color(event.card) == "red" && !player.hasSkill("olsbduoshou_used")) {
				return true;
			}
			return get.type(event.card) == "basic" && player.getHistory("useCard", evt => get.type(evt.card) == "basic").indexOf(event) == 0;
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				player.draw();
			} else {
				if (get.color(trigger.card) == "red" && !player.hasSkill("olsbduoshou_used")) {
					game.log(trigger.card, "无距离限制");
					player.addTempSkill("olsbduoshou_used");
				}
				if (get.type(trigger.card) == "basic" && player.getHistory("useCard", evt => get.type(evt.card) == "basic").indexOf(trigger) == 0) {
					game.log(trigger.card, "不计入次数上限");
					if (trigger.addCount !== false) {
						trigger.addCount = false;
						const stat = player.stat[player.stat.length - 1].card;
						if (typeof stat[trigger.card.name] === "number") {
							stat[trigger.card.name]--;
						}
					}
				}
			}
		},
		subSkill: { used: { charlotte: true } },
	},
};
