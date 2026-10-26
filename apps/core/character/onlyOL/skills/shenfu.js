import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "shenfu" | "qixian" | "chuyuan" | "dengji" | "tianxing" | "rerende_shen_caopi" | "rezhiheng_shen_caopi" | "olluanji_shen_caopi" | "olzhiti" | "olzhiti2" | "olduorui">} */
export const groupSkills = {
	shenfu: {
		audio: 2,
		trigger: { player: "phaseEnd" },
		direct: true,
		async content(event, trigger, player) {
			let logged = false;

			const chosen = new Set(),
				odd = player.countCards("h") % 2 === 1;
			event.chosen = chosen;
			while (true) {
				if (odd) {
					const result = await player
						.chooseTarget(get.prompt("shenfu"), "对一名其他角色造成1点雷属性伤害", (card, player, target) => {
							return target !== player && !get.event().getParent().chosen.has(target);
						})
						.set("ai", target => {
							const player = get.player();
							return get.damageEffect(target, player, player, "thunder") * (target.hp == 1 ? 2 : 1);
						})
						.forResult();
					if (!result.bool) {
						return;
					}
					const target = result.targets[0];
					if (!logged) {
						logged = true;
						player.logSkill("shenfu", target, "thunder");
					} else {
						player.line(target, "thunder");
					}
					chosen.add(target);
					await target.damage("thunder");

					if (!target.getHistory("damage", evt => evt.getParent("shenfu") === event && evt._dyinged).length) {
						return;
					}
				} else {
					let result = await player
						.chooseTarget(get.prompt("shenfu"), "令一名角色摸一张牌或弃置其一张手牌", (card, player, target) => {
							return !get.event().getParent().chosen.has(target);
						})
						.set("ai", target => {
							const att = get.attitude(_status.event.player, target);
							const delta = target.hp - target.countCards("h");
							if (Math.abs(delta) == 1 && get.sgn(delta) == get.sgn(att)) {
								return 3 * Math.abs(att);
							}
							if (att > 0 || target.countCards("h") > 0) {
								return Math.abs(att);
							}
							return 0;
						})
						.forResult();
					if (!result) {
						return;
					}

					const target = result.targets[0];
					if (!logged) {
						logged = true;
						player.logSkill("shenfu", target);
					} else {
						player.line(target, "green");
					}
					chosen.add(target);
					if (target.countCards("h") === 0) {
						result = { index: 0 };
					} else {
						result = await player
							.chooseControl("摸一张牌", "弃置一张手牌")
							.set("prompt", "选择一项令" + get.translation(target) + "执行…")
							.set("goon", get.attitude(player, target) > 0 ? 0 : 1)
							.set("ai", () => _status.event.goon)
							.forResult();
					}

					if (result.index == 0) {
						await target.draw();
					} else {
						await target.chooseToDiscard("h", true);
					}
					if (target.hp !== target.countCards("h")) {
						return;
					}
				}
			}
		},
		ai: { expose: 0.25 },
	},
	qixian: {
		mod: {
			maxHandcardBase(player, num) {
				return 7;
			},
		},
	},
	chuyuan: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.player.isIn() && player.getExpansions("chuyuan").length < player.maxHp;
		},
		logTarget: "player",
		locked: false,
		async content(event, trigger, player) {
			await trigger.player.draw();
			if (!trigger.player.countCards("h")) {
				return;
			}

			const result = await trigger.player.chooseCard("h", true, "选择一张牌置于" + get.translation(player) + "的武将牌上作为「储」").forResult();
			player.addToExpansion(result.cards, trigger.player, "give").gaintag.add("chuyuan");
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		ai: {
			notemp: true,
		},
	},
	dengji: {
		audio: 2,
		derivation: ["tianxing", "new_rejianxiong", "rerende", "rezhiheng", "olluanji", "caopi_xingdong"],
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "water",
		filter(event, player) {
			return player.getExpansions("chuyuan").length >= 3;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.addSkills(["tianxing", "new_rejianxiong"]);
			await player.loseMaxHp();
			await player.gain(player.getExpansions("chuyuan"), "gain2", "fromStorage");
		},
		ai: {
			combo: "chuyuan",
		},
	},
	tianxing: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "thunder",
		filter(event, player) {
			return player.getExpansions("chuyuan").length >= 3;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp();
			await player.gain(player.getExpansions("chuyuan"), "gain2", "fromStorage");
			await player.removeSkills("chuyuan");
			const result = await player.chooseControl("rerende", "rezhiheng", "olluanji", "caopi_xingdong").set("prompt", "选择获得一个技能").set("ai", processAI).forResult();
			await player.addSkills(result.control);

			return;

			function processAI() {
				const player = get.player();

				if (!player.hasSkill("luanji") && !player.hasSkill("olluanji") && player.getUseValue({ name: "wanjian" }) > 4) {
					return "olluanji";
				}
				if (!player.hasSkill("rezhiheng")) {
					return "rezhiheng";
				}
				if (!player.hasSkill("caopi_xingdong")) {
					return "caopi_xingdong";
				}
				return "rerende";
			}
		},
		ai: {
			combo: "chuyuan",
		},
	},
	rerende_shen_caopi: { audio: 1 },
	rezhiheng_shen_caopi: { audio: 1 },
	olluanji_shen_caopi: { audio: 1 },
	olzhiti: {
		audio: "drlt_zhiti",
		global: "olzhiti2",
		mod: {
			maxHandcard(player, num) {
				if (
					game.hasPlayer(function (current) {
						return current.isDamaged();
					})
				) {
					return num + 1;
				}
			},
		},
		trigger: { player: ["phaseDrawBegin2", "phaseEnd"] },
		forced: true,
		filter(event, player) {
			var num = event.name == "phase" ? 5 : 3;
			if (
				num == 3
					? event.numFixed
					: !game.hasPlayer(function (current) {
							return current.hasEnabledSlot();
						})
			) {
				return false;
			}
			return (
				game.countPlayer(function (current) {
					return current.isDamaged();
				}) >= num
			);
		},
		direct: true,
		async content(event, trigger, player) {
			if (trigger.name == "phaseDraw") {
				player.logSkill("olzhiti");
				trigger.num++;
				return;
			}

			const result = await player
				.chooseTarget(get.prompt("olzhiti"), "废除一名角色的一个随机装备栏", (card, player, target) => {
					return target.hasEnabledSlot();
				})
				.set("ai", target => {
					return -get.attitude(_status.event.player, target) * (target.countCards("e") + 1);
				})
				.forResult();

			if (result.bool) {
				const target = result.targets[0];
				player.logSkill("olzhiti", target);
				const list = [];
				for (let i = 1; i < 6; i++) {
					if (target.hasEnabledSlot(i)) {
						list.add(i == 3 || i == 4 ? 6 : i);
					}
				}
				const num = list.randomGet();
				if (num != 6) {
					await target.disableEquip(num);
				} else {
					await target.disableEquip(3, 4);
				}
			}
		},
	},
	olzhiti2: {
		mod: {
			maxHandcard(player, num) {
				if (player.isDamaged()) {
					return (
						num -
						game.countPlayer(function (current) {
							return current.hasSkill("olzhiti") && current.inRange(player);
						})
					);
				}
			},
		},
	},
	olduorui: {
		audio: "drlt_duorui",
		trigger: { source: "damageSource" },
		filter(event, player) {
			const target = event.player;
			if (!player.isPhaseUsing() || target.isDead()) {
				return false;
			}
			if (Object.keys(target.disabledSkills).some(key => target.disabledSkills[key].includes("olduorui_effect"))) {
				return false;
			}
			const skills = target.getStockSkills(false, true).filter(skill => {
				const info = get.info(skill);
				return !info.charlotte || !info.persevereSkill;
			});
			return skills.length > 0;
		},
		check(event, player) {
			if (get.attitude(player, event.player) >= 0) {
				return false;
			}
			if (event.getParent("phaseUse").skipped) {
				return true;
			}
			const nd = player.needsToDiscard();
			return (
				player.countCards("h", function (card) {
					return player.getUseValue(card, null, true) > 0 && (nd ? true : get.tag(card, "damage") > 0);
				}) == 0
			);
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			const skills = target.getStockSkills(false, true).filter(skill => {
				const info = get.info(skill);
				return !info.charlotte || !info.persevereSkill;
			});
			const list = skills.map(skill => [
				skill,
				`<div class="popup text" style="width:calc(100% - 10px);display:inline-block"><div class="skill">${(() => {
					let str = get.translation(skill);
					if (!lib.skill[skill]?.nobracket) {
						str = `【${str}】`;
					}
					return str;
				})()}</div><div>${get.translation(skill, "info")}</div></div>`,
			]);
			const result = await player
				.chooseButton([`选择${get.translation(target)}武将牌上的一个技能并令其失效`, [list, "textbutton"]])
				.set("ai", button => {
					if (!get.event().check) {
						return 0;
					}
					const { link } = button;
					return get.skillRank(link, "inout");
				})
				.set("displayIndex", false)
				.set("check", get.info(event.skill).check(trigger, player))
				.forResult();
			event.result = {
				bool: result?.bool,
				cost_data: result?.links,
			};
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data: [skill],
			} = event;
			target.disableSkill(event.name + "_effect", skill);
			target.addTempSkill(event.name + "_effect", { player: "phaseAfter" });
			game.log(player, "选择了", target, "的技能", `#g【${get.translation(skill)}】`);
			event.getParent("phaseUse").skipped = true;
		},
		subSkill: {
			effect: {
				onremove(player, skill) {
					player.enableSkill(skill);
				},
				locked: true,
				mark: true,
				charlotte: true,
				intro: {
					content(storage, player, skill) {
						const list = Object.keys(player.disabledSkills)
							.filter(key => player.disabledSkills[key].includes(skill))
							.flatMap(key => {
								return lib.translate[key + "_info"] ? [get.translation(key)] : [];
							});
						if (list.length) {
							return `失效技能：${list.join("、")}`;
						}
					},
				},
			},
		},
	},
};
