import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinanguo" | "pindi" | "funan" | "jiexun" | "xinjiexun">} */
export const groupSkills = {
	xinanguo: {
		audio: "anguo",
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target } = event;

			const drawing = [current => current.isMinHandcard(), current => current.draw()];
			const recovering = [current => current.isMinHp() && current.isDamaged(), current => current.recover()];
			const equipping = [
				current => current.isMinEquip(),
				async current => {
					const equip = get.cardPile(card => get.type(card) == "equip" && current.hasUseTarget(card), false, "random");
					if (equip) {
						await current.chooseUseTarget({
							card: equip,
							throw: false,
							nopopup: true,
							forced: true,
						});
					}
				},
			];

			const todo = [drawing, recovering, equipping];

			for (let i = 0; i < todo.length; ++i) {
				const [condition, action] = todo[i];
				if (condition(target)) {
					await action(target);
					todo.splice(i, 1);
					--i;
				}
			}

			game.updateRoundNumber();
			if (!todo.length) {
				return;
			}

			for (const [condition, action] of todo) {
				if (condition(player)) {
					await action(player);
				}
			}
			game.updateRoundNumber();
		},
		ai: {
			threaten: 1.6,
			order: 9,
			result: {
				player(player, target) {
					if (get.attitude(player, target) <= 0) {
						if (target.isMinHandcard() || target.isMinEquip() || target.isMinHp()) {
							return -1;
						}
					}
					var num = 0;
					if (player.isMinHandcard() || target.isMinHandcard()) {
						num++;
					}
					if (player.isMinEquip() || target.isMinEquip()) {
						num++;
					}
					if ((player.isMinHp() && player.isDamaged()) || (target.isMinHp() && target.isDamaged())) {
						num += 2.1;
					}
					return num;
				},
			},
		},
	},
	pindi: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			if (player.storage.pindi_target && player.storage.pindi_target.includes(target)) {
				return false;
			}
			return true;
		},
		filterCard(card, player) {
			if (player.storage.pindi_type && player.storage.pindi_type.includes(get.type2(card))) {
				return false;
			}
			return true;
		},
		subSkill: {
			clear: {
				trigger: { player: "phaseAfter" },
				silent: true,
				async content(event, trigger, player) {
					delete player.storage.pindi_target;
					delete player.storage.pindi_type;
				},
			},
		},
		//group:'pindi_clear',
		check(card) {
			var num = _status.event.player.getStat("skill").pindi || 0;
			return 6 + num - get.value(card);
		},
		position: "he",
		async content(event, trigger, player) {
			const { target, cards } = event;
			if (!player.storage.pindi_target) {
				player.storage.pindi_target = [];
			}
			if (!player.storage.pindi_type) {
				player.storage.pindi_type = [];
			}
			player.storage.pindi_target.push(target);
			player.storage.pindi_type.push(get.type2(cards[0], cards[0].original == "h" ? player : false));
			const num = player.getStat("skill").pindi;
			const evt = _status.event.getParent("phase");
			if (evt && evt.name == "phase" && !evt.pindi) {
				const next = game.createEvent("rerende_clear");
				_status.event.next.remove(next);
				evt.after.push(next);
				evt.pindi = true;
				next.player = player;
				next.setContent(lib.skill.pindi_clear.content);
			}
			player.syncStorage();
			let result;
			if (target.countCards("he") == 0) {
				result = { index: 0 };
			} else {
				result = await player
					.chooseControlList(true, ["令" + get.translation(target) + "摸" + get.cnNumber(num) + "张牌", "令" + get.translation(target) + "弃置" + get.cnNumber(num) + "张牌"], function () {
						return _status.event.choice;
					})
					.set("choice", get.attitude(player, target) > 0 ? 0 : 1)
					.forResult();
			}
			if (result.index == 0) {
				await target.draw(num);
			} else {
				await target.chooseToDiscard(num, "he", true);
			}
			if (target.isDamaged()) {
				await player.link(true);
			}
		},
		ai: {
			order: 8,
			threaten: 1.8,
			result: {
				target(player, target) {
					var att = get.attitude(player, target);
					var num = (player.getStat("skill").pindi || 0) + 1;
					if (att <= 0 && target.countCards("he") < num) {
						return 0;
					}
					return get.sgn(att);
				},
			},
		},
	},
	funan: {
		audio: 2,
		trigger: { global: ["respond", "useCard"] },
		filter(event, player) {
			if (!event.respondTo) {
				return false;
			}
			if (event.player == player) {
				return false;
			}
			if (player != event.respondTo[0]) {
				return false;
			}
			if (!player.hasSkill("funan_jiexun")) {
				const cards = [];
				if (get.itemtype(event.respondTo[1]) == "card") {
					cards.push(event.respondTo[1]);
				} else if (event.respondTo[1].cards) {
					cards.addArray(event.respondTo[1].cards);
				}
				return cards.filterInD("od").length > 0;
			} else {
				return event.cards.filterInD("od").length > 0;
			}
		},
		check(event, player) {
			if (player.hasSkill("funan_jiexun") || get.attitude(player, event.player) > 0) {
				return true;
			}
			let cards = [];
			if (get.itemtype(event.respondTo[1]) == "card") {
				cards.push(event.respondTo[1]);
			} else if (event.respondTo[1].cards) {
				cards.addArray(event.respondTo[1].cards);
			}
			return (
				event.cards.filterInD("od").reduce((acc, card) => {
					return acc + get.value(card);
				}, 0) -
				cards.filterInD("od").reduce((acc, card) => {
					return acc + get.value(card);
				})
			);
		},
		logTarget: "player",
		async content(event, trigger, player) {
			if (!player.hasSkill("funan_jiexun")) {
				let cards = [];
				if (get.itemtype(trigger.respondTo[1]) == "card") {
					cards.push(trigger.respondTo[1]);
				} else if (trigger.respondTo[1].cards) {
					cards.addArray(trigger.respondTo[1].cards);
				}
				cards = cards.filterInD("od");
				trigger.player.addTempSkill("funan_use");
				await trigger.player.gain({
					cards,
					animate: "gain2",
					log: true,
					gaintag: ["funan"],
				});
			}

			const cards = trigger.cards.filterInD("od");
			await player.gain({
				cards,
				animate: "gain2",
				log: true,
			});
		},
		subSkill: {
			jiexun: {
				charlotte: true,
				mark: true,
				marktext: "复",
				intro: {
					content: "你发动“复难”时，无须令其他角色获得你使用的牌",
				},
			},
			use: {
				onremove(player) {
					player.removeGaintag("funan");
				},
				charlotte: true,
				mod: {
					cardEnabled2(card, player) {
						if (get.itemtype(card) == "card" && card.hasGaintag("funan")) {
							return false;
						}
					},
				},
			},
		},
	},
	jiexun: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		onremove: true,
		async cost(event, trigger, player) {
			const num1 = game
				.filterPlayer()
				.map(current => current.countCards("ej", { suit: "diamond" }))
				.reduce((a, b) => a + b, 0);
			const num2 = player.countMark("jiexun");

			let prompt = `令目标摸${get.cnNumber(num1)}张牌`;
			if (num2 > 0) {
				prompt = `${prompt}，然后弃置${get.cnNumber(num2)}张牌；若目标因此法弃置了所有牌，则你失去“诫训”，然后你发动“复难”时，无须令其获得你使用的牌`;
			}

			event.result = await player
				.chooseTarget({
					prompt: get.prompt("jiexun"),
					prompt2: prompt,
					filterTarget(card, player, target) {
						return target !== player;
					},
					ai(target) {
						const { player, coeff } = get.event();
						return coeff * get.attitude(player, target);
					},
				})
				.set("coeff", num1 >= num2 ? 1 : -1)
				.forResult();

			event.result.cost_data = {
				num1,
				num2,
			};
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const { num1, num2 } = event.cost_data;

			if (num1) {
				await target.draw(num1);
			}
			player.addMark("jiexun", 1, false);

			if (!num2) {
				return;
			}

			const result = await target
				.chooseToDiscard({
					selectCard: num2,
					position: "he",
					forced: true,
				})
				.forResult();
			if (result?.cards?.length > 0 && result.autochoose && result.cards?.length === result.rawcards?.length) {
				await player.removeSkills("jiexun");
				player.addSkill("funan_jiexun");
			}
		},
	},
	xinjiexun: {
		audio: "jiexun",
		trigger: { player: "phaseJieshuBegin" },
		onremove: true,
		async cost(event, trigger, player) {
			const num1 = game
				.filterPlayer()
				.map(current => current.countCards("ej", { suit: "diamond" }))
				.reduce((a, b) => a + b, 0);
			const num2 = player.countMark("xinjiexun");

			let prompt = `令目标摸${get.cnNumber(num1)}张牌`;
			if (num2 > 0) {
				prompt = `${prompt}，然后弃置${get.cnNumber(num2)}张牌`;
			}

			event.result = await player
				.chooseTarget({
					prompt: get.prompt("xinjiexun"),
					prompt2: prompt,
					filterTarget(card, player, target) {
						return target !== player;
					},
					ai(target) {
						const { player, coeff } = get.event();
						return coeff * get.attitude(player, target);
					},
				})
				.set("coeff", num1 >= num2 ? 1 : -1)
				.forResult();

			event.result.cost_data = {
				num1,
				num2,
			};
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const { num1, num2 } = event.cost_data;
			if (num1) {
				await target.draw(num1);
			}
			player.addMark("xinjiexun", 1, false);

			if (num2) {
				const result = await target
					.chooseToDiscard({
						selectCard: num2,
						position: "he",
						forced: true,
					})
					.forResult();

				if (result?.cards?.length > 0 && result.autochoose && result.cards?.length === result.rawcards?.length) {
					player.clearMark("xinjiexun", false);
					player.addSkill("funan_jiexun");
				}
			}
		},
		intro: { content: "已经发动过了#次" },
	},
};
