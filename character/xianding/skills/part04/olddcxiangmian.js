import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "olddcxiangmian" | "dcxiangmian" | "dctianji">} */
export const groupSkills = {
	//朱建平
	olddcxiangmian: {
		audio: "dcxiangmian",
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return !player.getStorage("olddcxiangmian").includes(event.player) && player != event.player;
		},
		logTarget: "player",
		check(event, player) {
			return get.attitude(player, event.player) < 0;
		},
		content() {
			"step 0";
			player.judge(card => 2 / Math.sqrt(get.number(card, false))).set("judge2", result => result.bool);
			"step 1";
			player.markAuto("olddcxiangmian", [trigger.player]);
			trigger.player.addSkill("olddcxiangmian_countdown");
			if (!trigger.player.storage["olddcxiangmian_countdown"]) {
				trigger.player.storage["olddcxiangmian_countdown"] = [];
			}
			[player.playerid, result.suit, result.number].forEach(i => trigger.player.storage["olddcxiangmian_countdown"].push(i));
			trigger.player.markSkill("olddcxiangmian_countdown");
		},
		intro: { content: "已对$发动过技能" },
		ai: {
			expose: 0.3,
		},
		subSkill: {
			countdown: {
				trigger: { player: "useCardAfter" },
				mark: true,
				marktext: "噬",
				silent: true,
				forced: true,
				charlotte: true,
				intro: {
					markcount(storage) {
						if (storage) {
							var list = storage.filter((_, i) => i % 3 == 2);
							return Math.min.apply(null, list);
						}
					},
					content(storage, player) {
						var str = "使用";
						for (var i = 0; i < storage.length / 3; i++) {
							str += get.cnNumber(storage[i * 3 + 2]) + "张" + get.translation(storage[i * 3 + 1]) + "牌、";
						}
						str = str.slice(0, -1);
						str += "后，失去等同于体力值的体力";
						return str;
					},
				},
				filter(event, player) {
					if (!player.getStorage("olddcxiangmian_countdown").length) {
						return false;
					}
					return player
						.getStorage("olddcxiangmian_countdown")
						.filter((_, i) => i % 3 == 1)
						.includes(get.suit(event.card, player));
				},
				content() {
					"step 0";
					var storage = player.getStorage("olddcxiangmian_countdown");
					for (var i = 0; i < storage.length / 3; i++) {
						if (storage[i * 3 + 1] == get.suit(trigger.card, player)) {
							storage[i * 3 + 2]--;
						}
					}
					player.markSkill("olddcxiangmian_countdown");
					"step 1";
					var storage = player.getStorage("olddcxiangmian_countdown");
					for (var i = 0; i < storage.length / 3; i++) {
						if (storage[i * 3 + 2] <= 0) {
							if (!event.isMine() && !event.isOnline()) {
								game.delayx();
							}
							player.logSkill("olddcxiangmian_countdown");
							var target = (_status.connectMode ? lib.playerOL : game.playerMap)[i];
							player.storage["olddcxiangmian_countdown"].splice(i * 3, 3);
							if (!player.getStorage("olddcxiangmian_countdown").length) {
								player.removeSkill("olddcxiangmian_countdown");
							}
							if (player.hp > 0) {
								player.loseHp(player.hp);
							}
							i--;
						}
					}
				},
				ai: {
					effect: {
						player_use(card, player, target) {
							if (typeof card != "object") {
								return;
							}
							var storage = player.getStorage("olddcxiangmian_countdown");
							for (var i = 0; i < storage.length / 3; i++) {
								if (get.suit(card, player) == storage[i * 3 + 1] && storage[i * 3 + 2] == 1) {
									if (!player.canSave(player) && !get.tag(card, "save")) {
										return [0, -100, 0, 0];
									}
									return [1, -2 * player.hp, 1, 0];
								}
							}
						},
					},
				},
			},
		},
	},
	dcxiangmian: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.hasPlayer(current => lib.skill.dcxiangmian.filterTarget(null, player, current));
		},
		filterTarget(card, player, target) {
			return !player.getStorage("dcxiangmian").includes(target) && player != target;
		},
		content() {
			"step 0";
			target.judge(card => -2 / Math.sqrt(get.number(card, false))).set("judge2", result => (result.bool === false ? true : false));
			"step 1";
			player.markAuto("dcxiangmian", [target]);
			target.addSkill("dcxiangmian_countdown");
			if (!target.storage["dcxiangmian_countdown"]) {
				target.storage["dcxiangmian_countdown"] = [];
			}
			[player.playerid, result.suit, result.number].forEach(i => target.storage["dcxiangmian_countdown"].push(i));
			target.markSkill("dcxiangmian_countdown");
		},
		intro: { content: "已对$发动过技能" },
		ai: {
			expose: 0.3,
			order: 10,
			result: { target: -5 },
		},
		subSkill: {
			countdown: {
				trigger: { player: "useCardAfter" },
				mark: true,
				marktext: "💀",
				silent: true,
				forced: true,
				charlotte: true,
				intro: {
					markcount(storage) {
						if (storage) {
							var list = storage.filter((_, i) => i % 3 == 2);
							return Math.min.apply(null, list);
						}
					},
					content(storage, player) {
						if (!storage) {
							return;
						}
						var str = "使用";
						str +=
							get.cnNumber(
								Math.min.apply(
									null,
									storage.filter((_, i) => i % 3 == 2)
								)
							) + "张牌后，或使用一张";
						for (var i = 0; i < storage.length / 3; i++) {
							str += get.translation(storage[i * 3 + 1]) + "、";
						}
						str = str.slice(0, -1);
						str += "后，失去等同于体力值的体力";
						return str;
					},
				},
				filter(event, player) {
					if (!player.getStorage("dcxiangmian_countdown").length) {
						return false;
					}
					//return (player.getStorage('dcxiangmian_countdown').filter((_,i)=>i%3==1)).includes(get.suit(event.card,player));
					return true;
				},
				content() {
					"step 0";
					var storage = player.getStorage("dcxiangmian_countdown");
					for (var i = 0; i < storage.length / 3; i++) {
						if (storage[i * 3 + 1] == get.suit(trigger.card, player)) {
							storage[i * 3 + 2] = 0;
						} else {
							storage[i * 3 + 2]--;
						}
					}
					player.markSkill("dcxiangmian_countdown");
					"step 1";
					var storage = player.getStorage("dcxiangmian_countdown");
					for (var i = 0; i < storage.length / 3; i++) {
						if (storage[i * 3 + 2] <= 0) {
							if (!event.isMine() && !event.isOnline()) {
								game.delayx();
							}
							player.logSkill("dcxiangmian_countdown");
							player.storage["dcxiangmian_countdown"].splice(i * 3, 3);
							if (!player.getStorage("dcxiangmian_countdown").length) {
								player.removeSkill("dcxiangmian_countdown");
							}
							if (player.hp > 0) {
								player.loseHp(player.hp);
							}
							i--;
						}
					}
				},
				ai: {
					effect: {
						player_use(card, player, target) {
							if (typeof card != "object") {
								return;
							}
							var storage = player.getStorage("dcxiangmian_countdown");
							for (var i = 0; i < storage.length / 3; i++) {
								if (storage[i * 3 + 2] == 1 || get.suit(card, player) == storage[i * 3 + 1]) {
									if (!player.canSave(player) && !get.tag(card, "save")) {
										return [0, -100, 0, 0];
									}
									return [1, -2 * player.hp, 1, 0];
								}
							}
						},
					},
				},
			},
		},
	},
	dctianji: {
		audio: 2,
		trigger: { global: "cardsDiscardAfter" },
		forced: true,
		filter(event, player) {
			var evt = event.getParent().relatedEvent;
			return evt && evt.name == "judge" && event.cards.filterInD("d").length;
		},
		content() {
			var card = trigger.cards[0],
				cards = [],
				func = ["type2", "suit", "number"];
			for (var fn of func) {
				var cardx = get.cardPile2(cardxx => {
					if (get[fn](card, player) == get[fn](cardxx, player) && !cards.includes(cardxx)) {
						return true;
					}
				}, "random");
				if (cardx) {
					cards.push(cardx);
				}
			}
			/*if(cards.length&&!player.isMaxHandcard(true)) player.draw();
			else*/ if (cards.length) {
				player.gain(cards, "gain2");
			}
		},
	},
};
