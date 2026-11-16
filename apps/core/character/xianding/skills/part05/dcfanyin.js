import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcfanyin" | "dcpeiqi" | "dcwanglu" | "dcxianzhu" | "dcchaixie" | "dagongche_skill">} */
export const groupSkills = {
	//杜夔
	dcfanyin: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return ui.cardPile.childNodes.length > 0;
		},
		frequent: true,
		async content(event, trigger, player) {
			while (true) {
				let card = false;
				if (typeof event.numx != "number") {
					let num = false;
					for (let i = 0; i < ui.cardPile.childNodes.length; i++) {
						const cardx = ui.cardPile.childNodes[i],
							numc = get.number(cardx, false);
						if (!num || numc < num) {
							num = numc;
							card = cardx;
							if (num == 1) break;
						}
					}
					event.numx = num;
				} else {
					card = get.cardPile2(card => {
						return get.number(card, false) == event.numx;
					});
					if (!card) {
						let closestNum;
						for (let i = event.numx + 1; i <= 13; i++) {
							card = get.cardPile2(card => {
								return get.number(card, false) == i;
							});
							if (card) {
								closestNum = i;
								break;
							}
						}
						if (closestNum) {
							event.numx = closestNum;
						}
					}
				}
				if (!card) return;
				event.card = card;
				await game.cardsGotoOrdering(card);
				await player.showCards(card, get.translation(player) + "发动了【泛音】");
				let result = !player.hasUseTarget(card, false)
					? { index: 1 }
					: await player
							.chooseControl()
							.set("choiceList", [`使用${get.translation(card)}（无距离限制）`, "令本回合使用的下一张牌可以多选择一个目标（有距离限制）"])
							.set("ai", () => {
								const player = get.player(),
									{ card } = get.event().getParent();
								if (player.hasValueTarget(card, false)) return 0;
								return 1;
							})
							.forResult();
				if (typeof result?.index == "number") {
					if (result.index == 0) {
						const cardx = get.autoViewAs(card);
						await player.chooseUseTarget(cardx, [card], true, false, "nodistance");
					} else {
						player.addTempSkill(event.name + "_effect");
						player.addMark(event.name + "_effect", 1, false);
					}
					event.numx *= 2;
					if (event.numx > 13) break;
				} else break;
			}
		},
		subSkill: {
			effect: {
				audio: "dcfanyin",
				trigger: { player: "useCard2" },
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return ["basic", "trick"].includes(get.type(event.card, null, false));
				},
				async cost(event, trigger, player) {
					const num = player.countMark(event.skill);
					player.removeSkill(event.skill);
					let goon = false;
					const info = get.info(trigger.card);
					if (info.allowMultiple == false) return;
					if (trigger.targets && !info.multitarget) {
						if (
							game.hasPlayer(current => {
								return !trigger.targets.includes(current) && lib.filter.targetEnabled2(trigger.card, player, current) && lib.filter.targetInRange(trigger.card, player, current);
							})
						) {
							goon = true;
						}
					}
					if (!goon) return;
					event.result = await player
						.chooseTarget(get.prompt(event.skill), `为${get.translation(trigger.card)}增加至多${get.cnNumber(num)}个目标`, [1, num], (card, player, target) => {
							const evt = get.event().getTrigger();
							return !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
						})
						.set("ai", target => {
							return get.effect(target, get.event().getTrigger().card, get.player());
						})
						.forResult();
				},
				async content(event, trigger, player) {
					if (!event.isMine() && !event.isOnline()) await game.delayx();
					game.log(event.targets, "也成为了", trigger.card, "的目标");
					trigger.targets.addArray(event.targets);
				},
				intro: { content: "使用下一张牌选择目标后，可以增加#个目标" },
			},
		},
	},
	dcpeiqi: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return player.canMoveCard();
		},
		check(event, player) {
			return player.canMoveCard(true);
		},
		content() {
			"step 0";
			player.moveCard(true);
			"step 1";
			if (result.bool && player.canMoveCard()) {
				var goon = true,
					players = game.filterPlayer();
				for (var i = 0; i < players.length; i++) {
					for (var j = i + 1; j < players.length; j++) {
						if (!players[i].inRange(players[j]) || !players[i].inRangeOf(players[j])) {
							goon = false;
							break;
						}
					}
					if (!goon) {
						break;
					}
				}
				if (goon) {
					player.moveCard();
				}
			}
		},
	},
	//张奋和大风车
	dcwanglu: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		content() {
			if (!player.hasEquipableSlot(5) || player.getEquip("dagongche")) {
				const evt = trigger.getParent("phase", true, true);
				if (evt?.phaseList) {
					evt.phaseList.splice(evt.num + 1, 0, `phaseUse|${event.name}`);
				}
			} else {
				var card = game.createCard("dagongche", "spade", 9);
				player.$gain2(card);
				game.delayx();
				player.equip(card);
			}
		},
		broadcast(player) {
			var card = player.getEquip("dagongche");
			if (card) {
				game.broadcast(
					function (card, storage) {
						card.storage = storage;
					},
					card,
					card.storage
				);
			}
		},
	},
	dcxianzhu: {
		audio: 2,
		trigger: { source: "damageSource" },
		direct: true,
		filter(event, player) {
			if (!event.card || event.card.name != "sha") {
				return false;
			}
			var card = player.getEquip("dagongche");
			if (!card) {
				return false;
			}
			var num = 0;
			for (var i = 1; i <= 3; i++) {
				var key = "大攻车选项" + get.cnNumber(i, true);
				if (card.storage[key]) {
					num += card.storage[key];
				}
			}
			return num < 5;
		},
		content() {
			"step 0";
			var choiceList = ["令【杀】无距离限制且无视防具", "令【杀】的可选目标数+1", "令后续的弃牌数量+1"];
			var list = [];
			var card = player.getEquip("dagongche");
			for (var i = 1; i <= 3; i++) {
				var key = "大攻车选项" + get.cnNumber(i, true);
				var num = card.storage[key];
				if (i == 1) {
					if (!num) {
						list.push("选项一");
					} else {
						choiceList[0] = '<span style="opacity:0.5; ">' + choiceList[0] + "（已强化）</span>";
					}
				} else {
					list.push("选项" + get.cnNumber(i, true));
					if (num) {
						choiceList[i - 1] += "（已强化" + num + "次）";
					}
				}
			}
			player
				.chooseControl(list, "cancel2")
				.set("prompt", "是否发动【陷筑】强化【大攻车】？")
				.set("choiceList", choiceList)
				.set("ai", function () {
					var player = _status.event.player,
						controls = _status.event.controls.slice(0);
					var getval = function (choice) {
						var card = player.getEquip("dagongche");
						if (choice == "选项一") {
							card.storage.大攻车选项一 = 1;
							var goon = false;
							if (
								game.hasPlayer(function (current) {
									var eff1 = 0,
										eff2 = 0;
									var cardx = { name: "sha", isCard: true };
									if (player.canUse(cardx, current)) {
										eff1 = get.effect(current, cardx, player, player);
									}
									cardx.storage = { dagongche: true };
									if (player.canUse(cardx, current)) {
										eff2 = get.effect(current, cardx, player, player);
									}
									return eff2 > eff1;
								})
							) {
								goon = true;
							}
							delete card.storage.大攻车选项一;
							if (goon) {
								return 5;
							}
							return 0;
						} else if (choice == "选项二") {
							var num = 1;
							if (card.storage.大攻车选项二) {
								num += card.storage.大攻车选项二;
							}
							var cardx = { name: "sha", isCard: true };
							if (
								game.countPlayer(function (current) {
									return player.canUse(cardx, current) && get.effect(current, cardx, player, player) > 0;
								}) > num
							) {
								return 2;
							}
						} else if (choice == "选项三") {
							return 1;
						}
						return 0;
					};
					var eff = 0,
						current = "cancel2";
					for (var i of controls) {
						var effx = getval(i);
						if (effx > eff) {
							eff = effx;
							current = i;
						}
					}
					return current;
				});
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("dcxianzhu");
				var card = player.getEquip("dagongche"),
					key = "大攻车" + result.control;
				if (!card.storage[key]) {
					card.storage[key] = 0;
				}
				card.storage[key]++;
				lib.skill.dcwanglu.broadcast(player);
			}
		},
		ai: {
			combo: "dcwanglu",
		},
	},
	dcchaixie: {
		audio: 2,
		trigger: {
			player: ["loseAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		forced: true,
		filter(event, player) {
			var evt = event.getl(player);
			if (!evt || !evt.es || !evt.es.length) {
				return false;
			}
			for (var card of evt.es) {
				if (card.name == "dagongche") {
					for (var i = 1; i <= 3; i++) {
						if (card.storage["大攻车选项" + get.cnNumber(i, true)]) {
							return true;
						}
					}
				}
			}
			return false;
		},
		content() {
			var num = 0;
			var evt = trigger.getl(player);
			for (var card of evt.es) {
				if (card.name == "dagongche") {
					for (var i = 1; i <= 3; i++) {
						var key = "大攻车选项" + get.cnNumber(i, true);
						if (card.storage[key]) {
							num += card.storage[key];
						}
					}
				}
			}
			player.draw(num);
		},
		ai: {
			combo: "dcwanglu",
		},
	},
	dagongche_skill: {
		trigger: { player: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			var cardx = {
				name: "sha",
				isCard: true,
				storage: { dagongche: true },
			};
			return player.hasUseTarget(cardx);
		},
		equipSkill: true,
		content() {
			var card = {
				name: "sha",
				isCard: true,
				storage: { dagongche: true },
			};
			lib.skill.dcwanglu.broadcast(player);
			player.chooseUseTarget(card, "大攻车：是否视为使用【杀】？", false).logSkill = "dagongche_skill";
		},
		mod: {
			targetInRange(card, player, target) {
				if (card.storage && card.storage.dagongche) {
					var cardx = player.getEquip("dagongche");
					if (cardx && cardx.storage.大攻车选项一) {
						return true;
					}
				}
			},
			selectTarget(card, player, range) {
				if (card.storage && card.storage.dagongche && range[1] != -1) {
					var cardx = player.getEquip("dagongche");
					if (cardx && cardx.storage.大攻车选项二) {
						range[1] += cardx.storage.大攻车选项二;
					}
				}
			},
			canBeDiscarded(card, player, target) {
				if (card.name == "dagongche" && get.position(card) == "e" && player != target) {
					for (var i = 1; i <= 3; i++) {
						if (card.storage["大攻车选项" + get.cnNumber(i, true)]) {
							return;
						}
					}
					return false;
				}
			},
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (!arg || !arg.card || !arg.card.storage || !arg.card.storage.dagongche) {
					return false;
				}
				var card = player.getEquip("dagongche");
				if (!card || !card.storage.大攻车选项一) {
					return false;
				}
			},
		},
		group: "dagongche_skill_discard",
		subSkill: {
			discard: {
				trigger: { source: "damageSource" },
				equipSkill: true,
				forced: true,
				filter(event, player) {
					if (!event.card || !event.card.storage || !event.card.storage.dagongche) {
						return false;
					}
					if (event.getParent().type != "card") {
						return false;
					}
					return event.player.hasCard(function (card) {
						return lib.filter.canBeDiscarded(card, event.player, player);
					}, "he");
				},
				logTarget: "player",
				content() {
					var num = 1;
					var cardx = player.getEquip("dagongche");
					if (cardx && cardx.storage.大攻车选项三) {
						num += cardx.storage.大攻车选项三;
					}
					player.discardPlayerCard(trigger.player, true, num, "he");
				},
			},
		},
	},
};
