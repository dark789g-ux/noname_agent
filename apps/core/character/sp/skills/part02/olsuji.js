import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsuji" | "ollangdao">} */
export const groupSkills = {
	//张燕
	olsuji: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			if (!event.player.isDamaged()) {
				return false;
			}
			return player.hasCard(card => {
				if (_status.connectMode) {
					return true;
				}
				return get.color(card) == "black";
			}, "hes");
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			const next = player.chooseToUse();
			next.set("openskilldialog", `###${get.prompt("olsuji")}###将一张黑色牌当【杀】使用${player == trigger.player ? "" : `。若${get.translation(trigger.player)}受到了此【杀】的伤害，你获得其一张牌。`}`);
			next.set("norestore", true);
			next.set("_backupevent", "olsuji_backup");
			next.set("addCount", false);
			next.set("logSkill", "olsuji");
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup("olsuji_backup");
			const result = await next.forResult();
			if (result.bool) {
				if (
					trigger.player.isIn() &&
					trigger.player.hasHistory("damage", evt => {
						return evt.card?.storage?.olsuji;
					}) &&
					trigger.player.countGainableCards(player, "he")
				) {
					player.gainPlayerCard(trigger.player, "he", true);
				}
			}
		},
		subSkill: {
			backup: {
				filterCard(card) {
					return get.itemtype(card) == "card" && get.color(card) == "black";
				},
				viewAs: {
					name: "sha",
					storage: { olsuji: true },
				},
				selectCard: 1,
				position: "hes",
				ai1(card) {
					return 5 - get.value(card);
				},
				log: false,
			},
		},
	},
	ollangdao: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return event.isFirstTarget && event.targets.length == 1 && player.getStorage("ollangdao").length < 3;
		},
		logTarget: "target",
		onremove: true,
		check(event, player) {
			if (get.attitude(player, event.target) > 0) {
				if (
					player.getStorage("ollangdao").includes(1) &&
					game.hasPlayer(current => {
						return player.canUse(event.card, current) && get.effect(current, event.card, player, player) > 0;
					})
				) {
					return event.getRand() < 0.5;
				}
				return false;
			}
			return event.target.getHp() <= 2 || player.getDamagedHp() > 1 || !player.hasCard({ color: "black" }, "hes");
		},
		async content(event, trigger, player) {
			var result = event.result;
			var target = trigger.target;
			var send = function (card, list) {
				var next = game.createEvent("ollangdao_choose", false);
				next.setContent(lib.skill.ollangdao.contentx);
				next.set("card", card);
				next.set("list", list);
				game.resume();
			};
			var sendback = function (result, player) {
				if (!result) {
					result = {};
				}
				if (typeof result.index !== "number" || result.index < 0) {
					result.index = [0, 1, 2].find(i => !event.player.getStorage("ollangdao").includes(i));
				}
				results.push([player, result]);
			};
			var ai_targets = [];
			var results = [];
			var players = [player, target];
			var withme = false,
				withol = false,
				withai = false;
			for (var i = 0; i < players.length; i++) {
				if (_status.connectMode) {
					players[i].showTimer();
				}
				const card = trigger.card,
					list = player.getStorage("ollangdao");
				if (players[i].isOnline()) {
					withol = true;
					players[i].send(send, card, list);
					players[i].wait(sendback);
				} else if (players[i] == game.me) {
					withme = true;
					var next = game.createEvent("ollangdao_choose", false);
					next.setContent(lib.skill.ollangdao.contentx);
					next.set("card", card);
					next.set("list", list);
					if (_status.connectMode) {
						game.me.wait(sendback);
					}
				} else {
					ai_targets.push(players[i]);
				}
			}
			if (ai_targets.length) {
				for (var i = 0; i < ai_targets.length; i++) {
					if (players.includes(ai_targets[i])) {
						var target = ai_targets[i];
						var list = [0, 1, 2].removeArray(player.getStorage("ollangdao"));
						var index = list[0];
						if (get.attitude(target, player) < 0) {
							if (
								!game.hasPlayer(current => {
									return !trigger.targets.includes(current) && player.canUse(trigger.card, current) && get.effect(current, trigger.card, player, target) < 0;
								})
							) {
								list.removeArray([0, 2]);
							}
							if (player.getStorage("ollangdao").includes(2)) {
								list.remove(0);
							}
						} else {
							if (
								!game.hasPlayer(current => {
									return !trigger.targets.includes(current) && player.canUse(trigger.card, current) && get.effect(current, trigger.card, player, target) > 0;
								})
							) {
								list.remove(1);
							}
							if (!list.includes(1)) {
								list.remove(0);
							}
						}
						if (list.length) {
							index = list.randomGet();
						}
						sendback({ index: index }, target);
						ai_targets.splice(i--, 1);
					}
				}
				if (ai_targets.length) {
					ai_targets.randomSort();
					setTimeout(function () {
						event.interval = setInterval(
							function () {
								var target = ai_targets.shift();
								var list = [0, 1, 2].removeArray(player.getStorage("ollangdao"));
								var index = list[0];
								if (get.attitude(target, player) < 0) {
									if (
										!game.hasPlayer(current => {
											return !trigger.targets.includes(current) && player.canUse(trigger.card, current) && get.effect(current, trigger.card, player, target) < 0;
										})
									) {
										list.removeArray([0, 2]);
									}
									if (player.getStorage("ollangdao").includes(2)) {
										list.remove(0);
									}
								} else {
									if (
										!game.hasPlayer(current => {
											return !trigger.targets.includes(current) && player.canUse(trigger.card, current) && get.effect(current, trigger.card, player, target) > 0;
										})
									) {
										list.remove(1);
									}
									if (!list.includes(1)) {
										list.remove(0);
									}
								}
								if (list.length) {
									index = list.randomGet();
								}
								sendback({ index: index }, target);
								if (!ai_targets.length) {
									clearInterval(event.interval);
									if (withai) {
										game.resume();
									}
								}
							},
							_status.connectMode ? 750 : 75
						);
					}, 500);
				}
			}
			if (withme) {
				result = await next.forResult();
				if (_status.connectMode) {
					game.me.unwait(result, game.me);
				} else {
					if (!result) {
						result = {};
					}
					if (typeof result.index !== "number" || result.index < 0) {
						result.index = [0, 1, 2].find(i => !event.player.getStorage("ollangdao").includes(i));
					}
					results.push([player, result]);
				}
			}
			if (withol && !event.resultOL) {
				await game.pause();
			}
			if (ai_targets.length > 0) {
				withai = true;
				await game.pause();
			}
			if (_status.connectMode) {
				for (var i of [player, target]) {
					i.hideTimer();
				}
			}
			var chosenCount = [0, 0, 0];
			results.sort((a, b) => lib.sort.seat(a[0], b[0]));
			const card = trigger.card;
			player.when("useCardAfter").step(async (event, trigger, player) => {
				const dieEvts = game.getGlobalHistory("everything", evt => evt.name == "die");
				if (
					trigger.card == card &&
					!game.hasPlayer2(current => {
						for (const evt of dieEvts) {
							if (evt.player != current) {
								continue;
							}
							const evtx = evt.getParent(2);
							if (evtx.name != "damage") {
								continue;
							}
							if (evtx.card && evtx.card == card) {
								return true;
							}
						}
						return false;
					}, true)
				) {
					const toRemove = card.storage.ollangdao_remove;
					const list = [0, 1, 2].filter(i => (toRemove >> i) & 1);
					if (!list.length) {
						return;
					}
					player.markAuto("ollangdao", list);
					game.log(
						player,
						"移去了",
						"#g【狼蹈】",
						"的",
						"#y选项" +
							list
								.map(i => {
									return get.cnNumber(i + 1, true);
								})
								.join("、")
					);
				}
			});
			if (!trigger.card.storage) {
				trigger.card.storage = {};
			}
			if (!trigger.card.storage.ollangdao_remove) {
				trigger.card.storage.ollangdao_remove = 0;
			}
			var config = [
				["伤害+1", "fire"],
				["目标+1", "wood"],
				["不能响应", "water"],
			];
			for (var res of results) {
				var target = res[0],
					result = res[1];
				if (!target || !result) {
					continue;
				}
				var ind = result.index;
				var conf = config[ind];
				trigger.card.storage.ollangdao_remove |= 1 << ind;
				target.popup(conf[0], conf[1]);
				game.log(target, "选择令", trigger.card, `#g${conf[0]}`);
				chosenCount[ind]++;
			}
			game.delay();
			var extraBaseDamage = chosenCount[0],
				extraTargetNum = chosenCount[1],
				directHit = chosenCount[2];
			trigger.getParent().baseDamage += extraBaseDamage;
			if (directHit) {
				trigger.directHit.addArray(game.players);
			}
			if (extraTargetNum <= 0) {
				event.finish();
				return;
			}
			result = await player
				.chooseTarget(`狼蹈：为${get.translation(trigger.card)}额外指定至多${get.cnNumber(extraTargetNum)}个目标`, (card, player, target) => {
					return !_status.event.targets.includes(target) && player.canUse(_status.event.card, target);
				})
				.set("targets", trigger.targets)
				.set("ai", target => {
					var player = _status.event.player;
					return get.effect(target, _status.event.card, player, player);
				})
				.set("card", trigger.card)
				.forResult();
			if (result.bool) {
				if (!event.isMine() && !event.isOnline()) {
					game.delayex();
				}
				var targets = result.targets;
				player.line(targets);
				trigger.targets.addArray(targets);
				game.log(targets, "也成为了", trigger.card, "的目标");
			}
		},
		contentx() {
			"step 0";
			var name = get.translation(card);
			var choices = [],
				choiceList = [`令${name}伤害基数+1`, `令${name}可以多选择一个目标`, `令${name}不可被响应`];
			[0, 1, 2].forEach((item, index) => {
				if (event.list.includes(item)) {
					choiceList[index] = `<span style="text-decoration: line-through; opacity:0.5; ">${choiceList[index]}</span>`;
				} else {
					choices.push(`选项${get.cnNumber(index + 1, true)}`);
				}
			});
			game.me
				.chooseControl(choices)
				.set("prompt", "狼蹈：请选择一项")
				.set("choiceList", choiceList)
				.set("ai", () => {
					return _status.event.controls.randomGet();
				});
			"step 1";
			event.result = { index: ["选项一", "选项二", "选项三"].indexOf(result.control) };
		},
		intro: {
			content: (storage, player) => `已移除选项${storage.map(i => get.cnNumber(i + 1, true)).join("、")}`,
		},
	},
};
