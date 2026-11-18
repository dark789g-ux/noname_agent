import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twchengxi">} */
export const groupSkills = {
	//夏侯子萼
	//差点和夏侯紫萼搞混
	twchengxi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => lib.skill.twchengxi.filterTarget(null, player, target));
		},
		filterTarget(card, player, target) {
			if (player.getStorage("twchengxi_used").includes(target) || target == player) {
				return false;
			}
			return player.canCompare(target, true);
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (!player.storage.twchengxi_used) {
				player.when("phaseUseAfter").step(async () => delete player.storage.twchengxi_used);
			}
			player.markAuto("twchengxi_used", [target]);
			await player.draw();
			if (player.canCompare(target)) {
				const result = await player.chooseToCompare(target).forResult();
				if (!result) {
					return;
				}
				if (result.bool) {
					player.addSkill("twchengxi_effect");
				} else {
					const card = { name: "sha", isCard: true };
					if (target.canUse(card, player, false)) {
						await target.useCard(card, player, false);
					}
					player.addSkill("twchengxi_add");
					player.markAuto("twchengxi_add", [target]);
				}
			}
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (player.hasSkill("twchengxi_effect")) {
						return 0;
					}
					var hs = player.getCards("h").sort((a, b) => b.number - a.number);
					var ts = target.getCards("h").sort((a, b) => b.number - a.number);
					if (!hs.length || !ts.length) {
						return 0;
					}
					if (hs[0].number > ts[0].number) {
						return -3;
					}
					if (!target.canUse({ name: "sha", isCard: true }, player, false)) {
						return -1;
					}
					return 0;
				},
			},
		},
		subSkill: {
			add: {
				popup: false,
				charlotte: true,
				onremove: true,
				trigger: { player: "useCard2" },
				filter(event, player) {
					if (!["basic", "trick"].includes(get.type(event.card))) {
						return false;
					}
					if (!Array.isArray(event.targets)) {
						return false;
					}
					return game.hasPlayer(target => {
						if (!player.getStorage("twchengxi_add").includes(target)) {
							return false;
						}
						return !event.targets.includes(target) && lib.filter.targetEnabled2(event.card, player, target);
					});
				},
				async cost(event, trigger, player) {
					const targets = game.filterPlayer(target => {
						if (!player.getStorage("twchengxi_add").includes(target)) {
							return false;
						}
						return !trigger.targets.includes(target) && lib.filter.targetEnabled2(trigger.card, player, target);
					});
					if (targets.length == 1) {
						const target = targets[0];
						const { bool } = await player
							.chooseBool(
								get.prompt(event.skill, target),
								"令" + get.translation(target) + "也成为" + get.translation(trigger.card) + "的目标"
							)
							.forResult();
						event.result = { bool: bool, targets: targets };
					} else {
						event.result = await player
							.chooseTarget(
								get.prompt(event.skill),
								"令任意名【承袭】的目标角色也成为" + get.translation(trigger.card) + "的目标",
								(card, player, target) => {
									const trigger = get.event().getTrigger();
									if (!player.getStorage("twchengxi_add").includes(target)) {
										return false;
									}
									return !trigger.targets.includes(target) && lib.filter.targetEnabled2(trigger.card, player, target);
								},
								[1, player.getStorage("twchengxi_add").length]
							)
							.set("ai", target => {
								const player = get.player(),
									trigger = get.event().getTrigger();
								return get.effect(target, trigger.card, player, player);
							})
							.forResult();
					}
				},
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					player.line(event.targets);
					trigger.targets.addArray(event.targets);
					game.log(event.targets, "成为了", trigger.card, "的额外目标");
				},
				intro: {
					content: "你使用的下一张基本牌和普通锦囊牌可以额外指定 $ 为目标",
				},
			},
			effect: {
				charlotte: true,
				trigger: { player: "useCard1" },
				filter(event, player) {
					return get.type(event.card) == "basic" || get.type(event.card) == "trick";
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.removeSkill(event.name);
					trigger.effectCount++;
				},
				mark: true,
				marktext: "袭",
				intro: {
					content: "使用的下一张基本牌或普通锦囊牌额外结算一次",
				},
			},
		},
	},
};
