import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "stdxiongxia" | "stdhuiji" | "stdmingfa" | "stdrenzheng" | "stdjinjian" | "stdxiongsuan" | "stdchunlao" | "stdquedi">} */
export const groupSkills = {
	//周处
	stdxiongxia: {
		audio: "xianghai",
		enable: "chooseToUse",
		filterCard: true,
		selectCard: 2,
		position: "hes",
		viewAs: { name: "juedou" },
		selectTarget: 2,
		viewAsFilter(player) {
			if (player.countCards("hes") < 2) {
				return false;
			}
		},
		check(card) {
			if (get.name(card) == "sha") {
				return 4 - get.value(card);
			}
			return 7.5 - get.value(card);
		},
		onuse(links, player) {
			player.addTempSkill("stdxiongxia_effect");
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: { player: "useCardAfter" },
				filter(event, player) {
					return (
						event.skill == "stdxiongxia" &&
						(event.targets || []).every(target => {
							return target.getHistory("damage", evt => {
								return evt.card && evt.card == event.card;
							}).length;
						})
					);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.tempBanSkill("stdxiongxia");
				},
			},
		},
	},
	//吕玲绮
	stdhuiji: {
		audio: "guowu",
		trigger: { player: "useCard2" },
		filter(event, player) {
			if (event.card.name != "sha") {
				return false;
			}
			return game.hasPlayer(target => {
				return (
					!event.targets.includes(target) &&
					lib.filter.targetEnabled2(event.card, player, target) &&
					lib.filter.targetInRange(event.card, player, target)
				);
			});
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(
					get.prompt2(event.skill),
					(card, player, target) => {
						const event = get.event().getTrigger();
						return (
							!event.targets.includes(target) &&
							lib.filter.targetEnabled2(event.card, player, target) &&
							lib.filter.targetInRange(event.card, player, target)
						);
					},
					[1, 2]
				)
				.set("ai", target => {
					const player = get.event().player,
						event = get.event().getTrigger();
					return get.effect(target, event.card, player);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.targets.addArray(event.targets);
			player.addTempSkill("stdhuiji_effect");
			trigger.card.stdhuiji = true;
		},
		subSkill: {
			effect: {
				charlotte: true,
				trigger: { global: "chooseToUseBegin" },
				filter(event, player) {
					if (event._stdhuiji_effect) {
						return false;
					}
					const evt = event.getParent(2);
					return evt.card?.stdhuiji;
				},
				forced: true,
				popup: false,
				forceDie: true,
				async content(event, trigger, player) {
					trigger._stdhuiji_effect = true;
					const targets = trigger
						.getParent(2)
						.targets.filter(i => {
							return i != trigger.player;
						})
						.sortBySeat();
					if (targets.length) {
						for (const target of targets) {
							if (!target.isIn()) {
								continue;
							}
							const next = target.chooseToUse("挥战：是否替" + get.translation(trigger.player) + "使用一张【闪】？", function (card) {
								if (get.name(card) != "shan") {
									return false;
								}
								return lib.filter.filterCard.apply(this, arguments);
							});
							next.set("ai", () => {
								const event = _status.event;
								return get.attitude(event.player, event.source) - 2;
							});
							next.set("skillwarn", "替" + get.translation(player) + "使用一张闪");
							next.autochoose = lib.filter.autoRespondShan;
							next.set("source", player);
							const result = await next.forResult();
							if (result.bool) {
								trigger.result = {
									bool: true,
									card: { name: "shan", isCard: true, cards: result.cards.slice() },
									cards: result.cards.slice(),
								};
								trigger.responded = true;
								trigger.animate = false;
								break;
							}
						}
					}
				},
			},
		},
	},
	//羊祜
	stdmingfa: {
		audio: "dcmingfa",
		enable: "phaseUse",
		filter(event, player) {
			return game.hasPlayer(target => target.getHp() > 1);
		},
		filterTarget(card, player, target) {
			return target.getHp() > 1;
		},
		async content(event, trigger, player) {
			const target = event.target;
			await target.damage();
			if (target.isIn()) {
				player.tempBanSkill("stdmingfa", "forever");
				player.addSkill("stdmingfa_used");
				player.markAuto("stdmingfa_used", [target]);
			}
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
				trigger: { global: ["dieAfter", "recoverAfter"] },
				filter(event, player) {
					return player.getStorage("stdmingfa_used").includes(event.player);
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					player.storage.temp_ban_stdmingfa?.delete?.(); // optional cleanup if needed
					delete player.storage[`temp_ban_stdmingfa`];
					player.popup("明伐");
					game.log(player, "恢复了技能", "#g【明伐】");
					player.removeSkill("stdmingfa_used");
				},
			},
		},
		ai: {
			order: 10,
			result: {
				target(player, target) {
					return get.sgn(get.attitude(player, target)) * get.damageEffect(target, player, player);
				},
			},
		},
	},
	//骆统
	stdrenzheng: {
		audio: "renzheng",
		trigger: { global: ["damageCancelled", "damageZero"] },
		filter(event, player, name) {
			if (!_status.currentPhase?.isIn()) {
				return false;
			}
			if (name == "damageCancelled") {
				return true;
			}
			return event.change_history.some(i => i < 0);
		},
		forced: true,
		logTarget: () => _status.currentPhase,
		async content(event, trigger, player) {
			_status.currentPhase.draw();
		},
	},
	stdjinjian: {
		audio: "jinjian",
		trigger: {
			source: "damageBegin2",
			player: "damageBegin4",
		},
		filter(event, player, name) {
			return !player.getStorage("stdjinjian_used").includes(name.slice(11));
			// return !player.hasSkill(`stdjinjian_effect${name.slice(11)}`);
		},
		prompt2(event, player, name) {
			return `防止即将${name == "damageBegin2" ? "造成" : "受到"}的伤害`;
		},
		check(event, player) {
			return get.damageEffect(event.player, event.source, player) < 0;
		},
		async content(event, trigger, player) {
			trigger.cancel();
			player.addTempSkill("stdjinjian_used");
			player.markAuto("stdjinjian_used", event.triggername.slice(11));
			player.addTempSkill(`stdjinjian_effect${event.triggername.slice(11)}`);
			player.addMark(`stdjinjian_effect${event.triggername.slice(11)}`, 1, false);
		},
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
			effect2: {
				trigger: { source: "damageBegin1" },
				forced: true,
				charlotte: true,
				onremove: true,
				async content(event, trigger, player) {
					const num = player.countMark(event.name);
					trigger.num += num;
					player.removeMark(event.name, num, false);
				},
				marktext: "进",
				intro: {
					content: "下次造成的伤害+$",
				},
			},
			effect4: {
				trigger: { player: "damageBegin3" },
				forced: true,
				charlotte: true,
				onremove: true,
				async content(event, trigger, player) {
					const num = player.countMark(event.name);
					trigger.num += num;
					player.removeMark(event.name, num, false);
				},
				marktext: "谏",
				intro: {
					content: "下次受到的伤害+$",
				},
			},
		},
		ai: {
			maixie_defend: true,
			threaten: 0.9,
			effect: {
				target(card, player, target) {
					if (player.hasSkillTag("jueqing", false, target)) {
						return;
					}
					if (player._stdjinjian_tmp) {
						return;
					}
					if (_status.event.getParent("useCard", true) || _status.event.getParent("_wuxie", true)) {
						return;
					}
					if (get.tag(card, "damage")) {
						if (target.hasSkill("stdjinjian_effect4")) {
							return [1, -2];
						} else if (!target.getStorage("stdjinjian_used").includes("4")) {
							if (get.attitude(player, target) > 0) {
								return [0, 0.2];
							}
							if (get.attitude(player, target) < 0) {
								var sha = player.getCardUsable({ name: "sha" });
								player._stdjinjian_tmp = true;
								var num = player.countCards("h", function (card) {
									if (card.name == "sha") {
										if (sha == 0) {
											return false;
										} else {
											sha--;
										}
									}
									return get.tag(card, "damage") && player.canUse(card, target) && get.effect(target, card, player, player) > 0;
								});
								delete player._stdjinjian_tmp;
								if (player.hasSkillTag("damage")) {
									num++;
								}
								if (num < 2) {
									return [0, 0.8];
								}
							}
						}
					}
				},
			},
		},
	},
	//李傕
	stdxiongsuan: {
		audio: "xinfu_langxi",
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.isMaxHp();
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(
					"请选择【凶算】的目标",
					lib.translate.stdxiongsuan_info,
					(card, player, target) => {
						return target.getHp() == player.getHp();
					},
					[1, Infinity],
					true
				)
				.set("ai", target => {
					const player = get.event().player;
					return get.damageEffect(target, player, player);
				})
				.forResult();
		},
		locked: true,
		async content(event, trigger, player) {
			for (const i of event.targets) {
				await i.damage();
			}
		},
		ai: {
			effect: {
				target(card, player, target) {
					if (target.hp <= 1 || !target.hasFriend() || !_status.currentPhase || !get.tag(card, "damage")) {
						return;
					}
					let hp = target.hp - 1;
					if (
						game.hasPlayer(cur => {
							return cur.hp > hp;
						})
					) {
						return;
					}
					let ori = game.countPlayer(cur => {
							return cur.hp === hp + 1 && get.attitude(target, cur) <= 0;
						}),
						now = game.countPlayer(cur => {
							return cur.hp === hp && get.attitude(target, cur) <= 0;
						}),
						seat = 1,
						tar = _status.currentPhase.next;
					while (tar !== target) {
						if (get.attitude(target, tar) <= 0) {
							seat++;
						}
						tar = tar.next;
					}
					return [1, (2 * (now - ori)) / seat];
				},
			},
		},
	},
	//程普
	stdchunlao: {
		audio: "chunlao",
		trigger: { player: "phaseDiscardEnd" },
		filter(event, player) {
			return (event.cards || []).length >= 2 && game.hasPlayer(target => target != player);
		},
		async cost(event, trigger, player) {
			const cards = trigger.cards;
			event.result = await player
				.chooseTarget(get.prompt(event.skill), "用" + get.translation(cards) + "交换一名其他角色的手牌", (card, player, target) => target != player)
				.set("ai", target => {
					const { cards, player } = get.event();
					const att = get.attitude(player, target);
					return (cards.length - target.countCards("h") + 0.1) * att;
				})
				.set("cards", cards)
				.forResult();
		},
		async content(event, trigger, player) {
			const cards = trigger.cards,
				target = event.targets[0];
			await target.loseToDiscardpile(target.getCards("h"));
			await target.gain(cards, "gain2").set("giver", player);
			if (player.isDamaged()) {
				const { bool } = await target
					.chooseBool("是否令" + get.translation(player) + "回复1点体力？")
					.set("choice", get.recoverEffect(player, target, target) > 0)
					.forResult();
				if (bool) {
					target.line(player);
					await player.recover(target);
				}
			}
		},
	},
	//文鸯
	stdquedi: {
		audio: "dbquedi",
		enable: "chooseToUse",
		filterCard: { name: "sha" },
		position: "hes",
		viewAs: { name: "juedou" },
		viewAsFilter(player) {
			if (!player.countCards("hes", { name: "sha" })) {
				return false;
			}
		},
		check(card) {
			return 6 - get.value(card);
		},
	},
};
