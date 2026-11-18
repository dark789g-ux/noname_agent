import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olshutong" | "olzhijie" | "olqiwu" | "olzhuangrong">} */
export const groupSkills = {
	//崔琰
	olshutong: {
		audio: 2,
		forced: true,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.isFirstTarget;
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const { targets } = event;
			const suit = get.suit(trigger.card);
			[player].concat(targets.sortBySeat()).forEach(target => {
				target.addTempSkill(`${event.name}_debuff`);
				target.markAuto(`${event.name}_debuff`, suit);
			});
			if (targets.every(target => target.getHp() == player.getHp())) {
				await player.draw();
			}
		},
		subSkill: {
			debuff: {
				charlotte: true,
				onremove: true,
				silent: true,
				trigger: { player: "useCard1" },
				async content(event, trigger, player) {
					player.removeSkill(event.name);
				},
				intro: {
					content: "使用的下张牌花色不能为：$",
				},
				mod: {
					cardEnabled(card, player) {
						if (player.getStorage("olshutong_debuff").includes(get.suit(card))) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (player.getStorage("olshutong_debuff").includes(get.suit(card))) {
							return false;
						}
					},
				},
			},
		},
	},
	olzhijie: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return (player.hasHistory("useCard") || player.hasHistory("respond")) && game.hasGlobalHistory("useCard", evt => evt.targets.includes(player)) && game.hasPlayer(target => player.inRange(target));
		},
		locked: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(`###${get.translation(event.skill)}###${get.skillInfoTranslation(event.skill, player)}`, true, (card, player, target) => {
					return player.inRange(target);
				})
				.set("ai", target => get.damageEffect(target, get.player(), get.player()))
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			await targets[0].damage();
		},
	},
	//吕玲绮
	olqiwu: {
		audio: 4,
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filter(event, player) {
			if (!player.countCards("he", card => get.info("olqiwu").filterCard(card, player))) {
				return false;
			}
			const card = new lib.element.VCard({ name: "sha", storage: { olqiwu: true }, isCard: true });
			return player.hasUseTarget(card);
		},
		viewAs: {
			name: "sha",
			storage: {
				olqiwu: true,
			},
			suit: "none",
			number: null,
			isCard: true,
		},
		filterCard(card, player) {
			if (!lib.filter.cardDiscardable(card, player, "olqiwu")) {
				return false;
			}
			return true;
		},
		selectCard: [1, Infinity],
		check(card) {
			const player = get.player();
			const hp = player.hp;
			const hs = player.countCards("h");
			if (player.getStorage("olzhuangrong_destroy").includes(card)) {
				return 0;
			}
			if (ui.selected.cards.some(cardx => get.suit(card) == get.suit(cardx))) {
				return 0;
			}
			if (hp == 1) {
				if (get.name(card) == "shan") {
					return 10;
				}
				return 0;
			}
			if (hs > 3) {
				if (ui.selected.cards.length > 1) {
					return 0;
				}
				return 6 - get.value(card);
			}
			return 6 - get.value(card);
		},
		log: false,
		ignoreMod: true,
		locked: false,
		mod: {
			targetInRange(card, player) {
				if (card?.storage?.olqiwu) {
					return true;
				}
			},
			cardUsable(card, player) {
				if (card?.storage?.olqiwu) {
					return Infinity;
				}
			},
			aiOrder(player, card, num) {
				if (player.hasSkill("olzhuangrong_awaken", null, null, false)) {
					return;
				}
				if (num > 0 && get.itemtype(card) === "card" && !player.getStorage("olzhuangrong_destroy").includes(card)) {
					const subtype = get.subtype(card);
					if (!["equip1", "equip2", "equip5"].includes(subtype)) {
						return;
					}
					const list = player
						.getCards("e")
						.filter(card => Object.keys(get.info("olzhuangrong").equipMap).includes(card.name))
						.map(cardx => get.subtype(cardx));
					if (list.includes(subtype) && !player.expandedSlots?.[subtype]) {
						return 0;
					}
				}
			},
			aiValue(player, card, num) {
				if (player.hasSkill("olzhuangrong_awaken", null, null, false)) {
					return;
				}
				if (num > 0 && get.itemtype(card) === "card") {
					if (player.getStorage("olzhuangrong_destroy").includes(card)) {
						return 1.5 * num;
					} else {
						const subtype = get.subtype(card);
						if (!["equip1", "equip2", "equip5"].includes(subtype)) {
							return;
						}
						const list = player
							.getCards("e")
							.filter(card => Object.keys(get.info("olzhuangrong").equipMap).includes(card.name))
							.map(cardx => get.subtype(cardx));
						if (list.includes(subtype) && !player.expandedSlots?.[subtype]) {
							return 0.1 * num;
						}
					}
				}
			},
			aiUseful() {
				return lib.skill.olqiwu.mod.aiValue.apply(this, arguments);
			},
		},
		async precontent(event, trigger, player) {
			const cards = event.result.cards;
			player.logSkill("olqiwu");
			await player.modedDiscard(cards);
			event.result.card = get.autoViewAs({ name: "sha", storage: { olqiwu: true }, isCard: true });
			event.result.cards = [];
			event.getParent().addCount = false;
			player
				.when("useCard1")
				.filter(evt => evt.getParent() == event.getParent())
				.step(async (event, trigger, player) => {
					const num = cards?.map(card => get.suit(card)).toUniqued().length;
					const func = async target => {
						const numx = Math.min(num, target.countDiscardableCards(target, "he"));
						let allCards = cards;
						const result =
							numx > 0
								? await target.chooseToDiscard("he", numx, true).forResult()
								: {
										bool: false,
									};
						if (result?.bool && result.cards?.length) {
							allCards = [...allCards, ...result.cards];
						}
						if (allCards?.some(card => card.name == "shan")) {
							player.addTempSkill("olqiwu_effect");
							const gains = allCards.filter(card => card.name == "shan" && get.position(card) == "d");
							if (gains.length) {
								const next = player.gain(gains, "gain2");
								next.gaintag.add("olqiwu");
								await next;
							}
						} else {
							trigger.directHit.addArray(game.players);
						}
					};
					await game.doAsyncInOrder(trigger.targets, func);
				});
		},
		ai: {
			order(item, player) {
				player ??= get.player();
				return get.order({ name: "sha" }, player) + 0.1;
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag("olqiwu");
				},
				mod: {
					ignoredHandcard(card) {
						if (card.hasGaintag("olqiwu")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name === "phaseDiscard" && card.hasGaintag("olqiwu")) {
							return false;
						}
					},
				},
			},
			rewrite: {},
		},
	},
	olzhuangrong: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		forced: true,
		equipMap: {
			shufazijinguan: ["diamond", 1],
			linglongshimandai: ["spade", 2],
			hongmianbaihuapao: ["club", 1],
			wushuangfangtianji: ["diamond", 12],
		},
		init(player, skill) {
			const map = `${skill}_map`;
			_status[map] ??= new Map();
			if (!_status[map].has(player)) {
				_status[map].set(player, Object.keys(get.info(skill).equipMap));
			}
			game.broadcastAll(
				(map, list) => {
					_status[map] = list;
				},
				map,
				_status[map]
			);
		},
		filter(event, player) {
			if (!_status.olzhuangrong_map?.has(player)) {
				get.info("olzhuangrong").init(player, "olzhuangrong");
			}
			return _status.olzhuangrong_map.get(player)?.some(name => player.canEquip(name));
		},
		async content(event, trigger, player) {
			const list = _status.olzhuangrong_map.get(player);
			const map = get.info(event.name).equipMap;
			if (list.length && list.some(name => player.canEquip(name))) {
				const name = list.filter(name => player.canEquip(name)).randomGet();
				const card = game.createCard2(name, map[name][0], map[name][1]);
				game.broadcastAll(
					(player, list) => {
						_status.olzhuangrong_map.set(player, list);
					},
					player,
					list.remove(name)
				);
				if (card) {
					player.addSkill(`${event.name}_destroy`);
					player.markAuto(`${event.name}_destroy`, card);
					player.$gain2(card);
					await player.equip(card);
					await game.delayx();
				}
			}
		},
		group: "olzhuangrong_count",
		subSkill: {
			destroy: {
				trigger: { global: "loseBegin" },
				forced: true,
				charlotte: true,
				popup: false,
				onremove: true,
				filter(event, player) {
					const storage = player.getStorage("olzhuangrong_destroy");
					return event.cards?.some(card => storage.includes(card));
				},
				async content(event, trigger, player) {
					const storage = player.getStorage(event.name);
					for (const card of trigger.cards) {
						if (storage.includes(card)) {
							player.unmarkAuto(event.name, card);
							card._destroy = true;
						}
					}
					if (!storage.length) {
						player.removeSkill(event.name);
					}
				},
			},
			count: {
				audio: "olzhuangrong",
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					if (player.hasSkill("olzhuangrong_awaken")) {
						return false;
					}
					const evts = player.getAllHistory("useSkill", evt => {
						return Object.keys(get.info("olzhuangrong").equipMap)
							.flatMap(name => lib.card[name]?.skills || [])
							.includes(evt.skill);
					});
					return evts.length > 1;
				},
				skillAnimation: true,
				animationColor: "gray",
				forced: true,
				async content(event, trigger, player) {
					player.addSkill("olzhuangrong_awaken");
					await player.gainMaxHp();
					await player.recover();
				},
			},
			awake: {
				trigger: {
					player: ["loseAfter"],
					global: ["loseAsyncAfter", "gainAfter", "equipAfter", "addJudgeAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (event.name == "equip" && event.player == player) {
						if (event.getParent().name == "olzhuangrong" && !_status.olzhuangrong_map?.get(player)?.length) {
							return true;
						}
					}
					const evts = player.getAllHistory("lose", evt => {
						if (!evt.es?.length) {
							return false;
						}
						const historys = game.getAllGlobalHistory("everything", evtx => ["lose", "equip"].includes(evtx.name) && evtx.player == player, evt).reverse();
						if (!historys.length) {
							return false;
						}
						return evt.es.some(card => {
							for (let i = 0; i < historys.length; i++) {
								const evtx = historys[i];
								if (evtx == evt) {
									continue;
								}
								if (evtx.name == "lose" && evtx.es?.includes(card)) {
									return false;
								}
								if (evtx.name == "equip" && evtx.cards?.includes(card) && evtx.getParent().name == "olzhuangrong") {
									return true;
								}
							}
							return false;
						});
					});
					const loseEvt = evt => (event.name == "lose" ? evt : evt.getParent());
					return evts.map(loseEvt).indexOf(event) == 1;
				},
				forced: true,
				async content(event, trigger, player) {
					await player.removeSkills("olzhuangrong");
					player.addSkill("olzhuangrong_awaken");
					await player.gainMaxHp();
					await player.recover();
				},
			},
			awaken: {
				charlotte: true,
			},
		},
		derivation: "olqiwu_rewrite",
	},
};
