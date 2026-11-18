import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twchihui" | "twfuxi" | "twhuangzhu">} */
export const groupSkills = {
	//幻曹昂
	twchihui: {
		audio: 2,
		audioname: ["huan_caoang_shadow"],
		trigger: { global: "phaseBegin" },
		filter(event, player) {
			return event.player != player && player.hasEnabledSlot();
		},
		async cost(event, trigger, player) {
			const { player: target } = trigger,
				equips = Array.from({ length: 5 })
					.map((_, i) => [i + 1, get.translation(`equip${i + 1}`)])
					.filter(i => player.hasEnabledSlot(`equip${i[0]}`));
			const { bool, links } = await player
				.chooseButton(2, [
					"炽灰：请选择你要废除的装备栏和相应操作",
					'<div class="text center">即将废除的装备栏</div>',
					[equips, "tdnodes"],
					`<div class="text center">对${get.translation(target)}执行的操作</div>`,
					[
						[
							["discard", `弃置其牌`],
							["equip", `置入装备牌`],
						],
						"tdnodes",
					],
				])
				.set("filterButton", button => {
					const { link } = button,
						{ player, target } = get.event();
					if (Boolean(ui.selected.buttons.length) == (typeof link == "number")) {
						return false;
					}
					if (ui.selected.buttons.length) {
						return link == "equip" || target.countDiscardableCards(player, "hej");
					}
					return true;
				})
				.set("ai", button => {
					const { link } = button,
						{ player, target, list } = get.event();
					let att = get.attitude(player, target);
					if (att < 0) {
						att = -Math.sqrt(-att);
					} else {
						att = Math.sqrt(att);
					}
					const eff = att * lib.card.guohe.ai.result.target(player, target);
					if (!ui.selected.buttons.length) {
						const bool = player.hasSkill("twfuxi");
						const getVal = num => {
							const card = player.getEquip(`equip${num}`);
							if (card) {
								const val = get.value(card);
								if (val > 0) {
									return 0;
								}
								return 5 - val;
							}
							switch (num) {
								case "3":
									return 4.5;
								case "4":
									return 4.4;
								case "5":
									return 4.3;
								case "2":
									return (3 - player.hp) * 1.5;
								case "1": {
									if (
										game.hasPlayer(
											current => (get.realAttitude || get.attitude)(player, current) < 0 && get.distance(player, current) > 1
										) &&
										!bool
									) {
										return 0;
									}
									return bool ? 4.9 : 3.2;
								}
							}
						};
						list.sort((a, b) => getVal(b) - getVal(a));
						if (link == list[0]) {
							return 1;
						}
						return 0;
					}
					if (link == "discard" && eff < 0) {
						return 0;
					}
					if ((att < 0 || target.isMaxEquip()) && link == "equip") {
						return 0;
					}
					return 1;
				})
				.set("target", target)
				.set(
					"list",
					equips.map(i => i[0])
				)
				.forResult();
			event.result = {
				bool: bool,
				cost_data: links,
			};
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const { player: target } = trigger,
				{ cost_data: links } = event;
			await player.disableEquip(`equip${links[0]}`);
			if (links[1] == "discard") {
				if (target.countDiscardableCards(player, "hej")) {
					await player.discardPlayerCard(target, "hej", true);
				}
			} else {
				const equip = get.cardPile2(card => get.subtype(card) == `equip${links[0]}`);
				if (equip) {
					await target.equip(equip);
					await game.delayx();
				}
			}
			await player.loseHp();
			const num = player.getDamagedHp();
			if (num) {
				await player.draw(Math.min(2, num));
			}
		},
	},
	twfuxi: {
		audio: 2,
		persevereSkill: true,
		trigger: { player: ["dying", "disableEquipAfter"] },
		filter(event, player) {
			return event.name == "dying" || !player.hasEnabledSlot();
		},
		async cost(event, trigger, player) {
			const { bool, links } = await player
				.chooseButton([
					get.prompt(event.name.slice(0, -5)),
					[
						[
							//["phase", "当前回合结束后执行一个额外的回合"],
							["twchihui", `保留〖炽灰〗直到下次退幻`],
							["draw", `摸牌至体力上限`],
							["enable", `恢复所有装备栏`],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					const { link } = button,
						player = get.player();
					if (link == "draw" && player.countCards("h") >= player.maxHp) {
						return false;
					}
					if (link == "enable" && player.hasEnabledSlot()) {
						return false;
					}
					return true;
				})
				.set("ai", button => {
					const { link } = button,
						player = get.player();
					const num = player.getAllHistory("useSkill", evt => evt.skill == "twfuxi")?.lastItem?.twfuxi_num;
					if (num == 2 && player.maxHp <= 2 && ui.selected.buttons.length) {
						return 0;
					}
					if (link == "enable") {
						return 5;
					}
					if (link == "draw") {
						return 5 - player.countCards("h");
					}
					/*if (link == "phase") {
						return Math.max(4, player.countCards("h"));
					}*/
					return 1;
				})
				.set("selectButton", [1, 2])
				.forResult();
			event.result = {
				bool: bool,
				cost_data: links,
			};
		},
		async content(event, trigger, player) {
			const { cost_data: choices } = event,
				num = choices.length,
				history = player.getAllHistory("useSkill", evt => evt.skill == event.name);
			const skills = ["twchihui", "twfuxi"];
			if (history.length) {
				history[history.length - 1][event.name + "_num"] = num;
			}
			/*if (choices.includes("phase")) {
				game.log(player, "选择了", "#y选项一");
				player.addTempSkill(event.name + "_mark");
				player.insertPhase();
			}*/
			if (choices.includes("twchihui")) {
				game.log(player, "选择了", "#y选项一");
				skills.remove("twchihui");
			}
			if (choices.includes("draw")) {
				game.log(player, "选择了", "#y选项二");
				await player.drawTo(Math.min(player.maxHp, 5));
			}
			if (choices.includes("enable")) {
				game.log(player, "选择了", "#y选项三");
				const list = Array.from({ length: 5 })
					.map((_, i) => `equip${i + 1}`)
					.filter(i => player.hasDisabledSlot(i));
				await player.enableEquip(list);
			}
			await player.recoverTo(player.maxHp);
			player.changeSkin({ characterName: "huan_caoang" }, "huan_caoang_shadow");
			await player.changeSkills(["twhuangzhu", "twliyuan", "twjifa"], skills);
		},
		derivation: ["twhuangzhu", "twliyuan", "twjifa"],
		/*subSkill: {
			mark: {
				charlotte: true,
				mark: true,
				intro: {
					content: "本回合结束后执行一个额外回合",
				},
			},
		},*/
	},
	twhuangzhu: {
		audio: 2,
		audioname: ["huan_caoang_shadow"],
		trigger: { player: ["phaseZhunbeiBegin", "phaseUseBegin"] },
		filter(event, player) {
			if (event.name == "phaseZhunbei") {
				return player.hasDisabledSlot();
			}
			return player.getStorage("twhuangzhu_effect").length && player.hasDisabledSlot();
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phaseZhunbei") {
				const list = Array.from({ length: 5 })
					.map((_, i) => `equip${i + 1}`)
					.filter(i => player.hasDisabledSlot(i))
					.concat(["cancel2"]);
				const { control } = await player
					.chooseControl(list)
					.set("prompt", "煌烛：选择一个已废除装备栏的类别")
					.set("prompt2", "从牌堆或弃牌堆中随机获得一张对应副类别的装备牌，并记录其牌名")
					.set("ai", () => {
						return get
							.event()
							.controls.filter(i => i !== "cancel2")
							.randomGet();
					})
					.forResult();
				event.result = {
					bool: control != "cancel2",
					cost_data: control,
				};
			} else {
				const storage = player.getStorage("twhuangzhu_effect");
				const storage2 = player
					.getStorage("twhuangzhu_equip")
					.slice()
					.map(equip => equip[2]);
				let virtualList = {};
				let disabled = [1, 2, 3, 4, 5].filter(num => player.countDisabledSlot(num)).map(num => "equip" + num);
				for (let i of disabled) {
					virtualList[i] = [];
				}
				if (storage2?.length) {
					for (let i of storage2) {
						if (disabled.includes(get.subtype(i))) {
							virtualList[get.subtype(i)].add(i);
						}
					}
				}
				let chooseList = [];
				chooseList.push('###煌烛###<div class="text center">为至多两个已废除的装备栏选择或替换牌名</div>');
				for (let i of disabled) {
					let str = get.translation(i) + "栏：";
					if (virtualList[i]?.length) {
						str += "已视为装备" + get.translation(virtualList[i]);
					} else {
						str += "未视为装备任何牌";
					}
					chooseList.push(str);
					let equips = storage.slice().filter(name => get.subtypes(name).includes(i));
					let list = [equips, "vcard"];
					if (equips.length) {
						chooseList.push(list);
					}
				}
				const { bool, links } = await player
					.chooseButton(chooseList, [1, 2])
					.set("filterButton", button => {
						let storage2 = get.event().storage2;
						if (storage2.includes(button.link[2])) {
							return false;
						}
						if (ui.selected.buttons.length) {
							if (get.subtype(ui.selected.buttons[0].link[2]) == get.subtype(button.link[2])) {
								return false;
							}
						}
						return true;
					})
					.set("storage2", storage2)
					.set("ai", button => get.equipValue({ name: button.link[2] }, get.player()))
					.forResult();
				event.result = {
					bool: bool,
					cost_data: links,
				};
			}
		},
		async content(event, trigger, player) {
			const { cost_data } = event;
			if (trigger.name == "phaseZhunbei") {
				const equip = get.cardPile(card => get.subtype(card) == cost_data);
				if (equip) {
					await player.gain(equip, "gain2");
					await game.delayx();
					player.addSkill(event.name + "_effect");
					player.markAuto(event.name + "_effect", [get.name(equip)]);
				}
			} else {
				const equip = event.name + "_equip";
				const subtypes = cost_data.map(name => get.subtypes(name[2])).flat();
				player.unmarkAuto(
					equip,
					player.getStorage(equip).filter(name => subtypes.some(t => get.subtypes(name[2]).includes(t)))
				);
				player.addSkill(equip);
				player.markAuto(equip, cost_data);
				player.addAdditionalSkill(
					equip,
					player
						.getStorage(equip)
						.map(name => lib.card[name[2]]?.skills || [])
						.flat()
				);
				player.addExtraEquip(
					equip,
					player.getStorage(equip).map(name => name[2]),
					true
				);
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: { content: "已记录牌名：$" },
			},
			equip: {
				charlotte: true,
				mod: {
					globalFrom(from, to, distance) {
						return (
							distance +
							from.getStorage("twhuangzhu_equip").reduce((sum, name) => sum + (lib.card[name[2]]?.distance?.globalFrom || 0), 0)
						);
					},
					globalTo(from, to, distance) {
						return (
							distance + to.getStorage("twhuangzhu_equip").reduce((sum, name) => sum + (lib.card[name[2]]?.distance?.globalTo || 0), 0)
						);
					},
					attackRange(from, distance) {
						return (
							distance -
							from.getStorage("twhuangzhu_equip").reduce((sum, name) => sum + (lib.card[name[2]]?.distance?.attackFrom || 0), 0)
						);
					},
					attackTo(from, to, distance) {
						return (
							distance + to.getStorage("twhuangzhu_equip").reduce((sum, name) => sum + (lib.card[name[2]]?.distance?.attackTo || 0), 0)
						);
					},
				},
				onremove(player, skill) {
					player.removeAdditionalSkill(skill);
				},
				intro: {
					markcount: "expansion",
					mark(dialog, storage = []) {
						if (!storage.length) {
							return "当前未视为装备任意牌";
						}
						dialog.addText("当前视为装备");
						dialog.addSmall([storage, "vcard"]);
					},
				},
				trigger: { player: "enableEquipEnd" },
				filter(event, player) {
					if (!event.slots?.length) {
						return false;
					}
					return player.getStorage("twhuangzhu_equip").some(name => event.slots.some(t => get.subtypes(name[2]).includes(t)));
				},
				forced: true,
				popup: false,
				content() {
					const skill = event.name;
					player.unmarkAuto(
						skill,
						player.getStorage(skill).filter(name => trigger.slots.some(t => get.subtypes(name[2]).includes(t)))
					);
					const storage = player.getStorage(skill);
					if (!storage.length) {
						player.removeExtraEquip(skill);
						player.removeSkill(skill);
					} else {
						player.addExtraEquip(
							skill,
							storage.map(name => name[2]),
							true
						);
						player.addAdditionalSkill(
							skill,
							storage.map(name => lib.card[name[2]]?.skills || []).flat()
						);
					}
				},
			},
		},
	},
};
