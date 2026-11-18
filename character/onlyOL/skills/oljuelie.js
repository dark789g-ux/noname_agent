import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oljuelie" | "olquanyu">} */
export const groupSkills = {
	oljuelie: {
		audio: 2,
		trigger: { player: "useCardToPlayered" },
		filter(event, player) {
			return (
				player.hasCard(card => {
					if (get.position(card) === "h" && _status.connectMode) {
						return true;
					}
					return lib.filter.cardDiscardable(card, player);
				}, "he") &&
				event.card.name == "sha" &&
				player.getHp() > 0 &&
				event.isFirstTarget
			);
		},
		logTarget: "targets",
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt(event.skill, trigger.targets), [1, player.getHp()], "he")
				.set("allowChooseAll", true)
				.set("ai", card => {
					if (ui.selected.cards.length >= _status.event.max) {
						return 0;
					}
					if (_status.event.goon) {
						return 4.5 - get.value(card);
					}
					return 0;
				})
				.set(
					"max",
					trigger.targets.reduce((sum, target) => sum + target.countDiscardableCards(player, "he"), 0)
				)
				.set(
					"goon",
					trigger.targets.every(target => get.attitude(player, target) < 0)
				)
				.set("chooseonly", true)
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			await player.discard(cards);
			let num = cards.length;
			const targets = [...trigger.targets].sortBySeat();
			for (let index = 0; index < targets.length; index++) {
				const next = targets[index].chooseToDiscard("he");
				next.forced = index === targets.length - 1;
				next.selectCard = next.forced ? num : [1, num];
				const result = await next.forResult();
				if (result?.bool && result.cards?.length) {
					num -= result.cards.length;
					if (num <= 0) {
						break;
					}
				}
			}
			player.addTempSkill("oljuelie_draw");
			const evt = trigger.getParent();
			evt.card.storage ??= {};
			evt.card.storage.oljuelie = true;
			if (player.isMinHandcard() || player.isMinHp()) {
				evt.baseDamage ??= 1;
				evt.baseDamage++;
			}
		},
		group: "oljuelie_draw",
		subSkill: {
			draw: {
				charlotte: true,
				audio: "oljuelie",
				trigger: { source: "dieAfter" },
				filter(event, player) {
					return event.reason?.getParent(evt => evt.name == "useCard" && evt.card.storage?.oljuelie, true);
				},
				forced: true,
				locked: false,
				async content(event, trigger, player) {
					await player.drawTo(player.maxHp);
				},
			},
		},
		ai: {
			unequip_ai: true,
			skillTagFilter(player, tag, arg) {
				if (!arg || !arg.name || arg.name != "sha") {
					return false;
				}
				if (!arg.target) {
					return false;
				}
				var card = arg.target.getEquip(2);
				return (
					card &&
					get.value(card) > 0 &&
					player.hasCard(cardx => {
						return lib.filter.cardDiscardable(cardx, player, "oljuelie") && get.value(cardx) < 5;
					})
				);
			},
		},
	},
	//魔孙权
	olquanyu: {
		init(player, skill) {
			player.storage[skill] ??= new Map([]);
		},
		audio: 2,
		trigger: {
			global: "roundStart",
			player: "useCardToPlayer",
		},
		filter(event, player) {
			if (event.name === "useCardToPlayer") {
				if (event.card.name !== "sha" || !event.isFirstTarget || event.targets.length > 1) {
					return false;
				}
				const storage = player.getStorage("olquanyu", new Map([])).get(player) ?? [[], undefined];
				const choice = storage[1],
					filter = lib.skill[choice]?.filter;
				if (!choice) {
					return false;
				}
				return filter ? filter(event, player) : true;
			}
			return game.hasPlayer(target => (player.getStorage("olquanyu", new Map([])).get(target) ?? [[], undefined])[0].length < 6);
		},
		forced: true,
		logTarget(event, player) {
			if (event.name === "useCardToPlayer") {
				return event.target;
			}
			return game.filterPlayer(target => (player.getStorage("olquanyu", new Map([])).get(target) ?? [[], undefined])[0].length < 6).sortBySeat(player);
		},
		async content(event, trigger, player) {
			if (trigger.name === "useCardToPlayer") {
				const choice = player.getStorage("olquanyu", new Map([])).get(player)?.[1];
				if (!choice) {
					return;
				}
				await lib.skill[choice].contentx(trigger, player);
				return;
			}
			const result = await game
				.chooseAnyOL(
					event.targets,
					(target, player) => {
						const choosed = (player.getStorage("olquanyu", new Map([])).get(target) ?? [[], undefined])[0];
						const choices = ["baihong", "qingming", "bixie", "zidian", "baili", "liuxing"].map(i => `olquanyu_${i}`);
						return target
							.chooseButton(
								[
									'###权御###<div class="text center">请选择一项“权御”效果</div>',
									[choices.slice(0, 3).map(i => [i, lib.skill[i].description]), "tdnodes"],
									[choices.slice(3).map(i => [i, lib.skill[i].description]), "tdnodes"],
									[
										dialog => {
											dialog.buttons.forEach(i => {
												i.style.setProperty("width", "120px", "important");
												i.style.setProperty("text-align", "center", "important");
											});
										},
										"handle",
									],
								],
								true
							)
							.set("choosed", choosed)
							.set("filterButton", button => {
								return !get.event().choosed?.includes(button.link);
							})
							.set("ai", () => 1 + Math.random())
							.set("_global_waiting", true);
					},
					[player]
				)
				.forResult();
			if (result) {
				player.addTempSkill("olquanyu_clear", "roundStart");
				let num = 0,
					choice = result.get(player)?.links?.[0];
				for (const [target, result2] of result.entries()) {
					const choice2 = result2.links?.[0];
					if (!choice2) {
						continue;
					}
					player.storage.olquanyu ??= new Map([]);
					const choosed = (player.storage.olquanyu.get(target) ?? [[], undefined])[0];
					player.storage.olquanyu.set(target, [[...choosed, choice2], choice2]);
					const func = (player, target) => {
						const [choices, choice] = player.storage.olquanyu.get(target),
							rumo = player.hasSkill("olqiangang_effect") && target !== player;
						if (!rumo) {
							for (const i of choices) {
								target.removeTip(i);
							}
						}
						for (const i of rumo ? choices : [choice]) {
							target.addTip(i, lib.skill[i].description, false, { width: "fit-content" });
						}
						for (const i of ["baihong", "qingming", "bixie", "zidian", "baili", "liuxing"].map(i => `olquanyu_${i}`)) {
							target.unmarkSkill(i);
						}
						target.markSkill(choice);
						if (target.marks[choice]?.firstChild.innerHTML) {
							target.marks[choice].firstChild.innerHTML = lib.skill[choice].intro.name.slice(0, target.marks[choice].firstChild.innerHTML.length);
						}
					};
					if (player.isMine() || target.isMine()) {
						func(player, target);
					} else if (player.isOnline2() || target.isOnline2()) {
						player.send(func, player, target);
					}
					if (choice && choice2 === choice && num < 3) {
						num++;
					}
				}
				if (num > 0) {
					await player.draw(num);
				}
			}
		},
		mod: {
			cardUsableTarget(card, player, target) {
				const storage = player.getStorage("olquanyu", new Map([])).get(player) ?? [[], undefined];
				if (storage[1] === "olquanyu_liuxing" && card.name === "sha" && ![...ui.selected.targets].remove(target).length) {
					return true;
				}
			},
		},
		ai: {
			unequip_ai: true,
			skillTagFilter(player, tag, arg) {
				if (!arg?.card || !arg.target || arg.card.name !== "sha" || !![...ui.selected.targets].remove(arg.target).length) {
					return false;
				}
				const storage = player.getStorage("olquanyu", new Map([])).get(player) ?? [[], undefined];
				return storage[1] === "olquanyu_bixie";
			},
		},
		subSkill: {
			clear: {
				charlotte: true,
				onremove(player) {
					for (const target of game.filterPlayer()) {
						if (!player.getStorage("olquanyu", new Map([])).has(target)) {
							return;
						}
						const [choices, choice] = player.storage.olquanyu.get(target);
						if (!player.hasSkill("olqiangang_effect") || target === player) {
							target.removeTip(choice);
						}
						target.unmarkSkill(choice);
						player.storage.olquanyu.set(target, [choices, undefined]);
					}
				},
			},
			baihong: {
				description: "伤害+1",
				intro: {
					name: "白虹",
					content: ["伤害+1", '<span style="font-family:yuanli">“白虹贯苍穹，挥刃血溅宫”</span>'].join("<br><br>"),
				},
				async contentx(trigger, player) {
					trigger.getParent().baseDamage++;
					game.log(trigger.card, "造成的伤害+1");
				},
			},
			qingming: {
				description: "目标+1",
				intro: {
					name: "青冥",
					content: ["目标+1", '<span style="font-family:yuanli">“刃似寒潭水，剑出搠空明”</span>'].join("<br><br>"),
				},
				filter(evt, player) {
					const event = evt.getParent();
					return game.hasPlayer(target => {
						if (event.targets.includes(target)) {
							return false;
						}
						return lib.filter.targetEnabled2(event.card, player, target) && lib.filter.targetInRange(event.card, player, target);
					});
				},
				async contentx(evt, player) {
					const trigger = evt.getParent();
					const targets = game.filterPlayer(target => {
						if (trigger.targets.includes(target)) {
							return false;
						}
						return lib.filter.targetEnabled2(trigger.card, player, target) && lib.filter.targetInRange(trigger.card, player, target);
					});
					if (!targets.length) {
						return;
					}
					const result =
						targets.length > 1
							? await player
									.chooseTarget(
										`权御：为${get.translation(trigger.card)}额外选择一个目标`,
										(card, player, target) => {
											const trigger = get.event().triggerx;
											if (trigger.targets?.includes(target)) {
												return false;
											}
											return lib.filter.targetEnabled2(trigger.card, player, target) && lib.filter.targetInRange(trigger.card, player, target);
										},
										true
									)
									.set("triggerx", trigger)
									.set("ai", target => {
										const { player, triggerx: trigger } = get.event();
										return get.effect(target, trigger.card, player, player);
									})
									.forResult()
							: { bool: true, targets };
					if (result?.bool && result.targets?.length) {
						const targets = result.targets.sortBySeat();
						player.line(targets);
						trigger.targets.addArray(targets);
						game.log(targets, "成为了", trigger.card, "的额外目标");
					}
				},
			},
			bixie: {
				description: "无视防具",
				intro: {
					name: "辟邪",
					content: ["无视防具", '<span style="font-family:yuanli">“神锋所向诛邪恶，利刃飞出鬼魅惊”</span>'].join("<br><br>"),
				},
				async contentx(trigger, player) {
					trigger.target.addTempSkill("qinggang2");
					trigger.target.storage.qinggang2.add(trigger.card);
					trigger.target.markSkill("qinggang2");
				},
			},
			zidian: {
				description: "不可响应",
				intro: {
					name: "紫电",
					content: ["不可响应", '<span style="font-family:yuanli">“恰似明空紫电生，神兵舞起快如风”</span>'].join("<br><br>"),
				},
				filter(event, player) {
					const directHit = event.getParent().directHit;
					return directHit !== true && !directHit.includes(event.target);
				},
				async contentx(trigger, player) {
					trigger.getParent().directHit.add(trigger.target);
					game.log(trigger.target, "不可响应", trigger.card);
				},
			},
			baili: {
				description: "额外结算",
				intro: {
					name: "百里",
					content: ["额外结算", '<span style="font-family:yuanli">“锋芒震四方，可息天下兵”</span>'].join("<br><br>"),
				},
				async contentx(trigger, player) {
					trigger.getParent().effectCount++;
					game.log(trigger.card, "额外结算一次");
				},
			},
			liuxing: {
				description: "无次数",
				intro: {
					name: "流星",
					content: ["无次数限制", '<span style="font-family:yuanli">“流行飞玉弹，破阵清边尘”</span>'].join("<br><br>"),
				},
				filter(event, player) {
					return event.getParent().addCount !== false;
				},
				async contentx(trigger, player) {
					trigger.getParent().addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] === "number") {
						stat[name]--;
					}
					game.log(trigger.card, "不计入次数");
				},
			},
		},
	},
};
