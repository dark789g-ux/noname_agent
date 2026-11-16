import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "nzry_yili" | "nzry_zhenglun" | "nzry_kuizhu" | "rechezheng" | "nzry_zhizheng" | "nzry_lijun" | "nzry_lijun2" | "nzry_lijun1" | "nzry_chenglve">} */
export const groupSkills = {
	nzry_yili: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		async cost(event, trigger, player) {
			const next = player.chooseTarget(get.prompt(event.skill), "移去一个【橘】或失去1点体力，然后令一名其他角色获得一个【橘】", function (card, player, target) {
				return target != player;
			});
			next.ai = function (target) {
				const player = _status.event.player;
				if (player.storage.nzry_huaiju > 2 || player.hp > 2) {
					return get.attitude(player, target);
				}
				return -1;
			};
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			let index = 0;
			if (player.hasMark("nzry_huaiju")) {
				({ index } = await player
					.chooseControl()
					.set("choiceList", ["失去1点体力", "移去一个“橘”"])
					.set("ai", function () {
						if (player.hp > 2) {
							return 0;
						}
						return 1;
					})
					.forResult());
			}
			if (index == 1) {
				player.removeMark("nzry_huaiju", 1);
			} else {
				await player.loseHp();
			}
			target.addMark("nzry_huaiju", 1);
			target.addSkill("nzry_huaiju_ai");
		},
		ai: {
			combo: "nzry_huaiju",
		},
	},
	nzry_zhenglun: {
		audio: 2,
		trigger: {
			player: "phaseDrawBefore",
		},
		filter(event, player) {
			return !player.hasMark("nzry_huaiju");
		},
		check(event, player) {
			return player.countCards("h") >= 2 || player.skipList.includes("phaseUse");
		},
		async content(event, trigger, player) {
			trigger.cancel();
			player.addMark("nzry_huaiju", 1);
		},
		ai: {
			combo: "nzry_huaiju",
		},
	},
	nzry_kuizhu: {
		audio: 2,
		trigger: {
			player: "phaseDiscardAfter",
		},
		filter(event, player) {
			const cards = [];
			player.getHistory("lose", function (evt) {
				if (evt.type == "discard" && evt.getParent("phaseDiscard") == event) {
					cards.addArray(evt.cards2);
				}
			});
			return cards.length > 0;
		},
		async cost(event, trigger, player) {
			const cards = [];
			player.getHistory("lose", function (evt) {
				if (evt.type == "discard" && evt.getParent("phaseDiscard") == trigger) {
					cards.addArray(evt.cards2);
				}
			});
			event.num = cards.length;
			event.str1 = "令至多" + event.num + "名角色摸一张牌";
			event.str2 = "对任意名体力值之和为" + event.num + "的角色造成1点伤害";
			const result = await player
				.chooseControl("cancel2")
				.set("ai", function () {
					const player = get.player();
					const { num } = get.event().getParent();
					if (
						game.countPlayer(function (current) {
							return get.attitude(player, current) < 0 && current.hp == num;
						}) > 0 &&
						num <= 3
					) {
						return 1;
					}
					return 0;
				})
				.set("choiceList", [event.str1, event.str2])
				.set("prompt", "是否发动【溃诛】？")
				.forResult();
			if (result.control == "cancel2") {
				return;
			}
			if (result.index == 1) {
				event.result = await player
					.chooseTarget("请选择〖溃诛〗造成伤害的目标", function (card, player, target) {
						const num = ui.selected.targets.map(t => t.hp).reduce((a, b) => a + b, 0);
						return num + target.hp <= _status.event.num;
					})
					.set("filterOk", function () {
						const num = ui.selected.targets.map(t => t.hp).reduce((a, b) => a + b);
						return num == _status.event.num;
					})
					.set("ai", function (target) {
						const player = get.player();
						if (ui.selected.targets[0] != undefined) {
							return -1;
						}
						return get.attitude(player, target) < 0;
					})
					.set("complexTarget", true)
					.set("promptbar", "none")
					.set("num", event.num)
					.set("selectTarget", [1, Infinity])
					.forResult();
				event.result.cost_data = "damage";
			} else {
				const next = player.chooseTarget("请选择〖溃诛〗摸牌的目标", [1, event.num]);
				next.ai = function (target) {
					const player = get.player();
					return get.attitude(player, target);
				};
				event.result = await next.forResult();
			}
		},
		async content(event, trigger, player) {
			const targets = event.targets.sortBySeat();
			if (event.cost_data == "damage") {
				await Promise.all(targets.map(target => target.damage()));
			} else {
				game.asyncDraw(targets);
			}
		},
	},
	rechezheng: {
		audio: "nzry_zhizheng",
		trigger: { source: "damageBegin2" },
		filter(event, player) {
			return player.isPhaseUsing() && !player.inRangeOf(event.player);
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.cancel();
		},
		ai: {
			effect: {
				player(card, player, target) {
					if (target && get.tag(card, "damage") && !player.inRangeOf(target)) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	nzry_zhizheng: {
		audio: 2,
		//mod:{
		//	playerEnabled:function(card,player,target){
		//		const info=get.info(card);
		//		if(target!=player&&(!info||!info.singleCard||!ui.selected.targets.length)&&player.isPhaseUsing()&&!target.inRange(player)) return false;
		//	},
		//},
		trigger: {
			player: "phaseUseEnd",
		},
		forced: true,
		filter(event, player) {
			return (
				player.getHistory("useCard", function (evt) {
					return evt.getParent("phaseUse") == event;
				}).length <
					game.countPlayer(function (current) {
						return current != player && !current.inRange(player);
					}) &&
				game.hasPlayer(function (target) {
					return target != player && !target.inRange(player) && target.countDiscardableCards(player, "he");
				})
			);
		},
		async content(event, trigger, player) {
			const next = player.chooseTarget("请选择〖掣政〗的目标", "弃置一名攻击范围内不包含你的角色的一张牌", true, function (card, player, target) {
				return target != player && !target.inRange(player) && target.countDiscardableCards(player, "he");
			});
			next.ai = function (target) {
				return -get.attitude(player, target);
			};
			const result = await next.forResult();
			if (result.bool) {
				player.line(result.targets);
				player.discardPlayerCard(result.targets[0], "he", 1, true);
			}
		},
		group: "rechezheng",
	},
	nzry_lijun: {
		global: "nzry_lijun1",
		audio: "nzry_lijun1",
		zhuSkill: true,
	},
	nzry_lijun2: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + player.countMark("nzry_lijun2");
				}
			},
		},
		charlotte: true,
		onremove: true,
	},
	nzry_lijun1: {
		audio: 2,
		//forceaudio:true,
		trigger: {
			player: "useCardAfter",
		},
		log: false, // 实际发动者是主公，所以给牌的人不log喵
		filter(event, player) {
			if (event.card.name != "sha" || player.group != "wu") {
				return false;
			}
			if (player.hasSkill("nzry_lijun2")) {
				return false;
			}
			if (!player.isPhaseUsing()) {
				return false;
			}
			if (
				!game.hasPlayer(function (target) {
					return player != target && target.hasZhuSkill("nzry_lijun", player);
				})
			) {
				return false;
			}
			for (let i = 0; i < event.cards.length; i++) {
				if (get.position(event.cards[i], true) == "o") {
					return true;
				}
			}
			return false;
		},
		async cost(event, trigger, player) {
			const list = game.filterPlayer(function (target) {
				return player != target && target.hasZhuSkill("nzry_lijun", player);
			});
			const next = player.chooseTarget(get.prompt("nzry_lijun"), "将" + get.translation(trigger.cards) + "交给" + get.translation(list) + (list.length > 1 ? "中的一人" : ""), function (card, player, target) {
				return player != target && target.hasZhuSkill("nzry_lijun", player);
			});
			next.ai = function (target) {
				return get.attitude(_status.event.player, target);
			};
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			player.addTempSkill("nzry_lijun2", "phaseUseEnd");
			const [zhu] = event.targets;
			player.line(zhu, "green");
			zhu.logSkill("nzry_lijun"); // 给牌的人去logSkill好像还是不太好喵？
			const list = trigger.cards.filter(function (card) {
				return get.position(card, true) == "o";
			});
			const next = zhu.gain(list, "gain2");
			next.giver = player;
			await next;
			const result = await zhu
				.chooseBool()
				.set("ai", function () {
					if (get.attitude(zhu, player) > 0) {
						return true;
					}
					return false;
				})
				.set("prompt", "是否令" + get.translation(player) + "摸一张牌？")
				.forResult();
			if (!result.bool) {
				return;
			}
			await player.draw();
			player.addMark("nzry_lijun2", 1, false);
		},
	},
	nzry_chenglve: {
		audio: 2,
		mark: true,
		zhuanhuanji: true,
		marktext: "☯",
		intro: {
			content(storage, player, skill) {
				const num = storage ? 2 : 1;
				return `出牌阶段限一次，你可以摸${get.cnNumber(num)}张牌，然后弃置${get.cnNumber(3 - num)}张手牌。若如此做，直到本回合结束，你使用与弃置牌花色相同的牌无距离和次数限制`;
			},
		},
		enable: "phaseUse",
		usable: 1,
		async content(event, trigger, player) {
			player.changeZhuanhuanji("nzry_chenglve");
			const num = player.storage.nzry_chenglve ? 1 : 2;
			await player.draw(num);
			if (!player.hasCard(card => lib.filter.cardDiscardable(card, player, "nzry_chenglve"), "h")) {
				return;
			}
			await game.delayx();
			const { bool, cards } = await player
				.chooseToDiscard(true, "h", 3 - num)
				.set("ai", card => {
					const player = get.player(),
						effect = player.getStorage("nzry_chenglve_effect");
					const cards = player.getCards("h").filter(i => get.tag(i, "damage") && get.type(i) != "delay" && player.hasValueTarget(i, true, false)),
						map = {};
					for (const cardx of cards) {
						const suit = get.suit(cardx, player);
						if (typeof map[suit] != "number") {
							map[suit] = 0;
						}
						map[suit]++;
					}
					const list = [];
					for (let i in map) {
						if (map[i] > 0) {
							list.push([i, map[i]]);
						}
					}
					list.sort((a, b) => b[1] - a[1]);
					if (effect.includes(get.suit(card, player))) {
						return 0;
					}
					if (list.some(i => i[0] == get.suit(card, player)) && !player.hasUseTarget(card, false)) {
						return 10;
					}
					if (player.storage.nzry_chenglve && ui.selected.cards.length && !ui.selected.cards.some(i => get.suit(i) == get.suit(card, player))) {
						return 2;
					}
					return 6 - get.value(card);
				})
				.forResult();
			if (bool) {
				const effect = "nzry_chenglve_effect";
				player.addTempSkill(effect);
				player.markAuto(effect, cards.map(card => get.suit(card, player)).unique());
				player.storage[effect].sort((a, b) => lib.suits.indexOf(b) - lib.suits.indexOf(a));
				player.addTip(effect, get.translation(effect) + player.getStorage(effect).reduce((str, suit) => str + get.translation(suit), ""));
			}
		},
		ai: {
			order(item, player) {
				if (player.countCards("h", card => get.tag(card, "damage") && get.type(card) != "delay" && player.hasValueTarget(card, true, false)) > 2) {
					return get.order({ name: "sha" }) + 0.14;
				}
				return 2.7;
			},
			result: {
				player(player) {
					if (!player.storage.nzry_chenglve && player.countCards("h") < 3) {
						return 0;
					}
					return 1;
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				mod: {
					cardUsable(card, player) {
						const suit = get.suit(card);
						if (suit == "unsure" || player.getStorage("nzry_chenglve_effect").includes(suit)) {
							return Infinity;
						}
					},
					targetInRange(card, player) {
						const suit = get.suit(card);
						if (suit == "unsure" || player.getStorage("nzry_chenglve_effect").includes(suit)) {
							return true;
						}
					},
				},
				marktext: "略",
				intro: { content: `本回合使用$花色的牌无距离和次数限制` },
			},
		},
	},
};
