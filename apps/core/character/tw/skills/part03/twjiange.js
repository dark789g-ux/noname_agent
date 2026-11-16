import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twjiange" | "twxiawang">} */
export const groupSkills = {
	//徐庶
	twjiange: {
		audio: 2,
		enable: ["chooseToUse", "chooseToRespond"],
		filterCard(card, player) {
			return get.type(card) != "basic";
		},
		usable: 1,
		locked: false,
		viewAs: { name: "sha", storage: { twjiange: true } },
		viewAsFilter(player) {
			if (!player.countCards("hes", card => get.type(card) != "basic")) {
				return false;
			}
		},
		position: "hes",
		selectCard() {
			return _status.event.skill == "twjiange" ? 1 : Infinity;
		},
		precontent() {
			if (player != _status.currentPhase) {
				player
					.when({ player: ["useCard", "respond"] })
					.filter(evt => evt.skill == "twjiange")
					.step(async () => await player.draw());
			}
			event.getParent().addCount = false;
		},
		prompt: "将一张非基本牌当杀使用或打出",
		check(card) {
			var val = get.value(card);
			if (_status.event.name == "chooseToRespond") {
				return 1 / Math.max(0.1, val);
			}
			return 6 - val;
		},
		ai: {
			order(item, player) {
				var target = _status.currentPhase;
				if (!target || target != player) {
					return 7;
				}
				return 1;
			},
			respondSha: true,
			skillTagFilter(player) {
				if (!player.countCards("hes", card => get.type(card) != "basic")) {
					return false;
				}
			},
		},
		mod: {
			targetInRange(card) {
				if (card.storage?.twjiange) {
					return true;
				}
			},
			cardUsable(card, player, num) {
				if (card.storage?.twjiange) {
					return Infinity;
				}
			},
		},
	},
	twxiawang: {
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			if (!event.source || get.distance(player, event.player) > 1 || !player.canUse("sha", event.source, false, false)) {
				return false;
			}
			return player.hasUsableCard("sha", "use");
		},
		direct: true,
		clearTime: true,
		content() {
			player
				.chooseToUse(
					function (card, player, event) {
						if (get.name(card) != "sha") {
							return false;
						}
						return lib.filter.filterCard.apply(this, arguments);
					},
					"侠望：是否对" + get.translation(trigger.source) + "使用一张杀？"
				)
				.set("logSkill", "twxiawang")
				.set("complexSelect", true)
				.set("filterTarget", function (card, player, target) {
					if (target != _status.event.sourcex && !ui.selected.targets.includes(_status.event.sourcex)) {
						return false;
					}
					return lib.filter.filterTarget.apply(this, arguments);
				})
				.set("sourcex", trigger.source);
			player.addTempSkill("twxiawang_damage");
		},
		subSkill: {
			damage: {
				trigger: { player: "useCardAfter" },
				forced: true,
				popup: false,
				charlotte: true,
				filter(event, player) {
					if (event.card.name != "sha") {
						return false;
					}
					if (event.getParent(2).name != "twxiawang") {
						return false;
					}
					if (!player.hasHistory("sourceDamage", evt => evt.card == event.card)) {
						return false;
					}
					return lib.phaseName.some(phase => {
						const evt = event.getParent(phase);
						return evt?.name === phase;
					});
				},
				content() {
					player.removeSkill(event.name);
					for (const phase of lib.phaseName) {
						const evt = event.getParent(phase);
						if (evt?.name === phase) {
							const name = get.translation(phase);
							game.log(player, "令", _status.currentPhase, "结束了" + name);
							player.line(_status.currentPhase, "thunder");
							evt.skipped = true;
						}
					}
				},
			},
		},
	},
};
