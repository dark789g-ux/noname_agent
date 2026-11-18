import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twzuhuo" | "twzhouzu" | "twhuangjin" | "twguimen" | "twdidao" | "twlingfa" | "twlingfa_sha">} */
export const groupSkills = {
	twzuhuo: {
		mahouSkill: true,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return !player.hasSkill("twzuhuo_mahou") && player.countCards("he", lib.skill.twzuhuo.filterCard) > 0;
		},
		filterCard(card) {
			return get.type(card) != "basic";
		},
		position: "he",
		check(card) {
			return 7 - get.value(card);
		},
		content() {
			"step 0";
			player
				.chooseControl("1回合", "2回合", "3回合")
				.set("prompt", "请选择施法时长")
				.set("ai", function () {
					var player = _status.event.player;
					var safe = Math.min(player.getHandcardLimit(), player.countCards("h", "shan"));
					if (safe < Math.min(3, game.countPlayer())) {
						var next = player.next;
						while (next != player && get.attitude(next, player) > 0) {
							safe++;
							next = next.next;
						}
					}
					return Math.max(2, Math.min(safe, 3, game.countPlayer())) - 1;
				});
			"step 1";
			player.storage.twzuhuo_mahou = [result.index + 1, result.index + 1];
			player.addTempSkill("twzuhuo_mahou", { player: "die" });
		},
		ai: {
			order: 2,
			result: {
				player: 1,
			},
		},
		subSkill: {
			mahou: {
				trigger: { global: "phaseEnd" },
				forced: true,
				popup: false,
				charlotte: true,
				content() {
					var list = player.storage.twzuhuo_mahou;
					list[1]--;
					if (list[1] == 0) {
						game.log(player, "的“阻祸”魔法生效");
						player.logSkill("twzuhuo");
						var num = list[0];
						player.addSkill("twzuhuo_effect");
						player.addMark("twzuhuo_effect", num, false);
						player.removeSkill("twzuhuo_mahou");
					} else {
						game.log(player, "的“阻祸”魔法剩余", "#g" + list[1] + "回合");
						player.markSkill("twzuhuo_mahou");
					}
				},
				mark: true,
				onremove: true,
				marktext: "♗",
				intro: {
					name: "施法：阻祸",
					markcount(storage) {
						if (storage) {
							return storage[1];
						}
						return 0;
					},
					content(storage) {
						if (storage) {
							return "经过" + storage[1] + "个“回合结束时”后，获得" + storage[0] + "层“防止一次伤害”的效果";
						}
						return "未指定施法效果";
					},
				},
			},
			effect: {
				charlotte: true,
				onremove: true,
				trigger: { player: "damageBegin2" },
				forced: true,
				filter(event, player) {
					return player.hasMark("twzuhuo_effect");
				},
				content() {
					trigger.cancel();
					player.removeMark("twzuhuo_effect", 1, false);
					if (!player.countMark("twzuhuo_effect")) {
						player.removeSkill("twzuhuo_effect");
					}
				},
				marktext: "阻︎",
				intro: {
					onremove: true,
					content: "防止接下来的#次伤害",
				},
			},
		},
	},
	twzhouzu: {
		enable: "phaseUse",
		usable: 1,
		mahouSkill: true,
		filter(event, player) {
			return !player.hasSkill("twzhouzu_mahou");
		},
		filterTarget(card, player, target) {
			return player != target;
		},
		line: false,
		delay: false,
		content() {
			"step 0";
			player
				.chooseControl("1回合", "2回合", "3回合")
				.set("prompt", "请选择施法时长")
				.set("ai", function () {
					var player = _status.event.player;
					var safe = 1;
					if (safe < Math.min(3, game.countPlayer())) {
						var next = player.next;
						while (next != player && get.attitude(next, player) > 0) {
							safe++;
							next = next.next;
						}
					}
					return Math.max(2, Math.min(safe, 3, game.countPlayer())) - 1;
				});
			"step 1";
			player.storage.twzhouzu_mahou = [result.index + 1, result.index + 1, target];
			player.addTempSkill("twzhouzu_mahou", { player: "die" });
		},
		subSkill: {
			mahou: {
				trigger: {
					global: "phaseEnd",
				},
				forced: true,
				popup: false,
				charlotte: true,
				content() {
					var list = player.storage.twzhouzu_mahou;
					list[1]--;
					if (list[1] == 0) {
						game.log(player, "的“咒诅”魔法生效");
						var num = list[0],
							target = list[2];
						player.logSkill("twzhouzu", target);
						target.chooseToDiscard(
							get.translation(player) + "对你的“咒诅”魔法生效，请弃置" + get.cnNumber(list[0]) + "张牌",
							list[0],
							true
						);
						target.damage("thunder");
						player.removeSkill("twzhouzu_mahou");
					} else {
						game.log(player, "的“咒阻”魔法剩余", "#g" + list[1] + "回合");
						player.markSkill("twzhouzu_mahou");
					}
				},
				mark: true,
				onremove: true,
				marktext: "♗",
				intro: {
					name: "施法：咒诅",
					markcount(storage) {
						if (storage) {
							return storage[1];
						}
						return 0;
					},
					content(storage) {
						if (storage) {
							return (
								"经过" +
								storage[1] +
								"个“回合结束时”后，你令" +
								get.translation(storage[2]) +
								"弃置" +
								get.cnNumber(storage[0]) +
								"张牌，然后你对其造成1点雷电伤害"
							);
						}
						return "未指定施法效果";
					},
				},
			},
		},
		ai: {
			order: 1,
			result: {
				target: -5,
			},
		},
	},
	twhuangjin: {
		trigger: { target: "useCardToTarget" },
		forced: true,
		logTarget: "player",
		filter(event, player) {
			return event.card.name == "sha" && typeof get.number(event.card) == "number";
		},
		content() {
			"step 0";
			player.judge(function (result) {
				var evt = _status.event.getTrigger();
				if (Math.abs(get.number(result) - get.number(evt.card)) <= 1) {
					return 2;
				}
				return -1;
			}).judge2 = function (result) {
				return result.bool;
			};
			"step 1";
			if (result.bool) {
				trigger.getParent().excluded.add(player);
			}
		},
		ai: {
			effect: {
				target_use(card, player, target, current, isLink) {
					if (card.name == "sha" && !isLink) {
						return 0.8;
					}
				},
			},
		},
	},
	twguimen: {
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		direct: true,
		filter(event, player) {
			if (event.type != "discard") {
				return false;
			}
			var evt = event.getl(player);
			for (var card of evt.cards2) {
				if (get.suit(card, player) == "spade") {
					return true;
				}
			}
			return false;
		},
		forced: true,
		content() {
			"step 0";
			var cards = [];
			var evt = trigger.getl(player);
			for (var card of evt.cards2) {
				if (get.suit(card, player) == "spade") {
					cards.push(card);
				}
			}
			if (!cards.length) {
				event.finish();
			} else {
				event.cards = cards;
			}
			"step 1";
			if (event.cards.length == 1) {
				event._result = { bool: true, links: event.cards };
			} else {
				player.chooseButton(["鬼门：选择一张♠牌，为其进行判定", event.cards], true);
			}
			"step 2";
			if (result.bool && result.links) {
				event.judgingSpade = result.links[0];
				event.cards.remove(event.judgingSpade);
				game.log(player, "选择", "#y" + get.translation(event.judgingSpade), "进行判定");
				player.judge(function (result) {
					var card = _status.event.getParent().judgingSpade;
					if (Math.abs(get.number(result) - get.number(card)) <= 1) {
						return 4;
					}
					return -1;
				}).judge2 = function (result) {
					return result.bool;
				};
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool && game.hasPlayer(current => current != player)) {
				player
					.chooseTarget("选择一名其他角色，对其造成2点雷电伤害", lib.filter.notMe, true)
					.set("ai", target => get.damageEffect(target, player, player, "thunder"));
			}
			"step 4";
			if (result.bool) {
				player.line(result.targets[0], "thunder");
				result.targets[0].damage(2, "thunder");
			}
			if (event.cards.length) {
				event.goto(1);
			}
		},
	},
	twdidao: {
		trigger: { global: "judge" },
		filter(event, player) {
			return player.countCards("hes");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(
					`${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，${get.prompt(event.skill)}`,
					"hes",
					card => {
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
					}
				)
				.set("ai", card => {
					const trigger = get.event().getTrigger();
					const { player, judging } = get.event();
					const result = trigger.judge(card) - trigger.judge(judging);
					const attitude = get.attitude(player, trigger.player);
					if (attitude == 0 || result == 0) {
						if (trigger.player != player) {
							return 0;
						}
						const checkx = get.color(card, player) == get.color(judging);
						if (checkx > 0) {
							return checkx;
						}
						return 0;
					}
					return result * (attitude > 0 ? 1 : -1);
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
				player.$gain2(trigger.player.judging[0]);
				await player.gain(trigger.player.judging[0]);
				const card = cards[0];
				if (get.color(card, player) == get.color(trigger.player.judging[0])) {
					await player.draw("nodelay");
				}
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
	//群曹操
	twlingfa: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			const skill = "twlingfa";
			return (
				game.roundNumber < 3 ||
				(player.hasSkill(skill, null, false, false) && !lib.skill[skill].derivation.every(i => player.hasSkill(i, null, false, false)))
			);
		},
		prompt2(event, player) {
			const skill = "twlingfa";
			switch (game.roundNumber) {
				case 1:
					return "本轮其他角色使用【杀】时，若其有牌，则其需弃置一张牌，否则你对其造成1点伤害";
				case 2:
					return "本轮其他角色使用【桃】结算结束后，若其有牌，则其需交给你一张牌，否则你对其造成1点伤害";
				default:
					return `失去【${get.translation(skill)}】并获得${lib.skill[skill].derivation.map(i => "【" + get.translation(i) + "】").join("、")}`;
			}
		},
		async content(event, trigger, player) {
			switch (game.roundNumber) {
				case 1:
					player.line(game.filterPlayer(current => current != player).sortBySeat());
					player.addTempSkill(`${event.name}_sha`, "roundStart");
					break;
				case 2:
					player.line(game.filterPlayer(current => current != player).sortBySeat());
					player.addTempSkill(`${event.name}_tao`, "roundStart");
					break;
				default:
					await player.changeSkills(lib.skill[event.name].derivation, [event.name]);
					break;
			}
		},
		derivation: ["twzhian"],
	},
	twlingfa_sha: {
		audio: "twlingfa",
		trigger: { global: "useCard" },
		charlotte: true,
		forced: true,
		filter(event, player) {
			return player != event.player && event.card.name == "sha" && event.player.countCards("he") > 0;
		},
		logTarget: "player",
		content() {
			"step 0";
			game.delayx();
			trigger.player
				.chooseToDiscard("he", "令法：弃置一张牌，或受到来自" + get.translation(player) + "的1点伤害")
				.set("goon", get.damageEffect(trigger.player, player, trigger.player) < 0)
				.set("ai", function (card) {
					if (!_status.event.goon) {
						return 0;
					}
					return 8 - get.value(card);
				});
			"step 1";
			if (!result.bool) {
				trigger.player.damage();
			}
		},
		mark: true,
		marktext: '<span style="text-decoration: line-through;">杀</span>',
		intro: { content: "其他角色使用【杀】时，若其有牌，则其需弃置一张牌，否则你对其造成1点伤害。" },
		sourceSkill: "twlingfa",
	},
};
