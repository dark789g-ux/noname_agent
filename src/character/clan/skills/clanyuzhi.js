import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanyuzhi" | "clanxieshu" | "clanfuxun" | "clanchenya">} */
export const groupSkills = {
	//族钟会
	clanyuzhi: {
		mod: {
			aiOrder(player, card, num) {
				if (card.name == "tao") {
					return num / 114514;
				}
			},
		},
		audio: 6,
		trigger: { global: ["roundStart", "roundEnd"] },
		filter(event, player, name) {
			if (name === "roundStart") {
				return player.countCards("h");
			}
			if (player.hasCard(card => card.hasGaintag("clanyuzhi") && lib.filter.cardDiscardable(card, player), "h")) {
				return true;
			}
			const num1 = player.getRoundHistory("gain", evt => evt.getParent().name == "draw" && evt.getParent(2).name == "clanyuzhi").reduce((sum, evt) => sum + evt.cards.length, 0);
			const num2 = player.getRoundHistory("gain", evt => evt.getParent().name == "draw" && evt.getParent(2).name == "clanyuzhi", 1).reduce((sum, evt) => sum + evt.cards.length, 0);
			const num3 = player.getRoundHistory("useCard").length;
			return (num1 > 0 && num2 > 0 && num1 > num2) || num1 > num3;
		},
		forced: true,
		async content(event, trigger, player) {
			const name = event.triggername;
			const num1 = player.getRoundHistory("gain", evt => evt.getParent().name == "draw" && evt.getParent(2).name == "clanyuzhi", name === "roundStart" ? 1 : 0).reduce((sum, evt) => sum + evt.cards.length, 0);
			switch (name) {
				case "roundStart": {
					const result = await player
						.chooseCard(
							"迂志：请展示一张手牌",
							"摸此牌牌名字数的牌。本轮结束时弃置此牌，若本轮你使用的牌数或上一轮你以此法摸的牌数小于此牌牌名字数，则你受到1点雷属性伤害或失去〖保族〗。",
							(card, player) => {
								const num = get.cardNameLength(card);
								return typeof num == "number" && num > 0;
							},
							true
						)
						.set("ai", card => {
							const { dying, num } = get.event();
							if (dying && num > 0 && get.cardNameLength(card) > num) {
								return 1 / get.cardNameLength(card); //怂
							}
							return get.cardNameLength(card); //勇
						})
						.set(
							"dying",
							player.hp +
								player.countCards("hs", {
									name: ["tao", "jiu"],
								}) <
								1
						)
						.set("num", num1)
						.forResult();
					if (result?.bool && result.cards?.length) {
						await player.showCards(result.cards, get.translation(player) + "发动了【迂志】");
						player.addGaintag(result.cards, "clanyuzhi");
						await player.draw(get.cardNameLength(result.cards[0]));
						player.storage.clanyuzhi_mark = get.cardNameLength(result.cards[0]);
						player.addTempSkill("clanyuzhi_mark", "roundStart");
					}
					break;
				}
				case "roundEnd": {
					const cards = player.getCards("h", card => card.hasGaintag("clanyuzhi") && lib.filter.cardDiscardable(card, player));
					if (cards.length) {
						await player.discard(cards);
					}
					const num2 = player.getRoundHistory("gain", evt => evt.getParent().name == "draw" && evt.getParent(2).name == "clanyuzhi", 1).reduce((sum, evt) => sum + evt.cards.length, 0);
					const num3 = player.getRoundHistory("useCard").length;
					if ((num1 > 0 && num2 > 0 && num1 > num2) || num1 > num3) {
						let result;
						if (num2 > 0 && num1 > num2) {
							game.log(player, "的野心已开始膨胀", "#y(" + num1 + "张>" + num2 + "张)");
						}
						if (num1 > num3) {
							game.log(player, "的行动未达到野心", "#y(" + num3 + "张<" + num1 + "张)");
						}
						if (player.hasSkill("clanbaozu", null, false, false)) {
							result = await player.chooseBool("迂志：是否失去〖保族〗？", "若选择“否”，则你受到1点雷属性伤害").set("choice", player.awakenedSkills.includes("clanbaozu")).forResult();
						} else {
							result = { bool: false };
						}
						if (result?.bool) {
							await player.removeSkills("clanbaozu");
						} else {
							await player.damage(1, "thunder");
						}
					}
				}
			}
		},
		ai: {
			threaten: 3,
			nokeep: true,
		},
		onremove(player, skill) {
			player.removeGaintag(skill);
			player.removeSkill(skill + "_mark");
		},
		subSkill: {
			mark: {
				charlotte: true,
				onremove: true,
				mark: true,
				intro: { content: "本轮野心：#张" },
			},
		},
	},
	clanxieshu: {
		audio: 6,
		trigger: { player: "damageEnd", source: "damageSource" },
		filter(event, player) {
			if (!event.card || player.isLinked()) {
				return false;
			}
			var num = get.cardNameLength(event.card);
			return typeof num == "number" && num > 0 && player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			var num = get.cardNameLength(trigger.card),
				str = "";
			if (player.getDamagedHp() > 0) {
				str += "，然后摸" + get.cnNumber(player.getDamagedHp()) + "张牌";
			}
			event.result = await player
				.chooseToDiscard(get.prompt(event.skill), "横置武将牌并弃置" + get.cnNumber(num) + "张牌" + str, "he", num, "chooseonly")
				.set("ai", function (card) {
					var player = _status.event.player;
					var num = _status.event.num;
					var num2 = player.getDamagedHp();
					if (!num2) {
						return 0;
					}
					if (num < num2) {
						return 8 - get.value(card);
					}
					if (num == num2 || num2 >= 2 + num - num2) {
						return lib.skill.zhiheng.check(card);
					}
					return 0;
				})
				.set("num", num)
				//.set("logSkill", "clanxieshu")
				.forResult();
		},
		//popup: false,
		async content(event, trigger, player) {
			await player.discard(event.cards);
			await player.link(true);
			if (player.getDamagedHp() > 0) {
				await player.draw(player.getDamagedHp());
			}
			if (
				game.getGlobalHistory("everything", evt => {
					return evt.name == "dying";
				}).length
			) {
				player.tempBanSkill("clanxieshu");
			}
		},
		ai: { threaten: 3 },
	},
	//族王浑
	clanfuxun: {
		mod: {
			aiOrder(player, card, num) {
				if (player.isPhaseUsing() && get.type(card) == "equip" && get.equipValue(card, player) > 0) {
					return num + 3;
				}
			},
			cardUsable(card) {
				if (card.storage?.clanfuxun) {
					return Infinity;
				}
			},
		},
		locked: false,
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterCard: true,
		position: "h",
		discard: false,
		lose: false,
		delay: false,
		selectCard() {
			var player = _status.event.player;
			if (ui.selected.targets.length && !ui.selected.targets[0].countGainableCards(player, "h")) {
				return 1;
			}
			return [0, 1];
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			if (!ui.selected.cards.length) {
				return target.countGainableCards(player, "h") > 0;
			}
			return true;
		},
		check(card) {
			var player = _status.event.player;
			var evtx = _status.event.getParent("phaseUse");
			var targets = game.filterPlayer(target => target != player && lib.skill.clanfuxun.ai.result.target(player, target) != 0);
			targets.sort((a, b) => Math.abs(lib.skill.clanfuxun.ai.result.target(player, b)) - Math.abs(lib.skill.clanfuxun.ai.result.target(player, a)));
			if (evtx && targets.length) {
				var target = targets[0];
				if (
					!target.hasHistory("lose", evt => {
						return evt.getParent(3).name != "clanfuxun" && evt.getParent("phaseUse") == evtx && evt.cards2.length;
					}) &&
					!target.hasHistory("gain", evt => {
						return evt.getParent().name != "clanfuxun" && evt.getParent("phaseUse") == evtx && evt.cards.length;
					}) &&
					Math.abs(player.countCards("h") - target.countCards("h")) == 2
				) {
					if (player.countCards("h") > target.countCards("h")) {
						return 1 / (get.value(card) || 0.5);
					}
					return -1;
				}
				if (card.name == "du") {
					return 20;
				}
				return -1;
			}
			if (card.name == "du") {
				return 20;
			}
			return -1;
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			let result;

			if (cards.length) {
				await player.give(cards, target);
			} else {
				await player.gainPlayerCard(target, "h", true);
			}

			const evtx = event.getParent("phaseUse");
			if (
				player.countCards("h") == target.countCards("h") &&
				evtx &&
				!target.hasHistory("lose", evt => {
					return evt.getParent(3).name != "clanfuxun" && evt.getParent("phaseUse") == evtx && evt.cards2.length;
				}) &&
				!target.hasHistory("gain", evt => {
					return evt.getParent().name != "clanfuxun" && evt.getParent("phaseUse") == evtx && evt.cards.length;
				}) &&
				player.countCards("he")
			) {
				const list = [];
				for (const name of lib.inpile) {
					if (get.type(name) != "basic") {
						continue;
					}
					if (player.hasUseTarget({ name: name })) {
						list.push(["基本", "", name]);
					}
					if (name == "sha") {
						for (const nature of lib.inpile_nature) {
							if (
								player.hasUseTarget({
									name: name,
									nature: nature,
								})
							) {
								list.push(["基本", "", name, nature]);
							}
						}
					}
				}
				if (!list.length) {
					return;
				}
				result = await player
					.chooseButton(["是否将一张牌当做一种基本牌使用？", [list, "vcard"]])
					.set("ai", button => {
						return _status.event.player.getUseValue({
							name: button.link[2],
							nature: button.link[3],
						});
					})
					.forResult();
			} else {
				return;
			}

			if (result.bool) {
				const card = {
					name: result.links[0][2],
					nature: result.links[0][3],
					storage: { clanfuxun: true },
				};
				game.broadcastAll(function (card) {
					lib.skill.clanfuxun_backup.viewAs = card;
				}, card);
				const next = player.chooseToUse();
				next.set("openskilldialog", "将一张牌当做" + get.translation(card) + "使用");
				next.set("norestore", true);
				next.set("addCount", false);
				next.set("_backupevent", "clanfuxun_backup");
				next.set("custom", {
					add: {},
					replace: { window() {} },
				});
				next.backup("clanfuxun_backup");
				await next;
			}
		},
		ai: {
			order(item, player) {
				var evtx = _status.event.getParent("phaseUse");
				if (
					game.hasPlayer(current => {
						if (current == player || !evtx || get.attitude(player, current) == 0) {
							return false;
						}
						return (
							!current.hasHistory("lose", evt => {
								return evt.getParent(3).name != "clanfuxun" && evt.getParent("phaseUse") == evtx && evt.cards2.length;
							}) &&
							!current.hasHistory("gain", evt => {
								return evt.getParent().name != "clanfuxun" && evt.getParent("phaseUse") == evtx && evt.cards.length;
							}) &&
							Math.abs(player.countCards("h") - current.countCards("h")) == 2
						);
					})
				) {
					return 5;
				}
				return 1;
			},
			result: {
				target(player, target) {
					var evtx = _status.event.getParent("phaseUse");
					var num = get.sgn(get.attitude(player, target));
					var targets = game.filterPlayer(current => {
						if (current == player || !evtx || get.attitude(player, current) == 0) {
							return false;
						}
						return (
							!current.hasHistory("lose", evt => {
								return evt.getParent(3).name != "clanfuxun" && evt.getParent("phaseUse") == evtx && evt.cards2.length;
							}) &&
							!current.hasHistory("gain", evt => {
								return evt.getParent().name != "clanfuxun" && evt.getParent("phaseUse") == evtx && evt.cards.length;
							}) &&
							Math.abs(player.countCards("h") - current.countCards("h")) == 2
						);
					});
					if (targets.includes(target)) {
						if (player.countCards("h") < target.countCards("h")) {
							return get.sgn(num + 0.5) * Math.sqrt(2 - num);
						} else {
							return num * (2 + num);
						}
					}
					return get.sgn(num + 0.5) * (1 - num) * 0.25;
				},
			},
		},
		subSkill: {
			backup: {
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				position: "hes",
				filterTarget: lib.filter.filterTarget,
				selectCard: 1,
				check(card) {
					var player = _status.event.player;
					if (player.hasSkill("clanzhongliu") && get.position(card) != "h") {
						return 10 - get.value(card);
					}
					return 5 - get.value(card);
				},
				log: false,
			},
		},
	},
	clanchenya: {
		audio: 2,
		trigger: {
			global: ["useSkillAfter", "logSkill"],
		},
		filter(event, player) {
			if (event.type != "player") {
				return false;
			}
			var skill = get.sourceSkillFor(event);
			var info = get.info(skill);
			if (info.charlotte) {
				return false;
			}
			var translation = get.skillInfoTranslation(skill, event.player);
			if (!translation) {
				return false;
			}
			var match = get.plainText(translation).match(/“?出牌阶段限一次/g);
			if (!match || match.every(value => value != "出牌阶段限一次")) {
				return false;
			}
			return event.player.countCards("h") > 0;
		},
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const num = trigger.player.countCards("h");
			const result = await trigger.player
				.chooseCard("是否重铸任意张牌名字数为" + num + "的牌？", [1, Infinity], "he", (card, player) => _status.event.cards.includes(card) && player.canRecast(card), "allowChooseAll")
				.set("ai", card => {
					const val = get.value(card);
					return 6 - val;
				})
				.set(
					"cards",
					trigger.player.getCards("he", card => {
						return get.cardNameLength(card) == num;
					})
				)
				.forResult();
			if (result.bool) {
				await trigger.player.recast(result.cards);
			}
		},
	},
};
