import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "rezhongjian" | "recaishi" | "shiyuan" | "dushi" | "dushi2" | "yuwei" | "refenyin" | "liji">} */
export const groupSkills = {
	//辛宪英
	rezhongjian: {
		enable: "phaseUse",
		audio: "zhongjian",
		usable(skill, player) {
			return 1 + (player.hasSkill(skill + "_rewrite", null, null, false) ? 1 : 0);
		},
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.rezhongjian.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			if (!player.storage.rezhongjian_effect) {
				return true;
			}
			return !player.storage.rezhongjian_effect[0]?.includes(target) && !player.storage.rezhongjian_effect[1]?.includes(target);
		},
		line: false,
		log: "notarget",
		async content(event, trigger, player) {
			const { target } = event;
			const result = await player
				.chooseControl()
				.set("prompt", "忠鉴：为" + get.translation(target) + "选择获得一项效果")
				.set("choiceList", ["令其于下回合开始前首次造成伤害后弃置两张牌", "令其于下回合开始前首次受到伤害后摸两张牌"])
				.set("ai", () => {
					const player = get.player();
					const { target } = get.event().getParent();
					return get.attitude(player, target) > 0 ? 1 : 0;
				})
				.forResult();
			if (typeof result?.index !== "number") {
				return;
			}
			const skill = `${event.name}_effect`;
			player.addTempSkill(skill, { player: "phaseBeginStart" });
			player.storage[skill][result.index].push(target);
			player.markSkill(skill);
		},
		ai: {
			order: 10,
			expose: 0,
			result: {
				player(player, target) {
					if (get.attitude(player, target) == 0) {
						return false;
					}
					var sgn = get.sgn((get.realAttitude || get.attitude)(player, target));
					if (
						game.countPlayer(function (current) {
							return get.sgn((get.realAttitude || get.attitude)(player, current)) == sgn;
						}) <=
						game.countPlayer(function (current) {
							return get.sgn((get.realAttitude || get.attitude)(player, current)) != sgn;
						})
					) {
						return 1;
					}
					return 0.9;
				},
			},
		},
		subSkill: {
			rewrite: { charlotte: true },
			effect: {
				init(player, skill) {
					player.storage[skill] ??= [[], []];
				},
				charlotte: true,
				onremove: true,
				trigger: { global: ["damageSource", "damageEnd"] },
				filter(event, player, name) {
					const index = name == "damageSource" ? 0 : 1;
					const target = name == "damageSource" ? event.source : event.player;
					return target?.isIn() && player.storage["rezhongjian_effect"][index].includes(target);
				},
				forced: true,
				logTarget(event, player, name) {
					return name == "damageSource" ? event.source : event.player;
				},
				async content(event, trigger, player) {
					const [target] = event.targets;
					const index = event.triggername == "damageSource" ? 0 : 1;
					const storage = player.storage[event.name];
					storage[index].remove(target);
					if (storage[0].length + storage[1].length) {
						player.markSkill(event.name);
					} else {
						player.removeSkill(event.name);
					}
					await target[event.triggername == "damageSource" ? "chooseToDiscard" : "draw"](2, true, "he");
					await player.draw();
				},
				intro: {
					markcount(storage) {
						if (!storage) {
							return 0;
						}
						return storage[0].length + storage[1].length;
					},
					mark(dialog, storage, player) {
						if (!storage) {
							return "尚未选择";
						}
						if (player == game.me || player.isUnderControl()) {
							if (storage?.[0]?.length) {
								dialog.addText("弃牌");
								dialog.add([storage[0], "player"]);
							}
							if (storage?.[1]?.length) {
								dialog.addText("摸牌");
								dialog.add([storage[1], "player"]);
							}
						} else {
							dialog.addText(`${get.translation(player)}共选择了${get.cnNumber(storage[0].length + storage[1].length)} 人`);
						}
					},
				},
			},
		},
	},
	recaishi: {
		isSame(event) {
			const cards = [];
			event.player.getHistory("gain", function (evt) {
				if (evt.getParent().name == "draw" && evt.getParent("phaseDraw") == event) {
					cards.addArray(evt.cards);
				}
			});
			if (!cards.length) {
				return "nogain";
			}
			const list = cards.map(card => get.suit(card)).toUniqued();
			if (list.length == 1) {
				return true;
			}
			if (list.length == cards.length) {
				return false;
			}
			return "nogain";
		},
		audio: "caishi",
		trigger: { player: "phaseDrawEnd" },
		filter(event, player) {
			const isSame = lib.skill.recaishi.isSame(event);
			if (isSame == "nogain") {
				return false;
			}
			return isSame || player.isDamaged();
		},
		async cost(event, trigger, player) {
			const isSame = lib.skill.recaishi.isSame(trigger);
			if (isSame) {
				event.result = {
					bool: true,
					cost_data: "rewrite",
				};
			} else if (player.isDamaged()) {
				event.result = await player
					.chooseBool(get.prompt(event.skill), "回复1点体力，然后本回合内不能对自己使用牌")
					.set(
						"choice",
						(() => {
							if (player.countCards("h", "tao")) {
								return false;
							}
							if (player.hp < 2) {
								return true;
							}
							return (
								player.countCards("h", card => {
									const info = get.info(card);
									return info && (info.toself || info.selectTarget == -1) && player.canUse(card, player) && player.getUseValue(card) > 0;
								}) == 0
							);
						})()
					)
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (event.cost_data === "rewrite") {
				player.addTempSkill("rezhongjian_rewrite");
			} else {
				await player.recover();
				player.addTempSkill(event.name + "_effect");
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				mark: true,
				intro: { content: "本回合内不能对自己使用牌" },
				mod: {
					targetEnabled(card, player, target) {
						if (player == target) {
							return false;
						}
					},
				},
			},
		},
	},
	//刘辩
	shiyuan: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		frequent: true,
		filter(event, player) {
			var num = 1;
			if (_status.currentPhase && _status.currentPhase != player && _status.currentPhase.group == "qun" && player.hasZhuSkill("yuwei", _status.currentPhase)) {
				num = 2;
			}
			return (
				player != event.player &&
				player.getHistory("gain", function (evt) {
					return evt.getParent(2).name == "shiyuan" && evt.cards.length == 2 + get.sgn(event.player.hp - player.hp);
				}).length < num
			);
		},
		content() {
			player.draw(2 + get.sgn(trigger.player.hp - player.hp));
		},
		ai: {
			effect: {
				target_use(card, player, target) {
					if (get.itemtype(player) !== "player" || player === target) {
						return 1;
					}
					let num = 1,
						ds = 2 + get.sgn(player.hp - target.hp);
					if (player === _status.currentPhase && _status.currentPhase?.group === "qun" && target.hasZhuSkill("yuwei", player)) {
						num = 2;
					}
					if (
						target.getHistory("gain", function (evt) {
							return evt.getParent(2).name === "shiyuan" && evt.cards.length === ds;
						}).length >= num
					) {
						return 1;
					}
					let name = get.name(card);
					if (get.tag(card, "lose") || name === "huogong" || name === "juedou" || name === "tiesuo") {
						return [1, ds];
					}
					if (!target.hasFriend()) {
						return 1;
					}
					return [1, 0.5 * ds];
				},
			},
		},
	},
	dushi: {
		audio: 2,
		global: "dushi2",
		locked: true,
		trigger: { player: "die" },
		forceDie: true,
		direct: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		content() {
			"step 0";
			player
				.chooseTarget("请选择【毒逝】的目标", "选择一名其他角色，令其获得技能【毒逝】", true, lib.filter.notMe)
				.set("forceDie", true)
				.set("ai", function (target) {
					return -get.attitude(_status.event.player, target);
				});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("dushi", target);
				target.markSkill("dushi");
				target.addSkills("dushi");
			}
		},
		intro: { content: "您已经获得弘农王的诅咒" },
	},
	dushi2: {
		mod: {
			cardSavable(card, player, target) {
				if (card.name == "tao" && target != player && target.hasSkill("dushi")) {
					return false;
				}
			},
		},
	},
	yuwei: {
		trigger: { player: "shiyuanBegin" },
		filter(event, player) {
			return _status.currentPhase && _status.currentPhase.group == "qun";
		},
		zhuSkill: true,
		forced: true,
		content() {},
		ai: { combo: "shiyuan" },
	},
	//新岩泽(划掉)留赞
	refenyin: {
		audio: 2,
		audioname: ["wufan"],
		trigger: { global: ["loseAfter", "cardsDiscardAfter", "loseAsyncAfter", "equipAfter"] },
		forced: true,
		filter(event, player) {
			if (player != _status.currentPhase) {
				return false;
			}
			var cards = event.getd();
			if (!cards.length) {
				return false;
			}
			var list = [];
			var num = cards.length;
			for (var i = 0; i < cards.length; i++) {
				var card = cards[i];
				list.add(get.suit(card, false));
			}
			game.getGlobalHistory("cardMove", function (evt) {
				if (evt.name != "lose" && evt.name != "cardsDiscard") {
					return false;
				}
				if (evt.name == "lose" && evt.position != ui.discardPile) {
					return false;
				}
				if (evt == event || evt.getParent() == event) {
					return false;
				}
				num += evt.cards.length;
				for (var i = 0; i < evt.cards.length; i++) {
					var card = evt.cards[i];
					list.remove(get.suit(card, evt.cards2 && evt.cards2.includes(card) ? evt.player : false));
				}
			});
			player.storage.refenyin_mark2 = num;
			return list.length > 0;
		},
		content() {
			var list = [];
			var list2 = [];
			var cards = trigger.getd();
			for (var i = 0; i < cards.length; i++) {
				var card = cards[i];
				var suit = get.suit(card, false);
				list.add(suit);
				list2.add(suit);
			}
			game.getGlobalHistory("cardMove", function (evt) {
				if (evt.name != "lose" && evt.name != "cardsDiscard") {
					return false;
				}
				if (evt.name == "lose" && evt.position != ui.discardPile) {
					return false;
				}
				if (evt == trigger || evt.getParent() == trigger) {
					return false;
				}
				for (var i = 0; i < evt.cards.length; i++) {
					var card = evt.cards[i];
					var suit = get.suit(card, false);
					list.remove(suit);
					list2.add(suit);
				}
			});
			list2.sort();
			player.draw(list.length);
			player.storage.refenyin_mark = list2;
			player.addTempSkill("refenyin_mark");
			player.markSkill("refenyin_mark");
		},
		subSkill: {
			mark: {
				charlotte: true,
				onremove(player) {
					delete player.storage.refenyin_mark;
					delete player.storage.refenyin_mark2;
				},
				intro: {
					content(s, p) {
						var str = "本回合已经进入过弃牌堆的卡牌的花色：";
						for (var i = 0; i < s.length; i++) {
							str += get.translation(s[i]);
						}
						str += "<br>本回合进入过弃牌堆的牌数：";
						str += p.storage.refenyin_mark2;
						return str;
					},
				},
			},
		},
	},
	liji: {
		enable: "phaseUse",
		usable(skill, player) {
			return get.event().liji_num;
		},
		audio: 2,
		onChooseToUse(event) {
			if (game.online) {
				return;
			}
			var num = 0;
			var evt2 = event.getParent();
			if (!evt2.liji_all) {
				evt2.liji_all = game.players.length > 4 ? 8 : 4;
			}
			game.getGlobalHistory("cardMove", function (evt) {
				if (evt.name == "cardsDiscard" || (evt.name == "lose" && evt.position == ui.discardPile)) {
					num += evt.cards.length;
				}
			});
			event.set("liji_num", Math.floor(num / evt2.liji_all));
		},
		filterCard: true,
		position: "he",
		check(card) {
			var val = get.value(card);
			if (!_status.event.player.getStorage("refenyin_mark").includes(get.suit(card))) {
				return 12 - val;
			}
			return 8 - val;
		},
		filterTarget: lib.filter.notMe,
		content() {
			target.damage("nocard");
		},
		ai: {
			order: 1,
			result: {
				target: -1.5,
			},
			tag: {
				damage: 1,
			},
		},
	},
};
