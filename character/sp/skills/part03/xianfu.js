import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xianfu" | "xianfu_mark" | "xianfu2" | "xianfu3" | "chouce" | "fuqi">} */
export const groupSkills = {
	xianfu: {
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		locked: true,
		filter(event, player) {
			return game.hasPlayer(current => current != player) && (event.name != "phase" || game.phaseNumber == 0);
		},
		audio: 6,
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget("请选择【先辅】的目标", lib.translate.xianfu_info, true, function (card, player, target) {
					return target != player && (!player.storage.xianfu2 || !player.storage.xianfu2.includes(target));
				})
				.set("ai", function (target) {
					let att = get.attitude(_status.event.player, target);
					if (att > 0) {
						return att + 1;
					}
					if (att == 0) {
						return Math.random();
					}
					return att;
				})
				.set("animate", false)
				.forResult();
		},
		logAudio: () => 2,
		logLine: false,
		async content(event, trigger, player) {
			let [target] = event.targets;
			player.storage.xianfu2 ??= [];
			player.storage.xianfu2.push(target);
			player.addSkill("xianfu2");
			const func = (player, target) => {
				target.storage.xianfu_mark ??= [];
				target.storage.xianfu_mark.add(player);
				target.storage.xianfu_mark.sortBySeat();
				target.markSkill("xianfu_mark", null, null, true);
			};
			if (event.isMine()) {
				func(player, target);
			} else if (player.isOnline2()) {
				player.send(func, player, target);
			}
		},
	},
	xianfu_mark: {
		marktext: "辅",
		intro: {
			name: "先辅",
			content: "当你受到伤害后，$受到等量的伤害，当你回复体力后，$回复等量的体力",
		},
	},
	xianfu2: {
		audio: "xianfu",
		charlotte: true,
		trigger: { global: ["damageEnd", "recoverEnd"] },
		forced: true,
		sourceSkill: "xianfu",
		filter(event, player) {
			if (event.player.isDead() || !player.storage.xianfu2 || !player.storage.xianfu2.includes(event.player) || event.num <= 0) {
				return false;
			}
			if (event.name == "damage") {
				return true;
			}
			return player.isDamaged();
		},
		logAudio(event, player) {
			if (event.name == "damage") {
				return ["xianfu5.mp3", "xianfu6.mp3"];
			}
			return ["xianfu3.mp3", "xianfu4.mp3"];
		},
		logTarget: "player",
		content() {
			"step 0";
			var target = trigger.player;
			if (!target.storage.xianfu_mark) {
				target.storage.xianfu_mark = [];
			}
			target.storage.xianfu_mark.add(player);
			target.storage.xianfu_mark.sortBySeat();
			target.markSkill("xianfu_mark");
			game.delayx();
			"step 1";
			player[trigger.name](trigger.num, "nosource");
		},
		onremove(player) {
			if (!player.storage.xianfu2) {
				return;
			}
			game.countPlayer(function (current) {
				if (player.storage.xianfu2.includes(current) && current.storage.xianfu_mark) {
					current.storage.xianfu_mark.remove(player);
					if (!current.storage.xianfu_mark.length) {
						current.unmarkSkill("xianfu_mark");
					} else {
						current.markSkill("xianfu_mark");
					}
				}
			});
			delete player.storage.xianfu2;
		},
		group: "xianfu3",
	},
	xianfu3: {
		trigger: { global: "dieBegin" },
		silent: true,
		sourceSkill: "xianfu",
		filter(event, player) {
			return event.player == player || (player.storage.xianfu2 && player.storage.xianfu2.includes(event.player));
		},
		content() {
			if (player == trigger.player) {
				lib.skill.xianfu2.onremove(player);
			} else {
				player.storage.xianfu2.remove(event.player);
			}
		},
	},
	chouce: {
		audio: 2,
		audioname2: { sxrm_caocao: "chouce_sxrm_caocao" },
		trigger: { player: "damageEnd" },
		getIndex: event => event.num,
		filter(event) {
			return event.num > 0;
		},
		async content(event, trigger, player) {
			const result = await player.judge().forResult();
			const color = result?.color;
			let result2;
			switch (color) {
				case "black":
					if (game.hasPlayer(current => current.countDiscardableCards(player, "hej"))) {
						result2 = await player
							.chooseTarget(
								"弃置一名角色区域内的一张牌",
								(card, player, target) => {
									return target.countDiscardableCards(player, "hej");
								},
								true
							)
							.set("ai", target => {
								const player = get.player();
								let att = get.attitude(player, target);
								if (att < 0) {
									att = -Math.sqrt(-att);
								} else {
									att = Math.sqrt(att);
								}
								return att * lib.card.guohe.ai.result.target(player, target);
							})
							.forResult();
					}
					break;

				case "red": {
					const next = player.chooseTarget("令一名角色摸一张牌");
					if (player.storage.xianfu2?.length) {
						next.set("prompt2", "（若目标为" + get.translation(player.storage.xianfu2) + "则改为摸两张牌）");
					}
					next.set("ai", target => {
						const player = get.player();
						let att = get.attitude(player, target) / Math.sqrt(1 + target.countCards("h"));
						if (target.hasSkillTag("nogain")) {
							att /= 10;
						}
						if (player.storage.xianfu2?.includes(target)) {
							return att * 2;
						}
						return att;
					});
					result2 = await next.forResult();
					break;
				}

				default:
					break;
			}
			if (result2?.bool && result2?.targets?.length) {
				const target = result2.targets[0];
				player.line(target, "green");
				if (color == "black") {
					if (target.countDiscardableCards(player, "hej")) {
						await player.discardPlayerCard(target, "hej", true);
					}
				} else {
					if (player.storage.xianfu2?.includes(target)) {
						target.storage.xianfu_mark ??= [];
						target.storage.xianfu_mark.add(player);
						target.storage.xianfu_mark.sortBySeat();
						target.markSkill("xianfu_mark");
						await target.draw(2);
					} else {
						await target.draw();
					}
				}
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						if (target.hp >= 4) {
							return [1, get.tag(card, "damage") * 1.5];
						}
						if (target.hp == 3) {
							return [1, get.tag(card, "damage") * 1];
						}
						if (target.hp == 2) {
							return [1, get.tag(card, "damage") * 0.5];
						}
					}
				},
			},
		},
	},
	fuqi: {
		targetprompt2: target => {
			const player = get.player(),
				card = get.card();
			if (get.type(card) == "trick" || (get.type(card) == "basic" && !["shan", "tao", "jiu", "du"].includes(card.name))) {
				if (target !== player && get.distance(target, player) <= 1) {
					return "不可响应";
				}
			}
		},
		onChooseToUse(event) {
			event.targetprompt2.add(lib.skill.fuqi.targetprompt2);
		},
		onChooseTarget(event) {
			event.targetprompt2.add(lib.skill.fuqi.targetprompt2);
		},
		audio: 2,
		forced: true,
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			return (
				event.card &&
				(get.type(event.card) == "trick" || (get.type(event.card) == "basic" && !["shan", "tao", "jiu", "du"].includes(event.card.name))) &&
				game.hasPlayer(function (current) {
					return current != player && get.distance(current, player) <= 1;
				})
			);
		},
		content() {
			trigger.directHit.addArray(
				game.filterPlayer(function (current) {
					return current != player && get.distance(current, player) <= 1;
				})
			);
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				return get.distance(arg.target, player) <= 1;
			},
		},
	},
};
