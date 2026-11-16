import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "jixian" | "lanjiang" | "spolzhouxuan">} */
export const groupSkills = {
	//朱灵
	jixian: {
		audio: 2,
		trigger: { player: "phaseDrawAfter" },
		filter(event, player) {
			return game.hasPlayer(current => current != player && lib.skill.jixian.getNum(player, current) > 0 && player.canUse("sha", current, false));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target != player && lib.skill.jixian.getNum(player, target) > 0 && player.canUse("sha", target, false);
				})
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "sha" }, player, player) * Math.sqrt(lib.skill.jixian.getNum(player, target));
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const num = lib.skill.jixian.getNum(player, target);
			const sha = get.autoViewAs({ name: "sha", isCard: true });
			if (player.canUse(sha, target, false)) {
				await player.useCard(sha, target, false);
				if (num > 0) {
					await player.draw(num);
				}
				if (!player.hasHistory("sourceDamage", evt => evt.getParent(3) == event)) {
					await player.loseHp();
				}
			}
		},
		getNum(player, target) {
			let num = 0;
			if (target.isHealthy()) {
				num++;
			}
			if (target.getEquips(2).length) {
				num++;
			}
			const countSkill = player => {
				return player.getSkills(null, false, false).filter(skill => {
					const info = get.info(skill);
					if (!info || info.charlotte) {
						return false;
					}
					if (info.zhuSkill) {
						return player.hasZhuSkill(skill);
					}
					return true;
				}).length;
			};
			if (countSkill(player) < countSkill(target)) {
				num++;
			}
			return num;
		},
	},
	//吾彦
	lanjiang: {
		audio: 2,
		audioname2: { heqi: "lanjiang_heqi" },
		trigger: { player: "phaseJieshuBegin" },
		logTarget(event, player) {
			return game.filterPlayer(current => current.countCards("h") >= player.countCards("h")).sortBySeat();
		},
		async content(event, trigger, player) {
			for (const target of event.targets) {
				if (!target.isIn()) {
					continue;
				}
				const result = await target
					.chooseBool(`是否令${player == target ? "自己" : get.translation(player)}摸一张牌？`)
					.set("choice", get.attitude(target, player) > 0)
					.forResult();
				if (result?.bool) {
					target.line(player);
					if (player !== target && (get.mode() !== "identity" || target.identity !== "nei")) {
						target.addExpose(0.15);
					}
					await player.draw();
				}
			}
			const result = await player
				.chooseTarget("是否对一名手牌数等于自己的目标角色造成1点伤害？", (card, player, target) => {
					return get.event().getParent().targets.includes(target) && target.countCards("h") == player.countCards("h");
				})
				.set("ai", target => {
					const player = get.player();
					return get.damageEffect(target, player, player);
				})
				.forResult();
			if (!result?.targets?.length) {
				return;
			}
			const [target] = result.targets;
			player.line(target, "green");
			if (get.mode() !== "identity" || player.identity !== "nei") {
				player.addExpose(0.15);
			}
			await target.damage();
			if (event.targets.some(target => target.isIn() && target.countCards("h") < player.countCards("h"))) {
				const result = await player
					.chooseTarget(
						"请选择一名手牌数小于自己的目标角色，令其摸一张牌",
						(card, player, target) => {
							return get.event().getParent().targets.includes(target) && target.countCards("h") < player.countCards("h");
						},
						true
					)
					.set("ai", target => {
						const player = get.player();
						return get.effect(target, { name: "draw" }, player, player);
					})
					.forResult();
				if (!result?.targets?.length) {
					return;
				}
				const [target] = result.targets;
				player.line(target);
				if (player !== target && (get.mode() !== "identity" || player.identity !== "nei")) {
					player.addExpose(0.1);
				}
				await target.draw();
			}
		},
	},
	//新SP张郃
	spolzhouxuan: {
		audio: 2,
		trigger: { player: ["phaseDiscardBegin", "useCard", "phaseUseEnd"] },
		filter(event, player) {
			if (event.name == "phaseDiscard") {
				return player.countCards("h") && player.getExpansions("spolzhouxuan").length < 5;
			}
			return player.countExpansions("spolzhouxuan");
		},
		preHidden: true,
		async cost(event, trigger, player) {
			if (trigger.name != "phaseDiscard") {
				event.result = { bool: true };
			} else {
				event.result = await player
					.chooseCard("h", get.prompt(event.skill), [1, 5 - player.countExpansions(event.skill)], `将至多${get.cnNumber(5 - player.countExpansions(event.skill))}张手牌置于武将牌上`)
					.set("allowChooseAll", true)
					.set("ai", card => {
						const player = get.player();
						if (ui.selected.cards.length >= player.needsToDiscard()) {
							return 6 - get.value(card);
						}
						return 100 - get.useful(card);
					})
					.setHiddenSkill(event.skill)
					.forResult();
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "phaseDiscard") {
				const next = player.addToExpansion(event.cards, player, "give");
				next.gaintag.add(event.name);
				await next;
			} else if (trigger.name == "useCard") {
				await player.loseToDiscardpile(player.getExpansions(event.name).randomGet());
				let num = 1;
				if (!player.isMaxHandcard(true)) {
					num += player.countExpansions(event.name);
				}
				await player.draw(num);
			} else {
				await player.loseToDiscardpile(player.getExpansions(event.name));
			}
		},
		marktext: "旋",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		onremove(player, skill) {
			const cards = player.getExpansions(skill);
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
	},
};
