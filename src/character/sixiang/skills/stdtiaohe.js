import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdtiaohe" | "stdqiansu">} */
export const groupSkills = {
	//F1
	stdtiaohe: {
		audio: "fyjianyu",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(tar1 => {
				return (
					tar1.countDiscardableCards(player, "e", i => get.subtype(i) == "equip2") &&
					game.hasPlayer(tar2 => {
						return tar1 !== tar2 && tar2.countDiscardableCards(player, "e");
					})
				);
			});
			// 下面是将判定区内的装备牌也考虑在内的
			// let e = 0,
			// 	fj = false;
			// game.countPlayer(target => {
			// 	let es = target.getDiscardableCards(player, "e"),
			// 		js = target.getDiscardableCards(player, "j", i => get.type(i) == "equip");
			// 	if (es.length) {
			// 		e++;
			// 	}
			// 	e += js.length;
			// 	if (!fj && (es.some(card => get.subtype(card) == "equip2") || js.some(card => get.subtype(card) == "equip2"))) {
			// 		fj = true;
			// 	}
			// });
			// return fj && e >= 2;
		},
		filterTarget(card, player, target) {
			if (!ui.selected.targets.length || ui.selected.targets[0].countDiscardableCards(player, "e", i => get.subtype(i) == "equip2")) {
				return target.countDiscardableCards(player, "e");
			}
			return target.countDiscardableCards(player, "e", i => get.subtype(i) == "equip2");
			// let e = 0;
			// let es = target.getDiscardableCards(player, "e"),
			// 	js = target.getDiscardableCards(player, "j", i => get.type(i) == "equip");
			// if (es.length) {
			// 	e++;
			// }
			// e += js.length;
			// if (!e) {
			// 	return false;
			// }
			// if (!ui.selected.targets.length) {
			// 	return true;
			// }
			// if (!ui.selected.targets[0].countDiscardableCards(player, "ej", i => get.subtype(i) == "equip2")) {
			// 	return es.some(card => get.subtype(card) == "equip2") || js.some(card => get.subtype(card) == "equip2");
			// }
			// return true;
		},
		selectTarget() {
			return 2;
			// /-?
			// if (!ui.selected.targets.length) {
			// 	return [1, 2];
			// }
			// let e = 0,
			// 	player = get.event().player,
			// 	target = ui.selected.targets[0];
			// let es = target.getDiscardableCards(player, "e"),
			// 	js = target.getDiscardableCards(player, "j", i => get.type(i) == "equip");
			// if (es.length) {
			// 	e++;
			// }
			// e += js.length;
			// if (e >= 2 && (es.some(card => get.subtype(card) == "equip2") || js.some(card => get.subtype(card) == "equip2"))) {
			// 	return [1, 2];
			// }
			// return 2;
		},
		complexTarget: true,
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const targets = event.targets.slice();
			if (targets.length == 1) {
				await player
					.discardPlayerCard("ej", targets[0], true, 2)
					.set("filterButton", button => {
						let position = get.position(button.link),
							subtype = get.subtype(button.link);
						if (!subtype || !subtype.startsWith("equip")) {
							return false;
						}
						if (ui.selected.buttons.length) {
							let pos = get.position(ui.selected.buttons[0].link),
								sub = get.subtype(ui.selected.buttons[0].link);
							if (pos == "e" && position == "e") {
								return false;
							}
							if (sub == "equip2") {
								return true;
							}
							return subtype == "equip2";
						}
						if (position == "e") {
							if (!get.event().js.some(i => get.subtype(i) == "equip2")) {
								return subtype == "equip2";
							}
							return true;
						}
						if (!get.event().es.length) {
							return subtype == "equip2";
						}
						return true;
					})
					.set(
						"es",
						targets[0].getDiscardableCards(player, "e", i => get.subtype(i) == "equip2")
					)
					.set(
						"js",
						targets[0].getDiscardableCards(player, "j", i => get.type(i) == "equip")
					);
				return;
			}
			let canfj = targets.filter(target => {
				return target.countDiscardableCards(player, "e", i => get.subtype(i) == "equip2");
			});
			for (let i = 0; i < 2; i++) {
				if (i && canfj.includes(targets[i]) && !targets[i].countDiscardableCards(player, "e", i => get.subtype(i) == "equip2")) {
					break;
				}
				const result = await player
					.discardPlayerCard("e", targets[i], true)
					.set("filterButton", button => {
						if (get.event().fj) {
							return get.subtype(button.link) == "equip2";
						}
						// return true;
						return get.type(button.link) == "equip";
					})
					.set("fj", canfj.length === 1 && canfj.includes(targets[i]))
					.forResult();
				if (result.bool && get.subtype(result.cards[0]) == "equip2") {
					canfj = [];
				}
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					let att = get.attitude(player, target),
						es = [];
					target.countDiscardableCards(player, "e", i => {
						es.push(get.value(i, target));
					});
					let min = Math.min(...es),
						max = Math.max(...es),
						ext = target.hasSkillTag("noe") ? 10 : 0;
					if (att <= 0) {
						return ext - max;
					}
					return ext - min;
				},
			},
		},
	},
	stdqiansu: {
		audio: "shengxi_feiyi",
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return get.type2(event.card) == "trick" && !player.countCards("e");
		},
		frequent: true,
		async content(event, trigger, player) {
			player.draw();
		},
		ai: {
			noe: true,
			effect: {
				target(card, player, target) {
					if (target.countCards("e")) {
						return;
					}
					if (target == player && get.type(card) == "equip" && get.equipValue(card) < 5) {
						return 0;
					}
					if (get.type2(card) == "trick") {
						return [1, 0.6];
					}
				},
			},
		},
	},
};
