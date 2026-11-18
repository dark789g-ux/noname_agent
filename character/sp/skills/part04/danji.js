import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "danji" | "nuzhan" | "nuzhan2" | "jieyuan" | "fenxin" | "xisheng" | "shulv" | "xiandeng" | "qingyi" | "qingyi1" | "qingyi2" | "qingyi3">} */
export const groupSkills = {
	danji: {
		audio: 2,
		skillAnimation: true,
		animationColor: "water",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		derivation: ["mashu", "nuzhan"],
		filter(event, player) {
			var zhu = get.zhu(player);
			if (zhu && zhu.isZhu) {
				var name = zhu.name;
				while (name.indexOf("_") != -1) {
					name = name.slice(name.indexOf("_") + 1);
				}
				if (name.indexOf("liubei") == 0) {
					return false;
				}
			}
			return !player.storage.danji && player.countCards("h") > player.hp;
		},
		content() {
			player.awakenSkill(event.name);
			player.loseMaxHp();
			player.addSkills(["mashu", "nuzhan"]);
		},
		ai: {
			maixie: true,
			skillTagFilter: (player, tag, arg) => {
				if (tag === "maixie") {
					if (player.hp < 2 || player.storage.danji || player.hasSkill("nuzhan") || player.countCards("h") !== player.hp) {
						return false;
					}
					let zhu = get.zhu(player);
					if (zhu && zhu.isZhu) {
						let name = zhu.name;
						while (name.indexOf("_") !== -1) {
							name = name.slice(name.indexOf("_") + 1);
						}
						if (name.indexOf("liubei") == 0) {
							return false;
						}
					}
					return true;
				}
			},
			effect: {
				target: (card, player, target) => {
					let hs = target.countCards("h");
					if (target.hp < 3 || target.storage.danji || target.hasSkill("nuzhan") || hs > target.hp + 1) {
						return;
					}
					let zhu = get.zhu(target);
					if (zhu && zhu.isZhu) {
						let name = zhu.name;
						while (name.indexOf("_") !== -1) {
							name = name.slice(name.indexOf("_") + 1);
						}
						if (name.indexOf("liubei") == 0) {
							return;
						}
					}
					if (get.tag(card, "draw")) {
						return 1.6;
					}
					if (get.tag(card, "lose") || get.tag(card, "discard")) {
						return [1, -0.8];
					}
					if (hs === target.hp && get.tag(card, "damage")) {
						return [1, target.hp / 3];
					}
					if (hs > target.hp && target.hp > 3 && (card.name === "shan" || card.name === "wuxie")) {
						return "zeroplayertarget";
					}
				},
			},
			combo: "new_rewusheng",
		},
	},
	nuzhan: {
		popup: false,
		silent: true,
		firstDo: true,
		trigger: { player: "useCard1" },
		filter(event, player) {
			return event.card && event.card.name == "sha" && event.addCount !== false && event.cards && event.cards.length == 1 && get.type(event.cards[0], "trick") == "trick";
		},
		forced: true,
		content() {
			trigger.addCount = false;
			if (player.stat[player.stat.length - 1].card.sha > 0) {
				player.stat[player.stat.length - 1].card.sha--;
			}
		},
		ai: {
			combo: "wusheng",
		},
		group: "nuzhan2",
	},
	nuzhan2: {
		audio: "nuzhan",
		trigger: { player: "useCard1" },
		forced: true,
		popup: false,
		silent: true,
		firstDo: true,
		sourceSkill: "nuzhan",
		filter(event, player) {
			return event.card && event.card.name == "sha" && event.cards && event.cards.length == 1 && get.type(event.cards[0]) == "equip";
		},
		content() {
			trigger.baseDamage++;
		},
	},
	jieyuan: {
		audio: ["jieyuan_more.mp3", "jieyuan_less.mp3"],
		group: ["jieyuan_more", "jieyuan_less"],
		subSkill: {
			more: {
				audio: true,
				trigger: { source: "damageBegin1" },
				direct: true,
				filter(event, player) {
					if (
						!player.countCards(player.hasSkill("fenxin_nei") ? "he" : "h", function (card) {
							if (player.hasSkill("fenxin_nei") || (_status.connectMode && get.position(card) == "h")) {
								return true;
							}
							return get.color(card) == "black";
						})
					) {
						return false;
					}
					return (event.player.hp >= player.hp || player.hasSkill("fenxin_fan")) && player != event.player;
				},
				content() {
					"step 0";
					var goon = get.attitude(player, trigger.player) < 0;
					var next = player.chooseToDiscard(get.prompt("jieyuan", trigger.player), player.hasSkill("fenxin_nei") ? "he" : "h");
					if (!player.hasSkill("fenxin_nei")) {
						next.set("filterCard", function (card) {
							return get.color(card) == "black";
						});
						next.set("prompt2", "弃置一张黑色手牌令伤害+1");
					} else {
						next.set("prompt2", "弃置一张手牌令伤害+1");
					}
					next.set("ai", function (card) {
						if (_status.event.goon) {
							return 8 - get.value(card);
						}
						return 0;
					});
					next.set("goon", goon);
					next.logSkill = ["jieyuan_more", trigger.player];
					"step 1";
					if (result.bool) {
						trigger.num++;
					}
				},
			},
			less: {
				audio: true,
				trigger: { player: "damageBegin2" },
				filter(event, player) {
					if (
						!player.countCards(player.hasSkill("fenxin_nei") ? "he" : "h", function (card) {
							if (player.hasSkill("fenxin_nei") || (_status.connectMode && get.position(card) == "h")) {
								return true;
							}
							return get.color(card) == "red";
						})
					) {
						return false;
					}
					return event.source && (event.source.hp >= player.hp || player.hasSkill("fenxin_zhong")) && player != event.source;
				},
				direct: true,
				content() {
					"step 0";
					var next = player.chooseToDiscard(get.prompt("jieyuan"), player.hasSkill("fenxin_nei") ? "he" : "h");
					if (!player.hasSkill("fenxin_nei")) {
						next.set("filterCard", function (card) {
							return get.color(card) == "red";
						});
						next.set("prompt2", "弃置一张红色手牌令伤害-1");
					} else {
						next.set("prompt2", "弃置一张手牌令伤害-1");
					}
					next.set("ai", function (card) {
						var player = _status.event.player;
						if (player.hp == 1 || _status.event.getTrigger().num > 1) {
							return 9 - get.value(card);
						}
						if (player.hp == 2) {
							return 8 - get.value(card);
						}
						return 7 - get.value(card);
					});
					next.logSkill = "jieyuan_less";
					"step 1";
					if (result.bool) {
						trigger.num--;
					}
				},
			},
		},
		ai: {
			expose: 0.2,
			threaten: 1.5,
		},
	},
	fenxin: {
		mode: ["identity", "versus"],
		available(mode) {
			if (mode == "identity" && _status.mode == "purple") {
				return false;
			}
			if (mode == "versus" && _status.mode != "two") {
				return false;
			}
		},
		audio: 2,
		trigger: { global: ["dieAfter", "damageEnd"] },
		filter(event, player) {
			var list = ["fan", "zhong", "nei"];
			if (get.mode() == "identity") {
				return event.name == "die" && list.includes(event.player.identity) && !player.hasSkill("fenxin_" + event.player.identity);
			}
			return event.name == "damage" && event.player != player && list.some(identity => !player.hasSkill("fenxin_" + identity)) && event.player.getAllHistory("damage").indexOf(event) == 0;
		},
		forced: true,
		logTarget: "player",
		content() {
			"step 0";
			if (get.mode() == "identity") {
				event._result = {
					bool: true,
					links: ["fenxin_" + trigger.player.identity],
				};
			} else {
				player
					.chooseButton(
						[
							"焚心：请选择〖竭缘〗的升级方式",
							[
								[
									["fenxin_fan", "发动〖竭缘〗增加伤害无体力值限制"],
									["fenxin_zhong", "发动〖竭缘〗减少伤害无体力值限制"],
									["fenxin_nei", "将〖竭缘〗中的黑色手牌和红色手牌改为一张牌"],
								].filter(list => !player.hasSkill(list[0])),
								"textbutton",
							],
						],
						true
					)
					.set("ai", function (button) {
						return ["fenxin_fan", "fenxin_zhong", "fenxin_nei"].indexOf(button.link) + 1;
					});
			}
			"step 1";
			if (result.bool) {
				var identity = result.links[0];
				player.addSkill(identity);
				player.markSkill("fenxin");
			}
		},
		intro: {
			mark(dialog, content, player) {
				if (player.hasSkill("fenxin_zhong")) {
					dialog.addText("你发动“竭缘”减少伤害无体力值限制");
				}
				if (player.hasSkill("fenxin_fan")) {
					dialog.addText("你发动“竭缘”增加伤害无体力值限制");
				}
				if (player.hasSkill("fenxin_nei")) {
					dialog.addText("将“竭缘”中的黑色手牌和红色手牌改为一张牌");
				}
			},
		},
		subSkill: {
			fan: { charlotte: true },
			zhong: { charlotte: true },
			nei: { charlotte: true },
		},
		ai: { combo: "jieyuan" },
	},
	xisheng: {
		enable: "chooseToUse",
		usable: 1,
		viewAs: { name: "tao" },
		viewAsFilter(player) {
			return player != _status.currentPhase && player.countCards("hes") > 1;
		},
		selectCard: 2,
		filterCard: true,
		position: "hes",
	},
	shulv: {
		inherit: "zhiheng",
		prompt: "弃置一张牌并摸一张牌",
		selectCard: 1,
		filter(event, player) {
			return player.countCards("hs") > player.hp;
		},
	},
	xiandeng: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + 1;
				}
			},
			targetInRange(card, player) {
				if (card.name == "sha" && player.countUsed("sha", true) == 0) {
					return true;
				}
			},
		},
	},
	qingyi: {
		audio: 2,
		trigger: { player: "phaseJudgeBefore" },
		direct: true,
		content() {
			"step 0";
			var check = player.countCards("h") > 2;
			player
				.chooseTarget(get.prompt("qingyi"), "跳过判定阶段和摸牌阶段，视为对一名其他角色使用一张【杀】", function (card, player, target) {
					if (player == target) {
						return false;
					}
					return player.canUse({ name: "sha" }, target, false);
				})
				.set("check", check)
				.set("ai", function (target) {
					if (!_status.event.check) {
						return 0;
					}
					return get.effect(target, { name: "sha" }, _status.event.player);
				});
			"step 1";
			if (result.bool) {
				player.logSkill("qingyi", result.targets);
				player.useCard({ name: "sha", isCard: true }, result.targets[0], false);
				trigger.cancel();
				player.skip("phaseDraw");
			}
		},
	},
	qingyi1: {
		audio: true,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		sourceSkill: "qingyi",
		content() {
			"step 0";
			player.addSkill("qingyi3");
			var check = player.countCards("h") > 2;
			player.chooseTarget(get.prompt2("qingyi"), function (card, player, target) {
				if (player == target) {
					return false;
				}
				return player.canUse({ name: "sha" }, target);
			}).ai = function (target) {
				if (!check) {
					return 0;
				}
				return get.effect(target, { name: "sha" }, _status.event.player);
			};
			"step 1";
			if (result.bool) {
				player.logSkill("qingyi1", result.targets);
				player.useCard({ name: "sha", isCard: true }, result.targets[0], false);
				player.skip("phaseJudge");
				player.skip("phaseDraw");
			}
			player.removeSkill("qingyi3");
		},
	},
	qingyi2: {
		audio: true,
		trigger: { player: "phaseUseBefore" },
		direct: true,
		sourceSkill: "qingyi",
		filter(event, player) {
			return player.countCards("he", { type: "equip" }) > 0;
		},
		content() {
			"step 0";
			player.addSkill("qingyi3");
			var check = player.countCards("h") <= player.hp;
			player.chooseCardTarget({
				prompt: get.prompt2("qingyi"),
				filterCard(card, player) {
					return get.type(card) == "equip" && lib.filter.cardDiscardable(card, player);
				},
				position: "he",
				filterTarget(card, player, target) {
					if (player == target) {
						return false;
					}
					return player.canUse({ name: "sha" }, target);
				},
				ai1(card) {
					if (!_status.event.check) {
						return 0;
					}
					return 6 - get.value(card);
				},
				ai2(target) {
					if (!_status.event.check) {
						return 0;
					}
					return get.effect(target, { name: "sha" }, _status.event.player);
				},
				check: check,
			});
			"step 1";
			if (result.bool) {
				player.logSkill("qingyi2", result.targets);
				player.discard(result.cards[0]);
				player.useCard({ name: "sha", isCard: true }, result.targets[0]);
				trigger.cancel();
			}
			player.removeSkill("qingyi3");
		},
	},
	qingyi3: {
		mod: {
			targetInRange(card, player, target, now) {
				return true;
			},
		},
	},
};
