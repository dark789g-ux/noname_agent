import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dczhantao" | "dcanjing" | "dcjichun" | "dchanying" | "dclinghui" | "dcxiace" | "dcyuxin">} */
export const groupSkills = {
	//胡遵
	dczhantao: {
		getNumber(card) {
			if (get.is.convertedCard(card)) {
				return card.cards.reduce((num, card) => num + get.number(card, false), 0);
			}
			if (typeof get.number(card, false) == "number") {
				return get.number(card, false);
			}
			return null;
		},
		audio: 2,
		trigger: { global: "damageEnd" },
		filter(event, player) {
			if (!event.card || !event.player.isIn() || (event.player !== player && !player.inRange(event.player))) {
				return false;
			}
			return event.source != player && typeof get.info("dczhantao").getNumber(event.card) == "number";
		},
		check(event, player) {
			if (!event.source?.isIn() || !event.card || typeof get.number(event.card) !== "number") {
				return 0;
			}
			return get.effect(event.source, { name: "sha" }, player, player) >= 0;
		},
		logTarget: "player",
		prompt2(event, player) {
			let str = "你可以判定";
			if (event.source?.isIn()) {
				const num = get.info("dczhantao").getNumber(event.card);
				str += `，若判定结果点数大于${num}，你视为对${get.translation(event.source)}使用一张【杀】。`;
			} else {
				str += "。";
			}
			return str;
		},
		async content(event, trigger, player) {
			player
				.judge(card => {
					const eventName = get.event().eventName;
					const evt = get.event().getParent(eventName).getTrigger();
					if (!evt.source?.isIn() || !evt.card || typeof get.info("dczhantao").getNumber(evt.card) !== "number") {
						return 0;
					}
					if (get.number(card) > get.info("dczhantao").getNumber(evt.card)) {
						return 1.5;
					}
					return 0;
				})
				.set("judge2", result => result.bool)
				.set("callback", event => {
					const evtx = event.getParent();
					const evt = event.getParent(evtx.eventName).getTrigger();
					if (!evt.source?.isIn() || !evt.card || typeof get.info("dczhantao").getNumber(evt.card) !== "number") {
						return;
					}
					if (event.judgeResult.number > get.info("dczhantao").getNumber(evt.card)) {
						const sha = new lib.element.VCard({ name: "sha", isCard: true }),
							target = evt.source;
						if (player.canUse(sha, target, false, false)) {
							player.useCard(sha, target, false);
						}
					}
				})
				.set("eventName", event.name);
		},
	},
	dcanjing: {
		audio: 2,
		trigger: { source: "damageSource" },
		filter(event, player) {
			return game.hasPlayer(current => current.isDamaged());
		},
		usable: 1,
		async cost(event, trigger, player) {
			const skillName = event.skill;
			const maxCount = player.getAllHistory("useSkill", evt => evt.skill === skillName).length + 1;
			event.result = await player
				.chooseTarget(get.prompt2(skillName), (card, player, target) => target.isDamaged(), [1, maxCount])
				.set("ai", target => {
					return get.attitude(get.player(), target) > 0;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const targets = event.targets;
			for (const target of [...targets].sortBySeat(_status.currentPhase)) {
				await target.draw("nodelay");
			}
			await game.delayx();
			const minHp = Math.min(...targets.map(p => p.hp));
			const targetsx = targets.filter(p => p.hp === minHp);
			if (targetsx.length) {
				await targetsx.randomGet().recover();
			}
		},
	},
	//诸葛梦雪
	dcjichun: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("he", card => lib.skill.dcjichun.filterCard(card, player));
		},
		filterCard(card, player) {
			if (!get.cardNameLength(card) || ui.selected.cards.length) {
				return false;
			}
			if (
				game.hasPlayer(target => {
					return target.countCards("h") < player.countCards("h");
				}) &&
				!player.getStorage("dcjichun_used").includes("draw")
			) {
				return true;
			}
			if (
				lib.filter.cardDiscardable(card, player) &&
				game.hasPlayer(target => {
					return target.countCards("h") > player.countCards("h") && target.countDiscardableCards(player, "hej");
				}) &&
				!player.getStorage("dcjichun_used").includes("discard")
			) {
				return true;
			}
			return false;
		},
		selectCard: [1, 2],
		filterTarget(cardx, player, target) {
			if (!ui.selected.cards.length) {
				return false;
			}
			const card = ui.selected.cards[0];
			if (target.countCards("h") < player.countCards("h")) {
				return !player.getStorage("dcjichun_used").includes("draw");
			}
			if (lib.filter.cardDiscardable(card, player) && target.countCards("h") > player.countCards("h") && target.countDiscardableCards(player, "hej")) {
				return !player.getStorage("dcjichun_used").includes("discard");
			}
			return false;
		},
		usable: 2,
		position: "he",
		check(card) {
			return get.cardNameLength(card);
		},
		complexCard: true,
		complexSelect: true,
		lose: false,
		discard: false,
		delay: false,
		targetprompt() {
			const target = ui.selected.targets[0],
				player = get.event().player;
			return target.countCards("h") < player.countCards("h") ? "给牌摸牌" : "双双弃牌";
		},
		async content(event, trigger, player) {
			const card = event.cards[0],
				target = event.target;
			const num = get.cardNameLength(card);
			await player.showCards([card], get.translation(player) + "发动了【寄春】");
			player.addTempSkill("dcjichun_used", "phaseUseAfter");
			if (target.countCards("h") < player.countCards("h")) {
				player.markAuto("dcjichun_used", "draw");
				await player.give(card, target);
				await player.draw(num);
			} else {
				player.markAuto("dcjichun_used", "discard");
				await player.discard(card);
				await player.discardPlayerCard(target, "hej", [1, num]);
			}
		},
		ai: {
			order: 7,
			result: {
				target(player, target) {
					return target.countCards("h") < player.countCards("h") ? get.effect(target, { name: "draw" }, player, target) : get.effect(target, { name: "guohe" }, player, target);
				},
			},
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	dchanying: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		frequent: true,
		async content(event, trigger, player) {
			const card = get.cardPile(card => get.type(card) == "equip" && !get.cardtag(card, "gifts"));
			if (!card) {
				player.chat("无牌可得？！");
				game.log("但是牌堆已经没有装备牌了！");
				return;
			}
			await player.showCards([card], get.translation(player) + "发动了【寒英】");
			if (game.hasPlayer(target => target.countCards("h") == player.countCards("h") && target.hasUseTarget(card))) {
				const { bool, targets } = await player
					.chooseTarget(
						"请选择使用" + get.translation(card) + "的目标角色",
						(card, player, target) => {
							return target.countCards("h") == player.countCards("h") && target.hasUseTarget(get.event().card);
						},
						true
					)
					.set("ai", target => get.effect(target, get.event().card, target, get.event().player))
					.set("card", card)
					.forResult();
				if (bool) {
					const target = targets[0];
					player.line(target);
					target.chooseUseTarget(card, true, "nopopup");
				}
			} else {
				player.chat("无人可装？！");
				game.log("但是场上没有角色可以使用", card, "！");
			}
		},
	},
	//柏灵筠
	dclinghui: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			if (_status.currentPhase === player) {
				return true;
			}
			return game.getGlobalHistory("everything", evt => evt.name == "dying").length;
		},
		frequent: true,
		async content(event, trigger, player) {
			let cards = get.cards(3);
			await game.cardsGotoOrdering(cards);
			const { bool, links } = await player
				.chooseButton(["灵慧：是否使用其中的一张牌并随机获得其中一张剩余牌？", cards])
				.set("filterButton", button => {
					return get.player().hasUseTarget(button.link);
				})
				.set("ai", button => {
					return get.event().player.getUseValue(button.link);
				})
				.forResult();
			if (bool) {
				const card = links[0];
				cards.remove(card);
				player.$gain2(card, false);
				await game.delayx();
				await player.chooseUseTarget(true, card, false);
				cards = cards.filterInD();
				if (cards.length) {
					const cardx = cards.randomRemove();
					await player.gain(cardx, "gain2");
				}
			}
			if (cards.length) {
				cards.reverse();
				game.cardsGotoPile(cards.filterInD(), "insert");
				game.log(player, "将", get.cnNumber(cards.length), "张牌置于了牌堆顶");
			}
		},
	},
	dcxiace: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player) {
			const bool1 = event.player == player && !player.getStorage("dcxiace_used").includes("player") && game.hasPlayer(target => target != player && !target.hasSkill("fengyin"));
			const bool2 =
				event.source &&
				event.source == player &&
				!player.getStorage("dcxiace_used").includes("source") &&
				player.isDamaged() &&
				player.countCards("he", card => {
					if (_status.connectMode && get.position(card) == "h") {
						return true;
					}
					return lib.filter.cardDiscardable(card, player);
				});
			return bool1 || bool2;
		},
		direct: true,
		async content(event, trigger, player) {
			if (trigger.player == player && !player.getStorage("dcxiace_used").includes("player") && game.hasPlayer(target => target != player && !target.hasSkill("fengyin"))) {
				const { bool, targets } = await player
					.chooseTarget((card, player, target) => {
						return target != player && !target.hasSkill("fengyin");
					})
					.set("prompt", get.prompt("dcxiace"))
					.set("prompt2", "令一名其他角色的非锁定技于本回合失效")
					.set("ai", target => {
						const player = get.event().player;
						return (
							-get.sgn(get.attitude(player, target)) *
							(target.getSkills(null, false, false).filter(skill => {
								return !get.is.locked(skill);
							}).length +
								1) *
							(target === _status.currentPhase ? 10 : 1)
						);
					})
					.forResult();
				if (bool) {
					const target = targets[0];
					player.logSkill("dcxiace", target);
					player.addTempSkill("dcxiace_used");
					player.markAuto("dcxiace_used", "player");
					target.addTempSkill("fengyin");
				}
			}
			if (
				trigger.source &&
				trigger.source == player &&
				!player.getStorage("dcxiace_used").includes("source") &&
				player.isDamaged() &&
				player.countCards("he", card => {
					if (_status.connectMode && get.position(card) == "h") {
						return true;
					}
					return lib.filter.cardDiscardable(card, player);
				}) &&
				player.hasSkill("dcxiace")
			) {
				const { bool } = await player
					.chooseToDiscard("he", get.prompt("dcxiace"), "弃置一张牌并回复1点体力")
					.set("ai", card => {
						const player = get.event().player;
						if (get.recoverEffect(player, player, player) <= 0) {
							return 0;
						}
						return 7 - get.value(card);
					})
					.set("logSkill", "dcxiace")
					.forResult();
				if (bool) {
					player.addTempSkill("dcxiace_used");
					player.markAuto("dcxiace_used", "source");
					await player.recover();
				}
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	dcyuxin: {
		limited: true,
		audio: 2,
		trigger: { global: "dying" },
		filter(event, player) {
			return event.player.hp < (event.player == player ? 1 : player.getHp());
		},
		prompt2(event, player) {
			return "令其将体力值回复至" + (event.player == player ? 1 : player.getHp()) + "点";
		},
		check(event, player) {
			if (get.recoverEffect(event.player, player, player) <= 0) {
				return false;
			}
			return lib.skill.luanfeng.check(event, player);
		},
		logTarget: "player",
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			trigger.player.recover((trigger.player == player ? 1 : player.getHp()) - trigger.player.hp);
		},
	},
};
