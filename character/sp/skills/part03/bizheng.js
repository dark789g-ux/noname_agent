import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "bizheng" | "yidian">} */
export const groupSkills = {
	//孙邵
	bizheng: {
		trigger: { player: "phaseDrawEnd" },
		direct: true,
		audio: 2,
		content() {
			"step 0";
			player.chooseTarget(get.prompt2("bizheng"), lib.filter.notMe).set("ai", function (target) {
				var player = _status.event.player;
				if (player.countCards("h") > player.maxHp) {
					return 0;
				}
				var att = get.attitude(player, target);
				if (att <= 0 || target.hasSkillTag("nogain")) {
					return 0;
				}
				if (target.maxHp - target.countCards("h") >= 2) {
					return att;
				}
				return att / 2;
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				event.target = target;
				player.logSkill("bizheng", target);
				target.draw(2);
			} else {
				event.finish();
			}
			"step 2";
			if (player.countCards("h") > player.maxHp) {
				player.chooseToDiscard(2, "he", true);
			}
			"step 3";
			if (target.countCards("h") > target.maxHp) {
				target.chooseToDiscard(2, "he", true);
			}
		},
		ai: {
			expose: 0.25,
		},
	},
	yidian: {
		audio: 2,
		trigger: { player: "useCard2" },
		filter(event, player) {
			var info = get.info(event.card);
			if (info.allowMultiple == false) {
				return false;
			}
			if (event.targets && !info.multitarget) {
				for (var i = 0; i < ui.discardPile.childElementCount; i++) {
					if (ui.discardPile.childNodes[i].name == event.card.name) {
						return false;
					}
				}
				if (
					game.hasPlayer(function (current) {
						return lib.filter.targetEnabled2(event.card, player, current) && !event.targets.includes(current);
					})
				) {
					return true;
				}
			}
			return false;
		},
		direct: true,
		content() {
			"step 0";
			var prompt2 = "为" + get.translation(trigger.card) + "增加一个目标";
			player
				.chooseTarget(get.prompt("yidian"), function (card, player, target) {
					var player = _status.event.player;
					if (_status.event.targets.includes(target)) {
						return false;
					}
					return lib.filter.targetEnabled2(_status.event.card, player, target);
				})
				.set("prompt2", prompt2)
				.set("ai", function (target) {
					var trigger = _status.event.getTrigger();
					var player = _status.event.player;
					return get.effect(target, trigger.card, player, player);
				})
				.set("targets", trigger.targets)
				.set("card", trigger.card);
			"step 1";
			if (result.bool) {
				if (!event.isMine() && !event.isOnline()) {
					game.delayx();
				}
				event.targets = result.targets;
			} else {
				event.finish();
			}
			"step 2";
			if (event.targets) {
				player.logSkill("yidian", event.targets);
				trigger.targets.addArray(event.targets);
			}
		},
		ai: {
			expose: 0.25,
		},
	},
};
