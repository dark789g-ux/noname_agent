import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczhoufa" | "dcshouqun" | "dcyuxiang" | "dchuozhong" | "dczhuguo">} */
export const groupSkills = {
	//木鹿大王
	dczhoufa: {
		audio: 2,
		mod: {
			cardUsable(card, player, num) {
				if (card?.storage?.dczhoufa) {
					return Infinity;
				}
			},
		},
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (!player.hasCards("hes", card => get.type(card) != "basic")) {
				return false;
			}
			const list = get.inpileVCardList(([type, _, name, nature]) => get.is.damageCard(get.autoViewAs({ name, nature }, "unsure")));
			return list.some(([type, _, name, nature]) => {
				const vcard = get.autoViewAs({ name, nature, storage: { dczhoufa: true } }, "unsure");
				return event.filterCard(vcard, player, event);
			});
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(([type, _, name, nature]) => {
					let vcard = get.autoViewAs({ name, nature, storage: { dczhoufa: true } }, "unsure");
					if (!get.is.damageCard(vcard)) {
						return false;
					}
					return event.filterCard(vcard, player, event);
				});
				return ui.create.dialog("咒法", [list, "vcard"]);
			},
			check({ link: [type, _, name, nature] }) {
				return get.player().getUseValue(get.autoViewAs({ name, nature, storage: { dczhoufa: true } }, "unsure"));
			},
			backup(links, player) {
				return {
					audio: "dczhoufa",
					position: "hse",
					filterCard: card => get.type(card) != "basic",
					check(card) {
						return 8 - get.value(card);
					},
					viewAs: { name: links[0][2], nature: links[0][3], storage: { dczhoufa: true } },
					async precontent(event, _, player) {
						const evt = event.getParent();
						if (evt == null) {
							return;
						}
						if (evt.addCount !== false) {
							evt.addCount = false;
						}
					},
					popname: true,
				};
			},
			prompt(links, player) {
				return "将一张非基本牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		group: "dczhoufa_thunder",
		subSkill: {
			thunder: {
				charlotte: true,
				trigger: {
					source: "damageBegin1",
				},
				filter(event, player) {
					return event.card?.storage?.dczhoufa && !event.hasNature("thunder");
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					game.setNature(trigger, "thunder");
				},
			},
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
		},
	},
	dcshouqun: {
		init(player, skill) {
			player.setStorage(skill, player.maxHp, true);
		},
		onremove: true,
		audio: 2,
		trigger: {
			player: "phaseDrawBegin1",
		},
		filter(event) {
			return !event.numFixed;
		},
		check(event, player) {
			return player.maxHp > 0;
		},
		async content(event, trigger, player) {
			trigger.changeToZero();
			const cards = get.cards(player.maxHp, true);
			await player
				.showCards(cards, `${get.translation(player)}发动了【${get.translation(event.name)}】`, true)
				.set("isFlash", false)
				.set("clearArena", false)
				.set("callback", async function (event, trigger, player) {
					const list = event.cards.filter(card => {
						if (["equip3", "equip4", "equip3_4"].includes(get.subtype(card))) {
							return true;
						} else if (get.type2(card) == "trick") {
							return true;
						}
						return ["sha", "jiu"].includes(get.name(card));
					});
					const result = await player
						.chooseControl({
							choiceList: [`获得其中的坐骑牌、锦囊牌、【杀】和【酒】，然后若你因此获得的牌数不超过2，你体力上限+1（不能超过初始上限）`, `获得所有展示牌，然后直到你的下回合开始，你获得“驭象”且每次受到火焰伤害后，体力上限-1`],
							ai(event, player) {
								const { list } = get.event();
								if (list.length <= 2 && player.maxHp < 4) {
									return 0;
								}
								return 1;
							},
							list,
						})
						.forResult();
					if (result?.control && result.control != "cancel2") {
						if (result.index == 0) {
							const next = player.gain(list, "gain2");
							await next;
							const { cards } = next;
							if (cards.length <= 2 && player.maxHp < player.getStorage("dcshouqun", 6)) {
								await player.gainMaxHp();
							}
						} else {
							await player.gain({ cards: event.cards, animate: "gain2" });
							await player.addTempSkills("dcyuxiang", { player: "phaseBegin" });
							player.addTempSkill("dcshouqun_debuff", { player: "phaseBegin" });
						}
					}
					game.broadcastAll(ui.clear);
				});
		},
		subSkill: {
			debuff: {
				charlotte: true,
				audio: 2,
				trigger: {
					player: "damageEnd",
				},
				filter(event, player) {
					return event.hasNature("fire");
				},
				forced: true,
				async content(event, trigger, player) {
					await player.loseMaxHp();
				},
				ai: {
					neg: true,
					effect: {
						target(card, player, target) {
							if (get.tag(card, "fireDamage")) {
								return [1, -2];
							}
						},
					},
				},
			},
		},
	},
	dcyuxiang: {
		mod: {
			globalFrom(from, to, distance) {
				return distance - 2;
			},
		},
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
		},
		filter(event, player) {
			if (get.distance(player, event.target) > 2) {
				return false;
			}
			return event.card.name == "sha" && Array.isArray(event.directHit) && !event.directHit.includes(event.target);
		},
		forced: true,
		logTarget: "target",
		async content(event, trigger, player) {
			trigger.directHit.add(trigger.target);
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return arg?.card?.name == "sha" && get.distance(player, arg.target) <= 2;
			},
		},
	},
	//魏讽
	dchuozhong: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filterCard: true,
		position: "h",
		filter(event, player) {
			return player.hasCards("h") && game.hasPlayer(p => p !== player && p.hasCards("he"));
		},
		filterTarget(card, player, target) {
			return player.inRange(target) && target !== player;
		},
		selectTarget: [1, Infinity],
		multiline: true,
		multitarget: true,
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const {
				cards: [card],
				targets,
			} = event;
			const type = get.type2(card);
			await player.showCards(card, `${get.translation(player)}发动了〖惑众〗`);
			await game.doAsyncInOrder(targets, async target => {
				if (!game.hasPlayer(target2 => target2.hasCards("he"))) {
					return;
				}
				const result = await target
					.chooseCardTarget({
						prompt: `惑众：选择一项：1.获得另一名其他角色的一张牌；2.交给${get.translation(player)}一张牌（不选择卡牌即视为进行获得牌操作）`,
						filterCard: true,
						position: "he",
						selectCard: [0, 1],
						complexSelect: true,
						filterTarget(card2, player2, target2) {
							if (target2 === player2) return false;
							if (!ui.selected.cards?.length) {
								if (target2 === get.event().sourcex) {
									return false;
								}
								return target2.hasCards("he");
							}
							return target2 === get.event().sourcex;
						},
						forced: true,
						type,
						sourcex: player,
						ai1(card2) {
							const player2 = get.player();
							if (player2.countCards("he") < 3) {
								return 0;
							}
							if (get.type2(card2) === get.event().type) {
								return 6.5 - get.value(card2);
							}
							return 5 - get.value(card2);
						},
						ai2(target2) {
							const player2 = get.player();
							let att = get.attitude(player2, target2);
							if (ui.selected.cards?.length) {
								if (att < 0 && target2 === get.event().sourcex) {
									return 0;
								}
								if (target2.hasSkillTag("nogain")) {
									att /= 9;
								}
								return 4 - att;
							}
							return -att;
						},
					})
					.forResult();
				if (result?.targets?.length) {
					const { cards: cards2, targets: targets2 } = result;
					target.line(targets2);
					if (!cards2?.length) {
						await target.gainPlayerCard({
							target: targets2[0],
							position: "he",
							forced: true,
						});
					} else {
						await target.give(cards2, targets2[0]);
					}
				}
			});
			const otherPlayers = game.filterPlayer(p => p !== player);

			// 计算这些角色的最大手牌数（只计算手牌数，用于判断哪些角色需要弃牌）
			let maxHandCount = -1;
			const playersToDiscard = [];
			for (const p of otherPlayers) {
				let handNum = p.countCards("h"); // 只计算手牌数量（决定谁弃牌）
				if (handNum > maxHandCount) {
					maxHandCount = handNum;
					playersToDiscard.length = 1;
					playersToDiscard[0] = p;
				} else if (handNum === maxHandCount) {
					playersToDiscard.push(p);
				}
			}

			// 让这些角色依次弃置与展示牌类型相同的所有牌（包括手牌和装备区）
			await game.doAsyncInOrder(playersToDiscard, async target => {
				await target.showHandcards();
				const hs = target.getCards("he", card2 => get.type2(card2) === type);

				if (hs.length) {
					target.$throw(hs.length, 1e3);
					game.log(target, "将", `#y${get.cnNumber(hs.length)}张牌`, "置于牌堆顶");
					await target.lose({
						cards: hs,
						position: ui.cardPile,
						insert_card: true,
					});
				}
			});
		},
	},
	dczhuguo: {
		audio: 2,
		forced: true,
		trigger: {
			global: ["loseAfter", "loseAsyncAfter", "cardsGotoPileAfter"],
		},
		usable: 3,
		filter(event, player, name, target) {
			if (event.name === "cardsGotoPile") {
				return true;
			}
			if (event.name === "lose") {
				if (event.position === ui.cardPile && event.getlx !== false && event.cards2.length) {
					return true;
				}
			}
			return game.hasPlayer(target2 => {
				return target2.hasHistory("lose", evt => evt.getParent() === event && evt.position === ui.cardPile && evt.cards2?.length);
			});
		},
		async content(event, trigger, player) {
			await player.draw(2, "bottom");
		},
	},
};
