import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczhongjie" | "dcsushou">} */
export const groupSkills = {
	//赵昂
	dczhongjie: {
		audio: 2,
		round: 1,
		trigger: { global: "dying" },
		logTarget: "player",
		filter(event, player) {
			return event.player.hp < 1 && event.reason && event.reason.name == "loseHp";
		},
		check(event, player) {
			return get.attitude(player, event.player) > 2;
		},
		content() {
			trigger.player.recover();
			trigger.player.draw();
		},
		ai: {
			combo: "dcsushou",
		},
	},
	dcsushou: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			return player.hp > 0 && event.player.isMaxHandcard(true);
		},
		logTarget: "player",
		check(event, player) {
			var num = player.hp;
			if (player.hasSkill("dczhongjie") && (player.storage.dczhongjie_roundcount || 0) < game.roundNumber) {
				num++;
			}
			return num > 1;
		},
		content() {
			"step 0";
			player.loseHp();
			event.target = trigger.player;
			"step 1";
			var num = player.getDamagedHp();
			if (num > 0) {
				player.draw(num);
			}
			if (player == target) {
				event.finish();
			}
			"step 2";
			var ts = target.getCards("h");
			if (ts.length < 2) {
				event.finish();
			} else {
				var hs = player.getCards("h");
				ts = ts.randomGets(Math.floor(ts.length / 2));
				if (!hs.length) {
					player.viewCards(get.translation(target) + "的部分手牌", ts);
					event.finish();
					return;
				}
				var next = player.chooseToMove("夙守：交换至多" + get.cnNumber(Math.min(hs.length, ts.length, player.getDamagedHp())) + "张牌");
				next.set("list", [
					[get.translation(target) + "的部分手牌", ts, "dcsushou_tag"],
					["你的手牌", hs],
				]);
				next.set("filterMove", function (from, to, moved) {
					if (typeof to == "number") {
						return false;
					}
					var player = _status.event.player;
					var hs = player.getCards("h");
					var changed = hs.filter(function (card) {
						return !moved[1].includes(card);
					});
					var changed2 = moved[1].filter(function (card) {
						return !hs.includes(card);
					});
					if (changed.length < player.getDamagedHp()) {
						return true;
					}
					var pos1 = moved[0].includes(from.link) ? 0 : 1,
						pos2 = moved[0].includes(to.link) ? 0 : 1;
					if (pos1 == pos2) {
						return true;
					}
					if (pos1 == 0) {
						if (changed.includes(from.link)) {
							return true;
						}
						return changed2.includes(to.link);
					}
					if (changed2.includes(from.link)) {
						return true;
					}
					return changed.includes(to.link);
				});
				next.set("max", Math.min(hs.length, ts.length, player.getDamagedHp()));
				next.set("target", target);
				next.set("processAI", function (list) {
					const { max, target } = get.event();
					const player = get.player();
					const att = get.attitude(player, target);
					if (max > 0) {
						let gain, give;
						if (att <= 1) {
							gain = list[0][1]
								.sort((a, b) => {
									return player.getUseValue(b, null, true) - player.getUseValue(a, null, true);
								})
								.slice(0, _status.event.max);
							give = list[1][1]
								.sort((a, b) => {
									return get.value(a, player) - get.value(b, player);
								})
								.slice(0, _status.event.max);
						} else {
							give = list[1][1]
								.sort((a, b) => {
									return target.getUseValue(b, null, true) - target.getUseValue(a, null, true);
								})
								.slice(0, _status.event.max);
							gain = list[0][1]
								.sort((a, b) => {
									return get.value(a, target) - get.value(b, target);
								})
								.slice(0, _status.event.max);
						}
						for (let i of gain) {
							if (att <= 1 && get.value(i, player) < get.value(give[0], player)) {
								continue;
							}
							let j = give.shift();
							list[0][1].remove(i);
							list[0][1].push(j);
							list[1][1].remove(j);
							list[1][1].push(i);
							if (!give.length) {
								break;
							}
						}
					}
					return [list[0][1], list[1][1]];
				});
			}
			"step 3";
			var moved = result.moved;
			var hs = player.getCards("h"),
				ts = target.getCards("h");
			var cards1 = [],
				cards2 = [];
			for (var i of result.moved[0]) {
				if (!ts.includes(i)) {
					cards1.push(i);
				}
			}
			for (var i of result.moved[1]) {
				if (!hs.includes(i)) {
					cards2.push(i);
				}
			}
			if (cards1.length) {
				player.swapHandcards(target, cards1, cards2);
			}
		},
	},
};
