import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twguanhuo" | "twjuxia" | "twjiwei">} */
export const groupSkills = {
	//外服起皇甫嵩
	twguanhuo: {
		audio: "jsrgguanhuo",
		enable: "phaseUse",
		viewAs: {
			name: "huogong",
			isCard: true,
			storage: { twguanhuo: true },
		},
		precontent() {
			player.addTempSkill("twguanhuo_effect");
		},
		filterCard: () => false,
		selectCard: -1,
		prompt: "视为使用一张【火攻】",
		ai: {
			order(item, player) {
				return get.order({ name: "huogong" }) + 0.01;
			},
			effect: {
				player(card, player) {
					if (
						_status.event.getParent().skill == "twguanhuo" &&
						player.getHistory("useSkill", evt => {
							return evt.skill == "twguanhuo" && evt.event.getParent("phaseUse") === _status.event.getParent("phaseUse");
						}).length == 1
					) {
						return "zeroplayertarget";
					}
					if (
						_status.event.type == "phase" &&
						_status.event.skill == "twguanhuo" &&
						player.getHistory("useSkill", evt => {
							return evt.skill == "twguanhuo" && evt.event.getParent("phaseUse") === _status.event.getParent("phaseUse");
						}).length > 1 &&
						player.countCards("h") <= 3
					) {
						return [0, 0];
					}
				},
			},
		},
		group: "twguanhuo_draw",
		subSkill: {
			draw: {
				audio: "jsrgguanhuo",
				trigger: { player: "useCard" },
				filter(event, player) {
					return event.card.name === "huogong";
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.draw();
				},
			},
			effect: {
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.card?.storage?.twguanhuo && !game.hasPlayer2(current => current.hasHistory("damage", evt => evt.card == event.card));
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const count = player.getHistory("useSkill", evt => {
						return evt.skill == "twguanhuo" && evt.event.getParent("phaseUse") === trigger.getParent("phaseUse");
					}).length;
					if (count == 1) {
						player.addTempSkill("twguanhuo_ex", "phaseUseAfter");
						player.addMark("twguanhuo_ex", 1, false);
						trigger.targets.forEach(i => i.removeSkill("huogong2"));
					} else {
						await player.removeSkills("twguanhuo");
					}
				},
			},
			ex: {
				charlotte: true,
				onremove: true,
				intro: { content: "你使用【火攻】造成的伤害+#" },
				trigger: { source: "damageBegin1" },
				filter(event, player) {
					return event.card?.name == "huogong" && event.getParent().type == "card";
				},
				forced: true,
				popup: false,
				content() {
					trigger.num += player.countMark("twguanhuo_ex");
				},
			},
		},
	},
	twjuxia: {
		audio: "jsrgjuxia",
		trigger: {
			player: "phaseZhunbeiBegin",
			target: "useCardToTargeted",
		},
		filter(event, player) {
			if (event.name === "phaseZhunbei") {
				return !player.hasSkill("jsrgguanhuo", null, false, false);
			} else if (player.hasSkill("twjuxia_used")) {
				return false;
			}
			return event.player !== player && lib.skill.jsrgjuxia.countSkill(event.player) > lib.skill.jsrgjuxia.countSkill(player);
		},
		logTarget: "player",
		derivation: "jsrgguanhuo",
		prompt2(event, player) {
			if (event.name !== "phaseZhunbei") {
				return `令${get.translation(event.card)}对你无效，然后你摸两张牌`;
			}
			return `获得技能〖观火〗`;
		},
		frequent(event, player) {
			return event.name === "phaseZhunbei";
		},
		check(event, player) {
			return (
				event.name === "phaseZhunbei" ||
				get.effect(player, { name: "draw" }, player, player) * 2 - get.effect(player, event.card, event.player, player) > 0
			);
		},
		async content(event, trigger, player) {
			if (trigger.name === "phaseZhunbei") {
				await player.addSkills("jsrgguanhuo");
			} else {
				player.addTempSkill("twjuxia_used");
				trigger.excluded.add(player);
				game.log(trigger.card, "对", player, "无效");
				await player.draw(2);
			}
		},
		ai: {
			effect: {
				target_use(card, player, target) {
					if (lib.skill.jsrgjuxia.countSkill(target) >= lib.skill.jsrgjuxia.countSkill(player)) {
						return;
					}
					if (card && (card.cards || card.isCard) && !target.hasSkill("twjuxia_used")) {
						return [0, 0.5, 0, 0.5];
					}
				},
			},
		},
		subSkill: {
			used: { charlotte: true },
		},
	},
	//TW甄姬
	twjiwei: {
		inherit: "mbjiwei",
		audio: "mbjiwei",
		getNum(event, player) {
			let num = 0;
			if (game.countPlayer2(current => current.hasHistory("lose")) >= 1) {
				num++;
			}
			if (game.countPlayer2(current => current.hasHistory("damage")) >= 1) {
				num++;
			}
			if (event.name == "phase") {
				return num * 2;
			}
			if (game.hasPlayer2(current => !current.isAlive())) {
				return 114514;
			}
			return 5;
		},
		filter(event, player) {
			const num = get.info("twjiwei").getNum(event, player);
			if (event.name == "phaseZhunbei") {
				return player.countCards("h") >= num && game.hasPlayer(current => current != player);
			}
			return event.player != player && num > 0;
		},
	},
};
