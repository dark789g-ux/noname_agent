import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clangezhi" | "clanmingdian" | "clanshize">} */
export const groupSkills = {
	//族陈群
	clangezhi: {
		audio: 2,
		usable: 1,
		trigger: {
			global: "damageEnd",
		},
		filter(event, player) {
			return (event.player == player || player.inRange(event.player)) && event.source && event.source != player && (player.countDiscardableCards(player, "he") > 0 || event.source.countDiscardableCards(player, "he") > 0);
		},
		check: (event, player) => get.effect(event.source, { name: "guohe_copy2" }, player, player) > 0,
		logTarget: "source",
		async assignCards(event, trigger, player) {
			let { cards, goon, filterCard, filterButton, filterTarget, forced, position, complexCard, prompt, ai1, ai2, selectCard, selectButton, chooseonly, gaintag } = event;
			if (!cards.length) {
				return;
			}
			if (cards.some(card => get.owner(card) != player || !"he".includes(get.position(card)))) {
				event.type = "button";
			} else {
				event.type = "card";
			}
			goon ??= () => true;
			filterCard ??= () => true;
			filterButton ??= () => true;
			filterTarget ??= () => true;
			forced ??= false;
			position ??= "h";
			complexCard ??= false;
			prompt ??= "请选择要分配的卡牌和目标";
			ai1 ??=
				event.type == "card"
					? card => {
							if (!ui.selected.cards.length) {
								return 1;
							}
							return 0;
						}
					: button => {
							if (!ui.selected.buttons.length) {
								return 1;
							}
							return 0;
						};
			ai2 ??= target => {
				const player = get.player(),
					card = get.event().name == "chooseCardTarget" ? ui.selected.cards[0] : ui.selected.buttons[0].link;
				const val = target.getUseValue(card);
				if (val > 0) {
					return val * get.attitude(player, target) * 2;
				}
				return get.value(card, target) * get.attitude(player, target);
			};
			selectCard ??= [1, Infinity];
			selectButton ??= [1, Infinity];
			const give_map = new Map();
			event.give_map = give_map;
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			const assigned = [];
			event.assigned = assigned;
			if (event.type == "card") {
				while (assigned.length < cards.length && goon(event)) {
					const result = await player
						.chooseCardTarget({
							prompt: prompt,
							forced: typeof forced == "boolean" ? forced : forced(event),
							filterCardx: filterCard,
							filterCard(card, ...args) {
								if (card.hasGaintag("assigned_tag")) {
									return false;
								}
								return get.event().filterCardx.call(this, card, ...args);
							},
							selectCard: selectCard,
							filterTarget: filterTarget,
							position: position,
							complexCard: complexCard,
							ai1: ai1,
							ai2: ai2,
						})
						.forResult();
					if (result?.bool && result.cards?.length && result.targets?.length) {
						const {
							cards,
							targets: [target],
						} = result;
						player.addGaintag(cards, "assigned_tag");
						assigned.addArray(cards);
						give_map.set(target, (give_map.get(target) || []).concat(cards));
					} else {
						break;
					}
				}
			} else {
				while (assigned.length < cards.length && goon(event)) {
					const result = await player
						.chooseButtonTarget({
							createDialog: [prompt, cards.filter(i => !assigned.includes(i))],
							forced: typeof forced == "boolean" ? forced : forced(event),
							filterButton: filterButton,
							filterTarget: filterTarget,
							selectButton: selectButton,
							ai1: ai1,
							ai2: ai2,
						})
						.forResult();
					if (result?.bool && result.links?.length && result.targets?.length) {
						const {
							links,
							targets: [target],
						} = result;
						assigned.addArray(links);
						give_map.set(target, (give_map.get(target) || []).concat(links));
					} else {
						break;
					}
				}
			}
			event.result = give_map;
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			if (!chooseonly) {
				player.line(Array.from(give_map.keys()));
				if (event.type == "button") {
					for (const target of Array.from(give_map.keys()).sortBySeat()) {
						game.log(target, "获得了", give_map.get(target));
					}
				}
				event.done ??= game
					.loseAsync({
						gain_list: Array.from(give_map.entries()),
						giver: player,
						player: event.type == "card" ? player : null,
						cards: Array.from(give_map.values()).flat(),
						animate: event.type == "card" ? "giveAuto" : "gain2",
						gaintag: gaintag || [],
					})
					.setContent("gaincardMultiple");
				await event.done;
			}
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			let cards = [];
			if (player.countDiscardableCards(player, "he")) {
				const result = await player.chooseToDiscard("he", true).forResult();
				if (result?.cards?.length) {
					cards.addArray(result.cards);
				}
			}
			if (target.countDiscardableCards(player, "he")) {
				const result = await player.discardPlayerCard(target, "he", true).forResult();
				if (result?.cards?.length) {
					cards.addArray(result.cards);
				}
			}
			const cardsx = cards.filterInD("d");
			if (cardsx.length) {
				const next = game.createEvent("assignCards");
				next.set("player", player);
				next.set("cards", cardsx);
				next.setContent(get.info(event.name).assignCards);
				await next;
			}
			const types = cards.map(card => get.type2(card)).unique();
			if (types.length != 1) {
				[player, target].forEach(i => {
					i.addTempSkill(`${event.name}_debuff`);
					i.setStorage(`${event.name}_debuff`, types);
					i.markSkill(`${event.name}_debuff`);
				});
			}
		},
		subSkill: {
			debuff: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "只能使用：$",
				},
				mod: {
					cardEnabled(card, player) {
						if (!player.getStorage("clangezhi_debuff").includes(get.type2(card))) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (!player.getStorage("clangezhi_debuff").includes(get.type2(card))) {
							return false;
						}
					},
				},
			},
		},
	},
	clanmingdian: {
		audio: 2,
		enable: "phaseUse",
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return player.hasCard(card => get.type(card) == "basic" && player.canRecast(card) && !player.getStorage("clanmingdian_used").includes(get.name(card)), "he");
		},
		filterCard(card) {
			const player = get.player();
			return get.type(card) == "basic" && player.canRecast(card) && !player.getStorage("clanmingdian_used").includes(get.name(card));
		},
		selectCard: [1, Infinity],
		position: "he",
		check(card) {
			return 7 - get.value(card);
		},
		lose: false,
		discard: false,
		delay: false,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), [1, Infinity], "he", get.info(event.skill).filterCard)
				.set("ai", card => 7.5 - get.value(card))
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			const names = cards.map(card => get.name(card)).unique();
			player.addTempSkill(`${event.name}_used`, "roundStart");
			player.markAuto(`${event.name}_used`, names);
			await player.recast(cards);
			if (player.hasHistory("useCard", evt => names.includes(get.name(evt.card)))) {
				const list = player
					.getCards("h")
					.map(card => get.name(card))
					.unique();
				const card = get.cardPile(card => get.type(card) == "basic" && !list.includes(get.name(card)), void 0, "random");
				if (card) {
					await player.gain(card, "gain2");
				} else {
					player.chat("碰！");
				}
			}
		},
		ai: {
			order: 4,
			result: {
				player: 1,
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已重铸：$",
				},
			},
		},
	},
	clanshize: {
		audio: 2,
		clanSkill: true,
		audioname: ["clan_chenqun"],
		trigger: {
			global: ["useCard", "respond"],
		},
		locked: true,
		filter(event, player) {
			if (_status.currentPhase !== player) {
				return false;
			}
			const history = game.getGlobalHistory("everything", evt => {
				if (!["useCard", "respond"].includes(evt.name)) {
					return false;
				}
				return evt.respondTo?.[0] == player;
			});
			return history.indexOf(event) == 0 && game.hasPlayer(target => target.hasClan("颍川陈氏") || target == player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(`###${get.translation(event.skill)}###${get.skillInfoTranslation(event.skill, player)}`, true, (card, player, target) => {
					return target.hasClan("颍川陈氏") || target == player;
				})
				.set("ai", target => {
					const player = get.player();
					const att = get.attitude(player, target);
					if (att > 0) {
						return game.countPlayer(i => !i.inRangeOf(target)) + 1;
					}
					return 0;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			game.log(target, "的攻击范围", "#g+1");
			target.addSkill(`${event.name}_effect`);
			target.addMark(`${event.name}_effect`, 1, false);
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { player: "damage" },
				filter(event, player) {
					return player.hasMark("clanshize_effect");
				},
				silent: true,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
				},
				mod: {
					attackRange(player, num) {
						return num + player.countMark("clanshize_effect");
					},
				},
				markimage: "image/card/attackRange.png",
				intro: {
					content(num, player) {
						let str = "<li>攻击范围+";
						str += num;
						str += "<br><li>当前攻击范围：";
						str += player.getAttackRange(false);
						return str;
					},
				},
			},
		},
	},
};
