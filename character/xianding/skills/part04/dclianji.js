import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dclianji" | "dcmoucheng">} */
export const groupSkills = {
	//十周年王允
	dclianji: {
		enable: "phaseUse",
		audio: "wylianji",
		usable: 1,
		check(card) {
			return 5 - get.value(card);
		},
		filterTarget(card, player, target) {
			return target != player;
		},
		filterCard: true,
		content() {
			"step 0";
			var card = get.cardPile2(function (card) {
				return get.subtype(card) == "equip1" && targets[0].hasUseTarget(card);
			}, "random");
			if (card) {
				if (card.name == "qinggang" && !lib.inpile.includes("qibaodao")) {
					card.remove();
					card = game.createCard("qibaodao", card.suit, card.number);
				}
				targets[0].chooseUseTarget(card, true, "nopopup", "nothrow");
			} else {
				player.chat("没有装备牌了吗");
				game.log("但是牌堆里已经没有装备牌了！");
			}
			"step 1";
			game.updateRoundNumber();
			targets[0]
				.chooseToUse(get.translation(player) + "对你发动了【连计】", { name: "sha" })
				.set("targetRequired", true)
				.set("complexSelect", true)
				.set("filterTarget", function (card, player, target) {
					if (target == _status.event.source) {
						return false;
					}
					return lib.filter.filterTarget.apply(this, arguments);
				})
				.set("addCount", false)
				.set("source", player)
				.set("prompt2", "对除" + get.translation(player) + "外的一名角色使用一张【杀】，并将装备区内的武器牌交给其中一名目标角色；或点击“取消”，令" + get.translation(player) + "视为对你使用一张【杀】，并获得你装备区内的武器牌");
			"step 2";
			var card = targets[0].getEquips(1);
			if (result.bool) {
				player.addSkill("dclianji_1");
				if (card.length && result.targets.filter(target => target.isIn()).length > 0) {
					event.card = card;
					targets[0]
						.chooseTarget(true, "将" + get.translation(card) + "交给一名目标角色", (card, player, target) => {
							return _status.event.targets.includes(target);
						})
						.set("ai", function (target) {
							var card = _status.event.getParent().card[0];
							return (target.hasSkillTag("nogain") ? 0 : get.attitude(_status.event.player, target)) * Math.max(0.1, target.getUseValue(card));
						})
						.set("targets", result.targets);
				} else {
					event.finish();
				}
			} else {
				player.addSkill("dclianji_2");
				event.goto(4);
			}
			"step 3";
			targets[0].give(card, result.targets[0], "give");
			event.finish();
			"step 4";
			player.useCard({ name: "sha", isCard: true }, targets[0], false);
			"step 5";
			var card = targets[0].getEquips(1);
			if (card.length) {
				targets[0].give(card, player, "give");
			}
		},
		ai: {
			order: 4,
			result: {
				target(player, target) {
					if (game.countPlayer() === 2) {
						return -3;
					}
					let val = 0;
					let ev = target
						.getEquips(1)
						.map(card => get.value(card, target))
						.sort((a, b) => a - b);
					if (target.hasEquipableSlot(1) && !target.hasEmptySlot(1)) {
						// 要顶掉原来的武器
						val -= ev[0] || 0;
					}
					let nouse = get.effect(target, { name: "sha", isCard: true }, player, target);
					if (!player.hasSkillTag("nogain")) {
						nouse += get.sgnAttitude(target, player) * get.value({ name: "qinggang" }, player);
					}
					if (target.mayHaveSha(player, "use")) {
						const use =
							game
								.filterPlayer(current => current !== player && current !== target)
								.reduce((max, current) => {
									let eff = get.effect(current, { name: "sha" }, target, target);
									if (!current.hasSkillTag("nogain")) {
										eff += get.sgnAttitude(target, current) * get.value({ name: "qinggang" }, current);
									}
									return Math.max(max, eff);
								}, 0) - get.value({ name: "sha" }, target);
						return Math.max(use, nouse);
					}
					return nouse;
				},
			},
		},
		subSkill: {
			1: { charlotte: true, onremove: true },
			2: { charlotte: true, onremove: true },
		},
	},
	dcmoucheng: {
		trigger: { player: "phaseZhunbeiBegin" },
		audio: "moucheng",
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		derivation: "xinjingong",
		filter(event, player) {
			return player.hasSkill("dclianji_1") && player.hasSkill("dclianji_2");
		},
		content() {
			player.awakenSkill(event.name);
			player.changeSkills(["xinjingong"], ["dclianji"]);
		},
		ai: { combo: "dclianji" },
	},
};
