import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twzhuidu" | "twshigong" | "twmibei" | "twxingqi" | "twmouli">} */
export const groupSkills = {
	//刘夫人
	twzhuidu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return current != player && current.isDamaged();
			});
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			return target.isDamaged();
		},
		chooseButton: {
			dialog(event, player) {
				var name = get.translation(event.result.targets[0]);
				var dialog = ui.create.dialog("追妒：选择一项", "hidden");
				dialog.add([
					[
						["damage", "对" + name + "造成1点伤害"],
						["discard", "弃置" + name + "装备区里的一张牌"],
						["both", "背水！若该角色为女性，弃置一张牌，然后依次执行以上所有选项"],
					],
					"textbutton",
				]);
				return dialog;
			},
			filter(button, player) {
				var target = _status.event.getParent().result.targets[0];
				var link = button.link;
				if (link == "damage") {
					return true;
				}
				if (link == "discard") {
					return target.countCards("e");
				}
				return target.hasSex("female") && player.countDiscardableCards(player, "he") > 0;
			},
			check(button) {
				switch (button.link) {
					case "damage":
						return 10;
					case "discard":
						return 1;
					case "both":
						return 15;
				}
			},
			backup(links) {
				var backup = {
					audio: "twzhuidu",
					target: _status.event.result.targets[0],
					choice: links[0],
					filterTarget(card, player, target) {
						return target == lib.skill.twzhuidu_backup.target;
					},
					selectTarget: -1,
					async content(event, trigger, player) {
						const { target, choice } = lib.skill.twzhuidu_backup;
						if (choice != "discard") {
							await target.damage();
						}
						if (choice != "damage") {
							await player.discardPlayerCard(target, "e", true);
						}
						if (choice == "both") {
							await player.chooseToDiscard("he", true);
						}
					},
				};
				return backup;
			},
			prompt(links) {
				var name = get.translation(_status.event.result.targets[0]);
				switch (links[0]) {
					case "damage":
						return "对" + name + "造成1点伤害";
					case "discard":
						return "弃置" + name + "装备区里的一张牌";
					case "both":
						return "背水！弃置一张牌，然后对" + name + "造成1点伤害并弃置其装备区里的一张牌";
				}
			},
		},
		subSkill: {
			backup: {},
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					if (target.hasSex("female") && target.countCards("e") && player.countCards("he")) {
						return -2;
					}
					return -1;
				},
			},
		},
	},
	twshigong: {
		audio: 2,
		trigger: { player: "dying" },
		filter(event, player) {
			var target = _status.currentPhase;
			return player.hp <= 0 && target && target.isIn() && target != player;
		},
		skillAnimation: true,
		animationColor: "gray",
		limited: true,
		logTarget(event, player) {
			return _status.currentPhase;
		},
		content() {
			"step 0";
			player.awakenSkill(event.name);
			var target = _status.currentPhase;
			if (target.hp <= 0) {
				event._result = { bool: false };
			} else {
				target
					.chooseToDiscard(
						"h",
						target.hp,
						get.translation(player) + "对你发动了【示恭】，是否弃置" + get.cnNumber(target.hp) + "张手牌？",
						"若如此做，其将体力回复至1点；或者点击“取消”加1点体力上限并回复1点体力，摸一张牌，然后其将体力回复至体力上限"
					)
					.set("ai", card => {
						if (!_status.event.goon) {
							return 0;
						}
						return 7 - get.value(card);
					})
					.set("goon", get.attitude(target, player) >= 0);
			}
			"step 1";
			var target = _status.currentPhase;
			if (result.bool) {
				var num = 1 - player.hp;
				if (num > 0) {
					player.recover(num);
				}
				event.finish();
			} else {
				target.gainMaxHp();
				target.recover();
				target.draw();
			}
			"step 2";
			var num = player.maxHp - player.hp;
			if (num > 0) {
				player.recover(num);
			}
		},
	},
	//王凌
	twmibei: {
		audio: "mibei",
		trigger: { player: "useCardAfter" },
		group: ["twmibei_mark", "twmibei_fail"],
		forced: true,
		locked: false,
		direct: true,
		dutySkill: true,
		derivation: "twmouli",
		filter(event, player) {
			var map = { basic: 0, trick: 0, equip: 0 };
			for (var name of player.getStorage("twmibei")) {
				var type = get.type2(name);
				if (typeof map[type] == "number") {
					map[type]++;
				}
			}
			for (var i in map) {
				if (map[i] < 2) {
					return false;
				}
			}
			return true;
		},
		logAudio: () => "mibei1.mp3",
		skillAnimation: true,
		animationColor: "water",
		content() {
			player.awakenSkill("twmibei");
			game.log(player, "成功完成使命");
			player.addSkills("twmouli");
		},
		intro: { content: "已使用牌名：$" },
		subSkill: {
			mark: {
				trigger: { player: "useCard1" },
				filter(event, player) {
					return !player.getStorage("twmibei").includes(event.card.name);
				},
				charlotte: true,
				forced: true,
				silent: true,
				dutySkill: true,
				content() {
					player.markAuto("twmibei", [trigger.card.name]);
				},
			},
			fail: {
				audio: "mibei2.mp3",
				trigger: { player: "phaseUseEnd" },
				forced: true,
				filter(event, player) {
					return !player.getHistory("useCard").length;
				},
				content() {
					game.log(player, "使命失败");
					delete player.storage.twmibei;
					player.addTempSkill("twmibei_less");
					player.addMark("twmibei_less", 1, false);
				},
			},
			less: {
				charlotte: true,
				marktext: "缚",
				intro: { content: "本回合手牌上限-#" },
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("twmibei_less");
					},
				},
			},
		},
	},
	twxingqi: {
		audio: "xingqi",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			var num = 0;
			game.countPlayer(function (current) {
				num += current.countCards("ej");
			});
			return num > player.hp;
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "thunder",
		content() {
			player.awakenSkill(event.name);
			player.recover();
			if (!player.awakenedSkills.includes("twmibei")) {
				var list = ["basic", "equip", "trick"],
					cards = [];
				for (var i of list) {
					var card = get.cardPile2(function (card) {
						return get.type(card) == i;
					});
					if (card) {
						cards.push(card);
					}
				}
				if (cards.length) {
					player.gain(cards, "gain2");
				}
			} else {
				player.addSkill("twxingqi_range");
			}
		},
		subSkill: {
			range: {
				charlotte: true,
				mark: true,
				marktext: "启",
				mod: {
					targetInRange: () => true,
				},
				intro: { content: "使用牌无距离限制" },
			},
		},
	},
	twmouli: {
		audio: "mouli",
		enable: "chooseToUse",
		filter(event, player) {
			if (event.type == "wuxie") {
				return false;
			}
			if (player.hasSkill("twmouli_used")) {
				return false;
			}
			if (!Array.isArray(event.twmouli)) {
				return false;
			}
			for (var card of event.twmouli) {
				if (event.filterCard(card, player, event)) {
					return true;
				}
			}
			return false;
		},
		onChooseToUse(event) {
			if (game.online || !event.player.hasSkill("twmouli")) {
				return;
			}
			var cards = [];
			for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
				var card = ui.cardPile.childNodes[i];
				if (get.type(card, null, false) == "basic") {
					cards.push(card);
				}
			}
			event.set("twmouli", cards);
		},
		chooseButton: {
			dialog(event, player) {
				var dialog = ui.create.dialog("谋立", "hidden");
				if (event.twmouli && event.twmouli.length) {
					dialog.add(event.twmouli);
				} else {
					dialog.addText("牌堆里没有基本牌");
				}
				return dialog;
			},
			filter(button, player) {
				var evt = _status.event.getParent(),
					card = button.link;
				if (evt && evt.filterCard) {
					return evt.filterCard(card, player, evt);
				}
				return false;
			},
			check(button) {
				var player = _status.event.player,
					card = button.link;
				if (_status.event.type != "phase") {
					return 1;
				}
				if (_status.event.dying) {
					return get.attitude(player, _status.event.dying);
				}
				if (card.name == "jiu") {
					return player.getUseValue(card);
				}
				return player.getUseValue(card) / 4;
			},
			backup(links, player) {
				return {
					audio: "mouli",
					filterCard: () => false,
					selectCard: -1,
					viewAs: { name: links[0].name, isCard: true, cards: [links[0]] },
					popname: true,
					log: false,
					precontent() {
						player.logSkill("twmouli");
						player.addTempSkill("twmouli_used");
						var name = event.result.card.name;
						event.result.cards = event.result.card.cards;
						event.result.card = get.autoViewAs(event.result.cards[0]);
						event.result.card.name = name;
						var next = game.createEvent("twmouli_update");
						event.next.remove(next);
						event.getParent().after.push(next);
						next.setContent(function () {
							game.updateRoundNumber();
						});
					},
				};
			},
			prompt(links, player) {
				return "使用牌堆中的" + get.translation(links);
			},
		},
		hiddenCard(player, name) {
			return get.type(name) == "basic" && !player.getStat("skill").twmouli;
		},
		subSkill: {
			used: { charlotte: true },
		},
		ai: {
			effect: {
				target(card, player, target, effect) {
					if (get.tag(card, "respondShan")) {
						return 0.7;
					}
					if (get.tag(card, "respondSha")) {
						return 0.7;
					}
				},
			},
			order: 11,
			respondSha: true,
			respondShan: true,
			fireAttack: true,
			skillTagFilter(player, tag, arg) {
				if (arg == "respond") {
					return false;
				}
				var list = [];
				for (var i = 0; i < ui.cardPile.childNodes.length; i++) {
					var card = ui.cardPile.childNodes[i];
					if (get.type(card, null, false) == "basic" && !list.includes(card.name)) {
						list.push(card.name);
					}
				}
				if (tag == "respondSha") {
					return list.includes("sha");
				}
				if (tag == "respondShan") {
					return list.includes("shan");
				}
				return !player.getStat("skill").twmouli;
			},
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
	},
};
