import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "dcporui" | "dcgonghu" | "dcxiangshu">} */
export const groupSkills = {
	//乐綝
	dcporui: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			if (player == event.player) {
				return false;
			}
			if (player.countMark("dcporui_round") >= (player.hasMark("dcgonghu_basic") ? 2 : 1) || player.countCards("h") == 0) {
				return false;
			}
			return (
				game.hasPlayer(current => {
					if (current == player || current == event.player) {
						return false;
					}
					return current.hasHistory("lose", evt => evt.cards2.length);
				}) && player.countCards("he") > 0
			);
		},
		async cost(event, trigger, player) {
			const map = new Map();
			game.countPlayer(current => {
				if (current == player || current == trigger.player) {
					return false;
				}
				if (current.hasHistory("lose", evt => evt.cards2.length)) {
					map.set(
						current,
						Math.min(
							5,
							current.getHistory("lose").reduce((num, evt) => num + evt.cards2.length, 0)
						) + 1
					);
				}
			});
			const next = player
				.chooseCardTarget({
					prompt: get.prompt(event.skill),
					prompt2: get.skillInfoTranslation(event.skill, player, false),
					filterCard: lib.filter.cardDiscardable,
					position: "he",
					filterTarget(card, player, target) {
						return get.event().map.has(target);
					},
					ai1(card) {
						return 7 - get.value(card);
					},
					ai2(target) {
						let player = get.event().player,
							num = get.event().map.get(target),
							eff = get.effect(target, { name: "sha" }, player, player);
						if (num > 1 && eff !== 0) {
							eff -= (10 / target.getHp()) * Math.pow(2, num);
						}
						return eff * num;
					},
				})
				.set("map", map);
			next.set(
				"targetprompt2",
				next.targetprompt2.concat([
					target => {
						if (!target.isIn() || !get.event().filterTarget(null, get.player(), target)) {
							return false;
						}
						return `破锐${get.event().map.get(target)}`;
					},
				])
			);
			event.result = await next.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cards,
			} = event;
			player.addTempSkill(event.name + "_round", "roundStart");
			player.addMark(event.name + "_round", 1, false);
			await player.discard(cards);
			const num = Math.min(
				5,
				target.getHistory("lose").reduce((num, evt) => num + evt.cards2.length, 0)
			);
			let count = num + 1;
			const card = get.autoViewAs({ name: "sha", isCard: true, storage: { [event.name]: true } });
			while (count-- && player.canUse(card, target, false) && target.isIn()) {
				await player.useCard(card, target);
			}
			if (!player.hasMark("dcgonghu_damage") && target.isIn() && player.countCards("h") && num) {
				const numx = Math.min(num, player.countCards("h"));
				await player.chooseToGive(target, "h", numx, true, `破锐：交给${get.translation(target)}${get.cnNumber(numx)}张手牌`);
			}
		},
		subSkill: { round: { charlotte: true, onremove: true } },
		ai: {
			expose: 0.4,
			threaten: 3.8,
		},
	},
	dcgonghu: {
		audio: 2,
		trigger: {
			player: ["loseAfter", "damageEnd"],
			source: "damageSource",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		forced: true,
		filter(event, player) {
			if (event.name == "damage") {
				if (player.hasMark("dcgonghu_damage")) {
					return false;
				}
				var num = 0;
				player.getHistory("damage", evt => (num += evt.num));
				player.getHistory("sourceDamage", evt => (num += evt.num));
				return num > 1;
			}
			if (!_status.currentPhase || _status.currentPhase == player) {
				return false;
			}
			if (player.hasMark("dcgonghu_basic")) {
				return false;
			}
			if (_status.currentPhase && _status.currentPhase == player) {
				return false;
			}
			var evt = event.getl(player);
			if (!evt || !evt.cards2 || !evt.cards2.some(i => get.type2(i, player) == "basic")) {
				return false;
			}
			var num = 0;
			player.getHistory("lose", function (evtx) {
				if (num < 2) {
					if (evtx && evtx.cards2) {
						num += evtx.cards2.filter(i => get.type2(i, player) == "basic").length;
					}
				}
			});
			return num >= 2;
		},
		group: ["dcgonghu_basic", "dcgonghu_trick"],
		async content(event, trigger, player) {
			player.addMark("dcgonghu_" + (trigger.name == "damage" ? "damage" : "basic"), 1, false);
			game.log(player, "修改了技能", "#g【破锐】");
		},
		ai: {
			combo: "dcporui",
		},
		subSkill: {
			trick: {
				audio: "dcgonghu",
				trigger: { player: "useCard2" },
				direct: true,
				locked: true,
				filter(event, player) {
					if (!player.hasMark("dcgonghu_basic") || !player.hasMark("dcgonghu_damage")) {
						return false;
					}
					var card = event.card;
					if (get.color(card, false) != "red" || get.type(card, null, false) != "trick") {
						return false;
					}
					var info = get.info(card);
					if (info.allowMultiple == false) {
						return false;
					}
					if (event.targets && !info.multitarget) {
						if (
							game.hasPlayer(function (current) {
								return !event.targets.includes(current) && lib.filter.targetEnabled2(card, player, current);
							})
						) {
							return true;
						}
					}
					return false;
				},
				async content(event, trigger, player) {
					let result;

					// step 0
					const prompt2 = "为" + get.translation(trigger.card) + "增加一个目标";
					result = await player
						.chooseTarget(get.prompt("dcgonghu_trick"), function (card, player, target) {
							player = _status.event.player;
							return !_status.event.targets.includes(target) && lib.filter.targetEnabled2(_status.event.card, player, target);
						})
						.set("prompt2", prompt2)
						.set("ai", function (target) {
							const trigger = _status.event.getTrigger();
							const player = _status.event.player;
							return get.effect(target, trigger.card, player, player);
						})
						.set("card", trigger.card)
						.set("targets", trigger.targets)
						.forResult();
					// step 1
					if (result.bool) {
						if (!event.isMine() && !event.isOnline()) {
							game.delayx();
						}
						event.targets = result.targets;
					} else {
						return;
					}
					// step 2
					if (event.targets) {
						player.logSkill("dcgonghu_trick", event.targets);
						trigger.targets.addArray(event.targets);
					}
				},
			},
			basic: {
				audio: "dcgonghu",
				trigger: { player: "useCard" },
				forced: true,
				filter(event, player) {
					if (!player.hasMark("dcgonghu_basic") || !player.hasMark("dcgonghu_damage")) {
						return false;
					}
					var card = event.card;
					return get.color(card, false) == "red" && get.type(card, null, false) == "basic";
				},
				async content(event, trigger, player) {
					trigger.directHit.addArray(game.filterPlayer());
					game.log(trigger.card, "不可被响应");
				},
			},
		},
	},
	//张闿
	dcxiangshu: {
		audio: 2,
		trigger: { global: "phaseUseBegin" },
		direct: true,
		filter(event, player) {
			return event.player != player && event.player.countCards("h") >= event.player.hp;
		},
		async content(event, trigger, player) {
			let result;
			const list = [0, 1, 2, 3, 4, 5, "cancel2"];
			result = await player
				.chooseControl(list)
				.set("prompt", get.prompt2("dcxiangshu"))
				.set("ai", () => {
					return _status.event.choice;
				})
				.set(
					"choice",
					(function () {
						if (get.attitude(player, trigger.player) > 0) {
							return "cancel2";
						}
						const cards = trigger.player.getCards("h");
						let num = 0;
						for (const card of cards) {
							if (!trigger.player.hasValueTarget(card)) {
								num++;
								if (num >= 5) {
									break;
								}
							}
						}
						if (cards.length >= 3 && Math.random() < 0.5) {
							num = Math.max(0, num - 1);
						}
						return num;
					})()
				)
				.forResult();
			if (result?.control == "cancel2") {
				return;
			}
			player.logSkill("dcxiangshu", trigger.player);
			const num = result.index;
			player.storage.dcxiangshu_lottery = num;
			player.addTempSkill("dcxiangshu_lottery", "phaseUseAfter");
			result = await player
				.chooseToDiscard("相鼠：是否弃置一张手牌不公布此数字？", "h")
				.set("ai", card => 2 - get.value(card))
				.forResult();
			if (!result?.bool) {
				const lotteryNum = player.storage.dcxiangshu_lottery;
				player.markSkill("dcxiangshu_lottery");
				player.popup(lotteryNum);
				game.log(player, "选择了数字", "#g" + lotteryNum);
			}
		},
		subSkill: {
			lottery: {
				audio: "dcxiangshu",
				trigger: { global: "phaseUseEnd" },
				charlotte: true,
				forced: true,
				onremove: true,
				logTarget: "player",
				filter(event, player) {
					return typeof player.storage.dcxiangshu_lottery == "number" && Math.abs(event.player.countCards("h") - player.storage.dcxiangshu_lottery) <= 1;
				},
				async content(event, trigger, player) {
					const delt = Math.abs(trigger.player.countCards("h") - player.storage.dcxiangshu_lottery);
					if (delt <= 1 && trigger.player.countGainableCards("he", player) > 0) {
						await player.gainPlayerCard(trigger.player, "he", true);
					}
					if (delt == 0) {
						await trigger.player.damage(player);
					}
				},
				intro: { content: "猜测的数字为#" },
			},
		},
	},
};
