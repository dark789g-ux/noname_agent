import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "y_dc_falu" | "y_dc_zhenyi" | "y_dc_dianhua">} */
export const groupSkills = {
	//mega张琪瑛Y
	y_dc_falu: {
		audio: "xinfu_falu",
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return event.getl(player).hs.length > 0;
		},
		intro: {
			content(storage, player) {
				if (storage) {
					return `当前记录花色：${storage.map(i => get.translation(i)).join("")}`;
				}
				return "未记录";
			},
		},
		async content(event, trigger, player) {
			const suits = trigger.getl(player).hs.map(i => get.suit(i, player));
			let list = player.getStorage(event.name).concat(suits);
			if (list.length > 3) {
				list = list.slice(-3);
			}
			player.setStorage(event.name, list, true);
			const tip = player
				.getStorage(event.name)
				.map(i => get.translation(i))
				.join("");
			player.addTip(event.name, `法箓${tip}`);
			if (list.length < 3) {
				return;
			}
			if (list.toUniqued().length == 1) {
				const suit = list[0];
				player.setStorage(event.name, [], true);
				player.removeTip(event.name);
				const next = game.createEvent("removeFaluRecord", false);
				next.player = player;
				next.type = "same";
				next.suit = suit;
				next.setContent("emptyEvent");
				await next;
				const cards = [];
				while (true) {
					const card = get.cardPile2(card => {
						return cards.every(cardx => get.suit(cardx) != get.suit(card)) && get.suit(card) != suit;
					});
					if (card) {
						cards.add(card);
					} else {
						break;
					}
				}
				if (cards?.length) {
					await player.gain(cards, "gain2");
				}
			}
			if (list.toUniqued().length == 3) {
				player.setStorage(event.name, [], true);
				player.removeTip(event.name);
				const next = game.createEvent("removeFaluRecord", false);
				next.player = player;
				next.type = "diff";
				next.setContent("emptyEvent");
				await next;
				const result = await player
					.chooseButtonTarget({
						createDialog: [
							"法箓：是否令一名角色失去或回复1点体力？",
							[
								[
									["loseHp", "失去1点体力"],
									["recover", "回复1点体力"],
								],
								"tdnodes",
							],
						],
						filterTarget(card, player, target) {
							const buttons = ui.selected.buttons;
							if (!buttons?.length) {
								return false;
							}
							return buttons[0].link == "loseHp" || target.isDamaged();
						},
						ai1(button) {
							const player = get.player();
							let eff1 = 0,
								eff2 = 0;
							game.filterPlayer(current => {
								const losehp = get.effect(current, { name: "losehp" }, current, player);
								if (losehp > eff1) {
									eff1 = losehp;
								}
								const recover = get.recoverEffect(current, player, player);
								if (recover > eff2) {
									eff2 = recover;
								}
							});
							if (eff1 > eff2 && eff1 > 0) {
								return button.link == "loseHp" ? 1 : 0;
							}
							if (eff1 < eff2 && eff2 > 0) {
								return button.link == "loseHp" ? 0 : 1;
							}
							return 0;
						},
						ai2(target) {
							const player = get.player(),
								buttons = ui.selected.buttons;
							if (!buttons?.length) {
								return false;
							}
							if (buttons[0].link == "loseHp") {
								return get.effect(target, { name: "losehp" }, target, player);
							}
							return get.recoverEffect(target, player, player);
						},
					})
					.forResult();
				if (!result?.bool) {
					return;
				}
				const [target] = result.targets,
					[link] = result.links;
				player.line(target, "green");
				await target[link](1, player);
			}
		},
		onremove(player, skill) {
			player.removeTip(skill);
			delete player.storage[skill];
		},
	},
	y_dc_zhenyi: {
		audio: "xinfu_zhenyi",
		trigger: { player: ["removeFaluRecord", "useCard"] },
		filter(event, player) {
			if (event.name == "useCard") {
				return player.getStorage("y_dc_zhenyi_record").includes(get.suit(event.card));
			}
			if (event.type == "diff") {
				return player.countMark("y_dc_zhenyi") < 4;
			}
			return !player.getStorage("y_dc_zhenyi_record").includes(event.suit);
		},
		intro: {
			mark(dialog, storage, player) {
				const list = player.getStorage("y_dc_zhenyi_record");
				if (list?.length) {
					dialog.addText(`使用${list.map(i => get.translation(i)).join("")}牌无距离限制且不可被响应`);
				}
				if (storage) {
					dialog.addText(`发动〖点化〗观看牌数+${storage}`);
				}
				if (!list?.length && !storage) {
					dialog.addText("未发动过〖真仪〗");
				}
			},
			markcount: (storage, player) => `${player.getStorage("y_dc_zhenyi_record").length}/${(storage || 0).toString()}`,
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.name == "useCard") {
				trigger.directHit.addArray(game.players);
			} else {
				if (trigger.type == "diff") {
					player.addMark(event.name, 1, false);
					player.addTip("y_dc_dianhua", "点化+" + player.countMark(event.name));
				} else {
					player.markAuto("y_dc_zhenyi_record", trigger.suit);
					player.storage["y_dc_zhenyi_record"].sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
					player.markSkill(event.name);
					player.addTip(event.name, "真仪" + player.storage["y_dc_zhenyi_record"].map(i => get.translation(i)).join(""));
				}
			}
		},
		ai: { combo: "y_dc_falu" },
		mod: {
			targetInRange(card, player) {
				if (player.getStorage("y_dc_zhenyi_record").includes(get.suit(card))) {
					return true;
				}
			},
		},
		onremove(player, skill) {
			player.removeTip(skill);
			player.removeTip("y_dc_dianhua");
			delete player.storage[skill];
			delete player.storage[skill + "_record"];
		},
	},
	y_dc_dianhua: {
		audio: "xinfu_dianhua",
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		frequent: true,
		async content(event, trigger, player) {
			const cards = get.cards(1 + player.countMark("y_dc_zhenyi"), true);
			await game.cardsGotoOrdering(cards);
			const result = await player
				.chooseToMove(true)
				.set("list", [["牌堆顶", cards], ["获得"]])
				.set("prompt", "点化：获得一张牌，将其余牌以任意顺序放回牌堆顶")
				.set("filterOk", moved => {
					return moved[1].length == 1;
				})
				.set("filterMove", (from, to, moved) => {
					if (moved[0].includes(from.link)) {
						if (typeof to == "number") {
							return to == 0 || !moved[1].length;
						}
						return true;
					}
					if (typeof to == "number") {
						return to == 0;
					}
					return true;
				})
				.set("processAI", list => {
					const { player } = get.event();
					const cards = list[0][1].slice(0);
					if (cards?.length) {
						const card = cards.maxBy(card => get.value(card, player));
						return [cards.remove(card), [card]];
					}
					return [cards, []];
				})
				.forResult();
			if (result.bool && result.moved) {
				const top = result.moved[0].reverse(),
					gains = result.moved[1];
				if (top?.length) {
					await game.cardsGotoPile(top, "insert");
				}
				if (gains?.length) {
					await player.gain(gains, "gain2");
				}
			}
		},
	},
};
