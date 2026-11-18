import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdgangjian" | "stdguijie" | "stdtianming" | "stdmizhao" | "stdzhongyan" | "stdzhaoxin" | "stdwufei" | "stdjiaochong" | "stdzhongzuo" | "stdwanlan" | "stdzongxuan" | "stdzhiyan">} */
export const groupSkills = {
	//四象封印·太阳
	//田丰
	stdgangjian: {
		audio: "sijian",
		trigger: { global: "phaseZhunbeiBegin" },
		filter(event, player) {
			return event.player.canUse({ name: "sha" }, player);
		},
		check(event, player) {
			if (get.attitude(player, event.player) > 0) {
				return false;
			}
			if (player.getEquip("bagua") || player.getEquip("rw_bagua")) {
				return true;
			}
			if (player.hasSkill("stdguijie") && player.countCards("hes", { color: "red" }) > 1) {
				return true;
			}
			if (player.countCards("hs", "shan") || (player.countCards("hs", "sha") && player.hasSkill("ollongdan", null, null, false))) {
				return true;
			}
			return get.effect(player, { name: "draw" }, player, player) + get.effect(event.player, { name: "sha" }, event.player, player);
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const { player: target } = trigger;
			const sha = get.autoViewAs({ name: "sha", isCard: true });
			if (target.canUse({ name: "sha" }, player)) {
				await target.useCard(sha, player);
				if (!game.hasPlayer2(current => current.hasHistory("damage", evt => evt.getParent(3) == event), true)) {
					target.addTempSkill(event.name + "_effect");
				}
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				mod: {
					cardEnabled(card) {
						if (get.type2(card) == "trick") {
							return false;
						}
					},
				},
				intro: { content: "本回合不能使用锦囊牌" },
			},
		},
	},
	stdguijie: {
		enable: ["chooseToRespond", "chooseToUse"],
		viewAs: {
			name: "shan",
			isCard: true,
		},
		filter(event, player) {
			return player.countCards("hes", { color: "red" }) > 1;
		},
		filterCard(card) {
			return get.color(card) == "red";
		},
		selectCard: 2,
		position: "hes",
		prompt: "弃置两张红色牌并摸一张牌，然后视为使用或打出一张【闪】",
		check(card) {
			return 6.5 - get.value(card);
		},
		log: false,
		async precontent(event, trigger, player) {
			player.logSkill("stdguijie");
			const cards = event.result.cards;
			await player.discard(cards);
			event.result.cards = [];
			await player.draw();
		},
		ai: {
			order(item, player) {
				if (player.countCards("hes", card => get.color(card) == "red" && get.name(card) != "shan") > 3) {
					return 7;
				}
				return 2;
			},
			respondShan: true,
			skillTagFilter(player) {
				return player.countCards("hes", { color: "red" }) > 1;
			},
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "respondShan") && current < 0) {
						return 0.6;
					}
				},
			},
		},
	},
	//刘协
	stdtianming: {
		audio: "tianming",
		inherit: "tianming",
		check(event, player) {
			const hs = player.getCards("h");
			if (hs.length <= 2 && hs.some(card => ["shan", "tao"].includes(card.name))) {
				return false;
			}
			return player.countCards("he") <= 3;
		},
		filter(event, player) {
			return event.card.name == "sha" && player.countCards("he");
		},
		async content(event, trigger, player) {
			if (player.countCards("he")) {
				await player.modedDiscard(player.getCards("he"));
			}
			await player.draw(2);
			const target = game.findPlayer(current => current.isMaxHp(true));
			if (target?.countCards("he") && player != target) {
				const result = await target
					.chooseBool(get.prompt(event.name), `弃置所有牌然后摸两张牌？`)
					.set("choice", target.countCards("he") <= 3)
					.forResult();
				if (result?.bool) {
					await target.modedDiscard(target.getCards("he"));
					await target.draw(2);
				}
			}
		},
	},
	stdmizhao: {
		audio: "mizhao",
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return player.countCards("h") && game.countPlayer(current => player != current) > 1;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), 2, lib.filter.notMe)
				.set("targetprompt", ["传诏对象", "讨伐对象"])
				.set("ai", target => {
					const player = get.player();
					const att = get.attitude(player, target);
					if (ui.selected.targets.length) {
						const target1 = ui.selected.targets[0];
						const targets = game.filterPlayer(
							current => player != current && current != target1 && get.effect(current, { name: "losehp" }, player, target1, player) > 0
						);
						if (targets.length) {
							return get.effect(target, { name: "losehp" }, player, target1, player);
						}
					}
					return att;
				})
				.set("multitarget", true)
				.forResult();
		},
		async content(event, trigger, player) {
			const { targets } = event;
			player.line2(targets);
			const [target1, target2] = targets;
			if (player.countCards("he")) {
				await player.give(player.getCards("he"), target1);
			}
			const result = await target1
				.chooseBool(get.prompt(event.name), `与${get.translation(target2)}各失去1点体力？`)
				.set(
					"choice",
					get.effect(target1, { name: "losehp" }, player, target1, player) +
						get.effect(target2, { name: "losehp" }, player, target1, player) >
						0
				)
				.forResult();
			if (!result?.bool) {
				return;
			}
			for (const target of targets.sortBySeat()) {
				await target.loseHp();
			}
		},
	},
	stdzhongyan: {
		trigger: { global: "die" },
		filter(event, player) {
			return event.player.group == "qun" && player.isDamaged();
		},
		zhuSkill: true,
		frequent: true,
		async content(event, trigger, player) {
			await player.recover();
		},
	},
	//司马昭
	stdzhaoxin: {
		audio: "xinfu_zhaoxin",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.countCards("h");
		},
		forced: true,
		async content(event, trigger, player) {
			const hs = player.getCards("h");
			if (!hs.length) {
				return;
			}
			await player.showCards(hs, `${get.translation(player)}发动了【${get.translation(event.name)}】`);
			const colors = hs.map(card => get.color(card)).toUniqued();
			if (colors.length !== 1) {
				return;
			}
			const result = await player
				.chooseTarget(true, get.prompt2(event.name))
				.set("ai", target => {
					const player = get.player();
					return get.damageEffect(target, player, player);
				})
				.forResult();
			if (result?.bool && result?.targets?.length) {
				await result.targets[0].damage();
			}
		},
	},
	//郭照
	stdwufei: {
		audio: "wufei",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return game.hasPlayer(current => current.hasSex("female") && current.countCards("h"));
		},
		async cost(event, trigger, player) {
			const list = game.filterPlayer(current => current.hasSex("female") && current.countCards("h"));
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return get.event().list.includes(target);
				})
				.set("ai", target => {
					const player = get.player();
					const att = Math.sign(get.attitude(player, target));
					const list = get
						.event()
						.list.filter(current => current.hasSex("female") && current.countCards("h") && get.attitude(player, current) < 0);
					if (list.length) {
						return -att * target.countCards("h");
					}
					const bool = Object.keys(lib.color).some(color => {
						const num = target.countCards("h", card => get.color(card, target) == color);
						return num > 0 && num <= 2;
					});
					return att * (bool ? 1 : 0);
				})
				.set("list", list)
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			if (!target.countCards("h")) {
				return;
			}
			await target.showHandcards();
			const list = [],
				bannedList = [],
				indexs = Object.keys(lib.color),
				hs = target.getCards("h");
			for (const card of hs) {
				const color = get.color(card, target);
				list.add(color);
				if (!lib.filter.cardDiscardable(card, target, "stdwufei")) {
					bannedList.add(color);
				}
				if (bannedList.length == indexs.length) {
					break;
				}
			}
			list.removeArray(bannedList);
			list.sort((a, b) => indexs.indexOf(a) - indexs.indexOf(b));
			if (!list.length) {
				return;
			}
			const dialog = ["诬诽：弃置一种颜色的所有牌并摸一张牌"];
			for (let i = 0; i < list.length; i++) {
				const colorx = list[i];
				const cards = hs.filter(card => get.color(card, target) == colorx);
				if (cards.length) {
					dialog.addArray([`<span class="text center">${get.translation(colorx)}</span>`, cards]);
				}
			}
			const result =
				list.length > 1
					? await target
							.chooseControl(list)
							.set("ai", () => {
								const { player, controls } = get.event();
								const cards = player.getCards("h");
								return controls.sort((a, b) => {
									return (
										get.value(cards.filter(card => get.color(card) === a)) -
										get.value(cards.filter(card => get.color(card) === b))
									);
								})[0];
							})
							.set("dialog", dialog)
							.forResult()
					: { control: list[0] };
			const control = result?.control;
			if (control) {
				target.popup(control);
				game.log(target, "选择了", "#g" + get.translation(control));
				const cards = target.getCards("h").filter(card => get.color(card) === control);
				if (cards.length) {
					await target.discard(cards);
					await target.draw();
				}
			}
		},
	},
	stdjiaochong: {
		audio: "yichong",
		inherit: "stdwufei",
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player.hasSex("male") && game.hasPlayer(current => current.hasSex("female") && current.countCards("h"));
		},
		async content(event, trigger, player) {
			await player.useSkill("stdwufei", event.targets);
		},
		derivation: "stdwufei",
	},
	//贾逵
	stdzhongzuo: {
		audio: "zhongzuo",
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			return ["damage", "sourceDamage"].some(key => player.hasHistory(key));
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			await game.asyncDraw([trigger.player, player].sortBySeat());
		},
	},
	stdwanlan: {
		audio: "wanlan",
		inherit: "wanlan",
		filter(event, player) {
			return event.player != player && event.player.hp <= 0 && player.countCards("h");
		},
		check(event, player) {
			if (get.attitude(player, event.player) < 4) {
				return false;
			}
			if (player.countCards("hs", card => player.canSaveCard(card, event.player)) >= 1 - event.player.hp) {
				return false;
			}
			if (event.player == player || event.player == get.zhu(player)) {
				return true;
			}
			if (get.recoverEffect(event.player, player, player) <= 0) {
				return false;
			}
			return !player.hasUnknown();
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const { player: target } = trigger;
			if (player.countCards("h")) {
				await player.give(player.getCards("h"), target);
			}
			await target.recoverTo(1);
		},
	},
	//虞翻
	stdzongxuan: {
		audio: "zongxuan",
		trigger: {
			player: "loseAfter",
			global: "loseAsyncAfter",
		},
		filter(event, player) {
			if (event.type != "discard" || !game.hasPlayer(current => current.countDiscardableCards(player, "ej"))) {
				return false;
			}
			return event.getl?.(player)?.hs?.someInD("d");
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.countDiscardableCards(player, "ej");
				})
				.set("ai", target => {
					const player = get.player();
					return get.effect(target, { name: "guohe_copy", position: "ej" }, player, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			if (target.countDiscardableCards(player, "ej")) {
				await player.discardPlayerCard(target, "ej", true);
			}
		},
	},
	stdzhiyan: {
		audio: "zhiyan",
		getcards: () =>
			get
				.discarded()
				.filterInD("d")
				.filter(card => get.type(card) == "equip"),
		trigger: { player: "phaseJieshuBegin" },
		filter(event, player) {
			return get.info("stdzhiyan").getcards().length;
		},
		async cost(event, trigger, player) {
			const cards = get.info(event.skill).getcards();
			const result = await player
				.chooseButton(["直言：获得其中一张牌", cards])
				.set("ai", button => {
					return get.value(button.link);
				})
				.forResult();
			event.result = {
				bool: result?.bool,
				cost_data: result?.links,
			};
		},
		async content(event, trigger, player) {
			await player.gain(event.cost_data, "gain2");
		},
	},
};
