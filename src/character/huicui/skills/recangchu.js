import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "recangchu" | "recangchu2" | "recangchu3" | "reliangying" | "reshishou" | "reshishou2" | "cxliushi" | "cxliushi2" | "zhanwan" | "xuxie">} */
export const groupSkills = {
	//乌巢酒仙
	recangchu: {
		audio: 2,
		trigger: { global: "phaseBefore", player: "enterGame" },
		marktext: "粮",
		forced: true,
		filter(event, player) {
			if (event.name == "phase" && game.phaseNumber != 0) {
				return false;
			}
			return player.countMark("recangchu") < game.countPlayer();
		},
		async content(event, trigger, player) {
			player.addMark("recangchu", Math.min(3, game.countPlayer() - player.countMark("recangchu")));
		},
		ai: {
			notemp: true,
		},
		intro: { content: "mark", name: "粮" },
		mod: {
			maxHandcard(player, num) {
				return num + player.countMark("recangchu");
			},
		},
		group: ["recangchu2", "recangchu3"],
	},
	recangchu2: {
		audio: "recangchu",
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		forced: true,
		usable: 1,
		sourceSkill: "recangchu",
		filter(event, player) {
			return player != _status.currentPhase && player.countMark("recangchu") < game.countPlayer() && event.getg(player).length > 0;
		},
		async content(event, trigger, player) {
			player.addMark("recangchu", 1);
		},
	},
	recangchu3: {
		audio: "recangchu",
		trigger: { global: "die" },
		forced: true,
		sourceSkill: "recangchu",
		filter(event, player) {
			return player.countMark("recangchu") > game.countPlayer();
		},
		async content(event, trigger, player) {
			player.removeMark("recangchu", player.countMark("recangchu") - game.countPlayer());
		},
	},
	reliangying: {
		audio: 2,
		trigger: { player: "phaseDiscardBegin" },
		filter(event, player) {
			return player.hasMark("recangchu");
		},
		direct: true,
		async content(event, trigger, player) {
			const draws = Array.from({ length: player.countMark("recangchu") }).map((_, i) => get.cnNumber(i + 1) + "张");
			const { control } = await player
				.chooseControl(draws, "cancel2")
				.set("prompt", get.prompt("reliangying"))
				.set("prompt2", "摸至多" + get.cnNumber(player.countMark("recangchu")) + "张牌，然后交给等量的角色各一张牌")
				.set("ai", () => {
					const player = get.event().player;
					const num = Math.min(
						player.countMark("recangchu"),
						game.countPlayer(current => get.attitude(player, current) > 0)
					);
					if (num > 0) {
						return get.cnNumber(num) + "张";
					}
					return "cancel2";
				})
				.forResult();
			if (control != "cancel2") {
				player.logSkill("reliangying");
				const num = draws.indexOf(control) + 1,
					max = Math.min(num, player.countCards("he"), game.countPlayer());
				await player.draw(num);
				let list = [];
				if (_status.connectMode) {
					game.broadcastAll(() => (_status.noclearcountdown = true));
				}
				while (max - list.length > 0) {
					const { bool, cards, targets } = await player
						.chooseCardTarget({
							prompt: "粮营：将" + get.cnNumber(max - 1) + "至" + get.cnNumber(max) + "张牌交给其他角色",
							position: "he",
							animate: false,
							filterCard(card, player) {
								return !get.event().list.some(list => list[1] == card);
							},
							filterTarget(card, player, target) {
								return target != player && !get.event().list.some(list => list[0] == target);
							},
							ai1(card) {
								if (card.name == "shan") {
									return 1;
								}
								return Math.random();
							},
							ai2(target) {
								return get.attitude(get.event().player, target);
							},
						})
						.set("list", list)
						.set("forced", max - list.length > 1)
						.forResult();
					if (bool) {
						list.push([targets[0], cards[0]]);
						player.addGaintag(cards, "olsujian_given");
					} else {
						break;
					}
				}
				if (_status.connectMode) {
					game.broadcastAll(() => {
						delete _status.noclearcountdown;
						game.stopCountChoose();
					});
				}
				if (list.length) {
					await game
						.loseAsync({
							gain_list: list,
							player: player,
							cards: list.slice().flatMap(list => list[1]),
							giver: player,
							animate: "giveAuto",
						})
						.setContent("gaincardMultiple");
				}
			}
		},
		ai: {
			combo: "recangchu",
		},
	},
	reshishou: {
		audio: 2,
		trigger: { player: ["useCard", "damageEnd"] },
		forced: true,
		filter(event, player) {
			if (!player.countMark("recangchu")) {
				return false;
			}
			return event.name == "damage" ? event.hasNature("fire") : event.card && event.card.name == "jiu";
		},
		async content(event, trigger, player) {
			player.removeMark("recangchu", Math.min(player.countMark("recangchu"), trigger.num || 1));
		},
		ai: {
			combo: "recangchu",
			neg: true,
		},
		group: "reshishou2",
	},
	reshishou2: {
		audio: "reshishou",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		sourceSkill: "reshishou",
		filter(event, player) {
			return !player.countMark("recangchu");
		},
		async content(event, trigger, player) {
			player.loseHp();
		},
	},
	//曹性
	cxliushi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("he", { suit: "heart" }) > 0;
		},
		filterCard: { suit: "heart" },
		position: "he",
		filterTarget(card, player, target) {
			return player.canUse("sha", target, false);
		},
		check(card) {
			var player = _status.event.player;
			var next = player.getNext();
			var att = get.attitude(player, next);
			if (att > 0) {
				var js = next.getCards("j");
				if (js.length) {
					return get.judge(js[0]) + 10 - get.value(card);
				}
				return 9 - get.value(card);
			}
			return 6 - get.value(card);
		},
		discard: false,
		prepare: "throw",
		loseTo: "cardPile",
		visible: true,
		insert: true,
		async content(event, trigger, player) {
			const { cards, targets } = event;
			game.log(player, "将", cards, "置于牌堆顶");
			await player.useCard({ name: "sha", isCard: true, storage: { cxliushi: true } }, false, targets);
		},
		group: "cxliushi_damage",
		subSkill: {
			damage: {
				trigger: { source: "damageSource" },
				forced: true,
				popup: false,
				filter(event, player) {
					return event.card?.storage?.cxliushi == true && event.player.isIn() && event.getParent(3).name == "cxliushi";
				},
				async content(event, trigger, player) {
					trigger.player.addMark("cxliushi2", 1);
					trigger.player.addSkill("cxliushi2");
				},
			},
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) - 0.4;
			},
			result: {
				target(player, target) {
					var eff = get.effect(target, { name: "sha" }, player, target);
					var damageEff = get.damageEffect(target, player, player);
					if (eff > 0) {
						return damageEff > 0 ? 0 : eff;
					}
					if (target.hasSkill("bagua_skill") || target.hasSkill("rw_bagua_skill") || target.hasSkill("bazhen")) {
						return 0;
					}
					return eff;
				},
			},
		},
	},
	cxliushi2: {
		mod: {
			maxHandcard(player, num) {
				return num - player.countMark("cxliushi2");
			},
		},
		onremove: true,
		charlotte: true,
		intro: {
			name2: "流",
			content: "手牌上限-#",
		},
	},
	zhanwan: {
		audio: 2,
		trigger: { global: "phaseDiscardEnd" },
		forced: true,
		filter(event, player) {
			return (
				event.player.hasSkill("cxliushi2") &&
				event.player.getHistory("lose", function (evt) {
					if (evt.type == "discard" && evt.getParent("phaseDiscard") == event) {
						return true;
					}
				}).length > 0
			);
		},
		logTarget: "player",
		async content(event, trigger, player) {
			trigger.player.removeSkill("cxliushi2");
			let num = 0;
			trigger.player.getHistory("lose", function (evt) {
				if (evt.type == "discard" && evt.getParent("phaseDiscard") == trigger) {
					num += evt.cards2.length;
				}
			});
			await player.draw(num);
		},
		ai: {
			combo: "cxliushi",
		},
	},
	//说出吾名吓汝一跳
	xuxie: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		logTarget(event, player) {
			return game
				.filterPlayer(function (current) {
					return get.distance(player, current) <= 1;
				})
				.sortBySeat();
		},
		check(event, player) {
			if (player.isHealthy()) {
				return false;
			}
			var list = game.filterPlayer(function (current) {
				return get.distance(player, current) <= 1;
			});
			var draw = 0;
			var discard = 0;
			var num = 2 / player.getDamagedHp();
			while (list.length) {
				var target = list.shift();
				var att = get.attitude(player, target);
				if (att > 0) {
					draw++;
					if (target.countDiscardableCards(player, "he") > 0) {
						discard--;
					}
				}
				if (att == 0) {
					draw--;
					if (target.countDiscardableCards(player, "he") > 0) {
						discard--;
					}
				}
				if (att < 0) {
					draw--;
					if (target.countDiscardableCards(player, "he") > 0) {
						discard++;
					}
				}
			}
			return draw >= num || discard >= num;
		},
		async content(event, trigger, player) {
			await player.loseMaxHp();
			const targets = game
				.filterPlayer(function (current) {
					return get.distance(player, current) <= 1;
				})
				.sortBySeat();
			if (!targets.length) {
				return;
			}

			event.targets = targets;
			const result = await player
				.chooseControl()
				.set("choiceList", ["弃置" + get.translation(targets) + "的各一张牌", "令" + get.translation(targets) + "各摸一张牌"])
				.set("ai", function () {
					let player = _status.event.player;
					let list = _status.event.getParent().targets.slice(0);
					let draw = 0;
					let discard = 0;
					while (list.length) {
						let target = list.shift();
						let att = get.attitude(player, target);
						if (att > 0) {
							draw++;
							if (target.countDiscardableCards(player, "he") > 0) {
								discard--;
							}
						}
						if (att < 0) {
							draw--;
							if (target.countDiscardableCards(player, "he") > 0) {
								discard++;
							}
						}
					}
					if (draw > discard) {
						return 1;
					}
					return 0;
				})
				.forResult();

			if (result.index == 1) {
				await game.asyncDraw(targets);
				await game.delay();
				return;
			}

			while (targets.length) {
				const target = targets.shift();
				if (target.countDiscardableCards(player, "he") > 0) {
					await player.discardPlayerCard(target, "he", true);
				}
			}
		},
		group: "xuxie_add",
		subSkill: {
			add: {
				audio: "xuxie",
				trigger: { player: "phaseUseEnd" },
				forced: true,
				locked: false,
				filter(event, player) {
					return game.hasPlayer(function (current) {
						return current.maxHp > player.maxHp;
					});
				},
				async content(event, trigger, player) {
					player.gainMaxHp();
					player.chooseDrawRecover(2, true);
				},
			},
		},
	},
};
