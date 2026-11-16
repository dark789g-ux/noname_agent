import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twguihan" | "twrenxian" | "twyanzuo" | "twciyin" | "twchenglong">} */
export const groupSkills = {
	//幻刘禅
	twguihan: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.twguihan.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h");
		},
		selectTarget: [1, 3],
		usable: 1,
		multiline: true,
		multitarget: true,
		async content(event, trigger, player) {
			const card = get.cards(1, true)[0];
			await player.showCards([card], get.translation(player) + "发动了【归汉】");
			let num = 0;
			for (const target of event.targets.sortBySeat()) {
				const result = await target
					.chooseCard("归汉：将一张" + get.translation(get.type2(card)) + "牌置于牌堆顶，或失去1点体力", (card, player) => {
						return get.type2(card) == get.event().type;
					})
					.set("type", get.type2(card))
					.set("ai", card => {
						const player = get.player();
						if (get.effect(player, { name: "losehp" }, player, player) > 0) {
							return 0;
						}
						return 7 - get.value(card);
					})
					.forResult();
				if (!result.bool) {
					await target.loseHp();
				} else {
					num++;
					target.$throw(1, 1000);
					await target.lose(result.cards, ui.cardPile, "insert");
					game.log(target, "将一张牌置于了牌堆顶");
				}
				await game.delayx();
			}
			const { index } = await player
				.chooseControl()
				.set("choiceList", ["摸" + get.cnNumber(num) + "张牌", "获得牌堆顶第" + get.cnNumber(num) + "张牌下的两张牌"])
				.set("prompt", "归汉：请选择一项")
				.set("ai", () => {
					const player = get.player(),
						index = num >= 3 - num ? 0 : 1;
					return player.hasSkillTag("nogain") ? 1 - index : index;
				})
				.set("num", num)
				.forResult();
			if (index == 0 && num > 0) {
				await player.draw(num);
			} else if (ui.cardPile.childElementCount > num) {
				const gains = Array.from(ui.cardPile.childNodes).slice(num, num + 2);
				if (gains.length > 0) {
					await player.gain(gains, "gain2");
				}
			}
		},
		ai: {
			order: 1,
			threaten: 4.5,
			result: { target: -1 },
		},
	},
	twrenxian: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("h", card => get.name(card) !== "shan" && get.type(card) === "basic");
		},
		usable: 1,
		filterTarget: lib.filter.notMe,
		filterCard: card => get.name(card) !== "shan" && get.type(card) === "basic",
		selectCard: -1,
		lose: false,
		discard: false,
		delay: false,
		position: "h",
		async content(event, trigger, player) {
			const target = event.target;
			await player.give(event.cards, target);
			target.addTempSkill("twrenxian_phase", { player: "twrenxian_phaseAfter" });
			target.markAuto("twrenxian_phase", event.cards);
		},
		ai: {
			order: 0.01,
			threaten: 4.5,
			result: { target: 1 },
		},
		locked: false,
		mod: {
			aiOrder(player, card, num) {
				const cards = player.getCards("h", { type: "basic" });
				if (cards.length === 1 && cards.includes(card) && game.hasPlayer(target => target != player && get.attitude(player, target) > 0)) {
					return 0;
				}
			},
		},
		subSkill: {
			phase: {
				charlotte: true,
				onremove: true,
				trigger: { global: "phaseAfter" },
				forced: true,
				popup: false,
				content() {
					const next = player.insertPhase();
					next.set("phaseList", ["phaseUse"]);
					const cardsx = player.getStorage("twrenxian_phase");
					player
						.when({ global: "phaseBegin" }, false)
						.assign({ firstDo: true })
						.filter(evt => evt.skill == "twrenxian_phase")
						.step(async () => {
							player.addTempSkill("twrenxian_mark", "phaseAfter");
							player.markAuto("twrenxian_mark", cardsx);
						})
						.finish();
				},
			},
			mark: {
				mark: true,
				charlotte: true,
				onremove: true,
				marktext: "令",
				intro: {
					markcount: () => 0,
					content: "执行一个仅有出牌阶段的额外回合",
				},
				mod: {
					cardEnabled(card, player) {
						if (
							[card].concat(card.cards || []).some(c => get.itemtype(c) === "card" && !player.getStorage("twrenxian_mark").includes(c))
						) {
							return false;
						}
					},
					cardSavable(card, player) {
						if (
							[card].concat(card.cards || []).some(c => get.itemtype(c) === "card" && !player.getStorage("twrenxian_mark").includes(c))
						) {
							return false;
						}
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return Infinity;
						}
					},
				},
			},
		},
	},
	twyanzuo: {
		audio: 2,
		trigger: { global: "damageSource" },
		filter(event, player) {
			if (event.getParent("phase").skill !== "twrenxian_phase") {
				return false;
			}
			const source = event.source;
			return source && source != player && source.group == "shu";
		},
		usable: 2,
		zhuSkill: true,
		forced: true,
		logTarget: "source",
		content() {
			player.draw(2);
		},
	},
	//李赵
	twciyin: {
		audio: 2,
		global: "beOfOneHeart",
		oneHeart: true,
		trigger: {
			global: "phaseZhunbeiBegin",
		},
		filter(event, player) {
			const target = event.player;
			return player == target || player.getStorage("beOfOneHeartWith").includes(target);
		},
		async content(event, trigger, player) {
			const num = Math.min(trigger.player.getHp() * 2, 10);
			const cards = get.cards(num, true);
			await player.showCards(cards);
			const gain = cards.filter(card => ["heart", "spade"].includes(get.suit(card)));
			if (!gain.length) {
				return;
			}
			const { links } = await player
				.chooseButton(["慈荫：你可以将其中任意张黑桃/红桃牌置于武将牌上", gain], [1, Infinity], "allowChooseAll")
				.set("ai", get.buttonValue)
				.forResult();
			if (!links || !links.length) {
				return;
			}
			const next = player.addToExpansion(links);
			next.gaintag.add("twciyin");
			await next;
		},
		marktext: "荫",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: "twciyin_heart",
		subSkill: {
			heart: {
				audio: "twciyin",
				trigger: {
					player: "addToExpansionAfter",
				},
				filter(event, player) {
					if (!event.gaintag.includes("twciyin")) {
						return false;
					}
					const history = game.getAllGlobalHistory("everything", evt => evt.name == "twciyin_heart" && evt.player == player);
					const limit = history.map(evt => evt.cost_data).flat();
					return !limit.includes("选项一") || (!limit.includes("选项二") && player.countCards("h") < player.maxHp);
				},
				getIndex(event, player) {
					const history = game.getAllGlobalHistory("everything", evt => evt.name == "twciyin_heart" && evt.player == player);
					const limit = history.map(evt => evt.cost_data).flat();
					return Math.floor(player.getExpansions("twciyin").length / 3) - limit.length;
				},
				async cost(event, trigger, player) {
					const history = game.getAllGlobalHistory("everything", evt => evt.name == "twciyin_heart" && evt.player == player);
					const limit = history.map(evt => evt.cost_data).flat();
					const choices = [];
					const choiceList = ["增加1点体力上限并回复1点体力", "将手牌摸至体力上限"];
					if (!limit.includes("选项一")) {
						choices.push("选项一");
					} else {
						choiceList[0] = '<span style="opacity:0.5;">' + choiceList[0] + "</span>";
					}
					if (!limit.includes("选项二") && player.countCards("h") < player.maxHp) {
						choices.push("选项二");
					} else {
						choiceList[1] = '<span style="opacity:0.5;">' + choiceList[1] + "</span>";
					}
					const control =
						choices.length == 1
							? choices[0]
							: (
									await player
										.chooseControl(choices)
										.set("prompt", get.prompt(event.skill))
										.set("choiceList", choiceList)
										.set("ai", () => {
											const player = get.player(),
												num = player.maxHp - player.countCards("h");
											return get.recoverEffect(player, player, player) >
												get.effect(player, { name: "draw" }, player, player) * num
												? "选项一"
												: "选项二";
										})
										.forResult()
								).control;
					event.result = {
						bool: true,
						cost_data: [control],
					};
				},
				async content(event, trigger, player) {
					if (event.cost_data.includes("选项一")) {
						await player.gainMaxHp();
						await player.recover();
					}
					if (event.cost_data.includes("选项二")) {
						await player.drawTo(player.maxHp);
					}
				},
			},
		},
	},
	twchenglong: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return (
				game
					.getAllGlobalHistory("everything", evt => evt.name == "twciyin_heart" && evt.player == player)
					.map(evt => evt.cost_data)
					.flat().length == 2
			);
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const cards = player.getExpansions("twciyin");
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
			await player.removeSkills("twciyin");
			let list = [];
			if (_status.characterlist) {
				for (const name of _status.characterlist) {
					if (["shu", "qun"].includes(lib.character[name][1])) {
						list.push(name);
					}
				}
			} else if (_status.connectMode) {
				list = get.charactersOL(name => !["shu", "qun"].includes(lib.character[name][1]));
			} else {
				list = get.gainableCharacters(info => ["shu", "qun"].includes(info[1]));
			}
			for (const current of game.players.concat(game.dead)) {
				list.removeArray(get.nameList(current));
			}
			const filter = skill => {
				const translation = get.skillInfoTranslation(skill, player);
				if (!translation.length) {
					return false;
				}
				const info = get.info(skill);
				return (
					info &&
					!info.zhuSkill &&
					!info.limited &&
					!info.juexingji &&
					!info.hiddenSkill &&
					!info.charlotte &&
					!info.dutySkill &&
					["【杀】", "【闪】"].some(str => get.plainText(translation).includes(str))
				);
			};
			list = list.filter(name => (lib.character[name][3] || []).some(filter));
			if (!list.length) {
				return;
			}
			const skillList = {};
			list = list.randomGets(4);
			for (const name of list) {
				skillList[name] = (lib.character[name][3] || []).filter(filter).flat();
			}
			if (Object.values(skillList).length) {
				const result = await player
					.chooseButton({
						createDialog: [
							[
								[[`成龙：获得其中至多两个技能`], "addNewRow"],
								[
									list,
									(item, type, position, noclick, node) => {
										node = ui.create.button(item, "character", position, true);
										lib.setIntro(node);
										return node;
									},
								],
								[
									[
										Object.values(skillList)
											.flat()
											.map(skill => [skill, get.translation(skill)]),
										"tdnodes",
									],
								],
								[
									dialog => {
										dialog.style.setProperty("top", get.is.phoneLayout() ? "20%" : "25%", "important");
									},
									"handle",
								],
							],
						],
						forced: true,
						selectButton: [1, 2],
						ai(button) {
							const { link } = button;
							const info = get.info(link);
							if (info?.ai?.neg || info?.ai?.halfneg) {
								return 0;
							}
							return 1 + Math.random();
						},
					})
					.forResult();
				if (result?.links?.length) {
					await player.addSkills(result.links);
				}
			}
		},
		ai: { combo: "twciyin" },
	},
};
