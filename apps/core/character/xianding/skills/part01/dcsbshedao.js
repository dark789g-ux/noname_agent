import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbshedao" | "dcsbxunshi" | "dcsbzhengong">} */
export const groupSkills = {
	//谋张任
	dcsbshedao: {
		audio: 2,
		trigger: {
			global: ["loseAfter", "loseAsyncAfter", "cardsDiscardAfter", "equipAfter"],
		},
		getCards(event, player) {
			const cards = [];
			game.filterPlayer2(target => target != player, void 0, true).forEach(target => {
				const discard = event.getd(target, "cards2");
				cards.addArray(discard);
			});
			return cards;
		},
		filter(event, player) {
			if (_status.currentPhase != player) {
				return false;
			}
			const cards = get.info("dcsbshedao").getCards(event, player);
			return cards.some(card => get.color(card) == "red" || get.name(card) == "sha");
		},
		async cost(event, trigger, player) {
			const cards = get.info(event.skill).getCards(trigger, player);
			const red = cards.filter(card => get.color(card) == "red");
			const sha = cards.filter(card => get.name(card) == "sha");
			const choiceList = [`获得${get.translation(red)}中的任意张并弃置一张黑牌`, `获得${get.translation(sha)}并永久视为雷杀`];
			const controls = ["选项一", "选项二", "cancel2"];
			if (!red.length) {
				choiceList[0] = `<span style="text-decoration: line-through;">没有红色牌可以获得</span>`;
				controls.remove("选项一");
			}
			if (!sha.length) {
				choiceList[1] = `<span style="text-decoration: line-through;">没有杀可以获得</span>`;
				controls.remove("选项二");
			}
			const result = await player
				.chooseControl({
					controls,
					choiceList,
					choice: (() => {
						return red.length > sha.length ? 0 : 1;
					})(),
					prompt: get.prompt2(event.skill),
				})
				.forResult();
			if (result.control != "cancel2") {
				const index = ["选项一", "选项二"].indexOf(result.control);
				event.result = {
					bool: true,
					cost_data: index,
					cards: index == 0 ? red : sha,
				};
			}
		},
		async content(event, trigger, player) {
			const { cards, cost_data: index } = event;
			if (index == 0) {
				const result = await player
					.chooseButton({
						createDialog: [`慑道：请选择要获得的牌`, cards],
						selectButton: [1, cards.length],
						forced: true,
						ai(button) {
							return get.value(button.link);
						},
					})
					.forResult();
				if (!result?.links?.length) {
					return;
				}
				player.addTempSkill(event.name + "_effect");
				await player.gain({ cards: result.links, animate: "gain2", gaintag: [event.name + "_effect"] });
				await player.chooseToDiscard({
					prompt: `慑道：弃置一张黑色牌`,
					forced: true,
					position: "he",
					filterCard(card, player) {
						return get.color(card) == "black";
					},
				});
			} else {
				game.addGlobalSkill(event.name + "_global");
				await player.gain({ cards, animate: "gain2", gaintag: ["eternal_" + event.name + "_global"] });
			}
		},
		subSkill: {
			global: {
				charlotte: true,
				mod: {
					cardname(card, player) {
						if (card.hasGaintag("eternal_dcsbshedao_global")) {
							return "sha";
						}
					},
					cardnature(card, player) {
						if (card.hasGaintag("eternal_dcsbshedao_global")) {
							return "thunder";
						}
					},
				},
			},
			effect: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				mod: {
					ignoredHandcard(card) {
						if (card.hasGaintag("dcsbshedao_effect")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (card.hasGaintag("dcsbshedao_effect") && name == "phaseDiscard") {
							return false;
						}
					},
				},
			},
		},
	},
	dcsbxunshi: {
		audio: 2,
		mod: {
			cardUsable(card, player) {
				if (get.name(card) == "sha" && get.nature(card) == "thunder") {
					return Infinity;
				}
			},
			targetInRange(card, player) {
				if (get.name(card) == "sha" && get.nature(card) == "thunder") {
					return true;
				}
			},
		},
		trigger: {
			source: "damageSource",
		},
		filter(event, player) {
			return event.card && get.name(event.card) == "sha" && get.nature(event.card) == "thunder";
		},
		forced: true,
		async content(event, trigger, player) {
			await trigger.player.randomDiscard({ position: "he" });
			await player.draw(2);
		},
		group: ["dcsbxunshi_nocount"],
		subSkill: {
			nocount: {
				inherit: "nocount",
				filter(event, player) {
					return event.addCount !== false && get.name(event.card) == "sha" && get.nature(event.card) == "thunder";
				},
			},
		},
	},
	dcsbzhengong: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "gray",
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => target != player);
		},
		position: "he",
		complexCard: true,
		filterCard(card, player) {
			const { cards } = ui.selected;
			if (cards.length && get.name(card) != get.name(cards[0])) {
				return false;
			}
			return lib.filter.cardDiscardable(card, player, "dcsbzhengong");
		},
		check(card) {
			return 6 - get.value(card);
		},
		selectCard: [2, Infinity],
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const { cards } = event;
			const num = cards.length;
			const result = await player
				.chooseTarget({
					prompt: `震弓：请分配${num}点伤害给其他角色`,
					selectTarget: [num, num + 1],
					forced: true,
					filterTarget(card, player, target) {
						const { targets } = ui.selected;
						if (targets.length >= get.event().selectTarget[0]) {
							return false;
						}
						return target != player;
					},
					ai(target) {
						const eff = get.damageEffect(target, get.player(), get.player());
						if (ui.selected.targets.includes(target)) {
							return eff;
						}
						return eff + 2;
					},
				})
				.set("promptbar", "none")
				.set("custom", {
					add: {},
					replace: {
						target(target, e) {
							const event = get.event();
							if (!event.isMine() || !event.filterTarget(void 0, event.player, target)) {
								return;
							}
							if (target.classList.contains("selectable") == false) {
								return;
							}
							target.unprompt();
							target.classList.add("selected");
							ui.selected.targets.push(target);
							const count = get.numOf(ui.selected.targets, target);
							target.prompt(`伤害×${count}`);
							game.check();
						},
					},
				})
				.forResult();
			const { targets } = result;
			if (targets?.length) {
				const list = targets.slice();
				targets.unique();
				player.line(targets);
				await game.doAsyncInOrder(targets, async target => {
					target
						.when({
							player: "damageEnd",
							global: ["phaseBeforeStart", "phaseAfter"],
						})
						.filter(evt => {
							if (evt.name == "phase") {
								return true;
							}
							return evt.getParent() == event || evt.getTrigger().getParent() == event;
						})
						.then(async (event, trigger, player) => {
							if (trigger.name == "phase") {
								return;
							}
							player.addTempSkill("fengyin");
						});
					return target.damage({ num: get.numOf(list, target) });
				});
			}
		},
		ai: {
			order: 8,
			result: {
				player(player, target) {
					if (game.hasPlayer(target => target != player && get.damageEffect(target, player, player) > 0)) {
						return 1;
					}
				},
			},
		},
	},
};
