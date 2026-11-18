import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhanjue4" | "zhanjue5" | "qinwang" | "qinwang1" | "qinwang_ai" | "zuoding" | "zuoding2" | "zuoding3" | "huomo">} */
export const groupSkills = {
	zhanjue4: {
		audio: false,
		trigger: { player: "useCardAfter" },
		forced: true,
		popup: false,
		sourceSkill: "zhanjue",
		filter(event, player) {
			return event.skill == "zhanjue";
		},
		async content(event, trigger, player) {
			const stat = player.getStat().skill;
			stat.zhanjue_draw ??= 0;
			++stat.zhanjue_draw;
			await player.draw({ nodelay: true });
			const list = game.filterPlayer(current => {
				if (current.getHistory("damage", evt => evt.card === trigger.card).length > 0) {
					if (current === player) {
						stat.zhanjue_draw++;
					}
					return true;
				}
				return false;
			});
			if (list.length) {
				list.sortBySeat();
				await game.asyncDraw(list);
			}
			await game.delay();
		},
	},
	zhanjue5: {},
	qinwang: {
		audio: "qinwang1",
		group: ["qinwang1"],
		zhuSkill: true,
		filter(event, player) {
			if (
				!player.hasZhuSkill("qinwang") ||
				!game.hasPlayer(function (current) {
					return current != player && current.group == "shu";
				}) ||
				!player.countCards("he")
			) {
				return false;
			}
			return !event.jijiang && (event.type != "phase" || !player.hasSkill("jijiang3"));
		},
		enable: ["chooseToUse", "chooseToRespond"],
		viewAs: {
			name: "sha",
			cards: [],
			suit: "none",
			number: null,
			isCard: true,
		},
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		check(card) {
			var player = _status.event.player,
				players = game.filterPlayer();
			if (player.hasSkill("qinwang_ai")) {
				return false;
			}
			for (var i = 0; i < players.length; i++) {
				var nh = players[i].countCards("h");
				if (players[i] != player && players[i].group == "shu" && get.attitude(players[i], player) > 2 && nh >= 3 && players[i].countCards("h", "sha")) {
					return 5 - get.value(card);
				}
			}
			return 0;
		},
		ai: {
			order() {
				return get.order({ name: "sha" }) - 0.3;
			},
			respondSha: true,
			skillTagFilter(player) {
				if (
					!player.hasZhuSkill("qinwang") ||
					!game.hasPlayer(function (current) {
						return current != player && current.group == "shu";
					}) ||
					!player.countCards("he")
				) {
					return false;
				}
			},
		},
	},
	qinwang1: {
		audio: 2,
		trigger: { player: ["useCardBegin", "respondBegin"] },
		logTarget: "targets",
		sourceSkill: "qinwang",
		filter(event, player) {
			return event.skill == "qinwang";
		},
		forced: true,
		async content(event, trigger, player) {
			delete trigger.skill;
			delete trigger.card.cards;
			await player.discard(trigger.cards);
			delete trigger.cards;
			trigger.getParent().set("jijiang", true);
			let current = player.next;
			while (current != player) {
				if (current.group != "shu") {
					current = current.next;
					continue;
				}
				const next = current
					.chooseToRespond({
						prompt: "是否替" + get.translation(player) + "打出一张杀？",
						ai() {
							const event = get.event();
							return get.attitude(event.player, event.source) - 2;
						},
					})
					.set("filterCard", function (card, player) {
						if (get.name(card) !== "sha") {
							return false;
						}
						return lib.filter.cardRespondable(card, player);
					})
					.set("source", player)
					.set("jijiang", true)
					.set("skillwarn", "替" + get.translation(player) + "打出一张杀");
				next.noOrdering = true;
				next.autochoose = lib.filter.autoRespondSha;
				const result = await next.forResult();
				if (result.bool) {
					await current.draw();
					trigger.card = result.card;
					trigger.cards = result.cards;
					trigger.throw = false;
					if (typeof current.ai.shown == "number" && current.ai.shown < 0.95) {
						current.ai.shown += 0.3;
						if (current.ai.shown > 0.95) {
							current.ai.shown = 0.95;
						}
					}
					return;
				}
				current = current.next;
			}
			player.addTempSkill("jijiang3");
			player.addTempSkill("qinwang_ai");
			trigger.cancel();
			trigger.getParent().goto(0);
		},
	},
	qinwang_ai: {},
	zuoding: {
		audio: 2,
		audioname: ["re_zhongyao"],
		trigger: { global: "useCardToPlayered" },
		filter(event, player) {
			if (event.getParent().triggeredTargets3.length > 1) {
				return false;
			}
			return (
				get.suit(event.card) == "spade" &&
				_status.currentPhase == event.player &&
				event.targets &&
				event.player.isPhaseUsing() &&
				event.targets.length &&
				event.player != player &&
				game.countPlayer2(function (current) {
					return current.getHistory("damage").length > 0;
				}) == 0
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("zuoding"),
					prompt2: "令一名目标角色摸一张牌",
					filterTarget(card, player, target) {
						return get.event().targets.includes(target);
					},
					ai(target) {
						return get.attitude(get.event().player, target);
					},
				})
				.set("targets", trigger.targets)
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			await event.targets[0].draw();
		},
		ai: {
			expose: 0.2,
		},
		//group:'zuoding3'
	},
	zuoding2: {},
	zuoding3: {
		trigger: { global: "damage" },
		silent: true,
		sourceSkill: "zuoding",
		async content(event, trigger, player) {
			player.addTempSkill("zuoding2");
		},
	},
	huomo: {
		audio: 2,
		audioname: ["huzhao", "re_zhongyao"],
		enable: "chooseToUse",
		onChooseToUse(event) {
			if (game.online || event.huomo_list) {
				return;
			}
			var list = lib.skill.huomo.getUsed(event.player);
			event.set("huomo_list", list);
		},
		getUsed(player) {
			var list = [];
			player.getHistory("useCard", function (evt) {
				if (get.type(evt.card, null, false) == "basic") {
					list.add(evt.card.name);
				}
			});
			return list;
		},
		hiddenCard(player, name) {
			if (get.type(name) != "basic") {
				return false;
			}
			var list = lib.skill.huomo.getUsed(player);
			if (list.includes(name)) {
				return false;
			}
			return player.hasCard(function (card) {
				return get.color(card) == "black" && get.type(card) != "basic";
			}, "eh");
		},
		filter(event, player) {
			if (
				event.type == "wuxie" ||
				!player.hasCard(function (card) {
					return get.color(card) == "black" && get.type(card) != "basic";
				}, "eh")
			) {
				return false;
			}
			var list = event.huomo_list || lib.skill.huomo.getUsed(player);
			for (var name of lib.inpile) {
				if (get.type(name) != "basic" || list.includes(name)) {
					continue;
				}
				var card = { name: name, isCard: true };
				if (event.filterCard(card, player, event)) {
					return true;
				}
				if (name == "sha") {
					for (var nature of lib.inpile_nature) {
						card.nature = nature;
						if (event.filterCard(card, player, event)) {
							return true;
						}
					}
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var vcards = [];
				var list = event.huomo_list || lib.skill.huomo.getUsed(player);
				for (var name of lib.inpile) {
					if (get.type(name) != "basic" || list.includes(name)) {
						continue;
					}
					var card = { name: name, isCard: true };
					if (event.filterCard(card, player, event)) {
						vcards.push(["基本", "", name]);
					}
					if (name == "sha") {
						for (var nature of lib.inpile_nature) {
							card.nature = nature;
							if (event.filterCard(card, player, event)) {
								vcards.push(["基本", "", name, nature]);
							}
						}
					}
				}
				return ui.create.dialog("活墨", [vcards, "vcard"], "hidden");
			},
			check(button) {
				var player = _status.event.player;
				var card = { name: button.link[2], nature: button.link[3] };
				if (
					game.hasPlayer(function (current) {
						return player.canUse(card, current) && get.effect(current, card, player, player) > 0;
					})
				) {
					switch (button.link[2]) {
						case "tao":
							return 5;
						case "jiu":
							return 3.01;
						case "sha":
							if (button.link[3] == "fire") {
								return 2.95;
							} else if (button.link[3] == "thunder") {
								return 2.92;
							} else {
								return 2.9;
							}
						case "shan":
							return 1;
					}
				}
				return 0;
			},
			backup(links, player) {
				return {
					check(card) {
						return 1 / Math.max(0.1, get.value(card));
					},
					filterCard(card) {
						return get.type(card) != "basic" && get.color(card) == "black";
					},
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						suit: "none",
						number: null,
						isCard: true,
					},
					position: "he",
					popname: true,
					ignoreMod: true,
					async precontent(event, trigger, player) {
						player.logSkill("huomo");
						const card = event.result.cards[0];
						game.log(player, "将", card, "置于牌堆顶");
						await player.loseToDiscardpile(card, ui.cardPile, "visible", "insert").set("log", false);
						const viewAs = {
							name: event.result.card.name,
							nature: event.result.card.nature,
							isCard: true,
						};
						event.result.card = viewAs;
						event.result.cards = [];
					},
				};
			},
			prompt(links, player) {
				return "将一张黑色非基本牌置于牌堆顶并视为使用一张" + get.translation(links[0][3] || "") + get.translation(links[0][2]);
			},
		},
		ai: {
			order() {
				var player = _status.event.player;
				var event = _status.event;
				var list = lib.skill.huomo.getUsed(player);
				if (!list.includes("jiu") && event.filterCard({ name: "jiu" }, player, event) && get.effect(player, { name: "jiu" }) > 0) {
					return 3.1;
				}
				return 2.9;
			},
			respondSha: true,
			fireAttack: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "fireAttack") {
					return true;
				}
				if (
					player.hasCard(function (card) {
						return get.color(card) == "black" && get.type(card) != "basic";
					}, "he")
				) {
					if (arg === "respond") {
						return false;
					}
					var list = lib.skill.huomo.getUsed(player);
					if (tag == "respondSha") {
						if (list.includes("sha")) {
							return false;
						}
					} else if (tag == "respondShan") {
						if (list.includes("shan")) {
							return false;
						}
					}
				} else {
					return false;
				}
			},
			result: {
				player: 1,
			},
		},
	},
};
