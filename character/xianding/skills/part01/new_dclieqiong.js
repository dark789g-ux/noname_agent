import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "new_dclieqiong" | "dczhanjue">} */
export const groupSkills = {
	new_dclieqiong: {
		audio: "dclieqiong",
		trigger: { source: "damageSource" },
		filter(event, player) {
			return event.player.isIn() && event.source != event.player;
		},
		derivation: ["dclieqiong_place1", "dclieqiong_place4", "dclieqiong_place5", "dclieqiong_place6", "dclieqiong_place7"],
		positions: {
			head: {
				name: "天冲",
				info: "令其失去所有体力，若其因此死亡，你增加1点体力上限",
				css_male: {
					left: "50%",
					top: "14%",
				},
				css_female: {
					left: "45%",
					top: "10%",
				},
				async content(event, trigger, player) {
					const { target, position } = event;
					game.log(player, "击伤了", target, "的", "#y天冲");
					if (target.getHp() > 0) {
						await target.loseHp(target.getHp());
						if (
							game.getGlobalHistory("everything", evt => {
								if (evt.name != "die" || evt.player != target) {
									return false;
								}
								return evt.reason?.getParent() == event;
							}).length > 0
						) {
							await player.gainMaxHp();
						}
					}
				},
			},
			hand: {
				name: "力烽",
				info: "令其随机弃置一半手牌（向上取整）",
				css_male: {
					left: "28%",
					top: "40%",
				},
				css_female: {
					left: "72%",
					top: "40%",
				},
				async content(event, trigger, player) {
					const { target, position } = event;
					game.log(player, "击伤了", target, "的", "#y力烽");
					const cardx = target.getDiscardableCards(target, "h");
					const num = Math.ceil(cardx.length / 2);
					if (cardx.length) {
						await target.discard(cardx.randomGets(num));
					}
				},
			},
			leg: {
				name: "地机",
				info: "令其下一次受到的伤害+1直到其下个回合结束",
				css_male: {
					left: "35%",
					top: "80%",
				},
				css_female: {
					left: "67%",
					top: "80%",
				},
				async content(event, trigger, player) {
					const { target, position } = event;
					game.log(player, "击伤了", target, "的", "#y地机");
					target.addTip("new_dclieqiong_leg", "裂穹 地机");
					target
						.when({
							player: ["damageBegin3", "phaseEnd"],
						})
						.step(async (event, trigger, player) => {
							player.removeTip("new_dclieqiong_leg");
							if (trigger.name == "damage") {
								trigger.num++;
							}
						});
				},
			},
			chest: {
				name: "中枢",
				info: "令其使用的下一张牌无效直到其回合结束",
				css_male: {
					left: "50%",
					top: "30%",
				},
				css_female: {
					left: "40%",
					top: "25%",
				},
				async content(event, trigger, player) {
					const { target, position } = event;
					game.log(player, "击伤了", target, "的", "#y中枢");
					target.addTip("new_dclieqiong_chest", "裂穹 中枢");
					target
						.when({
							player: ["useCard", "phaseEnd"],
						})
						.step(async (event, trigger, player) => {
							player.removeTip("new_dclieqiong_chest");
							if (trigger.name == "useCard") {
								trigger.targets.length = 0;
								trigger.all_excluded = true;
							}
						});
				},
			},
			abdomen: {
				name: "气海",
				info: "令其不能使用或打出♥️牌直到其回合结束",
				css_male: {
					left: "50%",
					top: "42%",
				},
				css_female: {
					left: "40%",
					top: "35%",
				},
				async content(event, trigger, player) {
					const { target, position } = event;
					game.log(player, "击伤了", target, "的", "#y气海");
					target.addTempSkill("new_dclieqiong_abdomen", { player: "phaseEnd" });
				},
			},
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			let list = Object.keys(lib.skill[event.skill].positions);
			if (
				!player.hasHistory("useSkill", evt => {
					return evt.skill == event.skill && evt.targets?.includes(target);
				})
			) {
				list.remove("head");
			}
			if (!list.length) {
				event.result = { bool: false };
				return;
			}
			const result = await player
				.chooseButton([
					[
						dialog => {
							dialog.forcebutton = true;
							dialog.classList.add("forcebutton");
							dialog.listen(() => {
								let allpos = dialog.querySelectorAll(".position");
								allpos.forEach(pos => pos.classList.remove("selected_cp"));
							});
							dialog.classList.add("dclieqiong", "fixed", "fullheight");
							const { target, list } = get.event();
							dialog.style.backgroundImage = `url(${lib.assetURL}image/card/yiwu_${target.hasSex("male") ? "male" : "female"}.png)`;
							const title = ui.create.div(".title", dialog);
							title.innerHTML = `裂穹：是否击伤${get.translation(target)}的一个部位？`;
							//添加部位
							for (let pos of list) {
								let position = lib.skill.new_dclieqiong.positions[pos];
								let div = ui.create.div(".position", dialog, e => {
									e.stopPropagation();
									let allPosDiv = Array.from(dialog.querySelectorAll(".position"));
									allPosDiv.forEach(p => p.classList.remove("selected_cp"));
									div.classList.add("selected_cp");
									ui.selected.buttons = [div];
									ui.create.confirm("oc");
								});
								div.link = pos;
								let sex = target.hasSex("male") ? "male" : "female";
								div.css(position[`css_${sex}`] || {});
								div.setNodeIntro(position.name, position.info);
								div.style.setProperty("--info", `"【${position.name}】:${position.info}"`);
							}
						},
						"handle",
					],
				])
				.set("target", target)
				.set("list", list)
				.set("processAI", () => {
					const { player, target, list } = get.event();
					if (get.attitude(player, target) > 0) {
						return { bool: false };
					} else {
						return {
							bool: true,
							links: list.includes("head") ? ["head"] : ["abdomen"],
						};
					}
				})
				.set("switchToAuto", () => {
					_status.event.result = "ai";
					_status.event.dialog?.close();
					ui.confirm?.close();
				})
				.forResult();
			event.result = {
				bool: result.bool,
				targets: [target],
				cost_data: result.links,
			};
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: [position],
			} = event;
			game.broadcastAll(function (position) {
				if (lib.config.background_speak) {
					game.playAudio("skill", "dclieqiong_" + position);
				}
			}, position);
			const positionObj = lib.skill[event.name].positions[position];
			let next = game.createEvent(event.name + "_effect", false);
			next.setContent(positionObj.content);
			next.set("target", target);
			next.set("player", player);
			next.set("position", positionObj);
			await next;
		},
		subSkill: {
			abdomen: {
				init(player, skill) {
					player.addTip(skill, "裂穹 气海");
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
				charlotte: true,
				mark: true,
				marktext: "伤",
				intro: {
					name: "中伤 - 气海",
					content: (_, player) => "不能使用或打出红桃牌",
				},
				mod: {
					cardEnabled(card) {
						if (get.suit(card) == "heart") {
							return false;
						}
					},
					cardSavable(card) {
						if (get.suit(card) == "heart") {
							return false;
						}
					},
					cardRespondable(card) {
						if (get.suit(card) == "heart") {
							return false;
						}
					},
				},
			},
		},
	},
	dczhanjue: {
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		async cost(event, trigger, player) {
			const hps = [player.getHp(), player.getDamagedHp()];
			let list = [(hps[0] > 0 ? "摸" + get.cnNumber(hps[0]) + "张牌，" : "") + "此阶段使用的下一张【杀】无距离限制且不能被响应。", (hps[1] > 0 ? "摸" + get.cnNumber(hps[1]) + "张牌，" : "") + "此阶段下一次造成伤害后，回复等量体力。"];
			let result = await player
				.chooseControlList({ list })
				.set("ai", function () {
					let player = get.event().player,
						damaged = player.getDamagedHp();
					if (damaged) {
						damaged +=
							0.6 *
							(player.countCards("hs", card => {
								if (card.name == "sha" || !get.tag(card, "damage")) {
									return 0;
								}
								let info = get.info(card);
								if (!info || info.type != "trick") {
									return false;
								}
								if (info.notarget) {
									return false;
								}
								if (info.selectTarget != undefined) {
									if (Array.isArray(info.selectTarget)) {
										if (info.selectTarget[1] == -2) {
											return 1;
										}
										if (info.selectTarget[1] == -1) {
											let func = info.filterTarget;
											if (typeof func != "function") {
												func = () => true;
											}
											return game.countPlayer(cur => {
												return func(card, player, cur);
											});
										}
										return Math.max(1, info.selectTarget[0], info.selectTarget[1]);
									} else {
										if (info.selectTarget == -2) {
											return 1;
										}
										if (info.selectTarget == -1) {
											let func = info.filterTarget;
											if (typeof func != "function") {
												func = () => true;
											}
											return game.countPlayer(cur => {
												return func(card, player, cur);
											});
										}
										return Math.max(1, info.selectTarget);
									}
								}
								return 1;
							}) +
								Math.max(player.getCardUsable("sha"), player.countCards("hs", "sha")));
					}
					if (damaged > player.hp) {
						return "选项二";
					}
					return "选项一";
				})
				.forResult();
			event.result = {
				bool: result.control != "cancel2",
				cost_data: result.control,
			};
		},
		async content(event, trigger, player) {
			if (event.cost_data == "选项一") {
				player.draw(player.getHp());
				player.addTempSkill("dczhanjue_directHit", { player: "phaseUseEnd" });
			} else {
				player.draw(player.getDamagedHp());
				player.addTempSkill("dczhanjue_recover", { player: "phaseUseEnd" });
			}
		},
		subSkill: {
			directHit: {
				audio: "dczhanjue",
				charlotte: true,
				forced: true,
				mod: {
					targetInRange(card) {
						if (card.name == "sha") {
							return true;
						}
					},
				},
				trigger: {
					player: "useCard",
				},
				filter(event, player) {
					return event.card.name == "sha";
				},
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.players);
					game.log(trigger.card, "不可被响应");
					player.removeSkill(event.name);
				},
			},
			recover: {
				audio: "dczhanjue",
				trigger: {
					source: "damageSource",
				},
				forced: true,
				charlotte: true,
				content: async function (event, trigger, player) {
					if (player.isDamaged()) {
						player.recover(trigger.num);
					}
					player.removeSkill(event.name);
				},
			},
		},
	},
};
