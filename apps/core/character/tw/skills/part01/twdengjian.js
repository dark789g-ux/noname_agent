import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twdengjian" | "twdengjianx" | "twxinshou" | "twjieqiu" | "twenchou">} */
export const groupSkills = {
	//史阿
	twdengjian: {
		audio: 2,
		trigger: { global: "phaseDiscardEnd" },
		filter(event, player) {
			return event.player != player && lib.skill.twdengjian.getCards(player, event.player).length;
		},
		getCards(player, target) {
			let cards = target
				.getHistory("useCard", evt => {
					return (
						evt.cards &&
						evt.cards.filterInD("d").some(card => get.name(card, false) == "sha") &&
						target.getHistory("sourceDamage", evtx => {
							return evtx.card && evtx.card == evt.card;
						}).length
					);
				})
				.reduce((list, evt) => list.addArray(evt.cards.filterInD("d").filter(card => get.name(card, false) == "sha")), []);
			if (cards.length) {
				const history = player.actionHistory;
				for (let i = history.length - 1; i >= 0; i--) {
					for (let evt of history[i].gain) {
						if (evt.getParent().name == "twdengjian") {
							const card = evt.cards[0];
							cards = cards.filter(cardx => get.color(cardx) != get.color(card));
							if (!cards.length) {
								break;
							}
						}
					}
					if (history[i].isRound) {
						break;
					}
				}
			}
			return cards;
		},
		//direct:true,
		frequent: true,
		async content(event, trigger, player) {
			const cards = lib.skill.twdengjian.getCards(player, trigger.player);
			/*const {bool}=await player.chooseToDiscard(get.prompt('twdengjian'),'he')
			.set('prompt2','弃置一张牌并随机获得本回合所有造成伤害的牌对应的实体牌的其中一张与你本轮以此法获得的牌的颜色均不同的【杀】')
			.set('ai',card=>7-get.value(card))
			.set('logSkill','twdengjian')
			.forResult();
			if(bool) */ await player.gain(cards.randomGet(), "gain2").gaintag.add("twdengjianx");
		},
		group: "twdengjian_buff",
		subSkill: {
			buff: {
				mod: {
					aiOrder(player, card, num) {
						if (get.itemtype(card) == "card" && card.hasGaintag("twdengjianx")) {
							return num + 0.1;
						}
					},
				},
				audio: "twdengjian",
				trigger: { player: "useCard1" },
				filter(event, player) {
					return (
						event.cards &&
						event.cards.length == 1 &&
						player.getHistory("lose", evt => {
							if ((evt.relatedEvent || evt.getParent()) != event) {
								return false;
							}
							for (var i in evt.gaintag_map) {
								if (evt.gaintag_map[i].includes("twdengjianx")) {
									return true;
								}
							}
							return false;
						}).length &&
						event.addCount !== false
					);
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.addCount = false;
					if (player.stat[player.stat.length - 1].card.sha > 0) {
						player.stat[player.stat.length - 1].card.sha--;
					}
					game.log(trigger.card, "不计入次数限制");
				},
			},
		},
	},
	twdengjianx: {},
	twxinshou: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			const goon =
				!player.getHistory("useCard", evt => {
					return evt != event && evt.card.name == "sha" && get.color(evt.card) == get.color(event.card);
				}).length && player.isPhaseUsing();
			if (!player.hasSkill("twxinshou_0")) {
				return goon;
			}
			if (!player.hasSkill("twxinshou_1")) {
				return goon && game.hasPlayer(target => target != player);
			}
			return (
				game.hasPlayer(target => {
					if (target == player) {
						return false;
					}
					return !target.hasSkill("twdengjian", null, null, false);
				}) && player.hasSkill("twdengjian", null, null, false)
			);
		},
		direct: true,
		async content(event, trigger, player) {
			if (player.hasSkill("twxinshou_0") && player.hasSkill("twxinshou_1")) {
				const { bool, targets } = await player
					.chooseTarget((card, player, target) => {
						return target != player && !target.hasSkill("twdengjian", null, null, false);
					})
					.set("ai", target => {
						const player = get.event().player;
						if (get.attitude(player, target) > 0) {
							if (target.isTurnedOver()) {
								return 0;
							}
							const card = new lib.element.VCard({ name: "sha", isCard: true });
							if (
								game.hasPlayer(aim => {
									return (
										target.canUse(card, target) &&
										get.effect(aim, card, target, player) > 0 &&
										get.effect(aim, card, target, target) > 0
									);
								})
							) {
								return target.countCards("h") - 3;
							}
							return 0;
						}
						return 0;
					})
					.set("prompt", get.prompt("twxinshou"))
					.set(
						"prompt2",
						"令【登剑】失效并令一名其他角色获得【登剑】，你的下个回合开始时，其失去【登剑】，若其这期间使用【杀】造成过伤害，则你结束【登剑】的失效状态"
					)
					.forResult();
				if (bool) {
					const target = targets[0];
					player.logSkill("twxinshou", target);
					player.tempBanSkill("twdengjian", "forever");
					target.addAdditionalSkills("twxinshou_" + player.playerid, "twdengjian");
					player.popup("登剑");
					target.popup("登剑");
					game.log(player, "将", "#g【登剑】", "传授给了", target);
					const evtx = event;
					player.when("phaseBegin").step(async (event, trigger, player) => {
						await target.removeAdditionalSkills("twxinshou_" + player.playerid);
						const history = game.getAllGlobalHistory("everything");
						for (let i = history.length - 1; i >= 0; i--) {
							const evt = history[i];
							if (evt.name == "damage" && evt.card && evt.source && evt.card.name == "sha" && evt.source == target) {
								player.popup("洗具");
								delete player.storage[`temp_ban_twdengjian`];
								game.log(player, "结束了", "#g【登剑】", "的失效状态");
								return;
							}
							if (evt == evtx) {
								break;
							}
						}
						player.popup("杯具");
						player.chat("剑法废掉了...");
					});
				}
			} else {
				let choice = [],
					choiceList = ["摸一张牌", "交给一名其他角色一张牌"];
				if (!player.hasSkill("twxinshou_0")) {
					choice.push("摸牌");
				} else {
					choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
				}
				if (!player.hasSkill("twxinshou_1") && game.hasPlayer(target => target != player)) {
					choice.push("给牌");
				} else {
					choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
				}
				const { control } = await player
					.chooseControl(choice, "cancel2")
					.set("prompt", get.prompt("twxinshou"))
					.set("choiceList", choiceList)
					.set("ai", () => {
						if (get.event().controls.includes("摸牌")) {
							return "摸牌";
						}
						const player = get.event().player;
						return game.hasPlayer(target => {
							if (target == player) {
								return false;
							}
							if (player.countCards("he", card => card.name == "du") && get.attitude(player, target) <= 0) {
								return true;
							}
							if (
								player.countCards(
									"he",
									card => get.value(card, player) < 0 && get.attitude(player, target) * get.value(card, target) > 0
								)
							) {
								return true;
							}
							return get.attitude(player, target) > 0;
						}) && get.event().controls.includes("给牌")
							? "给牌"
							: "cancel2";
					})
					.forResult();
				if (control == "cancel2") {
					return;
				}
				player.logSkill("twxinshou");
				if (control == "摸牌") {
					player.addTempSkill("twxinshou_0");
					await player.draw();
				}
				if (control == "给牌") {
					player.addTempSkill("twxinshou_1");
					const { bool, targets } = await player
						.chooseTarget("交给一名其他角色一张牌", lib.filter.notMe, true)
						.set("ai", target => {
							const player = get.event().player,
								att = get.attitude(player, target);
							if (player.countCards("he", card => card.name == "du")) {
								return -att;
							}
							let cards = player.getCards("he", card => get.value(card, player) < 0);
							if (cards.length) {
								cards.sort((a, b) => get.value(a, player) - get.value(b, player));
								return get.value(cards[0], target) * att;
							}
							return att;
						})
						.forResult();
					if (bool) {
						const target = targets[0];
						player.line(target);
						await player.chooseToGive(target, "he", true);
					}
				}
			}
		},
		derivation: "twdengjian",
		subSkill: {
			0: { charlotte: true },
			1: { charlotte: true },
		},
	},
	//石韬
	twjieqiu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.twjieqiu.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target != player && !target.hasDisabledSlot();
		},
		usable: 1,
		async content(event, trigger, player) {
			const target = event.target,
				num = target.countCards("e");
			let disables = [];
			for (let i = 1; i <= 5; i++) {
				for (let j = 0; j < target.countEnabledSlot(i); j++) {
					disables.push(i);
				}
			}
			target.disableEquip(disables);
			if (num) {
				await target.draw(num);
			}
			target.addSkill("twjieqiu_buff");
			target.markAuto("twjieqiu_buff", [player]);
			target
				.when("enableEquipEnd")
				.filter((e, p) => !p.hasDisabledSlot())
				.step(async () => target.removeSkill("twjieqiu_buff"));
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					return -target.countCards("e") - (get.attitude(player, target) < 0 ? 1 : 0);
				},
			},
		},
		frequent: true,
		subSkill: {
			used: { charlotte: true },
			buff: {
				charlotte: true,
				onremove: true,
				trigger: { player: "phaseDiscardEnd" },
				filter(event, player) {
					return player.hasDisabledSlot() && event.cards && event.cards.length;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const num = trigger.cards.length;
					let list = [],
						map = {};
					for (let i = 1; i < 6; i++) {
						map[get.translation("equip" + i)] = "equip" + i;
						if (player.hasDisabledSlot(i)) {
							for (let j = 0; j < player.countDisabledSlot(i); j++) {
								list.push("equip" + i);
							}
						}
					}
					let result;
					const transList = list.map(i => get.translation(i));
					if (transList.length <= num) {
						result = { bool: true, links: transList };
					} else {
						result = await player
							.chooseButton(["劫囚：请选择你要恢复的装备栏", [transList, "tdnodes"]], Math.min(transList.length, num), true)
							.set("map", map)
							.set("ai", button => ["equip5", "equip4", "equip1", "equip3", "equip2"].indexOf(get.event().map[button.link]) + 2)
							.forResult();
					}
					if (result.bool) {
						await player.enableEquip(result.links.slice().map(i => map[i]));
					}
				},
				group: ["twjieqiu_end"],
			},
			end: {
				charlotte: true,
				trigger: { player: "phaseEnd" },
				filter(event, player) {
					return (
						player.hasDisabledSlot() &&
						player.getStorage("twjieqiu_buff").some(target => {
							return target.isIn() && !target.hasSkill("twjieqiu_used");
						})
					);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const targets = player
						.getStorage("twjieqiu_buff")
						.filter(target => {
							return target.isIn() && !target.hasSkill("twjieqiu_used");
						})
						.sortBySeat();
					for (const target of targets) {
						const result = await target.chooseBool("劫囚：是否执行一个额外回合？").set("frequentSkill", "twjieqiu").forResult();
						if (result.bool) {
							target.popup("劫囚");
							target.addTempSkill("twjieqiu_used", "roundStart");
							target.insertPhase();
						}
					}
				},
			},
		},
	},
	twenchou: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.twenchou.filterTarget(null, player, current));
		},
		position: "he",
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") && target.hasDisabledSlot();
		},
		usable: 1,
		async content(event, trigger, player) {
			const target = event.target;
			await player.gainPlayerCard(target, "h", true, "visible");
			let list = [],
				map = {};
			for (let i = 1; i < 6; i++) {
				map[get.translation("equip" + i)] = "equip" + i;
				if (target.hasDisabledSlot(i)) {
					list.push("equip" + i);
				}
			}
			let result;
			const transList = list.map(i => get.translation(i));
			if (transList.length == 1) {
				result = { bool: true, links: transList };
			} else {
				result = await player
					.chooseButton(["恩仇：请选择" + get.translation(target) + "要恢复的装备栏", [transList, "tdnodes"]], true)
					.set("map", map)
					.set("ai", button => 1 / (["equip5", "equip4", "equip1", "equip3", "equip2"].indexOf(get.event().map[button.link]) + 2))
					.forResult();
			}
			if (result.bool) {
				await target.enableEquip(result.links.slice().map(i => map[i]));
			}
		},
		ai: {
			order: 9,
			result: { target: -1 },
			combo: "twjieqiu",
		},
	},
};
