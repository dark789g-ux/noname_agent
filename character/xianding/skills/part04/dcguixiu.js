import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcguixiu" | "dccunsi" | "dcyongjue" | "dcshushen" | "dcshenzhi">} */
export const groupSkills = {
	//散装版糜夫人
	dcguixiu: {
		audio: "guixiu",
		trigger: {
			player: "phaseBegin",
		},
		forced: true,
		onremove: true,
		filter(event, player) {
			return !player.hasMark("dcguixiu");
		},
		group: "dcguixiu_rec",
		content() {
			player.addMark("dcguixiu", 1, false);
			player.draw(2);
		},
		subSkill: {
			rec: {
				audio: "guixiu",
				trigger: {
					player: "useSkillAfter",
				},
				forced: true,
				filter(event, player) {
					return event.skill == "dccunsi" && player.isDamaged();
				},
				content() {
					player.recover();
				},
			},
		},
	},
	dccunsi: {
		audio: "cunsi",
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		filterTarget: true,
		derivation: "dcyongjue",
		content() {
			"step 0";
			player.awakenSkill(event.name);
			target.addSkills("dcyongjue");
			if (target != player) {
				player.draw(2);
			}
		},
		ai: {
			order: 10,
			result: {
				target: 1,
			},
		},
	},
	dcyongjue: {
		audio: "yongjue",
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			var evtx = event.getParent("phaseUse");
			if (!evtx || evtx.player != player) {
				return false;
			}
			return (
				player
					.getHistory("useCard", evt => {
						return evt.card.name == "sha" && event.getParent("phaseUse") == evtx;
					})
					.indexOf(event) == 0
			);
		},
		direct: true,
		content() {
			"step 0";
			var choices = ["选项一"];
			var choiceList = ["令" + get.translation(trigger.card) + "不计入次数", "获得此牌"];
			if (trigger.cards.length) {
				choices.push("选项二");
				choiceList[1] = "获得" + get.translation(trigger.cards);
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			choices.push("cancel2");
			player
				.chooseControl(choices)
				.set("choiceList", choiceList)
				.set("ai", () => {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						if (choices.length == 3 && trigger.addCount === false) {
							return 1;
						}
						if (player.getCardUsable({ name: "sha" }) < player.countCards("hs", "sha")) {
							return 0;
						}
						if (choices.length == 3) {
							return 1;
						}
						return 0;
					})()
				);
			"step 1";
			if (result.control == "cancel2") {
				event.finish();
				return;
			}
			player.logSkill("dcyongjue");
			game.log(player, "选择了", "#y" + result.control);
			if (result.control == "选项一") {
				if (trigger.addCount !== false) {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				}
			} else {
				var cards = trigger.cards.filterInD();
				if (cards.length) {
					player.gain(cards, "gain2");
				}
			}
		},
	},
	//散装版甘夫人
	dcshushen: {
		audio: "shushen",
		trigger: { player: "recoverEnd" },
		filter(event, player) {
			return game.hasPlayer(current => current != player) && event.num > 0;
		},
		getIndex: event => event.num,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.player();
					return get.recoverEffect(target, player, player) / 2 + get.attitude(player, target);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			let result;
			if (target.isDamaged()) {
				result = await player
					.chooseControl("选项一", "选项二")
					.set("choiceList", [`令${get.translation(target)}回复1点体力`, `你与${get.translation(target)}各摸一张牌`])
					.set("prompt", "淑慎：请选择一项")
					.set("ai", () => {
						return get.event().choice;
					})
					.set(
						"choice",
						(() => {
							if (target.hp <= 2 || get.recoverEffect(target, player, player) > 20) {
								return "选项一";
							}
							return "选项二";
						})()
					)
					.forResult();
			} else {
				result = { control: "选项二" };
			}
			if (result?.control == "选项一") {
				await target.recover();
			} else if (result?.control == "选项二") {
				const drawers = [player, target].sortBySeat(_status.currentPhase);
				await game.asyncDraw(drawers);
			}
		},
	},
	dcshenzhi: {
		audio: "shenzhi",
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		filter(event, player) {
			return player.countCards("h") > player.hp;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt(event.skill), "弃置一张手牌，然后回复1点体力")
				.set("logSkill", event.skill)
				.set("ai", card => {
					return get.event().recover - get.value(card);
				})
				.set("recover", get.recoverEffect(player, player, player))
				.forResult();
			event.result.skill_popup = false;
		},
		async content(event, trigger, player) {
			await player.recover();
		},
	},
};
