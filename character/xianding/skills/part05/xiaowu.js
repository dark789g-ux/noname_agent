import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xiaowu" | "huaping" | "shawu" | "qianlong" | "fensi" | "juetao" | "zhushi">} */
export const groupSkills = {
	//来莺儿
	xiaowu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		selectTarget() {
			return [1, game.countPlayer() - 1];
		},
		complexSelect: true,
		complexTarget: true,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			var next = player.getNext(),
				prev = player.getPrevious();
			var selected = ui.selected.targets;
			if (!selected.includes(next) && !selected.includes(prev)) {
				return target == next || target == prev;
			}
			for (var i of selected) {
				if (i.getNext() == target || i.getPrevious() == target) {
					return true;
				}
			}
			return false;
		},
		contentBefore() {
			event.getParent()._xiaowu_targets = [];
		},
		content() {
			"step 0";
			if (!target.isIn()) {
				event.finish();
				return;
			}
			target
				.chooseControl()
				.set("choiceList", ["令" + get.translation(player) + "摸一张牌", "令自己摸一张牌"])
				.set("ai", function () {
					var player = _status.event.player,
						target = _status.event.getParent().player;
					var all = _status.event.getParent().targets.length,
						dam = _status.event.getParent(2)._xiaowu_targets.length;
					if (get.attitude(player, target) > 0 || dam >= Math.floor(all / 2)) {
						return 0;
					}
					return 1;
				});
			"step 1";
			if (result.index == 0) {
				player.draw();
			} else {
				target.draw();
				event.getParent()._xiaowu_targets.push(target);
			}
		},
		contentAfter() {
			var targetsx = event.getParent()._xiaowu_targets;
			var num = targets.length - targetsx.length - targetsx.length;
			if (num > 0) {
				player.addMark("shawu", 1);
			} else if (num < 0) {
				player.line(targetsx, "fire");
				for (var i of targetsx) {
					i.damage();
				}
			}
		},
		ai: {
			order: 8,
			result: { player: 1 },
		},
	},
	huaping: {
		audio: 2,
		trigger: { global: "die" },
		limited: true,
		skillAnimation: true,
		animationColor: "fire",
		filter(event, player) {
			return player != event.player;
		},
		logTarget: "player",
		check(event, player) {
			return get.rank(event.player.name, true) >= 5;
		},
		content() {
			player.awakenSkill(event.name);
			var skills = trigger.player.getSkills(null, false, false).filter(function (i) {
				var info = get.info(i);
				return info && !info.charlotte;
			});
			if (skills.length) {
				//for(var i of skills) player.addSkillLog(i);
				player.addSkills(skills);
			}
			player.removeSkills("xiaowu");
			var num = player.countMark("shawu");
			if (num > 0) {
				player.removeMark("shawu", num);
				player.draw(num);
			}
		},
		group: "huaping_give",
		subSkill: {
			give: {
				audio: "huaping",
				trigger: { player: "die" },
				direct: true,
				filter(event, player) {
					return event.player == player;
				},
				forceDie: true,
				skillAnimation: true,
				animationColor: "gray",
				content() {
					"step 0";
					player
						.chooseTarget(get.prompt("huaping"), "令一名其他角色获得〖沙舞〗", lib.filter.notMe)
						.set("forceDie", true)
						.set("ai", function (target) {
							return get.attitude(_status.event.player, target) + 100;
						});
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						player.awakenSkill("huaping");
						player.logSkill("huaping_give", target);
						target.addSkills("shawu");
						var num = player.countMark("shawu");
						if (num > 0) {
							player.removeMark("shawu", num);
							target.addMark("shawu", num);
						}
					}
				},
			},
		},
		derivation: "shawu",
	},
	shawu: {
		trigger: { player: "useCardToTargeted" },
		direct: true,
		filter(event, player) {
			return (
				event.card.name == "sha" &&
				event.player.isIn() &&
				(player.hasMark("shawu") ||
					player.countCards("h", function (card) {
						return lib.filter.cardDiscardable(card, player, "shawu");
					}) > 1)
			);
		},
		content() {
			"step 0";
			var list = [];
			if (
				player.countCards("h", function (card) {
					return lib.filter.cardDiscardable(card, player, "shawu");
				}) > 1
			) {
				list.push("弃置手牌");
			}
			if (player.hasMark("shawu")) {
				list.push("移除标记");
			}
			list.push("cancel2");
			player
				.chooseControl(list)
				.set("prompt", get.prompt("shawu", trigger.target))
				.set("prompt2", "弃置两张手牌，或移去一枚“沙”并摸两张牌，然后对该角色造成1点伤害")
				.set("ai", function () {
					var player = _status.event.player,
						target = _status.event.getTrigger().target;
					if (get.damageEffect(target, player, player) <= 0) {
						return "cancel2";
					}
					if (player.hasMark("shawu")) {
						return "移除标记";
					}
					if (
						player.countCards("h", function (card) {
							return lib.filter.cardDiscardable(card, player, "shawu") && get.value(card) <= 6.5;
						}) > 1
					) {
						return "弃置手牌";
					}
					return "cancel2";
				});
			"step 1";
			var target = trigger.target;
			if (result.control == "cancel2") {
				event.finish();
				return;
			} else if (result.control == "移除标记") {
				player.logSkill("shawu", target);
				player.removeMark("shawu", 1);
				player.draw(2);
				target.damage();
				event.finish();
			} else {
				player.chooseToDiscard("h", true, 2).logSkill = ["shawu", target];
			}
			"step 2";
			trigger.target.damage();
		},
		intro: {
			content: "mark",
		},
	},
	//曹髦
	qianlong: {
		audio: 2,
		trigger: { player: "damageEnd" },
		frequent: true,
		async content(event, trigger, player) {
			const cards = get.cards(3, true);
			await player.showCards(cards, `${get.translation(player)}发动了【${get.translation(event.name)}】`, true).set("clearArena", false);
			const next = player.chooseToMove("潜龙：获得至多" + get.cnNumber(Math.min(3, player.getDamagedHp())) + "张牌并将其余牌置于牌堆底（右为底）");
			next.set("list", [["置于牌堆底", cards], ["自己获得"]]);
			next.set("filterMove", function (from, to, moved) {
				if (moved[0].includes(from.link)) {
					if (typeof to == "number") {
						if (to == 1) {
							if (moved[1].length >= _status.event.player.getDamagedHp()) {
								return false;
							}
						}
						return true;
					}
				}
				return true;
			});
			next.set("processAI", function (list) {
				let cards = list[0][1].slice(0),
					player = _status.event.player;
				cards.sort((a, b) => {
					return get.value(b, player) - get.value(a, player);
				});
				if (!player.storage.juetao && player.hasSkill("juetao") && player.hasSha()) {
					let gain,
						bottom,
						pai = cards.filter(card => card.name !== "sha");
					pai.sort((a, b) => {
						return get.value(b, player) - get.value(a, player);
					});
					gain = pai.splice(0, player.getDamagedHp());
					bottom = cards.slice(0);
					bottom.removeArray(gain);
					return [bottom, gain];
				}
				return [cards, cards.splice(0, player.getDamagedHp())];
			});
			const result = await next.forResult();
			game.broadcastAll(ui.clear);
			if (result.moved?.length) {
				const { moved } = result;
				if (moved[0].length > 0) {
					game.log(player, "将", moved[0], "置于牌堆底");
					await game.cardsGotoPile(moved[0]);
				}
				if (moved[1].length > 0) {
					await player.gain(moved[1], "gain2");
				}
			}
		},
		ai: {
			maixie: true,
			//maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return;
						}
						if (!target.hasFriend()) {
							return;
						}
						var num = 1;
						if (!player.needsToDiscard() && target.isDamaged()) {
							num = 0.7;
						} else {
							num = 0.5;
						}
						if (target.hp >= 4) {
							return [1, num * 2];
						}
						if (target.hp == 3) {
							return [1, num * 1.5];
						}
						if (target.hp == 2) {
							return [1, num * 0.5];
						}
					}
				},
			},
		},
	},
	fensi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		async content(event, trigger, player) {
			if (
				!game.hasPlayer(function (current) {
					return current != player && current.hp >= player.hp;
				})
			) {
				await player.damage();
				return;
			} else {
				const result = await player
					.chooseTarget(true, "忿肆：对一名体力值不小于你的角色造成1点伤害", function (card, player, target) {
						return target.hp >= player.hp;
					})
					.set("ai", function (target) {
						var player = _status.event.player;
						return get.damageEffect(target, player, player);
					})
					.forResult();
				if (result.targets?.length) {
					const {
						targets: [target],
					} = result;
					player.line(target, "green");
					await target.damage();
					if (target.isIn() && target.canUse("sha", player, false)) {
						await target.useCard({ name: "sha", isCard: true }, player, false, "noai");
					}
				}
			}
		},
	},
	juetao: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		limited: true,
		skillAnimation: true,
		animationColor: "thunder",
		filter(event, player) {
			return player.hp == 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", function (target) {
					let att = -get.attitude(_status.event.player, target);
					if (att <= 0) {
						return att;
					}
					if (
						target.hasSkillTag("nodamage", null, {
							source: player,
						}) ||
						target.getEquip("qimenbagua")
					) {
						return 0.01 * att;
					}
					if (target.getEquip("tengjia") || target.getEquip("renwang")) {
						return 0.3 * att;
					}
					if (target.getEquip("rewrite_tengjia") || target.getEquip("rewrite_renwang")) {
						return 0.2 * att;
					}
					if (
						target.hasSkillTag(
							"freeShan",
							false,
							{
								player: _status.event.player,
								type: "use",
							},
							true
						)
					) {
						return 0.3 * att;
					}
					if (target.getEquip(2)) {
						return att / 2;
					}
					return 1.2 * att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			player.awakenSkill(event.name);
			while (player.isIn() && target.isIn()) {
				const card = get.bottomCards(1, true)[0];
				await player.showCards(card, `${get.translation(player)}对${get.translation(target)}发动了【${get.translation(event.name)}】`, true);
				const result = await player
					.chooseUseTarget(card, true, false, "nodistance")
					.set("filterTarget", function (card, player, target) {
						var evt = _status.event;
						if (_status.event.name == "chooseTarget") {
							evt = evt.getParent();
						}
						if (target != player && target != evt.juetao_target) {
							return false;
						}
						return lib.filter.targetEnabledx(card, player, target);
					})
					.set("juetao_target", target)
					.forResult();
				if (!result.bool) {
					break;
				}
			}
		},
	},
	zhushi: {
		audio: 2,
		usable: 1,
		trigger: { global: "recoverEnd" },
		zhuSkill: true,
		filter(event, player) {
			return player != event.player && event.player.group == "wei" && event.player == _status.currentPhase && event.player.isIn() && player.hasZhuSkill("zhushi", event.player);
		},
		async cost(event, trigger, player) {
			const str = get.translation(player);
			event.result = await trigger.player
				.chooseBool(`是否响应${str}的主公技【助势】？`, `令${str}摸一张牌`)
				.set("goon", get.attitude(trigger.player, player) > 0)
				.set("ai", () => _status.event.goon)
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.player.line(player, "thunder");
			await player.draw();
		},
	},
};
