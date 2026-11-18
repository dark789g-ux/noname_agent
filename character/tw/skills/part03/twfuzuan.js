import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twfuzuan" | "twchongqi" | "twfeifu">} */
export const groupSkills = {
	//曹肇
	twfuzuan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return (
					current.getSkills(null, false, false).filter(function (i) {
						return get.is.zhuanhuanji(i, current);
					}).length > 0
				);
			});
		},
		filterTarget(card, player, target) {
			return (
				target.getSkills(null, false, false).filter(function (i) {
					return get.is.zhuanhuanji(i, target);
				}).length > 0
			);
		},
		content() {
			"step 0";
			var list = target.getSkills(null, false, false).filter(function (i) {
				return get.is.zhuanhuanji(i, target);
			});
			if (list.length == 1) {
				event._result = { control: list[0] };
			} else {
				player
					.chooseControl(list)
					.set("prompt", "选择变更" + get.translation(target) + "一个技能的状态")
					.set("choice", list.includes("twfeifu") ? "twfeifu" : 0)
					.set("ai", () => _status.event.choice);
			}
			"step 1";
			var skill = result.control;
			target.changeZhuanhuanji(skill);
			target.popup(skill, "wood");
			game.log(target, "的", "#g【" + get.translation(skill) + "】", "发生了状态变更");
			game.delayx();
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (!target.hasSkill("twfeifu")) {
						return 0;
					}
					return target.storage.twfeifu ? -1 : 1;
				},
			},
		},
		group: "twfuzuan_damage",
		subSkill: {
			damage: {
				audio: "twfuzuan",
				trigger: {
					player: "damageEnd",
					source: "damageSource",
				},
				direct: true,
				filter(event, player) {
					return game.hasPlayer(function (current) {
						return (
							current.getSkills(null, false, false).filter(function (i) {
								return get.is.zhuanhuanji(i, current);
							}).length > 0
						);
					});
				},
				content() {
					"step 0";
					player
						.chooseTarget(lib.skill.twfuzuan.filterTarget, get.prompt("twfuzuan"), "变更一名角色的一个转换技的状态")
						.set("ai", function (target) {
							var player = _status.event.player;
							return get.effect(target, "twfuzuan", player, player);
						});
					"step 1";
					if (result.bool) {
						var target = result.targets[0];
						player.logSkill("twfuzuan", target);
						var next = game.createEvent("twfuzuan");
						next.player = player;
						next.target = target;
						next.setContent(lib.skill.twfuzuan.content);
					}
				},
			},
		},
	},
	twchongqi: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		forced: true,
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		logTarget: () => game.filterPlayer().sortBySeat(),
		content() {
			"step 0";
			game.filterPlayer()
				.sortBySeat()
				.forEach(function (current) {
					current.addSkills("twfeifu");
				});
			//game.log(player,'令所有其他角色获得了技能','#g【非服】')
			game.delayx();
			"step 1";
			player.chooseTarget("是否减1点体力上限，并令一名其他角色获得技能【复纂】？", lib.filter.notMe).set("ai", function (target) {
				var player = _status.event.player;
				if (player.hasUnknown() && !target.isZhu) {
					return 0;
				}
				if (player.getEnemies().includes(target)) {
					return 0;
				}
				return get.attitude(player, target);
			});
			"step 2";
			if (result.bool) {
				player.loseMaxHp();
				var target = result.targets[0];
				player.line(target, "fire");
				target.addSkills("twfuzuan");
				game.delayx();
			}
		},
		derivation: ["twfeifu", "twfuzuan"],
	},
	twfeifu: {
		audio: 2,
		trigger: {
			player: "useCardToPlayered",
			target: "useCardToTargeted",
		},
		zhuanhuanji: true,
		forced: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage, player) {
				return (
					(storage ? "当你使用【杀】指定唯一目标后" : "当你成为【杀】的唯一目标后") +
					"目标角色须交给使用者一张牌。若此牌为装备牌，则使用者可使用此牌。"
				);
			},
		},
		filter(event, player, name) {
			return (
				event.card.name == "sha" &&
				event.targets.length == 1 &&
				event.player.isIn() &&
				event.target.countCards("he") > 0 &&
				(name == "useCardToPlayered") == Boolean(player.storage.twfeifu)
			);
		},
		logTarget(event, player) {
			return player.storage.twfeifu ? event.target : event.player;
		},
		content() {
			"step 0";
			player.changeZhuanhuanji("twfeifu");
			trigger.target.chooseCard("he", true, "非服：交给" + get.translation(trigger.player) + "一张牌", "若选择装备牌，则其可以使用此牌");
			"step 1";
			if (result.bool) {
				var card = result.cards[0];
				event.card = card;
				trigger.target.give(card, trigger.player);
			} else {
				event.finish();
			}
			"step 2";
			var target = trigger.player;
			if (target.getCards("h").includes(card) && get.type(card, null, target) == "equip" && target.hasUseTarget(card)) {
				target.chooseUseTarget(card, "nopopup");
			}
		},
	},
};
