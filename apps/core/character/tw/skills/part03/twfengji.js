import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twfengji" | "twyiju" | "twbudao" | "twzhouhu" | "twharvestinori">} */
export const groupSkills = {
	//张曼成
	twfengji: {
		audio: 2,
		mahouSkill: true,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return !player.getExpansions("twfengji").length && !player.hasSkill("twfengji_mahou") && player.countCards("he");
		},
		direct: true,
		content() {
			"step 0";
			player.chooseCard("he", get.prompt2("twfengji")).set("ai", function (card) {
				var name = card.name,
					num = 0;
				for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
					if (ui.cardPile.childNodes[i].name == name) {
						num++;
					}
				}
				if (num < 2) {
					return false;
				}
				return 8 - get.value(card);
			});
			"step 1";
			if (result.bool) {
				player.logSkill("twfengji");
				player.addToExpansion(result.cards, player, "giveAuto").gaintag.add("twfengji");
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
			} else {
				event.finish();
			}
			"step 2";
			player.storage.twfengji_mahou = [result.index + 1, result.index + 1];
			player.addTempSkill("twfengji_mahou", { player: "die" });
		},
		marktext: "示",
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		subSkill: {
			mahou: {
				trigger: { global: "phaseEnd" },
				forced: true,
				popup: false,
				charlotte: true,
				content() {
					var list = player.storage.twfengji_mahou;
					list[1]--;
					if (list[1] == 0) {
						game.log(player, "的“蜂集”魔法生效");
						player.logSkill("twfengji");
						var cards = player.getExpansions("twfengji");
						if (cards.length) {
							var cards2 = [],
								num = list[0];
							for (var card of cards) {
								for (var i = 0; i < num; i++) {
									var card2 = get.cardPile2(function (cardx) {
										return cardx.name == card.name && !cards2.includes(cardx);
									});
									if (card2) {
										cards2.push(card2);
									} else {
										break;
									}
								}
							}
							game.delayx();
							if (cards2.length) {
								player.gain(cards2, "gain2");
							}
							player.loseToDiscardpile(cards);
						}
						player.removeSkill("twfengji_mahou");
					} else {
						game.log(player, "的“蜂集”魔法剩余", "#g" + list[1] + "回合");
						player.markSkill("twfengji_mahou");
					}
				},
				ai: { threaten: 2.5 },
				mark: true,
				onremove: true,
				//该图标为灵魂宝石
				marktext: "♗",
				intro: {
					name: "施法：蜂集",
					markcount(storage) {
						if (storage) {
							return storage[1];
						}
						return 0;
					},
					content(storage) {
						if (storage) {
							return "经过" + storage[1] + "个“回合结束时”后，若有“示”，则从牌堆中获得" + storage[0] + "张和“示”名称相同的牌";
						}
						return "未指定施法效果";
					},
				},
			},
		},
	},
	twyiju: {
		audio: 2,
		locked: false,
		mod: {
			attackRangeBase(player, num) {
				if (player.getExpansions("twfengji").length) {
					return player.hp;
				}
			},
			cardUsable(card, player, num) {
				if (card.name == "sha" && player.getExpansions("twfengji").length) {
					return num - 1 + player.hp;
				}
			},
		},
		trigger: { player: "damageBegin3" },
		filter(event, player) {
			return player.getExpansions("twfengji").length > 0;
		},
		forced: true,
		content() {
			trigger.num++;
			var cards = player.getExpansions("twfengji");
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		ai: {
			halfneg: true,
			combo: "twfengji",
		},
	},
	twbudao: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		derivation: ["twzhouhu", "twharvestinori", "twzuhuo", "twzhouzu", "twhuangjin", "twguimen", "twdidao"],
		limited: true,
		skillAnimation: true,
		animationColor: "metal",
		check(event, player) {
			return !player.hasUnknown() || !player.hasFriend();
		},
		skillValue: {
			twzhouhu: target => (Math.random() < 0.6 ? 0.1 : 1),
			twzuhuo: (target, player) => (get.damageEffect(target, player, player) > 0 ? 0.1 : 1),
			twharvestinori: target => 0.9 + Math.random() / 5,
			twhuangjin: target => Math.random() / 5,
			twguimen: target => Math.sqrt(Math.min(3, target.countCards("he", { suit: "spade" }))) * 0.09,
			twzhouzu: target => {
				var rand = Math.random();
				if (rand < 0.8) {
					return 1 - Math.sqrt(0.8 - rand);
				}
				return 1;
			},
			twdidao: (target, player) => {
				if (
					[target, player].some(current =>
						current.getSkills().some(skill => {
							var info = get.info(skill);
							if (!info || !info.ai || !info.ai.rejudge) {
								return false;
							}
							return true;
						})
					)
				) {
					return 0.05;
				}
				return 0.85 + Math.random() / 5;
			},
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			player.loseMaxHp();
			player.recover();
			var skills = lib.skill.twbudao.derivation,
				map = lib.skill.twbudao.skillValue;
			skills = skills.randomGets(3);
			var target = game.filterPlayer().sort((a, b) => get.attitude(player, b) - get.attitude(player, a))[0];
			if (player.identity == "nei" || get.attitude(player, target) < 6) {
				target = player;
			}
			player
				.chooseControl(skills)
				.set(
					"choiceList",
					skills.map(function (i) {
						return (
							'<div class="skill">【' +
							get.translation(lib.translate[i + "_ab"] || get.translation(i).slice(0, 2)) +
							"】</div><div>" +
							get.skillInfoTranslation(i, player, false) +
							"</div>"
						);
					})
				)
				.set("displayIndex", false)
				.set("prompt", "布道：选择获得一个技能")
				.set("ai", () => {
					return _status.event.choice;
				})
				.set("choice", skills.sort((a, b) => (map[b](target, player) || 0.5) - (map[a](target, player) || 0.5))[0]);
			"step 1";
			var skill = result.control;
			player.addSkills(skill);
			event.twbudao_skill = skill;
			player.chooseTarget(lib.filter.notMe, "是否令一名其他角色也获得【" + get.translation(skill) + "】？").set("ai", function (target) {
				var player = _status.event.player;
				if (player.identity == "nei") {
					return 0;
				}
				return get.attitude(player, target);
			});
			"step 2";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.line(target, "green");
				target.addSkills(event.twbudao_skill);
				var cards = target.getCards("he");
				if (!cards.length) {
					event.finish();
				} else if (cards.length == 1) {
					event._result = { bool: true, cards: cards };
				} else {
					target.chooseCard("he", true, "交给" + get.translation(player) + "一张牌作为学费");
				}
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				target.give(result.cards, player);
			}
		},
	},
	twzhouhu: {
		mahouSkill: true,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return !player.hasSkill("twzhouhu_mahou") && player.countCards("h", lib.skill.twzhouhu.filterCard) > 0;
		},
		filterCard: { color: "red" },
		check(card) {
			if (_status.event.player.isHealthy()) {
				return 0;
			}
			return 7 - get.value(card);
		},
		content() {
			"step 0";
			player
				.chooseControl("1回合", "2回合", "3回合")
				.set("prompt", "请选择施法时长")
				.set("ai", function () {
					var player = _status.event.player;
					var safe = 1;
					if (safe < Math.min(3, game.countPlayer(), player.getDamagedHp())) {
						var next = player.next;
						while (next != player && get.attitude(next, player) > 0) {
							safe++;
							next = next.next;
						}
					}
					return Math.max(1, Math.min(safe, 3, game.countPlayer(), player.getDamagedHp())) - 1;
				});
			"step 1";
			player.storage.twzhouhu_mahou = [result.index + 1, result.index + 1];
			player.addTempSkill("twzhouhu_mahou", { player: "die" });
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
					var list = player.storage.twzhouhu_mahou;
					list[1]--;
					if (list[1] == 0) {
						game.log(player, "的“咒护”魔法生效");
						player.logSkill("twzhouhu");
						var num = list[0];
						player.recover(num);
						player.removeSkill("twzhouhu_mahou");
					} else {
						game.log(player, "的“咒护”魔法剩余", "#g" + list[1] + "回合");
						player.markSkill("twzhouhu_mahou");
					}
				},
				mark: true,
				onremove: true,
				marktext: "♗",
				intro: {
					name: "施法：咒护",
					markcount(storage) {
						if (storage) {
							return storage[1];
						}
						return 0;
					},
					content(storage) {
						if (storage) {
							return "经过" + storage[1] + "个“回合结束时”后，回复" + storage[0] + "点体力";
						}
						return "未指定施法效果";
					},
				},
			},
		},
	},
	twharvestinori: {
		mahouSkill: true,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return !player.hasSkill("twharvestinori_mahou") && player.countCards("h", lib.skill.twharvestinori.filterCard) > 0;
		},
		filterCard: { color: "black" },
		check(card) {
			return 8 - get.value(card);
		},
		content() {
			"step 0";
			player
				.chooseControl("1回合", "2回合", "3回合")
				.set("prompt", "请选择施法时长")
				.set("ai", function () {
					var player = _status.event.player;
					var safe = player.hp;
					if (safe < Math.min(3, game.countPlayer())) {
						var next = player.next;
						while (next != player && get.attitude(next, player) > 0) {
							safe++;
							next = next.next;
						}
					}
					return Math.max(1, Math.min(safe, 3, game.countPlayer())) - 1;
				});
			"step 1";
			player.storage.twharvestinori_mahou = [result.index + 1, result.index + 1];
			player.addTempSkill("twharvestinori_mahou", { player: "die" });
		},
		ai: {
			order: 8,
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
					var list = player.storage.twharvestinori_mahou;
					list[1]--;
					if (list[1] == 0) {
						game.log(player, "的“丰祈”魔法生效");
						player.logSkill("twharvestinori");
						var num = list[0] * 2;
						player.draw(num);
						player.removeSkill("twharvestinori_mahou");
					} else {
						game.log(player, "的“丰祈”魔法剩余", "#g" + list[1] + "回合");
						player.markSkill("twharvestinori_mahou");
					}
				},
				mark: true,
				onremove: true,
				marktext: "♗",
				intro: {
					name: "施法：丰祈",
					markcount(storage) {
						if (storage) {
							return storage[1];
						}
						return 0;
					},
					content(storage) {
						if (storage) {
							return "经过" + storage[1] + "个“回合结束时”后，摸" + storage[0] * 2 + "张牌";
						}
						return "未指定施法效果";
					},
				},
			},
		},
	},
};
