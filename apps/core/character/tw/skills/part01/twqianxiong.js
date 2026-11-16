import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twqianxiong" | "twzhengshi" | "twjunsi">} */
export const groupSkills = {
	//幻曹丕
	twqianxiong: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		manualConfirm: true,
		async content(event, trigger, player) {
			const cards = get.cards(5, true);
			const result = await player
				.chooseButton(["潜凶：选择一张要扣置的牌", cards], true)
				.set("ai", button => {
					return get.player().getUseValue(button.link);
				})
				.forResult();
			if (!result?.bool || !result.links?.length) {
				return;
			}
			const card = result.links[0];
			const result2 = await player
				.chooseTarget(`潜凶：将${get.translation(card)}正面向下置于一名角色的武将牌上`, true)
				.set("ai", target => -get.attitude(get.player(), target))
				.forResult();
			if (!result2?.bool || !result2.targets?.length) {
				return;
			}
			const target = result2.targets[0];
			player.line(target);
			game.log(player, "将一张牌正面向下置于", target, "的武将牌上");
			await target.addToExpansion(card, player, "give").set("gaintag", ["twqianxiong"]);
		},
		intro: {
			markcount: "expansion",
			content(storage, player, skill) {
				return `共扣置${player.getExpansions("twqianxiong").length}张牌`;
			},
		},
		ai: {
			order: 5,
			result: { player: 1 },
		},
		group: ["twqianxiong_effect"],
		subSkill: {
			damage: {
				audio: "twqianxiong",
				onremove: true,
				forced: true,
				charlotte: true,
				trigger: { global: ["useCard", "respond"] },
				filter(event, player) {
					const target = event.player;
					if (!player.getStorage("twqianxiong_damage").includes(target)) {
						return false;
					}
					return target.getExpansions("twqianxiong").some(card => card.name == event.card.name);
				},
				logTarget: "player",
				content() {
					trigger.player.damage();
				},
			},
			effect: {
				audio: "twqianxiong",
				trigger: { global: "phaseUseBegin" },
				filter(event, player) {
					return event.player.getExpansions("twqianxiong").length;
				},
				async cost(event, trigger, player) {
					const list = [
							`本回合每当其使用或打出与其「潜凶」牌相同牌名的牌时，你对其造成1点伤害，本回合结束你移除与其使用或打出过的相同名牌的「潜凶」牌`,
							`你依次使用其所有「潜凶」牌`,
						],
						target = trigger.player;
					const result = await player
						.chooseControl()
						.set("choiceList", list)
						.set("prompt", `潜凶：为${get.translation(target)}选择一项`)
						.set("ai", () => {
							//ai待完善
							let att = get.attitude(get.player(), get.event().target);
							if (att > 0) {
								return "cancel2";
							}
							return ["选项一", "选项二"].randomGet();
						})
						.set("target", target)
						.forResult();
					if (result.control != "cancel2") {
						event.result = {
							bool: true,
							cost_data: result.control,
						};
					}
				},
				async content(event, trigger, player) {
					const control = event.cost_data,
						target = trigger.player;
					if (control == "选项一") {
						player.addTempSkill("twqianxiong_damage");
						player.markAuto("twqianxiong_damage", [target]);
						target.when("phaseEnd").step(async (event, trigger, player) => {
							const cards = player.getExpansions("twqianxiong").filter(card => {
								return (
									player.hasHistory("useCard", evt => evt.card.name == card.name) ||
									player.hasHistory("respond", evt => evt.card.name == card.name)
								);
							});
							if (!cards.length) {
								return;
							}
							await player.loseToDiscardpile(cards);
						});
					} else if (control == "选项二") {
						const cards = target.getExpansions("twqianxiong").slice(0);
						if (!cards.length) {
							return;
						}
						while (target.isAlive() && cards.some(card => player.hasUseTarget(card))) {
							const str = "潜凶：请使用其中一张牌";
							const result = await player
								.chooseButton(true, [str, cards])
								.set("filterButton", button => {
									return get.player().hasUseTarget(button.link);
								})
								.set("ai", button => {
									return get.order(button.link);
								})
								.forResult();
							const card = result.links[0];
							cards.remove(card);
							player.$gain2(card, false);
							game.delayx();
							await player.chooseUseTarget(card, true);
						}
					}
				},
			},
		},
	},
	twzhengshi: {
		audio: 3,
		logAudio: index => (typeof index === "number" ? "twzhengshi" + index + ".mp3" : 1),
		derivation: ["twjunsi"],
		forced: true,
		locked: false,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		async content(event, trigger, player) {
			let targets;
			if (game.countPlayer() <= 3) {
				targets = game.filterPlayer();
			} else {
				const result = await player
					.chooseTarget(`争適：请选择两名其他角色，然后你和这些角色获得〖隽嗣〗`, 2, lib.filter.notMe, true)
					.set("ai", target => -get.attitude(get.player(), target))
					.forResult();
				targets = result.targets.concat([player]).sortBySeat();
			}
			player.line(targets, "thunder");
			for (const target of targets) {
				await target.addSkills(["twjunsi"]);
			}
		},
		group: ["twzhengshi_change"],
		subSkill: {
			change: {
				popup: false,
				trigger: { global: ["roundStart", "dieAfter"] },
				filter(event, player) {
					if (!player.hasSkill("twjunsi")) {
						return false;
					}
					return event.name == "die" ? event.player.hasSkill("twjunsi") : game.roundNumber == 1;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(`争適：令一名角色〖隽嗣〗的摸牌数或弃牌数+1或-1`, (card, player, target) => {
							return target.hasSkill("twjunsi");
						})
						.set("ai", target => {
							//ai待完善
							return Math.random();
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					const list = ["摸牌数+1", "摸牌数-1", "弃牌数+1", "弃牌数-1"];
					const result = await player
						.chooseButton(
							[
								`争適：令${get.translation(target)}〖隽嗣〗的摸牌数或弃牌数+1或-1`,
								/*[
									list.map((item, index) => {
										return [index, item];
									}),
									"textbutton",
								],*/
								[list.slice(0, 2).map((item, index) => [index, item]), "tdnodes"],
								[list.slice(2, 4).map((item, index) => [index + 2, item]), "tdnodes"],
							],
							true,
							1
						)
						.set("filterButton", function (button) {
							const num = button.link + 1;
							if (num % 2 == 0) {
								return get.event().target.getStorage("twjunsi")[num / 2 - 1] > 0;
							}
							return true;
						})
						.set("target", target)
						.set("ai", button => {
							const att = get.attitude(get.player(), get.event().target);
							switch (button.link) {
								case 0:
									return att * 1;
								case 1:
									return -att * 1;
								case 2:
									return -att * 1.5;
								case 3:
									return att * 1.5;
								default:
									break;
							}
						})
						.forResult();
					const num = result.links[0] + 1;
					player.logSkill("twzhengshi", [target], null, null, [get.rand(2, 3)]);
					target.popup(list[num - 1]);
					game.log(target, "〖隽嗣〗的", list[num - 1]);
					target.storage.twjunsi[Math.ceil(num / 2) - 1] += num % 2 == 1 ? 1 : -1;
					target.markAuto("twjunsi");
				},
			},
		},
	},
	twjunsi: {
		audio: 4,
		init(player, skill) {
			player.storage[skill] = [1, 1];
		},
		onremove: true,
		mark: true,
		intro: {
			markcount(storage, player) {
				return storage[0] + "/" + storage[1];
			},
			content(storage, player) {
				return `<li>摸牌数：${storage[0]}<br><li>弃牌数：${storage[1]}`;
			},
		},
		locked: true,
		group: ["twjunsi_source", "twjunsi_end"],
		subSkill: {
			source: {
				forced: true,
				usable: 2,
				trigger: {
					source: "damageSource",
				},
				logAudio(event, player) {
					if (player.name == "huan_caopi") {
						return ["twjunsi1.mp3", "twjunsi2.mp3"];
					}
				},
				filter(event, player) {
					const bool = !game.hasPlayer(target => target != player && target.hasSkill("twjunsi")) ? true : event.player.hasSkill("twjunsi");
					if (bool) {
						return player.getStorage("twjunsi")[0] > 0;
					}
					return false;
				},
				content() {
					const num = player.getStorage("twjunsi")[0];
					player.draw(num);
				},
			},
			end: {
				forced: true,
				usable: 2,
				trigger: {
					player: "damageEnd",
				},
				logAudio(event, player) {
					if (player.name == "huan_caopi") {
						return ["twjunsi3.mp3", "twjunsi4.mp3"];
					}
				},
				filter(event, player) {
					if (!event.source) {
						return false;
					}
					const bool = !game.hasPlayer(target => target != player && target.hasSkill("twjunsi")) ? true : event.source.hasSkill("twjunsi");
					if (bool) {
						return player.getStorage("twjunsi")[1] > 0 && player.countDiscardableCards(player, "he") > 0;
					}
					return false;
				},
				content() {
					const num = player.getStorage("twjunsi")[1];
					player.chooseToDiscard(num, "he", true);
				},
			},
		},
	},
};
