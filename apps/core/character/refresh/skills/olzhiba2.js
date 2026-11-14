import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const olzhiba2Skills = {
	olzhiba2: {
		ai: {
			order: 1,
			result: {
				target(player, target) {
					if (player.hasZhuSkill("olzhiba") && !player.hasSkill("olzhiba3") && target.group == "wu") {
						if (
							player.countCards("h", function (card) {
								var val = get.value(card);
								if (val < 0) {
									return true;
								}
								if (val <= 5) {
									return get.number(card) >= 12;
								}
								if (val <= 6) {
									return get.number(card) >= 13;
								}
								return false;
							}) > 0
						) {
							return -1;
						}
						return 0;
					} else {
						if (player.countCards("h", "du") && get.attitude(player, target) < 0) {
							return -1;
						}
						if (player.countCards("h") <= player.hp) {
							return 0;
						}
						var maxnum = 0;
						var cards2 = target.getCards("h");
						for (var i = 0; i < cards2.length; i++) {
							if (get.number(cards2[i]) > maxnum) {
								maxnum = get.number(cards2[i]);
							}
						}
						if (maxnum > 10) {
							maxnum = 10;
						}
						if (maxnum < 5 && cards2.length > 1) {
							maxnum = 5;
						}
						var cards = player.getCards("h");
						for (var i = 0; i < cards.length; i++) {
							if (get.number(cards[i]) < maxnum) {
								return 1;
							}
						}
						return 0;
					}
				},
			},
		},
		enable: "phaseUse",
		//usable:1,
		prompt: "请选择〖制霸〗的目标",
		filter(event, player) {
			if (
				player.hasZhuSkill("olzhiba") &&
				!player.hasSkill("olzhiba3") &&
				game.hasPlayer(function (current) {
					return current != player && current.group == "wu" && player.canCompare(current);
				})
			) {
				return true;
			}
			return (
				player.group == "wu" &&
				game.hasPlayer(function (current) {
					return current != player && current.hasZhuSkill("olzhiba", player) && !current.hasSkill("olzhiba3") && player.canCompare(current);
				})
			);
		},
		filterTarget(card, player, target) {
			if (player.hasZhuSkill("olzhiba") && !player.hasSkill("olzhiba3") && target.group == "wu" && player.canCompare(target)) {
				return true;
			}
			return player.group == "wu" && target.hasZhuSkill("olzhiba", player) && !target.hasSkill("olzhiba3") && player.canCompare(target);
		},
		prepare(cards, player, targets) {
			if (player.hasZhuSkill("olzhiba")) {
				player.logSkill("olzhiba");
			}
			if (targets[0].hasZhuSkill("olzhiba", player)) {
				targets[0].logSkill("olzhiba");
			}
		},
		direct: true,
		clearTime: true,
		async contentBefore(event, trigger, player) {
			const { targets } = event;
			const list = [];
			if (player.hasZhuSkill("olzhiba") && targets[0].group === "wu" && !player.hasSkill("olzhiba3")) {
				list.push(player);
			}
			if (player.group === "wu" && targets[0].hasZhuSkill("olzhiba") && !targets[0].hasSkill("olzhiba3")) {
				list.push(targets[0]);
			}

			let chooseRes;
			if (list.length === 1) {
				event.target = list[0];
			} else {
				chooseRes = await player
					.chooseTarget(true, "请选择获得所有拼点牌的角色", (card, pl, target) => _status.event.list.includes(target))
					.set("list", list)
					.forResult();
				if (!chooseRes?.bool) {
					return;
				}
				event.target = chooseRes.targets[0];
			}

			const target = event.target;
			target.addTempSkill("olzhiba3", "phaseUseEnd");

			let acceptRes;
			if (target === targets[0]) {
				acceptRes = await target
					.chooseBool("是否接受来自" + get.translation(player) + "的拼点请求？")
					.set(
						"choice",
						get.attitude(target, player) > 0 ||
							target.countCards("h", card => {
								const val = get.value(card);
								if (val < 0) return true;
								if (val <= 5) return get.number(card) >= 12;
								if (val <= 6) return get.number(card) >= 13;
								return false;
							}) > 0
					)
					.set("ai", () => _status.event.choice)
					.forResult();
			} else {
				acceptRes = { bool: true };
			}

			if (acceptRes.bool) {
				event.getParent().zhiba_target = target;
			} else {
				game.log(target, "拒绝了", player, "的拼点请求");
				target.chat("拒绝");
			}
		},
		async content(event, trigger, player) {
			const { target } = event;
			const parent = event.getParent();
			const source = parent?.zhiba_target;
			event.source = source;
			if (!source) {
				return;
			}

			// step 1: 比拼
			const comp = player.chooseToCompare(target).set("small", target == source && get.attitude(player, target) > 0);
			comp.clear = false;
			const cmpResult = await comp.forResult();

			// step 2: 根据拼点结果处理
			if ((player === source && cmpResult.bool) || (target === source && !cmpResult.bool)) {
				event.cards = [cmpResult.player, cmpResult.target].filterInD("d");
				if (!event.cards.length) return;

				// 询问 source 是否获得拼点牌
				const ctrl = await source
					.chooseControl("ok", "cancel2")
					.set("dialog", ["是否获得拼点牌？", event.cards])
					.set("ai", () => get.value(event.cards, source, "raw") > 0)
					.forResult();

				if (ctrl.control !== "cancel2") {
					await source.gain(event.cards, "gain2", "log");
				} else {
					ui.clear();
				}
			} else {
				return;
			}
		},
	},
	olzhiba3: {},
};
