import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const reshenxingSkills = {
	//顾雍
	reshenxing: {
		selectionSpec(event, player) {
			const count = Math.min(2, player.countMark("reshenxing_used"));
			return count ? { steps: [{ type: "card", select: count }] } : { steps: [] };
		},
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("he") >= Math.min(2, player.countMark("reshenxing_used"));
		},
		selectCard() {
			return Math.min(2, _status.event.player.countMark("reshenxing_used"));
		},
		prompt() {
			return "弃置" + get.cnNumber(Math.min(2, _status.event.player.countMark("reshenxing_used"))) + "张牌并摸一张牌";
		},
		check(card) {
			var num = _status.event.player.countCards("h", { color: get.color(card) });
			if (get.position(card) == "e") {
				num++;
			}
			return (Math.max(4, 7.1 - num) - get.value(card)) / num;
		},
		filterCard: lib.filter.cardDiscardable,
		position: "he",
		async content(event, trigger, player) {
			await player.draw();
			player.addTempSkill(event.name + "_used", "phaseUseAfter");
			player.addMark(event.name + "_used", 1, false);
		},
		ai: {
			order(item, player) {
				if (!player.hasMark("reshenxing_used")) {
					return 10;
				}
				return 1;
			},
			result: { player: 1 },
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已发动过#次",
				},
			},
		},
	},
	rebingyi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterx(player) {
			var cards = player.getCards("h");
			if (cards.length == 1) {
				return true;
			}
			var color = get.color(cards[0], player);
			for (var i = 1; i < cards.length; i++) {
				if (get.color(cards[i], player) != color) {
					return false;
				}
			}
			return true;
		},
		filtery(player) {
			var cards = player.getCards("h");
			if (cards.length == 1) {
				return true;
			}
			var color = get.number(cards[0], player);
			for (var i = 1; i < cards.length; i++) {
				if (get.number(cards[i], player) != color) {
					return false;
				}
			}
			return true;
		},
		async cost(event, trigger, player) {
			const selfDraw = get.info(event.skill).filterx(player) && get.info(event.skill).filtery(player),
				asyncDraw = get.info(event.skill).filterx(player);
			if (asyncDraw) {
				const num = player.countCards("h");
				const result = await player
					.chooseTarget(get.prompt(event.skill), `展示所有手牌，并选择至多${get.cnNumber(num)}名角色各摸一张牌${selfDraw ? "，然后你摸一张牌" : ""}`, [0, num])
					.set("ai", function (target) {
						return get.attitude(get.player(), target);
					})
					.forResult();
				if (result.bool) {
					event.result = {
						bool: result.bool,
						cost_data: {
							asyncDraw,
							selfDraw,
							targets: result.targets,
						},
					};
				}
			} else {
				event.result = await player
					.chooseBool(get.prompt(event.skill), `展示所有手牌${selfDraw ? "，然后你摸一张牌" : ""}`)
					.set("choice", selfDraw)
					.set("ai", () => get.event().choice)
					.forResult();
				event.result.cost_data = { selfDraw };
			}
		},
		async content(event, trigger, player) {
			await player.showHandcards(get.translation(player) + "发动了【秉壹】");
			const data = event.cost_data;
			if (data.asyncDraw && data.targets && data.targets.length) {
				const targets = data.targets.sortBySeat();
				await game.asyncDraw(targets);
			}
			if (data.selfDraw) {
				player.draw();
			}
		},
	},
	//钟会
	xinquanji: {
		audio: 2,
		trigger: {
			player: ["damageEnd"],
			global: ["gainAfter", "loseAsyncAfter"],
		},
		getIndex(event, player, triggername) {
			return event.name == "damage" ? event.num : 1;
		},
		filter(event, player) {
			if (event.name == "damage") {
				return event.num > 0;
			}
			if (event.name == "loseAsync") {
				if (event.type != "gain" || event.giver) {
					return false;
				}
				return game.hasPlayer(current => {
					if (current == player) {
						return false;
					}
					return event.getg?.(current).some(card => event.getl?.(player)?.cards2?.includes(card));
				});
			}
			if (player == event.player) {
				return false;
			}
			if (event.giver || event.getParent().name == "gift") {
				return false;
			}
			return event.getl?.(player)?.cards2?.length;
		},
		frequent: true,
		async content(event, trigger, player) {
			await player.draw();
			const hs = player.getCards("h");
			if (!hs.length) {
				return;
			}
			const result = hs.length == 1 ? { bool: true, cards: hs } : await player.chooseCard("h", true, "选择一张手牌作为“权”").forResult();
			if (result?.bool && result?.cards?.length) {
				const next = player.addToExpansion(result.cards, player, "give");
				next.gaintag.add(event.name);
				await next;
			}
		},
		locked: false,
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		mod: {
			maxHandcard(player, num) {
				return num + player.getExpansions("xinquanji").length;
			},
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			notemp: true,
			threaten: 0.8,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage") && !target.storage.xinzili) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						if (target.hp >= 4) {
							return [0.5, get.tag(card, "damage") * 2];
						}
						if (!target.hasSkill("xinpaiyi") && target.hp > 1) {
							return [0.5, get.tag(card, "damage") * 1.5];
						}
						if (target.hp == 3) {
							return [0.5, get.tag(card, "damage") * 1.5];
						}
						if (target.hp == 2) {
							return [1, get.tag(card, "damage") * 0.5];
						}
					}
				},
			},
		},
	},
	xinzili: {
		derivation: "xinpaiyi",
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "thunder",
		filter(event, player) {
			return player.getExpansions("xinquanji").length > 2;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recover();
			await player.draw(2);
			await player.loseMaxHp();
			await player.addSkills("xinpaiyi");
		},
		ai: {
			combo: "xinquanji",
		},
	},
	xinpaiyi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (player.getStorage("xinpaiyi_used").length > 1) {
				return false;
			}
			return player.getExpansions("xinquanji").length > 0;
		},
		chooseButton: {
			check(button) {
				if (typeof button.link == "object") {
					return 1;
				}
				var player = _status.event.player,
					num = player.getExpansions("xinquanji").length - 1;
				if (button.link == 1) {
					if (
						game.countPlayer(function (current) {
							return get.damageEffect(current, player, player) > 0;
						}) < num
					) {
						return 0.5;
					}
					return 2;
				}
				if (num < 2) {
					return 0;
				}
				return 1;
			},
			dialog(event, player) {
				var dialog = ui.create.dialog("权计", "hidden");
				var table = document.createElement("div");
				table.classList.add("add-setting");
				table.style.margin = "0";
				table.style.width = "100%";
				table.style.position = "relative";
				var list = ["摸牌", "造成伤害"];
				dialog.add([
					list.map((item, i) => {
						return [i, item];
					}),
					"tdnodes",
				]);
				dialog.add(player.getExpansions("xinquanji"));
				return dialog;
			},
			select: 2,
			filter(button, player) {
				if (typeof button.link == "number" && player.getStorage("xinpaiyi_used").includes(button.link)) {
					return false;
				}
				if (ui.selected.buttons.length) {
					return typeof ui.selected.buttons[0].link != typeof button.link;
				}
				return true;
			},
			backup(links) {
				if (typeof links[0] == "object") {
					links.reverse();
				}
				var next = get.copy(lib.skill["xinpaiyi_backup" + links[0]]);
				next.card = links[1];
				return next;
			},
			prompt(links, player) {
				if (typeof links[0] == "object") {
					links.reverse();
				}
				var num = get.cnNumber(Math.max(1, player.getExpansions("xinquanji").length - 1)),
					card = get.translation(links[1]);
				if (links[0] == 0) {
					return "移去" + card + "并令一名角色摸" + num + "张牌";
				}
				return "移去" + card + "并对至多" + num + "名角色造成1点伤害";
			},
		},
		ai: {
			order: 1,
			result: { player: 1 },
			combo: "xinquanji",
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			backup0: {
				audio: "xinpaiyi",
				filterCard: () => false,
				selectCard: -1,
				filterTarget: true,
				delay: false,
				async content(event, trigger, player) {
					const target = event.target;

					// step 0
					player.addTempSkill("xinpaiyi_used", "phaseUseEnd");
					player.markAuto("xinpaiyi_used", [0]);
					var card = lib.skill.xinpaiyi_backup.card;
					player.loseToDiscardpile(card);

					// step 1
					await target.draw(Math.max(1, player.getExpansions("xinquanji").length)).forResult();
				},
				ai: {
					result: {
						target(player, target) {
							if (target.hasSkill("nogain")) {
								return 0;
							}
							if (player == target && !player.needsToDiscard()) {
								return 3;
							}
							return 1;
						},
					},
				},
			},
			backup1: {
				audio: "xinpaiyi",
				filterCard: () => false,
				selectCard: -1,
				filterTarget: true,
				delay: false,
				multitarget: true,
				multiline: true,
				selectTarget() {
					return [1, Math.max(1, _status.event.player.getExpansions("xinquanji").length - 1)];
				},
				async content(event, trigger, player) {
					const targets = event.targets;

					// step 0
					targets.sortBySeat();
					player.addTempSkill("xinpaiyi_used", "phaseUseEnd");
					player.markAuto("xinpaiyi_used", [1]);
					var card = lib.skill.xinpaiyi_backup.card;
					player.loseToDiscardpile(card);

					// step 1
					for (var i of targets) {
						await i.damage().forResult();
					}
				},
				ai: {
					tag: {
						damage: 1,
					},
					result: {
						target: -1.5,
					},
				},
			},
		},
	},
};
