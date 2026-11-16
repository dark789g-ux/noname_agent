import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcfumou" | "dcctjiuxian" | "dcchenyong">} */
export const groupSkills = {
	//fumo!
	dcfumou: {
		audio: 2,
		trigger: { player: "damageEnd" },
		direct: true,
		filter(event, player) {
			return player.getDamagedHp() > 0;
		},
		content() {
			"step 0";
			event.num = trigger.num;
			"step 1";
			player.chooseTarget(get.prompt2("dcfumou"), [1, player.getDamagedHp()]).set("ai", target => {
				var att = get.attitude(_status.event.player, target);
				if (target.countCards("h") >= 3 && (!target.isDamaged() || !target.countCards("e"))) {
					if (!target.canMoveCard(true)) {
						return -att / 5;
					}
				}
				return att;
			});
			"step 2";
			if (result.bool) {
				var targets = result.targets;
				targets.sortBySeat(player);
				event.targets = targets;
				player.logSkill("dcfumou", targets);
				event.num--;
			} else {
				event.finish();
			}
			"step 3";
			var target = targets.shift();
			event.target = target;
			var choices = [];
			var choiceList = ["移动场上的一张牌", "弃置所有手牌并摸两张牌", "弃置装备区里的所有牌并回复1点体力"];
			if (target.canMoveCard()) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			if (
				target.countCards("h") &&
				!target.hasCard(card => {
					return !lib.filter.cardDiscardable(card, target, "dcfumou");
				}, "h")
			) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			if (
				target.countCards("e") &&
				!target.hasCard(card => {
					return !lib.filter.cardDiscardable(card, target, "dcfumou");
				}, "h")
			) {
				choices.push("选项三");
			} else {
				choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "</span>";
			}
			if (choices.length) {
				target
					.chooseControl(choices)
					.set("prompt", "腹谋：请选择一项")
					.set("choiceList", choiceList)
					.set("ai", () => {
						return _status.event.choice;
					})
					.set(
						"choice",
						(function () {
							if (choices.length == 1) {
								return choices[0];
							}
							var func = (choice, target) => {
								switch (choice) {
									case "选项一":
										if (target.canMoveCard(true)) {
											return 5;
										}
										return 0;
									case "选项二":
										return (
											4 -
											target.getCards("h").reduce((acc, card) => {
												return acc + get.value(card);
											}, 0) /
												3
										);
									case "选项三": {
										var e2 = target.getEquip(2);
										if (target.isHealthy()) {
											return -1.8 * target.countCards("e") - (e2 ? 1 : 0);
										}
										if (!e2 && target.hp + target.countCards("hs", ["tao", "jiu"]) < 2) {
											return 6;
										}
										let rec =
											get.recoverEffect(target, target, target) / 4 -
											target.getCards("e").reduce((acc, card) => {
												return acc + get.value(card);
											}, 0) /
												3;
										if (!e2) {
											rec += 2;
										}
										return rec;
									}
								}
							};
							var choicesx = choices.map(i => [i, func(i, target)]).sort((a, b) => b[1] - a[1]);
							return choicesx[0][0];
						})()
					);
			} else {
				event.goto(5);
			}
			"step 4";
			game.log(target, "选择了", "#y" + result.control);
			if (result.control == "选项一") {
				target.moveCard(true);
			} else if (result.control == "选项二") {
				target.chooseToDiscard(true, "h", target.countCards("h"));
				target.draw(2);
			} else {
				target.chooseToDiscard(true, "e", target.countCards("e"));
				target.recover();
			}
			"step 5";
			if (event.targets.length) {
				event.goto(3);
			}
			// else if(event.num) event.goto(1);
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						var num = 1;
						if (get.attitude(player, target) > 0) {
							if (player.needsToDiscard()) {
								num = 0.7;
							} else {
								num = 0.5;
							}
						}
						if (target.hp == 2 && target.hasFriend()) {
							return [1, num * 1.5];
						}
						if (target.hp >= 2) {
							return [1, num];
						}
					}
				},
			},
		},
	},
	//陈泰
	dcctjiuxian: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard: lib.filter.cardRecastable,
		selectCard() {
			return Math.ceil(_status.event.player.countCards("h") / 2);
		},
		check(card) {
			return 6.5 - get.value(card);
		},
		discard: false,
		lose: false,
		delay: false,
		content() {
			"step 0";
			player.recast(cards);
			"step 1";
			player.addTempSkill("dcctjiuxian_help");
			player.chooseUseTarget(
				{
					name: "juedou",
					isCard: true,
					storage: { dcctjiuxian: true },
				},
				true
			);
		},
		ai: {
			order() {
				return 0.9 * get.order({ name: "juedou" });
			},
			tag: {
				respond: 2,
				respondSha: 2,
				damage: 1,
			},
			result: {
				player(player) {
					let target = null,
						maxval = 0;
					for (let i of game.players) {
						let jdeff = get.effect(
							i,
							{
								name: "juedou",
								isCard: true,
								cards: ui.selected.cards,
								storage: { dcctjiuxian: true },
							},
							player,
							player
						);
						if (
							i === player ||
							!player.canUse(
								{
									name: "juedou",
									isCard: true,
									cards: ui.selected.cards,
									storage: { dcctjiuxian: true },
								},
								i
							) ||
							jdeff < 0
						) {
							continue;
						}
						let receff = 0;
						game.filterPlayer(function (current) {
							if (player != current && i.inRange(current) && current.isDamaged()) {
								receff = Math.max(receff, get.recoverEffect(current, i, i));
							}
						});
						if (jdeff + receff / 5 > maxval) {
							target = i;
							maxval = jdeff + receff / 5;
						}
					}
					if (target) {
						return maxval / 80;
					}
					return 0;
				},
			},
		},
		subSkill: {
			help: {
				trigger: { global: "damageSource" },
				filter(event, player) {
					return (
						event.card &&
						event.card.storage &&
						event.card.storage.dcctjiuxian &&
						event.player.isIn() &&
						event.getParent(2).targets.includes(event.player) &&
						game.hasPlayer(current => {
							return current != player && event.player.inRange(current) && current.isDamaged();
						})
					);
				},
				direct: true,
				forced: true,
				charlotte: true,
				content() {
					"step 0";
					player
						.chooseTarget("救陷：是否令其攻击范围内的一名其他角色回复1点体力？", (card, player, target) => {
							if (_status.event.player == target) {
								return false;
							}
							return target.isDamaged() && _status.event.targetx.inRange(target);
						})
						.set("targetx", trigger.player)
						.set("ai", target => get.recoverEffect(target, _status.event.player, _status.event.player));
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						player.logSkill("dcctjiuxian_help", target);
						target.recover(player);
					}
				},
			},
		},
	},
	dcchenyong: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		filter(event, player) {
			return player.getHistory("useCard").length;
		},
		content() {
			var types = [];
			var history = player.getHistory("useCard");
			for (var evt of history) {
				types.add(get.type2(evt.card));
			}
			var num = types.length;
			player.draw(num);
		},
		ai: { threaten: 2.2 },
	},
};
