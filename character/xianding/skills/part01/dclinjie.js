import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dclinjie" | "dcduzhang" | "dcjianghuo" | "dclishi">} */
export const groupSkills = {
	//神钟会 —— by 刘巴
	dclinjie: {
		group: "dclinjie_effect",
		marktext: "凛",
		intro: {
			name: "凛界（凛）",
			name2: "凛",
			content: "mark",
		},
		audio: 2,
		trigger: {
			global: "roundStart",
		},
		filter(event, player) {
			return game.hasPlayer(target => !target.hasMark("dclinjie"));
		},
		async cost(event, trigger, player) {
			event.result = await player //
				.chooseTarget(`###${get.prompt(event.skill)}###对一名没有「凛」的角色造成1点伤害然后令其获得一个「凛」标记`, (card, player, target) => !target.hasMark("dclinjie"))
				.set("ai", target => {
					return get.damageEffect(target, get.player(), get.player());
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.damage();
			target.addMark(event.name, 1);
		},
		subSkill: {
			effect: {
				audio: "dclinjie",
				trigger: {
					global: "damageEnd",
				},
				forced: true,
				locked: false,
				filter(event, player) {
					const target = event.player;
					return target !== player && target.hasMark("dclinjie") && target.countDiscardableCards(target, "h");
				},
				logTarget: "player",
				async content(event, trigger, player) {
					let target = trigger.player;
					let hs = target.getDiscardableCards(target, "h");
					if (hs.length) {
						const damage = target.countCards("h") == 1;
						await target.discard(hs.randomGet());
						if (damage) {
							await target.damage();
							target.clearMark("dclinjie");
						}
					}
				},
			},
		},
	},
	dcduzhang: {
		audio: 2,
		usable: 1,
		mod: {
			maxHandcard(player, num) {
				return (num += player.countMark("dclinjie"));
			},
		},
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		filter(event, player) {
			if (get.color(event.card) !== "black") {
				return false;
			}
			return (player === event.player || event.targets.includes(player)) && event.targets.length === 1;
		},
		locked: false,
		frequent: true,
		async content(event, trigger, player) {
			player.addMark("dclinjie", 1);
			await player.draw();
		},
	},
	dcjianghuo: {
		derivation: ["dclishi"],
		skillAnimation: true,
		animationColor: "fire",
		audio: 2,
		juexingji: true,
		forced: true,
		trigger: { player: "phaseBegin" },
		filter(event, player) {
			return !game.hasPlayer(current => !current.hasAllHistory("damage", evt => evt.num));
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const num = game
				.filterPlayer(target => target !== player && target.hasMark("dclinjie"))
				.map(target => target.countMark("dclinjie"))
				.reduce((sum, cur) => sum + cur, 0);
			game.filterPlayer(target => target !== player).forEach(target => target.clearMark("dclinjie"));
			if (num > 0) {
				player.addMark("dclinjie", num);
			}
			await player.draw(player.countMark("dclinjie"));
			await player.gainMaxHp();
			await player.removeSkills("dclinjie");
			await player.addSkills("dclishi");
			player.markSkill("dclinjie");
		},
	},
	dclishi: {
		audio: 2,
		locked: true,
		trigger: {
			player: "phaseJieshuBegin",
		},
		async cost(event, trigger, player) {
			if (!player.hasMark("dclinjie")) {
				event.result = {
					bool: true,
					cost_data: "damage",
				};
			} else {
				const num = player.countMark("dclinjie");
				const result = await player
					.chooseButton([
						"立世：你需移除任意「凛」标记然后执行等量个选项",
						[
							[
								["fengyin", "令所有其他角色于下个准备和结束阶段期间非锁定技失效"],
								["judge", "令所有其他角色于下个判定阶段开始时在【闪电】.【乐不思蜀】和【兵粮寸断】中选择两个并依次进行判定。"],
								["discard", "令所有其他角色于下个摸牌阶段期间内摸到的牌若颜色相同，则全部弃置。"],
								["use", "令所有其他角色于下个出牌阶段每种类型的牌仅能使用一张"],
								["gain", "令所有其他角色于下个弃牌阶段期间内弃置牌后你获得之"],
							],
							"textbutton",
						],
					])
					.set("ai", button => {
						const player = get.player();
						if (button.link === "fengyin") {
							return 1.5;
						} else if (button.link === "judge") {
							return 1;
						} else if (button.link === "discard") {
							return 3;
						} else if (button.link === "use") {
							return 4;
						} else if (button.link === "gain") {
							return 8;
						}
					})
					.set("forced", true)
					.set("selectButton", [1, num])
					.forResult();
				event.result = {
					bool: result.bool,
					cost_data: result.links,
				};
			}
		},
		async content(event, trigger, player) {
			const choices = event.cost_data;
			if (choices === "damage") {
				await player.damage("thunder");
				return;
			}
			player.removeMark("dclinjie", choices.length);
			const targets = game.filterPlayer(target => target != player);
			player.line(targets);
			if (choices.includes("fengyin")) {
				game.log(player, "选择了", "#y准备阶段、结束阶段", "的效果");
				for (const target of targets) {
					target.when({ player: "phaseJieshuBefore" }).step(async () => target.addTempSkill("fengyin", ["phaseBefore", "phaseChange", "phaseAfter"]));
					target.when({ player: "phaseZhunbeiBefore" }).step(async () => target.addTempSkill("fengyin", ["phaseBefore", "phaseChange", "phaseAfter"]));
				}
			}
			if (choices.includes("judge")) {
				game.log(player, "选择了", "#y判定阶段", "的效果");
				for (const target of targets) {
					target.when({ player: "phaseJudgeBegin" }).step(async (event, trigger, player) => {
						const result = await player
							.chooseVCardButton(["lebu", "bingliang", "shandian"], "立世：请选择两个延时锦囊并依次进行判定", 2, true)
							.set("ai", button => {
								const player = get.player();
								return get.info({ name: button.link[2] }).ai.result.target(player, player);
							})
							.forResult();
						if (result?.links.length) {
							const links = result.links;
							for (let i = 0; i < links.length; i++) {
								await target.executeDelayCardEffect(links[i][2]);
							}
						}
					});
				}
			}
			if (choices.includes("discard")) {
				game.log(player, "选择了", "#y摸牌阶段", "的效果");
				for (const target of targets) {
					target.addTempSkill("dclishi_discard", { player: "phaseDrawAfter" });
				}
			}
			if (choices.includes("use")) {
				game.log(player, "选择了", "#y出牌阶段", "的效果");
				for (const target of targets) {
					target.addTempSkill("dclishi_limit", { player: "phaseUseAfter" });
				}
			}
			if (choices.includes("gain")) {
				game.log(player, "选择了", "#y弃牌阶段", "的效果");
				for (const target of targets) {
					target.addTempSkill("dclishi_gain", { player: "phaseDiscardAfter" });
					target.markAuto("dclishi_gain", player);
				}
			}
		},
		subSkill: {
			gain: {
				trigger: {
					player: ["loseAfter"],
					global: ["loseAsyncAfter"],
				},
				charlotte: true,
				forced: true,
				popup: false,
				onremove: true,
				filter(event, player) {
					if (event.type !== "discard") {
						return false;
					}
					const evt = event.getParent("phaseDiscard");
					const evt2 = event.getl(player);
					return evt?.name === "phaseDiscard" && evt?.player === player && evt2?.cards2?.filterInD("d");
				},
				async content(event, trigger, player) {
					const gainer = player
						.getStorage(event.name)
						.sortBySeat()
						.find(target => target.isIn());
					if (gainer) {
						await gainer.gain(trigger.getl(player).cards2.filterInD("d"), "gain2");
					}
				},
			},
			limit: {
				charlotte: true,
				onremove: true,
				trigger: { player: "useCard1" },
				silent: true,
				firstDo: true,
				filter(event, player) {
					return player.isPhaseUsing();
				},
				async content(event, trigger, player) {
					player.markAuto(event.name, get.type2(trigger.card));
				},
				mod: {
					cardEnabled(card, player) {
						const type = get.type2(card);
						if (player.getStorage("dclishi_limit").includes(type)) {
							return false;
						}
					},
					cardSavable(card, player) {
						const type = get.type2(card);
						if (player.getStorage("dclishi_limit").includes(type)) {
							return false;
						}
					},
				},
			},
			discard: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: {
					player: ["gainAfter"],
				},
				filter(event, player) {
					const evt = event.getParent("phaseDraw");
					const cards = event.getg?.(player);
					return event.getParent()?.name == "draw" && evt?.name === "phaseDraw" && evt?.player === player && cards.map(card => get.color(card)).unique().length == 1;
				},
				async content(event, trigger, player) {
					const cards = trigger.getg(player);
					await player.modedDiscard(cards);
				},
			},
		},
	},
};
