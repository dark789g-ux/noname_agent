import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olhunjiang">} */
export const groupSkills = {
	//马玩
	olhunjiang: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.olhunjiang.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target != player && player.inRange(target);
		},
		usable: 1,
		selectTarget: [1, Infinity],
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const targets = event.targets.sortBySeat();
			let answer_result = [[], []];
			const map = await game.chooseAnyOL(targets, get.info(event.name).chooseControl, [player]).forResult();
			for (const i of targets) {
				i.addExpose(0.05);
				const result = map.get(i).control;
				if (result == "成为目标") {
					answer_result[0].push(i);
				} else {
					answer_result[1].push(i);
				}
				i.popup(result);
				game.log(i, "选择了", "#y" + result);
			}
			await game.delay();
			if (answer_result[0].length) {
				answer_result[0].sortBySeat();
				player.addTempSkill("olhunjiang_addTarget");
				player.markAuto("olhunjiang_addTarget", answer_result[0]);
				if (!answer_result[1].length) {
					await player.draw(answer_result[0].length);
				}
			}
			if (answer_result[1].length) {
				answer_result[1].sortBySeat();
				await player.draw(answer_result[1].length);
				if (!answer_result[0].length) {
					player.addTempSkill("olhunjiang_addTarget");
					player.markAuto("olhunjiang_addTarget", answer_result[1]);
				}
			}
		},
		ai: {
			order(_, player) {
				return get.order({ name: "sha" }, player) + 1;
			},
			result: {
				target(player, target) {
					return get.sgn(get.sgn(get.attitude(player, target)) + 0.5);
				},
			},
		},
		chooseControl(player, source, eventId) {
			const str = get.translation(source);
			return player
				.chooseControl("成为目标", "令其摸牌")
				.set("prompt", "###" + str + "对你发动了【浑疆】，请选择一项" + '###<div class="text center">若所有角色选择了同一项，则所有角色也执行另一项</div>')
				.set("choiceList", ["令" + str + "本阶段使用【杀】可以额外指定你为目标", "令" + str + "摸一张牌"])
				.set("source", source)
				.set("id", eventId)
				.set("_global_waiting", true)
				.set("ai", () => get.event().idx)
				.set(
					"idx",
					(function () {
						let cha = get.effect(player, { name: "sha" }, source, player) * source.mayHaveSha(player, "use", null, "odds") - get.effect(player, { name: "draw" }, source, player);
						if (Math.abs(cha) < player.hp * player.hp) {
							return [0, 1].randomGet();
						}
						if (cha > 0) {
							return 0;
						}
						return 1;
					})()
				);
		},
		subSkill: {
			addTarget: {
				audio: "olhunjiang",
				charlotte: true,
				onremove: true,
				intro: { content: "本阶段使用【杀】可以额外指定$为目标" },
				trigger: { player: "useCard2" },
				filter(event, player) {
					if (event.card.name != "sha") {
						return false;
					}
					return game.hasPlayer(target => {
						if (!player.getStorage("olhunjiang_addTarget").includes(target)) {
							return false;
						}
						return !event.targets.includes(target) && lib.filter.targetEnabled2(event.card, player, target) && lib.filter.targetInRange(event.card, player, target);
					});
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(
							get.prompt(event.skill),
							"令任意名【浑疆】选择成为额外目标的角色成为" + get.translation(trigger.card) + "的目标",
							(card, player, target) => {
								if (!player.getStorage("olhunjiang_addTarget").includes(target)) {
									return false;
								}
								const event = get.event().getTrigger();
								return !event.targets.includes(target) && lib.filter.targetEnabled2(event.card, player, target) && lib.filter.targetInRange(event.card, player, target);
							},
							[1, Infinity]
						)
						.set("ai", target => {
							const player = get.event().player,
								event = get.event().getTrigger();
							return get.effect(target, event.card, player);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					trigger.targets.addArray(event.targets);
					game.log(event.targets, "成为了", trigger.card, "的额外目标");
				},
			},
		},
	},
};
