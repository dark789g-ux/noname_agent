import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<importCardConfig["skill"], "lanyinjia" | "lanyinjia2" | "zhungangshuo" | "qibaodao" | "qibaodao2" | "g_jinchan" | "g_jinchan2" | "yinyueqiang" | "caomu_skill" | "caomu_skill2">} */
export const skills = {
	lanyinjia: {
		equipSkill: true,
		enable: ["chooseToUse", "chooseToRespond"],
		filterCard: true,
		viewAs: { name: "shan" },
		viewAsFilter(player) {
			if (!player.countCards("hs")) {
				return false;
			}
		},
		position: "hs",
		prompt: "将一张手牌当闪使用或打出",
		check(card) {
			return 6 - get.value(card);
		},
		ai: {
			respondShan: true,
			skillTagFilter(player) {
				if (!player.countCards("hs")) {
					return false;
				}
			},
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "respondShan") && current < 0 && target.countCards("hs")) {
						return 0.59;
					}
				},
			},
			order: 4,
			useful: -0.5,
			value: -0.5,
		},
	},
	lanyinjia2: {
		equipSkill: true,
		trigger: { player: "damageBegin4" },
		forced: true,
		filter(event, player) {
			return event.card && event.card.name === "sha" && player.getEquips("lanyinjia").length > 0;
		},
		async content(event, trigger, player) {
			const cards = player.getEquips("lanyinjia");
			if (cards.length) {
				await player.discard({ cards });
			}
		},
	},
	zhungangshuo: {
		equipSkill: true,
		trigger: { player: "useCardToPlayered" },
		logTarget: "target",
		filter(event, player) {
			return event.card.name === "sha" && (event.player.hasCards("h") || player.hasCards("h"));
		},
		check(event, player) {
			const target = event.target;
			if (get.attitude(player, target) >= 0) {
				return false;
			}
			if (player.hasCard(card => get.value(card) >= 8)) {
				return false;
			}
			const n1 = event.target.countCards("h");
			return n1 > 0 && n1 <= player.countCards("h");
		},
		async content(event, trigger, player) {
			await game.delayx();
			await trigger.target.discardPlayerCard({
				target: player,
				position: "h",
				forced: true,
			});
			await player.discardPlayerCard({
				target: trigger.target,
				position: "h",
				forced: true,
			});
		},
	},
	qibaodao: {
		audio: "qibaodao2",
		equipSkill: true,
		trigger: { source: "damageBegin1" },
		forced: true,
		logTarget: "player",
		filter(event) {
			return event.card && event.card.name === "sha" && event.player.isHealthy() && event.notLink();
		},
		async content(event, trigger, player) {
			trigger.num++;
		},
		ai: {
			effect: {
				player(card, player, target, current, isLink) {
					if (card.name === "sha" && !isLink && target.isHealthy() && get.attitude(player, target) > 0) {
						return [1, -2];
					}
				},
			},
		},
	},
	qibaodao2: {
		inherit: "qinggang_skill",
		audio: true,
	},
	g_jinchan: {
		cardSkill: true,
		trigger: { target: "useCardToBefore" },
		forced: true,
		popup: false,
		filter(event, player) {
			if (event.player === player) {
				return false;
			}
			const directHit = event.getParent()?.directHit;
			if (directHit === true || (Array.isArray(directHit) && directHit.includes(player))) {
				return false;
			}
			const num = player.countCards("h", "jinchan");
			return num > 0 && num === player.countCards("h");
		},
		async content(event, trigger, player) {
			const next = player
				.chooseToUse({ prompt: `是否对${get.translation(trigger.card)}使用【金蝉脱壳】？` })
				.set("ai1", () => _status.event.bool)
				.set("bool", -get.effect(player, trigger.card, trigger.player, player))
				.set("respondTo", [trigger.player, trigger.card])
				.set("filterCard", (card, player) => {
					if (get.name(card) !== "jinchan") {
						return false;
					}
					return lib.filter.cardEnabled(card, player, "forceEnable");
				});
			trigger.jinchan = true;
			await next;
			delete trigger.jinchan;
		},
	},
	g_jinchan2: {
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		forced: true,
		cardSkill: true,
		filter(event, player) {
			if (event.type !== "discard") {
				return false;
			}
			const evt = event.getl(player);
			if (!evt || !evt.cards2 || !evt.cards2.length) {
				return false;
			}
			for (const card of evt.cards2) {
				if (card.name === "jinchan") {
					return true;
				}
			}
			return false;
		},
		async content(event, trigger, player) {
			let num = 0;
			const cards = trigger.getl(player).cards2;
			for (const card of cards) {
				if (card.name === "jinchan") {
					num++;
				}
			}
			if (num) {
				await player.draw(num);
			}
		},
	},
	yinyueqiang: {
		equipSkill: true,
		trigger: { player: ["useCard", "respondAfter"] },
		filter(event, player) {
			if (_status.currentPhase === player) {
				return false;
			}
			if (!event.cards) {
				return false;
			}
			if (event.cards.length !== 1) {
				return false;
			}
			if (lib.filter.autoRespondSha.call({ player: player })) {
				return false;
			}
			return get.color(event.cards[0]) === "black" && player.hasHistory("lose", evt => evt.getParent() === event && evt.hs?.length === 1);
		},
		direct: true,
		clearTime: true,
		async content(event, trigger, player) {
			await player
				.chooseToUse(`###${get.prompt(event.name)}###对你攻击范围内的一名角色使用一张【杀】`)
				.set("filterCard", (card, player, event) => {
					if (get.name(card) !== "sha") {
						return false;
					}
					return lib.filter.filterCard(card, player, event);
				})
				.set("addCount", false)
				.set("logSkill", event.name)
				.forResult();
		},
	},
	caomu_skill: {
		cardSkill: true,
		charlotte: true,
		trigger: { player: "phaseDrawBegin" },
		forced: true,
		popup: false,
		async content(event, trigger, player) {
			trigger.num--;
		},
		group: "caomu_skill2",
	},
	caomu_skill2: {
		cardSkill: true,
		charlotte: true,
		trigger: { player: "phaseDrawEnd" },
		forced: true,
		popup: false,
		async content(event, trigger, player) {
			const targets = game.filterPlayer(current => get.distance(current, player) === 1 && player !== current);
			if (targets.length) {
				await game.asyncDraw(targets);
			}
		},
	},
};
