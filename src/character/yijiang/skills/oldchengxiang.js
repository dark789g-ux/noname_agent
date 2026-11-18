import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oldchengxiang" | "chengxiang" | "oldrenxin" | "renxin" | "yuce" | "xiansi" | "xiansix">} */
export const groupSkills = {
	oldchengxiang: {
		audio: "chengxiang",
		inherit: "chengxiang",
		maxNum: 12,
	},
	chengxiang: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.num > 0;
		},
		//模版继承会用到，别问，问就是四个称象合一起，全靠event.name分效果
		//能拿的牌的点数和
		maxNum: 13,
		//亮出牌的数量
		getNum(player, num) {
			return num;
		},
		//拿完牌之后的回调
		async callback(event, trigger, player) {
			return;
		},
		frequent: true,
		async content(event, trigger, player) {
			const num = get.info(event.name).getNum(player, 4);
			event.showCards ??= [];
			const cards = [];
			event.cards = cards;
			//给肌肉曹冲用的，修改称象亮出的牌
			await event.trigger("chengxiangShowBegin");
			cards.addArray(event.showCards);
			if (num > cards.length) {
				cards.addArray(get.cards(num - cards.length));
			}
			await player.showCards(cards, `${get.translation(player)}发动了〖${get.translation(event.name)}〗`, true).set("clearArena", false);
			const maxNum = get.info(event.name).maxNum;
			const result = await player
				.chooseCardButton(cards, `称象：选择任意张点数不大于${maxNum}的牌`, [1, Infinity], true)
				.set("filterButton", function (button) {
					let num = 0;
					for (const selectedButton of ui.selected.buttons) {
						num += get.number(selectedButton.link);
					}
					return num + get.number(button.link) <= _status.event.maxNum;
				})
				.set("maxNum", maxNum)
				.set("ai", function (button) {
					let player = _status.event.player,
						name = get.name(button.link),
						val = get.value(button.link, player);
					if (name === "tao") {
						return val + 2 * Math.min(3, 1 + player.getDamagedHp());
					}
					if (name === "jiu" && player.hp < 3) {
						return val + 2 * (2.8 - player.hp);
					}
					if (name === "wuxie" && player.countCards("j") && !player.hasWuxie()) {
						return val + 5;
					}
					if (player.hp > 1 && (player.hasSkill("renxin") || player.hasSkill("olrenxin")) && player.hasFriend() && get.type(button.link) === "equip") {
						return val + 4;
					}
					return val;
				})
				.forResult();
			game.broadcastAll(ui.clear);
			if (result.links?.length) {
				const { links } = result;
				event.cards2 = links;
				await player.gain(links, "gain2");
				await get.info(event.name).callback(event, trigger, player);
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						if (target.hp >= 4) {
							return [1, 2];
						}
						if (target.hp == 3) {
							return [1, 1.5];
						}
						if (target.hp == 2) {
							return [1, 0.5];
						}
					}
				},
			},
		},
	},
	/*chengxiang: {
		audio: 2,
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return event.num > 0;
		},
		frequent: true,
		async content(event, trigger, player) {
			let num = 4;
			if (!event.showCards) {
				event.showCards = [];
			}
			await event.trigger("chengxiangShowBegin");
			if (event.name == "olchengxiang") {
				let mark = player.countMark("olchengxiang");
				num += mark;
				player.removeMark("olchengxiang", mark, false);
			}
			const cards = [];
			if (num > event.showCards.length) {
				cards.addArray(get.cards(num - event.showCards.length));
				await game.cardsGotoOrdering(cards);
			}
			cards.addArray(event.showCards);
			const videoId = lib.status.videoId++;
			game.broadcastAll(
				function (player, id, cards, num) {
					var str;
					if (player == game.me && !_status.auto) {
						str = "称象：选择任意张点数不大于" + num + "的牌";
					} else {
						str = "称象";
					}
					var dialog = ui.create.dialog(str, cards);
					dialog.videoId = id;
				},
				player,
				videoId,
				cards,
				event.name == "oldchengxiang" ? 12 : 13
			);
			const time = get.utc();
			game.addVideo("showCards", player, ["称象", get.cardsInfo(cards)]);
			game.addVideo("delay", null, 2);
			const next = player.chooseButton([0, Infinity]);
			next.set("dialog", videoId);
			next.set("filterButton", function (button) {
				let num = 0;
				for (let i = 0; i < ui.selected.buttons.length; i++) {
					num += get.number(ui.selected.buttons[i].link);
				}
				return num + get.number(button.link) <= _status.event.maxNum;
			});
			next.set("maxNum", event.name == "oldchengxiang" ? 12 : 13);
			next.set("ai", function (button) {
				let player = _status.event.player,
					name = get.name(button.link),
					val = get.value(button.link, player);
				if (name === "tao") {
					return val + 2 * Math.min(3, 1 + player.getDamagedHp());
				}
				if (name === "jiu" && player.hp < 3) {
					return val + 2 * (2.8 - player.hp);
				}
				if (name === "wuxie" && player.countCards("j") && !player.hasWuxie()) {
					return val + 5;
				}
				if (player.hp > 1 && player.hasSkill("renxin") && player.hasFriend() && get.type(button.link) === "equip") {
					return val + 4;
				}
				return val;
			});
			const result = await next.forResult();
			let cards2 = [];
			if (result.bool && result.links) {
				for (let i = 0; i < result.links.length; i++) {
					cards2.push(result.links[i]);
					cards.remove(result.links[i]);
				}
			} else {
				return;
			}
			let timex = 1000 - (get.utc() - time);
			if (timex > 0) {
				await game.delay(0, timex);
			}
			game.broadcastAll("closeDialog", videoId);
			await player.gain(cards2, "gain2");
			if (event.name == "olchengxiang") {
				let num = cards2.reduce((num, i) => {
					return num + get.number(i, player);
				}, 0);
				if (num == 13) {
					player.addMark("olchengxiang", 1, false);
				}
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage")) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						if (!target.hasFriend()) {
							return;
						}
						if (target.hp >= 4) {
							return [1, 2];
						}
						if (target.hp == 3) {
							return [1, 1.5];
						}
						if (target.hp == 2) {
							return [1, 0.5];
						}
					}
				},
			},
		},
	},*/
	oldrenxin: {
		audio: "renxin",
		trigger: { global: "dying" },
		//priority:6,
		filter(event, player) {
			return event.player != player && event.player.hp <= 0 && player.countCards("h") > 0;
		},
		check(event, player) {
			if (get.attitude(player, event.player) <= 0) {
				return false;
			}
			if (player.countCards("h", { name: ["tao", "jiu"] }) + event.player.hp < 0) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			await player.turnOver();
			await player.give(player.getCards("h"), trigger.player);
			await trigger.player.recover();
		},
	},
	renxin: {
		trigger: { global: "damageBegin4" },
		audio: 2,
		audioname: ["re_caochong"],
		//priority:6,
		filter(event, player) {
			return event.player != player && event.player.hp == 1 && player.countCards("he", { type: "equip" }) > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard({
					prompt: get.prompt("renxin", trigger.player),
					prompt2: "弃置一张装备牌并将武将牌翻面，然后防止" + get.translation(trigger.player) + "受到的伤害",
					filterCard: get.filter({ type: "equip" }),
					position: "he",
					ai(card) {
						const player = get.player();
						if (get.attitude(player, _status.event.getTrigger().player) > 3) {
							return 11 - get.value(card);
						}
						return -1;
					},
				})
				.set("chooseonly", true)
				.forResult();
		},
		logTarget: "player",
		async content(event, trigger, player) {
			await player.discard({
				cards: event.cards,
				discarder: player,
			});
			await player.turnOver();
			trigger.cancel();
		},
		ai: {
			expose: 0.5,
		},
	},
	yuce: {
		audio: 2,
		audioname: ["re_manchong"],
		trigger: { player: "damageEnd" },
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCard({
					prompt: get.prompt2(event.skill),
					ai(card) {
						if (get.type(card) == "basic") {
							return 1;
						}
						return Math.abs(get.value(card)) + 1;
					},
				})
				.forResult();
		},
		logTarget: "source",
		async content(event, trigger, player) {
			const {
				cards: [card],
				targets,
			} = event;
			await player.showCards(card, get.translation(player) + "发动了【御策】");
			const type = get.type2(card);
			let result;
			if (targets?.length && targets[0]?.isIn()) {
				result = await targets[0]
					.chooseToDiscard({
						prompt: "弃置一张不为" + get.translation(type) + "牌的手牌或令" + get.translation(player) + "回复1点体力",
						filterCard(card) {
							return get.type(card, "trick") != _status.event.type;
						},
						ai(card) {
							if (get.recoverEffect(_status.event.getParent().player, _status.event.player, _status.event.player) < 0) {
								return 7 - get.value(card);
							}
							return 0;
						},
					})
					.set("type", type)
					.forResult();
			} else {
				result = { bool: false };
			}
			if (!result.bool) {
				await player.recover({ source: targets?.[0] });
			}
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (get.tag(card, "damage") && target.countCards("h")) {
						return 0.8;
					}
				},
			},
		},
	},
	xiansi: {
		audio: 2,
		audioname: ["re_liufeng"],
		trigger: {
			player: "phaseZhunbeiBegin",
		},
		onremove(player) {
			const cards = player.getExpansions("xiansi");
			if (cards.length) {
				player.loseToDiscardpile(cards);
			}
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("xiansi"),
					filterTarget(card, player, target) {
						return target.countCards("he") > 0;
					},
					selectTarget: [1, 2],
					ai(target) {
						const player = get.player();
						return -get.attitude(player, target);
					},
				})
				.forResult();
		},
		logTarget: "targets",
		async content(event, trigger, player) {
			for (const target of event.targets) {
				const result = await player
					.choosePlayerCard({
						target,
						position: "he",
						forced: true,
					})
					.forResult();

				if (!result.bool || !result.cards?.length) {
					return;
				}

				await player.addToExpansion({
					cards: result.cards,
					source: target,
					animate: "give",
					gaintag: ["xiansi"],
				});
			}
		},
		group: "xiansix",
		global: "xiansi2",
		intro: {
			content: "expansion",
			markcount: "expansion",
		},
		ai: {
			threaten: 2,
		},
	},
	xiansix: {},
};
