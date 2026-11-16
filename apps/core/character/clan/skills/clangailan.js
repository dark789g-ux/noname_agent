import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clangailan" | "huntianyi_skill" | "clanfennu" | "clanzelie">} */
export const groupSkills = {
	//族陆绩
	clangailan: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && !lib.inpile.includes("huntianyi");
		},
		async content(event, trigger, player) {
			const cards = [];
			for (const i of [1, 3, 10, 12]) {
				cards.push(game.createCard2("huntianyi", "diamond", i));
			}
			game.broadcastAll(function () {
				lib.inpile.add("huntianyi");
			});
			await game.cardsGotoPile(cards, () => {
				return ui.cardPile.childNodes[get.rand(0, ui.cardPile.childNodes.length - 1)];
			});
		},
		group: "clangailan_equip",
		subSkill: {
			equip: {
				audio: "clangailan",
				trigger: {
					player: "phaseBegin",
				},
				filter(event, player) {
					return lib.inpile.includes("huntianyi");
				},
				forced: true,
				async content(event, trigger, player) {
					const card = get.cardPile(card => card.name == "huntianyi");
					if (card && player.canEquip(card, true)) {
						player.$gain2(card);
						await game.delayx();
						await player.equip(card);
					}
				},
			},
		},
	},
	huntianyi_skill: {
		equipSkill: true,
		trigger: { player: "damageBegin2" },
		filter(event, player) {
			if (player.hasSkillTag("unequip2")) {
				return false;
			}
			if (
				event.source?.hasSkillTag("unequip", false, {
					name: event.card ? event.card.name : null,
					target: player,
					card: event.card,
				})
			) {
				return false;
			}
			return player.getEquip("huntianyi");
		},
		forced: true,
		async content(event, trigger, player) {
			const card = player.getEquip("huntianyi");
			await player.lose(card, "visible", ui.ordering);
			trigger.cancel();
		},
		subSkill: {
			lose: {
				audio: "huntianyi_skill",
				forced: true,
				charlotte: true,
				equipSkill: true,
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter: (event, player, name, card) => {
					if (!card || card.name != "huntianyi") {
						return false;
					}
					return !player.hasSkillTag("unequip2");
				},
				getIndex(event, player) {
					const evt = event.getl(player);
					const lostCards = [];
					evt.es.forEach(card => {
						const VEquip = evt.vcard_map.get(card);
						if (VEquip?.name === "huntianyi") {
							lostCards.add(VEquip);
						}
					});
					return lostCards;
				},
				async content(event, trigger, player) {
					const num = get.number(event.indexedData, false),
						cards = [];
					while (cards.length < 2) {
						const cardx = get.cardPile2(card => {
							return get.number(card, false) == num && !cards.includes(card) && get.type2(card, false) == "trick";
						});
						if (cardx) {
							cards.push(cardx);
						} else {
							break;
						}
					}
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				},
			},
		},
	},
	clanfennu: {
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return game.hasPlayer(current => current.countCards("he"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), [1, player.hp])
				.set("filterTarget", (card, player, target) => {
					return target.countCards("he");
				})
				.set("ai", target => {
					const player = get.player();
					if (target.hasSkill("clanzelie") && target.countCards("e") == 1 && !target.countCards("j")) {
						return get.attitude(player, target);
					}
					return get.effect(target, { name: "guohe_copy2" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets.filter(target => target.countDiscardableCards(target, "he"));
			if (!targets?.length) {
				return;
			}
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			const nextx = player
				.chooseCardOL(targets, "he", true, 1, "奋驽：弃置一张牌", (card, player, target) => {
					return lib.filter.cardDiscardable(card, player, "clanfennu");
				})
				.set("ai", card => {
					return 7 - get.value(card);
				});
			nextx._args.remove("glow_result");
			const result = await nextx.forResult();
			const lose_list = [],
				cards = [];
			for (let i = 0; i < result.length; i++) {
				const current = targets[i],
					cards2 = result[i].cards;
				cards.addArray(cards2);
				//lose_list.push([current, cards2]);
				await current.modedDiscard(cards2);
			}
			/*await game
				.loseAsync({
					lose_list: lose_list,
					discarder: player,
				})
				.setContent("discardMultiple");*/
			const next = player.addToExpansion(cards, "gain2");
			next.gaintag.add("clanfennu");
			await next;
		},
		marktext: "逸",
		intro: {
			name: "逸",
			mark(dialog, storage, player) {
				const list = player.getExpansions("clanfennu");
				if (!list.length) {
					return "没有记录";
				}
				const num1 = list.reduce((sum, card) => sum + get.number(card, false), 0);
				dialog.addText(`“逸”牌总点数：${num1}`);
				dialog.addSmall(list);
				const num2 = player.countMark("clanfennu_record");
				dialog.addText(`已记录点数：${num2}`);
			},
			markcount(storage, player) {
				const num = player.countMark("clanfennu_record");
				return num || null;
			},
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
			player.clearMark(`${skill}_record`, false);
		},
		group: ["clanfennu_record", "clanfennu_gain"],
		subSkill: {
			record: {
				trigger: {
					player: "useCardToPlayer",
				},
				filter(event, player) {
					if (!player.getExpansions("clanfennu").length || !event.isFirstTarget) {
						return false;
					}
					const num = get.number(event.card, false);
					return num && typeof num == "number";
				},
				direct: true,
				async content(event, trigger, player) {
					player.addMark(event.name, get.number(trigger.card), false);
					player.markSkill("clanfennu");
				},
			},
			gain: {
				audio: "clanfennu",
				trigger: {
					player: "phaseZhunbeiBegin",
				},
				filter(event, player) {
					if (!player.getExpansions("clanfennu").length || !player.countMark("clanfennu_record")) {
						return false;
					}
					const num1 = player.getExpansions("clanfennu").reduce((sum, card) => sum + get.number(card, false), 0),
						num2 = player.countMark("clanfennu_record");
					return num1 < num2;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					player.clearMark("clanfennu_record", false);
					await player.gain(player.getExpansions("clanfennu"), "gain2");
				},
			},
		},
	},
	clanzelie: {
		audio: 2,
		audioname: ["clan_lujing", "clan_luyusheng"],
		trigger: { global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"] },
		getIndex(event, player) {
			return game
				.filterPlayer(current => {
					if (current.countCards("ej") || (!current.hasClan("吴郡陆氏") && current != player)) {
						return false;
					}
					const evt = event.getl(current);
					return evt?.es?.length || evt?.js?.length;
				})
				.sortBySeat(_status.currentPhase);
		},
		filter: (event, player, name, target) => target?.isIn(),
		clanSkill: true,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					const player = get.player(),
						att = get.attitude(player, target);
					return att;
					//相信后人智慧
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			target.addTempSkill("clanzelie_effect");
			target.addMark("clanzelie_effect", 1, false);
		},
		ai: {
			noe: true,
			skillTagFilter(player, tag, arg) {
				return player.countCards("ej") == 1;
			},
		},
		subSkill: {
			effect: {
				trigger: {
					player: ["gainAfter", "loseAfter"],
					global: "loseAsyncAfter",
				},
				charlotte: true,
				direct: true,
				firstDo: true,
				onremove: true,
				getIndex(event, player) {
					return player.countMark("clanzelie_effect");
				},
				filter(event, player) {
					if (!player.hasMark("clanzelie_effect")) {
						return false;
					}
					if (event.name == "gain") {
						return event.getParent().name == "draw";
					}
					return event.type == "discard" && event.getl(player).cards2.length && player.countCards("he");
				},
				intro: {
					content: "本回合下$次摸牌/弃置牌后，摸一张牌/弃置一张牌",
				},
				async content(event, trigger, player) {
					player.removeMark("clanzelie_effect", 1, false);
					if (trigger.name == "gain") {
						await player.draw();
					} else {
						await player.chooseToDiscard("he", true);
					}
				},
			},
		},
	},
};
