import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xunli" | "zhishi" | "lieyi" | "bingjie" | "zhengding" | "xiecui" | "youxu">} */
export const groupSkills = {
	//吉本
	xunli: {
		audio: 2,
		trigger: { global: ["loseAfter", "loseAsyncAfter"] },
		forced: true,
		filter(event, player) {
			if (event.getParent("lieyi", true)) {
				return false;
			}
			if (event.type != "discard" || event.getlx === false || player.getExpansions("xunli").length >= 9) {
				return false;
			}
			return event.cards.some(card => get.position(card, true) === "d" && get.color(card, event.cards2?.includes(card) ? event.player : false) === "black");
		},
		async content(event, trigger, player) {
			const num = 9 - player.getExpansions("xunli").length;
			if (num <= 0) {
				return;
			}
			const cards = trigger.cards.filter(card => get.position(card, true) == "d" && get.color(card, trigger.cards2?.includes(card) ? trigger.player : false) == "black").randomGets(num);
			const next = player.addToExpansion("gain2", cards);
			next.gaintag.add("xunli");
			await next;
		},
		marktext: "疠",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		group: "xunli_exchange",
		subSkill: {
			exchange: {
				audio: "xunli",
				trigger: { player: "phaseUseBegin" },
				filter(event, player) {
					return player.hasExpansions("xunli") && player.hasCards("h", card => get.color(card, player) == "black");
				},
				async cost(event, trigger, player) {
					const cards = player.getExpansions("xunli");
					if (!cards.length || !player.countCards("h")) {
						return;
					}
					const next = player.chooseToMove("寻疠：是否交换“疠”和黑色手牌？");
					next.set("list", [
						[get.translation(player) + "（你）的疠", cards],
						["手牌区", player.getCards("h", card => get.color(card, player) == "black")],
					]);
					next.set("filterMove", (from, to) => typeof to != "number");
					next.set("selectionSpec", { move: "swap" });
					next.set("processAI", list => {
						const player = _status.event.player;
						const getv = card => {
							if (get.info(card).toself) {
								return 0;
							}
							return player.getUseValue(card, false);
						};
						const cards = list[0][1].concat(list[1][1]).sort((a, b) => getv(b) - getv(a));
						const cards2 = cards.splice(0, player.getExpansions("xunli").length);
						return [cards2, cards];
					});
					const result = await next.forResult();
					event.result = {
						bool: result?.moved?.length > 0,
						cost_data: result?.moved,
					};
				},
				async content(event, trigger, player) {
					const pushs = event.cost_data[0];
					const gains = event.cost_data[1];
					pushs.removeArray(player.getExpansions("xunli"));
					gains.removeArray(player.getCards("h"));
					if (!pushs.length || pushs.length != gains.length) {
						return;
					}
					const gain = player.addToExpansion(pushs, player, "giveAuto");
					gain.gaintag.add("xunli");
					await gain;
					game.log(player, "将", pushs, "作为“疠”置于武将牌上");
					await player.gain(gains, "gain2");
				},
			},
		},
		ai: { notemp: true },
	},
	zhishi: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					const player = get.player();
					let att = get.attitude(player, target);
					if (att <= 4) {
						return 0;
					}
					if (target.hasSkillTag("nogain")) {
						att /= 10;
					}
					return att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			player.addTempSkill("zhishi_mark", { player: "phaseBegin" });
			player.markAuto("zhishi_mark", [target]);
		},
		ai: {
			combo: "xunli",
			expose: 0.3,
		},
		subSkill: {
			mark: {
				charlotte: true,
				onremove: true,
				mark: "characters",
				intro: { content: "决定帮助$，具体帮不帮另说" },
				trigger: { global: ["dying", "useCardToTargeted"] },
				filter(event, player) {
					if (!player.hasExpansions("xunli")) {
						return false;
					}
					const storage = player.getStorage("zhishi_mark");
					if (event.name == "dying") {
						return storage.includes(event.player);
					}
					return event.card.name == "sha" && storage.includes(event.target);
				},
				async cost(event, trigger, player) {
					const target = get.info(event.skill).logTarget(trigger, player);
					const result = await player
						.chooseButton([get.prompt(event.skill, target), '<div class="text center">弃置任意张“疠”并令其摸等量的牌</div>', player.getExpansions("xunli")], [1, Infinity], "allowChooseAll")
						.set("ai", button => {
							const { player, target } = get.event();
							const att = get.attitude(player, target);
							const card = button.link;
							if (att <= 0) {
								return 0;
							}
							if (target.hp < 1 && target != get.zhu(player)) {
								return 0;
							}
							if (target.hasSkillTag("nogain")) {
								return 0;
							}
							return target.getUseValue(card, false);
						})
						.forResult();
					event.result = {
						bool: result.bool,
						cost_data: result.links,
					};
				},
				logTarget(event, player) {
					return event.name == "dying" ? event.player : event.target;
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					const links = event.cost_data;
					await player.loseToDiscardpile(links);
					await target.draw(links.length);
				},
			},
		},
	},
	lieyi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hasExpansions("xunli") && game.hasPlayer(current => current != player);
		},
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const { target } = event;
			const cards = player.getExpansions("xunli");
			await player.showCards(cards, `${get.translation(player)}对${get.translation(target)}发动了【烈医】`);
			let bool = false;
			while (true) {
				const cards = player.getExpansions("xunli");
				const cards2 = cards.filter(card => target.isIn() && player.canUse(card, target, false));
				if (cards2.length) {
					const result = await player
						.chooseButton([`请选择你要对${get.translation(target)}使用的一张牌`, cards2])
						.set("ai", button => {
							const { player, target } = get.event();
							return get.effect(target, button.link, player, player);
						})
						.set("target", target)
						.forResult();
					if (result?.bool) {
						const next = player.useCard(result.links[0], target, false);
						await next;
						if (!bool && target.hasHistory("damage", evt => evt.getParent("lieyi") == next.getParent() && evt._dyinged)) {
							bool = true;
						}
						continue;
					}
				}
				if (cards.length) {
					await player.loseToDiscardpile(cards);
				}
				if (!bool) {
					await player.loseHp();
				}
				return;
			}
		},
		ai: {
			order(item, player) {
				return Math.max(get.order({ name: "sha" }), 2) - 0.2;
			},
			result: {
				target(player, target) {
					var cards = player.getExpansions("xunli");
					var effect = 0,
						damage = 0;
					for (var i of cards) {
						if (player.canUse(i, target, false)) {
							effect += get.effect(target, i, player, target);
							damage += get.tag(i, "damage");
						}
					}
					if (damage >= target.hp) {
						return effect;
					}
					if (player.hp > 2 && cards.length > 3) {
						return effect / 3;
					}
					return 0;
				},
			},
			combo: "xunli",
		},
	},
	//马日磾
	bingjie: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		check(event, player) {
			return (
				player.maxHp > 3 &&
				player.isDamaged() &&
				player.hasCard(function (card) {
					return (
						game.hasPlayer(function (current) {
							return current != player && get.attitude(player, current) < 0 && player.canUse(card, current, null, true) && get.effect(current, card, player, player) > 0;
						}) && player.hasValueTarget(card)
					);
				}, "hs")
			);
		},
		async content(event, trigger, player) {
			await player.loseMaxHp();
			player.addTempSkill("bingjie_effect");
			game.delayx();
		},
		subSkill: {
			effect: {
				audio: "bingjie",
				trigger: { player: "useCardToPlayered" },
				forced: true,
				charlotte: true,
				logTarget: "target",
				filter(event, player) {
					return event.target != player && (event.card.name == "sha" || get.type(event.card, null, false) == "trick") && event.target.countCards("he") > 0;
				},
				async content(event, trigger, player) {
					const result = await trigger.target.chooseToDiscard("he", true).forResult();
					if (result.bool && result.cards.length && get.color(result.cards[0], trigger.target) == get.color(trigger.card)) {
						game.log(trigger.target, "不能响应", trigger.card);
						trigger.directHit.push(trigger.target);
					}
				},
				ai: {
					effect: {
						player_use(card, player, target) {
							if (player !== target && get.itemtype(target) === "player" && (card.name === "sha" || get.type(card, null, false) === "trick") && target.countCards("he") && !target.hasSkillTag("noh")) {
								return [1, 0, 1, -1];
							}
						},
					},
				},
			},
		},
	},
	zhengding: {
		audio: 2,
		trigger: { player: ["useCard", "respond"] },
		forced: true,
		filter(event, player) {
			if (player == _status.currentPhase) {
				return false;
			}
			if (!Array.isArray(event.respondTo)) {
				return false;
			}
			if (player == event.respondTo[0]) {
				return false;
			}
			var color = get.color(event.card);
			if (color == "none") {
				return false;
			}
			return color == get.color(event.respondTo[1]);
		},
		async content(event, trigger, player) {
			player.gainMaxHp();
			await player.recover();
		},
	},
	//孙茹
	xiecui: {
		audio: 2,
		trigger: { global: "damageBegin1" },
		filter(event, player) {
			var source = event.source;
			if (!source || source != _status.currentPhase || event.getParent().type != "card") {
				return false;
			}
			return !source.hasHistory("sourceDamage", function (evt) {
				return evt.getParent().type == "card";
			});
		},
		logTarget: "source",
		prompt2(event, player) {
			var str = "令" + get.translation(event.player) + "即将受到的";
			str += "" + event.num + "点";
			if (event.hasNature("linked")) {
				str += get.translation(event.nature) + "属性";
			}
			str += "伤害+1";
			if (event.source.group == "wu") {
				var cards = event.cards.filterInD();
				if (cards.length) {
					str += "；然后" + get.translation(event.source) + "获得" + get.translation(cards) + "，且本回合的手牌上限+1";
				}
			}
			return str;
		},
		check(event, player) {
			var att = get.attitude(player, event.player);
			if (att < 0) {
				if (event.source.group != "wu" || !event.cards.filterInD().length) {
					return true;
				}
				return get.attitude(player, event.source) > 0;
			}
			return false;
		},
		async content(event, trigger, player) {
			trigger.num++;
			var source = trigger.source;
			if (source.group == "wu") {
				var cards = trigger.cards.filterInD();
				if (cards.length > 0) {
					source.gain(cards, "gain2");
					source.addMark("xiecui_effect", 1, false);
					source.addTempSkill("xiecui_effect");
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				mod: {
					maxHandcard: (player, num) => num + player.countMark("xiecui_effect"),
				},
				marktext: "翠",
				onremove: true,
				intro: { content: "手牌上限+#" },
			},
		},
		ai: { threaten: 1.75 },
	},
	youxu: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		logTarget: "player",
		filter(event, player) {
			return event.player.countCards("h") > event.player.hp;
		},
		check(event, player) {
			if (get.attitude(player, event.player) <= 0) {
				return true;
			} else {
				return game.hasPlayer(function (current) {
					return current != event.player && current.isDamaged() && current.isMinHp() && get.attitude(player, current) > 0 && get.recoverEffect(current, player, player) > 0;
				});
			}
		},
		async content(event, trigger, player) {
			const cardResult = player == trigger.player ? await player.chooseCard("h", true, "请展示一张手牌").forResult() : await player.choosePlayerCard(trigger.player, true, "h").forResult();
			if (!cardResult.bool) return;
			const card = cardResult.cards[0];
			var str = get.translation(player);
			if (player != trigger.player) {
				str += "对" + get.translation(trigger.player);
			}
			str += "发动了【忧恤】";
			player.showCards(card, str);
			if (!game.hasPlayer(current => current != trigger.player)) return;
			const targetResult = await player
				.chooseTarget("令一名角色获得" + get.translation(card), "若其体力值为全场最少，则其回复1点体力", true, function (card, player, target) {
					return target != _status.event.getTrigger().player;
				})
				.set("ai", function (target) {
					var player = _status.event.player,
						att = get.attitude(player, target);
					if (att < 0) {
						return 0;
					}
					if (target.isDamaged() && target.isMinHp && get.recoverEffect(target, player, player) > 0) {
						return 4 * att;
					}
					return att;
				})
				.forResult();
			if (!targetResult.bool) return;
			const target = targetResult.targets[0];
			player.line(target, "green");
			target.gain(card, trigger.player, "give").giver = player;
			if (target.isMinHp()) {
				target.recover();
			}
		},
	},
};
