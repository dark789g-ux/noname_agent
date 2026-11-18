import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanlianhe" | "clanhuanjia" | "clansankuang" | "clanbeishi">} */
export const groupSkills = {
	//族韩融
	//我们连和！（？）
	clanlianhe: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return game.countPlayer(current => !current.isLinked()) > 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), 2, (card, player, target) => {
					return !target.isLinked();
				})
				.set("ai", target => {
					let att = get.attitude(_status.event.player, target);
					if (att > 0) {
						att /= 1.2;
					}
					return Math.abs(att);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets;
			await game.doAsyncInOrder(targets, target => target.link(true));
			targets.forEach(target => {
				target
					.when({ player: "phaseUseEnd" })
					.filter(evt => evt != trigger)
					.step(async (event, trigger, player) => {
						trigger.clanlianhe_check = true;
					});
			});
			const effect = event.name + "_effect";
			player.addSkill(effect);
			player.setStorage(effect, player.getStorage(effect).concat(targets), true);
		},
		subSkill: {
			effect: {
				audio: "clanlianhe",
				trigger: { global: ["phaseUseEnd", "die"] },
				charlotte: true,
				forced: true,
				locked: false,
				popup: false,
				onremove: true,
				filter(event, player) {
					return player.getStorage("clanlianhe_effect").includes(event.player) && event.clanlianhe_check;
				},
				marktext: "连",
				intro: { content: (storage = [], player) => `已选择目标：${get.translation(storage.toUniqued())}` },
				async content(event, trigger, player) {
					player.unmarkAuto(event.name, [trigger.player]);
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
					if (trigger.name == "die") {
						return;
					}

					if (
						trigger.player.hasHistory("gain", evt => {
							return evt.getParent().name == "draw" && evt.getParent("phaseUse") == trigger;
						})
					) {
						return;
					}

					player.logSkill(event.name, trigger.player);

					let num = 0;
					trigger.player.getHistory("gain", evt => {
						if (evt.getParent("phaseUse") != trigger) {
							return false;
						}
						num += evt.cards.length;
						return false;
					});
					num = Math.min(num, 3);

					let result;
					if (num <= 1) {
						result = { bool: false };
					} else {
						const pos = player == trigger.player ? "e" : "he";
						result = await trigger.player
							.chooseCard(`连和：交给${get.translation(player)}${get.cnNumber(num - 1)}张牌，或点“取消”令其摸${get.cnNumber(num + 1)}张牌`, num - 1, pos)
							.set("ai", card => {
								if (get.event().draw) {
									return 0;
								}
								return 5 - get.value(card);
							})
							.set("draw", get.attitude(trigger.player, player) >= 0)
							.forResult();
					}

					if (result.bool) {
						await trigger.player.give(result.cards, player);
					} else {
						await player.draw(num + 1);
					}
				},
			},
		},
	},
	clanhuanjia: {
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		filter(event, player) {
			return game.hasPlayer(current => player.canCompare(current));
		},
		direct: true,
		async content(event, trigger, player) {
			let result;
			let target;
			let winner;
			let cards = [];
			let card;

			result = await player
				.chooseTarget(get.prompt("clanhuanjia"), "与一名其他角色拼点，赢的角色可以使用一张拼点牌。若此牌未造成过伤害，你获得另一张拼点牌，否则你失去一个技能", (card, player, target) => {
					return player.canCompare(target);
				})
				.set("ai", target => {
					const player = _status.event.player;
					if (get.attitude(player, target) <= 0) {
						const hs = player.getCards("h").sort((a, b) => get.number(b) - get.number(a));
						const ts = target.getCards("h").sort((a, b) => get.number(b) - get.number(a));
						if (!hs.length || !ts.length) {
							return 0;
						}
						if (get.number(hs[0]) > get.number(ts[0]) && !get.tag(hs[0], "damage") && player.hasValueTarget(hs[0])) {
							return 1;
						}
						return Math.random() - 0.4;
					}
					return 0;
				})
				.forResult();

			if (!result.bool) {
				return;
			}

			[target] = result.targets;
			event.target = target;
			player.logSkill("clanhuanjia", target);

			result = await player.chooseToCompare(target).forResult();
			if (result.tie) {
				return;
			}

			winner = result.bool ? player : target;
			event.winner = winner;

			game.getGlobalHistory("cardMove", evt => {
				if (evt.getParent(3) == event) {
					cards.addArray(evt.cards.filterInD("d"));
				}
			});
			if (!cards.length) {
				return;
			}
			event.cards = cards;

			const cardsx = cards.filter(i => get.position(i, true) == "d" && winner.hasUseTarget(i));
			if (cardsx.length) {
				result = await winner
					.chooseButton(["缓颊：是否使用其中的一张牌？", cardsx])
					.set("filterButton", button => {
						return _status.event.player.hasUseTarget(button.link);
					})
					.set("ai", button => {
						let damage = 1;
						if (_status.event.att > 2 && get.tag(button.link, "damage")) {
							damage *= 2;
						}
						return _status.event.player.getUseValue(button.link) * damage + 0.1;
					})
					.set("att", get.attitude(winner, player))
					.forResult();

				if (result.bool) {
					[card] = result.links;
					event.card = card;
					cards.remove(card);
					winner.$gain2(card, false);
					await game.delayx();
					await winner.chooseUseTarget(true, card, false);
				}
			}

			if (
				game.hasPlayer2(current => {
					return current.hasHistory("sourceDamage", evt => evt.cards && evt.cards[0] == card);
				})
			) {
				const skills = player.getSkills(null, false, false).filter(skill => {
					const info = get.info(skill);
					if (!info || get.is.empty(info) || info.charlotte) {
						return false;
					}
					return true;
				});
				result = await player
					.chooseControl(skills)
					.set(
						"choiceList",
						skills.map(i => {
							return '<div class="skill">【' + get.translation(lib.translate[i + "_ab"] || get.translation(i).slice(0, 2)) + "】</div><div>" + get.skillInfoTranslation(i, player, false) + "</div>";
						})
					)
					.set("displayIndex", false)
					.set("prompt", "恤民：失去一个技能")
					.set("ai", () => {
						let choices = _status.event.controls.slice();
						const value = skill => get.skillRank(skill, "in") + get.skillRank(skill, "out");
						choices = choices.map(skill => [skill, value(skill)]);
						const list = choices.sort((a, b) => a[1] - b[1])[0];
						if (list[1] < 2) {
							return list[0];
						}
						if (_status.event.controls.includes("clanxumin")) {
							return "clanxumin";
						}
						return list[0];
					})
					.forResult();
				if (result.control) {
					await player.removeSkills(result.control);
				}
			} else {
				await player.gain(cards, "gain2");
			}
		},
		ai: {
			expose: 0.1,
		},
	},
	//族荀谌
	clansankuang: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		locked: true,
		filter(event, player) {
			if (!game.hasPlayer(current => current != player)) {
				return false;
			}
			const type = get.type2(event.card);
			return player.getRoundHistory("useCard", evt => get.type2(evt.card) == type).indexOf(event) == 0;
		},
		getNum(player) {
			return (player.countCards("ej") > 0) + player.isDamaged() + (Math.max(0, player.hp) < player.countCards("h"));
		},
		async cost(event, trigger, player) {
			const func = (event, player) => {
				const name = event.skill;
				game.countPlayer(target => {
					if (target != player) {
						target.prompt(get.translation(name) + get.info(name).getNum(target));
					}
				});
			};
			if (event.player == game.me) {
				func(event, player);
			} else if (event.isOnline()) {
				player.send(func, event, player);
			}
			const cards = trigger.cards.filterInD("oe");
			event.result = await player
				.chooseTarget("三恇：选择一名其他角色", "令其交给你至少X张牌" + (cards.length ? "，然后其获得" + get.translation(cards) : "") + "（X为以下条件中其满足的项数：场上有牌、已受伤、体力值小于手牌数）", true, lib.filter.notMe)
				.set("ai", target => {
					const { player, goon } = get.event();
					const att = get.attitude(player, target),
						num = lib.skill.clansankuang.getNum(target);
					if (num == 0) {
						return att;
					}
					if (goon) {
						return -att;
					}
					return -Math.sqrt(Math.abs(att)) - lib.skill.clansankuang.getNum(target);
				})
				.set(
					"goon",
					Math.max.apply(
						Math,
						trigger.cards.map(i => get.value(i))
					) <= 5 || trigger.cards.filterInD("oe").length == 0
				)
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const num = lib.skill.clansankuang.getNum(target),
				num2 = target.countCards("he");
			const cards = trigger.cards.filterInD("oe");
			const result =
				num2 == 0
					? { bool: false }
					: await target
							.chooseToGive(player, "he", num > 0, [Math.min(num2, num), Infinity], "allowChooseAll")
							.set("ai", get.unuseful)
							.set("prompt", num > 0 ? "是否交给" + get.translation(player) + "任意张牌" + (cards.length ? "并获得" + get.translation(cards) : "") + "？" : "交给" + get.translation(player) + "至少" + get.cnNumber(num) + "张牌")
							.forResult();
			if (!result?.bool || !result.cards?.length || !cards.length) {
				return;
			}
			await game.delayx();
			if (trigger.cards.filterInD().length) {
				await target.gain(trigger.cards.filterInD(), "gain2", "bySelf");
			} else if (trigger.cards.filterInD("e").length) {
				await target.gain(trigger.cards.filterInD("e"), get.owner(trigger.cards.filterInD("e")[0]), "give");
			}
		},
		ai: {
			reverseOrder: true,
			skillTagFilter(player) {
				if (player.getHistory("useCard", evt => get.type(evt.card) == "equip").length > 0) {
					return false;
				}
			},
			effect: {
				target_use(card, player, target) {
					if (player == target && get.type(card) == "equip" && !player.getHistory("useCard", evt => get.type(evt.card) == "equip").length == 0) {
						return [1, 3];
					}
				},
			},
			threaten: 1.6,
		},
	},
	clanbeishi: {
		init(player, skill) {
			if (player.getStorage(skill).length > 0) return;
			player.addSkill(skill + "_mark");
			const history = player.getAllHistory("useSkill", evt => evt.skill == "clansankuang");
			if (history.length) {
				const { targets } = history[0];
				player.markAuto(skill, targets);
			}
		},
		onremove: true,
		audio: 2,
		trigger: { global: ["loseAfter", "equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"] },
		forced: true,
		filter(event, player) {
			if (player.isHealthy()) {
				return false;
			}
			const history = player.getAllHistory("useSkill", evt => evt.skill == "clansankuang");
			if (!history.length) {
				return false;
			}
			const target = history[0].targets[0];
			if (target.countCards("h")) {
				return false;
			}
			const evt = event.getl(target);
			return evt?.hs?.length;
		},
		async content(event, trigger, player) {
			await player.recover();
		},
		derivation: "clansankuang",
		ai: { combo: "clansankuang" },
		intro: { content: ["每当$失去最后的手牌，你回复1点体力", '<span style="font-family:yuanli">“唉，我本袁氏故吏，又能做些什么呢……”</span>'].join("<br><br>") },
		subSkill: {
			mark: {
				trigger: { player: "logSkillBegin" },
				silent: true,
				firstDo: true,
				filter(event, player) {
					const history = player.getAllHistory("useSkill", evt => evt.skill == "clansankuang");
					return history.map(evt => evt.event).indexOf(event.getParent()) == 0;
				},
				async content(event, trigger, player) {
					player.markAuto("clanbeishi", trigger.targets);
				},
			},
		},
	},
};
