import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "yanzhu" | "shizhi" | "wurong" | "zhanjue" | "zhanjue2" | "zhanjue3">} */
export const groupSkills = {
	yanzhu: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filterTarget(card, player, target) {
			return target.countCards("he") > 0 && target != player;
		},
		async content(event, trigger, player) {
			const { target } = event;
			let result;
			if (target.countCards("e")) {
				result = await target
					.chooseBool({
						prompt: "是否将装备区内的所有牌交给" + get.translation(player) + "？",
						ai() {
							if (_status.event.player.countCards("e") >= 3) {
								return false;
							}
							return true;
						},
					})
					.forResult();
			} else {
				await target.chooseToDiscard({
					position: "he",
					forced: true,
				});
				return;
			}
			if (result.bool) {
				const es = target.getCards("e");
				await target.give(es, player, true);
				player.removeSkills("yanzhu");
			} else {
				await target.chooseToDiscard({
					position: "he",
					forced: true,
				});
			}
		},
		ai: {
			order: 6,
			result: {
				target(player, target) {
					var ne = target.countCards("e");
					if (!ne) {
						return -2;
					}
					if (ne >= 2) {
						return -ne;
					}
					return 0;
				},
			},
		},
	},
	shizhi: {
		mod: {
			cardname(card, player, name) {
				if (card.name == "shan" && player.hp == 1) {
					return "sha";
				}
			},
		},
		ai: {
			skillTagFilter(player) {
				if (!player.countCards("h", "shan")) {
					return false;
				}
				if (player.hp != 1) {
					return false;
				}
			},
			respondSha: true,
			neg: true,
		},
		audio: 2,
		trigger: { player: ["useCard1", "respond"] },
		firstDo: true,
		forced: true,
		filter(event, player) {
			return event.card.name == "sha" && !event.skill && event.cards.length == 1 && event.cards[0].name == "shan";
		},
		async content(event, trigger, player) {},
	},
	wurong: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			return player.countCards("h") > 0;
		},
		filterTarget(card, player, target) {
			return target.countCards("h") > 0 && target != player;
		},
		async content(event, trigger, player) {
			const { target } = event;
			if (target.countCards("h") == 0 || player.countCards("h") == 0) {
				return;
			}

			const sendback = () => {
				if (_status.event !== event) {
					return () => {
						event.resultOL = _status.event.resultOL;
					};
				}
			};
			if (player.isOnline()) {
				player.wait(sendback);
				event.ol = true;
				player.send(() => {
					game.me
						.chooseCard(true)
						.set("glow_result", true)
						.set("ai", () => Math.random());
					game.resume();
				});
			} else {
				event.localPlayer = true;
				const result = await player
					.chooseCard(true)
					.set("glow_result", true)
					.set("ai", () => Math.random())
					.forResult();
				event.card1 = result.cards[0];
			}
			if (target.isOnline()) {
				target.wait(sendback);
				event.ol = true;
				target.send(() => {
					const rand = Math.random() < 0.4;
					game.me
						.chooseCard(true)
						.set("glow_result", true)
						.set("ai", card => {
							if (rand) {
								return card.name == "shan" ? 1 : 0;
							}
							return card.name == "shan" ? 0 : 1;
						});
					game.resume();
				});
			} else {
				event.localTarget = true;
				const rand = Math.random() < 0.4;
				const result = await target
					.chooseCard(true)
					.set("glow_result", true)
					.set("ai", card => {
						if (rand) {
							return card.name == "shan" ? 1 : 0;
						}
						return card.name == "shan" ? 0 : 1;
					})
					.forResult();
				event.card2 = result.cards[0];
			}

			if (!event.resultOL && event.ol) {
				await game.pause();
			}
			try {
				if (!event.card1) {
					event.card1 = event.resultOL[player.playerid].cards[0];
				}
				if (!event.card2) {
					event.card2 = event.resultOL[target.playerid].cards[0];
				}
				if (!event.card1 || !event.card2) {
					throw new Error("err");
				}
			} catch (e) {
				console.log(e);
				return;
			}
			game.broadcastAll(
				(card1, card2) => {
					card1.classList.remove("glow");
					card2.classList.remove("glow");
				},
				event.card1,
				event.card2
			);

			game.broadcastAll(() => {
				ui.arena.classList.add("thrownhighlight");
			});
			game.addVideo("thrownhighlight1");
			player.$compare(event.card1, target, event.card2);
			await game.delay(4);

			let next = game.createEvent("showCards");
			next.player = player;
			next.cards = [event.card1];
			next.setContent("emptyEvent");
			game.log(player, "展示了", event.card1);
			await next;

			next = game.createEvent("showCards");
			next.player = target;
			next.cards = [event.card2];
			next.setContent("emptyEvent");
			game.log(target, "展示了", event.card2);
			await next;

			const name1 = get.name(event.card1);
			const name2 = get.name(event.card2);
			if (name1 == "sha" && name2 != "shan") {
				await player.discard(event.card1).set("animate", false);
				target.$gain2(event.card2);
				const clone = event.card1.clone;
				if (clone) {
					clone.style.transition = "all 0.5s";
					clone.style.transform = "scale(1.2)";
					clone.delete();
					game.addVideo("deletenode", player, get.cardsInfo([clone]));
				}
				game.broadcast(card => {
					const clone = card.clone;
					if (clone) {
						clone.style.transition = "all 0.5s";
						clone.style.transform = "scale(1.2)";
						clone.delete();
					}
				}, event.card1);
				await target.damage("nocard");
			} else if (name1 != "sha" && name2 == "shan") {
				await player.discard(event.card1).set("animate", false);
				target.$gain2(event.card2);
				const clone = event.card1.clone;
				if (clone) {
					clone.style.transition = "all 0.5s";
					clone.style.transform = "scale(1.2)";
					clone.delete();
					game.addVideo("deletenode", player, get.cardsInfo([clone]));
				}
				game.broadcast(card => {
					const clone = card.clone;
					if (clone) {
						clone.style.transition = "all 0.5s";
						clone.style.transform = "scale(1.2)";
						clone.delete();
					}
				}, event.card1);
				await player.gainPlayerCard(target, true, "he");
			} else {
				player.$gain2(event.card1);
				target.$gain2(event.card2);
			}
			game.broadcastAll(() => {
				ui.arena.classList.remove("thrownhighlight");
			});
			game.addVideo("thrownhighlight2");
		},
		ai: {
			order: 6,
			result: {
				target: -1,
			},
		},
	},
	zhanjue: {
		audio: 2,
		enable: "phaseUse",
		filterCard: true,
		selectCard: -1,
		position: "h",
		filter(event, player) {
			if (player.getStat().skill.zhanjue_draw && player.getStat().skill.zhanjue_draw >= 2) {
				return false;
			}
			var hs = player.getCards("h");
			if (!hs.length) {
				return false;
			}
			for (var i = 0; i < hs.length; i++) {
				var mod2 = game.checkMod(hs[i], player, "unchanged", "cardEnabled2", player);
				if (mod2 === false) {
					return false;
				}
			}
			return true;
		},
		viewAs: { name: "juedou" },
		group: ["zhanjue4"],
		ai: {
			damage: true,
			order(item, player) {
				if (player.countCards("h") > 1) {
					return 0.8;
				}
				return 8;
			},
			tag: {
				respond: 2,
				respondSha: 2,
				damage: 1,
			},
			result: {
				player(player, target) {
					let td = get.damageEffect(target, player, target);
					if (!td) {
						return 0;
					}
					let hs = player.getCards("h"),
						val = hs.reduce((acc, i) => acc - get.value(i, player), 0) / 6 + 1;
					if (td > 0) {
						return val;
					}
					if (
						player.hasSkillTag("directHit_ai", true, {
							target: target,
							card: get.autoViewAs({ name: "juedou" }, hs),
						})
					) {
						return val;
					}
					let pd = get.damageEffect(player, target, player),
						att = get.attitude(player, target);
					if (att > 0 && get.damageEffect(target, player, player) > pd) {
						return val;
					}
					let ts = target.mayHaveSha(player, "respond", null, "count");
					if (ts < 1 && ts * 8 < Math.pow(player.hp, 2)) {
						return val;
					}
					let damage = pd / get.attitude(player, player),
						ps = player.mayHaveSha(player, "respond", hs, "count");
					if (att > 0) {
						if (ts < 1) {
							return val;
						}
						return val + damage + 1;
					}
					if (pd >= 0) {
						return val + damage + 1;
					}
					if (ts - ps + Math.exp(0.8 - player.hp) < 1) {
						return val - ts;
					}
					return val + damage + 1 - ts;
				},
				target(player, target) {
					let td = get.damageEffect(target, player, target) / get.attitude(target, target);
					if (!td) {
						return 0;
					}
					let hs = player.getCards("h");
					if (
						td > 0 ||
						player.hasSkillTag("directHit_ai", true, {
							target: target,
							card: get.autoViewAs({ name: "juedou" }, hs),
						})
					) {
						return td + 1;
					}
					let pd = get.damageEffect(player, target, player),
						att = get.attitude(player, target);
					if (att > 0) {
						return td + 1;
					}
					let ts = target.mayHaveSha(player, "respond", null, "count"),
						ps = player.mayHaveSha(player, "respond", hs, "count");
					if (ts < 1) {
						return td + 1;
					}
					if (pd >= 0) {
						return 0;
					}
					if (ts - ps < 1) {
						return td + 1 - ts;
					}
					return -ts;
				},
			},
			effect: {
				player_use(card, player, target) {
					if (_status.event.skill == "zhanjue") {
						if (
							player.hasSkillTag(
								"directHit_ai",
								true,
								{
									target: target,
									card: card,
								},
								true
							)
						) {
							return;
						}
						if (player.countCards("h") >= 3 || target.countCards("h") >= 3) {
							return "zeroplayertarget";
						}
						if (player.countCards("h", "tao")) {
							return "zeroplayertarget";
						}
						if (target.countCards("h", "sha") > 1) {
							return "zeroplayertarget";
						}
					}
				},
			},
			nokeep: true,
			skillTagFilter(player, tag, arg) {
				if (tag === "nokeep") {
					return (!arg || (arg.card && get.name(arg.card) === "tao")) && player.isPhaseUsing() && get.skillCount("zhanjue_draw") < 2 && player.hasCard(card => get.name(card) != "tao", "h");
				}
			},
		},
	},
	zhanjue2: {
		audio: false,
		trigger: { player: "phaseBefore" },
		silent: true,
		sourceSkill: "zhanjue",
		async content(event, trigger, player) {
			player.storage.zhanjue = 0;
		},
	},
	zhanjue3: {
		audio: false,
		trigger: { player: "damageAfter", source: "damageAfter" },
		forced: true,
		popup: false,
		sourceSkill: "zhanjue",
		filter(event, player) {
			return event.parent.skill == "zhanjue";
		},
		async content(event, trigger, player) {
			trigger.player.addTempSkill("zhanjue5");
		},
	},
};
