import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsanshi" | "dczhenrao" | "dcchenlve" | "dcjichou" | "dcmouli" | "dczifu">} */
export const groupSkills = {
	//司马师
	dcsanshi: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		group: ["dcsanshi_gain", "dcsanshi_directHit"],
		async content(event, trigger, player) {
			const recordedNumbers = [];
			let num = get.rand(0, ui.cardPile.childNodes.length - 1);
			for (let i = 0; i < ui.cardPile.childNodes.length; i++) {
				let j = i + num;
				if (j >= ui.cardPile.childNodes.length) {
					j -= ui.cardPile.childNodes.length;
				}
				const card = ui.cardPile.childNodes[j],
					number = get.number(card, false);
				if (!recordedNumbers.includes(number)) {
					recordedNumbers.add(number);
					card.storage.dcsanshi = true;
					num = get.rand(0, ui.cardPile.childNodes.length - 1);
				}
			}
			player.addSkill("dcsanshi_mark");
		},
		subSkill: {
			gain: {
				audio: "dcsanshi",
				trigger: { global: "phaseEnd" },
				filter(event, player) {
					return game.hasGlobalHistory("cardMove", evt => {
						if (evt.name == "lose") {
							if (evt.position !== ui.discardPile) {
								return false;
							}
						} else if (evt.name !== "cardsDiscard") {
							return false;
						}
						if (lib.skill.dcsanshi_gain.notUseOrRespond(evt, player)) {
							return evt.cards.some(card => {
								return card.storage.dcsanshi && get.position(card) === "d";
							});
						}
						return false;
					});
				},
				forced: true,
				notUseOrRespond(event, player) {
					if (event.name !== "cardsDiscard") {
						return true;
					}
					const evtx = event.getParent();
					if (evtx.name !== "orderingDiscard") {
						return true;
					}
					const evt2 = evtx.relatedEvent || evtx.getParent();
					return !["useCard", "respond"].includes(evt2.name) || evt2.player !== player;
				},
				async content(event, trigger, player) {
					const cards = [];
					game.checkGlobalHistory("cardMove", evt => {
						if (evt.name == "lose") {
							if (evt.position !== ui.discardPile) {
								return false;
							}
						} else if (evt.name !== "cardsDiscard") {
							return false;
						}
						if (lib.skill.dcsanshi_gain.notUseOrRespond(evt, player)) {
							cards.addArray(
								evt.cards.filter(card => {
									return card.storage.dcsanshi && get.position(card) === "d";
								})
							);
						}
					});
					if (cards.length) {
						player.gain(cards, "gain2");
					}
				},
			},
			directHit: {
				audio: "dcsanshi",
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					return (
						event.cards &&
						event.cards.some(card => {
							return card.storage.dcsanshi;
						})
					);
				},
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.filterPlayer());
					game.log(trigger.card, "不可被响应");
				},
			},
			mark: {
				trigger: {
					player: "gainEnd",
					global: "loseAsyncEnd",
				},
				forced: true,
				popup: false,
				silent: true,
				lastDo: true,
				filter(event, player) {
					if (!["dcsanshi", "dcchenlve"].every(skill => player.hasSkill(skill, null, false, false))) {
						return false;
					}
					const cards = event.getg(player);
					if (!cards.length) {
						return false;
					}
					return cards.some(card => card.storage.dcsanshi);
				},
				async content(event, trigger, player) {
					var cards = trigger.getg(player);
					if (cards.length) {
						cards = cards.filter(card => card.storage.dcsanshi);
						player.addGaintag(cards, "dcsanshi_tag");
					}
				},
			},
		},
		ai: {
			threaten: 3,
		},
	},
	dczhenrao: {
		audio: 2,
		trigger: { global: "useCardToPlayered" },
		filter(event, player) {
			if (
				(() => {
					if (event.player === player) {
						if (!event.isFirstTarget) {
							return false;
						}
						return event.targets.some(target => target !== player);
					}
					return event.target === player;
				})()
			) {
				return event.targets.concat(event.player).some(target => {
					return target.countCards("h") > player.countCards("h") && !player.getStorage("dczhenrao").includes(target);
				});
			}
			return false;
		},
		direct: true,
		async content(event, trigger, player) {
			const result = await player
				.chooseTarget(get.prompt("dczhenrao"), "对一名可选角色造成1点伤害", (card, player, target) => {
					return get.event().targets.includes(target) && !player.getStorage("dczhenrao").includes(target);
				})
				.set(
					"targets",
					trigger.targets.concat(trigger.player).filter(target => target.countCards("h") > player.countCards("h"))
				)
				.set("ai", target => {
					const player = get.player();
					return get.damageEffect(target, player, player);
				})
				.forResult();
			if (!result.bool) {
				return;
			}
			const target = result.targets[0];
			player.logSkill("dczhenrao", target);
			if (!player.storage.dczhenrao) {
				player.when({ global: "phaseAfter" }).step(async () => player.unmarkSkill("dczhenrao"));
			}
			player.markAuto("dczhenrao", target);
			await target.damage();
			await game.delayx();
		},
		intro: {
			content: "已以此法对$造成过伤害",
			onunmark: true,
		},
		ai: {
			expose: 0.2,
			threaten: 3,
		},
	},
	dcchenlve: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		manualConfirm: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const cards = ["cardPile", "discardPile"].map(pos => Array.from(ui[pos].childNodes)).flat();
			const sishiList = [];
			const isSishi = card => card.storage.dcsanshi;
			const lose_list = [],
				players = game.filterPlayer();
			players.forEach(current => {
				const pos = "ej" + (current !== player ? "h" : "");
				const sishis = current.getCards(pos, isSishi);
				if (sishis.length > 0) {
					current.$throw(sishis);
					lose_list.push([current, sishis]);
					sishiList.addArray(sishis);
				}
			});
			if (lose_list.length) {
				await game.loseAsync({ lose_list }).setContent("chooseToCompareLose");
				await game.delayx();
			}
			sishiList.addArray(cards.filter(isSishi));
			player.gain(sishiList, "gain2");
			player
				.when("phaseUseEnd")
				.filter(evt => evt === event.getParent("phaseUse"))
				.step(async () => {
					const lose_list = [],
						players = game.filterPlayer();
					players.forEach(current => {
						const cards = current.getCards("hej").filter(card => sishiList.includes(card));
						if (cards.length > 0) {
							current.$throw(cards, 1000);
							lose_list.push([current, cards]);
						}
					});
					if (lose_list.length) {
						await game.loseAsync({ lose_list }).setContent("chooseToCompareLose");
					}
					await game.cardsGotoSpecial(sishiList);
					game.log(sishiList, "被移出了游戏");
				});
			player
				.when("die")
				.assign({
					forceDie: true,
				})
				.step(async () => {
					await game.cardsDiscard(sishiList);
					game.log(sishiList, "被置入了弃牌堆");
				});
		},
		ai: {
			order: 0.5,
			result: {
				player(player) {
					if (player.getHp(true) > 1 && player.countCards("he") > 1) {
						return 0;
					}
					if (!player.isDamaged() && (player.countCards("h") > 1 || player.countCards("e") > 0)) {
						return 0;
					}
					return 13;
				},
			},
			combo: "dcsanshi",
		},
	},
	//王凌
	dcjichou: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			const evts = player.getHistory("useCard");
			const names = evts.map(evt => evt.card.name).unique();
			return evts.length > 0 && evts.length === names.length && evts.some(evt => evt.cards.some(card => get.position(card) === "d"));
		},
		async content(event, trigger, player) {
			const cards = [];
			player.checkHistory("useCard", evt => {
				cards.addArray(evt.cards.filterInD("d"));
			});
			const num = Math.min(cards.length, game.countPlayer());
			if (_status.connectMode) {
				game.broadcastAll(() => {
					_status.noclearcountdown = true;
				});
			}
			const { bool, links } = await player
				.chooseButton([`集筹：将${num < cards.length ? "至多" + get.cnNumber(num) + "张牌" : "任意张牌"}交给等量角色`, cards], "allowChooseAll")
				.set("selectButton", [1, num])
				.set("population", [game.countPlayer(current => get.attitude(player, current) > 0), game.countPlayer(current => get.attitude(player, current) < 0)])
				.set("ai", button => {
					const card = button.link,
						population = get.event().population;
					if (ui.selected.buttons.length > population[0] + population[1]) {
						return 0;
					}
					if (ui.selected.buttons.length > get.event().population[0]) {
						return 2 - get.value(card);
					}
					return 2 + get.value(card);
				})
				.forResult();
			if (bool) {
				const { bool, targets } = await player
					.chooseTarget(`集筹：请选择${get.cnNumber(links.length)}名角色`, `操作提示：请按照顺序选择要交给牌的目标，令这些角色按顺序获得这些牌：${get.translation(links)}`, true, links.length)
					.set(
						"values",
						links.map(i => get.value(i))
					)
					.set("ai", target => {
						const att = get.attitude(get.player(), target);
						const chosenNum = ui.selected.targets.length,
							values = get.event().values;
						if (values[chosenNum] > 0) {
							return att;
						}
						return 0.01 - att;
					})
					.forResult();
				if (_status.connectMode) {
					game.broadcastAll(() => {
						delete _status.noclearcountdown;
						game.stopCountChoose();
					});
				}
				if (bool) {
					const gain_list = [],
						givenCards = [];
					targets.forEach((target, i) => {
						player.line(target, "green");
						gain_list.push([target, links[i]]);
						givenCards.push(links[i]);
						game.log(player, "将", links[i], "交给了", target);
					});
					event.getParent().set("givenCards", givenCards);

					await game
						.loseAsync({
							gain_list,
							player: player,
							cards: givenCards,
							giver: player,
							animate: "gain2",
						})
						.setContent("gaincardMultiple");
					const names = givenCards.map(card => card.name).toUniqued();
					await game.delayx();
					const newNames = names.filter(name => !player.getStorage(event.name).includes(name));
					if (newNames.length) {
						player.markAuto(event.name, newNames);
						await player.draw(newNames.length);
					}
				}
			}
			if (_status.connectMode) {
				game.broadcastAll(() => {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
		},
		onremove: true,
		intro: { content: "已交出牌名：$" },
	},
	dcmouli: {
		audio: 2,
		trigger: { player: "phaseEnd" },
		filter(event, player) {
			const names = [];
			player.checkAllHistory("useSkill", evt => {
				if (evt.skill !== "dcjichou") {
					return;
				}
				const evtx = evt.event;
				if (evtx.givenCards) {
					names.addArray(evtx.givenCards.map(card => get.name(card, false)));
				}
			});
			return names.length > 5;
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "water",
		derivation: ["dczifu"],
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.gainMaxHp();
			await player.recover();
			await player.addSkills("dczifu");
		},
		ai: {
			combo: "dcjichou",
		},
	},
	dczifu: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		forced: true,
		async content(event, trigger, player) {
			const maxLimit = Math.min(5, player.maxHp);
			let count = player.countCards("h");
			if (count < maxLimit) {
				await player.draw(maxLimit - count);
			}
			if (!player.hasHistory("gain", evt => evt.getParent(2) === event)) {
				return;
			}
			count = player.countCards("h");
			const toKeepCount = player
				.getCards("h")
				.map(card => get.name(card))
				.unique().length;
			if (count > toKeepCount) {
				const { bool, cards } = await player
					.chooseCard("自缚：选择要保留的手牌", "选择不同牌名的手牌各一张，然后弃置其余手牌", toKeepCount)
					.set("filterCard", card => {
						if (!ui.selected.cards.length) {
							return true;
						}
						const name = get.name(card, player);
						if (ui.selected.cards.some(card => get.name(card, player) === name)) {
							return false;
						}
						return true;
					})
					.set("complexCard", true)
					.set("ai", get.value)
					.forResult();
				if (!bool) {
					return;
				}
				const toDiscard = player.getCards("h").removeArray(cards);
				if (toDiscard.length) {
					player.discard(toDiscard);
				}
			}
		},
		ai: {
			halfneg: true,
		},
	},
};
