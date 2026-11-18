import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanchengqi" | "clanjieli">} */
export const groupSkills = {
	//族钟繇
	clanchengqi: {
		getUsed: player =>
			player
				.getHistory("useCard", evt => ["basic", "trick"].includes(get.type(evt.card, null, false)))
				.map(evt => get.name(evt.card))
				.toUniqued(),
		hiddenCard(player, name) {
			if (get.type(name) != "basic" && get.type(name) != "trick") {
				return false;
			}
			if (get.info("clanchengqi").getUsed(player).includes(name)) {
				return false;
			}
			return player.countCards("hs") > 1 && lib.inpile.includes(name);
		},
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			if (player.countCards("hs") < 2) {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2];
					if (get.type(name) != "basic" && get.type(name) != "trick") {
						return false;
					}
					return !(event.clanchengqi || []).includes(name);
				})
				.some(card => event.filterCard(get.autoViewAs({ name: card[2], nature: card[3] }, "unsure"), player, event));
		},
		onChooseToUse(event) {
			if (!game.online && !event.clanchengqi) {
				const player = event.player;
				event.set("clanchengqi", get.info("clanchengqi").getUsed(player));
			}
		},
		chooseButton: {
			dialog(event, player) {
				const list = get
					.inpileVCardList(info => {
						const name = info[2];
						if (get.type(name) != "basic" && get.type(name) != "trick") {
							return false;
						}
						return !(event.clanchengqi || []).includes(name);
					})
					.filter(card => event.filterCard(get.autoViewAs({ name: card[2], nature: card[3] }, "unsure"), player, event));
				return ui.create.dialog("承启", [list, "vcard"]);
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				return get.event().player.getUseValue({
					name: button.link[2],
					nature: button.link[3],
				});
			},
			backup(links, player) {
				return {
					audio: "clanchengqi",
					filterCard: true,
					complexCard: true,
					selectCard: [2, Infinity],
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					filterOk() {
						return (
							(ui.selected.cards || []).reduce((sum, card) => {
								return sum + get.cardNameLength(card);
							}, 0) >= get.cardNameLength(lib.skill.clanchengqi_backup.viewAs.name)
						);
					},
					ai1(card) {
						const player = get.event().player;
						const name = lib.skill.clanchengqi_backup.viewAs.name;
						if (ui.selected.cards.length > 1 || card.name == name) {
							return 0;
						}
						if (
							ui.selected.cards.length &&
							game.hasPlayer(target => {
								return get.effect(target, { name: "draw" }, player, player) > 0;
							})
						) {
							if (get.cardNameLength(name) <= get.cardNameLength(card) + get.cardNameLength(ui.selected.cards[0])) {
								return 10 / (get.value(card) || 0.5);
							}
						}
						return 1 / (get.value(card) || 0.5);
					},
					position: "hs",
					async precontent(event, trigger, player) {
						player.addTempSkill("clanchengqi_effect");
					},
				};
			},
			prompt(links, player) {
				return "将至少两张手牌当作" + get.translation(links[0][3] || "") + "【" + get.translation(links[0][2]) + "】使用";
			},
		},
		ai: {
			order(item, player) {
				if (player && get.event().type == "phase") {
					let list = get
						.inpileVCardList(info => {
							const name = info[2];
							if (get.type(name) != "basic" && get.type(name) != "trick") {
								return false;
							}
							return !get.info("clanchengqi").getUsed(player).includes(name);
						})
						.map(card => {
							return { name: card[2], nature: card[3] };
						})
						.filter(card => player.getUseValue(card, true, true) > 0);
					if (!list.length) {
						return 0;
					}
					list.sort((a, b) => (player.getUseValue(b, true, true) || 0) - (player.getUseValue(a, true, true) || 0));
					return get.order(list[0], player) * 0.99;
				}
				return 0.001;
			},
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				const name = tag == "respondSha" ? "sha" : "shan";
				return get.info("clanchengqi").hiddenCard(player, name);
			},
			result: {
				player(player) {
					if (_status.event?.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			backup: { audio: "clanchengqi" },
			effect: {
				charlotte: true,
				trigger: { player: "useCard" },
				filter(event, player) {
					return (
						event.skill == "clanchengqi_backup" &&
						get.cardNameLength(event.card) ==
							(event.cards || []).reduce((sum, card) => {
								return sum + get.cardNameLength(card);
							}, 0)
					);
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget("承启：是否令一名角色摸一张牌？")
						.set("ai", target => {
							const player = get.event().player;
							return get.effect(target, { name: "draw" }, player, player);
						})
						.forResult();
				},
				popup: false,
				async content(event, trigger, player) {
					player.line(event.targets);
					event.targets[0].draw();
				},
			},
		},
	},
	clanjieli: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return game.hasPlayer(target => {
				return target.countCards("h");
			});
		},
		async cost(event, trigger, player) {
			const num = player.getHistory("useCard").length > 0 ? Math.max(...player.getHistory("useCard").map(history => get.cardNameLength(history.card))) : 0;
			const str = num > 0 ? "并观看牌堆顶" + get.cnNumber(num) + "张牌，然后你可以交换其中任意张牌" : "";
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "观看一名角色的牌名字数最多的手牌" + str, (card, player, target) => {
					return target.countCards("h");
				})
				.set("ai", target => {
					const player = get.event().player;
					const num = Math.max(...target.getCards("h").map(card => get.cardNameLength(card)));
					return num + 0.0001 * get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const num = player.getHistory("useCard").length > 0 ? Math.max(...player.getHistory("useCard").map(history => get.cardNameLength(history.card))) : 0;
			const limit = Math.max(...target.getCards("h").map(card => get.cardNameLength(card)));
			const cards = target.getCards("h", card => get.cardNameLength(card) == limit);
			if (num > 0) {
				const topCards = get.cards(num);
				await game.cardsGotoOrdering(topCards);
				const result = await player
					.chooseToMove("诫厉：交换其中任意张牌")
					.set("list", [
						[get.translation(target) + "牌名字数最多的手牌", cards, "dcsushou_tag"],
						["牌堆顶", topCards],
					])
					.set("filterMove", (from, to) => {
						return typeof to != "number";
					})
					.set("selectionSpec", { move: "swap" })
					.set("filterOk", moved => {
						return moved[1].some(card => get.owner(card));
					})
					.set("processAI", list => {
						const num = Math.min(list[0][1].length, list[1][1].length);
						const player = get.event().player,
							target = get.event().getParent().targets[0];
						const sgn = get.sgn(get.sgn(get.attitude(player, target)) - 0.5);
						const cards1 = list[0][1].slice().sort((a, b) => get.value(a, "raw") * sgn - get.value(b, "raw") * sgn);
						const cards2 = list[1][1].slice().sort((a, b) => get.value(b, "raw") * sgn - get.value(a, "raw") * sgn);
						return [cards1.slice().addArray(cards2.slice(0, num)), cards2.slice().addArray(cards1.slice(0, num))];
					})
					.forResult();
				if (result.bool) {
					const lose = result.moved[1].slice();
					const gain = result.moved[0].slice().filter(i => !get.owner(i));
					if (lose.some(i => get.owner(i))) {
						await game.cardsGotoOrdering(lose.filter(i => get.owner(i)));
					}
					await game.cardsGotoPile(lose.reverse(), "insert");
					game.updateRoundNumber();
					if (gain.length) {
						await target.gain(gain, "draw");
					}
				} else {
					await game.cardsGotoPile(topCards.slice().reverse(), "insert");
					game.updateRoundNumber();
				}
			} else {
				const content = ['###诫厉###<div class="text center">' + get.translation(target) + "牌名字数最多的手牌</div>", cards];
				await player.chooseControl("ok").set("dialog", content);
			}
		},
	},
};
