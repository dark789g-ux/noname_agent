import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcmingjie" | "dcxianfu">} */
export const groupSkills = {
	//李昭仪------by 塔菲大王
	dcmingjie: {
		audio: 2,
		onremove(player, skill) {
			const target = player.storage[`${skill}_effect`];
			if (target?.isIn()) target.removeSkill(`${skill}_effect`);
			player.removeSkill(`${skill}_effect`);
			player.removeSkill(`${skill}_death`);
		},
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && game.hasPlayer(current => current != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget("###明节###选择一名其他角色", true, lib.filter.notMe)
				.set("ai", target => {
					return get.attitude(get.player(), target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.line(target, "green");
			game.log(player, "与", target, "结为明节");
			let list = [player, target];
			for (let i = 0; i < list.length; i++) {
				const [from, to] = [list[i], list[1 - i]];
				from.addSkill(`${event.name}_effect`);
				from.setStorage(`${event.name}_effect`, to, true);
				from.addTip(`${event.name}_effect`, [event.name, to].map(i => get.translation(i)).join(" "));
			}
			player.addSkill(`${event.name}_death`);
		},
		subSkill: {
			effect: {
				charlotte: true,
				intro: { content: "players" },
				trigger: {
					global: ["loseAfter", "loseAsyncAfter"],
					get player() {
						if (!Array.isArray(lib.phaseName)) return [];
						return lib.phaseName.map(i => [`${i}Skipped`, `${i}Cancelled`]).flat();
					},
				},
				filter(event, player) {
					const target = player.getStorage("dcmingjie_effect");
					if (!target?.isIn()) return false;
					if (event.name.startsWith("lose")) {
						if (!event.getParent("phaseDiscard", true) || event.type !== "discard" || event.getlx === false) return false;
						const evt = event.getl?.(target);
						return evt?.hs?.someInD("od");
					}
					return true;
				},
				forced: true,
				logTarget(event, player) {
					return player.getStorage("dcmingjie_effect");
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					if (trigger.name.startsWith("lose")) {
						await player.gain(trigger.getl(target).hs.filterInD("od"));
					} else {
						await game.asyncDraw([player, target], 2);
						await game.delayx();
						if (target.isIn() && !target.hasMark("dcmingjie_tally")) {
							const result = await player
								.chooseBool("是否令" + get.translation(target) + "防止下次受到的伤害？")
								.set("choice", get.attitude(player, target) > 0)
								.forResult();
							if (result?.bool) {
								player.line(target);
								target.addSkill("dcmingjie_tally");
								target.addMark("dcmingjie_tally", 1, false);
							}
						}
					}
				},
			},
			tally: {
				marktext: "节",
				intro: { content: "mark" },
				charlotte: true,
				trigger: { player: "damageBegin4" },
				filter(event, player) {
					return player.hasMark("dcmingjie_tally");
				},
				forced: true,
				content() {
					trigger.cancel();
					player.removeMark("dcmingjie_tally", 1, false);
					game.log(player, "防止了此伤害");
					if (!player.hasMark("dcmingjie_tally")) player.removeSkill("dcmingjie_tally");
				},
				ai: { threaten: 0.8 },
			},
			death: {
				charlotte: true,
				trigger: { global: "dieAfter" },
				filter(event, player) {
					return player.getStorage("dcmingjie_effect") == event.player;
				},
				forced: true,
				async content(event, trigger, player) {
					await player.die();
				},
			},
		},
		ai: {
			threaten: 0.8,
			expose: 0.2,
		},
	},
	dcxianfu: {
		audio: 2,
		trigger: { target: "useCardToTarget" },
		filter(event, player) {
			const target = player.getStorage("dcmingjie_effect");
			if (!target?.isIn() || !Array.isArray(lib.phaseName)) return false;
			return lib.phaseName.some(item => !["phaseZhunbei", "phaseJieshu"].includes(item) && !player.skipList.includes(item));
		},
		async cost(event, trigger, player) {
			const target = player.getStorage("dcmingjie_effect");
			const phases = lib.phaseName.filter(item => !["phaseZhunbei", "phaseJieshu"].includes(item) && !player.skipList.includes(item));
			const result = await player
				.chooseControl(phases, "cancel2")
				.set("prompt", "娴辅：选择一个阶段跳过，令此牌对你无效，并与" + get.translation(target) + "互相观看手牌")
				.set("ai", () => {
					const { player, controls } = get.event();
					const trigger = get.event().getTrigger();
					if (get.effect(player, trigger.card, trigger.player, player) >= 0) return "cancel2";
					return ["phaseDiscard", "phaseJudge", "phaseUse", "phaseDraw"].find(i => controls.includes(i)) || controls.at(-2);
				})
				.forResult();
			event.result = {
				bool: result.control != "cancel2",
				cost_data: result.control,
			};
		},
		usable: 1,
		async content(event, trigger, player) {
			player.skip(event.cost_data);
			game.log(player, "将于下次跳过", get.translation(event.cost_data));
			trigger.getParent().excluded.add(player);
			game.log(trigger.card, "对", player, "无效");
			const target = player.getStorage("dcmingjie_effect");
			const playerCards = player.getCards("h");
			const targetCards = target.getCards("h");
			const promises = [];
			if (targetCards.length > 0) {
				promises.push(
					player
						.chooseCardButton("娴辅：是否选择获得" + get.translation(target) + "的至多三张手牌？", targetCards, [1, 3])
						.set("ai", button => get.value(button.link, player))
						.forResult()
				);
			} else promises.push(Promise.resolve({ bool: false }));
			if (playerCards.length > 0) {
				promises.push(
					target
						.chooseCardButton("娴辅：是否选择获得" + get.translation(player) + "的至多三张手牌？", playerCards, [1, 3])
						.set("ai", button => get.value(button.link, target))
						.forResult()
				);
			} else promises.push(Promise.resolve({ bool: false }));
			const [result1, result2] = await Promise.all(promises);
			const goon1 = result1?.bool && result1.links?.length > 0;
			const goon2 = result2?.bool && result2.links?.length > 0;
			if (goon1 && goon2) await player.swapHandcards(target, result2.links, result1.links);
			else if (goon1) await player.gain(result1.links, target, "give");
			else if (goon2) await target.gain(result2.links, player, "give");
		},
		ai: {
			threaten: 0.8,
			expose: 0.2,
			effect: {
				target(card, player, target) {
					if (_status._dcxianfu_check) return;
					const mingjie = target.getStorage("dcmingjie_effect");
					if (!mingjie?.isIn() || !Array.isArray(lib.phaseName)) return;
					if (!lib.phaseName.some(item => !["phaseZhunbei", "phaseJieshu"].includes(item) && !target.skipList.includes(item))) return;
					_status._dcxianfu_check = true;
					const eff = get.effect(target, card, player, target);
					delete _status._dcxianfu_check;
					if (eff < 0) return 0.5;
				},
			},
		},
	},
};
