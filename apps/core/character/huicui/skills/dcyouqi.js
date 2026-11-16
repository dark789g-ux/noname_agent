import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcyouqi" | "dcqinshen" | "dcweidang" | "dcneifa" | "dcneifa_basic" | "dcneifa_trick">} */
export const groupSkills = {
	dcyouqi: {
		audio: 2,
		trigger: { global: "loseAfter" },
		filter(event, player) {
			if (event.getParent(3).name.indexOf("dcyinlu_") != 0 || player == event.player) {
				return false;
			}
			return true;
		},
		derivation: "dcyouqi_faq",
		direct: true,
		forced: true,
		async content(event, trigger, player) {
			if (Math.random() < 1.25 - 0.25 * get.distance(player, trigger.player) || get.isLuckyStar(player)) {
				player.logSkill("dcyouqi");
				player.gain(trigger.cards.filterInD("d"), "gain2");
			}
		},
		ai: {
			combo: "dcyinlu",
		},
	},
	//孙资刘放
	dcqinshen: {
		audio: 2,
		trigger: { player: "phaseDiscardEnd" },
		frequent: true,
		prompt2() {
			return "摸" + get.cnNumber(lib.skill.dcqinshen.getNum()) + "张牌";
		},
		getNum() {
			const list = lib.suit.slice();
			const suit = get.discarded().map(c => get.suit(c, false));
			list.removeArray(suit);
			return list.length;
		},
		filter(event, player) {
			return lib.skill.dcqinshen.getNum() > 0;
		},
		async content(event, trigger, player) {
			await player.draw(lib.skill.dcqinshen.getNum());
		},
	},
	dcweidang: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		/**
		 * @deprecated
		 */
		getLength: card => get.cardNameLength(card),
		filter(event, player) {
			const num = lib.skill.dcqinshen.getNum();
			return event.player != player && (_status.connectMode ? player.countCards("he") : player.hasCard(card => get.cardNameLength(card) == num, "he"));
		},
		async cost(event, trigger, player) {
			const num = lib.skill.dcqinshen.getNum();
			event.result = await player
				.chooseCard(get.prompt(event.skill), "将一张字数为" + num + "的牌置于牌堆底，然后获得一张字数为" + num + "的牌。若你能使用此牌，你使用之。", "he", (card, player, target) => {
					return get.cardNameLength(card) == _status.event.num;
				})
				.set("num", num)
				.set("ai", card => {
					return 5 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			const num = lib.skill.dcqinshen.getNum();
			game.broadcastAll(function (player) {
				const cardx = ui.create.card();
				cardx.classList.add("infohidden");
				cardx.classList.add("infoflip");
				player.$throw(cardx, 1000, "nobroadcast");
			}, player);
			await player.lose(cards, ui.cardPile);
			await game.delayx();
			const card = get.cardPile(cardx => get.cardNameLength(cardx) == num);
			if (card) {
				await player.gain(card, "gain2");
				if (player.hasUseTarget(card)) {
					await player.chooseUseTarget(card, true);
				}
			}
		},
	},
	//三袁
	dcneifa: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		async content(event, trigger, player) {
			await player.draw(3);
			const result = await player
				.chooseToDiscard(true, "he")
				.set("ai", function (cardx) {
					const player = _status.event.player;
					let num = 0;
					let hs = player.getCards("h");
					const muniu = player.getEquip("muniu");
					if (muniu && muniu.cards) {
						hs = hs.concat(muniu.cards);
					}
					if (get.type(cardx) == "basic") {
						const shas = hs.filter(function (card) {
							return card != cardx && get.name(card, player) == "sha" && player.hasValueTarget(card, false);
						});
						const numx = player.countCards("h", function (card) {
							return get.type2(card, player) == "trick";
						});
						num += Math.min(numx, Math.max(0, shas.length - player.getCardUsable("sha"))) * 0.65;
						num +=
							Math.min(
								player.getCardUsable("sha") + numx,
								shas.filter(function (card) {
									return (
										game.countPlayer(function (current) {
											return player.canUse(card, current) && get.effect(current, card, player, player) > 0;
										}) > 1
									);
								}).length
							) * 1.1;
						const taos = Math.min(
							player.maxHp - player.hp,
							hs.filter(function (card) {
								return cardx != card && get.name(card, player) == "tao";
							}).length
						);
						num += taos * player.getDamagedHp() * 1.2;
					} else if (get.type2(cardx) == "trick") {
						const numx = Math.sqrt(
							Math.min(
								5,
								player.countCards("h", function (card) {
									return get.type(card, null, player) == "basic";
								})
							)
						);
						num +=
							hs.filter(function (card) {
								return card != cardx && get.type2(card) == "trick" && player.hasValueTarget(card);
							}).length * 0.65;
					} else {
						num = 4;
					}
					return num * 1.5 - get.value(cardx);
				})
				.forResult();
			if (result.bool && result.cards && result.cards.length && get.type(result.cards[0]) != "equip") {
				const name = get.type(result.cards[0]) == "basic" ? "dcneifa_basic" : "dcneifa_trick";
				player.addTempSkill(name, "phaseUseAfter");
				const num = Math.min(
					5,
					player.countCards("h", function (cardx) {
						const type = get.type(cardx, null, player);
						return (name == "dcneifa_basic") != (type == "basic") && type != "equip";
					})
				);
				if (num > 0) {
					player.addMark(name, num, false);
				} else {
					player.storage[name] = 0;
				}
			}
		},
		ai: {
			threaten: 2.33,
		},
	},
	dcneifa_basic: {
		mark: true,
		marktext: "伐",
		onremove: true,
		intro: {
			name: "内伐 - 基本牌",
			content: "本回合内不能使用锦囊牌，使用【杀】选择目标时可以额外指定一个目标且使用【杀】的目标次数上限+#。",
		},
		mod: {
			cardEnabled(card, player) {
				if (get.type(card, "trick") == "trick") {
					return false;
				}
			},
			cardSavable(card, player) {
				if (get.type(card, "trick") == "trick") {
					return false;
				}
			},
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + player.countMark("dcneifa_basic");
				}
			},
		},
		trigger: { player: "useCard2" },
		sourceSkill: "dcneifa",
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return game.hasPlayer(function (current) {
				return !event.targets.includes(current) && player.canUse(event.card, current, false);
			});
		},
		direct: true,
		async content(event, trigger, player) {
			let result;
			result = await player
				.chooseTarget(get.prompt("dcneifa"), "为" + get.translation(trigger.card) + "额外指定一个目标", (card, currentPlayer, target) => {
					return !trigger.targets.includes(target) && currentPlayer.canUse(trigger.card, target, false);
				})
				.set("sourcex", trigger.targets)
				.set("ai", target => get.effect(target, trigger.card, player, player))
				.set("card", trigger.card)
				.forResult();
			if (!result.bool) {
				return;
			}
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			event.targets = result.targets;
			player.logSkill("dcneifa", event.targets);
			trigger.targets.addArray(event.targets);
		},
	},
	dcneifa_trick: {
		trigger: { player: "useCard2" },
		direct: true,
		mark: true,
		marktext: "伐",
		onremove: true,
		mod: {
			cardEnabled(card, player) {
				if (get.type(card) == "basic") {
					return false;
				}
			},
			cardSavable(card, player) {
				if (get.type(card) == "basic") {
					return false;
				}
			},
		},
		intro: {
			name: "内伐 - 锦囊牌",
			content: "本回合内不能使用基本牌，且使用普通锦囊牌选择目标时可以增加或减少一个目标。",
		},
		sourceSkill: "dcneifa",
		filter(event, player) {
			if (get.type(event.card) != "trick") {
				return false;
			}
			if (event.targets && event.targets.length > 0) {
				return true;
			}
			var info = get.info(event.card);
			if (info.allowMultiple == false) {
				return false;
			}
			if (event.targets && !info.multitarget) {
				if (
					game.hasPlayer(function (current) {
						return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current);
					})
				) {
					return true;
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			const prompt2 = "为" + get.translation(trigger.card) + "增加或减少一个目标";
			const result = await player
				.chooseTarget(get.prompt("dcneifa"), function (card, player, target) {
					player = _status.event.player;
					if (_status.event.targets.includes(target)) {
						return true;
					}
					return lib.filter.targetEnabled2(_status.event.card, player, target);
				})
				.set("prompt2", prompt2)
				.set("ai", function (target) {
					const trigger = _status.event.getTrigger();
					const player = _status.event.player;
					return get.effect(target, trigger.card, player, player) * (_status.event.targets.includes(target) ? -1 : 1);
				})
				.set("targets", trigger.targets)
				.set("card", trigger.card)
				.forResult();
			if (!result.bool) {
				return;
			}
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			const targets = result.targets;
			player.logSkill("dcneifa", targets);
			if (trigger.targets.includes(targets[0])) {
				trigger.targets.removeArray(targets);
			} else {
				trigger.targets.addArray(targets);
			}
		},
	},
};
