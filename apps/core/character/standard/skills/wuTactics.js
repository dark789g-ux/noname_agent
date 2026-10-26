import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jizhi" | "qicai" | "zhiheng" | "jiuyuan" | "qixi" | "keji" | "kurou" | "yingzi" | "fanjian" | "guose" | "liuli" | "qianxun" | "lianying">} */
export const wuTacticsSkills = {
	jizhi: {
		audio: 2,
		audioname: ["jianyong"],
		audioname2: {
			xin_simayi: "jilue_jizhi",
		},
		trigger: { player: "useCard" },
		frequent: true,
		preHidden: true,
		filter(event) {
			return get.type(event.card) === "trick";
		},
		async content(event, trigger, player) {
			await player.draw({ nodelay: true });
		},
		ai: {
			threaten: 1.4,
			noautowuxie: true,
		},
	},
	qicai: {
		mod: {
			targetInRange(card, player, target, now) {
				if (["trick", "delay"].includes(get.type(card))) {
					return true;
				}
			},
		},
	},
	zhiheng: {
		audio: 2,
		audioname: ["gz_jun_sunquan"],
		audioname2: {
			xin_simayi: "jilue_zhiheng",
		},
		mod: {
			aiOrder(player, card, num) {
				if (num <= 0 || get.itemtype(card) !== "card" || get.type(card) !== "equip") {
					return num;
				}
				const eq = player.getEquip(get.subtype(card));
				if (eq != null && get.equipValue(card) - get.equipValue(eq) < Math.max(1.2, 6 - player.hp)) {
					return 0;
				}
			},
		},
		locked: false,
		enable: "phaseUse",
		usable: 1,
		position: "he",
		filterCard: true,
		selectCard: [1, Infinity],
		allowChooseAll: true,
		prompt: "弃置任意张牌并摸等量的牌",
		check(card) {
			let player = get.player();
			if (get.position(card) === "e") {
				let subs = get.subtypes(card);
				if (subs.includes("equip2") || subs.includes("equip3")) {
					return player.getHp() - get.value(card);
				}
			}
			return 6 - get.value(card);
		},
		async content(event, trigger, player) {
			await player.draw(event.cards.length);
		},
		ai: {
			order: 1,
			result: {
				player: 1,
			},
			threaten: 1.5,
		},
	},
	jiuyuan: {
		audio: 2,
		trigger: { target: "taoBegin" },
		zhuSkill: true,
		forced: true,
		filter(event, player) {
			if (event.player === player) {
				return false;
			}
			if (!player.hasZhuSkill("jiuyuan")) {
				return false;
			}
			if (event.player.group !== "wu") {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			trigger.baseDamage++;
		},
	},
	qixi: {
		audio: 2,
		audioname: ["re_ganning"],
		audioname2: { re_heqi: "duanbing_heqi" },
		enable: "chooseToUse",
		filterCard(card) {
			return get.color(card) === "black";
		},
		position: "hes",
		viewAs: { name: "guohe" },
		viewAsFilter(player) {
			if (!player.hasCards("hes", { color: "black" })) {
				return false;
			}
		},
		prompt: "将一张黑色牌当过河拆桥使用",
		check(card) {
			return 4 - get.value(card);
		},
	},
	keji: {
		audio: 2,
		audioname: ["re_lvmeng", "sp_lvmeng"],
		trigger: { player: "phaseDiscardBefore" },
		frequent(event, player) {
			return player.needsToDiscard();
		},
		filter(event, player) {
			if (player.getHistory("skipped").includes("phaseUse")) {
				return true;
			}
			const history = player.getHistory("useCard").concat(player.getHistory("respond"));
			for (const evt of history) {
				if (evt.card.name === "sha" && evt.isPhaseUsing()) {
					return false;
				}
			}
			return true;
		},
		async content(event, trigger, player) {
			trigger.cancel();
		},
	},
	kurou: {
		audio: 2,
		enable: "phaseUse",
		prompt: "失去1点体力并摸两张牌",
		delay: false,
		async content(event, trigger, player) {
			player.loseHp(1);
			player.draw(2, "nodelay");
		},
		ai: {
			basic: {
				order: 1,
			},
			result: {
				player(player) {
					if (player.needsToDiscard(3) && !player.hasValueTarget({ name: "sha" }, false)) {
						return -1;
					}
					if (player.countCards("h") >= player.hp - 1) {
						return -1;
					}
					if (player.hp < 3) {
						return -1;
					}
					return 1;
				},
			},
		},
	},
	yingzi: {
		audio: 2,
		audioname: ["sp_lvmeng"],
		trigger: { player: "phaseDrawBegin2" },
		frequent: true,
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
		ai: {
			threaten: 1.3,
		},
	},
	fanjian: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hasCards("h");
		},
		filterTarget(card, player, target) {
			return player !== target;
		},
		async content(event, trigger, player) {
			const target = event.target;
			const { control } = await target
				.chooseControl({
					controls: ["heart2", "diamond2", "club2", "spade2"],
					ai() {
						switch (Math.floor(Math.random() * 6)) {
							case 0:
								return "heart2";
							case 1:
							case 4:
							case 5:
								return "diamond2";
							case 2:
								return "club2";
							case 3:
								return "spade2";
						}
					},
				})
				.forResult();
			game.log(target, `选择了${get.translation(control)}`);
			event.choice = control;
			target.chat(`我选${get.translation(event.choice)}`);
			const { bool, cards } = await target
				.gainPlayerCard({
					target: player,
					position: "h",
					forced: true,
				})
				.forResult();
			if (bool && cards?.length && get.suit(cards[0], player) + "2" !== event.choice) {
				await target.damage({ nocard: true });
			}
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					const eff = get.damageEffect(target, player);
					if (eff >= 0) {
						return 1 + eff;
					}
					let value = 0,
						i;
					const cards = player.getCards("h");
					for (i = 0; i < cards.length; i++) {
						value += get.value(cards[i]);
					}
					value /= player.countCards("h");
					if (target.hp == 1) {
						return Math.min(0, value - 7);
					}
					return Math.min(0, value - 5);
				},
			},
		},
	},
	guose: {
		audio: 2,
		filter(event, player) {
			return player.hasCards("hes", { suit: "diamond" });
		},
		enable: "chooseToUse",
		filterCard(card) {
			return get.suit(card) === "diamond";
		},
		position: "hes",
		viewAs: { name: "lebu" },
		prompt: "将一张方片牌当乐不思蜀使用",
		check(card) {
			return 6 - get.value(card);
		},
		ai: {
			threaten: 1.5,
		},
	},
	liuli: {
		audio: 2,
		audioname: ["re_daqiao", "daxiaoqiao"],
		trigger: { target: "useCardToTarget" },
		preHidden: true,
		filter(event, player) {
			if (event.card.name !== "sha") {
				return false;
			}
			if (!player.hasCards("he")) {
				return false;
			}
			return game.hasPlayer(current => {
				return player.inRange(current) && current !== event.player && current !== player && !!lib.filter.targetEnabled(event.card, event.player, current);
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterTarget(card, player, target) {
						const trigger = _status.event;
						if (player.inRange(target) && target != trigger.source) {
							if (lib.filter.targetEnabled(trigger.card, trigger.source, target)) {
								return true;
							}
						}
						return false;
					},
					filterCard: lib.filter.cardDiscardable,
					position: "he",
					ai1: card => get.unuseful(card) + 9,
					ai2: target => {
						const player = get.player();
						if (player.hasCards("h", "shan")) {
							return -get.attitude(player, target);
						}
						if (get.attitude(player, target) < 5) {
							return 6 - get.attitude(player, target);
						}
						if (player.hp == 1 && !player.hasCards("h", "shan")) {
							return 10 - get.attitude(player, target);
						}
						if (player.hp == 2 && !player.hasCards("h", "shan")) {
							return 8 - get.attitude(player, target);
						}
						return -1;
					},
					prompt: get.prompt(event.skill),
					prompt2: "弃置一张牌，将此【杀】转移给攻击范围内的一名其他角色",
					source: trigger.player,
					card: trigger.card,
				})
				.setHiddenSkill(event.name.slice(0, -5))
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			const evt = trigger.getParent();
			if (evt) {
				evt.triggeredTargets2.remove(player);
				evt.targets.remove(player);
				evt.targets.push(target);
				await player.discard({ cards: event.cards });
			} else {
				throw new ReferenceError("找不到触发【流离】的使用牌事件");
			}
		},
		ai: {
			effect: {
				target_use(card, player, target) {
					if (!target.hasCards("he")) {
						return;
					}
					if (card.name !== "sha") {
						return;
					}
					let min = 1;
					const friend = get.attitude(player, target) > 0;
					const vcard = { name: "shacopy", nature: card.nature, suit: card.suit };
					const players = game.filterPlayer();
					for (const current of players) {
						if (player != current && get.attitude(target, current) < 0 && target.canUse(card, current)) {
							if (!friend) {
								return 0;
							}
							if (get.effect(current, vcard, player, player) > 0) {
								if (!player.canUse(card, players[0])) {
									return [0, 0.1];
								}
								min = 0;
							}
						}
					}
					return min;
				},
			},
		},
	},
	qianxun: {
		mod: {
			targetEnabled(card, player, target, now) {
				if (card.name === "shunshou" || card.name === "lebu") {
					return false;
				}
			},
		},
		audio: 2,
	},
	lianying: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		frequent: true,
		filter(event, player) {
			if (player.hasCards("h")) {
				return false;
			}
			const evt = event.getl(player);
			return evt && evt.player === player && evt.hs && evt.hs.length > 0;
		},
		async content(event, trigger, player) {
			await player.draw();
		},
		ai: {
			threaten: 0.8,
			effect: {
				player_use(card, player, target) {
					if (player.countCards("h") === 1) {
						return [1, 0.8];
					}
				},
				target(card, player, target) {
					if (get.tag(card, "loseCard") && target.countCards("h") === 1) {
						return 0.5;
					}
				},
			},
			noh: true,
			freeSha: true,
			freeShan: true,
			skillTagFilter(player, tag) {
				if (player.countCards("h") !== 1) {
					return false;
				}
			},
		},
	},
};
