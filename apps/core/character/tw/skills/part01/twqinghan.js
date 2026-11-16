import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twqinghan" | "twzhihuan">} */
export const groupSkills = {
	//幻姜维
	twqinghan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		//trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (event.name == "useCard" && event.card?.name != "shan") {
				return false;
			}
			return player.countCards("he", { type: "equip" }) && game.hasPlayer(current => player.canCompare(current, true));
		},
		filterTarget(card, player, target) {
			return player.canCompare(target, true);
		},
		filterCard: { type: "equip" },
		position: "he",
		discard: false,
		lose: false,
		delay: 0,
		check(card) {
			if (get.position(card) != "e") {
				return 10;
			}
			return Math.min(13, get.number(card) + 2) / Math.pow(Math.min(2, get.value(card)), 0.25);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterCard: { type: "equip" },
					position: "he",
					filterTarget(card, player, target) {
						return player.canCompare(target, true);
					},
					prompt: get.prompt2(event.skill),
					ai1(card) {
						if (get.position(card) != "e") {
							return 10;
						}
						return Math.min(13, get.number(card) + 2) / Math.pow(Math.min(2, get.value(card)), 0.25);
					},
					ai2(target) {
						const player = get.player(),
							att = get.attitude(player, target);
						const hs = player.getCards("he", { type: "equip" }).sort(function (a, b) {
							return a.number - b.number;
						});
						const ts = target.getCards("h").sort(function (a, b) {
							return a.number - b.number;
						});
						if (!hs.length || !ts.length) {
							return 0;
						}
						if (hs[0].number <= ts[0].number) {
							return -3 * att;
						}
						if (player.countCards("h") >= target.countCards("h")) {
							return -10 * att;
						}
						return -1 * att;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const card = event.cards[0],
				target = event.targets[0];
			const result = await player
				.chooseToCompare(target)
				.set("fixedResult", { [player.playerid]: card })
				.forResult();
			const cards = get.inpileVCardList(info => {
				if (info[0] != "trick") {
					return false;
				}
				return player.canUse({ name: info[2] }, target, false);
			});
			if (result.bool && cards.length) {
				const { links } = await player
					.chooseButton([`请选择你要对${get.translation(target)}使用的牌`, [cards, "vcard"]])
					.set("ai", button => {
						const player = get.player(),
							target = get.event().target;
						return get.effect(target, { name: button.link[2] }, player, player);
					})
					.set("target", target)
					.forResult();
				if (links && links.length) {
					const card = new lib.element.VCard({ name: links[0][2], isCard: true });
					await player.useCard(card, target, false);
				}
			}
			if (!result.bool) {
				const card1 = result.player,
					card2 = result.target;
				await player.gain([card1, card2].filterInD("d"), "gain2");
				//player.tempBanSkill(event.name);
			}
		},
		ai: {
			order: 4,
			result: {
				target(player, target) {
					const hs = player.getCards("he", { type: "equip" }).sort(function (a, b) {
						return a.number - b.number;
					});
					const ts = target.getCards("h").sort(function (a, b) {
						return a.number - b.number;
					});
					if (!hs.length || !ts.length) {
						return 0;
					}
					if (hs[0].number <= ts[0].number) {
						return -3;
					}
					if (player.countCards("h") >= target.countCards("h")) {
						return -10;
					}
					return -1;
				},
			},
		},
	},
	twzhihuan: {
		audio: 2,
		/*trigger: {
			source: "damageBegin2",
		},
		filter(event, player) {
			return (
				event.card &&
				event.card.name == "sha" &&
				event.getParent().type == "card" &&
				(event.player.countGainableCards(player, "e") ||
					Array.from({ length: 5 })
						.map((_, i) => i + 1)
						.some(i => player.hasEmptySlot(i)))
			);
		},
		logTarget: "player",*/
		trigger: {
			global: "phaseEnd",
		},
		filter(event, player) {
			return (
				player
					.getHistory("lose", evt => evt.cards2?.length)
					.map(evt => evt.cards2.map(card => get.type2(card)))
					.flat()
					.unique().length > 1
			);
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			const choices = [];
			const choiceList = [`获得${get.translation(target)}装备区一张牌`, `获得并使用一张牌堆或弃牌堆中空置装备栏对应类别的装备牌`];
			if (trigger.player.countGainableCards(player, "e")) {
				choices.push("选项一");
			} else {
				choiceList[0] = '<span style="opacity:0.5;">' + choiceList[0] + "</span>";
			}
			if (
				Array.from({ length: 5 })
					.map((_, i) => i + 1)
					.some(i => player.hasEmptySlot(i))
			) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5;">' + choiceList[1] + "</span>";
			}
			const { control } = await player
				.chooseControl(choices, "cancel2")
				.set("prompt", get.prompt(event.skill))
				.set("choiceList", choiceList)
				.set("ai", () => {
					const choices = get.event().controls.slice();
					const player = get.player(),
						evt = get.event().getTrigger(),
						target = evt.player;
					const eff = get.damageEffect(target, player, player, evt.nature),
						att = get.attitude(player, target);
					if (att > 0) {
						if (eff >= 0) {
							return "cancel2";
						}
						return "选项二";
					}
					if (eff <= 0) {
						if (choices.includes("选项一")) {
							return "选项一";
						}
						return "选项二";
					}
					if (
						(target.hp == 1 && att < 0) ||
						evt.num > 1 ||
						player.hasSkill("tianxianjiu") ||
						player.hasSkill("luoyi2") ||
						player.hasSkill("reluoyi2")
					) {
						return "cancel2";
					}
					if (
						choices.includes("选项一") &&
						target.countCards("e", card => {
							return get.effect(player, card, player, player) > 0;
						})
					) {
						return "选项一";
					}
					return "选项二";
				})
				.forResult();
			event.result = {
				bool: control != "cancel2",
				cost_data: control,
			};
		},
		async content(event, trigger, player) {
			//trigger.cancel();
			if (event.cost_data == "选项一") {
				await player.gainPlayerCard(trigger.player, "e", true);
			} else {
				for (let i = 1; i < 7; i++) {
					if (player.hasEmptySlot(i)) {
						const sub = "equip" + i,
							equip = get.cardPile(card => get.subtype(card, false) == sub && player.hasUseTarget(card));
						if (equip) {
							player.$gain2(equip);
							await game.delayx();
							await player.chooseUseTarget(equip, "nothrow", "nopopup", true);
							break;
						}
					}
				}
			}
		},
		group: "twzhihuan_compare",
		subSkill: {
			compare: {
				trigger: {
					player: "compare",
					target: "compare",
				},
				filter(event, player) {
					//if (!player.hasAllHistory("useCard", evt => get.type(evt.card) == "equip")) {
					if (!player.getDamagedHp()) {
						return false;
					}
					if (event.player == player) {
						return !event.iwhile;
					}
					return true;
				},
				forced: true,
				async content(event, trigger, player) {
					//const num = player.getAllHistory("useCard", evt => get.type(evt.card) == "equip").length * 2;
					const num = player.getDamagedHp();
					if (player == trigger.player) {
						trigger.num1 += num;
						if (trigger.num1 > 13) {
							trigger.num1 = 13;
						}
					} else {
						trigger.num2 += num;
						if (trigger.num2 > 13) {
							trigger.num2 = 13;
						}
					}
					game.log(player, "的拼点牌点数+", "#g", num);
				},
			},
		},
	},
};
