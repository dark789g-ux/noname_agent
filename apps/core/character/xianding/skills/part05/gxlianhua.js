import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "gxlianhua" | "zhafu" | "reyingzi_gexuan" | "guanxing_gexuan" | "zhiyan_gexuan" | "gongxin_gexuan" | "tuiyan" | "busuan" | "busuan_angelbeats" | "mingjie">} */
export const groupSkills = {
	//管辂和葛玄
	gxlianhua: {
		derivation: ["reyingzi", "reguanxing", "xinzhiyan", "gongxin"],
		audio: 2,
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = {
					red: 0,
					black: 0,
				};
			}
		},
		marktext: "丹",
		intro: {
			name: "丹血",
			markcount(storage) {
				return storage.red + storage.black;
			},
			content(storage) {
				return "共有" + (storage.red + storage.black) + "个标记";
			},
		},
		trigger: { global: "damageEnd" },
		forced: true,
		locked: false,
		filter(event, player) {
			return event.player != player && event.player.isIn() && _status.currentPhase != player;
		},
		content() {
			player.storage.gxlianhua[player.getFriends().includes(trigger.player) ? "red" : "black"]++;
			player.markSkill("gxlianhua");
		},
		group: "gxlianhua_harmonia",
		subSkill: {
			harmonia: {
				forced: true,
				audio: "gxlianhua",
				sub: true,
				trigger: { player: "phaseZhunbeiBegin" },
				//filter:function(event,player){
				//	return player.storage.gxlianhua&&player.storage.gxlianhua.red+player.storage.gxlianhua.black>0;
				//},
				content() {
					var cards = [];
					var cards2 = [];
					var skill = "";
					var red = player.storage.gxlianhua.red;
					var black = player.storage.gxlianhua.black;
					player.storage.gxlianhua = { red: 0, black: 0 };
					player.unmarkSkill("gxlianhua");
					if (red + black < 4) {
						cards = ["tao"];
						skill = "reyingzi";
					} else if (red > black) {
						cards = ["wuzhong"];
						skill = "reguanxing";
					} else if (red < black) {
						cards = ["shunshou"];
						skill = "xinzhiyan";
					} else {
						cards = ["sha", "juedou"];
						skill = "gongxin";
					}
					for (var i = 0; i < cards.length; i++) {
						var card = get.cardPile(function (shiona) {
							return shiona.name == cards[i];
						});
						if (card) {
							cards2.push(card);
						}
					}
					player.addTempSkills(skill);
					if (cards2.length) {
						player.gain(cards2, "gain2", "log");
					}
				},
			},
		},
	},
	zhafu: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(current => current != player);
		},
		limited: true,
		skillAnimation: true,
		animationColor: "wood",
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.addSkill(event.name + "_effect");
			event.target.addMark(event.name + "_effect", 1);
		},
		ai: {
			order: 1,
			result: {
				player(player, target) {
					return Math.max(
						0,
						1 +
							target.countCards("h") -
							game.countPlayer(current => {
								if (get.attitude(target, current) > 0) {
									return 0.3;
								}
								if (target.hasJudge("lebu")) {
									return 0.6;
								}
								if (target.inRange(current)) {
									return 1.5;
								}
								return 1;
							})
					);
				},
				target(player, target) {
					return -Math.max(
						0,
						1 +
							target.countCards("h") -
							game.countPlayer(current => {
								if (get.attitude(target, current) > 0) {
									return 0.3;
								}
								if (target.hasJudge("lebu")) {
									return 0.6;
								}
								if (target.inRange(current)) {
									return 1.5;
								}
								return 1;
							})
					);
				},
			},
		},
		subSkill: {
			effect: {
				charlotte: true,
				audio: "zhafu",
				trigger: { global: "phaseDiscardBegin" },
				filter(event, player) {
					return event.player != player && event.player.hasMark("zhafu_effect");
				},
				forced: true,
				logTarget: "player",
				async content(event, trigger, player) {
					const target = trigger.player;
					target.removeMark(event.name, 1);
					if (target.countCards("h") <= 1) {
						return;
					}
					const result = await target
						.chooseCard("h", true, `选择保留一张手牌，将其余的手牌交给${get.translation(player)}`)
						.set("ai", get.value)
						.forResult();
					if (result?.bool) {
						const cards = target.getCards("h");
						cards.remove(result.cards[0]);
						if (cards.length) {
							await target.give(cards, player);
						}
					}
				},
				intro: {
					content: "mark",
					onunmark: true,
				},
			},
		},
	},
	reyingzi_gexuan: { audio: 1 },
	guanxing_gexuan: { audio: 1 },
	zhiyan_gexuan: { audio: 1 },
	gongxin_gexuan: { audio: 1 },
	tuiyan: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		frequent: true,
		async content(event, trigger, player) {
			const cards = get.cards(3, true);
			await game.cardsGotoOrdering(cards);
			game.log(player, "观看了牌堆顶的" + get.cnNumber(cards.length) + "张牌");
			await player.viewCards("推演：牌堆顶三张牌", cards);
			await game.cardsGotoPile(cards.reverse(), "insert");
		},
	},
	busuan: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget: lib.filter.notMe,
		async content(event, trigger, player) {
			const list = get.inpileVCardList(([type, _, name, nature]) => {
				if (!["basic", "trick", "delay"].includes(type)) {
					return false;
				}
				return !event.target.hasStorage("busuan_angelbeats", name);
			});
			const result = await player
				.chooseButton({
					createDialog: ["选择至多两种牌", [list, "vcard"]],
					forced: true,
					selectButton: [1, 2],
					ai(button) {
						const target = get.event().getParent().target;
						const card = get.autoViewAs({ name: button.link[2] });
						if (get.type(card) == "basic" || !target.hasUseTarget(card)) {
							return 0;
						}
						return get.attitude(get.player(), target) * (target.getUseValue(card) - 0.1);
					},
				})
				.forResult();
			if (result?.bool && result.links?.length) {
				event.target.addSkill("busuan_angelbeats");
				const storage = event.target.getStorage("busuan_angelbeats");
				storage.push(...result.links);
				event.target.setStorage("busuan_angelbeats", storage);
				player.localMarkSkill("busuan_angelbeats", event.target, event);
			}
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					const att = get.attitude(player, target);
					if (att > 0) {
						return 1;
					}
					return -5 / (target.countCards("h") + 1);
				},
			},
		},
	},
	busuan_angelbeats: {
		sourceSkill: "busuan",
		onremove: true,
		intro: {
			mark(dialog, content, player) {
				if (content?.length) {
					dialog.add([content, "vcard"]);
				}
			},
		},
		trigger: { player: "phaseDrawBegin1" },
		filter(event, player) {
			return !event.numFixed && player.getStorage("busuan_angelbeats").length;
		},
		forced: true,
		async content(event, trigger, player) {
			const list = player.getStorage(event.name);
			const cards = [];
			for (let i = 0; i < Math.min(trigger.num, list.length); i++) {
				const card = get.cardPile(function (cardx) {
					if (cards.includes(cardx)) {
						return false;
					}
					if (cardx.name != list[Math.min(i, list.length - 1)][2]) {
						return false;
					}
					return true;
				});
				if (card) {
					list.splice(i--, 1);
					trigger.num--;
					cards.push(card);
				}
			}
			if (cards.length) {
				await player.gain(cards, "draw");
				game.log(player, "获得了", get.cnNumber(cards.length), "张牌");
			}
			if (!list.length) {
				player.removeSkill(event.name);
			}
			player.setStorage(event.name, list);
			if (trigger.num <= 0) {
				await game.delay();
			}
		},
	},
	mingjie: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		check() {
			return ui.cardPile.hasChildNodes() && get.color(ui.cardPile.firstChild) != "black";
		},
		async content(event, trigger, player) {
			let count = 0;
			while (count < 3) {
				const { cards } = await player.draw().forResult();
				count += cards?.length;
				if (cards?.some(card => get.color(card) == "black")) {
					if (player.getHp() > 1) {
						await player.loseHp();
					}
					break;
				} else {
					const result = await player
						.chooseBool("是否继续发动【命戒】？")
						.set("ai", function () {
							if (get.event().count == 2) {
								return Math.random() < 0.5;
							}
							return lib.skill.mingjie.check();
						})
						.set("count", count)
						.forResult();
					if (!result.bool) {
						break;
					}
				}
			}
		},
	},
};
