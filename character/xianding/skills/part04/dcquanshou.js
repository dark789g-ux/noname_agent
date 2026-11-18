import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcquanshou" | "dcshexue" | "dcdanyi" | "dcwencan">} */
export const groupSkills = {
	//孙瑜
	dcquanshou: {
		audio: 2,
		trigger: { global: "phaseBegin" },
		filter(event, player) {
			return event.player.countCards("h") <= event.player.maxHp;
		},
		logTarget: "player",
		check(event, player) {
			if (get.attitude(player, event.player) > 0) {
				return true;
			}
			const draw = event.player.maxHp - event.player.countCards("h");
			return draw <= 2 && event.player.getHp(true) - draw >= 1;
		},
		content() {
			"step 0";
			var draw = Math.min(5, trigger.player.maxHp - trigger.player.countCards("h"));
			trigger.player
				.chooseControl()
				.set("choiceList", [(draw > 0 ? "摸" + get.cnNumber(draw) + "张牌，然后" : "令") + "你本回合使用【杀】的次数上限-1", "当你本回合使用牌被抵消后，" + get.translation(player) + "摸一张牌"])
				.set("ai", () => _status.event.choice)
				.set(
					"choice",
					(function () {
						var draw = Math.min(5, Math.max(0, trigger.player.maxHp - trigger.player.countCards("h")));
						if (get.attitude(trigger.player, player) > 0) {
							if (draw >= 3 || trigger.player.getCardUsable("sha") > 1) {
								return "选项一";
							}
							if (
								!draw ||
								(draw <= 1 &&
									trigger.player.countCards("hs", card => {
										return get.name(card) == "sha" && trigger.player.hasValueTarget(card);
									}))
							) {
								return "选项二";
							}
							return "选项一";
						} else {
							if (draw >= 4) {
								return "选项一";
							}
							if (
								draw < 2 &&
								trigger.player.countCards("hs", card => {
									return trigger.player.hasValueTarget(card);
								})
							) {
								return "选项二";
							}
							return "选项一";
						}
					})()
				)
				.set("prompt", "劝守：请选择一项");
			"step 1";
			game.log(trigger.player, "选择了", "#y" + result.control);
			if (result.control == "选项一") {
				var draw = Math.min(5, trigger.player.maxHp - trigger.player.countCards("h"));
				if (draw > 0) {
					trigger.player.draw(draw);
				}
				trigger.player.addTempSkill("dcquanshou_sha");
				trigger.player.addMark("dcquanshou_sha", 1, false);
			} else {
				trigger.player.addTempSkill("dcquanshou_respond");
				trigger.player.markAuto("dcquanshou_respond", [player]);
			}
		},
		ai: {
			expose: 0.1,
		},
		subSkill: {
			sha: {
				charlotte: true,
				onremove: true,
				marktext: "守",
				intro: { content: "使用【杀】的次数上限-#" },
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num - player.countMark("dcquanshou_sha");
						}
					},
				},
			},
			respond: {
				trigger: { player: ["shaMiss", "eventNeutralized"] },
				filter(event, player) {
					if (event.type != "card" && event.name != "_wuxie") {
						return false;
					}
					return player.getStorage("dcquanshou_respond").some(i => i.isIn());
				},
				forced: true,
				popup: false,
				charlotte: true,
				onremove: true,
				marktext: '<span style="text-decoration: line-through;">守</span>',
				intro: { content: "本回合使用的牌被抵消后，$摸一张牌" },
				content() {
					var targets = player.getStorage("dcquanshou_respond");
					targets.sortBySeat();
					for (var target of targets) {
						if (target.isIn()) {
							target.logSkill("dcquanshou_respond", player);
							target.draw();
						}
					}
				},
			},
		},
	},
	dcshexue: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			var cards = lib.skill.dcshexue.getLast();
			return cards.some(card => player.hasUseTarget(card, false));
		},
		getLast() {
			var cards = [];
			for (var current of game.filterPlayer()) {
				var history = current.actionHistory;
				if (history.length < 2) {
					continue;
				}
				if (history[history.length - 2].isMe) {
					var evts = history[history.length - 2].useCard;
					for (var i = evts.length - 1; i >= 0; i--) {
						var evt = evts[i];
						if (get.type(evt.card) != "basic" && get.type(evt.card) != "trick") {
							continue;
						}
						var evtx = evt.getParent("phaseUse");
						if (evtx && evtx.player == current) {
							cards.push({ name: evt.card.name, nature: evt.card.nature });
						}
					}
				}
			}
			return cards;
		},
		direct: true,
		group: "dcshexue_end",
		content() {
			"step 0";
			var cards = lib.skill.dcshexue.getLast();
			cards = cards.filter(card => player.hasUseTarget(card, false));
			player.chooseButton(["设学：是否将一张牌当作其中一张牌使用？", [cards, "vcard"]]);
			"step 1";
			if (!result.bool) {
				return;
			}
			var card = result.links[0];
			game.broadcastAll(function (card) {
				lib.skill.dcshexue_backup.viewAs = card;
			}, card);
			var next = player.chooseToUse();
			next.set("openskilldialog", `###${get.prompt("dcshexue")}###将一张牌当做${get.translation(card.nature) || ""}【${get.translation(card.name)}】使用`);
			next.set("norestore", true);
			next.set("addCount", false);
			next.set("_backupevent", "dcshexue_backup");
			next.set("custom", {
				add: {},
				replace: { window() {} },
			});
			next.backup("dcshexue_backup");
		},
		subSkill: {
			backup: {
				audio: "dcshexue",
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				filterTarget: lib.filter.targetEnabled,
				position: "hes",
				selectCard: 1,
				check: card => 6 - get.value(card),
				popname: true,
			},
			end: {
				audio: "dcshexue",
				trigger: { player: "phaseUseEnd" },
				filter(event, player) {
					return player.getHistory("useCard", evt => {
						return evt.getParent("phaseUse") == event && (get.type(evt.card) == "basic" || get.type(evt.card) == "trick");
					}).length;
				},
				prompt2(event, player) {
					return "令下一回合的角色于其出牌阶段开始时选择是否将一张牌当做你本阶段使用过的一张基本牌或普通锦囊牌使用？";
				},
				check(event, player) {
					let evt = event.getParent("phase").getParent();
					let nextPlayer = player.getNext();
					if (evt && evt.next && evt.next.length) {
						nextPlayer = evt.next[0].player;
					}
					return get.attitude(player, nextPlayer) > 0;
				},
				content() {
					var history = player.getHistory("useCard", evt => {
						return evt.getParent("phaseUse") == trigger && (get.type(evt.card) == "basic" || get.type(evt.card) == "trick");
					});
					player.addSkill("dcshexue_studyclear");
					if (!player.storage.dcshexue_studyclear) {
						player.storage.dcshexue_studyclear = [];
					}
					history.forEach(evt => {
						var card = evt.card;
						card = { name: card.name, nature: card.nature };
						player.storage.dcshexue_studyclear.push(card);
					});
				},
			},
			study: {
				trigger: { player: "phaseUseBegin" },
				filter(event, player) {
					return player.getStorage("dcshexue_study").some(i => event.player.hasUseTarget(i, false));
				},
				onremove: true,
				charlotte: true,
				direct: true,
				async content(event, trigger, player) {
					let cards = player.getStorage("dcshexue_study");
					const result = await player
						.chooseButton(["设学：是否将一张牌当作其中一张牌使用？", [cards, "vcard"]])
						.set("ai", button => {
							return get.event().player.getUseValue(button.link, false);
						})
						.forResult();
					if (!result.bool) {
						return;
					}
					const card = result.links[0];
					if (!trigger.player.hasUseTarget(card, false)) {
						return;
					}
					game.broadcastAll(function (card) {
						lib.skill.dcshexue_backup.viewAs = card;
						lib.skill.dcshexue_backup.prompt = "设学：是否将一张牌当做" + get.translation(card) + "使用？";
					}, card);
					await trigger.player
						.chooseToUse()
						.set(
							"openskilldialog",
							`###${get.prompt("dcshexue_study")}###
							将一张牌当做${get.translation(card.nature) || ""}【${get.translation(card.name)}】使用`
						)
						.set("norestore", true)
						.set("addCount", false)
						.set("_backupevent", "dcshexue_backup")
						.set("custom", {
							add: {},
							replace: { window() {} },
						})
						.backup("dcshexue_backup");
				},
			},
			studyclear: {
				trigger: { global: "phaseBegin" },
				charlotte: true,
				forceDie: true,
				silent: true,
				onremove: true,
				lastDo: true,
				content() {
					trigger.player.addTempSkill("dcshexue_study");
					if (!trigger.player.storage.dcshexue_study) {
						trigger.player.storage.dcshexue_study = [];
					}
					trigger.player.storage.dcshexue_study = trigger.player.storage.dcshexue_study.concat(player.getStorage("dcshexue_studyclear"));
					player.removeSkill("dcshexue_studyclear");
				},
			},
		},
	},
	//郤正
	dcdanyi: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			if (!event.isFirstTarget) {
				return false;
			}
			if (!event.targets || !event.targets.length) {
				return false;
			}
			var evt = lib.skill.dcjianying.getLastUsed(player, event.getParent());
			if (!evt || !evt.targets || !evt.targets.length) {
				return false;
			}
			return event.targets.some(target => evt.targets.includes(target));
		},
		frequent: true,
		locked: false,
		content() {
			var evt = lib.skill.dcjianying.getLastUsed(player, trigger.getParent());
			player.draw(trigger.targets.filter(target => evt.targets.includes(target)).length);
		},
		mod: {
			aiOrder(player, card, num) {
				var evt = player.getLastUsed();
				if (
					evt &&
					evt.targets &&
					evt.targets.length &&
					game.hasPlayer(current => {
						return evt.targets.includes(current) && player.canUse(card, current) && get.effect(current, card, player, player) > 0;
					})
				) {
					return num + 10;
				}
			},
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					var evt = player.getLastUsed();
					if (evt && evt.targets.includes(target)) {
						return [1, 1];
					}
				},
			},
		},
	},
	dcwencan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			if (ui.selected.targets.length) {
				if (ui.selected.targets[0].hp == target.hp) {
					return false;
				}
			}
			return target != player;
		},
		selectTarget: [1, 2],
		complexTarget: true,
		multiline: true,
		content() {
			"step 0";
			target
				.chooseToDiscard(get.translation(player) + "对你发动了【文灿】", "是否弃置两张花色不同的牌？或者点击“取消”，令其本回合对你使用牌无距离和次数限制", "he", 2, (card, player) => {
					if (!ui.selected.cards.length) {
						return true;
					}
					var suit = get.suit(card, player);
					for (var i of ui.selected.cards) {
						if (get.suit(i, player) == suit) {
							return false;
						}
					}
					return true;
				})
				.set("complexCard", true)
				.set("ai", card => {
					if (_status.event.nofear) {
						return 0;
					}
					return 5 - get.value(card);
				})
				.set(
					"nofear",
					player.countCards("hs", card => {
						return get.tag(card, "damage") && player.canUse(card, target, false) && get.effect(target, card, player, target) <= 0;
					}) < target.hp
				);
			"step 1";
			if (!result.bool) {
				player.addTempSkill("dcwencan_paoxiao");
				player.markAuto("dcwencan_paoxiao", [target]);
			}
		},
		subSkill: {
			paoxiao: {
				charlotte: true,
				onremove: true,
				marktext: "灿",
				intro: { content: "对$使用牌无距离和次数限制" },
				forced: true,
				trigger: { player: "useCard1" },
				filter(event, player) {
					if (!event.targets?.some(target => player.getStorage("dcwencan_paoxiao").includes(target))) {
						return false;
					}
					return event.card.name === "sha";
				},
				async content(event, trigger, player) {
					trigger.addCount = false;
					const stat = player.getStat().card;
					const name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
				},
				mod: {
					cardUsableTarget(card, player, target) {
						if (player.getStorage("dcwencan_paoxiao").includes(target)) {
							return true;
						}
					},
					targetInRange(card, player, target) {
						if (player.getStorage("dcwencan_paoxiao").includes(target)) {
							return true;
						}
					},
				},
			},
		},
		ai: {
			order: 9,
			result: { target: -1 },
		},
	},
};
