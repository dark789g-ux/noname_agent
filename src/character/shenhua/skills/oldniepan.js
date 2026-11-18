import { lib, game, ui, get, ai, _status } from "noname";

/** @satisfies {Pick<NonNullable<importCharacterConfig["skill"]>, "oldniepan" | "quhu" | "jieming" | "qiangxix" | "qiangxi" | "xinqiangxi">} */
export const groupSkills = {
	oldniepan: {
		audio: "niepan",
		audioname2: { sb_pangtong: "sbniepan" },
		enable: "chooseToUse",
		skillAnimation: true,
		limited: true,
		animationColor: "orange",
		filter(event, player) {
			if (event.type == "dying") {
				if (player != event.dying) {
					return false;
				}
				return true;
			}
			return false;
		},
		async content(event, trigger, player) {
			player.awakenSkill(event.name);
			player.storage.oldniepan = true;
			await player.discard(player.getCards("hej"));
			await player.link(false);
			await player.turnOver(false);
			await player.draw(3);
			if (player.hp < 3) {
				await player.recover(3 - player.hp);
			}
		},
		ai: {
			order: 1,
			skillTagFilter(player, arg, target) {
				if (player != target || player.storage.oldniepan) {
					return false;
				}
			},
			save: true,
			result: {
				player(player) {
					if (player.hp <= 0) {
						return 10;
					}
					if (player.hp <= 2 && player.countCards("he") <= 1) {
						return 10;
					}
					return 0;
				},
			},
			threaten(player, target) {
				if (!target.storage.oldniepan) {
					return 0.6;
				}
			},
		},
	},
	quhu: {
		audio: 2,
		audioname: ["re_xunyu", "ol_xunyu"],
		enable: "phaseUse",
		usable: 1,
		filter(event, player) {
			if (player.countCards("h") == 0) {
				return false;
			}
			return game.hasPlayer(function (current) {
				return current.hp > player.hp && player.canCompare(current);
			});
		},
		filterTarget(card, player, target) {
			return target.hp > player.hp && player.canCompare(target);
		},
		async content(event, trigger, player) {
			const target = event.target;
			const { bool } = await player.chooseToCompare(target).forResult();
			if (!bool) {
				return void (await player.damage(target));
			}
			if (
				!game.hasPlayer(function (player) {
					return player != target && target.inRange(player);
				})
			) {
				return;
			}
			const result = await player
				.chooseTarget(function (card, player, target) {
					const source = _status.event.source;
					return target != source && source.inRange(target);
				}, true)
				.set("ai", function (target) {
					return get.damageEffect(target, _status.event.source, player);
				})
				.set("source", target)
				.forResult();
			if (!result.bool || !result.targets || !result.targets.length) {
				return;
			}
			target.line(result.targets[0], "green");
			await result.targets[0].damage(target);
		},
		ai: {
			order: 0.5,
			result: {
				target(player, target) {
					const att = get.attitude(player, target);
					const oc = target.countCards("h") == 1;
					if (att > 0 && oc) {
						return 0;
					}
					const players = game.filterPlayer();
					for (let i = 0; i < players.length; i++) {
						if (players[i] != target && players[i] != player && target.inRange(players[i])) {
							if (get.damageEffect(players[i], target, player) > 0) {
								return att > 0 ? att / 2 : att - (oc ? 5 : 0);
							}
						}
					}
					return 0;
				},
				player(player, target) {
					if (target.hasSkillTag("jueqing", false, target)) {
						return -10;
					}
					const hs = player.getCards("h");
					let mn = 1;
					for (let i = 0; i < hs.length; i++) {
						mn = Math.max(mn, get.number(hs[i]));
					}
					if (mn <= 11 && player.hp < 2) {
						return -20;
					}
					let max = player.maxHp - hs.length;
					const players = game.filterPlayer();
					for (let i = 0; i < players.length; i++) {
						if (get.attitude(player, players[i]) > 2) {
							max = Math.max(Math.min(5, players[i].hp) - players[i].countCards("h"), max);
						}
					}
					switch (max) {
						case 0:
							return mn == 13 ? 0 : -20;
						case 1:
							return mn >= 12 ? 0 : -15;
						case 2:
							return 0;
						case 3:
							return 1;
						default:
							return max;
					}
				},
			},
			expose: 0.2,
		},
	},
	jieming: {
		audio: 2,
		trigger: { player: "damageEnd" },
		getIndex(event) {
			return event.num;
		},
		async cost(event, trigger, player) {
			event.result = await player
				.chooseTarget(get.prompt2(event.skill), function (card, player, target) {
					return true; //target.countCards('h')<Math.min(target.maxHp,5); // 没有卷入格式化大劫的上古代码碎片喵
				})
				.set("ai", function (target) {
					let att = get.attitude(_status.event.player, target);
					if (target.hasSkillTag("nogain")) {
						att /= 6;
					}
					if (att > 2) {
						return Math.max(0, Math.min(5, target.maxHp) - target.countCards("h"));
					}
					return att / 3;
				})
				.forResult();
		},
		async content(event, trigger, player) {
			for (const target of event.targets) {
				await target.drawTo(Math.min(5, target.maxHp));
			}
		},
		ai: {
			maixie: true,
			maixie_hp: true,
			effect: {
				target(card, player, target, current) {
					if (get.tag(card, "damage") && target.hp > 1) {
						if (player.hasSkillTag("jueqing", false, target)) {
							return [1, -2];
						}
						const players = game.filterPlayer();
						let max = 0;
						for (let i = 0; i < players.length; i++) {
							if (get.attitude(target, players[i]) > 0) {
								max = Math.max(Math.min(5, players[i].hp) - players[i].countCards("h"), max);
							}
						}
						switch (max) {
							case 0:
								return 2;
							case 1:
								return 1.5;
							case 2:
								return [1, 2];
							default:
								return [0, max];
						}
					}
					if ((card.name == "tao" || card.name == "caoyao") && target.hp > 1 && target.countCards("h") <= target.hp) {
						return [0, 0];
					}
				},
			},
		},
	},
	qiangxix: {
		audio: "qiangxi",
		audioname: ["boss_lvbu3"],
		mod: {
			aiOrder(player, card, num) {
				if (player.getEquips(1).length || get.subtype(card, player) !== "equip1" || !player.hasSkillTag("noe")) {
					return num;
				}
				return 10;
			},
		},
		enable: "phaseUse",
		usable: 2,
		locked: false,
		filter(event, player) {
			if (player.hp < 1 && !player.hasCard(card => lib.skill.qiangxix.filterCard(card), "he")) {
				return false;
			}
			return game.hasPlayer(current => lib.skill.qiangxix.filterTarget(null, player, current));
		},
		filterCard(card) {
			return get.subtype(card) == "equip1";
		},
		position: "he",
		filterTarget(card, player, target) {
			if (target == player) {
				return false;
			}
			var stat = player.getStat()._qiangxix;
			return !stat || !stat.includes(target);
		},
		selectCard() {
			if (_status.event.player.hp < 1) {
				return 1;
			}
			return [0, 1];
		},
		async content(event, trigger, player) {
			const { target, cards } = event;
			const stat = player.getStat();
			stat._qiangxix ??= [];
			stat._qiangxix.push(target);

			if (!cards?.length) {
				await player.loseHp();
			}
			await target.damage("nocard");
		},
		ai: {
			damage: true,
			order: 8,
			result: {
				player(player, target) {
					if (ui.selected.cards.length) {
						return 0;
					}
					if (player.hp >= target.hp) {
						return -0.9;
					}
					if (player.hp <= 2) {
						return -10;
					}
					return get.effect(player, { name: "losehp" }, player, player);
				},
				target(player, target) {
					if (!ui.selected.cards.length) {
						if (player.hp < 2) {
							return 0;
						}
						if (player.hp == 2 && target.hp >= 2) {
							return 0;
						}
						if (target.hp > player.hp) {
							return 0;
						}
					}
					return get.damageEffect(target, player, target);
				},
			},
			threaten: 1.5,
		},
	},
	qiangxi: {
		audio: 2,
		enable: "phaseUse",
		usable: 1,
		audioname: ["boss_lvbu3"],
		filterCard(card) {
			return get.subtype(card) == "equip1";
		},
		selectCard: [0, 1],
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			return player.inRange(target);
		},
		async content(event, trigger, player) {
			if (event.cards.length == 0) {
				await player.loseHp();
			}
			await event.target.damage("nocard");
		},
		check(card) {
			return 10 - get.value(card);
		},
		position: "he",
		ai: {
			damage: true,
			order: 8,
			result: {
				player(player, target) {
					if (ui.selected.cards.length) {
						return 0;
					}
					if (player.hp >= target.hp) {
						return -0.9;
					}
					if (player.hp <= 2) {
						return -10;
					}
					return -2;
				},
				target(player, target) {
					if (!ui.selected.cards.length) {
						if (player.hp < 2) {
							return 0;
						}
						if (player.hp == 2 && target.hp >= 2) {
							return 0;
						}
						if (target.hp > player.hp) {
							return 0;
						}
					}
					return get.damageEffect(target, player);
				},
			},
			threaten: 1.3,
		},
	},
	xinqiangxi: {
		audio: "qiangxi",
		enable: "phaseUse",
		filter(event, player) {
			const list = player.getStorage("xinqiangxi_used");
			if (list.includes("discard")) {
				return !list.includes("losehp");
			} else if (list.includes("losehp")) {
				return !list.includes("discard") && player.countCards("he", { type: "equip" }) > 0;
			} else {
				return true;
			}
		},
		filterCard(card) {
			const player = _status.event.player;
			if (player.getStorage("xinqiangxi_used").includes("discard")) {
				return false;
			}
			return get.type(card) == "equip";
		},
		selectCard() {
			const player = _status.event.player;
			if (player.getStorage("xinqiangxi_used").includes("discard")) {
				return -1;
			}
			if (player.getStorage("xinqiangxi_used").includes("losehp")) {
				return [1, 1];
			}
			return [0, 1];
		},
		filterTarget(card, player, target) {
			if (player == target) {
				return false;
			}
			return player.inRange(target);
		},
		async content(event, trigger, player) {
			player.addTempSkill("xinqiangxi_used");
			if (event.cards.length == 0) {
				player.markAuto("xinqiangxi_used", "losehp");
				await player.loseHp();
			} else {
				player.markAuto("xinqiangxi_used", "discard");
			}
			await event.target.damage("nocard");
		},
		check(card) {
			return 10 - get.value(card);
		},
		position: "he",
		ai: {
			order: 8.5,
			result: {
				target(player, target) {
					if (!ui.selected.cards.length) {
						if (player.hp < 2) {
							return 0;
						}
						if (target.hp >= player.hp) {
							return 0;
						}
					}
					return get.damageEffect(target, player);
				},
			},
		},
		threaten: 1.5,
		subSkill: {
			used: {
				charlotte: true,
				onremove: true,
			},
		},
	},
};
