import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twyanqin" | "twbaobian" | "chijie" | "waishi" | "renshe">} */
export const groupSkills = {
	twyanqin: {
		trigger: { player: "phaseBegin" },
		direct: true,
		content() {
			"step 0";
			var list = [];
			if (player.group != "wei") {
				list.push("wei2");
			}
			if (player.group != "shu") {
				list.push("shu2");
			}
			list.push("cancel2");
			player
				.chooseControl(list)
				.set("ai", function () {
					return list.randomGet();
				})
				.set("prompt", get.prompt2("twyanqin"));
			"step 1";
			if (result.control != "cancel2") {
				player.logSkill("twyanqin");
				var group = result.control.slice(0, 3);
				player.changeGroup(group);
			}
		},
		ai: {
			combo: "twbaobian",
		},
	},
	twbaobian: {
		trigger: { source: "damageBegin2" },
		filter(event, player) {
			var card = event.card;
			if (!card || (card.name != "sha" && card.name != "juedou")) {
				return false;
			}
			return event.player.group == player.group || event.player.countCards("h") > event.player.hp;
		},
		check(event, player) {
			var att = get.attitude(player, event.player);
			if (event.player.group == player.group) {
				return att > 0;
			}
			return att < 0;
		},
		logTarget: "player",
		content() {
			var target = trigger.player;
			if (target.group == player.group) {
				trigger.cancel();
				var num = target.maxHp - target.countCards("h");
				if (num) {
					target.draw(num);
				}
			} else {
				player.discardPlayerCard(target, "h", true, target.countCards("h") - target.hp, "allowChooseAll");
			}
		},
	},
	chijie: {
		audio: true,
		getGroups(player) {
			return lib.group.filter(group => {
				return group != player.group && game.hasPlayer(current => current.group == group);
			});
		},
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && get.info("chijie").getGroups(player).length;
		},
		async cost(event, trigger, player) {
			const list = get.info("chijie").getGroups(player);
			const { control } = await player
				.chooseControl(list, "cancel2")
				.set("prompt", get.prompt(event.name.slice(0, -5)))
				.set("prompt2", "将自己的势力变更为场上存在的一个势力")
				.set("ai", () => {
					return get.event().controls.randomGet();
				})
				.forResult();
			event.result = {
				bool: control != "cancel2",
				cost_data: control,
			};
		},
		async content(event, trigger, player) {
			await player.changeGroup(event.cost_data);
		},
		ai: {
			combo: "waishi",
		},
	},
	waishi: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + player.countMark("waishi_add");
		},
		filter(event, player) {
			return player.countCards("he") > 0 && game.hasPlayer(target => target != player && target.countCards("h") > 0);
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") >= ui.selected.cards.length;
		},
		filterCard: true,
		position: "he",
		check(card) {
			if (!game.hasPlayer(current => current != get.player() && current.countCards("h") > ui.selected.cards.length)) {
				return 0;
			}
			return 6 - get.value(card);
		},
		selectCard() {
			if (!ui.selected.targets.length) {
				return [1, game.countGroup()];
			}
			return [1, Math.min(ui.selected.targets[0].countCards("h"), game.countGroup())];
		},
		discard: false,
		lose: false,
		delay: 0,
		async content(event, trigger, player) {
			const { cards, target } = event;
			const { links } = await player.choosePlayerCard(target, true, "h", cards.length).forResult();
			if (!links || !links.length) {
				return;
			}
			await player.swapHandcards(target, cards, links);
			await game.delayex();
			if (target.countCards("h") > player.countCards("h") || player.group == target.group) {
				await player.draw();
			}
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					if (player.countCards("h") < target.countCards("h") || player.group == target.group) {
						return 1;
					}
					return 0.1;
				},
			},
		},
		subSkill: {
			add: {
				charlotte: true,
				onremove: true,
				intro: { content: "〖外使〗的发动次数+#" },
			},
		},
	},
	renshe: {
		audio: 2,
		trigger: { player: "damageEnd" },
		async cost(event, trigger, player) {
			const choices = [];
			const choiceList = ["将势力变更为场上现存的一个其他势力", "令〖外使〗的发动次数+1直到下个出牌阶段结束", "与另一名其他角色各摸一张牌"];
			if (get.info("chijie").getGroups(player).length) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			choices.push("选项二");
			if (game.hasPlayer(current => player != current)) {
				choices.push("选项三");
			} else {
				choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "</span>";
			}
			const { control } = await player
				.chooseControl(choices, "cancel2")
				.set("prompt", get.prompt(event.name.slice(0, -5)))
				.set("choiceList", choiceList)
				.set("ai", () => {
					if (
						game.hasPlayer(current => {
							if (player == current) {
								return false;
							}
							return get.attitude(player, current) > 0 || current.hasSkillTag("nogain");
						})
					) {
						return "选项三";
					}
					return "选项二";
				})
				.forResult();
			event.result = {
				bool: control != "cancel2",
				cost_data: control,
			};
		},
		async content(event, trigger, player) {
			const { cost_data: control } = event;
			if (control == "选项一") {
				const list = get.info("chijie").getGroups(player);
				if (!list.length) {
					return;
				}
				const result = await player
					.chooseControl(list)
					.set("prompt", get.prompt(event.name))
					.set("prompt2", "将自己的势力变更为场上存在的一个势力")
					.set("ai", () => {
						return get.event().controls.randomGet();
					})
					.forResult();
				await player.changeGroup(result.control);
			} else if (control == "选项二") {
				player.addTempSkill("waishi_add", { player: "phaseUseAfter" });
				player.addMark("waishi_add", 1, false);
			} else {
				if (!game.hasPlayer(current => player != current)) {
					return;
				}
				const result = await player
					.chooseTarget("请选择一名角色，与其各摸一张牌", lib.filter.notMe, true)
					.set("ai", target => {
						const player = get.player();
						if (target.hasSkillTag("nogain")) {
							return 0.1;
						}
						return get.effect(target, { name: "draw" }, player, player);
					})
					.forResult();
				if (result.bool) {
					const target = result.targets[0];
					player.line(target, "green");
					await game.asyncDraw([player, target].sortBySeat());
				}
			}
		},
	},
};
