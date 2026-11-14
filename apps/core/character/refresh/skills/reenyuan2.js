import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const reenyuan2Skills = {
	reenyuan2: {
		audio: "reenyuan",
		inherit: "xinenyuan2",
		sourceSkill: "reenyuan",
		prompt2: event => `令${get.translation(event.source)}选择一项：1.失去1点体力；2.交给你一张手牌，若此牌的花色不为♥，你摸一张牌。`,
		async content(event, trigger, player) {
			const result = await trigger.source
				.chooseToGive(`恩怨：交给${get.translation(player)}一张手牌，或失去1点体力`, "h", player)
				.set("ai", card => {
					const { player, target } = get.event();
					if (get.attitude(player, target) > 0) {
						if (get.suit(card) != "heart") {
							return 15 - get.value(card);
						}
						return 11 - get.value(card);
					} else {
						let num = 12 - player.hp * 2;
						if (get.suit(card) != "heart") {
							num -= 2;
						}
						return num - get.value(card);
					}
				})
				.forResult();
			if (!result?.bool || !result?.cards?.length) {
				await trigger.source.loseHp();
			} else if (result?.cards?.length && get.suit(result.cards[0]) !== "heart") {
				await player.draw();
			}
		},
	},
	rexuanhuo: {
		audio: 2,
		trigger: { player: "phaseDrawEnd" },
		filter(event, player) {
			return player.countCards("h") > 1 && game.countPlayer() > 2;
		},
		async cost(event, trigger, player) {
			const ai2 = function (target) {
				const player = get.player();
				if (get.attitude(player, target) <= 0) {
					return 0;
				}
				const list = [null, "juedou"].concat(lib.inpile_nature);
				if (target.hasSkill("ayato_zenshen")) {
					list.push("kami");
				}
				let num = Math.max.apply(
					Math,
					list.map(function (i) {
						if (i == "juedou") {
							return target.getUseValue({ name: "juedou", isCard: true }, false);
						}
						const card = { name: "sha", nature: i, isCard: true };
						return target.getUseValue(card, false);
					})
				);
				if (target.hasSkillTag("nogain")) {
					num /= 4;
				}
				return num;
			};
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt2(event.skill),
					filterCard: true,
					selectCard: 2,
					position: "h",
					filterTarget: lib.filter.notMe,
					goon: game.hasPlayer(current => {
						return current != player && ai2(current) > 0;
					}),
					ai1(card) {
						if (!_status.event.goon) {
							return 0;
						}
						return 7 - get.value(card);
					},
					ai2,
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.give(event.cards, target);
			let result;
			const targets = game.filterPlayer(current => {
				return current != player && current != target;
			});
			if (!targets.length) {
				return;
			}
			result =
				targets.length == 1
					? { bool: true, targets }
					: await player
							.chooseTarget(
								(card, player, target) => {
									return _status.event.targets?.includes(target);
								},
								`选择${get.translation(target)}使用【杀】或【决斗】的目标`,
								true
							)
							.set("target", target)
							.set("ai", target => {
								const evt = _status.event;
								const list = [null, "juedou"].concat(lib.inpile_nature);
								if (evt.target.hasSkill("ayato_zenshen")) {
									list.push("kami");
								}
								return Math.max.apply(
									Math,
									list.map(item => {
										const card = { name: "sha", isCard: true };
										if (item == "juedou") {
											card.name = "juedou";
										} else if (item) {
											card.nature = item;
										}
										if (!evt.target.canUse(card, target, false)) {
											return 0;
										}
										return get.effect(target, card, evt.target, evt.player);
									})
								);
							})
							.set("targets", targets)
							.forResult();
			if (!result?.bool) {
				return;
			}
			const target2 = result.targets[0];
			event.target2 = target2;
			player.line(target2);
			game.log(player, "选择了", target2);
			const list = lib.inpile_nature.slice(0);
			list.unshift(null);
			let vcards = [];
			if (target.hasSkill("ayato_zenshen")) {
				list.add("kami");
			}
			vcards = list
				.filter(nature => target.canUse({ name: "sha", isCard: true, nature }, target2, false))
				.map(nature => {
					return ["基本", "", "sha", nature];
				});
			if (target.canUse({ name: "juedou", isCard: true }, target2, false)) {
				vcards.push(["基本", "", "juedou"]);
			}
			if (!vcards.length) {
				if (!target.countCards("h")) {
					return;
				} else {
					result = { index: 1 };
				}
			} else if (!target.countCards("h")) {
				result = { index: 0 };
			} else {
				result = await target
					.chooseControl()
					.set("choiceList", [`视为对${get.translation(target2)}使用任意一种【杀】或【决斗】`, `将所有手牌交给${get.translation(player)}`])
					.forResult();
			}
			if (result?.index == 0) {
				result = await target
					.chooseButton([`眩惑：请选择要对${get.translation(target2)}使用的牌`, [vcards, "vcard"]], true)
					.set("target", target2)
					.set("direct", true)
					.set("ai", button => {
						const { player, target } = get.event();
						return get.effect(target, { name: button.link[2], isCard: true, nature: button.link[3] }, player, player);
					})
					.forResult();
				if (result?.bool) {
					await target.useCard({ name: result.links[0][2], isCard: true, nature: result.links[0][3] }, false, target2);
				}
			} else if (result?.index == 1) {
				await target.give(target.getCards("h"), player, "giveAuto");
			}
		},
		ai: {
			expose: 0.17,
			fireAttack: true,
			skillTagFilter(player) {
				return player.hasFriend();
			},
		},
	},
	decadezongshi: {
		audio: 2,
		mod: {
			maxHandcard(player, num) {
				return num + game.countGroup();
			},
		},
		trigger: { target: "useCardToTargeted" },
		forced: true,
		filter(event, player) {
			return player != _status.currentPhase && player.countCards("h") >= player.getHandcardLimit() && (get.type(event.card) == "delay" || get.color(event.card) == "none");
		},
		async content(event, trigger, player) {
			trigger.excluded.add(player);
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (target != _status.currentPhase && target.countCards("h") >= target.getHandcardLimit() && (get.type(card) == "delay" || get.color(card) == "none")) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	decadezishou: {
		audio: 2,
		inherit: "rezishou",
		group: "decadezishou_zhiheng",
		ai: {
			threaten: 1.8,
		},
	},
	decadezishou_zhiheng: {
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		sourceSkill: "decadezishou",
		filter(event, player) {
			return (
				player.countCards("h") > 0 &&
				!player.getHistory("useCard", function (evt) {
					return (
						evt.targets.filter(function (target) {
							return target != player;
						}).length > 0
					);
				}).length
			);
		},
		async content(event, trigger, player) {
			// step 0
			var list = [];
			var hs = player.getCards("h");
			for (var i of hs) {
				list.add(get.suit(i, player));
			}
			const result = await player
				.chooseToDiscard("h", get.prompt("decadezishou"), "弃置任意张花色不同的手牌并摸等量的牌", [1, list.length], function (card, player) {
					if (ui.selected.cards.length) {
						var suit = get.suit(card, player);
						for (var i of ui.selected.cards) {
							if (get.suit(i, player) == suit) {
								return false;
							}
						}
					}
					return true;
				})
				.set("ai", lib.skill.zhiheng.check)
				.set("complexCard", true)
				.forResult();
			if (result.bool) {
				player.logSkill("decadezishou");
				// step 1
				await player.draw(result.cards.length);
			}
		},
	},
};
