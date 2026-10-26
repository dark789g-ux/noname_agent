import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olzhibin" | "olsbbojue" | "olsbyangwei">} */
export const groupSkills = {
	olzhibin: {
		audio: 6,
		getNum(player) {
			let num = 0;
			game.countPlayer2(current => {
				if (current != player && current.group == "qun") {
					num += current.getAllHistory("useCard", evt => get.color(evt.card) == "black").length;
				}
			});
			return num;
		},
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		filter(event, player) {
			const num = get.info("olzhibin").getNum(player);
			return get.info("olzhibin").filterx(player, num) || get.info("olzhibin").filtery(player, num) || get.info("olzhibin").filterz(player, num);
		},
		filterx(player, num) {
			return num >= 3 && !game.getAllGlobalHistory("everything", evt => evt.name == "gainMaxHp" && evt.player == player && evt.getParent().name == "olzhibin").length;
		},
		filtery(player, num) {
			return num >= 6 && !player.hasSkill("dcfencheng", null, null, false) && !game.getAllGlobalHistory("everything", evt => evt.name == "changeSkills" && evt.player == player && evt.getParent().name == "olzhibin" && evt.addSkill.includes("dcfencheng")).length;
		},
		filterz(player, num) {
			return num >= 9 && !player.hasSkill("benghuai", null, null, false) && !game.getAllGlobalHistory("everything", evt => evt.name == "changeSkills" && evt.player == player && evt.getParent().name == "olzhibin" && evt.addSkill.includes("benghuai")).length;
		},
		zhuSkill: true,
		forced: true,
		async content(event, trigger, player) {
			const skillName = event.name,
				num = get.info(skillName).getNum(player);
			if (get.info(skillName).filterx(player, num)) {
				await player.gainMaxHp();
				await player.recover();
			}
			if (get.info(skillName).filtery(player, num)) {
				await player.addSkills("dcfencheng");
			}
			if (get.info(skillName).filterz(player, num)) {
				await player.addSkills("benghuai");
			}
		},
		derivation: ["dcfencheng", "benghuai"],
	},
	//谋华雄
	olsbbojue: {
		audio: 2,
		enable: "phaseUse",
		filterTarget: lib.filter.notMe,
		usable: 2,
		async content(event, trigger, player) {
			const target = event.target,
				targets = [player, target],
				total = player.countCards("h") + target.countCards("h");
			const map = await game.chooseAnyOL(targets, get.info(event.name).chooseCard, [targets]).forResult();
			let count = 0;
			for (const i of targets) {
				const result = map.get(i);
				i.popup(result.bool ? "弃牌" : "摸牌");
				if (result.bool) {
					count++;
				}
			}
			switch (count) {
				case 0:
					await player.draw("nodelay");
					await target.draw();
					break;
				case 2:
					await game
						.loseAsync({
							lose_list: [
								[player, map.get(player).cards],
								[target, map.get(target).cards],
							],
						})
						.setContent("discardMultiple");
					break;
				default:
					for (const current of [player, target]) {
						if (map.get(current).bool) {
							await current.discard(map.get(current).cards);
						} else {
							await current.draw();
						}
					}
					break;
			}
			await game.delay(0.5);
			switch (Math.abs(total - player.countCards("h") - target.countCards("h"))) {
				case 0:
					for (const current of [player, target]) {
						const aim = current === player ? target : player;
						if (current.isIn()) {
							current.line(aim);
							await current.discardPlayerCard(aim, "he", true);
						}
					}
					break;
				case 2:
					for (const current of [player, target]) {
						const aim = current === player ? target : player;
						const sha = new lib.element.VCard({ name: "sha", isCard: true });
						if (current.isIn() && current.canUse(sha, aim, false)) {
							current.line(aim);
							await current.useCard(sha, aim, false, "noai");
						}
					}
					break;
			}
		},
		ai: {
			order: 4,
			result: {
				player(player, target) {
					return get.effect(player, { name: "guohe" }, target, player) + get.effect(player, { name: "sha" }, target, player);
				},
				target(player, target) {
					return get.effect(target, { name: "guohe" }, player, target) + get.effect(target, { name: "sha" }, player, target);
				},
			},
		},
		chooseCard(player, targets, eventId) {
			const str = get.translation(targets[0] == player ? targets[1] : targets[0]);
			return player
				.chooseCard("he", (card, player) => {
					return lib.filter.cardDiscardable(card, player, "olsbbojue");
				})
				.set("prompt", "搏决：弃置一张牌，或点击“取消”摸一张牌")
				.set("prompt2", "若你与" + str + "的手牌数之和的变化值为：0，你与其依次弃置对方一张牌；2，你与其依次视为对对方使用一张【杀】")
				.set("ai", card => {
					return 0;
				})
				.set("id", eventId)
				.set("_global_waiting", true);
		},
	},
	olsbyangwei: {
		audio: 2,
		trigger: { player: "gainAfter" },
		filter(event, player) {
			if (event.getParent().name !== "draw" || event.getParent("phaseDraw").player === player) {
				return false;
			}
			let history = player.getHistory(
				"gain",
				evt => {
					return evt.getParent().name === "draw" && evt.getParent("phaseDraw").player !== player;
				},
				event
			);
			history = history
				.slice()
				.map(evt => evt.cards)
				.flat();
			return history.length >= 2 && event.cards.includes(history[1]);
		},
		forced: true,
		usable: 1,
		content() {
			player.addSkill("olsbyangwei_attack");
			player.addMark("olsbyangwei_attack", 1, false);
		},
		group: "olsbyangwei_discard",
		subSkill: {
			discard: {
				audio: "olsbyangwei",
				trigger: {
					player: "loseAfter",
					global: "loseAsyncAfter",
				},
				filter(event, player) {
					if (player.countSkill("olsbyangwei_discard")) {
						return false;
					}
					if (event.type != "discard" || event.getlx === false || event.getParent("phaseDiscard").player === player) {
						return false;
					}
					if (!event.getl(player)?.cards2?.length) {
						return false;
					}
					let history = game.getGlobalHistory(
						"everything",
						evt => {
							if (evt.name !== "loseAsync" && (event.name !== "lose" || evt.player !== player)) {
								return false;
							}
							if (evt.type != "discard" || evt.getlx === false || evt.getParent("phaseDiscard").player === player) {
								return false;
							}
							return evt.getl(player)?.cards2?.length > 0;
						},
						event
					);
					history = history
						.slice()
						.map(evt => evt.getl(player).cards2)
						.flat();
					return history.length >= 2 && event.getl(player).cards2.includes(history[1]);
				},
				forced: true,
				usable: 1,
				content() {
					player.addSkill("olsbyangwei_defend");
					player.addMark("olsbyangwei_defend", 1, false);
				},
			},
			attack: {
				audio: "olsbyangwei",
				charlotte: true,
				onremove: true,
				trigger: { source: "damageBegin1" },
				forced: true,
				content() {
					trigger.num += player.countMark(event.name);
					player.removeSkill(event.name);
				},
				markimage: "image/card/pss_stone.png",
				intro: {
					name: "扬威 - 增伤",
					content: "下次造成的伤害+#",
				},
				ai: {
					damageBonus: true,
					effect: {
						player(card, player, target) {
							if (get.tag(card, "damage")) {
								return [1, 0, 2, 0];
							}
						},
					},
				},
			},
			defend: {
				audio: "olsbyangwei",
				charlotte: true,
				onremove: true,
				trigger: { player: "damageBegin2" },
				forced: true,
				content() {
					trigger.num += player.countMark(event.name);
					player.removeSkill(event.name);
				},
				markimage: "image/card/pss_paper.png",
				intro: {
					name: "扬威 - 受伤",
					content: "下次受到的伤害+#",
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (get.tag(card, "damage")) {
								return 2;
							}
						},
					},
				},
			},
		},
	},
};
