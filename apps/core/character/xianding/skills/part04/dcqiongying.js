import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcqiongying" | "dcnuanhui" | "dcmiyi" | "dcyinjun">} */
export const groupSkills = {
	//诸葛若雪
	dcqiongying: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		direct: true,
		filter(event, player) {
			return player.canMoveCard();
		},
		async content(event, trigger, player) {
			event.pushHandler("onNextMoveCard", (event, option) => {
				if (_status.connectMode && event.step == 1 && event._result.bool && option.state == "end") {
					game.broadcastAll(() => {
						delete _status.noclearcountdown;
						game.stopCountChoose();
					});
				}
			});
			let result = await player
				.moveCard(false, `###琼英###移动场上的一张牌，然后弃置一张与此牌花色相同的手牌（若没有则展示手牌）。`)
				.set("logSkill", "dcqiongying")
				.set("custom", {
					add: {},
					replace: {
						window: () => {
							if (get.event().name == "chooseTarget") {
								ui.click.cancel();
							}
						},
					},
				})
				.forResult();
			if (result.bool) {
				const card = result.card,
					suit = get.suit(card);
				if (!player.hasCard({ suit: suit })) {
					player.showHandcards();
				} else {
					player.chooseToDiscard({ suit: suit }, true, `请弃置一张${get.translation(suit)}手牌`);
				}
			} else {
				player.getStat("skill").dcqiongying--;
			}
		},
		ai: {
			expose: 0.2,
			order(item, player) {
				if (player.countCards("h") <= 4) {
					return 0.5;
				}
				return 9;
			},
			result: {
				player(player) {
					if (player.canMoveCard(true)) {
						return 1;
					}
					return 0;
				},
			},
		},
	},
	dcnuanhui: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2("dcnuanhui"))
				.set("ai", target => {
					return get.event().aiTarget == target ? 10 : 0;
				})
				.set(
					"aiTarget",
					(() => {
						const player = get.player();
						const list = get.inpileVCardList(info => {
							return info[0] == "basic";
						});
						if (!list.length) {
							return null;
						}
						const getUseValue = target => {
							if (get.attitude(player, target) <= 0) {
								return -1;
							}
							const toUse = [];
							const hp = target.hp;
							let eff = 0,
								count = Math.max(1, target.countCards("e"));
							while (count--) {
								target.hp = Math.min(target.maxHp, target.hp + toUse.filter(card => card.name == "tao").length);
								const listx = list
									.map(info => {
										const card = new lib.element.VCard({
											name: info[2],
											nature: info[3],
											isCard: true,
										});
										return [card, target.getUseValue(card)];
									})
									.sort((a, b) => {
										return b[1] - a[1];
									});
								const mostValuablePair = listx[0].slice();
								if (mostValuablePair[1] <= 0) {
									mostValuablePair[1] = 0;
								}
								eff += mostValuablePair[1];
								toUse.push(mostValuablePair[0]);
								target.hp = hp;
							}
							if (toUse.length > 1 && eff > 0) {
								eff -= target
									.getCards("e", card => {
										return lib.filter.cardDiscardable(card, target, "dcnuanhui");
									})
									.map(card => {
										return get.value(card, target);
									})
									.reduce((p, c) => {
										return p + c;
									}, 0);
							}
							return eff;
						};
						const playerList = game
							.filterPlayer()
							.map(current => [current, getUseValue(current)])
							.sort((a, b) => b[1] - a[1]);
						if (playerList[0][1] <= 0) {
							return null;
						}
						return playerList[0][0];
					})()
				)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (!target.isUnderControl(true) && !target.isOnline()) {
				game.delayx();
			}
			const total = Math.max(1, target.countCards("e"));
			let count = 0,
				used = [],
				discard = false;
			while (count < total) {
				const basicList = get.inpileVCardList(info => {
					return info[0] == "basic" && target.hasUseTarget({ name: info[2], nature: info[3], isCard: true });
				});
				if (!basicList.length) {
					game.log("但是", target, "无牌可出！");
					break;
				}
				const result = await target
					.chooseButton(["暖惠：是否视为使用一张基本牌？", [basicList, "vcard"]])
					.set("ai", button => {
						return get.player().getUseValue({
							name: button.link[2],
							nature: button.link[3],
							isCard: true,
						});
					})
					.forResult();
				if (!result?.bool) {
					game.log("但是", target, "不愿出牌！");
					break;
				}
				const card = new lib.element.VCard({
					name: result.links[0][2],
					nature: result.links[0][3],
					isCard: true,
				});
				const result2 = await target.chooseUseTarget(card, true, false).forResult();
				if (!discard && result2?.bool) {
					if (used.includes(result.links[0][2])) {
						discard = true;
					} else {
						used.add(result.links[0][2]);
					}
				}
				count++;
			}
			if (discard) {
				await target.modedDiscard(target.getCards("e"));
			}
		},
		ai: {
			expose: 0.3,
			threaten: 3.7,
		},
	},
	//曹轶
	dcmiyi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		direct: true,
		async content(event, trigger, player) {
			if (_status.connectMode) {
				game.broadcastAll(() => {
					_status.noclearcountdown = true;
				});
			}
			let result = await player
				.chooseControl(["回复体力", "受到伤害"], "cancel2")
				.set("choiceList", ["令你即将选择的角色各回复1点体力", "令你即将选择的角色各受到你造成的1点伤害"])
				.set("prompt", get.prompt("dcmiyi"))
				.set("ai", () => {
					return get.event().choice;
				})
				.set(
					"choice",
					(() => {
						let damage = 0;
						game.countPlayer(current => {
							let eff = get.damageEffect(current, player, player);
							if (!current.isDamaged()) {
								if (eff > 0) {
									eff = -eff;
								}
							} else if (current.hasSkillTag("maixie")) {
								if (get.attitude(player, current) <= 0) {
									if (current.getHp(true) >= 2) {
										eff = 0;
									} else {
										eff /= 10;
									}
								} else if (current.getHp(true) >= 2) {
									eff += 30;
								}
							} else {
								eff /= 3;
							}
							damage += eff;
						});
						if (damage < -20) {
							return 0;
						}
						if (damage > 5) {
							return 1;
						}
						if (lib.skill.mbhuiyao.getUnrealDamageTargets(player, [[player], game.filterPlayer()])) {
							return 0;
						}
						return "cancel2";
					})()
				)
				.forResult();
			if (result.control == "cancel2") {
				if (_status.connectMode) {
					game.broadcastAll(() => {
						delete _status.noclearcountdown;
						game.stopCountChoose();
					});
				}
				return event.finish();
			}
			const func = ["recover", "damage"],
				index = result.index;
			const fn = func[index];
			result = await player
				.chooseTarget(`蜜饴：令任意名角色${result.control.slice(0, 2)}1点${result.control.slice(2)}`, [1, Infinity])
				.set("ai", target => {
					const toDamage = get.event().toDamage;
					let eff = get.damageEffect(target, player, player);
					if (toDamage) {
						if (target.hasSkillTag("maixie")) {
							if (get.attitude(player, target) <= 0) {
								if (target.getHp(true) >= 2) {
									eff = 0;
								} else {
									eff /= 10;
								}
							} else if (target.getHp(true) >= 2) {
								eff += 30;
							}
						}
						return eff;
					}
					if (!target.isDamaged()) {
						eff *= -2;
					}
					if (target.getHp(true) >= 2) {
						return -eff;
					}
					return 0;
				})
				.set("toDamage", result.index == 1)
				.forResult();
			if (_status.connectMode) {
				game.broadcastAll(() => {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}
			if (!result.bool) {
				return event.finish();
			}
			const targets = result.targets.slice().sortBySeat();
			player.logSkill("dcmiyi", targets, fn == "damage" ? "fire" : "green");
			while (targets.length) {
				const target = targets.shift();
				if (!target.isIn()) {
					continue;
				}
				target[fn]();
				const source = player;
				target.when({ global: "phaseJieshuBegin" }).step(async (event, trigger, player) => {
					if (source.isIn()) {
						if (!trigger._dcmiyi_logged) {
							source.logSkill("dcmiyi");
							trigger._dcmiyi_logged = true;
						}
						source.line(player, fn == "damage" ? "fire" : "green");
					}
					player[func[1 - index]](source);
				});
			}
		},
	},
	dcyinjun: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (get.name(event.card, false) != "sha" && get.type2(event.card) != "trick") {
				return false;
			}
			if (event.targets.length != 1 || !event.targets[0].isIn()) {
				return false;
			}
			if (!player.canUse(new lib.element.VCard({ name: "sha", isCard: true }), event.targets[0], false)) {
				return false;
			}
			return player.hasHistory("lose", evt => {
				if ((evt.relatedEvent || evt.getParent()) != event) {
					return false;
				}
				return event.cards.every(card => {
					return evt.hs.includes(card);
				});
			});
		},
		prompt2(event, player) {
			return `视为对${get.translation(event.targets)}使用一张无伤害来源的【杀】`;
		},
		check(event, player) {
			const sha = new lib.element.VCard({ name: "sha", isCard: true });
			return Math.max(...[event.targets[0], player].map(source => get.effect(event.targets[0], sha, source, player))) > 0;
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = trigger.targets[0];
			await player.useCard(new lib.element.VCard({ name: "sha", isCard: true }), target, false).set("oncard", () => {
				get.event().customArgs.default.customSource = {
					isDead: () => true,
				};
			});
			if (player.getHistory("useSkill", evt => evt.skill == "dcyinjun").length > player.getHp()) {
				player.tempBanSkill("dcyinjun");
			}
		},
	},
};
