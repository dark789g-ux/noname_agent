import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "ollingren" | "olyanjing" | "olfenyue">} */
export const groupSkills = {
	//曹婴
	ollingren: {
		audio: "xinfu_lingren",
		//trigger: { player: "useCardToPlayered" },
		trigger: { player: "useCard" },
		filter(event, player) {
			/*if (event.getParent().triggeredTargets3.length > 1) {
				return false;
			}*/
			if (!["basic", "trick"].includes(get.type(event.card))) {
				return false;
			}
			return get.is.damageCard(event.card) && event.targets?.length > 0;
		},
		usable: 1,
		derivation: ["new_rejianxiong", "rexingshang"],
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "选择一名目标角色并猜测其手牌构成", (card, player, target) => {
					return _status.event.targets.includes(target);
				})
				.set("ai", target => {
					return 2 - get.attitude(get.player(), target);
				})
				.set("targets", trigger.targets)
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const list = ["basic", "trick", "equip"].map(type => ["", "", "caoying_" + type]);
			const result = await player
				.chooseButton(["凌人：猜测其有哪些类别的手牌", [list, "vcard"]], [0, 3], true)
				.set("ai", button => {
					return get.event().choice.includes(button.link[2].slice(8));
				})
				.set(
					"choice",
					(() => {
						if (!target.countCards("h")) {
							return [];
						}
						let choice = [],
							known = target.getKnownCards(player),
							unknown = target.getCards("h", i => !known.includes(i));
						for (let i of known) {
							choice.add(get.type2(i, target));
						}
						if (!unknown.length || choice.length > 2) {
							return choice;
						}
						let rand = 0.05;
						if (!choice.includes("basic")) {
							if (unknown.some(i => get.type(i, null, target) === "basic")) {
								rand = 0.95;
							}
							if (Math.random() < rand) {
								choice.push("basic");
							}
						}
						if (!choice.includes("trick")) {
							if (unknown.some(i => get.type(i, "trick", target) === "trick")) {
								rand = 0.9;
							} else {
								rand = 0.1;
							}
							if (Math.random() < rand) {
								choice.push("trick");
							}
						}
						if (!choice.includes("equip")) {
							if (unknown.some(i => get.type(i, null, target) === "equip")) {
								rand = 0.75;
							} else {
								rand = 0.25;
							}
							if (Math.random() < rand) {
								choice.push("equip");
							}
						}
						return choice;
					})()
				)
				.forResult();
			if (!result?.bool) {
				return;
			}
			const choices = result.links.map(i => i[2].slice(8));
			if (!event.isMine() && !event.isOnline()) {
				await game.delayx();
			}
			let num = 0;
			["basic", "trick", "equip"].forEach(type => {
				if (choices.includes(type) == target.hasCard(card => get.type2(card, target) === type, "h")) {
					num++;
				}
			});
			player.popup("猜对" + get.cnNumber(num) + "项");
			game.log(player, "猜对了" + get.cnNumber(num) + "项");
			if (num > 0) {
				player.addTempSkill(`${event.name}_damage`);
				const map = player.getStorage(`${event.name}_damage`, {});
				map[target.playerid] ??= 0;
				map[target.playerid]++;
				player.setStorage(`${event.name}_damage`, map, true);
			}
			if (num > 1) {
				if (trigger.addCount != false) {
					trigger.addCount = false;
					const stat = player.getStat().card,
						name = trigger.card.name;
					if (typeof stat[name] == "number") {
						stat[name]--;
					}
					game.log(trigger.card, "不计入次数");
				}
				await player.draw(2);
			}
			if (num > 2) {
				await player.addTempSkills(get.info(event.name).derivation, { player: "phaseBegin" });
			}
		},
		ai: { threaten: 2.4 },
		subSkill: {
			damage: {
				audio: "ollingren",
				charlotte: true,
				onremove: true,
				init(player, skill) {
					player.storage[skill] = {};
				},
				intro: {
					name: "凌人（加伤）",
					markcount: () => 0,
					content(storage, player) {
						if (!storage) {
							return "无效果";
						}
						let str = "";
						for (const id in storage) {
							const target = _status.connectMode ? lib.playerOL[id] : game.playerMap[id];
							const num = storage[id];
							str += `<li>${get.translation(target)}：+${num}<br>`;
						}
						return str;
					},
				},
				trigger: {
					source: "damageBegin1",
				},
				filter(event, player) {
					return player.getStorage("ollingren_damage", {})[event.player.playerid] > 0;
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					const storage = player.getStorage(event.name, {});
					const num = storage[target.playerid];
					delete storage[target.playerid];
					if (!Object.keys(storage).length) {
						player.removeSkill(event.name);
					} else {
						player.setStorage(event.name, storage, true);
					}
					trigger.num += num;
				},
			},
		},
	},
	//皇甫嵩
	olyanjing: {
		audio: 2,
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2(event.skill),
					filterTarget: lib.filter.all,
					ai(target) {
						const player = get.player();
						if (target.getHp() > 2) {
							return 0;
						}
						if (target.getHp() == 2 && player.countCards("h") < 2) {
							return 0;
						}
						return get.damageEffect(target, player, player, "fire");
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			player.addTempSkill(`${event.name}_skip`);
			player.addMark(`${event.name}_skip`, target.getHp(), false);
			await target.damage({ nature: "fire" });
		},
		subSkill: {
			skip: {
				charlotte: true,
				forced: true,
				popup: false,
				onremove: true,
				intro: {
					content: "还需跳过#个阶段",
				},
				trigger: {
					player: "phaseAnyBefore",
				},
				filter(event, player) {
					return player.hasMark("olyanjing_skip");
				},
				async content(event, trigger, player) {
					game.log(player, "跳过了", `#g${get.translation(trigger)}`);
					player.removeMark(event.name, 1, false);
					if (!player.hasMark(event.name)) {
						player.removeSkill(event.name);
					}
					trigger.cancel();
				},
			},
		},
	},
	olfenyue: {
		audio: 2,
		zhuanhuanji: true,
		mark: true,
		marktext: "☯",
		intro: {
			content(storage, player) {
				return `每回合结束时，若本回合有角色受到过属性伤害，你可以${!storage ? "摸两张牌" : "使用一张【杀】"}`;
			},
		},
		trigger: {
			global: "phaseEnd",
		},
		filter(event, player) {
			return game.hasGlobalHistory("changeHp", evt => {
				return evt.getParent()?.name == "damage" && evt.getParent()?.hasNature();
			});
		},
		direct: true,
		async content(event, trigger, player) {
			const bool = player.storage[event.name];
			if (!bool) {
				const result = await player
					.chooseBool({
						prompt: get.prompt(event.name),
						prompt2: get.skillInfoTranslation(event.name, player, false),
						choice: true,
					})
					.forResult();
				if (result.bool) {
					player.logSkill(event.name);
					player.changeZhuanhuanji(event.name);
					await player.draw({ num: 2 });
				}
			} else {
				await player
					.chooseToUse({
						prompt: get.prompt(event.name),
						prompt2: get.skillInfoTranslation(event.name, player, false),
						filterCard(card, player) {
							if (get.itemtype(card) != "card" || get.name(card) != "sha") {
								return false;
							}
							return lib.filter.filterCard.call(this, card, player);
						},
					})
					.set("onresult", result => {
						const player = get.player();
						player.logSkill("olfenyue");
						player.changeZhuanhuanji("olfenyue");
					});
			}
		},
	},
};
