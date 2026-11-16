import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olzeyue" | "dzkanpo" | "dzgengzhan">} */
export const groupSkills = {
	olzeyue: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		limited: true,
		skillAnimation: true,
		animationColor: "water",
		direct: true,
		filter(event, player) {
			var sources = [],
				history = player.actionHistory;
			for (var i = history.length - 1; i >= 0; i--) {
				if (i < history.length - 1 && history[i].isMe) {
					break;
				}
				for (var evt of history[i].damage) {
					if (evt.source && evt.source != player && evt.source.isIn()) {
						sources.add(evt.source);
					}
				}
			}
			for (var source of sources) {
				var skills = source.getStockSkills("一！", "五！");
				for (var skill of skills) {
					var info = get.info(skill);
					if (info && !info.persevereSkill && !info.charlotte && !get.is.locked(skill, source) && source.hasSkill(skill, null, null, false)) {
						return true;
					}
				}
			}
			return false;
		},
		content() {
			"step 0";
			var sources = [],
				history = player.actionHistory;
			for (var i = history.length - 1; i >= 0; i--) {
				if (i < history.length - 1 && history[i].isMe) {
					break;
				}
				for (var evt of history[i].damage) {
					if (evt.source && evt.source != player && evt.source.isIn()) {
						sources.add(evt.source);
					}
				}
			}
			sources = sources.filter(function (source) {
				var skills = source.getStockSkills("一！", "五！");
				for (var skill of skills) {
					var info = get.info(skill);
					if (info && !info.persevereSkill && !info.charlotte && !get.is.locked(skill, source) && source.hasSkill(skill, null, null, false)) {
						return true;
					}
				}
				return false;
			});
			player
				.chooseTarget(get.prompt("olzeyue"), "令一名可选角色的一个非锁定技失效", function (card, player, target) {
					return _status.event.sources.includes(target);
				})
				.set("sources", sources)
				.set("ai", function (target) {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (att >= 0) {
						return 0;
					}
					return get.threaten(target, player);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("olzeyue", target);
				player.awakenSkill(event.name);
				event.target = target;
				var skills = target.getStockSkills("一！", "五！");
				skills = skills.filter(function (skill) {
					var info = get.info(skill);
					if (info && !info.charlotte && !get.is.locked(skill, target) && target.hasSkill(skill, null, null, false)) {
						return true;
					}
				});
				if (skills.length == 1) {
					event._result = { control: skills[0] };
				} else {
					player.chooseControl(skills).set("prompt", "令" + get.translation(target) + "的一个技能失效");
				}
			} else {
				event.finish();
			}
			"step 2";
			var skill = result.control;
			target.disableSkill("olzeyue_" + player.playerid, skill);
			target.storage["olzeyue_" + player.playerid] = true;
			player.addSkill("olzeyue_round");
			player.markAuto("olzeyue_round", [target]);
			if (!player.storage.olzeyue_map) {
				player.storage.olzeyue_map = {};
			}
			player.storage.olzeyue_map[target.playerid] = 0;
			game.log(target, "的技能", "#g【" + get.translation(skill) + "】", "被失效了");
		},
		ai: { threaten: 3 },
		subSkill: {
			round: {
				charlotte: true,
				trigger: { global: "roundEnd" },
				filter(event, player) {
					var storage = player.getStorage("olzeyue_round");
					for (var source of storage) {
						if (source.isIn() && source.canUse("sha", player, false)) {
							return true;
						}
					}
					return false;
				},
				forced: true,
				popup: false,
				content() {
					"step 0";
					event.targets = player.storage.olzeyue_round.slice(0).sortBySeat();
					event.target = event.targets.shift();
					event.forceDie = true;
					"step 1";
					var map = player.storage.olzeyue_map;
					if (target.storage["olzeyue_" + player.playerid]) {
						map[target.playerid]++;
					}
					event.num = map[target.playerid] - 1;
					if (event.num <= 0) {
						event.finish();
					}
					"step 2";
					event.num--;
					target.useCard(player, { name: "sha", isCard: true }, false, "olzeyue_round");
					"step 3";
					var key = "olzeyue_" + player.playerid;
					if (
						target.storage[key] &&
						player.hasHistory("damage", function (evt) {
							return evt.card.name == "sha" && evt.getParent().type == "card" && evt.getParent(3) == event;
						})
					) {
						for (var skill in target.disabledSkills) {
							if (target.disabledSkills[skill].includes(key)) {
								game.log(target, "恢复了技能", "#g【" + get.translation(skill) + "】");
							}
						}
						delete target.storage[key];
						target.enableSkill(key);
					}
					if (event.num > 0 && player.isIn() && target.isIn() && target.canUse("sha", player, false)) {
						event.goto(2);
					} else if (event.targets.length > 0) {
						event.target = event.targets.shift();
						event.goto(1);
					}
				},
			},
		},
	},
	//邓忠
	dzkanpo: {
		audio: 2,
		trigger: { source: "damageSource" },
		filter(event, player) {
			return event.getParent().type == "card" && event.card && event.card.name == "sha" && event.player.countCards("he") > 0;
		},
		logTarget: "player",
		content() {
			var suit = get.suit(trigger.card);
			var next = player.gainPlayerCard(trigger.player, "h", "visible");
			next.set("suit", suit);
			next.set("filterButton", function (button) {
				var evt = _status.event;
				return get.suit(button.link, evt.target) == evt.suit;
			});
		},
		group: "dzkanpo_sha",
		subSkill: {
			sha: {
				audio: "dzkanpo",
				enable: "chooseToUse",
				usable: 1,
				viewAs: { name: "sha" },
				viewAsFilter(player) {
					return player.countCards("hs") > 0;
				},
				filterCard: true,
				position: "hs",
				prompt: "将一张手牌当做【杀】使用",
				check(card) {
					return 6 - get.value(card);
				},
				ai: {
					respondSha: true,
					skillTagFilter(player) {
						if (player.getStat("skill").dzkanpo_sha) {
							return false;
						}
						if (!player.countCards("hs")) {
							return false;
						}
					},
				},
			},
		},
	},
	dzgengzhan: {
		audio: 2,
		trigger: { global: ["phaseJieshuBegin", "loseAfter", "loseAsyncAfter"] },
		filter(event, player) {
			if (event.name == "phaseJieshu") {
				return player != event.player && !event.player.hasHistory("useCard", evt => evt.card.name == "sha");
			}
			if (player.hasSkill("dzgengzhan_used", null, null, false)) {
				return false;
			}
			if (event.type != "discard" || event.getlx === false || player == _status.currentPhase || !event.isPhaseUsing()) {
				return false;
			}
			return event.cards?.some(card => get.position(card, true) == "d" && get.name(card, event.hs?.includes(card) ? event.player : false) == "sha");
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phaseJieshu") {
				event.result = {
					bool: true,
				};
			} else {
				const cards = trigger.cards.filter(card => get.position(card, true) == "d" && get.name(card, trigger.hs?.includes(card) ? trigger.player : false) == "sha");
				const { bool, links } = await player
					.chooseButton(["是否发动【更战】获得一张杀？", cards])
					.set("ai", button => {
						return get.value(button.link, get.player());
					})
					.forResult();
				event.result = {
					bool: bool,
					cost_data: links,
				};
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "phaseJieshu") {
				player.addTempSkill(event.name + "_effect", { player: "phaseUseAfter" });
				player.addMark(event.name + "_effect", 1, false);
				await game.delayx();
			} else {
				player.addTempSkill(event.name + "_used");
				await player.gain(event.cost_data, "gain2");
			}
		},
		subSkill: {
			used: { charlotte: true },
			effect: {
				onremove: true,
				charlotte: true,
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.countMark("dzgengzhan_effect");
						}
					},
				},
				intro: { content: "使用杀的次数上限+#" },
			},
		},
	},
};
