import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "shameng" | "fubi" | "fubi2" | "zuici" | "jianzhan" | "duoji">} */
export const groupSkills = {
	shameng: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			var hs = player.getCards("h");
			if (hs.length < 2) {
				return false;
			}
			var red = 0,
				black = 0;
			for (var i of hs) {
				if (get.color(i, player) == "red") {
					red++;
				} else {
					black++;
				}
				if (red > 1 || black > 1) {
					return true;
				}
			}
			return false;
		},
		complexCard: true,
		selectCard: 2,
		filterCard(card, player) {
			if (ui.selected.cards.length) {
				return get.color(card, player) == get.color(ui.selected.cards[0], player);
			}
			var color = get.color(card, player);
			return (
				player.countCards("h", function (cardx) {
					return cardx != card && color == get.color(cardx, player);
				}) > 0
			);
		},
		filterTarget: lib.filter.notMe,
		check(card) {
			return 7 - get.value(card);
		},
		position: "h",
		content() {
			target.draw(2);
			player.draw(3);
		},
		ai: {
			order: 6,
			result: { target: 2 },
		},
	},
	fubi: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: "enterGame",
		},
		direct: true,
		skillAnimation: true,
		animationColor: "wood",
		filter(event, player) {
			return event.name != "phase" || game.phaseNumber == 0;
		},
		content() {
			"step 0";
			player.chooseTarget(get.prompt2("fubi"), lib.filter.notMe).set("ai", function (target) {
				return get.attitude(_status.event.player, target);
			});
			"step 1";
			if (result.bool) {
				var target = result.targets[0];
				player.logSkill("fubi", target);
				target.addSkill("fubi2");
				target.storage.fubi2.push(player);
			}
		},
	},
	fubi2: {
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = [];
			}
		},
		mod: {
			maxHandcard(player, num) {
				var list = player.getStorage("fubi2");
				for (var i of list) {
					if (i.isIn()) {
						num += 3;
					}
				}
				return num;
			},
		},
		mark: true,
		intro: { content: "若$存活，则手牌上限+3" },
	},
	zuici: {
		audio: 2,
		trigger: { player: "dying" },
		direct: true,
		filter(event, player) {
			return player.countCards("e") > 0;
		},
		content() {
			"step 0";
			var list = [];
			var cards = player.getCards("e");
			for (var i of cards) {
				list.push(get.subtype(i));
			}
			list.push("cancel2");
			player.chooseControl(list).set("prompt", get.prompt2("zuici"));
			"step 1";
			if (result.control != "cancel2") {
				player.disableEquip(result.control);
			} else {
				event.finish();
			}
			"step 2";
			if (player.hp < 1) {
				player.recover(1 - player.hp);
			}
		},
	},
	jianzhan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(function (current) {
				return lib.skill.jianzhan.filterTarget(null, player, current);
			});
		},
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			if (ui.selected.targets.length) {
				var targetx = ui.selected.targets[0];
				return targetx != target && targetx.countCards("h") > target.countCards("h") && targetx.inRange(target);
			}
			var num = target.countCards("h");
			return game.hasPlayer(function (current) {
				return current != target && current != player && current.countCards("h") < num && target.inRange(current);
			});
		},
		selectTarget: 2,
		complexTarget: true,
		targetprompt: ["出杀", "被出杀"],
		multitarget: true,
		content() {
			"step 0";
			if (!targets[0].canUse("sha", targets[1])) {
				event._result = { index: 1 };
			} else {
				targets[0]
					.chooseControl()
					.set("choiceList", ["视为对" + get.translation(targets[1]) + "使用一张【杀】", "令" + get.translation(player) + "摸一张牌"])
					.set("ai", function () {
						var evt = _status.event.getParent();
						var eff = get.effect(evt.targets[1], { name: "sha", isCard: true }, evt.targets[0], evt.targets[0]);
						if (eff > 0) {
							return 0;
						}
						if (eff < 0 || get.attitude(evt.targets[0], evt.player) > 1) {
							return 1;
						}
						return 0;
					});
			}
			"step 1";
			if (result.index == 0) {
				targets[0].useCard({ name: "sha", isCard: true }, targets[1], false);
			} else {
				player.draw();
			}
		},
		ai: {
			result: {
				target(player, target) {
					if (ui.selected.targets.length) {
						var from = ui.selected.targets[0];
						return get.effect(target, { name: "sha" }, from, target);
					}
					var effs = [0, 0];
					game.countPlayer(function (current) {
						if (current != target && target.canUse("sha", current)) {
							var eff = get.effect(current, { name: "sha" }, target, target);
							if (eff > effs[0]) {
								effs[0] = eff;
							}
							if (eff < effs[1]) {
								effs[1] = eff;
							}
						}
					});
					return effs[get.attitude(player, target) > 0 ? 0 : 1];
				},
			},
			order: 8.5,
			expose: 0.2,
		},
	},
	duoji: {
		audio: 2,
		enable: "phaseUse",
		limited: true,
		filter(event, player) {
			return (
				player.countCards("h") > 1 &&
				game.hasPlayer(function (current) {
					return current != player && current.countGainableCards(player, "e") > 0;
				})
			);
		},
		filterCard: true,
		selectCard: 2,
		filterTarget(card, player, target) {
			return target != player && target.countGainableCards(player, "e") > 0;
		},
		check(card) {
			return 8 - get.value(card);
		},
		position: "h",
		skillAnimation: true,
		animationColor: "metal",
		content() {
			player.awakenSkill(event.name);
			var cards = target.getGainableCards(player, "e");
			player.gain(cards, target, "give", "bySelf");
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					var num = 0,
						es = target.getCards("e"),
						val = 0;
					for (var i of es) {
						num += get.value(i, target);
					}
					for (var i of ui.selected.cards) {
						val += get.value(i, player);
					}
					if (Math.abs(num) > val) {
						return -num;
					}
					return 0;
				},
			},
		},
	},
};
