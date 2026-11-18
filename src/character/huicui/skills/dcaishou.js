import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcaishou" | "dcsaowei" | "dckanji" | "dcqianzheng" | "dchaochong" | "dcjinjin">} */
export const groupSkills = {
	//桥蕤
	dcaishou: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.hasCard(card => card.hasGaintag("dcaishou_tag"), "h");
		},
		forced: true,
		locked: false,
		group: ["dcaishou_draw", "dcaishou_lose"],
		subfrequent: ["draw"],
		async content(event, trigger, player) {
			await player.discard(player.getCards("h", card => card.hasGaintag("dcaishou_tag")));

			let len = 0;
			for (const evt of player.getHistory("lose", evt => evt.getParent(2) === event)) {
				len += evt.cards.length;
			}
			if (len > Math.max(0, player.hp) && player.maxHp < 9) {
				await player.gainMaxHp();
			}
		},
		subSkill: {
			draw: {
				audio: "dcaishou",
				trigger: { player: "phaseJieshuBegin" },
				frequent(event, player) {
					return player.maxHp > 1;
				},
				prompt2(event, player) {
					return "摸" + get.cnNumber(player.maxHp) + "张牌，称为“隘”";
				},
				check(event, player) {
					return player.maxHp > 1;
				},
				async content(event, trigger, player) {
					const next = player.draw(player.maxHp);
					next.gaintag.add("dcaishou_tag");
					await next;
				},
			},
			lose: {
				audio: "dcaishou",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				forced: true,
				locked: false,
				filter(event, player) {
					if (player == _status.currentPhase) {
						return false;
					}
					var evt = event.getl(player);
					if (!evt || !evt.hs || !evt.hs.length || player.hasCard(card => card.hasGaintag("dcaishou_tag"), "h")) {
						return false;
					}
					if (event.name == "lose") {
						for (var i in event.gaintag_map) {
							if (event.gaintag_map[i].includes("dcaishou_tag")) {
								return true;
							}
						}
						return false;
					}
					return player.hasHistory("lose", function (evt) {
						if (event != evt.getParent()) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dcaishou_tag")) {
								return true;
							}
						}
						return false;
					});
				},
				async content(event, trigger, player) {
					player.loseMaxHp();
				},
			},
		},
	},
	dcsaowei: {
		audio: 2,
		trigger: { global: "useCardAfter" },
		filter(event, player) {
			return event.player != player && event.card.name == "sha" && event.targets.length && !event.targets.includes(player) && event.targets.every(current => player.inRange(current) && current.isIn()) && player.hasCard(card => card.hasGaintag("dcaishou_tag"), "h");
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			player.addTempSkill("dcsaowei_gain");
			const next = player.chooseToUse();
			next.set("openskilldialog", "扫围：是否将一张“隘”当做【杀】对" + get.translation(trigger.targets) + "使用？");
			next.set("norestore", true);
			next.set("_backupevent", `${event.name}_backup`);
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup(`${event.name}_backup`);
			next.set("targetRequired", true);
			next.set("complexTarget", true);
			next.set("complexSelect", true);
			next.set("filterTarget", function (card, player, target) {
				if (!_status.event.targets.includes(target)) {
					return false;
				}
				return lib.filter.filterTarget.apply(this, arguments);
			});
			next.set("selectTarget", -1);
			next.set("targets", trigger.targets);
			next.set("addCount", false);
			next.set("logSkill", event.name);
			await next;
		},
		ai: { combo: "dcaishou" },
		subSkill: {
			backup: {
				viewAs: { name: "sha" },
				filterCard(card, player) {
					return get.itemtype(card) == "card" && card.hasGaintag("dcaishou_tag");
				},
				position: "h",
				selectCard: 1,
				ai1(card) {
					const player = get.player();
					if (player.isHealthy() && player.hasSkill("dcaishou") && player.countCards("h", card => card.hasGaintag("dcaishou_tag")) == 1) {
						return 0;
					}
					let eff = 0;
					for (const target of get.event().targets || []) {
						eff += get.effect(target, get.autoViewAs({ name: "sha" }, [card]), player, player);
					}
					if (eff > 0) {
						return 6.5 + eff / 10 - get.value(card);
					}
					return 0;
				},
				log: false,
				manualConfirm: true,
			},
			gain: {
				audio: "dcsaowei",
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.skill == "dcsaowei_backup" && player.hasHistory("sourceDamage", evt => evt.card == event.card);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const cards = trigger.cards.filterInD();
					if (cards.length > 0) {
						await player.gain(cards, "gain2");
					}
				},
			},
		},
	},
	//向朗
	dckanji: {
		audio: 2,
		enable: "phaseUse",
		usable: 2,
		filter(event, player) {
			return player.countCards("h");
		},
		async content(event, trigger, player) {
			await player.showHandcards();
			const suits = new Set();
			const cards = player.getCards("h");
			for (const card of cards) {
				suits.add(get.suit(card));
			}
			if (suits.size === cards.length) {
				player.draw(2);
				event.suitsLength = suits.size;
				player.addTempSkill("dckanji_check");
			}
		},
		subSkill: {
			check: {
				trigger: { player: "gainAfter" },
				filter(event, player) {
					if (event.getParent(2).name != "dckanji") {
						return false;
					}
					var len = event.getParent(2).suitsLength;
					var suits = [];
					player.getCards("h", card => suits.add(get.suit(card)));
					return suits.length >= 4 && len < 4;
				},
				charlotte: true,
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.skip("phaseDiscard");
					game.log(player, "跳过了", "#y弃牌阶段");
				},
			},
		},
		ai: {
			order: 9,
			result: {
				player(player, target) {
					var count = player.countCards("h");
					if (count > 4) {
						return false;
					}
					var suits = [];
					player.getCards("h", card => suits.add(get.suit(card)));
					return suits.length == count ? 1 : 0;
				},
			},
		},
	},
	dcqianzheng: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		usable: 2,
		filter(event, player) {
			return event.player != player && (get.type(event.card) == "trick" || event.card.name == "sha") && player.countCards("he") > 1;
		},
		preHidden: true,
		async cost(event, trigger, player) {
			const str = "，若重铸的牌中没有" + get.translation(get.type2(trigger.card)) + "牌，你于" + get.translation(trigger.cards) + "进入弃牌堆后获得之";
			event.result = await player
				.chooseCard(get.prompt(event.skill), "重铸两张牌" + (trigger.cards.length ? str : "") + "。", 2, "he", lib.filter.cardRecastable)
				.set("ai", card => {
					var val = get.value(card);
					if (get.type2(card) == _status.event.type) {
						val += 0.5;
					}
					return 6 - val;
				})
				.setHiddenSkill(event.skill)
				.set("type", get.type2(trigger.card))
				.forResult();
		},
		async content(event, trigger, player) {
			if (event.cards.every(card => get.type2(card) != get.type2(trigger.card))) {
				trigger.getParent().dcqianzheng = true;
				player.addTempSkill("dcqianzheng_gain");
			}
			await player.recast(event.cards);
		},
		subSkill: {
			gain: {
				trigger: { global: "cardsDiscardAfter" },
				filter(event, player) {
					var evt = event.getParent();
					if (evt.name != "orderingDiscard") {
						return false;
					}
					return evt.relatedEvent.dcqianzheng && evt.relatedEvent.cards.filterInD("d").length;
				},
				charlotte: true,
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const evt = trigger.getParent().relatedEvent;
					player.gain(evt.cards.filterInD("d"), "gain2");
				},
			},
		},
	},
	//秦朗
	dchaochong: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			return player.getHandcardLimit() != player.countCards("h");
		},
		direct: true,
		locked: false,
		async content(event, trigger, player) {
			var del = player.getHandcardLimit() - player.countCards("h");
			event.delta = del;
			if (del > 0) {
				const result = await player
					.chooseBool(get.prompt("dchaochong"), "摸" + get.cnNumber(Math.min(5, del)) + "张牌，然后令你的手牌上限-1")
					.set("ai", () => {
						var player = _status.event.player;
						if (player.isPhaseUsing() && player.hasCard(cardx => player.hasUseTarget(cardx) && player.hasValueTarget(cardx), "hs")) {
							return false;
						}
						return true;
					})
					.forResult();
				if (result.bool) {
					player.logSkill("dchaochong");
					player.draw(Math.min(5, event.delta));
					lib.skill.dchaochong.change(player, -1);
				}
			} else if (del < 0) {
				const result = await player
					.chooseToDiscard(get.prompt("dchaochong"), "弃置" + get.cnNumber(-del) + "张手牌，然后令你的手牌上限+1", -del, "allowChooseAll")
					.set("ai", card => {
						var player = _status.event.player;
						if (player.isPhaseUsing() && player.hasCard(cardx => player.hasValueTarget(cardx), "hs")) {
							return 6 - player.getUseValue(card);
						}
						return 5 - get.value(card);
					})
					.set("logSkill", "dchaochong")
					.forResult();
				if (result.bool) {
					lib.skill.dchaochong.change(player, 1);
				}
			}
		},
		change(player, num) {
			if (typeof player.storage.dchaochong !== "number") {
				player.storage.dchaochong = 0;
			}
			if (!num) {
				return;
			}
			player.storage.dchaochong += num;
			player.markSkill("dchaochong");
			game.log(player, "的手牌上限", "#g" + (num > 0 ? "+" : "") + num);
		},
		markimage: "image/card/handcard.png",
		intro: {
			content(storage, player) {
				var num = player.storage.dchaochong;
				return "手牌上限" + (num >= 0 ? "+" : "") + num;
			},
		},
		mod: {
			maxHandcard(player, num) {
				return num + player.countMark("dchaochong");
			},
		},
		ai: { threaten: 2.2 },
	},
	dcjinjin: {
		audio: 2,
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		usable: 2,
		logTarget: "source",
		check(event, player) {
			if (typeof player.storage.dchaochong != "number" || player.storage.dchaochong == 0) {
				return true;
			}
			var evt = event.getParent("useCard");
			if (evt && evt.player == player && event.source == player) {
				return false;
			}
			if (player.isPhaseUsing() && player.storage.dchaochong == -1) {
				return true;
			}
			return Math.abs(player.storage.dchaochong) >= 2;
		},
		prompt2(event, player) {
			var str = "";
			if (typeof player.storage.dchaochong == "number" && player.storage.dchaochong != 0) {
				str += "重置因〖佞宠〗增加或减少的手牌上限，";
			}
			var num = Math.abs(player.countMark("dchaochong")) || 1;
			if (event.source && event.source.isIn()) {
				str += "令伤害来源弃置至多" + get.cnNumber(num) + "张牌，然后你摸" + num + "-X张牌（X为其弃置的牌数）";
			} else {
				str += "你摸" + get.cnNumber(num) + "张牌";
			}
			return str;
		},
		async content(event, trigger, player) {
			const del = Math.abs(player.countMark("dchaochong")) || 1;
			event.delta = del;
			player.storage.dchaochong = 0;
			if (player.hasSkill("dchaochong", null, false, false)) {
				player.markSkill("dchaochong");
			}
			game.log(player, "重置了手牌上限");

			let result = { bool: false };
			if (trigger.source && trigger.source.isIn()) {
				result = await trigger.source
					.chooseToDiscard(get.translation(player) + "对你发动了【矜谨】", "弃置至多" + get.cnNumber(del) + "张牌，然后" + get.translation(player) + "摸" + del + "-X张牌（X为你弃置的牌数）。", [1, del], "he", "allowChooseAll")
					.set("ai", card => {
						if (_status.event.goon) {
							return 5.5 - get.value(card);
						}
						return 0;
					})
					.set("goon", get.attitude(trigger.source, player) < 0)
					.forResult();
			}
			let num = event.delta;
			if (result.bool) {
				num -= result.cards.length;
			}
			if (num > 0) {
				await player.draw(num);
			}
		},
		ai: {
			combo: "dchaochong",
			maixie: true,
			maixie_hp: true,
			threaten: 0.85,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						var num = 0;
						if (typeof target.storage.dcninchong == "number") {
							num = Math.abs(target.storage.dcninchong);
						}
						if (num <= 0) {
							return;
						}
						return [1, Math.min(1, num / 3)];
					}
				},
			},
		},
	},
};
