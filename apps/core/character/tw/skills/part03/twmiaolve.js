import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "twmiaolve" | "twyingjia" | "gx_lingbaoxianhu" | "gx_taijifuchen" | "gx_chongyingshenfu">} */
export const groupSkills = {
	twmiaolve: {
		audio: 2,
		trigger: {
			global: "phaseBefore",
			player: ["enterGame", "damageEnd"],
		},
		filter(event, player) {
			if (event.name == "damage") {
				return event.num > 0;
			}
			return event.name != "phase" || game.phaseNumber == 0;
		},
		getIndex(event, player) {
			return event.num || 1;
		},
		async cost(event, trigger, player) {
			if (trigger.name == "damage") {
				const list = ["dz_mantianguohai"];
				list.addArray(get.zhinangs());
				const result = await player
					.chooseButton([get.prompt(event.skill), [list, "vcard"]])
					.set("ai", button => {
						const player = get.player();
						if (button.link[2] == "dz_mantianguohai" && player.countCards("hs", "dz_mantianguohai") < 2) {
							return 10;
						}
						return get.value({ name: button.link[2] });
					})
					.forResult();
				event.result = {
					bool: result?.bool,
					cost_data: result?.links,
				};
			} else {
				event.result = { bool: true };
			}
		},
		async content(event, trigger, player) {
			if (trigger.name == "damage") {
				const name = event.cost_data[0][2];
				if (name == "dz_mantianguohai") {
					if (!lib.inpile.includes("dz_mantianguohai")) {
						lib.inpile.add("dz_mantianguohai");
					}
					if (!_status.dz_mantianguohai_suits) {
						_status.dz_mantianguohai_suits = lib.suit.slice(0);
					}
					if (_status.dz_mantianguohai_suits.length) {
						await player.gain(game.createCard2("dz_mantianguohai", _status.dz_mantianguohai_suits.randomRemove(), 5), "gain2");
					} else {
						const card = get.cardPile(card => card.name == name);
						if (card) {
							await player.gain(card, "gain2");
						}
					}
					await player.draw();
				} else {
					const card = get.cardPile(card => card.name == name);
					if (card) {
						await player.gain(card, "gain2");
					}
				}
			} else {
				if (!lib.inpile.includes("dz_mantianguohai")) {
					lib.inpile.add("dz_mantianguohai");
				}
				if (!_status.dz_mantianguohai_suits) {
					_status.dz_mantianguohai_suits = lib.suit.slice(0);
				}
				const list = _status.dz_mantianguohai_suits.randomRemove(2).map(i => game.createCard2("dz_mantianguohai", i, 5));
				if (list.length) {
					await player.gain(list, "gain2", "log");
				}
			}
		},
	},
	twyingjia: {
		audio: 2,
		trigger: { global: "phaseEnd" },
		filter(event, player) {
			if (
				!player.countCards("h", card => {
					if (_status.connectMode) {
						return true;
					}
					return lib.filter.cardDiscardable(card, player);
				})
			) {
				return false;
			}
			let bool = false;
			const history = player.getHistory("useCard"),
				map = {};
			for (const evt of history) {
				if (get.type2(evt.card) == "trick") {
					if (!map[evt.card.name]) {
						map[evt.card.name] = true;
					} else {
						bool = true;
						break;
					}
				}
			}
			return bool;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseCardTarget({
					prompt: get.prompt(event.skill),
					prompt2: "弃置一张手牌并令一名角色进行一个额外回合",
					filterCard: lib.filter.cardDiscardable,
					filterTarget: true,
					ai1(card) {
						return 8 - get.value(card);
					},
					ai2(target) {
						if (target.hasJudge("lebu")) {
							return -1;
						}
						const player = get.player();
						if (get.attitude(player, target) > 4) {
							return get.threaten(target) / Math.sqrt(target.hp + 1) / Math.sqrt(target.countCards("h") + 1);
						}
						return -1;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const {
				targets: [target],
				cards,
			} = event;
			await player.discard(cards);
			target.insertPhase();
		},
	},
	//tw葛玄
	gx_lingbaoxianhu: {
		trigger: {
			source: "damageSource",
			global: "dieAfter",
		},
		forced: true,
		equipSkill: true,
		filter(event, player) {
			if (event.name == "damage") {
				return event.num > 1;
			}
			return true;
		},
		content() {
			player.gainMaxHp();
			player.recover();
		},
	},
	gx_taijifuchen: {
		trigger: { player: "useCardToPlayered" },
		forced: true,
		equipSkill: true,
		filter(event, player) {
			return event.card?.name == "sha";
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const { card, target } = trigger;
			const suit = get.suit(card);
			const num = target.countCards("h", "shan");
			const next = target
				.chooseToDiscard(`弃置一张牌，或不能响应${get.translation(card)}`, "he")
				.set("ai", card => {
					const { num, suit } = get.event();
					if (num == 0) {
						return 0;
					}
					if (card.name == "shan") {
						return num > 1 ? 2 : 0;
					}
					return (get.suit(card) != suit ? 9 : 6) - get.value(card);
				})
				.set("num", num);
			if (lib.suit.includes(suit)) {
				next.set("prompt2", `若弃置的是${get.translation(suit)}牌，则改为${get.translation(player)}获得之`);
				next.set("suit", suit);
			}
			const result = await next.forResult();
			if (result?.bool && result?.cards?.length) {
				const [cardx] = result.cards;
				if (get.suit(cardx, target) == get.suit(card, false) && get.position(cardx) == "d") {
					await player.gain(cardx, "gain2");
				}
			} else {
				trigger.directHit.add(target);
			}
		},
	},
	gx_chongyingshenfu: {
		trigger: { player: "damageEnd" },
		forced: true,
		equipSkill: true,
		filter(event, player) {
			if (!event.card?.name || player.getStorage("gx_chongyingshenfu_effect").includes(event.card.name)) {
				return false;
			}
			if (player.hasSkillTag("unequip2")) {
				return false;
			}
			if (
				event.source?.hasSkillTag("unequip", false, {
					name: event.card.name,
					target: player,
					card: event.card,
				})
			) {
				return false;
			}
			return true;
		},
		content() {
			player.markAuto("gx_chongyingshenfu_effect", [trigger.card.name]);
		},
		group: "gx_chongyingshenfu_effect",
		subSkill: {
			effect: {
				trigger: { player: "damageBegin4" },
				forced: true,
				equipSkill: true,
				filter(event, player) {
					if (!event.card?.name || !player.getStorage("gx_chongyingshenfu_effect").includes(event.card.name)) {
						return false;
					}
					if (player.hasSkillTag("unequip2")) {
						return false;
					}
					if (
						event.source?.hasSkillTag("unequip", false, {
							name: event.card.name,
							target: player,
							card: event.card,
						})
					) {
						return false;
					}
					return true;
				},
				content() {
					trigger.num--;
				},
				ai: {
					effect: {
						target(card, player, target) {
							if (
								typeof card == "object" &&
								target.getStorage("gx_chongyingshenfu_effect").includes(card.name) &&
								!target.hasSkillTag("unequip2") &&
								(get.itemtype(player) !== "player" ||
									(!player.hasSkillTag("jueqing", false, target) &&
										!player.hasSkillTag("unequip", false, {
											name: card.name,
											target: target,
											card: card,
										})))
							) {
								if (
									player?.hasSkillTag("damageBonus", true, {
										target: target,
										card: card,
									})
								) {
									return 0.5;
								}
								return "zeroplayertarget";
							}
						},
					},
				},
				onremove: true,
				intro: { content: "受到$造成的伤害-1" },
			},
		},
	},
};
