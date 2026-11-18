import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twshelie" | "twgongxin" | "twgongxin2" | "twgongxin3" | "twtaoluan" | "twshiji" | "twzhengjun">} */
export const groupSkills = {
	//海外神吕蒙
	twshelie: {
		audio: "shelie",
		inherit: "shelie",
		prompt2: () => lib.translate.shelie_info,
		group: "twshelie_jingce",
		//什么精策技能啊喂！
		subSkill: {
			round: { charlotte: true },
			count: {
				charlotte: true,
				onremove: true,
				intro: {
					markcount(storage) {
						return storage.length;
					},
					content: "本回合已使用$花色的牌",
				},
			},
			jingce: {
				audio: "shelie",
				trigger: { player: ["phaseJieshuBegin", "useCard1"] },
				filter(event, player) {
					if (player.hasSkill("twshelie_round") || player != _status.currentPhase) {
						return false;
					}
					var list = [];
					player.getHistory("useCard", function (evt) {
						if (lib.suit.includes(get.suit(evt.card)) && !list.includes(get.suit(evt.card))) {
							list.push(get.suit(evt.card));
						}
					});
					if (list.length) {
						player.addTempSkill("twshelie_count");
						player.storage.twshelie_count = list.sort(function (a, b) {
							return lib.suit.indexOf(b) - lib.suit.indexOf(a);
						});
						player.markSkill("twshelie_count");
						player.syncStorage("twshelie_count");
					}
					return event.name != "useCard" && list.length >= 4;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					player.addTempSkill("twshelie_round", "roundStart");
					let result;
					if (typeof player.storage.twshelie == "number") {
						result = { index: player.storage.twshelie };
					} else {
						result = await player.chooseControl("摸牌阶段", "出牌阶段").set("prompt", "涉猎：请选择要执行的额外阶段").forResult();
					}
					player.setStorage("twshelie", 1 - result.index);
					const evt = trigger.getParent("phase", true, true);
					if (result.index == 0) {
						if (evt?.phaseList) {
							evt.phaseList.splice(evt.num + 1, 0, "phaseDraw|twshelie");
						}
					}
					if (result.index == 1) {
						if (evt?.phaseList) {
							evt.phaseList.splice(evt.num + 1, 0, "phaseUse|twshelie");
						}
					}
				},
			},
		},
	},
	twgongxin: {
		audio: "gongxin",
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && current.countCards("h");
			});
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		usable: 1,
		async content(event, trigger, player) {
			const { target } = event;
			const cards = target.getCards("h");
			const num = cards.reduce(function (arr, card) {
				arr.add(get.suit(card, player));
				return arr;
			}, []).length;
			const result = await player
				.chooseToMove_new("攻心")
				.set("list", [
					[get.translation(target) + "的手牌", cards],
					[["弃置"], ["置于牌堆顶"]],
				])
				.set("filterOk", moved => {
					return moved[1].slice().concat(moved[2]).length == 1;
				})
				.set("processAI", list => {
					let card = list[0][1].slice().sort((a, b) => {
						return get.value(b) - get.value(a);
					})[0];
					if (!card) {
						return false;
					}
					return [list[0][1].slice().remove(card), [card], []];
				})
				.forResult();
			if (result.bool) {
				if (result.moved[1].length) {
					await target.modedDiscard(result.moved[1]);
				} else {
					await player.showCards(result.moved[2], get.translation(player) + "对" + get.translation(target) + "发动了【攻心】");
					await target.lose(result.moved[2], ui.cardPile, "visible", "insert");
				}
				if (
					num >
					target.getCards("h").reduce(function (arr, card) {
						arr.add(get.suit(card, target));
						return arr;
					}, []).length
				) {
					player.line(target);
					player.addTempSkill("twgongxin3", { player: ["twgongxin3After", "phaseAfter"] });
					player.markAuto("twgongxin3", [target]);
				}
			}
		},
		ai: {
			order: 10,
			expose: 0.25,
			result: {
				target(player, target) {
					return -target.countCards("h");
				},
			},
		},
	},
	twgongxin2: {
		mod: {
			cardEnabled2(card, player) {
				const color = get.color(card);
				if (color != "unsure" && player.getStorage("twgongxin2").includes(color)) {
					return false;
				}
			},
		},
		charlotte: true,
		onremove: true,
		intro: { content: "本回合内不能使用或打出$牌" },
	},
	twgongxin3: {
		charlotte: true,
		onremove: true,
		intro: { content: "$不可响应你本回合使用的下一张牌" },
		trigger: { player: "useCard" },
		forced: true,
		popup: false,
		sourceSkill: "twgongxin",
		async content(event, trigger, player) {
			await game.delayx();
			const targets = player.getStorage("twgongxin3");
			player.line(targets, "fire");
			trigger.directHit.addArray(targets);
		},
	},
	//海外皇甫嵩
	twtaoluan: {
		audio: "sptaoluan",
		trigger: {
			global: "judgeFixing",
		},
		usable: 1,
		filter(event, player) {
			return event.result && player.countDiscardableCards(player, "he", card => get.suit(card) == event.result.suit) > 0;
		},
		async cost(event, trigger, player) {
			const suit = trigger.result.suit;
			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt(event.skill),
					prompt2: `你可以弃置一张${get.translation(suit)}牌以中止此判定。`,
					chooseonly: true,
					position: "he",
					ai(card) {
						if (get.event().goon) {
							return 6 - get.value(card);
						}
						return 0;
					},
					filterCard(card, player) {
						return get.suit(card) == get.event().suit;
					},
				})
				.set("suit", suit)
				.set("goon", trigger.result.judge * get.attitude(player, trigger.player) <= 0)
				.forResult();
		},
		async content(event, trigger, player) {
			await player.discard({ cards: event.cards });
			let evt = trigger.getParent();
			if (evt.name === "phaseJudge") {
				evt.excluded = true;
			} else {
				const stopevt = ev => {
					ev.finish();
					ev._triggered = null;
				};
				stopevt(evt);
				if (evt.name.startsWith("pre_")) {
					stopevt(evt.getParent());
				}
				trigger.next = trigger.next.filter(next => next.name !== "judgeCallback");
				const evts = game.getGlobalHistory("cardMove", e => e.getParent(2) === evt);
				const cards = evts.flatMap(e => e.cards).filter(card => get.position(card, true) === "o");
				trigger.orderingCards.addArray(cards);
			}
			/*const card = trigger.result.card;
			if (get.position(card) == "d") {
				await player.gain(card, "gain2");
			}*/
		},
	},
	twshiji: {
		group: "twshiji_gain",
		audio: "spshiji",
		trigger: {
			player: ["phaseZhunbeiBegin"], //"damageEnd",
		},
		forced: true,
		locked: false,
		async content(event, trigger, player) {
			/*const result = await player
				.chooseControl(["牌堆", "弃牌堆"])
				.set("ai", () => {
					return ui.discardPile.childElementCount >= ui.cardPile.childElementCount ? 1 : 0
				})
				.set("prompt", `【势击】：请选择获得两张颜色不同的牌的位置`)
				.forResult();
			const pos = result.control.includes("弃") ? "discardPile" : "cardPile";*/
			const cards = [];
			for (let suit of lib.suit.slice().randomSort()) {
				const card = get.cardPile(card => get.suit(card) == suit);
				if (card) {
					cards.push(card);
				}
				if (cards.length >= 2) {
					break;
				}
			}
			if (cards.length) {
				await player.gain({ cards, animate: "gain2" });
			}
			const result2 = await player
				.chooseToDiscard({
					prompt: `势击：你可以弃置一张牌，然后与弃置牌花色相同的牌于本回合内被展示后，你摸一张牌。`,
					position: "he",
					ai(card) {
						return 6 - get.value(card);
					},
				})
				.forResult();
			if (result2?.bool && result2?.cards?.length) {
				const skill = `${event.name}_draw`;
				player.addTempSkill(skill);
				player.markAuto(skill, get.suit(result2.cards[0]));
			}
		},
		subSkill: {
			draw: {
				audio: "mbshiji",
				trigger: {
					global: "showCardsAfter",
				},
				onremove: true,
				charlotte: true,
				forced: true,
				filter(event, player) {
					return event.cards?.some(card => player.getStorage("twshiji_draw").includes(get.suit(card)));
				},
				async content(event, trigger, player) {
					const num = trigger.cards
						.map(card => get.suit(card))
						.unique()
						.filter(i => player.getStorage(event.name).includes(i)).length;
					await player.draw({ num });
				},
			},
			gain: {
				audio: "mbshiji",
				getcard(event, player) {
					const { card } = event;
					if (get.name(card) != "huogong") {
						return [];
					}
					const evt = event.getParent(evt => evt.card == card && evt.name == "huogong" && evt.target == event.player, true);
					if (!evt) {
						return [];
					}
					const cards = evt.showResult?.cards;
					return cards?.filter(
						card =>
							["h", "e"].includes(get.position(card)) &&
							get.owner(card) == evt.target &&
							lib.filter.canBeDiscarded(card, player, evt.target)
					);
				},
				trigger: {
					source: "damageSource",
				},
				prompt2(event, player) {
					return `是否弃置${get.translation(get.info("twshiji_gain").getcard(event, player))}？`;
				},
				filter(event, player) {
					return get.info("twshiji_gain").getcard(event, player)?.length;
				},
				check(event, player) {
					return get.attitude(player, event.player) < 0;
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const cards = get.info("twshiji_gain").getcard(trigger, player);
					await event.targets[0].modedDiscard({ cards, discarder: player });
				},
			},
		},
	},
	twzhengjun: {
		audio: "spzhengjun",
		trigger: {
			global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			const evt = event.relatedEvent || event.getParent();
			const evtx = event?.getl(player);
			return evtx?.hs?.length && !["useCard", "respond"].includes(evt?.name);
		},
		async cost(event, trigger, player) {
			const num = player.maxHp - player.countCards("h");
			const result = await player
				.chooseControl({
					prompt: get.prompt2(event.skill),
					controls: ["获得【火攻】", `摸${num >= 0 ? num : 0}张牌`, "cancel2"],
					ai() {
						const player = get.player();
						if (player.maxHp - player.countCards("h") > 2) {
							return 1;
						}
						return 0;
					},
				})
				.forResult();
			event.result = {
				bool: result.control != "cancel2",
				cost_data: result.index,
			};
		},
		async content(event, trigger, player) {
			if (event.cost_data == 0) {
				const card = get.cardPile(card => get.name(card) == "huogong");
				if (card) {
					await player.gain({ cards: [card], animate: "gain2" });
				} else {
					player.chat("牌喵？");
				}
			} else {
				const num = player.maxHp - player.countCards("h");
				if (num > 0) {
					await player.drawTo(player.maxHp);
				}
			}
			const check = evt => evt.getParent().name == event.name || (evt.getParent().name == "draw" && evt.getParent(2).name == event.name);
			if (player.getRoundHistory("gain", evt => check(evt) && evt.cards.length > 0).flatMap(evt => evt.cards).length >= 2) {
				player.tempBanSkill(event.name, "roundStart");
			}
		},
	},
};
