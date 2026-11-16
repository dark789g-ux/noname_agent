import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dccuijin" | "dcxieshou" | "dcxieshoux" | "dcqingyan" | "dcqizi" | "dczhenze" | "dcanliao">} */
export const groupSkills = {
	//乐就
	dccuijin: {
		audio: 2,
		trigger: { global: "useCard" },
		filter(event, player) {
			return (event.card.name == "sha" || event.card.name == "juedou") && (event.player == player || player.inRange(event.player)) && player.countCards("he") > 0;
		},
		checkx(event, player) {
			const userDamage = get.damageEffect(event.player, player, player);
			let damageBonus = 0,
				mayDamage = 0,
				odds = 2;
			if (event.card.name === "sha") {
				const nature = get.nature(event.card);
				for (let tar of event.targets) {
					if (
						event.player.hasSkillTag("jueqing", false, tar) ||
						tar.hasSkillTag("filterDamage", null, {
							player: event.player,
							card: event.card,
						})
					) {
						continue;
					}
					const hitOdds = 1 - tar.mayHaveShan(player, "use", true, "odds");
					if (
						hitOdds >= 1 ||
						event.player.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: tar,
								card: event.card,
							},
							true
						)
					) {
						damageBonus += get.damageEffect(tar, event.player, player, nature);
					} else {
						odds = Math.min(odds, hitOdds);
						mayDamage += hitOdds * get.damageEffect(tar, event.player, player, nature);
					}
				}
			} else if (event.card.name === "juedou") {
				const targets = event.targets.sortBySeat(_status.currentPhase);
				let userSha = event.player.mayHaveSha(player, "respond", null, "count");
				for (let tar of event.targets) {
					if (
						event.player.hasSkillTag("jueqing", false, tar) ||
						tar.hasSkillTag("filterDamage", null, {
							player: event.player,
							card: event.card,
						})
					) {
						continue;
					}
					// 检查使用者能否强命目标或者剩余【杀】够不够决斗
					if (
						event.player.hasSkillTag(
							"directHit_ai",
							true,
							{
								target: tar,
								card: event.card,
							},
							true
						) ||
						(userSha -= tar.mayHaveSha(player, "respond", null, "count")) >= 0
					) {
						damageBonus += get.damageEffect(tar, event.player, player);
					} else {
						damageBonus += get.damageEffect(event.player, tar, player);
					}
				}
			}
			if (damageBonus) {
				return damageBonus;
			}
			if (!mayDamage || odds > 1) {
				return get.damageEffect(event.player, player, player) + 2 * get.effect(player, "draw", player, player);
			}
			return mayDamage + (1 - odds) * (get.damageEffect(event.player, player, player) + 2 * get.effect(player, "draw", player, player));
		},
		async cost(event, trigger, player) {
			const skillName = event.name.slice(0, -5);
			event.result = await player
				.chooseToDiscard("he", get.prompt(skillName, trigger.player), "弃置一张牌并令" + get.translation(trigger.player) + "使用的" + get.translation(trigger.card) + "伤害+1，但若其未造成伤害，则你摸两张牌并对其造成1点伤害。")
				.set("ai", function (card) {
					const goon = get.event().goon;
					if (goon) {
						return goon - get.value(card);
					}
					return 0;
				})
				.set(
					"goon",
					(() => {
						const num = (lib.skill.dccuijin.checkx(trigger, player) * player.countCards("he")) / 10;
						// game.log(trigger.player, "对", trigger.targets, "使用", trigger.card, "，乐就发动技能的收益为", num);
						return num;
					})()
				)
				.set("chooseonly", true)
				.set("logSkill", [skillName, trigger.player])
				.forResult();
			event.result.skill_popup = false;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.discard(event.cards);
			if (typeof trigger.baseDamage !== "number") {
				trigger.baseDamage = 1;
			}
			trigger.baseDamage++;
			player.addSkill("dccuijin_damage");
			player.markAuto("dccuijin_damage", [trigger.card]);
			if (!player.storage.dccuijin_map) {
				player.storage.dccuijin_map = { cards: [], targets: [] };
			}
			player.storage.dccuijin_map.cards.push(trigger.card);
			player.storage.dccuijin_map.targets.push(trigger.targets.slice());
		},
		subSkill: {
			damage: {
				trigger: {
					global: ["damage", "damageCancelled", "damageZero", "shaMiss", "useCardToExcluded", "useCardToEnd", "eventNeutralized", "useCardAfter", "shaCancelled"],
				},
				forced: true,
				silent: true,
				firstDo: true,
				charlotte: true,
				onremove: true,
				filter(event, player, name) {
					if (!event.card) {
						return false;
					}
					var cards = player.getStorage("dccuijin_damage");
					if (!cards.includes(event.card)) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					const card = trigger.card;
					const idx = player.storage.dccuijin_map.cards.indexOf(card);
					if (event.triggername == "useCardAfter") {
						let cards = player.getStorage("dccuijin_damage");
						cards = cards.remove(card);
						if (!cards.length) {
							player.removeSkill("dccuijin_damage");
							delete player.storage.dccuijin_map;
						} else if (idx !== -1) {
							player.storage.dccuijin_map.cards.splice(idx, 1);
							player.storage.dccuijin_map.targets.splice(idx, 1);
						}
						return;
					}
					if (idx !== -1) {
						let target, source;
						if (trigger.name.indexOf("damage") == 0) {
							target = trigger.player;
							source = trigger.source;
						} else {
							target = trigger.target;
							source = trigger.player;
						}
						if (
							player.storage.dccuijin_map.targets[idx].includes(target) &&
							!target.hasHistory("damage", evt => {
								return evt.card == card;
							})
						) {
							player.logSkill("dccuijin_damage", source);
							player.storage.dccuijin_map.targets[idx].remove(target);
							await player.draw(2);
							if (source && source.isIn()) {
								player.line(source, "green");
								await source.damage();
							}
						}
					}
					await game.delayx();
				},
			},
		},
	},
	//陈矫
	dcxieshou: {
		audio: 2,
		trigger: {
			global: "damageEnd",
		},
		usable: 1,
		filter(event, player) {
			return get.distance(player, event.player) <= 2 && event.player.isIn();
		},
		check(event, player) {
			return get.attitude(player, event.player) > 4;
		},
		locked: false,
		logTarget: "player",
		onremove: true,
		change(player, num) {
			player.addSkill("dcxieshoux");
			if (typeof player.storage.dcxieshoux !== "number") {
				player.storage.dcxieshoux = 0;
			}
			if (!num) {
				return;
			}
			player.storage.dcxieshoux += num;
			if (player.storage.dcxieshoux != 0) {
				player.markSkill("dcxieshoux");
			} else {
				player.unmarkSkill("dcxieshoux");
			}
			game.log(player, "的手牌上限", (num > 0 ? "+" : "") + num);
		},
		async content(event, trigger, player) {
			let result;
			let target = trigger.player;
			event.target = target;

			// step 0
			lib.skill.dcxieshou.change(player, -1);
			// step 1
			const choiceList = ["回复1点体力", "复原，摸两张牌"];
			const list = [];
			if (target.getDamagedHp() == 0) {
				choiceList[0] = '<span style="opacity:0.5; ">' + choiceList[0] + "</span>";
			} else {
				list.push("选项一");
			}
			list.push("选项二");
			result = await target
				.chooseControl(list)
				.set("choiceList", choiceList)
				.set("prompt", get.translation(player) + "对你发动了【协守】，请选择一项")
				.forResult();
			// step 2
			if (result.control == "选项一") {
				target.recover();
			} else {
				target.link(false);
				await target.draw(2);
			}
		},
		ai: {
			expose: 0.3,
		},
	},
	dcxieshoux: {
		markimage: "image/card/handcard.png",
		intro: {
			content(storage, player) {
				var num = player.storage.dcxieshoux;
				return "手牌上限" + (num >= 0 ? "+" : "") + num;
			},
		},
		charlotte: true,
		mod: {
			maxHandcard(player, num) {
				return num + (player.storage.dcxieshoux || 0);
			},
		},
	},
	dcqingyan: {
		audio: 2,
		trigger: {
			target: "useCardToTargeted",
		},
		filter(event, player) {
			return event.player != player && get.color(event.card) == "black";
		},
		usable: 2,
		async cost(event, trigger, player) {
			if (player.countCards("h") < player.hp) {
				event.result = await player
					.chooseBool(get.prompt(event.skill), "将手牌摸至体力上限（摸" + get.cnNumber(player.maxHp - player.countCards("h")) + "张牌）")
					.set("ai", () => 1)
					.forResult();
			} else {
				event.result = await player
					.chooseToDiscard(get.prompt(event.skill), "弃置一张手牌令你的手牌上限+1", "chooseonly")
					.set("ai", card => 6 - get.value(card))
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (event.cards && event.cards.length) {
				await player.discard(event.cards);
				lib.skill.dcxieshou.change(player, 1);
			} else {
				player.drawTo(player.maxHp);
			}
		},
	},
	dcqizi: {
		mod: {
			cardSavable(card, player, target) {
				if (get.distance(player, target) > 2 && card.name == "tao" && target == _status.event.dying) {
					return false;
				}
			},
		},
		ai: {
			neg: true,
		},
	},
	//公孙度
	dczhenze: {
		audio: 2,
		trigger: { player: "phaseDiscardBegin" },
		direct: true,
		async content(event, trigger, player) {
			const getCond = player => Math.sign(player.countCards("h") - Math.max(0, player.hp));
			const me = getCond(player);
			const recovers = game.filterPlayer(current => getCond(current) == me);
			const loses = game.filterPlayer().removeArray(recovers);
			const list = [];
			if (loses.length) {
				list.push("选项一");
			}
			if (recovers.length) {
				list.push("选项二");
			}
			list.push("cancel2");
			const sign = [
				["≥", "＜"],
				["≠", "＝"],
				["≤", "＞"],
			];
			const choiceList = ["令所有手牌数" + sign[me + 1][0] + "体力值的角色失去1点体力" + (loses.length ? "（" + get.translation(loses) + "）" : ""), "令所有手牌数" + sign[me + 1][1] + "体力值的角色回复1点体力" + (recovers.length ? "（" + get.translation(recovers) + "）" : "")];
			if (!loses.length) {
				choiceList[0] = '<span style="opacity:0.5">' + choiceList[0] + "</span>";
			}
			if (!recovers.length) {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			const result = await player
				.chooseControl(list)
				.set("choiceList", choiceList)
				.set("prompt", get.prompt("dczhenze"))
				.set("ai", () => _status.event.choice)
				.set(
					"choice",
					(() => {
						let eff1 = loses.reduce((prev, i) => prev + get.effect(i, { name: "losehp" }, player, player), 0),
							eff2 = recovers.reduce((prev, i) => prev + get.recoverEffect(i, player, player), 0),
							max = Math.max(0, eff1, eff2);
						if (max === 0) {
							return "cancel2";
						}
						if (eff1 > eff2) {
							return "选项一";
						}
						return "选项二";
					})()
				)
				.forResult();
			if (result.control == "cancel2") {
				return;
			}
			const lose = result.control == "选项一";
			const targets = lose ? loses : recovers;
			player.logSkill("dczhenze", targets);
			for (const i of targets) {
				await i[lose ? "loseHp" : "recover"]();
			}
		},
	},
	dcanliao: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			return game.countPlayer(current => current.group == "qun");
		},
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.dcanliao.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target.countCards("he");
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await player
				.choosePlayerCard(target, "he", true)
				.set("filterButton", button => {
					const card = button.link;
					const owner = get.owner(card);
					return !owner || owner.canRecast(card, _status.event.player);
				})
				.set("ai", card => {
					if (get.attitude(_status.event.player, _status.event.getParent().target) >= 0) {
						return -get.buttonValue(card);
					}
					return get.buttonValue(card);
				})
				.forResult();
			if (result.bool) {
				target.recast(result.links);
			}
		},
		ai: {
			expose: 0.1,
			result: {
				target(player, target) {
					if (target.hasCard(card => get.value(card) >= 6, "e") && get.attitude(player, target) < 0) {
						return -1;
					}
					return 1;
				},
			},
		},
	},
};
