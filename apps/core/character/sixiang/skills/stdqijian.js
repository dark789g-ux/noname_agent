import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdqijian" | "stdyoudi" | "stdjuezhu" | "stdchengji" | "stdzhanjue" | "stdqinwang">} */
export const groupSkills = {
	//周鲂
	stdqijian: {
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(current => game.hasPlayer(currentx => current.countCards("h") + currentx.countCards("h") == 7));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), 2)
				.set("filterTarget", (card, player, target) => {
					if (!ui.selected.targets.length) {
						return true;
					}
					const targetx = ui.selected.targets[0];
					return targetx.countCards("h") + target.countCards("h") == 7;
				})
				.set("complexTarget", true)
				.set("ai", target => {
					const player = get.player();
					if (!ui.selected.targets.length) {
						return get.attitude(player, target);
					}
					return 1;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets.sortBySeat();
			const list = ["摸牌", "弃牌"];
			for (const target of targets) {
				if (!target.isIn()) {
					continue;
				}
				const targetx = targets.filter(current => current != target)[0];
				let result;
				const goon = targetx.countDiscardableCards(target, "he");
				if (goon) {
					result = await target
						.chooseControl(list)
						.set("prompt", `七笺：弃置${get.translation(targetx)}一张牌或令其摸一张牌`)
						.set("ai", () => {
							const { player, targetx } = get.event();
							const att = get.attitude(player, targetx);
							return att > 0 ? "摸牌" : "弃牌";
						})
						.set("targetx", targetx)
						.forResult();
				} else {
					result = { control: "摸牌" };
				}
				const control = result?.control;
				if (!targetx.isIn() || !control) {
					continue;
				}
				target.popup(control);
				game.log(target, "选择", "#g" + control);
				target.line(targetx);
				if (control == "摸牌") {
					await targetx.draw();
				} else if (control == "弃牌" && targetx.countDiscardableCards(target, "he")) {
					await target.discardPlayerCard(targetx, "he", true);
				}
			}
		},
	},
	stdyoudi: {
		audio: "xinfu_youdi",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards(
				"hes",
				card => player.hasUseTarget(get.autoViewAs({ name: "shunshou" }, [card]), false, false) && get.color(card, player) == "red"
			);
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			const next = player.chooseToUse();
			next.set("openskilldialog", get.prompt2(`${event.name}`));
			next.set("norestore", true);
			next.set("_backupevent", `${event.name}_backup`);
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup(`${event.name}_backup`);
			next.set("logSkill", event.name);
			await next;
		},
		subSkill: {
			backup: {
				filterCard(card, player) {
					return get.itemtype(card) == "card" && get.color(card, player) == "red";
				},
				position: "hes",
				viewAs: { name: "shunshou" },
				check(card) {
					return 7 - get.value(card);
				},
				log: false,
			},
		},
	},
	//四象封印·少阳
	//张苞
	stdjuezhu: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player, name) {
			if (name == "damageSource") {
				return true;
			}
			return event.source?.isIn() && player.canUse({ name: "juedou", isCard: true }, event.source);
		},
		forced: true,
		async content(event, trigger, player) {
			if (event.triggername == "damageSource") {
				player.addTempSkill("stdjuezhu_paoxiao");
			} else {
				let card = { name: "juedou", isCard: true };
				if (player.canUse(card, trigger.source)) {
					await player.useCard(card, trigger.source);
				}
			}
		},
		subSkill: {
			paoxiao: {
				charlotte: true,
				mod: {
					cardUsable() {
						return Infinity;
					},
				},
			},
		},
	},
	stdchengji: {
		audio: 2,
		enable: ["chooseToRespond", "chooseToUse"],
		filterCard(card, player) {
			if (!ui.selected.cards.length) {
				return true;
			}
			return ui.selected.cards.every(cardx => get.color(cardx, player) != get.color(card, player));
		},
		complexCard: true,
		position: "hes",
		selectCard: 2,
		viewAs: { name: "sha" },
		viewAsFilter(player) {
			if (player.countCards("hes") < 2) {
				return false;
			}
			let color = get.color(player.getCards("hes")[0], player);
			return _status.connectMode || player.getCards("hes").some(card => get.color(card, player) != color);
		},
		prompt: "将两张颜色不同的牌当杀使用或打出",
		check(card) {
			const val = get.value(card);
			if (_status.event.name == "chooseToRespond") {
				return 1 / Math.max(0.1, val);
			}
			return 5 - val;
		},
		ai: {
			skillTagFilter(player) {
				if (player.countCards("hes") < 2) {
					return false;
				}
				let color = get.color(player.getCards("hes")[0], player);
				return _status.connectMode || player.getCards("hes").some(card => get.color(card, player) != color);
			},
			respondSha: true,
		},
	},
	//刘谌
	stdzhanjue: {
		audio: "zhanjue",
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		selectCard: -1,
		position: "h",
		filter(event, player) {
			let hs = player.getCards("h");
			if (!hs.length) {
				return false;
			}
			for (let i = 0; i < hs.length; i++) {
				let mod2 = game.checkMod(hs[i], player, "unchanged", "cardEnabled2", player);
				if (mod2 === false) {
					return false;
				}
			}
			return event.filterCard(get.autoViewAs({ name: "juedou" }, hs));
		},
		viewAs: { name: "juedou" },
		ai: {
			order(item, player) {
				if (player.countCards("h") > 1) {
					return 0.8;
				}
				return 8;
			},
			tag: {
				respond: 2,
				respondSha: 2,
				damage: 1,
			},
			result: {
				player(player, target) {
					let td = get.damageEffect(target, player, target);
					if (!td) {
						return 0;
					}
					let hs = player.getCards("h"),
						val = hs.reduce((acc, i) => acc - get.value(i, player), 0) / 6 + 1;
					if (td > 0) {
						return val;
					}
					if (
						player.hasSkillTag("directHit_ai", true, {
							target: target,
							card: get.autoViewAs({ name: "juedou" }, hs),
						})
					) {
						return val;
					}
					let pd = get.damageEffect(player, target, player),
						att = get.attitude(player, target);
					if (att > 0 && get.damageEffect(target, player, player) > pd) {
						return val;
					}
					let ts = target.mayHaveSha(player, "respond", null, "count");
					if (ts < 1 && ts * 8 < Math.pow(player.hp, 2)) {
						return val;
					}
					let damage = pd / get.attitude(player, player),
						ps = player.mayHaveSha(player, "respond", hs, "count");
					if (att > 0) {
						if (ts < 1) {
							return val;
						}
						return val + damage + 1;
					}
					if (pd >= 0) {
						return val + damage + 1;
					}
					if (ts - ps + Math.exp(0.8 - player.hp) < 1) {
						return val - ts;
					}
					return val + damage + 1 - ts;
				},
				target(player, target) {
					let td = get.damageEffect(target, player, target) / get.attitude(target, target);
					if (!td) {
						return 0;
					}
					let hs = player.getCards("h");
					if (
						td > 0 ||
						player.hasSkillTag("directHit_ai", true, {
							target: target,
							card: get.autoViewAs({ name: "juedou" }, hs),
						})
					) {
						return td + 1;
					}
					let pd = get.damageEffect(player, target, player),
						att = get.attitude(player, target);
					if (att > 0) {
						return td + 1;
					}
					let ts = target.mayHaveSha(player, "respond", null, "count"),
						ps = player.mayHaveSha(player, "respond", hs, "count");
					if (ts < 1) {
						return td + 1;
					}
					if (pd >= 0) {
						return 0;
					}
					if (ts - ps < 1) {
						return td + 1 - ts;
					}
					return -ts;
				},
			},
			nokeep: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "nokeep") {
					return (
						(!arg || (arg.card && get.name(arg.card) === "tao")) &&
						player.isPhaseUsing() &&
						!player.countSkill("stdzhanjue") &&
						player.hasCard(card => {
							return get.name(card) !== "tao";
						}, "h")
					);
				}
			},
		},
		group: "stdzhanjue_draw",
		subSkill: {
			draw: {
				trigger: {
					player: "useCardAfter",
				},
				forced: true,
				charlotte: true,
				popup: false,
				filter(event, player) {
					return event.skill == "stdzhanjue";
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
		},
	},
	stdqinwang: {
		audio: "qinwang1",
		zhuSkill: true,
		group: "stdqinwang_effect",
		filter(event, player) {
			if (!player.hasZhuSkill("stdqinwang") || event.stdqinwang) {
				return false;
			}
			return game.hasPlayer(current => current != player && current.group == "shu");
		},
		enable: "chooseToRespond",
		viewAs: { name: "sha" },
		filterCard() {
			return false;
		},
		selectCard: -1,
		ai: {
			order() {
				return get.order({ name: "sha" }) + 0.3;
			},
			respondSha: true,
			skillTagFilter(player) {
				if (!player.hasZhuSkill("stdqinwang") || !game.hasPlayer(current => current != player && current.group == "shu")) {
					return false;
				}
			},
		},
		subSkill: {
			effect: {
				audio: "stdqinwang",
				trigger: {
					player: "respondBegin",
				},
				filter(event, player) {
					return event.skill == "stdqinwang";
				},
				forced: true,
				async content(event, trigger, player) {
					delete trigger.skill;
					trigger.getParent().set("stdqinwang", true);
					while (true) {
						if (event.current == undefined) {
							event.current = player.next;
						}
						if (event.current == player) {
							trigger.cancel();
							trigger.getParent().goto(0);
							return;
						} else if (event.current.group == "shu") {
							const discardEvent = event.current.chooseToDiscard("是否弃置一张牌，视为" + get.translation(player) + "打出一张杀？");
							discardEvent.set("filterCard", card => get.type(card) == "basic");
							discardEvent.set("ai", card => {
								const event = _status.event;
								if (get.attitude(event.player, event.source) >= 2) {
									return 6 - get.value(card);
								}
								return 0;
							});
							discardEvent.set("source", player);
							discardEvent.set("skillwarn", "弃置一张牌，视为" + get.translation(player) + "打出一张杀");
							const { bool } = await discardEvent.forResult();
							if (bool) {
								if (typeof event.current.ai.shown == "number" && event.current.ai.shown < 0.95) {
									event.current.ai.shown += 0.3;
									if (event.current.ai.shown > 0.95) {
										event.current.ai.shown = 0.95;
									}
								}
								return;
							} else {
								event.current = event.current.next;
							}
						} else {
							event.current = event.current.next;
						}
					}
				},
			},
		},
	},
};
