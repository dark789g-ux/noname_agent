import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "huguan" | "yaopei" | "mingluan">} */
export const groupSkills = {
	//王桃王悦
	huguan: {
		audio: 2,
		audioname: ["wangyue"],
		init(player) {
			game.addGlobalSkill("huguan_all");
		},
		trigger: { global: "useCard" },
		direct: true,
		filter(event, player) {
			if (get.color(event.card, false) != "red") {
				return false;
			}
			var evt = event.getParent("phaseUse");
			if (!evt || evt.player != event.player) {
				return false;
			}
			return (
				event.player
					.getHistory("useCard", function (event) {
						return event.getParent("phaseUse") == evt;
					})
					.indexOf(event) === 0
			);
		},
		async content(event, trigger, player) {
			const result = await player
				.chooseControl(lib.suit, "cancel2")
				.set("prompt", get.prompt("huguan", trigger.player))
				.set("prompt2", "令某种花色的手牌不计入其本回合的手牌上限")
				.set("ai", function () {
					var player = _status.event.player,
						target = _status.event.getTrigger().player,
						att = get.attitude(player, target);
					if (att <= 0) {
						if (!player.hasSkill("yaopei") || target.isDamaged() || !player.countCards("he") || target.needsToDiscard() - target.needsToDiscard(-target.countCards("h") / 4) > (att > -2 ? 1.6 : 1)) {
							return "cancel2";
						}
					}
					let list = lib.suit.slice(0);
					if (att <= 0 && target.getStorage("huguan_add")) {
						for (let i of target.getStorage("huguan_add")) {
							if (list.includes(i)) {
								return i;
							}
						}
					}
					list.removeArray(target.getStorage("huguan_add"));
					if (list.length) {
						return list.randomGet();
					}
					return "cancel2";
				})
				.forResult();
			if (result.control != "cancel2") {
				const target = trigger.player;
				player.logSkill("huguan", target);
				game.log(player, "选择了", "#g" + get.translation(result.control), "花色");
				target.addTempSkill("huguan_add");
				target.markAuto("huguan_add", [result.control]);
			}
		},
		subSkill: {
			add: {
				charlotte: true,
				onremove: true,
				mod: {
					ignoredHandcard(card, player) {
						if (player.getStorage("huguan_add").includes(get.suit(card, player))) {
							return true;
						}
					},
					cardDiscardable(card, player, name) {
						if (name == "phaseDiscard" && player.getStorage("huguan_add").includes(get.suit(card, player))) {
							return false;
						}
					},
				},
				intro: { content: "本回合$花色的牌不计入手牌上限" },
			},
			all: {
				mod: {
					aiValue(player, card, num) {
						if (player && player.storage.huguan_all > 0 && get.itemtype(card) == "card" && get.color(card, player) == "red") {
							return num + player.storage.huguan_all;
						}
					},
				},
				trigger: {
					player: ["phaseUseBegin", "useCard"],
				},
				filter(event, player) {
					if (event.name === "useCard") {
						return player.storage.huguan_all;
					}
					return true;
				},
				silent: true,
				charlotte: true,
				async content(event, trigger, player) {
					let num = -157;
					if (trigger.name === "useCard") {
						player.storage.huguan_all = 0;
						return;
					}
					game.countPlayer(current => {
						if (current.hasSkill("huguan")) {
							num = Math.max(num, get.attitude(_status.event.player, current));
						}
					}, true);
					if (num === -157) {
						game.removeGlobalSkill("huguan_all");
					} else if (num === 0) {
						player.storage.huguan_all = 6;
					} else if (num > 0) {
						player.storage.huguan_all = 9;
					}
				},
			},
		},
	},
	yaopei: {
		audio: 2,
		trigger: { global: "phaseDiscardEnd" },
		direct: true,
		filter(event, player) {
			if (player == event.player || !event.player.isIn() || !player.countSkill("huguan")) {
				return false;
			}
			var suits = [];
			event.player.getHistory("lose", function (evt) {
				if (evt.type == "discard" && evt.getParent("phaseDiscard") == event) {
					for (var i of evt.cards2) {
						suits.add(get.suit(i, evt.hs.includes(i) ? evt.player : false));
					}
				}
			});
			if (suits.length >= lib.suit.length) {
				return false;
			}
			if (_status.connectMode && player.countCards("h") > 0) {
				return true;
			}
			return player.hasCard(function (card) {
				return !suits.includes(get.suit(card));
			}, "he");
		},
		async content(event, trigger, player) {
			const suits = [];
			trigger.player.getHistory("lose", function (evt) {
				if (evt.type == "discard" && evt.getParent("phaseDiscard") == trigger) {
					for (var i of evt.cards2) {
						suits.add(get.suit(i, evt.hs.includes(i) ? evt.player : false));
					}
				}
			});
			const result = await player
				.chooseCardTarget({
					prompt: get.prompt("yaopei", trigger.player),
					prompt2: "操作提示：选择要弃置的牌，并选择执行摸牌选项的角色，另一名角色执行回复体力的选项。",
					suits: suits,
					position: "he",
					filterCard(card, player) {
						return !_status.event.suits.includes(get.suit(card)) && lib.filter.cardDiscardable(card, player, "yaopei");
					},
					filterTarget(card, player, target) {
						return target == player || target == _status.event.getTrigger().player;
					},
					ai1(card) {
						let player = _status.event.player,
							source = _status.event.getTrigger().player;
						if (get.attitude(player, source) > 0 && (get.recoverEffect(player, player, player) > 0 || get.recoverEffect(source, player, player) > 0)) {
							return 12 - get.value(card);
						}
						return 8 - get.value(card);
					},
					ai2(target) {
						let player = _status.event.player,
							source = _status.event.getTrigger().player;
						let recoverer = player === target ? source : player;
						if (recoverer.isHealthy()) {
							return get.attitude(player, target);
						}
						let att = get.attitude(player, recoverer),
							rec = get.recoverEffect(recoverer, player, player);
						if (rec > 0) {
							return Math.abs(att) + get.attitude(player, target);
						}
						return 0;
					},
				})
				.forResult();
			if (result.bool) {
				const target = trigger.player;
				player.logSkill("yaopei", target);
				await player.discard(result.cards);
				if (player == result.targets[0]) {
					if (target.isDamaged() && target.hp < player.hp && (get.mode() != "identity" || player.identity != "nei")) {
						player.addExpose(0.15);
					}
					await target.recover();
					await player.draw(2);
				} else {
					if ((player.isHealthy() || player.hp > target.hp) && (get.mode() != "identity" || player.identity != "nei")) {
						player.addExpose(0.15);
					}
					await target.draw(2);
					await player.recover();
				}
			}
		},
		ai: {
			combo: "huguan",
		},
	},
	mingluan: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			return player != event.player && event.player.isIn() && player.hasSkill("mingluan_mark") && player.countCards("he") > 0;
		},
		async content(event, trigger, player) {
			let he = player.getCards("he"),
				disval = 0,
				dis = 0,
				spare = 30,
				use = true;
			for (let i of he) {
				let val = get.value(i, player);
				if (val < 6 && get.position(i) == "h") {
					dis++;
					disval += val;
				} else if (val < spare) {
					spare = val;
				}
			}
			if (!dis) {
				dis = 1;
				disval = spare;
				spare = -1;
			}
			let draw = Math.min(trigger.player.countCards("h"), 5 + dis - player.countCards("h"));
			if (6 * draw < disval) {
				use = false;
			}
			const next = player.chooseToDiscard("he", get.prompt("mingluan"), "弃置任意张牌，并摸等同于" + get.translation(trigger.player) + "手牌数的牌（至多摸至五张）", [1, Infinity], "allowChooseAll");
			next.set("ai", function (card) {
				let val = get.value(card, player);
				if (val < 0 && card.name !== "du") {
					return 30;
				}
				if (!_status.event.use) {
					return 0;
				}
				if (ui.selected.cards.length) {
					if (get.position(card) !== "h") {
						return 0;
					}
					return 6 - val;
				}
				if (_status.event.spare < 0 || get.position(card) === "h") {
					return 30 - val;
				}
				return 0;
			})
				.set("spare", spare)
				.set("use", use);
			next.logSkill = ["mingluan", trigger.player];
			const result = await next.forResult();
			if (result.bool) {
				const num = trigger.player.countCards("h"),
					num2 = 5 - player.countCards("h");
				if (num > 0 && num2 > 0) {
					await player.draw(Math.min(num, num2));
				}
			}
		},
		group: "mingluan_count",
		subSkill: {
			count: {
				charlotte: true,
				trigger: { global: "recoverEnd" },
				silent: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					var current = _status.currentPhase;
					return current && current != player && !player.hasSkill("mingluan_mark");
				},
				async content(event, trigger, player) {
					player.addTempSkill("mingluan_mark");
				},
			},
			mark: {
				charlotte: true,
			},
		},
	},
};
