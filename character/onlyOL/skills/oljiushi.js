import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oljiushi" | "olsbjinming">} */
export const groupSkills = {
	//界曹植
	oljiushi: {
		audio: 2,
		trigger: {
			player: "useCard",
		},
		filter(event, player) {
			if (!player.isTurnedOver()) {
				return false;
			}
			return event.player.hasHistory("lose", function (evt) {
				const evtx = evt.relatedEvent || evt.getParent();
				if (evtx != event) {
					return false;
				}
				for (var i in evt.gaintag_map) {
					if (evt.gaintag_map[i].includes("reluoying")) {
						return true;
					}
				}
				return false;
			});
		},
		async content(event, trigger, player) {
			trigger.directHit.addArray(game.players);
		},
		forced: true,
		locked: false,
		mod: {
			targetInRange(card, player, target) {
				if (!player.isTurnedOver()) {
					return;
				}
				if (!card.cards) {
					return;
				}
				for (var i of card.cards) {
					if (i.hasGaintag("reluoying")) {
						return true;
					}
				}
			},
		},
		init(player) {
			player.addSkill("oljiushi_gain");
		},
		onremove(player) {
			player.removeSkill("oljiushi_gain");
		},
		group: ["oljiushi_use", "oljiushi_damage"],
		subSkill: {
			gain: {
				audio: "oljiushi",
				trigger: {
					player: ["gainAfter", "phaseEnd"],
				},
				onremove: true,
				filter(event, player) {
					if (event.name == "phase") {
						return true;
					}
					return event.getParent().name.indexOf("reluoying") != -1;
				},
				charlotte: true,
				async cost(event, trigger, player) {
					event.result = { bool: false };
					if (trigger.name != "phase") {
						player.addGaintag(trigger.cards, "reluoying");
						let bool = player.isTurnedOver() && player != _status.currentPhase && player.hasSkill("oljiushi", null, false);
						player.markAuto("oljiushi_gain", trigger.cards);
						if (bool && player.getStorage("oljiushi_gain").length >= player.maxHp) {
							const result = await player.chooseBool("是否发动【酒诗】，将武将牌翻面？").forResult();
							event.result = result;
						}
					} else {
						player.unmarkAuto("oljiushi_gain", player.getStorage("oljiushi_gain"));
					}
				},
				async content(event, trigger, player) {
					await player.turnOver();
				},
			},
			use: {
				audio: "oljiushi",
				enable: "chooseToUse",
				hiddenCard(player, name) {
					if (name == "jiu") {
						return !player.isTurnedOver();
					}
					return false;
				},
				filter(event, player) {
					if (player.isTurnedOver()) {
						return false;
					}
					return event.filterCard({ name: "jiu", isCard: true }, player, event);
				},
				async content(event, trigger, player) {
					if (_status.event.getParent(2).type == "dying") {
						event.dying = player;
						event.type = "dying";
					}
					await player.turnOver();
					await player.useCard({ name: "jiu", isCard: true }, player);
				},
				ai: {
					save: true,
					skillTagFilter(player, tag, arg) {
						return !player.isTurnedOver() && _status.event?.dying == player;
					},
					order: 5,
					result: {
						player(player) {
							if (_status.event.parent.name == "phaseUse") {
								if (player.countCards("h", "jiu") > 0) {
									return 0;
								}
								if (player.getEquip("zhuge") && player.countCards("h", "sha") > 1) {
									return 0;
								}
								if (!player.countCards("h", "sha")) {
									return 0;
								}
								var targets = [];
								var target;
								var players = game.filterPlayer();
								for (var i = 0; i < players.length; i++) {
									if (get.attitude(player, players[i]) < 0) {
										if (player.canUse("sha", players[i], true, true)) {
											targets.push(players[i]);
										}
									}
								}
								if (targets.length) {
									target = targets[0];
								} else {
									return 0;
								}
								var num = get.effect(target, { name: "sha" }, player, player);
								for (var i = 1; i < targets.length; i++) {
									var num2 = get.effect(targets[i], { name: "sha" }, player, player);
									if (num2 > num) {
										target = targets[i];
										num = num2;
									}
								}
								if (num <= 0) {
									return 0;
								}
								var e2 = target.getEquip(2);
								if (e2) {
									if (e2.name == "tengjia") {
										if (
											!player.countCards("h", {
												name: "sha",
												nature: "fire",
											}) &&
											!player.getEquip("zhuque")
										) {
											return 0;
										}
									}
									if (e2.name == "renwang") {
										if (!player.countCards("h", { name: "sha", color: "red" })) {
											return 0;
										}
									}
									if (e2.name == "baiyin") {
										return 0;
									}
								}
								if (player.getEquip("guanshi") && player.countCards("he") > 2) {
									return 1;
								}
								return target.countCards("h") > 3 ? 0 : 1;
							}
							if (player == _status.event.dying || player.isTurnedOver()) {
								return 3;
							}
						},
					},
					effect: {
						target(card, player, target) {
							if (target.isTurnedOver()) {
								if (get.tag(card, "damage")) {
									if (player.hasSkillTag("jueqing", false, target)) {
										return [1, -2];
									}
									if (target.hp == 1) {
										return;
									}
									return [1, target.countCards("h") / 2];
								}
							}
						},
					},
				},
			},
			damage: {
				audio: "oljiushi",
				trigger: { player: "damageEnd" },
				check(event, player) {
					return player.isTurnedOver();
				},
				prompt: "是否发动【酒诗】，将武将牌翻面？",
				filter(event, player) {
					if (event.checkJiushi) {
						return true;
					}
					return false;
				},
				content() {
					player.turnOver();
				},
			},
		},
	},
	//谋袁术
	olsbjinming: {
		audio: 2,
		trigger: { player: "phaseBegin" },
		init(player, skill) {
			player.storage[skill] = [1, 2, 3, 4];
		},
		onremove: true,
		locked: true,
		filter(event, player) {
			return player.getStorage("olsbjinming").length;
		},
		async cost(event, trigger, player) {
			let choiceList = ["1.回复过1点体力", "2.弃置过两张牌", "3.使用过三种类型的牌", "4.造成过4点伤害"];
			for (let i = 0; i < choiceList.length; i++) {
				if (!player.getStorage("olsbjinming").includes(i + 1)) {
					choiceList[i] = `<span style="text-decoration: line-through;">${choiceList[i]}</span>`;
				}
			}
			const result = (event.result = await player
				.chooseButton([`###矜名：请选择一项###<div class='text center'>本回合结束时你摸X张牌，若未满足选择的条件，则删除此选项（X为你最后一次发动〖矜名〗选择的选项序号）</div>`, [choiceList.slice(0, 2), "tdnodes"], [choiceList.slice(2, 4), "tdnodes"]])
				.set(
					"filterButton",
					button => {
						const player = get.player();
						return player.getStorage("olsbjinming").includes(parseInt(button.link.slice(0, 1)));
					},
					true
				)
				.set("ai", button => parseInt(button.link.slice(0, 1)))
				.forResult());
			if (result?.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0],
				};
			}
		},
		async content(event, trigger, player) {
			const choice = event.cost_data;
			player.addSkill("olsbjinming_used");
			player.addTempSkill("olsbjinming_target");
			player.storage.olsbjinming_used = player.storage.olsbjinming_target = choice;
			player.markSkill("olsbjinming_used");
			player.markSkill("olsbjinming_target");
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeSkill("olsbjinming_target");
				},
				marktext: "玺",
				intro: {
					name: "玉玺",
					markcount(storage, player) {
						if (!storage) {
							return null;
						}
						return parseInt(storage.slice(0, 1));
					},
					content(storage, player) {
						if (!storage) {
							return "当前未发动过〖矜名〗";
						}
						return `最后一次发动〖矜名〗所选选项为${storage.slice(0, 1)}`;
					},
				},
			},
			target: {
				charlotte: true,
				onremove: true,
				audio: "olsbjinming",
				trigger: { player: "phaseEnd" },
				forced: true,
				async content(event, trigger, player) {
					const choice = player.storage[event.name],
						num = parseInt(choice.slice(0, 1));
					await player.draw(num);
					if (lib.skill.olsbjinming_target.checkTarget(player, num)) {
						player.popup("成功", "wood");
						return;
					}
					player.popup("失败", "fire");
					player.storage.olsbjinming?.remove(num);
					game.log(player, "删除了", "#g【矜名】", "的选项", `#y${choice.slice(2)}`);
				},
				intro: {
					markcount: () => null,
					content(storage) {
						if (!storage) {
							return "本回合没有〖矜名〗目标";
						}
						return `本回合需要${storage.slice(2)}`;
					},
				},
				checkTarget(player, key) {
					let num = 0;
					switch (key) {
						case 1: {
							game.getGlobalHistory("everything", evt => {
								if (evt.name == "recover" && evt.player == player && evt.num > 0) {
									num += evt.num;
								}
							});
							break;
						}
						case 2: {
							player.getHistory("lose", evt => {
								if (evt.type == "discard" && evt.cards2?.length) {
									num += evt.cards2.length;
								}
							});
							break;
						}
						case 3: {
							let types = [];
							player.getHistory("useCard", evt => {
								let type = get.type2(evt.card);
								if (!types.includes(type)) {
									types.add(type);
								}
							});
							num = types.length;
							break;
						}
						case 4: {
							player.getHistory("sourceDamage", evt => {
								if (evt.num > 0) {
									num += evt.num;
								}
							});
							break;
						}
					}
					return num >= key;
				},
			},
		},
	},
};
