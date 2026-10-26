import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olqiuyuan" | "oljingce" | "olsbchoulie" | "olsbzhuijiao" | "olsbnilan" | "olsbjueya">} */
export const groupSkills = {
	//OL界伏皇后
	olqiuyuan: {
		inherit: "qiuyuan",
		filter(event, player) {
			const { card } = event;
			return (
				(card.name == "sha" || (get.type(card) == "trick" && get.tag(card, "damage") && get.type(card) != "delay")) &&
				game.hasPlayer(current => {
					return current != player && !event.targets.includes(current) && lib.filter.targetEnabled(card, event.player, current);
				})
			);
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const { card } = trigger;
			const name = get.name(card),
				type = get.type2(card);
			const result = await target
				.chooseToGive(
					(card, player) => {
						const name = get.name(card, player);
						return name != get.event().namex && get.type2(name) == get.event().type;
					},
					`交给${get.translation(player)}一张不为【${get.translation(name)}】的${get.translation(type)}牌，或成为${get.translation(card)}的额外目标`,
					player
				)
				.set("ai", card => {
					const { player, target } = get.event();
					return Math.sign(Math.sign(get.attitude(player, target)) - 0.5) * get.value(card);
				})
				.set("namex", name)
				.set("type", type)
				.forResult();
			if (!result?.bool) {
				trigger.getParent().targets.push(target);
				trigger.getParent().triggeredTargets2.push(target);
				game.log(target, "成为了", card, "的额外目标");
			}
		},
	},
	//OL界郭淮
	oljingce: {
		audio: 2,
		inherit: "rejingce",
		trigger: { global: "phaseUseEnd" },
		group: "oljingce_add",
		subSkill: {
			add: {
				trigger: { player: "loseEnd" },
				silent: true,
				firstDo: true,
				filter(event, player) {
					if (_status.currentPhase !== player) {
						return false;
					}
					if (event.getParent().name != "useCard") {
						return false;
					}
					const list = player.getStorage("oljingce_effect");
					return event.cards.some(card => !list.includes(get.suit(card, player)));
				},
				async content(event, trigger, player) {
					const effect = "oljingce_effect";
					player.addTempSkill(effect);
					player.markAuto(
						effect,
						trigger.cards.map(card => get.suit(card, player))
					);
					player.storage[effect].sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
					player.addTip(effect, get.translation(effect) + player.getStorage(effect).reduce((str, suit) => str + get.translation(suit), ""));
				},
			},
			effect: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				intro: { content: "当前已使用花色：$" },
				mod: {
					maxHandcard(player, num) {
						return num + player.getStorage("oljingce_effect").length;
					},
				},
			},
		},
	},
	//OL谋张绣
	olsbchoulie: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(lib.filter.notMe, get.prompt2(event.skill))
				.set("ai", target => {
					const player = get.player();
					return player.countDiscardableCards(player, "he") * get.effect(target, { name: "sha" }, player);
				})
				.forResult();
		},
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		async content(event, trigger, player) {
			const { targets } = event;
			player.awakenSkill(event.name);
			player.addTempSkill(["olsbchoulie_buff", "olsbchoulie_excluded"]);
			player.markAuto("olsbchoulie_buff", targets);
		},
		subSkill: {
			buff: {
				audio: "olsbchoulie",
				charlotte: true,
				onremove: true,
				trigger: { player: "phaseAnyBegin" },
				getIndex(event, player) {
					const storage = player.getStorage("olsbchoulie_buff");
					const vcard = new lib.element.VCard({ name: "sha", isCard: true });
					return storage.filter(current => player.canUse(vcard, current, false)).sortBySeat();
				},
				filter(event, player) {
					return player.hasCard(card => {
						if (get.position(card) === "h" && _status.connectMode) {
							return true;
						}
						return lib.filter.cardDiscardable(card, player);
					}, "he");
				},
				async cost(event, trigger, player) {
					const target = event.indexedData;
					const list = [event.skill, target];
					event.result = await player
						.chooseToDiscard("he", "chooseonly")
						.set("prompt", get.prompt2(...list))
						.set("prompt2", `弃置一张牌，视为对${get.translation(target)}使用一张【杀】（当前为${get.translation(trigger.name)}）`)
						.set("ai", card => {
							const player = get.player(),
								target = get.event().getParent().indexedData;
							const vcard = new lib.element.VCard({ name: "sha", isCard: true });
							if (get.effect(target, vcard, player, player) > 0) {
								return 7 - get.value(card);
							}
							return 0;
						})
						.set("logSkill", list)
						.forResult();
				},
				popup: false,
				async content(event, trigger, player) {
					const target = event.indexedData;
					await player.discard(event.cards);
					const vcard = new lib.element.VCard({ name: "sha", isCard: true });
					if (player.canUse(vcard, target, false)) {
						await player.useCard(vcard, target, false);
					}
				},
			},
			excluded: {
				charlotte: true,
				trigger: { global: "useCardToTargeted" },
				filter(event, player) {
					return event.getParent(2).name == "olsbchoulie_buff" && player.getStorage("olsbchoulie_buff").includes(event.target);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const { target } = trigger;
					const result = await target
						.chooseToDiscard(`仇猎：你可以弃置一张基本牌或武器牌，令${get.translation(trigger.card)}对你无效`, "he")
						.set("filterCard", card => {
							return get.type(card) == "basic" || get.subtypes(card).includes("equip1");
						})
						.set("ai", card => {
							const player = get.player(),
								trigger = get.event().getTrigger();
							return -get.effect(player, trigger.card, trigger.player, player) - get.value(card);
						})
						.forResult();
					if (result?.bool) {
						trigger.excluded.add(target);
						game.log(trigger.card, "对", target, "无效");
						await game.delayx();
					}
				},
			},
		},
	},
	olsbzhuijiao: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			const evtx = get.info("dcjianying").getLastUsed(player, event);
			if (!evtx) {
				return false;
			}
			return !player.hasHistory("sourceDamage", evt => evt.card == evtx.card);
		},
		forced: true,
		async content(event, trigger, player) {
			await player.draw();
			trigger.baseDamage++;
			player.addTempSkill("olsbzhuijiao_debuff");
			trigger.olsbzhuijiao = true;
		},
		subSkill: {
			debuff: {
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					if (!event.olsbzhuijiao) {
						return false;
					}
					return !player.hasHistory("sourceDamage", evt => evt.card == event.card);
				},
				forced: true,
				popup: false,
				content() {
					player.chooseToDiscard("he", true);
				},
			},
		},
	},
	//OL谋赵云
	olsbnilan: {
		audio: 2,
		trigger: { source: "damageSource" },
		filter(event, player) {
			return !event.getParent().name?.startsWith("olsbnilan");
		},
		async cost(event, trigger, player) {
			const result = await player
				.chooseButton([
					get.prompt(event.skill),
					[
						[
							["discard", "弃置所有手牌"],
							["draw", "摸两张牌"],
						],
						"textbutton",
					],
				])
				.set("filterButton", button => {
					if (button.link == "discard") {
						const player = get.player();
						return player.countCards("h") && !player.hasCard(card => !lib.filter.cardDiscardable(card, player, "olsbnilan"), "h");
					}
					return true;
				})
				.set("ai", button => {
					const player = get.player();
					const { link } = button;
					if (link == "discard") {
						return player.countCards("h") < 4 && game.hasPlayer(current => current != player && get.damageEffect(current, player, player) > 0) && player.countCards("h", "sha");
					}
					if (link == "draw") {
						return 1;
					}
					return 0;
				})
				.forResult();
			event.result = {
				bool: result?.bool,
				cost_data: result?.links?.[0],
			};
		},
		choice: {
			async discard(player) {
				const cards = player.getCards("h");
				if (cards.length) {
					await player.discard(cards);
					if (cards.some(card => get.name(card) == "sha")) {
						const result = await player
							.chooseTarget("对一名其他角色造成1点伤害", lib.filter.notMe)
							.set("ai", target => {
								const player = get.player();
								return get.damageEffect(target, player, player);
							})
							.forResult();
						if (result?.bool && result?.targets?.length) {
							player.line(result.targets);
							await result.targets[0].damage();
						}
					}
				}
			},
			async draw(player) {
				await player.draw(2);
			},
		},
		async content(event, trigger, player) {
			const { cost_data } = event;
			player.addSkill("olsbnilan_buff");
			if (cost_data == "discard") {
				player.markAuto("olsbnilan_buff", ["draw"]);
				await lib.skill.olsbnilan.choice.discard(player);
			} else {
				player.markAuto("olsbnilan_buff", ["discard"]);
				await lib.skill.olsbnilan.choice.draw(player);
			}
		},
		subSkill: {
			buff: {
				audio: "olsbnilan",
				charlotte: true,
				onremove: true,
				trigger: { player: "damageEnd" },
				prompt2(event, player) {
					const list = player.getStorage("olsbnilan_buff").toUniqued();
					return `你可以${list.length > 0 ? "依次" : ""}执行：<br>${list
						.map(type => {
							if (type == "draw") {
								return "摸两张牌";
							}
							return "弃置所有手牌，然后若其中有【杀】，你可以对一名其他角色造成1点伤害";
						})
						.join("；<br>")}。`;
				},
				async content(event, trigger, player) {
					const list = player.getStorage(event.name);
					player.removeSkill(event.name);
					for (const i of list) {
						await lib.skill.olsbnilan.choice[i](player);
					}
				},
			},
		},
	},
	olsbjueya: {
		audio: 2,
		enable: "chooseToUse", // "chooseToRespond", // 没有打出喵
		hiddenCard(player, name) {
			return get.type(name) == "basic" && !player.countCards("h") && !player.getStorage("olsbjueya").includes(name);
		},
		marktext: "崖",
		onremove: true,
		intro: { content: "已以此法使用过$" },
		filter(event, player) {
			if (event.type == "wuxie" || player.countCards("h")) {
				return false;
			}
			return get.inpileVCardList(info => {
				if (info[0] != "basic" || player.getStorage("olsbjueya").includes(info[2])) {
					return false;
				}
				return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
			}).length;
		},
		chooseButton: {
			dialog(event, player) {
				const list = get.inpileVCardList(info => {
					if (info[0] != "basic" || player.getStorage("olsbjueya").includes(info[2])) {
						return false;
					}
					return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
				});
				return ui.create.dialog("绝崖", [list, "vcard"], "hidden");
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				return {
					audio: "olsbjueya",
					filterCard: () => false,
					selectCard: -1,
					popname: true,
					viewAs: { name: links[0][2], nature: links[0][3], isCard: true },
					async precontent(event, trigger, player) {
						player.markAuto("olsbjueya", event.result.card.name);
					},
				};
			},
			prompt(links, player) {
				return "选择【" + get.translation(links[0][2]) + "】的目标";
			},
		},
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				const name = tag == "respondSha" ? "sha" : "shan";
				return get.info("olsbjueya").hiddenCard(player, name);
			},
			order: 2,
			result: {
				player(player) {
					if (get.event().dying) {
						return get.attitude(player, get.event().dying);
					}
					return 1;
				},
			},
		},
		subSkill: { backup: {} },
	},
};
