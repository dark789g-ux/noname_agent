import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcxingwu" | "dcluoyan" | "retianxiang_daxiaoqiao" | "dcposuo" | "dcxiaoren">} */
export const groupSkills = {
	//十周年二乔
	dcxingwu: {
		intro: {
			content: "expansion",
			markcount: "expansion",
			onunmark(storage, player) {
				player.removeAdditionalSkill("dcluoyan");
			},
		},
		onremove(player, skill) {
			var cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		audio: "xingwu",
		trigger: { player: "phaseDiscardBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		direct: true,
		content() {
			"step 0";
			player
				.chooseCard("h", get.prompt("dcxingwu"), "将一张手牌作为“舞”置于武将牌上")
				.set("ai", function (card) {
					var att = 1,
						list = [];
					for (var i of player.getExpansions("dcxingwu")) {
						if (!list.includes(get.suit(i))) {
							list.push(get.suit(i));
						}
					}
					if (!list.includes(get.suit(card))) {
						att = 2;
					}
					if (_status.event.goon) {
						return (20 - get.value(card)) * att;
					}
					return (7 - get.value(card)) * att;
				})
				.set("goon", player.needsToDiscard() || player.getExpansions("dcxingwu").length == 2);
			"step 1";
			if (result.bool) {
				player.logSkill("dcxingwu");
				var cards = result.cards;
				player.addToExpansion(cards, player, "give").gaintag.add("dcxingwu");
			}
			"step 2";
			game.delayx();
			if (player.getExpansions("dcxingwu").length > 2) {
				player.chooseButton(["是否移去三张“舞”并发射核弹？", player.getExpansions("dcxingwu")], 3).ai = button => {
					if (
						game.hasPlayer(function (current) {
							return get.attitude(player, current) < 0;
						})
					) {
						return 1;
					}
					return 0;
				};
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				event.cards = result.links;
				var list = [],
					str = ["<span class='texiaotext' style='color:#66FF00'>小型</span>", "<span class='texiaotext' style='color:#6666FF'>中型</span>", "<span class='texiaotext' style='color:#FF0000'>巨型</span>"];
				for (var i of event.cards) {
					if (!list.includes(get.suit(i))) {
						list.push(get.suit(i));
					}
				}
				player.chooseTarget("请选择" + str[list.length - 1] + "核弹的投射的目标（伤害：" + list.length + "点）", lib.filter.notMe, true).ai = target => {
					var att = 1;
					if (target.sex == "male") {
						att = 1.5;
					}
					if ((target.hp == target.sex) == "male" ? 2 : 1) {
						att *= 1.2;
					}
					if (get.mode() == "identity" && player.identity == "fan" && target.isZhu) {
						att *= 3;
					}
					return -get.attitude(player, target) * att * Math.max(1, target.countCards("e"));
				};
			}
			"step 4";
			if (result.bool) {
				var list = [];
				for (var i of event.cards) {
					if (!list.includes(get.suit(i))) {
						list.push(get.suit(i));
					}
				}
				player.loseToDiscardpile(event.cards);
				player.logSkill("dcxingwu", result.targets[0]);
				player.discardPlayerCard(result.targets[0], "e", result.targets[0].countCards("e"), true);
				result.targets[0].damage(result.targets[0].sex == "female" ? 1 : list.length);
			}
		},
	},
	dcluoyan: {
		derivation: ["retianxiang", "liuli"],
		init(player) {
			if (player.getExpansions("dcxingwu").length) {
				player.addAdditionalSkill("dcluoyan", ["retianxiang", "liuli"]);
			} else {
				player.removeAdditionalSkill("dcluoyan");
			}
		},
		onremove(player) {
			player.removeAdditionalSkill("dcluoyan");
		},
		trigger: { player: ["loseAfter", "loseAsyncAfter", "addToExpansionAfter"] },
		filter(event, player) {
			var cards = player.getExpansions("dcxingwu"),
				skills = player.additionalSkills.dcluoyan;
			return !((cards.length && skills && skills.length) || (!cards.length && (!skills || !skills.length)));
		},
		forced: true,
		silent: true,
		content() {
			lib.skill.dcluoyan.init(player, "dcluoyan");
		},
		ai: {
			combo: "dcxingwu",
		},
	},
	retianxiang_daxiaoqiao: {
		audio: "tianxiang_daxiaoqiao",
		inherit: "retianxiang",
	},
	//田尚衣
	dcposuo: {
		onChooseToUse(event) {
			if (!game.online && !event.dcposuo_cards) {
				var player = event.player;
				var evtx = event.getParent("phaseUse");
				var suits = lib.suit.slice(0).reverse();
				suits = suits.filter(suit => !player.getStorage("dcposuo_suits").includes(suit) && player.countCards("hs", card => get.suit(card, player) == suit));
				if (
					!suits.length ||
					player.getHistory("sourceDamage", evt => {
						return evt.player != player && evt.getParent("phaseUse") == evtx;
					}).length
				) {
					event.set("dcposuo_cards", undefined);
				} else {
					var list = [],
						cards = Array.from(ui.cardPile.childNodes);
					cards.addArray(Array.from(ui.discardPile.childNodes));
					game.countPlayer(current => cards.addArray(current.getCards("hejxs")));
					for (var name of lib.inpile) {
						if (!get.tag({ name: name }, "damage") || get.type(new lib.element.VCard({ name: name })) === "delay") {
							continue;
						}
						let same = cards.filter(card => get.name(card, false) == name && !get.natureList(card, false).length);
						if (same.length) {
							for (var suit of suits) {
								if (same.some(card => get.suit(card, false) == suit)) {
									list.push([suit, "", name, undefined, suit]);
								}
							}
						}
						for (var nature of lib.inpile_nature) {
							same = cards.filter(card => get.name(card, false) == name && get.is.sameNature(get.natureList(card, false), nature));
							if (same.length) {
								for (var suit of suits) {
									if (same.some(card => get.suit(card, false) == suit)) {
										list.push([suit, "", name, nature, suit]);
									}
								}
							}
						}
					}
					event.set("dcposuo_cards", list);
				}
			}
		},
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return event.dcposuo_cards && event.dcposuo_cards.length;
		},
		chooseButton: {
			dialog(event, player) {
				return ui.create.dialog("婆娑", [event.dcposuo_cards, "vcard"], "hidden");
			},
			check(button) {
				var player = _status.event.player;
				return player.getUseValue({ name: button.link[2], nature: button.link[3] });
			},
			backup(links, player) {
				return {
					suit: links[0][4],
					filterCard(card, player) {
						return get.suit(card, player) == lib.skill.dcposuo_backup.suit;
					},
					viewAs: {
						name: links[0][2],
						nature: links[0][3],
					},
					check(card) {
						return 6.5 - get.value(card);
					},
					log: false,
					precontent() {
						player.logSkill("dcposuo");
						player.addTempSkill("dcposuo_suits", "phaseUseAfter");
						player.markAuto("dcposuo_suits", [get.suit(event.result.cards[0])]);
					},
				};
			},
			prompt(links, player) {
				var suit = links[0][4];
				var name = links[0][2];
				var nature = links[0][3];
				return "将一张" + get.translation(suit) + "牌当作" + (get.translation(nature) || "") + get.translation(name) + "使用";
			},
		},
		ai: {
			order: 10,
			result: { player: 1 },
		},
		subSkill: {
			suits: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	dcxiaoren: {
		audio: 2,
		trigger: {
			source: "damageSource",
		},
		usable: 1,
		check: (event, player) => {
			let rev = game.countPlayer(i => {
				return i.isDamaged() && get.attitude(_status.event.player, i) > 0;
			});
			if (!event.player.isIn() || game.countPlayer() < 2) {
				return rev;
			}
			if (get.damageEffect(event.player.getPrevious(), player, _status.event.player) > -rev) {
				return true;
			}
			return get.damageEffect(event.player.getNext(), player, _status.event.player) > -rev;
		},
		content() {
			"step 0";
			player.addTempSkill("dcxiaoren_dying");
			event.target = trigger.player;
			"step 1";
			player.judge();
			"step 2";
			if (result.color == "red") {
				player.chooseTarget("绡刃：是否令一名角色回复1点体力（若回满则额外摸一张牌）？").set("ai", target => {
					let rec = get.recoverEffect(target, _status.event.player, _status.event.player);
					if (target.getDamagedHp() <= 1) {
						return rec + get.effect(target, { name: "draw" }, target, _status.event.player);
					}
					return rec;
				});
			} else if (result.color != "black" || game.countPlayer() < 2) {
				event.goto(9);
			} else {
				event.goto(5);
			}
			"step 3";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.line(target);
				target.recover();
			} else {
				event.goto(9);
			}
			"step 4";
			if (event.target.isHealthy()) {
				event.target.draw();
			}
			event.goto(9);
			"step 5";
			var targets = [].addArray([target.getPrevious(), target.getNext()]);
			if (targets.length > 1) {
				player
					.chooseTarget(
						"绡刃：对其中一名角色造成1点伤害",
						(card, player, target) => {
							return _status.event.targets.includes(target);
						},
						true
					)
					.set("ai", target => {
						let player = _status.event.player;
						return get.damageEffect(target, player, player);
					})
					.set("targets", targets);
			} else if (targets.length) {
				event._result = { bool: true, targets: targets };
			}
			"step 6";
			if (result.bool) {
				let target = result.targets[0];
				event.target = target;
				player.line(target);
				target.damage("nocard");
			} else {
				event.goto(9);
			}
			"step 7";
			if (player.storage.dcxiaoren_dying || get.is.blocked(event.name, player)) {
				event._result = { bool: false };
			} else if (event.frequent) {
				event._result = { bool: true };
			} else {
				player
					.chooseBool("绡刃：是否再次进行判定并执行对应效果直到未能执行此项或有角色进入濒死状态？")
					.set("ai", function () {
						return _status.event.bool;
					})
					.set("bool", lib.skill.dcxiaoren.check({ player: event.target }, player));
			}
			"step 8";
			if (result.bool) {
				event.frequent = true;
				event.goto(1);
			}
			"step 9";
			player.removeSkill("dcxiaoren_dying");
		},
		subSkill: {
			dying: {
				init: player => {
					delete player.storage.dcxiaoren_dying;
				},
				onremove: player => {
					delete player.storage.dcxiaoren_dying;
				},
				trigger: { global: "dying" },
				forced: true,
				popup: false,
				charlotte: true,
				content() {
					player.storage.dcxiaoren_dying = true;
				},
			},
		},
	},
};
