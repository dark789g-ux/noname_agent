import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twyanhuo" | "twshenxing" | "twdaoji" | "xinzhenjun" | "twmoukui" | "twfuhan" | "twqueshi">} */
export const groupSkills = {
	twyanhuo: {
		audio: "yanhuo",
		trigger: { player: "die" },
		direct: true,
		forceDie: true,
		skillAnimation: true,
		animationColor: "thunder",
		filter(event, player) {
			return (
				player.countCards("he") > 0 &&
				game.hasPlayer(function (current) {
					return current != player && current.countCards("h") > 0;
				})
			);
		},
		content() {
			"step 0";
			var num = player.countCards("he"),
				str = get.cnNumber(num);
			event.num1 = num;
			event.num2 = 1;
			var list = ["令一名其他角色弃置" + str + "张牌"];
			if (num > 1) {
				list.push("令至多" + str + "名其他角色各弃置一张牌");
			}
			player.chooseControl("cancel2").set("choiceList", list).set("prompt", get.prompt("twyanhuo")).set("forceDie", true);
			"step 1";
			if (result.control != "cancel2") {
				if (result.index == 0) {
					event.num2 = event.num1;
					event.num1 = 1;
				}
				player
					.chooseTarget([1, event.num1], true, "请选择【延祸】的目标", function (card, player, target) {
						return target != player && target.countCards("he") > 0;
					})
					.set("forceDie", true)
					.set("ai", function (target) {
						return -get.attitude(_status.event.player, target);
					});
			} else {
				event.finish();
			}
			"step 2";
			if (result.bool) {
				var targets = result.targets.sortBySeat();
				player.logSkill("twyanhuo", targets);
				for (var i of targets) {
					i.chooseToDiscard(true, "he", event.num2);
				}
			}
		},
	},
	twshenxing: {
		mod: {
			globalFrom(player, target, distance) {
				var es = player.getCards("e", function (card) {
					return !ui.selected.cards.includes(card);
				});
				for (var i of es) {
					var type = get.subtype(i);
					if (type == "equip3" || type == "equip4" || type == "equip6") {
						return distance;
					}
				}
				return distance - 1;
			},
			maxHandcard(player, distance) {
				var es = player.getCards("e", function (card) {
					return !ui.selected.cards.includes(card);
				});
				for (var i of es) {
					var type = get.subtype(i);
					if (type == "equip3" || type == "equip4" || type == "equip6") {
						return distance;
					}
				}
				return distance + 1;
			},
		},
	},
	twdaoji: {
		audio: "daoji",
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.hasCard(lib.skill.twdaoji.filterCard, "he");
		},
		filterCard(card) {
			return get.type(card) != "basic";
		},
		position: "he",
		filterTarget(card, player, target) {
			return target != player && player.inRange(target) && target.hasCard(card => lib.filter.canBeGained(card, target, player), "he");
		},
		check(card) {
			return 8 - get.value(card);
		},
		content() {
			"step 0";
			player.gainPlayerCard(target, "he", true);
			"step 1";
			if (result.bool && result.cards && result.cards.length == 1) {
				var card = result.cards[0];
				if (player.getCards("h").includes(card)) {
					var type = get.type(card);
					if (type == "basic") {
						player.draw();
					} else if (type == "equip") {
						if (player.hasUseTarget(card)) {
							player.chooseUseTarget(card, "nopopup", true);
						}
						target.damage("nocard");
					}
				}
			}
		},
		ai: {
			order: 6,
			result: {
				target(player, target) {
					var eff = get.effect(target, { name: "shunshou_copy2" }, player, target);
					if (target.countCards("e") > 0) {
						eff += get.damageEffect(target, player, target);
					}
					return eff;
				},
			},
		},
	},
	xinzhenjun: {
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		direct: true,
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		content() {
			"step 0";
			player.chooseCardTarget({
				filterCard: true,
				filterTarget: lib.filter.notMe,
				position: "he",
				prompt: get.prompt2("xinzhenjun"),
				ai1(card) {
					var player = _status.event.player;
					if (card.name == "sha" && get.color(card) == "red") {
						for (var i = 0; i < game.players.length; i++) {
							var current = game.players[i];
							if (current != player && get.attitude(player, current) > 0 && current.hasValueTarget(card)) {
								return 7;
							}
						}
						return 0;
					}
					return 7 - get.value(card);
				},
				ai2(target) {
					var player = _status.event.player;
					var card = ui.selected.cards[0];
					var att = get.attitude(player, target);
					if (get.value(card) < 0) {
						return -att * 2;
					}
					if (
						target.countCards("h", { name: "sha", color: "red" }) ||
						target.hasSkill("wusheng") ||
						target.hasSkill("new_rewusheng") ||
						target.hasSkill("wushen") ||
						(card.name == "sha" && get.color(card) == "red" && target.hasValueTarget(card))
					) {
						return att * 2;
					}
					var eff = 0;
					game.countPlayer(function (current) {
						if (target != current && get.distance(target, current, "attack") > 1) {
							return;
						}
						var eff2 = get.damageEffect(current, player, player);
						if (eff2 > eff) {
							eff = eff2;
						}
					});
					if (att > 0 && eff > 0) {
						eff += 2 * att;
					}
					return eff;
				},
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("xinzhenjun", target);
				player.give(result.cards, target);
			} else {
				event.finish();
			}
			"step 2";
			target.chooseToUse({
				filterCard(card) {
					return get.name(card) == "sha" && get.color(card) != "black" && lib.filter.cardEnabled.apply(this, arguments);
				},
				prompt: "请使用一张不为黑色的【杀】，否则" + get.translation(player) + "可以对你或你攻击范围内的一名其他角色造成1点伤害",
			});
			"step 3";
			if (result.bool) {
				var num = 1;
				game.countPlayer2(function (current) {
					current.getHistory("damage", function (evt) {
						if (evt.getParent(evt.notLink() ? 4 : 8) == event) {
							num += evt.num;
						}
					});
				});
				player.draw(num);
				event.finish();
			} else {
				player
					.chooseTarget("是否对" + get.translation(target) + "或其攻击范围内的一名角色造成1点伤害？", function (card, player, target) {
						return target == _status.event.targetx || _status.event.targetx.inRange(target);
					})
					.set("targetx", event.target).ai = function (target) {
					var player = _status.event.player;
					return get.damageEffect(target, player, player);
				};
			}
			"step 4";
			if (result.bool) {
				player.line(result.targets);
				result.targets[0].damage("nocard");
			}
		},
	},
	twmoukui: {
		audio: "moukui",
		trigger: { player: "useCardToPlayered" },
		direct: true,
		preHidden: true,
		filter(event, player) {
			return event.card && event.card.name == "sha";
		},
		content() {
			"step 0";
			var list = ["选项一"];
			if (trigger.target.countDiscardableCards(player, "he") > 0) {
				list.push("选项二");
			}
			list.push("背水！");
			list.push("cancel2");
			player
				.chooseControl(list)
				.set("choiceList", [
					"摸一张牌",
					"弃置" + get.translation(trigger.target) + "的一张牌",
					"背水！依次执行以上两项。然后若此【杀】未令其进入濒死状态，则其弃置你的一张牌。",
				])
				.set("prompt", get.prompt("twmoukui", trigger.target))
				.setHiddenSkill("twmoukui");
			"step 1";
			if (result.control != "cancel2") {
				var target = trigger.target;
				player.logSkill("twmoukui", target);
				if (result.control == "选项一" || result.control == "背水！") {
					player.draw();
				}
				if (result.control == "选项二" || result.control == "背水！") {
					player.discardPlayerCard(target, true, "he");
				}
				if (result.control == "背水！") {
					player.addTempSkill("twmoukui_effect");
					var evt = trigger.getParent();
					if (!evt.twmoukui_effect) {
						evt.twmoukui_effect = [];
					}
					evt.twmoukui_effect.add(target);
				}
			}
		},
		subSkill: {
			effect: {
				trigger: { player: "useCardAfter" },
				charlotte: true,
				forced: true,
				filter(event, player) {
					return (
						event.twmoukui_effect &&
						event.twmoukui_effect.filter(function (current) {
							return (
								current.isIn() &&
								!current.hasHistory("damage", function (evt) {
									return evt._dyinged && evt.card == event.card;
								})
							);
						}).length > 0
					);
				},
				content() {
					var list = trigger.twmoukui_effect
						.filter(function (current) {
							return (
								current.isIn() &&
								!current.hasHistory("damage", function (evt) {
									return evt._dyinged && evt.card == trigger.card;
								})
							);
						})
						.sortBySeat();
					for (var i of list) {
						i.discardPlayerCard(player, true, "he").boolline = true;
					}
				},
			},
		},
	},
	//TW赵襄
	twfuhan: {
		audio: "fuhan",
		trigger: { player: "phaseZhunbeiBegin" },
		limited: true,
		skillAnimation: true,
		animationColor: "orange",
		filter(event, player) {
			return player.countMark("fanghun") > 0;
		},
		prompt(event, player) {
			var num = Math.max(2, player.storage.fanghun);
			num = Math.min(num, 8);
			return get.prompt("twfuhan") + "（体力上限：" + num + "）";
		},
		check(event, player) {
			if (player.storage.fanghun >= Math.min(4, player.maxHp)) {
				return true;
			}
			if (player.hp <= 2 && player.storage.fanghun >= 3) {
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			let num = Math.max(2, player.storage.fanghun);
			num = Math.min(num, 8);
			player.removeMark("fanghun", player.storage.fanghun);
			player.awakenSkill(event.name);
			let list = [];
			if (_status.characterlist) {
				for (let i = 0; i < _status.characterlist.length; i++) {
					var name = _status.characterlist[i];
					if (lib.character[name][1] == "shu") {
						list.push(name);
					}
				}
			} else if (_status.connectMode) {
				list = get.charactersOL(function (i) {
					return lib.character[i][1] != "shu";
				});
			} else {
				list = get.gainableCharacters(function (info) {
					return info[1] == "shu";
				});
			}
			var players = game.players.concat(game.dead);
			for (var i = 0; i < players.length; i++) {
				list.remove(players[i].name);
				list.remove(players[i].name1);
				list.remove(players[i].name2);
			}
			list.remove("zhaoxiang");
			const result = await player.chooseButton(["扶汉：选择获得一张武将牌上的所有技能", [list.randomGets(5), "character"]], true).forResult();
			if (result?.links) {
				var name = result.links[0];
				player.flashAvatar("twhuashen", name);
				game.log(player, "获得了", "#y" + get.translation(name), "的所有技能");
				await player.addSkills(lib.character[name][3]);
			}
			num = num - player.maxHp;
			if (num > 0) {
				await player.gainMaxHp(num);
			} else {
				await player.loseMaxHp(-num);
			}
			await player.recover();
			var card = get.cardPile("meiyingqiang", "field");
			if (card) {
				await player.gain(card, "gain2", "log");
			}
		},
		ai: { combo: "refanghun" },
	},
	twqueshi: {
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		locked: false,
		filter(event, player) {
			return (event.name != "phase" || game.phaseNumber == 0) && player.hasEquipableSlot(1);
		},
		content() {
			if (!lib.inpile.includes("meiyingqiang")) {
				lib.inpile.push("meiyingqiang");
				player.equip(game.createCard("meiyingqiang", "diamond", 12));
			} else {
				const card = get.cardPile(function (card) {
					return card.name == "meiyingqiang" && !player.getEquips(1).includes(card);
				}, "field");
				if (card) {
					player.equip(card);
				}
			}
		},
	},
};
