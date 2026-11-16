import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "zhaosong" | "lisi" | "olfengzi" | "oljizhan" | "olfusong">} */
export const groupSkills = {
	//左棻
	zhaosong: {
		audio: 2,
		trigger: { global: "phaseDrawAfter" },
		logTarget: "player",
		filter(event, player) {
			if (player == event.player || !event.player.countCards("h")) {
				return false;
			}
			return !["basic", "trick", "equip"].some(mark => event.player.hasMark("zhaosong_" + mark));
		},
		prompt2: "令其交给你一张手牌，并根据类型获得对应的标记",
		check(event, player) {
			return get.attitude(player, event.player) > 0;
		},
		async content(event, trigger, player) {
			const { player: target } = trigger;
			if (!target.countCards("h")) {
				return;
			}
			const { cards } = await target.chooseToGive(player, "h", true, `${get.translation(player)}发动了【诏颂】；请交给其一张手牌`).forResult();
			if (!cards?.length) {
				return;
			}
			const mark = event.name + "_" + get.type2(cards[0], target);
			if (lib.skill[mark]) {
				target.addSkill(mark);
				target.addMark(mark);
			}
		},
		subSkill: {
			basic: {
				marktext: "颂",
				intro: {
					name: "诏颂(颂)",
					name2: "颂",
					content: "当你使用【杀】选择唯一目标时，你可移去“颂”，并为此【杀】增加至多两个目标。",
				},
				trigger: { player: "useCard2" },
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return player.hasMark("zhaosong_basic") && event.card.name == "sha" && event.targets.length == 1 && game.hasPlayer(current => current != player && current != event.targets[0] && lib.filter.targetEnabled2(event.card, player, current));
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget([1, 2], "是否弃置“颂”标记？", `为${get.translation(trigger.card)}增加至多两个目标`, (card, player, target) => {
							const evt = get.event().getTrigger();
							return target != player && target != evt.targets[0] && lib.filter.targetEnabled2(evt.card, player, target) && lib.filter.targetInRange(evt.card, player, target);
						})
						.set("ai", target => {
							const evt = get.event().getTrigger();
							return get.effect(target, evt.card, evt.player, evt.player);
						})
						.forResult();
				},
				async content(event, trigger, player) {
					if (player != event.player && !player.isOnline()) {
						await game.delayx();
					}
					player.removeMark(event.name, 1);
					player.removeSkill(event.name);
					trigger.targets.addArray(event.targets);
				},
			},
			trick: {
				marktext: "诔",
				intro: {
					name: "诏颂(诔)",
					name2: "诔",
					content: "当你进入濒死状态时，你可移去“诔”，然后将体力回复至1点并摸一张牌。",
				},
				trigger: { player: "dying" },
				prompt: "是否弃置“诔”标记？",
				prompt2: "回复体力至1点并摸一张牌。",
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return player.hasMark("zhaosong_trick") && player.hp < 1;
				},
				check(event, player) {
					if (player.countCards("hs", card => player.canSaveCard(card, player)) >= 1 - player.hp) {
						return false;
					}
					return true;
				},
				async content(event, trigger, player) {
					player.removeMark(event.name, 1);
					player.removeSkill(event.name);
					await player.recoverTo(1);
					await player.draw();
				},
			},
			equip: {
				marktext: "赋",
				intro: {
					name: "诏颂(赋)",
					name2: "赋",
					content: "出牌阶段开始时，你可移去“赋”并弃置一名角色区域内的至多两张牌。",
				},
				trigger: { player: "phaseUseBegin" },
				charlotte: true,
				onremove: true,
				filter(event, player) {
					return player.hasMark("zhaosong_equip") && game.hasPlayer(current => current.countDiscardableCards(player, "hej"));
				},
				async cost(event, trigger, player) {
					event.result = await player
						.chooseTarget("是否弃置“赋”标记？", "弃置一名角色区域内的至多两张牌", (card, player, target) => {
							return target.countDiscardableCards(player, "hej");
						})
						.set("ai", target => {
							const player = get.player(),
								att = get.attitude(player, target) > 0 ? 2 : 1;
							return get.effect(target, { name: "guohe_copy" }, player, player) * att;
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const {
						targets: [target],
					} = event;
					player.removeMark(event.name, 1);
					player.removeSkill(event.name);
					if (target.countDiscardableCards(player, "hej")) {
						await player.discardPlayerCard(target, true, "hej", [1, 2]);
					}
				},
			},
		},
	},
	lisi: {
		audio: 2,
		trigger: { player: "useCardAfter" },
		filter(event, player) {
			if (player == _status.currentPhase || !event.cards.someInD()) {
				return false;
			}
			return game.hasPlayer(current => current != player && current.countCards("h") <= player.countCards("h"));
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt(event.skill), `将${get.translation(trigger.cards.filterInD())}交给一名手牌数不大于你的其他角色`, (card, player, target) => {
					return target != player && target.countCards("h") <= player.countCards("h");
				})
				.set("ai", target => {
					const { player, cards } = get.event();
					let att = get.attitude(player, target),
						name = cards[0].name;
					if (att < 3) {
						return 0;
					}
					if (target.hasJudge("lebu")) {
						att /= 5;
					}
					if (name === "sha" && target.hasSha()) {
						att /= 5;
					}
					if (name === "wuxie" && target.needsToDiscard(cards)) {
						att /= 5;
					}
					return att / (1 + get.distance(player, target, "absolute"));
				})
				.set("cards", trigger.cards)
				.forResult();
		},
		async content(event, trigger, player) {
			await event.targets[0].gain(trigger.cards.filterInD(), "gain2");
		},
	},
	//王荣
	olfengzi: {
		audio: 2,
		trigger: { player: "useCard" },
		usable: 1,
		filter(event, player) {
			if (event.olfengzi_buff || !event.targets.length || !player.isPhaseUsing() || player.hasSkill("olfengzi_buff")) {
				return false;
			}
			const type = get.type(event.card, null, false);
			if (type != "basic" && type != "trick") {
				return false;
			}
			return player.hasCard(i => {
				if (_status.connectMode) {
					return true;
				}
				return get.type2(i, player) == type;
			}, "h");
		},
		async cost(event, trigger, player) {
			if (player != game.me && !player.isUnderControl() && !player.isOnline()) {
				await game.delayx();
			}
			const type = get.type(trigger.card, null, false);
			event.result = await player
				.chooseToDiscard("h", get.prompt(event.name.slice(0, -5)), `弃置一张${get.translation(type)}牌，令${get.translation(trigger.card)}结算两次`, (card, player) => {
					return get.type2(card, player) == get.event().type;
				})
				.set("type", type)
				.set("ai", card => {
					const player = get.player();
					const trigger = get.event().getTrigger();
					if (trigger.card.name == "tiesuo") {
						return 0;
					}
					let num = 0;
					for (const i of trigger.targets) {
						num += get.effect(i, trigger.card, player, player);
					}
					if (num <= 0) {
						return 0;
					}
					return 7 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.effectCount++;
		},
		/*subSkill:{
			buff:{
				trigger:{global:'useCardToTargeted'},
				forced:true,
				charlotte:true,
				popup:false,
				lastDo:true,
				filter:function(event,player){
					return (event.parent.olfengzi_buff==player&&event.targets.length==event.parent.triggeredTargets4.length);
				},
				content:function(){
					trigger.getParent().targets=trigger.getParent().targets.concat(trigger.targets);
					trigger.getParent().triggeredTargets4=trigger.getParent().triggeredTargets4.concat(trigger.targets);
				},
				onremove:function(player){
					delete player.storage.counttrigger.olfengji;
				},
			},
		},*/
	},
	oljizhan: {
		audio: 2,
		trigger: { player: "phaseDrawBegin1" },
		filter(event, player) {
			return !event.numFixed;
		},
		async content(event, trigger, player) {
			trigger.changeToZero();
			const cards = [];
			const card = get.cards()[0];
			await game.cardsGotoOrdering(card);
			cards.push(card);
			event.num = get.number(card, false);
			await player.showCards(card, get.translation(player) + "发动了【吉占】");
			while (true) {
				const str = get.strNumber(event.num);
				const result = await player
					.chooseControl("大于" + str, "小于" + str)
					.set("prompt", "吉占：猜测下一张牌的点数")
					.set("ai", () => (get.event().getParent().num < 7 ? 0 : 1))
					.forResult();
				const choice = result.index == 0 ? "大于" : "小于";
				player.popup(choice, "water");
				game.log(player, "猜测", "#y" + choice);
				const card = get.cards()[0];
				await game.cardsGotoOrdering(card);
				cards.push(card);
				const num = get.number(card, false);
				await player.showCards(card, get.translation(player) + "发动了【吉占】");
				if ((result.index == 0 && num > event.num) || (result.index == 1 && num < event.num)) {
					event.num = num;
				} else {
					if (num == event.num) {
						player.chat("什么对子我说？");
					}
					if (cards.length < 4) {
						player.chat(cards.length == 2 ? "连英姿都没有？！" : "明牌英姿…");
					}
					break;
				}
			}
			if (cards.length) {
				await player.gain(cards, "gain2");
			}
		},
	},
	olfusong: {
		audio: 2,
		forceDie: true,
		trigger: { player: "die" },
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return game.hasPlayer(current => current.maxHp > player.maxHp);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.maxHp > player.maxHp;
				})
				.set("forceDie", true)
				.set("ai", target => get.attitude(get.player(), target))
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
			} = event;
			const { control } = await target
				.chooseControl("olfengzi", "oljizhan")
				.set("prompt", "获得其中一个技能")
				.set("ai", () => (Math.random() > 0.5 ? 0 : 1))
				.forResult();
			if (!control) {
				return;
			}
			await target.addSkills(control);
		},
		derivation: ["olfengzi", "oljizhan"],
	},
};
