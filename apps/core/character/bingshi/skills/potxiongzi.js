import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "potxiongzi" | "potduzuo" | "potbihan" | "potlibing" | "potpoxi" | "potfaen" | "potdingpin">} */
export const groupSkills = {
	potxiongzi: {
		audio: 4,
		logAudio(event, player, triggername, _, costResult) {
			if (costResult.cost_data == "保留选项一") {
				return ["potxiongzi3.mp3", "potxiongzi4.mp3"];
			}
			return 2;
		},
		trigger: { player: "phaseZhunbeiBegin" },
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		filter(event, player) {
			return ["potchiyun", "potyanhui", "potfentao"].some(skill => player.hasSkill(skill, null, null, false));
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseControl({
					controls: ["保留选项一", "保留选项二", "cancel2"],
					prompt: get.prompt2(event.skill),
					ai() {
						return ["保留选项一", "保留选项二"].randomGet();
					},
				})
				.forResult();
			if (typeof result?.control == "string" && result.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: result.control,
				};
			}
		},
		async content(event, trigger, player) {
			const { cost_data: link } = event;
			player.awakenSkill(event.name);
			player.changeSkin({ characterName: "pot_zhouyu" }, "pot_zhouyu_shadow");
			for (const skill of ["potchiyun", "potyanhui", "potfentao"]) {
				player.setStorage(skill + (link === "保留选项一" ? "2" : "1"), true, true);
			}
			await player.draw({ num: 2 });
		},
	},
	//势程普------by 清风
	potduzuo: {
		audio: 2,
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			return event.getg?.(player)?.length && event.getParent().name != "potduzuo";
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill),
					prompt2: "选择一名角色令其获得一张火【杀】",
					ai(target) {
						return get.attitude(get.player(), target) * (114514 - target.countCards("h"));
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const card = get.cardPile(card => get.name(card) == "sha" && get.nature(card) == "fire");
			if (card) {
				await target.gain({ cards: [card], animate: "gain2" });
			} else {
				target.popup("没喽");
			}
		},
	},
	potbihan: {
		audio: 2,
		trigger: { global: "damageBegin3" },
		filter(event, player) {
			if (!event.card || event.card.name != "sha") {
				return false;
			}
			if (!event.player?.isIn()) {
				return false;
			}
			return [player, event.player].some(i => i.countCards("h") > i.getHp());
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill, trigger.player),
					prompt2: "将你或其将手牌弃至当前体力并令此伤害-1",
					filterTarget(card, player, target) {
						const targetx = get.event().targetx;
						return [targetx, player].includes(target) && target.countCards("h") > target.getHp();
					},
					ai(target) {
						const { player, targetx } = get.event();
						if (get.attitude(player, targetx) > 0 && [player, targetx].some(i => i.countCards("h") - i.getHp() <= 2)) {
							return get.attitude(player, target) * (114514 - target.countCards("h"));
						} else {
							if (targetx.countCards("h") - targetx.getHp() >= 5) {
								return -get.attitude(player, target);
							}
						}
						return 0;
					},
				})
				.set("targetx", target)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const num = target.countCards("h") - target.getHp();
			if (target.hasDiscardableCards(target, "h")) {
				const { cards } = await target.chooseToDiscard({ forced: true, position: "h", selectCard: num }).forResult();
				if (cards?.length >= num) {
					trigger.num--;
				}
			}
		},
	},
	//势夏侯霸------by 清风
	potlibing: {
		audio: 2,
		forced: true,
		trigger: { player: "useCardAfter" },
		mark: true,
		intro: {
			markcount(storage, player) {
				if (!storage) {
					return 1;
				}
				return 1 + storage;
			},
			content(storage, player) {
				const num = player.countMark("potlibing_attack");
				let str = "<li>攻击范围+" + num;
				str += "<li>使用非伤害牌结算后：<br>";
				if (!storage) {
					str += "攻击范围+1";
				} else if (typeof storage == "number" && storage == 1) {
					const num = 1 + player.countMark("potlibing_draw");
					str += "摸" + num + "张牌";
				} else if (typeof storage == "number" && storage == 2) {
					str += "使用下一张伤害牌伤害+1";
				}
				return str;
			},
		},
		filter(event, player) {
			return !get.is.damageCard(event.card) || player.storage.potlibing || player.hasMark("potlibing_attack") || player.hasMark("potlibing_draw");
		},
		onremove(player, skill) {
			player.removeSkill(skill + "_attack");
			player.removeSkill(skill + "_draw");
			delete player.storage[skill];
		},
		async content(event, trigger, player) {
			if (get.is.damageCard(trigger.card)) {
				get.info(event.name).onremove(player, event.name);
				game.log(player, "重置了技能", `#g${get.translation(event.name)}`);
			} else {
				if (!player.storage[event.name]) {
					player.addSkill(event.name + "_attack");
					player.addMark(event.name + "_attack", 1, false);
					player.setStorage(event.name, 1, true);
				} else if (typeof player.storage[event.name] == "number" && player.storage[event.name] == 1) {
					const num = 1 + player.countMark(event.name + "_draw");
					await player.draw({ num: num });
					player.addSkill(event.name + "_draw");
					player.addMark(event.name + "_draw", 1, false);
					player.setStorage(event.name, 2, true);
				} else {
					delete player.storage[event.name];
					player.addSkill(event.name + "_dam");
					player.addMark(event.name + "_dam", 1, false);
				}
			}
			player.markSkill(event.name);
		},
		subSkill: {
			draw: { charlotte: true, onremove: true },
			attack: {
				onremove: true,
				charlotte: true,
				mod: {
					attackRange(player, num) {
						return num + player.countMark("potlibing_attack");
					},
				},
			},
			dam: {
				charlotte: true,
				mark: true,
				intro: {
					content: "下一张伤害牌伤害+#",
				},
				forced: true,
				onremove: true,
				audio: "potlibing",
				trigger: { player: "useCard" },
				filter(event, player) {
					return get.is.damageCard(event.card) && player.hasMark("potlibing_dam");
				},
				async content(event, trigger, player) {
					if (typeof trigger.baseDamage != "number") {
						trigger.baseDamage = 1;
					}
					trigger.baseDamage += player.countMark(event.name);
					player.removeSkill(event.name);
				},
			},
		},
	},
	potpoxi: {
		audio: 2,
		locked: true,
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (event.type != "discard") {
				return false;
			}
			const evt = event.getl?.(player);
			return evt?.cards2?.some(card => card.name == "sha");
		},
		getIndex(event, player) {
			const evt = event.getl(player),
				cards = evt.cards2.filter(card => card.name == "sha" && player.hasUseTarget(card, false, false));
			return cards;
		},
		direct: true,
		async content(event, trigger, player) {
			const card = event.indexedData;
			if (player.hasUseTarget(card, false, false)) {
				await player
					.chooseUseTarget({
						card,
						forced: true,
						addCount: false,
						nodistance: true,
					})
					.set("oncard", () => {
						const event = get.event();
						const targets = game.filterPlayer(current => current.countCards("h") <= player.countCards("h"));
						event.directHit.addArray(targets);
					})
					.set("logSkill", event.name);
			}
		},
	},
	//势陈群------by 清风
	potfaen: {
		audio: 2,
		trigger: { global: "useCard" },
		filter(event, player) {
			const history = game.getAllGlobalHistory("useCard");
			const index = history.indexOf(event);
			if (!event.player?.isIn()) {
				return false;
			}
			if (index > 0) {
				return history[index - 1].player == player;
			}
			return false;
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			const list = [`令${get.translation(target)}摸一张牌`];
			if (target.countDiscardableCards(target, "he")) {
				list.push(`令${get.translation(target)}弃一张牌`);
			}
			list.push("cancel2");
			const result = await player
				.chooseControl({
					controls: list,
					prompt: "法恩：你可以选择一项",
					ai() {
						const { player, target, controls } = get.event();
						if (get.attitude(player, target) > 0) {
							controls.remove(controls[1]);
						}
						return controls.slice(0).remove("cancel2").randomGet();
					},
				})
				.set("target", target)
				.forResult();
			if (typeof result?.control == "string" && result.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: result.control,
				};
			}
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				cost_data: link,
				targets: [target],
			} = event;
			if (link == `令${get.translation(target)}摸一张牌`) {
				await target.draw({ num: 1 });
			} else {
				if (target.countDiscardableCards(target, "he")) {
					await target.chooseToDiscard({ forced: true, position: "he" });
				}
			}
			player.addTempSkill(event.name + "_effect");
			player.markAuto(event.name + "_effect", [link == `令${get.translation(target)}摸一张牌` ? "discard" : "draw"]);
		},
		subSkill: {
			effect: {
				audio: "potfaen",
				charlotte: true,
				forced: true,
				onremove: true,
				firstDo: true,
				intro: {
					content(storage, player) {
						return "本回合下一张牌被使用时，使用者须" + (storage.includes("draw") ? "摸" : "") + (storage.includes("discard") ? "弃" : "") + "一张牌";
					},
				},
				trigger: { global: "useCard" },
				filter(event, player) {
					return player.getStorage("potfaen_effect").length && event.player?.isIn();
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					const storage = player.getStorage(event.name).slice();
					player.removeSkill(event.name);
					if (storage.includes("draw")) {
						await target.draw({ num: 1 });
					}
					if (storage.includes("discard") && target.countDiscardableCards(target, "he")) {
						await target.chooseToDiscard({ forced: true, position: "he" });
					}
				},
			},
		},
	},
	potdingpin: {
		audio: 2,
		round: 1,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return game.hasPlayer(current => current.hasHistory("lose", evt => evt.cards2?.length));
		},
		async cost(event, trigger, player) {
			let maxLose = 0,
				targets = [];
			for (const target of game.filterPlayer()) {
				const lose = target
					.iterHistory("lose", evt => evt.cards2?.length)
					.map(evt => evt.cards2.length)
					.reduce((sum, len) => sum + len, 0);
				if (lose > maxLose) {
					maxLose = lose;
					targets = [target];
				} else if (lose === maxLose) {
					targets.push(target);
				}
			}
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget(card, player, target) {
						return get.event().targets.includes(target);
					},
					ai(target) {
						return get.attitude(get.player(), target) * (114514 - target.countCards("h"));
					},
				})
				.set("targets", targets)
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			//我不好说
			const next = target.phaseDraw();
			event.next.remove(next);
			trigger.next.push(next);
		},
	},
};
