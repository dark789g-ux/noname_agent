import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const jilinSkills = {
	//应天司马懿！别肘
	jilin: {
		audio: 5,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		forced: true,
		locked: false,
		logAudio: () => 1,
		async content(event, trigger, player) {
			const cards = get.cards(2);
			const next = player.addToExpansion(cards, "draw");
			next.gaintag.add(event.name);
			await next;
		},
		marktext: "志",
		intro: {
			markcount: "expansion",
			mark(dialog, content, player) {
				const cards = player.getExpansions("jilin"),
					mingzhi = cards.filter(card => card.storage.jilin),
					hidden = cards.removeArray(mingzhi);
				if (mingzhi.length) {
					dialog.addText("已明之志");
					dialog.addSmall(mingzhi);
				}
				if (hidden.length) {
					if (player == game.me || player.isUnderControl()) {
						dialog.addText("未明之志");
						dialog.addSmall(hidden);
					} else {
						return "共有" + get.cnNumber(hidden.length) + "张暗“志”";
					}
				}
			},
			/*
			???
			content(content, player) {
				const cards = player.getExpansions("jilin"),
					mingzhi = cards.filter(card => card.storage.jilin),
					hidden = cards.removeArray(mingzhi);
				if (mingzhi.length) {
					dialog.addText("已明之志");
					dialog.addSmall(mingzhi);
				}
				if (hidden.length) {
					if (player == game.me || player.isUnderControl()) {
						dialog.addText("未明之志");
						dialog.addSmall(hidden);
					} else {
						return "共有" + get.cnNumber(hidden.length) + "张暗“志”";
					}
				}
			},
			*/
		},
		group: ["jilin_kanpo", "jilin_change"],
		subSkill: {
			kanpo: {
				audio: ["jilin2.mp3", "jilin3.mp3"],
				trigger: {
					target: "useCardToTarget",
				},
				filter(event, player) {
					return event.player != player && player.getExpansions("jilin").some(card => !card.storage.jilin);
				},
				async cost(event, trigger, player) {
					const hidden = player.getExpansions("jilin").filter(card => !card.storage.jilin);
					const goon = get.effect(player, trigger.card, trigger.player, player) < 0;
					const suits = player
						.getExpansions("jilin")
						.filter(card => card.storage.jilin)
						.map(card => get.suit(card))
						.toUniqued();
					if (hidden.length == 1) {
						const { bool } = await player
							.chooseBool("戢鳞：明置一张“志”", `令${get.translation(trigger.card)}对你无效`)
							.set("choice", goon)
							.forResult();
						event.result = {
							bool: bool,
							cost_data: hidden,
						};
					} else {
						const { bool, links } = await player
							.chooseButton(["戢鳞：明置一张“志”", hidden])
							.set("ai", button => {
								const player = get.player(),
									card = button.link,
									suits = get.event().suits;
								if (!get.event().goon) {
									return 0;
								}
								if (!suits.includes(get.suit(card))) {
									return 10;
								}
								return 6 - get.value(card);
							})
							.set("suits", suits)
							.set("goon", goon)
							.forResult();
						event.result = {
							bool: bool,
							cost_data: links,
						};
					}
				},
				async content(event, trigger, player) {
					await player.showCards(event.cost_data, get.translation(player) + "发动了【戢鳞】");
					event.cost_data[0].storage.jilin = true;
					trigger.getParent().excluded.add(player);
				},
			},
			change: {
				audio: ["jilin4.mp3", "jilin5.mp3"],
				trigger: {
					player: "phaseBegin",
				},
				filter(event, player) {
					return player.countCards("h") && player.getExpansions("jilin").some(card => !card.storage.jilin);
				},
				async cost(event, trigger, player) {
					const hidden = player.getExpansions("jilin").filter(card => !card.storage.jilin);
					const next = player.chooseToMove("戢鳞：是否交换“志”和手牌？");
					next.set("list", [
						[get.translation(player) + "（你）的未明之“志”", hidden],
						["手牌区", player.getCards("h")],
					]);
					next.set("filterMove", (from, to) => {
						return typeof to != "number";
					});
					next.set("processAI", list => {
						let player = get.player(),
							cards = list[0][1].concat(list[1][1]).sort(function (a, b) {
								return get.useful(a) - get.useful(b);
							}),
							cards2 = cards.splice(0, player.getExpansions("jilin").length);
						return [cards2, cards];
					});
					const { bool, moved } = await next.forResult();
					event.result = {
						bool: bool,
						cost_data: moved,
					};
				},
				async content(event, trigger, player) {
					const moved = event.cost_data;
					const pushs = moved[0],
						gains = moved[1];
					pushs.removeArray(player.getExpansions("jilin"));
					gains.removeArray(player.getCards("h"));
					if (!pushs.length || pushs.length != gains.length) {
						return;
					}
					const next = player.addToExpansion(pushs);
					next.gaintag.add("jilin");
					await next;
					await player.gain(gains, "draw");
				},
			},
		},
	},
	yingyou: {
		audio: 4,
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return player.countCards("h") && player.getExpansions("jilin").some(card => !card.storage.jilin);
		},
		async cost(event, trigger, player) {
			const hidden = player.getExpansions("jilin").filter(card => !card.storage.jilin);
			const suits = player
				.getExpansions("jilin")
				.filter(card => card.storage.jilin)
				.map(card => get.suit(card))
				.toUniqued();
			const { bool, links } = await player
				.chooseButton(["英猷：你可以明志", hidden])
				.set("ai", button => {
					const player = get.player(),
						card = button.link,
						suits = get.event().suits;
					const getNum = player => {
						var list = [];
						for (var i of lib.suit) {
							list.push(player.countCards("h", { suit: i }) + 3);
						}
						return list.sort((a, b) => b - a)[0];
					};
					if (!suits.includes(get.suit(card))) {
						return 10;
					}
					if (get.suit(card) == getNum(player)) {
						return 5;
					}
					return 0;
				})
				.set("suits", suits)
				.forResult();
			event.result = {
				bool: bool,
				cost_data: links,
			};
		},
		logAudio: () => 2,
		async content(event, trigger, player) {
			await player.showCards(event.cost_data, get.translation(player) + "发动了【英猷】");
			event.cost_data[0].storage.jilin = true;
			const num = player.getExpansions("jilin").filter(card => card.storage.jilin).length;
			await player.draw(num);
		},
		ai: {
			combo: "jilin",
		},
		group: "yingyou_draw",
		subSkill: {
			draw: {
				audio: ["yingyou3.mp3", "yingyou4.mp3"],
				trigger: {
					player: "loseAfter",
					global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
				},
				filter(event, player) {
					const suits = player
						.getExpansions("jilin")
						.filter(card => card.storage.jilin)
						.map(card => get.suit(card))
						.toUniqued();
					const evt = event.getl(player);
					if (!evt || !evt.cards2 || !evt.cards2.length) {
						return false;
					}
					return evt.cards2.some(card => {
						return suits.includes(get.suit(card, player));
					});
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					const suits = player
						.getExpansions("jilin")
						.filter(card => card.storage.jilin)
						.map(card => get.suit(card))
						.toUniqued();
					const num = trigger.getl(player).cards2.filter(card => {
						return suits.includes(get.suit(card, player));
					}).length;
					await player.draw(num);
				},
			},
		},
	},
	yingtian: {
		audio: 2,
		trigger: { global: "dieAfter" },
		filter(event, player) {
			return game.countGroup() < 3;
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		async content(event, trigger, player) {
			const skill = event.name;
			player.awakenSkill(skill);
			await player.changeSkills(get.info(skill).derivation, ["yingyou"]);
			player.addSkill(skill + "_effect");
		},
		derivation: ["reguicai", "rewansha", "lianpo"],
		subSkill: {
			effect: {
				mod: {
					targetInRange: () => true,
				},
			},
		},
	},
	changandajian_equip5: {
		equipSkill: true,
		mod: { maxHandcard: (player, num) => num + 2 },
	},
	changandajian_destroy: {
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		forced: true,
		charlotte: true,
		equipSkill: true,
		filter(event, player) {
			var evt = event.getl(player);
			if (!evt || !evt.es || !evt.es.length) {
				return false;
			}
			for (var i of evt.es) {
				if (i.name.indexOf("changandajian_equip") == 0) {
					return true;
				}
			}
			return false;
		},
		getEffect(player, target) {
			if (player == target) {
				return 0;
			}
			var getRaw = function () {
				var att = get.attitude(player, target);
				if (att > 0) {
					if (
						target.countCards("j", function (card) {
							var cardj = card.viewAs ? { name: card.viewAs } : card;
							return get.effect(target, cardj, target, player) < 0;
						}) > 0
					) {
						return 3;
					}
					if (target.getEquip("baiyin") && target.isDamaged() && get.recoverEffect(target, player, player) > 0) {
						if (target.hp == 1 && !target.hujia) {
							return 1.6;
						}
					}
					if (
						target.countCards("e", function (card) {
							if (get.position(card) == "e") {
								return get.value(card, target) < 0;
							}
						}) > 0
					) {
						return 1;
					}
				}
				var es = target.getCards("e");
				var noe = es.length == 0 || target.hasSkillTag("noe");
				var noe2 =
					es.filter(function (esx) {
						return get.value(esx, target) > 0;
					}).length == 0;
				if (noe || noe2) {
					return 0;
				}
				if (att <= 0 && !target.countCards("e")) {
					return 1.5;
				}
				return -1.5;
			};
			return getRaw() * get.attitude(player, target);
		},
		async content(event, trigger, player) {
			let time = 0;
			let recover = 0;
			const evt = trigger.getl(player);
			for (const card of evt.es) {
				if (card.name.indexOf("changandajian_equip") === 0) {
					time++;
				}
				if (card.name === "changandajian_equip2") {
					recover++;
				}
			}
			if (recover > 0) {
				await player.recover(recover);
			}

			for (let i = 0; i < time && game.hasPlayer(current => current.countCards("ej") > 0); i++) {
				let result = await player
					.chooseTarget(true, "选择一名装备区或判定区有牌的角色", (card, player, target) => target.countCards("ej") > 0)
					.set("ai", target => lib.skill.changandajian_destroy.getEffect(_status.event.player, target))
					.forResult();
				if (!result.bool) {
					return;
				}

				// @ts-expect-error 必然存在
				const target = result.targets[0];
				player.line(target, "green");
				result = await player.choosePlayerCard(target, true, "ej").forResult();
				if (!result.bool) {
					return;
				}

				// @ts-expect-error 必然存在
				const card = result.cards[0];
				const num = get.number(card);
				// @ts-expect-error 神秘类型
				if (typeof get.strNumber(num, false) === "string") {
					if (lib.filter.canBeGained(card, player, target)) {
						await player.gain(card, target, "give", "bySelf");
					}
				} else if (lib.filter.canBeDiscarded(card, player, target)) {
					await target.discard(card);
				}
			}
		},
	},
};
