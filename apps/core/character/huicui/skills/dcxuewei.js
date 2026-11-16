import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcxuewei" | "dcyuguan" | "dcqiangzhi" | "dcpitian" | "dcqingren" | "dclongyuan" | "dcqinqing" | "dccunwei">} */
export const groupSkills = {
	//二傅
	dcxuewei: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		async content(event, trigger, player) {
			const result = await player
				.chooseTarget(get.prompt2("dcxuewei"), (card, player, target) => {
					return target.hp <= player.hp;
				})
				.set("ai", target => {
					var player = _status.event.player;
					return get.effect(target, { name: "tao" }, player, player) + 0.1;
				})
				.forResult();
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("dcxuewei", target);
				player.addTempSkill("dcxuewei_shelter", { player: "phaseBegin" });
				player.markAuto("dcxuewei_shelter", [target]);
			}
		},
		ai: { threaten: 1.1 },
		subSkill: {
			shelter: {
				audio: "dcxuewei",
				trigger: { global: "damageBegin4" },
				filter(event, player) {
					return player.getStorage("dcxuewei_shelter").includes(event.player);
				},
				charlotte: true,
				forced: true,
				onremove: true,
				logTarget: "player",
				marktext: "卫",
				intro: { content: "保护对象：$" },
				async content(event, trigger, player) {
					trigger.cancel();
					await player.loseHp();
					if (trigger.player != player) {
						await game.asyncDraw([player, trigger.player]);
					} else {
						await player.draw("nodelay");
					}
					await game.delayx();
				},
				ai: {
					filterDamage: true,
					skillTagFilter(player, tag, arg) {
						if (arg && arg.player && arg.player.hasSkillTag("jueqing", false, player)) {
							return false;
						}
						return true;
					},
				},
			},
		},
	},
	dcyuguan: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			var num = player.getDamagedHp();
			if (num == 0) {
				return false;
			}
			return !game.hasPlayer(current => {
				return current.getDamagedHp() > num;
			});
		},
		check(event, player) {
			var num = player.getDamagedHp() - 1;
			if (num <= 0) {
				return false;
			}
			return (
				game.countPlayer(target => {
					if (player === target) {
						return player.maxHp - player.countCards("h") - 1;
					}
					if (get.attitude(player, target) > 0) {
						return target.maxHp - target.countCards("h");
					}
					return 0;
				}) > 1
			);
		},
		async content(event, trigger, player) {
			await player.loseMaxHp();
			const num = player.getDamagedHp();
			if (!player.isIn() || !num) {
				return;
			}
			const result = await player
				.chooseTarget("御关：令至多" + get.cnNumber(num) + "名角色将手牌摸至体力上限", [1, Math.min(game.countPlayer(), num)], true)
				.set("ai", target => {
					return get.attitude(_status.event.player, target) * Math.max(0.1, target.maxHp - target.countCards("h"));
				})
				.forResult();
			if (result.bool) {
				const targets = result.targets.sortBySeat(_status.currentPhase);
				player.line(targets);
				for (const target of targets) {
					target.drawTo(target.maxHp);
				}
			}
		},
	},
	//郑浑
	dcqiangzhi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			return target.countDiscardableCards(player, "he") + player.countDiscardableCards(player, "he") >= 3;
		},
		async content(event, trigger, player) {
			const target = event.target;
			if (target.countDiscardableCards(player, "he") + player.countDiscardableCards(player, "he") < 3) {
				return;
			}
			const dialog = [];
			dialog.push("强峙：弃置你与" + get.translation(target) + "的共计三张牌");
			if (player.countCards("h")) {
				dialog.addArray(['<div class="text center">你的手牌</div>', player.getCards("h")]);
			}
			if (player.countCards("e")) {
				dialog.addArray(['<div class="text center">你的装备</div>', player.getCards("e")]);
			}
			if (target.countCards("h")) {
				dialog.add('<div class="text center">' + get.translation(target) + "的手牌</div>");
				if (player.hasSkillTag("viewHandcard", null, target, true)) {
					dialog.push(target.getCards("h"));
				} else {
					dialog.push([target.getCards("h"), "blank"]);
				}
			}
			if (target.countCards("e")) {
				dialog.addArray(['<div class="text center">' + get.translation(target) + "的装备</div>", target.getCards("e")]);
			}
			const result = await player
				.chooseButton(3, true)
				.set("createDialog", dialog)
				.set("filterButton", button => {
					if (!lib.filter.canBeDiscarded(button.link, _status.event.player, get.owner(button.link))) {
						return false;
					}
					return true;
				})
				.set("filterOk", () => {
					return ui.selected.buttons.length == 3;
				})
				.set("ai", button => {
					const player = _status.event.player;
					const target = _status.event.getParent().target;
					const card = button.link;
					if (get.owner(card) == player) {
						if (_status.event.damage) {
							return 15 - get.value(card);
						}
						if (player.hp >= 3 || get.damageEffect(player, target, player) >= 0 || (player.hasSkill("dcpitian") && player.getHandcardLimit() - player.countCards("h") >= 1 && player.hp > 1)) {
							return 0;
						}
						if (ui.selected.buttons.length == 0) {
							return 10 - get.value(card);
						}
						return 0;
					} else {
						if (_status.event.damage) {
							return 0;
						}
						return -(get.sgnAttitude(player, target) || 1) * get.value(card);
					}
				})
				.set(
					"damage",
					get.damageEffect(target, player, player) > 10 &&
						player.countCards("he", card => {
							return lib.filter.canBeDiscarded(card, player, player) && get.value(card) < 5;
						}) >= 3
				)
				.forResult();
			if (!result?.bool) {
				return;
			}
			const links = result.links;
			const list1 = [];
			const list2 = [];
			const players = [player, target];
			for (const card of links) {
				if (get.owner(card) == player) {
					list1.push(card);
				} else {
					list2.push(card);
				}
			}
			if (list1.length && list2.length) {
				await game
					.loseAsync({
						lose_list: [
							[player, list1],
							[target, list2],
						],
						discarder: player,
					})
					.setContent("discardMultiple");
			} else if (list2.length) {
				await target.discard(list2);
			} else {
				await player.discard(list1);
			}
			if (list1.length >= 3 || list2.length >= 3) {
				if (list2.length >= 3) {
					players.reverse();
				}
				players[0].line(players[1]);
				await players[1].damage(players[0]);
			}
		},
		ai: {
			expose: 0.2,
			order: 4,
			result: {
				target(player, target) {
					return (get.effect(target, { name: "guohe_copy2" }, player, target) / 2) * (target.countDiscardableCards(player, "he") >= 2 ? 1.25 : 1) + get.damageEffect(target, player, target) / 3;
				},
			},
		},
	},
	dcpitian: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "damageEnd"],
			global: "loseAsyncAfter",
		},
		forced: true,
		locked: false,
		group: "dcpitian_draw",
		filter(event, player) {
			if (event.name == "damage") {
				return true;
			}
			return event.type == "discard" && event.getl(player).cards2.length > 0;
		},
		async content(event, trigger, player) {
			player.addMark("dcpitian_handcard", 1, false);
			player.addSkill("dcpitian_handcard");
			game.log(player, "的手牌上限", "#y+1");
		},
		subSkill: {
			draw: {
				audio: "dcpitian",
				trigger: { player: "phaseJieshuBegin" },
				filter(event, player) {
					return player.countCards("h") < player.getHandcardLimit();
				},
				prompt2(event, player) {
					return "摸" + get.cnNumber(Math.min(5, player.getHandcardLimit() - player.countCards("h"))) + "张牌，重置因〖辟田〗增加的手牌上限";
				},
				check(event, player) {
					return player.getHandcardLimit() - player.countCards("h") > Math.min(2, player.hp - 1);
				},
				async content(event, trigger, player) {
					const num = Math.min(5, player.getHandcardLimit() - player.countCards("h"));
					if (num > 0) {
						await player.draw(num);
					}
					player.removeMark("dcpitian_handcard", player.countMark("dcpitian_handcard"), false);
					game.log(player, "重置了", "#g【辟田】", "增加的手牌上限");
				},
			},
			handcard: {
				markimage: "image/card/handcard.png",
				intro: {
					content(storage, player) {
						return "手牌上限+" + storage;
					},
				},
				charlotte: true,
				mod: {
					maxHandcard(player, num) {
						return num + player.countMark("dcpitian_handcard");
					},
				},
			},
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (get.tag(card, "discard")) {
						return 0.9;
					}
					if (get.tag(card, "damage")) {
						return 0.95;
					}
				},
			},
		},
	},
	//新服二赵
	dcqingren: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		filter(event, player) {
			return player.hasHistory("useSkill", evt => ["yizan_use", "yizan_use_backup"].includes(get.sourceSkillFor(evt)));
		},
		async content(event, trigger, player) {
			player.draw(player.getHistory("useSkill", evt => ["yizan_use", "yizan_use_backup"].includes(get.sourceSkillFor(evt))).length);
		},
		ai: {
			combo: "yizan_use",
		},
	},
	dclongyuan: {
		audio: "xinfu_longyuan",
		forced: true,
		juexingji: true,
		trigger: { global: "phaseEnd" },
		skillAnimation: true,
		animationColor: "orange",
		filter(event, player) {
			return player.countMark("yizan_use") >= 3;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.draw(2);
			player.recover();
			player.storage.yizan = true;
		},
		derivation: "yizan_rewrite",
		ai: { combo: "yizan_use" },
	},
	//黄皓
	dcqinqing: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		direct: true,
		filter(event, player) {
			var zhu = game.filterPlayer(current => current.getSeatNum() == 1)[0];
			if (!zhu || !zhu.isIn()) {
				return false;
			}
			return game.hasPlayer(current => {
				return current != player && current.inRange(zhu);
			});
		},
		seatRelated: true,
		async content(event, trigger, player) {
			const result = await player
				.chooseTarget(get.prompt2("dcqinqing"), function (card, player, target) {
					const zhu = game.filterPlayer(current => current.getSeatNum() == 1)[0];
					return target != player && target.inRange(zhu) && target.countDiscardableCards(player, "he") > 0;
				})
				.set("ai", function (target) {
					const zhu = game.filterPlayer(current => current.getSeatNum() == 1)[0];
					const he = target.countCards("he");
					if (get.attitude(_status.event.player, target) > 0) {
						if (target.countCards("h") > zhu.countCards("h") + 1) {
							return 0.1;
						}
					} else {
						if (he > zhu.countCards("h") + 1) {
							return 2;
						}
						if (he > 0) {
							return 1;
						}
					}
					return 0;
				})
				.forResult();
			if (!result.bool) {
				return;
			}
			const target = result.targets[0];
			event.target = target;
			player.logSkill("dcqinqing", target);
			if (target.countCards("he")) {
				await player.discardPlayerCard(target, "he", true);
			}
			const zhu = game.filterPlayer(current => current.getSeatNum() == 1)[0];
			if (zhu && zhu.isIn()) {
				if (target.countCards("h") > zhu.countCards("h")) {
					await player.draw();
				}
			}
		},
	},
	dccunwei: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		forced: true,
		filter(event, player) {
			return get.type2(event.card) == "trick" && (event.targets.length == 1 || player.countCards("he") > 0);
		},
		async content(event, trigger, player) {
			if (trigger.targets.length == 1) {
				player.draw();
			} else if (player.countCards("he") > 0) {
				player.chooseToDiscard("he", true, "存畏：请弃置一张牌");
			}
		},
		ai: { halfneg: true },
	},
};
