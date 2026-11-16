import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dclaoyan" | "dcjueyan" | "dcrejueyan">} */
export const groupSkills = {
	//张怀
	dclaoyan: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return event.player !== player && event.targets.length > 1;
		},
		forced: true,
		logTarget(event, player) {
			return event.targets.filter(i => i !== player);
		},
		async content(event, trigger, player) {
			trigger.getParent().excluded.addArray(event.targets);
			game.log(trigger.card, "对", event.targets, "无效");
			let number = get.number(trigger.card);
			if (typeof number === "number") {
				let gains = [];
				number--;
				while (number > 0) {
					const card = get.cardPile2(card => get.number(card) === number);
					if (card) {
						gains.push(card);
					}
					number--;
				}
				if (gains.length) {
					player.addTempSkill("dclaoyan_effect");
					const next = player.gain(gains, "gain2");
					next.gaintag.add("dclaoyan_effect");
					await next;
				}
			}
		},
		global: "dclaoyan_zhuiji",
		subSkill: {
			effect: {
				charlotte: true,
				trigger: { global: "phaseEnd" },
				forced: true,
				popup: false,
				content() {
					const cards = player.getCards("h", card => card.hasGaintag(event.name) && lib.filter.cardDiscardable(card, player));
					if (cards.length) {
						player.discard(cards);
					}
				},
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
			},
			//孩子们，原谅我这个梗小鬼还在玩牢大梗
			zhuiji: {
				ai: {
					effect: {
						player_use(card, player) {
							if (_status._zhuiji_check || typeof card !== "object") {
								return;
							}
							const targets = game.filterPlayer(target => player.canUse(card, target) && target.hasSkill("dclaoyan")).sortBySeat(player);
							if (!targets.length || game.countPlayer(target => player.canUse(card, target)) < 2) {
								return;
							}
							const select = get.info(card).selectTarget;
							let range;
							if (select === undefined) {
								range = [1, 1];
							} else if (typeof select === "number") {
								range = [select, select];
							} else if (get.itemtype(select) === "select") {
								range = select;
							} else if (typeof select == "function") {
								range = select(card, player);
								if (typeof range == "number") {
									range = [range, range];
								}
							}
							game.checkMod(card, player, range, "selectTarget", player);
							if (range[1] === -1 || (range[1] > 1 && ui.selected.targets?.length)) {
								_status._zhuiji_check = true;
								const result = get.effect(targets[0], card, player, player);
								delete _status._zhuiji_check;
								return [0, result];
							}
						},
					},
				},
			},
		},
	},
	dcjueyan: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (!event.targets || event.targets.length !== 1) {
				return false;
			}
			if (event.targets[0] === player || !event.targets[0].isIn()) {
				return false;
			}
			return player.storage.dcjueyan[3] || player.canCompare(event.targets[0]);
		},
		logTarget: event => event.targets[0],
		check(event, player) {
			const [target] = event.targets,
				storage = player.storage.dcjueyan;
			if (!storage[3] && get.attitude(player, target) > 0) {
				return false;
			}
			return Math.max(...[(get.damageEffect(player, player, player) + get.damageEffect(target, player, player)) * storage[0], get.recoverEffect(player, player, player) * storage[1], get.effect(target, { name: "shunshou_copy", position: "h" }, player, player) * Math.min(target.countGainableCards(player, "h") - !storage[3], storage[2])]) > 0;
		},
		async content(event, trigger, player) {
			const [target] = trigger.targets,
				storage = player.storage[event.name];
			const goon = storage[3] || (await player.chooseToCompare(target).forResult()).bool;
			if (!goon) {
				return;
			}
			let list = ["造成伤害", "回复体力", "获得手牌"],
				choices = list.slice(); ///[list[0]];
			let choiceList = ["依次对你与" + get.translation(target) + "各造成" + storage[0] + "点伤害", "回复" + storage[1] + "点体力", "获得" + get.translation(target) + get.cnNumber(storage[2]) + "张手牌"];
			/*
			因为可以叠数值所以不能执行的也能选（?）
			if (player.isDamaged()) choices.add("回复体力");
			else choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "（无法选择）</span>";
			if (target.countCards("h")) choices.add("获得手牌");
			else choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "（无法选择）</span>";
			*/
			const choice =
				choices.length > 1
					? (
							await player
								.chooseControl(choices)
								.set("ai", () => {
									const player = get.player(),
										target = get.event().getParent().targets[0],
										storage = player.storage.dcjueyan;
									const map = {
										造成伤害: (get.damageEffect(player, player, player) + get.damageEffect(target, player, player)) * storage[0],
										回复体力: get.recoverEffect(player, player, player) * storage[1],
										获得手牌: get.effect(target, { name: "shunshou_copy", position: "h" }, player, player) * Math.min(target.countGainableCards(player, "h"), storage[2]),
									};
									return get
										.event()
										.controls.slice()
										.sort((a, b) => map[b] - map[a])[0];
								})
								.set("choiceList", choiceList)
								.set("prompt", "诀言：请选择一项执行，执行后该项目数值变为1，其余项目数值+1")
								.forResult()
						).control
					: choices[0];
			const index = (event.index = list.indexOf(choice));
			switch (index) {
				case 0:
					await player.damage(storage[0]);
					await target.damage(storage[0]);
					break;
				case 1:
					await player.recover(storage[1]);
					break;
				case 2:
					await player.gainPlayerCard(target, "h", storage[2], true);
					break;
			}
			if (Array.isArray(player.storage[event.name])) {
				player.storage[event.name][index] = 1;
				const nums = Array.from({ length: 3 })
					.map((_, i) => i)
					.filter(i => i !== index);
				for (const num of nums) {
					player.storage[event.name][num]++;
				}
				get.info(event.name).updateMark(player, event.name);
				if (
					!storage[3] &&
					Array.from({ length: 3 })
						.map((_, i) => i)
						.every(num => {
							return (
								game.getAllGlobalHistory("everything", evt => {
									return evt.name === event.name && evt.player === player && evt.index === num;
								}).length > 0
							);
						})
				) {
					player.storage[event.name][3] = true;
					player.popup(event.name);
					game.log(player, "修改了技能", "#g【" + get.translation(event.name) + "】");
				}
			}
		},
		init(player, skill) {
			player.storage[skill] = [1, 1, 1, false];
			get.info(skill).updateMark(player, skill);
		},
		onremove(player, skill) {
			player.removeTip(skill);
			delete player.storage[skill];
		},
		updateMark(player, skill) {
			player.markSkill(skill);
			player.addTip(skill, [get.translation(skill), ...player.storage[skill].slice(0, 3)].join(" "));
		},
		intro: {
			markcount: storage =>
				storage
					.slice(0, 3)
					.map(i => i.toString())
					.join(""),
			content: storage => "当前选项数值为：" + storage.slice(0, 3),
		},
	},
	dcrejueyan: {
		audio: "dcjueyan",
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (player.getStorage("dcrejueyan_used").includes(get.type2(event.card))) {
				return false;
			}
			return event.targets?.length === 1;
		},
		async cost(event, trigger, player) {
			const storage = player.getStorage(event.skill, [1, 1, 1, false]);
			let list = ["摸牌", "拿牌", "拼点"],
				choices = [list[0]];
			let choiceList = ["摸" + get.cnNumber(storage[0]) + "张牌", "随机从弃牌堆获得" + get.cnNumber(storage[1]) + "张牌", "与一名角色拼点，赢的角色对没赢的角色造成" + storage[2] + "点伤害"];
			if (Array.from(ui.discardPile.childNodes).length) {
				choices.add("拿牌");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "（无法选择）</span>";
			}
			if (game.hasPlayer(target => player.canCompare(target))) {
				choices.add("拼点");
			} else {
				choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "（无法选择）</span>";
			}
			const { control: choice } = await player
				.chooseControl(choices, "cancel2")
				.set("ai", () => {
					const player = get.player(),
						storage = player.getStorage("dcrejueyan", [1, 1, 1, false]);
					const map = {
						摸牌: get.effect(player, { name: "draw" }, player, player) * storage[0],
						拿牌: get.effect(player, { name: "draw" }, player, player) * Math.min(Array.from(ui.discardPile.childNodes).length, storage[1]),
						拼点: Math.max(...[0].concat(game.filterPlayer(target => player.canCompare(target)).map(target => get.effect(target, "hannan", player, player)))),
					};
					return get
						.event()
						.controls.slice()
						.sort((a, b) => map[b] - map[a])[0];
				})
				.set("choiceList", choiceList)
				.set("prompt", [get.prompt(event.skill), '<div class="text center">你可以选择一项执行，执行后该项目数值变为1，其余项目数值+1</div>'].map(str => "###" + str).join(""))
				.forResult();
			if (!choice || choice === "cancel2") {
				event.result = { bool: false };
			} else {
				event.result = { bool: true, cost_data: list.indexOf(choice) };
			}
		},
		async content(event, trigger, player) {
			player.addTempSkill("dcrejueyan_used");
			player.markAuto("dcrejueyan_used", [get.type2(trigger.card)]);
			const storage = player.getStorage(event.name, [1, 1, 1, false]);
			const index = event.cost_data;
			switch (index) {
				case 0:
					await player.draw(storage[0]);
					break;
				case 1:
					await player.gain(Array.from(ui.discardPile.childNodes).randomGets(storage[1]));
					break;
				case 2: {
					const result = await player
						.chooseTarget(
							true,
							(card, player, target) => {
								return player.canCompare(target);
							},
							"与一名角色拼点，赢的角色对没赢的角色造成" + storage[2] + "点伤害"
						)
						.set("ai", target => {
							const player = get.player();
							return get.effect(target, "hannan", player, player);
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						const target = result.targets[0];
						const result2 = await player.chooseToCompare(target).forResult();
						if (result2) {
							if (!result2.tie) {
								const winner = result2.bool ? player : target;
								const loser = !result2.bool ? player : target;
								winner.line(loser);
								await loser.damage(storage[2], winner);
							}
						}
					}
					break;
				}
			}
			if (Array.isArray(player.storage[event.name])) {
				player.storage[event.name][index] = 1;
				const nums = Array.from({ length: 3 })
					.map((_, i) => i)
					.filter(i => i !== index);
				for (const num of nums) {
					if (player.storage[event.name][num] < 3) {
						player.storage[event.name][num]++;
					}
				}
				get.info(event.name).updateMark(player, event.name);
			}
		},
		init(player, skill) {
			player.storage[skill] = [1, 1, 1, false];
			get.info(skill).updateMark(player, skill);
		},
		onremove(player, skill) {
			player.removeTip(skill);
			delete player.storage[skill];
		},
		updateMark(player, skill) {
			player.markSkill(skill);
			player.addTip(skill, [get.translation(skill), ...player.storage[skill].slice(0, 3)].join(" "));
		},
		intro: {
			markcount: storage =>
				storage
					.slice(0, 3)
					.map(i => i.toString())
					.join(""),
			content: storage => "当前选项数值为：" + storage.slice(0, 3),
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
};
