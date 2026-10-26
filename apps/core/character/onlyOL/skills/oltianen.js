import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oltianen" | "olqiangang" | "olsbdinglun" | "olsbquxi" | "olsbjieli">} */
export const groupSkills = {
	oltianen: {
		audio: 3,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!event.isFirstTarget || event.targets.length > 1) {
				return false;
			}
			const playerChoice = (player.getStorage("olquanyu", new Map([])).get(player) ?? [[], undefined])[1];
			const targetChoice = (player.getStorage("olquanyu", new Map([])).get(event.target) ?? [[], undefined])[1];
			if (!playerChoice || !targetChoice) {
				return false;
			}
			return !player.getStorage("oltianen_used").includes(playerChoice === targetChoice);
		},
		forced: true,
		logTarget: "target",
		async content(event, trigger, player) {
			const target = trigger.target;
			player.addTempSkill("oltianen_used");
			const playerChoice = player.getStorage("olquanyu", new Map([])).get(player)?.[1];
			const targetChoice = player.getStorage("olquanyu", new Map([])).get(target)?.[1];
			player.markAuto("oltianen_used", [playerChoice === targetChoice]);
			if (playerChoice === targetChoice) {
				const card = get.cardPile("sha");
				if (card) {
					player.addSkill("oltianen_effect");
					const next = player.gain(card, "gain2");
					next.gaintag.add("oltianen_effect");
					await next;
				}
			} else {
				const cards = target.getDiscardableCards(player, "he");
				if (cards.length) {
					const next = target.discard(cards.randomGet());
					next.discarder = player;
					await next;
				}
				if (player.getStorage("olquanyu", new Map([])).get(target)?.[0]?.length < 6) {
					player.logSkill("olquanyu", target);
					const next = game.createEvent("olquanyu");
					next.player = player;
					next.targets = [target];
					next._trigger = event;
					next.setContent(lib.skill.olquanyu.content);
					await next;
				}
			}
		},
		ai: { combo: "olquanyu" },
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			effect: {
				charlotte: true,
				mod: {
					ignoredHandcard(card, player) {
						if (card.hasGaintag("oltianen_effect")) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name === "phaseDiscard" && card.hasGaintag("oltianen_effect")) {
							return false;
						}
					},
				},
			},
		},
	},
	olqiangang: {
		audio: 3,
		enable: "phaseUse",
		filter(event, player) {
			return !player.hasSkill("olrumo", null, false, false) && player.hasSkill("oltianen", null, false, false);
		},
		skillAnimation: true,
		animationColor: "wood",
		manualConfirm: true,
		async content(event, trigger, player) {
			player.addSkill("olrumo");
			await player.removeSkills("oltianen");
			player.addSkill(`${event.name}_effect`);
		},
		ai: {
			combo: "olquanyu",
			order(item, player) {
				return get.order({ name: "sha" }, player) + 0.1;
			},
			result: {
				player(player) {
					const playerChoice = (player.getStorage("olquanyu", new Map([])).get(player) ?? [[], undefined])[1];
					return player.countCards("hs", card => {
						if (card.name !== "sha" || !player.hasUseTarget(card)) {
							return false;
						}
						return game.hasPlayer(target => {
							if (!player.canUse(card, target) || get.effect(target, card, player, player) < 0) {
								return false;
							}
							const targetChoices = (player.getStorage("olquanyu", new Map([])).get(target) ?? [[], undefined])[0];
							return [playerChoice, ...targetChoices].unique().length > 3;
						});
					});
				},
			},
		},
		derivation: "olrumo",
		subSkill: {
			effect: {
				charlotte: true,
				init(player) {
					for (const target of game.filterPlayer()) {
						if (target === player) {
							continue;
						}
						const choices = (player.getStorage("olquanyu", new Map([])).get(target) ?? [[], undefined])[0];
						if (!choices.length) {
							continue;
						}
						const func = (player, target, choices) => {
							for (const i of choices) {
								target.addTip(i, lib.skill[i].description, false, { width: "fit-content" });
							}
						};
						if (player.isMine() || target.isMine()) {
							func(player, target, choices);
						} else if (player.isOnline2() || target.isOnline2()) {
							player.send(func, player, target, choices);
						}
					}
				},
				onChooseToUse(event) {
					event.targetprompt2.add(target => {
						const player = get.player(),
							card = get.card();
						if (!card || card.name !== "sha" || !target.classList.contains("selectable")) {
							return false;
						}
						const choices = (player.getStorage("olquanyu", new Map([])).get(target) ?? [[], undefined])[0];
						if (choices.length) {
							return `<span class='bluetext'>${choices.map(i => lib.skill[i].intro.name[0]).join("")}</span>`;
						}
					});
				},
				audio: "olqiangang",
				trigger: { player: "useCardToPlayer" },
				filter(event, player) {
					if (event.card.name !== "sha" || !event.isFirstTarget || event.targets.length > 1) {
						return false;
					}
					const storage = player.getStorage("olquanyu", new Map([])).get(event.target);
					return storage?.[0]?.some(choice => {
						const filter = lib.skill[choice]?.filter;
						return filter ? filter(event, player) : true;
					});
				},
				forced: true,
				logTarget: "target",
				async content(event, trigger, player) {
					const storage = player.getStorage("olquanyu", new Map([])).get(trigger.target);
					for (const choice of storage?.[0] || []) {
						const filter = lib.skill[choice]?.filter;
						if (filter ? filter(trigger, player) : true) {
							await lib.skill[choice].contentx(trigger, player);
						}
					}
				},
				mod: {
					cardUsableTarget(card, player, target) {
						const storage = player.getStorage("olquanyu", new Map([])).get(target) ?? [[], undefined];
						if (storage[1] === "olquanyu_liuxing" && card.name === "sha" && ![...ui.selected.targets].remove(target).length) {
							return true;
						}
					},
				},
				ai: {
					unequip_ai: true,
					skillTagFilter(player, tag, arg) {
						if (!arg?.card || !arg.target || arg.card.name !== "sha" || !![...ui.selected.targets].remove(arg.target).length) {
							return false;
						}
						const storage = player.getStorage("olquanyu", new Map([])).get(arg.target) ?? [[], undefined];
						return storage[1] === "olquanyu_bixie";
					},
				},
			},
		},
	},
	//谋郭嘉
	olsbdinglun: {
		audio: 2,
		derivation: ["olsbquxi"],
		enable: "phaseUse",
		usable: 1,
		filterTarget: true,
		selectTarget() {
			return [1, Math.ceil(game.countPlayer() / 2)];
		},
		multiline: true,
		multitarget: true,
		async content(event, trigger, player) {
			const { targets } = event;
			let num1 = 0,
				num2 = 0;
			game.filterPlayer().forEach(target => {
				const num = target.countCards("h");
				if (targets.includes(target)) {
					num1 += num;
				} else {
					num2 += num;
				}
			});
			if (num1 > num2) {
				player.popup("洗具");
				player.addSkill(`${event.name}_clear`);
				player.markAuto(`${event.name}_clear`, targets);
				await game.doAsyncInOrder(targets, async (target, index) => {
					await target.addAdditionalSkills(`${event.name}_${player.playerid}`, "olsbquxi");
					await target.draw();
				});
			} else {
				player.popup("杯具");
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					const targets = game.filterPlayer(i => get.attitude(player, i) > 0);
					let num1 = 0,
						num2 = 0;
					game.filterPlayer().forEach(i => {
						const num = i.countCards("h");
						if (targets.includes(i)) {
							num1 += num;
						} else {
							num2 += num;
						}
					});
					if (num1 > num2) {
						return 1;
					}
					return 0;
				},
			},
		},
		subSkill: {
			clear: {
				charlotte: true,
				onremove: true,
				forceDie: true,
				forced: true,
				popup: false,
				trigger: {
					global: "die",
					player: "phaseZhunbeiBegin",
				},
				filter(event, player) {
					if (event.name == "die") {
						return player == event.player || player.getStorage("olsbdinglun_clear").includes(event.player);
					}
					return player.getStorage("olsbdinglun_clear").length > 0;
				},
				async content(event, trigger, player) {
					let targets = [];
					if (trigger.name == "die" && trigger.player !== player) {
						targets = [trigger.player];
					} else {
						targets = player.getStorage(event.name).slice();
					}
					await game.doAsyncInOrder(targets, async (target, index) => {
						player.unmarkAuto(event.name, target);
						await target.removeAdditionalSkills(`olsbdinglun_${player.playerid}`);
					});
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
				},
			},
		},
	},
	olsbquxi: {
		audio: 2,
		enable: "phaseUse",
		list: [
			["guohe", "shan"],
			["shunshou", "tao"],
		],
		filter(event, player) {
			const list = get.info("olsbquxi").list;
			const storage = player.getStorage("olsbquxi_used");
			return list.some(arr => !storage.includes(arr[0]) && player.hasCard(arr[1], "hes") && event.filterCard(get.autoViewAs({ name: arr[0] }, "unsure"), player, event));
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.info("olsbquxi").list.map(arr => ["trick", "", arr[0]]);
				return ui.create.dialog("趋袭", [list, "vcard"], "hidden");
			},
			filter(button) {
				const player = get.player();
				const name = get.info("olsbquxi").list.find(arr => arr[0] == button.link[2])[1];
				return (
					!player.getStorage("olsbquxi_used").includes(button.link[2]) &&
					player.hasCard(name, "hes") &&
					get
						.event()
						.getParent()
						.filterCard(get.autoViewAs({ name: button.link[2] }, "unsure"), player, get.event().getParent())
				);
			},
			check(button) {
				return get.player().getUseValue(get.autoViewAs({ name: button.link[2] }, "unsure"));
			},
			backup(links, player) {
				const name = get.info("olsbquxi").list.find(arr => arr[0] == links[0][2])[1];
				return {
					filterCard: { name: name },
					position: "hes",
					viewAs: {
						name: links[0][2],
					},
					log: false,
					check(card) {
						return 7 - get.value(card);
					},
					async precontent(event, trigger, player) {
						player.logSkill("olsbquxi");
						player.addTempSkill("olsbquxi_used", "phaseChange");
						player.markAuto("olsbquxi_used", event.result.card.name);
					},
				};
			},
			prompt(links, player) {
				const name = get.info("olsbquxi").list.find(arr => arr[0] == links[0][2])[1];
				return `将一张【${get.translation(name)}】当作【${get.translation(links[0][2])}】使用`;
			},
		},
		ai: {
			order: 8,
			result: {
				player: 1,
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已转化：$",
				},
			},
		},
	},
	olsbjieli: {
		audio: 2,
		round: 1,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			return event.targets?.length == 1;
		},
		async cost(event, trigger, player) {
			const list = [`由你重新选择${get.translation(trigger.card)}的目标`, `观看一名其他角色的所有手牌，获得其中与${get.translation(trigger.card)}花色相同的牌`];
			const canChangeTarget = game.hasPlayer(target => trigger.player.canUse(trigger.card, target) && get.effect(target, trigger.card, trigger.player, player) > get.effect(trigger.target, trigger.card, trigger.player, player));
			if (!game.hasPlayer(target => target != player && target.countCards("h"))) {
				const result = await player.chooseBool(get.prompt(event.skill), list[0]).set("choice", canChangeTarget).forResult();
				if (result?.bool) {
					event.result = { bool: true, cost_data: 0 };
				}
			} else {
				let choice = 0;
				if (get.suit(trigger.card) != "none" && game.hasPlayer(target => get.attitude(player, target) < 0 && target.countCards("h") > 5)) {
					choice = 1;
				} else if (canChangeTarget) {
					choice = 0;
				} else {
					choice = 2;
				}
				const result = await player.chooseControl("cancel2").set("choiceList", list).set("prompt", get.prompt2(event.skill)).set("choice", choice).forResult();
				if (result?.control != "cancel2") {
					event.result = { bool: true, cost_data: result.index };
				}
			}
		},
		async content(event, trigger, player) {
			const { cost_data: index } = event;
			if (index == 0) {
				const next = player
					.chooseTarget(`解罹：为${get.translation(trigger.card)}重新指定目标`, true, (card, player, target) => {
						return get.event().getTrigger().player.canUse(card, target);
					})
					.set("_get_card", trigger.card)
					.set("ai", target => get.effect(target, get.event().getTrigger().card, get.event().getTrigger().player, get.player()));
				next.targetprompt2.add(target => {
					if (!target.isIn() || target != get.event().getTrigger().target) {
						return false;
					}
					return "原目标";
				});
				const result = await next.forResult();
				if (result?.targets?.length) {
					const { targets } = result;
					player.line(targets, "yellow");
					const evt = trigger.getParent();
					evt.targets.length = 0;
					evt.targets.addArray(targets);
					game.log(targets, "成为了", trigger.card, "的新目标");
				}
			} else {
				const result = await player
					.chooseTarget(`解罹：请选择要观看手牌的角色`, true, lib.filter.notMe)
					.set("ai", target => -get.attitude(get.player(), target) * target.countCards("h"))
					.forResult();
				if (result?.targets?.length) {
					const {
						targets: [target],
					} = result;
					player.line(target, "yellow");
					await player.viewHandcards(target);
					const cards = target.getGainableCards(player, "h", { suit: get.suit(trigger.card) });
					if (cards.length) {
						await player.gain(cards, target, "give", "bySelf");
					}
				}
			}
		},
	},
};
