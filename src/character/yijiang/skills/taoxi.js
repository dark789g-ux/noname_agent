import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "taoxi" | "xingshuai" | "mingjian" | "mingjian2" | "mingjian_old" | "mingjian2_old">} */
export const groupSkills = {
	taoxi: {
		audio: "qingxi",
		trigger: { player: "useCardToPlayered" },
		check(event, player) {
			if (get.attitude(player, event.target) >= 0) {
				return false;
			}
			var cards = event.target.getCards("h");
			if (cards.filter(card => player.hasUseTarget(card)).length >= cards.length / 2) {
				return true;
			}
			return false;
		},
		filter(event, player) {
			return player.isPhaseUsing() && event.targets.length == 1 && event.target.countCards("h") > 0 && player != event.target && !player.hasSkill("taoxi_used");
		},
		logTarget: "target",
		async content(event, trigger, player) {
			const result = await player
				.choosePlayerCard({
					target: trigger.target,
					position: "h",
					forced: true,
				})
				.forResult();
			if (result.bool && result.links?.length) {
				const card = result.links[0];
				await player.showCards(card, get.translation(player) + "对" + get.translation(trigger.target) + "发动了【讨袭】");
				if (!player.storage.taoxi_list) {
					player.storage.taoxi_list = [[], []];
				}
				if (!player.storage.taoxi_list[1].some(i => i._cardid == card.cardid)) {
					const cardx = ui.create.card();
					cardx.init(get.cardInfo(card));
					cardx._cardid = card.cardid;
					player.directgains([cardx], null, "taoxi");
					player.storage.taoxi_list[0].push(trigger.target);
					player.storage.taoxi_list[1].push(cardx);
					player.markSkill("taoxi_list");
					player.addTempSkill("taoxi_list");
					player.addTempSkill("taoxi_use");
					player.addTempSkill("taoxi_used", "phaseUseAfter");
				}
			}
		},
		subSkill: {
			used: {},
			use: {
				trigger: { player: "useCardBefore" },
				charlotte: true,
				forced: true,
				popup: false,
				firstDo: true,
				group: "taoxi_lose",
				filter(event, player) {
					if (!player.storage.taoxi_list || !player.storage.taoxi_list.length) {
						return false;
					}
					var list = player.storage.taoxi_list[1];
					return (
						event.cards &&
						event.cards.some(card => {
							return list.includes(card);
						})
					);
				},
				async content(event, trigger, player) {
					const cards = [];
					const list = player.storage.taoxi_list;
					for (const card of trigger.cards) {
						let bool = false;
						for (const [i, owner] of list[0].entries()) {
							if (list[1][i] == card) {
								const cardid = card._cardid;
								const cardx = owner.getCards("h", cardxx => cardxx.cardid == cardid)[0];
								if (cardx && get.position(cardx) == "h") {
									cards.push(cardx);
									owner.$throw(cardx);
									bool = true;
									break;
								}
							}
						}
						if (!bool) {
							cards.push(card);
						}
					}
					trigger.cards = cards;
					trigger.card.cards = cards;
					trigger.throw = false;
				},
				mod: {
					aiOrder(player, card, num) {
						var list = player.storage.taoxi_list;
						if (!list || !list[1]) {
							return;
						}
						if (list[1].includes(card)) {
							return num + 0.5;
						}
					},
					cardEnabled2(card) {
						if (get.itemtype(card) == "card" && card.hasGaintag("taoxi") && _status.event.name == "chooseToRespond") {
							return false;
						}
					},
				},
				ai: {
					effect: {
						player_use(card, player, target) {
							var list = player.storage.taoxi_list;
							if (!list || !list[1]) {
								return;
							}
							if (list[1].includes(card)) {
								return [1, 1];
							}
						},
					},
				},
			},
			lose: {
				trigger: {
					global: ["loseEnd", "equipEnd", "addJudgeEnd", "gainEnd", "loseAsyncEnd", "addToExpansionEnd"],
				},
				charlotte: true,
				forced: true,
				popup: false,
				firstDo: true,
				filter(event, player) {
					var list = player.storage.taoxi_list;
					if (!list || !list[0].length) {
						return false;
					}
					return game.hasPlayer(function (current) {
						if (!list[0].includes(current)) {
							return;
						}
						var evt = event.getl(current);
						if (
							evt &&
							evt.hs &&
							evt.hs.some(card => {
								return list[1].some(i => i._cardid == card.cardid);
							})
						) {
							return true;
						}
						return false;
					});
				},
				async content(event, trigger, player) {
					const list = player.storage.taoxi_list;
					const targets = game.filterPlayer(function (current) {
						if (!list[0].includes(current)) {
							return;
						}
						const evt = trigger.getl(current);
						if (
							evt &&
							evt.hs &&
							evt.hs.some(card => {
								return list[1].some(i => i._cardid == card.cardid);
							})
						) {
							return true;
						}
						return false;
					});
					for (const target of targets) {
						const hs = trigger.getl(target).hs;
						for (let i = 0; i < list[0].length; i++) {
							if (hs.some(j => j.cardid == list[1][i]._cardid)) {
								if (player.isOnline2()) {
									player.send(
										function (list, i) {
											game.me.storage.taoxi_list = list;
											list[1][i].delete();
											list[0].splice(i, 1);
											list[1].splice(i, 1);
										},
										player.storage.taoxi_list,
										i
									);
								}
								list[1][i].delete();
								list[0].splice(i, 1);
								list[1].splice(i, 1);
								i--;
							}
						}
					}
				},
			},
			list: {
				audio: "qingxi",
				trigger: { player: "phaseEnd" },
				charlotte: true,
				forced: true,
				onremove(player) {
					game.broadcastAll(function (player) {
						player.storage.taoxi_list[1].forEach(i => i.delete());
						delete player.storage.taoxi_list;
					}, player);
				},
				filter(event, player) {
					return player.storage.taoxi_list && player.storage.taoxi_list[0].length > 0;
				},
				async content(event, trigger, player) {
					player.loseHp();
				},
			},
		},
	},
	xingshuai: {
		skillAnimation: true,
		animationColor: "thunder",
		audio: 2,
		audioname2: {
			re_caorui: "rexingshuai",
		},
		trigger: { player: "dying" },
		zhuSkill: true,
		filter(event, player) {
			if (player.hp > 0) {
				return false;
			}
			if (!player.hasZhuSkill("xingshuai")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return current != player && current.group == "wei";
			});
		},
		limited: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const phaseTargets = game.filterPlayer(current => current !== player && current.group === "wei");
			const damages = [];
			for (const current of phaseTargets) {
				if (current.group != "wei") {
					continue;
				}
				const result = await current
					.chooseBool({
						prompt: `是否令${get.translation(player)}回复1点体力？`,
						ai() {
							const { player, target } = get.event();
							return get.attitude(player, target) > 2;
						},
					})
					.set("target", player)
					.forResult();

				if (result.bool) {
					damages.push(current);
					current.line(player, "green");
					game.log(current, "令", player, "回复1点体力");
					await player.recover({ source: current });
				}
			}
			if (damages.length) {
				const next = game.createEvent("xingshuai_next");
				event.next.remove(next);
				trigger.after.push(next);
				next.targets = damages;
				next.setContent(async event => {
					for (const target of event.targets) {
						await target.damage();
					}
				});
			}
		},
	},
	mingjian: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return player != target;
		},
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterCard: true,
		selectCard: -1,
		discard: false,
		lose: false,
		delay: false,
		async content(event, trigger, player) {
			const { cards, target } = event;
			player.give(cards, target);
			target.addTempSkill("mingjian2", { player: "phaseAfter" });
			target.storage.mingjian2++;
			target.updateMarks("mingjian2");
		},
		ai: {
			order: 1,
			result: {
				target(player, target) {
					if (target.hasSkillTag("nogain")) {
						return 0;
					}
					if (player.countCards("h") == player.countCards("h", "du")) {
						return -1;
					}
					if (target.hasJudge("lebu")) {
						return 0;
					}
					if (get.attitude(player, target) > 3) {
						var basis = get.threaten(target);
						if (
							player == get.zhu(player) &&
							player.hp <= 2 &&
							player.countCards("h", "shan") &&
							!game.hasPlayer(function (current) {
								return get.attitude(current, player) > 3 && current.countCards("h", "tao") > 0;
							})
						) {
							return 0;
						}
						if (target.countCards("h") + player.countCards("h") > target.hp + 2) {
							return basis * 0.8;
						}
						return basis;
					}
					return 0;
				},
			},
		},
	},
	mingjian2: {
		charlotte: true,
		mark: true,
		intro: {
			content: "手牌上限+#，出杀次数+#",
		},
		init(player, skill) {
			if (!player.storage[skill]) {
				player.storage[skill] = 0;
			}
		},
		onremove: true,
		mod: {
			maxHandcard(player, num) {
				return num + player.storage.mingjian2;
			},
			cardUsable(card, player, num) {
				if (card.name == "sha") {
					return num + player.storage.mingjian2;
				}
			},
		},
	},
	mingjian_old: {
		audio: 2,
		trigger: { player: "phaseUseBefore" },
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		async cost(event, trigger, player) {
			const go = Math.random() < 0.5;
			event.result = await player
				.chooseTarget({
					prompt: get.prompt2("mingjian_old"),
					filterTarget(card, player, target) {
						return player !== target;
					},
					ai(target) {
						const att = get.attitude(player, target);
						if (att > 3) {
							if (player.countCards("h") > player.hp) {
								return att;
							}
							if (go) {
								return att;
							}
						}
						return 0;
					},
				})
				.forResult();
		},
		async content(event, trigger, player) {
			trigger.cancel();
			const target = event.targets[0];
			target.addSkill("mingjian2_old");
			const hs = player.getCards("h");
			await player.give(hs, target);
		},
	},
	mingjian2_old: {
		audio: false,
		trigger: { global: "phaseAfter" },
		forced: true,
		popup: false,
		charlotte: true,
		sourceSkill: "mingjian_old",
		async content(event, trigger, player) {
			if (lib.config.glow_phase) {
				if (_status.currentPhase) {
					_status.currentPhase.classList.remove("glow_phase");
				}
				player.classList.add("glow_phase");
			}
			game.addVideo("phaseChange", player);
			_status.currentPhase = player;
			player.ai.tempIgnore = [];
			player.stat.push({ card: {}, skill: {} });
			player.phaseUse();
			player.removeSkill("mingjian2_old");
		},
	},
};
