import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rejiaozhaoSkills = {
	rejiaozhao: {
		audio: 2,
		enable: "phaseUse",
		group: "rejiaozhao_base",
		locked: false,
		mod: {
			targetEnabled(card, player, target) {
				if (player == target && card.storage && card.storage.rejiaozhao) {
					return false;
				}
			},
		},
		filter(event, player) {
			return player.hasMark("redanxin") && player.countCards("h") && player.getStorage("rejiaozhao_clear").length < player.countMark("redanxin");
		},
		chooseButton: {
			dialog(event, player) {
				var list = [],
					storage = player.getStorage("rejiaozhao_clear");
				for (var name of lib.inpile) {
					var type = get.type(name);
					if ((type == "basic" || type == "trick") && !storage.includes(type)) {
						list.push([type, "", name]);
						if (name == "sha") {
							for (var nature of lib.inpile_nature) {
								list.push([type, "", name, nature]);
							}
						}
					}
				}
				return ui.create.dialog("矫诏", [list, "vcard"]);
			},
			filter(button, player) {
				var card = { name: button.link[2], nature: button.link[3] };
				if (player.countMark("redanxin") < 2) {
					card.storage = { rejiaozhao: true };
				}
				var evt = _status.event.getParent();
				return evt.filterCard(card, player, evt);
			},
			check(button) {
				var card = { name: button.link[2], nature: button.link[3] },
					player = _status.event.player;
				if (player.countMark("redanxin") < 2) {
					card.storage = { rejiaozhao: true };
				}
				return player.getUseValue(card, null, true);
			},
			backup(links, player) {
				var next = {
					audio: "redanxin",
					viewAs: { name: links[0][2], nature: links[0][3] },
					filterCard: true,
					position: "h",
					popname: true,
					ai1: card => 8 - get.value(card),
					onuse(result, player) {
						player.addTempSkill("rejiaozhao_clear", "phaseUseAfter");
						player.markAuto("rejiaozhao_clear", [get.type(result.card)]);
					},
				};
				if (player.countMark("redanxin") < 2) {
					next.viewAs.storage = { rejiaozhao: true };
				}
				return next;
			},
			prompt(links) {
				return "将一张手牌当做" + (get.translation(links[0][3]) || "") + get.translation(links[0][2]) + "使用";
			},
		},
		ai: {
			order: 6,
			result: {
				player: 1,
			},
		},
		derivation: ["rejiaozhao_lv2", "rejiaozhao_lv3"],
		subSkill: {
			clear: { onremove: true },
			base: {
				audio: "rejiaozhao",
				enable: "phaseUse",
				usable: 1,
				filter(event, player) {
					if (player.hasMark("redanxin")) {
						return false;
					}
					return player.countCards("h") > 0 && game.hasPlayer(current => current != player);
				},
				filterCard: true,
				position: "h",
				discard: false,
				lose: false,
				check(card) {
					return 1 / Math.max(1, _status.event.player.getUseValue(card));
				},
				prompt: "出牌阶段限一次。你可以展示一张手牌，并令一名距离你最近的角色选择一种基本牌或普通锦囊牌的牌名。你可将此牌当做其声明的牌使用直到此阶段结束（你不是此牌的合法目标）。",
				async content(event, trigger, player) {
					const cards = event.cards;
					let result;

					// step 0
					player.showCards(cards);

					// step 1
					var targets = game.filterPlayer();
					targets.remove(player);
					targets.sort(function (a, b) {
						return Math.max(1, get.distance(player, a)) - Math.max(1, get.distance(player, b));
					});
					var distance = Math.max(1, get.distance(player, targets[0]));
					for (var i = 1; i < targets.length; i++) {
						if (Math.max(1, get.distance(player, targets[i])) > distance) {
							targets.splice(i);
							break;
						}
					}
					result = await player
						.chooseTarget("请选择【矫诏】的目标", true, function (card, player, target) {
							return _status.event.targets.includes(target);
						})
						.set("ai", function (target) {
							return get.attitude(_status.event.player, target);
						})
						.set("targets", targets)
						.forResult();

					// step 2
					if (!result.bool) {
						return;
					}
					var target = result.targets[0];
					event.target = target;
					var list = [];
					for (var i = 0; i < lib.inpile.length; i++) {
						var name = lib.inpile[i];
						if (name == "sha") {
							list.push(["基本", "", "sha"]);
							for (var j of lib.inpile_nature) {
								list.push(["基本", "", "sha", j]);
							}
						} else if (get.type(name) == "basic") {
							list.push(["基本", "", name]);
						} else if (get.type(name) == "trick") {
							list.push(["锦囊", "", name]);
						}
					}
					result = await target
						.chooseButton(["矫诏", [list, "vcard"]], true)
						.set("ai", function (button) {
							var player = _status.event.getParent().player,
								card = {
									name: button.link[2],
									nature: button.link[3],
									storage: {
										rejiaozhao: true,
									},
								};
							return player.getUseValue(card, null, true) * _status.event.att;
						})
						.set("att", get.attitude(event.target, player) > 0 ? 1 : -1)
						.forResult();

					// step 3
					var chosen = result.links[0][2];
					var nature = result.links[0][3];
					var fakecard = {
						name: chosen,
						storage: { rejiaozhao: true },
					};
					if (nature) {
						fakecard.nature = nature;
					}
					event.target.showCards(
						game.createCard({
							name: chosen,
							nature: nature,
							suit: cards[0].suit,
							number: cards[0].number,
						}),
						get.translation(event.target) + "声明了" + get.translation(chosen)
					);
					game.broadcastAll(
						(player, fakecard) => {
							player.storage.rejiaozhao_viewas = fakecard;
						},
						player,
						fakecard
					);
					cards[0].addGaintag("rejiaozhao");
					player.addTempSkill("rejiaozhao_viewas", "phaseUseEnd");
				},
				ai: {
					order: 9,
					result: {
						player: 1,
					},
				},
			},
			backup: { audio: "rejiaozhao" },
			viewas: {
				enable: "phaseUse",
				mod: {
					targetEnabled(card, player, target) {
						if (player == target && card.storage && card.storage.rejiaozhao) {
							return false;
						}
					},
				},
				filter(event, player) {
					if (!player.storage.rejiaozhao_viewas) {
						return false;
					}
					var cards = player.getCards("h", function (card) {
						return card.hasGaintag("rejiaozhao");
					});
					if (!cards.length) {
						return false;
					}
					if (!game.checkMod(cards[0], player, "unchanged", "cardEnabled2", player)) {
						return false;
					}
					var card = get.autoViewAs(player.storage.rejiaozhao_viewas, cards);
					return event.filterCard(card, player, event);
				},
				viewAs(cards, player) {
					return player.storage.rejiaozhao_viewas;
				},
				filterCard(card) {
					return card.hasGaintag("rejiaozhao");
				},
				selectCard: -1,
				position: "h",
				popname: true,
				prompt() {
					return "将“矫诏”牌当做" + get.translation(_status.event.player.storage.rejiaozhao_viewas) + "使用";
				},
				onremove(player) {
					player.removeGaintag("rejiaozhao");
					delete player.storage.rejiaozhao_viewas;
				},
				ai: { order: 8 },
			},
		},
	},
	redanxin: {
		audio: 2,
		trigger: { player: "damageEnd" },
		frequent: true,
		async content(event, trigger, player) {
			await player.draw();
			if (player.countMark("redanxin") < 2) {
				player.addMark("redanxin", 1, false);
			}
		},
		intro: { content: "当前升级等级：Lv#" },
		ai: {
			maixie: true,
			effect: {
				target: (card, player, target) => {
					if (!get.tag(card, "damage")) {
						return;
					}
					if (target.hp + target.hujia < 2 || player.hasSkillTag("jueqing", false, target)) {
						return 2;
					}
					if (!target.hasSkill("rejiaozhao") || target.countMark("redanxin") > 1) {
						return [1, 1];
					}
					return [1, 0.8 * target.hp - 0.4];
				},
			},
		},
	},
	//马岱
	reqianxi: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		frequent: true,
		async content(event, trigger, player) {
			let result;
			await player.draw();
			if (
				player.hasCard(card => {
					return lib.filter.cardDiscardable(card, player, "reqianxi");
				}, "he")
			) {
				result = await player
					.chooseToDiscard("he", true)
					.set("ai", card => {
						let player = get.event().player;
						if (get.color(card, player)) {
							return 7 - get.value(card, player);
						}
						return 4 - get.value(card, player);
					})
					.forResult();
			} else {
				return;
			}
			if (result.bool && game.hasPlayer(current => current != player && get.distance(player, current) <= 1)) {
				var selectedColor = get.color(result.cards[0], player);
				var color = get.translation(selectedColor);
				result = await player
					.chooseTarget(true, "选择【潜袭】的目标", "令其本回合不能使用或打出" + color + "牌，且" + color + "防具失效，且回复体力时，你摸两张牌", function (card, player, target) {
						return target != player && get.distance(player, target) <= 1;
					})
					.set("ai", function (target) {
						return -get.attitude(_status.event.player, target) * Math.sqrt(1 + target.countCards("he"));
					})
					.forResult();
			} else {
				return;
			}
			if (result.bool) {
				var target = result.targets[0];
				player.line(target, "green");
				target.storage.reqianxi_effect = [selectedColor, player];
				target.addTempSkill("reqianxi_effect");
				target.markSkill("reqianxi_effect");
			}
		},
		subSkill: {
			effect: {
				mark: true,
				intro: {
					markcount: () => 0,
					content(storage, player) {
						var color = get.translation(storage[0]),
							source = get.translation(storage[1]);
						return "本回合不能使用或打出" + color + "牌，且" + color + "防具失效，且回复体力时，" + source + "摸两张牌";
					},
				},
				charlotte: true,
				onremove: true,
				mod: {
					cardEnabled2(card, player) {
						if (get.itemtype(card) == "card" && get.color(card) == player.getStorage("reqianxi_effect")[0]) {
							return false;
						}
					},
				},
				trigger: { player: "recoverEnd" },
				forced: true,
				popup: false,
				filter(event, player) {
					return player.storage.reqianxi_effect && player.storage.reqianxi_effect[1].isIn();
				},
				async content(event, trigger, player) {
					const target = player.storage.reqianxi_effect[1];
					target.logSkill("reqianxi", player);
					await target.draw(2);
				},
				ai: {
					unequip2: true,
					skillTagFilter(player) {
						var evt = _status.event,
							color = player.getStorage("reqianxi_effect")[0];
						if (evt.name == "lose" && evt.loseEquip) {
							var card = evt.cards[evt.num];
							if (card && get.subtype(card, false) == "equip2" && get.color(card) == color) {
								return true;
							}
							return false;
						} else {
							var equip = player.getEquip(2);
							if (equip && get.color(equip) == color) {
								return true;
							}
							return false;
						}
					},
				},
			},
		},
	},
	//徐晃
	olduanliang: {
		audio: 2,
		locked: false,
		enable: "chooseToUse",
		filterCard(card) {
			return get.type2(card) != "trick" && get.color(card) == "black";
		},
		filter(event, player) {
			return player.hasCard(card => get.type2(card) != "trick" && get.color(card) == "black", "hes");
		},
		position: "hes",
		viewAs: { name: "bingliang" },
		prompt: "将一张黑色非锦囊牌当做兵粮寸断使用",
		check(card) {
			return 6 - get.value(card);
		},
		ai: {
			order: 9,
		},
		mod: {
			targetInRange(card, player, target) {
				if (card.name == "bingliang" && !player.getStat("damage")) {
					return true;
				}
			},
		},
	},
	oljiezi: {
		audio: 2,
		trigger: { global: ["phaseDrawSkipped", "phaseDrawCancelled"] },
		direct: true,
		async content(event, trigger, player) {
			let result = await player
				.chooseTarget(get.prompt("oljiezi"), "你可选择一名角色。若该角色：手牌数为全场最少且没有“辎”，则其获得一枚“辎”。否则其摸一张牌。")
				.set("ai", function (target) {
					var att = get.attitude(_status.event.player, target);
					if (!target.hasMark("oljiezi") && target.isMinHandcard()) {
						att *= 2;
					}
					return att;
				})
				.forResult();
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("oljiezi", target);
				if (!target.hasMark("oljiezi") && target.isMinHandcard()) {
					target.addMark("oljiezi", 1);
				} else {
					target.draw();
				}
			}
		},
		marktext: "辎",
		intro: {
			name2: "辎",
			content: "mark",
			onunmark: true,
		},
		group: "oljiezi_extra",
		subSkill: {
			extra: {
				audio: "oljiezi",
				trigger: { global: "phaseDrawAfter" },
				forced: true,
				filter(event, player) {
					return event.player.hasMark("oljiezi");
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const evt = trigger.getParent("phase", true, true);
					if (evt?.phaseList) {
						evt.phaseList.splice(evt.num + 1, 0, "phaseDraw|oljiezi");
					}
					trigger.player.removeMark("oljiezi", trigger.player.countMark("oljiezi"));
				},
			},
		},
	},
};
