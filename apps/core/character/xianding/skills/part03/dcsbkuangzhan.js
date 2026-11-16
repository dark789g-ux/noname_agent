import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbkuangzhan" | "dcsbkangyong">} */
export const groupSkills = {
	/*dcsbzhiwang: {
		audio: 2,
		trigger: { player: "dying" },
		filter(event, player) {
			const evt = event.getParent(),
				evtx = event.getParent(3);
			if (!evt || evt.name != "damage" || !evtx || evtx.name != "useCard") {
				return false;
			}
			return game.hasPlayer(target => target != player);
		},
		usable: 1,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), lib.filter.notMe)
				.set("ai", target => {
					return get.attitude(get.event().player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			if (trigger.source) {
				delete trigger.source;
			}
			if (trigger.getParent().source) {
				delete trigger.getParent().source;
			}
			event.targets[0].addTempSkill("dcsbzhiwang_effect");
			event.targets[0].markAuto("dcsbzhiwang_effect", [player]);
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { global: "phaseEnd" },
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					let cards = game
						.getGlobalHistory("everything", evt => {
							if (evt.name != "dying") {
								return false;
							}
							if (!player.getStorage("dcsbzhiwang_effect").includes(evt.player)) {
								return false;
							}
							const evtx = evt.getParent(3);
							return (evtx.cards || []).someInD("d");
						})
						.reduce((cards, evt) => cards.addArray(evt.getParent(3).cards.filterInD("d")), []);
					while (cards.length) {
						const result = await player
							.chooseButton(["质亡：是否使用其中的一张牌？", cards])
							.set("filterButton", button => {
								return get.event().player.hasUseTarget(button.link, false);
							})
							.set("ai", button => {
								if (button.link.name == "jiu") {
									return 10;
								}
								return get.event().player.getUseValue(button.link);
							})
							.forResult();
						if (result.bool) {
							const card = result.links[0];
							cards.remove(card);
							player.$gain2(card, false);
							await game.delayx();
							await player.chooseUseTarget(true, card, false);
						}
					}
				},
				intro: { content: "本回合结束时，可以使用令$进入濒死的牌" },
			},
		},
	},*/
	//典韦
	dcsbkuangzhan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") < player.maxHp;
		},
		async content(event, trigger, player) {
			await player.drawTo(player.maxHp);
			let num = 0;
			player.getHistory("gain", evt => {
				if (evt.getParent(event.name) == event) {
					num += evt.cards.length;
				}
			});
			while (num > 0 && player.countCards("h")) {
				num--;
				if (!game.hasPlayer(current => player.canCompare(current))) {
					break;
				}
				const result = await player
					.chooseTarget("狂战：与一名角色拼点", true, function (card, player, target) {
						return target != player && player.canCompare(target);
					})
					.set("ai", function (target) {
						const player = get.player();
						if (target.countCards("h") >= player.countCards("h")) {
							return 0;
						}
						return get.effect(target, { name: "sha" }, player, player) + 1;
					})
					.forResult();
				const target = result.targets[0];
				const compare = await player.chooseToCompare(target).forResult();
				if (!player.storage[event.name]) {
					player.storage[event.name] = [];
					player.when({ global: "phaseEnd" }).step(async () => {
						delete player.storage.dcsbkuangzhan;
					});
				}
				if (compare.bool) {
					player.storage[event.name].add(target);
					let card = { name: "sha", isCard: true };
					let targets = player.storage[event.name].filter(current => current != player && player.canUse(card, current, false));
					await player.useCard(card, targets, false);
				} else {
					player.storage[event.name].add(player);
					let card = { name: "sha", isCard: true };
					if (target.canUse(card, player, false)) {
						await target.useCard(card, player, false);
					}
				}
			}
		},
		ai: {
			order: 1,
			result: {
				player(player, target) {
					let num = player.maxHp - player.countCards("h");
					for (let i of game.players) {
						if (get.attitude(player, i) <= 0) {
							num -= i.countCards("h");
						}
					}
					if (num <= 0) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	dcsbkangyong: {
		audio: 2,
		trigger: {
			player: ["phaseBegin", "phaseEnd"],
		},
		filter(event, player, name) {
			if (name == "phaseBegin") {
				return player.isDamaged();
			}
			return event.kangyongRecover && player.hp > 1;
		},
		forced: true,
		async content(event, trigger, player) {
			if (event.triggername == "phaseBegin") {
				const num = player.maxHp - player.hp;
				await player.recover(num);
				trigger.kangyongRecover = num;
			} else {
				const num = Math.min(player.hp - 1, trigger.kangyongRecover);
				if (num > 0) {
					await player.loseHp(num);
				}
			}
		},
	},
};
