import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcsbmingfang" | "dcsbjibian" | "dcsblingshu" | "dcsbwankang">} */
export const groupSkills = {
	//谋蒋干
	dcsbmingfang: {
		audio: 2,
		trigger: {
			player: ["phaseBegin", "phaseUseBegin"],
		},
		filter(event, player) {
			return game.hasPlayer(current => {
				if (current == player) {
					return false;
				}
				if (event.name == "phase") {
					return current.countCards("h");
				}
				return player.canCompare(current);
			});
		},
		async cost(event, trigger, player) {
			if (trigger.name == "phase") {
				event.result = await player
					.chooseTarget(get.prompt(event.skill), "令一名其他角色展示一张手牌，此牌在其手牌中时其受到伤害+1", (card, player, target) => {
						return player != target && target.countCards("h");
					})
					.set("ai", target => {
						const player = get.player();
						return get.damageEffect(target, player, player);
					})
					.forResult();
				return;
			}
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "与一名其他角色拼点，若你赢则对其造成1点伤害且本回合结束阶段可再次拼点，若你没赢则你与其横置", (card, player, target) => {
					return player != target && player.canCompare(target);
				})
				.set("ai", target => {
					const player = get.player();
					return get.damageEffect(target, player, player) / (target.countCards("h") + 1);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			if (trigger.name == "phase") {
				if (!target.countCards("h")) {
					return;
				}
				const result = await target
					.chooseCard("展示一张手牌，此牌在你手牌中时你受到伤害+1", true, "h")
					.set("ai", card => {
						const player = get.player(),
							num = get.number(card);
						let eff = player.getUseValue(card);
						if (typeof num == "number") {
							eff *= num;
						}
						return eff;
					})
					.forResult();
				if (result?.bool && result.cards?.length) {
					await target.showCards(result.cards, `${get.translation(player)}发动了【明访】`);
					const skill = "dcsbmingfang_damage";
					target.addSkill(skill);
					target.addGaintag(result.cards, skill);
				}
				return;
			}
			const result = await player.chooseToCompare(target).forResult();
			if (result?.bool) {
				player.line(target);
				await target.damage(player);
				player
					.when("phaseJieshuBegin")
					.filter(evt => evt.getParent() == trigger.getParent())
					.step(async (event, trigger, player) => {
						if (game.hasPlayer(current => player.canCompare(current))) {
							const result2 = await player
								.chooseTarget("明访：是否与一名角色拼点？", (card, player, target) => {
									return player.canCompare(target);
								})
								.set("ai", target => {
									const player = get.player();
									return get.effect(target, { name: "guohe_copy", position: "h" }, player, player);
								})
								.forResult();
							if (result2?.bool && result2.targets?.length) {
								const {
									targets: [target],
								} = result2;
								player.line(target);
								const result3 = await player.chooseToCompare(target).forResult();
								if (result3?.bool) {
									await target.damage();
								} else {
									await player.draw();
									await player.link(true);
									await target.link(true);
								}
							}
						}
					});
			} else {
				await player.draw();
				await player.link(true);
				await target.link(true);
			}
		},
		subSkill: {
			damage: {
				charlotte: true,
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				trigger: {
					player: "damageBegin3",
				},
				filter(event, player) {
					return player.countCards("h", card => card.hasGaintag("dcsbmingfang_damage")) > 0;
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					trigger.num += player.countCards("h", card => card.hasGaintag(event.name));
				},
			},
		},
	},
	dcsbjibian: {
		audio: 2,
		trigger: {
			global: "chooseToCompareBegin",
		},
		filter(event, player) {
			if (player == event.player) {
				return true;
			}
			if (event.targets) {
				return event.targets.includes(player);
			}
			return player == event.target;
		},
		async cost(event, trigger, player) {
			const list = Array.from(Array(3)).map((v, i) => `${get.cnNumber(i + 1)}张`);
			const result = await player
				.chooseControl([...list, "cancel2"])
				.set("prompt", get.prompt2(event.skill))
				.set("ai", () => 2)
				.forResult();
			if (result.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: result.index + 1,
				};
			}
		},
		async content(event, trigger, player) {
			const num = event.cost_data;
			await player.draw(num);
			player
				.when({
					global: "compare",
				})
				.filter(evt => evt == trigger && (evt.player == player || evt.target == player))
				.step(async (event, trigger, player) => {
					if (trigger.player == player) {
						game.log(player, "的拼点牌点数-", num);
						trigger.num1 = Math.max(1, trigger.num1 - num);
					}
					if (trigger.target == player) {
						game.log(player, "的拼点牌点数-", num);
						trigger.num2 = Math.max(1, trigger.num2 - num);
					}
				});
		},
	},
	//谋淳于琼
	dcsblingshu: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			const player = event.player;
			event.set("lingshuEnable", player.hasHistory("damage") || player.hasHistory("sourceDamage"));
		},
		onChooseToRespond(event) {
			if (game.online) {
				return;
			}
			const player = event.player;
			event.set("lingshuEnable", player.hasHistory("damage") || player.hasHistory("sourceDamage"));
		},
		filter(event, player) {
			if (event.type == "wuxie") {
				return false;
			}
			if (event.lingshuEnable) {
				return false;
			}
			if (
				!player.countCards("hes", card => {
					if (_status.connectMode) {
						return true;
					}
					return get.type2(card) != "basic";
				})
			) {
				return false;
			}
			return (
				get.inpileVCardList(info => {
					if (info[0] != "basic") {
						return false;
					}
					return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
				}).length > 0
			);
		},
		chooseButton: {
			dialog(event, player) {
				const vcards = get.inpileVCardList(info => {
					if (info[0] != "basic") {
						return false;
					}
					return event.filterCard(get.autoViewAs({ name: info[2], nature: info[3] }, "unsure"), player, event);
				});
				return ui.create.dialog("领戍", [vcards, "vcard"]);
			},
			check(button) {
				if (get.event().getParent().type != "phase") {
					return 1;
				}
				return get.player().getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				return {
					audio: "dcsblingshu",
					popname: true,
					viewAs: { name: links[0][2], nature: links[0][3] },
					filterCard(card, player) {
						return get.type2(card) != "basic";
					},
					selectCard: 1,
					position: "hes",
				};
			},
			prompt(links, player) {
				return "将一张非基本牌当" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用或打出";
			},
		},
		hiddenCard(player, name) {
			if (player.hasHistory("damage") || player.hasHistory("sourceDamage")) {
				return false;
			}
			return get.type(name) == "basic" && player.countCards("hes", card => _status.connectMode || get.type2(card) != "basic") > 0;
		},
		ai: {
			respondSha: true,
			respondShan: true,
			skillTagFilter(player) {
				if (player.hasHistory("damage") || player.hasHistory("sourceDamage")) {
					return false;
				}
				return player.countCards("hes", card => _status.connectMode || get.type2(card) != "basic") > 0;
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
			tag: {
				recover: 1,
				save: 1,
			},
		},
		group: ["dcsblingshu_gain"],
		subSkill: {
			backup: {},
			gain: {
				audio: "dcsblingshu",
				trigger: {
					source: "damageSource",
					player: "damageEnd",
				},
				filter(event, player, name) {
					const key = name == "damageSource" ? "sourceDamage" : "damage";
					return player.getHistory(key, evt => evt.num > 0).indexOf(event) == 0 && _status.discarded?.length > 0;
				},
				prompt2: "随机获得一张本回合进入弃牌堆的牌",
				async content(event, trigger, player) {
					await player.gain(_status.discarded.randomGet(), "gain2");
				},
			},
		},
	},
	dcsbwankang: {
		audio: 2,
		trigger: {
			player: "dying",
		},
		async content(event, trigger, player) {
			await player.recover();
			player.addMark(event.name, 1);
			await player.draw(2);
			player.addTempSkill("dcsbwankang_sha");
		},
		marktext: "抗",
		intro: {
			name: "抗",
			name2: "抗",
			content: "mark",
		},
		ai: {
			save: true,
			order: 1,
			result: {
				player: 1,
			},
		},
		subSkill: {
			sha: {
				audio: "dcsbwankang",
				trigger: {
					global: "phaseEnd",
				},
				forced: true,
				charlotte: true,
				locked: false,
				async content(event, trigger, player) {
					while (true) {
						const targets = player.getHistory("damage").reduce((arr, evt) => {
							if (evt.source?.isIn()) {
								arr.add(evt.source);
							}
							return arr;
						}, []);
						const next = player
							.chooseToUse(function (card, player, event) {
								if (get.name(card) != "sha") {
									return false;
								}
								return lib.filter.filterCard.apply(this, arguments);
							}, "顽抗：是否对本回合对你造成过伤害的角色使用一张【杀】？")
							.set("targetRequired", true)
							.set("complexSelect", true)
							.set("complexTarget", true)
							.set("filterTarget", function (card, player, target) {
								if (!get.event().targetx.includes(target)) {
									return false;
								}
								return lib.filter.filterTarget.apply(this, arguments);
							})
							.set("oncard", (card, player) => {
								player.removeMark("dcsbwankang", 1);
							})
							.set("targetx", targets);
						const result = await next.forResult();
						if (
							game.hasGlobalHistory("everything", evt => {
								if (evt.name != "die") {
									return false;
								}
								return evt.reason?.getParent(next.name) == next;
							})
						) {
							player.clearMark("dcsbwankang");
						}
						if (!result?.bool) {
							break;
						}
					}
					if (player.hasMark("dcsbwankang")) {
						await player.die();
					}
				},
			},
		},
	},
};
