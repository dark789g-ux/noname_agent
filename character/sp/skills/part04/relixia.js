import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "relixia" | "guiming" | "canshi" | "chouhai" | "recanshi" | "recanshi2" | "rechouhai" | "kunfen" | "fengliang" | "zhuiji" | "oldcihuai" | "oldcihuai2" | "oldcihuai3">} */
export const groupSkills = {
	relixia: {
		audio: "lixia",
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player.isIn() && event.player != player && !player.inRangeOf(event.player);
		},
		forced: true,
		content() {
			"step 0";
			if (trigger.player.isDead()) {
				event._result = { bool: true, links: [0] };
				return;
			}
			var list = ["令自己摸一张牌", "令XXX摸两张牌", "令XXX回复1点体力"];
			var card = get.translation(trigger.player);
			var next = player.chooseButton(
				[
					"【礼下】：请选择一至两项",
					[
						list.map((item, index) => {
							return [index, item.replace(/XXX/g, card)];
						}),
						"textbutton",
					],
				],
				true,
				[1, 2]
			);
			next.set("dialog", event.videoId);
			next.set("filterButton", function (button) {
				if (button.link == 2) {
					return _status.event.bool1;
				}
				return true;
			});
			next.set("bool1", trigger.player.isDamaged());
			next.set("ai", function (button) {
				var player = _status.event.player;
				var event = _status.event.getTrigger();
				if (button.link && get.attitude(player, event.player) <= 0) {
					return 0;
				}
				return button.link * Math.random();
			});
			"step 1";
			var map = [
				function (trigger, player, event) {
					player.draw();
				},
				function (trigger, player, event) {
					if (!result.links.includes(2)) {
						player.line(trigger.player);
					}
					trigger.player.draw(2);
				},
				function (trigger, player, event) {
					player.line(trigger.player);
					trigger.player.recover();
				},
			];
			result.links.sort();
			for (var i = 0; i < result.links.length; i++) {
				game.log(player, "选择了", "#g【礼下】", "的", "#y选项" + get.cnNumber(result.links[i] + 1, true));
				map[result.links[i]](trigger, player, event);
			}
			player.addSkill("rebiluan2");
			player.storage.rebiluan2 -= result.links.length;
			player.markSkill("rebiluan2");
			game.addVideo("storage", player, ["rebiluan2", player.storage.rebiluan2]);
		},
		ai: {
			combo: "olbiluan",
			halfneg: true,
		},
	},
	guiming: {
		audio: 2,
		zhuSkill: true,
		locked: true,
		ai: { combo: "recanshi" },
	},
	canshi: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		check(event, player) {
			var num = game.countPlayer(function (current) {
				if (player.hasZhuSkill("guiming") && current.group == "wu") {
					return true;
				}
				return current.isDamaged();
			});
			return num > 3;
		},
		prompt(event, player) {
			var num = game.countPlayer(function (current) {
				if (player.hasZhuSkill("guiming") && current.group == "wu" && current != player) {
					return true;
				}
				return current.isDamaged();
			});
			return "残蚀：是否改为摸" + get.cnNumber(num) + "张牌？";
		},
		filter(event, player) {
			return !event.numFixed;
		},
		content() {
			trigger.changeToZero();
			var num = game.countPlayer(function (current) {
				if (player.hasZhuSkill("guiming") && current.group == "wu" && current != player) {
					return true;
				}
				return current.isDamaged();
			});
			if (num > 0) {
				player.draw(num);
			}
			player.addTempSkill("canshi_effect");
		},
		subSkill: {
			effect: {
				audio: "canshi",
				mod: {
					aiOrder(player, card, num) {
						if (!["basic", "trick"].includes(get.type2(card))) {
							return;
						}
						if (!player.needsToDiscard()) {
							return 0.1;
						}
					},
				},
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					if (player.countCards("he") == 0) {
						return false;
					}
					let type = get.type(event.card, "trick");
					return type == "basic" || type == "trick";
				},
				autodelay: true,
				async content(event, trigger, player) {
					await player
						.chooseToDiscard(true, "he", card => {
							const { player, usefulCards } = get.event();
							if (usefulCards.includes(card)) {
								return 0.1;
							}
							return 20 - get.value(card);
						})
						.set(
							"usefulCards",
							player.getDiscardableCards(player, "h", card => player.getUseValue(card))
						);
				},
			},
		},
	},
	chouhai: {
		audio: 2,
		trigger: { player: "damageBegin3" },
		forced: true,
		check() {
			return false;
		},
		filter(event, player) {
			return player.countCards("h") == 0;
		},
		content() {
			trigger.num++;
		},
		ai: {
			neg: true,
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "damage") && target.countCards("h") == 0) {
						return [1, -2];
					}
				},
			},
		},
	},
	recanshi: {
		audio: "canshi",
		trigger: { player: "phaseDrawBegin2" },
		check(event, player) {
			if (
				player.skipList.includes("phaseUse") ||
				!player.countCards("h", function (card) {
					return get.type(card, "trick") == "trick" && player.hasUseTarget(card);
				})
			) {
				return true;
			}
			let num = game.countPlayer(current => {
				if (player.hasZhuSkill("guiming") && current.group == "wu") {
					return true;
				}
				return current.isDamaged();
			});
			return num > 1;
		},
		prompt(event, player) {
			let num = game.countPlayer(current => {
				if (player.hasZhuSkill("guiming") && current.group == "wu" && current != player) {
					return true;
				}
				return current.isDamaged();
			});
			return "残蚀：是否多摸" + get.cnNumber(num) + "张牌？";
		},
		filter(event, player) {
			return (
				!event.numFixed &&
				game.hasPlayer(current => {
					if (player.hasZhuSkill("guiming") && current.group == "wu" && current != player) {
						return true;
					}
					return current.isDamaged();
				})
			);
		},
		async content(event, trigger, player) {
			let num = game.countPlayer(current => {
				if (player.hasZhuSkill("guiming") && current.group == "wu" && current != player) {
					return true;
				}
				return current.isDamaged();
			});
			if (num > 0) {
				trigger.num += num;
			}
			player.addTempSkill("recanshi2");
		},
	},
	recanshi2: {
		sourceSkill: "recanshi",
		mod: {
			aiOrder(player, card, num) {
				if (!get.type(card) == "trick" && get.name(card, player) != "sha") {
					return;
				}
				if (!player.needsToDiscard()) {
					return 0.1;
				}
			},
		},
		trigger: { player: "useCard" },
		forced: true,
		filter(event, player) {
			if (player.countCards("he") == 0) {
				return false;
			}
			if (event.card.name == "sha") {
				return true;
			}
			return get.type(event.card) == "trick";
		},
		autodelay: true,
		async content(event, trigger, player) {
			await player
				.chooseToDiscard(true, "he", card => {
					const { player, usefulCards } = get.event();
					if (usefulCards.includes(card)) {
						return 0.1;
					}
					return 20 - get.value(card);
				})
				.set(
					"usefulCards",
					player.getDiscardableCards(player, "h", card => player.getUseValue(card))
				);
		},
	},
	rechouhai: {
		audio: "chouhai",
		trigger: { player: "damageBegin3" },
		forced: true,
		check() {
			return false;
		},
		filter(event, player) {
			return event.card && event.card.name == "sha" && player.countCards("h") == 0;
		},
		content() {
			trigger.num++;
		},
		ai: {
			neg: true,
			effect: {
				target(card, player, target, current) {
					if (card.name == "sha" && target.countCards("h") == 0) {
						return [1, -2];
					}
				},
			},
		},
	},
	kunfen: {
		audio: 2,
		audioname2: {
			ol_sb_jiangwei: "kunfen_ol_sb_jiangwei",
			pot_weiyan: "kunfen_pot_weiyan",
			pot_weiyan_achieve: "kunfen_pot_weiyan",
			pot_weiyan_fail: "kunfen_pot_weiyan",
		},
		trigger: { player: "phaseJieshuBegin" },
		locked(skill, player) {
			if (!player || !player.storage.kunfen) {
				return true;
			}
			return false;
		},
		direct: true,
		content() {
			"step 0";
			if (player.storage.kunfen || (get.mode() == "guozhan" && player.hiddenSkills.includes("kunfen"))) {
				if (!player.storage.kunfen) {
					event.skillHidden = true;
				}
				player.chooseBool(get.prompt("kunfen"), "失去1点体力，然后摸两张牌").set("ai", function () {
					var player = _status.event.player;
					if (player.hp > 3) {
						return true;
					}
					if (player.hp == 3 && player.countCards("h") < 3) {
						return true;
					}
					if (player.hp == 2 && player.countCards("h") == 0) {
						return true;
					}
					return false;
				});
			} else {
				event._result = { bool: true };
			}
			"step 1";
			if (result.bool) {
				player.logSkill("kunfen");
				player.loseHp();
			} else {
				event.finish();
			}
			"step 2";
			player.draw(2);
		},
		ai: { threaten: 1.5 },
	},
	fengliang: {
		skillAnimation: true,
		animationColor: "thunder",
		juexingji: true,
		audio: 2,
		derivation: "oltiaoxin",
		trigger: { player: "dying" },
		//priority:10,
		forced: true,
		content() {
			"step 0";
			player.awakenSkill(event.name);
			player.loseMaxHp();
			"step 1";
			if (player.hp < 2) {
				player.recover(2 - player.hp);
			}
			"step 2";
			player.storage.kunfen = true;
			player.addSkills("oltiaoxin");
		},
	},
	zhuiji: {
		audio: 2,
		mod: {
			globalFrom(from, to) {
				if (from.hp >= to.hp) {
					return -Infinity;
				}
			},
		},
	},
	oldcihuai: {
		audio: "cihuai",
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		check(event, player) {
			return !player.countCards("h", "sha");
		},
		content() {
			player.showHandcards();
			if (!player.countCards("h", "sha")) {
				player.addTempSkill("oldcihuai2");
			}
		},
	},
	oldcihuai2: {
		group: "oldcihuai3",
		prompt: "视为使用一张杀",
		enable: "chooseToUse",
		viewAs: { name: "sha", isCard: true },
		sourceSkill: "oldcihuai",
		filterCard() {
			return false;
		},
		selectCard: -1,
		ai: {
			presha: true,
			respondSha: true,
		},
	},
	oldcihuai3: {
		trigger: {
			player: ["loseAfter"],
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter", "die"],
		},
		silent: true,
		firstDo: true,
		sourceSkill: "oldcihuai",
		filter(event, player) {
			if (event.name == "die") {
				return true;
			}
			var evt = event.getl(player);
			return evt && evt.hs && evt.hs.length > 0;
		},
		content() {
			player.removeSkill("oldcihuai2");
		},
	},
};
