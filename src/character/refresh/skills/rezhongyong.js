import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rezhongyongSkills = {
	rezhongyong: {
		trigger: { player: "useCardAfter" },
		audio: 2,
		direct: true,
		filter(event, player) {
			return event.card.name == "sha";
		},
		async content(event, trigger, player) {
			const { cards } = event;
			const usedCards = trigger.cards.filterInD();
			let allCards = usedCards.slice();
			game.countPlayer2(function (current) {
				current.getHistory("useCard", function (evt) {
					if (evt.card.name == "shan" && evt.getParent(3) == trigger) {
						allCards.addArray(evt.cards.filterInD("od"));
					}
				});
			});
			if (!allCards.length) {
				return;
			}
			const targetResult = await player
				.chooseTarget(get.prompt2("rezhongyong"), "令一名其他角色获得" + get.translation(allCards), function (card, player, target) {
					return !_status.event.source.includes(target) && target != player;
				})
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target);
				})
				.set("source", trigger.targets)
				.forResult();
			if (targetResult.bool) {
				const target = targetResult.targets[0];
				player.logSkill("rezhongyong", target);
				target.gain(allCards, "gain2");
				let red = false,
					black = false;
				for (const i of allCards) {
					const color = get.color(i, false);
					if (color == "red") {
						red = true;
					}
					if (color == "black") {
						black = true;
					}
					if (red && black) {
						break;
					}
				}
				if (red) {
					target
						.chooseToUse("是否使用一张杀？", { name: "sha" })
						.set("filterTarget", function (card, player, target) {
							return target != _status.event.sourcex && _status.event.sourcex.inRange(target) && lib.filter.targetEnabled.apply(this, arguments);
						})
						.set("sourcex", player)
						.set("addCount", false);
				}
				if (black) {
					target.draw();
				}
			}
		},
	},
	//长标
	changbiao: {
		audio: 2,
		mod: {
			targetInRange(card, player, target) {
				if (card.changbiao) {
					return true;
				}
			},
		},
		enable: "phaseUse",
		usable: 1,
		viewAs: {
			name: "sha",
			changbiao: true,
		},
		locked: false,
		filter(event, player) {
			return player.countCards("hs") > 0;
		},
		filterCard: true,
		selectCard: [1, Infinity],
		allowChooseAll: true,
		position: "hs",
		check(card) {
			let player = _status.event.player;
			if (ui.selected.cards.length) {
				let list = game
					.filterPlayer(function (current) {
						return current !== player && player.canUse("sha", current, false) && get.effect(current, { name: "sha" }, player, player) > 0;
					})
					.sort(function (a, b) {
						return get.effect(b, { name: "sha" }, player, player) - get.effect(a, { name: "sha" }, player, player);
					});
				if (!list.length) {
					return 0;
				}
				let target = list[0],
					cards = ui.selected.cards.concat([card]),
					color = [];
				for (let i of cards) {
					if (!color.includes(get.color(i, player))) {
						color.add(get.color(i, player));
					}
				}
				if (color.length !== 1) {
					color[0] = "none";
				}
				if (
					player.hasSkillTag(
						"directHit_ai",
						true,
						{
							target: target,
							card: {
								name: "sha",
								suit: "none",
								color: color[0],
								cards: cards,
								isCard: true,
							},
						},
						true
					)
				) {
					return 6.5 - get.value(card, player);
				}
				if (
					Math.random() * target.countCards("hs") < 1 ||
					player.needsToDiscard(0, (i, player) => {
						return !ui.selected.cards.includes(i) && !player.canIgnoreHandcard(i);
					})
				) {
					return 6 - get.value(card, player);
				}
				return 0;
			}
			return 6.3 - get.value(card);
		},
		onuse(result, player) {
			player.addTempSkill("changbiao_draw");
		},
		subSkill: {
			draw: {
				audio: "changbiao",
				trigger: { player: "phaseUseEnd" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return player.hasHistory("sourceDamage", function (evxt) {
						var evt = evxt.getParent();
						return evt && evt.name == "sha" && evt.skill == "changbiao" && evt.getParent("phaseUse") == event;
					});
				},
				async content(event, trigger, player) {
					const cards = [];
					for (const evxt of player.getHistory("sourceDamage")) {
						const evt = evxt.getParent();
						if (evt && evt.name === "sha" && evt.skill === "changbiao" && evt.getParent("phaseUse") === trigger) {
							cards.addArray(evt.cards);
						}
					}
					if (cards.length) {
						await player.draw(cards.length);
					}
				},
			},
		},
		ai: {
			order(item, player) {
				return (
					get.order({ name: "sha" }, player) +
					0.3 *
						(Math.min(
							player.getCardUsable("sha"),
							player.countCards("hs", "sha") +
								player.hasCard(function (card) {
									return card.name != "sha" && get.value(card, player) < 6.3;
								}, "hs")
								? 1
								: 0
						) > 1
							? -1
							: 1)
				);
			},
			nokeep: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "nokeep") {
					let num = 0;
					if (arg && (!arg.card || get.name(arg.card) !== "tao")) {
						return false;
					}
					player.getHistory("sourceDamage", function (evxt) {
						let evt = evxt.getParent();
						if (evt && evt.name == "sha" && evt.skill == "changbiao") {
							num += evt.cards.length;
						}
					});
					return player.needsToDiscard(num) > 0;
				}
			},
		},
	},
	//国钟会
	gzquanji: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		frequent: true,
		preHidden: true,
		filter(event, player, name) {
			if (player.getStorage("gzquanji_used").includes(name)) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			player.addTempSkill("gzquanji_used");
			player.markAuto("gzquanji_used", event.triggername);
			player.draw();
			const hs = player.getCards("he");
			if (hs.length > 0) {
				let result;
				if (hs.length == 1) {
					result = { bool: true, cards: hs };
				} else {
					result = await player.chooseCard("he", true, "选择一张牌作为“权”").forResult();
				}
				if (result.bool) {
					const cs = result.cards;
					player.addToExpansion(cs, player, "give").gaintag.add("gzquanji");
				}
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		locked: false,
		mod: {
			maxHandcard(player, num) {
				return num + player.getExpansions("gzquanji").length;
			},
		},
		ai: {
			notemp: true,
		},
		subSkill: {
			used: {
				onremove: true,
				charlotte: true,
			},
		},
	},
	gzpaiyi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.getExpansions("gzquanji").length > 0;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("排异", player.getExpansions("gzquanji"), "hidden");
			},
			backup(links, player) {
				return {
					audio: "gzpaiyi",
					filterTarget: true,
					filterCard() {
						return false;
					},
					selectCard: -1,
					card: links[0],
					delay: false,
					content: lib.skill.gzpaiyi.contentx,
					ai: {
						order: 10,
						result: {
							target(player, target) {
								if (target != player) {
									return 0;
								}
								if (player.getExpansions("gzquanji").length <= 1 || (player.needsToDiscard() && !player.getEquip("zhuge") && !player.hasSkill("new_paoxiao"))) {
									return 0;
								}
								return 1;
							},
						},
					},
				};
			},
			prompt() {
				return "请选择【排异】的目标";
			},
		},
		async contentx(event, trigger, player) {
			const { target } = event;
			const card = lib.skill.gzpaiyi_backup.card;
			await player.loseToDiscardpile(card);
			const num = player.getExpansions("gzquanji").length;
			if (num > 0) {
				await target.draw(Math.min(7, num));
			}
			if (target.countCards("h") > player.countCards("h")) {
				await target.damage();
			}
		},
		ai: {
			order(item, player) {
				var num = player.getExpansions("gzquanji").length;
				if (num == 1) {
					return 8;
				}
				return 1;
			},
			result: {
				player: 1,
			},
			combo: "gzquanji",
		},
	},
	gzquanji2: { charlotte: true },
	xingongji: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		position: "he",
		filterCard: true,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		check(card) {
			var base = 0,
				player = _status.event.player,
				suit = get.suit(card, player),
				added = false,
				added2 = false,
				added3;
			if (
				get.type(card) == "equip" &&
				game.hasPlayer(function (target) {
					var att = get.attitude(player, target);
					if (att >= 0) {
						return 0;
					}
					if (
						target.countCards("he", function (card) {
							return get.value(card) > 5;
						})
					) {
						return -att;
					}
				})
			) {
				base += 6;
			}
			var hs = player.getCards("h");
			var muniu = player.getEquip("muniu");
			if (muniu && card != muniu && muniu.cards) {
				hs = hs.concat(muniu.cards);
			}
			for (var i of hs) {
				if (i != card && get.name(i) == "sha") {
					if (get.suit(i, player) == suit) {
						if (player.hasValueTarget(i, false)) {
							added3 = true;
							base += 5.5;
						}
					} else {
						if (player.hasValueTarget(i, false)) {
							added2 = true;
						}
						if (!added && !player.hasValueTarget(i, null, true) && player.hasValueTarget(i, false, true)) {
							base += 4;
							added = true;
						}
					}
				}
			}
			if (added3 && !added2) {
				base -= 4.5;
			}
			return base - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards } = event;
			if (!player.storage.xingongji2) {
				player.storage.xingongji2 = [];
			}
			player.storage.xingongji2.add(get.suit(cards[0], player));
			player.addTempSkill("xingongji2");
			if (get.type(cards[0], null, cards[0].original == "h" ? player : false) == "equip") {
				const targetResult = await player
					.chooseTarget("是否弃置一名角色的一张牌？", function (card, player, target) {
						return player != target && target.countCards("he") > 0;
					})
					.set("ai", function (target) {
						var att = get.attitude(player, target);
						if (att >= 0) {
							return 0;
						}
						if (
							target.countCards("he", function (card) {
								return get.value(card) > 5;
							})
						) {
							return -att;
						}
						return -att * 0.8;
					})
					.forResult();
				if (targetResult.bool) {
					player.line(targetResult.targets, "green");
					player.discardPlayerCard(targetResult.targets[0], "he", true);
				}
			}
		},
		ai: {
			order: 4.5,
			result: {
				player: 1,
			},
		},
	},
	xingongji2: {
		charlotte: true,
		onremove: true,
		mod: {
			attackRangeBase() {
				return Infinity;
			},
			cardUsable(card, player) {
				if (card.name == "sha") {
					const suit = get.suit(card);
					if (suit === "unsure" || player.storage.xingongji2.includes(suit)) {
						return Infinity;
					}
				}
			},
			aiOrder(player, card, num) {
				if (get.name(card) == "sha" && !player.storage.xingongji2.includes(get.suit(card))) {
					return num + 1;
				}
			},
		},
		mark: true,
		intro: {
			content: "使用$花色的杀无次数限制",
		},
	},
};
