import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanfenjian" | "clandongxu">} */
export const groupSkills = {
	//族陈泰
	clanfenjian: {
		audio: 2,
		onChooseToUse(event) {
			const { player } = event;
			if (!game.online && !event.clanfenjian) {
				event.set("clanfenjian", true);
				event.targetprompt2.push(target => {
					if (!target.classList.contains("selectable") || event.skill !== "clanfenjian") {
						return false;
					}
					const num = target.getAttackRange() - get.event().player.getAttackRange();
					if (num < 0) {
						return "小于你";
					} else if (num > 0) {
						return "大于你";
					} else {
						return "等于你";
					}
				});
			}
		},
		enable: "phaseUse",
		filter(event, player) {
			const name = "clanfenjian_used";
			const card = get.autoViewAs({ name: "sha", isCard: true });
			return game.hasPlayer(target => {
				return !player.getStorage(name).includes(Math.sign(target.getAttackRange() - player.getAttackRange())) && player.canUse(card, target, void 0, false);
			});
		},
		filterTarget(card, player, target) {
			return !player.getStorage("clanfenjian_used").includes(Math.sign(target.getAttackRange() - player.getAttackRange())) && lib.filter.filterTarget(get.autoViewAs(get.info("clanfenjian").viewAs), player, target);
		},
		viewAs: {
			name: "sha",
			isCard: true,
			number: void 0,
			suit: "none",
			color: "none",
			storage: {
				clanfenjian: true,
			},
		},
		ignoreMod: true,
		filterCard(card, player, event) {
			return lib.filter.cardDiscardable.call(this, card, player, event);
		},
		log: false,
		async precontent(event, trigger, player) {
			const name = event.name.slice(4);
			player.logSkill(name);
			const {
				targets: [target],
				cards,
			} = event.result;
			const num = Math.sign(target.getAttackRange() - player.getAttackRange());
			player.addTempSkill(`${name}_used`, "phaseChange");
			player.markAuto(`${name}_used`, num);
			await player.discard({ cards });
			event.result.card.cards = [];
			event.result.cards = [];
			event.getParent().addCount = false;
		},
		ai: {
			order: 3,
		},
		locked: false,
		mod: {
			cardUsable(card, player) {
				if (card.storage?.clanfenjian) {
					return Infinity;
				}
			}
		},
		group: ["clanfenjian_effect"],
		subSkill: {
			effect: {
				forced: true,
				locked: false,
				trigger: {
					source: "damageSource",
				},
				filter(event, player) {
					return event.card?.storage?.clanfenjian && player.getAttackRange() > 0;
				},
				async content(event, trigger, player) {
					player.addTempSkill("clanfenjian_debuff");
					player.addMark("clanfenjian_debuff", 1, false);
				},
			},
			debuff: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/attackRange.png",
				intro: {
					markcount: storage => -storage,
					content: "攻击范围-#",
				},
				mod: {
					attackRange(player, num) {
						return num - player.countMark("clanfenjian_debuff");
					},
				},
			},
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	clandongxu: {
		audio: 2,
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage) {
				return (!storage ? "你可以将一张装备牌置于其他角色装备区（替换原装备）" : "你可以将手牌摸至X（X为你的攻击范围且至多为5）") + "，然后视为使用一张【闪】或令你被抵消的【杀】依然造成伤害。";
			},
		},
		enable: "chooseToUse",
		viewAs: {
			name: "shan",
			isCard: true,
			number: void 0,
			suit: "none",
			color: "none",
		},
		ignoreMod: true,
		viewAsFilter(player) {
			return !player.storage.clandongxu ? player.hasCards("he", { type: "equip" }) : player.countCards("h") < Math.min(player.getAttackRange(), 5);
		},
		log: false,
		filterCard(card, player) {
			if (!player.storage.clandongxu) {
				return get.type(card) == "equip";
			}
			return false;
		},
		selectCard() {
			if (!get.player().storage.clandongxu) {
				return 1;
			}
			return -1;
		},
		position: "he",
		selectTarget() {
			if (!get.player().storage.clandongxu) {
				return 1;
			}
			return -1;
		},
		filterTarget(card, player, target) {
			const vcard = get.autoViewAs(get.info("clandongxu").viewAs);
			if (player.storage.clandongxu) {
				return true;
			}
			const {
				cards: [cardx],
			} = ui.selected;
			if (!cardx) {
				return;
			}
			return target != player && target.canEquip(cardx, true);
		},
		async precontent(event, trigger, player) {
			const name = event.name.slice(4);
			const bool = player.storage[name];
			player.logSkill(name);
			player.changeZhuanhuanji(name);
			if (!bool) {
				const [card] = event.result.cards;
				const [target] = event.result.targets;
				event.result.cards = [];
				event.result.card = { name: "shan", isCard: true };
				event.result.targets = [];
				player.$give(card, target, false);
				await target.equip(card);
				await game.delayx(2);
			} else {
				await player.drawTo(Math.min(player.getAttackRange(), 5));
			}
		},
		ai: {
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "respond") {
					return false;
				}
				const bool = player.storage.clandongxu;
				if (tag == "respondShan" && ((!bool && !player.hasCards("he", card => get.type(card) == "equip")) || (bool && player.countCards("h") >= Math.min(player.getAttackRange(), 5)))) {
					return false;
				}
			},
		},
		group: ["clandongxu_guanshi"],
		subSkill: {
			guanshi: {
				audio: "clandongxu",
				trigger: {
					player: ["shaMiss", "eventNeutralized"],
				},
				filter(event, player) {
					if (event.type !== "card" || event.card.name !== "sha" || !event.target.isIn()) {
						return false;
					}
					const bool = player.storage.clandongxu;
					if (!bool) {
						return player.hasCards("he", { type: "equip" });
					} else {
						return player.countCards("h") < Math.min(player.getAttackRange(), 5);
					}
				},
				async cost(event, trigger, player) {
					const bool = player.storage.clandongxu;
					const { target, card } = trigger;
					if (!bool) {
						event.result = await player
							.chooseCardTarget({
								prompt: get.prompt(event.skill, target),
								prompt2: `将一张装备牌置于其他角色装备区（替换原装备），然后此杀依然造成伤害`,
								filterCard(card, player) {
									return get.type(card) == "equip";
								},
								filterTarget(card, player, target) {
									return target != player && target.canEquip(ui.selected.cards[0], true);
								},
								position: "he",
								ai1(card) {
									if (!get.event().goon) {
										return 0;
									}
									return 7 - get.value(card);
								},
								ai2(target) {
									return get.equipValue(ui.selected.cards[0], target);
								},
							})
							.set("goon", get.effect(target, card, player, player) > 0)
							.forResult();
					} else {
						const num = Math.min(player.getAttackRange(), 5);
						event.result = await player
							.chooseBool({
								prompt: get.prompt(event.skill, target),
								prompt2: `将手牌摸至${num}，然后此杀依然造成伤害`,
								choice: get.effect(target, card, player, player) > 0,
							})
							.forResult();
					}
				},
				async content(event, trigger, player) {
					const bool = player.storage.clandongxu;
					player.changeZhuanhuanji("clandongxu");
					if (!bool) {
						const {
							cards: [card],
							targets: [target],
						} = event;
						player.$give(card, target, false);
						await target.equip(card);
						await game.delayx(2);
					} else {
						await player.drawTo(Math.min(player.getAttackRange(), 5));
					}
					if (event.triggername === "shaMiss") {
						trigger.untrigger();
						trigger.trigger("shaHit");
						trigger._result.bool = false;
						trigger._result.result = null;
					} else {
						trigger.unneutralize();
					}
				},
			},
		},
	},
};
