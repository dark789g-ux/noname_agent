import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanjiewu" | "clangaoshi">} */
export const groupSkills = {
	//族杨修 —— by 刘巴
	clanjiewu: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名角色的手牌在本阶段对你可见")
				.set("ai", target => {
					let items = target.getCards("h");
					let count = [...new Set(items.map(item => get.suit(item, target)))].length;
					const player = get.player();
					return (get.effect(target, { name: "draw" }, target, player) * items) / (count + 1);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.markAuto(event.name + "_effect", target);
			player.addSkill(event.name + "_effect");
			target.addSkill(event.name + "_view");
			const func = target => target.markSkill("clanjiewu_view", null, null, true);
			event.isMine() ? func(target) : player.isOnline2() && player.send(func, target);
			player
				.when({ global: "phaseUseAfter" })
				.filter(evt => evt === trigger)
				.step(async () => player.removeSkill("clanjiewu_effect"));
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					if (player.storage[skill]) {
						Array.isArray(player.storage[skill]) && player.storage[skill].forEach(i => i.removeSkill("clanjiewu_view"));
						delete player.storage[skill];
					}
				},
				audio: "clanjiewu",
				trigger: { player: "useCardToPlayered" },
				filter: (event, player) => event.isFirstTarget && event.targets.some(target => target != player),
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(get.prompt(event.skill), "选择一名「捷悟」角色展示其一张手牌")
						.set("filterTarget", (card, player, target) => target.hasCard(true, "h") && player.getStorage("clanjiewu_effect").includes(target))
						.set("ai", target => {
							let items = target.getCards("h");
							let count = [...new Set(items.map(item => get.suit(item, target)))].length;
							const player = get.player();
							return (4 - count) * get.effect(target, { name: "draw" }, target, player);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					let cards;
					if (target === player) {
						cards = (await player.chooseCard("h", true, `捷悟：展示你的一张手牌`).forResult()).cards;
					} else {
						cards = (await player.choosePlayerCard(target, true, "h", `捷悟：展示${get.translation(target)}的一张手牌`).forResult()).cards;
					}
					if (!cards?.length) {
						return;
					}
					const card = cards[0];
					await player.showCards(card, `${get.translation(player)}对${get.translation(target)}发动了【捷悟】`).set("clanjiewu", true);
					if (get.suit(trigger.card, player) === get.suit(card, target)) {
						await player.draw();
					}
					if (
						game.getGlobalHistory("everything", evt => {
							return evt.name === "showCards" && evt.cards.length && evt.cards.some(c => c === card) && evt?.clanjiewu;
						}).length > 1
					) {
						let cardsx;
						if (target.countCards("h") !== player.countCards("h")) {
							const putee = player.countCards("h") > target.countCards("h") ? player : target;
							if (!putee.countCards("he")) {
								return;
							}
							if (player !== putee) {
								cardsx = (await player.choosePlayerCard(putee, true, "he", "捷悟：将" + get.translation(putee) + "的一张牌置于牌堆顶").forResult()).cards;
							} else {
								cardsx = (await player.chooseCard("he", true, "捷悟：将你的一张牌置于牌堆顶").forResult()).cards;
							}
							const card = cardsx[0];
							putee.$throw(get.position(card) == "h" ? 1 : card, 1000);
							game.log(player, "将", putee === player ? "" : get.translation(putee) + "的", get.position(card) == "h" ? "一张牌" : card, "置于牌堆顶");
							await putee.lose(card, ui.cardPile, "insert");
						}
					}
				},
				ai: {
					viewHandcard: true,
					skillTagFilter(player, tag, arg) {
						if (!player.getStorage("clanjiewu_effect").includes(arg)) {
							return false;
						}
					},
				},
			},
			view: {
				charlotte: true,
				intro: {
					markcount: (content, player) => player.countCards("h").toString(),
					mark(dialog, content, player) {
						const hs = player.getCards("h");
						hs.length > 0 ? dialog.addSmall(hs) : dialog.addText("没有手牌");
					},
				},
			},
		},
	},
	clangaoshi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		filter: (event, player) => player.hasHistory("useSkill", evt => ["clanjiewu", "clanjiewu_effect"].includes(evt.skill)),
		prompt(event, player) {
			return get.prompt("clangaoshi") + "（可亮出" + get.cnNumber(player.getHistory("useSkill", evt => ["clanjiewu", "clanjiewu_effect"].includes(evt.skill)).length) + "张牌）";
		},
		async content(event, trigger, player) {
			const num = player.getHistory("useSkill", evt => {
				return ["clanjiewu", "clanjiewu_effect"].includes(evt.skill);
			}).length;
			const names = player.getHistory("useCard").map(evt => evt.card.name),
				cards = [];
			event.forceDie = true;
			event.includeOut = true;
			while (cards.length < num) {
				//周群亮出的写法
				const judgestr = get.translation(player) + "展示的第" + get.cnNumber(cards.length + 1, true) + "张【高视】牌";
				event.videoId = lib.status.videoId++;
				const card = get.cards()[0];
				cards.add(card);
				await game.cardsGotoOrdering(card);
				game.addVideo("judge1", player, [get.cardInfo(card), judgestr, event.videoId]);
				game.broadcastAll(
					function (player, card, str, id, cardid) {
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
					event.videoId,
					get.id()
				);
				game.log(player, "展示了牌堆顶的", card);
				await game.delay(2);
				game.broadcastAll(function (id) {
					var dialog = get.idDialog(id);
					if (dialog) {
						dialog.close();
					}
					ui.arena.classList.remove("thrownhighlight");
				}, event.videoId);
				game.addVideo("judge2", null, event.videoId);
				if (names.includes(card.name)) {
					break;
				}
			}
			game.broadcastAll(function () {
				ui.clear();
			});
			if (!cards.length) {
				return;
			}
			while (cards.some(card => player.hasUseTarget(card))) {
				const { links } = await player
					.chooseButton([`高视：是否使用其中一张牌？`, cards])
					.set("filterButton", button => {
						const player = get.player(),
							card = button.link;
						return player.hasUseTarget(card);
					})
					.set("ai", button => {
						return get.player().getUseValue(button.link);
					})
					.forResult();
				if (!links?.length) {
					break;
				}
				cards.remove(links[0]);
				player.$gain2(links[0], false);
				await player.chooseUseTarget(links[0], true, false);
			}
			if (!cards.length) {
				await player.draw(2);
			}
		},
		ai: {
			combo: "clanjiewu",
		},
	},
};
