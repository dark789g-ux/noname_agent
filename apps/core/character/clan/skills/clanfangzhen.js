import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanfangzhen" | "clanliuju" | "clanxumin">} */
export const groupSkills = {
	//族韩韶
	clanfangzhen: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return game.hasPlayer(current => !current.isLinked());
		},
		direct: true,
		seatRelated: true,
		async content(event, trigger, player) {
			let result;
			let target;

			result = await player
				.chooseTarget(get.prompt2("clanfangzhen"), (card, player, target) => {
					return !target.isLinked();
				})
				.set("ai", target => {
					const player = _status.event.player;
					if (_status.event.goon && target != player) {
						let cards = [];
						target.classList.add("linked");
						target.classList.add("linked2");
						try {
							cards = player.getCards("hs", cardx => {
								if (get.name(cardx) != "sha") {
									return false;
								}
								return game.hasNature(cardx, "linked");
							});
							cards = cards.map(i => [i, get.effect(target, i, player, player)]);
							cards.sort((a, b) => b[1] - a[1]);
						} catch (e) {
							target.classList.remove("linked");
							target.classList.remove("linked2");
						}
						target.classList.remove("linked");
						target.classList.remove("linked2");
						const eff = cards[0]?.[1];
						if (eff > 0) {
							return eff;
						}
						return Math.max(2 * get.effect(target, { name: "draw" }, player, player) + 0.6 * get.effect(player, { name: "draw" }, player, player), get.recoverEffect(target, player, player));
					}
					return Math.max(2 * get.effect(target, { name: "draw" }, player, player) + 0.6 * get.effect(player, { name: "draw" }, player, player), get.recoverEffect(target, player, player));
				})
				.set(
					"goon",
					player.countCards("hs", card => {
						return get.name(card) == "jiu" && player.hasUseTarget(card);
					}) &&
						player.countCards("hs", card => {
							if (get.name(card) != "sha") {
								return false;
							}
							return game.hasNature(card, "linked");
						})
				)
				.forResult();

			if (!result.bool) {
				return;
			}

			[target] = result.targets;
			event.target = target;
			player.logSkill("clanfangzhen", target);
			player.addSkill("clanfangzhen_remove");
			player.markAuto("clanfangzhen_remove", [target.getSeatNum()]);
			await target.link(true);

			const choices = ["选项一"];
			const choiceList = ["摸两张牌，然后交给" + get.translation(target) + "两张牌", "令" + get.translation(target) + "回复1点体力"];
			if (target.isDamaged()) {
				choices.push("选项二");
			} else {
				choiceList[1] = '<span style="opacity:0.5; ">' + choiceList[1] + "</span>";
			}

			result = await player
				.chooseControl(choices)
				.set("prompt", "放赈：请选择一项")
				.set("choiceList", choiceList)
				.set("ai", () => {
					const player = _status.event.player;
					const target = _status.event.getParent().target;
					if (!target.isDamaged()) {
						return 0;
					}
					if (get.attitude(player, target) <= 0 && player.countCards("he", card => get.value(card) < 0) >= 2) {
						return 0;
					}
					return 2 * get.effect(target, { name: "draw" }, player, player) + 0.6 * get.effect(player, { name: "draw" }, player, player) > get.recoverEffect(target, player, player) ? 0 : 1;
				})
				.forResult();

			if (result.control == "选项一") {
				await player.draw(2);
				if (player == target) {
					return;
				}
			} else {
				await target.recover();
				return;
			}

			if (!player.countCards("he")) {
				return;
			}
			if (player.countCards("he") <= 2) {
				result = {
					bool: true,
					cards: player.getCards("he"),
				};
			} else {
				result = await player.chooseCard("放赈：交给" + get.translation(target) + "两张牌", "he", 2, true).forResult();
			}

			if (result.bool) {
				await player.give(result.cards, target);
			}
		},
		ai: {
			expose: 0.2,
		},
		subSkill: {
			remove: {
				audio: "clanfangzhen",
				trigger: { global: "roundStart" },
				onremove: true,
				forced: true,
				locked: false,
				charlotte: true,
				filter(event, player) {
					return player.getStorage("clanfangzhen_remove").includes(game.roundNumber);
				},
				async content(event, trigger, player) {
					player.removeSkills("clanfangzhen");
				},
			},
		},
	},
	clanliuju: {
		audio: 2,
		trigger: { player: "phaseUseEnd" },
		filter(event, player) {
			return game.hasPlayer(current => player.canCompare(current));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "与一名其他角色拼点，输的角色可以使用任意张拼点牌中的非基本牌", (card, player, target) => {
					return player.canCompare(target);
				})
				.set("ai", target => {
					var player = _status.event.player;
					var ts = target.getCards("h").sort((a, b) => get.number(a) - get.number(b));
					if (get.attitude(player, target) < 0) {
						var hs = player.getCards("h").sort((a, b) => get.number(a) - get.number(b));
						if (!hs.length || !ts.length) {
							return 0;
						}
						if (get.type(hs[0], null, false) == "basic" && get.value(hs[0]) > 6) {
							return 0;
						}
						if (get.number(hs[0]) < get.number(ts[0]) || get.type(hs[0], null, false) == "basic") {
							return 1;
						}
						return Math.random() - 0.7;
					}
					return get.type(ts[0]) != "basic";
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			const target = targets[0];
			event.target = target;

			let result = await player.chooseToCompare(target).set("small", true).forResult();
			if (result.tie) {
				return;
			}

			const loser = result.bool ? target : player;
			event.loser = loser;

			const distanceFromPlayer = get.distance(player, target);
			const distanceFromTarget = get.distance(target, player);
			event.distance = [distanceFromPlayer, distanceFromTarget];

			const cards = [];
			game.getGlobalHistory("cardMove", evt => {
				if (evt.getParent(2).name === "chooseToCompare" && evt.getParent(3) === event) {
					cards.addArray(
						evt.cards.filter(i => {
							return get.position(i, true) == "d" && get.type(i, null, false) != "basic";
						})
					);
				}
			});

			if (!cards.length) {
				return;
			}
			event.cards = cards;

			let shouldCheckDistance = false;
			while (true) {
				const cardsx = cards.filter(i => get.position(i, true) == "d" && loser.hasUseTarget(i));
				if (!cardsx.length) {
					break;
				}
				shouldCheckDistance = true;

				result = await loser
					.chooseButton(["留驹：是否使用其中的一张牌？", cardsx])
					.set("filterButton", button => {
						return _status.event.player.hasUseTarget(button.link);
					})
					.set("ai", button => {
						return _status.event.player.getUseValue(button.link) + 0.1;
					})
					.forResult();

				if (!result.bool) {
					break;
				}

				const card = result.links[0];
				cards.remove(card);
				loser.$gain2(card, false);
				await game.delayx();
				await loser.chooseUseTarget(true, card, false);
			}

			if (shouldCheckDistance && (get.distance(player, target) != distanceFromPlayer || get.distance(target, player) != distanceFromTarget)) {
				player.restoreSkill("clanxumin");
				game.log(player, "重置了", "#g【恤民】");
			}
		},
	},
	clanxumin: {
		audio: 2,
		audioname: ["clan_hanshao", "clan_hanrong", "clan_hanfu"],
		enable: "phaseUse",
		viewAs: { name: "wugu" },
		filterCard: true,
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			return player.canUse(card, target);
		},
		selectTarget: [1, Infinity],
		check(card) {
			return 6 - get.value(card);
		},
		position: "he",
		limited: true,
		clanSkill: true,
		skillAnimation: true,
		animationColor: "soil",
		log: false,
		async precontent(event, trigger, player) {
			player.logSkill("clanxumin");
			player.awakenSkill("clanxumin");
		},
		ai: {
			order: 7,
			result: { target: 1 },
		},
	},
};
