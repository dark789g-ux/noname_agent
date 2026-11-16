import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdyunji" | "stdzongji" | "stdyuanqing" | "stdshuchen" | "stdqianchong" | "stdshangjian" | "stdgushe" | "stdjici" | "stdxingfa" | "stdyinge" | "stdshiren" | "stdjuyi">} */
export const groupSkills = {
	//王允
	stdyunji: {
		audio: "jingong",
		enable: "chooseToUse",
		filterCard(card, player) {
			return get.type(card) == "equip";
		},
		position: "hes",
		viewAs: { name: "jiedao" },
		viewAsFilter(player) {
			return player.countCards("hes", { type: "equip" });
		},
		prompt: "将一张装备牌当借刀杀人使用",
		check(card) {
			const val = get.value(card);
			return 5 - val;
		},
	},
	stdzongji: {
		audio: "wylianji",
		trigger: {
			global: "damageEnd",
		},
		filter(event, player) {
			if (!event.card || !["sha", "juedou"].includes(event.card.name)) {
				return false;
			}
			if (!event.player.isIn() || !event.source || !event.source.isIn()) {
				return false;
			}
			return event.player.countCards("he") || event.source.countCards("he");
		},
		check(event, player) {
			let eff1 = get.effect(event.player, { name: "guohe_copy2" }, player, player),
				eff2 = get.effect(event.source, { name: "guohe_copy2" }, player, player);
			return eff1 + eff2 > 0;
		},
		logTarget(event) {
			return [event.player, event.source];
		},
		async content(event, trigger, player) {
			if (trigger.player.countCards("he")) {
				await player.discardPlayerCard(trigger.player, "he", true);
			}
			if (trigger.source.countCards("he")) {
				await player.discardPlayerCard(trigger.source, "he", true);
			}
		},
	},
	//四象封印·太阴
	//华歆
	stdyuanqing: {
		audio: "yuanqing",
		trigger: {
			player: "phaseEnd",
		},
		getCards(player) {
			let cards = [];
			player.getHistory("lose", evt => {
				if (evt.cards2 && evt.cards2.some(i => get.position(i) == "d")) {
					cards.addArray(evt.cards2.filter(i => get.position(i) == "d"));
				}
			});
			return cards;
		},
		filter(event, player) {
			let targets = lib.skill.stdyuanqing.logTarget(event, player);
			return targets && targets.length;
		},
		logTarget(event, player) {
			return game.filterPlayer(current => {
				let cards = lib.skill.stdyuanqing.getCards(current);
				return cards && cards.length;
			});
		},
		async content(event, trigger, player) {
			for (const target of event.targets) {
				let cards = lib.skill.stdyuanqing.getCards(target);
				if (!cards.length) {
					continue;
				}
				const result = await target.chooseButton(["获得其中一张牌", cards], true).forResult();
				if (result.bool) {
					await target.gain(result.links, "gain2");
				}
			}
		},
	},
	stdshuchen: {
		audio: "shuchen",
		enable: "chooseToUse",
		viewAsFilter(player) {
			return player != _status.currentPhase && player.countCards("h") > player.getHandcardLimit();
		},
		filterCard: true,
		position: "h",
		selectCard() {
			const player = get.player();
			return player.countCards("h") - player.getHandcardLimit();
		},
		viewAs: {
			name: "tao",
		},
		prompt: "将超出手牌上限的手牌当桃使用",
		check(card) {
			return 15 - get.value(card);
		},
	},
	//玩姬
	stdqianchong: {
		mod: {
			cardUsable(card, player) {
				if (player.countCards("e") % 2 != 0) {
					return Infinity;
				}
			},
			targetInRange(card, player) {
				if (player.countCards("e") % 2 == 0) {
					return true;
				}
			},
		},
	},
	stdshangjian: {
		trigger: {
			player: "phaseJieshuBegin",
		},
		audio: "xinfu_shangjian",
		filter(event, player) {
			let num = 0,
				cards = [];
			player.getHistory("lose", evt => {
				if (evt.cards2) {
					num += evt.cards2.length;
				}
				if (evt.cards2.some(i => get.position(i) == "d")) {
					cards.addArray(evt.cards2.filter(i => get.position(i) == "d"));
				}
			});
			return cards.length && num > 0 && num <= player.hp;
		},
		async cost(event, trigger, player) {
			let cards = [];
			player.getHistory("lose", evt => {
				if (evt.cards2 && evt.cards2.some(i => get.position(i) == "d")) {
					cards.addArray(evt.cards2.filter(i => get.position(i) == "d"));
				}
			});
			const result = await player
				.chooseButton(["尚俭：选择获得其中一张牌", cards])
				.set("ai", button => {
					return get.value(button.link, get.event().player);
				})
				.forResult();
			event.result = {
				bool: result.bool,
				cost_data: result.links,
			};
		},
		async content(event, trigger, player) {
			await player.gain(event.cost_data, "gain2");
		},
	},
	//王司徒
	stdgushe: {
		audio: "gushe",
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			let num = 1,
				target = event.target;
			while (num > 0 && player.canCompare(target)) {
				num--;
				let winner = [],
					failure = [];
				let result = await player.chooseToCompare(target).forResult();
				if (result.bool) {
					failure.push(target);
					target.chat(lib.skill.gushe.chat.randomGet());
					await player.draw();
				} else if (result.tie) {
					failure = [player, target];
				} else {
					failure.push(player);
					target.chat(lib.skill.gushe.chat.randomGet());
					await target.draw();
				}
				if (player.canCompare(target)) {
					for (let loser of failure) {
						let choice = loser.countCards("h", card => get.value(card) <= 6 && card.number > 10) > 0;
						const { bool } = await loser.chooseBool("是否与其再次拼点？").set("choice", choice).forResult();
						if (bool) {
							num++;
						}
					}
				}
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					let hs = player.getCards("h");
					if (
						hs.some(card => get.value(card) <= 6 && card.number > 10) ||
						(player.getHp() < 2 && player.getHp() + player.countCards("h", { name: ["tao", "jiu"] }) > 2) ||
						(player.getHp() > 1 && player.getHp() + player.countCards("h", { name: "tao" }) > 2)
					) {
						return -1;
					}
					return 0;
				},
			},
		},
	},
	stdjici: {
		audio: "jici",
		trigger: {
			player: "compare",
			target: "compare",
		},
		filter(event, player) {
			if (event.player == player && event.iwhile) {
				return false;
			}
			return true;
		},
		check(event, player) {
			return (
				(player.getHp() < 2 && player.getHp() + player.countCards("h", { name: ["tao", "jiu"] }) > 2) ||
				(player.getHp() > 1 && player.getHp() + player.countCards("h", { name: "tao" }) > 2)
			);
		},
		async content(event, trigger, player) {
			await player.loseHp();
			if (player == trigger.player) {
				trigger.num1 = 13;
			} else {
				trigger.num2 = 13;
			}
			game.log(player, "的拼点牌点数为13");
		},
	},
	//钟会
	stdxingfa: {
		audio: "gzpaiyi",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return (
				player.getHp() <= player.countCards("h") &&
				game.hasPlayer(function (current) {
					return current != player;
				})
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "对一名其他角色造成1点伤害", function (card, player, target) {
					return target != player;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			await event.targets[0].damage("nocard");
		},
		ai: {
			expose: 0.25,
			threaten: 1.7,
		},
	},
	//刘璋
	stdyinge: {
		audio: "yinlang",
		usable: 1,
		enable: "phaseUse",
		filterTarget(card, player, target) {
			return player != target && target.countCards("he");
		},
		async content(event, trigger, player) {
			const target = event.target;
			await target.chooseToGive(1, "he", player, true);
			let targets = game.filterPlayer(current => {
				if (!target.canUse({ name: "sha", isCard: true }, current, false)) {
					return false;
				}
				if (current == player) {
					return true;
				}
				return player.inRange(current);
			});
			if (!targets.length) {
				return;
			}
			const result = await target
				.chooseTarget("选择使用杀的目标", true)
				.set("useTargets", targets)
				.set("filterTarget", (card, player, target) => {
					let targets = get.event().useTargets;
					return targets.includes(target);
				})
				.set("ai", target => {
					return get.effect(target, { name: "sha", isCard: true }, get.player(), get.player());
				})
				.forResult();
			if (result.bool) {
				await target.useCard({ name: "sha", isCard: true }, result.targets);
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					return target.countCards("he") > 2 ? 1 : 0;
				},
			},
		},
	},
	stdshiren: {
		audio: "xiusheng",
		trigger: {
			target: "useCardToTargeted",
		},
		filter(event, player) {
			return event.card.name == "sha" && event.player != player;
		},
		usable: 1,
		logTarget: "player",
		async content(event, trigger, player) {
			await player.draw(2);
			await player.chooseToGive(event.targets[0], "he", true);
		},
	},
	stdjuyi: {
		zhuSkill: true,
		trigger: {
			player: "damageBegin4",
		},
		filter(event, player) {
			if (!event.source || event.source == player || !player.countCards("he")) {
				return false;
			}
			if (player.hasHistory("damage", evt => evt.source && evt.source == event.source)) {
				return false;
			}
			return event.source.group == "qun" && !player.getStorage("stdjuyi").includes(event.source);
		},
		async cost(event, trigger, player) {
			const result = await trigger.source
				.choosePlayerCard(
					player,
					"he",
					get.prompt(event.skill, player),
					"据益：是否获得" + get.translation(player) + "一张牌并防止此次伤害？"
				)
				.set("ai", button => {
					if (get.event().eff > 0) {
						return 0;
					}
					return get.value(button.link);
				})
				.set("eff", get.damageEffect(player, trigger.source, trigger.source))
				.forResult();
			event.result = {
				bool: result.bool,
				cards: result.links,
				targets: [trigger.source],
			};
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.give(event.cards, target);
			trigger.cancel();
			if (!player.getStorage("stdjuyi").length) {
				player.when({ global: "phaseEnd" }).step(async () => {
					delete player.storage.stdjuyi;
				});
			}
			player.markAuto("stdjuyi", target);
		},
	},
};
