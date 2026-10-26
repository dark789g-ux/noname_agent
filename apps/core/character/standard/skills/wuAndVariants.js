import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "xiaoji" | "jieyin" | "qingnang" | "jijiu" | "jijiu_re_huatuo" | "wushuang" | "wushuang1" | "wushuang2" | "zhanshen" | "shenji" | "lijian" | "biyue" | "yaowu" | "new_jiangchi">} */
export const wuAndVariantsSkills = {
	xiaoji: {
		audio: 2,
		audioname: ["sp_sunshangxiang", "re_sunshangxiang"],
		trigger: {
			player: "loseAfter",
			global: ["equipAfter", "addJudgeAfter", "gainAfter", "loseAsyncAfter", "addToExpansionAfter"],
		},
		frequent: true,
		getIndex(event, player) {
			const evt = event.getl(player);
			if (evt?.player === player && evt.es) {
				return evt.es.length;
			}
			return false;
		},
		async content(event, trigger, player) {
			await player.draw(2);
		},
		ai: {
			noe: true,
			reverseEquip: true,
			effect: {
				target(card, player, target, current) {
					if (get.type(card) == "equip" && !get.cardtag(card, "gifts")) {
						return [1, 3];
					}
				},
			},
		},
	},
	jieyin: {
		audio: 2,
		enable: "phaseUse",
		filterCard: true,
		usable: 1,
		selectCard: 2,
		check(card) {
			const player = get.owner(card);
			if (player == null) {
				return 0;
			}
			if (player.countCards("h") > player.hp) {
				return 8 - get.value(card);
			}
			if (player.hp < player.maxHp) {
				return 6 - get.value(card);
			}
			return 4 - get.value(card);
		},
		filterTarget(card, player, target) {
			if (!target.hasSex("male")) {
				return false;
			}
			if (target.hp >= target.maxHp) {
				return false;
			}
			if (target === player) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			await player.recover();
			await event.target.recover();
		},
		ai: {
			order: 5.5,
			result: {
				player(player) {
					if (player.hp < player.maxHp) {
						return 4;
					}
					if (player.countCards("h") > player.hp) {
						return 0;
					}
					return -1;
				},
				target: 4,
			},
			threaten: 2,
		},
	},
	qingnang: {
		audio: 2,
		enable: "phaseUse",
		filterCard: true,
		usable: 1,
		check(card) {
			return 9 - get.value(card);
		},
		filterTarget(card, player, target) {
			if (target.hp >= target.maxHp) {
				return false;
			}
			return true;
		},
		async content(event, trigger, player) {
			await event.target.recover();
		},
		ai: {
			order: 9,
			result: {
				target(player, target) {
					if (target.hp === 1) {
						return 5;
					}
					if (player === target && player.countCards("h") > player.hp) {
						return 5;
					}
					return 2;
				},
			},
			threaten: 2,
		},
	},
	jijiu: {
		mod: {
			aiValue(player, card, num) {
				if (get.name(card) !== "tao" && get.color(card) !== "red") {
					return;
				}
				const cards = player.getCards("hs", card => get.name(card) === "tao" || get.color(card) === "red");
				cards.sort((a, b) => (get.name(a) === "tao" ? 1 : 2) - (get.name(b) === "tao" ? 1 : 2));
				const geti = () => {
					if (cards.includes(card)) {
						cards.indexOf(card);
					}
					return cards.length;
				};
				return Math.max(num, [6.5, 4, 3, 2][Math.min(geti(), 2)]);
			},
			aiUseful(...args) {
				return lib.skill.jijiu.mod?.aiValue?.(...args);
			},
		},
		locked: false,
		audio: 2,
		audioname: ["re_huatuo"],
		audioname2: { old_huatuo: "jijiu_re_huatuo" },
		enable: "chooseToUse",
		viewAsFilter(player) {
			return player !== _status.currentPhase && player.hasCards("hes", { color: "red" });
		},
		filterCard(card) {
			return get.color(card) === "red";
		},
		position: "hes",
		viewAs: { name: "tao" },
		prompt: "将一张红色牌当桃使用",
		check(card) {
			return 15 - get.value(card);
		},
		ai: {
			threaten: 1.5,
		},
	},
	jijiu_re_huatuo: { audio: 2 },
	wushuang: {
		audio: 2,
		audioname: ["re_lvbu", "shen_lvbu", "lvlingqi"],
		audioname2: { sb_lvbu: "sbliyu_effect" },
		forced: true,
		locked: true,
		group: ["wushuang1", "wushuang2"],
		preHidden: ["wushuang1", "wushuang2"],
	},
	wushuang1: {
		audio: "wushuang",
		audioname: ["re_lvbu", "shen_lvbu", "lvlingqi"],
		audioname2: {
			sb_lvbu: "sbliyu_effect",
			gz_lvlingqi: "wushuang_lvlingqi",
		},
		trigger: { player: "useCardToPlayered" },
		forced: true,
		sourceSkill: "wushuang",
		filter(event, player) {
			const parent = event.getParent();
			return event.card.name === "sha" && (parent === undefined || (parent.directHit !== true && !parent.directHit.includes(event.target)));
		},
		//priority:-1,
		logTarget: "target",
		async content(event, trigger, player) {
			const id = trigger.target.playerid;
			const map = trigger.getParent()?.customArgs;
			if (id != null) {
				if (!map[id]) {
					map[id] = {};
				}
				if (typeof map[id].shanRequired == "number") {
					map[id].shanRequired++;
				} else {
					map[id].shanRequired = 2;
				}
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (arg.card.name !== "sha" || arg.target.countCards("h", "shan") > 1) {
					return false;
				}
			},
		},
	},
	wushuang2: {
		audio: "wushuang",
		audioname: ["re_lvbu", "shen_lvbu", "lvlingqi"],
		audioname2: {
			sb_lvbu: "sbliyu_effect",
			gz_lvlingqi: "wushuang_lvlingqi",
		},
		trigger: { player: "useCardToPlayered", target: "useCardToTargeted" },
		forced: true,
		sourceSkill: "wushuang",
		logTarget(trigger, player) {
			return player === trigger.player ? trigger.target : trigger.player;
		},
		filter(event, player) {
			return event.card.name === "juedou";
		},
		//priority:-1,
		async content(event, trigger, player) {
			const id = (player === trigger.player ? trigger.target : trigger.player)["playerid"];
			const idt = trigger.target.playerid;
			const map = trigger.getParent()?.customArgs;
			if (id != null && idt != null) {
				if (!map[idt]) {
					map[idt] = {};
				}
				if (!map[idt].shaReq) {
					map[idt].shaReq = {};
				}
				if (!map[idt].shaReq[id]) {
					map[idt].shaReq[id] = 1;
				}
				map[idt].shaReq[id]++;
			}
		},
		ai: {
			directHit_ai: true,
			skillTagFilter(player, tag, arg) {
				if (arg.card.name !== "juedou" || Math.floor(arg.target.countCards("h", "sha") / 2) > player.countCards("h", "sha")) {
					return false;
				}
			},
		},
	},
	zhanshen: {
		audio: 2,
		trigger: { player: "phaseZhunbeiBegin" },
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "gray",
		filter(event, player) {
			return player.isDamaged() && game.dead.filter(target => target.isFriendOf(player)).length > 0;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const cards = player.getEquips(1);
			if (cards.length) {
				await player.discard({ cards });
			}
			await player.loseMaxHp();
			await player.addSkills(["mashu", "shenji"]);
		},
		derivation: ["mashu", "shenji"],
	},
	shenji: {
		audio: 2,
		mod: {
			selectTarget(card, player, range) {
				if (range[1] === -1) {
					return;
				}
				if (card.name === "sha") {
					range[1] += 2;
				}
			},
			cardUsable(card, player, num) {
				if (card.name === "sha") {
					return num + 1;
				}
			},
		},
	},
	lijian: {
		audio: 2,
		audioname: ["re_diaochan"],
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return game.countPlayer(current => current !== player && current.hasSex("male")) > 1;
		},
		check(card) {
			return 10 - get.value(card);
		},
		filterCard: true,
		position: "he",
		filterTarget(card, player, target) {
			if (player === target) {
				return false;
			}
			if (!target.hasSex("male")) {
				return false;
			}
			if (ui.selected.targets.length === 1) {
				return target.canUse({ name: "juedou" }, ui.selected.targets[0]);
			}
			return true;
		},
		targetprompt: ["先出杀", "后出杀"],
		selectTarget: 2,
		multitarget: true,
		async content(event, trigger, player) {
			const next = event.targets[1]
				.useCard({
					card: get.autoViewAs({ name: "juedou", isCard: true }),
					targets: [event.targets[0]],
					nowuxie: true,
					noai: true,
				})
				.set("animate", false);
			await game.delay(0.5);
			return next;
		},
		ai: {
			order: 8,
			result: {
				target(player, target) {
					if (ui.selected.targets.length === 0) {
						return -3;
					} else {
						return get.effect(target, { name: "juedou" }, ui.selected.targets[0], target);
					}
				},
			},
			expose: 0.4,
			threaten: 3,
		},
	},
	biyue: {
		audio: 2,
		trigger: { player: "phaseJieshuBegin" },
		frequent: true,
		preHidden: true,
		async content(event, trigger, player) {
			player.draw();
		},
	},
	yaowu: {
		trigger: { player: "damageBegin3" },
		audio: 2,
		filter(event, player) {
			return event.card?.name === "sha" && get.color(event.card) === "red" && event.source?.isIn();
		},
		forced: true,
		check() {
			return false;
		},
		async content(event, trigger, player) {
			await trigger.source.chooseDrawRecover({ forced: true });
		},
		ai: {
			neg: true,
			effect: {
				target(card, player, target, current) {
					if (card.name === "sha" && get.color(card) === "red") {
						return [1, -2];
					}
				},
			},
		},
	},
	new_jiangchi: {
		audio: "jiangchi",
		trigger: {
			player: "phaseDrawEnd",
		},
		logAudio: (event, player, name, indexedData, costResult) => (costResult.cost_data.control === "弃牌" ? "jiangchi2.mp3" : "jiangchi1.mp3"),
		async cost(event, trigger, player) {
			const list = ["弃牌", "摸牌", "cancel2"];
			if (!player.hasCards("he")) {
				list.remove("弃牌");
			}
			const { control } = await player
				.chooseControl({
					prompt: get.prompt2(event.skill),
					controls: list,
					ai() {
						const player = _status.event.player;
						if (list.includes("弃牌")) {
							if (player.countCards("h") > 3 && player.countCards("h", "sha") > 1) {
								return "弃牌";
							}
							if (player.countCards("h", "sha") > 2) {
								return "弃牌";
							}
						}
						if (!player.hasCards("h", "sha")) {
							return "摸牌";
						}
						return "cancel2";
					},
				})
				.forResult();
			if (control === "cancel2") {
				event.result = { bool: false };
			} else {
				event.result = {
					bool: true,
					cost_data: { control },
				};
			}
		},
		async content(event, trigger, player) {
			const { control } = event.cost_data;

			if (control === "弃牌") {
				player.addTempSkill("jiangchi2", "phaseUseEnd");
				await player.chooseToDiscard({
					position: "he",
					forced: true,
				});
			} else if (control === "摸牌") {
				player.addTempSkill("new_jiangchi3", "phaseEnd");
				await player.draw();
			}
		},
	},
};
