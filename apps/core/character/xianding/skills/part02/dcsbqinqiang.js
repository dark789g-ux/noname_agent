import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbqinqiang" | "dcsbyizhen" | "dcfuhui">} */
export const groupSkills = {
	//谋徐盛
	dcsbqinqiang: {
		locked: false,
		aiOrder(player, card, num) {
			if (typeof card !== "object" || player.getStorage("dcsbqinqiang_used").length > 1) {
				return;
			}
			const evt = player.getLastUsed();
			if (evt?.card && get.color(card) == get.color(evt.card)) {
				return num + 10;
			}
		},
		getNum(event, player) {
			const color = get.color(event.card);
			let num = 0;
			const history = player.getHistory("useCard", () => true, event);
			for (let i = history.length - 2; i >= 0; i--) {
				const evt = history[i];
				const colorx = get.color(evt.card);
				if (colorx === color) {
					num++;
				} else {
					break;
				}
			}
			return num;
		},
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (
				!event.cards ||
				!player.hasHistory("lose", evt => {
					const evtx = evt.relatedEvent || evt.getParent();
					return evtx == event && evt.hs.length > 0;
				})
			) {
				return false;
			}
			const num = get.info("dcsbqinqiang").getNum(event, player);
			if (!num) {
				return false;
			}
			return player.getStorage("dcsbqinqiang_used").length < 2;
		},
		async cost(event, trigger, player) {
			const num = get.info(event.skill).getNum(trigger, player);
			const choices = [];
			const choiceList = [`令${get.translation(trigger.card)}伤害+${num}`, `摸${get.cnNumber(num)}张牌`];
			if (get.is.damageCard(trigger.card) && !player.getStorage("dcsbqinqiang_used").includes("选项一")) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			if (!player.getStorage("dcsbqinqiang_used").includes("选项二")) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			if (!choices.length) {
				return;
			}
			choices.push("cancel2");

			const result = await player
				.chooseControl({
					prompt: "勤强：你可以选择一项",
					controls: choices,
					choiceList,
					ai() {
						const { controls, numx, player } = get.event();
						const evt = get.event().getTrigger();
						if (!controls.includes("选项二")) {
							if (controls.includes("选项一") && evt.targets?.some(target => get.effect(target, evt.card, player, player) > 0)) {
								return "选项一";
							}
							return "cancel2";
						} else {
							if (!player.hasCards("h", card => get.color(card) == get.color(evt.card) && player.hasValueTarget(card, null, true))) {
								return "选项二";
							}
							return "cancel2";
						}
					},
				})
				.set("numx", num)
				.forResult();

			event.result = {
				bool: result.control !== "cancel2",
				cost_data: result.control,
			};
		},
		async content(event, trigger, player) {
			const control = event.cost_data;
			player.addTempSkill(event.name + "_used");
			player.markAuto(event.name + "_used", [control]);
			const str = control === "选项一" ? "加伤" : "摸牌";
			player.popup(str);
			game.log(player, "选择了", "#g【勤强】", "的", "#y" + str + "项");
			const num = get.info(event.name).getNum(trigger, player);
			if (control === "选项一") {
				if (typeof trigger.baseDamage != "number") {
					trigger.baseDamage = 1;
				}
				trigger.baseDamage += num;
			} else if (control == "选项二") {
				await player.draw(num);
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	dcsbyizhen: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.source?.isIn() && event.source !== player && event.source.hasCards("h") && player.hasCards("h");
		},
		check(event, player) {
			const source = event.source;
			return get.attitude(player, source) < 0;
		},
		logTarget: "source",
		async content(event, trigger, player) {
			const target = event.targets[0],
				targets = [player, target];
			const map = await game.chooseAnyOL(targets, get.info(event.name).discardPlayerCard, [targets]).forResult();
			const cards1 = [];
			const cards2 = [];
			for (const current of targets) {
				const result = map.get(current);
				if (result?.cards?.length) {
					if (current == player) {
						await target.modedDiscard(result.cards).set("discarder", player);
						cards2.addArray(result.cards);
					} else {
						await player.modedDiscard(result.cards).set("discarder", target);
						cards1.addArray(result.cards);
					}
				}
			}
			if (cards1.length > 0 && cards2.length > 0 && get.color(cards1[0]) == get.color(cards2[0])) {
				const cards = [...cards1, ...cards2].filterInD("d");
				if (cards.length) {
					await player.gain({
						cards,
						animate: "gain2",
					});
				}
			}
		},
		discardPlayerCard(player, targets, eventId) {
			const target = targets[0] == player ? targets[1] : targets[0];
			return player
				.discardPlayerCard(`疑阵：观看${get.translation(target)}的手牌并弃置其中一张`, "h", "visible", true, target)
				.set("chooseonly", true)
				.set("ai", button => {
					const { player, target } = get.event();
					return get.value(button.link);
				})
				.set("id", eventId)
				.set("_global_waiting", true);
		},
	},
	//徐妏
	dcfuhui: {
		audio: 2,
		enable: "chooseToUse",
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			const player = event.player;
			const used = game
				.getGlobalHistory("useCard", evt => {
					return evt.card?.storage?.dcfuhui == player && (evt.cards ?? []).length == 2;
				})
				.map(evt => evt.cards.map(card => get.suit(card, evt.player)).toUniqued());
			event.set("usedSuit", used);
		},
		filter(event, player) {
			/*if (
				player
					.getCards("hs")
					.map(i => get.suit(i))
					.unique().length < 2
			) {
				return false;
			}*/
			if (player.countCards("hs") < 2) {
				return false;
			}
			return get
				.inpileVCardList(info => {
					const name = info[2];
					if (get.type(name) != "basic" && get.type(name) != "trick") {
						return false;
					}
					return !player.getStorage("dcfuhui_used").includes(name);
				})
				.some(card => event.filterCard(get.autoViewAs({ name: card[2], nature: card[3] }, "unsure"), player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const list = get
					.inpileVCardList(info => {
						const name = info[2];
						if (get.type(name) != "basic" && get.type(name) != "trick") {
							return false;
						}
						return !player.getStorage("dcfuhui_used").includes(name);
					})
					.filter(card => event.filterCard(get.autoViewAs({ name: card[2], nature: card[3] }, "unsure"), player, event));
				return ui.create.dialog("赋绘", [list, "vcard"]);
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
					audio: "dcfuhui",
					/*filterCard(card, player) {
						return !ui.selected.cards.some(i => get.suit(i) === get.suit(card));
					},*/
					filterCard: true,
					//complexCard: true,
					selectCard: 2,
					popname: true,
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						storage: {
							dcfuhui: player,
						},
					},
					ai1(card) {
						return 1 / (get.value(card) || 0.5);
					},
					log: false,
					position: "hs",
					async precontent(event, trigger, player) {
						player.logSkill("dcfuhui");
						player.addTempSkill("dcfuhui_used");
						player.markAuto("dcfuhui_used", [event.result.card.name]);
						player
							.when({
								global: "useCard",
							})
							.filter(evt => evt.getParent() == event.getParent())
							.step(async (event, trigger, player) => {
								const sort = (a, b) => lib.suits.indexOf(a) - lib.suits.indexOf(b);
								const suits = trigger.cards.map(i => get.suit(i, player)).sort(sort);
								if (
									!game.hasGlobalHistory(
										"useCard",
										evt => {
											if (evt === trigger || (evt.cards ?? []).length !== 2) {
												return false;
											}
											if (evt.card?.storage?.dcfuhui !== player) {
												return false;
											}
											const suits2 = evt.cards.map(i => get.suit(i, evt.player)).sort(sort);
											return suits.length === suits2.length && suits.every((suit, i) => suit == suits2[i]);
										},
										trigger
									)
								) {
									await player.draw();
								}
							});
					},
				};
			},
			prompt(links, player) {
				//花色各不相同的
				let prompt = `将两张手牌当作${get.translation(links[0][3] || "")}【${get.translation(links[0][2])}】使用`,
					prompt2 = [];
				const used = get.event().usedSuit;
				const suits = lib.suit.slice(0).addArray(player.getCards("hs").map(card => get.suit(card)));
				for (const suit1 of suits) {
					let list = [];
					for (const suit2 of suits) {
						const combo = [suit1, suit2].toUniqued();
						if (
							used?.length &&
							used.some(record => {
								if (record.length != combo.length) {
									return false;
								}
								return record.containsAll(...combo);
							})
						) {
							list.add(`<span style="opacity:0.5">${get.translation(suit1)}${get.translation(suit2)}</span>`);
						} else {
							list.add(`<span class="greentext">${get.translation(suit1)}${get.translation(suit2)}</span>`);
						}
					}
					prompt2.add(`<div class="text center">${list.join(" ")}</div>`);
				}
				return `###${prompt}###${prompt2.join("<br>")}`;
			},
		},
		hiddenCard(player, name) {
			/*if (
				player
					.getCards("hs")
					.map(i => get.suit(i))
					.unique().length < 2
			) {
				return false;
			}*/
			if (player.countCards("hs") < 2) {
				return false;
			}
			if (get.type(name) != "basic" && get.type(name) != "trick") {
				return false;
			}
			if (player.getStorage("dcfuhui_used").includes(name)) {
				return false;
			}
			return lib.inpile.includes(name);
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
							return !player.getStorage("dcfuhui_used").includes(name);
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
				return lib.skill["dcfuhui"].hiddenCard(player, name);
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
			backup: { audio: "dcfuhui" },
			used: {
				charlotte: true,
				onremove: true,
			},
			effect: {
				charlotte: true,
				trigger: { player: "useCard" },
				filter(event, player) {
					if (event.skill !== "dcfuhui_backup" || (event.cards ?? []).length !== 2) {
						return false;
					}
					const sort = (a, b) => lib.suits.indexOf(a) - lib.suits.indexOf(b);
					const suits = event.cards.map(i => get.suit(i, player)).sort(sort);
					return !player.hasHistory(
						"useCard",
						evt => {
							if (evt === event || (evt.cards ?? []).length !== 2) {
								return false;
							}
							const suits2 = evt.cards.map(i => get.suit(i, player)).sort(sort);
							return suits.length === suits2.length && suits.every((suit, i) => suit == suits2[i]);
						},
						event
					);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					await player.draw();
				},
			},
		},
	},
};
