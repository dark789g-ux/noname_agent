import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "potdianyi" | "potshequan" | "potjianzhuan" | "potnizun">} */
export const groupSkills = {
	//势曹爽
	potdianyi: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
			global: "dying",
		},
		filter(event, player, name) {
			const { triggers, triggered } = player.getStorage("potdianyi", { triggers: [], triggered: [] });
			if (!triggers.includes(name)) {
				return false;
			}
			if (event.name === "damage" && event.num < 1) {
				return false;
			}
			return !triggered.includes(name);
		},
		forced: true,
		async content(event, trigger, player) {
			const name = event.triggername;
			const storage = player.getStorage(event.name, { triggers: [], triggered: [] });
			storage.triggered.push(name);
			player.setStorage(event.name, storage);
			const num = player.getRoundHistory("useSkill", evt => evt.skill == event.name).length;
			const shequanCards = game.filterPlayer(current => current != player).flatMap(cur => cur.getCards("hej", card => card.hasGaintag("eternal_potshequan")));
			Array.from(ui.cardPile.childNodes).forEach(c => {
				if (c.hasGaintag("eternal_potshequan")) {
					shequanCards.push(c);
				}
			});
			Array.from(ui.discardPile.childNodes).forEach(c => {
				if (c.hasGaintag("eternal_potshequan")) {
					shequanCards.push(c);
				}
			});
			if (!shequanCards.length) {
				return;
			}
			const gain = shequanCards.randomGets(num);
			if (gain.length) {
				await game
					.loseAsync({
						cards: gain,
						gain_list: [[player, gain]],
					})
					.setContent(async event => {
						event.type = "gain";
						const { cards, gain_list } = event;
						const position = [];
						/** @type { [[Player]] } */
						const [[player]] = gain_list;
						for (const card of cards) {
							position.push(get.position(card, "judge"));
						}
						for (const index in position) {
							const card = cards[index];
							const pos = position[index];
							if ("hesx".includes(pos)) {
								const owner = get.owner(card);
								owner?.$giveAuto([card], player);
							} else {
								player.$gain2([card], true);
							}
						}
						await game.delay(0, get.delayx(500, 500));
						await player.gain({ cards }).set("getlx", false);
						await game.delayx();
					});
			}
			const gained = player.getRoundHistory("gain", evt => evt.getParent(2)?.name === event.name).flatMap(evt => evt.cards).length;
			if (gained > player.maxHp) {
				await player.loseHp(1);
			}
		},
		group: ["potdianyi_clear"],
		subSkill: {
			clear: {
				charlotte: true,
				trigger: {
					global: "roundStart",
				},
				firstDo: true,
				silent: true,
				async content(event, trigger, player) {
					const storage = player.getStorage("potdianyi", { triggers: [], triggered: [] });
					storage.triggered = [];
					player.setStorage("potdianyi", storage, true);
				},
			},
		},
		ai: {
			threaten: 1.3,
		},
	},
	potshequan: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
			global: "dying",
		},
		filter(event, player, name) {
			const { triggers, triggered } = player.getStorage("potshequan", { triggers: [], triggered: [] });
			if (!triggers.includes(name)) {
				return false;
			}
			if (event.name === "damage" && event.num < 1) {
				return false;
			}
			return !triggered.includes(name);
		},
		forced: true,
		logTarget(event, player) {
			return game.filterPlayer(cur => cur != player && cur.isIn()).sortBySeat(player);
		},
		async content(event, trigger, player) {
			const name = event.triggername;
			const storage = player.getStorage(event.name, { triggers: [], triggered: [] });
			storage.triggered.push(name);
			player.setStorage(event.name, storage);
			const targets = game.filterPlayer(current => current != player && current.isIn() && current.hasCards("h", c => !c.hasGaintag("eternal_potshequan")));
			if (!targets.length) {
				return;
			}
			const map = await game.chooseAnyOL(targets, get.info(event.name).chooseCard, []).forResult();
			for (const target of targets) {
				const result = map.get(target);
				if (result?.bool && result.cards?.length) {
					target.addGaintag(result.cards, "eternal_potshequan");
				}
			}
		},
		chooseCard(player, eventId) {
			return player
				.chooseCard({
					prompt: "奢权：选择一张手牌标记为“奢权”",
					forced: true,
					position: "h",
					selectCard: 1,
					filterCard(card) {
						return !card.hasGaintag("eternal_potshequan");
					},
				})
				.set("ai", card => {
					return -get.value(card);
				})
				.set("id", eventId)
				.set("_global_waiting", true);
		},
		group: ["potshequan_clear"],
		subSkill: {
			clear: {
				charlotte: true,
				trigger: {
					global: "roundStart",
				},
				firstDo: true,
				silent: true,
				async content(event, trigger, player) {
					const storage = player.getStorage("potshequan", { triggers: [], triggered: [] });
					storage.triggered = [];
					player.setStorage("potshequan", storage, true);
				},
			},
		},
		ai: {
			threaten: 1.2,
		},
	},
	potjianzhuan: {
		mark: true,
		marktext: "专",
		intro: {
			name: "渐专",
			mark(dialog, storage, player) {
				const { triggers: potdianyi } = player.getStorage("potdianyi", { triggers: [] });
				const { triggers: potshequan } = player.getStorage("potshequan", { triggers: [] });
				const map = {
					damageSource: "造成伤害后",
					damageEnd: "受到伤害后",
					dying: "一名角色进入濒死状态时",
				};
				if (!potdianyi.length && !potshequan.length) {
					dialog.addText("尚未触发任何时机");
				}
				if (potdianyi.length > 0) {
					dialog.addText(`典易已添加：${potdianyi.map(t => map[t]).join("、")}`);
				}
				if (potshequan.length > 0) {
					dialog.addText(`奢权已添加：${potshequan.map(t => map[t]).join("、")}`);
				}
			},
		},
		derivation: ["potnizun"],
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
			global: "dying",
		},
		filter(event, player, name) {
			if (!player.hasSkill("potdianyi", null, false, false) && !player.hasSkill("potshequan", null, false, false)) {
				return false;
			}
			if (event.name === "damage" && event.num < 1) {
				return false;
			}
			const { triggers: potdianyi } = player.getStorage("potdianyi", { triggers: [] });
			const { triggers: potshequan } = player.getStorage("potshequan", { triggers: [] });
			const alltriggers = potdianyi.concat(potshequan);
			if (alltriggers.length === 3) {
				return true;
			}
			return !alltriggers.includes(name);
		},
		forced: true,
		popup: false,
		async content(event, trigger, player) {
			const name = event.triggername;
			const map = {
				damageSource: "造成伤害后",
				damageEnd: "受到伤害后",
				dying: "一名角色进入濒死状态时",
			};
			const choices = ["potdianyi", "potshequan"].filter(skill => player.hasSkill(skill, null, false, false)).map(skill => get.translation(skill));
			const { triggers: potdianyi } = player.getStorage("potdianyi", { triggers: [] });
			const { triggers: potshequan } = player.getStorage("potshequan", { triggers: [] });
			if (potdianyi.concat(potshequan).length == 3) {
				player.logSkill(`${event.name}_animate`);
				player.awakenSkill(event.name);
				const result = await player
					.chooseControl({
						controls: choices,
						prompt: "渐专：选择失去一个技能",
						ai() {
							return 0;
						},
					})
					.forResult();
				const skillToRemove = result?.index == 0 ? "potdianyi" : "potshequan";
				const x = player.getStorage(skillToRemove, { triggers: [] }).triggers.length - 1;
				await player.changeSkills(["potnizun"], [skillToRemove]);
				await player.gainMaxHp({ num: x });
				await player.recover({ num: x });
			} else {
				player.logSkill(event.name);
				const result = await player
					.chooseControl({
						controls: choices,
						prompt: `渐专：首次${map[name]}，选择为哪个技能添加触发时机`,
						ai(event) {
							if (get.event().controls.length == 1) {
								return 0;
							}
							return event.triggername == "dying" ? 0 : 1;
						},
					})
					.forResult();
				const skillToAdd = result?.index == 0 ? "potdianyi" : "potshequan";
				const storage = player.getStorage(skillToAdd, { triggers: [], triggered: [] });
				storage.triggers.push(name);
				player.setStorage(skillToAdd, storage, true);
				game.log(player, "的", `#g【${get.translation(skillToAdd)}】`, "增加触发时机", `#y${map[name]}`);
				player.markSkill("potjianzhuan");
				/*
				let { triggers: potdianyi } = player.getStorage("potdianyi", { triggers: [] }),
					{ triggers: potshequan } = player.getStorage("potshequan", { triggers: [] });
				if (potdianyi.concat(potshequan).length == 3) {
					game.log(player, "的", "#g【渐专】", "所有时机已触发，将于下次触发时选择失去技能");
				}
				*/
			}
		},
		global: ["potjianzhuan_mod"],
		subSkill: {
			animate: {
				skillAnimation: true,
				animationColor: "water",
			},
			mod: {
				mod: {
					cardnumber(card, owner) {
						if (card.hasGaintag?.("eternal_potshequan") && get.position(card) === "h") {
							if (owner && get.itemtype(owner) == "player") {
								return owner.hasSkill("potjianzhuan") ? 13 : 1;
							}
						}
					},
				},
			},
		},
		ai: {
			combo: ["potdianyi", "potshequan"],
			threaten: 1.5,
		},
	},
	potnizun: {
		onremove(player, skill) {
			const cards2 = player.getExpansions(skill);
			if (cards2.length) {
				player.loseToDiscardpile({ cards: cards2 });
			}
		},
		mark: true,
		marktext: "奢",
		intro: {
			markcount: "expansion",
			mark(dialog, storage, player) {
				const usedCount = player.countRoundHistory("useCard", evt => evt.skill == "potnizun_backup");
				if (usedCount > 0) {
					dialog.addText(`本轮受到的伤害+${usedCount}`);
				}
				const cards = player.getExpansions("potnizun");
				if (cards.length > 0) {
					dialog.addSmall(cards);
				} else {
					dialog.addText("武将牌上无”奢权“牌");
				}
			},
		},
		audio: 2,
		enable: ["chooseToUse"],
		usable: 1,
		hiddenCard(player, name) {
			const cards = player.getExpansions("potnizun");
			return cards.some(card => card.name === name);
		},
		filter(event, player) {
			const cards = player.getExpansions("potnizun");
			if (cards.length === 0) {
				return false;
			}
			return cards.some(card => event.filterCard(card, player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const cards = player.getExpansions("potnizun");
				const dialog = ui.create.dialog("溺尊：选择要使用的”奢权“牌", cards);
				return dialog;
			},
			filter(button, player) {
				const card = button.link;
				const evt = get.event().getParent();
				return evt?.filterCard?.(card, player, evt) ?? false;
			},
			check(button) {
				const player = get.player();
				const card = button.link;
				return player.getUseValue(card) + 0.1;
			},
			backup(links, player) {
				const card = links[0];
				return {
					audio: "potnizun",
					card: card,
					viewAs: get.autoViewAs(card, [card]),
					selectCard: -1,
					filterCard() {
						return false;
					},
					async precontent(event, _, player) {
						const card = lib.skill.potnizun_backup.card;
						event.result.cards = [card];
						event.result.card = get.autoViewAs(card, [card]);
					},
					popname: true,
				};
			},
			prompt(links, player) {
				const card = links[0];
				return `选择${get.translation(card.name)}的目标`;
			},
		},
		group: ["potnizun_damage", "potnizun_phaseEnd"],
		subSkill: {
			damage: {
				audio: "potnizun",
				trigger: {
					player: "damageBegin3",
				},
				filter(event, player) {
					return player.hasRoundHistory("useCard", evt => evt.skill == "potnizun_backup");
				},
				forced: true,
				async content(event, trigger, player) {
					const usedCount = player.countRoundHistory("useCard", evt => evt.skill == "potnizun_backup");
					trigger.num += usedCount;
				},
			},
			phaseEnd: {
				trigger: {
					global: "phaseEnd",
				},
				filter(event, player) {
					if (!player.hasHistory("useCard")) {
						return false;
					}
					const discarded = get.discarded().filter(card => card.hasGaintag("eternal_potshequan"));
					return discarded.filterInD("d").length > 0;
				},
				forced: true,
				async content(event, trigger, player) {
					const discarded = get.discarded().filter(card => card.hasGaintag("eternal_potshequan"));
					const shequanCards = discarded.filterInD("d");
					if (shequanCards.length > 0) {
						await player.addToExpansion({
							cards: shequanCards,
							animate: "gain2",
							gaintag: ["potnizun"],
						});
					}
				},
			},
		},
		ai: {
			threaten: 2,
			order: 10,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
			respondSha: true,
			respondShan: true,
			save: true,
			skillTagFilter(player, tag, arg) {
				const cards = player.getExpansions("potnizun");
				return cards.some(card => get.tag(card, tag));
			},
		},
	},
};
