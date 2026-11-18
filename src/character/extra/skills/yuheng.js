import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const yuhengSkills = {
	yuheng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		async content(event, trigger, player) {
			// ?
			let skills = player.getSkills(null, false, false).filter(skill => {
				if (skill == "yuheng") {
					return false;
				}
				const info = get.info(skill);
				return info && !info.charlotte && !get.is.locked(skill);
			});
			if (skills.length) {
				player.removeSkills(skills);
			}
			//初始化技能库
			const list1 = ["dili_shengzhi", "dili_chigang", "dili_qionglan", "dili_quandao", "dili_jiaohui", "dili_yuanlv"];
			const list2 = ["gzyinghun", "hongde", "rebingyi", "xinfu_guanwei", "bizheng", "xinanguo", "shelie", "wengua", "rebotu", "rezhiheng", "jiexun", "reanxu", "xiashu", "rejieyin", "oldimeng", "xinfu_guanchao", "drlt_jueyan", "lanjiang"];
			const list3 = [];
			if (!player.storage.yuheng_full) {
				player.storage.yuheng_full = list2.slice(0);
			}
			if (player.getStorage("yuheng_current").length == 0) {
				for (let i = 0; i < list1.length; i++) {
					if (player.hasSkill(list1[i])) {
						for (var j = 0; j < 3; j++) {
							list3.add(list2[i * 3 + j]);
						}
					}
				}
				if (!player.storage.yuheng_current) {
					player.storage.yuheng_current = list3.slice(0);
				}
			}
			let fullskills, currentskills;
			//决定抽选技能范围
			if (player.storage.yuheng_full && player.storage.yuheng_full.length) {
				fullskills = player.storage.yuheng_full;
			} else {
				fullskills = list2.slice(0);
			}
			if (player.storage.yuheng_current && player.storage.yuheng_current.length) {
				currentskills = player.storage.yuheng_current;
			} else {
				currentskills = list3.slice(0);
			}
			skills = [];
			//在没有发动过其他非锁定技时抽选技能
			const evtx = event.getParent("phaseUse");
			if (
				currentskills.length > 0 &&
				!player.hasHistory("useSkill", evt => {
					if (evt.skill == "yuheng" || evt.type != "player" || !evt.sourceSkill) {
						return false;
					}
					const info1 = get.info(evt.skill);
					if (info1.charlotte) {
						return false;
					}
					const info = get.info(evt.sourceSkill);
					if (info.charlotte || get.is.locked(evt.skill)) {
						return false;
					}
					return evt.event.getParent("phaseUse") == evtx;
				})
			) {
				fullskills.randomSort();
				currentskills.randomSort();
				for (let i = 0; i < fullskills.length; i++) {
					for (let j = 0; j < currentskills.length; j++) {
						if (fullskills[i] != currentskills[j] || (i == fullskills.length - 1 && j == currentskills.length - 1)) {
							skills.add(fullskills.splice(i--, 1)[0]);
							skills.add(currentskills.splice(j--, 1)[0]);
							break;
						}
					}
					if (skills.length > 0) {
						break;
					}
				}
			} else {
				//在已经发动过其他非锁定技时抽选技能
				skills.add(fullskills.randomRemove(1)[0]);
			}
			for (const skill of skills) {
				player.addSkills(skill);
			}
			player.markAuto("yuheng", skills);
		},
		ai: {
			order(item, player) {
				var evtx = _status.event.getParent("phaseUse");
				if (
					!player.hasHistory("useSkill", function (evt) {
						if (evt.skill == "yuheng" || evt.type != "player" || !evt.sourceSkill) {
							return false;
						}
						var info1 = get.info(evt.skill);
						if (info1.charlotte) {
							return false;
						}
						var info = get.info(evt.sourceSkill);
						if (info.charlotte || get.is.locked(evt.skill)) {
							return false;
						}
						return evt.event.getParent("phaseUse") == evtx;
					})
				) {
					return 11;
				}
				return 0.8;
			},
			result: { player: 1 },
		},
		group: "yuheng_losehp",
		subSkill: {
			losehp: {
				audio: "yuheng",
				trigger: { player: "phaseUseEnd" },
				forced: true,
				locked: false,
				filter(event, player) {
					return !player.hasHistory("useSkill", function (evt) {
						if (evt.skill != "yuheng") {
							return false;
						}
						return evt.event.getParent("phaseUse") == event;
					});
				},
				async content(event, trigger, player) {
					await player.loseHp();
				},
			},
		},
	},
	wuhun2: { audio: 2 },
	new_wuhun: {
		audio: "wuhun2",
		audioname2: { sxrm_caocao: "wuhun_sxrm_caocao" },
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.source && event.source.isIn();
		},
		forced: true,
		logTarget: "source",
		async content(event, trigger, player) {
			trigger.source.addMark("new_wuhun", trigger.num);
		},
		group: "new_wuhun_die",
		ai: {
			notemp: true,
			effect: {
				target: (card, player, target) => {
					if (!target.hasFriend()) {
						return;
					}
					let rec = get.tag(card, "recover"),
						damage = get.tag(card, "damage");
					if (!rec && !damage) {
						return;
					}
					if (damage && player.hasSkillTag("jueqing", false, target)) {
						return 1.7;
					}
					let die = [null, 1],
						temp;
					game.filterPlayer(i => {
						temp = i.countMark("new_wuhun");
						if (i === player && target.hp + target.hujia > 1) {
							temp++;
						}
						if (temp > die[1]) {
							die = [i, temp];
						} else if (temp === die[1]) {
							if (!die[0]) {
								die = [i, temp];
							} else if (get.attitude(target, i) < get.attitude(target, die[0])) {
								die = [i, temp];
							}
						}
					});
					if (die[0]) {
						if (damage) {
							return [1, 0, 1, (-6 * get.sgnAttitude(player, die[0])) / Math.max(1, target.hp)];
						}
						return [1, (6 * get.sgnAttitude(player, die[0])) / Math.max(1, target.hp)];
					}
				},
			},
		},
		marktext: "魇",
		intro: {
			name: "梦魇",
			content: "mark",
			onunmark: true,
		},
		subSkill: {
			die: {
				audio: "wuhun2",
				trigger: { player: "die" },
				filter(event, player) {
					return game.hasPlayer(function (current) {
						return current != player && current.hasMark("new_wuhun");
					});
				},
				forced: true,
				direct: true,
				forceDie: true,
				skillAnimation: true,
				animationColor: "soil",
				async content(event, trigger, player) {
					let maxNum = 0;
					for (const current of game.players) {
						if (current === player) {
							continue;
						}

						const markNum = current.countMark("new_wuhun");
						maxNum = Math.max(maxNum, markNum);
					}
					const num = maxNum;
					let result = await player
						.chooseTarget(true, "请选择【武魂】的目标", "令其进行判定，若判定结果不为【桃】或【桃园结义】，则其死亡", (card, player, target) => {
							return target != player && target.countMark("new_wuhun") == _status.event.num;
						})
						.set("ai", target => -get.attitude(_status.event.player, target))
						.set("forceDie", true)
						.set("num", num)
						.forResult();
					if (!result.bool) {
						return;
					}

					const target = result.targets[0];
					event.target = target;
					player.logSkill("new_wuhun_die", target);
					player.line(target, { color: [255, 255, 0] });
					await game.delay(2);
					result = await target
						.judge(card => (["tao", "taoyuan"].includes(card.name) ? 10 : -10))
						.set("judge2", result => !result.bool)
						.forResult();
					if (!result.bool) {
						await target.die();
					}
				},
			},
		},
	},
	new_guixin: {
		audio: "guixin",
		trigger: {
			player: "damageEnd",
		},
		filter(event, player) {
			return game.hasPlayer(cur => {
				return cur !== player && cur.countCards("hej") > 0;
			});
		},
		check(event, player) {
			if (player.isTurnedOver() || event.num > 1) {
				return true;
			}
			var num = game.countPlayer(function (current) {
				if (current.countCards("he") && current != player && get.attitude(player, current) <= 0) {
					return true;
				}
				if (current.countCards("j") && current != player && get.attitude(player, current) > 0) {
					return true;
				}
			});
			return num >= 2;
		},
		getIndex(event, player) {
			return event.num;
		},
		async content(event, trigger, player) {
			let targets = game.filterPlayer();
			targets.remove(player);
			targets.sort(lib.sort.seat);
			player.line(targets, "green");
			const control = await player
				.chooseControl("手牌区", "装备区", "判定区")
				.set("ai", function () {
					if (
						game.hasPlayer(function (current) {
							return current.countCards("j") && current != player && get.attitude(player, current) > 0;
						})
					) {
						return 2;
					}
					return Math.floor(Math.random() * 3);
				})
				.set("prompt", "请选择优先获得的区域")
				.forResult();
			const range = {
				手牌区: ["h", "e", "j"],
				装备区: ["e", "h", "j"],
				判定区: ["j", "h", "e"],
			}[control.control || "手牌区"];
			while (targets.length > 0) {
				const target = targets.shift();
				for (var i = 0; i < range.length; i++) {
					var cards = target.getCards(range[i]);
					if (cards.length) {
						var card = cards.randomGet();
						await player.gain(card, target, "giveAuto", "bySelf");
						break;
					}
				}
			}
			await player.turnOver();
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			threaten(player, target) {
				if (target.hp == 1) {
					return 2.5;
				}
				return 1;
			},
			effect: {
				target(card, player, target) {
					if (
						!target._new_guixin_eff &&
						get.tag(card, "damage") &&
						target.hp >
							(player.hasSkillTag("damageBonus", true, {
								card: card,
								target: target,
							})
								? 2
								: 1)
					) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						target._new_guixin_eff = true;
						let gain = game.countPlayer(function (current) {
							if (target == current) {
								return 0;
							}
							if (get.attitude(target, current) > 0) {
								if (current.hasCard(cardx => lib.filter.canBeGained(cardx, target, current, "new_guixin") && get.effect(current, cardx, current, current) < 0, "j")) {
									return 1.3;
								}
								return 0;
							}
							if (current.hasCard(cardx => lib.filter.canBeGained(cardx, target, current, "new_guixin") && get.effect(current, cardx, current, current) > 0, "e")) {
								return 1.1;
							}
							if (current.hasCard(cardx => lib.filter.canBeGained(cardx, target, current, "new_guixin"), "h")) {
								return 0.9;
							}
							return 0;
						});
						if (target.isTurnedOver()) {
							gain += 2.3;
						} else {
							gain -= 2.3;
						}
						delete target._new_guixin_eff;
						return [1, Math.max(0, gain)];
					}
				},
			},
		},
	},
	ol_shenfen: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countMark("baonu") >= 6;
		},
		usable: 1,
		skillAnimation: true,
		animationColor: "metal",
		async content(event, trigger, player) {
			player.removeMark("baonu", 6);
			const targets = game.filterPlayer(target => target !== player);
			player.line(targets, "green");

			await game.doAsyncInOrder(targets, target => target.damage("nocard"));
			await game.doAsyncInOrder(targets, async target => {
				const cards = target.getCards("e");
				await target.discard(cards).set("delay", false);
				if (cards.length) {
					await game.delay(0.5);
				}
			});
			await game.doAsyncInOrder(targets, async target => {
				const num = target.countCards("h");
				await target.chooseToDiscard(4, "h", true).set("delay", false);
				if (num > 0) {
					await game.delay(0.5);
				}
			});
			await player.turnOver();
		},
		ai: {
			combo: "baonu",
			order: 10,
			result: {
				player(player) {
					return game.countPlayer(function (current) {
						if (current != player) {
							return get.sgn(get.damageEffect(current, player, player));
						}
					});
				},
			},
		},
	},
};
