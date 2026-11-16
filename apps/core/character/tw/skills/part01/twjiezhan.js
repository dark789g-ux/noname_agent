import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twjiezhan" | "twlongjin" | "twguose" | "twliuli">} */
export const groupSkills = {
	//幻赵云
	twjiezhan: {
		audio: 2,
		trigger: {
			global: "phaseUseBegin",
		},
		filter(event, player) {
			return event.player != player && player.inRange(event.player);
		},
		check(event, player) {
			if (get.attitude(player, event.player) > 0) {
				return false;
			}
			if (player.getEquip("bagua") || player.getEquip("rw_bagua")) {
				return true;
			}
			if (player.hasSkill("twlongjin", null, null, false) && !player.awakenedSkills.includes("twlongjin")) {
				return true;
			}
			if (player.countCards("hs", "shan") || (player.countCards("hs", "sha") && player.hasSkill("ollongdan", null, null, false))) {
				return true;
			}
			return get.effect(player, { name: "draw" }, player, player) + get.effect(event.player, { name: "sha" }, event.player, player);
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.draw();
			const target = trigger.player,
				sha = get.autoViewAs({ name: "sha", isCard: true });
			if (target.canUse(sha, player, false, true)) {
				await target.useCard(sha, player);
			}
		},
	},
	twlongjin: {
		audio: 2,
		trigger: {
			player: "dying",
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "fire",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.recoverTo(2);
			const skill = event.name + "_buff";
			player.addSkill(skill);
			await player.addAdditionalSkills(skill, get.info(event.name).derivation);
			player.addMark(skill, 5, false);
		},
		subSkill: {
			buff: {
				mod: {
					globalFrom(from, to) {
						return -Infinity;
					},
				},
				charlotte: true,
				intro: {
					content: "剩余#回合失去〖龙胆〗和〖冲阵〗",
				},
				trigger: {
					global: ["phaseBefore", "phaseAfter"],
				},
				filter(event, player, name) {
					return name == "phaseBefore" || (name == "phaseAfter" && !player.countMark("twlongjin_buff"));
				},
				forced: true,
				popup: false,
				firstDo: true,
				async content(event, trigger, player) {
					if (event.triggername == "phaseBefore") {
						player.removeMark(event.name, 1, false);
					}
					if (event.triggername == "phaseAfter" && !player.countMark(event.name)) {
						await player.removeAdditionalSkills(event.name);
					}
				},
			},
		},
		derivation: ["ollongdan", "chongzhen"],
	},
	// 幻大乔
	twguose: {
		audio: 2,
		trigger: { global: ["changeHpAfter", "gainMaxHpAfter", "loseMaxHpAfter"] },
		filter(event, player) {
			if ((!event.player || !event.player.isDisabledJudge()) && event.player?.hasJudge("lebu")) {
				return false;
			}
			if (!player.hasCards("he") && (!event.player || !event.player.hasCards("he"))) {
				return false;
			}
			return get.info("twguose").damageStatusChanged(event.player, event);
		},
		damageStatusChanged(player, evt) {
			if (!evt.changedMaxHp) {
				if (evt.changedHp > 0) {
					return !player.isDamaged();
				}
				if (evt.changedHp < 0) {
					return player.hp - evt.changedHp === player.maxHp;
				}
			}
			if (evt.changedMaxHp > 0) {
				return player.maxHp - evt.changedMaxHp === player.getHp();
			}
			if (evt.changedMaxHp < 0) {
				return !player.isDamaged() && evt.changedHp !== evt.changedMaxHp;
			}
			return false;
		},
		async skipDiscard(event, trigger, player) {
			if (event._result.bool === false) {
				player.skip("phaseDiscard");
			}
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			if (target?.hasJudge("lebu")) {
				return;
			}
			event.result = await player
				.chooseTarget({
					prompt: get.prompt(event.skill, target),
					prompt2: `选择一名角色，将其一张牌当【乐不思蜀】置入${get.translation(target)}的判定区，然后摸两张牌`,
					filterTarget(card, player, target) {
						const targetx = get.event().targetx;
						if (![player, targetx].includes(target)) {
							return false;
						}
						return target.hasCards("he", cardx => targetx.canAddJudge(get.autoViewAs({ name: "lebu" }, [cardx])));
					},
					ai(target) {
						// 如果是队友就随机盖一方的牌（若残血盖自己的）
						// 如果是敌人且贴乐收益为正则选对方的牌
						const player = get.player();
						const targetx = get.event().targetx;
						const att = get.attitude(player, targetx);
						if (target === player && att >= 0) {
							return Math.random();
						}
						if (att <= 0) {
							return 20 + get.effect(targetx, { name: "lebu" }, player, player);
						} else if (targetx.hp <= 1) {
							return 0;
						}
						return Math.random();
					},
				})
				.set("targetx", target)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			if (!target.hasCards("he", card => trigger.player.canAddJudge(get.autoViewAs({ name: "lebu" }, [card])))) {
				return;
			}
			const result = await player
				.choosePlayerCard({
					prompt: `选择一张牌当作【乐不思蜀】置入${get.translation(trigger.player)}的判定区`,
					filterButton(button) {
						const targetx = get.event().targetx;
						return targetx.canAddJudge(get.autoViewAs({ name: "lebu" }, [button.link]));
					},
					target,
					targetx: trigger.player,
					position: "he",
					forced: true,
					ai(button) {
						const player = get.player();
						// 如果不是自己就随机选，否则若变化角色为队友就优先红
						if (get.event().target !== player) {
							return Math.random();
						} else {
							const bool = get.color(button.link) === "red" && get.event().att > 0 ? 2 : 0;
							return 6 + bool - get.value(button.link);
						}
					},
					att: get.attitude(player, trigger.player),
				})
				.forResult();
			if (result?.bool) {
				const card = result.cards[0];
				target.$give(card, trigger.player, false);
				await trigger.player.addJudge({ name: "lebu" }, [card]);
				await player.draw(2);
			}
		},
		group: "twguose_effect",
		subSkill: {
			effect: {
				audio: "twguose",
				trigger: { global: "judgeEnd" },
				filter(event, player) {
					return event.card?.name === "lebu" && !event.result?.bool;
				},
				prompt2(event, player) {
					return `帼色：是否将${get.translation(event.player)}的${get.translation(event.card)}的效果改为跳过弃牌阶段？`;
				},
				check(event, player) {
					return get.attitude(player, event.player) > 0;
				},
				logTarget: "player",
				async content(event, trigger, player) {
					const target = event.targets[0];
					const card = trigger.card;
					target
						.when("lebuBegin")
						.filter(evt => evt.getParent() == trigger.getParent())
						.then(async (event, trigger, player) => {
							trigger.setContent(get.info("twguose").skipDiscard);
						});
					game.log(player, "将", get.translation(card), "改为跳过弃牌阶段");
				},
				ai: {
					effect: {
						target(card) {
							if (get.name(card) === "lebu") {
								return [-1, 0];
							}
						},
					},
				},
			},
		},
	},
	twliuli: {
		audio: 2,
		trigger: { global: "useCardToTargeted" },
		filter(event, player) {
			const card = event.card;
			const target = event.target;
			if (!get.is.damageCard(card)) {
				return false;
			}
			return target?.hasCards("ej", card => lib.filter.cardDiscardable(card, player, "twliuli") && get.color(card) === "red");
		},
		async cost(event, trigger, player) {
			const target = trigger.target;
			event.result = await player
				.discardPlayerCard({
					target,
					position: "ej",
					prompt: `流俪：是否弃置${get.translation(target)}场上的一张红色牌，令${get.translation(trigger.card)}对其无效？`,
					filterButton(button) {
						return get.color(button.link) === "red" && lib.filter.cardDiscardable(button.link, get.player(), "twliuli");
					},
					ai(button) {
						return 6 - get.value(button.link);
					},
				})
				.set("chooseonly", true)
				.forResult();
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const target = trigger.target;
			await target.discard(event.cards).set("discarder", player);
			trigger.getParent().excluded.add(target);
			game.log(trigger.card, "对", target, "无效");
			if (player.isDamaged() === target.isDamaged()) {
				await player.draw(2);
			}
		},
	},
};
