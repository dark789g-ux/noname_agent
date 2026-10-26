import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "old_olsblixian" | "olsbguliang" | "olsbxutu" | "olsbjiaodi" | "olsbbaojing">} */
export const groupSkills = {
	old_olsblixian: {
		mod: {
			cardEnabled(card, player, result) {
				const evt = get.event();
				if (get.itemtype(card) == "vcard" && Array.isArray(card.cards)) {
					if (card.cards.some(c => c.hasGaintag("old_olsblixian")) && !["old_olsblixian_sha", "old_olsblixian_shan"].includes(evt.skill)) {
						return false;
					}
				}
				if (card.hasGaintag("old_olsblixian") && !["old_olsblixian_sha", "old_olsblixian_shan"].includes(evt.skill)) {
					return false;
				}
			},
		},
		group: ["old_olsblixian_gain", "old_olsblixian_sha", "old_olsblixian_shan"],
		subSkill: {
			gain: {
				audio: "old_olsblixian",
				trigger: {
					global: "phaseJieshuBegin",
				},
				forced: true,
				filter(event, player) {
					const gain = [];
					game.getGlobalHistory("useCard").forEach(evt => {
						if (get.type2(evt.card) != "trick" || get.position(evt.card) != "d") {
							return false;
						}
						if (!evt.targets || !evt.targets.includes(player)) {
							return false;
						}
						gain.addArray(evt.cards);
					});
					return gain.length;
				},
				async content(event, trigger, player) {
					const gain = [];
					game.getGlobalHistory("useCard").forEach(evt => {
						if (get.type2(evt.card) != "trick" || get.position(evt.card) != "d") {
							return false;
						}
						if (!evt.targets || !evt.targets.includes(player)) {
							return false;
						}
						gain.addArray(evt.cards);
					});
					await player.gain(gain, "draw").gaintag.add("old_olsblixian");
				},
			},
			sha: {
				audio: "old_olsblixian",
				enable: ["chooseToUse", "chooseToRespond"],
				filterCard(card) {
					return card.hasGaintag("old_olsblixian");
				},
				viewAs: {
					name: "sha",
				},
				viewAsFilter(player) {
					if (!player.countCards("hs", lib.skill["old_olsblixian_sha"].filterCard)) {
						return false;
					}
				},
				position: "hs",
				prompt: "将一张“理贤”牌当杀使用或打出",
				check() {
					return 1;
				},
				ai: {
					respondSha: true,
					skillTagFilter(player) {
						if (!player.countCards("hs", lib.skill["old_olsblixian_sha"].filterCard)) {
							return false;
						}
					},
					order() {
						return get.order({ name: "sha" }) - 0.1;
					},
				},
			},
			shan: {
				audio: "old_olsblixian",
				enable: ["chooseToRespond", "chooseToUse"],
				filterCard(card) {
					return card.hasGaintag("old_olsblixian");
				},
				viewAs: {
					name: "shan",
				},
				prompt: "将一张“理贤”牌当闪打出",
				check() {
					return 1;
				},
				viewAsFilter(player) {
					if (!player.countCards("hs", lib.skill["old_olsblixian_sha"].filterCard)) {
						return false;
					}
				},
				position: "hs",
				ai: {
					respondShan: true,
					skillTagFilter(player) {
						if (!player.countCards("hs", lib.skill["old_olsblixian_sha"].filterCard)) {
							return false;
						}
					},
				},
			},
		},
	},
	//OL谋沮授
	olsbguliang: {
		audio: 2,
		trigger: { target: "useCardToPlayer" },
		filter(event, player) {
			return event.player != player;
		},
		usable: 1,
		check(event, player) {
			return get.effect(player, event.card, event.player, player) < 0;
		},
		async content(event, trigger, player) {
			trigger.getParent().excluded.add(player);
			player.addTempSkill("olsbguliang_debuff");
			player.markAuto("olsbguliang_debuff", trigger.player);
		},
		subSkill: {
			debuff: {
				charlotte: true,
				onremove: true,
				trigger: { target: "useCardToPlayer" },
				silent: true,
				filter(event, player) {
					return player.getStorage("olsbguliang_debuff").includes(event.player);
				},
				async content(event, trigger, player) {
					trigger.getParent().directHit.add(player);
				},
			},
		},
	},
	olsbxutu: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		marktext: "资",
		mark: true,
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async content(event, trigger, player) {
			const cards = get.cards(3);
			const next = player.addToExpansion(cards, player, "giveAuto");
			next.gaintag.add(event.name);
			await next;
		},
		group: ["olsbxutu_exchange"],
		subSkill: {
			exchange: {
				audio: "olsbxutu",
				trigger: { global: "phaseJieshuBegin" },
				filter(event, player) {
					return get.discarded().someInD("d") && player.countExpansions("olsbxutu");
				},
				async cost(event, trigger, player) {
					const cards = player.getExpansions("olsbxutu");
					const discardPile = get.discarded().filterInD("d");
					const dialog = ["徐图：选择要交换的牌", '<div class="text center">“资”</div>', cards, '<div class="text center">弃牌堆</div>', discardPile];
					const result = await player
						.chooseButton(dialog, 2)
						.set("filterButton", button => {
							if (ui.selected.buttons.length) {
								return get.position(button.link) != get.position(ui.selected.buttons[0].link);
							}
							return true;
						})
						.set("cards1", cards)
						.set("cards2", discardPile)
						.set("ai", button => {
							const player = get.player(),
								{ link } = button;
							let cards1 = get.event().cards1.slice(0),
								cards2 = get.event().cards2.slice(0);
							if (!ui.selected.buttons.length) {
								if (!cards2.includes(link)) {
									return 0;
								}
								cards2.remove(link);
								const suits = cards1.filter(card => get.suit(card) == get.suit(link));
								const numbers = cards1.filter(card => get.number(card) == get.number(link));
								if (suits.length > 2 || numbers.length > 2) {
									return 20 + get.value(link);
								}
								return get.value(link);
							}
							cards1.push(ui.selected.buttons[0].link);
							cards1.remove(link);
							const bool = cards1.every(card => get.suit(card) == get.suit(cards1[0])) || cards1.every(card => get.number(card) == get.number(cards1[0]));
							if (bool) {
								return 20 - get.value(link);
							}
							return get.value(ui.selected.buttons[0].link) - get.value(link);
						})
						.forResult();
					event.result = {
						bool: result.bool,
						cost_data: result.links,
					};
				},
				async content(event, trigger, player) {
					const { cost_data } = event;
					const cards = cost_data;
					if (get.position(cards[0]) != "x") {
						cards.reverse();
					}
					const next = player.addToExpansion(cards[1], player, "giveAuto");
					next.gaintag.add("olsbxutu");
					await next;
					await player.loseToDiscardpile(cards[0]);
					const expansion = player.getExpansions("olsbxutu");
					if (!expansion.length) {
						return;
					}
					const bool = expansion.every(card => get.suit(card) == get.suit(expansion[0])) || expansion.every(card => get.number(card) == get.number(expansion[0]));
					if (!bool) {
						return;
					}
					const result = await player
						.chooseTarget(true)
						.set("prompt", `将${get.translation(expansion)}交给一名角色`)
						.forResult();
					if (result?.bool && result?.targets?.length) {
						await result.targets[0].gain(expansion, "draw");
						const num = 3 - player.countExpansions("olsbxutu");
						if (num > 0) {
							const next = player.addToExpansion(get.cards(num), player, "giveAuto");
							next.gaintag.add("olsbxutu");
							await next;
						}
					}
				},
			},
		},
	},
	//OL谋公孙
	olsbjiaodi: {
		audio: 3,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			return event.card.name === "sha" && event.isFirstTarget && event.targets.length === 1;
		},
		forced: true,
		logTarget: "target",
		async content(event, trigger, player) {
			const { target } = trigger,
				num = target.getAttackRange() - player.getAttackRange();
			if (num <= 0) {
				trigger.getParent().baseDamage++;
				await player.gainPlayerCard(target, "h", true);
			}
			if (num >= 0) {
				await player.discardPlayerCard(target, "hej", true);
				const evt = trigger.getParent();
				if (
					game.hasPlayer(target => {
						return !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
					})
				) {
					const result = await player
						.chooseTarget(
							(card, player, target) => {
								const { evt } = get.event();
								return !evt.targets.includes(target) && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
							},
							get.translation(event.name) + "：为" + get.translation(trigger.card) + "额外指定一个目标",
							true
						)
						.set("evt", evt)
						.set("ai", target => {
							const player = get.player(),
								{ evt } = get.event();
							return get.effect(target, evt.card, evt.player, player);
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						const { targets } = result;
						player.line(targets, "yellow");
						trigger.targets.addArray(targets);
						trigger.getParent().triggeredTargets1.addArray(targets);
						game.log(targets, "成为了", trigger.card, "的额外目标");
					}
				}
			}
		},
		mod: { attackRange: player => player.getHp() },
	},
	olsbbaojing: {
		audio: 3,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => target !== player);
		},
		usable: 1,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target } = event;
			let { index } = await player
				.chooseControl(" +1 ", "-1")
				.set("ai", () => {
					const player = get.player(),
						{ target } = get.event().getParent();
					return get.attitude(player, target) > 0 ? 0 : 1;
				})
				.set("prompt", "令" + get.translation(target) + "的攻击范围+1或-1")
				.forResult();
			if (typeof index === "number") {
				index = Math.sign(0.5 - index);
				player.popup((index > 0 ? "+" : "") + index);
				target.addSkill("olsbbaojing_effect");
				if (!target.storage["olsbbaojing_effect"][player.playerid]) {
					target.storage["olsbbaojing_effect"][player.playerid] = 0;
				}
				target.storage["olsbbaojing_effect"][player.playerid] += index;
				target.markSkill("olsbbaojing_effect");
			}
		},
		ai: {
			order: 10,
			result: {
				player(player, target) {
					if (get.attitude(player, target) < 0) {
						return 1 / (target.getAttackRange() + 1);
					}
					return target.getAttackRange();
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				init: (player, skill) => (player.storage[skill] = player.storage[skill] || {}),
				onremove: true,
				intro: {
					markcount(storage = {}) {
						const num = Object.keys(storage).reduce((sum, i) => sum + storage[i], 0);
						if (!num) {
							return num;
						}
						return (num > 0 ? "+" : "") + num.toString();
					},
					content(storage = {}) {
						const num = Object.keys(storage).reduce((sum, i) => sum + storage[i], 0);
						if (!num) {
							return "攻击范围无变化";
						}
						return "攻击范围" + (num > 0 ? "+" : "") + num;
					},
				},
				mod: {
					attackRange(player, num) {
						const storage = player.storage["olsbbaojing_effect"] || {};
						const numx = Object.keys(storage).reduce((sum, i) => sum + storage[i], 0);
						if (!numx) {
							return;
						}
						const sum = num + numx;
						if (numx > 0 || sum >= 1) {
							return sum;
						}
					},
				},
				trigger: { global: "phaseUseBegin" },
				filter(event, player) {
					return player.storage?.["olsbbaojing_effect"]?.[event.player.playerid];
				},
				forced: true,
				popup: false,
				content() {
					const target = trigger.player;
					delete player.storage[event.name][target.playerid];
					player[Object.keys(player.storage[event.name]).length ? "markSkill" : "removeSkill"](event.name);
				},
			},
		},
	},
};
