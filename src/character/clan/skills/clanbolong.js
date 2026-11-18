import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanbolong" | "clanzhongliu" | "clanlianzhu">} */
export const groupSkills = {
	//族王凌
	clanbolong: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target } = event;
			let result;
			const num = player.countCards("h");
			const str = "是否交给其" + get.cnNumber(num) + "张牌，然后视为你对其使用一张【酒】？或者点击“取消”，令其交给你一张牌，然后其视为对你使用一张雷【杀】。";

			if (!num || target.countCards("he") < num) {
				result = { bool: false };
			} else {
				result = await target
					.chooseCard(get.translation(player) + "对你发动了【驳龙】", str, num, "he")
					.set("ai", card => {
						if (_status.event.canGive) {
							return 5 + Math.max(0, 3 - _status.event.player.hp) / 1.5 - get.value(card);
						}
						return 0;
					})
					.set(
						"canGive",
						(() => {
							if (get.attitude(target, player) > 1) {
								return true;
							}
							if (!player.hasSha() && player.countCards("h") <= 4) {
								return true;
							}
							const sha = {
								name: "sha",
								nature: "thunder",
								isCard: true,
							};
							if (
								game.hasPlayer(current => {
									return player.canUse(sha, current, true, true) && get.effect(current, sha, player, target) < 0 && !current.countCards("hs", ["shan", "caochuan"]);
								})
							) {
								return false;
							}
							return true;
						})()
					)
					.forResult();
			}

			if (result.bool) {
				const cards = result.cards;
				await target.give(cards, player);
				if (lib.filter.targetEnabled2({ name: "jiu", isCard: true }, target, player)) {
					await target.useCard({ name: "jiu", isCard: true }, player, false);
				}
				return;
			}

			result = await player.chooseCard("驳龙：交给" + get.translation(target) + "一张牌", get.translation(target) + "拒绝给牌，请交给其一张牌然后视为对其使用一张雷【杀】", true, "he").forResult();

			if (result.bool) {
				const cards = result.cards;
				await player.give(cards, target);
				const sha = {
					name: "sha",
					nature: "thunder",
					isCard: true,
				};
				if (player.canUse(sha, target, false, false)) {
					await player.useCard(sha, target, false);
				}
			}
		},
		ai: {
			order(item, player) {
				return get.order({ name: "jiu" }) + 0.01;
			},
			threaten: 2,
			result: {
				target(player, target) {
					if (
						player.hasCard(card => {
							return get.value(card) < 5 && !["shan", "tao", "jiu", "wuxie", "caochuan"].includes(get.name(card));
						}, "he")
					) {
						return -1;
					}
					return 0;
				},
			},
		},
	},
	clanzhongliu: {
		audio: 2,
		audioname: ["clan_wangling", "clan_wangyun", "clan_wanghun", "clan_wanglun", "clan_wangguang", "clan_wangmingshan", "clan_wangchang", "clan_wangshen"],
		trigger: { player: "useCard" },
		forced: true,
		clanSkill: true,
		filter(event, player) {
			if (!event.cards.length) {
				return true;
			}
			return !game.hasPlayer2(current => {
				if (!current.hasClan("太原王氏") && current != player) {
					return false;
				}
				return current.hasHistory("lose", evt => {
					const evtx = evt.relatedEvent || evt.getParent();
					return evtx == event && evt.hs.length > 0;
				});
			});
		},
		async content(event, trigger, player) {
			player.refreshSkill();
		},
	},
	//族吴匡
	clanlianzhu: {
		audio: 2,
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage) {
				let str = "转换技。每名角色Ａ的出牌阶段限一次。";
				if (!storage) {
					str += "Ａ可以重铸一张牌，然后你可以重铸一张牌。若这两张牌颜色相同，则你的手牌上限+1。";
				} else {
					str += "Ａ可以令你选择一名在你或Ａ攻击范围内的另一名其他角色Ｂ，然后Ａ和你可依次选择是否对Ｂ使用一张【杀】。若这两张【杀】颜色不同，则你的手牌上限-1";
				}
				return str;
			},
		},
		global: "clanlianzhu_global",
		subSkill: {
			global: {
				forceaudio: true,
				audio: "clanlianzhu",
				enable: "phaseUse",
				filter: (event, player) => game.hasPlayer(current => lib.skill.clanlianzhu_global.filterTarget(null, player, current)),
				filterCard: (card, player) => game.hasPlayer(current => current.hasSkill("clanlianzhu") && !current.hasSkill("clanlianzhu_targeted") && !current.storage.clanlianzhu) && player.canRecast(card),
				selectCard: [0, 1],
				check(card) {
					return 5 - get.value(card);
				},
				filterTarget(card, player, target) {
					return (
						target.hasSkill("clanlianzhu") &&
						!target.hasSkill("clanlianzhu_targeted") &&
						(!target.storage.clanlianzhu ||
							(target.storage.clanlianzhu &&
								game.hasPlayer(current => {
									if (current == player || current == target) {
										return false;
									}
									return true;
								})))
					);
				},
				selectTarget() {
					const player = get.player();
					const count = game.countPlayer(current => lib.skill.clanlianzhu_global.filterTarget(null, player, current));
					return count == 1 ? -1 : 1;
				},
				filterOk() {
					const target = ui.selected.targets[0];
					if (!target) {
						return false;
					}
					if (!target.storage.clanlianzhu) {
						return ui.selected.cards.length == 1;
					}
					return ui.selected.cards.length == 0;
				},
				position: "he",
				discard: false,
				lose: false,
				delay: false,
				prompt() {
					const player = get.player();
					const bocchi = [],
						kita = [];
					game.countPlayer(target => {
						if (target.hasSkill("clanlianzhu") && !target.hasSkill("clanlianzhu_targeted")) {
							if (target.storage.clanlianzhu) {
								if (
									game.hasPlayer(current => {
										if (current == player || current == target) {
											return false;
										}
										return true;
									})
								) {
									kita.add(target);
								}
							} else {
								if (player.countCards("he") > 0) {
									bocchi.add(target);
								}
							}
						}
					});
					bocchi.sortBySeat();
					kita.sortBySeat();
					let str = "";
					if (bocchi.length) {
						str += "重铸一张牌，然后令";
						bocchi.forEach((current, i) => {
							str += get.translation(current);
							if (i < bocchi.length - 1) {
								str += "或";
							}
						});
						str += "选择是否重铸一张牌";
						if (kita.length) {
							str += "。<br>或者";
						}
					}
					if (kita.length) {
						str += "令";
						kita.forEach((current, i) => {
							str += get.translation(current);
							if (i < kita.length - 1) {
								str += "或";
							}
						});
						str += "选择一名目标，然后对其进行集火";
					}
					str += "。";
					return str;
				},
				async content(event, trigger, player) {
					const { cards, target } = event;
					let result;

					target.addTempSkill("clanlianzhu_targeted", "phaseUseAfter");
					target.changeZhuanhuanji("clanlianzhu");

					if (cards?.length) {
						await player.recast(cards);
						if (!target.countCards("he") && !_status.connectMode) {
							result = { bool: false };
						} else {
							result = await target.chooseCard("he", "联诛：是否重铸一张牌？", lib.filter.cardRecastable).forResult();
						}
						if (result?.bool) {
							await target.recast(result.cards);
							if (get.color(cards[0]) === get.color(result.cards[0])) {
								lib.skill.chenliuwushi.change(target, 1);
							}
						}
					} else {
						const targets = game.filterPlayer(current => {
							if (current == player || current == target) {
								return false;
							}
							return true;
						});

						if (!targets.length) {
							return;
						}

						result =
							targets.length == 1
								? { bool: true, targets }
								: await target
										.chooseTarget(`联诛：选择${player == target ? "你" : `${get.translation(player)}与你`}使用【杀】的目标`, true, (card, player, target) => {
											return get.event().targets?.includes(target);
										})
										.set("ai", target => {
											const player = get.player();
											return get.effect(target, { name: "sha" }, player, player);
										})
										.set("targets", targets)
										.forResult();

						if (!result?.bool) {
							return;
						}

						const targetx = result.targets[0];
						target.line(targetx);

						if (!event.isMine() && !event.isOnline()) {
							await game.delayx();
						}

						const users = [player, target];
						const usedCards = [];

						for (const current of users) {
							if (!current.isIn()) {
								continue;
							}
							result = await current
								.chooseToUse(
									function (card, player, event) {
										if (get.name(card) != "sha") {
											return false;
										}
										return lib.filter.filterCard.apply(this, arguments);
									},
									"联诛：是否对" + get.translation(targetx) + "使用一张杀？"
								)
								.set("targetRequired", true)
								.set("complexSelect", true)
								.set("complexTarget", true)
								.set("filterTarget", function (card, player, target) {
									if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
										return false;
									}
									return lib.filter.targetEnabled.apply(this, arguments);
								})
								.set("sourcex", targetx)
								.set("addCount", false)
								.forResult();

							if (result?.bool) {
								usedCards.push(result.card);
							}
						}
						const bool1 = usedCards.length == 0;
						const bool2 = usedCards.length == 2 && get.color(usedCards[0], false) === get.color(usedCards[1], false);
						if (!bool1 && !bool2) {
							lib.skill.chenliuwushi.change(target, -1);
						}
					}
				},
				ai: {
					order: 4.1,
					result: {
						player(player, target) {
							if (!target.storage.clanlianzhu && player.hasCard(card => get.value(card) < 5, "he")) {
								return 1;
							}
							return 0;
						},
						target(player, target) {
							if (target.storage.clanlianzhu && player.hasSha()) {
								return 1;
							}
							return 0;
						},
					},
				},
			},
			targeted: { charlotte: true },
		},
	},
};
