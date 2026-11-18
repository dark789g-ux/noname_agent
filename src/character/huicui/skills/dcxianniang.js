import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcxianniang" | "dcmurui" | "dcaoren" | "dcpingzhi" | "dcgangjian" | "dcguyin" | "dcpinglu">} */
export const groupSkills = {
	//侯成
	dcxianniang: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "damageEnd"],
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (player.getStorage("dcxianniang_used").includes(event.name === "damage" ? "damage" : "lose")) {
				return false;
			}
			if (!game.hasPlayer(current => player !== current && player.countCards("h") <= current.countCards("h") && current.countCards("he") > 0)) {
				return false;
			}
			if (event.name === "damage") {
				return true;
			}
			if (event.type !== "discard" || (event.discarder || event.getParent(2).player) === player) {
				return false;
			}
			return (event.getl?.(player)?.cards2 ?? []).length > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return player !== target && player.countCards("h") <= target.countCards("h") && target.countCards("he") > 0;
				})
				.set("ai", target => {
					let att = get.attitude(get.player(), target) * -1;
					if (target.getHp() < target.countCards("h")) {
						return att * 2;
					}
					return att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.addTempSkill(event.name + "_used", "roundStart");
			player.markAuto(event.name + "_used", trigger.name == "damage" ? "damage" : "lose");
			const {
				targets: [target],
			} = event;
			const tag = event.name + "_tag";
			const position = target != player ? "he" : "h";
			if (!target.countGainableCards(player, position)) {
				return;
			}
			const next = player.gainPlayerCard(target, [1, 2], position, true);
			next.gaintag.add(tag);
			const { links } = await next.forResult();
			if (!links?.length) {
				return;
			}
			player.addSkill(tag);
			const num = links.length;
			const targetsx = game.filterPlayer(current => current != player && current != target);
			if (player.countCards("h") && targetsx.length) {
				const { bool, cards, targets } = await player
					.chooseCardTarget({
						prompt: "献酿：你可将至多" + get.cnNumber(num) + "张牌交给另一名其他角色",
						filterCard: true,
						position: "he",
						selectCard: [1, num],
						filterTarget: (card, player, target) => get.event().targetsx.includes(target),
						ai1(card) {
							if (card.name == "du") {
								return 10;
							}
							const player = get.player();
							if (
								!game.hasPlayer(current => {
									return get.attitude(player, current) > 0 && !current.hasSkillTag("nogain");
								})
							) {
								return 0;
							}
							return 1 / Math.max(0.1, get.value(card));
						},
						ai2(target) {
							let player = get.player(),
								att = get.attitude(player, target);
							if (ui.selected.cards[0].name == "du") {
								return -att;
							}
							if (target.hasSkillTag("nogain")) {
								att /= 6;
							}
							return att;
						},
						targetsx: targetsx,
					})
					.forResult();
				if (bool) {
					player.line(targets[0]);
					targets[0].addSkill(tag);
					const next = targets[0].gain(cards, player, "giveAuto");
					next.gaintag.add(tag);
					await next;
				}
			}
			if (player.getRoundHistory("gain", evt => evt.getParent(2).name == event.name).reduce((num, evt) => num + evt.cards.length, 0) > 2) {
				await player.loseHp();
			}
		},
		subSkill: {
			tag: {
				charlotte: true,
				mod: {
					cardname(card) {
						const evt = get.event();
						if (evt.name !== "chooseToUse") {
							return;
						}
						if (get.type(card, null, false) == "basic" && card.hasGaintag("dcxianniang_tag")) {
							return "jiu";
						}
					},
					cardnature(card) {
						const evt = get.event();
						if (evt.name !== "chooseToUse") {
							return;
						}
						if (get.type(card, null, false) == "basic" && card.hasGaintag("dcxianniang_tag")) {
							return false;
						}
					},
				},
				ai: {
					save: true,
					skillTagFilter(player, tag, arg) {
						if (
							!player.countCards("h", card => {
								return get.type(card, null, false) == "basic" && card.hasGaintag("dcxianniang_tag");
							})
						) {
							return false;
						}
					},
				},
			},
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	//张翼
	dcmurui: {
		//direct打赢复活赛力
		audio: 2,
		trigger: {
			global: ["roundStart", "phaseAfter"],
			player: "phaseBegin",
		},
		filter(event, player, name) {
			if (player.getStorage("dcmurui_filter").includes(name)) {
				return false;
			}
			return (name === "phaseAfter" && game.getGlobalHistory("everything", evt => evt.name == "die").length) || ["phaseBegin", "roundStart"].includes(name);
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			let name = event.triggername;
			player
				.when({ player: ["useCardAfter", "dcmurui"] }, false)
				.filter((evt, player, namex) => {
					return namex === "dcmurui" || (player.getStorage("dcmurui").includes(evt.card) && ["sourceDamage", "damage"].some(type => game.hasPlayer2(current => current.hasHistory(type, evtx => evt.card === evtx.card))));
				})
				.assign({ firstDo: true })
				.step(async (event, trigger, player) => {
					if (event.triggername === "dcmurui") {
						return;
					}
					await player.draw(2);
					player.markAuto("dcmurui_filter", name);
					player.markSkill("dcaoren");
				})
				.finish();
			const result = await player
				.chooseToUse("使用一张牌，若造成伤害则不能再于此时用牌")
				.set("oncard", () => {
					const event = get.event(),
						{ card, player } = event;
					player.markAuto("dcmurui", [card]);
				})
				.set("addCount", false)
				.set("logSkill", event.name)
				.forResult();
			await event.trigger("dcmurui");
		},
	},
	dcaoren: {
		audio: 2,
		intro: {
			markcount: (_, player) => player.getStorage("dcmurui_filter").length - player.countMark("dcaoren_used"),
			content: (_, player) => "当前剩余发动次数：" + (player.getStorage("dcmurui_filter").length - player.countMark("dcaoren_used")),
		},
		trigger: {
			player: "useCardAfter",
		},
		filter: (event, player) => player.countMark("dcaoren_used") < player.getStorage("dcmurui_filter").length && get.type(event.card) === "basic" && event.cards.filterInD().length,
		async content(event, trigger, player) {
			await player.gain(trigger.cards.filterInD(), "gain2");
			player.addMark("dcaoren_used", 1, false);
			player.addTempSkill("dcaoren_used", "roundStart");
		},
		ai: {
			combo: "dcmurui",
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	//庞宏
	dcpingzhi: {
		audio: 2,
		mark: true,
		zhuanhuanji: true,
		marktext: "☯",
		usable: 1,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return target.countCards("h");
		},
		intro: {
			content(storage) {
				return "转换技，出牌阶段限一次，你可观看一名角色的手牌并展示其中一张牌，" + (storage ? "然后其使用此牌，若此牌造成伤害" : "你弃置此牌，然后其视为对你使用一张【火攻】，若其未因此造成伤害") + "则此技能视为未发动过。";
			},
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.changeZhuanhuanji(event.name);
			const result = await player
				.choosePlayerCard(target, true, `请选择${get.translation(target)}一张手牌展示`, "visible", "h")
				.set("ai", button => {
					const { player, target } = get.event(),
						{ link } = button;
					const att = get.attitude(player, target),
						storage = player.storage.dcpingzhi,
						huogong = get.autoViewAs({ name: "huogong", isCard: true });
					if (att > 0) {
						return storage ? 6 - get.value(link) : player.getUseValue(link);
					}
					return storage ? (get.value(link) + get.effect(player, huogong, target, player) < 0 && !player.hasCard(card => get.suit(card) == get.suit(link)) ? 2 : 0) : -target.getUseValue(link);
				})
				.forResult();
			if (!result?.cards?.length) {
				return;
			}
			const { cards } = result;
			player.addTempSkill(event.name + "_check", "phaseUseAfter");
			await player.showCards(cards, `${get.translation(player)}对${get.translation(target)}发动了【评骘】`);
			if (player.storage[event.name]) {
				await target.modedDiscard(cards, player);
				const huogong = get.autoViewAs({ name: "huogong", isCard: true });
				if (target.canUse(huogong, player, false)) {
					await target.useCard(huogong, player, false);
				} else if (player.getStat("skill")[event.name]) {
					delete player.getStat("skill")[event.name];
					game.log(player, "重置了", "#g【评骘】");
				}
			} else if (target.hasUseTarget(cards[0])) {
				await target.chooseUseTarget(cards[0], true, false);
			}
		},
		ai: {
			order(item, player) {
				const storage = player.storage.dcpingzhi;
				if (!storage) {
					return game.hasPlayer(current => get.effect(current, { name: "guohe_copy2" }, player, player) + get.effect(player, { name: "huogong" }, current, player) > 0) ? 10 : 1;
				}
				return game.hasPlayer(current => get.effect(current, { name: "guohe_copy2" }, player, player) > 0 || (current.hasCard(card => current.hasValueTarget(card) > 0, "h") && get.attitude(player, current) > 0)) ? 10 : 1;
			},
			result: {
				target(player, target) {
					const storage = player.storage.dcpingzhi;
					if (!storage) {
						return !player.countCards("h") || get.effect(target, { name: "guohe_copy2" }, player, player) + get.effect(player, { name: "huogong" }, target, player) > 0 ? -1 : 0;
					}
					return get.attitude(player, target) > 0 && target.hasCard(card => target.hasValueTarget(card) > 0, "h") ? 1 : get.effect(target, { name: "guohe_copy2" }, player, player);
				},
			},
		},
		subSkill: {
			check: {
				trigger: { global: "useCardAfter" },
				filter(event, player) {
					if (!player.getStat().skill.dcpingzhi) {
						return false;
					}
					if (player.storage.dcpingzhi) {
						return event.getParent().name == "dcpingzhi" && !game.hasPlayer2(current => current.hasHistory("damage", evtx => evtx.card === event.card));
					} else {
						return event.getParent(2).name == "dcpingzhi" && game.hasPlayer2(current => current.hasHistory("damage", evtx => evtx.card === event.card));
					}
				},
				charlotte: true,
				silent: true,
				async content(event, trigger, player) {
					delete player.getStat("skill").dcpingzhi;
					game.log(player, "重置了", "#g【评骘】");
				},
			},
		},
	},
	dcgangjian: {
		audio: 2,
		trigger: {
			global: "phaseAfter",
		},
		forced: true,
		filter(event, player) {
			if (player.getHistory("damage").length) {
				return false;
			}
			let num = 0;
			game.getGlobalHistory("everything", evt => {
				return evt.name == "showCards" && evt.cards.length;
			}).forEach(evt => {
				num += evt.cards.length;
			});
			return num > 0;
		},
		async content(event, trigger, player) {
			let num = 0;
			game.getGlobalHistory("everything", evt => {
				return evt.name == "showCards" && evt.cards.length;
			}).forEach(evt => {
				num += evt.cards.length;
			});
			await player.draw(Math.min(num, 5));
		},
	},
	//乐周瑜
	dcguyin: {
		audio: 2,
		trigger: { global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter", "gameDrawBegin"] },
		filter(event, player) {
			if (event.name == "gameDraw") {
				return true;
			} else if (event.name.indexOf("lose") === 0) {
				if (event.type != "discard" || event.getlx === false || event.position !== ui.discardPile) {
					return false;
				}
			} else {
				const evtx = event.getParent();
				if (evtx.name !== "orderingDiscard") {
					return false;
				}
				const evt2 = evtx.relatedEvent || evtx.getParent();
				if (evt2.name != "useCard") {
					return false;
				}
			}
			const list = game
				.filterPlayer2(current => player != current)
				.reduce((listx, i) => {
					if (i._start_cards) {
						listx.addArray(i._start_cards);
					}
					return listx;
				}, []);
			return game.hasPlayer(current => {
				const cards = event.name == "cardsDiscard" ? event.cards.filterInD("d") : event.getl(current)?.cards2 || [];
				return cards.some(card => list.includes(card));
			});
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.name == "gameDraw") {
				const me = player;
				const numx = trigger.num;
				trigger.num = function (player) {
					return player == me ? 0 : 1 + (typeof numx == "function" ? numx(player) : numx);
				};
			} else {
				await player.draw();
			}
		},
	},
	dcpinglu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (player.hasCard(card => card.hasGaintag("dcpinglu_mark"), "h")) {
				return false;
			}
			return game.hasPlayer(current => get.info("dcpinglu").filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return player.inRange(target) && target.countGainableCards(player, "h");
		},
		selectTarget: -1,
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const gains = [];
			for (const target of event.targets.sortBySeat()) {
				const cards = target.getCards("h", card => lib.filter.canBeGained(card, target, player));
				if (cards.length) {
					gains.push(cards.randomGet());
				}
			}
			if (!gains.length) {
				return;
			}
			player.addTempSkill(event.name + "_mark", "phaseUseAfter");
			const next = player.gain(gains, "giveAuto");
			next.gaintag.add(event.name + "_mark");
			await next;
		},
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
		subSkill: {
			mark: {
				mod: {
					aiOrder(player, card, num) {
						if (
							get.itemtype(card) == "card" &&
							card.hasGaintag("dcpinglu_mark") &&
							game.hasPlayer(current => {
								return player.inRange(current) && current.countGainableCards(player, "h") && get.attitude(player, current) < 0;
							})
						) {
							return num + 0.1;
						}
					},
				},
				charlotte: true,
				onremove: (player, skill) => player.removeGaintag(skill),
			},
		},
	},
};
