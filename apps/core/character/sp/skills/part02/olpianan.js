import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olpianan" | "olyinji" | "olkuisi" | "olzhuyan" | "olleijie" | "releijie">} */
export const groupSkills = {
	//OL刘老板
	olpianan: {
		audio: 2,
		trigger: {
			player: ["enterGame", "phaseDiscardEnd"],
			global: "phaseBefore",
		},
		forced: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		content() {
			"step 0";
			var hs = player.getCards("h", card => {
				return get.name(card) != "shan" && lib.filter.cardDiscardable(card, player, "olpianan");
			});
			if (hs.length) {
				player.discard(hs);
			}
			"step 1";
			var num = player.hp - player.countCards("h");
			if (num > 0) {
				var cards = [];
				for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
					var card = ui.cardPile.childNodes[i];
					if (card.name == "shan") {
						cards.add(card);
						num--;
					}
					if (num == 0) {
						break;
					}
				}
				if (num > 0) {
					for (var i = 0; i < ui.discardPile.childNodes.length; i++) {
						var card = ui.discardPile.childNodes[i];
						if (card.name == "shan") {
							cards.add(card);
							num--;
						}
						if (num == 0) {
							break;
						}
					}
				}
				if (cards.length) {
					player.gain(cards, "gain2");
				}
			}
		},
		mod: {
			aiValue(player, card, num) {
				if (card.name != "shan") {
					return;
				}
				if (player == _status.currentPhase) {
					return 0;
				}
			},
			aiUseful() {
				return lib.skill.olpianan.mod.aiValue.apply(this, arguments);
			},
		},
	},
	olyinji: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		forced: true,
		filter(event, player) {
			return !player.isMaxHp(true);
		},
		content() {
			"step 0";
			player
				.chooseControl("体力", "体力上限")
				.set("prompt", "殷积：回复1点体力或加1点体力上限")
				.set("ai", () => {
					var player = _status.event.player;
					if (!player.isDamaged() || (player.hp > 3 && player.getDamagedHp() == 1) || player.maxHp < 3) {
						return 1;
					}
					return 0;
				});
			"step 1";
			player[result.index == 0 ? "recover" : "gainMaxHp"]();
		},
	},
	olkuisi: {
		audio: 2,
		trigger: { player: "phaseDrawBefore" },
		forced: true,
		content() {
			"step 0";
			trigger.cancel();
			var cards = game.cardsGotoOrdering(get.cards(4)).cards;
			event.cards = cards.slice();
			"step 1";
			player
				.chooseButton(["窥伺：是否使用其中的一张牌？", cards])
				.set("filterButton", button => {
					return _status.event.player.hasUseTarget(button.link);
				})
				.set("ai", button => {
					var player = _status.event.player,
						card = button.link,
						cards = _status.event.getParent().cards;
					var val = player.getUseValue(card) + 0.01;
					if ((val > 0 && cards.length > 1) || (val > 4 && cards.length == 1 && (player.maxHp > 3 || player.isDamaged()))) {
						return get.order(card) + val / 5;
					}
					return 0;
				});
			"step 2";
			if (result.bool) {
				var card = result.links[0];
				event.cards.remove(card);
				player.$gain2(card, false);
				game.delayx();
				player.chooseUseTarget(true, card, false);
			} else {
				event.goto(4);
			}
			"step 3";
			if (cards.some(i => get.position(i, true) == "o" && player.hasUseTarget(i))) {
				event.goto(1);
			}
			"step 4";
			if (cards.length != 1 && cards.length != 2) {
				player.loseMaxHp();
			}
		},
	},
	//卢氏
	olzhuyan: {
		audio: 2,
		trigger: { player: "phaseDiscardEnd" },
		init(player) {
			player.addSkill("olzhuyan_record");
		},
		onremove: ["olzhuyan_true", "olzhuyan_false"],
		filter(event, player) {
			return game.hasPlayer(current => {
				return [true, false].some(bool => !player.getStorage("olzhuyan_" + bool).includes(current) && lib.skill.olzhuyan.getNum(current, bool));
			});
		},
		getNum(player, status) {
			if (!_status.olzhuyan || !_status.olzhuyan[player.playerid]) {
				return 0;
			}
			let num = _status.olzhuyan[player.playerid][status ? 1 : 0];
			if (status) {
				let no = num > 5;
				num -= player.countCards("h");
				if (no) {
					num = Math.min(0, num);
				}
			} else {
				num -= player.hp;
				if (num + player.hp < 1) {
					num = 1 - player.hp;
				}
			}
			return num;
		},
		getMap(player) {
			const map = {};
			for (const bool of [true, false]) {
				const targeted = player.getStorage("olzhuyan_" + bool);
				game.countPlayer(current => {
					if (targeted.includes(current)) {
						return false;
					}
					if (!map[current.playerid]) {
						map[current.playerid] = [];
					}
					map[current.playerid][bool ? 1 : 0] = lib.skill.olzhuyan.getNum(current, bool);
				});
			}
			return map;
		},
		async cost(event, trigger, player) {
			const map = get.info(event.skill).getMap(player);
			const targetprompt = (map, target) => {
				const list = map[target.playerid] || [];
				let str = "";
				for (let i = 0; i < 2; i++) {
					if (list[i] === undefined) {
						str += "--";
					} else {
						str += (list[i] > 0 ? "+" : "") + list[i];
					}
					str += "/";
				}
				return str.slice(0, -1);
			};
			const func = (targetprompt, map) => {
				game.countPlayer(target => {
					let text = targetprompt(map, target);
					target.prompt("体力值" + text.replaceAll("/", "<br>手牌数"));
				});
			};
			if (event.player == game.me) {
				func(targetprompt, map);
			} else if (event.isOnline()) {
				player.send(func, targetprompt, map);
			}
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名角色将{体力值/手牌数}调整至与其上个结束阶段相同(“--”表示已对其发动过该分支)", (card, player, target) => {
					const list = get.event().map[target.playerid];
					return list && (list[0] || list[1]);
				})
				.set("map", map)
				.set("ai", target => {
					const list = get.event().map[target.playerid];
					const att = get.attitude(get.player(), target);
					const v1 = list[0],
						v2 = get.sgn(list[1]) * Math.sqrt(Math.abs(list[1]));
					return Math[att > 0 ? "max" : "min"](v1, v2) * att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const map = get.info(event.name).getMap(player);
			const list = map[target.playerid];
			const choices = ["体力值", "手牌数"];
			let result;
			if (list[0] && list[1]) {
				result = await player
					.chooseControl(choices)
					.set("choiceList", ["令" + get.translation(target) + (list[0] > 0 ? "回复" : "失去") + Math.abs(list[0]) + "点体力" + (list[0] < 0 ? "（至多失去至1）" : ""), "令" + get.translation(target) + (list[1] > 0 ? "摸" : "弃置") + get.cnNumber(Math.abs(list[1])) + "张" + (list[1] > 0 ? "" : "手") + "牌" + (list[1] > 0 ? "（至多摸至5）" : "")])
					.set("prompt", "驻颜：请选择一项")
					.set("ai", () => _status.event.choice)
					.set(
						"choice",
						(() => {
							const v1 = list[0],
								v2 = get.sgn(list[1]) * Math.sqrt(Math.abs(list[1]));
							if (get.attitude(player, target) > 0) {
								return v1 > v2 ? 0 : 1;
							}
							return v1 > v2 ? 1 : 0;
						})()
					)
					.forResult();
			} else {
				result = { index: list[0] ? 0 : 1 };
			}
			const ind = result.index;
			player.markAuto("olzhuyan_" + Boolean(ind), [target]);
			let num = map[target.playerid][ind];
			if (ind == 0) {
				if (num > 0) {
					await target.recover(num);
				} else {
					await target.loseHp(Math.min(target.hp - 1, -num));
				}
			} else {
				if (num > 0) {
					num = Math.min(5 - target.countCards("h"), num);
					if (num > 0) {
						await target.draw(num);
					}
				} else {
					num = -num;
					if (target.countCards("h")) {
						await target.chooseToDiscard(num, true).set("prompt", "驻颜：请弃置" + get.cnNumber(Math.abs(num)) + "张手牌", "allowChooseAll");
					}
				}
			}
		},
		subSkill: {
			record: {
				trigger: { global: ["phaseJieshuAfter", "phaseBefore", "enterGame"] },
				lastDo: true,
				charlotte: true,
				forced: true,
				popup: false,
				forceDie: true,
				filter(event, player) {
					return event.name != "phase" || game.phaseNumber == 0;
				},
				content() {
					if (!_status.olzhuyan) {
						_status.olzhuyan = {};
					}
					if (event.triggername == "phaseBefore") {
						game.countPlayer(current => {
							_status.olzhuyan[current.playerid] = [current.hp, current.countCards("h")];
						});
					} else {
						_status.olzhuyan[trigger.player.playerid] = [trigger.player.hp, trigger.player.countCards("h")];
					}
				},
			},
		},
	},
	olleijie: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名角色判定。若结果为♠2~9，其受到2点雷电伤害，否则其摸两张牌。")
				.set("ai", target => {
					const { player, sgn } = get.event();
					if (sgn > 0) {
						return get.damageEffect(target, target, player, "thunder");
					} else if (sgn == 0) {
						return get.attitude(player, target);
					}
					return 0;
				})
				.set(
					"sgn",
					(() => {
						let sgn = 0;
						game.countPlayer(current => {
							if (!current.hasSkillTag("rejudge")) {
								return;
							}
							sgn = get.sgnAttitude(player, current);
						});
						return sgn;
					})()
				)
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const { bool } = await target
				.judge(card => {
					const number = get.number(card);
					if (get.suit(card) == "spade" && number >= 2 && number <= 9) {
						return -4;
					}
					return 2;
				})
				.set("judge2", result => {
					return result.bool === false;
				})
				.forResult();
			if (bool) {
				await target.draw(2);
			} else {
				await target.damage(2, "thunder");
			}
		},
	},
	releijie: {
		audio: "olleijie",
		enable: "phaseUse",
		filterTarget: true,
		usable: 1,
		async content(event, trigger, player) {
			const target = event.target,
				result = await target
					.judge(card => {
						var number = get.number(card);
						if (get.suit(card) == "spade" && number >= 2 && number <= 9) {
							return -4;
						}
						return 2;
					})
					.set("judge2", result => {
						return result.bool === false ? true : false;
					})
					.forResult();
			if (result.bool) {
				await target.draw(2);
			} else {
				const card = new lib.element.VCard({ name: "sha", nature: "thunder", isCard: true });
				for (let i = 1; i <= 2; i++) {
					if (player.canUse(card, target, false)) {
						await player.useCard(card, target, false);
					} else {
						break;
					}
				}
			}
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					let sgn = 0,
						eff = 0,
						num = get.attitude(player, target);
					const card = new lib.element.VCard({ name: "sha", nature: "thunder", isCard: true });
					game.countPlayer(current => {
						if (!current.hasSkillTag("rejudge")) {
							return;
						}
						sgn = get.sgnAttitude(player, current);
					});
					if (sgn > 0 && player.canUse(card, target, false)) {
						eff += get.effect(target, card, player, player) * 2;
						return eff * get.sgn(num);
					} else if (sgn == 0) {
						return num * get.sgn(num);
					}
					return 0;
				},
			},
		},
	},
};
