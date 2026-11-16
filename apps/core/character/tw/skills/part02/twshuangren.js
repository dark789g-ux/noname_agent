import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twshuangren" | "twxuanhuo" | "twenyuan" | "twenyuan1" | "twenyuan2">} */
export const groupSkills = {
	//纪灵
	twshuangren: {
		audio: "shuangren",
		trigger: { player: "phaseUseBegin" },
		filter(event, player, name) {
			if (!player.countCards("h")) {
				return false;
			}
			if (name == "phaseUseEnd") {
				return !player.hasHistory("sourceDamage", function (evt) {
					return evt.card.name == "sha" && event.getParent("phaseUse") == evt;
				});
			}
			return true;
		},
		direct: true,
		group: "twshuangren_end",
		preHidden: true,
		content() {
			"step 0";
			var forced =
				event.getParent(2).name == "twshuangren_end" &&
				game.hasPlayer(current => {
					return player.canCompare(current);
				});
			var str = "与一名角色拼点，若你：赢，你可以视为对至多两名至其的距离不大于1的角色使用一张【杀】；没赢，其可以视为对你使用一张【杀】";
			player
				.chooseTarget(forced ? "双刃：选择一名角色" : get.prompt("twshuangren"), str, forced, (card, player, target) => {
					return player.canCompare(target);
				})
				.set("ai", target => {
					if (_status.event.goon) {
						return get.effect(target, { name: "sha" }, _status.event.player);
					}
					return 0;
				})
				.set("goon", event.triggername != "phaseUseBegin" || (player.countCards("hs", "sha") > 0 && player.hasValueTarget({ name: "sha" })));
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twshuangren", target);
				if (player.canCompare(target)) {
					player.chooseToCompare(target);
				} else {
					event.finish();
				}
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				event.sha = true;
				player
					.chooseTarget([1, 2], "请选择【杀】的目标", true, function (card, player, target) {
						if (!player.canUse("sha", target, false, false)) {
							return false;
						}
						return get.distance(target, _status.event.targetx) <= 1;
					})
					.set("ai", function (target) {
						var player = _status.event.player;
						return get.effect(target, { name: "sha" }, player, player);
					})
					.set("targetx", target);
			} else {
				target
					.chooseBool("双刃：是否视为对" + get.translation(player) + "使用一张杀？")
					.set("choice", get.effect(player, { name: "sha" }, target, target) > 0);
			}
			"step 3";
			if (result.bool) {
				if (event.sha == true) {
					result.targets.sortBySeat();
					for (var i of result.targets) {
						player.useCard({ name: "sha", isCard: true }, i, false);
					}
				} else {
					target.useCard({ name: "sha", isCard: true }, player, false);
				}
			}
		},
		subSkill: {
			end: {
				audio: "shuangren",
				trigger: { player: "phaseUseEnd" },
				filter(event, player, name) {
					if (!player.countCards("h")) {
						return false;
					}
					return (
						!player.hasHistory("useSkill", function (evt) {
							return evt.skill == "twshuangren";
						}) &&
						!player.hasHistory("sourceDamage", function (evt) {
							return evt.card && evt.card.name == "sha";
						})
					);
				},
				direct: true,
				preHidden: true,
				content() {
					"step 0";
					player
						.chooseToDiscard(get.prompt("twshuangren"), "弃置一张牌发动〖双刃〗", "he")
						.set("ai", function (card) {
							if (_status.event.goon) {
								return 5 - get.value(card);
							}
							return 0;
						})
						.set(
							"goon",
							(function () {
								return player.hasCard(function (card) {
									if (player.needsToDiscard() > 1) {
										return card.number > 10 && get.value(card) <= 5;
									}
									return (card.number >= 9 && get.value(card) <= 5) || get.value(card) <= 3;
								});
							})()
						)
						.setHiddenSkill("twshuangren")
						.set("logSkill", "twshuangren");
					"step 1";
					if (result.bool) {
						player.useSkill("twshuangren");
					}
				},
			},
		},
	},
	//法正
	twxuanhuo: {
		audio: "xuanhuo",
		trigger: { player: "phaseDrawEnd" },
		filter(event, player) {
			return player.countCards("he") > 1 && game.countPlayer() > 2;
		},
		direct: true,
		content() {
			"step 0";
			var ai2 = function (target) {
				var player = _status.event.player;
				if (get.attitude(player, target) <= 0) {
					return 0;
				}
				var list = ["sha", "juedou"];
				var num = Math.max.apply(
					Math,
					list.map(function (i) {
						return target.getUseValue({ name: i, isCard: true }, false);
					})
				);
				if (target.hasSkillTag("nogain")) {
					num /= 4;
				}
				return num;
			};
			player.chooseCardTarget({
				prompt: get.prompt2("twxuanhuo"),
				filterCard: true,
				selectCard: 2,
				position: "he",
				filterTarget: lib.filter.notMe,
				goon: game.hasPlayer(function (current) {
					return current != player && ai2(player, current) > 0;
				}),
				ai1(card) {
					if (!_status.event.goon) {
						return 0;
					}
					return 7 - get.value(card);
				},
				ai2: ai2,
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("twxuanhuo", target);
				player.give(result.cards, target);
			} else {
				event.finish();
			}
			"step 2";
			if (
				game.hasPlayer(function (current) {
					return current != player && current != target;
				})
			) {
				player
					.chooseTarget(
						function (card, player, target) {
							return target != player && target != _status.event.target;
						},
						"选择" + get.translation(target) + "使用【杀】或【决斗】的目标",
						true
					)
					.set("target", target)
					.set("ai", function (target) {
						var evt = _status.event;
						var list = ["sha", "juedou"];
						return Math.max.apply(
							Math,
							list.map(function (i) {
								var card = { name: i, isCard: true };
								if (!evt.target.canUse(card, target, false)) {
									return 0;
								}
								return get.effect(target, card, evt.target, evt.player);
							})
						);
					});
			} else {
				event.finish();
			}
			"step 3";
			var target2 = result.targets[0];
			event.target2 = target2;
			player.line(target2);
			var vcards = [];
			if (target.canUse({ name: "sha", isCard: true }, target2, false)) {
				vcards.push(["基本", "", "sha"]);
			}
			if (target.canUse({ name: "juedou", isCard: true }, target2, false)) {
				vcards.push(["锦囊", "", "juedou"]);
			}
			if (!vcards.length) {
				if (!target.countCards("h")) {
					event.finish();
				} else {
					event._result = { index: 1 };
				}
			} else if (!target.countCards("h")) {
				event.vcards = vcards;
				event._result = { index: 0 };
			} else {
				event.vcards = vcards;
				target
					.chooseControl()
					.set("choiceList", [
						"视为对" + get.translation(target2) + "使用一张【杀】或【决斗】",
						"令" + get.translation(player) + "获得你的两张牌",
					]);
			}
			"step 4";
			if (result.index == 0) {
				if (event.vcards.length == 1) {
					event._result = { links: event.vcards, bool: true };
				} else {
					target
						.chooseButton(["请选择要对" + get.translation(event.target2) + "使用的牌", [event.vcards, "vcard"]], true)
						.set("ai", function (button) {
							var player = _status.event.player;
							return get.effect(_status.event.getParent().target2, { name: button.link[2], isCard: true }, player, player);
						});
				}
			} else {
				player.gainPlayerCard(target, 2, "he", true);
				event.finish();
			}
			"step 5";
			if (result.bool) {
				target.useCard({ name: result.links[0][2], isCard: true }, false, event.target2);
			}
		},
		ai: {
			expose: 0.15,
		},
	},
	twenyuan: {
		audio: "enyuan",
		group: ["twenyuan1", "twenyuan2"],
	},
	twenyuan1: {
		audio: ["enyuan1.mp3", "enyuan2.mp3"],
		trigger: { player: "gainAfter", global: "loseAsyncAfter" },
		sourceSkill: "twenyuan",
		filter(event, player, triggername, target) {
			return target?.isIn();
		},
		getIndex(event, player) {
			return game
				.filterPlayer(current => {
					if (current == player) {
						return false;
					}
					return event.getl?.(current)?.cards2?.filter(card => event.getg?.(player)?.includes(card)).length >= 2;
				})
				.sortBySeat();
		},
		async cost(event, trigger, player) {
			const { indexedData: target } = event;
			const list = ["摸一张牌"];
			let prompt2 = "令" + get.translation(target) + "摸一张牌";
			if ((!target.countCards("h") || !target.countCards("e")) && target.isDamaged()) {
				list.push("回复1点体力");
				prompt2 += "或回复1点体力";
			}
			list.push("cancel2");
			const { control } = await player
				.chooseControl(list)
				.set("prompt", get.prompt(event.skill, target))
				.set("prompt2", prompt2)
				.set("ai", () => get.event().choice)
				.set(
					"choice",
					(() => {
						if (get.attitude(player, target) > 0) {
							if (
								get.recoverEffect(target, player, player) >= get.effect(target, { name: "draw" }, player, player) &&
								list.includes("回复1点体力")
							) {
								return "回复1点体力";
							}
							return 0;
						}
						return "cancel2";
					})()
				)
				.forResult();
			event.result = {
				bool: control !== "cancel2",
				cost_data: control,
				targets: [target],
			};
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data,
			} = event;
			await target[cost_data == "回复1点体力" ? "recover" : "draw"]();
		},
	},
	twenyuan2: {
		audio: ["enyuan3.mp3", "enyuan4.mp3"],
		inherit: "xinenyuan2",
		sourceSkill: "twenyuan",
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
};
