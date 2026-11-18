import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twsbfangzhu" | "twyuanbu" | "twsbsongwei">} */
export const groupSkills = {
	twsbfangzhu: {
		audio: "sbfangzhu",
		trigger: {
			player: "damageEnd",
		},
		filter(event, player) {
			return (
				event.source?.isIn() &&
				event.source
					.getRoundHistory("sourceDamage", evt => {
						return evt.player == player;
					})
					.indexOf(event) == 0
			);
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([
					get.prompt(event.skill, trigger.source),
					[
						[
							["fengyin", `令其非锁定技失效并获得${get.poptip("twyuanbu")}直到其下个回合结束`],
							["gongsun", "令其不能使用或打出当前手牌直到其下个回合结束"],
						],
						"textbutton",
					],
				])
				.set("att", get.attitude(player, trigger.source))
				.set("ai", button => {
					if (get.event().att > 0) {
						return 0;
					}
					return Math.random();
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		logTarget: "source",
		async content(event, trigger, player) {
			const {
					targets: [target],
					cost_data,
					name,
				} = event,
				skill = `${name}_${cost_data}`,
				phase = trigger.getParent("phase");
			target.addSkill(skill);
			if (cost_data == "fengyin") {
				target.addAdditionalSkills(skill, "twyuanbu");
				target.markAuto(skill, [phase]);
			} else {
				target.markAuto(skill, [[phase, target.getCards("h")]]);
				target.addGaintag(target.getCards("h"), "twsbfangzhu");
			}
		},
		group: "twsbfangzhu_liufang",
		subSkill: {
			liufang: {
				trigger: {
					global: "phaseBegin",
				},
				filter(event, player) {
					if (player.hasSkill("twsbfangzhu_used")) {
						return false;
					}
					return game.countPlayer(() => true) >= 3;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(
							get.prompt(event.skill),
							"每轮限一次，你可令一名角色与其下家交换座次（不能包含当前回合角色）",
							(card, player, target) => {
								if (!_status.currentPhase) {
									return true;
								}
								const cannot = _status.currentPhase;
								return target != cannot && target != cannot.getPrevious();
							}
						)
						.set("ai", target => {
							const player = get.player(),
								targetx = target.getNext();
							let eff = -get.attitude(player, target);
							if (targetx?.isIn()) {
								eff += get.attitude(player, targetx);
							}
							return eff;
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0],
						targetx = target.getNext();
					player.addTempSkill("twsbfangzhu_used", { global: "roundStart" });
					game.broadcastAll(
						function (target1, target2) {
							game.swapSeat(target1, target2);
						},
						target,
						targetx
					);
				},
			},
			used: {
				charlotte: true,
			},
			fengyin: {
				init: function (player, skill) {
					player.addSkillBlocker(skill);
					player.addTip(skill, "放逐 远步");
				},
				onremove: function (player, skill) {
					player.removeSkillBlocker(skill);
					player.removeTip(skill);
					player.setStorage(skill, []);
				},
				trigger: {
					player: "phaseEnd",
				},
				async cost(event, trigger, player) {
					const list = player.getStorage(event.skill);
					if (list.length && list.some(phase => phase == trigger)) {
						player.setStorage(
							event.skill,
							list.filter(phase => phase == trigger)
						);
					} else {
						player.removeSkill(event.skill);
					}
				},
				charlotte: true,
				skillBlocker: function (skill, player) {
					return !lib.skill[skill].persevereSkill && !lib.skill[skill].charlotte && !get.is.locked(skill, player);
				},
				mark: true,
				intro: {
					markcount: () => null,
					content: function (storage, player, skill) {
						var list = player.getSkills(null, false, false).filter(function (i) {
							return lib.skill.fengyin.skillBlocker(i, player);
						});
						if (list.length) {
							return "失效技能：" + get.translation(list);
						}
						return "无失效技能";
					},
				},
			},
			gongsun: {
				init: function (player, skill) {
					player.addTip(skill, "放逐 限牌");
				},
				onremove: function (player, skill) {
					player.removeTip(skill);
					player.setStorage(skill, []);
					player.removeGaintag("twsbfangzhu");
				},
				trigger: {
					player: "phaseEnd",
				},
				async cost(event, trigger, player) {
					const list = player.getStorage(event.skill);
					if (list.length && list.some(list => list[0] == trigger)) {
						player.setStorage(
							event.skill,
							list.filter(list => list[0] == trigger)
						);
						player.removeGaintag("twsbfangzhu");
						const cards = [];
						for (let i of list) {
							if (i[0] !== trigger) {
								continue;
							}
							cards.addArray(i[1]);
						}
						player.addGaintag(cards, "twsbfangzhu");
					} else {
						player.removeSkill(event.skill);
					}
				},
				charlotte: true,
				mod: {
					cardEnabled(card, player) {
						const cards = [card];
						if (Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						}
						const blocks = [],
							list = player.getStorage("twsbfangzhu_gongsun");
						for (let i of list) {
							if (Array.isArray(i) && Array.isArray(i[1])) {
								blocks.addArray(i[1]);
							}
						}
						if (cards.containsSome(...blocks)) {
							return false;
						}
					},
					cardSavable(card, player) {
						const cards = [card];
						if (Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						}
						const blocks = [],
							list = player.getStorage("twsbfangzhu_gongsun");
						for (let i of list) {
							if (Array.isArray(i) && Array.isArray(i[1])) {
								blocks.addArray(i[1]);
							}
						}
						if (cards.containsSome(...blocks)) {
							return false;
						}
					},
					cardRespondable(card, player) {
						const cards = [card];
						if (Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						}
						const blocks = [],
							list = player.getStorage("twsbfangzhu_gongsun");
						for (let i of list) {
							if (Array.isArray(i) && Array.isArray(i[1])) {
								blocks.addArray(i[1]);
							}
						}
						if (cards.containsSome(...blocks)) {
							return false;
						}
					},
				},
			},
		},
		derivation: "twyuanbu",
	},
	twyuanbu: {
		audio: 2,
		mod: {
			maxHandcard(player, num) {
				return (
					num +
					Math.min(
						4,
						game.countPlayer(current => current != player)
					)
				);
			},
			globalFrom(from, to, num) {
				return (
					num +
					Math.min(
						4,
						game.countPlayer(current => current != from)
					)
				);
			},
			globalTo(from, to, num) {
				return (
					num +
					Math.min(
						4,
						game.countPlayer(current => current != to)
					)
				);
			},
		},
	},
	twsbsongwei: {
		audio: "sbsongwei",
		trigger: {
			global: "phaseBegin",
		},
		forced: true,
		zhuSkill: true,
		getPhases() {
			let evts = game.getAllGlobalHistory("everything", evt => evt.name == "phase");
			const evt = evts
				.slice(0)
				.reverse()
				.find(evt => evt._roundStart);
			if (evt) {
				evts = evts.slice(evts.indexOf(evt));
			}
			return evts.filter(evt => !evt._cancelled && !evt._finished);
		},
		filter(event, player) {
			if (event.player == player || event.player.group != "wei") {
				return false;
			}
			const evts = get.info("twsbsongwei").getPhases();
			return (
				game.countPlayer(current => {
					return evts.every(evt => evt.player != current);
				}) > 0
			);
		},
		async content(event, trigger, player) {
			const evts = get.info(event.name).getPhases();
			const num = Math.min(
				3,
				game.countPlayer(current => evts.every(evt => evt.player != current))
			);
			await player.draw(num);
		},
	},
};
