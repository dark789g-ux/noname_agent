import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "kuangbi" | "fulin" | "fulin2" | "duliang" | "duliang2" | "xinfencheng" | "xinjuece" | "xinmieji" | "qianju" | "reqianju">} */
export const groupSkills = {
	kuangbi: {
		enable: "phaseUse",
		usable: 1,
		audio: 2,
		filterTarget(card, player, target) {
			return target != player && target.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			let result;
			result = await target
				.chooseCard({
					prompt: `匡弼：将至多三张牌置于${get.translation(player)}的武将牌上`,
					selectCard: [1, 3],
					position: "he",
					forced: true,
					ai(card) {
						if (get.attitude(_status.event.player, _status.event.getParent().player) > 0) {
							return 7 - get.value(card);
						}
						return -get.value(card);
					},
				})
				.forResult();
			if (result.bool && result.cards?.length) {
				await player.addToExpansion({
					cards: result.cards,
					source: target,
					animate: "give",
					gaintag: ["kuangbi"],
				});
				if (!player.storage.kuangbi_draw) {
					player.storage.kuangbi_draw = [[], []];
				}
				player.storage.kuangbi_draw[0].push(target);
				player.storage.kuangbi_draw[1].push(result.cards.length);
				player.addSkill("kuangbi_draw");
				player.syncStorage("kuangbi_draw");
				player.updateMarks("kuangbi_draw");
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
			delete player.storage[skill];
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					if (get.attitude(player, target) > 0) {
						return Math.sqrt(target.countCards("he"));
					}
					return 0;
				},
				player: 1,
			},
		},
		subSkill: {
			draw: {
				trigger: { player: "phaseZhunbeiBegin" },
				forced: true,
				mark: true,
				charlotte: true,
				audio: "kuangbi",
				onremove: true,
				filter(event, player) {
					return player.getExpansions("kuangbi").length > 0;
				},
				async content(event, trigger, player) {
					await player.gain(player.getExpansions("kuangbi"), "gain2");
					const storage = player.storage.kuangbi_draw;
					if (storage.length) {
						for (const [index, target] of storage[0].entries()) {
							const num = storage[1][index];
							if (target && target.isIn()) {
								player.line(target);
								target.draw(num);
							}
						}
					}
					player.removeSkill("kuangbi_draw");
				},
			},
		},
	},
	fulin: {
		trigger: { player: "phaseDiscardBegin" },
		audio: 2,
		forced: true,
		async content(event, trigger, player) {
			player.addTempSkill("fulin2", "phaseDiscardAfter");
		},
		group: ["fulin_count", "fulin_reset"],
		subSkill: {
			reset: {
				trigger: { player: ["phaseBefore", "phaseAfter"] },
				silent: true,
				priority: 10,
				async content(event, trigger, player) {
					player.removeGaintag("fulin");
				},
			},
			count: {
				trigger: { player: "gainBegin" },
				audio: "fulin",
				forced: true,
				silent: true,
				filter(event, player) {
					return _status.currentPhase == player;
				},
				async content(event, trigger, player) {
					trigger.gaintag.add("fulin");
				},
			},
		},
		onremove(player) {
			player.removeGaintag("fulin");
		},
	},
	fulin2: {
		mod: {
			ignoredHandcard(card, player) {
				if (card.hasGaintag("fulin")) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && card.hasGaintag("fulin")) {
					return false;
				}
			},
		},
	},
	duliang: {
		audio: 2,
		usable: 1,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return player !== target && target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			await player.gainPlayerCard(target, "h", true);

			const name = get.translation(target);
			const result = await player
				.chooseControl({
					prompt: "督粮",
					choiceList: [`令${name}观看牌堆顶的两张牌，然后获得其中的基本牌`, `令${name}于下个摸牌阶段额外摸一张牌`],
					ai() {
						return Math.random() < 0.5 ? "选项一" : "选项二";
					},
				})
				.forResult();
			if (result.control == "选项一") {
				const cards = get.cards(2);
				await target.viewCards("督粮", cards);

				const cards2 = [];
				const tothrow = [];
				for (const card of cards) {
					if (get.type(card) == "basic") {
						ui.special.appendChild(card);
						cards2.push(card);
					} else {
						tothrow.push(card);
					}
				}
				while (tothrow.length) {
					ui.cardPile.insertBefore(tothrow.pop(), ui.cardPile.firstChild);
				}
				if (cards2.length) {
					await target.gain({
						cards: cards2,
						animate: "draw",
					});
					game.log(target, "获得了" + get.cnNumber(cards2.length) + "张牌");
				}
				game.updateRoundNumber();
				return;
			}
			target.addSkill("duliang2");
			target.updateMarks("duliang2");
			++target.storage.duliang2;
		},
		ai: {
			order: 4,
			result: {
				target: -1,
				player: 0.1,
			},
		},
	},
	duliang2: {
		audio: false,
		trigger: {
			player: "phaseDrawBegin",
		},
		charlotte: true,
		forced: true,
		sourceSkill: "duliang",
		init(player, skill) {
			player.storage[skill] ??= 0;
		},
		onremove: true,
		async content(event, trigger, player) {
			trigger.num += player.storage.duliang2;
			player.removeSkill("duliang2");
		},
		mark: true,
		intro: {
			content: "下个摸牌阶段额外摸#张牌",
		},
	},
	xinfencheng: {
		skillAnimation: "epic",
		animationColor: "gray",
		audio: 2,
		audioname: ["re_liru"],
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return player != target;
		},
		limited: true,
		selectTarget: -1,
		multitarget: true,
		multiline: true,
		line: "fire",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);

			const targets = event.targets.toSorted(lib.sort.seat);

			let num = 1;
			for (const target of targets) {
				if (!target.isIn()) {
					continue;
				}
				const res = get.damageEffect(target, player, target, "fire");
				const result = await target
					.chooseToDiscard({
						prompt: `弃置至少${get.cnNumber(num)}张牌或受到2点火焰伤害`,
						selectCard: [num, Infinity],
						position: "he",
						allowChooseAll: true,
						ai(card) {
							if (ui.selected.cards.length >= get.event().num) {
								return -1;
							}
							if (_status.event.player.hasSkillTag("nofire")) {
								return -1;
							}
							if (_status.event.res >= 0) {
								return 6 - get.value(card);
							}
							if (get.type(card) != "basic") {
								return 10 - get.value(card);
							}
							return 8 - get.value(card);
						},
					})
					.set("res", res)
					.set("num", num)
					.forResult();
				if (result?.bool && result.cards?.length) {
					num = result.cards.length + 1;
				} else {
					await target.damage({
						num: 2,
						nature: "fire",
					});
					num = 1;
				}
			}
		},
		ai: {
			order: 1,
			result: {
				player(player) {
					var num = 0,
						eff = 0,
						players = game
							.filterPlayer(function (current) {
								return current != player;
							})
							.sortBySeat(player);
					for (var target of players) {
						if (get.damageEffect(target, player, target, "fire") >= 0) {
							num = 0;
							continue;
						}
						var shao = false;
						num++;
						if (
							target.countCards("he", function (card) {
								if (get.type(card) != "basic") {
									return get.value(card) < 10;
								}
								return get.value(card) < 8;
							}) < num
						) {
							shao = true;
						}
						if (shao) {
							eff -= 4 * (get.realAttitude || get.attitude)(player, target);
							num = 0;
						} else {
							eff -= (num * (get.realAttitude || get.attitude)(player, target)) / 4;
						}
					}
					if (eff < 4) {
						return 0;
					}
					return eff;
				},
			},
		},
	},
	xinjuece: {
		audio: "juece",
		audioname: ["dc_liru", "ol_liru"],
		trigger: {
			player: "phaseJieshuBegin",
		},
		filter(event, player) {
			return game.hasPlayer(current => current.countCards("h") === 0);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("xinjuece"),
					prompt2: "对一名没有手牌的角色造成1点伤害",
					filterTarget(card, player, target) {
						return target.countCards("h") === 0;
					},
					ai(target) {
						const player = get.player();
						return get.damageEffect(target, player, player);
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.damage();
		},
	},
	xinmieji: {
		audio: "mieji",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h", { type: ["trick", "delay"], color: "black" });
		},
		filterCard(card) {
			return get.color(card) == "black" && get.type(card, "trick") == "trick";
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		discard: false,
		delay: false,
		check(card) {
			return 8 - get.value(card);
		},
		loseTo: "cardPile",
		insert: true,
		visible: true,
		async content(event, trigger, player) {
			const { target, cards } = event;
			await player.showCards(cards, `${get.translation(player)}对${get.translation(target)}发动了【${get.translation(event.name)}】`);
			const result = await target.chooseToDiscard("he", true).set("prompt", "灭计：请弃置一张锦囊牌，或依次弃置两张非锦囊牌。").forResult();
			if (
				(!result.cards || get.type(result.cards[0], "trick", result.cards[0].original == "h" ? target : false) != "trick") &&
				target.countCards("he", function (card) {
					return get.type(card, "trick") != "trick";
				})
			) {
				await target
					.chooseToDiscard("he", true, function (card) {
						return get.type(card, "trick") != "trick";
					})
					.set("prompt", "灭计：请弃置第二张非锦囊牌");
			}
		},
		ai: {
			order: 9,
			result: {
				target: -1,
			},
		},
	},
	qianju: {
		mod: {
			globalFrom(from, to, distance) {
				return distance - from.getDamagedHp();
			},
		},
	},
	reqianju: {
		mod: {
			globalFrom(from, to, distance) {
				return distance - Math.max(1, from.getDamagedHp());
			},
		},
	},
};
