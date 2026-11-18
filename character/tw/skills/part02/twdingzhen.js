import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twdingzhen" | "twyouye" | "twweipo" | "twmouzhi">} */
export const groupSkills = {
	//张既
	twdingzhen: {
		audio: 2,
		trigger: { global: "roundStart" },
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return get.distance(player, current) <= player.getHp();
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					selectTarget: [1, Infinity],
					filterTarget(card, player, target) {
						return get.distance(player, target) <= player.getHp();
					},
					ai(target) {
						const player = get.player();
						if (target == player) {
							return 0;
						}
						return Math.max(-get.attitude(player, target), 1);
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			await game.doAsyncInOrder(targets, async target => {
				const result = await target
					.chooseToDiscard({
						position: "h",
						filterCard(card, player) {
							return get.name(card) == "sha";
						},
						prompt: "定镇：弃置一张【杀】，或本轮你于回合内使用的第一张牌不能指定" + get.translation(player) + "为目标",
						ai(card) {
							if (_status.event.goon) {
								return 1;
							}
							return 0;
						},
					})
					.set(
						"goon",
						get.attitude(target, player) < 0 &&
							player.countCards("hs") <= 3 &&
							target.countCards("hs", card => {
								return target.hasValueTarget(card);
							}) > 1
					)
					.forResult();
				if (result.bool) {
					target.addExpose(0.1);
				} else {
					target.addSkill(`${event.name}_target`);
					target.markAuto(`${event.name}_target`, [player]);
				}
			});
		},
		subSkill: {
			target: {
				charlotte: true,
				onremove: true,
				mark: true,
				silent: true,
				trigger: { global: "roundStart" },
				firstDo: true,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
				},
				intro: {
					markcount: () => 0,
					content: "回合内使用的第一张牌不能指定$为目标",
				},
				mod: {
					playerEnabled(card, player, target) {
						if (_status.currentPhase == player && !player.countUsed() && player.getStorage("twdingzhen_target").includes(target)) {
							return false;
						}
					},
				},
			},
		},
	},
	twyouye: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player != player && !event.player.hasHistory("sourceDamage", evt => evt.player == player) && player.getExpansions("twyouye").length < 5;
		},
		forced: true,
		group: "twyouye_give",
		async content(event, trigger, player) {
			await player.addToExpansion({
				cards: get.cards(1, true),
				animate: "gain2",
				gaintag: [event.name],
			});
		},
		marktext: "蓄",
		intro: {
			name: "蓄(攸业)",
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		subSkill: {
			give: {
				audio: "twyouye",
				trigger: { source: "damageSource", player: "damageEnd" },
				filter(event, player) {
					return player.getExpansions("twyouye").length;
				},
				forced: true,
				async content(event, trigger, player) {
					let boolx = _status.currentPhase?.isIn();
					const cards = player.getExpansions("twyouye");
					if (_status.connectMode) {
						game.broadcastAll(function () {
							_status.noclearcountdown = true;
						});
					}
					const given_map = new Map();
					while (cards.length > 0) {
						const result =
							cards.length > 1
								? await player
										.chooseButtonTarget({
											createDialog: [`攸业：请选择要分配的牌${boolx ? `（至少分给${get.translation(_status.currentPhase)}一张）` : ""}`, cards],
											selectButton: [1, Infinity],
											forced: true,
											filterTarget(card, player, target) {
												if (!get.event().boolx) {
													return true;
												}
												return target == _status.currentPhase;
											},
											ai1(button) {
												if (!get.event().boolx) {
													return get.value(button.link);
												}
												const att = get.attitude(get.player(), _status.currentPhase);
												if (att <= 0) {
													if (ui.selected.buttons.length) {
														return 0;
													}
													return -get.value(button.link);
												}
												return get.value(button.link);
											},
											canHidden: true,
											ai2(target) {
												const { player, boolx } = get.event();
												if (!boolx) {
													return 1;
												}
												const card = ui.selected.buttons[0].link;
												if (card) {
													return get.value(card, target) * get.attitude(player, target);
												}
												return 1;
											},
										})
										.set("allowChooseAll", true)
										.set("boolx", boolx)
										.forResult()
								: await player
										.chooseTarget(
											`攸业：令一名角色获得${get.translation(cards)}`,
											(card, player, target) => {
												if (!get.event().boolx) {
													return true;
												}
												return target == _status.currentPhase;
											},
											true
										)
										.set("ai", target => {
											const { player, enemy } = get.event();
											const att = get.attitude(player, target);
											if (enemy) {
												return -att;
											} else if (att > 0) {
												return att / (1 + target.countCards("h"));
											} else {
												return att / 100;
											}
										})
										.set("enemy", get.value(cards[0], player, "raw") < 0)
										.forResult();
						if (result?.bool) {
							let links;
							if (!result.links?.length) {
								links = cards.slice();
							} else {
								links = result.links;
							}
							cards.removeArray(links);
							const [target] = result.targets;
							if (target == _status.currentPhase) {
								boolx = false;
							}
							if (!given_map.has(target)) {
								given_map.set(target, links);
							} else {
								given_map.get(target).addArray(links);
							}
						} else {
							break;
						}
					}
					if (_status.connectMode) {
						game.broadcastAll(() => {
							delete _status.noclearcountdown;
							game.stopCountChoose();
						});
					}
					if (given_map.size) {
						await game
							.loseAsync({
								gain_list: Array.from(given_map),
								player,
								cards: Object.values(given_map).slice().flat(),
								giver: player,
								animate: "gain2",
							})
							.setContent("gaincardMultiple");
					}
				},
			},
		},
	},
	//荀谌
	twweipo: {
		audio: "mjweipo",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current.countCards("he");
			});
		},
		filterTarget(card, player, target) {
			return target.countCards("he");
		},
		content() {
			"step 0";
			target.chooseToDiscard("he", true);
			"step 1";
			var list = ["binglinchengxiax"];
			list.addArray(get.zhinangs());
			player.chooseButton(["危迫：令其获得一张智囊牌或【兵临城下】", [list, "vcard"]], true).set("ai", function (button) {
				return _status.event.getParent().target.getUseValue({ name: button.link[2] });
			});
			"step 2";
			if (result.bool) {
				var name = result.links[0][2],
					card = false;
				game.log(player, "选择了", "#y" + get.translation(name));
				if (name == "binglinchengxiax") {
					if (!_status.binglinchengxiax) {
						_status.binglinchengxiax = [
							["spade", 7],
							["club", 7],
							["club", 13],
						];
						game.broadcastAll(function () {
							lib.inpile.add("binglinchengxiax");
						});
					}
					if (_status.binglinchengxiax.length) {
						var info = _status.binglinchengxiax.randomRemove();
						card = game.createCard2("binglinchengxiax", info[0], info[1]);
					}
				}
				if (!card) {
					card = get.cardPile(name);
				}
				if (card) {
					target.gain(card, "gain2");
				}
			}
		},
		ai: {
			order: 7.1,
			result: {
				target(player, target) {
					if (target == player) {
						return player.countCards("he") ? 10 : 0.01;
					}
					return (target.countCards("he") + 0.5) * Math.sqrt(Math.max(1, target.hp));
				},
			},
		},
	},
	twmouzhi: {
		audio: "mjmouzhi",
		intro: { content: "上次受到伤害的颜色：$" },
		trigger: { player: "damageBegin4" },
		forced: true,
		group: "twmouzhi_mark",
		filter(event, player) {
			if (!event.card || get.color(event.card) == "none") {
				return false;
			}
			var all = player.getAllHistory("damage");
			if (!all.length) {
				return false;
			}
			return all[all.length - 1].card && get.color(all[all.length - 1].card) == get.color(event.card);
		},
		content() {
			trigger.cancel();
		},
		ai: {
			effect: {
				target: (card, player, target) => {
					if (typeof card === "object" && get.tag(card, "damage")) {
						let color = get.color(card);
						if (color === "none") {
							return;
						}
						let all = target.getAllHistory("damage");
						if (!all.length || !all[all.length - 1].card) {
							return;
						}
						if (get.color(all[all.length - 1].card) === color) {
							return "zeroplayertarget";
						}
					}
				},
			},
		},
		subSkill: {
			mark: {
				trigger: { player: "damage" },
				silent: true,
				firstDo: true,
				content() {
					if (!trigger.card || get.color(trigger.card) == "none") {
						player.unmarkSkill("twmouzhi");
					} else {
						player.markSkill("twmouzhi");
						player.storage.twmouzhi = get.color(trigger.card);
						game.broadcastAll(
							function (player, color) {
								if (player.marks.twmouzhi) {
									player.marks.twmouzhi.firstChild.innerHTML = "<font color=" + color + ">谋</font>";
								}
								player.storage.twmouzhi = color;
							},
							player,
							player.storage.twmouzhi
						);
					}
				},
			},
		},
	},
};
