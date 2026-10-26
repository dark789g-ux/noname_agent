import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqianxi" | "olsibing" | "olliance" | "olfuhun" | "olchaozheng">} */
export const groupSkills = {
	//OL界马岱
	olqianxi: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard(get.prompt2(event.skill), "he")
				.set("ai", card => {
					const player = get.player();
					let value = 0;
					if (get.tag(card, "damage") && get.type(card) != "delay") {
						value += player.getUseValue(card);
					}
					value += get.color(card, player) == "red" ? 7 - get.value(card, player) : 6 - get.value(card, player);
					return value;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const card = event.cards[0],
				color = get.color(card, player);
			await player.showCards(card, `${get.translation(player)}发动了〖${get.translation(event.name)}〗`);
			player.addTempSkill(event.name + "_damage");
			player.addGaintag(card, event.name + "_damage");
			const targets = game
				.filterPlayer(target => {
					return player != target && get.distance(player, target) == 1;
				})
				.sortBySeat();
			if (targets.length) {
				player.line(targets, "green");
				targets.forEach(target => {
					target.addTempSkill(event.name + "_effect");
					target.markAuto(event.name + "_effect", [color]);
				});
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (tag !== "directHit_ai" || !arg.target.hasSkill("olqianxi_effect")) {
					return false;
				}
				if (arg.card.name == "sha") {
					return (
						arg.target.getStorage("olqianxi_effect").includes("red") &&
						(!arg.target.hasSkillTag(
							"freeShan",
							false,
							{
								player: player,
								card: arg.card,
								type: "use",
							},
							true
						) ||
							player.hasSkillTag("unequip", false, {
								name: arg.card ? arg.card.name : null,
								target: arg.target,
								card: arg.card,
							}) ||
							player.hasSkillTag("unequip_ai", false, {
								name: arg.card ? arg.card.name : null,
								target: arg.target,
								card: arg.card,
							}))
					);
				}
				return arg.target.getStorage("olqianxi_effect").includes("black");
			},
		},
		subSkill: {
			damage: {
				audio: "olqianxi",
				charlotte: true,
				forced: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return (
						event.card &&
						player.hasHistory("lose", evt => {
							return evt.getParent() == event.getParent("useCard") && Object.values(evt.gaintag_map).flat().includes("olqianxi_damage");
						})
					);
				},
				content() {
					trigger.num++;
				},
				mod: {
					aiOrder(player, card, num) {
						if (get.itemtype(card) == "card" && card.hasGaintag("olqianxi_damage") && get.event().name == "chooseToUse") {
							return num + 0.5;
						}
					},
				},
			},
			effect: {
				charlotte: true,
				onremove: true,
				mod: {
					cardEnabled2(card, player) {
						if (player.getStorage("olqianxi_effect").includes(get.color(card, player)) && get.position(card) == "h") {
							return false;
						}
					},
				},
				intro: {
					markcount: () => 0,
					content(storage) {
						return "不能使用或打出" + get.translation(storage) + "的手牌";
					},
				},
			},
		},
	},
	//OL谋卢植
	olsibing: {
		audio: 2,
		trigger: {
			player: "useCardToPlayer",
			global: "useCardAfter",
		},
		filter(event, player, name) {
			if (name == "useCardToPlayer") {
				return get.is.damageCard(event.card) && event.targets.length == 1 && player.countDiscardableCards(player, "he", card => get.color(card, player) == "red") && !player.hasSkill("olsibing_used");
			}
			return get.is.damageCard(event.card) && event.targets?.includes(player) && !player.hasHistory("damage", evt => evt.getParent("useCard") == event) && player.countDiscardableCards(player, "he", card => get.color(card, player) == "black") && player.hasUseTarget({ name: "sha", isCard: true }, false, false);
		},
		usable: 1,
		async cost(event, trigger, player) {
			const name = event.triggername;
			if (name == "useCardToPlayer") {
				event.result = await player
					.chooseToDiscard(`###${get.prompt(event.skill, trigger.target)}###弃置任意张红色牌并令其弃置等量红色手牌，否则不能响应该牌`, [1, Infinity], "he", "chooseonly", (card, player) => get.color(card, player) == "red", "allowChooseAll")
					.set("ai", card => {
						const player = get.player(),
							target = get.event().getTrigger().target,
							cardx = get.event().getTrigger().card;
						if (get.effect(target, cardx, player, player) < 0 || cardx.name == "huogong") {
							return 0;
						}
						if (ui.selected.cards?.length == target.countCards("h", { color: "red" })) {
							return 0;
						}
						return 7 - get.value(card);
					})
					.forResult();
				if (event.result.bool) {
					event.result.targets = [trigger.target];
				}
			} else {
				event.result = await player
					.chooseToDiscard(`###${get.prompt(event.skill)}###弃置一张黑色牌并视为使用一张【杀】`, "he", "chooseonly", (card, player) => get.color(card, player) == "black")
					.set("ai", card => {
						if (!get.player().hasValueTarget({ name: "sha", isCard: true }, false, false)) {
							return 0;
						}
						return 6 - get.value(card);
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			const cards = event.cards,
				name = event.triggername;
			await player.discard(cards);
			if (name == "useCardToPlayer") {
				const target = trigger.target;
				const result = await target
					.chooseToDiscard(`司兵：请弃置${cards.length}张红色手牌，或取消令你不可响应${get.translation(trigger.card)}`, cards.length, card => {
						return get.color(card, get.player()) == "red";
					})
					.set("ai", card => {
						const trigger = get.event().getTrigger(),
							player = get.player();
						if (get.event().num > 2 || !player.canRespond(trigger) || trigger.card.name == "huogong") {
							return 0;
						}
						if (player.canRespond(trigger, card)) {
							return 6 - get.value(card);
						}
						return 7 - get.value(card);
					})
					.set("num", cards.length)
					.forResult();
				if (result?.bool === false) {
					trigger.getParent().directHit.add(target);
					target.popup("不可响应");
					game.log(target, "不可响应", trigger.card);
				}
			} else {
				const card = get.autoViewAs({ name: "sha", isCard: true });
				await player.chooseUseTarget(card, true, false, "nodistance");
			}
		},
		subSkill: { used: { charlotte: true } },
	},
	olliance: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["loseAsyncAfter", "equipAfter", "addToExpansionAfter", "gainAfter", "addJudgeAfter"],
		},
		usable: 1,
		filter(event, player) {
			const bool1 = event.getg && event.getg(player)?.length,
				bool2 = event.getl && event.getl(player)?.hs?.length;
			return (bool1 || bool2) && player.isMinHandcard() && player.countCards("h") < player.maxHp && !player.getStorage("olliance_used").length;
		},
		check(event, player) {
			return player.countCards("h") < player.maxHp;
		},
		async content(event, trigger, player) {
			player.addTempSkill(event.name + "_used", "roundStart");
			player.markAuto(event.name + "_used", _status.currentPhase == player ? "isMe" : "notMe");
			await player.drawTo(player.maxHp);
			player.addTempSkill(event.name + "_damage");
			player.addMark(event.name + "_damage", 1, false);
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			damage: {
				audio: "olliance",
				charlotte: true,
				forced: true,
				forceDie: true,
				onremove: true,
				trigger: { global: "damageBegin1" },
				content() {
					trigger.num += player.countMark(event.name);
					player.removeSkill(event.name);
				},
				mark: true,
				intro: {
					content: "本回合下一次有角色造成的伤害+#",
				},
			},
		},
	},
	//OL界关兴张苞
	olfuhun: {
		inherit: "fuhun",
		position: "hes",
		global: ["olfuhun_block"],
		group: ["olfuhun_effect"],
		prompt: "将两张牌当杀使用或打出",
		viewAsFilter(player) {
			return player.countCards("hes") > 1;
		},
		subSkill: {
			effect: {
				audio: "olfuhun",
				trigger: {
					source: "damageSource",
				},
				forced: true,
				filter(event, player) {
					if (["new_rewusheng", "olpaoxiao"].every(skill => player.hasSkill(skill, null, false, false))) {
						return false;
					}
					return player.isPhaseUsing() && event.card?.name == "sha";
				},
				content() {
					player.addTempSkills(["new_rewusheng", "olpaoxiao"]);
				},
			},
			//根据思召剑和谋韩当的弓骑修改
			block: {
				mod: {
					cardEnabled(card, player) {
						let evt = get.event();
						if (evt.name != "chooseToUse") {
							evt = evt.getParent("chooseToUse");
						}
						if (!evt?.respondTo || !evt.respondTo[0].hasSkill("olfuhun") || !get.is.convertedCard(evt.respondTo[1])) {
							return;
						}
						const color1 = get.color(card),
							color2 = get.color(evt.respondTo[1]),
							hs = player.getCards("h"),
							cards = [card];
						if (color1 === "unsure") {
							return;
						}
						if (Array.isArray(card.cards)) {
							cards.addArray(card.cards);
						} else {
							return false;
						}
						if (color1 != color2 || !cards.containsSome(...hs)) {
							return false;
						}
					},
				},
				charlotte: true,
			},
		},
	},
	//闪刘宏
	olchaozheng: {
		audio: "jsrgchaozheng",
		logAudio: index => (typeof index === "number" ? "jsrgchaozheng" + index + ".mp3" : ["jsrgchaozheng1.mp3", "jsrgchaozheng2.mp3"]),
		inherit: "jsrgchaozheng",
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			return game.hasPlayer(i => i != player && i.countCards("h"));
		},
		logTarget(event, player) {
			return game.filterPlayer(i => i != player && i.countCards("h"));
		},
		prompt2() {
			return lib.translate["olchaozheng_info"].split("②")[0].slice(1);
		},
		content() {
			player.chooseToDebate(game.filterPlayer(current => current.countCards("h"))).set("callback", async (event, trigger, player) => {
				const { debateResult: result } = event;
				const { bool, opinion, targets, opinions } = result;
				if (bool && opinion) {
					if (opinion && ["red", "black"].includes(opinion)) {
						player.logSkill("olchaozheng", targets, null, null, [opinion == "red" ? 3 : 4]);
						for (const target of result.red
							.map(i => i[0])
							.unique()
							.sortBySeat()) {
							if (target === player && opinion !== "red") {
								continue;
							}
							await target[opinion == "red" ? "recover" : "loseHp"]();
						}
					}
				}
				const ops = opinions.filter(i => result[i].flat().includes(player));
				if (ops) {
					await player.draw(
						Math.min(
							2,
							ops.reduce((sum, op) => sum + result[op].map(i => i[0]).unique().length, 0)
						)
					);
				}
			});
		},
		group: "olchaozheng_debate",
		subSkill: {
			debate: {
				audio: "olchaozheng",
				trigger: { global: "debateShowOpinion" },
				filter(event, player) {
					return event.targets.includes(player) && event.opinions.some(i => event[i].flat().includes(player));
				},
				forced: true,
				locked: false,
				content() {
					const ops = trigger.opinions.filter(i => trigger[i].flat().includes(player));
					for (const op of ops) {
						for (const list of trigger[op]) {
							if (list[0] === player) {
								const color = typeof list[1] == "string" ? list[1] : get.color(list[1], list[0]);
								trigger[op].push([player, color]);
								game.log(player, "的", "#g" + get.translation(color) + "意见+1");
								break;
							}
						}
					}
				},
			},
		},
	},
};
