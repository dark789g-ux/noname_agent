import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const refangzhuSkills = {
	refangzhu: {
		audio: 2,
		trigger: {
			player: "damageEnd",
		},
		direct: true,
		async content(event, trigger, player) {
			let result;
			// step 0
			let next = player.chooseTarget(get.prompt2("refangzhu"), function (card, player, target) {
				return player != target;
			});
			next.ai = function (target) {
				if (target.hasSkillTag("noturn")) {
					return 0;
				}
				var player = _status.event.player;
				if (get.attitude(_status.event.player, target) == 0) {
					return 0;
				}
				if (get.attitude(_status.event.player, target) > 0) {
					if (target.classList.contains("turnedover")) {
						return 1000 - target.countCards("h");
					}
					if (player.getDamagedHp() < 3) {
						return -1;
					}
					return 100 - target.countCards("h");
				} else {
					if (target.classList.contains("turnedover")) {
						return -1;
					}
					if (player.getDamagedHp() >= 3) {
						return -1;
					}
					return 1 + target.countCards("h");
				}
			};
			result = await next.forResult();

			// step 1
			if (result.bool) {
				player.logSkill("refangzhu", result.targets);
				event.target = result.targets[0];
				if (player.isHealthy()) {
					result = { bool: false };
				} else {
					let next2 = event.target.chooseToDiscard("he", player.getDamagedHp());
					next2.set("ai", function (card) {
						var player = _status.event.player;
						if (player.isTurnedOver() || _status.event.getTrigger().player.getDamagedHp() > 2) {
							return -1;
						}
						return player.hp * player.hp - get.value(card);
					});
					next2.set("prompt", "弃置" + get.cnNumber(player.getDamagedHp()) + "张牌并失去1点体力；或选择不弃置，将武将牌翻面并摸" + get.cnNumber(player.getDamagedHp()) + "张牌。");
					result = await next2.forResult();
				}
			} else {
				return;
			}

			// step 2
			if (result.bool) {
				await event.target.loseHp();
			} else {
				if (player.isDamaged()) {
					await event.target.draw(player.getDamagedHp()).forResult();
				}
				await event.target.turnOver().forResult();
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -1.5];
						}
						if (target.hp <= 1) {
							return;
						}
						if (!target.hasFriend()) {
							return;
						}
						var hastarget = false;
						var turnfriend = false;
						var players = game.filterPlayer();
						for (var i = 0; i < players.length; i++) {
							if (get.attitude(target, players[i]) < 0 && !players[i].isTurnedOver()) {
								hastarget = true;
							}
							if (get.attitude(target, players[i]) > 0 && players[i].isTurnedOver()) {
								hastarget = true;
								turnfriend = true;
							}
						}
						if (get.attitude(player, target) > 0 && !hastarget) {
							return;
						}
						if (turnfriend || target.hp == target.maxHp) {
							return [0.5, 1];
						}
						if (target.hp > 1) {
							return [1, 0.5];
						}
					}
				},
			},
		},
	},
	repolu: {
		audio: 1,
		trigger: {
			source: "dieAfter",
			player: "die",
		},
		forceDie: true,
		filter(event, player, name) {
			return name == "die" || player.isIn();
		},
		direct: true,
		async content(event, trigger, player) {
			let result;

			// step 0
			if (!player.storage.repolu) {
				player.storage.repolu = 0;
			}
			event.num = player.storage.repolu + 1;
			result = await player
				.chooseTarget([1, Infinity], get.prompt("repolu"), "令任意名角色摸" + get.cnNumber(event.num) + "张牌")
				.set("forceDie", true)
				.set("ai", target => {
					return get.attitude(_status.event.player, target);
				})
				.forResult();

			// step 1
			if (result.bool) {
				player.storage.repolu++;
				result.targets.sortBySeat();
				player.logSkill("repolu", result.targets);
				await game.asyncDraw(result.targets, event.num);
			} else {
				return;
			}

			// step 2
			await game.delay();
		},
	},
	oljiuchi: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "jiu") {
					return Infinity;
				}
			},
		},
		audio: 2,
		enable: "chooseToUse",
		filterCard(card) {
			return get.suit(card) == "spade";
		},
		viewAs: { name: "jiu" },
		position: "hs",
		viewAsFilter(player) {
			return player.hasCard(card => get.suit(card) == "spade", "hs");
		},
		prompt: "将一张黑桃手牌当酒使用",
		check(cardx, player) {
			if (player && player == cardx.player) {
				return true;
			}
			if (_status.event.type == "dying") {
				return 1;
			}
			var player = _status.event.player;
			var shas = player.getCards("hs", function (card) {
				return card != cardx && get.name(card, player) == "sha";
			});
			if (!shas.length) {
				return -1;
			}
			if (shas.length > 1 && (player.getCardUsable("sha") > 1 || player.countCards("hs", "zhuge"))) {
				return 0;
			}
			shas.sort(function (a, b) {
				return get.order(b) - get.order(a);
			});
			var card = false;
			if (shas.length) {
				for (var i = 0; i < shas.length; i++) {
					if (shas[i] != cardx && lib.filter.filterCard(shas[i], player)) {
						card = shas[i];
						break;
					}
				}
			}
			if (card) {
				if (
					game.hasPlayer(function (current) {
						return (
							get.attitude(player, current) < 0 &&
							!current.hasShan() &&
							current.hp + current.countCards("h", { name: ["tao", "jiu"] }) > 1 + (player.storage.jiu || 0) &&
							player.canUse(card, current, true, true) &&
							!current.hasSkillTag("filterDamage", null, {
								player: player,
								card: card,
								jiu: true,
							}) &&
							get.effect(current, card, player) > 0
						);
					})
				) {
					return 4 - get.value(cardx);
				}
			}
			return -1;
		},
		ai: {
			threaten: 1.5,
		},
		trigger: { source: "damageEnd" },
		locked: false,
		forced: true,
		filter(event, player) {
			if (event.name == "chooseToUse") {
				return player.hasCard(card => get.suit(card) == "spade", "hs");
			}
			return event.card && event.card.name == "sha" && event.getParent(2).jiu == true && !player.isTempBanned("benghuai");
		},
		async content(event, trigger, player) {
			player.logSkill("oljiuchi");
			player.tempBanSkill("benghuai");
		},
	},
	rezaiqi: {
		audio: 2,
		direct: true,
		filter(event, player) {
			return lib.skill.rezaiqi.count() > 0;
		},
		trigger: {
			player: "phaseJieshuBegin",
		},
		async content(event, trigger, player) {
			let result;

			// step 0
			result = await player
				.chooseTarget([1, lib.skill.rezaiqi.count()], get.prompt2("rezaiqi"))
				.set("ai", function (target) {
					return get.attitude(_status.event.player, target);
				})
				.forResult();

			// step 1
			if (result.bool) {
				var targets = result.targets;
				targets.sortBySeat();
				player.line(targets, "fire");
				player.logSkill("rezaiqi", targets);
				event.targets = targets;
			} else {
				return;
			}

			// step 2 & 3 (loop through targets)
			while (event.targets.length) {
				event.current = event.targets.shift();
				if (player.isHealthy()) {
					result = { index: 0 };
				} else {
					result = await event.current
						.chooseControl()
						.set("choiceList", ["摸一张牌", "令" + get.translation(player) + "回复1点体力"])
						.set("ai", function () {
							if (get.attitude(event.current, player) > 0) {
								return 1;
							}
							return 0;
						})
						.forResult();
				}

				if (result.index == 1) {
					event.current.line(player);
					await player.recover(event.current);
				} else {
					await event.current.draw();
				}
				await game.delay();
			}
		},
		count: () => get.discarded().filter(card => get.color(card) === "red").length,
	},
};
