import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "huisheng" | "qinqing" | "guizao" | "jiyu" | "jiyu2">} */
export const groupSkills = {
	huisheng: {
		audio: 2,
		audioname: ["dc_huanghao"],
		trigger: { player: "damageBegin4" },
		filter(event, player) {
			if (!player.countCards("he")) {
				return false;
			}
			if (!event.source || event.source == player || !event.source.isIn()) {
				return false;
			}
			if (player.storage.huisheng && player.storage.huisheng.includes(event.source)) {
				return false;
			}
			return true;
		},
		init(player) {
			player.storage.huisheng ??= [];
		},
		async cost(event, trigger, player) {
			const att = get.attitude(player, trigger.source) > 0;
			let goon = false;
			if (player.hp === 1) {
				goon = true;
			} else {
				let num = 0;
				for (const card of player.iterableGetCards("he")) {
					if (get.value(card) < 8) {
						num++;
						if (num >= 2) {
							goon = true;
							break;
						}
					}
				}
			}

			event.result = await player
				.chooseCard({
					prompt: get.prompt2("huisheng", trigger.source),
					selectCard: [1, player.countCards("he")],
					position: "he",
					ai(card) {
						const { att, goon } = get.event();
						if (att) {
							return 10 - get.value(card);
						}
						if (goon) {
							return 8 - get.value(card);
						}
						if (!ui.selected.cards.length) {
							return 7 - get.value(card);
						}
						return 0;
					},
				})
				.set("goon", goon)
				.set("att", att)
				.forResult();
		},
		logTarget(event) {
			return event?.source;
		},
		async content(event, trigger, player) {
			await game.delay();
			const cards = event.cards;
			const num = cards.length;
			const goon = num > 2 || get.attitude(trigger.source, player) >= 0;
			let forced = false;
			let str = "获得其中一张牌并防止伤害";
			if (trigger.source.countCards("he") < num) {
				forced = true;
			} else {
				str += `，或取消并弃置${get.cnNumber(cards.length)}张牌`;
			}
			const result = await trigger.source
				.chooseButton({
					createDialog: [str, cards],
					forced,
					ai(button) {
						if (get.event().goon) {
							return get.value(button.link);
						}
						return get.value(button.link) - 8;
					},
				})
				.set("goon", goon)
				.forResult();
			if (result.bool && result.links?.length) {
				const cards = result.links;
				await trigger.source.gain({
					cards,
					source: player,
					animate: "giveAuto",
					bySelf: true,
				});
				trigger.cancel();
				player.storage.huisheng ??= [];
				player.storage.huisheng.push(trigger.source);
			} else {
				await trigger.source.chooseToDiscard({
					selectCard: num,
					position: "he",
					forced: true,
				});
			}
		},
	},
	qinqing: {
		audio: 2,
		mode: ["identity", "versus", "doudizhu"],
		available(mode) {
			if (mode == "versus" && _status.mode != "four") {
				return false;
			}
			if (mode == "identity" && _status.mode == "purple") {
				return false;
			}
			return true;
		},
		getZhu(player) {
			if (get.mode() === "doudizhu") {
				return game.findPlayer(i => i.identity === "zhu");
			}
			return get.zhu(player);
		},
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			const zhu = get.info("qinqing").getZhu(player);
			if (!zhu || (get.mode() !== "doudizhu" && !zhu.isZhu)) {
				return false;
			}
			return game.hasPlayer(current => current !== zhu && current.inRange(zhu));
		},
		async cost(event, trigger, player) {
			const zhu = get.info("qinqing").getZhu(player);

			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("qinqing"),
					filterTarget(card, player, target) {
						const zhu = get.event().zhu;
						return target !== zhu && target.inRange(zhu);
					},
					selectTarget: [1, Infinity],
					ai(target) {
						const player = get.player();
						const he = target.countCards("he");
						const zhu = get.event().zhu;
						if (get.attitude(player, target) > 0) {
							if (he == 0) {
								return 1;
							}
							if (target.countCards("h") > zhu.countCards("h")) {
								return 1;
							}
						} else {
							if (he > 0) {
								return 1;
							}
						}
						return 0;
					},
				})
				.set("zhu", zhu)
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const zhu = get.info("qinqing").getZhu(player);
			const targets = event.targets.toSorted(lib.sort.seat);

			for (const target of targets) {
				if (target.countCards("he") > 0) {
					await player.discardPlayerCard({
						target,
						position: "he",
						forced: true,
					});
				}
				await target.draw();
			}

			if (!zhu) {
				return;
			}
			let num = 0;
			const nh = zhu.countCards("h");
			for (const target of targets) {
				if (target.countCards("h") > nh) {
					++num;
				}
			}
			if (num) {
				await player.draw(num);
			}
		},
		ai: {
			threaten: 1.2,
		},
	},
	guizao: {
		audio: 2,
		trigger: { player: "phaseDiscardEnd" },
		direct: true,
		filter(event, player) {
			if (event.cards && event.cards.length > 1) {
				var suits = [];
				for (var i = 0; i < event.cards.length; i++) {
					var suit = get.suit(event.cards[i]);
					if (suits.includes(suit)) {
						return false;
					} else {
						suits.push(suit);
					}
				}
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			player.chooseDrawRecover({
				prompt: get.prompt("guizao"),
				prompt2: "摸一张牌或回复1点体力",
			}).logSkill = "guizao";
		},
	},
	jiyu: {
		audio: 2,
		enable: "phaseUse",
		locked: false,
		filter(event, player) {
			if (!player.getStat().skill.jiyu || !player.storage.jiyu2) {
				return true;
			}
			var hs = player.getCards("h");
			for (var i = 0; i < hs.length; i++) {
				if (!player.storage.jiyu2.includes(get.suit(hs[i]))) {
					return true;
				}
			}
			return false;
		},
		filterTarget(card, player, target) {
			return target.countCards("h") > 0 && (!player.storage.jiyu || !player.storage.jiyu.includes(target));
		},
		async content(event, trigger, player) {
			const { target } = event;
			let result;
			const evt = event.getParent("phaseUse");
			if (evt && evt.name == "phaseUse" && !evt.jiyu) {
				evt.jiyu = true;
				const next = game.createEvent("jiyu_clear");
				_status.event.next.remove(next);
				evt.after.push(next);
				next.player = player;
				next.setContent(() => {
					game.broadcastAll(player => {
						delete player.storage.jiyu;
						delete player.storage.jiyu2;
					}, player);
				});
			}
			player.storage.jiyu ??= [];
			player.storage.jiyu.push(target);
			let spade = true;
			if (player.isTurnedOver() || get.attitude(target, player) > 0 || target.hp <= 2) {
				spade = false;
			}
			result = await target
				.chooseToDiscard({
					position: "h",
					forced: true,
					ai(card) {
						if (get.suit(card) == "spade") {
							if (_status.event.spade) {
								return 10 - get.value(card);
							}
							return -10 - get.value(card);
						}
						if (_status.event.getParent().player.storage.jiyu2 && _status.event.getParent().player.storage.jiyu2.includes(get.suit(card))) {
							return -3 - get.value(card);
						}
						return -get.value(card);
					},
				})
				.set("spade", spade)
				.forResult();
			if (!result.cards || !result.cards.length) {
				return;
			}
			const card = result.cards[0];
			if (get.suit(card, target) === "spade") {
				await player.turnOver();
				await target.loseHp();
			}
			player.storage.jiyu2 ??= [];
			player.storage.jiyu2.add(get.suit(card));
		},
		onremove: ["jiyu", "jiyu2"],
		ai: {
			order: 9,
			result: {
				target(player, target) {
					if (player.isTurnedOver() || target.countCards("h") <= 3) {
						return -1;
					}
					return 0;
				},
			},
		},
		mod: {
			cardEnabled(card, player) {
				if (player.storage.jiyu2 && player.storage.jiyu2.includes(get.suit(card))) {
					return false;
				}
			},
			cardSavable(card, player) {
				if (player.storage.jiyu2 && player.storage.jiyu2.includes(get.suit(card))) {
					return false;
				}
			},
		},
	},
	jiyu2: {
		trigger: { player: ["phaseUseBegin", "phaseUseAfter"] },
		silent: true,
		sourceSkill: "jiyu",
		async content(event, trigger, player) {
			player.storage.jiyu = [];
			player.storage.jiyu2 = [];
		},
	},
};
