import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "youyan" | "zhuihuan" | "zhuihuan2_new" | "zhuihuan2">} */
export const groupSkills = {
	//杨婉
	youyan: {
		getCards(event, player) {
			const cards2 = [];
			if (event.name == "cardsDiscard") {
				const evtx = event.getParent();
				if (evtx.name != "orderingDiscard") {
					return false;
				}
				const evtx2 = evtx.relatedEvent || evtx.getParent();
				if (["useCard", "respond"].includes(evtx2.name)) {
					return false;
				}
				player.getHistory("lose", evtx3 => {
					const evtx4 = evtx3.relatedEvent || evtx3.getParent();
					if (evtx2 != evtx4) {
						return false;
					}
					if (!evtx3.cards2 || !evtx3.cards2.length) {
						return false;
					}
					cards2.addArray(evtx3.cards2.filterInD("d"));
				});
			} else if (event.name == "loseAsync") {
				player.hasHistory("lose", evt => {
					if (evt.getParent() != event || evt.position != ui.discardPile) {
						return false;
					}
					cards2.addArray(evt.cards2.filterInD("d"));
				});
			} else {
				cards2.addArray(event.getd(player).filterInD("d"));
			}
			return cards2;
		},
		audio: 2,
		trigger: {
			player: ["loseAfter", "equipAfter"],
			global: ["loseAsyncAfter", "cardsDiscardAfter"],
		},
		filter(event, player) {
			if (player != _status.currentPhase) {
				return false;
			}
			const cards2 = get.info("youyan").getCards(event, player);
			if (!cards2.length) {
				return false;
			}
			const list = [];
			for (const i of cards2) {
				list.add(get.suit(i, player));
				if (list.length >= lib.suit.length) {
					return false;
				}
			}
			const evt = event.getParent("phaseUse");
			if (evt?.player == player && !player.getStorage("youyan_used").includes(evt)) {
				return true;
			}
			const evtx = event.getParent("phaseDiscard");
			if (evtx?.player == player && !player.getStorage("youyan_used").includes(evtx)) {
				return true;
			}
			return false;
		},
		prompt2(event, player) {
			const cards2 = get.info("youyan").getCards(event, player);
			return `获得与${get.translation(cards2)}花色${cards2.length > 1 ? "各" : ""}不相同的牌各一张`;
		},
		async content(event, trigger, player) {
			let evt = trigger.getParent("phaseUse");
			if (evt?.player == player) {
				player.addTempSkill(event.name + "_used", "phaseUseAfter");
				player.markAuto(event.name + "_used", [evt]);
			} else {
				let evtx = trigger.getParent("phaseDiscard");
				if (evtx?.player == player) {
					player.addTempSkill(event.name + "_used", "phaseDiscardAfter");
					player.markAuto(event.name + "_used", [evtx]);
				}
			}
			const list = [],
				cards = [];
			const cards2 = get.info(event.name).getCards(trigger, player);
			for (const i of cards2) {
				list.add(get.suit(i, player));
			}
			for (const i of lib.suit) {
				if (list.includes(i)) {
					continue;
				}
				const card = get.cardPile2(function (card) {
					return get.suit(card, false) == i;
				});
				if (card) {
					cards.push(card);
				}
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					if (
						typeof card == "object" &&
						player == _status.currentPhase &&
						//(!player.storage.counttrigger||!player.storage.counttrigger.youyan)&&
						player.needsToDiscard() == 1 &&
						card.cards &&
						card.cards.filter(function (i) {
							return get.position(i) == "h";
						}).length > 0 &&
						!get.tag(card, "draw") &&
						!get.tag(card, "gain") &&
						!get.tag(card, "discard")
					) {
						return "zeroplayertarget";
					}
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	zhuihuan: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "令一名角色获得“追还”效果")
				.set("ai", target => {
					let player = get.player(),
						att = get.attitude(player, target);
					if (target.hasSkill("maixie") || target.hasSkill("maixie_defend")) {
						att /= 3;
					}
					if (target != player) {
						att /= Math.pow(game.players.length - get.distance(player, target, "absolute"), 0.7);
					}
					if (!target.hasSkill("zhuihuan_effect")) {
						att *= 1.5;
					}
					return att;
				})
				.set("animate", false)
				.forResult();
		},
		logLine: false,
		async content(event, trigger, player) {
			const [target] = event.targets;
			target.addTempSkill(event.name + "_effect", { player: "phaseZhunbei" });
			await game.delayx();
		},
		subSkill: {
			effect: {
				trigger: { player: "phaseZhunbeiBegin" },
				charlotte: true,
				forced: true,
				onremove: true,
				getIndex(event, player) {
					return player.getStorage("zhuihuan_effect").sortBySeat();
				},
				filter(event, player, name, target) {
					return target?.isIn();
				},
				logTarget(event, player, triggername, target) {
					return target;
				},
				async content(event, trigger, player) {
					const [target] = event.targets;
					if (target.hp > player.hp) {
						await target.damage(2);
					} else if (target.countCards("h")) {
						await target.randomDiscard(2, "h");
					}
				},
				group: "zhuihuan_record",
			},
			record: {
				trigger: { player: "damageEnd" },
				forced: true,
				silent: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					return get.itemtype(event.source) == "player";
				},
				async content(event, trigger, player) {
					player.markAuto("zhuihuan_effect", [trigger.source]);
				},
			},
		},
	},
	zhuihuan2_new: {
		trigger: { player: "phaseZhunbeiBegin" },
		charlotte: true,
		forced: true,
		onremove: true,
		sourceSkill: "zhuihuan",
		filter(event, player) {
			if (player.storage.zhuihuan2_new) {
				for (var source of player.storage.zhuihuan2_new) {
					if (!source.isIn()) {
						continue;
					}
					if (source.hp > player.hp) {
						return true;
					}
					return source.countCards("h") > 0;
				}
			}
		},
		logTarget(event, player) {
			return player.storage.zhuihuan2_new.filter(function (target) {
				return target.isIn();
			});
		},
		content() {
			"step 0";
			event.targets = player.storage.zhuihuan2_new;
			player.removeSkill("zhuihuan2_new");
			"step 1";
			var target = targets.shift();
			if (target.isIn()) {
				if (target.hp > player.hp) {
					target.damage(2);
				} else {
					var hs = target.getCards("h");
					if (hs.length) {
						target.discard(hs.randomGets(2));
					}
				}
			}
			if (targets.length) {
				event.redo();
			}
		},
		group: "zhuihuan2_new_count",
		subSkill: {
			count: {
				trigger: { player: "damage" },
				forced: true,
				silent: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					return get.itemtype(event.source) == "player";
				},
				content() {
					player.markAuto("zhuihuan2_new", [trigger.source]);
				},
			},
		},
	},
	zhuihuan2: {
		trigger: { player: "damageEnd" },
		forced: true,
		charlotte: true,
		logTarget: "source",
		sourceSkill: "zhuihuan",
		filter(event, player) {
			var source = event.source;
			if (source.hp > player.hp) {
				return true;
			}
			return source.countCards("h") > 0;
		},
		content() {
			if (player.hp < trigger.source.hp) {
				trigger.source.damage();
			} else {
				trigger.source.discard(trigger.source.getCards("h").randomGet());
			}
		},
		mark: true,
		intro: {
			content: "当你受到伤害后，若伤害来源体力值大于你，则你对其造成1点伤害，否则其随机弃置一张手牌",
		},
	},
};
