import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const olyajiaoSkills = {
	olyajiao: {
		audio: "reyajiao",
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		frequent: true,
		filter(event, player) {
			if (player == _status.currentPhase) {
				return false;
			}
			return ["useCard", "respond"].includes(event.getParent().name) && event.getl(player)?.hs?.length;
		},
		async content(event, trigger, player) {
			const cards = get.cards(1, true);
			await player
				.showCards(cards, get.translation(player) + "发动了【涯角】", true)
				.set("type", get.type2(trigger.getParent().card))
				.set("clearArena", false)
				.set("removeHighlight", false)
				.set("callback", async (event, trigger, player) => {
					const { cards } = event;
					const [card] = cards;
					const evt = event.getParent();
					const { type, videoId, highlightRemove } = evt;
					if (get.type2(card) == type) {
						const result = await player
							.chooseTarget("涯角：选择获得此牌的角色")
							.set("ai", function (target) {
								var att = get.attitude(_status.event.player, target);
								if (_status.event.du) {
									if (target.hasSkillTag("nodu")) {
										return 0;
									}
									return -att;
								}
								if (att > 0) {
									return att + Math.max(0, 5 - target.countCards("h"));
								}
								return att;
							})
							.set("du", get.name(card) == "du")
							.forResult();
						if (result?.bool && result.targets?.length) {
							const {
								targets: [target],
							} = result;
							player.line(target, "green");
							highlightRemove();
							await target.gain(cards, "gain2");
						}
					} else {
						const result = await player
							.chooseTarget("涯角：是否弃置攻击范围内包含你的一名角色区域内的一张牌？", function (card, player, target) {
								return target.inRange(player) && target.countDiscardableCards(player, "hej") > 0;
							})
							.set("ai", function (target) {
								var player = _status.event.player;
								return get.effect(target, { name: "guohe" }, player, player);
							})
							.forResult();
						if (result?.bool && result.targets?.length) {
							const {
								targets: [target],
							} = result;
							player.line(target, "green");
							highlightRemove();
							await player.discardPlayerCard(target, "hej", true);
						}
					}
					//清楚残留的动画
					game.broadcastAll(ui.clear);
					game.addVideo("judge2", null, videoId);
					if (cards.someInD()) {
						await game.cardsGotoPile(cards.filterInD(), "insert");
					}
				});
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (get.tag(card, "respond") && target.countCards("h") > 1) {
						return [1, 0.2];
					}
				},
			},
		},
	},
	olpaoxiao: {
		audio: "paoxiao",
		audioname: ["re_zhangfei", "xiahouba", "re_guanzhang"],
		audioname2: { guanzhang: "paoxiao_guanzhang", ol_guanzhang: "paoxiao_ol_guanzhang" },
		trigger: { player: "shaMiss" },
		forced: true,
		async content(event, trigger, player) {
			player.addTempSkill("olpaoxiao2");
			player.addMark("olpaoxiao2", 1, false);
		},
		mod: {
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return Infinity;
				}
			},
		},
	},
	olpaoxiao2: {
		trigger: { source: "damageBegin1" },
		forced: true,
		audio: "paoxiao",
		audioname: ["re_zhangfei", "xiahouba", "re_guanzhang"],
		audioname2: { guanzhang: "paoxiao_guanzhang", ol_guanzhang: "paoxiao_ol_guanzhang" },
		sourceSkill: "olpaoxiao",
		filter(event, player) {
			return event.card && event.card.name == "sha" && player.countMark("olpaoxiao2") > 0;
		},
		onremove: true,
		async content(event, trigger, player) {
			trigger.num += player.countMark("olpaoxiao2");
			player.removeSkill("olpaoxiao2");
		},
		intro: { content: "本回合内下一次使用【杀】造成伤害时令伤害值+#" },
	},
	paoxiao_ol_guanzhang: { audio: 1 },
	oltishen: {
		audio: "retishen",
		skillAnimation: true,
		animationColor: "soil",
		limited: true,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.isDamaged();
		},
		check(event, player) {
			if (player.hp <= 2 || player.getDamagedHp() > 2) {
				return true;
			}
			if (player.getDamagedHp() <= 1) {
				return false;
			}
			return player.getDamagedHp() < game.roundNumber;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const num = player.getDamagedHp(true);
			await player.recover(num);
			await player.draw(num);
		},
	},
	rexuanfeng: {
		audio: "xuanfeng",
		audioname: ["boss_lvbu3", "re_lingtong"],
		audioname2: { re_heqi: "fenwei_heqi" },
		trigger: {
			player: ["loseAfter", "phaseDiscardEnd"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (
				!game.hasPlayer(function (current) {
					return current != player && current.countCards("he") > 0;
				})
			) {
				return false;
			}
			if (event.name == "phaseDiscard") {
				var cards = [];
				player.getHistory("lose", function (evt) {
					if (evt && evt.type == "discard" && evt.getParent("phaseDiscard") == event && evt.hs) {
						cards.addArray(evt.hs);
					}
				});
				return cards.length > 1;
			}
			var evt = event.getl(player);
			return evt && evt.es && evt.es.length > 0;
		},
		async cost(event, trigger, player) {
			const list = ["弃置至多两名其他角色的合计两张牌"];
			const choices = ["选项一"];
			if (
				player.canMoveCard(
					null,
					true,
					game.filterPlayer(target => target != player),
					game.filterPlayer(target => target != player)
				)
			) {
				list.push("将一名其他角色装备区内的一张牌移动到另一名角色的装备区内");
				choices.push("选项二");
			}
			if (list.length > 1 && player.countEnabledSlot()) {
				list.push("背水：废除你的一个装备栏");
				choices.push("背水！");
			}
			choices.push("cancel2");
			const result = await player
				.chooseControl(choices)
				.set("choiceList", list)
				.set("prompt", get.prompt(event.skill))
				.set("ai", function () {
					if (
						get.player().canMoveCard(
							null,
							true,
							game.filterPlayer(target => target != player),
							game.filterPlayer(target => target != player)
						)
					) {
						return 1;
					}
					return 0;
				})
				.forResult();
			if (result?.control != "cancel2") {
				event.result = {
					bool: true,
					cost_data: result.index,
				};
			}
		},
		async content(event, trigger, player) {
			const index = event.cost_data;
			if (index % 2 == 0) {
				for (let i = 0; i < 2; i++) {
					const result = await player
						.chooseTarget("弃置一名其他角色的一张牌", function (card, player, target) {
							if (player == target) {
								return false;
							}
							return target.countDiscardableCards(player, "he");
						})
						.set("ai", function (target) {
							return -get.attitude(_status.event.player, target);
						})
						.forResult();
					if (result?.bool && result.targets?.length) {
						player.line(result.targets[0], "green");
						await player.discardPlayerCard(result.targets[0], "he", true);
					}
				}
			}
			if (
				index > 0 &&
				player.canMoveCard(
					null,
					true,
					game.filterPlayer(target => target != player),
					game.filterPlayer(target => target != player)
				)
			) {
				await player
					.moveCard(
						true,
						game.filterPlayer(target => target != player),
						game.filterPlayer(target => target != player)
					)
					.set("noJudge", true);
			}
			if (index == 2) {
				await player.chooseToDisable();
			}
		},
		ai: {
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						return [1, 3];
					}
				},
			},
			reverseEquip: true,
			noe: true,
		},
	},
	reyongjin: {
		audio: "yongjin",
		trigger: {
			global: "phaseAnyEnd",
		},
		filter(event, player) {
			const count = current => {
				let cards = [];
				current.getHistory("lose", evt => {
					if (evt.getParent(event.name) == event) {
						cards.addArray(evt.cards2);
					}
				});
				return cards.length;
			};
			const num = count(player),
				card = new lib.element.VCard({ name: "sha", isCard: true });
			return (
				num > 0 &&
				game.hasPlayer(current => {
					return count(current) == num && player.canUse(card, current, false);
				})
			);
		},
		async cost(event, trigger, player) {
			const count = current => {
				let cards = [];
				current.getHistory("lose", evt => {
					if (evt.getParent(trigger.name) == trigger) {
						cards.addArray(evt.cards2);
					}
				});
				return cards.length;
			};
			const num = count(player),
				card = new lib.element.VCard({ name: "sha", isCard: true });
			const targets = game.filterPlayer(current => {
				return count(current) == num && player.canUse(card, current, false);
			});
			event.result = await player
				.chooseTarget(
					get.prompt2(event.skill),
					(card, player, target) => {
						return get.event().targetx.includes(target);
					},
					[1, Infinity]
				)
				.set("targetx", targets)
				.set("ai", target => {
					const card = new lib.element.VCard({ name: "sha", isCard: true }),
						player = get.player();
					return get.effect(target, card, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const card = new lib.element.VCard({ name: "sha", storage: { reyongjin: true }, isCard: true }),
				targets = event.targets.filter(target => player.canUse(card, target, false));
			if (!targets.length) {
				return;
			}
			const skill = "reyongjin_effect";
			player.addSkill(skill);
			const next = player.useCard(card, targets, false);
			player.markAuto(skill, next);
			await next;
		},
		subSkill: {
			effect: {
				trigger: {
					player: "useCardAfter",
					source: "damageSource",
				},
				charlotte: true,
				filter(event, player) {
					const evt = event.name == "damage" ? event.getParent(2) : event;
					return player.getStorage("reyongjin_effect").includes(evt);
				},
				async cost(event, trigger, player) {
					if (trigger.name == "useCard") {
						player.unmarkAuto(event.skill, trigger);
						return;
					}
					event.result = {
						bool: true,
					};
				},
				async content(event, trigger, player) {
					const slots = Array.from(Array(13))
						.map((v, i) => `equip${parseFloat(i + 1)}`)
						.filter(i => player.hasDisabledSlot(i));
					if (slots.length) {
						const slot = slots.randomGet();
						await player.enableEquip(slot);
						return;
					}
					const card = get.discardPile(card => get.type(card) == "equip" && player.canEquip(card) && !get.tag(card, "gifts"));
					if (card) {
						player.$gain2(card, false);
						await player.equip(card);
					}
				},
			},
		},
	},
	rechunlao: {
		trigger: { player: "phaseUseEnd" },
		audio: 2,
		filter(event, player) {
			return player.countCards("h") > 0 && (_status.connectMode || player.countCards("h", "sha") > 0) && !player.hasExpansions("rechunlao");
		},
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
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard({
					selectCard: [1, Math.max(1, player.countCards("h", "sha"))],
					prompt: get.prompt(event.skill),
					prompt2: '将任意张【杀】置于武将牌上作为"醇"',
					filterCard(card) {
						return get.name(card) == "sha";
					},
					allowChooseAll: true,
				})
				.set("ai", function () {
					return 1;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			await player.addToExpansion({ cards, animate: "giveAuto", gaintag: [event.name] });
		},
		ai: {
			threaten: 1.4,
		},
		group: "rechunlao2",
	},
	rechunlao2: {
		enable: "chooseToUse",
		sourceSkill: "rechunlao",
		filter(event, player) {
			return event.type == "dying" && event.dying && event.dying.hp <= 0 && player.getExpansions("rechunlao").length > 0;
		},
		filterTarget(card, player, target) {
			return target == _status.event.dying;
		},
		direct: true,
		delay: false,
		selectTarget: -1,
		async content(event, trigger, player) {
			// step 0
			const target = event.targets[0];
			const result = await player.chooseCardButton(get.translation("rechunlao"), player.getExpansions("rechunlao"), true).forResult();
			// step 1
			if (result.bool) {
				player.logSkill("rechunlao");
				event.type = "dying";
				await player.loseToDiscardpile(result.links);
				await target.useCard({ name: "jiu", isCard: true }, target);
				const natures = get.natureList(result.links[0]);
				if (natures.includes("fire")) {
					await player.recover();
				}
				if (natures.includes("thunder")) {
					await player.draw(2);
				}
			}
		},
		ai: {
			order: 6,
			skillTagFilter(player) {
				return player.getExpansions("rechunlao").length > 0;
			},
			save: true,
			result: {
				target: 3,
			},
			threaten: 1.6,
		},
	},
};
