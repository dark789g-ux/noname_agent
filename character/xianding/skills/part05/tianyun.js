import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "tianyun" | "wfyuyan" | "xinzhoufu" | "xinzhoufu2" | "xinyingbing" | "syjiqiao" | "syxiongyi" | "gzyinghun_re_sunyi" | "reyingzi_re_sunyi">} */
export const groupSkills = {
	//吴范
	tianyun: {
		audio: 2,
		trigger: { global: "phaseBegin" },
		frequent: true,
		filter(event, player) {
			return event.player.getSeatNum() == game.roundNumber && player.countCards("h") > 0;
		},
		seatRelated: true,
		async content(event, trigger, player) {
			const hs = player.getCards("h"),
				suits = hs.map(i => get.suit(i, player)).unique();
			const num = suits.length;
			const next = player.chooseToGuanxing(num);
			next.set("prompt", "天运：点击或拖动将牌移动到牌堆顶或牌堆底");
			next.processAI = function (list) {
				var cards = list[0][1];
				return [[], cards];
			};
			const result = await next.forResult();
			if (result.moved?.length) {
				const {
					moved: [top, bottom],
				} = result;
				if (bottom.length != num) {
					return;
				}
				const result2 = await player
					.chooseTarget({
						prompt: "天运：是否令一名角色摸" + get.cnNumber(num) + "张牌，然后失去1点体力？",
						ai(target) {
							if (!_status.event.goon || target.hasSkillTag("nogain")) {
								return 0;
							}
							const isCurrent = _status.currentPhase == target ? 1 : 0;
							return get.attitude(get.player(), target) * (Math.sqrt(Math.max(1, 5 - target.countCards("h"))) + isCurrent);
						},
					})
					.set("goon", num > 1 && player.hp > 5 - num)
					.forResult();
				if (result2.bool && result2.targets?.length) {
					const {
						targets: [target],
					} = result2;
					player.line(target, "green");
					await target.draw({ num });
					await player.loseHp();
				}
			}
		},
		group: "tianyun_gain",
		subSkill: {
			gain: {
				audio: "tianyun",
				trigger: {
					global: "phaseBefore",
					player: "enterGame",
				},
				forced: true,
				locked: false,
				filter(event, player) {
					if (event.name == "phase" && game.phaseNumber != 0) {
						return false;
					}
					var suits = lib.suit.slice(0),
						hs = player.getCards("h");
					for (var i of hs) {
						suits.remove(get.suit(i, player));
						if (!suits.length) {
							return false;
						}
					}
					return true;
				},
				async content(event, trigger, player) {
					const suits = lib.suit.slice(0),
						hs = player.getCards("h");
					for (var i of hs) {
						suits.remove(get.suit(i, player));
					}
					const cards = [];
					for (var i of suits) {
						var card = get.cardPile(function (card) {
							return get.suit(card, false) == i;
						});
						if (card) {
							cards.push(card);
						}
					}
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				},
			},
		},
	},
	wfyuyan: {
		audio: 2,
		// derivation: "refenyin",
		trigger: { global: "roundStart" },
		derivation: "iwasawa_refenyin",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget("请选择【预言】的目标", true)
				.set("ai", target => {
					return Math.random();
				})
				.set("animate", false)
				.forResult();
		},
		logLine: false,
		async content(event, trigger, player) {
			const [target] = event.targets;
			player.addTempSkill(event.name + "_dying", "roundEnd");
			player.markAuto(event.name + "_dying", [target]);
			player.addTempSkill(event.name + "_damage", "roundEnd");
			player.markAuto(event.name + "_damage", [target]);
		},
		subSkill: {
			dying: {
				trigger: { global: "dying" },
				charlotte: true,
				onremove: true,
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const storage = player.getStorage(event.name);
					player.removeSkill(event.name);
					if (storage.includes(trigger.player)) {
						player.logSkill("wfyuyan", trigger.player);
						await player.addTempSkills("iwasawa_refenyin", { player: "phaseEnd" });
					}
				},
			},
			damage: {
				trigger: { global: "damageSource" },
				charlotte: true,
				onremove: true,
				forced: true,
				popup: false,
				filter(event, player) {
					return event.source;
				},
				async content(event, trigger, player) {
					const storage = player.getStorage(event.name);
					player.removeSkill(event.name);
					if (storage.includes(trigger.source)) {
						player.logSkill("wfyuyan", trigger.source);
						await player.draw(2);
					}
				},
			},
		},
	},
	//张宝
	xinzhoufu: {
		audio: "rezhoufu",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		filterCard: true,
		filterTarget(card, player, target) {
			return target != player && !target.getExpansions("xinzhoufu2").length;
		},
		check(card) {
			return 6 - get.value(card);
		},
		position: "he",
		discard: false,
		lose: false,
		delay: false,
		content() {
			target.addToExpansion(cards, player, "give").gaintag.add("xinzhoufu2");
			target.addSkill("xinzhoufu_judge");
		},
		ai: {
			order: 12,
			result: {
				target(player, target) {
					if (player.inRange(target)) {
						return -1.3;
					}
					return -1;
				},
			},
		},
		subSkill: {
			judge: {
				audio: "xinzhoufu",
				trigger: { player: "judgeBefore" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return !event.directresult && player.getExpansions("xinzhoufu2").length;
				},
				content() {
					var cards = [player.getExpansions("xinzhoufu2")[0]];
					trigger.directresult = cards[0];
				},
			},
		},
	},
	xinzhoufu2: {
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
	},
	xinyingbing: {
		audio: "reyingbing",
		trigger: { player: "useCardToPlayered" },
		forced: true,
		logTarget: "target",
		filter(event, player) {
			return (
				event.target.getExpansions("xinzhoufu2").length > 0 &&
				!player.hasHistory("gain", function (evt) {
					var evtx = evt.getParent(2);
					return evtx && evtx.name == "xinyingbing" && evtx._trigger.target == event.target;
				})
			);
		},
		content() {
			player.draw(2);
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					if (
						target &&
						target.getExpansions("xinzhoufu2").length > 0 &&
						!player.hasHistory("gain", function (evt) {
							var evtx = evt.getParent(2);
							return evtx && evtx.name == "xinyingbing" && evtx._trigger.target == target;
						})
					) {
						return [1, 2];
					}
				},
			},
			combo: "xinzhoufu",
		},
	},
	//孙翊
	syjiqiao: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		content() {
			var cards = get.cards(player.maxHp);
			cards.sort(function (a, b) {
				return get.color(b).length - get.color(a).length;
			});
			player.addToExpansion(cards, "gain2").gaintag.add("syjiqiao");
			player.addTempSkill("syjiqiao_gain", "phaseUseAfter");
		},
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
			gain: {
				audio: "syjiqiao",
				trigger: { player: "useCardAfter" },
				charlotte: true,
				forced: true,
				filter(event, player) {
					return player.hasCard(card => card.hasGaintag("syjiqiao"), "x");
				},
				content() {
					"step 0";
					var cards = player.getExpansions("syjiqiao");
					var dialog = ["激峭：选择获得一张牌"];
					var reds = [],
						blacks = [];
					for (var i of cards) {
						(get.color(i) == "red" ? reds : blacks).push(i);
					}
					if (reds.length > 0) {
						dialog.push('<div class="text center">红色牌</div>');
						dialog.push(reds);
					}
					if (blacks.length > 0) {
						dialog.push('<div class="text center">黑色牌</div>');
						dialog.push(blacks);
					}
					player.chooseButton(dialog, true).set("ai", function (button) {
						var player = _status.event.player;
						var color = get.color(button.link),
							cards = player.getExpansions("syjiqiao");
						var num1 = cards.filter(card => get.color(card) == color).length,
							num2 = cards.length - num1;
						if (num1 >= num2) {
							return get.value(button.link);
						}
						return 0;
					});
					"step 1";
					if (result.bool) {
						player.gain(result.links, "gain2");
					} else {
						event.finish();
					}
					"step 2";
					var map = { red: 0, black: 0 },
						cards = player.getExpansions("syjiqiao");
					for (var i of cards) {
						var color = get.color(i, false);
						if (map[color] != undefined) {
							map[color]++;
						}
					}
					if (map.red == map.black) {
						player.recover();
					} else {
						player.loseHp();
					}
				},
				onremove(player) {
					var cards = player.getExpansions("syjiqiao");
					if (cards.length) {
						player.loseToDiscardpile(cards);
					}
				},
			},
		},
	},
	syxiongyi: {
		audio: 2,
		skillAnimation: true,
		animationColor: "wood",
		limited: true,
		enable: "chooseToUse",
		filter(event, player) {
			if (event.type != "dying") {
				return false;
			}
			if (player != event.dying) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			"step 0";
			player.awakenSkill(event.name);
			if (!_status.characterlist) {
				game.initCharacterList();
			}
			if (_status.characterlist.includes("xushi")) {
				if (player.name2 && get.character(player.name2)[3].includes("syxiongyi")) {
					await player.reinitCharacter(player.name2, "xushi");
				} else {
					await player.reinitCharacter(player.name1, "xushi");
				}
				if (player.hp < 3) {
					await player.recover(3 - player.hp);
				}
			} else {
				await player.addSkills("olhunzi");
				if (player.hp < 1) {
					await player.recover(1 - player.hp);
				}
			}
		},
		ai: {
			order: 1,
			save: true,
			skillTagFilter(player, arg, target) {
				return player == target;
			},
			result: {
				player: 10,
			},
		},
		derivation: ["olhunzi", "reyingzi", "gzyinghun"],
	},
	gzyinghun_re_sunyi: { audio: 1 },
	reyingzi_re_sunyi: { audio: 1 },
};
