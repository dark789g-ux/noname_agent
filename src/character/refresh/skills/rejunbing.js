import { lib, game, ui, get, ai, _status } from "noname";

/** @type { importCharacterConfig["skill"] } */
export const rejunbingSkills = {
	rejunbing: {
		audio: 2,
		trigger: { global: "phaseJieshuBegin" },
		filter(event, player) {
			return event.player.countCards("h") < event.player.getHp();
		},
		async cost(event, trigger, player) {
			event.result = await trigger.player
				.chooseBool({
					prompt: player === trigger.player ? get.prompt(event.skill) : `是否响应${get.translation(player)}的【郡兵】？`,
					prompt2: "摸一张牌" + (player === trigger.player ? "" : "，将所有手牌交给" + get.translation(player) + "，然后其可以交给你等量张牌"),
					ai() {
						return get.event().choice;
					},
				})
				.set("choice", get.attitude(trigger.player, player) > 0)
				.forResult();
		},
		async content(event, trigger, player) {
			const target = trigger.player;
			if (target != player) {
				game.log(target, "响应了", player, "的", "#g【郡兵】");
			}
			await target.draw();
			let cards = target.getCards("h");
			if (target == player || !cards.length) {
				return;
			}
			await target.give(cards, player);
			const num = cards.length;
			if (player.countCards("he") >= num) {
				const result = await player
					.chooseCard({
						prompt: "郡兵：是否还给" + get.translation(target) + get.translation(num) + "张牌？",
						selectCard: num,
						position: "he",
						ai(card) {
							const player = _status.event.player;
							const target = get.event().target;
							if (get.attitude(player, target) <= 0) {
								if (card.name === "du") {
									return 114514_1919810;
								}
								return -get.value(card);
							}
							return 8 - Math.sqrt(target.hp) - get.value(card);
						},
					})
					.set("target", target)
					.forResult();
				if (result.bool && result.cards?.length) {
					await player.give(result.cards, target);
				}
			}
		},
	},
	//界诸葛诞
	regongao: {
		audio: 2,
		trigger: { global: "dying" },
		filter(event, player) {
			if (player == event.player) {
				return false;
			}
			return !player.getAllHistory("useSkill", evt => evt.skill == "regongao" && evt.targets[0] == event.player).length;
		},
		forced: true,
		logTarget: "player",
		async content(event, trigger, player) {
			await player.gainMaxHp();
			await player.recover();
		},
	},
	rejuyi: {
		audio: 2,
		derivation: ["benghuai", "reweizhong"],
		trigger: { player: "phaseZhunbeiBegin" },
		filter(event, player) {
			return player.maxHp > game.countPlayer() && player.isDamaged();
		},
		forced: true,
		juexingji: true,
		skillAnimation: true,
		animationColor: "thunder",
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			await player.drawTo(player.maxHp);
			await player.addSkills(["benghuai", "reweizhong"]);
		},
	},
	reweizhong: {
		audio: 1,
		inherit: "weizhong",
		async content(event, trigger, player) {
			await player.draw({
				num: 2,
			});
		},
	},
	benghuai_re_zhugedan: { audio: 1 },
	//堪比界曹冲的界曹叡
	remingjian: {
		inherit: "mingjian",
		async content(event, trigger, player) {
			const { cards, target } = event;
			await player.give(cards, target);
			target.addTempSkill("remingjian_buff", { player: "phaseAfter" });
			if (!target.storage.remingjian_buff) {
				target.storage.remingjian_buff = [];
			}
			target.storage.remingjian_buff.push(player);
			target.markSkill("remingjian_buff");
		},
		derivation: "huituo",
		subSkill: {
			buff: {
				charlotte: true,
				mark: true,
				marktext: "鉴",
				intro: {
					content: (storage, player) => {
						const num = storage.length;
						return `<li>被${get.translation(storage.toUniqued())}鉴识<li>手牌上限+${num}，出杀次数+${num}`;
					},
				},
				onremove: true,
				trigger: { source: "damageSource" },
				filter(event, player) {
					// @ts-ignore
					if (_status.currentPhase !== player) {
						return false;
					}
					return player.getHistory("sourceDamage").indexOf(event) == 0 && player.getStorage("remingjian_buff").some(current => current.isIn());
				},
				forced: true,
				popup: false,
				async content(event, trigger, player) {
					const masters = player
						.getStorage(event.name)
						.filter(current => current.isIn())
						.toUniqued()
						// @ts-ignore
						.sortBySeat(_status.currentPhase);
					while (masters.length) {
						const master = masters.shift();
						if (!master.isIn()) {
							continue;
						}
						const next = game.createEvent("huituo");
						// @ts-ignore
						next.setContent(lib.skill.huituo.content);
						next.player = master;
						next.forced = true;
						next._trigger = trigger;
						await next;
					}
				},
				mod: {
					maxHandcard(player, num) {
						return num + player.getStorage("remingjian_buff").length;
					},
					cardUsable(card, player, num) {
						if (card.name == "sha") {
							return num + player.getStorage("remingjian_buff").length;
						}
					},
				},
			},
		},
	},
	rexingshuai: {
		audio: 2,
		skillAnimation: true,
		animationColor: "thunder",
		trigger: { player: "dying" },
		zhuSkill: true,
		filter(event, player) {
			if (player.hp > 0) {
				return false;
			}
			if (!player.hasZhuSkill("rexingshuai")) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return current != player && current.group == "wei";
			});
		},
		limited: true,
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			const targets = game.filterPlayer();
			targets.sortBySeat(_status.currentPhase);
			targets.remove(player);
			const damages = [];
			player.addSkill("rexingshuai_restore");
			while (targets.length) {
				const current = targets.shift();
				if (current.group == "wei") {
					const result = await current
						.chooseBool("是否令" + get.translation(player) + "回复1点体力？")
						.set("ai", function () {
							return get.attitude(_status.event.player, _status.event.target) > 2;
						})
						.set("target", player)
						.forResult();
					if (result?.bool) {
						damages.push(event.current);
						current.line(player, "green");
						game.log(current, "令", player, "回复1点体力");
						await player.recover(current);
					}
				}
			}
			if (damages.length) {
				const next = game.createEvent("rexingshuai_next");
				event.next.remove(next);
				trigger.after.push(next);
				next.targets = damages;
				next.setContent(function () {
					targets.shift().damage();
					if (targets.length) {
						event.redo();
					}
				});
			}
		},
		subSkill: {
			restore: {
				audio: "rexingshuai",
				trigger: {
					global: "dieAfter",
				},
				charlotte: true,
				forced: true,
				filter(event, player) {
					return event.source && event.source.isIn() && event.source.hasSkill("remingjian_buff");
				},
				async content(event, trigger, player) {
					player.restoreSkill("rexingshuai");
					game.log(player, "重置了", "#g【兴衰】");
				},
			},
		},
	},
	//不想突破可以不突破的界曹冲
	rechengxiang: {
		audio: 2,
		audioname2: { sxrm_caocao: "rechengxiang_sxrm_caocao" },
		inherit: "chengxiang",
		async callback(event, trigger, player) {
			if (
				event.cards2?.length &&
				event.cards2
					.map(card => {
						return get.number(card);
					})
					.reduce((sum, num) => {
						return (sum += num);
					}, 0) == 13
			) {
				await player.link(false);
				await player.turnOver(false);
			}
		},
	},
	//OL界二张
	olzhijian: {
		audio: 2,
		enable: "phaseUse",
		filter(event, player) {
			return player.countCards("he", { type: "equip" }) > 0;
		},
		filterCard(card) {
			return get.type(card) == "equip";
		},
		position: "he",
		check(card) {
			var player = _status.currentPhase;
			if (player.countCards("he", { subtype: get.subtype(card) }) > 1) {
				return 11 - get.equipValue(card);
			}
			return 6 - get.value(card);
		},
		filterTarget(card, player, target) {
			if (target.isMin()) {
				return false;
			}
			return player != target && target.canEquip(card, true);
		},
		async content(event, trigger, player) {
			await event.target.equip(event.cards[0]);
			await player.draw();
		},
		discard: false,
		lose: false,
		prepare(cards, player, targets) {
			player.$give(cards, targets[0], false);
		},
		ai: {
			basic: {
				order: 10,
			},
			result: {
				target(player, target) {
					var card = ui.selected.cards[0];
					if (card) {
						return get.effect(target, card, target, target);
					}
					return 0;
				},
			},
			threaten: 1.35,
		},
	},
	olguzheng: {
		audio: 2,
		trigger: {
			global: ["loseAfter", "loseAsyncAfter"],
		},
		filter(event, player) {
			if (event.type != "discard") {
				return false;
			}
			if (player.hasSkill("olguzheng_used")) {
				return false;
			}
			var phaseName;
			for (var name of lib.phaseName) {
				var evt = event.getParent(name);
				if (!evt || evt.name != name) {
					continue;
				}
				phaseName = name;
				break;
			}
			if (!phaseName) {
				return false;
			}
			return game.hasPlayer(current => {
				if (current == player) {
					return false;
				}
				var evt = event.getl(current);
				if (!evt || !evt.cards2 || evt.cards2.filterInD("d").length < 2) {
					return false;
				}
				return true;
			});
		},
		checkx(event, player, cards) {
			if (cards.length > 2 || get.attitude(player, event.player) > 0) {
				return true;
			}
			for (var i = 0; i < cards.length; i++) {
				if (get.value(cards[i], event.player, "raw") < 0) {
					return true;
				}
			}
			return false;
		},
		direct: true,
		preHidden: true,
		async content(event, trigger, player) {
			const targets = [],
				cardsList = [],
				players = game.filterPlayer().sortBySeat(_status.currentPhase);
			for (const current of players) {
				if (current == player) {
					continue;
				}
				const cards = [];
				const evt = trigger.getl(current);
				if (!evt || !evt.cards2) {
					continue;
				}
				const cardsx = evt.cards2.filterInD("d");
				cards.addArray(cardsx);
				if (cards.length) {
					targets.push(current);
					cardsList.push(cards);
				}
			}
			while (targets.length) {
				const target = targets.shift();
				let cards = cardsList.shift();
				const result = await player
					.chooseButton(2, [get.prompt("olguzheng", target), '<span class="text center">被选择的牌将成为对方收回的牌</span>', cards, [["获得剩余的牌", "放弃剩余的牌"], "tdnodes"]])
					.set("filterButton", function (button) {
						const type = typeof button.link;
						if (ui.selected.buttons.length && type == typeof ui.selected.buttons[0].link) {
							return false;
						}
						return true;
					})
					.set("check", lib.skill.olguzheng.checkx(trigger, player, cards))
					.set("ai", function (button) {
						if (typeof button.link == "string") {
							return button.link == "获得剩余的牌" ? 1 : 0;
						}
						if (_status.event.check) {
							return 20 - get.value(button.link, _status.event.getTrigger().player);
						}
						return 0;
					})
					.setHiddenSkill("olguzheng")
					.forResult();
				if (result?.links) {
					player.logSkill("olguzheng", target);
					const links = result.links;
					player.addTempSkill("olguzheng_used", ["phaseZhunbeiAfter", "phaseDrawAfter", "phaseJudgeAfter", "phaseUseAfter", "phaseDiscardAfter", "phaseJieshuAfter"]);
					if (typeof links[0] != "string") {
						links.reverse();
					}
					const card = links[1];
					await target.gain(card, "gain2");
					cards.remove(card);
					cards = cards.filterInD("d");
					if (cards.length > 0 && links[0] == "获得剩余的牌") {
						await player.gain(cards, "gain2");
					}
					break;
				}
			}
		},
		ai: {
			threaten: 1.3,
			expose: 0.2,
		},
		subSkill: {
			used: {
				charlotte: true,
			},
		},
	},
	//SP黄月英
	rejiqiao: {
		audio: 2,
		trigger: { player: "phaseUseBegin" },
		filter(event, player) {
			return player.countCards("he") > 0;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseToDiscard(get.prompt2("rejiqiao"), [1, player.countCards("he")], "he", "chooseonly", "allowChooseAll")
				.set("ai", function (card) {
					if (card.name == "bagua") {
						return 10;
					}
					return 7 - get.value(card);
				})
				.forResult();
		},
		async content(event, trigger, player) {
			const { cards } = event;
			await player.modedDiscard(cards);
			const num = cards.length + cards.filter(card => get.type(card) == "equip").length;
			const showCards = get.cards(num);
			await game.cardsGotoOrdering(showCards);
			await player.showCards(showCards);
			await player.gain(
				showCards.filter(card => get.type(card) != "equip"),
				"gain2"
			);
		},
		ai: {
			threaten: 1.6,
		},
	},
};
