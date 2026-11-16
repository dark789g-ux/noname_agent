import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olzhuiji">} */
export const groupSkills = {
	//群马超
	olzhuiji: {
		mod: {
			globalFrom(from, to) {
				if (from.hp >= to.hp) {
					return -Infinity;
				}
			},
		},
		audio: "zhuiji",
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return event.card.name == "sha" && event.target.countCards("he") > 0 && get.distance(player, event.target) == 1;
		},
		forced: true,
		logTarget: "target",
		content() {
			"step 0";
			var target = trigger.target;
			event.target = target;
			if (target.countCards("e") == 0) {
				event._result = { index: 0 };
			} else {
				target
					.chooseControl()
					.set("choiceList", ["弃置一张牌", "重铸装备区的所有牌"])
					.set("ai", function (card) {
						var min = Infinity,
							equ = 0,
							es = player.getCards("e"),
							hs = player.getCards("he");
						for (var i of hs) {
							var val = get.value(i);
							min = Math.min(min, val);
							if (es.includes(i)) {
								equ += val;
							}
						}
						equ /= es.length;
						if (min < equ - 1) {
							return 0;
						}
						return 1;
					});
			}
			"step 1";
			if (result.index == 0) {
				target.chooseToDiscard("he", true);
			} else {
				target.recast(target.getCards("e", lib.filter.cardRecastable));
			}
		},
	},
};
