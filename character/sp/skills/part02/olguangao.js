import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olguangao" | "olhuiqi" | "olxieju">} */
export const groupSkills = {
	//OL文钦
	olguangao: {
		audio: 2,
		trigger: {
			global: "useCard2",
		},
		filter(event, player) {
			var card = event.card;
			if (card.name != "sha") {
				return false;
			}
			if (event.player == player) {
				return game.hasPlayer(current => {
					return current.isIn() && !event.targets.includes(current) && player.canUse(card, current);
				});
			}
			return event.player.isIn() && !event.targets.includes(player) && event.player.canUse(card, player);
		},
		direct: true,
		content() {
			"step 0";
			if (trigger.player == player) {
				player
					.chooseTarget(get.prompt("olguangao"), "为" + get.translation(trigger.card) + "额外指定一个目标。然后若你手牌数为偶数，你摸一张牌并令此牌对任意目标无效。", (card, player, target) => {
						return !_status.event.sourcex.includes(target) && player.canUse(_status.event.card, target);
					})
					.set("sourcex", trigger.targets)
					.set("ai", function (target) {
						var player = _status.event.player;
						if (player.countCards("h") % 2 == 0) {
							return true;
						}
						var eff = get.effect(target, _status.event.card, player, player);
						if (
							player.hasSkill("olxieju") &&
							player.isPhaseUsing() &&
							!player.getStat().skill.olxieju &&
							get.attitude(player, target) > 0 &&
							!game.hasGlobalHistory("useCard", evt => {
								return evt.targets && evt.targets.includes(target);
							})
						) {
							return 6 + eff;
						}
						return eff;
					})
					.set("card", trigger.card);
			} else {
				trigger.player
					.chooseBool("是否发动" + get.translation(player) + "的【犷骜】？", "令其成为" + get.translation(trigger.card) + "的额外目标。然后若其手牌数为偶数，其摸一张牌并令此牌对任意目标无效。")
					.set("ai", () => {
						return _status.event.bool;
					})
					.set(
						"bool",
						(function () {
							var att = get.attitude(trigger.player, player);
							if (player.countCards("h") % 2 == 0) {
								if (att > 0) {
									return true;
								}
								return false;
							}
							if (get.effect(player, trigger.card, trigger.player, trigger.player) > 0) {
								return true;
							}
							return false;
						})()
					);
			}
			"step 1";
			if (result.bool) {
				var target = result.targets && result.targets[0];
				if (!target) {
					target = player;
					trigger.player.logSkill("olguangao", player);
				} else {
					player.logSkill("olguangao", target);
				}
				trigger.targets.add(target);
				game.delayex();
			} else {
				event.finish();
			}
			"step 2";
			if (player.countCards("h") % 2 == 0) {
				player.draw();
				player
					.chooseTarget("犷骜：令此杀对其任意个目标无效", [1, Infinity], (card, player, target) => {
						return _status.event.targetsx.includes(target);
					})
					.set("ai", target => {
						const evt = _status.event.getTrigger(),
							player = _status.event.player;
						return -get.effect(target, evt.card, evt.player, player);
					})
					.set("targetsx", trigger.targets);
			} else {
				event.finish();
			}
			"step 3";
			if (result.bool) {
				player.line(result.targets);
				trigger.excluded.addArray(result.targets);
			}
		},
	},
	olhuiqi: {
		audio: 2,
		trigger: {
			global: "phaseEnd",
		},
		juexingji: true,
		forced: true,
		skillAnimation: true,
		animationColor: "thunder",
		derivation: "olxieju",
		filter(event, player) {
			const targets = [];
			game.getGlobalHistory("useCard", evt => {
				if (evt.targets?.length) {
					targets.addArray(evt.targets);
				}
			});
			return targets.length == 3 && targets.includes(player);
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			if (player.isDamaged()) {
				await player.recover();
			}
			await player.addSkills("olxieju");
			player.insertPhase();
		},
	},
	olxieju: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return event.olxieju?.length;
		},
		onChooseToUse(event) {
			if (!event.olxieju && !game.online) {
				const targets = [];
				game.getGlobalHistory("useCard", evt => {
					if (evt.targets?.length) {
						targets.addArray(evt.targets);
					}
				});
				event.set("olxieju", targets);
			}
		},
		filterTarget(card, player, target) {
			return get.event().olxieju.includes(target) && target.hasUseTarget({ name: "sha" }, true, false);
		},
		selectTarget: [1, Infinity],
		async content(event, trigger, player) {
			await event.target.chooseUseTarget({ name: "sha" }, "偕举：视为使用一张【杀】", true, false);
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					var val = target.getUseValue({ name: "sha" }, true);
					return Math.sign(val);
				},
			},
		},
	},
};
