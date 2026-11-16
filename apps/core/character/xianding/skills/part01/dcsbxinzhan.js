import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbxinzhan" | "dcsbchengce">} */
export const groupSkills = {
	//谋马谡
	dcsbxinzhan: {
		audio: 2,
		trigger: {
			player: "useCardToPlayer",
		},
		filter(event, player) {
			if (!(event.card?.name == "sha" || get.type(event.card) == "trick") || event.targets.length != 1 || event.target == player) {
				return false;
			}
			const eventx = event.getParent();
			let history = player.getHistory(
				"useCard",
				evt => {
					if (eventx.card?.name == "sha") {
						return evt != eventx && evt.card?.name == "sha" && evt.targets.length == 1 && evt.target != player;
					} else {
						return evt != eventx && get.type(evt.card) == "trick" && evt.targets.length == 1 && evt.target != player;
					}
				},
				eventx
			);
			return !history.length;
		},
		async content(event, trigger, player) {
			const target = trigger.target,
				card = trigger.card;
			if (!target || !card) return;
			const result = await player
				.chooseControl("响应", "不响应")
				.set("prompt", `猜测你的${get.translation(card)}是否被响应`)
				.set("ai", () => {
					return [0, 1].randomGet();
				})
				.forResult();
			player.addTempSkill("dcsbxinzhan_eff");
			player.markAuto("dcsbxinzhan_eff", [
				{
					target: target,
					card: card,
					result: result.control,
				},
			]);
		},
		check(event, player) {
			if (!event.target) return false;
			return get.attitude(player, event.target) < 0;
		},
		subSkill: {
			eff: {
				forced: true,
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					let storage = player.getStorage("dcsbxinzhan_eff");
					if (!storage) return false;
					return storage.some(item => {
						return item.card === event.card;
					});
				},
				async content(event, trigger, player) {
					let item = player.storage["dcsbxinzhan_eff"].find(i => i.card == trigger.card);
					player.storage["dcsbxinzhan_eff"].remove(item);
					const { target, card, result } = item;
					let xiangying = "不响应";
					game.checkGlobalHistory("everything", evt => {
						if (["useCard", "respond"].includes(evt.name)) {
							if (Array.isArray(evt.respondTo) && evt.respondTo[1] == card) {
								xiangying = "响应";
							}
						}
					});
					if (xiangying == result) {
						if (target.isIn() && target.countCards("he")) {
							await player.gainPlayerCard(target, 1, "he", true, "visible");
						}
						player.recover();
					} else {
						const card0 = get.cardPile(card => card.name == "sha");
						if (card0) {
							await player.gain(card0, "gain2");
						}
						const cardx = new lib.element.VCard({ name: "juedou", isCard: true });
						if (target.isIn() && player.canUse(cardx, target)) {
							await player.useCard(cardx, target);
						}
					}
				},
				sub: true,
				sourceSkill: "dcsbxinzhan",
			},
		},
	},
	dcsbchengce: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return game.countPlayer() > 1;
		},
		async content(event, trigger, player) {
			const cards = get.cards(2, true);
			if (!cards.length) {
				return;
			}
			await game.cardsGotoOrdering(cards);
			let list = [["牌堆顶的牌", cards]],
				prompt = "观看牌堆顶的2张牌";
			let hs = player.getCards("h");
			if (hs.length) {
				list.push(["你的手牌", hs]);
				prompt = "用任意张手牌交换牌堆顶的等量牌";
			}
			const result = await player
				.chooseToMove({
					prompt: prompt,
					forced: true,
					filterMove: (from, to) => {
						return typeof to != "number";
					},
					selectionSpec: { move: "swap" },
					list: list,
					num: 2,
				})
				.forResult();
			event.forceDie = true;
			if (result.moved[1]?.length) {
				const lose = result.moved[0].slice();
				const gain = result.moved[1].slice().filter(i => !get.owner(i));
				if (lose.some(i => get.owner(i))) {
					await player.lose(
						lose.filter(i => get.owner(i)),
						ui.special
					);
				}
				await game.cardsGotoPile(lose.slice().reverse(), "insert");
				game.updateRoundNumber();
				if (gain.length) {
					await player.gain(gain, "draw");
				}
			} else {
				await game.cardsGotoPile(result.moved[0].slice().reverse(), "insert");
			}
			if (game.countPlayer() < 2) {
				return;
			}
			if (player.isIn()) {
				const result1 = await player
					.chooseTarget({
						prompt: "令一名其他角色观看牌堆顶2张牌并获得其中1张",
						forced: true,
						filterTarget: (card, player, target) => {
							return target != player;
						},
						ai: target => {
							let player = get.player();
							return get.attitude(player, target);
						},
					})
					.forResult();
				const target = result1.targets[0];
				const cards0 = get.cards(2, true);
				const result2 = await target
					.chooseButton({
						createDialog: ["选择一张牌获得", cards0],
						forced: true,
						ai: button => {
							const card = button.link;
							let val = get.value(card);
							if (!get.tag(card, "damage")) val += 5;
							return val;
						},
					})
					.forResult();
				const card0 = result2.links[0];
				if (!card0) {
					return;
				}
				await target.gain(card0, "draw");
				if (get.tag(card0, "damage")) {
					if (player.isIn()) {
						let cardsx = [];
						while (cardsx.length < 2) {
							const card = get.cardPile(i => get.tag(i, "damage") && !cardsx.includes(i));
							if (card) {
								cardsx.push(card);
							} else {
								break;
							}
						}
						await player.gain(cardsx, "draw");
					}
					if (target.isIn()) {
						let cardsx = target.getCards("h").randomGets(2);
						if (cardsx?.length) {
							target.addTempSkill(event.name + "_sha", { global: "roundEnd" });
							target.addGaintag(cardsx, event.name + "_sha");
						}
					}
				} else {
					if (player.isIn()) {
						let cardsx = [];
						while (cardsx.length < 2) {
							const card = get.cardPile(i => !get.tag(i, "damage") && !cardsx.includes(i));
							if (card) {
								cardsx.push(card);
							} else {
								break;
							}
						}
						await player.gain(cardsx, "draw");
						player.addSkill(event.name + "_mianshang");
					}
					if (target.isIn()) {
						target.addTempSkill("dcsbxinzhan", { global: "roundEnd" });
					}
				}
			}
		},
		check: (event, player) => {
			return game.hasPlayer(current => {
				return current != player && get.attitude(player, current) > 0;
			});
		},
		subSkill: {
			sha: {
				charlotte: true,
				mod: {
					cardname(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("dcsbchengce_sha")) {
							return "sha";
						}
					},
					cardnature(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("dcsbchengce_sha")) {
							return false;
						}
					},
				},
				trigger: {
					global: "roundEnd",
				},
				onremove(player, skill) {
					player.removeGaintag("dcsbchengce_sha");
				},
				sub: true,
				sourceSkill: "dcsbchengce",
			},
			mianshang: {
				charlotte: true,
				forced: true,
				trigger: { player: "damageBegin4" },
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					trigger.cancel();
				},
				mark: true,
				intro: {
					content: "防止下次受到的伤害",
				},
				sub: true,
				sourceSkill: "dcsbchengce",
			},
		},
	},
};
