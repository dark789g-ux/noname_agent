import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rezhanjue_effectSkills = {
	rezhanjue_effect: {
		audio: false,
		trigger: { player: "useCardAfter" },
		forced: true,
		popup: false,
		charlotte: true,
		sourceSkill: "rezhanjue",
		onremove(player) {
			delete player.getStat().skill.rezhanjue_draw;
		},
		filter(event, player) {
			return event.skill == "rezhanjue";
		},
		async content(event, trigger, player) {
			let stat = player.getStat().skill;
			if (!stat.rezhanjue_draw) {
				stat.rezhanjue_draw = 0;
			}
			stat.rezhanjue_draw++;
			await player.draw("nodelay");
			const list = game.filterPlayer(function (current) {
				if (
					current.getHistory("damage", function (evt) {
						return evt.card == trigger.card;
					}).length > 0
				) {
					if (current == player) {
						stat.rezhanjue_draw++;
					}
					return true;
				}
				return false;
			});
			if (list.length) {
				list.sortBySeat();
				await game.asyncDraw(list);
			}
			game.delay();
		},
	},
	reqinwang: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		zhuSkill: true,
		filter(event, player) {
			if (!player.hasZhuSkill("reqinwang")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return current != player && current.group == "shu" && player.hasZhuSkill("reqinwang", current);
			});
		},
		selectTarget: -1,
		filterTarget(card, player, current) {
			return current != player && current.group == "shu" && player.hasZhuSkill("reqinwang", current);
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (
				target.hasCard(function (card) {
					return _status.connectMode || get.name(card, target) == "sha";
				}, "h")
			) {
				const result = await target
					.chooseCard(
						"是否交给" + get.translation(player) + "一张【杀】？",
						function (card, player) {
							return get.name(card, player) == "sha";
						},
						"h"
					)
					.set("goon", get.attitude(target, player) > 0)
					.set("ai", function (card) {
						return _status.event.goon ? 1 : 0;
					})
					.forResult();
				if (result?.bool) {
					const card = result.cards[0];
					await target.give(card, player).set("gaintag", ["reqinwang"]);
					player.addTempSkill("reqinwang_clear");
					const result2 = await player.chooseBool("是否令" + get.translation(target) + "摸一张牌？").forResult();
					if (result2?.bool) {
						await target.draw();
					}
				}
			}
		},
		ai: {
			order: 5,
			result: { player: 1 },
		},
		subSkill: {
			clear: {
				charlotte: true,
				onremove(player) {
					player.removeGaintag("reqinwang");
				},
			},
		},
	},
	//公孙瓒
	dcqiaomeng: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!event.isFirstTarget || get.color(event.card) != "black") {
				return false;
			}
			for (var i of event.targets) {
				if (
					i != player &&
					i.hasCard(function (card) {
						return lib.filter.canBeDiscarded(card, player, i);
					}, "he")
				) {
					return true;
				}
			}
			return false;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt("dcqiaomeng"), "选择一名不为自己的目标角色，然后弃置其一张牌。若以此法弃置的牌为：装备牌，你获得此牌；锦囊牌，你令" + get.translation(trigger.card) + "不可被响应。", function (card, player, target) {
					return (
						target != player &&
						_status.event.getTrigger().targets.includes(target) &&
						target.hasCard(function (card) {
							return lib.filter.canBeDiscarded(card, player, target);
						}, "he")
					);
				})
				.set("ai", function (target) {
					const player = _status.event.player;
					return get.effect(target, { name: "guohe_copy2" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const result = await player.discardPlayerCard(target, true, "he").forResult();
			if (result?.bool && result.cards?.length) {
				//为了体现白马义从野性纯真的美 直接获取卡牌原类型 不考虑维系区域
				const card = result.cards[0],
					type = get.type2(card, false);
				if (type == "trick") {
					trigger.directHit.addArray(game.filterPlayer(current => current != player));
				}
				if (type == "equip" && get.position(card, true) == "d") {
					await player.gain(card, "gain2");
				}
			}
		},
	},
	//杜畿
	reandong: {
		audio: 2,
		trigger: { player: "damageBegin2" },
		filter(event, player) {
			return event.source && event.source.isIn() && event.source != player;
		},
		logTarget: "source",
		async content(event, trigger, player) {
			const target = trigger.source,
				bool = player.storage.reandong;
			let str = get.translation(player),
				result;
			if (bool) {
				str = "自己";
			}
			let choiceList = ["防止" + str + "即将受到的伤害，且本回合内红桃牌不计入" + (bool ? get.translation(target) : "自己") + "的手牌上限。"];
			if (!target.countCards("h")) {
				choiceList.push("令" + str + "下次发动〖安东〗时改为自行选择");
			} else {
				choiceList.push("令" + str + "观看你的手牌并获得所有红桃牌");
			}
			if (bool) {
				delete player.storage.reandong;
				result = await player.chooseControl().set("choiceList", choiceList).set("prompt", "安东：请选择一项").forResult();
			} else {
				result = await target
					.chooseControl()
					.set("choiceList", choiceList)
					.set("prompt", "安东：请选择一项")
					.set("ai", function (event, target) {
						const player = event.player;
						const trigger = event.getTrigger();
						if (get.attitude(target, player) > 0) {
							return 0;
						}
						const hs = target.getGainableCards(player, "h", card => get.suit(card) == "heart");
						if (hs.length) {
							const recover = hs.filter(card => get.tag(card, "save") || get.tag(card, "recover")).length;
							if (trigger.num <= recover) {
								return 0;
							}
						}
						return 1;
					})
					.forResult();
			}
			if (result?.index == 0) {
				target.addTempSkill("reandong_ignore");
				trigger.cancel();
				await game.delayx();
			} else {
				if (!target.countCards("h")) {
					player.storage.reandong = true;
					await game.delayx();
				} else {
					await player.viewHandcards(target);
					const cards = target.getCards("h", function (card) {
						return get.suit(card, target) == "heart";
					});
					if (cards.length > 0) {
						await player.gain(cards, target, "give", "bySelf");
					}
				}
			}
		},
		ai: {
			maixie: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1];
					}
					if (get.tag(card, "damage") && player != target && get.attitude(player, target) < 0) {
						let cards = player.getCards("h", function (cardx) {
							return card != cardx && (!card.cards || !card.cards.includes(cardx)) && get.suit(cardx) == "heart";
						});
						if (!cards.length) {
							return;
						}
						const recover = cards.filter(card => get.tag(card, "save") || get.tag(card, "recover")).length;
						if (recover >= target.getDamagedHp()) {
							let eff = player.needsToDiscard(0, (card, player) => get.suit(card) != "heart" || !player.canIgnoreHandcard(card));
							return [0, 0, 0, eff / 10];
						}
						const val = get.value(cards, target);
						if (val >= 6 + target.getDamagedHp()) {
							return [1, val / 10, 1, -val / 10];
						}
						return [1, 0.6];
					}
				},
			},
		},
		subSkill: {
			ignore: {
				mod: {
					ignoredHandcard(card, player) {
						if (get.suit(card) == "heart") {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && get.suit(card) == "heart") {
							return false;
						}
					},
				},
				charlotte: true,
				marktext: "♥",
				intro: "红桃牌于本回合内不计入手牌上限",
			},
		},
	},
	reyingshi: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			return player.countCards("h") > 0 && game.countPlayer() > 1;
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseCardTarget({
					prompt: get.prompt("reyingshi"),
					prompt2: "操作提示：选择一张作为赏金的手牌，然后选择作为赏金猎人的角色A和作为出杀目标的其他角色B",
					filterCard: true,
					selectTarget: 2,
					position: "h",
					filterTarget(card, player, target) {
						if (!ui.selected.targets.length) {
							return true;
						}
						return target != player;
					},
					complexTarget: true,
					targetprompt: ["出杀", "被杀"],
					complexSelect: true,
					ai1(card) {
						return 1 / Math.max(1, get.value(card));
					},
					ai2(target) {
						var player = _status.event.player;
						if (!ui.selected.targets.length) {
							var att = get.attitude(player, target);
							if (att < 0) {
								return 0;
							}
							if (target.hasSha()) {
								return Math.pow(target.countCards("h") + 1, 1.1) * (player == target ? 3 : 1);
							}
							return Math.sqrt(1 + target.countCards("h"));
						}
						return get.effect(target, { name: "sha" }, ui.selected.targets[0], player);
					},
				})
				.forResult();
			if (result?.bool) {
				const targets = result.targets;
				player.logSkill("reyingshi", targets[1]);
				const card = result.cards[0];
				player.showCards(card, get.translation(player) + "对" + get.translation(targets[1]) + "发动了【应势】");
				player.line(targets[0], "fire");

				const next = targets[0].chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.cardEnabled.apply(this, arguments) && lib.filter.targetEnabled(card, player, (event || _status.event).sourcex);
					},
					"###是否对" + get.translation(targets[1]) + "使用一张【杀】？###若选择使用，则获得赏金（" + get.translation(card) + "）。若造成伤害，则再从牌堆中获得与此牌花色点数相同的牌作为额外赏金。"
				);
				next.set("addCount", false);
				next.set("complexSelect", true);
				next.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.targetEnabled.apply(this, arguments);
				});
				next.set("sourcex", targets[1]);
				const result2 = await next.forResult();

				const target = targets[0];
				if (result2?.bool && target.isIn()) {
					let cards = [],
						slice = 0;
					if (player != target && player.getCards("h").includes(card)) {
						cards.push(card);
						slice++;
					}
					if (
						target.hasHistory("useCard", function (evt) {
							if (evt.getParent(2) != event) {
								return false;
							}
							return target.hasHistory("sourceDamage", function (evtx) {
								return evtx.card == evt.card;
							});
						})
					) {
						const suit = get.suit(card),
							number = get.number(card);
						cards.addArray(
							Array.from(ui.cardPile.childNodes).filter(cardx => {
								if (cardx.suit == suit && cardx.number == number) {
									return true;
								}
							})
						);
						if (cards.length > 0) {
							if (!slice) {
								await target.gain(cards, "gain2");
							} else {
								setTimeout(
									function () {
										target.$gain2(cards.slice(slice), true);
									},
									get.delayx(200, 200)
								);
								await target.gain(cards, player, "give");
							}
						}
					} else {
						if (cards.length > 0) {
							await target.gain(cards, player, "give");
						}
					}
				}
			}
		},
	},
};
