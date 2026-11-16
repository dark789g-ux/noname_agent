import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcguangyong" | "dcjuchui" | "dcwuyan" | "dczhanyu">} */
export const groupSkills = {
	//威董卓
	dcguangyong: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.isFirstTarget;
		},
		forced: true,
		logTarget: "targets",
		async content(event, trigger, player) {
			if (trigger.targets.includes(player)) {
				if (player.maxHp < 8) {
					await player.gainMaxHp();
				}
			}
			if (trigger.targets.some(target => target !== player)) {
				if (player.maxHp > 1) {
					await player.loseMaxHp();
				}
				const targets = trigger.targets.filter(target => target !== player && target.hasGainableCards(player, "he"));
				if (!targets.length) {
					return;
				}
				const result =
					targets.length === 1
						? { bool: true, targets: targets }
						: await player
								.chooseTarget(
									true,
									(card, player, target) => {
										return get.event().targets?.includes(target);
									},
									"犷勇：请选择其中一名角色，获得其一张牌"
								)
								.set("ai", target => {
									const player = get.player();
									return get.effect(target, { name: "shunshou_copy2" }, player, player);
								})
								.set("targets", targets)
								.forResult();
				if (result?.targets?.length) {
					await player.gainPlayerCard(result.targets[0], "he", true);
				}
			}
		},
	},
	dcjuchui: {
		audio: 2,
		comboSkill: true,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (!event.targets?.length || get.type2(event.card) !== "trick") {
				return false;
			}
			const evt = get.info("dcjianying").getLastUsed(player, event);
			return evt && get.type(evt.card) === "equip" && !evt.dcjuchui;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return get.event().getTrigger().targets.includes(target);
				})
				.set("ai", target => {
					const player = get.player();
					if (target.maxHp <= player.maxHp) {
						return Math.max(get.effect(target, { name: "losehp" }, player, player), get.recoverEffect(target, player, player));
					}
					return get.effect(player, { name: "draw" }, player, player) + 1145141919810 - Math.sign(get.attitude(player, target)) * target.countCards("h");
				})
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.set(event.name, true);
			const [target] = event.targets;
			if (target.hasSex("male")) {
				player.chat("雄性人类！");
			}
			await game.delayx();
			if (target.maxHp <= player.maxHp) {
				const result = target.isDamaged()
					? await player
							.chooseControl("失去体力", "回复体力")
							.set("ai", () => {
								const {
									player,
									targets: [target],
								} = get.event().getParent();
								return get.effect(target, { name: "losehp" }, player, player) >= get.recoverEffect(target, player, player) ? 0 : 1;
							})
							.set("prompt", get.translation(event.name) + "：令" + get.translation(target) + "失去或回复1点体力")
							.forResult()
					: { index: 0 };
				if (result.index === 0) {
					player.chat("曼巴出去！");
				}
				await target[result.index === 0 ? "loseHp" : "recover"]();
			} else {
				const types = lib.inpile.map(name => get.type2(name)).unique();
				const choice =
					types.length > 1
						? (
								await player
									.chooseControl(types)
									.set("ai", () => {
										const {
											player,
											targets: [target],
										} = get.event().getParent();
										let controls = get.event().controls,
											att = Math.sign(get.attitude(player, target));
										return controls.sort((a, b) => att * (target.countCards("h", card => get.type2(card) === a) - target.countCards("h", card => get.type2(card) === b)))[0];
									})
									.set("prompt", get.translation(event.name) + "：选择获得类别的牌且" + get.translation(target) + "本回合不能使用此类别的牌")
									.forResult()
							).control
						: types[0];
				const card = get.cardPile2(card => get.type2(card) === choice);
				card ? await player.gain(card, "gain2") : player.chat("什么罐头我说？！");
				target.addTempSkill("dcjuchui_ban");
				target.markAuto("dcjuchui_ban", [choice]);
			}
		},
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				if (typeof card === "object") {
					const evt = get.info("dcjianying").getLastUsed(player);
					if ((!evt || get.type(evt.card) !== "equip") && get.type(card) === "equip") {
						return num + 10;
					}
					if (evt && get.type(evt.card) === "equip" && get.info(card).filterTarget) {
						return num + 10;
					}
				}
			},
		},
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
		},
		subSkill: {
			mark: {
				init(player, skill) {
					const evt = get.info("dcjianying").getLastUsed(player);
					if (evt && get.type(evt.card) === "equip" && !evt.dcjuchui) {
						player.addTip(skill, "据陲 可连击");
					}
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				charlotte: true,
				trigger: {
					player: ["useCard1"],
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (get.type(trigger.card) == "equip" && !trigger.dcjuchui) {
						player.addTip(event.name, "据陲 可连击");
					} else {
						player.removeTip(event.name);
					}
				},
			},
			ban: {
				charlotte: true,
				onremove: true,
				intro: { content: "不能使用$类别的牌" },
				mod: {
					cardEnabled(card, player) {
						if (player.getStorage("dcjuchui_ban").includes(get.type2(card))) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (player.getStorage("dcjuchui_ban").includes(get.type2(card))) {
							return false;
						}
					},
				},
			},
		},
	},
	//曹媛
	dcwuyan: {
		audio: 2,
		enable: "phaseUse",
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return game.hasPlayer(target => get.info("dcwuyan").filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			if (!ui.selected.targets.length) {
				if (!target.hasSex("male")) {
					return false;
				}
				return game.hasPlayer(current => current !== player && current !== target);
			}
			return ![player, ...ui.selected.targets].includes(target);
		},
		selectTarget: 2,
		targetprompt: ["发起者", "承担者"],
		complexTarget: true,
		async cost(event, trigger, player) {
			const info = get.info(event.skill);
			const next = player.chooseTarget(get.prompt2(event.skill));
			for (const item of ["filterTarget", "selectTarget", "targetprompt", "complexTarget"]) {
				next.set(item, info[item]);
			}
			next.set("ai", target => {
				const player = get.player();
				return get.effect(target, "dcwuyan", player, player);
			});
			event.result = await next.forResult();
		},
		line: false,
		delay: false,
		multitarget: true,
		async content(event, trigger, player) {
			const [source, target] = event.targets;
			player.line2(event.targets);
			await game.delayx();
			const result = await source
				.chooseToUse(
					function (card, player, event) {
						if (get.itemtype(card) != "card" || (get.position(card) != "h" && get.position(card) != "s")) {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					get.translation(event.name) + "：是否对" + get.translation(target) + "使用一张手牌？"
				)
				.set("filterTarget", function (card, player, target) {
					const source = get.event().sourcex;
					if (target !== source) {
						return false;
					}
					return lib.filter.targetEnabled.apply(this, arguments);
				})
				.set("ai1", card => {
					const player = get.player();
					if (get.tag(card, "damage") && player.hasValueTarget(card)) {
						return 10 + get.cacheOrder(card);
					}
					return get.cacheOrder(card);
				})
				.set("targetRequired", true)
				.set("complexTarget", true)
				.set("complexSelect", true)
				.set("sourcex", target)
				.set("addCount", false)
				.forResult();
			if (result?.bool) {
				await player.draw(2);
			}
			if (!result?.bool || !source.hasHistory("sourceDamage", evt => evt.getParent(4) === event)) {
				const result = await player
					.chooseBool("是否令" + get.translation(source) + "失去1点体力？")
					.set(
						"choice",
						(() => {
							return get.effect(source, { name: "losehp" }, player, player) > 0;
						})()
					)
					.forResult();
				if (result?.bool) {
					await source.loseHp();
				}
				player.tempBanSkill(event.name, ["phaseBefore", "phaseAfter", "phaseChange", ...lib.phaseName]);
			}
		},
		ai: {
			order: 10,
			result: {
				player(player, target) {
					if (!ui.selected.targets.length) {
						return Math.max(
							...game
								.filterPlayer(current => ![player, target].includes(current))
								.map(current => {
									let sum = 0,
										cards = target.getCards("h", card => target.canUse(card, current) && get.effect(current, card, target, target) > 0);
									if (cards.length) {
										cards.sort((a, b) => get.effect(current, b, target, target) - get.effect(current, a, target, target));
									}
									if (cards[0]) {
										sum += get.effect(current, cards[0], target, player);
									}
									if (!cards[0] || !get.tag(cards[0], "damage")) {
										if (get.effect(target, { name: "losehp" }, player, player) > 0) {
											sum += get.effect(target, { name: "losehp" }, player, player);
										}
										if (get.effect(player, { name: "draw" }, player, player) > 0) {
											sum += get.effect(player, { name: "draw" }, player, player) * 2;
										}
									}
									return sum;
								})
						);
					}
					const source = ui.selected.targets[0];
					let sum = 0,
						cards = source.getCards("h", card => source.canUse(card, target) && get.effect(target, card, source, source) > 0);
					if (cards.length) {
						cards.sort((a, b) => get.effect(target, b, source, source) - get.effect(target, a, source, source));
					}
					if (cards[0]) {
						sum += get.effect(target, cards[0], source, player);
					}
					if (!cards[0] || !get.tag(cards[0], "damage")) {
						if (get.effect(source, { name: "losehp" }, player, player) > 0) {
							sum += get.effect(source, { name: "losehp" }, player, player);
						}
						if (get.effect(player, { name: "draw" }, player, player) > 0) {
							sum += get.effect(player, { name: "draw" }, player, player) * 2;
						}
					}
					return sum;
				},
			},
		},
	},
	dczhanyu: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		filter(event, player) {
			return player.hasCards("h");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), "h")
				.set("ai", card => {
					const player = get.player(),
						suit = get.suit(card);
					return get.value(card) * (2 + lib.suit.indexOf(suit)) * game.countPlayer(target => (target === player ? 0 : Math.sign(-get.attitude(player, target))));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await player.showCards(event.cards, get.translation(player) + "发动了【" + get.translation(event.name) + "】");
			const targets = game.filterPlayer(target => target !== player);
			const list = [];
			if (targets.length) {
				player.line(targets);
				for (const target of targets.sortBySeat()) {
					const cards = target.getDiscardableCards(target, "h", card => get.suit(card) === get.suit(event.cards[0]));
					if (cards.length) {
						const card = cards.randomGet(1);
						await target.discard(card);
						list.add(card);
					}
				}
			}
			const cards = list.filterInD("d");
			if (!cards.length) {
				return;
			}
			const result = await player.chooseCardButton(cards, "占欲：你可以获得其中一张牌").forResult();
			if (result?.bool && result?.links?.length) {
				await player.gain(result.links, "gain2");
			}
		},
	},
};
