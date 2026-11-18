import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jiufa" | "tianren" | "pingxiang">} */
export const groupSkills = {
	//神姜维
	jiufa: {
		getList(player, event, mark = true) {
			let list = [];
			const history = game.getAllGlobalHistory("everything", evt => ["jiufa", "useCard", "respond"].includes(evt.name) && evt.player == player, event);
			for (let i = history.length - 1; i >= 0; i--) {
				const evt = history[i];
				if (evt.name == "jiufa") {
					if (evt.jiufa_mark) {
						break;
					}
				}
				if (["useCard", "respond"].includes(evt.name)) {
					list.add(evt.card.name);
				}
			}
			if (list.length && mark) {
				player.markAuto("jiufa", list);
			}
			return list;
		},
		init(player, skill) {
			const list = get.info("jiufa").getList(player, null, false);
			if (list.length) {
				player.markAuto("jiufa", list);
			}
		},
		onremove: true,
		audio: 2,
		trigger: { player: ["useCard", "respond"] },
		frequent: true,
		filter(event, player) {
			return get.info("jiufa").getList(player, event).length >= 9;
		},
		async content(event, trigger, player) {
			player.setStorage("jiufa", [], true);
			event.set("jiufa_mark", true);
			const cards = get.cards(9);
			event.cards = cards;
			event.cards.sort((a, b) => get.number(b) - get.number(a));
			await game.cardsGotoOrdering(event.cards);
			event.videoId = lib.status.videoId++;
			game.broadcastAll(
				function (player, id, cards) {
					let str;
					if (player == game.me && !_status.auto) {
						str = "九伐：选择点数满足条件的牌各一张";
					} else {
						str = "九伐";
					}
					const dialog = ui.create.dialog(str, cards);
					dialog.videoId = id;
				},
				player,
				event.videoId,
				event.cards
			);
			event.time = get.utc();
			game.addVideo("showCards", player, ["九伐", get.cardsInfo(event.cards)]);
			game.addVideo("delay", null, 2);
			const num = [...cards.map(card => get.number(card)).reduce((map, number) => map.set(number, (map.get(number) || 0) + 1), new Map())].filter(([number, count]) => count > 1).length;
			const next = player.chooseButton(num, true);
			next.set("dialog", event.videoId);
			next.set("filterButton", button => {
				let num = get.number(button.link),
					cards = _status.event.getParent().cards;
				for (let buttonx of ui.selected.buttons) {
					if (get.number(buttonx.link) == num) {
						return false;
					}
				}
				for (let card of cards) {
					if (card != button.link && get.number(card) == num) {
						return true;
					}
				}
				return false;
			});
			next.set("ai", button => get.value(button.link, get.player()));
			const result = await next.forResult();
			const time = 1000 - (get.utc() - event.time);
			if (time > 0) {
				await game.delay(0, time);
			}
			game.broadcastAll("closeDialog", event.videoId);
			if (result?.links?.length) {
				await player.gain(result.links, "log", "gain2");
			}
		},
		marktext: "⑨",
		intro: {
			content: "已记录牌名：$",
			onunmark: true,
		},
	},
	tianren: {
		audio: 2,
		trigger: { global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter"] },
		forced: true,
		filter(event, player) {
			if (event.name.indexOf("lose") == 0) {
				if (event.getlx === false || event.position != ui.discardPile) {
					return false;
				}
			} else {
				const evt = event.getParent();
				if (evt?.relatedEvent?.name == "useCard") {
					return false;
				}
			}
			for (const card of event.cards) {
				let owner = false;
				if (event.hs && event.hs.includes(card)) {
					owner = event.player;
				}
				const type = get.type(card, null, owner);
				if (type == "basic" || type == "trick") {
					return true;
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			let num = 0;
			for (const card of trigger.cards) {
				let owner = false;
				if (trigger.hs && trigger.hs.includes(card)) {
					owner = trigger.player;
				}
				const type = get.type(card, null, owner);
				if (type == "basic" || type == "trick") {
					num++;
				}
			}
			player.addMark("tianren", num);
		},
		group: "tianren_maxHp",
		intro: { content: "mark" },
		subSkill: {
			maxHp: {
				audio: "tianren",
				trigger: { player: "addMark" },
				forced: true,
				filter(event, player) {
					if (event.markName !== "tianren") {
						return false;
					}
					return player.countMark("tianren") >= player.maxHp;
				},
				async content(event, trigger, player) {
					player.removeMark("tianren", player.maxHp);
					await player.gainMaxHp();
					await player.draw(2);
				},
			},
		},
	},
	pingxiang: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "ice",
		filter(event, player) {
			return player.maxHp > 9;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp(9);
			await player.removeSkills("jiufa");
			player.addSkill("pingxiang_effect");
			for (let i = 0; i < 9; i++) {
				const result = await player
					.chooseUseTarget(
						{
							name: "sha",
							nature: "fire",
							isCard: true,
						},
						"平襄：请选择火【杀】的目标（" + (i === 8 ? "⑨" : i + 1) + "/9）",
						false
					)
					.forResult();

				if (!result?.bool) {
					break;
				}
			}
		},
		ai: {
			order() {
				return get.order({
					name: "sha",
					nature: "fire",
					isCard: true,
				});
			},
			result: {
				player(player) {
					if (
						player.hasValueTarget({
							name: "sha",
							nature: "fire",
							isCard: true,
						})
					) {
						return 1;
					}
					return 0;
				},
			},
			combo: "tianren",
		},
		derivation: ["jiufa"],
		subSkill: {
			effect: {
				marktext: "襄",
				intro: { content: "手牌上限基数改为体力上限" },
				mod: {
					maxHandcardBase(player) {
						return player.maxHp;
					},
				},
			},
		},
	},
};
