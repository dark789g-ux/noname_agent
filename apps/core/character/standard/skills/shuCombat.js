import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jijiang1" | "jijiang3" | "wusheng" | "wusheng_re_guanyu" | "zhongyi" | "zhongyi2" | "paoxiao" | "paoxiao_xiahouba" | "guanxing_fail" | "guanxing" | "kongcheng" | "kongcheng1" | "longdan" | "longdan_sha_re_zhaoyun" | "mashu" | "feiying" | "tieji">} */
export const shuCombatSkills = {
	jijiang1: {
		audio: 2,
		audioname: ["liushan", "re_liubei", "re_liushan", "ol_liushan"],
		audioname2: {
			pe_jun_liubei: "sbjijiang",
		},
		trigger: { player: ["useCardBegin", "respondBegin"] },
		logTarget: "targets",
		sourceSkill: "jijiang",
		filter(event, player) {
			return event.skill === "jijiang";
		},
		forced: true,
		async content(event, trigger, player) {
			delete trigger.skill;
			const jijiang = trigger.getParent();
			if (jijiang == null) {
				return;
			}
			jijiang.set("jijiang", true);

			let current = player.next;
			while (true) {
				event.current = current;
				if (current === player) {
					player.addTempSkill("jijiang3");
					trigger.cancel();
					jijiang.goto(0);
					return;
				}
				if (current.group === "shu") {
					const next = current.chooseToRespond({
						prompt: `是否替${get.translation(player)}打出一张杀？`,
						filterCard: function (card, player) {
							if (get.name(card) !== "sha") {
								return false;
							}
							return lib.filter.cardRespondable(card, player);
						},
						ai() {
							const event = get.event();
							return get.attitude(event.player, event.source) - 2;
						},
					});
					next.set("source", player);
					next.set("jijiang", true);
					next.set("skillwarn", `替${get.translation(player)}打出一张杀`);
					next.noOrdering = true;
					next.autochoose = lib.filter.autoRespondSha;
					const { bool, card, cards } = await next.forResult();
					if (bool) {
						trigger.card = card;
						trigger.cards = cards;
						trigger.throw = false;
						if (typeof event.current.ai.shown === "number" && event.current.ai.shown < 0.95) {
							event.current.ai.shown += 0.3;
							if (event.current.ai.shown > 0.95) {
								event.current.ai.shown = 0.95;
							}
						}
						return;
					} else {
						current = current.next;
					}
				} else {
					current = current.next;
				}
			}
		},
	},
	jijiang3: {
		trigger: { global: ["useCardAfter", "useSkillAfter", "phaseAfter"] },
		silent: true,
		charlotte: true,
		sourceSkill: "jijiang",
		filter(event) {
			return event.skill !== "jijiang" && event.skill !== "qinwang";
		},
		async content(event, trigger, player) {
			player.removeSkill("jijiang3");
		},
	},
	wusheng: {
		selectionSpec: true,
		audio: 2,
		audioname2: {
			old_guanzhang: "wusheng_old_guanzhang",
			old_guanyu: "wusheng_re_guanyu",
			guanzhang: "wusheng_guanzhang",
			guansuo: "wusheng_guansuo",
		},
		audioname: ["re_guanyu", "jsp_guanyu", "re_guanzhang", "dc_jsp_guanyu"],
		enable: ["chooseToRespond", "chooseToUse"],
		filterCard(card, player) {
			if (get.zhu(player, "shouyue")) {
				return true;
			}
			return get.color(card) === "red";
		},
		position: "hes",
		viewAs: { name: "sha" },
		viewAsFilter(player) {
			if (get.zhu(player, "shouyue")) {
				if (!player.hasCards("hes")) {
					return false;
				}
			} else {
				if (!player.hasCards("hes", { color: "red" })) {
					return false;
				}
			}
		},
		prompt: "将一张红色牌当杀使用或打出",
		check(card) {
			const val = get.value(card);
			if (get.event().name === "chooseToRespond") {
				return 1 / Math.max(0.1, val);
			}
			return 5 - val;
		},
		ai: {
			skillTagFilter(player) {
				if (get.zhu(player, "shouyue")) {
					if (!player.hasCards("hes")) {
						return false;
					}
				} else {
					if (!player.hasCards("hes", { color: "red" })) {
						return false;
					}
				}
			},
			respondSha: true,
		},
	},
	wusheng_re_guanyu: { audio: 2 },
	zhongyi: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		filterCard: true,
		position: "he",
		filter(event, player) {
			return player.hasCards("he");
		},
		discard: false,
		lose: false,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.addTempSkill("zhongyi2", "roundStart");
			await player.addToExpansion({
				cards: event.cards,
				source: player,
				animate: "give",
				gaintag: ["zhongyi2"],
			});
		},
	},
	zhongyi2: {
		trigger: { global: "damageBegin1" },
		forced: true,
		popup: false,
		logTarget: "source",
		sourceSkill: "zhongyi",
		filter(event, player) {
			return event.source?.isFriendOf(player) && event.getParent()?.name === "sha";
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
		intro: { content: "expansion", markcount: "expansion" },
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile({ cards });
			}
		},
	},
	paoxiao: {
		audio: 2,
		firstDo: true,
		audioname: ["re_zhangfei", "xiahouba"],
		audioname2: {
			old_guanzhang: "paoxiao_old_guanzhang",
			guanzhang: "paoxiao_guanzhang",
		},
		trigger: { player: "useCard1" },
		forced: true,
		filter(event, player) {
			return !event.audioed && event.card.name === "sha" && player.countUsed("sha", true) > 1 && event.getParent()?.type === "phase";
		},
		async content(event, trigger, player) {
			trigger.audioed = true;
		},
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return Infinity;
				}
			},
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (!get.zhu(player, "shouyue")) {
					return false;
				}
				if (arg && arg.name == "sha") {
					return true;
				}
				return false;
			},
		},
	},
	paoxiao_xiahouba: { audio: 2 },
	guanxing_fail: {},
	guanxing: {
		audio: 2,
		audioname: ["jiangwei", "re_jiangwei", "re_zhugeliang", "ol_jiangwei"],
		trigger: { player: "phaseZhunbeiBegin" },
		frequent: true,
		preHidden: true,
		async content(event, trigger, player) {
			const num = player.hasSkill("yizhi") && player.hasSkill("guanxing") ? 5 : Math.min(5, game.countPlayer());
			const result = await player.chooseToGuanxing(num).set("prompt", "观星：点击或拖动将牌移动到牌堆顶或牌堆底").forResult();
			if (!result.bool || !result.moved[0].length) {
				player.addTempSkill("guanxing_fail");
			}
		},
		ai: {
			threaten: 1.2,
			guanxing: true,
		},
	},
	kongcheng: {
		mod: {
			targetEnabled(card, player, target, now) {
				if (!target.hasCards("h")) {
					if (card.name === "sha" || card.name === "juedou") {
						return false;
					}
				}
			},
		},
		group: "kongcheng1",
		audio: "kongcheng1",
		audioname: ["re_zhugeliang"],
		ai: {
			noh: true,
			skillTagFilter(player, tag) {
				if (tag === "noh") {
					if (player.countCards("h") != 1) {
						return false;
					}
				}
			},
		},
	},
	kongcheng1: {
		audio: 2,
		trigger: { player: "loseEnd" },
		forced: true,
		firstDo: true,
		audioname: ["re_zhugeliang"],
		sourceSkill: "kongcheng",
		filter(event, player) {
			if (player.hasCards("h")) {
				return false;
			}
			for (const card of event.cards) {
				if (card.original === "h") {
					return true;
				}
			}
			return false;
		},
		async content() {},
	},
	longdan: {
		audio: "longdan_sha",
		audioname: ["re_zhaoyun"],
		audioname2: { old_zhaoyun: "longdan_sha_re_zhaoyun" },
		group: ["longdan_sha", "longdan_shan", "longdan_draw"],
		subSkill: {
			draw: {
				trigger: { player: ["useCard", "respond"] },
				forced: true,
				popup: false,
				filter(event, player) {
					if (!get.zhu(player, "shouyue")) {
						return false;
					}
					return event.skill === "longdan_sha" || event.skill === "longdan_shan";
				},
				async content(event, trigger, player) {
					await player.draw();
					player.storage.fanghun2++;
				},
			},
			sha: {
				selectionSpec: true,
				audio: 2,
				audioname: ["re_zhaoyun"],
				audioname2: { old_zhaoyun: "longdan_sha_re_zhaoyun" },
				enable: ["chooseToUse", "chooseToRespond"],
				filterCard: { name: "shan" },
				viewAs: { name: "sha" },
				viewAsFilter(player) {
					if (!player.hasCards("hs", "shan")) {
						return false;
					}
				},
				position: "hs",
				prompt: "将一张闪当杀使用或打出",
				check() {
					return 1;
				},
				ai: {
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondSha") && current < 0) {
								return 0.6;
							}
						},
					},
					respondSha: true,
					skillTagFilter(player) {
						if (!player.hasCards("hs", "shan")) {
							return false;
						}
					},
					order() {
						return get.order({ name: "sha" }) + 0.1;
					},
					useful: -1,
					value: -1,
				},
			},
			shan: {
				selectionSpec: true,
				audio: "longdan_sha",
				audioname: ["re_zhaoyun"],
				audioname2: { old_zhaoyun: "longdan_sha_re_zhaoyun" },
				enable: ["chooseToRespond", "chooseToUse"],
				filterCard: { name: "sha" },
				viewAs: { name: "shan" },
				prompt: "将一张杀当闪使用或打出",
				check() {
					return 1;
				},
				position: "hs",
				viewAsFilter(player) {
					if (!player.hasCards("hs", "sha")) {
						return false;
					}
				},
				ai: {
					respondShan: true,
					skillTagFilter(player) {
						if (!player.hasCards("hs", "sha")) {
							return false;
						}
					},
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondShan") && current < 0) {
								return 0.6;
							}
						},
					},
					order: 4,
					useful: -1,
					value: -1,
				},
			},
		},
	},
	longdan_sha_re_zhaoyun: { audio: 2 },
	mashu: {
		mod: {
			globalFrom(from, to, distance) {
				return distance - 1;
			},
		},
	},
	feiying: {
		mod: {
			globalTo(from, to, distance) {
				return distance + 1;
			},
		},
	},
	tieji: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		check(event, player) {
			return get.attitude(player, event.target) <= 0;
		},
		filter(event, player) {
			return event.card.name === "sha";
		},
		logTarget: "target",
		preHidden: true,
		async content(event, trigger, player) {
			const { bool } = await player
				.judge({
					judge(card) {
						if (get.zhu(get.player(), "shouyue")) {
							if (get.suit(card) !== "spade") {
								return 2;
							}
						} else {
							if (get.color(card) === "red") {
								return 2;
							}
						}
						return -0.5;
					},
					judge2(result) {
						return result.bool;
					},
				})
				.forResult();
			if (bool) {
				trigger.getParent()?.directHit.add(trigger.target);
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (get.attitude(player, arg.target) > 0 || arg.card.name !== "sha" || !ui.cardPile.firstChild || get.color(ui.cardPile.firstChild, player) !== "red") {
					return false;
				}
			},
		},
	},
};
