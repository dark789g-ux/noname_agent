import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "newwuniang" | "newzhennan" | "newxushen" | "olkedi" | "olcunze">} */
export const groupSkills = {
	//OL三娘
	//苦命打工人~强烈谴责会长牢萌！！！
	newwuniang: {
		audio: "xinfu_wuniang",
		enable: "chooseToUse",
		filter(event, player) {
			return player.hasCard(card => (get.position(card) === "h" && _status.connectMode) || get.type2(card) !== "basic", "hes");
		},
		filterCard(card) {
			return get.type2(card) !== "basic";
		},
		position: "hes",
		viewAs: {
			name: "sha",
			storage: { newwuniang: true },
		},
		check(card) {
			return 7 - get.value(card);
		},
		precontent() {
			event.result._apply_args = {
				oncard: (card, player) => {
					const evt = get.event();
					evt.directHit.addArray(game.players);
				},
			};
			player.addTempSkill("newwuniang_mxzxz");
		},
		ai: {
			respondSha: true,
			skillTagFilter(player, tag, arg) {
				if (arg === "respond" || !get.info("newwuniang").filter(null, player)) {
					return false;
				}
			},
			result: {
				player: 1,
			},
		},
		locked: false,
		mod: {
			targetInRange(card) {
				if (card?.storage?.newwuniang) {
					return true;
				}
			},
		},
		subSkill: {
			mxzxz: {
				charlotte: true,
				audio: "xinfu_wuniang",
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return event.skill === "newwuniang" && event.targets?.some(i => i.isIn() && i.countCards("he"));
				},
				async cost(event, trigger, player) {
					const targets = trigger.targets;
					event.result = await player
						.chooseTarget(
							get.prompt(event.skill),
							(card, player, target) => {
								return get.event().targets.includes(target) && target.countCards("he");
							},
							"获得一名目标角色的一张牌"
						)
						.set("targets", targets)
						.set("ai", target => {
							const player = get.player();
							return (
								get.effect(target, { name: "shunshou_copy2" }, player, player) *
								(() => {
									if (target.hasCard(card => get.type2(card) === "basic", "he")) {
										return 3;
									}
									if (player.getHp() > 3 || (player.getHp() > 2 && player.hasSkill("newzhennan", null, null, false) && player.awakenedSkills.includes("newzhennan"))) {
										return 1;
									}
									return 0;
								})()
							);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0];
					const result = await player
						.gainPlayerCard(target, "he", true)
						.set("ai", button => {
							const { player, target } = get.event();
							const card = button.link;
							return get.value(card) * (get.type2(card) === "basic" ? 3 : 1);
						})
						.forResult();
					if (result?.bool && result.cards?.some(i => get.type2(i, target) !== "basic")) {
						const resultx = await player
							.chooseBool(`武娘：失去1点体力，重置所有角色的〖镇南〗`)
							.set("choice", player.hp > 1 && game.hasPlayer(target => get.attitude(player, target) && target.awakenedSkills.includes("newzhennan")))
							.forResult();
						if (resultx?.bool) {
							await player.loseHp();
							game.filterPlayer().forEach(target => {
								if (target.awakenedSkills.includes("newzhennan")) {
									target.restoreSkill("newzhennan");
									target.popup("newzhennan");
									game.log(target, "重置了技能", "#g【" + get.translation("newzhennan") + "】");
								}
							});
						}
					}
				},
			},
		},
	},
	newzhennan: {
		audio: "xinfu_zhennan",
		limited: true,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countDiscardableCards(player, "he") > 1;
		},
		skillAnimation: true,
		animationColor: "orange",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt2(event.skill), "he", 2)
				.set("ai", card => {
					const player = get.player(),
						nanman = new lib.element.VCard({ name: "nanman", isCard: true });
					const targets = game.filterPlayer(target => player.canUse(nanman, target) && get.effect(target, nanman, player, player) > 0).sort((a, b) => get.effect(b, nanman, player, player) - get.effect(a, nanman, player, player));
					if (!targets.length) {
						return 0;
					}
					return 7 - get.value(card);
					/*
					targets.reduce((sum, target) => {
						return sum + get.effect(target, nanman, player, player);
					}, 0)*/
				})
				.set("logSkill", event.skill)
				.forResult();
		},
		popup: false,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.addTempSkill("newzhennan_dist");
			const nanman = new lib.element.VCard({ name: "nanman", storage: { newzhennan: true }, isCard: true });
			if (player.hasUseTarget(nanman, true, false)) {
				const result = await player.chooseUseTarget(nanman, true, false, [1, Infinity]).forResult();
				if (result?.bool && result.targets?.length) {
					const targets = result.targets.filter(target => !target.hasHistory("damage", evt => evt.getParent(4) === event)).sortBySeat();
					if (targets.length > 0) {
						player.line(targets);
						player.markAuto("newzhennan_dist", targets);
					}
				}
			}
		},
		subSkill: {
			dist: {
				charlotte: true,
				onremove: true,
				intro: { content: "players" },
				mod: {
					cardUsableTarget(card, player, target) {
						if (player.getStorage("newzhennan_dist").includes(target)) {
							return true;
						}
					},
				},
				trigger: { source: "damageSource" },
				filter(event, player) {
					const target = event.player;
					if (!event.card?.storage?.newzhennan || event.getParent().type !== "card") {
						return false;
					}
					return target.isIn() && event.getParent(2).targets?.includes(target) && target.countCards("he") > 0;
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const target = trigger.player;
					const cards = target.getDiscardableCards(target, "he");
					if (cards.length) {
						player.line(target);
						await target.discard(cards.randomGet());
					}
				},
			},
		},
	},
	newxushen: {
		audio: "xinfu_xushen",
		limited: true,
		trigger: { player: "dying" },
		filter(event, player) {
			return game.hasPlayer(target => target !== player);
		},
		skillAnimation: true,
		animationColor: "fire",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), lib.filter.notMe)
				.set("ai", target => {
					const player = get.player(),
						att = get.attitude(player, target);
					if (att <= 0) {
						return 0;
					}
					const ranks = target.getSkills(null, false, false).reduce((sum, name) => {
						_status.event.skillRankPlayer = target;
						sum += get.skillRank(name);
						delete _status.event.skillRankPlayer;
						return sum;
					}, 1);
					return att / ranks;
				})
				.set("logSkill", event.skill)
				.forResult();
		},
		derivation: ["zhengnan", "newzhennan"],
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const target = event.targets[0];
			let result;
			if (target.hasSkill("newzhennan", null, false, false)) {
				result = { index: 0 };
			} else {
				result = await target
					.chooseControl()
					.set("prompt", get.translation(event.name) + "：请选择一项")
					.set("choiceList", ["失去所有技能，然后获得技能【征南】", "获得技能【镇南】"])
					.set("ai", () => {
						const player = get.player();
						const ranks = player.getSkills(null, false, false).reduce((sum, name) => {
							return sum + get.skillRank(name, "inout");
						}, 1);
						return ranks > get.skillRank("zhengnan") ? 1 : 0;
					})
					.forResult();
			}
			if (result.index === 0) {
				await target.changeSkills(["zhengnan"], target.getSkills(null, false, false));
			} else {
				await target.addSkills("newzhennan");
			}
			//await player.recoverTo(2);
		},
	},
	//OL蔡贞姬
	olkedi: {
		trigger: {
			player: "useCardAfter",
		},
		filter(event, player) {
			if (!player.hasHistory("lose", evtx => evtx?.hs?.length && (evtx.relatedEvent || evtx.getParent()) == event)) {
				return false;
			}
			return (
				player.getHistory(
					"useCard",
					evt => {
						return player.hasHistory("lose", evtx => evtx?.hs?.length && (evtx.relatedEvent || evtx.getParent()) == evt);
					},
					event
				).length <= 2
			);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget: (card, player, target) => target.hasCards("he", card => target.canRecast(card)),
					ai(target) {
						const player = get.player();
						return get.attitude(player, target) * target.countCards("he");
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0],
				prompt = `柯笛：重铸一张牌`,
				result = await target
					.chooseCard({
						position: "he",
						prompt,
						filterCard: lib.filter.cardRecastable,
						ai(card) {
							const { suit, source, player } = get.event(),
								bool1 = get.suit(card) == suit && source.hasValueTarget(card),
								bool2 = get.attitude(player, source) > 0;
							if (bool1 == bool2) {
								return 20 - get.value(card);
							}
							return 7 - get.value(card);
						},
					})
					.set("suit", get.suit(trigger.card))
					.set("source", player)
					.forResult();
			if (result?.cards) {
				await target.recast(result.cards);
				const card = result.cards[0];
				if (player.hasUseTarget(card) || (get.info(card).notarget && lib.filter.cardEnabled(card, player))) {
					await player.chooseUseTarget({ card, addCount: false });
				}
			}
		},
	},
	olcunze: {
		trigger: {
			player: "phaseJieshuBegin",
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill))
				.set("ai", target => {
					let att = get.attitude(get.player(), target);
					if (att > 0) {
						return att + 1;
					}
					if (att == 0) {
						return Math.random();
					}
					return att;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			player.removeSkill(event.name + "_effect");
			const target = event.targets[0];
			player.addTempSkill(event.name + "_effect", { player: "dieAfter" });
			player.markAuto(event.name + "_effect", target);
		},
		subSkill: {
			effect: {
				audio: "olcunze",
				onremove: true,
				charlotte: true,
				mod: {
					playerEnabled(card, player, target) {
						if (get.name(card) == "tao" && player != target) {
							return false;
						}
					},
				},
				trigger: {
					global: "dying",
				},
				filter(event, player) {
					return player.getStorage("olcunze_effect").includes(event.player) && event.player.hp < 1;
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					//player.unmarkAuto(event.name, [trigger.player]);
					player.removeSkill(event.name);
					await trigger.player.recoverTo(1);
				},
				marktext: "存",
				intro: {
					name: "存择",
					content: "$下次进入濒死时，你令其回复体力至1点且期间你不能对其他角色使用【桃】",
				},
			},
		},
	},
};
