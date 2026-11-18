import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dclianyou" | "dccili" | "dczimu" | "dcjinggong" | "dcxiaojuan">} */
export const groupSkills = {
	// 环怀瑾
	dclianyou: {
		trigger: {
			player: ["damageEnd", "phaseBegin"],
		},
		filter(event, player) {
			return !(player.getStorage("dclianyou").includes("recover") && player.getStorage("dclianyou").includes("equip") && player.getStorage("dclianyou").includes("draw"));
		},
		async cost(event, trigger, player) {
			const choiceList = [];
			const name = "dclianyou";
			if (!player.getStorage(name).includes("recover")) {
				if (game.hasPlayer(current => current.isDamaged())) {
					choiceList.push(["recover", "令一名角色回复2点体力"]);
				}
			}
			if (!player.getStorage(name).includes("equip")) {
				choiceList.push(["equip", "令一名角色随机使用两张装备牌"]);
			}
			if (!player.getStorage(name).includes("draw")) {
				choiceList.push(["draw", "摸三张牌并可以交给一名其他角色三张牌"]);
			}
			if (choiceList.length) {
				const result = await player
					.chooseButton({
						createDialog: [get.prompt("dclianyou") + "选择一项", [choiceList, "textbutton"]],
						selectButton: 1,
						ai(button) {
							if (button.link === "recover") {
								let max = 0;
								for (const current of game.filterPlayer()) {
									const num = Math.min(current.getDamagedHp(), 2) * get.recoverEffect(current, player, player);
									if (num > max) {
										max = num;
									}
								}
								return max;
							}
							if (button.link === "draw") {
								return 3.95 + 0.1 * Math.random();
							}
							if (button.link === "equip") {
								return 4;
							}
							return 0;
						},
					})
					.set("choiceList", choiceList)
					.forResult();
				if (result.bool) {
					player.markAuto(name, result.links[0]);
					event.result = { bool: true, cost_data: { choice: result.links[0] } };
				}
			}
		},
		async content(event, trigger, player) {
			const { choice } = event.cost_data;
			if (choice === "recover") {
				const result = await player
					.chooseTarget({
						prompt: "令一名角色回复2点体力",
						filterTarget(card, player, target) {
							return target.isDamaged();
						},
						forced: true,
						ai(target) {
							return Math.min(target.getDamagedHp(), 2) * get.recoverEffect(target, player, player);
						},
					})
					.forResult();
				if (result.bool) {
					await result.targets[0].recover({ num: 2 });
				}
			} else if (choice === "equip") {
				const result = await player
					.chooseTarget({
						prompt: "选择一名角色，随机使用两张装备牌",
						forced: true,
						ai(target) {
							return get.attitude(get.player(), target);
						},
					})
					.forResult();
				if (result?.targets?.length) {
					const target = result.targets[0];
					for (let i = 1; i <= 2; i++) {
						const card = get.cardPile(card => get.type(card) === "equip" && target.canUse(card, target), undefined, "bottom");
						if (!card) break;
						await target.chooseUseTarget({
							card,
							forced: true,
							nopopup: true,
						});
					}
				}
			} else if (choice === "draw") {
				await player.draw(3);
				const result = await player
					.chooseCardTarget({
						filterTarget(card, player, target) {
							return lib.filter.notMe;
						},
						prompt: "是否交给一名其他角色三张牌？",
						selectCard: 3,
						position: "he",
						ai1(card) {
							return 1 / Math.max(0.1, get.value(card));
						},
						ai2(target) {
							const player2 = get.player();
							return get.attitude(player2, target);
						},
					})
					.forResult();
				if (result?.cards?.length && result.targets?.length) {
					const {
						cards,
						targets: [target],
					} = result;
					player.line(target);
					await player.give(cards, target);
				}
			}
		},
		group: ["dclianyou_restore"],
		subSkill: {
			restore: {
				charlotte: true,
				forced: true,
				firstDo: true,
				popup: false,
				trigger: {
					global: "roundStart",
				},
				async content(event, trigger, player) {
					["recover", "equip", "draw"].forEach(index => player.unmarkAuto("dclianyou", index));
				},
			},
		},
	},
	dccili: {
		trigger: {
			global: "roundStart",
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt("dccili"),
					prompt2: "记录一名角色的体力值，根据其用牌数你获得收益",
					ai() {
						return Math.random();
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.addSkill("dccili_mark");
			player.setStorage("dccili_mark", [target, target.getHp(), 0], true);
			player
				.when({ global: "phaseEnd" })
				.filter((event2, player2) => {
					return event2.player === target;
				})
				.then(async (event, trigger, player2) => {
					const record = player.getStorage("dccili_mark");
					player.removeSkill("dccili_mark");
					if (!record || record[0] !== target) {
						return;
					}
					const num = record[2];
					if (record[1] > 0) {
						if (num < record[1]) {
							const result = await player
								.chooseTarget({
									prompt: `令一名角色弃置${record[1]}张牌`,
									filterTarget(card, player, target) {
										return target.hasCards("he");
									},
									ai(target) {
										return -get.attitude(player, target) * (0.7 + (target.countCards("he") >= 5));
									},
								})
								.forResult();
							if (result.bool) {
								await result.targets[0].chooseToDiscard({
									forced: true,
									selectCard: record[1],
									position: "he",
								});
							}
						} else {
							const result = await player
								.chooseTarget({
									prompt: `令一名角色摸${record[1]}张牌`,
									ai(target) {
										return get.attitude(player, target);
									},
								})
								.forResult();
							if (result.bool) {
								await result.targets[0].draw(record[1]);
							}
						}
					}
					player.unmarkAuto("dccili_mark");
					player.removeSkill("dccili_mark");
				});
		},
		subSkill: {
			mark: {
				charlotte: true,
				mark: true,
				marktext: "慈",
				intro: {
					name: "慈厉",
					markcount: () => 0,
					content(storage, player) {
						if (!storage) {
							return;
						}
						const name = storage[0];
						const num = storage[1];
						const times = storage[2];
						return `${get.translation(name)}啊，你当时是${num}点体力值<br>你已经用了${times}张牌<br>到下回合结束用不到${num}张牌，有人要被打皮鼓哟`;
					},
				},
				direct: true,
				firstDo: true,
				trigger: { global: "useCard" },
				filter(event, player) {
					return event.player === player.getStorage("dccili_mark")[0];
				},
				async content(event, trigger, player) {
					const data = player.getStorage("dccili_mark");
					player.setStorage("dccili_mark", [data[0], data[1], data[2] + 1]);
				},
			},
		},
	},
	dczimu: {
		audio: 1,
		trigger: { player: "damageEnd" },
		forced: true,
		mark: true,
		logTarget(event, player) {
			return game
				.filterPlayer(function (current) {
					return current.hasSkill("dczimu", null, null, false);
				})
				.sortBySeat();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			if (targets.length > 0) {
				if (targets.length == 1) {
					await targets[0].draw();
				} else {
					await game.asyncDraw(targets);
				}
			}
			await player.removeSkills("dczimu");
		},
		marktext: "牧",
		intro: {
			content: "锁定技。当你受到伤害后，你令所有拥有〖自牧〗的角色各摸一张牌，然后你失去〖自牧〗。",
		},
	},
	//黄祖
	dcjinggong: {
		audio: 2,
		enable: "chooseToUse",
		locked: false,
		mod: {
			targetInRange(card) {
				if (card.storage && card.storage.dcjinggong) {
					return true;
				}
			},
		},
		viewAsFilter(player) {
			return player.hasCard(function (card) {
				return get.type(card) == "equip";
			}, "ehs");
		},
		position: "hes",
		filterCard: { type: "equip" },
		viewAs: {
			name: "sha",
			storage: { dcjinggong: true },
		},
		check(card) {
			return 6 - get.value(card);
		},
		ai: {
			respondSha: true,
			skillTagFilter(player) {
				return player.hasCard(function (card) {
					return get.type(card) == "equip";
				}, "ehs");
			},
		},
		group: "dcjinggong_base",
		subSkill: {
			base: {
				trigger: { player: "useCard1" },
				forced: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					return event.skill == "dcjinggong" && event.targets.length > 0;
				},
				content() {
					trigger.baseDamage = Math.min(5, get.distance(player, trigger.targets[0]));
				},
			},
		},
	},
	dcxiaojuan: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		logTarget: "target",
		filter(event, player) {
			return event.targets.length == 1 && player != event.target && event.target.countCards("h") > 1;
		},
		check(event, player) {
			var target = event.target;
			if (get.attitude(player, target) >= 0) {
				return false;
			}
			if (get.color(event.card) == "none") {
				return true;
			}
			return Math.floor(target.countCards("h") / 2) >= Math.floor(player.countCards("h") / 2);
		},
		content() {
			"step 0";
			var target = trigger.target;
			event.target = target;
			var num = Math.floor(target.countCards("h") / 2);
			if (num > 0) {
				player.discardPlayerCard(target, "h", num, true);
			} else {
				event.finish();
			}
			"step 1";
			var suit = get.suit(trigger.card);
			if (result.bool && lib.suit.includes(suit) && player.countCards("h") > 1) {
				var bool = false;
				for (var i of result.cards) {
					if (get.suit(i, target) == suit) {
						bool = true;
						break;
					}
				}
				if (!bool) {
					event.finish();
				}
			} else {
				event.finish();
			}
			"step 2";
			if (player.countCards("h") > 0) {
				player.chooseToDiscard("h", 1, true);
			}
		},
	},
};
