import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twmingce" | "twfushu" | "twxiumu" | "twhuiyu" | "twbeixing">} */
export const groupSkills = {
	//谋陈宫
	twmingce: {
		audio: "sbmingce",
		enable: "phaseUse",
		position: "he",
		filter(event, player) {
			return player.countCards("he") > 0 && player.getStorage("twmingce_used").length < 2;
		},
		filterCard: true,
		check(card) {
			const player = get.player();
			if (player.getStorage("twmingce_used").includes(1)) {
				return 6 - get.value(card);
			}
			return 8 - get.value(card);
		},
		filterTarget: lib.filter.notMe,
		selectTarget: 1,
		discard: false,
		lose: false,
		delay: false,
		onremove: true,
		group: "twmingce_hit",
		async content(event, trigger, player) {
			const { cards } = event,
				{ target } = event,
				name = "twmingce_used",
				storage = player.getStorage(name);
			const extra = storage.length < 1 ? 1 : 0;
			await player.give(cards, target);
			let choices = ["选项一", "选项二"],
				choiceList = [
					`失去1点体力，令${get.translation(player)}摸${get.cnNumber(2 + extra)}张牌并获得1枚“策”`,
					`摸${get.cnNumber(1 + extra)}张牌`,
				];
			storage.forEach(num => {
				choices.remove(`选项${get.cnNumber(num + 1, true)}`);
				choiceList[num] = '<span style="opacity:0.5">' + choiceList[num] + "</span>";
			});
			let result;
			if (choices.length == 1) {
				result = { index: storage[0] == 0 ? 1 : 0 };
			} else {
				result = await target
					.chooseControl({
						controls: choices,
						choiceList,
						prompt: get.translation(player) + "对你发动了【明策】，请选择一项",
						choice: 1,
					})
					.forResult();
			}
			if (typeof result?.index !== "number") {
				return;
			}
			player.addTempSkill(name, ["phaseChange", "phaseUseAfter"]);
			player.markAuto(name, result.index);
			if (result.index == 0) {
				await target.loseHp();
				await player.draw({ num: 2 + extra });
				player.addMark(event.name, 1);
			} else {
				await target.draw({ num: 1 + extra });
			}
		},
		marktext: "笨",
		intro: {
			name: "策(明策)",
			name2: "策",
			content: "mark",
		},
		ai: {
			result: {
				target(player, target) {
					if (!player.getStorage("twmingce_used").includes(1)) {
						return 1;
					}
					return -1;
				},
			},
			order: 8.5,
			expose: 0.2,
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			hit: {
				audio: "sbmingce",
				trigger: { player: "phaseUseBegin" },
				filter(event, player) {
					return player.hasMark("twmingce");
				},
				async cost(event, trigger, player) {
					const num = player.countMark("twmingce");
					event.result = await player
						.chooseTarget({
							prompt: get.prompt(event.skill),
							prompt2: "移去所有“策”，对一名其他角色造成" + num + "点伤害",
							filterTarget: lib.filter.notMe,
							ai(target) {
								const player = _status.event.player;
								const eff = get.damageEffect(target, player, player);
								let num = player.countMark("twmingce");
								if (target.hasSkillTag("filterDamage", null, { player: player })) {
									num = 1;
								}
								return eff * num;
							},
						})
						.forResult();
				},
				async content(event, trigger, player) {
					const target = event.targets[0],
						num = player.countMark("twmingce");
					player.removeMark("twmingce", num);
					await target.damage({ num });
				},
			},
		},
	},
	//幻曹冲
	twfushu: {
		audio: 2,
		enable: "chooseToUse",
		hiddenCard(player, name) {
			return name === "tao" && player.countCards("h") > 0 && !player.hasSkillTag("noCompareSource");
		},
		filter(event, player) {
			if (event.twfushu) {
				return false;
			}
			return event.filterCard({ name: "tao", isCard: true }, player, event) && player.countCards("h") && !player.hasSkillTag("noCompareSource");
		},
		filterCard: () => true,
		selectCard: 1,
		lose: false,
		discard: false,
		delay: false,
		log: false,
		check(card) {
			if (typeof card == "string" && lib.skill[card]) {
				var ais =
					lib.skill[card].check ||
					function () {
						return 0;
					};
				return ais();
			}
			var player = get.owner(card);
			var getn = function (card) {
				return get.number(card);
			};
			var event = _status.event.getParent();
			var addi = get.value(card) >= 8 && get.type(card) != "equip" ? -6 : 0;
			if (card.name == "du") {
				addi -= 5;
			}
			return getn(card) - get.value(card) / 5 + addi;
		},
		prompt: "选择一张手牌与牌堆顶的一张牌拼点：若你赢，你视为使用一张【桃】；若你没赢，你下次受到的伤害值+1",
		async precontent(event, trigger, player) {
			player.logSkill("twfushu");
			player.tempBanSkill("twfushu", null, false);
			const next = player.chooseToCompare().set("target", "cardPile");
			next.fixedResult ??= {};
			next.fixedResult[player.playerid] = event.result.cards[0];
			event.result.card = { name: "tao", isCard: true };
			delete event.result.cards;
			const result = await next.forResult();
			if (!result.bool) {
				player.addSkill("twfushu_damage");
				player.addMark("twfushu_damage", 1, false);
				const evt = event.getParent();
				evt.set("twfushu", true);
				evt.goto(0);
				delete evt.openskilldialog;
				return;
			}
		},
		viewAs: {
			name: "tao",
			isCard: true,
		},
		ai: {
			save: true,
			skillTagFilter(player, tag, arg) {
				return player.countCards("h") > 0 && !player.hasSkillTag("noCompareSource");
			},
			order: 7,
			result: {
				player(player) {
					if (_status.event.dying) {
						return get.attitude(player, _status.event.dying);
					}
					return 1;
				},
			},
		},
		subSkill: {
			damage: {
				audio: 2,
				onremove: true,
				intro: {
					content: "下次受到的伤害+1",
				},
				charlotte: true,
				forced: true,
				trigger: {
					player: "damageBegin3",
				},
				filter(event, player) {
					return player.hasMark("twfushu_damage");
				},
				content() {
					trigger.num += player.countMark(event.name);
					player.removeSkill(event.name);
				},
			},
		},
	},
	twxiumu: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return game.hasPlayer(current => current.countCards("h") && current != player);
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), (card, player, target) => {
					return target.countCards("h") > 0 && target != player;
				})
				.set("ai", target => {
					const player = get.player();
					const num = player.countCards("h") - target.countCards("h");
					return get.attitude(player, target) * (num / 2);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const target = event.targets[0];
			let cards = [];
			if (
				target.getCards("h").reduce((num, card) => {
					return num + get.number(card, target);
				}, 0) < 13
			) {
				cards = target.getCards("h");
			} else {
				const result = await target
					.chooseCard(`修睦：请选择点数之和大于等于13的手牌与${get.translation(player)}的手牌交换`, [1, Infinity], true, "h")
					.set("filterOk", () => {
						const player = get.player();
						const selected = ui.selected.cards;
						if (!selected.length) {
							return false;
						}
						return (
							selected.reduce((num, card) => {
								return num + get.number(card, player);
							}, 0) >= 13
						);
					})
					.set("ai", card => {
						const player = get.player();
						const att = get.attitude(player, get.event().sourcex);
						const num = ui.selected.cards.reduce((num, cardx) => {
							return num + get.number(cardx, player);
						}, 0);
						if (num < 13) {
							if (att > 0) {
								return 8 - get.value(card);
							}
							return Math.ceil(get.number(card, player) / 4) * (6 - get.value(card));
						}
						return 0;
					})
					.set("sourcex", player)
					.forResult();
				cards = result?.cards;
			}
			if (get.itemtype(cards) == "cards") {
				await target.swapHandcards(player, cards, player.getCards("h"));
			}
		},
		ai: {
			//法正恩怨的ai
			maixie_defend: true,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return [1, -1.5];
					}
					if (!target.hasFriend()) {
						return;
					}
					if (get.tag(card, "damage")) {
						return [1, 0, 0, -0.7];
					}
				},
			},
		},
	},
	//TW张允
	twhuiyu: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return true;
		},
		async cost(event, trigger, player) {
			const targetprompt = Math.random() > 0.25 ? ["代替", "被代替"] : ["替罪羊", "躺赢狗"];
			if (targetprompt[1] == "躺赢狗") {
				trigger.set("twhuiyu_tyg", true);
			}
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), 2)
				.set("ai", target => {
					const selected = ui.selected.targets;
					if (!selected.length) {
						return -get.attitude(get.player(), target);
					}
					return get.attitude(get.player(), target);
				})
				.set("targetprompt", targetprompt)
				.set("multitarget", true)
				.set("multiline", true)
				.set("complexTarget", true)
				.set("complexSelect", true)
				.forResult();
		},
		async content(event, trigger, player) {
			const source = event.targets[0],
				target = event.targets[1],
				skill = event.name + "_effect";
			target.addTempSkill(skill, { player: "phaseUseAfter" });
			//出现放权回合可能会重复指定，干脆直接覆盖掉原来的
			if (target.storage[skill]) {
				delete target.storage[skill];
			}
			target.markAuto(skill, [source]);
			target.addTip(skill, get.translation(skill) + " " + get.translation(source));
			if (trigger.twhuiyu_tyg) {
				player.chat(`${get.translation(target)}的评分是3.0，躺赢狗！`);
			}
		},
		subSkill: {
			effect: {
				charlotte: true,
				onremove(player, skill) {
					delete player.storage[skill];
					player.removeTip(skill);
				},
				intro: {
					markcount: () => 0,
					content: "你出牌阶段的替罪羊为：$",
				},
				trigger: {
					source: "damageBefore",
				},
				logTarget(event, player) {
					const source = game.findPlayer(target => player.getStorage("twhuiyu_effect").includes(target));
					return source;
				},
				forced: true,
				filter(event, player) {
					return lib.skill.twhuiyu_effect.logTarget(event, player)?.isIn() && player.isPhaseUsing();
				},
				content() {
					const source = event.targets[0];
					if (source.isIn()) {
						trigger.source = source;
						game.log(source, "代替", player, "成为伤害来源");
						source.line(trigger.player);
					}
				},
			},
		},
	},
	twbeixing: {
		audio: 2,
		round: 1,
		trigger: { global: "phaseUseEnd" },
		filter(event, player) {
			return player != event.player && event.player.countCards("h") && !event.player.hasHistory("sourceDamage");
		},
		check(event, player) {
			return get.attitude(player, event.player) < 0 && event.player.countDiscardableCards(player, "h");
		},
		logTarget: "player",
		async content(event, trigger, player) {
			const target = trigger.player;
			await player.showCards(target.getCards("h"), `${get.translation(player)}发动了〖${get.translation(event.name)}〗`);
			if (target.countDiscardableCards(player, "h") > 0) {
				await player.discardPlayerCard(target, "h", true, "visible");
			}
			const targets = player
				.getAllHistory("useSkill", evt => evt.skill == "twhuiyu")
				.reduce((list, evt) => {
					return list.add(evt.targets[0]);
				}, [])
				.filter(targetx => {
					return targetx.isIn() && target.countGainableCards(targetx, "h") > 0;
				});
			if (targets.length && player.hp > target.hp) {
				//淩越·体力
				const result = await player
					.chooseTarget(`狈行：你可令一名角色获得${get.translation(target)}的一张手牌`, (card, player, target) => {
						return get.event().targets.includes(target) && target != get.event().sourcex;
					})
					.set("ai", target => {
						return get.effect(get.event().sourcex, { name: "shunshou_copy2" }, target, player);
					})
					.set("targets", targets)
					.set("sourcex", target)
					.forResult();
				if (!result?.bool) {
					return;
				}
				const gainer = result.targets[0];
				player.line(gainer);
				await gainer.gainPlayerCard(target, "h", true, "visible");
			}
		},
	},
};
