import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "miji" | "zhenlie" | "wuyan" | "xswuyan" | "xinwuyan" | "xinjujian">} */
export const groupSkills = {
	miji: {
		audio: 2,
		audioname: ["re_wangyi"],
		trigger: {
			player: "phaseJieshuBegin",
		},
		locked: false,
		filter(event, player) {
			return player.hp < player.maxHp;
		},
		async content(event, trigger, player) {
			const num = player.getDamagedHp();
			await player.draw(num);
			if (_status.connectMode) {
				game.broadcastAll(() => {
					_status.noclearcountdown = true;
				});
			}

			const check = () => {
				const result = {
					bool: true,
					cards: [],
				};
				const cards = player.getCards("he");
				const targets = game.filterPlayer(current => player !== current);

				for (const card of cards) {
					const val = get.value(card, player);
					let max = val;
					let target = null;
					for (const targetx of targets) {
						const otherVal = get.value(card, targetx);
						if (otherVal > max) {
							max = otherVal;
							target = targetx;
						}
					}
					if (target != null) {
						result.cards.push([card, target, max - val]);
					}
				}
				if (result.cards.length < num) {
					result.bool = false;
				} else if (result.cards.length > num) {
					result.cards
						.sort((a, b) => {
							return b[2] - a[2];
						})
						.slice(0, num);
				}
				return result;
			};

			let given = 0;
			let forced = false;
			const givenMap = new Map();
			const aiCheck = check();
			while (given < num) {
				const result = await player
					.chooseCardTarget({
						filterTarget: lib.filter.notMe,
						filterCard(card) {
							return get.itemtype(card) === "card" && !card.hasGaintag("miji_tag");
						},
						selectCard: [1, num - given],
						prompt: "请选择要分配的卡牌和目标",
						forced,
						ai1(card) {
							const event = get.event();
							if (!event.res.bool || ui.selected.cards.length) {
								return 0;
							}
							for (const arr of event.res.cards) {
								if (arr[0] === card) {
									return arr[2];
								}
							}
							return 0;
						},
						ai2(target) {
							const event = get.event();
							const card = ui.selected.cards[0];
							for (const arr of event.res.cards) {
								if (arr[0] === card) {
									return get.attitude(player, target);
								}
							}
							const val = target.getUseValue(card);
							if (val > 0) {
								return val * get.attitude(player, target) * 2;
							}
							return get.value(card, target) * get.attitude(player, target);
						},
					})
					.set("res", aiCheck)
					.forResult();

				if (!result.bool || !result.cards?.length || !result.targets?.length) {
					break;
				}

				forced = true;
				const cards = result.cards;
				const target = result.targets[0].playerid;
				player.addGaintag(cards, "miji_tag");
				given += cards.length;
				if (!givenMap.has(target)) {
					givenMap.set(target, []);
				}
				givenMap.get(target).addArray(cards);
			}

			if (_status.connectMode) {
				game.broadcastAll(() => {
					delete _status.noclearcountdown;
					game.stopCountChoose();
				});
			}

			if (!givenMap.size) {
				return;
			}

			const map = [];
			const cards = [];
			for (const [name, cardxs] of givenMap) {
				const source = (_status.connectMode ? lib.playerOL : game.playerMap)[name];
				player.line(source, "green");
				if (player !== source && (get.mode() !== "identity" || player.identity !== "nei")) {
					player.addExpose(0.18);
				}
				map.push([source, cardxs]);
				cards.addArray(cardxs);
			}

			const loseAsyncEvent = game.loseAsync({
				gain_list: map,
				player: player,
				cards,
				giver: player,
				animate: "giveAuto",
			});
			loseAsyncEvent.setContent("gaincardMultiple");
			await loseAsyncEvent;
		},
		mod: {
			aiOrder(player, card, num) {
				if (num > 0 && _status.event && _status.event.type === "phase" && get.tag(card, "recover")) {
					if (player.needsToDiscard()) {
						return num / 3;
					}
					return 0;
				}
			},
		},
		ai: {
			threaten(player, target) {
				return 0.6 + 0.7 * target.getDamagedHp();
			},
			effect: {
				target(card, player, target) {
					if (target.hp <= 2 && get.tag(card, "damage")) {
						let num = 1;
						if (
							get.itemtype(player) === "player" &&
							player.hasSkillTag("damageBonus", false, {
								target: target,
								card: card,
							}) &&
							!target.hasSkillTag("filterDamage", null, {
								player: player,
								card: card,
							})
						) {
							num = 2;
						}
						if (target.hp > num) {
							return [1, 1];
						}
					}
				},
			},
		},
	},
	zhenlie: {
		audio: 2,
		audioname: ["re_wangyi"],
		filter(event, player) {
			return event.player != player && event.card && (event.card.name == "sha" || get.type(event.card) == "trick");
		},
		logTarget: "player",
		check(event, player) {
			if (event.getParent().excluded.includes(player)) {
				return false;
			}
			if (get.attitude(player, event.player) > 0 || (player.hp < 2 && !get.tag(event.card, "damage"))) {
				return false;
			}
			let evt = event.getParent(),
				directHit = (evt.nowuxie && get.type(event.card, "trick") === "trick") || (evt.directHit && evt.directHit.includes(player)) || (evt.customArgs && evt.customArgs.default && evt.customArgs.default.directHit2);
			if (get.tag(event.card, "respondSha")) {
				if (directHit || player.countCards("h", { name: "sha" }) === 0) {
					return true;
				}
			} else if (get.tag(event.card, "respondShan")) {
				if (directHit || player.countCards("h", { name: "shan" }) === 0) {
					return true;
				}
			} else if (get.tag(event.card, "damage")) {
				if (event.card.name === "huogong") {
					return event.player.countCards("h") > 4 - player.hp - player.hujia;
				}
				if (event.card.name === "shuiyanqijunx") {
					return player.countCards("e") === 0;
				}
				return true;
			} else if (player.hp > 2) {
				if (event.card.name === "shunshou" || (event.card.name === "zhujinqiyuan" && (event.card.yingbian || get.distance(event.player, player) < 0))) {
					return true;
				}
			}
			return false;
		},
		trigger: { target: "useCardToTargeted" },
		async content(event, trigger, player) {
			if (get.attitude(player, trigger.player) < 0 && trigger.player.countDiscardableCards(player, "he")) {
				player.addTempSkill("zhenlie_lose");
			}
			await player.loseHp();
			player.removeSkill("zhenlie_lose");
			trigger.getParent().excluded.add(player);
			if (trigger.player.countCards("he")) {
				if (get.mode() !== "identity" || player.identity !== "nei") {
					player.addExpose(0.12);
				}
				await player.discardPlayerCard({
					target: trigger.player,
					position: "he",
					forced: true,
				});
			}
		},
		subSkill: {
			lose: {
				charlotte: true,
			},
		},
		ai: {
			filterDamage: true,
			skillTagFilter: (player, tag, arg) => {
				return arg && arg.jiu == true;
			},
			effect: {
				target(card, player, target) {
					if (target.hp <= 0 && target.hasSkill("zhenlie_lose") && get.tag(card, "recover")) {
						return [1, 1.2];
					}
				},
			},
		},
	},
	//吾彦...
	wuyan: { audio: 2 },
	xswuyan: {
		audio: "wuyan",
		trigger: { target: "useCardToBefore", player: "useCardToBefore" },
		forced: true,
		check(event, player) {
			return get.effect(event.target, event.card, event.player, player) < 0;
		},
		filter(event, player) {
			if (!event.target) {
				return false;
			}
			if (event.player == player && event.target == player) {
				return false;
			}
			return get.type(event.card) == "trick";
		},
		async content(event, trigger, player) {
			trigger.cancel();
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "trick" && player != target) {
						return "zeroplayertarget";
					}
				},
				player(card, player, target, current) {
					if (get.type(card) == "trick" && player != target) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	xinwuyan: {
		audio: 2,
		trigger: { source: "damageBegin2", player: "damageBegin4" },
		forced: true,
		check(event, player) {
			if (player == event.player) {
				return true;
			}
			return false;
		},
		filter(event, player) {
			return get.type(event.card, "trick") == "trick";
		},
		async content(event, trigger, player) {
			trigger.cancel();
		},
		ai: {
			notrick: true,
			notricksource: true,
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "trick" && get.tag(card, "damage")) {
						return "zeroplayertarget";
					}
				},
				player(card, player, target, current) {
					if (get.type(card) == "trick" && get.tag(card, "damage")) {
						return "zeroplayertarget";
					}
				},
			},
		},
	},
	xinjujian: {
		trigger: { player: "phaseJieshuBegin" },
		audio: 2,
		filter(event, player) {
			return player.countCards("he") > player.countCards("he", { type: "basic" });
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					filterTarget(card, player, target) {
						return player != target;
					},
					filterCard(card, player) {
						return get.type(card) != "basic" && lib.filter.cardDiscardable(card, player);
					},
					ai1(card) {
						if (get.tag(card, "damage") && get.type(card) == "trick") {
							return 20;
						}
						return 9 - get.value(card);
					},
					ai2(target) {
						var att = get.attitude(_status.event.player, target);
						if (att > 0) {
							if (target.isTurnedOver()) {
								att += 3;
							}
							if (target.hp == 1) {
								att += 3;
							}
						}
						return att;
					},
					position: "he",
					prompt: get.prompt2("xinjujian"),
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			const target = event.targets[0];

			await player.discard(event.cards);

			const controls = ["draw_card"];
			if (target.hp < target.maxHp) {
				controls.push("recover_hp");
			}
			if (target.isLinked() || target.isTurnedOver()) {
				controls.push("reset_character");
			}

			let result;
			if (controls.length === 1) {
				result = { control: controls[0] };
			} else {
				result = await target
					.chooseControl({
						controls,
						ai() {
							const target = get.event().target;
							if (target.isTurnedOver()) {
								return "reset_character";
							} else if (target.hp == 1 && target.maxHp > 2) {
								return "recover_hp";
							} else if (target.hp == 2 && target.maxHp > 2 && target.countCards("h") > 1) {
								return "recover_hp";
							} else {
								return "draw_card";
							}
						},
					})
					.set("target", target)
					.forResult();
			}

			switch (result.control) {
				case "recover_hp":
					await target.recover();
					break;
				case "draw_card":
					await target.draw(2);
					break;
				case "reset_character":
					if (target.isTurnedOver()) {
						await target.turnOver();
					}
					if (target.isLinked()) {
						await target.link();
					}
					break;
			}
		},
		ai: {
			expose: 0.2,
			threaten: 1.4,
		},
	},
};
