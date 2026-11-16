import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oldaili" | "olhuiyun">} */
export const groupSkills = {
	//罗宪
	oldaili: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return (
				player.countCards("h", card => {
					return card.hasGaintag("oldaili_tag");
				}) %
					2 ==
				0
			);
		},
		group: ["oldaili_record", "oldaili_show"],
		locked: false,
		check(event, player) {
			if (get.distance(event.player, player, "absolute") == 1 && !player.isTurnedOver()) {
				return false;
			}
			return true;
		},
		content() {
			player.turnOver();
			player.draw(3, "visible").gaintag = ["oldaili_tag"];
		},
		mod: {
			aiValue(player, card, num) {
				if (num < 0 || get.itemtype(card) != "card" || !card.hasGaintag("oldaili_tag")) {
					return;
				}
				if (get.distance(_status.currentPhase, player, "absolute") == 1 && !player.isTurnedOver()) {
					return;
				}
				let dai = player.countCards("h", card => {
					return card.hasGaintag("oldaili_tag");
				});
				if (ui.selected.cards && ui.selected.cards.length) {
					dai += ui.selected.cards.filter(card => {
						return card.hasGaintag("oldaili_tag");
					}).length;
				}
				if (dai % 2) {
					return Math.sqrt(num);
				}
				return num + 6;
			},
			aiUseful() {
				return lib.skill.oldaili.mod.aiValue.apply(this, arguments);
			},
		},
		mark: true,
		marktext: "砺",
		intro: {
			markcount(storage, player) {
				return player.countCards("h", card => card.hasGaintag("oldaili_tag"));
			},
			mark(dialog, content, player) {
				var cards = player.getCards("h", card => card.hasGaintag("oldaili_tag"));
				if (cards.length) {
					dialog.addAuto(cards);
				} else {
					return "无展示牌";
				}
			},
		},
		subSkill: {
			record: {
				trigger: { global: "showCardsEnd" },
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					return event.cards.some(i => get.owner(i) == player);
				},
				content() {
					game.broadcastAll(
						function (cards) {
							cards.forEach(card => card.addGaintag("oldaili_tag"));
						},
						trigger.cards.filter(i => get.owner(i) == player)
					);
					player.markSkill("oldaili");
				},
			},
			show: {
				trigger: { player: "drawAfter" },
				filter(event, player) {
					return event.result?.length && event.getParent().name == "oldaili";
				},
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				content() {
					player.showCards(trigger.result);
				},
			},
		},
	},
	//胡班
	olhuiyun: {
		audio: 2,
		enable: "phaseUse",
		viewAs: {
			name: "huogong",
			storage: { olhuiyun: true },
		},
		filterCard: true,
		position: "hes",
		onuse(links, player) {
			player.addTempSkill("olhuiyun_after");
			player.addTempSkill("olhuiyun_record");
		},
		ai: {
			effect: {
				player(card, player, target) {
					if (get.attitude(player, target) > 0 && card?.name === "huogong" && card.storage?.olhuiyun && player.getStorage("olhuiyun_used").length < 3) {
						return [0, 0.5, 0, 0.5];
					}
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			after: {
				audio: "olhuiyun",
				trigger: { global: "useCardAfter" },
				charlotte: true,
				locked: true,
				filter(event, player) {
					if (player.getStorage("olhuiyun_used").length > 2) {
						return false;
					}
					return event.card.name == "huogong" && event.card.storage?.olhuiyun && event.targets.some(i => i.isIn());
				},
				async cost(event, trigger, player) {
					const choices = [];
					const choiceList = ["使用展示牌，然后重铸所有手牌", "使用一张手牌，然后重铸展示牌", "摸一张牌"];
					for (let i = 1; i <= 3; i++) {
						if (!player.getStorage("olhuiyun_used").includes(i)) {
							choices.push("选项" + get.cnNumber(i, true));
						} else {
							choiceList[i - 1] = '<span style="opacity:0.5">' + choiceList[i - 1] + "</span>";
						}
					}
					const { control } = await player
						.chooseControl(choices)
						.set("choiceList", choiceList)
						.set("prompt", "晖云：选择一项，令" + get.translation(trigger.targets) + "可以选择执行")
						.set("ai", () => {
							return get.event().choice;
						})
						.set(
							"choice",
							(() => {
								if (choices.length == 1) {
									return choices[0];
								}
								const choicesx = choices.slice();
								if (get.attitude(player, trigger.targets[0]) > 0 && choices.includes("选项三")) {
									return "选项三";
								}
								choicesx.remove("选项三");
								return choicesx.randomGet();
							})()
						)
						.forResult();
					event.result = {
						bool: true,
						cost_data: control,
					};
				},
				async content(event, trigger, player) {
					const index = ["选项一", "选项二", "选项三"].indexOf(event.cost_data) + 1;
					game.log(player, "选择了", "#y" + event.cost_data);
					player.addTempSkill("olhuiyun_used", "roundStart");
					player.markAuto("olhuiyun_used", [index]);
					for (const target of trigger.targets.sortBySeat()) {
						if (!target.isIn()) {
							continue;
						}
						const cards = target.getCards("h", card => card.hasGaintag("olhuiyun_tag"));
						if (index == 1 && cards.length) {
							const result = await target
								.chooseToUse({
									filterCard(card) {
										if (get.itemtype(card) != "card" || !card.hasGaintag("olhuiyun_tag")) {
											return false;
										}
										return lib.filter.filterCard.apply(this, arguments);
									},
									prompt: "是否使用一张展示牌，然后重铸所有手牌？",
									addCount: false,
								})
								.forResult();
							if (result.bool) {
								const hs = target.getCards("h", lib.filter.cardRecastable);
								if (hs.length) {
									await target.recast(hs);
								}
							}
						} else if (index == 2) {
							const result = await target
								.chooseToUse({
									filterCard(card) {
										if (get.itemtype(card) != "card" || (get.position(card) != "h" && get.position(card) != "s")) {
											return false;
										}
										return lib.filter.filterCard.apply(this, arguments);
									},
									prompt: "是否使用一张手牌，然后重铸展示牌？",
									addCount: false,
								})
								.forResult();
							if (result.bool) {
								const hs = target.getCards("h", card => {
									if (!card.hasGaintag("olhuiyun_tag")) {
										return false;
									}
									return target.canRecast(card);
								});
								if (hs.length) {
									await target.recast(hs);
								}
							}
						} else if (index == 3) {
							const { bool } = await target
								.chooseBool("是否摸一张牌？")
								.set("ai", () => true)
								.forResult();
							if (bool) {
								await target.draw();
							}
						}
					}
				},
			},
			record: {
				trigger: { global: "showCardsEnd" },
				forced: true,
				charlotte: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					if (event.getParent().name != "huogong") {
						return false;
					}
					const card = event.getParent(2).card;
					return card?.storage?.olhuiyun;
				},
				content() {
					game.broadcastAll(cards => {
						cards.forEach(card => card.addGaintag("olhuiyun_tag"));
					}, trigger.cards);
				},
			},
		},
	},
};
