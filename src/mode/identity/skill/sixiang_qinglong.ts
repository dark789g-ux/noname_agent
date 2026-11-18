import html from "dedent";
import { lib, game, ui, get, ai, _status, createIdentityOpening, selectOpeningMonarch, selectOpeningSelf, selectRemainingOpening } from "noname";

export function createSixiangResponseSkills() {
	return {
		sixiang_qinglong: {
			trigger: {
				player: "phaseBegin",
			},
			charlotte: true,
			filter(event, player) {
				if (!player.hasJudge("lebu") && !player.hasJudge("bingliang")) {
					return false;
				}
				return player.countCards("he") > 1;
			},
			async cost(event, trigger, player) {
				const lebu = player.hasJudge("lebu");
				const bingliang = player.hasJudge("bingliang");

				let info = "弃置两张牌，然后弃置判定区内的";
				if (lebu) {
					info += "【乐不思蜀】";
				}
				if (bingliang) {
					if (lebu) {
						info += "或";
					}
					info += "【兵粮寸断】";
				}
				event.result = (await player
					.chooseToDiscard({
						prompt: get.prompt(event.skill),
						prompt2: info,
						selectCard: 2,
						position: "he",
						ai(card) {
							const goon = get.event().goon;
							if (goon) {
								return goon - get.value(card, undefined, undefined);
							}
							return 0;
						},
					})
					.set("logSkill", event.skill)
					.set(
						"goon",
						(() => {
							if (player.hasSkillTag("rejudge") && player.countCards("j") < 2) {
								return false;
							}
							const cards = player.getCards("j", card => {
								const name = card.viewAs || card.name;
								return name !== "lebu" || name !== "bingliang";
							});
							return cards.reduce((acc, card) => {
								const eff = get.effect(
									player,
									{
										name: card.viewAs || card.name,
										cards: [card],
									},
									player,
									player
								);
								if (eff < 0) {
									return Math.max(acc, Math.sqrt(-eff));
								}
								return acc;
							}, 0);
						})()
					)
					.forResult()) as Result;
				event.result.skill_popup = false;
			},
			async content(event, trigger, player) {
				const lebu = player.getCards("j", j => {
					return j.viewAs === "lebu" || j.name === "lebu";
				});
				const bingliang = player.getCards("j", j => {
					return j.viewAs === "bingliang" || j.name === "bingliang";
				});
				player.removeSkill("sixiang_qinglong");
				let control;
				if (lebu.length && bingliang.length) {
					control = (
						(await player
							.chooseControl({
								prompt: "请选择要弃置的牌",
								controls: ["lebu", "bingliang"],
								ai() {
									return get.event().control;
								},
							})
							.set(
								"control",
								(() => {
									if (
										get.effect(
											player,
											{
												name: "lebu",
												cards: lebu,
											},
											player,
											player
										) >
										get.effect(
											player,
											{
												name: "bingliang",
												cards: bingliang,
											},
											player,
											player
										)
									) {
										return "bingliang";
									}
									return "lebu";
								})()
							)
							.forResult()) as Result
					).control;
				} else if (lebu) {
					control = "lebu";
				} else if (bingliang) {
					control = "bingliang";
				}
				if (control) {
					await player.discard(control === "lebu" ? lebu : bingliang);
				}
			},
			group: "sixiang_remove",
			mark: true,
			markimage: "image/mode/identity/mark/sixiang_qinglong.jpg",
			intro: {
				content: "回合开始时，你可以弃置两张牌，弃置你判定区的【乐不思蜀】或【兵粮寸断】。",
			},
		},

		sixiang_baihu: {
			enable: ["chooseToUse", "chooseToRespond"] as ["chooseToUse", "chooseToRespond"],
			charlotte: true,
			prompt: "将一张牌当【杀】使用或打出",
			viewAs: {
				name: "sha",
			},
			filterCard: true,
			position: "hes",
			check(card) {
				return 5 - get.value(card, undefined, undefined);
			},
			async precontent(_event, _trigger, player) {
				player.removeSkill("sixiang_baihu");
			},
			group: ["sixiang_baihu_shan", "sixiang_remove"],
			mark: true,
			markimage: "image/mode/identity/mark/sixiang_baihu.jpg",
			intro: {
				content: "你可以将一张牌当【杀】或【闪】使用或打出。",
			},
			ai: {
				respondSha: true,
				result: {
					player(player, target) {
						return -ui.selected.cards.reduce((p, c) => p + get.value(c, player, undefined), 0) / 6;
					},
				},
			},
			subSkill: {
				shan: {
					enable: ["chooseToUse", "chooseToRespond"] as ["chooseToUse", "chooseToRespond"],
					charlotte: true,
					prompt: "将一张牌当【闪】使用或打出",
					viewAs: {
						name: "shan",
					},
					filterCard: true,
					position: "hes",
					check(card) {
						return 5 - get.value(card, undefined, undefined);
					},
					async precontent(_event, _trigger, player) {
						player.removeSkill("sixiang_baihu");
					},
					ai: {
						respondShan: true,
						result: {
							player(player, target) {
								return 1 - ui.selected.cards.reduce((p, c) => p + get.value(c, player, undefined), 0) / 6;
							},
						},
						effect: {
							target(card, player, target, current) {
								if (get.tag(card, "respondShan", undefined, undefined) && current < 0) {
									return 0.8;
								}
							},
						},
					},
				},
			},
		},

		sixiang_remove: {
			trigger: {
				global: "phaseEnd",
			},
			filter(event, player) {
				return !game.hasPlayer(cur => cur.identity === "fan");
			},
			charlotte: true,
			silent: true,
			async content(_event, _trigger, player) {
				player.removeSkill(["sixiang_zhuque", "sixiang_xuanwu", "sixiang_qinglong", "sixiang_baihu"]);
			},
			sub: true,
		},
	};
}
