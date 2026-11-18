import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dccaizhuang" | "dchuayi" | "dchuizhi" | "dcjijiao" | "dcjianzheng">} */
export const groupSkills = {
	//段巧笑
	dccaizhuang: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hasCard(function (card) {
				return lib.filter.cardDiscardable(card, player, "dccaizhuang");
			}, "he");
		},
		complexCard: true,
		selectCard: [1, Infinity],
		position: "he",
		filterCard: lib.filter.cardDiscardable,
		check(card) {
			let cache = lib.skill.dccaizhuang.tempCache();
			if (!cache || cache.no) {
				return 0;
			}
			let player = _status.event.player,
				suit = get.suit(card);
			if (
				ui.selected.cards.filter(i => {
					return get.suit(i) === suit;
				}).length < (cache[suit] || 0)
			) {
				if (get.position(card) === "h") {
					return 15 - get.value(card);
				}
				return 9 - get.value(card);
			}
			return 0;
		},
		tempCache() {
			let cache = _status.event.getTempCache("dccaizhuang", "dsuits");
			if (cache) {
				return cache;
			}
			cache = { no: true };
			_status.event.putTempCache("dccaizhuang", "dsuits", cache);
			let player = _status.event.player,
				suits = {};
			lib.suit.forEach(i => {
				suits[i] = 0;
			});
			player.getCards("h", i => {
				let suit = get.suit(i);
				if (lib.suit.includes(suit)) {
					suits[suit]++;
				}
			});
			let sortedSuits = Object.fromEntries(Object.entries(suits).sort((a, b) => b[1] - a[1]));
			let dis = 0,
				idx = 0,
				dsuits = 0,
				leave = 0;
			for (let i in sortedSuits) {
				idx++;
				if (!sortedSuits[i]) {
					continue;
				}
				let num = 1;
				if (idx > 2 || sortedSuits[i] < 3) {
					num = sortedSuits[i];
				}
				cache[i] = num;
				dis += num;
				suits[i] -= num;
				dsuits++;
			}
			for (let i in suits) {
				if (suits[i]) {
					leave++;
				}
			}
			player.getCards("e", i => {
				let suit = get.suit(i);
				if (!cache[suit]) {
					dsuits++;
					cache[suit] = 1;
					dis++;
				}
			});
			let draw = 0,
				e = [0, 1, 4 / 3, 2, 4];
			if (dsuits <= leave) {
				return false;
			}
			do {
				draw += e[dsuits--];
			} while (dsuits > leave);
			if (draw > dis) {
				delete cache.no;
				_status.event.putTempCache("dccaizhuang", "dsuits", cache);
				return cache;
			}
			return false;
		},
		async content(event, trigger, player) {
			const num = event.cards.map(card => get.suit(card, player)).toUniqued().length;
			while (true) {
				await player.draw();
				if (
					player
						.getCards("h")
						.map(card => get.suit(card, player))
						.toUniqued().length >= num
				) {
					break;
				}
			}
		},
		ai: {
			order: 2,
			result: { player: 1 },
		},
	},
	dchuayi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		async content(event, trigger, player) {
			const next = player.judge(() => 1);
			next.judge2 = result => result.bool;
			const result = await next.forResult();
			if (result?.color && ["red", "black"].includes(result.color)) {
				player.addTempSkill(event.name + "_" + result.color, { player: "phaseBegin" });
			}
		},
		subSkill: {
			red: {
				audio: "dchuayi",
				trigger: { global: "phaseEnd" },
				charlotte: true,
				forced: true,
				content() {
					player.draw();
				},
				mark: true,
				intro: {
					name: "华衣·红",
					content: "一名角色的回合结束时，你摸一张牌",
				},
			},
			black: {
				audio: "dchuayi",
				trigger: { player: "damageEnd" },
				charlotte: true,
				forced: true,
				content() {
					player.draw(2);
				},
				mark: true,
				intro: {
					name: "华衣·黑",
					content: "当你受到伤害后，摸两张牌",
				},
				ai: {
					maixie: true,
					maixie_hp: true,
					effect: {
						target(card, player, target) {
							if (get.tag(card, "damage")) {
								if (player.hasSkillTag("jueqing", false, target)) {
									return [1, -2];
								}
								if (!target.hasFriend()) {
									return;
								}
								var num = 1;
								if (get.attitude(player, target) > 0) {
									if (player.needsToDiscard()) {
										num = 0.5;
									} else {
										num = 0.3;
									}
								}
								if (target.hp >= 4) {
									return [1, num * 2];
								}
								if (target.hp == 3) {
									return [1, num * 1.5];
								}
								if (target.hp == 2) {
									return [1, num * 0.5];
								}
							}
						},
					},
				},
			},
		},
	},
	//张瑾云
	dchuizhi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		content() {
			"step 0";
			player
				.chooseToDiscard(get.prompt("dchuizhi"), "你可以选择弃置任意张手牌并点击“确定”，将手牌摸至与全场手牌数最多的角色数相同。", [0, Infinity])
				.set("allowChooseAll", true)
				.set("logSkill", "dchuizhi")
				.set("ai", card => {
					if (_status.event.isMax) {
						if (ui.selected.cards.length) {
							return -get.value(card);
						}
						return 0;
					}
					return 6 - get.value(card);
				})
				.set("isMax", player.isMaxHandcard());
			"step 1";
			if (result.bool) {
				var num = 0,
					targets = game.filterPlayer();
				for (var current of targets) {
					if (current.isMaxHandcard()) {
						num = current.countCards("h");
						break;
					}
				}
				num = Math.max(1, Math.min(5, num - player.countCards("h")));
				player.draw(num);
			}
		},
	},
	dcjijiao: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		init(player) {
			player.addSkill("dcjijiao_machi");
		},
		onremove(player) {
			player.removeSkill("dcjijiao_machi");
		},
		onChooseToUse(event) {
			if (event.dcjijiao == undefined && !game.online) {
				var bool = lib.skill.dcjijiao.getCards(event.player, true);
				event.set("dcjijiao", bool);
			}
		},
		filter(event, player) {
			return event.dcjijiao;
		},
		filterTarget: true,
		getCards(player, bool) {
			const cards = Array.from(ui.discardPile.childNodes);
			const gains = game
				.getAllGlobalHistory("everything", evt => {
					if (evt.name == "lose" || evt.name == "loseAsync") {
						if (!evt.getl) {
							return false;
						}
						if (evt.type != "discard" || evt.getlx === false) {
							return false;
						}
						return evt.getl(player)?.cards2?.length > 0;
					}
					return evt.name == "useCard" && evt.player == player && evt.cards?.length > 0;
				})
				.reduce((list, evt) => {
					if (evt.name == "useCard") {
						return list.addArray(evt.cards);
					}
					return list.addArray(evt.getl(player)?.cards2);
				}, [])
				.filter(i => cards.includes(i));
			if (bool) {
				return gains.some(card => get.type(card) == "trick");
			}
			return gains.filter(card => get.type(card) == "trick");
		},
		content() {
			player.awakenSkill(event.name);
			var cards = lib.skill.dcjijiao.getCards(player);
			if (cards.length) {
				target.gain(cards, "gain2").gaintag.add("dcjijiao");
				target.addSkill("dcjijiao_nowuxie");
			}
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					if (ui.cardPile.childNodes.length > game.players.length * 5 && !player.hasSkill("dcjijiao_risutoa") && !game.hasPlayer(current => current.hp <= 1) && game.countPlayer(current => current.hp === 2 && current.countCards("hes") < 3) <= 1) {
						return 0;
					}
					return 5;
				},
			},
		},
		subSkill: {
			machi: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: {
					global: ["washCard", "die"],
				},
				filter(event, player) {
					return player.hasSkill("dcjijiao", null, false, false);
				},
				content() {
					player.addSkill("dcjijiao_risutoa");
				},
			},
			risutoa: {
				charlotte: true,
				forced: true,
				popup: false,
				trigger: { global: "phaseAfter" },
				content() {
					if (player.awakenedSkills.includes("dcjijiao")) {
						player.restoreSkill("dcjijiao");
						game.log(player, "重置了", "#g【继椒】");
						//player.removeSkill('dcjijiao_machi');
					}
					player.removeSkill("dcjijiao_risutoa");
				},
			},
			nowuxie: {
				trigger: { player: "useCard1" },
				forced: true,
				charlotte: true,
				firstDo: true,
				popup: false,
				filter(event, player) {
					if (get.type(event.card) != "trick") {
						return false;
					}
					return player.hasHistory("lose", function (evt) {
						if ((evt.relatedEvent || evt.getParent()) != event) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dcjijiao")) {
								return true;
							}
						}
						return false;
					});
				},
				content() {
					trigger.nowuxie = true;
				},
				onremove(player) {
					player.removeGaintag("dcjijiao");
				},
			},
		},
	},
	//桓范
	dcjianzheng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target.countCards("h") && target != player;
		},
		content() {
			"step 0";
			var forced = target.hasCard(i => player.hasUseTarget(i), "h");
			player
				.choosePlayerCard(target, "h", "visible", forced, "获得并使用其中一张牌")
				.set("filterButton", button => {
					return _status.event.player.hasUseTarget(button.link);
				})
				.set("ai", button => {
					return _status.event.player.getUseValue(button.link);
				});
			"step 1";
			if (result.bool) {
				var card = result.links[0];
				event.card = card;
				player.gain(card, "giveAuto");
			} else {
				event.goto(3);
			}
			"step 2";
			if (get.position(card) == "h" && get.owner(card) == player && player.hasUseTarget(card)) {
				if (get.name(card, player) == "sha") {
					player.chooseUseTarget(card, true, false);
				} else {
					player.chooseUseTarget(card, true);
				}
			}
			"step 3";
			if (
				player.hasHistory("useCard", evt => {
					return evt.getParent(2).name == "dcjianzheng" && evt.targets.includes(target);
				})
			) {
				player.link(true);
				target.link(true);
			} else {
				event.finish();
			}
			"step 4";
			target.viewHandcards(player);
		},
		ai: {
			order: 10,
			expose: 0.2,
			result: {
				target(player, target) {
					return -Math.sqrt(target.countCards("h"));
				},
			},
		},
	},
};
