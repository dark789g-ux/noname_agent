import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhenyi" | "xinfu_zhennan" | "xinyingshi" | "xinfu_guolun" | "xinfu_zhanji" | "xinfu_songsang">} */
export const groupSkills = {
	zhenyi: {
		audio: "xinfu_zhenyi",
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.hasNature() && player.hasMark("xinfu_falu_diamond");
		},
		prompt2: "失去「勾陈♦」标记，从牌堆中随机获得每种类型的牌各一张",
		async content(event, trigger, player) {
			player.clearMark("xinfu_falu_diamond");
			let [gains, types] = [[], []];
			while (types.length < 3) {
				let card = get.cardPile2(card => !types.includes(get.type2(card)));
				if (card) {
					gains.push(card);
					types.push(get.type2(card));
				} else {
					break;
				}
			}
			if (gains.length > 0) {
				await player.gain(gains, "gain2");
			}
		},
		ai: {
			combo: "xinfu_falu",
			maixie: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage") && (game.hasNature(card) || (card.name === "sha" && player.hasSkill("zhuque_skill")))) {
						if (!target.hasMark("xinfu_falu_heart") || player.hasSkillTag("jueqing", false, target)) {
							return;
						}
						let num = 1;
						if (get.attitude(player, target) > 0) {
							if (player.needsToDiscard()) {
								num = 0.7;
							} else {
								num = 0.5;
							}
						}
						if (target.hp >= 4) {
							return [1, num * 2];
						}
						if (target.hp == 3) {
							return [1, num * 1.5];
						}
						if (target.hp == 2) {
							return [1, num * 0.5];
						}
					}
				},
			},
		},
		group: ["zhenyi_spade", "zhenyi_club", "zhenyi_heart"],
		subSkill: {
			spade: {
				audio: "xinfu_zhenyi",
				trigger: { global: "judge" },
				filter(event, player) {
					return player.hasMark("xinfu_falu_spade");
				},
				async cost(event, trigger, player) {
					const str = `${get.translation(trigger.player)}的${trigger.judgestr || ""}判定为${get.translation(trigger.player.judging[0])}，是否发动【真仪】，失去「紫薇♠」标记并修改判定结果？`;
					const { control } = await player
						.chooseControl("黑桃5", "红桃5", "cancel2")
						.set("prompt", get.prompt(event.skill))
						.set("prompt2", str)
						.set("judging", trigger.player.judging[0])
						.set("ai", () => {
							const { player, judging } = get.event();
							const trigger = get.event().getTrigger();
							const results = trigger.judge({ name: judging.name, suit: "spade", number: 5 }) - trigger.judge(judging);
							const resulth = trigger.judge({ name: judging.name, suit: "heart", number: 5 }) - trigger.judge(judging);
							const attitude = get.attitude(player, trigger.player);
							if (attitude == 0 || (resulth == 0 && results == 0)) {
								return "cancel2";
							}
							if (attitude > 0) {
								if (results > 0) {
									return resulth > results ? "红桃5" : "黑桃5";
								} else if (resulth > 0) {
									return "红桃5";
								}
								return "cancel2";
							} else {
								if (results < 0) {
									return resulth < results ? "红桃5" : "黑桃5";
								} else if (resulth < 0) {
									return "红桃5";
								}
								return "cancel2";
							}
						})
						.forResult();
					event.result = {
						bool: control && control !== "cancel2",
						cost_data: control,
					};
				},
				logTarget: "player",
				async content(event, trigger, player) {
					player.clearMark("xinfu_falu_spade");
					player.popup(event.cost_data);
					const control = event.cost_data.startsWith("黑桃") ? "spade" : "heart";
					game.log(player, "将判定结果改为了", `#y${get.translation(control)}5`);
					trigger.fixedResult = {
						suit: control,
						color: get.color({ suit: control }),
						number: 5,
					};
				},
				ai: {
					expose: 0.5,
					rejudge: true,
					tag: { rejudge: 1 },
				},
			},
			club: {
				audio: "xinfu_zhenyi",
				enable: "chooseToUse",
				viewAsFilter(player) {
					if (player == _status.currentPhase) {
						return false;
					}
					return player.hasMark("xinfu_falu_club") && player.countCards("hes") > 0;
				},
				filterCard: true,
				position: "hes",
				viewAs: { name: "tao" },
				prompt: "失去「后土♣」标记，将一张牌当作【桃】使用",
				check(card) {
					return 15 - get.value(card);
				},
				log: false,
				precontent() {
					player.logSkill("zhenyi_club");
					player.clearMark("xinfu_falu_club");
				},
			},
			heart: {
				audio: "xinfu_zhenyi",
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return player.hasMark("xinfu_falu_heart");
				},
				check(event, player) {
					if (get.attitude(player, event.player) >= 0) {
						return false;
					}
					return !event.player.hasSkillTag("filterDamage", null, {
						player: player,
						card: event.card,
					});
				},
				prompt2(event) {
					return "失去「玉清♥」标记，令即将对" + get.translation(event.player) + "造成的伤害+1";
				},
				logTarget: "player",
				async content(event, trigger, player) {
					player.clearMark("xinfu_falu_heart");
					trigger.num++;
				},
			},
		},
	},
	xinfu_zhennan: {
		audio: 2,
		trigger: {
			target: "useCardToTargeted",
		},
		filter(event, player) {
			return event.card.name == "nanman";
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseTarget(get.prompt("xinfu_zhennan"), "对一名其他角色造成1-3点随机伤害", function (card, player, target) {
					return target != player;
				})
				.set("ai", function (target) {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				});
			"step 1";
			if (result.bool && result.targets && result.targets.length) {
				game.delay();
				player.logSkill("xinfu_zhennan", result.targets);
				var num = [1, 2, 3, 1, 1, 2].randomGet();
				if (get.isLuckyStar(player)) {
					num = 3;
				}
				//player.line(result.targets[0],'fire');
				result.targets[0].damage(num);
			}
		},
		ai: {
			expose: 0.25,
		},
	},
	xinyingshi: {
		audio: "xinfu_yingshi",
		trigger: { player: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			return (
				player.countCards("he") > 0 &&
				!game.hasPlayer(function (current) {
					return current.getExpansions("xinyingshi_cards").length > 0;
				})
			);
		},
		content() {
			"step 0";
			player.chooseCardTarget({
				filterCard: true,
				filterTarget: lib.filter.notMe,
				selectCard: [1, player.countCards("he")],
				position: "he",
				prompt: get.prompt("xinyingshi"),
				prompt2: "将任意张牌置于一名其他角色的武将牌上作为“酬”",
				ai1(card) {
					return 1 - player.getUseValue(card);
				},
				ai2(target) {
					var player = _status.event.player;
					return (
						(1 +
							game.countPlayer(function (current) {
								return get.attitude(player, current) > 0 && current.inRange(target) && get.damageEffect(target, current, player) > 0;
							})) *
						-get.attitude(player, target)
					);
				},
				allowChooseAll: true,
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0],
					cards = result.cards;
				player.logSkill("xinyingshi", target);
				target.addSkill("xinyingshi_cards");
				target.addToExpansion(player, "give", cards).gaintag.add("xinyingshi_cards");
				target.storage.xinyingshi_source = player;
			}
		},
		subSkill: {
			cards: {
				trigger: { player: "damageSource" },
				forced: true,
				charlotte: true,
				filter(event, player) {
					return event.source && event.source.isIn() && event.card && event.getParent().type == "card" && player.getExpansions("xinyingshi_cards").length;
				},
				logTarget: "source",
				content() {
					"step 0";
					event.target = trigger.source;
					event.target.chooseButton(["应势：请选择你的赏金", player.getExpansions("xinyingshi_cards")]);
					"step 1";
					if (result.bool) {
						var cards = [result.links[0]];
						for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
							var card = ui.cardPile.childNodes[i];
							if (card.number == cards[0].number && card.suit == cards[0].suit) {
								cards.push(card);
							}
						}
						player.$give(cards[0], target);
						if (cards.length > 1) {
							setTimeout(
								function () {
									target.$gain2(cards.slice(1));
								},
								get.delayx(200, 200)
							);
							game.log(target, "从牌堆获得了", cards.slice(1));
						}
						game.delay(0, get.delayx(500, 500));
						target.gain(cards);
					}
					"step 2";
					if (!player.getExpansions("xinyingshi_cards").length) {
						player.removeSkill("xinyingshi_cards");
					}
				},
				marktext: "酬",
				intro: {
					content: "expansion",
					markcount: "expansion",
				},
				ai: { threaten: 3 },
				group: "xinyingshi_regain",
				onremove(player, skill) {
					var cards = player.getExpansions(skill);
					if (cards.length) {
						player.loseToDiscardpile(cards);
					}
					delete player.storage.xinyingshi_source;
				},
			},
			regain: {
				trigger: { player: "die" },
				forced: true,
				charlotte: true,
				forceDie: true,
				filter(event, player) {
					return player.storage.xinyingshi_source && player.storage.xinyingshi_source.isIn() && player.getExpansions("xinyingshi_cards").length > 0;
				},
				content() {
					player.storage.xinyingshi_source.gain(player.getExpansions("xinyingshi_cards"), player, "give", "bySelf");
				},
			},
		},
	},
	xinfu_guolun: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterTarget(card, player, target) {
			return target != player && target.countCards("h") > 0;
		},
		content() {
			"step 0";
			player.choosePlayerCard(target, true, "h");
			"step 1";
			event.cardt = result.cards[0];
			target.showCards(event.cardt);
			player.chooseCard("he").set("ai", function (card) {
				var event = _status.event.getParent(),
					player = event.player;
				var numt = get.number(event.cardt);
				var att = get.attitude(player, target);
				var value = get.value(event.cardt);
				var num = get.number(card);
				if (num < numt || att > 2) {
					return value + 6 - get.value(card);
				} else if (num == numt) {
					return value - get.value(card);
				}
				return -1;
			});
			"step 2";
			if (!result.bool) {
				event.finish();
			} else {
				player.showCards(result.cards);
				event.cardp = result.cards[0];
			}
			"step 3";
			player.swapHandcards(target, [event.cardp], [event.cardt]);
			"step 4";
			var nump = get.number(event.cardp, player);
			var numt = get.number(event.cardt, target);
			if (nump < numt) {
				player.draw();
			} else if (nump > numt) {
				target.draw();
			}
		},
		ai: {
			threaten: 1.5,
			order: 8,
			result: {
				player(player, target) {
					if (get.attitude(player, target) > 0) {
						return 1.5;
					}
					return 0.5;
				},
			},
		},
	},
	xinfu_zhanji: {
		audio: 2,
		trigger: {
			player: "gainAfter",
		},
		forced: true,
		filter(event, player) {
			if (!player.isPhaseUsing()) {
				return false;
			}
			return event.getParent().name == "draw" && event.getParent(2).name != "xinfu_zhanji";
		},
		content() {
			player.draw("nodelay");
		},
	},
	xinfu_songsang: {
		limited: true,
		skillAnimation: true,
		animationColor: "wood",
		audio: 2,
		derivation: "xinfu_zhanji",
		trigger: { global: "dieAfter" },
		logTarget: "player",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			if (player.isDamaged()) {
				await player.recover();
			} else {
				await player.gainMaxHp();
			}
			player.addSkills("xinfu_zhanji");
		},
	},
};
