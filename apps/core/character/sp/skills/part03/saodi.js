import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "saodi" | "zhuitao" | "olfengji" | "olxuanhui">} */
export const groupSkills = {
	//田之间
	saodi: {
		audio: 2,
		trigger: { player: "useCardToPlayer" },
		filter(event, player) {
			const { target } = event;
			if (event.targets.length != 1 || target == player || [player, target].some(i => i.hasSkill("undist")) || !target.isIn()) {
				return false;
			}
			if (event.card.name != "sha" && get.type(event.card) != "trick") {
				return false;
			}
			const [left, right, left2, right2] = get.info("saodi").getTargets(player, target);
			return (target == left2 && left.some(i => lib.filter.targetEnabled2(event.card, player, i))) || (target == right2 && right.some(i => lib.filter.targetEnabled2(event.card, player, i)));
		},
		getTargets(source, target) {
			let left = [],
				right = [],
				left2 = source,
				right2 = source;
			while (left2 != target && right2 != target) {
				left2 = left2.getPrevious();
				right2 = right2.getNext();
				if (left2 != target) {
					left.push(left2);
				}
				if (right2 != target) {
					right.push(right2);
				}
			}
			return [left, right, left2, right2];
		},
		aiJudge(card, player, target, bool) {
			let left3 = false,
				right3 = false;
			let eff_left = 0,
				eff_right = 0;
			const [left, right, left2, right2] = get.info("saodi").getTargets(player, target);
			if (target == left2) {
				for (const i of left) {
					if (lib.filter.targetEnabled2(card, player, i)) {
						left3 = true;
						eff_left += get.effect(i, card, player, player);
					}
				}
			}
			if (target == right2) {
				for (const i of right) {
					if (lib.filter.targetEnabled2(card, player, i)) {
						right3 = true;
						eff_right += get.effect(i, card, player, player);
					}
				}
			}
			if (left3 && right3) {
				if (!bool) {
					return Math.max(eff_left, eff_right);
				}
				if (eff_left > Math.max(0, eff_right)) {
					return "↖顺时针";
				}
				if (eff_right > Math.max(0, eff_left)) {
					return "逆时针↗";
				}
				return "cancel2";
			} else if (left3) {
				if (bool) {
					return eff_left > 0 ? "↖顺时针" : "cancel2";
				}
				return eff_left;
			} else if (right3) {
				if (bool) {
					return eff_right > 0 ? "逆时针↗" : "cancel2";
				}
				return eff_right;
			} else {
				return bool ? "cancel2" : 0;
			}
		},
		async cost(event, trigger, player) {
			const choices = [];
			const { skill } = event,
				{ target, card } = trigger;
			const [left, right, left2, right2] = get.info(skill).getTargets(player, target);
			if (target == left2 && left.some(i => lib.filter.targetEnabled2(card, player, i))) {
				choices.push("↖顺时针");
			}
			if (target == right2 && right.some(i => lib.filter.targetEnabled2(card, player, i))) {
				choices.push("逆时针↗");
			}
			choices.push("cancel2");
			const { control } = await player
				.chooseControl(choices)
				.set("prompt", get.prompt(skill))
				.set("prompt2", `令自己和${get.translation(target)}某个方向之间的所有角色均成为${get.translation(card)}的目标`)
				.set("choices", choices)
				.set("ai", () => {
					const evt = get.event().getTrigger();
					return lib.skill.saodi.aiJudge(evt.card, evt.player, evt.target, true);
				})
				.forResult();
			if (control === "cancel2") {
				return;
			}
			const targets = [];
			game.log(player, "选择了", "#g" + control);
			if (control == "↖顺时针") {
				var current = player.getPrevious();
				while (current != target) {
					if (lib.filter.targetEnabled2(card, player, current)) {
						targets.push(current);
					}
					current = current.getPrevious();
				}
			} else {
				var current = player.getNext();
				while (current != target) {
					if (lib.filter.targetEnabled2(card, player, current)) {
						targets.push(current);
					}
					current = current.getNext();
				}
			}
			event.result = {
				bool: true,
				targets: targets,
			};
		},
		async content(event, trigger, player) {
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			trigger.targets.addArray(event.targets);
		},
		ai: {
			effect: {
				player_use(card, player, target) {
					if (!target || player._saodi_judging || ui.selected.targets.length || player == target || target.hasSkill("undist")) {
						return;
					}
					if (typeof card != "object" || (card.name != "sha" && get.type(card) != "trick")) {
						return false;
					}
					player._saodi_judging = true;
					var effect = lib.skill.saodi.aiJudge(card, player, target);
					delete player._saodi_judging;
					if (effect > 0) {
						return [1, effect / Math.max(0.01, get.attitude(player, player))];
					}
				},
			},
		},
	},
	zhuitao: {
		audio: 2,
		mod: {
			globalFrom(player, target, distance) {
				if (player.getStorage("zhuitao").includes(target)) {
					return distance - 1;
				}
			},
		},
		locked: false,
		trigger: {
			player: "phaseZhunbeiBegin",
			source: "damageSource",
		},
		filter(event, player) {
			const storage = player.getStorage("zhuitao");
			if (event.name == "damage") {
				return storage.includes(event.player);
			}
			return game.hasPlayer(current => current != player && !storage.includes(current));
		},
		async cost(event, trigger, player) {
			if (trigger.name == "damage") {
				event.result = {
					bool: true,
					targets: [trigger.player],
				};
			} else {
				event.result = await player
					.chooseTarget(get.prompt(event.skill), "令自己至一名其他角色的距离-1", (card, player, target) => {
						return target != player && !player.getStorage("zhuitao").includes(target);
					})
					.set("ai", target => {
						const player = get.player();
						const att = get.attitude(player, target);
						if (att < 0 && get.distance(player, target) == 2) {
							return 100;
						}
						return get.distance(player, target) * (1 - get.sgn(att) / 3);
					})
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				player.unmarkAuto(event.name, [trigger.player]);
			} else {
				player.markAuto(event.name, event.targets[0]);
				await game.delayx();
			}
		},
		onremove: true,
		intro: {
			content: "至$的距离-1",
			onunmark: true,
		},
	},
	//生鱼片
	olfengji: {
		audio: 2,
		trigger: { global: "roundStart" },
		forced: true,
		locked: false,
		content() {
			"step 0";
			player
				.chooseTarget("丰积：请选择增加摸牌的目标", "令自己本轮摸牌阶段的额定摸牌数-1，且目标本轮摸牌阶段的额定摸牌数+2。或者点击「取消」，令自己本轮摸牌阶段的额定摸牌数+1", lib.filter.notMe)
				.set("ai", function (target) {
					var player = _status.event.player;
					var att = get.attitude(player, target),
						dist = get.distance(player, target, "absolute");
					if (att > 0) {
						if (target.hasJudge("lebu") || target.hasJudge("bingliang")) {
							return 0;
						}
						if (_status.event.goon) {
							return att / dist;
						}
						if (
							game.countPlayer(function (current) {
								return current != player && current != target && get.attitude(player, current) < 0 && get.distance(player, current, "absolute") < dist;
							}) >= target.hp
						) {
							return 0;
						}
						return att / dist;
					}
					if (player.hasSkill("olxuanhui", null, null, false) && !player.isTempBanned("olxuanhui") && att < 0) {
						const first = get.event().getTrigger().player,
							list = ["draw", "sha"];
						if (first == player || get.distance(player, first, "absolute") > dist) {
							const targets = [target.storage["olfengji_" + list[0]] || 0, target.storage["olfengji_" + list[1]] || 0];
							return 1 + targets.reduce((sum, num) => sum + num, 0);
						}
					}
					return 0;
				})
				.set("goon", player.skipList.includes("lebu"));
			"step 1";
			if (!player.storage.olfengji_draw) {
				player.storage.olfengji_draw = 0;
			}
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "thunder");
				player.storage.olfengji_draw--;
				if (!target.storage.olfengji_draw) {
					target.storage.olfengji_draw = 0;
				}
				target.storage.olfengji_draw += 2;
				target.addTempSkill("olfengji_draw", "roundStart");
				target.markSkill("olfengji_draw");
			} else {
				player.storage.olfengji_draw++;
			}
			player.addTempSkill("olfengji_draw", "roundStart");
			player.markSkill("olfengji_draw");
			"step 2";
			player.chooseTarget("丰积：请选择增加使用杀次数的目标", "令自己本轮使用杀的次数上限-1，且目标本轮使用杀的次数上限+2。或者点击「取消」，令自己本轮使用杀的次数上限+1", lib.filter.notMe).set("ai", function (target) {
				var player = _status.event.player;
				if (target.countMark("olfengji_draw") > 0 && target.getCardUsable("sha") < 2 && get.attitude(player, target) > 0) {
					return get.attitude(player, target);
				}
				if (player.hasSkill("olxuanhui", null, null, false) && !player.isTempBanned("olxuanhui") && get.attitude(player, target) < 0) {
					const first = get.event().getTrigger().player,
						list = ["draw", "sha"];
					if (first == player || get.distance(player, first, "absolute") > get.distance(player, target, "absolute")) {
						const targets = [target.storage["olfengji_" + list[0]] || 0, target.storage["olfengji_" + list[1]] || 0];
						return 1 + targets.reduce((sum, num) => sum + num, 0);
					}
				}
				return 0;
			});
			"step 3";
			if (!player.storage.olfengji_sha) {
				player.storage.olfengji_sha = 0;
			}
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "fire");
				player.storage.olfengji_sha--;
				if (!target.storage.olfengji_sha) {
					target.storage.olfengji_sha = 0;
				}
				target.storage.olfengji_sha += 2;
				target.addTempSkill("olfengji_sha", "roundStart");
				target.markSkill("olfengji_sha");
			} else {
				player.storage.olfengji_sha++;
			}
			player.addTempSkill("olfengji_sha", "roundStart");
			player.markSkill("olfengji_sha");
		},
		subSkill: {
			sha: {
				charlotte: true,
				onremove: true,
				intro: {
					content(storage) {
						return "使用【杀】的次数上限" + (storage >= 0 ? "+" : "") + storage;
					},
				},
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.storage.olfengji_sha;
						}
					},
				},
			},
			draw: {
				charlotte: true,
				onremove: true,
				intro: {
					content(storage) {
						return "额定摸牌数" + (storage >= 0 ? "+" : "") + storage;
					},
				},
				trigger: { player: "phaseDrawBegin2" },
				forced: true,
				filter(event, player) {
					return !event.numFixed;
				},
				content() {
					trigger.num += player.storage.olfengji_draw;
				},
			},
		},
	},
	olxuanhui: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			const targets = lib.skill.olxuanhui.logTarget(event, player);
			return targets && targets.length;
		},
		logTarget(event, player) {
			return game.filterPlayer(target => {
				if (target == player) {
					return false;
				}
				return (player.hasSkill("olfengji_sha") && target.hasSkill("olfengji_sha")) || (player.hasSkill("olfengji_draw") && target.hasSkill("olfengji_draw"));
			});
		},
		check(event, player) {
			const targets = lib.skill.olxuanhui.logTarget(event, player),
				list = ["sha", "draw"];
			let sum = 0;
			for (const target of targets) {
				let eff = 0;
				for (const skill of list) {
					if (typeof player.storage["olfengji_" + skill] == "number") {
						eff += player.storage["olfengji_" + skill];
					}
					if (typeof target.storage["olfengji_" + skill] == "number") {
						eff -= target.storage["olfengji_" + skill];
					}
				}
				if (get.attitude(player, target) <= 0 || target.getSeatNum() < player.getSeatNum()) {
					eff *= -1;
				}
				sum += eff;
			}
			return sum > 0;
		},
		async content(event, trigger, player) {
			for (const target of event.targets) {
				const list = ["draw", "sha"];
				for (const effect of list) {
					const skill = `olfengji_${effect}`;
					if (typeof player.storage[skill] != "number") {
						continue;
					}
					if (typeof target.storage[skill] != "number") {
						continue;
					}
					const num = player.storage[skill];
					player.storage[skill] = target.storage[skill];
					target.storage[skill] = num;
					target.markSkill(skill);
					player.markSkill(skill);
					game.log(player, "与", target, "交换了", `#g【丰积·${effect == "draw" ? "摸牌" : "出杀"}】`, "的数值");
				}
			}
			player.tempBanSkill("olxuanhui", "dieAfter");
		},
		ai: {
			combo: "olfengji",
		},
	},
};
