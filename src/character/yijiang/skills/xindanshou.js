import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xindanshou" | "xinbenxi">} */
export const groupSkills = {
	xindanshou: {
		audio: 2,
		trigger: {
			global: "phaseJieshuBegin",
			target: "useCardToTargeted",
		},
		filter(event, player) {
			return ((event.name == "phaseJieshu" && event.player != player && player.countCards("he") >= event.player.countCards("h")) || (event.targets?.includes(player) && ["basic", "trick"].includes(get.type2(event.card)))) && !player.hasHistory("gain", evt => evt.getParent().name == "draw" && evt.getParent(2).name == "xindanshou");
		},
		async cost(event, trigger, player) {
			const skillName = event.name.slice(0, -5);
			if (trigger.name == "phaseJieshu") {
				let next;
				const { player: target } = trigger;
				const num = target.countCards("h");
				if (num > 0) {
					next = player.chooseToDiscard(get.prompt(skillName, target), num, `弃置${get.cnNumber(num)}张牌并对${get.translation(target)}造成1点伤害`, "he").set("ai", card => {
						const player = get.player();
						if (get.damageEffect(_status.event.getTrigger().player, player, player) > 0) {
							return 6 - get.value(card);
						}
						return -1;
					});
				} else {
					next = player.chooseBool(get.prompt(skillName, target), `对${get.translation(target)}造成1点伤害`).set("choice", get.damageEffect(target, player, player) > 0);
				}
				event.result = await next.forResult();
				event.result.targets = [target];
			} else {
				let num = 0;
				game.countPlayer2(current => {
					num += current.getHistory("useCard").filter(evt => ["basic", "trick"].includes(get.type2(evt.card)) && evt.targets?.includes(player)).length;
				});
				const { bool } = await player
					.chooseBool(`${get.prompt(skillName)}（可摸${get.cnNumber(num)}张牌）`, get.translation(`${skillName}_info`))
					.set("ai", () => {
						return _status.event.choice;
					})
					.set(
						"choice",
						(function () {
							if (player.isPhaseUsing()) {
								if (
									player.countCards("h", function (card) {
										return ["basic", "trick"].includes(get.type(card, "trick")) && player.canUse(card, player, null, true) && get.effect(player, card, player) > 0 && player.getUseValue(card, null, true) > 0;
									})
								) {
									return false;
								}
								return true;
							}
							if (num > 2) {
								return true;
							}
							var card = trigger.card;
							if (get.tag(card, "damage") && player.hp <= trigger.getParent().baseDamage && (!get.tag(card, "respondShan") || !player.hasShan("all")) && (!get.tag(card, "respondSha") || !player.hasSha())) {
								return true;
							}
							var source = _status.currentPhase;
							if (source?.isIn()) {
								var todis = source.countCards("h") - source.needsToDiscard();
								if (
									todis <=
										Math.max(
											Math.min(
												2 + (source.hp <= 1 ? 1 : 0),
												player.countCards("he", function (card) {
													return get.value(card, player) < Math.max(5.5, 8 - todis);
												})
											),
											player.countCards("he", function (card) {
												return get.value(card, player) <= 0;
											})
										) &&
									get.damageEffect(source, player, player) > 0
								) {
									return false;
								}
								if (!source.isPhaseUsing() || get.attitude(player, source) > 0) {
									return true;
								}
								if (card.name == "sha" && !source.getCardUsable("sha")) {
									return true;
								}
							}
							return Math.random() < num / 3;
						})()
					)
					.forResult();
				event.result = {
					bool: bool,
					cost_data: num,
				};
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "phaseJieshu") {
				await trigger.player.damage("nocard");
			} else {
				player.addTempSkill(event.name + "_used");
				await player.draw(event.cost_data);
			}
		},
		subSkill: { used: { charlotte: true } },
		ai: {
			threaten: 0.6,
			effect: {
				target_use(card, player, target, current) {
					if (typeof card != "object" || target.hasSkill("xindanshou_used") || !["basic", "trick"].includes(get.type(card, "trick"))) {
						return;
					}
					var num = 0;
					game.countPlayer2(function (current) {
						var history = current.getHistory("useCard");
						for (var j = 0; j < history.length; j++) {
							if (["basic", "trick"].includes(get.type(history[j].card, "trick")) && history[j].targets && history[j].targets.includes(player)) {
								num++;
							}
						}
					});
					if (player == target && current > 0) {
						return [1.1, num];
					}
					return [0.9, num];
				},
			},
		},
	},
	xinbenxi: {
		group: ["xinbenxi_summer", "xinbenxi_damage"],
		audio: 2,
		trigger: {
			player: "useCard2",
		},
		forced: true,
		mod: {
			globalFrom(from, to, distance) {
				if (_status.currentPhase == from) {
					return distance - from.storage.xinbenxi;
				}
			},
			wuxieRespondable(card, player, target, current) {
				if (player != current && player.storage.xinbenxi_directHit.includes(card)) {
					return false;
				}
			},
		},
		init(player) {
			player.storage.xinbenxi_directHit = [];
			player.storage.xinbenxi_damage = [];
			player.storage.xinbenxi_unequip = [];
			player.storage.xinbenxi = 0;
		},
		filter(trigger, player) {
			return (
				_status.currentPhase == player &&
				trigger.targets &&
				trigger.targets.length == 1 &&
				(get.name(trigger.card) == "sha" || get.type(trigger.card) == "trick") &&
				!game.hasPlayer(function (current) {
					return get.distance(player, current) > 1;
				})
			);
		},
		filterx(event, player) {
			var info = get.info(event.card);
			if (info.allowMultiple == false) {
				return false;
			}
			if (event.targets && !info.multitarget) {
				if (
					game.hasPlayer(function (current) {
						return lib.filter.targetEnabled2(event.card, player, current) && !event.targets.includes(current);
					})
				) {
					return true;
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			const list = ["为XXX多选择一个目标", "　令XXX无视防具牌　", "　令XXX不可被抵消　", "当XXX造成伤害时摸牌"];
			const card = get.translation(trigger.card);
			for (const [i, item] of list.entries()) {
				// @ts-ignore
				list[i] = [i, item.replace(/XXX/g, card)];
			}
			const next = player.chooseButton({
				createDialog: ["奔袭：请选择一至两项", [list.slice(0, 2), "tdnodes"], [list.slice(2, 4), "tdnodes"]],
			});
			next.set("forced", true);
			next.set("selectButton", [1, 2]);
			next.set("filterButton", button => {
				if (button.link == 0) {
					return _status.event.bool1;
				}
				return true;
			});
			next.set("bool1", lib.skill.xinbenxi.filterx(trigger, player));
			next.set("ai", button => {
				const player = _status.event.player;
				const event = _status.event.getTrigger();
				switch (button.link) {
					case 0: {
						if (
							game.hasPlayer(current => {
								return lib.filter.targetEnabled2(event.card, player, current) && !event.targets.includes(current) && get.effect(current, event.card, player, player) > 0;
							})
						) {
							return 1.6 + Math.random();
						}
						return 0;
					}
					case 1: {
						if (
							event.targets.filter(current => {
								const eff1 = get.effect(current, event.card, player, player);
								player._xinbenxi_ai = true;
								const eff2 = get.effect(current, event.card, player, player);
								delete player._xinbenxi_ai;
								return eff1 > eff2;
							}).length
						) {
							return 1.9 + Math.random();
						}
						return Math.random();
					}
					case 2: {
						let num = 1.3;
						if (
							event.card.name == "sha" &&
							event.targets.filter(current => {
								if (current.mayHaveShan(player, "use") && get.attitude(player, current) <= 0) {
									if (current.hasSkillTag("useShan", null, "use")) {
										num = 1.9;
									}
									return true;
								}
								return false;
							}).length
						) {
							return num + Math.random();
						}
						return 0.5 + Math.random();
					}
					case 3: {
						return (get.tag(event.card, "damage") || 0) + Math.random();
					}
				}
			});
			const result = await next.forResult();
			if (!result?.bool || !result.links?.length) {
				return;
			}
			const map = [
				async (trigger, player, event) => {
					const result = await player
						.chooseTarget("请选择" + get.translation(trigger.card) + "的额外目标", true, (card, player, target) => {
							player = _status.event.player;
							if (_status.event.targets.includes(target)) {
								return false;
							}
							return lib.filter.targetEnabled2(_status.event.card, player, target);
						})
						.set("targets", trigger.targets)
						.set("card", trigger.card)
						.set("ai", target => {
							const trigger = _status.event.getTrigger();
							const player = _status.event.player;
							return get.effect(target, trigger.card, player, player);
						})
						.forResult();

					if (result.targets) {
						player.line(result.targets);
						trigger.targets.addArray(result.targets);
					}
				},
				(trigger, player, event) => {
					player.storage.xinbenxi_unequip.add(trigger.card);
				},
				(trigger, player, event) => {
					player.storage.xinbenxi_directHit.add(trigger.card);
					trigger.nowuxie = true;
					trigger.customArgs.default.directHit2 = true;
				},
				(trigger, player, event) => {
					player.storage.xinbenxi_damage.add(trigger.card);
				},
			];
			for (const link of result.links) {
				game.log(player, "选择了", "#g【奔袭】", "的", "#y选项" + get.cnNumber(link + 1, true));
				await map[link](trigger, player, event);
			}
		},
		ai: {
			unequip: true,
			unequip_ai: true,
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (tag == "unequip") {
					if (arg && player.storage.xinbenxi_unequip.includes(arg.card)) {
						return true;
					}
					return false;
				}
				if (
					_status.currentPhase != player ||
					game.hasPlayer(function (current) {
						return get.distance(player, current) > 1;
					})
				) {
					return false;
				}
				if (tag == "directHit_ai") {
					return arg.card.name == "sha";
				}
				if (!arg || !arg.card || (arg.card.name != "sha" && arg.card.name != "chuqibuyi")) {
					return false;
				}
				var card = arg.target.getEquip(2);
				if (card && card.name.indexOf("bagua") != -1) {
					return true;
				}
				if (player._xinbenxi_ai) {
					return false;
				}
			},
		},
		subSkill: {
			damage: {
				sub: true,
				trigger: { global: "damageBegin1" },
				audio: "xinbenxi",
				forced: true,
				filter(event, player) {
					return event.card && player.storage.xinbenxi_damage.includes(event.card);
				},
				async content(event, trigger, player) {
					await player.draw();
				},
			},
			summer: {
				sub: true,
				trigger: { player: ["phaseAfter", "useCardAfter", "useCard"] },
				silent: true,
				filter(event, player) {
					return player == _status.currentPhase;
				},
				async content(event, trigger, player) {
					if (trigger.name == "phase") {
						player.storage.xinbenxi = 0;
						return;
					} else if (event.triggername == "useCard") {
						player.logSkill("xinbenxi");
						player.storage.xinbenxi++;
						player.syncStorage("xinbenxi");
						return;
					} else {
						player.storage.xinbenxi_unequip.remove(event.card);
						player.storage.xinbenxi_directHit.remove(event.card);
						player.storage.xinbenxi_damage.remove(event.card);
					}
				},
			},
		},
	},
};
