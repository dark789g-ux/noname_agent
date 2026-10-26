import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olduoqi" | "olkuangmo" | "olgangquan">} */
export const groupSkills = {
	//魔吕布
	olduoqi: {
		audio: 2,
		group: ["olduoqi_gain", "olduoqi_mark"],
		trigger: { global: "phaseBeforeEnd" },
		forced: true,
		cardslist(player, target, killGain = false) {
			const filterCard = card => card.hasGaintag("eternal_olduoqi_tag") && target._start_cards?.includes(card);
			let cards = [...ui.cardPile.childNodes, ...ui.discardPile.childNodes].filter(filterCard);
			const lose_list = [];
			const targets = game.filterPlayer();
			targets.forEach(targetx => {
				const pos = "ej" + (targetx !== player ? "h" : "");
				const cardsx = targetx.getCards(pos, filterCard);
				if (cardsx.length) {
					cards = cards.concat(cardsx);
					if (killGain) {
						targetx.$throw(cards, 1000);
						lose_list.push([targetx, cards]);
					}
				}
			});
			return killGain ? [cards, lose_list] : cards;
		},
		filter(event, player) {
			if (event.player.getSeatNum() != 1 || _status?.olduoqi_record?.includes(player) || event.finished) {
				return false;
			}
			let history = event.player.actionHistory;
			if (history.length > 1) {
				for (let i = 0; i < history.length - 2; i++) {
					if (!history[i].isMe || history[i].isSkipped) {
						continue;
					}
					return false;
				}
			}
			return !player.isTurnedOver() || event._noTurnOver;
		},
		onRound(event) {
			return !event.olduoqi_phase;
		},
		async content(event, trigger, player) {
			if (!_status.olduoqi_record) {
				_status.olduoqi_record = [];
			}
			_status.olduoqi_record.add(player);
			game.broadcastAll(record => {
				_status.olduoqi_record = record;
			}, _status.olduoqi_record);
			const next = player.insertPhase();
			next._noTurnOver = true;
			next.set("phaseList", ["phaseUse"]);
			player
				.when({ player: "phaseBegin" }, false)
				.assign({ firstDo: true })
				.filter(evt => evt.skill == "olduoqi")
				.step(async () => {
					player.addTempSkill("olduoqi_limit");
				})
				.finish();
			if (!trigger._finished) {
				trigger.finish();
				trigger._finished = true;
				trigger.untrigger(true);
				trigger._triggered = 5;
				if (!lib.onround.includes(get.info("olduoqi").onRound)) {
					lib.onround.push(get.info("olduoqi").onRound);
				}
				const evt = trigger.player.insertPhase();
				evt.set("olduoqi_phase", true);
				evt.relatedEvent = trigger.relatedEvent || trigger.getParent(2);
				evt.skill = trigger.skill;
				evt._noTurnOver = true;
				evt.set("phaseList", trigger.phaseList);
				evt.pushHandler("olduoqi_phase", (event, option) => {
					if (event.step === 0 && option.state === "begin") {
						event.step = 4;
						_status.globalHistory.push({
							cardMove: [],
							custom: [],
							useCard: [],
							changeHp: [],
							everything: [],
						});
						let players = game.players.slice(0).concat(game.dead);
						for (let i = 0; i < players.length; i++) {
							let current = players[i];
							current.actionHistory.push({
								useCard: [],
								respond: [],
								skipped: [],
								lose: [],
								gain: [],
								sourceDamage: [],
								damage: [],
								custom: [],
								useSkill: [],
							});
							current.stat.push({ card: {}, skill: {} });
						}
					}
				});
			}
			const nexts = trigger.getParent()?.next;
			if (nexts?.length) {
				for (let evt of nexts.slice(0)) {
					if (evt.finished) {
						continue;
					}
					if (evt == next) {
						break;
					}
					nexts.remove(evt);
					nexts.push(evt);
				}
			}
		},
		subSkill: {
			gain: {
				audio: "olduoqi",
				trigger: { source: "damageSource" },
				forced: true,
				filter(event, player) {
					const cards = get.info("olduoqi").cardslist(player, event.player);
					return (
						player
							.getHistory("sourceDamage", evt => {
								return evt.player === event.player;
							})
							.indexOf(event) == 0 && event.player?._start_cards?.some(card => cards.includes(card))
					);
				},
				async content(event, trigger, player) {
					const cards = get.info("olduoqi").cardslist(player, trigger.player);
					if (cards.length) {
						const card = cards.randomGet();
						if (get.owner(card)) {
							await player.gain(card, "give", get.owner(card));
						} else {
							await player.gain(card, "gain2");
						}
					}
				},
			},
			mark: {
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				forced: true,
				popup: false,
				filter(event, player) {
					return (event.name != "phase" || game.phaseNumber == 0) && game.hasPlayer(target => target._start_cards?.length);
				},
				async content(event, trigger, player) {
					game.filterPlayer().forEach(target => target.addGaintag(target._start_cards || [], "eternal_olduoqi_tag"));
				},
			},
			tag: {},
			limit: {
				charlotte: true,
				mod: {
					cardEnabled(card, player) {
						if (get.type(card) == "delay") {
							return false;
						}
					},
					cardSavable(card, player) {
						if (get.type(card) == "delay") {
							return false;
						}
					},
				},
			},
		},
	},
	olkuangmo: {
		group: "olkuangmo_point",
		audio: 3,
		enable: "phaseUse",
		skillAnimation: "epic",
		animationColor: "metal",
		filter(event, player) {
			return game.hasPlayer(current => player !== current) && !player.hasSkill("olrumo");
		},
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			player.addSkill("olrumo");
			const target = event.targets[0];
			const name = event.name + "_effect";
			player.markAuto(name, target);
			target.markAuto(name, player);
			player.addTip(name, "狂 " + player.getStorage(name).map(targetx => get.translation(targetx)));
			target.addTip(name, "狂 " + target.getStorage(name).map(targetx => get.translation(targetx)));
			target.addSkill(name);
			player.addSkill(name);
		},
		ai: {
			order: 8,
			result: {
				player: 8,
				target(player, target) {
					return get.damageEffect(target, player, target);
				},
			},
		},
		subSkill: {
			point: {
				trigger: {
					global: "dieAfter",
				},
				forced: true,
				lastDo: true,
				skillAnimation: "epic",
				animationColor: "metal",
				filter(event, player) {
					return player.getStorage("olkuangmo_effect").includes(event.player) && game.hasPlayer(current => player !== current && !player.getStorage("olkuangmo_effect").includes(current));
				},
				async content(event, trigger, player) {
					const result = await player
						.chooseTarget(get.prompt("olkuangmo"), "重新指定一名角色，你与其成为“狂”角色", lib.filter.notMe, true)
						.set("ai", target => {
							const player = get.player();
							return get.damageEffect(target, player, player);
						})
						.forResult();
					if (!result?.targets?.[0]?.isIn()) {
						return;
					}
					const target = result.targets[0];
					player.line(target, "fire");
					const name = "olkuangmo_effect";
					player.unmarkAuto(name, trigger.player);
					player.markAuto(name, target);
					target.markAuto(name, player);
					player.addTip(name, "狂 " + player.getStorage(name).map(targetx => get.translation(targetx)));
					target.addTip(name, "狂 " + target.getStorage(name).map(targetx => get.translation(targetx)));
					target.addSkill(name);
					player.addSkill(name);
				},
			},
			effect: {
				mark: true,
				marktext: "狂",
				intro: {
					content: "跟$魔怔上了",
				},
				trigger: {
					source: ["damageBegin1", "dieAfter"],
				},
				charlotte: true,
				popup: false,
				forced: true,
				filter(event, player) {
					if (
						event.name == "damage" &&
						game
							.getGlobalHistory("everything", evt => {
								return evt.name == "damage" && evt.source == player && event.player == evt.player;
							})
							.indexOf(event) != 0
					) {
						return false;
					}
					return player.getStorage("olkuangmo_effect").includes(event.player);
				},
				async content(event, trigger, player) {
					if (trigger.name == "damage") {
						trigger.num++;
					} else {
						const target = trigger.player;
						const list = get.info("olduoqi").cardslist(player, target, true);
						const cards = list[0];
						const lose_list = list[1];
						await game.loseAsync({ lose_list: lose_list }).setContent("chooseToCompareLose");
						await game.delayx();
						await player.gain(cards, "gain2");
					}
				},
				ai: {
					presha: true,
				},
			},
		},
	},
	olgangquan: {
		audio: 2,
		init(player, skill) {
			player.addSkill(skill + "_mark");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_mark");
		},
		enable: "chooseToUse",
		filter(event, player) {
			const bool = event.olgangquan,
				type = bool ? "equip" : "trick",
				viewAs = bool ? { name: "sha", nature: "fire" } : { name: "juedou" },
				card = get.autoViewAs(viewAs, "unsure");
			return event.filterCard(card, player, event) && player.hasCard(card => get.type2(card) == type, "hes");
		},
		hiddenCard(player, name) {
			return (name == "juedou" && player.hasCard(card => get.type2(card) == "trick", "hes")) || (name == "sha" && player.hasCard(card => get.type2(card) == "equip", "hes"));
		},
		/*locked: false,
		mod: {
			playerEnabled(card, player, target) {
				if (!card.storage?.olgangquan || get.name(card) != "sha" || player._olgangquanCheck) {
					return;
				}
				player._olgangquanCheck = true;
				const bool = [player.getNext(), player.getPrevious()].some(target => {
					return target?.isIn() && !player.canUse(get.card(), target, null, true);
				});
				delete player._olgangquanCheck;
				if (bool) {
					return false;
				}
			},
		},*/
		onChooseToUse(event) {
			if (game.online || event?.olgangquan) {
				return;
			}
			const evt = get.info("dcjianying").getLastUsed(event.player);
			event.set(
				"olgangquan",
				evt.cards?.some(card => card.hasGaintag("eternal_olduoqi_tag"))
			);
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(info => {
					return event.olgangquan ? info[2] == "sha" && info[3] === "fire" : info[2] == "juedou";
				});
				const dialog = ui.create.dialog("罡拳", [list, "vcard"]);
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				return get.player().getUseValue({
					name: button.link[2],
					nature: button?.link[3],
				});
			},
			backup(links, player) {
				return {
					audio: "olgangquan",
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						storage: {
							olgangquan: true,
						},
					},
					choice: links[0][2],
					filterCard(card) {
						if (get.info("olgangquan_backup").choice == "sha") {
							return get.type2(card) == "equip";
						}
						return get.type2(card) == "trick";
					},
					position: "hes",
					selectCard: 1,
					filterTarget(card, player, target) {
						if (get.info("olgangquan_backup").choice == "sha") {
							if (![player.getPrevious(), player.getNext()].includes(target)) {
								return false;
							}
							return lib.filter.targetEnabled.apply(this, arguments);
						}
						return lib.filter.filterTarget.apply(this, arguments);
					},
					selectTarget() {
						/*if (get.card()?.name == "sha") {
							if ([player.getNext(), player.getPrevious()].some(target => {
								return target?.isIn() && !player.canUse(get.card(), target, null, true);
							})) {
								return 1;
							}
						}*/
						return get.info("olgangquan_backup").choice != "sha" ? 1 : -1;
					},
					filterOk() {
						return ui.selected.targets?.length > 0;
					},
					popname: true,
				};
			},
			prompt(links, player) {
				const card = `${get.translation(links[0][3]) || ""}${get.translation(links[0][2])}`;
				return `###罡拳###将一张${links[0][2] === "sha" ? "装备" : "锦囊"}牌当做${card}使用`;
			},
		},
		ai: {
			order: 9,
			result: {
				player: 8,
			},
		},
		subSkill: {
			backup: {},
			mark: {
				charlotte: true,
				silent: true,
				markColor: ["rgba(72, 118, 255, 1)", "rgba(255, 69, 0, 1)"],
				init(player, skill) {
					const evt = get.info("dcjianying").getLastUsed(player);
					const bool = evt.cards?.some(card => card.hasGaintag("eternal_olduoqi_tag"));
					player.markSkill(skill);
					game.broadcastAll(
						function (index, player) {
							const name = "olgangquan_mark";
							const bgColor = get.info(name).markColor[index],
								text = `<span style = "color:#000000;font-weight:bold">${index ? "杀" : "斗"}</span>`;
							if (player.marks[name]) {
								player.marks[name].firstChild.style.backgroundColor = bgColor;
								player.marks[name].firstChild.innerHTML = text;
							}
							player.update();
						},
						Number(!!bool),
						player
					);
				},
				trigger: {
					player: "useCard1",
				},
				async content(event, trigger, player) {
					get.info(event.name).init(player, event.name);
				},
				intro: {
					content: "图标的文字就是【罡拳】能印的牌",
				},
			},
		},
	},
};
