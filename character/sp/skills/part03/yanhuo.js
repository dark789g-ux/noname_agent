import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yanhuo" | "mouzhu" | "niluan" | "cuorui" | "liewei" | "weicheng" | "daoshu" | "zhenwei_three" | "huanshi_three">} */
export const groupSkills = {
	//新1v1
	yanhuo: {
		audio: 2,
		trigger: { player: "die" },
		forceDie: true,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		direct: true,
		skillAnimation: true,
		animationColor: "thunder",
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("yanhuo"), function (card, player, target) {
					return target != player && target.countDiscardableCards(player, "he") > 0;
				})
				.set("forceDie", true).ai = function (target) {
				return -target.countCards("he") * get.attitude(player, target);
			};
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("yanhuo", target);
				event.count = player.countCards("he");
			} else {
				event.finish();
			}
			"step 2";
			if (target.countDiscardableCards(player, "he")) {
				player.line(target);
				player.discardPlayerCard(target, "he", true).set("forceDie", true);
				event.count--;
				if (event.count) {
					event.redo();
				}
			}
		},
	},
	mouzhu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const target = event.target;
			if (!player.isIn() || !target.countGainableCards(player, "h")) {
				return;
			}
			await target.chooseToGive(player, "h", true);
			if (!player.isIn() || player.countCards("h") <= target.countCards("h")) {
				return;
			}
			let list = ["sha", "juedou"].filter(name => target.canUse(get.autoViewAs({ name }, []), player, false)),
				result;
			if (!list.length) {
				return;
			} else if (list.length == 1) {
				result = { control: list[0] };
			} else {
				result = await target
					.chooseControl(list)
					.set("prompt", "对" + get.translation(player) + "使用一张【杀】或【决斗】。")
					.set("ai", function (event, player) {
						const target = event.player;
						return get.effect(player, { name: "sha" }, target, target) >= get.effect(player, { name: "juedou" }, target, target) ? "sha" : "juedou";
					})
					.forResult();
			}
			if (result?.control) {
				await target.useCard({ name: result.control, isCard: true }, player, "noai");
			}
		},
		ai: {
			order: 7,
			result: {
				target: -1.2,
				player(player, target) {
					if (target.countCards("h") - player.countCards("h") > 1) {
						return 1;
					}
					if (get.damageEffect(target, player, player, player) > 0) {
						return 1;
					}
					if (player.hp > 3 || (player.countCards("h", "sha") && player.countCards("h", "shan"))) {
						return 0;
					}
					if (player.hp > 2) {
						return -1.1;
					}
					return -2;
				},
			},
		},
	},
	niluan: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player != player && (event.player.hp > player.hp || event.player.getHistory("useCard", card => card.card.name == "sha").length > 0);
		},
		direct: true,
		clearTime: true,
		content() {
			var next = player.chooseToUse();
			next.logSkill = "niluan";
			next.set("openskilldialog", get.prompt2("niluan"));
			next.set("norestore", true);
			next.set("_backupevent", `${event.name}_backup`);
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup(`${event.name}_backup`);
		},
		subSkill: {
			backup: {
				viewAs: { name: "sha" },
				filterCard: { color: "black" },
				position: "hes",
				selectCard: 1,
				check(card) {
					return 5 - get.value(card);
				},
			},
		},
	},
	cuorui: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return player.maxHp > 0 && !get.is.single() && (event.name != "phase" || game.phaseNumber == 0);
		},
		content() {
			player.draw(Math.min(5, player.maxHp), false);
		},
		group: "cuorui_nojudge",
		subSkill: {
			nojudge: {
				trigger: {
					player: "phaseJudgeBefore",
				},
				forced: true,
				audio: "cuorui",
				filter(event, player) {
					return !player.storage.cuorui && (get.is.single() || player.countCards("j"));
				},
				content() {
					player.storage.cuorui = true;
					trigger.cancel();
					game.log(player, "跳过了", "#g判定阶段");
				},
			},
		},
	},
	liewei: {
		audio: 2,
		trigger: { source: "dieAfter" },
		frequent: true,
		content() {
			player.draw(3);
		},
	},
	//蒋干
	weicheng: {
		audio: 2,
		trigger: {
			global: "gainAfter",
			player: "loseAsyncAfter",
		},
		//forced:true,
		frequent: true,
		filter(event, player) {
			if (player.getHp() <= player.countCards("h")) {
				return false;
			}
			if (event.name == "loseAsync") {
				if (event.type != "gain") {
					return false;
				}
				var cards = event.getl(player).hs;
				return game.hasPlayer(function (current) {
					if (current == player) {
						return false;
					}
					var cardsx = event.getg(current);
					for (var i of cardsx) {
						if (cards.includes(i)) {
							return true;
						}
					}
					return false;
				});
			}
			if (event.player == player) {
				return false;
			}
			var evt = event.getl(player);
			return evt && evt.hs && evt.hs.length > 0;
		},
		preHidden: true,
		content() {
			player.draw();
		},
	},
	daoshu: {
		audio: 2,
		enable: "phaseUse",
		filterTarget(c, p, t) {
			return t != p && t.countGainableCards(p, "h") > 0;
		},
		filter(e, p) {
			return !p.hasSkill("daoshu_used");
		},
		content() {
			"step 0";
			player
				.chooseControl(lib.suit)
				.set("prompt", "请选择一个花色")
				.set("ai", () => get.event().chosen)
				.set(
					"chosen",
					(function () {
						let suits = {},
							msuit,
							mcount = 0;
						target.getKnownCards(player).forEach(i => {
							let suit = get.suit(i);
							if (suits[suit]) {
								suits[suit]++;
							} else {
								suits[suit] = 1;
							}
						});
						for (let i in suits) {
							if (suits[i] > mcount && lib.suit.includes(i)) {
								msuit = i;
								mcount = suits[i];
							}
						}
						if (msuit) {
							return msuit;
						}
						return lib.suit.randomGet();
					})()
				);
			"step 1";
			event.suit = result.control;
			player.popup(event.suit + 2);
			game.log(player, "选择了", event.suit + 2);
			player.gainPlayerCard(target, true, "h", "visibleMove");
			"step 2";
			if (result.bool) {
				var suit2 = get.suit(result.cards[0]);
				if (suit2 == event.suit) {
					target.damage();
					event.finish();
				} else {
					player.addTempSkill("daoshu_used", "phaseUseEnd");
					if (
						player.countCards("h", function (card) {
							return get.suit(card) != suit2;
						}) == 0
					) {
						player.showHandcards();
						event.finish();
					} else {
						player
							.chooseCard(
								"h",
								true,
								function (card) {
									return get.suit(card) != _status.event.suit2;
								},
								"交给" + get.translation(target) + "一张不为" + get.translation(suit2) + "花色的牌"
							)
							.set("suit2", suit2);
					}
				}
			} else {
				event.finish();
			}
			"step 3";
			player.give(result.cards, target, true);
		},
		ai: {
			order: 1,
			result: {
				target: -1,
			},
		},
		subSkill: {
			used: { charlotte: true },
		},
	},
	//统率三军诸葛瑾和文聘
	zhenwei_three: {
		locked: true,
		global: "zhenwei_three_others",
		subSkill: {
			others: {
				mod: {
					globalTo(from, to, distance) {
						if (
							from.side != to.side &&
							game.hasPlayer(function (current) {
								return current != to && current.side == to.side && current.hasSkill("zhenwei_three");
							})
						) {
							return distance + 1;
						}
					},
				},
				sub: true,
			},
		},
	},
	huanshi_three: {
		audio: "huanshi",
		trigger: { global: "judge" },
		filter(event, player) {
			return player.countCards("hes") > 0 && player.side == event.player.side;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(`${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`, "hes", card => {
					const player = get.player();
					const mod2 = game.checkMod(card, player, "unchanged", "cardEnabled2", player);
					if (mod2 != "unchanged") {
						return mod2;
					}
					const mod = game.checkMod(card, player, "unchanged", "cardRespondable", player);
					if (mod != "unchanged") {
						return mod;
					}
					return true;
				})
				.set("ai", card => {
					const trigger = get.event().getTrigger();
					const { player, judging } = get.event();
					const result = trigger.judge(card) - trigger.judge(judging);
					const attitude = get.attitude(player, trigger.player);
					if (attitude == 0 || result == 0) {
						return 0;
					}
					if (attitude > 0) {
						return result - get.value(card) / 2;
					} else {
						return -result - get.value(card) / 2;
					}
				})
				.set("judging", trigger.player.judging[0])
				.forResult();
		},
		popup: false,
		async content(event, trigger, player) {
			const next = player.respond(event.cards, event.name, "highlight", "noOrdering");
			await next;
			const { cards } = next;
			if (cards?.length) {
				if (trigger.player.judging[0].clone) {
					trigger.player.judging[0].clone.classList.remove("thrownhighlight");
					game.broadcast(function (card) {
						if (card.clone) {
							card.clone.classList.remove("thrownhighlight");
						}
					}, trigger.player.judging[0]);
					game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
				}
				await game.cardsDiscard(trigger.player.judging[0]);
				trigger.player.judging[0] = cards[0];
				trigger.orderingCards.addArray(cards);
				game.log(trigger.player, "的判定牌改为", cards);
				await game.delay(2);
			}
		},
		ai: {
			rejudge: true,
			tag: { rejudge: 1 },
		},
	},
};
