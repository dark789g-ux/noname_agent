import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "lirang" | "moukui" | "shenxian" | "shenxian2" | "qiangwu" | "qiangwu3" | "zhendu" | "qiluan" | "qiluan2" | "zniaoxiang">} */
export const groupSkills = {
	lirang: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (!game.hasPlayer(current => current != player)) {
				return false;
			}
			if (event.type != "discard" || event.getlx === false) {
				return false;
			}
			var evt = event.getl(player);
			if (!evt || !evt.cards2) {
				return false;
			}
			for (var i = 0; i < evt.cards2.length; i++) {
				if (get.position(evt.cards2[i]) == "d") {
					return true;
				}
			}
			return false;
		},
		async cost(event, trigger, player) {
			if (trigger.delay == false) {
				await game.delay();
			}
			const cards = trigger.getl(player)?.cards2?.filterInD("od"),
				give_map = {};
			if (_status.connectMode) {
				game.broadcastAll(function () {
					_status.noclearcountdown = true;
				});
			}
			do {
				const result =
					cards.length > 1
						? await player
								.chooseButtonTarget({
									createDialog: [`礼让：是否分配本次弃置的牌？`, cards],
									selectButton: [1, Infinity],
									cardsx: cards,
									filterTarget: lib.filter.notMe,
									ai1(button) {
										return get.value(button.link);
									},
									canHidden: true,
									ai2(target) {
										const player = get.player();
										const card = ui.selected.buttons[0].link;
										if (card) {
											return get.value(card, target) * get.attitude(player, target);
										}
										return 1;
									},
								})
								.set("allowChooseAll", true)
								.setHiddenSkill("lirang")
								.forResult()
						: await player
								.chooseTarget(`礼让：是否令一名角色获得${get.translation(cards)}？`, lib.filter.notMe)
								.set("ai", target => {
									const att = get.attitude(_status.event.player, target);
									if (_status.event.enemy) {
										return -att;
									} else if (att > 0) {
										return att / (1 + target.countCards("h"));
									} else {
										return att / 100;
									}
								})
								.setHiddenSkill("lirang")
								.set("enemy", get.value(cards[0], player, "raw") < 0)
								.forResult();
				if (result?.bool) {
					if (!result.links?.length) {
						result.links = cards.slice(0);
					}
					cards.removeArray(result.links);
					let id = result.targets[0]?.playerid;
					if (!give_map[id]) {
						give_map[id] = [];
					}
					give_map[id].addArray(result.links);
				} else {
					break;
				}
			} while (cards.length > 0);
			if (_status.connectMode) {
				game.broadcastAll(function () {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			const targets = [],
				lose_list = [];
			for (let i in give_map) {
				let source = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
				lose_list.push([source, give_map[i]]);
				targets.push(source);
			}
			event.result = {
				bool: targets.length > 0,
				targets: targets?.sortBySeat(),
				cost_data: lose_list,
			};
		},
		async content(event, trigger, player) {
			await game
				.loseAsync({
					gain_list: event.cost_data,
					giver: player,
					animate: "gain2",
				})
				.setContent("gaincardMultiple");
		},
		ai: {
			expose: 0.1,
			effect: {
				target(card, player, target, current) {
					if (target.hasFriend() && get.tag(card, "discard")) {
						if (current < 0) {
							return 0;
						}
						return [1, 1];
					}
				},
			},
		},
	},
	moukui: {
		audio: 2,
		audioname: ["sp_mushun"],
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name === "sha";
		},
		async cost(event, trigger, player) {
			const controls = ["draw_card"];
			if (trigger.target.countCards("he") > 0) {
				controls.push("discard_card");
			}
			controls.push("cancel2");
			const result = await player
				.chooseControl({
					prompt: get.prompt2(event.skill, trigger.target),
					controls,
					ai() {
						const trigger = get.event().getTrigger();
						const player = get.player();
						if (trigger.target.countCards("he") && get.attitude(_status.event.player, trigger.target) < 0) {
							return "discard_card";
						}
						const num = Math.min(player.getCardUsable("sha"), player.countCards("hs", i => get.name(i) === "sha") + 1);
						if (!player.hasCard(i => get.value(i) > 6 + num, "e")) {
							return "draw_card";
						}
						return "cancel2";
					},
				})
				.forResult();
			event.result = {
				bool: result.control != "cancel2",
				targets: [trigger.target],
				cost_data: result.control,
			};
		},
		async content(event, trigger, player) {
			const result = event.cost_data;
			if (result === "draw_card") {
				await player.draw();
			} else if (trigger.target.countCards("he")) {
				await player.discardPlayerCard(trigger.target, "he", true);
			}
			player.addTempSkill(event.name + "_conseq");
			player.markAuto(event.name + "_conseq", [[trigger.card, trigger.target]]);
		},
		ai: { expose: 0.1 },
		subSkill: {
			conseq: {
				charlotte: true,
				onremove: true,
				trigger: { player: "shaMiss" },
				filter(event, player) {
					if (!player.getStorage("moukui_conseq").some(([card, target]) => event.card == card && event.target == target)) {
						return false;
					}
					return player.countCards("he") > 0;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const list = player.getStorage(event.name).filter(([card, target]) => trigger.card == card && trigger.target == target);
					player.unmarkAuto(event.name, list);
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
					const { target } = trigger;
					target.line(player, "green");
					await target.discardPlayerCard(player, true);
				},
			},
		},
	},
	shenxian: {
		audio: 2,
		trigger: { global: ["loseAfter", "loseAsyncAfter"] },
		filter(event, player) {
			if (event.type != "discard" || _status.currentPhase == player || event.getlx === false) {
				return false;
			}
			if (event.name == "lose" && event.player == player) {
				return false;
			}
			if (player.hasSkill("shenxian2")) {
				return false;
			}
			var cards = event.cards.slice(0);
			var evt = event.getl(player);
			if (evt && evt.cards) {
				cards.removeArray(evt.cards);
			}
			for (var i = 0; i < cards.length; i++) {
				if (get.type(cards[i], null, event.hs && event.hs.includes(cards[i]) ? event.player : false) == "basic" && cards[i].original != "j") {
					return true;
				}
			}
			return false;
		},
		frequent: true,
		preHidden: true,
		content() {
			"step 0";
			if (trigger.delay == false) {
				game.delay();
			}
			"step 1";
			player.draw();
			if (event.name == "shenxian") {
				player.addTempSkill("shenxian2");
			}
		},
		ai: {
			threaten: 1.5,
		},
	},
	shenxian2: { charlotte: true },
	qiangwu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		content() {
			"step 0";
			player.judge(card => {
				if (
					game.hasPlayer(cur => {
						return get.event().player.canUse("sha", cur);
					})
				) {
					return get.number(card);
				}
				return 1 / get.number(card);
			});
			"step 1";
			player.storage.qiangwu = result.number;
			player.addTempSkill("qiangwu3", "phaseUseEnd");
		},
		ai: {
			result: {
				player: 1,
			},
			order: 11,
		},
	},
	qiangwu3: {
		mod: {
			targetInRange(card, player) {
				if (card.name == "sha") {
					const num = get.number(card);
					if (num == "unsure" || num < player.storage.qiangwu) {
						return true;
					}
				}
			},
			cardUsable(card, player) {
				if (card.name == "sha") {
					const num = get.number(card);
					if (num == "unsure" || num > player.storage.qiangwu) {
						return true;
					}
				}
			},
		},
		trigger: { player: "useCard1" },
		sourceSkill: "qiangwu",
		filter(event, player) {
			if (_status.currentPhase == player && event.card.name == "sha" && get.number(event.card) > player.storage.qiangwu && event.addCount !== false) {
				return true;
			}
			return false;
		},
		forced: true,
		popup: false,
		firstDo: true,
		content() {
			trigger.addCount = false;
			if (player.stat[player.stat.length - 1].card.sha > 0) {
				player.stat[player.stat.length - 1].card.sha--;
			}
		},
	},
	zhendu: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		filter(event, player) {
			return /*(get.mode()!='guozhan'||event.player!=player)&&*/ event.player.isIn() && player.countCards("h") > 0 && event.player.hasUseTarget({ name: "jiu" }, null, event);
		},
		direct: true,
		preHidden: true,
		content() {
			"step 0";
			var nono = Math.abs(get.attitude(player, trigger.player)) < 3;
			if (player == trigger.player || get.damageEffect(trigger.player, player, player) <= 0 || !trigger.player.hasUseTarget({ name: "jiu" }, null, trigger)) {
				nono = true;
			} else if (trigger.player.hp > 2) {
				nono = true;
			} else if (trigger.player.hp > 1 && player.countCards("h") < 3 && trigger.player.canUse("sha", player) && !player.countCards("h", "shan") && trigger.player.countCards("h") >= 3) {
				nono = true;
			}
			var next = player.chooseToDiscard(get.prompt2("zhendu", trigger.player));
			next.set("ai", function (card) {
				if (_status.event.nono) {
					return -1;
				}
				return 7 - get.useful(card);
			});
			next.set("logSkill", ["zhendu", trigger.player]);
			next.set("nono", nono);
			next.setHiddenSkill("zhendu");
			"step 1";
			if (result.bool) {
				trigger.player.chooseUseTarget({ name: "jiu" }, true, "noTargetDelay", "nodelayx");
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool && trigger.player != player) {
				trigger.player.damage();
			}
		},
		ai: {
			threaten: 2,
			expose: 0.3,
		},
	},
	qiluan: {
		audio: "qiluan2",
		preHidden: true,
		trigger: { global: "phaseEnd" },
		frequent: true,
		filter(event, player) {
			return game.hasPlayer2(function (current) {
				return current.getStat("kill") > 0;
			});
		},
		prompt(event, player) {
			var num = game.countPlayer2(function (current) {
				return (current.getStat("kill") || 0) * (current == player ? 3 : 1);
			});
			return get.prompt("qiluan") + "（可摸" + get.cnNumber(num) + "张牌）";
		},
		content() {
			//if(get.mode()=='guozhan'){
			//	player.draw(3);
			//}
			//else{
			player.draw(
				game.countPlayer2(function (current) {
					return (current.getStat("kill") || 0) * (current == player ? 3 : 1);
				})
			);
			//}
		},
		subSkill: {
			draw: {
				audio: "qiluan2",
				trigger: { global: "dieAfter" },
				frequent: true,
				filter(event, player) {
					return /*get.mode()!='guozhan'&&*/ player != event.source;
				},
				content() {
					player.draw();
				},
			},
		},
	},
	qiluan2: {
		audio: 2,
	},
	zniaoxiang: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		forced: true,
		filter(event, player) {
			const directHit = event.getParent().directHit;
			return event.card.name == "sha" && directHit !== true && !directHit.includes(event.target);
		},
		//priority:-1,
		logTarget: "target",
		content() {
			var id = trigger.target.playerid;
			var map = trigger.getParent().customArgs;
			if (!map[id]) {
				map[id] = {};
			}
			if (typeof map[id].shanRequired == "number") {
				map[id].shanRequired++;
			} else {
				map[id].shanRequired = 2;
			}
		},
	},
};
