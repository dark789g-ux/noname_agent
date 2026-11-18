import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbduduan" | "olsbyinglve">} */
export const groupSkills = {
	//谋鲁肃 —— by 刘巴
	olsbduduan: {
		audio: 2,
		phasename: ["phaseJudge", "phaseDraw", "phaseUse", "phaseDiscard"],
		trigger: {
			player: "phaseBegin",
		},
		//frequent: true,
		check: () => true,
		async content(event, trigger, player) {
			await player.draw();
			const phasename = get.info(event.name).phasename,
				isPhase = name => phasename.includes(name.split("|")[0]);
			const list = trigger.phaseList.map((name, index) => [index + 1, "", name.split("|")[0]]);
			if (list?.some(info => isPhase(info[2]) && !player.getStorage(event.name + "_used").includes(info[2]))) {
				const result = await player
					.chooseButton(
						[
							"独断：请选择一个阶段于本回合跳过",
							[
								list.filter(info => {
									return isPhase(info[2]) && !player.getStorage(event.name + "_used").includes(info[2]);
								}),
								(item, type, position, noclick, node) => {
									let showCard = [item[0], item[1], `lusu_${item[2]}`];
									node = ui.create.buttonPresets.vcard(showCard, type, position, noclick);
									node.node.info.innerHTML = `<span style = "color:#ffffff">${item[0]}</span>`;
									node.node.info.style["font-size"] = "20px";
									node._link = node.link = item;
									node._customintro = uiintro => {
										uiintro.add(get.translation(node._link[2]));
										uiintro.addText(`此阶段为本回合第${get.cnNumber(node._link[0], true)}个阶段`);
										return uiintro;
									};
									return node;
								},
							],
						],
						true
					)
					.set("forceAuto", true)
					.forResult();
				let choice = result?.links[0];
				player.addSkill(event.name + "_used");
				player.markAuto(event.name + "_used", choice[2]);
				let phase = trigger.phaseList[choice[0] - 1].replace(choice[2], `skip${choice[2].slice(5)}-${event.name}`);
				trigger.phaseList[choice[0] - 1] = phase;
				const list2 = trigger.phaseList.filter((name, index) => isPhase(name) && index != choice[0] - 1);
				if (list2.length > 1) {
					if (list2.length == 2) {
						const indexList = list2.map(name => trigger.phaseList.indexOf(name));
						[trigger.phaseList[indexList[0]], trigger.phaseList[indexList[1]]] = [trigger.phaseList[indexList[1]], trigger.phaseList[indexList[0]]];
						return;
					}
					const choices = trigger.phaseList.reduce((list, name, index) => (index != choice[0] - 1 && isPhase(name) ? [...list, [index + 1, "", name.split("|")[0]]] : list), []);
					const indexList = choices.map(i => i[0] - 1);
					const result2 = await player
						.chooseToMove("独断：交换另外两个阶段", true)
						.set("checkMove", moved => {
							const { choices } = get.event();
							const list = moved[0].reduce((list, i, index) => (choices[index][0] != i[0] ? [...list, i[0]] : list), []).sort();
							return list;
						})
						.set("choices", choices)
						.set("list", [
							[
								"剩余阶段",
								[
									choices,
									(item, type, position, noclick, node) => {
										let showCard = [item[0], item[1], `lusu_${item[2]}`];
										node = ui.create.buttonPresets.vcard(showCard, type, position, noclick);
										node.node.info.innerHTML = `<span style = "color:#ffffff">${item[0]}</span>`;
										node.node.info.style["font-size"] = "20px";
										node._link = node.link = item;
										node._customintro = uiintro => {
											uiintro.add(get.translation(node._link[2]));
											uiintro.addText(`此阶段为本回合第${get.cnNumber(node._link[0], true)}个阶段`);
											return uiintro;
										};
										return node;
									},
								],
							],
						])
						.set("filterOk", moved => {
							return get.event().checkMove(moved).length == 2;
						})
						.set("filterMove", (from, to, moved) => {
							if (!to?.link || !from?.link) {
								return false;
							}
							const list = get.event().checkMove(moved);
							if (list.length < 2) {
								return true;
							}
							if (list.length == 2) {
								if ([from.link[0], to.link[0]].sort().every((num, i) => num == list[i])) {
									return true;
								}
							}
							return false;
						})
						.set("processAI", list => {
							let moved = list[0][1][0].slice(0);
							return [[moved.at(-1), ...moved.slice(1, -1), moved.at(0)]];
						})
						.forResult();
					if (!result2?.bool) {
						return;
					}
					indexList.forEach((i, index) => {
						trigger.phaseList[i] = result2.moved[0][index][2];
					});
				}
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已跳过 $",
				},
			},
			skip: {
				trigger: {
					player: ["phaseJudge", "phaseDraw", "phaseUse", "phaseDiscard"].map(i => i + "Before"),
				},
				charlotte: true,
				popup: false,
				forced: true,
				onremove: true,
				filter(event, player) {
					if (!player.getStorage("olsbduduan_skip").includes(event.name)) {
						return false;
					}
					return !event._extraPhaseReason;
				},
				content() {
					trigger.cancel();
				},
			},
		},
	},
	olsbyinglve: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.getStorage("olsbyinglve_used").length < 2;
		},
		position: "he",
		chooseButton: {
			dialog(_, player) {
				const dialog = ui.create.dialog("英略：请选择一项", "hidden");
				const list = [];
				if (!player.getStorage("olsbyinglve_used").includes(0)) {
					list.push([0, "令一名角色失去1点体力，其下个摸牌阶段摸牌数+2"]);
				}
				if (!player.getStorage("olsbyinglve_used").includes(1)) {
					list.push([1, "令一名角色摸两张牌，其下个弃牌阶段内手牌上限-2"]);
				}
				dialog.add([list, "textbutton"]);
				dialog.direct = true;
				return dialog;
			},
			check(button) {
				return 1;
			},
			backup(links, player) {
				return {
					audio: "olsbyinglve",
					choice: links[0],
					filterTarget: true,
					async content(event, trigger, player) {
						const choice = get.info(event.name).choice;
						const target = event.targets[0];
						player.addTempSkill("olsbyinglve_used", "phaseUseAfter");
						player.markAuto("olsbyinglve_used", [choice]);
						if (choice == 0) {
							await target.loseHp();
							target
								.when({ player: "phaseDrawBegin2" })
								.filter(evt => !evt.numFixed)
								.step(async (event, trigger, player) => {
									trigger.num += 2;
								});
						} else {
							await target.draw(2);
							target.when({ player: "phaseDiscardBegin" }).step(async (event, trigger, player) => {
								player.addTempSkill("olsbyinglve_debuff", ["phaseBeforeStart", "phaseChange", "phaseAfter"]);
								player.addMark("olsbyinglve_debuff", 2, false);
							});
						}
					},
					ai: {
						result: {
							target(player, target) {
								const choice = get.info("olsbyinglve_backup");
								if (choice === 0) {
									return get.effect(target, { name: "losehp" }, player, player);
								} else {
									return get.effect(target, { name: "draw" }, player, player);
								}
							},
						},
					},
				};
			},
			prompt(links, player) {
				const choice = links[0];
				let str;
				if (choice == 0) {
					str = "令一名角色失去1点体力，下个摸牌阶段摸牌数+2";
				} else {
					str = "令一名角色摸两张牌，其下个弃牌阶段内手牌上限-2";
				}
				return `###英略###<div class="text center">${str}</div>`;
			},
		},
		ai: {
			order: 9,
			result: {
				player: 1,
			},
		},
		subSkill: {
			backup: {},
			used: {
				onremove: true,
				charlotte: true,
			},
			debuff: {
				onremove: true,
				charlotte: true,
				markimage: "image/card/handcard.png",
				intro: {
					content: "手牌上限-#",
				},
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("olsbyinglve_debuff");
					},
				},
			},
		},
	},
};
