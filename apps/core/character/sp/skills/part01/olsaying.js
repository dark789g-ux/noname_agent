import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsaying" | "oltongxin" | "olzhuoyue" | "olqiaowu" | "olmeiyan" | "olshuoyu" | "olzuobao">} */
export const groupSkills = {
	//孙鸢
	olsaying: {
		audio: 2,
		trigger: {
			player: "phaseUseBegin",
		},
		filter(event, player) {
			return game.hasPlayer(current => {
				return current != player && current.countGainableCards(player, "hej");
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, current) => {
					return current != player && current.countGainableCards(player, "hej");
				})
				.set("ai", target => {
					const player = get.player();
					let eff = get.effect(target, { name: "shunshou" }, player, player);
					if (get.attitude(target, player) < 0 && target.inRange(player)) {
						let num = target.countCards("h") / 4;
						eff += get.effect(player, { name: "sha" }, target, player) * num;
					}
					return eff;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await player.gainPlayerCard(target, "hej", true);
			if (target.inRange(player)) {
				await target
					.chooseToUse(
						function (card, player, event) {
							if (get.name(card) != "sha") {
								return false;
							}
							return lib.filter.filterCard.apply(this, arguments);
						},
						"飒影：是否对" + get.translation(player) + "使用一张杀？"
					)
					.set("targetRequired", true)
					.set("complexTarget", true)
					.set("filterTarget", function (card, player, target) {
						const { sourcex: source } = get.event();
						if (target != source && !ui.selected.targets.includes(source)) {
							return false;
						}
						return lib.filter.filterTarget.apply(this, arguments);
					})
					.set("sourcex", player);
			} else {
				const name = event.name;
				player.markAuto(name, target);
				player.addTip(`${name}_${target.playerid}`, `飒影 ${get.translation(target)}`);
				target.addTip(`${name}_${player.playerid}`, `飒影 ${get.translation(player)}`);
				player
					.when({
						global: "roundStart",
					})
					.assign({
						mod: {
							inRange(player, target) {
								if (player.getStorage("olsaying").includes(target)) {
									return true;
								}
							},
							inRangeOf(target, player) {
								if (player.getStorage("olsaying").includes(target)) {
									return true;
								}
							},
						},
					})
					.step(async (event, trigger, player) => {
						player?.unmarkAuto(name, target);
						player?.removeTip(`${name}_${target.playerid}`);
						target?.removeTip(`${name}_${player.playerid}`);
					});
			}
		},
	},
	oltongxin: {
		audio: 2,
		trigger: {
			player: "damageEnd",
			source: "damageSource",
		},
		filter(event, player, name) {
			if (player.getStorage("oltongxin_used").includes(name)) {
				return false;
			}
			if ([event.player, event.source].some(target => !target?.isIn())) {
				return false;
			}
			return event.player.countCards("he") > event.player.getDamagedHp();
		},
		async cost(event, trigger, player) {
			const target = trigger.player;
			const result = await player
				.discardPlayerCard(target, "he", target.getDamagedHp() + 1)
				.set("prompt", get.prompt2(event.skill, target))
				.set("ai", button => {
					const { player, owner, damager } = get.event(),
						card = button.link;
					if (get.damageEffect(damager, player, player) < 0) {
						return 0;
					}
					if (player != owner && !player.hasSkillTag("viewHandcard", null, owner, true) && get.position(card) == "h") {
						return Math.random() + 4;
					}
					if (player == owner) {
						return card.name == "sha" ? 10 : 7 - get.value(card);
					}
					return 8 - get.value(card);
				})
				.set("chooseonly", true)
				.set("owner", target)
				.set("damager", trigger.source)
				.forResult();
			if (result.bool) {
				event.result = {
					bool: true,
					targets: [target],
					cost_data: result.links,
				};
			}
		},
		async content(event, trigger, player) {
			player.addTempSkill("oltongxin_used");
			player.markAuto("oltongxin_used", event.triggername);
			const {
				targets: [target],
				cost_data: cards,
			} = event;
			const { cards: discards } = await target.modedDiscard(cards, player).forResult();
			player.line(trigger.source);
			await trigger.source.damage(player);
			if (discards.filter(card => get.name(card) == "sha")?.someInD("od")) {
				const next = player.gain(discards.filter(card => get.name(card) == "sha").filterInD("od"), "gain2");
				next.gaintag.add(event.name);
				await next;
			}
		},
		init(player) {
			player.addSkill("oltongxin_limit");
		},
		subSkill: {
			limit: {
				onremove(player, skill) {
					player.removeGaintag("oltongxin");
				},
				charlotte: true,
				mod: {
					cardUsable(card, player) {
						if (get.number(card) === "unsure" || card.cards?.some(card => card.hasGaintag("oltongxin"))) {
							return Infinity;
						}
					},
				},
				inherit: "nocount",
				filter(event, player) {
					return (
						event.addCount !== false &&
						player.hasHistory("lose", evt => {
							return (evt.relatedEvent || evt.getParent()) == event && Object.values(evt.gaintag_map).flat().includes("oltongxin");
						})
					);
				},
			},
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	//Ol樊氏
	olzhuoyue: {
		audio: 2,
		trigger: { target: "useCardToTargeted" },
		filter(event, player) {
			return !get.is.damageCard(event.card) && !event.card.storage?.olzhuoyue && game.hasPlayer(target => target.hasUseTarget({ name: "jiu", isCard: true }));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.hasUseTarget({ name: "jiu", isCard: true });
				})
				.set("ai", target => get.effect(target, { name: "jiu", isCard: true }, target, get.player()))
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			await target.chooseUseTarget(get.autoViewAs({ name: "jiu", isCard: true, storage: { olzhuoyue: true } }), true);
		},
		group: ["olzhuoyue_tao"],
		subSkill: {
			tao: {
				audio: "olzhuoyue",
				trigger: { global: "useCardToTargeted" },
				filter(event, player) {
					return get.is.damageCard(event.card) && event.target.hasSkill("jiu") && event.target.hasUseTarget({ name: "tao", isCard: true }, false, false);
				},
				logTarget: "target",
				prompt2(event, player) {
					return `移除其【酒】状态并令其视为使用【桃】`;
				},
				async content(event, trigger, player) {
					const { target } = trigger;
					game.broadcastAll(function (player) {
						player.removeSkill("jiu");
					}, target);
					game.addVideo("jiuNode", target, false);
					await target.chooseUseTarget({ name: "tao", isCard: true, storage: { olzhuoyue: true } }, true, false);
				},
			},
		},
	},
	olqiaowu: {
		audio: 2,
		usable: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			const names = ["sha", "shan"].removeArray(player.getStorage("olqiaowu_used"));
			return names.includes(event.card.name) && lib.skill.olqiaowu.logTarget(event, player).length > 0;
		},
		logTarget(event, player) {
			return game.filterPlayer(target => target.hasSkill("jiu"));
		},
		check(event, player) {
			return lib.skill.olqiaowu.logTarget(event, player).some(target => get.attitude(player, target) > 0);
		},
		async content(event, trigger, player) {
			player.addTempSkill(`${event.name}_used`);
			player.markAuto(`${event.name}_used`, trigger.card.name);
			const { targets } = event;
			await game.doAsyncInOrder(targets, async target => {
				const result = await target
					.chooseToUse({
						prompt: "俏舞：是否使用一张【杀】？",
						filterCard(card, player, event) {
							if (get.name(card) != "sha") {
								return false;
							}
							return lib.filter.filterCard.call(this, card, player, event);
						},
					})
					.set("complexSelect", true)
					.set("targetRequired", true)
					.forResult();
				if (!result?.bool) {
					await target.draw();
				}
			});
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				intro: {
					content: "已触发：$",
				},
			},
		},
	},
	//OL桥公
	olmeiyan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (!player.countCards("h")) {
				return false;
			}
			return game.hasPlayer(target => lib.skill.olmeiyan.filterTarget(null, player, target));
		},
		manualConfirm: true,
		filterTarget(card, player, target) {
			return target.hp >= player.hp && target.countCards("h") && player != target;
		},
		selectTarget: -1,
		multitarget: true,
		multiline: true,
		async content(event, trigger, player) {
			const { targets } = event;
			await player.chooseToDebate([player].concat(targets.sortBySeat())).set("callback", async (event, trigger, player) => {
				const { debateResult: result } = event;
				const { bool, opinion, targets, opinions } = result;
				if (opinion == "red") {
					const cards = result.red.flatMap(i => i[1]).filter(card => get.itemtype(card) == "card");
					if (cards.length) {
						await player.gain(cards, "give");
					}
				} else if (opinion == "black") {
					const drawer = result.red
						.map(i => i[0])
						.unique()
						.sortBySeat();
					await game.asyncDraw([player].concat(drawer));
				}
			});
		},
		ai: {
			order: 6,
			result: { player: 1 },
		},
	},
	olshuoyu: {
		audio: 2,
		usable: 1,
		trigger: { global: "useCardToTarget" },
		filter(event, player) {
			return event.card.name == "sha" && (event.target == player || player.inRange(event.target)) && player.countCards("h") && lib.skill.olshuoyu.logTarget(event, player).length;
		},
		logTarget(event, player) {
			return game.filterPlayer(target => target.hp <= player.hp && target.countCards("h") && player != target).sortBySeat();
		},
		check(event, player) {
			return get.effect(event.target, event.card, event.player, player) < 0;
		},
		async content(event, trigger, player) {
			const { targets } = event;
			await player.chooseToDebate([player].concat(targets)).set("callback", async (event, trigger, player) => {
				const { debateResult: result } = event;
				const { bool, opinion, targets, opinions } = result;
				if (opinion == "red") {
					const lose_map = new Map();
					for (const color of opinions) {
						for (const [target, card] of result[color]) {
							if (get.itemtype(card) != "card") {
								continue;
							}
							if (!lose_map.has(target)) {
								lose_map.set(target, [card]);
							} else {
								lose_map.get(target).push(card);
							}
						}
					}
					if (lose_map.size) {
						await game
							.loseAsync({
								lose_list: Array.from(lose_map),
								discarder: player,
							})
							.setContent("discardMultiple");
					}
					const evt = event.getTrigger();
					const targetsx = game.filterPlayer(target => !evt.targets?.includes(target) && lib.filter.targetEnabled(evt.card, evt.player, target) && !targets.includes(target));
					if (targetsx.length) {
						const result = await player
							.chooseTarget(`妁语：将${get.translation(evt.card)}从${get.translation(evt.target)}转移给一名未参与议事的角色`, true, (card, player, target) => {
								return get.event().targetsx.includes(target);
							})
							.set("targetsx", targetsx)
							.set("cardx", evt.card)
							.set("sourcex", evt.player)
							.set("ai", target => get.effect(target, get.event().cardx, get.event().sourcex, get.player()))
							.forResult();
						if (result?.targets?.length) {
							const evtx = evt.getParent();
							const target = evt.target;
							player.line(result.targets);
							evtx.triggeredTargets2.remove(target);
							evtx.targets.remove(target);
							evtx.targets.push(result.targets[0]);
						}
					}
				}
			});
		},
	},
	olzuobao: {
		audio: 2,
		limited: true,
		skillAnimation: true,
		animationColor: "wood",
		trigger: {
			global: "debateShowOpinion",
		},
		filter(event, player) {
			return event.targets.includes(player) && event.opinions.some(i => event[i].flat().includes(player)) && event.black.some(i => get.suit(i[1], i[0]) == "spade");
		},
		/*logTarget(event,player){
			return event.black.filter(i=>get.suit(i[1],i[0]) == "spade").map(i=>i[0]).unique().sortBySeat();
		},*/
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const targets = [];
			for (let i = 0; i < trigger.black.length; i++) {
				const entry = trigger.black[i];
				if (get.suit(entry[1], entry[0]) == "spade") {
					trigger.red.push(entry);
					trigger.black.splice(i--, 1);
					targets.add(entry[0]);
				}
			}
			player.line(targets);
		},
	},
};
