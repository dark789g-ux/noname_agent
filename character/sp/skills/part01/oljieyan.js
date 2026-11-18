import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oljieyan" | "oljinghua" | "olshuiyue" | "olpingduan" | "olchishi" | "olweimian">} */
export const groupSkills = {
	//OL袁姬 —— by 刘巴
	oljieyan: {
		audio: 2,
		trigger: {
			global: ["equipAfter", "addJudgeAfter", "loseAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		getIndex(event, player) {
			return game.filterPlayer(current => event.getl(current)?.hs?.length === 2).sortBySeat();
		},
		filter: (event, player, name, target) => target?.isIn(),
		logTarget: (event, player, name, target) => target,
		check: (event, player, name, target) => [player, target].reduce((sum, i) => sum + get.effect(i, { name: "draw" }, player, player), 0) > 0,
		async content(event, trigger, player) {
			const [target] = event.targets;
			let gains = [];
			for (let i = 0; i < 2; i++) {
				const next = [player, target][i].draw(...[i === 0 ? "nodelay" : "bottom"]);
				const result = (await next.forResult()).cards;
				if (get.itemtype(result) == "cards") {
					gains.push([[player, target][i], result[0]]);
				}
			}
			await player
				.showCards(gains.map(i => i[1]).flat(), `${get.translation(player)}发动了【节言】`)
				.set("customButton", button => {
					const target = get.owner(button.link);
					if (target) {
						button.node.gaintag.innerHTML = target.getName();
					}
				})
				.set("delay_time", 3)
				.set("multipleShow", true);
			if (
				gains
					.map(i => i[1])
					.map(c => get.suit(c, false))
					.unique().length === gains.length
			) {
				player.popup("杯具");
				player.tempBanSkill("oljieyan");
			} else {
				player.popup("洗具");
			}
		},
	},
	oljinghua: {
		audio: 2,
		trigger: {
			global: "roundStart",
			player: "phaseBegin",
		},
		forced: true,
		filter: (event, player, name) => !(name === "phaseBegin" && !player.hasCard(c => c.hasGaintag("oljinghua"), "hej")),
		async content(event, trigger, player) {
			if (event.triggername === "roundStart") {
				const next = player.draw(2);
				next.gaintag = [event.name];
				await next;
			} else {
				let cards = player.getCards("hej").filter(c => c.hasGaintag(event.name));
				if (cards.length > 1) {
					const result = await player
						.chooseToMove("镜花：将牌按顺序置于牌堆底(右为底)", true)
						.set("list", [["牌堆底", cards]])
						.set("processAI", function (list) {
							const cards = list[0][1].slice(0);
							return [cards];
						})
						.forResult();
					if (!result.bool) {
						return;
					}
					cards = result.moved[0];
				}
				await player.lose(cards, ui.cardPile, false, "blank").set("log", false);
			}
		},
	},
	olshuiyue: {
		audio: 2,
		trigger: {
			global: "roundEnd",
			player: "phaseEnd",
		},
		forced: true,
		filter: (event, player, name) => !(name === "roundEnd" && !player.hasCard(c => c.hasGaintag("olshuiyue"), "hej")),
		async content(event, trigger, player) {
			if (event.triggername === "phaseEnd") {
				const next = player.draw(2);
				next.gaintag = [event.name];
				await next;
			} else {
				let cards = player.getCards("hej").filter(c => c.hasGaintag("olshuiyue"));
				if (cards.length > 1) {
					const result = await player
						.chooseToMove("水月：将牌按顺序置于牌堆顶(左为上)", true)
						.set("list", [["牌堆顶", cards]])
						.set("reverse", _status.currentPhase?.next && get.attitude(player, _status.currentPhase.next) > 0)
						.set("processAI", function (list) {
							const cards = list[0][1].slice(0);
							cards.sort(function (a, b) {
								return (_status.event.reverse ? 1 : -1) * (get.value(b) - get.value(a));
							});
							return [cards];
						})
						.forResult();
					if (!result.bool) {
						return;
					}
					cards = result.moved[0];
				}
				await player.lose(cards, ui.cardPile, false, "blank", "insert").set("log", false);
			}
		},
	},
	//OL轲比能
	olpingduan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		async content(event, trigger, player) {
			const target = event.targets[0],
				str = player != target ? `###${get.translation(player)}对你发动了【平端】###` : `###平端###`;
			const { bool: use } = await target
				.chooseToUse(function (card, player, event) {
					return get.type(card) == "basic" && lib.filter.cardEnabled.apply(this, arguments);
				}, str + `你可以使用一张基本牌，然后摸一张牌`)
				.set("addCount", false)
				.forResult();
			if (!use) {
				return;
			}
			await target.draw();
			if (!target.countCards("he", card => get.type2(card) == "trick" && player.canRecast(card, player))) {
				return;
			}
			const { cards } = await target
				.chooseCard(
					"he",
					(card, player) => {
						return get.type2(card) == "trick" && player.canRecast(card, player);
					},
					str + `你可以重铸一张锦囊牌，然后摸一张牌`
				)
				.set("ai", card => 11 - get.value(card))
				.forResult();
			if (!cards || !cards.length) {
				return;
			}
			await target.recast(cards);
			await target.draw();
			if (!target.countGainableCards(player, "e")) {
				return;
			}
			const result = await target
				.chooseToGive(str + `你可以交给${get.translation(player)}你装备区的一张牌，然后摸一张牌`, player, "e")
				.set("ai", card => {
					if (get.attitude(get.player(), get.event().target) > 0) {
						return get.value(card);
					}
					return 0;
				})
				.set("target", player)
				.forResult();
			if (!result.bool) {
				return;
			}
			await target.draw();
		},
		ai: {
			order: 6,
			result: {
				target(player, target) {
					return target.countCards("he") + 0.5;
				},
			},
		},
	},
	//OL孙茹
	//持室神将
	olchishi: {
		audio: 2,
		trigger: { global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"] },
		filter(event, player) {
			const target = _status.currentPhase;
			if (!target || !target.isIn()) {
				return false;
			}
			const evt = event.getl(target);
			return evt && ["h", "e", "j"].some(pos => (evt[pos + "s"] || []).length > 0 && !target.countCards(pos));
		},
		check(event, player) {
			return get.effect(_status.currentPhase, { name: "draw" }, player, player) > 0;
		},
		usable: 1,
		logTarget: () => _status.currentPhase,
		async content(event, trigger, player) {
			const target = _status.currentPhase;
			await target.draw(2);
			target.addTempSkill("olchishi_effect");
			target.addMark("olchishi_effect", 2, false);
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				markimage: "image/card/handcard.png",
				intro: { content: "手牌上限+#" },
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("olchishi_effect");
					},
				},
			},
		},
	},
	olweimian: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.hasEnabledSlot();
		},
		usable: 1,
		chooseButton: {
			dialog(event, player) {
				let dialog = ui.create.dialog("###" + get.translation("olweimian") + "###" + lib.translate.olweimian_info, "hidden");
				let equips = [];
				for (let i = 1; i < 6; i++) {
					if (!player.hasEnabledSlot(i)) {
						continue;
					}
					for (let j = 1; j <= player.countEnabledSlot(i); j++) {
						equips.push(["equip" + i, get.translation("equip" + i)]);
					}
				}
				if (equips.length > 0) {
					dialog.add([equips, "tdnodes"]);
				}
				return dialog;
			},
			check(button) {
				const player = get.event().player;
				if (player.countCards("e") <= 3 && _status.currentPhase === player && ((player.storage.counttrigger || {}).olchishi || 0) <= 0) {
					if (
						player
							.getCards("e")
							.slice()
							.map(i => get.subtype(i))
							.includes(button.link)
					) {
						return 10;
					}
				}
				if (
					ui.selected.buttons.length >=
					Math.max(
						...game.filterPlayer().map(target => {
							let max = 0;
							if (get.attitude(player, target) > 0 && (target == player || target.hasDisabledSlot())) {
								max++;
							}
							if (get.recoverEffect(target, player, player) > 0) {
								max++;
							}
							if (
								target.countCards("h") > 0 &&
								target
									.getCards("h", card => {
										return lib.filter.cardDiscardable(card, target);
									})
									.reduce((sum, card) => {
										return sum + get.value(card, target);
									}, 0) <=
									get.effect(target, { name: "draw" }, player, player) * 4
							) {
								max++;
							}
							return max;
						})
					)
				) {
					return 0;
				}
				return [2, 1, 4, 3, 5].indexOf(parseInt(button.link.slice("equip".length))) + 1;
			},
			select: [1, 3],
			backup(links, player) {
				return {
					audio: "olweimian",
					types: links.slice().sort((a, b) => parseInt(a.slice("equip".length)) - parseInt(b.slice("equip".length))),
					filterTarget(card, player, target) {
						return true;
					},
					async content(event, trigger, player) {
						const target = event.target,
							types = lib.skill.olweimian_backup.types;
						for (const t of types) {
							await player.disableEquip(t);
						}
						const num = Math.min(target.hasDisabledSlot() + target.isDamaged() + 1, types.length),
							selected = [];
						while (selected.length < num) {
							const result = await target
								.chooseButton([
									"慰勉：是否执行其中一项？",
									[
										[
											["equip", "恢复一个装备栏"],
											["recover", "回复1点体力"],
											["discard", "弃置所有手牌，然后摸四张牌"],
										],
										"textbutton",
									],
								])
								.set("forceAuto", true)
								.set("filterButton", button => {
									const player = get.event().player;
									if (get.event().selected.includes(button.link)) {
										return false;
									}
									switch (button.link) {
										case "equip":
											return player.hasDisabledSlot();
										case "recover":
											return player.isDamaged();
										case "discard":
											return true;
									}
								})
								.set("ai", button => {
									const player = get.event().player;
									switch (button.link) {
										case "equip":
											return 1;
										case "recover":
											return get.recoverEffect(player, player, player);
										case "discard":
											return (
												get.effect(player, { name: "draw" }, player, player) * 4 -
												player
													.getCards("h", card => {
														return lib.filter.cardDiscardable(card, player);
													})
													.reduce((sum, card) => {
														return sum + get.value(card, player);
													}, 0)
											);
									}
								})
								.set("selected", selected)
								.forResult();
							if (result.bool) {
								selected.addArray(result.links);
								if (result.links.includes("equip")) {
									await target.chooseToEnable();
								}
								if (result.links.includes("recover")) {
									await target.recover();
								}
								if (result.links.includes("discard")) {
									const cards = target.getDiscardableCards(target, "h");
									if (cards.length) {
										await target.discard(cards);
									}
									await target.draw(4);
								}
							} else {
								break;
							}
						}
					},
					ai1: () => 1,
					ai2(target) {
						game.log(target);
						let max = 0,
							player = get.player();
						if (get.attitude(player, target) > 0 && (target == player || target.hasDisabledSlot())) {
							max++;
						}
						if (get.recoverEffect(target, player, player) > 0) {
							max++;
						}
						if (
							target.countCards("h") > 0 &&
							target
								.getCards("h", card => {
									return lib.filter.cardDiscardable(card, target);
								})
								.reduce((sum, card) => {
									return sum + get.value(card, target);
								}, 0) <=
								get.effect(target, { name: "draw" }, player, player) * 4
						) {
							max++;
						}
						return max;
					},
				};
			},
			prompt(links, player) {
				const types = links.slice().sort((a, b) => parseInt(a.slice("equip".length)) - parseInt(b.slice("equip".length)));
				return "废除" + types.map(i => get.translation(i) + "栏").join("、") + "，令一名角色选择执行等量项";
			},
		},
		ai: {
			order: 7,
			result: { player: 1 },
		},
		subSkill: {
			backup: {},
		},
	},
};
