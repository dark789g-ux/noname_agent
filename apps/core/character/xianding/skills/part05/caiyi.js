import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "caiyi" | "guili" | "dcsuifu" | "dcpijing">} */
export const groupSkills = {
	//蓝曹华
	caiyi: {
		audio: 2,
		zhuanhuanji: true,
		trigger: { player: "phaseJieshuBegin" },
		onremove(player) {
			delete player.storage.caiyi;
			delete player.storage.caiyi_info;
		},
		filter(event, player) {
			if (player.storage.caiyi_info) {
				if (player.storage.caiyi_info[player.storage.caiyi ? 1 : 0].length >= 4) {
					return false;
				}
			}
			return true;
		},
		choices: [
			["回复X点体力", "摸X张牌", "复原武将牌", "随机执行一个已经移除过的选项"],
			["受到X点伤害", "弃置X张牌", "翻面并横置", "随机执行一个已经移除过的选项"],
		],
		filterx: [
			[() => true /*player => player.isDamaged()*/, () => true, /*player => player.isTurnedOver() || player.isLinked()*/ () => true, () => true],
			[
				() => true,
				/*player =>
					player.hasCard(function (card) {
						return lib.filter.cardDiscardable(card, player, "caiyi");
					}, "he"),*/
				() => true,
				/*player => !player.isTurnedOver() || !player.isLinked(),*/
				() => true,
				() => true,
			],
		],
		async cost(event, trigger, player) {
			player.storage.caiyi_info ??= [[], []];
			const index = player.storage.caiyi ? 1 : 0;
			const list = player.storage.caiyi_info[index],
				choices = lib.skill[event.skill].choices[index],
				numbers = ["⒈", "；⒉", "；⒊", "；⒋"];
			let num = 4 - list.length;
			let str = "令一名角色选择执行其中一项：";
			for (let i = 0; i < 4; i++) {
				if (list.includes(i)) {
					continue;
				}
				if (i == 3 && !list.length) {
					continue;
				}
				str += numbers.shift();
				str += choices[i];
			}
			str += "。";
			num++;
			str = str.replace(/X/g, function (match, index) {
				return get.cnNumber(num++);
			});
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("caiyi") + "（当前状态：" + (!index ? "阳" : "阴") + "）",
					prompt2: str,
					ai(target) {
						const player = _status.event.player;
						return (player.storage.caiyi ? -1 : 1) * get.attitude(player, target);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.storage.caiyi_info ??= [[], []];
			const index = (event.index = player.storage.caiyi ? 1 : 0);
			const list = player.storage.caiyi_info[index];
			const num = (event.num = 4 - list.length);
			const {
				targets: [target],
			} = event;
			event.target = target;
			player.changeZhuanhuanji(event.name);
			if (index == 0) {
				const list = [];
				const getStr = num => get.cnNumber(num);
				let choiceList = ["回复" + getStr(num + 1) + "点体力。", "摸" + getStr(num + 2) + "张牌。", "将武将牌翻至正面且重置。", "随机执行一个已经被移除的选项。"];
				const storage = player.storage.caiyi_info[event.index];
				for (let i = 0; i < 4; i++) {
					if (storage.includes(i)) {
						choiceList[i] = '<span style="text-decoration:line-through; opacity:0.5; ">' + choiceList[i] + "</span>";
					} else if (!lib.skill.caiyi.filterx[event.index][i](target) || (i == 3 && !storage.length)) {
						choiceList[i] = '<span style="opacity:0.5;">' + choiceList[i] + "</span>";
					} else {
						list.push("选项" + get.cnNumber(i + 1, true));
					}
				}
				if (!list.length) {
					return;
				}
				const result = await target
					.chooseControl({
						controls: list,
						choiceList,
						ai() {
							const evt = _status.event,
								player = evt.player;
							const list = evt.controls.slice(0);
							const gett = function (choice) {
								if (choice == "cancel2") {
									return 0.1;
								}
								let max = 0,
									func = {
										选项一(current) {
											max = get.recoverEffect(current, player, player) * Math.min(evt.getParent().num + 1, player.getDamagedHp());
										},
										选项二(target) {
											max = get.effect(target, { name: "draw" }, player, player) * (evt.getParent().num + 2);
										},
										选项三(target) {
											if (player.isTurnedOver()) {
												max += 25;
											}
											if (player.isLinked()) {
												max += get.effect(player, { name: "tiesuo" }, player, player);
											}
										},
										选项四(target) {
											max = 3;
										},
									}[choice];
								func(player);
								return max;
							};
							return list.sort(function (a, b) {
								return gett(b) - gett(a);
							})[0];
						},
					})
					.forResult();
				let index2 = ["选项一", "选项二", "选项三", "选项四"].indexOf(result.control);
				player.storage.caiyi_info[event.index].add(index2);
				if (index2 == 3) {
					const list = player.storage.caiyi_info[event.index].filter(function (i) {
						return i != 3 && lib.skill.caiyi.filterx[event.index][i](target);
					});
					if (!list.length) {
						return;
					}
					index2 = list.randomGet();
				}
				switch (index2) {
					case 0:
						await target.recover({ num: num + 1 });
						break;
					case 1:
						await target.draw({ num: num + 2 });
						break;
					case 2:
						await target.turnOver(false);
						await target.link(false);
						break;
				}
			} else if (index == 1) {
				const list = [];
				const getStr = num => get.cnNumber(num);
				let choiceList = ["受到" + getStr(num + 1) + "点伤害。", "弃置" + getStr(num + 2) + "张牌。", "将武将牌翻至背面并横置。", "随机执行一个已经被移除的选项。"];
				const storage = player.storage.caiyi_info[event.index];
				for (let i = 0; i < 4; i++) {
					if (storage.includes(i)) {
						choiceList[i] = '<span style="text-decoration:line-through; opacity:0.5; ">' + choiceList[i] + "</span>";
					} else if (!lib.skill.caiyi.filterx[event.index][i](target) || (i == 3 && !storage.length)) {
						choiceList[i] = '<span style="opacity:0.5;">' + choiceList[i] + "</span>";
					} else {
						list.push("选项" + get.cnNumber(i + 1, true));
					}
				}
				if (!list.length) {
					return;
				}
				const result = await target
					.chooseControl({
						controls: list,
						choiceList,
						ai() {
							const evt = _status.event,
								player = evt.player;
							const list = evt.controls.slice(0);
							const gett = function (choice) {
								if (choice == "cancel2") {
									return 0.1;
								}
								let max = 0,
									func = {
										选项一(current) {
											max = get.effect(current, { name: "damage" }, player, player) * (evt.getParent().num + 1);
										},
										选项二(target) {
											max = get.effect(target, { name: "guohe_copy2" }, player, player) * Math.min(player.countCards("he"), evt.getParent().num + 2);
										},
										选项三(target) {
											if (!player.isTurnedOver()) {
												max -= 20;
											}
											if (!player.isLinked()) {
												max += get.effect(player, { name: "tiesuo" }, player, player);
											}
										},
										选项四(target) {
											max = -3;
										},
									}[choice];
								func(player);
								return max;
							};
							return list.sort(function (a, b) {
								return gett(b) - gett(a);
							})[0];
						},
					})
					.forResult();
				let index2 = ["选项一", "选项二", "选项三", "选项四"].indexOf(result.control);
				player.storage.caiyi_info[event.index].add(index2);
				if (index2 == 3) {
					const list = player.storage.caiyi_info[event.index].filter(function (i) {
						return i != 3 && lib.skill.caiyi.filterx[event.index][i](target);
					});
					if (!list.length) {
						return;
					}
					index2 = list.randomGet();
				}
				switch (index2) {
					case 0:
						await target.damage({ num: num + 1 });
						break;
					case 1:
						await target.chooseToDiscard({ selectCard: num + 2, forced: true, position: "he" });
						break;
					case 2:
						await target.turnOver(true);
						await target.link(true);
						break;
				}
			}
		},
		mark: true,
		marktext: "☯",
		intro: {
			content(storage) {
				if (storage) {
					return "转换技。结束阶段，你可令一名角色选择并执行一项，然后移除此选项：⒈受到X点伤害。⒉弃置X张牌。⒊翻面并横置。⒋随机执行一个已经移除过的阳选项。（X为该阴阳态剩余选项的数量）。";
				}
				return "转换技。结束阶段，你可令一名角色选择并执行一项，然后移除此选项：⒈回复X点体力。⒉摸X张牌，⒊复原武将牌。⒋随机执行一个已经移除过的阴选项。⒋随机执行一个已经移除过的阳选项。（X为该阴阳态剩余选项的数量）。";
			},
		},
	},
	guili: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		forced: true,
		locked: false,
		filter(event, player) {
			return player.phaseNumber == 1 && game.hasPlayer(current => current != player);
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseTarget(lib.filter.notMe, true, "请选择【归离】的目标", lib.translate.guili_info)
				.set("ai", function (target) {
					return -get.threaten(target);
				})
				.forResult();
			if (result.targets?.length) {
				const target = result.targets[0];
				player.line(target, "green");
				game.log(player, "选择了", target);
				player.setStorage("guili_insert", target);
				player.addSkill("guili_insert");
				await game.delayx();
			}
		},
		onremove: true,
		subSkill: {
			insert: {
				audio: "guili",
				mark: true,
				intro: {
					content: "players",
				},
				trigger: { global: "phaseAfter" },
				forced: true,
				charlotte: true,
				logTarget: "player",
				filter(event, player) {
					if (event.player != player.storage.guili_insert) {
						return false;
					}
					if (event.player.getHistory("sourceDamage").length > 0) {
						return false;
					}
					var history = event.player.actionHistory;
					if (history[history.length - 1].isRound) {
						return true;
					}
					for (var i = history.length - 2; i >= 0; i--) {
						if (history[i].isMe) {
							return false;
						}
						if (history[i].isRound) {
							return true;
						}
					}
					return false;
				},
				async content(event, trigger, player) {
					player.insertPhase();
				},
			},
		},
	},
	//刘虞
	dcsuifu: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			if (player == event.player) {
				return false;
			}
			let num = 0;
			game.countPlayer(function (current) {
				if (current == player || current.getSeatNum() == 1) {
					current.getHistory("damage", function (evt) {
						num += evt.num;
					});
				}
			});
			return num >= 2;
		},
		seatRelated: true,
		logTarget: "player",
		check(event, player) {
			return get.attitude(player, event.player) <= 0;
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const cards = target.getCards("h");
			if (cards.length) {
				game.log(player, "将", target, "的", get.cnNumber(cards.length), "张手牌置于牌堆顶");
				target.$throw(cards.length, 1000);
				await target.lose(cards, ui.cardPile, "insert");
			}
			await game.delayx();
			await player.chooseUseTarget({ name: "wugu", isCard: true }, true);
		},
	},
	dcpijing: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget([1, game.countPlayer()], get.prompt("dcpijing"), "令任意名角色获得技能〖自牧〗")
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			targets.add(player);
			await game.doAsyncInOrder(game.players, async target => {
				if (!targets.includes(target)) {
					return target.removeSkills("dczimu");
				} else {
					return target.addSkills("dczimu");
				}
			});
			await game.delayx();
		},
		derivation: "dczimu",
	},
};
