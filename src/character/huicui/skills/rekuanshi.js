import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "rekuanshi" | "guowu" | "zhuangrong" | "llqshenwei" | "cuijian" | "tongyuan" | "zhtongyuan">} */
export const groupSkills = {
	//阚泽
	rekuanshi: {
		audio: "kuanshi",
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					let att = get.attitude(get.player(), target);
					if (target.hp < 3) {
						att /= 1.5;
					}
					return att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const [target] = event.targets;
			player.addTempSkill(event.name + "_effect", { player: "phaseBegin" });
			player.markAuto(event.name + "_effect", [target]);
			await game.delayx();
		},
		subSkill: {
			effect: {
				charlotte: true,
				audio: "kuanshi",
				onremove: true,
				intro: { content: "每回合限一次，当$于一回合内受到第2点伤害后，其回复1点体力。" },
				trigger: { global: "damageEnd" },
				filter(event, player) {
					if (!player.getStorage("rekuanshi_effect").includes(event.player) || event.player.isHealthy()) {
						return false;
					}
					let history = event.player.getHistory("damage", null, event),
						num = 0;
					for (const evt of history) {
						if (evt.rekuanshi) {
							return false;
						}
						num += evt.num;
					}
					return num > 1 && num - event.num < 2;
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					trigger.rekuanshi = true;
					await trigger.player.recover();
				},
			},
		},
	},
	//吕玲绮
	guowu: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		preHidden: true,
		async content(event, trigger, player) {
			const hs = player.getCards("h");
			await player.showCards(hs, get.translation(player) + "发动了【帼武】");
			const list = [];
			for (const c of hs) {
				list.add(get.type2(c, player));
				if (list.length >= 3) {
					break;
				}
			}
			if (list.length >= 1) {
				const card = get.discardPile(i => i.name == "sha");
				if (card) {
					await player.gain(card, "gain2");
				}
			}
			if (list.length >= 2) {
				player.addTempSkill("guowu_dist", "phaseUseAfter");
			}
			if (list.length >= 3) {
				player.addTempSkill("guowu_add", "phaseUseAfter");
			}
		},
		subSkill: {
			dist: {
				charlotte: true,
				mod: { targetInRange: () => true },
			},
			used: { charlotte: true },
			add: {
				audio: "guowu",
				charlotte: true,
				trigger: { player: "useCard1" },
				direct: true,
				filter(event, player) {
					var info = get.info(event.card, false);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.card.name != "sha" && (info.type != "trick" || get.mode() == "guozhan" || player.hasSkill("guowu_used"))) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						if (
							game.hasPlayer(function (current) {
								return !event.targets.includes(current) && lib.filter.targetEnabled2(event.card, player, current) && lib.filter.targetInRange(event.card, player, current);
							})
						) {
							return true;
						}
					}
					return false;
				},
				async content(event, trigger, player) {
					let result;

					// step 0
					const num = game.countPlayer(current => {
						return !trigger.targets.includes(current) && lib.filter.targetEnabled2(trigger.card, player, current) && lib.filter.targetInRange(trigger.card, player, current);
					});
					result = await player
						.chooseTarget("帼武：是否为" + get.translation(trigger.card) + "增加" + (num > 1 ? "至多两个" : "一个") + "目标？", [1, Math.min(2, num)], function (card, player, target) {
							const trigger = _status.event.getTrigger();
							card = trigger.card;
							return !trigger.targets.includes(target) && lib.filter.targetEnabled2(card, player, target) && lib.filter.targetInRange(card, player, target);
						})
						.set("ai", function (target) {
							const player = _status.event.player;
							const card = _status.event.getTrigger().card;
							return get.effect(target, card, player, player);
						})
						.forResult();
					// step 1
					if (!result.bool) {
						return;
					}

					if (player != game.me && !player.isOnline()) {
						await game.delayx();
					}
					// step 2
					const targets = result.targets.sortBySeat();
					player.logSkill("guowu_add", targets);
					trigger.targets.addArray(targets);
					if (get.mode() == "guozhan") {
						player.addTempSkill("guowu_used", "phaseUseAfter");
					}
				},
			},
		},
	},
	zhuangrong: {
		derivation: ["llqshenwei", "wushuang"],
		audio: 2,
		trigger: { global: "phaseEnd" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return player.hp == 1 || player.countCards("h") == 1;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp();
			if (player.maxHp > player.hp) {
				await player.recover(player.maxHp - player.hp);
			}
			await player.drawTo(Math.min(5, player.maxHp));
			await player.addSkills(["llqshenwei", "wushuang"]);
		},
	},
	llqshenwei: {
		audio: 2,
		trigger: { player: "phaseDrawBegin2" },
		forced: true,
		filter: event => !event.numFixed,
		async content(event, trigger, player) {
			trigger.num += 2;
		},
		mod: {
			maxHandcard: (player, num) => num + 2,
		},
	},
	cuijian: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.cuijian.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			let result;
			let num;

			// step 0
			const hs = target.getCards("h", "shan");
			if (hs.length) {
				hs.addArray(target.getCards("he", card => get.subtype(card) == "equip2"));
				await player.gain(hs, target, "give", "bySelf");
				if (player.hasMark("zhtongyuan_basic")) {
					return;
				} else {
					num = hs.length;
					event.num = num;
				}
			} else {
				if (player.hasMark("zhtongyuan_trick")) {
					await player.draw(2);
				}
				return;
			}
			// step 1
			const hs2 = player.getCards("he");
			if (!hs2.length || !target.isIn()) {
				return;
			} else if (hs2.length <= num) {
				result = { bool: true, cards: hs2 };
			} else {
				result = await player.chooseCard("he", true, "选择交给" + get.translation(target) + get.cnNumber(num) + "张牌", num).forResult();
			}
			// step 2
			if (result.bool && result.cards && result.cards.length) {
				await player.give(result.cards, target);
			}
		},
		ai: {
			order: 4,
			result: {
				player(player, target) {
					if (!target.countCards("h", "shan")) {
						return player.hasMark("zhtongyuan_trick") ? 2 : 0;
					}
					return 0;
				},
				target(player, target) {
					if (target.countCards("h", "shan")) {
						var num = -target.countCards("h") / 2;
						var card = target.getEquip(2);
						if (card) {
							num -= get.value(card, target) / 2;
						}
						return num;
					}
					return -0.01;
				},
			},
		},
	},
	tongyuan: { audio: 2 },
	zhtongyuan: {
		audio: "tongyuan",
		trigger: { player: ["useCardAfter", "respondAfter"] },
		forced: true,
		filter(event, player) {
			var type = get.type2(event.card, false);
			return (type == "basic" || type == "trick") && get.color(event.card, false) == "red" && !player.hasMark("zhtongyuan_" + type);
		},
		async content(event, trigger, player) {
			var type = get.type2(trigger.card, false);
			if (!player.hasMark("zhtongyuan_" + type)) {
				player.addMark("zhtongyuan_" + type, 1, false);
				game.log(player, "修改了技能", "#g【摧坚】");
			}
		},
		group: ["zhtongyuan_basic", "zhtongyuan_trick"],
		subSkill: {
			basic: {
				trigger: { player: "useCard2" },
				direct: true,
				locked: true,
				filter(event, player) {
					if (!player.hasMark("zhtongyuan_basic") || !player.hasMark("zhtongyuan_trick")) {
						return false;
					}
					var card = event.card;
					if (get.color(card, false) != "red" || get.type(card, null, false) != "basic") {
						return false;
					}
					var info = get.info(card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						if (
							game.hasPlayer(function (current) {
								return !event.targets.includes(current) && lib.filter.targetEnabled2(card, player, current);
							})
						) {
							return true;
						}
					}
					return false;
				},
				async content(event, trigger, player) {
					let result;
					const prompt2 = "为" + get.translation(trigger.card) + "增加一个目标";
					result = await player
						.chooseTarget(get.prompt("zhtongyuan"), (card, currentPlayer, target) => {
							return !trigger.targets.includes(target) && lib.filter.targetEnabled2(trigger.card, currentPlayer, target);
						})
						.set("prompt2", prompt2)
						.set("ai", target => get.effect(target, trigger.card, player, player))
						.set("card", trigger.card)
						.set("targets", trigger.targets)
						.forResult();
					if (!result.bool) {
						return;
					}
					if (!event.isMine() && !event.isOnline()) {
						game.delayx();
					}
					event.targets = result.targets;
					if (event.targets) {
						player.logSkill("zhtongyuan", event.targets);
						trigger.targets.addArray(event.targets);
					}
				},
			},
			trick: {
				audio: "zhtongyuan",
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					if (!player.hasMark("zhtongyuan_basic") || !player.hasMark("zhtongyuan_trick")) {
						return false;
					}
					var card = event.card;
					return get.color(card, false) == "red" && get.type(card, null, false) == "trick";
				},
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.filterPlayer());
					game.log(trigger.card, "不可被响应");
				},
			},
		},
		ai: {
			combo: "zhtongyuan",
		},
	},
};
