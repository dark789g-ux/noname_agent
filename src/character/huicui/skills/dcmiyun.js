import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcmiyun" | "dcdanying" | "dcxunji" | "dcjiaofeng" | "liedan" | "zhuangdan">} */
export const groupSkills = {
	//周善
	dcmiyun: {
		audio: 2,
		trigger: { global: ["roundStart", "roundEnd"] },
		filter(event, player, name) {
			if (name === "roundStart") {
				return game.hasPlayer(current => current != player && current.countGainableCards(player, "he"));
			}
			return player.hasCard(card => card.hasGaintag("dcmiyun_tag"), "h") && game.hasPlayer(current => current != player);
		},
		forced: true,
		direct: true,
		group: "dcmiyun_lose",
		async content(event, trigger, player) {
			switch (event.triggername) {
				case "roundStart": {
					const result = await player
						.chooseTarget("密运：获得一名其他角色的一张牌，称为“安”", true, (card, player, target) => {
							return target != player && target.countGainableCards(player, "he");
						})
						.set("ai", target => {
							return get.effect(target, { name: "shunshou_copy2" }, _status.event.player, _status.event.player);
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						const target = result.targets[0];
						player.logSkill("dcmiyun", target);
						const next = player.gainPlayerCard(target, true, "visibleMove");
						next.gaintag.add("dcmiyun_tag");
						await next;
					}
					break;
				}
				case "roundEnd": {
					const result2 = await player
						.chooseCardTarget({
							prompt: "密运：将包括“安”在内的任意张手牌交给一名其他角色",
							forced: true,
							filterTarget: lib.filter.notMe,
							selectCard: [1, Infinity],
							filterOk() {
								for (var card of ui.selected.cards) {
									if (card.hasGaintag("dcmiyun_tag")) {
										return true;
									}
								}
								return false;
							},
							goon: game.hasPlayer(current => player != current && get.attitude(player, current) > 0),
							allowChooseAll: true,
							ai1(card) {
								if (get.itemtype(card) != "card") {
									return 0;
								}
								if (card.hasGaintag("dcmiyun_tag")) {
									return 100;
								}
								if (_status.event.goon) {
									return 8 - get.value(card);
								}
								return -get.value(card);
							},
							ai2(target) {
								return get.attitude(_status.event.player, target);
							},
						})
						.forResult();
					if (result2?.bool && result2.cards?.length && result2.targets?.length) {
						const {
							targets: [target],
							cards,
						} = result2;
						player.logSkill("dcmiyun", target);
						await player.give(cards, target);
						await player.drawTo(player.maxHp);
					}
					break;
				}
			}
		},
		mod: {
			aiValue(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("dcmiyun_tag")) {
					return Math.abs(num) * 10;
				}
			},
			aiUseful() {
				return lib.skill.dcmiyun.mod.aiValue.apply(this, arguments);
			},
			aiOrder(player, card, num) {
				if (get.itemtype(card) == "card" && card.hasGaintag("dcmiyun_tag")) {
					return 0;
				}
			},
		},
		subSkill: {
			lose: {
				audio: "dcmiyun",
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				forced: true,
				filter(event, player) {
					if (event.getParent().name == "dcmiyun") {
						return false;
					}
					var evt = event.getl(player);
					if (!evt || !evt.cards2 || !evt.cards2.length) {
						return false;
					}
					if (event.name == "lose") {
						for (var i in event.gaintag_map) {
							if (event.gaintag_map[i].includes("dcmiyun_tag")) {
								return true;
							}
						}
						return false;
					}
					return player.hasHistory("lose", evt => {
						if (event != evt.getParent()) {
							return false;
						}
						for (var i in evt.gaintag_map) {
							if (evt.gaintag_map[i].includes("dcmiyun_tag")) {
								return true;
							}
						}
						return false;
					});
				},
				async content(event, trigger, player) {
					player.loseHp();
				},
			},
		},
	},
	dcdanying: {
		audio: 2,
		mod: {
			aiOrder(player, card, num) {
				if (num <= 0 || (card.name !== "sha" && card.name !== "shan") || !player.hasCard(i => i.hasGaintag("dcmiyun_tag"), "h")) {
					return;
				}
				return Math.max(0.12, num / 25);
			},
		},
		locked: false,
		enable: ["chooseToUse", "chooseToRespond"],
		usable: 1,
		hiddenCard(player, name) {
			if (!_status.connectMode && !player.hasCard(card => card.hasGaintag("dcmiyun_tag"), "h")) {
				return false;
			}
			return name == "sha" || name == "shan";
		},
		filter(event, player) {
			if (event.type == "wuxie" || !player.hasCard(card => card.hasGaintag("dcmiyun_tag"), "h")) {
				return false;
			}
			for (var name of ["sha", "shan"]) {
				if (event.filterCard({ name: name, isCard: true }, player, event)) {
					return true;
				}
			}
			return false;
		},
		chooseButton: {
			dialog(event, player) {
				var vcards = [];
				for (var name of ["sha", "shan"]) {
					var card = { name: name, isCard: true };
					if (event.filterCard(card, player, event)) {
						vcards.push(["基本", "", name]);
					}
				}
				var dialog = ui.create.dialog("胆迎", [vcards, "vcard"], "hidden");
				dialog.direct = true;
				return dialog;
			},
			backup(links, player) {
				return {
					filterCard: () => false,
					selectCard: -1,
					viewAs: {
						name: links[0][2],
						isCard: true,
					},
					popname: true,
					async precontent(event, trigger, player) {
						player.logSkill("dcdanying");
						player.showCards(
							player.getCards("h", card => card.hasGaintag("dcmiyun_tag")),
							get.translation(player) + "的“安”"
						);
						player.addTempSkill("dcdanying_discard");
					},
				};
			},
			prompt(links, player) {
				return "展示“安”，然后视为使用【" + get.translation(links[0][2]) + "】";
			},
		},
		ai: {
			order(item, player) {
				var o1 = get.order({ name: "sha" }),
					o2 = get.order({ name: "shan" });
				if (player.countCards("h") > 3 || player == _status.currentPhase) {
					return Math.max(o1, o2) + 0.1;
				}
				return Math.min(o1, o2) - 0.1;
			},
			combo: "dcmiyun",
			respondSha: true,
			respondShan: true,
			skillTagFilter(player, tag, arg) {
				if (!player.hasCard(card => card.hasGaintag("dcmiyun_tag"), "h")) {
					return false;
				}
			},
			result: {
				player: 1,
			},
		},
		subSkill: {
			discard: {
				audio: "dcdanying",
				trigger: { target: "useCardToTargeted" },
				charlotte: true,
				forced: true,
				filter(event, player) {
					return player.countDiscardableCards(event.player, "he");
				},
				async content(event, trigger, player) {
					trigger.player.discardPlayerCard(player, "he", true);
					player.removeSkill("dcdanying_discard");
				},
				ai: {
					effect: {
						target_use(card, player, target) {
							if (_status._dcdanying_aiChecking) {
								return;
							}
							_status._dcdanying_aiChecking = true;
							let eff = get.effect(target, { name: "guohe_copy2" }, player, player);
							delete _status._dcdanying_aiChecking;
							return [1, get.sgn(eff)];
						},
					},
				},
			},
		},
	},
	//蔡阳
	dcxunji: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target != player && !player.getStorage("dcxunji_effect").includes(target);
		},
		async content(event, trigger, player) {
			const { target } = event;
			player.markAuto("dcxunji_effect", [target]);
			player.addTempSkill("dcxunji_effect", { player: "die" });
			target.addTempSkill("dcxunji_mark", { player: "phaseEnd" });
		},
		ai: {
			order: 1,
			result: {
				player(player, target) {
					if (player.hp < 2) {
						return 0;
					}
					return get.effect(target, { name: "juedou" }, player, player);
				},
			},
		},
		subSkill: {
			mark: {
				mark: true,
				marktext: "嫉",
				intro: { content: "你已经被盯上了！" },
			},
			effect: {
				audio: "dcxunji",
				charlotte: true,
				trigger: { global: "phaseJieshuBegin" },
				forced: true,
				popup: false,
				onremove: true,
				filter(event, player) {
					return player.getStorage("dcxunji_effect").includes(event.player);
				},
				async content(event, trigger, player) {
					const target = trigger.player;
					if (target.getHistory("useCard", evt => get.color(evt.card) == "black").length > 0 && player.canUse("juedou", target)) {
						await player.useCard({ name: "juedou", isCard: true }, target, event.name);
					}
					player.unmarkAuto(event.name, [target]);
					if (!player.getStorage(event.name).length) {
						player.removeSkill(event.name);
					}
				},
				group: "dcxunji_loseHp",
			},
			loseHp: {
				trigger: { source: "damageSource" },
				forced: true,
				popup: false,
				filter(event, player) {
					return event.card && event.card.name == "juedou" && event.getParent().skill == "dcxunji_effect" && event.player.isIn();
				},
				async content(event, trigger, player) {
					trigger.player.line(player);
					player.damage(trigger.num, trigger.player);
				},
			},
		},
	},
	dcjiaofeng: {
		audio: 2,
		trigger: { source: "damageBegin1" },
		forced: true,
		usable: 1,
		filter(event, player) {
			return player.isDamaged() && !player.getHistory("sourceDamage").length;
		},
		async content(event, trigger, player) {
			var num = player.getDamagedHp();
			if (num > 0) {
				player.draw();
			}
			if (num > 1) {
				trigger.num++;
			}
			if (num > 2) {
				player.recover();
			}
		},
	},
	//夏侯杰
	liedan: {
		audio: 2,
		trigger: { global: "phaseZhunbeiBegin" },
		forced: true,
		filter(event, player) {
			return player != event.player || player.countMark("liedan") > 4;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			if (player == trigger.player) {
				player.die();
				return;
			}
			var num = 0;
			if (player.hp > trigger.player.hp) {
				num++;
			}
			if (player.countCards("h") > trigger.player.countCards("h")) {
				num++;
			}
			if (player.countCards("e") > trigger.player.countCards("e")) {
				num++;
			}
			if (num) {
				player.draw(num);
				if (num == 3 && player.maxHp < 8) {
					player.gainMaxHp();
				}
			} else {
				player.addMark("liedan", 1);
				player.loseHp();
			}
		},
		intro: { content: "mark" },
		ai: {
			halfneg: true,
		},
	},
	zhuangdan: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		forced: true,
		filter(event, player) {
			return player != event.player && player.isMaxHandcard(true);
		},
		async content(event, trigger, player) {
			player.addTempSkill("zhuangdan_mark", { player: "phaseEnd" });
			player.tempBanSkill("liedan", { player: "phaseEnd" });
		},
		ai: { combo: "liedan" },
		subSkill: {
			mark: {
				charlotte: true,
				mark: true,
				marktext: "胆",
				intro: { content: "我超勇的" },
			},
		},
	},
};
