import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twzhengjian" | "twzhongchi" | "twzhenxi" | "twyangshi">} */
export const groupSkills = {
	//濮阳兴
	twzhengjian: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			if (event.name == "phase" && game.phaseNumber != 0) {
				return false;
			}
			return !player.hasSkill("twzhengjian_eff0") && !player.hasSkill("twzhengjian_eff1");
		},
		content() {
			"step 0";
			player
				.chooseControl()
				.set("prompt", "征建：请选择一种效果")
				.set("choiceList", ["令“出牌阶段内未使用过非基本牌”的其他角色受到惩罚", "令“出牌阶段内未得到过牌”的其他角色受到惩罚"])
				.set("ai", () => (Math.random() <= 0.5 ? 0 : 1));
			"step 1";
			player.addSkill("twzhengjian_eff" + result.index);
			game.log(player, "获得了", "#g【征建】", "的", "#y效果" + get.cnNumber(result.index + 1, true));
			game.delayx();
		},
		onremove: true,
		subSkill: {
			eff0: {
				audio: "twzhengjian",
				trigger: { global: "phaseUseEnd" },
				forced: true,
				charlotte: true,
				marktext: "建",
				mark: true,
				filter(event, player) {
					if (event.player == player || event._twzhengjian || !event.player.isIn()) {
						return false;
					}
					if (
						event.player.hasHistory("useCard", function (evt) {
							return evt.getParent("phaseUse") == event && get.type(evt.card) != "basic";
						})
					) {
						return false;
					}
					return player.storage.twzhengjian || event.player.countCards("he") > 0;
				},
				logTarget: "player",
				content() {
					"step 0";
					trigger._twzhengjian = true;
					var target = trigger.player;
					event.target = target;
					if (player.storage.twzhengjian) {
						player
							.chooseBool("征建：是否对" + get.translation(target) + "造成1点伤害？")
							.set("ai", () => _status.event.goon)
							.set("goon", get.damageEffect(target, player, _status.event.player) > 0);
					} else {
						target.chooseCard("he", true, "交给" + get.translation(player) + "一张牌");
					}
					"step 1";
					if (result.bool) {
						if (result.cards && result.cards.length) {
							target.give(result.cards, player).type = "twzhengjian";
						} else {
							target.damage();
						}
					}
					player.chooseBool("是否变更【征建】的效果？").set("ai", () => Math.random() > 0.5);
					"step 2";
					if (result.bool) {
						player.removeSkill("twzhengjian_eff0");
						player.addSkill("twzhengjian_eff1");
						game.log(player, "将", "#g【征建】", "的效果变更为", "#y效果二");
					}
				},
				intro: {
					content(storage, player) {
						if (player.storage.twzhengjian) {
							return "其他角色的出牌阶段结束时，若其本阶段内未使用过非基本牌，则你可对其造成1点伤害，然后你可失去此效果并获得〖征建〗的效果二。";
						}
						return "其他角色的出牌阶段结束时，若其本阶段内未使用过非基本牌，则其须交给你一张牌，然后你可失去此效果并获得〖征建〗的效果二。";
					},
				},
			},
			eff1: {
				audio: "twzhengjian",
				trigger: { global: "phaseUseEnd" },
				forced: true,
				charlotte: true,
				marktext: "征",
				mark: true,
				filter(event, player) {
					if (event.player == player || event._twzhengjian || !event.player.isIn()) {
						return false;
					}
					if (
						event.player.hasHistory("gain", function (evt) {
							return evt.getParent("phaseUse") == event;
						})
					) {
						return false;
					}
					return player.storage.twzhengjian || event.player.countCards("he") > 0;
				},
				logTarget: "player",
				content() {
					"step 0";
					trigger._twzhengjian = true;
					var target = trigger.player;
					event.target = target;
					if (player.storage.twzhengjian) {
						player
							.chooseBool("征建：是否对" + get.translation(target) + "造成1点伤害？")
							.set("ai", () => _status.event.goon)
							.set("goon", get.damageEffect(target, player, _status.event.player) > 0);
					} else {
						target.chooseCard("he", true, "交给" + get.translation(player) + "一张牌");
					}
					"step 1";
					if (result.bool) {
						if (result.cards && result.cards.length) {
							target.give(result.cards, player).type = "twzhengjian";
						} else {
							target.damage();
						}
					}
					player.chooseBool("是否变更【征建】的效果？").set("ai", () => Math.random() > 0.5);
					"step 2";
					if (result.bool) {
						player.removeSkill("twzhengjian_eff1");
						player.addSkill("twzhengjian_eff0");
						game.log(player, "将", "#g【征建】", "的效果变更为", "#y效果一");
					}
				},
				intro: {
					content(storage, player) {
						if (player.storage.twzhengjian) {
							return "其他角色的出牌阶段结束时，若其本阶段内未得到过牌，则你可对其造成1点伤害，然后你可失去此效果并获得〖征建〗的效果一。";
						}
						return "其他角色的出牌阶段结束时，若其本阶段内未得到过牌，则其须交给你一张牌，然后你可失去此效果并获得〖征建〗的效果一。";
					},
				},
			},
		},
	},
	twzhongchi: {
		audio: 2,
		trigger: {
			player: "gainAfter",
			global: "loseAsyncAfter",
		},
		forced: true,
		limited: true,
		skillAnimation: true,
		animationColor: "wood",
		filter(event, player) {
			if (player.storage.twzhengjian || !player.hasSkill("twzhengjian", null, null, false) || !event.getg(player).length) {
				return false;
			}
			var num1 = game.countPlayer2();
			var list = [];
			player.getAllHistory("gain", function (evt) {
				if (evt.type == "twzhengjian") {
					list.add(evt.source);
				}
			});
			return list.length >= Math.ceil(num1 / 2);
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			"step 1";
			player.recover(2);
			player.addSkill("twzhongchi_effect");
			player.storage.twzhengjian = true;
			"step 2";
			game.delayx();
		},
		subSkill: {
			effect: {
				audio: "twzhongchi",
				mark: true,
				marktext: "斥",
				intro: { content: "受到渠道为【杀】的伤害+1" },
				trigger: { player: "damageBegin1" },
				forced: true,
				filter(event, player) {
					return event.card && event.card.name == "sha";
				},
				content() {
					trigger.num++;
				},
			},
		},
		ai: {
			combo: "twzhengjian",
		},
	},
	//田豫
	twzhenxi: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
		},
		filter(event, player) {
			const { target } = event;
			return (
				event.card.name == "sha" &&
				(target.countDiscardableCards(player, "h") ||
					player.canMoveCard(
						null,
						true,
						target,
						game.filterPlayer(i => i != target)
					))
			);
		},
		usable: 1,
		async cost(event, trigger, player) {
			const { target } = trigger;
			const str = get.translation(target);
			const list = [
				`弃置${str}${get.cnNumber(get.distance(player, target))}张手牌`,
				`将${str}装备区或判定区内的一张牌移动到另一名角色的对应区域内`,
			];
			const choices = [];
			if (target.countDiscardableCards(player, "h")) {
				choices.push("选项一");
			} else {
				list[0] = '<span style="opacity:0.5">' + list[0] + "</span>";
			}
			if (
				player.canMoveCard(
					null,
					true,
					target,
					game.filterPlayer(i => i != target)
				)
			) {
				choices.push("选项二");
			} else {
				list[1] = '<span style="opacity:0.5">' + list[1] + "</span>";
			}
			if (choices.length == 2 && (target.hp > player.hp || target.isMaxHp())) {
				list.push("背水！依次执行以上两项");
				choices.push("背水！");
			}
			choices.push("cancel2");
			const { control } = await player
				.chooseControl(choices)
				.set("choiceList", list)
				.set("prompt", get.prompt(event.skill, target))
				.set("ai", () => {
					const player = _status.event.player,
						target = _status.event.getTrigger().target;
					let eff1 = 0,
						eff2 = 0;
					var choices = _status.event.controls.slice(0);
					if (choices.includes("选项一")) {
						eff1 = -get.distance(player, target) * get.attitude(player, target);
					}
					if (choices.includes("选项二")) {
						var equip = 0,
							judge = 0,
							att = get.attitude(player, target);
						var es = target.getCards("e"),
							js = target.getCards("j");
						for (var i of es) {
							var val = get.value(i);
							if (att > 0) {
								if (
									val <= Math.min(0, equip) &&
									game.hasPlayer(function (current) {
										return current != target && current.canEquip(i) && get.effect(current, i, player, player) > 0;
									})
								) {
									equip = val;
								}
							} else {
								if (
									val > Math.max(0, equip) &&
									game.hasPlayer(function (current) {
										return current != target && current.canEquip(i) && get.effect(current, i, player, player) > 0;
									})
								) {
									equip = val;
								}
							}
						}
						for (var i of js) {
							var card = { name: i.viewAs || i.name };
							var effect = get.effect(target, card, player, player);
							if (effect < 0) {
								game.countPlayer(function (current) {
									if (current != target && current.canAddJudge(i)) {
										var eff = get.effect(current, card, player, player);
										judge = Math.max(eff, judge);
									}
								});
							}
						}
						eff2 = Math.max(-equip * att, judge);
					}
					if (eff1 > 0) {
						if (eff2 > 0) {
							if (choices.includes("背水！")) {
								return "背水！";
							} else if (eff2 >= eff1) {
								return "选项二";
							}
						}
						return "选项一";
					} else if (eff2 > 0) {
						return "选项二";
					}
					return "cancel2";
				})
				.forResult();
			event.result = {
				bool: control !== "cancel2",
				cost_data: control,
			};
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const { target } = trigger,
				{ cost_data: control } = event;
			if (control != "选项二" && target.countDiscardableCards(player, "h")) {
				await player.discardPlayerCard(target, true, "h", get.distance(player, target));
			}
			if (control == "选项一") {
				return;
			}
			if (
				control != "选项一" &&
				player.canMoveCard(
					null,
					true,
					target,
					game.filterPlayer(i => i != target)
				)
			) {
				await player.moveCard(
					true,
					target,
					game.filterPlayer(i => i != target)
				);
			}
		},
		ai: {
			unequip_ai: true,
			skillTagFilter(player, tag, arg) {
				if (!arg || !arg.name || arg.name != "sha") {
					return false;
				}
				if (player.storage.counttrigger?.twzhenxi) {
					return false;
				}
				if (!arg.target) {
					return false;
				}
				const card = arg.target.getEquip(2);
				return (
					card &&
					get.value(card) > 0 &&
					game.hasPlayer(current => current != arg.target && current.canEquip(card) && get.effect(current, card, player, player) > 0)
				);
			},
		},
	},
	twyangshi: {
		audio: 2,
		trigger: { player: "damageEnd" },
		forced: true,
		async content(event, trigger, player) {
			if (game.hasPlayer(current => current != player && !player.inRange(current))) {
				player.addSkill(event.name + "_distance");
				player.addMark(event.name + "_distance", 1, false);
			} else {
				const card = get.cardPile2(card => card.name == "sha");
				if (card) {
					await player.gain(card, "gain2");
				} else {
					game.log("但是牌堆里已经没有杀了！");
				}
			}
		},
		subSkill: {
			distance: {
				charlotte: true,
				onremove: true,
				mod: {
					attackRange(player, num) {
						return num + player.countMark("twyangshi_distance");
					},
				},
				markimage: "image/card/attackRange.png",
				intro: { content: "攻击范围+#" },
			},
		},
	},
};
