import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const fenweiSkills = {
	fenwei: {
		audio: 2,
		audioname2: { heqi: "fenwei_heqi" },
		limited: true,
		trigger: { global: "useCardToPlayered" },
		filter(event, player) {
			if (event.getParent().triggeredTargets3.length > 1) {
				return false;
			}
			if (get.type(event.card) != "trick") {
				return false;
			}
			if (get.info(event.card).multitarget) {
				return false;
			}
			if (event.targets.length < 2) {
				return false;
			}
			return true;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), `令${get.translation(trigger.card)}对任意名角色无效`, [1, trigger.targets.length], (card, player, target) => {
					return get.event().targets.includes(target);
				})
				.set("ai", target => {
					const player = get.player();
					const trigger = get.event().getTrigger();
					return -get.effect(target, trigger.card, trigger.player, player);
				})
				.set("targets", trigger.targets)
				.forResult();
		},
		skillAnimation: true,
		animationColor: "wood",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			trigger.getParent().excluded.addArray(event.targets);
			await game.delayx();
		},
	},
	chulao: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			if (target.group == "unknown") {
				return false;
			}
			for (var i = 0; i < ui.selected.targets.length; i++) {
				if (ui.selected.targets[i].group == target.group) {
					return false;
				}
			}
			return target.countCards("he") > 0;
		},
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		filterCard: true,
		position: "he",
		selectTarget: [1, Infinity],
		check(card) {
			if (get.suit(card) == "spade") {
				return 8 - get.value(card);
			}
			return 5 - get.value(card);
		},
		async content(event, trigger, player) {
			const { num, cards, targets } = event;
			let result;

			// step 0
			if (num == 0 && get.suit(cards[0]) == "spade") {
				await player.draw();
			}
			result = await player.choosePlayerCard(targets[num], "he", true).forResult();

			// step 1
			if (result.bool) {
				if (result.links && result.links.length) {
					await targets[num].discard(result.links[0]);
				}
				if (get.suit(result.links[0]) == "spade") {
					await targets[num].draw();
				}
			}
		},
		ai: {
			result: {
				target: -1,
			},
			threaten: 1.2,
			order: 3,
		},
	},
	xunxun: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		preHidden: true,
		frequent: true,
		async content(event, trigger, player) {
			const cards = get.cards(4, true);
			await game.cardsGotoOrdering(cards);
			const result = await player
				.chooseToMove("恂恂：将两张牌置于牌堆顶（靠左的牌更靠上）", true)
				.set("selectionSpec", { move: "xunxun" })
				.set("list", [["牌堆顶", cards], ["牌堆底"]])
				.set("filterMove", function (from, to, moved) {
					if (to == 1 && moved[1].length >= 2) {
						return false;
					}
					return true;
				})
				.set("filterOk", function (moved) {
					return moved[1].length == 2;
				})
				.set("processAI", function (list) {
					var cards = list[0][1].slice(0).sort(function (a, b) {
						return get.value(b) - get.value(a);
					});
					return [cards, cards.splice(2)];
				})
				.forResult();
			const top = result.moved[0];
			const bottom = result.moved[1];
			top.reverse();
			player.popup(`${get.cnNumber(top.length)}上${get.cnNumber(bottom.length)}下`);
			await game.cardsGotoPile(top.concat(bottom), ["top_cards", top], (event, card) => {
				if (event.top_cards.includes(card)) {
					return ui.cardPile.firstChild;
				}
				return null;
			});
		},
	},
	wangxi: {
		audio: 2,
		trigger: { player: "damageEnd", source: "damageSource" },
		getIndex: event => event.num,
		filter(event) {
			if (event._notrigger.includes(event.player)) {
				return false;
			}
			return event.num && event.source?.isIn() && event.player?.isIn() && event.source != event.player;
		},
		check(event, player) {
			if (player.isPhaseUsing()) {
				return true;
			}
			if (event.player == player) {
				return get.attitude(player, event.source) > -3;
			}
			return get.attitude(player, event.player) > -3;
		},
		logTarget(event, player) {
			if (event.player == player) {
				return event.source;
			}
			return event.player;
		},
		preHidden: true,
		async content(event, trigger, player) {
			await game.asyncDraw([trigger.player, trigger.source].sortBySeat());
		},
		ai: {
			maixie: true,
			maixie_hp: true,
		},
	},
	refangquan: {
		audio: 2,
		trigger: { player: "phaseUseBefore" },
		filter(event, player) {
			return player.countCards("h") > 0 && !player.hasSkill("fangquan3");
		},
		direct: true,
		async content(event, trigger, player) {
			let result;

			// step 0
			var fang = player.countMark("fangquan2") == 0 && player.hp >= 2 && player.countCards("h") <= player.maxHp + 1;
			result = await player
				.chooseBool(get.prompt2("refangquan"))
				.set("ai", function () {
					if (!_status.event.fang) {
						return false;
					}
					return game.hasPlayer(function (target) {
						if (target.hasJudge("lebu") || target == player) {
							return false;
						}
						if (get.attitude(player, target) > 4) {
							return get.threaten(target) / Math.sqrt(target.hp + 1) / Math.sqrt(target.countCards("h") + 1) > 0;
						}
						return false;
					});
				})
				.set("fang", fang)
				.forResult();

			// step 1
			if (result.bool) {
				player.logSkill("refangquan");
				trigger.cancel();
				player.addTempSkill("fangquan2", "phaseAfter");
				player.addMark("fangquan2", 1, false);
				player.addTempSkill("refangquan2");
				//player.storage.fangquan=result.targets[0];
			}
		},
	},
	refangquan2: {
		mod: {
			maxHandcardBase(player, num) {
				return player.maxHp;
			},
		},
	},
	rehunzi: {
		inherit: "hunzi",
		filter(event, player) {
			return player.hp <= 2 && !player.storage.rehunzi;
		},
		ai: {
			threaten(player, target) {
				if (target.hp <= 2) {
					return 2;
				}
				return 0.5;
			},
			maixie: true,
			effect: {
				target(card, player, target) {
					if (!target.hasFriend()) {
						return;
					}
					if (target.hp === 3 && get.tag(card, "damage") == 1 && !target.isTurnedOver() && _status.currentPhase != target && get.distance(_status.currentPhase, target, "absolute") <= 3) {
						return [0.5, 1];
					}
					if (target.hp === 1 && get.tag(card, "recover") && !target.isTurnedOver() && _status.currentPhase !== target && get.distance(_status.currentPhase, target, "absolute") <= 3) {
						return [1, -3];
					}
				},
			},
		},
	},
	rezhijian: {
		inherit: "zhijian",
		group: ["rezhijian_use"],
		subfrequent: ["use"],
		subSkill: {
			use: {
				audio: "rezhijian",
				trigger: { player: "useCard" },
				frequent: true,
				filter(event, player) {
					return get.type(event.card) == "equip";
				},
				prompt: "是否发动【直谏】摸一张牌？",
				async content(event, trigger, player) {
					await player.draw("nodelay");
				},
			},
		},
	},
	retuntian: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		frequent: true,
		filter(event, player) {
			if (player == _status.currentPhase) {
				return false;
			}
			if (event.name == "gain" && event.player == player) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.cards2 && evt.cards2.length > 0;
		},
		async content(event, trigger, player) {
			const judgeEvent = player.judge(function (card) {
				return 1;
			});
			judgeEvent.callback = lib.skill.retuntian.callback;
			await judgeEvent;
		},
		async callback(event, trigger, player) {
			let result;
			const { card } = event;
			// step 0
			if (event.judgeResult.suit == "heart") {
				player.gain(card, "gain2");
				return;
			} else if (get.mode() == "guozhan") {
				result = await player
					.chooseBool("是否将" + get.translation(card) + "作为“田”置于武将牌上？")
					.set("frequentSkill", "retuntian")
					.set("ai", function () {
						return true;
					})
					.forResult();
			} else {
				result = { bool: true };
			}

			// step 1
			if (!result.bool) {
				//game.cardsDiscard(card);
				return;
			}
			const next = player.addToExpansion(card, "gain2");
			next.gaintag.add("tuntian");
			await next;
		},
		group: "tuntian_dist",
		locked: false,
		ai: {
			effect: {
				target() {
					return lib.skill.tuntian.ai.effect.target.apply(this, arguments);
				},
			},
			threaten(player, target) {
				if (target.countCards("h") == 0) {
					return 2;
				}
				return 0.5;
			},
			nodiscard: true,
			nolose: true,
			notemp: true,
		},
	},
	rebeige: {
		audio: "beige",
		audioname: ["re_caiwenji"],
		trigger: { global: "damageEnd" },
		filter(event, player) {
			return event.card && event.card.name == "sha" && event.source && event.player.classList.contains("dead") == false && player.countCards("he");
		},
		direct: true,
		checkx(event, player) {
			var att1 = get.attitude(player, event.player);
			var att2 = get.attitude(player, event.source);
			return att1 > 0 && att2 <= 0;
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			const next = player.chooseToDiscard("he", get.prompt2("rebeige", trigger.player));
			const check = lib.skill.beige.checkx(trigger, player);
			next.set("ai", function (card) {
				if (_status.event.goon) {
					return 8 - get.value(card);
				}
				return 0;
			});
			next.set("logSkill", "rebeige");
			next.set("goon", check);
			result = await next.forResult();

			// step 1
			if (result.bool) {
				result = await trigger.player.judge().forResult();
			} else {
				return;
			}

			// step 2
			switch (result.suit) {
				case "heart":
					trigger.player.recover(trigger.num);
					break;
				case "diamond":
					trigger.player.draw(3);
					break;
				case "club":
					await trigger.source.chooseToDiscard("he", 2, true);
					break;
				case "spade":
					trigger.source.turnOver();
					break;
			}
		},
		ai: {
			expose: 0.3,
		},
	},
	rexingshang: {
		audio: 2,
		audioname: ["v_caopi"],
		audioname2: { caoying: "lingren_xingshang" },
		trigger: { global: "die" },
		filter(event, player) {
			return player.isDamaged() || event.player.countCards("he") > 0;
		},
		direct: true,
		async content(event, trigger, player) {
			let result;

			// step 0
			const choice = [];
			if (player.isDamaged()) {
				choice.push("回复体力");
			}
			if (trigger.player.countCards("he")) {
				choice.push("获得牌");
			}
			choice.push("cancel2");

			result = await player
				.chooseControl(choice)
				.set("prompt", get.prompt2("rexingshang"))
				.set("ai", function () {
					if (choice.length == 2) {
						return 0;
					}
					if (get.value(trigger.player.getCards("he")) > 8) {
						return 1;
					}
					return 0;
				})
				.forResult();

			// step 1
			if (result.control != "cancel2") {
				player.logSkill(event.name, trigger.player);
				if (result.control == "获得牌") {
					const togain = trigger.player.getCards("he");
					await player.gain(togain, trigger.player, "giveAuto", "bySelf");
				} else {
					await player.recover();
				}
			}
		},
	},
};
