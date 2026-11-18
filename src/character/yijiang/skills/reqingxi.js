import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "reqingxi" | "reqingxi2" | "qingxi" | "jieyue" | "jinjiu" | "xinxianzhen" | "xinxianzhen2" | "xinxianzhen3">} */
export const groupSkills = {
	reqingxi: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" || event.card.name == "juedou";
		},
		check(event, player) {
			return get.attitude(player, event.target) < 0;
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const num = Math.min(
				game.countPlayer(current => player.inRange(current)),
				player.getEquips(1).length ? 4 : 2
			);
			let result;
			if (trigger.target.countCards("h") < num) {
				result = { bool: false };
			} else {
				result = await trigger.target
					.chooseToDiscard({
						prompt: "弃置" + get.cnNumber(num) + "张手牌，或令" + get.translation(trigger.card) + "的伤害+1",
						selectCard: num,
						ai(card) {
							const player = get.player();
							if (player.hp == 1) {
								if (get.type(card) == "basic") {
									return 8 - get.value(card);
								}
								return 10 - get.value(card);
							}
							if (num > 2) {
								return 0;
							}
							return 8 - get.value(card);
						},
					})
					.forResult();
			}
			if (result.bool) {
				const e1 = player.getEquips(1);
				if (e1.length) {
					await player.modedDiscard({
						cards: e1,
						discarder: trigger.target,
					});
				}
				return;
			}
			const id = trigger.target.playerid;
			if (id != null) {
				const map = trigger.customArgs;
				if (!map[id]) {
					map[id] = {};
				}
				if (!map[id].extraDamage) {
					map[id].extraDamage = 0;
				}
				map[id].extraDamage++;
			}
			result = await player
				.judge({
					judge(card) {
						if (get.color(card) == "red") {
							return 1;
						}
						return 0;
					},
					judge2(result) {
						return result.bool;
					},
				})
				.forResult();
			if (result.color == "red" && typeof trigger.directHit !== "boolean") {
				trigger.directHit.add(trigger.target);
			}
		},
	},
	reqingxi2: {
		mod: {
			cardEnabled(card, player) {
				if (
					player.storage.reqingxi2 &&
					player.storage.reqingxi2.filter(function (cd) {
						return get.color(cd) == get.color(card);
					}).length
				) {
					return false;
				}
			},
			cardRespondable(card, player) {
				if (
					player.storage.reqingxi2 &&
					player.storage.reqingxi2.filter(function (cd) {
						return get.color(cd) == get.color(card);
					}).length
				) {
					return false;
				}
			},
		},
		firstDo: true,
		onremove: true,
		trigger: {
			player: ["damage", "damageCancelled", "damageZero"],
			target: ["shaMiss", "useCardToExcluded"],
		},
		charlotte: true,
		sourceSkill: "reqingxi",
		filter(event, player) {
			const evt = event.getParent("useCard", true, true);
			if (evt && evt.effectedCount < evt.effectCount) {
				return false;
			}
			return player.storage.reqingxi2 && event.card && player.storage.reqingxi2.includes(event.card);
		},
		silent: true,
		forced: true,
		popup: false,
		priority: 12,
		async content(event, trigger, player) {
			player.storage.reqingxi2.remove(trigger.card);
			if (!player.storage.reqingxi2.length) {
				player.removeSkill("reqingxi2");
			}
		},
	},
	qingxi: {
		audio: 2,
		trigger: { source: "damageBegin1" },
		check(event, player) {
			return get.attitude(player, event.player) < 0;
		},
		filter(event, player) {
			return event.getParent()?.name === "sha" && player.getEquips(1).length > 0;
		},
		async content(event, trigger, player) {
			const num = player.getEquipRange();

			/** @type {Partial<Result>} */
			let result = { bool: false };
			if (trigger.player.countCards("h") >= num) {
				result = await trigger.player
					.chooseToDiscard({
						prompt: "弃置" + get.cnNumber(num) + "张手牌，或令杀的伤害+1",
						selectCard: num,
						ai(card) {
							const player = _status.event.player;
							if (player.hp == 1) {
								if (get.type(card) == "basic") {
									return 8 - get.value(card);
								}
								return 10 - get.value(card);
							}
							if (num > 2) {
								return 0;
							}
							return 8 - get.value(card);
						},
					})
					.forResult();
			}
			if (result.bool) {
				const e1 = player.getEquips(1);
				if (e1.length) {
					await player.modedDiscard({
						cards: e1,
						discarder: trigger.player,
					});
				}
			} else {
				trigger.num++;
			}
		},
	},
	jieyue: {
		audio: 4,
		trigger: { player: "phaseJieshuBegin" },
		logAudio: () => 2,
		async cost(event, trigger, player) {
			event.result = await await player
				.chooseCardTarget({
					filterTarget(card, player, target) {
						return target != player && target.countCards("he") > 0;
					},
					filterCard: lib.filter.cardDiscardable,
					ai1(card) {
						return 7 - get.useful(card);
					},
					ai2(target) {
						return 1 - get.attitude(_status.event.player, target);
					},
					prompt: get.prompt2("jieyue"),
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			await player.discard({ cards: event.cards });
			const target = event.targets[0];

			const result = await target
				.chooseCard({
					prompt: `将一张牌置于${get.translation(player)}的武将牌上，或令其弃置你的一张牌`,
					position: "he",
					ai(card) {
						if (card.name == "du") {
							return 20;
						}
						const player = _status.event.player;
						if (get.attitude(player, _status.event.getParent().player) > 0) {
							return 8 - get.value(card);
						}
						const nh = player.countCards("h");
						if (nh <= 2) {
							return 6 - get.value(card);
						}
						if (nh <= 3) {
							return 2 - get.value(card);
						}
						return 0;
					},
				})
				.forResult();

			if (result.bool && result.cards?.length) {
				await player.addToExpansion({
					cards: result.cards,
					source: target,
					animate: "give",
					gaintag: ["jieyue"],
				});
			} else if (target.countCards("he")) {
				await player.discardPlayerCard({
					target,
					forced: true,
				});
			}
		},
		ai: { expose: 0.1 },
		marktext: "节",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		group: ["jieyue_wuxie", "jieyue_shan", "jieyue_gain"],
		subSkill: {
			wuxie: {
				audio: "jieyue3.mp3",
				enable: "chooseToUse",
				filterCard(card) {
					return get.color(card) == "black";
				},
				viewAsFilter(player) {
					return player.countExpansions("jieyue") > 0 && player.countCards("hs", { color: "black" }) > 0;
				},
				position: "hs",
				viewAs: { name: "wuxie" },
				prompt: "将一张黑色手牌当无懈可击使用",
				check(card) {
					return 8 - get.value(card);
				},
			},
			shan: {
				audio: "jieyue4.mp3",
				enable: ["chooseToRespond", "chooseToUse"],
				filterCard(card) {
					return get.color(card) == "red";
				},
				position: "hs",
				viewAs: { name: "shan" },
				viewAsFilter(player) {
					return player.countExpansions("jieyue") > 0 && player.countCards("hs", { color: "red" }) > 0;
				},
				prompt: "将一张红色手牌当闪使用或打出",
				check: () => 1,
				ai: {
					respondShan: true,
					skillTagFilter(player) {
						if (!player.getExpansions("jieyue").length || !player.countCards("hs", { color: "red" })) {
							return false;
						}
					},
					effect: {
						target(card, player, target, current) {
							if (get.tag(card, "respondShan") && current < 0) {
								return 0.8;
							}
						},
					},
				},
			},
			gain: {
				audio: ["jieyue1.mp3", "jieyue2.mp3"],
				trigger: { player: "phaseZhunbeiBegin" },
				filter(event, player) {
					return player.getExpansions("jieyue").length;
				},
				forced: true,
				async content(event, trigger, player) {
					const cards = player.getExpansions("jieyue");
					if (cards.length) {
						player.gain(cards, "gain2");
					}
				},
			},
		},
	},
	jinjiu: {
		mod: {
			cardname(card, player) {
				if (card.name == "jiu") {
					return "sha";
				}
			},
		},
		ai: {
			skillTagFilter(player) {
				if (!player.countCards("h", "jiu")) {
					return false;
				}
			},
			respondSha: true,
		},
		audio: 2,
		trigger: { player: ["useCard1", "respond"] },
		firstDo: true,
		forced: true,
		filter(event, player) {
			return event.card.name == "sha" && !event.skill && event.cards.length == 1 && event.cards[0].name == "jiu";
		},
		async content(event, trigger, player) {},
	},
	xinxianzhen: {
		audio: "xianzhen",
		inherit: "xianzhen",
	},
	xinxianzhen2: {
		audio: "xianzhen",
		audioname2: {
			ol_gaoshun: "rexianzhen",
		},
		mod: {
			targetInRange(card, player, target) {
				if (target == player.storage.xinxianzhen) {
					return true;
				}
			},
			cardUsableTarget(card, player, target) {
				if (target == player.storage.xinxianzhen) {
					return true;
				}
			},
		},
		ai: {
			unequip: true,
			skillTagFilter(player, tag, arg) {
				if (arg.target != player.storage.xinxianzhen) {
					return false;
				}
			},
			effect: {
				player_use(card, player, target, current, isLink) {
					if (isLink || !player.storage.xinxianzhen || player._xinxianzhen_effect_temp) {
						return;
					}
					if (target != player.storage.xinxianzhen && ["sha", "guohe", "shunshou", "huogong", "juedou"].includes(card.name)) {
						player._xinxianzhen_effect_temp = true;
						let eff = get.effect(player.storage.xinxianzhen, card, player, player);
						delete player._xinxianzhen_effect_temp;
						if (eff > 0) {
							return [1, 2];
						}
					}
				},
			},
		},
		trigger: { player: "useCard2" },
		sourceSkill: "xinxianzhen",
		filter(event, player) {
			return player.storage.xinxianzhen && player.storage.xinxianzhen.isIn() && (event.card.name == "sha" || get.type(event.card) == "trick") && event.targets && event.targets.length == 1 && !event.targets.includes(player.storage.xinxianzhen);
		},
		check(event, player) {
			return get.effect(player.storage.xinxianzhen, event.card, player, player) > 0;
		},
		logTarget(event, player) {
			return player.storage.xinxianzhen;
		},
		prompt2: (event, player) => "令" + get.translation(player.storage.decadexianzhen2) + "也成为" + get.translation(event.card) + "的目标",
		async content(event, trigger, player) {
			const target = player.storage.xinxianzhen;
			trigger.targets.push(target);
			game.log(target, "成为了", trigger.card, "的额外目标");
		},
	},
	xinxianzhen3: {
		charlotte: true,
		mod: {
			cardEnabled(card) {
				if (card.name == "sha") {
					return false;
				}
			},
			ignoredHandcard(card, player) {
				if (get.name(card) == "sha") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.name(card) == "sha") {
					return false;
				}
			},
		},
	},
};
