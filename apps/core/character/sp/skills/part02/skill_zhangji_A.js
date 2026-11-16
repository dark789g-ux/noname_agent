import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "skill_zhangji_A" | "skill_zhangji_B">} */
export const groupSkills = {
	//张既
	skill_zhangji_A: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (player.countMark("skill_zhangji_A_used") >= player.hp) {
				return false;
			}
			return event.target != player && event.target.countCards("h") && player.isPhaseUsing();
		},
		check(event, player) {
			return get.attitude(player, event.target) < 0;
		},
		logTarget: "target",
		content() {
			"step 0";
			player.addTempSkill("skill_zhangji_A_used", "phaseUseAfter");
			player.addMark("skill_zhangji_A_used", 1, false);
			player.viewHandcards(trigger.target);
			var list = [],
				choiceList = ["弃置" + get.translation(trigger.target) + "的一张牌，然后若弃置的牌的是能造成火焰伤害的牌，你摸一张牌", "重铸" + get.translation(trigger.target) + "手牌中的所有【杀】和【决斗】", "你与" + get.translation(trigger.target) + "互相对对方造成1点伤害"];
			list.push("选项一");
			if (trigger.target.countCards("h", { name: ["sha", "juedou"] })) {
				list.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			if (!trigger.target.countCards("h", { name: "shan" })) {
				list.push("选项三");
			} else {
				choiceList[2] = '<span style="opacity:0.5">' + choiceList[2] + "</span>";
			}
			player
				.chooseControl(list)
				.set("prompt", get.prompt("tspowei", target))
				.set("choiceList", choiceList)
				.set("ai", function () {
					var player = _status.event.player,
						target = _status.event.target;
					if (list.includes("选项三") && player.hp + player.countCards("hs", { name: "tao" }) > 2) {
						return "选项三";
					}
					if (list.includes("选项二") && target.countCards("h", { name: ["sha", "juedou"] }) > 1) {
						return "选项二";
					}
					return "选项一";
				})
				.set("target", trigger.target);
			"step 1";
			game.log(player, "选择了", "#y" + result.control);
			switch (result.control) {
				case "选项一":
					player.discardPlayerCard("he", trigger.target, "visible", true);
					break;
				case "选项二":
					var cards = trigger.target.getCards("h", { name: ["sha", "juedou"] }).filter(card => trigger.target.canRecast(card));
					trigger.target.recast(cards);
					event.finish();
					break;
				case "选项三":
					trigger.target.damage(player);
					player.damage(trigger.target);
					event.finish();
					break;
			}
			"step 2";
			if (result.bool && get.tag(result.cards[0], "fireDamage")) {
				player.draw();
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	skill_zhangji_B: {
		getNum(name) {
			let num = 0;
			if (name == "litong") {
				num = 1;
			} else {
				switch (game.getRarity(name)) {
					case "junk":
						num = 1;
						break;
					case "rare":
						num = 2;
						break;
					case "epic":
						num = 3;
						break;
					case "legend":
						num = 4;
						break;
				}
			}
			return num;
		},
		getCharacter(list) {
			let listx = [],
				num = 0;
			for (const name of list) {
				const numx = lib.skill.skill_zhangji_B.getNum(name);
				if (numx > num) {
					num = numx;
					listx = [name];
				} else if (numx == num) {
					listx.push(name);
				}
			}
			return listx;
		},
		group: "skill_zhangji_B_jieming",
		audio: 2,
		trigger: { player: "dying" },
		skillAnimation: true,
		animationColor: "water",
		async cost(event, trigger, player) {
			if (!_status.characterlist) {
				game.initCharacterList();
			}
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名其他角色选择是否更换武将牌", lib.filter.notMe)
				.set("ai", target => {
					const att = get.attitude(get.player(), target);
					let num = lib.skill.skill_zhangji_B.getNum(target.name);
					if (target.name2 != undefined) {
						num = Math.min(num, lib.skill.skill_zhangji_B.getNum(target.name2));
					}
					return att * (4 - num);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			let list = [];
			for (let i = 0; i < _status.characterlist.length; i++) {
				if (lib.character[_status.characterlist[i]][1] == "wei") {
					list.push(_status.characterlist[i]);
				}
			}
			list = list.randomGets(5);
			const bolDialog = ["请选择替换的武将", [list, "character"]];
			const result = await target
				.chooseButton(bolDialog)
				.set("ai", button => {
					const target = get.player();
					let num = lib.skill.skill_zhangji_B.getNum(target.name);
					if (target.name2 != undefined) {
						num = Math.min(num, lib.skill.skill_zhangji_B.getNum(target.name2));
					}
					return lib.skill.skill_zhangji_B.getNum(button.link) - num;
				})
				.forResult();
			if (result?.bool && result?.links?.length) {
				const [character] = result.links;
				const result2 =
					target.name2 != undefined
						? await target
								.chooseControl(target.name1, target.name2)
								.set("prompt", "请选择要更换的武将牌")
								.set("ai", () => get.event().choice)
								.set("choice", lib.skill.skill_zhangji_B.getNum(target.name) < lib.skill.skill_zhangji_B.getNum(target.name2) ? target.name : target.name2)
								.forResult()
						: { control: target.name1 };
				if (result2?.control) {
					await target.reinitCharacter(result2.control, character);
					target.update();
				}
			} else {
				target.chat("拒绝");
				game.log("但", target, "拒绝更换其武将牌");
				return;
			}
		},
		subSkill: {
			jieming: {
				audio: "skill_zhangji_B",
				trigger: { player: "damageEnd" },
				getIndex: event => event.num,
				filter(event, player) {
					return game.hasPlayer(current => current.countCards("h") < current.maxHp) && event.num > 0;
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget(get.prompt(event.skill), "令一名手牌数小于其体力上限的角色摸三张牌，然后其将手牌数调整至其体力上限值", (card, player, target) => {
							return target.countCards("h") < target.maxHp;
						})
						.set("ai", target => {
							const player = get.player();
							let att = get.attitude(player, target);
							if (target.hasSkillTag("nogain")) {
								att /= 6;
							}
							if (att > 2) {
								return Math.min(5, target.maxHp) - target.countCards("h");
							}
							return att / 3;
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					await target.draw(3);
					if (target.countCards("h") > target.maxHp) {
						await target.chooseToDiscard("h", target.countCards("h") - target.maxHp, true, "allowChooseAll");
					}
				},
				ai: {
					maixie: true,
					maixie_hp: true,
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "damage") && target.hp > 1) {
								if (player.hasSkillTag("jueqing", false, target)) {
									return [1, -2];
								}
								var max = 0;
								var players = game.filterPlayer();
								for (var i = 0; i < players.length; i++) {
									if (get.attitude(target, players[i]) > 0) {
										max = Math.max(Math.min(5, players[i].hp) - players[i].countCards("h"), max);
									}
								}
								switch (max) {
									case 0:
										return 2;
									case 1:
										return 1.5;
									case 2:
										return [1, 2];
									default:
										return [0, max];
								}
							}
							if ((card.name == "tao" || card.name == "caoyao") && target.hp > 1 && target.countCards("h") <= target.hp) {
								return [0, 0];
							}
						},
					},
				},
			},
		},
	},
};
