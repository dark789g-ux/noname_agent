import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twdianyi" | "twyingji" | "twyingji_wuxie" | "twshanghe" | "twkaiji" | "twshepan">} */
export const groupSkills = {
	//王粲
	twdianyi: {
		audio: 2,
		trigger: { player: "phaseEnd" },
		forced: true,
		filter(event, player) {
			if (!player.getHistory("sourceDamage").length) {
				return player.countCards("h") != 4;
			}
			return player.countCards("h") > 0;
		},
		content() {
			var num = player.countCards("h");
			if (player.getHistory("sourceDamage").length) {
				player.chooseToDiscard("h", true, num);
			} else if (num > 4) {
				player.chooseToDiscard("h", true, num - 4, "allowChooseAll");
			} else {
				player.drawTo(4);
			}
		},
	},
	twyingji: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			return player != _status.currentPhase && lib.inpile.includes(name) && player.countCards("h") == 0;
		},
		filter(event, player) {
			if (player == _status.currentPhase || player.countCards("h") > 0) {
				return false;
			}
			for (var i of lib.inpile) {
				if (i == "wuxie") {
					continue;
				}
				var type = get.type(i);
				if ((type == "basic" || type == "trick") && event.filterCard({ name: i, isCard: true }, player, event)) {
					return true;
				}
				if (i == "sha") {
					for (var j of lib.inpile_nature) {
						if (event.filterCard({ name: i, nature: j, isCard: true }, player, event)) {
							return true;
						}
					}
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var list = [];
				for (var i of lib.inpile) {
					if (i == "wuxie") {
						continue;
					}
					var type = get.type(i);
					if (type == "basic" || type == "trick") {
						var card = { name: i, isCard: true };
						if (event.filterCard(card, player, event)) {
							list.push([type, "", i]);
						}
						if (i == "sha") {
							for (var j of lib.inpile_nature) {
								card.nature = j;
								if (event.filterCard(card, player, event)) {
									list.push(["基本", "", "sha", j]);
								}
							}
						}
					}
				}
				return ui.create.dialog("应机", [list, "vcard"]);
			},
			check(button) {
				var player = _status.event.player;
				var card = { name: button.link[2], nature: button.link[3] };
				var val = _status.event.getParent().type == "phase" ? player.getUseValue(card) : 1;
				return val;
			},
			backup(links, player) {
				return {
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
						isCard: true,
					},
					filterCard: () => false,
					selectCard: -1,
					log: false,
					precontent() {
						player.logSkill("twyingji");
						player.draw("nodelay");
					},
				};
			},
			prompt(links) {
				return "将一张手牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			fireAttack: true,
			respondShan: true,
			respondSha: true,
			skillTagFilter(player) {
				if (player == _status.currentPhase || player.countCards("h") > 0) {
					return false;
				}
			},
			order: 10,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying) > 0;
					}
					return 1;
				},
			},
		},
		group: ["twyingji_wuxie"],
	},
	twyingji_wuxie: {
		enable: "chooseToUse",
		viewAs: {
			name: "wuxie",
			isCard: true,
		},
		sourceSkill: "twyingji",
		viewAsFilter(player) {
			return player != _status.currentPhase && player.countCards("h") == 0;
		},
		filterCard: () => false,
		prompt: "视为使用【无懈可击】并摸一张牌",
		selectCard: [0, 1],
		check: () => 1,
		log: false,
		precontent() {
			player.logSkill("twyingji");
			player.draw("nodelay");
		},
		ai: { order: 4 },
	},
	twshanghe: {
		trigger: { player: "dying" },
		limited: true,
		audio: 2,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && current.countCards("he") > 0;
			});
		},
		prompt: "是否发动【觞贺】？",
		skillAnimation: true,
		animationColor: "soil",
		logTarget: (event, player) => game.filterPlayer(current => current != player),
		content() {
			"step 0";
			player.awakenSkill(event.name);
			event.targets = game.filterPlayer(current => current != player);
			event.num = 0;
			event.jiu = false;
			"step 1";
			event.current = targets[num];
			if (!event.current.countCards("he")) {
				event.goto(3);
			} else {
				event.current.chooseCard("交给" + get.translation(player) + "一张牌", "he", true).set("ai", function (card) {
					var evt = _status.event.getParent();
					return 100 - get.value(card);
				});
			}
			"step 2";
			if (result.bool && result.cards && result.cards.length) {
				event.current.give(result.cards, player);
				if (!event.jiu && get.name(result.cards[0], player) == "jiu") {
					event.jiu = true;
				}
			}
			"step 3";
			event.num++;
			if (event.num < targets.length) {
				event.goto(1);
			} else if (!event.jiu && player.hp < 1) {
				player.recover(1 - player.hp);
			}
		},
	},
	//王昶
	twkaiji: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		async cost(event, trigger, player) {
			const skillName = event.name.slice(0, -5);
			const num =
				1 +
				game
					.getAllGlobalHistory("everything", evt => evt.name === "dying")
					.map(evt => evt.player)
					.unique().length;
			event.result = await player
				.chooseTarget([1, num], get.prompt(skillName), `令至多${get.cnNumber(num)}名角色各摸一张牌`)
				.set("ai", target => {
					return (
						Math.sqrt(5 - Math.min(4, target.countCards("h"))) *
						get.attitude(get.player(), target) *
						(target.hasSkillTag("nogain") ? 0.1 : 1)
					);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			await game.asyncDraw(targets.sortBySeat());
			if (targets.length > 1) {
				await game.delayx();
			}
			if (targets.some(current => current.hasHistory("gain", evt => evt.getParent(2) == event && get.type(evt.cards[0], current) != "basic"))) {
				await player.draw();
			}
		},
	},
	twshepan: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		usable: 1,
		filter(event, player) {
			return player != event.player;
		},
		async cost(event, trigger, player) {
			const { player: target } = trigger;
			const choiceList = ["摸一张牌", `将${get.translation(target)}区域内的一张牌置于牌堆顶`];
			const choices = ["选项一"];
			if (target.countCards("hej") > 0) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5">' + choiceList[1] + "</span>";
			}
			choices.push("cancel2");
			const result = await player
				.chooseControl(choices)
				.set("choiceList", choiceList)
				.set(
					"choice",
					(() => {
						if (choices.length > 2 && get.effect(target, { name: "guohe_copy" }, player, player) > 0) {
							return 1;
						}
						return 0;
					})()
				)
				.forResult();
			event.result = {
				bool: result?.control !== "cancel2",
				targets: [target],
				cost_data: result?.control,
			};
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cost_data,
			} = event;
			if (cost_data == "选项一") {
				await player.draw();
			} else {
				const result = await player.choosePlayerCard(target, "hej", true).forResult();
				if (result?.links?.length) {
					const card = result.links[0];
					target.$throw(get.position(card) == "h" ? 1 : card, 1000);
					await target.lose(card, ui.cardPile, "insert");
				}
			}
			await game.delayx();
			if (player.countCards("h") !== target.countCards("h")) {
				return;
			}
			const num = player.storage.counttrigger?.[event.name];
			if (typeof num == "number" && num > 0) {
				player.storage.counttrigger[event.name]--;
			}
			const result = await player
				.chooseBool(`是否令${get.translation(trigger.card)}对自己无效？`)
				.set("ai", () => {
					const evt = _status.event.getTrigger();
					return get.effect(evt.target, evt.card, evt.player, evt.target) < 0;
				})
				.forResult();
			if (result?.bool) {
				trigger.excluded.add(player);
			}
		},
	},
};
