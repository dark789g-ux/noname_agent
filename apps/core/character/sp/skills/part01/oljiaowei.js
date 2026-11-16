import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oljiaowei" | "olbianyu" | "olfengyao" | "olshuzi" | "olkuangshou">} */
export const groupSkills = {
	//董翓
	oljiaowei: {
		audio: 2,
		trigger: { player: "useCard" },
		filter(event, player) {
			if (player.countCards("h") <= player.getHp()) {
				return false;
			}
			return get.color(event.card) === "black" && game.hasPlayer(target => target.getHp() <= player.getHp());
		},
		logTarget(event, player) {
			return game.filterPlayer(target => target.getHp() <= player.getHp()).sortBySeat();
		},
		forced: true,
		content() {
			trigger.directHit.addArray(event.targets);
			game.log(event.targets, "不可响应", trigger.card);
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (!arg?.card || get.color(arg.card) !== "black") {
					return;
				}
				const filter = card => !ui.selected.cards.includes(card) || arg.card !== card || !arg.card?.cards?.includes(card);
				if (player.countCards("h", filter) <= player.getHp()) {
					return false;
				}
				return arg?.target && arg.target.getHp() <= player.getHp();
			},
		},
		mod: {
			ignoredHandcard(card, player) {
				if (get.color(card) == "black") {
					return true;
				}
			},
			cardDiscardable(card, player, name) {
				if (name == "phaseDiscard" && get.color(card) == "black") {
					return false;
				}
			},
			targetInRange(card, player, target) {
				if (player.countCards("h") <= player.getHp()) {
					return;
				}
				if (target.getHp() <= player.getHp() && get.color(card) == "black") {
					return true;
				}
			},
		},
	},
	olbianyu: {
		audio: 2,
		trigger: {
			source: "damageSource",
			player: "damageEnd",
		},
		filter(event, player) {
			if (!event.card || event.card.name !== "sha") {
				return false;
			}
			return event.player.isIn() && Math.min(event.player.getDamagedHp(), event.player.countCards("h")) > 0;
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player,
				num = target.getDamagedHp();
			const result = await player
				.choosePlayerCard(target, true, "h", [1, num])
				.set(
					"prompt",
					(() => {
						return '###鞭御###<div class="text center">令' + get.translation(target) + "至多" + get.cnNumber(num) + "张手牌为无次数限制的【杀】</div>";
					})()
				)
				.forResult();
			if (result?.bool && result.cards?.length) {
				target.addSkill("olbianyu_viewAs");
				target.addGaintag(result.cards, "olbianyu_viewAs");
				if ([player, target].some(current => current.getCards("h").every(card => get.name(card, current) == "sha"))) {
					await player.draw(2);
				}
			}
		},
		subSkill: {
			viewAs: {
				mod: {
					cardname(card) {
						if (get.itemtype(card) === "card" && card.hasGaintag("olbianyu_viewAs")) {
							return "sha";
						}
					},
					cardnature(card) {
						if (get.itemtype(card) === "card" && card.hasGaintag("olbianyu_viewAs")) {
							return false;
						}
					},
					cardUsable(card) {
						if (card.name === "sha" && card.cards?.length === 1 && card.cards[0].hasGaintag("olbianyu_viewAs")) {
							return Infinity;
						}
					},
				},
				charlotte: true,
				onremove: (player, skill) => player.removeGaintag(skill),
				trigger: { player: "useCard1" },
				filterx(event, player) {
					if (get.type(event.card) !== "basic") {
						return true;
					}
					if (event.card.name !== "sha" || event.addCount === false) {
						return false;
					}
					if (!event.cards || event.cards.length !== 1) {
						return false;
					}
					return player.hasHistory("lose", evt => {
						const evtx = evt.relatedEvent || evt.getParent();
						if (evtx !== event) {
							return false;
						}
						return Object.keys(evt.gaintag_map).some(i => evt.gaintag_map[i].includes("olbianyu_viewAs"));
					});
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (get.type(trigger.card) !== "basic") {
						player.removeSkill(event.name);
					} else {
						trigger.addCount = false;
						const stat = player.getStat().card,
							name = trigger.card.name;
						if (typeof stat[name] == "number") {
							stat[name]--;
						}
						game.log(trigger.card, "不计入次数");
					}
				},
				mark: true,
				intro: { content: "选择的牌视为无次数限制的【杀】直到使用非基本牌" },
			},
		},
	},
	olfengyao: {
		audio: 2,
		trigger: {
			source: "damageBegin1",
			global: ["loseAfter", "loseAsyncAfter", "gainAfter", "equipAfter", "addJudgeAfter", "addToExpansionAfter"],
		},
		filter(event, player) {
			if (event.name === "damage") {
				return [player, event.player].some(target =>
					target.hasVCard(card => {
						return get.suit(card) === "spade" && lib.filter.cardDiscardable(card, player);
					}, "ej")
				);
			}
			if (player.isHealthy()) {
				return false;
			}
			return game.hasPlayer2(target => event.getl?.(target)?.es?.some(card => get.suit(card, target) === "spade"));
		},
		locked: true,
		async cost(event, trigger, player) {
			if (trigger.name === "damage") {
				const target = trigger.player;
				const dialog = ['###凤瑶###<div class="text center">弃置你或' + get.translation(target) + "场上的一张黑桃牌，令此伤害+1</div>"];
				for (const current of [player, target]) {
					for (const pos of ["e", "j"]) {
						const cards = current.getCards(pos, card => get.suit(card) === "spade" && lib.filter.cardDiscardable(card, player));
						if (cards.length) {
							dialog.push('<div class="text center">' + (current === player ? "你" : get.translation(current)) + "的" + { e: "装备区", j: "判定区" }[pos] + "</div>");
							dialog.push(cards);
						}
					}
				}
				event.result = await player
					.chooseButton(dialog, true)
					.set("ai", button => {
						const player = get.player(),
							card = button.link,
							owner = get.owner(card);
						return -get.attitude(player, owner) * get.value(card, owner);
					})
					.forResult();
				event.result.cards = event.result.links;
				event.result.targets = [target];
			} else {
				event.result = { bool: true };
			}
		},
		async content(event, trigger, player) {
			if (trigger.name === "damage") {
				const owner = get.owner(event.cards[0]);
				await owner.modedDiscard(event.cards);
				trigger.num++;
			} else {
				await player.recover();
			}
		},
	},
	//韩馥
	olshuzi: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => target !== player) && player.countCards("he") >= 2;
		},
		filterCard: true,
		selectCard: 2,
		position: "he",
		filterTarget: lib.filter.notMe,
		check(card) {
			return 7 - get.value(card);
		},
		usable: 1,
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.give(cards, target);
			const names = cards
				.slice()
				.map(i => get.name(i, false))
				.unique();
			const resultx = await target.chooseToGive(player, "h", true).forResult();
			if (resultx?.bool && resultx.cards?.length) {
				if (names.includes(get.name(resultx.cards[0], false))) {
					const str = get.translation(target);
					let choices = ["造成伤害"],
						choiceList = ["对" + str + "造成1点伤害"];
					if (
						player.canMoveCard(
							null,
							null,
							game.filterPlayer(i => i != target),
							target
						)
					) {
						choices.push("给其移牌");
						choiceList.push("将场上的一张牌移动至" + str + "的对应区域");
					}
					choices.push("cancel2");
					const result = await player
						.chooseControl(choices)
						.set("ai", () => {
							const { player, target } = get.event().getParent(),
								choices = get.event().controls;
							if (get.damageEffect(target, player, player) > 0) {
								return "造成伤害";
							}
							if (
								player.canMoveCard(
									true,
									null,
									game.filterPlayer(i => i != target),
									target
								) &&
								choices.includes("给其移牌")
							) {
								return "给其移牌";
							}
							return "cancel2";
						})
						.set("prompt", "束辎：是否选择一项执行？")
						.set("choiceList", choiceList)
						.forResult();
					if (result.control !== "cancel2") {
						if (result.index === 0) {
							await target.damage();
						} else {
							await player.moveCard(
								true,
								game.filterPlayer(i => i != target),
								target
							);
						}
					}
				}
			}
		},
		ai: {
			order: 7,
			result: {
				player(player, target) {
					return (
						get.damageEffect(target, player, player) +
						player.canMoveCard(
							true,
							null,
							game.filterPlayer(i => i != target),
							target
						)
					);
				},
			},
		},
	},
	olkuangshou: {
		audio: 2,
		trigger: { player: "damageEnd" },
		forced: true,
		async content(event, trigger, player) {
			await player.draw(3);
			await player.chooseToDiscard(
				"he",
				true,
				game.countPlayer2(target => target.hasHistory("damage"))
			);
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						const limit = game.countPlayer2(i => i === target || i.getHistory("sourceDamage").length);
						return [1, 2.5 - limit];
					}
				},
			},
		},
	},
};
