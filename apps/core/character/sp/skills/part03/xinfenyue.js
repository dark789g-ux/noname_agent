import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xinfenyue" | "fenyue" | "fenyue2" | "zfengshi" | "chuanxin" | "hengjiang" | "hengjiang2" | "rehengjiang">} */
export const groupSkills = {
	xinfenyue: {
		enable: "phaseUse",
		usable(skill, player) {
			return game.players.length - player.getFriends(true).length;
		},
		audio: "fenyue",
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			return game.hasPlayer(target => lib.skill.fenyue.filterTarget(null, player, target));
		},
		filterTarget(event, player, target) {
			return player.canCompare(target);
		},
		content() {
			"step 0";
			player.chooseToCompare(target);
			"step 1";
			if (!result.bool) {
				event.finish();
			}
			event.num = result.num1;
			"step 2";
			if (num <= 5 && target.countGainableCards(player, "he") > 0) {
				player.gainPlayerCard(target, "he", true);
			}
			"step 3";
			if (num <= 9) {
				var card = get.cardPile2(function (x) {
					return x.name == "sha";
				});
				if (card) {
					player.gain(card, "gain2");
				}
			}
			"step 4";
			if (num <= 13) {
				var card = { name: "sha", nature: "thunder" };
				if (player.canUse(card, target, false)) {
					player.useCard(card, target, false);
				}
			}
		},
		ai: {
			order: 4,
			result: {
				target(player, target) {
					var sort = function (a, b) {
						return b.number - a.number;
					};
					var ps = player.getCards("h").sort(sort);
					var ts = target.getCards("h").sort(sort);
					if (ps[0].number > ts[0].number) {
						var effect = get.effect(target, { name: "sha", nature: "thunder" }, player, player);
						if (ps[0].number < 6 && target.countCards("he") > 1) {
							effect -= 2;
						}
						if (ps[0].number < 10) {
							effect -= 1;
						}
						return effect;
					}
					return ps.length >= ts.length ? -0.5 : 0;
				},
			},
		},
	},
	fenyue: {
		audio: 2,
		enable: "phaseUse",
		usable(skill, player) {
			let num;
			if (get.mode() == "identity") {
				num = game.countPlayer(function (current) {
					return current.identity == "zhong" || current.identity == "mingzhong";
				});
			} else {
				num = 1;
			}
			return num;
		},
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			return game.hasPlayer(target => lib.skill.fenyue.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		ai: {
			order: 2.8,
			result: {
				target(player, target) {
					if (
						get.attitude(player, target) < 0 &&
						player.hasCard(function (card) {
							return (card.number >= 9 && get.value(card) <= 5) || get.value(card) <= 3;
						})
					) {
						return get.effect(target, { name: "sha" }, player, target);
					} else {
						return 0;
					}
				},
			},
		},
		content() {
			"step 0";
			player.chooseToCompare(target);
			"step 1";
			if (result.bool) {
				player
					.chooseControl(function () {
						return 1;
					})
					.set("choiceList", ["令" + get.translation(target) + "不能使用或打出手牌直到回合结束", "视为对" + get.translation(target) + "使用一张杀（不计入次数限制）"]);
			} else {
				var evt = _status.event.getParent("phaseUse");
				if (evt && evt.name == "phaseUse") {
					evt.skipped = true;
				}
				event.finish();
			}
			"step 2";
			if (result.control == "选项一") {
				target.addTempSkill("fenyue2");
			} else {
				player.useCard({ name: "sha", isCard: true }, target, false);
			}
		},
	},
	fenyue2: {
		mark: true,
		mod: {
			cardEnabled2(card) {
				if (get.position(card) == "h") {
					return false;
				}
			},
		},
		intro: {
			content: "不能使用或打出手牌",
		},
	},
	zfengshi: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && event.target.countCards("e");
		},
		logTarget: "target",
		check(event, player) {
			if (event.target.hasSkillTag("noe")) {
				return false;
			}
			return get.attitude(player, event.target) < 0;
		},
		content() {
			trigger.target.chooseToDiscard("e", true);
		},
	},
	chuanxin: {
		audio: 2,
		trigger: { source: "damageBegin2" },
		preHidden: true,
		filter(event, player) {
			if (_status.currentPhase != player) {
				return false;
			}
			if (!_status.event.getParent("phaseUse")) {
				return false;
			}
			if (event.card && (event.card.name == "sha" || event.card.name == "juedou") && event.getParent().name == event.card.name) {
				if (get.mode() == "guozhan") {
					return (event.player.identity != "qun" || player.identity == "ye") && !event.player.isUnseen() && event.player.hasViceCharacter();
				} else {
					var info = lib.character[event.player.name];
					if (!info) {
						return false;
					}
					var skills = event.player.getSkills();
					for (var i = 0; i < info[3].length; i++) {
						if (lib.skill[info[3][i]].fixed) {
							continue;
						}
						if (skills.includes(info[3][i])) {
							return true;
						}
					}
				}
			}
			return false;
		},
		logTarget: "player",
		check(event, player) {
			if (get.mode() == "guozhan") {
				if (!event.player.isUnseen(1) && get.guozhanRank(event.player.name2, event.player) < 4) {
					return false;
				}
			}
			if (event.player.hasSkill("subplayer")) {
				return false;
			}
			if (get.attitude(player, event.player) < 0) {
				if (event.player.hp == 1 && event.player.countCards("e") < 2 && event.player.name2 != "gz_pangtong") {
					return false;
				}
				return true;
			}
			return false;
		},
		content() {
			"step 0";
			trigger.cancel();
			if (trigger.player.countCards("e")) {
				trigger.player
					.chooseControl(function (event, player) {
						if (get.mode() == "guozhan" && get.guozhanRank(player.name2, player) < 4) {
							return 1;
						}
						if (player.hp == 1) {
							return 1;
						}
						if (player.hp == 2 && player.countCards("e") >= 2) {
							return 1;
						}
						return 0;
					})
					.set("choiceList", ["弃置装备区内的所有牌并失去1点体力", get.mode() == "guozhan" ? "移除副将牌" : "随机移除武将牌上的一个技能"]);
			} else {
				event._result = { index: 1 };
			}
			"step 1";
			if (result.index == 1) {
				if (get.mode() != "guozhan") {
					var info = lib.character[trigger.player.name];
					var skills = trigger.player.getSkills();
					var list = [];
					for (var i = 0; i < info[3].length; i++) {
						if (lib.skill[info[3][i]].fixed) {
							continue;
						}
						if (skills.includes(info[3][i])) {
							list.push(info[3][i]);
						}
					}
					if (list.length) {
						var skill = list.randomGet();
						trigger.player.removeSkills(skill);
					}
				} else {
					trigger.player.removeCharacter(1);
				}
			} else {
				trigger.player.discard(trigger.player.getCards("e"));
				trigger.player.loseHp();
			}
		},
	},
	hengjiang: {
		audio: 2,
		trigger: { player: "damageEnd" },
		preHidden: true,
		check(event, player) {
			return get.attitude(player, _status.currentPhase) < 0 || !_status.currentPhase.needsToDiscard(2);
		},
		filter(event) {
			return _status.currentPhase && _status.currentPhase.isIn() && event.num > 0;
		},
		logTarget() {
			return _status.currentPhase;
		},
		content() {
			var source = _status.currentPhase;
			if (source.hasSkill("hengjiang2")) {
				source.storage.hengjiang2 += trigger.num;
				source.storage.hengjiang3.add(player);
				source.updateMarks();
			} else {
				source.storage.hengjiang3 = [player];
				source.storage.hengjiang2 = trigger.num;
				source.addTempSkill("hengjiang2");
			}
		},
		ai: {
			maixie_defend: true,
		},
	},
	hengjiang2: {
		mark: true,
		charlotte: true,
		intro: {
			content: "手牌上限-#",
		},
		mod: {
			maxHandcard(player, num) {
				return num - player.storage.hengjiang2;
			},
		},
		onremove(player) {
			delete player.storage.hengjiang2;
			delete player.storage.hengjiang3;
		},
		trigger: { player: "phaseDiscardEnd" },
		sourceSkill: "hengjiang",
		filter(event, player) {
			if (event.cards && event.cards.length) {
				return false;
			}
			var players = player.storage.hengjiang3;
			for (var i = 0; i < players.length; i++) {
				if (players[i].isIn()) {
					return true;
				}
			}
			return false;
		},
		forced: true,
		popup: false,
		content() {
			var players = player.storage.hengjiang3;
			for (var i = 0; i < players.length; i++) {
				if (players[i].isIn()) {
					players[i].logSkill("hengjiang");
					players[i].line(player, "green");
				}
			}
			game.asyncDraw(player.storage.hengjiang3);
		},
	},
	rehengjiang: {
		audio: "hengjiang",
		trigger: { player: "damageEnd" },
		getIndex: event => event.num,
		check(event, player) {
			return get.attitude(player, _status.currentPhase) < 0 || !_status.currentPhase.needsToDiscard(2);
		},
		filter(event) {
			return _status.currentPhase?.isIn() && event.num > 0;
		},
		logTarget: () => _status.currentPhase,
		preHidden: true,
		async content(event, trigger, player) {
			const source = _status.currentPhase;
			source.addTempSkill(event.name + "_effect");
			source.addMark(event.name + "_effect", 1, false);
			player.addTempSkill(event.name + "_draw");
		},
		ai: { maixie_defend: true },
		subSkill: {
			effect: {
				charlotte: true,
				onremove: true,
				intro: { content: "手牌上限-#" },
				mod: {
					maxHandcard(player, num) {
						return num - player.countMark("rehengjiang_effect");
					},
				},
			},
			draw: {
				audio: "hengjiang",
				trigger: { global: "phaseEnd" },
				forced: true,
				charlotte: true,
				filterx(event, player) {
					return (
						event.player.hasMark("rehengjiang_effect") &&
						!event.player.hasHistory("lose", evt => {
							return evt.type == "discard" && evt.cards2.length && evt.getParent("phaseDiscard").player == event.player;
						})
					);
				},
				logTarget: "player",
				async content(event, trigger, player) {
					if (lib.skill[event.name].filterx(trigger, player)) {
						const num = player.getHistory("useSkill", evt => evt.skill == "rehengjiang" && evt.targets.includes(trigger.player)).length;
						if (num > 0) {
							await player.draw(num);
						}
					} else {
						await player.draw();
					}
				},
			},
		},
	},
};
