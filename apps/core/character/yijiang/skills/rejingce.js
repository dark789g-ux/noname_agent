import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "rejingce" | "rejueqing" | "reshangshi" | "reshangshi_2nd" | "oldzhenlie" | "oldmiji" | "oldqianxi" | "old_fuhun" | "wusheng_old_guanzhang" | "paoxiao_old_guanzhang" | "shiyong">} */
export const groupSkills = {
	rejingce: {
		getNum(event, player) {
			const list = [];
			player.getHistory("useCard", evt => {
				if (evt.getParent("phaseUse") == event) {
					list.add(get.type2(evt.card));
				}
			});
			return list.length;
		},
		audio: "jingce",
		trigger: { player: "phaseUseEnd" },
		frequent: true,
		filter(event, player) {
			return player.hasHistory("useCard", evt => evt.getParent("phaseUse") == event);
		},
		async content(event, trigger, player) {
			const num = get.info(event.name).getNum(trigger, player);
			await player.draw(num);
		},
		group: "rejingce_add",
		subSkill: {
			add: {
				trigger: { player: "loseEnd" },
				silent: true,
				firstDo: true,
				filter(event, player) {
					if (_status.currentPhase !== player) {
						return false;
					}
					if (event.getParent().name != "useCard") {
						return false;
					}
					const list = player.getStorage("rejingce_effect");
					return event.cards.some(card => !list.includes(get.suit(card, player)));
				},
				async content(event, trigger, player) {
					const effect = "rejingce_effect";
					player.addTempSkill(effect);
					player.markAuto(
						effect,
						trigger.cards.map(card => get.suit(card, player))
					);
					player.storage[effect].sort((a, b) => lib.suit.indexOf(b) - lib.suit.indexOf(a));
					player.addTip(effect, get.translation(effect) + player.getStorage(effect).reduce((str, suit) => str + get.translation(suit), ""));
				},
			},
			effect: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				intro: { content: "当前已使用花色：$" },
				mod: {
					maxHandcard(player, num) {
						return num + player.getStorage("rejingce_effect").length;
					},
				},
			},
		},
	},
	rejueqing: {
		audio: 2,
		trigger: { source: "damageBegin2" },
		skillAnimation: true,
		animationColor: "water",
		filter(event, player) {
			return player != event.player && !player.storage.rejueqing_rewrite && event.notLink();
		},
		prompt2(event, player) {
			var num = get.cnNumber(2 * event.num, true);
			return "令即将对其造成的伤害翻倍至" + num + "点，并令自己失去" + get.cnNumber(event.num) + "点体力";
		},
		check(event, player) {
			return (
				player.hp > event.num &&
				event.player.hp > event.num &&
				!event.player.hasSkillTag("filterDamage", null, {
					player: player,
					card: event.card,
				}) &&
				get.attitude(player, event.player) < 0
			);
		},
		locked(skill, player) {
			return player && player.storage.rejueqing_rewrite;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.loseHp(trigger.num);
			trigger.num *= 2;
			const next = game.createEvent("rejueqing_rewrite", false);
			next.player = player;
			next.setContent(() => {
				if (!player.storage.rejueqing_rewrite) {
					game.log(player, "修改了", "#g【绝情】");
					player.popup("绝情");
					player.storage.rejueqing_rewrite = true;
				}
			});
			event.next.remove(next);
			trigger.after.push(next);
		},
		derivation: "rejueqing_rewrite",
		group: "rejueqing_rewrite",
		subSkill: {
			rewrite: {
				trigger: { source: "damageBefore" },
				forced: true,
				charlotte: true,
				audio: "rejueqing",
				filter(event, player) {
					return player.storage.rejueqing_rewrite == true;
				},
				check() {
					return false;
				},
				async content(event, trigger, player) {
					trigger.cancel();
					await trigger.player.loseHp(trigger.num);
				},
				ai: {
					jueqing: true,
					skillTagFilter(player) {
						return player.storage.rejueqing_rewrite == true;
					},
				},
			},
		},
	},
	reshangshi: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "changeHp", "gainMaxHpAfter", "loseMaxHpAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		frequent: true,
		prompt(event, player) {
			return "是否发动【伤逝】将手牌摸至" + get.cnNumber(player.getDamagedHp()) + "张？";
		},
		prompt2: false,
		filter(event, player) {
			if (event.getl && !event.getl(player)) {
				return false;
			}
			return player.countCards("h") < player.getDamagedHp();
		},
		async content(event, trigger, player) {
			await player.draw(player.getDamagedHp() - player.countCards("h"));
		},
		ai: {
			noh: true,
			freeSha: true,
			freeShan: true,
			skillTagFilter(player, tag) {
				if (player.maxHp - player.hp < player.countCards("h")) {
					return false;
				}
			},
		},
		group: "reshangshi_2nd",
	},
	reshangshi_2nd: {
		trigger: { player: "damageBegin3" },
		sourceSkill: "reshangshi",
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard({
					prompt: "是否发动【伤逝】弃置一张牌？",
					position: "he",
					ai(card) {
						const player = get.player();
						if (player.countCards("h") > player.getDamagedHp() + _status.event.getTrigger().num) {
							return 1;
						}
						if (player.isPhaseUsing()) {
							return 0.1 - player.getUseValue(card, null, true) / Math.max(0.1, get.value(card));
						}
						return (get.position(card) == "h" ? 5 : 0.1) - get.value(card);
					},
				})
				.set("chooseonly", true)
				.forResult();
		},
		async content(event, trigger, player) {
			await player.discard({
				cards: event.cards,
				discarder: player,
			});
		},
	},
	oldzhenlie: {
		audio: 2,
		trigger: {
			player: "judge",
		},
		check(event, player) {
			return event.judge(player.judging[0]) < 0;
		},
		async content(event, trigger, player) {
			const card = get.cards()[0];

			const next = game.cardsGotoOrdering(card);
			next.relatedEvent = trigger;
			await next;

			player.$throw(card);
			if (trigger.player.judging[0].clone) {
				trigger.player.judging[0].clone.classList.remove("thrownhighlight");
				game.broadcast(card => {
					if (card.clone) {
						card.clone.classList.remove("thrownhighlight");
					}
				}, trigger.player.judging[0]);
				game.addVideo("deletenode", player, get.cardsInfo([trigger.player.judging[0].clone]));
			}
			trigger.player.judging[0] = card;
			game.log(trigger.player, "的判定牌改为", card);
			await game.cardsDiscard(trigger.player.judging[0]);
			await game.delay(2);
		},
	},
	oldmiji: {
		trigger: { player: ["phaseZhunbeiBegin", "phaseJieshuBegin"] },
		audio: 2,
		filter(event, player) {
			return player.isDamaged();
		},
		async content(event, trigger, player) {
			let result = await player
				.judge({
					judge(card) {
						return get.color(card) === "black" ? 1 : -1;
					},
					judge2(result) {
						return result.bool;
					},
				})
				.forResult();

			if (!result.bool || player.maxHp <= player.hp) {
				return;
			}

			const cards = get.cards(player.maxHp - player.hp);
			result = await player
				.chooseTarget({
					forced: true,
					ai(target) {
						const player = get.player();
						return get.attitude(player, target) / Math.sqrt(1 + target.countCards("h"));
					},
				})
				.set("createDialog", ["请选择一名角色获得这些牌", cards])
				.forResult();

			if (result.bool && result.targets?.length) {
				player.line(result.targets);
				await result.targets[0].gain({
					cards,
					animate: "draw",
				});
			}
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (get.tag(card, "recover") && target.hp == target.maxHp - 1) {
						return [0, 0];
					}
					if (target.hasFriend()) {
						if ((get.tag(card, "damage") == 1 || get.tag(card, "loseHp")) && target.hp == target.maxHp) {
							return [0, 1];
						}
					}
				},
			},
			threaten(player, target) {
				if (target.hp == 1) {
					return 3;
				}
				if (target.hp == 2) {
					return 2;
				}
				return 1;
			},
		},
	},
	oldqianxi: {
		audio: 2,
		trigger: { source: "damageBegin2" },
		check(event, player) {
			const att = get.attitude(player, event.player);
			if (event.player.hp == event.player.maxHp) {
				return att < 0;
			}
			if (event.player.hp == event.player.maxHp - 1 && (event.player.maxHp <= 3 || event.player.hasSkillTag("maixie"))) {
				return att < 0;
			}
			return att > 0;
		},
		filter(event, player) {
			return event.card && event.card.name == "sha" && get.distance(player, event.player) <= 1;
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const result = await player
				.judge({
					judge(card) {
						return get.suit(card) != "heart" ? 1 : -1;
					},
					judge2(result) {
						return result.bool;
					},
				})
				.forResult();

			if (result.bool) {
				trigger.cancel();
				trigger.player.loseMaxHp({ forced: true });
			}
		},
	},
	old_fuhun: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			trigger.changeToZero();

			const cards = get.cards(2);
			await player.showCards(cards, `${get.translation(player)}发动了【父魂】`);

			await player.gain({
				cards,
				animate: "gain2",
			});
			if (get.color(cards[0]) !== get.color(cards[1])) {
				player.addTempSkills(["wusheng", "paoxiao"]);
			}
		},
		derivation: ["wusheng", "paoxiao"],
	},
	wusheng_old_guanzhang: { audio: true },
	paoxiao_old_guanzhang: { audio: true },
	shiyong: {
		audio: 2,
		trigger: { player: "damageEnd" },
		forced: true,
		check() {
			return false;
		},
		filter(event, player) {
			return event.card && event.card.name == "sha" && (get.color(event.card) == "red" || event.getParent(2).jiu == true);
		},
		async content(event, trigger, player) {
			await player.loseMaxHp();
		},
		ai: {
			neg: true,
		},
	},
};
