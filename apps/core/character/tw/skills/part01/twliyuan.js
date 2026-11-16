import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twliyuan" | "twjifa" | "twchenxun" | "twzenhui" | "twzenhui2" | "twfuman" | "twfuman2" | "twdanji">} */
export const groupSkills = {
	twliyuan: {
		audio: 2,
		audioname: ["huan_caoang_shadow"],
		mod: {
			targetInRange(card) {
				if (card.storage?.twliyuan) {
					return true;
				}
			},
			cardUsable(card, player, num) {
				if (card.storage?.twliyuan) {
					return Infinity;
				}
			},
		},
		enable: ["chooseToUse", "chooseToRespond"],
		filterCard(card, player) {
			return get.subtypes(card).some(i => player.hasDisabledSlot(i));
		},
		locked: false,
		viewAs: {
			name: "sha",
			storage: {
				twliyuan: true,
			},
		},
		filter(event, player) {
			return player.countCards("hes", card => get.subtypes(card).some(i => player.hasDisabledSlot(i)));
		},
		position: "hes",
		precontent() {
			event.getParent().addCount = false;
		},
		prompt: "将一张与你已废除的装备栏对应副类别的装备牌当【杀】使用或打出",
		check(card) {
			const val = get.value(card);
			if (_status.event.name == "chooseToRespond") {
				return 1 / Math.max(0.1, val);
			}
			return 6 - val;
		},
		group: "twliyuan_effect",
		subSkill: {
			effect: {
				audio: "twliyuan",
				audioname: ["huan_caoang_shadow"],
				trigger: { player: ["useCard", "respond"] },
				filter: evt => evt.skill == "twliyuan",
				forced: true,
				popup: false,
				content() {
					player.draw();
				},
			},
		},
	},
	twjifa: {
		audio: 2,
		trigger: { player: "dying" },
		forced: true,
		async content(event, trigger, player) {
			const num = player.getAllHistory("useSkill", evt => evt.skill == "twfuxi")?.lastItem?.twfuxi_num;
			if (num > 0) {
				await player.loseMaxHp(num);
			}
			const { control } = await player
				.chooseControl(["twhuangzhu", "twliyuan"])
				.set("prompt", "选择保留的技能")
				.set("ai", () => {
					return get.event().controls.randomGet();
				})
				.forResult();
			await player.recoverTo(player.maxHp);
			player.changeSkin({ characterName: "huan_caoang" }, "huan_caoang");
			await player.changeSkills(["twchihui", "twfuxi"], ["twhuangzhu", "twliyuan", "twjifa"].remove(control));
		},
	},
	//幻刘封
	twchenxun: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return game.hasPlayer(current => player.canUse({ name: "juedou", isCard: true }, current));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(
					get.prompt(event.name.slice(0, -5)),
					(card, player, target) => {
						return player.canUse({ name: "juedou", isCard: true }, target);
					},
					"视为对一名角色使用一张【决斗】"
				)
				.set("ai", target => {
					const player = get.player();
					let eff = get.effect(target, { name: "juedou" }, player, player),
						shas = target.mayHaveSha(player, "respond", null, "count") - player.mayHaveSha(player, "respond", null, "count"),
						att = get.attitude(player, target);
					if (shas > 0) {
						eff += get.effect(player, { name: "losehp" }, player, player);
					} else if (att <= 0) {
						eff += get.effect(player, { name: "draw" }, player, player);
					}
					return eff;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0],
				juedou = get.autoViewAs({ name: "juedou", isCard: true, storage: { twchenxun: true } });
			if (!player.canUse(juedou, target)) {
				return;
			}
			await player.useCard(target, juedou);
			if (target.hasHistory("damage", evt => evt.getParent(3) == event)) {
				await player.draw();
				const targetsx = game.filterPlayer(current => {
					if (!player.canUse({ name: "juedou", isCard: true }, current)) {
						return false;
					}
					return !player
						.getRoundHistory("useSkill", evt => evt.skill == "twchenxun")
						.map(evt => evt.targets[0])
						.includes(current);
				});
				if (!targetsx.length) {
					return;
				}
				const { targets } = await player
					.chooseTarget(
						get.prompt("twchenxun"),
						(card, player, target) => {
							return get.event().targetsx.includes(target);
						},
						"视为对一名本轮未以此法选择过的角色使用一张【决斗】"
					)
					.set("ai", target => {
						const player = get.player();
						let eff = get.effect(target, { name: "juedou" }, player, player),
							shas = target.mayHaveSha(player, "respond", null, "count") - player.mayHaveSha(player, "respond", null, "count"),
							att = get.attitude(player, target);
						if (shas > 0) {
							eff += get.effect(player, { name: "losehp" }, player, player);
						} else if (att <= 0) {
							eff += get.effect(player, { name: "draw" }, player, player);
						}
						return eff;
					})
					.set("targetsx", targetsx)
					.forResult();
				if (targets?.length) {
					await player.useSkill("twchenxun", targets);
				}
			} else {
				await player.loseHp();
			}
		},
	},
	//TW孙鲁班
	twzenhui: {
		audio: "xinzenhui",
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			if (event.targets.length != 1) {
				return false;
			}
			var card = event.card;
			if (card.name != "sha" && (get.type(card, null, false) != "trick" || get.color(card, false) != "black")) {
				return false;
			}
			if (!player.isPhaseUsing() || player.hasSkill("twzenhui2")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return (
					current != player &&
					current != event.target &&
					lib.filter.targetEnabled2(card, player, current) &&
					lib.filter.targetInRange(card, player, current)
				);
			});
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt2("twzenhui"), function (card, player, target) {
					if (player == target) {
						return false;
					}
					var evt = _status.event.getTrigger();
					return (
						!evt.targets.includes(target) &&
						lib.filter.targetEnabled2(evt.card, player, target) &&
						lib.filter.targetInRange(evt.card, player, target)
					);
				})
				.set("ai", function (target) {
					var trigger = _status.event.getTrigger();
					var player = _status.event.player;
					return Math.max(
						target.countGainableCards(player, "hej") ? get.effect(target, { name: "shunshou" }, player, player) : 0,
						get.effect(target, trigger.card, player, player)
					);
				});
			"step 1";
			if (result.bool) {
				player.addTempSkill("twzenhui2", "phaseUseAfter");
				var target = result.targets[0],
					str = get.translation(target);
				event.target = target;
				player.logSkill("twzenhui", target);
				if (!target.countGainableCards(player, "hej")) {
					event._result = { index: 0 };
				} else {
					player
						.chooseControl()
						.set("choiceList", [
							"令" + str + "也成为" + get.translation(trigger.card) + "的目标",
							"获得" + str + "区域里的一张牌，然后" + str + "成为" + get.translation(trigger.card) + "的使用者",
						])
						.set("ai", function () {
							var trigger = _status.event.getTrigger();
							var player = _status.event.player,
								target = _status.event.getParent().target;
							return (target.countGainableCards(player, "hej") ? get.effect(target, { name: "shunshou" }, player, player) : 0) >
								get.effect(target, trigger.card, player, player)
								? 1
								: 0;
						});
				}
			} else {
				event.finish();
			}
			"step 2";
			if (result.index == 1) {
				trigger.untrigger();
				trigger.getParent().player = event.target;
				game.log(event.target, "成为了", trigger.card, "的使用者");
				player.gainPlayerCard(target, true, "hej");
			} else {
				game.log(event.target, "成为了", trigger.card, "的额外目标");
				trigger.getParent().targets.push(event.target);
			}
		},
	},
	twzenhui2: { charlotte: true },
	//TW马忠
	twfuman: {
		group: "twfuman_draw",
		audio: "fuman",
		inherit: "fuman",
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			return !player.getStorage("twfuman_used").includes(target);
		},
		filter(event, player) {
			return (
				player.countCards("h") > 0 &&
				game.hasPlayer(function (current) {
					return lib.skill.twfuman.filterTarget(null, player, current);
				})
			);
		},
		async content(event, trigger, player) {
			const { cards, target } = event;
			player.addTempSkill(`${event.name}_used`, "phaseChange");
			player.markAuto(`${event.name}_used`, target);
			const next = player.give(cards, target);
			next.gaintag.add(event.name);
			await next;
			target.addSkill(`${event.name}2`);
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: `已发动过的目标：$`,
				},
			},
			draw: {
				audio: "fuman",
				trigger: { global: ["useCardAfter", "respondAfter"] },
				filter(event, player) {
					return event.player.getHistory("lose", function (evt) {
						if ((evt.relatedEvent || evt.getParent()) != event) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("twfuman")) {
								return true;
							}
						}
						return false;
					}).length;
				},
				forced: true,
				logTarget: "player",
				content() {
					player.draw(
						trigger.player.getHistory("sourceDamage", function (evt) {
							return evt.card == trigger.card;
						}).length
							? 2
							: 1
					);
				},
			},
		},
	},
	twfuman2: {
		charlotte: true,
		mod: {
			aiOrder(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("twfuman")) {
					return num + 1;
				}
			},
			cardname(card, player) {
				if (get.itemtype(card) == "card" && card.hasGaintag("twfuman")) {
					return "sha";
				}
			},
		},
	},
	//魏关羽
	twdanji: {
		derivation: ["mashu", "nuzhan"],
		audio: "danji",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			var zhu = get.zhu(player);
			if (zhu && zhu.isZhu) {
				if (lib.translate[zhu.name].indexOf("刘备") != -1 || (zhu.name2 && lib.translate[zhu.name2].indexOf("刘备") != -1)) {
					return false;
				}
			}
			return player.countCards("h") > player.hp;
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "water",
		content() {
			"step 0";
			player.awakenSkill(event.name);
			player.loseMaxHp();
			"step 1";
			player.addSkills(["mashu", "nuzhan"]);
			"step 2";
			player.addSkill("twdanji_effect");
		},
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				intro: { content: "每回合首次使用转化【杀】结算结束后摸一张牌" },
				audio: "danji",
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return (
						player
							.getHistory("useCard", function (evt) {
								return evt.card.name == "sha" && evt.cards && evt.cards.length && !event.card.isCard;
							})
							.indexOf(event) == 0
					);
				},
				forced: true,
				content() {
					player.draw();
				},
			},
		},
	},
};
