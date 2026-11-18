import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhongyong" | "xinzhongyong" | "dangxian" | "longyin" | "jigong" | "jigong2" | "shifei">} */
export const groupSkills = {
	zhongyong: {
		audio: 2,
		trigger: {
			player: "shaMiss",
		},
		filter(event, player) {
			return event.responded && get.itemtype(event.responded.cards) == "cards";
		},
		async cost(event, trigger, player) {
			const cards = trigger.responded.cards;

			event.result = await player
				.chooseTarget({
					prompt: `忠勇：将${get.translation(trigger.responded.cards)}交给一名角色`,
					filterTarget(card, player, target) {
						return target !== get.event().source;
					},
					ai(target) {
						const att = get.attitude(get.player(), target);
						const cards = target.getCards("h");
						if (cards.length >= 2 && cards.some(card => card.name === "shan")) {
							att /= 1.5;
						}
						return att;
					},
				})
				.set("source", trigger.target);
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const cards = trigger.responded.cards;
			const target = event.targets[0];
			if (target === player) {
				return;
			}

			await player
				.chooseToUse({
					prompt: `是否对${get.translation(trigger.target)}使用一张杀？`,
					filterCard(card) {
						return card.name === "sha";
					},
					filterTarget(card, player, target) {
						return target === get.event().target;
					},
					selectTarget: -1,
				})
				.set("target", trigger.target)
				.set("addCount", false);
		},
	},
	xinzhongyong: {
		audio: "zhongyong",
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			return event.card.name == "sha";
		},
		async cost(event, trigger, player) {
			const sha = trigger.cards.slice(0).filterInD();
			const shan = [];
			for (const current of game.filterPlayer2()) {
				for (const evt of current.getHistory("useCard", evt => evt.card.name === "shan" && evt.getParent(3) == trigger)) {
					shan.addArray(evt.cards);
				}
			}
			shan.filterInD();

			if (!sha.length && !shan.length) {
				return;
			}

			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("xinzhongyong"),
					filterTarget(card, player, target) {
						return !_status.event.source.includes(target) && target !== player;
					},
					ai(target) {
						return get.attitude(_status.event.player, target);
					},
				})
				.set("source", trigger.targets)
				.forResult();

			event.result.cost_data = {
				sha,
				shan,
			};
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];
			const { sha, shan } = event.cost_data;

			let result;
			if (sha.length && shan.length) {
				result = await player
					.chooseControl({
						choiceList: ["将" + get.translation(event.sha) + "交给" + get.translation(target), "将" + get.translation(event.shan) + "交给" + get.translation(target)],
						ai() {
							return _status.event.choice;
						},
					})
					.set(
						"choice",
						(function () {
							if (get.color(event.sha) != "black") {
								return 0;
							}
							return 1;
						})()
					)
					.forResult();
			} else {
				result = { index: sha.length ? 0 : 1 };
			}

			const cards = result.index == 0 ? sha : shan;
			await target.gain({
				cards,
				animate: "gain2",
			});
			if (cards.some(card => get.color(card) === "red")) {
				await target
					.chooseToUse({
						prompt: "是否使用一张杀？",
						filterCard: get.filter({ name: "sha" }),
						filterTarget(card, player, target) {
							return target != _status.event.sourcex && _status.event.sourcex.inRange(target) && lib.filter.targetEnabled.apply(this, arguments);
						},
					})
					.set("sourcex", player)
					.set("addCount", false);
			}
		},
	},
	dangxian: {
		trigger: { player: "phaseBegin" },
		forced: true,
		audio: 2,
		audioname2: { guansuo: "dangxian_guansuo" },
		async content(event, trigger, player) {
			trigger.phaseList.splice(trigger.num, 0, `phaseUse|${event.name}`);
		},
	},
	longyin: {
		audio: 2,
		audioname: ["ol_guanping"],
		init: player => {
			game.addGlobalSkill("longyin_order");
		},
		onremove: player => {
			if (!game.hasPlayer(current => current.hasSkill("longyin", null, null, false), true)) {
				game.removeGlobalSkill("longyin_order");
			}
		},
		trigger: { global: "useCard" },
		filter(event, player) {
			return event.card.name == "sha" && player.countCards("he") > 0 && event.player.isPhaseUsing();
		},
		async cost(event, trigger, player) {
			let go = false;
			if (get.attitude(player, trigger.player) > 0) {
				if (get.color(trigger.card) == "red") {
					go = true;
				} else if (trigger.addCount === false || !trigger.player.isPhaseUsing()) {
					go = false;
				} else if (!trigger.player.hasSkill("paoxiao") && !trigger.player.hasSkill("tanlin3") && !trigger.player.hasSkill("zhaxiang2") && !trigger.player.hasSkill("fengnu") && !trigger.player.getEquip("zhuge")) {
					var nh = trigger.player.countCards("h");
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
			if (go && !event.isMine() && !event.isOnline() && player.hasCard(card => get.value(card) < 6 && lib.filter.cardDiscardable(card, player, event.name), "he")) {
				await game.delayx();
			}

			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt("longyin"),
					prompt2: "弃置一张牌" + (get.color(trigger.card) == "red" ? "并摸一张牌" : "") + "，令" + get.translation(trigger.player) + "本次使用的【杀】不计入使用次数",
					position: "he",
					ai(card) {
						if (get.event().go) {
							return 6 - get.value(card);
						}
						return 0;
					},
				})
				.set("go", go)
				.set("chooseonly", true)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.discard({
				cards: event.cards,
				discarder: player,
			});
			if (trigger.addCount !== false) {
				trigger.addCount = false;
				const stat = trigger.player.getStat().card;
				const name = trigger.card.name;
				if (typeof stat[name] === "number") {
					stat[name]--;
				}
			}
			if (get.color(trigger.card) == "red") {
				await player.draw();
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
								return current.hasSkill("longyin") && current.hasCard(i => true, "he");
							});
							if (gp) {
								return num + 0.15 * Math.sign(get.attitude(player, gp));
							}
						}
					},
				},
				trigger: { player: "dieAfter" },
				filter: (event, player) => {
					return !game.hasPlayer(current => current.hasSkill("longyin", null, null, false), true);
				},
				silent: true,
				forceDie: true,
				charlotte: true,
				content: () => {
					game.removeGlobalSkill("longyin_order");
				},
			},
		},
	},
	jigong: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		check(event, player) {
			var nh = player.countCards("h") - player.countCards("h", { type: "equip" });
			if (nh <= 1) {
				return true;
			}
			if (player.countCards("h", "tao")) {
				return false;
			}
			if (nh <= 2) {
				return Math.random() < 0.7;
			}
			if (nh <= 3) {
				return Math.random() < 0.4;
			}
			return false;
		},
		async content(event, trigger, player) {
			player.draw(2);
			player.addTempSkill("jigong2");
		},
	},
	jigong2: {
		mod: {
			maxHandcardBase(player, num) {
				var damage = player.getStat().damage;
				if (typeof damage == "number") {
					return damage;
				}
				return 0;
			},
		},
	},
	shifei: {
		audio: 2,
		audioname: ["re_guotufengji"],
		enable: ["chooseToRespond", "chooseToUse"],
		filter(event, player) {
			if (!_status.currentPhase || event.shifei) {
				return false;
			}
			if (!event.filterCard({ name: "shan", isCard: true }, player, event)) {
				return false;
			}
			if (event.name != "chooseToUse" && !lib.filter.cardRespondable({ name: "shan", isCard: true }, player, event)) {
				return false;
			}
			return true;
		},
		delay: false,
		checkx(player) {
			if (get.attitude(player, _status.currentPhase) > 0) {
				return true;
			}
			var nh = _status.currentPhase.countCards("h") + 1;
			var players = game.filterPlayer();
			for (var i = 0; i < players.length; i++) {
				if (players[i].countCards("h") >= nh) {
					if (!player.countCards("h", "shan") || get.attitude(player, players[i]) <= 0) {
						return true;
					}
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			player.line(_status.currentPhase, "green");
			await _status.currentPhase.draw();
			const evt = event.getParent(2);
			if (evt == null) {
				return;
			}
			if (_status.currentPhase.isMaxHandcard(true)) {
				evt.set("shifei", true);
				evt.goto(0);
				return;
			}
			const targets = game.filterPlayer(current => current.isMaxHandcard());
			let target;
			if (targets.length == 1) {
				target = targets[0];
			} else if (targets.length) {
				const result = await player
					.chooseTarget({
						prompt: "选择一名角色弃置其一张牌",
						filterTarget(card, player, target) {
							return get.event().targets.includes(target);
						},
						forced: true,
						ai(target) {
							return -get.attitude(_status.event.player, target);
						},
					})
					.set("targets", targets)
					.forResult();
				if (result.targets?.length) {
					target = result.targets[0];
				}
			}
			if (target) {
				player.line(target, "green");
				await player.discardPlayerCard({
					target,
					position: "he",
					forced: true,
				});
				evt.result = { bool: true, card: { name: "shan", isCard: true }, cards: [] };
				evt.redo();
				return;
			}
			evt.set("shifei", true);
			evt.goto(0);
		},
		ai: {
			respondShan: true,
			effect: {
				target_use(card, player, target, current) {
					if (get.tag(card, "respondShan") && current < 0) {
						var nh = player.countCards("h");
						var players = game.filterPlayer();
						for (var i = 0; i < players.length; i++) {
							if (players[i].countCards("h") > nh) {
								return 0.4;
							}
						}
					}
				},
			},
			order: 8,
			result: {
				player(player) {
					return lib.skill.shifei.checkx(player) ? 1 : 0;
				},
			},
		},
	},
};
