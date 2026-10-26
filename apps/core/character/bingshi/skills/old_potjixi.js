import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "old_potjixi" | "old_potzaoxian" | "potgongmou" | "potzhengshuo" | "potjiejie" | "potqingshi">} */
export const groupSkills = {
	old_potjixi: {
		audio: "potjixi",
		mod: {
			targetInRange(card) {
				if (card.storage?.old_potjixi) {
					return true;
				}
			},
		},
		enable: ["chooseToUse", "chooseToRespond"],
		hiddenCard(player, name) {
			if (player.hasSkill("old_pottuntian", null, null, false) && player.hasMark("old_potzaoxian") && player.getExpansions("old_pottuntian").some(card => card.name == name)) {
				return true;
			}
		},
		filter(event, player) {
			if (event.responded || event.old_potjixi || !player.hasSkill("old_pottuntian", null, null, false) || !player.hasMark("old_potzaoxian")) {
				return false;
			}
			return player.getExpansions("old_pottuntian").some(card => event.filterCard(get.autoViewAs({ name: card.name, nature: card.nature, storage: { old_potjixi: true } }, [card]), player, event));
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("急袭", player.getExpansions("old_pottuntian"), "hidden");
			},
			filter(button, player) {
				const evt = _status.event.getParent();
				return evt.filterCard(get.autoViewAs({ name: button.link.name, nature: button.link.nature, storage: { old_potjixi: true } }, [button.link]), player, evt);
			},
			check(button) {
				const card = button.link,
					player = get.player();
				return player.getUseValue({
					name: card.name,
					nature: card.nature,
					storage: { old_potjixi: true },
				});
			},
			backup(links, player) {
				return {
					audio: "potjixi",
					filterCard(card) {
						return card === lib.skill.old_potjixi_backup.card;
					},
					selectCard: -1,
					viewAs: {
						name: links[0].name,
						nature: links[0].nature,
						storage: { old_potjixi: true },
					},
					card: links[0],
					position: "x",
					async precontent(event, trigger, player) {
						player.removeMark("old_potzaoxian", 1);
						event.result.card = get.autoViewAs(event.result.cards?.[0]);
						event.getParent()?.set("addCount", false);
						game.log(event.result.cards?.[0], "不计入次数");
					},
				};
			},
			prompt(links, player) {
				return "急袭：请选择" + get.translation(links[0]) + "的目标";
			},
		},
		ai: {
			combo: ["old_pottuntian", "old_potzaoxian"],
			effect: {
				target(card, player, target, effect) {
					if (get.tag(card, "respondShan")) {
						return 0.7;
					}
					if (get.tag(card, "respondSha")) {
						return 0.7;
					}
				},
			},
			order: 9,
			respondShan: true,
			respondSha: true,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			backup: { audio: "potjixi" },
		},
	},
	old_potzaoxian: {
		audio: "potzaoxian",
		trigger: {
			global: "phaseEnd",
		},
		filter(event, player) {
			if (!player.hasSkill("old_pottuntian", null, null, false)) {
				return false;
			}
			const num = player.countCharge();
			return [0, 3].includes(num);
		},
		forced: true,
		async content(event, trigger, player) {
			player.addMark("old_potzaoxian", 1);
		},
		marktext: "峥",
		intro: {
			name: "峥嵘",
			content: "mark",
		},
		ai: {
			combo: ["old_pottuntian", "old_potjixi"],
		},
	},
	//势桓阶（传奇搅屎棍，新时代鲁大师）
	potgongmou: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(target => {
				if (target == player || target.countCards("h") + player.countCards("h") == 0) {
					return false;
				}
				return true;
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget("你可发动共谋，与1名其他角色交换手牌并获得技能", (card, player, target) => {
					if (target == player || target.countCards("h") + player.countCards("h") == 0) {
						if (target != player) {
							target.prompt("没牌交换", "fire");
						}
						return false;
					}
					return true;
				})
				.set("ai", target => {
					const player = get.player();
					return -get.attitude(player, target) * (target.countCards("h") - player.countCards("h"));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.swapHandcards(target);
			await player.addTempSkills(get.info(event.name).derivation[0]);
			await target.addTempSkills(get.info(event.name).derivation[1]);
		},
		derivation: ["qice", "kanpo"],
		ai: {
			threaten: 3,
		},
	},
	potzhengshuo: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		filter(event, player) {
			return true;
			//return !game.hasPlayer(target => target.countCards("h") == 4);
		},
		filterTarget: true,
		selectTarget: -1,
		multiline: true,
		multitarget: true,
		line: "thunder",
		prompt: "你可令全场角色依次弃置所有手牌，然后洗牌并重新分发手牌",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const { targets } = event;
			player.chat("新年好啊！");
			await game.doAsyncInOrder(targets, async target => target.modedDiscard(target.getCards("h")));
			await game.washCard();
			player.chat("发牌！");
			await game.asyncDraw(targets.sortBySeat(), 4);
		},
		ai: {
			//贯彻搅屎棍精神，有大直接开
			//孩子们，有人对这个AI哈气了
			order: 114514,
			threaten: 1919810,
			result: {
				player(player, target) {
					if (player.hasUnknown()) {
						return 0;
					}
					return game.countPlayer(current => {
						const att = Math.sign(Math.sign(get.attitude(player, current)) - 0.5);
						return (4 - current.countCards("h")) * att;
					});
				},
			},
		},
	},
	//势辛宪英
	potjiejie: {
		global: "potjiejie_global",
		audio: 2,
		subSkill: {
			global: {
				audio: "potjiejie",
				enable: "phaseUse",
				filter(event, player) {
					if (player != _status.currentPhase) {
						return false;
					}
					if (!player.countCards("h") || player.hasSkill("potjiejie_used")) {
						return false;
					}
					return game.hasPlayer(current => current.hasSkill("potjiejie"));
				},
				filterTarget(card, player, target) {
					return target.hasSkill("potjiejie");
				},
				selectTarget() {
					if (
						game.countPlayer(current => {
							return current.hasSkill("potjiejie");
						}) > 1
					) {
						return 1;
					}
					return -1;
				},
				prompt() {
					const player = get.player(),
						targets = game.filterPlayer(current => {
							return current.hasSkill("potjiejie");
						});
					let list = get.translation(targets);
					if (targets.length > 1) {
						list += "中的一人";
					}
					if (targets.length == 1 && targets[0] == player) {
						return "观看自己手牌并选择花色执行对应效果";
					}
					return `令${list}观看你的手牌并选择花色执行效果`;
				},
				prepare(cards, player, targets) {
					targets[0].logSkill("potjiejie", [player]);
				},
				log: false,
				manualConfirm: true,
				async content(event, trigger, player) {
					const target = event.target;
					player.addTempSkill("potjiejie_used", "phaseUseAfter");
					//await target.viewHandcards(player);
					game.addCardKnower(player.getCards("h"), target);
					player.getHistory("custom").push({
						potjiejie: true,
						suits: player
							.getCards("h")
							.map(card => get.suit(card, player))
							.toUniqued(),
						target: target,
					});
					const list = get.addNewRowList(player.getCards("h"), "suit", player);
					const result = await target
						.chooseButton([
							[
								[[`诫节：请选择一个花色<div class="text center">若${get.translation(player)}手牌包含此花色，其本回合使用此花色的牌无次数限制，然后弃置其余花色的手牌，否则其获得此花色的一张牌</div>`], "addNewRow"],
								[
									dialog => {
										dialog.classList.add("fullheight");
										dialog.forcebutton = false;
										dialog._scrollset = false;
									},
									"handle",
								],
								list.map(item => [Array.isArray(item) ? item : [item], "addNewRow"]),
							],
						])
						.set("ai", button => {
							const { player, target } = get.event();
							const att = get.attitude(player, target);
							const { links } = button;
							const hs = target.getCards("h");
							if (att > 0) {
								if (!links.length) {
									return 2;
								}
								if (links.filter(card => card.name == "sha" && target.getUseValue(card, true, false)).length > 1 && hs.length - links.length < 3) {
									return 1;
								}
								return get.event().getRand();
							} else if (att <= 0) {
								if (!links.length) {
									return 0;
								}
								if (links.length < 2) {
									return 2;
								}
								if (links.filter(card => card.name == "sha" && target.getUseValue(card, true, false)).length < 2) {
									return 1;
								}
								return 0;
							}
						})
						.set("target", player)
						.forResult();
					if (result?.links?.length) {
						const [choice] = result.links;
						game.log(target, "选择了" + get.translation(choice));
						target.popup(choice);
						if (player.hasCard(card => get.suit(card, player) == choice, "h")) {
							const skill = "potjiejie_effect";
							player.markAuto(skill, [choice]);
							player.addTip(
								skill,
								`诫节${player
									.getStorage(skill)
									.sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a))
									.map(suit => get.translation(suit))
									.join("")}`
							);
							player.addTempSkill(skill);
							await player.modedDiscard(player.getCards("h", card => get.suit(card, player) != choice));
						} else {
							const card = get.cardPile2(card => {
								return get.suit(card) == choice;
							});
							if (card) {
								await player.gain(card, "gain2");
							}
						}
					}
					if (target.countMark("potjiejie_blocker") >= 2) {
						return;
					}
					let getSuits = current =>
						current
							.getRoundHistory("custom", evt => {
								return evt?.potjiejie && evt.target == target;
							})
							.reduce((arr, evt) => arr.addArray(evt?.suits || []), []);
					const num = getSuits(player).length;
					if (!game.hasPlayer(current => current != player && getSuits(current).length >= num)) {
						target.addTempSkill("potjiejie_blocker", { global: "roundStart" });
						target.addMark("potjiejie_blocker", 1, false);
						await target.useSkill("potqingshi", [player]);
					}
				},
				ai: {
					order: 5,
					result: {
						player(player, target) {
							return get.attitude(player, target);
						},
					},
				},
			},
			blocker: {
				charlotte: true,
				onremove: true,
			},
			used: {
				charlotte: true,
			},
			effect: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				mark: true,
				intro: {
					content: storage => `本回合使用${get.translation(storage)}牌无次数限制`,
				},
				mod: {
					cardUsable(card, player) {
						const list = player.getStorage("potjiejie_effect");
						const suit = get.suit(card);
						if (suit === "unsure" || list.includes(suit)) {
							return Infinity;
						}
					},
				},
			},
		},
	},
	potqingshi: {
		audio: 4,
		logAudio(event, player, triggername, _, costResult) {
			let target;
			if (event.name == "useSkill") {
				target = event.targets[0];
			} else {
				target = costResult.targets[0];
			}
			if (player.getFriends(true).includes(target)) {
				return ["potqingshi1.mp3", "potqingshi2.mp3"];
			}
			return ["potqingshi3.mp3", "potqingshi4.mp3"];
		},
		trigger: {
			player: "damageEnd",
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					const player = get.player();
					if (player.getFriends(true).includes(target)) {
						return get.effect(player, { name: "draw" }, player, player) + get.effect(target, { name: "draw" }, player, player) > 0;
					}
					return get.effect(target, { name: "guohe_copy2" }, target, player) + get.effect(player, { name: "guohe_copy2" }, player, player) > 0;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (player.getFriends(true).includes(target)) {
				await game.asyncDraw([player, target]);
			} else {
				await player.chooseToDiscard(true, "he");
				await player.discardPlayerCard(target, "he", true);
			}
		},
	},
};
