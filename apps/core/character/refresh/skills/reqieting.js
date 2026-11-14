import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const reqietingSkills = {
	//界蔡夫人
	reqieting: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		direct: true,
		filter(event, player) {
			var target = event.player;
			if (player == target) {
				return false;
			}
			if (!target.getHistory("sourceDamage").length) {
				var cards = target.getCards("e");
				for (var i of cards) {
					if (player.canEquip(i)) {
						return true;
					}
				}
			}
			return (
				target.getHistory("useCard", function (evt) {
					return (
						evt.targets &&
						evt.targets.filter(function (i) {
							return i != target;
						}).length > 0
					);
				}).length == 0
			);
		},
		frequent: true,
		async content(event, trigger, player) {
			const target = trigger.player;
			let logged = false;
			let result;

			// step 0
			var list = [];
			if (!target.getHistory("sourceDamage").length) {
				var cards = target.getCards("e");
				for (var i of cards) {
					if (player.canEquip(i)) {
						list.push(i);
					}
				}
			}
			if (list.length) {
				result = await player
					.choosePlayerCard(target, "e", get.prompt("reqieting", target))
					.set("list", list)
					.set("filterButton", function (button) {
						return _status.event.list.includes(button.link);
					})
					.set("ai", function (button) {
						var evt = _status.event,
							val = get.value(button.link);
						if (evt.target.hasSkillTag("noe")) {
							val -= 4;
						}
						if (evt.att > 0 == val > 0) {
							return 0;
						}
						return get.effect(evt.player, button.link, evt.player, evt.player);
					})
					.set("att", get.attitude(player, target))
					.forResult();

				// step 1
				if (result.bool) {
					player.logSkill("reqieting", target);
					logged = true;
					var card = result.links[0];
					target.$give(card, player, false);
					await game.delay(0.5);
					player.equip(card);
				}
			}

			if (
				target.getHistory("useCard", function (evt) {
					return (
						evt.targets &&
						evt.targets.filter(function (i) {
							return i != target;
						}).length > 0
					);
				}).length != 0
			) {
				return;
			}

			// step 2
			result = await player.chooseBool("是否发动【窃听】摸一张牌？").set("frequentSkill", "reqieting").forResult();

			// step 3
			if (result.bool) {
				if (!logged) {
					player.logSkill("reqieting", target);
				}
				await player.draw().forResult();
			}
		},
	},
	rexianzhou: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return player.countCards("e") > 0;
		},
		filterCard: true,
		position: "e",
		selectCard: -1,
		filterTarget: lib.filter.notMe,
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards, target } = event;
			player.awakenSkill(event.name);
			player.give(cards, target);
			player.recover(cards.length);
			const list = game.filterPlayer(function (current) {
				return target.inRange(current);
			});
			if (list.length) {
				const max = Math.min(list.length, cards.length);
				const result = await target
					.chooseTarget(true, [1, max], "对至多" + get.cnNumber(max) + "名范围内的角色各造成1点伤害", function (card, player, target) {
						return _status.event.list.includes(target);
					})
					.set("list", list)
					.set("ai", function (target) {
						var player = _status.event.player;
						return get.damageEffect(target, player, player);
					})
					.forResult();
				if (result.bool) {
					const targets = result.targets.sortBySeat();
					player.line(targets, "green");
					for (const i of targets) {
						i.damage("nocard");
					}
				}
			} else {
				return;
			}
		},
		ai: {
			order: 1,
			result: {
				target: 1,
				player(player) {
					var bool = true,
						players = game.filterPlayer();
					for (var i = 0; i < players.length; i++) {
						if (players[i] != player && get.attitude(player, players[i]) > 2 && get.attitude(players[i], player) > 2) {
							bool = false;
							break;
						}
					}
					if (bool) {
						return -10;
					}
					if (player.hp == 1) {
						return 1;
					}
					if (game.phaseNumber < game.players.length) {
						return -10;
					}
					if (player.countCards("e") + player.hp <= player.maxHp) {
						return 1;
					}
					return -10;
				},
			},
		},
	},
	//界关平
	relongyin: {
		audio: 2,
		init: player => {
			game.addGlobalSkill("relongyin_order");
		},
		onremove: player => {
			if (!game.hasPlayer(current => current.hasSkill("relongyin", null, null, false), true)) {
				game.removeGlobalSkill("relongyin_order");
			}
		},
		trigger: { global: "useCard" },
		direct: true,
		filter(event, player) {
			return event.card.name == "sha" && player.countCards("he") > 0 && event.player.isPhaseUsing();
		},
		async content(event, trigger, player) {
			let go = false;
			if (get.attitude(player, trigger.player) > 0) {
				if (get.color(trigger.card) == "red") {
					go = true;
				} else if (trigger.addCount === false || !trigger.player.isPhaseUsing()) {
					go = false;
				} else if (!trigger.player.hasSkill("paoxiao") && !trigger.player.hasSkill("tanlin3") && !trigger.player.hasSkill("zhaxiang2") && !trigger.player.hasSkill("fengnu") && !trigger.player.getEquip("zhuge")) {
					const nh = trigger.player.countCards("h");
					if (player == trigger.player) {
						go = player.countCards("h", "sha") > 0;
					} else if (nh >= 4) {
						go = true;
					} else if (player.countCards("h", "sha")) {
						if (nh == 3) {
							go = Math.random() < 0.8;
						} else if (nh == 2) {
							go = Math.random() < 0.5;
						}
					} else if (nh >= 3) {
						if (nh == 3) {
							go = Math.random() < 0.5;
						} else if (nh == 2) {
							go = Math.random() < 0.2;
						}
					}
				}
			}
			//AI停顿
			if (
				go &&
				!event.isMine() &&
				!event.isOnline() &&
				player.hasCard(function (card) {
					return get.value(card) < 6 && lib.filter.cardDiscardable(card, player, event.name);
				}, "he")
			) {
				game.delayx();
			}
			const result = await player
				.chooseToDiscard(get.prompt("longyin"), "弃置一张牌" + (get.color(trigger.card) == "red" ? "并摸一张牌" : "") + "，令" + get.translation(trigger.player) + "本次使用的【杀】不计入使用次数", "he")
				.set("logSkill", ["relongyin", trigger.player])
				.set("ai", function (card) {
					if (_status.event.go) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("go", go)
				.forResult();
			if (result.bool) {
				if (trigger.addCount !== false) {
					trigger.addCount = false;
					const stat = trigger.player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				}
				if (get.color(trigger.card) == "red") {
					player.draw();
				}
				if (get.number(result.cards[0], player) == get.number(trigger.card)) {
					player.restoreSkill("jiezhong");
				}
			}
		},
		ai: {
			expose: 0.2,
		},
		subSkill: {
			order: {
				mod: {
					aiOrder: (player, card, num) => {
						if (num && card.name === "sha" && get.color(card) === "red") {
							let gp = game.findPlayer(current => {
								return current.hasSkill("relongyin") && current.hasCard(i => true, "he");
							});
							if (gp) {
								return num + 0.15 * Math.sign(get.attitude(player, gp));
							}
						}
					},
				},
				trigger: { player: "dieAfter" },
				filter: (event, player) => {
					return !game.hasPlayer(current => current.hasSkill("relongyin", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				charlotte: true,
				content: () => {
					game.removeGlobalSkill("relongyin_order");
				},
			},
		},
	},
	jiezhong: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		filter(event, player) {
			return player.countCards("h") < player.maxHp;
		},
		async content(event, trigger, player) {
			const { name } = event;
			player.awakenSkill(name);
			await player.draw(Math.min(5, player.maxHp - player.countCards("h")));
		},
	},
	//新郭淮
	decadejingce: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		filter(event, player) {
			return player.getHistory("useCard").length >= player.hp;
		},
		async content(event, trigger, player) {
			const list = [],
				history = player.getHistory("useCard");
			for (const i of history) {
				let suit = get.suit(i.card);
				if (lib.suit.includes(suit)) {
					list.add(suit);
				}
				if (list.length >= player.hp) {
					break;
				}
			}
			let result;
			let goon = false;
			if (list.length >= player.hp) {
				goon = true;
			} else {
				result = await player.chooseControl("摸牌阶段", "出牌阶段").set("prompt", "精策：选择要执行的额外阶段").forResult();
			}
			//插入阶段，后来的先插
			const evt = trigger.getParent("phase", true, true);
			if (goon || (result && result.index == 1)) {
				if (evt?.phaseList) {
					evt.phaseList.splice(evt.num + 1, 0, `phaseUse|${event.name}`);
				}
			}
			if (goon || (result && result.index == 0)) {
				if (evt?.phaseList) {
					evt.phaseList.splice(evt.num + 1, 0, `phaseDraw|${event.name}`);
				}
			}
		},
	},
	//新于禁
	decadezhenjun: {
		audio: 2,
		trigger: {
			player: ["phaseZhunbeiBegin", "phaseJieshuBegin"],
		},
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countDiscardableCards(player, "he") > 0;
			});
		},
		direct: true,
		async content(event, trigger, player) {
			const chooseResult = await player
				.chooseTarget(get.prompt2("decadezhenjun"), function (card, player, target) {
					return target.countDiscardableCards(player, "he") > 0;
				})
				.set("ai", function (target) {
					const player = get.player();
					return -get.attitude(player, target) * (target.countDiscardableCards(player, "e") + 1);
				})
				.forResult();
			if (!chooseResult.bool) return;
			const target = chooseResult.targets[0];
			const num = Math.min(Math.max(target.countCards("h") - target.hp, 1), target.countDiscardableCards(player, "he"));
			player.logSkill("decadezhenjun", target);
			const discardResult = await player.discardPlayerCard(num, target, true, "allowChooseAll").forResult();
			if (discardResult.cards && discardResult.cards.length) {
				for (let i = 0; i < discardResult.cards.length; i++) {
					if (get.type(discardResult.cards[i]) == "equip") {
						return;
					}
				}
				const cardNum = discardResult.cards.length;
				if (cardNum > 0) {
					const prompt = "弃置一张牌，或令" + get.translation(target) + "摸" + get.cnNumber(cardNum) + "张牌";
					const result = await player
						.chooseToDiscard(prompt, "he")
						.set("ai", function (card) {
							return 7 - get.value(card);
						})
						.forResult();
					if (!result.bool) {
						target.draw(cardNum);
					}
				}
			}
		},
	},
	//界姜维
	oltiaoxin: {
		audio: "tiaoxin",
		audioname: ["sp_jiangwei", "xiahouba", "re_jiangwei", "gz_jiangwei", "ol_jiangwei"],
		enable: "phaseUse",
		usable(skill, player) {
			return 1 + (player.hasSkill(skill + "_rewrite", null, null, false) ? 1 : 0);
		},
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.oltiaoxin.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target != player && target.inRange(player) && target.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			const { target } = event;
			const result = await target
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"挑衅：对" + get.translation(player) + "使用一张杀，或令其弃置你的一张牌"
				)
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("complexTarget", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.filterTarget.apply(this, arguments);
				})
				.set("sourcex", player)
				.forResult();
			if (
				!result.bool ||
				!player.hasHistory("damage", evt => {
					return evt.getParent().type == "card" && evt.getParent(4) == event;
				})
			) {
				if (target.countDiscardableCards(player, "he") > 0) {
					await player.discardPlayerCard(target, "he", true).set("boolline", true);
				}
				player.addTempSkill(event.name + "_rewrite", "phaseUseEnd");
			}
		},
		ai: {
			order: 4,
			expose: 0.2,
			result: {
				target: -1,
				player(player, target) {
					if (target.countCards("h") == 0) {
						return 0;
					}
					if (target.countCards("h") == 1) {
						return -0.1;
					}
					if (player.hp <= 2) {
						return -2;
					}
					if (player.countCards("h", "shan") == 0) {
						return -1;
					}
					return -0.5;
				},
			},
			threaten: 1.1,
		},
		subSkill: { rewrite: { charlotte: true } },
	},
};
