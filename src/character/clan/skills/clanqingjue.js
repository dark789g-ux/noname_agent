import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "clanqingjue" | "clanxsyingxiang">} */
export const groupSkills = {
	//族荀莳（族荀肘）
	clanqingjue: {
		isOnlySuit(card, player) {
			return !player.hasCard(cardx => cardx != card && get.suit(cardx) == get.suit(card), "h");
		},
		init(player, skill) {
			player.addSkill(`${skill}_mark`);
		},
		onremove(player, skill) {
			player.removeSkill(`${skill}_mark`);
		},
		audio: 2,
		trigger: { player: "changeHpAfter" },
		filter(event, player) {
			if (event.changedHp == 0) {
				return false;
			}
			const hs = player.getCards("h");
			return game.getGlobalHistory("changeHp", evt => evt.player == player && evt.changedHp != 0).indexOf(event) == 0 && player.hasDiscardableCards(player, "h", card => !get.info("clanqingjue").isOnlySuit(card, player));
		},
		forced: true,
		async content(event, trigger, player) {
			const result = await player
				.chooseToDiscard(`###${get.translation(event.name)}###弃置手牌中任意张花色数量不为一的牌，并执行等量项`, "h", [1, Infinity], true, "allowChooseAll")
				.set("filterCard", (card, player) => !get.info("clanqingjue").isOnlySuit(card, player))
				.forResult();
			const { cards } = result;
			const resultx =
				cards.length > 1
					? { bool: true, links: ["give", "gain"] }
					: await player
							.chooseButton(
								[
									`清绝：执行${get.cnNumber(Math.min(cards.length, 2))}项`,
									[
										[
											["give", `将${get.translation(cards)}交给其他角色`],
											["gain", `获得未拥有花色的牌各一张（${get.translation(lib.suit.filter(suit => !player.hasCard({ suit: suit }, "h")))}）`],
										],
										"textbutton",
									],
								],
								true
							)
							.set("ai", button => {
								if (button.link == "give") {
									if (game.hasPlayer(target => target != get.player() && get.attitude(get.player(), target) > 0)) {
										return 2;
									}
									return 0.5;
								}
								return 1;
							})
							.forResult();
			const { links } = resultx;
			if (links?.includes("give") && game.hasPlayer(target => target != player) && cards?.someInD("d")) {
				const toGive = cards?.filterInD("d");
				const result = await player
					.chooseTarget(true, lib.filter.notMe)
					.set("createDialog", [`清绝：将这些牌交给一名其他角色`, toGive, [dialog => dialog.buttons.forEach(button => button.style.setProperty("opacity", "1", "important")), "handle"]])
					.set("toGive", toGive)
					.set("ai", target => get.attitude(get.player(), target) * get.value(get.event().toGive, target))
					.forResult();
				const {
					targets: [target],
				} = result;
				player.line(target);
				const next = target.gain(toGive, "gain2");
				next.giver = player;
				await next;
			}
			if (links?.includes("gain")) {
				const hs = player.getCards("h").map(card => get.suit(card));
				const suits = lib.suit.slice().removeArray(hs);
				if (suits?.length) {
					const cards = [];
					for (const suit of suits) {
						const card = get.cardPile2(card => get.suit(card) == suit);
						if (card) {
							cards.push(card);
						}
					}
					if (cards.length) {
						await player.gain(cards, "gain2");
					}
				}
			}
		},
		mod: {
			ignoredHandcard(card, player) {
				if (get.info("clanqingjue").isOnlySuit(card, player)) {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard") {
					if (get.info("clanqingjue").isOnlySuit(card, player)) {
						return false;
					}
				}
			},
		},
		subSkill: {
			mark: {
				//太棒了，是宝宝标记，我们有救了！
				charlotte: true,
				init(player, skill) {
					player.removeGaintag(skill);
					player.addGaintag(
						player.getCards("h", card => get.info("clanqingjue").isOnlySuit(card, player)),
						skill
					);
				},
				onremove(player, skill) {
					player.removeGaintag(skill);
				},
				trigger: {
					player: ["loseEnd", "enterGame"],
					global: ["gainEnd", "equipEnd", "addJudgeEnd", "loseAsyncEnd", "addToExpansionEnd", "phaseBefore"],
				},
				silent: true,
				filter(event, player, name) {
					if (event.name == "phase") {
						return game.phaseNumber == 0;
					}
					return name == "enterGame" || event.getg?.(player)?.length || event.getl?.(player)?.hs?.length;
				},
				async content(event, trigger, player) {
					get.info(event.name).init(player, event.name);
				},
			},
		},
	},
	clanxsyingxiang: {
		audio: 2,
		trigger: {
			global: ["useCardAfter", "loseAfter", "loseAsyncAfter", "gainAfter", "equipAfter", "addJudgeAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (event.name === "useCard") {
				return event.player.hasHistory("lose", evt => {
					if ((evt.relatedEvent || evt.getParent()) != event) {
						return false;
					}
					return Object.values(evt.gaintag_map).flat().includes("clanxsyingxiang");
				});
			}
			if (player.hasSkill("clanxsyingxiang_used") || !player.countDiscardableCards(player, "h", card => !get.info("clanqingjue").isOnlySuit(card, player))) {
				return false;
			}
			if (event.name === "lose" && event.getParent().name === "useCard") {
				return false;
			}
			return game.hasPlayer(target => {
				const evt = event.getl?.(target);
				return evt?.hs?.some(card => evt.gaintag_map?.[card.cardid]?.includes("clanxsyingxiang"));
			});
		},
		logTarget(event, player) {
			if (event.name === "useCard") {
				return game
					.filterPlayer(i => {
						if (i === event.player) {
							return true;
						}
						return i.hasCard(card => card.hasGaintag("clanxsyingxiang"), "h");
					})
					.sortBySeat();
			}
			return player;
		},
		forced: true,
		async content(event, trigger, player) {
			if (trigger.name === "useCard") {
				await game.asyncDraw([player, ...event.targets].sortBySeat());
				await game.delayx();
			} else {
				const skill = "clanqingjue";
				player.logSkill(skill);
				player.addTempSkill(`${event.name}_used`, "roundStart");
				const next = game.createEvent(skill);
				next.player = player;
				next.setContent(get.info(skill).content);
				await next;
			}
		},
		group: "clanxsyingxiang_mark",
		subSkill: {
			used: {
				charlotte: true,
				init(player, skill) {
					player.addTip(skill, `${get.translation(skill)} 已${get.translation("clanqingjue")}`);
				},
				onremove(player, skill) {
					player.removeTip(skill);
				},
			},
			mark: {
				audio: "clanxsyingxiang",
				forced: true,
				trigger: {
					global: ["gainEnd", "loseAsyncEnd"],
				},
				getIndex(event, player) {
					return game
						.filterPlayer(target => {
							if (target == player) {
								return false;
							}
							const gain = event.getg?.(target) ?? [];
							const lose = event.getl?.(player)?.cards2 ?? [];
							return gain.length > 0 && (event.giver === player || lose.some(i => gain.includes(i)));
						})
						.sortBySeat();
				},
				filter(event, player, name, target) {
					return target?.isIn();
				},
				logTarget(event, player, name, target) {
					return target;
				},
				async content(event, trigger, player) {
					const target = event.indexedData;
					const gain = trigger.getg?.(target);
					const lose = trigger.getl?.(player)?.cards2;
					target.addGaintag(
						gain.filter(i => trigger.giver === player || lose.includes(i)),
						"clanxsyingxiang"
					);
				},
			},
		},
	},
};
