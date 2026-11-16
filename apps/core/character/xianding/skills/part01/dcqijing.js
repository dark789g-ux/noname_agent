import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcqijing" | "dccuixin" | "yizhao" | "sijun" | "sanshou" | "tianjie">} */
export const groupSkills = {
	dcqijing: {
		derivation: "dccuixin",
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return player.getStorage("dctuoyu").length == 3;
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "orange",
		seatRelated: "changeSeat",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.loseMaxHp();
			player.addSkills("dccuixin");
			if (game.countPlayer() > 2) {
				if (player == trigger.player && !trigger.skill) {
					var evt = trigger.getParent();
					if (evt.name == "phaseLoop" && evt._isStandardLoop) {
						evt.player = player.previous;
						_status.lastPhasedPlayer = player.next;
					}
				}
				var result = await player
					.chooseTarget(
						"请选择一名要更换座次的角色，将自己移动到该角色的上家位置",
						function (card, player, target) {
							return target != player && target != player.next;
						},
						true
					)
					.set("ai", function (target) {
						var player = _status.event.player;
						var current = _status.currentPhase?.next;
						var max = 20,
							att = 0;
						while (max > 0) {
							max--;
							if (current == target) {
								return att;
							}
							att -= get.attitude(player, current);
							current = current.next;
						}
						return att;
					})
					.forResult();
				if (result.bool) {
					var target = result.targets[0];
					game.broadcastAll(
						function (target1, target2) {
							game.swapSeat(target1, target2, null, true);
						},
						player,
						target
					);
				}
			}
			player.insertPhase();
		},
		ai: {
			combo: "dctuoyu",
		},
	},
	dccuixin: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (!event._dccuixin || get.type(event.card, null, false) == "delay" || get.type(event.card, null, false) == "equip") {
				return false;
			}
			var card = {
					name: event.card.name,
					nature: event.card.nature,
					isCard: true,
				},
				list = event._dccuixin;
			for (var target of list) {
				var targetx = player[target]();
				if (lib.filter.targetEnabled2(card, targetx, player)) {
					return true;
				}
			}
			return false;
		},
		direct: true,
		async content(event, trigger, player) {
			const card = {
				name: trigger.card.name,
				nature: trigger.card.nature,
				isCard: true,
			};
			event.card = card;

			const targets = trigger._dccuixin.map(target => player[target]()).filter(target => lib.filter.targetEnabled2(card, target, player));
			let result;
			if (targets.length == 1) {
				event.target = targets[0];
				result = await player
					.chooseBool("摧心：是否视为对" + get.translation(event.target) + "使用" + get.translation(card) + "？")
					.set("goon", get.effect(event.target, card, player, player) > 0)
					.set("ai", () => get.event().goon)
					.forResult();
			} else {
				result = await player
					.chooseTarget("摧心：是否视为对上家或下家使用" + get.translation(card) + "？", "操作提示：从上家或下家中选择一名角色作为使用目标", (card, player, target) => {
						return (target == player.getNext() || target == player.getPrevious()) && lib.filter.targetEnabled2(event.card, target, player);
					})
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, event.card, player, player);
					})
					.forResult();
			}
			if (result.bool) {
				const target = event.target || result.targets;
				player.useCard(card, target, false, "dccuixin");
			}
		},
		group: "dccuixin_silent",
		subSkill: {
			silent: {
				trigger: { player: "useCardToPlayered" },
				silent: true,
				forced: true,
				popup: false,
				firstDo: true,
				charlotte: true,
				filter(event, player) {
					if (!event.isFirstTarget || event.getParent().skill == "dccuixin") {
						return false;
					}
					if (event.targets.length == 0) {
						return false;
					}
					return event.targets.includes(player.getNext()) || event.targets.includes(player.getPrevious());
				},
				async content(event, trigger, player) {
					var list = [];
					if (trigger.targets.includes(player.getNext())) {
						list.push("getPrevious");
					}
					if (trigger.targets.includes(player.getPrevious())) {
						list.push("getNext");
					}
					trigger.getParent()._dccuixin = list;
				},
			},
		},
	},
	//神张角
	yizhao: {
		audio: 2,
		trigger: {
			player: ["useCard", "respond"],
		},
		forced: true,
		filter(event, player) {
			const number = get.number(event.card);
			return typeof number == "number" && number > 0;
		},
		marktext: "黄",
		intro: {
			name: "黄(异兆/肆军)",
			name2: "黄",
			content: "mark",
			markcount(storage, player) {
				return (storage || 0).toString().slice(-2);
			},
		},
		async content(event, trigger, player) {
			event.num = player.countMark("yizhao");
			player.addMark("yizhao", get.number(trigger.card));
			const num = Math.floor(event.num / 10) % 10;
			const num2 = Math.floor(player.countMark("yizhao") / 10) % 10;
			if (num != num2) {
				const card = get.cardPile2(card => {
					return get.number(card, false) == num2;
				});
				if (card) {
					await player.gain(card, "gain2");
				}
			}
		},
		mod: {
			aiOrder(player, card, num) {
				if (Math.floor((get.number(card) + (player.countMark("yizhao") % 10)) / 10) == 1) {
					return num + 10;
				}
			},
		},
		ai: {
			threaten: 1.5,
			effect: {
				target_use(card, player, target, current) {
					if (get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						return [1, 0.1];
					}
				},
			},
		},
	},
	sijun: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countMark("yizhao") > ui.cardPile.childNodes.length;
		},
		check(event, player) {
			return ui.cardPile.childNodes.length;
		},
		async content(event, trigger, player) {
			player.removeMark("yizhao", player.countMark("yizhao"));
			await game.washCard();
			const pile = Array.from(ui.cardPile.childNodes);
			if (pile.length < 3) {
				return;
			}
			const max = Math.pow(2, Math.min(100, pile.length));
			let bool = false;
			let index;
			for (let i = 0; i < max; i++) {
				let num = 0;
				index = i.toString(2);
				while (index.length < pile.length) {
					index = "0" + index;
				}
				for (var k = 0; k < index.length; k++) {
					if (index[k] == "1") {
						num += get.number(pile[k]);
					}
					if (num > 36) {
						break;
					}
				}
				if (num == 36) {
					bool = true;
					break;
				}
			}
			if (bool) {
				const cards = [];
				for (let i = 0; i < index.length; i++) {
					if (index[i] == "1") {
						cards.push(pile[i]);
					}
				}
				await player.gain(cards, "gain2");
			}
		},
		ai: {
			combo: "yizhao",
		},
	},
	sanshou: {
		audio: 2,
		trigger: { player: "damageBegin4" },
		check(event, player) {
			return get.damageEffect(player, event.source, player, event.nature) <= 0;
		},
		async content(event, trigger, player) {
			const cards = game.cardsGotoOrdering(get.cards(3)).cards;
			event.cards = cards;
			await player.showCards(cards, get.translation(player) + "发动了【三首】");

			const types = [];
			types.addArray(game.getGlobalHistory("useCard").map(evt => get.type2(evt.card)));
			if (cards.filter(card => !types.includes(get.type2(card))).length) {
				trigger.cancel();
			}
			await game.delayx();
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (card.name == "shandian" || card.name == "fulei") {
						return [0, 0.1];
					}
					if (!get.tag(card, "damage")) {
						return;
					}
					var types = [],
						bool = 0;
					types.addArray(game.getGlobalHistory("useCard").map(evt => get.type2(evt.card)));
					if (!types.includes(get.type2(card))) {
						bool = 1;
					}
					if (types.length < 2) {
						return Math.min(1, 0.4 + (types.length + bool) * 0.2);
					}
				},
			},
		},
	},
	tianjie: {
		audio: 3,
		trigger: { global: "phaseEnd" },
		direct: true,
		filter(event, player) {
			return game.hasGlobalHistory("cardMove", evt => evt.washCard) && game.hasPlayer(current => current != player);
		},
		skillAnimation: true,
		animationColor: "metal",
		async content(event, trigger, player) {
			const next = player.chooseTarget(get.prompt("tianjie"), "选择至多三名其他角色，依次对这些角色造成X点雷电伤害（X为其手牌中【闪】的数量，至少为1）", [1, 3], lib.filter.notMe);
			next.set("ai", target => {
				const player = get.player();
				return get.damageEffect(target, player, player, "thunder") * Math.sqrt(Math.max(1, target.countCards("h", "shan")));
			});

			const result = await next.forResult();
			if (result.bool && result.targets?.length) {
				const targets = result.targets;
				targets.sortBySeat();
				player.logSkill("tianjie", targets);

				const events = [];
				for (const target of targets) {
					const num = Math.max(1, target.countCards("h", "shan"));
					const next = target.damage(num, "thunder");
					events.push(next);
				}

				await Promise.all(events);
			}
		},
	},
};
