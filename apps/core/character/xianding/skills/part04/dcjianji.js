import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcjianji" | "dcyuanmo" | "dcxialei" | "dcanzhi">} */
export const groupSkills = {
	//杨弘
	dcjianji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.getAttackRange() >= 1;
		},
		selectTarget() {
			return [1, _status.event.player.getAttackRange()];
		},
		complexSelect: true,
		complexTarget: true,
		filterTarget(card, player, target) {
			const selected = ui.selected.targets;
			if (!selected.length) {
				return true;
			}
			for (const current of selected) {
				if (current.getNext() == target || current.getPrevious() == target) {
					return true;
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (target.countCards("he") > 0) {
				await target.chooseToDiscard(true, "he");
			}
		},
		async contentAfter(event, trigger, player) {
			const { targets } = event;
			let list = targets.filter(target => target.isMaxHandcard(false, current => targets.includes(current)));
			if (!list.length) {
				return;
			}
			let result =
				list.length == 1
					? { bool: true, targets: list }
					: await player
							.chooseTarget(
								`间计：请选择一名角色，令其选择是否对${get.translation(targets)}中一名不为你的角色视为使用一张【杀】`,
								(card, player, target) => {
									return get.event().targets?.includes(target);
								},
								true
							)
							.set("ai", target => {
								const player = get.player();
								return get.attitude(player, target);
							})
							.set("targets", list)
							.forResult();
			if (result?.bool) {
				const target = result.targets[0];
				result = await target
					.chooseTarget(`间计：是否视为对${get.translation(player)}以外被选择的一名角色使用一张杀？`, (card, player, target) => {
						const { owner, targets } = get.event();
						if (target == player || target == owner) {
							return false;
						}
						return targets.includes(target) && player.canUse("sha", target, false);
					})
					.set("owner", player)
					.set("targets", targets)
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, { name: "sha" }, player, player);
					})
					.forResult();
				if (result?.bool) {
					const card = new lib.element.VCard({ name: "sha", isCard: true });
					if (target.canUse(card, result.targets[0], false)) {
						await target.useCard(card, result.targets[0], false);
					}
				}
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					var eff = get.effect(target, { name: "guohe_copy2" }, player, target) / 2;
					if (ui.selected.targets.length && eff < 0) {
						var len = target.countCards("h");
						if (
							ui.selected.targets.every(i => {
								return i.countCards("h") < len + 1;
							}) &&
							ui.selected.targets.some(i => {
								return get.effect(i, { name: "sha" }, target, player) > 0;
							})
						) {
							return 0.1;
						}
					}
					return ui.selected.targets.reduce((p, c) => p + get.effect(c, { name: "guohe_copy2" }, player, c) / 2, 0) + eff;
				},
			},
		},
	},
	dcyuanmo: {
		audio: 2,
		trigger: { player: ["damageEnd", "phaseZhunbeiBegin"] },
		direct: true,
		group: "dcyuanmo_add",
		init(player) {
			player.storage.dcyuanmo_range = 0;
		},
		change(player, num) {
			player.addSkill("dcyuanmo_range");
			if (typeof player.storage.dcyuanmo_range !== "number") {
				player.storage.dcyuanmo_range = 0;
			}
			if (!num) {
				return;
			}
			player.storage.dcyuanmo_range += num;
			if (player.storage.dcyuanmo_range != 0) {
				player.markSkill("dcyuanmo_range");
			} else {
				player.unmarkSkill("dcyuanmo_range");
			}
			game.log(player, "的攻击范围", (num > 0 ? "+" : "") + num);
		},
		content() {
			"step 0";
			event.targets = game.filterPlayer(current => player.inRange(current));
			var choiceList = ["攻击范围+1。然后若你攻击范围内的角色数因此增加，你可以获得其中任意名角色的一张牌", "攻击范围-1。然后你摸两张牌"];
			player
				.chooseControl("cancel2")
				.set("prompt", get.prompt("dcyuanmo"))
				.set("choiceList", choiceList)
				.set("ai", () => {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						if (
							trigger.name == "phaseZhunbei" &&
							player.getAttackRange() == 1 &&
							!player.hasCard(card => {
								if (get.subtype(card) != "equip1" && !player.hasUseTarget(card)) {
									return false;
								}
								var num = 1;
								var info = get.info(card, false);
								if (info && info.distance && typeof info.distance.attackFrom == "number") {
									num -= info.distance.attackFrom;
								}
								return num > 1;
							}, "hs")
						) {
							return "选项一";
						}
						var targets = event.targets.slice(),
							targetsx = [];
						var _tmp = player.storage.dcyuanmo_range;
						player.storage.dcyuanmo_range++;
						try {
							targetsx = game.filterPlayer(current => player.inRange(current));
						} catch (e) {
							player.storage.dcyuanmo_range = _tmp;
						}
						player.storage.dcyuanmo_range = _tmp;
						targetsx.removeArray(targets);
						return targetsx.reduce((p, c) => {
							return p + Math.max(0, get.effect(c, { name: "shunshou_copy2" }, player, player));
						}, 0) >
							get.effect(player, { name: "draw" }, player, player) * 1.3
							? "选项一"
							: "选项二";
					})()
				);
			"step 1";
			if (result.control == "cancel2") {
				event.finish();
				return;
			}
			player.logSkill("dcyuanmo");
			if (result.control == "选项一") {
				lib.skill.dcyuanmo.change(player, 1);
				var targetsx = game.filterPlayer(current => player.inRange(current));
				if (targetsx.length <= targets.length) {
					event.finish();
				} else {
					event.targets = targetsx.removeArray(targets);
				}
			} else {
				lib.skill.dcyuanmo.change(player, -1);
				player.draw(2);
				event.finish();
			}
			"step 2";
			player
				.chooseTarget("远谟：获得任意名本次进入你攻击范围的角色的一张牌", [1, targets.length], (card, player, target) => {
					return _status.event.getParent().targets.includes(target) && target.countGainableCards(player, "he") > 0;
				})
				.set("ai", target => {
					var player = _status.event.player;
					return get.effect(target, { name: "shunshou_copy2" }, player, player);
				});
			"step 3";
			if (result.bool) {
				var targets = result.targets.sortBySeat();
				player.line(targets);
				for (var target of targets) {
					player.gainPlayerCard(target, "he", true);
				}
			}
		},
		subSkill: {
			add: {
				audio: "dcyuanmo",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return !game.hasPlayer(current => player.inRange(current));
				},
				prompt2: "令你的攻击范围+1",
				check: () => true,
				content() {
					lib.skill.dcyuanmo.change(player, 1);
				},
			},
			range: {
				charlotte: true,
				intro: {
					content(storage, player) {
						var num = player.storage.dcyuanmo_range;
						return "攻击范围" + (num >= 0 ? "+" : "") + num;
					},
				},
				mod: {
					attackRange(player, num) {
						return num + player.countMark("dcyuanmo_range");
					},
				},
			},
		},
	},
	//薛灵芸
	dcxialei: {
		audio: 2,
		trigger: {
			player: "loseAfter",
			global: ["loseAsyncAfter", "cardsDiscardAfter", "equipAfter", "addJudgeAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (player.countMark("dcxialei_clear") >= 3) {
				return false;
			}
			return event.getd(player, "cards2").some(i => get.color(i, player) === "red");
		},
		async content(event, trigger, player) {
			let cards = get.cards(3 - player.countMark("dcxialei_clear"));
			await game.cardsGotoOrdering(cards);
			let result;
			if (cards.length == 1) {
				result = { bool: true, links: cards };
			} else {
				result = await player.chooseButton(["霞泪：获得其中的一张牌", cards], true).forResult();
			}
			if (result.bool) {
				let card = result.links[0];
				await player.gain(card, "draw");
				cards.remove(card);
				if (cards.length) {
					const result2 = await player
						.chooseBool()
						.set("createDialog", ["是否将剩余牌置于牌堆底？", cards])
						.set("ai", () => _status.event.bool)
						.set(
							"bool",
							(() => {
								if (!player.hasSkill("dcanzhi")) {
									return Math.random() < 0.5;
								}
								if (player.isTempBanned("dcanzhi")) {
									const next = _status.currentPhase?.getNext();
									if (!next) {
										return Math.random() < 0.5;
									}
									const judges = next.getCards("j");
									let val = 0;
									if (judges.length && !next.hasWuxie()) {
										const att = get.attitude(player, next);
										for (var i = 0; judges.length; i++) {
											var judge = judges[i] && get.judge(judges[i]),
												card = cards[i];
											if (!judge || !card) {
												break;
											}
											val += judge(card) * att;
										}
									}
									if (val > 0) {
										return false;
									} else if (val == 0) {
										return Math.random() < 0.5;
									}
									return true;
								}
								var card = cards[0];
								if (
									get.color(card, player) == "red" &&
									player.isPhaseUsing() &&
									player.countCards("hs", card => {
										return get.color(card) == "red" && player.hasValueTarget(card) && ["basic", "trick"].includes(get.type(card));
									}) > 0
								) {
									return false;
								}
								if (get.color(card, player) == "black") {
									return false;
								}
								return true;
							})()
						)
						.forResult();
					if (result2.bool) {
						player.popup("牌堆底");
						game.log(player, "将" + get.cnNumber(cards.length) + "张牌置于了牌堆底");
						await game.cardsGotoPile(cards);
					} else {
						player.popup("牌堆顶");
						await game.cardsGotoPile(cards.slice().reverse(), "insert");
					}
				}
			}
			player.addMark("dcxialei_clear", 1, false);
			player.addTempSkill("dcxialei_clear");
		},
		subSkill: { clear: { onremove: true } },
	},
	dcanzhi: {
		audio: 2,
		enable: "phaseUse",
		trigger: { player: "damageEnd" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseBool(get.prompt(event.skill))
				.set("prompt2", "你判定，若结果为红色，你重置〖霞泪〗的观看牌数；若结果为黑色，〖暗织〗于本回合失效，然后你可以令一名非当前回合角色获得本回合进入弃牌堆的两张牌。")
				.set(
					"choice",
					game.hasPlayer(current => get.attitude(player, current) > 0 && current != _status.currentPhase)
				)
				.forResult();
		},
		async content(event, trigger, player) {
			const next = player.judge(result => {
				if (get.color(result) == "red") {
					return get.event().getParent().player.countMark("dcxialei_clear") / 2;
				}
				return 2;
			});
			next.judge2 = result => result.bool;
			const result = await next.forResult();
			if (result?.color && ["red", "black"].includes(result.color)) {
				const { color } = result;
				if (color == "red") {
					player.removeSkill("dcxialei_clear");
				} else {
					player.tempBanSkill(event.name);
					let cards = get.discarded().filterInD("d");
					if (!cards.length || !game.hasPlayer(current => current != _status.currentPhase)) {
						return;
					}
					const result = await player
						.chooseTarget("暗织：是否令一名非当前回合角色获得本回合进入弃牌堆的两张牌？", (card, player, target) => {
							return target != _status.currentPhase;
						})
						.set("ai", target => {
							const player = get.player();
							return get.effect(target, { name: "wuzhong" }, player, player);
						})
						.forResult();
					if (result?.bool && result?.targets?.length) {
						cards = cards.filterInD("d");
						if (!cards.length) {
							return;
						}
						const [target] = result.targets;
						const result2 = await player
							.chooseButton([`暗织：选择令${get.translation(target)}获得的牌`, cards], true, Math.min(cards.length, 2))
							.set("ai", button => {
								const { player, target } = get.event();
								return get.sgnAttitude(player, target) * get.value(button.link, target);
							})
							.set("target", target)
							.forResult();
						if (result2?.bool && result2?.links?.length) {
							await target.gain(result2.links, "gain2");
						}
					}
				}
			}
		},
		ai: {
			combo: "dcxialei",
			order(item, player) {
				if (player.countMark("dcxialei_clear") >= 2) {
					return 10;
				}
				if (player.hasHistory("useSkill", evt => evt.skill == "dcxialei") && get.color(ui.cardPile.firstChild, player) == "red" && player.countMark("dcxialei_clear") > 0) {
					return 9;
				}
				return 1;
			},
			result: { player: 1 },
		},
	},
};
