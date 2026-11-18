import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olsbjingxian" | "olsbxieyong" | "oldangxian" | "olfuli" | "olsblixian" | "olsbbingcai">} */
export const groupSkills = {
	//OL谋张飞
	olsbjingxian: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			if (!player.countCards("he", card => get.type(card) != "basic")) {
				return false;
			}
			return game.hasPlayer(target => {
				if (target.hasSkill("olsbjingxian_used")) {
					return false;
				}
				return player != target;
			});
		},
		filterTarget(card, player, target) {
			if (target.hasSkill("olsbjingxian_used")) {
				return false;
			}
			return player != target;
		},
		filterCard(card) {
			return get.type(card) != "basic";
		},
		selectCard: [1, 2],
		position: "he",
		lose: false,
		discard: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards, targets } = event;
			const target = targets[0];
			player.give(cards, target);
			if (event.cards.length != 2) {
				const result = await target
					.chooseButton(
						[
							"请选择一项",
							[
								[
									["draw", `你与${get.translation(player)}各摸一张牌`],
									["gain", `令${get.translation(player)}从牌堆中获得一张【杀】`],
								],
								"textbutton",
							],
						],
						true
					)
					.forResult();
				for (const i of result.links) {
					if (i == "draw") {
						await game.asyncDraw([player, target]);
					} else if (i == "gain") {
						const card = get.cardPile(function (card) {
							return card.name == "sha";
						});
						if (card) {
							await player.gain(card, "draw");
						} else {
							player.chat("不是哥们，杀呢");
						}
					}
				}
			} else {
				await game.asyncDraw([player, target]);
				const card = get.cardPile(function (card) {
					return card.name == "sha";
				});
				if (card) {
					await player.gain(card, "draw");
				} else {
					player.chat("不是哥们，杀呢");
				}
			}
			target.addTempSkill("olsbjingxian_used");
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
	olsbxieyong: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			player.addSkill(["olsbxieyong_jiu", "olsbxieyong_buff"]);
			player.markAuto("olsbxieyong_jiu", event.targets);
			if (!player.storage.jiu) {
				player.storage.jiu = 0;
			}
			player.storage.jiu += 1;
			game.broadcastAll(function (player) {
				player.addSkill("jiu");
				if (!player.node.jiu && lib.config.jiu_effect) {
					player.node.jiu = ui.create.div(".playerjiu", player.node.avatar);
					player.node.jiu2 = ui.create.div(".playerjiu", player.node.avatar2);
				}
			}, player);
		},
		subSkill: {
			jiu: {
				charlotte: true,
				silent: true,
				trigger: {
					global: ["phaseAfter", "die"],
				},
				filter(event, player) {
					return player.getStorage("olsbxieyong_jiu").includes(event.player);
				},
				async content(event, trigger, player) {
					game.broadcastAll(function (player) {
						player.removeSkill(["olsbxieyong_jiu", "olsbxieyong_buff"]);
						player.removeSkill("jiu");
					}, player);
					game.addVideo("jiuNode", player, false);
				},
				ai: {
					jiuSustain: true,
				},
				onremove: true,
				intro: {
					content: "已选择$",
				},
			},
			buff: {
				charlotte: true,
				trigger: {
					global: "useCardAfter",
				},
				filter(event, player) {
					if (!player.getStorage("olsbxieyong_jiu").includes(event.player)) {
						return false;
					}
					return !event.targets?.includes(event.player);
				},
				direct: true,
				clearTime: true,
				async content(event, trigger, player) {
					const target = trigger.player;
					const next = player.chooseToUse();
					next.set("prompt", `狭勇：是否对${get.translation(target)}使用一张【杀】？`);
					next.set("targetx", target);
					next.set("filterCard", function (card) {
						return get.name(card) == "sha";
					});
					next.set("filterTarget", function (card, player, target) {
						const evt = get.event();
						return evt.targetx == target && lib.filter.filterTarget.apply(this, arguments);
					});
					next.set("oncard", () => {
						const evt = get.event();
						const { targets } = evt;
						for (const target of targets) {
							target.addTempSkill("qinggang2");
							target.storage.qinggang2.add(evt.card);
							target.markSkill("qinggang2");
						}
					});
					next.set("addCount", false);
					next.set("logSkill", event.name);
					await next;
				},
			},
		},
	},
	//OL界廖化
	oldangxian: {
		audio: 2,
		audioname2: { guansuo: "dangxian_guansuo" },
		trigger: { player: "phaseBegin" },
		forced: true,
		async content(event, trigger, player) {
			player.addSkill(`${event.name}_effect`);
			trigger.phaseList.splice(trigger.num, 0, `phaseUse|${event.name}`);
		},
		subSkill: {
			effect: {
				mod: {
					targetInRange(card) {
						if ((card.cards ?? []).length === 1) {
							const card2 = card.cards[0];
							if (get.itemtype(card2) === "card" && card2.hasGaintag("oldangxian")) {
								return true;
							}
						}
					},
				},
				charlotte: true,
				audio: "oldangxian",
				audioname2: { guansuo: "dangxian_guansuo" },
				trigger: { player: ["phaseUseBegin", "phaseUseEnd"] },
				filter(event, player, name) {
					if (event._extraPhaseReason !== "oldangxian") {
						return false;
					}
					return name.endsWith("Begin") || (event.oldangxian_draw && !player.hasHistory("sourceDamage", evt => evt.getParent(event.name) === event));
				},
				async cost(event, trigger, player) {
					if (event.triggername.endsWith("Begin")) {
						event.result = await player
							.chooseBool("当先：是否从牌堆或弃牌堆获得一张无距离限制的【杀】？")
							.set("prompt2", '<div class="text center">若如此做，此阶段结束时，若你未于此阶段造成过伤害，则你对自己造成1点伤害</div>')
							.set(
								"choice",
								get.cardPile(card => card.name === "sha" && player.hasUseTarget(card, false))
							)
							.forResult();
					} else {
						event.result = { bool: true };
					}
				},
				async content(event, trigger, player) {
					if (event.triggername.endsWith("Begin")) {
						trigger.set("oldangxian_draw", true);
						const card = get.cardPile({ name: "sha" });
						if (card) {
							await player.gain(card, "draw").gaintag.add("oldangxian");
						}
					} else {
						await player.damage();
					}
				},
			},
		},
	},
	olfuli: {
		limited: true,
		audio: 2,
		enable: "chooseToUse",
		filter(event, player) {
			return event.type === "dying" && player == event.dying;
		},
		skillAnimation: true,
		animationColor: "soil",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const sum = game.countGroup();
			await player.recoverTo(sum);
			await player.drawTo(sum);
			const maxDamage = player.getAllHistory("sourceDamage").reduce((num, evt) => num + evt.num, 0);
			if (maxDamage < sum) {
				await player.turnOver();
			}
		},
		ai: {
			save: true,
			skillTagFilter(player, arg, target) {
				return player == target && player.storage.olfuli != true;
			},
			result: {
				player: 10,
			},
			threaten(player, target) {
				if (!target.storage.olfuli) {
					return 0.9;
				}
			},
		},
	},
	//OL谋黄月英
	olsblixian: {
		audio: 2,
		trigger: {
			player: ["damageEnd", "phaseZhunbeiBegin", "phaseJieshuBegin"],
		},
		filter(event, player) {
			if (!player.countCards("hes")) {
				return false;
			}
			if (event.name == "damage") {
				return event.num;
			}
			return player.getStorage("olsblixian_triggers").includes(event.name);
		},
		async cost(event, trigger, player) {
			const list = ["wuzhong", ...player.getStorage("olsblixian_names")].map(name => ["", "", name]);
			if (!list.length) {
				return;
			}
			const result = await player
				.chooseButton([get.prompt2(event.skill), [list, "vcard"]])
				.set("viewAs", (button, cards) => get.autoViewAs({ name: button.link[2] }, cards ? cards : "unsure"))
				.set("filterButton", button => {
					const player = get.player();
					const cards = player.getCards("hes");
					return cards.some(card => player.hasUseTarget(get.event().viewAs(button, [card]), true, false));
				})
				.set("ai", button => get.player().getUseValue(get.event().viewAs(button)))
				.forResult();
			if (result?.links?.length) {
				event.result = {
					bool: true,
					cost_data: result.links[0][2],
				};
			}
		},
		async content(event, trigger, player) {
			const name = event.cost_data;
			game.broadcastAll(name => {
				lib.skill.olsblixian_backup.viewAs = { name: name };
			}, name);
			await player
				.chooseToUse(true)
				.set("openskilldialog", `将一张牌当作【${get.translation(name)}】使用`)
				.set("norestore", true)
				.set("_backupevent", `${event.name}_backup`)
				.set("custom", {
					add: {},
					replace: { window() {} },
				})
				.backup(`${event.name}_backup`)
				.set("targetRequired", true)
				.set("complexTarget", true)
				.set("complexSelect", true)
				.set("addCount", false);
		},
		group: ["olsblixian_addTrigger"],
		subSkill: {
			addTrigger: {
				audio: "olsblixian",
				forced: true,
				locked: false,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return (
						event.skill == "olsblixian_backup" &&
						!player.getStorage("olsblixian_triggers").includes("phaseJieshu") &&
						player
							.getAllHistory("useCard", evt => evt.skill == event.skill)
							.map(evt => evt.card.name)
							.unique().length >= 3
					);
				},
				async content(event, trigger, player) {
					player.markAuto("olsblixian_triggers", "phaseJieshu");
					game.log(player, "的", "#g【理贤】", "于", "#y结束阶段", "也可发动");
				},
			},
			backup: {
				log: false,
				filterCard(card) {
					return get.itemtype(card) == "card";
				},
				position: "hes",
				check(card) {
					return 7 - get.value(card);
				},
			},
		},
	},
	olsbbingcai: {
		audio: 2,
		trigger: {
			global: "useCard",
		},
		filter(event, player) {
			if (!player.countCards("he")) {
				return false;
			}
			return game.getGlobalHistory("everything", evt => evt.name === "useCard" && get.type(evt.card) === "basic").indexOf(event) === 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard("he")
				.set("prompt", get.prompt(event.name.slice(0, -5)))
				.set("prompt2", "你可重铸一张牌。若重铸牌为" + (get.tag(trigger.card, "damage") ? "" : "非") + "伤害类，则" + get.translation(trigger.card) + "对相同目标再结算一次。")
				.set("ai", card => {
					const eff = get.event().eff;
					if (get.tag(card, "damage") === Boolean(eff[0])) {
						return 6 - get.value(card) + eff[1];
					}
					return 6 - get.value(card);
				})
				.set("eff", [
					Boolean(get.tag(trigger.card, "damage")),
					trigger.targets.reduce((acc, target) => {
						if (trigger.card.name === "tao" && target.getDamagedHp() < 2) {
							return acc;
						}
						return acc + get.effect(target, trigger.card, trigger.player, player);
					}, 0),
				])
				.forResult();
		},
		async content(event, trigger, player) {
			await player.recast(event.cards);
			const card = event.cards[0];
			if (Boolean(get.tag(card, "damage")) === Boolean(get.tag(trigger.card, "damage"))) {
				trigger.effectCount++;
				if (
					(get.mode() !== "identity" || player.identity !== "nei") &&
					trigger.targets.reduce((acc, target) => {
						if (trigger.card.name === "tao" && target.getDamagedHp() < 2) {
							return acc;
						}
						return acc + get.effect(target, trigger.card, trigger.player, player);
					}, 0) > 6
				) {
					player.addExpose(0.16);
				}
			}
			if (get.type2(card, player) == "trick" && player.getStorage("olsblixian_names").length < 3) {
				const list = ["shunshou", "guohe", "tiesuo"].removeArray(player.getStorage("olsblixian_names")).map(i => ["trick", "", i]);
				let result;
				list.length == 1
					? (result = { bool: true, links: list })
					: (result = await player
							.chooseButton([`并才：为【理贤】添加一个牌名`, [list, "vcard"]], true)
							.set("ai", button => get.player().getUseValue(get.autoViewAs({ name: button.link[2] })))
							.forResult());
				if (result?.links?.length) {
					const name = result.links[0][2];
					player.markAuto("olsblixian_names", name);
					game.log(player, "的", "#g【理贤】", "增加牌名", "#y" + get.translation(name));
					if (player.getStorage("olsblixian_names").length >= 3) {
						player.markAuto("olsblixian_triggers", "phaseZhunbei");
						game.log(player, "的", "#g【理贤】", "于", "#y准备阶段", "也可发动");
					}
				}
			}
		},
	},
};
