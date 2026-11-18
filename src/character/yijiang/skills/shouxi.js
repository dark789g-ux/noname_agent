import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "shouxi" | "huimin" | "fuzhu" | "wengua" | "wengua2" | "wengua3">} */
export const groupSkills = {
	shouxi: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		init(player) {
			player.storage.shouxi ??= [];
		},
		filter(event, player) {
			return event.card.name === "sha" && event.player.isIn();
		},
		async cost(event, trigger, player) {
			const cards = lib.inpile.filter(card => {
				if (player.storage.shouxi.includes(card)) {
					return false;
				}
				const type = get.type2(card);
				return type === "basic" || type === "trick";
			});
			if (cards.length === 0) {
				event.result = { bool: false };
				return;
			}

			const list = cards.map(card => [get.type(card), "", card]);
			const result = await player
				.chooseButton({
					createDialog: [get.prompt("shouxi", trigger.player), [list, "vcard"]],
					ai() {
						return Math.random();
					},
				})
				.forResult();

			event.result = {
				bool: result.bool,
				cost_data: {
					vcard: result.links,
					name: result.links?.[0]?.[2],
				},
			};
		},
		async content(event, trigger, player) {
			const { vcard, name } = event.cost_data;
			player.storage.shouxi.add(name);
			player.popup(name);
			game.log(player, "声明了", `#y${get.translation(name)}`);

			const result = await trigger.player
				.chooseToDiscard({
					filterCard(card) {
						return card.name === get.event().cardname;
					},
					ai(card) {
						return get.event().att < 0 ? 10 - get.value(card) : 0;
					},
				})
				.set("att", get.attitude(trigger.player, player))
				.set("cardname", name)
				.set("dialog", ["守玺：请弃置一张【" + get.translation(name) + "】，否则此【杀】对" + get.translation(player) + "无效", [vcard, "vcard"]])
				.forResult();

			if (result.bool) {
				await trigger.player.gainPlayerCard({ target: player });
			} else {
				trigger.excluded.push(player);
			}
		},
		ai: {
			effect: {
				target_use(card, player, target, current) {
					if (card.name == "sha" && get.attitude(player, target) < 0) {
						return 0.3;
					}
				},
			},
		},
	},
	huimin: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		check(event, player) {
			return (
				game.countPlayer(function (current) {
					if (current.countCards("h") < current.hp) {
						return get.sgn(get.attitude(player, current));
					}
				}) >= 0
			);
		},
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countCards("h") < current.hp;
			});
		},
		async content(event, trigger, player) {
			const list = game
				.filterPlayer(function (current) {
					return current.countCards("h") < current.hp;
				})
				.sortBySeat();
			await player.draw(list.length);
			const result = await player
				.chooseCardTarget({
					prompt: "惠民",
					prompt2: "选择要分配的牌和分牌起点",
					selectCard: Math.min(list.length, player.countCards("h")),
					forced: true,
					list: list,
					filterTarget(card, player, target) {
						return get.event().list.includes(target);
					},
					ai1(card) {
						return 6 - get.value(card);
					},
					ai2(target) {
						const { player, list } = get.event();
						const att = get.attitude(player, target),
							index = list.indexOf(target);
						if (att <= 0) {
							return att;
						}
						let prev = list[(index ? index : list.length) - 1];
						if (get.attitude(player, prev) < 0) {
							return att;
						}
						return 0;
					},
				})
				.forResult();
			if (!result?.bool || !result.cards?.length) {
				return;
			}
			const { cards, targets } = result;
			await player.showCards(cards).setContent(() => {});
			list.sortBySeat(targets[0]);
			player.line(list, "green");
			await player.lose(cards, ui.ordering);
			const dialog = ui.create.dialog("惠民", cards, true);
			_status.dieClose.push(dialog);
			dialog.videoId = lib.status.videoId++;
			game.addVideo("cardDialog", null, ["惠民", get.cardsInfo(cards), dialog.videoId]);
			game.broadcast(
				function (cards, id) {
					const dialog = ui.create.dialog("惠民", cards, true);
					_status.dieClose.push(dialog);
					dialog.videoId = id;
				},
				cards,
				dialog.videoId
			);
			await game.delay();
			while (list.length && cards.length) {
				const current = list.shift();
				const next = current.chooseButton(true, function (button) {
					return get.value(button.link, _status.event.player);
				});
				next.set("dialog", dialog.videoId);
				next.set("closeDialog", false);
				next.set("dialogdisplay", true);
				next.set("cardFilter", cards.slice(0));
				next.set("filterButton", function (button) {
					return _status.event.cardFilter.includes(button.link);
				});
				const result2 = await next.forResult();
				if (!result2.bool || !result2.links?.length) {
					continue;
				}
				await current.gain(result2.links, "gain2");
				cards.removeArray(result2.links);
				let capt = get.translation(current) + "选择了" + get.translation(result2.links);
				game.broadcastAll(
					function (card, id, name, capt) {
						const dialog = get.idDialog(id);
						if (dialog) {
							dialog.content.firstChild.innerHTML = capt;
							for (const button of dialog.buttons) {
								if (button.link == card) {
									game.createButtonCardsetion(name, button);
									break;
								}
							}
							game.addVideo("dialogCapt", null, [dialog.videoId, dialog.content.firstChild.innerHTML]);
						}
					},
					result2.links[0],
					dialog.videoId,
					current.getName(true),
					capt
				);
			}
			game.broadcastAll("closeDialog", dialog.videoId);
			game.broadcastAll(dialog => {
				_status.dieClose.remove(dialog);
			}, dialog);
			if (cards.length) {
				await game.cardsDiscard(cards);
			}
		},
	},
	fuzhu: {
		audio: 2,
		trigger: {
			global: "phaseJieshuBegin",
		},
		filter(event, player) {
			return event.player !== player && event.player.hasSex("male") && ui.cardPile.childElementCount <= player.hp * 10;
		},
		check(event, player) {
			return get.attitude(player, event.player) < 0 && get.effect(event.player, { name: "sha" }, player, player) > 0;
		},
		logTarget: "player",
		skillAnimation: true,
		animationColor: "wood",
		onWash() {
			_status.event.getParent("fuzhu").washed = true;
			return "remove";
		},
		async content(event, trigger, player) {
			event.washed = false;
			lib.onwash.push(lib.skill.fuzhu.onWash);
			let total = game.players.length + game.dead.length;
			while (true) {
				total--;
				const card = get.cardPile2(card => {
					return card.name == "sha" && player.canUse(card, trigger.player, false);
				});
				if (card) {
					await player.useCard({
						card,
						targets: [trigger.player],
						addCount: false,
					});
				}
				if (!(total > 0 && !event.washed && ui.cardPile.childElementCount <= player.hp * 10 && trigger.player.isIn())) {
					break;
				}
			}
			lib.onwash.remove(lib.skill.fuzhu.onWash);
			game.washCard();
		},
		ai: {
			threaten: 1.5,
		},
	},
	wengua: {
		global: "wengua2",
		audio: 2,
	},
	wengua2: {
		audio: "wengua",
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("he") && game.hasPlayer(current => current.hasSkill("wengua") && !current.hasSkill("wengua3"));
		},
		log: false,
		delay: false,
		filterCard: true,
		discard: false,
		lose: false,
		position: "he",
		prompt() {
			const player = get.player();

			const targets = game.filterPlayer(current => current.hasSkill("wengua") && !current.hasSkill("wengua3"));
			if (targets.length === 1 && targets[0] === player) {
				return "将一张牌置于牌堆顶或牌堆底";
			}

			let str = `将一张牌交给${get.translation(targets)}`;
			if (targets.length > 1) {
				str += "中的一人";
			}

			return str;
		},
		check(card) {
			if (card.name == "sha") {
				return 5;
			}
			return 8 - get.value(card);
		},
		async content(event, trigger, player) {
			const { cards } = event;
			const targets = game.filterPlayer(current => current.hasSkill("wengua") && !current.hasSkill("wengua3"));

			let target;
			if (targets.length === 1) {
				target = targets[0];
			} else {
				const result = await player
					.chooseTarget({
						prompt: "选择【问卦】的目标",
						filterTarget(card, player, target) {
							const event = get.event();
							return event.list.includes(target);
						},
						ai(target) {
							const player = get.player();
							return get.attitude(player, target);
						},
					})
					.set("list", targets)
					.set("chessForceAll", true)
					.forResult();

				if (!result.bool || !result.targets.length) {
					return;
				}

				target = result.targets[0];
			}

			delete _status.noclearcountdown;
			game.stopCountChoose();
			if (!target) {
				return;
			}

			player.logSkill("wengua", target);
			target.addTempSkill("wengua3", "phaseUseEnd");
			const card = cards[0];
			if (target !== player) {
				await player.give(cards, target);
			}

			if (!target.getCards("he").includes(card)) {
				return;
			}

			const result = await target
				.chooseControlList({
					prompt: "问卦",
					list: [`将${get.translation(card)}置于牌堆顶`, `将${get.translation(card)}置于牌堆底`],
					forced: target === player,
					ai() {
						const { player, target } = get.event();
						if (get.attitude(target, player) < 0) {
							return 2;
						}
						return 1;
					},
				})
				.set("target", target)
				.forResult();

			const index = result.index;
			if (index >= 2) {
				return;
			}

			const next = target.lose(card, ui.cardPile);
			if (index == 0) {
				next.insert_card = true;
			}

			game.broadcastAll(player => {
				const cardx = ui.create.card();
				cardx.classList.add("infohidden");
				cardx.classList.add("infoflip");
				player.$throw(cardx, 1000, "nobroadcast");
			}, target);

			await next;

			await game.delay();

			if (index == 1) {
				game.log(target, "将得到的牌置于牌堆底");
				if (ui.cardPile.childElementCount === 1 || player === target) {
					await player.draw();
				} else {
					await game.asyncDraw([player, target], null, null);
				}
			} else if (index == 0) {
				game.log(target, "将获得的牌置于牌堆顶");
				if (ui.cardPile.childElementCount === 1 || player === target) {
					await player.draw("bottom");
				} else {
					await game.asyncDraw([player, target], null, null, true);
				}
			}
		},
		ai: {
			order: 2,
			threaten: 1.5,
			result: {
				player(player, target) {
					var target = game.findPlayer(function (current) {
						return current.hasSkill("wengua");
					});
					if (target) {
						return get.attitude(player, target);
					}
				},
			},
		},
	},
	wengua3: { charlotte: true },
};
