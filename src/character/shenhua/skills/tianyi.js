import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "tianyi" | "tianyi2" | "tianyi3" | "shuangxiong" | "shuangxiong1" | "shuangxiong2" | "luanji" | "xueyi" | "mengjin" | "jiewei">} */
export const groupSkills = {
	tianyi: {
		audio: 2,
		audioname: ["re_taishici"],
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player.canCompare(target);
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async content(event, trigger, player) {
			const { bool } = await player.chooseToCompare(event.target).forResult();
			if (bool) {
				player.addTempSkill("tianyi2");
			} else {
				player.addTempSkill("tianyi3");
			}
		},
		ai: {
			order(name, player) {
				const cards = player.getCards("h");
				if (player.countCards("h", "sha") == 0) {
					return 1;
				}
				for (let i = 0; i < cards.length; i++) {
					if (cards[i].name != "sha" && get.number(cards[i]) > 11 && get.value(cards[i]) < 7) {
						return 9;
					}
				}
				return get.order({ name: "sha" }) - 1;
			},
			result: {
				player(player) {
					if (player.countCards("h", "sha") > 0) {
						return 0.6;
					}
					const num = player.countCards("h");
					if (num > player.hp) {
						return 0;
					}
					if (num == 1) {
						return -2;
					}
					if (num == 2) {
						return -1;
					}
					return -0.7;
				},
				target(player, target) {
					const num = target.countCards("h");
					if (num == 1) {
						return -1;
					}
					if (num == 2) {
						return -0.7;
					}
					return -0.5;
				},
			},
			threaten: 1.3,
		},
	},
	tianyi2: {
		mod: {
			targetInRange(card, player, target, now) {
				if (card.name == "sha") {
					return true;
				}
			},
			selectTarget(card, player, range) {
				if (card.name == "sha" && range[1] != -1) {
					range[1]++;
				}
			},
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + 1;
				}
			},
		},
		charlotte: true,
	},
	tianyi3: {
		mod: {
			cardEnabled(card) {
				if (card.name == "sha") {
					return false;
				}
			},
		},
		charlotte: true,
	},
	shuangxiong: {
		audio: 2,
		audioname: ["re_yanwen"],
		group: "shuangxiong_judge",
		subSkill: {
			judge: {
				audio: "shuangxiong",
				logAudio: () => 1,
				trigger: { player: "phaseDrawBegin1" },
				check(event, player) {
					if (player.countCards("h") > player.hp) {
						return true;
					}
					if (player.countCards("h") > 3) {
						return true;
					}
					return false;
				},
				filter(event, player) {
					return !event.numFixed;
				},
				preHidden: true,
				prompt2: () => "进行一次判定，本回合可以将一张与此牌颜色不同的手牌当作【决斗】使用",
				async content(event, trigger, player) {
					trigger.changeToZero();
					await player.judge().set("callback", lib.skill.shuangxiong_judge.callback);
				},
				async callback(event, trigger, player) {
					await player.gain(event.card, "gain2");
					player.addTempSkill("shuangxiong_viewas");
					player.markAuto("shuangxiong_viewas", [event.judgeResult.color]);
				},
			},
			viewas: {
				charlotte: true,
				onremove: true,
				audio: "shuangxiong",
				logAudio: () => "shuangxiong2.mp3",
				enable: "chooseToUse",
				viewAs: { name: "juedou" },
				position: "hs",
				viewAsFilter(player) {
					return player.hasCard(card => lib.skill.shuangxiong_viewas.filterCard(card, player), "hs");
				},
				filterCard(card, player) {
					const color = get.color(card),
						colors = player.getStorage("shuangxiong_viewas");
					for (const i of colors) {
						if (color != i) {
							return true;
						}
					}
					return false;
				},
				prompt() {
					const colors = _status.event.player.getStorage("shuangxiong_viewas");
					let str = "将一张颜色";
					for (let i = 0; i < colors.length; i++) {
						if (i > 0) {
							str += "或";
						}
						str += "不为";
						str += get.translation(colors[i]);
					}
					str += "的手牌当做【决斗】使用";
					return str;
				},
				check(card) {
					const player = _status.event.player;
					const raw = player.getUseValue(card, null, true);
					const eff = player.getUseValue(get.autoViewAs({ name: "juedou" }, [card]));
					return eff - raw;
				},
				ai: { order: 7 },
			},
			re_yanwen1: { audio: true },
			re_yanwen2: { audio: true },
		},
	},
	shuangxiong1: {
		audio: true,
		trigger: { player: "phaseDrawBegin1" },
		sourceSkill: "shuangxiong",
		check(event, player) {
			if (player.countCards("h") > player.hp) {
				return true;
			}
			if (player.countCards("h") > 3) {
				return true;
			}
			return false;
		},
		filter(event, player) {
			return !event.numFixed;
		},
		preHidden: true,
		prompt2: () => "进行一次判定，本回合可以将一张与此牌颜色不同的手牌当作【决斗】使用",
		async content(event, trigger, player) {
			trigger.changeToZero();
			await player.judge().set("callback", lib.skill.shuangxiong1.callback);
		},
		async callback(event, trigger, player) {
			await player.gain(event.card, "gain2");
			player.addTempSkill("shuangxiong2");
			player.markAuto("shuangxiong2", [event.judgeResult.color]);
		},
	},
	shuangxiong2: {
		charlotte: true,
		onremove: true,
		audio: true,
		audioname2: {
			re_yanwen: "shuangxiong_re_yanwen2",
		},
		enable: "chooseToUse",
		viewAs: { name: "juedou" },
		position: "hs",
		sourceSkill: "shuangxiong",
		viewAsFilter(player) {
			return player.hasCard(card => lib.skill.shuangxiong2.filterCard(card, player), "hs");
		},
		filterCard(card, player) {
			const color = get.color(card),
				colors = player.getStorage("shuangxiong2");
			for (const i of colors) {
				if (color != i) {
					return true;
				}
			}
			return false;
		},
		prompt() {
			const colors = _status.event.player.getStorage("shuangxiong2");
			let str = "将一张颜色";
			for (let i = 0; i < colors.length; i++) {
				if (i > 0) {
					str += "或";
				}
				str += "不为";
				str += get.translation(colors[i]);
			}
			str += "的手牌当做【决斗】使用";
			return str;
		},
		check(card) {
			const player = _status.event.player;
			const raw = player.getUseValue(card, null, true);
			const eff = player.getUseValue(get.autoViewAs({ name: "juedou" }, [card]));
			return eff - raw;
		},
		ai: { order: 7 },
	},
	luanji: {
		audio: 2,
		enable: "phaseUse",
		position: "hs",
		viewAs: { name: "wanjian" },
		filterCard(card, player) {
			if (ui.selected.cards.length) {
				return get.suit(card) == get.suit(ui.selected.cards[0]);
			}
			const cards = player.getCards("hs");
			for (let i = 0; i < cards.length; i++) {
				if (card != cards[i]) {
					if (get.suit(card) == get.suit(cards[i])) {
						return true;
					}
				}
			}
			return false;
		},
		selectCard: 2,
		complexCard: true,
		check(card) {
			const player = _status.event.player;
			const targets = game.filterPlayer(function (current) {
				return player.canUse("wanjian", current);
			});
			let num = 0;
			for (let i = 0; i < targets.length; i++) {
				let eff = get.sgn(get.effect(targets[i], { name: "wanjian" }, player, player));
				if (targets[i].hp == 1) {
					eff *= 1.5;
				}
				num += eff;
			}
			if (!player.needsToDiscard(-1)) {
				if (targets.length >= 7) {
					if (num < 2) {
						return 0;
					}
				} else if (targets.length >= 5) {
					if (num < 1.5) {
						return 0;
					}
				}
			}
			return 6 - get.value(card);
		},
		ai: {
			basic: {
				order: 8.5,
			},
		},
	},
	xueyi: {
		trigger: { player: "phaseDiscardBefore" },
		audio: 2,
		audioname: ["re_yuanshao"],
		audioname2: {
			pe_jun_yuanshao: ["xueyi_re_yuanshao1.mp3", "xueyi_re_yuanshao2.mp3"],
		},
		forced: true,
		firstDo: true,
		filter(event, player) {
			return (
				player.hasZhuSkill("xueyi") &&
				game.hasPlayer(function (current) {
					return current != player && current.group == "qun";
				}) &&
				player.countCards("h") > player.hp
			);
		},
		async content() {},
		mod: {
			maxHandcard(player, num) {
				if (player.hasZhuSkill("xueyi")) {
					return (
						num +
						game.countPlayer(function (current) {
							if (player != current && current.group == "qun") {
								return 2;
							}
						})
					);
				}
				return num;
			},
		},
		zhuSkill: true,
	},
	mengjin: {
		audio: 2,
		trigger: { player: "shaMiss" },
		//priority:-1,
		filter(event) {
			return event.target.countCards("he") > 0;
		},
		check(event, player) {
			return get.attitude(player, event.target) < 0;
		},
		logTarget: "target",
		async content(event, trigger, player) {
			await player.discardPlayerCard("he", trigger.target, true);
		},
	},
	jiewei: {
		trigger: { player: "turnOverEnd" },
		//direct:true,
		frequent: true,
		audio: "xinjiewei",
		async content(event, trigger, player) {
			await player.draw();
			const result = await player
				.chooseToUse(function (card) {
					if (!lib.filter.cardEnabled(card, _status.event.player, _status.event)) {
						return false;
					}
					const type = get.type(card, "trick");
					return type == "trick" || type == "equip";
				}, "是否使用一张锦囊牌或装备牌？")
				.forResult();
			if (!result.bool) {
				return;
			}
			const type = get.type(result.card || result.cards[0]);
			if (
				!game.hasPlayer(function (current) {
					if (type == "equip") {
						return current.countCards("e");
					} else {
						return current.countCards("j");
					}
				})
			) {
				return;
			}
			const next = player.chooseTarget("是否弃置场上的一张" + get.translation(type) + "牌？", function (card, player, target) {
				if (_status.event.type == "equip") {
					return target.countCards("e") > 0;
				} else {
					return target.countCards("j") > 0;
				}
			});
			next.set("ai", function (target) {
				if (type == "equip") {
					return -get.attitude(player, target);
				} else {
					return get.attitude(player, target);
				}
			});
			next.set("type", type);
			event.type = type;
			const result2 = await next.forResult();
			if (type && result2.bool && result2.targets && result2.targets.length) {
				player.line(result2.targets, "green");
				if (type == "equip") {
					player.discardPlayerCard(result2.targets[0], "e", true);
				} else {
					player.discardPlayerCard(result2.targets[0], "j", true);
				}
			}
		},
		ai: {
			combo: "moon_jushou",
		},
	},
};
