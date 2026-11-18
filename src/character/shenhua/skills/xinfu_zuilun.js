import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinfu_zuilun" | "xinfu_fuyin" | "drlt_qianjie" | "drlt_jueyan" | "rejizhi_lukang" | "drlt_jueyan1" | "drlt_jueyan2" | "drlt_jueyan3" | "drlt_poshi" | "drlt_huairou">} */
export const groupSkills = {
	xinfu_zuilun: {
		audio: 2,
		trigger: {
			player: "phaseJieshuBegin",
		},
		check(event, player) {
			let num = 0;
			if (
				player.hasHistory("lose", function (evt) {
					return evt.type == "discard";
				})
			) {
				num++;
			}
			if (!player.isMinHandcard()) {
				num++;
			}
			if (!player.getStat("damage")) {
				num++;
			}
			if (num == 3) {
				return player.hp >= 2;
			}
			return true;
		},
		prompt(event, player) {
			let num = 3;
			if (
				player.hasHistory("lose", function (evt) {
					return evt.type == "discard";
				})
			) {
				num--;
			}
			if (!player.isMinHandcard()) {
				num--;
			}
			if (!player.getStat("damage")) {
				num--;
			}
			return get.prompt("xinfu_zuilun") + "（可获得" + get.cnNumber(num) + "张牌）";
		},
		async content(event, trigger, player) {
			let num = 0;
			const cards = get.cards(3);
			await game.cardsGotoOrdering(cards);
			if (
				player.hasHistory("lose", function (evt) {
					return evt.type == "discard";
				})
			) {
				num++;
			}
			if (!player.isMinHandcard()) {
				num++;
			}
			if (!player.getStat("damage")) {
				num++;
			}
			if (num == 0) {
				await player.gain(cards, "draw");
				return;
			}
			let prompt = "罪论：将" + get.cnNumber(num) + "张牌置于牌堆顶";
			if (num < 3) {
				prompt += "并获得其余的牌";
			}
			const chooseToMove = player.chooseToMove(prompt, true);
			if (num < 3) {
				chooseToMove.set("list", [["牌堆顶", cards], ["获得"]]);
				chooseToMove.set("filterMove", function (from, to, moved) {
					if (to == 1 && moved[0].length <= _status.event.num) {
						return false;
					}
					return true;
				});
				chooseToMove.set("filterOk", function (moved) {
					return moved[0].length == _status.event.num;
				});
			} else {
				chooseToMove.set("list", [["牌堆顶", cards]]);
			}
			chooseToMove.set("num", num);
			chooseToMove.set("processAI", function (list) {
				const check = function (card) {
					const player = _status.event.player;
					const next = player.next;
					const att = get.attitude(player, next);
					const judge = next.getCards("j")[tops.length];
					if (judge) {
						return get.judge(judge)(card) * att;
					}
					return next.getUseValue(card) * att;
				};
				const cards = list[0][1].slice(0),
					tops = [];
				while (tops.length < _status.event.num) {
					list.sort(function (a, b) {
						return check(b) - check(a);
					});
					tops.push(cards.shift());
				}
				return [tops, cards];
			});
			let result = await chooseToMove.forResult();
			if (result.bool) {
				const list = result.moved[0];
				cards.removeArray(list);
				await game.cardsGotoPile(list.reverse(), "insert");
			}
			game.updateRoundNumber();
			if (cards.length) {
				await player.gain(cards, "draw");
				return;
			}
			const chooseTarget = player.chooseTarget("请选择一名角色，与其一同失去1点体力", true, function (card, player, target) {
				return target != player;
			});
			chooseTarget.ai = function (target) {
				return -get.attitude(_status.event.player, target);
			};
			result = await chooseTarget.forResult();
			player.line(result.targets[0], "fire");
			await player.loseHp();
			await result.targets[0].loseHp();
		},
	},
	xinfu_fuyin: {
		trigger: {
			target: "useCardToTargeted",
		},
		forced: true,
		audio: 2,
		filter(event, player) {
			if (event.player.countCards("h") < player.countCards("h")) {
				return false;
			}
			if (event.card.name != "sha" && event.card.name != "juedou") {
				return false;
			}
			return !game.hasPlayer2(function (current) {
				return (
					current.getHistory("useCard", function (evt) {
						return evt != event.getParent() && evt.card && ["sha", "juedou"].includes(evt.card.name) && evt.targets.includes(player);
					}).length > 0
				);
			});
		},
		async content(event, trigger, player) {
			trigger.getParent().excluded.add(player);
		},
		ai: {
			effect: {
				target(card, player, target) {
					let hs = player.getCards("h", i => i !== card && (!card.cards || !card.cards.includes(i))),
						num = player.getCardUsable("sha");
					if ((card.name !== "sha" && card.name !== "juedou") || hs.length < target.countCards("h")) {
						return 1;
					}
					if (
						game.hasPlayer2(function (current) {
							return (
								current.getHistory("useCard", function (evt) {
									return evt.card && ["sha", "juedou"].includes(evt.card.name) && evt.targets.includes(player);
								}).length > 0
							);
						})
					) {
						return 1;
					}
					if (card.name === "sha") {
						num--;
					}
					hs = hs.filter(i => {
						if (!player.canUse(i, target)) {
							return false;
						}
						if (i.name === "juedou") {
							return true;
						}
						if (num && i.name === "sha") {
							num--;
							return true;
						}
						return false;
					});
					if (!hs.length) {
						return "zeroplayertarget";
					}
					num = 1 - 2 / 3 / hs.length;
					return [num, 0, num, 0];
				},
			},
		},
	},
	drlt_qianjie: {
		audio: 2,
		group: ["drlt_qianjie_1", "drlt_qianjie_2", "drlt_qianjie_3"],
		locked: true,
		ai: {
			effect: {
				target(card) {
					if (card.name == "tiesuo") {
						return "zeroplayertarget";
					}
				},
			},
		},
		subSkill: {
			1: {
				audio: "drlt_qianjie",
				trigger: {
					player: "linkBegin",
				},
				forced: true,
				filter(event, player) {
					return !player.isLinked();
				},
				async content(event, trigger, player) {
					trigger.cancel();
				},
				ai: {
					noLink: true,
				},
			},
			2: {
				mod: {
					targetEnabled(card, player, target) {
						if (get.type(card) == "delay") {
							return false;
						}
					},
				},
			},
			3: {
				ai: { noCompareTarget: true },
			},
		},
	},
	drlt_jueyan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hasEnabledSlot(1) || player.hasEnabledSlot(2) || player.hasEnabledSlot(5) || player.hasEnabledSlot("horse");
		},
		async content(event, trigger, player) {
			const { control } = await player
				.chooseToDisable(true)
				.set("ai", function (event, player, list) {
					if (list.includes("equip5") && !player.hasSkill("drlt_jueyan_effect")) {
						return "equip5";
					}
					if (list.includes("equip2")) {
						return "equip2";
					}
					if (
						list.includes("equip1") &&
						player.countCards("h", function (card) {
							return get.name(card, player) == "sha" && player.hasUseTarget(card);
						}) -
							player.getCardUsable("sha") >
							1
					) {
						return "equip1";
					}
					if (
						list.includes("equip5") &&
						player.countCards("h", function (card) {
							return get.type2(card, player) == "trick" && player.hasUseTarget(card);
						}) > 1
					) {
						return "equip5";
					}
				})
				.forResult();
			const bool = !player.hasSkill("drlt_jueyan_effect");
			switch (control) {
				case "equip1":
					player.addTempSkill("drlt_jueyan1");
					if (bool) {
						player.addSkill("drlt_jueyan_sha");
					}
					break;
				case "equip2":
					await player.draw(3);
					player[bool ? "addSkill" : "addTempSkill"]("drlt_jueyan3");
					break;
				case "equip3_4":
					player[bool ? "addSkill" : "addTempSkill"]("drlt_jueyan2");
					break;
				case "equip5":
					await player[bool ? "addSkills" : "addTempSkills"]("rejizhi");
					break;
			}
			if (bool) {
				player.addSkill("drlt_jueyan_effect");
			}
		},
		ai: {
			order: 13,
			result: {
				player(player) {
					if (player.hasEnabledSlot("equip2")) {
						return 1;
					}
					if (
						player.hasEnabledSlot("equip1") &&
						player.countCards("h", function (card) {
							return get.name(card, player) == "sha" && player.hasValueTarget(card);
						}) -
							player.getCardUsable("sha") >
							1
					) {
						return 1;
					}
					if (
						player.hasEnabledSlot("equip5") &&
						player.countCards("h", function (card) {
							return get.type2(card, player) == "trick" && player.hasUseTarget(card);
						}) > 1
					) {
						return 1;
					}
					return -1;
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
			},
			sha: {
				mod: {
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + 1;
						}
					},
				},
				mark: true,
				marktext: "决",
				charlotte: true,
				locked: false,
				intro: { name: "决堰 - 武器", content: "本局游戏可以多使用一张【杀】" },
			},
		},
		derivation: ["drlt_jueyan_rewrite", "rejizhi"],
	},
	rejizhi_lukang: { audio: 1 },
	drlt_jueyan1: {
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + 3;
				}
			},
		},
		mark: true,
		marktext: "决",
		charlotte: true,
		locked: false,
		intro: { name: "决堰 - 武器", content: "本回合内可以多使用三张【杀】" },
	},
	drlt_jueyan2: {
		mod: {
			targetInRange(card, player, target, now) {
				return true;
			},
		},
		mark: true,
		marktext: "决",
		charlotte: true,
		locked: false,
		intro: { name: "决堰 - 坐骑", content: "使用牌没有距离限制" },
	},
	drlt_jueyan3: {
		mod: {
			maxHandcard(player, num) {
				return num + 3;
			},
		},
		mark: true,
		marktext: "决",
		charlotte: true,
		locked: false,
		intro: { name: "决堰 - 防具", content: "手牌上限+3" },
	},
	drlt_poshi: {
		audio: 2,
		skillAnimation: true,
		animationColor: "wood",
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		derivation: ["drlt_huairou"],
		filter(event, player) {
			return !player.hasEnabledSlot() || player.hp == 1;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.loseMaxHp();
			const num = player.maxHp - player.countCards("h");
			if (num > 0) {
				await player.draw(num);
			}
			await player.changeSkills(["drlt_huairou"], ["drlt_jueyan"]);
		},
	},
	drlt_huairou: {
		audio: 2,
		enable: "phaseUse",
		position: "he",
		filter: (event, player) => player.hasCard(card => lib.skill.drlt_huairou.filterCard(card, player), lib.skill.drlt_huairou.position),
		filterCard: (card, player) => get.type(card) == "equip" && player.canRecast(card),
		check(card) {
			if (get.position(card) == "e") {
				return 0.5 - get.value(card, get.player());
			}
			if (!get.player().canEquip(card)) {
				return 5;
			}
			return 3 - get.value(card);
		},
		async content(event, trigger, player) {
			await player.recast(event.cards);
		},
		discard: false,
		lose: false,
		delay: false,
		prompt: "重铸一张装备牌",
		ai: {
			order: 10,
			result: {
				player: 1,
			},
		},
	},
};
