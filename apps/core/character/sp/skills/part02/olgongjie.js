import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olgongjie" | "olxiangxv" | "olxiangzuo" | "olfeiyang">} */
export const groupSkills = {
	//曹宇
	olgongjie: {
		audio: 2,
		trigger: { global: "phaseBegin" },
		filter(event, player) {
			if (!player.countCards("he")) {
				return false;
			}
			let history = player.actionHistory,
				isRound = false;
			history.forEach((evt, index) => {
				if (evt.isRound) {
					isRound = index;
				}
			});
			if (isRound === false) {
				return false;
			}
			for (let num = 0; num < history.length - 1; num++) {
				if (num < isRound || history[num].isSkipped) {
					continue;
				}
				return num == history.length - 1;
			}
			return true;
		},
		direct: true,
		async content(event, trigger, player) {
			var num = player.countCards("he"),
				draws = [];
			var { bool, targets } = await player
				.chooseTarget(get.prompt2("olgongjie"), [1, num], lib.filter.notMe)
				.set("ai", target => get.attitude(_status.event.player, target))
				.forResult();
			if (!bool) {
				return;
			}
			targets = targets.sortBySeat();
			player.logSkill("olgongjie", targets);
			for (var target of targets) {
				var { bool, cards } = await target.gainPlayerCard(player, true, "he").forResult();
				if (bool) {
					draws.add(get.suit(cards[0], player));
				}
			}
			player.draw(draws.length);
		},
	},
	olxiangxv: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			const target = _status.currentPhase;
			if (!target?.isIn() || !player.hasSkill("olxiangxv_in")) {
				return false;
			}
			const num = target.countCards("h") - player.countCards("h");
			if (num == 0 || (num > 0 && player.countCards("h") >= 5)) {
				return false;
			}
			return num > 0 || player.countDisabledSlot(player, "h");
		},
		check(event, player) {
			const target = _status.currentPhase,
				num = target.countCards("h") - player.countCards("h");
			return num > 0 || (num == -2 && player.isDamaged());
		},
		usable: 1,
		logTarget: () => _status.currentPhase,
		async content(event, trigger, player) {
			const target = _status.currentPhase,
				num = target.countCards("h") - player.countCards("h");
			if (num > 0) {
				if (player.countCards("h") < 5) {
					await player.draw(Math.min(5 - player.countCards("h"), num));
				}
			} else {
				const result = await player.chooseToDiscard(-num, "h", true, "allowChooseAll").forResult();
				if (result?.bool && result.cards?.length > 1) {
					if (player.isDamaged()) {
						await player.recover();
					}
				}
			}
		},
		group: "olxiangxv_mark",
		subSkill: {
			mark: {
				charlotte: true,
				trigger: {
					player: "loseAfter",
					global: ["gainAfter", "equipAfter", "addJudgeAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					if (!_status.currentPhase || !_status.currentPhase.isIn()) {
						return false;
					}
					if (!player.isMinHandcard()) {
						return false;
					}
					const evt = event.getl(player);
					return evt?.player == player && evt?.hs?.length > 0;
				},
				firstDo: true,
				forced: true,
				popup: false,
				content() {
					player.addTempSkill("olxiangxv_in");
				},
			},
			in: { charlotte: true },
		},
	},
	olxiangzuo: {
		audio: 2,
		trigger: { player: "dying" },
		filter(event, player) {
			return player.countCards("he") && game.hasPlayer(target => target != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt2(event.skill),
					filterCard: true,
					selectCard: [1, Infinity],
					filterTarget: lib.filter.notMe,
					position: "he",
					allowChooseAll: true,
					ai1(card) {
						const player = get.event().player;
						if (!ui.selected.targets.length) {
							return 0;
						}
						const target = ui.selected.targets[0];
						if (
							player.hasAllHistory("useSkill", evt => {
								return evt.skill == "olgongjie" && (evt.targets || [evt.target]).includes(target);
							}) &&
							player.hasAllHistory("useSkill", evt => {
								return evt.skill == "olxiangxv" && (evt.targets || [evt.target]).includes(target);
							})
						) {
							if (get.attitude(player, target) > 0) {
								return 1;
							}
							if (player.canSaveCard(card, player)) {
								return 0;
							}
							if (ui.selected.cards.length + player.hp >= player.maxHp) {
								return 0;
							}
							return 20 - get.value(card);
						}
						if (get.attitude(player, target) > 0 && !player.countCards("he", cardx => player.canSaveCard(cardx, player))) {
							return 1;
						}
						return 0;
					},
					ai2(target) {
						const player = get.event().player;
						const goon =
								player.hasAllHistory("useSkill", evt => {
									return evt.skill == "olgongjie" && (evt.targets || [evt.target]).includes(target);
								}) &&
								player.hasAllHistory("useSkill", evt => {
									return evt.skill == "olxiangxv" && (evt.targets || [evt.target]).includes(target);
								}),
							att = get.attitude(player, target);
						if (goon) {
							return 5 * att;
						}
						if (player.countCards("he", cardx => player.canSaveCard(cardx, player)) > 0) {
							return att;
						}
						return 0;
					},
				})
				.forResult();
		},
		limited: true,
		skillAnimation: true,
		animationColor: "water",
		async content(event, trigger, player) {
			const target = event.targets[0],
				cards = event.cards;
			player.awakenSkill(event.name);
			await player.give(cards, target);
			if (
				player.hasAllHistory("useSkill", evt => {
					return evt.skill == "olgongjie" && evt.targets.includes(target);
				}) &&
				player.hasAllHistory("useSkill", evt => {
					return evt.skill == "olxiangxv" && evt.targets.includes(target);
				})
			) {
				await player.recover(cards.length);
			}
		},
		ai: {
			combo: "olgongjie",
		},
	},
	//OL飞扬
	olfeiyang: {
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return (
				player.countCards("h", card => {
					return _status.connectMode || lib.filter.cardDiscardable(card, player);
				}) >= lib.skill.olfeiyang.getNum && player.countCards("j")
			);
		},
		direct: true,
		limited: true,
		getNum: 2,
		//skillAnimation:true,
		//animationColor:'orange',
		content() {
			"step 0";
			player
				.chooseToDiscard(get.prompt2("olfeiyang"), lib.skill.olfeiyang.getNum)
				.set("ai", function (card) {
					var player = _status.event.player;
					if (
						player.hasCard(function (card) {
							return (
								get.effect(
									player,
									{
										name: card.viewAs || card.name,
										cards: [card],
									},
									player,
									player
								) < 0
							);
						}, "j")
					) {
						return 6 - get.value(card);
					}
					return 0;
				})
				.set("logSkill", "olfeiyang");
			"step 1";
			if (result.bool) {
				player.awakenSkill(event.name);
				player.discardPlayerCard(player, "j", true);
			}
		},
	},
};
