import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsblieji" | "dcsbquzhou" | "dcsbyaozuo" | "dcsbzhuanwen">} */
export const groupSkills = {
	//谋黄盖
	//时代的♿otto♿
	dcsblieji: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			return get.type2(event.card) === "trick" && player.hasCard(card => get.is.damageCard(card), "h");
		},
		frequent: true,
		async content(event, trigger, player) {
			const skill = "dcsblieji_effect";
			player.addTempSkill(skill);
			const cards = player.getCards("h", card => get.is.damageCard(card));
			for (const card of cards) {
				let tag = card.gaintag?.find(tag => tag.startsWith(skill));
				if (tag) {
					player.removeGaintag(tag, [card]);
				}
				tag = tag ? skill + parseFloat(parseInt(tag.slice(skill.length)) + 1) : "dcsblieji_effect1";
				game.addTempTag(tag, `烈计+${tag.slice(skill.length)}`);
				player.addGaintag([card], tag);
			}
		},
		subSkill: {
			effect: {
				audio: "dcsblieji",
				charlotte: true,
				onremove(player, skill) {
					let tags = player.getCards("h", card => card.gaintag?.some(tag => tag.startsWith(skill)));
					if (tags.length) {
						tags = tags
							.slice()
							.map(card => card.gaintag.find(tag => tag.startsWith(skill)))
							.unique();
						tags.forEach(tag => player.removeGaintag(tag));
					}
				},
				trigger: { player: "useCard" },
				filter(event, player) {
					if (!event.card) {
						return false;
					}
					return player.hasHistory(
						"lose",
						evtx =>
							evtx.getParent() === event &&
							Object.keys(evtx.gaintag_map).some(i => {
								return evtx.gaintag_map[i].some(tag => tag.startsWith("dcsblieji_effect"));
							})
					);
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					const skill = event.name,
						evt = trigger;
					const evtx = player.getHistory(
						"lose",
						evtx =>
							evtx.getParent() === evt &&
							Object.keys(evtx.gaintag_map).some(i => {
								return evtx.gaintag_map[i].some(tag => tag.startsWith(skill));
							})
					)[0];
					trigger.baseDamage += Object.keys(evtx.gaintag_map).reduce((sum, i) => {
						const tag = evtx.gaintag_map[i].find(tag => tag.startsWith(skill));
						if (tag) {
							sum += parseInt(tag.slice(skill.length));
						}
						return sum;
					}, 0);
				},
			},
		},
	},
	dcsbquzhou: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		async content(event, trigger, player) {
			let cards = [];
			while (true) {
				const card = get.cards()[0];
				await game.cardsGotoOrdering(card);
				const judgestr = get.translation(player) + "亮出的第" + get.cnNumber(cards.length + 1, true) + "张【趋舟】牌",
					videoId = lib.status.videoId++;
				game.addVideo("judge1", player, [get.cardInfo(card), judgestr, event.videoId]);
				game.broadcastAll(
					(player, card, str, id, cardid) => {
						let event;
						if (game.online) {
							event = {};
						} else {
							event = _status.event;
						}
						if (game.chess) {
							event.node = card.copy("thrown", "center", ui.arena).addTempClass("start");
						} else {
							event.node = player.$throwordered(card.copy(), true);
						}
						if (lib.cardOL) {
							lib.cardOL[cardid] = event.node;
						}
						event.node.cardid = cardid;
						event.node.classList.add("thrownhighlight");
						ui.arena.classList.add("thrownhighlight");
						event.dialog = ui.create.dialog(str);
						event.dialog.classList.add("center");
						event.dialog.videoId = id;
					},
					player,
					card,
					judgestr,
					videoId,
					get.id()
				);
				game.log(player, "亮出了牌堆顶的", card);
				await game.delay(2);
				game.broadcastAll(id => {
					const dialog = get.idDialog(id);
					if (dialog) {
						dialog.close();
					}
					ui.arena.classList.remove("thrownhighlight");
				}, videoId);
				game.addVideo("judge2", null, videoId);
				if (card.name === "sha") {
					if (cards.length) {
						game.broadcastAll(() => ui.clear());
						await game.cardsDiscard(cards);
					}
					if (player.hasUseTarget(card)) {
						await player.chooseUseTarget(card, true, false);
					}
					break;
				} else {
					cards.add(card);
					let result;
					if (cards.length < game.countPlayer()) {
						result = await player.chooseBool("是否继续亮出牌堆顶的牌？").forResult();
					} else {
						result = { bool: false };
					}
					if (!result.bool) {
						game.broadcastAll(() => ui.clear());
						await player.gain(cards, "gain2");
						break;
					}
				}
			}
		},
		ai: {
			order: 1,
			result: { player: 1 },
		},
	},
	//谋陈琳
	dcsbyaozuo: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		filterTarget: lib.filter.notMe,
		selectTarget: -1,
		multiline: true,
		multitarget: true,
		manualConfirm: true,
		chooseCard(current, boss) {
			const next = current.chooseCard("he");
			next.set("prompt", "是否交给" + get.translation(boss) + "一张牌？");
			next.set("_global_waiting", true);
			next.set("ai", card => {
				if (get.event().att > 0) {
					return 6 - get.value(card);
				}
				return 1 - get.value(card);
			});
			next.set("att", get.attitude(current, boss));
			return next;
		},
		async content(event, trigger, player) {
			const targets = event.targets;
			const gains = [];
			const map = await game.chooseAnyOL(targets, get.info(event.name).chooseCard, [player]).forResult();
			for (const target of targets) {
				const result = map.get(target);
				if (result.bool) {
					target.popup("交给", "wood");
					gains.addArray(result.cards);
				} else {
					target.popup("拒绝", "fire");
					player.addTempSkill("dcsbyaozuo_effect");
					player.markAuto("dcsbyaozuo_effect", [target]);
				}
			}
			await game.delay();
			if (!gains.length) {
				return;
			} else {
				player.addSkill(event.name + "_tag");
				await player.gain({ cards: gains, animate: "give", gaintag: ["dcsbyaozuo_tag"] });
			}
			const first = Array.from(map.keys()).find(current => map.get(current)?.bool);
			if (first && first.isIn()) {
				game.log(first, "第一个写出了文章");
				await game.delay();
				if (!game.hasPlayer(current => ![first, player].includes(current))) {
					return;
				}
				const result = await first
					.chooseTarget(`令${get.translation(player)}对一名其他角色发动〖撰文〗`, true, function (card, player, target) {
						return !get.event().targets?.includes(target);
					})
					.set("targets", [first, player])
					.set("ai", target => {
						const player = get.player(),
							hs = target.countCards("h");
						if (get.attitude(player, target) <= 0 && target.hp <= Math.floor(target.maxHp)) {
							return hs * 2;
						}
						return hs;
					})
					.forResult();
				if (result?.bool) {
					first.line(result.targets, "green");
					await player.useSkill("dcsbzhuanwen", null, result.targets);
				}
			}
		},
		ai: {
			order: 9,
			result: { player: 1 },
		},
		derivation: "dcsbzhuanwen",
		subSkill: {
			tag: {
				charlotte: true,
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("dcsbyaozuo_tag")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && card.hasGaintag("dcsbyaozuo_tag")) {
							return false;
						}
					},
					aiOrder(player, card, num) {
						if (get.itemtype(card) == "card" && card.hasGaintag("dcsbyaozuo_tag")) {
							return num - 0.1;
						}
					},
				},
			},
			effect: {
				audio: "dcsbyaozuo",
				onremove: true,
				charlotte: true,
				mark: true,
				intro: { content: "本回合下次对$造成的伤害+1" },
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return player.getStorage("dcsbyaozuo_effect").includes(event.player);
				},
				logTarget: "player",
				forced: true,
				async content(event, trigger, player) {
					trigger.num++;
					player.unmarkAuto(event.name, [trigger.player]);
				},
			},
			ai: {
				effect: {
					player(card, player, target) {
						if (get.is.damageCard(card) && player.hasStorage("dcsbyaozuo_effect", target)) {
							return 1.5;
						}
					},
				},
			},
		},
	},
	dcsbzhuanwen: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.hasCards("h");
		},
		async content(event, trigger, player) {
			const next = game.cardsGotoOrdering(get.cards(Math.min(5, player.countCards("h"))));
			await next;
			let cards = next.cards;
			await player.showCards(cards, get.translation(player) + "发动了〖撰文〗");
			let result;
			result = !event.targets?.length ? await player
				.chooseTarget({
					prompt: get.prompt2(event.name),
					ai(target) {
						const { player, cards } = get.event(),
							damages = cards.filter(card => get.is.damageCard(card) && player.canUse(card, target, false)),
							nodamages = cards.filter(card => !get.is.damageCard(card));
						if (damages.length > 1) {
							return -get.attitude(player, target);
						}
						return get.attitude(player, target);
					},
				})
				.set("cards", cards)
				.forResult() : { bool: true, targets: event.targets };
			if (result?.bool && result.targets?.length) {
				const target = result.targets[0];
				let damages = cards.filter(card => get.is.damageCard(card) && player.canUse(card, target, false)),
					nodamages = cards.filter(card => !get.is.damageCard(card));
				const list = [`依次对${get.translation(target)}使用${damages.length ? get.translation(damages) : "空气"}`, `令${get.translation(target)}获得${nodamages.length ? get.translation(nodamages) : "空气"}`];
				result = await player
					.chooseControl("使用伤害牌", "获得非伤害牌")
					.set("choiceList", list)
					.set("prompt", "撰文：请选择一项")
					.set(
						"effect",
						(function () {
							let eff = 0;
							for (let card of damages) {
								eff += get.effect(target, card, player, player);
							}
							for (let card of nodamages) {
								eff -= get.value(card, target) * get.attitude(player, target);
							}
							return eff;
						})()
					)
					.set("ai", (event, player) => {
						if (get.event().effect > 0 || player.hasStorage("dcsbyaozuo_effect", event.targets[0])) {
							return "使用伤害牌";
						}
						return "获得非伤害牌";
					})
					.forResult();
				if (result?.control == "使用伤害牌") {
					while (damages.length) {
						const card = damages[0];
						if (player.canUse(card, target, false)) {
							await player.useCard(card, target, false);
						}
						cards.remove(card);
						damages = damages.filter(cardx => card != cardx && player.canUse(cardx, target, false));
					}
				} else {
					cards.removeArray(nodamages);
					if (nodamages.length) {
						await target.gain({ cards: nodamages, animate: "gain2" });
					}
				}
			}
			await game.cardsGotoPile(cards.reverse(), "insert");
		},
	},
};
